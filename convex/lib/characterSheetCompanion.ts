import { ConvexError } from 'convex/values';
import { calculateActiveCharacterSheet } from './catalogReleaseCompatibility';
import type { Doc, Id } from '../_generated/dataModel';
import type { ReadCtx } from '../types';
import { requireCharacterAccess } from './characterAccess';
import {
  loadLinkedInputContext,
  loadSavedLinkedInputs,
  resolveLinkedInput,
  type LinkedEndpointReader,
  type LinkedInputRead,
} from './characterSheetLinkedInputReader';
import {
  buildCharacterSheetInput,
  createReadBudget,
  readCharacterSheetDataWithBudget,
  type readCharacterSheetData,
} from './characterSheetData';
import {
  readCompanionGraph,
  isSupportingSourceAvailable,
  listRelationshipLinkedInputs,
  listUnsupportedUnchainedEidolonArchetypes,
  summarizeAssociatedAllocationShares,
} from './companionRelationshipGraph';
import {
  isCompanionPooledRuleKind,
  type CompanionAllocationShare,
} from '../../src/lib/character-sheet-companion-sources';
import {
  isCompanionComponentRuleKind,
  largestBroodSize,
  readGroupPurchases,
  sumComponents,
  type CompanionGroupPurchaseRecords,
} from '../../src/lib/character-sheet-companion-components';
import { isEidolonState } from '../../src/lib/character-sheet-eidolon-progression';

import {
  isCompanionProgressionRuleKind,
  type CompanionProgressionSource,
} from '../../src/lib/character-sheet-companion-progression';
import { familiarAttackOptions } from '../../src/lib/character-sheet-familiar';
import type { CompanionCalculationInputs } from '../../src/lib/character-sheet-companion-calculation-inputs';
import {
  cohortCalculationInputSchema,
  type CohortCalculationInput,
} from '../../src/lib/character-sheet-cohort-schema';
import {
  companionLinkedInputResolutionSchema,
  type CompanionLinkedInputValue,
} from '../../src/lib/character-sheet-linked-inputs';

type Sheet = Awaited<ReturnType<typeof readCharacterSheetData>>;
// Relationship kinds whose sources advance a recorded Companion Progression.
// Either eidolon kind supplies sources whose rule kind follows the summoner
// levels' version, so each eidolon counts only its own version (#418).
const progressionRelationshipKinds = new Set<
  Doc<'companionRelationship'>['kind']
>(['animalCompanion', 'eidolon', 'unchainedEidolon']);

// Raw sheet loading remains independent of relationship projection so graph
// eligibility can inspect recorded sources without recursively calculating them.
export async function applyCompanionToSheet<T extends Sheet>(
  ctx: ReadCtx,
  sheet: T,
  {
    trustedLinkedInputs = false,
    recalculate = false,
    calculationIdentity,
    readSheet,
    readBudget = createReadBudget(undefined),
  }: {
    trustedLinkedInputs?: boolean;
    recalculate?: boolean;
    calculationIdentity?: string;
    readSheet?: (character: Doc<'character'>) => Promise<Sheet>;
    readBudget?: {
      accountRead(value: unknown): void;
      accountReference(id: string): void;
    };
  } = {},
): Promise<
  T & {
    familiarRelationshipId: Id<'companionRelationship'> | null;
    companionCalculationInputs: CompanionCalculationInputs | null;
  }
> {
  // The sheet read already selected the release boundary inside its budget.
  const identity = calculationIdentity ?? sheet.calculationIdentity;
  const memo = new Map<Id<'character'>, Sheet>();
  const currentInputs = new Map<Id<'character'>, CompanionCalculationInputs>();
  const rawSheets = new Map<Id<'character'>, Sheet>([
    [sheet.character._id, sheet],
  ]);
  async function readRawSheet(character: Doc<'character'>) {
    const cached = rawSheets.get(character._id);
    if (cached) return cached;
    const loaded = await (readSheet
      ? readSheet(character)
      : readCharacterSheetDataWithBudget(ctx, character, [], {}, readBudget));
    rawSheets.set(character._id, loaded);
    return loaded;
  }
  const visiting = new Set<Id<'character'>>();
  const readEndpoint: LinkedEndpointReader = async (characterId) => {
    let character: Doc<'character'> | null;
    if (trustedLinkedInputs)
      character = await ctx.db.get('character', characterId);
    else {
      try {
        character = (await requireCharacterAccess(ctx, { characterId }))
          .character;
      } catch (error) {
        if (!(error instanceof ConvexError)) throw error;
        return { accessible: false, sheet: null };
      }
    }
    readBudget?.accountRead(character);
    readBudget?.accountReference(characterId);
    if (!character?.sheetMode) return { accessible: true, sheet: null };
    if (visiting.has(characterId)) return { accessible: true, sheet: null };
    const cached = memo.get(characterId);
    return {
      accessible: true,
      sheet: cached ?? (await calculate(await readRawSheet(character))),
    };
  };
  async function calculate<U extends Sheet>(
    baseline: U,
  ): Promise<
    U & { familiarRelationshipId: Id<'companionRelationship'> | null }
  > {
    const characterId = baseline.character._id;
    if (visiting.size >= 1024)
      throw new ConvexError('Too many connected Companions');
    visiting.add(characterId);
    const graph = await readCompanionGraph(ctx, characterId, [baseline], {
      readSheet: readRawSheet,
      readBudget,
    });
    const relationship = selectCompanionRelationship(graph, characterId);
    if (!relationship) {
      visiting.delete(characterId);
      const projections = recalculate
        ? calculateActiveCharacterSheet(
            buildCharacterSheetInput(baseline),
            identity,
          )
        : null;
      const result = {
        ...baseline,
        ...(projections
          ? {
              calculated: projections.current,
              permanentCalculated: projections.permanent,
              permanentResolvedEntries: projections.permanent.resolvedEntries,
            }
          : {}),
        familiarRelationshipId: null,
      };
      memo.set(characterId, result);
      return result;
    }
    const projectionInputs = await companionProjectionInputs(ctx, {
      baseline,
      relationship,
      readEndpoint,
      graph,
      readBudget,
    });
    if (progressionRelationshipKinds.has(relationship.kind))
      currentInputs.set(characterId, {
        kind: 'progression',
        companionLinkedInputs: (
          projectionInputs.current.companionLinkedInputs ?? []
        ).map((input) => companionLinkedInputResolutionSchema.parse(input)),
        companionProgressionSources: [
          ...(projectionInputs.current.companionProgressionSources ?? []),
        ],
      });
    if (projectionInputs.current.cohort)
      currentInputs.set(characterId, {
        kind: 'cohort',
        cohort: cohortCalculationInputSchema.parse(
          projectionInputs.current.cohort,
        ),
      });
    const { current: calculated, permanent } = calculateActiveCharacterSheet(
      buildCharacterSheetInput(baseline),
      identity,
      { projectionInputs },
    );
    const { resolvedEntries: _resolvedEntries, ...permanentCalculated } =
      permanent;
    const result = {
      ...baseline,
      calculated,
      permanentCalculated,
      permanentResolvedEntries: permanent.resolvedEntries,
      familiarRelationshipId:
        relationship.kind === 'familiar' ? relationship._id : null,
    };
    visiting.delete(characterId);
    memo.set(characterId, result);
    return result;
  }
  const result = await calculate(sheet);
  return {
    ...result,
    companionCalculationInputs: currentInputs.get(sheet.character._id) ?? null,
  };
}

const emptyShare: Omit<CompanionAllocationShare, 'members'> = {
  allocated: 0,
  companions: 0,
  selections: 0,
};

type LinkedSource = LinkedInputContext['sources'][number];
type ProgressionSourceRead = LinkedSource & {
  ruleKind: CompanionProgressionSource['ruleKind'];
};
/**
 * What one source's read discloses of the associated Character: its key and
 * every detail with access to it, otherwise only what the companion's own
 * values need (PRD §15).
 */
type SourceDisclosure = (
  source: ProgressionSourceRead,
) => Pick<CompanionProgressionSource, 'sourceKey'> &
  Partial<CompanionProgressionSource>;

/**
 * With access to the associated Character: its size, sibling totals, group
 * purchases, unsupported Archetypes and the competing rules' names.
 */
function discloseSourceDetails({
  context,
  graph,
}: {
  context: LinkedInputContext;
  graph: CompanionGraph;
}): SourceDisclosure {
  const { associated, calculated } = context;
  const shares = associated
    ? summarizeAssociatedAllocationShares({
        graph,
        associatedCharacterId: context.relationship.associatedCharacterId,
        sheet: associated,
        countingEntries: context.countingEntries,
      })
    : null;
  const unsupportedArchetypes =
    associated && calculated
      ? listUnsupportedUnchainedEidolonArchetypes({
          catalogEntries: associated.catalogEntries,
          calculated,
        })
      : [];
  // Group purchases are recorded on the budget owner's sheet.
  const groupPurchases = associated?.entries.find(
    (entry) => entry.kind === 'base',
  )?.state.companionGroupPurchases;
  return (source) => {
    const share =
      shares && isCompanionPooledRuleKind(source.ruleKind)
        ? (shares.get(source.ruleKind) ?? emptyShare)
        : null;
    return {
      sourceKey: source.key,
      ...(calculated
        ? { associatedSize: calculated.racial.size ?? 'medium' }
        : {}),
      ...(source.ruleKind === 'unchainedEidolon' && unsupportedArchetypes.length
        ? { unsupportedArchetypes }
        : {}),
      ...(source.ruleConflicts?.length
        ? {
            ruleConflict: {
              disclosure: 'disclosed',
              ruleKinds: source.ruleConflicts,
            },
          }
        : {}),
      ...(share ? poolFor(share, source.ruleKind, groupPurchases) : {}),
    };
  };
}

/**
 * Without access: the rule kind for a key, that rules compete without
 * naming them, and whether the brood pays this eidolon's large evolution.
 */
function withholdSourceDetails(
  groupPurchases: CompanionGroupPurchaseRecords | undefined,
): SourceDisclosure {
  return (source) => ({
    sourceKey: `rule:${source.ruleKind}`,
    ...(source.ruleConflicts?.length
      ? { ruleConflict: { disclosure: 'undisclosed' } }
      : {}),
    ...(isCompanionComponentRuleKind(source.ruleKind) &&
    largestBroodSize(
      readGroupPurchases(groupPurchases, source.ruleKind) ?? [],
    ) === 'large'
      ? { isLargePaidByGroup: true }
      : {}),
  });
}

function progressionSources({
  context,
  disclose,
}: {
  context: LinkedInputContext;
  disclose: SourceDisclosure;
}): CompanionProgressionSource[] {
  if (!progressionRelationshipKinds.has(context.relationship.kind)) return [];
  return context.sources.flatMap((source) => {
    const { ruleKind } = source;
    if (!isCompanionProgressionRuleKind(ruleKind)) return [];
    return [
      {
        ruleKind,
        counting: isCountingSource(context, source),
        ...(source.allocatedLevels === undefined
          ? {}
          : { allocatedLevels: source.allocatedLevels }),
        ...(source.allocatedComponents === undefined
          ? {}
          : { allocatedComponents: source.allocatedComponents }),
        ...disclose({ ...source, ruleKind }),
      },
    ];
  });
}

/**
 * The group purchases on a summoner this reader cannot access, read only
 * when the companion records a large evolution its brood may pay for: the
 * read discloses that fact alone, never the purchases (UM p. 78, PRD §15).
 */
async function readWithheldGroupPurchases(
  ctx: ReadCtx,
  {
    baseline,
    context,
    graph,
    readBudget,
  }: {
    baseline: Sheet;
    context: LinkedInputContext;
    graph: CompanionGraph;
    readBudget?: ReadBudget;
  },
): Promise<CompanionGroupPurchaseRecords | undefined> {
  const { relationship } = context;
  const progression = baseline.entries.find((entry) => entry.kind === 'base')
    ?.state.companionProgression;
  if (
    !progression ||
    !isEidolonState(progression) ||
    !progression.evolutions.some((evolution) => evolution.key === 'large') ||
    !context.sources.some((source) =>
      isCompanionComponentRuleKind(source.ruleKind),
    )
  )
    return undefined;
  const loaded = graph.sheets.get(relationship.associatedCharacterId);
  if (loaded)
    return loaded.entries.find((entry) => entry.kind === 'base')?.state
      .companionGroupPurchases;
  const base = await ctx.db
    .query('characterSheetEntry')
    .withIndex('by_characterId_and_kind_and_active', (q) =>
      q
        .eq('characterId', relationship.associatedCharacterId)
        .eq('kind', 'base')
        .eq('active', true),
    )
    .unique();
  readBudget?.accountRead(base);
  if (base) readBudget?.accountReference(base._id);
  return base?.kind === 'base' ? base.state.companionGroupPurchases : undefined;
}

type LinkedInputContext = Awaited<ReturnType<typeof loadLinkedInputContext>>;
/**
 * A source supports the companion unless its relationship was replaced, it
 * is disabled or the associated sheet no longer counts it; a hidden
 * associated sheet keeps it counting with unavailable inputs.
 */
function isCountingSource(
  context: LinkedInputContext,
  source: LinkedInputContext['sources'][number],
) {
  return (
    context.relationship.status !== 'replaced' &&
    source.enabled &&
    (!context.associated ||
      isSupportingSourceAvailable(source, context.countingEntries))
  );
}
/**
 * A cohort's leader inputs and supporting sources, counting like progression
 * sources. The recorded Leadership modifiers describe the leader and are
 * written with access to it, so they are disclosed only with that access
 * (PRD §15).
 */
function cohortInput(
  context: LinkedInputContext,
  linkedInputs: CohortCalculationInput['linkedInputs'],
): CohortCalculationInput {
  if (!context.endpointAccess)
    return {
      sources: context.sources.map((source) => ({
        sourceKey: `rule:${source.ruleKind}`,
        counting: isCountingSource(context, source),
      })),
      linkedInputs,
      areModifiersUndisclosed: true,
    };
  return {
    sources: context.sources.map((source) => ({
      sourceKey: source.key,
      counting: isCountingSource(context, source),
      ...(source.leadershipModifiers
        ? { leadershipModifiers: source.leadershipModifiers }
        : {}),
    })),
    linkedInputs,
  };
}

/** A source's sibling totals: a component pool or a level pool. */
function poolFor(
  share: Omit<CompanionAllocationShare, 'members'>,
  ruleKind: CompanionProgressionSource['ruleKind'],
  groupPurchases: CompanionGroupPurchaseRecords | undefined,
): Pick<CompanionProgressionSource, 'pool' | 'componentPool'> {
  if (isCompanionComponentRuleKind(ruleKind))
    return {
      componentPool: {
        allocated: share.components ?? sumComponents([]),
        companions: share.companions,
        groupPurchases: readGroupPurchases(groupPurchases, ruleKind) ?? [],
      },
    };
  return {
    pool: {
      allocated: share.allocated,
      companions: share.companions,
      selections: share.selections,
    },
  };
}

type CompanionGraph = Awaited<ReturnType<typeof readCompanionGraph>>;

type ReadBudget = {
  accountRead(value: unknown): void;
  accountReference(id: string): void;
};
function selectCompanionRelationship(
  graph: CompanionGraph,
  characterId: Id<'character'>,
) {
  const active = graph.active.get(characterId);
  if (active) return active;
  return [...graph.relationships.values()]
    .filter((row) => row.companionCharacterId === characterId)
    .sort(
      (a, b) =>
        Number(b.status === 'active') - Number(a.status === 'active') ||
        b.activatedAt - a.activatedAt ||
        b._creationTime - a._creationTime ||
        b._id.localeCompare(a._id),
    )[0];
}
async function companionProjectionInputs(
  ctx: ReadCtx,
  {
    baseline,
    relationship,
    readEndpoint,
    graph,
    readBudget,
  }: {
    baseline: Sheet;
    relationship: Doc<'companionRelationship'>;
    readEndpoint: LinkedEndpointReader;
    graph: CompanionGraph;
    readBudget?: ReadBudget;
  },
) {
  const saved = await loadSavedLinkedInputs(ctx, {
    characterId: baseline.character._id,
    relationshipId: relationship._id,
  });
  for (const row of saved) {
    readBudget?.accountRead(row);
    readBudget?.accountReference(row._id);
  }
  const projectionInputs: NonNullable<
    NonNullable<
      Parameters<typeof calculateActiveCharacterSheet>[2]
    >['projectionInputs']
  > = {
    current: {},
    permanent: {},
  };
  type ProjectionInput = (typeof projectionInputs)['current'];
  // Read once for both projections, and only without access.
  let withheldGroupPurchases:
    | Promise<CompanionGroupPurchaseRecords | undefined>
    | undefined;
  async function discloseSources(
    context: LinkedInputContext,
  ): Promise<SourceDisclosure> {
    if (context.endpointAccess)
      return discloseSourceDetails({ context, graph });
    withheldGroupPurchases ??= readWithheldGroupPurchases(ctx, {
      baseline,
      context,
      graph,
      readBudget,
    });
    return withholdSourceDetails(await withheldGroupPurchases);
  }
  async function projectionInput(
    context: LinkedInputContext,
    linkedInputs: LinkedInputRead[],
  ): Promise<ProjectionInput> {
    if (relationship.kind === 'familiar')
      return {
        familiar: {
          baseCreatureKey: baseline.character.familiarBaseCreatureKey,
          linkedInputs,
        },
        ...familiarAttackOptions,
      };
    // The leader's inputs feed only the cohort calculation, never the
    // cohort's own prerequisites or statistics.
    if (relationship.kind === 'cohort')
      return { cohort: cohortInput(context, linkedInputs) };
    return {
      companionLinkedInputs: linkedInputs,
      companionProgressionSources: progressionSources({
        context,
        disclose: await discloseSources(context),
      }),
    };
  }
  // Sequential projections share endpoint calculations without treating
  // concurrent reads of a shared master as a cycle.
  for (const projection of ['current', 'permanent'] as const) {
    const context = await loadLinkedInputContext(ctx, {
      scope: { sheet: baseline, relationship, saved },
      projection,
      readEndpoint,
      graph,
    });
    const values = new Map<string, CompanionLinkedInputValue>();
    const linkedInputs = listRelationshipLinkedInputs({
      ...relationship,
      sources: context.sources,
    }).map(({ input }) => resolveLinkedInput(context, input, values));
    projectionInputs[projection] = await projectionInput(context, linkedInputs);
  }
  return projectionInputs;
}
