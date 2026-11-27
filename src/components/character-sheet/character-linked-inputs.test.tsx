import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { Id } from '@convex/_generated/dataModel';
import { beforeEach, expect, test, vi } from 'vitest';
import {
  linkedInputKey,
  type CompanionLinkedInput,
  type LinkedInputUnavailableReason,
} from '~/lib/character-sheet-linked-inputs';
import { CharacterLinkedInputs } from './character-linked-inputs';
import type { LinkedInputDescriptor } from './character-linked-input-row';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';

// The values a Companion Relationship borrows (#317): each named on its own
// beneath the relationship, Unresolved rather than a stale or zero number,
// with fallbacks and interpretations saved per value and never lost.

type Write = {
  name: string;
  args: Record<string, unknown>;
  resolve: (value: null) => void;
  reject: (error: unknown) => void;
};
const server = vi.hoisted(() => ({
  reads: new Map<string, unknown>(),
  queries: [] as unknown[],
  writes: [] as Write[],
  isDeferred: false,
  maintenance: { kind: 'ready', readOnly: false, message: '' },
}));
const nameOf = characterSheetNames();
vi.mock('convex/react', () => ({
  useQuery: (query: FunctionReference<'query'>, args: object | 'skip') => {
    const name = nameOf(query);
    if (name !== 'listLinkedInputs') throw new Error(`Unexpected ${name}`);
    if (args === 'skip') return undefined;
    server.queries.push(args);
    return server.reads.size > 0 ? [...server.reads.values()] : undefined;
  },
  useMutation: (mutation: FunctionReference<'mutation'>) => {
    const name = nameOf(mutation);
    return (args: Record<string, unknown>) =>
      new Promise((resolve, reject) => {
        server.writes.push({ name, args, resolve, reject });
        if (!server.isDeferred) resolve(null);
      });
  },
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => server.maintenance,
}));

const characterId = 'whisper' as Id<'character'>;
const relationshipId = 'bond' as Id<'companionRelationship'>;
const level = { kind: 'characterLevel' } as const;
const hitDice = { kind: 'actualHitDice' } as const;
const maximumHp = { kind: 'maximumHp' } as const;
const ranks = { kind: 'skillRanks', skill: 'skill.per' } as const;
const wizard = {
  kind: 'classLevels',
  classRuleIdentity: 'pf1:wizard',
} as const;

function read(input: CompanionLinkedInput, overrides: object = {}) {
  return {
    input,
    status: 'available',
    resolution: 'calculated',
    value: 5,
    fallback: null,
    fallbackState: 'none',
    candidates: [],
    contributions: [],
    prerequisiteStatus: 'resolved',
    interpretation: null,
    revision: 1,
    lastOperationId: 'seed',
    updatedBy: null,
    sources: [],
    unavailableReason: null,
    ...overrides,
  };
}
const unavailable = (
  input: CompanionLinkedInput,
  reason: LinkedInputUnavailableReason,
  overrides: object = {},
) =>
  read(input, {
    status: 'unavailable',
    resolution: 'unresolved',
    value: null,
    prerequisiteStatus: 'unresolved',
    unavailableReason: reason,
    ...overrides,
  });
const conflict = (overrides: object = {}) =>
  read(wizard, {
    status: 'conflicting',
    resolution: 'unresolved',
    value: null,
    prerequisiteStatus: 'unresolved',
    candidates: [
      { sourceKey: 'bond', kind: 'available', value: 3 },
      { sourceKey: 'archetype', kind: 'available', value: 5 },
      { sourceKey: 'feat', kind: 'available', value: 1, role: 'addition' },
      { sourceKey: 'lost', kind: 'unavailable', reason: 'missingInput' },
    ],
    sources: [
      { key: 'bond', label: 'Arcane Bond' },
      { key: 'archetype', label: 'Bonded Archetype' },
      { key: 'feat', label: 'Improved Familiar' },
      { key: 'lost', label: 'Lost Wand' },
    ],
    ...overrides,
  });

function setReads(...snapshots: ReturnType<typeof read>[]) {
  server.reads = new Map(
    snapshots.map((snapshot) => [linkedInputKey(snapshot.input), snapshot]),
  );
}

type Props = {
  inputs?: LinkedInputDescriptor[];
  relationship?: Id<'companionRelationship'>;
  isAvailable?: boolean;
};
function Host({
  inputs = [{ input: level }],
  relationship,
  isAvailable,
}: Props) {
  return (
    <main>
      <CharacterLinkedInputs
        characterId={characterId}
        relationshipId={relationship ?? relationshipId}
        inputs={inputs}
        isAvailable={isAvailable ?? true}
        maintenanceMessage="Linked values are paused for maintenance."
      />
    </main>
  );
}
function renderInputs(props: Props = {}) {
  const view = render(<Host {...props} />);
  return {
    rerender: (next: Props = props) => view.rerender(<Host {...next} />),
  };
}
const row = (name: string) => within(screen.getByRole('group', { name }));
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const lastWrite = () => server.writes.at(-1);

beforeEach(() => {
  server.reads = new Map();
  server.queries = [];
  server.writes = [];
  server.isDeferred = false;
  server.maintenance = { kind: 'ready', readOnly: false, message: '' };
});

test('an unavailable sheet or empty list shows no rows; loading names no number and offers no edits', () => {
  const view = renderInputs({ isAvailable: false });
  expect(screen.queryByRole('list')).toBeNull();
  expect(server.queries).toHaveLength(0);
  view.rerender({ inputs: [] });
  expect(screen.queryByRole('list')).toBeNull();

  view.rerender({ inputs: [{ input: level }] });
  expect(screen.getByRole('status')).toHaveTextContent('Loading linked value…');
  expect(screen.queryByText('0')).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
});

test('all named values for one relationship use one live read', () => {
  setReads(read(level), read(hitDice));
  renderInputs({ inputs: [{ input: level }, { input: hitDice }] });
  expect(row('Character level').getByText('5')).toBeVisible();
  expect(row('Actual Hit Dice').getByText('5')).toBeVisible();
  expect(server.queries).toHaveLength(1);
  expect(server.queries[0]).toEqual({ characterId, relationshipId });
});

test('a calculated value explains a fallback saved ahead of an interruption', () => {
  setReads(read(level));
  renderInputs();
  expect(
    row('Character level').getByText('Saved for when the value is unavailable'),
  ).toBeVisible();
  expect(button('Set fallback for Character level')).toBeEnabled();
});

test('each value is named, unavailable reasons say why, zero is a value and inaccessible sources stay undisclosed', () => {
  setReads(
    unavailable(level, 'inaccessible', {
      candidates: [
        { sourceKey: 'hidden', kind: 'unavailable', reason: 'inaccessible' },
      ],
    }),
    unavailable(hitDice, 'interrupted'),
    unavailable(maximumHp, 'missingInput'),
    read(ranks, { value: 0 }),
    read(wizard, { value: 2 }),
  );
  renderInputs({
    inputs: [
      { input: level },
      { input: hitDice },
      { input: maximumHp },
      { input: ranks },
      { input: wizard },
    ],
  });
  for (const name of [
    'Character level',
    'Actual Hit Dice',
    'Calculated maximum hit points',
    'Perception ranks',
    'Class Levels',
  ])
    expect(screen.getByRole('group', { name })).toBeVisible();
  const inLevel = row('Character level');
  expect(inLevel.getByText('Unresolved')).toBeVisible();
  expect(
    inLevel.getByText(
      'Character level is unavailable because the linked Character cannot be accessed.',
    ),
  ).toBeVisible();
  expect(screen.queryByText(/hidden/)).toBeNull();
  expect(inLevel.queryByRole('button', { name: /interpretation/ })).toBeNull();
  // The accessible viewed sheet can still save its own fallback.
  expect(
    inLevel.getByRole('button', { name: 'Set fallback for Character level' }),
  ).toBeEnabled();
  expect(
    row('Actual Hit Dice').getByText(
      'Actual Hit Dice is unavailable while the Companion Relationship is interrupted.',
    ),
  ).toBeVisible();
  expect(
    row('Calculated maximum hit points').getByText(
      'Calculated maximum hit points needs a missing input on the linked Character.',
    ),
  ).toBeVisible();
  const inRanks = row('Perception ranks');
  expect(inRanks.getByText('0')).toBeVisible();
  expect(inRanks.queryByText('Unresolved')).toBeNull();
  expect(row('Class Levels').getByText('2')).toBeVisible();
  expect(screen.queryByText(/pf1:wizard/)).toBeNull();
});

test('a conflict offers only available alternatives as cards; a saved interpretation replaces the conflict instructions and can be cleared', async () => {
  setReads(conflict());
  const view = renderInputs({
    inputs: [{ input: wizard, classLabel: 'Wizard' }],
  });
  const inWizard = row('Wizard class levels');
  expect(
    inWizard.getByText(
      'Wizard class levels has conflicting rules. Choose an interpretation or enter a fallback for this value.',
    ),
  ).toBeVisible();
  const opener = button('Choose interpretation for Wizard class levels');
  fireEvent.click(opener);
  const group = screen.getByRole('radiogroup', {
    name: 'Interpretation for Wizard class levels',
  });
  const cards = within(group).getAllByRole('radio');
  expect(cards.map((card) => card.closest('label')?.textContent)).toEqual([
    'Arcane Bond3',
    'Bonded Archetype5',
  ]);
  expect(cards[0]).toHaveFocus();
  expect(screen.queryByText('Improved Familiar')).toBeNull();
  expect(screen.queryByText('Lost Wand')).toBeNull();

  await act(async () => {
    fireEvent.click(button('Save interpretation'));
  });
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Choose an interpretation.',
  );
  expect(server.writes).toHaveLength(0);
  fireEvent.click(
    within(group).getByRole('radio', { name: /Bonded Archetype/ }),
  );
  expect(
    within(group).getByRole('radio', { name: /Bonded Archetype/ }),
  ).toBeChecked();
  expect(screen.queryByRole('alert')).toBeNull();
  await act(async () => {
    fireEvent.click(button('Save interpretation'));
  });
  expect(lastWrite()).toMatchObject({
    name: 'saveLinkedInputInterpretation',
    args: {
      characterId,
      relationshipId,
      input: wizard,
      sourceKey: 'archetype',
    },
  });
  expect(screen.queryByRole('form')).toBeNull();
  expect(opener).toHaveFocus();
  expect(inWizard.getByText('Saved')).toBeVisible();

  setReads(
    conflict({
      resolution: 'interpretation',
      value: 5,
      interpretation: { sourceKey: 'archetype' },
      lastOperationId: lastWrite()!.args.operationId,
      revision: 2,
    }),
  );
  view.rerender({ inputs: [{ input: wizard, classLabel: 'Wizard' }] });
  expect(
    inWizard.getByText('Wizard class levels uses the saved interpretation.'),
  ).toBeVisible();
  expect(inWizard.queryByText(/has conflicting rules/)).toBeNull();
  expect(inWizard.getByText('5')).toBeVisible();
  expect(screen.queryByText(/updated by another player/)).toBeNull();
  fireEvent.click(button('Change interpretation for Wizard class levels'));
  expect(screen.getByRole('radio', { name: /Bonded Archetype/ })).toBeChecked();
  expect(screen.getByRole('radio', { name: /Bonded Archetype/ })).toHaveFocus();
  // The chosen source is lost while editing: the draft stays, and says why.
  setReads(
    conflict({
      candidates: [
        { sourceKey: 'bond', kind: 'available', value: 3 },
        { sourceKey: 'archetype', kind: 'unavailable', reason: 'missingInput' },
        { sourceKey: 'other', kind: 'available', value: 4 },
      ],
      sources: [
        { key: 'bond', label: 'Arcane Bond' },
        { key: 'other', label: 'Other Bond' },
      ],
      interpretation: { sourceKey: 'archetype' },
      lastOperationId: 'other-player',
      revision: 3,
    }),
  );
  view.rerender({ inputs: [{ input: wizard, classLabel: 'Wizard' }] });
  await act(async () => {
    fireEvent.click(button('Save interpretation'));
  });
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Choose an available interpretation.',
  );
  expect(
    screen.getByRole('form', {
      name: 'Interpretation for Wizard class levels',
    }),
  ).toBeVisible();
  expect(screen.queryByRole('radio', { name: /Bonded Archetype/ })).toBeNull();
  expect(server.writes).toHaveLength(1);
  fireEvent.click(button('Cancel Interpretation for Wizard class levels'));
  await act(async () => {
    fireEvent.click(button('Clear interpretation for Wizard class levels'));
  });
  expect(lastWrite()).toMatchObject({
    name: 'clearLinkedInputInterpretation',
    args: { input: wizard },
  });
});

test('fallback errors tell empty from invalid; an uncertain failure keeps the editor; applied and suspended fallbacks stay saved without double counting', async () => {
  setReads(unavailable(level, 'interrupted'));
  const view = renderInputs();
  fireEvent.click(button('Set fallback for Character level'));
  const field = screen.getByRole('textbox', {
    name: 'Fallback for Character level',
  });
  expect(field).toHaveValue('');
  expect(field).toHaveFocus();
  expect(field).toHaveAttribute('inputmode', 'text');
  expect(field).toHaveAttribute('pattern', '[+-]?[0-9]+');
  expect(field).toHaveClass('min-h-11', 'md:min-h-9');
  expect(field).toHaveAccessibleDescription(
    'Saved for when the value is unavailable. For lasting changes, use a personal adjustment.',
  );
  await act(async () => {
    fireEvent.click(button('Save fallback'));
  });
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Enter a fallback value.',
  );
  expect(field).toHaveAccessibleDescription(/Enter a fallback value\./);
  fireEvent.change(field, { target: { value: '7.5' } });
  await act(async () => {
    fireEvent.click(button('Save fallback'));
  });
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Enter a finite whole number.',
  );
  expect(server.writes).toHaveLength(0);

  server.isDeferred = true;
  fireEvent.change(field, { target: { value: '7' } });
  await act(async () => {
    fireEvent.click(button('Save fallback'));
  });
  expect(screen.getByText('Saving…')).toBeVisible();
  expect(button('Save fallback')).toBeDisabled();
  expect(button('Set fallback for Character level')).toBeDisabled();
  await act(async () => lastWrite()!.reject(new Error('Network lost')));
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Linked input may not have been saved. Check it before trying again.',
  );
  expect(field).toHaveValue('7');
  expect(server.writes).toHaveLength(1);
  server.isDeferred = false;
  await act(async () => {
    fireEvent.click(button('Save fallback'));
  });
  expect(lastWrite()).toMatchObject({
    name: 'saveLinkedInputFallback',
    args: { input: level, value: 7 },
  });
  expect(screen.queryByRole('form')).toBeNull();

  setReads(
    unavailable(level, 'interrupted', {
      resolution: 'fallback',
      value: 7,
      fallback: 7,
      fallbackState: 'applied',
      lastOperationId: lastWrite()!.args.operationId,
    }),
  );
  view.rerender();
  const inLevel = row('Character level');
  expect(inLevel.getByText('7')).toBeVisible();
  expect(
    inLevel.getByText(
      'Character level is unavailable while the Companion Relationship is interrupted.',
    ),
  ).toBeVisible();
  expect(
    inLevel.getByText('Using saved fallback 7 for Character level.'),
  ).toBeVisible();

  setReads(
    read(level, {
      value: 3,
      fallback: 7,
      fallbackState: 'suspended',
      lastOperationId: 'restored',
    }),
  );
  view.rerender();
  expect(inLevel.getByText('3')).toBeVisible();
  expect(inLevel.queryByText('10')).toBeNull();
  expect(
    inLevel.getByText(
      'Saved fallback 7 is suspended while Character level can be calculated. Saved for when the value is unavailable.',
    ),
  ).toBeVisible();
  fireEvent.click(button('Edit fallback for Character level'));
  expect(
    screen.getByRole('textbox', { name: 'Fallback for Character level' }),
  ).toHaveValue('7');
  fireEvent.keyDown(
    screen.getByRole('textbox', { name: 'Fallback for Character level' }),
    {
      key: 'Escape',
    },
  );
  expect(screen.queryByRole('form')).toBeNull();
  expect(button('Edit fallback for Character level')).toHaveFocus();
  await act(async () => {
    fireEvent.click(button('Clear fallback for Character level'));
  });
  expect(lastWrite()).toMatchObject({
    name: 'clearLinkedInputFallback',
    args: { input: level },
  });
});

test("saving is acknowledged in its own row only; another player's change shows beside the row and keeps the open draft", async () => {
  setReads(
    unavailable(level, 'interrupted'),
    unavailable(hitDice, 'interrupted'),
  );
  const inputs = [{ input: level }, { input: hitDice }];
  const view = renderInputs({ inputs });
  server.isDeferred = true;
  fireEvent.click(button('Set fallback for Character level'));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '0' } });
  await act(async () => {
    fireEvent.click(button('Save fallback'));
  });
  expect(row('Character level').getByText('Saving…')).toBeVisible();
  expect(row('Actual Hit Dice').queryByText('Saving…')).toBeNull();
  expect(button('Set fallback for Actual Hit Dice')).toBeEnabled();
  await act(async () => lastWrite()!.resolve(null));
  expect(lastWrite()!.args).toMatchObject({ value: 0 });
  expect(row('Character level').getByText('Saved')).toBeVisible();
  expect(row('Actual Hit Dice').queryByText('Saved')).toBeNull();

  server.isDeferred = false;
  fireEvent.click(button('Set fallback for Actual Hit Dice'));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '4' } });
  setReads(
    unavailable(level, 'interrupted'),
    read(hitDice, { value: 6, lastOperationId: 'other-player', revision: 2 }),
  );
  view.rerender({ inputs });
  const inHitDice = row('Actual Hit Dice');
  expect(
    inHitDice.getByText('Actual Hit Dice updated by another player.'),
  ).toBeVisible();
  expect(inHitDice.getByText('6')).toBeVisible();
  expect(
    screen.getByRole('textbox', { name: 'Fallback for Actual Hit Dice' }),
  ).toHaveValue('4');
  fireEvent.click(button('Dismiss Actual Hit Dice update'));
  expect(
    screen.queryByText('Actual Hit Dice updated by another player.'),
  ).toBeNull();
  expect(
    screen.getByRole('textbox', { name: 'Fallback for Actual Hit Dice' }),
  ).toHaveValue('4');
});

test('maintenance disables every edit with one stated reason and keeps the draft for after it lifts', async () => {
  setReads(
    unavailable(level, 'interrupted', {
      fallback: 2,
      fallbackState: 'applied',
      value: 2,
    }),
  );
  const view = renderInputs();
  fireEvent.click(button('Edit fallback for Character level'));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '8' } });

  server.maintenance = {
    kind: 'maintenance',
    readOnly: true,
    message: 'Paused.',
  };
  view.rerender();
  const message = 'Linked values are paused for maintenance.';
  expect(screen.getAllByText(message)).toHaveLength(1);
  for (const name of [
    'Edit fallback for Character level',
    'Clear fallback for Character level',
    'Save fallback',
  ]) {
    expect(button(name)).toBeDisabled();
    expect(button(name)).toHaveAccessibleDescription(message);
  }
  expect(row('Character level').getByText('2')).toBeVisible();
  expect(screen.getByRole('textbox')).toHaveValue('8');

  server.maintenance = { kind: 'ready', readOnly: false, message: '' };
  view.rerender();
  expect(screen.queryByText(message)).toBeNull();
  await act(async () => {
    fireEvent.click(button('Save fallback'));
  });
  expect(lastWrite()).toMatchObject({
    name: 'saveLinkedInputFallback',
    args: { value: 8 },
  });
});

test('moving to another relationship hides the old editor and its status', async () => {
  setReads(unavailable(level, 'interrupted'));
  const view = renderInputs();
  fireEvent.click(button('Set fallback for Character level'));
  expect(
    screen.getByRole('form', { name: 'Fallback for Character level' }),
  ).toBeVisible();
  view.rerender({ relationship: 'other' as Id<'companionRelationship'> });
  expect(screen.queryByRole('form')).toBeNull();
  expect(server.queries.at(-1)).toMatchObject({ relationshipId: 'other' });
});

// #326: a familiar borrows its master's class-derived base attack bonus and
// base saves, recorded ranks and calculated maximum hit points, each a
// component rather than a finished total.
test('a familiar’s master values name class-derived bonuses and recorded ranks with their own fallbacks; unavailable ones add no hidden field and a restored fallback stays saved but suspended', () => {
  const bab = { kind: 'baseAttackBonus' } as const;
  const fort = { kind: 'baseSave', save: 'fort' } as const;
  setReads(
    read(bab, { value: 3 }),
    unavailable(fort, 'interrupted'),
    read(ranks, {
      value: 4,
      fallback: 2,
      fallbackState: 'suspended',
    }),
    read(maximumHp, { value: 49 }),
  );
  renderInputs({
    inputs: [
      { input: bab },
      { input: fort },
      { input: ranks },
      { input: maximumHp },
    ],
  });
  expect(row('Class-derived base attack bonus').getByText('3')).toBeVisible();
  expect(row('Calculated maximum hit points').getByText('49')).toBeVisible();
  const inFort = row('Fortitude base save');
  expect(inFort.getByText('Unresolved')).toBeVisible();
  expect(
    inFort.getByRole('button', {
      name: 'Set fallback for Fortitude base save',
    }),
  ).toBeEnabled();
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(document.querySelector('[required], input[type="hidden"]')).toBeNull();
  const inRanks = row('Perception ranks');
  expect(inRanks.getByText('4')).toBeVisible();
  expect(
    inRanks.getByText(
      'Saved fallback 2 is suspended while Perception ranks can be calculated. Saved for when the value is unavailable.',
    ),
  ).toBeVisible();
  expect(
    inRanks.getByRole('button', {
      name: 'Clear fallback for Perception ranks',
    }),
  ).toBeEnabled();
});
