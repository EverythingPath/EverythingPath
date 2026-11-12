import {
  representativeCompanionRules,
  listCuratedCompanionInputs,
  type CompanionSourceRuleKind,
} from '../../src/lib/catalog/representative-companion-rules';
import {
  linkedInputKey,
  type CompanionLinkedInput,
} from '../../src/lib/character-sheet-linked-inputs';
import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { ReadCtx } from '../types';
import { readCharacterSheetData } from './characterSheetData';
import {
  characterSheetClassFamily,
  formatGrantKeyId,
  isUnchainedClass,
} from '../../src/lib/character-sheet-grants';
import {
  companionAllocationRuleKinds,
  companionIncreaseRuleKinds,
  companionFusedRuleKinds,
  companionReducedRuleKinds,
  getCompanionFusionRule,
  getCompanionReductionRule,
  isCompanionFusedRuleKind,
  summarizeCompanionAllocationShares,
  type CompanionPooledRuleKind,
} from '../../src/lib/character-sheet-companion-sources';
import {
  companionComponentRuleKinds,
  getCompanionComponentRule,
  isCompanionComponentRuleKind,
} from '../../src/lib/character-sheet-companion-components';
import { ruleKeyMatches } from '../../src/lib/character-sheet-rule-keys';

type GraphReadOptions = {
  readSheet?: (character: Doc<'character'>) => Promise<CompanionSheet>;
  readBudget?: {
    accountRead(value: unknown): void;
    accountReference(id: string): void;
  };
};
const maxRelationships = 1024;
type Relationship = Doc<'companionRelationship'>;
export type CompanionSheet = Awaited<ReturnType<typeof readCharacterSheetData>>;
export type CompanionInterruption =
  | 'manual'
  | 'support'
  | 'access'
  | 'conflict'
  | 'cycle'
  | null;

export function isCompatibleCompanionEndpoint(
  associated: Doc<'character'> | null,
  companion: Doc<'character'> | null,
) {
  return Boolean(
    associated &&
    companion &&
    (associated.campaignId
      ? associated.campaignId === companion.campaignId
      : !companion.campaignId &&
        associated.ownerId &&
        associated.ownerId === companion.ownerId),
  );
}

export function isSupportingSourceAvailable(
  source: Relationship['sources'][number],
  countingEntries?: Set<string>,
) {
  return source.sheetEntryId
    ? Boolean(countingEntries?.has(source.sheetEntryId))
    : source.grantKey
      ? Boolean(countingEntries?.has(formatGrantKeyId(source.grantKey)))
      : true;
}

export function hasAvailableSupportingSource(
  sources: Relationship['sources'],
  countingEntries?: Set<string>,
) {
  return sources.some(
    (source) =>
      source.enabled && isSupportingSourceAvailable(source, countingEntries),
  );
}

async function readConnectedRelationships(
  ctx: ReadCtx,
  characterId: Id<'character'>,
  sheets: Map<Id<'character'>, CompanionSheet>,
  { readBudget }: GraphReadOptions,
) {
  const pending = [characterId];
  const visited = new Set<Id<'character'>>();
  const relationships = new Map<Id<'companionRelationship'>, Relationship>();
  const characters = new Map<Id<'character'>, Doc<'character'> | null>();
  for (const id of pending) {
    if (visited.has(id)) continue;
    visited.add(id);
    if (visited.size > maxRelationships)
      throw new ConvexError('Too many connected Companions');
    characters.set(
      id,
      sheets.get(id)?.character ?? (await ctx.db.get('character', id)),
    );
    readBudget?.accountRead(characters.get(id));
    readBudget?.accountReference(id);
    const queries = [
      ctx.db
        .query('companionRelationship')
        .withIndex('by_associatedCharacterId', (q) =>
          q.eq('associatedCharacterId', id),
        ),
      ctx.db
        .query('companionRelationship')
        .withIndex('by_companionCharacterId', (q) =>
          q.eq('companionCharacterId', id),
        ),
    ];
    for (const query of queries) {
      // Account while reading, before a large endpoint's entire adjacency
      // list can consume the transaction reserved for lifecycle retries.
      for await (const row of query) {
        readBudget?.accountRead(row);
        readBudget?.accountReference(row._id);
        relationships.set(row._id, row);
        if (relationships.size > maxRelationships)
          throw new ConvexError('Too many connected Companion Relationships');
        pending.push(row.associatedCharacterId, row.companionCharacterId);
      }
    }
  }
  return { relationships, characters };
}

export function getCompanionSupportingEntryKeys(sheet: CompanionSheet | null) {
  return new Set([
    ...(sheet?.calculated.resolvedEntries
      .filter((entry) => entry.counting)
      .flatMap((entry) => [
        entry.entry._id,
        ...(entry.storedEntryId ? [entry.storedEntryId] : []),
      ]) ?? []),
    ...(sheet?.entries
      .filter((entry) => entry.kind === 'classLevel' && entry.active)
      .map((entry) => entry._id) ?? []),
  ]);
}

function determineInterruption({
  row,
  characters,
  countingEntries,
  active,
}: {
  row: Relationship;
  characters: Map<Id<'character'>, Doc<'character'> | null>;
  countingEntries: Map<Id<'character'>, Set<string>>;
  active: Map<Id<'character'>, Relationship>;
}): CompanionInterruption {
  if (row.manuallyInterrupted) return 'manual';
  if (
    !isCompatibleCompanionEndpoint(
      characters.get(row.associatedCharacterId) ?? null,
      characters.get(row.companionCharacterId) ?? null,
    )
  )
    return 'access';
  if (
    !hasAvailableSupportingSource(
      row.sources,
      countingEntries.get(row.associatedCharacterId),
    )
  )
    return 'support';
  if (active.has(row.companionCharacterId)) return 'conflict';
  if (
    doesCreateCompanionCycle(
      active,
      row.associatedCharacterId,
      row.companionCharacterId,
    )
  )
    return 'cycle';
  return null;
}

export async function readCompanionGraph(
  ctx: ReadCtx,
  characterId: Id<'character'>,
  loadedSheets: CompanionSheet[] = [],
  options: GraphReadOptions = {},
) {
  const sheets = new Map(
    loadedSheets.map((sheet) => [sheet.character._id, sheet]),
  );
  const { relationships, characters } = await readConnectedRelationships(
    ctx,
    characterId,
    sheets,
    options,
  );
  const countingEntries = new Map<Id<'character'>, Set<string>>();
  for (const row of relationships.values()) {
    if (
      countingEntries.has(row.associatedCharacterId) ||
      !row.sources.some(
        (source) =>
          source.sheetEntryId !== undefined || source.grantKey !== undefined,
      )
    )
      continue;
    const character = characters.get(row.associatedCharacterId);
    const sheet =
      sheets.get(row.associatedCharacterId) ??
      (character?.sheetMode
        ? await (
            options.readSheet ?? ((row) => readCharacterSheetData(ctx, row))
          )(character)
        : null);
    if (sheet) sheets.set(row.associatedCharacterId, sheet);
    countingEntries.set(
      row.associatedCharacterId,
      getCompanionSupportingEntryKeys(sheet),
    );
  }
  const active = new Map<Id<'character'>, Relationship>();
  const states = new Map<
    Id<'companionRelationship'>,
    { status: Relationship['status']; interruption: CompanionInterruption }
  >();
  const ordered = [...relationships.values()].sort(
    (a, b) =>
      Number(b.status === 'active') - Number(a.status === 'active') ||
      b.activatedAt - a.activatedAt ||
      b._creationTime - a._creationTime ||
      b._id.localeCompare(a._id),
  );
  for (const row of ordered) {
    if (row.status === 'replaced') {
      states.set(row._id, { status: 'replaced', interruption: null });
      continue;
    }
    const interruption = determineInterruption({
      row,
      characters,
      countingEntries,
      active,
    });
    states.set(row._id, {
      status: interruption ? 'interrupted' : 'active',
      interruption,
    });
    if (!interruption) active.set(row.companionCharacterId, row);
  }
  return { relationships, characters, states, active, countingEntries, sheets };
}

export function doesCreateCompanionCycle(
  active: Map<Id<'character'>, Relationship>,
  associatedCharacterId: Id<'character'>,
  companionCharacterId: Id<'character'>,
) {
  let current: Id<'character'> | undefined = associatedCharacterId;
  const visited = new Set<Id<'character'>>();
  while (current && !visited.has(current)) {
    if (current === companionCharacterId) return true;
    visited.add(current);
    current = active.get(current)?.associatedCharacterId;
  }
  return false;
}

/**
 * A source's rule kind, derived from the associated sheet, and the rules
 * that compete for it with no published precedence (#420). A conflicting
 * source keeps the ordinary kind of its relationship and lists the rules.
 */
export function deriveCompanionSourceRules({
  kind,
  source,
  sheet,
}: {
  kind: Relationship['kind'];
  source: Relationship['sources'][number];
  sheet: CompanionSheet | null;
}): {
  ruleKind: CompanionSourceRuleKind;
  ruleConflicts?: CompanionSourceRuleKind[];
} {
  if (!sheet)
    return {
      ruleKind: source.ruleKind ?? kind,
      ...(source.ruleConflicts?.length
        ? { ruleConflicts: source.ruleConflicts }
        : {}),
    };
  const grantId = source.grantKey ? formatGrantKeyId(source.grantKey) : null;
  const sourceEntry = source.sheetEntryId
    ? sheet.entries.find((entry) => entry._id === source.sheetEntryId)
    : source.grantKey
      ? sheet.calculated.resolvedEntries.find(
          ({ entry }) => entry._id === grantId,
        )?.entry
      : null;
  const classDefinition =
    sourceEntry?.kind === 'classLevel'
      ? sheet.catalogEntries.find(
          (entry) => entry._id === sourceEntry.state.classEntryId,
        )
      : null;
  const identity = classDefinition
    ? characterSheetClassFamily(classDefinition, sheet.catalogEntries)
    : (source.grantKey?.source ??
      (sourceEntry && 'catalogEntryId' in sourceEntry
        ? sheet.catalogEntries.find(
            (entry) => entry._id === sourceEntry.catalogEntryId,
          )?.ruleIdentity
        : null));
  if (kind === 'familiar') {
    if (identity === 'wizard') return { ruleKind: 'wizardFamiliar' };
    if (identity === 'sorcerer') return { ruleKind: 'sorcererFamiliar' };
    if (identity === 'witch') return { ruleKind: 'witchFamiliar' };
  }
  if (kind === 'eidolon' || kind === 'unchainedEidolon') {
    const version = findSummonerSourceVersion({
      source,
      classDefinition,
      sheet,
    });
    if (version === 'unchained') return { ruleKind: 'unchainedEidolon' };
    if (version === 'original')
      return findOriginalEidolonRules({
        identity,
        classFamily: classDefinition ? identity : null,
        sheet,
      });
  }
  if (kind === 'animalCompanion') {
    const pooled = findPooledRuleKind({
      identity,
      classFamily: classDefinition ? identity : null,
      sheet,
    });
    if (pooled) return { ruleKind: pooled };
    if (ruleKeyMatches(identity, 'druid'))
      return { ruleKind: 'druidCompanion' };
    if (ruleKeyMatches(identity, 'ranger'))
      return { ruleKind: 'rangerCompanion' };
    if (identity === 'cavalier') return { ruleKind: 'cavalierMount' };
  }
  return { ruleKind: sourceEntry ? kind : (source.ruleKind ?? kind) };
}
type ClassDefinition = CompanionSheet['catalogEntries'][number];
type ClassVersion = 'original' | 'unchained';
const summonerFamily = 'summoner';
function classVersion(definition: ClassDefinition): ClassVersion {
  return isUnchainedClass(definition) ? 'unchained' : 'original';
}
/** The sheet's summoner-family Class Levels in order, with their versions. */
function listSummonerLevels(sheet: CompanionSheet) {
  return sheet.entries
    .flatMap((entry) => {
      if (entry.kind !== 'classLevel') return [];
      const definition = sheet.catalogEntries.find(
        (item) => item._id === entry.state.classEntryId,
      );
      return definition &&
        ruleKeyMatches(
          characterSheetClassFamily(definition, sheet.catalogEntries),
          summonerFamily,
        )
        ? [{ position: entry.state.position, definition }]
        : [];
    })
    .sort((left, right) => left.position - right.position);
}
/**
 * The summoner version an eidolon source reads (#418): a Class Level's own
 * version, a Grant's granting Class Level, or otherwise the version of every
 * summoner Class Level on the sheet. Mixed or absent versions decide nothing.
 */
function findSummonerSourceVersion({
  source,
  classDefinition,
  sheet,
}: {
  source: Relationship['sources'][number];
  classDefinition: ClassDefinition | null | undefined;
  sheet: CompanionSheet;
}): ClassVersion | null {
  if (classDefinition)
    return ruleKeyMatches(
      characterSheetClassFamily(classDefinition, sheet.catalogEntries),
      summonerFamily,
    )
      ? classVersion(classDefinition)
      : null;
  const levels = listSummonerLevels(sheet);
  if (
    ruleKeyMatches(source.grantKey?.source, summonerFamily) &&
    source.grantKey?.classLevel
  ) {
    const granting = levels[source.grantKey.classLevel - 1];
    if (granting) return classVersion(granting.definition);
  }
  const versions = new Set(
    levels.map(({ definition }) => classVersion(definition)),
  );
  const [only] = versions;
  return versions.size === 1 && only ? only : null;
}

/**
 * Archetypes written only for the original summoner and active on an
 * Unchained summoner. Pathfinder Unchained lets original archetypes replace
 * matching features, but nothing makes their eidolon changes fit an
 * Unchained eidolon, so the eidolon reports them instead of applying them.
 */
export function listUnsupportedUnchainedEidolonArchetypes(
  sheet: Pick<CompanionSheet, 'catalogEntries'> & {
    calculated: Pick<CompanionSheet['calculated'], 'archetypes'>;
  },
) {
  const byId = (id: string) =>
    sheet.catalogEntries.find((entry) => entry._id === id);
  return [
    ...new Set(
      sheet.calculated.archetypes.classes.flatMap((applied) => {
        const baseClass = byId(applied.classEntryId);
        if (
          !ruleKeyMatches(applied.classIdentity, summonerFamily) ||
          !baseClass ||
          classVersion(baseClass) !== 'unchained'
        )
          return [];
        return applied.archetypes.flatMap((archetype) => {
          const detail = byId(archetype.catalogEntryId)?.detail;
          const written =
            detail?.kind === 'archetype' ? detail.classEntryIds : [];
          return archetype.active &&
            archetype.applicable &&
            !written.some(
              (id) =>
                id === baseClass._id ||
                byId(id)?.ruleIdentity === baseClass.ruleIdentity,
            )
            ? [archetype.name]
            : [];
        });
      }),
    ),
  ];
}

/** Whether an active, applicable Archetype of this identity changes the class. */
function hasActiveArchetype(
  sheet: CompanionSheet,
  classFamily: string,
  archetypeIdentity: string,
) {
  return sheet.calculated.archetypes.classes.some(
    (effects) =>
      ruleKeyMatches(effects.classIdentity, classFamily) &&
      effects.archetypes.some(
        (archetype) =>
          ruleKeyMatches(archetype.ruleIdentity, archetypeIdentity) &&
          archetype.active &&
          archetype.applicable,
      ),
  );
}

// The original-summoner rules replacing the ordinary eidolon: dividing its
// components (#419), reducing its level (#420) or fusing it with the
// summoner (#421).
const originalEidolonRuleKinds = [
  ...companionComponentRuleKinds,
  ...companionReducedRuleKinds,
  ...companionFusedRuleKinds,
] as const;
function originalEidolonRule(
  ruleKind: (typeof originalEidolonRuleKinds)[number],
) {
  if (isCompanionComponentRuleKind(ruleKind))
    return getCompanionComponentRule(ruleKind);
  if (isCompanionFusedRuleKind(ruleKind))
    return getCompanionFusionRule(ruleKind);
  return getCompanionReductionRule(ruleKind);
}

// Each is recognised like a level-dividing Archetype: from its Selection,
// its feature Grants or an original summoner Class Level with it active.
// When more than one applies to a source, none is chosen: Archetypes that
// each replace the eidolon have no published precedence, so the source
// keeps the ordinary eidolon kind and lists the competing rules. A source
// supplied by an active Archetype's Selection or Grant also competes with
// any other such Archetype active on the summoner.
function findOriginalEidolonRules({
  identity,
  classFamily,
  sheet,
}: {
  identity: string | null | undefined;
  classFamily: string | null | undefined;
  sheet: CompanionSheet;
}): {
  ruleKind: CompanionSourceRuleKind;
  ruleConflicts?: CompanionSourceRuleKind[];
} {
  const isActive = (ruleKind: (typeof originalEidolonRuleKinds)[number]) => {
    const rule = originalEidolonRule(ruleKind);
    return hasActiveArchetype(
      sheet,
      rule.classRuleIdentity,
      rule.archetypeIdentity,
    );
  };
  const supplied = originalEidolonRuleKinds.filter((ruleKind) => {
    const rule = originalEidolonRule(ruleKind);
    return (
      ruleKeyMatches(identity, rule.archetypeIdentity) ||
      rule.featureIdentities.some((feature) =>
        ruleKeyMatches(identity, feature),
      )
    );
  });
  // A turned-off Archetype's Selection still names its rule, but its
  // dormant source joins no conflict.
  const [dormant] = supplied;
  if (dormant && !supplied.some(isActive)) return { ruleKind: dormant };
  const matches = originalEidolonRuleKinds.filter(
    (ruleKind) =>
      isActive(ruleKind) &&
      (supplied.length > 0 ||
        ruleKeyMatches(
          classFamily,
          originalEidolonRule(ruleKind).classRuleIdentity,
        )),
  );
  const [only] = matches;
  if (matches.length === 1 && only) return { ruleKind: only };
  return matches.length
    ? { ruleKind: 'eidolon', ruleConflicts: [...matches] }
    : { ruleKind: 'eidolon' };
}

// An Archetype that divides effective levels is recognised from its
// Selection, its feature Grants or a Class Level of the class it applies to;
// an increasing feat from its Selection.
function findPooledRuleKind({
  identity,
  classFamily,
  sheet,
}: {
  identity: string | null | undefined;
  classFamily: string | null | undefined;
  sheet: CompanionSheet;
}): CompanionPooledRuleKind | null {
  for (const ruleKind of companionAllocationRuleKinds) {
    const rule = representativeCompanionRules[ruleKind].allocation;
    if (!rule) continue;
    if (
      ruleKeyMatches(identity, rule.archetypeIdentity) ||
      rule.featureIdentities.some((feature) =>
        ruleKeyMatches(identity, feature),
      )
    )
      return ruleKind;
    if (
      ruleKeyMatches(classFamily, rule.classRuleIdentity) &&
      hasActiveArchetype(sheet, rule.classRuleIdentity, rule.archetypeIdentity)
    )
      return ruleKind;
  }
  for (const ruleKind of companionIncreaseRuleKinds)
    if (
      identity === representativeCompanionRules[ruleKind].increase?.featIdentity
    )
      return ruleKind;
  return null;
}
export function resolveCuratedCompanionSources({
  relationship,
  sheet,
}: {
  relationship: Relationship;
  sheet: CompanionSheet | null;
}) {
  return relationship.sources.map((source) => {
    const { ruleConflicts: _stored, ...rest } = source;
    return {
      ...rest,
      ...deriveCompanionSourceRules({ kind: relationship.kind, source, sheet }),
    };
  });
}

type CompanionGraph = Awaited<ReturnType<typeof readCompanionGraph>>;

/**
 * The divided budgets an associated Character owns across all its
 * companions, with each source's rule kind and availability read from the
 * associated sheet.
 */
export function summarizeAssociatedAllocationShares({
  graph,
  associatedCharacterId,
  sheet,
  countingEntries,
}: {
  graph: Pick<CompanionGraph, 'relationships' | 'states'>;
  associatedCharacterId: Id<'character'>;
  sheet: CompanionSheet | null;
  countingEntries: Set<string> | undefined;
}) {
  return summarizeCompanionAllocationShares(
    [...graph.relationships.values()]
      .filter((row) => row.associatedCharacterId === associatedCharacterId)
      .map((row) => ({
        relationshipId: row._id,
        active: graph.states.get(row._id)?.status === 'active',
        sources: resolveCuratedCompanionSources({
          relationship: row,
          sheet,
        }).map((source) => ({
          ...source,
          counting:
            source.enabled &&
            isSupportingSourceAvailable(source, countingEntries),
          selectionId: identifySourceSelection(source),
        })),
      })),
  );
}

function identifySourceSelection(source: Relationship['sources'][number]) {
  if (source.sheetEntryId) return source.sheetEntryId;
  if (source.grantKey) return formatGrantKeyId(source.grantKey);
  return `source:${source.key}`;
}

export function listRelationshipLinkedInputs(
  relationship: Pick<Relationship, 'kind' | 'sources'>,
) {
  return listCuratedCompanionInputs(relationship);
}
export function findCuratedCompanionBinding(
  source: Relationship['sources'][number],
  kind: Relationship['kind'],
  input: CompanionLinkedInput,
) {
  return representativeCompanionRules[source.ruleKind ?? kind].inputs.find(
    (binding) => linkedInputKey(binding.input) === linkedInputKey(input),
  );
}

export async function hasCompanionCalculationDependencies(
  ctx: ReadCtx,
  character: Doc<'character'>,
) {
  if (character.familiarBaseCreatureKey) return true;
  const baseEntries = await ctx.db
    .query('characterSheetEntry')
    .withIndex('by_characterId_and_kind_and_active', (q) =>
      q.eq('characterId', character._id).eq('kind', 'base'),
    )
    .take(2);
  if (baseEntries.length > 1)
    throw new ConvexError('Character has multiple base entries');
  if (
    baseEntries.some(
      (entry) => entry.kind === 'base' && entry.state.companionProgression,
    )
  )
    return true;
  const relationships = await Promise.all([
    ctx.db
      .query('companionRelationship')
      .withIndex('by_associatedCharacterId', (q) =>
        q.eq('associatedCharacterId', character._id),
      )
      .take(1),
    ctx.db
      .query('companionRelationship')
      .withIndex('by_companionCharacterId', (q) =>
        q.eq('companionCharacterId', character._id),
      )
      .take(1),
  ]);
  return relationships.some((rows) => rows.length > 0);
}
