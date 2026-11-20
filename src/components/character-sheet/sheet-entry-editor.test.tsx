import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi, type Mock } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { SheetEntryEditor } from './sheet-entry-editor';
import type { SheetEntryInput } from './use-character-sheet-entries';

// The condition editor (#311): one of the Core Rulebook's 34 conditions
// chosen by name as a card, its canonical facts fixed and its rules
// previewed, or a custom condition typed in.

const maintenance = vi.fn<() => MigrationMaintenance>();
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => maintenance(),
}));
vi.mock(
  '~/components/ui/select',
  () => import('../weekly-draft-workspace/native-select-test-double'),
);

const form = () => screen.getByRole('form', { name: /entry$/ });
const cards = () => screen.getByRole('radiogroup', { name: 'CRB condition' });
const radio = (name: string) => within(cards()).getByRole('radio', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const field = (name: string) => screen.getByRole('textbox', { name });
const queryField = (name: string) => screen.queryByRole('textbox', { name });
const search = () =>
  screen.getByRole('searchbox', { name: 'Find a condition' });
const notCalculated = () =>
  screen.getByText('Not calculated').nextElementSibling;
/** The fixed canonical fact under its term: "Name", "Modifiers". */
const fact = (term: string) =>
  screen.getByText(term, { selector: 'dt' }).nextElementSibling;

type Save = (input: SheetEntryInput) => Promise<unknown>;

function renderEditor({
  value,
  save = vi.fn<Save>().mockResolvedValue(null),
}: { value?: SheetEntryInput; save?: Mock<Save> } = {}) {
  const onClose = vi.fn();
  render(
    <SheetEntryEditor
      value={value}
      save={save}
      onClose={onClose}
      isNew={value === undefined}
    />,
  );
  return { save, onClose };
}

const blinded: SheetEntryInput = {
  name: 'Blinded',
  detail: { kind: 'condition', conditionKey: 'blinded' },
  modifiers: [
    { target: 'ac', bonusType: 'untyped', value: -2 },
    {
      target: 'skill.per',
      bonusType: 'untyped',
      value: -4,
      condition: { situation: 'opposed-perception' },
    },
  ],
};

beforeEach(() => {
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
});

test('a new Condition offers all 34 CRB conditions and Custom as cards; Fatigued fills its two penalties as fixed facts and saves a keyed canonical entry', async () => {
  const { save, onClose } = renderEditor();
  const options = within(cards()).getAllByRole('radio');
  expect(options).toHaveLength(35);
  expect(radio('Custom condition')).toBeChecked();
  for (const name of ['Bleed', 'Flat-Footed', 'Energy Drained', 'Unconscious'])
    expect(radio(name)).toBeEnabled();
  expect(field('Name')).toHaveValue('');

  fireEvent.click(radio('Fatigued'));
  expect(radio('Fatigued')).toBeChecked();
  expect(queryField('Name')).not.toBeInTheDocument();
  expect(fact('Name')).toHaveTextContent('Fatigued');
  expect(fact('Modifiers')).toHaveTextContent(
    '-2 to Strength · -2 to Dexterity',
  );
  expect(screen.getByText('Rules · CRB')).toBeVisible();
  expect(screen.getByText(/Can neither run nor charge/)).toBeVisible();
  expect(within(form()).queryByRole('spinbutton')).not.toBeInTheDocument();
  expect(within(form()).queryByRole('textbox')).not.toBeInTheDocument();
  expect(search()).toBeVisible();

  fireEvent.click(button('Save entry'));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save).toHaveBeenCalledWith({
    name: 'Fatigued',
    modifiers: [
      { target: 'ability.str', bonusType: 'untyped', value: -2 },
      { target: 'ability.dex', bonusType: 'untyped', value: -2 },
    ],
    detail: { kind: 'condition', conditionKey: 'fatigued' },
  });
  await waitFor(() => expect(onClose).toHaveBeenCalled());
});

test('Dazed has no numeric Modifiers, says so without calling it harmless, and saves without a blank Modifier error', async () => {
  const { save } = renderEditor();
  fireEvent.click(radio('Dazed'));
  expect(
    screen.getByText('No numeric Modifiers. Its rules say what it does.'),
  ).toBeVisible();
  expect(screen.getByText(/can take no actions/)).toBeVisible();
  expect(screen.queryByText('Not calculated')).not.toBeInTheDocument();
  fireEvent.click(button('Save entry'));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save).toHaveBeenCalledWith({
    name: 'Dazed',
    modifiers: [],
    detail: { kind: 'condition', conditionKey: 'dazed' },
  });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('Find a condition narrows the cards by name, says when none match, and the cards are native radios a keyboard can work', () => {
  renderEditor();
  fireEvent.change(search(), { target: { value: 'fri' } });
  expect(
    within(cards())
      .getAllByRole('radio')
      .map((option) => option.getAttribute('value')),
  ).toEqual(['custom', 'frightened']);
  expect(radio('Frightened')).toHaveProperty('type', 'radio');
  radio('Frightened').focus();
  expect(radio('Frightened')).toHaveFocus();
  fireEvent.click(radio('Frightened'));
  expect(radio('Frightened')).toBeChecked();
  expect(screen.getByText(/Flees from the source of its fear/)).toBeVisible();

  fireEvent.change(search(), { target: { value: 'zzz' } });
  expect(screen.getByText('No matching conditions.')).toHaveAttribute(
    'role',
    'status',
  );
  expect(radio('Custom condition')).toBeVisible();
  expect(fact('Name')).toHaveTextContent('Frightened');
});

test('Customize condition keeps the draft name and Modifiers, unlocks them and drops the CRB rules; it saves an unkeyed condition, and an emptied name is a field error without a write', async () => {
  const { save } = renderEditor();
  fireEvent.click(radio('Fatigued'));
  expect(button('Customize condition')).toHaveAccessibleDescription(
    "Edit this condition's name and Modifiers. CRB condition notes no longer apply.",
  );
  fireEvent.click(button('Customize condition'));
  expect(radio('Custom condition')).toBeChecked();
  expect(field('Name')).toHaveValue('Fatigued');
  expect(field('Modifier 1 value')).toHaveValue('-2');
  expect(field('Modifier 2 value')).toHaveValue('-2');
  expect(screen.queryByText('Rules · CRB')).not.toBeInTheDocument();
  expect(screen.queryByText('Not calculated')).not.toBeInTheDocument();

  fireEvent.change(field('Name'), { target: { value: 'Narrative fatigue' } });
  fireEvent.change(field('Modifier 1 value'), { target: { value: '-1' } });
  fireEvent.click(button('Save entry'));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save).toHaveBeenCalledWith({
    name: 'Narrative fatigue',
    modifiers: [
      { target: 'ability.str', bonusType: 'untyped', value: -1 },
      { target: 'ability.dex', bonusType: 'untyped', value: -2 },
    ],
    detail: { kind: 'condition' },
  });

  fireEvent.change(field('Name'), { target: { value: '' } });
  fireEvent.click(button('Save entry'));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Adjustment name is required',
  );
  expect(save).toHaveBeenCalledTimes(1);
});

test('filtering keeps the selected CRB condition checked and available to keyboard focus', () => {
  renderEditor({ value: blinded });
  fireEvent.change(search(), { target: { value: 'fat' } });

  expect(radio('Fatigued')).toBeVisible();
  expect(radio('Blinded')).toBeChecked();
  expect(radio('Blinded')).toBeEnabled();
  radio('Blinded').focus();
  expect(radio('Blinded')).toHaveFocus();
});

test('Helpless and Paralyzed disclose their zero scores as not calculated without inventing totals; Energy Drained says its negative levels are not counted', () => {
  renderEditor();
  fireEvent.click(radio('Helpless'));
  expect(notCalculated()).toHaveTextContent(
    'Effective Dexterity 0 (−5 modifier) and the statistics it changes are not calculated.',
  );
  expect(notCalculated()).not.toHaveTextContent('Strength 0');
  expect(
    screen.getByText('No numeric Modifiers. Its rules say what it does.'),
  ).toBeVisible();

  fireEvent.click(radio('Paralyzed'));
  expect(notCalculated()).toHaveTextContent(/Effective Strength 0/);
  expect(notCalculated()).toHaveTextContent(/Effective Dexterity 0/);

  fireEvent.click(radio('Energy Drained'));
  expect(notCalculated()).toHaveTextContent(
    /Negative-level count is not recorded: −1 per negative level on attacks, saves, skills/,
  );
  expect(within(form()).queryByRole('spinbutton')).not.toBeInTheDocument();
});

test('an existing Blinded entry keeps its CRB card checked with fixed canonical facts; a refused save keeps the selection and reads the refusal', async () => {
  const save = vi
    .fn<Save>()
    .mockRejectedValue(new ConvexError('Conditions are read-only right now'));
  renderEditor({ value: blinded, save });
  expect(radio('Blinded')).toBeChecked();
  expect(radio('Blinded')).toBeEnabled();
  expect(queryField('Name')).not.toBeInTheDocument();
  expect(fact('Modifiers')).toHaveTextContent(
    '-2 to All AC · -4 to Perception (on opposed Perception checks)',
  );
  expect(
    screen.getByText(/Total concealment \(50% miss chance\)/),
  ).toBeVisible();

  fireEvent.click(radio('Dazzled'));
  fireEvent.click(button('Save entry'));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Dazzled',
      detail: { kind: 'condition', conditionKey: 'dazzled' },
    }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    "Changes weren't saved: Conditions are read-only right now. Your edits are kept. Save to try again.",
  );
  expect(radio('Dazzled')).toBeChecked();
  expect(fact('Name')).toHaveTextContent('Dazzled');
  expect(button('Save entry')).toBeEnabled();
});

test('maintenance disables the condition cards, the search stays, and Customize condition is disabled with the reason beside it', () => {
  const message = 'Editing is paused for maintenance.';
  maintenance.mockReturnValue({ kind: 'maintenance', readOnly: true, message });
  renderEditor({ value: blinded });
  expect(radio('Blinded')).toBeDisabled();
  expect(radio('Custom condition')).toBeDisabled();
  expect(button('Customize condition')).toBeDisabled();
  expect(button('Save entry')).toBeDisabled();
  expect(search()).toBeEnabled();
  expect(within(form()).getByText(message)).toBeVisible();
});

test('an item records its armor or shield facts with distinct required and invalid errors; a blank maximum Dexterity is no limit', async () => {
  const { save } = renderEditor();
  fireEvent.click(screen.getByRole('radio', { name: 'Item' }));
  fireEvent.change(field('Name'), { target: { value: 'Tower shield' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Armor or shield' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Shield' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Tower shield' }));
  expect(field('Maximum Dexterity bonus')).toHaveValue('');
  fireEvent.change(field('Armor or shield bonus'), { target: { value: '' } });
  fireEvent.change(field('Armor check penalty'), { target: { value: 'ten' } });
  fireEvent.click(button('Save entry'));
  await waitFor(() =>
    expect(field('Armor or shield bonus')).toHaveAccessibleDescription(
      'Armor or shield bonus is required',
    ),
  );
  expect(field('Armor check penalty')).toHaveAccessibleDescription(
    'Armor check penalty must be a whole number of 0 or more',
  );
  expect(save).not.toHaveBeenCalled();

  fireEvent.change(field('Armor or shield bonus'), { target: { value: '4' } });
  fireEvent.change(field('Armor check penalty'), { target: { value: '10' } });
  fireEvent.change(field('Maximum Dexterity bonus'), {
    target: { value: '2' },
  });
  fireEvent.change(field('Arcane spell failure %'), {
    target: { value: '50' },
  });
  fireEvent.click(button('Save entry'));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Tower shield',
      detail: {
        kind: 'item',
        consumable: false,
        armor: {
          slot: 'shield',
          category: 'towerShield',
          bonus: 4,
          maxDex: 2,
          armorCheckPenalty: 10,
          asf: 50,
        },
      },
    }),
  );
});
