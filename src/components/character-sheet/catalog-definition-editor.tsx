'use client';
import type { FieldValues, UseFormReturn } from 'react-hook-form';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Form } from '~/components/ui/form';
import { personalBonusTypes } from '~/lib/character-sheet';
import { CatalogDefinitionFormFields } from './catalog-definition-form-fields';
import { definitionScopeDescriptions } from './catalog-labels';
import type { CatalogDefinition, SheetCatalog } from './sheet-catalog-context';
import type { PersonalAdjustmentSaveOutcome } from './use-personal-adjustment-form';
import { useCatalogDefinitionForm } from './use-catalog-definition-form';

/** The name and Modifier form only edits what it can show faithfully. */
export function hasEditableModifiers(definition: CatalogDefinition) {
  return definition.modifiers.every((modifier) =>
    personalBonusTypes.some((type) => type === modifier.bonusType),
  );
}

// The form state a render holds is a snapshot; the subscription hears what
// the save leaves behind, so the editor closes only with nothing newer typed.
export async function saveAndReportWhenClean<
  Values extends FieldValues,
>(editor: {
  form: UseFormReturn<Values>;
  save: () => Promise<PersonalAdjustmentSaveOutcome>;
}) {
  let hasNewerInput = editor.form.formState.isDirty;
  const unsubscribe = editor.form.subscribe({
    formState: { isDirty: true },
    callback: (state) => {
      if (state.isDirty !== undefined) hasNewerInput = state.isDirty;
    },
  });
  const outcome = await editor.save();
  unsubscribe();
  return { outcome, hasNewerInput };
}

/**
 * An editable campaign or Character definition's name and Modifiers, in
 * place. A campaign edit reaches every sheet using it; the row's choices and
 * notes stay as they are. Closes only after a clean save; a refusal keeps
 * the draft for another try.
 */
export function CatalogDefinitionEditor({
  definition,
  catalog,
  shouldFocusName = false,
  onClose,
}: {
  definition: CatalogDefinition;
  catalog: SheetCatalog;
  /** Opened by Customize for campaign, whose button is now gone. */
  shouldFocusName?: boolean;
  onClose: () => void;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const editor = useCatalogDefinitionForm({
    definition,
    save: (input) => catalog.editForForm(definition._id, input),
  });
  const isDisabled = !catalog.available || maintenance.readOnly;
  return (
    <Form {...editor.form}>
      <form
        noValidate
        aria-label={`Edit definition ${definition.name}`}
        className="border-foreground/20 space-y-2 border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (isDisabled) return;
          void saveAndReportWhenClean(editor).then(
            ({ outcome, hasNewerInput }) => {
              if (outcome === 'saved' && !hasNewerInput) onClose();
            },
          );
        }}
      >
        <p className="text-muted-foreground text-xs">
          {definitionScopeDescriptions[definition.scope]}
        </p>
        <CatalogDefinitionFormFields
          editor={editor}
          isDisabled={isDisabled}
          submitLabel="Save definition"
          remoteNotice={{
            message:
              'Another player changed this definition. Your edits are kept.',
            subject: `${definition.name} definition`,
          }}
          shouldFocusName={shouldFocusName}
          onClose={onClose}
        />
      </form>
    </Form>
  );
}
