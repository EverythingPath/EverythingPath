'use client';
import { Check, CircleAlert, Flag, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import { warningText, wrap } from '~/components/week-review/review-parts';
import type { SetupSectionMessage } from '~/lib/setup-sections';
import type { SetupStep } from '~/lib/setup-steps';
import { cn } from '~/lib/utils';
import type { GuidedSetup } from './use-guided-setup';

// Presentation pieces shared by the wide and phone guided Setup layouts.

export const eyebrow =
  'text-muted-foreground text-xs tracking-widest uppercase';

// The step that starts the optional group of a New militia.
export function isFirstOptionalStep(steps: SetupStep[], index: number) {
  const step = steps[index];
  return Boolean(step?.optional) && !steps[index - 1]?.optional;
}

export function OptionalLabel({ className }: { className?: string }) {
  return <p className={cn(eyebrow, className)}>Optional</p>;
}

// Decorative: the caption beside it says the same in words. The empty column
// keeps labels aligned. On the selected row the glyph takes the row's colour.
export function StepGlyph({
  step,
  isCurrent,
}: {
  step: SetupStep;
  isCurrent?: boolean;
}) {
  const tone = (colour: string) => (isCurrent ? undefined : colour);
  return (
    <span aria-hidden className="mt-0.5 flex size-4 shrink-0 items-center">
      {step.key === 'review' ? (
        <Flag className="size-4" />
      ) : step.state === 'error' ? (
        <CircleAlert className={cn('size-4', tone('text-destructive'))} />
      ) : step.state === 'warning' ? (
        <TriangleAlert className={cn('size-4', tone(warningText))} />
      ) : step.state === 'done' ? (
        <Check className="size-4" />
      ) : null}
    </span>
  );
}

export function LinkButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="link"
      onClick={onClick}
      // Wraps like text: the button base is nowrap, which overflows a phone.
      className="h-auto max-w-full min-w-0 justify-start p-0 text-left font-normal [overflow-wrap:anywhere] whitespace-normal text-current underline decoration-current/60 hover:decoration-current"
    >
      {children}
    </Button>
  );
}

// One warning, linked to its field when it names one. Lines share the
// 36px row height of the form's buttons so the glyph meets the first line.
function WarningLine({
  warning,
  openProblem,
}: {
  warning: SetupSectionMessage;
  openProblem: GuidedSetup['openProblem'];
}) {
  return (
    <p className={cn('flex gap-2 text-sm', warningText)}>
      <TriangleAlert aria-hidden className="mt-2.5 size-4 shrink-0" />
      <span className={cn('flex min-h-9 items-center', wrap)}>
        <span className="sr-only">Warning: </span>
        {warning.field ? (
          <LinkButton onClick={() => openProblem(warning)}>
            {warning.message}
          </LinkButton>
        ) : (
          warning.message
        )}
      </span>
    </p>
  );
}

export function WarningList({
  warnings,
  openProblem,
  label,
}: {
  warnings: SetupSectionMessage[];
  openProblem: GuidedSetup['openProblem'];
  label?: string;
}) {
  return (
    <ul aria-label={label} className="space-y-0.5">
      {warnings.map((warning) => (
        <li key={`${warning.field ?? ''}:${warning.message}`}>
          <WarningLine warning={warning} openProblem={openProblem} />
        </li>
      ))}
    </ul>
  );
}
