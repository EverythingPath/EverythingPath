'use client';
import { useMemo } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { weekPath } from '~/lib/campaign-routes';
import { weeklyDraftSchema } from '~/lib/weekly-draft-contract';
import {
  workspaceSourceSchema,
  type WorkspaceSource,
} from '~/lib/weekly-workspace-source';
import type { Phase } from '~/components/weekly-draft-workspace/types';
import type { FinishedWeekListing } from '~/components/historical-week/finished-week-index';
import { continueTarget } from './continue-week';
import { militiaSummaryParts } from './militia-summary';
import {
  RECENT_WEEK_LIMIT,
  recentWeeks,
  type RecentWeek,
} from './recent-weeks';

type Read<T> = { data?: T; error?: unknown };

export type HomeMilitia =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'none' }
  | { kind: 'ready'; source: WorkspaceSource };
export type ContinueWeek =
  | { kind: 'loading'; week: number }
  | { kind: 'failed'; week: number; retry: () => void }
  | { kind: 'ready'; week: number; phase: Phase; href: string };
export type RecentHistory =
  | { kind: 'loading' }
  | { kind: 'failed'; retry: () => void }
  | { kind: 'ready'; weeks: RecentWeek[] };
export type CampaignHomeContentState =
  | { kind: 'loading' }
  | { kind: 'failed'; retry: () => void }
  // Setup and Characters only: no militia or history is read.
  | { kind: 'no_militia' }
  | {
      kind: 'militia';
      summary: string[];
      continueWeek: ContinueWeek;
      recent: RecentHistory;
    };

/** Loading and failure are never "no militia". */
export function homeMilitia(workspace: Read<unknown>): HomeMilitia {
  if (workspace.error) return { kind: 'failed' };
  if (workspace.data === undefined) return { kind: 'loading' };
  if (workspace.data === null) return { kind: 'none' };
  const parsed = workspaceSourceSchema.safeParse(workspace.data);
  return parsed.success
    ? { kind: 'ready', source: parsed.data }
    : { kind: 'failed' };
}

/**
 * Continue's target from the source's own open draft. A closed draft or one
 * for an older source is the next week arriving: it waits rather than
 * targeting a stale week.
 */
export function continueWeekTarget(
  source: WorkspaceSource,
  observation: Read<{ status: string; draftId: string; draft: unknown }>,
  retry: () => void,
): ContinueWeek {
  const week = source.week;
  if (observation.error) return { kind: 'failed', week, retry };
  const observed = observation.data;
  if (observed?.status !== 'open' || observed.draftId !== source.key.draftId)
    return { kind: 'loading', week };
  const draft = weeklyDraftSchema.safeParse(observed.draft);
  if (!draft.success) return { kind: 'failed', week, retry };
  const target = continueTarget(draft.data, source);
  return {
    kind: 'ready',
    ...target,
    href: weekPath(source.key.campaignId, target.phase),
  };
}

export function recentHistory(
  campaignId: string,
  list: Read<FinishedWeekListing>,
  retry: () => void,
): RecentHistory {
  if (list.error) return { kind: 'failed', retry };
  if (list.data === undefined) return { kind: 'loading' };
  return { kind: 'ready', weeks: recentWeeks(campaignId, list.data) };
}

/**
 * The selected campaign's home content: current militia facts, Continue
 * week from the Week frame's readiness over the accepted draft, and the
 * latest finished weeks. Only this campaign observes its draft; nothing is
 * written.
 */
export function useCampaignHomeContent(
  campaignId: Id<'campaign'>,
): CampaignHomeContentState {
  const workspace = useQuery(
    convexQuery(api.canonicalDraftPersistence.workspace, { campaignId }),
  );
  const militia = useMemo(
    () => homeMilitia({ data: workspace.data, error: workspace.error }),
    [workspace.data, workspace.error],
  );
  const source = militia.kind === 'ready' ? militia.source : null;
  const observation = useQuery(
    convexQuery(
      api.canonicalDraftPersistence.observe,
      source ? source.key : 'skip',
    ),
  );
  const history = useQuery(
    convexQuery(
      api.canonicalHistory.list,
      source ? { campaignId, limit: RECENT_WEEK_LIMIT } : 'skip',
    ),
  );
  const { refetch: refetchObservation } = observation;
  const continueWeek = useMemo(
    () =>
      source === null
        ? null
        : continueWeekTarget(
            source,
            { data: observation.data, error: observation.error },
            () => void refetchObservation(),
          ),
    [source, observation.data, observation.error, refetchObservation],
  );
  if (militia.kind === 'loading') return { kind: 'loading' };
  if (militia.kind === 'failed')
    return { kind: 'failed', retry: () => void workspace.refetch() };
  if (militia.kind === 'none' || continueWeek === null)
    return { kind: 'no_militia' };
  return {
    kind: 'militia',
    summary: militiaSummaryParts(militia.source.snapshot),
    continueWeek,
    recent: recentHistory(
      campaignId,
      { data: history.data, error: history.error },
      () => void history.refetch(),
    ),
  };
}
