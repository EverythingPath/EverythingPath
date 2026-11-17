import { act, renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import {
  useSkillRankForm,
  useProficiencyChoiceForm,
  useCharacterSheetSkills,
} from './use-character-sheet-skills';
import { buildSheet } from './character-sheet-test-fixture';
import { buildCharacterSheetView } from './character-sheet-view-model';

test('the skills view uses recorded per-level ranks and parsed totals and saves only the chosen field', async () => {
  const sheet = buildCharacterSheetView(
    buildSheet({
      levels: [
        {
          id: 'level-1',
          hp: 10,
          classId: 'fighter',
          skillRanks: { clm: 1, 'skill.per': 1 },
        },
      ],
    }),
  );
  const saveClassLevel = vi.fn().mockResolvedValue(null);
  const view = renderHook(() =>
    useCharacterSheetSkills({ sheet, saveClassLevel }),
  );
  expect(
    view.result.current.skills.find((skill) => skill.key === 'skill.clm'),
  ).toMatchObject({
    key: 'skill.clm',
    name: 'Climb',
    ranks: 1,
    classSkill: false,
  });
  expect(sheet.calculated.breakdowns['skill.clm'].total).toBe(1);
  expect(view.result.current.levels[0]?.ranksFor('skill.clm')).toBe(1);
  expect(view.result.current.levels[0]?.metadata).toMatchObject({
    skillRanksSpent: 2,
    skillRanksRemaining: 0,
  });
  const level = view.result.current.levels[0];
  if (!level) throw new Error('Missing level');
  await view.result.current.saveRank(level._id, 'skill.clm', 5);
  expect(saveClassLevel).toHaveBeenCalledWith(level._id, {
    skillRank: { skill: 'skill.clm', ranks: 5 },
  });
});

test('ranks require a parseable whole number and retain a rejected over-cap draft for retry', async () => {
  const save = vi
    .fn()
    .mockRejectedValueOnce(new Error('Rejected'))
    .mockResolvedValue(null);
  const view = renderHook(() => useSkillRankForm({ ranks: 0, save }));
  for (const [raw, error] of [
    ['', 'Ranks are required'],
    ['many', 'Ranks must be a whole number of 0 or more'],
    ['1.5', 'Ranks must be a whole number of 0 or more'],
  ]) {
    act(() => view.result.current.form.setValue('value', raw!));
    await act(async () => {
      await view.result.current.save();
    });
    expect(view.result.current.form.formState.errors.value?.message).toBe(
      error,
    );
  }
  expect(save).not.toHaveBeenCalled();
  act(() =>
    view.result.current.form.setValue('value', '5', { shouldDirty: true }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  expect(view.result.current.status.kind).toBe('error');
  expect(view.result.current.form.getValues('value')).toBe('5');
  await act(async () => {
    await view.result.current.save();
  });
  expect(save).toHaveBeenLastCalledWith(5);
  expect(view.result.current.status.kind).toBe('saved');
});

test('remote rank changes update pristine values and preserve a dirty field with a notice', () => {
  const view = renderHook(
    ({ ranks }) => useSkillRankForm({ ranks, save: async () => null }),
    { initialProps: { ranks: 1 } },
  );
  view.rerender({ ranks: 2 });
  expect(view.result.current.form.getValues('value')).toBe('2');
  act(() =>
    view.result.current.form.setValue('value', '3', { shouldDirty: true }),
  );
  view.rerender({ ranks: 4 });
  expect(view.result.current.form.getValues('value')).toBe('3');
  expect(view.result.current.hasRemoteChange).toBe(true);
});

test('proficiency choice remains recorded text and may be cleared without inventing a benefit', async () => {
  const save = vi.fn().mockResolvedValue(null);
  const view = renderHook(() =>
    useProficiencyChoiceForm({ choice: null, save }),
  );
  act(() =>
    view.result.current.form.setValue('value', '  longsword  ', {
      shouldDirty: true,
    }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  expect(save).toHaveBeenLastCalledWith('longsword');
  act(() =>
    view.result.current.form.setValue('value', '', { shouldDirty: true }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  expect(save).toHaveBeenLastCalledWith(null);
});

test('clearing a proficiency after its saved echo creates a new dirty draft', async () => {
  let complete: (() => void) | undefined;
  const save = () =>
    new Promise<void>((resolve) => {
      complete = resolve;
    });
  const view = renderHook(
    ({ choice }) => useProficiencyChoiceForm({ choice, save }),
    { initialProps: { choice: '' } },
  );
  act(() =>
    view.result.current.form.setValue('value', 'longsword', {
      shouldDirty: true,
    }),
  );
  let saving: Promise<'saved' | 'failed'> | undefined;
  await act(async () => {
    saving = view.result.current.save();
  });
  view.rerender({ choice: 'longsword' });
  await act(async () => {
    complete?.();
    await saving;
  });
  expect(view.result.current.form.formState.isDirty).toBe(false);
  act(() =>
    view.result.current.form.setValue('value', '', { shouldDirty: true }),
  );
  expect(view.result.current.form.formState.isDirty).toBe(true);
});

test.each([
  ['ranks', 'before'],
  ['ranks', 'after'],
  ['ranks', 'unchanged'],
  ['proficiency', 'before'],
  ['proficiency', 'after'],
  ['proficiency', 'unchanged'],
] as const)(
  'normalized %s are pristine when the echo arrives %s acknowledgement',
  async (field, echo) => {
    let complete: (() => void) | undefined;
    const save = vi.fn(
      (_value: number | string | null) =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    const accepted = field === 'ranks' ? '5' : 'longsword';
    const draft = field === 'ranks' ? '05' : '  longsword  ';
    const initial =
      echo === 'unchanged' ? accepted : field === 'ranks' ? '0' : '';
    const view = renderHook(
      ({ incoming }) =>
        field === 'ranks'
          ? useSkillRankForm({ ranks: Number(incoming), save })
          : useProficiencyChoiceForm({ choice: incoming, save }),
      { initialProps: { incoming: initial } },
    );
    act(() =>
      view.result.current.form.setValue('value', draft, { shouldDirty: true }),
    );
    let saving: Promise<'saved' | 'failed'> | undefined;
    await act(async () => {
      saving = view.result.current.save();
    });
    if (echo !== 'after') view.rerender({ incoming: accepted });
    await act(async () => {
      complete?.();
      await saving;
    });
    if (echo === 'after') view.rerender({ incoming: accepted });
    expect(save).toHaveBeenCalledWith(field === 'ranks' ? 5 : 'longsword');
    expect(view.result.current.form.getValues('value')).toBe(accepted);
    expect(view.result.current.form.formState.isDirty).toBe(false);
    expect(view.result.current.hasRemoteChange).toBe(false);
  },
);

test.each([
  ['ranks', 'before'],
  ['ranks', 'after'],
  ['ranks', 'unchanged'],
  ['proficiency', 'before'],
  ['proficiency', 'after'],
  ['proficiency', 'unchanged'],
] as const)(
  'a newer %s draft survives the normalized echo %s acknowledgement',
  async (field, echo) => {
    let complete: (() => void) | undefined;
    const save = (_value: number | string | null) =>
      new Promise<void>((resolve) => {
        complete = resolve;
      });
    const accepted = field === 'ranks' ? '5' : 'longsword';
    const draft = field === 'ranks' ? '05' : '  longsword  ';
    const newer = field === 'ranks' ? '6' : '  shortbow  ';
    const initial =
      echo === 'unchanged' ? accepted : field === 'ranks' ? '0' : '';
    const view = renderHook(
      ({ incoming }) =>
        field === 'ranks'
          ? useSkillRankForm({ ranks: Number(incoming), save })
          : useProficiencyChoiceForm({ choice: incoming, save }),
      { initialProps: { incoming: initial } },
    );
    act(() =>
      view.result.current.form.setValue('value', draft, { shouldDirty: true }),
    );
    let saving: Promise<'saved' | 'failed'> | undefined;
    await act(async () => {
      saving = view.result.current.save();
    });
    act(() =>
      view.result.current.form.setValue('value', newer, { shouldDirty: true }),
    );
    if (echo !== 'after') view.rerender({ incoming: accepted });
    await act(async () => {
      complete?.();
      await saving;
    });
    if (echo === 'after') view.rerender({ incoming: accepted });
    expect(view.result.current.form.getValues('value')).toBe(newer);
    expect(view.result.current.form.formState.isDirty).toBe(true);
    expect(view.result.current.hasRemoteChange).toBe(false);
  },
);

test('an edit made while ranks save remains a dirty draft after the earlier value is acknowledged', async () => {
  let complete: (() => void) | undefined;
  const save = () =>
    new Promise<void>((resolve) => {
      complete = resolve;
    });
  const view = renderHook(({ ranks }) => useSkillRankForm({ ranks, save }), {
    initialProps: { ranks: 1 },
  });
  act(() =>
    view.result.current.form.setValue('value', '2', { shouldDirty: true }),
  );
  let saving: Promise<'saved' | 'failed'> | undefined;
  await act(async () => {
    saving = view.result.current.save();
  });
  act(() =>
    view.result.current.form.setValue('value', '3', { shouldDirty: true }),
  );
  view.rerender({ ranks: 2 });
  await act(async () => {
    complete?.();
    await saving;
  });
  expect(view.result.current.form.getValues('value')).toBe('3');
  expect(view.result.current.form.formState.isDirty).toBe(true);
  expect(view.result.current.hasRemoteChange).toBe(false);
});

test('a remote value arriving during a save preserves the local draft and leaves its notice visible', async () => {
  let complete: (() => void) | undefined;
  const save = () =>
    new Promise<void>((resolve) => {
      complete = resolve;
    });
  const view = renderHook(({ ranks }) => useSkillRankForm({ ranks, save }), {
    initialProps: { ranks: 1 },
  });
  act(() =>
    view.result.current.form.setValue('value', '2', { shouldDirty: true }),
  );
  let saving: Promise<'saved' | 'failed'> | undefined;
  await act(async () => {
    saving = view.result.current.save();
  });
  view.rerender({ ranks: 4 });
  await act(async () => {
    complete?.();
    await saving;
  });
  expect(view.result.current.form.getValues('value')).toBe('2');
  expect(view.result.current.form.formState.isDirty).toBe(true);
  expect(view.result.current.hasRemoteChange).toBe(true);
});

test.each([
  [0, '', 'Ranks are required'],
  [5, '5.0', 'Ranks must be a whole number of 0 or more'],
] as const)(
  'a newer invalid rank draft %s → "%s" is kept after acknowledgement',
  async (submitted, draft, message) => {
    let complete: (() => void) | undefined;
    const save = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    const view = renderHook(() => useSkillRankForm({ ranks: 1, save }));
    act(() =>
      view.result.current.form.setValue('value', String(submitted), {
        shouldDirty: true,
      }),
    );
    let saving: Promise<'saved' | 'failed'> | undefined;
    await act(async () => {
      saving = view.result.current.save();
    });
    act(() =>
      view.result.current.form.setValue('value', draft, { shouldDirty: true }),
    );
    await act(async () => {
      complete?.();
      await saving;
    });
    expect(view.result.current.form.getValues('value')).toBe(draft);
    expect(view.result.current.form.formState.isDirty).toBe(true);
    await act(async () => {
      await view.result.current.save();
    });
    expect(view.result.current.form.formState.errors.value?.message).toBe(
      message,
    );
    expect(save).toHaveBeenCalledTimes(1);
  },
);
