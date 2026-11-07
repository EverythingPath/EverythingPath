'use client';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { Form } from '~/components/ui/form';
import { AdjustmentNameField, ModifierListFields } from './adjustment-fields';
import { ConditionPicker, FixedConditionFacts } from './condition-fields';
import {
  SheetEntryKindCards,
  SheetEntryKindFields,
  type SheetEntryKind,
} from './sheet-entry-classification-fields';
import { action, RemoteNotice, SaveFeedback } from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';
import type { SheetEntryInput } from './use-character-sheet-entries';
import { useSheetEntryForm } from './use-sheet-entry-form';

type Controller = ReturnType<typeof useCharacterSheet>;
type Editor = ReturnType<typeof useSheetEntryForm>;

// A recorded Spell grants no Modifiers, and armor's bonus is its own: the
// rows left blank are dropped before saving, while any retained definition
// data (an imported Spell's Modifiers) travels along untouched.
function dropBlankModifiers(editor: Editor) {
  const modifiers = editor.adjustmentForm.getValues('modifiers');
  modifiers
    .map((modifier, index) => ({ index, isBlank: !modifier.value.trim() }))
    .filter((row) => row.isBlank)
    .reverse()
    .forEach((row) => editor.removeModifier(row.index));
}

// A chosen CRB condition's name and Modifiers are the rules' own, shown as
// facts; a custom condition (and every other kind) types them in.
function EntryDefinitionFields({
  editor,
  kind,
  isDisabled,
  warnings,
  warningController,
}: {
  editor: Editor;
  kind: SheetEntryKind;
  isDisabled: boolean;
  warnings: SheetWarningView[];
  warningController?: Controller['warnings'];
}) {
  if (editor.selectedCondition)
    return (
      <FixedConditionFacts
        condition={editor.selectedCondition}
        isDisabled={isDisabled}
        onCustomize={editor.detachCondition}
      />
    );
  return (
    <Form {...editor.adjustmentForm}>
      <AdjustmentNameField
        control={editor.adjustmentForm.control}
        isDisabled={isDisabled}
      />
      {kind === 'spell' ? (
        <p className="text-muted-foreground text-xs">
          A recorded Spell grants no Modifiers.
        </p>
      ) : (
        <ModifierListFields
          editor={{
            form: editor.adjustmentForm,
            fields: editor.fields,
            addModifier: editor.addModifier,
            removeModifier: editor.removeModifier,
          }}
          isDisabled={isDisabled}
          warnings={warnings}
          warningController={warningController}
        />
      )}
    </Form>
  );
}

/**
 * One Character Sheet Entry, edited in place: its kind with what that kind
 * needs, its name and the Modifiers it grants. A Condition is chosen from
 * the Core Rulebook's by name, or is the player's own. A new entry chooses
 * its kind; an existing one keeps it. Saving, saved and failures read here;
 * a new editor closes after a clean save.
 */
export function SheetEntryEditor({
  value,
  save,
  onClose,
  isNew,
  isRemoved = false,
  warnings = [],
  warningController,
}: {
  value?: SheetEntryInput;
  save: (input: SheetEntryInput) => Promise<unknown>;
  onClose: () => void;
  isNew: boolean;
  /** Another player removed the entry this draft belongs to. */
  isRemoved?: boolean;
  /** The saved entry's Modifier warnings, shown under their Modifiers. */
  warnings?: SheetWarningView[];
  warningController?: Controller['warnings'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const editor = useSheetEntryForm({ value, save });
  const isDisabled = maintenance.readOnly;
  const isDirty =
    editor.form.formState.isDirty || editor.adjustmentForm.formState.isDirty;
  const isSaving = editor.status.kind === 'saving';
  const isSaved = editor.status.kind === 'saved';
  const kind = editor.form.watch('kind');
  const defaultCasterLevel = editor.form.watch('defaultCasterLevel');
  const isArmor = kind === 'item' && editor.form.watch('isArmor');

  async function saveAndCloseWhenClean() {
    if (kind === 'spell' || isArmor) dropBlankModifiers(editor);
    let hasNewerInput = isDirty;
    const unsubscribe = editor.adjustmentForm.subscribe({
      formState: { isDirty: true },
      callback: (state) => {
        if (state.isDirty !== undefined) hasNewerInput = state.isDirty;
      },
    });
    const outcome = await editor.save();
    unsubscribe();
    if (isNew && outcome === 'saved' && !hasNewerInput) onClose();
  }

  if (isRemoved && !isDirty)
    return (
      <div
        role="status"
        className="border-foreground/20 flex flex-wrap items-center gap-x-3 gap-y-1 border p-3 text-sm"
      >
        <span>This entry is no longer on the sheet.</span>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Close <span className="sr-only">editor</span>
        </Button>
      </div>
    );

  return (
    <form
      noValidate
      aria-label={isNew ? 'New entry' : 'Edit entry'}
      className="border-foreground/20 space-y-3 border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (isDisabled) return;
        void saveAndCloseWhenClean();
      }}
    >
      <Form {...editor.form}>
        <SheetEntryKindCards
          control={editor.form.control}
          isDisabled={isDisabled}
          isFixed={!isNew}
        />
        <SheetEntryKindFields
          control={editor.form.control}
          isDisabled={isDisabled}
          kind={kind}
          defaultCasterLevel={defaultCasterLevel}
        />
      </Form>
      {kind === 'condition' ? (
        <ConditionPicker
          options={editor.conditionOptions}
          value={editor.form.watch('conditionSelection')}
          isDisabled={isDisabled}
          onSelect={editor.selectCondition}
          onCustom={editor.detachCondition}
        />
      ) : null}
      <EntryDefinitionFields
        editor={editor}
        kind={kind}
        isDisabled={isDisabled}
        warnings={warnings}
        warningController={warningController}
      />
      {isRemoved ? (
        <p role="status" className="text-xs text-sky-300">
          This entry is no longer on the sheet. Save adds it as a new entry.
        </p>
      ) : (
        <RemoteNotice
          isShown={editor.hasRemoteChange}
          message={
            isDirty
              ? 'This entry changed while you were editing. Your edits are kept.'
              : 'Updated by another player.'
          }
          subject="entry"
          onDismiss={editor.dismissRemoteChange}
        />
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button
          type="submit"
          size="sm"
          className={action}
          disabled={isSaving || isDisabled}
        >
          {isSaving ? 'Saving…' : 'Save entry'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={action}
          onClick={onClose}
        >
          Close <span className="sr-only">editor</span>
        </Button>
        <SaveFeedback status={editor.status} savedText="Saved." />
        {isSaved && isDirty ? (
          <p className="text-xs text-amber-300">Unsaved edits.</p>
        ) : null}
        <MaintenanceReason notice={maintenance} />
      </div>
    </form>
  );
}
