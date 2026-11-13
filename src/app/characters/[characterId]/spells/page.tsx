'use client';
import { useParams } from 'next/navigation';
import { OrganizationSwitchNotice } from '~/components/character-navigation/organization-switch-notice';
import { CharacterSpellsPage } from '~/components/character-sheet/character-spells-page';
import { useCharacterSheetNavigation } from '~/components/character-sheet/use-character-sheet-navigation';
import { decodeRouteSegment } from '~/lib/campaign-routes';
export default function CharacterSpellsRoute() {
  const { characterId: encodedId } = useParams<{ characterId: string }>();
  const characterId = decodeRouteSegment(encodedId);
  const navigation = useCharacterSheetNavigation(characterId);
  return (
    <>
      <OrganizationSwitchNotice status={navigation.organizationSwitch} />
      <CharacterSpellsPage
        characterId={characterId}
        origin={navigation.origin}
      />
    </>
  );
}
