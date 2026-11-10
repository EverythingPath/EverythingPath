import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import { activityFixture } from '../../../tests/rules/activity-fixture';
import { occurrence } from '../../../tests/rules/event-selection-fixture';
import { resourceEventFixture } from '../../../tests/rules/resource-event-fixture';
import { threatEventFixture } from '../../../tests/rules/threat-event-fixture';
import { roll } from '../../../tests/rules/upkeep-fixture';
import { eventView } from './event-facts';
import { EventView } from './event-view';

vi.mock('~/components/ui/select', () => import('./native-select-test-double'));

function view(draft: WeeklyDraft, snapshot: UpkeepSnapshot) {
  const source = workspaceSourceSchema.parse({
    key: { campaignId: 'c', militiaId: 'm', draftId: draft.draftId },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [
      { characterId: 'pc', name: 'Wren Ashby' },
      { characterId: 'second', name: 'Nora Vell' },
    ],
  });
  return eventView(
    draft,
    source,
    projectWeeklyDraft({ revision: draft, militiaSnapshot: snapshot }),
  );
}
const total = (sides: number, diceTotal: number) => ({
  diceTotal,
  diceCount: 1,
  sides,
  provenance: { kind: 'table' },
  modifiers: [],
});
const lastEdit = (edit: ReturnType<typeof vi.fn>) => edit.mock.lastCall![0];
const block = (label: string) => screen.getByRole('group', { name: label });

test('[EVT-07.found-fire-view] Found Fire adds a reward in gp to the copper, edits it in place and removes it', async () => {
  const { draft, snapshot } = resourceEventFixture(22);
  snapshot.characters.push({
    ...snapshot.characters[0]!,
    characterId: 'second',
  });
  snapshot.roster.people.push({
    ...snapshot.roster.people[0]!,
    characterId: 'second',
  });
  const edit = vi.fn();
  render(
    <EventView view={view(draft, snapshot)} edit={edit} disabled={false} />,
  );
  const fire = block('Event 1');
  const nora = within(fire).getByRole('group', {
    name: 'Rewards for Nora Vell · Event 1',
  });
  // Wren already has one; only Nora may add hers.
  expect(
    within(fire).queryByRole('button', {
      name: 'Add reward for Wren Ashby · Event 1',
    }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    within(nora).getByRole('button', {
      name: 'Add reward for Nora Vell · Event 1',
    }),
  );
  const form = within(nora).getByRole('group', {
    name: 'New reward for Nora Vell · Event 1',
  });
  // Blank fields are required, not malformed; nothing is sent.
  fireEvent.click(
    within(form).getByRole('button', { name: 'Save reward · Event 1' }),
  );
  expect(await within(form).findByText('A name is required.')).toBeVisible();
  expect(within(form).getByText('A value in gp is required.')).toBeVisible();
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(within(form).getByRole('textbox', { name: 'Name' }), {
    target: { value: 'Tanglefoot bag' },
  });
  fireEvent.change(within(form).getByRole('textbox', { name: 'Value (gp)' }), {
    target: { value: '50.x' },
  });
  fireEvent.change(within(form).getByRole('textbox', { name: 'Weight (lb)' }), {
    target: { value: '4.5' },
  });
  fireEvent.click(
    within(form).getByRole('button', { name: 'Save reward · Event 1' }),
  );
  expect(
    await within(form).findByText('Enter an amount in gp, such as 12 or 0.07.'),
  ).toBeVisible();
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(within(form).getByRole('textbox', { name: 'Value (gp)' }), {
    target: { value: '50.07' },
  });
  fireEvent.click(
    within(form).getByRole('button', { name: 'Save reward · Event 1' }),
  );
  await waitFor(() => expect(edit).toHaveBeenCalled());
  const added = lastEdit(edit).occurrence.rewards[1];
  expect(added).toEqual({
    itemId: expect.stringMatching(/^reward:/),
    characterId: 'second',
    name: 'Tanglefoot bag',
    valueCopper: 5007,
    weight: 4.5,
    alchemical: true,
    poison: false,
  });
  // The recorded reward is edited in place under its own identity.
  const wren = within(fire).getByRole('group', {
    name: 'Rewards for Wren Ashby · Event 1',
  });
  fireEvent.click(
    within(wren).getByRole('button', {
      name: 'Edit Alchemist fire for Wren Ashby · Event 1',
    }),
  );
  const editing = within(wren).getByRole('group', {
    name: 'Edit Alchemist fire · Event 1',
  });
  expect(
    within(editing).getByRole('textbox', { name: 'Value (gp)' }),
  ).toHaveValue('100');
  fireEvent.change(
    within(editing).getByRole('textbox', { name: 'Value (gp)' }),
    { target: { value: '99.99' } },
  );
  fireEvent.click(
    within(editing).getByRole('button', { name: 'Save reward · Event 1' }),
  );
  await waitFor(() =>
    expect(lastEdit(edit).occurrence.rewards).toEqual([
      { ...draft.event.occurrences[0]!.rewards![0]!, valueCopper: 9999 },
    ]),
  );
  fireEvent.click(
    within(wren).getByRole('button', {
      name: 'Remove Alchemist fire for Wren Ashby · Event 1',
    }),
  );
  expect(lastEdit(edit).occurrence).not.toHaveProperty('rewards');
});

test('[EVT-11.found-fire-exception] a reward outside the rules keeps its Rules Exception beside it', async () => {
  const { draft, snapshot } = resourceEventFixture(22);
  draft.event.occurrences[0]!.rewards![0]!.poison = true;
  const edit = vi.fn();
  const { rerender } = render(
    <EventView view={view(draft, snapshot)} edit={edit} disabled={false} />,
  );
  const exception = within(block('Event 1')).getByRole('group', {
    name: 'Rules Exception for Alchemist fire · Event 1',
  });
  const reason = within(exception).getByRole('textbox', {
    name: 'Rules Exception reason for Alchemist fire · Event 1',
  });
  fireEvent.change(reason, { target: { value: 'The table allowed a poison' } });
  fireEvent.submit(reason);
  await waitFor(() =>
    expect(lastEdit(edit)).toEqual({
      kind: 'rules_exception',
      exception: {
        exceptionId: 'event:reward:event:alchemical-reward',
        subjectId: 'reward:event',
        ruleId: 'alchemical-reward',
        reason: 'The table allowed a poison',
      },
    }),
  );
  // The general exception list does not repeat it.
  expect(
    within(block('Event 1')).queryAllByRole('textbox', {
      name: 'Event exception reason',
    }),
  ).toHaveLength(0);
  draft.rulesExceptions.push({
    exceptionId: 'event:reward:event:alchemical-reward',
    subjectId: 'reward:event',
    ruleId: 'alchemical-reward',
    reason: 'The table allowed a poison',
  });
  rerender(
    <EventView view={view(draft, snapshot)} edit={edit} disabled={false} />,
  );
  fireEvent.click(
    within(block('Event 1')).getByRole('button', {
      name: 'Remove the Rules Exception for Alchemist fire · Event 1',
    }),
  );
  expect(lastEdit(edit)).toEqual({
    kind: 'clear_rules_exception',
    exceptionId: 'event:reward:event:alchemical-reward',
  });
});

test('[EVT-08.cache-view] each discovered cache takes its own Attempt it and Secrecy check', () => {
  const { draft, snapshot } = threatEventFixture(62, true);
  const edit = vi.fn();
  const { rerender } = render(
    <EventView view={view(draft, snapshot)} edit={edit} disabled={false} />,
  );
  const road = within(block('Event 1.2')).getByRole('group', {
    name: 'Minor cache at Road · Event 1.2',
  });
  fireEvent.click(
    within(road).getByRole('button', {
      name: 'Attempt it for Minor cache at Road · Event 1.2',
    }),
  );
  expect(lastEdit(edit).occurrence.targetChecks).toEqual([
    {
      target: { kind: 'cache', cacheId: 'returning' },
      mitigation: 'attempted',
    },
  ]);
  draft.event.occurrences[2]!.targetChecks = [
    {
      target: { kind: 'cache', cacheId: 'returning' },
      mitigation: 'attempted',
    },
  ];
  rerender(
    <EventView view={view(draft, snapshot)} edit={edit} disabled={false} />,
  );
  fireEvent.change(
    within(block('Event 1.2')).getByRole('textbox', {
      name: 'Secrecy check for Minor cache at Road',
    }),
    { target: { value: '0' } },
  );
  expect(lastEdit(edit).occurrence.targetChecks).toEqual([
    {
      target: { kind: 'cache', cacheId: 'returning' },
      mitigation: 'attempted',
      rolls: { check: total(20, 0) },
    },
  ]);
  // The first's cache is its own: nothing in Event 1.1 changed.
  expect(
    within(block('Event 1.1')).getByRole('button', {
      name: 'Attempt it for Minor cache at Bridge · Event 1.1',
      pressed: false,
    }),
  ).toBeVisible();
});

test('[EVT-07.item-and-town-view] item and town cards are named for their block and record their target', () => {
  const code = resourceEventFixture(18);
  delete code.draft.event.occurrences[0]!.targets;
  const edit = vi.fn();
  render(
    <EventView
      view={view(code.draft, code.snapshot)}
      edit={edit}
      disabled={false}
    />,
  );
  fireEvent.click(
    within(block('Event 1')).getByRole('button', {
      name: 'Unknown relic · Event 1',
    }),
  );
  expect(lastEdit(edit).occurrence.targets).toEqual([
    { kind: 'item', itemId: 'mystery' },
  ]);
  cleanup();
  const festival = resourceEventFixture(34);
  render(
    <EventView
      view={view(festival.draft, festival.snapshot)}
      edit={edit}
      disabled={false}
    />,
  );
  fireEvent.click(
    within(block('Event 1')).getByRole('button', {
      name: 'Clear town that celebrates for Event 1',
    }),
  );
  expect(lastEdit(edit).occurrence).not.toHaveProperty('targets');
});

test('[EVT-12.hidden-agenda-view] Hidden Agenda shows the recalculated Activity check and links back to Activity', () => {
  const { draft, snapshot } = activityFixture('drill_militia');
  draft.activity.slots[0]!.choice = {
    choiceId: 'drill',
    actionId: 'drill_militia',
    rolls: { check: roll(20, 8) },
  };
  draft.event.chanceRoll = roll(100, 1);
  draft.event.occurrences = [occurrence('agenda', 42)];
  const openActivitySlot = vi.fn();
  render(
    <EventView
      view={view(draft, snapshot)}
      edit={vi.fn()}
      disabled={false}
      openActivitySlot={openActivitySlot}
    />,
  );
  const checks = within(block('Event 1')).getByRole('group', {
    name: 'Recalculated Activity checks · Event 1',
  });
  expect(checks).toHaveTextContent('Action Slot 1 · Drill Militia');
  expect(checks).toHaveTextContent('Decided by this bonus');
  expect(checks).toHaveTextContent('Required roll: enter 2d6.');
  // The newly required roll links to its own choice in Activity.
  fireEvent.click(
    within(checks).getByRole('button', {
      name: 'Open Action Slot 1 · Drill Militia in Activity for Event 1',
    }),
  );
  expect(openActivitySlot).toHaveBeenCalledWith('one');
});

test('[EVT-07.resource-disabled] Confirmation disables every reward, cache and card control', () => {
  const { draft, snapshot } = resourceEventFixture(22);
  render(
    <EventView view={view(draft, snapshot)} edit={vi.fn()} disabled={true} />,
  );
  for (const name of [
    'Edit Alchemist fire for Wren Ashby · Event 1',
    'Remove Alchemist fire for Wren Ashby · Event 1',
  ])
    expect(
      within(block('Event 1')).getByRole('button', { name }),
    ).toBeDisabled();
});
