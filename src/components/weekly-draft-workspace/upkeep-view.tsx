'use client';
import { Card } from '~/components/ui/card';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { UpkeepView as UpkeepFacts } from './types';
import { IssueNotes } from './upkeep-parts';
import { Rank } from './upkeep-rank-view';
import { Attrition, Notoriety, Shortage } from './upkeep-steps';
import { TeamConditions } from './upkeep-teams';
import { Deposits } from './upkeep-transfers';

// Upkeep as the numbered rules steps: team conditions, training attrition,
// maximum notoriety, treasury shortage, rank, then deposits and withdrawals.
// Each section reports only its own effect; the week frame carries readiness
// and the whole-week totals.
export function UpkeepView({
  view,
  edit,
  disabled,
}: {
  view: UpkeepFacts;
  edit: (edit: WeeklyDraftEdit) => unknown;
  disabled: boolean;
}) {
  const sections = view.sections;
  if (view.skipped || !sections)
    return (
      <section aria-label="Upkeep">
        <Card className="space-y-1 p-4">
          <p>Upkeep is skipped for the militia’s first week.</p>
          <p className="text-muted-foreground text-sm">
            No team recovery, attrition, rank or transfers this week.
          </p>
        </Card>
      </section>
    );
  return (
    <section aria-label="Upkeep" className="space-y-6">
      <TeamConditions teams={sections.teams} edit={edit} disabled={disabled} />
      <Attrition
        attrition={sections.attrition}
        rank={view.before.rank}
        edit={edit}
        disabled={disabled}
      />
      <Notoriety
        notoriety={sections.notoriety}
        edit={edit}
        disabled={disabled}
      />
      <Shortage shortage={sections.shortage} edit={edit} disabled={disabled} />
      <Rank rank={sections.rank} edit={edit} disabled={disabled} />
      <Deposits
        transfers={sections.transfers}
        edit={edit}
        disabled={disabled}
      />
      {sections.general.length > 0 && (
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">Also this week</p>
          <IssueNotes issues={sections.general} />
        </div>
      )}
    </section>
  );
}
