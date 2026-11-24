import { act, renderHook } from '@testing-library/react';
import type { FunctionReference } from 'convex/server';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { convexNames } from '../../../tests/convex-names';
import { useCampaignDeletion } from './use-campaign-deletion';

const state = vi.hoisted(() => ({
  deletion: null as unknown,
  sent: [] as {
    args: unknown;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
  }[],
  queries: [] as unknown[],
}));
const nameOf = convexNames({
  request: api.campaignDeletions.request,
  status: api.campaignDeletions.status,
});
vi.mock('convex/react', () => ({
  useMutation: (reference: FunctionReference<'mutation'>) => {
    if (nameOf(reference) !== 'request') throw new Error('Unexpected mutation');
    return (args: unknown) =>
      new Promise((resolve, reject) =>
        state.sent.push({ args, resolve, reject }),
      );
  },
  useQuery: (reference: FunctionReference<'query'>, args: unknown) => {
    if (nameOf(reference) !== 'status') throw new Error('Unexpected query');
    state.queries.push(args);
    return state.deletion;
  },
}));

beforeEach(() => {
  state.deletion = null;
  state.sent = [];
  state.queries = [];
});

const alpha = 'alpha' as Id<'campaign'>;
const beta = 'beta' as Id<'campaign'>;

function render(campaignId = alpha) {
  return renderHook(
    ({ campaignId }) =>
      useCampaignDeletion({ campaignId, organizationId: 'org' }),
    { initialProps: { campaignId } },
  );
}

test('a request goes out once for its campaign and reads that campaign’s deletion', async () => {
  const view = render();
  let first: Promise<boolean> | undefined;
  let second: Promise<boolean> | undefined;
  act(() => {
    first = view.result.current.submit();
    second = view.result.current.submit();
  });
  expect(view.result.current.status).toEqual({ kind: 'pending' });
  expect(await second).toBe(false);
  expect(state.sent.map(({ args }) => args)).toEqual([
    { campaignId: alpha, organizationId: 'org' },
  ]);
  expect(state.queries.at(-1)).toEqual({ campaignId: alpha });
  await act(async () => {
    state.sent[0]?.resolve({ state: 'returning' });
    expect(await first).toBe(true);
  });
  expect(view.result.current.status).toEqual({ kind: 'idle' });
});

test('a refusal while Characters need an owner carries the counts the server gave', async () => {
  const view = render();
  let result: Promise<boolean> | undefined;
  act(() => {
    result = view.result.current.submit();
  });
  await act(async () => {
    state.sent[0]?.reject(
      new ConvexError({
        code: 'DELETION_BLOCKED',
        message: '2 Characters need an owner.',
        ownerless: 2,
        unreturnable: 0,
      }),
    );
    expect(await result).toBe(false);
  });
  expect(view.result.current.status).toEqual({
    kind: 'blocked',
    message: '2 Characters need an owner.',
    ownerless: 2,
    unreturnable: 0,
  });
});

test('other refusals read as refusals, and an unconfirmed outcome is reported as unknown', async () => {
  const view = render();
  for (const [error, status] of [
    [
      new ConvexError("Deleting isn't available for this campaign yet."),
      {
        kind: 'rejected',
        message: "Deleting isn't available for this campaign yet.",
      },
    ],
    [new Error('Connection lost'), { kind: 'unknown' }],
  ] as const) {
    let result: Promise<boolean> | undefined;
    act(() => {
      result = view.result.current.submit();
    });
    await act(async () => {
      state.sent.at(-1)?.reject(error);
      expect(await result).toBe(false);
    });
    expect(view.result.current.status).toEqual(status);
  }
});

test('the deletion’s state says whether it is under way or done, and a new campaign starts afresh', async () => {
  state.deletion = { state: 'blocked' };
  const view = render();
  expect(view.result.current).toMatchObject({
    isUnderWay: true,
    isDeleted: false,
  });
  state.deletion = { state: 'deleted' };
  view.rerender({ campaignId: alpha });
  expect(view.result.current).toMatchObject({
    isUnderWay: false,
    isDeleted: true,
  });

  let result: Promise<boolean> | undefined;
  act(() => {
    result = view.result.current.submit();
  });
  view.rerender({ campaignId: beta });
  expect(view.result.current.status).toEqual({ kind: 'idle' });
  await act(async () => {
    state.sent[0]?.reject(new ConvexError('Refused'));
    await result;
  });
  expect(view.result.current.status).toEqual({ kind: 'idle' });
});
