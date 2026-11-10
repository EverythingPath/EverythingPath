'use client';
import { useId, useMemo, useRef } from 'react';
import { AlertTriangle, CircleDot, Flag } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { warningText } from '~/components/week-review/review-parts';
import { WeekReviewSections } from '~/components/week-review/week-review';
import { cn } from '~/lib/utils';
import {
  adjustmentTargets,
  type TableAdjustment,
} from './summary-adjustment-form';
import { AdjustmentRow } from './summary-adjustment-row';
import { AddAdjustment } from './summary-adjustments';
import type { ConfirmControl } from './confirm-control';
import { ExceptionControl } from './summary-exception-control';
import { summaryMessage } from './summary-messages';
import type {
  LocalFormRegistration,
  Phase,
  PhaseView,
  SourceLink,
  WeeklyDraftWorkspace,
} from './types';

import {
  focusLocalForm,
  removedAdjustmentDrafts,
  useForgetGoneExceptions,
  type LocalFormGuard,
} from './use-summary-forms';
import { localFormElementId } from './source-anchors';
import { phaseLabels } from './week-frame/labels';
type Summary = Extract<PhaseView, { phase: 'summary' }>;

// Where a Go link leads, in the player's words. The summary phase is named
// by the part of Review & confirm that holds the decision.
const sourceLabel = (phase: Phase) =>
  phase === 'summary' ? 'Table Adjustments' : phaseLabels[phase];
const subheading = 'text-muted-foreground text-xs tracking-widest uppercase';
const line =
  'flex min-w-0 items-start gap-1.5 text-sm [overflow-wrap:anywhere]';
const goLink = 'h-auto min-h-0 px-1 py-0 text-sm';

export function SummaryView({
  view,
  edit,
  disabled,
  confirmation,
  forecastPending,
  reviewRequired,
  review,
  goTo,
  localForms = [],
  localFormGuard,
  latestAdjustments,
}: {
  view: Summary;
  edit: Extract<WeeklyDraftWorkspace, { status: 'ready' }>['edit'];
  disabled: boolean;
  /** The one Confirmation control, shared with the frame's pinned Confirm. */
  confirmation: ConfirmControl;
  forecastPending: boolean;
  reviewRequired: boolean;
  review: () => void;
  /** Shows a Required decision's source on this device only. */
  goTo?: (link: SourceLink) => void;
  /** This device's open or invalid local forms, each a Required decision. */
  localForms?: ({ id: string } & LocalFormRegistration)[];
  /** The Workspace's Confirm guard for this device's local forms. */
  localFormGuard?: LocalFormGuard;
  /** The latest ordered Table Adjustments this device knows, read at Save time. */
  latestAdjustments?: () => readonly TableAdjustment[];
}) {
  const targets = useMemo(() => adjustmentTargets(view), [view]);
  const latest = latestAdjustments ?? (() => view.adjustments);
  const guard = localFormGuard;
  const removedDrafts = removedAdjustmentDrafts(
    guard,
    localForms,
    view.adjustments,
  );
  useForgetGoneExceptions(guard, localForms, view.exceptions);
  const subjectOf = (exceptionId: string) =>
    view.exceptions.find((exception) => exception.exceptionId === exceptionId)
      ?.name ?? 'Rules Exception';
  const idPrefix = useId();
  const requirementId = (index: number) => `${idPrefix}-requirement-${index}`;
  const localFormId = (index: number) => `${idPrefix}-${index}`;
  const reasonId = `${idPrefix}-reason`;
  const confirmButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const { confirming, reason: disabledReason } = confirmation;
  const isReasonShown =
    disabledReason !== null && !confirming && confirmation.disabled;
  const reviewUpdatedWeek = () => {
    review();
    // The alert unmounts with the review; focus moves on to Confirm, or to
    // the block's heading while something still holds Confirm.
    requestAnimationFrame(() => {
      const target = confirmButton.current;
      if (target && !target.disabled) target.focus();
      else heading.current?.focus();
    });
  };
  const count = view.review.adjustments.length;
  return (
    <div className="min-w-0 space-y-4 [&_button]:h-auto [&_button]:min-h-9 [&_button]:max-w-full [&_button]:break-words [&_button]:whitespace-normal">
      <Card
        role="region"
        aria-label="Review the week"
        className="min-w-0 gap-3 p-5"
      >
        <h2
          ref={heading}
          tabIndex={-1}
          className="text-lg font-semibold outline-none"
        >
          Review the week
        </h2>
        {(view.requirements.length > 0 || localForms.length > 0) && (
          <section aria-label="Required decisions">
            <h3 className={subheading}>Required decisions</h3>
            <ul className="mt-1 space-y-1">
              {view.requirements.map((code, index) => {
                const source = view.sources?.[code];
                const messageId = requirementId(index);
                return (
                  <li key={code} className={line}>
                    <CircleDot
                      aria-hidden
                      className="text-primary mt-0.5 size-3.5 shrink-0"
                    />
                    <span className="min-w-0">
                      <span id={messageId}>{summaryMessage(code, view)}</span>
                      {source && goTo && (
                        <>
                          {' '}
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            aria-describedby={messageId}
                            className={goLink}
                            onClick={() => goTo(source)}
                          >
                            Go to {sourceLabel(source.phase)}
                            <span aria-hidden> →</span>
                          </Button>
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
              {localForms.map((form, index) => {
                const messageId = localFormId(index);
                return (
                  <li key={form.id} className={line}>
                    <CircleDot
                      aria-hidden
                      className="text-primary mt-0.5 size-3.5 shrink-0"
                    />
                    <span className="min-w-0">
                      <span id={messageId}>{form.message}</span>{' '}
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        aria-describedby={messageId}
                        className={goLink}
                        onClick={() =>
                          // A form in another phase is shown there first.
                          form.phase && form.phase !== 'summary' && goTo
                            ? goTo({
                                phase: form.phase,
                                anchor: localFormElementId(form.id),
                              })
                            : focusLocalForm(form.id)
                        }
                      >
                        Go to form
                        <span aria-hidden> →</span>
                      </Button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        <section aria-label="Warnings">
          <h3 className={subheading}>Warnings</h3>
          {view.warnings.length === 0 ? (
            <p className="mt-1 text-sm">No rules warnings.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {[...new Set(view.warnings)].map((code) => {
                const source = view.sources?.[code];
                return (
                  <li key={code} className={cn(line, warningText)}>
                    <AlertTriangle
                      aria-hidden
                      className="mt-0.5 size-3.5 shrink-0"
                    />
                    <span className="min-w-0">
                      <span>{summaryMessage(code, view, true)}</span>
                      {source && (
                        <span className="text-muted-foreground">
                          {' '}
                          · {sourceLabel(source.phase)}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        {reviewRequired && (
          <div
            role="alert"
            className="border-destructive/60 space-y-2 rounded-md border p-3"
          >
            <p className="text-sm">
              The week could not be confirmed as reviewed. Review the updated
              outcomes and table decisions before trying again.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={disabled || forecastPending}
              onClick={reviewUpdatedWeek}
            >
              Review updated week
            </Button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            ref={confirmButton}
            type="button"
            size="lg"
            disabled={confirmation.disabled}
            aria-busy={confirming || undefined}
            aria-describedby={isReasonShown ? reasonId : undefined}
            onClick={confirmation.confirm}
          >
            <Flag aria-hidden />
            {confirming ? 'Confirming…' : 'Confirm week'}
          </Button>
          {isReasonShown && (
            <p id={reasonId} className="text-muted-foreground text-sm">
              {disabledReason}
            </p>
          )}
        </div>
      </Card>
      <WeekReviewSections
        facts={view.review}
        capabilities={{
          exception: (note) => (
            <ExceptionControl
              note={note}
              subject={subjectOf(note.exceptionId)}
              edit={edit}
              guard={guard}
              disabled={disabled}
            />
          ),
          adjustment: (adjustment, index) => {
            const accepted = view.adjustments.find(
              (item) => item.adjustmentId === adjustment.adjustmentId,
            );
            if (!accepted) return null;
            return (
              <AdjustmentRow
                adjustment={adjustment}
                index={index}
                count={count}
                accepted={accepted}
                targets={targets}
                latest={latest}
                edit={edit}
                guard={guard}
                disabled={disabled}
              />
            );
          },
          addAdjustment: (
            <AddAdjustment
              targets={targets}
              latest={latest}
              edit={edit}
              guard={guard}
              disabled={disabled}
              localForms={localForms}
              removedDrafts={removedDrafts}
            />
          ),
        }}
      />
    </div>
  );
}
