import { act, renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { useManualProficiencyForm } from './use-manual-proficiency-form';

test('manual changes name categories, weapons, weapon groups and familiarity without inventing a choice', async () => {
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() => useManualProficiencyForm({ save }));
  act(() => {
    view.result.current.form.setValue('kind', 'baseType');
    view.result.current.form.setValue('name', '');
  });
  await act(async () => {
    await view.result.current.save();
  });
  expect(view.result.current.form.formState.errors.name?.message).toBe(
    'Weapon name is required',
  );
  expect(save).not.toHaveBeenCalled();
  act(() => {
    view.result.current.form.setValue('name', '  dwarven waraxe  ', {
      shouldDirty: true,
    });
    view.result.current.form.setValue('asMartial', true, { shouldDirty: true });
  });
  await act(async () => {
    await view.result.current.save();
  });
  expect(save).toHaveBeenLastCalledWith({
    proficiency: { baseType: 'dwarven waraxe', asMartial: true },
    disposition: 'added',
  });
});

test('a manual group removal trims its name and a hidden familiarity option does not change it', async () => {
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() => useManualProficiencyForm({ save }));
  act(() => {
    view.result.current.form.setValue('kind', 'group');
    view.result.current.form.setValue('asMartial', true);
    view.result.current.form.setValue('disposition', 'removed');
  });
  await act(async () => {
    await view.result.current.save();
  });
  expect(view.result.current.form.formState.errors.name?.message).toBe(
    'Weapon group is required',
  );
  act(() =>
    view.result.current.form.setValue('name', '  Close  ', {
      shouldDirty: true,
    }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  expect(save).toHaveBeenLastCalledWith({
    proficiency: { group: 'Close' },
    disposition: 'removed',
  });
  act(() => {
    view.result.current.form.setValue('kind', 'category');
    view.result.current.form.setValue('category', 'towerShield');
  });
  await act(async () => {
    await view.result.current.save();
  });
  expect(save).toHaveBeenLastCalledWith({
    proficiency: { category: 'towerShield' },
    disposition: 'removed',
  });
});

test('a removal editor starts with a clean removal draft and saves that disposition', async () => {
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() =>
    useManualProficiencyForm({ save, startingDisposition: 'removed' }),
  );
  expect(view.result.current.form.getValues('disposition')).toBe('removed');
  expect(view.result.current.form.formState.isDirty).toBe(false);
  act(() =>
    view.result.current.form.setValue('category', 'heavy', {
      shouldDirty: true,
    }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  expect(save).toHaveBeenCalledWith({
    proficiency: { category: 'heavy' },
    disposition: 'removed',
  });
});
