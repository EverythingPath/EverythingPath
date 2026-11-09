import { requireCatalogCharacterAdmission } from './lib/catalogFixturePolicy';
import { compareValues, ConvexError, v, type Infer } from 'convex/values';
import { zid, zodOutputToConvex } from 'convex-helpers/server/zod4';
import { z } from 'zod';
import { query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { legacyCharacterMutation } from './lib/campaignRuntime';
import {
  characterKindValidator,
  companionAllocatedComponentsValidator,
  companionComponentRuleKindValidator,
  companionGroupPurchasesValidator,
  companionKindValidator,
  companionSourceValidator,
  companionSourceWriteValidator,
  companionLinkedInputValidator,
  companionStatusValidator,
  familiarBaseCreatureKeyValidator,
  leadershipModifiersValidator,
} from './schema';
import {
  leadershipModifiersSchema,
  maxCohortDeaths,
  maxOtherLeadershipModifier,
} from '../src/lib/character-sheet-cohort';
import { requireCharacterAccess } from './lib/characterAccess';
import {
  initializeCharacterSheet,
  loadCharacterSheet,
  pruneWarningAcceptancesAndRecordChange,
  type LoadedCharacterSheet,
} from './lib/characterSheet';
import { defaultAbilityScores } from '../src/lib/character-sheet';
import { formatGrantKeyId } from '../src/lib/character-sheet-grants';

import {
  deriveCompanionSourceRules,
  listRelationshipLinkedInputs,
  resolveCuratedCompanionSources,
  isCompatibleCompanionEndpoint,
  hasAvailableSupportingSource,
  isSupportingSourceAvailable,
  doesCreateCompanionCycle,
  readCompanionGraph,
  summarizeAssociatedAllocationShares,
  type CompanionSheet,
} from './lib/companionRelationshipGraph';
import { reconcileCompanionRelationships } from './lib/companionRelationships';
import {
  companionAllocatedLevelsSchema,
  companionAllocationPoolSchema,
  companionAllocationRuleKinds,
  getCompanionAllocationRule,
  isCompanionAllocationRuleKind,
  maxCompanionAllocatedLevels,
  resolveCompanionAllocationPools,
} from '../src/lib/character-sheet-companion-sources';
import { readCompanionLinkedInput } from '../src/lib/character-sheet-linked-inputs';
import {
  companionAllocatedComponentsSchema,
  companionComponentRuleKinds,
  companionGroupPurchaseKeys,
  companionGroupPurchasesSchema,
  getCompanionComponentRule,
  isCompanionComponentRuleKind,
  maxCompanionComponentValue,
  readGroupPurchases,
} from '../src/lib/character-sheet-companion-components';
import {
  eidolonSize,
  isEidolonState,
} from '../src/lib/character-sheet-eidolon-progression';
import type { CreatureSize } from '../src/lib/character-sheet-creature-sizes';

const relationshipArgs = {
  relationshipId: v.id('companionRelationship'),
  operationId: v.string(),
};
const linkArgs = {
  associatedCharacterId: v.id('character'),
  kind: companionKindValidator,
  sources: v.array(companionSourceWriteValidator),
  operationId: v.string(),
};

const linkValidator = v.object({
  ...linkArgs,
  companionCharacterId: v.id('character'),
});

export const list = query({
  args: { characterId: v.id('character') },
  returns: v.array(
    v.object({
      relationshipId: v.id('companionRelationship'),
      role: v.union(v.literal('companion'), v.literal('associated')),
      kind: companionKindValidator,
      familiarBaseCreatureKey: v.optional(familiarBaseCreatureKeyValidator),
      status: v.optional(companionStatusValidator),
      interruption: v.union(
        v.null(),
        v.literal('manual'),
        v.literal('support'),
        v.literal('access'),
        v.literal('conflict'),
        v.literal('cycle'),
      ),
      endpoint: v.union(
        v.null(),
        v.object({ characterId: v.id('character'), name: v.string() }),
      ),
      sources: v.array(
        companionSourceValidator.extend({ available: v.boolean() }),
      ),
      linkedInputs: v.array(
        v.object({
          input: companionLinkedInputValidator,
          classLabel: v.optional(v.string()),
        }),
      ),
      lastOperationId: v.optional(v.string()),
    }),
  ),
  async handler(ctx, args) {
    await requireCharacterAccess(ctx, args);
    const graph = await readCompanionGraph(ctx, args.characterId);
    const result = [];
    for (const row of graph.relationships.values()) {
      if (
        row.associatedCharacterId !== args.characterId &&
        row.companionCharacterId !== args.characterId
      )
        continue;
      const role: 'companion' | 'associated' =
        row.associatedCharacterId === args.characterId
          ? 'companion'
          : 'associated';
      const endpointId =
        role === 'companion'
          ? row.companionCharacterId
          : row.associatedCharacterId;
      const endpoint = await findAccessibleEndpoint(ctx, endpointId);
      const state = graph.states.get(row._id);
      if (!state) continue;
      const sources =
        endpoint || role === 'companion'
          ? resolveCuratedCompanionSources({
              relationship: row,
              sheet: graph.sheets.get(row.associatedCharacterId) ?? null,
            })
          : row.sources;
      result.push({
        relationshipId: row._id,
        role,
        kind: row.kind,
        ...(row.kind === 'familiar' && (role === 'associated' || endpoint)
          ? {
              familiarBaseCreatureKey: graph.characters.get(
                row.companionCharacterId,
              )?.familiarBaseCreatureKey,
            }
          : {}),
        ...(endpoint
          ? { status: state.status, lastOperationId: row.lastOperationId }
          : {}),
        interruption:
          role === 'associated' && !endpoint ? null : state.interruption,
        endpoint,
        linkedInputs: listRelationshipLinkedInputs({ ...row, sources }),
        sources:
          role === 'associated' && !endpoint
            ? []
            : sources.map((source) => ({
                ...source,
                available: isSupportingSourceAvailable(
                  source,
                  graph.countingEntries.get(row.associatedCharacterId),
                ),
              })),
      });
    }
    return result;
  },
});

/** The other Character of a relationship, or null without access to it. */
async function findAccessibleEndpoint(
  ctx: QueryCtx,
  characterId: Id<'character'>,
) {
  try {
    const { character } = await requireCharacterAccess(ctx, { characterId });
    return { characterId: character._id, name: character.name };
  } catch (error) {
    if (!(error instanceof ConvexError)) throw error;
    return null;
  }
}

// Each share names its companion only while the viewer can open it.
const poolMemberEndpointShape = {
  relationshipId: zid('companionRelationship'),
  companion: z
    .object({ characterId: zid('character'), name: z.string() })
    .nullable(),
  lastOperationId: z.string().optional(),
};
const [allocationPoolSchema, increasePoolSchema, componentPoolSchema] =
  companionAllocationPoolSchema.options;
const allocationPoolRowSchema = z.discriminatedUnion('kind', [
  allocationPoolSchema.extend({
    members: z.array(
      allocationPoolSchema.shape.members.element.extend(
        poolMemberEndpointShape,
      ),
    ),
  }),
  increasePoolSchema.extend({
    members: z.array(
      increasePoolSchema.shape.members.element.extend(poolMemberEndpointShape),
    ),
  }),
  componentPoolSchema.extend({
    members: z.array(
      componentPoolSchema.shape.members.element.extend(poolMemberEndpointShape),
    ),
  }),
]);

/**
 * The divided budgets this Character owns as an associated Character, with
 * each companion's recorded share: effective levels (#410) or components
 * (#419). Inaccessible companions keep their share but not their name or
 * link.
 */
export const listAllocationPools = query({
  args: { characterId: v.id('character') },
  returns: v.array(zodOutputToConvex(allocationPoolRowSchema)),
  async handler(ctx, args) {
    await requireCharacterAccess(ctx, args);
    const graph = await readCompanionGraph(ctx, args.characterId);
    const sheet = graph.sheets.get(args.characterId) ?? null;
    const rows = [...graph.relationships.values()].filter(
      (row) => row.associatedCharacterId === args.characterId,
    );
    if (!sheet || !rows.length) return [];
    const records = sheet.entries.find((entry) => entry.kind === 'base')?.state
      .companionGroupPurchases;
    const pools = resolveCompanionAllocationPools({
      shares: summarizeAssociatedAllocationShares({
        graph,
        associatedCharacterId: args.characterId,
        sheet,
        countingEntries: graph.countingEntries.get(args.characterId),
      }),
      classLevels: readAllocationClassLevels(sheet),
      groupPurchases: Object.fromEntries(
        companionComponentRuleKinds.map((ruleKind) => [
          ruleKind,
          readGroupPurchases(records, ruleKind) ?? [],
        ]),
      ),
      sizes: await readComponentMemberSizes(ctx, rows),
    });
    const attach = await createEndpointAttacher(ctx, rows);
    // One arm per kind, so each return keeps its own member type.
    return pools.map((pool) => {
      switch (pool.kind) {
        case 'allocation':
          return { ...pool, members: attach(pool.members) };
        case 'increase':
          return { ...pool, members: attach(pool.members) };
        case 'component':
          return { ...pool, members: attach(pool.members) };
      }
    });
  },
});

/**
 * Each component-budget member's recorded eidolon size, for the brood's
 * places (UM p. 78). Only the size leaves the companion's sheet; an
 * inaccessible companion still occupies its place, as its share counts.
 */
async function readComponentMemberSizes(
  ctx: QueryCtx,
  rows: readonly Doc<'companionRelationship'>[],
) {
  const sizes: Record<string, CreatureSize> = {};
  for (const row of rows) {
    if (
      !row.sources.some((source) =>
        isCompanionComponentRuleKind(source.ruleKind),
      )
    )
      continue;
    const base = await ctx.db
      .query('characterSheetEntry')
      .withIndex('by_characterId_and_kind_and_active', (q) =>
        q
          .eq('characterId', row.companionCharacterId)
          .eq('kind', 'base')
          .eq('active', true),
      )
      .first();
    const progression =
      base?.kind === 'base' ? base.state.companionProgression : undefined;
    if (progression && isEidolonState(progression))
      sizes[row._id] = eidolonSize(progression);
  }
  return sizes;
}

/** The class levels each divided budget is calculated from. */
function readAllocationClassLevels(sheet: CompanionSheet) {
  return Object.fromEntries(
    [
      ...companionAllocationRuleKinds.map(
        (ruleKind) => getCompanionAllocationRule(ruleKind).classRuleIdentity,
      ),
      ...companionComponentRuleKinds.map(
        (ruleKind) => getCompanionComponentRule(ruleKind).classRuleIdentity,
      ),
    ].map((classRuleIdentity) => {
      const value = readCompanionLinkedInput({
        input: { kind: 'classLevels', classRuleIdentity },
        sheet: {
          entries: sheet.entries,
          catalogEntries: sheet.catalogEntries,
          characterKind: sheet.character.kind,
          sheetMode: sheet.character.sheetMode,
          resources: sheet.resources,
          familiarBaseCreatureKey: sheet.character.familiarBaseCreatureKey,
        },
        calculated: sheet.calculated,
        companionKind: 'animalCompanion',
      });
      return [
        classRuleIdentity,
        value.kind === 'available' ? value.value : null,
      ];
    }),
  );
}

/** Adds each share's relationship, companion endpoint and latest operation. */
async function createEndpointAttacher(
  ctx: QueryCtx,
  rows: readonly Doc<'companionRelationship'>[],
) {
  const endpoints = new Map<
    Id<'character'>,
    Awaited<ReturnType<typeof findAccessibleEndpoint>>
  >();
  for (const row of rows)
    if (!endpoints.has(row.companionCharacterId))
      endpoints.set(
        row.companionCharacterId,
        await findAccessibleEndpoint(ctx, row.companionCharacterId),
      );
  return <Member extends { relationshipId: string }>(
    members: readonly Member[],
  ) =>
    members.flatMap((member) => {
      const row = rows.find((item) => item._id === member.relationshipId);
      if (!row) return [];
      const companion = endpoints.get(row.companionCharacterId) ?? null;
      return [
        {
          ...member,
          relationshipId: row._id,
          companion,
          ...(companion ? { lastOperationId: row.lastOperationId } : {}),
        },
      ];
    });
}

async function getWritableSheet(
  ctx: MutationCtx,
  characterId: Id<'character'>,
) {
  const sheet = await loadCharacterSheet(
    ctx,
    { characterId },
    { isWritable: true },
  );
  if (!sheet) throw new ConvexError('Character Sheet not found');
  return sheet;
}

function validateSources(
  sheet: LoadedCharacterSheet,
  sources: Infer<typeof companionSourceValidator>[],
) {
  if (!sources.length || sources.length > 128)
    throw new ConvexError('Choose between 1 and 128 supporting sources');
  const keys = new Set<string>();
  for (const source of sources) {
    if (!source.key.trim() || !source.label.trim() || keys.has(source.key))
      throw new ConvexError('Supporting sources need unique keys and names');
    keys.add(source.key);
    if (source.sheetEntryId && source.grantKey)
      throw new ConvexError('Choose one reference for each supporting source');
    if (source.sheetEntryId) {
      const entry = sheet.entries.find(
        (entry) => entry._id === source.sheetEntryId,
      );
      if (entry?.characterId !== sheet.character._id)
        throw new ConvexError(
          'Supporting source does not belong to this Character',
        );
      if (
        entry.kind === 'base' ||
        entry.kind === 'abilityDamage' ||
        entry.kind === 'abilityDrain'
      )
        throw new ConvexError(
          'Choose a Class Level, Grant or Selection as the supporting source',
        );
    }
    const grantKey = source.grantKey;
    if (
      grantKey &&
      !sheet.calculated.resolvedEntries.some(
        (row) => row.entry._id === formatGrantKeyId(grantKey),
      )
    )
      throw new ConvexError(
        'Supporting Grant does not belong to this Character',
      );
  }
}

async function validateLink(
  ctx: MutationCtx,
  {
    associated,
    companion,
    ignoredRelationshipId,
    supportingSources,
  }: {
    associated: LoadedCharacterSheet;
    companion: LoadedCharacterSheet;
    ignoredRelationshipId?: Id<'companionRelationship'>;
    supportingSources?: Infer<typeof companionSourceValidator>[];
  },
) {
  const associatedCharacterId = associated.character._id;
  const companionCharacterId = companion.character._id;
  if (associatedCharacterId === companionCharacterId)
    throw new ConvexError('A Character cannot be its own Companion');
  if (!isCompatibleCompanionEndpoint(associated.character, companion.character))
    throw new ConvexError(
      'Companions must share a campaign or be private Characters with the same owner',
    );
  const loadedSheets = [associated, companion];
  const associatedGraph = await readCompanionGraph(
    ctx,
    associatedCharacterId,
    loadedSheets,
  );
  const companionGraph = associatedGraph.characters.has(companionCharacterId)
    ? associatedGraph
    : await readCompanionGraph(ctx, companionCharacterId, loadedSheets);
  if (
    supportingSources &&
    !hasAvailableSupportingSource(
      supportingSources,
      associatedGraph.countingEntries.get(associatedCharacterId),
    )
  )
    throw new ConvexError(
      'This relationship has no available supporting source',
    );
  const active = new Map([...associatedGraph.active, ...companionGraph.active]);
  for (const [id, row] of active)
    if (row._id === ignoredRelationshipId) active.delete(id);
  if (active.has(companionCharacterId))
    throw new ConvexError(
      'This Companion already has an active associated Character',
    );
  if (
    doesCreateCompanionCycle(
      active,
      associatedCharacterId,
      companionCharacterId,
    )
  )
    throw new ConvexError(
      'Companion Relationships cannot form an active cycle',
    );
}

/**
 * A stored source with its freshly derived rule kind and competing rules;
 * a resolved conflict leaves no stale competing rules behind.
 */
function withDerivedRules<Source extends Partial<StoredSource>>(
  source: Source,
  { ruleKind, ruleConflicts }: ReturnType<typeof deriveCompanionSourceRules>,
) {
  const { ruleConflicts: _previous, ...rest } = source;
  return {
    ...rest,
    ruleKind,
    ...(ruleConflicts?.length ? { ruleConflicts } : {}),
  };
}
type StoredSource = Doc<'companionRelationship'>['sources'][number];

async function getRelationship(
  ctx: MutationCtx,
  relationshipId: Id<'companionRelationship'>,
) {
  const row = await ctx.db.get('companionRelationship', relationshipId);
  if (!row) throw new ConvexError('Companion Relationship not found');
  const associated = await getWritableSheet(ctx, row.associatedCharacterId);
  return { row, associated };
}

async function insertRelationship(
  ctx: MutationCtx,
  args: Infer<typeof linkValidator>,
  loadedSheets: LoadedCharacterSheet[],
) {
  const id = await ctx.db.insert('companionRelationship', {
    associatedCharacterId: args.associatedCharacterId,
    companionCharacterId: args.companionCharacterId,
    kind: args.kind,
    sources: args.sources.map((source) =>
      withDerivedRules(
        source,
        deriveCompanionSourceRules({
          kind: args.kind,
          source,
          sheet:
            loadedSheets.find(
              (sheet) => sheet.character._id === args.associatedCharacterId,
            ) ?? null,
        }),
      ),
    ),
    status: 'active',
    manuallyInterrupted: false,
    activatedAt: Date.now(),
    lastOperationId: args.operationId,
  });
  await reconcileCompanionRelationships(ctx, {
    characterId: args.associatedCharacterId,
    operationId: args.operationId,
    loadedSheets: loadedSheets,
  });
  return id;
}

export const link = legacyCharacterMutation({
  args: linkValidator.fields,
  returns: v.id('companionRelationship'),
  async handler(ctx, args) {
    const [associated, companion] = await Promise.all([
      getWritableSheet(ctx, args.associatedCharacterId),
      getWritableSheet(ctx, args.companionCharacterId),
    ]);
    await validateLink(ctx, { associated, companion });
    validateSources(associated, args.sources);
    return await insertRelationship(ctx, args, [associated, companion]);
  },
});

export const create = legacyCharacterMutation({
  args: {
    ...linkArgs,
    name: v.string(),
    characterKind: v.optional(characterKindValidator),
  },
  returns: v.object({
    relationshipId: v.id('companionRelationship'),
    companionCharacterId: v.id('character'),
  }),
  async handler(ctx, args) {
    const sheet = await getWritableSheet(ctx, args.associatedCharacterId);
    validateSources(sheet, args.sources);
    if (!args.name.trim())
      throw new ConvexError('Character name cannot be empty');
    const level = args.kind === 'cohort' ? 1 : 0;
    await requireCatalogCharacterAdmission(ctx, {
      campaignId: sheet.character.campaignId,
      catalogFixtureCampaignId: sheet.character.catalogFixtureCampaignId,
    });
    const companionCharacterId = await ctx.db.insert('character', {
      catalogFixtureCampaignId: sheet.character.catalogFixtureCampaignId,
      ...(sheet.character.campaignId
        ? { campaignId: sheet.character.campaignId }
        : { sheetDemo: sheet.character.sheetDemo }),
      ...(args.kind === 'familiar'
        ? { familiarBaseScoresPending: true as const }
        : {}),
      name: args.name.trim(),
      description: '',
      kind: args.characterKind ?? 'npc',
      ownerId: sheet.actor,
      isActive: true,
      level,
      ...defaultAbilityScores,
    });
    await initializeCharacterSheet(ctx, {
      characterId: companionCharacterId,
      operationId: args.operationId,
      updatedBy: sheet.actor,
      level,
    });
    const relationshipId = await insertRelationship(
      ctx,
      {
        ...args,
        companionCharacterId,
      },
      [sheet],
    );
    return { relationshipId, companionCharacterId };
  },
});

export const replace = legacyCharacterMutation({
  args: { ...relationshipArgs, companionCharacterId: v.id('character') },
  returns: v.id('companionRelationship'),
  async handler(ctx, args) {
    const { row: previous, associated } = await getRelationship(
      ctx,
      args.relationshipId,
    );
    if (previous.status === 'replaced')
      throw new ConvexError('Reselect this Companion before replacing it');
    if (previous.companionCharacterId === args.companionCharacterId)
      throw new ConvexError('Choose a different Companion');
    const companion = await getWritableSheet(ctx, args.companionCharacterId);
    await validateLink(ctx, {
      associated,
      companion,
      ignoredRelationshipId: previous._id,
    });
    await ctx.db.patch('companionRelationship', previous._id, {
      status: 'replaced',
      lastOperationId: args.operationId,
    });
    return await insertRelationship(
      ctx,
      {
        ...previous,
        companionCharacterId: args.companionCharacterId,
        operationId: args.operationId,
      },
      [associated, companion],
    );
  },
});

export const interrupt = legacyCharacterMutation({
  args: relationshipArgs,
  returns: v.null(),
  async handler(ctx, args) {
    const { row, associated } = await getRelationship(ctx, args.relationshipId);
    if (row.status === 'replaced')
      throw new ConvexError('Reselect this Companion before interrupting it');
    await ctx.db.patch('companionRelationship', row._id, {
      status: 'interrupted',
      manuallyInterrupted: true,
      lastOperationId: args.operationId,
    });
    await reconcileCompanionRelationships(ctx, {
      characterId: row.associatedCharacterId,
      operationId: args.operationId,
      loadedSheets: [associated],
    });
    return null;
  },
});

export const restore = legacyCharacterMutation({
  args: relationshipArgs,
  returns: v.null(),
  async handler(ctx, args) {
    const { row, associated } = await getRelationship(ctx, args.relationshipId);
    const companion = await getWritableSheet(ctx, row.companionCharacterId);
    await validateLink(ctx, {
      associated,
      companion,
      ignoredRelationshipId: row._id,
      supportingSources: row.sources,
    });
    await ctx.db.patch('companionRelationship', row._id, {
      status: 'active',
      manuallyInterrupted: false,
      activatedAt: Date.now(),
      lastOperationId: args.operationId,
    });
    await reconcileCompanionRelationships(ctx, {
      characterId: row.associatedCharacterId,
      operationId: args.operationId,
      loadedSheets: [associated],
    });
    return null;
  },
});

export const setSourceEnabled = legacyCharacterMutation({
  args: { ...relationshipArgs, sourceKey: v.string(), enabled: v.boolean() },
  returns: v.null(),
  async handler(ctx, args) {
    const { row, associated } = await getRelationship(ctx, args.relationshipId);
    if (!row.sources.some((source) => source.key === args.sourceKey))
      throw new ConvexError('Supporting source not found');
    await ctx.db.patch('companionRelationship', row._id, {
      sources: row.sources.map((source) =>
        source.key === args.sourceKey
          ? withDerivedRules(
              { ...source, enabled: args.enabled },
              deriveCompanionSourceRules({
                kind: row.kind,
                source,
                sheet: associated,
              }),
            )
          : source,
      ),
      lastOperationId: args.operationId,
    });
    await reconcileCompanionRelationships(ctx, {
      characterId: row.associatedCharacterId,
      operationId: args.operationId,
      loadedSheets: [associated],
    });
    return null;
  },
});

export const addSource = legacyCharacterMutation({
  args: { ...relationshipArgs, source: companionSourceWriteValidator },
  returns: v.null(),
  async handler(ctx, args) {
    const { row, associated } = await getRelationship(ctx, args.relationshipId);
    const sources = [
      ...row.sources,
      withDerivedRules(
        args.source,
        deriveCompanionSourceRules({
          kind: row.kind,
          source: args.source,
          sheet: associated,
        }),
      ),
    ];
    if (
      sources.length > 128 ||
      row.sources.some((source) => source.key === args.source.key)
    )
      throw new ConvexError(
        'Supporting sources need unique keys and at most 128 contributions',
      );
    validateSources(associated, [args.source]);
    await ctx.db.patch('companionRelationship', row._id, {
      sources,
      lastOperationId: args.operationId,
    });
    await reconcileCompanionRelationships(ctx, {
      characterId: row.associatedCharacterId,
      operationId: args.operationId,
      loadedSheets: [associated],
    });
    return null;
  },
});

/**
 * Record or clear one companion's share of a divided budget: effective
 * levels (#410) or separately divided components (#419). Shares above the
 * budget are kept and warn; nothing is trimmed or moved. A cohort's source
 * records the Leadership modifiers (#417) that adjust the leader's score,
 * the budget limiting that cohort's level.
 */
export const setSourceAllocation = legacyCharacterMutation({
  args: {
    ...relationshipArgs,
    sourceKey: v.string(),
    levels: v.optional(v.union(v.number(), v.null())),
    components: v.optional(
      v.union(companionAllocatedComponentsValidator, v.null()),
    ),
    leadership: v.optional(v.union(leadershipModifiersValidator, v.null())),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const { levels, components, leadership } = args;
    if (
      [levels, components, leadership].filter((value) => value !== undefined)
        .length !== 1
    )
      throw new ConvexError(
        'Record either effective levels, components or Leadership modifiers for this source',
      );
    if (leadership && !leadershipModifiersSchema.safeParse(leadership).success)
      throw new ConvexError(
        `Record Leadership modifiers once each, with whole cohort deaths from 0 to ${maxCohortDeaths} and other modifiers from −${maxOtherLeadershipModifier} to ${maxOtherLeadershipModifier}`,
      );
    if (
      levels !== undefined &&
      levels !== null &&
      !companionAllocatedLevelsSchema.safeParse(levels).success
    )
      throw new ConvexError(
        `Allocate a whole number of effective levels from 0 to ${maxCompanionAllocatedLevels}`,
      );
    if (
      components &&
      !companionAllocatedComponentsSchema.safeParse(components).success
    )
      throw new ConvexError(
        `Allocate components as whole numbers from 0 to ${maxCompanionComponentValue}`,
      );
    const { row, associated } = await getRelationship(ctx, args.relationshipId);
    const source = row.sources.find((item) => item.key === args.sourceKey);
    if (!source) throw new ConvexError('Supporting source not found');
    const rules = deriveCompanionSourceRules({
      kind: row.kind,
      source,
      sheet: associated,
    });
    const { ruleKind } = rules;
    if (
      levels !== undefined &&
      levels !== null &&
      !isCompanionAllocationRuleKind(ruleKind)
    )
      throw new ConvexError(
        'Choose a supporting source that divides effective levels',
      );
    if (components && !isCompanionComponentRuleKind(ruleKind))
      throw new ConvexError(
        'Choose a supporting source that divides components',
      );
    if (leadership && ruleKind !== 'cohort')
      throw new ConvexError(
        'Choose a supporting source that supports a cohort',
      );
    await ctx.db.patch('companionRelationship', row._id, {
      sources: row.sources.map((item) => {
        if (item.key !== args.sourceKey) return item;
        if (leadership !== undefined) {
          const { leadershipModifiers: _previous, ...rest } = item;
          return withDerivedRules(
            {
              ...rest,
              ...(leadership === null
                ? {}
                : { leadershipModifiers: leadership }),
            },
            rules,
          );
        }
        if (components !== undefined) {
          const { allocatedComponents: _previous, ...rest } = item;
          return withDerivedRules(
            {
              ...rest,
              ...(components === null
                ? {}
                : { allocatedComponents: components }),
            },
            rules,
          );
        }
        const { allocatedLevels: _previous, ...rest } = item;
        return withDerivedRules(
          {
            ...rest,
            ...(levels === null || levels === undefined
              ? {}
              : { allocatedLevels: levels }),
          },
          rules,
        );
      }),
      lastOperationId: args.operationId,
    });
    // The share changes this companion's actual HD and militia facts, which
    // refresh with every other downstream Companion's.
    await reconcileCompanionRelationships(ctx, {
      characterId: row.associatedCharacterId,
      operationId: args.operationId,
      loadedSheets: [associated],
    });
    return null;
  },
});

/**
 * Record the purchases made once for a whole divided component budget, such
 * as a Broodmaster's Larger Brood (UM p. 78), on the budget owner's sheet.
 * They are paid from the brood's pool before it is divided; purchases out of
 * level order are kept and warn.
 */
export const setGroupPurchases = legacyCharacterMutation({
  args: {
    characterId: v.id('character'),
    ruleKind: companionComponentRuleKindValidator,
    purchases: companionGroupPurchasesValidator,
    operationId: v.string(),
  },
  returns: v.null(),
  async handler(ctx, args) {
    if (!args.operationId.trim())
      throw new ConvexError('Provide an operation identifier');
    const parsed = companionGroupPurchasesSchema.safeParse(args.purchases);
    if (!parsed.success)
      throw new ConvexError('Record each group purchase once');
    const sheet = await getWritableSheet(ctx, args.characterId);
    const base = sheet.entries.find((entry) => entry.kind === 'base');
    if (base?.kind !== 'base')
      throw new ConvexError('Base scores are unavailable');
    const { companionGroupPurchases: recorded = [], ...rest } = base.state;
    const purchases = companionGroupPurchaseKeys.filter((key) =>
      parsed.data.includes(key),
    );
    const records = [
      ...recorded.filter((record) => record.ruleKind !== args.ruleKind),
      ...(purchases.length ? [{ ruleKind: args.ruleKind, purchases }] : []),
    ];
    const state = {
      ...rest,
      ...(records.length ? { companionGroupPurchases: records } : {}),
    };
    if (compareValues(state, base.state) === 0) return null;
    await ctx.db.patch('characterSheetEntry', base._id, { state });
    sheet.entries = sheet.entries.map((entry) =>
      entry._id === base._id ? { ...base, state } : entry,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});
