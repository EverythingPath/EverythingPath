'use client';
import { useQuery } from '@tanstack/react-query';
import { convexQuery } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { MilitiaPage } from '~/components/militia-corrections/militia-page';
import { MilitiaSkeleton } from '~/components/militia-corrections/militia-skeleton';
import { useMilitiaCorrections } from '~/components/militia-corrections/use-militia-corrections';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { campaignPath } from '~/lib/campaign-routes';
import type { MilitiaEntryKey } from '~/lib/militia-correction-sections';

function MilitiaCorrections(props: {
  campaignId: Id<'campaign'>;
  militiaId: Id<'militia'>;
  draftId: string;
  organizationId: string;
  initialEntry?: MilitiaEntryKey;
}) {
  const page = useMilitiaCorrections(props);
  if (page.status === 'loading') return <MilitiaSkeleton />;
  return <MilitiaPage page={page} />;
}

// Militia Correction in place: accepted facts by section, one reasoned
// correction at a time. Character records stay on Characters & officers.
export function MilitiaSection({
  campaignId,
  organizationId,
  initialEntry,
}: {
  campaignId: Id<'campaign'>;
  organizationId: string;
  /** The entry the address selects, e.g. Teams. */
  initialEntry?: MilitiaEntryKey;
}) {
  const { data: source } = useQuery({
    ...convexQuery(api.canonicalDraftPersistence.workspace, {
      campaignId,
    }),
    throwOnError: true,
  });
  if (source === undefined) return <MilitiaSkeleton />;
  if (source)
    return (
      // A campaign, militia or organization change discards the open
      // correction and any late result of its Save.
      <MilitiaCorrections
        key={`${organizationId}:${campaignId}:${source.key.militiaId}`}
        campaignId={campaignId}
        militiaId={source.key.militiaId}
        draftId={source.key.draftId}
        organizationId={organizationId}
        initialEntry={initialEntry}
      />
    );
  return (
    <Card role="status" className="gap-3 p-4">
      <p>No militia yet.</p>
      <div>
        <Button asChild>
          <GuardedLink href={campaignPath(campaignId, 'setup')}>
            Set up militia
          </GuardedLink>
        </Button>
      </div>
    </Card>
  );
}
