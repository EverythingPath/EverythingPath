'use client';
import { TriangleAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import {
  MaintenanceReason,
  MaintenanceReasonScope,
} from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { ClassDefinitionSwitchNotice } from './class-definition-switch-notice';
import { ClassPicker } from './class-level-class-picker';
import {
  ClassLevelRow,
  getLevelAnchorId,
  levelColumns,
} from './class-level-row';
import { InlineWarnings } from './inline-warning';
import {
  action,
  Block,
  chip,
  fieldLabel,
  RemoteNotice,
  SaveFeedback,
  getScrollBehavior,
} from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type ReadySheet = NonNullable<Controller['sheet']>;

function findRowInput(entryId: string) {
  return document
    .getElementById(getLevelAnchorId(entryId))
    ?.querySelector<HTMLInputElement>('input');
}

// The minimal sheet's advisory, plain and once: nothing here is accepted.
function Advisory({ message }: { message: string | null }) {
  if (message === null) return null;
  return (
    <p className="flex items-start gap-1.5 text-xs text-amber-300">
      <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{message}</span>
    </p>
  );
}

function findRowDeleteButton(entryId: string) {
  return document
    .getElementById(getLevelAnchorId(entryId))
    ?.querySelector<HTMLElement>('[data-delete-level]');
}

// After a deletion, focus lands on the successor's trash (or the last row's,
// or Level up) once the subscription has dropped the row.
function useFocusAfterDeletion({
  rows,
  status,
  levelUp,
}: {
  rows: ReadySheet['levels'];
  status: Controller['levels']['status'];
  levelUp: React.RefObject<HTMLButtonElement | null>;
}) {
  const deleting = useRef<{ entryId: string; index: number } | null>(null);
  useEffect(() => {
    const pending = deleting.current;
    if (!pending || status.kind === 'saving') return;
    if (status.kind === 'error') {
      deleting.current = null;
      return;
    }
    if (rows.some((row) => row._id === pending.entryId)) return;
    deleting.current = null;
    const successor = rows[Math.min(pending.index, rows.length - 1)];
    const target = successor
      ? findRowDeleteButton(successor._id)
      : levelUp.current;
    target?.focus();
  }, [rows, status.kind, levelUp]);
  return deleting;
}

// Only the device that appended or inserted scrolls to and focuses the new
// level, once it has rendered; motion follows the player's preference.
function useScrollToAppended(
  rows: ReadySheet['levels'],
  levels: Controller['levels'],
) {
  const appended = levels.appendedEntryId;
  useEffect(() => {
    if (!appended || !rows.some((row) => row._id === appended)) return;
    const input = findRowInput(appended);
    input?.scrollIntoView({ block: 'center', behavior: getScrollBehavior() });
    input?.focus({ preventScroll: true });
    levels.acknowledgeAppend();
  }, [appended, rows, levels]);
}

export type UnplacedSelection = { entryId: string; name: string };

/** Selections gained at a Class Level that no longer exists, named. */
function UnplacedSelections({
  selections,
}: {
  selections: UnplacedSelection[];
}) {
  if (selections.length === 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-sky-300">
      <span>Gained at a deleted Class Level:</span>
      {selections.map((selection) => (
        <span key={selection.entryId} className={chip}>
          {selection.name}
        </span>
      ))}
    </p>
  );
}

/**
 * The ordered Class Levels: every row keyed by its stable entry, Level up
 * appending the chosen next class (or an Unspecified level), insertion
 * before any row, and the section's own save and another-player feedback.
 * Every level may be removed; at zero the PC rule warns, acceptably, and
 * Level 1 can be appended again. Total HP is the sum of these rows, so
 * while it cannot resolve the reason reads here, under them. Under
 * maintenance the block states the reason once, beside Level up; every
 * disabled save in it is described by that one sentence. Another player's
 * change to the levels or their class versions is announced once, here, as
 * is this device's saved class version switch with what it changed.
 */
export function ClassLevels({
  rows,
  metadata,
  advisory,
  showMissingChoices,
  classes,
  unplacedSelections,
  warnings,
  warningController,
  levels,
  saveHitPoints,
  saveClassLevel,
}: {
  rows: ReadySheet['levels'];
  metadata: ReadySheet['calculated']['classLevels'];
  advisory: string | null;
  showMissingChoices: boolean;
  classes: Controller['classes'];
  unplacedSelections: UnplacedSelection[];
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
  levels: Controller['levels'];
  saveHitPoints: Controller['saveHitPoints'];
  saveClassLevel: Controller['saveClassLevel'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useId();
  const isBusy = levels.status.kind === 'saving';
  const levelUp = useRef<HTMLButtonElement>(null);
  const deleting = useFocusAfterDeletion({
    rows,
    status: levels.status,
    levelUp,
  });
  useScrollToAppended(rows, levels);
  // The next level's class: the last level's until the player picks one.
  const [pickedNextClass, setPickedNextClass] = useState<string | null>(null);
  const nextClass = pickedNextClass ?? rows.at(-1)?.state.classEntryId ?? '';
  const nextClassChoice = classes.choices.find(
    (choice) => choice.classEntryId === nextClass,
  );
  // One notice for the section: a version switch also changes the levels.
  const remoteMessage = levels.hasRemoteChange
    ? 'Class Levels updated by another player.'
    : 'Class versions updated by another player.';
  const switchResult = classes.definitionSwitchResult;

  return (
    <Block
      title="Class Levels"
      aside={
        <p className="text-muted-foreground font-mono text-xs">
          {rows.length} {rows.length === 1 ? 'level' : 'levels'}
        </p>
      }
    >
      <MaintenanceReasonScope id={reasonId}>
        <div className="space-y-2">
          <RemoteNotice
            isShown={levels.hasRemoteChange || classes.hasRemoteChange}
            message={remoteMessage}
            subject="Class Levels"
            onDismiss={() => {
              levels.dismissRemoteChange();
              classes.dismissRemoteChange();
            }}
          />
          <RemoteNotice
            isShown={classes.hasRemoteAdvanceChange}
            message="Casting advances updated by another player."
            subject="casting advances"
            onDismiss={classes.dismissRemoteAdvanceChange}
          />
          {switchResult ? (
            <ClassDefinitionSwitchNotice
              result={switchResult}
              rows={rows}
              classes={classes}
              warnings={warnings}
              onDismiss={classes.dismissDefinitionSwitchResult}
            />
          ) : null}
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No Class Levels yet.
            </p>
          ) : (
            <>
              <div
                aria-hidden
                className={cn('hidden px-2 md:grid', levelColumns, fieldLabel)}
              >
                <span>Level</span>
                <span>Class</span>
                <span>Hit points</span>
                <span>Favored</span>
                <span>Ability</span>
                <span />
              </div>
              <ul className="space-y-2">
                {rows.map((row, index) => (
                  <ClassLevelRow
                    key={row._id}
                    row={row}
                    index={index}
                    count={rows.length}
                    metadata={metadata.find((item) => item.entryId === row._id)}
                    classes={classes}
                    warnings={warnings.filter(
                      (warning) =>
                        warning.target.kind === 'classLevel' &&
                        warning.target.entryId === row._id,
                    )}
                    sheetWarnings={warnings}
                    warningController={warningController}
                    saveHitPoints={saveHitPoints}
                    saveClassLevel={saveClassLevel}
                    isChangingLevels={isBusy}
                    moveLevel={levels.move}
                    insertLevel={levels.insert}
                    onDelete={() => {
                      if (maintenance.readOnly) return;
                      deleting.current = { entryId: row._id, index };
                      void levels.remove(row._id);
                    }}
                  />
                ))}
              </ul>
            </>
          )}
          <UnplacedSelections selections={unplacedSelections} />
          {showMissingChoices ? (
            <InlineWarnings
              warnings={warnings.filter(
                (warning) =>
                  warning.target.kind === 'classLevels' ||
                  warning.target.kind === 'hitPoints',
              )}
              controller={warningController}
            />
          ) : (
            <>
              <Advisory message={advisory} />
              <InlineWarnings
                warnings={classes.warnings.filter(
                  (warning) => warning.check === 'classVersions',
                )}
                controller={warningController}
              />
            </>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-sm">
            <span className="text-muted-foreground">
              Level {rows.length + 1} as
            </span>
            <ClassPicker
              label="Class for the next level"
              value={nextClassChoice?.classEntryId ?? null}
              classes={classes}
              disabled={maintenance.readOnly}
              className="w-44 max-w-full"
              onValueChange={(classEntryId) =>
                setPickedNextClass(classEntryId ?? '')
              }
            />
            <Button
              ref={levelUp}
              type="button"
              size="sm"
              variant="outline"
              className={action}
              aria-describedby={maintenance.readOnly ? reasonId : undefined}
              disabled={isBusy || maintenance.readOnly}
              onClick={() => {
                if (maintenance.readOnly) return;
                void levels.add(nextClassChoice?.classEntryId);
              }}
            >
              Level up
            </Button>
            <SaveFeedback
              status={levels.status}
              savedText="Class Levels saved."
            />
            <MaintenanceReason id={reasonId} notice={maintenance} />
          </div>
        </div>
      </MaintenanceReasonScope>
    </Block>
  );
}
