// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { runCatalogReleaseOperator } from '../../scripts/catalog/release-operator';

it('refuses production activation before reading credentials or making remote requests', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  try {
    await expect(
      runCatalogReleaseOperator({
        args: [
          'activate',
          '--number',
          '2',
          '--run-id',
          'run',
          '--operation-id',
          'activation',
          '--schema',
          'character-sheet-v1',
          '--calculation',
          'calculation',
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
    ).rejects.toThrow('Catalog activation is limited to fixture deployments');
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});

it('requires explicit fixture mode before creating a remote administrative client', async () => {
  await expect(
    runCatalogReleaseOperator({
      args: [
        'activate',
        '--target-kind',
        'preview',
        '--admin-key-file',
        '/missing/admin.key',
      ],
    }),
  ).rejects.toThrow('Catalog activation requires --fixture-only');
});

it('activates an isolated fixture and inspects the authoritative selection after an uncertain response', async () => {
  const selection = {
    releaseNumber: 2,
    artifactFingerprint: 'a'.repeat(64),
    impactRunId: 'run-2',
    activationId: 'activation-2',
    schemaIdentity: 'character-sheet-v1',
    calculationIdentity: 'compatible-calculation',
    isFixtureOnly: true,
  };
  const activate = vi.fn(async () => selection);
  const status = vi.fn(async () => selection);
  const activationAdapter = { activate, status };
  expect(
    await runCatalogReleaseOperator({
      args: [
        'activate',
        '--number',
        '2',
        '--run-id',
        'run-2',
        '--operation-id',
        'activation-2',
        '--schema',
        'character-sheet-v1',
        '--calculation',
        'compatible-calculation',
        '--fixture-only',
        '--target-kind',
        'preview',
        '--write-epoch',
        '4',
      ],
      activationAdapter,
    }),
  ).toEqual(selection);
  expect(activate).toHaveBeenCalledWith({
    releaseNumber: 2,
    runId: 'run-2',
    activationId: 'activation-2',
    schemaIdentity: 'character-sheet-v1',
    calculationIdentity: 'compatible-calculation',
    isFixtureOnly: true,
    writeEpoch: 4,
  });
  activate.mockRejectedValueOnce(new Error('Response lost'));
  await expect(
    runCatalogReleaseOperator({
      args: [
        'activate',
        '--number',
        '2',
        '--run-id',
        'run-2',
        '--operation-id',
        'activation-2',
        '--schema',
        'character-sheet-v1',
        '--calculation',
        'compatible-calculation',
        '--fixture-only',
        '--target-kind',
        'preview',
      ],
      activationAdapter,
    }),
  ).rejects.toThrow('Response lost');
  expect(
    await runCatalogReleaseOperator({ args: ['active'], activationAdapter }),
  ).toEqual(selection);
  expect(status).toHaveBeenCalledWith({});
});
