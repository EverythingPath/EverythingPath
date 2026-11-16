import {
  calculateFixtureSheet as calculateCharacterSheet,
  buildSheet,
} from './character-sheet-test-fixture';
import { act, renderHook } from '@testing-library/react';
import { getFunctionName } from 'convex/server';
import { ConvexError } from 'convex/values';

import { proficiencyKey } from '~/lib/character-sheet-proficiencies';
import { beforeEach, expect, test, vi } from 'vitest';

import {
  proficiencyLabel,
  useCharacterSheetEquipment,
} from './use-character-sheet-equipment';

const writes = vi.hoisted(() => ({
  equipment: vi.fn(),
  manual: vi.fn(),
  choice: vi.fn(),
  level: vi.fn(),
  grant: vi.fn(),
}));
vi.mock('convex/react', () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    ({
      'characterSheet:editEquipment': writes.equipment,
      'characterSheet:setManualProficiency': writes.manual,
      'characterSheet:setProficiencyChoice': writes.choice,
      'characterSheet:editClassLevel': writes.level,
      'characterSheet:editGrantState': writes.grant,
    })[getFunctionName(reference)],
}));
beforeEach(() =>
  Object.values(writes).forEach((write) =>
    write.mockReset().mockResolvedValue(null),
  ),
);

function armorSheet() {
  return buildSheet({
    sheetEntries: [
      {
        id: 'armor-row',
        name: 'Full plate',
        detail: {
          kind: 'item',
          consumable: false,
          armor: { slot: 'armor', armorCheckPenalty: 6 },
        },
        modifiers: [],
      },
    ],
  });
}

test('equipment comes from the shared snapshot and equip uses its stable row with a local acknowledgement', async () => {
  const snapshot = armorSheet();
  const view = renderHook(() =>
    useCharacterSheetEquipment(
      { characterId: snapshot.character._id },
      snapshot,
    ),
  );
  const armor = view.result.current.equipment.rows[0];
  if (!armor) throw new Error('Missing armor');
  expect(armor).toMatchObject({
    name: 'Full plate',
    active: true,
    enhancement: 0,
    masterwork: false,
    material: null,
  });
  await act(async () => {
    expect(
      await view.result.current.equipment.saveActiveWithStatus(
        armor.entryId,
        false,
      ),
    ).toBe(true);
  });
  expect(writes.equipment).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    entryId: armor.entryId,
    active: false,
  });
  expect(view.result.current.equipment.statusFor(armor.entryId)).toEqual({
    kind: 'saved',
  });
  expect(view.result.current.equipment.statusFor('other')).toEqual({
    kind: 'idle',
  });
});

test('a synthesized proficiency choice is saved by its durable Grant Key', async () => {
  const snapshot = buildSheet();
  const grantKey = {
    source: 'fighter',
    classLevel: 1,
    entry: 'favored-weapon',
  };
  snapshot.calculated.resolvedEntries.push({
    entry: {
      _id: 'derived-feat',
      kind: 'feat',
      active: true,
      catalogEntryId: 'feat-definition',
      grantKey,
      state: { kind: 'feat' },
    },
    origin: 'grant',
    recorded: false,
    dormant: false,
    counting: true,
  });
  snapshot.calculated.proficiencies.missingChoices.push({
    entryId: 'derived-feat',
    kind: 'entry',
    name: 'Martial Weapon Proficiency',
  });
  snapshot.calculated.proficiencies.choices.push({
    entryId: 'derived-feat',
    name: 'Martial Weapon Proficiency',
    choice: null,
  });
  const view = renderHook(() =>
    useCharacterSheetEquipment(
      { characterId: snapshot.character._id },
      snapshot,
    ),
  );
  await view.result.current.proficiencies.saveChoice(
    'derived-feat',
    'longsword',
  );
  expect(writes.grant).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    grantKey,
    state: { choice: 'longsword' },
  });
  expect(writes.choice).not.toHaveBeenCalled();
});

test('equipment edits persist item state and a rejected equip remains retryable on its own row', async () => {
  const snapshot = armorSheet();
  const view = renderHook(() =>
    useCharacterSheetEquipment(
      { characterId: snapshot.character._id },
      snapshot,
    ),
  );
  const armor = view.result.current.equipment.rows[0];
  if (!armor) throw new Error('Missing armor');
  await view.result.current.equipment.save(armor.entryId, {
    enhancement: 2,
    masterwork: true,
    material: 'mithral',
  });
  expect(writes.equipment).toHaveBeenLastCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    entryId: armor.entryId,
    enhancement: 2,
    masterwork: true,
    material: 'mithral',
  });
  writes.equipment.mockRejectedValueOnce(
    new ConvexError('Character is read only'),
  );
  await act(async () => {
    expect(
      await view.result.current.equipment.saveActiveWithStatus(
        armor.entryId,
        false,
      ),
    ).toBe(false);
  });
  expect(view.result.current.equipment.statusFor(armor.entryId)).toEqual({
    kind: 'error',
    message: "Full plate wasn't saved: Character is read only. Try again.",
  });
  expect(view.result.current.equipment.rows[0]?.active).toBe(true);
  await act(async () => {
    expect(
      await view.result.current.equipment.saveActiveWithStatus(
        armor.entryId,
        false,
      ),
    ).toBe(true);
  });
  expect(view.result.current.equipment.statusFor(armor.entryId)).toEqual({
    kind: 'saved',
  });
});

test('manual additions, removals and reset use named changes with distinct local statuses', async () => {
  const snapshot = buildSheet();
  const view = renderHook(() =>
    useCharacterSheetEquipment(
      { characterId: snapshot.character._id },
      snapshot,
    ),
  );
  const proficiency = { category: 'heavy' } satisfies Parameters<
    typeof proficiencyKey
  >[0];
  for (const disposition of ['added', 'removed', 'none'] as const) {
    await act(async () => {
      expect(
        await view.result.current.proficiencies.saveManualWithStatus(
          proficiency,
          disposition,
        ),
      ).toBe(true);
    });
    expect(writes.manual).toHaveBeenLastCalledWith({
      characterId: snapshot.character._id,
      operationId: expect.any(String),
      proficiency,
      disposition,
    });
  }
  expect(
    view.result.current.proficiencies.statusFor(proficiencyKey(proficiency)),
  ).toEqual({ kind: 'saved' });
  expect(
    view.result.current.equipment.statusFor(proficiencyKey(proficiency)),
  ).toEqual({ kind: 'idle' });
  expect(
    proficiencyLabel({ baseType: 'dwarven waraxe', asMartial: true }),
  ).toBe('dwarven waraxe (treat as martial)');
});

test('proficiency choices use Class Level and recorded entry writers without changing their origin', async () => {
  const snapshot = buildSheet({
    levels: [{ id: 'level', hp: 8 }],
    adjustments: [
      { id: 'feat', name: 'Exotic Weapon Proficiency', modifiers: [] },
    ],
  });
  const view = renderHook(() =>
    useCharacterSheetEquipment(
      { characterId: snapshot.character._id },
      snapshot,
    ),
  );
  await view.result.current.proficiencies.saveChoice('level', 'longsword');
  expect(writes.level).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    entryId: 'level',
    proficiencyChoice: 'longsword',
  });
  await view.result.current.proficiencies.saveChoice('feat', 'bastard sword');
  expect(writes.choice).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    entryId: 'feat',
    choice: 'bastard sword',
  });
  await view.result.current.proficiencies.saveChoice('feat', null);
  expect(writes.choice).toHaveBeenLastCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    entryId: 'feat',
    choice: null,
  });
  expect(() =>
    view.result.current.proficiencies.saveChoice('gone', 'longsword'),
  ).toThrow('This entry is no longer available.');
});

test('remote equipment changes produce a section notice while unrelated changes do not', () => {
  const original = armorSheet();
  const view = renderHook(
    ({ snapshot }) =>
      useCharacterSheetEquipment(
        { characterId: snapshot.character._id },
        snapshot,
      ),
    { initialProps: { snapshot: original } },
  );
  view.rerender({
    snapshot: {
      ...original,
      character: { ...original.character, name: 'Another name' },
    },
  });
  expect(view.result.current.equipment.hasRemoteChange).toBe(false);
  const entries = original.entries.map((entry) =>
    entry.kind === 'item' ? { ...entry, active: false } : entry,
  );
  view.rerender({
    snapshot: {
      ...original,
      entries,
      calculated: calculateCharacterSheet({
        entries,
        catalogEntries: original.catalogEntries,
        characterKind: 'pc',
      }),
      lastOperationId: 'other-player',
    },
  });
  expect(view.result.current.equipment.rows[0]?.active).toBe(false);
  expect(view.result.current.equipment.hasRemoteChange).toBe(true);
  expect(view.result.current.proficiencies.hasRemoteChange).toBe(false);
});

test('synthesized armor remains visible and gear edits use its durable Grant Key', async () => {
  const snapshot = armorSheet();
  const armor = snapshot.calculated.resolvedEntries.find(
    (row) => row.entry.kind === 'item',
  );
  if (armor?.entry.kind !== 'item') throw new Error('Missing armor');
  const grantKey = { source: 'fighter', classLevel: 1, entry: 'armor' };
  snapshot.entries = snapshot.entries.filter((entry) => entry.kind !== 'item');
  snapshot.calculated.resolvedEntries =
    snapshot.calculated.resolvedEntries.filter(
      (row) => row.entry.kind !== 'item',
    );
  snapshot.calculated.resolvedEntries.push({
    ...armor,
    entry: { ...armor.entry, _id: 'derived-armor', grantKey },
    origin: 'grant',
    recorded: false,
    storedEntryId: undefined,
  });
  const view = renderHook(() =>
    useCharacterSheetEquipment(
      { characterId: snapshot.character._id },
      snapshot,
    ),
  );
  const row = view.result.current.equipment.rows[0];
  expect(row).toMatchObject({
    entryId: 'derived-armor',
    name: 'Full plate',
    active: true,
  });
  if (!row) throw new Error('Missing grant armor');
  await view.result.current.equipment.save(row.entryId, { enhancement: 1 });
  expect(writes.equipment).toHaveBeenLastCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    grantKey,
    enhancement: 1,
  });
  await act(async () => {
    expect(
      await view.result.current.equipment.saveActiveWithStatus(
        row.entryId,
        false,
      ),
    ).toBe(true);
  });
  expect(writes.equipment).toHaveBeenLastCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    grantKey,
    active: false,
  });
});

test('a Class Level choice is offered on the first level of its class only', () => {
  const snapshot = buildSheet({
    levels: [
      { id: 'cleric-1', hp: 8, classId: 'cleric', proficiencyChoice: 'flail' },
      { id: 'cleric-2', hp: 5, classId: 'cleric' },
    ],
    classProficiencies: { cleric: [{ choice: true }] },
  });
  const view = renderHook(() =>
    useCharacterSheetEquipment(
      { characterId: snapshot.character._id },
      snapshot,
    ),
  );
  expect(view.result.current.proficiencies.choices).toEqual([
    { entryId: 'cleric-1', name: 'Cleric', choice: 'flail' },
  ]);
});
