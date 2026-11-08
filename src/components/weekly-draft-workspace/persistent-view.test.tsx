import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { PersistentView } from './persistent-view';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { PersistentView as Facts } from './types';

type Event = Facts['events'][number];
const rivalry: Event = {
  eventId: 'rivalry',
  eventType: 'rivalry',
  startedWeek: 1,
  order: 1,
  targets: [
    { kind: 'team', teamId: 'one' },
    { kind: 'team', teamId: 'two' },
  ],
  name: 'Rivalry · Event 1',
  typeLabel: 'Rivalry',
  ageWeeks: 3,
  orderLabel: '2nd that week',
  targetNames: ['Scouts', 'Rangers'],
  decision: null,
  ended: false,
  endedBy: null,
  result: { tone: 'stays', text: 'Stays' },
  leaveNote: 'The two rival teams cannot act in the Activity phase.',
  check: {
    label: 'Officer check to end it',
    note: 'An officer ends the Rivalry for good.',
  },
  changes: [],
  checks: [],
  theftCheck: null,
  rivalryCheck: null,
  retained: [],
  exceptions: [],
  requirements: [],
  warnings: [],
};
const theft: Event = {
  ...rivalry,
  eventId: 'theft',
  eventType: 'theft',
  order: 0,
  targets: [],
  name: 'Theft · Event 2',
  typeLabel: 'Theft',
  orderLabel: '1st that week',
  targetNames: [],
  leaveNote: 'Half of all incoming treasury gains are lost.',
  check: {
    label: 'Loyalty check (this week only)',
    note: 'A Loyalty check against DC 20 keeps 90% of this week’s gains.',
  },
};
const morale: Event = {
  ...rivalry,
  eventId: 'morale',
  eventType: 'low_morale',
  targets: [],
  name: 'Low Morale · Event 3',
  typeLabel: 'Low Morale',
  targetNames: [],
  leaveNote: 'Loyalty checks suffer −2.',
  check: null,
};
const view: Facts = {
  phase: 'persistent',
  ready: true,
  firstBuyoff: true,
  buyoffAvailability: 'First buyoff available now',
  nextBuyoffWeek: 4,
  buyoffCostCopper: 4000,
  earlierPhases: [],
  options: { characterId: [{ value: 'pc', label: 'Aubrin' }] },
  events: [rivalry],
  requirements: [],
  warnings: [],
};
const accepted = () =>
  vi.fn<(edit: unknown) => Promise<'accepted' | 'failed'>>(() =>
    Promise.resolve('accepted'),
  );
function show(events: Event[], extra: Partial<Facts> = {}, edit = accepted()) {
  const result = render(
    <PersistentView
      view={{ ...view, ...extra, events }}
      edit={edit}
      disabled={false}
      openSource={vi.fn()}
    />,
  );
  return { ...result, edit };
}
const group = (name: string) => screen.getByRole('group', { name });
const card = (event: string, name: string) =>
  within(group(`${event} decision`)).getByRole('button', { name });

test('[PER-01.overview] the overview shows availability, rules cost, cadence and the next buyoff week', () => {
  show([rivalry]);
  const section = screen.getByRole('region', {
    name: 'Persistent preparation',
  });
  expect(section).toHaveTextContent('First buyoff available now');
  expect(section).toHaveTextContent('40 gp (2 × minimum treasury)');
  expect(section).toHaveTextContent('Next buyoff week 4');
  expect(group('Rivalry · Event 1')).toHaveTextContent('2nd that week');
  expect(group('Rivalry · Event 1')).toHaveTextContent('Scouts & Rangers');
});

test('[PER-01.pending] a pending cost is shown honestly with the earlier phases that hold it', () => {
  show([rivalry], {
    buyoffCostCopper: null,
    earlierPhases: ['upkeep', 'event'],
  });
  const section = screen.getByRole('region', {
    name: 'Persistent preparation',
  });
  expect(section).toHaveTextContent('cost waits for earlier phases');
  expect(section).toHaveTextContent(
    'Earlier phases still need preparation: Upkeep, Event.',
  );
  expect(card('Rivalry · Event 1', 'Buy off · cost pending')).toBeVisible();
});

test('[PER-03.cards] Theft and Rivalry get their own check card and Low Morale gets none', () => {
  show([theft, rivalry, morale]);
  expect(
    within(group('Theft · Event 2 decision'))
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? button.textContent),
  ).toHaveLength(4);
  expect(
    card('Theft · Event 2', 'Loyalty check (this week only)'),
  ).toBeVisible();
  expect(card('Rivalry · Event 1', 'Officer check to end it')).toBeVisible();
  expect(
    within(group('Low Morale · Event 3 decision')).getAllByRole('button'),
  ).toHaveLength(3);
  expect(group('Theft · Event 2')).toHaveTextContent('Militia');
  // A missing decision reads as Leave it.
  expect(card('Theft · Event 2', 'Leave it')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('[PER-05.buyoff] Buy off sends the amount-free decision and shows the rules cost without an amount field', () => {
  const { edit } = show([rivalry]);
  fireEvent.click(card('Rivalry · Event 1', 'Buy off · 40 gp'));
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'persistent_decision',
    decision: { kind: 'buyoff', eventId: 'rivalry' },
  });
});

test('[rules.P84.decisions] per-instance choices preserve identity and stage the amount-free buyoff and check decisions', () => {
  // #167 retired the prefilled buyoff amount: Buy off stages the decision
  // alone and Confirmation deducts the rules cost.
  const { edit } = show([theft, rivalry]);
  expect(group('Rivalry · Event 1')).toHaveTextContent('Scouts & Rangers');
  fireEvent.click(card('Rivalry · Event 1', 'Buy off · 40 gp'));
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'persistent_decision',
    decision: { kind: 'buyoff', eventId: 'rivalry' },
  });
  fireEvent.click(card('Rivalry · Event 1', 'Officer check to end it'));
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'persistent_decision',
    decision: { kind: 'mitigate', eventId: 'rivalry' },
  });
  fireEvent.click(card('Theft · Event 2', 'Loyalty check (this week only)'));
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'persistent_decision',
    decision: { kind: 'mitigate', eventId: 'theft' },
  });
  expect(edit).toHaveBeenCalledTimes(3);
});

test('[PER-09.leave] Leave it is the deliberate reset of this event only', () => {
  const { edit } = show([
    { ...theft, decision: { kind: 'buyoff', eventId: 'theft' } },
    { ...rivalry, decision: { kind: 'buyoff', eventId: 'rivalry' } },
  ]);
  fireEvent.click(card('Theft · Event 2', 'Leave it'));
  expect(edit).toHaveBeenCalledTimes(1);
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'persistent_decision',
    decision: { kind: 'unattempted', eventId: 'theft' },
  });
});

test('[PER-06.local] [rules.P84.ending] Ended at the table stays local until a nonempty outcome is saved', async () => {
  const edit = accepted();
  const saved = {
    ...theft,
    decision: { kind: 'buyoff' as const, eventId: 'theft' },
  };
  const { rerender } = show([saved], {}, edit);
  fireEvent.click(card('Theft · Event 2', 'Ended at the table'));
  expect(edit).not.toHaveBeenCalled();
  expect(card('Theft · Event 2', 'Ended at the table')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(
    within(group('Theft · Event 2')).getByRole('status'),
  ).toHaveTextContent(
    'Not saved yet. Buy off still applies until you save how it ended.',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save how it ended' }));
  expect(await screen.findByText('Describe how it ended.')).toBeVisible();
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox', { name: 'How it ended' }), {
    target: { value: '   ' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save how it ended' }));
  await waitFor(() =>
    expect(screen.getByText('Describe how it ended.')).toBeVisible(),
  );
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox', { name: 'How it ended' }), {
    target: { value: 'The thieves fled' },
  });
  // The reason is asked for together with the outcome.
  fireEvent.click(screen.getByRole('button', { name: 'Save how it ended' }));
  expect(await screen.findByText('A reason is required.')).toBeVisible();
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Rules Exception reason' }),
    { target: { value: 'The GM ruled it' } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save how it ended' }));
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(2));
  // The outcome is written first; its reason only after it was accepted.
  expect(edit.mock.calls.map(([call]) => call)).toEqual([
    {
      kind: 'persistent_decision',
      decision: {
        kind: 'end',
        eventId: 'theft',
        acknowledgement: {
          acknowledgementId: expect.any(String),
          subjectId: 'theft',
          outcome: 'The thieves fled',
        },
      },
    },
    {
      kind: 'rules_exception',
      exception: {
        exceptionId: 'persistent:theft:persistent-ending',
        subjectId: 'theft',
        ruleId: 'persistent-ending',
        reason: 'The GM ruled it',
      },
    },
  ]);
  // The accepted ending replaces the local intent and keeps its identity.
  const ending = {
    kind: 'end' as const,
    eventId: 'theft',
    acknowledgement: {
      acknowledgementId: 'ack',
      subjectId: 'theft',
      outcome: 'The thieves fled',
    },
  };
  rerender(
    <PersistentView
      view={{ ...view, events: [{ ...theft, decision: ending }] }}
      edit={edit}
      disabled={false}
    />,
  );
  expect(screen.getByRole('textbox', { name: 'How it ended' })).toHaveValue(
    'The thieves fled',
  );
  expect(within(group('Theft · Event 2')).queryByRole('status')).toBeNull();
  fireEvent.change(screen.getByRole('textbox', { name: 'How it ended' }), {
    target: { value: 'They returned the goods' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save how it ended' }));
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'persistent_decision',
      decision: {
        ...ending,
        acknowledgement: {
          ...ending.acknowledgement,
          outcome: 'They returned the goods',
        },
      },
    }),
  );
});

test('[PER-06.failure] a rejected ending keeps the form, its text and the saved decision', async () => {
  const edit = vi.fn(() => Promise.resolve('failed' as const));
  show(
    [{ ...theft, decision: { kind: 'buyoff', eventId: 'theft' } }],
    {},
    edit,
  );
  fireEvent.click(card('Theft · Event 2', 'Ended at the table'));
  fireEvent.change(screen.getByRole('textbox', { name: 'How it ended' }), {
    target: { value: 'The thieves fled' },
  });
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Rules Exception reason' }),
    { target: { value: 'The GM ruled it' } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save how it ended' }));
  expect(
    await screen.findByText('This ending wasn’t saved. Try again.'),
  ).toBeVisible();
  // Nothing after the rejected outcome is sent.
  expect(edit).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('textbox', { name: 'How it ended' })).toHaveValue(
    'The thieves fled',
  );
  expect(card('Theft · Event 2', 'Ended at the table')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // Leave it abandons the local ending.
  fireEvent.click(card('Theft · Event 2', 'Leave it'));
  expect(screen.queryByRole('textbox', { name: 'How it ended' })).toBeNull();
});

test('[PER-08.exceptions] a Rules Exception reason is recorded, edited and removed with its identity', async () => {
  const exception = {
    exceptionId: 'persistent:theft:persistent-ending',
    subjectId: 'theft',
    ruleId: 'persistent-ending',
    reason: '',
  };
  const { edit, rerender } = show([{ ...theft, exceptions: [exception] }]);
  expect(screen.queryByRole('button', { name: 'Remove exception' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Save reason' }));
  expect(await screen.findByText('A reason is required.')).toBeVisible();
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Rules Exception reason' }),
    { target: { value: 'The GM ruled it' } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save reason' }));
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'rules_exception',
      exception: { ...exception, reason: 'The GM ruled it' },
    }),
  );
  rerender(
    <PersistentView
      view={{
        ...view,
        events: [
          {
            ...theft,
            exceptions: [{ ...exception, reason: 'The GM ruled it' }],
          },
        ],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Remove exception' }));
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'clear_rules_exception',
    exceptionId: exception.exceptionId,
  });
});

test('[PER-02.source] an event ended in Activity offers no decision and links to its source', () => {
  const openSource = vi.fn();
  const link = { phase: 'activity' as const, anchor: 'activity-slot-left' };
  render(
    <PersistentView
      view={{
        ...view,
        events: [
          {
            ...theft,
            decision: { kind: 'buyoff', eventId: 'theft' },
            ended: true,
            endedBy: { label: 'Reduce Danger in Activity slot 2', link },
            result: {
              tone: 'ends',
              text: 'Ends · Reduce Danger in Activity slot 2',
            },
          },
        ],
      }}
      edit={accepted()}
      disabled={false}
      openSource={openSource}
    />,
  );
  const section = group('Theft · Event 2');
  expect(section).toHaveTextContent(
    'Ends this week · staged by Reduce Danger in Activity slot 2.',
  );
  expect(
    screen.queryByRole('group', { name: 'Theft · Event 2 decision' }),
  ).toBeNull();
  fireEvent.click(
    within(section).getByRole('button', { name: 'Change it in Activity' }),
  );
  expect(openSource).toHaveBeenCalledWith(link);
});

test('[WEEK-10.locked] Confirmation disables every Persistent control', () => {
  render(
    <PersistentView
      view={{
        ...view,
        events: [
          theft,
          {
            ...rivalry,
            exceptions: [
              {
                exceptionId: 'x',
                subjectId: 'rivalry',
                ruleId: 'treasury',
                reason: 'Saved',
              },
            ],
          },
        ],
      }}
      edit={accepted()}
      disabled
    />,
  );
  const section = screen.getByRole('region', {
    name: 'Persistent preparation',
  });
  for (const control of [
    ...within(section).getAllByRole('button'),
    ...within(section).getAllByRole('textbox'),
  ])
    expect(control).toBeDisabled();
});

test('[PER-06.partial] an ending saved without its reason says so and leaves the reason to repair', async () => {
  // Like the shared store, an accepted decision is shown at once; the
  // exception write is rejected.
  const edit = vi.fn((next: unknown) => {
    const value = next as WeeklyDraftEdit;
    if (value.kind !== 'persistent_decision')
      return Promise.resolve('failed' as const);
    rerender(
      <PersistentView
        view={{ ...view, events: [{ ...theft, decision: value.decision }] }}
        edit={edit}
        disabled={false}
      />,
    );
    return Promise.resolve('accepted' as const);
  });
  const { rerender } = show([theft], {}, edit);
  fireEvent.click(card('Theft · Event 2', 'Ended at the table'));
  fireEvent.change(screen.getByRole('textbox', { name: 'How it ended' }), {
    target: { value: 'The thieves fled' },
  });
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Rules Exception reason' }),
    { target: { value: 'The GM ruled it' } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save how it ended' }));
  expect(
    await screen.findByText(
      'The ending was saved, but its reason wasn’t. Enter the reason again below.',
    ),
  ).toBeVisible();
});

test('[PER-08.kept] an exception the current decision no longer needs is labelled as such and stays removable', () => {
  const exception = {
    exceptionId: 'persistent:theft:buyoff-cooldown',
    subjectId: 'theft',
    ruleId: 'buyoff-cooldown',
    reason: 'Allowed earlier',
  };
  const { edit } = show([
    {
      ...theft,
      decision: { kind: 'unattempted', eventId: 'theft' },
      exceptions: [exception],
    },
  ]);
  const section = group('Theft · Event 2');
  expect(section).toHaveTextContent(
    'This Rules Exception is still recorded, but the current decision doesn’t need it.',
  );
  expect(section).not.toHaveTextContent('four-week waiting period');
  fireEvent.click(
    within(section).getByRole('button', { name: 'Remove exception' }),
  );
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'clear_rules_exception',
    exceptionId: exception.exceptionId,
  });
});

test('[WEEK-10.link] the source link still navigates while editing is locked', () => {
  const openSource = vi.fn();
  const link = { phase: 'event' as const, anchor: null };
  render(
    <PersistentView
      view={{
        ...view,
        events: [
          {
            ...theft,
            ended: true,
            endedBy: { label: 'High Morale in Event 1', link },
            result: { tone: 'ends', text: 'Ends · High Morale in Event 1' },
          },
        ],
      }}
      edit={accepted()}
      disabled
      openSource={openSource}
    />,
  );
  const button = screen.getByRole('button', { name: 'Change it in Event' });
  expect(button).toBeEnabled();
  fireEvent.click(button);
  expect(openSource).toHaveBeenCalledWith(link);
});

test('choosing the current Leave it card explicitly reviews an event changed by Character departure', async () => {
  const { edit } = show([
    {
      ...theft,
      reviewRequired: true,
      requirements: ['theft:review'],
      decision: { kind: 'unattempted', eventId: 'theft' },
    },
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'Leave it' }));
  await waitFor(() =>
    expect(edit).toHaveBeenCalledWith({
      kind: 'persistent_decision',
      decision: { kind: 'unattempted', eventId: 'theft' },
    }),
  );
});

test('reviewing the current mitigation card preserves its surviving roll and officer selections', async () => {
  const decision: Extract<Event['decision'], { kind: 'mitigate' }> = {
    kind: 'mitigate',
    eventId: 'theft',
    reviewRequired: true,
    officerCheck: { characterId: 'pc', skill: 'bluff' },
    rolls: {
      check: {
        diceTotal: 12,
        diceCount: 1,
        sides: 20,
        provenance: { kind: 'table' },
        modifiers: [],
      },
    },
  };
  const { edit } = show([
    { ...theft, requirements: ['theft:review'], decision },
  ]);
  fireEvent.click(
    screen.getByRole('button', { name: 'Loyalty check (this week only)' }),
  );
  await waitFor(() =>
    expect(edit).toHaveBeenCalledWith({
      kind: 'persistent_decision',
      decision,
    }),
  );
});
