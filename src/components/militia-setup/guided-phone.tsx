'use client';
import { ChevronDown } from 'lucide-react';
import { Button } from '~/components/ui/button';
import type { SetupStep } from '~/lib/setup-steps';
import { cn } from '~/lib/utils';
import { isFirstOptionalStep, OptionalLabel, StepGlyph } from './guided-parts';
import { ForwardButton, StepBody } from './guided-step';
import { SetupModeChoice } from './starting-point';
import type { GuidedSetup } from './use-guided-setup';

// One accordion row. Its header's accessible name is exactly the step label;
// the open row holds the step's content and the forward button.
function PhoneRow({
  setup,
  step,
  startsOptionalGroup,
}: {
  setup: GuidedSetup;
  step: SetupStep;
  startsOptionalGroup: boolean;
}) {
  const id = setup.ids.header(step.key);
  const isOpen = step.key === setup.current.key;
  return (
    <li className="border-b">
      {startsOptionalGroup ? <OptionalLabel className="px-2 pt-3" /> : null}
      <h2 className="text-base font-normal">
        <Button
          type="button"
          variant="ghost"
          id={id}
          aria-expanded={isOpen}
          aria-controls={setup.ids.panel(step.key)}
          aria-labelledby={`${id}-label`}
          aria-describedby={step.caption ? `${id}-caption` : undefined}
          onClick={() => setup.select(step.key)}
          className={cn(
            'h-auto min-h-12 w-full items-start justify-start rounded-none px-2 py-3 text-left font-normal whitespace-normal',
            isOpen && 'bg-primary/10',
          )}
        >
          <StepGlyph step={step} />
          <span className="flex-1 text-sm leading-tight break-normal">
            <span aria-hidden>{step.number}. </span>
            <span id={`${id}-label`}>{step.label}</span>
          </span>
          {step.caption ? (
            <span
              id={`${id}-caption`}
              className="text-muted-foreground shrink text-right text-xs leading-tight break-normal"
            >
              {step.caption}
            </span>
          ) : null}
          <ChevronDown
            aria-hidden
            className={cn(
              'size-4 shrink-0 opacity-60 transition-transform',
              isOpen && 'rotate-180',
            )}
          />
        </Button>
      </h2>
      {isOpen ? (
        <div
          id={setup.ids.panel(step.key)}
          role="region"
          aria-labelledby={`${id}-label`}
          className="space-y-4 px-2 pt-2 pb-4"
        >
          <StepBody setup={setup} />
          <ForwardButton setup={setup} className="w-full" />
        </div>
      ) : null}
    </li>
  );
}

// Below 768px: nine rows, one open at a time, in normal document flow.
export function PhoneSetup({ setup }: { setup: GuidedSetup }) {
  return (
    <div className="space-y-4">
      <SetupModeChoice />
      <ol className="border-t">
        {setup.steps.map((step, index) => (
          <PhoneRow
            key={step.key}
            setup={setup}
            step={step}
            startsOptionalGroup={isFirstOptionalStep(setup.steps, index)}
          />
        ))}
      </ol>
    </div>
  );
}
