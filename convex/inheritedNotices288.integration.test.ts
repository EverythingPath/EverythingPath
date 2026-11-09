// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { ConvexError } from 'convex/values';
import type { CatalogReleaseStatus } from '../src/lib/catalog/release-validators';
import { expect, test } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';
import { buildCatalogRelease } from '../scripts/catalog/release';
import {
  runCatalogReleaseCommand,
  type CatalogReleaseCommandAdapter,
} from '../scripts/catalog/release-command';
import {
  MAX_RELEASE_BATCH_BYTES,
  releaseByteCount,
  parseReleaseJson,
  releaseFingerprint,
  validateCatalogReleaseManifest,
  type ReleaseRow,
} from '../src/lib/catalog/release-schema';
import { catalogRuntimeCompatibility } from '../src/lib/catalog/runtime-compatibility';
import {
  legalResources,
  section15Registry,
} from '../src/lib/catalog/section15-registry-data';
import { buildLegalPageData } from '../src/lib/catalog/legal-page-data';
import publishedFeats from '../tests/fixtures/feats-330/preview.json';

const modules = import.meta.glob('./**/*.ts');
const writeBatchBoundary = makeFunctionReference<
  'mutation',
  {
    releaseNumber: number;
    batchIndex: number;
    rows: unknown;
    writeEpoch?: number;
  },
  CatalogReleaseStatus
>('catalogRelease:writeBatch');
const lightningReflexes = publishedFeats.entries.find(
  (entry) => entry.externalKey === 'pf1/0bZf3SDkvVOe2ujH',
);

const legal = {
  registry: section15Registry,
  resources: legalResources,
  requiredNotices: ['PZO1110'],
  permanentNoticeSuperset: buildLegalPageData({
    registry: section15Registry,
    resources: legalResources,
    requiredNotices: ['PZO1110'],
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
  }).permanentNoticeSuperset,
};

function legacyRegistry() {
  const notice = section15Registry.CRB;
  if (!notice) throw new Error('Missing committed Core Rulebook notice');
  return { CRB: notice };
}

async function candidate(registry = section15Registry) {
  if (!lightningReflexes)
    throw new Error('Missing pinned Lightning Reflexes fixture');
  const rows: ReleaseRow[] = [
    {
      kind: 'definition',
      key: lightningReflexes.externalKey,
      payload: parseReleaseJson(lightningReflexes),
    },
    ...Object.entries({ ...legal, registry }).map(
      ([key, payload]): ReleaseRow => ({ kind: 'legal', key, payload }),
    ),
    ...['content', 'resources', 'holds', 'retirement', 'curation'].map(
      (key): ReleaseRow => ({
        kind: 'report',
        key,
        payload: { gatePassed: true, coverageComplete: true, passed: true },
      }),
    ),
  ];
  return buildCatalogRelease({
    releaseNumber: 1,
    compatibility: catalogRuntimeCompatibility,
    inputs: {
      upstream: [],
      remaps: [],
      curation: [],
      localData: [],
      parsers: [],
      sanitizers: [],
      ruleResources: [],
      legal: [],
      attribution: [],
    },
    rows,
  });
}

// Selection is isolated fixture setup; preparation remains the actual private API.
async function select(t: ReturnType<typeof convexTest>) {
  await t.run((ctx) =>
    ctx.db.insert('catalogReleaseControl', {
      key: 'global',
      releaseNumber: 1,
      schemaIdentity: catalogRuntimeCompatibility.schema,
      calculationIdentity: catalogRuntimeCompatibility.calculation,
    }),
  );
}

test('prepares the complete published Registry across bounded batches and reads/renders every field unchanged', async () => {
  expect(Object.keys(section15Registry).length).toBeGreaterThanOrEqual(370);
  expect(
    releaseByteCount([
      { kind: 'legal', key: 'registry', payload: section15Registry },
    ]),
  ).toBeGreaterThan(MAX_RELEASE_BATCH_BYTES);
  const release = await candidate();
  expect(release.batches.length).toBeGreaterThan(1);
  for (const rows of release.batches)
    expect(releaseByteCount(rows)).toBeLessThanOrEqual(MAX_RELEASE_BATCH_BYTES);
  const t = convexTest(schema, modules);
  await expect(t.query(api.catalogRelease.legalInputs, {})).resolves.toBeNull();
  const adapter: CatalogReleaseCommandAdapter = {
    begin: (args) => t.mutation(internal.catalogRelease.begin, args),
    writeBatch: (args) => t.mutation(writeBatchBoundary, args),
    finalize: (args) => t.mutation(internal.catalogRelease.finalize, args),
    inspect: (args) => t.query(internal.catalogRelease.inspect, args),
  };
  await expect(
    runCatalogReleaseCommand({
      command: { kind: 'prepare', artifact: release },
      adapter,
    }),
  ).resolves.toMatchObject({ state: 'prepared' });
  // An unchanged retry reads the same committed output through the operator.
  await expect(
    runCatalogReleaseCommand({
      command: { kind: 'prepare', artifact: release },
      adapter,
    }),
  ).resolves.toMatchObject({ state: 'prepared' });
  const definitions = await t.query(internal.catalogRelease.inspectRows, {
    releaseNumber: 1,
    kind: 'definition',
    paginationOpts: {
      cursor: null,
      numItems: 100,
      maximumRowsRead: 100,
      maximumBytesRead: MAX_RELEASE_BATCH_BYTES,
    },
  });
  expect(definitions.page).toHaveLength(1);
  expect(definitions.page[0]?.payload).toEqual(lightningReflexes);
  await select(t);
  const readback = await t.query(api.catalogRelease.legalInputs, {});
  expect(readback).toEqual(legal);
  expect(buildLegalPageData(readback!)).toEqual(buildLegalPageData(legal));
});

test('reads a legacy prepared single-row Registry without changing its legal data', async () => {
  const registry = legacyRegistry();
  const release = await candidate(registry);
  const t = convexTest(schema, modules);
  await t.mutation(internal.catalogRelease.begin, {
    manifest: release.manifest,
  });
  for (const [batchIndex, rows] of release.batches.entries())
    await t.mutation(writeBatchBoundary, {
      releaseNumber: 1,
      batchIndex,
      rows,
    });
  await t.mutation(internal.catalogRelease.finalize, { releaseNumber: 1 });
  await select(t);
  expect(await t.query(api.catalogRelease.legalInputs, {})).toEqual({
    ...legal,
    registry,
  });
});

// Re-sign malformed outputs to prove backend validation independently of the
// ordinary immutable batch fingerprint check.
test.each([
  {
    fault: 'missing',
    expectedError:
      'Catalog Release Registry chunks are incomplete or unexpected',
  },
  { fault: 'duplicate', expectedError: 'Duplicate Catalog Release row' },
  {
    fault: 'extra',
    expectedError:
      'Catalog Release Registry chunks are incomplete or unexpected',
  },
  {
    fault: 'malformed',
    expectedError: 'Invalid Catalog Release Registry chunk',
  },
  {
    fault: 'altered',
    expectedError: 'Catalog Release Registry integrity mismatch',
  },
  {
    fault: 'fingerprint',
    expectedError: 'Catalog Release Registry integrity mismatch',
  },
  {
    fault: 'byteCount',
    expectedError: 'Catalog Release Registry integrity mismatch',
  },
  {
    fault: 'legacy-extra',
    expectedError:
      'Catalog Release Registry chunks are incomplete or unexpected',
  },
] as const)(
  'rejects $fault Registry chunks at the intended preparation boundary',
  async ({ fault, expectedError }) => {
    const initial = await candidate();
    const batches = structuredClone(initial.batches);
    const rows = batches.flat();
    const first = rows.find((row) => row.key === 'registry:chunk:000000')!;
    const registry = rows.find((row) => row.key === 'registry')!;
    if (fault === 'missing') {
      const batch = batches.find((batch) => batch.includes(first))!;
      batch.splice(batch.indexOf(first), 1);
    }
    if (fault === 'duplicate') batches.at(-1)!.push(structuredClone(first));
    if (fault === 'extra')
      batches.at(-1)!.push({ ...first, key: 'registry:chunk:000999' });
    if (fault === 'malformed') first.payload = { invalid: true };
    if (fault === 'altered') {
      if (typeof first.payload !== 'string')
        throw new Error('Missing text chunk fixture');
      first.payload = first.payload.replace('Pathfinder', 'PATHFINDER');
    }
    if (fault === 'fingerprint' || fault === 'byteCount') {
      if (
        registry.payload &&
        typeof registry.payload === 'object' &&
        !Array.isArray(registry.payload)
      )
        registry.payload[fault] = fault === 'fingerprint' ? '0'.repeat(64) : 1;
    }
    if (fault === 'legacy-extra') registry.payload = legacyRegistry();
    // Re-signing and begin must succeed outside the expected rejection.
    const descriptors = await Promise.all(
      batches.map(async (rows) => ({
        rowCount: rows.length,
        byteCount: releaseByteCount(rows),
        fingerprint: await releaseFingerprint(rows),
      })),
    );
    const { artifactFingerprint: _oldFingerprint, ...body } = initial.manifest;
    const manifestBody = {
      ...body,
      batches: descriptors,
      outputFingerprint: await releaseFingerprint(descriptors),
    };
    const manifest = validateCatalogReleaseManifest({
      ...manifestBody,
      artifactFingerprint: await releaseFingerprint(manifestBody),
    });
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(internal.catalogRelease.begin, { manifest }),
    ).resolves.toMatchObject({
      state: 'preparing',
      manifest,
      nextBatchIndex: 0,
      stagedRows: 0,
    });

    const firstChunkBatch = batches.findIndex((batch) => batch.includes(first));
    const rejectedBatch =
      fault === 'duplicate'
        ? batches.length - 1
        : fault === 'malformed'
          ? firstChunkBatch
          : -1;
    // The duplicate is checked against an earlier committed batch.
    if (fault === 'duplicate')
      expect(rejectedBatch).toBeGreaterThan(firstChunkBatch);
    if (fault === 'malformed') expect(rejectedBatch).toBeGreaterThanOrEqual(0);
    let nextBatchIndex = 0;
    let stagedRows = 0;
    for (const [batchIndex, rows] of batches.entries()) {
      const write = t.mutation(writeBatchBoundary, {
        releaseNumber: 1,
        batchIndex,
        rows,
      });
      if (batchIndex === rejectedBatch) {
        await expect(write).rejects.toBeInstanceOf(ConvexError);
        await expect(write).rejects.toMatchObject({ data: expectedError });
        break;
      }
      stagedRows += rows.length;
      nextBatchIndex++;
      await expect(write).resolves.toMatchObject({
        state: 'preparing',
        nextBatchIndex,
        stagedRows,
      });
    }
    // These six cases must stage every re-signed batch before reconstruction.
    if (rejectedBatch === -1) {
      expect(nextBatchIndex).toBe(batches.length);
      const finalize = t.mutation(internal.catalogRelease.finalize, {
        releaseNumber: 1,
      });
      await expect(finalize).rejects.toBeInstanceOf(ConvexError);
      await expect(finalize).rejects.toMatchObject({ data: expectedError });
    }
    await expect(
      t.query(internal.catalogRelease.inspect, { releaseNumber: 1 }),
    ).resolves.toMatchObject({
      state: 'preparing',
      nextBatchIndex,
      stagedRows,
    });
    await expect(
      t.query(api.catalogRelease.legalInputs, {}),
    ).resolves.toBeNull();
  },
);

test('rejects a chunk changed after the release commitment and retries the original batch', async () => {
  const release = await candidate();
  const t = convexTest(schema, modules);
  await t.mutation(internal.catalogRelease.begin, {
    manifest: release.manifest,
  });
  const batchIndex = release.batches.findIndex((rows) =>
    rows.some((row) => row.key.startsWith('registry:chunk:')),
  );
  for (let index = 0; index < batchIndex; index++)
    await t.mutation(writeBatchBoundary, {
      releaseNumber: 1,
      batchIndex: index,
      rows: release.batches[index],
    });
  const original = release.batches.at(batchIndex);
  if (!original) throw new Error('Missing committed chunk batch fixture');
  const altered = structuredClone(original);
  altered.find((row) => row.key.startsWith('registry:chunk:'))!.payload =
    'altered';
  await expect(
    t.mutation(writeBatchBoundary, {
      releaseNumber: 1,
      batchIndex,
      rows: altered,
    }),
  ).rejects.toThrow('differs from immutable output');
  for (let index = batchIndex; index < release.batches.length; index++)
    await t.mutation(writeBatchBoundary, {
      releaseNumber: 1,
      batchIndex: index,
      rows: release.batches[index],
    });
  await t.mutation(internal.catalogRelease.finalize, { releaseNumber: 1 });
  await select(t);
  expect(await t.query(api.catalogRelease.legalInputs, {})).toEqual(legal);
});
