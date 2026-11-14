import { describe, expect, test } from 'vitest';
import { representativeArchetypeCatalog } from '../../convex/lib/representativeArchetypeCatalog';
import { representativeClassCatalog } from '../../convex/lib/representativeClassCatalog';
import { representativeSelectionCatalog } from '../../convex/lib/representativeSelectionCatalog';
import { representativeGrantedSpellCatalog } from '../../convex/lib/representativeSpellcastingCatalog';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from './character-sheet';
import type { Ability } from './character-sheet-abilities';

// Every Archetype here is a published, cited representative seed
// (docs/catalog-import/archetypes.md); no casting case is invented.
type Scores = Partial<Record<Ability, number>>;
type Selected = { key: string; choices?: string[]; active?: boolean };

const catalog: CharacterSheetCatalogEntry[] = [
  ...representativeClassCatalog.map((entry) => ({
    ...entry,
    _id: entry.ruleIdentity,
  })),
  ...representativeArchetypeCatalog,
  ...representativeGrantedSpellCatalog.map((entry) => ({
    ...entry,
    _id: entry.ruleIdentity,
  })),
  ...representativeSelectionCatalog.map((entry) => ({
    ...entry,
    _id: entry.ruleIdentity,
  })),
];

function build({
  classes,
  scores = {},
  archetypes = [],
  entries = [],
}: {
  classes: [string, number][];
  scores?: Scores;
  archetypes?: Selected[];
  entries?: SheetEntry[];
}): CharacterSheetInput {
  let position = 0;
  return {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
      ...classes.flatMap(([id, count]) =>
        Array.from(
          { length: count },
          (_, level): SheetEntry => ({
            _id: `${id}-${level + 1}`,
            kind: 'classLevel',
            active: true,
            state: {
              kind: 'classLevel',
              classEntryId: id,
              position: ++position,
              hpGained: 4,
            },
          }),
        ),
      ),
      ...archetypes.map(
        ({ key, choices, active = true }): SheetEntry => ({
          _id: `${key}-row`,
          kind: 'archetype',
          active,
          catalogEntryId: key,
          state: {
            kind: 'archetype',
            ...(choices ? { castingChoices: choices } : {}),
          },
        }),
      ),
      ...entries,
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base' as const,
          value: scores[ability] ?? 10,
        })),
      },
      ...catalog,
    ],
  };
}

function casting(input: CharacterSheetInput, classId: string) {
  return calculateCharacterSheet(input).spellcastings.find(
    (row) => row.classEntryId === classId,
  );
}

function recordedSpell(
  key: string,
  classId: string,
  level: number | null,
): SheetEntry {
  return {
    _id: `${key}-recorded`,
    kind: 'spell',
    active: true,
    catalogEntryId: `representative-spell-${key}`,
    state: { kind: 'spell', castingClassId: classId, level },
  };
}

// CRB p. 118: "Ability to cast arcane spells".
const arcaneStrike: SheetEntry = {
  _id: 'arcane-strike-row',
  kind: 'feat',
  active: true,
  catalogEntryId: 'arcane-strike',
  state: { kind: 'feat' },
};

function currentPrerequisites(input: CharacterSheetInput, entryId: string) {
  return calculateCharacterSheet(input)
    .prerequisites.filter(
      (check) => check.entryId === entryId && check.view === 'current',
    )
    .map(({ met }) => met);
}

const property = (
  result: { castingProperties: { key: string }[] } | undefined,
  key: string,
) => result?.castingProperties.find((row) => row.key === key);

describe('#238 case 1: whole-feature against part conflicts', () => {
  // ACG p. 132 Stone Spirit Hex "alters hex"; LotFW p. 16 Seducer's Kiss
  // replaces the 6th-level hex.
  test('Mountain Witch altering the whole hex conflicts with Seducer’s replaced hexes', () => {
    const result = calculateCharacterSheet(
      build({
        classes: [['witch', 8]],
        archetypes: [{ key: 'witch-mountain-witch' }, { key: 'witch-seducer' }],
      }),
    );
    expect(
      result.archetypes.conflicts.map(({ featureIdentity, part }) => [
        featureIdentity,
        part,
      ]),
    ).toEqual([['witch-hex', null]]);
  });
});

describe('#238 case 2: a single casting-ability replacement', () => {
  // LotFW p. 16 Otherworldly Allure: Charisma rather than Intelligence.
  test('Seducer’s Charisma applies without competing against the inherited Intelligence', () => {
    const input = build({
      classes: [['witch', 5]],
      scores: { intelligence: 18, charisma: 12 },
      archetypes: [{ key: 'witch-seducer' }],
    });
    const witch = casting(input, 'witch');
    expect(witch?.ability).toBe('charisma');
    // DC 10 + 1 + Charisma +1, though Intelligence +4 is higher.
    expect(witch?.slots[1]?.dc.total).toBe(12);
    // CRB Table 1–3: Charisma 12 gives one 1st-level bonus spell only.
    expect(witch?.slots.map((slot) => slot.bonus)).toEqual([0, 1, 0, 0]);
    expect(witch?.castingProperties).toEqual([
      expect.objectContaining({
        key: 'ability',
        status: 'changed',
        sources: [{ entryId: 'witch-seducer-row', name: 'Seducer' }],
        candidates: [],
      }),
    ]);
  });

  test('an inactive Seducer stops replacing the ability', () => {
    const witch = casting(
      build({
        classes: [['witch', 5]],
        archetypes: [{ key: 'witch-seducer', active: false }],
      }),
      'witch',
    );
    expect(witch?.ability).toBe('intelligence');
    expect(witch?.castingProperties).toEqual([]);
  });
});

// #238 case 3, competing abilities, has no published example: restated base
// values are not changes (owner decision), so Mindblade's Intelligence is
// inherited and no seeded pair offers two abilities. The comparison stays in
// code, documented as untested.
describe('Eldritch Scion and Mindblade on a magus combine their real changes', () => {
  // ACG p. 104 Eldritch Scion: Charisma, a bard's table, spontaneous and
  // known. OA p. 121 Mindblade: psychic, a bard's table, spontaneous and known.
  const magus = (scores: Scores, entries: SheetEntry[] = []) =>
    build({
      classes: [['magus', 5]],
      scores,
      archetypes: [{ key: 'magus-eldritch-scion' }, { key: 'magus-mindblade' }],
      entries,
    });

  test('Eldritch Scion’s Charisma is a sole replacement over the inherited Intelligence', () => {
    const result = casting(magus({ charisma: 14, intelligence: 18 }), 'magus');
    expect(result?.ability).toBe('charisma');
    expect(property(result, 'ability')).toMatchObject({
      status: 'changed',
      sources: [
        { entryId: 'magus-eldritch-scion-row', name: 'Eldritch Scion' },
      ],
      candidates: [],
    });
    // DC 10 + 1 + Charisma +2, though Intelligence +4 is higher.
    expect(result?.slots[1]?.dc.total).toBe(13);
  });

  test('both alter the magus spellcasting feature, so their advisory compatibility conflict warns', () => {
    const result = calculateCharacterSheet(magus({ charisma: 16 }));
    expect(
      result.archetypes.conflicts.map(({ featureIdentity, part }) => [
        featureIdentity,
        part,
      ]),
    ).toEqual([['magus-spells', null]]);
  });

  test('the same table and recording from both combine with both as sources', () => {
    const scion = casting(magus({ charisma: 16 }), 'magus');
    expect(scion).toMatchObject({ type: 'spontaneous', record: 'known' });
    for (const key of ['table', 'recording'])
      expect(property(scion, key)).toMatchObject({
        status: 'changed',
        sources: [
          { entryId: 'magus-eldritch-scion-row', name: 'Eldritch Scion' },
          { entryId: 'magus-mindblade-row', name: 'Mindblade' },
        ],
      });
    // CRB Table 3–4, bard 5: 6/4/3 spells known at 0–2.
    expect(scion?.slots.map((slot) => slot.known)).toEqual([6, 4, 3]);
  });

  test('Mindblade’s psychic kind is a sole replacement; Eldritch Scion inherits arcane', () => {
    const input = magus({ charisma: 16 }, [arcaneStrike]);
    const result = calculateCharacterSheet(input);
    expect(result.spellcastings[0]?.spellKind).toBe('psychic');
    expect(property(result.spellcastings[0], 'spellKind')).toMatchObject({
      status: 'changed',
      sources: [{ entryId: 'magus-mindblade-row', name: 'Mindblade' }],
      candidates: [],
    });
    expect(result.spellcastings[0]?.unresolved).toEqual([]);
    // CRB p. 118: Arcane Strike needs arcane spells, which a mindblade lacks.
    expect(currentPrerequisites(input, 'arcane-strike-row')).toEqual([false]);
    expect(
      result.warnings
        .filter((warning) => warning.check.startsWith('archetypeCasting'))
        .map(({ check, subject }) => [check, subject]),
    ).toEqual([]);
    const scion = build({
      classes: [['magus', 5]],
      scores: { charisma: 16 },
      archetypes: [{ key: 'magus-eldritch-scion' }],
      entries: [arcaneStrike],
    });
    expect(casting(scion, 'magus')?.spellKind).toBe('arcane');
    expect(currentPrerequisites(scion, 'arcane-strike-row')).toEqual([true]);
  });
});

describe('#238 case 4: compatible changes combine', () => {
  const witch = (keys: string[]) =>
    build({
      classes: [['witch', 5]],
      scores: { charisma: 16 },
      archetypes: keys.map((key) => ({ key })),
    });

  test('Seducer’s ability and Ley Line Guardian’s table and recording combine in either order', () => {
    const forward = casting(
      witch(['witch-seducer', 'witch-ley-line-guardian']),
      'witch',
    );
    const reverse = casting(
      witch(['witch-ley-line-guardian', 'witch-seducer']),
      'witch',
    );
    expect(reverse).toEqual(forward);
    expect(forward).toMatchObject({
      ability: 'charisma',
      type: 'spontaneous',
      record: 'known',
      spellKind: 'arcane',
      unresolved: [],
    });
    // CRB Table 3–15, sorcerer 5: cantrips at will, 6/4 per day at 1st–2nd
    // and 6/4/2 known at 0–2.
    expect(forward?.slots.map((slot) => slot.base)).toEqual([null, 6, 4]);
    expect(forward?.slots.map((slot) => slot.known)).toEqual([6, 4, 2]);
  });

  test('their shared 1st- and 8th-level hexes still warn as an advisory compatibility conflict', () => {
    const result = calculateCharacterSheet(
      witch(['witch-seducer', 'witch-ley-line-guardian']),
    );
    expect(
      result.archetypes.conflicts.map(({ featureIdentity, part }) => [
        featureIdentity,
        part,
      ]),
    ).toEqual([
      ['witch-hex', '1'],
      ['witch-hex', '8'],
    ]);
    expect(
      result.warnings.filter(
        (warning) => warning.check === 'archetypeConflict',
      ),
    ).toHaveLength(2);
  });
});

describe('#238 case 5: a conflicting property waits for the player', () => {
  // MTT p. 26 Questioner: arcane, bard list. OA p. 119 Psychic Detective:
  // psychic, psychic list plus its own spell levels.
  const investigator = (
    choices: { questioner?: string[]; detective?: string[] } = {},
  ) =>
    build({
      classes: [['investigator', 7]],
      scores: { intelligence: 16 },
      archetypes: [
        { key: 'investigator-questioner', choices: choices.questioner },
        { key: 'investigator-psychic-detective', choices: choices.detective },
      ],
      entries: [
        recordedSpell('daylight', 'investigator', null),
        recordedSpell('fireball', 'investigator', null),
        arcaneStrike,
      ],
    });

  test('the list and kind wait; compatible ability, table and recording apply', () => {
    const input = investigator();
    const result = calculateCharacterSheet(input);
    const detective = result.spellcastings[0];
    expect(detective?.spellList.classTag).toBeNull();
    expect(detective?.spellKind).toBeNull();
    expect(detective?.unresolved).toEqual(['spellKind', 'spellList']);
    expect(detective).toMatchObject({
      ability: 'intelligence',
      type: 'spontaneous',
      record: 'known',
    });
    // Slots, DCs and caster level do not depend on the list or kind.
    expect(detective?.casterLevel?.total).toBe(7);
    expect(detective?.slots[2]?.dc.total).toBe(15);
    // Both restate Intelligence, which is not a change.
    expect(property(detective, 'ability')).toBeUndefined();
    // Psychic Detective's own spell levels combine with either list, so
    // Daylight keeps its 3rd level. Fireball's place waits for the list
    // choice: no invented level and no warning.
    expect(
      result.spellCollections.collections[0]?.spells.map(
        ({ name, spellLevel, offList }) => [name, spellLevel, offList],
      ),
    ).toEqual([
      ['Daylight', 3, false],
      ['Fireball', null, false],
    ]);
    expect(
      result.warnings.filter(
        (warning) => warning.subject === 'fireball-recorded',
      ),
    ).toEqual([]);
    expect(currentPrerequisites(input, 'arcane-strike-row')).toEqual([null]);
    expect(
      result.warnings
        .filter((warning) => warning.check === 'archetypeCastingChoiceMissing')
        .map((warning) => warning.subject),
    ).toEqual([
      'investigator:castingChoice:spellKind',
      'investigator:castingChoice:spellList',
    ]);
  });

  test('a saved list choice keeps the other property waiting', () => {
    const input = investigator({ questioner: ['spellList'] });
    const result = calculateCharacterSheet(input);
    const questioner = result.spellcastings[0];
    expect(questioner?.spellList.classTag).toBe('bard');
    expect(questioner?.unresolved).toEqual(['spellKind']);
    expect(property(questioner, 'spellList')).toMatchObject({
      status: 'chosen',
      chosenEntryId: 'investigator-questioner-row',
    });
    // Fireball is on no bard list: off-list at its recorded level.
    expect(
      result.spellCollections.collections[0]?.spells.map(
        ({ name, offList }) => [name, offList],
      ),
    ).toEqual([
      ['Daylight', false],
      ['Fireball', true],
    ]);
    expect(currentPrerequisites(input, 'arcane-strike-row')).toEqual([null]);
  });

  test('choosing Psychic Detective for both uses its own spell levels', () => {
    const input = investigator({ detective: ['spellKind', 'spellList'] });
    const detective = casting(input, 'investigator');
    expect(detective?.spellKind).toBe('psychic');
    expect(detective?.spellList.classTag).toBe('psychic');
    expect(
      detective?.spellList.added.map(({ ruleIdentity, spellLevel }) => [
        ruleIdentity,
        spellLevel,
      ]),
    ).toContainEqual(['representative-spell-daylight', 3]);
    expect(currentPrerequisites(input, 'arcane-strike-row')).toEqual([false]);
  });
});

describe('#238 case 6: Skirmisher’s removal against Dandy’s changes', () => {
  // APG p. 128 Skirmisher removes spells; UI p. 41 Dandy alters them.
  const ranger = (choices: { skirmisher?: string[]; dandy?: string[] } = {}) =>
    build({
      classes: [['ranger', 8]],
      scores: { charisma: 14, wisdom: 12 },
      archetypes: [
        { key: 'ranger-skirmisher', choices: choices.skirmisher },
        { key: 'ranger-dandy', choices: choices.dandy },
      ],
      entries: [recordedSpell('daylight', 'ranger', 3)],
    });

  test('is a whole-package conflict left unresolved without removing casting', () => {
    const result = calculateCharacterSheet(ranger());
    expect(result.spellcastings[0]).toMatchObject({
      classEntryId: 'ranger',
      ability: null,
      type: null,
      record: null,
      casterLevel: null,
      concentration: null,
      castableSpellLevels: [],
      slots: [],
    });
    expect(result.spellcastings[0]?.unresolved).toContain('presence');
    // The recording waits too, so the collection has no heading.
    expect(result.spellCollections.collections[0]?.heading).toBeNull();
    expect(result.spellcastings[0]?.castingProperties).toEqual([
      expect.objectContaining({
        key: 'presence',
        status: 'unresolved',
        candidates: [
          {
            entryId: 'ranger-dandy-row',
            name: 'Dandy',
            value: 'Keeps spellcasting',
          },
          {
            entryId: 'ranger-skirmisher-row',
            name: 'Skirmisher',
            value: 'Removes spellcasting',
          },
        ],
      }),
    ]);
    // Recorded Spells stay under the Spellcasting without warnings.
    expect(result.spellCollections.spellsWithoutSpellcasting).toEqual([]);
    expect(result.spellCollections.collections[0]?.spells).toHaveLength(1);
    expect(
      result.warnings.filter(
        (warning) => warning.subject === 'daylight-recorded',
      ),
    ).toEqual([]);
  });

  test('choosing Skirmisher removes the whole package and orphans recorded Spells', () => {
    const result = calculateCharacterSheet(
      ranger({ skirmisher: ['presence'] }),
    );
    expect(result.spellcastings).toEqual([]);
    expect(result.spellCollections.spellsWithoutSpellcasting).toEqual([
      expect.objectContaining({ entryId: 'daylight-recorded' }),
    ]);
    expect(result.archetypeCastings).toEqual([
      expect.objectContaining({ classEntryId: 'ranger', presence: 'removed' }),
    ]);
  });

  test('choosing Dandy applies its whole casting change', () => {
    const dandy = casting(ranger({ dandy: ['presence'] }), 'ranger');
    expect(dandy).toMatchObject({
      ability: 'charisma',
      type: 'spontaneous',
      record: 'known',
      spellKind: 'divine',
    });
    expect(dandy?.spellList.classTag).toBe('bard');
    // A medium of 8th level knows 1st- and 2nd-level spells.
    expect(dandy?.castableSpellLevels).toEqual([0, 1, 2]);
  });
});

describe('#238 case 7: Spells, warnings and prestige use effective casting', () => {
  test('recorded Spells return under Dandy’s Spellcasting when Skirmisher is turned off', () => {
    const result = calculateCharacterSheet(
      build({
        classes: [['ranger', 8]],
        archetypes: [
          { key: 'ranger-skirmisher', choices: ['presence'], active: false },
          { key: 'ranger-dandy' },
        ],
        entries: [
          recordedSpell('daylight', 'ranger', 3),
          recordedSpell('detect-evil', 'ranger', 1),
        ],
      }),
    );
    expect(result.spellCollections.spellsWithoutSpellcasting).toEqual([]);
    const byName = Object.fromEntries(
      result.spellCollections.collections[0]?.spells.map((spell) => [
        spell.name,
        spell,
      ]) ?? [],
    );
    // Daylight is a 3rd-level bard spell; Detect Evil is on no bard list.
    expect(byName.Daylight).toMatchObject({ spellLevel: 3, offList: false });
    expect(byName['Detect Evil']).toMatchObject({ offList: true });
  });

  test('Mindblade’s psychic magus no longer qualifies for an arcane Mystic Theurge advance', () => {
    // CRB pp. 387–388: each Mystic Theurge level advances one arcane and one
    // divine class.
    const advance = (archetype: string) =>
      calculateCharacterSheet(
        build({
          classes: [
            ['magus', 5],
            ['cleric', 5],
            ['mystic-theurge', 1],
          ],
          archetypes: [{ key: archetype }],
        }),
      ).castingAdvances.find((row) => row.kind === 'arcane');
    expect(advance('magus-eldritch-scion')).toMatchObject({
      eligibleClassEntryIds: ['magus'],
      targetClassEntryId: 'magus',
    });
    expect(advance('magus-mindblade')).toMatchObject({
      eligibleClassEntryIds: [],
      targetClassEntryId: null,
    });
  });

  test('Skirmisher’s ranger no longer qualifies for a divine advance', () => {
    const divine = (archetypes: Selected[]) =>
      calculateCharacterSheet(
        build({
          classes: [
            ['ranger', 5],
            ['cleric', 3],
            ['mystic-theurge', 1],
          ],
          archetypes,
        }),
      ).castingAdvances.find((row) => row.kind === 'divine');
    expect(divine([])).toMatchObject({
      eligibleClassEntryIds: ['ranger', 'cleric'],
      targetClassEntryId: null,
    });
    expect(divine([{ key: 'ranger-skirmisher' }])).toMatchObject({
      eligibleClassEntryIds: ['cleric'],
      targetClassEntryId: 'cleric',
    });
  });
});
