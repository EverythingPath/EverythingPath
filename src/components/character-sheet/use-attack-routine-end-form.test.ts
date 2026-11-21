import { act, renderHook } from '@testing-library/react';
import { ConvexError } from 'convex/values';
import { expect, test, vi } from 'vitest';
import { useAttackWeaponEndForm } from './use-attack-routine-form';

test('each weapon-end field saves independently and invalid enhancement stays local', async () => {
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() =>
    useAttackWeaponEndForm({ value: { enhancement: 1 }, save }),
  );
  await act(async () => {
    expect(await view.result.current.change('enhancement', '')).toBe(false);
  });
  expect(view.result.current.form.formState.errors.enhancement?.message).toBe(
    'Enhancement is required',
  );
  await act(async () => {
    expect(await view.result.current.change('enhancement', 'keen')).toBe(false);
  });
  expect(view.result.current.form.formState.errors.enhancement?.message).toBe(
    'Enhancement must be a whole number of 0 or more',
  );
  expect(save).not.toHaveBeenCalled();
  await act(async () => {
    await view.result.current.change('masterwork', true);
    // A rules mismatch is advisory: +6 remains a saveable whole number.
    await view.result.current.change('enhancement', '6');
    await view.result.current.change('material', '  cold iron  ');
  });
  expect(save.mock.calls).toEqual([
    [{ masterwork: true }],
    [{ enhancement: 6 }],
    [{ material: 'cold iron' }],
  ]);
  expect(view.result.current.statusFor('enhancement')).toEqual({
    kind: 'saved',
  });
});

test('a refused end field retains its draft while remote values refresh other fields', async () => {
  const save = vi
    .fn()
    .mockRejectedValueOnce(new ConvexError('Character is read only'))
    .mockResolvedValue(null);
  const view = renderHook(
    ({ enhancement }) =>
      useAttackWeaponEndForm({ value: { enhancement }, save }),
    { initialProps: { enhancement: 1 } },
  );
  await act(async () => {
    expect(await view.result.current.change('material', 'silver')).toBe(false);
  });
  view.rerender({ enhancement: 2 });
  expect(view.result.current.form.getValues()).toEqual({
    enhancement: '2',
    masterwork: false,
    material: 'silver',
  });
  expect(view.result.current.hasRemoteChange).toBe(true);
  expect(view.result.current.statusFor('material').kind).toBe('error');
  await act(async () => {
    expect(await view.result.current.retry('material')).toBe(true);
  });
  expect(save).toHaveBeenLastCalledWith({ material: 'silver' });
});
