import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useState } from 'react';
import { expect, test, vi } from 'vitest';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { editWeeklyDraft } from '~/lib/weekly-draft';
import type { WeeklyDraft, WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import { eventActionFixture } from '../../../tests/rules/event-action-fixture';
import { stableControl } from '../../../tests/stable-control';
import { eventView } from './event-facts';
import { EventView } from './event-view';

// Activity event candidates are built, rolled and edited in Event: each
// candidate block keeps its occurrence details editor, and every edit goes
// through the same draft edits the Workspace sends. The harness applies each
// accepted edit to the draft and re-derives the facts, as the store does.

type Event = WeeklyDraft['event']['occurrences'][number];
type Edit = ReturnType<typeof vi.fn<(edit: WeeklyDraftEdit) => void>>;

function total(sides: number, diceCount: number, diceTotal: number): RawRoll {
  return {
    sides,
    diceCount,
    diceTotal,
    provenance: { kind: 'table' },
    modifiers: [],
  };
}
const rolled = (eventId: string, value?: number, extra: Partial<Event> = {}) =>
  ({
    eventId,
    origin: { kind: 'rolled' },
    ...(value === undefined ? {} : { tableRoll: total(100, 1, value) }),
    ...extra,
  }) as Event;

// A Guarantee Event choice in Action Slot 1 with these candidates.
function candidateWeek(candidates: Event[], selectedEventId?: string) {
  const { draft, snapshot, choice } = eventActionFixture();
  if (choice.actionId !== 'guarantee_event') throw new Error('fixture');
  choice.candidates = candidates;
  if (selectedEventId) choice.selectedEventId = selectedEventId;
  else delete choice.selectedEventId;
  return { draft, snapshot };
}
function facts(draft: WeeklyDraft, snapshot: UpkeepSnapshot) {
  const source = workspaceSourceSchema.parse({
    key: { campaignId: 'c', militiaId: 'm', draftId: draft.draftId },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [],
  });
  return eventView(
    draft,
    source,
    projectWeeklyDraft({ revision: draft, militiaSnapshot: snapshot }),
  );
}
function Harness({
  initial,
  snapshot,
  edit,
}: {
  initial: WeeklyDraft;
  snapshot: UpkeepSnapshot;
  edit: Edit;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <EventView
      view={facts(draft, snapshot)}
      edit={(next) => {
        edit(next);
        const result = editWeeklyDraft(draft, next);
        if (result.ok) setDraft(result.draft);
      }}
      disabled={false}
    />
  );
}
function show(week: { draft: WeeklyDraft; snapshot: UpkeepSnapshot }) {
  const edit: Edit = vi.fn();
  render(<Harness initial={week.draft} snapshot={week.snapshot} edit={edit} />);
  return edit;
}
// react-hook-form runs the submit callback asynchronously; a blocked Save is
// only proven after that callback has had its turn.
async function flushSubmit() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
const block = (label: string) => screen.getByRole('group', { name: label });
// The candidate's occurrence details editor, opened.
function details(label: string) {
  const summary = within(block(label)).getByText(`Edit ${label} details`);
  const disclosure = summary.closest('details')!;
  disclosure.setAttribute('open', '');
  return disclosure;
}
const tableRoll = (label: string) =>
  screen.getByRole('textbox', { name: `${label} table roll` });
function savedOccurrence(edit: Edit) {
  const call = edit.mock.lastCall![0];
  if (call.kind !== 'event_occurrence')
    throw new Error(`Expected an occurrence edit, got ${call.kind}`);
  return call.occurrence;
}

test('[rules.EVT-07.candidate-context] a saved candidate with a known table roll keeps its nested total editors in Event, while an unresolved one offers only its table roll', () => {
  show(candidateWeek([rolled('theft', 76), rolled('pending')]));
  const theft = details('Event 1A');
  fireEvent.click(within(theft).getByRole('button', { name: 'Add rolls' }));
  expect(
    within(theft).getByRole('textbox', { name: 'Check roll' }),
  ).toBeVisible();
  expect(
    within(theft).getByText('1d20 · total of the dice only'),
  ).toBeVisible();
  expect(tableRoll('Event 1B')).toHaveValue('');
  const pending = details('Event 1B');
  fireEvent.click(within(pending).getByRole('button', { name: 'Add rolls' }));
  expect(
    within(pending).queryByRole('textbox', { name: 'Check roll' }),
  ).not.toBeInTheDocument();
});

test('[rules.EVT-07.candidate-live-context] a table roll change re-resolves the candidate’s nested specifications at once, and an explicit eventType never overrides the table', () => {
  // Declared Turncoat, but the table roll says Theft: the table wins.
  const edit = show(
    candidateWeek([
      rolled('declared', 76, { eventType: 'turncoat' }),
      rolled('other', 78),
    ]),
  );
  let entry = details('Event 1A');
  fireEvent.click(within(entry).getByRole('button', { name: 'Add rolls' }));
  expect(
    within(entry).getByRole('textbox', { name: 'Check roll' }),
  ).toBeVisible();
  expect(
    within(entry).queryByRole('group', { name: 'Loss' }),
  ).not.toBeInTheDocument();
  // A Turncoat table roll (60) switches the supported nested fields: no
  // check, a 1d6 loss.
  fireEvent.change(tableRoll('Event 1A'), { target: { value: '60' } });
  expect(savedOccurrence(edit)).toMatchObject({
    eventId: 'declared',
    eventType: 'turncoat',
    tableRoll: total(100, 1, 60),
  });
  entry = details('Event 1A');
  expect(
    within(entry).queryByRole('textbox', { name: 'Check roll' }),
  ).not.toBeInTheDocument();
  expect(within(entry).getByText('1d6 · total of the dice only')).toBeVisible();
  // A cleared table roll leaves the candidate unresolved again.
  fireEvent.change(tableRoll('Event 1A'), { target: { value: '' } });
  entry = details('Event 1A');
  expect(
    within(entry).queryByText('1d6 · total of the dice only'),
  ).not.toBeInTheDocument();
});

test('[rules.EVT-07.candidate-removal] removing an earlier candidate entry keeps the survivor’s own table-roll context, not the removed entry’s', () => {
  // A surplus candidate sits between the two; clearing its roll removes it
  // and shifts Theft forward.
  const week = candidateWeek([
    rolled('raid', 78),
    rolled('extra', 60),
    rolled('theft', 76, { rolls: { check: total(20, 1, 9) } }),
  ]);
  const edit = show(week);
  fireEvent.change(tableRoll('Event 1B'), { target: { value: '' } });
  const removal = edit.mock.lastCall![0];
  if (
    removal.kind !== 'detail' ||
    removal.choice.actionId !== 'guarantee_event'
  )
    throw new Error('Expected the candidate removal');
  expect(removal.choice.candidates!.map((event) => event.eventId)).toEqual([
    'raid',
    'theft',
  ]);
  expect(screen.queryByRole('group', { name: 'Event 1C' })).toBeNull();
  const survivor = details('Event 1B');
  expect(tableRoll('Event 1B')).toHaveValue('76');
  expect(
    within(survivor).getByRole('textbox', { name: 'Check roll' }),
  ).toHaveValue('9');
  expect(
    within(survivor).queryByRole('group', { name: 'Loss' }),
  ).not.toBeInTheDocument();
});

test('[rules.EVT-11.invalid-spec-lost] malformed text in a candidate check no longer blocks its Save once the table roll changes to an event without that check, while another candidate’s malformed check keeps blocking', async () => {
  const edit = show(candidateWeek([rolled('first', 76), rolled('second', 76)]));
  const first = details('Event 1A');
  const second = details('Event 1B');
  fireEvent.click(within(first).getByRole('button', { name: 'Add rolls' }));
  fireEvent.change(within(first).getByRole('textbox', { name: 'Check roll' }), {
    target: { value: 'x' },
  });
  fireEvent.click(within(second).getByRole('button', { name: 'Add rolls' }));
  fireEvent.change(
    within(second).getByRole('textbox', { name: 'Check roll' }),
    { target: { value: '7z' } },
  );
  const saveFirst = stableControl('button', 'Save occurrence', within(first));
  const saveSecond = stableControl('button', 'Save occurrence', within(second));
  fireEvent.click(saveFirst());
  fireEvent.click(saveSecond());
  await flushSubmit();
  expect(edit).not.toHaveBeenCalled();
  // The first candidate becomes Turncoat: its check control disappears and
  // so does its malformed-text block. The second candidate still blocks.
  fireEvent.change(tableRoll('Event 1A'), { target: { value: '60' } });
  expect(edit).toHaveBeenCalledTimes(1);
  expect(
    within(details('Event 1A')).queryByRole('textbox', { name: 'Check roll' }),
  ).not.toBeInTheDocument();
  fireEvent.click(saveSecond());
  await flushSubmit();
  expect(edit).toHaveBeenCalledTimes(1);
  fireEvent.click(saveFirst());
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(2));
  expect(savedOccurrence(edit)).toEqual({
    eventId: 'first',
    origin: { kind: 'rolled' },
    tableRoll: total(100, 1, 60),
    rolls: {},
  });
  fireEvent.change(
    within(details('Event 1B')).getByRole('textbox', { name: 'Check roll' }),
    { target: { value: '7' } },
  );
  fireEvent.click(saveSecond());
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(3));
  expect(savedOccurrence(edit).rolls).toEqual({ check: total(20, 1, 7) });
});

test('[rules.EVT-11.invalid-spec-cleared] clearing the table roll of a candidate with a malformed check leaves the check unresolved and releases its block', async () => {
  const edit = show(candidateWeek([rolled('only', 76), rolled('other', 78)]));
  const entry = details('Event 1A');
  fireEvent.click(within(entry).getByRole('button', { name: 'Add rolls' }));
  fireEvent.change(within(entry).getByRole('textbox', { name: 'Check roll' }), {
    target: { value: '-' },
  });
  const save = stableControl('button', 'Save occurrence', within(entry));
  fireEvent.click(save());
  await flushSubmit();
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(tableRoll('Event 1A'), { target: { value: '' } });
  expect(savedOccurrence(edit)).toEqual({
    eventId: 'only',
    origin: { kind: 'rolled' },
  });
  // Structural Save succeeds; the missing table roll is a readiness matter
  // for the rules, not a structural blocker.
  fireEvent.click(save());
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(2));
  expect(savedOccurrence(edit)).toEqual({
    eventId: 'only',
    origin: { kind: 'rolled' },
    rolls: {},
  });
});

test('[rules.P82.validation] a chosen candidate is never removed as surplus: clearing its roll keeps it and its selection, and the set explains the extra entry', () => {
  const week = candidateWeek(
    [rolled('a', 78), rolled('b', 76), rolled('c', 70)],
    'c',
  );
  const edit = show(week);
  expect(
    screen.getByText(
      /more than two candidates are recorded\. Clear the extra one to remove it\./,
    ),
  ).toBeVisible();
  fireEvent.change(tableRoll('Event 1C'), { target: { value: '' } });
  // Only the roll is cleared; the candidate list and selection stay whole.
  expect(savedOccurrence(edit)).toEqual({
    eventId: 'c',
    origin: { kind: 'rolled' },
  });
  expect(edit).toHaveBeenCalledTimes(1);
  expect(
    within(block('Event 1C')).getByRole('button', { name: 'This one happens' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('[rules.P82.provenance] a candidate’s recorded roll provenance stays intact without offering incomplete source selection', async () => {
  const generated: RawRoll = {
    diceTotal: 76,
    diceCount: 1,
    sides: 100,
    provenance: { kind: 'generated', sourceId: 'recorded-die' },
    modifiers: [],
  };
  const edit = show(
    candidateWeek([
      rolled('candidate', undefined, { tableRoll: generated }),
      rolled('b', 78),
    ]),
  );
  const entry = details('Event 1A');
  expect(tableRoll('Event 1A')).toHaveValue('76');
  expect(
    screen.queryByRole('button', { name: 'Generated' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue('recorded-die')).not.toBeInTheDocument();
  fireEvent.click(
    within(entry).getByRole('button', { name: 'Save occurrence' }),
  );
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
  expect(savedOccurrence(edit).tableRoll).toEqual(generated);
});

test('[rules.P82.sources] automatic events beside a candidate set name their queued source, never its identity', () => {
  const week = candidateWeek([rolled('raid', 78), rolled('theft', 76)], 'raid');
  week.draft.context = {
    ...week.draft.context,
    queuedEffects: [
      {
        effectId: 'queue-effect',
        sourceId: 'queue-source',
        eventType: 'calm_before_the_storm',
        startsWeek: week.draft.week,
        endsWeek: week.draft.week,
        effect: { kind: 'automatic_events', count: 1 },
      },
    ],
  };
  week.draft.event.occurrences = [
    rolled('auto', 80, {
      origin: { kind: 'automatic', sourceId: 'queue-source' },
    }),
  ];
  show(week);
  const automatic = screen.getByText(/brings 1 automatic event before/);
  expect(automatic).toHaveTextContent(/^Calm before the Storm \(week \d+\)/);
  expect(screen.queryByText(/queue-source/)).toBeNull();
});
