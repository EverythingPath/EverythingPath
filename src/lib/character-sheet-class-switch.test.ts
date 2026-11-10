import { expect, test } from 'vitest';
import { representativeArchetypeCatalog } from '../../convex/lib/representativeArchetypeCatalog';
import {
  representativeClassCatalog,
  representativeClassCounterparts,
  representativeClassFeatureSchedules,
} from '../../convex/lib/representativeClassCatalog';
import { representativeSelectionCatalog } from '../../convex/lib/representativeSelectionCatalog';
import { representativeGrantedSpellCatalog } from '../../convex/lib/representativeSpellcastingCatalog';
import { representativeSpellCatalog } from '../../convex/lib/representativeSpellCatalog';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from './character-sheet';
import {
  applyClassSwitch,
  describeClassSwitch,
  planClassSwitch,
} from './character-sheet-class-switch';
import { warningsForAcceptanceThroughDormancy } from './character-sheet-dormant-acceptance';

// Seeded CRB Fighter (p. 56), Wizard (p. 80) and Mystic Theurge (pp. 387–388)
// definitions, the CRB Weapon Focus feat (p. 136) and the Unchained Rogue.
function seededClass(identity: string): CharacterSheetCatalogEntry {
  const seed = representativeClassCatalog.find(
    (row) => row.ruleIdentity === identity,
  );
  if (!seed) throw new Error(`Missing ${identity}`);
  const counterpart = representativeClassCounterparts[identity];
  return {
    ...seed,
    _id: identity,
    detail: {
      ...seed.detail,
      ...(counterpart ? { counterpartOf: counterpart } : {}),
      featuresByLevel: representativeClassFeatureSchedules[identity] ?? [],
    },
  };
}

/**
 * A Character's own Catalog Copy of a seeded class, as Detach makes it, with
 * the edits the definition editor can save: a homebrew Fighter without the
 * 2nd-level bonus feat or Bravery, for example.
 */
function characterCopy(
  original: CharacterSheetCatalogEntry,
  id: string,
  withoutFeatures: readonly string[] = [],
): CharacterSheetCatalogEntry {
  if (original.detail?.kind !== 'class' || !('hitDie' in original.detail))
    throw new Error('Not a class');
  return {
    ...original,
    _id: id,
    detail: {
      ...original.detail,
      featuresByLevel: (original.detail.featuresByLevel ?? []).filter(
        (row) => !withoutFeatures.includes(row.catalogEntryId),
      ),
    },
  };
}

// CRB p. 250: Burning Hands, a 1st-level sorcerer/wizard Spell (seeded).
const burningHands = (() => {
  const seed = representativeGrantedSpellCatalog.find(
    (row) => row.name === 'Burning Hands',
  );
  if (!seed) throw new Error('Missing Burning Hands');
  return { ...seed, _id: 'burning-hands' };
})();

// APG/Unchained: Haste, summoner 2 and Unchained summoner 3 (seeded import).
const haste = (() => {
  const seed = representativeSpellCatalog.find((row) => row.name === 'Haste');
  if (!seed) throw new Error('Missing Haste');
  return {
    _id: 'haste',
    name: seed.name,
    ruleIdentity: seed.externalKey,
    modifiers: [],
    detail: {
      kind: 'spell' as const,
      levels: seed.detail.levels,
      school: seed.detail.school,
    },
  };
})();

const weaponFocus = (() => {
  const seed = representativeSelectionCatalog.find(
    (row) => row.ruleIdentity === 'weapon-focus',
  );
  if (!seed) throw new Error('Missing Weapon Focus');
  return { ...seed, _id: 'weapon-focus' };
})();

function level(
  id: string,
  classEntryId: string,
  position: number,
  state: Partial<Extract<SheetEntry, { kind: 'classLevel' }>['state']> = {},
): SheetEntry {
  return {
    _id: id,
    kind: 'classLevel',
    active: true,
    state: {
      kind: 'classLevel',
      classEntryId,
      position,
      hpGained: 10,
      ...state,
    },
  };
}

function fighterSheet(): CharacterSheetInput {
  const fighter = seededClass('fighter');
  return {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base', favoredClassIds: ['fighter'] },
      },
      level('level-1', 'fighter', 1, {
        favoredClassBonus: { choice: 'hp' },
        skillRanks: { 'skill.clm': 1 },
      }),
      level('level-2', 'fighter', 2, {
        hpGained: 12,
        skillRanks: { 'skill.swm': 1 },
      }),
      {
        _id: 'bravery-state',
        kind: 'classFeature',
        active: true,
        catalogEntryId: 'fighter-bravery-2',
        grantKey: {
          source: 'fighter',
          classLevel: 2,
          entry: 'fighter-bravery-2',
        },
        notes: 'Fearless',
        state: { kind: 'classFeature' },
      },
      {
        _id: 'bonus-focus',
        kind: 'feat',
        active: true,
        catalogEntryId: 'weapon-focus',
        notes: 'Longsword',
        state: { kind: 'feat', choice: 'longsword' },
        selectionSource: {
          kind: 'slot',
          grantedBy: {
            kind: 'grant',
            grantKey: {
              source: 'fighter',
              classLevel: 2,
              entry: 'fighter-bonus-feat-2',
            },
          },
        },
      },
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((key) => ({
          target: abilityTargets[key],
          bonusType: 'base',
          value: 10,
        })),
      },
      fighter,
      characterCopy(fighter, 'fighter-copy'),
      characterCopy(fighter, 'fighter-homebrew', [
        'fighter-bonus-feat-2',
        'fighter-bravery-2',
      ]),
      seededClass('rogue'),
      seededClass('unchained-rogue'),
      weaponFocus,
      ...representativeArchetypeCatalog,
    ],
  };
}

test('choosing another copy of a class plans one switch of every level of that class only', () => {
  const input = fighterSheet();
  input.entries = [...input.entries, level('level-3', 'rogue', 3)];
  expect(
    planClassSwitch({
      ...input,
      entryId: 'level-2',
      classEntryId: 'fighter-copy',
    }),
  ).toEqual({
    kind: 'switch',
    toId: 'fighter-copy',
    levelIds: ['level-1', 'level-2'],
    copyIds: ['fighter'],
    versionIds: [],
  });
  expect(
    planClassSwitch({ ...input, entryId: 'level-1', classEntryId: 'fighter' }),
  ).toEqual({ kind: 'unchanged' });
  expect(
    planClassSwitch({ ...input, entryId: 'level-3', classEntryId: 'fighter' }),
  ).toEqual({ kind: 'refused', reason: 'unrelated' });
  expect(
    planClassSwitch({
      ...input,
      entryId: 'level-3',
      classEntryId: 'unchained-rogue',
    }),
  ).toEqual({
    kind: 'switch',
    toId: 'unchained-rogue',
    levelIds: ['level-3'],
    copyIds: [],
    versionIds: ['rogue'],
  });
  expect(
    planClassSwitch({
      ...input,
      entryId: 'bravery-state',
      classEntryId: 'fighter-copy',
    }),
  ).toEqual({ kind: 'refused', reason: 'notClassLevel' });
});

test('levels already split across copies of one class all move to the chosen copy', () => {
  const input = fighterSheet();
  input.entries = input.entries.map((entry) =>
    entry._id === 'level-2' && entry.kind === 'classLevel'
      ? { ...entry, state: { ...entry.state, classEntryId: 'fighter-copy' } }
      : entry,
  );
  expect(
    planClassSwitch({
      ...input,
      entryId: 'level-1',
      classEntryId: 'fighter-homebrew',
    }),
  ).toMatchObject({
    kind: 'switch',
    copyIds: ['fighter', 'fighter-copy'],
    levelIds: ['level-1', 'level-2'],
  });
});

test('choosing the version a level already uses unifies levels recorded with the other version', () => {
  const input = fighterSheet();
  input.entries = [
    level('rogue-1', 'unchained-rogue', 1),
    level('rogue-2', 'rogue', 2),
  ];
  const plan = planClassSwitch({
    ...input,
    entryId: 'rogue-1',
    classEntryId: 'unchained-rogue',
  });
  expect(plan).toEqual({
    kind: 'switch',
    toId: 'unchained-rogue',
    levelIds: ['rogue-1', 'rogue-2'],
    copyIds: [],
    versionIds: ['rogue'],
  });
  expect(applyClassSwitch(input.entries, plan)).toEqual([
    level('rogue-1', 'unchained-rogue', 1),
    level('rogue-2', 'unchained-rogue', 2),
  ]);
});

test('a definition switch repoints every link to the class and keeps each row and its own state', () => {
  const wizard = seededClass('wizard');
  const theurge = seededClass('mystic-theurge');
  const entries: SheetEntry[] = [
    {
      _id: 'base-row',
      kind: 'base',
      active: true,
      catalogEntryId: 'base',
      state: { kind: 'base', favoredClassIds: ['wizard'] },
    },
    level('wizard-1', 'wizard', 1, {
      hpGained: 6,
      skillRanks: { 'skill.kar': 1 },
      abilityIncrease: 'intelligence',
      favoredClassBonus: { choice: 'skill' },
    }),
    level('theurge-1', 'mystic-theurge', 2, {
      hpGained: 4,
      castingAdvances: [{ classEntryId: 'wizard' }, null],
    }),
    {
      _id: 'recorded-spell',
      kind: 'spell',
      active: true,
      catalogEntryId: 'burning-hands',
      state: { kind: 'spell', castingClassId: 'wizard', level: 1 },
    },
  ];
  const catalogEntries = [
    wizard,
    characterCopy(wizard, 'wizard-copy'),
    theurge,
    burningHands,
  ];
  const plan = planClassSwitch({
    entries,
    catalogEntries,
    entryId: 'wizard-1',
    classEntryId: 'wizard-copy',
  });
  expect(applyClassSwitch(entries, plan)).toEqual([
    {
      ...entries[0],
      state: { kind: 'base', favoredClassIds: ['wizard-copy'] },
    },
    level('wizard-1', 'wizard-copy', 1, {
      hpGained: 6,
      skillRanks: { 'skill.kar': 1 },
      abilityIncrease: 'intelligence',
      favoredClassBonus: { choice: 'skill' },
    }),
    level('theurge-1', 'mystic-theurge', 2, {
      hpGained: 4,
      castingAdvances: [{ classEntryId: 'wizard-copy' }, null],
    }),
    {
      ...entries[3],
      state: { kind: 'spell', castingClassId: 'wizard-copy', level: 1 },
    },
  ]);
  // The rows passed in are never changed.
  expect(entries[1]).toEqual(
    level('wizard-1', 'wizard', 1, {
      hpGained: 6,
      skillRanks: { 'skill.kar': 1 },
      abilityIncrease: 'intelligence',
      favoredClassBonus: { choice: 'skill' },
    }),
  );
});

test('an original or Unchained version switch changes only the levels of the class family', () => {
  const entries: SheetEntry[] = [
    level('summoner-1', 'summoner', 1),
    {
      _id: 'recorded-haste',
      kind: 'spell',
      active: true,
      catalogEntryId: 'haste',
      state: { kind: 'spell', castingClassId: 'summoner', level: 2 },
    },
  ];
  const plan = planClassSwitch({
    entries,
    catalogEntries: [
      seededClass('summoner'),
      seededClass('unchained-summoner'),
      haste,
    ],
    entryId: 'summoner-1',
    classEntryId: 'unchained-summoner',
  });
  expect(applyClassSwitch(entries, plan)).toEqual([
    level('summoner-1', 'unchained-summoner', 1),
    entries[1],
  ]);
});

test('the switch description names levels kept, statistics changed, entries going dormant or returning and warnings reopened', () => {
  const input = fighterSheet();
  const before = calculateCharacterSheet(input);
  const hpWarning = before.warnings.find(
    (warning) =>
      warning.check === 'hpGainedAboveMaximum' && warning.kind === 'rules',
  );
  if (hpWarning?.kind !== 'rules') throw new Error('Missing HP warning');
  const acceptedWarnings = [
    {
      check: hpWarning.check,
      subject: hpWarning.subject,
      fingerprint: hpWarning.fingerprint,
    },
  ];
  function switchTo(entries: readonly SheetEntry[], classEntryId: string) {
    const plan = planClassSwitch({
      entries,
      catalogEntries: input.catalogEntries,
      entryId: 'level-1',
      classEntryId,
    });
    return applyClassSwitch(entries, plan);
  }
  const copied = switchTo(input.entries, 'fighter-copy');
  expect(
    describeClassSwitch({
      before,
      after: calculateCharacterSheet({ ...input, entries: copied }),
      acceptedWarnings,
      catalogEntries: input.catalogEntries,
      levelIds: ['level-1', 'level-2'],
    }),
  ).toEqual({
    levelIds: ['level-1', 'level-2'],
    statistics: [],
    dormant: [],
    restored: [],
    keptWarnings: [
      { check: 'hpGainedAboveMaximum', subject: hpWarning.subject },
    ],
    reopenedWarnings: [],
    clearedWarnings: [],
  });
  const homebrew = switchTo(copied, 'fighter-homebrew');
  const afterHomebrew = calculateCharacterSheet({
    ...input,
    entries: homebrew,
  });
  const description = describeClassSwitch({
    before: calculateCharacterSheet({ ...input, entries: copied }),
    after: afterHomebrew,
    acceptedWarnings,
    catalogEntries: input.catalogEntries,
    levelIds: ['level-1', 'level-2'],
  });
  expect(description.dormant).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: 'Bravery +1',
        storedEntryId: 'bravery-state',
      }),
      expect.objectContaining({
        name: 'Weapon Focus',
        storedEntryId: 'bonus-focus',
      }),
    ]),
  );
  expect(description.restored).toEqual([]);
  // Dormant entries keep their rows.
  expect(homebrew.map((entry) => entry._id)).toEqual(
    input.entries.map((entry) => entry._id),
  );
  const back = describeClassSwitch({
    before: afterHomebrew,
    after: calculateCharacterSheet({
      ...input,
      entries: switchTo(homebrew, 'fighter'),
    }),
    acceptedWarnings,
    catalogEntries: input.catalogEntries,
    levelIds: ['level-1', 'level-2'],
  });
  expect(back.restored).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ storedEntryId: 'bravery-state' }),
      expect.objectContaining({ storedEntryId: 'bonus-focus' }),
    ]),
  );
  expect(back.dormant).toEqual([]);
});

test('a copy with another hit die changes HP facts, so an accepted HP warning reopens or clears', () => {
  const input = fighterSheet();
  const fighter = seededClass('fighter');
  if (fighter.detail?.kind !== 'class') throw new Error('Not a class');
  // A homebrew Fighter saved with a d12 Hit Die through the definition editor.
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      ...characterCopy(fighter, 'fighter-d12'),
      detail: { ...fighter.detail, hitDie: 12 },
    },
  ];
  function withLevelTwoHp(hpGained: number) {
    return input.entries.map((entry) =>
      entry._id === 'level-2' && entry.kind === 'classLevel'
        ? { ...entry, state: { ...entry.state, hpGained } }
        : entry,
    );
  }
  input.entries = withLevelTwoHp(13);
  const before = calculateCharacterSheet(input);
  const hpWarning = before.warnings.find(
    (warning) =>
      warning.check === 'hpGainedAboveMaximum' && warning.kind === 'rules',
  );
  if (hpWarning?.kind !== 'rules') throw new Error('Missing HP warning');
  const acceptedWarnings = [
    {
      check: hpWarning.check,
      subject: hpWarning.subject,
      fingerprint: hpWarning.fingerprint,
    },
  ];
  const plan = planClassSwitch({
    ...input,
    entryId: 'level-2',
    classEntryId: 'fighter-d12',
  });
  const describe = (entries: readonly SheetEntry[]) =>
    describeClassSwitch({
      before,
      after: calculateCharacterSheet({
        ...input,
        entries: applyClassSwitch(entries, plan),
      }),
      acceptedWarnings,
      catalogEntries: input.catalogEntries,
      levelIds: ['level-1', 'level-2'],
    });
  // 13 HP still exceeds a d12, but against another maximum: it reopens.
  expect(describe(input.entries)).toMatchObject({
    keptWarnings: [],
    reopenedWarnings: [
      { check: 'hpGainedAboveMaximum', subject: hpWarning.subject },
    ],
    clearedWarnings: [],
  });
  // 11 HP no longer exceeds a d12, so the accepted warning no longer applies.
  expect(describe(withLevelTwoHp(11))).toMatchObject({
    keptWarnings: [],
    reopenedWarnings: [],
    clearedWarnings: [
      { check: 'hpGainedAboveMaximum', subject: hpWarning.subject },
    ],
  });
});

test('an accepted Prestige favored-class warning stays accepted when the Prestige Class switches to its copy', () => {
  // CRB pp. 387–388: Mystic Theurge, recorded as favored against the advice.
  const theurge = seededClass('mystic-theurge');
  const input: CharacterSheetInput = {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base', favoredClassIds: ['mystic-theurge'] },
      },
      level('theurge-1', 'mystic-theurge', 1, { hpGained: 6 }),
    ],
    catalogEntries: [
      fighterSheet().catalogEntries[0]!,
      theurge,
      characterCopy(theurge, 'theurge-copy'),
    ],
  };
  const before = calculateCharacterSheet(input);
  const warning = before.warnings.find(
    (row) => row.check === 'favoredClassPrestige',
  );
  if (warning?.kind !== 'rules') throw new Error('Missing warning');
  const plan = planClassSwitch({
    ...input,
    entryId: 'theurge-1',
    classEntryId: 'theurge-copy',
  });
  const description = describeClassSwitch({
    before,
    after: calculateCharacterSheet({
      ...input,
      entries: applyClassSwitch(input.entries, plan),
    }),
    acceptedWarnings: [warning],
    catalogEntries: input.catalogEntries,
    levelIds: ['theurge-1'],
  });
  expect(description.keptWarnings).toEqual([
    { check: 'favoredClassPrestige', subject: warning.subject },
  ]);
});

test('a duplicate’s acceptance stays while the bonus-feat Selection it counts is dormant', () => {
  const input = fighterSheet();
  // CRB p. 136: the same Weapon Focus (longsword) again as a general feat.
  input.entries = [
    ...input.entries,
    {
      _id: 'general-focus',
      kind: 'feat',
      active: true,
      catalogEntryId: 'weapon-focus',
      state: { kind: 'feat', choice: 'longsword', slot: 'general' },
    },
  ];
  const before = calculateCharacterSheet(input);
  const duplicate = before.warnings.find(
    (row) => row.check === 'featDuplicate',
  );
  if (!duplicate) throw new Error('Missing duplicate warning');
  const describe = (entries: readonly SheetEntry[]) => {
    const plan = planClassSwitch({
      entries,
      catalogEntries: input.catalogEntries,
      entryId: 'level-1',
      classEntryId: 'fighter-homebrew',
    });
    const switched = applyClassSwitch(entries, plan);
    const after = calculateCharacterSheet({ ...input, entries: switched });
    return describeClassSwitch({
      before: calculateCharacterSheet({ ...input, entries }),
      after: {
        ...after,
        warningsForAcceptance: warningsForAcceptanceThroughDormancy({
          entries: switched,
          calculated: after,
          calculate: (revived) =>
            calculateCharacterSheet({ ...input, entries: revived })
              .warningsForAcceptance,
        }),
      },
      acceptedWarnings: [duplicate],
      catalogEntries: input.catalogEntries,
      levelIds: ['level-1', 'level-2'],
    });
  };
  expect(describe(input.entries)).toMatchObject({
    dormant: expect.arrayContaining([
      expect.objectContaining({ storedEntryId: 'bonus-focus' }),
    ]),
    keptWarnings: [{ check: 'featDuplicate', subject: duplicate.subject }],
  });
  // Without the dormancy rule the duplicate would simply have cleared.
  const plainAfter = calculateCharacterSheet({
    ...input,
    entries: applyClassSwitch(
      input.entries,
      planClassSwitch({
        ...input,
        entryId: 'level-1',
        classEntryId: 'fighter-homebrew',
      }),
    ),
  });
  expect(
    plainAfter.warningsForAcceptance.some(
      (row) => row.check === 'featDuplicate',
    ),
  ).toBe(false);
});
