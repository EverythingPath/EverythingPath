'use client';
import {
  alignments,
  alignmentNames,
} from '~/lib/character-sheet-prerequisite-schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { ChoiceSelect } from './choice-select';
import { InlineWarnings } from './inline-warning';
import { action, fieldLabel, SaveFeedback } from './sheet-parts';
import type {
  SelectionControls,
  SelectionsView,
  WarningController,
} from './selection-view-types';
import type { SheetWarningView } from './use-character-sheet';

const alignmentOptions = alignments.map((alignment) => ({
  value: alignment,
  label: `${alignmentNames[alignment]} (${alignment})`,
}));

const deitySchema = z.object({ deity: z.string() });
type DeityValues = z.infer<typeof deitySchema>;

/**
 * The Character's alignment and deity, the facts prerequisites and classes
 * read: alignment from the nine, saved as it is chosen, and the deity as
 * free text with its own Save. Either can be cleared. A class that
 * normally needs another alignment says so here.
 */
export function PrerequisiteFacts({
  facts,
  controls,
  warnings,
  warningController,
}: {
  facts: SelectionsView['facts'];
  controls: SelectionControls;
  warnings: SheetWarningView[];
  warningController: WarningController;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const status = controls.factsStatus;
  const isDisabled = status.kind === 'saving' || maintenance.readOnly;
  const form = useForm<DeityValues>({
    resolver: zodResolver(deitySchema),
    values: { deity: facts.deity ?? '' },
    resetOptions: { keepDirtyValues: true },
  });

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-44 flex-col gap-0.5">
          <span className={fieldLabel} aria-hidden>
            Alignment
          </span>
          <ChoiceSelect
            label="Alignment"
            value={facts.alignment ?? ''}
            emptyLabel="No alignment"
            options={alignmentOptions}
            disabled={isDisabled}
            onValueChange={(value) =>
              void controls.saveFacts({
                alignment:
                  alignments.find((alignment) => alignment === value) ?? null,
              })
            }
          />
        </div>
        <Form {...form}>
          <form
            noValidate
            aria-label="Deity"
            className="flex min-w-0 flex-1 basis-56 items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (isDisabled) return;
              void form.handleSubmit(async ({ deity }) => {
                const trimmed = deity.trim();
                if (trimmed === (facts.deity ?? '')) return;
                if (await controls.saveFacts({ deity: trimmed || null }))
                  form.reset({ deity: trimmed });
              })();
            }}
          >
            <FormField
              control={form.control}
              name="deity"
              render={({ field }) => (
                <FormItem className="min-w-0 flex-1 gap-0.5">
                  <FormLabel className={fieldLabel}>Deity</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete="off"
                      className="h-10 md:h-8"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className={action}
              aria-describedby={reasonId}
              disabled={isDisabled}
            >
              Save deity
            </Button>
          </form>
        </Form>
      </div>
      <SaveFeedback
        status={status}
        savedText="Alignment and deity saved."
        savingText="Saving…"
        shouldHideWhenIdle
      />
      <InlineWarnings
        warnings={warnings}
        controller={warningController}
        isNamedByMessage
      />
    </div>
  );
}
