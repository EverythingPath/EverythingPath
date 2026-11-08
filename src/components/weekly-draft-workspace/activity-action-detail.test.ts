import { describe, expect, test } from 'vitest';
import { foundationWeek } from '../../../tests/rules/foundation-acceptance-fixtures';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import type { StagedActionChoice } from '~/lib/weekly-draft-facts';
import { activityView } from './activity-facts';
import { actionDetail, type ActionDetail } from './activity-action-detail';
import { activityFacts, activitySlot } from './activity-view-fixture';
import type { ActivityTeamFact, ActivityView } from './types';

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

// Rank 3 with Upkeep complete, one PC ("Ameiko", level 20) and the settlement
// Phaendar; `place` stages choices before the projection runs.
function week() {
  const input = foundationWeek(3);
  input.militiaSnapshot.settlements.push({
    settlementId: 'phaendar',
    name: 'Phaendar',
    reputation: 'Unfriendly',
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
function detailAt(view: ActivityView, index: number) {
  return actionDetail(view, view.slots[index]!)!;
}
function narrow<Id extends ActionDetail['actionId']>(
  detail: ActionDetail,
  actionId: Id,
) {
  if (detail.actionId !== actionId) throw new Error(`Expected ${actionId}`);
  return detail as Extract<ActionDetail, { actionId: Id }>;
}
const roster = (overrides: Partial<ActivityTeamFact>[]): ActivityTeamFact[] =>
  overrides.map((entry, index) => ({
    teamId: `team-${index}`,
    name: `Team ${index}`,
    teamType: 'moles',
    typeName: 'Moles',
    tier: 1,
    condition: 'active',
    unavailable: false,
    recruitedInSlot: null,
    ...entry,
  }));

describe('rule facts at the slot position', () => {
  test('[rules.ACT-10.officer-position] an earlier Change Officer Role shows in the roles a later slot sees, never in its own', () => {
    const { view, place } = week();
    place(0, {
      choiceId: 'appoint',
      actionId: 'change_officer_role',
      characterId: 'pc',
      toRole: 'strategist',
    });
    place(1, {
      choiceId: 'swap',
      actionId: 'change_officer_role',
      characterId: 'pc',
    });
    const facts = view();
    expect(facts.slots[0]!.position?.officers).toEqual([]);
    expect(facts.slots[1]!.position?.officers).toEqual([
      { characterId: 'pc', role: 'strategist' },
    ]);
    const first = narrow(detailAt(facts, 0), 'change_officer_role');
    expect(first.heldRoles).toEqual([]);
    expect(first.characters).toEqual([
      expect.objectContaining({
        value: 'pc',
        label: 'Ameiko',
        description: 'No officer role',
      }),
    ]);
    const second = narrow(detailAt(facts, 1), 'change_officer_role');
    expect(second.heldRoles).toEqual(['strategist']);
    expect(second.characters[0]!.description).toBe('Strategist');
    // Only the held role is offered first to leave; it is already held to take.
    expect(second.fromRoles[0]).toMatchObject({
      value: 'strategist',
      eligible: true,
      description: 'Held now',
    });
    expect(second.fromRoles.slice(1).every((role) => !role.eligible)).toBe(
      true,
    );
    expect(second.fromRoles).toHaveLength(6);
    // Keeping Strategist, any other role would be a second one.
    expect(second.toRoles[0]).toMatchObject({
      value: 'ambassador',
      eligible: false,
      description: 'A second role',
    });
    expect(second.toRoles.at(-1)).toMatchObject({
      value: 'strategist',
      eligible: false,
      description: 'Already held',
    });
  });

  test('[rules.ACT-10.rescue-position] Rescue offers headquarters and refuges, marking one activated earlier this Activity, with the rules level and capture state', () => {
    const { input, view, place } = week();
    input.militiaSnapshot.roster.teams.push(
      team('scholars', 'scholars'),
      team('guardians', 'guardians'),
    );
    input.militiaSnapshot.characterActions = {
      people: [
        {
          characterId: 'pc',
          status: 'captured',
          location: { kind: 'headquarters' },
          directRescueRequired: false,
          capture: { source: 'ordinary', week: 39 },
        },
      ],
    };
    place(0, {
      choiceId: 'refuge',
      actionId: 'activate_refuge',
      teamId: 'scholars',
      settlementId: 'phaendar',
    });
    place(1, {
      choiceId: 'rescue',
      actionId: 'rescue_character',
      teamId: 'guardians',
      characterId: 'pc',
    });
    const facts = view();
    expect(facts.slots[1]!.position?.refugeSettlementIds).toEqual(['phaendar']);
    const rescue = narrow(detailAt(facts, 1), 'rescue_character');
    expect(rescue.ruleLevel).toBe(20);
    expect(rescue.characters).toEqual([
      expect.objectContaining({
        value: 'pc',
        description: 'Level 20 · Captured',
        eligible: true,
      }),
    ]);
    expect(rescue.destinations.map((entry) => entry.value)).toEqual([
      'headquarters',
      'refuge:phaendar',
    ]);
    expect(rescue.destinations[1]).toMatchObject({
      label: 'Refuge in Phaendar',
      description: 'Active refuge',
      eligible: true,
    });
    // At the refuge's own slot it is not yet active.
    place(0, null);
    expect(
      narrow(detailAt(view(), 1), 'rescue_character').destinations[1],
    ).toMatchObject({
      eligible: false,
      description: 'No active refuge this week',
    });
  });
});

describe('option lists', () => {
  test('[rules.ACT-10.recruit] Recruit Team lists recruitable types first with the table’s check and DC, and asks for a table check only without recruitment rules', () => {
    const recruit = (
      choice: Partial<
        Extract<StagedActionChoice, { actionId: 'recruit_team' }>
      > = {},
    ) =>
      narrow(
        actionDetail(
          activityFacts([]),
          activitySlot({
            choiceId: 'recruit',
            actionId: 'recruit_team',
            ...choice,
          }),
        )!,
        'recruit_team',
      );
    const detail = recruit();
    expect(detail.recruitment).toEqual({ kind: 'none' });
    const moles = detail.teamTypes.find((entry) => entry.value === 'moles');
    expect(moles).toMatchObject({
      label: 'Moles',
      description: 'Tier 1 · Secrecy DC 15',
      eligible: true,
    });
    const firstIneligible = detail.teamTypes.findIndex(
      (entry) => !entry.eligible,
    );
    expect(
      detail.teamTypes.slice(firstIneligible).every((entry) => !entry.eligible),
    ).toBe(true);
    expect(
      detail.teamTypes.find((entry) => entry.value === 'spies'),
    ).toMatchObject({ description: 'Tier 3 · No recruitment rules' });
    expect(recruit({ teamType: 'moles' }).recruitment).toEqual({
      kind: 'rules',
      check: 'secrecy',
      dc: 15,
    });
    expect(recruit({ teamType: 'spies' }).recruitment).toEqual({
      kind: 'table',
    });
    // A recorded table check stays visible when the rules replace it.
    expect(
      recruit({
        teamType: 'moles',
        recruitmentCheck: { check: 'loyalty', dc: 12 },
      }).recruitment,
    ).toEqual({ kind: 'retained', rules: { check: 'secrecy', dc: 15 } });
    expect(
      recruit({ recruitmentCheck: { check: 'loyalty', dc: 12 } }).recruitment,
    ).toEqual({ kind: 'table' });
  });

  test('[rules.ACT-10.upgrade] Upgrade Team offers free teams with an upgrade path first and destinations on that path with their rules cost', () => {
    const teams = roster([
      { teamId: 'moles', name: 'Moles A' },
      { teamId: 'busy', name: 'Busy moles' },
      {
        teamId: 'spies',
        name: 'Spies',
        teamType: 'spies',
        typeName: 'Spies',
        tier: 3,
      },
      { teamId: 'later', name: 'Later', recruitedInSlot: 3 },
    ]);
    const facts = activityFacts(
      [
        activitySlot({
          choiceId: 'upgrade',
          actionId: 'upgrade_team',
          targetTeamId: 'moles',
        }),
        activitySlot(
          { choiceId: 'act', actionId: 'earn_gold', teamId: 'busy' },
          { slotId: 'two', number: 2 },
        ),
      ],
      { teamRoster: teams },
    );
    const detail = narrow(
      actionDetail(facts, facts.slots[0]!)!,
      'upgrade_team',
    );
    expect(
      detail.targets.map((entry) => [entry.value, entry.eligible]),
    ).toEqual([
      ['moles', true],
      ['busy', false],
      ['spies', false],
      ['later', false],
    ]);
    expect(detail.targets[1]!.description).toBe(
      'Moles 1 · Acts in Action Slot 2',
    );
    expect(detail.targets[3]!.description).toBe(
      'Moles 1 · Recruited later, in Action Slot 3',
    );
    expect(detail.destinations[0]).toMatchObject({
      value: 'propagandists',
      eligible: true,
      description: 'Tier 2 · 250 gp',
    });
    expect(detail.destinations.filter((entry) => entry.eligible)).toHaveLength(
      1,
    );
    // The team's own type stays listed, so a recorded one never disappears.
    expect(
      detail.destinations.find((entry) => entry.value === 'moles'),
    ).toMatchObject({ eligible: false, missing: false });
  });

  test('[rules.ACT-10.missing-reference] a recorded team, character or refuge that is gone stays listed as missing, never renamed', () => {
    const facts = activityFacts([], {
      characters: [{ characterId: 'pc', name: 'Ameiko', level: 5 }],
      settlements: [{ value: 'town', label: 'Town' }],
    });
    const dismiss = narrow(
      actionDetail(
        facts,
        activitySlot({
          choiceId: 'dismiss',
          actionId: 'dismiss_team',
          targetTeamId: 'gone',
        }),
      )!,
      'dismiss_team',
    );
    expect(dismiss.targets).toEqual([
      {
        value: 'gone',
        label: 'Missing team',
        description: 'No longer on the roster',
        eligible: false,
        missing: true,
      },
    ]);
    const rescue = narrow(
      actionDetail(
        facts,
        activitySlot({
          choiceId: 'rescue',
          actionId: 'rescue_character',
          characterId: 'lost',
          destination: { kind: 'refuge', settlementId: 'razed' },
        }),
      )!,
      'rescue_character',
    );
    expect(rescue.characters[0]).toMatchObject({
      value: 'lost',
      label: 'Missing character',
      missing: true,
    });
    expect(rescue.ruleLevel).toBeNull();
    expect(rescue.destinations[0]).toMatchObject({
      value: 'refuge:razed',
      label: 'Refuge in a missing settlement',
      missing: true,
    });
  });

  test('[rules.ACT-10.restore] Restore Character lists all seven modes with their scope and scroll cost from the rules', () => {
    const detail = narrow(
      actionDetail(
        activityFacts([]),
        activitySlot({
          choiceId: 'restore',
          actionId: 'restore_character',
          mode: 'raise_dead',
        }),
      )!,
      'restore_character',
    );
    expect(detail.scope).toBe('individual');
    expect(detail.modes.map((mode) => [mode.label, mode.description])).toEqual([
      ['Ability Damage', 'Every player character'],
      ['Hit Points', 'Every player character'],
      ['Restorative Effect', 'Every player character'],
      ['Break Enchantment', 'One character · scroll 1,125 gp'],
      ['Raise Dead', 'One character · scroll 6,125 gp'],
      ['Restoration', 'One character · scroll 1,700 gp'],
      ['Stone To Flesh', 'One character · scroll 1,650 gp'],
    ]);
  });
});

describe('rolls and consumables', () => {
  test('[rules.ACT-12.detail-rolls] each conditional roll shows only while the entered check meets its rules condition, with when the rules use it; Lie Low has none', () => {
    const d20 = (diceTotal: number) => ({
      sides: 20,
      diceCount: 1,
      diceTotal,
      provenance: { kind: 'table' as const },
      modifiers: [],
    });
    const d6 = { ...d20(4), sides: 6 };
    // `succeeded` is the rules' reading of the check: null while undecided.
    const rolls = (
      choice: StagedActionChoice,
      succeeded: boolean | null,
      requirements: string[] = [],
    ) =>
      actionDetail(
        activityFacts([]),
        activitySlot(choice, {
          requirements,
          check: {
            spec: { count: 1, sides: 20 },
            organizationCheck: 'loyalty',
            dc: 13,
            modifier: 0,
            total: succeeded === null ? null : succeeded ? 15 : 1,
            succeeded,
            breakdown: [],
          },
        }),
      )!.rolls;
    const drill = (check?: number): StagedActionChoice => ({
      choiceId: 'drill',
      actionId: 'drill_militia',
      rolls: {
        ...(check === undefined ? {} : { check: d20(check) }),
        notoriety: d6,
        training: { ...d6, diceCount: 2, diceTotal: 7 },
      },
    });
    const training = {
      field: 'training',
      label: 'Training',
      spec: { count: 2, sides: 6 },
      when: expect.stringContaining('check succeeds'),
      shownBecause: 'The check succeeds',
      required: true,
    };
    const notoriety = {
      field: 'notoriety',
      label: 'Notoriety',
      spec: { count: 1, sides: 6 },
      when: expect.stringContaining('natural 1'),
      shownBecause: 'The check is a natural 1',
      required: true,
    };
    // No check yet: neither roll shows, though both values are kept.
    expect(rolls(drill(), null)).toEqual([]);
    // A success shows Training only; the kept notoriety value stays hidden.
    expect(rolls(drill(15), true, ['drill:training:2d6'])).toEqual([training]);
    // A natural 1 that still succeeds shows both.
    expect(
      rolls(drill(1), true, ['drill:training:2d6', 'drill:notoriety:1d6']),
    ).toEqual([training, notoriety]);
    // A natural 1 that fails shows only Notoriety; a failure shows neither.
    expect(rolls(drill(1), false, ['drill:notoriety:1d6'])).toEqual([
      notoriety,
    ]);
    expect(rolls(drill(5), false)).toEqual([]);
    // A failure-only roll shows on a failed check, never on a success or
    // before the rules decide.
    const dismiss: StagedActionChoice = {
      choiceId: 'dismiss',
      actionId: 'dismiss_team',
      rolls: { check: d20(3), notoriety: d6 },
    };
    expect(rolls(dismiss, false)).toEqual([
      expect.objectContaining({
        field: 'notoriety',
        when: expect.stringContaining('check fails'),
        shownBecause: 'The check fails',
      }),
    ]);
    expect(rolls(dismiss, true)).toEqual([]);
    expect(rolls(dismiss, null)).toEqual([]);
    // Earn Gold and Recruit Team read the natural 1 from the die itself.
    for (const actionId of ['earn_gold', 'recruit_team'] as const) {
      const choice = (check: number) =>
        ({
          choiceId: actionId,
          actionId,
          rolls: { check: d20(check) },
        }) as StagedActionChoice;
      expect(rolls(choice(12), true)).toEqual([]);
      expect(rolls(choice(1), true)).toEqual([
        expect.objectContaining({
          field: 'notoriety',
          shownBecause: 'The check is a natural 1',
        }),
      ]);
    }
    const lieLow = actionDetail(
      activityFacts([]),
      activitySlot({ choiceId: 'low', actionId: 'lie_low' }),
    )!;
    expect(lieLow.rolls).toEqual([]);
    expect(lieLow.consumables).toBeNull();
  });

  test('[rules.ACT-12.detail-rolls] against the rules projection, every required roll is shown and a hidden kept roll never changes the outcome', () => {
    const { input, view, place } = week();
    input.militiaSnapshot.treasuryCopper = 1_000_000;
    input.militiaSnapshot.roster.teams.push(
      team('old', 'patrons'),
      team('traders', 'merchants'),
    );
    const d = (sides: number, diceCount: number, diceTotal: number) => ({
      sides,
      diceCount,
      diceTotal,
      provenance: { kind: 'table' as const },
      modifiers: [],
    });
    const choices = (check: number): StagedActionChoice[] => [
      {
        choiceId: 'drill',
        actionId: 'drill_militia',
        rolls: {
          check: d(20, 1, check),
          notoriety: d(6, 1, 5),
          training: d(6, 2, 7),
        },
      },
      // Before its Training roll is entered: the missing roll is itself a
      // requirement, so it must show from the check alone.
      {
        choiceId: 'fresh-drill',
        actionId: 'drill_militia',
        rolls: { check: d(20, 1, check) },
      },
      {
        choiceId: 'dismiss',
        actionId: 'dismiss_team',
        targetTeamId: 'old',
        rolls: { check: d(20, 1, check), notoriety: d(6, 1, 5) },
      },
      {
        choiceId: 'earn',
        actionId: 'earn_gold',
        teamId: 'traders',
        rolls: { check: d(20, 1, check), notoriety: d(6, 1, 5) },
      },
      {
        choiceId: 'recruit',
        actionId: 'recruit_team',
        teamType: 'scholars',
        rolls: { check: d(20, 1, check), notoriety: d(6, 1, 5) },
      },
    ];
    const seen = new Set<string>();
    for (const check of [1, 2, 9, 20])
      for (const choice of choices(check)) {
        place(0, choice);
        const facts = view();
        const slot = facts.slots[0]!;
        const shown = detailAt(facts, 0).rolls.map((roll) => roll.field);
        for (const field of ['training', 'notoriety'] as const)
          if (
            slot.requirements.some((code) =>
              code.startsWith(`${choice.choiceId}:${field}:`),
            )
          )
            expect(shown, `${choice.actionId} ${check} ${field}`).toContain(
              field,
            );
        // Dropping every hidden kept roll leaves the outcome unchanged.
        const outcome = projectWeeklyDraft(input).phases!.activity.outcome;
        const rolls = {
          ...(choice as { rolls: Record<string, unknown> }).rolls,
        };
        for (const field of ['training', 'notoriety'])
          if (!shown.includes(field as 'training')) delete rolls[field];
        place(0, { ...choice, rolls } as StagedActionChoice);
        expect(
          projectWeeklyDraft(input).phases!.activity.outcome,
          `${choice.actionId} ${check}`,
        ).toEqual(outcome);
        for (const field of shown) seen.add(`${choice.actionId}:${field}`);
      }
    // Each conditional roll was shown for some check.
    expect([...seen].sort()).toEqual([
      'dismiss_team:notoriety',
      'drill_militia:notoriety',
      'drill_militia:training',
      'earn_gold:notoriety',
      'recruit_team:notoriety',
    ]);
  });

  test('[rules.ACT-12.consumables] consumables list recorded bonuses, keep a missing one visible and offer the rest', () => {
    const detail = actionDetail(
      activityFacts([], {
        bonuses: [
          { value: 'rumour', label: 'Rumour: +2 Loyalty' },
          { value: 'map', label: 'Map: +1 Secrecy' },
        ],
      }),
      activitySlot({
        choiceId: 'earn',
        actionId: 'earn_gold',
        consumableIds: ['rumour', 'spent'],
      }),
    )!;
    expect(detail.consumables).toEqual({
      selected: [
        { value: 'rumour', label: 'Rumour: +2 Loyalty', missing: false },
        { value: 'spent', label: 'Missing bonus', missing: true },
      ],
      available: [{ value: 'map', label: 'Map: +1 Secrecy' }],
    });
  });

  test('other actions keep the general choice editor', () => {
    expect(
      actionDetail(
        activityFacts([]),
        activitySlot({ choiceId: 'market', actionId: 'broker_market' }),
      ),
    ).toBeNull();
  });
});
