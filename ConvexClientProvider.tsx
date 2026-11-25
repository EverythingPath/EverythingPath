'use client';

import { MigrationConvexClient } from '~/lib/migration-convex-client';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@clerk/nextjs';
import {
  QueryClientProvider,
  QueryErrorResetBoundary,
} from '@tanstack/react-query';
import { createQueryClient } from '~/lib/convex-query-client';

// Safe cast: Next inlines NEXT_PUBLIC_CONVEX_URL at build time, and the app's
// required env (including the e2e runner's fixture env) always sets it.
const convex = new MigrationConvexClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const queryClient = createQueryClient(convex);
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  useEffect(() => {
    if (isLoaded && !isSignedIn) convex.startMaintenance();
  }, [isLoaded, isSignedIn]);
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <QueryClientProvider client={queryClient}>
        <QueryErrorResetBoundary>{children}</QueryErrorResetBoundary>
      </QueryClientProvider>
    </ConvexProviderWithClerk>
  );
}
