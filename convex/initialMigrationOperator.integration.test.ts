// @vitest-environment edge-runtime
import { afterEach, expect, test, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { ConvexError } from 'convex/values';
import { api, internal } from './_generated/api';
import schema from './schema';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import {
  discover,
  prepare,
  scopeSummary,
  type ReleaseTest,
} from '../tests/catalog-release-fixture';
import {
  runInitialMigrationOperator,
  type InitialMigrationAdapter,
} from '../scripts/initial-migration/operator';
import { catalogRuntimeCompatibility } from '../src/lib/catalog/runtime-compatibility';
import { SHEET_CLIENT_CONTRACT } from '../src/lib/client-compatibility';

// #413 F6c: `pnpm initial-migration` against convex-test's deployment, so
// every refusal and every repeat is the server's own.

afterEach(() => vi.useRealTimers());

const modules = import.meta.glob('./**/*.ts');
const build = 'a'.repeat(40);
const oldBuild = 'b'.repeat(40);

/** An open legacy deployment with a reconciled, QUALIFIED release 1. */
async function openDeployment() {
  vi.useFakeTimers();
  const t = convexTest({ schema, modules });
  const member = t.withIdentity({ tokenIdentifier: 'test|player' });
  const seeded = await member.run((ctx) => seedAcceptedCampaign(ctx));
  await prepare(t, [scopeSummary('QUALIFIED')]);
  const impactRunId = await discover(t);
  await t.mutation(internal.catalogReleaseImpact.finish, {
    runId: impactRunId,
  });
  return { t, seeded, impactRunId };
}

/** The deployment as the operator's adapter; `lose` drops one answer. */
function adapterFor(
  t: ReleaseTest,
  lose: Set<string>,
): InitialMigrationAdapter {
  return {
    query: (name, args) => t.query(makeFunctionReference<'query'>(name), args),
    async mutation(name, args) {
      const result = await t.mutation(
        makeFunctionReference<'mutation'>(name),
        args,
      );
      if (lose.delete(name)) throw new Error('socket closed');
      return result;
    },
  };
}

function operatorFor(t: ReleaseTest, impactRunId: string) {
  const lose = new Set<string>();
  let site = build;
  const flags: Record<string, string[]> = {
    start: [
      '--operation-id',
      'switch-1',
      '--number',
      '1',
      '--budget-minutes',
      '60',
    ],
    backfill: [
      '--capture-id',
      'capture-1',
      '--driver-id',
      'driver-1',
      '--validation-id',
      'validation-1',
      '--wait-seconds',
      '60',
    ],
    activate: [
      '--capture-id',
      'capture-1',
      '--activation-id',
      'activation-1',
      '--number',
      '1',
      '--impact-run-id',
      impactRunId,
      '--schema',
      catalogRuntimeCompatibility.schema,
      '--calculation',
      catalogRuntimeCompatibility.calculation,
    ],
    publish: ['--wait-seconds', '60'],
    smoke: ['--smoke-id', 'smoke-1'],
  };
  const run = (step: string, extra: string[] = []) =>
    runInitialMigrationOperator({
      args: [
        step,
        '--target-kind',
        'production',
        '--production',
        '--build-identity',
        'https://site.example/build-identity.json',
        ...(flags[step] ?? []),
        ...extra,
      ],
      adapter: adapterFor(t, lose),
      readBuildIdentity: async () => ({ frontendBuild: site }),
      pause: () => t.finishAllScheduledFunctions(() => vi.runAllTimers()),
    });
  return {
    run,
    lose: (name: string) => lose.add(name),
    serve: (next: string) => {
      site = next;
    },
  };
}

const status = (t: ReleaseTest) =>
  t.query(internal.initialMigration.status, { now: Date.now() });

test('every step runs in order through the operator, resumes after a lost response, and reopens for a compatible tab', async () => {
  const { t, impactRunId } = await openDeployment();
  const operator = operatorFor(t, impactRunId);
  const order = [
    [
      'start',
      'initialMigration:start',
      'backfill, then activate once it reports ready',
    ],
    ['backfill', 'initialCharacterBackfill:startDriver', 'activate'],
    ['activate', 'initialMigration:activate', 'publish'],
    ['publish', 'initialMigration:publish', 'smoke'],
    ['smoke', 'initialMigration:smoke', 'reopen'],
    [
      'reopen',
      'initialMigration:reopen',
      'none: open under sheet authority; close-for-repair to repair',
    ],
  ] as const;
  for (const [step, mutation, next] of order) {
    operator.lose(mutation);
    await expect(operator.run(step)).rejects.toThrow(
      `${step}: no answer from the deployment (socket closed). The step may have committed; rerun the same command to resume.`,
    );
    await expect(operator.run(step)).resolves.toMatchObject({
      step,
      target: 'the injected adapter',
      next,
    });
  }
  const reopened = await status(t);
  expect(reopened).toMatchObject({
    closed: false,
    authority: 'sheet',
    epoch: 2,
    run: { state: 'reopened', publication: { isDone: true, published: 1 } },
  });
  // Exactly one activation, one publication of each Character, one reopening.
  const characters = await t.run((ctx) => ctx.db.query('character').collect());
  expect(characters.map(({ sheetRevision }) => sheetRevision)).toEqual([1]);
  expect(
    await t.query(api.initialMigration.clientStatus, {
      clientContract: SHEET_CLIENT_CONTRACT,
    }),
  ).toMatchObject({ status: 'ready', authority: 'sheet', epoch: 2 });

  // A forward repair, also resumable.
  operator.lose('initialMigration:closeForRepair');
  await expect(operator.run('close-for-repair')).rejects.toThrow('no answer');
  await expect(operator.run('close-for-repair')).resolves.toMatchObject({
    next: 'smoke',
  });
  await operator.run('smoke', ['--smoke-id', 'smoke-2']);
  await expect(operator.run('reopen')).resolves.toMatchObject({
    details: { epoch: 4 },
  });
});

test('each step out of order is sent and refused with the deployment reason, changing nothing', async () => {
  const { t, impactRunId } = await openDeployment();
  const operator = operatorFor(t, impactRunId);
  await expect(operator.run('backfill')).rejects.toThrow(
    'backfill refused: no Migration Run has started; run `pnpm initial-migration start` first.',
  );
  await operator.run('start');
  const refusals: [string, string][] = [
    [
      'start',
      'start refused by the deployment: Migration operation already used',
    ],
    [
      'activate',
      'activate refused by the deployment: Activation refused: Backfill input capture is no longer current.',
    ],
    [
      'publish',
      'publish refused by the deployment: Publication refused: the deployment is not under sheet authority.',
    ],
    ['reopen', 'Reopen refused: the deployment is not under sheet authority.'],
    [
      'close-for-repair',
      'Repair closure refused: the deployment is not under sheet authority.',
    ],
  ];
  const before = await status(t);
  for (const [step, reason] of refusals)
    await expect(
      operator.run(
        step,
        step === 'start'
          ? ['--operation-id', 'switch-1', '--budget-minutes', '30']
          : [],
      ),
    ).rejects.toThrow(reason);
  expect(await status(t)).toEqual(before);
  await operator.run('backfill');
  await operator.run('activate');
  for (const [step, reason] of [
    [
      'smoke',
      'Smoke check refused: publish every candidate before the smoke check.',
    ],
    ['reopen', 'Reopen refused: publish every candidate before reopening.'],
    ['abort', 'Migration run is no longer current or has activated.'],
    [
      'backfill',
      'Backfill requires the current closed legacy Write Gate and epoch',
    ],
    ['close-for-repair', 'Repair closure refused: the gate is closed.'],
  ] as const)
    await expect(operator.run(step)).rejects.toThrow(reason);
  await operator.run('publish');
  await expect(operator.run('reopen')).rejects.toThrow(
    'Reopen refused: run a passing smoke check at this Write Epoch first.',
  );
});

test('D11: a frontend that failed to publish after activation keeps the gate closed, and reopening rechecks the build', async () => {
  const { t, impactRunId } = await openDeployment();
  const operator = operatorFor(t, impactRunId);
  for (const step of ['start', 'backfill', 'activate', 'publish', 'smoke'])
    await operator.run(step);
  // The new site did not publish: the old build is still served.
  operator.serve(oldBuild);
  await expect(operator.run('reopen')).rejects.toThrow(
    'Reopen refused: the observed frontend build is not the one this run recorded.',
  );
  expect(await status(t)).toMatchObject({ closed: true, authority: 'sheet' });
  expect(await t.query(api.initialMigration.clientStatus, {})).toMatchObject({
    status: 'maintenance',
  });
  operator.serve(build);
  await expect(operator.run('reopen')).resolves.toMatchObject({
    details: { epoch: 2 },
  });
});

test('abort before activation resumes after a lost response and reopens legacy authority', async () => {
  const { t, impactRunId } = await openDeployment();
  const operator = operatorFor(t, impactRunId);
  await operator.run('start');
  operator.lose('initialMigration:abortBeforeActivation');
  await expect(operator.run('abort')).rejects.toThrow('no answer');
  await expect(operator.run('abort')).resolves.toMatchObject({
    details: { epoch: 2 },
    next: 'start',
  });
  expect(await status(t)).toMatchObject({
    closed: false,
    authority: 'legacy',
    run: { state: 'aborted' },
  });
});

test('production needs --production, the flag needs production, and a development build never switches it; none of them reach the deployment', async () => {
  const query = vi.fn();
  const adapter = { query, mutation: query };
  const site = (frontendBuild: string) => async () => ({ frontendBuild });
  const base = [
    '--build-identity',
    'site',
    '--operation-id',
    'x',
    '--number',
    '1',
    '--budget-minutes',
    '1',
  ];
  await expect(
    runInitialMigrationOperator({
      args: ['start', '--target-kind', 'production', ...base],
      adapter,
    }),
  ).rejects.toThrow('A production deployment needs --production.');
  await expect(
    runInitialMigrationOperator({
      args: ['start', '--target-kind', 'preview', '--production', ...base],
      adapter,
    }),
  ).rejects.toThrow('--production applies only to --target-kind production.');
  await expect(
    runInitialMigrationOperator({
      args: [
        'activate',
        '--target-kind',
        'production',
        '--production',
        '--fixture-only',
      ],
      adapter,
    }),
  ).rejects.toThrow('Production cannot be switched fixture-only.');
  expect(query).not.toHaveBeenCalled();
  query.mockResolvedValue({
    epoch: 0,
    closed: false,
    authority: 'legacy',
    budgetExceeded: false,
    run: null,
  });
  await expect(
    runInitialMigrationOperator({
      args: ['start', '--target-kind', 'production', '--production', ...base],
      adapter,
      readBuildIdentity: site('dev'),
    }),
  ).rejects.toThrow(
    'start refused: a development frontend build cannot switch production',
  );
  expect(query.mock.calls.map(([name]) => name)).toEqual([
    'initialMigration:status',
  ]);
});

test('a refusal carrying a code and message prints both', async () => {
  const adapter = {
    query: vi.fn().mockResolvedValue({
      epoch: 1,
      closed: true,
      authority: 'legacy',
      budgetExceeded: false,
      run: { runId: 'r', epoch: 1, operationId: 'o', state: 'maintenance' },
    }),
    mutation: vi
      .fn()
      .mockRejectedValue(
        new ConvexError({ code: 'MAINTENANCE', message: 'Closed.' }),
      ),
  };
  await expect(
    runInitialMigrationOperator({
      args: ['abort', '--target-kind', 'preview'],
      adapter,
    }),
  ).rejects.toThrow(
    'abort refused by the deployment: MAINTENANCE: Closed. Inspect with `pnpm initial-migration status`.',
  );
});
