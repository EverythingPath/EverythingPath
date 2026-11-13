import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import { EventView } from './event-view';
import { eventFacts, type EventFactsInput } from './event-view-test-fixture';

type Occurrence = EventFactsInput['occurrences'][number]['occurrence'];

const check: RawRoll = {
  sides: 20,
  diceCount: 1,
  diceTotal: 12,
  provenance: { kind: 'table' },
  modifiers: [],
};

function show(occurrence: Occurrence, resolvedType: string | null) {
  const edit = vi.fn();
  const input: EventFactsInput = {
    phase: 'event',
    ready: false,
    chance: 10,
    chanceRoll: null,
    chanceModifier: 0,
    guaranteed: false,
    occurrences: [
      {
        occurrence,
        resolvedType,
        optionalMitigation: 'unavailable',
        changes: [],
        exceptionChoices: [],
        mode: null,
        selected: false,
        negated: false,
        owner: null,
        requirements: [],
        warnings: [],
      },
    ],
    acknowledgements: [],
    exceptions: [],
    checks: [],
    options: {},
    requirements: [],
    warnings: [],
  };
  render(<EventView view={eventFacts(input)} edit={edit} disabled={false} />);
  const summary = screen.getByText('Edit Event 1 details');
  summary.parentElement!.setAttribute('open', '');
  return { edit, details: within(summary.parentElement!) };
}

// Everything the details editor shows: its field names and Add buttons.
function offered(details: ReturnType<typeof show>['details']) {
  return details.getByRole('group', { name: 'Occurrence' }).textContent ?? '';
}

// Written by no current Event control: the same-week Persistent decision
// and its flag.
const sameWeek = {
  persistent: true,
  persistentDecision: {
    kind: 'mitigate',
    eventId: 'root',
    rolls: { check },
  },
} satisfies Partial<Occurrence>;

test('[EVT-11.details-allowlist] the details editor offers only fields current Event controls write and keeps the rest as recorded', async () => {
  const occurrence: Occurrence = {
    eventId: 'root',
    origin: { kind: 'rolled' },
    tableRoll: { ...check, sides: 100, diceTotal: 75 },
    rolls: { check },
    ...sameWeek,
  };
  const { edit, details } = show(occurrence, 'theft');
  expect(offered(details)).not.toMatch(/persistent|strategist/i);
  // The current fields stay offered.
  for (const name of ['Mitigation', 'Rolls'])
    expect(details.getByRole('group', { name })).toBeVisible();
  for (const label of [
    'Add officer check',
    'Add targets',
    'Add target checks',
    'Add rewards',
    'Add sabotage',
  ])
    expect(details.getByRole('button', { name: label })).toBeVisible();
  fireEvent.click(details.getByRole('button', { name: 'Add sabotage' }));
  fireEvent.click(details.getByRole('button', { name: 'Save occurrence' }));
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
  // Saving replaces only what the editor offers.
  const saved = edit.mock.lastCall?.[0].occurrence;
  expect(saved).toMatchObject({ ...occurrence, sabotage: {} });
  // Clearing clears only what the editor offers.
  fireEvent.click(details.getByRole('button', { name: 'Clear occurrence' }));
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'event_occurrence',
    occurrence: {
      eventId: 'root',
      origin: { kind: 'rolled' },
      tableRoll: occurrence.tableRoll,
      ...sameWeek,
    },
  });
});

test('[EVT-11.details-nested] a target check and a Sabotage reaction offer no Overseer support or notes of their own', () => {
  const { details } = show(
    { eventId: 'root', origin: { kind: 'rolled' } },
    'theft',
  );
  // Support is the occurrence's own; notes are the draft's acknowledgements.
  fireEvent.click(details.getByRole('button', { name: 'Add target checks' }));
  fireEvent.click(
    details.getByRole('button', { name: 'Add target checks entry' }),
  );
  fireEvent.click(details.getByRole('button', { name: 'Add sabotage' }));
  for (const name of ['Target Checks', 'Sabotage'])
    expect(details.getByRole('group', { name }).textContent).not.toMatch(
      /overseer|acknowledgement/i,
    );
});

test.each(['raid', 'cache_discovered'])(
  '[EVT-11.details-per-target] %s offers no event-level mitigation or check: each person or cache records its own',
  async (eventType) => {
    const occurrence: Occurrence = {
      eventId: 'root',
      origin: { kind: 'rolled' },
      mitigation: 'attempted',
      rolls: { check },
    };
    const { edit, details } = show(occurrence, eventType);
    expect(offered(details)).not.toMatch(/mitigation|rolls|check roll/i);
    expect(
      details.getByRole('button', { name: 'Add target checks' }),
    ).toBeVisible();
    fireEvent.click(details.getByRole('button', { name: 'Save occurrence' }));
    await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'event_occurrence',
      occurrence,
    });
  },
);
