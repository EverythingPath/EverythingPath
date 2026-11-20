'use client';
import { useId } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { CohortAllowedLevel } from './cohort-allowed-level';
import { CohortEquivalenceEditor } from './cohort-equivalence-editor';
import { CohortEquivalenceFact } from './cohort-equivalence-fact';
import type { CohortController } from './companion-props';
import { InlineWarning } from './inline-warning';
import {
  action,
  blockHeading,
  noteText,
  RemoteNotice,
  SaveFeedback,
} from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';
import { useFocusAfterEditorCloses } from './use-focus-after-editor-closes';

type CohortView = NonNullable<CohortController['view']>;

/**
 * The cohort's own sheet (#417): whether its leader supports it, its Cohort
 * Equivalence with the editor beneath, the level the leader allows while
 * one does, and the warnings. A cohort above the allowed level keeps every
 * Class Level: the rules check is amber with Accept. A missing equivalence or an unresolved leader
 * is a prompt in the sheet's blue; neither can be accepted away.
 */
export function CohortBlock({
  view,
  controller,
  warningController,
  reasonId,
}: {
  view: CohortView;
  controller: CohortController;
  warningController: ReturnType<typeof useCharacterSheet>['warnings'];
  reasonId: string | undefined;
}) {
  const headingId = useId();
  const focus = useFocusAfterEditorCloses(
    controller.isEquivalenceOpen ? 'equivalence' : null,
    'h3',
  );
  const isSaving = controller.equivalenceStatus.kind === 'saving';
  return (
    <section
      ref={focus.wrapper}
      aria-labelledby={headingId}
      className="border-foreground/10 mt-3 flex flex-col gap-3 border-t pt-3"
    >
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h3 id={headingId} className={blockHeading}>
            Cohort
          </h3>
          <span className="text-muted-foreground text-sm">
            {view.statusLabel}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {controller.isEquivalenceOpen ? null : (
            <SaveFeedback
              status={controller.equivalenceStatus}
              savedText="Saved"
              savingText="Saving…"
              shouldHideWhenIdle
            />
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={action}
            aria-pressed={controller.isEquivalenceOpen}
            aria-describedby={reasonId}
            disabled={controller.isDisabled || isSaving}
            onClick={(event) => {
              if (controller.isEquivalenceOpen)
                return controller.closeEquivalence();
              focus.rememberOpener(event.currentTarget);
              controller.openEquivalence();
            }}
          >
            Edit Cohort Equivalence
          </Button>
        </div>
      </header>
      <RemoteNotice
        isShown={controller.hasRemoteEquivalenceChange}
        message="Cohort Equivalence updated by another player."
        subject="Cohort Equivalence"
        onDismiss={controller.dismissRemoteEquivalenceChange}
      />
      <CohortEquivalenceFact equivalence={view.equivalence} />
      {controller.isEquivalenceOpen ? (
        <CohortEquivalenceEditor controller={controller} reasonId={reasonId} />
      ) : null}
      {view.warnings.length > 0 ? (
        <div className="flex flex-col gap-1">
          {view.warnings.map((warning) => (
            <InlineWarning
              key={`${warning.check}:${warning.subject}`}
              warning={warning}
              controller={warningController}
              className={cn(warning.kind === 'unresolved' && 'text-sky-300')}
            />
          ))}
        </div>
      ) : null}
      {view.leadership ? (
        <CohortAllowedLevel leadership={view.leadership} />
      ) : null}
      <ul
        aria-label="Sources"
        className={cn(noteText, 'flex flex-wrap gap-x-3')}
      >
        {view.sources.map((source) => (
          <li key={source}>{source}</li>
        ))}
      </ul>
    </section>
  );
}
