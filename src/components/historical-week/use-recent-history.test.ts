import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { zid } from 'convex-helpers/server/zod4';
import { canonicalResolutionRecordSchema } from '~/lib/canonical-resolution-record';
import { createWeeklyDraft } from '~/lib/weekly-draft';
import { useRecentHistory } from './use-recent-history';
import {
  emptyPlanArtifacts,
  recordSnapshot,
} from '../../../tests/history/resolution-record-fixtures';
import { queryCacheFixture } from '../../../tests/convex-query-cache';
import type { HistoryRead } from './history-read';

const campaign = zid('campaign').parse('campaign');
const otherCampaign = zid('campaign').parse('other');
const values = new Map<string, HistoryRead | null | undefined | Error>();
let cache: ReturnType<typeof queryCacheFixture>;
function history(week: number, previousWeek: number | null): HistoryRead {
  const context = {
    firstMilitiaWeek: false,
    startDay: 0,
    uneventfulCarry: false,
    carriedEvents: [],
    queuedEffects: [],
    orders: [],
    lastBuyoffWeek: null,
  };
  return {
    week,
    previousWeek,
    nextWeek: null,
    effectiveRecordId: `effective-${week}`,
    earlierSequence: null,
    createdAt: 3000,
    audit: [
      {
        recordId: `effective-${week}`,
        sequence: 2,
        provenance: 'historical_correction',
        createdAt: 3000,
      },
      {
        recordId: `older-${week}`,
        sequence: 1,
        provenance: 'historical_correction',
        createdAt: 2000,
      },
      {
        recordId: `original-${week}`,
        sequence: 0,
        provenance: 'confirmation',
        createdAt: 1000,
      },
    ],
    record: canonicalResolutionRecordSchema.parse({
      recordId: `effective-${week}`,
      source: createWeeklyDraft({
        draftId: `closed-${week}`,
        week,
        slotIds: [],
        context,
      }),
      sourceMilitiaSnapshot: recordSnapshot(),
      provenance: 'historical_correction',
      rulesetVersion: 1,
      ...emptyPlanArtifacts({
        before: { week, militiaSnapshot: recordSnapshot(), context },
      }),
      adjudication: {
        acknowledgements: [],
        rulesExceptions: [],
        tableAdjustments: [],
      },
      warnings: [],
      successorContext: context,
      supersedesRecordId: `older-${week}`,
    }),
  };
}
beforeEach(() => {
  values.clear();
  cache = queryCacheFixture((_name, args) => {
    const week = typeof args.week === 'number' ? args.week : 'latest';
    const value = values.get(`${String(args.campaignId)}:${week}`);
    if (value instanceof Error) throw value;
    return value;
  });
});
afterEach(() => cache.client.clear());

test('recent weeks follow canonical gaps and ignore audit entries, stopping after three effective weeks', async () => {
  values.set('campaign:latest', history(12, 8));
  values.set('campaign:8', history(8, 3));
  values.set('campaign:3', history(3, 1));
  const { result } = renderHook(() => useRecentHistory(campaign, true), {
    wrapper: cache.wrapper,
  });
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(result.current.weeks.map((item) => item.week)).toEqual([12, 8, 3]);
  expect(result.current.weeks.map((item) => item.record.recordId)).toEqual([
    'effective-12',
    'effective-8',
    'effective-3',
  ]);
  expect(cache.opened.map(({ args }) => args)).toEqual([
    { campaignId: campaign },
    { campaignId: campaign, week: 8 },
    { campaignId: campaign, week: 3 },
  ]);
});

test('a campaign switch never shows late results from another campaign, even while they remain cached', async () => {
  values.set('campaign:latest', history(12, null));
  const view = renderHook(({ id }) => useRecentHistory(id, true), {
    initialProps: { id: campaign },
    wrapper: cache.wrapper,
  });
  await waitFor(() => expect(view.result.current.status).toBe('ready'));
  view.rerender({ id: otherCampaign });
  values.set('campaign:latest', history(20, null));
  act(() => cache.push());
  expect(view.result.current.status).toBe('loading');
  expect(view.result.current.weeks).toEqual([]);
  values.set('other:latest', history(5, null));
  act(() => cache.push());
  await waitFor(() =>
    expect(view.result.current.weeks.map((item) => item.week)).toEqual([5]),
  );
});

test.each([0, 1, 2])(
  'returns %i finished weeks without querying nonexistent predecessors',
  async (count) => {
    values.set(
      'campaign:latest',
      count === 0 ? null : history(12, count === 1 ? null : 8),
    );
    values.set('campaign:8', history(8, null));
    const { result } = renderHook(() => useRecentHistory(campaign, true), {
      wrapper: cache.wrapper,
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.weeks.map((item) => item.week)).toEqual(
      [12, 8].slice(0, count),
    );
    expect(cache.opened).toHaveLength(Math.max(1, count));
  },
);

test.each(['latest', '8', '3'])(
  'loading and failure at week %s stay local and recover on retry',
  async (failedWeek) => {
    values.set('campaign:latest', history(12, 8));
    values.set('campaign:8', history(8, 3));
    values.set('campaign:3', history(3, null));
    const recovered = values.get(`campaign:${failedWeek}`);
    values.delete(`campaign:${failedWeek}`);
    const { result } = renderHook(() => useRecentHistory(campaign, true), {
      wrapper: cache.wrapper,
    });
    await waitFor(() =>
      expect(cache.opened.at(-1)?.args.week ?? 'latest').toBe(
        failedWeek === 'latest' ? 'latest' : Number(failedWeek),
      ),
    );
    expect(result.current.status).toBe('loading');
    expect(result.current.weeks).toEqual([]);
    values.set(`campaign:${failedWeek}`, new Error('offline'));
    act(() => cache.push());
    await waitFor(() => expect(result.current.status).toBe('failed'));
    expect(result.current.weeks).toEqual([]);
    values.set(`campaign:${failedWeek}`, recovered);
    act(result.current.retry);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.weeks.map((item) => item.week)).toEqual([12, 8, 3]);
    expect(cache.opened).toHaveLength(3);
  },
);

test('the latest week changing waits for its new predecessor and then reuses the cached older week', async () => {
  values.set('campaign:latest', history(12, 8));
  values.set('campaign:8', history(8, 3));
  values.set('campaign:3', history(3, null));
  const { result } = renderHook(() => useRecentHistory(campaign, true), {
    wrapper: cache.wrapper,
  });
  await waitFor(() => expect(result.current.status).toBe('ready'));
  values.set('campaign:latest', history(20, 12));
  act(() => cache.push());
  await waitFor(() => expect(result.current.status).toBe('loading'));
  expect(result.current.weeks).toEqual([]);
  values.set('campaign:12', history(12, 8));
  act(() => cache.push());
  await waitFor(() =>
    expect(result.current.weeks.map((item) => item.week)).toEqual([20, 12, 8]),
  );
  expect(cache.observed()).toHaveLength(3);
  expect(cache.opened.filter(({ args }) => args.week === 8)).toHaveLength(1);
});

test.each(['latest', '8', '3'])(
  'a live update recovers an initial failure at week %s without retrying',
  async (failedWeek) => {
    values.set('campaign:latest', history(12, 8));
    values.set('campaign:8', history(8, 3));
    values.set('campaign:3', history(3, null));
    const recovered = values.get(`campaign:${failedWeek}`);
    values.set(`campaign:${failedWeek}`, new Error('unavailable'));
    const { result } = renderHook(() => useRecentHistory(campaign, true), {
      wrapper: cache.wrapper,
    });
    await waitFor(() => expect(result.current.status).toBe('failed'));
    values.set(`campaign:${failedWeek}`, recovered);
    act(() => cache.push());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.weeks.map((item) => item.week)).toEqual([12, 8, 3]);
    expect(cache.reads).toHaveLength(3);
    expect(cache.opened).toHaveLength(3);
  },
);

test('disabled history starts no reads; reopening uses live updates received while closed', async () => {
  values.set('campaign:latest', history(12, null));
  const view = renderHook(
    ({ enabled }) => useRecentHistory(campaign, enabled),
    {
      initialProps: { enabled: false },
      wrapper: cache.wrapper,
    },
  );
  expect(view.result.current.status).toBe('idle');
  expect(cache.opened).toHaveLength(0);
  view.rerender({ enabled: true });
  await waitFor(() => expect(view.result.current.status).toBe('ready'));
  view.rerender({ enabled: false });
  expect(view.result.current.weeks).toEqual([]);
  expect(cache.observed()).toHaveLength(0);
  values.set('campaign:latest', history(15, null));
  act(() => cache.push());
  view.rerender({ enabled: true });
  expect(view.result.current.status).toBe('ready');
  expect(view.result.current.weeks.map((item) => item.week)).toEqual([15]);
  expect(cache.opened).toHaveLength(1);
});

test('corrections update the whole cached chain without mixing old and new records', async () => {
  values.set('campaign:latest', history(12, 8));
  values.set('campaign:8', history(8, null));
  const rendered: string[][] = [];
  const { result } = renderHook(
    () => {
      const recent = useRecentHistory(campaign, true);
      rendered.push(recent.weeks.map((item) => item.record.recordId));
      return recent;
    },
    { wrapper: cache.wrapper },
  );
  await waitFor(() => expect(result.current.status).toBe('ready'));
  const latest = history(12, 8);
  latest.effectiveRecordId = latest.record.recordId = 'corrected-12';
  const previous = history(8, null);
  previous.effectiveRecordId = previous.record.recordId = 'corrected-8';
  values.set('campaign:latest', latest);
  values.set('campaign:8', previous);
  rendered.length = 0;
  act(() => cache.push());
  await waitFor(() =>
    expect(result.current.weeks.map((item) => item.record.recordId)).toEqual([
      'corrected-12',
      'corrected-8',
    ]),
  );
  expect(
    rendered.every(
      (records) => records.join(',') === 'corrected-12,corrected-8',
    ),
  ).toBe(true);
  expect(cache.opened).toHaveLength(2);
});
