// party-curation-5 (#716; docs/catalog-import/party-structures-662.md): the
// structure records of the Mad Dog barbarian archetype (#662) and its seven
// owned features, written drafted and checked by the record step on a
// captured review. The archetype's own damage reduction is an addition at 10th
// level that removes or alters no Barbarian row (root's
// default on the owner's open question G2). Every case runs on the pinned
// tree.
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

const root = 'everythingpath/barbarian-mad-dog';
/** The record step's captured review that checked the eight records. */
const RECEIPT =
  't3-review-fbabc9ada1c607828183d4910aee9f9a6fddf67218a3c732eb81af082ae0cd6d';
const anar = 'player_companion/animal_archive/anar_abilities_class.lst';
const owned = (name: string) => [
  { kind: 'ownedFeature', id: `pcgen:${anar}#Mad Dog ~ ${name}` },
];
/** The Barbarian's Damage Reduction and its increments (the reviewed schedule). */
const barbarianDamageReduction = [
  'pf1/RENIeTVjWB7Mq6Mw',
  'everythingpath/barbarian-damage-reduction-10',
  'everythingpath/barbarian-damage-reduction-13',
  'everythingpath/barbarian-damage-reduction-16',
  'everythingpath/barbarian-damage-reduction-19',
];
const ragePowerParts = [
  { externalKey: 'pf1/HdzsFdoGauXFjU2S', classLevel: 2, scope: 'part' },
  ...[6, 10, 14, 18].map((classLevel) => ({
    externalKey: `everythingpath/barbarian-rage-power-${classLevel}`,
    classLevel,
    scope: 'part',
  })),
];
const wholeRows = [
  ['pf1/WSqWT9ZIshtC5vlV', 1], // Rage
  ['pf1/7WaQxnVaaoL4AGr8', 2], // Uncanny Dodge
  ['pf1/ZfnHhhTFQVo0Lj4P', 5], // Improved Uncanny Dodge
  ['pf1/Q3x319WbNkCssApD', 14], // Indomitable Will
] as const;

/** The eight records as the batch report gives them, rationale aside (PCGen anar_abilities_class.lst:7, :81-87). */
const expected = [
  {
    externalKey: root,
    sourceSha256:
      'd54069a66e9d4395599afa42c7beff8e89b249aba46857d96539b2182f94bc75',
    fields: {
      'detail.adds': [
        { externalKey: `${root}-war-beast`, classLevel: 1 },
        { externalKey: `${root}-pack-tactics`, classLevel: 2 },
        { externalKey: `${root}-rage`, classLevel: 4 },
        { externalKey: `${root}-ferocious-fetch`, classLevel: 5 },
        { externalKey: `${root}-damage-reduction`, classLevel: 10 },
        { externalKey: `${root}-throat-cutter`, classLevel: 14 },
        { externalKey: `${root}-rage-powers`, classLevel: 1 },
      ],
      'detail.featureChanges': [
        ...wholeRows.map(([externalKey]) => ({ externalKey, scope: 'whole' })),
        ...[2, 6, 10, 14, 18].map((classLevel) => ({
          externalKey: 'pf1/HdzsFdoGauXFjU2S',
          classLevel,
          scope: 'part',
        })),
      ],
      'detail.replaces': [
        ...wholeRows.map(([externalKey, classLevel]) => ({
          externalKey,
          classLevel,
          scope: 'whole',
        })),
        ...ragePowerParts,
      ],
    },
    resolves: [
      { kind: 'unmatchedReplacement', id: 'unknown:CFRagePower' },
      { kind: 'unmatchedReplacement', id: 'alters:damage-reduction' },
      { kind: 'conflict', id: 'stackingGuard' },
    ],
  },
  {
    externalKey: `${root}-damage-reduction`,
    sourceSha256:
      '200d2a0bd17e0c11e079dd1b90a9ad27a913ddbf6a76fcb6702603430514a4d4',
    fields: {
      description:
        "At 10th level, a mad dog gains damage reduction. At 13th level and every 3 barbarian levels thereafter, this damage reduction rises by 1, to a maximum of DR 4/- at 19th level. A mad dog's war beast gains the same damage reduction as the mad dog.",
    },
    resolves: owned('Damage Reduction'),
  },
  {
    externalKey: `${root}-ferocious-fetch`,
    sourceSha256:
      'fe3f249ef023abe056f9e431495b14b70d47437c14075edc996cf241eb14b325',
    fields: {
      description:
        "At 5th level, a mad dog's war beast gains Improved Drag (APG) as a bonus feat. As a swift action, a mad dog can command her war beast to move toward an opponent within 30 feet and attempt a drag combat maneuver to pull the target back toward the mad dog. The war beast can move before and after performing the maneuver, but this movement counts toward the war beast's total movement during its turn. This ability replaces improved uncanny dodge.",
    },
    resolves: owned('Ferocious Fetch'),
  },
  {
    externalKey: `${root}-pack-tactics`,
    sourceSha256:
      'ca20729b4dd99172bed246fffc3261f4ba6acf30879d9ee48b06b929b642a0c7',
    fields: {
      description:
        'At 2nd level, a mad dog and her war beast gain a +4 bonus on attack rolls while flanking the same opponent (instead of the normal +2 bonus). This ability replaces uncanny dodge.',
    },
    resolves: owned('Pack Tactics'),
  },
  {
    externalKey: `${root}-rage`,
    sourceSha256:
      '674981ad79894ce254b7095cce9bcfb43bfa61c725bfeb505d43a9b2b24407eb',
    fields: {
      description:
        'A mad dog gains this ability at 4th level, except that her effective barbarian level for the ability is equal to her barbarian level - 3.',
    },
    resolves: owned('Rage'),
  },
  {
    externalKey: `${root}-rage-powers`,
    sourceSha256:
      '2e6ce974466332e3ba885185e5250d956e3be56a3254efd46cadc4506068045e',
    fields: {},
    noMechanics: true,
    resolves: owned('Rage Powers'),
  },
  {
    externalKey: `${root}-throat-cutter`,
    sourceSha256:
      '7d23582c87fee608fc372c3ee3d70c2c84bd4f609098cad4498a5e719708eeab',
    fields: {
      description:
        'At 14th level, whenever her war beast succeeds at a bull rush, drag, grapple, overrun, or trip combat maneuver against an opponent threatened by the mad dog, a mad dog can take an attack of opportunity against that opponent. This ability replaces indomitable will.',
    },
    resolves: owned('Throat Cutter'),
  },
  {
    // The companion-e3 handoff's record, never noMechanics.
    externalKey: `${root}-war-beast`,
    sourceSha256:
      '7623c921209f6da274bb47189bb33c30b2bf032b5887529fdc33069cc198226b',
    fields: {
      description:
        "At 1st level, a mad dog gains the service of an animal companion, using the barbarian's level as her effective druid level. This ability replaces the rage powers gained at 2nd, 6th, 10th, 14th, and 18th level.",
    },
    resolves: owned('War Beast'),
  },
];
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
    ...(record.noMechanics ? { noMechanics: true } : {}),
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
  ({ key }) => key === 'Barbarian Archetype ~ Mad Dog',
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

const ours = <T extends { externalKey: string }>(items: readonly T[]) =>
  items.filter(({ externalKey }) => batchKeys.has(externalKey));
const entryOf = (artifact: Artifact, key: string) =>
  artifact.catalog.entries.find((item) => item.externalKey === key);

describe('the Mad Dog structure records (party-curation-5, #716)', () => {
  it('are committed with exactly the reviewed fields, items and source hashes', () => {
    expect(
      committed.map(
        ({ externalKey, sourceSha256, fields, noMechanics, resolves }) => ({
          externalKey,
          sourceSha256,
          fields,
          ...(noMechanics ? { noMechanics } : {}),
          resolves,
        }),
      ),
    ).toEqual(expected);
  });

  it('as committed, checked, settle the archetype’s and the seven features’ structure gates and apply, and the eight rows are admitted under #227 on PZO9429', () => {
    const report = checked.structure;
    if (!report) throw new Error('No structure report');
    expect({
      handReview: ours(report.handReview),
      unreviewedFeatures: ours(report.unreviewedFeatures),
      invalid: report.invalid,
      conflicts: ours(report.conflicts),
      stale: ours(report.stale),
    }).toEqual({
      handReview: [],
      unreviewedFeatures: [],
      invalid: [],
      conflicts: [],
      stale: [],
    });
    expect(report.held.filter((key) => batchKeys.has(key))).toEqual([]);
    // The seven field records apply; the noMechanics disposition binds nothing.
    expect(
      ours(report.applied)
        .map(({ externalKey }) => externalKey)
        .sort(),
    ).toEqual(
      expected
        .filter((record) => !record.noMechanics)
        .map(({ externalKey }) => externalKey),
    );
    for (const { externalKey } of expected)
      expect(outcomeOf(checked, externalKey), externalKey).toEqual({
        kind: 'admitted',
        reason: 'Admitted under #227: declared book PZO9429.',
      });
    for (const { externalKey, fields } of expected.slice(1))
      expect(entryOf(checked, externalKey), externalKey).toMatchObject({
        ...('description' in fields ? fields : {}),
        detail: { kind: 'classFeature' },
        // No record gives a number on the sheet.
        modifiers: [],
      });
  });

  it('as committed, checked, add the archetype’s damage reduction at 10th level and leave the Barbarian’s damage reduction unreplaced and unchanged', () => {
    const detail = entryOf(checked, root)?.detail;
    if (detail?.kind !== 'archetype') throw new Error('No Mad Dog archetype');
    expect(detail.adds).toContainEqual({
      externalKey: `${root}-damage-reduction`,
      classLevel: 10,
    });
    const touched = [...detail.replaces, ...(detail.featureChanges ?? [])].map(
      ({ externalKey }) => externalKey,
    );
    for (const key of barbarianDamageReduction)
      expect(touched, key).not.toContain(key);
    // The record re-affirms the mapper's values: the applied detail is the
    // reviewed one, field for field.
    const fields = expected[0]?.fields ?? {};
    expect({
      replaces: detail.replaces,
      adds: detail.adds,
      featureChanges: detail.featureChanges,
    }).toEqual({
      replaces: fields['detail.replaces'],
      adds: fields['detail.adds'],
      featureChanges: fields['detail.featureChanges'],
    });
  });

  it('are checked by the record step, and drafted, hold the archetype and all seven features on structure', async () => {
    // The status-dependent case: the record step checked the committed
    // records, so the batch's drafted state is rebuilt in memory.
    expect(
      committed.map((record) =>
        record.status === 'checked' ? record.receipt : record.status,
      ),
    ).toEqual(expected.map(() => RECEIPT));
    const drafted = await emit(withStructures(draftedInMemory));
    const report = drafted.structure;
    if (!report) throw new Error('No structure report');
    expect(ours(report.applied)).toEqual([]);
    expect(outcomeOf(drafted, root)).toEqual({
      kind: 'held',
      reason:
        'Structure hand review (#716 plan §6): unmatchedReplacement unknown:CFRagePower; unmatchedReplacement alters:damage-reduction; conflict stackingGuard.',
    });
    for (const name of [
      'War Beast',
      'Pack Tactics',
      'Rage',
      'Ferocious Fetch',
      'Damage Reduction',
      'Throat Cutter',
      'Rage Powers',
    ])
      expect(
        outcomeOf(
          drafted,
          `${root}-${name.toLowerCase().replaceAll(' ', '-')}`,
        ),
        name,
      ).toEqual({
        kind: 'held',
        reason: `Structure hand review (#716 plan §6): owned feature pcgen:${anar}#Mad Dog ~ ${name}.`,
      });
  });
});
