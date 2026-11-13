// @vitest-environment edge-runtime
import { afterEach, expect, test, vi } from 'vitest';
import type { FunctionReturnType, WithoutSystemFields } from 'convex/server';
import { TransactionMetricsTracker } from 'convex-test/dist/transactionMetrics.js';
import { api, internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import {
  scopeSummary,
  type ReleaseTest,
} from '../tests/catalog-release-fixture';
import {
  closedAndBackfilled as closedAndBackfilledIn,
  frontendBuild,
} from '../tests/initial-migration-fixture';
import type { ReleaseRow } from '../src/lib/catalog/release-schema';
import { catalogRuntimeCompatibility } from '../src/lib/catalog/runtime-compatibility';

afterEach(() => vi.useRealTimers());

const modules = import.meta.glob('./**/*.ts');
const closedAndBackfilled = (
  options?: Parameters<typeof closedAndBackfilledIn>[1],
) => closedAndBackfilledIn(modules, options);

test('activate switches a closed, backfilled legacy deployment to sheet authority and selects the release together, staying closed', async () => {
  const { t, member, seeded, artifact, receipt, args } =
    await closedAndBackfilled();
  expect(
    await t.query(internal.initialCharacterBackfill.status, {
      ...receipt,
      now: Date.now(),
    }),
  ).toMatchObject({ isActivationReady: true });
  const result = await t.mutation(internal.initialMigration.activate, args);
  expect(result).toEqual({
    runId: receipt.runId,
    epoch: receipt.epoch,
    authority: 'sheet',
    closed: true,
    pendingPublication: true,
    activation: {
      activationId: 'activate-initial',
      captureId: 'capture',
      releaseNumber: 1,
      impactRunId: args.impactRunId,
      artifactFingerprint: artifact.manifest.artifactFingerprint,
      schemaIdentity: catalogRuntimeCompatibility.schema,
      calculationIdentity: catalogRuntimeCompatibility.calculation,
      observedFrontendBuild: frontendBuild,
      isFixtureOnly: false,
      activatedAt: expect.any(Number),
      // Weekly Resolution switches to version 10 with authority (#413 f6b2).
      rulesetVersion: 10,
    },
  });
  expect(
    await t.query(internal.initialMigration.status, { now: Date.now() }),
  ).toMatchObject({
    epoch: receipt.epoch,
    closed: true,
    authority: 'sheet',
    run: {
      runId: receipt.runId,
      state: 'activated',
      activation: result.activation,
      publication: { cursor: null, nextPage: 0, published: 0, isDone: false },
      smoke: null,
    },
  });
  expect(
    await t.query(internal.catalogReleaseActivation.status, {}),
  ).toMatchObject({
    releaseNumber: 1,
    impactRunId: args.impactRunId,
    activationId: 'activate-initial',
    artifactFingerprint: artifact.manifest.artifactFingerprint,
    isFixtureOnly: false,
  });
  // Nothing reopens or publishes here (F6b), and browsers reload (F6c).
  expect(await t.query(api.initialMigration.clientStatus, {})).toEqual({
    status: 'maintenance',
    epoch: receipt.epoch,
  });
  await expect(
    member.mutation(api.character.updateCharacter, {
      organizationId: 'org',
      characterId: seeded.characterId,
      patch: { name: 'Edited while closed' },
      writeEpoch: receipt.epoch,
    }),
  ).rejects.toThrow('MAINTENANCE');
  expect(
    await t.run((ctx) =>
      ctx.db
        .query('characterSheetEntry')
        .withIndex('by_characterId', (q) =>
          q.eq('characterId', seeded.characterId),
        )
        .first(),
    ),
  ).toBeNull();
});

/** The rows an activation switches, to show a refusal changed none of them. */
function switchedState(t: ReleaseTest) {
  return t.run(async (ctx) => ({
    control: await ctx.db.query('initialMigrationControl').collect(),
    runs: await ctx.db.query('initialMigrationRun').collect(),
    selection: await ctx.db.query('catalogReleaseControl').collect(),
    registration: await ctx.db.query('catalogImpactControl').collect(),
  }));
}

test('a repeated activate after a lost response returns the recorded activation and switches nothing twice; other arguments refuse', async () => {
  const { t, receipt, args } = await closedAndBackfilled();
  const first = await t.mutation(internal.initialMigration.activate, args);
  const after = await switchedState(t);
  vi.setSystemTime(Date.now() + 1000);
  expect(await t.mutation(internal.initialMigration.activate, args)).toEqual(
    first,
  );
  expect(await switchedState(t)).toEqual(after);
  for (const changed of [
    { activationId: 'activate-other' },
    { observedFrontendBuild: 'build-other' },
    { captureId: 'capture-other' },
    { isFixtureOnly: true },
  ])
    await expect(
      t.mutation(internal.initialMigration.activate, { ...args, ...changed }),
    ).rejects.toThrow(
      'Migration run already activated with other arguments; inspect initialMigration:status.',
    );
  expect(await switchedState(t)).toEqual(after);
  expect(
    await t.query(internal.initialMigration.status, { now: Date.now() }),
  ).toMatchObject({
    authority: 'sheet',
    closed: true,
    epoch: receipt.epoch,
    run: { state: 'activated', activation: first.activation },
  });
});

const definitionWithoutIdentity: ReleaseRow = {
  kind: 'definition',
  key: 'pf1/Unallocated',
  payload: {
    externalKey: 'pf1/Unallocated',
    upstreamKey: 'pf1/Unallocated',
    pack: 'feats',
    name: 'Unallocated feat',
    detail: { kind: 'feat', featTypes: [], repeatable: 'unreviewed' },
    description: '',
    sources: [],
    modifiers: [],
    unsupported: [],
  },
};

test.each([
  {
    name: 'no completed backfill receipt',
    setup: { drive: false },
    change: {},
    reason: 'the candidate backfill has not certified this capture',
  },
  {
    name: 'an old capture',
    setup: {},
    change: { captureId: 'capture-old' },
    reason: 'Backfill input capture is no longer current',
  },
  {
    name: 'a stale epoch',
    setup: {},
    change: { epoch: 0 },
    reason: 'Backfill requires the current closed legacy Write Gate and epoch',
  },
  {
    name: 'missing identities',
    setup: { rows: [scopeSummary('QUALIFIED'), definitionWithoutIdentity] },
    change: {},
    reason: 'gates-incomplete',
  },
  {
    name: 'a FAILED scope',
    setup: { rows: [scopeSummary('FAILED')] },
    change: {},
    reason: 'scope-unqualified: campaign-mvp-v1 FAILED',
  },
  {
    name: 'an unreported scope',
    setup: { rows: [] },
    change: {},
    reason: 'scope-unqualified: no scope report',
  },
  {
    name: 'a fixture-only activation beside ordinary campaigns',
    setup: {},
    change: { isFixtureOnly: true },
    reason: 'isolated fixture deployment',
  },
  {
    name: 'a different artifact',
    setup: { catalogManifest: 'another-artifact' },
    change: {},
    reason: 'Catalog Release 1 is not the catalog manifest this run recorded',
  },
  {
    name: 'a different frontend build',
    setup: {},
    change: { observedFrontendBuild: 'build-other' },
    reason: 'the observed frontend build is not the one this run recorded',
  },
  {
    name: 'an unbounded activation identity',
    setup: {},
    change: { activationId: 'a'.repeat(65) },
    reason: 'supply a bounded activation identity',
  },
])(
  'activate refuses $name with its reason and changes nothing',
  async ({ setup, change, reason }) => {
    const { t, args } = await closedAndBackfilled(setup);
    const before = await switchedState(t);
    await expect(
      t.mutation(internal.initialMigration.activate, { ...args, ...change }),
    ).rejects.toThrow(reason);
    expect(await switchedState(t)).toEqual(before);
  },
);

test('activate refuses an open gate when every other fence holds, and changes nothing', async () => {
  const { t, args } = await closedAndBackfilled();
  // Only the gate opens: legacy authority, the current run and epoch, the
  // certified capture, the deadline and the release all still hold.
  await t.run(async (ctx) => {
    const control = await ctx.db.query('initialMigrationControl').unique();
    await ctx.db.patch('initialMigrationControl', control!._id, {
      closed: false,
    });
  });
  const before = await switchedState(t);
  await expect(
    t.mutation(internal.initialMigration.activate, args),
  ).rejects.toThrow(
    'Activation refused: Backfill requires the current closed legacy Write Gate and epoch.',
  );
  expect(await switchedState(t)).toEqual(before);
});

type StoredRun = WithoutSystemFields<Doc<'initialMigrationRun'>>;
type RunStatus = NonNullable<
  FunctionReturnType<typeof internal.initialMigration.status>['run']
>;

test('a stored or reported run carries only its stage records: an activated run both, earlier stages neither', async () => {
  const { t, args } = await closedAndBackfilled();
  await t.mutation(internal.initialMigration.activate, args);
  const stored = await t.run(async (ctx) =>
    ctx.db.get('initialMigrationRun', args.runId),
  );
  if (stored?.state !== 'activated') throw new Error('Missing activation');
  const { _id, _creationTime, activation, publication, smoke, ...fields } =
    stored;
  const insert = (run: unknown) =>
    t.run((ctx) => ctx.db.insert('initialMigrationRun', run as StoredRun));
  // The stages every earlier writer stored still validate.
  await insert({ ...fields, state: 'maintenance' });
  await insert({ ...fields, state: 'aborted', abortedAt: 1 });
  for (const illegal of [
    { ...fields, state: 'activated' },
    { ...fields, state: 'activated', activation, smoke },
    { ...fields, state: 'activated', publication, smoke },
    { ...fields, state: 'maintenance', activation, publication },
    { ...fields, state: 'aborted', abortedAt: 1, activation, publication },
    { ...fields, state: 'aborted' },
  ])
    await expect(insert(illegal)).rejects.toThrow('Validator error');

  // @ts-expect-error an activated run records what it switched
  const missing: StoredRun = { ...fields, state: 'activated', publication };
  // @ts-expect-error a run before activation carries no activation
  const early: StoredRun = { ...fields, state: 'maintenance', activation };
  const reported = { ...fields, runId: _id, state: 'activated' } as const;
  // @ts-expect-error status reports an activated run with both records
  const bare: RunStatus = reported;
  const aborted: RunStatus = {
    ...reported,
    state: 'aborted',
    abortedAt: 1,
    // @ts-expect-error status reports no records for an aborted run
    activation,
  };
  expect([missing, early, bare, aborted]).toHaveLength(4);
});

test('after the deadline activate refuses and abort still reopens legacy authority', async () => {
  const { t, receipt, args } = await closedAndBackfilled();
  const before = await switchedState(t);
  const run = before.runs[0];
  if (!run) throw new Error('Missing run');
  vi.setSystemTime(run.deadline);
  await expect(
    t.mutation(internal.initialMigration.activate, args),
  ).rejects.toThrow(
    'Activation refused: the maintenance deadline has passed; abort and start a new run.',
  );
  expect(await switchedState(t)).toEqual(before);
  expect(
    await t.mutation(internal.initialMigration.abortBeforeActivation, {
      runId: receipt.runId,
      epoch: receipt.epoch,
    }),
  ).toEqual({ epoch: receipt.epoch + 1 });
  expect(
    await t.query(internal.initialMigration.status, { now: Date.now() }),
  ).toMatchObject({
    closed: false,
    authority: 'legacy',
    run: { state: 'aborted', abortedAt: expect.any(Number) },
  });
  expect(
    (await t.query(internal.initialMigration.status, { now: Date.now() })).run,
  ).not.toHaveProperty('activation');
  await expect(
    t.mutation(internal.initialMigration.activate, args),
  ).rejects.toThrow('current closed legacy Write Gate');
});

test('after a real activate both aborts, the backfill workers and a new start refuse, leaving it closed under sheet authority', async () => {
  const { t, receipt, args } = await closedAndBackfilled();
  await t.mutation(internal.initialMigration.activate, args);
  const after = await switchedState(t);
  await expect(
    t.mutation(internal.initialMigration.abortBeforeActivation, {
      runId: receipt.runId,
      epoch: receipt.epoch,
    }),
  ).rejects.toThrow('has activated');
  await expect(
    t.mutation(
      internal.initialCharacterBackfill.abortBeforeActivation,
      receipt,
    ),
  ).rejects.toThrow('has activated');
  await expect(
    t.mutation(internal.initialCharacterBackfill.startValidation, {
      ...receipt,
      validationId: 'late',
      expectedValidationId: 'validation',
    }),
  ).rejects.toThrow('current closed legacy Write Gate');
  await expect(
    t.mutation(internal.initialMigration.start, {
      operationId: 'after-activation',
      expectedEpoch: receipt.epoch,
      frontendBuild,
      catalogManifest: 'any',
      maintenanceBudgetMs: 60000,
    }),
  ).rejects.toThrow('state changed');
  expect(await switchedState(t)).toEqual(after);
  expect(after.control).toEqual([
    expect.objectContaining({
      closed: true,
      authority: 'sheet',
      epoch: receipt.epoch,
    }),
  ]);
});

test('activate reads and writes a fixed set of rows whatever the number of Characters', async () => {
  const measure = async (extraCharacters: number) => {
    const { t, args } = await closedAndBackfilled({
      beforeStart: (ctx, campaignId) =>
        Promise.all(
          Array.from({ length: extraCharacters }, (_, index) =>
            ctx.db.insert('character', {
              campaignId,
              name: `Extra ${index}`,
              description: '',
              kind: 'npc',
              isActive: true,
              level: 3,
              strength: 10,
              dexterity: 10,
              constitution: 10,
              intelligence: 10,
              wisdom: 10,
              charisma: 10,
            }),
          ),
        ),
    });
    const reads = vi.spyOn(TransactionMetricsTracker.prototype, 'trackRead');
    const writes = vi.spyOn(TransactionMetricsTracker.prototype, 'trackWrite');
    try {
      await t.mutation(internal.initialMigration.activate, args);
      const bytesRead = reads.mock.calls.reduce(
        (total, [bytes]) => total + bytes,
        0,
      );
      return {
        transactions: new Set(reads.mock.contexts).size,
        documentsRead: reads.mock.calls.length,
        documentsWritten: writes.mock.calls.length,
        bytesRead,
      };
    } finally {
      reads.mockRestore();
      writes.mockRestore();
    }
  };
  const one = await measure(0);
  const many = await measure(40);
  expect(one.transactions).toBe(1);
  expect(many).toEqual(one);
  expect(one.documentsRead).toBeLessThanOrEqual(24);
  expect(one.documentsWritten).toBeLessThanOrEqual(4);
});
