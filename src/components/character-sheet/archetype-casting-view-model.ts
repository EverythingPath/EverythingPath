import { abilityLabels } from '~/lib/character-sheet';
import {
  capitalize,
  castingPropertyLabel,
  castingTableLabels,
  describeExtraSlot,
  describeRecording,
  signedNumber,
  spellListName,
} from '~/lib/character-sheet-casting-copy';
import {
  castingPropertyKeys,
  type ArchetypeCastingChange,
  type CastingPropertyKey,
  type ResolvedArchetypeSpellList,
  type ResolvedCastingProperty,
} from '~/lib/character-sheet-archetype-casting';
import {
  extraSlotKinds,
  type ExtraSlotKind,
} from '~/lib/character-sheet-casting-tables';

function isExtraSlotKind(value: string): value is ExtraSlotKind {
  return extraSlotKinds.some((kind) => kind === value);
}

// Copy for Archetype casting changes (#422): the name of each casting
// property and its per-Spell or per-slot details, the options a conflict
// offers, where an applied change comes from, and what a pending choice
// leaves waiting. Shared by the Archetypes section, the Spellcasting block
// and the Spells page.

/** Spell names by catalog id and by rule identity, from the sheet's catalog. */
export type SpellNames = Readonly<Record<string, string>>;

/** "Seducer", "Eldritch Scion and Mindblade", "A, B and C". */
export function joinNames(names: readonly string[]) {
  const unique = [...new Set(names)];
  if (unique.length <= 1) return unique[0] ?? '';
  return `${unique.slice(0, -1).join(', ')} and ${unique.at(-1)}`;
}

/** The detail after the property in a key: a Spell rule identity or a slot kind. */
function detailOf(property: Pick<ResolvedCastingProperty, 'key' | 'property'>) {
  const prefix = `${property.property}:`;
  return property.key.startsWith(prefix)
    ? property.key.slice(prefix.length)
    : '';
}

/**
 * "Casting ability", "Daylight on the spell list", "+1 domain slot": what
 * one casting property or detail is called on the sheet.
 */
export function describeCastingProperty(
  property: Pick<ResolvedCastingProperty, 'key' | 'property'>,
  spellNames: SpellNames = {},
) {
  const detail = detailOf(property);
  if (!detail) return castingPropertyLabel(property.property);
  if (property.property === 'extraSlots')
    return isExtraSlotKind(detail) ? describeExtraSlot(detail) : detail;
  const name = spellNames[detail] ?? detail;
  return property.property === 'spellList'
    ? `${name} on the spell list`
    : `${name} as a Granted Spell`;
}

export type CastingChoiceOption = {
  /** The first candidate's Selection, which the choice is saved against. */
  value: string;
  entryIds: string[];
  label: string;
};

/** One option per distinct value; candidates sharing a value share one option. */
export function listCastingChoiceOptions(
  property: Pick<ResolvedCastingProperty, 'candidates'>,
): CastingChoiceOption[] {
  const options = new Map<string, CastingChoiceOption>();
  for (const candidate of property.candidates) {
    const option = options.get(candidate.value);
    if (option) {
      option.entryIds.push(candidate.entryId);
      continue;
    }
    options.set(candidate.value, {
      value: candidate.entryId,
      entryIds: [candidate.entryId],
      label: candidate.value,
    });
  }
  return [...options.values()].map((option) => ({
    ...option,
    label: `${joinNames(
      property.candidates
        .filter((candidate) => option.entryIds.includes(candidate.entryId))
        .map((candidate) => candidate.name),
    )}: ${option.label}`,
  }));
}

/** The option holding the chosen Selection, or none while the choice waits. */
export function findChosenOption(
  options: readonly CastingChoiceOption[],
  chosenEntryId: string | null,
) {
  if (chosenEntryId === null) return '';
  return (
    options.find((option) => option.entryIds.includes(chosenEntryId))?.value ??
    ''
  );
}

/** "from Seducer", "from Eldritch Scion and Mindblade (higher modifier)". */
export function describeProvenance(
  property: Pick<ResolvedCastingProperty, 'status' | 'sources'>,
) {
  if (property.sources.length === 0) return null;
  const names = joinNames(property.sources.map((source) => source.name));
  const suffix =
    property.status === 'chosen'
      ? ' (your choice)'
      : property.status === 'automatic'
        ? ' (higher modifier)'
        : '';
  return `from ${names}${suffix}`;
}

/**
 * "Casting ability: Charisma, the higher current modifier (Eldritch Scion,
 * Mindblade)": the compared abilities and today's selection.
 */
export function describeAutomaticAbility(
  property: Pick<ResolvedCastingProperty, 'sources' | 'candidates'>,
) {
  const selected = property.candidates.find((candidate) =>
    property.sources.some((source) => source.entryId === candidate.entryId),
  );
  const names = [
    ...new Set(property.candidates.map((candidate) => candidate.name)),
  ].join(', ');
  return selected
    ? `Casting ability: ${selected.value}, the higher current modifier (${names})`
    : `Casting ability: the higher current modifier (${names})`;
}

const waitingCopy: Record<string, string> = {
  presence: 'Waiting for a spellcasting choice',
  table: 'Waiting for the casting table choice',
  casterLevelOffset: 'Waiting for the caster level choice',
  ability: 'Waiting for a casting ability',
  recording: 'Waiting for the preparation and recording choice',
  spellKind: 'Waiting for the spell kind choice',
  spellList: 'Waiting for the spell list choice',
  extraSlots: 'Waiting for the extra slots choice',
  grantedSpells: 'Waiting for the Granted Spells choice',
};

/**
 * Why a value waits: the first of its dependencies that is unresolved, in
 * the order they decide it (a removed Spellcasting before its table, the
 * table before the offset).
 */
export function describeChoiceWait(
  unresolved: readonly string[],
  dependencies: readonly CastingPropertyKey[],
) {
  const pending = dependencies.find((key) => unresolved.includes(key));
  return pending ? (waitingCopy[pending] ?? null) : null;
}

export const casterLevelDependencies = [
  'presence',
  'table',
  'casterLevelOffset',
] as const satisfies readonly CastingPropertyKey[];
export const concentrationDependencies = [
  'presence',
  'table',
  'casterLevelOffset',
  'ability',
] as const satisfies readonly CastingPropertyKey[];
export const perDayDependencies = [
  'presence',
  'table',
  'ability',
  'extraSlots',
] as const satisfies readonly CastingPropertyKey[];

function countSpells(count: number) {
  return `${count} ${count === 1 ? 'Spell' : 'Spells'}`;
}

/**
 * What one Archetype's own casting change does to one property, from its
 * definition: "Casting ability: Charisma", "Preparation: Spontaneous, spells
 * known", "Removes spellcasting".
 */
export function describeArchetypeCastingChange(
  change: ArchetypeCastingChange,
  key: CastingPropertyKey,
  catalog: Parameters<typeof spellListName>[1] = [],
) {
  switch (key) {
    case 'presence':
      if (change.presence === 'remove') return 'Removes spellcasting';
      return change.presence === 'add' ? 'Adds spellcasting' : null;
    case 'ability':
      return change.ability
        ? `Casting ability: ${abilityLabels[change.ability]}`
        : null;
    case 'spellKind':
      return change.spellKind
        ? `Spell kind: ${capitalize(change.spellKind)}`
        : null;
    case 'table':
      return change.table
        ? `Casting table: ${castingTableLabels[change.table.table]}`
        : null;
    case 'recording':
      return change.recording
        ? `Preparation: ${describeRecording(change.recording)}`
        : null;
    case 'casterLevelOffset':
      return change.casterLevelOffset === undefined
        ? null
        : `Caster level ${signedNumber(change.casterLevelOffset)}`;
    case 'spellList': {
      const list = change.spellList;
      if (!list) return null;
      const parts = [
        list.classTag
          ? `the ${spellListName(list.classTag, catalog)} list`
          : null,
        list.add?.length ? `${countSpells(list.add.length)} added` : null,
        list.remove?.length
          ? `${countSpells(list.remove.length)} removed`
          : null,
      ].filter((part) => part !== null);
      return parts.length ? `Spell list: ${parts.join(', ')}` : null;
    }
    case 'grantedSpells': {
      const granted = change.grantedSpells;
      if (!granted) return null;
      const parts = [
        granted.replace ? 'replaces the class’s own' : null,
        granted.add?.spells.length
          ? `${countSpells(granted.add.spells.length)} added`
          : null,
        granted.remove?.length
          ? `${countSpells(granted.remove.length)} removed`
          : null,
      ].filter((part) => part !== null);
      return parts.length ? `Granted Spells: ${parts.join(', ')}` : null;
    }
    case 'extraSlots': {
      const slots = change.extraSlots;
      if (!slots) return null;
      const added = (slots.add ?? []).map(describeExtraSlot);
      const parts = [
        slots.replace
          ? added.length
            ? `only ${added.join(', ')}`
            : 'none'
          : added.join(', ') || null,
        slots.remove?.length
          ? `removes ${slots.remove.map(describeExtraSlot).join(', ')}`
          : null,
      ].filter((part) => part !== null);
      return parts.length ? `Extra slots: ${parts.join(', ')}` : null;
    }
  }
}

export type ArchetypeCastingLine = {
  key: CastingPropertyKey;
  text: string;
  state: 'applied' | 'notApplied' | 'waiting';
};

type CastingPresence = 'none' | 'present' | 'removed' | 'unresolved';

/**
 * One card line's state, in order: an open conflict waits; a change another
 * Archetype's took the place of is not applied; an applied change applies;
 * otherwise the class's casting presence decides.
 */
function lineState({
  isWaiting,
  isSetAside,
  isApplied,
  presence,
}: {
  isWaiting: boolean;
  isSetAside: boolean;
  isApplied: boolean;
  presence: CastingPresence | undefined;
}): ArchetypeCastingLine['state'] {
  const cases: [boolean, ArchetypeCastingLine['state']][] = [
    [isWaiting, 'waiting'],
    [isSetAside, 'notApplied'],
    [isApplied, 'applied'],
    [presence === 'removed', 'notApplied'],
    [presence === 'unresolved', 'waiting'],
  ];
  return cases.find(([applies]) => applies)?.[1] ?? 'applied';
}

/**
 * The Spellcasting line of one Archetype card: each property its definition
 * changes, marked by what the class summary says about it. A change that
 * lost a choice or an ability comparison is not applied; one whose conflict
 * is still open waits.
 */
export function listArchetypeCastingLines({
  change,
  entryId,
  properties,
  presence,
  catalog = [],
}: {
  change: ArchetypeCastingChange | undefined;
  entryId: string;
  properties: readonly ResolvedCastingProperty[];
  presence: CastingPresence | undefined;
  catalog?: Parameters<typeof spellListName>[1];
}): ArchetypeCastingLine[] {
  if (!change) return [];
  const removing = change.presence === 'remove';
  return castingPropertyKeys.flatMap((key) => {
    // A removal ignores the Archetype's other casting properties.
    if (removing && key !== 'presence') return [];
    const text = describeArchetypeCastingChange(change, key, catalog);
    if (text === null) return [];
    const involved = properties.filter(
      (property) =>
        property.property === key &&
        (property.sources.some((source) => source.entryId === entryId) ||
          property.candidates.some(
            (candidate) => candidate.entryId === entryId,
          )),
    );
    const isApplied = involved.some((property) =>
      property.sources.some((source) => source.entryId === entryId),
    );
    const state = lineState({
      isWaiting: involved.some((property) => property.status === 'unresolved'),
      isSetAside:
        !isApplied &&
        involved.some((property) =>
          property.candidates.some(
            (candidate) => candidate.entryId === entryId,
          ),
        ),
      isApplied: isApplied || key === 'presence',
      presence,
    });
    return [{ key, text, state }];
  });
}

/** Spell names from the sheet's catalog, by id and by rule identity. */
export function listSpellNames(
  catalogEntries: readonly {
    _id: string;
    ruleIdentity: string;
    name: string;
    detail: { kind: string };
  }[],
): SpellNames {
  return Object.fromEntries(
    catalogEntries
      .filter((entry) => entry.detail.kind === 'spell')
      .flatMap((entry) => [
        [entry._id, entry.name],
        [entry.ruleIdentity, entry.name],
      ]),
  );
}

/**
 * A recorded Spell whose list level an Archetype choice still decides: the
 * whole list, or this one Spell's place on it, is pending, so it has no
 * level and is not off the list either.
 */
export function isLevelPending(
  spell: { spellLevel: number | null; offList: boolean; ruleIdentity: string },
  casting: { spellList: ResolvedArchetypeSpellList } | null,
) {
  return (
    spell.spellLevel === null &&
    !spell.offList &&
    casting !== null &&
    (casting.spellList.classTag === null ||
      casting.spellList.unresolved.includes(spell.ruleIdentity))
  );
}
