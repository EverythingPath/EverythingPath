// @vitest-environment node
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { failureReport } from './setup-failure';
import {
  authorizePreview,
  authorizePreviewEndpoint,
  pinnedConvexVersion,
  readInstalledConvexVersion,
  removeAdminKeyFile,
  writeAdminKeyFile,
} from './preview-admin-key';

const previewKey = 'preview:test-team:test-project|preview-secret-0123';
const adminKey = 'e2e-local-test-slot-0|admin-secret-4567';
const expectedUrl = 'https://quiet-otter-123.convex.cloud';
const granted = {
  deploymentName: 'quiet-otter-123',
  adminKey,
  url: expectedUrl,
  deploymentType: 'preview',
  reference: null,
  isDefault: false,
};

type Request = { url: string; init: RequestInit };
function stubFetch(response: () => Response | Promise<Response>) {
  const requests: Request[] = [];
  const fetch = (
    url: string | URL | globalThis.Request,
    init?: RequestInit,
  ) => {
    requests.push({
      url: url instanceof globalThis.Request ? url.url : url.toString(),
      init: init ?? {},
    });
    return Promise.resolve(response());
  };
  return { fetch: fetch as typeof globalThis.fetch, requests };
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const exchange = (fetch: typeof globalThis.fetch, overrides = {}) =>
  authorizePreview({
    previewKey,
    previewName: 'e2e-local-test-slot-0',
    expectedUrl,
    installedVersion: pinnedConvexVersion,
    fetch,
    ...overrides,
  });
// Nothing a failure prints or keeps may contain a credential.
function expectRedacted(error: unknown) {
  const report = failureReport(error).join('\n');
  for (const secret of [
    adminKey,
    previewKey,
    'preview-secret-0123',
    'quiet-otter-123',
    'other-otter-1',
  ])
    expect(`${report}\n${String(error)}`).not.toContain(secret);
  expect(error).toMatchObject({ name: 'HarnessFailure' });
  expect((error as Error).cause).toBeUndefined();
  return report;
}

it('sends the installed CLI’s preview-key exchange once and returns the preview’s admin key', async () => {
  const { fetch, requests } = stubFetch(() => json(granted));
  await expect(exchange(fetch)).resolves.toEqual({
    deploymentName: 'quiet-otter-123',
    deploymentUrl: expectedUrl,
    adminKey,
  });
  expect(requests).toHaveLength(1);
  const [{ url, init }] = requests as [Request];
  expect(url).toBe('https://api.convex.dev/api/deployment/authorize_preview');
  expect(url).toBe(authorizePreviewEndpoint);
  expect(init.method).toBe('POST');
  expect(init.redirect).toBe('error');
  expect(init.headers).toEqual({
    Authorization: `Bearer ${previewKey}`,
    'Convex-Client': 'npm-cli-1.45.0',
    'Content-Type': 'application/json',
  });
  // node_modules/convex/src/cli/lib/api.ts `handlePreview`, with the
  // project selection `getTeamAndProjectFromPreviewAdminKey` reads from the key.
  expect(typeof init.body).toBe('string');
  expect(JSON.parse(init.body as string)).toEqual({
    previewName: 'e2e-local-test-slot-0',
    projectSelection: {
      kind: 'teamAndProjectSlugs',
      teamSlug: 'test-team',
      projectSlug: 'test-project',
    },
  });
});

it('refuses, before any request, a CLI version other than the pinned one or a key that is not a preview key', async () => {
  const { fetch, requests } = stubFetch(() => json(granted));
  for (const overrides of [
    { installedVersion: '1.45.1' },
    { previewKey: 'prod:test-team:test-project|secret' },
    { previewKey: `${previewKey} ` },
    { previewName: 'production' },
  ]) {
    const error = await exchange(fetch, overrides).catch((e: unknown) => e);
    expectRedacted(error);
  }
  expect(requests).toEqual([]);
});

it('fails closed on HTTP errors and names only the status', async () => {
  for (const status of [400, 401, 403, 404, 500, 503]) {
    const { fetch } = stubFetch(() =>
      json({ code: 'Unauthorized', message: `bad key ${previewKey}` }, status),
    );
    const error = await exchange(fetch).catch((e: unknown) => e);
    expect(expectRedacted(error)).toContain(`HTTP ${status}`);
  }
  const redirect = stubFetch(() => {
    throw new TypeError(`redirect refused for ${previewKey}`);
  });
  expectRedacted(await exchange(redirect.fetch).catch((e: unknown) => e));
});

// The one printed line of a failed exchange.
async function reportOf(body: unknown, overrides = {}) {
  const { fetch } = stubFetch(() => json(body));
  const error = await exchange(fetch, overrides).catch((e: unknown) => e);
  return expectRedacted(error);
}
const keys =
  'keys: adminKey,deploymentName,deploymentType,isDefault,reference,url';
const lead = 'E2E preview admin key exchange failed closed:';

it('names a response that is not JSON', async () => {
  const { fetch } = stubFetch(
    () => new Response(`not json ${adminKey}`, { status: 200 }),
  );
  expect(expectRedacted(await exchange(fetch).catch((e: unknown) => e))).toBe(
    `${lead} the response is not JSON`,
  );
});

it('names each schema issue by path and code, and the top-level keys, never a value', async () => {
  expect(await reportOf({ ...granted, adminKey: 42 })).toBe(
    `${lead} the response does not have the expected fields (issues: adminKey:invalid_type; ${keys})`,
  );
  for (const adminKeyValue of [
    '',
    `${adminKey}\nsecond line`,
    'k'.repeat(4097),
  ])
    expect(await reportOf({ ...granted, adminKey: adminKeyValue })).toMatch(
      /issues: adminKey:[a-z_]+(?:, adminKey:[a-z_]+)*; keys: /,
    );
  expect(
    await reportOf({ deploymentName: 'Quiet Otter', url: expectedUrl }),
  ).toBe(
    `${lead} the response does not have the expected fields (issues: deploymentName:invalid_format, adminKey:invalid_type; keys: deploymentName,url)`,
  );
  for (const body of [null, [], 'admin-key'])
    expect(await reportOf(body)).toBe(
      `${lead} the response does not have the expected fields (issues: (root):invalid_type; keys: none)`,
    );
  // Only the response type's own field names print; any other name, however
  // plain, is counted, never shown: it could be the credential itself.
  expect(await reportOf({ adminKey, 'quiet-otter-123 secret': 1 })).toContain(
    'keys: adminKey; other keys: 1',
  );
  const leaked = await reportOf({ adminKey: 'Secret123', Secret123: 1 });
  expect(leaked).not.toContain('Secret123');
  expect(leaked).toBe(
    `${lead} the response does not have the expected fields (issues: deploymentName:invalid_type, url:invalid_type; keys: adminKey; other keys: 1)`,
  );
});

it('accepts an absent or preview deploymentType and refuses any other, printing only a known type', async () => {
  const { deploymentType: _type, ...untyped } = granted;
  const { fetch } = stubFetch(() => json(untyped));
  await expect(exchange(fetch)).resolves.toMatchObject({ adminKey });
  for (const deploymentType of ['prod', 'dev', 'custom', 'local'])
    expect(await reportOf({ ...granted, deploymentType })).toBe(
      `${lead} the response is not a preview deployment (deploymentType: ${deploymentType}; ${keys})`,
    );
  for (const deploymentType of ['production-quiet-otter-123', 'Preview'])
    expect(await reportOf({ ...granted, deploymentType })).toBe(
      `${lead} the response is not a preview deployment (deploymentType: other; ${keys})`,
    );
});

it('binds the key to the URL this run bound, plain or regional, and describes any other URL by three booleans', async () => {
  const regional = 'https://quiet-otter-123.eu-west-1.convex.cloud';
  const { fetch } = stubFetch(() => json({ ...granted, url: regional }));
  await expect(exchange(fetch, { expectedUrl: regional })).resolves.toEqual({
    deploymentName: 'quiet-otter-123',
    deploymentUrl: regional,
    adminKey,
  });
  expect(await reportOf({ ...granted, url: regional })).toBe(
    `${lead} the response is not this run's preview URL (url: equal=false plain=false regional=true; ${keys})`,
  );
  // A region-shaped host label can carry anything, even the credential, so no
  // part of the URL prints.
  const regionSecret = await reportOf({
    ...granted,
    adminKey: 'eu-secret-1',
    url: 'https://quiet-otter-123.eu-secret-1.convex.cloud',
  });
  expect(regionSecret).not.toContain('eu-secret-1');
  expect(regionSecret).toBe(
    `${lead} the response is not this run's preview URL (url: equal=false plain=false regional=true; ${keys})`,
  );
  // Another deployment than the one this run created and bound.
  expect(
    await reportOf({
      ...granted,
      deploymentName: 'other-otter-1',
      url: 'https://other-otter-1.convex.cloud',
    }),
  ).toBe(
    `${lead} the response is not this run's preview URL (url: equal=false plain=true regional=false; ${keys})`,
  );
  // The bound URL, but under another deployment's name.
  expect(await reportOf({ ...granted, deploymentName: 'other-otter-1' })).toBe(
    `${lead} the response is not this run's preview URL (url: equal=true plain=true regional=false; ${keys})`,
  );
  expect(
    await reportOf({ ...granted, url: 'http://quiet-otter-123.convex.cloud' }),
  ).toBe(
    `${lead} the response is not this run's preview URL (url: equal=false plain=false regional=false; ${keys})`,
  );
});

it('pins the installed Convex CLI: its version and its exchange request', async () => {
  const root = process.cwd();
  expect(await readInstalledConvexVersion(root)).toBe(pinnedConvexVersion);
  const cli = join(root, 'node_modules', 'convex', 'src', 'cli', 'lib');
  const api = await readFile(join(cli, 'api.ts'), 'utf8');
  const handler = api.slice(api.indexOf('async function handlePreview('));
  expect(handler).toMatch(
    /path: "deployment\/authorize_preview",\s+data: \{\s+previewName: previewName,\s+projectSelection: projectSelection,\s+\},/,
  );
  expect(api).toMatch(
    /type DeploymentAuthResponse = \{\s+deploymentName: string;\s+adminKey: string;\s+url: string;\s+deploymentType: DeploymentType;/,
  );
  const utils = await readFile(join(cli, 'utils', 'utils.ts'), 'utf8');
  expect(utils).toContain(
    'export const productionProvisionHost = "https://api.convex.dev";',
  );
  expect(utils).toContain(
    'export const BIG_BRAIN_URL = `${provisionHost}/api/`;',
  );
  expect(utils).toContain('"Convex-Client": `npm-cli-${version}`,');
  const selection = await readFile(join(cli, 'deploymentSelection.ts'), 'utf8');
  expect(selection).toContain('header: `Bearer ${opts.previewDeployKey}`,');
});

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'preview-admin-key-'));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

it('writes the key once, mode 600, and removal leaves nothing behind', async () => {
  const path = join(directory, 'private', 'release-admin.key');
  await writeAdminKeyFile({ path, adminKey });
  expect(await readFile(path, 'utf8')).toBe(adminKey);
  expect((await stat(path)).mode & 0o777).toBe(0o600);
  expect((await stat(join(directory, 'private'))).mode & 0o777).toBe(0o700);
  // Never overwrites a key another stage left behind.
  expectRedacted(
    await writeAdminKeyFile({ path, adminKey: 'other' }).catch(
      (e: unknown) => e,
    ),
  );
  expect(await readFile(path, 'utf8')).toBe(adminKey);
  await removeAdminKeyFile(path);
  await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' });
  // Idempotent, so every cleanup path may call it.
  await removeAdminKeyFile(path);
});

it('reports a key file it cannot remove as a leftover', async () => {
  // A directory at the key's path can't be removed as a file.
  const path = join(directory, 'release-admin.key');
  await mkdir(path);
  await writeFile(join(path, 'inner'), adminKey);
  const error = await removeAdminKeyFile(path).catch((e: unknown) => e);
  expect(expectRedacted(error)).toContain('admin key file');
});
