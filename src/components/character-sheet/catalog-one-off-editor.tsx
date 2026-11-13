'use client';
import { useState } from 'react';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Form } from '~/components/ui/form';
import { saveAndReportWhenClean } from './catalog-definition-editor';
import { CatalogDefinitionFormFields } from './catalog-definition-form-fields';
import {
  CatalogOneOffKindCards,
  type OneOffKind,
} from './catalog-one-off-kind-cards';
import type { SheetCatalog } from './sheet-catalog-context';
import type { PersonalAdjustmentInput } from './use-character-sheet';
import type { OneOffCatalogInput } from './use-character-sheet-catalog';
import { usePersonalAdjustmentForm } from './use-personal-adjustment-form';

// Each kind carries the detail fields its definition requires; a new one-off
// starts with no linked races, traits, classes or replacements.
function buildOneOff(
  kind: OneOffKind,
  input: PersonalAdjustmentInput,
): OneOffCatalogInput {
  const definition = { ...input, stacksWithItself: false, sources: [] };
  if (kind === 'manual')
    return { definition: { ...definition, detail: { kind } } };
  if (kind === 'race')
    return {
      definition: { ...definition, detail: { kind, racialTraits: [] } },
    };
  if (kind === 'racialTrait')
    return {
      definition: {
        ...definition,
        detail: { kind, raceEntryIds: [], replaces: [] },
      },
    };
  if (kind === 'archetype')
    return {
      definition: {
        ...definition,
        detail: { kind, classEntryIds: [], replaces: [], adds: [] },
      },
    };
  return { definition: { ...definition, detail: { kind } } };
}

/**
 * A Character-specific definition and its sheet entry, created together in
 * place: kind, name and Modifiers. Closes after a clean save; the new row
 * then takes focus. A refusal keeps the draft for another try.
 */
export function CatalogOneOffEditor({
  catalog,
  onClose,
}: {
  catalog: SheetCatalog;
  onClose: () => void;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const [kind, setKind] = useState<OneOffKind>('feat');
  const editor = usePersonalAdjustmentForm({
    save: (input) => catalog.createForForm(buildOneOff(kind, input)),
  });
  const isDisabled = !catalog.available || maintenance.readOnly;
  return (
    <Form {...editor.form}>
      <form
        noValidate
        aria-label="New one-off"
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
          Only this character uses this definition.
        </p>
        <CatalogOneOffKindCards
          kind={kind}
          isDisabled={isDisabled}
          onChange={setKind}
        />
        <CatalogDefinitionFormFields
          editor={editor}
          isDisabled={isDisabled}
          submitLabel="Save one-off"
          onClose={onClose}
        />
      </form>
    </Form>
  );
}
