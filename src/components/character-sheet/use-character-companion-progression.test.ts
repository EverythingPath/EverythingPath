import { act, renderHook } from '@testing-library/react';
import { getFunctionName } from 'convex/server';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildSheet } from './character-sheet-test-fixture';
import { useCharacterCompanionProgression } from './use-character-companion-progression';
import type { CharacterSheetSnapshot } from './use-character-sheet';

const server = vi.hoisted(() => ({ write: vi.fn(), readOnly: false }));
vi.mock('convex/react', () => ({
  useMutation:
    (reference: Parameters<typeof getFunctionName>[0]) => (args: unknown) =>
      server.write(getFunctionName(reference), args),
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({ readOnly: server.readOnly }),
}));

beforeEach(() => {
  server.readOnly = false;
  server.write.mockReset().mockResolvedValue(null);
});

test('Companion Progression saves on the viewed Character with local failure and retry feedback', async () => {
  const snapshot = buildSheet();
  const { result } = renderHook(() =>
    useCharacterCompanionProgression(
      { characterId: snapshot.character._id },
      snapshot,
    ),
  );
  const progression = {
    species: 'wolf' as const,
    hpGained: 27,
    skillRanks: { 'skill.per': 3 },
    abilityIncreases: ['strength' as const],
    advancementChoice: 'species' as const,
    keep: false,
  };
  server.write.mockRejectedValueOnce(new Error('Connection lost'));
  await act(async () =>
    expect(await result.current.save(progression)).toBe(false),
  );
  expect(result.current.status).toEqual({
    kind: 'error',
    message:
      'Companion Progression may not have been saved. Check it before trying again.',
  });
  await act(async () =>
    expect(await result.current.save(progression)).toBe(true),
  );
  expect(server.write).toHaveBeenLastCalledWith(
    'characterSheet:setCompanionProgression',
    expect.objectContaining({
      characterId: snapshot.character._id,
      progression,
    }),
  );
  expect(result.current.status).toEqual({ kind: 'saved' });
});

test('Companion Progression cannot save during maintenance or while its sheet is unavailable', async () => {
  const snapshot = buildSheet();
  server.readOnly = true;
  const initialProps: { sheet: CharacterSheetSnapshot | undefined } = {
    sheet: snapshot,
  };
  const { result, rerender } = renderHook(
    ({ sheet }) =>
      useCharacterCompanionProgression(
        { characterId: snapshot.character._id },
        sheet,
      ),
    { initialProps },
  );
  expect(result.current.isReadOnly).toBe(true);
  await act(async () => expect(await result.current.save(null)).toBe(false));
  server.readOnly = false;
  rerender({ sheet: undefined });
  expect(result.current.isLoading).toBe(true);
  expect(result.current.isDisabled).toBe(true);
  await act(async () => expect(await result.current.save(null)).toBe(false));
  expect(server.write).not.toHaveBeenCalled();
});

test('a save acknowledgement for a previous sheet context does not mark the next context saved', async () => {
  const snapshot = buildSheet();
  let acknowledge: () => void = () => undefined;
  server.write.mockImplementationOnce(
    () => new Promise<void>((resolve) => (acknowledge = resolve)),
  );
  const { result, rerender } = renderHook(
    ({ sheet }) =>
      useCharacterCompanionProgression(
        { characterId: sheet.character._id },
        sheet,
      ),
    { initialProps: { sheet: snapshot } },
  );
  let saving: Promise<boolean>;
  act(() => {
    saving = result.current.save(null);
  });
  expect(result.current.status.kind).toBe('saving');
  const next = buildSheet({ name: 'Next Companion' });
  rerender({ sheet: { ...next, campaign: null } });
  await act(async () => {
    acknowledge();
    await saving;
  });
  expect(result.current.status.kind).toBe('idle');
});

test('an eidolon’s choices save through the same Companion Progression writer and expose the evolution picker', async () => {
  const snapshot = buildSheet();
  const { result } = renderHook(() =>
    useCharacterCompanionProgression(
      { characterId: snapshot.character._id },
      snapshot,
    ),
  );
  expect(result.current.eidolon).toBeNull();
  expect(result.current.eidolonBaseForms.map(({ label }) => label)).toEqual([
    'Biped',
    'Quadruped',
    'Serpentine',
  ]);
  expect(result.current.evolutionCatalog).toHaveLength(49);
  const progression = result.current.newEidolon('serpentine');
  await act(async () =>
    expect(await result.current.save(progression)).toBe(true),
  );
  expect(server.write).toHaveBeenLastCalledWith(
    'characterSheet:setCompanionProgression',
    expect.objectContaining({
      progression: expect.objectContaining({
        kind: 'eidolon',
        baseForm: 'serpentine',
        evolutions: [],
      }),
    }),
  );
});
