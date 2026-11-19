'use client';
import { useId } from 'react';
import type { PathValue } from 'react-hook-form';
import {
  MaintenanceReason,
  MaintenanceReasonScope,
} from '~/components/campaign-shell/maintenance-reason';
import { useBreakpoint } from '~/components/use-breakpoint';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { cn } from '~/lib/utils';
import { weaponCard } from './attack-routine-card-style';
import {
  describeWeapon,
  handsLabels,
  modeLabels,
} from './attack-routine-view-model';
import { AttackFieldFeedback } from './attack-field-feedback';
import { AttackAmmunitionEditor } from './attack-ammunition-editor';
import { AttackRoutineAmmunitionField } from './attack-routine-ammunition-field';
import { AttackRoutineNaturalField } from './attack-routine-natural-field';
import { AttackRoutineOptionsField } from './attack-routine-options-field';
import { AttackRoutineOffHandField } from './attack-routine-off-hand-field';
import { AttackRoutinePreview } from './attack-routine-preview';
import { AttackRoutineRangeFields } from './attack-routine-range-fields';
import { AttackRoutineWarnings } from './attack-routine-warnings';
import {
  AttackWeaponEndEditor,
  type WeaponEnd,
} from './attack-weapon-end-editor';
import type { ItemPartsView } from './item-ability-options';
import type { SpellEffectView } from './spell-effect-target-chips';
import type { CatalogDefinition } from './sheet-catalog-context';
import {
  action,
  chip,
  fieldLabel,
  RemoteNotice,
  SaveFeedback,
} from './sheet-parts';
import {
  attackRoutineHandsSchema,
  attackRoutineModeSchema,
  useAttackRoutineForm,
  type AttackRoutineDraft,
} from './use-attack-routine-form';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type Attacks = Controller['attacks'];
type Row = Attacks['rows'][number];
type Field = keyof AttackRoutineDraft;

const hint = 'text-muted-foreground text-xs';

/**
 * One Attack Routine's editor (approved prototype's routine editor): a
 * panel on the right from 768px, a bottom sheet below. Every change saves
 * at once, field by field, with its acknowledgement beside it; there is no
 * Save step and closing discards nothing. Below the main weapon come, for a
 * routine with a ranged or thrown hand, its range increments and, for a
 * launcher in either hand, its ammunition; then the off hand, the natural
 * attacks and available limbs, and the details of each Gear weapon end in
 * use (never the built-in unarmed strike, which has none). Keyed by the
 * routine's identity.
 */
export function AttackRoutineEditor({
  row,
  attacks,
  onClose,
  restoreFocus,
  warnings,
  warningController,
  itemParts,
  catalogEntries,
  spellEffects,
}: {
  row: Row;
  attacks: Attacks;
  onClose: () => void;
  /** Where focus goes once the panel has closed. */
  restoreFocus?: () => void;
  /** The sheet's warnings and Accept, for advisories beside their fields. */
  warnings?: SheetWarningView[];
  warningController?: Controller['warnings'];
  /** Every item's parts as the resolver states them, for Weapon details. */
  itemParts?: readonly ItemPartsView[];
  /** The definitions the Item Ability picker offers from. */
  catalogEntries?: readonly CatalogDefinition[];
  /** The sheet's Spell Effects, for the chips on the parts they target. */
  spellEffects?: readonly SpellEffectView[];
}) {
  const isWide = useBreakpoint('wide');
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useId();
  const weaponLabelId = useId();
  const handsLabelId = useId();
  const modeLabelId = useId();
  const detailsLabelId = useId();
  const editor = useAttackRoutineForm({
    value: {
      name: row.name,
      weaponEntryId: row.weaponEntryId,
      hands: row.hands,
      mode: row.mode,
      ammunitionEntryId: row.ammunitionEntryId,
      rangeIncrements: row.rangeIncrements,
      offHand: row.offHand ?? null,
      naturalAttackEntryIds: row.naturalAttackEntryIds ?? [],
      availableLimbs: String(row.availableLimbs ?? 2),
      options: row.optionIds,
    },
    save: (patch) => attacks.edit(row.entryId, patch),
    operationId: attacks.operationId,
  });
  const { form } = editor;
  const values = form.watch();
  const isDirty = form.formState.isDirty;
  const isReadOnly = maintenance.readOnly;
  const describedBy = isReadOnly ? reasonId : undefined;
  const removal = attacks.statusFor(row.entryId);
  const weapon = attacks.weapons.find(
    (candidate) => candidate.entryId === values.weaponEntryId,
  );
  const weaponWarning = row.warnings.find(
    (warning) =>
      warning.subject === row.entryId &&
      [
        'missingAttackWeapon',
        'inactiveAttackWeapon',
        'invalidAttackWeapon',
        'unavailableAttackWeapon',
      ].includes(warning.check),
  );
  // CRB p. 57: a flurry's weapon advisory belongs beside the weapon choices.
  const flurryWeaponWarnings = row.warnings.filter(
    (warning) => warning.check === 'flurryWeapon',
  );
  const offHand = values.offHand ?? null;
  const offHandWeapon =
    offHand?.kind === 'weapon'
      ? attacks.weapons.find(
          (candidate) => candidate.entryId === offHand.weaponEntryId,
        )
      : undefined;
  // Each Gear weapon's ends once: the main weapon's, then a separate off
  // hand's. The built-in unarmed strike has no Gear state to edit.
  const primary: WeaponEnd = 'primary';
  const otherEnd: WeaponEnd = 'otherEnd';
  const ends = [
    ...(weapon && !weapon.isBuiltIn
      ? [
          { weapon, end: primary },
          ...(weapon.weapon.otherEnd ? [{ weapon, end: otherEnd }] : []),
        ]
      : []),
    ...(offHandWeapon &&
    !offHandWeapon.isBuiltIn &&
    offHandWeapon.entryId !== weapon?.entryId
      ? [{ weapon: offHandWeapon, end: primary }]
      : []),
  ];
  const isLightInTwoHands =
    weapon?.weapon.handedness === 'light' && values.hands === 'two';
  const isRanged =
    values.mode !== 'melee' || (offHand !== null && offHand.mode !== 'melee');
  // Bows, crossbows and slings fire ammunition; a thrown weapon is its own.
  // Either hand's launcher fires the routine's one ammunition choice.
  const offHandGear = offHand?.kind === 'weapon' ? offHandWeapon : weapon;
  const isMainLauncher = values.mode === 'ranged' && !weapon?.weapon.thrown;
  const usesAmmunition =
    isMainLauncher ||
    (offHand?.mode === 'ranged' && !offHandGear?.weapon.thrown);
  // The ammunition the routine fires has details of its own.
  const ammunition = usesAmmunition
    ? attacks.ammunition.find(
        (choice) => choice.entryId === values.ammunitionEntryId,
      )
    : undefined;

  function change<Name extends Field>(
    field: Name,
    next: PathValue<AttackRoutineDraft, Name>,
  ) {
    if (isReadOnly) return;
    void editor.change(field, next);
  }
  function feedback(field: Field, label: string) {
    return (
      <AttackFieldFeedback
        status={editor.statusFor(field)}
        label={label}
        isDisabled={isReadOnly}
        onRetry={() => void editor.retry(field)}
      />
    );
  }
  async function remove() {
    if (await attacks.remove(row.entryId)) onClose();
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side={isWide ? 'right' : 'bottom'}
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          if (!restoreFocus) return;
          event.preventDefault();
          restoreFocus();
        }}
        className={cn(
          'gap-0',
          isWide
            ? 'w-full sm:max-w-md'
            : 'max-h-[85vh] pb-[env(safe-area-inset-bottom)]',
        )}
      >
        <SheetHeader className="pr-12">
          <SheetTitle className="font-sans text-xl font-normal">
            Attack routine
          </SheetTitle>
        </SheetHeader>
        <MaintenanceReasonScope id={reasonId}>
          <Form {...form}>
            <form
              noValidate
              aria-label={`Edit ${row.name}`}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4"
              onSubmit={(event) => event.preventDefault()}
            >
              <RemoteNotice
                isShown={editor.hasRemoteChange}
                message={
                  isDirty
                    ? 'Changed by another player. Your edits are kept.'
                    : 'Changed by another player.'
                }
                subject={row.name}
                onDismiss={editor.dismissRemoteChange}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field, fieldState }) => (
                  <FormItem className="gap-1">
                    <FormLabel className={fieldLabel}>Routine name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="text"
                        autoComplete="off"
                        disabled={isReadOnly}
                        className="h-11 font-sans md:h-9"
                        onChange={(event) => change('name', event.target.value)}
                      />
                    </FormControl>
                    <FormMessage
                      role={fieldState.error ? 'alert' : undefined}
                      className={fieldState.error ? undefined : 'hidden'}
                    />
                    {feedback('name', 'routine name')}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="weaponEntryId"
                render={({ field, fieldState }) => (
                  <FormItem className="gap-1">
                    <span id={weaponLabelId} className={fieldLabel}>
                      Main weapon
                    </span>
                    {weapon ? null : (
                      <p className="text-xs text-amber-300">
                        {weaponWarning?.message}
                      </p>
                    )}
                    <AttackRoutineWarnings
                      warnings={flurryWeaponWarnings}
                      sheetWarnings={warnings}
                      controller={warningController}
                    />
                    <FormControl>
                      <RadioGroup
                        aria-labelledby={weaponLabelId}
                        name={field.name}
                        value={field.value}
                        disabled={isReadOnly}
                        onBlur={field.onBlur}
                        onValueChange={(next) => change('weaponEntryId', next)}
                        className="grid-cols-1 gap-1 sm:grid-cols-2"
                      >
                        {attacks.weapons.map((choice) => (
                          <RadioGroupItem
                            key={choice.entryId}
                            value={choice.entryId}
                            aria-label={
                              choice.active
                                ? choice.label
                                : `${choice.label}, switched off`
                            }
                            aria-describedby={cn(
                              `${weaponLabelId}-${choice.entryId}`,
                              describedBy,
                            )}
                            className={weaponCard}
                          >
                            <span className="flex w-full flex-wrap items-baseline gap-x-2">
                              <span className="min-w-0 font-sans text-base [overflow-wrap:anywhere]">
                                {choice.label}
                              </span>
                              {choice.active ? null : (
                                <span
                                  className={cn(chip, 'text-muted-foreground')}
                                >
                                  Switched off
                                </span>
                              )}
                            </span>
                            <span
                              id={`${weaponLabelId}-${choice.entryId}`}
                              className="text-muted-foreground text-xs [overflow-wrap:anywhere]"
                            >
                              {describeWeapon(choice.weapon)}
                            </span>
                          </RadioGroupItem>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage
                      role={fieldState.error ? 'alert' : undefined}
                      className={fieldState.error ? undefined : 'hidden'}
                    />
                    {feedback('weaponEntryId', 'main weapon')}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hands"
                render={({ field }) => (
                  <FormItem className="gap-1">
                    <span id={handsLabelId} className={fieldLabel}>
                      Held in
                    </span>
                    <FormControl>
                      <RadioGroup
                        aria-labelledby={handsLabelId}
                        name={field.name}
                        value={field.value}
                        disabled={isReadOnly}
                        onBlur={field.onBlur}
                        onValueChange={(next) =>
                          change('hands', attackRoutineHandsSchema.parse(next))
                        }
                        className="grid-cols-2 gap-1"
                      >
                        {(['one', 'two'] as const).map((hands) => (
                          <RadioGroupItem
                            key={hands}
                            value={hands}
                            aria-describedby={describedBy}
                          >
                            {handsLabels[hands]}
                          </RadioGroupItem>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    {isLightInTwoHands ? (
                      <p className={hint}>
                        A light weapon in two hands still adds Strength once.
                      </p>
                    ) : null}
                    {feedback('hands', 'held in')}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <FormItem className="gap-1">
                    <span id={modeLabelId} className={fieldLabel}>
                      Attack mode
                    </span>
                    <FormControl>
                      <RadioGroup
                        aria-labelledby={modeLabelId}
                        name={field.name}
                        value={field.value}
                        disabled={isReadOnly}
                        onBlur={field.onBlur}
                        onValueChange={(next) =>
                          change('mode', attackRoutineModeSchema.parse(next))
                        }
                        className="grid-cols-3 gap-1"
                      >
                        {(['melee', 'ranged', 'thrown'] as const).map(
                          (mode) => (
                            <RadioGroupItem
                              key={mode}
                              value={mode}
                              aria-describedby={describedBy}
                            >
                              {modeLabels[mode]}
                            </RadioGroupItem>
                          ),
                        )}
                      </RadioGroup>
                    </FormControl>
                    {feedback('mode', 'attack mode')}
                  </FormItem>
                )}
              />
              {isRanged ? (
                <AttackRoutineRangeFields
                  row={row}
                  editor={editor}
                  isReadOnly={isReadOnly}
                  describedBy={describedBy}
                />
              ) : null}
              {usesAmmunition ? (
                <AttackRoutineAmmunitionField
                  row={row}
                  attacks={attacks}
                  editor={editor}
                  launcherLabel={
                    (isMainLauncher ? weapon : offHandGear)?.label ?? null
                  }
                  ammunitionEntryId={values.ammunitionEntryId ?? null}
                  isReadOnly={isReadOnly}
                  describedBy={describedBy}
                />
              ) : null}
              <AttackRoutineOffHandField
                row={row}
                attacks={attacks}
                editor={editor}
                mainWeaponEntryId={values.weaponEntryId}
                offHand={offHand}
                isReadOnly={isReadOnly}
                describedBy={describedBy}
              />
              <AttackRoutineNaturalField
                row={row}
                attacks={attacks}
                editor={editor}
                isReadOnly={isReadOnly}
                describedBy={describedBy}
                warnings={warnings}
                warningController={warningController}
              />
              <AttackRoutineOptionsField
                row={row}
                editor={editor}
                isReadOnly={isReadOnly}
                describedBy={describedBy}
                warnings={warnings}
                warningController={warningController}
              />
              {ends.length > 0 || ammunition ? (
                <section
                  aria-labelledby={detailsLabelId}
                  className="border-foreground/15 space-y-3 border-t pt-3"
                >
                  <div>
                    <h3 id={detailsLabelId} className={fieldLabel}>
                      Weapon details
                    </h3>
                    <p className={hint}>
                      {ammunition
                        ? 'Shared by every routine that uses the weapon or ammunition.'
                        : 'Shared by every routine that uses the weapon.'}
                    </p>
                  </div>
                  {ends.map(({ weapon: gear, end }) => (
                    <AttackWeaponEndEditor
                      key={`${gear.entryId}:${end}`}
                      weapon={gear}
                      end={end}
                      attacks={attacks}
                      isReadOnly={isReadOnly}
                      describedBy={describedBy}
                      itemParts={itemParts}
                      catalogEntries={catalogEntries}
                      spellEffects={spellEffects}
                      warnings={warnings}
                      warningController={warningController}
                    />
                  ))}
                  {ammunition ? (
                    <AttackAmmunitionEditor
                      key={ammunition.entryId}
                      ammunition={ammunition}
                      attacks={attacks}
                      isReadOnly={isReadOnly}
                      describedBy={describedBy}
                      itemParts={itemParts}
                      catalogEntries={catalogEntries}
                      spellEffects={spellEffects}
                      warnings={warnings}
                      warningController={warningController}
                    />
                  ) : null}
                </section>
              ) : null}
              <AttackRoutinePreview row={row} />
              <MaintenanceReason
                id={reasonId}
                notice={maintenance}
                className="text-xs"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    action,
                    'hover:text-destructive hover:border-destructive rounded-none',
                  )}
                  aria-describedby={describedBy}
                  disabled={removal.kind === 'saving' || isReadOnly}
                  onClick={() => void remove()}
                >
                  Remove routine
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(action, 'rounded-none font-sans')}
                  onClick={onClose}
                >
                  Done
                </Button>
              </div>
              <SaveFeedback
                status={removal}
                savedText=""
                savingText="Removing…"
                shouldHideWhenIdle
              />
            </form>
          </Form>
        </MaintenanceReasonScope>
      </SheetContent>
    </Sheet>
  );
}
