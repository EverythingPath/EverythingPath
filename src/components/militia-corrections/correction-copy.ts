import {
  MILITIA_ENTRY_LABELS,
  MILITIA_SECTIONS,
  militiaEntryForLocation,
  type MilitiaEntryKey,
} from '~/lib/militia-correction-sections';
import type { SetupErrorDescriptor } from '~/lib/setup-validation';
import { refusalReason } from '~/lib/write-outcome';
import type {
  CorrectionSubject,
  CorrectionView,
  Feedback,
} from './correction-lifecycle';

// User-facing wording for Militia corrections. Nothing here names storage,
// revisions or synchronization: only what the player sees and can do.

export const REASON_LABEL = 'Reason for correction';
export const REASON_LIMIT = 2000;

export function correctLabel(entry: MilitiaEntryKey) {
  return `Correct ${MILITIA_ENTRY_LABELS[entry].toLowerCase()}`;
}

const SUBJECT_LABELS: Record<CorrectionSubject, string> = {
  ...MILITIA_SECTIONS,
  officers: 'Officers',
  roster: 'Roster',
};

export function feedbackMessage(feedback: Feedback) {
  const label = SUBJECT_LABELS[feedback.entry];
  if (feedback.kind === 'saved') return `${label} corrected.`;
  return `${label} now ${feedback.entry === 'roster' ? 'shows' : 'show'} your correction.`;
}

export function editingNotice(
  view: Extract<CorrectionView, { kind: 'editing' }>,
): string | null {
  switch (view.notice) {
    case 'unchanged':
      return 'Nothing to save: these values match the militia.';
    case 'retry':
      return 'Another player changed the militia while you were saving. Your entries are kept. Save again to apply them.';
    case 'unconfirmed':
      return "The correction couldn't be confirmed and the militia doesn't show it. Your entries are kept. Save again to apply them.";
    case 'rejected':
      return `The correction wasn't saved${refusalReason(view.message)} Your entries are kept.`;
    case null:
      return null;
  }
}

export const SAVING_MESSAGE = 'Saving correction…';
export const CONFLICT_HEADING = 'Another player changed this section';
export const RESTART_FROM_THEIRS = 'Start again from their values';
export const WEEK_CHANGED_MESSAGE =
  'The week changed while you were correcting. Start again from the new week’s values.';
export const RESTART_FROM_WEEK = 'Start again';
export const AFFECTS_WEEK_HEADING = 'This affects the open week';
export const MISSING_HEADING = 'Missing from the militia';
export const NEEDED_BY_LABEL = 'Needed by';

/** The reason field's own message, or null. */
export function reasonError(value: unknown, error: string | undefined) {
  if (error === undefined) return null;
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return `${REASON_LABEL} is required.`;
  if (text.length > REASON_LIMIT)
    return `${REASON_LABEL} must be ${REASON_LIMIT.toLocaleString('en-US')} characters or fewer.`;
  return error;
}

export type ErrorSummaryItem = {
  /** Form path of a control on this correction, when one can fix it. */
  field: string | null;
  message: string;
  /** Empty required input, malformed input, or a rule across values. */
  kind: 'required' | 'invalid' | 'other';
};

// Safe cast: value is a non-null object here; a missing key reads undefined.
const readPath = (values: unknown, path: string) =>
  path
    .split('.')
    .reduce<unknown>(
      (value, key) =>
        value !== null && typeof value === 'object'
          ? (value as Record<string, unknown>)[key]
          : undefined,
      values,
    );
const blank = (value: unknown) =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && value.trim() === '');

// The save summary: every error, linked to the control that fixes it when
// that control is on this correction (`labels` names them). Errors that
// belong to another section say which one.
export function errorSummary(
  descriptors: SetupErrorDescriptor[],
  values: unknown,
  labels: Record<
    string,
    { label: string; numeric?: boolean; decimal?: boolean }
  >,
): ErrorSummaryItem[] {
  const seen = new Set<string>();
  const items: ErrorSummaryItem[] = [];
  for (const descriptor of descriptors) {
    const field = descriptor.field ?? null;
    const control = field ? labels[field] : undefined;
    let item: ErrorSummaryItem;
    if (control && field) {
      const value = readPath(values, field);
      if (blank(value))
        item = {
          field,
          kind: 'required',
          message: `${control.label} is required.`,
        };
      else if (field === 'notes')
        item = {
          field,
          kind: 'invalid',
          message: reasonError(value, descriptor.message) ?? descriptor.message,
        };
      else if (descriptor.kind === 'field' && control.numeric)
        item = {
          field,
          kind: 'invalid',
          message: `Enter a valid ${control.decimal ? 'number' : 'whole number'} for ${control.label}.`,
        };
      else item = { field, kind: 'other', message: descriptor.message };
    } else {
      const entry = descriptor.section
        ? militiaEntryForLocation({
            ...descriptor,
            section: descriptor.section,
          })
        : null;
      item = {
        field: null,
        kind: 'other',
        message: entry
          ? `${MILITIA_ENTRY_LABELS[entry]}: ${descriptor.message}`
          : descriptor.message,
      };
    }
    const key = `${item.field}:${item.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items;
}
