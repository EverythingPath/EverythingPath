import { act, renderHook } from '@testing-library/react';
import type { Id } from '@convex/_generated/dataModel';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import { defaultAbilityScores as scores } from '~/lib/character-sheet';
import { useBuildOutCharacter } from './use-build-out-character';

let readOnly = false;
type Call = {
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
let calls: Call[] = [];
vi.mock('convex/react', () => ({
  useMutation: () => (args: Record<string, unknown>) =>
    new Promise((resolve, reject) => calls.push({ args, resolve, reject })),
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({
    kind: readOnly ? 'maintenance' : 'ready',
    readOnly,
    message: '',
  }),
}));

beforeEach(() => {
  calls = [];
  readOnly = false;
});

test('Build out waits once and returns the same Character identity to open its sheet', async () => {
  const characterId = 'hessa' as Id<'character'>;
  const view = renderHook(() =>
    useBuildOutCharacter({ organizationId: 'org' }),
  );
  let pending: Promise<Id<'character'> | null> | undefined;
  act(() => {
    pending = view.result.current.run({
      _id: characterId,
      sheetMode: 'militiaOnly',
      ...scores,
      level: 1,
    });
  });
  expect(view.result.current.status.kind).toBe('saving');
  expect(view.result.current.characterId).toBe(characterId);
  await act(async () => {
    expect(
      await view.result.current.run({
        _id: characterId,
        sheetMode: 'militiaOnly',
        ...scores,
        level: 1,
      }),
    ).toBeNull();
  });
  expect(calls).toHaveLength(1);
  expect(calls[0]?.args).toMatchObject({ organizationId: 'org', characterId });
  await act(async () => {
    calls[0]?.resolve(characterId);
    expect(await pending).toBe(characterId);
  });
  expect(view.result.current.status.kind).toBe('saved');
});

test('Build out reports a refused change without losing the Character or opening another sheet', async () => {
  const characterId = 'hessa' as Id<'character'>;
  const view = renderHook(() =>
    useBuildOutCharacter({ organizationId: 'org' }),
  );
  let pending: Promise<Id<'character'> | null> | undefined;
  act(() => {
    pending = view.result.current.run({
      _id: characterId,
      sheetMode: 'militiaOnly',
      ...scores,
      level: 1,
    });
  });
  await act(async () => {
    calls[0]?.reject(new ConvexError('Character is unavailable'));
    expect(await pending).toBeNull();
  });
  expect(view.result.current.status).toEqual({
    kind: 'error',
    message: "Character wasn't built out: Character is unavailable. Try again.",
  });
  expect(view.result.current.characterId).toBe(characterId);
});

test('Build out remains read-only during initial-migration maintenance', async () => {
  readOnly = true;
  const view = renderHook(() =>
    useBuildOutCharacter({ organizationId: 'org' }),
  );
  await act(async () => {
    expect(
      await view.result.current.run({
        _id: 'hessa' as Id<'character'>,
        sheetMode: 'militiaOnly',
        ...scores,
        level: 1,
      }),
    ).toBeNull();
  });
  expect(calls).toHaveLength(0);
  expect(view.result.current.maintenance.readOnly).toBe(true);
  expect(view.result.current.status.kind).toBe('idle');
});

test('Build out preserves asserted campaign scope and omits private scope', async () => {
  const characterId = 'hessa' as Id<'character'>;
  const campaignId = 'campaign' as Id<'campaign'>;
  const campaign = renderHook(() =>
    useBuildOutCharacter({ organizationId: 'org', campaignId }),
  );
  let pending: Promise<Id<'character'> | null> | undefined;
  act(() => {
    pending = campaign.result.current.run({
      _id: characterId,
      sheetMode: 'militiaOnly',
      ...scores,
      level: 1,
    });
  });
  expect(calls[0]?.args).toMatchObject({
    organizationId: 'org',
    campaignId,
    characterId,
  });
  await act(async () => {
    calls[0]?.resolve(null);
    await pending;
  });
  const privateSheet = renderHook(() => useBuildOutCharacter({}));
  act(() => {
    pending = privateSheet.result.current.run({
      _id: characterId,
      sheetMode: 'militiaOnly',
      ...scores,
      level: 1,
    });
  });
  expect(calls[1]?.args).toEqual({
    characterId,
    operationId: expect.any(String),
  });
  await act(async () => {
    calls[1]?.resolve(null);
    await pending;
  });
});

test('Build out refuses full and unavailable Characters without writing', async () => {
  const view = renderHook(() =>
    useBuildOutCharacter({ organizationId: 'org' }),
  );
  await act(async () => {
    expect(
      await view.result.current.run({
        _id: 'hessa' as Id<'character'>,
        sheetMode: 'full',
        ...scores,
        level: 1,
      }),
    ).toBeNull();
    expect(await view.result.current.run(undefined)).toBeNull();
  });
  expect(calls).toEqual([]);
  expect(view.result.current.status.kind).toBe('idle');
});
