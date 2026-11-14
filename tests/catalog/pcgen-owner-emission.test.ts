/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { readFile } from 'node:fs/promises';
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { afterAll, describe, expect, it } from 'vitest';
import { internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { assessCatalogAdmission } from '../../scripts/catalog/admission';
import { importCatalog } from '../../scripts/catalog/import';
import { pcgenPin } from '../../scripts/catalog/inventory';
import {
  pcgenOwnerSelection,
  type PcgenOwnerSelector,
} from '../../scripts/catalog/pcgen-owners';
import {
  createCatalogRelease,
  serializeCatalogRelease,
} from '../../scripts/catalog/release';
import { reviewedAdmissionSchema } from '../../src/lib/catalog/admission-schema';
import { legalResources } from '../../src/lib/catalog/legal-resources-data';
import { validateCatalogReleaseArtifact } from '../../src/lib/catalog/release-schema';
import type { CatalogReleaseStatus } from '../../src/lib/catalog/release-validators';
import { catalogRuntimeCompatibility } from '../../src/lib/catalog/runtime-compatibility';
import { preloadCalledConvexModules } from '../convex-modules';
import {
  ownerEmissionFoundryFiles,
  pcgenOwnerEmissionFiles,
  wizardClosureFiles,
} from '../fixtures/pcgen-716/owner-emission-files';
import { materializePinnedTree } from './pinned-sources';

// #716 E1 (design archetype-emission §D, §E): the importer emits the chosen
// PCGen archetypes, and only those, through the structure gate, with their
// declared book codes and comparison records, on the pinned tree.

const modules = import.meta.glob('../../convex/**/*.ts');
preloadCalledConvexModules({ modules, testFile: import.meta.url });

const pcgenFiles = pcgenOwnerEmissionFiles.map(
  (path) => `pcgen/${pcgenPin.directory}/${path}`,
);
const owners = await materializePinnedTree([
  ...ownerEmissionFoundryFiles,
  ...pcgenFiles,
]);
const wizardTree = await materializePinnedTree([
  ...wizardClosureFiles,
  ...pcgenFiles,
]);
afterAll(() => Promise.all([owners.dispose(), wizardTree.dispose()]));

const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(path, 'utf8'));
const remaps = await readJson('scripts/catalog/reviewed-remaps.json');
const curation = (await readJson('scripts/catalog/reviewed-curation.json')) as {
  records: unknown[];
  structures?: unknown[];
};
const registry = reviewedAdmissionSchema.shape.registry.parse(
  await readJson('src/lib/catalog/data/section15-registry.json'),
);
/** No Attribution Assessments: #716 and Foundry rows admit on their declared books (#227). */
const attribution = { assessments: [], registry, evidence: {} };

const keys = {
  exploiter: 'everythingpath/wizard-exploiter-wizard',
  reservoir: 'everythingpath/wizard-exploiter-wizard-arcane-reservoir',
  exploit: 'everythingpath/wizard-exploiter-wizard-exploiter-exploit',
  ecclesitheurge: 'everythingpath/cleric-ecclesitheurge',
  domainMastery: 'everythingpath/cleric-ecclesitheurge-domain-mastery',
  bladebound: 'everythingpath/magus-bladebound',
  madDog: 'everythingpath/barbarian-mad-dog',
  scaledFist: 'everythingpath/monk-scaled-fist',
  draconicMight: 'everythingpath/monk-scaled-fist-draconic-might',
};
const acg = 'roleplaying_game/advanced_class_guide/acg_abilities_class.lst';
const exploiterSelector: PcgenOwnerSelector = pcgenOwnerSelection.find(
  ({ key }) => key === 'Wizard Archetype ~ Exploiter Wizard',
)!;

type Artifact = Awaited<ReturnType<typeof importCatalog>>;
/**
 * Imports with the overlay's structure records as `structures` gives them,
 * else the committed ones. The gate-state cases pass `structures: []`, so the
 * structure batches (#702's and the later ones) never change what they hold.
 */
const emit = (
  tree: typeof owners,
  {
    selection,
    structures = curation.structures ?? [],
  }: { selection?: PcgenOwnerSelector[]; structures?: unknown[] } = {},
) =>
  importCatalog({
    systemPath: tree.systemPath,
    contentPath: tree.contentPath,
    remaps,
    curation: { ...curation, structures },
    pcgen: { path: tree.pcgenPath, ...(selection && { selection }) },
  });
/**
 * The committed structure records with the given records in place of those
 * of their subjects: two records binding one field of an entry are refused.
 */
const replacingCommitted = (records: readonly { externalKey: string }[]) => {
  const subjects = new Set(records.map(({ externalKey }) => externalKey));
  return [
    ...(curation.structures ?? []).filter(
      (record) =>
        !subjects.has((record as { externalKey: string }).externalKey),
    ),
    ...records,
  ];
};
const entryOf = (artifact: Artifact, key: string) =>
  artifact.catalog.entries.find((entry) => entry.externalKey === key);
const outcomeOf = (artifact: Artifact, key: string) => {
  const gate = assessCatalogAdmission({ artifact, ...attribution });
  for (const kind of ['admitted', 'held', 'dependentOmissions'] as const) {
    const row = gate[kind].find((item) => item.externalKey === key);
    if (row) return { kind, reason: row.reason };
  }
  const failure = gate.failures.find((item) => item.externalKey === key);
  return failure ? { kind: 'failed', reason: failure.reason } : undefined;
};

const artifact = await emit(owners, { structures: [] });

describe('the chosen owners (#716 E1)', () => {
  it('are emitted with their crosswalk book codes and comparison records', () => {
    const books = Object.fromEntries(
      [
        keys.exploiter,
        keys.ecclesitheurge,
        keys.bladebound,
        keys.madDog,
        keys.scaledFist,
      ].map((key) => [key, entryOf(artifact, key)?.sources]),
    );
    expect(books).toEqual({
      [keys.exploiter]: [{ book: 'PZO1129', pages: '133' }],
      [keys.ecclesitheurge]: [{ book: 'PZO1129', pages: '91' }],
      [keys.bladebound]: [{ book: 'PZO1117', pages: '47' }],
      [keys.madDog]: [{ book: 'PZO9429', pages: '9' }],
      [keys.scaledFist]: [{ book: 'PZO9470', pages: '14' }],
    });
    expect(entryOf(artifact, keys.exploiter)).toMatchObject({
      upstreamKey: `pcgen:${acg}#Wizard Archetype ~ Exploiter Wizard`,
      detail: { kind: 'archetype', classKeys: ['pf1/0c4lYDywj6bQ0i8r'] },
    });
    const comparison = artifact.comparison.records.filter(
      ({ repo }) => repo === 'pcgen',
    );
    expect(comparison.map(({ externalKey }) => externalKey).sort()).toEqual(
      artifact.catalog.entries
        .filter(({ upstreamKey }) => upstreamKey?.startsWith('pcgen:'))
        .map(({ upstreamKey }) => upstreamKey)
        .sort(),
    );
    expect(comparison.every(({ status }) => status === 'admitted')).toBe(true);
    expect(artifact.catalog.inputs.map(({ repo }) => repo)).toContain('pcgen');
  });

  it('hold on attribution as the declared books and Product Identity flags say, else on structure review', () => {
    // A Product Identity flag holds a row on attribution, whatever its
    // structure review. Every other owner is admissible on its declared book
    // (#227): Mad Dog's PZO9429 is confirmed, and the owner cleared the
    // PZO1129 and PZO1117 Section 15 holds on 2026-10-30
    // (`legal/notice-clearances.json`), so those rows hold on structure only.
    const structure = expect.stringMatching(/^Structure hand review/);
    expect({
      exploiter: outcomeOf(artifact, keys.exploiter),
      ecclesitheurge: outcomeOf(artifact, keys.ecclesitheurge),
      bladebound: outcomeOf(artifact, keys.bladebound),
      madDog: outcomeOf(artifact, keys.madDog),
      scaledFist: outcomeOf(artifact, keys.scaledFist),
      draconicMight: outcomeOf(artifact, keys.draconicMight),
      domainMastery: outcomeOf(artifact, keys.domainMastery),
    }).toEqual({
      exploiter: { kind: 'held', reason: structure },
      ecclesitheurge: { kind: 'held', reason: structure },
      bladebound: { kind: 'held', reason: structure },
      madDog: { kind: 'held', reason: structure },
      scaledFist: {
        kind: 'held',
        reason:
          'Product Identity: DESCISPI (player_companion/legacy_of_dragons/lod_abilities_class.lst:275)',
      },
      draconicMight: { kind: 'held', reason: structure },
      // DESCISPI:Yes (acg_abilities_class.lst:3020) reads as the flag.
      domainMastery: {
        kind: 'held',
        reason: `Product Identity: DESCISPI (${acg}:3020)`,
      },
    });
  });

  it('emits no owner outside the selection', () => {
    const emitted = artifact.catalog.entries
      .filter(({ detail }) => detail.kind === 'archetype')
      .map(({ externalKey }) => externalKey)
      .sort();
    expect(emitted).toEqual(
      [
        keys.madDog,
        keys.ecclesitheurge,
        keys.bladebound,
        keys.scaledFist,
        keys.exploiter,
      ].sort(),
    );
    // Spell Sage shares the Exploiter's file (acg_abilities_class.lst:4053).
    expect(
      artifact.catalog.entries.some(({ upstreamKey }) =>
        upstreamKey?.endsWith('#Wizard Archetype ~ Spell Sage'),
      ),
    ).toBe(false);
  });

  it('refuses a chosen owner without a frozen identity', async () => {
    await expect(
      emit(owners, {
        selection: [
          { ...exploiterSelector, key: 'Wizard Archetype ~ Spell Sage' },
        ],
      }),
    ).rejects.toThrow(
      `Wizard Archetype ~ Spell Sage (${acg}) has no frozen identity in everythingpath-identities.json.`,
    );
  });

  it("with a release scope, emits only the owners the scope names, and only the scope's rows", async () => {
    const scoped = (scopeKeys: string[]) =>
      importCatalog({
        systemPath: owners.systemPath,
        contentPath: owners.contentPath,
        remaps,
        curation: { ...curation, structures: [] },
        scopeKeys: [],
        pcgen: { path: owners.pcgenPath, scopeKeys },
      });
    const exploiterRows = [keys.exploiter, keys.reservoir, keys.exploit];
    const emitted = await scoped([...exploiterRows, 'pf1/0c4lYDywj6bQ0i8r']);
    expect(
      emitted.catalog.entries.map(({ externalKey }) => externalKey).sort(),
    ).toEqual(exploiterRows.sort());
    await expect(scoped([keys.exploiter, keys.reservoir])).rejects.toThrow(
      `The selected PCGen owners emit rows the release scope does not name: ${keys.exploit}.`,
    );
    await expect(scoped(['pf1/0c4lYDywj6bQ0i8r'])).rejects.toThrow(
      'The release scope names no selected PCGen owner',
    );
    await expect(
      importCatalog({
        systemPath: owners.systemPath,
        contentPath: owners.contentPath,
        remaps,
        scopeKeys: [],
        pcgen: { path: owners.pcgenPath },
      }),
    ).rejects.toThrow('give the scope keys to both selections');
    await expect(
      importCatalog({
        systemPath: owners.systemPath,
        contentPath: owners.contentPath,
        remaps,
        candidateKeys: [],
        pcgen: { path: owners.pcgenPath },
      }),
    ).rejects.toThrow('never with curation candidate keys');
  });
});

describe('the Exploiter Wizard (#716 E1)', () => {
  const selection = [exploiterSelector];
  /** Test-only checked records settling what the structure gate holds, from design §B. */
  const checkedRecords = (unsettled: Artifact) => {
    const report = unsettled.structure;
    if (!report) throw new Error('No structure report');
    const reviewer = {
      status: 'checked' as const,
      reviewedBy: 'Test fixture',
      reviewedOn: '2026-11-12',
      receipt: 'reviewer-20261018-081620-1216172',
    };
    return [
      ...report.handReview.map((item) => ({
        externalKey: item.externalKey,
        sourceSha256: item.sourceSha256,
        fields: { 'detail.casting': { extraSlots: { remove: ['school'] } } },
        resolves: [{ kind: item.kind, id: item.id }],
        rationale: 'Test-only: the school slot is removed (design §B).',
        ...reviewer,
      })),
      ...report.unreviewedFeatures.map((feature) => ({
        externalKey: feature.externalKey,
        sourceSha256: feature.sourceSha256,
        fields: {},
        noMechanics: true as const,
        resolves: [{ kind: 'ownedFeature' as const, id: feature.locator }],
        rationale: 'Test-only disposition.',
        ...reviewer,
      })),
    ];
  };

  it('is held on its unsettled structure gate, never labelled; once settled, a missing curation record only labels it (#227 slice 4)', async () => {
    // A review hold and a curation gap stay apart: an unsettled structure
    // gate holds the row with its own reason, and a missing curation record
    // beside it neither joins the reason nor admits the row labelled.
    const missingRecord = {
      externalKey: keys.exploiter,
      kind: 'note' as const,
      target: '',
      text: 'Test-only uncurated note.',
      textSha256: '0'.repeat(64),
    };
    const gateWithMissingRecord = (emitted: Artifact) =>
      assessCatalogAdmission({
        artifact: {
          ...emitted,
          curation: {
            ...emitted.curation,
            missing: [...emitted.curation.missing, missingRecord],
          },
        },
        ...attribution,
      });
    const rowsOf = (gate: ReturnType<typeof assessCatalogAdmission>) => ({
      admitted: gate.admitted.filter(
        ({ externalKey }) => externalKey === keys.exploiter,
      ),
      held: gate.held.filter(
        ({ externalKey }) => externalKey === keys.exploiter,
      ),
      failed: gate.failures.filter(
        ({ externalKey }) => externalKey === keys.exploiter,
      ),
    });

    const unsettled = await emit(wizardTree, { selection, structures: [] });
    const held = rowsOf(gateWithMissingRecord(unsettled));
    expect(held).toEqual({
      admitted: [],
      held: [
        expect.objectContaining({
          reason:
            'Structure hand review (#716 plan §6): uncheckedCasting casting:arcane-school.',
        }),
      ],
      failed: [],
    });
    expect(held.held[0]).not.toHaveProperty('unverified');

    const settled = await emit(wizardTree, {
      selection,
      structures: replacingCommitted(checkedRecords(unsettled)),
    });
    expect(rowsOf(gateWithMissingRecord(settled))).toEqual({
      admitted: [
        expect.objectContaining({
          reason: 'Admitted under #227: declared book PZO1129.',
          unverified: ['no curation record'],
        }),
      ],
      held: [],
      failed: [],
    });
  });

  it('is held until a checked record settles it, then admitted and released', async () => {
    const unsettled = await emit(wizardTree, { selection, structures: [] });
    expect(
      unsettled.catalog.entries
        .filter(({ upstreamKey }) => upstreamKey?.startsWith('pcgen:'))
        .map(({ externalKey }) => externalKey)
        .sort(),
    ).toEqual([keys.exploiter, keys.reservoir, keys.exploit]);
    expect(outcomeOf(unsettled, keys.exploiter)).toEqual({
      kind: 'held',
      reason:
        'Structure hand review (#716 plan §6): uncheckedCasting casting:arcane-school.',
    });

    const settled = await emit(wizardTree, {
      selection,
      structures: replacingCommitted(checkedRecords(unsettled)),
    });
    expect(settled.structure?.passed).toBe(true);
    expect(entryOf(settled, keys.exploiter)?.detail).toMatchObject({
      casting: { extraSlots: { remove: ['school'] } },
    });
    for (const key of [keys.exploiter, keys.reservoir, keys.exploit])
      expect(outcomeOf(settled, key)).toEqual({
        kind: 'admitted',
        reason: 'Admitted under #227: declared book PZO1129.',
      });

    const release = await createCatalogRelease({
      artifact: settled,
      attribution,
      legalResources,
      releaseNumber: 716,
      compatibility: catalogRuntimeCompatibility,
      inputValues: {
        remaps,
        curation,
        localData: [],
        parsers: 'pcgen-owner-emission-proof',
        sanitizers: 'pcgen-owner-emission-proof',
        ruleResources: [],
        upstreamVerification: { status: 'unverified' },
      },
    });
    const transported = await validateCatalogReleaseArtifact(
      JSON.parse(serializeCatalogRelease(release)),
    );
    const t = convexTest(schema, modules);
    const writeBatch = makeFunctionReference<
      'mutation',
      { releaseNumber: number; batchIndex: number; rows: unknown },
      CatalogReleaseStatus
    >('catalogRelease:writeBatch');
    await t.mutation(internal.catalogRelease.begin, {
      manifest: transported.manifest,
    });
    for (const [batchIndex, batch] of transported.batches.entries())
      await t.mutation(writeBatch, {
        releaseNumber: 716,
        batchIndex,
        rows: batch,
      });
    await t.mutation(internal.catalogRelease.finalize, { releaseNumber: 716 });
    const stored = await t.run((ctx) =>
      ctx.db
        .query('catalogReleaseRow')
        .collect()
        .then((rows) =>
          rows.filter(
            (row) => row.kind === 'definition' && row.key === keys.exploiter,
          ),
        ),
    );
    expect(stored).toHaveLength(1);
    expect(stored[0]?.payload).toMatchObject({
      name: 'Exploiter Wizard',
      sources: [{ book: 'PZO1129', pages: '133' }],
      detail: {
        kind: 'archetype',
        casting: { extraSlots: { remove: ['school'] } },
      },
    });
  });
});
