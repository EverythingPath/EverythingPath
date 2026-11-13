'use client';
import { useEffect, useRef } from 'react';
import { Button } from '~/components/ui/button';
import { Form } from '~/components/ui/form';
import { cn } from '~/lib/utils';
import type { LeadershipSourceView } from './character-cohort-view-model';
import { CohortReputationField } from './cohort-reputation-field';
import { CohortSwitchField } from './cohort-switch-field';
import { CohortTextField } from './cohort-text-field';
import type { CohortController } from './companion-props';
import { action, SaveFeedback } from './sheet-parts';

/**
 * One cohort source's Leadership modifiers as a local form beneath its
 * read view (#417): the leader's reputation as cards, the two yes-or-no
 * modifiers as switches, cohorts killed and any other modifiers typed.
 * Structural mistakes stop the save beside their field; a refused save
 * keeps the draft and its reason here. Escape and Cancel close it without
 * writing; Clear removes the recorded modifiers so the base score applies.
 */
export function CohortLeadershipEditor({
  source,
  controller,
  reasonId,
}: {
  source: LeadershipSourceView;
  controller: CohortController;
  reasonId: string | undefined;
}) {
  const form = controller.leadershipForm;
  const element = useRef<HTMLFormElement>(null);
  const status = controller.leadershipStatusFor(source.key);
  const isSaving = status.kind === 'saving';
  const isLocked = controller.isDisabled || isSaving;
  const { cohortModifierChoices } = controller;

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
        aria-label={`Leadership modifiers for ${source.cohortName}`}
        className="border-foreground/20 flex w-full flex-col gap-3 border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!isLocked) void controller.submitLeadership();
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          controller.closeLeadership();
        }}
      >
        <h5 className="font-sans text-base">Edit Leadership modifiers</h5>
        <CohortReputationField
          form={form}
          choices={controller.reputationChoices}
          disabled={isLocked}
        />
        <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
          <CohortSwitchField
            form={form}
            name="hasCompanion"
            choice={cohortModifierChoices.hasCompanion}
            disabled={isLocked}
            reasonId={reasonId}
          />
          <CohortSwitchField
            form={form}
            name="differentAlignment"
            choice={cohortModifierChoices.differentAlignment}
            disabled={isLocked}
            reasonId={reasonId}
          />
        </div>
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <CohortTextField
            control={form.control}
            name="cohortDeaths"
            label="Cohorts killed"
            keyboard="numeric"
            disabled={isLocked}
            description={cohortModifierChoices.cohortDeaths.modifier}
          />
          <CohortTextField
            control={form.control}
            name="other"
            label="Other modifiers"
            disabled={isLocked}
            description="Modifiers from rules outside the Core Rulebook table."
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            type="submit"
            size="sm"
            className={action}
            aria-describedby={reasonId}
            disabled={isLocked}
          >
            {isSaving ? 'Saving…' : 'Save'}{' '}
            <span className="sr-only">Leadership modifiers</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={action}
            onClick={controller.closeLeadership}
          >
            Cancel <span className="sr-only">editing Leadership modifiers</span>
          </Button>
          {source.recorded ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={cn(action, 'text-muted-foreground')}
              aria-describedby={reasonId}
              disabled={isLocked}
              onClick={() => void controller.clearLeadership(source)}
            >
              Clear modifiers{' '}
              <span className="sr-only">for {source.cohortName}</span>
            </Button>
          ) : null}
          <SaveFeedback status={status} savedText="Saved" shouldHideWhenIdle />
        </div>
      </form>
    </Form>
  );
}
