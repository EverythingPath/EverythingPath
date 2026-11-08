'use client';
import { useAuth, useClerk, useOrganization } from '@clerk/nextjs';
import { useConvexAuth } from 'convex/react';

export type Organization = { id: string; name: string };
export type Session =
  | { kind: 'resolving' }
  // Sign-in itself could not start on this page, so who is asking is
  // unknown. It is neither signed out nor a denial, and it never settles by
  // itself: only a new page load retries it.
  | { kind: 'unreachable' }
  | { kind: 'signed_out' }
  | { kind: 'no_organization' }
  | { kind: 'member'; organization: Organization };

type ClerkStatus = ReturnType<typeof useClerk>['status'];

export function classifySession({
  clerkStatus,
  auth,
  organization,
  convexAuth,
}: {
  clerkStatus: ClerkStatus;
  auth: { isLoaded: boolean; isSignedIn?: boolean | null };
  organization: {
    isLoaded: boolean;
    organization?: { id: string; name: string } | null;
  };
  convexAuth: { isLoading: boolean; isAuthenticated: boolean };
}): Session {
  // Clerk reports 'error' once its script or its start failed; its auth and
  // organization then stay unloaded and Convex auth stays loading forever.
  if (clerkStatus === 'error') return { kind: 'unreachable' };
  if (!auth.isLoaded || !organization.isLoaded || convexAuth.isLoading)
    return { kind: 'resolving' };
  if (auth.isSignedIn !== true || !convexAuth.isAuthenticated)
    return { kind: 'signed_out' };
  if (!organization.organization) return { kind: 'no_organization' };
  return {
    kind: 'member',
    organization: {
      id: organization.organization.id,
      name: organization.organization.name,
    },
  };
}

// Who is asking: sign-in and active organization must both be settled before
// any campaign list is read, so nothing from a previous organization shows.
export function useSession(): Session {
  return classifySession({
    clerkStatus: useClerk().status,
    auth: useAuth(),
    organization: useOrganization(),
    convexAuth: useConvexAuth(),
  });
}
