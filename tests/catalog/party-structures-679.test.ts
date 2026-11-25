// party-curation-4 (#716; docs/catalog-import/party-structures-679.md): the
// structure records of three of the Scaled Fist monk archetype's five owned
// features (#679), written drafted and checked by the record step on a
// captured review. The archetype root is held on Product Identity and is not
// settled here; Draconic Fury and Draconic Breath are the
// owner's (no allowed source gives their text). Every case runs on the
// pinned tree.
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

const root = 'everythingpath/monk-scaled-fist';
const lod = 'player_companion/legacy_of_dragons/lod_abilities_class.lst';
/** The record step's captured review that checked the three records. */
const RECEIPT =
  't3-review-62af97b910787b6a6ddb8b72175cf414f43802ef88889962ea15eafd9a047f7c';
const owned = (name: string) => [
  { kind: 'ownedFeature', id: `pcgen:${lod}#Scaled Fist ~ ${name}` },
];

/** The three records as the batch report gives them, rationale aside: PCGen's DESC verbatim (lod_abilities_class.lst:277-279). */
const expected = [
  {
    externalKey: `${root}-bonus-feats`,
    sourceSha256:
      'd6a22abe63708d3d1f770a35e8ccbe4e206b2aa120461d2ee4f18bbc91eef0ff',
    fields: {
      description:
        'A scaled fist adds Dragon Style and Intimidating Prowess to her list of bonus feats at 1st level. At 6th level, she adds Dazzling Display and Dragon Ferocity. At 10th level, she adds Disheartening Display, Dragon Roar and Shatter Defenses. This ability modifies bonus feats.',
    },
    resolves: owned('Bonus Feats'),
  },
  {
    externalKey: `${root}-draconic-mettle`,
    sourceSha256:
      '5fbe452e8e642d744962ff3bd8107e5f2e00bd824f78249c912e69d24cca12c2',
    fields: {
      description:
        'A scaled fist gains a +2 bonus on saving throws attempted against all fear, paralysis, and sleep effects.',
    },
    resolves: owned('Draconic Mettle'),
  },
  {
    externalKey: `${root}-draconic-might`,
    sourceSha256:
      '4f2ed540c06d64f9a09890a14d7c7eacc059214630ec0ad90466f517d70ba4ab',
    fields: {
      description:
        "Any of the scaled fist's class abilities that make calculations based on her Wisdom (including bonus feats with DCs or uses per day, such as Stunning Fist, but not Wisdom-based skills or Will saving throws) are instead based on her Charisma.",
    },
    resolves: owned('Draconic Might'),
  },
];
const batchKeys = new Set(expected.map(({ externalKey }) => externalKey));
/** The owner's two features with no record (no allowed source gives their text). */
const ownerFeatures = [`${root}-draconic-fury`, `${root}-draconic-breath`];
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
  ({ key }) => key === 'Monk Archetype ~ Scaled Fist',
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

const settled = await emit(reviewedCuration);

const ours = <T extends { externalKey: string }>(items: readonly T[]) =>
  items.filter(({ externalKey }) => batchKeys.has(externalKey));
const heldOnStructure = (name: string) => ({
  kind: 'held',
  reason: `Structure hand review (#716 plan §6): owned feature pcgen:${lod}#Scaled Fist ~ ${name}.`,
});
const productIdentity = {
  kind: 'held',
  reason: `Product Identity: DESCISPI (${lod}:275)`,
};

describe('the Scaled Fist feature structure records (party-curation-4, #716)', () => {
  it('are committed with exactly the reviewed fields, items and source hashes', () => {
    expect(
      committed.map(({ externalKey, sourceSha256, fields, resolves }) => ({
        externalKey,
        sourceSha256,
        fields,
        resolves,
      })),
    ).toEqual(expected);
    for (const record of committed)
      expect(record.noMechanics, record.externalKey).toBeUndefined();
    // No record for the root (Product Identity) or the owner's two features.
    const others = new Set([root, ...ownerFeatures]);
    expect(
      (reviewedCuration.structures ?? []).filter(({ externalKey }) =>
        others.has(externalKey),
      ),
    ).toEqual([]);
  });

  it('as committed, checked, settle the three features’ structure gates and apply, and the three rows are admitted under #227 on PZO9470 while the root stays held on Product Identity', () => {
    const report = settled.structure;
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
    expect(ours(report.applied).map(({ externalKey }) => externalKey)).toEqual(
      expected.map(({ externalKey }) => externalKey),
    );
    for (const { externalKey, fields } of expected) {
      const entry = settled.catalog.entries.find(
        (item) => item.externalKey === externalKey,
      );
      expect(entry, externalKey).toMatchObject({
        ...fields,
        detail: { kind: 'classFeature' },
        // Description only: no number on the sheet.
        modifiers: [],
      });
      expect(outcomeOf(settled, externalKey), externalKey).toEqual({
        kind: 'admitted',
        reason: 'Admitted under #227: declared book PZO9470.',
      });
    }
    // The owner's: no record, so still held on structure.
    expect(
      report.unreviewedFeatures.map(({ externalKey }) => externalKey),
    ).toEqual(expect.arrayContaining(ownerFeatures));
    expect(outcomeOf(settled, `${root}-draconic-fury`)).toEqual(
      heldOnStructure('Draconic Fury'),
    );
    expect(outcomeOf(settled, `${root}-draconic-breath`)).toEqual(
      heldOnStructure('Draconic Breath'),
    );
    expect(outcomeOf(settled, root)).toEqual(productIdentity);
  });

  it('are checked by the record step, and drafted, hold all five features on structure and the root on Product Identity', async () => {
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
    for (const [key, name] of [
      [`${root}-draconic-might`, 'Draconic Might'],
      [`${root}-bonus-feats`, 'Bonus Feats'],
      [`${root}-draconic-mettle`, 'Draconic Mettle'],
      [`${root}-draconic-fury`, 'Draconic Fury'],
      [`${root}-draconic-breath`, 'Draconic Breath'],
    ] as const)
      expect(outcomeOf(drafted, key), key).toEqual(heldOnStructure(name));
    expect(outcomeOf(drafted, root)).toEqual(productIdentity);
  });
});
