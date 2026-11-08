import { act, renderHook } from '@testing-library/react';
import type { Id } from '@convex/_generated/dataModel';
import { getFunctionName } from 'convex/server';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import { useCharacterLifecycle } from './use-character-lifecycle';

const characterId = 'character-id' as Id<'character'>;
const archive = vi.fn();
const deletePrivate = vi.fn();

vi.mock('convex/react', () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference) === 'characterSheet:archive'
      ? archive
      : deletePrivate,
}));

beforeEach(() => {
  archive.mockReset();
  deletePrivate.mockReset();
});

test('private deletion tells the sheet host it is pending until the server confirms it is done', async () => {
  let resolveReply: (() => void) | undefined;
  const reply = new Promise<null>((resolve) => {
    resolveReply = () => resolve(null);
  });
  deletePrivate.mockReturnValue(reply);
  const onDeletion = vi.fn();
  const { result } = renderHook(() =>
    useCharacterLifecycle({
      characterId,
      characterName: 'Kesh',
      onDeletion,
    }),
  );
  let deletion: Promise<boolean> | undefined;
  act(() => {
    deletion = result.current.deleteCharacter();
  });
  expect(result.current.status.kind).toBe('saving');
  expect(onDeletion.mock.calls).toEqual([[{ kind: 'pending', name: 'Kesh' }]]);
  await act(async () => {
    resolveReply?.();
    expect(await deletion).toBe(true);
  });
  expect(onDeletion.mock.calls).toEqual([
    [{ kind: 'pending', name: 'Kesh' }],
    [{ kind: 'done', name: 'Kesh' }],
  ]);
  expect(result.current.status.kind).toBe('saved');
});

test.each([
  {
    error: new ConvexError('Deletion refused'),
    message: "Character wasn't deleted: Deletion refused. Try again.",
  },
  {
    error: new Error('Connection lost'),
    message:
      'Character may have been deleted. Reload the page before trying again.',
  },
])(
  'a failed deletion restores the sheet host and reports $message',
  async ({ error, message }) => {
    deletePrivate.mockRejectedValue(error);
    const onDeletion = vi.fn();
    const { result } = renderHook(() =>
      useCharacterLifecycle({
        characterId,
        characterName: 'Kesh',
        onDeletion,
      }),
    );
    await act(async () => {
      expect(await result.current.deleteCharacter()).toBe(false);
    });
    expect(onDeletion.mock.calls).toEqual([
      [{ kind: 'pending', name: 'Kesh' }],
      [{ kind: 'none' }],
    ]);
    expect(result.current.status).toEqual({ kind: 'error', message });
  },
);

test('saving archive state holds one write and does not announce a blocked deletion', async () => {
  let resolveReply: (() => void) | undefined;
  const reply = new Promise<null>((resolve) => {
    resolveReply = () => resolve(null);
  });
  archive.mockReturnValue(reply);
  const onDeletion = vi.fn();
  const campaignId = 'campaign-id' as Id<'campaign'>;
  const { result } = renderHook(() =>
    useCharacterLifecycle({
      organizationId: 'org',
      campaignId,
      characterId,
      characterName: 'Kesh',
      onDeletion,
    }),
  );
  let save: Promise<boolean> | undefined;
  act(() => {
    save = result.current.saveIsActive(false);
  });
  await act(async () => {
    expect(await result.current.deleteCharacter()).toBe(false);
  });
  expect(onDeletion).not.toHaveBeenCalled();
  expect(deletePrivate).not.toHaveBeenCalled();
  expect(archive).toHaveBeenCalledWith({
    organizationId: 'org',
    campaignId,
    characterId,
    operationId: expect.any(String),
    isActive: false,
  });
  expect(result.current.status.kind).toBe('saving');
  await act(async () => {
    resolveReply?.();
    expect(await save).toBe(true);
  });
  expect(result.current.status.kind).toBe('saved');
  expect(onDeletion).not.toHaveBeenCalled();
});
