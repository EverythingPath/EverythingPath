'use client';
import { useId, useState } from 'react';
import {
  MaintenanceReason,
  MaintenanceReasonScope,
} from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { DormantGroup, GrantEntryList } from './character-sheet-grants';
import type {
  GrantEntryView,
  GrantSectionView,
} from './character-sheet-grants-view-model';
import { InlineWarnings } from './inline-warning';
import { PrerequisiteFacts } from './prerequisite-facts';
import { PrerequisiteProse } from './prerequisite-status';
import { SelectionDescription } from './selection-description';
import { SelectionGuidance } from './selection-guidance';
import { SelectionChoiceGuidance } from './selection-choice-guidance';
import { SelectionRow } from './selection-row';
import { SelectionSlotGroup, type OpenPicker } from './selection-slot-group';
import { Block, fieldLabel, RemoteNotice } from './sheet-parts';
import type {
  SelectionControls,
  SelectionRowView,
  SelectionsView,
  WarningController,
} from './selection-view-types';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';
import { useFocusAfterGrantDiscard } from './use-focus-after-grant-discard';

type StoredRow = SelectionRowView & {
  entryId: NonNullable<SelectionRowView['entryId']>;
};

// Section-wide warnings by where they belong: a slot's allowance under that
// slot, the trait rules under Traits or the Drawback, class alignment by
// the alignment it is about.
const traitSubjects = new Set(['traits', 'campaignTrait', 'npcTraits']);
function placeSectionWarning(warning: SheetWarningView) {
  if (warning.check === 'classAlignment') return 'facts';
  if (warning.subject === 'drawbacks') return 'trait:drawback';
  if (traitSubjects.has(warning.subject)) return 'trait:general';
  return warning.subject;
}

function isStored(row: SelectionRowView): row is StoredRow {
  return row.entryId !== null;
}

/**
 * Feats & traits (approved variant B's feats block, #313): the alignment
 * and deity prerequisites read, then each slot with its count, its saved
 * Selections and an add control that opens the picker. Granted feats and
 * traits, and kept ones whose source is gone, keep the Grants rows' own
 * controls here; entries that count for nothing now sit collapsed under
 * "Not counting now". Every rules check is advisory. Loading and an
 * unavailable sheet are the sheet's own states; this block renders ready
 * data.
 */
export function CharacterSheetSelections({
  view,
  controls,
  warnings,
  grantSections,
  grants,
  sheetWarnings,
}: {
  view: SelectionsView;
  controls: SelectionControls;
  /** The sheet's warning controller: Accept and Reopen. */
  warnings: WarningController;
  /** The Grants view's feat and trait sections. */
  grantSections: GrantSectionView[];
  grants: ReturnType<typeof useCharacterSheet>['grants'];
  /** Every sheet warning, for the Grant rows shown here. */
  sheetWarnings: SheetWarningView[];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useId();
  const [picker, setPicker] = useState<OpenPicker | null>(null);
  const focus = useFocusAfterGrantDiscard(grantSections, grants.discard);

  const selectionRows = view.rows.filter(
    (row): row is StoredRow => isStored(row) && row.canEdit && !row.dormant,
  );
  const slotIds = new Set(view.slots.map((slot) => slot.id));
  const unslotted = selectionRows.filter(
    (row) => !row.slot || !slotIds.has(row.slot.id),
  );
  const shownIds = new Set(selectionRows.map((row) => row.rowId));
  const grantRows = grantSections
    .flatMap((section) => section.rows)
    .filter((row) => !shownIds.has(row.rowId));
  const dormantRows = grantSections.flatMap((section) => section.dormantRows);
  const rowsById = new Map(view.rows.map((row) => [row.rowId, row]));

  const rowIds = new Set(view.rows.map((row) => row.rowId));
  const placed = new Map<string, SheetWarningView[]>();
  for (const warning of view.warnings) {
    // An entry's own warning is shown on its row.
    if (warning.target.kind === 'entry' && rowIds.has(warning.target.entryId))
      continue;
    const place = placeSectionWarning(warning);
    placed.set(place, [...(placed.get(place) ?? []), warning]);
  }
  const placedIds = new Set([...slotIds, 'facts']);
  const loose = [...placed.entries()].flatMap(([place, list]) =>
    placedIds.has(place) ? [] : list,
  );

  const featsUsed = view.slots
    .filter((slot) => slot.kind === 'feat')
    .reduce((sum, slot) => sum + slot.used, 0);
  const traitsUsed = view.slots
    .filter((slot) => slot.kind === 'trait' && slot.id !== 'trait:drawback')
    .reduce((sum, slot) => sum + slot.used, 0);
  const featBudget =
    view.budgets.generalFeats === null
      ? 'Unresolved'
      : view.budgets.generalFeats + view.budgets.bonusFeats;

  const grantProps = {
    actions: { ...grants, discard: focus.discard },
    registerRow: focus.registerRow,
    warnings: sheetWarnings,
    warningController: warnings,
    renderExtra: (row: GrantEntryView) => {
      const selection = rowsById.get(row.rowId);
      if (!selection) return null;
      return (
        <>
          <SelectionDescription text={selection.description} />
          <SelectionChoiceGuidance row={selection} />
          <SelectionGuidance text={selection.guidanceText} />
          <PrerequisiteProse text={selection.prerequisiteText} />
        </>
      );
    },
  };

  return (
    <MaintenanceReasonScope id={reasonId}>
      <Block
        title="Feats & traits"
        aside={
          <span className="text-muted-foreground font-mono text-xs">
            {featsUsed}/{featBudget} feats · {traitsUsed}/{view.budgets.traits}{' '}
            traits
          </span>
        }
      >
        <div className="flex flex-col gap-3">
          <RemoteNotice
            isShown={controls.hasRemoteChange}
            message="Feats and traits changed."
            subject="feats and traits"
            onDismiss={controls.dismissRemoteChange}
          />
          <PrerequisiteFacts
            facts={view.facts}
            controls={controls}
            warnings={placed.get('facts') ?? []}
            warningController={warnings}
          />
          <InlineWarnings
            warnings={loose}
            controller={warnings}
            isNamedByMessage
          />
          {view.slots.map((slot) => (
            <SelectionSlotGroup
              key={slot.id}
              slot={slot}
              rows={selectionRows.filter((row) => row.slot?.id === slot.id)}
              candidates={view.candidates}
              levels={view.levels}
              warnings={placed.get(slot.id) ?? []}
              controls={controls}
              warningController={warnings}
              picker={picker}
              onOpenPicker={setPicker}
              onClosePicker={() => setPicker(null)}
            />
          ))}
          {unslotted.length > 0 ? (
            <div className="flex flex-col gap-1">
              <p className={fieldLabel}>Other feats & traits</p>
              <ul className="divide-foreground/10 divide-y">
                {unslotted.map((row) => (
                  <SelectionRow
                    key={row.rowId}
                    row={row}
                    levels={view.levels}
                    controls={controls}
                    warningController={warnings}
                  />
                ))}
              </ul>
            </div>
          ) : null}
          {grantRows.length > 0 ? (
            <div className="flex flex-col gap-1">
              <p className={fieldLabel}>Granted and kept</p>
              <GrantEntryList
                rows={grantRows}
                className="border-foreground/10 border-y"
                {...grantProps}
              />
            </div>
          ) : null}
          <DormantGroup
            rows={dormantRows}
            label={`Not counting now (${dormantRows.length})`}
            {...grantProps}
          />
        </div>
        <MaintenanceReason
          id={reasonId}
          notice={maintenance}
          className="mt-2 text-xs"
        />
      </Block>
    </MaintenanceReasonScope>
  );
}
