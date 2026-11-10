import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ConvexError } from 'convex/values';
import type { CreationSettings } from '~/lib/character-sheet';
import {
  useBaseScoresForm,
  useClassLevelForm,
  useClassLevelChoicesForm,
  useCreationSettingsForm,
} from './use-sheet-forms';

test('a missing HP choice stays blank and can be saved; malformed HP has a field error', async () => {
  let persisted: number | null = 8;
  const view = renderHook(() =>
    useClassLevelForm({
      hpGained: null,
      save: async (hp) => {
        persisted = hp;
      },
    }),
  );
  expect(view.result.current.form.getValues('hpGained')).toBe('');
  act(() =>
    view.result.current.form.setValue('hpGained', 'oops', {
      shouldDirty: true,
    }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  await waitFor(() =>
    expect(view.result.current.form.formState.errors.hpGained?.message).toBe(
      'Hit points must be a number',
    ),
  );
  expect(persisted).toBe(8);
  act(() =>
    view.result.current.form.setValue('hpGained', '', { shouldDirty: true }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  expect(view.result.current.form.formState.errors.hpGained).toBeUndefined();
  expect(view.result.current.form.getValues('hpGained')).toBe('');
});

test('base score errors distinguish empty and malformed without blocking unusual scores', async () => {
  const scores = {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  };
  const saved: Partial<typeof scores>[] = [];
  const view = renderHook(() =>
    useBaseScoresForm({
      scores,
      save: async (changes) => {
        saved.push(changes);
      },
    }),
  );
  act(() => {
    view.result.current.form.setValue('strength', '', { shouldDirty: true });
    view.result.current.form.setValue('dexterity', 'twelve', {
      shouldDirty: true,
    });
  });
  await act(async () => {
    await view.result.current.save();
  });
  expect(view.result.current.form.formState.errors.strength?.message).toBe(
    'Strength is required',
  );
  expect(view.result.current.form.formState.errors.dexterity?.message).toBe(
    'Dexterity must be a number',
  );
  expect(saved).toEqual([]);
  act(() => {
    view.result.current.form.setValue('strength', '-2', { shouldDirty: true });
    view.result.current.form.setValue('dexterity', '10', { shouldDirty: true });
  });
  await act(async () => {
    await view.result.current.save();
  });
  expect(saved).toEqual([{ strength: -2 }]);
});

test('remote scores update pristine fields while retaining dirty inputs and field errors', async () => {
  const scores = {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  };
  let saved = {};
  const view = renderHook(
    ({ scores }) =>
      useBaseScoresForm({
        scores,
        save: async (changes) => {
          saved = changes;
        },
      }),
    { initialProps: { scores } },
  );
  act(() =>
    view.result.current.form.setValue('strength', 'bad', { shouldDirty: true }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  view.rerender({ scores: { ...scores, strength: 14, dexterity: 16 } });
  expect(view.result.current.form.getValues('strength')).toBe('bad');
  expect(view.result.current.form.getValues('dexterity')).toBe('16');
  expect(view.result.current.form.formState.errors.strength?.message).toBe(
    'Strength must be a number',
  );
  expect(view.result.current.hasRemoteChange).toBe(true);
  act(() =>
    view.result.current.form.setValue('strength', '18', { shouldDirty: true }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  expect(saved).toEqual({ strength: 18 });
});

test('a save settling after a remote update keeps the remote scores and newer local edits', async () => {
  const scores = {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  };
  let accept: (() => void) | undefined;
  let writes = 0;
  const view = renderHook(
    ({ scores }) =>
      useBaseScoresForm({
        scores,
        save: () => {
          writes++;
          return new Promise<void>((resolve) => {
            accept = resolve;
          });
        },
      }),
    { initialProps: { scores } },
  );
  act(() =>
    view.result.current.form.setValue('strength', '14', { shouldDirty: true }),
  );
  let pending: Promise<void> | undefined;
  await act(async () => {
    pending = view.result.current.save();
  });
  view.rerender({ scores: { ...scores, dexterity: 16 } });
  act(() =>
    view.result.current.form.setValue('strength', '18', { shouldDirty: true }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  expect(writes).toBe(1);
  await act(async () => {
    accept?.();
    await pending;
  });
  expect(view.result.current.form.getValues('strength')).toBe('18');
  expect(view.result.current.form.getValues('dexterity')).toBe('16');
  expect(view.result.current.form.formState.dirtyFields.strength).toBe(true);
  expect(view.result.current.form.formState.dirtyFields.dexterity).not.toBe(
    true,
  );
  view.rerender({ scores: { ...scores, strength: 14, dexterity: 16 } });
  expect(view.result.current.form.getValues('strength')).toBe('18');
});

test('a refused HP save keeps the draft and retry; its own subscription echo is not a remote change', async () => {
  let refuse = true;
  let persisted: number | null = 8;
  const view = renderHook(
    ({ hpGained }) =>
      useClassLevelForm({
        hpGained,
        save: async (hp) => {
          if (refuse) throw new ConvexError('Editing is paused');
          persisted = hp;
        },
      }),
    { initialProps: { hpGained: 8 } },
  );
  act(() =>
    view.result.current.form.setValue('hpGained', '0', { shouldDirty: true }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  expect(view.result.current.status).toEqual({
    kind: 'error',
    message:
      "Changes weren't saved: Editing is paused. Your edits are kept. Save to try again.",
  });
  expect(view.result.current.form.getValues('hpGained')).toBe('0');
  expect(persisted).toBe(8);
  refuse = false;
  await act(async () => {
    await view.result.current.save();
  });
  expect(persisted).toBe(0);
  expect(view.result.current.status.kind).toBe('saved');
  view.rerender({ hpGained: 0 });
  expect(view.result.current.hasRemoteChange).toBe(false);
  act(() =>
    view.result.current.form.setValue('hpGained', '', { shouldDirty: true }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  expect(persisted).toBeNull();
});

test('a later matching remote HP update does not acknowledge an unknown failed save', async () => {
  let writes = 0;
  const view = renderHook(
    ({ hpGained }) =>
      useClassLevelForm({
        hpGained,
        save: async () => {
          writes++;
          throw new Error('Connection closed');
        },
      }),
    { initialProps: { hpGained: 8 } },
  );
  act(() =>
    view.result.current.form.setValue('hpGained', '11', { shouldDirty: true }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  expect(view.result.current.status).toEqual({
    kind: 'error',
    message:
      'Changes may not have been saved. Your edits are kept. Check them, then Save to try again.',
  });
  view.rerender({ hpGained: 11 });
  expect(view.result.current.status.kind).toBe('error');
  expect(view.result.current.hasRemoteChange).toBe(true);
  expect(view.result.current.form.getValues('hpGained')).toBe('11');
  await act(async () => {
    await view.result.current.save();
  });
  expect(writes).toBe(1);
  expect(view.result.current.status.kind).toBe('idle');
  expect(view.result.current.form.formState.isDirty).toBe(false);
  expect(view.result.current.form.getValues('hpGained')).toBe('11');
});

test('a later remote overwrite stays authoritative when the earlier save reply finally arrives', async () => {
  let accept: (() => void) | undefined;
  const view = renderHook(
    ({ hpGained }) =>
      useClassLevelForm({
        hpGained,
        save: () =>
          new Promise<void>((resolve) => {
            accept = resolve;
          }),
      }),
    { initialProps: { hpGained: 8 } },
  );
  act(() =>
    view.result.current.form.setValue('hpGained', '14', { shouldDirty: true }),
  );
  let pending: Promise<void> | undefined;
  await act(async () => {
    pending = view.result.current.save();
  });
  view.rerender({ hpGained: 14 });
  expect(view.result.current.hasRemoteChange).toBe(false);
  view.rerender({ hpGained: 16 });
  expect(view.result.current.hasRemoteChange).toBe(true);
  await act(async () => {
    accept?.();
    await pending;
  });
  // A retained draft must be visibly unsaved against the later remote value.
  expect(view.result.current.form.getValues('hpGained')).toBe('14');
  expect(view.result.current.form.formState.dirtyFields.hpGained).toBe(true);
});

test('recorded fractional ability scores require correction while fractional HP stays saveable', async () => {
  const scores = {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 99.5,
    charisma: 10,
  };
  let saved = {};
  const abilities = renderHook(() =>
    useBaseScoresForm({
      scores,
      save: async (changes) => {
        saved = changes;
      },
    }),
  );
  act(() =>
    abilities.result.current.form.setValue('strength', '14', {
      shouldDirty: true,
    }),
  );
  await act(async () => {
    await abilities.result.current.save();
  });
  expect(saved).toEqual({});
  expect(
    abilities.result.current.form.getFieldState('wisdom').error?.message,
  ).toBe('Wisdom must be a whole number');
  let hp: number | null = null;
  const level = renderHook(() =>
    useClassLevelForm({
      hpGained: null,
      save: async (value) => {
        hp = value;
      },
    }),
  );
  act(() =>
    level.result.current.form.setValue('hpGained', '4.5', {
      shouldDirty: true,
    }),
  );
  await act(async () => {
    await level.result.current.save();
  });
  expect(hp).toBe(4.5);
});

test('an observed own HP update stays acknowledged when its reply is later lost', async () => {
  let refuse: ((error: unknown) => void) | undefined;
  let writes = 0;
  const view = renderHook(
    ({ hpGained }) =>
      useClassLevelForm({
        hpGained,
        save: () => {
          writes++;
          return new Promise<void>((_resolve, reject) => {
            refuse = reject;
          });
        },
      }),
    { initialProps: { hpGained: 8 } },
  );
  act(() =>
    view.result.current.form.setValue('hpGained', '11', { shouldDirty: true }),
  );
  let pending: Promise<void> | undefined;
  await act(async () => {
    pending = view.result.current.save();
  });
  view.rerender({ hpGained: 11 });
  await act(async () => {
    refuse?.(new Error('Connection closed'));
    await pending;
  });
  expect(view.result.current.status.kind).toBe('saved');
  expect(view.result.current.hasRemoteChange).toBe(false);
  await act(async () => {
    await view.result.current.save();
  });
  expect(writes).toBe(1);
});

test('formatted numeric drafts recognize canonical own echoes without discarding raw input', async () => {
  let refuse: ((error: unknown) => void) | undefined;
  const view = renderHook(
    ({ hpGained }) =>
      useClassLevelForm({
        hpGained,
        save: () =>
          new Promise<void>((_resolve, reject) => {
            refuse = reject;
          }),
      }),
    { initialProps: { hpGained: 8 } },
  );
  act(() =>
    view.result.current.form.setValue('hpGained', '4.50', {
      shouldDirty: true,
    }),
  );
  let pending: Promise<void> | undefined;
  await act(async () => {
    pending = view.result.current.save();
  });
  view.rerender({ hpGained: 4.5 });
  expect(view.result.current.hasRemoteChange).toBe(false);
  expect(view.result.current.form.getValues('hpGained')).toBe('4.50');
  await act(async () => {
    refuse?.(new Error('Connection closed'));
    await pending;
  });
  expect(view.result.current.status.kind).toBe('saved');
});

test.each(['success', 'echo-before-loss'])(
  'an acknowledged formatted save follows later remote changes (%s)',
  async (outcome) => {
    let accept: (() => void) | undefined;
    let refuse: ((error: unknown) => void) | undefined;
    const view = renderHook(
      ({ hpGained }) =>
        useClassLevelForm({
          hpGained,
          save: () =>
            new Promise<void>((resolve, reject) => {
              accept = resolve;
              refuse = reject;
            }),
        }),
      { initialProps: { hpGained: 8 } },
    );
    act(() =>
      view.result.current.form.setValue('hpGained', '4.50', {
        shouldDirty: true,
      }),
    );
    let pending: Promise<void> | undefined;
    await act(async () => {
      pending = view.result.current.save();
    });
    view.rerender({ hpGained: 4.5 });
    await act(async () => {
      if (outcome === 'success') accept?.();
      else refuse?.(new Error('Connection closed'));
      await pending;
    });
    expect(view.result.current.status.kind).toBe('saved');
    expect(view.result.current.form.formState.defaultValues).toEqual({
      hpGained: '4.5',
    });
    expect(view.result.current.form.getValues('hpGained')).toBe('4.5');
    expect(view.result.current.form.formState.dirtyFields.hpGained).not.toBe(
      true,
    );
    view.rerender({ hpGained: 6 });
    expect(view.result.current.form.getValues('hpGained')).toBe('6');
    expect(view.result.current.hasRemoteChange).toBe(true);
  },
);

test('a malformed newer draft is retained even when Number would coerce it to the saved value', async () => {
  let accept: (() => void) | undefined;
  const view = renderHook(() =>
    useClassLevelForm({
      hpGained: 8,
      save: () =>
        new Promise<void>((resolve) => {
          accept = resolve;
        }),
    }),
  );
  act(() =>
    view.result.current.form.setValue('hpGained', '14', { shouldDirty: true }),
  );
  let pending: Promise<void> | undefined;
  await act(async () => {
    pending = view.result.current.save();
  });
  act(() =>
    view.result.current.form.setValue('hpGained', '0xE', { shouldDirty: true }),
  );
  await act(async () => {
    accept?.();
    await pending;
  });
  expect(view.result.current.form.getValues('hpGained')).toBe('0xE');
  await act(async () => {
    await view.result.current.save();
  });
  expect(view.result.current.form.formState.errors.hpGained?.message).toBe(
    'Hit points must be a number',
  );
});

test('an unknown score save keeps newer drafts and treats later matching scores as remote', async () => {
  const scores = {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  };
  const view = renderHook(
    ({ scores }) =>
      useBaseScoresForm({
        scores,
        save: async () => {
          throw new Error('Connection closed');
        },
      }),
    { initialProps: { scores } },
  );
  act(() => {
    view.result.current.form.setValue('strength', '14', { shouldDirty: true });
    view.result.current.form.setValue('dexterity', '16', { shouldDirty: true });
  });
  await act(async () => {
    await view.result.current.save();
  });
  act(() => {
    view.result.current.form.setValue('strength', '18', { shouldDirty: true });
  });
  view.rerender({ scores: { ...scores, strength: 14 } });
  expect(view.result.current.hasRemoteChange).toBe(true);
  expect(view.result.current.status.kind).toBe('error');
  act(() => view.result.current.dismissRemoteChange());
  view.rerender({ scores: { ...scores, strength: 14, dexterity: 16 } });
  expect(view.result.current.hasRemoteChange).toBe(true);
  expect(view.result.current.status.kind).toBe('error');
  expect(view.result.current.form.getValues('strength')).toBe('18');
  expect(view.result.current.form.formState.dirtyFields.strength).toBe(true);
});

test('creation settings separate empty and malformed fields while allowing unusual budgets and trait counts', async () => {
  const writes: unknown[] = [];
  const view = renderHook(() =>
    useCreationSettingsForm({
      settings: {
        abilityMethod: { kind: 'pointBuy', budget: 15 },
        traitCount: 2,
        campaignTraitRequired: false,
      },
      save: async (changes) => {
        writes.push(changes);
      },
    }),
  );
  expect(view.result.current.form.getValues()).toEqual({
    abilityMethod: 'pointBuy',
    pointBuyBudget: '15',
    traitCount: '2',
    campaignTraitRequired: false,
  });
  act(() => {
    view.result.current.form.setValue('pointBuyBudget', '', {
      shouldDirty: true,
    });
    view.result.current.form.setValue('traitCount', 'two', {
      shouldDirty: true,
    });
  });
  await act(async () => {
    await view.result.current.save();
  });
  expect(
    view.result.current.form.formState.errors.pointBuyBudget?.message,
  ).toBe('Point-buy budget is required');
  expect(view.result.current.form.formState.errors.traitCount?.message).toBe(
    'Trait count must be a number',
  );
  expect(writes).toEqual([]);
  act(() => {
    view.result.current.form.setValue('pointBuyBudget', '40', {
      shouldDirty: true,
    });
    view.result.current.form.setValue('traitCount', '0', {
      shouldDirty: true,
    });
    view.result.current.form.setValue('campaignTraitRequired', true, {
      shouldDirty: true,
    });
  });
  await act(async () => {
    await view.result.current.save();
  });
  expect(writes).toEqual([
    {
      abilityMethod: { kind: 'pointBuy', budget: 40 },
      traitCount: 0,
      campaignTraitRequired: true,
    },
  ]);
});

test.each(['invalid', '-1', '2.5'])(
  'rolled scores ignore the invalid hidden budget %s and keep other creation choices',
  async (hiddenBudget) => {
    const saved: unknown[] = [];
    const view = renderHook(() =>
      useCreationSettingsForm({
        settings: {
          abilityMethod: { kind: 'pointBuy', budget: 15 },
          traitCount: 2,
          campaignTraitRequired: false,
        },
        save: async (changes) => {
          saved.push(changes);
        },
      }),
    );
    act(() => {
      view.result.current.form.setValue('pointBuyBudget', hiddenBudget, {
        shouldDirty: true,
      });
      view.result.current.form.setValue('abilityMethod', 'rolled', {
        shouldDirty: true,
      });
      view.result.current.form.setValue('traitCount', '4', {
        shouldDirty: true,
      });
    });
    await act(async () => {
      await view.result.current.save();
    });
    expect(saved).toEqual([
      { abilityMethod: { kind: 'rolled', budget: 15 }, traitCount: 4 },
    ]);
    expect(
      view.result.current.form.formState.errors.pointBuyBudget,
    ).toBeUndefined();
    expect(view.result.current.status.kind).toBe('saved');
  },
);

test.each([
  ['pointBuyBudget', 'Point-buy budget', '-1'],
  ['pointBuyBudget', 'Point-buy budget', '2.5'],
  ['traitCount', 'Trait count', '-1'],
  ['traitCount', 'Trait count', '2.5'],
] as const)(
  '%s rejects the structurally invalid value %s %s before saving',
  async (field, label, value) => {
    const writes: unknown[] = [];
    const view = renderHook(() =>
      useCreationSettingsForm({
        settings: {
          abilityMethod: { kind: 'pointBuy', budget: 15 },
          traitCount: 2,
          campaignTraitRequired: false,
        },
        save: async (changes) => {
          writes.push(changes);
        },
      }),
    );
    act(() =>
      view.result.current.form.setValue(field, value, { shouldDirty: true }),
    );
    await act(async () => view.result.current.save());
    expect(view.result.current.form.formState.errors[field]?.message).toBe(
      `${label} must be a whole number of 0 or more`,
    );
    expect(writes).toEqual([]);
    expect(view.result.current.form.getValues(field)).toBe(value);
    act(() =>
      view.result.current.form.setValue(field, '0', { shouldDirty: true }),
    );
    await act(async () => view.result.current.save());
    expect(writes).toEqual([
      field === 'pointBuyBudget'
        ? { abilityMethod: { kind: 'pointBuy', budget: 0 } }
        : { traitCount: 0 },
    ]);
  },
);

test('creation settings retain refused drafts and remote pristine choices, then acknowledge only their saved patch', async () => {
  const settings = {
    abilityMethod: { kind: 'pointBuy' as const, budget: 15 },
    traitCount: 2,
    campaignTraitRequired: false,
  };
  let fail = true;
  const writes: unknown[] = [];
  const view = renderHook(
    ({ settings }) =>
      useCreationSettingsForm({
        settings,
        save: async (changes) => {
          if (fail) throw new ConvexError('Editing is paused');
          writes.push(changes);
        },
      }),
    { initialProps: { settings } },
  );
  act(() => {
    view.result.current.form.setValue('pointBuyBudget', '25', {
      shouldDirty: true,
    });
  });
  await act(async () => {
    await view.result.current.save();
  });
  expect(view.result.current.status.kind).toBe('error');
  expect(view.result.current.form.getValues('pointBuyBudget')).toBe('25');
  view.rerender({
    settings: { ...settings, traitCount: 3, campaignTraitRequired: true },
  });
  expect(view.result.current.hasRemoteChange).toBe(true);
  expect(view.result.current.form.getValues()).toEqual({
    abilityMethod: 'pointBuy',
    pointBuyBudget: '25',
    traitCount: '3',
    campaignTraitRequired: true,
  });
  act(() => {
    view.result.current.dismissRemoteChange();
  });
  fail = false;
  await act(async () => {
    await view.result.current.save();
  });
  expect(writes).toEqual([{ abilityMethod: { kind: 'pointBuy', budget: 25 } }]);
  view.rerender({
    settings: {
      ...settings,
      abilityMethod: { kind: 'pointBuy', budget: 25 },
      traitCount: 3,
      campaignTraitRequired: true,
    },
  });
  expect(view.result.current.hasRemoteChange).toBe(false);
  expect(view.result.current.status.kind).toBe('saved');
});

test('a point-buy budget retained through rolled mode is the budget saved on returning to point buy', async () => {
  const writes: unknown[] = [];
  const settings: CreationSettings = {
    abilityMethod: { kind: 'pointBuy', budget: 15 },
    traitCount: 2,
    campaignTraitRequired: false,
  };
  const view = renderHook(
    ({ settings }) =>
      useCreationSettingsForm({
        settings,
        save: async (changes) => {
          writes.push(changes);
        },
      }),
    { initialProps: { settings } },
  );
  act(() => {
    view.result.current.form.setValue('pointBuyBudget', '20', {
      shouldDirty: true,
    });
    view.result.current.form.setValue('abilityMethod', 'rolled', {
      shouldDirty: true,
    });
  });
  await act(async () => {
    await view.result.current.save();
  });
  view.rerender({
    settings: { ...settings, abilityMethod: { kind: 'rolled' } },
  });
  act(() => {
    view.result.current.form.setValue('abilityMethod', 'pointBuy', {
      shouldDirty: true,
    });
  });
  expect(view.result.current.form.getValues('pointBuyBudget')).toBe('20');
  await act(async () => {
    await view.result.current.save();
  });
  expect(writes).toEqual([
    { abilityMethod: { kind: 'rolled', budget: 20 } },
    { abilityMethod: { kind: 'pointBuy', budget: 20 } },
  ]);
});

test('a remote switch to rolled preserves the dirty budget for an explicit switch back', async () => {
  const writes: unknown[] = [];
  const settings: CreationSettings = {
    abilityMethod: { kind: 'pointBuy', budget: 15 },
    traitCount: 2,
    campaignTraitRequired: false,
  };
  const view = renderHook(
    ({ settings }) =>
      useCreationSettingsForm({
        settings,
        save: async (changes) => {
          writes.push(changes);
        },
      }),
    { initialProps: { settings } },
  );
  act(() => {
    view.result.current.form.setValue('pointBuyBudget', '30', {
      shouldDirty: true,
    });
  });
  view.rerender({
    settings: { ...settings, abilityMethod: { kind: 'rolled' } },
  });
  expect(view.result.current.hasRemoteChange).toBe(true);
  expect(view.result.current.form.getValues('abilityMethod')).toBe('rolled');
  expect(view.result.current.form.getValues('pointBuyBudget')).toBe('30');
  act(() => {
    view.result.current.form.setValue('abilityMethod', 'pointBuy', {
      shouldDirty: true,
    });
  });
  await act(async () => {
    await view.result.current.save();
  });
  expect(writes).toEqual([{ abilityMethod: { kind: 'pointBuy', budget: 30 } }]);
});

test('a saved rolled interval preserves the point-buy budget after reopening the editor', async () => {
  let settings: CreationSettings = {
    abilityMethod: { kind: 'pointBuy', budget: 27 },
    traitCount: 2,
    campaignTraitRequired: false,
  };
  const save = async (changes: Partial<CreationSettings>) => {
    settings = { ...settings, ...changes };
  };
  const first = renderHook(() => useCreationSettingsForm({ settings, save }));
  act(() =>
    first.result.current.form.setValue('abilityMethod', 'rolled', {
      shouldDirty: true,
    }),
  );
  await act(async () => first.result.current.save());
  expect(settings.abilityMethod).toEqual({ kind: 'rolled', budget: 27 });
  first.unmount();
  const reopened = renderHook(() =>
    useCreationSettingsForm({ settings, save }),
  );
  act(() =>
    reopened.result.current.form.setValue('abilityMethod', 'pointBuy', {
      shouldDirty: true,
    }),
  );
  expect(reopened.result.current.form.getValues('pointBuyBudget')).toBe('27');
  await act(async () => reopened.result.current.save());
  expect(settings.abilityMethod).toEqual({ kind: 'pointBuy', budget: 27 });
});

test('class choice form saves only changed row choices and validates class references before saving', async () => {
  const classId = 'fighter';
  const changes: unknown[] = [];
  const view = renderHook(() =>
    useClassLevelChoicesForm({
      classEntryId: null,
      classChoices: [{ _id: classId, name: 'Fighter' }],
      favoredClassBonus: null,
      abilityIncrease: null,
      save: async (value) => {
        changes.push(value);
      },
    }),
  );
  act(() =>
    view.result.current.form.setValue('classEntryId', 'unknown', {
      shouldDirty: true,
    }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  expect(view.result.current.form.formState.errors.classEntryId?.message).toBe(
    'Choose an available class',
  );
  expect(changes).toEqual([]);
  act(() => {
    view.result.current.form.setValue('classEntryId', classId, {
      shouldDirty: true,
    });
    view.result.current.form.setValue('favoredClassBonus', 'alt', {
      shouldDirty: true,
    });
    view.result.current.form.setValue('favoredClassNote', 'Extra spell', {
      shouldDirty: true,
    });
    view.result.current.form.setValue('abilityIncrease', 'intelligence', {
      shouldDirty: true,
    });
  });
  await act(async () => {
    await view.result.current.save();
  });
  expect(changes).toEqual([
    {
      classEntryId: classId,
      favoredClassBonus: { choice: 'alt', note: 'Extra spell' },
      abilityIncrease: 'intelligence',
    },
  ]);
});

test('alternative favored-class notes preserve numeric-looking text as prose', async () => {
  const changes: unknown[] = [];
  const view = renderHook(() =>
    useClassLevelChoicesForm({
      classEntryId: null,
      classChoices: [],
      favoredClassBonus: { choice: 'alt', note: '001' },
      abilityIncrease: null,
      save: async (value) => {
        changes.push(value);
      },
    }),
  );
  act(() =>
    view.result.current.form.setValue('favoredClassNote', '1', {
      shouldDirty: true,
    }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  expect(changes).toEqual([
    { favoredClassBonus: { choice: 'alt', note: '1' } },
  ]);
});

test.each(['', '   '])(
  'Other favored-class bonus requires a nonempty note (%j)',
  async (note) => {
    const changes: unknown[] = [];
    const view = renderHook(() =>
      useClassLevelChoicesForm({
        classEntryId: null,
        classChoices: [],
        favoredClassBonus: null,
        abilityIncrease: null,
        save: async (value) => {
          changes.push(value);
        },
      }),
    );
    act(() => {
      view.result.current.form.setValue('favoredClassBonus', 'alt', {
        shouldDirty: true,
      });
      view.result.current.form.setValue('favoredClassNote', note, {
        shouldDirty: true,
      });
    });
    await act(async () => {
      await view.result.current.save();
    });
    expect(
      view.result.current.form.formState.errors.favoredClassNote?.message,
    ).toBe('Describe the alternative favored class bonus');
    expect(changes).toEqual([]);
    act(() => {
      view.result.current.form.setValue('favoredClassNote', 'Extra spell', {
        shouldDirty: true,
      });
    });
    await act(async () => {
      await view.result.current.save();
    });
    expect(changes).toEqual([
      { favoredClassBonus: { choice: 'alt', note: 'Extra spell' } },
    ]);
  },
);

test('an unavailable recorded class does not block other choices or silently replace the stored reference', async () => {
  const writes: unknown[] = [];
  const view = renderHook(() =>
    useClassLevelChoicesForm({
      classEntryId: 'deleted-class',
      classChoices: [{ _id: 'fighter', name: 'Fighter' }],
      favoredClassBonus: null,
      abilityIncrease: null,
      save: async (changes) => {
        writes.push(changes);
      },
    }),
  );
  expect(view.result.current.form.getValues('classEntryId')).toBe('');
  act(() =>
    view.result.current.form.setValue('abilityIncrease', 'strength', {
      shouldDirty: true,
    }),
  );
  await act(async () => view.result.current.save());
  expect(writes).toEqual([{ abilityIncrease: 'strength' }]);
  act(() =>
    view.result.current.form.setValue('classEntryId', 'fighter', {
      shouldDirty: true,
    }),
  );
  await act(async () => view.result.current.save());
  expect(writes.at(-1)).toEqual({ classEntryId: 'fighter' });
});
