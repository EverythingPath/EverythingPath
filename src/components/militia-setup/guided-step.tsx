'use client';
import { ArrowRight, Flag } from 'lucide-react';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { WarningList } from './guided-parts';
import { ReviewBody } from './guided-review';
import { SetupStepEditor } from './step-editors';
import type { GuidedSetup } from './use-guided-setup';

// The open step's content: its warnings and editor, or the Review body.
export function StepBody({ setup }: { setup: GuidedSetup }) {
  const { current } = setup;
  if (current.key === 'review') return <ReviewBody setup={setup} />;
  return (
    <>
      {current.warnings.length > 0 ? (
        <WarningList
          label="Rules warnings"
          warnings={current.warnings}
          openProblem={setup.openProblem}
        />
      ) : null}
      <SetupStepEditor step={current.key} characters={setup.characters} />
    </>
  );
}

// Next step, or on Review the start action.
export function ForwardButton({
  setup,
  className,
}: {
  setup: GuidedSetup;
  className?: string;
}) {
  const maintenance = useInitialMigrationMaintenance();
  if (!setup.next)
    return (
      <>
        <Button
          type="button"
          id={setup.ids.next}
          size="lg"
          onClick={setup.start}
          disabled={setup.pending || maintenance.readOnly}
          className={className}
        >
          <Flag aria-hidden />
          {setup.pending ? 'Starting militia…' : 'Start militia week'}
        </Button>
        <MaintenanceReason notice={maintenance} />
      </>
    );
  return (
    <Button
      type="button"
      id={setup.ids.next}
      onClick={setup.goNext}
      className={className}
    >
      Next: {setup.next.label}
      <ArrowRight aria-hidden />
    </Button>
  );
}
