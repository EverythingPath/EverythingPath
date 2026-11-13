import type { ReactNode } from 'react';
import { CampaignShell } from '~/components/campaign-shell/campaign-shell';
import { decodeRouteSegment } from '~/lib/campaign-routes';

export default async function CampaignLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  return (
    <CampaignShell campaignId={decodeRouteSegment(campaignId)}>
      {children}
    </CampaignShell>
  );
}
