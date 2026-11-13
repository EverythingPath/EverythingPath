import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { StagedActionChoice } from '~/lib/weekly-draft-facts';
import { ActivityView } from './activity-view';
import {
  acceptingEdit,
  activityFacts,
  activitySlot,
  selectSlot,
} from './activity-view-fixture';
import type { ActivityView as Facts } from './types';

vi.mock('~/components/ui/select', () => import('./native-select-test-double'));

type Slot = Facts['slots'][number];
const settlements = [
  { value: 'town', label: 'Town' },
  { value: 'fort', label: 'Fort' },
];
function facts(
  choices: StagedActionChoice[],
  slot: Partial<Slot> = {},
  overrides: Partial<Facts> = {},
): Facts {
  return activityFacts(
    choices.map((choice, index) =>
      activitySlot(choice, {
        slotId: `slot-${index + 1}`,
        number: index + 1,
        position: {
          officers: [],
          refugeSettlementIds: ['town'],
          settlements: [
            {
              settlementId: 'town',
              reputation: 'Hostile',
              refugeAllowed: true,
              occupied: true,
              secured: true,
            },
            {
              settlementId: 'fort',
              reputation: 'Friendly',
              refugeAllowed: false,
              occupied: false,
              secured: false,
            },
          ],
          propaganda: [],
          characterStatus: [],
          economy: null,
        },
        ...slot,
      }),
    ),
    { settlements, ...overrides },
  );
}
function open(view: Facts, extra: { disabled?: boolean } = {}) {
  const edit = acceptingEdit();
  const openEvent = vi.fn();
  const utils = render(
    <ActivityView
      view={view}
      edit={edit}
      disabled={extra.disabled ?? false}
      correctionsHref="/campaigns/c/militia"
      openEvent={openEvent}
    />,
  );
  selectSlot(view.slots[0]!.actionName!);
  return { edit, openEvent, ...utils };
}
function lastChoice(edit: ReturnType<typeof acceptingEdit>) {
  const call = edit.mock.lastCall![0];
  if (call.kind !== 'detail') throw new Error('Expected a detail edit');
  return call.choice;
}
const card = (group: string, name: string | RegExp) =>
  within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', {
    name,
  });
const button = (name: string) => screen.getByRole('button', { name });
const textbox = (name: string) => screen.getByRole('textbox', { name });

describe('information and Special', () => {
  test('[rules.ACT-10.mission-subject] Gather Information saves its subject, trims it, and a blank save clears it', async () => {
    const choice: StagedActionChoice = {
      choiceId: 'gather',
      actionId: 'gather_information',
      subject: 'Patrol routes',
    };
    const { edit } = open(facts([choice]));
    expect(textbox('Subject')).toHaveValue('Patrol routes');
    fireEvent.change(textbox('Subject'), {
      target: { value: '  Supply lines ' },
    });
    fireEvent.click(button('Save subject'));
    await waitFor(() =>
      expect(lastChoice(edit)).toEqual({ ...choice, subject: 'Supply lines' }),
    );
    fireEvent.change(textbox('Subject'), { target: { value: '  ' } });
    fireEvent.click(button('Save subject'));
    await waitFor(() =>
      expect(lastChoice(edit)).toEqual({
        choiceId: 'gather',
        actionId: 'gather_information',
      }),
    );
  });

  test('[rules.ACT-10.mission-replaced-local] a choice replaced on another device never inherits the unsaved subject typed for the old one', async () => {
    const old: StagedActionChoice = {
      choiceId: 'old',
      actionId: 'gather_information',
    };
    const { edit, rerender } = open(facts([old]));
    fireEvent.change(textbox('Subject'), { target: { value: 'Unsaved' } });
    const replacement: StagedActionChoice = {
      choiceId: 'new',
      actionId: 'gather_information',
    };
    rerender(
      <ActivityView view={facts([replacement])} edit={edit} disabled={false} />,
    );
    expect(textbox('Subject')).toHaveValue('');
    fireEvent.click(button('Save subject'));
    await waitFor(() =>
      expect(lastChoice(edit)).toEqual({
        choiceId: 'new',
        actionId: 'gather_information',
      }),
    );
  });

  test('[rules.ACT-14.mission-what-happened] What happened requires text, saves once with its own identity and clears without touching other notes', async () => {
    const legacy = {
      acknowledgementId: 'legacy',
      subjectId: 'older',
      outcome: 'From an older editor',
    };
    const choice: StagedActionChoice = {
      choiceId: 'know',
      actionId: 'knowledge_check',
      acknowledgements: [legacy],
    };
    const view = facts([choice], {
      requirements: ['know:acknowledgement:knowledge_check:know'],
      check: {
        spec: { count: 1, sides: 20 },
        organizationCheck: 'secrecy',
        dc: null,
        modifier: 5,
        total: 17,
        succeeded: true,
        breakdown: [],
      },
    });
    const { edit, rerender } = open(view);
    expect(screen.getByText('Knowledge DC achieved: 17')).toBeVisible();
    expect(
      screen.getByText('Required: the rules wait for this note.'),
    ).toBeVisible();
    const note = screen.getByRole('form', { name: 'What happened' });
    fireEvent.click(
      within(note).getByRole('button', { name: 'Save what happened' }),
    );
    expect(await within(note).findByRole('alert')).toHaveTextContent(
      'Describe what happened.',
    );
    expect(edit).not.toHaveBeenCalled();
    // The host still lists the older note by itself; this one is not repeated.
    expect(
      screen.getAllByRole('textbox', { name: /Outcome acknowledgement/ }),
    ).toHaveLength(1);
    fireEvent.change(
      within(note).getByRole('textbox', { name: 'What happened' }),
      {
        target: { value: 'The engines are dwarven' },
      },
    );
    fireEvent.click(
      within(note).getByRole('button', { name: 'Save what happened' }),
    );
    await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
    const saved = lastChoice(edit);
    expect(saved.acknowledgements).toEqual([
      legacy,
      {
        acknowledgementId: expect.any(String),
        subjectId: 'knowledge_check:know',
        outcome: 'The engines are dwarven',
      },
    ]);
    rerender(
      <ActivityView
        view={facts([saved])}
        edit={edit}
        disabled={false}
        openEvent={vi.fn()}
      />,
    );
    fireEvent.click(button('Clear what happened'));
    await waitFor(() =>
      expect(lastChoice(edit).acknowledgements).toEqual([legacy]),
    );
  });

  test('[rules.ACT-11.mission-special-cost] Special asks the table for its cost and keeps an explicit zero', async () => {
    const choice: StagedActionChoice = {
      choiceId: 'special',
      actionId: 'special',
      instruction: 'Hold the bridge',
      costCopper: 500,
    };
    const { edit } = open(facts([choice]));
    expect(textbox('Instruction')).toHaveValue('Hold the bridge');
    expect(
      screen.getByText(
        'Required: the GM sets this action’s cost. Enter 0 when it costs nothing.',
      ),
    ).toBeVisible();
    fireEvent.change(textbox('Cost (copper)'), { target: { value: '0' } });
    fireEvent.blur(textbox('Cost (copper)'));
    await waitFor(() =>
      expect(lastChoice(edit)).toEqual({ ...choice, costCopper: 0 }),
    );
  });
});

describe('Covert Action and Strike Team', () => {
  test('[rules.ACT-10.mission-covert-retained] a location the chosen mode does not use stays visible until it is cleared', async () => {
    const choice: StagedActionChoice = {
      choiceId: 'covert',
      actionId: 'covert_action',
      mode: 'augment',
      location: 'Ruined chapel',
      followingChoiceId: 'next',
    };
    const next: StagedActionChoice = {
      choiceId: 'next',
      actionId: 'gather_information',
    };
    const { edit } = open(facts([choice, next]));
    expect(
      card('Choice to augment', /Action Slot 2 · Gather Information/),
    ).toHaveAttribute('aria-checked', 'true');
    expect(textbox('Adventure site')).toHaveValue('Ruined chapel');
    expect(
      screen.getByText(
        'Not used by this mode; kept until you clear or replace it.',
      ),
    ).toBeVisible();
    fireEvent.click(button('Clear adventure site'));
    await waitFor(() =>
      expect(lastChoice(edit)).toEqual({
        choiceId: 'covert',
        actionId: 'covert_action',
        mode: 'augment',
        followingChoiceId: 'next',
      }),
    );
    fireEvent.click(card('Mode', /^Cache/));
    await waitFor(() =>
      expect(lastChoice(edit)).toMatchObject({ mode: 'cache' }),
    );
  });

  test('[rules.ACT-10.mission-strike-fields] Strike Team chooses its use and target location', async () => {
    const choice: StagedActionChoice = {
      choiceId: 'strike',
      actionId: 'strike_team',
    };
    const { edit } = open(facts([choice]));
    fireEvent.click(card('Use', /^Extraction/));
    await waitFor(() =>
      expect(lastChoice(edit)).toEqual({ ...choice, mode: 'extraction' }),
    );
    fireEvent.change(textbox('Target location'), {
      target: { value: 'Ford' },
    });
    fireEvent.click(button('Save target location'));
    await waitFor(() =>
      expect(lastChoice(edit)).toEqual({ ...choice, location: 'Ford' }),
    );
  });
});

describe('settlement actions', () => {
  test('[rules.ACT-10.mission-propaganda-fields] Spread Propaganda records the Occupied answer, keeps an explicit No, clears it on its own, and asks no GM permission', async () => {
    const choice: StagedActionChoice = {
      choiceId: 'propaganda',
      actionId: 'spread_propaganda',
      settlementId: 'town',
      // A stored legacy answer from before GM approval was assumed.
      possible: false,
      occupied: true,
    };
    const { edit } = open(facts([choice]));
    expect(
      screen.queryByRole('radiogroup', { name: 'Possible' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Ruled out')).toBeNull();
    expect(
      screen.getByText(
        'The settlement’s record says occupied; the rules use the record.',
      ),
    ).toBeVisible();
    fireEvent.click(card('Occupied by enemy forces', /^Not occupied/));
    await waitFor(() =>
      expect(lastChoice(edit)).toEqual({ ...choice, occupied: false }),
    );
    fireEvent.click(button('Clear occupied by enemy forces'));
    await waitFor(() =>
      expect(lastChoice(edit)).toEqual({
        choiceId: 'propaganda',
        actionId: 'spread_propaganda',
        settlementId: 'town',
        possible: false,
      }),
    );
  });

  test('[rules.ACT-10.mission-missing-settlement] a missing settlement stays chosen with a Militia corrections link', () => {
    open(
      facts([
        {
          choiceId: 'danger',
          actionId: 'reduce_danger',
          settlementId: 'gone',
        },
      ]),
    );
    expect(card('Target settlement', /^Missing settlement/)).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(card('Target settlement', /^Town/)).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Open Militia corrections' }),
    ).toHaveAttribute('href', '/campaigns/c/militia');
  });
});

describe('event candidates', () => {
  const guarantee: StagedActionChoice = {
    choiceId: 'guarantee',
    actionId: 'guarantee_event',
    candidates: [
      { eventId: 'a', origin: { kind: 'rolled' } },
      { eventId: 'b', origin: { kind: 'rolled' } },
    ],
    selectedEventId: 'b',
  };
  const candidateSets: Facts['candidateSets'] = [
    {
      choiceId: 'guarantee',
      active: true,
      candidates: [
        {
          eventId: 'a',
          label: 'Event 1A',
          name: 'Windfall',
          status: 'Not chosen',
          chosen: false,
          nested: 0,
        },
        {
          eventId: 'b',
          label: 'Event 1B',
          name: null,
          status: 'Awaiting roll',
          chosen: true,
          nested: 2,
        },
      ],
      issues: [{ code: 'x', message: 'Enter Event 1B’s table roll.' }],
    },
  ];

  test('[rules.ACT-10.mission-candidates-view] Guarantee Event shows its candidates as Event reads them and opens Event, even while edits are disabled', () => {
    const { openEvent, edit } = open(
      facts([guarantee], {}, { candidateSets }),
      { disabled: true },
    );
    const list = screen.getByRole('list', {
      name: 'Event candidates for this choice',
    });
    const [first, second] = within(list).getAllByRole('listitem');
    expect(first).toHaveTextContent('Event 1AWindfallNot chosen');
    expect(second).toHaveTextContent(
      'Event 1BNot rolled yetChosen · Awaiting roll· 2 nested events on record',
    );
    expect(screen.getByText('Enter Event 1B’s table roll.')).toBeVisible();
    fireEvent.click(button('Roll and choose in Event'));
    expect(openEvent).toHaveBeenCalledTimes(1);
    expect(edit).not.toHaveBeenCalled();
    // Event builds and edits the candidates: Activity keeps no candidate
    // editor of its own.
    expect(screen.queryByText('Recorded candidate details')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Candidates' })).toBeNull();
    expect(screen.queryByRole('button', { name: /candidates$/i })).toBeNull();
    expect(button('Save what happened')).toBeDisabled();
  });

  test('[rules.ACT-10.mission-candidates-calm] a set that guarantees nothing this week says so and keeps its candidates', () => {
    open(
      facts(
        [guarantee],
        {},
        { candidateSets: [{ ...candidateSets[0]!, active: false }] },
      ),
    );
    expect(
      screen.getByText(
        'This choice guarantees no event this week; any recorded candidates stay on record.',
      ),
    ).toBeVisible();
    expect(
      within(
        screen.getByRole('list', { name: 'Event candidates for this choice' }),
      ).getAllByRole('listitem'),
    ).toHaveLength(2);
  });
});
