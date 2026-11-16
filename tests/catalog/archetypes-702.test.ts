/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { afterAll, describe, expect, it } from 'vitest';
import { internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { assessCatalogAdmission } from '../../scripts/catalog/admission';
import { importCatalog } from '../../scripts/catalog/import';
import { pcgenOwnerSelection } from '../../scripts/catalog/pcgen-owners';
import {
  createCatalogRelease,
  serializeCatalogRelease,
} from '../../scripts/catalog/release';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import reviewedRemaps from '../../scripts/catalog/reviewed-remaps.json';
import type { StructureRecord } from '../../scripts/catalog/structure-curation';
import { reviewedAdmissionSchema } from '../../src/lib/catalog/admission-schema';
import section15Registry from '../../src/lib/catalog/data/section15-registry.json';
import type { AllocationBatch } from '../../src/lib/catalog/identity-allocation';
import { legalResources } from '../../src/lib/catalog/legal-resources-data';
import { validateCatalogReleaseArtifact } from '../../src/lib/catalog/release-schema';
import type { CatalogReleaseStatus } from '../../src/lib/catalog/release-validators';
import { catalogRuntimeCompatibility } from '../../src/lib/catalog/runtime-compatibility';
import { preloadCalledConvexModules } from '../convex-modules';
import {
  exploiterPoolMembers,
  exploiterTreeFiles,
} from '../fixtures/archetypes-702/data';
import { materializePinnedTree } from './pinned-sources';

// #702 batch 1 (#716 E2a; docs/catalog-import/archetypes-702.md): the
// Exploiter Wizard's three structure records, written drafted, settle its
// structure gate once checked: the school slot leaves with arcane school, and
// the two added features take the PRD's text, the exploit feature its five
// pool prompts. Every case runs on the pinned tree.

const modules = import.meta.glob('../../convex/**/*.ts');
preloadCalledConvexModules({ modules, testFile: import.meta.url });

const tree = await materializePinnedTree(exploiterTreeFiles);
afterAll(() => tree.dispose());

const registry =
  reviewedAdmissionSchema.shape.registry.parse(section15Registry);
/** No Attribution Assessments: #716 and Foundry rows admit on their declared books (#227). */
const attribution = { assessments: [], registry, evidence: {} };
const remaps = reviewedRemaps;

const acg = 'roleplaying_game/advanced_class_guide/acg_abilities_class.lst';
const keys = {
  exploiter: 'everythingpath/wizard-exploiter-wizard',
  reservoir: 'everythingpath/wizard-exploiter-wizard-arcane-reservoir',
  exploit: 'everythingpath/wizard-exploiter-wizard-exploiter-exploit',
};
const members = exploiterPoolMembers.map(({ key }) => key);
const pool = (classLevel: number) => ({
  kind: 'pool',
  classLevel,
  count: 1,
  list: 'Arcanist Exploit',
  members,
});

/** The three records as the batch report gives them, rationale aside. */
const expected = [
  {
    externalKey: keys.exploiter,
    sourceSha256:
      'e58b36d09ee7ee08ec8656ca30ea5ee5aef69659ba7b08d1051fc43413e789dc',
    fields: { 'detail.casting': { extraSlots: { remove: ['school'] } } },
    resolves: [{ kind: 'uncheckedCasting', id: 'casting:arcane-school' }],
  },
  {
    externalKey: keys.reservoir,
    sourceSha256:
      'fd57edffe2c1ce455615d7a0e46bc6c0064698c97f73ff69fd8f909d0e67cc29',
    fields: {
      // advancedClassGuide/classOptions/wizard.html:350, without its heading.
      description:
        "At 1st level, the exploiter wizard gains the arcanist's arcane reservoir class feature. The exploiter wizard uses his wizard level as his arcanist level for the purpose of determining how many points he gains in his arcane reservoir points at each level. This ability replaces arcane bond.",
    },
    resolves: [
      {
        kind: 'ownedFeature',
        id: `pcgen:${acg}#Exploiter Wizard ~ Arcane Reservoir`,
      },
    ],
  },
  {
    externalKey: keys.exploit,
    sourceSha256:
      'e6e56c05237e1c6b8bcf521f397d97c788d85f7d9c823b717c1c139736cbb0a7',
    fields: {
      // advancedClassGuide/classOptions/wizard.html:351, without its heading.
      description:
        'At 1st level and every 4 levels thereafter, the exploiter wizard gains a single arcanist exploit. The exploiter wizard uses his wizard level as his arcanist level for determining the effects and DCs of his arcanist exploits. This ability replaces arcane school.',
      'detail.picksByLevel': [1, 5, 9, 13, 17].map(pool),
    },
    resolves: [
      {
        kind: 'ownedFeature',
        id: `pcgen:${acg}#Exploiter Wizard ~ Exploiter Exploit`,
      },
    ],
  },
];
const batchKeys = new Set(Object.values(keys));
const committed = (reviewedCuration.structures ?? []).filter((record) =>
  batchKeys.has(record.externalKey),
);

/**
 * The committed records, checked in memory: a drafted one becomes a copy with
 * a test reviewer and receipt, and a committed checked record is used as is.
 * They replace the committed records of their subjects.
 */
const checkedInMemory = committed.map(
  (record): StructureRecord =>
    record.status === 'checked'
      ? record
      : {
          ...record,
          status: 'checked',
          reviewedBy: 'Test fixture',
          reviewedOn: '2026-11-13',
          receipt: 'reviewer-20261018-081620-1216172',
        },
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
  ({ key }) => key === 'Wizard Archetype ~ Exploiter Wizard',
);
type Artifact = Awaited<ReturnType<typeof importCatalog>>;
const emit = (curation: unknown) =>
  importCatalog({
    systemPath: tree.systemPath,
    contentPath: tree.contentPath,
    remaps,
    curation,
    pcgen: { path: tree.pcgenPath, selection },
  });
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

const settled = await emit(withStructures(checkedInMemory));

describe('the Exploiter Wizard structure records (#702, #716 E2a)', () => {
  it('are committed with exactly the reviewed fields, items and source hashes', () => {
    expect(
      committed.map(({ externalKey, sourceSha256, fields, resolves }) => ({
        externalKey,
        sourceSha256,
        fields,
        resolves,
      })),
    ).toEqual(expected);
    for (const record of committed) {
      expect(record.noMechanics).toBeUndefined();
      expect(record.rationale).toMatch(
        /advancedClassGuide\/classOptions\/wizard\.html:35[01]/,
      );
    }
  });

  it('once checked, settle the structure gate and apply, and the three rows are admitted under #227', () => {
    const report = settled.structure;
    expect(report).toMatchObject({
      passed: true,
      held: [],
      handReview: [],
      unreviewedFeatures: [],
      invalid: [],
      conflicts: [],
      stale: [],
    });
    expect(
      report?.applied.map(({ externalKey }) => externalKey).sort(),
    ).toEqual([...batchKeys].sort());
    const fieldsOf = (key: string) => {
      const entry = entryOf(settled, key);
      return entry && { description: entry.description, detail: entry.detail };
    };
    expect(fieldsOf(keys.exploiter)?.detail).toMatchObject({
      kind: 'archetype',
      casting: { extraSlots: { remove: ['school'] } },
    });
    expect(fieldsOf(keys.reservoir)).toEqual({
      description: expected[1]?.fields.description,
      detail: { kind: 'classFeature' },
    });
    expect(fieldsOf(keys.exploit)).toEqual({
      description: expected[2]?.fields.description,
      detail: {
        kind: 'classFeature',
        picksByLevel: expected[2]?.fields['detail.picksByLevel'],
      },
    });
    expect(entryOf(settled, keys.exploit)?.provenance).toMatchObject({
      'detail.picksByLevel': {
        source: 'overlay',
        locator: {
          externalKey: keys.exploit,
          kind: 'structure',
          target: 'detail.picksByLevel',
        },
      },
    });
    for (const key of [...batchKeys, ...members])
      expect(outcomeOf(settled, key), key).toMatchObject({ kind: 'admitted' });
    for (const key of batchKeys)
      expect(outcomeOf(settled, key)).toEqual({
        kind: 'admitted',
        reason: 'Admitted under #227: declared book PZO1129.',
      });
  });

  it("resolves the exploit pool's 24 members through a release's writeBatch", async () => {
    const release = await createCatalogRelease({
      artifact: settled,
      attribution,
      legalResources,
      releaseNumber: 702,
      compatibility: catalogRuntimeCompatibility,
      inputValues: {
        remaps,
        curation: withStructures(checkedInMemory),
        localData: [],
        parsers: 'archetypes-702-proof',
        sanitizers: 'archetypes-702-proof',
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
        releaseNumber: 702,
        batchIndex,
        rows: batch,
      });
    await t.mutation(internal.catalogRelease.finalize, { releaseNumber: 702 });
    const definitions = await t.run((ctx) =>
      ctx.db
        .query('catalogReleaseRow')
        .collect()
        .then((rows) => rows.filter((row) => row.kind === 'definition')),
    );
    const stored = new Set(definitions.map(({ key }) => key));
    expect(members.filter((key) => !stored.has(key))).toEqual([]);
    expect(
      definitions.find(({ key }) => key === keys.exploit)?.payload,
    ).toMatchObject({
      name: 'Exploiter Exploit',
      detail: {
        kind: 'classFeature',
        picksByLevel: [1, 5, 9, 13, 17].map(pool),
      },
    });

    // Identity allocation resolves every stable key a body names, the pool's
    // members included, to a stored or released definition.
    const conflicts: AllocationBatch['conflicts'] = [];
    let cursor: string | null = null;
    for (;;) {
      const batch: AllocationBatch = await t.mutation(
        internal.catalogIdentityAllocation.allocate,
        { releaseNumber: 702, cursor },
      );
      conflicts.push(...batch.conflicts);
      if (batch.isDone) break;
      cursor = batch.continueCursor;
    }
    expect(conflicts).toEqual([]);
  }, 60_000);

  it('as committed, are admitted only when all three are checked, else held on structure', async () => {
    // The one status-dependent case: the records are written drafted and
    // only the orchestrator's record step checks them, so the committed
    // state's outcome follows their status.
    const asCommitted = await emit(reviewedCuration);
    const allChecked =
      committed.length === 3 &&
      committed.every(({ status }) => status === 'checked');
    for (const key of batchKeys)
      expect(outcomeOf(asCommitted, key), key).toEqual(
        allChecked
          ? {
              kind: 'admitted',
              reason: 'Admitted under #227: declared book PZO1129.',
            }
          : {
              kind: 'held',
              reason: expect.stringMatching(/^Structure hand review/),
            },
      );
  });
});
