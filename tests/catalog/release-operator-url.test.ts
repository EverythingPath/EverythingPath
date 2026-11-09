// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { runCatalogReleaseOperator } from '../../scripts/catalog/release-operator';

// The operator names its target explicitly and the URL must be that
// deployment's: https://<name>(.<region>)?.convex.cloud, nothing else (#753,
// owner decision 2026-10-16). The check runs before any credential or remote
// I/O, for every target kind, production included (#413).
let directory: string;
let keyFile: string;
let requested: string[];
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'release-operator-url-'));
  keyFile = join(directory, 'admin.key');
  await writeFile(keyFile, 'synthetic-admin-key');
  requested = [];
  vi.stubGlobal('fetch', (url: unknown) => {
    requested.push(String(url));
    return Promise.resolve(
      new Response(JSON.stringify({ status: 'success', value: null })),
    );
  });
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(directory, { recursive: true, force: true });
});

const active = (
  name: string,
  url: string,
  targetKind: string,
  adminKeyFile = keyFile,
) =>
  runCatalogReleaseOperator({
    args: [
      'active',
      '--deployment-name',
      name,
      '--deployment-url',
      url,
      '--target-kind',
      targetKind,
      '--admin-key-file',
      adminKeyFile,
    ],
  });
// A refusal must come before any credential I/O: with a key file that does
// not exist, reading it first would fail with ENOENT instead.
const refused = (name: string, url: string, targetKind: string) =>
  expect(
    active(name, url, targetKind, join(directory, 'missing.key')),
  ).rejects.toThrow(
    'Deployment URL must match the explicitly named deployment.',
  );

const targetKinds = ['preview', 'development', 'production'] as const;

it('binds a local operator to the backend instance before sending its key', async () => {
  const name = 'ep-e2e-11111111-1111-1111-1111-111111111111';
  const url = 'http://127.0.0.1:3210';
  vi.stubGlobal('fetch', (input: string, options?: RequestInit) => {
    requested.push(input);
    if (input.endsWith('/instance_name')) {
      expect(options?.headers).toBeUndefined();
      return Promise.resolve(new Response(name));
    }
    return Promise.resolve(
      new Response(JSON.stringify({ status: 'success', value: null })),
    );
  });
  await expect(active(name, url, 'local')).resolves.toBe(null);
  expect(requested).toEqual([`${url}/instance_name`, `${url}/api/function`]);
  await expect(
    active('ep-dev-111111111111', url, 'local', join(directory, 'missing.key')),
  ).rejects.toThrow('Local Convex instance does not match');
  for (const unsafe of [
    'http://localhost:3210',
    'http://192.168.1.2:3210',
    'https://quiet-otter-123.convex.cloud',
  ])
    await refused(name, unsafe, 'local');
});

it.each(targetKinds)(
  'accepts the named deployment’s plain or regional URL for a %s target',
  async (targetKind) => {
    for (const url of [
      'https://quiet-otter-123.convex.cloud',
      'https://quiet-otter-123.eu-west-1.convex.cloud',
    ]) {
      requested = [];
      await expect(active('quiet-otter-123', url, targetKind)).resolves.toBe(
        null,
      );
      expect(requested).toHaveLength(1);
      expect(requested[0]?.startsWith(`${url}/api/`)).toBe(true);
    }
  },
);

it.each(targetKinds)(
  'refuses any other URL for a %s target before any remote call',
  async (targetKind) => {
    for (const url of [
      // Another deployment's name.
      'https://other-otter-1.convex.cloud',
      'https://other-otter-1.eu-west-1.convex.cloud',
      // An extra label, or a region that is not a plain region label.
      'https://quiet-otter-123.eu-west-1.extra.convex.cloud',
      'https://quiet-otter-123.extra.eu-west-1.convex.cloud',
      'https://quiet-otter-123.eu_west-1.convex.cloud',
      'https://quiet-otter-123.EU-WEST-1.convex.cloud',
      // Not a convex.cloud host, or not exactly the origin.
      'https://quiet-otter-123.convex.site',
      'https://quiet-otter-123.convex.cloud.example.com',
      'http://quiet-otter-123.convex.cloud',
      'https://quiet-otter-123.convex.cloud:443',
      'https://quiet-otter-123.convex.cloud/',
      'https://quiet-otter-123.convex.cloud/api',
      'https://quiet-otter-123.convex.cloud?x=1',
      'https://quiet-otter-123.eu-west-1.convex.cloud#x',
      // Userinfo, before or after the host.
      'https://x@quiet-otter-123.convex.cloud',
      'https://quiet-otter-123.convex.cloud@evil.com',
      'https://quiet-otter-123.eu-west-1.convex.cloud@evil.com',
      // Trailing dots.
      'https://quiet-otter-123.convex.cloud.',
      'https://quiet-otter-123.eu-west-1.convex.cloud.',
      // Unicode, IDN and punycode look-alikes (Cyrillic о and е).
      'https://quiet-\u043etter-123.convex.cloud',
      'https://quiet-otter-123.conv\u0435x.cloud',
      'https://xn--quiet-tter-123-xxx.convex.cloud',
      'https://quiet-otter-123.xn--convx-xxx.cloud',
      // Percent-encoded hosts.
      'https://quiet%2Dotter-123.convex.cloud',
      'https://quiet-otter-123%2Econvex.cloud',
      'https://quiet-otter-123.convex%2Ecloud',
      // Uppercase scheme, name or domain.
      'HTTPS://quiet-otter-123.convex.cloud',
      'Https://quiet-otter-123.convex.cloud',
      'https://QUIET-OTTER-123.convex.cloud',
      'https://quiet-otter-123.CONVEX.CLOUD',
      'https://quiet-otter-123.Convex.cloud',
    ])
      await refused('quiet-otter-123', url, targetKind);
    for (const [name, url] of [
      ['Quiet Otter', 'https://Quiet Otter.convex.cloud'],
      ['QUIET-OTTER-123', 'https://QUIET-OTTER-123.convex.cloud'],
      ['quiet-\u043etter-123', 'https://quiet-\u043etter-123.convex.cloud'],
      ['xn--quiet-tter-123-xxx', 'https://quiet-otter-123.convex.cloud'],
      ['quiet%2Dotter-123', 'https://quiet%2Dotter-123.convex.cloud'],
    ] as const)
      await refused(name, url, targetKind);
    // An empty name is refused even earlier, still before the key.
    await expect(
      active(
        '',
        'https://.convex.cloud',
        targetKind,
        join(directory, 'missing.key'),
      ),
    ).rejects.toThrow('--deployment-name is required.');
    // The control: an accepted URL does read the missing key, and fails on it.
    await expect(
      active(
        'quiet-otter-123',
        'https://quiet-otter-123.convex.cloud',
        targetKind,
        join(directory, 'missing.key'),
      ),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    expect(requested).toEqual([]);
  },
);
