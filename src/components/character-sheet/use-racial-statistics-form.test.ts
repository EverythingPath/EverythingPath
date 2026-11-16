import { act, renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { findRacialProgression } from '~/lib/character-sheet-creature-types';
import {
  racialStatisticsInput,
  useRacialStatisticsForm,
} from './use-racial-statistics-form';

const statistics = {
  racialHitDice: 0,
  racialHpGained: null,
  racialSkillRanks: {},
  progression: null,
};
const save = async () => true;

test('HP and rank saves without a progression send the atomic null-progression payload', async () => {
  const write = vi.fn(async () => true);
  const { result } = renderHook(() =>
    useRacialStatisticsForm(statistics, write),
  );
  act(() => {
    result.current.form.setValue('racialHpGained', '12');
    result.current.ranks.append({ skill: 'per', ranks: '2' });
  });
  await act(async () => expect(await result.current.save()).toBe('saved'));
  expect(write).toHaveBeenCalledWith({
    racialHitDice: 0,
    racialHpGained: 12,
    racialSkillRanks: { per: 2 },
    racialProgression: null,
  });
});

test('unknown skills and duplicate aliases cannot save ranks that would be dropped or counted twice', async () => {
  const write = vi.fn(async () => true);
  const { result } = renderHook(() =>
    useRacialStatisticsForm(statistics, write),
  );
  act(() => result.current.ranks.append({ skill: 'Perception', ranks: '2' }));
  await act(async () => expect(await result.current.save()).toBe('failed'));
  expect(
    result.current.form.getFieldState('ranks.0.skill').error?.message,
  ).toBe('Choose a skill');
  act(() => {
    result.current.form.setValue('ranks.0.skill', 'acr');
    result.current.ranks.append({ skill: 'skill.acr', ranks: '1' });
  });
  await act(async () => expect(await result.current.save()).toBe('failed'));
  expect(
    result.current.form.getFieldState('ranks.1.skill').error?.message,
  ).toBe('Each skill once');
  expect(write).not.toHaveBeenCalled();
});

test('choosing a creature type seeds editable fields without prefilling racial HP or inventing HD', async () => {
  const { result } = renderHook(() =>
    useRacialStatisticsForm(statistics, save),
  );
  act(() => result.current.chooseCreatureType('dragon'));
  expect(result.current.form.getValues()).toMatchObject({
    racialHitDice: '0',
    racialHpGained: '',
    progression: {
      creatureType: 'Dragon',
      hitDie: '12',
      bab: 'full',
      skillRanksPerHitDie: '6',
    },
  });
  act(() => {
    result.current.form.setValue('racialHitDice', '3');
    result.current.form.setValue('progression.hitDie', '10');
  });
  await act(async () => expect(await result.current.form.trigger()).toBe(true));
  expect(racialStatisticsInput(result.current.form.getValues())).toMatchObject({
    racialHitDice: 3,
    racialHpGained: null,
    racialProgression: { creatureType: 'Dragon', hitDie: 10 },
  });
});

test('empty and malformed numeric values have distinct field errors while unknown racial HP remains valid', async () => {
  const { result } = renderHook(() =>
    useRacialStatisticsForm(statistics, save),
  );
  act(() => result.current.form.setValue('racialHitDice', ''));
  await act(async () =>
    expect(await result.current.form.trigger()).toBe(false),
  );
  expect(result.current.form.formState.errors.racialHitDice?.message).toBe(
    'Racial Hit Dice is required',
  );
  act(() => result.current.form.setValue('racialHitDice', 'many'));
  await act(async () =>
    expect(await result.current.form.trigger()).toBe(false),
  );
  expect(result.current.form.formState.errors.racialHitDice?.message).toBe(
    'Racial Hit Dice must be a number',
  );
  act(() => result.current.form.setValue('racialHitDice', '0'));
  await act(async () => expect(await result.current.form.trigger()).toBe(true));
  expect(
    racialStatisticsInput(result.current.form.getValues()).racialHpGained,
  ).toBeNull();
});

test('a live update keeps unsaved racial input and announces changed saved values', () => {
  const view = renderHook(({ value }) => useRacialStatisticsForm(value, save), {
    initialProps: { value: statistics },
  });
  act(() =>
    view.result.current.form.setValue('racialHitDice', '5', {
      shouldDirty: true,
    }),
  );
  view.rerender({ value: { ...statistics, racialHitDice: 2 } });
  expect(view.result.current.form.getValues('racialHitDice')).toBe('5');
  expect(view.result.current.hasRemoteChange).toBe(true);
});

test('a successful save acknowledges its live echo quietly while a later player edit is announced', async () => {
  const view = renderHook(({ value }) => useRacialStatisticsForm(value, save), {
    initialProps: { value: statistics },
  });
  act(() =>
    view.result.current.form.setValue('racialHitDice', ' 003 ', {
      shouldDirty: true,
    }),
  );
  await act(async () => expect(await view.result.current.save()).toBe('saved'));
  view.rerender({ value: { ...statistics, racialHitDice: 3 } });
  expect(view.result.current.hasRemoteChange).toBe(false);
  expect(view.result.current.status).toEqual({ kind: 'saved' });
  view.rerender({ value: { ...statistics, racialHitDice: 4 } });
  expect(view.result.current.hasRemoteChange).toBe(true);
});

test('a refused save keeps its draft and error, and a later player change is announced', async () => {
  const view = renderHook(
    ({ value }) => useRacialStatisticsForm(value, async () => false),
    { initialProps: { value: statistics } },
  );
  act(() =>
    view.result.current.form.setValue('racialHitDice', '3', {
      shouldDirty: true,
    }),
  );
  await act(async () =>
    expect(await view.result.current.save()).toBe('failed'),
  );
  expect(view.result.current.form.getValues('racialHitDice')).toBe('3');
  expect(view.result.current.status.kind).toBe('error');
  view.rerender({ value: { ...statistics, racialHitDice: 3 } });
  expect(view.result.current.hasRemoteChange).toBe(true);
});

test('an alphabetically reordered live progression and rank record still acknowledge the local save quietly', async () => {
  const seed = findRacialProgression('dragon');
  if (!seed) throw new Error('Missing dragon seed');
  const initial: Parameters<typeof useRacialStatisticsForm>[0] = statistics;
  const view = renderHook(
    ({ value }: { value: Parameters<typeof useRacialStatisticsForm>[0] }) =>
      useRacialStatisticsForm(value, save),
    { initialProps: { value: initial } },
  );
  act(() => {
    view.result.current.chooseCreatureType('dragon');
    view.result.current.ranks.append({ skill: 'per', ranks: '2' });
    view.result.current.ranks.append({ skill: 'acr', ranks: '1' });
  });
  await act(async () => expect(await view.result.current.save()).toBe('saved'));
  view.rerender({
    value: {
      ...statistics,
      racialSkillRanks: { acr: 1, per: 2 },
      progression: {
        bab: seed.bab,
        classSkills: seed.classSkills,
        creatureType: seed.creatureType,
        hitDie: seed.hitDie,
        saves: {
          will: seed.saves.will,
          ref: seed.saves.ref,
          fort: seed.saves.fort,
        },
        skillRanksPerHitDie: seed.skillRanksPerHitDie,
      },
    },
  });
  expect(view.result.current.hasRemoteChange).toBe(false);
});
