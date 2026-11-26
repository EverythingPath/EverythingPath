import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { EventView as RulesOrderedEventView } from './event-view';
import { eventFacts, type EventFactsInput } from './event-view-test-fixture';
// Old occurrence-level facts, placed into the rules-ordered sections.
function EventView({
  view,
  ...props
}: Omit<Parameters<typeof RulesOrderedEventView>[0], 'view'> & {
  view: EventFactsInput;
}) {
  return <RulesOrderedEventView view={eventFacts(view)} {...props} />;
}
const view: EventFactsInput = {
  phase: 'event',
  ready: false,
  chance: 10,
  chanceRoll: null,
  chanceModifier: 0,
  guaranteed: false,
  occurrences: [
    {
      occurrence: { eventId: 'root', origin: { kind: 'rolled' } },
      resolvedType: null,
      optionalMitigation: 'unavailable',
      changes: [],
      exceptionChoices: [],
      mode: null,
      selected: false,
      negated: false,
      owner: null,
      requirements: ['root:table:1d100'],
      warnings: [],
    },
  ],
  acknowledgements: [],
  exceptions: [],
  checks: [],
  options: {},
  requirements: ['event:chance:1d100', 'root:table:1d100'],
  warnings: [],
};
test('[rules.P83.input] percentile input rejects malformed text and distinguishes zero and clear', () => {
  const edit = vi.fn();
  render(<EventView view={view} edit={edit} disabled={false} />);
  const input = screen.getByRole('textbox', { name: 'Event chance roll' });
  fireEvent.change(input, { target: { value: '1e2' } });
  expect(input).toHaveValue('');
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: '0' } });
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'event_chance',
    roll: {
      diceTotal: 0,
      diceCount: 1,
      sides: 100,
      provenance: { kind: 'table' },
      modifiers: [],
    },
  });
  fireEvent.change(input, { target: { value: '' } });
  expect(edit).toHaveBeenLastCalledWith({ kind: 'event_chance', roll: null });
});
test('[rules.P83.acknowledgement] event notes use the occurrence subject and an explicit clear', async () => {
  const edit = vi.fn();
  render(
    <EventView
      view={{
        ...view,
        occurrences: [
          {
            ...view.occurrences[0]!,
            resolvedType: 'invasion',
            requirements: ['root:acknowledgement'],
          },
        ],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Event outcome acknowledgement' }),
    { target: { value: 'The table repelled the invaders.' } },
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Save event outcome acknowledgement' }),
  );
  await waitFor(() =>
    expect(edit).toHaveBeenCalledWith({
      kind: 'acknowledge',
      acknowledgement: {
        acknowledgementId: 'event:root',
        subjectId: 'event:root',
        outcome: 'The table repelled the invaders.',
      },
    }),
  );
});

test('[rules.P83.details] target checks enter the percentile capture total and preserve explicit omission when clearing', async () => {
  const edit = vi.fn();
  const occurrence = {
    ...view.occurrences[0]!,
    resolvedType: 'raid',
    occurrence: {
      ...view.occurrences[0]!.occurrence,
      targets: [{ kind: 'character' as const, characterId: 'person' }],
      averagePartyLevel: 5,
    },
  };
  render(
    <EventView
      view={{
        ...view,
        occurrences: [occurrence],
        options: { characterId: [{ value: 'person', label: 'Nora' }] },
      }}
      edit={edit}
      disabled={false}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add target checks' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Add target checks entry' }),
  );
  fireEvent.click(screen.getAllByRole('button', { name: 'Character' }).at(-1)!);
  const nora = screen.getAllByRole('button', { name: 'Nora' });
  fireEvent.click(nora[nora.length - 1]!);
  // The target check's rolls are separate from the event-level optional rolls.
  const addRolls = screen.getAllByRole('button', {
    name: 'Add rolls',
  });
  fireEvent.click(addRolls[addRolls.length - 1]!);
  // Raid capture is a 1d100 per-target loss: one total, no dice list.
  fireEvent.change(screen.getByRole('textbox', { name: 'Loss roll' }), {
    target: { value: '0' },
  });
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Average Party Level' }),
    { target: { value: '' } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save occurrence' }));
  await waitFor(() =>
    expect(edit).toHaveBeenCalledWith({
      kind: 'event_occurrence',
      occurrence: expect.objectContaining({
        targetChecks: [
          {
            target: { kind: 'character', characterId: 'person' },
            rolls: {
              loss: {
                diceTotal: 0,
                diceCount: 1,
                sides: 100,
                provenance: { kind: 'table' },
                modifiers: [],
              },
            },
          },
        ],
      }),
    }),
  );
  expect(edit.mock.lastCall?.[0].occurrence).not.toHaveProperty(
    'averagePartyLevel',
  );
});

test('[rules.P83.ownership] a reaction added in the details stays on its occurrence beside the same-week decision recorded there', async () => {
  const edit = vi.fn();
  const decision = {
    kind: 'end' as const,
    eventId: 'root',
    acknowledgement: {
      acknowledgementId: 'root-ending',
      subjectId: 'root',
      outcome: 'The event ended at the table.',
    },
  };
  render(
    <EventView
      view={{
        ...view,
        occurrences: [
          {
            ...view.occurrences[0]!,
            occurrence: {
              ...view.occurrences[0]!.occurrence,
              persistent: true,
              persistentDecision: decision,
            },
          },
        ],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add sabotage' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save occurrence' }));
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
  const event = edit.mock.lastCall?.[0].occurrence;
  expect(event).toMatchObject({
    eventId: 'root',
    persistent: true,
    persistentDecision: decision,
  });
  expect(event.sabotage.choiceId).toEqual(expect.any(String));
});

test('[rules.P83.candidates] Event edits preserve complete Activity candidate ownership and selection', () => {
  const edit = vi.fn();
  const candidate = view.occurrences[0]!.occurrence;
  const owner = {
    slotId: 'slot',
    choice: {
      choiceId: 'choice',
      actionId: 'guarantee_event' as const,
      teamId: 'team',
      candidates: [candidate],
    },
  };
  render(
    <EventView
      view={{ ...view, occurrences: [{ ...view.occurrences[0]!, owner }] }}
      edit={edit}
      disabled={false}
    />,
  );
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Event 1 table roll' }),
    { target: { value: '50' } },
  );
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'event_occurrence',
    occurrence: {
      ...candidate,
      tableRoll: {
        diceTotal: 50,
        diceCount: 1,
        sides: 100,
        provenance: { kind: 'table' },
        modifiers: [],
      },
    },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Choose this event' }));
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'detail',
    slotId: 'slot',
    choiceId: 'choice',
    choice: { ...owner.choice, selectedEventId: 'root' },
  });
});

test('[rules.P83.modifiers] Event checks explain each contribution without exposing source identities', () => {
  render(
    <EventView
      view={{
        ...view,
        occurrences: [
          {
            ...view.occurrences[0]!,
            occurrence: {
              ...view.occurrences[0]!.occurrence,
              rolls: {
                check: {
                  diceTotal: 10,
                  diceCount: 1,
                  sides: 20,
                  provenance: { kind: 'table' },
                  modifiers: [
                    {
                      sourceId: 'weather-source',
                      value: -2,
                      reason: 'Heavy rain',
                    },
                  ],
                },
              },
            },
          },
        ],
        checks: [
          {
            checkId: 'root:theft',
            modifier: 1,
            total: 11,
            modifiers: [
              { source: 'rank-focus', value: 3 },
              { source: 'weather-source', value: -2 },
            ],
          },
        ],
      }}
      edit={vi.fn()}
      disabled={false}
    />,
  );
  expect(screen.getByText('Rank and focus: +3')).toBeVisible();
  expect(screen.getByText('Heavy rain: -2')).toBeVisible();
  expect(screen.queryByText('weather-source')).not.toBeInTheDocument();
});
