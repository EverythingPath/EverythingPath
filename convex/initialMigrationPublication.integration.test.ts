// @vitest-environment edge-runtime
import { afterEach, expect, test, vi } from 'vitest';
import type { FunctionReturnType, WithoutSystemFields } from 'convex/server';
import { convexTest } from 'convex-test';
import { TransactionMetricsTracker } from 'convex-test/dist/transactionMetrics.js';
import { api, internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import schema from './schema';
import {
  activationArgs,
  impactAdapter,
  prepare,
  scopeSummary,
  type ReleaseTest,
} from '../tests/catalog-release-fixture';
import { runCatalogReleaseImpactCommand } from '../scripts/catalog/release-impact-command';
import {
  closedAndBackfilled,
  frontendBuild,
} from '../tests/initial-migration-fixture';

afterEach(() => vi.useRealTimers());

const modules = import.meta.glob('./**/*.ts');

/** Legacy Characters beside the seeded Officer, so publication spans pages. */
function extraCharacters(levels: readonly number[]) {
  return (ctx: MutationCtx, campaignId: Id<'campaign'>) =>
    Promise.all(
      levels.map((level, index) =>
        ctx.db.insert('character', {
          campaignId,
          name: `Extra ${index}`,
          description: '',
          ownerId: 'gm',
          kind: 'npc',
          isActive: true,
          level,
          strength: 8 + index,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
        }),
      ),
    );
}

/** A deployment activated by `initialMigration:activate`, still closed. */
async function activated(
  options: Parameters<typeof closedAndBackfilled>[1] = {},
) {
  const fixture = await closedAndBackfilled(modules, options);
  await fixture.t.mutation(internal.initialMigration.activate, fixture.args);
  const { runId, epoch } = fixture.receipt;
  const run = { runId, epoch };
  return {
    ...fixture,
    run,
    gm: fixture.t.withIdentity({ tokenIdentifier: 'test|gm' }),
    publishArgs: { ...run, activationId: fixture.args.activationId },
  };
}

/** Cancels every pending scheduled function: an interrupted publish chain. */
function interrupt(t: ReleaseTest) {
  return t.run(async (ctx) => {
    const jobs = await ctx.db.system.query('_scheduled_functions').collect();
    for (const job of jobs)
      if (job.state.kind === 'pending') await ctx.scheduler.cancel(job._id);
  });
}

function pendingJobs(t: ReleaseTest) {
  return t.run(async (ctx) =>
    (await ctx.db.system.query('_scheduled_functions').collect()).filter(
      (job) => job.state.kind === 'pending',
    ),
  );
}

async function publishAll(
  t: ReleaseTest,
  publishArgs: Awaited<ReturnType<typeof activated>>['publishArgs'],
) {
  await t.mutation(internal.initialMigration.publish, {
    ...publishArgs,
    page: 0,
  });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
}

/** Every Character's sheet rows and sheet fields, to compare whole states. */
function sheets(t: ReleaseTest) {
  return t.run(async (ctx) => {
    const characters = await ctx.db.query('character').collect();
    return await Promise.all(
      characters.map(async (character) => ({
        characterId: character._id,
        level: character.level,
        strength: character.strength,
        sheetMode: character.sheetMode,
        sheetRevision: character.sheetRevision,
        sheetLastOperationId: character.sheetLastOperationId,
        entries: (
          await ctx.db
            .query('characterSheetEntry')
            .withIndex('by_characterId', (q) =>
              q.eq('characterId', character._id),
            )
            .collect()
        ).map(({ kind, state }) => ({ kind, state })),
        definitions: (
          await ctx.db
            .query('catalogEntry')
            .withIndex('by_characterId_and_browseOnly', (q) =>
              q.eq('characterId', character._id).eq('browseOnly', undefined),
            )
            .collect()
        ).map(({ ruleIdentity, modifiers }) => ({ ruleIdentity, modifiers })),
      })),
    );
  });
}

function migrationState(t: ReleaseTest) {
  return t.run(async (ctx) => ({
    control: await ctx.db.query('initialMigrationControl').collect(),
    runs: await ctx.db.query('initialMigrationRun').collect(),
  }));
}

/** The deployment as a client at `writeEpoch` calls its gated writers. */
function atEpoch(t: ReleaseTest, writeEpoch: number): ReleaseTest {
  const mutation = t.mutation as (
    reference: unknown,
    args: object,
  ) => Promise<unknown>;
  return new Proxy(t, {
    get: (target, key, receiver) =>
      key === 'mutation'
        ? (reference: unknown, args: object) =>
            mutation.call(target, reference, { ...args, writeEpoch })
        : Reflect.get(target, key, receiver),
  });
}

async function strengthOf(
  member: ReturnType<ReleaseTest['withIdentity']>,
  characterId: Id<'character'>,
) {
  const sheet = await member.query(api.characterSheet.read, { characterId });
  return sheet?.calculated.abilities.strength.score;
}

test('publish, smoke, reopen, edit, close for repair and reopen again keep sheet authority and the edit (D7, D9, D10)', async () => {
  const { t, gm, seeded, receipt, run, publishArgs } = await activated({
    beforeStart: extraCharacters([0, 1, 3, 5, 2]),
  });
  // Page 0 publishes two of the six candidates, then the chain is lost.
  expect(
    await t.mutation(internal.initialMigration.publish, {
      ...publishArgs,
      page: 0,
    }),
  ).toEqual({
    cursor: expect.any(String),
    nextPage: 1,
    published: 2,
    isDone: false,
  });
  await interrupt(t);
  await expect(
    t.mutation(internal.initialMigration.reopen, {
      ...run,
      observedFrontendBuild: frontendBuild,
    }),
  ).rejects.toThrow(
    'Reopen refused: publish every candidate before reopening.',
  );
  // A repeat after a lost response writes and schedules nothing.
  const partial = await sheets(t);
  expect(
    await t.mutation(internal.initialMigration.publish, {
      ...publishArgs,
      page: 0,
    }),
  ).toMatchObject({ nextPage: 1, published: 2 });
  expect(await sheets(t)).toEqual(partial);
  expect(await pendingJobs(t)).toEqual([]);
  await expect(
    t.mutation(internal.initialMigration.publish, { ...publishArgs, page: 2 }),
  ).rejects.toThrow('Publication refused: the page sequence changed');
  // The operator resumes from the page status names.
  const { run: stored } = await t.query(internal.initialMigration.status, {
    now: Date.now(),
  });
  if (stored?.state !== 'activated') throw new Error('Missing activation');
  await t.mutation(internal.initialMigration.publish, {
    ...publishArgs,
    page: stored.publication.nextPage,
  });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(
    await t.query(internal.initialMigration.status, { now: Date.now() }),
  ).toMatchObject({
    closed: true,
    authority: 'sheet',
    run: {
      state: 'activated',
      // A full last page needs one more, empty page to finish.
      publication: { nextPage: 4, published: 6, isDone: true },
    },
  });
  // Each Character got exactly its legacy mapping, once.
  for (const sheet of await sheets(t)) {
    expect(sheet).toMatchObject({
      sheetMode: 'militiaOnly',
      sheetRevision: 1,
      sheetLastOperationId: 'initial-migration:activation-test',
      definitions: [
        {
          ruleIdentity: `base:${sheet.characterId}`,
          modifiers: expect.arrayContaining([
            {
              target: 'ability.str',
              bonusType: 'base',
              value: sheet.strength,
            },
          ]),
        },
      ],
    });
    expect(sheet.entries.map(({ kind }) => kind)).toEqual([
      'base',
      ...Array.from({ length: sheet.level }, () => 'classLevel'),
    ]);
  }
  // The rows are the validated candidate input, with database identities.
  const candidates = await t.run((ctx) =>
    ctx.db.query('initialMigrationCandidate').collect(),
  );
  const published = await sheets(t);
  for (const candidate of candidates) {
    const input = JSON.parse(candidate.input ?? 'null') as {
      entries: { kind: string; state: unknown }[];
      catalogEntries: { ruleIdentity: string; modifiers: unknown }[];
    };
    expect(
      published.find(
        ({ characterId }) => characterId === candidate.characterId,
      ),
    ).toMatchObject({
      entries: input.entries.map(({ kind, state }) => ({ kind, state })),
      definitions: input.catalogEntries.map(({ ruleIdentity, modifiers }) => ({
        ruleIdentity,
        modifiers,
      })),
    });
  }
  await t.mutation(internal.initialMigration.publish, {
    ...publishArgs,
    page: 1,
  });
  expect(await sheets(t)).toEqual(published);

  // Smoke while closed, then reopen at the next epoch.
  expect(
    await t.mutation(internal.initialMigration.smoke, {
      ...run,
      smokeId: 'smoke-1',
    }),
  ).toMatchObject({ outcome: 'passed', epoch: receipt.epoch });
  const reopened = await t.mutation(internal.initialMigration.reopen, {
    ...run,
    observedFrontendBuild: frontendBuild,
  });
  expect(reopened).toEqual({ epoch: receipt.epoch + 1 });
  expect(
    await t.mutation(internal.initialMigration.reopen, {
      ...run,
      observedFrontendBuild: frontendBuild,
    }),
  ).toEqual(reopened);
  // F6c owns client status: every browser still reloads.
  expect(await t.query(api.initialMigration.clientStatus, {})).toEqual({
    status: 'reload_required',
    epoch: reopened.epoch,
  });
  expect(
    await t.query(internal.initialMigration.status, { now: Date.now() }),
  ).toMatchObject({
    closed: false,
    authority: 'sheet',
    epoch: reopened.epoch,
    run: { state: 'reopened', reopenedAt: expect.any(Number) },
  });

  // The first edit after reopening goes through a public sheet writer.
  const edit = {
    characterId: seeded.characterId,
    operationId: 'edit-after-reopen',
    scores: { strength: 18 },
  };
  await expect(
    gm.mutation(api.characterSheet.editBaseScores, {
      ...edit,
      writeEpoch: receipt.epoch,
    }),
  ).rejects.toThrow('RELOAD_REQUIRED');
  await gm.mutation(api.characterSheet.editBaseScores, {
    ...edit,
    writeEpoch: reopened.epoch,
  });
  expect(await strengthOf(gm, seeded.characterId)).toBe(18);
  await expect(
    t.mutation(internal.initialMigration.abortBeforeActivation, run),
  ).rejects.toThrow('has activated');
  await expect(
    t.mutation(
      internal.initialCharacterBackfill.abortBeforeActivation,
      receipt,
    ),
  ).rejects.toThrow('has activated');

  // Close for a forward repair: authority stays, the edit stays.
  const repair = { runId: run.runId, epoch: reopened.epoch };
  const closed = await t.mutation(
    internal.initialMigration.closeForRepair,
    repair,
  );
  expect(closed).toEqual({ epoch: reopened.epoch + 1 });
  expect(
    await t.mutation(internal.initialMigration.closeForRepair, repair),
  ).toEqual(closed);
  await expect(
    gm.mutation(api.characterSheet.editBaseScores, {
      ...edit,
      operationId: 'edit-while-repairing',
      scores: { strength: 19 },
      writeEpoch: closed.epoch,
    }),
  ).rejects.toThrow('MAINTENANCE');
  const again = { runId: run.runId, epoch: closed.epoch };
  await expect(
    t.mutation(internal.initialMigration.reopen, {
      ...again,
      observedFrontendBuild: frontendBuild,
    }),
  ).rejects.toThrow(
    'Reopen refused: run a passing smoke check at this Write Epoch first.',
  );
  expect(
    await t.mutation(internal.initialMigration.smoke, {
      ...again,
      smokeId: 'smoke-repair',
    }),
  ).toMatchObject({ outcome: 'passed', epoch: closed.epoch });
  expect(
    await t.mutation(internal.initialMigration.reopen, {
      ...again,
      observedFrontendBuild: frontendBuild,
    }),
  ).toEqual({ epoch: closed.epoch + 1 });
  // Delayed calls from earlier epochs refuse.
  await expect(
    t.mutation(internal.initialMigration.reopen, {
      ...run,
      observedFrontendBuild: frontendBuild,
    }),
  ).rejects.toThrow('Reopen refused: the Write Epoch changed');
  await expect(
    t.mutation(internal.initialMigration.closeForRepair, repair),
  ).rejects.toThrow('Repair closure refused: the Write Epoch changed');
  expect(await strengthOf(gm, seeded.characterId)).toBe(18);
  expect(
    await t.query(internal.initialMigration.status, { now: Date.now() }),
  ).toMatchObject({
    closed: false,
    authority: 'sheet',
    epoch: closed.epoch + 1,
    run: { state: 'reopened' },
  });
});

test('a failed smoke check keeps the deployment closed under sheet authority until a rerun passes (D8)', async () => {
  const { t, seeded, receipt, run, publishArgs } = await activated();
  await publishAll(t, publishArgs);
  const base = await t.run(async (ctx) =>
    ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_browseOnly', (q) =>
        q.eq('characterId', seeded.characterId).eq('browseOnly', undefined),
      )
      .unique(),
  );
  if (!base) throw new Error('Missing published base scores');
  // A faulty deployment reads the published sheet wrongly.
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', base._id, {
      modifiers: base.modifiers.map((modifier) => ({
        ...modifier,
        value: 3,
      })),
    }),
  );
  expect(
    await t.mutation(internal.initialMigration.smoke, {
      ...run,
      smokeId: 'smoke-1',
    }),
  ).toEqual({
    smokeId: 'smoke-1',
    epoch: receipt.epoch,
    checkedAt: expect.any(Number),
    outcome: 'failed',
    problems: [
      `Character ${seeded.characterId} sheet facts differ from its recorded statistics`,
    ],
  });
  await expect(
    t.mutation(internal.initialMigration.reopen, {
      ...run,
      observedFrontendBuild: frontendBuild,
    }),
  ).rejects.toThrow('run a passing smoke check');
  await expect(
    t.mutation(internal.initialMigration.abortBeforeActivation, run),
  ).rejects.toThrow('has activated');
  expect(
    await t.query(internal.initialMigration.status, { now: Date.now() }),
  ).toMatchObject({
    closed: true,
    authority: 'sheet',
    run: { state: 'activated', smoke: { outcome: 'failed' } },
  });
  // The fix is deployed; the rerun passes and reopening is allowed.
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', base._id, { modifiers: base.modifiers }),
  );
  expect(
    await t.mutation(internal.initialMigration.smoke, {
      ...run,
      smokeId: 'smoke-2',
    }),
  ).toMatchObject({ outcome: 'passed' });
  expect(
    await t.mutation(internal.initialMigration.reopen, {
      ...run,
      observedFrontendBuild: frontendBuild,
    }),
  ).toEqual({ epoch: receipt.epoch + 1 });
});

test('publish refuses before activation and changes nothing', async () => {
  const { t, args, receipt } = await closedAndBackfilled(modules);
  const before = await migrationState(t);
  await expect(
    t.mutation(internal.initialMigration.publish, {
      runId: receipt.runId,
      epoch: receipt.epoch,
      activationId: args.activationId,
      page: 0,
    }),
  ).rejects.toThrow(
    'Publication refused: the deployment is not under sheet authority.',
  );
  expect(await migrationState(t)).toEqual(before);
});

test('publish refuses to finish when its pages skipped a captured Character, and to publish a Character changed after capture', async () => {
  const { t, seeded, run, publishArgs } = await activated();
  const stored = await t.run((ctx) =>
    ctx.db.get('initialMigrationRun', run.runId),
  );
  if (!stored?.backfill) throw new Error('Missing capture');
  const { backfill } = stored;
  // One more captured Character than the candidates the pages reach.
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationRun', run.runId, {
      backfill: { ...backfill, captured: backfill.captured + 1 },
    }),
  );
  await expect(
    t.mutation(internal.initialMigration.publish, { ...publishArgs, page: 0 }),
  ).rejects.toThrow(
    'Publication refused: 1 of 2 captured Characters were published',
  );
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationRun', run.runId, { backfill }),
  );
  const before = await sheets(t);
  await t.run((ctx) =>
    ctx.db.patch('character', seeded.characterId, { level: 13 }),
  );
  await expect(
    t.mutation(internal.initialMigration.publish, { ...publishArgs, page: 0 }),
  ).rejects.toThrow(
    `Publication refused: Character ${seeded.characterId} changed after capture`,
  );
  expect((await sheets(t)).map(({ entries }) => entries)).toEqual(
    before.map(({ entries }) => entries),
  );
});

test('reopen refuses before publication completes and changes nothing', async () => {
  const { t, run } = await activated();
  const before = await migrationState(t);
  await expect(
    t.mutation(internal.initialMigration.reopen, {
      ...run,
      observedFrontendBuild: frontendBuild,
    }),
  ).rejects.toThrow(
    'Reopen refused: publish every candidate before reopening.',
  );
  await expect(
    t.mutation(internal.initialMigration.smoke, { ...run, smokeId: 'early' }),
  ).rejects.toThrow(
    'Smoke check refused: publish every candidate before the smoke check.',
  );
  expect(await migrationState(t)).toEqual(before);
});

test('reopen refuses without a passed smoke check for this run and changes nothing', async () => {
  const { t, run, publishArgs } = await activated();
  await publishAll(t, publishArgs);
  const before = await migrationState(t);
  await expect(
    t.mutation(internal.initialMigration.reopen, {
      ...run,
      observedFrontendBuild: frontendBuild,
    }),
  ).rejects.toThrow(
    'Reopen refused: run a passing smoke check at this Write Epoch first.',
  );
  expect(await migrationState(t)).toEqual(before);
});

test('reopen refuses a frontend build other than the run recorded and changes nothing', async () => {
  const { t, run, publishArgs } = await activated();
  await publishAll(t, publishArgs);
  await t.mutation(internal.initialMigration.smoke, { ...run, smokeId: 's' });
  const before = await migrationState(t);
  await expect(
    t.mutation(internal.initialMigration.reopen, {
      ...run,
      observedFrontendBuild: 'build-other',
    }),
  ).rejects.toThrow(
    'Reopen refused: the observed frontend build is not the one this run recorded.',
  );
  expect(await migrationState(t)).toEqual(before);
});

test('abort refuses after activation while publishing, before reopening and after it', async () => {
  const { t, run, receipt, publishArgs } = await activated({
    beforeStart: extraCharacters([1, 2]),
  });
  const aborts = () =>
    Promise.all([
      expect(
        t.mutation(internal.initialMigration.abortBeforeActivation, run),
      ).rejects.toThrow('has activated'),
      expect(
        t.mutation(
          internal.initialCharacterBackfill.abortBeforeActivation,
          receipt,
        ),
      ).rejects.toThrow('has activated'),
    ]);
  await t.mutation(internal.initialMigration.publish, {
    ...publishArgs,
    page: 0,
  });
  await interrupt(t);
  await aborts();
  await t.mutation(internal.initialMigration.publish, {
    ...publishArgs,
    page: 1,
  });
  await t.mutation(internal.initialMigration.smoke, { ...run, smokeId: 's' });
  await aborts();
  await t.mutation(internal.initialMigration.reopen, {
    ...run,
    observedFrontendBuild: frontendBuild,
  });
  await aborts();
  expect(
    await t.query(internal.initialMigration.status, { now: Date.now() }),
  ).toMatchObject({ authority: 'sheet', closed: false });
});

test.each([
  {
    name: 'publish',
    call: (t: ReleaseTest, id: Id<'initialMigrationRun'>, epoch: number) =>
      t.mutation(internal.initialMigration.publish, {
        runId: id,
        epoch,
        activationId: 'activate-initial',
        page: 0,
      }),
    reason: 'Publication refused: the deployment is not under sheet authority.',
  },
  {
    name: 'smoke',
    call: (t: ReleaseTest, id: Id<'initialMigrationRun'>, epoch: number) =>
      t.mutation(internal.initialMigration.smoke, {
        runId: id,
        epoch,
        smokeId: 'smoke',
      }),
    reason: 'Smoke check refused: the deployment is not under sheet authority.',
  },
  {
    name: 'reopen',
    call: (t: ReleaseTest, id: Id<'initialMigrationRun'>, epoch: number) =>
      t.mutation(internal.initialMigration.reopen, {
        runId: id,
        epoch,
        observedFrontendBuild: frontendBuild,
      }),
    reason: 'Reopen refused: the deployment is not under sheet authority.',
  },
  {
    name: 'closeForRepair',
    call: (t: ReleaseTest, id: Id<'initialMigrationRun'>, epoch: number) =>
      t.mutation(internal.initialMigration.closeForRepair, {
        runId: id,
        epoch,
      }),
    reason:
      'Repair closure refused: the deployment is not under sheet authority.',
  },
])(
  '$name refuses on an open legacy deployment, with or without an aborted run, and changes nothing',
  async ({ call, reason }) => {
    // A deployment that never activated, and one whose run was aborted.
    const empty = convexTest(schema, modules);
    await empty.run(async (ctx) => {
      await ctx.db.insert('initialMigrationControl', {
        key: 'character-sheet',
        closed: false,
        authority: 'legacy',
        epoch: 0,
        runId: await ctx.db.insert('initialMigrationRun', {
          operationId: 'never-started',
          epoch: 0,
          state: 'aborted',
          abortedAt: 0,
          frontendBuild,
          catalogManifest: 'none',
          startedAt: 0,
          deadline: 0,
        }),
      });
    });
    const { t, receipt } = await closedAndBackfilled(modules);
    await t.mutation(internal.initialMigration.abortBeforeActivation, {
      runId: receipt.runId,
      epoch: receipt.epoch,
    });
    const [neverActivated] = (await migrationState(empty)).control;
    if (!neverActivated) throw new Error('Missing control row');
    for (const [deployment, id, epoch] of [
      [empty, neverActivated.runId, 0],
      [t, receipt.runId, receipt.epoch + 1],
    ] as const) {
      const before = await migrationState(deployment);
      await expect(call(deployment, id, epoch)).rejects.toThrow(reason);
      expect(await migrationState(deployment)).toEqual(before);
    }
  },
);

test('each publish transaction reads and writes a bounded set whatever the number of Characters', async () => {
  const measure = async (levels: number[]) => {
    const { t, publishArgs } = await activated({
      beforeStart: extraCharacters(levels),
    });
    const reads = vi.spyOn(TransactionMetricsTracker.prototype, 'trackRead');
    const writes = vi.spyOn(TransactionMetricsTracker.prototype, 'trackWrite');
    const pages: { read: number; written: number }[] = [];
    try {
      // Drive each page by hand, so only publish transactions are measured.
      for (let page = 0; ; page++) {
        const read = reads.mock.calls.length;
        const written = writes.mock.calls.length;
        const progress = await t.mutation(internal.initialMigration.publish, {
          ...publishArgs,
          page,
        });
        pages.push({
          read: reads.mock.calls.length - read,
          written: writes.mock.calls.length - written,
        });
        await interrupt(t);
        if (progress.isDone) break;
      }
    } finally {
      reads.mockRestore();
      writes.mockRestore();
    }
    return {
      maxRead: Math.max(...pages.map(({ read }) => read)),
      maxWritten: Math.max(...pages.map(({ written }) => written)),
    };
  };
  const few = await measure([1]);
  const many = await measure(Array.from({ length: 11 }, () => 1));
  expect(many).toEqual(few);
  // The control row, the run twice, two candidates and two Characters, each
  // read again by its patch.
  expect(few.maxRead).toBeLessThanOrEqual(9);
  // The level-12 Officer and a level-1 Character: each a base definition, a
  // base entry, its Class Levels and its patch, then the run.
  expect(few.maxWritten).toBe(1 + 1 + 12 + 1 + (1 + 1 + 1 + 1) + 1);
});

test('Characters at the largest legacy level publish, smoke check, reopen and close for repair within Convex transaction limits', async () => {
  const { t, run, receipt, publishArgs } = await activated({
    beforeStart: extraCharacters([4095, 4095, 4095]),
    transactionLimits: true,
  });
  await publishAll(t, publishArgs);
  expect(
    await t.query(internal.initialMigration.status, { now: Date.now() }),
  ).toMatchObject({ run: { publication: { isDone: true, published: 4 } } });
  // The sample is the Officer and the three largest sheets publish admits.
  const smokeAt = (epoch: number) =>
    t.mutation(internal.initialMigration.smoke, {
      runId: run.runId,
      epoch,
      smokeId: `smoke-${epoch}`,
    });
  const reopenAt = (epoch: number) =>
    t.mutation(internal.initialMigration.reopen, {
      runId: run.runId,
      epoch,
      observedFrontendBuild: frontendBuild,
    });
  expect(await smokeAt(receipt.epoch)).toMatchObject({ outcome: 'passed' });
  const reopened = await reopenAt(receipt.epoch);
  const closed = await t.mutation(internal.initialMigration.closeForRepair, {
    runId: run.runId,
    epoch: reopened.epoch,
  });
  expect(await smokeAt(closed.epoch)).toMatchObject({ outcome: 'passed' });
  expect(await reopenAt(closed.epoch)).toEqual({ epoch: closed.epoch + 1 });
}, 300_000);

test('a repair after a later Catalog Release checks the selected compatible release, keeps the edit and reopens (D9)', async () => {
  const { t, gm, seeded, artifact, run, publishArgs } = await activated();
  await publishAll(t, publishArgs);
  await t.mutation(internal.initialMigration.smoke, { ...run, smokeId: 's' });
  const reopened = await t.mutation(internal.initialMigration.reopen, {
    ...run,
    observedFrontendBuild: frontendBuild,
  });
  await gm.mutation(api.characterSheet.editBaseScores, {
    characterId: seeded.characterId,
    operationId: 'edit-after-reopen',
    scores: { strength: 18 },
    writeEpoch: reopened.epoch,
  });
  // A corrective release through the ordinary protocol, with the gate open.
  await prepare(atEpoch(t, reopened.epoch), [scopeSummary('QUALIFIED')], 2, {
    releaseNumber: 1,
    artifactFingerprint: artifact.manifest.artifactFingerprint,
  });
  const impact = await runCatalogReleaseImpactCommand({
    adapter: impactAdapter(t),
    releaseNumber: 2,
    writeEpoch: reopened.epoch,
  });
  await t.mutation(internal.catalogReleaseActivation.activate, {
    ...activationArgs(impact.runId, 2),
    isFixtureOnly: false,
    writeEpoch: reopened.epoch,
  });
  const closed = await t.mutation(internal.initialMigration.closeForRepair, {
    runId: run.runId,
    epoch: reopened.epoch,
  });
  const repair = { runId: run.runId, epoch: closed.epoch };
  // A repair still refuses a selection the running code cannot read.
  const control = await t.run(async (ctx) =>
    ctx.db
      .query('catalogReleaseControl')
      .withIndex('by_key', (q) => q.eq('key', 'global'))
      .unique(),
  );
  if (!control) throw new Error('Missing release selection');
  await t.run((ctx) =>
    ctx.db.patch('catalogReleaseControl', control._id, {
      schemaIdentity: 'schema-other',
    }),
  );
  expect(
    await t.mutation(internal.initialMigration.smoke, {
      ...repair,
      smokeId: 'smoke-incompatible',
    }),
  ).toMatchObject({
    outcome: 'failed',
    problems: expect.arrayContaining([
      'the selected Catalog Release is not compatible with the deployed schema and calculation',
    ]),
  });
  await t.run((ctx) =>
    ctx.db.patch('catalogReleaseControl', control._id, {
      schemaIdentity: control.schemaIdentity,
    }),
  );
  expect(
    await t.mutation(internal.initialMigration.smoke, {
      ...repair,
      smokeId: 'smoke-repair',
    }),
  ).toMatchObject({ outcome: 'passed', epoch: closed.epoch });
  expect(
    await t.mutation(internal.initialMigration.reopen, {
      ...repair,
      observedFrontendBuild: frontendBuild,
    }),
  ).toEqual({ epoch: closed.epoch + 1 });
  expect(await strengthOf(gm, seeded.characterId)).toBe(18);
  expect(
    await t.query(internal.catalogReleaseActivation.status, {}),
  ).toMatchObject({ releaseNumber: 2 });
}, 120_000);

test('a repair after a migrated Character left its campaign and was deleted samples the live Characters and keeps the deletion (D9)', async () => {
  const { t, member, run, publishArgs } = await activated({
    beforeStart: (ctx, campaignId) =>
      ctx.db.insert('character', {
        campaignId,
        name: 'Departing',
        description: '',
        ownerId: 'test|player',
        kind: 'pc',
        isActive: true,
        level: 2,
        strength: 12,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      }),
  });
  await publishAll(t, publishArgs);
  const departing = await t.run(async (ctx) =>
    (await ctx.db.query('character').collect()).find(
      ({ name }) => name === 'Departing',
    ),
  );
  if (!departing) throw new Error('Missing departing Character');
  await t.mutation(internal.initialMigration.smoke, { ...run, smokeId: 's' });
  const reopened = await t.mutation(internal.initialMigration.reopen, {
    ...run,
    observedFrontendBuild: frontendBuild,
  });
  // The owner leaves the campaign and deletes the now private Character.
  const leave = {
    characterId: departing._id,
    operationId: 'leave',
    writeEpoch: reopened.epoch,
  };
  let progress = await member.mutation(api.characterMoves.start, leave);
  for (let step = 0; step < 20 && progress.state !== 'completed'; step++)
    progress = await member.mutation(api.characterMoves.resume, leave);
  expect(progress.state).toBe('completed');
  await member.mutation(api.characterSheet.deletePrivate, {
    characterId: departing._id,
    operationId: 'delete',
    writeEpoch: reopened.epoch,
  });
  const closed = await t.mutation(internal.initialMigration.closeForRepair, {
    runId: run.runId,
    epoch: reopened.epoch,
  });
  const repair = { runId: run.runId, epoch: closed.epoch };
  expect(
    await t.mutation(internal.initialMigration.smoke, {
      ...repair,
      smokeId: 'smoke-repair',
    }),
  ).toMatchObject({ outcome: 'passed' });
  expect(
    await t.mutation(internal.initialMigration.reopen, {
      ...repair,
      observedFrontendBuild: frontendBuild,
    }),
  ).toEqual({ epoch: closed.epoch + 1 });
  expect(
    await t.run((ctx) => ctx.db.get('character', departing._id)),
  ).toBeNull();
});

test('a repair smoke check refuses a live Character without a published sheet', async () => {
  const { t, seeded, run, publishArgs } = await activated();
  await publishAll(t, publishArgs);
  await t.mutation(internal.initialMigration.smoke, { ...run, smokeId: 's' });
  const reopened = await t.mutation(internal.initialMigration.reopen, {
    ...run,
    observedFrontendBuild: frontendBuild,
  });
  const closed = await t.mutation(internal.initialMigration.closeForRepair, {
    runId: run.runId,
    epoch: reopened.epoch,
  });
  await t.run((ctx) =>
    ctx.db.patch('character', seeded.characterId, { sheetMode: undefined }),
  );
  expect(
    await t.mutation(internal.initialMigration.smoke, {
      runId: run.runId,
      epoch: closed.epoch,
      smokeId: 'smoke-repair',
    }),
  ).toMatchObject({
    outcome: 'failed',
    problems: [`Character ${seeded.characterId} has no published sheet`],
  });
});

test('reopen refuses a passed smoke check from an earlier Write Epoch and changes nothing', async () => {
  const { t, run, receipt, publishArgs } = await activated();
  await publishAll(t, publishArgs);
  const smoke = await t.mutation(internal.initialMigration.smoke, {
    ...run,
    smokeId: 's',
  });
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationRun', run.runId, {
      smoke: { ...smoke, epoch: receipt.epoch - 1 },
    }),
  );
  const before = await migrationState(t);
  await expect(
    t.mutation(internal.initialMigration.reopen, {
      ...run,
      observedFrontendBuild: frontendBuild,
    }),
  ).rejects.toThrow(
    'Reopen refused: run a passing smoke check at this Write Epoch first.',
  );
  expect(await migrationState(t)).toEqual(before);
});

type StoredRun = WithoutSystemFields<Doc<'initialMigrationRun'>>;
type RunStatus = NonNullable<
  FunctionReturnType<typeof internal.initialMigration.status>['run']
>;

test('a reopened run carries its passed smoke check and a repairing run its closure; other shapes refuse', async () => {
  const { t, run, publishArgs } = await activated();
  await publishAll(t, publishArgs);
  await t.mutation(internal.initialMigration.smoke, { ...run, smokeId: 's' });
  await t.mutation(internal.initialMigration.reopen, {
    ...run,
    observedFrontendBuild: frontendBuild,
  });
  const stored = await t.run((ctx) =>
    ctx.db.get('initialMigrationRun', run.runId),
  );
  if (stored?.state !== 'reopened') throw new Error('Missing reopening');
  const { _id, _creationTime, smoke, reopenedAt, ...rest } = stored;
  const insert = (value: unknown) =>
    t.run((ctx) => ctx.db.insert('initialMigrationRun', value as StoredRun));
  const failed = { ...smoke, outcome: 'failed', problems: ['x'] };
  await insert({ ...rest, smoke, reopenedAt });
  await insert({
    ...rest,
    state: 'repairing',
    smoke: null,
    reopenedAt,
    closedForRepairAt: 2,
  });
  for (const illegal of [
    { ...rest, smoke: null, reopenedAt },
    { ...rest, smoke: failed, reopenedAt },
    { ...rest, smoke },
    { ...rest, state: 'repairing', smoke: null, reopenedAt },
    { ...rest, state: 'activated', smoke, reopenedAt },
  ])
    await expect(insert(illegal)).rejects.toThrow('Validator error');

  // @ts-expect-error a reopened run relied on a passed smoke check
  const unchecked: StoredRun = { ...rest, smoke: failed, reopenedAt };
  // @ts-expect-error a repairing run records when it closed
  const unclosed: StoredRun = {
    ...rest,
    state: 'repairing',
    smoke: null,
    reopenedAt,
  };
  const reported = { ...rest, runId: _id, smoke, reopenedAt } as const;
  // @ts-expect-error status reports a reopened run with when it reopened
  const bare: RunStatus = { ...reported, reopenedAt: undefined };
  expect([unchecked, unclosed, bare]).toHaveLength(3);
});
