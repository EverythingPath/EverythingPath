import { act, renderHook } from '@testing-library/react';
import { ConvexError } from 'convex/values';
import { expect, test, vi } from 'vitest';
import { useAttackRoutineForm } from './use-attack-routine-form';

const value: Parameters<typeof useAttackRoutineForm>[0]['value'] = {
  name: 'Longsword',
  weaponEntryId: 'sword',
  hands: 'one',
  mode: 'melee',
  naturalAttackEntryIds: [],
  availableLimbs: '2',
  options: [],
};

test('range drafts distinguish empty and malformed input, then save a parsed increment count', async () => {
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() => useAttackRoutineForm({ value, save }));
  await act(async () => {
    expect(await view.result.current.change('rangeIncrements', '')).toBe(false);
  });
  expect(
    view.result.current.form.formState.errors.rangeIncrements?.message,
  ).toBe('Range increments are required');
  await act(async () => {
    expect(await view.result.current.change('rangeIncrements', 'far')).toBe(
      false,
    );
  });
  expect(
    view.result.current.form.formState.errors.rangeIncrements?.message,
  ).toBe('Enter a whole number of range increments');
  expect(save).not.toHaveBeenCalled();
  await act(async () => {
    expect(await view.result.current.change('rangeIncrements', '3')).toBe(true);
  });
  expect(save).toHaveBeenLastCalledWith({ rangeIncrements: 3 });
  expect(view.result.current.statusFor('rangeIncrements')).toEqual({
    kind: 'saved',
  });
});

test('ammunition choices save independently while a refused range draft survives incoming edits', async () => {
  const save = vi
    .fn()
    .mockRejectedValueOnce(new ConvexError('Character is read only'))
    .mockResolvedValue(null);
  const incoming = {
    ...value,
    rangeIncrements: 1,
    ammunitionEntryId: null,
  };
  const view = renderHook(
    ({ incoming }) => useAttackRoutineForm({ value: incoming, save }),
    { initialProps: { incoming } },
  );
  await act(async () => {
    expect(await view.result.current.change('rangeIncrements', '2')).toBe(
      false,
    );
    expect(
      await view.result.current.change('ammunitionEntryId', 'arrows'),
    ).toBe(true);
  });
  expect(save.mock.calls).toEqual([
    [{ rangeIncrements: 2 }],
    [{ ammunitionEntryId: 'arrows' }],
  ]);
  view.rerender({
    incoming: { ...incoming, name: 'Other strike', rangeIncrements: 4 },
  });
  expect(view.result.current.form.getValues('rangeIncrements')).toBe('2');
  expect(view.result.current.form.getValues('name')).toBe('Other strike');
  await act(async () => {
    expect(await view.result.current.retry('rangeIncrements')).toBe(true);
    expect(await view.result.current.change('ammunitionEntryId', null)).toBe(
      true,
    );
  });
  expect(save.mock.calls.at(-2)).toEqual([{ rangeIncrements: 2 }]);
  expect(save).toHaveBeenLastCalledWith({ ammunitionEntryId: null });
});

// CRB p. 180: ten increments for projectiles; a thrown hand caps the routine at five.
test.each([
  [
    { mode: 'ranged' },
    '10',
    '11',
    'Ranged attacks reach at most 10 range increments',
  ],
  [
    { mode: 'thrown' },
    '5',
    '6',
    'Thrown attacks reach at most 5 range increments',
  ],
  [
    {
      mode: 'melee',
      offHand: { kind: 'weapon', weaponEntryId: 'dagger', mode: 'thrown' },
    },
    '5',
    '6',
    'Thrown attacks reach at most 5 range increments',
  ],
] as const)(
  'a %o routine saves %s range increments and keeps %s local with its error',
  async (routine, allowed, refused, message) => {
    const save = vi.fn().mockResolvedValue(null);
    const view = renderHook(() =>
      useAttackRoutineForm({ value: { ...value, ...routine }, save }),
    );
    await act(async () => {
      expect(await view.result.current.change('rangeIncrements', refused)).toBe(
        false,
      );
    });
    expect(
      view.result.current.form.formState.errors.rangeIncrements?.message,
    ).toBe(message);
    expect(view.result.current.form.getValues('rangeIncrements')).toBe(refused);
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      expect(await view.result.current.change('rangeIncrements', allowed)).toBe(
        true,
      );
    });
    expect(save).toHaveBeenLastCalledWith({ rangeIncrements: Number(allowed) });
    expect(
      view.result.current.form.formState.errors.rangeIncrements,
    ).toBeUndefined();
  },
);

test.each(['0', '1.5', 'Infinity', '0x10'])(
  'invalid range increment draft %s stays local and sends no mutation',
  async (draft) => {
    const save = vi.fn();
    const view = renderHook(() => useAttackRoutineForm({ value, save }));
    await act(async () => {
      expect(await view.result.current.change('rangeIncrements', draft)).toBe(
        false,
      );
    });
    expect(view.result.current.form.getValues('rangeIncrements')).toBe(draft);
    expect(
      view.result.current.form.formState.errors.rangeIncrements,
    ).toBeDefined();
    expect(save).not.toHaveBeenCalled();
  },
);

test('a range acknowledgement arriving before its save response clears the draft so a later remote range is adopted', async () => {
  let complete: (() => void) | undefined;
  const save = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  const incoming = { ...value, rangeIncrements: 1 };
  const view = renderHook(
    ({ incoming }) => useAttackRoutineForm({ value: incoming, save }),
    { initialProps: { incoming } },
  );
  let pending: Promise<boolean> | undefined;
  await act(async () => {
    pending = view.result.current.change('rangeIncrements', '3');
  });
  view.rerender({ incoming: { ...incoming, rangeIncrements: 3 } });
  await act(async () => {
    complete?.();
    await pending;
  });
  expect(
    view.result.current.form.getFieldState('rangeIncrements').isDirty,
  ).toBe(false);
  view.rerender({ incoming: { ...incoming, rangeIncrements: 4 } });
  expect(Number(view.result.current.form.getValues('rangeIncrements'))).toBe(4);
});

test('routine fields persist immediately and an empty name stays local with its field error', async () => {
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() => useAttackRoutineForm({ value, save }));
  await act(async () => {
    expect(await view.result.current.change('name', '')).toBe(false);
  });
  expect(view.result.current.form.formState.errors.name?.message).toBe(
    'Routine name is required',
  );
  expect(save).not.toHaveBeenCalled();
  await act(async () => {
    expect(await view.result.current.change('hands', 'two')).toBe(true);
  });
  expect(save).toHaveBeenLastCalledWith({ hands: 'two' });
  expect(view.result.current.statusFor('hands')).toEqual({ kind: 'saved' });
  expect(view.result.current.form.getValues('name')).toBe('');
  await act(async () => {
    await view.result.current.change('name', 'Sword in two hands');
  });
  expect(save).toHaveBeenLastCalledWith({ name: 'Sword in two hands' });
});

test('invalid natural references stay local while another player changes the limb count', async () => {
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(
    ({ incoming }) => useAttackRoutineForm({ value: incoming, save }),
    { initialProps: { incoming: value } },
  );
  await act(async () => {
    expect(
      await view.result.current.change('naturalAttackEntryIds', ['']),
    ).toBe(false);
  });
  view.rerender({ incoming: { ...value, availableLimbs: '4' } });
  expect(view.result.current.form.getValues()).toMatchObject({
    naturalAttackEntryIds: [''],
    availableLimbs: '4',
  });
  await act(async () => {
    await view.result.current.form.trigger('naturalAttackEntryIds');
  });
  expect(
    JSON.stringify(
      view.result.current.form.formState.errors.naturalAttackEntryIds,
    ),
  ).toContain('Natural attack is required');
  expect(view.result.current.hasRemoteChange).toBe(true);
  expect(save).not.toHaveBeenCalled();
  await act(async () => {
    expect(
      await view.result.current.change('naturalAttackEntryIds', ['bite']),
    ).toBe(true);
  });
  expect(save).toHaveBeenLastCalledWith({ naturalAttackEntryIds: ['bite'] });
});

test('off-hand weapon and double end choices save immediately, and None clears the choice', async () => {
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() => useAttackRoutineForm({ value, save }));
  await act(async () => {
    expect(
      await view.result.current.change('offHand', {
        kind: 'weapon',
        weaponEntryId: 'dagger',
        mode: 'thrown',
      }),
    ).toBe(true);
  });
  expect(save).toHaveBeenLastCalledWith({
    offHand: { kind: 'weapon', weaponEntryId: 'dagger', mode: 'thrown' },
  });
  await act(async () => {
    await view.result.current.change('offHand', {
      kind: 'otherEnd',
      mode: 'melee',
    });
  });
  expect(save).toHaveBeenLastCalledWith({
    offHand: { kind: 'otherEnd', mode: 'melee' },
  });
  await act(async () => {
    await view.result.current.change('offHand', null);
  });
  expect(save).toHaveBeenLastCalledWith({ offHand: null });
  expect(view.result.current.statusFor('offHand')).toEqual({ kind: 'saved' });
});

test('natural attack choices save as a shared list and limb inputs keep invalid drafts local', async () => {
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() => useAttackRoutineForm({ value, save }));
  await act(async () => {
    expect(
      await view.result.current.change('naturalAttackEntryIds', [
        'claw',
        'bite',
      ]),
    ).toBe(true);
  });
  expect(save).toHaveBeenLastCalledWith({
    naturalAttackEntryIds: ['claw', 'bite'],
  });
  await act(async () => {
    expect(await view.result.current.change('availableLimbs', '')).toBe(false);
  });
  expect(
    view.result.current.form.formState.errors.availableLimbs?.message,
  ).toBe('Available limbs is required');
  await act(async () => {
    expect(await view.result.current.change('availableLimbs', 'many')).toBe(
      false,
    );
  });
  expect(
    view.result.current.form.formState.errors.availableLimbs?.message,
  ).toBe('Available limbs must be a whole number of 0 or more');
  await act(async () => {
    expect(await view.result.current.change('availableLimbs', '0')).toBe(true);
    expect(await view.result.current.change('naturalAttackEntryIds', [])).toBe(
      true,
    );
  });
  expect(save.mock.calls).toEqual([
    [{ naturalAttackEntryIds: ['claw', 'bite'] }],
    [{ availableLimbs: '0' }],
    [{ naturalAttackEntryIds: [] }],
  ]);
});

test('an off-hand weapon reference named otherEnd remains a weapon choice', async () => {
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() => useAttackRoutineForm({ value, save }));
  await act(async () => {
    await view.result.current.change('offHand', {
      kind: 'weapon',
      weaponEntryId: 'otherEnd',
      mode: 'melee',
    });
  });
  expect(save).toHaveBeenLastCalledWith({
    offHand: { kind: 'weapon', weaponEntryId: 'otherEnd', mode: 'melee' },
  });
});

test('a refused off-hand draft survives remote main-hand edits and retries independently', async () => {
  const save = vi
    .fn()
    .mockRejectedValueOnce(new ConvexError('Character is read only'))
    .mockResolvedValue(null);
  const incoming = { ...value, offHand: null };
  const view = renderHook(
    ({ value: next }) => useAttackRoutineForm({ value: next, save }),
    { initialProps: { value: incoming } },
  );
  await act(async () => {
    // Same weapon in both hands is unsuitable, but remains a table choice.
    expect(
      await view.result.current.change('offHand', {
        kind: 'weapon',
        weaponEntryId: 'sword',
        mode: 'melee',
      }),
    ).toBe(false);
  });
  view.rerender({ value: { ...incoming, hands: 'two' } });
  expect(view.result.current.form.getValues()).toEqual({
    ...incoming,
    hands: 'two',
    offHand: { kind: 'weapon', weaponEntryId: 'sword', mode: 'melee' },
  });
  expect(view.result.current.hasRemoteChange).toBe(true);
  expect(view.result.current.statusFor('offHand').kind).toBe('error');
  await act(async () => {
    expect(await view.result.current.retry('offHand')).toBe(true);
  });
  expect(save).toHaveBeenLastCalledWith({
    offHand: { kind: 'weapon', weaponEntryId: 'sword', mode: 'melee' },
  });
});

test('quick edits are saved in order without discarding a newer draft', async () => {
  let complete: (() => void) | undefined;
  const save = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    )
    .mockResolvedValue(null);
  const view = renderHook(() => useAttackRoutineForm({ value, save }));
  let first: Promise<boolean> | undefined;
  let second: Promise<boolean> | undefined;
  await act(async () => {
    first = view.result.current.change('name', 'Sword');
  });
  await act(async () => {
    second = view.result.current.change('name', 'Sword strike');
  });
  expect(view.result.current.form.getValues('name')).toBe('Sword strike');
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => {
    complete?.();
    await first;
    await second;
  });
  expect(save.mock.calls).toEqual([
    [{ name: 'Sword' }],
    [{ name: 'Sword strike' }],
  ]);
  expect(view.result.current.form.getValues('name')).toBe('Sword strike');
  expect(view.result.current.form.formState.isDirty).toBe(false);
});

test('older replies cannot acknowledge a newer pending or invalid field draft', async () => {
  const completions: (() => void)[] = [];
  const save = vi.fn(
    () => new Promise<void>((resolve) => completions.push(resolve)),
  );
  const view = renderHook(() => useAttackRoutineForm({ value, save }));
  let first: Promise<boolean> | undefined;
  let second: Promise<boolean> | undefined;
  await act(async () => {
    first = view.result.current.change('name', 'Sword');
  });
  await act(async () => {
    second = view.result.current.change('name', 'Sword strike');
  });
  await act(async () => {
    completions[0]?.();
    await first;
  });
  expect(view.result.current.statusFor('name')).toEqual({ kind: 'saving' });
  await act(async () => {
    await view.result.current.change('name', '');
  });
  await act(async () => {
    completions[1]?.();
    await second;
  });
  expect(view.result.current.form.getValues('name')).toBe('');
  expect(view.result.current.form.formState.errors.name?.message).toBe(
    'Routine name is required',
  );
  expect(view.result.current.statusFor('name')).toEqual({ kind: 'idle' });
});

test('a refused change keeps the draft, remote changes refresh other fields, and retry sends only that field', async () => {
  const save = vi
    .fn()
    .mockRejectedValueOnce(
      new ConvexError('Routine changed. Reload its current values.'),
    )
    .mockResolvedValue(null);
  const view = renderHook(
    ({ incoming }) => useAttackRoutineForm({ value: incoming, save }),
    { initialProps: { incoming: value } },
  );
  await act(async () => {
    expect(await view.result.current.change('name', 'My strike')).toBe(false);
  });
  view.rerender({ incoming: { ...value, name: 'Other strike', hands: 'two' } });
  expect(view.result.current.form.getValues()).toEqual({
    ...value,
    name: 'My strike',
    hands: 'two',
  });
  expect(view.result.current.hasRemoteChange).toBe(true);
  expect(view.result.current.statusFor('name').kind).toBe('error');
  await act(async () => {
    expect(await view.result.current.retry('name')).toBe(true);
  });
  expect(save).toHaveBeenLastCalledWith({ name: 'My strike' });
});

test('an incoming change during a save becomes the baseline without losing a newer remote field', async () => {
  let complete: (() => void) | undefined;
  const save = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  const view = renderHook(
    ({ incoming }) => useAttackRoutineForm({ value: incoming, save }),
    { initialProps: { incoming: value } },
  );
  let pending: Promise<boolean> | undefined;
  await act(async () => {
    pending = view.result.current.change('name', 'Sword');
  });
  view.rerender({ incoming: { ...value, name: 'Other strike', hands: 'two' } });
  await act(async () => {
    complete?.();
    await pending;
  });
  expect(view.result.current.form.getValues()).toEqual({
    ...value,
    name: 'Sword',
    hands: 'two',
  });
  expect(view.result.current.form.formState.defaultValues).toEqual({
    ...value,
    name: 'Other strike',
    hands: 'two',
  });
  expect(view.result.current.form.getFieldState('name').isDirty).toBe(true);
  expect(view.result.current.form.getFieldState('hands').isDirty).toBe(false);
  expect(view.result.current.hasRemoteChange).toBe(true);
});

test('Routine Option choices save as the whole list and a refused list stays local for retry', async () => {
  const save = vi
    .fn()
    .mockRejectedValueOnce(new ConvexError('Choose a Routine Option'))
    .mockResolvedValue(null);
  const view = renderHook(() => useAttackRoutineForm({ value, save }));
  await act(async () => {
    expect(await view.result.current.change('options', ['power-attack'])).toBe(
      false,
    );
  });
  expect(view.result.current.form.getValues('options')).toEqual([
    'power-attack',
  ]);
  expect(view.result.current.statusFor('options').kind).toBe('error');
  await act(async () => {
    expect(await view.result.current.retry('options')).toBe(true);
  });
  expect(save).toHaveBeenLastCalledWith({ options: ['power-attack'] });
  await act(async () => {
    expect(await view.result.current.change('options', [''])).toBe(false);
  });
  expect(view.result.current.form.formState.errors.options).toBeDefined();
  expect(save).toHaveBeenCalledTimes(2);
});
