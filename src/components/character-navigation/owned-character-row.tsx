import { ChevronRight } from 'lucide-react';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { CharacterCompanionLinks } from './character-companion-links';
import type { OwnedCharacterListRow } from './character-list-model';
import { CharacterStateBadge } from './character-state-badge';

export function OwnedCharacterRow({
  character,
}: {
  character: OwnedCharacterListRow;
}) {
  return (
    <li className="flex flex-wrap items-center">
      <GuardedLink
        href={character.href}
        className="hover:bg-foreground/5 focus-visible:ring-ring/50 flex min-h-11 min-w-0 flex-1 items-center gap-3 px-1 py-2 outline-none focus-visible:ring-[3px] focus-visible:ring-inset"
      >
        <span className="min-w-0 flex-1">
          <span className="block break-words">{character.name}</span>
          <span className="text-muted-foreground block text-sm">
            Level {character.level} · {character.kind}
          </span>
        </span>
        <CharacterStateBadge active={character.active} />
        <ChevronRight
          className="text-muted-foreground size-4 shrink-0"
          aria-hidden
        />
      </GuardedLink>
      {character.companions ? (
        <CharacterCompanionLinks
          characterName={character.name}
          source={character.companions}
        />
      ) : null}
    </li>
  );
}
