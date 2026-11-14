'use client';
import { Minus, Plus } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import {
  MaintenanceReason,
  MaintenanceReasonScope,
} from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { ManualProficiencyEditor } from './manual-proficiency-editor';
import { ProficiencyChoice } from './proficiency-choice';
import { ProficiencyRow } from './proficiency-row';
import { listProficiencyRows } from './proficiency-rows';
import { action, Block, RemoteNotice } from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';

type Proficiencies = ReturnType<typeof useCharacterSheet>['proficiencies'];
type Disposition = 'added' | 'removed';

/**
 * Proficiencies: every weapon, armor and shield Proficiency with the source
 * that grants it, the table's own additions and removals, and the weapon
 * choices its sources ask for (a Class Level's on its class's first level
 * only). A removal wins over a grant covering the same thing; its effect
 * shows as numbers in the breakdowns. An empty choice grants nothing and is
 * never a warning.
 */
export function Proficiencies({
  proficiencies,
}: {
  proficiencies: Proficiencies;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useId();
  const [openEditor, setOpenEditor] = useState<Disposition | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const removeButton = useRef<HTMLButtonElement>(null);
  const value = proficiencies.value;
  if (!value) return null;
  const rows = listProficiencyRows(value);

  function closeEditor() {
    const trigger = openEditor === 'removed' ? removeButton : addButton;
    setOpenEditor(null);
    trigger.current?.focus();
  }

  return (
    <Block title="Proficiencies">
      <MaintenanceReasonScope id={reasonId}>
        <div className="space-y-2">
          <RemoteNotice
            isShown={proficiencies.hasRemoteChange}
            message="Changed by another player."
            subject="proficiencies"
            onDismiss={proficiencies.dismissRemoteChange}
          />
          {proficiencies.choices.length > 0 ? (
            <ul className="border-foreground/15 space-y-2 border-b pb-2">
              {proficiencies.choices.map((choice) => (
                <li key={choice.entryId}>
                  <ProficiencyChoice
                    row={choice}
                    save={(next) =>
                      proficiencies.saveChoice(choice.entryId, next)
                    }
                  />
                </li>
              ))}
            </ul>
          ) : null}
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No proficiencies recorded.
            </p>
          ) : (
            <ul className="divide-foreground/10 divide-y">
              {rows.map((row) => (
                <li key={row.rowKey}>
                  <ProficiencyRow row={row} proficiencies={proficiencies} />
                </li>
              ))}
            </ul>
          )}
          {openEditor ? (
            <ManualProficiencyEditor
              key={openEditor}
              disposition={openEditor}
              save={({ proficiency, disposition }) =>
                proficiencies.saveManual(proficiency, disposition)
              }
              onClose={closeEditor}
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
            <Button
              ref={addButton}
              type="button"
              size="sm"
              variant="outline"
              className={action}
              aria-pressed={openEditor === 'added'}
              disabled={maintenance.readOnly}
              aria-describedby={maintenance.readOnly ? reasonId : undefined}
              onClick={() => setOpenEditor('added')}
            >
              <Plus aria-hidden className="size-4" />
              Add proficiency
            </Button>
            <Button
              ref={removeButton}
              type="button"
              size="sm"
              variant="outline"
              className={action}
              aria-pressed={openEditor === 'removed'}
              disabled={maintenance.readOnly}
              aria-describedby={maintenance.readOnly ? reasonId : undefined}
              onClick={() => setOpenEditor('removed')}
            >
              <Minus aria-hidden className="size-4" />
              Remove proficiency
            </Button>
          </div>
          <MaintenanceReason
            id={reasonId}
            notice={maintenance}
            className="text-xs"
          />
        </div>
      </MaintenanceReasonScope>
    </Block>
  );
}
