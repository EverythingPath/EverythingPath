'use client';
import { CompanionCardChoiceField } from './companion-card-choice-field';
import type {
  CompanionFieldProps,
  CompanionsController,
} from './companion-props';

const note = 'text-muted-foreground text-xs';

function describeCandidates(controller: CompanionsController) {
  if (controller.isCandidatesLoading)
    return (
      <p role="status" className={note}>
        Loading Characters…
      </p>
    );
  if (controller.candidates?.length === 0)
    return <p className={note}>No compatible Characters to link.</p>;
  return null;
}

/** The accessible existing sheets, as cards; never a typed identifier. */
export function CompanionCandidateField(props: CompanionFieldProps) {
  return (
    <CompanionCardChoiceField
      {...props}
      name="companionCharacterId"
      label="Character"
      options={(props.controller.candidates ?? []).map((candidate) => ({
        value: candidate.characterId,
        label: candidate.name,
      }))}
      note={describeCandidates(props.controller)}
    />
  );
}
