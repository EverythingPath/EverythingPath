'use client';
import { useEffect, useId, useRef } from 'react';
import type { AnimalCompanionProgressionState } from '~/lib/character-sheet-companion-progression';
import { Button } from '~/components/ui/button';
import { Form } from '~/components/ui/form';
import type { CompanionProgressionView } from './character-companion-progression-view-model';
import { CompanionProgressionAbilityFields } from './companion-progression-ability-fields';
import { CompanionProgressionHpField } from './companion-progression-hp-field';
import { CompanionProgressionRankFields } from './companion-progression-rank-fields';
import { CompanionProgressionSpeciesField } from './companion-progression-species-field';
import type { SaveStatus } from './save-status';
import { action, SaveFeedback } from './sheet-parts';
import {
  companionProgressionInput,
  useCompanionProgressionForm,
} from './use-companion-progression-form';

/**
 * The Companion's recorded choices as one local form beneath the summary:
 * species as cards, hit points (or explicitly none yet), skill ranks and
 * ability increases. Structural mistakes stop the save beside their field;
 * going over a budget does not. A failed save keeps the draft and its
 * reason here; Escape and Cancel close it without writing.
 */
export function CharacterCompanionProgressionEditor({
  choices,
  speciesChoices,
  isDisabled,
  status,
  reasonId,
  onSave,
  onClose,
}: {
  choices: AnimalCompanionProgressionState | null;
  speciesChoices: CompanionProgressionView['speciesChoices'];
  isDisabled: boolean;
  status: SaveStatus;
  reasonId: string | undefined;
  onSave: (progression: AnimalCompanionProgressionState) => Promise<boolean>;
  onClose: () => void;
}) {
  const form = useCompanionProgressionForm(choices);
  const headingId = useId();
  const element = useRef<HTMLFormElement>(null);
  const isSaving = status.kind === 'saving';
  const isLocked = isDisabled || isSaving;
  const heading = choices
    ? 'Edit companion choices'
    : 'Set up companion progression';

  // Opening moves focus into the form, to its first choice.
  useEffect(() => {
    element.current
      ?.querySelector<HTMLElement>('input:not([disabled]), button')
      ?.focus();
  }, []);

  return (
    <Form {...form}>
      <form
        ref={element}
        noValidate
        aria-labelledby={headingId}
        className="border-foreground/20 flex w-full flex-col gap-3 border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (isLocked) return;
          void form.handleSubmit((values) =>
            onSave(companionProgressionInput(values, choices)),
          )();
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }}
      >
        <h4 id={headingId} className="font-sans text-base">
          {heading}
        </h4>
        <CompanionProgressionSpeciesField
          form={form}
          options={speciesChoices}
          recordedSpecies={choices?.species ?? null}
          disabled={isLocked}
        />
        <CompanionProgressionHpField disabled={isLocked} />
        <CompanionProgressionRankFields disabled={isLocked} />
        <CompanionProgressionAbilityFields disabled={isLocked} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            type="submit"
            size="sm"
            className={action}
            aria-describedby={reasonId}
            disabled={isLocked}
          >
            {isSaving ? 'Saving…' : 'Save companion choices'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={action}
            onClick={onClose}
          >
            Cancel <span className="sr-only">{heading}</span>
          </Button>
          <SaveFeedback status={status} savedText="Saved" shouldHideWhenIdle />
        </div>
      </form>
    </Form>
  );
}
