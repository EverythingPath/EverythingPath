'use client';

import { useEffect, useState } from 'react';
import { useConvex } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { locateAuditSequence } from '~/lib/audit-ordinal';
import type { AuditRow, HistoryRead } from './history-read';

type Lookup = {
  week: number;
  recordId: string;
  /** Where the search starts: the page after the one already on screen. */
  from: number;
};
type Located = { key: string; sequence: number | null };

const lookupKey = ({ week, recordId, from }: Lookup) =>
  `${week}:${recordId}:${from}`;

/**
 * The shown record's sequence ("Entry N"): from the audit rows on hand, a
 * sequence remembered when the entry was picked, or, for a direct link, a
 * bounded page-by-page search that stops at the entry and is cancelled when
 * the selection changes.
 */
export function useAuditOrdinal({
  campaignId,
  read,
  pageRows,
}: {
  campaignId: Id<'campaign'>;
  read: HistoryRead | undefined;
  pageRows: AuditRow[];
}) {
  const convex = useConvex();
  const [remembered, setRemembered] = useState<Record<string, number>>({});
  const [located, setLocated] = useState<Located | null>(null);
  const shownId = read?.record.recordId;
  const rememberedKey = `${read?.week}:${shownId}`;
  const onScreen = [...(read?.audit ?? []), ...pageRows].find(
    (entry) => entry.recordId === shownId,
  )?.sequence;
  const lookup: Lookup | null =
    read &&
    shownId !== read.effectiveRecordId &&
    onScreen === undefined &&
    remembered[rememberedKey] === undefined &&
    read.earlierSequence !== null
      ? {
          week: read.week,
          recordId: read.record.recordId,
          from: read.earlierSequence,
        }
      : null;
  const key = lookup && lookupKey(lookup);
  const week = lookup?.week;
  const recordId = lookup?.recordId;
  const from = lookup?.from;

  useEffect(() => {
    if (week === undefined || recordId === undefined || from === undefined)
      return;
    const signal = { cancelled: false };
    const settle = (sequence: number | null) => {
      if (!signal.cancelled)
        setLocated({ key: lookupKey({ week, recordId, from }), sequence });
    };
    locateAuditSequence(
      (beforeSequence) =>
        convex.query(api.canonicalHistory.read, {
          campaignId,
          week,
          beforeSequence,
        }),
      recordId,
      { from, signal },
    ).then(settle, () => settle(null));
    return () => {
      signal.cancelled = true;
    };
  }, [convex, campaignId, week, recordId, from]);

  return {
    shownSequence:
      onScreen ??
      remembered[rememberedKey] ??
      (located?.key === key ? located.sequence : null),
    remember: (entryWeek: number, entry: AuditRow) =>
      setRemembered((current) => ({
        ...current,
        [`${entryWeek}:${entry.recordId}`]: entry.sequence,
      })),
  };
}
