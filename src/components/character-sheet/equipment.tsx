'use client';
import { Plus } from 'lucide-react';
import { useId, useState } from 'react';
import {
  MaintenanceReason,
  MaintenanceReasonScope,
} from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { EquipmentRow } from './equipment-row';
import { EquipmentSummary } from './equipment-summary';
import type { CatalogDefinition } from './sheet-catalog-context';
import { action, Block, RemoteNotice } from './sheet-parts';
import type { SpellEffectView } from './spell-effect-target-chips';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';
import { WeaponCatalogChoices } from './weapon-catalog-choices';

type Controller = ReturnType<typeof useCharacterSheet>;

/**
 * Equipment (approved variant B, beside Defenses): every armor and shield on
 * the Character, equipped or not, with what the equipped ones add up to.
 * AC and its variants stay in Defenses, which already include them; the
 * skill totals already include the armor check penalty. Items are added and
 * removed as Sheet entries; their gear state is edited here. Weapons are
 * added here too, each with its default attack routine under Attacks.
 */
export function Equipment({
  equipment,
  attacks,
  catalogEntries,
  spellEffects,
  warnings,
  warningController,
}: {
  equipment: Controller['equipment'];
  attacks?: Controller['attacks'];
  /** The definitions the item editor's Item Ability picker offers from. */
  catalogEntries?: readonly CatalogDefinition[];
  /** The sheet's Spell Effects, for the chips on the items they target. */
  spellEffects?: readonly SpellEffectView[];
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useId();
  const weaponPickerId = useId();
  const [isAddingWeapon, setIsAddingWeapon] = useState(false);
  const canAddWeapon = (attacks?.weaponCatalog.length ?? 0) > 0;
  return (
    <Block
      title="Equipment"
      aside={
        attacks ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(action, 'h-auto gap-1 rounded-none px-2 text-xs')}
            aria-expanded={isAddingWeapon}
            aria-controls={isAddingWeapon ? weaponPickerId : undefined}
            disabled={!canAddWeapon}
            onClick={() => setIsAddingWeapon(!isAddingWeapon)}
          >
            <Plus aria-hidden className="size-3" />
            Add weapon
          </Button>
        ) : null
      }
    >
      <MaintenanceReasonScope id={reasonId}>
        <div className="space-y-2">
          <RemoteNotice
            isShown={equipment.hasRemoteChange}
            message="Changed by another player."
            subject="equipment"
            onDismiss={equipment.dismissRemoteChange}
          />
          {attacks && isAddingWeapon ? (
            <WeaponCatalogChoices id={weaponPickerId} attacks={attacks} />
          ) : null}
          {equipment.totals ? (
            <EquipmentSummary totals={equipment.totals} />
          ) : null}
          {equipment.rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No armor or shields.
            </p>
          ) : (
            <ul className="divide-foreground/10 divide-y">
              {equipment.rows.map((row) => (
                <li key={row.entryId} aria-label={row.name}>
                  <EquipmentRow
                    row={row}
                    equipment={equipment}
                    catalogEntries={catalogEntries}
                    operationId={attacks?.operationId}
                    spellEffects={spellEffects}
                    warnings={warnings}
                    warningController={warningController}
                  />
                </li>
              ))}
            </ul>
          )}
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
