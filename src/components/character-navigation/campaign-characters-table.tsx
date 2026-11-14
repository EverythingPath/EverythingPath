import type { CampaignScope } from '~/lib/campaign-scope';
import { cn } from '~/lib/utils';
import { CampaignCharacterRow } from './campaign-character-row';
import { headerCellClass } from './character-list-classes';
import type { CampaignCharacterListRow } from './character-list-model';

export function CampaignCharactersTable({
  characters,
  scope,
}: {
  characters: CampaignCharacterListRow[];
  scope: CampaignScope;
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-foreground/20 border-b">
          <th scope="col" className={cn(headerCellClass, 'w-full')}>
            Name
          </th>
          <th
            scope="col"
            className={cn(headerCellClass, 'hidden md:table-cell')}
          >
            Owner
          </th>
          <th scope="col" className={headerCellClass}>
            Level
          </th>
          <th
            scope="col"
            className={cn(headerCellClass, 'hidden md:table-cell')}
          >
            Status
          </th>
          <th scope="col" className={cn(headerCellClass, 'whitespace-nowrap')}>
            Roster
          </th>
        </tr>
      </thead>
      <tbody>
        {characters.map((character) => (
          <CampaignCharacterRow
            key={character.id}
            character={character}
            scope={scope}
          />
        ))}
      </tbody>
    </table>
  );
}
