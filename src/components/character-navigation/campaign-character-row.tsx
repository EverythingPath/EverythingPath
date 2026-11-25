'use client';
import type { CampaignScope } from '~/lib/campaign-scope';
import { CharacterOwnerControl } from '~/components/character-sheet/character-owner-control';
import { useCharacterOwnership } from '~/components/character-sheet/use-character-ownership';
import { useBreakpoint } from '~/components/use-breakpoint';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { cn } from '~/lib/utils';
import { CharacterCompanionLinks } from './character-companion-links';
import { cellClass } from './character-list-classes';
import type { CampaignCharacterListRow } from './character-list-model';
import {
  CharacterStateBadge,
  NeedsOwnerBadge,
  OwnerDepartedBadge,
} from './character-state-badge';
import { RosterState } from './roster-state';

// Owner and state have their own columns from tablet width; on phone they
// move under the name so the three remaining columns fit.
export function CampaignCharacterRow({
  character,
  scope,
}: {
  character: CampaignCharacterListRow;
  scope: CampaignScope;
}) {
  const isWide = useBreakpoint('wide');
  const ownership = useCharacterOwnership(
    { ...scope, characterId: character.id },
    character.owner,
    character.ownerLastOperationId,
    character.ownershipAvailable,
  );
  // The departed badge keeps the owner's name beside it, so a production
  // campaign without the owner control still says who left. The needs-owner
  // badge stands in the owner's place within the control (#708), said once.
  const ownerControl = (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <CharacterOwnerControl
        characterName={character.name}
        ownership={ownership}
        isLabelled={false}
        needsOwnerLabel={<NeedsOwnerBadge />}
      />
      {character.ownerDeparted ? (
        <OwnerDepartedBadge ownerName={character.ownerName} />
      ) : null}
    </div>
  );
  return (
    <tr className="border-foreground/15 border-b">
      <td className={cellClass}>
        {character.href ? (
          <GuardedLink
            href={character.href}
            className="hover:text-primary focus-visible:ring-ring/50 inline-flex min-h-11 items-center rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] md:min-h-0"
          >
            {character.name}
          </GuardedLink>
        ) : (
          character.name
        )}
        <span className="text-muted-foreground block text-xs">
          {character.kind}
          <span className="md:hidden">
            {' '}
            · {character.active ? 'Active' : 'Archived'}
          </span>
        </span>
        {!isWide ? ownerControl : null}
        {character.companions ? (
          <div className="flex flex-wrap items-center">
            <CharacterCompanionLinks
              characterName={character.name}
              source={character.companions}
            />
          </div>
        ) : null}
      </td>
      <td className={cn(cellClass, 'hidden md:table-cell')}>
        {isWide ? ownerControl : null}
      </td>
      <td className={cn(cellClass, 'whitespace-nowrap')}>{character.level}</td>
      <td className={cn(cellClass, 'hidden md:table-cell')}>
        <CharacterStateBadge active={character.active} />
      </td>
      <td className={cn(cellClass, 'whitespace-nowrap')}>
        <RosterState isOnRoster={character.isOnRoster === true} />
      </td>
    </tr>
  );
}
