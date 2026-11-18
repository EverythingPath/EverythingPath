// @vitest-environment node
import { expect, it } from 'vitest';
import { guardFixtureScope } from '../fixtures/catalog';
import { deploymentFixture } from './test-data';

const localInstance = 'ep-e2e-8f0f6cab-1258-4fdc-993a-c2e06ad44f96';
const config = {
  ...deploymentFixture,
  convexUrl: 'http://127.0.0.1:3210',
  localInstance,
};
const environment = {
  E2E_ENABLED: 'true',
  E2E_LOCAL_INSTANCE: localInstance,
  E2E_FIXTURE_CONFIG: JSON.stringify(config),
  CONVEX_CLOUD_URL: config.convexUrl,
};
const scope = {
  version: 1,
  namespace: config.namespace,
  workerKey: 'worker-0',
  caseKey: 'smoke' as const,
  session: config.session,
  token: config.workers[0]!.capability,
};

it('permits fixtures only on the bound local instance with the cohort capability', () => {
  expect(guardFixtureScope(environment, scope).config.convexUrl).toBe(
    config.convexUrl,
  );
  for (const override of [
    { E2E_ENABLED: 'false' },
    { E2E_LOCAL_INSTANCE: '' },
    { E2E_LOCAL_INSTANCE: 'ep-dev-0123456789ab' },
    { CONVEX_CLOUD_URL: 'http://127.0.0.1:3212' },
    { CONVEX_DEPLOYMENT: 'prod:main' },
  ])
    expect(() =>
      guardFixtureScope({ ...environment, ...override }, scope),
    ).toThrow('fixture access refused');
  expect(() =>
    guardFixtureScope(environment, { ...scope, token: 'wrong' }),
  ).toThrow('fixture access refused');
});

it.each([
  'http://localhost:3210',
  'http://127.0.0.1:3210/path',
  'http://127.0.0.1:65536',
  'http://127.0.0.1:3210@evil.test',
  'https://preview.convex.cloud',
  'http://192.168.1.1:3210',
])('local fixture binding refuses %s even with copied flags', (convexUrl) => {
  expect(() =>
    guardFixtureScope(
      {
        ...environment,
        CONVEX_CLOUD_URL: convexUrl,
        E2E_FIXTURE_CONFIG: JSON.stringify({ ...config, convexUrl }),
      },
      scope,
    ),
  ).toThrow('fixture access refused');
});

it('a Cloud fixture config cannot silently become a local fixture config', () => {
  expect(() =>
    guardFixtureScope(
      {
        ...environment,
        E2E_FIXTURE_CONFIG: JSON.stringify({
          ...deploymentFixture,
          convexUrl: config.convexUrl,
        }),
      },
      scope,
    ),
  ).toThrow();
});

it("binds a cohort's capability to this run's session and to that cohort only", () => {
  const twoCohorts = {
    ...config,
    workers: [
      config.workers[0]!,
      {
        ...config.workers[0]!,
        key: 'worker-1',
        capability: 'Q'.repeat(43),
      },
    ],
  };
  const bound = {
    ...environment,
    E2E_FIXTURE_CONFIG: JSON.stringify(twoCohorts),
  };
  expect(guardFixtureScope(bound, scope).worker.key).toBe('worker-0');
  for (const refused of [
    // An earlier session's credentials, after the next run's bind.
    { session: '00000000-0000-4000-8000-000000000000' },
    // Another cohort's capability, or this cohort's on another cohort.
    { token: 'Q'.repeat(43) },
    { workerKey: 'worker-1' },
    // Same length, one character off.
    {
      token: `${scope.token.slice(0, 42)}${scope.token.endsWith('A') ? 'B' : 'A'}`,
    },
  ])
    expect(() => guardFixtureScope(bound, { ...scope, ...refused })).toThrow(
      'fixture access refused',
    );
  // The documented trade-off (#754): a cohort capability authorizes every
  // valid case of that cohort; `expectedCampaignId` guards case targeting.
  expect(
    guardFixtureScope(bound, { ...scope, caseKey: 'isolation' }).worker.key,
  ).toBe('worker-0');
});
