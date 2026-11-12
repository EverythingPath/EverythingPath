// @vitest-environment node
import { expect, it } from 'vitest';
import { buildCatalogRelease } from '../../scripts/catalog/release';
import {
  runCatalogReleaseCommand,
  type CatalogReleaseCommandAdapter,
  type CatalogReleaseStatus,
} from '../../scripts/catalog/release-command';
import type {
  CatalogReleaseManifest,
  ReleaseRow,
} from '../../src/lib/catalog/release-schema';

it('the operator resumes private preparation after a batch fails and can inspect without activation', async () => {
  const artifact = await buildCatalogRelease({
    releaseNumber: 7,
    compatibility: { schema: 'schema-1', calculation: 'facts-1' },
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
    rows: Array.from(
      { length: 201 },
      (_, index): ReleaseRow => ({
        kind: 'definition',
        key: `feat-${index}`,
        payload: { name: `Feat ${index}` },
      }),
    ),
  });
  let status: CatalogReleaseStatus | undefined;
  const staged: ReleaseRow[] = [];
  let fail = true;
  const adapter: CatalogReleaseCommandAdapter = {
    async begin({ manifest }: { manifest: CatalogReleaseManifest }) {
      if (
        status &&
        status.manifest.artifactFingerprint !== manifest.artifactFingerprint
      )
        throw new Error('Number already bound');
      status ??= {
        releaseNumber: manifest.releaseNumber,
        state: 'preparing',
        baseReleaseNumber: 6,
        nextBatchIndex: 0,
        batchCount: manifest.batches.length,
        stagedRows: 0,
        manifest,
      };
      return status;
    },
    async writeBatch({ batchIndex, rows }) {
      if (batchIndex === 1 && fail) throw new Error('Injected remote failure');
      if (!status) throw new Error('Missing status');
      if (batchIndex === status.nextBatchIndex) {
        staged.push(...rows);
        status = {
          ...status,
          nextBatchIndex: batchIndex + 1,
          stagedRows: staged.length,
        };
      }
      return status;
    },
    async finalize() {
      if (!status) throw new Error('Missing status');
      status = { ...status, state: 'prepared' };
      return status;
    },
    async inspect() {
      if (!status) throw new Error('Missing status');
      return status;
    },
  };
  await expect(
    runCatalogReleaseCommand({
      command: { kind: 'prepare', artifact },
      adapter,
    }),
  ).rejects.toThrow('Injected remote failure');
  expect(
    (
      await runCatalogReleaseCommand({
        command: { kind: 'inspect', releaseNumber: 7 },
        adapter,
      })
    ).nextBatchIndex,
  ).toBe(1);
  fail = false;
  expect(
    (
      await runCatalogReleaseCommand({
        command: { kind: 'prepare', artifact },
        adapter,
      })
    ).state,
  ).toBe('prepared');
  expect(staged).toHaveLength(201);
  await runCatalogReleaseCommand({
    command: { kind: 'prepare', artifact },
    adapter,
  });
  expect(staged).toHaveLength(201);
});
