import { act, renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { useAbilityChangeForm } from './use-ability-change-form';

test('damage entry requires whole points and preserves a refused draft for retry', async () => {
  const save = vi
    .fn()
    .mockRejectedValueOnce(new Error('Rejected'))
    .mockResolvedValue(null);
  const view = renderHook(() => useAbilityChangeForm({ save }));
  await act(async () => {
    await view.result.current.save();
  });
  expect(view.result.current.form.formState.errors.points?.message).toBe(
    'Points are required',
  );
  act(() => view.result.current.form.setValue('points', 'many'));
  await act(async () => {
    await view.result.current.save();
  });
  expect(view.result.current.form.formState.errors.points?.message).toBe(
    'Points must be a whole number of 0 or more',
  );
  act(() => view.result.current.form.setValue('points', '3'));
  await act(async () => {
    await view.result.current.save();
  });
  expect(view.result.current.status.kind).toBe('error');
  expect(view.result.current.form.getValues('points')).toBe('3');
  await act(async () => {
    await view.result.current.save();
  });
  expect(save).toHaveBeenLastCalledWith({
    kind: 'abilityDamage',
    ability: 'strength',
    points: 3,
  });
  expect(view.result.current.status.kind).toBe('saved');
});

test('remote points refresh a pristine field and preserve dirty edits with a remote notice', async () => {
  const initial = {
    kind: 'abilityDamage' as const,
    ability: 'strength' as const,
    points: 2,
  };
  const view = renderHook(
    ({ value }) => useAbilityChangeForm({ value, save: async () => null }),
    { initialProps: { value: initial } },
  );
  view.rerender({ value: { ...initial, points: 3 } });
  expect(view.result.current.form.getValues('points')).toBe('3');
  act(() =>
    view.result.current.form.setValue('points', '4', { shouldDirty: true }),
  );
  view.rerender({ value: { ...initial, points: 5 } });
  expect(view.result.current.form.getValues('points')).toBe('4');
  expect(view.result.current.hasRemoteChange).toBe(true);
});
