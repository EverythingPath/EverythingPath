import type { Id } from '@convex/_generated/dataModel';
import { act, renderHook } from '@testing-library/react';
import { expect, test } from 'vitest';
import {
  usePersonalAdjustmentForm,
  type PersonalAdjustmentSaveOutcome,
} from './use-personal-adjustment-form';
import type { PersonalAdjustmentInput } from './use-character-sheet';

type FormModifier = ReturnType<
  typeof usePersonalAdjustmentForm
>['fields'][number];

test('personal adjustments distinguish missing, malformed and fractional ability values; other Modifiers accept fractions', async () => {
  const saved: PersonalAdjustmentInput[] = [];
  const view = renderHook(() =>
    usePersonalAdjustmentForm({
      save: async (input) => {
        saved.push(input);
      },
    }),
  );
  await act(async () => {
    expect(await view.result.current.save()).toBe('failed');
  });
  expect(view.result.current.form.formState.errors.name?.message).toBe(
    'Adjustment name is required',
  );
  expect(
    view.result.current.form.formState.errors.modifiers?.[0]?.value?.message,
  ).toBe('Modifier value is required');
  act(() => {
    view.result.current.form.setValue('name', '  Table reward  ', {
      shouldDirty: true,
    });
    view.result.current.form.setValue('modifiers.0.value', 'many', {
      shouldDirty: true,
    });
  });
  await act(async () => {
    await view.result.current.save();
  });
  expect(
    view.result.current.form.formState.errors.modifiers?.[0]?.value?.message,
  ).toBe('Modifier value must be a number');
  expect(saved).toEqual([]);
  act(() =>
    view.result.current.form.setValue('modifiers.0.value', '-2.5', {
      shouldDirty: true,
    }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  expect(
    view.result.current.form.getFieldState('modifiers.0.value').error?.message,
  ).toBe('Ability score modifiers must be whole numbers');
  expect(saved).toEqual([]);
  act(() =>
    view.result.current.form.setValue('modifiers.0.target', 'save.will', {
      shouldDirty: true,
    }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  expect(saved).toEqual([
    {
      name: 'Table reward',
      modifiers: [{ target: 'save.will', bonusType: 'untyped', value: -2.5 }],
    },
  ]);
  expect(view.result.current.status.kind).toBe('saved');
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
});

test('remote changes refresh pristine adjustments but preserve an entire dirty modifier list', async () => {
  const initial: PersonalAdjustmentInput = {
    name: 'Blessing',
    modifiers: [
      { target: 'save.will', bonusType: 'morale', value: 2 },
      { target: 'save.fort', bonusType: 'morale', value: 2 },
    ],
  };
  const view = renderHook(
    ({ adjustment }) =>
      usePersonalAdjustmentForm({ adjustment, save: async () => undefined }),
    { initialProps: { adjustment: initial } },
  );
  const updated: PersonalAdjustmentInput = {
    ...initial,
    name: 'Greater blessing',
  };
  view.rerender({ adjustment: updated });
  expect(view.result.current.form.getValues('name')).toBe('Greater blessing');
  act(() => {
    view.result.current.dismissRemoteChange();
    view.result.current.removeModifier(0);
    view.result.current.form.setValue('modifiers.0.value', 'bad', {
      shouldDirty: true,
    });
  });
  await act(async () => {
    await view.result.current.save();
  });
  view.rerender({ adjustment: initial });
  expect(view.result.current.hasRemoteChange).toBe(true);
  expect(view.result.current.form.getValues('modifiers')).toEqual([
    { target: 'save.fort', bonusType: 'morale', value: 'bad' },
  ]);
  expect(
    view.result.current.form.formState.errors.modifiers?.[0]?.value?.message,
  ).toBe('Modifier value must be a number');
});

test('a refused adjustment keeps its draft and retry, and successful saves recognize their own echo', async () => {
  const initial: PersonalAdjustmentInput = {
    name: 'Blessing',
    modifiers: [{ target: 'save.will', bonusType: 'morale', value: 2 }],
  };
  let refuse = true;
  let persisted = initial;
  const view = renderHook(
    ({ adjustment }) =>
      usePersonalAdjustmentForm({
        adjustment,
        save: async (input) => {
          if (refuse) throw new Error('Connection lost');
          persisted = input;
        },
      }),
    { initialProps: { adjustment: initial } },
  );
  act(() =>
    view.result.current.form.setValue('modifiers.0.value', '4.50', {
      shouldDirty: true,
    }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  expect(view.result.current.status.kind).toBe('error');
  await act(async () => {
    expect(await view.result.current.save()).toBe('failed');
  });
  expect(view.result.current.form.getValues('modifiers.0.value')).toBe('4.50');
  refuse = false;
  await act(async () => {
    await view.result.current.save();
  });
  expect(persisted.modifiers[0]?.value).toBe(4.5);
  expect(view.result.current.form.formState.isDirty).toBe(false);
  view.rerender({ adjustment: persisted });
  expect(view.result.current.hasRemoteChange).toBe(false);
  expect(view.result.current.status.kind).toBe('saved');
  view.rerender({ adjustment: initial });
  expect(view.result.current.form.getValues('modifiers.0.value')).toBe('2');
  expect(view.result.current.hasRemoteChange).toBe(true);
});

test('a saved adjustment recognizes its own echo with reordered condition keys and keeps a newer invalid draft', async () => {
  const whileActive = 'known' as Id<'catalogEntry'>;
  const initial: PersonalAdjustmentInput = {
    name: 'Conditional blessing',
    modifiers: [
      {
        target: 'save.will',
        bonusType: 'morale',
        value: 2,
        condition: { whileActive, situation: 'spells' },
      },
    ],
  };
  let persisted = initial;
  const view = renderHook(
    ({ adjustment }) =>
      usePersonalAdjustmentForm({
        adjustment,
        save: async (input) => {
          persisted = input;
        },
      }),
    { initialProps: { adjustment: initial } },
  );
  act(() =>
    view.result.current.form.setValue('modifiers.0.value', '4', {
      shouldDirty: true,
    }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  expect(persisted.modifiers[0]?.value).toBe(4);
  expect(view.result.current.form.formState.isDirty).toBe(false);
  act(() =>
    view.result.current.form.setValue('modifiers.0.value', 'not yet a number', {
      shouldDirty: true,
    }),
  );
  view.rerender({
    adjustment: {
      ...persisted,
      modifiers: persisted.modifiers.map((modifier) => ({
        ...modifier,
        condition: { whileActive, situation: 'spells' },
      })),
    },
  });
  expect(view.result.current.hasRemoteChange).toBe(false);
  expect(view.result.current.status.kind).toBe('saved');
  expect(view.result.current.form.getValues('modifiers.0.value')).toBe(
    'not yet a number',
  );
  expect(view.result.current.form.formState.isDirty).toBe(true);
});

test('a pending save runs once and retains newer edits against a later remote overwrite', async () => {
  const initial: PersonalAdjustmentInput = {
    name: 'Blessing',
    modifiers: [{ target: 'save.will', bonusType: 'morale', value: 2 }],
  };
  let accept: (() => void) | undefined;
  let writes = 0;
  const view = renderHook(
    ({ adjustment }) =>
      usePersonalAdjustmentForm({
        adjustment,
        save: () => {
          writes++;
          return new Promise<void>((resolve) => {
            accept = resolve;
          });
        },
      }),
    { initialProps: { adjustment: initial } },
  );
  act(() =>
    view.result.current.form.setValue('modifiers.0.value', '4', {
      shouldDirty: true,
    }),
  );
  let pending: Promise<PersonalAdjustmentSaveOutcome> | undefined;
  await act(async () => {
    pending = view.result.current.save();
  });
  view.rerender({
    adjustment: {
      ...initial,
      modifiers: [{ target: 'save.will', bonusType: 'morale', value: 4 }],
    },
  });
  expect(view.result.current.hasRemoteChange).toBe(false);
  act(() =>
    view.result.current.form.setValue('modifiers.0.value', '6', {
      shouldDirty: true,
    }),
  );
  view.rerender({ adjustment: initial });
  expect(view.result.current.hasRemoteChange).toBe(true);
  await act(async () => {
    expect(await view.result.current.save()).toBe('failed');
  });
  expect(writes).toBe(1);
  await act(async () => {
    accept?.();
    expect(await pending).toBe('remote-conflict');
  });
  expect(view.result.current.form.getValues('modifiers.0.value')).toBe('6');
  expect(view.result.current.form.formState.isDirty).toBe(true);
});

test('a saved draft remains dirty against a remote overwrite even when the reply arrives last', async () => {
  const initial: PersonalAdjustmentInput = {
    name: 'Blessing',
    modifiers: [{ target: 'save.will', bonusType: 'morale', value: 2 }],
  };
  let accept: (() => void) | undefined;
  let writes = 0;
  const view = renderHook(
    ({ adjustment }) =>
      usePersonalAdjustmentForm({
        adjustment,
        save: () => {
          writes++;
          return new Promise<void>((resolve) => {
            accept = resolve;
          });
        },
      }),
    { initialProps: { adjustment: initial } },
  );
  act(() =>
    view.result.current.form.setValue('modifiers.0.value', '4', {
      shouldDirty: true,
    }),
  );
  let pending: Promise<PersonalAdjustmentSaveOutcome> | undefined;
  await act(async () => {
    pending = view.result.current.save();
  });
  view.rerender({
    adjustment: {
      ...initial,
      modifiers: [{ target: 'save.will', bonusType: 'morale', value: 4 }],
    },
  });
  view.rerender({ adjustment: initial });
  await act(async () => {
    accept?.();
    expect(await pending).toBe('remote-conflict');
  });
  expect(view.result.current.form.getValues('modifiers.0.value')).toBe('4');
  expect(view.result.current.form.formState.isDirty).toBe(true);
  act(() =>
    view.result.current.form.setValue('modifiers.0.value', '2', {
      shouldDirty: true,
    }),
  );
  await act(async () => {
    await view.result.current.save();
  });
  expect(writes).toBe(1);
  expect(view.result.current.form.formState.isDirty).toBe(false);
});

test('a numeric editor preserves each modifier condition across list edits', async () => {
  const initial: PersonalAdjustmentInput = {
    name: 'Resolve',
    modifiers: [
      {
        target: 'save.will',
        bonusType: 'morale',
        value: 2,
        condition: { situation: { local: 'vs. fear' } },
      },
      { target: 'save.fort', bonusType: 'resistance', value: 1 },
    ],
  };
  let persisted = initial;
  const view = renderHook(() =>
    usePersonalAdjustmentForm({
      adjustment: initial,
      save: async (input) => {
        persisted = input;
      },
    }),
  );
  act(() => {
    view.result.current.removeModifier(1);
    view.result.current.addModifier();
    view.result.current.form.setValue('modifiers.0.value', '4', {
      shouldDirty: true,
    });
    view.result.current.form.setValue('modifiers.1.value', '1', {
      shouldDirty: true,
    });
  });
  await act(async () => {
    await view.result.current.save();
  });
  expect(persisted.modifiers).toEqual([
    {
      target: 'save.will',
      bonusType: 'morale',
      value: 4,
      condition: { situation: { local: 'vs. fear' } },
    },
    { target: 'ability.str', bonusType: 'untyped', value: 1 },
  ]);
});

test('personal adjustments refuse the reserved base bonus type', async () => {
  const saved: PersonalAdjustmentInput[] = [];
  const view = renderHook(() =>
    usePersonalAdjustmentForm({
      save: async (input) => {
        saved.push(input);
      },
    }),
  );
  act(() => {
    view.result.current.form.setValue('name', 'Base replacement', {
      shouldDirty: true,
    });
    view.result.current.form.setValue('modifiers.0.value', '18', {
      shouldDirty: true,
    });
    view.result.current.form.setValue(
      'modifiers.0.bonusType',
      'base' as unknown as FormModifier['bonusType'],
      { shouldDirty: true },
    );
  });
  await act(async () => {
    await view.result.current.save();
  });
  expect(saved).toEqual([]);
  expect(
    view.result.current.form.formState.errors.modifiers?.[0]?.bonusType,
  ).toBeDefined();
});

test.each([
  { weapon: '$self' },
  { weaponSelection: 'longsword' },
  { option: true },
])(
  'unsupported modifier condition %j produces field errors instead of silently saving',
  async (condition) => {
    const saved: PersonalAdjustmentInput[] = [];
    const view = renderHook(() =>
      usePersonalAdjustmentForm({
        save: async (input) => {
          saved.push(input);
        },
      }),
    );
    act(() => {
      view.result.current.form.setValue('name', 'Weapon blessing', {
        shouldDirty: true,
      });
      view.result.current.form.setValue('modifiers.0.value', '2', {
        shouldDirty: true,
      });
      view.result.current.form.setValue(
        'modifiers.0.condition',
        condition as unknown as FormModifier['condition'],
        { shouldDirty: true },
      );
    });
    await act(async () => {
      expect(await view.result.current.save()).toBe('failed');
    });
    expect(saved).toEqual([]);
    expect(
      view.result.current.form.formState.errors.modifiers?.[0]?.condition,
    ).toBeDefined();
  },
);

test('formula mode preserves supported and unsupported expressions as formulas instead of coercing numbers', async () => {
  // #298 Formulas: unsupported text is retained for the resolver warning.
  const saved: PersonalAdjustmentInput[] = [];
  const view = renderHook(() =>
    usePersonalAdjustmentForm({
      save: async (input) => {
        saved.push(input);
      },
    }),
  );
  act(() => {
    view.result.current.form.setValue('name', 'Formula');
    view.result.current.form.setValue('modifiers.0.valueKind', 'formula');
    view.result.current.form.setValue('modifiers.0.value', 'floor(@level / 2)');
  });
  await act(async () => {
    expect(await view.result.current.save()).toBe('saved');
  });
  expect(saved[0]?.modifiers[0]?.value).toEqual({
    formula: 'floor(@level / 2)',
  });
});

test('a second save cannot acknowledge an unchanged draft while its earlier write is pending', async () => {
  const adjustment: PersonalAdjustmentInput = {
    name: 'Blessing',
    modifiers: [],
  };
  let complete: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const view = renderHook(() =>
    usePersonalAdjustmentForm({ adjustment, save: () => pending }),
  );
  act(() =>
    view.result.current.form.setValue('name', 'Greater blessing', {
      shouldDirty: true,
    }),
  );
  let saving: Promise<PersonalAdjustmentSaveOutcome> | undefined;
  await act(async () => {
    saving = view.result.current.save();
  });
  expect(view.result.current.status.kind).toBe('saving');
  act(() =>
    view.result.current.form.setValue('name', 'Blessing', {
      shouldDirty: true,
    }),
  );
  await act(async () => {
    expect(await view.result.current.save()).toBe('failed');
  });
  expect(view.result.current.status.kind).toBe('saving');
  await act(async () => {
    complete?.();
    await saving;
  });
  expect(view.result.current.form.getValues('name')).toBe('Blessing');
  expect(view.result.current.form.formState.isDirty).toBe(true);
});

test.each(['9007199254740992', '-9007199254740992'])(
  'numeric ability modifiers reject unsafe integers (%s) while formulas retain their expression',
  async (value) => {
    const saved: PersonalAdjustmentInput[] = [];
    const view = renderHook(() =>
      usePersonalAdjustmentForm({
        save: async (input) => {
          saved.push(input);
        },
      }),
    );
    act(() => {
      view.result.current.form.setValue('name', 'Ability adjustment');
      view.result.current.form.setValue('modifiers.0.value', value);
    });
    await act(async () => {
      expect(await view.result.current.save()).toBe('failed');
    });
    expect(saved).toEqual([]);
    expect(
      view.result.current.form.getFieldState('modifiers.0.value').error
        ?.message,
    ).toBe('Ability score modifiers must be whole numbers');
    act(() => {
      view.result.current.form.setValue('modifiers.0.valueKind', 'formula');
    });
    await act(async () => {
      expect(await view.result.current.save()).toBe('saved');
    });
    expect(saved[0]?.modifiers[0]?.value).toEqual({ formula: value });
  },
);

test('personal adjustments reject a catalog ability score choice target', async () => {
  const saved: PersonalAdjustmentInput[] = [];
  const view = renderHook(() =>
    usePersonalAdjustmentForm({
      save: async (input) => {
        saved.push(input);
      },
    }),
  );
  act(() => {
    view.result.current.form.setValue('name', 'Invalid choice');
    view.result.current.form.setValue('modifiers.0.value', '2');
    // @ts-expect-error Deliberately submit a catalog-only target through the form.
    view.result.current.form.setValue('modifiers.0.target', 'ability.$choice');
  });
  await act(async () => {
    expect(await view.result.current.save()).toBe('failed');
  });
  expect(saved).toEqual([]);
  expect(
    view.result.current.form.getFieldState('modifiers.0.target').error,
  ).toBeDefined();
});
