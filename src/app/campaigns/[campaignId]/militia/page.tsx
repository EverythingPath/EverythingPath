'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCampaign } from '~/components/campaign-shell/campaign-context';
import { MilitiaSection } from '~/components/campaign-sections/militia-section';
import { MilitiaPageFrame } from '~/components/campaign-sections/page-frames';
import { MilitiaSkeleton } from '~/components/militia-corrections/militia-skeleton';
import { parseMilitiaEntry } from '~/lib/militia-correction-sections';

// Thin address adapter: the entry to open lives in the address
// (`?section=teams`), so a link can land straight on one correction.
function MilitiaHost() {
  const { campaign, organizationId } = useCampaign();
  const params = useSearchParams();
  return (
    <MilitiaSection
      campaignId={campaign._id}
      organizationId={organizationId}
      initialEntry={parseMilitiaEntry(params.get('section'))}
    />
  );
}

export default function MilitiaPage() {
  return (
    <MilitiaPageFrame>
      <Suspense fallback={<MilitiaSkeleton />}>
        <MilitiaHost />
      </Suspense>
    </MilitiaPageFrame>
  );
}
