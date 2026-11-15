'use client';
import { Check, X } from 'lucide-react';
import { useId } from 'react';
import { cn } from '~/lib/utils';
import type { CharacterSheetSelectionRow } from './character-sheet-selections-view-model';
import { InlineWarnings } from './inline-warning';
import { PrerequisiteStatusChip } from './prerequisite-status';
import { fieldLabel } from './sheet-parts';
import type { WarningController } from './selection-view-types';
import type { SheetWarningView } from './use-character-sheet';

/** A row's prerequisites now and at its recorded level, as the view gives them. */
export type PrerequisiteGroupsView = Pick<
  CharacterSheetSelectionRow,
  | 'currentStatus'
  | 'recordedStatus'
  | 'recordedLevelLabel'
  | 'currentChecks'
  | 'recordedChecks'
  | 'currentWarnings'
  | 'recordedWarnings'
>;
type Status = PrerequisiteGroupsView['currentStatus'];
type CheckView = PrerequisiteGroupsView['currentChecks'][number];

const currentTitle = 'Prerequisites now';

const warningKey = (warning: SheetWarningView) =>
  `${warning.check}:${warning.subject}`;

/**
 * The warnings a row lists apart from its prerequisite groups, so a
 * prerequisite never shows twice.
 */
export function listUngroupedWarnings(
  warnings: SheetWarningView[],
  groups: PrerequisiteGroupsView | undefined,
) {
  if (!groups) return warnings;
  const grouped = new Set(
    [...groups.currentWarnings, ...groups.recordedWarnings].map(warningKey),
  );
  return warnings.filter((warning) => !grouped.has(warningKey(warning)));
}

/** A Prestige Class's entry requirements, as the classes view gives them. */
type EntryRequirementsView = {
  status: Status;
  currentStatus: Status;
  checks: CheckView[];
  warnings: SheetWarningView[];
  recordedLevelLabel: string | null;
};

/**
 * A Prestige Class's entry requirements as prerequisite groups: entry at its
 * first Class Level, and now only for a class already entered (its current
 * clauses are not listed). While a clause is unresolved the entry has no
 * status, yet its checked clauses still show, with no met or failed chip.
 */
export function listEntryRequirementGroups(
  requirements: EntryRequirementsView,
): PrerequisiteGroupsView {
  return {
    currentStatus: requirements.currentStatus,
    currentChecks: [],
    currentWarnings: [],
    recordedStatus:
      requirements.status ??
      (requirements.checks.length > 0 || requirements.warnings.length > 0
        ? 'none'
        : null),
    recordedChecks: requirements.checks,
    recordedWarnings: requirements.warnings,
    recordedLevelLabel: requirements.recordedLevelLabel,
  };
}

/** A group with nothing checked, nothing waived and no warning is left out. */
function hasGroup(
  status: Status,
  checks: CheckView[],
  warnings: SheetWarningView[],
) {
  if (checks.length > 0 || warnings.length > 0) return true;
  return status !== null && status !== 'none';
}

function CheckList({ label, checks }: { label: string; checks: CheckView[] }) {
  if (checks.length === 0) return null;
  return (
    <ul aria-label={label} className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
      {checks.map((check) => (
        <li
          key={`${check.view}:${check.clauseIndex}`}
          className={cn(
            'flex min-w-0 items-center gap-1 [overflow-wrap:anywhere]',
            check.met ? 'text-muted-foreground' : 'text-amber-300',
          )}
        >
          {check.met ? (
            <Check aria-hidden className="size-3.5 shrink-0" />
          ) : (
            <X aria-hidden className="size-3.5 shrink-0" />
          )}
          <span>
            {check.label}
            <span className="sr-only">{check.met ? ' met' : ' not met'}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function PrerequisiteGroup({
  title,
  status,
  checks,
  warnings,
  warningController,
}: {
  title: string;
  status: Status;
  checks: CheckView[];
  warnings: SheetWarningView[];
  warningController?: WarningController;
}) {
  const titleId = useId();
  return (
    <div
      role="group"
      aria-labelledby={titleId}
      className="border-foreground/15 flex min-w-0 flex-col gap-1 border-l-2 pl-2"
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span id={titleId} className={fieldLabel}>
          {title}
        </span>
        <PrerequisiteStatusChip status={status} />
      </p>
      <CheckList label={title} checks={checks} />
      {warningController ? (
        <InlineWarnings
          warnings={warnings}
          controller={warningController}
          isNamedByMessage
        />
      ) : null}
    </div>
  );
}

/**
 * A row's prerequisites now and at its recorded level, side by side and
 * never merged: each with its status, its checked clauses and its own
 * warnings, accepted or reopened apart. The recorded group shows only while
 * the row is tied to a usable Class Level. A preview passes no controller,
 * so nothing it shows can be accepted before it is saved.
 */
export function PrerequisiteGroups({
  groups,
  warningController,
  className,
}: {
  groups: PrerequisiteGroupsView;
  warningController?: WarningController;
  className?: string;
}) {
  const showsCurrent = hasGroup(
    groups.currentStatus,
    groups.currentChecks,
    groups.currentWarnings,
  );
  // A waiver holds at every level, so it is stated once, now.
  const isWaivedTwice =
    groups.currentStatus === 'exempt' &&
    groups.recordedStatus === 'exempt' &&
    groups.recordedChecks.length === 0 &&
    groups.recordedWarnings.length === 0;
  const recordedTitle =
    groups.recordedStatus !== null &&
    !isWaivedTwice &&
    hasGroup(
      groups.recordedStatus,
      groups.recordedChecks,
      groups.recordedWarnings,
    )
      ? groups.recordedLevelLabel
      : null;
  if (!showsCurrent && !recordedTitle) return null;
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      {showsCurrent ? (
        <PrerequisiteGroup
          title={currentTitle}
          status={groups.currentStatus}
          checks={groups.currentChecks}
          warnings={groups.currentWarnings}
          warningController={warningController}
        />
      ) : null}
      {recordedTitle ? (
        <PrerequisiteGroup
          title={recordedTitle}
          status={groups.recordedStatus}
          checks={groups.recordedChecks}
          warnings={groups.recordedWarnings}
          warningController={warningController}
        />
      ) : null}
    </div>
  );
}
