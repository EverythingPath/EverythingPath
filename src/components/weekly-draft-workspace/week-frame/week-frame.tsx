'use client';
import { useId, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Flag,
} from 'lucide-react';
import { Button, buttonVariants } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { PhoneStatusStrip } from '~/components/campaign-shell/shell-slots';
import { cn } from '~/lib/utils';
import type { ConfirmControl } from '../confirm-control';
import type { ReferenceFacts } from '../reference-facts';
import { weekEditorAnchor } from '../source-anchors';
import type { Phase, PhaseReadiness } from '../types';
import { phaseLabels, weekHeading } from './labels';
import { PhaseSkeletonBody, skeletonShape } from './phase-skeletons';
import { confirmWarnings, readinessLine } from './readiness-copy';
import {
  DockedReferencePanel,
  PhoneReferenceSheet,
  ReferencePanelToggle,
} from './reference-panel';
import { PhoneSteps, Stepper } from './steps';
import type { ReferencePanel } from './use-reference-panel';

export type WeekNavigation = { previous: Phase | null; next: Phase | null };

type Frame = {
  week: number;
  phase: Phase;
  phases: PhaseReadiness[];
  navigation: WeekNavigation;
  /** The one Confirmation control; pinned at the next position on Review & confirm. */
  confirmation: ConfirmControl;
  choose: (phase: Phase) => void;
  /** The read-only reference facts and the surfaces' shared state. */
  reference: { facts: ReferenceFacts; panel: ReferencePanel };
};

// Previous/next never wrap: at an endpoint there is no control, only an
// invisible placeholder of the same size so the footer and strip keep their
// shape; the one exception is Review & confirm, whose next position holds
// the pinned Confirm week instead. Names carry the direction so they never
// collide with the stepper's own phase buttons. The footer shows the
// target's label beside an arrow; the phone strip shows only a chevron.
const directions = {
  previous: { word: 'Previous', arrow: ArrowLeft, chevron: ChevronLeft },
  next: { word: 'Next', arrow: ArrowRight, chevron: ChevronRight },
};
function DirectionButton({
  direction,
  target,
  choose,
  compact,
}: {
  direction: keyof typeof directions;
  target: Phase | null;
  choose: (phase: Phase) => void;
  compact?: boolean;
}) {
  const { word, arrow, chevron } = directions[direction];
  const Icon = compact ? chevron : arrow;
  const size = compact ? 'icon-lg' : 'lg';
  const footerSizing = cn(
    !compact && 'short:h-8 short:px-3 max-w-[40%] shrink',
  );
  if (!target) {
    return (
      <span
        aria-hidden
        data-week-endpoint={direction}
        className={cn(
          buttonVariants({ variant: 'outline', size }),
          'invisible',
          footerSizing,
        )}
      >
        <Icon />
      </span>
    );
  }
  const label = phaseLabels[target];
  const content = [
    <Icon key="icon" aria-hidden />,
    !compact && (
      <span key="label" className="truncate">
        {label}
      </span>
    ),
  ];
  return (
    <Button
      variant={direction === 'next' ? 'default' : 'outline'}
      size={size}
      aria-label={`${word}: ${label}`}
      onClick={() => choose(target)}
      className={footerSizing}
    >
      {direction === 'next' ? content.reverse() : content}
    </Button>
  );
}

function currentStep(frame: Frame) {
  return frame.phases.find((step) => step.phase === frame.phase);
}

// The pinned Confirm week at Review & confirm's next position: the same
// ConfirmControl as the review block's button, so the same name, enabled
// state and pending label. The warning count is visible beside the label
// but described, never named, so both buttons stay "Confirm week"; the
// disabled reason (the readiness line, `reasonId`) is described too.
function PinnedConfirm({
  confirmation,
  step,
  compact,
  reasonId,
}: {
  confirmation: ConfirmControl;
  step: PhaseReadiness;
  compact?: boolean;
  reasonId: string;
}) {
  const countId = useId();
  const { confirming, disabled, reason, confirm } = confirmation;
  const warnings = confirming ? null : confirmWarnings(step);
  const name = confirming ? 'Confirming…' : 'Confirm week';
  const describedBy =
    [warnings && countId, disabled && reason && reasonId]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <>
      <Button
        size={compact ? undefined : 'lg'}
        aria-label={compact ? name : undefined}
        aria-describedby={describedBy}
        aria-busy={confirming || undefined}
        disabled={disabled}
        onClick={confirm}
        // At least 44px at every size, short viewports included: a landscape
        // phone still shows the footer and is still touched.
        className={cn(
          'shrink-0',
          compact ? 'h-10 min-w-10 gap-1 px-2 text-xs' : 'short:px-3',
        )}
      >
        {compact ? (
          <CompactConfirmLabel
            confirming={confirming}
            warnings={warnings ? step.warnings.length : 0}
          />
        ) : (
          <>
            <Flag aria-hidden />
            {name}
            {warnings ? <span aria-hidden>{` · ${warnings}`}</span> : null}
          </>
        )}
      </Button>
      {warnings ? (
        <span id={countId} className="sr-only">
          {warnings}
        </span>
      ) : null}
    </>
  );
}

// The strip's short form leaves Training and Treasury their room: no icon
// before the label, the count as a number beside a warning glyph.
function CompactConfirmLabel({
  confirming,
  warnings,
}: {
  confirming: boolean;
  warnings: number;
}) {
  if (confirming) return 'Confirming…';
  return (
    <>
      Confirm
      {warnings > 0 ? (
        <span aria-hidden className="inline-flex items-center gap-1">
          {` · ${warnings}`}
          <AlertTriangle className="size-3" />
        </span>
      ) : null}
    </>
  );
}

// Tablet and desktop: pinned under the phase content. The readiness line is
// plain text (not a live region): counts change too often to announce while
// typing, and only the failure alert and other-player note are announced.
function Footer(frame: Frame) {
  const step = currentStep(frame);
  const reasonId = useId();
  const isSummary = frame.phase === 'summary';
  return (
    <footer
      data-week-footer
      role="region"
      aria-label="Week actions"
      className="bg-background/95 border-foreground/15 short:py-1 hidden shrink-0 items-center gap-3 border-t px-4 py-2.5 md:flex"
    >
      <DirectionButton
        direction="previous"
        target={frame.navigation.previous}
        choose={frame.choose}
      />
      {/* On Review & confirm the line is the disabled reason, so it sits
          beside the pinned Confirm and shrinks before the button does. */}
      <p
        id={reasonId}
        data-week-readiness
        className={cn(
          'text-muted-foreground short:text-xs min-w-0 flex-1 text-sm',
          isSummary ? 'text-right' : 'text-center',
        )}
      >
        {step ? readinessLine(step, frame.confirmation.reason) : ''}
      </p>
      {isSummary && step ? (
        <PinnedConfirm
          confirmation={frame.confirmation}
          step={step}
          reasonId={reasonId}
        />
      ) : (
        <DirectionButton
          direction="next"
          target={frame.navigation.next}
          choose={frame.choose}
        />
      )}
    </footer>
  );
}

// Phone: fills the shell's strip host immediately above the bottom tabs.
// The middle shows Training and Treasury now → after with the short
// readiness and opens the reference sheet; previous/next sit on its ends,
// the compact pinned Confirm at the next end on Review & confirm.
function Strip(frame: Frame) {
  const step = currentStep(frame);
  const reasonId = useId();
  return (
    <PhoneStatusStrip>
      <div
        data-week-strip
        role="region"
        aria-label="Week actions"
        className="flex items-center gap-1 px-1 py-1"
      >
        <DirectionButton
          direction="previous"
          target={frame.navigation.previous}
          choose={frame.choose}
          compact
        />
        {step && (
          <PhoneReferenceSheet
            phase={frame.phase}
            confirmationDisabledReason={frame.confirmation.reason}
            readinessId={reasonId}
            facts={frame.reference.facts}
            step={step}
            panel={frame.reference.panel}
          />
        )}
        {frame.phase === 'summary' && step ? (
          <PinnedConfirm
            confirmation={frame.confirmation}
            step={step}
            reasonId={reasonId}
            compact
          />
        ) : (
          <DirectionButton
            direction="next"
            target={frame.navigation.next}
            choose={frame.choose}
            compact
          />
        )}
      </div>
    </PhoneStatusStrip>
  );
}

/**
 * The shared frame around one mounted phase editor: an accessible heading
 * (the visible week and step live in the shell tab and the stepper), the
 * status row with the setup-notes button, the stepper (tablet row / desktop
 * rail / phone step button and sheet) with the panel toggle at its end,
 * the scrolling editor with its footer, the docked reference panel beside
 * them from tablet width (a third column on desktop), and the phone strip.
 *
 * `status` is the failed-save alert and the other-player note, both empty
 * in the normal state; the row also holds the confirmed-week `notice`.
 */
export function WeekFrame({
  status,
  notice,
  notes,
  children,
  ...frame
}: Frame & {
  status?: ReactNode;
  notice?: ReactNode;
  notes?: ReactNode;
  children: ReactNode;
}) {
  const step = currentStep(frame);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only">{weekHeading(frame.week, frame.phase)}</h1>
      {/* The three live regions (failure alert, remote note, notice) stay
          mounted and empty when silent; a region only announces content
          added while it is already in the accessibility tree, so the row is
          never display:none. While every descendant but the group wrapper is
          `:empty` (notes renders nothing without setup notes) the row
          collapses to zero height with no padding; overflow-hidden applies
          only then, so focus rings are not clipped when it has content.
          Spacing inside the group sits on non-empty children only, so an
          empty region adds no gap. */}
      <div className="short:pt-1 flex shrink-0 flex-wrap items-center gap-x-3 px-3 pt-2 not-has-[:not(:empty):not([data-week-status-row-group])]:h-0 not-has-[:not(:empty):not([data-week-status-row-group])]:overflow-hidden not-has-[:not(:empty):not([data-week-status-row-group])]:pt-0 md:px-4">
        <div
          data-week-status-row-group
          className="flex min-w-0 flex-1 flex-wrap items-center [&>:not(:empty)]:my-0.5 [&>:not(:empty)~:not(:empty)]:ml-3"
        >
          {status}
          {notice}
        </div>
        {notes}
      </div>
      <PhoneSteps
        week={frame.week}
        phases={frame.phases}
        phase={frame.phase}
        choose={frame.choose}
      />
      <div className="flex min-h-0 flex-1 flex-col xl:grid xl:grid-cols-[15rem_minmax(0,1fr)_auto] xl:grid-rows-[minmax(0,1fr)]">
        <Stepper
          week={frame.week}
          phases={frame.phases}
          phase={frame.phase}
          choose={frame.choose}
          className="xl:border-foreground/15 short:pt-1 shrink-0 px-3 pt-2 md:px-4 xl:min-h-0 xl:overflow-y-auto xl:border-r xl:p-3"
          end={<ReferencePanelToggle panel={frame.reference.panel} />}
        />
        {/* Tablet: editor column and panel side by side under the stepper.
            Desktop: the same two become the grid's middle and right columns. */}
        <div className="flex min-h-0 flex-1 xl:contents">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {/* relative: the editors' visually hidden text (a warning's
                prefix, an empty status line) is positioned by this column,
                so it scrolls with it instead of hanging below the clipped
                frame where nothing can scroll it into view. */}
            <main
              data-week-editor
              id={weekEditorAnchor}
              tabIndex={-1}
              className="short:py-2 focus-visible:ring-ring/50 relative min-h-0 flex-1 overflow-y-auto px-3 py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-inset md:px-5"
            >
              {/* A container so phase editors size their card grids by the
                  editor's own width, which is narrower than the viewport
                  beside the docked panel. */}
              <div className="@container mx-auto w-full max-w-6xl">
                {children}
              </div>
            </main>
            <Footer {...frame} />
          </div>
          {step && (
            <DockedReferencePanel
              facts={frame.reference.facts}
              step={step}
              panel={frame.reference.panel}
            />
          )}
        </div>
      </div>
      <Strip {...frame} />
    </div>
  );
}

/**
 * Loading: the frame's shape inside the already-rendered shell. The frame
 * placeholders (phone step button, stepper row, desktop rail, docked panel,
 * footer) are the same for every phase; the editor column takes the shape
 * of the editor the address names, or the generic two blocks.
 */
export function WeekSkeleton({ phase }: { phase?: Phase }) {
  const shape = skeletonShape(phase);
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-week-skeleton={shape}>
      <p role="status" className="sr-only">
        Loading the week…
      </p>
      <div
        aria-hidden
        className="flex min-h-0 flex-1 flex-col gap-3 px-3 pt-3 md:px-4"
      >
        <Skeleton data-skeleton-frame className="h-11 w-full md:hidden" />
        <div data-skeleton-frame className="hidden gap-1 md:flex xl:hidden">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-12 flex-1" />
          ))}
        </div>
        {/* The columns are bounded like the real frame's so a long body clips
            inside its column instead of growing the page. */}
        <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[minmax(0,1fr)_20rem] md:grid-rows-[minmax(0,1fr)] md:gap-4 xl:grid-cols-[15rem_minmax(0,1fr)_20rem]">
          <div data-skeleton-frame className="hidden flex-col gap-1 xl:flex">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
            <div
              data-week-skeleton-body={shape}
              className="@container mx-auto w-full max-w-6xl"
            >
              <PhaseSkeletonBody shape={shape} />
            </div>
          </div>
          <div data-skeleton-frame className="hidden flex-col gap-3 md:flex">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        </div>
        <Skeleton
          data-skeleton-frame
          className="hidden h-12 w-full shrink-0 md:block"
        />
      </div>
    </div>
  );
}
