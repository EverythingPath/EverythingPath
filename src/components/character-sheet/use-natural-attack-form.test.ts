import { act, renderHook } from '@testing-library/react';
import { ConvexError } from 'convex/values';
import { expect, test, vi } from 'vitest';
import { useNaturalAttackForm } from './use-natural-attack-form';

test('choosing a generic natural attack prefills its printed damage and role before creating the entry', async () => {
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() => useNaturalAttackForm({ save }));
  act(() => view.result.current.selectType('tailSlap'));
  expect(view.result.current.form.getValues()).toEqual({
    name: 'Tail slap',
    type: 'tailSlap',
    role: 'secondary',
    isRoleExplicit: false,
    dice: '1d6',
  });
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenLastCalledWith({
    name: 'Tail slap',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      weapon: expect.objectContaining({
        dice: '1d6',
        naturalAttack: { type: 'tailSlap' },
      }),
    },
  });
});

test('a role differing from the printed classification persists as an explicit override', async () => {
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() => useNaturalAttackForm({ save }));
  act(() => view.result.current.form.setValue('role', 'secondary'));
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenLastCalledWith(
    expect.objectContaining({
      detail: expect.objectContaining({
        weapon: expect.objectContaining({
          naturalAttack: { type: 'bite', role: 'secondary' },
        }),
      }),
    }),
  );
});

test('renaming a recorded natural attack retains its customized weapon facts', async () => {
  const value: Parameters<typeof useNaturalAttackForm>[0]['value'] = {
    name: 'Dragon bite',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      weapon: {
        baseType: 'dragon bite',
        proficiency: 'always',
        handedness: 'light',
        attackType: 'melee',
        dice: '2d6',
        threat: 19,
        mult: 3,
        damageTypes: ['piercing'],
        groups: ['dragon', 'natural'],
        strengthDamage: 'crossbow',
        naturalAttack: { type: 'bite' },
      },
    },
  };
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() => useNaturalAttackForm({ value, save }));
  act(() => view.result.current.form.setValue('name', 'Dragon jaws'));
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenLastCalledWith({ ...value, name: 'Dragon jaws' });
});

test('required and malformed dice have distinct errors while a refused attack keeps its draft', async () => {
  const save = vi
    .fn()
    .mockRejectedValueOnce(new ConvexError('Character is read only'))
    .mockResolvedValue(null);
  const view = renderHook(() => useNaturalAttackForm({ save }));
  act(() => view.result.current.form.setValue('dice', ''));
  await act(async () => {
    expect(await view.result.current.save()).toBe('failed');
  });
  expect(view.result.current.form.formState.errors.dice?.message).toBe(
    'Damage dice is required',
  );
  act(() => view.result.current.form.setValue('dice', 'teeth'));
  await act(async () => {
    expect(await view.result.current.save()).toBe('failed');
  });
  expect(view.result.current.form.formState.errors.dice?.message).toBe(
    'Enter damage such as 1d6 or 1',
  );
  expect(save).not.toHaveBeenCalled();
  act(() => {
    view.result.current.form.setValue('name', 'Dragon bite');
    view.result.current.form.setValue('dice', '2d6');
  });
  await act(async () => {
    expect(await view.result.current.save()).toBe('failed');
  });
  expect(view.result.current.status.kind).toBe('error');
  expect(view.result.current.form.getValues('name')).toBe('Dragon bite');
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenLastCalledWith(
    expect.objectContaining({ name: 'Dragon bite' }),
  );
});

test('natural damage accepts a printed flat point of damage and rejects zero', async () => {
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() => useNaturalAttackForm({ save }));
  act(() => view.result.current.form.setValue('dice', '0'));
  await act(async () => {
    expect(await view.result.current.save()).toBe('failed');
  });
  expect(save).not.toHaveBeenCalled();
  act(() => view.result.current.form.setValue('dice', '1'));
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenLastCalledWith(
    expect.objectContaining({
      detail: expect.objectContaining({
        weapon: expect.objectContaining({ dice: '1' }),
      }),
    }),
  );
});

test('explicitly choosing the printed secondary role preserves it for a sole tail slap', async () => {
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() => useNaturalAttackForm({ save }));
  act(() => view.result.current.selectType('tailSlap'));
  act(() => view.result.current.selectRole('secondary'));
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(save).toHaveBeenLastCalledWith(
    expect.objectContaining({
      detail: expect.objectContaining({
        weapon: expect.objectContaining({
          naturalAttack: { type: 'tailSlap', role: 'secondary' },
        }),
      }),
    }),
  );
});
