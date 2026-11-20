'use client';
import type { Id } from '@convex/_generated/dataModel';
import { useState } from 'react';
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { CharacterArrival } from './character-arrival';
import {
  useOwnedMoveCandidates,
  type MoveCandidate,
} from './use-owned-move-candidates';

/**
 * Add from my characters (approved variant B's AddFromMineDialog): the
 * player's own Characters outside this campaign as cards, each saying where
 * it comes from, then the chosen one's join or move. The chosen Character
 * is kept while its move runs, so it stays in view after arriving here even
 * though the list then leaves it out. Mounted only while open.
 */
export function AddFromMyCharactersDialog({
  campaignId,
  campaignName,
  organizationId,
}: {
  campaignId: Id<'campaign'>;
  campaignName: string;
  organizationId: string;
}) {
  const candidates = useOwnedMoveCandidates(campaignId);
  const [chosen, setChosen] = useState<MoveCandidate | null>(null);
  return (
    <DialogContent className="bg-card sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="font-sans">Add from my characters</DialogTitle>
        <DialogDescription>
          A character is in one campaign at a time; adding one that’s elsewhere
          moves it to {campaignName}.
        </DialogDescription>
      </DialogHeader>
      {candidates === undefined ? (
        <p role="status" className="text-muted-foreground text-sm">
          Loading your characters…
        </p>
      ) : candidates.length === 0 && !chosen ? (
        <p className="text-muted-foreground text-sm">
          All your available characters are already here.
        </p>
      ) : candidates.length ? (
        <RadioGroup
          aria-label="My characters"
          value={chosen?.id ?? ''}
          onValueChange={(value) =>
            setChosen(
              candidates.find((candidate) => candidate.id === value) ?? null,
            )
          }
          className="max-h-[40dvh] gap-1 overflow-y-auto"
        >
          {candidates.map((candidate) => (
            <RadioGroupItem
              key={candidate.id}
              value={candidate.id}
              className="justify-start text-left font-sans"
            >
              <span className="min-w-0 flex-1">
                <span className="block [overflow-wrap:anywhere]">
                  {candidate.name}
                </span>
                <span className="text-muted-foreground block text-xs">
                  Level {candidate.level} · {candidate.kind} ·{' '}
                  {candidate.fromCampaignName
                    ? `Moves from ${candidate.fromCampaignName}`
                    : 'No campaign'}
                </span>
              </span>
            </RadioGroupItem>
          ))}
        </RadioGroup>
      ) : null}
      {chosen ? (
        <section
          aria-label={`Add ${chosen.name}`}
          className="border-foreground/15 border-t pt-3"
        >
          <CharacterArrival
            key={chosen.id}
            candidate={chosen}
            campaignId={campaignId}
            campaignName={campaignName}
            organizationId={organizationId}
          />
        </section>
      ) : null}
    </DialogContent>
  );
}
