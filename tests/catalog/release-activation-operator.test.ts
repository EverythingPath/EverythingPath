// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCatalogReleaseOperator } from '../../scripts/catalog/release-operator';
import {
  currentCalculationIdentity,
  retainedPriorCalculationIdentity,
} from '../../src/lib/catalog/calculation-identities';

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
    ).rejects.toThrow(
      'Catalog activation is limited to fixture deployments unless --production is passed.',
    );
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
  ).toEqual({ ...selection, calculationServing: 'outside-window' });
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
  ).toEqual({ ...selection, calculationServing: 'outside-window' });
  expect(status).toHaveBeenCalledWith({});
});

// #413 F8a: after the first activation a resolver-only release reaches
// production only through `activate --production --target-kind production`,
// guarded as `allocate --production` is.
const productionActivation = (calculation: string) => [
  'activate',
  '--number',
  '3',
  '--run-id',
  'run-3',
  '--operation-id',
  'release-3-production',
  '--schema',
  'character-sheet-v1',
  '--calculation',
  calculation,
  '--target-kind',
  'production',
  '--production',
];

it('activates on production only with --production, as a selection that is not fixture-only', async () => {
  const selection = {
    releaseNumber: 3,
    artifactFingerprint: 'b'.repeat(64),
    impactRunId: 'run-3',
    activationId: 'release-3-production',
    schemaIdentity: 'character-sheet-v1',
    calculationIdentity: currentCalculationIdentity,
    isFixtureOnly: false,
  };
  const activate = vi.fn(async () => selection);
  const status = vi.fn();
  expect(
    await runCatalogReleaseOperator({
      args: productionActivation(currentCalculationIdentity),
      activationAdapter: { activate, status },
    }),
  ).toEqual({
    ...selection,
    calculationServing: 'current',
    operatorReminder: `Record ${currentCalculationIdentity} as productionActivatedCalculationIdentity in src/lib/catalog/production-calculation-identity.ts: send it to root, who commits it. The rotation guard sees only the recorded identity.`,
  });
  expect(activate).toHaveBeenCalledWith({
    releaseNumber: 3,
    runId: 'run-3',
    activationId: 'release-3-production',
    schemaIdentity: 'character-sheet-v1',
    calculationIdentity: currentCalculationIdentity,
    isFixtureOnly: false,
    writeEpoch: 0,
  });
});

it.each([
  [['--fixture-only'], '--production cannot be combined with --fixture-only.'],
  [
    ['--target-kind', 'preview'],
    '--production applies only to allocate or activate with --target-kind production.',
  ],
])(
  'refuses production activation with %j before any adapter, credential or request',
  async (extra, message) => {
    const activate = vi.fn();
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    try {
      for (const activationAdapter of [
        { activate, status: vi.fn() },
        undefined,
      ])
        await expect(
          runCatalogReleaseOperator({
            args: [
              ...productionActivation(currentCalculationIdentity),
              ...extra,
              '--deployment-name',
              'quiet-otter-123',
              '--deployment-url',
              'https://quiet-otter-123.convex.cloud',
              '--admin-key-file',
              '/nonexistent/admin.key',
            ],
            activationAdapter,
          }),
        ).rejects.toThrow(message);
      expect(activate).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  },
);

it('keeps every target guard for a production activation: the named URL and the key for that production deployment', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'catalog-activation-'));
  const keyFile = join(directory, 'admin.key');
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const activateOn = (name: string, url: string) =>
    runCatalogReleaseOperator({
      args: [
        ...productionActivation(currentCalculationIdentity),
        '--deployment-name',
        name,
        '--deployment-url',
        url,
        '--admin-key-file',
        keyFile,
      ],
    });
  try {
    await writeFile(keyFile, 'prod:quiet-otter-123|synthetic-admin-key');
    await expect(
      activateOn('quiet-otter-123', 'https://other-otter-456.convex.cloud'),
    ).rejects.toThrow(
      'Deployment URL must match the explicitly named deployment.',
    );
    await expect(
      activateOn('other-otter-456', 'https://other-otter-456.convex.cloud'),
    ).rejects.toThrow(
      'The admin key is for production deployment quiet-otter-123; the target is production deployment other-otter-456.',
    );
    await writeFile(keyFile, 'preview:quiet-otter-123|synthetic-admin-key');
    await expect(
      activateOn('quiet-otter-123', 'https://quiet-otter-123.convex.cloud'),
    ).rejects.toThrow(
      'The admin key is for preview deployment quiet-otter-123; the target is production deployment quiet-otter-123.',
    );
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
    await rm(directory, { recursive: true, force: true });
  }
});

// #413 F8b: the status line says how this checkout serves the active
// release's calculation identity.
it.each([
  [currentCalculationIdentity, 'current'],
  [retainedPriorCalculationIdentity, 'prior'],
  [`sha256:${'0'.repeat(64)}`, 'outside-window'],
] as const)(
  'reports how this checkout serves an active release calculated as %s',
  async (calculationIdentity, calculationServing) => {
    const selection = {
      releaseNumber: 3,
      artifactFingerprint: 'b'.repeat(64),
      impactRunId: 'run-3',
      activationId: 'release-3-production',
      schemaIdentity: 'character-sheet-v1',
      calculationIdentity,
      isFixtureOnly: false,
    };
    expect(
      await runCatalogReleaseOperator({
        args: ['active'],
        activationAdapter: { activate: vi.fn(), status: async () => selection },
      }),
    ).toEqual({ ...selection, calculationServing });
  },
);

it('reports no active release as null', async () => {
  expect(
    await runCatalogReleaseOperator({
      args: ['active'],
      activationAdapter: { activate: vi.fn(), status: async () => null },
    }),
  ).toBeNull();
});

// #413 F8 fix r1: the owner's runbook starts with `active` after every deploy,
// so `active` against production says when the recorded production identity
// is not the active one. It only reads.
const otherIdentity = `sha256:${'1'.repeat(64)}`;
it.each([
  [currentCalculationIdentity, { kind: 'recorded' }],
  [
    otherIdentity,
    {
      kind: 'recorded-other',
      recorded: otherIdentity,
      reminder: `The active release's calculation identity ${currentCalculationIdentity} is not the one recorded in src/lib/catalog/production-calculation-identity.ts (${otherIdentity}): send it to root to record as productionActivatedCalculationIdentity. The rotation guard sees only the recorded identity.`,
    },
  ],
  [
    null,
    {
      kind: 'not-recorded',
      reminder: `The active release's calculation identity ${currentCalculationIdentity} is not recorded in src/lib/catalog/production-calculation-identity.ts: send it to root to record as productionActivatedCalculationIdentity. The rotation guard sees only the recorded identity.`,
    },
  ],
] as const)(
  'compares the production active identity with the recorded one %s',
  async (productionCalculationRecord, productionRecord) => {
    const selection = {
      releaseNumber: 3,
      artifactFingerprint: 'b'.repeat(64),
      impactRunId: 'run-3',
      activationId: 'release-3-production',
      schemaIdentity: 'character-sheet-v1',
      calculationIdentity: currentCalculationIdentity,
      isFixtureOnly: false,
    };
    const activate = vi.fn();
    expect(
      await runCatalogReleaseOperator({
        args: ['active', '--target-kind', 'production'],
        activationAdapter: { activate, status: async () => selection },
        productionCalculationRecord,
      }),
    ).toEqual({
      ...selection,
      calculationServing: 'current',
      productionRecord,
    });
    expect(activate).not.toHaveBeenCalled();
  },
);

it('leaves the record comparison out for a target that is not production', async () => {
  const selection = {
    releaseNumber: 3,
    artifactFingerprint: 'b'.repeat(64),
    impactRunId: 'run-3',
    activationId: 'release-3-preview',
    schemaIdentity: 'character-sheet-v1',
    calculationIdentity: currentCalculationIdentity,
    isFixtureOnly: true,
  };
  expect(
    await runCatalogReleaseOperator({
      args: ['active', '--target-kind', 'preview'],
      activationAdapter: { activate: vi.fn(), status: async () => selection },
      productionCalculationRecord: null,
    }),
  ).toEqual({ ...selection, calculationServing: 'current' });
});
