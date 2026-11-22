// party-curation-6 (#716; docs/catalog-import/party-structures-668.md): the
// structure records of the Ecclesitheurge cleric archetype (#668) and four of
// its five owned features, written drafted and checked by the record step on
// a captured review. The archetype replaces the channel energy increase gained
// at 3rd level, not the mapper's row at 5th; Domain Mastery is Product Identity
// and the owner's, so it has no record. Every case runs on the pinned tree.
import { readFile } from 'node:fs/promises';
import { afterAll, describe, expect, it } from 'vitest';
import { assessCatalogAdmission } from '../../scripts/catalog/admission';
import { importCatalog } from '../../scripts/catalog/import';
import { pcgenPin } from '../../scripts/catalog/inventory';
import { pcgenOwnerSelection } from '../../scripts/catalog/pcgen-owners';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import type { StructureRecord } from '../../scripts/catalog/structure-curation';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import {
  ownerEmissionFoundryFiles,
  pcgenOwnerEmissionFiles,
} from '../fixtures/pcgen-716/owner-emission-files';
import { materializePinnedTree } from './pinned-sources';

const tree = await materializePinnedTree([
  ...ownerEmissionFoundryFiles,
  ...pcgenOwnerEmissionFiles.map(
    (path) => `pcgen/${pcgenPin.directory}/${path}`,
  ),
]);
afterAll(() => tree.dispose());

const remaps: unknown = JSON.parse(
  await readFile('scripts/catalog/reviewed-remaps.json', 'utf8'),
);

const root = 'everythingpath/cleric-ecclesitheurge';
const domainMastery = `${root}-domain-mastery`;
const acg = 'roleplaying_game/advanced_class_guide/acg_abilities_class.lst';
const owned = (name: string) => [
  { kind: 'ownedFeature', id: `pcgen:${acg}#Ecclesitheurge ~ ${name}` },
];
const channelEnergy = 'pf1/kXXz1lO4i7CibHJ9';
/** The record step's receipt: the captured review that checked the five records. */
const RECEIPT =
  't3-review-08ed259d90e142e339a0516ea185a73236a0a954decf7f3d71e596eadcbfeb8c';

/** The archetype's rows: the channel energy increase gained at 3rd level (cleric.html:359). */
const rootFields = {
  'detail.featureChanges': [
    { externalKey: channelEnergy, classLevel: 3, scope: 'part' },
  ],
  'detail.replaces': [
    {
      externalKey: 'everythingpath/cleric-channel-energy-3',
      classLevel: 3,
      scope: 'part',
    },
  ],
};

/** The five records as the batch report gives them, rationale aside (PRD advancedClassGuide/classOptions/cleric.html:351-359; PCGen acg_abilities_class.lst:3014-3021, :4633). */
const expected = [
  {
    externalKey: root,
    sourceSha256:
      'a055757718f8d899f4959242684905508adcde2b909d0eb6fcd4537ca1db6d6a',
    fields: rootFields,
    resolves: [
      { kind: 'conflict', id: 'partialFormula:channel-energy' },
      { kind: 'conflict', id: 'defect:channel-energy-steps' },
      { kind: 'conflict', id: 'defect:cleric-unwired-flags' },
      { kind: 'conflict', id: 'stackingGuard' },
    ],
  },
  {
    // PCGen's DESC (:3018) with its %1 range as the PRD prints it (:353).
    externalKey: `${root}-blessing-of-the-faithful`,
    sourceSha256:
      '91fff8b68563131db522b6061084d33d290a13a55ddff324307bf1312849faec',
    fields: {
      description:
        "As a standard action, the ecclesitheurge can bless one ally within close range (25 ft. + 5 ft./2 levels). A blessed ally gains a +2 sacred or profane bonus (depending on whether the ecclesitheurge channels positive or negative energy) on attack rolls, skill checks, ability checks, or saving throws or to AC until the ecclesitheurge's next turn. The ecclesitheurge can expend 1 use of channel energy when activating this ability to increase the duration to a number of rounds equal to the number of dice of his channel energy.",
    },
    resolves: owned('Blessing of the Faithful'),
  },
  {
    externalKey: `${root}-bonded-holy-symbol`,
    sourceSha256:
      'cde9f01e0f198dd8d209beb88b36eb11308a7e9667c1d2486f95ae173566dd32',
    fields: {
      description:
        "At 3rd level, an ecclesitheurge forms a powerful bond with a holy symbol of his deity, which functions identically to a wizard's bonded object except it can be used to cast cleric and domain spells (instead of wizard spells) and the ecclesitheurge can grant his bonded holy symbol only magic abilities appropriate for a holy symbol or a neck slot item. As with a wizard's bonded item, an ecclesitheurge can add additional magic abilities to his bonded holy symbol as if he had the required item creation feat (typically Craft Wondrous Item), provided he meets the feat's level prerequisite. For example, an ecclesitheurge with a bonded holy symbol who wants to add a wondrous amulet ability, like amulet of natural armor, to his bonded holy symbol must be at least 3rd level to do so. The magic properties of a bonded holy symbol, including any magic abilities the ecclesitheurge added to the object, function only for the ecclesitheurge. If a bonded holy symbol's owner dies or the item is replaced, the object loses all enhancements the ecclesitheurge added using this ability. This ability replaces the increase to channel energy gained at 3rd level.",
    },
    resolves: owned('Bonded Holy Symbol'),
  },
  {
    externalKey: `${root}-ecclesitheurges-vow`,
    sourceSha256:
      '14690fe477470233a5304c6e779ca6e9e8425929daa9b1ae27b7dddaa3786454',
    fields: {
      description:
        'At 1st level, an ecclesitheurge makes a vow to his deity to protect himself solely with his faith, not with armor or shields. An ecclesitheurge who wears armor or uses a shield is unable to use his blessing of the faithful ability, to use cleric domain powers, or to cast cleric spells.',
    },
    resolves: owned("Ecclesitheurge's Vow"),
  },
  {
    externalKey: `${root}-weapon-and-armor-proficiency`,
    sourceSha256:
      'c765ad38c42d90f3535eb116efe8c0a47cae9e810a686a76c65919a18a79a320',
    fields: {
      description:
        "An ecclesitheurge is proficient with the club, dagger, heavy crossbow, light crossbow, and quarterstaff, but he's not proficient with any type of armor or shield. This ability replaces the cleric's weapon and armor proficiency.",
    },
    resolves: owned('Weapon and Armor Proficiency'),
  },
];
const features = expected.slice(1);
const batchKeys = new Set(expected.map(({ externalKey }) => externalKey));
const committed = (reviewedCuration.structures ?? [])
  .filter((record) => batchKeys.has(record.externalKey))
  .sort((a, b) => (a.externalKey < b.externalKey ? -1 : 1));

/**
 * The committed records, drafted in memory: each becomes a copy without its
 * reviewer, date and receipt, as the batch wrote it. They replace the
 * committed records of their subjects.
 */
const draftedInMemory = committed.map(
  (record): StructureRecord => ({
    externalKey: record.externalKey,
    sourceSha256: record.sourceSha256,
    fields: record.fields,
    resolves: record.resolves,
    rationale: record.rationale,
    status: 'drafted',
  }),
);
const withStructures = (structures: readonly StructureRecord[]) => ({
  ...reviewedCuration,
  structures: [
    ...(reviewedCuration.structures ?? []).filter(
      (record) => !batchKeys.has(record.externalKey),
    ),
    ...structures,
  ],
});

const selection = pcgenOwnerSelection.filter(
  ({ key }) => key === 'Cleric Archetype ~ Ecclesitheurge',
);
type Artifact = Awaited<ReturnType<typeof importCatalog>>;
const emit = (curation: unknown) =>
  importCatalog({
    systemPath: tree.systemPath,
    contentPath: tree.contentPath,
    remaps,
    curation,
    pcgen: { path: tree.pcgenPath, selection },
    wholeCorpus: false,
  });
const outcomeOf = (artifact: Artifact, key: string) => {
  const gate = assessCatalogAdmission({ artifact, ...reviewedAdmission });
  for (const kind of ['admitted', 'held', 'dependentOmissions'] as const) {
    const row = gate[kind].find((item) => item.externalKey === key);
    if (row) return { kind, reason: row.reason };
  }
  const failure = gate.failures.find((item) => item.externalKey === key);
  return failure ? { kind: 'failed', reason: failure.reason } : undefined;
};

const checked = await emit(reviewedCuration);
// Drafted, the records apply nothing: the archetype's detail is the mapper's.
const drafted = await emit(withStructures(draftedInMemory));

const ours = <T extends { externalKey: string }>(items: readonly T[]) =>
  items.filter(
    ({ externalKey }) =>
      batchKeys.has(externalKey) || externalKey === domainMastery,
  );
const entryOf = (artifact: Artifact, key: string) =>
  artifact.catalog.entries.find((item) => item.externalKey === key);
const productIdentity = {
  kind: 'held',
  reason: `Product Identity: DESCISPI (${acg}:3020)`,
};

describe('the Ecclesitheurge structure records (party-curation-6, #716)', () => {
  it('are committed with exactly the reviewed fields, items and source hashes, and none for Domain Mastery', () => {
    expect(
      committed.map(({ externalKey, sourceSha256, fields, resolves }) => ({
        externalKey,
        sourceSha256,
        fields,
        resolves,
      })),
    ).toEqual(expected);
    expect(
      (reviewedCuration.structures ?? []).filter(
        ({ externalKey }) => externalKey === domainMastery,
      ),
    ).toEqual([]);
  });

  it('as committed, checked, settle the archetype’s four items and four owned features and apply; the four features are admitted under #227 on PZO1129, and the archetype is omitted behind Domain Mastery, held on Product Identity', () => {
    const report = checked.structure;
    if (!report) throw new Error('No structure report');
    expect({
      handReview: ours(report.handReview),
      unreviewedFeatures: ours(report.unreviewedFeatures).map(
        ({ externalKey }) => externalKey,
      ),
      invalid: report.invalid,
      conflicts: ours(report.conflicts),
      stale: ours(report.stale),
      held: report.held.filter(
        (key) => batchKeys.has(key) || key === domainMastery,
      ),
    }).toEqual({
      handReview: [],
      // Domain Mastery alone: the owner's (Product Identity), no record.
      unreviewedFeatures: [domainMastery],
      invalid: [],
      conflicts: [],
      stale: [],
      held: [domainMastery],
    });
    expect(
      ours(report.applied)
        .map(({ externalKey }) => externalKey)
        .sort(),
    ).toEqual(expected.map(({ externalKey }) => externalKey));
    for (const { externalKey, fields } of features) {
      expect(outcomeOf(checked, externalKey), externalKey).toEqual({
        kind: 'admitted',
        reason: 'Admitted under #227: declared book PZO1129.',
      });
      expect(entryOf(checked, externalKey), externalKey).toMatchObject({
        ...fields,
        detail: { kind: 'classFeature' },
        // No record gives a number on the sheet.
        modifiers: [],
      });
    }
    // The archetype's detail.adds names Domain Mastery, so it waits on the
    // owner's Product Identity answer (O5) however its own gate reads.
    expect(outcomeOf(checked, root)).toEqual({
      kind: 'dependentOmissions',
      reason: `Dependent omission: ${domainMastery}.`,
    });
    expect(outcomeOf(checked, domainMastery)).toEqual(productIdentity);
  });

  it('as committed, checked, replace the channel energy increase gained at 3rd level, not the mapper’s row at 5th, and keep the mapper’s additions; the Cleric’s channel energy rows stay admitted', () => {
    const detail = entryOf(checked, root)?.detail;
    if (detail?.kind !== 'archetype') throw new Error('No archetype');
    expect({
      replaces: detail.replaces,
      featureChanges: detail.featureChanges,
    }).toEqual({
      replaces: rootFields['detail.replaces'],
      featureChanges: rootFields['detail.featureChanges'],
    });
    // The mapper's row, by PCGen's ChannelEnergy3 in order, is at 5th.
    const mapped = entryOf(drafted, root)?.detail;
    if (mapped?.kind !== 'archetype') throw new Error('No archetype');
    expect(mapped.replaces).toEqual([
      {
        classLevel: 5,
        externalKey: 'everythingpath/cleric-channel-energy-5',
        scope: 'part',
      },
    ]);
    expect(detail.adds).toEqual(mapped.adds);
    expect(detail.adds).toContainEqual({
      classLevel: 1,
      externalKey: `${root}-blessing-of-the-faithful`,
    });
    // The sheet computes no channel dice: every row carries no modifier.
    for (const key of [
      channelEnergy,
      'everythingpath/cleric-channel-energy-3',
      'everythingpath/cleric-channel-energy-5',
    ]) {
      expect(outcomeOf(checked, key)?.kind, key).toBe('admitted');
      expect(entryOf(checked, key)?.modifiers, key).toEqual([]);
    }
  });

  it('are checked by the record step, and drafted, hold the archetype on its four items and the four features on structure', () => {
    // The status-dependent case: the record step checked the committed
    // records, so the batch's drafted state is rebuilt in memory.
    expect(
      committed.map((record) =>
        record.status === 'checked' ? record.receipt : record.status,
      ),
    ).toEqual(expected.map(() => RECEIPT));
    const report = drafted.structure;
    if (!report) throw new Error('No structure report');
    expect(ours(report.applied)).toEqual([]);
    expect(outcomeOf(drafted, root)).toEqual({
      kind: 'held',
      reason:
        'Structure hand review (#716 plan §6): conflict partialFormula:channel-energy; conflict defect:channel-energy-steps; conflict defect:cleric-unwired-flags; conflict stackingGuard.',
    });
    for (const name of [
      'Weapon and Armor Proficiency',
      "Ecclesitheurge's Vow",
      'Blessing of the Faithful',
      'Bonded Holy Symbol',
    ]) {
      const key = `${root}-${name.toLowerCase().replaceAll("'", '').replaceAll(' ', '-')}`;
      expect(outcomeOf(drafted, key), name).toEqual({
        kind: 'held',
        reason: `Structure hand review (#716 plan §6): owned feature pcgen:${acg}#Ecclesitheurge ~ ${name}.`,
      });
    }
    expect(outcomeOf(drafted, domainMastery)).toEqual(productIdentity);
  });
});
