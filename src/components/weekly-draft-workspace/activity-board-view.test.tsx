import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { foundationWeek } from '../../../tests/rules/foundation-acceptance-fixtures';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import { activityView as projectedFacts } from './activity-facts';
import { ActivityView } from './activity-view';
import {
  acceptingEdit,
  activityFacts,
  activitySlot,
  selectSlot,
} from './activity-view-fixture';
import { activitySlotAnchor } from './source-anchors';
import type { ActivityView as Facts } from './types';

// Radix Select needs pointer geometry jsdom lacks; a native select keeps the
// same value/onValueChange contract and the trigger's accessible name.
vi.mock('~/components/ui/select', async () => {
  const { Children, isValidElement } = await import('react');
  type Props = { children?: React.ReactNode; [key: string]: unknown };
  const SelectTrigger = (_: Props) => null;
  const text = (node: React.ReactNode): string =>
    Children.toArray(node)
      .map((child) =>
        typeof child === 'string' || typeof child === 'number'
          ? String(child)
          : isValidElement<Props>(child)
            ? text(child.props.children)
            : '',
      )
      .join('');
  const find = (node: React.ReactNode): Props | null => {
    for (const child of Children.toArray(node)) {
      if (!isValidElement<Props>(child)) continue;
      if (child.type === SelectTrigger) return child.props;
      const nested = find(child.props.children);
      if (nested) return nested;
    }
    return null;
  };
  return {
    Select: ({
      value,
      onValueChange,
      disabled,
      children,
    }: Props & {
      value?: string;
      onValueChange?: (value: string) => void;
      disabled?: boolean;
    }) => {
      const trigger = find(children);
      return (
        <select
          id={trigger?.id as string | undefined}
          aria-label={trigger?.['aria-label'] as string | undefined}
          value={value ?? ''}
          disabled={disabled}
          onChange={(event) => onValueChange?.(event.target.value)}
        >
          <option value="" />
          {children}
        </select>
      );
    },
    SelectTrigger,
    SelectValue: () => null,
    SelectContent: ({ children }: Props) => <>{children}</>,
    SelectGroup: ({ children }: Props) => <>{children}</>,
    SelectLabel: () => null,
    SelectSeparator: () => null,
    SelectItem: ({ value, children }: Props & { value: string }) => (
      <option value={value}>{text(children)}</option>
    ),
  };
});

const check = (die: number, modifiers: RawRoll['modifiers'] = []): RawRoll => ({
  diceTotal: die,
  diceCount: 1,
  sides: 20,
  provenance: { kind: 'table' },
  modifiers,
});
const helpful = { sourceId: 'helpful', value: 2, reason: 'Helpful' };
function board(overrides: Partial<Facts> = {}) {
  return activityFacts(
    [
      activitySlot({ choiceId: 'drill', actionId: 'drill_militia' }),
      activitySlot(null, { slotId: 'two', number: 2 }),
      activitySlot(null, {
        slotId: 'three',
        number: 3,
        beyondAllowance: true,
        removable: true,
      }),
    ],
    {
      actions: [
        { actionId: 'lie_low', name: 'Lie Low' },
        { actionId: 'earn_gold', name: 'Earn Gold' },
      ],
      ...overrides,
    },
  );
}
const lastEdit = (edit: ReturnType<typeof acceptingEdit>) =>
  edit.mock.lastCall![0];

describe('slot board and picker', () => {
  test('[rules.ACT-02.picker] [rules.P82.replace] an empty slot opens the grouped picker; a card stages it, Escape cancels, Change action replaces', async () => {
    const edit = acceptingEdit();
    render(<ActivityView view={board()} edit={edit} disabled={false} />);
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Choose an action for Action Slot 2',
      }),
    );
    const sheet = await screen.findByRole('dialog', {
      name: 'Choose an action for Action Slot 2',
    });
    expect(
      within(sheet)
        .getAllByRole('heading')
        .map((heading) => heading.textContent),
    ).toEqual(
      expect.arrayContaining([
        'No team needed',
        'No ready team (needs a Rules Exception)',
      ]),
    );
    expect(
      within(sheet).getByRole('button', { name: 'Earn Gold' }),
    ).toHaveAccessibleDescription(
      'Needs a ready Black Marketeers, Fixers, Merchants or Patrons team',
    );
    fireEvent.click(within(sheet).getByRole('button', { name: 'Lie Low' }));
    expect(lastEdit(edit)).toMatchObject({
      kind: 'stage',
      slotId: 'two',
      choice: { actionId: 'lie_low', choiceId: expect.any(String) },
    });
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Choose an action for Action Slot 2',
      }),
    );
    await screen.findByRole('dialog');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(edit).toHaveBeenCalledTimes(1);
    selectSlot('Drill Militia');
    fireEvent.click(screen.getByRole('button', { name: 'Change action' }));
    fireEvent.click(
      within(
        await screen.findByRole('dialog', {
          name: 'Change the action in Action Slot 1',
        }),
      ).getByRole('button', { name: 'Earn Gold' }),
    );
    expect(lastEdit(edit)).toMatchObject({
      kind: 'replace',
      slotId: 'one',
      choiceId: 'drill',
      choice: { actionId: 'earn_gold' },
    });
  });

  test('[rules.ACT-02.picker] closing the picker with Escape returns focus to the slot that opened it', async () => {
    const edit = acceptingEdit();
    render(<ActivityView view={board()} edit={edit} disabled={false} />);
    const slot = screen.getByRole('button', {
      name: 'Choose an action for Action Slot 2',
    });
    slot.focus();
    fireEvent.click(slot);
    const sheet = await screen.findByRole('dialog');
    await waitFor(() => expect(slot).not.toHaveFocus());
    fireEvent.keyDown(sheet, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(slot).toHaveFocus());
    expect(edit).not.toHaveBeenCalled();
  });

  test('[rules.ACT-04.move] [rules.P82.cards] Move to moves a whole choice into an empty slot or swaps occupied ones; Clear and Remove are distinct', () => {
    const edit = acceptingEdit();
    const facts = board();
    const { rerender } = render(
      <ActivityView view={facts} edit={edit} disabled={false} />,
    );
    selectSlot('Drill Militia');
    const move = () =>
      screen.getByRole('combobox', { name: 'Move Action Slot 1 to' });
    fireEvent.change(move(), { target: { value: 'two' } });
    expect(lastEdit(edit)).toEqual({
      kind: 'move',
      fromSlotId: 'one',
      toSlotId: 'two',
      choiceId: 'drill',
    });
    const swapped = board();
    swapped.slots[1] = activitySlot(
      { choiceId: 'low', actionId: 'lie_low' },
      { slotId: 'two', number: 2 },
    );
    rerender(<ActivityView view={swapped} edit={edit} disabled={false} />);
    selectSlot('Drill Militia');
    expect(
      within(move())
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      '',
      'Swap with Action Slot 2 · Lie Low',
      'Action Slot 3 (empty)',
    ]);
    fireEvent.change(move(), { target: { value: 'two' } });
    expect(lastEdit(edit)).toEqual({
      kind: 'swap',
      fromSlotId: 'one',
      toSlotId: 'two',
      choiceId: 'drill',
      otherChoiceId: 'low',
    });
    selectSlot('Drill Militia');
    fireEvent.click(
      screen.getByRole('button', { name: 'Clear Drill Militia' }),
    );
    expect(lastEdit(edit)).toEqual({
      kind: 'clear',
      slotId: 'one',
      choiceId: 'drill',
    });
    expect(
      screen.queryByRole('button', { name: 'Remove Action Slot 2' }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Action Slot 3' }),
    );
    expect(lastEdit(edit)).toEqual({ kind: 'remove_slot', slotId: 'three' });
    // Focus moves to the nearest surviving slot.
    expect(
      screen.getByRole('button', { name: 'Action Slot 2 · Lie Low' }),
    ).toHaveFocus();
  });

  test('[rules.ACT-09.header] the header, Strategist badge and allowance boundary come from the ordered rules projection', () => {
    const input = foundationWeek(3);
    input.militiaSnapshot.roster.officers = [
      { role: 'strategist', characterId: 'pc' },
    ];
    input.revision.activity.slots.push(
      { slotId: 'third', choice: null },
      { slotId: 'fourth', choice: null },
    );
    const facts = () =>
      projectedFacts(
        input.revision,
        workspaceSourceSchema.parse({
          key: {
            campaignId: 'campaign',
            militiaId: 'militia',
            draftId: input.revision.draftId,
          },
          week: input.revision.week,
          sourceRevision: 0,
          snapshot: input.militiaSnapshot,
          people: [{ characterId: 'pc', name: 'Officer' }],
        }),
        projectWeeklyDraft(input),
      );
    const edit = acceptingEdit();
    const { rerender } = render(
      <ActivityView view={facts()} edit={edit} disabled={false} />,
    );
    expect(
      screen.getByText(
        (_, node) =>
          node?.tagName === 'P' &&
          node.textContent === '0 of 3 actions · 2 from rank 3 + 1 Strategist',
      ),
    ).toBeVisible();
    const slot = (n: number) =>
      screen.getByRole('group', { name: `Action Slot ${n}` });
    expect(within(slot(3)).getByText('Strategist +2')).toBeVisible();
    expect(screen.getAllByText('Strategist +2')).toHaveLength(1);
    expect(within(slot(4)).getByText('Beyond the allowance')).toBeVisible();
    expect(
      within(slot(4)).getByRole('button', { name: 'Remove Action Slot 4' }),
    ).toBeEnabled();
    expect(
      within(slot(3)).queryByRole('button', { name: /Remove/ }),
    ).not.toBeInTheDocument();
    // Removing the Strategist in slot 1 moves the boundary sequentially.
    input.revision.activity.slots[0]!.choice = {
      choiceId: 'role',
      actionId: 'change_officer_role',
      characterId: 'pc',
      fromRole: 'strategist',
    };
    rerender(<ActivityView view={facts()} edit={edit} disabled={false} />);
    expect(
      screen.getByText(
        'From Action Slot 2 the allowance is 2 after an earlier officer change.',
      ),
    ).toBeVisible();
    expect(screen.queryByText('Strategist +2')).not.toBeInTheDocument();
    expect(within(slot(3)).getByText('Beyond the allowance')).toBeVisible();
    // Until Upkeep is complete the allowance is not final.
    input.revision.upkeep.rolls = {};
    rerender(<ActivityView view={facts()} edit={edit} disabled={false} />);
    expect(
      screen.getByText(
        'Extra empty slots can be removed once Upkeep is complete.',
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /Remove Action Slot/ }),
    ).not.toBeInTheDocument();
    expect(edit).not.toHaveBeenCalled();
  });
  test('[rules.O05.slot-label] the automatic Strategist label follows rank and ordered assignments on empty and occupied slots', () => {
    const input = foundationWeek(1);
    input.militiaSnapshot.roster.officers = [
      { role: 'strategist', characterId: 'pc' },
    ];
    input.revision.activity.slots.push({ slotId: 'third', choice: null });
    const facts = () =>
      projectedFacts(
        input.revision,
        workspaceSourceSchema.parse({
          key: {
            campaignId: 'campaign',
            militiaId: 'militia',
            draftId: input.revision.draftId,
          },
          week: input.revision.week,
          sourceRevision: 0,
          snapshot: input.militiaSnapshot,
          people: [{ characterId: 'pc', name: 'Officer' }],
        }),
        projectWeeklyDraft(input),
      );
    const edit = acceptingEdit();
    const { rerender } = render(
      <ActivityView view={facts()} edit={edit} disabled={false} />,
    );
    const slot = (n: number) =>
      screen.getByRole('group', { name: `Action Slot ${n}` });
    expect(within(slot(2)).getByText('Tap to choose an action')).toBeVisible();
    expect(within(slot(2)).getByText('Strategist +2')).toBeVisible();
    expect(screen.getAllByText('Strategist +2')).toHaveLength(1);
    input.revision.activity.slots[1]!.choice = {
      choiceId: 'work',
      actionId: 'special',
      instruction: 'Scout',
      costCopper: 0,
    };
    rerender(<ActivityView view={facts()} edit={edit} disabled={false} />);
    expect(within(slot(2)).getByText('Strategist +2')).toBeVisible();
    input.militiaSnapshot.rank = 2;
    input.militiaSnapshot.training = 11;
    rerender(<ActivityView view={facts()} edit={edit} disabled={false} />);
    expect(
      within(slot(2)).queryByText('Strategist +2'),
    ).not.toBeInTheDocument();
    expect(within(slot(3)).getByText('Strategist +2')).toBeVisible();
    input.revision.activity.slots[0]!.choice = {
      choiceId: 'role',
      actionId: 'change_officer_role',
      characterId: 'pc',
      fromRole: 'strategist',
    };
    rerender(<ActivityView view={facts()} edit={edit} disabled={false} />);
    expect(screen.queryByText('Strategist +2')).not.toBeInTheDocument();
    input.militiaSnapshot.roster.officers = [];
    input.revision.activity.slots[0]!.choice = {
      choiceId: 'role',
      actionId: 'change_officer_role',
      characterId: 'pc',
      toRole: 'strategist',
    };
    rerender(<ActivityView view={facts()} edit={edit} disabled={false} />);
    expect(within(slot(3)).getByText('Strategist +2')).toBeVisible();
    expect(edit).not.toHaveBeenCalled();
  });

  test('[rules.F04.capacity-guidance] retained extra-slot choices explain correction without suggesting an exception', () => {
    const input = foundationWeek(3);
    input.revision.activity.slots.push({
      slotId: 'third',
      choice: { choiceId: 'drill', actionId: 'drill_militia' },
    });
    render(
      <ActivityView
        view={projectedFacts(
          input.revision,
          workspaceSourceSchema.parse({
            key: {
              campaignId: 'campaign',
              militiaId: 'militia',
              draftId: input.revision.draftId,
            },
            week: input.revision.week,
            sourceRevision: 0,
            snapshot: input.militiaSnapshot,
            people: [],
          }),
          projectWeeklyDraft(input),
        )}
        edit={acceptingEdit()}
        disabled={false}
      />,
    );
    expect(
      within(screen.getByRole('group', { name: 'Action Slot 3' })).getByText(
        'Beyond the allowance',
      ),
    ).toBeVisible();
    selectSlot('Drill Militia', 3);
    // Shown once, although the rules report it as a requirement and a warning.
    expect(
      screen.getByText(
        /Move this choice to an available slot, clear it, or restore the action allowance before confirming the week\./,
      ),
    ).toBeVisible();
    expect(
      screen.queryByText(/record an exception with a reason/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'Action Capacity exception' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Exception reason' }),
    ).not.toBeInTheDocument();
  });

  test('[PER-02.link] every slot card carries the focusable anchor a Persistent source link opens', () => {
    render(
      <ActivityView view={board()} edit={acceptingEdit()} disabled={false} />,
    );
    for (const [slotId, number] of [
      ['one', 1],
      ['two', 2],
      ['three', 3],
    ] as const) {
      const card = screen.getByRole('group', { name: `Action Slot ${number}` });
      expect(card).toHaveAttribute('id', activitySlotAnchor(slotId));
      card.focus();
      expect(card).toHaveFocus();
    }
  });
});

describe('selected details', () => {
  function withGather(slot: Partial<Facts['slots'][number]> = {}) {
    const facts = board({
      teamRoster: [
        {
          teamId: 'net',
          name: 'Whisper Net',
          teamType: 'informants',
          typeName: 'Informants',
          tier: 1,
          condition: 'active',
          unavailable: false,
          recruitedInSlot: null,
        },
      ],
    });
    facts.slots[0] = activitySlot(
      { choiceId: 'gather', actionId: 'gather_information', teamId: 'gone' },
      { team: { teamId: 'gone', name: null }, ...slot },
    );
    return facts;
  }

  test('[rules.ACT-10.team] the team dropdown lists eligible teams first, clears with No team and keeps a missing reference visible', () => {
    const edit = acceptingEdit();
    render(
      <ActivityView
        view={withGather()}
        edit={edit}
        disabled={false}
        correctionsHref="/campaigns/c/militia"
      />,
    );
    expect(
      within(screen.getByRole('group', { name: 'Action Slot 1' })).getByText(
        'Missing team',
      ),
    ).toBeVisible();
    selectSlot('Gather Information');
    const team = screen.getByRole('combobox', { name: 'Team' });
    expect(
      within(team)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      '',
      'Missing team',
      'Whisper Net · Informants 1 · Free',
      'No team',
    ]);
    expect(
      screen.getByText(/The recorded team is no longer on the roster/),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Open Militia corrections' }),
    ).toHaveAttribute('href', '/campaigns/c/militia');
    fireEvent.change(team, { target: { value: 'net' } });
    expect(lastEdit(edit)).toEqual({
      kind: 'detail',
      slotId: 'one',
      choiceId: 'gather',
      choice: {
        choiceId: 'gather',
        actionId: 'gather_information',
        teamId: 'net',
      },
    });
    fireEvent.change(team, { target: { value: '__none__' } });
    expect(lastEdit(edit)).toMatchObject({
      choice: { choiceId: 'gather', actionId: 'gather_information' },
    });
    expect(
      (lastEdit(edit) as Extract<WeeklyDraftEdit, { kind: 'detail' }>).choice,
    ).not.toHaveProperty('teamId');
  });

  function helpfulBoard() {
    const facts = board({
      helpful: {
        settlementName: 'Phaendar',
        usedIn: [{ slotId: 'one', slotNumber: 1 }],
      },
    });
    facts.slots[0] = activitySlot({
      choiceId: 'drill',
      actionId: 'drill_militia',
      rolls: { check: check(10, [helpful]) },
    });
    facts.slots[1] = activitySlot(
      {
        choiceId: 'gold',
        actionId: 'earn_gold',
        rolls: { check: check(12) },
      },
      { slotId: 'two', number: 2 },
    );
    return facts;
  }

  test('[rules.ACT-12.helpful-move] moving Helpful clears it elsewhere first, then assigns it from the latest facts', async () => {
    const start = helpfulBoard();
    // After the clear is accepted, another player recorded a cost on Earn
    // Gold: the assignment must start from that newest choice.
    const fresh = structuredClone(start);
    fresh.slots[0] = activitySlot({
      choiceId: 'drill',
      actionId: 'drill_militia',
      rolls: { check: check(10) },
    });
    fresh.slots[1] = activitySlot(
      {
        choiceId: 'gold',
        actionId: 'earn_gold',
        costCopper: 700,
        rolls: { check: check(12) },
      },
      { slotId: 'two', number: 2 },
    );
    fresh.helpful = { settlementName: 'Phaendar', usedIn: [] };
    let current = start;
    const edit = vi.fn((_: WeeklyDraftEdit) => {
      current = fresh;
      return Promise.resolve<'accepted' | 'failed'>('accepted');
    });
    render(
      <ActivityView
        view={start}
        edit={edit}
        disabled={false}
        latest={() => current}
      />,
    );
    selectSlot('Earn Gold', 2);
    expect(
      screen.getByText('Now on Action Slot 1. Tapping moves it here.'),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Use Helpful +2 (Phaendar, once per Activity)',
      }),
    );
    await waitFor(() => expect(edit).toHaveBeenCalledTimes(2));
    expect(edit.mock.calls[0]![0]).toEqual({
      kind: 'detail',
      slotId: 'one',
      choiceId: 'drill',
      choice: {
        choiceId: 'drill',
        actionId: 'drill_militia',
        rolls: { check: check(10) },
      },
    });
    expect(edit.mock.calls[1]![0]).toEqual({
      kind: 'detail',
      slotId: 'two',
      choiceId: 'gold',
      choice: {
        choiceId: 'gold',
        actionId: 'earn_gold',
        costCopper: 700,
        rolls: {
          check: check(12, [
            {
              sourceId: 'helpful',
              value: 2,
              reason: 'Helpful settlement support (Phaendar)',
            },
          ]),
        },
      },
    });
    expect(screen.queryByText(/Try again\./)).not.toBeInTheDocument();
  });

  test('[rules.ACT-12.helpful-failure] a failed clear stops the move; a failed assignment reports the partial result and retries', async () => {
    const results: ('accepted' | 'failed')[] = ['failed'];
    const edit = vi.fn((_: WeeklyDraftEdit) =>
      Promise.resolve(results.shift() ?? 'accepted'),
    );
    render(<ActivityView view={helpfulBoard()} edit={edit} disabled={false} />);
    selectSlot('Earn Gold', 2);
    const use = () =>
      screen.getByRole('button', {
        name: 'Use Helpful +2 (Phaendar, once per Activity)',
      });
    fireEvent.click(use());
    expect(
      (
        await screen.findByText(
          'Helpful could not be moved and still applies to Action Slot 1. Try again.',
        )
      ).closest('[role=\"alert\"]'),
    ).not.toBeNull();
    expect(edit).toHaveBeenCalledTimes(1);
    results.push('accepted', 'failed');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(edit).toHaveBeenCalledTimes(3));
    expect(
      (
        await screen.findByText(
          'Helpful was removed from Action Slot 1 but could not be added to this check. Try again.',
        )
      ).closest('[role=\"alert\"]'),
    ).not.toBeNull();
  });

  test('[rules.WEEK-14.modifier] a custom modifier needs a signed whole number and a reason; recorded entries are removed one by one', async () => {
    const edit = acceptingEdit();
    const facts = board();
    const legacy = { sourceId: 'mystery', value: 3, reason: 'Old note' };
    facts.slots[0] = activitySlot(
      {
        choiceId: 'drill',
        actionId: 'drill_militia',
        rolls: { check: check(10, [legacy]) },
      },
      {
        modifiers: [
          {
            index: 0,
            sourceId: 'mystery',
            kind: 'unknown',
            label: 'Old note',
            value: 3,
            reason: 'Old note',
            warning: 'This recorded modifier is not applied by the rules.',
          },
        ],
      },
    );
    render(<ActivityView view={facts} edit={edit} disabled={false} />);
    selectSlot('Drill Militia');
    expect(
      screen.getByText('This recorded modifier is not applied by the rules.'),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Add modifier' }));
    const submit = () =>
      fireEvent.click(screen.getByRole('button', { name: 'Add modifier' }));
    submit();
    expect(await screen.findByText('Enter a value.')).toBeVisible();
    expect(screen.getByText('A reason is required.')).toBeVisible();
    const value = screen.getByRole('textbox', { name: 'Value' });
    fireEvent.change(value, { target: { value: '-' } });
    expect(value).toHaveValue('-');
    fireEvent.change(value, { target: { value: '2.5' } });
    submit();
    expect(
      await screen.findByText('Enter a whole number, such as -2 or 3.'),
    ).toBeVisible();
    expect(edit).not.toHaveBeenCalled();
    fireEvent.change(value, { target: { value: '-2' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
      target: { value: 'Heavy rain' },
    });
    submit();
    await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
    expect(lastEdit(edit)).toMatchObject({
      kind: 'detail',
      choice: {
        rolls: {
          check: {
            diceTotal: 10,
            diceCount: 1,
            modifiers: [
              legacy,
              {
                sourceId: expect.stringMatching(/^custom:/),
                value: -2,
                reason: 'Heavy rain',
              },
            ],
          },
        },
      },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove modifier Old note' }),
    );
    expect(lastEdit(edit)).toMatchObject({
      choice: {
        rolls: { check: { diceTotal: 10, diceCount: 1, modifiers: [] } },
      },
    });
  });
});

describe('shared editing', () => {
  test('[rules.WEEK-10.confirmation] Confirmation disables every mutation control, including an already-open picker', async () => {
    const edit = acceptingEdit();
    const facts = board();
    const { rerender } = render(
      <ActivityView view={facts} edit={edit} disabled={false} />,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Choose an action for Action Slot 2',
      }),
    );
    const sheet = await screen.findByRole('dialog');
    rerender(<ActivityView view={facts} edit={edit} disabled />);
    const card = within(sheet).getByRole('button', { name: 'Lie Low' });
    expect(card).toBeDisabled();
    fireEvent.click(card);
    fireEvent.keyDown(sheet, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Add slot' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Remove Action Slot 3' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('combobox', { name: 'Operating from' }),
    ).toBeDisabled();
    selectSlot('Drill Militia');
    for (const name of ['Change action', 'Clear Drill Militia'])
      expect(screen.getByRole('button', { name })).toBeDisabled();
    expect(
      screen.getByRole('combobox', { name: 'Move Action Slot 1 to' }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Choose an action for Action Slot 2',
      }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(edit).not.toHaveBeenCalled();
  });

  test('[rules.WEEK-04.reconcile] a remote change to the picker or selected slot closes it instead of redirecting the edit', async () => {
    const edit = acceptingEdit();
    const facts = board();
    const { rerender } = render(
      <ActivityView view={facts} edit={edit} disabled={false} />,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Choose an action for Action Slot 2',
      }),
    );
    await screen.findByRole('dialog');
    const filled = board();
    filled.slots[1] = activitySlot(
      { choiceId: 'remote', actionId: 'earn_gold' },
      { slotId: 'two', number: 2 },
    );
    rerender(<ActivityView view={filled} edit={edit} disabled={false} />);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(
      screen.getByText(
        'Action Slot 2 changed on another device, so the action picker closed. Nothing was placed.',
      ),
    ).toBeVisible();
    selectSlot('Drill Militia');
    expect(
      screen.getByRole('region', { name: 'Action Slot 1 details' }),
    ).toBeVisible();
    const removed = board();
    removed.slots[0] = activitySlot(null);
    rerender(<ActivityView view={removed} edit={edit} disabled={false} />);
    expect(
      screen.queryByRole('region', { name: 'Action Slot 1 details' }),
    ).not.toBeInTheDocument();
    await act(async () => undefined);
    expect(edit).not.toHaveBeenCalled();
  });
});
