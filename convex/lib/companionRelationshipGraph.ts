import {
  companionArchetypeRuleKinds,
  representativeCompanionRules,
  listCuratedCompanionInputs,
  type CompanionArchetypeRuleKind,
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
  getCompanionArchetypeRule,
  getCompanionFusionRule,
  getCompanionReductionRule,
  isCompanionFusedRuleKind,
  summarizeCompanionAllocationShares,
  type CompanionPooledRuleKind,
  type CompanionSourceNotEntitled,
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

/**
 * A supporting source's standing on its associated sheet, the one decision
 * every reader of "does this source count" reads (`readCompanionSourceStatus`):
 * it counts; its Class Level, Grant or Selection no longer counts on the
 * sheet; or the sheet counts its Class Level but entitles no companion of
 * the relationship's kind through it. A source the user switched off is the
 * source's own state, read beside it (`isCountingCompanionSource`).
 */
export type CompanionSourceStatus =
  | { kind: 'counting' }
  | { kind: 'notOnSheet' }
  | { kind: 'notEntitled'; notEntitled: CompanionSourceNotEntitled };
/**
 * What an associated sheet decides for the companion sources it supports
 * (`readCompanionSupport`): the entries and Grants that count, and the
 * counting Class Levels that entitle no animal companion, with why. Every
 * consumer reads a source's standing from it through the one decision
 * function, `readCompanionSourceStatus`. It holds no sheet, so a snapshot
 * taken before an edit keeps its decisions.
 */
export type CompanionSupport = {
  countingEntries: ReadonlySet<string>;
  notEntitled: ReadonlyMap<string, CompanionSourceNotEntitled>;
};
const counting: CompanionSourceStatus = { kind: 'counting' };
const notOnSheet: CompanionSourceStatus = { kind: 'notOnSheet' };
/**
 * A source's standing on its associated sheet, from that sheet's support.
 * A source named by hand, with no Class Level, Grant or Selection, counts;
 * one whose entry the sheet does not count, or whose sheet was not read,
 * does not. Only an animal companion's Class Level can lack entitlement.
 */
export function readCompanionSourceStatus(
  kind: Relationship['kind'],
  source: Relationship['sources'][number],
  support: CompanionSupport | undefined,
): CompanionSourceStatus {
  const entryKey =
    source.sheetEntryId ??
    (source.grantKey ? formatGrantKeyId(source.grantKey) : null);
  if (entryKey === null) return counting;
  if (!support?.countingEntries.has(entryKey)) return notOnSheet;
  const notEntitled =
    kind === 'animalCompanion' && source.sheetEntryId
      ? support.notEntitled.get(source.sheetEntryId)
      : undefined;
  return notEntitled ? { kind: 'notEntitled', notEntitled } : counting;
}
/** A source counts while it is switched on and its standing counts. */
export function isCountingCompanionSource(
  kind: Relationship['kind'],
  source: Relationship['sources'][number],
  support: CompanionSupport | undefined,
) {
  return (
    source.enabled &&
    readCompanionSourceStatus(kind, source, support).kind === 'counting'
  );
}

export function hasAvailableSupportingSource(
  kind: Relationship['kind'],
  sources: Relationship['sources'],
  support: CompanionSupport | undefined,
) {
  return sources.some((source) =>
    isCountingCompanionSource(kind, source, support),
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

/**
 * The associated sheet's decisions for companion sources: its counting
 * entries and Grants, its active Class Levels, and which of those Class
 * Levels entitle no animal companion and why, each class decided once in
 * a call.
 */
export function readCompanionSupport(
  sheet: CompanionSheet | null,
): CompanionSupport {
  if (!sheet) return { countingEntries: new Set(), notEntitled: new Map() };
  return {
    countingEntries: new Set([
      ...sheet.calculated.resolvedEntries
        .filter((entry) => entry.counting)
        .flatMap((entry) => [
          entry.entry._id,
          ...(entry.storedEntryId ? [entry.storedEntryId] : []),
        ]),
      ...listActiveClassLevels(sheet).map((entry) => entry._id),
    ]),
    notEntitled: listNotEntitledClassLevels(sheet),
  };
}
function listActiveClassLevels(sheet: CompanionSheet) {
  return sheet.entries.flatMap((entry) =>
    entry.kind === 'classLevel' && entry.active ? [entry] : [],
  );
}
function listNotEntitledClassLevels(sheet: CompanionSheet) {
  const notEntitled = new Map<string, CompanionSourceNotEntitled>();
  const byClass = new Map<string, CompanionSourceNotEntitled | null>();
  for (const entry of listActiveClassLevels(sheet)) {
    const { classEntryId } = entry.state;
    if (!classEntryId) continue;
    if (!byClass.has(classEntryId))
      byClass.set(classEntryId, findClassNotEntitled(sheet, classEntryId));
    const decision = byClass.get(classEntryId);
    if (decision) notEntitled.set(entry._id, decision);
  }
  return notEntitled;
}

function determineInterruption({
  row,
  characters,
  support,
  active,
}: {
  row: Relationship;
  characters: Map<Id<'character'>, Doc<'character'> | null>;
  support: Map<Id<'character'>, CompanionSupport>;
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
      row.kind,
      row.sources,
      support.get(row.associatedCharacterId),
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
  const support = new Map<Id<'character'>, CompanionSupport>();
  for (const row of relationships.values()) {
    if (
      support.has(row.associatedCharacterId) ||
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
    support.set(row.associatedCharacterId, readCompanionSupport(sheet));
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
      support,
      active,
    });
    states.set(row._id, {
      status: interruption ? 'interrupted' : 'active',
      interruption,
    });
    if (!interruption) active.set(row.companionCharacterId, row);
  }
  return { relationships, characters, states, active, support, sheets };
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
    const ruleKind = deriveAnimalCompanionRuleKind({
      identity,
      classFamily: classDefinition ? identity : null,
      sheet,
    });
    if (ruleKind) return { ruleKind };
  }
  return { ruleKind: sourceEntry ? kind : (source.ruleKind ?? kind) };
}
/** An animal companion source's rule kind from its identity, if any. */
function deriveAnimalCompanionRuleKind({
  identity,
  classFamily,
  sheet,
}: {
  identity: string | null | undefined;
  classFamily: string | null | undefined;
  sheet: CompanionSheet;
}): CompanionSourceRuleKind | null {
  const pooled = findPooledRuleKind({ identity, classFamily, sheet });
  if (pooled) return pooled;
  const added = findArchetypeCompanionRuleKind({
    identity,
    classFamily,
    sheet,
  });
  if (added) return added;
  if (ruleKeyMatches(identity, 'druid')) return 'druidCompanion';
  if (ruleKeyMatches(identity, 'ranger')) return 'rangerCompanion';
  if (identity === 'cavalier') return 'cavalierMount';
  return null;
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
// An Archetype that gives its class a companion (#716 E3) is recognised
// like a level-dividing one: from its Selection, its feature Grants or a
// Class Level of its class while it applies there. A Class Level of that
// class without it supports no companion.
function findArchetypeCompanionRuleKind({
  identity,
  classFamily,
  sheet,
}: {
  identity: string | null | undefined;
  classFamily: string | null | undefined;
  sheet: CompanionSheet;
}): CompanionArchetypeRuleKind | null {
  for (const ruleKind of companionArchetypeRuleKinds) {
    const rule = getCompanionArchetypeRule(ruleKind);
    if (
      ruleKeyMatches(identity, rule.archetypeIdentity) ||
      rule.featureIdentities.some((feature) =>
        ruleKeyMatches(identity, feature),
      ) ||
      (ruleKeyMatches(classFamily, rule.classRuleIdentity) &&
        hasActiveArchetype(
          sheet,
          rule.classRuleIdentity,
          rule.archetypeIdentity,
        ))
    )
      return ruleKind;
  }
  return null;
}
/**
 * The class features through which a Class Level has an ordinary animal
 * companion (companion-entitlement-replaced): the class's own feature first,
 * then each Archetype's own version of it that replaces it and still grants
 * that companion, as its text reads. A Class Level whose sheet has a Grant of
 * one of them entitles a companion while one counts; while an applied
 * Archetype replaces them all, it entitles none.
 */
export const companionGrantingFeatures = {
  druidCompanion: [
    // Nature bond (CRB p. 51), pf1/wZ40bxNVn95BbLBV.
    'druid-nature-bond',
    // Each still offers an animal companion, of a named kind or beside other
    // domains: Ape, Bat and Boar Shaman (Ultimate Combat pp. 42–43;
    // uc_abilities_class.lst, "<Archetype> ~ Nature Bond"), Cave Druid (APG
    // p. 99; apg_abilities_class.lst, "Cave Druid ~ Nature Bond") and
    // Dinosaur Druid (Ultimate Wilderness p. 47; uw_abilities_class.lst,
    // "Dinosaur Druid ~ Dinosaur Bond": "This alters nature's bond").
    'druid-ape-shaman-nature-bond',
    'druid-bat-shaman-nature-bond',
    'druid-boar-shaman-nature-bond',
    'druid-cave-druid-nature-bond',
    'druid-dinosaur-druid-dinosaur-bond',
  ],
  rangerCompanion: [
    // Hunter's bond (CRB p. 66), pf1/Bs5i98ja24ODe9WL.
    'ranger-hunters-bond',
    // Horse Lord's Mounted Bond (APG p. 125; apg_abilities_class.lst,
    // "Horse Lord ~ Mounted Bond"): an animal companion at ranger level − 3.
    'ranger-horse-lord-mounted-bond',
  ],
} as const satisfies Partial<
  Record<CompanionSourceRuleKind, readonly [string, ...string[]]>
>;
function isCompanionGrantedRuleKind(
  ruleKind: CompanionSourceRuleKind,
): ruleKind is keyof typeof companionGrantingFeatures {
  return ruleKind in companionGrantingFeatures;
}
/**
 * Why a Class Level of this class entitles no animal companion on its
 * sheet, or null while it does. A class whose companion only an Archetype
 * adds (#716 E3) entitles none while that Archetype does not apply; a class
 * whose companion-granting feature an applied Archetype replaces entitles
 * none while it does (`findReplacingArchetypes`). Either way its source
 * stops counting as a removed Selection or Grant does, and the other
 * sources keep their contributions (docs/catalog-import/archetypes.md).
 */
function findClassNotEntitled(
  sheet: CompanionSheet,
  classEntryId: string,
): CompanionSourceNotEntitled | null {
  const definition = sheet.catalogEntries.find(
    (item) => item._id === classEntryId,
  );
  if (!definition) return null;
  const family = characterSheetClassFamily(definition, sheet.catalogEntries);
  const needsArchetype = companionArchetypeRuleKinds.some((ruleKind) => {
    const rule = getCompanionArchetypeRule(ruleKind);
    return (
      ruleKeyMatches(family, rule.classRuleIdentity) &&
      !hasActiveArchetype(sheet, rule.classRuleIdentity, rule.archetypeIdentity)
    );
  });
  if (needsArchetype) return { reason: 'archetypeDoesNotApply' };
  const archetypes = findReplacingArchetypes(sheet, family);
  return archetypes ? { reason: 'replacedBy', archetypes } : null;
}
/**
 * The applied Archetypes that replace the feature through which a Class
 * Level of this class family has its companion, such as the Guide's
 * Terrain Bond replacing hunter's bond. It reads the sheet's Grants of that
 * class's companion-granting features (the class's own and the Archetype
 * versions that still grant it): while one counts, kept included, nothing
 * replaces it; while none counts and an applied Archetype replaces one,
 * those Archetypes are named. A sheet with no such Grant, as a class
 * without a feature schedule, finds nothing. A replacement feature that
 * grants a companion but is not listed in `companionGrantingFeatures` is
 * not read, so the class is found replaced.
 */
function findReplacingArchetypes(
  sheet: CompanionSheet,
  family: string,
): string[] | null {
  const ruleKind = deriveAnimalCompanionRuleKind({
    identity: family,
    classFamily: family,
    sheet,
  });
  if (!ruleKind || !isCompanionGrantedRuleKind(ruleKind)) return null;
  const features: readonly string[] = companionGrantingFeatures[ruleKind];
  const applied = sheet.calculated.archetypes.classes
    .filter((effects) => effects.classIdentity === family)
    .flatMap((effects) => effects.archetypes);
  const sources = new Set([
    family,
    ...applied.map((archetype) => archetype.ruleIdentity),
  ]);
  const grants = sheet.calculated.resolvedEntries.filter(
    ({ origin, entry }) =>
      origin === 'grant' &&
      'grantKey' in entry &&
      entry.grantKey !== undefined &&
      sources.has(entry.grantKey.source) &&
      features.some((feature) =>
        ruleKeyMatches(entry.grantKey?.entry, feature),
      ),
  );
  if (grants.some(({ counting }) => counting)) return null;
  const replacing = new Set(
    grants.flatMap(({ reason }) =>
      reason?.kind === 'replaced' ? reason.byEntryIds : [],
    ),
  );
  if (replacing.size === 0) return null;
  return [
    ...new Set(
      applied
        .filter((archetype) => replacing.has(archetype.entryId))
        .map((archetype) => archetype.name),
    ),
  ];
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
  support,
}: {
  graph: Pick<CompanionGraph, 'relationships' | 'states'>;
  associatedCharacterId: Id<'character'>;
  sheet: CompanionSheet | null;
  support: CompanionSupport | undefined;
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
          counting: isCountingCompanionSource(row.kind, source, support),
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
