import { expect, test } from 'vitest';
import {
  representativeClassCatalog,
  representativeClassFeatureSchedules,
} from '../../convex/lib/representativeClassCatalog';
import { representativeArchetypeCatalog } from '../../convex/lib/representativeArchetypeCatalog';
import { representativeGrantedSpellCatalog } from '../../convex/lib/representativeSpellcastingCatalog';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from './character-sheet';
import { findReviewedClassCasting } from './character-sheet-casting-tables';

type ClassLevel = Extract<SheetEntry, { kind: 'classLevel' }>;
type Advances = ClassLevel['state']['castingAdvances'];
type Sheet = Omit<CharacterSheetInput, 'entries' | 'catalogEntries'> & {
  entries: SheetEntry[];
  catalogEntries: CharacterSheetCatalogEntry[];
};

/** Class Levels in the listed order; ids are `<class>-<class level>`. */
function sheet(
  levels: readonly (string | [string, Advances])[],
  entries: SheetEntry[] = [],
): Sheet {
  const counts = new Map<string, number>();
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
      ...levels.map((level, index): SheetEntry => {
        const [classEntryId, castingAdvances] =
          typeof level === 'string' ? [level, undefined] : level;
        const count = (counts.get(classEntryId) ?? 0) + 1;
        counts.set(classEntryId, count);
        return {
          _id: `${classEntryId}-${count}`,
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            position: index + 1,
            classEntryId,
            hpGained: 4,
            ...(castingAdvances ? { castingAdvances } : {}),
          },
        };
      }),
      ...entries,
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base',
          value: 10,
        })),
      },
      ...representativeClassCatalog.map((definition) => ({
        ...definition,
        _id: definition.ruleIdentity,
        detail: {
          ...definition.detail,
          featuresByLevel:
            representativeClassFeatureSchedules[definition.ruleIdentity] ?? [],
        },
      })),
      {
        _id: 'paladin',
        name: 'Paladin',
        ruleIdentity: 'paladin',
        modifiers: [],
        detail: {
          kind: 'class',
          classKind: 'base',
          hitDie: 10,
          bab: 'full',
          saves: { fort: 'good', ref: 'poor', will: 'good' },
          skillRanksPerLevel: 2,
          casting: findReviewedClassCasting('paladin'),
        },
      },
      ...representativeArchetypeCatalog,
      ...representativeGrantedSpellCatalog.map((definition) => ({
        ...definition,
        _id: definition.ruleIdentity,
      })),
      {
        _id: 'charm-person',
        name: 'Charm Person',
        ruleIdentity: 'charm-person',
        modifiers: [],
        detail: {
          kind: 'spell',
          levels: { bard: 1, sorcerer: 1, wizard: 1 },
          school: 'enc',
        },
      },
    ],
  };
}

function choose(
  catalogEntryId: string,
  classIdentity: string,
  feature: string,
  list: string,
  extra: Partial<Extract<SheetEntry, { kind: 'classFeature' }>['state']> = {},
): SheetEntry {
  return {
    _id: `chosen-${catalogEntryId}`,
    kind: 'classFeature',
    active: true,
    catalogEntryId,
    selectionSource: {
      kind: 'prompt',
      source: {
        kind: 'grant',
        grantKey: { source: classIdentity, classLevel: 1, entry: feature },
      },
      list,
      classLevel: 1,
    },
    state: { kind: 'classFeature', ...extra },
  };
}
const fire = choose('domain-fire', 'cleric', 'cleric-domains', 'Domains');
const sun = choose('domain-sun', 'cleric', 'cleric-domains', 'Domains');
const draconic = choose(
  'bloodline-draconic',
  'sorcerer',
  'sorcerer-bloodline',
  'Bloodlines',
);
const evocation = (oppositionSchools?: ('enc' | 'nec' | 'evo' | 'ill')[]) =>
  choose(
    'school-evocation',
    'wizard',
    'wizard-arcane-school',
    'Arcane schools',
    oppositionSchools ? { oppositionSchools } : {},
  );
function repeat(identity: string, count: number) {
  return Array.from({ length: count }, () => identity);
}
function casting(
  result: ReturnType<typeof calculateCharacterSheet>,
  tag: string,
) {
  const found = result.spellcastings.find((row) => row.classTag === tag);
  if (!found) throw new Error(`Missing ${tag} Spellcasting`);
  return found;
}
function warningsFor(
  result: ReturnType<typeof calculateCharacterSheet>,
  checks: readonly string[],
) {
  return result.warnings
    .filter((warning) => checks.includes(warning.check))
    .map(({ kind, check, subject, message }) => ({
      kind,
      check,
      subject,
      message,
    }));
}

// CRB p. 387: each Mystic Theurge level adds one arcane and one divine level.
test('Mystic Theurge pre-fills its only eligible arcane and divine classes and advances both', () => {
  const result = calculateCharacterSheet(
    sheet([
      ...repeat('wizard', 3),
      ...repeat('cleric', 3),
      ...repeat('mystic-theurge', 2),
    ]),
  );
  expect(
    result.castingAdvances.map((advance) => [
      advance.entryId,
      advance.kind,
      advance.targetClassEntryId,
      advance.prefilled,
      advance.eligibleClassEntryIds,
    ]),
  ).toEqual([
    ['mystic-theurge-1', 'arcane', 'wizard', true, ['wizard']],
    ['mystic-theurge-1', 'divine', 'cleric', true, ['cleric']],
    ['mystic-theurge-2', 'arcane', 'wizard', true, ['wizard']],
    ['mystic-theurge-2', 'divine', 'cleric', true, ['cleric']],
  ]);
  const wizard = casting(result, 'wizard');
  // CRB Table 3–17: a 5th-level wizard prepares 4/3/2/1.
  expect(wizard).toMatchObject({
    classLevels: 3,
    castingLevel: 5,
    advances: [{ classEntryId: 'mystic-theurge', count: 2 }],
    pendingAdvances: 0,
    castableSpellLevels: [0, 1, 2, 3],
    casterLevel: { total: 5 },
  });
  expect(wizard.slots.map((slot) => slot.base)).toEqual([4, 3, 2, 1]);
  expect(
    wizard.casterLevel?.applied.map((row) => [row.entryName, row.value]),
  ).toEqual(
    expect.arrayContaining([
      ['Class levels', 3],
      ['Mystic Theurge', 2],
    ]),
  );
  expect(casting(result, 'cleric').casterLevel?.total).toBe(5);
  expect(
    warningsFor(result, ['castingAdvanceMissing', 'castingAdvanceTarget']),
  ).toEqual([]);
  // Advances add no Class Levels: hit dice and class levels stay as recorded.
  expect(result.level).toBe(8);
});

test('split assignments are preserved and an ambiguous advance stays empty with an outline', () => {
  const result = calculateCharacterSheet(
    sheet([
      ...repeat('wizard', 3),
      ...repeat('sorcerer', 3),
      ...repeat('cleric', 3),
      ['mystic-theurge', [{ classEntryId: 'wizard' }]],
      ['mystic-theurge', [{ classEntryId: 'sorcerer' }]],
      'mystic-theurge',
    ]),
  );
  expect(
    result.castingAdvances.map((advance) => [
      advance.entryId,
      advance.targetClassEntryId,
      advance.prefilled,
    ]),
  ).toEqual([
    ['mystic-theurge-1', 'wizard', false],
    ['mystic-theurge-1', 'cleric', true],
    ['mystic-theurge-2', 'sorcerer', false],
    ['mystic-theurge-2', 'cleric', true],
    ['mystic-theurge-3', null, false],
    ['mystic-theurge-3', 'cleric', true],
  ]);
  expect(
    result.spellcastings.map((row) => [row.classTag, row.castingLevel]),
  ).toEqual([
    ['wizard', 4],
    ['sorcerer', 4],
    ['cleric', 6],
  ]);
  expect(
    warningsFor(result, ['castingAdvanceMissing', 'castingAdvanceTarget']),
  ).toEqual([
    {
      kind: 'incomplete',
      check: 'castingAdvanceMissing',
      subject: 'mystic-theurge-3:castingAdvances:0',
      message:
        'Choose the arcane spellcasting class this Mystic Theurge level advances.',
    },
  ]);
});

test.each([
  {
    name: 'a class first taken after entry',
    levels: [
      ...repeat('wizard', 3),
      ...repeat('cleric', 3),
      'mystic-theurge',
      'sorcerer',
      ['mystic-theurge', [{ classEntryId: 'sorcerer' }]] as [string, Advances],
    ],
    entryId: 'mystic-theurge-2',
    target: 'sorcerer',
    eligible: ['wizard'],
    message:
      'Sorcerer was not taken before Mystic Theurge, so its advance does not qualify.',
  },
  {
    name: 'a divine class for an arcane advance',
    levels: [
      ...repeat('wizard', 3),
      ...repeat('cleric', 3),
      ['mystic-theurge', [{ classEntryId: 'cleric' }]] as [string, Advances],
    ],
    entryId: 'mystic-theurge-1',
    target: 'cleric',
    eligible: ['wizard'],
    message:
      'Mystic Theurge advances an arcane spellcasting class; Cleric does not cast arcane spells.',
  },
  {
    name: 'a class without spellcasting',
    levels: [
      ...repeat('fighter', 1),
      ...repeat('wizard', 3),
      ...repeat('cleric', 3),
      ['mystic-theurge', [{ classEntryId: 'fighter' }]] as [string, Advances],
    ],
    entryId: 'mystic-theurge-1',
    target: 'fighter',
    eligible: ['wizard'],
    message: 'Fighter has no spellcasting for Mystic Theurge to advance.',
  },
])(
  'recording $name keeps the choice with an acceptable warning',
  ({ levels, entryId, target, eligible, message }) => {
    const result = calculateCharacterSheet(sheet(levels));
    expect(
      result.castingAdvances.find(
        (advance) => advance.entryId === entryId && advance.index === 0,
      ),
    ).toMatchObject({
      targetClassEntryId: target,
      prefilled: false,
      eligibleClassEntryIds: eligible,
    });
    expect(warningsFor(result, ['castingAdvanceTarget'])).toEqual([
      {
        kind: 'rules',
        check: 'castingAdvanceTarget',
        subject: `${entryId}:castingAdvances:0`,
        message,
      },
    ]);
  },
);

test('an advisory assignment to an ineligible casting class still advances it', () => {
  const result = calculateCharacterSheet(
    sheet([
      ...repeat('wizard', 3),
      ...repeat('cleric', 3),
      'mystic-theurge',
      'sorcerer',
      ['mystic-theurge', [{ classEntryId: 'sorcerer' }]],
    ]),
  );
  expect(casting(result, 'sorcerer').castingLevel).toBe(2);
  expect(casting(result, 'wizard').castingLevel).toBe(4);
});

test('an explicitly cleared choice is preserved instead of pre-filled', () => {
  const result = calculateCharacterSheet(
    sheet([
      ...repeat('wizard', 3),
      ...repeat('cleric', 3),
      ['mystic-theurge', [{ classEntryId: null }, { classEntryId: null }]],
    ]),
  );
  expect(
    result.castingAdvances.map((advance) => advance.targetClassEntryId),
  ).toEqual([null, null]);
  expect(casting(result, 'wizard').castingLevel).toBe(3);
  expect(
    warningsFor(result, ['castingAdvanceMissing']).map((row) => row.subject),
  ).toEqual([
    'mystic-theurge-1:castingAdvances:0',
    'mystic-theurge-1:castingAdvances:1',
  ]);
});

test('an unrecorded advance beside a recorded one is still pre-filled', () => {
  const result = calculateCharacterSheet(
    sheet([
      ...repeat('wizard', 3),
      ...repeat('cleric', 3),
      ['mystic-theurge', [null, { classEntryId: 'cleric' }]],
    ]),
  );
  expect(
    result.castingAdvances.map((advance) => [
      advance.targetClassEntryId,
      advance.prefilled,
    ]),
  ).toEqual([
    ['wizard', true],
    ['cleric', false],
  ]);
});

// S9, read literally: an advance to a class that does not cast yet counts once it does.
test('an advance to a paladin waits until the paladin casts', () => {
  const levels = [
    ...repeat('paladin', 3),
    ...repeat('wizard', 3),
    'mystic-theurge',
  ];
  const before = casting(calculateCharacterSheet(sheet(levels)), 'paladin');
  expect(before).toMatchObject({
    classLevels: 3,
    castingLevel: 3,
    pendingAdvances: 1,
    castableSpellLevels: [],
    casterLevel: null,
  });
  const after = casting(
    calculateCharacterSheet(sheet([...levels, 'paladin'])),
    'paladin',
  );
  // CRB p. 63: caster level is paladin level − 3; the advance adds 1.
  expect(after).toMatchObject({
    classLevels: 4,
    castingLevel: 5,
    pendingAdvances: 0,
    castableSpellLevels: [1],
    casterLevel: { total: 2 },
  });
});

// CRB p. 38: one domain slot per castable level from 1st, whatever the domains.
test('two domains give one extra domain slot and their Spells at castable levels', () => {
  const result = calculateCharacterSheet(
    sheet(repeat('cleric', 5), [fire, sun]),
  );
  const cleric = casting(result, 'cleric');
  expect(cleric.extraSlots).toEqual([{ kind: 'domain', label: '+1 domain' }]);
  expect(cleric.slots.map((slot) => [slot.extra, slot.total])).toEqual([
    [0, 4],
    [1, 4],
    [1, 3],
    [1, 2],
  ]);
  expect(
    cleric.grantedSpells.map((spell) => [
      spell.spellLevel,
      spell.name,
      spell.style,
      spell.domainSlotOnly,
    ]),
  ).toEqual([
    [1, 'Burning Hands', 'slot', true],
    [1, 'Endure Elements', 'slot', false],
    [2, 'Heat Metal', 'slot', true],
    [2, 'Produce Flame', 'slot', true],
    [3, 'Fireball', 'slot', true],
    [3, 'Searing Light', 'slot', false],
  ]);
  expect(warningsFor(result, ['spellcastingChoiceMissing'])).toEqual([]);
});

// CRB pp. 38 and 77: one extra slot of each kind, so a domain and a school give two.
test('a domain and an arcane school on one Spellcasting give one extra slot each', () => {
  const wizardFire: SheetEntry = {
    _id: 'wizard-fire',
    kind: 'classFeature',
    active: true,
    catalogEntryId: 'domain-fire',
    gainedAtClassLevel: 'wizard-1',
    state: { kind: 'classFeature' },
  };
  const wizard = casting(
    calculateCharacterSheet(
      sheet(['wizard'], [evocation(['enc', 'nec']), wizardFire]),
    ),
    'wizard',
  );
  expect(wizard.extraSlots.map((slot) => slot.kind)).toEqual([
    'school',
    'domain',
  ]);
  expect(
    wizard.slots.map((slot) => [slot.base, slot.extra, slot.total]),
  ).toEqual([
    [3, 0, 3],
    [1, 2, 3],
  ]);
});

// CRB pp. 43 and 46: Fire Seeds is both domains' 6th-level Spell.
test('a Spell two domains grant at one level keeps both sources', () => {
  const cleric = casting(
    calculateCharacterSheet(sheet(repeat('cleric', 11), [fire, sun])),
    'cleric',
  );
  expect(
    cleric.grantedSpells
      .filter((spell) => spell.spellLevel >= 4)
      .map((spell) => [
        spell.spellLevel,
        spell.name,
        spell.sources.map((source) => source.name),
      ]),
  ).toEqual([
    [4, 'Fire Shield', ['Sun Domain']],
    [4, 'Wall of Fire', ['Fire Domain']],
    [5, 'Fire Shield', ['Fire Domain']],
    [5, 'Flame Strike', ['Sun Domain']],
    [6, 'Fire Seeds', ['Fire Domain', 'Sun Domain']],
  ]);
  expect(
    cleric.grantedSpells.find((spell) => spell.name === 'Fire Seeds')?.sources,
  ).toEqual([
    { entryId: 'chosen-domain-fire', name: 'Fire Domain' },
    { entryId: 'chosen-domain-sun', name: 'Sun Domain' },
  ]);
});

test('slot-style domain Spells follow levels a prestige advance makes castable', () => {
  const cleric = casting(
    calculateCharacterSheet(
      sheet(
        [
          ...repeat('wizard', 3),
          ...repeat('cleric', 3),
          ...repeat('mystic-theurge', 2),
        ],
        [fire],
      ),
    ),
    'cleric',
  );
  expect(cleric.castableSpellLevels).toEqual([0, 1, 2, 3]);
  expect(cleric.grantedSpells.map((spell) => spell.name)).toEqual([
    'Burning Hands',
    'Produce Flame',
    'Fireball',
  ]);
  expect(cleric.slots.at(-1)).toMatchObject({ spellLevel: 3, extra: 1 });
});

// CRB p. 70 and FAQ: bloodline Spells follow sorcerer levels, never advances.
test.each([
  { sorcerer: 3, expected: ['Mage Armor'] },
  { sorcerer: 5, expected: ['Mage Armor', 'Resist Energy'] },
])(
  'Sorcerer $sorcerer / Cleric 3 / Mystic Theurge 2 gains bloodline Spells by sorcerer level',
  ({ sorcerer, expected }) => {
    const result = calculateCharacterSheet(
      sheet(
        [
          ...repeat('sorcerer', sorcerer),
          ...repeat('cleric', 3),
          ...repeat('mystic-theurge', 2),
        ],
        [draconic],
      ),
    );
    const casting = result.spellcastings.find(
      (row) => row.classTag === 'sorcerer',
    );
    expect(casting?.castingLevel).toBe(sorcerer + 2);
    expect(
      casting?.grantedSpells.map((spell) => [
        spell.name,
        spell.style,
        spell.domainSlotOnly,
      ]),
    ).toEqual(expected.map((name) => [name, 'schedule', false]));
    expect(casting?.extraSlots).toEqual([]);
  },
);

// CRB p. 77: two opposition schools, never the specialty school itself.
test.each([
  {
    schools: undefined,
    warnings: [
      {
        kind: 'incomplete',
        check: 'oppositionSchoolsMissing',
        message: 'Choose two opposition schools for Evocation.',
      },
    ],
  },
  {
    schools: ['enc'] as const,
    warnings: [
      {
        kind: 'incomplete',
        check: 'oppositionSchoolsMissing',
        message: 'Choose two opposition schools for Evocation.',
      },
    ],
  },
  { schools: ['enc', 'nec'] as const, warnings: [] },
  {
    schools: ['evo', 'nec'] as const,
    warnings: [
      {
        kind: 'rules',
        check: 'oppositionSchools',
        message: 'Evocation cannot be one of its own opposition schools.',
      },
    ],
  },
  {
    schools: ['enc', 'ill', 'nec'] as const,
    warnings: [
      {
        kind: 'rules',
        check: 'oppositionSchools',
        message: 'Evocation has 3 opposition schools; a specialist chooses 2.',
      },
    ],
  },
])('opposition schools $schools', ({ schools, warnings }) => {
  const result = calculateCharacterSheet(
    sheet(['wizard'], [evocation(schools ? [...schools] : undefined)]),
  );
  expect(
    warningsFor(result, ['oppositionSchoolsMissing', 'oppositionSchools']).map(
      ({ kind, check, message }) => ({ kind, check, message }),
    ),
  ).toEqual(warnings);
  expect(casting(result, 'wizard')).toMatchObject({
    extraSlots: [{ kind: 'school', label: '+1 school (evocation)' }],
    school: {
      school: 'evo',
      name: 'Evocation',
      oppositionSchools: schools ? [...schools] : [],
    },
  });
});

test('a prepared specialist tags opposition-school Spells with two slots; a sorcerer does not', () => {
  const recorded = (castingClassId: string): SheetEntry => ({
    _id: `charm-${castingClassId}`,
    kind: 'spell',
    active: true,
    catalogEntryId: 'charm-person',
    state: { kind: 'spell', castingClassId },
  });
  const result = calculateCharacterSheet(
    sheet(
      ['wizard', 'sorcerer'],
      [evocation(['enc', 'nec']), recorded('wizard'), recorded('sorcerer')],
    ),
  );
  expect(
    result.spellCollections.collections.map((collection) => [
      collection.classTag,
      collection.spells.map((spell) => [spell.name, spell.twoSlots]),
    ]),
  ).toEqual([
    ['wizard', [['Charm Person', true]]],
    ['sorcerer', [['Charm Person', false]]],
  ]);
  // The school belongs to the wizard Spellcasting only.
  expect(casting(result, 'sorcerer').school).toBeNull();
  expect(casting(result, 'wizard').slots.map((slot) => slot.extra)).toEqual([
    0, 1,
  ]);
});

test('a universalist has no school slot', () => {
  const result = calculateCharacterSheet(
    sheet(
      ['wizard'],
      [
        choose(
          'school-universalist',
          'wizard',
          'wizard-arcane-school',
          'Arcane schools',
        ),
      ],
    ),
  );
  expect(casting(result, 'wizard')).toMatchObject({
    extraSlots: [],
    school: null,
  });
});

test('unfilled domain, school and bloodline prompts are marked as missing choices', () => {
  const result = calculateCharacterSheet(
    sheet(['cleric', 'wizard', 'sorcerer'], [fire]),
  );
  expect(
    result.spellcastings.map((row) => [
      row.classTag,
      row.choices.map((choice) => [
        choice.list,
        choice.count,
        choice.selected.map((selected) => selected.name),
      ]),
    ]),
  ).toEqual([
    ['cleric', [['Domains', 2, ['Fire Domain']]]],
    ['wizard', [['Arcane schools', 1, []]]],
    ['sorcerer', [['Bloodlines', 1, []]]],
  ]);
  expect(
    warningsFor(result, ['spellcastingChoiceMissing']).map(
      (row) => row.message,
    ),
  ).toEqual([
    'Choose 1 more domain.',
    'Choose an arcane school.',
    'Choose a bloodline.',
  ]);
});

// CRB p. 387: entry needs 2nd-level arcane and divine spells before its first level.
test('Mystic Theurge entry checks casting in the recorded prefix', () => {
  const result = calculateCharacterSheet(
    sheet([
      ...repeat('wizard', 3),
      ...repeat('cleric', 2),
      'mystic-theurge',
      'cleric',
    ]),
  );
  expect(
    result.prerequisites
      .filter(
        (check) =>
          check.entryId === 'mystic-theurge-1' && 'canCast' in check.clause,
      )
      .map(({ view, met, clause }) => [
        view,
        'canCast' in clause ? clause.canCast.kind : null,
        met,
      ]),
  ).toEqual([
    ['current', 'divine', true],
    ['recorded', 'divine', false],
    ['current', 'arcane', true],
    ['recorded', 'arcane', true],
  ]);
});

test('recorded-level casting checks include advances from earlier prestige levels', () => {
  const feat = (gainedAtClassLevel: string): SheetEntry => ({
    _id: `feat-${gainedAtClassLevel}`,
    kind: 'feat',
    active: true,
    catalogEntryId: 'third-level-arcane',
    gainedAtClassLevel,
    state: { kind: 'feat', slot: 'general' },
  });
  const input = sheet(
    [...repeat('wizard', 4), ...repeat('cleric', 3), 'mystic-theurge'],
    [feat('cleric-3'), feat('mystic-theurge-1')],
  );
  input.catalogEntries.push({
    _id: 'third-level-arcane',
    ruleIdentity: 'third-level-arcane',
    name: 'Third-level arcane feat',
    modifiers: [],
    detail: { kind: 'feat' },
    prerequisites: [
      { kind: 'canCast', canCast: { spellLevel: 3, kind: 'arcane' } },
    ],
  });
  expect(
    calculateCharacterSheet(input)
      .prerequisites.filter((check) => check.entryId.startsWith('feat-'))
      .map(({ entryId, view, met }) => [entryId, view, met]),
  ).toEqual([
    ['feat-cleric-3', 'current', true],
    ['feat-cleric-3', 'recorded', false],
    ['feat-mystic-theurge-1', 'current', true],
    ['feat-mystic-theurge-1', 'recorded', true],
  ]);
});

test('a Granted Spell satisfies a casts-spell prerequisite once it is castable', () => {
  const requirement = (levels: number) => {
    const input = sheet(repeat('cleric', levels), [
      fire,
      {
        _id: 'needs-fireball',
        kind: 'feat',
        active: true,
        catalogEntryId: 'needs-fireball',
        state: { kind: 'feat', slot: 'general' },
      },
    ]);
    input.catalogEntries.push({
      _id: 'needs-fireball',
      ruleIdentity: 'needs-fireball',
      name: 'Needs Fireball',
      modifiers: [],
      detail: { kind: 'feat' },
      prerequisites: [
        { kind: 'castsSpell', castsSpell: 'representative-spell-fireball' },
      ],
    });
    return calculateCharacterSheet(input)
      .prerequisites.filter((check) => check.entryId === 'needs-fireball')
      .map(({ view, met }) => [view, met]);
  };
  expect(requirement(4)).toEqual([['current', false]]);
  expect(requirement(5)).toEqual([['current', true]]);
});
