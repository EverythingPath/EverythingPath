// @vitest-environment node
// stats-d1 part A (PRD #251; GLOSSARY: Rule value): the curation output kind
// `ruleValue`. A rule-value record in the overlay's `ruleValues` collection
// gives one named entry its rule values; it is written drafted, and only a
// checked one, bound to the entry's current description, applies. Every value
// meets the shared stored schema and its limits, so a malformed one refuses
// the overlay instead of being dropped.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  applyRuleValueCuration,
  findRuleValueRecordConflicts,
  hashText,
  listRuleValueReviews,
  parseCuration,
  ruleValueGroup,
  type RuleValueRecord,
} from '../../scripts/catalog/curation';
import { importCatalog } from '../../scripts/catalog/import';
import type { PreviewEntry } from '../../scripts/catalog/map';
import { runCatalogPreviewCommand } from '../../scripts/catalog/preview';
import { reviewedUnsupportedChanges } from '../../scripts/catalog/racial-trait-rules';
import { runCatalogReleaseOperator } from '../../scripts/catalog/release-operator';
import { readCommittedReleaseVerification } from '../../scripts/catalog/release-verification-committed';
import {
  createCatalogRelease,
  serializeCatalogRelease,
} from '../../scripts/catalog/release';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { reviewedAdmissionSchema } from '../../src/lib/catalog/admission-schema';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { legalResources } from '../../src/lib/catalog/legal-resources-data';
import { validateCatalogReleaseArtifact } from '../../src/lib/catalog/release-schema';
import {
  ruleValueSchema,
  storedRuleValuesSchema,
} from '../../src/lib/character-sheet';
import { maxRuleValuesPerEntry } from '../../src/lib/character-sheet-feature-numbers';
import { catalogRuntimeCompatibility } from '../../src/lib/catalog/runtime-compatibility';
import { materializePinnedTree, pinnedRecordFile } from './pinned-sources';

// Each operator build labels its entries from the committed verification
// projection over the committed launch inventory, which takes seconds to read
// and is the same for every build here: the file reads it once, in the shared
// setup (release-operator-verification.test.ts covers the labels).
vi.mock(
  '../../scripts/catalog/release-verification-committed',
  async (importOriginal) => {
    const original = await importOriginal<{
      readCommittedReleaseVerification: typeof readCommittedReleaseVerification;
    }>();
    let committed: ReturnType<typeof readCommittedReleaseVerification>;
    return {
      readCommittedReleaseVerification: (document?: unknown) =>
        document === undefined
          ? (committed ??= original.readCommittedReleaseVerification())
          : original.readCommittedReleaseVerification(document),
    };
  },
);

const channelEnergy = 'pf1/kXXz1lO4i7CibHJ9';
const increment = 'everythingpath/cleric-channel-energy-3';
const RECEIPT =
  't3-review-0000000000000000000000000000000000000000000000000000000000000000';
const dice = {
  kind: 'ruleValue',
  ruleValue: { kind: 'dice', die: 6, amount: { rows: {} } },
} as const;

function entry(
  externalKey: string,
  overrides: Partial<PreviewEntry> = {},
): PreviewEntry {
  return {
    externalKey,
    upstreamKey: channelEnergy,
    pack: 'class-abilities',
    name: 'Channel Energy',
    detail: { kind: 'classFeature' },
    description: '<p>Channel positive or negative energy.</p>',
    sources: [],
    modifiers: [],
    unsupported: [],
    ...overrides,
  } as PreviewEntry;
}
type RecordFields =
  | keyof RuleValueRecord
  | 'reviewedBy'
  | 'reviewedOn'
  | 'receipt';
function record(
  overrides: Partial<Record<RecordFields, unknown>> = {},
): RuleValueRecord {
  return {
    externalKey: channelEnergy,
    descriptionSha256: hashText(entry(channelEnergy).description),
    outputs: [dice],
    rationale: 'PRD coreRulebook/classes/cleric.html:391.',
    status: 'checked',
    reviewedBy: 'cross-model review',
    reviewedOn: '2026-11-17',
    receipt: RECEIPT,
    ...overrides,
  } as RuleValueRecord;
}
/** The record as written, before the record step checks it. */
function drafted(
  overrides: Partial<Record<RecordFields, unknown>> = {},
): RuleValueRecord {
  const { externalKey, descriptionSha256, outputs, rationale } =
    record(overrides);
  return {
    externalKey,
    descriptionSha256,
    outputs,
    rationale,
    status: 'drafted',
  };
}
const overlay = (ruleValues: unknown[]) =>
  parseCuration({ records: [], ruleValues });

describe('the rule-value record (stats-d1 part A)', () => {
  it('parses a drafted record and a checked one with its receipt; the overlay without one parses as before', () => {
    expect(overlay([drafted()]).ruleValues?.[0]).toMatchObject({
      externalKey: channelEnergy,
      status: 'drafted',
    });
    expect(overlay([record()]).ruleValues).toEqual([record()]);
    expect(parseCuration({ records: [] }).ruleValues).toBeUndefined();
  });

  it.each([
    ['a die of 1', { ruleValue: { kind: 'dice', die: 1, amount: 1 } }],
    [
      'an empty bypass',
      {
        ruleValue: { kind: 'damageReduction', amount: 1, bypass: '' },
      },
    ],
    [
      'a formula over 4,096 characters',
      {
        ruleValue: {
          kind: 'dice',
          die: 6,
          amount: { formula: `1${' + 1'.repeat(1024)}` },
        },
      },
    ],
    [
      'a fractional amount',
      { ruleValue: { kind: 'spellResistance', amount: 1.5 } },
    ],
    [
      'an unknown field',
      { ruleValue: { kind: 'dice', die: 6, amount: 1, sides: 6 } },
    ],
  ])('refuses %s, never dropping it', (_, output) => {
    expect(() =>
      overlay([record({ outputs: [{ kind: 'ruleValue', ...output }] })]),
    ).toThrow(/ruleValue|rule values/);
  });

  it('refuses more than 16 values, no values, a checked record without its receipt and two records for one entry', () => {
    expect(() =>
      overlay([record({ outputs: Array.from({ length: 17 }, () => dice) })]),
    ).toThrow(
      'A rule-value record gives one to the stored limit of rule values.',
    );
    expect(
      overlay([record({ outputs: Array.from({ length: 16 }, () => dice) })]),
    ).toBeTruthy();
    expect(() => overlay([record({ outputs: [] })])).toThrow(
      'A rule-value record gives one to the stored limit of rule values.',
    );
    expect(() => overlay([record({ receipt: undefined })])).toThrow(/receipt/);
    expect(() => overlay([record(), record()])).toThrow(
      `Two rule-value records name ${channelEnergy}.`,
    );
  });

  // rotation-5 fix r1: an increase adds per active copy of its entry, so a
  // duplicated output is refused, never applied twice; and it raises
  // another entry's dice, so one beside its own keyed dice is refused.
  it('refuses a dice increase given twice on one entry and one beside its own keyed dice', () => {
    const focus = {
      kind: 'ruleValue',
      ruleValue: { kind: 'diceIncrease', key: 'channel', amount: 2 },
    } as const;
    expect(() => overlay([record({ outputs: [focus, focus] })])).toThrow(
      'An entry increases the dice of channel once; this one repeats it.',
    );
    expect(() =>
      overlay([
        record({
          outputs: [
            {
              kind: 'ruleValue',
              ruleValue: { ...dice.ruleValue, key: 'channel' },
            },
            focus,
          ],
        }),
      ]),
    ).toThrow(
      'A dice increase raises another entry’s dice; channel is this entry’s own.',
    );
  });

  it('lists each record for the record step by entry and description hash, with its values as the payload', () => {
    const written = drafted();
    const [listed] = listRuleValueReviews([written]);
    expect(listed).toMatchObject({
      id: `rule-value ${channelEnergy} sha256:${written.descriptionSha256}`,
      sources: [
        { subject: channelEnergy, sourceSha256: written.descriptionSha256 },
      ],
      review: { status: 'drafted' },
    });
    const [other] = listRuleValueReviews([
      {
        ...written,
        outputs: [{ ...dice, ruleValue: { ...dice.ruleValue, die: 8 } }],
      },
    ]);
    expect(other?.payloadSha256).not.toBe(listed?.payloadSha256);
  });
});

describe('applyRuleValueCuration (stats-d1 part A)', () => {
  it('gives a checked record’s values to the entry it names and to no other, an increment of the same upstream record included', () => {
    const parent = entry(channelEnergy);
    const row = entry(increment, {
      detail: { kind: 'classFeature', parentFeature: channelEnergy },
    });
    const report = applyRuleValueCuration({
      records: [record()],
      entries: [parent, row],
    });
    expect(parent.ruleValues).toEqual([dice.ruleValue]);
    expect(row).toEqual(
      entry(increment, {
        detail: { kind: 'classFeature', parentFeature: channelEnergy },
      }),
    );
    expect(report).toEqual([{ externalKey: channelEnergy, status: 'applied' }]);
  });

  it('applies nothing from a drafted record: the entry is unchanged', () => {
    const parent = entry(channelEnergy);
    const report = applyRuleValueCuration({
      records: [drafted()],
      entries: [parent],
    });
    expect(parent).toEqual(entry(channelEnergy));
    expect(report).toEqual([{ externalKey: channelEnergy, status: 'drafted' }]);
  });

  // Rotation-4's per-day kinds pass through the same shared stored schema.
  it.each([
    [
      'dailyMaximum',
      {
        kind: 'dailyMaximum',
        key: 'channelEnergy',
        unit: 'uses',
        amount: { formula: '3 + @ability.cha.mod' },
      },
      {
        kind: 'dailyMaximum',
        key: 'channelEnergy',
        unit: 'tallies',
        amount: 3,
      },
    ],
    [
      'dailyMaximumIncrease',
      { kind: 'dailyMaximumIncrease', key: 'channelEnergy', amount: 2 },
      { kind: 'dailyMaximumIncrease', key: '', amount: 2 },
    ],
  ])(
    'a checked record gives a %s rule value to its entry; a malformed one refuses the overlay (rotation-4 kinds)',
    (_, ruleValue, malformed) => {
      const output = { kind: 'ruleValue', ruleValue } as const;
      const parent = entry(channelEnergy);
      expect(
        applyRuleValueCuration({
          records: [overlay([record({ outputs: [output] })]).ruleValues![0]!],
          entries: [parent],
        }),
      ).toEqual([{ externalKey: channelEnergy, status: 'applied' }]);
      expect(parent.ruleValues).toEqual([ruleValue]);
      expect(() =>
        overlay([
          record({ outputs: [{ kind: 'ruleValue', ruleValue: malformed }] }),
        ]),
      ).toThrow(/ruleValue|rule values/);
    },
  );

  it('refuses a checked record reviewed against another description, applying nothing and saying so on the entry once, however often it is applied (fix r1)', () => {
    const parent = entry(channelEnergy, { description: '<p>Changed.</p>' });
    const refused = [
      {
        externalKey: channelEnergy,
        status: 'refused',
        reason: `The rule-value record was reviewed against another description (sha256:${record().descriptionSha256}; the entry's is sha256:${hashText('<p>Changed.</p>')}); it gives no rule values until it is reviewed again.`,
      },
    ];
    const issue = {
      field: 'ruleValues',
      reason:
        'The rule-value record was reviewed against another description; it gives no rule values until it is reviewed again.',
      value: record().descriptionSha256,
    };
    for (let run = 0; run < 2; run++) {
      expect(
        applyRuleValueCuration({ records: [record()], entries: [parent] }),
      ).toEqual(refused);
      expect(parent.ruleValues).toBeUndefined();
      expect(parent.unsupported).toEqual([issue]);
    }
    // Drafted, the record applies nothing anyway: its review binds the hash.
    expect(
      applyRuleValueCuration({ records: [drafted()], entries: [parent] }),
    ).toEqual([{ externalKey: channelEnergy, status: 'drafted' }]);
  });

  it('refuses a record naming an entry the import lacks, checked or drafted, unless the scope being built leaves that entry out, which it reports with the scope’s reason (fix r1), or unverified inputs may merely lack it: then a checked record is not established and a drafted one stays drafted (fix r2)', () => {
    const absent = (key: string) =>
      key === 'pf1/elsewhere'
        ? ({ status: 'omitted', reason: 'outside the release scope' } as const)
        : key.startsWith('pf1/unverified')
          ? ({ status: 'not-established', reason: 'unverified' } as const)
          : undefined;
    expect(
      applyRuleValueCuration({
        records: [
          record({ externalKey: 'pf1/typo' }),
          drafted({ externalKey: 'pf1/drafted-typo' }),
          record({ externalKey: 'pf1/elsewhere' }),
          record({ externalKey: 'pf1/unverified' }),
          drafted({ externalKey: 'pf1/unverified-drafted' }),
        ],
        entries: [entry(channelEnergy)],
        absent,
      }),
    ).toEqual([
      {
        externalKey: 'pf1/typo',
        status: 'refused',
        reason:
          'No entry pf1/typo is in the import, and the scope being built does not leave it out.',
      },
      {
        externalKey: 'pf1/drafted-typo',
        status: 'refused',
        reason:
          'No entry pf1/drafted-typo is in the import, and the scope being built does not leave it out.',
      },
      {
        externalKey: 'pf1/elsewhere',
        status: 'omitted',
        reason: 'outside the release scope',
      },
      {
        externalKey: 'pf1/unverified',
        status: 'not-established',
        reason: 'unverified',
      },
      { externalKey: 'pf1/unverified-drafted', status: 'drafted' },
    ]);
  });

  it('is idempotent and leaves the record unchanged; it refuses an entry that already carries other rule values', () => {
    const checked = record();
    const parent = entry(channelEnergy);
    applyRuleValueCuration({ records: [checked], entries: [parent] });
    const once = structuredClone(parent);
    applyRuleValueCuration({ records: [checked], entries: [parent] });
    expect(parent).toEqual(once);
    expect(checked).toEqual(record());
    // Mutating the applied values never reaches the record.
    parent.ruleValues?.splice(0);
    expect(checked.outputs).toEqual([dice]);
    expect(() =>
      applyRuleValueCuration({
        records: [checked],
        entries: [
          entry(channelEnergy, {
            ruleValues: [{ kind: 'spellResistance', amount: 11 }],
          }),
        ],
      }),
    ).toThrow(`${channelEnergy} already carries other rule values`);
  });
});

// stats-d3: per-day maxima reach entries that already carry checked dice
// (Channel Energy, Lay on Hands), so an entry has one record per group
// (`ruleValueGroup`): its "other" record and its per-day record. The group of
// each kind is the exhaustive mapping asserted below.
describe('a per-day record beside a dice record (stats-d3)', () => {
  const channelUses = {
    kind: 'ruleValue',
    ruleValue: {
      kind: 'dailyMaximum',
      key: 'classFeat_channelEnergy',
      unit: 'uses',
      amount: { formula: '3 + @ability.cha.mod' },
    },
  } as const;
  const perDay = (overrides: Partial<Record<RecordFields, unknown>> = {}) =>
    record({ outputs: [channelUses], ...overrides });

  it('parses one record of each group for an entry; refuses two per-day records for one entry and a record mixing the groups', () => {
    expect(overlay([record(), perDay()]).ruleValues).toEqual([
      record(),
      perDay(),
    ]);
    expect(() => overlay([perDay(), perDay()])).toThrow(
      `Two per-day rule-value records name ${channelEnergy}.`,
    );
    expect(() => overlay([record({ outputs: [dice, channelUses] })])).toThrow(
      'A rule-value record gives per-day values or other rule values, not both.',
    );
  });

  it('lists a per-day record apart from the dice record of its entry, whose ID does not move', () => {
    const [diceListed, perDayListed] = listRuleValueReviews([
      drafted(),
      drafted({ outputs: [channelUses] }),
    ]);
    expect(diceListed?.id).toBe(
      `rule-value ${channelEnergy} sha256:${record().descriptionSha256}`,
    );
    expect(perDayListed?.id).toBe(
      `rule-value ${channelEnergy} per-day sha256:${record().descriptionSha256}`,
    );
  });

  // stats-d3 fix r2: a record is classified from its validated outputs, never
  // by parsing it again. A record the second parse refused was classified
  // `other` silently, so a per-day record lost its group in its ID and in the
  // one-record-per-group check; a record with no outputs has no group and is
  // not a record by type.
  it('classifies a record by its outputs as validated, without parsing them again: a per-day record whose value a second parse would refuse stays per-day', () => {
    const negative = {
      kind: 'ruleValue',
      ruleValue: { ...channelUses.ruleValue, amount: -1 },
    } as const;
    const [listed] = listRuleValueReviews([drafted({ outputs: [negative] })]);
    expect(listed?.id).toBe(
      `rule-value ${channelEnergy} per-day sha256:${record().descriptionSha256}`,
    );
    const empty: Pick<RuleValueRecord, 'outputs'> = {
      // @ts-expect-error A rule-value record gives at least one value.
      outputs: [],
    };
    expect(empty.outputs).toEqual([]);
  });

  it('gives the entry each applied record’s values in record order; a drafted per-day record leaves the checked dice alone; applying twice gives the same entry', () => {
    const parent = entry(channelEnergy);
    expect(
      applyRuleValueCuration({
        records: [record(), drafted({ outputs: [channelUses] })],
        entries: [parent],
      }),
    ).toEqual([
      { externalKey: channelEnergy, status: 'applied' },
      { externalKey: channelEnergy, status: 'drafted' },
    ]);
    expect(parent.ruleValues).toEqual([dice.ruleValue]);

    const both = entry(channelEnergy);
    for (let run = 0; run < 2; run++) {
      expect(
        applyRuleValueCuration({
          records: [record(), perDay()],
          entries: [both],
        }),
      ).toEqual([
        { externalKey: channelEnergy, status: 'applied' },
        { externalKey: channelEnergy, status: 'applied' },
      ]);
      expect(both.ruleValues).toEqual([dice.ruleValue, channelUses.ruleValue]);
    }
  });

  // stats-d3 fix r1: each record meets the limit alone, the pair does not.
  const dieCount = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      kind: 'ruleValue',
      ruleValue: { kind: 'dice', die: index + 2, amount: 1 },
    }));
  const diceId = `rule-value ${channelEnergy} sha256:${record().descriptionSha256}`;
  const perDayId = `rule-value ${channelEnergy} per-day sha256:${record().descriptionSha256}`;

  it('refuses the record that would take its entry past the stored limit of 16, naming both records and the limit, in either order; the earlier record still applies', () => {
    const sixteen = record({ outputs: dieCount(16) });
    const overDice = entry(channelEnergy);
    expect(
      applyRuleValueCuration({
        records: [sixteen, perDay()],
        entries: [overDice],
      }),
    ).toEqual([
      { externalKey: channelEnergy, status: 'applied' },
      {
        externalKey: channelEnergy,
        status: 'refused',
        reason: `${perDayId} cannot apply beside ${diceId}: together they give 17 rule values, and an entry stores at most 16.`,
      },
    ]);
    expect(overDice.ruleValues).toHaveLength(16);

    const overPerDay = entry(channelEnergy);
    expect(
      applyRuleValueCuration({
        records: [perDay(), sixteen],
        entries: [overPerDay],
      }),
    ).toEqual([
      { externalKey: channelEnergy, status: 'applied' },
      {
        externalKey: channelEnergy,
        status: 'refused',
        reason: `${diceId} cannot apply beside ${perDayId}: together they give 17 rule values, and an entry stores at most 16.`,
      },
    ]);
    expect(overPerDay.ruleValues).toEqual([channelUses.ruleValue]);
  });

  it('applies a pair at the limit, and a drafted record beside a full one, since it applies nothing', () => {
    const atLimit = entry(channelEnergy);
    expect(
      applyRuleValueCuration({
        records: [record({ outputs: dieCount(15) }), perDay()],
        entries: [atLimit],
      }).map(({ status }) => status),
    ).toEqual(['applied', 'applied']);
    expect(atLimit.ruleValues).toHaveLength(16);
    expect(
      applyRuleValueCuration({
        records: [
          record({ outputs: dieCount(16) }),
          drafted({ outputs: [channelUses] }),
        ],
        entries: [entry(channelEnergy)],
      }).map(({ status }) => status),
    ).toEqual(['applied', 'drafted']);
  });

  it('the record step’s check: two checked records of one entry over the limit are a problem naming both; drafted records and a pair at the limit are none', () => {
    expect(
      findRuleValueRecordConflicts([
        record({ outputs: dieCount(16) }),
        perDay(),
      ]),
    ).toEqual([
      `${perDayId} cannot apply beside ${diceId}: together they give 17 rule values, and an entry stores at most 16.`,
    ]);
    expect(
      findRuleValueRecordConflicts([
        record({ outputs: dieCount(16) }),
        drafted({ outputs: [channelUses] }),
      ]),
    ).toEqual([]);
    expect(
      findRuleValueRecordConflicts([
        record({ outputs: dieCount(15) }),
        perDay(),
      ]),
    ).toEqual([]);
  });

  // stats-d3 fix r1: the group classifier is exhaustive over the schema's
  // kinds. A kind added to `ruleValueSchema` without a group fails typecheck
  // at `ruleValueGroups` (`satisfies Record<RuleValue['kind'], …>`), and a
  // string that is no kind does not typecheck as an argument.
  it('classifies each kind of the shared schema into its group, per-day maxima and their increases apart from the rest', () => {
    expect(
      Object.fromEntries(
        ruleValueSchema.options.map(({ shape }) => [
          shape.kind.value,
          ruleValueGroup({ kind: shape.kind.value }),
        ]),
      ),
    ).toEqual({
      dice: 'other',
      // rotation-5: a dice increase is reviewed with the dice it is written
      // beside, never with the per-day values.
      diceIncrease: 'other',
      dailyMaximum: 'perDay',
      dailyMaximumIncrease: 'perDay',
      damageReduction: 'other',
      spellResistance: 'other',
    });
    // @ts-expect-error A kind the shared schema does not have.
    expect(() => ruleValueGroup({ kind: 'speed' })).toThrow(
      'No rule-value group for the kind speed.',
    );
  });

  // rotation-5 × stats-d3: a dice increase sits in the "other" group's
  // record, with the dice, apart from the per-day values; a per-day increase
  // of the same key on the entry's other record is no conflict.
  it('a dice increase joins the other group: beside dice in one record it is refused as its own, beside a per-day record of its key it applies', () => {
    const channelIncrease = {
      kind: 'ruleValue',
      ruleValue: {
        kind: 'diceIncrease',
        key: 'classFeat_channelEnergy',
        amount: 2,
      },
    } as const;
    const perDayIncrease = {
      kind: 'ruleValue',
      ruleValue: {
        kind: 'dailyMaximumIncrease',
        key: 'classFeat_channelEnergy',
        amount: 2,
      },
    } as const;
    expect(
      findRuleValueRecordConflicts([
        record({ outputs: [channelIncrease] }),
        perDay({ outputs: [perDayIncrease] }),
      ]),
    ).toEqual([]);
    expect(
      overlay([
        record({ outputs: [channelIncrease] }),
        perDay({ outputs: [perDayIncrease] }),
      ]).ruleValues,
    ).toHaveLength(2);
    expect(() =>
      overlay([record({ outputs: [channelIncrease, perDayIncrease] })]),
    ).toThrow(
      'A rule-value record gives per-day values or other rule values, not both.',
    );
    expect(() =>
      overlay([
        record({
          outputs: [
            {
              kind: 'ruleValue',
              ruleValue: { ...dice.ruleValue, key: 'classFeat_channelEnergy' },
            },
            channelIncrease,
          ],
        }),
      ]),
    ).toThrow(
      'A dice increase raises another entry’s dice; classFeat_channelEnergy is this entry’s own.',
    );
  });

  // The stored schema is the only place the values of two records meet: what
  // it refuses of a list, and not of each value, is what a pair can break.
  // rotation-5 adds the dice-increase check (`diceIncreaseConflict`), which
  // reads only dice and dice increases, both of the other group: one entry's
  // two records (one per group) can break only the limit.
  it('the stored schema’s constraints across an entry’s values are the limit of 16 and the dice-increase check; each kind’s schema constrains one value alone', () => {
    expect(storedRuleValuesSchema.element).toBe(ruleValueSchema);
    expect(
      storedRuleValuesSchema._zod.def.checks?.map(({ _zod }) => ({
        check: _zod.def.check,
        maximum: 'maximum' in _zod.def ? _zod.def.maximum : undefined,
      })),
    ).toEqual([
      { check: 'max_length', maximum: maxRuleValuesPerEntry },
      { check: 'custom', maximum: undefined },
    ]);
    expect(maxRuleValuesPerEntry).toBe(16);
    expect(ruleValueSchema._zod.def.checks ?? []).toEqual([]);
    for (const option of ruleValueSchema.options)
      expect(option._zod.def.checks ?? [], option.shape.kind.value).toEqual([]);
  });
});

describe('the import applies rule-value records (stats-d1 part A)', async () => {
  const tree = await materializePinnedTree([
    'pf1/packs/classes/cleric.SjFqQceVeVBzBwgn.yaml',
    'pf1/packs/class-abilities/channel-energy.kXXz1lO4i7CibHJ9.yaml',
  ]);
  // The feature alone: the release gate refuses a class whose other rows
  // are outside the tree.
  const featureTree = await materializePinnedTree([
    'pf1/packs/class-abilities/channel-energy.kXXz1lO4i7CibHJ9.yaml',
  ]);
  afterAll(() => Promise.all([tree.dispose(), featureTree.dispose()]));
  const remaps: unknown = JSON.parse(
    await readFile('scripts/catalog/reviewed-remaps.json', 'utf8'),
  );
  const emit = (curation: unknown) =>
    importCatalog({
      systemPath: tree.systemPath,
      contentPath: tree.contentPath,
      remaps,
      curation,
      wholeCorpus: false,
    });
  // The overlay as it was before the kind: no rule-value records at all.
  const { ruleValues: _omitted, ...withoutRuleValues } = reviewedCuration;
  const before = await emit(withoutRuleValues);
  const description = before.catalog.entries.find(
    ({ externalKey }) => externalKey === channelEnergy,
  )?.description;
  if (description === undefined) throw new Error('No Channel Energy');
  const withRecord = (status: 'drafted' | 'checked') => ({
    ...withoutRuleValues,
    ruleValues: [
      (status === 'checked' ? record : drafted)({
        descriptionSha256: hashText(description),
      }),
    ],
  });

  it('a checked record’s values reach the preview entry, which the imported entry schema takes; the increments carry none', async () => {
    const checked = await emit(withRecord('checked'));
    const entries = new Map(
      checked.catalog.entries.map((item) => [item.externalKey, item]),
    );
    expect(entries.get(channelEnergy)?.ruleValues).toEqual([dice.ruleValue]);
    expect(
      importedCatalogEntrySchema.parse(entries.get(channelEnergy)).ruleValues,
    ).toEqual([dice.ruleValue]);
    expect(entries.get(increment)?.ruleValues).toBeUndefined();
    expect(checked.curation.ruleValues).toEqual([
      { externalKey: channelEnergy, status: 'applied' },
    ]);
  });

  it('the release build stores a checked record’s values in the entry’s definition', async () => {
    const checked = await importCatalog({
      systemPath: featureTree.systemPath,
      contentPath: featureTree.contentPath,
      remaps,
      curation: withRecord('checked'),
      wholeCorpus: false,
    });
    const registry = reviewedAdmissionSchema.shape.registry.parse(
      JSON.parse(
        await readFile('src/lib/catalog/data/section15-registry.json', 'utf8'),
      ),
    );
    const release = await createCatalogRelease({
      artifact: checked,
      // No Attribution Assessments: Foundry rows admit on their declared books (#227).
      attribution: { assessments: [], registry, evidence: {} },
      legalResources,
      releaseNumber: 1,
      compatibility: catalogRuntimeCompatibility,
      inputValues: {
        remaps,
        curation: withRecord('checked'),
        localData: [],
        parsers: 'rule-value-curation-proof',
        sanitizers: 'rule-value-curation-proof',
        ruleResources: [],
        upstreamVerification: { status: 'unverified' },
      },
    });
    const transported = await validateCatalogReleaseArtifact(
      JSON.parse(serializeCatalogRelease(release)),
    );
    const definitions = transported.batches
      .flat()
      .filter((row) => row.kind === 'definition');
    expect(
      definitions.find((row) => row.key === channelEnergy)?.payload,
    ).toMatchObject({ ruleValues: [dice.ruleValue] });
  });

  it('an overlay without the collection reports no rule-value records', () => {
    expect(before.curation.ruleValues).toBeUndefined();
  });

  it('a drafted record changes no entry: the artifact’s entries are those of the overlay without the kind', async () => {
    const drafted = await emit(withRecord('drafted'));
    expect(drafted.catalog.entries).toEqual(before.catalog.entries);
    expect(drafted.curation.ruleValues).toEqual([
      { externalKey: channelEnergy, status: 'drafted' },
    ]);
  });
});

describe('a rule-value record that cannot apply fails the preview and the release build (stats-d1 fix r1)', async () => {
  const channelPositiveEnergy = 'pf1/tHObxrPeyhimmz9V';
  const layOnHands = 'pf1/WhE4j0Jc82npdMCP';
  const madDog = 'everythingpath/barbarian-mad-dog-damage-reduction';
  const damageReduction = 'pf1/RENIeTVjWB7Mq6Mw';
  // Three features and no class: the release gate refuses a class whose
  // other rows are outside the tree.
  const features = [
    'pf1/packs/class-abilities/channel-energy.kXXz1lO4i7CibHJ9.yaml',
    'pf1/packs/class-abilities/channel-positive-energy.tHObxrPeyhimmz9V.yaml',
    'pf1/packs/class-abilities/lay-on-hands.WhE4j0Jc82npdMCP.yaml',
  ];
  const tree = await materializePinnedTree(features);
  // A whole corpus (`wholeCorpus`, verified checkouts at the pins) has every
  // record a reviewed unsupported change names, or the import fails on the
  // missing one (stats-d2 fix r2): the tree that stands in for it holds them
  // beside the three features.
  const corpusTree = await materializePinnedTree([
    ...features,
    ...(await Promise.all(
      [
        ...new Set(reviewedUnsupportedChanges.map((row) => row.externalKey)),
      ].map(pinnedRecordFile),
    )),
  ]);
  const workspace = await mkdtemp(join(tmpdir(), 'rule-value-refusal-'));
  afterAll(() =>
    Promise.all([
      tree.dispose(),
      corpusTree.dispose(),
      rm(workspace, { recursive: true }),
    ]),
  );
  const remaps: unknown = JSON.parse(
    await readFile('scripts/catalog/reviewed-remaps.json', 'utf8'),
  );
  const registry = reviewedAdmissionSchema.shape.registry.parse(
    JSON.parse(
      await readFile('src/lib/catalog/data/section15-registry.json', 'utf8'),
    ),
  );
  // No Attribution Assessments: Foundry rows admit on their declared books (#227).
  const attribution = { assessments: [], registry, evidence: {} };
  const attributionPath = join(workspace, 'attribution.json');
  await writeFile(attributionPath, JSON.stringify(attribution));
  const emit = (
    curation: unknown,
    options: { wholeCorpus?: boolean; candidateKeys?: string[] } = {},
  ) =>
    importCatalog({
      systemPath: (options.wholeCorpus ? corpusTree : tree).systemPath,
      contentPath: (options.wholeCorpus ? corpusTree : tree).contentPath,
      remaps,
      curation,
      ...options,
      wholeCorpus: options.wholeCorpus ?? false,
    });
  const bare = await emit({ records: [] });
  await readCommittedReleaseVerification();
  const hashOf = (key: string) => {
    const found = bare.catalog.entries.find(
      ({ externalKey }) => externalKey === key,
    );
    if (!found) throw new Error(`No ${key}`);
    return hashText(found.description);
  };
  const current = record({ descriptionSha256: hashOf(channelEnergy) });
  const stale = record({ descriptionSha256: 'f'.repeat(64) });
  const typo = record({ externalKey: 'pf1/typo' });
  const overlayOf = (...ruleValues: RuleValueRecord[]) => ({
    records: [],
    ruleValues,
  });
  const staleReason = `The rule-value record was reviewed against another description (sha256:${'f'.repeat(64)}; the entry's is sha256:${hashOf(channelEnergy)}); it gives no rule values until it is reviewed again.`;
  const typoReason =
    'No entry pf1/typo is in the import, and the scope being built does not leave it out.';
  const notEstablishedReason =
    'Not established: unverified inputs. These inputs are not verified as the whole pinned corpus, so they may be a partial tree that merely lacks the entry.';

  let runs = 0;
  async function preview(curation: unknown, candidates?: string[]) {
    const out = join(workspace, `preview-${++runs}`);
    const curationPath = join(workspace, `curation-${runs}.json`);
    await writeFile(curationPath, JSON.stringify(curation));
    const args = [
      '--system',
      tree.systemPath,
      '--content',
      tree.contentPath,
      '--allow-unverified-checkouts',
      '--attribution',
      attributionPath,
      '--curation',
      curationPath,
      '--out',
      out,
    ];
    if (candidates) {
      const candidatesPath = join(workspace, `candidates-${runs}.json`);
      await writeFile(candidatesPath, JSON.stringify(candidates));
      args.push('--candidates', candidatesPath);
    }
    const result = await runCatalogPreviewCommand({ args });
    const read = async (name: string) =>
      JSON.parse(await readFile(join(out, name), 'utf8'));
    return {
      status: result.status,
      stderr: result.stderr,
      curation: await read('curation.json'),
      admission: await read('admission.json'),
    };
  }
  /**
   * As the release build's operator builds it, with the import it releases:
   * the whole corpus when its inputs are verified.
   */
  async function release(curation: unknown, wholeCorpus = false) {
    const artifact = await emit(curation, { wholeCorpus });
    const built = await createCatalogRelease({
      artifact,
      attribution,
      legalResources,
      releaseNumber: 1,
      compatibility: catalogRuntimeCompatibility,
      inputValues: {
        remaps,
        curation,
        localData: [],
        parsers: 'rule-value-curation-proof',
        sanitizers: 'rule-value-curation-proof',
        ruleResources: [],
        upstreamVerification: { status: 'unverified' },
      },
    });
    return { artifact, release: built };
  }
  /**
   * The release's saved rule-value statuses, in its row-key order (a string
   * sort of `curation:ruleValues:<n>`, so 10 comes before 2), and the import
   * it released.
   */
  async function savedStatuses(curation: unknown) {
    const { artifact, release: built } = await release(curation);
    const transported = await validateCatalogReleaseArtifact(
      JSON.parse(serializeCatalogRelease(built)),
    );
    const statuses = transported.batches
      .flat()
      .filter(
        (row) =>
          row.kind === 'report' && row.key.startsWith('curation:ruleValues:'),
      )
      .map((row) => row.payload);
    return { artifact, statuses };
  }

  /**
   * The release operator's `build`, from these unverified inputs as the
   * reviewers' probe ran it (`--allow-unverified-checkouts`): its refusal,
   * whether it wrote the artifact, and the artifact's saved rule-value
   * statuses and `content:scope` summary.
   */
  async function operatorBuild(curation: unknown) {
    const out = join(workspace, `operator-${++runs}`);
    const curationPath = join(workspace, `curation-${runs}.json`);
    await writeFile(curationPath, JSON.stringify(curation));
    const artifactPath = join(out, 'release.json');
    const failure = await runCatalogReleaseOperator({
      args: [
        'build',
        '--number',
        '1',
        '--schema',
        catalogRuntimeCompatibility.schema,
        '--calculation',
        catalogRuntimeCompatibility.calculation,
        '--system',
        tree.systemPath,
        '--content',
        tree.contentPath,
        '--artifact',
        artifactPath,
        '--allow-unverified-checkouts',
        '--attribution',
        attributionPath,
        '--curation',
        curationPath,
      ],
    }).then(
      () => undefined,
      (error: unknown) =>
        error instanceof Error ? error.message : String(error),
    );
    const rows = await readFile(artifactPath, 'utf8').then(
      async (text) =>
        (await validateCatalogReleaseArtifact(JSON.parse(text))).batches.flat(),
      () => undefined,
    );
    const report = (key: (rowKey: string) => boolean) =>
      rows
        ?.filter((row) => row.kind === 'report' && key(row.key))
        .map((row) => row.payload);
    return {
      failure,
      written: rows !== undefined,
      statuses: report((key) => key.startsWith('curation:ruleValues:')),
      scopeSummary: report((key) => key === 'content:scope')?.[0],
    };
  }

  it('the release operator from unverified inputs (the reviewers’ probe): a checked record naming no entry is saved not established, never omitted, in an artifact with no scope report, which production activation refuses (fix r2)', async () => {
    const notEstablished = [
      {
        externalKey: 'pf1/typo',
        status: 'not-established',
        reason: notEstablishedReason,
      },
    ];
    const unscoped = await operatorBuild(overlayOf(typo));
    expect(unscoped).toMatchObject({
      failure: undefined,
      written: true,
      statuses: notEstablished,
      scopeSummary: undefined,
    });
    // A scoped build's scope fails on it: release-scope-build.test.ts.
  });

  it('the release operator refuses a checked record bound to another description, naming it, and writes no artifact', async () => {
    const result = await operatorBuild(overlayOf(stale));
    expect(result.failure).toContain(
      `"externalKey":"${channelEnergy}","reason":"Refused rule-value record: ${staleReason}"`,
    );
    expect(result.written).toBe(false);
  });

  it('the release operator builds a fixture tree whose records are applied, drafted (a drafted record naming no entry included) or omitted by the scope being built, refusing nothing (fix r2)', async () => {
    const result = await operatorBuild(
      overlayOf(
        current,
        drafted({ externalKey: 'pf1/typo' }),
        record({ externalKey: madDog }),
      ),
    );
    expect(result).toMatchObject({
      failure: undefined,
      statuses: [
        { externalKey: channelEnergy, status: 'applied' },
        { externalKey: 'pf1/typo', status: 'drafted' },
        {
          externalKey: madDog,
          status: 'omitted',
          reason: 'PCGen entries are not in this import (no --pcgen).',
        },
      ],
    });
  });

  it('a checked record whose bound description no longer matches: the preview writes its reports with the record refused and exits 1; the release build refuses, naming it', async () => {
    const result = await preview(overlayOf(stale));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Catalog admission failed');
    expect(result.curation.ruleValues).toEqual([
      { externalKey: channelEnergy, status: 'refused', reason: staleReason },
    ]);
    expect(result.admission.failures).toContainEqual({
      externalKey: channelEnergy,
      reason: `Refused rule-value record: ${staleReason}`,
    });
    await expect(release(overlayOf(stale))).rejects.toThrow(
      `Refused rule-value record: ${staleReason}`,
    );
  });

  it('two checked records of one entry over the stored limit (stats-d3 fix r1): the preview writes its reports with the later record refused, naming both and the limit, and exits 1; the release build refuses, naming it', async () => {
    const sixteen = record({
      descriptionSha256: hashOf(channelEnergy),
      outputs: Array.from({ length: 16 }, () => dice),
    });
    const perDay = record({
      descriptionSha256: hashOf(channelEnergy),
      outputs: [
        {
          kind: 'ruleValue',
          ruleValue: {
            kind: 'dailyMaximum',
            key: 'classFeat_channelEnergy',
            unit: 'uses',
            amount: { formula: '3 + @ability.cha.mod' },
          },
        },
      ],
    });
    const hash = hashOf(channelEnergy);
    const reason = `rule-value ${channelEnergy} per-day sha256:${hash} cannot apply beside rule-value ${channelEnergy} sha256:${hash}: together they give 17 rule values, and an entry stores at most 16.`;
    const result = await preview(overlayOf(sixteen, perDay));
    expect(result.status).toBe(1);
    expect(result.curation.ruleValues).toEqual([
      { externalKey: channelEnergy, status: 'applied' },
      { externalKey: channelEnergy, status: 'refused', reason },
    ]);
    expect(result.admission.failures).toContainEqual({
      externalKey: channelEnergy,
      reason: `Refused rule-value record: ${reason}`,
    });
    await expect(release(overlayOf(sixteen, perDay))).rejects.toThrow(
      `Refused rule-value record: ${reason}`,
    );
  });

  it('a record naming an entry that does not exist is refused when the inputs are the whole pinned corpus, under candidate keys too, and the release build refuses it; unverified inputs, which may be a partial tree, report it not established', async () => {
    const refused = [
      { externalKey: 'pf1/typo', status: 'refused', reason: typoReason },
    ];
    expect(
      (await emit(overlayOf(typo), { wholeCorpus: true })).curation.ruleValues,
    ).toEqual(refused);
    expect(
      (
        await emit(overlayOf(typo), {
          wholeCorpus: true,
          candidateKeys: [channelEnergy],
        })
      ).curation.ruleValues,
    ).toEqual(refused);
    await expect(release(overlayOf(typo), true)).rejects.toThrow(
      `"externalKey":"pf1/typo","reason":"Refused rule-value record: ${typoReason}"`,
    );
    // The preview's fixture tree is unverified: the record is not
    // established, never omitted (fix r2).
    const result = await preview(overlayOf(typo));
    expect(result.status).toBe(0);
    expect(result.curation.ruleValues).toEqual([
      {
        externalKey: 'pf1/typo',
        status: 'not-established',
        reason: notEstablishedReason,
      },
    ]);
  });

  it('an everythingpath key the identity ledger lacks is in no corpus: refused by the preview whatever its inputs', async () => {
    const result = await preview(
      overlayOf(record({ externalKey: 'everythingpath/typo' })),
    );
    const reason =
      'No entry everythingpath/typo is in the import, and the scope being built does not leave it out.';
    expect(result.status).toBe(1);
    expect(result.curation.ruleValues).toEqual([
      { externalKey: 'everythingpath/typo', status: 'refused', reason },
    ]);
    expect(result.admission.failures).toContainEqual({
      externalKey: 'everythingpath/typo',
      reason: `Refused rule-value record: ${reason}`,
    });
  });

  it('an entry the scope being built leaves out is omitted and reported, not refused: a Foundry entry outside the candidate keys, a PCGen entry of the identity ledger without PCGen', async () => {
    const outside = record({
      externalKey: channelPositiveEnergy,
      descriptionSha256: hashOf(channelPositiveEnergy),
    });
    const pcgen = record({ externalKey: madDog });
    const scoped = await preview(overlayOf(current, outside, pcgen), [
      channelEnergy,
    ]);
    expect(scoped.status).toBe(0);
    expect(scoped.curation.ruleValues).toEqual([
      { externalKey: channelEnergy, status: 'applied' },
      {
        externalKey: channelPositiveEnergy,
        status: 'omitted',
        reason: 'Outside the curation batch’s candidate keys.',
      },
      {
        externalKey: madDog,
        status: 'omitted',
        reason: 'PCGen entries are not in this import (no --pcgen).',
      },
    ]);
    expect(scoped.admission.failures).toEqual([]);
    // The same, from the whole corpus.
    expect(
      (
        await emit(overlayOf(current, outside, pcgen), {
          wholeCorpus: true,
          candidateKeys: [channelEnergy],
        })
      ).curation.ruleValues,
    ).toEqual(scoped.curation.ruleValues);
  });

  it('the saved preview and release reports carry each record’s status: applied, drafted and omitted', async () => {
    const curation = overlayOf(
      current,
      drafted({
        externalKey: channelPositiveEnergy,
        descriptionSha256: hashOf(channelPositiveEnergy),
      }),
      record({ externalKey: madDog }),
    );
    const statuses = [
      { externalKey: channelEnergy, status: 'applied' },
      { externalKey: channelPositiveEnergy, status: 'drafted' },
      {
        externalKey: madDog,
        status: 'omitted',
        reason: 'PCGen entries are not in this import (no --pcgen).',
      },
    ];
    const result = await preview(curation);
    expect(result.status).toBe(0);
    expect(result.curation.ruleValues).toEqual(statuses);
    expect(result.admission.curation.ruleValues).toEqual(statuses);
    expect((await savedStatuses(curation)).statuses).toEqual(statuses);
  });

  // The committed records (stats-dr, stats-d3) and the status each saved
  // report gives them on this tree; the preview's two reports and the
  // release's saved one are checked apart, since each build takes seconds.
  const receipt =
    't3-review-39c11ce78df040ad2a4d6b32ded1f4950209fdd7a420f3670f6110f90bc51363';
  const damageReductionReceipt =
    't3-review-2201b12a0aa65199ff87ed0c0f01f8618aac02f36cb6ab41722f79903359c10a';
  // The per-day records (`ruleValueGroup`), which their own tests
  // (rule-values-d3.test.ts, rule-values-domain-powers.test.ts) read:
  // the record step checked thirteen of stats-d3's 30, nine on stats-d3's
  // review, the Magus's Arcane Pool and Extra Arcane Pool on
  // maxima-promote-1's and Bardic Performance and Extra Performance on
  // reward-terms-1's, which this partial tree reports not established;
  // stats-d3's other 17 and domain-powers-1's four are drafted.
  const committed = reviewedCuration.ruleValues ?? [];
  const isPerDay = ({ outputs }: RuleValueRecord) =>
    outputs.some(({ ruleValue }) => ruleValueGroup(ruleValue) === 'perDay');
  const checkedPerDay = [
    'pf1/Aj7SwIo94HfcpR9R',
    'pf1/CW99G919xJkrIWAu',
    'pf1/Jw6BEoNMBxfSN4cu',
    'pf1/MpvhQz62qw68D2pd',
    'pf1/S9lYCsz7oA7v3GzR',
    'pf1/WNi2SBF6Z2zhBMCl',
    'pf1/caNEmbCtoHA7NYtZ',
    'pf1/qI4IouTn4uvDPSXv',
    'pf1/yotHT522pQoKDhID',
    // maxima-promote-1 phase 2.
    'pf1/3lfNiysSNv1ahV4F',
    'pf1/mpe3JHJMINddqLWr',
    // reward-terms-1 phase 2.
    'pf1/6yGoL82RidBHmXPb',
    'pf1/ZfCUTi1MiLgR4T7I',
  ];
  const committedStatuses = [
    {
      externalKey: madDog,
      status: 'omitted',
      reason: 'PCGen entries are not in this import (no --pcgen).',
    },
    {
      externalKey: damageReduction,
      status: 'not-established',
      reason: notEstablishedReason,
    },
    { externalKey: layOnHands, status: 'applied' },
    { externalKey: channelEnergy, status: 'applied' },
    { externalKey: channelPositiveEnergy, status: 'applied' },
  ];
  // Every record's status in record order: among the five above, the
  // per-day records' thirteen checked not established, and of the 21
  // drafted, the Mad Dog's Rage and the Bladebound's pool omitted (PCGen
  // entries, as the Mad Dog's Damage Reduction is) and 19 drafted.
  const reportedInOrder = committed.map((record) =>
    !isPerDay(record)
      ? committedStatuses.find(
          ({ externalKey }) => externalKey === record.externalKey,
        )
      : checkedPerDay.includes(record.externalKey)
        ? {
            externalKey: record.externalKey,
            status: 'not-established',
            reason: notEstablishedReason,
          }
        : record.externalKey.startsWith('everythingpath/')
          ? {
              externalKey: record.externalKey,
              status: 'omitted',
              reason: 'PCGen entries are not in this import (no --pcgen).',
            }
          : { externalKey: record.externalKey, status: 'drafted' },
  );
  /**
   * A report carries every committed record with its status. The release's
   * report rows are not in record order: compare them as rows, in key order
   * (a key with two records, its statuses in order).
   */
  function expectCommittedStatuses(report: unknown) {
    const inKeyOrder = (rows: unknown) =>
      z
        .array(z.looseObject({ externalKey: z.string(), status: z.string() }))
        .parse(rows)
        .sort(
          (a, b) =>
            a.externalKey.localeCompare(b.externalKey) ||
            a.status.localeCompare(b.status),
        );
    const rows = inKeyOrder(report);
    expect(rows).toEqual(inKeyOrder(reportedInOrder));
    const statusCount = (status: string) =>
      rows.filter((row) => row.status === status).length;
    // Thirteen per-day records and the shared Damage Reduction's.
    expect(statusCount('not-established')).toBe(14);
    expect(statusCount('drafted')).toBe(19);
    // Two drafted per-day records and the Mad Dog's Damage Reduction.
    expect(statusCount('omitted')).toBe(3);
    expect(statusCount('applied')).toBe(3);
  }

  it('the committed records: three checked by the record step on a captured review and the shared Damage Reduction’s and the Mad Dog’s on another (stats-dr), so the saved preview reports carry three applied, the shared Damage Reduction’s not established, since this tree lacks its entry and isn’t verified as the whole pinned corpus, and the Mad Dog’s omitted, since this import has no PCGen (a verified --pcgen build reports both applied); of the 34 per-day records (stats-d3’s 30 and domain-powers-1’s four), the thirteen the record step checked (nine on stats-d3’s review, two on maxima-promote-1’s, two on reward-terms-1’s) are not established on this tree, and of the 21 drafted, two on PCGen entries are omitted and 19 drafted, in both reports', async () => {
    const perDay = committed.filter(isPerDay);
    expect(perDay).toHaveLength(34);
    expect(
      perDay
        .filter(({ status }) => status === 'checked')
        .map(({ externalKey }) => externalKey)
        .sort(),
    ).toEqual([...checkedPerDay].sort());
    expect(perDay.filter(({ status }) => status === 'drafted')).toHaveLength(
      21,
    );
    expect(
      committed
        .filter((record) => !isPerDay(record))
        .map((committed) => ({
          externalKey: committed.externalKey,
          status: committed.status,
          receipt: 'receipt' in committed ? committed.receipt : undefined,
        })),
    ).toEqual([
      {
        externalKey: madDog,
        status: 'checked',
        receipt: damageReductionReceipt,
      },
      {
        externalKey: damageReduction,
        status: 'checked',
        receipt: damageReductionReceipt,
      },
      { externalKey: layOnHands, status: 'checked', receipt },
      { externalKey: channelEnergy, status: 'checked', receipt },
      { externalKey: channelPositiveEnergy, status: 'checked', receipt },
    ]);
    const result = await preview(reviewedCuration);
    expect(result.status).toBe(0);
    expectCommittedStatuses(result.curation.ruleValues);
    expectCommittedStatuses(result.admission.curation.ruleValues);
    expect(result.curation.ruleValues).toEqual(reportedInOrder);
    expect(result.admission.curation.ruleValues).toEqual(reportedInOrder);
  });

  it('the committed records in the release build: its saved report gives each the status the preview’s reports give it, and only the three applied records give their entries rule values', async () => {
    const { artifact, statuses } = await savedStatuses(reviewedCuration);
    expectCommittedStatuses(statuses);
    const carrying = artifact.catalog.entries
      .filter(({ ruleValues }) => ruleValues)
      .map(({ externalKey }) => externalKey)
      .sort();
    expect(carrying).toEqual(
      [channelEnergy, channelPositiveEnergy, layOnHands].sort(),
    );
  });
});
