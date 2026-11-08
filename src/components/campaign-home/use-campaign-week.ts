'use client';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

export type CampaignWeek =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'not_set_up' }
  | { kind: 'week'; week: number };

type Read<T> = { data?: T; error?: unknown };

// A campaign without a started militia has no workspace. Loading and failure
// are never "Not set up".
export function campaignWeek(
  workspace: Read<{ week: number } | null>,
): CampaignWeek {
  if (workspace.error) return { kind: 'failed' };
  if (workspace.data === undefined) return { kind: 'loading' };
  if (workspace.data === null) return { kind: 'not_set_up' };
  return { kind: 'week', week: workspace.data.week };
}

/** "Week N" or "Not set up" for one authorized campaign row. */
export function useCampaignWeek(campaignId: Id<'campaign'>): CampaignWeek {
  return campaignWeek(
    useQuery(
      convexQuery(api.canonicalDraftPersistence.workspace, { campaignId }),
    ),
  );
}
