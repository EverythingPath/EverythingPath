import { weeklyDraftDataSchema } from '../src/lib/weekly-draft-contract';
// @vitest-environment edge-runtime
import { beforeAll, expect, test, vi } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import { convexTest } from 'convex-test';
import { build } from 'vite';
import { createContext, runInContext } from 'node:vm';
import { resolve } from 'node:path';
import schema from './schema';
import { api, internal } from './_generated/api';
import {
  deploymentFixture,
  fixtureCredentials,
} from '../e2e/support/test-data';
import { acceptanceViews } from '../tests/rules/acceptance-browser-entry';
import { compoundAcceptanceFixture } from '../tests/rules/compound-acceptance-fixture';
import {
  foundationAcceptanceFixtures,
  foundationCompoundFixtures,
} from '../tests/rules/foundation-acceptance-fixtures';
import { activityAcceptanceFixtures } from '../tests/rules/activity-acceptance-fixtures';
import { eventAcceptanceFixtures } from '../tests/rules/event-acceptance-fixtures';

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
const scope = {
  namespace: deploymentFixture.namespace,
  version: 1,
  workerKey: 'worker-0',
  caseKey: 'canonicalPersistence' as const,
  ...fixtureCredentials,
};

test('[rules.GATE.projection-parity] shared canonical fixtures retain every Phase View and full committed outcome through browser and authenticated Convex boundaries', async () => {
  vi.stubEnv('E2E_ENABLED', 'true');
  vi.stubEnv('E2E_FIXTURE_CONFIG', JSON.stringify(deploymentFixture));
  vi.stubEnv('CONVEX_CLOUD_URL', deploymentFixture.convexUrl);
  vi.useFakeTimers();
  try {
    const bundle = await build({
      configFile: false,
      logLevel: 'silent',
      resolve: { alias: { '~': resolve('src') } },
      build: {
        write: false,
        minify: false,
        lib: {
          entry: resolve('tests/rules/acceptance-browser-entry.ts'),
          name: 'Acceptance',
          formats: ['iife'],
        },
      },
    });
    const output = Array.isArray(bundle) ? bundle[0] : bundle;
    if (!output || !('output' in output)) throw new Error('Missing bundle');
    const script = output.output.find((entry) => entry.type === 'chunk');
    if (script?.type !== 'chunk') throw new Error('Missing JavaScript');
    // Evaluate the bundle once, like one browser session. Re-evaluating it per
    // fixture cost about a quarter of this test's runtime.
    const browserContext = createContext({ structuredClone });
    runInContext(script.code, browserContext);
    const fixtures = [
      { name: 'compound', input: compoundAcceptanceFixture().input },
      ...eventAcceptanceFixtures(),
      ...activityAcceptanceFixtures(),
      ...foundationAcceptanceFixtures(),
      ...foundationCompoundFixtures(),
    ];
    for (const { name, input } of fixtures) {
      const t = convexTest(schema, modules);
      await t.mutation(internal.e2eFixtures.seedIdentityProjection, scope);
      const key = await t.mutation(
        internal.canonicalPersistenceFixtures.resetAndInitialize,
        {
          scope,
          now: 1,
          draftId: input.revision.draftId,
        },
      );
      await t.mutation(
        internal.canonicalPersistenceFixtures.installAcceptanceSource,
        {
          ...key,
          scope,
          draft: weeklyDraftDataSchema.parse(input.revision),
          snapshot: input.militiaSnapshot,
        },
      );
      const user = await t.run((ctx) => ctx.db.query('user').first());
      if (!user) throw new Error('Missing fixture member');
      const member = t.withIdentity({ tokenIdentifier: user.tokenIdentifier });
      const source = await member.query(
        api.canonicalDraftPersistence.workspace,
        { campaignId: key.campaignId },
      );
      if (!source) throw new Error('Missing Workspace source');
      const observed = await member.query(
        api.canonicalDraftPersistence.observe,
        key,
      );
      if (!observed.draft) throw new Error('Missing draft');
      browserContext.draft = structuredClone(observed.draft);
      browserContext.source = structuredClone(source);
      const browser = runInContext(
        'Acceptance.acceptanceViews(draft, source)',
        browserContext,
      ) as ReturnType<typeof acceptanceViews>;
      expect(browser, name).toEqual(acceptanceViews(observed.draft, source));
      const review = await member.query(
        api.canonicalDraftPersistence.preview,
        key,
      );
      expect(review.status, `${name}: ${review.requirements.join(', ')}`).toBe(
        'ready',
      );
      expect(review.outcome, name).toEqual(browser.preview.outcome);
      expect(review.baseline, name).toEqual(browser.preview.baseline);
      if (name === 'compound')
        expect(review.outcome).toEqual(compoundAcceptanceFixture().expected);
      const attempts = await Promise.allSettled(
        ['first', 'second'].map((suffix) =>
          member.mutation(api.canonicalDraftPersistence.confirm, {
            ...key,
            operation: {
              operationId: `matrix-${name}-${suffix}`,
              reviewed: review.reviewed,
            },
          }),
        ),
      );
      expect(
        attempts.filter((result) => result.status === 'fulfilled'),
        name,
      ).toHaveLength(1);
      const winner = attempts.find((result) => result.status === 'fulfilled');
      if (winner?.status !== 'fulfilled')
        throw new Error('Missing committed week');
      const receipt = winner.value;
      const committed = await t.mutation(
        internal.canonicalPersistenceFixtures.inspect,
        { ...key, scope },
      );
      expect(committed.snapshot, name).toEqual(
        browser.preview.outcome?.militiaSnapshot,
      );
      expect(receipt.record.source, name).toEqual(observed.draft);
      expect(receipt.record.sourceMilitiaSnapshot, name).toEqual(
        source.snapshot,
      );
      expect(receipt.record.finalPlan.data.after, name).toEqual(
        browser.preview.outcome,
      );
      expect(receipt.record.finalOutcome.data, name).toEqual(
        browser.preview.outcome,
      );
      expect(receipt.record.baselinePlan.data.after, name).toEqual(
        browser.preview.baseline,
      );
      expect(committed.records, name).toEqual([receipt.record]);
      expect(committed.openDrafts, name).toEqual([receipt.successor]);
      expect(receipt.successor.context, name).toEqual({
        ...browser.preview.outcome?.context,
        persistentPhaseEligible:
          (browser.preview.outcome?.context.carriedEvents.length ?? 0) > 0,
      });
      expect(receipt.record.adjudication.tableAdjustments, name).toEqual(
        input.revision.tableAdjustments,
      );
      expect(receipt.record.adjudication.rulesExceptions, name).toEqual(
        input.revision.rulesExceptions,
      );
      await t.finishAllScheduledFunctions(vi.runAllTimers);
    }
  } finally {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  }
  // Each of the ~130 fixtures seeds its own Convex database and races two
  // authenticated confirmations. On GitHub's 2-vCPU runner this took 26.5s on
  // main and timed out at 30s on #198, while the other test files competed for
  // the same CPUs. Reusing one browser context cut local time from 10s to 7.3s.
  // 60s leaves headroom for CI contention.
}, 60_000);
