import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import type { RawRoll, StagedActionChoice } from '~/lib/weekly-draft-facts';
import { ActivityView } from './activity-view';
import {
  acceptingEdit,
  activityFacts,
  activitySlot,
  selectSlot,
} from './activity-view-fixture';
import type { ActivityView as Facts } from './types';

type Slot = Facts['slots'][number];
function facts(
  choice: StagedActionChoice,
  slot: Partial<Slot> = {},
  view: Partial<Facts> = {},
): Facts {
  return activityFacts([activitySlot(choice, slot)], {
    characters: [
      { characterId: 'ameiko', name: 'Ameiko', level: 6 },
      { characterId: 'jagrin', name: 'Jagrin', level: 5 },
    ],
    teamRoster: [
      {
        teamId: 'moles',
        name: 'Tunnel rats',
        teamType: 'moles',
        typeName: 'Moles',
        tier: 1,
        condition: 'active',
        unavailable: false,
        recruitedInSlot: null,
      },
    ],
    settlements: [{ value: 'town', label: 'Town' }],
    ...view,
  });
}
function open(view: Facts, disabled = false) {
  const edit = acceptingEdit();
  const utils = render(
    <ActivityView view={view} edit={edit} disabled={disabled} />,
  );
  selectSlot(view.slots[0]!.actionName!);
  return { edit, ...utils };
}
function lastChoice(edit: ReturnType<typeof acceptingEdit>) {
  const call = edit.mock.lastCall![0];
  if (call.kind !== 'detail') throw new Error('Expected a detail edit');
  return call.choice;
}
const group = (name: string) => screen.getByRole('radiogroup', { name });
const card = (groupName: string, name: string) =>
  within(group(groupName)).getByRole('radio', { name });
const total = (sides: number, count: number, value: number): RawRoll => ({
  sides,
  diceCount: count,
  diceTotal: value,
  provenance: { kind: 'table' },
  modifiers: [],
});
// The check as the rules read it: `succeeded` decides the rolls used only on
// a success or a failure.
const checked = (succeeded: boolean | null): Slot['check'] => ({
  spec: { count: 1, sides: 20 },
  organizationCheck: 'loyalty',
  dc: 13,
  modifier: 0,
  total: succeeded === null ? null : succeeded ? 15 : 5,
  succeeded,
  breakdown: [],
});

describe('people actions', () => {
  test('[rules.ACT-10.officer-edit] Change Officer Role stages character, from-role and to-role from all six roles and clears each explicitly', () => {
    const choice: StagedActionChoice = {
      choiceId: 'officer',
      actionId: 'change_officer_role',
      characterId: 'ameiko',
      fromRole: 'marshal',
    };
    const { edit } = open(
      facts(choice, {
        position: {
          officers: [{ characterId: 'ameiko', role: 'marshal' }],
          refugeSettlementIds: [],
          settlements: [],
          propaganda: [],
          characterStatus: [],
          economy: null,
        },
      }),
    );
    expect(screen.getByText('Roles at this slot: Marshal')).toBeVisible();
    expect(within(group('To role')).getAllByRole('radio')).toHaveLength(6);
    expect(card('From role', 'Marshal')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    fireEvent.click(card('To role', 'Strategist'));
    expect(lastChoice(edit)).toEqual({ ...choice, toRole: 'strategist' });
    fireEvent.click(screen.getByRole('button', { name: 'Clear from role' }));
    expect(lastChoice(edit)).toEqual({
      choiceId: 'officer',
      actionId: 'change_officer_role',
      characterId: 'ameiko',
    });
    fireEvent.click(card('Character', 'Jagrin'));
    expect(lastChoice(edit)).toMatchObject({ characterId: 'jagrin' });
    // Re-choosing the recorded card is not another edit.
    const calls = edit.mock.calls.length;
    fireEvent.click(card('Character', 'Ameiko'));
    expect(edit).toHaveBeenCalledTimes(calls);
  });

  test('[rules.WEEK-13.option-cards-keyboard] option cards are one Tab stop; arrows move focus without selecting and Space selects', () => {
    const choice: StagedActionChoice = {
      choiceId: 'officer',
      actionId: 'change_officer_role',
    };
    const { edit } = open(facts(choice));
    const cards = within(group('Character')).getAllByRole('radio');
    expect(cards.filter((radio) => radio.tabIndex === 0)).toEqual([
      card('Character', 'Ameiko'),
    ]);
    const calls = edit.mock.calls.length;
    card('Character', 'Ameiko').focus();
    fireEvent.keyDown(card('Character', 'Ameiko'), { key: 'ArrowRight' });
    expect(card('Character', 'Jagrin')).toHaveFocus();
    fireEvent.keyDown(card('Character', 'Jagrin'), { key: 'ArrowRight' });
    expect(card('Character', 'Ameiko')).toHaveFocus();
    fireEvent.keyDown(card('Character', 'Ameiko'), { key: 'End' });
    expect(card('Character', 'Jagrin')).toHaveFocus();
    expect(edit).toHaveBeenCalledTimes(calls);
    fireEvent.keyDown(card('Character', 'Jagrin'), { key: ' ' });
    expect(lastChoice(edit)).toEqual({ ...choice, characterId: 'jagrin' });
    fireEvent.keyDown(card('Character', 'Ameiko'), { key: 'Enter' });
    expect(lastChoice(edit)).toEqual({ ...choice, characterId: 'ameiko' });
  });

  test('[rules.ACT-10.rescue-level] the Rescue level shows the rules level until a table value, including zero, is staged', () => {
    const choice: StagedActionChoice = {
      choiceId: 'rescue',
      actionId: 'rescue_character',
      characterId: 'ameiko',
    };
    const { edit, rerender } = open(facts(choice));
    const level = () =>
      screen.getByRole('textbox', { name: 'Character level' });
    expect(level()).toHaveValue('6');
    expect(screen.getByText('From the character’s record.')).toBeVisible();
    fireEvent.change(level(), { target: { value: '0' } });
    expect(lastChoice(edit)).toEqual({ ...choice, characterLevel: 0 });
    rerender(
      <ActivityView
        view={facts({ ...choice, characterLevel: 0 })}
        edit={edit}
        disabled={false}
      />,
    );
    expect(level()).toHaveValue('0');
    expect(
      screen.getByText('Record: level 6. The rules use the recorded level.'),
    ).toBeVisible();
  });

  test('[rules.ACT-10.restore-modes] Restore Character keeps a character a party mode does not use until cleared, and edits the restorative effect', async () => {
    const choice: StagedActionChoice = {
      choiceId: 'restore',
      actionId: 'restore_character',
      mode: 'hit_points',
      characterId: 'ameiko',
    };
    const { edit, rerender } = open(facts(choice));
    expect(within(group('Mode')).getAllByRole('radio')).toHaveLength(7);
    expect(
      screen.getByText(/the recorded character is not used/),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Clear character' }));
    expect(lastChoice(edit)).toEqual({
      choiceId: 'restore',
      actionId: 'restore_character',
      mode: 'hit_points',
    });
    fireEvent.click(card('Mode', 'Restorative Effect'));
    expect(lastChoice(edit)).toEqual({
      ...choice,
      mode: 'restorative_effect',
    });
    rerender(
      <ActivityView
        view={facts({ ...choice, mode: 'restorative_effect' })}
        edit={edit}
        disabled={false}
      />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Effect' }), {
      target: { value: 'Lesser restoration' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save effect' }));
    await waitFor(() =>
      expect(lastChoice(edit)).toMatchObject({ effect: 'Lesser restoration' }),
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Effect level' }), {
      target: { value: '2' },
    });
    expect(lastChoice(edit)).toMatchObject({ effectLevel: 2 });
    fireEvent.click(card('Target present', 'Not present'));
    expect(lastChoice(edit)).toMatchObject({ targetPresent: false });
  });
});

describe('team actions', () => {
  test('[rules.ACT-10.recruit-check] Recruit Team shows the table’s check, asks for a table check only without recruitment rules and refuses a missing or malformed DC', async () => {
    const { edit, rerender } = open(
      facts({ choiceId: 'recruit', actionId: 'recruit_team' }),
    );
    expect(screen.queryByLabelText(/manager/i)).not.toBeInTheDocument();
    fireEvent.click(card('Team type', 'Moles'));
    expect(lastChoice(edit)).toMatchObject({ teamType: 'moles' });
    rerender(
      <ActivityView
        view={facts({
          choiceId: 'recruit',
          actionId: 'recruit_team',
          teamType: 'moles',
        })}
        edit={edit}
        disabled={false}
      />,
    );
    expect(
      screen.getByText(
        'Recruitment check: Secrecy DC 15, from the team table.',
      ),
    ).toBeVisible();
    rerender(
      <ActivityView
        view={facts({
          choiceId: 'recruit',
          actionId: 'recruit_team',
          teamType: 'spies',
        })}
        edit={edit}
        disabled={false}
      />,
    );
    const calls = edit.mock.calls.length;
    fireEvent.click(
      screen.getByRole('button', { name: 'Save recruitment check' }),
    );
    await waitFor(() =>
      expect(screen.getByText('Enter the DC.')).toHaveAttribute(
        'role',
        'alert',
      ),
    );
    expect(screen.getByText('Choose a check.')).toBeVisible();
    fireEvent.change(screen.getByRole('textbox', { name: 'Recruitment DC' }), {
      target: { value: '1e3' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save recruitment check' }),
    );
    await waitFor(() =>
      expect(screen.getByText('Use digits only.')).toBeVisible(),
    );
    expect(edit).toHaveBeenCalledTimes(calls);
  });

  test('[rules.ACT-10.recruit-retained] a recorded table check the team table replaces stays visible until explicitly cleared', () => {
    const choice: StagedActionChoice = {
      choiceId: 'recruit',
      actionId: 'recruit_team',
      teamType: 'moles',
      recruitmentCheck: { check: 'loyalty', dc: 0 },
    };
    const { edit } = open(facts(choice));
    expect(
      screen.getByText(
        /recorded table check \(Loyalty DC 0\) is not used: Moles recruit with Secrecy DC 15/,
      ),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Clear recruitment check' }),
    );
    expect(lastChoice(edit)).toEqual({
      choiceId: 'recruit',
      actionId: 'recruit_team',
      teamType: 'moles',
    });
  });

  test('[rules.ACT-10.upgrade-edit] Upgrade Team picks a target team and an upgrade on its path; a missing target stays visible', () => {
    const { edit, rerender } = open(
      facts({ choiceId: 'upgrade', actionId: 'upgrade_team' }),
    );
    expect(
      screen.getByText('Choose the team first to see its upgrade path.'),
    ).toBeVisible();
    fireEvent.click(card('Team to upgrade', 'Tunnel rats'));
    expect(lastChoice(edit)).toMatchObject({ targetTeamId: 'moles' });
    rerender(
      <ActivityView
        view={facts({
          choiceId: 'upgrade',
          actionId: 'upgrade_team',
          targetTeamId: 'moles',
        })}
        edit={edit}
        disabled={false}
      />,
    );
    const path = card('Upgrade to', 'Propagandists');
    expect(path).toHaveAccessibleDescription('Tier 2 · 250 gp');
    fireEvent.click(path);
    expect(lastChoice(edit)).toMatchObject({ toTeamType: 'propagandists' });
    rerender(
      <ActivityView
        view={facts({
          choiceId: 'upgrade',
          actionId: 'upgrade_team',
          targetTeamId: 'gone',
        })}
        edit={edit}
        disabled={false}
      />,
    );
    expect(card('Team to upgrade', 'Missing team')).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('[rules.ACT-10.dismiss-edit] Dismiss Team records its target and its failure notoriety roll on the shared total input', () => {
    const choice: StagedActionChoice = {
      choiceId: 'dismiss',
      actionId: 'dismiss_team',
    };
    const { edit } = open(
      facts(choice, {
        requirements: ['dismiss:notoriety:1d6'],
        check: checked(false),
      }),
    );
    fireEvent.click(card('Team to dismiss', 'Tunnel rats'));
    expect(lastChoice(edit)).toEqual({ ...choice, targetTeamId: 'moles' });
    expect(screen.getByText(/1d6 · total of the dice only/)).toBeVisible();
    expect(screen.getByText(/Rolled if the check fails/)).toBeVisible();
    fireEvent.change(screen.getByRole('textbox', { name: 'Notoriety roll' }), {
      target: { value: '4' },
    });
    expect(lastChoice(edit)).toEqual({
      ...choice,
      rolls: { notoriety: total(6, 1, 4) },
    });
  });
});

describe('shared fields', () => {
  test('[rules.ACT-11.detail-cost] an entered zero cost wins over the calculated cost, which stays explained', () => {
    const choice: StagedActionChoice = {
      choiceId: 'drill',
      actionId: 'drill_militia',
      costCopper: 0,
    };
    open(facts(choice, { calculatedCostCopper: 4000 }));
    expect(screen.getByRole('textbox', { name: 'Cost (copper)' })).toHaveValue(
      '0',
    );
    expect(screen.getByText('Calculated: 4000 cp')).toBeVisible();
  });

  test('[rules.ACT-12.training-modifiers] a Drill training roll keeps its table modifiers editable without a second Add modifier control', async () => {
    const training: RawRoll = {
      ...total(6, 2, 7),
      modifiers: [{ sourceId: 'custom:a', value: 1, reason: 'Veteran drill' }],
    };
    const choice: StagedActionChoice = {
      choiceId: 'drill',
      actionId: 'drill_militia',
      rolls: { check: total(20, 1, 12), training },
    };
    const { edit } = open(facts(choice, { check: checked(true) }));
    expect(
      screen.getAllByRole('button', { name: 'Add modifier' }),
    ).toHaveLength(1);
    expect(screen.queryByText(/kept with the roll/)).toBeNull();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Remove training roll modifier Veteran drill',
      }),
    );
    expect(lastChoice(edit)).toEqual({
      ...choice,
      rolls: { ...choice.rolls, training: { ...training, modifiers: [] } },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Add training roll modifier' }),
    );
    const roll = within(screen.getByRole('group', { name: 'Training' }));
    fireEvent.change(roll.getByRole('textbox', { name: 'Value' }), {
      target: { value: '-1' },
    });
    fireEvent.change(roll.getByRole('textbox', { name: 'Reason' }), {
      target: { value: 'Rain' },
    });
    fireEvent.click(roll.getByRole('button', { name: 'Add modifier' }));
    await waitFor(() =>
      expect(lastChoice(edit)).toMatchObject({
        rolls: {
          training: {
            modifiers: [
              training.modifiers[0],
              {
                sourceId: expect.stringMatching(/^custom:/),
                value: -1,
                reason: 'Rain',
              },
            ],
          },
        },
      }),
    );
  });

  test('[rules.ACT-12.detail-rolls] Drill shows its training and notoriety rolls only while the entered check meets their conditions, and announces each as it appears', () => {
    const choice = (
      check?: number,
    ): Extract<StagedActionChoice, { actionId: 'drill_militia' }> => ({
      choiceId: 'drill',
      actionId: 'drill_militia',
      rolls: {
        ...(check === undefined ? {} : { check: total(20, 1, check) }),
        notoriety: total(6, 1, 4),
        training: total(6, 2, 7),
      },
    });
    const { edit, rerender } = open(facts(choice(), { check: checked(null) }));
    const details = () =>
      screen.getByRole('region', { name: 'Action Slot 1 details' });
    const liveRegion = () => details().querySelector('[aria-live="polite"]');
    const textbox = (name: string) =>
      within(details()).queryByRole('textbox', { name });
    const show = (check: number, succeeded: boolean) =>
      rerender(
        <ActivityView
          view={facts(choice(check), { check: checked(succeeded) })}
          edit={edit}
          disabled={false}
        />,
      );
    // No check yet: both kept rolls stay hidden and nothing is announced.
    expect(textbox('Training roll')).toBeNull();
    expect(textbox('Notoriety roll')).toBeNull();
    expect(liveRegion()).toBeInTheDocument();
    expect(liveRegion()).toHaveTextContent('');
    show(12, true);
    expect(textbox('Training roll')).toHaveValue('7');
    expect(textbox('Notoriety roll')).toBeNull();
    expect(liveRegion()).toHaveTextContent(
      'The check succeeds: enter the Training roll.',
    );
    show(1, false);
    expect(textbox('Training roll')).toBeNull();
    const notoriety = textbox('Notoriety roll');
    expect(notoriety).toHaveValue('4');
    expect(
      screen.getByText('Rolled on a natural 1: Notoriety rises by the roll.'),
    ).toBeVisible();
    expect(liveRegion()).toHaveTextContent(
      'The check is a natural 1: enter the Notoriety roll.',
    );
    expect(notoriety).not.toHaveFocus();
    fireEvent.change(notoriety!, { target: { value: '2' } });
    expect(lastChoice(edit)).toEqual({
      ...choice(1),
      rolls: { ...choice(1).rolls, notoriety: total(6, 1, 2) },
    });
    // A natural 1 can still succeed: both show, Training first.
    show(1, true);
    expect(
      textbox('Training roll')!.compareDocumentPosition(
        textbox('Notoriety roll')!,
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    show(9, false);
    expect(textbox('Training roll')).toBeNull();
    expect(textbox('Notoriety roll')).toBeNull();
    expect(liveRegion()).toHaveTextContent('');
  });

  test('[rules.ACT-12.consumable-edit] a consumable is added from the available bonuses and a missing one is removed on its own', () => {
    const choice: StagedActionChoice = {
      choiceId: 'earn',
      actionId: 'earn_gold',
      consumableIds: ['spent'],
    };
    const { edit } = open(
      facts(
        choice,
        {},
        { bonuses: [{ value: 'map', label: 'Map: +1 Secrecy' }] },
      ),
    );
    expect(screen.getByText('Missing')).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove consumable Missing bonus' }),
    );
    expect(lastChoice(edit)).toEqual({
      choiceId: 'earn',
      actionId: 'earn_gold',
    });
  });

  test('[rules.WEEK-10.detail-confirmation] Confirmation disables every people and team detail control', () => {
    open(
      facts(
        {
          choiceId: 'rescue',
          actionId: 'rescue_character',
          characterId: 'ameiko',
        },
        {},
      ),
      true,
    );
    const details = screen.getByRole('region', {
      name: 'Action Slot 1 details',
    });
    for (const radio of within(details).getAllByRole('radio'))
      expect(radio).toBeDisabled();
    for (const button of within(details).getAllByRole('button'))
      expect(button).toBeDisabled();
    for (const box of within(details).getAllByRole('textbox'))
      expect(box).toBeDisabled();
  });
});
