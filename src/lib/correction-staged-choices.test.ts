import { expect, test } from 'vitest';
import { upkeepFixture } from '../../tests/rules/upkeep-fixture';
import type { UpkeepSnapshot } from './rules-upkeep';
import {
  correctionImpact,
  stagedReferences,
} from './correction-staged-choices';

// The phase of each staged choice a correction newly leaves without its
// subject.
const affectedPhases = (...args: Parameters<typeof correctionImpact>) =>
  correctionImpact(...args).added.map(({ phase }) => phase);

function withScouts(snapshot: UpkeepSnapshot): UpkeepSnapshot {
  return {
    ...snapshot,
    roster: {
      ...snapshot.roster,
      teams: [
        {
          teamId: 'scouts',
          teamType: 'patrons',
          name: 'Scouts',
          status: 'disabled',
          managerCharacterId: null,
          rewardCapExempt: false,
          notes: '',
        },
      ],
    },
  };
}

test('removing a team with a staged Upkeep decision names the affected phase', () => {
  const { draft, snapshot } = upkeepFixture();
  const current = withScouts(snapshot);
  draft.upkeep.teamDecisions = [
    { teamId: 'scouts', decision: 'recover', costCopper: 3000 },
  ];
  const edited = { ...current, roster: { ...current.roster, teams: [] } };
  expect(affectedPhases(draft, current, edited)).toEqual(['upkeep']);
  // Keeping the team affects nothing.
  expect(affectedPhases(draft, current, current)).toEqual([]);
});

test('references that were already broken before the correction are not blamed on it', () => {
  const { draft, snapshot } = upkeepFixture();
  draft.upkeep.teamDecisions = [{ teamId: 'gone', decision: 'leave' }];
  expect(affectedPhases(draft, snapshot, snapshot)).toEqual([]);
});

test('an Activity choice aimed at the removed team is attributed to Activity', () => {
  const { draft, snapshot } = upkeepFixture();
  const current = withScouts(snapshot);
  draft.activity.slots[0]!.choice = {
    choiceId: 'dismiss',
    actionId: 'dismiss_team',
    targetTeamId: 'scouts',
    rolls: {},
  };
  draft.upkeep.teamDecisions = [{ teamId: 'scouts', decision: 'leave' }];
  const edited = { ...current, roster: { ...current.roster, teams: [] } };
  expect(affectedPhases(draft, current, edited)).toEqual([
    'upkeep',
    'activity',
  ]);
});

// Two teams and two settlements the open week's choices can use.
function withTwoTeamsAndTowns(snapshot: UpkeepSnapshot): UpkeepSnapshot {
  const team = (teamId: string, name: string) => ({
    teamId,
    teamType: 'patrons' as const,
    name,
    status: 'active' as const,
    managerCharacterId: null,
    rewardCapExempt: false,
    notes: '',
  });
  const town = (settlementId: string, name: string) => ({
    settlementId,
    name,
    reputation: 'Friendly' as const,
    secured: false,
    occupied: false,
    temporaryReputationShift: 0,
    refugeActivatedWeek: null,
    refugeActiveUntilWeek: null,
  });
  return {
    ...snapshot,
    roster: {
      ...snapshot.roster,
      teams: [team('scouts', 'Scouts'), team('guards', 'Guards')],
    },
    settlements: [town('teilwood', 'Teilwood'), town('phaendar', 'Phaendar')],
  };
}

test('removing two teams names each Activity slot by position and the team it lost', () => {
  const { draft, snapshot } = upkeepFixture();
  const current = withTwoTeamsAndTowns(snapshot);
  draft.activity.slots[0]!.choice = {
    choiceId: 'drill',
    actionId: 'drill_militia',
    teamId: 'guards',
  };
  draft.activity.slots[1]!.choice = {
    choiceId: 'gold',
    actionId: 'earn_gold',
    teamId: 'scouts',
  };
  const edited = { ...current, roster: { ...current.roster, teams: [] } };
  const impact = correctionImpact(draft, current, edited);
  expect(impact.added).toEqual([
    {
      key: 'activitySlot:one',
      phase: 'activity',
      location: {
        kind: 'activitySlot',
        slotId: 'one',
        position: 1,
        actionId: 'drill_militia',
      },
      missing: [{ kind: 'team', id: 'guards' }],
    },
    {
      key: 'activitySlot:two',
      phase: 'activity',
      location: {
        kind: 'activitySlot',
        slotId: 'two',
        position: 2,
        actionId: 'earn_gold',
      },
      missing: [{ kind: 'team', id: 'scouts' }],
    },
  ]);
  expect(impact.existing).toEqual([]);
  expect(impact.carried).toEqual([]);
  // Once saved, the same two choices are the open week's missing references.
  expect(stagedReferences(draft, edited).map((item) => item.key)).toEqual([
    'activitySlot:one',
    'activitySlot:two',
  ]);
});

test('settlement references are located by the choice that repairs them', () => {
  const { draft, snapshot } = upkeepFixture();
  const current = withTwoTeamsAndTowns(snapshot);
  draft.activity.operatingSettlementId = 'teilwood';
  draft.upkeep.nearestSettlementId = 'teilwood';
  draft.activity.slots[0]!.choice = {
    choiceId: 'danger',
    actionId: 'reduce_danger',
    settlementId: 'teilwood',
  };
  // An event the Activity action produced is repaired in its slot; a rolled
  // Event occurrence in the Event phase.
  draft.activity.slots[1]!.choice = {
    choiceId: 'guarantee',
    actionId: 'guarantee_event',
    candidates: [
      {
        eventId: 'guaranteed',
        origin: { kind: 'rolled' },
        eventType: 'theft',
        targets: [{ kind: 'settlement', settlementId: 'teilwood' }],
      },
    ],
  };
  draft.event.occurrences = [
    {
      eventId: 'rolled',
      origin: { kind: 'rolled' },
      eventType: 'theft',
      targets: [{ kind: 'settlement', settlementId: 'teilwood' }],
    },
  ];
  draft.tableAdjustments = [
    {
      kind: 'settlement_reputation',
      adjustmentId: 'shift',
      settlementId: 'teilwood',
      reputation: 'Helpful',
      reason: 'Festival',
    },
  ];
  const edited = { ...current, settlements: current.settlements.slice(1) };
  const { added } = correctionImpact(draft, current, edited);
  expect(added.map(({ key, phase }) => [key, phase])).toEqual([
    ['nearestSettlement', 'upkeep'],
    ['operatingSettlement', 'activity'],
    ['activitySlot:one', 'activity'],
    ['activitySlot:two', 'activity'],
    ['event:rolled', 'event'],
    ['tableAdjustment:shift', 'summary'],
  ]);
  expect(added.find((item) => item.key === 'event:rolled')?.location).toEqual({
    kind: 'event',
    eventId: 'rolled',
    eventType: 'theft',
  });
});

test('already missing references stay apart from what the correction newly breaks', () => {
  const { draft, snapshot } = upkeepFixture();
  const current = withTwoTeamsAndTowns(snapshot);
  draft.upkeep.teamDecisions = [{ teamId: 'gone', decision: 'leave' }];
  draft.activity.slots[0]!.choice = {
    choiceId: 'dismiss',
    actionId: 'dismiss_team',
    teamId: 'gone',
    targetTeamId: 'scouts',
  };
  const edited = {
    ...current,
    roster: { ...current.roster, teams: current.roster.teams.slice(1) },
  };
  const impact = correctionImpact(draft, current, edited);
  // The slot already lacked its acting team; only Scouts is new.
  expect(impact.added).toEqual([
    expect.objectContaining({
      key: 'activitySlot:one',
      missing: [{ kind: 'team', id: 'scouts' }],
    }),
  ]);
  expect(impact.existing.map((item) => item.key)).toEqual([
    'upkeepTeam:gone',
    'activitySlot:one',
  ]);
});

test('carried context a correction would break is reported apart from staged choices', () => {
  const base = upkeepFixture();
  const current = withTwoTeamsAndTowns(base.snapshot);
  const draft = {
    ...base.draft,
    context: {
      ...base.draft.context,
      carriedEvents: [
        {
          eventId: 'sickness',
          eventType: 'sickness' as const,
          startedWeek: 38,
          order: 0,
          targets: [{ kind: 'team' as const, teamId: 'scouts' }],
        },
      ],
    },
  };
  const edited = {
    ...current,
    roster: { ...current.roster, teams: current.roster.teams.slice(1) },
  };
  expect(correctionImpact(draft, current, edited)).toEqual({
    added: [],
    existing: [],
    carried: [
      {
        key: 'carriedEvent:sickness',
        phase: null,
        location: {
          kind: 'carriedEvent',
          eventId: 'sickness',
          eventType: 'sickness',
        },
        missing: [{ kind: 'team', id: 'scouts' }],
      },
    ],
  });
});
