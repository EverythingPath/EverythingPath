'use client';
import { useParams } from 'next/navigation';
import { CharacterSheetPage } from '~/components/character-sheet/character-sheet-page';
import { useCharacterSheetNavigation } from '~/components/character-sheet/use-character-sheet-navigation';
import { OrganizationSwitchNotice } from '~/components/character-navigation/organization-switch-notice';
import { decodeRouteSegment } from '~/lib/campaign-routes';
export default function IndependentCharacterSheetRoute() {
  const { characterId: encodedId } = useParams<{ characterId: string }>();
  const characterId = decodeRouteSegment(encodedId);
  const navigation = useCharacterSheetNavigation(characterId);
  return (
    <>
      <OrganizationSwitchNotice status={navigation.organizationSwitch} />
      <CharacterSheetPage
        characterId={characterId}
        back={navigation.back}
        origin={navigation.origin}
        campaignName={navigation.campaign?.campaignName}
      />
    </>
  );
}
