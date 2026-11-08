'use client';
import {
  characterSheetPath,
  type CharacterSheetOrigin,
} from '~/lib/campaign-routes';
import type { CharacterScope } from './character-scope';
import { CharacterSheetSkeleton } from './character-sheet-frame';
import { SheetUnavailable } from './character-sheet-page';
import { CharacterSpellsView } from './character-spells-view';
import { useCharacterSheet } from './use-character-sheet';

type PageProps = CharacterScope & {
  /** Where the sheet was opened from; "← Sheet" returns to it with the same Back. */
  origin?: CharacterSheetOrigin;
};

function SpellsHost({
  organizationId,
  campaignId,
  characterId,
  origin,
}: PageProps) {
  const scope = { organizationId, campaignId, characterId };
  const controller = useCharacterSheet(scope, origin);
  const back = {
    href: characterSheetPath(characterId, origin),
    label: 'Sheet',
  } as const;
  if (controller.sheet === undefined)
    return <CharacterSheetSkeleton back={back} />;
  if (controller.sheet === null) return <SheetUnavailable back={back} />;
  return (
    <CharacterSpellsView controller={controller} scope={scope} back={back} />
  );
}

/**
 * One Character's Spells page, beside its sheet. The host is keyed on its
 * scope, so a late save reply belongs to the discarded instance. Read
 * failures throw to the route's error boundary, as on the sheet.
 */
export function CharacterSpellsPage(props: PageProps) {
  const {
    organizationId = 'no-organization',
    campaignId = 'no-campaign',
    characterId,
  } = props;
  return (
    <SpellsHost
      key={`${organizationId}/${campaignId}/${characterId}`}
      {...props}
    />
  );
}
