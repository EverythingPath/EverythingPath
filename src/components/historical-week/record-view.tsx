'use client';
import { useMemo } from 'react';
import { WeekReviewSections } from '~/components/week-review/week-review';
import type { CanonicalResolutionRecord } from '~/lib/canonical-resolution-record';
import { recordWeekReview } from './record-review';

// The selected record's six-section story, read only from that immutable
// record. The Finished weeks pane owns its header (week, provenance, date,
// Ruleset Version, earlier-entry status) and read-only footer. No editing
// capability is handed in, so the shared renderer draws no control but the
// local Show all values toggle.
export function HistoricalRecordView({
  record,
}: {
  record: CanonicalResolutionRecord;
}) {
  const facts = useMemo(() => recordWeekReview(record), [record]);
  return <WeekReviewSections facts={facts} />;
}
