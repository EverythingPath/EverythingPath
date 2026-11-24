import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '../use-initial-migration-maintenance';
import type { RacialChoiceRowView } from './character-sheet-races-view-model';
import { RaceEquivalenceChoice } from './race-equivalence-choice';
import type { useCharacterSheet } from './use-character-sheet';

// racial-heritage-counts-as: Racial Heritage's race equivalence names every
// imported humanoid race, most of which a campaign's catalog may not hold.
// The control offers the races the sheet can name, and keeps a saved race it
// cannot name as the current value, never as an option.

type Controller = ReturnType<typeof useCharacterSheet>;

const maintenance = vi.fn<() => MigrationMaintenance>();
vi.mock('../use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => maintenance(),
}));
vi.mock(
  '../ui/select',
  () => import('../weekly-draft-workspace/native-select-test-double'),
);

const chooseRaceEquivalence = vi.fn(() => Promise.resolve(true));
beforeEach(() => {
  vi.clearAllMocks();
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
});

const actions = {
  statusFor: () => ({ kind: 'idle' as const }),
  chooseRaceEquivalence,
} as unknown as Controller['races'];
const raceNames = { 'race/elf': 'Elf', 'race/gnome': 'Gnome' };
const row = (choice: string | null): RacialChoiceRowView => ({
  rowId: 'heritage-row',
  selection: undefined,
  name: 'Racial Heritage',
  target: { entryId: 'heritage-row' },
  counting: true,
  abilityScoreChoice: false,
  abilityChoiceCount: undefined,
  secondChoice: null,
  raceChoices: ['race/elf', 'race/gnome', 'race/kobold', 'race/tengu'],
  choice,
});
const options = () =>
  within(screen.getByRole('combobox', { name: 'Counts as race' }))
    .getAllByRole<HTMLOptionElement>('option')
    // The test double's own blank option.
    .filter((option) => option.value !== '')
    .map((option) => ({
      label: option.textContent,
      disabled: option.disabled,
    }));

test('only the races the sheet can name are offered', () => {
  render(
    <RaceEquivalenceChoice
      row={row(null)}
      raceNames={raceNames}
      actions={actions}
    />,
  );
  expect(options()).toEqual([
    { label: 'Choose race', disabled: false },
    { label: 'Elf', disabled: false },
    { label: 'Gnome', disabled: false },
  ]);
  fireEvent.change(screen.getByRole('combobox', { name: 'Counts as race' }), {
    target: { value: 'race/gnome' },
  });
  expect(chooseRaceEquivalence).toHaveBeenCalledWith(
    { entryId: 'heritage-row' },
    'race/gnome',
    'heritage-row',
  );
});

test('a saved race the sheet cannot name stays the current value, not an option', () => {
  render(
    <RaceEquivalenceChoice
      row={row('race/kobold')}
      raceNames={raceNames}
      actions={actions}
    />,
  );
  expect(
    screen.getByRole<HTMLSelectElement>('combobox', { name: 'Counts as race' })
      .value,
  ).toBe('race/kobold');
  expect(options()).toEqual([
    { label: 'Choose race', disabled: false },
    { label: 'Elf', disabled: false },
    { label: 'Gnome', disabled: false },
    { label: 'Unavailable race', disabled: true },
  ]);
});
