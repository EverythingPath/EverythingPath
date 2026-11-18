import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { findRacialProgression } from '~/lib/character-sheet-creature-types';
import { CharacterSheetRaces } from './character-sheet-races';
import {
  buildSheet,
  findCalculatedWarning,
  type Level,
  type Race,
} from './character-sheet-test-fixture';
import { buildCharacterSheetView } from './character-sheet-view-model';
import type { SaveStatus } from './save-status';
import type {
  CharacterSheetSnapshot,
  useCharacterSheet,
} from './use-character-sheet';

// Fixed racial Hit Dice (#312): every selected race's own Hit Dice, how
// they advance from an editable creature type, their plain hit points and
// ranks saved together, and character level, Hit Dice and the feat budget
// read apart.

type Controller = ReturnType<typeof useCharacterSheet>;
type Write = { name: string; args: unknown[]; resolve: (o: boolean) => void };

let writes: Write[] = [];
let statuses: Record<string, SaveStatus> = {};
const maintenance = vi.fn<() => MigrationMaintenance>();
const warningController: Controller['warnings'] = {
  accept: vi.fn(() => Promise.resolve()),
  reopen: vi.fn(() => Promise.resolve()),
  statusFor: () => ({ kind: 'idle' }),
  hasRemoteChange: false,
  dismissRemoteChange: vi.fn(),
};

vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => maintenance(),
}));
vi.mock(
  '~/components/ui/select',
  () => import('../weekly-draft-workspace/native-select-test-double'),
);

beforeEach(() => {
  writes = [];
  statuses = {};
  vi.clearAllMocks();
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
});

const record =
  (name: string) =>
  (...args: unknown[]) =>
    new Promise<boolean>((resolve) => {
      writes.push({ name, args, resolve });
    });
const statusFor = (key: string) => statuses[key] ?? { kind: 'idle' as const };
function buildRaceActions(): Controller['races'] {
  return {
    statusFor,
    hasRemoteChange: false,
    dismissRemoteChange: vi.fn(),
    selectRace: record('selectRace'),
    chooseAbilityScore: record('chooseAbilityScore'),
    setTraitSelected: record('setTraitSelected'),
    setReplacements: record('setReplacements'),
    chooseRaceEquivalence: record('chooseRaceEquivalence'),
    editStatistics: record('editStatistics'),
    discardStatistics: record('discardStatistics'),
  };
}
function buildGrantActions(): Controller['grants'] {
  return {
    getCatalogDetachTarget: () => undefined,
    statusFor,
    hasRemoteChange: false,
    dismissRemoteChange: vi.fn(),
    setKept: record('setKept'),
    discard: record('discard'),
    edit: record('edit'),
  };
}

function renderRaces(initial: CharacterSheetSnapshot) {
  let snapshot = initial;
  const ui = () => {
    const sheet = buildCharacterSheetView(snapshot);
    return (
      <CharacterSheetRaces
        races={sheet.races}
        statistics={sheet.raceStatistics}
        raceNames={sheet.raceNames}
        calculated={sheet.calculated}
        actions={buildRaceActions()}
        grants={buildGrantActions()}
        warnings={sheet.warnings}
        warningController={warningController}
      />
    );
  };
  const view = render(ui());
  return {
    rerender(next = snapshot) {
      snapshot = next;
      view.rerender(ui());
    },
  };
}

const human = (facts: Omit<Race, 'key'> = {}) =>
  buildSheet({ race: { key: 'human', ...facts } });
const dragon = findRacialProgression('dragon');
if (!dragon) throw new Error('Expected the dragon seed');

const form = () => screen.getByRole('form', { name: 'Racial Hit Dice' });
const textbox = (name: string) => within(form()).getByRole('textbox', { name });
const combobox = (name: string) =>
  within(form()).getByRole<HTMLSelectElement>('combobox', { name });
const formButton = (name: string | RegExp) =>
  within(form()).getByRole('button', { name });
const type = (name: string, value: string) =>
  fireEvent.change(textbox(name), { target: { value } });
const pick = (name: string, value: string) =>
  fireEvent.change(combobox(name), { target: { value } });
const fact = (label: string) =>
  within(form()).getByText(label, { selector: 'dt' }).nextElementSibling;
function lastWrite() {
  const write = writes.at(-1);
  if (!write) throw new Error('Expected a write');
  return write;
}
async function submit() {
  fireEvent.submit(form());
  await act(() => Promise.resolve());
}
const classSkills = () =>
  within(within(form()).getByRole('list', { name: 'Class skills' }))
    .getAllByRole('listitem')
    .map((item) => item.firstChild?.textContent);

test('a selected Human at zero racial Hit Dice can be given some, with no Class Level invented and no hit points filled in', async () => {
  renderRaces(human());
  expect(textbox('Racial Hit Dice')).toHaveValue('0');
  expect(textbox('Racial hit points')).toHaveValue('');
  expect(combobox('Creature type')).toHaveValue('');
  expect(
    within(form()).getByText(
      /Racial Hit Dice count toward Hit Dice, not character level\./,
    ),
  ).toBeVisible();
  expect(
    within(form()).queryByRole('button', { name: /roll|average|maximum/i }),
  ).not.toBeInTheDocument();

  type('Racial Hit Dice', '2');
  await submit();
  expect(writes).toHaveLength(1);
  expect(lastWrite()).toMatchObject({
    name: 'editStatistics',
    args: [
      'race-entry',
      {
        racialHitDice: 2,
        racialHpGained: null,
        racialProgression: null,
        racialSkillRanks: {},
      },
    ],
  });
});

test('choosing Dragon seeds its progression and every seeded value, the name included, stays editable and is what saves', async () => {
  renderRaces(human());
  pick('Creature type', 'dragon');
  expect(combobox('Creature type')).toHaveValue('dragon');
  expect(textbox('Creature type name')).toHaveValue('Dragon');
  expect(textbox('Hit Die')).toHaveValue('12');
  expect(combobox('Base attack progression')).toHaveValue('full');
  for (const save of ['Fortitude', 'Reflex', 'Will'])
    expect(combobox(`${save} progression`)).toHaveValue('good');
  expect(textbox('Skill ranks per Hit Die')).toHaveValue('6');
  expect(classSkills()).toContain('Appraise');
  expect(classSkills()).toHaveLength(dragon.classSkills.length);
  expect(textbox('Racial hit points')).toHaveValue('');

  type('Racial Hit Dice', '3');
  type('Creature type name', 'Wyrmkin');
  expect(combobox('Creature type')).toHaveValue('');
  type('Hit Die', '10');
  pick('Base attack progression', 'threeQuarters');
  pick('Will progression', 'poor');
  type('Skill ranks per Hit Die', '4');
  fireEvent.click(formButton('Remove class skill Appraise'));
  pick('Add class skill', 'acr');
  expect(classSkills()).toContain('Acrobatics');
  expect(classSkills()).not.toContain('Appraise');
  await submit();
  expect(lastWrite().args).toEqual([
    'race-entry',
    {
      racialHitDice: 3,
      racialHpGained: null,
      racialSkillRanks: {},
      racialProgression: {
        creatureType: 'Wyrmkin',
        hitDie: 10,
        bab: 'threeQuarters',
        saves: { fort: 'good', ref: 'good', will: 'poor' },
        skillRanksPerHitDie: 4,
        classSkills: [
          ...dragon.classSkills.filter((skill) => skill !== 'apr'),
          'acr',
        ],
      },
    },
  ]);

  fireEvent.click(formButton('Clear progression'));
  expect(
    within(form()).queryByRole('textbox', { name: 'Hit Die' }),
  ).not.toBeInTheDocument();
  expect(combobox('Creature type')).toHaveValue('');
});

test('one save sends the count, progression, hit points and ranks together, says so where it happens, and a refusal keeps every value', async () => {
  const view = renderRaces(human({ hitDice: 2, progression: dragon }));
  type('Racial hit points', '15');
  fireEvent.click(formButton('Add skill'));
  pick('Skill 1', 'per');
  fireEvent.change(textbox('Ranks for skill 1'), { target: { value: '2' } });
  await submit();
  expect(lastWrite()).toMatchObject({
    name: 'editStatistics',
    args: [
      'race-entry',
      {
        racialHitDice: 2,
        racialHpGained: 15,
        racialProgression: { creatureType: 'Dragon', hitDie: 12 },
        racialSkillRanks: { per: 2 },
      },
    ],
  });
  expect(formButton('Saving…')).toBeDisabled();

  const refusal = "Racial Hit Dice weren't saved: the race was removed.";
  statuses['race-entry'] = { kind: 'error', message: refusal };
  await act(async () => lastWrite().resolve(false));
  view.rerender();
  expect(within(form()).getByRole('alert')).toHaveTextContent(refusal);
  expect(textbox('Racial hit points')).toHaveValue('15');
  expect(combobox('Skill 1')).toHaveValue('per');
  expect(formButton('Save racial Hit Dice')).toBeEnabled();

  statuses = {};
  await submit();
  expect(writes).toHaveLength(2);
  view.rerender(
    human({
      hitDice: 2,
      progression: dragon,
      racialHpGained: 15,
      racialSkillRanks: { per: 2 },
    }),
  );
  await act(async () => lastWrite().resolve(true));
  expect(within(form()).getByText('Racial Hit Dice saved.')).toBeVisible();
  expect(within(form()).queryByRole('alert')).not.toBeInTheDocument();
});

test('an empty count and text in a number field are told apart, styled at the field, and write nothing; blank hit points save', async () => {
  renderRaces(human({ hitDice: 1, progression: dragon }));
  type('Racial Hit Dice', '');
  await submit();
  const required = await within(form()).findByText(
    'Racial Hit Dice is required',
  );
  expect(required).toHaveAttribute('role', 'alert');
  expect(textbox('Racial Hit Dice')).toHaveAttribute('aria-invalid', 'true');

  type('Racial Hit Dice', 'two');
  type('Hit Die', 'x');
  await submit();
  expect(
    await within(form()).findByText('Racial Hit Dice must be a number'),
  ).toHaveAttribute('role', 'alert');
  expect(within(form()).getByText('Hit Die must be a number')).toHaveAttribute(
    'role',
    'alert',
  );
  expect(form()).toHaveAttribute('novalidate');
  expect(writes).toHaveLength(0);

  type('Racial Hit Dice', '1');
  type('Hit Die', '8');
  await submit();
  expect(lastWrite().args).toMatchObject([
    'race-entry',
    { racialHitDice: 1, racialHpGained: null },
  ]);
});

test('positive Hit Dice without a progression still save and explain what is missing; a rank over the cap warns with Accept', async () => {
  const view = renderRaces(human({ hitDice: 2 }));
  expect(
    within(form()).getByText(
      'Set the racial Hit Dice progression to calculate its attack bonus, saves and skill rank budget.',
    ),
  ).toBeVisible();
  expect(
    within(form()).getByText('Not recorded yet, so HP is not complete.'),
  ).toBeVisible();
  await submit();
  expect(lastWrite().args).toMatchObject([
    'race-entry',
    { racialHitDice: 2, racialProgression: null },
  ]);

  const overCap = human({
    hitDice: 1,
    progression: dragon,
    racialHpGained: 7,
    racialSkillRanks: { per: 3 },
  });
  view.rerender(overCap);
  const warning = findCalculatedWarning(overCap, 'racialSkillRankCap');
  const { message } = warning;
  expect(within(form()).getByText(message)).toBeVisible();
  expect(
    within(form()).queryByText('Not recorded yet, so HP is not complete.'),
  ).not.toBeInTheDocument();
  fireEvent.click(
    within(form()).getByRole('button', {
      name: 'Accept',
      description: message,
    }),
  );
  expect(warningController.accept).toHaveBeenCalledWith(
    expect.objectContaining(warning),
  );
});

test('character level, Hit Dice and the feat budget read apart: racial Hit Dice add Hit Dice and a feat at each odd Hit Die, never a level', () => {
  const levels: Level[] = [{ id: 'level-1', hp: 8, classId: 'fighter' }];
  const view = renderRaces(
    buildSheet({ race: { key: 'human', hitDice: 0 }, levels }),
  );
  expect(fact('Character level')).toHaveTextContent('1');
  expect(fact('Hit Dice')).toHaveTextContent('1');
  expect(fact('Feat budget')).toHaveTextContent('1');

  view.rerender(buildSheet({ race: { key: 'human', hitDice: 2 }, levels }));
  expect(fact('Character level')).toHaveTextContent('1');
  expect(fact('Hit Dice')).toHaveTextContent('3');
  expect(fact('Feat budget')).toHaveTextContent('2');

  view.rerender(buildSheet({ race: { key: 'human', hitDice: 3 }, levels }));
  expect(fact('Hit Dice')).toHaveTextContent('4');
  expect(fact('Feat budget')).toHaveTextContent('2');
});

test("another player's saved change keeps the unsaved count and is announced; maintenance disables every writer and keeps the saved values", () => {
  const view = renderRaces(human({ hitDice: 1, progression: dragon }));
  type('Racial Hit Dice', '4');
  view.rerender(human({ hitDice: 1, progression: dragon, racialHpGained: 9 }));
  expect(textbox('Racial Hit Dice')).toHaveValue('4');
  expect(textbox('Racial hit points')).toHaveValue('9');
  expect(
    within(form()).getByText('Updated by another player. Your edits are kept.'),
  ).toBeVisible();
  fireEvent.click(formButton('Dismiss racial Hit Dice update'));
  expect(
    within(form()).queryByText(/Updated by another player/),
  ).not.toBeInTheDocument();

  const message = 'Editing is paused for maintenance.';
  maintenance.mockReturnValue({ kind: 'maintenance', readOnly: true, message });
  view.rerender(human({ hitDice: 1, progression: dragon, racialHpGained: 9 }));
  for (const field of within(form()).getAllByRole('textbox'))
    expect(field).toBeDisabled();
  for (const field of within(form()).getAllByRole('combobox'))
    expect(field).toBeDisabled();
  expect(textbox('Racial hit points')).toHaveValue('9');
  expect(textbox('Hit Die')).toHaveValue('12');
  expect(formButton('Save racial Hit Dice')).toBeDisabled();
  expect(formButton('Save racial Hit Dice')).toHaveAccessibleDescription(
    message,
  );
  expect(formButton('Clear progression')).toBeDisabled();
  expect(formButton('Add skill')).toBeDisabled();
  fireEvent.submit(form());
  expect(writes).toHaveLength(0);
});

test('every control is a labelled, focusable control with touch-sized targets that tighten from tablet width, in a grid that wraps on the phone', async () => {
  renderRaces(human({ hitDice: 1, progression: dragon }));
  for (const name of [
    'Racial Hit Dice',
    'Racial hit points',
    'Creature type name',
    'Hit Die',
    'Skill ranks per Hit Die',
  ]) {
    expect(textbox(name)).toHaveClass('h-10', 'md:h-8');
    expect(textbox(name)).not.toHaveAttribute('tabindex', '-1');
  }
  for (const name of [
    'Creature type',
    'Base attack progression',
    'Fortitude progression',
    'Reflex progression',
    'Will progression',
    'Add class skill',
  ])
    expect(combobox(name)).toHaveClass('h-10', 'md:h-8');
  expect(formButton('Save racial Hit Dice')).toHaveClass(
    'min-h-11',
    'md:min-h-9',
  );
  expect(formButton('Remove class skill Appraise')).toHaveClass(
    'size-9',
    'md:size-6',
  );
  const grid = textbox('Hit Die').closest('.grid.grid-cols-2');
  expect(grid).toHaveClass('sm:grid-cols-3', 'lg:grid-cols-4', 'items-start');

  textbox('Hit Die').focus();
  expect(textbox('Hit Die')).toHaveFocus();
  await submit();
  expect(writes).toHaveLength(1);
});

test('Magical Beast displays and saves its name while retaining the stable creature-type choice', async () => {
  const seed = findRacialProgression('magicalBeast');
  if (!seed) throw new Error('Missing Magical Beast seed');
  renderRaces(
    human({ progression: { ...seed, creatureType: 'magicalBeast' } }),
  );
  expect(textbox('Creature type name')).toHaveValue('Magical Beast');
  expect(combobox('Creature type')).toHaveValue('magicalBeast');
  pick('Creature type', 'magicalBeast');
  expect(textbox('Creature type name')).toHaveValue('Magical Beast');
  expect(combobox('Creature type')).toHaveValue('magicalBeast');
  await submit();
  expect(lastWrite().args).toMatchObject([
    'race-entry',
    { racialProgression: { creatureType: 'Magical Beast', hitDie: 10 } },
  ]);
});
