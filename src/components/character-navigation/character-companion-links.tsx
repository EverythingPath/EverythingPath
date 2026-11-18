'use client';
import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '~/components/ui/button';
import { buildCompanionRelationshipView } from '~/components/character-sheet/character-companions-view-model';
import { CompanionRelationshipSummary } from '~/components/character-sheet/companion-relationship-summary';
import { cn } from '~/lib/utils';
import type { CompanionLinksSource } from './character-list-model';

const note = 'text-muted-foreground py-1 text-sm';

/**
 * A Character's Companion Relationships, disclosed from its list row: each
 * related Character with its role, kind and status, linked to its sheet
 * while accessible. Read only once expanded, so the list never loads every
 * Character's relationships. An inaccessible endpoint reads as unavailable.
 * Renders the toggle and, when open, a full-width panel beneath the row.
 */
export function CharacterCompanionLinks({
  characterName,
  source,
}: {
  characterName: string;
  source: CompanionLinksSource;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const panelId = useId();
  const relationships = useQuery(
    api.companionRelationships.list,
    isExpanded ? { characterId: source.characterId } : 'skip',
  );
  const rows = relationships?.map((relationship) =>
    buildCompanionRelationshipView(relationship, source.origin),
  );
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground min-h-11 px-2 md:min-h-8"
        aria-expanded={isExpanded}
        aria-controls={isExpanded ? panelId : undefined}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        Companions <span className="sr-only">of {characterName}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            'transition-transform motion-reduce:transition-none',
            isExpanded && 'rotate-180',
          )}
        />
      </Button>
      {isExpanded ? (
        <div id={panelId} className="w-full basis-full px-1 pb-2">
          {!rows ? (
            <p role="status" className={note}>
              Loading companions…
            </p>
          ) : null}
          {rows?.length === 0 ? (
            <p className={note}>No Companion Relationships.</p>
          ) : null}
          {rows && rows.length > 0 ? (
            <ul
              aria-label={`Companions of ${characterName}`}
              className="border-foreground/15 flex flex-col gap-2 border-l pl-3"
            >
              {rows.map((row) => (
                <li
                  key={row.relationshipId}
                  aria-label={`${row.roleLabel} ${row.name}`}
                >
                  <CompanionRelationshipSummary row={row} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
