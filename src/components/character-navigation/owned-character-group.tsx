import type { CharacterListGroup } from './character-list-model';
import { OwnedCharacterRow } from './owned-character-row';

// The group header is an eyebrow: the campaign (or No campaign), then the
// organization it belongs to, since the area spans every organization.
export function OwnedCharacterGroup({ group }: { group: CharacterListGroup }) {
  return (
    <section aria-label={group.title}>
      <div className="text-muted-foreground mb-1 flex flex-wrap items-baseline gap-x-2 text-xs tracking-widest uppercase">
        <h2>{group.title}</h2>
        {group.organizationName ? (
          <p className="font-mono tracking-normal normal-case">
            · {group.organizationName}
          </p>
        ) : null}
      </div>
      {group.characters.length ? (
        <ul className="divide-foreground/15 divide-y">
          {group.characters.map((character) => (
            <OwnedCharacterRow key={character.id} character={character} />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground py-2 text-sm">No characters yet.</p>
      )}
    </section>
  );
}
