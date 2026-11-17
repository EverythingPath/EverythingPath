import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';
import type { AnimalCompanionProgressionState } from '~/lib/character-sheet-companion-progression';
import {
  companionAbilities,
  companionProgressionInput,
  useCompanionProgressionForm,
  type CompanionProgressionForm,
  type CompanionProgressionFormValues,
} from './use-companion-progression-form';

const choices: AnimalCompanionProgressionState = {
  species: 'wolf',
  hpGained: 27,
  skillRanks: { 'skill.per': 3 },
  abilityIncreases: ['dexterity', 'strength', 'dexterity'],
  advancementChoice: 'abilityScores',
  keep: true,
};

async function submit(
  form: CompanionProgressionForm,
  recorded: AnimalCompanionProgressionState | null,
) {
  let values: CompanionProgressionFormValues | undefined;
  await act(async () => {
    await form.handleSubmit((draft) => {
      values = draft;
    })();
  });
  return values ? companionProgressionInput(values, recorded) : null;
}

test('a remote change refreshes untouched fields and keeps a malformed edited HP draft', async () => {
  const { result, rerender } = renderHook(
    ({ recorded }) => useCompanionProgressionForm(recorded),
    { initialProps: { recorded: choices } },
  );
  result.current.register('hp.value');
  result.current.register('ranks.per');
  await act(async () => {
    result.current.setValue('hp.value', 'oops', {
      shouldDirty: true,
      shouldValidate: true,
    });
  });
  expect(result.current.formState.errors.hp?.value?.message).toBe(
    'Enter a number.',
  );
  const remote = {
    ...choices,
    species: 'horse' as const,
    hpGained: 35,
    skillRanks: { 'skill.per': 5 },
  };
  rerender({ recorded: remote });
  await waitFor(() =>
    expect(result.current.getValues('species')).toBe('horse'),
  );
  expect(result.current.getValues('ranks.per')).toBe('5');
  expect(result.current.getValues('hp.value')).toBe('oops');
  expect(await submit(result.current, remote)).toBeNull();
  expect(result.current.formState.errors.hp?.value?.message).toBe(
    'Enter a number.',
  );
});

test.each([
  ['', 'Enter hit points.'],
  ['abc', 'Enter a number.'],
  ['1.5', 'Hit points must be a whole number of 0 or more'],
  ['-1', 'Hit points must be a whole number of 0 or more'],
])(
  'recorded HP %j exposes its own field error and prevents submit',
  async (value, message) => {
    const { result } = renderHook(() => useCompanionProgressionForm(choices));
    act(() => result.current.setValue('hp.value', value));
    expect(await submit(result.current, choices)).toBeNull();
    expect(result.current.formState.errors.hp?.value?.message).toBe(message);
  },
);

test('an explicit unrecorded HP choice saves null and a recorded zero stays zero', async () => {
  const { result } = renderHook(() => useCompanionProgressionForm(null));
  expect(result.current.getValues('hp')).toEqual({
    isUnrecorded: true,
    value: '',
  });
  act(() => result.current.setValue('species', 'wolf'));
  expect(await submit(result.current, null)).toMatchObject({ hpGained: null });
  act(() => {
    result.current.setValue('hp.isUnrecorded', false);
    result.current.setValue('hp.value', '0');
  });
  expect(await submit(result.current, null)).toMatchObject({ hpGained: 0 });
});

test('submit canonicalizes skill keys and retains recorded increase order and advancement choices', async () => {
  const { result } = renderHook(() => useCompanionProgressionForm(choices));
  for (const ability of companionAbilities)
    result.current.register(`abilityIncreases.${ability}`);
  expect(Object.keys(result.current.getValues('abilityIncreases'))).toEqual([
    'strength',
    'dexterity',
    'constitution',
    'intelligence',
    'wisdom',
    'charisma',
  ]);
  act(() => {
    result.current.setValue('ranks.per', ' 4 ');
    result.current.setValue('ranks.acr', '0');
    result.current.setValue('abilityIncreases.strength', '2');
  });
  expect(await submit(result.current, choices)).toMatchObject({
    skillRanks: { 'skill.per': 4, 'skill.acr': 0 },
    abilityIncreases: ['dexterity', 'strength', 'dexterity', 'strength'],
    advancementChoice: 'abilityScores',
    keep: true,
  });
});

test('rank and ability counts report malformed or fractional input without submitting', async () => {
  const { result } = renderHook(() => useCompanionProgressionForm(choices));
  act(() => {
    result.current.setValue('ranks.per', 'abc');
    result.current.setValue('abilityIncreases.strength', '1.5');
  });
  expect(await submit(result.current, choices)).toBeNull();
  expect(result.current.formState.errors.ranks?.per?.message).toBe(
    'Enter a number.',
  );
  expect(
    result.current.formState.errors.abilityIncreases?.strength?.message,
  ).toBe('Increases must be a whole number of 0 or more');
});
