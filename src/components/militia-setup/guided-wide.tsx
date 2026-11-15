'use client';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import { wrap } from '~/components/week-review/review-parts';
import type { SetupStep } from '~/lib/setup-steps';
import { cn } from '~/lib/utils';
import { isFirstOptionalStep, OptionalLabel, StepGlyph } from './guided-parts';
import { ForwardButton, StepBody } from './guided-step';
import { SetupModeChoice } from './starting-point';
import type { GuidedSetup } from './use-guided-setup';

// Its accessible name is exactly the step label; the number is decorative and
// the status caption is its description. From 1280px a preview of the
// entered values sits under the label.
function StepButton({ setup, step }: { setup: GuidedSetup; step: SetupStep }) {
  const id = setup.ids.header(step.key);
  const isCurrent = step.key === setup.current.key;
  const preview = setup.preview(step.key);
  const muted = isCurrent ? 'opacity-80' : 'text-muted-foreground';
  return (
    <Button
      type="button"
      variant="ghost"
      id={id}
      aria-current={isCurrent ? 'step' : undefined}
      aria-labelledby={`${id}-label`}
      aria-describedby={step.caption ? `${id}-caption` : undefined}
      onClick={() => setup.select(step.key)}
      className={cn(
        'h-auto min-h-10 w-full items-start justify-start rounded-none px-2 py-2 text-left font-normal whitespace-normal',
        isCurrent &&
          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
      )}
    >
      <StepGlyph step={step} isCurrent={isCurrent} />
      {/* Labels wrap between words only; the caption folds onto two lines. */}
      <span className="flex-1 leading-tight break-normal">
        <span className="block text-sm">
          <span aria-hidden>{step.number}. </span>
          <span id={`${id}-label`}>{step.label}</span>
        </span>
        {preview ? (
          <span className={cn('mt-0.5 hidden text-xs xl:block', muted, wrap)}>
            {preview}
          </span>
        ) : null}
      </span>
      {step.caption ? (
        <span
          id={`${id}-caption`}
          className={cn(
            'shrink text-right text-xs leading-tight break-normal',
            muted,
          )}
        >
          {step.caption}
        </span>
      ) : null}
    </Button>
  );
}

// From 768px: the step index beside one detail pane with a sticky footer.
export function WideSetup({ setup }: { setup: GuidedSetup }) {
  const { current, steps } = setup;
  return (
    <div className="grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)]">
      <div className="space-y-4 md:border-r md:pr-4">
        <SetupModeChoice />
        <nav aria-label="Setup steps">
          <ol className="space-y-0.5">
            {steps.map((step, index) => (
              <li key={step.key}>
                {isFirstOptionalStep(steps, index) ? (
                  <OptionalLabel className="mt-3 mb-1 px-2" />
                ) : null}
                {step.key === 'review' ? <Separator className="my-2" /> : null}
                <StepButton setup={setup} step={step} />
              </li>
            ))}
          </ol>
        </nav>
      </div>
      <div className="flex min-w-0 flex-col">
        <div className="flex-1 space-y-4">
          <h2
            id={setup.ids.heading(current.key)}
            tabIndex={-1}
            className="focus-visible:ring-ring/50 text-2xl font-bold outline-none focus-visible:ring-[3px]"
          >
            {current.label}
          </h2>
          <StepBody setup={setup} />
        </div>
        <footer className="bg-background sticky bottom-0 mt-6 flex justify-end border-t py-3">
          <ForwardButton setup={setup} />
        </footer>
      </div>
    </div>
  );
}
