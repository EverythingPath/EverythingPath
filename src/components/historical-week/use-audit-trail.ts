'use client';

import { useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useQueries, useQuery } from '@tanstack/react-query';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import type { HistorySelection } from '~/lib/campaign-routes';
import {
  earlierEntryLabel,
  provenanceLabels,
  recordDate,
  type FinishedWeek,
} from './finished-week-index';
import type {
  AuditPageView,
  AuditView,
  RulesetView,
} from './finished-weeks-types';
import type { AuditRow, HistoryRead } from './history-read';
import { useAuditOrdinal } from './use-audit-ordinal';

/**
 * The shown week's audit entries: an "N entries" disclosure that pages five
 * newest-first entries at a time (the page lives in the address as
 * `beforeSequence`), Ruleset Versions read only for the visible page, and the
 * shown record's "Earlier entry X of N" status. The disclosure resets
 * whenever the week changes.
 */
export function useAuditTrail({
  campaignId,
  isEnabled,
  selection,
  select,
  shownWeek,
  read,
  effectiveRow,
}: {
  campaignId: Id<'campaign'>;
  isEnabled: boolean;
  selection: HistorySelection;
  select: (selection: HistorySelection) => void;
  shownWeek: number | null;
  read: HistoryRead | undefined;
  /** The listing row for the shown week, with the effective Ruleset. */
  effectiveRow: FinishedWeek | null;
}): { audit: AuditView | null; earlierEntry: string | null } {
  const isPaged = selection.beforeSequence !== undefined;
  const [disclosure, setDisclosure] = useState({
    week: shownWeek,
    isOpen: isPaged,
  });
  // Adjusted during render: a different week starts closed, unless its
  // address names an audit page.
  if (disclosure.week !== shownWeek)
    setDisclosure({ week: shownWeek, isOpen: isPaged });
  const isOpen = disclosure.week === shownWeek ? disclosure.isOpen : isPaged;

  // An older page is read on its own, so paging never reloads the record.
  const pageArgs =
    isEnabled && isOpen && read && isPaged
      ? {
          campaignId,
          week: read.week,
          beforeSequence: selection.beforeSequence,
        }
      : 'skip';
  const pagedRead = useQuery(convexQuery(api.canonicalHistory.read, pageArgs));
  const page = isPaged ? pagedRead.data : read;
  const pageFailed = isPaged && pagedRead.isError;
  const visibleRows = isOpen && !pageFailed ? (page?.audit ?? []) : [];

  const knownRuleset = (recordId: string) => {
    if (recordId === read?.record.recordId) return read.record.rulesetVersion;
    if (recordId === effectiveRow?.effectiveRecordId)
      return effectiveRow.rulesetVersion;
    return undefined;
  };
  const unknownRulesets = visibleRows.filter(
    (entry) => knownRuleset(entry.recordId) === undefined,
  );
  const rulesets = useQueries({
    queries:
      isEnabled && read
        ? unknownRulesets.map((entry) =>
            convexQuery(api.canonicalHistory.read, {
              campaignId,
              week: read.week,
              recordId: entry.recordId,
            }),
          )
        : [],
  });

  const ordinal = useAuditOrdinal({
    campaignId,
    read,
    pageRows: pagedRead.isSuccess ? (pagedRead.data?.audit ?? []) : [],
  });

  if (!read) return { audit: null, earlierEntry: null };
  const newestEntry = read.audit[0];
  // The newest page starts with the effective entry: its sequence counts the chain.
  const entryCount =
    newestEntry?.recordId === read.effectiveRecordId
      ? newestEntry.sequence + 1
      : (effectiveRow?.entryCount ?? null);
  const isEffectiveShown = read.record.recordId === read.effectiveRecordId;
  const earlierEntry = isEffectiveShown
    ? null
    : earlierEntryLabel(ordinal.shownSequence, entryCount);
  if (entryCount === null || entryCount < 2)
    return { audit: null, earlierEntry };

  const rulesetFor = (recordId: string): RulesetView => {
    const known = knownRuleset(recordId);
    if (known !== undefined) return { status: 'ready', version: known };
    const result =
      rulesets[
        unknownRulesets.findIndex((entry) => entry.recordId === recordId)
      ];
    if (!result || result.isPending) return { status: 'loading' };
    if (result.isSuccess && result.data)
      return { status: 'ready', version: result.data.record.rulesetVersion };
    return {
      status: 'failed',
      retry: () => {
        void result.refetch();
      },
    };
  };
  const choose = (entry: AuditRow) => {
    ordinal.remember(read.week, entry);
    const isEffective = entry.recordId === read.effectiveRecordId;
    select({
      week: read.week,
      recordId: isEffective ? undefined : entry.recordId,
      beforeSequence: selection.beforeSequence,
    });
  };
  const pageView = ((): AuditPageView => {
    if (pageFailed || page === null)
      return {
        status: 'failed',
        retry: () => {
          void pagedRead.refetch();
        },
      };
    if (page === undefined) return { status: 'loading' };
    const { audit, earlierSequence } = page;
    return {
      status: 'ready',
      entries: audit.map((entry) => ({
        recordId: entry.recordId,
        label: `Entry ${entry.sequence + 1}`,
        provenance: provenanceLabels[entry.provenance],
        date: recordDate(entry.createdAt),
        ruleset: rulesetFor(entry.recordId),
        isSelected: entry.recordId === read.record.recordId,
        isEffective: entry.recordId === read.effectiveRecordId,
        select: () => choose(entry),
      })),
      // Paging keeps the selection as it is: an explicit entry stays pinned,
      // and the effective record is not turned into one.
      earlier:
        earlierSequence === null
          ? null
          : () =>
              select({
                week: read.week,
                recordId: selection.recordId,
                beforeSequence: earlierSequence,
              }),
    };
  })();

  return {
    earlierEntry,
    audit: {
      entryCount,
      isOpen,
      toggle: () => {
        setDisclosure({ week: read.week, isOpen: !isOpen });
        // Reopening starts again from the newest entries.
        if (!isOpen && isPaged)
          select({ week: read.week, recordId: selection.recordId });
      },
      page: pageView,
    },
  };
}
