import { act, renderHook } from '@testing-library/react';
import type { Id } from '@convex/_generated/dataModel';
import { beforeEach, expect, test, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import {
  useCharacterMove,
  type CharacterMoveProgress,
} from './use-character-move';
import { moveOutcomeText, useMoveOutcome } from './use-move-outcome';
import { convexNames } from '../../../tests/convex-names';
import type { FunctionReference } from 'convex/server';
import { api } from '@convex/_generated/api';

type Move = CharacterMoveProgress;
const transport = vi.hoisted(() => ({
  capabilities: undefined as
    | undefined
    | {
        available: boolean;
        isOwner: boolean;
        currentCampaignId?: string;
        destinations: {
          campaignId: string;
          campaignName: string;
          organizationId: string;
        }[];
      },
  move: null as Move | null | undefined,
  preview: {
    moving: [{ characterId: 'hero', name: 'Arden' }],
    staying: [],
    maxGroupSize: 16,
  } as
    | {
        moving: { characterId: string; name: string }[];
        staying: {
          characterId?: string;
          name?: string;
          reason: 'inactive' | 'differentOwner' | 'associated' | 'unavailable';
        }[];
        maxGroupSize: number;
        refusal?: {
          reason: 'groupTooLarge';
          groupSize: number;
          maxGroupSize: number;
        };
      }
    | undefined,
  previewError: null as Error | null,
  /** Status of one named operation, as another device left it. */
  moves: {} as Record<string, Move>,
  readOnly: false,
  readError: null as Error | null,
  start: vi.fn(),
  resume: vi.fn(),
  cancel: vi.fn(),
  inspect: vi.fn(),
  refetch: vi.fn(),
  queryArgs: vi.fn(),
}));
const nameOf = convexNames({
  destinations: api.characterMoves.destinations,
  preview: api.characterMoves.preview,
  status: api.characterMoves.status,
  start: api.characterMoves.start,
  resume: api.characterMoves.resume,
  cancel: api.characterMoves.cancel,
});
vi.mock('convex/react', () => ({
  useMutation: (mutation: FunctionReference<'mutation'>) => {
    const name = nameOf(mutation);
    return name === 'start'
      ? transport.start
      : name === 'cancel'
        ? transport.cancel
        : transport.resume;
  },
  useConvex: () => ({
    query: (query: FunctionReference<'query'>, args: unknown) =>
      transport.inspect(nameOf(query), args),
  }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey: [kind, query, args] }: { queryKey: unknown[] }) => {
    const queryKey = [kind, nameOf(String(query)), args];
    transport.queryArgs(queryKey);
    return {
      data:
        queryKey[1] === 'destinations'
          ? transport.capabilities
          : queryKey[1] === 'preview'
            ? transport.preview
            : args !== 'skip' &&
                typeof args === 'object' &&
                args !== null &&
                'operationId' in args &&
                typeof args.operationId === 'string'
              ? (transport.moves[args.operationId] ?? null)
              : transport.move,
      error:
        queryKey[1] === 'preview'
          ? transport.previewError
          : transport.readError,
      refetch: transport.refetch,
    };
  },
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({ readOnly: transport.readOnly }),
}));

const characterId = 'hero' as Id<'character'>;
const campaignId = 'source' as Id<'campaign'>;
const destinationId = 'destination' as Id<'campaign'>;
const scope = { characterId, campaignId, organizationId: 'org' };

beforeEach(() => {
  vi.clearAllMocks();
  transport.capabilities = {
    available: true,
    isOwner: true,
    currentCampaignId: campaignId,
    destinations: [
      { campaignId, campaignName: 'Current', organizationId: 'org' },
      {
        campaignId: destinationId,
        campaignName: 'Kingmaker',
        organizationId: 'other',
      },
    ],
  };
  transport.move = null;
  transport.preview = {
    moving: [{ characterId, name: 'Arden' }],
    staying: [],
    maxGroupSize: 16,
  };
  transport.previewError = null;
  transport.moves = {};
  transport.readOnly = false;
  transport.readError = null;
  transport.start.mockImplementation(
    async ({ operationId }: { operationId: string }) => ({
      generation: 0,
      operationId,
      state: 'preparing',
      prepared: 2,
      total: 6,
    }),
  );
  transport.resume.mockImplementation(
    async ({ operationId }: { operationId: string }) => ({
      generation: 0,
      operationId,
      state: 'completed',
      prepared: 6,
      total: 6,
    }),
  );
  transport.inspect.mockResolvedValue(null);
});

test('group preview carries accessible companions and preserves anonymous reasons for unavailable Characters', () => {
  transport.preview = {
    moving: [
      { characterId, name: 'Arden' },
      { characterId: 'cohort', name: 'Bryn' },
      { characterId: 'familiar', name: 'Whisper' },
    ],
    staying: [
      { characterId: 'former', name: 'Pip', reason: 'inactive' },
      { reason: 'differentOwner' },
      { reason: 'associated' },
      { reason: 'unavailable' },
    ],
    maxGroupSize: 16,
  };
  const { result } = renderHook(() => useCharacterMove(scope));
  expect(result.current.groupPreview).toEqual(transport.preview);
  expect(result.current.canStart).toBe(true);
});

test('a refused read hides cached group and destination details and disables every move command', async () => {
  transport.move = {
    generation: 0,
    operationId: 'group-move',
    destinationCampaignId: destinationId,
    state: 'preparing',
    prepared: 2,
    total: 6,
  };
  const { result, rerender } = renderHook(() => useCharacterMove(scope));
  expect(result.current.groupPreview?.moving[0]?.name).toBe('Arden');
  transport.readError = new ConvexError('Character access required');
  rerender();
  expect(result.current.groupPreview).toBeNull();
  expect(result.current.progress).toBeNull();
  expect(result.current.destinations).toEqual([]);
  expect(result.current.currentCampaignId).toBeUndefined();
  expect(result.current.pendingDestinationCampaignId).toBeUndefined();
  expect(result.current.departureRoles).toEqual([]);
  await act(async () => {
    expect(await result.current.startMove(destinationId)).toBe(false);
    expect(await result.current.resumeMove()).toBe(false);
    expect(await result.current.cancelMove()).toBe(false);
  });
  expect(transport.start).not.toHaveBeenCalled();
  expect(transport.resume).not.toHaveBeenCalled();
  expect(transport.cancel).not.toHaveBeenCalled();
  expect(result.current.readError).not.toContain('Character access required');
});

test('a group preview must finish loading before a move can start, and a refused preview has a local read retry', async () => {
  transport.preview = undefined;
  const { result, rerender } = renderHook(() => useCharacterMove(scope));
  expect(result.current.isLoading).toBe(true);
  expect(result.current.canStart).toBe(false);
  await act(async () => {
    expect(await result.current.startMove(destinationId)).toBe(false);
  });
  transport.preview = {
    moving: [{ characterId, name: 'Arden' }],
    staying: [],
    maxGroupSize: 16,
  };
  transport.previewError = new ConvexError('Character access required');
  rerender();
  expect(result.current.groupPreview).toBeNull();
  expect(result.current.isLoading).toBe(false);
  expect(result.current.canStart).toBe(false);
  expect(result.current.canReviewMove).toBe(false);
  expect(result.current.destinations).toEqual([]);
  expect(result.current.currentCampaignId).toBeUndefined();
  expect(result.current.departureRoles).toEqual([]);
  expect(result.current.status).toEqual({ kind: 'idle' });
  expect(result.current.readError).toContain('could not be loaded');
  await act(async () => {
    await result.current.retryRead();
  });
  transport.previewError = null;
  rerender();
  expect(result.current.canStart).toBe(true);
  expect(result.current.groupPreview?.moving[0]?.name).toBe('Arden');
  expect(transport.start).not.toHaveBeenCalled();
});

test('two sessions follow whole-group progress and inspect a lost completion without repeating the move', async () => {
  const first = renderHook(() => useCharacterMove(scope));
  const second = renderHook(() => useCharacterMove(scope));
  transport.start.mockImplementationOnce(
    async ({ operationId }: { operationId: string }) => ({
      generation: 0,
      operationId,
      state: 'preparing',
      groupSize: 3,
      completedMembers: 0,
      prepared: 2,
      total: 18,
    }),
  );
  await act(async () => {
    expect(await first.result.current.startMove(destinationId)).toBe(true);
  });
  const operationId = transport.start.mock.calls[0]![0].operationId;
  transport.move = first.result.current.progress;
  second.rerender();
  expect(second.result.current.progress).toMatchObject({
    operationId,
    groupSize: 3,
    completedMembers: 0,
  });
  transport.move = {
    ...transport.move!,
    state: 'ready',
    prepared: 18,
  };
  first.rerender();
  second.rerender();
  expect(first.result.current.progress).toEqual(second.result.current.progress);
  expect(first.result.current.progress?.completedMembers).toBe(0);
  transport.resume.mockRejectedValueOnce(new Error('connection closed'));
  await act(async () => {
    expect(await second.result.current.resumeMove()).toBe(false);
  });
  expect(second.result.current.needsInspection).toBe(true);
  const completed = {
    ...transport.move,
    state: 'completed' as const,
    completedMembers: 3,
  };
  transport.inspect.mockResolvedValueOnce(completed);
  await act(async () => {
    expect(await second.result.current.resumeMove()).toBe(true);
  });
  expect(second.result.current.progress).toEqual(completed);
  expect(transport.start).toHaveBeenCalledTimes(1);
  expect(transport.resume).toHaveBeenCalledTimes(1);
  expect(transport.inspect).toHaveBeenCalledWith('status', {
    characterId,
    operationId,
  });
  transport.move = completed;
  first.rerender();
  expect(first.result.current.progress).toEqual(completed);
  expect(first.result.current.canResume).toBe(false);
});

test('only an eligible current owner can open the picker or start a move', async () => {
  requiredCapabilities().isOwner = false;
  const { result, rerender } = renderHook(() => useCharacterMove(scope));
  expect(result.current.isAvailable).toBe(false);
  act(() => result.current.setIsPickerOpen(true));
  expect(result.current.isPickerOpen).toBe(false);
  await act(async () => {
    expect(await result.current.startMove(destinationId)).toBe(false);
  });
  expect(transport.start).not.toHaveBeenCalled();
  transport.capabilities = undefined;
  rerender();
  expect(result.current.isLoading).toBe(true);
  expect(result.current.isDisabled).toBe(true);
});

test('the destination picker excludes the current campaign and keeps bounded progress until completion', async () => {
  const { result } = renderHook(() => useCharacterMove(scope));
  expect(result.current.destinations).toEqual([
    {
      campaignId: destinationId,
      campaignName: 'Kingmaker',
      organizationId: 'other',
    },
  ]);
  act(() => result.current.setIsPickerOpen(true));
  await act(async () => {
    expect(await result.current.startMove(destinationId)).toBe(true);
  });
  expect(result.current.progress).toMatchObject({
    state: 'preparing',
    prepared: 2,
    total: 6,
  });
  expect(result.current.status.kind).toBe('saved');
  expect(result.current.isPickerOpen).toBe(false);
  expect(result.current.canStart).toBe(false);
  expect(result.current.canResume).toBe(true);
  await act(async () => {
    expect(await result.current.resumeMove()).toBe(true);
  });
  expect(result.current.progress?.state).toBe('completed');
  expect(result.current.canStart).toBe(true);
});

test('a lost reply is inspected before retry and a completed move is acknowledged without another write', async () => {
  transport.start.mockRejectedValueOnce(new Error('connection closed'));
  const { result } = renderHook(() => useCharacterMove(scope));
  await act(async () => {
    expect(await result.current.startMove(destinationId)).toBe(false);
  });
  expect(result.current.status).toMatchObject({
    kind: 'error',
    message: expect.stringContaining('may have been saved'),
  });
  expect(result.current.canStart).toBe(false);
  expect(result.current.canResume).toBe(true);
  const operationId = transport.start.mock.calls[0]![0].operationId;
  transport.inspect.mockResolvedValue({
    generation: 0,
    operationId,
    state: 'completed',
    prepared: 6,
    total: 6,
  });
  await act(async () => {
    expect(await result.current.resumeMove()).toBe(true);
  });
  expect(result.current.progress?.state).toBe('completed');
  expect(result.current.status.kind).toBe('saved');
  expect(transport.start).toHaveBeenCalledTimes(1);
  expect(transport.resume).not.toHaveBeenCalled();
});

test('a refusal stays beside the picker and permits correcting the destination', async () => {
  transport.start.mockRejectedValueOnce(
    new ConvexError('Destination access is required'),
  );
  const { result } = renderHook(() => useCharacterMove(scope));
  act(() => result.current.setIsPickerOpen(true));
  await act(async () => {
    expect(await result.current.startMove(destinationId)).toBe(false);
  });
  expect(result.current.status).toEqual({
    kind: 'error',
    message: "Move wasn't saved: Destination access is required. Try again.",
  });
  expect(result.current.isPickerOpen).toBe(true);
  expect(result.current.needsInspection).toBe(false);
  expect(result.current.canStart).toBe(true);
});

test('a new refused move is not reported as saved because an earlier move completed', async () => {
  transport.move = {
    generation: 0,
    operationId: 'earlier',
    state: 'completed',
    prepared: 6,
    total: 6,
  };
  transport.start.mockRejectedValueOnce(
    new ConvexError('Destination unavailable'),
  );
  const { result } = renderHook(() => useCharacterMove(scope));
  await act(async () => {
    await result.current.startMove(destinationId);
  });
  expect(result.current.status).toMatchObject({
    kind: 'error',
    message: expect.stringContaining('Destination unavailable'),
  });
});

test('leaving targets no campaign, while an invalid destination and private departure are unavailable', async () => {
  const { result, rerender } = renderHook(() => useCharacterMove(scope));
  await act(async () => {
    expect(await result.current.startMove(campaignId)).toBe(false);
    expect(await result.current.startMove('unknown' as Id<'campaign'>)).toBe(
      false,
    );
    expect(await result.current.startMove()).toBe(true);
  });
  expect(transport.start).toHaveBeenCalledWith({
    characterId,
    operationId: expect.any(String),
  });
  requiredCapabilities().currentCampaignId = undefined;
  transport.move = null;
  rerender();
  expect(result.current.canLeave).toBe(false);
});

test('a remounted controller resumes the recorded ready move without starting another', async () => {
  transport.move = {
    generation: 0,
    operationId: 'existing',
    state: 'ready',
    prepared: 6,
    total: 6,
  };
  const { result } = renderHook(() => useCharacterMove(scope));
  expect(result.current.progress?.state).toBe('ready');
  expect(result.current.canStart).toBe(false);
  await act(async () => {
    expect(await result.current.resumeMove()).toBe(true);
  });
  expect(transport.resume).toHaveBeenCalledWith({
    characterId,
    operationId: 'existing',
  });
  expect(transport.start).not.toHaveBeenCalled();
  expect(result.current.progress?.state).toBe('completed');
});

test('a lost start that did not commit retries the same destination and operation after inspection', async () => {
  transport.start.mockRejectedValueOnce(new Error('connection closed'));
  const { result } = renderHook(() => useCharacterMove(scope));
  await act(async () => {
    await result.current.startMove(destinationId);
  });
  const original = transport.start.mock.calls[0]![0];
  await act(async () => {
    expect(await result.current.resumeMove()).toBe(true);
  });
  expect(transport.inspect).toHaveBeenCalledWith('status', {
    characterId,
    operationId: original.operationId,
  });
  expect(transport.start).toHaveBeenLastCalledWith(original);
  expect(transport.resume).not.toHaveBeenCalled();
});

test('an uncertain partial move resumes the inspected operation and never creates another move', async () => {
  transport.move = {
    generation: 0,
    operationId: 'existing',
    state: 'preparing',
    prepared: 2,
    total: 6,
  };
  transport.resume.mockRejectedValueOnce(new Error('connection closed'));
  const { result } = renderHook(() => useCharacterMove(scope));
  await act(async () => {
    await result.current.resumeMove();
  });
  transport.inspect.mockResolvedValue({
    generation: 0,
    operationId: 'existing',
    state: 'ready',
    prepared: 6,
    total: 6,
  });
  await act(async () => {
    expect(await result.current.resumeMove()).toBe(true);
  });
  expect(transport.resume).toHaveBeenLastCalledWith({
    characterId,
    operationId: 'existing',
  });
  expect(transport.start).not.toHaveBeenCalled();
  expect(result.current.progress?.state).toBe('completed');
});

test('failed inspection keeps an uncertain move resumable without replaying a write', async () => {
  transport.start.mockRejectedValueOnce(new Error('connection closed'));
  const { result } = renderHook(() => useCharacterMove(scope));
  await act(async () => {
    await result.current.startMove(destinationId);
  });
  transport.inspect.mockRejectedValueOnce(new Error('still offline'));
  await act(async () => {
    expect(await result.current.resumeMove()).toBe(false);
  });
  expect(result.current.needsInspection).toBe(true);
  expect(result.current.canStart).toBe(false);
  expect(transport.start).toHaveBeenCalledTimes(1);
  expect(transport.resume).not.toHaveBeenCalled();
});

test('a rejected preparation batch leaves its previous progress resumable', async () => {
  transport.move = {
    generation: 0,
    operationId: 'existing',
    state: 'preparing',
    prepared: 2,
    total: 6,
  };
  transport.resume.mockRejectedValueOnce(
    new ConvexError('Source changed; resume'),
  );
  const { result } = renderHook(() => useCharacterMove(scope));
  await act(async () => {
    expect(await result.current.resumeMove()).toBe(false);
  });
  expect(result.current.progress?.prepared).toBe(2);
  expect(result.current.canResume).toBe(true);
  expect(result.current.canStart).toBe(false);
});

test('maintenance and read failures disable writes, and failed reads have a local retry', async () => {
  transport.readOnly = true;
  const { result, rerender } = renderHook(() => useCharacterMove(scope));
  await act(async () => {
    expect(await result.current.startMove(destinationId)).toBe(false);
  });
  transport.readOnly = false;
  transport.readError = new Error('offline');
  rerender();
  expect(result.current.readError).toContain('could not be loaded');
  expect(result.current.isDisabled).toBe(true);
  await act(async () => {
    await result.current.retryRead();
  });
  expect(transport.refetch).toHaveBeenCalled();
  expect(transport.start).not.toHaveBeenCalled();
});

test('a Character change clears picker state and ignores an old reply even after returning to that Character', async () => {
  let finish!: (move: Move) => void;
  transport.start.mockImplementationOnce(
    () =>
      new Promise<Move>((resolve) => {
        finish = resolve;
      }),
  );
  const { result, rerender } = renderHook(
    (id: Id<'character'>) => useCharacterMove({ ...scope, characterId: id }),
    { initialProps: characterId },
  );
  act(() => result.current.setIsPickerOpen(true));
  let pending!: Promise<boolean>;
  act(() => {
    pending = result.current.startMove(destinationId);
  });
  expect(result.current.isBusy).toBe(true);
  rerender('other' as Id<'character'>);
  expect(result.current.isPickerOpen).toBe(false);
  expect(result.current.status.kind).toBe('idle');
  rerender(characterId);
  await act(async () => {
    finish({
      generation: 0,
      operationId: 'old',
      state: 'completed',
      prepared: 6,
      total: 6,
    });
    expect(await pending).toBe(false);
  });
  expect(result.current.progress).toBeNull();
  expect(result.current.status.kind).toBe('idle');
});

test('a second click while a move is saving does not submit another operation', async () => {
  let finish!: (move: Move) => void;
  transport.start.mockImplementationOnce(
    () =>
      new Promise<Move>((resolve) => {
        finish = resolve;
      }),
  );
  const { result } = renderHook(() => useCharacterMove(scope));
  let pending!: Promise<boolean>;
  act(() => {
    pending = result.current.startMove(destinationId);
  });
  await act(async () => {
    expect(await result.current.startMove(destinationId)).toBe(false);
  });
  expect(transport.start).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish({
      generation: 0,
      operationId: 'one',
      state: 'completed',
      prepared: 0,
      total: 0,
    });
    await pending;
  });
});

test('changed source preparation can reset progress without being mistaken for an older reply', async () => {
  const { result, rerender } = renderHook(() => useCharacterMove(scope));
  await act(async () => {
    await result.current.startMove(destinationId);
  });
  const operationId = transport.start.mock.calls[0]![0].operationId;
  transport.move = {
    generation: 1,
    operationId,
    state: 'preparing',
    prepared: 0,
    total: 10,
  };
  rerender();
  expect(result.current.progress).toMatchObject({
    generation: 1,
    prepared: 0,
    total: 10,
  });
  expect(result.current.canResume).toBe(true);
});

test('a reactive completed operation resolves uncertainty while preserving an unrelated refusal', async () => {
  transport.start.mockRejectedValueOnce(new Error('lost reply'));
  const { result, rerender } = renderHook(() => useCharacterMove(scope));
  await act(async () => {
    await result.current.startMove(destinationId);
  });
  const operationId = transport.start.mock.calls[0]![0].operationId;
  transport.move = {
    generation: 0,
    operationId,
    state: 'completed',
    prepared: 6,
    total: 6,
  };
  rerender();
  expect(result.current.needsInspection).toBe(false);
  expect(result.current.status.kind).toBe('saved');
  expect(result.current.canResume).toBe(false);
  expect(result.current.canStart).toBe(true);
});

test('cancelling saved preparation permits a corrected destination without publishing movement', async () => {
  transport.cancel.mockImplementation(
    async ({ operationId }: { operationId: string }) => ({
      generation: 0,
      operationId,
      state: 'cancelled',
      prepared: 2,
      total: 6,
    }),
  );
  const { result } = renderHook(() => useCharacterMove(scope));
  await act(async () => {
    await result.current.startMove(destinationId);
  });
  expect(result.current.canCancel).toBe(true);
  await act(async () => {
    expect(await result.current.cancelMove()).toBe(true);
  });
  expect(result.current.progress?.state).toBe('cancelled');
  expect(result.current.canStart).toBe(true);
  expect(result.current.canResume).toBe(false);
  expect(transport.resume).not.toHaveBeenCalled();
});

test('a newer completed move from another session supersedes local pending preparation', async () => {
  const { result, rerender } = renderHook(() => useCharacterMove(scope));
  await act(async () => {
    await result.current.startMove(destinationId);
  });
  transport.move = {
    generation: 0,
    operationId: 'another-session',
    state: 'completed',
    prepared: 6,
    total: 6,
  };
  rerender();
  expect(result.current.progress?.operationId).toBe('another-session');
  expect(result.current.canStart).toBe(true);
  expect(result.current.canResume).toBe(false);
});

test('the completed move observed before starting cannot overwrite new preparation', async () => {
  transport.move = {
    generation: 0,
    operationId: 'previous',
    state: 'completed',
    prepared: 6,
    total: 6,
  };
  const { result, rerender } = renderHook(() => useCharacterMove(scope));
  await act(async () => {
    await result.current.startMove(destinationId);
  });
  rerender();
  expect(result.current.progress?.state).toBe('preparing');
  expect(result.current.canStart).toBe(false);
});

test('reactive progress observes the latest operation while exact inspection remains reserved for recovery', async () => {
  const { result } = renderHook(() => useCharacterMove(scope));
  await act(async () => {
    await result.current.startMove(destinationId);
  });
  const statusCalls = transport.queryArgs.mock.calls.filter(
    ([key]) => key[1] === 'status' && key[2] !== 'skip',
  );
  expect(statusCalls.length).toBeGreaterThan(0);
  for (const [key] of statusCalls) expect(key[2]).toEqual({ characterId });
});

test.each([
  'Character move exceeds atomic publication limits',
  'Character move exceeds the 1024-reference document limit',
  'Enter a move operation identifier',
])(
  'a technical refusal is explained without exposing server internals: %s',
  async (reason) => {
    const error = new ConvexError(reason);
    transport.start.mockRejectedValueOnce(error);
    const { result } = renderHook(() => useCharacterMove(scope));
    await act(async () => {
      expect(await result.current.startMove(destinationId)).toBe(false);
    });
    expect(result.current.status).toEqual({
      kind: 'error',
      message: reason.includes('limit')
        ? 'This Character is too large to move right now.'
        : 'The move could not be saved. Try again.',
    });
    expect(result.current.operatorStatus).toMatchObject({
      characterId,
      operationId: expect.any(String),
      action: 'start',
      failure: { kind: 'rejected', message: reason },
    });
    expect(result.current.operatorStatus?.error).toBe(error);
  },
);

/** The hook with the outcome a control shows for it. */
function useMoveWithOutcome() {
  const movement = useCharacterMove(scope);
  return { movement, outcome: useMoveOutcome(movement) };
}
async function startWatchedMove(result: {
  current: ReturnType<typeof useMoveWithOutcome>;
}) {
  await act(async () => {
    expect(await result.current.movement.startMove(destinationId)).toBe(true);
  });
  const progress = result.current.movement.progress;
  if (!progress) throw new Error('Missing progress');
  return progress;
}

test('a move replaced from another device is reported here once the newer move is followed, until this device acts', async () => {
  const { result, rerender } = renderHook(useMoveWithOutcome);
  const watched = await startWatchedMove(result);
  // Another device starts a newer move, which replaces this one.
  const newer = {
    generation: 0,
    operationId: 'other-device',
    state: 'preparing' as const,
    prepared: 0,
    total: 6,
  };
  transport.move = newer;
  transport.moves[watched.operationId] = {
    ...watched,
    state: 'cancelled',
    cancelReason: 'replaced',
  };
  rerender();
  rerender();
  expect(result.current.movement.progress).toEqual(newer);
  expect(result.current.movement.replacedMove).toMatchObject({
    operationId: watched.operationId,
    cancelReason: 'replaced',
  });
  expect(result.current.outcome).toBe('replaced');
  expect(transport.queryArgs).toHaveBeenCalledWith([
    'convexQuery',
    'status',
    { characterId, operationId: watched.operationId },
  ]);
  // Continuing the newer move here retires the report.
  await act(async () => {
    await result.current.movement.resumeMove();
  });
  rerender();
  expect(result.current.movement.replacedMove).toBeNull();
});

test('a newer move after one seen to its end here reports no replacement', async () => {
  const { result, rerender } = renderHook(useMoveWithOutcome);
  const watched = await startWatchedMove(result);
  transport.move = { ...watched, state: 'cancelled' };
  rerender();
  expect(result.current.outcome).toBe('cancelled');
  transport.moves[watched.operationId] = {
    ...watched,
    state: 'cancelled',
    cancelReason: 'replaced',
  };
  transport.move = { ...watched, operationId: 'other-device' };
  rerender();
  rerender();
  expect(result.current.movement.replacedMove).toBeNull();
  expect(result.current.outcome).toBeNull();
});

test.each(['ownershipChanged', 'campaignChanged', 'groupChanged'] as const)(
  'a watched move stopped because %s reports that reason and frees the controls',
  async (cancelReason) => {
    const { result, rerender } = renderHook(useMoveWithOutcome);
    const watched = await startWatchedMove(result);
    transport.move = { ...watched, state: 'cancelled', cancelReason };
    rerender();
    expect(result.current.movement.progress).toMatchObject({ cancelReason });
    expect(result.current.outcome).toBe(cancelReason);
    expect(result.current.movement.canStart).toBe(true);
    expect(result.current.movement.canCancel).toBe(false);
    expect(moveOutcomeText[cancelReason]).toContain('nothing moved');
  },
);

test('a move waiting for destination access stays in progress and can be cancelled', async () => {
  const { result, rerender } = renderHook(useMoveWithOutcome);
  const watched = await startWatchedMove(result);
  transport.move = {
    ...watched,
    state: 'waiting',
    waitingReason: 'destinationUnavailable',
  };
  rerender();
  expect(result.current.movement.progress).toMatchObject({ state: 'waiting' });
  expect(result.current.outcome).toBeNull();
  expect(result.current.movement.canStart).toBe(false);
  expect(result.current.movement.canCancel).toBe(true);
  transport.cancel.mockResolvedValueOnce({ ...watched, state: 'cancelled' });
  await act(async () => {
    expect(await result.current.movement.cancelMove()).toBe(true);
  });
  expect(transport.cancel).toHaveBeenCalledWith({
    characterId,
    operationId: watched.operationId,
  });
  expect(result.current.movement.progress?.state).toBe('cancelled');
});

function requiredCapabilities() {
  const capabilities = transport.capabilities;
  if (!capabilities) throw new Error('Missing move capabilities');
  return capabilities;
}

test('an oversized group remains readable for review, but joining and leaving are refused without a write', async () => {
  transport.preview = {
    moving: [],
    staying: [],
    maxGroupSize: 16,
    refusal: { reason: 'groupTooLarge', groupSize: 17, maxGroupSize: 16 },
  };
  const { result, rerender } = renderHook(() => useCharacterMove(scope));
  expect(result.current.isAvailable).toBe(true);
  expect(result.current.isLoading).toBe(false);
  expect(result.current.canReviewMove).toBe(true);
  expect(result.current.canStart).toBe(false);
  expect(result.current.canLeave).toBe(false);
  expect(result.current.groupPreview).toEqual(transport.preview);
  expect(result.current.readError).toBeNull();
  expect(result.current.destinations).toHaveLength(1);
  await act(async () => {
    result.current.setIsPickerOpen(true);
    expect(await result.current.startMove(destinationId)).toBe(false);
    expect(await result.current.startMove()).toBe(false);
  });
  expect(result.current.isPickerOpen).toBe(true);
  expect(transport.start).not.toHaveBeenCalled();

  // Interrupting a Relationship makes the shared preview movable again.
  transport.preview = {
    moving: [{ characterId, name: 'Arden' }],
    staying: [],
    maxGroupSize: 16,
  };
  rerender();
  expect(result.current.canStart).toBe(true);
  expect(result.current.canLeave).toBe(true);
});

test('losing access hides a cached group-cap refusal and closes its picker', async () => {
  transport.preview = {
    moving: [],
    staying: [],
    maxGroupSize: 16,
    refusal: { reason: 'groupTooLarge', groupSize: 17, maxGroupSize: 16 },
  };
  const { result, rerender } = renderHook(() => useCharacterMove(scope));
  await act(async () => result.current.setIsPickerOpen(true));
  requiredCapabilities().isOwner = false;
  rerender();
  expect(result.current.groupPreview).toBeNull();
  expect(result.current.canReviewMove).toBe(false);
  expect(result.current.isPickerOpen).toBe(false);
  expect(result.current.destinations).toEqual([]);
});
