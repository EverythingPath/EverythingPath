// rotation-6 part C (design ORCH/research/rotation-6-design.md §3 (c)): an
// increase may carry `choice`, the reviewed options it is for. It adds only
// while its entry's saved choice matches an option, trimmed and
// case-insensitively, as the sheet compares a feat's choice elsewhere (the
// duplicate check and prerequisites, `normalize`); with no choice or no
// match it adds nothing. An unsuppressed one warns on its entry while an
// unsuppressed number of its kind and key is on the sheet (a per-day maximum
// for a per-day increase, keyed dice for a dice increase), when its entry's choice is read and either none is
// saved or the saved one is for none of the entry's increases: an entry
// whose saved choice picks one of its outputs warns nothing for the others
// (rotation-6 fix r7; the two-outputs test below), and an entry whose choice
// is not read warns nothing. Fixtures have the imported shape and are test
// fixtures only: Foundry channel-energy.kXXz1lO4i7CibHJ9 (`3 +
// @abilities.cha.mod` uses), feats/extra-channel.pgRX4VpFemwv9R0E (taken for
// one class's channel: +2 uses for a cleric), rage and bloodrage with an
// Extra-Rage-like feat whose record gives one output per pool. No committed
// record carries the field.
import { expect, test } from 'vitest';
import {
  calculateCharacterSheet,
  ruleValueSchema,
  storedRuleValuesSchema,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type RuleValue,
  type SheetEntry,
} from './character-sheet';
import { ruleValueOutputSchema } from './catalog/curation-output-schema';
import { importedCatalogEntrySchema } from './catalog/imported-entry-schema';
import {
  baseClass,
  baseScores,
  classLevelSheet,
} from './character-sheet-rule-value-fixture';

const channel = 'classFeat_channelEnergy';
const rage = 'classFeat_rage';
const bloodrage = 'classFeat_bloodrage';

const feature = ({
  _id,
  name,
  ruleValues,
  ...fields
}: {
  _id: string;
  name: string;
  ruleValues: readonly RuleValue[];
} & Partial<CharacterSheetCatalogEntry>): CharacterSheetCatalogEntry => ({
  _id,
  ruleIdentity: `fixture/${_id}`,
  name,
  modifiers: [],
  detail: { kind: 'classFeature' },
  ruleValues,
  ...fields,
});

const extraChannel = (
  increase: Partial<Extract<RuleValue, { kind: 'dailyMaximumIncrease' }>> = {},
) =>
  feature({
    _id: 'extra-channel',
    name: 'Extra Channel',
    ruleValues: [
      {
        kind: 'dailyMaximumIncrease',
        key: channel,
        amount: 2,
        choice: ['Cleric'],
        ...increase,
      },
    ],
    ruleIdentity: 'pf1/pgRX4VpFemwv9R0E',
    detail: { kind: 'feat', repeatable: 'yes' },
  });

function catalog(extra: CharacterSheetCatalogEntry[] = [extraChannel()]) {
  return [
    baseScores({ charisma: 14, constitution: 14 }),
    baseClass('cleric', 'Cleric', [
      { classLevel: 1, catalogEntryId: 'channel-energy' },
    ]),
    baseClass('paladin', 'Paladin', []),
    baseClass('barbarian', 'Barbarian', [
      { classLevel: 1, catalogEntryId: 'rage' },
    ]),
    baseClass('bloodrager', 'Bloodrager', [
      { classLevel: 1, catalogEntryId: 'bloodrage' },
    ]),
    feature({
      _id: 'channel-energy',
      name: 'Channel Energy',
      ruleValues: [
        {
          kind: 'dailyMaximum',
          key: channel,
          unit: 'uses',
          amount: { formula: '3 + @ability.cha.mod' },
        },
        { kind: 'dice', die: 6, amount: 1, key: channel },
      ],
      ruleIdentity: 'pf1/kXXz1lO4i7CibHJ9',
    }),
    feature({
      _id: 'rage',
      name: 'Rage',
      ruleValues: [
        {
          kind: 'dailyMaximum',
          key: rage,
          unit: 'rounds',
          amount: {
            formula: '4 + @ability.con.mod + 2 * (@classLevel.barbarian - 1)',
          },
        },
      ],
    }),
    feature({
      _id: 'bloodrage',
      name: 'Bloodrage',
      ruleValues: [
        {
          kind: 'dailyMaximum',
          key: bloodrage,
          unit: 'rounds',
          amount: {
            formula: '4 + @ability.con.mod + 2 * (@classLevel.bloodrager - 1)',
          },
        },
      ],
    }),
    feature({
      _id: 'extra-rage',
      name: 'Extra Rage',
      ruleValues: [
        {
          kind: 'dailyMaximumIncrease',
          key: rage,
          amount: 6,
          choice: ['Rage', 'Barbarian'],
        },
        {
          kind: 'dailyMaximumIncrease',
          key: bloodrage,
          amount: 6,
          choice: ['Bloodrage', 'Bloodrager'],
        },
      ],
      detail: { kind: 'feat', repeatable: 'yes' },
    }),
    ...extra,
  ];
}

const feat = (
  catalogEntryId: string,
  choice?: string | null,
  _id = `${catalogEntryId}-row`,
): SheetEntry => ({
  _id,
  kind: 'feat',
  active: true,
  catalogEntryId,
  state: { kind: 'feat', ...(choice === undefined ? {} : { choice }) },
});

function sheet(
  classes: readonly string[],
  rows: SheetEntry[],
  extra?: CharacterSheetCatalogEntry[],
): CharacterSheetInput {
  return classLevelSheet(classes, rows, catalog(extra));
}

function read(input: CharacterSheetInput) {
  const result = calculateCharacterSheet(input);
  return {
    maxima: result.dailyMaxima.map(({ key, value, sources }) => ({
      key,
      value,
      sources: sources.map(({ name }) => name),
    })),
    dice: result.featureNumbers.map(({ count, die }) => `${count}d${die}`),
    choiceWarnings: result.warnings
      .filter(({ check }) => check.startsWith('ruleValueChoice'))
      .map(({ kind, check, subject, message }) => ({
        kind,
        check,
        subject,
        message,
      })),
  };
}

test('Extra Channel taken for the cleric adds its 2 uses: a Cleric 1 with Charisma 14 channels 3 + 2 + 2 = 7 times', () => {
  for (const choice of ['Cleric', '  cleric ', 'CLERIC'])
    expect(read(sheet(['cleric'], [feat('extra-channel', choice)]))).toEqual({
      maxima: [
        {
          key: channel,
          value: 7,
          sources: ['Channel Energy', 'Extra Channel'],
        },
      ],
      dice: ['1d6'],
      choiceWarnings: [],
    });
});

test('with no choice saved it adds nothing and the entry warns that its increase is not counted until the choice is recorded, naming the option', () => {
  for (const choice of [undefined, null, '', '   '])
    expect(read(sheet(['cleric'], [feat('extra-channel', choice)]))).toEqual({
      maxima: [{ key: channel, value: 5, sources: ['Channel Energy'] }],
      dice: ['1d6'],
      choiceWarnings: [
        {
          kind: 'incomplete',
          check: 'ruleValueChoiceMissing',
          subject: 'extra-channel-row:ruleValueChoice',
          message:
            'Extra Channel’s increase is not counted until its choice is recorded; it is for the choice Cleric.',
        },
      ],
    });
});

test('saved as something else it adds nothing and the entry warns that its increase is not counted for that choice, naming the option', () => {
  expect(
    read(sheet(['cleric', 'paladin'], [feat('extra-channel', 'Paladin')])),
  ).toEqual({
    maxima: [{ key: channel, value: 5, sources: ['Channel Energy'] }],
    dice: ['1d6'],
    choiceWarnings: [
      {
        kind: 'rules',
        check: 'ruleValueChoiceUnmatched',
        subject: 'extra-channel-row:ruleValueChoice',
        message:
          'Extra Channel’s increase is not counted for its choice, Paladin; it is for the choice Cleric.',
      },
    ],
  });
});

test('with no maximum or dice of its key on the sheet, a missing choice warns nothing: a Paladin 1 with Extra Channel', () => {
  expect(read(sheet(['paladin'], [feat('extra-channel')]))).toEqual({
    maxima: [],
    dice: [],
    choiceWarnings: [],
  });
});

test('two outputs on one record for two keys: the choice picks the pool, and the other pool’s output is not a mismatch', () => {
  const both = ['barbarian', 'barbarian', 'bloodrager', 'bloodrager'];
  // Rage: 4 + 2 + 2 = 8; bloodrage: 8.
  expect(read(sheet(both, [feat('extra-rage', 'bloodrager')]))).toEqual({
    maxima: [
      { key: rage, value: 8, sources: ['Rage'] },
      { key: bloodrage, value: 14, sources: ['Bloodrage', 'Extra Rage'] },
    ],
    dice: [],
    choiceWarnings: [],
  });
  expect(read(sheet(both, [feat('extra-rage', 'Rage')])).maxima).toEqual([
    { key: rage, value: 14, sources: ['Rage', 'Extra Rage'] },
    { key: bloodrage, value: 8, sources: ['Bloodrage'] },
  ]);
  expect(read(sheet(both, [feat('extra-rage')]))).toEqual({
    maxima: [
      { key: rage, value: 8, sources: ['Rage'] },
      { key: bloodrage, value: 8, sources: ['Bloodrage'] },
    ],
    dice: [],
    choiceWarnings: [
      {
        kind: 'incomplete',
        check: 'ruleValueChoiceMissing',
        subject: 'extra-rage-row:ruleValueChoice',
        message:
          'Extra Rage’s increases are not counted until its choice is recorded; one is for the choice Rage or Barbarian and one for Bloodrage or Bloodrager.',
      },
    ],
  });
});

test('a dice increase is gated the same way', () => {
  const focus = feature({
    _id: 'focus',
    name: 'Channel focus',
    ruleValues: [
      { kind: 'diceIncrease', key: channel, amount: 2, choice: ['Cleric'] },
    ],
    detail: { kind: 'feat' },
  });
  expect(
    read(sheet(['cleric'], [feat('focus', 'Cleric')], [focus])).dice,
  ).toEqual(['3d6']);
  expect(read(sheet(['cleric'], [feat('focus')], [focus]))).toMatchObject({
    dice: ['1d6'],
    choiceWarnings: [{ check: 'ruleValueChoiceMissing' }],
  });
});

test('an increase without a choice adds whatever the entry’s saved choice is, as before', () => {
  const plain = extraChannel({ choice: undefined });
  for (const choice of [undefined, 'Paladin'])
    expect(
      read(sheet(['cleric'], [feat('extra-channel', choice)], [plain])),
    ).toMatchObject({
      maxima: [{ key: channel, value: 7 }],
      choiceWarnings: [],
    });
});

test('with oncePerSource, a copy taken for another class neither adds nor beats the one taken for the cleric', () => {
  const once = extraChannel({ oncePerSource: true });
  expect(
    read(
      sheet(
        ['cleric', 'paladin'],
        [
          feat('extra-channel', 'Paladin', 'first'),
          feat('extra-channel', 'Cleric', 'second'),
          feat('extra-channel', 'cleric', 'third'),
        ],
        [once],
      ),
    ).maxima,
  ).toEqual([
    { key: channel, value: 7, sources: ['Channel Energy', 'Extra Channel'] },
  ]);
});

// Fix r1 (both reviews, finding 3): the choice is checked before the
// formula, so only what can apply is evaluated, and the warning says what is
// true: the increase is not counted, with the option it needs.
function warningsOf(input: CharacterSheetInput) {
  return calculateCharacterSheet(input)
    .warnings.filter(({ subject }) => subject.startsWith('extra-channel-row'))
    .map(({ check }) => check);
}
const unresolvedChannel = extraChannel({ amount: { formula: '@unknown' } });

test('an increase for an option not chosen is not evaluated, so its formula does not warn: only the choice does', () => {
  expect(
    warningsOf(
      sheet(
        ['cleric', 'paladin'],
        [feat('extra-channel', 'Paladin')],
        [unresolvedChannel],
      ),
    ),
  ).toEqual(['ruleValueChoiceUnmatched']);
});

test('with no choice saved, an increase for a choice is not evaluated either: only the missing choice warns', () => {
  expect(
    warningsOf(sheet(['cleric'], [feat('extra-channel')], [unresolvedChannel])),
  ).toEqual(['ruleValueChoiceMissing']);
});

// Fix r2 (Spec, finding 3): the warning names the choice the increase is
// for and promises no contribution, since with that choice saved an
// increase whose formula can't be evaluated still adds nothing.
test('the choice warning names what the increase is for and does not say it then counts: saved as Cleric, an unresolved increase still adds nothing', () => {
  const missing = calculateCharacterSheet(
    sheet(['cleric'], [feat('extra-channel')], [unresolvedChannel]),
  ).warnings.find(({ check }) => check === 'ruleValueChoiceMissing');
  expect(missing?.message).toBe(
    'Extra Channel’s increase is not counted until its choice is recorded; it is for the choice Cleric.',
  );
  expect(missing?.message).not.toMatch(/counts when/);
  const saved = sheet(
    ['cleric'],
    [feat('extra-channel', 'Cleric')],
    [unresolvedChannel],
  );
  expect(warningsOf(saved)).toEqual(['unsupportedFormula']);
  expect(read(saved).maxima).toEqual([
    { key: channel, value: null, sources: ['Channel Energy', 'Extra Channel'] },
  ]);
});

test('with no maximum of its key on the sheet, an increase for an option not chosen warns nothing at all', () => {
  expect(
    warningsOf(
      sheet(
        ['paladin'],
        [feat('extra-channel', 'Paladin')],
        [unresolvedChannel],
      ),
    ),
  ).toEqual([]);
});

test('an entry whose other, ungated increase still adds is warned for the gated one alone: 3 + 2 + 1 = 6', () => {
  const devotion = feature({
    _id: 'devotion',
    name: 'Channel devotion',
    ruleValues: [
      { kind: 'dailyMaximumIncrease', key: channel, amount: 1 },
      {
        kind: 'dailyMaximumIncrease',
        key: channel,
        amount: 2,
        choice: ['Cleric', 'Oracle'],
      },
    ],
    detail: { kind: 'feat' },
  });
  expect(read(sheet(['cleric'], [feat('devotion')], [devotion]))).toEqual({
    maxima: [
      {
        key: channel,
        value: 6,
        sources: ['Channel Energy', 'Channel devotion'],
      },
    ],
    dice: ['1d6'],
    choiceWarnings: [
      {
        kind: 'incomplete',
        check: 'ruleValueChoiceMissing',
        subject: 'devotion-row:ruleValueChoice',
        message:
          'Channel devotion’s increase is not counted until its choice is recorded; it is for the choice Cleric or Oracle.',
      },
    ],
  });
});

test('the options a warning names are those of the increases not counted for a key on the sheet, across dice and maxima', () => {
  const focus = feature({
    _id: 'focus',
    name: 'Channel focus',
    ruleValues: [
      { kind: 'diceIncrease', key: channel, amount: 2, choice: ['Cleric'] },
      {
        kind: 'dailyMaximumIncrease',
        key: channel,
        amount: 1,
        choice: ['Oracle'],
      },
      {
        kind: 'dailyMaximumIncrease',
        key: rage,
        amount: 1,
        choice: ['Skald'],
      },
    ],
    detail: { kind: 'feat' },
  });
  expect(
    read(sheet(['cleric'], [feat('focus', 'Paladin')], [focus])).choiceWarnings,
  ).toEqual([
    {
      kind: 'rules',
      check: 'ruleValueChoiceUnmatched',
      subject: 'focus-row:ruleValueChoice',
      message:
        'Channel focus’s increases are not counted for its choice, Paladin; one is for the choice Cleric and one for Oracle.',
    },
  ]);
});

test('a choice is an increase’s alone, a list of one to 16 options of 1 to 64 characters, refused otherwise by the rule value, stored, imported and curation output schemas', () => {
  const refused: unknown[] = [
    { kind: 'dailyMaximumIncrease', key: channel, amount: 2, choice: [] },
    { kind: 'dailyMaximumIncrease', key: channel, amount: 2, choice: [''] },
    { kind: 'dailyMaximumIncrease', key: channel, amount: 2, choice: ['  '] },
    { kind: 'dailyMaximumIncrease', key: channel, amount: 2, choice: 'Cleric' },
    {
      kind: 'diceIncrease',
      key: channel,
      amount: 2,
      choice: ['c'.repeat(65)],
    },
    {
      kind: 'diceIncrease',
      key: channel,
      amount: 2,
      choice: Array.from({ length: 17 }, (_, index) => `Option ${index}`),
    },
    {
      kind: 'dailyMaximum',
      key: channel,
      unit: 'uses',
      amount: 1,
      choice: ['Cleric'],
    },
    { kind: 'dice', die: 6, amount: 1, choice: ['Cleric'] },
    { kind: 'spellResistance', amount: 1, choice: ['Cleric'] },
  ];
  for (const ruleValue of refused) {
    expect(ruleValueSchema.safeParse(ruleValue).success).toBe(false);
    expect(storedRuleValuesSchema.safeParse([ruleValue]).success).toBe(false);
    expect(
      importedCatalogEntrySchema.shape.ruleValues.safeParse([ruleValue])
        .success,
    ).toBe(false);
    expect(
      ruleValueOutputSchema.safeParse({ kind: 'ruleValue', ruleValue }).success,
    ).toBe(false);
  }
  for (const ruleValue of [
    {
      kind: 'dailyMaximumIncrease',
      key: channel,
      amount: 2,
      choice: ['Cleric'],
    },
    {
      kind: 'diceIncrease',
      key: channel,
      amount: 2,
      choice: Array.from({ length: 16 }, (_, index) => `${index}`.repeat(1)),
    },
  ]) {
    expect(storedRuleValuesSchema.safeParse([ruleValue]).success).toBe(true);
    expect(
      ruleValueOutputSchema.safeParse({ kind: 'ruleValue', ruleValue }).success,
    ).toBe(true);
  }
});

// rotation-6 part N: an increase its choice leaves out is listed on the
// number of its kind and key, with the reason.
test('Extra Channel left out for its choice is listed on the maximum: no choice, or the choice it was saved with', () => {
  const lines = (choice?: string | null) =>
    calculateCharacterSheet(
      sheet(['cleric', 'paladin'], [feat('extra-channel', choice)]),
    ).dailyMaxima.map(({ notCounted }) => notCounted);
  expect(lines()).toEqual([
    [
      {
        entryId: 'extra-channel-row',
        name: 'Extra Channel',
        reason: 'noChoice',
      },
    ],
  ]);
  expect(lines(' Paladin ')).toEqual([
    [
      {
        entryId: 'extra-channel-row',
        name: 'Extra Channel',
        reason: 'otherChoice',
        choice: 'Paladin',
      },
    ],
  ]);
  expect(lines('Cleric')).toEqual([undefined]);
  const focus = feature({
    _id: 'focus',
    name: 'Channel focus',
    ruleValues: [
      { kind: 'diceIncrease', key: channel, amount: 2, choice: ['Cleric'] },
    ],
    detail: { kind: 'feat' },
  });
  expect(
    calculateCharacterSheet(
      sheet(['cleric'], [feat('focus')], [focus]),
    ).featureNumbers.map(({ notCounted }) => notCounted),
  ).toEqual([
    [{ entryId: 'focus-row', name: 'Channel focus', reason: 'noChoice' }],
  ]);
});

test('the read’s schemas take a not-counted list and a read without one', async () => {
  const { dailyMaximumSchema, featureNumberSchema } =
    await import('./character-sheet');
  const maximum = {
    entryId: 'channel',
    ruleValueIndex: 0,
    key: channel,
    unit: 'uses',
    value: 5,
    sources: [{ entryId: 'channel', name: 'Channel Energy' }],
  };
  expect(dailyMaximumSchema.parse(maximum)).toEqual(maximum);
  expect(
    dailyMaximumSchema.safeParse({
      ...maximum,
      notCounted: [{ entryId: 'x', name: 'X', reason: 'noChoice' }],
    }).success,
  ).toBe(true);
  expect(
    dailyMaximumSchema.safeParse({
      ...maximum,
      notCounted: [{ entryId: 'x', name: 'X', reason: 'otherChoice' }],
    }).success,
  ).toBe(false);
  const dice = {
    kind: 'dice',
    entryId: 'channel',
    ruleValueIndex: 1,
    die: 6,
    count: null,
    sources: [],
  };
  expect(featureNumberSchema.parse(dice)).toEqual(dice);
  expect(
    featureNumberSchema.safeParse({
      ...dice,
      notCounted: [
        {
          entryId: 'x',
          name: 'X',
          reason: 'sameSource',
          counted: { entryId: 'y', name: 'Y' },
        },
      ],
    }).success,
  ).toBe(true);
});

// rotation-6 fix r4 (Spec r4 finding 1): the fingerprint of the choice
// warning carries the options it names, so its acceptance covers those
// options alone; their order, the record's or within an increase's list,
// is no fact of the warning.
test('the choice warning’s fingerprint carries the options it names, in no order, and the saved choice trimmed and in any case', () => {
  const focus = (ruleValues: readonly RuleValue[]) =>
    feature({
      _id: 'focus',
      name: 'Channel focus',
      ruleValues,
      detail: { kind: 'feat' },
    });
  const forCleric: RuleValue = {
    kind: 'diceIncrease',
    key: channel,
    amount: 2,
    choice: ['Cleric', 'Priest'],
  };
  const forOracle: RuleValue = {
    kind: 'dailyMaximumIncrease',
    key: channel,
    amount: 1,
    choice: ['Oracle'],
  };
  const fingerprint = (ruleValues: readonly RuleValue[], choice = 'Paladin') =>
    calculateCharacterSheet(
      sheet(['cleric'], [feat('focus', choice)], [focus(ruleValues)]),
    ).warnings.find(({ check }) => check === 'ruleValueChoiceUnmatched')
      ?.fingerprint;
  const both = fingerprint([forCleric, forOracle]);
  expect(both).toBeDefined();
  expect(fingerprint([forOracle, forCleric])).toBe(both);
  expect(
    fingerprint([{ ...forCleric, choice: ['priest', 'CLERIC'] }, forOracle]),
  ).toBe(both);
  expect(fingerprint([forCleric, forOracle], '  paladin ')).toBe(both);
  expect(fingerprint([forCleric])).not.toBe(both);
  expect(
    fingerprint([forCleric, { ...forOracle, choice: ['Shaman'] }]),
  ).not.toBe(both);
  expect(fingerprint([forCleric, forOracle], 'Inquisitor')).not.toBe(both);
});

// rotation-6 fix r5 (Standards r5 finding 4): the message compares the
// options of its increases as the fingerprint does (trimmed, in any case,
// in no order), so two equivalent lists are named once, as first written.
// rotation-6 fix r6 (Standards r6 finding 4): its grammar counts the
// increases, not the lists, so two increases left out are "increases are"
// even when their options are named once.
test('two increases for the same options in another order, case or spacing are named once in the warning, as two increases, and a different list still twice', () => {
  const focus = (second: [string, ...string[]]) =>
    feature({
      _id: 'focus',
      name: 'Channel focus',
      ruleValues: [
        {
          kind: 'diceIncrease',
          key: channel,
          amount: 2,
          choice: ['Cleric', 'Priest'],
        },
        {
          kind: 'dailyMaximumIncrease',
          key: channel,
          amount: 1,
          choice: second,
        },
      ],
      detail: { kind: 'feat' },
    });
  const message = (second: [string, ...string[]]) =>
    read(
      sheet(['cleric'], [feat('focus', 'Paladin')], [focus(second)]),
    ).choiceWarnings.map(({ message }) => message);
  expect(message([' priest', 'CLERIC '])).toEqual([
    'Channel focus’s increases are not counted for its choice, Paladin; each is for the choice Cleric or Priest.',
  ]);
  expect(message(['Priest', 'Cleric', 'cleric'])).toEqual([
    'Channel focus’s increases are not counted for its choice, Paladin; each is for the choice Cleric or Priest.',
  ]);
  expect(message(['Oracle'])).toEqual([
    'Channel focus’s increases are not counted for its choice, Paladin; one is for the choice Cleric or Priest and one for Oracle.',
  ]);
});

// rotation-6 fix r6 (Standards r6 finding 4): one increase left out on an
// entry is still "increase is", and two with no choice saved, one per kind
// of one key, are "increases are" in the missing-choice message too.
test('the choice warning counts the entry’s increases left out: one is “increase is”, two for one list “increases are”, each named for it', () => {
  const focus = (ruleValues: readonly RuleValue[]) =>
    feature({
      _id: 'focus',
      name: 'Channel focus',
      ruleValues,
      detail: { kind: 'feat' },
    });
  const dice: RuleValue = {
    kind: 'diceIncrease',
    key: channel,
    amount: 2,
    choice: ['Cleric'],
  };
  const uses: RuleValue = {
    kind: 'dailyMaximumIncrease',
    key: channel,
    amount: 1,
    choice: ['Cleric'],
  };
  const message = (ruleValues: readonly RuleValue[]) =>
    read(
      sheet(['cleric'], [feat('focus')], [focus(ruleValues)]),
    ).choiceWarnings.map(({ message }) => message);
  expect(message([uses])).toEqual([
    'Channel focus’s increase is not counted until its choice is recorded; it is for the choice Cleric.',
  ]);
  expect(message([dice, uses])).toEqual([
    'Channel focus’s increases are not counted until its choice is recorded; each is for the choice Cleric.',
  ]);
});

// rotation-6 fix r7 (Standards r7 finding 2): with several option lists the
// warning keeps how many increases each list is for, so two for Cleric and
// one for Oracle no longer read as one each (the reviewer's probe).
test('the choice warning counts the increases per option list: 1 + 1, 2 + 1, 2 + 2 and three lists', () => {
  const forClass = (option: string): RuleValue => ({
    kind: 'dailyMaximumIncrease',
    key: channel,
    amount: 1,
    choice: [option],
  });
  const message = (options: readonly string[]) =>
    read(
      sheet(
        ['cleric'],
        [feat('focus', 'Paladin')],
        [
          feature({
            _id: 'focus',
            name: 'Channel focus',
            ruleValues: options.map(forClass),
            detail: { kind: 'feat' },
          }),
        ],
      ),
    ).choiceWarnings.map(({ message }) => message);
  const unmatched =
    'Channel focus’s increases are not counted for its choice, Paladin;';
  expect(message(['Cleric', 'Cleric', 'Oracle'])).toEqual([
    `${unmatched} two are for the choice Cleric and one for Oracle.`,
  ]);
  expect(message(['Cleric', 'Oracle'])).toEqual([
    `${unmatched} one is for the choice Cleric and one for Oracle.`,
  ]);
  expect(message(['Cleric', 'Oracle', 'Oracle', 'Cleric'])).toEqual([
    `${unmatched} two are for the choice Cleric and two for Oracle.`,
  ]);
  expect(message(['Cleric', 'Oracle', 'Shaman'])).toEqual([
    `${unmatched} one is for the choice Cleric, one for Oracle and one for Shaman.`,
  ]);
});

// rotation-6 fix r6 (both r6 reviews, finding 1): once per Source, the lines
// not counted and the choice warning work per increase kind and key: per-day
// increases against per-day maxima, dice increases against dice. Test
// fixtures only: a relic-like feat taken twice, and pools with one kind each.
const relic = (fields: Partial<CharacterSheetCatalogEntry> = {}) =>
  feature({
    _id: 'relic',
    name: 'Relic',
    ruleValues: [
      {
        kind: 'dailyMaximumIncrease',
        key: channel,
        amount: 2,
        oncePerSource: true,
      },
      { kind: 'diceIncrease', key: channel, amount: 2, oncePerSource: true },
    ],
    detail: { kind: 'feat', repeatable: 'yes' },
    ...fields,
  });

test('a marked per-day increase and a marked dice increase of one Source and key both count, each once: a Cleric 1 with Charisma 14 channels 3 + 2 + 2 = 7 times and 1d6 + 2d6 = 3d6', () => {
  const result = calculateCharacterSheet(
    sheet(
      ['cleric'],
      [
        feat('relic', undefined, 'relic-1'),
        feat('relic', undefined, 'relic-2'),
      ],
      [relic()],
    ),
  );
  const notCounted = {
    entryId: 'relic-2',
    name: 'Relic',
    reason: 'sameSource',
    counted: { entryId: 'relic-1', name: 'Relic' },
  };
  expect(
    result.dailyMaxima.map(({ value, notCounted }) => ({ value, notCounted })),
  ).toEqual([{ value: 7, notCounted: [notCounted] }]);
  expect(
    result.featureNumbers.map(({ count, notCounted }) => ({
      count,
      notCounted,
    })),
  ).toEqual([{ count: 3, notCounted: [notCounted] }]);
});

test('a missing choice warns and is listed only where a number of its own kind and key receives it: dice alone take a dice increase’s, a maximum alone a per-day increase’s', () => {
  const pool = 'fixture_pool';
  const uses = feature({
    _id: 'uses',
    name: 'Pool uses',
    ruleValues: [{ kind: 'dailyMaximum', key: pool, unit: 'uses', amount: 3 }],
    detail: { kind: 'feat' },
  });
  const dice = feature({
    _id: 'dice',
    name: 'Pool dice',
    ruleValues: [{ kind: 'dice', key: pool, die: 6, amount: 1 }],
    detail: { kind: 'feat' },
  });
  const moreUses = feature({
    _id: 'more-uses',
    name: 'More uses',
    ruleValues: [
      { kind: 'dailyMaximumIncrease', key: pool, amount: 1, choice: ['Pool'] },
    ],
    detail: { kind: 'feat' },
  });
  const moreDice = feature({
    _id: 'more-dice',
    name: 'More dice',
    ruleValues: [
      { kind: 'diceIncrease', key: pool, amount: 1, choice: ['Pool'] },
    ],
    detail: { kind: 'feat' },
  });
  const run = (receiver: string) => {
    const result = calculateCharacterSheet(
      sheet(
        ['paladin'],
        [feat(receiver), feat('more-uses'), feat('more-dice')],
        [uses, dice, moreUses, moreDice],
      ),
    );
    return {
      maxima: result.dailyMaxima.map(({ value, notCounted }) => ({
        value,
        notCounted,
      })),
      dice: result.featureNumbers.map(({ count, notCounted }) => ({
        count,
        notCounted,
      })),
      warned: result.warnings
        .filter(({ check }) => check.startsWith('ruleValueChoice'))
        .map(({ subject }) => subject),
    };
  };
  expect(run('dice')).toEqual({
    maxima: [],
    dice: [
      {
        count: 1,
        notCounted: [
          { entryId: 'more-dice-row', name: 'More dice', reason: 'noChoice' },
        ],
      },
    ],
    warned: ['more-dice-row:ruleValueChoice'],
  });
  expect(run('uses')).toEqual({
    maxima: [
      {
        value: 3,
        notCounted: [
          { entryId: 'more-uses-row', name: 'More uses', reason: 'noChoice' },
        ],
      },
    ],
    dice: [],
    warned: ['more-uses-row:ruleValueChoice'],
  });
});
