'use client';
import { Plus } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';
import { AttackFieldFeedback } from './attack-field-feedback';
import { AttackRoutineWarnings } from './attack-routine-warnings';
import { NaturalAttackChoices } from './natural-attack-choices';
import { NaturalAttackEditor } from './natural-attack-editor';
import { action, fieldLabel } from './sheet-parts';
import type { useAttackRoutineForm } from './use-attack-routine-form';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type Attacks = Controller['attacks'];
type Row = Attacks['rows'][number];
type Editor = ReturnType<typeof useAttackRoutineForm>;

const hint = 'text-muted-foreground text-xs';
/**
 * The natural attacks a routine adds after its weapon's attacks
 * (approved prototype's routine editor, extended by #323): recorded natural
 * attacks as checkbox cards, each choice saved at once with the whole list,
 * then the Character's available limbs. A chosen attack that has left the
 * sheet stays chosen, unnamed, with its warning and Remove. Limb conflicts
 * and natural attacks a flurry of blows leaves out (#414) are the
 * resolver's advisories with Accept; nothing here is ever disabled for the
 * rules. Add natural attack opens the definition editor in place.
 */
export function AttackRoutineNaturalField({
  row,
  attacks,
  editor,
  isReadOnly,
  describedBy,
  warnings,
  warningController,
}: {
  row: Row;
  attacks: Attacks;
  editor: Editor;
  isReadOnly: boolean;
  describedBy?: string;
  warnings?: SheetWarningView[];
  warningController?: Controller['warnings'];
}) {
  const groupLabelId = useId();
  const limbWarningId = useId();
  const addFormId = useId();
  const addButton = useRef<HTMLButtonElement>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const editButton = useRef<HTMLButtonElement | null>(null);
  const editing = attacks.naturalAttacks.find(
    (choice) => choice.entryId === editingEntryId && choice.canEdit,
  );
  const choices = attacks.naturalAttacks;
  const limbWarnings = row.warnings.filter(
    (warning) => warning.check === 'attackLimbs',
  );
  const naturalWarnings = row.warnings.filter(
    (warning) =>
      warning.check === 'attackLimbs' ||
      warning.check === 'flurryNaturalAttacks',
  );

  function closeAdd() {
    setIsAdding(false);
    setEditingEntryId(null);
    (editingEntryId ? editButton.current : addButton.current)?.focus();
  }

  return (
    <div className="border-foreground/15 space-y-2 border-t pt-3">
      <FormField
        control={editor.form.control}
        name="naturalAttackEntryIds"
        render={({ field, fieldState }) => {
          const chosen = field.value ?? [];
          function choose(next: string[]) {
            if (isReadOnly) return;
            void editor.change('naturalAttackEntryIds', next);
          }
          return (
            <FormItem className="gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id={groupLabelId} className={fieldLabel}>
                  Natural attacks
                </h3>
                <Button
                  ref={addButton}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    action,
                    'h-auto gap-1 rounded-none px-2 text-xs',
                  )}
                  aria-expanded={isAdding}
                  aria-controls={isAdding ? addFormId : undefined}
                  onClick={() => {
                    setEditingEntryId(null);
                    setIsAdding(!isAdding);
                  }}
                >
                  <Plus aria-hidden className="size-3" />
                  Add natural attack
                </Button>
              </div>
              <NaturalAttackChoices
                row={row}
                choices={choices}
                chosen={chosen}
                field={field}
                isReadOnly={isReadOnly}
                describedBy={describedBy}
                groupLabelId={groupLabelId}
                choose={choose}
                onEdit={(entryId, button) => {
                  editButton.current = button;
                  setIsAdding(false);
                  setEditingEntryId(entryId);
                }}
              />
              <FormMessage
                role={fieldState.error ? 'alert' : undefined}
                className={fieldState.error ? undefined : 'hidden'}
              />
              <AttackFieldFeedback
                status={editor.statusFor('naturalAttackEntryIds')}
                label="natural attacks"
                isDisabled={isReadOnly}
                onRetry={() => void editor.retry('naturalAttackEntryIds')}
              />
            </FormItem>
          );
        }}
      />
      {isAdding || editing ? (
        <NaturalAttackEditor
          key={editing?.entryId ?? 'new'}
          id={addFormId}
          value={editing?.value}
          save={
            editing
              ? (input) => attacks.editNaturalAttack(editing.entryId, input)
              : attacks.createNaturalAttack
          }
          onClose={closeAdd}
        />
      ) : null}
      {limbWarnings.length > 0 ? (
        <span id={limbWarningId} hidden>
          {limbWarnings.map((warning) => warning.message).join(' ')}
        </span>
      ) : null}
      <AttackRoutineWarnings
        warnings={naturalWarnings}
        sheetWarnings={warnings}
        controller={warningController}
      />
      <FormField
        control={editor.form.control}
        name="availableLimbs"
        render={({ field, fieldState }) => (
          <FormItem className="w-44 gap-1">
            <FormLabel className={fieldLabel}>Available limbs</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ''}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                disabled={isReadOnly}
                aria-describedby={cn(
                  `${limbWarningId}-hint`,
                  limbWarnings.length > 0 && limbWarningId,
                  fieldState.error && `${limbWarningId}-error`,
                  describedBy,
                )}
                className="h-11 w-20 text-center font-mono md:h-8"
                onChange={(event) => {
                  if (isReadOnly) return;
                  void editor.change('availableLimbs', event.target.value);
                }}
              />
            </FormControl>
            <FormDescription id={`${limbWarningId}-hint`} className={hint}>
              Limbs before holding weapons.
            </FormDescription>
            <FormMessage
              id={`${limbWarningId}-error`}
              role={fieldState.error ? 'alert' : undefined}
              className={fieldState.error ? undefined : 'hidden'}
            />
            <AttackFieldFeedback
              status={editor.statusFor('availableLimbs')}
              label="available limbs"
              isDisabled={isReadOnly}
              onRetry={() => void editor.retry('availableLimbs')}
            />
          </FormItem>
        )}
      />
    </div>
  );
}
