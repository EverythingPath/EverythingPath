import type { DeploymentFixture, Resources } from '../fixtures/catalog';

export const resources: Resources = {
  version: 1,
  team: 'test-team',
  project: 'test-project',
  previewName: 'e2e-local-test-slot-0',
  clerkHost: 'testing-otter-1.clerk.accounts.dev',
  production: {
    clerkHosts: ['clerk.production.example'],
    convexUrls: ['https://production.convex.cloud'],
  },
  workers: [
    {
      key: 'worker-0',
      organizationId: 'org_members',
      outsiderOrganizationId: 'org_outsiders',
      gm: { userId: 'user_gm', email: 'gm+clerk_test@example.test' },
      player: {
        userId: 'user_player',
        email: 'player+clerk_test@example.test',
      },
      outsider: {
        userId: 'user_outsider',
        email: 'outsider+clerk_test@example.test',
      },
    },
  ],
};
// The shape of a local three-cohort declaration, with synthetic provider IDs.
// Cohort N has its own member and outsider organizations and three users.
export const threeCohortResources: Resources = {
  ...resources,
  workers: [0, 1, 2].map((index) => {
    const n = index === 0 ? '' : String(index);
    return {
      key: `worker-${index}`,
      organizationId: `org_members${n}`,
      outsiderOrganizationId: `org_outsiders${n}`,
      gm: { userId: `user_gm${n}`, email: `gm${n}+clerk_test@example.test` },
      player: {
        userId: `user_player${n}`,
        email: `player${n}+clerk_test@example.test`,
      },
      outsider: {
        userId: `user_outsider${n}`,
        email: `outsider${n}+clerk_test@example.test`,
      },
    };
  }),
};
export const safeEnvironment = {
  E2E_TRUSTED_EXECUTION: 'true',
  CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from(`${resources.clerkHost}$`).toString('base64')}`,
  CLERK_SECRET_KEY: 'sk_test_fixture',
  CONVEX_DEPLOY_KEY: 'preview:test-team:test-project|secret',
};
// A cohort capability in the generated form: 32 bytes, base64url.
export const workerCapability = 'Tm90LWEtcmVhbC1zZWNyZXQtanVzdC10ZXN0LWRhdGE';
export const fixtureSession = '6f1c2b0e-3d4a-4b5c-8d6e-7f8091a2b3c4';
export const deploymentFixture: DeploymentFixture = {
  version: 1,
  namespace: resources.previewName,
  convexUrl: 'https://quiet-otter-123.convex.cloud',
  clerkHost: resources.clerkHost,
  productionConvexUrls: resources.production.convexUrls,
  session: fixtureSession,
  workers: resources.workers.map((worker) => ({
    ...worker,
    capability: workerCapability,
  })),
};
/** What a test's fixture scope presents for cohort worker-0. */
export const fixtureCredentials = {
  session: fixtureSession,
  token: workerCapability,
};
