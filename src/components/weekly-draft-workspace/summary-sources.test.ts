import { expect, test } from 'vitest';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import { foundationWeek } from '../../../tests/rules/foundation-acceptance-fixtures';
import { persistentEventFixture } from '../../../tests/rules/persistent-event-fixture';
import { phaseView } from './phase-view';
import { reviewSources, type ReviewSourceFacts } from './summary-sources';

function liveSummary(
  draft: Parameters<typeof projectWeeklyDraft>[0]['revision'],
  snapshot: Parameters<typeof projectWeeklyDraft>[0]['militiaSnapshot'],
) {
  const source = workspaceSourceSchema.parse({
    key: {
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: draft.draftId,
    },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [],
  });
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: snapshot,
  });
  const view = phaseView('summary', draft, source, preview);
  if (view.phase !== 'summary') throw new Error('Expected Summary');
  return view;
}

test('[SUM-02.live-sources] the live Summary names the source of each Required decision from the real phase lists', () => {
  const week = foundationWeek(3);
  week.revision.activity.slots[0]!.choice = {
    choiceId: 'drill',
    actionId: 'drill_militia',
  };
  const activity = liveSummary(week.revision, week.militiaSnapshot);
  // Event repeats the missing Activity die; its source is still the slot.
  expect(activity.requirements).toContain('drill:check:1d20');
  expect(activity.sources?.['drill:check:1d20']).toEqual({
    phase: 'activity',
    anchor: `activity-slot-${week.revision.activity.slots[0]!.slotId}`,
  });
  const fixture = persistentEventFixture('theft');
  fixture.draft.persistent.decisions = [
    { kind: 'mitigate', eventId: 'carried', overseerCharacterId: 'pc' },
  ];
  const persistent = liveSummary(fixture.draft, fixture.snapshot);
  expect(persistent.sources?.['carried:mitigation:1d20']).toEqual({
    phase: 'persistent',
    anchor: 'persistent-event-carried',
  });
  expect(persistent.sources?.['upkeep:boon:4:pc:acknowledgement']).toEqual({
    phase: 'upkeep',
    anchor: 'upkeep-step-rank',
  });
  // Every Required decision of these weeks has a source.
  for (const view of [activity, persistent])
    for (const code of view.requirements)
      expect(view.sources?.[code], code).toBeDefined();
});

const facts: Omit<ReviewSourceFacts, 'codes' | 'owners'> = {
  slots: [
    { slotId: 'left', choiceId: 'drill' },
    { slotId: 'right', choiceId: null },
  ],
  eventIds: ['ambush'],
  persistentEventIds: ['carried'],
  teamIds: ['scouts'],
  transferIds: ['deposit-1'],
  adjustmentIds: ['bonus'],
};
const none = { upkeep: [], activity: [], event: [], persistent: [] };

test('[SUM-02.sources] each Required decision goes to the earliest phase that owns it and its item there', () => {
  const sources = reviewSources({
    ...facts,
    codes: [
      'upkeep:attrition:roll',
      'upkeep:boon:4:pc:acknowledgement',
      'team:scouts:recovery-decision',
      'transfer:deposit-1:funds-exception',
      'drill:check:1d20',
      'ambush:outcome',
      'carried:mitigation:1d20',
      'event:chance:1d100',
    ],
    owners: {
      upkeep: [
        'upkeep:attrition:roll',
        'upkeep:boon:4:pc:acknowledgement',
        'team:scouts:recovery-decision',
        'transfer:deposit-1:funds-exception',
      ],
      // Event repeats Activity's requirements; the earlier phase owns them.
      activity: ['drill:check:1d20'],
      event: ['drill:check:1d20', 'ambush:outcome', 'event:chance:1d100'],
      persistent: ['carried:mitigation:1d20'],
    },
  });
  expect(sources).toEqual({
    'upkeep:attrition:roll': {
      phase: 'upkeep',
      anchor: 'upkeep-step-attrition',
    },
    'upkeep:boon:4:pc:acknowledgement': {
      phase: 'upkeep',
      anchor: 'upkeep-step-rank',
    },
    'team:scouts:recovery-decision': {
      phase: 'upkeep',
      anchor: 'upkeep-step-teams',
    },
    'transfer:deposit-1:funds-exception': {
      phase: 'upkeep',
      anchor: 'upkeep-step-transfers',
    },
    'drill:check:1d20': { phase: 'activity', anchor: 'activity-slot-left' },
    'ambush:outcome': { phase: 'event', anchor: 'event-occurrence-ambush' },
    'carried:mitigation:1d20': {
      phase: 'persistent',
      anchor: 'persistent-event-carried',
    },
    // A phase-wide decision still goes to its phase.
    'event:chance:1d100': { phase: 'event', anchor: null },
  });
});

test('[SUM-02.local-sources] a saved Table Adjustment decision stays in Review and focuses that adjustment', () => {
  expect(
    reviewSources({
      ...facts,
      codes: ['adjustment:bonus:team', 'adjustment:gone:team'],
      owners: none,
    }),
  ).toEqual({
    'adjustment:bonus:team': {
      phase: 'summary',
      anchor: 'review-form-adjustment:bonus',
    },
  });
});

test('[SUM-02.unowned-sources] identifiers match whole segments and unowned codes fall back to their prefix or no link', () => {
  const sources = reviewSources({
    ...facts,
    codes: [
      'upkeep:notoriety:nearest-settlement',
      'drilling:check',
      'mystery:code',
    ],
    owners: { ...none, activity: ['drilling:check'] },
  });
  expect(sources).toEqual({
    'upkeep:notoriety:nearest-settlement': {
      phase: 'upkeep',
      anchor: 'upkeep-step-notoriety',
    },
    // `drill` is a choice, but `drilling` is not that choice.
    'drilling:check': { phase: 'activity', anchor: null },
  });
});
