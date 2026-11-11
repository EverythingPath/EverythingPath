import type { CanonicalResolutionRecord } from '~/lib/canonical-resolution-record';
import type { recordDate } from './finished-week-index';

// What the Finished weeks view renders. Every value is already worded and
// every action already bound; the view only lays them out.

export type RecordDate = ReturnType<typeof recordDate>;

export type WeekRowView = {
  kind: 'week';
  week: number;
  href: string;
  isSelected: boolean;
  /** The newest finished week, always the bottom row. */
  isLatest: boolean;
  date: RecordDate;
  headlines: string[];
  /** "Corrected · N entries" or "Reconstructed". */
  marker: string | null;
  /** Call from the row link's click; the latest row restores the newest window. */
  onNavigate?: () => void;
};
export type EarlierWeeksView = {
  kind: 'earlier';
  beforeWeek: number;
  /** Loading, or failed to load; `load` then tries again. */
  status: 'idle' | 'loading' | 'failed';
  load: () => void;
};
export type IndexItemView = WeekRowView | EarlierWeeksView;

export type IndexView =
  | { status: 'loading' }
  | { status: 'failed'; retry: () => void }
  | { status: 'ready'; items: IndexItemView[] };

export type RulesetView =
  | { status: 'loading' }
  | { status: 'failed'; retry: () => void }
  | { status: 'ready'; version: number };

export type AuditEntryView = {
  recordId: string;
  /** "Entry 3" */
  label: string;
  provenance: string;
  date: RecordDate;
  ruleset: RulesetView;
  /** The record shown in the detail. */
  isSelected: boolean;
  isEffective: boolean;
  select: () => void;
};

export type AuditPageView =
  | { status: 'loading' }
  | { status: 'failed'; retry: () => void }
  | {
      status: 'ready';
      entries: AuditEntryView[];
      /** Loads the next five older entries; null on the oldest page. */
      earlier: (() => void) | null;
    };

export type AuditView = {
  entryCount: number;
  isOpen: boolean;
  toggle: () => void;
  page: AuditPageView;
};

export type WeekLink = { week: number; href: string } | null;

export type RecordPaneView = {
  week: number;
  record: CanonicalResolutionRecord;
  provenance: string;
  date: RecordDate;
  rulesetVersion: number;
  /** "Earlier entry 2 of 5" when an earlier audit entry is shown. */
  earlierEntry: string | null;
  previous: WeekLink;
  next: WeekLink;
  /** Null for a week with a single entry. */
  audit: AuditView | null;
};

export type PaneView =
  | { status: 'loading' }
  | { status: 'failed'; retry: () => void; effectiveHref: string | null }
  /** A week with no record, or a linked entry that isn't part of the week. */
  | {
      status: 'unavailable';
      message: string;
      action: { label: string; href: string };
    }
  | { status: 'ready'; pane: RecordPaneView };

export type FinishedWeeksView =
  | { status: 'no-militia'; setupHref: string }
  | { status: 'loading' }
  | { status: 'failed'; retry: () => void }
  | { status: 'empty'; openWeek: number | null; weekHref: string }
  | {
      status: 'ready';
      index: IndexView;
      pane: PaneView;
      /** The open week, for "Week N is in progress." */
      inProgressWeek: number | null;
    };
