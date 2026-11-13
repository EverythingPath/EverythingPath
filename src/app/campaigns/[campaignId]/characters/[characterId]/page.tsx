import { redirect } from 'next/navigation';
import {
  campaignPath,
  characterSheetPath,
  decodeRouteSegment,
} from '~/lib/campaign-routes';
export default async function CharacterSheetRoute({
  params,
}: {
  params: Promise<{ campaignId: string; characterId: string }>;
}) {
  const route = await params;
  const campaignId = decodeRouteSegment(route.campaignId);
  redirect(
    characterSheetPath(decodeRouteSegment(route.characterId), {
      href: campaignPath(campaignId, 'officers'),
      organization: { kind: 'unrecorded' },
    }),
  );
}
