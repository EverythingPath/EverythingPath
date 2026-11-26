// @vitest-environment node
// stats-d1 part B (PRD #251; GLOSSARY: Rule value): the four rule-value
// records that put channel dice and damage reduction on real rows, written
// drafted; the record step checked three on a captured review (run
// t3-review-39c11ce7…) and the Mad Dog's on another in stats-dr (run
// t3-review-2201b12a…). Drafted, they change no entry; checked (in memory, and
// as committed), they give the party's sheets their dice and damage
// reduction. Characters are numbers (party-builds.json). Every case runs on
// the pinned tree. The Damage Reduction the Barbarian, the Unchained Barbarian
// and the Bloodrager share got its record in stats-dr (rule-values-dr.test.ts,
// with the Mad Dog's beside it, where a sheet's damage reduction is pinned).
import { describe, expect, it } from 'vitest';
import { hashText } from '../../scripts/catalog/curation';
import {
  archetypes,
  characterSheet,
  classes,
  committedRecords,
  dice,
  keys,
  ruleValueImports,
  sheet,
} from './rule-value-sheets';

/** The records' values as the boundary rows give them (ORCH stats-d1/boundary.md). */
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
    keys.layOnHands,
    {
      kind: 'dice',
      die: 6,
      amount: { formula: 'floor(@classLevel.paladin / 2)' },
    },
  ],
  [keys.channelEnergy, { kind: 'dice', die: 6, amount: { rows: {} } }],
  [
    keys.channelPositiveEnergy,
    {
      kind: 'dice',
      die: 6,
      amount: { formula: 'ceil(@classLevel.paladin / 2)' },
    },
  ],
] as const;
const batchKeys = new Set<string>(expected.map(([key]) => key));
const committed = committedRecords(batchKeys);

const { without, drafted, checked, asCommitted } = await ruleValueImports(
  committed,
  'rule-values-d1.test.ts',
);

describe('the stats-d1 rule-value records (part B)', () => {
  it('are committed with exactly the boundary’s values, one per entry, each bound to its entry’s current description', () => {
    expect(
      committed.map(({ externalKey, outputs }) => [
        externalKey,
        ...outputs.map(({ ruleValue }) => ruleValue),
      ]),
    ).toEqual(expected);
    for (const record of committed) {
      const entry = checked.catalog.entries.find(
        ({ externalKey }) => externalKey === record.externalKey,
      );
      expect(entry && hashText(entry.description), record.externalKey).toBe(
        record.descriptionSha256,
      );
    }
  });

  it('drafted, change no entry and no sheet: the entries are those of the overlay without the collection, and no character has dice or damage reduction', () => {
    expect(drafted.catalog.entries).toEqual(without.catalog.entries);
    expect(drafted.curation.ruleValues).toEqual(
      committed.map(({ externalKey }) => ({ externalKey, status: 'drafted' })),
    );
    for (const result of [
      sheet(drafted, [classes.cleric, 8]),
      sheet(drafted, [classes.paladin, 4]),
      sheet(drafted, [classes.barbarian, 10, archetypes.madDog]),
    ]) {
      expect(result.featureNumbers).toEqual([]);
      expect(result.damageReduction.lines).toEqual([]);
    }
  });

  it('checked, apply to their four entries and to no increment', () => {
    expect(checked.curation.ruleValues).toEqual(
      committed.map(({ externalKey }) => ({ externalKey, status: 'applied' })),
    );
    const carrying = checked.catalog.entries
      .filter(({ ruleValues }) => ruleValues)
      .map(({ externalKey }) => externalKey)
      .sort();
    expect(carrying).toEqual([...batchKeys].sort());
  });

  it('as committed, all four checked by the record step (the Mad Dog’s in stats-dr): they apply as checked in memory, so character 3 (Cleric 8) channels 4d6 and character 12 (Paladin 4) channels 2d6 and lays on 2d6', () => {
    expect(
      committed.map(({ externalKey, status }) => [externalKey, status]),
    ).toEqual(expected.map(([key]) => [key, 'checked']));
    expect(asCommitted.curation.ruleValues).toEqual(
      committed.map(({ externalKey }) => ({ externalKey, status: 'applied' })),
    );
    expect(asCommitted.catalog.entries).toEqual(checked.catalog.entries);
    // Character 3.
    expect(dice(sheet(asCommitted, [classes.cleric, 8]))).toEqual([
      `${keys.channelEnergy}: 4d6`,
    ]);
    // Character 12.
    expect(dice(sheet(asCommitted, [classes.paladin, 4])).sort()).toEqual(
      [`${keys.channelPositiveEnergy}: 2d6`, `${keys.layOnHands}: 2d6`].sort(),
    );
  });

  it('checked: Channel Energy counts the Cleric’s active rows, so character 3 (Cleric 8) channels 4d6 and character 6 (Ecclesitheurge Cleric 5, its 3rd-level increase replaced) 2d6', () => {
    expect(dice(sheet(checked, [classes.cleric, 1]))).toEqual([
      `${keys.channelEnergy}: 1d6`,
    ]);
    // Character 3.
    expect(dice(sheet(checked, [classes.cleric, 8]))).toEqual([
      `${keys.channelEnergy}: 4d6`,
    ]);
    // Character 6 (the Monk level aside).
    expect(
      dice(sheet(checked, [classes.cleric, 5, archetypes.ecclesitheurge])),
    ).toEqual([`${keys.channelEnergy}: 2d6`]);
    expect(dice(sheet(checked, [classes.cleric, 5]))).toEqual([
      `${keys.channelEnergy}: 3d6`,
    ]);
    expect(dice(sheet(checked, [classes.cleric, 20]))).toEqual([
      `${keys.channelEnergy}: 10d6`,
    ]);
  });

  it('checked: Channel Positive Energy is ceil(paladin level / 2) d6, so character 12 (Paladin 4) channels 2d6', () => {
    const channel = (level: number) =>
      dice(sheet(checked, [classes.paladin, level])).filter((line) =>
        line.startsWith(keys.channelPositiveEnergy),
      );
    // Character 12.
    expect(channel(4)).toEqual([`${keys.channelPositiveEnergy}: 2d6`]);
    expect(channel(5)).toEqual([`${keys.channelPositiveEnergy}: 3d6`]);
    expect(channel(20)).toEqual([`${keys.channelPositiveEnergy}: 10d6`]);
    expect(channel(3)).toEqual([]);
  });

  it('checked: Lay on Hands is floor(paladin level / 2) d6, so character 12 (Paladin 4) lays on 2d6', () => {
    const layOnHands = (level: number) =>
      dice(sheet(checked, [classes.paladin, level])).filter((line) =>
        line.startsWith(keys.layOnHands),
      );
    expect(layOnHands(2)).toEqual([`${keys.layOnHands}: 1d6`]);
    // Character 12.
    expect(layOnHands(4)).toEqual([`${keys.layOnHands}: 2d6`]);
    expect(layOnHands(12)).toEqual([`${keys.layOnHands}: 6d6`]);
  });

  it('checked: a Cleric 5 / Paladin 4 keeps each class’s dice its own on the real rows: 3d6 and 2d6 channels, 2d6 lay on hands', () => {
    expect(
      dice(
        characterSheet(checked, [
          [classes.cleric, 5],
          [classes.paladin, 4],
        ]),
      ).sort(),
    ).toEqual(
      [
        `${keys.channelEnergy}: 3d6`,
        `${keys.channelPositiveEnergy}: 2d6`,
        `${keys.layOnHands}: 2d6`,
      ].sort(),
    );
  });
});
