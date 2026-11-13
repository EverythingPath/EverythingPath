import { describe, expect, test } from 'vitest';
import { foundationWeek } from '../../../tests/rules/foundation-acceptance-fixtures';
import { roll } from '../../../tests/rules/upkeep-fixture';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { MILITIA_ACTIVITY_ACTION_IDS } from '~/lib/militia-domain';
import { editWeeklyDraft } from '~/lib/weekly-draft';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import type { StagedActionChoice } from '~/lib/weekly-draft-facts';
import { activityView } from './activity-facts';
import {
  activityMoveTargets,
  activityPickerGroups,
  activityTeamOptions,
  addModifierEdit,
  helpfulAssignEdit,
  helpfulClearEdits,
  moveEdit,
  placeEdit,
  removeModifierEdit,
  teamEdit,
} from './activity-board';

type Team = UpkeepSnapshot['roster']['teams'][number];
const team = (teamId: string, teamType: string, extra: Partial<Team> = {}) =>
  ({
    teamId,
    teamType,
    name: teamId,
    status: 'active',
    managerCharacterId: null,
    rewardCapExempt: false,
    notes: '',
    ...extra,
  }) as Team;

// Rank 3 with Upkeep complete: two actions, plus a third empty slot.
function week(rank = 3) {
  const input = foundationWeek(rank);
  input.revision.activity.slots.push({ slotId: 'three', choice: null });
  input.militiaSnapshot.settlements.push({
    settlementId: 'phaendar',
    name: 'Phaendar',
    reputation: 'Helpful',
    secured: false,
    occupied: false,
    temporaryReputationShift: 0,
    refugeActivatedWeek: null,
    refugeActiveUntilWeek: null,
  });
  const view = () =>
    activityView(
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
        people: [{ characterId: 'pc', name: 'Ameiko' }],
      }),
      projectWeeklyDraft(input),
    );
  const place = (index: number, choice: StagedActionChoice | null) => {
    input.revision.activity.slots[index]!.choice = choice;
  };
  return { input, view, place };
}

describe('allowance and slots', () => {
  test('[rules.ACT-09.allowance] the header and slots show the rules-derived allowance, sequential Strategist facts and excess slots', () => {
    const { input, view, place } = week();
    let facts = view();
    expect(facts.allowance).toMatchObject({
      occupied: 0,
      actions: 2,
      rank: 3,
      rankActions: 2,
      strategist: false,
      changes: [],
      removalBlocked: null,
    });
    expect(facts.slots.map((slot) => [slot.number, slot.removable])).toEqual([
      [1, false],
      [2, false],
      [3, true],
    ]);
    expect(facts.slots[2]!.status).toEqual({ kind: 'empty' });
    // An officer change in slot 1 adds the Strategist action from slot 2 on.
    input.militiaSnapshot.roster.officers = [
      { role: 'ambassador', characterId: 'pc' },
    ];
    place(0, {
      choiceId: 'role',
      actionId: 'change_officer_role',
      characterId: 'pc',
      fromRole: 'ambassador',
      toRole: 'strategist',
    });
    facts = view();
    expect(facts.allowance).toMatchObject({
      occupied: 1,
      actions: 3,
      strategist: true,
      changes: [{ slotNumber: 2, allowance: 3 }],
    });
    expect(facts.slots.map((slot) => slot.strategistBonus)).toEqual([
      false,
      false,
      true,
    ]);
    expect(facts.slots[2]!.removable).toBe(false);
    expect(facts.slots[0]!.status).toEqual({ kind: 'ready' });
    // Losing the allowance keeps the retained choice, warns, and never
    // offers removal of an occupied slot.
    place(0, null);
    place(2, { choiceId: 'drill', actionId: 'drill_militia' });
    facts = view();
    expect(facts.slots[2]).toMatchObject({
      overAllowance: true,
      beyondAllowance: true,
      removable: false,
      status: { kind: 'todo' },
      choice: { choiceId: 'drill' },
    });
    expect(facts.slots[2]!.issues.map((issue) => issue.code)).toContain(
      'drill:action-capacity',
    );
  });

  test('[rules.ACT-19.facts] extra slots offer removal only once Upkeep settles the rank', () => {
    const { input, view } = week();
    input.revision.upkeep.rolls = {};
    const facts = view();
    expect(facts.allowance.removalBlocked).toBe('upkeep');
    expect(facts.slots.every((slot) => !slot.removable)).toBe(true);
  });
});

describe('picker', () => {
  test('[rules.ACT-01.picker] every Activity action is a card, grouped by current team readiness as guidance', () => {
    const { input, view, place } = week();
    input.militiaSnapshot.roster.teams = [
      team('Whisper Net', 'informants'),
      team('Quill', 'scholars', { status: 'disabled' }),
    ];
    let groups = activityPickerGroups(view(), 'one');
    expect(groups.map((group) => group.title)).toEqual([
      'A ready team can take these',
      'No team needed',
      'No ready team (needs a Rules Exception)',
    ]);
    expect(
      groups
        .flatMap((group) => group.cards.map((card) => card.actionId))
        .sort(),
    ).toEqual([...MILITIA_ACTIVITY_ACTION_IDS].sort());
    const card = (actionId: string) =>
      groups
        .flatMap((group) =>
          group.cards.map((entry) => ({ group: group.id, ...entry })),
        )
        .find((entry) => entry.actionId === actionId)!;
    expect(card('gather_information')).toMatchObject({
      group: 'ready-team',
      note: 'Ready: Whisper Net',
    });
    // A disabled Scholars team is not ready; the card stays available.
    expect(card('knowledge_check')).toMatchObject({
      group: 'needs-exception',
      note: 'Needs a ready Scholars team',
    });
    for (const actionId of [
      'drill_militia',
      'change_officer_role',
      'recruit_team',
      'dismiss_team',
      'upgrade_team',
      'lie_low',
      'special',
      'guarantee_event',
    ])
      expect(card(actionId).group).toBe('no-team');
    // The team acting in another slot is no longer ready for this one.
    place(1, {
      choiceId: 'gold',
      actionId: 'gather_information',
      teamId: 'Whisper Net',
    });
    place(0, { choiceId: 'drill', actionId: 'drill_militia' });
    groups = activityPickerGroups(view(), 'three');
    expect(card('gather_information').group).toBe('needs-exception');
    expect(card('drill_militia').note).toBe(
      'Already chosen in Action Slot 1 (once per Activity).',
    );
  });
});

describe('teams', () => {
  test('[rules.ACT-10.teams] eligible ready teams come first; other teams keep their usage and condition, and staged recruits follow order', () => {
    const { input, view, place } = week();
    input.militiaSnapshot.roster.teams = [
      team('Whisper Net', 'informants'),
      team('Second Ear', 'informants'),
      team('Quill', 'scholars', { status: 'disabled' }),
      team('Lost', 'informants', { status: 'missing' }),
    ];
    place(0, {
      choiceId: 'recruit',
      actionId: 'recruit_team',
      teamType: 'informants',
    });
    place(1, {
      choiceId: 'gather',
      actionId: 'gather_information',
      teamId: 'Second Ear',
    });
    place(2, { choiceId: 'other', actionId: 'gather_information' });
    const options = activityTeamOptions(view(), 'three');
    expect(options.eligible.map((option) => option.name)).toEqual([
      'Whisper Net',
      'Informants',
    ]);
    expect(options.eligible[1]!.detail).toBe(
      'Informants 1 · Recruited in Action Slot 1',
    );
    expect(
      Object.fromEntries(
        options.other.map((option) => [option.name, option.detail]),
      ),
    ).toEqual({
      'Second Ear': 'Informants 1 · Acts in Action Slot 2',
      Quill: 'Scholars 3 · Disabled',
      Lost: 'Informants 1 · Missing',
    });
    // A reference to a team that no longer exists stays visible as missing.
    place(2, {
      choiceId: 'other',
      actionId: 'gather_information',
      teamId: 'gone',
    });
    expect(view().slots[2]!.team).toEqual({ teamId: 'gone', name: null });
    const edit = teamEdit(view().slots[2]!, null);
    expect(edit).toEqual({
      kind: 'detail',
      slotId: 'three',
      choiceId: 'other',
      choice: { choiceId: 'other', actionId: 'gather_information' },
    });
  });
});

test('[rules.ACT-10.optional-team] Special takes an optional team of any ready type', () => {
  const { input, view, place } = week();
  input.militiaSnapshot.roster.teams = [
    team('Whisper Net', 'informants'),
    team('Quill', 'scholars', { status: 'disabled' }),
  ];
  place(0, { choiceId: 'task', actionId: 'special' });
  const options = activityTeamOptions(view(), 'one');
  expect(options.eligible.map((option) => option.name)).toEqual([
    'Whisper Net',
  ]);
  expect(options.other.map((option) => option.name)).toEqual(['Quill']);
});

describe('checks and modifiers', () => {
  test('[rules.ACT-13.breakdown] the check shows its calculated bonus, total and breakdown without folding the bonus into the dice', () => {
    const { input, view, place } = week();
    input.militiaSnapshot.roster.teams = [team('Whisper Net', 'informants')];
    input.revision.activity.operatingSettlementId = 'phaendar';
    place(0, {
      choiceId: 'gather',
      actionId: 'gather_information',
      teamId: 'Whisper Net',
      rolls: {
        check: {
          ...roll(20, 11),
          modifiers: [
            { sourceId: 'helpful', value: 2, reason: 'Helpful' },
            { sourceId: 'custom:rain', value: -1, reason: 'Heavy rain' },
            { sourceId: 'officers', value: 5, reason: 'Stale copy' },
            { sourceId: 'pc', value: 3, reason: 'Legacy source' },
          ],
        },
      },
    });
    const slot = view().slots[0]!;
    expect(slot.check).toMatchObject({
      spec: { count: 1, sides: 20 },
      organizationCheck: 'secrecy',
      dc: 15,
    });
    const labels = Object.fromEntries(
      slot.check!.breakdown.map((entry) => [entry.label, entry.value]),
    );
    expect(labels).toMatchObject({
      'Rank and focus': expect.any(Number),
      Officers: expect.any(Number),
      'Team tier': 2,
      'Helpful (Phaendar)': 2,
      'Heavy rain': -1,
    });
    expect(slot.check!.total).toBe(11 + slot.check!.modifier!);
    expect(
      slot.modifiers.map((entry) => [entry.kind, entry.warning !== null]),
    ).toEqual([
      ['helpful', false],
      ['custom', false],
      ['automatic', true],
      ['unknown', true],
    ]);
    expect(view().helpful).toEqual({
      settlementName: 'Phaendar',
      usedIn: [{ slotId: 'one', slotNumber: 1 }],
    });
  });

  test('[rules.ACT-12.helpful-move] Helpful moves by clearing other checks first, then assigning once, keeping every unrelated field', () => {
    const { input, view, place } = week();
    input.militiaSnapshot.roster.teams = [
      team('Whisper Net', 'informants'),
      team('Coins', 'merchants'),
    ];
    input.revision.activity.operatingSettlementId = 'phaendar';
    const rain = { sourceId: 'custom:rain', value: -1, reason: 'Heavy rain' };
    place(0, {
      choiceId: 'gather',
      actionId: 'gather_information',
      teamId: 'Whisper Net',
      subject: 'Patrols',
      rolls: {
        check: {
          ...roll(20, 11),
          modifiers: [
            { sourceId: 'helpful', value: 2, reason: 'Helpful' },
            rain,
          ],
        },
      },
    });
    place(1, {
      choiceId: 'gold',
      actionId: 'earn_gold',
      teamId: 'Coins',
      rolls: { check: roll(20, 9) },
    });
    const facts = view();
    const clears = helpfulClearEdits(facts, 'two');
    expect(clears).toEqual([
      {
        slotNumber: 1,
        edit: {
          kind: 'detail',
          slotId: 'one',
          choiceId: 'gather',
          choice: {
            choiceId: 'gather',
            actionId: 'gather_information',
            teamId: 'Whisper Net',
            subject: 'Patrols',
            rolls: { check: { ...roll(20, 11), modifiers: [rain] } },
          },
        },
      },
    ]);
    // Apply the clear, then build the assignment from the fresh facts.
    const cleared = editWeeklyDraft(input.revision, clears[0]!.edit);
    if (!cleared.ok) throw new Error(cleared.error);
    input.revision = cleared.draft;
    expect(view().helpful?.usedIn).toEqual([]);
    expect(helpfulAssignEdit(view(), 'two')).toMatchObject({
      kind: 'detail',
      slotId: 'two',
      choice: {
        teamId: 'Coins',
        rolls: {
          check: {
            diceTotal: 9,
            diceCount: 1,
            modifiers: [
              {
                sourceId: 'helpful',
                value: 2,
                reason: 'Helpful settlement support (Phaendar)',
              },
            ],
          },
        },
      },
    });
    // Without a Helpful operating settlement nothing is offered.
    input.revision.activity.operatingSettlementId = undefined;
    expect(view().helpful).toBeNull();
    expect(helpfulAssignEdit(view(), 'two')).toBeNull();
  });

  test('[rules.ACT-12.modifiers] adding and removing a modifier edits only that entry of the recorded check roll', () => {
    const { view, place } = week();
    const legacy = { sourceId: 'mystery', value: 4, reason: 'Old note' };
    place(0, {
      choiceId: 'drill',
      actionId: 'drill_militia',
      rolls: { check: { ...roll(20, 10), modifiers: [legacy] } },
    });
    const slot = view().slots[0]!;
    const custom = { sourceId: 'custom:x', value: -3, reason: 'Storm' };
    expect(addModifierEdit(slot, custom)).toMatchObject({
      choice: { rolls: { check: { modifiers: [legacy, custom] } } },
    });
    expect(removeModifierEdit(slot, 0)).toMatchObject({
      choice: {
        rolls: { check: { diceTotal: 10, diceCount: 1, modifiers: [] } },
      },
    });
    place(0, { choiceId: 'drill', actionId: 'drill_militia' });
    expect(addModifierEdit(view().slots[0]!, custom)).toBeNull();
  });
});

describe('placement', () => {
  test('[rules.ACT-04.move] moving and swapping carry whole choices; placing creates fresh identities', () => {
    const { view, place } = week();
    place(0, { choiceId: 'drill', actionId: 'drill_militia', costCopper: 0 });
    place(1, { choiceId: 'low', actionId: 'lie_low' });
    const facts = view();
    expect(activityMoveTargets(facts, 'one')).toEqual([
      {
        slotId: 'two',
        kind: 'swap',
        label: 'Swap with Action Slot 2 · Lie Low',
      },
      { slotId: 'three', kind: 'move', label: 'Action Slot 3 (empty)' },
    ]);
    expect(moveEdit(facts.slots[0]!, facts.slots[1]!)).toEqual({
      kind: 'swap',
      fromSlotId: 'one',
      toSlotId: 'two',
      choiceId: 'drill',
      otherChoiceId: 'low',
    });
    expect(moveEdit(facts.slots[0]!, facts.slots[2]!)).toEqual({
      kind: 'move',
      fromSlotId: 'one',
      toSlotId: 'three',
      choiceId: 'drill',
    });
    const replaced = placeEdit(facts.slots[0]!, 'special_order', 21);
    expect(replaced).toMatchObject({
      kind: 'replace',
      slotId: 'one',
      choiceId: 'drill',
      choice: {
        actionId: 'special_order',
        orderId: expect.any(String),
        orderedDay: 21,
      },
    });
    expect(placeEdit(facts.slots[2]!, 'lie_low', 21)).toMatchObject({
      kind: 'stage',
      slotId: 'three',
      choice: { actionId: 'lie_low' },
    });
  });

  test('[rules.ACT-18.operating] a recorded operating settlement that no longer exists stays visible as missing', () => {
    const { input, view } = week();
    input.revision.activity.operatingSettlementId = 'vanished';
    expect(view().operating).toMatchObject({
      selected: 'vanished',
      missing: true,
      choices: [
        { value: 'phaendar', label: 'Phaendar', reputation: 'Helpful' },
      ],
    });
  });
});
