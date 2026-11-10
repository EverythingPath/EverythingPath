import { act, renderHook } from '@testing-library/react';
import { getFunctionName } from 'convex/server';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildSheet } from './character-sheet-test-fixture';
import { useCharacterSheetRaces } from './use-character-sheet-races';

const writes = vi.hoisted(() => ({
  race: vi.fn(),
  ability: vi.fn(),
  selected: vi.fn(),
  replacements: vi.fn(),
  grant: vi.fn(),
  selection: vi.fn(),
  statistics: vi.fn(),
  discard: vi.fn(),
}));
vi.mock('convex/react', () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    ({
      'characterSheet:selectRace': writes.race,
      'characterSheet:chooseRacialAbilityScore': writes.ability,
      'characterSheet:setRacialTraitSelected': writes.selected,
      'characterSheet:setRacialTraitReplacements': writes.replacements,
      'characterSheet:editGrantState': writes.grant,
      'characterSheet:editSelection': writes.selection,
      'characterSheet:editRaceStatistics': writes.statistics,
      'characterSheet:discardRaceStatistics': writes.discard,
    })[getFunctionName(reference)],
}));
beforeEach(() =>
  Object.values(writes).forEach((write) =>
    write.mockReset().mockResolvedValue(null),
  ),
);

test('HP and rank writes preserve the form’s exact null progression payload', async () => {
  const snapshot = buildSheet();
  const entryId = snapshot.entries[0]?._id;
  if (!entryId) throw new Error('Missing sheet entry');
  const { result } = renderHook(() =>
    useCharacterSheetRaces({ characterId: snapshot.character._id }, snapshot),
  );
  await act(async () => {
    expect(
      await result.current.editStatistics(entryId, {
        racialHitDice: 0,
        racialHpGained: 12,
        racialSkillRanks: { per: 2 },
        racialProgression: null,
      }),
    ).toBe(true);
  });
  expect(writes.statistics).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    entryId,
    racialHitDice: 0,
    racialHpGained: 12,
    racialSkillRanks: { per: 2 },
    racialProgression: null,
  });
});

test('racial statistics save the edited progression and zero-HD count together with local acknowledgement', async () => {
  const snapshot = buildSheet();
  const entryId = snapshot.entries[0]?._id;
  if (!entryId) throw new Error('Missing sheet entry');
  const view = renderHook(() =>
    useCharacterSheetRaces({ characterId: snapshot.character._id }, snapshot),
  );
  await act(async () => {
    expect(
      await view.result.current.editStatistics(entryId, {
        racialHitDice: 0,
        racialHpGained: null,
        racialProgression: {
          creatureType: 'Custom type',
          hitDie: 7,
          bab: 'half',
          saves: { fort: 'poor', ref: 'good', will: 'poor' },
          skillRanksPerHitDie: 9,
          classSkills: ['per'],
        },
      }),
    ).toBe(true);
  });
  expect(writes.statistics).toHaveBeenCalledWith(
    expect.objectContaining({
      entryId,
      racialHitDice: 0,
      racialHpGained: null,
      racialProgression: expect.objectContaining({
        creatureType: 'Custom type',
        hitDie: 7,
        classSkills: ['per'],
      }),
    }),
  );
  expect(view.result.current.statusFor(entryId)).toEqual({ kind: 'saved' });
});

test('discarding custom racial statistics names the race row and acknowledges it there', async () => {
  const snapshot = buildSheet();
  const entryId = snapshot.entries[0]?._id;
  if (!entryId) throw new Error('Missing sheet entry');
  const view = renderHook(() =>
    useCharacterSheetRaces({ characterId: snapshot.character._id }, snapshot),
  );
  await act(async () => {
    expect(await view.result.current.discardStatistics(entryId)).toBe(true);
  });
  expect(writes.discard).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    entryId,
  });
  expect(view.result.current.statusFor(entryId)).toEqual({ kind: 'saved' });
});

test('race and ability controls acknowledge saving independently using durable Grant Keys', async () => {
  let finish: (() => void) | undefined;
  writes.race.mockImplementation(
    () =>
      new Promise<null>((resolve) => {
        finish = () => resolve(null);
      }),
  );
  const snapshot = buildSheet();
  const view = renderHook(() =>
    useCharacterSheetRaces({ characterId: snapshot.character._id }, snapshot),
  );
  let save: Promise<boolean> | undefined;
  act(() => {
    save = view.result.current.selectRace(null);
  });
  expect(view.result.current.statusFor('race')).toEqual({ kind: 'saving' });
  expect(view.result.current.statusFor('bonus')).toEqual({ kind: 'idle' });
  const grantKey = { source: 'human', entry: 'ability' };
  await act(async () => {
    expect(
      await view.result.current.chooseAbilityScore(
        { grantKey },
        'constitution',
        'bonus',
      ),
    ).toBe(true);
  });
  expect(writes.ability).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    target: { grantKey },
    ability: 'constitution',
  });
  await act(async () => {
    finish?.();
    expect(await save).toBe(true);
  });
  expect(view.result.current.statusFor('race')).toEqual({ kind: 'saved' });
});

test('a failed race change leaves the read state available and permits retry', async () => {
  writes.race.mockRejectedValueOnce(new ConvexError('Character is read only'));
  const snapshot = buildSheet();
  const { result } = renderHook(() =>
    useCharacterSheetRaces({ characterId: snapshot.character._id }, snapshot),
  );
  await act(async () => {
    expect(await result.current.selectRace(null)).toBe(false);
  });
  expect(result.current.statusFor('race')).toEqual({
    kind: 'error',
    message: "Race wasn't saved: Character is read only. Try again.",
  });
  await act(async () => {
    expect(await result.current.selectRace(null)).toBe(true);
  });
  expect(result.current.statusFor('race')).toEqual({ kind: 'saved' });
});

test('unrelated base edits do not announce a race change while another player’s trait edit does', () => {
  const initial = buildSheet();
  const firstCatalog = initial.catalogEntries[0];
  if (!firstCatalog) throw new Error('Missing catalog fixture');
  const view = renderHook(
    ({ snapshot }) =>
      useCharacterSheetRaces({ characterId: initial.character._id }, snapshot),
    { initialProps: { snapshot: initial } },
  );
  view.rerender({
    snapshot: buildSheet({
      scores: {
        strength: 14,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      lastOperationId: 'other-player',
    }),
  });
  expect(view.result.current.hasRemoteChange).toBe(false);
  view.rerender({
    snapshot: {
      ...initial,
      lastOperationId: 'another-player',
      catalogEntries: [
        {
          ...firstCatalog,
          detail: { kind: 'race', racialTraits: [] },
        },
        ...initial.catalogEntries.slice(1),
      ],
    },
  });
  expect(view.result.current.hasRemoteChange).toBe(true);
  act(() => view.result.current.dismissRemoteChange());
  expect(view.result.current.hasRemoteChange).toBe(false);
});

test('race equivalence records a choice on the source Grant', async () => {
  const snapshot = buildSheet();
  const view = renderHook(() =>
    useCharacterSheetRaces({ characterId: snapshot.character._id }, snapshot),
  );
  const grantKey = { source: 'half-elf', entry: 'heritage' };
  await act(async () => {
    expect(
      await view.result.current.chooseRaceEquivalence(
        { grantKey },
        'elf',
        'heritage',
      ),
    ).toBe(true);
  });
  expect(writes.grant).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    grantKey,
    state: { choice: 'elf' },
  });
});

test('an equivalence definition on a nonracial entry announces a change even when its current contribution is unchanged', () => {
  const snapshot = buildSheet({
    adjustments: [{ id: 'heritage', name: 'Heritage', modifiers: [] }],
  });
  const initial = {
    ...snapshot,
    catalogEntries: snapshot.catalogEntries.map((entry) =>
      entry.name === 'Heritage'
        ? { ...entry, countsAsRaces: { oneOf: ['human', 'orc'] } }
        : entry,
    ),
  };
  const view = renderHook(
    ({ snapshot }) =>
      useCharacterSheetRaces({ characterId: initial.character._id }, snapshot),
    { initialProps: { snapshot: initial } },
  );
  view.rerender({
    snapshot: {
      ...initial,
      lastOperationId: 'other-player',
      catalogEntries: initial.catalogEntries.map((entry) =>
        entry.name === 'Heritage'
          ? { ...entry, countsAsRaces: { oneOf: ['human', 'orc', 'elf'] } }
          : entry,
      ),
    },
  });
  expect(view.result.current.hasRemoteChange).toBe(true);
});
