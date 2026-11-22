import { characterSheetClassFamily } from './character-sheet-grants';
import { compareClassLevelPosition } from './character-sheet-class-levels';
import {
  armorProficiencyCategory,
  type ArmorCategory,
} from './character-sheet-armor-categories';
import type { CharacterSheetInput } from './character-sheet';

export {
  proficiencyCategories,
  manualProficiencySchema,
  type ManualProficiency,
  type ProficiencyGrant,
} from './character-sheet-proficiency-schema';
import type {
  ManualProficiency,
  ProficiencyGrant,
} from './character-sheet-proficiency-schema';
export type ProficiencyPrerequisite = {
  kind: 'proficiency';
  proficiency: ProficiencyGrant;
};
export function normalizeProficiencyName(value: string) {
  return value.trim().toLowerCase();
}

export function proficiencyKey(proficiency: ManualProficiency) {
  if ('category' in proficiency) return `category:${proficiency.category}`;
  if ('baseType' in proficiency)
    return `name:${normalizeProficiencyName(proficiency.baseType)}:${Boolean(proficiency.asMartial)}`;
  return `group:${normalizeProficiencyName(proficiency.group)}`;
}

export function isHandDependentWeapon(baseType: string) {
  return ['bastard sword', 'dwarven waraxe'].includes(
    normalizeProficiencyName(baseType),
  );
}

function entryDefinitionId(entry: CharacterSheetInput['entries'][number]) {
  if (entry.kind === 'classLevel') return entry.state.classEntryId;
  return 'catalogEntryId' in entry ? entry.catalogEntryId : undefined;
}

function entryProficiencyChoice(entry: CharacterSheetInput['entries'][number]) {
  if (entry.kind === 'classLevel') return entry.state.proficiencyChoice;
  return 'choice' in entry.state ? entry.state.choice : undefined;
}

export function resolveProficiencies(input: CharacterSheetInput) {
  const grants: {
    proficiency: ManualProficiency;
    entryId: string;
    name: string;
  }[] = [];
  const missingChoices: {
    entryId: string;
    name: string;
    kind: 'classLevel' | 'entry';
  }[] = [];
  const choices: { entryId: string; name: string; choice: string | null }[] =
    [];
  const classes = new Set<string>();
  for (const entry of [...input.entries].sort(compareClassLevelPosition)) {
    if (!entry.active) continue;
    const id = entryDefinitionId(entry);
    if (!id) continue;
    const catalog = input.catalogEntries.find(
      (candidate) => candidate._id === id,
    );
    if (!catalog) continue;
    if (entry.kind === 'classLevel') {
      const family = characterSheetClassFamily(catalog, input.catalogEntries);
      if (classes.has(family)) continue;
      classes.add(family);
    }
    for (const grant of catalog.proficiencies ?? []) {
      if ('choice' in grant) {
        const trimmedChoice = entryProficiencyChoice(entry)?.trim() ?? '';
        const choice = trimmedChoice === '' ? null : trimmedChoice;
        if (!choices.some((row) => row.entryId === entry._id))
          choices.push({
            entryId: entry._id,
            name: catalog.name ?? id,
            choice,
          });
        if (!choice?.trim())
          missingChoices.push({
            entryId: entry._id,
            name: catalog.name ?? id,
            kind: entry.kind === 'classLevel' ? 'classLevel' : 'entry',
          });
        else
          grants.push({
            proficiency: { baseType: choice.trim() },
            entryId: entry._id,
            name: catalog.name ?? id,
          });
      } else
        grants.push({
          proficiency: grant,
          entryId: entry._id,
          name: catalog.name ?? id,
        });
    }
  }
  const base = input.entries.find((entry) => entry.kind === 'base');
  return {
    grants,
    added: base?.state.proficiencies?.added ?? [],
    removed: base?.state.proficiencies?.removed ?? [],
    missingChoices,
    choices,
  };
}
export type ResolvedProficiencies = ReturnType<typeof resolveProficiencies>;
export type ProficiencySubject =
  | {
      kind: 'weapon';
      baseType: string;
      proficiency: 'simple' | 'martial' | 'exotic' | 'always';
      groups?: readonly string[];
      hands?: 'one' | 'two';
    }
  | { kind: 'armor'; category: ArmorCategory };
export function matchesProficiency(
  grant: ManualProficiency,
  subject: ProficiencySubject,
  martial: boolean,
) {
  if (subject.kind === 'armor') {
    return (
      'category' in grant &&
      grant.category === armorProficiencyCategory(subject.category)
    );
  }
  if ('baseType' in grant)
    return (
      normalizeProficiencyName(grant.baseType) ===
        normalizeProficiencyName(subject.baseType) &&
      (!grant.asMartial || martial)
    );
  if ('group' in grant)
    return (
      subject.groups?.some(
        (group) =>
          normalizeProficiencyName(group) ===
          normalizeProficiencyName(grant.group),
      ) === true
    );
  if (grant.category === 'firearm')
    return (
      subject.groups?.some(
        (group) => normalizeProficiencyName(group) === 'firearms',
      ) === true
    );
  if (isHandDependentWeapon(subject.baseType) && subject.hands === 'two')
    return grant.category === 'martial';
  return (
    subject.proficiency !== 'exotic' && subject.proficiency === grant.category
  );
}
export function isProficient(
  proficiencies: ResolvedProficiencies,
  subject: ProficiencySubject,
) {
  if (subject.kind === 'weapon' && subject.proficiency === 'always')
    return true;
  const grants = [
    ...proficiencies.grants.map((grant) => grant.proficiency),
    ...proficiencies.added,
  ];
  const martial =
    grants.some(
      (grant) => 'category' in grant && grant.category === 'martial',
    ) &&
    !proficiencies.removed.some(
      (grant) => 'category' in grant && grant.category === 'martial',
    );
  const oneHandExotic =
    subject.kind === 'weapon' &&
    subject.hands !== 'two' &&
    isHandDependentWeapon(subject.baseType);
  const covered = grants.some(
    (grant) =>
      matchesProficiency(grant, subject, martial) &&
      (!oneHandExotic || 'baseType' in grant),
  );
  return (
    covered &&
    !proficiencies.removed.some((grant) =>
      matchesProficiency(grant, subject, true),
    )
  );
}
export function meetsProficiencyPrerequisite(
  proficiencies: ResolvedProficiencies,
  clause: ProficiencyPrerequisite,
  input?: CharacterSheetInput,
) {
  const required = clause.proficiency;
  if ('choice' in required) return false;
  if ('baseType' in required) {
    if (normalizeProficiencyName(required.baseType) === 'unarmed strike')
      return true;
    const definition = input?.catalogEntries.find(
      (entry) =>
        entry.detail?.kind === 'item' &&
        entry.detail.weapon !== undefined &&
        normalizeProficiencyName(entry.detail.weapon.baseType) ===
          normalizeProficiencyName(required.baseType),
    );
    const weapon =
      definition?.detail?.kind === 'item'
        ? definition.detail.weapon
        : undefined;
    if (weapon?.naturalAttack) return true;
    return isProficient(proficiencies, {
      kind: 'weapon',
      baseType: required.baseType,
      proficiency: weapon?.proficiency ?? 'exotic',
      groups: weapon?.groups,
      hands: 'two',
    });
  }
  const same = (grant: ManualProficiency) =>
    'category' in required
      ? 'category' in grant && grant.category === required.category
      : 'group' in grant &&
        normalizeProficiencyName(grant.group) ===
          normalizeProficiencyName(required.group);
  return (
    [
      ...proficiencies.grants.map((grant) => grant.proficiency),
      ...proficiencies.added,
    ].some(same) && !proficiencies.removed.some(same)
  );
}
