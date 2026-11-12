import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { buildCastingSheet } from './casting-features-test-fixture';
import { findCalculatedWarning } from './character-sheet-test-fixture';
import type { GrantEntryView } from './character-sheet-grants-view-model';
import {
  OppositionSchoolsEditor,
  SheetOppositionSchools,
} from './opposition-schools-editor';
import type { SaveStatus } from './save-status';
import { buildSpellcastingFeaturesView } from './spellcasting-features-view-model';
import type {
  CharacterSheetSnapshot,
  useCharacterSheet,
} from './use-character-sheet';

// The opposition schools editor (#415): seven toggles, the whole list saved
// on each, the prompt that cannot be accepted away and the rules warning
// that can.

const maintenance = vi.fn<() => MigrationMaintenance>();
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => maintenance(),
}));

type Controller = ReturnType<typeof useCharacterSheet>;
const warningController: Controller['warnings'] = {
  accept: vi.fn(() => Promise.resolve()),
  reopen: vi.fn(() => Promise.resolve()),
  statusFor: () => ({ kind: 'idle' }),
  hasRemoteChange: false,
  dismissRemoteChange: vi.fn(),
};
let status: SaveStatus = { kind: 'idle' };
const writes = {
  setOppositionSchools: vi.fn(() => Promise.resolve(true)),
  statusFor: vi.fn(() => status),
};
beforeEach(() => {
  status = { kind: 'idle' };
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
});

const evocation = (oppositionSchools: string[]) => ({
  id: 'evocation',
  catalogEntryId: 'school-evocation',
  classIdentity: 'wizard',
  feature: 'wizard-arcane-school',
  list: 'Arcane schools',
  oppositionSchools,
});
const specialist = (oppositionSchools: string[], accepted = false) => {
  const build = (sheet?: CharacterSheetSnapshot) =>
    buildCastingSheet({
      levels: ['wizard'],
      selections: [evocation(oppositionSchools)],
      accepted: sheet
        ? [findCalculatedWarning(sheet, 'oppositionSchools')]
        : [],
    });
  return accepted ? build(build()) : build();
};
function renderEditor(snapshot: CharacterSheetSnapshot) {
  const school = buildSpellcastingFeaturesView(snapshot, 'wizard')?.school;
  if (!school) throw new Error('Expected a specialist school');
  render(
    <OppositionSchoolsEditor
      school={school}
      classEntryId="wizard"
      writes={writes}
      warningController={warningController}
    />,
  );
  return within(
    screen.getByRole('group', { name: 'Opposition schools for Evocation' }),
  );
}
const toggle = (name: string) => screen.getByRole('button', { name });

test('seven toggles leave out the specialist school; each toggle saves the whole list, and the prompt has no Accept', () => {
  const group = renderEditor(specialist(['enc']));
  expect(
    group.getAllByRole('button').map((button) => button.textContent),
  ).toEqual([
    'Abjuration',
    'Conjuration',
    'Divination',
    'Enchantment',
    'Illusion',
    'Necromancy',
    'Transmutation',
  ]);
  expect(toggle('Enchantment')).toHaveAttribute('aria-pressed', 'true');
  expect(toggle('Necromancy')).toHaveAttribute('aria-pressed', 'false');
  expect(
    screen.getByRole('group', { name: 'Opposition schools for Evocation' }),
  ).toHaveClass('ring-sky-400/80');
  expect(
    screen.getByText('Choose two opposition schools for Evocation.'),
  ).toHaveClass('text-sky-300');
  expect(
    screen.queryByRole('button', { name: /Accept|Reopen/ }),
  ).not.toBeInTheDocument();

  fireEvent.click(toggle('Necromancy'));
  expect(writes.setOppositionSchools).toHaveBeenLastCalledWith('wizard', [
    'enc',
    'nec',
  ]);
  fireEvent.click(toggle('Enchantment'));
  expect(writes.setOppositionSchools).toHaveBeenLastCalledWith('wizard', []);
  expect(writes.statusFor).toHaveBeenCalledWith('wizard:oppositionSchools');
});

test('a third opposition school is a rules warning with Accept; a toggle still saves the whole list', () => {
  renderEditor(specialist(['enc', 'nec', 'abj']));
  expect(
    screen.getByRole('group', { name: 'Opposition schools for Evocation' }),
  ).not.toHaveClass('ring-sky-400/80');
  const message = 'Evocation has 3 opposition schools; a specialist chooses 2.';
  expect(screen.getByText(message).parentElement).toHaveClass('text-amber-300');
  fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
  expect(warningController.accept).toHaveBeenCalledWith(
    expect.objectContaining({ check: 'oppositionSchools', message }),
  );
  fireEvent.click(toggle('Abjuration'));
  expect(writes.setOppositionSchools).toHaveBeenLastCalledWith('wizard', [
    'enc',
    'nec',
  ]);
});

test('an accepted rules warning offers Reopen, and a refused save keeps its reason beside the toggles', () => {
  status = {
    kind: 'error',
    message:
      "Opposition schools weren't saved: Character is read only. Try again.",
  };
  renderEditor(specialist(['enc', 'nec', 'abj'], true));
  expect(screen.getByText('Accepted')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
  expect(warningController.reopen).toHaveBeenCalledWith(
    expect.objectContaining({ check: 'oppositionSchools', accepted: true }),
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    "Opposition schools weren't saved: Character is read only. Try again.",
  );
});

test('every toggle waits while the list saves and under maintenance', () => {
  status = { kind: 'saving' };
  const group = renderEditor(specialist(['enc', 'nec']));
  for (const button of group.getAllByRole('button'))
    expect(button).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Saving…');
});

test('the Class features editor sits under the specialist school row only, from the precomputed schools', () => {
  const school = buildSpellcastingFeaturesView(
    specialist([]),
    'wizard',
  )?.school;
  if (!school) throw new Error('Expected a specialist school');
  const choices = {
    ...writes,
    viewFor: vi.fn(),
    schools: [{ classEntryId: 'wizard', school }],
    hasRemoteChange: false,
    dismissRemoteChange: vi.fn(),
    choose: vi.fn(),
    clear: vi.fn(),
  };
  const row = (rowId: string) => ({ rowId }) as GrantEntryView;
  const { rerender } = render(
    <SheetOppositionSchools
      row={row('other')}
      choices={choices}
      warningController={warningController}
    />,
  );
  expect(screen.queryByRole('group')).toBeNull();
  rerender(
    <SheetOppositionSchools
      row={row(school.entryId)}
      choices={choices}
      warningController={warningController}
    />,
  );
  fireEvent.click(toggle('Enchantment'));
  expect(writes.setOppositionSchools).toHaveBeenLastCalledWith('wizard', [
    'enc',
  ]);
  expect(choices.viewFor).not.toHaveBeenCalled();
});
