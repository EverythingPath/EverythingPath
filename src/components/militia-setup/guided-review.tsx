'use client';
import { wrap } from '~/components/week-review/review-parts';
import { SETUP_SECTIONS } from '~/lib/setup-sections';
import { cn } from '~/lib/utils';
import { eyebrow, LinkButton, WarningList } from './guided-parts';
import { SetupNotes } from './step-editors';
import type { GuidedSetup } from './use-guided-setup';

// Every blocking error after a failed start, each linked to its step.
function ErrorSummary({ setup }: { setup: GuidedSetup }) {
  const count = setup.summary.length;
  return (
    <div
      id={setup.ids.summary}
      tabIndex={-1}
      role="alert"
      className="border-destructive/60 bg-destructive/10 focus-visible:ring-destructive/40 space-y-1 border p-3 outline-none focus-visible:ring-[3px]"
    >
      <h3 className="text-base font-medium">
        {count} {count === 1 ? 'thing' : 'things'} to fix before starting
      </h3>
      <ul className="space-y-0.5 text-sm">
        {setup.summary.map((error) => (
          <li
            key={`${error.field ?? ''}:${error.message}`}
            className={cn('flex flex-wrap items-center gap-x-1', wrap)}
          >
            {error.section ? (
              <>
                <LinkButton onClick={() => setup.openProblem(error)}>
                  {error.message}
                </LinkButton>
                <span className="text-muted-foreground">
                  · {SETUP_SECTIONS[error.section]}
                </span>
              </>
            ) : (
              error.message
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReviewBody({ setup }: { setup: GuidedSetup }) {
  const warnedSteps = setup.steps.filter((step) => step.warnings.length > 0);
  return (
    <div className="space-y-6">
      {setup.summary.length > 0 ? <ErrorSummary setup={setup} /> : null}
      <section className="space-y-1">
        <h3 className={eyebrow}>Warnings by step</h3>
        {warnedSteps.length === 0 ? (
          <p className="text-sm">None.</p>
        ) : (
          warnedSteps.map((step) => (
            <div key={step.key} className="text-sm">
              <LinkButton
                onClick={() => setup.openProblem({ section: step.key })}
              >
                {step.label}
              </LinkButton>
              <WarningList
                warnings={step.warnings}
                openProblem={setup.openProblem}
              />
            </div>
          ))
        )}
      </section>
      <SetupNotes />
      {setup.submitError ? (
        <p role="alert" className="text-destructive text-sm">
          {setup.submitError}
        </p>
      ) : null}
    </div>
  );
}
