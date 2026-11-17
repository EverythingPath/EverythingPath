'use client';
import { useId } from 'react';
import {
  MaintenanceReason,
  MaintenanceReasonScope,
} from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { DormantGroup, GrantEntryList } from './character-sheet-grants';
import type { GrantEntryView } from './character-sheet-grants-view-model';
import type {
  CharacterSheetRacesView,
  RaceStatisticsView,
  RacialTraitOptionView,
} from './character-sheet-races-view-model';
import { listGrantEntryWarnings } from './grant-entry-row';
import { RacePicker } from './race-picker';
import { RacialAbilityScoreSummary } from './racial-ability-score-summary';
import { RaceEquivalenceChoice } from './race-equivalence-choice';
import { RacialRowChoices } from './racial-row-choices';
import { RacialStatisticsEditor } from './racial-statistics-editor';
import { RacialTraitOptions } from './racial-trait-options';
import { SelectionChecks } from './selection-checks';
import { useSelectionRow } from './selection-order-context';
import { Block, fieldLabel, RemoteNotice } from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';
import { useFocusAfterGrantDiscard } from './use-focus-after-grant-discard';

type Controller = ReturnType<typeof useCharacterSheet>;
type ReadySheet = NonNullable<Controller['sheet']>;
type WarningProps = {
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
};

function flattenRows(rows: GrantEntryView[]): GrantEntryView[] {
  return rows.flatMap((row) => [row, ...flattenRows(row.replaced)]);
}

// A row with a structured choice shows it through its own control: the raw
// key never reads as "Choice: …" and the free-text editor leaves it alone.
function withStructuredChoices(
  rows: GrantEntryView[],
  choiceRowIds: ReadonlySet<string>,
): GrantEntryView[] {
  return rows.map((row) => ({
    ...row,
    ...(choiceRowIds.has(row.rowId)
      ? { choice: null, canEditChoice: false }
      : {}),
    replaced: withStructuredChoices(row.replaced, choiceRowIds),
  }));
}

/**
 * The race and its traits (approved variant B's identity block, #304): the
 * race chosen among cards, its fixed facts read-only, the racial part of
 * each ability beside the ability's breakdown, the traits a race gives with
 * their structured choices, replaced standards muted beneath their
 * alternate, lost state under "Not counting now", and the alternates as
 * cards. Grant rows keep the Grants UI's Keep, Edit and Discard; the race's
 * own controls acknowledge their saves where they are. Loading and a
 * missing sheet are the sheet's own states; this block renders ready data.
 */
export function CharacterSheetRaces({
  races,
  statistics,
  raceNames,
  calculated,
  actions,
  grants,
  warnings,
  warningController,
}: WarningProps & {
  races: CharacterSheetRacesView;
  statistics: RaceStatisticsView | null;
  raceNames: Record<string, string>;
  calculated: Pick<ReadySheet['calculated'], 'racial' | 'breakdowns'>;
  actions: Controller['races'];
  grants: Controller['grants'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useId();
  const choiceRowIds = new Set(races.choiceRows.map((row) => row.rowId));
  const rows = withStructuredChoices(races.rows, choiceRowIds);
  const dormantRows = withStructuredChoices(races.dormantRows, choiceRowIds);
  const section = {
    kind: 'racialTrait' as const,
    title: 'Racial traits',
    rows,
    dormantRows,
    dormantLabel: `Not counting now (${dormantRows.length})`,
  };
  const focus = useFocusAfterGrantDiscard([section], grants.discard);
  const rowActions = { ...grants, discard: focus.discard };
  const traitRowIds = new Set(
    flattenRows([...rows, ...dormantRows]).map((row) => row.rowId),
  );
  const choicesByRow = new Map(
    races.choiceRows.map((choice) => [choice.rowId, choice]),
  );
  const optionsByEntry = new Map<string, RacialTraitOptionView>(
    races.traitOptions.flatMap((option) =>
      option.entryId === null ? [] : [[option.entryId, option]],
    ),
  );
  const equivalenceRows = races.choiceRows.filter(
    (choice) => !traitRowIds.has(choice.rowId) && choice.raceChoices.length > 0,
  );
  const hasRace = races.selectedRaceId !== null;
  const raceSelection = useSelectionRow(calculated.racial.raceEntryId);
  const raceWarnings = calculated.racial.raceEntryId
    ? listGrantEntryWarnings({
        warnings,
        rowId: calculated.racial.raceEntryId,
      })
    : [];
  // Every selected race can be given Hit Dice of its own, so its editor
  // shows at zero too; it then also carries the race's own warnings.
  const showsStatistics = statistics !== null;
  const rowProps = {
    actions: rowActions,
    registerRow: focus.registerRow,
    warnings,
    warningController,
    renderExtra: (row: GrantEntryView) => (
      <RacialRowChoices
        row={row}
        choice={choicesByRow.get(row.rowId)}
        option={optionsByEntry.get(row.rowId)}
        standardOptions={races.standardOptions}
        raceNames={raceNames}
        actions={actions}
      />
    ),
  };
  return (
    <MaintenanceReasonScope id={reasonId}>
      <Block title="Race">
        <div className="flex flex-col gap-3">
          <RemoteNotice
            isShown={actions.hasRemoteChange}
            message="Race or racial traits changed."
            subject="race"
            onDismiss={actions.dismissRemoteChange}
          />
          <RacePicker
            options={races.raceOptions}
            selectedRaceId={races.selectedRaceId}
            racial={calculated.racial}
            actions={actions}
          />
          <SelectionChecks
            selection={raceSelection}
            warnings={showsStatistics ? [] : raceWarnings}
            warningController={warningController}
          />
          {hasRace ? (
            <RacialAbilityScoreSummary breakdowns={calculated.breakdowns} />
          ) : null}
          {showsStatistics ? (
            <RacialStatisticsEditor
              key={statistics.entryId}
              statistics={statistics}
              warnings={raceWarnings}
              warningController={warningController}
              actions={actions}
            />
          ) : null}
          <div className="flex flex-col gap-1">
            <p className={fieldLabel}>Racial traits</p>
            {rows.length > 0 ? (
              <GrantEntryList
                rows={rows}
                className="border-foreground/10 border-y"
                {...rowProps}
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                {hasRace
                  ? 'This race gives no racial traits.'
                  : 'Choose a race to see its racial traits.'}
              </p>
            )}
            <DormantGroup
              rows={dormantRows}
              label={section.dormantLabel}
              {...rowProps}
            />
          </div>
          {hasRace ? (
            <RacialTraitOptions
              options={races.traitOptions}
              actions={actions}
            />
          ) : null}
          {equivalenceRows.length > 0 ? (
            <div className="flex flex-col gap-1">
              <p className={fieldLabel}>Race equivalence</p>
              <ul className="flex flex-col gap-1">
                {equivalenceRows.map((choice) => (
                  <li key={choice.rowId} aria-label={choice.name}>
                    <RaceEquivalenceChoice
                      row={choice}
                      raceNames={raceNames}
                      actions={actions}
                      showsName
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
