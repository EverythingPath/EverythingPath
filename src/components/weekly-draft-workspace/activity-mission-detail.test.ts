import { describe, expect, test } from 'vitest';
import { foundationWeek } from '../../../tests/rules/foundation-acceptance-fixtures';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { immediatelyFollowingChoiceId } from '~/lib/rules-event-actions';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import type { StagedActionChoice } from '~/lib/weekly-draft-facts';
import { editWeeklyDraft } from '~/lib/weekly-draft';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import { phaseView } from './phase-view';
import { missionDetail, type MissionDetail } from './activity-mission-detail';
import type { ActivityView } from './types';

type Team = UpkeepSnapshot['roster']['teams'][number];
type Settlement = UpkeepSnapshot['settlements'][number];
const team = (teamId: string, teamType: string): Team =>
  ({
    teamId,
    teamType,
    name: teamId,
    status: 'active',
    managerCharacterId: null,
    rewardCapExempt: false,
    notes: '',
  }) as Team;
const settlement = (
  settlementId: string,
  extra: Partial<Settlement> = {},
): Settlement => ({
  settlementId,
  name: settlementId[0]!.toUpperCase() + settlementId.slice(1),
  reputation: 'Unfriendly',
  secured: false,
  occupied: false,
  temporaryReputationShift: 0,
  refugeActivatedWeek: null,
  refugeActiveUntilWeek: null,
  ...extra,
});

// Rank 3 with Upkeep complete, four Action Slots, one PC and the teams every
// mission action here needs; `place` stages choices before the projection.
function week() {
  const input = foundationWeek(3);
  input.militiaSnapshot.roster.teams.push(
    team('spies', 'spies'),
    team('scholars', 'scholars'),
    team('specialists', 'specialists'),
    team('propagandists', 'propagandists'),
    team('guardians', 'guardians'),
    team('informants', 'informants'),
  );
  while (input.revision.activity.slots.length < 4)
    input.revision.activity.slots.push({
      slotId: `slot-${input.revision.activity.slots.length + 1}`,
      choice: null,
    });
  const source = () =>
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
    });
  const view = () => {
    const facts = phaseView(
      'activity',
      input.revision,
      source(),
      projectWeeklyDraft(input),
    );
    if (facts.phase !== 'activity') throw new Error('Expected Activity');
    return facts;
  };
  const place = (index: number, choice: StagedActionChoice | null) => {
    input.revision.activity.slots[index]!.choice = choice;
  };
  const apply = (edit: WeeklyDraftEdit) => {
    const result = editWeeklyDraft(input.revision, edit);
    if (!result.ok) throw new Error(result.error);
    input.revision = result.draft;
  };
  return { input, view, place, apply };
}
function detailAt(view: ActivityView, index: number) {
  return missionDetail(view, view.slots[index]!)!;
}
// The detail member for `Id`, including members two actions share.
type DetailFor<D, Id> = D extends { actionId: infer A }
  ? Id extends A
    ? D
    : never
  : never;
function narrow<Id extends MissionDetail['actionId']>(
  detail: MissionDetail,
  actionId: Id,
) {
  if (detail.actionId !== actionId) throw new Error(`Expected ${actionId}`);
  return detail as DetailFor<MissionDetail, Id>;
}

describe('Covert Action', () => {
  test('[rules.ACT-10.mission-covert-following] the next staged choice is offered first; a moved reference is never retargeted, and a missing one stays listed', () => {
    const { view, place, apply } = week();
    place(0, {
      choiceId: 'covert',
      actionId: 'covert_action',
      teamId: 'spies',
      mode: 'augment',
      followingChoiceId: 'gather',
    });
    // An empty slot between them does not break "immediately following".
    place(2, {
      choiceId: 'gather',
      actionId: 'gather_information',
      teamId: 'scholars',
    });
    place(3, { choiceId: 'special', actionId: 'special' });
    let covert = narrow(detailAt(view(), 0), 'covert_action');
    expect(covert.uses).toEqual({ following: true, location: false });
    expect(covert.following).toEqual([
      expect.objectContaining({
        value: 'gather',
        label: 'Action Slot 3 · Gather Information',
        description: 'The next choice',
        eligible: true,
      }),
      expect.objectContaining({
        value: 'special',
        description: 'Not the next choice',
        eligible: false,
      }),
    ]);
    expect(view().slots[0]!.requirements).not.toContain(
      'covert:immediately-following-choice',
    );
    // Swapping the augmented choice away keeps the recorded reference; the
    // rules now ask for the next choice again.
    apply({
      kind: 'swap',
      fromSlotId: view().slots[2]!.slotId,
      toSlotId: view().slots[3]!.slotId,
      choiceId: 'gather',
      otherChoiceId: 'special',
    });
    const facts = view();
    covert = narrow(detailAt(facts, 0), 'covert_action');
    expect(facts.slots[0]!.choice).toMatchObject({
      followingChoiceId: 'gather',
    });
    expect(covert.following[0]).toMatchObject({
      value: 'special',
      eligible: true,
    });
    expect(
      covert.following.find((entry) => entry.value === 'gather'),
    ).toMatchObject({ eligible: false, description: 'Not the next choice' });
    expect(facts.slots[0]!.requirements).toContain(
      'covert:immediately-following-choice',
    );
    // Clearing the referenced choice keeps the reference as a missing option.
    place(3, null);
    covert = narrow(detailAt(view(), 0), 'covert_action');
    expect(covert.following[0]).toMatchObject({
      value: 'gather',
      label: 'Missing choice',
      missing: true,
    });
  });

  test('[rules.ACT-10.mission-covert-mode] contact and cache use the location and What happened; augment keeps a recorded location and note visible', () => {
    const { view, place } = week();
    place(0, {
      choiceId: 'covert',
      actionId: 'covert_action',
      teamId: 'spies',
      mode: 'cache',
    });
    let covert = narrow(detailAt(view(), 0), 'covert_action');
    expect(covert.uses).toEqual({ following: false, location: true });
    expect(covert.acknowledgement).toEqual({
      subjectId: 'covert_action:covert',
      description: 'The table’s note of the contact or cache.',
      required: true,
      recorded: null,
    });
    place(0, {
      choiceId: 'covert',
      actionId: 'covert_action',
      teamId: 'spies',
      mode: 'augment',
      location: 'Ruined chapel',
      acknowledgements: [
        {
          acknowledgementId: 'note',
          subjectId: 'covert_action:covert',
          outcome: 'A cache under the altar',
        },
      ],
    });
    covert = narrow(detailAt(view(), 0), 'covert_action');
    expect(covert.uses).toEqual({ following: true, location: false });
    expect(covert.acknowledgement).toMatchObject({
      required: false,
      recorded: {
        acknowledgementId: 'note',
        outcome: 'A cache under the altar',
      },
    });
    place(0, {
      choiceId: 'covert',
      actionId: 'covert_action',
      teamId: 'spies',
      mode: 'augment',
    });
    expect(detailAt(view(), 0).acknowledgement).toBeNull();
  });

  test('[rules.ACT-10.mission-following-rule] the immediately following choice skips empty slots and has none after the last choice', () => {
    const slots = [
      { choice: { choiceId: 'a' } },
      { choice: null },
      { choice: { choiceId: 'b' } },
    ];
    expect(immediatelyFollowingChoiceId(slots, 'a')).toBe('b');
    expect(immediatelyFollowingChoiceId(slots, 'b')).toBeNull();
    expect(immediatelyFollowingChoiceId(slots, 'unknown')).toBeNull();
  });
});

describe('settlement targets at the slot position', () => {
  test('[rules.ACT-10.mission-refuge] Activate Refuge lists Hostile and Unfriendly settlements first and marks an earlier refuge; Reduce Danger lists secured ones first', () => {
    const { input, view, place } = week();
    input.militiaSnapshot.settlements.push(
      settlement('phaendar'),
      settlement('tamran', { reputation: 'Friendly', secured: true }),
    );
    input.militiaSnapshot.roster.teams.push(team('defenders', 'defenders'));
    place(0, {
      choiceId: 'refuge',
      actionId: 'activate_refuge',
      teamId: 'scholars',
      settlementId: 'phaendar',
    });
    place(1, {
      choiceId: 'second',
      actionId: 'activate_refuge',
      teamId: 'guardians',
    });
    place(2, {
      choiceId: 'danger',
      actionId: 'reduce_danger',
      teamId: 'defenders',
      settlementId: 'gone',
    });
    const facts = view();
    expect(narrow(detailAt(facts, 0), 'activate_refuge').settlements).toEqual([
      expect.objectContaining({
        value: 'phaendar',
        description: 'Unfriendly',
        eligible: true,
      }),
      expect.objectContaining({
        value: 'tamran',
        description: 'Friendly',
        eligible: false,
      }),
    ]);
    // The refuge activated in slot 1 shows in slot 2 and still allows
    // renewing it there.
    expect(
      narrow(detailAt(facts, 1), 'activate_refuge').settlements[0],
    ).toMatchObject({
      value: 'phaendar',
      description: 'Indifferent · Refuge active',
      eligible: true,
    });
    const danger = narrow(detailAt(facts, 2), 'reduce_danger');
    expect(danger.settlements.map((entry) => entry.value)).toEqual([
      'gone',
      'tamran',
      'phaendar',
    ]);
    expect(danger.settlements[0]).toMatchObject({
      label: 'Missing settlement',
      missing: true,
    });
    expect(danger.settlements[1]).toMatchObject({
      description: 'Friendly · Secured',
      eligible: true,
    });
    expect(danger.settlements[2]).toMatchObject({
      description: 'Indifferent · Not secured',
      eligible: false,
    });
  });

  test('[rules.ACT-10.mission-propaganda] Spread Propaganda shows each DC from the recorded occupation, marks a settlement already swayed earlier and compares the recorded Occupied answer', () => {
    const { input, view, place } = week();
    input.militiaSnapshot.settlements.push(
      settlement('phaendar', { occupied: true }),
      settlement('tamran', { occupied: null }),
    );
    input.militiaSnapshot.roster.teams.push(team('saboteurs', 'saboteurs'));
    place(0, {
      choiceId: 'first',
      actionId: 'spread_propaganda',
      teamId: 'propagandists',
      settlementId: 'phaendar',
      possible: true,
      acknowledgements: [
        {
          acknowledgementId: 'note',
          subjectId: 'propaganda:first',
          outcome: 'Posters at dawn',
        },
      ],
    });
    place(1, {
      choiceId: 'second',
      actionId: 'spread_propaganda',
      teamId: 'saboteurs',
      settlementId: 'phaendar',
      occupied: false,
    });
    const facts = view();
    const first = narrow(detailAt(facts, 0), 'spread_propaganda');
    expect(first.settlements).toEqual([
      expect.objectContaining({
        value: 'phaendar',
        description: 'Unfriendly · Occupied · DC 25',
        eligible: true,
      }),
      expect.objectContaining({
        value: 'tamran',
        description: 'Unfriendly · Occupation not recorded',
        eligible: false,
      }),
    ]);
    expect(first.acknowledgement).toMatchObject({
      subjectId: 'propaganda:first',
      recorded: { outcome: 'Posters at dawn' },
    });
    expect(facts.slots[0]!.check?.dc).toBe(25);
    const second = narrow(detailAt(facts, 1), 'spread_propaganda');
    expect(
      second.settlements.find((entry) => entry.value === 'phaendar'),
    ).toMatchObject({
      value: 'phaendar',
      description:
        'Unfriendly · Occupied · DC 25 · Already swayed by Action Slot 1 · Spread Propaganda',
      eligible: false,
    });
    expect(second.occupiedRecord).toBe(true);
    expect(second.occupied).toEqual([
      expect.objectContaining({ value: 'true', eligible: true }),
      expect.objectContaining({
        value: 'false',
        description: 'Differs from the settlement’s record',
        eligible: false,
      }),
    ]);
    // GM approval is assumed; a stored Possible answer offers no choice.
    expect(second).not.toHaveProperty('possible');
  });
});

describe('information, Special and Strike Team', () => {
  test('[rules.ACT-10.mission-information] Knowledge Check reads the achieved DC from the check total; each asks for its own What happened', () => {
    const { view, place } = week();
    place(0, {
      choiceId: 'know',
      actionId: 'knowledge_check',
      teamId: 'scholars',
      subject: 'Ironfang siege engines',
      rolls: {
        check: {
          diceTotal: 12,
          diceCount: 1,
          sides: 20,
          provenance: { kind: 'table' },
          modifiers: [],
        },
      },
    });
    place(1, {
      choiceId: 'gather',
      actionId: 'gather_information',
      teamId: 'informants',
    });
    const facts = view();
    const know = narrow(detailAt(facts, 0), 'knowledge_check');
    expect(know.achievedDc).toBe(facts.slots[0]!.check!.total);
    expect(know.achievedDc).toBeGreaterThan(12);
    expect(know.acknowledgement).toMatchObject({
      subjectId: 'knowledge_check:know',
      required: true,
    });
    const gather = narrow(detailAt(facts, 1), 'gather_information');
    expect(gather.achievedDc).toBeNull();
    // Its natural-1 notoriety roll waits for the check.
    expect(gather.rolls).toEqual([]);
    expect(facts.slots[1]!.issues.map((issue) => issue.message)).toContain(
      'Name what the team gathers information about.',
    );
    // An explicit zero cost is the table's cost; the instruction is missing.
    place(0, { choiceId: 'special', actionId: 'special', costCopper: 0 });
    place(1, null);
    const special = view().slots[0]!;
    expect(special.requirements).not.toContain('special:cost');
    expect(special.issues.map((issue) => issue.message)).toContain(
      'Record the GM’s instruction for this action.',
    );
    expect(detailAt(view(), 0).acknowledgement?.subjectId).toBe(
      'special:special',
    );
  });

  test('[rules.ACT-10.mission-strike] Strike Team describes support rounds from the militia rank and the extraction from the rules', () => {
    const { view, place } = week();
    place(0, {
      choiceId: 'strike',
      actionId: 'strike_team',
      teamId: 'specialists',
    });
    const strike = narrow(detailAt(view(), 0), 'strike_team');
    expect(strike.modes).toEqual([
      expect.objectContaining({
        value: 'support',
        description:
          'Next week at the location, each PC gains +2 competence to attack, +2 to damage and +2 to saves for 1 round.',
      }),
      expect.objectContaining({
        value: 'extraction',
        description:
          'Next week at the location, bleeding allies stabilize, dead allies gain gentle repose (CL 12) and bodies are extracted to headquarters.',
      }),
    ]);
    expect(strike.acknowledgement?.subjectId).toBe('strike_team:strike');
  });
});

describe('conditional rolls', () => {
  test('[rules.ACT-12.detail-rolls] a mission notoriety roll shows exactly when the rules read the check as needing it, and a kept value never counts while hidden', () => {
    const { input, view, place } = week();
    input.militiaSnapshot.settlements.push(
      settlement('tamran', { reputation: 'Friendly', secured: true }),
    );
    input.militiaSnapshot.roster.teams.push(team('defenders', 'defenders'));
    const d20 = (diceTotal: number) => ({
      diceTotal,
      diceCount: 1,
      sides: 20,
      provenance: { kind: 'table' as const },
      modifiers: [],
    });
    const notoriety = (sides: number) => ({
      ...d20(2),
      sides,
    });
    const stage = (gather: number, danger: number) => {
      place(0, {
        choiceId: 'gather',
        actionId: 'gather_information',
        teamId: 'informants',
        subject: 'Ironfang scouts',
        rolls: { check: d20(gather), notoriety: notoriety(6) },
      });
      place(1, {
        choiceId: 'danger',
        actionId: 'reduce_danger',
        teamId: 'defenders',
        settlementId: 'tamran',
        rolls: { check: d20(danger), notoriety: notoriety(4) },
      });
      const facts = view();
      return {
        facts,
        gather: detailAt(facts, 0).rolls,
        danger: detailAt(facts, 1).rolls,
      };
    };
    // A natural 1 fails both checks: each roll shows and is required.
    const low = stage(1, 1);
    expect(low.facts.slots[1]!.check!.succeeded).toBe(false);
    expect(low.gather).toEqual([
      expect.objectContaining({
        field: 'notoriety',
        shownBecause: 'The check is a natural 1',
      }),
    ]);
    expect(low.danger).toEqual([
      expect.objectContaining({
        field: 'notoriety',
        shownBecause: 'The check fails',
      }),
    ]);
    // A high roll succeeds: both rolls hide, are not required, and the kept
    // values change nothing.
    const high = stage(20, 20);
    expect(high.facts.slots[1]!.check!.succeeded).toBe(true);
    expect(high.gather).toEqual([]);
    expect(high.danger).toEqual([]);
    for (const slot of high.facts.slots.slice(0, 2))
      expect(
        slot.requirements.filter((code) => code.includes(':notoriety:')),
      ).toEqual([]);
    const withKept = projectWeeklyDraft(input).phases!.activity.outcome;
    place(0, {
      ...input.revision.activity.slots[0]!.choice!,
      rolls: { check: d20(20) },
    } as StagedActionChoice);
    place(1, {
      ...input.revision.activity.slots[1]!.choice!,
      rolls: { check: d20(20) },
    } as StagedActionChoice);
    expect(projectWeeklyDraft(input).phases!.activity.outcome).toEqual(
      withKept,
    );
  });
});

describe('event candidates', () => {
  test('[rules.ACT-10.mission-candidate-sets] two candidate sources keep independent sets; a swap keeps each set and selection with its own choice', () => {
    const { view, place, apply } = week();
    place(0, { choiceId: 'guarantee', actionId: 'guarantee_event' });
    place(1, {
      choiceId: 'manipulate',
      actionId: 'manipulate_events',
      teamId: 'guardians',
      candidates: [
        { eventId: 'm1', origin: { kind: 'rolled' } },
        { eventId: 'm2', origin: { kind: 'rolled' } },
      ],
      selectedEventId: 'm2',
    });
    let facts = view();
    const guarantee = narrow(detailAt(facts, 0), 'guarantee_event');
    // Event's own planned positions, before they are saved.
    expect(guarantee.candidates?.candidates).toHaveLength(2);
    expect(
      guarantee.candidates?.candidates.every(
        (candidate) =>
          candidate.eventId.includes(':candidate:guarantee:') &&
          candidate.name === null &&
          !candidate.chosen,
      ),
    ).toBe(true);
    expect(guarantee.rolls).toEqual([
      expect.objectContaining({
        field: 'notoriety',
        when: 'Always rolled: Notoriety rises by the roll.',
      }),
    ]);
    const manipulate = narrow(detailAt(facts, 1), 'manipulate_events');
    expect(
      manipulate.candidates?.candidates.map((entry) => [
        entry.eventId,
        entry.chosen,
      ]),
    ).toEqual([
      ['m1', false],
      ['m2', true],
    ]);
    expect(manipulate.acknowledgement?.subjectId).toBe(
      'manipulate_events:manipulate',
    );
    apply({
      kind: 'swap',
      fromSlotId: facts.slots[0]!.slotId,
      toSlotId: facts.slots[1]!.slotId,
      choiceId: 'guarantee',
      otherChoiceId: 'manipulate',
    });
    facts = view();
    const moved = narrow(detailAt(facts, 0), 'manipulate_events');
    expect(moved.candidates?.choiceId).toBe('manipulate');
    expect(
      moved.candidates?.candidates.find((entry) => entry.chosen)?.eventId,
    ).toBe('m2');
    expect(
      narrow(detailAt(facts, 1), 'guarantee_event').candidates?.candidates.some(
        (entry) => entry.eventId.startsWith('m'),
      ),
    ).toBe(false);
  });

  test('[rules.ACT-10.mission-candidate-replace] a replaced candidate choice starts with no candidates and never shows the old set', () => {
    const { view, place, apply } = week();
    place(0, {
      choiceId: 'old',
      actionId: 'guarantee_event',
      candidates: [
        { eventId: 'old-1', origin: { kind: 'rolled' } },
        { eventId: 'old-2', origin: { kind: 'rolled' } },
      ],
      selectedEventId: 'old-1',
    });
    apply({
      kind: 'replace',
      slotId: view().slots[0]!.slotId,
      choiceId: 'old',
      choice: { choiceId: 'new', actionId: 'guarantee_event' },
    });
    const facts = view();
    expect(facts.slots[0]!.choice).toEqual({
      choiceId: 'new',
      actionId: 'guarantee_event',
    });
    const set = narrow(detailAt(facts, 0), 'guarantee_event').candidates;
    expect(set?.choiceId).toBe('new');
    expect(
      set?.candidates.every(
        (candidate) =>
          candidate.eventId.includes(':candidate:new:') && !candidate.chosen,
      ),
    ).toBe(true);
    expect(facts.candidateSets.map((entry) => entry.choiceId)).toEqual(['new']);
  });
});
