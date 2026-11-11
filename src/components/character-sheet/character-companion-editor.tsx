'use client';
import { useId } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { Form } from '~/components/ui/form';
import { CompanionEditorFields } from './companion-editor-fields';
import type { CompanionsController } from './companion-props';
import { action } from './sheet-parts';

type EditorKind = NonNullable<CompanionsController['editor']>['kind'];

const headings: Record<EditorKind, string> = {
  create: 'Create Companion',
  link: 'Link existing Character',
  replace: 'Replace Companion',
  source: 'Add supporting source',
};
const submitLabels: Record<EditorKind, string> = {
  create: 'Create Companion',
  link: 'Link Character',
  replace: 'Replace Companion',
  source: 'Add supporting source',
};

/**
 * The hook's one local form, in place beneath what opened it: a new
 * Companion, an existing Character to link, a replacement sheet, or another
 * Supporting Source. Escape and Cancel close it without writing; a refused
 * save keeps every draft value and its reason beside the form.
 */
export function CharacterCompanionEditor({
  controller,
}: {
  controller: CompanionsController;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const headingId = useId();
  const { editor, editorKey } = controller;
  if (!editor || !editorKey) return null;
  const isSaving = controller.statusFor(editorKey).kind === 'saving';
  const isDisabled = controller.isDisabled || isSaving;
  const heading = headings[editor.kind];
  return (
    <Form {...controller.form}>
      <form
        noValidate
        aria-labelledby={headingId}
        className="border-foreground/20 mt-2 w-full space-y-3 border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (isDisabled) return;
          void controller.submit();
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          controller.closeEditor();
        }}
      >
        <h3 id={headingId} className="font-sans text-base">
          {heading}
        </h3>
        <CompanionEditorFields
          kind={editor.kind}
          controller={controller}
          isDisabled={isDisabled}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            type="submit"
            size="sm"
            className={action}
            aria-describedby={reasonId}
            disabled={isDisabled}
          >
            {submitLabels[editor.kind]}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={action}
            onClick={controller.closeEditor}
          >
            Cancel <span className="sr-only">{heading}</span>
          </Button>
        </div>
      </form>
    </Form>
  );
}
