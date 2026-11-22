'use client';
import { ChevronRight } from 'lucide-react';
import { useCallback, useId, useState } from 'react';
import {
  MaintenanceReason,
  MaintenanceReasonScope,
} from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { cn } from '~/lib/utils';
import type {
  GrantEntryView,
  GrantSectionView,
} from './character-sheet-grants-view-model';
import { GrantEntryRow, type RenderRowExtra } from './grant-entry-row';
import { useRevealTarget } from './reveal-entry-row';
import { action, Block, RemoteNotice } from './sheet-parts';
import { useFocusAfterGrantDiscard } from './use-focus-after-grant-discard';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type Actions = Controller['grants'];
type WarningProps = {
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
};
type RowProps = WarningProps & {
  actions: Actions;
  registerRow: (rowId: string, element: HTMLDivElement | null) => void;
  renderExtra?: RenderRowExtra;
  equipmentRowIds?: ReadonlySet<string>;
};

export function GrantEntryList({
  rows,
  className,
  ...props
}: RowProps & { rows: GrantEntryView[]; className?: string }) {
  return (
    <ul className={cn('divide-foreground/10 divide-y', className)}>
      {rows.map((row) => (
        <li key={row.rowId} aria-label={row.name}>
          <GrantEntryRow row={row} {...props} />
        </li>
      ))}
    </ul>
  );
}

// Entries whose source is gone, collapsed under their count at the end of
// the section. Only the player opens it, here or by following a notice to
// one of its rows; a change from another player never does. Its rows render
// only while open, so nothing hidden can be reached.
export function DormantGroup({
  rows,
  label,
  ...props
}: RowProps & { rows: GrantEntryView[]; label: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const open = useCallback(() => setIsOpen(true), []);
  useRevealTarget({ rowIds: rows.map((row) => row.rowId), isOpen, open });
  if (rows.length === 0) return null;
  return (
    <div className="border-foreground/10 mt-2 border-t pt-2">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          action,
          'text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-mono text-xs',
        )}
      >
        <ChevronRight
          aria-hidden
          className={cn('size-3.5 transition-transform', isOpen && 'rotate-90')}
        />
        {label}
      </button>
      <div id={panelId}>
        {isOpen ? <GrantEntryList rows={rows} {...props} /> : null}
      </div>
    </div>
  );
}

// One section per entry kind. The maintenance reason is stated once at its
// foot; every disabled control in the section points at that one.
function GrantSection({
  section,
  ...props
}: RowProps & { section: GrantSectionView }) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useId();
  return (
    <MaintenanceReasonScope id={reasonId}>
      <Block title={section.title}>
        {section.rows.length > 0 ? (
          <GrantEntryList rows={section.rows} {...props} />
        ) : null}
        <DormantGroup
          rows={section.dormantRows}
          label={section.dormantLabel}
          {...props}
        />
        <MaintenanceReason
          id={reasonId}
          notice={maintenance}
          className="mt-2 text-xs"
        />
      </Block>
    </MaintenanceReasonScope>
  );
}

/**
 * Grants and dormant Selections (#301): each kind in its own
 * section beside the personal adjustments and sheet entries, with its
 * ordinary rows, replaced entries beneath their replacer and a collapsed
 * "Not counting now" group for lost state. Nothing renders without
 * sections; the sheet's own skeleton and unavailable states cover the rest.
 */
export function CharacterSheetGrants({
  sections,
  actions,
  warnings,
  warningController,
  equipmentRowIds,
  renderExtra,
}: WarningProps & {
  sections: GrantSectionView[];
  actions: Actions;
  /** Granted armor and shields: equipped in the Equipment block instead. */
  equipmentRowIds?: ReadonlySet<string>;
  /** Controls a row carries under its details, such as opposition schools. */
  renderExtra?: RenderRowExtra;
}) {
  const focus = useFocusAfterGrantDiscard(sections, actions.discard);
  const rowActions = { ...actions, discard: focus.discard };
  if (sections.length === 0) return null;
  return (
    <>
      <RemoteNotice
        isShown={actions.hasRemoteChange}
        message="Entries updated by another player."
        subject="entries"
        onDismiss={actions.dismissRemoteChange}
      />
      {sections.map((section) => (
        <GrantSection
          key={section.kind}
          section={section}
          actions={rowActions}
          registerRow={focus.registerRow}
          equipmentRowIds={equipmentRowIds}
          renderExtra={renderExtra}
          warnings={warnings}
          warningController={warningController}
        />
      ))}
    </>
  );
}
