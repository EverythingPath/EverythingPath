'use client';
import { ArrowRight, Check, CircleAlert } from 'lucide-react';
import { useEffect, useId, useRef, type RefObject } from 'react';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
import { useScrollPaddingFor } from '~/components/campaign-shell/scroll-padding';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { PhoneStatusStrip } from '~/components/campaign-shell/shell-slots';
import {
  CONFLICT_HEADING,
  RESTART_FROM_THEIRS,
  RESTART_FROM_WEEK,
  SAVING_MESSAGE,
  WEEK_CHANGED_MESSAGE,
  type ErrorSummaryItem,
} from '~/components/militia-corrections/correction-copy';
import { FactsView } from '~/components/militia-corrections/facts-view';
import {
  AffectsWeek,
  useFocusOnMount,
} from '~/components/militia-corrections/section-correction';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { cn } from '~/lib/utils';
import { action, chip, Warnings } from './parts';
import type { OpenCorrection } from './use-character-corrections';

// Headings that take programmatic focus (`tabIndex={-1}`) so keyboard and
// screen-reader users land on the state that just opened.
const focusTarget = 'outline-none';

/** The result of the last correction on this device. */
export function Feedback({ feedback }: { feedback: string | null }) {
  if (!feedback) return null;
  return (
    <p
      role="status"
      className="text-muted-foreground flex items-start gap-1.5 text-sm"
    >
      <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{feedback}</span>
    </p>
  );
}

function ErrorList({
  title,
  items,
  focusField,
}: {
  title: string;
  items: ErrorSummaryItem[];
  focusField: OpenCorrection['focusField'];
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <h4 className="text-sm font-medium">{title}</h4>
      <ul role="list" className="space-y-1 text-sm">
        {items.map(({ field, message }) => (
          <li key={`${field}:${message}`}>
            {field ? (
              <button
                type="button"
                className="min-h-11 text-left underline underline-offset-4 md:min-h-0"
                onClick={() => focusField(field)}
              >
                {message}
              </button>
            ) : (
              message
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ErrorSummary({ correction }: { correction: OpenCorrection }) {
  const { errors, focusField } = correction;
  if (errors.length === 0) return null;
  return (
    <div
      role="alert"
      className="border-destructive/60 text-destructive space-y-2 border p-3"
    >
      <h3 className="font-semibold">Fix these before saving</h3>
      <ErrorList
        title="Required"
        items={errors.filter((item) => item.kind === 'required')}
        focusField={focusField}
      />
      <ErrorList
        title="Invalid"
        items={errors.filter((item) => item.kind !== 'required')}
        focusField={focusField}
      />
    </div>
  );
}

function Notice({ correction }: { correction: OpenCorrection }) {
  const { view, notice } = correction;
  if (!notice) return null;
  const failed =
    view.kind === 'editing' &&
    (view.notice === 'rejected' || view.notice === 'unconfirmed');
  return (
    <p
      role="status"
      className={cn(
        'text-sm',
        failed ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {notice}
    </p>
  );
}

// What Save would do to the open week, and what stops it: the allowance,
// cascades, hints for newly assigned PCs, affected choices, errors and the
// last Save's notice.
function SavePoint({ correction }: { correction: OpenCorrection }) {
  return (
    <>
      {correction.allowance !== null && (
        <p className="text-primary text-sm [overflow-wrap:anywhere]">
          {correction.allowance}
        </p>
      )}
      {correction.warnings.length > 0 && (
        <aside aria-label="Correction warnings" className="space-y-1">
          <Warnings warnings={correction.warnings} />
        </aside>
      )}
      {correction.hints.length > 0 && (
        <ul role="list" className="space-y-1 text-sm">
          {correction.hints.map((hint) => (
            <li key={hint} className="[overflow-wrap:anywhere]">
              {hint}{' '}
              <GuardedLink
                href={correction.activityHref}
                className="inline-flex min-h-11 items-center gap-1 underline underline-offset-4 md:min-h-0"
              >
                Go to Activity
                <ArrowRight aria-hidden className="size-4" />
              </GuardedLink>
            </li>
          ))}
        </ul>
      )}
      <AffectsWeek choices={correction.affectsWeek} />
      <ErrorSummary correction={correction} />
      <Notice correction={correction} />
    </>
  );
}

// The reason, its quick picks and Save/Cancel. Inline under the save-point
// content from 768px, stacked below it on narrower screens; in the phone
// strip above the tabs it is a two-column grid (label beside Cancel, input
// beside Save, the chips sharing a row) so the strip stays short.
function ReasonBar({
  correction,
  inStrip,
}: {
  correction: OpenCorrection;
  inStrip: boolean;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const { view, reason } = correction;
  const maintenance = useInitialMigrationMaintenance();
  const editing = view.kind === 'editing';
  // The pieces are the same in both layouts; only their arrangement differs.
  const reasonInput = (className?: string) => (
    <Input
      {...reason.register}
      id={id}
      disabled={!editing}
      aria-invalid={reason.error ? true : undefined}
      aria-describedby={reason.error ? errorId : undefined}
      className={cn('h-11 md:h-9', className)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        correction.save();
      }}
    />
  );
  const errorMessage = (className?: string) =>
    reason.error && (
      <p
        id={errorId}
        className={cn(
          'text-destructive flex items-start gap-1.5 text-sm',
          className,
        )}
      >
        <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0 [overflow-wrap:anywhere]">{reason.error}</span>
      </p>
    );
  const quickReasons = (className: string, chipClassName?: string) => (
    <div
      role="group"
      aria-label="Quick reasons"
      className={cn('flex flex-wrap gap-1', className)}
    >
      {reason.chips.map((text) => (
        <button
          key={text}
          type="button"
          disabled={!editing}
          className={cn(
            chip,
            'focus-visible:ring-ring/50 hover:bg-foreground/5 min-h-11 outline-none focus-visible:ring-[3px] disabled:opacity-50 md:min-h-7',
            chipClassName,
          )}
          onClick={() => reason.choose(text)}
        >
          {text}
        </button>
      ))}
    </div>
  );
  const saveButton = (className?: string) => (
    <Button
      type="button"
      className={cn(action, className)}
      disabled={!editing || maintenance.readOnly}
      onClick={correction.save}
    >
      {view.kind === 'saving' ? SAVING_MESSAGE : 'Save correction'}
    </Button>
  );
  const maintenanceReason = (className: string) => (
    <MaintenanceReason notice={maintenance} className={className} />
  );
  const cancelButton = (className?: string) => (
    <Button
      type="button"
      variant="outline"
      className={cn(action, className)}
      disabled={!editing}
      onClick={correction.cancel}
    >
      Cancel
    </Button>
  );
  const savingStatus = view.kind === 'saving' && (
    <p role="status" className="sr-only">
      {SAVING_MESSAGE}
    </p>
  );
  if (inStrip) {
    // The DOM keeps the wide layout's reading and tab order; the grid places
    // Cancel and Save on the right of the label and input. The error and the
    // chips auto-place below them, spanning both columns, so the long message
    // rarely wraps and the chips share a row, wrapping text inside instead.
    return (
      <div
        data-reason-bar
        className="bg-background grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1.5 px-3 py-2"
      >
        <Label htmlFor={id} className="col-start-1 row-start-1 self-center">
          {reason.label}
        </Label>
        {reasonInput('col-start-1 row-start-2')}
        {errorMessage('col-span-2')}
        {quickReasons(
          'col-span-2',
          'flex-1 basis-16 justify-center text-center',
        )}
        {saveButton('col-start-2 row-start-2 self-start')}
        {cancelButton('col-start-2 row-start-1')}
        {savingStatus}
        {maintenanceReason('col-span-2')}
      </div>
    );
  }
  return (
    <div
      data-reason-bar
      className="grid gap-2 md:flex md:flex-wrap md:items-start md:gap-x-3"
    >
      <Label htmlFor={id} className="shrink-0 md:min-h-9">
        {reason.label}
      </Label>
      <div className="grid gap-1 md:max-w-md md:min-w-56 md:flex-1">
        {reasonInput()}
        {errorMessage()}
      </div>
      {quickReasons('md:min-h-9 md:items-center')}
      <div className="flex flex-wrap items-center gap-2 md:ml-auto">
        {saveButton()}
        {cancelButton()}
        {savingStatus}
        {maintenanceReason('basis-full')}
      </div>
    </div>
  );
}

function Conflict({ correction }: { correction: OpenCorrection }) {
  const id = useId();
  const theirsId = `${id}-theirs`;
  const yoursId = `${id}-yours`;
  const { comparison } = correction;
  const heading = useFocusOnMount<HTMLHeadingElement>();
  return (
    <div className="space-y-4">
      <div role="alert">
        <h3
          ref={heading}
          tabIndex={-1}
          className={cn('font-semibold', focusTarget)}
        >
          {CONFLICT_HEADING}
        </h3>
      </div>
      {comparison && (
        <div className="grid gap-4 md:grid-cols-2">
          <section
            aria-labelledby={theirsId}
            className="border-foreground/15 min-w-0 space-y-3 border p-3"
          >
            <h4 id={theirsId} className="font-medium">
              Their values
            </h4>
            <FactsView facts={comparison.theirs} />
          </section>
          <section
            aria-labelledby={yoursId}
            className="border-foreground/15 min-w-0 space-y-3 border p-3"
          >
            <h4 id={yoursId} className="font-medium">
              Your values
            </h4>
            <FactsView facts={comparison.yours} />
          </section>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" className={action} onClick={correction.restart}>
          {RESTART_FROM_THEIRS}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={action}
          onClick={correction.cancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function WeekChanged({ correction }: { correction: OpenCorrection }) {
  const message = useFocusOnMount<HTMLParagraphElement>();
  return (
    <div className="space-y-4">
      <p ref={message} role="alert" tabIndex={-1} className={focusTarget}>
        {WEEK_CHANGED_MESSAGE}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" className={action} onClick={correction.restart}>
          {RESTART_FROM_WEEK}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={action}
          onClick={correction.cancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

/**
 * The open correction's save point: its heading, what Save would do, and
 * the reason with Save/Cancel; or the conflict comparison or week-changed
 * notice when the militia moved. From 768px it is pinned to the viewport's
 * bottom edge until the page's end, with its height reserved as scroll
 * padding so focus scrolls the board and rows clear of it; on the phone the
 * reason moves to the shell's strip when offered.
 */
export function CorrectionBar({
  correction,
  wide,
  inStrip,
  focusHeading,
}: {
  correction: OpenCorrection;
  wide: boolean;
  /** The phone strip holds the reason bar; nothing else moves. */
  inStrip: boolean;
  /**
   * Set when the correction opened: the heading takes focus on mount and
   * clears it, so mounting again after a resize leaves focus where it is.
   */
  focusHeading: RefObject<boolean>;
}) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const stickyBar = useRef<HTMLElement>(null);
  useScrollPaddingFor(stickyBar);
  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    heading.current?.focus();
  }, [focusHeading]);
  const { view } = correction;
  const settled = view.kind !== 'conflict' && view.kind !== 'weekChanged';
  return (
    <>
      <section
        ref={wide ? stickyBar : undefined}
        aria-labelledby={id}
        className={cn(
          'flex min-w-0 flex-col gap-3',
          wide &&
            'bg-background border-foreground/20 sticky bottom-0 z-20 -mx-6 border-t px-6 py-3',
        )}
      >
        <h2
          ref={heading}
          id={id}
          tabIndex={-1}
          className={cn(
            'font-sans text-xl [overflow-wrap:anywhere]',
            focusTarget,
          )}
        >
          {correction.heading}
        </h2>
        <div
          className={cn(
            'flex min-w-0 flex-col gap-3 empty:hidden',
            wide && 'max-h-[45dvh] overflow-y-auto',
          )}
        >
          {view.kind === 'conflict' ? (
            <Conflict correction={correction} />
          ) : view.kind === 'weekChanged' ? (
            <WeekChanged correction={correction} />
          ) : (
            <SavePoint correction={correction} />
          )}
        </div>
        {settled && !inStrip && (
          <ReasonBar correction={correction} inStrip={false} />
        )}
      </section>
      {settled && inStrip && (
        <PhoneStatusStrip>
          <ReasonBar correction={correction} inStrip />
        </PhoneStatusStrip>
      )}
    </>
  );
}
