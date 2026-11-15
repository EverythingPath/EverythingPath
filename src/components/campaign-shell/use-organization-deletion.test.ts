import { act, renderHook } from '@testing-library/react';
import type { FunctionReference } from 'convex/server';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import { api } from '@convex/_generated/api';
import { convexNames } from '../../../tests/convex-names';
import { useOrganizationDeletion } from './use-organization-deletion';

const state = vi.hoisted(() => ({
  deletion: null as unknown,
  activeOrganizationId: 'org' as string | null,
  destroy: vi.fn(),
  request: vi.fn(),
}));
const nameOf = convexNames({
  request: api.organizationDeletions.request,
  status: api.organizationDeletions.status,
});
vi.mock('convex/react', () => ({
  useMutation: (reference: FunctionReference<'mutation'>) => {
    if (nameOf(reference) !== 'request') throw new Error('Unexpected mutation');
    return state.request;
  },
  useQuery: (reference: FunctionReference<'query'>) => {
    if (nameOf(reference) !== 'status') throw new Error('Unexpected query');
    return state.deletion;
  },
}));
vi.mock('@clerk/nextjs', () => ({
  useOrganization: () => ({
    organization: state.activeOrganizationId
      ? { id: state.activeOrganizationId, destroy: state.destroy }
      : null,
  }),
}));

beforeEach(() => {
  state.deletion = null;
  state.activeOrganizationId = 'org';
  state.destroy.mockResolvedValue(undefined);
  state.request.mockResolvedValue({ state: 'preparing' });
});

function render() {
  return renderHook(() => useOrganizationDeletion({ organizationId: 'org' }));
}

test('an admin’s request goes to the server, and a blocked refusal carries its counts', async () => {
  const view = render();
  await act(async () => {
    expect(await view.result.current.submit()).toBe(true);
  });
  expect(state.request).toHaveBeenCalledWith({ organizationId: 'org' });
  state.request.mockRejectedValue(
    new ConvexError({
      code: 'DELETION_BLOCKED',
      message: '1 Character needs an owner.',
      ownerless: 1,
      unreturnable: 0,
    }),
  );
  await act(async () => {
    expect(await view.result.current.submit()).toBe(false);
  });
  expect(view.result.current.status).toEqual({
    kind: 'blocked',
    message: '1 Character needs an owner.',
    ownerless: 1,
    unreturnable: 0,
  });
});

test('finishing deletes the organization with Clerk only once every campaign is deleted and it is the active organization', async () => {
  state.deletion = { state: 'preparing' };
  const view = render();
  expect(view.result.current.canFinish).toBe(false);
  await act(async () => {
    expect(await view.result.current.finish()).toBe(false);
  });

  state.deletion = { state: 'ready' };
  state.activeOrganizationId = 'elsewhere';
  view.rerender();
  expect(view.result.current.canFinish).toBe(false);

  state.activeOrganizationId = 'org';
  view.rerender();
  expect(view.result.current.canFinish).toBe(true);
  await act(async () => {
    expect(await view.result.current.finish()).toBe(true);
  });
  expect(state.destroy).toHaveBeenCalledTimes(1);
  expect(state.request).not.toHaveBeenCalled();
});

test('a failed Clerk deletion is reported for the admin to check before retrying', async () => {
  state.deletion = { state: 'ready' };
  state.destroy.mockRejectedValue(new Error('Network'));
  const view = render();
  await act(async () => {
    expect(await view.result.current.finish()).toBe(false);
  });
  expect(view.result.current.status).toEqual({ kind: 'unknown' });
});
