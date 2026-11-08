'use client';
import { createContext, useContext, type ReactNode } from 'react';
import type { Doc } from '@convex/_generated/dataModel';

export type CampaignAccess = {
  campaign: Doc<'campaign'>;
  organizationId: string;
};
const CampaignContext = createContext<CampaignAccess | null>(null);

// Only the shell's access gate provides this, so page hosts never subscribe
// to campaign data before the active organization's list confirms access.
export function CampaignProvider({
  value,
  children,
}: {
  value: CampaignAccess;
  children: ReactNode;
}) {
  return (
    <CampaignContext.Provider value={value}>
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaign(): CampaignAccess {
  const value = useContext(CampaignContext);
  if (!value)
    throw new Error(
      'useCampaign requires the campaign shell to resolve access',
    );
  return value;
}
