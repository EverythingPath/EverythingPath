import { act, renderHook } from '@testing-library/react';
import { getFunctionName } from 'convex/server';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import {
  buildCastingSheet,
  castingId,
  entryId,
} from './casting-features-test-fixture';
import { useCharacterSheetClasses } from './use-character-sheet-classes';
import { useCharacterSheetSpellcastingChoices } from './use-character-sheet-spellcasting-choices';

const writes = vi.hoisted(() => ({
  switchVersion: vi.fn(),
  assign: vi.fn(),
  opposition: vi.fn(),
}));
vi.mock('convex/react', () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    ({
      'characterSheet:switchClassVersion': writes.switchVersion,
      'characterSheet:assignCastingAdvance': writes.assign,
      'characterSheet:setOppositionSchools': writes.opposition,
    })[getFunctionName(reference)],
}));
beforeEach(() => {
  Object.values(writes).forEach((write) =>
    write.mockReset().mockResolvedValue(null),
  );
});

const repeat = (identity: string, count: number) =>
  Array.from({ length: count }, () => identity);
const theurgeSheet = buildCastingSheet({
  levels: [
    ...repeat('wizard', 3),
    ...repeat('sorcerer', 3),
    ...repeat('cleric', 3),
    ...repeat('mystic-theurge', 2),
  ],
});

test('assigning an advance saves that level and index only and exposes its choices', async () => {
  let finish: (() => void) | undefined;
  writes.assign.mockReturnValue(
    new Promise<void>((done) => {
      finish = done;
    }),
  );
  const view = renderHook(() =>
    useCharacterSheetClasses(
      { characterId: theurgeSheet.character._id },
      theurgeSheet,
    ),
  );
  expect(
    view.result.current
      .advancesFor(entryId('mystic-theurge-1'))
      .map((choice) => [choice.label, choice.value, choice.missing]),
  ).toEqual([
    ['Arcane advance', null, true],
    ['Divine advance', 'cleric', false],
  ]);
  let saved: Promise<boolean> | undefined;
  act(() => {
    saved = view.result.current.assignAdvance(
      entryId('mystic-theurge-1'),
      0,
      castingId('sorcerer'),
    );
  });
  expect(
    view.result.current.advanceStatusFor(entryId('mystic-theurge-1'), 0),
  ).toEqual({ kind: 'saving' });
  expect(
    view.result.current.advanceStatusFor(entryId('mystic-theurge-1'), 1),
  ).toEqual({ kind: 'idle' });
  expect(
    view.result.current.advanceStatusFor(entryId('mystic-theurge-2'), 0),
  ).toEqual({ kind: 'idle' });
  expect(writes.assign).toHaveBeenCalledWith({
    characterId: theurgeSheet.character._id,
    operationId: expect.any(String),
    entryId: 'mystic-theurge-1',
    index: 0,
    classEntryId: 'sorcerer',
  });
  await act(async () => {
    finish?.();
    expect(await saved).toBe(true);
  });
  expect(
    view.result.current.advanceStatusFor(entryId('mystic-theurge-1'), 0),
  ).toEqual({ kind: 'saved' });
});

test('a refused advance keeps its reason beside that advance for retry', async () => {
  writes.assign.mockRejectedValueOnce(
    new ConvexError('Class does not belong to this Character'),
  );
  const view = renderHook(() =>
    useCharacterSheetClasses(
      { characterId: theurgeSheet.character._id },
      theurgeSheet,
    ),
  );
  await act(async () => {
    expect(
      await view.result.current.assignAdvance(
        entryId('mystic-theurge-2'),
        0,
        null,
      ),
    ).toBe(false);
  });
  expect(
    view.result.current.advanceStatusFor(entryId('mystic-theurge-2'), 0),
  ).toEqual({
    kind: 'error',
    message: expect.stringContaining("Casting advance wasn't saved"),
  });
});

test('another player changing an advance is acknowledged as a remote change', () => {
  const view = renderHook(
    ({ snapshot }) =>
      useCharacterSheetClasses(
        { characterId: snapshot.character._id },
        snapshot,
      ),
    { initialProps: { snapshot: theurgeSheet } },
  );
  view.rerender({
    snapshot: buildCastingSheet({
      levels: [
        ...repeat('wizard', 3),
        ...repeat('sorcerer', 3),
        ...repeat('cleric', 3),
        ['mystic-theurge', [{ classEntryId: 'wizard' }]],
        'mystic-theurge',
      ],
      lastOperationId: 'another-player',
    }),
  });
  expect(view.result.current.hasRemoteAdvanceChange).toBe(true);
});

const domainSheet = buildCastingSheet({
  levels: ['cleric', 'wizard'],
  selections: [
    {
      id: 'fire',
      catalogEntryId: 'domain-fire',
      classIdentity: 'cleric',
      feature: 'cleric-domains',
      list: 'Domains',
    },
    {
      id: 'evocation',
      catalogEntryId: 'school-evocation',
      classIdentity: 'wizard',
      feature: 'wizard-arcane-school',
      list: 'Arcane schools',
    },
  ],
});

test('the Spells page view of each Spellcasting and each specialist school are exposed; domain picks are not written here', () => {
  const view = renderHook(() =>
    useCharacterSheetSpellcastingChoices(
      { characterId: domainSheet.character._id },
      domainSheet,
    ),
  );
  expect(view.result.current.viewFor('cleric')).toMatchObject({
    classEntryId: 'cleric',
    extraSlots: [{ kind: 'domain' }],
    school: null,
  });
  expect(view.result.current.viewFor('fighter')).toBeNull();
  expect(
    view.result.current.schools.map(({ classEntryId, school }) => [
      classEntryId,
      school.name,
    ]),
  ).toEqual([['wizard', 'Evocation']]);
  expect(view.result.current).not.toHaveProperty('choose');
  expect(view.result.current).not.toHaveProperty('clear');
});

test('opposition schools save on the arcane school row with their own acknowledgement', async () => {
  writes.opposition.mockRejectedValueOnce(
    new ConvexError('Choose each opposition school once'),
  );
  const view = renderHook(() =>
    useCharacterSheetSpellcastingChoices(
      { characterId: domainSheet.character._id },
      domainSheet,
    ),
  );
  await act(async () => {
    expect(
      await view.result.current.setOppositionSchools('wizard', ['enc', 'enc']),
    ).toBe(false);
  });
  expect(view.result.current.statusFor('wizard:oppositionSchools')).toEqual({
    kind: 'error',
    message: expect.stringContaining('Choose each opposition school once'),
  });
  await act(async () => {
    expect(
      await view.result.current.setOppositionSchools('wizard', ['enc', 'nec']),
    ).toBe(true);
  });
  expect(writes.opposition).toHaveBeenLastCalledWith({
    characterId: domainSheet.character._id,
    operationId: expect.any(String),
    target: { entryId: 'evocation' },
    schools: ['enc', 'nec'],
  });
  expect(view.result.current.statusFor('wizard:oppositionSchools')).toEqual({
    kind: 'saved',
  });
  expect(view.result.current.statusFor('cleric:oppositionSchools')).toEqual({
    kind: 'idle',
  });
});
