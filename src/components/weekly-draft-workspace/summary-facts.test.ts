import { expect, test } from 'vitest';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import { editWeeklyDraft } from '~/lib/weekly-draft';
import { persistentEventFixture } from '../../../tests/rules/persistent-event-fixture';
import { phaseView } from './phase-view';

test('a carried Character departure review is presented in Persistent and an explicit current decision clears it', () => {
  const { draft, snapshot } = persistentEventFixture('theft');
  draft.context = {
    ...draft.context,
    carriedEvents: draft.context.carriedEvents.map((event) => ({
      ...event,
      reviewRequired: true,
    })),
  };
  const source = workspaceSourceSchema.parse({
    key: {
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: draft.draftId,
    },
    week: draft.week,
    sourceRevision: 1,
    snapshot,
    people: [],
  });
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: snapshot,
  });
  const persistent = phaseView('persistent', draft, source, preview);
  if (persistent.phase !== 'persistent') throw new Error('Expected Persistent');
  expect(persistent.events[0]?.requirements).toContain('carried:review');
  expect(persistent.ready).toBe(false);
  const edited = editWeeklyDraft(draft, {
    kind: 'persistent_decision',
    decision: { kind: 'unattempted', eventId: 'carried' },
  });
  if (!edited.ok) throw new Error('Expected accepted review');
  const reviewedPreview = projectWeeklyDraft({
    revision: edited.draft,
    militiaSnapshot: snapshot,
  });
  expect(reviewedPreview.requirements).not.toContain('carried:review');
});

test('an event changed by Character departure carries its review requirement in Event preparation', () => {
  const { draft, snapshot } = persistentEventFixture('theft');
  draft.event.occurrences = draft.event.occurrences.map((event) => ({
    ...event,
    reviewRequired: true,
  }));
  const source = workspaceSourceSchema.parse({
    key: {
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: draft.draftId,
    },
    week: draft.week,
    sourceRevision: 1,
    snapshot,
    people: [],
  });
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: snapshot,
  });
  const events = phaseView('event', draft, source, preview);
  if (events.phase !== 'event') throw new Error('Expected Event');
  expect(events.requirements).toContain('event:review');
  expect(events.ready).toBe(false);
});
