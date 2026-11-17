'use client';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useConvex, useConvexAuth } from 'convex/react';
import { zid } from 'convex-helpers/server/zod4';
import { normalizePhase } from '~/lib/campaign-routes';
import { createConvexWorkspaceGateway } from './gateway';
import type { Phase } from './types';
import { WeeklyDraftWorkspaceProvider } from './use-weekly-draft-workspace';

function addressPhase(): Phase {
  if (typeof window === 'undefined') return 'upkeep';
  return normalizePhase(
    new URLSearchParams(window.location.search).get('phase'),
  );
}

// The environment owner: one gateway per verified campaign, sign-in session,
// Week activation and explicit retry. The opening phase is read once when an
// owner is created; later address changes never rebuild the store.
export function CampaignWorkspaceProvider({
  campaignId,
  active,
  openingPhase,
  children,
}: {
  campaignId: string | null;
  active: boolean;
  openingPhase?: Phase;
  children: ReactNode;
}) {
  const convex = useConvex();
  const auth = useConvexAuth();
  const [attempt, setAttempt] = useState(0);
  const opening = useRef(openingPhase);
  opening.current = openingPhase;
  const gateway = useMemo(() => {
    const parsed = zid('campaign').safeParse(campaignId);
    if (!active || !parsed.success || !auth.isAuthenticated || attempt < 0)
      return null;
    return createConvexWorkspaceGateway(
      convex,
      parsed.data,
      opening.current ?? addressPhase(),
    );
  }, [active, campaignId, convex, auth.isAuthenticated, attempt]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return (
    <WeeklyDraftWorkspaceProvider gateway={gateway} retry={retry}>
      {children}
    </WeeklyDraftWorkspaceProvider>
  );
}
