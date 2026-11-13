// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { runCatalogReleaseOperator } from '../../scripts/catalog/release-operator';
import type { Id } from '../../convex/_generated/dataModel';
import type { IdentityConflict } from '../../src/lib/catalog/identity-allocation';
import { isObject } from '../../src/lib/catalog/release-schema';

// #413 F1: the operator's `allocate` step before reconciliation.

it('refuses production allocation before reading credentials or making remote requests', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  try {
    await expect(
      runCatalogReleaseOperator({
        args: [
          'allocate',
          '--number',
          '1',
          '--deployment-name',
          'synthetic-production',
          '--deployment-url',
          'https://synthetic-production.convex.cloud',
          '--target-kind',
          'production',
          '--admin-key-file',
          '/missing/admin.key',
        ],
      }),
    ).rejects.toThrow(
      'Catalog identity allocation is limited to fixture deployments',
    );
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});

// #413 F6c: `--production` lifts the refusal for allocate alone, and only
// with `--target-kind production`.
it('allocates on production only with --production', async () => {
  const allocate = vi.fn().mockResolvedValue({
    allocatedCount: 0,
    existingCount: 0,
    conflicts: [],
    continueCursor: '',
    isDone: true,
  });
  await expect(
    runCatalogReleaseOperator({
      args: [
        'allocate',
        '--number',
        '1',
        '--target-kind',
        'production',
        '--production',
      ],
      allocationAdapter: { allocate },
    }),
  ).resolves.toMatchObject({ releaseNumber: 1, stopped: 'complete' });
  expect(allocate).toHaveBeenCalledTimes(1);
});

it('refuses --production with --fixture-only before any adapter, credential or request', async () => {
  const allocate = vi.fn();
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  try {
    for (const allocationAdapter of [{ allocate }, undefined])
      await expect(
        runCatalogReleaseOperator({
          args: [
            'allocate',
            '--number',
            '1',
            '--target-kind',
            'production',
            '--production',
            '--fixture-only',
            '--deployment-name',
            'quiet-otter-123',
            '--deployment-url',
            'https://quiet-otter-123.convex.cloud',
            '--admin-key-file',
            '/nonexistent/admin.key',
          ],
          allocationAdapter,
        }),
      ).rejects.toThrow('--production cannot be combined with --fixture-only.');
    expect(allocate).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});

it.each([
  ['allocate', '--target-kind', 'preview'],
  ['reconcile', '--target-kind', 'production'],
  ['activate', '--target-kind', 'production', '--fixture-only'],
  ['inspect', '--target-kind', 'production'],
])(
  'refuses --production outside allocate to production (%s %s %s) before any remote request',
  async (...args) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    try {
      await expect(
        runCatalogReleaseOperator({
          args: [...args, '--number', '1', '--production'],
        }),
      ).rejects.toThrow(
        '--production applies only to allocate with --target-kind production.',
      );
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  },
);

const storedId = 'stored-trait' as Id<'catalogEntry'>;
const conflict: IdentityConflict = {
  kind: 'identityKind',
  key: 'pf1/alertness',
  releaseKind: 'feat',
  stored: { catalogEntryId: storedId, kind: 'trait' },
};

it('allocates batch by batch through the installed administrative client and reports conflicts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'catalog-allocation-'));
  const keyFile = join(directory, 'admin.key');
  await writeFile(keyFile, 'preview:synthetic-preview|synthetic-admin-key');
  const requests: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', async (_url: unknown, options: RequestInit) => {
    if (typeof options.body !== 'string')
      throw new Error('Expected HTTP JSON body');
    const body: unknown = JSON.parse(options.body);
    if (
      !isObject(body) ||
      body.path !== 'catalogIdentityAllocation:allocate' ||
      !isObject(body.args)
    )
      throw new Error('Unexpected administrative request');
    requests.push(body.args);
    const value =
      body.args.cursor === null
        ? {
            allocatedCount: 8,
            existingCount: 0,
            conflicts: [],
            continueCursor: 'after-8',
            isDone: false,
          }
        : {
            allocatedCount: 2,
            existingCount: 1,
            conflicts: [conflict],
            continueCursor: 'end',
            isDone: true,
          };
    return new Response(JSON.stringify({ status: 'success', value }));
  });
  const allocate = (deploymentName = 'synthetic-preview') =>
    runCatalogReleaseOperator({
      args: [
        'allocate',
        '--number',
        '3',
        '--write-epoch',
        '4',
        '--deployment-name',
        deploymentName,
        '--deployment-url',
        'https://synthetic-preview.convex.cloud',
        '--target-kind',
        'preview',
        '--admin-key-file',
        keyFile,
      ],
    });
  try {
    expect(await allocate()).toEqual({
      releaseNumber: 3,
      allocatedCount: 10,
      existingCount: 1,
      batchCount: 2,
      conflicts: [conflict],
      stopped: 'conflicts',
    });
    expect(requests).toEqual([
      { releaseNumber: 3, cursor: null, writeEpoch: 4 },
      { releaseNumber: 3, cursor: 'after-8', writeEpoch: 4 },
    ]);
    // The URL must match the named deployment before any request.
    await expect(allocate('other-preview')).rejects.toThrow(
      'Deployment URL must match the explicitly named deployment.',
    );
    expect(requests).toHaveLength(2);
  } finally {
    vi.unstubAllGlobals();
    await rm(directory, { recursive: true, force: true });
  }
});

it('refuses a malformed batch response', async () => {
  await expect(
    runCatalogReleaseOperator({
      args: ['allocate', '--number', '1'],
      allocationAdapter: {
        allocate: async () => ({
          allocatedCount: 1,
          existingCount: 0,
          conflicts: [{ kind: 'identityKind', key: 'pf1/alertness' }],
          continueCursor: '',
          isDone: true,
        }),
      },
    }),
  ).rejects.toThrow('Invalid remote identity allocation response.');
});

it('types each conflict by its kind', () => {
  const conflicts: IdentityConflict[] = [
    { kind: 'unresolvedReference', key: 'a', reference: 'b' },
    // @ts-expect-error An unresolved reference names its reference.
    { kind: 'unresolvedReference', key: 'a' },
    {
      kind: 'referenceKind',
      key: 'a',
      reference: 'b',
      expectedKind: 'race',
      // @ts-expect-error A release body has no stored ID.
      found: { source: 'release', kind: 'feat', catalogEntryId: storedId },
    },
    // @ts-expect-error A kind conflict names the stored identity.
    { kind: 'identityKind', key: 'a', releaseKind: 'feat' },
  ];
  expect(conflicts).toHaveLength(4);
});
