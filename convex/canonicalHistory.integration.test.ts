// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { beforeAll, afterEach, beforeEach, expect, test, vi } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import schema from './schema';
import { api, internal } from './_generated/api';
import {
  deploymentFixture,
  fixtureCredentials,
} from '../e2e/support/test-data';
import { appendResolutionRecord } from './lib/canonicalDraftStorage';
import { resolutionArtifactSchema } from '../src/lib/canonical-resolution-record';
import { locateAuditSequence } from '../src/lib/audit-ordinal';
const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
const scope = {
  namespace: deploymentFixture.namespace,
  version: 1,
  workerKey: 'worker-0',
  caseKey: 'canonicalPersistence' as const,
  ...fixtureCredentials,
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('E2E_ENABLED', 'true');
  vi.stubEnv('E2E_FIXTURE_CONFIG', JSON.stringify(deploymentFixture));
  vi.stubEnv('CONVEX_CLOUD_URL', deploymentFixture.convexUrl);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.e2eFixtures.seedIdentityProjection, scope);
  await t.mutation(internal.e2eFixtures.resetCase, { ...scope, now: 1 });
  const key = await t.mutation(
    internal.canonicalPersistenceFixtures.initialize,
    {
      scope,
      draftId: 'history-week',
    },
  );
  const users = await t.run((ctx) => ctx.db.query('user').collect());
  const identity = (role: string) => {
    const user = users.find((user) =>
      user.orgIds.some(
        (org) => org.orgId === 'org_members' && org.role === role,
      ),
    );
    if (!user) throw Error('Missing identity');
    return t.withIdentity({ tokenIdentifier: user.tokenIdentifier });
  };
  const player = identity('member');
  const gm = identity('admin');
  await player.mutation(api.canonicalDraftPersistence.edit, {
    campaignId: key.campaignId,
    militiaId: key.militiaId,
    operation: {
      draftId: key.draftId,
      operationId: 'chance',
      baseRevision: 0,
      edit: {
        kind: 'event_chance',
        roll: {
          diceTotal: 100,
          diceCount: 1,
          sides: 100,
          provenance: { kind: 'table' },
          modifiers: [],
        },
      },
    },
  });
  const preview = await player.query(
    api.canonicalDraftPersistence.preview,
    key,
  );
  const { record } = await player.mutation(
    api.canonicalDraftPersistence.confirm,
    {
      ...key,
      operation: { operationId: 'finished', reviewed: preview.reviewed },
    },
  );
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  return { t, player, gm, key, record };
}
test('[rules.P86.history] history selects complete effective records, retains paged audit records, and survives live changes', async () => {
  const { t, player, gm, key, record } = await setup();
  const args = { campaignId: key.campaignId };
  const first = await player.query(api.canonicalHistory.read, args);
  expect(first?.record).toEqual(record);
  expect(first).not.toHaveProperty('canRewriteHistory');
  await t.run(async (ctx) => {
    const state = await ctx.db.query('canonicalMilitiaState').first();
    if (!state) throw Error('Missing state');
    await ctx.db.patch('canonicalMilitiaState', state._id, {
      snapshot: { ...state.snapshot, treasuryCopper: 99999 },
    });
    await ctx.db.patch('militia', key.militiaId, {
      name: 'Changed today',
    });
  });
  expect(await player.query(api.canonicalHistory.read, args)).toEqual(first);
  for (let i = 1; i <= 7; i++) {
    await gm.run((ctx) =>
      appendResolutionRecord(ctx, {
        campaignId: key.campaignId,
        militiaId: key.militiaId,
        record: {
          ...record,
          recordId: `correction-${i}`,
          provenance: 'historical_correction',
          supersedesRecordId: i === 1 ? record.recordId : `correction-${i - 1}`,
          finalOutcome: { formatVersion: 2, data: { treasuryCopper: i } },
        },
      }),
    );
  }
  const latest = await player.query(api.canonicalHistory.read, args);
  expect(latest?.record.finalOutcome.data).toEqual({ treasuryCopper: 7 });
  expect(latest?.effectiveRecordId).toBe('correction-7');
  expect(latest?.audit.map((item) => item.sequence)).toEqual([7, 6, 5, 4, 3]);
  const older = await player.query(api.canonicalHistory.read, {
    ...args,
    beforeSequence: latest!.earlierSequence!,
  });
  expect(older?.audit.map((item) => item.sequence)).toEqual([2, 1, 0]);
  expect(older?.earlierSequence).toBeNull();
  const original = await player.query(api.canonicalHistory.read, {
    ...args,
    recordId: record.recordId,
  });
  expect(original?.record).toEqual(record);
  expect(original?.effectiveRecordId).toBe('correction-7');
  expect(await gm.query(api.canonicalHistory.read, args)).toEqual(
    await player.query(api.canonicalHistory.read, args),
  );
});

test('[rules.P86.authority] campaign members can append corrections while outsiders cannot and closed drafts stay immutable', async () => {
  const { t, player, gm, key, record } = await setup();
  const args = { campaignId: key.campaignId };
  const before = await player.query(api.canonicalHistory.read, args);
  await expect(t.query(api.canonicalHistory.read, args)).rejects.toThrow(
    'Campaign access',
  );
  await expect(
    t
      .withIdentity({ tokenIdentifier: 'outsider' })
      .query(api.canonicalHistory.read, args),
  ).rejects.toThrow('Campaign access');
  const correction = {
    ...record,
    recordId: 'correction',
    provenance: 'historical_correction' as const,
    supersedesRecordId: record.recordId,
  };
  await expect(
    t.withIdentity({ tokenIdentifier: 'outsider' }).run((ctx) =>
      appendResolutionRecord(ctx, {
        campaignId: key.campaignId,
        militiaId: key.militiaId,
        record: correction,
      }),
    ),
  ).rejects.toThrow('Campaign access');
  expect(await player.query(api.canonicalHistory.read, args)).toEqual(before);
  await player.run((ctx) =>
    appendResolutionRecord(ctx, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      record: correction,
    }),
  );
  expect((await player.query(api.canonicalHistory.read, args))?.record).toEqual(
    correction,
  );
  expect(await gm.query(api.canonicalHistory.read, args)).toEqual(
    await player.query(api.canonicalHistory.read, args),
  );
  expect(
    (
      await player.query(api.canonicalHistory.read, {
        ...args,
        recordId: record.recordId,
      })
    )?.record,
  ).toEqual(record);
  await expect(
    player.mutation(api.canonicalDraftPersistence.edit, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      operation: {
        draftId: key.draftId,
        operationId: 'reopen',
        baseRevision: 1,
        edit: { kind: 'event_chance', roll: null },
      },
    }),
  ).rejects.toThrow('Draft is closed');
  vi.stubEnv('E2E_ENABLED', 'false');
  expect((await gm.query(api.canonicalHistory.read, args))?.record).toEqual(
    correction,
  );
});

test('[rules.P86.navigation] week navigation skips gaps and rejects records from another week or campaign', async () => {
  const { t, player, gm, key, record } = await setup();
  const args = { campaignId: key.campaignId };
  await gm.run((ctx) =>
    appendResolutionRecord(ctx, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      record: {
        ...record,
        recordId: 'older',
        provenance: 'historical_reconstruction',
        source: { ...record.source, week: 0, draftId: 'older-draft' },
      },
    }),
  );
  expect(await player.query(api.canonicalHistory.read, args)).toMatchObject({
    week: 1,
    previousWeek: 0,
    nextWeek: null,
  });
  expect(
    await player.query(api.canonicalHistory.read, { ...args, week: 0 }),
  ).toMatchObject({
    week: 0,
    previousWeek: null,
    nextWeek: 1,
    record: { recordId: 'older' },
  });
  expect(
    await player.query(api.canonicalHistory.read, { ...args, week: 8 }),
  ).toBeNull();
  await expect(
    player.query(api.canonicalHistory.read, { ...args, recordId: 'older' }),
  ).rejects.toThrow('historical week reference');
  await expect(
    player.query(api.canonicalHistory.read, { ...args, recordId: 'missing' }),
  ).rejects.toThrow('historical week reference');
  const foreign = await t.run(async (ctx) => {
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Foreign',
      description: '',
      ownerId: 'other',
      organizationId: 'org_members',
    });
    const militiaId = await ctx.db.insert('militia', {
      campaignId,
      name: 'Foreign',
    });
    return { campaignId, militiaId };
  });
  await gm.run((ctx) =>
    appendResolutionRecord(ctx, {
      ...foreign,
      record: {
        ...record,
        recordId: 'foreign',
        provenance: 'historical_reconstruction',
        source: { ...record.source, draftId: 'foreign-draft' },
      },
    }),
  );
  await expect(
    player.query(api.canonicalHistory.read, { ...args, recordId: 'foreign' }),
  ).rejects.toThrow('Invalid record reference');
});

type Harness = Awaited<ReturnType<typeof setup>>;
function listFor(
  { player, key }: Pick<Harness, 'player' | 'key'>,
  args: { beforeWeek?: number; limit?: number; selectedWeek?: number } = {},
) {
  return player.query(api.canonicalHistory.list, {
    campaignId: key.campaignId,
    ...args,
  });
}
// Weeks other than the confirmed week 1 and its open successor are recorded
// as historical reconstructions of their own drafts.
async function reconstruct({ gm, key, record }: Harness, weeks: number[]) {
  await gm.run(async (ctx) => {
    for (const week of weeks)
      await appendResolutionRecord(ctx, {
        campaignId: key.campaignId,
        militiaId: key.militiaId,
        record: {
          ...record,
          recordId: `week-${week}`,
          provenance: 'historical_reconstruction',
          source: { ...record.source, week, draftId: `draft-${week}` },
        },
      });
  });
}
async function correct(
  { gm, key, record }: Harness,
  week: number,
  count: number,
) {
  const original = week === record.source.week;
  await gm.run(async (ctx) => {
    for (let i = 1; i <= count; i++)
      await appendResolutionRecord(ctx, {
        campaignId: key.campaignId,
        militiaId: key.militiaId,
        record: {
          ...record,
          ...(original
            ? {}
            : {
                source: { ...record.source, week, draftId: `draft-${week}` },
              }),
          recordId: `week-${week}-correction-${i}`,
          provenance: 'historical_correction',
          supersedesRecordId:
            i > 1
              ? `week-${week}-correction-${i - 1}`
              : original
                ? record.recordId
                : `week-${week}`,
          // Each correction's Final militia holds its own treasury.
          finalOutcome: resolutionArtifactSchema.parse({
            formatVersion: 2,
            data: JSON.parse(
              JSON.stringify({
                militiaSnapshot: {
                  ...record.sourceMilitiaSnapshot,
                  treasuryCopper: i,
                },
              }),
            ) as unknown,
          }),
        },
      });
  });
}
async function creationTimes(t: Harness['t']) {
  const rows = await t.run((ctx) =>
    ctx.db.query('canonicalResolutionRecord').take(200),
  );
  return new Map(rows.map((row) => [row.recordId, row._creationTime]));
}

test('[rules.P86.listing] finished-week listing returns distinct effective weeks latest-first with dates, chain counts and compact headlines', async () => {
  const harness = await setup();
  const { t, record } = harness;
  vi.setSystemTime(Date.UTC(2030, 0, 1));
  await reconstruct(harness, [3, 5, 9]);
  vi.setSystemTime(Date.UTC(2030, 0, 2));
  await correct(harness, 1, 7);
  const times = await creationTimes(t);
  const home = await listFor(harness, { limit: 3 });
  expect(home.weeks.map((row) => row.week)).toEqual([9, 5, 3]);
  expect(home.earlierWeek).toBe(3);
  expect(home.selected).toBeNull();
  const all = await listFor(harness);
  expect(all.weeks.map((row) => row.week)).toEqual([9, 5, 3, 1]);
  expect(all.earlierWeek).toBeNull();
  const [latest, , , corrected] = all.weeks;
  expect(corrected).toEqual({
    week: 1,
    effectiveRecordId: 'week-1-correction-7',
    effectiveSequence: 7,
    entryCount: 8,
    provenance: 'historical_correction',
    rulesetVersion: record.rulesetVersion,
    createdAt: times.get('week-1-correction-7'),
    headlineFacts: [
      {
        key: 'treasury',
        label: 'Treasury',
        before: record.sourceMilitiaSnapshot.treasuryCopper,
        final: 7,
        beforeRecorded: true,
        finalRecorded: true,
        unit: 'gp',
      },
    ],
  });
  // Same-instant inserts receive sub-millisecond tiebreaks in the test backend.
  expect(Math.floor(corrected?.createdAt ?? 0)).toBe(Date.UTC(2030, 0, 2));
  expect(corrected?.createdAt).not.toBe(times.get(record.recordId));
  expect(latest).toMatchObject({
    week: 9,
    effectiveRecordId: 'week-9',
    entryCount: 1,
    provenance: 'historical_reconstruction',
    createdAt: times.get('week-9'),
  });
  expect(Math.floor(latest?.createdAt ?? 0)).toBe(Date.UTC(2030, 0, 1));
  for (const row of all.weeks)
    expect(Object.keys(row).sort()).toEqual([
      'createdAt',
      'effectiveRecordId',
      'effectiveSequence',
      'entryCount',
      'headlineFacts',
      'provenance',
      'rulesetVersion',
      'week',
    ]);
  expect(JSON.stringify(all)).not.toContain('militiaSnapshot');
  expect(await listFor(harness, { beforeWeek: 5, limit: 1 })).toEqual({
    weeks: [all.weeks[2]],
    earlierWeek: 3,
    selected: null,
  });
  expect(await listFor(harness, { beforeWeek: 3 })).toEqual({
    weeks: [corrected],
    earlierWeek: null,
    selected: null,
  });
  expect(await listFor(harness, { beforeWeek: 1 })).toEqual({
    weeks: [],
    earlierWeek: null,
    selected: null,
  });
});

test('[rules.P86.listing-selected] selectedWeek metadata is exact and independent of the listed window', async () => {
  const harness = await setup();
  await reconstruct(harness, [3, 5, 9]);
  await correct(harness, 1, 2);
  const all = await listFor(harness);
  const deep = await listFor(harness, { limit: 1, selectedWeek: 1 });
  expect(deep.weeks).toEqual([all.weeks[0]]);
  expect(deep.earlierWeek).toBe(9);
  expect(deep.selected).toEqual(all.weeks[3]);
  expect(deep.selected).toMatchObject({ entryCount: 3, effectiveSequence: 2 });
  const listed = await listFor(harness, { limit: 2, selectedWeek: 5 });
  expect(listed.selected).toEqual(listed.weeks[1]);
  expect(
    (await listFor(harness, { beforeWeek: 5, selectedWeek: 9 })).selected,
  ).toEqual(all.weeks[0]);
  for (const selectedWeek of [0, 2, 4, 400])
    expect((await listFor(harness, { selectedWeek })).selected).toBeNull();
});

test('[rules.P86.listing-pages] listing pages more than fifty sparse weeks without duplicates or loss, skipping whole correction chains', async () => {
  const harness = await setup();
  const recorded = Array.from({ length: 60 }, (_, index) => 3 + index * 2);
  await reconstruct(harness, recorded);
  const newest = Math.max(...recorded);
  await correct(harness, newest, 30);
  const home = await listFor(harness, { limit: 3 });
  expect(home.weeks.map((row) => row.week)).toEqual([
    newest,
    newest - 2,
    newest - 4,
  ]);
  expect(home.weeks[0]).toMatchObject({ entryCount: 31 });
  const expected = [...recorded, 1].sort((a, b) => b - a);
  for (const limit of [undefined, 7, 50]) {
    const seen: number[] = [];
    let beforeWeek: number | undefined;
    for (;;) {
      const page = await listFor(harness, { beforeWeek, limit });
      seen.push(...page.weeks.map((row) => row.week));
      if (page.earlierWeek === null) break;
      expect(page.weeks).toHaveLength(limit ?? 25);
      expect(page.earlierWeek).toBe(page.weeks[page.weeks.length - 1]?.week);
      beforeWeek = page.earlierWeek;
    }
    expect(seen).toEqual(expected);
  }
});

test('[rules.P86.listing-selectors] listing rejects malformed selectors', async () => {
  const harness = await setup();
  for (const args of [
    { limit: 0 },
    { limit: 51 },
    { limit: 2.5 },
    { beforeWeek: -1 },
    { beforeWeek: 1.5 },
    { selectedWeek: -1 },
    { selectedWeek: 0.5 },
    { beforeWeek: Number.NaN },
  ])
    await expect(listFor(harness, args)).rejects.toThrow(
      'Invalid finished-week selection',
    );
  expect((await listFor(harness, { limit: 50 })).weeks).toHaveLength(1);
  expect((await listFor(harness, { limit: 1 })).weeks).toHaveLength(1);
  expect(await listFor(harness, { beforeWeek: 0, selectedWeek: 0 })).toEqual({
    weeks: [],
    earlierWeek: null,
    selected: null,
  });
});

test('[rules.P86.listing-authority] listing requires membership and stays within the campaign and militia', async () => {
  const harness = await setup();
  const { t, gm, key, record } = harness;
  const args = { campaignId: key.campaignId, limit: 3 };
  const before = await listFor(harness, { limit: 3 });
  expect(before.weeks.map((row) => row.week)).toEqual([1]);
  expect(await gm.query(api.canonicalHistory.list, args)).toEqual(before);
  await expect(t.query(api.canonicalHistory.list, args)).rejects.toThrow(
    'Campaign access',
  );
  await expect(
    t
      .withIdentity({ tokenIdentifier: 'outsider' })
      .query(api.canonicalHistory.list, args),
  ).rejects.toThrow('Campaign access');
  const campaign = (organizationId: string, militia = true) =>
    t.run(async (ctx) => {
      const campaignId = await ctx.db.insert('campaign', {
        name: 'Other',
        description: '',
        ownerId: 'other',
        organizationId,
      });
      const militiaId = militia
        ? await ctx.db.insert('militia', { campaignId, name: 'Other' })
        : null;
      return { campaignId, militiaId };
    });
  const foreign = await campaign('org_outsiders');
  await expect(
    gm.query(api.canonicalHistory.list, { campaignId: foreign.campaignId }),
  ).rejects.toThrow('Campaign access');
  const unscoped = await campaign('org_members', false);
  await expect(
    gm.query(api.canonicalHistory.list, { campaignId: unscoped.campaignId }),
  ).rejects.toThrow('Campaign militia unavailable');
  // An outsider can't tell a campaign without history from one with it.
  const foreignUnscoped = await campaign('org_outsiders', false);
  await expect(
    gm.query(api.canonicalHistory.list, {
      campaignId: foreignUnscoped.campaignId,
    }),
  ).rejects.toThrow('Campaign access required');
  // A sibling campaign in the same organization keeps its own history.
  const sibling = await campaign('org_members');
  await gm.run((ctx) =>
    appendResolutionRecord(ctx, {
      campaignId: sibling.campaignId,
      militiaId: sibling.militiaId!,
      record: {
        ...record,
        recordId: 'sibling',
        provenance: 'historical_reconstruction',
        source: { ...record.source, week: 12, draftId: 'sibling-draft' },
      },
    }),
  );
  expect(await listFor(harness, { limit: 3 })).toEqual(before);
  expect(
    await gm.query(api.canonicalHistory.list, {
      campaignId: sibling.campaignId,
      selectedWeek: 1,
    }),
  ).toMatchObject({ weeks: [{ week: 12 }], selected: null });
  // A stored tip naming another militia is never served as this campaign's.
  await t.run(async (ctx) => {
    const stored = await ctx.db
      .query('canonicalResolutionRecord')
      .withIndex('by_recordId', (q) => q.eq('recordId', record.recordId))
      .unique();
    if (!stored) throw Error('Missing record');
    await ctx.db.insert('canonicalResolutionRecord', {
      campaignId: key.campaignId,
      militiaId: sibling.militiaId!,
      recordId: 'misfiled',
      week: 20,
      sequence: 0,
      record: {
        ...stored.record,
        recordId: 'misfiled',
        source: { ...stored.record.source, week: 20 },
      },
    });
  });
  for (const selectors of [{}, { beforeWeek: 20, selectedWeek: 20 }])
    await expect(listFor(harness, selectors)).rejects.toThrow(
      'Invalid record militia reference',
    );
  // Revoked membership removes access to previously listed history.
  await t.run(async (ctx) => {
    for (const user of await ctx.db.query('user').take(20))
      await ctx.db.patch('user', user._id, {
        orgIds: user.orgIds.filter((org) => org.orgId !== 'org_members'),
      });
  });
  await expect(listFor(harness, { beforeWeek: 20 })).rejects.toThrow(
    'Campaign access',
  );
});

test('[rules.P86.record-dates] read adds document creation dates to the selected record and each audit entry', async () => {
  const harness = await setup();
  const { t, player, key, record } = harness;
  vi.setSystemTime(Date.UTC(2030, 0, 3));
  await correct(harness, 1, 6);
  const times = await creationTimes(t);
  const args = { campaignId: key.campaignId };
  const latest = await player.query(api.canonicalHistory.read, args);
  expect(latest?.createdAt).toBe(times.get('week-1-correction-6'));
  expect(latest?.audit).toEqual(
    [6, 5, 4, 3, 2].map((sequence) => ({
      recordId: `week-1-correction-${sequence}`,
      sequence,
      provenance: 'historical_correction',
      createdAt: times.get(`week-1-correction-${sequence}`),
    })),
  );
  const older = await player.query(api.canonicalHistory.read, {
    ...args,
    week: 1,
    beforeSequence: latest!.earlierSequence!,
  });
  expect(older?.audit).toEqual([
    {
      recordId: 'week-1-correction-1',
      sequence: 1,
      provenance: 'historical_correction',
      createdAt: times.get('week-1-correction-1'),
    },
    {
      recordId: record.recordId,
      sequence: 0,
      provenance: 'confirmation',
      createdAt: times.get(record.recordId),
    },
  ]);
  const original = await player.query(api.canonicalHistory.read, {
    ...args,
    week: 1,
    recordId: record.recordId,
  });
  expect(original?.record).toEqual(record);
  expect(original?.effectiveRecordId).toBe('week-1-correction-6');
  expect(original?.createdAt).toBe(times.get(record.recordId));
  expect(original?.createdAt).not.toBe(latest?.createdAt);
  const stored = await t.run((ctx) =>
    ctx.db.query('canonicalResolutionRecord').take(10),
  );
  for (const row of stored) expect(row.record).not.toHaveProperty('createdAt');
});

test('an earlier entry deep in a chain of more than ten is located through the existing five-entry pages', async () => {
  const harness = await setup();
  const { player, key, record } = harness;
  await correct(harness, 1, 12);
  const pages: (number | undefined)[] = [];
  const read = (beforeSequence: number | undefined) => {
    pages.push(beforeSequence);
    return player.query(api.canonicalHistory.read, {
      campaignId: key.campaignId,
      week: 1,
      beforeSequence,
    });
  };
  const signal = { cancelled: false };
  await expect(
    locateAuditSequence(read, record.recordId, { signal }),
  ).resolves.toBe(0);
  expect(pages).toEqual([undefined, 8, 3]);
  pages.length = 0;
  await expect(
    locateAuditSequence(read, 'week-1-correction-7', { signal }),
  ).resolves.toBe(7);
  expect(pages).toEqual([undefined, 8]);
  pages.length = 0;
  await expect(
    locateAuditSequence(read, 'not-in-this-week', { signal }),
  ).resolves.toBeNull();
  expect(pages).toEqual([undefined, 8, 3]);
});

test('the finished-weeks browser fixture appends a correction chain and a non-adjacent reconstructed week', async () => {
  const harness = await setup();
  const { t, player, key, record } = harness;
  const appendHistory = (args: {
    corrections: number;
    reconstructWeek: number;
  }) =>
    t.mutation(internal.canonicalPersistenceFixtures.appendHistory, {
      ...key,
      scope,
      ...args,
    });
  // The open week 2 cannot be reconstructed.
  await expect(
    appendHistory({ corrections: 1, reconstructWeek: 2 }),
  ).rejects.toThrow('The reconstructed week must be free');
  await appendHistory({ corrections: 6, reconstructWeek: 3 });
  const listed = await listFor(harness);
  expect(listed.weeks.map((row) => [row.week, row.entryCount])).toEqual([
    [3, 1],
    [1, 7],
  ]);
  expect(listed.weeks[0]?.provenance).toBe('historical_reconstruction');
  expect(listed.weeks[1]?.provenance).toBe('historical_correction');
  const first = await player.query(api.canonicalHistory.read, {
    campaignId: key.campaignId,
    week: 1,
  });
  expect(first).toMatchObject({
    effectiveRecordId: `${record.recordId}-correction-6`,
    previousWeek: null,
    nextWeek: 3,
  });
  expect(first?.audit.map((entry) => entry.sequence)).toEqual([6, 5, 4, 3, 2]);
  const older = await player.query(api.canonicalHistory.read, {
    campaignId: key.campaignId,
    week: 1,
    beforeSequence: first!.earlierSequence!,
  });
  expect(older?.audit.map((entry) => entry.recordId)).toEqual([
    `${record.recordId}-correction-1`,
    record.recordId,
  ]);
  const original = await player.query(api.canonicalHistory.read, {
    campaignId: key.campaignId,
    week: 1,
    recordId: record.recordId,
  });
  expect(original?.record).toEqual(record);
  expect(
    await player.query(api.canonicalHistory.read, {
      campaignId: key.campaignId,
      week: 3,
    }),
  ).toMatchObject({ previousWeek: 1, nextWeek: null });
  // The reconstructed week cannot be written twice.
  await expect(
    appendHistory({ corrections: 1, reconstructWeek: 3 }),
  ).rejects.toThrow('The reconstructed week must be free');
});
