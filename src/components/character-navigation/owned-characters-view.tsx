import { pageClass } from './character-list-classes';
import type {
  CharacterListGroup,
  ReturningOrganization,
} from './character-list-model';
import { CharactersTitle } from './characters-title';
import { OwnedCharacterGroup } from './owned-character-group';
import { ReturningCharactersNotice } from './returning-characters-notice';

// The Characters area: my Characters by campaign, No campaign first. While
// Characters are on their way back from an organization the player left,
// that is said once above No campaign, where they will appear.
export function OwnedCharactersView({
  groups,
  returning = [],
  newHref,
}: {
  groups: CharacterListGroup[];
  returning?: ReturningOrganization[];
  newHref?: string;
}) {
  return (
    <main className={pageClass}>
      <CharactersTitle newHref={newHref} />
      <div className="flex flex-col gap-6">
        <ReturningCharactersNotice organizations={returning} />
        {groups.map((group) => (
          <OwnedCharacterGroup key={group.key} group={group} />
        ))}
      </div>
    </main>
  );
}
