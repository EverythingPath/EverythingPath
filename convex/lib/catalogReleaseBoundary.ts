import { readRetiredDefinition } from './catalogCandidateDefinition';
import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { ReadCtx } from '../types';
import { readCompatibleActiveRelease } from './catalogReleaseCompatibility';
import { candidateDefinition } from './catalogCandidateDefinition';
import { reviewedCastingTablesSchema } from '../../src/lib/character-sheet-casting-tables';
import { isObject } from '../../src/lib/catalog/release-schema';
import {
  isRetiredTargetGrant,
  type ResolvedSheetEntry,
} from '../../src/lib/character-sheet-grants';

export async function readSelectedCatalogBoundary(
  ctx: ReadCtx,
  readBudget?: { accountRead(value: unknown): void },
) {
  const compatible = await readCompatibleActiveRelease(ctx, readBudget);
  const control = compatible.control;
  const release = control
    ? control.releaseId
      ? await ctx.db.get('catalogRelease', control.releaseId)
      : await ctx.db
          .query('catalogRelease')
          .withIndex('by_releaseNumber', (q) =>
            q.eq('releaseNumber', control.releaseNumber),
          )
          .unique()
    : null;
  readBudget?.accountRead(release);
  if (
    control &&
    (release?.state !== 'prepared' ||
      release.releaseNumber !== control.releaseNumber ||
      release.manifest.compatibility.schema !== control.schemaIdentity ||
      release.manifest.compatibility.calculation !==
        control.calculationIdentity)
  )
    throw new ConvexError('Selected Catalog Release is unavailable');
  return { ...compatible, release };
}

export async function projectSelectedCatalogDefinition(
  ctx: ReadCtx,
  definition: Doc<'catalogEntry'>,
  boundary?: Awaited<ReturnType<typeof readSelectedCatalogBoundary>>,
  readBudget?: { accountRead(value: unknown): void },
) {
  const { release } = boundary ?? (await readSelectedCatalogBoundary(ctx));
  return release
    ? candidateDefinition(ctx, release, definition, {
        bytes: 0,
        accountRead: (value) => readBudget?.accountRead(value),
      })
    : definition;
}

/**
 * A definition's state as a catalog choice, as `readSelectedChoiceStates`
 * decides it: `offered`, `held` or `outside`.
 */
export type SelectedChoiceState = 'offered' | 'held' | 'outside';
const offered: SelectedChoiceState = 'offered';

/**
 * #753, race-save-release-membership: the one decision behind the read's
 * catalog choices and their held IDs. A definition is `outside` when it is
 * global, not a Catalog Copy, and `candidateDefinition` returned the stored
 * object itself; what body `candidateDefinition` selects is its own
 * contract. `held` is #411's retirement among the definitions not outside,
 * one retirement lookup per distinct release-governed identity
 * (`isReleaseDefinition`). With no release selected, everything is offered
 * as stored. Takes stored definitions, and the selected boundary when the
 * caller has read it, and returns each one's selected body with its state,
 * in order.
 */
export async function readSelectedChoiceStates(
  ctx: ReadCtx,
  definitions: readonly Doc<'catalogEntry'>[],
  boundary?: SelectedBoundary,
) {
  const { release } = boundary ?? (await readSelectedCatalogBoundary(ctx));
  if (!release)
    return definitions.map((definition) => ({
      definition,
      state: offered,
    }));
  const projected = await Promise.all(
    definitions.map(async (stored) => {
      const definition = await candidateDefinition(ctx, release, stored);
      const isOutside =
        definition.scope === 'global' &&
        !definition.copiedFrom &&
        definition === stored;
      return { definition, isOutside };
    }),
  );
  const retired = await readRetiredIdentities(
    ctx,
    release._id,
    projected.flatMap(({ definition, isOutside }) =>
      isOutside ? [] : [definition],
    ),
  );
  return projected.map(({ definition, isOutside }) => {
    let state = offered;
    if (isOutside) state = 'outside';
    else if (
      isReleaseDefinition(definition) &&
      retired.has(definition.ruleIdentity)
    )
      state = 'held';
    return { definition, state };
  });
}

/**
 * #753: the selected catalog choices, each with whether it is held: every
 * definition `readSelectedChoiceStates` does not put outside the release.
 */
export async function projectSelectedCatalogChoices(
  ctx: ReadCtx,
  definitions: readonly Doc<'catalogEntry'>[],
) {
  return (await readSelectedChoiceStates(ctx, definitions)).flatMap(
    ({ definition, state }) =>
      state === 'outside' ? [] : [{ definition, isHeld: state === 'held' }],
  );
}

export async function readSelectedCatalogResources(
  ctx: ReadCtx,
  readBudget?: { accountRead(value: unknown): void },
  boundary?: Awaited<ReturnType<typeof readSelectedCatalogBoundary>>,
) {
  const { release } =
    boundary ?? (await readSelectedCatalogBoundary(ctx, readBudget));
  const row = release
    ? await ctx.db
        .query('catalogReleaseRow')
        .withIndex('by_releaseId_and_kind_and_key', (q) =>
          q
            .eq('releaseId', release._id)
            .eq('kind', 'resource')
            .eq('key', 'builtin:casting-tables'),
        )
        .unique()
    : null;
  readBudget?.accountRead(row);
  const payload: unknown = row?.payload;
  return {
    castingTables: isObject(payload)
      ? reviewedCastingTablesSchema.parse(payload.definitions)
      : undefined,
  };
}

/** Live writes replace only their Character's facts; candidate publication is a pointer switch. */
export async function readSelectedCharacterFacts(
  ctx: ReadCtx,
  characterId: Id<'character'>,
  boundary?: Awaited<ReturnType<typeof readSelectedCatalogBoundary>>,
) {
  const { control } = boundary ?? (await readSelectedCatalogBoundary(ctx));
  const live = await ctx.db
    .query('catalogCharacterFacts')
    .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
    .unique();
  if (live?.releaseNumber === (control?.releaseNumber ?? null))
    return { facts: live.facts, generation: live.generation };
  const impactRunId = control?.impactRunId;
  const work = impactRunId
    ? await ctx.db
        .query('catalogImpactWork')
        .withIndex('by_runId_and_characterId', (q) =>
          q.eq('runId', impactRunId).eq('characterId', characterId),
        )
        .unique()
    : null;
  if ((work?.state === 'ready' || work?.state === 'unaffected') && work.facts)
    return { facts: work.facts, generation: work.factGeneration ?? 0 };
  if (live && (!work || work.state === 'unaffected'))
    return {
      facts: live.facts,
      generation: work?.factGeneration ?? live.generation,
    };
  return null;
}

type ReadBudget = { accountRead(value: unknown): void };
type SelectedBoundary = Awaited<ReturnType<typeof readSelectedCatalogBoundary>>;

/** Definitions a Catalog Release selects: globals, imported Spells and their copies. */
export function isReleaseDefinition(definition: Doc<'catalogEntry'>) {
  return (
    definition.scope === 'global' ||
    Boolean(definition.importedSpell) ||
    Boolean(definition.copiedFrom)
  );
}

/** Every definition another one grants automatically, by Catalog Entry ID. */
function listAutomaticGrantTargetIds(definition: Doc<'catalogEntry'>) {
  const detail = definition.detail;
  return [
    ...(definition.grants ?? []).map((grant) => grant.catalogEntryId),
    ...(detail.kind === 'class' && 'featuresByLevel' in detail
      ? detail.featuresByLevel.map((feature) => feature.catalogEntryId)
      : []),
    ...(detail.kind === 'race' ? detail.racialTraits : []),
    ...(detail.kind === 'archetype'
      ? detail.adds.map((added) => added.catalogEntryId)
      : []),
  ];
}

/**
 * #411: the rule identities a release retires among these definitions. One
 * indexed release-row read per distinct identity; a sheet's definitions are
 * bounded by its 4,096-row read limit.
 */
async function readRetiredIdentities(
  ctx: ReadCtx,
  releaseId: Id<'catalogRelease'>,
  definitions: readonly Doc<'catalogEntry'>[],
  readBudget?: ReadBudget,
) {
  const identities = new Set(
    definitions.filter(isReleaseDefinition).map((row) => row.ruleIdentity),
  );
  const retired = new Set<string>();
  for (const identity of identities) {
    const row = await readRetiredDefinition(ctx, releaseId, identity);
    readBudget?.accountRead(row);
    if (row) retired.add(identity);
  }
  return retired;
}

/**
 * #411: the identities a release retires among a sheet's automatic Grant
 * targets and classes. Grants of them count only as existing uses, and a
 * retired class in use carries an advisory.
 */
export async function readRetiredSheetIdentities(
  ctx: ReadCtx,
  releaseId: Id<'catalogRelease'>,
  definitions: readonly Doc<'catalogEntry'>[],
  readBudget?: ReadBudget,
) {
  const targetIds = new Set<string>(
    definitions.flatMap(listAutomaticGrantTargetIds),
  );
  const retired = await readRetiredIdentities(
    ctx,
    releaseId,
    definitions.filter(
      (row) => targetIds.has(row._id) || row.detail.kind === 'class',
    ),
    readBudget,
  );
  return [...retired].sort();
}

/** The Grants of retired targets a calculated sheet already counts or records. */
export function listRetainedGrantIds(
  sheet: {
    catalogEntries: readonly { _id: string; ruleIdentity: string }[];
    calculated: { resolvedEntries: readonly ResolvedSheetEntry[] };
  },
  retiredIdentities: readonly string[],
) {
  const retired = new Set(retiredIdentities);
  const identities = new Map<string, string>(
    sheet.catalogEntries.map((row) => [row._id, row.ruleIdentity]),
  );
  return sheet.calculated.resolvedEntries
    .filter(
      (row) =>
        (row.counting || row.recorded) &&
        row.reason?.kind !== 'retired' &&
        isRetiredTargetGrant(row, (id) => identities.get(id), retired),
    )
    .map(({ entry }) => entry._id)
    .sort();
}

/**
 * #411: what the selected release retired among a sheet's Grant targets and
 * classes, and which of those Grants this Character already had when it was
 * activated.
 */
export async function readSelectedRetired(
  ctx: ReadCtx,
  characterId: Id<'character'>,
  definitions: readonly Doc<'catalogEntry'>[],
  readBudget?: ReadBudget,
  boundary?: SelectedBoundary,
) {
  const { release, control } =
    boundary ?? (await readSelectedCatalogBoundary(ctx, readBudget));
  if (!release) return undefined;
  const ruleIdentities = await readRetiredSheetIdentities(
    ctx,
    release._id,
    definitions,
    readBudget,
  );
  if (!ruleIdentities.length) return undefined;
  const runId = control?.impactRunId;
  const work = runId
    ? await ctx.db
        .query('catalogImpactWork')
        .withIndex('by_runId_and_characterId', (q) =>
          q.eq('runId', runId).eq('characterId', characterId),
        )
        .unique()
    : null;
  readBudget?.accountRead(work);
  return { ruleIdentities, retainedGrantIds: work?.retainedGrantIds ?? [] };
}

/** #411: the Catalog Copies among these definitions whose content is retired. */
export async function readSelectedHeldCopyIds(
  ctx: ReadCtx,
  definitions: readonly Doc<'catalogEntry'>[],
  readBudget?: ReadBudget,
  boundary?: SelectedBoundary,
) {
  const { release } =
    boundary ?? (await readSelectedCatalogBoundary(ctx, readBudget));
  if (!release) return new Set<Id<'catalogEntry'>>();
  const copies = definitions.filter(
    (row) => row.scope !== 'global' && row.copiedFrom,
  );
  const retired = await readRetiredIdentities(
    ctx,
    release._id,
    copies,
    readBudget,
  );
  return new Set(
    copies.flatMap((row) => (retired.has(row.ruleIdentity) ? [row._id] : [])),
  );
}

/** Retired bodies resolve existing uses but cannot become new choices. */
export async function isSelectedCatalogDefinitionSelectable(
  ctx: ReadCtx,
  definition: Doc<'catalogEntry'>,
  boundary?: Awaited<ReturnType<typeof readSelectedCatalogBoundary>>,
) {
  if (
    definition.scope !== 'global' &&
    !definition.importedSpell &&
    !definition.copiedFrom
  )
    return true;
  const { release } = boundary ?? (await readSelectedCatalogBoundary(ctx));
  if (!release) return true;
  const retained = await readRetiredDefinition(
    ctx,
    release._id,
    definition.ruleIdentity,
  );
  return !retained;
}

export async function readSelectedCampaignFactsGeneration(
  ctx: ReadCtx,
  campaignId: Id<'campaign'>,
  boundary?: Awaited<ReturnType<typeof readSelectedCatalogBoundary>>,
) {
  const { control } = boundary ?? (await readSelectedCatalogBoundary(ctx));
  const runId = control?.impactRunId;
  if (!runId) return 0;
  const facts = await ctx.db
    .query('catalogCampaignFacts')
    .withIndex('by_runId_and_campaignId', (q) =>
      q.eq('runId', runId).eq('campaignId', campaignId),
    )
    .unique();
  return facts?.generation ?? 0;
}
