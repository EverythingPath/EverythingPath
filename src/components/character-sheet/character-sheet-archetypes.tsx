'use client';
import { useId } from 'react';
import {
  MaintenanceReason,
  MaintenanceReasonScope,
} from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import type { SpellNames } from './archetype-casting-view-model';
import { ArchetypeClassGroup } from './archetype-class-group';
import {
  listRepresentedSelectionIds,
  type ArchetypesController,
  type FeatureNames,
} from './character-sheet-archetypes-view-model';
import { DormantGroup, GrantEntryList } from './character-sheet-grants';
import type { GrantSectionView } from './character-sheet-grants-view-model';
import { Block, fieldLabel, RemoteNotice } from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';
import { useFocusAfterGrantDiscard } from './use-focus-after-grant-discard';

type Controller = ReturnType<typeof useCharacterSheet>;

/**
 * Archetypes beside the Class Levels (#305): for each class, its
 * Archetypes as cards that apply to all of the class's levels, the chosen
 * ones opened into what they replace and add, their conflicts and warnings,
 * and the exact rows they replace. A Selection whose class is gone stays
 * under "Not counting now" with the Grants UI's Keep and Discard; the class
 * features they add or replace stay in the Grants UI. Loading and a missing
 * sheet are the sheet's own states; this block renders ready data.
 */
export function CharacterSheetArchetypes({
  archetypes,
  section,
  featureNames,
  spellNames,
  grants,
  warnings,
  warningController,
}: {
  archetypes: ArchetypesController;
  /** The sheet's recorded Archetype Selections as Grant rows. */
  section: GrantSectionView | undefined;
  featureNames: FeatureNames;
  /** Spell names for per-Spell casting conflicts (#422). */
  spellNames?: SpellNames;
  grants: Controller['grants'];
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useId();
  const represented = listRepresentedSelectionIds(archetypes.classes);
  const retainedRows = (section?.rows ?? []).filter(
    (row) => !represented.has(row.rowId),
  );
  const dormantRows = (section?.dormantRows ?? []).filter(
    (row) => !represented.has(row.rowId),
  );
  const focus = useFocusAfterGrantDiscard(
    section ? [section] : [],
    grants.discard,
  );
  const rowProps = {
    actions: { ...grants, discard: focus.discard },
    registerRow: focus.registerRow,
    warnings,
    warningController,
  };
  const grantProps = {
    grantRows: new Map(
      [...(section?.rows ?? []), ...(section?.dormantRows ?? [])].map((row) => [
        row.rowId,
        row,
      ]),
    ),
    rowProps,
  };
  return (
    <MaintenanceReasonScope id={reasonId}>
      <Block title="Archetypes">
        <div className="flex flex-col gap-3">
          <RemoteNotice
            isShown={archetypes.hasRemoteChange}
            message="Archetypes or replaced features changed."
            subject="archetypes"
            onDismiss={archetypes.dismissRemoteChange}
          />
          {archetypes.classes.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Add a class to choose an Archetype.
            </p>
          ) : (
            archetypes.classes.map((group) => (
              <ArchetypeClassGroup
                key={group.classEntryId}
                group={group}
                featureNames={featureNames}
                spellNames={spellNames}
                grantProps={grantProps}
                actions={archetypes}
                warnings={warnings}
                warningController={warningController}
              />
            ))
          )}
          {retainedRows.length > 0 ? (
            <div className="flex flex-col gap-1">
              <p className={fieldLabel}>Not counting now</p>
              <GrantEntryList
                rows={retainedRows}
                className="border-foreground/10 border-y"
                {...rowProps}
              />
            </div>
          ) : null}
          <DormantGroup
            rows={dormantRows}
            label={`Not counting now (${dormantRows.length})`}
            {...rowProps}
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
