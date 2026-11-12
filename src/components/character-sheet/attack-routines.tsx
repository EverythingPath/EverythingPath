'use client';
import { Plus, Undo2, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import {
  MaintenanceReason,
  MaintenanceReasonScope,
} from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { AttackRoutineEditor } from './attack-routine-editor';
import { AttackRoutineRow } from './attack-routine-row';
import { describeWeapon } from './attack-routine-view-model';
import type { ItemPartsView } from './item-ability-options';
import type { SpellEffectView } from './spell-effect-target-chips';
import { NaturalAttackEditor } from './natural-attack-editor';
import type { CatalogDefinition } from './sheet-catalog-context';
import {
  action,
  Block,
  fieldLabel,
  RemoteNotice,
  SaveFeedback,
} from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';
import { WeaponCatalogChoices } from './weapon-catalog-choices';
import { WeaponChoiceCard } from './weapon-choice-card';

type Controller = ReturnType<typeof useCharacterSheet>;
type Attacks = Controller['attacks'];
type Editing = { entryId: string; origin: 'row' | 'create' };
type Picker = 'weapon' | 'ammunition' | 'routine' | 'natural' | null;

const toggle = cn(action, 'h-auto gap-1 rounded-none px-2 text-xs');

/** What a new routine can attack with, as cards: Gear and natural weapons, and the unarmed strike every Character has. */
function RoutineWeaponChoices({
  id,
  attacks,
  reasonId,
  onPick,
}: {
  id: string;
  attacks: Attacks;
  reasonId?: string;
  onPick: (weaponEntryId: string) => void;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const headingId = useId();
  const status = attacks.statusFor('create');
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="border-foreground/20 mt-2 space-y-2 border p-2"
    >
      <h3 id={headingId} className={fieldLabel}>
        Add attack routine
      </h3>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
        {attacks.weapons.map((weapon) => (
          <li key={weapon.entryId} className="min-w-0">
            <WeaponChoiceCard
              label={weapon.label}
              facts={describeWeapon(weapon.weapon)}
              note={weapon.active ? undefined : 'Switched off'}
              isDisabled={status.kind === 'saving' || maintenance.readOnly}
              describedBy={reasonId}
              onPick={() => onPick(weapon.entryId)}
            />
          </li>
        ))}
      </ul>
      <SaveFeedback
        status={status}
        savedText="Attack routine added."
        savingText="Adding attack routine…"
        shouldHideWhenIdle
      />
    </section>
  );
}

/**
 * Attacks (approved variant B, directly beneath Offense): the Character's
 * saved Attack Routines as compact cards, Add weapon and Add ammunition from
 * the catalog, Add natural attack, and Add attack routine for a weapon in
 * Gear, a natural attack or an unarmed strike. Edit opens the routine's
 * panel; Remove takes the card away once the removal is saved and offers
 * Undo, which brings the same routine back.
 */
export function AttackRoutines({
  attacks,
  warnings,
  warningController,
  itemParts,
  catalogEntries,
  spellEffects,
}: {
  attacks: Attacks;
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
  /** Every item's parts as the resolver states them, for Weapon details. */
  itemParts?: readonly ItemPartsView[];
  /** The definitions the Item Ability picker offers from. */
  catalogEntries?: readonly CatalogDefinition[];
  /** The sheet's Spell Effects, for the chips in Weapon details. */
  spellEffects?: readonly SpellEffectView[];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useId();
  const weaponPickerId = useId();
  const ammunitionPickerId = useId();
  const routinePickerId = useId();
  const naturalPickerId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const addRoutineButton = useRef<HTMLButtonElement>(null);
  const addNaturalButton = useRef<HTMLButtonElement>(null);
  const [picker, setPicker] = useState<Picker>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [restoredName, setRestoredName] = useState<string | null>(null);
  const removed = attacks.removed;
  // A removal shows as soon as it is saved, before the sheet catches up.
  const rows = attacks.rows.filter(
    (row) =>
      !(removed?.entryId === row.entryId && row.revision <= removed.revision),
  );
  const editingRow = editing
    ? rows.find((row) => row.entryId === editing.entryId)
    : undefined;
  // A routine removed elsewhere closes its editor; a new one opens on arrival.
  if (editing?.origin === 'row' && !editingRow) setEditing(null);
  const undoStatus = attacks.statusFor('undo');
  const describedBy = maintenance.readOnly ? reasonId : undefined;
  const canAddWeapon = attacks.weaponCatalog.length > 0;
  const canAddAmmunition = attacks.ammunitionCatalog.length > 0;

  function focusHeading() {
    const heading = wrapper.current?.querySelector<HTMLElement>('h2');
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus();
  }
  function restoreFocus(closed: Editing) {
    const edit = [
      ...(wrapper.current?.querySelectorAll<HTMLButtonElement>(
        '[data-routine-edit]',
      ) ?? []),
    ].find((button) => button.dataset.routineEdit === closed.entryId);
    const add = addRoutineButton.current;
    const target =
      closed.origin === 'create' && add && !add.disabled ? add : edit;
    if (target?.isConnected) target.focus();
    else focusHeading();
  }
  function togglePicker(next: Exclude<Picker, null>) {
    setPicker(picker === next ? null : next);
  }
  async function createRoutine(weaponEntryId: string) {
    const entryId = await attacks.create(weaponEntryId);
    if (!entryId) return;
    setPicker(null);
    setEditing({ entryId, origin: 'create' });
  }
  async function undo() {
    const name = removed?.name ?? null;
    if (!(await attacks.undo())) return;
    setRestoredName(name);
    focusHeading();
  }

  return (
    <div ref={wrapper}>
      <Block
        title="Attacks"
        aside={
          <span className="flex flex-wrap gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={toggle}
              aria-expanded={picker === 'weapon'}
              aria-controls={picker === 'weapon' ? weaponPickerId : undefined}
              disabled={!canAddWeapon}
              onClick={() => togglePicker('weapon')}
            >
              <Plus aria-hidden className="size-3" />
              Add weapon
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={toggle}
              aria-expanded={picker === 'ammunition'}
              aria-controls={
                picker === 'ammunition' ? ammunitionPickerId : undefined
              }
              disabled={!canAddAmmunition}
              onClick={() => togglePicker('ammunition')}
            >
              <Plus aria-hidden className="size-3" />
              Add ammunition
            </Button>
            <Button
              ref={addNaturalButton}
              type="button"
              variant="outline"
              size="sm"
              className={toggle}
              aria-expanded={picker === 'natural'}
              aria-controls={picker === 'natural' ? naturalPickerId : undefined}
              onClick={() => togglePicker('natural')}
            >
              <Plus aria-hidden className="size-3" />
              Add natural attack
            </Button>
            <Button
              ref={addRoutineButton}
              type="button"
              variant="outline"
              size="sm"
              className={toggle}
              aria-expanded={picker === 'routine'}
              aria-controls={picker === 'routine' ? routinePickerId : undefined}
              onClick={() => togglePicker('routine')}
            >
              <Plus aria-hidden className="size-3" />
              Add attack routine
            </Button>
          </span>
        }
      >
        <MaintenanceReasonScope id={reasonId}>
          <div className="space-y-2">
            <RemoteNotice
              isShown={attacks.hasRemoteChange}
              message="Changed by another player."
              subject="attack routines"
              onDismiss={attacks.dismissRemoteChange}
            />
            {picker === 'weapon' ? (
              <WeaponCatalogChoices id={weaponPickerId} attacks={attacks} />
            ) : null}
            {picker === 'ammunition' ? (
              <WeaponCatalogChoices
                id={ammunitionPickerId}
                attacks={attacks}
                kind="ammunition"
              />
            ) : null}
            {picker === 'natural' ? (
              <NaturalAttackEditor
                id={naturalPickerId}
                save={attacks.createNaturalAttack}
                onClose={() => {
                  setPicker(null);
                  addNaturalButton.current?.focus();
                }}
              />
            ) : null}
            {picker === 'routine' ? (
              <RoutineWeaponChoices
                id={routinePickerId}
                attacks={attacks}
                reasonId={describedBy}
                onPick={(weaponEntryId) => void createRoutine(weaponEntryId)}
              />
            ) : null}
            {rows.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Choose an attack to create a routine.
              </p>
            ) : (
              <ul className="space-y-2">
                {rows.map((row) => (
                  <li key={row.entryId} aria-label={row.name}>
                    <AttackRoutineRow
                      row={row}
                      attacks={attacks}
                      warnings={warnings}
                      warningController={warningController}
                      onEdit={() =>
                        setEditing({ entryId: row.entryId, origin: 'row' })
                      }
                      onRemoved={focusHeading}
                    />
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <p
                role="status"
                className={cn(
                  'text-muted-foreground min-w-0 flex-1 [overflow-wrap:anywhere]',
                  !removed && !restoredName && 'sr-only',
                )}
              >
                {removed
                  ? `Removed “${removed.name}”.`
                  : restoredName
                    ? `Restored “${restoredName}”.`
                    : null}
              </p>
              {removed || restoredName ? (
                <>
                  {removed ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={toggle}
                      aria-describedby={describedBy}
                      disabled={
                        undoStatus.kind === 'saving' || maintenance.readOnly
                      }
                      onClick={() => void undo()}
                    >
                      <Undo2 aria-hidden className="size-3" />
                      Undo
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={toggle}
                    onClick={() => {
                      attacks.dismissUndo();
                      setRestoredName(null);
                      focusHeading();
                    }}
                  >
                    <X aria-hidden className="size-3.5" />
                    Dismiss
                  </Button>
                  {removed ? (
                    <SaveFeedback
                      status={undoStatus}
                      savedText=""
                      savingText="Restoring…"
                      shouldHideWhenIdle
                    />
                  ) : null}
                </>
              ) : null}
            </div>
            <MaintenanceReason
              id={reasonId}
              notice={maintenance}
              className="text-xs"
            />
          </div>
        </MaintenanceReasonScope>
      </Block>
      {editing && editingRow ? (
        <AttackRoutineEditor
          key={editingRow.entryId}
          row={editingRow}
          attacks={attacks}
          onClose={() => setEditing(null)}
          restoreFocus={() => restoreFocus(editing)}
          warnings={warnings}
          warningController={warningController}
          itemParts={itemParts}
          catalogEntries={catalogEntries}
          spellEffects={spellEffects}
        />
      ) : null}
    </div>
  );
}
