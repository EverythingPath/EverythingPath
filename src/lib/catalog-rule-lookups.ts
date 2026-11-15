import type { CharacterSheetCatalogEntry, SheetEntry } from './character-sheet';
import { normalizeProficiencyName } from './character-sheet-proficiencies';
import {
  normalizePrerequisiteAtom,
  type Prerequisite,
  type PrerequisiteAtom,
} from './character-sheet-prerequisite-schema';

/**
 * A rule that finds definitions by what they are rather than by a stored
 * reference: a prerequisite naming a rule identity, a race a Character counts
 * as, the classes granting a named class feature, the weapon a proficiency
 * names, or the Spell a prerequisite or Spell Effect names (`castsSpell`). A
 * sheet that loads only referenced definitions resolves these too.
 */
export type CatalogRuleLookup =
  | { kind: 'ruleIdentity'; ruleIdentity: string }
  | { kind: 'castsSpell'; ruleIdentity: string }
  | { kind: 'classFeatureOwner'; ruleIdentity: string }
  | { kind: 'weaponBaseType'; baseType: string };

export function catalogRuleLookupKey(lookup: CatalogRuleLookup) {
  return lookup.kind === 'weaponBaseType'
    ? `${lookup.kind}:${normalizeProficiencyName(lookup.baseType)}`
    : `${lookup.kind}:${lookup.ruleIdentity}`;
}

/** The only definition kind a lookup can match, when it is limited to one. */
export function catalogRuleLookupDetailKind(lookup: CatalogRuleLookup) {
  if (lookup.kind === 'classFeatureOwner') return 'class' as const;
  if (lookup.kind === 'weaponBaseType') return 'item' as const;
  return null;
}

function listAtoms(requirement: Prerequisite): PrerequisiteAtom[] {
  return 'anyOf' in requirement ? requirement.anyOf : [requirement];
}

export function listCatalogRuleLookups({
  entries,
  catalogEntries,
}: {
  entries: readonly SheetEntry[];
  catalogEntries: readonly CharacterSheetCatalogEntry[];
}): CatalogRuleLookup[] {
  const lookups = new Map<string, CatalogRuleLookup>();
  const add = (lookup: CatalogRuleLookup) =>
    lookups.set(catalogRuleLookupKey(lookup), lookup);
  const identity = (ruleIdentity: string) =>
    add({ kind: 'ruleIdentity', ruleIdentity });
  for (const definition of catalogEntries) {
    const clauses = [
      ...(definition.prerequisites ?? []),
      ...(definition.proficiencyPrerequisites ?? []).map(({ proficiency }) => ({
        proficiency,
      })),
    ];
    for (const atom of clauses.flatMap(listAtoms)) {
      const clause = normalizePrerequisiteAtom(atom);
      switch (clause.kind) {
        case 'feat':
          identity(clause.feat);
          break;
        case 'classFeature':
          identity(clause.classFeature);
          if (clause.classFeatureClass) identity(clause.classFeatureClass);
          add({
            kind: 'classFeatureOwner',
            ruleIdentity: clause.classFeature,
          });
          break;
        case 'racialTrait':
          identity(clause.racialTrait);
          break;
        case 'race':
          for (const race of clause.race) identity(race);
          break;
        case 'classLevel':
          identity(clause.classLevel);
          break;
        case 'castsSpell':
          add({ kind: 'castsSpell', ruleIdentity: clause.castsSpell });
          break;
        case 'proficiency': {
          const { proficiency } = clause;
          if ('baseType' in proficiency)
            add({ kind: 'weaponBaseType', baseType: proficiency.baseType });
          else if ('choice' in proficiency)
            for (const entry of entries)
              if (
                'catalogEntryId' in entry &&
                entry.catalogEntryId === definition._id &&
                'choice' in entry.state &&
                entry.state.choice?.trim()
              )
                add({
                  kind: 'weaponBaseType',
                  baseType: entry.state.choice.trim(),
                });
          break;
        }
        default:
          break;
      }
    }
    // A Spell Effect's default caster level reads its Spell's class lists.
    if (definition.detail?.kind === 'spellEffect' && definition.detail.spellKey)
      add({ kind: 'castsSpell', ruleIdentity: definition.detail.spellKey });
    const countsAsRaces = definition.countsAsRaces;
    if (countsAsRaces)
      for (const race of 'oneOf' in countsAsRaces
        ? countsAsRaces.oneOf
        : countsAsRaces)
        identity(race);
  }
  return [...lookups.values()];
}

/** Candidates a lookup adds to the loaded definitions, never ones already loaded. */
export function selectCatalogRuleLookupRows<
  Row extends CharacterSheetCatalogEntry,
>(
  lookup: CatalogRuleLookup,
  candidates: readonly Row[],
  loaded: readonly CharacterSheetCatalogEntry[],
): Row[] {
  const loadedIds = new Set(loaded.map((row) => row._id));
  const featureIds =
    lookup.kind === 'classFeatureOwner'
      ? new Set(
          [...loaded, ...candidates]
            .filter((row) => row.ruleIdentity === lookup.ruleIdentity)
            .map((row) => row._id),
        )
      : new Set<string>();
  const matches = (row: Row) => {
    const detail = row.detail;
    switch (lookup.kind) {
      case 'ruleIdentity':
      case 'castsSpell':
        return row.ruleIdentity === lookup.ruleIdentity;
      case 'classFeatureOwner':
        return (
          detail?.kind === 'class' &&
          'featuresByLevel' in detail &&
          (detail.featuresByLevel ?? []).some((feature) =>
            featureIds.has(feature.catalogEntryId),
          )
        );
      case 'weaponBaseType':
        return (
          detail?.kind === 'item' &&
          detail.weapon !== undefined &&
          normalizeProficiencyName(detail.weapon.baseType) ===
            normalizeProficiencyName(lookup.baseType)
        );
    }
  };
  return candidates.filter((row) => !loadedIds.has(row._id) && matches(row));
}
