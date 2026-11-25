// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  runE2EPreflight,
  validateE2ETargets,
  validatePreviewBinding,
} from './preflight';
import { resources, safeEnvironment } from './test-data';

describe('E2E preflight before any writing adapter', () => {
  it('local runs need no Cloud credential and never forward a stored preview key', () => {
    expect(
      validateE2ETargets(
        { ...safeEnvironment, CONVEX_DEPLOY_KEY: '' },
        resources,
        'local',
      ).previewKey,
    ).toBe('');
    expect(
      validateE2ETargets(safeEnvironment, resources, 'local').previewKey,
    ).toBe('');
    expect(() =>
      validateE2ETargets(
        { ...safeEnvironment, CONVEX_DEPLOY_KEY: 'prod:main|secret' },
        resources,
        'local',
      ),
    ).toThrow();
    expect(() =>
      validateE2ETargets(
        { ...safeEnvironment, CONVEX_SELF_HOSTED_URL: 'http://127.0.0.1:3210' },
        resources,
        'local',
      ),
    ).toThrow();
  });
  it.each(['pull_request', 'schedule'])(
    'requires the tested commit to match the trusted %s workflow declaration',
    async (event) => {
      const environment = {
        ...safeEnvironment,
        CI: 'true',
        GITHUB_ACTIONS: 'true',
        GITHUB_EVENT_NAME: event,
        GITHUB_ACTOR: 'owner',
        GITHUB_SHA: 'tested-merge-commit',
        E2E_REVIEWED_SHA: 'tested-merge-commit',
      };
      const write = vi.fn();
      await runE2EPreflight(environment, resources, write);
      expect(write).toHaveBeenCalledOnce();
      write.mockClear();
      await expect(
        runE2EPreflight(
          {
            ...environment,
            E2E_REVIEWED_SHA: 'different-commit',
          },
          resources,
          write,
        ),
      ).rejects.toThrow('reviewed commit');
      expect(write).not.toHaveBeenCalled();
    },
  );
  it('accepts regional preview URLs while enforcing the production denylist', () => {
    const url = 'https://quiet-otter-123.eu-west-1.convex.cloud';
    expect(validatePreviewBinding(resources, url)).toBe(url);
    expect(() =>
      validatePreviewBinding(
        {
          ...resources,
          production: { ...resources.production, convexUrls: [url] },
        },
        url,
      ),
    ).toThrow('resolved Convex URL is malformed or production');
  });
  it('accepts a preview creation key without guessing its future hostname', async () => {
    const write = vi.fn();
    await runE2EPreflight(safeEnvironment, resources, write);
    expect(write).toHaveBeenCalledOnce();
    expect(
      validatePreviewBinding(resources, 'https://quiet-otter-123.convex.cloud'),
    ).toBe('https://quiet-otter-123.convex.cloud');
  });
  it('accepts no production Clerk environment while still refusing live keys', async () => {
    const declaration = {
      ...resources,
      production: { ...resources.production, clerkHosts: [] },
    };
    const write = vi.fn();
    await runE2EPreflight(safeEnvironment, declaration, write);
    expect(write).toHaveBeenCalledOnce();

    write.mockClear();
    await expect(
      runE2EPreflight(
        { ...safeEnvironment, CLERK_SECRET_KEY: 'sk_live_secret' },
        declaration,
        write,
      ),
    ).rejects.toThrow('Clerk secret key must be a test key');
    expect(write).not.toHaveBeenCalled();
  });
  it('accepts opaque preview credentials containing equals signs', async () => {
    const write = vi.fn();
    await runE2EPreflight(
      {
        ...safeEnvironment,
        CONVEX_DEPLOY_KEY: `preview:${resources.team}:${resources.project}|part=other`,
      },
      resources,
      write,
    );
    expect(write).toHaveBeenCalledOnce();
  });
  it.each([
    { CLERK_SECRET_KEY: 'sk_live_secret' },
    { CLERK_PUBLISHABLE_KEY: 'pk_test_invalid' },
    { CONVEX_DEPLOY_KEY: 'prod:main|secret' },
    { CONVEX_DEPLOY_KEY: 'preview:deployment|secret' },
    { CONVEX_DEPLOY_KEY: 'project:team:project|secret' },
    { CONVEX_DEPLOY_KEY: 'preview:other:project|secret' },
    { CONVEX_DEPLOYMENT: 'dev:personal' },
    { CONVEX_SELF_HOSTED_URL: 'http://localhost:3210' },
    { NEXT_PUBLIC_CONVEX_URL: 'https://production.convex.cloud' },
    { CLERK_API_URL: 'https://evil.test' },
    { E2E_TRUSTED_EXECUTION: 'false' },
    { CI: 'true' },
    {
      CI: 'true',
      GITHUB_ACTIONS: 'true',
      GITHUB_EVENT_NAME: 'merge_group',
      GITHUB_ACTOR: 'owner',
      GITHUB_SHA: 'same',
      E2E_REVIEWED_SHA: 'same',
    },
    {
      CI: 'true',
      GITHUB_ACTIONS: 'true',
      GITHUB_EVENT_NAME: 'pull_request_target',
    },
    {
      CI: 'true',
      GITHUB_ACTIONS: 'true',
      GITHUB_EVENT_NAME: 'push',
      GITHUB_ACTOR: 'dependabot[bot]',
    },
    { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_other' },
  ])('refuses unsafe inherited configuration %j', async (overrides) => {
    const write = vi.fn();
    await expect(
      runE2EPreflight({ ...safeEnvironment, ...overrides }, resources, write),
    ).rejects.toThrow('E2E preflight');
    expect(write).not.toHaveBeenCalled();
  });
  it.each(['main', 'e2e-../prod', 'e2e-local', 'e2e-local-a-slot-0;echo'])(
    'rejects preview name %s',
    async (previewName) => {
      const write = vi.fn();
      await expect(
        runE2EPreflight(safeEnvironment, { ...resources, previewName }, write),
      ).rejects.toThrow();
      expect(write).not.toHaveBeenCalled();
    },
  );
  it.each([
    'garbage',
    'http://quiet-otter-123.convex.cloud',
    'https://a.convex.cloud.evil.test',
    'https://user:password@a.convex.cloud',
    'https://production.convex.cloud',
    'https://a.convex.cloud/?token=secret',
  ])('refuses resolved URL %s', (url) => {
    expect(() => validatePreviewBinding(resources, url)).toThrow();
  });
  it('rejects overlapping cohorts and denylisted Clerk hosts', async () => {
    for (const declaration of [
      { ...resources, workers: [...resources.workers, ...resources.workers] },
      {
        ...resources,
        production: {
          ...resources.production,
          clerkHosts: [resources.clerkHost],
        },
      },
    ]) {
      const write = vi.fn();
      await expect(
        runE2EPreflight(safeEnvironment, declaration, write),
      ).rejects.toThrow();
      expect(write).not.toHaveBeenCalled();
    }
  });
});
