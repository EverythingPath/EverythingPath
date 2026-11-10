import {
  gp,
  signed,
  signedGp,
  words,
} from '~/components/week-review/review-text';
import { eventName } from '~/components/weekly-draft-workspace/event-tree-facts';
import type {
  FinishedWeekHeadlineFact,
  HeadlineValue,
} from '~/lib/finished-week-headlines';

// Recorded headline wording and provenance precedence shared by the Finished weeks index and Campaign
// home's Recent finished weeks. Each screen keeps its own provenance marker
// (Reconstructed there, From setup on the home).

export const recordedOutcomeAvailable = 'Recorded outcome available';

// Record-local values: team conditions, settlement attitudes and persistent
// event types, which read as their table names.
function valueText(fact: FinishedWeekHeadlineFact, value: HeadlineValue) {
  if (value === null) return 'None';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number')
    return fact.unit === 'gp' ? gp(value) : `${value}`;
  if (fact.key.startsWith('event:')) return eventName(value) ?? words(value);
  return words(value);
}

/**
 * One recorded comparison as a short phrase. Numbers become signed changes; a
 * missing starting value shows only the recorded outcome, never a change from
 * an assumed zero. Subjects (keyed `family:id`) are added or removed.
 */
export function headlineText(fact: FinishedWeekHeadlineFact): string | null {
  const { label, before, final, unit } = fact;
  if (!fact.finalRecorded) return null;
  if (!fact.beforeRecorded) return `${label} now ${valueText(fact, final)}`;
  if (
    typeof before === 'number' &&
    typeof final === 'number' &&
    unit !== 'text'
  )
    return `${label} ${unit === 'gp' ? signedGp(final - before) : signed(final - before)}`;
  const subject = fact.key.includes(':');
  if (subject && before === null && final !== null)
    return `${label} added: ${valueText(fact, final)}`;
  if (subject && before !== null && final === null) return `${label} removed`;
  return `${label}: ${valueText(fact, before)} → ${valueText(fact, final)}`;
}

/**
 * A finished week's provenance marker: Corrected (more than one audit entry)
 * takes precedence over an uncorrected reconstruction. Each screen words it
 * itself: Finished weeks says Reconstructed, Campaign home says From setup.
 */
export function finishedWeekProvenance(row: {
  entryCount: number;
  provenance: string;
}): 'corrected' | 'reconstructed' | null {
  if (row.entryCount > 1) return 'corrected';
  if (row.provenance === 'historical_reconstruction') return 'reconstructed';
  return null;
}

/** Up to two headline phrases; a record without comparable facts says so. */
export function rowHeadlines(row: {
  headlineFacts: FinishedWeekHeadlineFact[];
}): string[] {
  const phrases = row.headlineFacts
    .map(headlineText)
    .filter((phrase): phrase is string => phrase !== null)
    .slice(0, 2);
  return phrases.length > 0 ? phrases : [recordedOutcomeAvailable];
}
