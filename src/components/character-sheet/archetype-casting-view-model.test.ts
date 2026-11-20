import { expect, test } from 'vitest';
import {
  casterLevelDependencies,
  describeCastingProperty,
  describeChoiceWait,
  describeProvenance,
  findChosenOption,
  isLevelPending,
  listArchetypeCastingLines,
  listCastingChoiceOptions,
} from './archetype-casting-view-model';
import {
  buildCastingSheet,
  type CastingArchetype,
} from './casting-features-test-fixture';

// The copy of Archetype casting changes (#422), read from the calculation of
// published representative Archetypes: Eldritch Scion (ACG p. 104) and
// Mindblade (OA p. 121) on a magus, Questioner (MTT p. 26) and Psychic
// Detective (OA pp. 119–120) on an investigator, Skirmisher (APG p. 128) and
// Dandy (UI p. 41) on a ranger. A merged option for two candidates sharing a
// value, Spell and slot detail keys, a caster-level wait and a compared
// casting ability have no published example and stay untested here.

const repeat = (identity: string, count: number) =>
  Array.from({ length: count }, () => identity);

function summary(
  identity: string,
  levels: number,
  archetypes: CastingArchetype[],
  recorded: { id: string; spell: string }[] = [],
) {
  const sheet = buildCastingSheet({
    levels: repeat(identity, levels),
    scores: { intelligence: 12, charisma: 16 },
    archetypes,
    recorded: recorded.map((row) => ({ ...row, castingClassId: identity })),
  });
  const casting = sheet.calculated.archetypeCastings.find(
    (row) => row.classEntryId === identity,
  );
  if (!casting) throw new Error(`Missing ${identity} summary`);
  const property = (key: string) => {
    const found = casting.properties.find((row) => row.key === key);
    if (!found) throw new Error(`Missing ${key}`);
    return found;
  };
  return { sheet, casting, property };
}

const investigator = (choices: string[] = []) =>
  summary(
    'investigator',
    7,
    [
      { key: 'investigator-questioner', choices },
      { key: 'investigator-psychic-detective' },
    ],
    [{ id: 'fireball-row', spell: 'fireball' }],
  );
const magus = () =>
  summary('magus', 5, [
    { key: 'magus-eldritch-scion' },
    { key: 'magus-mindblade' },
  ]);

test('each candidate is one option saved against its Selection; the chosen Selection selects its option', () => {
  const pending = investigator().property('spellList');
  const options = listCastingChoiceOptions(pending);
  expect(options).toEqual([
    {
      value: 'investigator-psychic-detective-row',
      entryIds: ['investigator-psychic-detective-row'],
      label: 'Psychic Detective: Uses the Psychic list',
    },
    {
      value: 'investigator-questioner-row',
      entryIds: ['investigator-questioner-row'],
      label: 'Questioner: Uses the Bard list',
    },
  ]);
  expect(findChosenOption(options, pending.chosenEntryId)).toBe('');
  const chosen = investigator(['spellList']).property('spellList');
  expect(findChosenOption(options, chosen.chosenEntryId)).toBe(
    'investigator-questioner-row',
  );
  expect(describeCastingProperty(chosen)).toBe('Spell list');
  expect(describeCastingProperty(magus().property('ability'))).toBe(
    'Casting ability',
  );
});

test('provenance names every source and marks a choice', () => {
  const scion = magus();
  expect(describeProvenance(scion.property('table'))).toBe(
    'from Eldritch Scion and Mindblade',
  );
  expect(describeProvenance(scion.property('ability'))).toBe(
    'from Eldritch Scion',
  );
  expect(
    describeProvenance(investigator(['spellList']).property('spellList')),
  ).toBe('from Questioner (your choice)');
  expect(describeProvenance(investigator().property('spellKind'))).toBeNull();
});

test('a value waits on the first open dependency; Skirmisher against Dandy leaves the caster level waiting on spellcasting itself', () => {
  const ranger = summary('ranger', 8, [
    { key: 'ranger-skirmisher' },
    { key: 'ranger-dandy' },
  ]);
  const unresolved = ranger.sheet.calculated.spellcastings[0]?.unresolved ?? [];
  expect(describeChoiceWait(unresolved, casterLevelDependencies)).toBe(
    'Waiting for a spellcasting choice',
  );
  const detective = investigator().sheet.calculated.spellcastings[0];
  expect(
    describeChoiceWait(detective?.unresolved ?? [], casterLevelDependencies),
  ).toBeNull();
});

test('a recorded Spell’s level waits only while the list choice is pending', () => {
  const pending = investigator();
  const casting = pending.sheet.calculated.spellcastings[0] ?? null;
  const fireball = (sheet: typeof pending.sheet) => {
    const spell = sheet.calculated.spellCollections.collections[0]?.spells[0];
    if (!spell) throw new Error('Missing Fireball');
    return spell;
  };
  expect(isLevelPending(fireball(pending.sheet), casting)).toBe(true);
  const chosen = investigator(['spellList']);
  // On the bard list Fireball is off-list, at its recorded level.
  expect(
    isLevelPending(
      fireball(chosen.sheet),
      chosen.sheet.calculated.spellcastings[0] ?? null,
    ),
  ).toBe(false);
  expect(isLevelPending(fireball(pending.sheet), null)).toBe(false);
});

test('an Archetype card lists its own changes, with a removal’s other changes ignored and an open conflict waiting', () => {
  const ranger = summary('ranger', 8, [
    { key: 'ranger-skirmisher' },
    { key: 'ranger-dandy' },
  ]);
  const definition = ranger.sheet.catalogEntries.find(
    (row) => row._id === 'ranger-dandy',
  );
  const change =
    definition?.detail.kind === 'archetype'
      ? definition.detail.casting
      : undefined;
  expect(
    listArchetypeCastingLines({
      change,
      entryId: 'ranger-dandy-row',
      properties: ranger.casting.properties,
      presence: ranger.casting.presence,
    }).map(({ text, state }) => [text, state]),
  ).toEqual([
    ['Casting ability: Charisma', 'waiting'],
    ['Casting table: Spontaneous low table', 'waiting'],
    ['Preparation: Spontaneous, spells known', 'waiting'],
    ['Spell list: the Bard list', 'waiting'],
  ]);
});
