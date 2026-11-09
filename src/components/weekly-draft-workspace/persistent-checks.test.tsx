import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { expect, test, vi } from 'vitest';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { editWeeklyDraft } from '~/lib/weekly-draft';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import type { WeeklyDraft, WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import { persistentEventFixture } from '../../../tests/rules/persistent-event-fixture';
import { persistentView } from './persistent-facts';
import { PersistentView } from './persistent-view';

vi.mock('~/components/ui/select', () => import('./native-select-test-double'));

const total = (value: number, modifiers: RawRoll['modifiers'] = []) =>
  ({
    diceTotal: value,
    diceCount: 1,
    sides: 20,
    provenance: { kind: 'table' },
    modifiers,
  }) satisfies RawRoll;

// Two carried Thefts, a Rivalry between two teams and a Low Morale. Aubrin
// (Constitution 16) is the Overseer; Pell holds no officer role.
function week() {
  const { draft, snapshot } = persistentEventFixture('theft');
  snapshot.treasuryCopper = 100000;
  snapshot.characters[0]!.constitution = 16;
  snapshot.characters.push({ ...snapshot.characters[0]!, characterId: 'pell' });
  snapshot.roster.people.push({
    ...snapshot.roster.people[0]!,
    characterId: 'pell',
  });
  draft.context = {
    ...draft.context,
    carriedEvents: [
      {
        eventId: 'old',
        eventType: 'theft',
        startedWeek: 1,
        order: 0,
        targets: [],
      },
      {
        eventId: 'new',
        eventType: 'theft',
        startedWeek: 1,
        order: 1,
        targets: [],
      },
      {
        eventId: 'rivalry',
        eventType: 'rivalry',
        startedWeek: 1,
        order: 2,
        targets: [
          { kind: 'team', teamId: 'team' },
          { kind: 'team', teamId: 'second-team' },
        ],
      },
      {
        eventId: 'morale',
        eventType: 'low_morale',
        startedWeek: 1,
        order: 3,
        targets: [],
      },
    ],
  };
  return { draft, snapshot };
}

// A small stand-in for the Workspace store: accepted edits apply to the
// draft and re-render; `refuse` rejects chosen edits.
function workspace(
  initial: WeeklyDraft,
  snapshot: UpkeepSnapshot,
  refuse: (edit: WeeklyDraftEdit) => boolean = () => false,
) {
  let draft = initial;
  const listeners = new Set<() => void>();
  const sent: WeeklyDraftEdit[] = [];
  const edit = vi.fn(async (next: WeeklyDraftEdit) => {
    sent.push(next);
    if (refuse(next)) return 'failed' as const;
    const result = editWeeklyDraft(draft, next);
    if (!result.ok) return 'failed' as const;
    draft = result.draft;
    act(() => listeners.forEach((listener) => listener()));
    return 'accepted' as const;
  });
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const view = () => {
    const source = workspaceSourceSchema.parse({
      key: { campaignId: 'c', militiaId: 'm', draftId: draft.draftId },
      week: draft.week,
      sourceRevision: 0,
      snapshot,
      people: [
        { characterId: 'pc', name: 'Aubrin' },
        { characterId: 'pell', name: 'Pell' },
      ],
    });
    return persistentView(
      draft,
      source,
      projectWeeklyDraft({ revision: draft, militiaSnapshot: snapshot }),
    );
  };
  function Persistent({ disabled = false }: { disabled?: boolean }) {
    useSyncExternalStore(subscribe, () => draft);
    return (
      <PersistentView
        view={view()}
        edit={edit}
        disabled={disabled}
        latestOverseer={() => view().overseer}
      />
    );
  }
  return { Persistent, edit, sent, draft: () => draft };
}

const section = (name: string) => screen.getByRole('group', { name });
const decisionOf = (draft: WeeklyDraft, eventId: string) =>
  draft.persistent.decisions.find((entry) => entry.eventId === eventId);

test('[PER-04.theft] [rules.P84.theft] Theft offers only its Loyalty dice total and the shared support, and a roll keeps every other field', async () => {
  const { draft, snapshot } = week();
  draft.persistent.decisions = [
    {
      kind: 'mitigate',
      eventId: 'old',
      overseerCharacterId: 'pc',
      officerCheck: { characterId: 'pc', skill: 'bluff' },
    },
  ];
  const store = workspace(draft, snapshot);
  render(<store.Persistent />);
  const theft = section('Theft · Event 1');
  const roll = within(theft).getByRole('textbox', { name: 'Loyalty check' });
  expect(
    within(theft).getByText(/1d20 · total of the dice only/),
  ).toBeVisible();
  // No generic roll builder, officer fields or sides.
  for (const name of [
    'Add rolls',
    'Add officer check',
    'Save persistent decision',
  ])
    expect(within(theft).queryByRole('button', { name })).toBeNull();
  expect(within(theft).queryByRole('textbox', { name: /sides/i })).toBeNull();
  expect(within(theft).getByRole('switch')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  fireEvent.change(roll, { target: { value: '9' } });
  await waitFor(() => expect(store.sent).toHaveLength(1));
  expect(decisionOf(store.draft(), 'old')).toEqual({
    kind: 'mitigate',
    eventId: 'old',
    overseerCharacterId: 'pc',
    officerCheck: { characterId: 'pc', skill: 'bluff' },
    rolls: { check: total(9) },
  });
  // Rank and focus, Officers, Overseer +3 and Low Morale −2, named once each.
  expect(theft).toHaveTextContent('Overseer +3');
  expect(theft).toHaveTextContent('Low Morale −2');
  expect(theft).toHaveTextContent(
    /Failure · Half of this week’s incoming gains are lost as usual\./,
  );
  // Malformed text is refused locally and never sent.
  fireEvent.change(roll, { target: { value: '9x' } });
  expect(roll).toHaveAttribute('aria-invalid', 'true');
  expect(store.sent).toHaveLength(1);
  // The retained officer check stays visible and removable, never counted.
  expect(theft).toHaveTextContent('Also recorded, not used by this check');
  fireEvent.click(
    within(theft).getByRole('button', {
      name: 'Remove retained Officer check',
    }),
  );
  await waitFor(() => expect(store.sent).toHaveLength(2));
  expect(decisionOf(store.draft(), 'old')).toEqual({
    kind: 'mitigate',
    eventId: 'old',
    overseerCharacterId: 'pc',
    rolls: { check: total(9) },
  });
});

test('[PER-04.support-move] tapping support on the second Theft moves it there and a later roll keeps it', async () => {
  const { draft, snapshot } = week();
  draft.persistent.decisions = [
    {
      kind: 'mitigate',
      eventId: 'old',
      overseerCharacterId: 'pc',
      rolls: { check: total(12) },
    },
    { kind: 'mitigate', eventId: 'new' },
  ];
  const store = workspace(draft, snapshot);
  render(<store.Persistent />);
  const second = section('Theft · Event 2');
  const toggle = within(second).getByRole('switch');
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  expect(second).toHaveTextContent(
    'Now on Theft (week 1). Tapping moves it here.',
  );
  fireEvent.click(toggle);
  await waitFor(() => expect(store.sent).toHaveLength(2));
  // Cleared from the first Theft (keeping its roll), then recorded here.
  expect(decisionOf(store.draft(), 'old')).toEqual({
    kind: 'mitigate',
    eventId: 'old',
    rolls: { check: total(12) },
  });
  fireEvent.change(
    within(section('Theft · Event 2')).getByRole('textbox', {
      name: 'Loyalty check',
    }),
    { target: { value: '15' } },
  );
  await waitFor(() => expect(store.sent).toHaveLength(3));
  expect(decisionOf(store.draft(), 'new')).toEqual({
    kind: 'mitigate',
    eventId: 'new',
    overseerCharacterId: 'pc',
    rolls: { check: total(15) },
  });
  expect(
    within(section('Theft · Event 1')).getByRole('switch'),
  ).toHaveAttribute('aria-checked', 'false');
  expect(section('Theft · Event 1')).not.toHaveTextContent('Overseer +3');
  expect(section('Theft · Event 2')).toHaveTextContent('Overseer +3');
});

test('[PER-04.support-failure] a move whose assignment is refused says support is on no event and retries to finish', async () => {
  const { draft, snapshot } = week();
  draft.persistent.decisions = [
    { kind: 'mitigate', eventId: 'old', overseerCharacterId: 'pc' },
    { kind: 'mitigate', eventId: 'new' },
  ];
  let refuseAssign = true;
  const store = workspace(
    draft,
    snapshot,
    (edit) =>
      refuseAssign &&
      edit.kind === 'persistent_decision' &&
      edit.decision.eventId === 'new',
  );
  render(<store.Persistent />);
  fireEvent.click(within(section('Theft · Event 2')).getByRole('switch'));
  expect(
    await within(section('Theft · Event 2')).findByText(
      'Overseer support was removed elsewhere but could not be added to Theft (week 1). It is on no event now.',
    ),
  ).toHaveAttribute('role', 'alert');
  // Never on two events: the accepted clear stands.
  expect(decisionOf(store.draft(), 'old')).toEqual({
    kind: 'mitigate',
    eventId: 'old',
  });
  refuseAssign = false;
  fireEvent.click(
    within(section('Theft · Event 2')).getByRole('button', {
      name: 'Try again: move Overseer support',
    }),
  );
  await waitFor(() =>
    expect(decisionOf(store.draft(), 'new')).toEqual({
      kind: 'mitigate',
      eventId: 'new',
      overseerCharacterId: 'pc',
    }),
  );
});

test('[PER-04.rivalry] [rules.P84.officer] Rivalry takes a character with role context, one skill, a signed bonus and one roll total', async () => {
  const { draft, snapshot } = week();
  draft.persistent.decisions = [{ kind: 'mitigate', eventId: 'rivalry' }];
  const store = workspace(draft, snapshot);
  render(<store.Persistent />);
  const rivalry = section('Rivalry · Event 3');
  const character = within(rivalry).getByRole('combobox', {
    name: 'Character',
  });
  const skill = within(rivalry).getByRole('combobox', { name: 'Skill' });
  // No false default: nothing is selected until chosen.
  expect(character).toHaveValue('');
  expect(skill).toHaveValue('');
  expect(
    within(character)
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual(['', 'Aubrin · Overseer', 'Pell · not an officer']);
  expect(
    within(rivalry).getByRole('textbox', { name: 'Skill bonus' }),
  ).toBeDisabled();
  fireEvent.change(character, { target: { value: 'pc' } });
  // A character alone cannot be stored; it waits for the skill.
  expect(store.sent).toHaveLength(0);
  expect(character).toHaveValue('pc');
  fireEvent.change(skill, { target: { value: 'intimidate' } });
  await waitFor(() => expect(store.sent).toHaveLength(1));
  const bonus = within(section('Rivalry · Event 3')).getByRole('textbox', {
    name: 'Skill bonus',
  });
  fireEvent.change(bonus, { target: { value: '-' } });
  expect(store.sent).toHaveLength(1);
  fireEvent.change(bonus, { target: { value: '-2' } });
  await waitFor(() => expect(store.sent).toHaveLength(2));
  fireEvent.change(
    within(section('Rivalry · Event 3')).getByRole('textbox', {
      name: 'Officer check roll',
    }),
    { target: { value: '20' } },
  );
  await waitFor(() => expect(store.sent).toHaveLength(3));
  expect(decisionOf(store.draft(), 'rivalry')).toEqual({
    kind: 'mitigate',
    eventId: 'rivalry',
    officerCheck: {
      characterId: 'pc',
      skill: 'intimidate',
      skillBonus: -2,
      roll: total(20),
    },
  });
  const done = section('Rivalry · Event 3');
  expect(done).toHaveTextContent('Bonus −2= 18 vs DC 20');
  expect(done).toHaveTextContent('Failure · The Rivalry stays.');
  // A skill check: no organization or Overseer contribution, no toggle.
  expect(within(done).queryByRole('switch')).toBeNull();
  expect(done).not.toHaveTextContent('Rank and focus');
  fireEvent.change(within(done).getByRole('textbox', { name: 'Skill bonus' }), {
    target: { value: '0' },
  });
  await waitFor(() => expect(store.sent).toHaveLength(4));
  expect(section('Rivalry · Event 3')).toHaveTextContent(
    'Success · Ends the Rivalry for good.',
  );
  expect(section('Rivalry · Event 3')).toHaveTextContent(
    'Ends · officer check succeeded',
  );
});

test('[PER-08.officer] a non-officer check asks for its Rules Exception in the section', () => {
  const { draft, snapshot } = week();
  draft.persistent.decisions = [
    {
      kind: 'mitigate',
      eventId: 'rivalry',
      officerCheck: {
        characterId: 'pell',
        skill: 'bluff',
        skillBonus: 4,
        roll: total(19),
      },
    },
  ];
  const store = workspace(draft, snapshot);
  render(<store.Persistent />);
  const rivalry = section('Rivalry · Event 3');
  expect(rivalry).toHaveTextContent(
    'Not an officer: this check needs a Rules Exception, recorded below.',
  );
  expect(
    within(rivalry).getByRole('textbox', { name: 'Rules Exception reason' }),
  ).toBeVisible();
  expect(rivalry).toHaveTextContent('Check needs a Rules Exception');
  // The exception block explains the warning; it is not repeated above it.
  expect(
    within(rivalry).getAllByText(
      /The selected character is not currently an officer/,
    ),
  ).toHaveLength(1);
});

test('[PER-04.modifiers-view] a custom modifier is validated, added, edited in place and removed; a refused save keeps the form', async () => {
  const { draft, snapshot } = week();
  draft.persistent.decisions = [
    { kind: 'mitigate', eventId: 'old', rolls: { check: total(10) } },
  ];
  let refuse = false;
  const store = workspace(draft, snapshot, () => refuse);
  render(<store.Persistent />);
  const theft = () => section('Theft · Event 1');
  fireEvent.click(
    within(theft()).getByRole('button', { name: 'Add modifier' }),
  );
  fireEvent.click(
    within(theft()).getByRole('button', { name: 'Add modifier' }),
  );
  expect(await within(theft()).findByText('Enter a value.')).toBeVisible();
  expect(within(theft()).getByText('A reason is required.')).toBeVisible();
  fireEvent.change(within(theft()).getByRole('textbox', { name: 'Value' }), {
    target: { value: '+2' },
  });
  fireEvent.change(within(theft()).getByRole('textbox', { name: 'Reason' }), {
    target: { value: 'Stirring speech' },
  });
  refuse = true;
  fireEvent.click(
    within(theft()).getByRole('button', { name: 'Add modifier' }),
  );
  expect(
    await within(theft()).findByText('This modifier wasn’t saved. Try again.'),
  ).toBeVisible();
  expect(within(theft()).getByRole('textbox', { name: 'Reason' })).toHaveValue(
    'Stirring speech',
  );
  refuse = false;
  fireEvent.click(
    within(theft()).getByRole('button', { name: 'Add modifier' }),
  );
  await waitFor(() => expect(theft()).toHaveTextContent('Stirring speech +2'));
  const added = decisionOf(store.draft(), 'old');
  const source =
    added?.kind === 'mitigate'
      ? added.rolls?.check?.modifiers[0]?.sourceId
      : '';
  expect(source).toMatch(/^custom:/);
  fireEvent.click(
    within(theft()).getByRole('button', {
      name: 'Edit modifier Stirring speech',
    }),
  );
  fireEvent.change(within(theft()).getByRole('textbox', { name: 'Value' }), {
    target: { value: '-1' },
  });
  fireEvent.change(within(theft()).getByRole('textbox', { name: 'Reason' }), {
    target: { value: 'Heckled' },
  });
  fireEvent.click(
    within(theft()).getByRole('button', { name: 'Save modifier' }),
  );
  await waitFor(() => expect(theft()).toHaveTextContent('Heckled −1'));
  const edited = decisionOf(store.draft(), 'old');
  expect(edited?.kind === 'mitigate' && edited.rolls?.check?.modifiers).toEqual(
    [{ sourceId: source, value: -1, reason: 'Heckled' }],
  );
  fireEvent.click(
    within(theft()).getByRole('button', { name: 'Remove modifier Heckled' }),
  );
  await waitFor(() =>
    expect(decisionOf(store.draft(), 'old')).toEqual({
      kind: 'mitigate',
      eventId: 'old',
      rolls: { check: total(10) },
    }),
  );
});

test('[PER-04.retype] retyping a roll through a blank keeps the modifiers recorded on it', async () => {
  const { draft, snapshot } = week();
  const luck = { sourceId: 'custom:a', value: 1, reason: 'Luck' };
  draft.persistent.decisions = [
    { kind: 'mitigate', eventId: 'old', rolls: { check: total(15, [luck]) } },
  ];
  const store = workspace(draft, snapshot);
  render(<store.Persistent />);
  const roll = () =>
    within(section('Theft · Event 1')).getByRole('textbox', {
      name: 'Loyalty check',
    });
  fireEvent.change(roll(), { target: { value: '' } });
  await waitFor(() => expect(store.sent).toHaveLength(1));
  expect(decisionOf(store.draft(), 'old')).toEqual({
    kind: 'mitigate',
    eventId: 'old',
  });
  fireEvent.change(roll(), { target: { value: '12' } });
  await waitFor(() => expect(store.sent).toHaveLength(2));
  expect(decisionOf(store.draft(), 'old')).toEqual({
    kind: 'mitigate',
    eventId: 'old',
    rolls: { check: total(12, [luck]) },
  });
});

test('[PER-04.field-failure] a refused Rivalry field says so and keeps the local choice for a retry', async () => {
  const { draft, snapshot } = week();
  draft.persistent.decisions = [{ kind: 'mitigate', eventId: 'rivalry' }];
  let refuse = true;
  const store = workspace(draft, snapshot, () => refuse);
  render(<store.Persistent />);
  const rivalry = () => section('Rivalry · Event 3');
  const character = within(rivalry()).getByRole('combobox', {
    name: 'Character',
  });
  fireEvent.change(character, { target: { value: 'pc' } });
  fireEvent.change(within(rivalry()).getByRole('combobox', { name: 'Skill' }), {
    target: { value: 'bluff' },
  });
  expect(
    await within(rivalry()).findByText('This change wasn’t saved. Try again.'),
  ).toHaveAttribute('role', 'alert');
  // The character and skill stay chosen; choosing the skill again saves.
  expect(character).toHaveValue('pc');
  refuse = false;
  fireEvent.change(within(rivalry()).getByRole('combobox', { name: 'Skill' }), {
    target: { value: 'diplomacy' },
  });
  await waitFor(() =>
    expect(decisionOf(store.draft(), 'rivalry')).toEqual({
      kind: 'mitigate',
      eventId: 'rivalry',
      officerCheck: { characterId: 'pc', skill: 'diplomacy' },
    }),
  );
  expect(
    within(rivalry()).queryByText('This change wasn’t saved. Try again.'),
  ).toBeNull();
});

test('[WEEK-10.check-locked] Confirmation disables every check field, modifier and support control', () => {
  const { draft, snapshot } = week();
  draft.persistent.decisions = [
    {
      kind: 'mitigate',
      eventId: 'old',
      overseerCharacterId: 'pc',
      officerCheck: { characterId: 'pc', skill: 'bluff' },
      rolls: {
        check: total(10, [{ sourceId: 'custom:a', value: 1, reason: 'Luck' }]),
      },
    },
    {
      kind: 'mitigate',
      eventId: 'rivalry',
      officerCheck: { characterId: 'pc', skill: 'bluff', skillBonus: 1 },
    },
  ];
  const store = workspace(draft, snapshot);
  render(<store.Persistent disabled />);
  for (const name of ['Theft · Event 1', 'Rivalry · Event 3'])
    for (const control of [
      ...within(section(name)).getAllByRole('button'),
      ...within(section(name)).getAllByRole('textbox'),
      ...within(section(name)).queryAllByRole('combobox'),
      ...within(section(name)).queryAllByRole('switch'),
    ])
      expect(control).toBeDisabled();
});
