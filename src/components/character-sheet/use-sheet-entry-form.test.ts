import { act, renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import { getFunctionName } from 'convex/server';
import {
  useSheetEntryForm,
  useSpellEffectStateForm,
} from './use-sheet-entry-form';
import type { SheetEntryInput } from './use-character-sheet-entries';
import { useCharacterSheetEntries } from './use-character-sheet-entries';
import { buildSheet } from './character-sheet-test-fixture';

const remote = vi.hoisted(() => ({ edit: vi.fn() }));
vi.mock('convex/react', () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference) === 'characterSheet:editSheetEntry'
      ? remote.edit
      : vi.fn(),
}));

test('a shared Spell Effect saves its caster-level state without sending definition fields', async () => {
  remote.edit.mockReset().mockResolvedValue(null);
  const initial = buildSheet({
    sheetEntries: [
      {
        id: 'effect',
        name: 'Shared shield',
        detail: {
          kind: 'spellEffect',
          defaultCasterLevel: 6,
          lastsOverOneDay: false,
        },
        casterLevel: 12,
        modifiers: [],
      },
    ],
  });
  const row = initial.entries.find((entry) => entry.kind === 'spellEffect');
  if (!row) throw new Error('Missing Spell Effect');
  const snapshot = {
    ...initial,
    catalogEntries: initial.catalogEntries.map((entry) =>
      entry._id === row.catalogEntryId
        ? { ...entry, scope: 'global' as const }
        : entry,
    ),
  };
  const view = renderHook(() => {
    const entries = useCharacterSheetEntries(
      { characterId: snapshot.character._id },
      snapshot,
    );
    return useSpellEffectStateForm({
      value: { casterLevel: row.state.casterLevel, defaultCasterLevel: 6 },
      save: (input) => entries.sheetEntries.editState(row._id, input),
    });
  });
  act(() =>
    view.result.current.form.setValue('casterLevel', '', { shouldDirty: true }),
  );
  await act(async () => expect(await view.result.current.save()).toBe('saved'));
  expect(remote.edit).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    entryId: row._id,
    casterLevel: 6,
  });
  expect(view.result.current.status.kind).toBe('saved');
});

test('state-only caster-level saves accept their own echo after a lost reply and preserve newer input', async () => {
  let fail: ((error: Error) => void) | undefined;
  const save = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          fail = reject;
        }),
    )
    .mockResolvedValue(null);
  const view = renderHook(
    ({ value }) => useSpellEffectStateForm({ value, save }),
    { initialProps: { value: { casterLevel: 12, defaultCasterLevel: 6 } } },
  );
  act(() =>
    view.result.current.form.setValue('casterLevel', '', { shouldDirty: true }),
  );
  let pending: Promise<unknown> | undefined;
  await act(async () => {
    pending = view.result.current.save();
  });
  act(() =>
    view.result.current.form.setValue('casterLevel', '8', {
      shouldDirty: true,
    }),
  );
  view.rerender({ value: { casterLevel: 6, defaultCasterLevel: 6 } });
  expect(view.result.current.hasRemoteChange).toBe(false);
  await act(async () => {
    fail?.(new Error('Connection lost'));
    expect(await pending).toBe('saved');
  });
  expect(view.result.current.form.getValues('casterLevel')).toBe('8');
  expect(view.result.current.form.formState.isDirty).toBe(true);
  await act(async () => expect(await view.result.current.save()).toBe('saved'));
  expect(save).toHaveBeenLastCalledWith({ casterLevel: 8 });
  view.rerender({ value: { casterLevel: 8, defaultCasterLevel: 6 } });
  expect(view.result.current.hasRemoteChange).toBe(false);
  view.rerender({ value: { casterLevel: 10, defaultCasterLevel: 6 } });
  expect(view.result.current.hasRemoteChange).toBe(true);
});

test('an unchanged blank caster-level override accepts the default without leaving an unsaved draft', async () => {
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() =>
    useSpellEffectStateForm({
      value: { casterLevel: 6, defaultCasterLevel: 6 },
      save,
    }),
  );
  act(() =>
    view.result.current.form.setValue('casterLevel', '', { shouldDirty: true }),
  );
  await act(async () => expect(await view.result.current.save()).toBe('saved'));
  expect(save).not.toHaveBeenCalled();
  expect(view.result.current.form.getValues('casterLevel')).toBe('6');
  expect(view.result.current.form.formState.isDirty).toBe(false);
});

test('state-only caster-level validation blocks malformed numbers and keeps refused input for retry', async () => {
  const save = vi
    .fn()
    .mockRejectedValueOnce(new ConvexError('Character is read only'))
    .mockResolvedValue(null);
  const view = renderHook(() =>
    useSpellEffectStateForm({
      value: { casterLevel: 6, defaultCasterLevel: 6 },
      save,
    }),
  );
  for (const invalid of ['many', '-1', '1.5', '9007199254740992']) {
    act(() =>
      view.result.current.form.setValue('casterLevel', invalid, {
        shouldDirty: true,
      }),
    );
    await act(async () =>
      expect(await view.result.current.save()).toBe('failed'),
    );
    expect(view.result.current.form.formState.errors.casterLevel?.message).toBe(
      'Caster level must be a whole number of 0 or more',
    );
  }
  expect(save).not.toHaveBeenCalled();
  act(() =>
    view.result.current.form.setValue('casterLevel', '8', {
      shouldDirty: true,
    }),
  );
  await act(async () =>
    expect(await view.result.current.save()).toBe('failed'),
  );
  expect(view.result.current.form.getValues('casterLevel')).toBe('8');
  expect(view.result.current.status).toMatchObject({
    kind: 'error',
    message: expect.stringContaining('read only'),
  });
  await act(async () => expect(await view.result.current.save()).toBe('saved'));
  expect(save).toHaveBeenLastCalledWith({ casterLevel: 8 });
});

test('a remote caster-level change during saving returns a conflict and keeps the draft', async () => {
  let finish: (() => void) | undefined;
  const save = vi.fn().mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const view = renderHook(
    ({ value }) => useSpellEffectStateForm({ value, save }),
    { initialProps: { value: { casterLevel: 6, defaultCasterLevel: 6 } } },
  );
  act(() =>
    view.result.current.form.setValue('casterLevel', '8', {
      shouldDirty: true,
    }),
  );
  let pending: Promise<unknown> | undefined;
  await act(async () => {
    pending = view.result.current.save();
  });
  expect(view.result.current.status.kind).toBe('saving');
  await act(async () =>
    expect(await view.result.current.save()).toBe('failed'),
  );
  expect(save).toHaveBeenCalledTimes(1);
  view.rerender({ value: { casterLevel: 10, defaultCasterLevel: 6 } });
  await act(async () => {
    finish?.();
    expect(await pending).toBe('remote-conflict');
  });
  expect(view.result.current.form.getValues('casterLevel')).toBe('8');
  expect(view.result.current.form.formState.isDirty).toBe(true);
  expect(view.result.current.hasRemoteChange).toBe(true);
});

test('the state writer drops definition fields from an untyped input', async () => {
  remote.edit.mockReset().mockResolvedValue(null);
  const snapshot = buildSheet({
    sheetEntries: [
      {
        id: 'effect',
        name: 'Shield',
        detail: {
          kind: 'spellEffect',
          defaultCasterLevel: 6,
          lastsOverOneDay: false,
        },
        modifiers: [],
      },
    ],
  });
  const row = snapshot.entries.find((entry) => entry.kind === 'spellEffect');
  if (!row) throw new Error('Missing Spell Effect');
  const view = renderHook(() =>
    useCharacterSheetEntries({ characterId: snapshot.character._id }, snapshot),
  );
  const input = {
    casterLevel: 8,
    active: false,
    name: 'Attempted definition edit',
    modifiers: [],
    detail: { kind: 'spell' },
  };
  await act(async () => {
    await view.result.current.sheetEntries.editState(row._id, input);
  });
  expect(remote.edit).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    entryId: row._id,
    casterLevel: 8,
    active: false,
  });
});

test('ordinary edits of a curated condition preserve its key so canonical mechanics remain guarded', async () => {
  const value: SheetEntryInput = {
    name: 'Blinded',
    detail: { kind: 'condition', conditionKey: 'blinded' },
    modifiers: [{ target: 'ac', bonusType: 'untyped', value: -2 }],
  };
  const save = vi
    .fn()
    .mockRejectedValue(
      new ConvexError('A CRB condition must use its canonical Modifiers'),
    );
  const view = renderHook(() => useSheetEntryForm({ value, save }));
  act(() =>
    view.result.current.adjustmentForm.setValue('modifiers.0.value', '-3', {
      shouldDirty: true,
    }),
  );
  await act(async () => {
    expect(await view.result.current.save()).toBe('failed');
  });
  expect(save).toHaveBeenCalledWith({
    ...value,
    modifiers: [{ target: 'ac', bonusType: 'untyped', value: -3 }],
  });
});

test('selecting a CRB condition fills its canonical mechanics and submits its trusted key', async () => {
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() => useSheetEntryForm({ save }));
  expect(view.result.current.form.getValues('conditionSelection')).toEqual({
    kind: 'custom',
  });
  expect(view.result.current.conditionOptions).toHaveLength(34);
  expect(
    view.result.current.conditionOptions.map((option) => option.name),
  ).toContain('Unconscious');
  act(() => view.result.current.selectCondition('fatigued'));
  expect(view.result.current.form.getValues('conditionSelection')).toEqual({
    kind: 'crb',
    key: 'fatigued',
  });
  expect(view.result.current.selectedCondition?.name).toBe('Fatigued');
  expect(view.result.current.fields).toHaveLength(2);
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenCalledWith({
    name: 'Fatigued',
    modifiers: [
      { target: 'ability.str', bonusType: 'untyped', value: -2 },
      { target: 'ability.dex', bonusType: 'untyped', value: -2 },
    ],
    detail: { kind: 'condition', conditionKey: 'fatigued' },
  });
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenCalledTimes(1);
});

test('an unchanged curated condition stays selected without writing, and a condition without numeric mechanics saves no blank modifier', async () => {
  const value: SheetEntryInput = {
    name: 'Dazed',
    modifiers: [],
    detail: { kind: 'condition', conditionKey: 'dazed' },
  };
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() => useSheetEntryForm({ value, save }));
  expect(view.result.current.selectedCondition?.name).toBe('Dazed');
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).not.toHaveBeenCalled();
  const create = renderHook(() => useSheetEntryForm({ save }));
  act(() => create.result.current.selectCondition('dazed'));
  expect(create.result.current.fields).toHaveLength(0);
  await act(async () => {
    expect(await create.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenCalledWith(value);
});

test('explicit custom detach keeps the selected name and modifiers and permits intentional edits', async () => {
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() => useSheetEntryForm({ save }));
  act(() => {
    view.result.current.selectCondition('fatigued');
    view.result.current.detachCondition();
  });
  expect(view.result.current.selectedCondition).toBeNull();
  expect(view.result.current.form.getValues('conditionSelection')).toEqual({
    kind: 'custom',
  });
  expect(view.result.current.adjustmentForm.getValues('name')).toBe('Fatigued');
  expect(view.result.current.fields).toHaveLength(2);
  act(() => {
    view.result.current.adjustmentForm.setValue('name', 'Narrative fatigue', {
      shouldDirty: true,
    });
    view.result.current.adjustmentForm.setValue('modifiers.0.value', '-1', {
      shouldDirty: true,
    });
  });
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenCalledWith({
    name: 'Narrative fatigue',
    detail: { kind: 'condition' },
    modifiers: [
      { target: 'ability.str', bonusType: 'untyped', value: -1 },
      { target: 'ability.dex', bonusType: 'untyped', value: -2 },
    ],
  });
});

test('a selected condition draft survives a save refusal and retains its readable rule limits', async () => {
  const save = vi
    .fn()
    .mockRejectedValue(
      new ConvexError({ code: 'MAINTENANCE', message: 'paused' }),
    );
  const view = renderHook(() => useSheetEntryForm({ save }));
  act(() => view.result.current.selectCondition('paralyzed'));
  await act(async () => {
    expect(await view.result.current.save()).toBe('failed');
  });
  expect(view.result.current.status.kind).toBe('error');
  expect(view.result.current.form.getValues('conditionSelection')).toEqual({
    kind: 'crb',
    key: 'paralyzed',
  });
  expect(view.result.current.adjustmentForm.getValues('name')).toBe(
    'Paralyzed',
  );
  expect(view.result.current.selectedCondition?.unmodeled).toContainEqual(
    expect.stringContaining('Strength 0'),
  );
});

test('a dirty condition selection stays together when another player changes the entry, and its own save echo stays quiet', async () => {
  const value: SheetEntryInput = {
    name: 'Fatigued',
    detail: { kind: 'condition', conditionKey: 'fatigued' },
    modifiers: [
      { target: 'ability.str', bonusType: 'untyped', value: -2 },
      { target: 'ability.dex', bonusType: 'untyped', value: -2 },
    ],
  };
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(({ value }) => useSheetEntryForm({ value, save }), {
    initialProps: { value },
  });
  act(() => view.result.current.selectCondition('exhausted'));
  view.rerender({
    value: {
      name: 'Dazed',
      modifiers: [],
      detail: { kind: 'condition', conditionKey: 'dazed' },
    },
  });
  expect(view.result.current.selectedCondition?.name).toBe('Exhausted');
  expect(view.result.current.adjustmentForm.getValues('name')).toBe(
    'Exhausted',
  );
  expect(view.result.current.hasRemoteChange).toBe(true);
  act(() => view.result.current.dismissRemoteChange());
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  const submitted: SheetEntryInput = {
    name: 'Exhausted',
    detail: { kind: 'condition', conditionKey: 'exhausted' },
    modifiers: [
      { target: 'ability.str', bonusType: 'untyped', value: -6 },
      { target: 'ability.dex', bonusType: 'untyped', value: -6 },
    ],
  };
  expect(save).toHaveBeenCalledWith(submitted);
  view.rerender({ value: submitted });
  expect(view.result.current.hasRemoteChange).toBe(false);
  expect(view.result.current.selectedCondition?.name).toBe('Exhausted');
});

test('custom conditions show an in-app required name error and keep an invalid draft without saving', async () => {
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() => useSheetEntryForm({ save }));
  act(() => view.result.current.removeModifier(0));
  await act(async () => {
    expect(await view.result.current.save()).toBe('failed');
  });
  expect(
    view.result.current.adjustmentForm.formState.errors.name?.message,
  ).toBe('Adjustment name is required');
  expect(save).not.toHaveBeenCalled();
  expect(view.result.current.form.getValues('conditionSelection')).toEqual({
    kind: 'custom',
  });
});

test('Spell Effects prefill caster level and blank overrides restore the default while saving formulas', async () => {
  const save = vi.fn().mockResolvedValue(null);
  const value: SheetEntryInput = {
    name: 'Shield',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 6,
    },
    modifiers: [
      {
        target: 'ac.other',
        bonusType: 'deflection',
        value: { formula: '1 + floor(@casterLevel / 6)' },
      },
    ],
    casterLevel: 12,
  };
  const view = renderHook(() => useSheetEntryForm({ value, save }));
  expect(view.result.current.form.getValues('casterLevel')).toBe('12');
  act(() => view.result.current.form.setValue('casterLevel', ''));
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenLastCalledWith({ ...value, casterLevel: 6 });
});

test('remote changes retain dirty classification fields and a maintenance refusal retains the draft', async () => {
  const value: SheetEntryInput = {
    name: 'Shield',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 6,
    },
    modifiers: [],
    casterLevel: 6,
  };
  const save = vi
    .fn()
    .mockRejectedValue(
      new ConvexError({ code: 'MAINTENANCE', message: 'paused' }),
    );
  const view = renderHook(({ value }) => useSheetEntryForm({ value, save }), {
    initialProps: { value },
  });
  act(() =>
    view.result.current.form.setValue('casterLevel', '12', {
      shouldDirty: true,
    }),
  );
  view.rerender({ value: { ...value, casterLevel: 8 } });
  expect(view.result.current.form.getValues('casterLevel')).toBe('12');
  expect(view.result.current.hasRemoteChange).toBe(true);
  await act(async () => {
    expect(await view.result.current.save()).toBe('failed');
  });
  expect(view.result.current.status.kind).toBe('error');
  expect(view.result.current.form.getValues('casterLevel')).toBe('12');
});

test('the caster level save echo stays quiet while a later remote change is announced', async () => {
  const value: SheetEntryInput = {
    name: 'Shield',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 6,
    },
    modifiers: [],
    casterLevel: 6,
  };
  const view = renderHook(
    ({ value }) => useSheetEntryForm({ value, save: async () => null }),
    { initialProps: { value } },
  );
  act(() =>
    view.result.current.form.setValue('casterLevel', '12', {
      shouldDirty: true,
    }),
  );
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  view.rerender({ value: { ...value, casterLevel: 12 } });
  expect(view.result.current.hasRemoteChange).toBe(false);
  view.rerender({ value: { ...value, casterLevel: 8 } });
  expect(view.result.current.hasRemoteChange).toBe(true);
});

test('saving an unchanged Character Sheet Entry keeps its current state without writing', async () => {
  const value: SheetEntryInput = {
    name: 'Recorded Spell',
    detail: { kind: 'spell' },
    modifiers: [],
  };
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() => useSheetEntryForm({ value, save }));
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).not.toHaveBeenCalled();
  expect(view.result.current.status.kind).toBe('idle');
});

test('a newly saved entry waits for its query echo without writing the same draft again', async () => {
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() => useSheetEntryForm({ save }));
  act(() => {
    view.result.current.adjustmentForm.setValue('name', 'Potion', {
      shouldDirty: true,
    });
    view.result.current.removeModifier(0);
    view.result.current.form.setValue('kind', 'item', { shouldDirty: true });
    view.result.current.form.setValue('consumable', true, {
      shouldDirty: true,
    });
  });
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith({
    name: 'Potion',
    modifiers: [],
    detail: { kind: 'item', consumable: true },
  });
});

test('changing only an entry classification saves it once and keeps its name and modifiers', async () => {
  const value: SheetEntryInput = {
    name: 'Potion',
    detail: { kind: 'item', consumable: false },
    modifiers: [{ target: 'ability.str', bonusType: 'enhancement', value: 2 }],
  };
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() => useSheetEntryForm({ value, save }));
  act(() =>
    view.result.current.form.setValue('consumable', true, {
      shouldDirty: true,
    }),
  );
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenCalledWith({
    ...value,
    detail: { kind: 'item', consumable: true },
  });
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenCalledTimes(1);
});

test('a blank caster level accepts its own echo before the save reply and keeps subsequent saves unchanged', async () => {
  const value: SheetEntryInput = {
    name: 'Shield',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 6,
    },
    modifiers: [],
    casterLevel: 12,
  };
  let complete: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const save = vi.fn().mockReturnValue(pending);
  const view = renderHook(({ value }) => useSheetEntryForm({ value, save }), {
    initialProps: { value },
  });
  act(() =>
    view.result.current.form.setValue('casterLevel', '', { shouldDirty: true }),
  );
  let saving: Promise<unknown> | undefined;
  await act(async () => {
    saving = view.result.current.save();
  });
  view.rerender({ value: { ...value, casterLevel: 6 } });
  await act(async () => {
    complete?.();
    await saving;
  });
  expect(view.result.current.hasRemoteChange).toBe(false);
  expect(view.result.current.form.getValues('casterLevel')).toBe('6');
  expect(view.result.current.form.formState.isDirty).toBe(false);
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenCalledTimes(1);
});

test('a newer caster-level draft survives an earlier save echo and reply', async () => {
  const value: SheetEntryInput = {
    name: 'Shield',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 6,
    },
    modifiers: [],
    casterLevel: 12,
  };
  let complete: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const save = vi.fn().mockReturnValueOnce(pending).mockResolvedValue(null);
  const view = renderHook(({ value }) => useSheetEntryForm({ value, save }), {
    initialProps: { value },
  });
  act(() =>
    view.result.current.form.setValue('casterLevel', '', { shouldDirty: true }),
  );
  let saving: Promise<unknown> | undefined;
  await act(async () => {
    saving = view.result.current.save();
  });
  act(() =>
    view.result.current.form.setValue('casterLevel', '8', {
      shouldDirty: true,
    }),
  );
  view.rerender({ value: { ...value, casterLevel: 6 } });
  await act(async () => {
    complete?.();
    await saving;
  });
  expect(view.result.current.form.getValues('casterLevel')).toBe('8');
  expect(view.result.current.form.formState.isDirty).toBe(true);
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenLastCalledWith({ ...value, casterLevel: 8 });
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenCalledTimes(2);
});

test('editing an item name and consumable classification retains its equipment facts', async () => {
  const value: SheetEntryInput = {
    name: 'Mithral plate',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      material: 'mithral',
      armor: {
        slot: 'armor',
        category: 'heavyArmor',
        bonus: 9,
        maxDex: 3,
        armorCheckPenalty: 3,
        asf: 25,
      },
      weapon: {
        baseType: 'armor spikes',
        proficiency: 'martial',
        groups: ['close'],
      },
    },
  };
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() => useSheetEntryForm({ value, save }));
  act(() => {
    view.result.current.adjustmentForm.setValue('name', 'Named plate', {
      shouldDirty: true,
    });
    view.result.current.form.setValue('consumable', true, {
      shouldDirty: true,
    });
  });
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenCalledWith({
    ...value,
    name: 'Named plate',
    detail: { ...value.detail, consumable: true },
  });
});
