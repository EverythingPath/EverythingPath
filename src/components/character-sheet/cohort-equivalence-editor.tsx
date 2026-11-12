'use client';
import { useEffect, useId, useRef } from 'react';
import { useWatch } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import { Form } from '~/components/ui/form';
import { maxCohortCreatureLength } from '~/lib/character-sheet-cohort';
import { cn } from '~/lib/utils';
import { CohortCreatureField } from './cohort-creature-field';
import { CohortKindField } from './cohort-kind-field';
import { CohortTextField } from './cohort-text-field';
import type { CohortController } from './companion-props';
import { action, noteText, SaveFeedback } from './sheet-parts';

/**
 * The cohort's Cohort Equivalence as one local form beneath its fact
 * (#417): what it is based on as cards, then the published creature or the
 * unlisted creature's name and level. Structural mistakes stop the save
 * beside their field; a refused save keeps the draft and its reason here.
 * Escape and Cancel close it without writing.
 */
export function CohortEquivalenceEditor({
  controller,
  reasonId,
}: {
  controller: CohortController;
  reasonId: string | undefined;
}) {
  const form = controller.equivalenceForm;
  const kind = useWatch({ control: form.control, name: 'kind' });
  const headingId = useId();
  const clearNoteId = useId();
  const element = useRef<HTMLFormElement>(null);
  const isSaving = controller.equivalenceStatus.kind === 'saving';
  const isLocked = controller.isDisabled || isSaving;

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
          if (!isLocked) void controller.submitEquivalence();
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          controller.closeEquivalence();
        }}
      >
        <h4 id={headingId} className="font-sans text-base">
          Edit Cohort Equivalence
        </h4>
        <CohortKindField form={form} disabled={isLocked} />
        {kind === 'published' ? (
          <CohortCreatureField
            form={form}
            choices={controller.creatureChoices}
            disabled={isLocked}
          />
        ) : null}
        {kind === 'entered' ? (
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            <CohortTextField
              control={form.control}
              name="creature"
              label="Creature"
              disabled={isLocked}
              maxLength={maxCohortCreatureLength}
            />
            <CohortTextField
              control={form.control}
              name="level"
              label="Cohort Equivalence"
              keyboard="numeric"
              disabled={isLocked}
              description="Leave empty until you know it; the sheet shows it as missing. Hit Dice and Challenge Rating are not used."
            />
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            type="submit"
            size="sm"
            className={action}
            aria-describedby={reasonId}
            disabled={isLocked}
          >
            {isSaving ? 'Saving…' : 'Save'}{' '}
            <span className="sr-only">Cohort Equivalence</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={action}
            onClick={controller.closeEquivalence}
          >
            Cancel <span className="sr-only">editing Cohort Equivalence</span>
          </Button>
          {controller.view?.recorded ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={cn(action, 'text-muted-foreground')}
              aria-describedby={[clearNoteId, reasonId]
                .filter(Boolean)
                .join(' ')}
              disabled={isLocked}
              onClick={() => void controller.clearEquivalence()}
            >
              Use Class Levels
            </Button>
          ) : null}
          <SaveFeedback
            status={controller.equivalenceStatus}
            savedText="Saved"
            shouldHideWhenIdle
          />
        </div>
        {controller.view?.recorded ? (
          <p id={clearNoteId} className={noteText}>
            Use Class Levels makes this an ordinary cohort again and keeps every
            other choice.
          </p>
        ) : null}
      </form>
    </Form>
  );
}
