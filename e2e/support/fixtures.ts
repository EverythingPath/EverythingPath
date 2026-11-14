import {
  test as base,
  expect,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { draftKeySchema } from '../../convex/lib/canonicalStorageValidators';
import {
  fixtureCatalog,
  FIXTURE_VERSION,
  type CaseKey,
  type RoleKey,
  type FixtureScope,
} from '../fixtures/catalog';
import {
  fixtureCall,
  isolateCases,
  loadRun,
  savePrivate,
  type Run,
} from './process';
import { retryTraceOptions, sanitizeTrace } from './artifacts';
import {
  captureScreenshot,
  observeServerState,
  recordPageEvidence,
} from './failure-evidence';
import {
  caseAttempt,
  claimCaseKey,
  clearLeftoverCase,
  describeResetFailure,
  handleCleanupFailure,
  retryCleanup,
} from './case-attempt';
import { refreshSessionToken } from './session-token';

export type Fixture = {
  scope: FixtureScope;
  /**
   * The scope plus the campaign the reset created, for the case's own
   * fixture operations after the reset (`expectedCampaignId`, #754).
   */
  caseScope: FixtureScope & { expectedCampaignId: string };
  // The campaign the automatic reset just created, so a journey never resets
  // the case again only to learn it.
  campaignId: z.infer<typeof draftKeySchema.shape.campaignId>;
  campaignName: string;
  inspect: () => Promise<unknown>;
  /** Record, once, the server's view of a failed attempt's case. */
  observeServer: () => Promise<void>;
};
type Players = { gm: Page; player: Page; outsider: Page };

async function closeWithEvidence(
  context: BrowserContext,
  role: string,
  run: Run,
  ownedCase: Fixture,
  info: TestInfo,
) {
  try {
    // Every role's page, wherever it is: run 2 kept only the watching
    // member's, so the owner's failing sheet could not be seen (#729). The
    // server's view comes first, so a stalled page can't cost it.
    if (info.status !== info.expectedStatus)
      await recordPageEvidence({
        role,
        pages: context.pages(),
        baseURL: run.baseURL,
        observeServer: ownedCase.observeServer,
        annotate: (description) =>
          info.annotations.push({ type: 'observation', description }),
        savePage: async (index, page) => {
          const screenshot = await captureScreenshot(page);
          if (!screenshot) return false;
          await savePrivate(
            join(
              run.artifactDirectory,
              `${info.project.name}-${ownedCase.scope.caseKey}-${info.retry}-${role}-${index}.png`,
            ),
            screenshot,
          );
          return true;
        },
      });
    if (info.retry === 1) {
      const raw = join(
        run.privateDirectory,
        `${ownedCase.scope.workerKey}-${role}.zip`,
      );
      await context.tracing.stop({ path: raw });
      await savePrivate(
        join(
          run.artifactDirectory,
          `${info.project.name}-${ownedCase.scope.caseKey}-retry-${role}.zip`,
        ),
        sanitizeTrace(await readFile(raw)),
      );
      await rm(raw, { force: true });
    }
  } finally {
    await context.close();
  }
}

// Opens a role's stored session with a current token, before any page loads.
async function roleContext(
  browser: Browser,
  run: Run,
  workerKey: string,
  role: RoleKey,
  options: Pick<BrowserContextOptions, 'viewport' | 'hasTouch' | 'isMobile'>,
) {
  const worker = run.resources.workers.find(({ key }) => key === workerKey);
  if (!worker) throw new Error('Authenticated worker cohort is unavailable');
  const context = await browser.newContext({
    ...options,
    baseURL: run.baseURL,
    storageState: join(
      run.privateDirectory,
      'auth',
      `${workerKey}-${role}.json`,
    ),
  });
  try {
    await refreshSessionToken(context, {
      resources: run.resources,
      baseURL: run.baseURL,
      userId: worker[role].userId,
    });
  } catch (error) {
    await context.close();
    throw error;
  }
  return context;
}

const resetResult = z.object({ campaignId: draftKeySchema.shape.campaignId });

async function useOwnedCase(
  caseKey: CaseKey,
  testCases: (CaseKey | undefined)[],
  use: (fixture: Fixture) => Promise<void>,
  info: TestInfo,
  familiarDemo = false,
) {
  const run = await loadRun();
  // Playwright never runs two workers with the same parallelIndex at once, so
  // each running test has cohort worker-N to itself.
  const worker = run.fixture?.workers[info.parallelIndex];
  if (!worker || info.parallelIndex >= run.workers)
    throw new Error('Authenticated worker cohort is unavailable');
  isolateCases(testCases.filter((key) => key !== undefined));
  const scope: FixtureScope = {
    namespace: run.resources.previewName,
    version: FIXTURE_VERSION,
    workerKey: worker.key,
    caseKey,
    session: run.fixture!.session,
    token: worker.capability,
  };
  // This auto fixture runs for every attempt, including replacement retry
  // workers. Context fixtures explicitly depend on it below. Ownership is per
  // project, not per cohort, so reuse is caught whichever cohorts tests run on.
  await claimCaseKey(
    run.privateDirectory,
    info.project.name,
    caseKey,
    info.testId,
  );
  const cohort = {
    privateDirectory: run.privateDirectory,
    workerKey: worker.key,
  };
  await caseAttempt(
    async () => {
      const reset = await fixtureCall(run, 'resetCase', {
        ...scope,
        now: 1_700_000_000_000,
        familiarDemo,
      }).catch(async (error: unknown) => {
        throw await describeResetFailure({ error, ...cohort });
      });
      await clearLeftoverCase({ ...cohort, caseKey });
      return resetResult.parse(reset);
    },
    async ({ campaignId }) => {
      // The reset's campaign rides along on the harness's own inspections
      // and cleanup: a cohort capability no longer tells cases apart (#754).
      const caseScope = { ...scope, expectedCampaignId: campaignId };
      let serverObserved: Promise<void> | undefined;
      const observeServer = () =>
        (serverObserved ??= observeServerState({
          caseKey,
          failed: info.status !== info.expectedStatus,
          inspect: () => fixtureCall(run, 'inspectMoves', caseScope),
        }).then((description) => {
          if (description)
            info.annotations.push({ type: 'observation', description });
        }));
      try {
        await use({
          scope,
          caseScope,
          campaignId,
          campaignName: `E2E ${fixtureCatalog[caseKey].campaign}`,
          inspect: () => fixtureCall(run, 'inspectCase', caseScope),
          observeServer,
        });
      } finally {
        // Before cleanup removes it, if no page has recorded it already.
        await observeServer();
      }
    },
    ({ campaignId }) =>
      retryCleanup({
        cleanup: async () => {
          await fixtureCall(run, 'cleanupCase', {
            ...scope,
            expectedCampaignId: campaignId,
          });
        },
        stopAt: run.browserStopAt ?? Number.POSITIVE_INFINITY,
      }),
    (error) =>
      handleCleanupFailure({
        error,
        scope,
        warn: (line) => process.stderr.write(line),
        privateDirectory: run.privateDirectory,
      }),
  );
}

export const test = base.extend<{
  caseKey: CaseKey;
  familiarDemo: boolean;
  ownedCase: Fixture;
  comparisonCaseKey: CaseKey | undefined;
  comparisonCase: Fixture | undefined;
  players: Players;
}>({
  caseKey: ['smoke', { option: true }],
  familiarDemo: [false, { option: true }],
  comparisonCaseKey: [undefined, { option: true }],
  ownedCase: [
    async ({ caseKey, comparisonCaseKey, familiarDemo }, use, info) => {
      await useOwnedCase(
        caseKey,
        [caseKey, comparisonCaseKey],
        use,
        info,
        familiarDemo,
      );
    },
    { auto: true },
  ],
  // Automatic fixtures finish setup before any browser context is created.
  comparisonCase: [
    async ({ caseKey, comparisonCaseKey }, use, info) => {
      if (!comparisonCaseKey) return await use(undefined);
      if (caseKey === comparisonCaseKey)
        throw new Error(
          'Comparison campaign must differ from the journey campaign',
        );
      await useOwnedCase(
        comparisonCaseKey,
        [caseKey, comparisonCaseKey],
        use,
        info,
      );
    },
    { auto: true },
  ],
  context: async (
    { browser, ownedCase, viewport, hasTouch, isMobile },
    use,
    info,
  ) => {
    const run = await loadRun();
    const context = await roleContext(
      browser,
      run,
      ownedCase.scope.workerKey,
      'gm',
      { viewport, hasTouch, isMobile },
    );
    if (info.retry === 1) await context.tracing.start(retryTraceOptions);
    try {
      await use(context);
    } finally {
      await closeWithEvidence(context, 'primary-gm', run, ownedCase, info);
    }
  },
  players: async (
    { browser, ownedCase, viewport, hasTouch, isMobile },
    use,
    info,
  ) => {
    const run = await loadRun();
    const contexts: { role: RoleKey; context: BrowserContext }[] = [];
    const pages = {} as Players;
    try {
      for (const role of ['gm', 'player', 'outsider'] as const) {
        const context = await roleContext(
          browser,
          run,
          ownedCase.scope.workerKey,
          role,
          { viewport, hasTouch, isMobile },
        );
        contexts.push({ role, context });
        if (info.retry === 1) await context.tracing.start(retryTraceOptions);
        pages[role] = await context.newPage();
      }
      await use(pages);
    } finally {
      const results = await Promise.allSettled(
        contexts.map(({ role, context }) =>
          closeWithEvidence(context, role, run, ownedCase, info),
        ),
      );
      if (results.some((result) => result.status === 'rejected'))
        throw new Error('Failed to finalize safe browser evidence');
    }
  },
});
export { expect };
