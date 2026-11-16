import { act, renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { useOffListSpellLevelForm } from './use-off-list-spell-level-form';

test('an off-list Spell requires an explicit whole-number level, including levels beyond ordinary allowances', async () => {
  const save = vi.fn().mockResolvedValue(true);
  const view = renderHook(() => useOffListSpellLevelForm({ save }));
  await act(async () => {
    expect(await view.result.current.save()).toBe(false);
  });
  expect(view.result.current.error).toBe('Spell level is required');
  act(() => view.result.current.form.setValue('level', 'one'));
  await act(async () => {
    await view.result.current.save();
  });
  expect(view.result.current.error).toBe(
    'Spell level must be a whole number of 0 or more',
  );
  expect(save).not.toHaveBeenCalled();
  act(() => view.result.current.form.setValue('level', ' 12 '));
  await act(async () => {
    expect(await view.result.current.save()).toBe(true);
  });
  expect(save).toHaveBeenCalledWith(12);
});

test('a refused off-list addition retains the entered level for retry', async () => {
  const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
  const view = renderHook(() => useOffListSpellLevelForm({ level: 3, save }));
  act(() => view.result.current.form.setValue('level', '5'));
  await act(async () => {
    expect(await view.result.current.save()).toBe(false);
  });
  expect(view.result.current.form.getValues('level')).toBe('5');
  await act(async () => {
    expect(await view.result.current.save()).toBe(true);
  });
  expect(save).toHaveBeenLastCalledWith(5);
});
