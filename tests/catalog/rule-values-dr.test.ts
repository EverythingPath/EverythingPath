// @vitest-environment node
// stats-dr (PRD #251; GLOSSARY: Rule value): the Damage Reduction the
// Barbarian, the Unchained Barbarian and the Bloodrager share
// (pf1/RENIeTVjWB7Mq6Mw) gets one rule-value record counting its rows, written
// drafted, beside the Mad Dog's drafted record (stats-d1). Rows count class by
// class (rotation-4), so each class's sheet entry of the shared feature is its
// own line, and the statistic is the highest per bypass, never a sum (root's
// default; "Damage reduction from different sources does not stack", PRD
// advancedPlayersGuide/prestigeClasses/stalwartDefender.html:397). Drafted,
// the records change nothing; checked, both, in memory and as committed (the
// record step checked them together on a captured review, run
// t3-review-2201b12a…), they give the values of the boundary (ORCH
// stats-dr/boundary.md) on the pinned rows. Characters are numbers
// (party-builds.json).
import { describe, expect, it } from 'vitest';
import { hashText } from '../../scripts/catalog/curation';
import type { GrantKey } from '../../src/lib/character-sheet-grants';
import {
  archetypes,
  characterSheet,
  classes,
  committedRecords,
  damageReduction,
  keys,
  ruleValueImports,
  type CharacterOptions,
  type ClassLevels,
} from './rule-value-sheets';

/** The records' values as the boundary gives them, in overlay order. */
const expected = [
  [
    keys.madDogDamageReduction,
    {
      kind: 'damageReduction',
      amount: { formula: 'floor((@classLevel.barbarian - 7) / 3)' },
      bypass: '-',
    },
  ],
  [
    keys.damageReduction,
    { kind: 'damageReduction', amount: { rows: {} }, bypass: '-' },
  ],
] as const;
const committed = committedRecords(
  new Set<string>(expected.map(([key]) => key)),
);

const { without, drafted, checked, asCommitted } = await ruleValueImports(
  committed,
  'rule-values-dr.test.ts',
);

const shared = keys.damageReduction;
const madDog = keys.madDogDamageReduction;
/** A Grant: its source, the source's class level and the granted entry. */
type Grant = Required<GrantKey>;
/** The Grant of the shared Damage Reduction a class gives at 7th. */
const classGrant = (classKey: string): Grant => ({
  source: classKey,
  classLevel: 7,
  entry: shared,
});
/** The Grant of its own Damage Reduction the Mad Dog gives at 10th. */
const madDogGrant: Grant = {
  source: archetypes.madDog,
  classLevel: 10,
  entry: madDog,
};
/** A DR x/— line of this Grant, applying or not. */
const line = (grant: Grant, value: number, applies = true) => ({
  grant,
  value,
  bypass: '-',
  applies,
});
/** The damage reduction a sheet shows with these lines: the statistic is the applying line's. */
const shows = (...lines: ReturnType<typeof line>[]) => ({
  lines,
  values: lines
    .filter(({ applies }) => applies)
    .map(({ grant, value, bypass }) => ({ grant, value, bypass })),
});
const none = { lines: [], values: [] };

const { barbarian, unchainedBarbarian, bloodrager } = classes;
const className: Record<string, string> = {
  [barbarian]: 'Barbarian',
  [unchainedBarbarian]: 'Unchained Barbarian',
  [bloodrager]: 'Bloodrager',
};
const asMadDog: CharacterOptions = { archetype: archetypes.madDog };
type Case = {
  levels: ClassLevels;
  options?: CharacterOptions;
  /** The lines the sheet shows, checked; the applying one gives the statistic. */
  lines: ReturnType<typeof line>[];
};
/**
 * Each class alone, by its class level: 1/— at 7th and 1 more at 10th, 13th,
 * 16th and 19th (PRD barbarian.html:419, the Unchained Barbarian's :469,
 * bloodrager.html:469; ORCH stats-dr/boundary.md).
 */
const schedule = [
  [6, 0],
  [7, 1],
  [9, 1],
  [10, 2],
  [13, 3],
  [16, 4],
  [19, 5],
  [20, 5],
] as const;
/** The one table of expectations: each Character's damage reduction, checked. */
const cases: readonly Case[] = [
  ...[barbarian, unchainedBarbarian, bloodrager].flatMap((classKey) =>
    schedule.map(
      ([level, value]): Case => ({
        levels: [[classKey, level]],
        lines: value ? [line(classGrant(classKey), value)] : [],
      }),
    ),
  ),
  // Characters 7 and 10.
  { levels: [[bloodrager, 4]], lines: [] },
  // A Mad Dog keeps the Barbarian's line and adds its own from 10th,
  // floor((barbarian level - 7) / 3); the statistic is the higher. Character 4
  // is the Mad Dog Barbarian 8.
  {
    levels: [[barbarian, 8]],
    options: asMadDog,
    lines: [line(classGrant(barbarian), 1)],
  },
  {
    levels: [[barbarian, 10]],
    options: asMadDog,
    lines: [line(classGrant(barbarian), 2), line(madDogGrant, 1, false)],
  },
  {
    levels: [[barbarian, 13]],
    options: asMadDog,
    lines: [line(classGrant(barbarian), 3), line(madDogGrant, 2, false)],
  },
  {
    levels: [[barbarian, 16]],
    options: asMadDog,
    lines: [line(classGrant(barbarian), 4), line(madDogGrant, 3, false)],
  },
  {
    levels: [[barbarian, 19]],
    options: asMadDog,
    lines: [line(classGrant(barbarian), 5), line(madDogGrant, 4, false)],
  },
  // Each line is its own Grant: a player who switches off the Barbarian's
  // Grant of the shared Damage Reduction keeps the Mad Dog's own line, and the
  // sheet shows that lower line.
  {
    levels: [[barbarian, 10]],
    options: { ...asMadDog, switchedOff: [classGrant(barbarian)] },
    lines: [line(madDogGrant, 1)],
  },
  // Two classes: each counts its own rows, and their lines do not stack.
  {
    levels: [
      [barbarian, 10],
      [bloodrager, 10],
    ],
    lines: [
      line(classGrant(barbarian), 2),
      line(classGrant(bloodrager), 2, false),
    ],
  },
  {
    levels: [
      [barbarian, 7],
      [bloodrager, 3],
    ],
    lines: [line(classGrant(barbarian), 1)],
  },
  // 12 levels between them, 6 in each class: none.
  {
    levels: [
      [barbarian, 6],
      [bloodrager, 6],
    ],
    lines: [],
  },
];
/** "Mad Dog Barbarian 13", "Barbarian 7 / Bloodrager 3". */
const described = ({ levels, options }: Case) =>
  `${options?.archetype ? 'Mad Dog ' : ''}${levels
    .map(([classKey, level]) => `${className[classKey]} ${level}`)
    .join(
      ' / ',
    )}${options?.switchedOff?.length ? ', the Barbarian’s Damage Reduction switched off' : ''}`;

describe('the stats-dr damage reduction records', () => {
  it('are committed checked by the record step on one captured review with exactly the boundary’s values, one per entry, each bound to its entry’s current description', () => {
    expect(
      committed.map((record) => [
        record.externalKey,
        record.status,
        'receipt' in record ? record.receipt : undefined,
        ...record.outputs.map(({ ruleValue }) => ruleValue),
      ]),
    ).toEqual(
      expected.map(([key, value]) => [
        key,
        'checked',
        't3-review-2201b12a0aa65199ff87ed0c0f01f8618aac02f36cb6ab41722f79903359c10a',
        value,
      ]),
    );
    for (const record of committed) {
      const entry = checked.catalog.entries.find(
        ({ externalKey }) => externalKey === record.externalKey,
      );
      expect(entry && hashText(entry.description), record.externalKey).toBe(
        record.descriptionSha256,
      );
    }
  });

  it('drafted, change no entry and no sheet: no Character of the table, character 4 (Mad Dog Barbarian 8) among them, has damage reduction', () => {
    expect(drafted.catalog.entries).toEqual(without.catalog.entries);
    expect(drafted.curation.ruleValues).toEqual(
      committed.map(({ externalKey }) => ({ externalKey, status: 'drafted' })),
    );
    for (const testCase of cases)
      expect(
        damageReduction(
          characterSheet(drafted, testCase.levels, testCase.options),
        ),
        described(testCase),
      ).toEqual(none);
  });

  it('as committed, apply as checked in memory: the same entries, and character 4 (Mad Dog Barbarian 8) shows DR 1/— from the Barbarian’s Grant', () => {
    expect(asCommitted.curation.ruleValues).toEqual(
      committed.map(({ externalKey }) => ({ externalKey, status: 'applied' })),
    );
    expect(asCommitted.catalog.entries).toEqual(checked.catalog.entries);
    // Character 4.
    expect(
      damageReduction(characterSheet(asCommitted, [[barbarian, 8]], asMadDog)),
    ).toEqual(shows(line(classGrant(barbarian), 1)));
  });

  it('checked, apply to the shared entry and the Mad Dog’s and to no increment', () => {
    expect(checked.curation.ruleValues).toEqual(
      committed.map(({ externalKey }) => ({ externalKey, status: 'applied' })),
    );
    expect(
      checked.catalog.entries
        .filter(({ ruleValues }) => ruleValues)
        .map(({ externalKey }) => externalKey)
        .sort(),
    ).toEqual([madDog, shared].sort());
  });

  it.for(cases.map((testCase) => ({ ...testCase, name: described(testCase) })))(
    'checked: $name',
    ({ levels, options, lines }) => {
      expect(damageReduction(characterSheet(checked, levels, options))).toEqual(
        shows(...lines),
      );
    },
  );
});
