import { expect, test } from 'vitest';
import { upkeepFixture } from '../../tests/rules/upkeep-fixture';
import {
  canonicalResolutionRecordSchema,
  type CanonicalResolutionRecord,
} from './canonical-resolution-record';
import type { UpkeepSnapshot } from './rules-upkeep';
import type { WeekStartFacts } from './weekly-draft-contract';
import { createWeeklyDraft } from './weekly-draft';
import { projectHeadlineFacts } from './finished-week-headlines';

const team = (teamId: string, name: string, status = 'active') => ({
  teamId,
  teamType: 'spies' as const,
  name,
  status: status as 'active',
  rewardCapExempt: false,
  managerCharacterId: null,
  notes: '',
});
const settlement = (
  settlementId: string,
  name: string,
  reputation: 'Friendly' | 'Helpful' | null,
) => ({
  settlementId,
  name,
  reputation,
  secured: null,
  occupied: null,
  temporaryReputationShift: null,
  refugeActivatedWeek: null,
  refugeActiveUntilWeek: null,
});
type PersistentEvent = WeekStartFacts['carriedEvents'][number];
const context = (carriedEvents: PersistentEvent[] = []): WeekStartFacts => ({
  firstMilitiaWeek: false,
  startDay: 273,
  uneventfulCarry: false,
  carriedEvents,
  queuedEffects: [],
  orders: [],
  lastBuyoffWeek: null,
});
const draft = (carriedEvents?: PersistentEvent[]) =>
  createWeeklyDraft({
    draftId: 'week-40',
    week: 40,
    slotIds: [],
    context: context(carriedEvents),
  });
const event = (eventId: string): PersistentEvent => ({
  eventId,
  eventType: 'low_morale',
  startedWeek: 39,
  order: 0,
  targets: [],
});

function formatTwo(
  change: (after: UpkeepSnapshot) => void,
  events: { before?: PersistentEvent[]; after?: PersistentEvent[] } = {},
): CanonicalResolutionRecord {
  const { snapshot } = upkeepFixture();
  snapshot.roster.teams = [team('red', 'Red Hand'), team('ash', 'Ash')];
  snapshot.settlements = [settlement('town', 'Phaendar', 'Friendly')];
  const after = structuredClone(snapshot);
  change(after);
  const successor = context(events.after);
  const before = {
    week: 40,
    militiaSnapshot: snapshot,
    context: context(events.before),
  };
  const outcome = { week: 41, militiaSnapshot: after, context: successor };
  const plan = { before, after: outcome, effects: {} };
  return canonicalResolutionRecordSchema.parse({
    recordId: 'record',
    source: draft(events.before),
    sourceMilitiaSnapshot: snapshot,
    provenance: 'confirmation',
    rulesetVersion: 5,
    baselinePlan: { formatVersion: 2, data: plan },
    finalPlan: { formatVersion: 2, data: plan },
    finalOutcome: { formatVersion: 2, data: outcome },
    adjudication: {
      acknowledgements: [],
      rulesExceptions: [],
      tableAdjustments: [],
    },
    warnings: [],
    successorContext: successor,
    supersedesRecordId: null,
  });
}

const known = { beforeRecorded: true, finalRecorded: true };

test('[rules.P86.headline-order] headlines take the first two known changes in family order from stored before and final facts', () => {
  const record = formatTwo((after) => {
    after.focus = 'Security';
    after.notoriety = 4;
    after.training = 28;
    after.treasuryCopper = 3007;
  });
  expect(projectHeadlineFacts(record)).toEqual([
    {
      key: 'treasury',
      label: 'Treasury',
      before: 3000,
      final: 3007,
      unit: 'gp',
      ...known,
    },
    {
      key: 'training',
      label: 'Training',
      before: 30,
      final: 28,
      unit: 'number',
      ...known,
    },
  ]);
  expect(
    projectHeadlineFacts(
      formatTwo((after) => {
        after.rank = 4;
        after.focus = null;
      }),
    ),
  ).toEqual([
    {
      key: 'rank',
      label: 'Rank',
      before: 3,
      final: 4,
      unit: 'number',
      ...known,
    },
    {
      key: 'focus',
      label: 'Focus',
      before: 'Loyalty',
      final: null,
      unit: 'text',
      ...known,
    },
  ]);
});

test('[rules.P86.headline-teams] team additions, removals and conditions use recorded names in recorded order', () => {
  const record = formatTwo((after) => {
    after.roster.teams = [
      team('ash', 'Ash', 'disabled'),
      team('new', 'Night Owls'),
    ];
  });
  expect(projectHeadlineFacts(record)).toEqual([
    {
      key: 'team:red',
      label: 'Red Hand',
      before: 'active',
      final: null,
      unit: 'text',
      ...known,
    },
    {
      key: 'team:ash',
      label: 'Ash',
      before: 'active',
      final: 'disabled',
      unit: 'text',
      ...known,
    },
  ]);
  expect(
    projectHeadlineFacts(
      formatTwo((after) => {
        after.roster.teams.push(team('new', 'Night Owls'));
      }),
    ),
  ).toEqual([
    {
      key: 'team:new',
      label: 'Night Owls',
      before: null,
      final: 'active',
      unit: 'text',
      ...known,
    },
  ]);
});

test('[rules.P86.headline-families] settlement reputation precedes persistent-event changes, which use numbered labels', () => {
  const record = formatTwo(
    (after) => {
      after.settlements = [settlement('town', 'Phaendar', 'Helpful')];
    },
    { before: [event('storm')], after: [event('raid')] },
  );
  expect(projectHeadlineFacts(record)).toEqual([
    {
      key: 'settlement:town',
      label: 'Phaendar',
      before: 'Friendly',
      final: 'Helpful',
      unit: 'text',
      ...known,
    },
    {
      key: 'event:storm',
      label: 'Persistent event 1',
      before: 'low_morale',
      final: null,
      unit: 'text',
      ...known,
    },
  ]);
  expect(
    projectHeadlineFacts(
      formatTwo(() => undefined, {
        before: [event('storm')],
        after: [event('raid')],
      }),
    ).map(({ key, label }) => [key, label]),
  ).toEqual([
    ['event:storm', 'Persistent event 1'],
    ['event:raid', 'Persistent event 2'],
  ]);
  // Settlements headline their reputation only: one added without a known
  // reputation records no reputation change.
  expect(
    projectHeadlineFacts(
      formatTwo((after) => {
        after.settlements.push(settlement('camp', 'Camp', null));
        after.settlements.push(settlement('fort', 'Fort', 'Helpful'));
      }),
    ),
  ).toEqual([
    {
      key: 'settlement:fort',
      label: 'Fort',
      before: null,
      final: 'Helpful',
      unit: 'text',
      ...known,
    },
  ]);
});

test('[rules.P86.headline-none] unchanged records and records without comparable facts have no headlines', () => {
  expect(projectHeadlineFacts(formatTwo(() => undefined))).toEqual([]);
  const unreadable = formatTwo((after) => {
    after.training = 20;
  });
  expect(
    projectHeadlineFacts({
      ...unreadable,
      finalPlan: { formatVersion: 2, data: {} },
      finalOutcome: { formatVersion: 2, data: { note: 'Recorded by hand' } },
    }),
  ).toEqual([]);
  expect(
    projectHeadlineFacts({
      ...unreadable,
      finalPlan: { formatVersion: 2, data: {} },
      finalOutcome: {
        formatVersion: 2,
        data: { militiaSnapshot: { treasuryCopper: '87', training: 1.5 } },
      },
    }),
  ).toEqual([]);
});

test('[rules.P86.headline-final] the final outcome takes precedence over plan-after, which fills in only when the outcome holds no militia facts', () => {
  const changed = formatTwo((after) => {
    after.training = 20;
  });
  const outcome = {
    ...changed,
    finalOutcome: {
      formatVersion: 2 as const,
      data: {
        militiaSnapshot: {
          ...changed.sourceMilitiaSnapshot,
          treasuryCopper: 7,
        },
      },
    },
  };
  expect(projectHeadlineFacts(outcome)).toEqual([
    {
      key: 'treasury',
      label: 'Treasury',
      before: 3000,
      final: 7,
      unit: 'gp',
      ...known,
    },
  ]);
  const planOnly = {
    ...changed,
    finalOutcome: {
      formatVersion: 2 as const,
      data: { note: 'Recorded by hand' },
    },
  };
  expect(projectHeadlineFacts(planOnly)).toEqual([
    {
      key: 'training',
      label: 'Training',
      before: 30,
      final: 20,
      unit: 'number',
      ...known,
    },
  ]);
});
