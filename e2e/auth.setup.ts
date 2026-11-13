import { test as setup, type Browser } from '@playwright/test';
import { clerk, clerkSetup } from '@clerk/testing/playwright';
import { join } from 'node:path';
import { FIXTURE_VERSION, roleKeys } from './fixtures/catalog';
import { fixtureCall, loadRun, savePrivate, type Run } from './support/process';

type Cohort = NonNullable<Run['fixture']>['workers'][number];

setup.describe.configure({ mode: 'serial' });
setup('prepare fresh role sessions', async ({ browser }) => {
  const run = await loadRun();
  // Every cohort a worker will use, one after another: parallel sign-ins would
  // exceed Clerk's per-IP sign-in limits. Each cohort keeps the one-cohort
  // deadline.
  const cohorts = run.fixture?.workers.slice(0, run.workers) ?? [];
  if (cohorts.length !== run.workers) throw new Error('Missing fixture cohort');
  setup.setTimeout(setup.info().timeout * cohorts.length);
  await clerkSetup({
    dotenv: false,
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  });
  for (const worker of cohorts) await prepareCohort(browser, run, worker);
});

async function prepareCohort(browser: Browser, run: Run, worker: Cohort) {
  await fixtureCall(run, 'seedIdentityProjection', {
    namespace: run.resources.previewName,
    version: FIXTURE_VERSION,
    workerKey: worker.key,
    caseKey: 'smoke',
    session: run.fixture!.session,
    token: worker.capability,
  });
  for (const role of roleKeys) {
    // Authentication never records traces or screenshots. Each role starts empty.
    const context = await browser.newContext({
      baseURL: run.baseURL,
      viewport: { width: 1194, height: 834 },
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await page.goto('/');
      await clerk.signIn({ page, emailAddress: worker[role].email });
      await page.evaluate(
        async ({ organizationId, userId }) => {
          if (window.Clerk.user?.id !== userId)
            throw new Error(
              'Fixture role did not authenticate as the declared user',
            );
          await window.Clerk.setActive({ organization: organizationId });
        },
        {
          organizationId:
            role === 'outsider'
              ? worker.outsiderOrganizationId
              : worker.organizationId,
          userId: worker[role].userId,
        },
      );
      const organizationId =
        role === 'outsider'
          ? worker.outsiderOrganizationId
          : worker.organizationId;
      await page.waitForFunction(
        (id) => window.Clerk.organization?.id === id,
        organizationId,
      );
      // Prove the production Clerk -> Convex JWT path, without retaining the JWT.
      await page.evaluate(async (url) => {
        const token = await window.Clerk.session?.getToken({
          template: 'convex',
        });
        if (!token) throw new Error('Missing Convex session');
        const response = await fetch(`${url}/api/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            path: 'user:getMe',
            args: {},
            format: 'json',
          }),
        });
        const result: unknown = await response.json();
        if (
          !response.ok ||
          !result ||
          typeof result !== 'object' ||
          !('value' in result) ||
          !result.value
        )
          throw new Error('Clerk session has no Convex identity projection');
      }, run.fixture!.convexUrl);
      await savePrivate(
        join(run.privateDirectory, 'auth', `${worker.key}-${role}.json`),
        JSON.stringify(await context.storageState()),
      );
    } finally {
      await context.close();
    }
  }
}
