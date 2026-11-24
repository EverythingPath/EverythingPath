'use client';
import type { ReactNode } from 'react';
import type { ClassSwitchEntryChange } from '~/lib/character-sheet-class-switch';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import {
  dormantKeptText,
  keptLevelsText,
  keptWarningsText,
  statisticText,
  warningName,
  type ClassSwitchDescription,
  type ClassSwitchWarningKey,
} from './class-switch-copy';
import { chip, fieldLabel } from './sheet-parts';
import type { SheetWarningView } from './use-character-sheet';

const line = 'text-sm [overflow-wrap:anywhere]';
const list = 'flex flex-col gap-0.5';

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className={fieldLabel}>{label}</p>
      {children}
    </div>
  );
}

/** A name that leads somewhere is a link-styled button; otherwise a chip. */
function Name({
  children,
  onReveal,
}: {
  children: string;
  onReveal?: () => void;
}) {
  if (!onReveal) return <span className={chip}>{children}</span>;
  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      className="h-auto min-h-11 px-0 font-mono text-xs whitespace-normal md:min-h-6"
      onClick={onReveal}
    >
      {children}
    </Button>
  );
}

function NameList({
  changes,
  onReveal,
}: {
  changes: ClassSwitchEntryChange[];
  onReveal?: (change: ClassSwitchEntryChange) => void;
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {changes.map((change) => (
        <li key={change.id}>
          <Name onReveal={onReveal ? () => onReveal(change) : undefined}>
            {change.name}
          </Name>
        </li>
      ))}
    </ul>
  );
}

/**
 * What a class version switch keeps and recalculates (#583), before saving
 * and in its result: the levels kept, the totals that change, the entries
 * that stop or start counting, and what becomes of accepted warnings. Names
 * lead to their rows and warnings where the caller says how.
 */
export function ClassSwitchPreview({
  description,
  className,
  warnings,
  hasCasting = false,
  showKept = true,
  onRevealEntry,
  onRevealWarning,
  ...props
}: {
  description: ClassSwitchDescription;
  /** The class's name, for "All 3 Fighter levels". */
  className: string;
  /** The sheet's warnings, which name the ones that still exist. */
  warnings: readonly SheetWarningView[];
  /** The class casts, or a level advances casting: those links stay. */
  hasCasting?: boolean;
  /** The Kept sentence: shown before saving, implied by the result. */
  showKept?: boolean;
  onRevealEntry?: (change: ClassSwitchEntryChange) => void;
  onRevealWarning?: (key: ClassSwitchWarningKey) => void;
  id?: string;
}) {
  const {
    levelIds,
    statistics,
    dormant,
    restored,
    keptWarnings,
    reopenedWarnings,
    clearedWarnings,
  } = description;
  const hasWarnings =
    keptWarnings.length + reopenedWarnings.length + clearedWarnings.length > 0;
  const nameOf = (key: ClassSwitchWarningKey) => warningName(warnings, key);
  return (
    <div {...props} className="flex min-w-0 flex-col gap-3">
      {showKept ? (
        <Group label="Kept">
          <p className={line}>{keptLevelsText(levelIds.length, className)}</p>
          {hasCasting ? (
            <p className={line}>
              Spells and casting advances stay with this class.
            </p>
          ) : null}
        </Group>
      ) : null}
      <Group label="Changes">
        {statistics.length === 0 ? (
          <p className={cn(line, 'text-muted-foreground')}>
            Totals stay the same.
          </p>
        ) : (
          <ul className={cn(list, 'font-mono')}>
            {statistics.map((statistic) => (
              <li key={statistic.key} className={line}>
                {statisticText(statistic)}
              </li>
            ))}
          </ul>
        )}
      </Group>
      {dormant.length > 0 ? (
        <Group label="Stops counting">
          <NameList changes={dormant} onReveal={onRevealEntry} />
          <p className={cn(line, 'text-muted-foreground')}>
            {dormantKeptText(dormant.length)}
          </p>
        </Group>
      ) : null}
      {restored.length > 0 ? (
        <Group label="Counts again">
          <NameList changes={restored} onReveal={onRevealEntry} />
        </Group>
      ) : null}
      {hasWarnings ? (
        <Group label="Warnings">
          <ul className={list}>
            {keptWarnings.length > 0 ? (
              <li className={cn(line, 'text-muted-foreground')}>
                {keptWarningsText(keptWarnings.length)}
              </li>
            ) : null}
            {reopenedWarnings.map((key) => (
              <li
                key={`${key.check}:${key.subject}`}
                className={cn(line, 'text-amber-300')}
              >
                <Name
                  onReveal={
                    onRevealWarning ? () => onRevealWarning(key) : undefined
                  }
                >
                  {nameOf(key)}
                </Name>
                : will need accepting again
              </li>
            ))}
            {clearedWarnings.map((key) => (
              <li
                key={`${key.check}:${key.subject}`}
                className={cn(line, 'text-muted-foreground')}
              >
                <span className={chip}>{nameOf(key)}</span>: no longer applies
              </li>
            ))}
          </ul>
        </Group>
      ) : null}
    </div>
  );
}
