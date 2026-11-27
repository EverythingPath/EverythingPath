import { act, renderHook } from '@testing-library/react';
import type { Id } from '@convex/_generated/dataModel';
import { beforeEach, expect, test, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import type { CharacterOwner } from '~/lib/character-ownership';
import { useCharacterOwnership } from './use-character-ownership';

const transport = vi.hoisted(() => ({
  ownerLastOperationId: undefined as string | undefined,
  owner: undefined as undefined | null | CharacterOwner,
  members: [] as CharacterOwner[],
  membersStatus: 'Exhausted',
  readOnly: false,
  mutate: vi.fn(),
  loadMore: vi.fn(),
  query: vi.fn(),
  paginated: vi.fn(),
}));
vi.mock('convex/react', () => ({
  // The hook's one read is the viewer's own account, for Take ownership.
  useQuery: (...args: unknown[]) => {
    transport.query(...args);
    return args[1] === 'skip' ? undefined : { _id: 'member' };
  },
  useMutation: () => transport.mutate,
  usePaginatedQuery: (...args: unknown[]) => {
    transport.paginated(...args);
    return {
      results: transport.members,
      status: transport.membersStatus,
      loadMore: transport.loadMore,
    };
  },
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({ readOnly: transport.readOnly }),
}));
const characterId = 'character' as Id<'character'>;
const campaignId = 'campaign' as Id<'campaign'>;
const userId = 'member' as Id<'user'>;
const scope = { characterId, campaignId, organizationId: 'org' };
beforeEach(() => {
  vi.clearAllMocks();
  transport.owner = {
    userId: 'old-owner' as Id<'user'>,
    name: 'Ada',
    isMine: false,
  };
  transport.ownerLastOperationId = undefined;
  transport.readOnly = false;
  transport.membersStatus = 'Exhausted';
  transport.members = [{ userId, name: 'Bryn', isMine: true }];
  transport.mutate.mockResolvedValue(null);
});

test('a production campaign keeps assignment and its member picker unavailable', async () => {
  const { result } = renderHook(() =>
    useCharacterOwnership(scope, transport.owner, undefined, false),
  );
  expect(result.current.isAvailable).toBe(false);
  act(() => result.current.setIsPickerOpen(true));
  expect(result.current.isPickerOpen).toBe(false);
  expect(transport.paginated).toHaveBeenLastCalledWith(
    expect.anything(),
    'skip',
    { initialNumItems: 25 },
  );
  await act(async () => {
    expect(await result.current.assignOwner(userId)).toBe(false);
  });
  expect(transport.mutate).not.toHaveBeenCalled();
});

test('losing campaign eligibility closes the open picker and blocks assignment and pagination', async () => {
  const { result, rerender } = renderHook(
    (ownershipAvailable: boolean | undefined) =>
      useCharacterOwnership(
        scope,
        transport.owner,
        undefined,
        ownershipAvailable,
      ),
    { initialProps: true as boolean | undefined },
  );
  act(() => result.current.setIsPickerOpen(true));
  expect(result.current.isPickerOpen).toBe(true);
  transport.membersStatus = 'CanLoadMore';
  rerender(false);
  expect(result.current.isAvailable).toBe(false);
  expect(result.current.isPickerOpen).toBe(false);
  expect(transport.paginated).toHaveBeenLastCalledWith(
    expect.anything(),
    'skip',
    { initialNumItems: 25 },
  );
  result.current.loadMore();
  await act(async () => {
    expect(await result.current.assignOwner(userId)).toBe(false);
  });
  expect(transport.mutate).not.toHaveBeenCalled();
  expect(transport.loadMore).not.toHaveBeenCalled();
  rerender(undefined);
  expect(result.current.isAvailable).toBe(false);
  expect(result.current.isPickerOpen).toBe(false);
});

test('assigning a current member saves immediately and closes the picker after acknowledgement', async () => {
  const { result } = renderHook(() =>
    useCharacterOwnership(
      scope,
      transport.owner,
      transport.ownerLastOperationId,
      true,
    ),
  );
  expect(result.current.ownerLabel).toBe('Ada');
  act(() => result.current.setIsPickerOpen(true));
  await act(async () => {
    expect(await result.current.assignOwner(userId)).toBe(true);
  });
  expect(transport.mutate).toHaveBeenCalledWith({
    ...scope,
    ownerUserId: userId,
    operationId: expect.any(String),
  });
  expect(result.current.isPickerOpen).toBe(false);
  expect(result.current.status.kind).toBe('saved');
});

test('a no-op assignment cannot suppress later remote ownership changes and a name edit is not an owner change', async () => {
  const { result, rerender } = renderHook(() =>
    useCharacterOwnership(
      scope,
      transport.owner,
      transport.ownerLastOperationId,
      true,
    ),
  );
  await act(async () => {
    await result.current.assignOwner('old-owner' as Id<'user'>);
  });
  transport.owner = { userId, name: 'Bryn', isMine: true };
  rerender();
  expect(result.current.hasRemoteChange).toBe(true);
  act(() => result.current.dismissRemoteChange());
  transport.owner = {
    userId: 'old-owner' as Id<'user'>,
    name: 'Ada',
    isMine: false,
  };
  rerender();
  expect(result.current.hasRemoteChange).toBe(true);
  act(() => result.current.dismissRemoteChange());
  transport.owner = {
    userId: 'old-owner' as Id<'user'>,
    name: 'Ada renamed',
    isMine: false,
  };
  rerender();
  expect(result.current.ownerLabel).toBe('Ada renamed');
  expect(result.current.hasRemoteChange).toBe(false);
});

test.each([
  [
    new ConvexError('Choose a current campaign member'),
    "Owner wasn't changed: Choose a current campaign member. Try again.",
  ],
  [
    new Error('Disconnected'),
    'Owner may have changed. Check the current owner before trying again.',
  ],
])(
  'a failed assignment retains its picker and reports the save outcome',
  async (error, message) => {
    transport.mutate.mockRejectedValue(error);
    const { result } = renderHook(() =>
      useCharacterOwnership(
        scope,
        transport.owner,
        transport.ownerLastOperationId,
        true,
      ),
    );
    act(() => result.current.setIsPickerOpen(true));
    await act(async () => {
      expect(await result.current.assignOwner(userId)).toBe(false);
    });
    expect(result.current.isPickerOpen).toBe(true);
    expect(result.current.status).toEqual({ kind: 'error', message });
  },
);

test('private, loading and maintenance views cannot assign and empty filtered pages still offer more members', async () => {
  const { result, rerender } = renderHook(
    (props) => useCharacterOwnership(props, transport.owner, undefined, true),
    { initialProps: scope },
  );
  transport.members = [];
  transport.membersStatus = 'CanLoadMore';
  rerender(scope);
  act(() => result.current.setIsPickerOpen(true));
  result.current.loadMore();
  expect(transport.loadMore).toHaveBeenCalledWith(25);
  expect(result.current.candidates).toEqual([]);
  transport.owner = undefined;
  rerender(scope);
  expect(result.current.isDisabled).toBe(true);
  await act(async () => {
    expect(await result.current.assignOwner(userId)).toBe(false);
  });
  transport.owner = null;
  transport.readOnly = true;
  rerender(scope);
  expect(result.current.ownerLabel).toBe('Needs an owner');
  expect(result.current.isDisabled).toBe(true);
  await act(async () => {
    expect(await result.current.assignOwner(userId)).toBe(false);
  });
  expect(transport.mutate).not.toHaveBeenCalled();
  const privateView = renderHook(() =>
    useCharacterOwnership({ characterId }, transport.owner, undefined, true),
  );
  expect(privateView.result.current.isAvailable).toBe(false);
  expect(privateView.result.current.needsOwner).toBe(false);
  expect(transport.query).toHaveBeenLastCalledWith(expect.anything(), 'skip');
  expect(transport.paginated).toHaveBeenLastCalledWith(
    expect.anything(),
    'skip',
    { initialNumItems: 25 },
  );
});

test('pending writes disable duplicate assignment and only another member transition raises the remote notice', async () => {
  let resolve: ((value: null) => void) | undefined;
  transport.mutate.mockReturnValue(
    new Promise<null>((reply) => {
      resolve = reply;
    }),
  );
  const { result, rerender } = renderHook(() =>
    useCharacterOwnership(
      scope,
      transport.owner,
      transport.ownerLastOperationId,
      true,
    ),
  );
  let save: Promise<boolean> | undefined;
  act(() => {
    save = result.current.assignOwner(userId);
  });
  expect(result.current.isDisabled).toBe(true);
  await act(async () => {
    expect(await result.current.assignOwner(userId)).toBe(false);
  });
  transport.owner = { userId, name: 'Bryn', isMine: true };
  transport.ownerLastOperationId =
    transport.mutate.mock.calls[0]?.[0].operationId;
  rerender();
  expect(result.current.hasRemoteChange).toBe(false);
  await act(async () => {
    resolve?.(null);
    expect(await save).toBe(true);
  });
  transport.owner = null;
  rerender();
  expect(result.current.ownerLabel).toBe('Needs an owner');
  expect(result.current.hasRemoteChange).toBe(true);
  act(() => result.current.dismissRemoteChange());
  expect(result.current.hasRemoteChange).toBe(false);
});

test('an overwritten assignment cannot hide a later return to its requested owner', async () => {
  const { result, rerender } = renderHook(() =>
    useCharacterOwnership(
      scope,
      transport.owner,
      transport.ownerLastOperationId,
      true,
    ),
  );
  await act(async () => {
    await result.current.assignOwner(userId);
  });
  transport.owner = {
    userId: 'another-member' as Id<'user'>,
    name: 'Cyra',
    isMine: false,
  };
  rerender();
  expect(result.current.hasRemoteChange).toBe(true);
  act(() => result.current.dismissRemoteChange());
  transport.owner = { userId, name: 'Bryn', isMine: true };
  rerender();
  expect(result.current.hasRemoteChange).toBe(true);
});

test('an assignment overwritten back to the original owner before acknowledgement cannot hide a future remote change', async () => {
  const { result, rerender } = renderHook(() =>
    useCharacterOwnership(
      scope,
      transport.owner,
      transport.ownerLastOperationId,
      true,
    ),
  );
  await act(async () => {
    await result.current.assignOwner(userId);
  });
  expect(result.current.ownerLabel).toBe('Ada');
  transport.owner = { userId, name: 'Bryn', isMine: true };
  rerender();
  expect(result.current.hasRemoteChange).toBe(true);
});

test('a late assignment reply cannot change another scope picker, save label or remote notice', async () => {
  let resolve: ((value: null) => void) | undefined;
  transport.mutate.mockReturnValue(
    new Promise<null>((reply) => {
      resolve = reply;
    }),
  );
  const { result, rerender } = renderHook(
    (props) => useCharacterOwnership(props, transport.owner, undefined, true),
    { initialProps: scope },
  );
  let save: Promise<boolean> | undefined;
  act(() => {
    save = result.current.assignOwner(userId);
  });
  rerender({ ...scope, characterId: 'another-character' as Id<'character'> });
  act(() => result.current.setIsPickerOpen(true));
  await act(async () => {
    resolve?.(null);
    expect(await save).toBe(true);
  });
  expect(result.current.status.kind).toBe('idle');
  expect(result.current.isPickerOpen).toBe(true);
  transport.owner = { userId, name: 'Bryn', isMine: true };
  rerender({ ...scope, characterId: 'another-character' as Id<'character'> });
  expect(result.current.hasRemoteChange).toBe(true);
});

test('an independent campaign sheet can assign with its persisted campaign and no selected organization', async () => {
  const independent = { characterId, campaignId };
  const { result } = renderHook(() =>
    useCharacterOwnership(independent, transport.owner, undefined, true),
  );
  expect(result.current.isAvailable).toBe(true);
  act(() => result.current.setIsPickerOpen(true));
  expect(transport.paginated).toHaveBeenLastCalledWith(
    expect.anything(),
    { campaignId, organizationId: undefined },
    { initialNumItems: 25 },
  );
  await act(async () => {
    expect(await result.current.assignOwner(userId)).toBe(true);
  });
  expect(transport.mutate).toHaveBeenCalledWith({
    ...independent,
    organizationId: undefined,
    ownerUserId: userId,
    operationId: expect.any(String),
  });
});

test('the owner projection marks the current player without a profile subscription', () => {
  transport.owner = { userId, name: 'Bryn', isMine: true };
  const { result } = renderHook(() =>
    useCharacterOwnership(
      scope,
      transport.owner,
      transport.ownerLastOperationId,
      true,
    ),
  );
  expect(result.current.isMine).toBe(true);
  expect(result.current.needsOwner).toBe(false);
  expect(transport.query).not.toHaveBeenCalledWith(expect.anything(), {});
});

test('a Character nobody owns reads the viewer’s account and is taken with it', async () => {
  transport.owner = null;
  const { result } = renderHook(() =>
    useCharacterOwnership(scope, transport.owner, undefined, true),
  );
  expect(result.current.needsOwner).toBe(true);
  expect(result.current.isTakeOwnershipDisabled).toBe(false);
  expect(transport.query).toHaveBeenCalledWith(expect.anything(), {});
  await act(async () => {
    expect(await result.current.takeOwnership()).toBe(true);
  });
  expect(transport.mutate).toHaveBeenCalledWith({
    ...scope,
    ownerUserId: 'member',
    operationId: expect.any(String),
  });
  expect(result.current.status).toEqual({ kind: 'saved' });
});

test('a production campaign’s ownerless Character needs no owner here and reads no account', () => {
  transport.owner = null;
  const { result } = renderHook(() =>
    useCharacterOwnership(scope, transport.owner, undefined, false),
  );
  expect(result.current.needsOwner).toBe(false);
  expect(result.current.isTakeOwnershipDisabled).toBe(true);
  expect(transport.query).not.toHaveBeenCalledWith(expect.anything(), {});
});

test('another player assigning the requested recipient is still a remote change', async () => {
  let resolve: (() => void) | undefined;
  transport.mutate.mockReturnValue(
    new Promise<void>((reply) => {
      resolve = reply;
    }),
  );
  const { result, rerender } = renderHook(() =>
    useCharacterOwnership(
      scope,
      transport.owner,
      transport.ownerLastOperationId,
      true,
    ),
  );
  let assignment: Promise<boolean> | undefined;
  act(() => {
    assignment = result.current.assignOwner(userId);
  });
  transport.owner = { userId, name: 'Bryn', isMine: true };
  transport.ownerLastOperationId = 'another-player-assignment';
  rerender();
  expect(result.current.hasRemoteChange).toBe(true);
  await act(async () => {
    resolve?.();
    await assignment;
  });
  expect(result.current.hasRemoteChange).toBe(true);
});

test('an old assignment reply cannot retire a new operation after leaving and returning to the same Character', async () => {
  const replies: { resolve: () => void; reject: (error: Error) => void }[] = [];
  transport.mutate.mockImplementation(
    () =>
      new Promise<void>((resolve, reject) => {
        replies.push({ resolve, reject });
      }),
  );
  const { result, rerender } = renderHook(
    (props) =>
      useCharacterOwnership(
        props,
        transport.owner,
        transport.ownerLastOperationId,
        true,
      ),
    { initialProps: scope },
  );
  let oldAssignment: Promise<boolean> | undefined;
  act(() => {
    oldAssignment = result.current.assignOwner(userId);
  });
  rerender({ ...scope, characterId: 'other-character' as Id<'character'> });
  rerender(scope);
  act(() => result.current.setIsPickerOpen(true));
  let currentAssignment: Promise<boolean> | undefined;
  act(() => {
    currentAssignment = result.current.assignOwner(userId);
  });
  await act(async () => {
    replies[0]?.reject(new Error('Disconnected'));
    expect(await oldAssignment).toBe(false);
  });
  expect(result.current.status.kind).toBe('saving');
  expect(result.current.isPickerOpen).toBe(true);
  transport.owner = { userId, name: 'Bryn', isMine: true };
  transport.ownerLastOperationId =
    transport.mutate.mock.calls[1]?.[0].operationId;
  rerender(scope);
  expect(result.current.hasRemoteChange).toBe(false);
  await act(async () => {
    replies[1]?.resolve();
    expect(await currentAssignment).toBe(true);
  });
  expect(result.current.status.kind).toBe('saved');
  expect(result.current.isPickerOpen).toBe(false);
});

test('an own owner projection arriving after mutation acknowledgement is not announced as remote', async () => {
  const { result, rerender } = renderHook(() =>
    useCharacterOwnership(
      scope,
      transport.owner,
      transport.ownerLastOperationId,
      true,
    ),
  );
  await act(async () => {
    await result.current.assignOwner(userId);
  });
  expect(result.current.status.kind).toBe('saved');
  transport.owner = { userId, name: 'Bryn', isMine: true };
  transport.ownerLastOperationId =
    transport.mutate.mock.calls[0]?.[0].operationId;
  rerender();
  expect(result.current.hasRemoteChange).toBe(false);
});

test('an uncertain assignment keeps its failure message while a later own echo updates the owner', async () => {
  transport.mutate.mockRejectedValue(new Error('Disconnected'));
  const { result, rerender } = renderHook(() =>
    useCharacterOwnership(
      scope,
      transport.owner,
      transport.ownerLastOperationId,
      true,
    ),
  );
  await act(async () => {
    expect(await result.current.assignOwner(userId)).toBe(false);
  });
  transport.owner = { userId, name: 'Bryn', isMine: true };
  transport.ownerLastOperationId =
    transport.mutate.mock.calls[0]?.[0].operationId;
  rerender();
  expect(result.current.ownerLabel).toBe('Bryn');
  expect(result.current.status).toEqual({
    kind: 'error',
    message:
      'Owner may have changed. Check the current owner before trying again.',
  });
  expect(result.current.hasRemoteChange).toBe(false);
});

test('returning to a Character recognizes an old own echo without closing or retiring the newer assignment', async () => {
  const replies: (() => void)[] = [];
  transport.mutate.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        replies.push(resolve);
      }),
  );
  const { result, rerender } = renderHook(
    (props) =>
      useCharacterOwnership(
        props,
        transport.owner,
        transport.ownerLastOperationId,
        true,
      ),
    { initialProps: scope },
  );
  let oldAssignment: Promise<boolean> | undefined;
  act(() => {
    oldAssignment = result.current.assignOwner(userId);
  });
  rerender({ ...scope, characterId: 'other-character' as Id<'character'> });
  rerender(scope);
  act(() => result.current.setIsPickerOpen(true));
  const newOwnerId = 'cyra' as Id<'user'>;
  let currentAssignment: Promise<boolean> | undefined;
  act(() => {
    currentAssignment = result.current.assignOwner(newOwnerId);
  });
  await act(async () => {
    replies[0]?.();
    await oldAssignment;
  });
  expect(result.current.status.kind).toBe('saving');
  expect(result.current.isPickerOpen).toBe(true);
  transport.owner = { userId, name: 'Bryn', isMine: true };
  transport.ownerLastOperationId =
    transport.mutate.mock.calls[0]?.[0].operationId;
  rerender(scope);
  expect(result.current.hasRemoteChange).toBe(false);
  expect(result.current.status.kind).toBe('saving');
  expect(result.current.isPickerOpen).toBe(true);
  transport.owner = { userId: newOwnerId, name: 'Cyra', isMine: false };
  transport.ownerLastOperationId =
    transport.mutate.mock.calls[1]?.[0].operationId;
  rerender(scope);
  expect(result.current.hasRemoteChange).toBe(false);
  await act(async () => {
    replies[1]?.();
    await currentAssignment;
  });
  expect(result.current.status.kind).toBe('saved');
  expect(result.current.isPickerOpen).toBe(false);
});
