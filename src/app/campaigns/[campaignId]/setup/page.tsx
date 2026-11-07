'use client';
import { useAuth } from '@clerk/nextjs';
import { useCampaign } from '~/components/campaign-shell/campaign-context';
import { MilitiaSetupScreen } from '~/components/militia-setup/screen';

export default function SetupPage() {
  const { campaign, organizationId } = useCampaign();
  const { userId } = useAuth();
  return (
    <MilitiaSetupScreen
      accountId={userId}
      organizationId={organizationId}
      campaignId={campaign._id}
    />
  );
}
