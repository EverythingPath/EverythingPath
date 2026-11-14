import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { stableControl } from '../../../tests/stable-control';
import { expect, test, vi } from 'vitest';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import { EventView as RulesOrderedEventView } from './event-view';
import {
  eventFacts as placeFacts,
  type EventFactsInput,
} from './event-view-test-fixture';
import { PersistentView } from './persistent-view';
import type { PersistentView as PersistentFacts } from './types';
type EventFacts = EventFactsInput;
// Old occurrence-level facts, placed into the rules-ordered sections.
function EventView({
  view,
  ...props
}: Omit<Parameters<typeof RulesOrderedEventView>[0], 'view'> & {
  view: EventFactsInput;
}) {
  return <RulesOrderedEventView view={placeFacts(view)} {...props} />;
}

// react-hook-form runs the submit callback asynchronously; a blocked Save is
// only proven after that callback has had its turn.
async function flushSubmit() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function total(sides: number, diceCount: number, diceTotal: number): RawRoll {
  return {
    sides,
    diceCount,
    diceTotal,
    provenance: { kind: 'table' },
    modifiers: [],
  };
}
function openDetails() {
  screen
    .getByText('Edit Event 1 details')
    .parentElement!.setAttribute('open', '');
}
const textbox = (name: string) => screen.getByRole('textbox', { name });
const eventFacts: EventFacts = {
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
      requirements: [],
      warnings: [],
    },
  ],
  acknowledgements: [],
  exceptions: [],
  checks: [],
  options: {
    modifierSources: [
      { value: 'helpful', label: 'Helpful settlement support' },
    ],
  },
  requirements: [],
  warnings: [],
};
function withOccurrence(
  occurrence: EventFacts['occurrences'][number]['occurrence'],
  resolvedType: string | null,
): EventFacts {
  return {
    ...eventFacts,
    occurrences: [{ ...eventFacts.occurrences[0]!, occurrence, resolvedType }],
  };
}

test('[rules.EVT-01.total] the percentile chance field reads a recorded total, blanks through the nullable edit and writes a new total with preserved metadata', () => {
  const edit = vi.fn();
  const generated = { kind: 'generated' as const, sourceId: 'roller' };
  render(
    <EventView
      view={{
        ...eventFacts,
        chanceRoll: { ...total(100, 1, 0), provenance: generated },
      }}
      edit={edit}
      disabled={false}
    />,
  );
  expect(textbox('Event chance roll')).toHaveValue('0');
  expect(
    screen.getAllByText('1d100 · total of the dice only').length,
  ).toBeGreaterThan(0);
  fireEvent.change(textbox('Event chance roll'), { target: { value: '37' } });
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'event_chance',
    roll: {
      diceTotal: 37,
      diceCount: 1,
      sides: 100,
      provenance: generated,
      modifiers: [],
    },
  });
  fireEvent.change(textbox('Event chance roll'), { target: { value: '' } });
  expect(edit).toHaveBeenLastCalledWith({ kind: 'event_chance', roll: null });
});

test('[rules.EVT-04.table-total] an occurrence table total is editable, keeps its modifiers editable and blanks through the existing occurrence save', async () => {
  const edit = vi.fn();
  render(
    <EventView
      view={withOccurrence(
        {
          eventId: 'root',
          origin: { kind: 'rolled' },
          tableRoll: total(100, 1, 82),
        },
        'invasion',
      )}
      edit={edit}
      disabled={false}
    />,
  );
  expect(textbox('Event 1 table roll')).toHaveValue('82');
  // + Table modifier: a signed value with a required reason and its own source.
  fireEvent.click(screen.getByRole('button', { name: 'Add table modifier' }));
  fireEvent.change(textbox('Table modifier value'), {
    target: { value: '-3' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save table modifier' }));
  expect(await screen.findByText('A reason is required.')).toBeVisible();
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(textbox('Table modifier reason'), {
    target: { value: 'Rain' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save table modifier' }));
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'event_occurrence',
      occurrence: {
        eventId: 'root',
        origin: { kind: 'rolled' },
        tableRoll: {
          ...total(100, 1, 82),
          modifiers: [
            {
              sourceId: expect.stringMatching(/^table-modifier:/),
              value: -3,
              reason: 'Rain',
            },
          ],
        },
      },
    }),
  );
  fireEvent.change(textbox('Event 1 table roll'), { target: { value: '' } });
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'event_occurrence',
    occurrence: { eventId: 'root', origin: { kind: 'rolled' } },
  });
});

test('[rules.EVT-07.nested-total] a Theft occurrence’s nested check is one 1d20 total: recorded total shown, modifiers editable, blank omits the key, and no per-die or sides controls exist', async () => {
  const edit = vi.fn();
  render(
    <EventView
      view={withOccurrence(
        {
          eventId: 'root',
          origin: { kind: 'rolled' },
          averagePartyLevel: 5,
          rolls: { check: total(20, 1, 20) },
        },
        'theft',
      )}
      edit={edit}
      disabled={false}
    />,
  );
  openDetails();
  const check = screen.getByRole('group', { name: 'Check' });
  expect(
    within(check).getByRole('textbox', { name: 'Check roll' }),
  ).toHaveValue('20');
  expect(
    within(check).getByText('1d20 · total of the dice only'),
  ).toBeVisible();
  expect(
    within(check).queryByRole('button', { name: 'Add dice entry' }),
  ).not.toBeInTheDocument();
  expect(
    within(check).queryByRole('textbox', { name: 'Sides' }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    within(check).getByRole('button', { name: 'Add modifiers entry' }),
  );
  fireEvent.click(
    within(check).getByRole('button', { name: 'Helpful settlement support' }),
  );
  fireEvent.change(within(check).getByRole('textbox', { name: 'Value' }), {
    target: { value: '1' },
  });
  fireEvent.change(within(check).getByRole('textbox', { name: 'Reason' }), {
    target: { value: 'Allies' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save occurrence' }));
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'event_occurrence',
      occurrence: {
        eventId: 'root',
        origin: { kind: 'rolled' },
        averagePartyLevel: 5,
        rolls: {
          check: {
            ...total(20, 1, 20),
            modifiers: [{ sourceId: 'helpful', value: 1, reason: 'Allies' }],
          },
        },
      },
    }),
  );
  fireEvent.change(within(check).getByRole('textbox', { name: 'Check roll' }), {
    target: { value: '' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save occurrence' }));
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'event_occurrence',
      occurrence: {
        eventId: 'root',
        origin: { kind: 'rolled' },
        averagePartyLevel: 5,
        rolls: {},
      },
    }),
  );
  // Theft has no rule for a nested loss roll, so no loss control is offered.
  expect(screen.queryByRole('group', { name: 'Loss' })).not.toBeInTheDocument();
});

test('[rules.EVT-07.nested-metadata] a recorded Theft check shows its total and a typed number writes a new total preserving metadata; a Turncoat loss is one 1d6 total', async () => {
  const edit = vi.fn();
  const generated = { kind: 'generated' as const, sourceId: 'roller' };
  const theft = {
    ...eventFacts.occurrences[0]!,
    resolvedType: 'theft',
    occurrence: {
      eventId: 'root',
      origin: { kind: 'rolled' as const },
      rolls: {
        check: { ...total(20, 1, 7), provenance: generated },
      },
    },
  };
  const turncoat = {
    ...eventFacts.occurrences[0]!,
    resolvedType: 'turncoat',
    occurrence: { eventId: 'second', origin: { kind: 'rolled' as const } },
  };
  render(
    <EventView
      view={{ ...eventFacts, occurrences: [theft, turncoat] }}
      edit={edit}
      disabled={false}
    />,
  );
  openDetails();
  screen
    .getByText('Edit Event 2 details')
    .parentElement!.setAttribute('open', '');
  const first = screen.getByRole('group', { name: 'Event 1' });
  const second = screen.getByRole('group', { name: 'Event 2' });
  const check = within(first).getByRole('group', { name: 'Check' });
  expect(
    within(check).getByRole('textbox', { name: 'Check roll' }),
  ).toHaveValue('7');
  // Theft has no nested loss; Turncoat has a 1d6 loss and no nested check.
  expect(within(first).queryByRole('group', { name: 'Loss' })).toBeNull();
  expect(within(second).queryByRole('group', { name: 'Check' })).toBeNull();
  fireEvent.click(within(second).getByRole('button', { name: 'Add rolls' }));
  const loss = within(second).getByRole('group', { name: 'Loss' });
  expect(within(loss).getByText('1d6 · total of the dice only')).toBeVisible();
  fireEvent.change(within(loss).getByRole('textbox', { name: 'Loss roll' }), {
    target: { value: '4' },
  });
  fireEvent.click(
    within(second).getByRole('button', { name: 'Save occurrence' }),
  );
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'event_occurrence',
      occurrence: {
        eventId: 'second',
        origin: { kind: 'rolled' },
        rolls: { loss: total(6, 1, 4) },
      },
    }),
  );
  fireEvent.change(within(check).getByRole('textbox', { name: 'Check roll' }), {
    target: { value: '15' },
  });
  fireEvent.click(
    within(first).getByRole('button', { name: 'Save occurrence' }),
  );
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'event_occurrence',
      occurrence: {
        eventId: 'root',
        origin: { kind: 'rolled' },
        rolls: {
          check: {
            diceTotal: 15,
            diceCount: 1,
            sides: 20,
            provenance: generated,
            modifiers: [],
          },
        },
      },
    }),
  );
});

test('[rules.EVT-11.unresolved] an unresolved occurrence keeps its recorded nested roll read-only with removal only, while its table roll stays editable', async () => {
  const edit = vi.fn();
  render(
    <EventView
      view={withOccurrence(
        {
          eventId: 'root',
          origin: { kind: 'rolled' },
          rolls: { check: total(20, 1, 12) },
        },
        null,
      )}
      edit={edit}
      disabled={false}
    />,
  );
  openDetails();
  const check = screen.getByRole('group', { name: 'Check' });
  expect(
    within(check).queryByRole('textbox', { name: 'Check roll' }),
  ).not.toBeInTheDocument();
  expect(within(check).getByText('12')).toBeVisible();
  expect(
    within(check).getByText(/no rule specification in the current context/),
  ).toBeVisible();
  expect(textbox('Event 1 table roll')).toBeEnabled();
  fireEvent.click(within(check).getByRole('button', { name: 'Remove check' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save occurrence' }));
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'event_occurrence',
      occurrence: { eventId: 'root', origin: { kind: 'rolled' }, rolls: {} },
    }),
  );
});

test('[rules.EVT-11.malformed-nested] malformed nested text blocks the enclosing Save with a styled error instead of saving the prior number', async () => {
  const edit = vi.fn();
  render(
    <EventView
      view={withOccurrence(
        {
          eventId: 'root',
          origin: { kind: 'rolled' },
          rolls: { check: total(20, 1, 12) },
        },
        'theft',
      )}
      edit={edit}
      disabled={false}
    />,
  );
  openDetails();
  const check = screen.getByRole('group', { name: 'Check' });
  const checkField = within(check).getByRole('textbox', { name: 'Check roll' });
  fireEvent.change(checkField, { target: { value: '1e2' } });
  expect(within(check).getByRole('alert')).toHaveTextContent(
    'Use digits only.',
  );
  // Moving focus to Save leaves the field; its own error must survive.
  fireEvent.blur(checkField);
  fireEvent.click(screen.getByRole('button', { name: 'Save occurrence' }));
  expect(checkField).toHaveAttribute('aria-invalid', 'true');
  expect(checkField).toHaveAccessibleDescription(/Use digits only\./);
  await waitFor(() =>
    expect(
      screen
        .getAllByRole('alert')
        .some((alert) => alert.textContent?.includes('Use digits only.')),
    ).toBe(true),
  );
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(within(check).getByRole('textbox', { name: 'Check roll' }), {
    target: { value: '13' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save occurrence' }));
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'event_occurrence',
      occurrence: {
        eventId: 'root',
        origin: { kind: 'rolled' },
        rolls: { check: total(20, 1, 13) },
      },
    }),
  );
});

test('[rules.PER-04.total] a Persistent Rivalry officer check is one 1d20 total that keeps its officer fields and metadata', async () => {
  const edit = vi.fn();
  const generated = { kind: 'generated' as const, sourceId: 'roller' };
  const event: PersistentFacts['events'][number] = {
    eventId: 'rivalry',
    eventType: 'rivalry',
    startedWeek: 1,
    order: 0,
    targets: [],
    name: 'Rivalry · Event 1',
    typeLabel: 'Rivalry',
    ageWeeks: 3,
    orderLabel: '1st that week',
    targetNames: [],
    decision: {
      kind: 'mitigate',
      eventId: 'rivalry',
      officerCheck: {
        characterId: 'pc',
        skill: 'diplomacy',
        skillBonus: 2,
        roll: { ...total(20, 1, 20), provenance: generated },
      },
    },
    ended: false,
    endedBy: null,
    result: { tone: 'stays', text: 'Stays · officer check pending' },
    leaveNote: 'The two rival teams cannot act in the Activity phase.',
    check: { label: 'Officer check to end it', note: 'Officer check.' },
    changes: [],
    checks: [],
    theftCheck: null,
    rivalryCheck: {
      characterId: 'pc',
      characters: [
        {
          value: 'pc',
          label: 'Aubrin · Ambassador',
          officer: true,
          available: true,
        },
      ],
      skill: 'diplomacy',
      skillBonus: 2,
      recorded: { ...total(20, 1, 20), provenance: generated },
      spec: { count: 1, sides: 20 },
      modifier: 2,
      total: 22,
      breakdown: [],
      succeeded: true,
      resultText: 'Ends the Rivalry for good.',
      required: { character: false, skillBonus: false, roll: false },
      unavailable: false,
      notOfficer: false,
      modifiers: [],
    },
    retained: [],
    exceptions: [],
    requirements: [],
    warnings: [],
  };
  render(
    <PersistentView
      view={{
        phase: 'persistent',
        ready: true,
        firstBuyoff: true,
        buyoffAvailability: 'First buyoff available now',
        nextBuyoffWeek: 4,
        buyoffCostCopper: 4000,
        earlierPhases: [],
        options: { characterId: [{ value: 'pc', label: 'Aubrin' }] },
        events: [event],
        requirements: [],
        warnings: [],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  expect(textbox('Officer check roll')).toHaveValue('20');
  expect(textbox('Skill bonus')).toHaveValue('2');
  // A new total replaces only the dice, keeping the roll's provenance and
  // every officer field.
  fireEvent.change(textbox('Officer check roll'), { target: { value: '19' } });
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'persistent_decision',
      decision: {
        kind: 'mitigate',
        eventId: 'rivalry',
        officerCheck: {
          characterId: 'pc',
          skill: 'diplomacy',
          skillBonus: 2,
          roll: {
            diceTotal: 19,
            diceCount: 1,
            sides: 20,
            provenance: generated,
            modifiers: [],
          },
        },
      },
    }),
  );
});

const raidWithTargets: EventFacts = withOccurrence(
  {
    eventId: 'root',
    origin: { kind: 'rolled' },
    targets: [
      { kind: 'character', characterId: 'nora' },
      { kind: 'character', characterId: 'pell' },
    ],
    targetChecks: [
      { target: { kind: 'character', characterId: 'nora' } },
      { target: { kind: 'character', characterId: 'pell' } },
    ],
  },
  'raid',
);
raidWithTargets.options = {
  ...eventFacts.options,
  characterId: [
    { value: 'nora', label: 'Nora' },
    { value: 'pell', label: 'Pell' },
  ],
};
// Entries are re-read on every use (removal shifts them); the enclosing
// group is looked up once (see stableControl).
function targetEntries() {
  const checks = stableControl('group', 'Target Checks');
  return (index: number) =>
    within(checks()).getAllByRole('group', { name: /^Entry \d$/ })[index]!;
}

test('[rules.EVT-11.invalid-removed] malformed text in a removed target no longer blocks saving the structurally valid rest', async () => {
  const edit = vi.fn();
  render(<EventView view={raidWithTargets} edit={edit} disabled={false} />);
  openDetails();
  const targetEntry = targetEntries();
  const save = stableControl('button', 'Save occurrence');
  fireEvent.click(
    within(targetEntry(0)).getByRole('button', { name: 'Add rolls' }),
  );
  fireEvent.change(
    within(targetEntry(0)).getByRole('textbox', { name: 'Check roll' }),
    {
      target: { value: 'x1' },
    },
  );
  fireEvent.click(save());
  await flushSubmit();
  expect(edit).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Remove target checks 1' }),
  );
  fireEvent.click(save());
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'event_occurrence',
      occurrence: expect.objectContaining({
        targetChecks: [{ target: { kind: 'character', characterId: 'pell' } }],
      }),
    }),
  );
});

test('[rules.EVT-11.invalid-shift] removing an earlier entry keeps a later entry’s malformed text blocking the save until it is fixed', async () => {
  const edit = vi.fn();
  render(<EventView view={raidWithTargets} edit={edit} disabled={false} />);
  openDetails();
  const targetEntry = targetEntries();
  const save = stableControl('button', 'Save occurrence');
  fireEvent.click(
    within(targetEntry(1)).getByRole('button', { name: 'Add rolls' }),
  );
  const pellCheck = stableControl(
    'textbox',
    'Check roll',
    within(targetEntry(1)),
  );
  fireEvent.change(pellCheck(), { target: { value: '9' } });
  fireEvent.change(pellCheck(), { target: { value: '9e' } });
  fireEvent.click(
    screen.getByRole('button', { name: 'Remove target checks 1' }),
  );
  // Pell's entry is now first; its own malformed text still blocks the save.
  const pell = targetEntry(0);
  const survivor = stableControl('textbox', 'Check roll', within(pell));
  expect(survivor()).toHaveValue('9');
  expect(
    within(pell)
      .getAllByRole('alert')
      .map((alert) => alert.textContent),
  ).toContain('Use digits only.');
  fireEvent.click(save());
  await flushSubmit();
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(survivor(), { target: { value: '11' } });
  fireEvent.click(save());
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'event_occurrence',
      occurrence: expect.objectContaining({
        targetChecks: [
          {
            target: { kind: 'character', characterId: 'pell' },
            rolls: { check: total(20, 1, 11) },
          },
        ],
      }),
    }),
  );
});

test('[rules.EVT-11.invalid-clear] clearing the enclosing details after malformed text lets the next save go through once the cleared occurrence arrives', async () => {
  const edit = vi.fn().mockReturnValue(true);
  const { rerender } = render(
    <EventView
      view={withOccurrence(
        {
          eventId: 'root',
          origin: { kind: 'rolled' },
          rolls: { check: total(20, 1, 12) },
        },
        'theft',
      )}
      edit={edit}
      disabled={false}
    />,
  );
  openDetails();
  fireEvent.change(screen.getByRole('textbox', { name: 'Check roll' }), {
    target: { value: '1.5' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save occurrence' }));
  await flushSubmit();
  expect(edit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Clear occurrence' }));
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'event_occurrence',
    occurrence: { eventId: 'root', origin: { kind: 'rolled' } },
  });
  edit.mockClear();
  // The cleared occurrence comes back from the shared draft.
  rerender(
    <EventView
      view={withOccurrence(
        { eventId: 'root', origin: { kind: 'rolled' } },
        'theft',
      )}
      edit={edit}
      disabled={false}
    />,
  );
  openDetails();
  fireEvent.click(screen.getByRole('button', { name: 'Add rolls' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Check roll' }), {
    target: { value: '8' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save occurrence' }));
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'event_occurrence',
      occurrence: {
        eventId: 'root',
        origin: { kind: 'rolled' },
        rolls: { check: total(20, 1, 8) },
      },
    }),
  );
});

test('[rules.EVT-11.invalid-explicit-clear] a wrong-specification roll’s explicit Clear releases its malformed-text block', async () => {
  const edit = vi.fn();
  render(
    <EventView
      view={withOccurrence(
        {
          eventId: 'root',
          origin: { kind: 'rolled' },
          rolls: { check: total(6, 1, 3) },
        },
        'theft',
      )}
      edit={edit}
      disabled={false}
    />,
  );
  openDetails();
  fireEvent.change(screen.getByRole('textbox', { name: 'Check roll' }), {
    target: { value: 'ab' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save occurrence' }));
  await flushSubmit();
  expect(edit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Clear check roll' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save occurrence' }));
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'event_occurrence',
      occurrence: { eventId: 'root', origin: { kind: 'rolled' }, rolls: {} },
    }),
  );
});
