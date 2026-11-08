'use client';
import { useId, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Flag, Lock } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '~/components/ui/sheet';
import { cn } from '~/lib/utils';
import type { Phase, PhaseReadiness } from '../types';
import { phaseLabels } from './labels';
import { stepCaption, stepState } from './readiness-copy';

// The glyph is decorative: the caption beside it carries the same fact as
// text, and Review & confirm's flag has no readiness to convey.
function StepGlyph({
  step,
  className,
}: {
  step: PhaseReadiness;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-7 shrink-0 items-center justify-center border border-current/50 font-mono text-base',
        className,
      )}
    >
      {!step.available ? (
        <Lock className="size-3.5" />
      ) : step.phase === 'summary' ? (
        <Flag className="size-3.5" />
      ) : step.ready ? (
        <Check className="size-4" />
      ) : (
        step.requirements.length
      )}
    </span>
  );
}

// One position. Its accessible name is exactly the phase label so every
// existing phase selector keeps working; the readiness caption is its
// description. A locked position stays visible and disabled.
function StepButton({
  step,
  current,
  choose,
  layout,
}: {
  step: PhaseReadiness;
  current: boolean;
  choose: (phase: Phase) => void;
  layout: 'row' | 'list';
}) {
  const id = useId();
  const caption = stepCaption(step);
  return (
    <Button
      type="button"
      variant={current ? 'default' : 'outline'}
      disabled={!step.available}
      aria-current={current ? 'step' : undefined}
      aria-label={phaseLabels[step.phase]}
      aria-describedby={caption ? id : undefined}
      onClick={() => choose(step.phase)}
      className={cn(
        'short:min-h-9 short:py-0.5 h-auto w-full justify-start rounded-none px-3 py-1.5 font-normal whitespace-normal shadow-none',
        layout === 'row' ? 'min-h-12 flex-1' : 'min-h-11',
        current
          ? 'border-primary border'
          : 'border-foreground/25 hover:bg-foreground/10 dark:hover:bg-foreground/10 bg-transparent dark:bg-transparent',
      )}
    >
      <StepGlyph step={step} className="short:size-5 short:text-sm" />
      {/* Short viewports put the caption beside the label instead of under it. */}
      <span className="short:flex short:flex-wrap short:items-baseline short:gap-x-2 min-w-0 leading-tight">
        <span className="block text-sm">{phaseLabels[step.phase]}</span>
        {caption && (
          <span
            id={id}
            className={cn(
              'block text-xs',
              current ? 'opacity-80' : 'text-muted-foreground',
            )}
          >
            {caption}
          </span>
        )}
      </span>
    </Button>
  );
}

/**
 * Tablet stepper under the top bar; from 1280px the same list stands as the
 * rail on the left. One element serves both so no position renders twice.
 * `end` (the reference panel toggle) sits outside the nav: at the row's end
 * on tablet, on the rail's "Week N" line on desktop, where the list wraps
 * under both.
 */
export function Stepper({
  week,
  phases,
  phase,
  choose,
  className,
  end,
}: {
  week: number;
  phases: PhaseReadiness[];
  phase: Phase;
  choose: (phase: Phase) => void;
  className?: string;
  end?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'hidden md:flex md:items-center md:gap-1 xl:flex-wrap xl:content-start',
        className,
      )}
    >
      <p
        aria-hidden
        className="text-muted-foreground hidden min-w-0 flex-1 px-1 text-xs tracking-widest uppercase xl:block"
      >
        Week {week}
      </p>
      <nav
        aria-label="Week phases"
        className="min-w-0 flex-1 xl:order-last xl:basis-full"
      >
        <ol className="flex items-stretch gap-1 xl:flex-col">
          {phases.map((step) => (
            <li
              key={step.phase}
              className="flex flex-1 items-center xl:flex-none"
            >
              <StepButton
                step={step}
                current={step.phase === phase}
                choose={choose}
                layout="row"
              />
            </li>
          ))}
        </ol>
      </nav>
      {end}
    </div>
  );
}

/**
 * Phone: one "Step N of 5 · Phase" button with the current glyph and caption,
 * a five-segment progress line, and a bottom sheet listing every position.
 */
export function PhoneSteps({
  week,
  phases,
  phase,
  choose,
}: {
  week: number;
  phases: PhaseReadiness[];
  phase: Phase;
  choose: (phase: Phase) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = phases.find((step) => step.phase === phase);
  if (!current) return null;
  const index = phases.indexOf(current);
  const caption = stepCaption(current);
  return (
    <div className="short:pt-1 short:pb-0.5 px-3 pt-2 pb-1 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            type="button"
            className="short:min-h-9 short:py-0.5 h-auto min-h-11 w-full justify-start rounded-none px-3 py-1.5 font-normal whitespace-normal"
          >
            {/* Round here so it reads as a step marker, not a checkbox. */}
            <StepGlyph
              step={current}
              className="border-primary-foreground/60 rounded-full"
            />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-sm">
                Step {index + 1} of {phases.length} · {phaseLabels[phase]}
              </span>
              {caption && (
                <span className="block truncate text-xs opacity-80">
                  {caption}
                </span>
              )}
            </span>
            <ChevronDown aria-hidden className="size-4 shrink-0" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[80dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader>
            <SheetTitle>Week {week}</SheetTitle>
            <SheetDescription>
              Jump to any step. The number is how much is still to decide.
            </SheetDescription>
          </SheetHeader>
          <ol
            aria-label="Week phases"
            className="flex flex-col gap-1 px-4 pb-4"
          >
            {phases.map((step) => (
              <li key={step.phase}>
                <StepButton
                  step={step}
                  current={step.phase === phase}
                  choose={(next) => {
                    setOpen(false);
                    choose(next);
                  }}
                  layout="list"
                />
              </li>
            ))}
          </ol>
        </SheetContent>
      </Sheet>
      <ol aria-hidden className="mt-1 flex gap-1">
        {phases.map((step) => {
          const state = stepState(step, phase);
          return (
            <li
              key={step.phase}
              className={cn(
                'h-1 flex-1',
                state === 'current'
                  ? 'bg-primary'
                  : state === 'locked'
                    ? 'bg-foreground/10'
                    : state === 'done'
                      ? 'bg-foreground/60'
                      : 'bg-foreground/30',
              )}
            />
          );
        })}
      </ol>
    </div>
  );
}
