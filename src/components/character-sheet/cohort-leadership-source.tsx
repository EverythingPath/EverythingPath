'use client';
import { useId } from 'react';
import { Button } from '~/components/ui/button';
import type { LeadershipSourceView } from './character-cohort-view-model';
import { CohortLeadershipEditor } from './cohort-leadership-editor';
import { CombinedFormFact } from './combined-form-fact';
import type { CohortController } from './companion-props';
import {
  action,
  chip,
  fieldLabel,
  noteText,
  SaveFeedback,
} from './sheet-parts';

/**
 * One cohort's Leadership modifiers on the leader's sheet (#417): the
 * cohort and the source they belong to, the level a cohort could be
 * attracted at now from this sheet's own level and Charisma, each recorded modifier, and the editor
 * beneath when opened.
 */
export function CohortLeadershipSource({
  source,
  controller,
  reasonId,
  rememberOpener,
}: {
  source: LeadershipSourceView;
  controller: CohortController;
  reasonId: string | undefined;
  rememberOpener: (element: HTMLElement) => void;
}) {
  const nameId = useId();
  const modifiersId = useId();
  const status = controller.leadershipStatusFor(source.key);
  const isOpen = controller.leadershipEditor?.key === source.key;
  const isSaving = status.kind === 'saving';
  return (
    <li aria-labelledby={nameId} className="flex flex-col gap-2 py-2">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h4 id={nameId} className="font-sans text-base">
            {source.cohortName}
          </h4>
          <span className={chip}>{source.sourceLabel}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {isOpen ? null : (
            <SaveFeedback
              status={status}
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
            aria-pressed={isOpen}
            aria-describedby={reasonId}
            disabled={controller.isDisabled || isSaving}
            onClick={(event) => {
              if (isOpen) return controller.closeLeadership();
              rememberOpener(event.currentTarget);
              controller.openLeadership(source);
            }}
          >
            Edit Leadership modifiers{' '}
            <span className="sr-only">for {source.cohortName}</span>
          </Button>
        </div>
      </header>
      <dl
        aria-label={`Leadership for ${source.cohortName}`}
        className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3"
      >
        <CombinedFormFact
          label="Would attract now"
          value={source.maximumLabel}
          valueClassName="text-xl"
        />
        <div className="col-span-2 flex min-w-0 flex-col sm:col-span-2">
          <dt id={modifiersId} className={fieldLabel}>
            Leadership modifiers
          </dt>
          <dd aria-labelledby={modifiersId}>
            {source.rows.length > 0 ? (
              <ul
                aria-label="Leadership modifiers"
                className="flex flex-col gap-0.5 text-sm"
              >
                {source.rows.map((row) => (
                  <li
                    key={row.key}
                    className="flex flex-wrap justify-between gap-x-2"
                  >
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {row.label}
                    </span>
                    <span className="font-mono tabular-nums">
                      {row.display}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-muted-foreground text-sm">
                None recorded
              </span>
            )}
          </dd>
        </div>
      </dl>
      <p className={noteText}>{source.summary}</p>
      {isOpen ? (
        <CohortLeadershipEditor
          source={source}
          controller={controller}
          reasonId={reasonId}
        />
      ) : null}
    </li>
  );
}
