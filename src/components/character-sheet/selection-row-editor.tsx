'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
  FormItem,
  FormLabel,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { action, fieldLabel } from './sheet-parts';
import type {
  SelectionControls,
  SelectionRowView,
} from './selection-view-types';
import type { SelectionEditInput } from './use-character-sheet-selections';

type Values = { choice: string; notes: string };

function toValues(row: SelectionRowView): Values {
  return {
    choice: row.choice ?? '',
    notes: row.notes,
  };
}

/** Only what the player changed is sent; the rest of the Selection stays. */
function listChanges(
  row: SelectionRowView,
  values: Values,
  changed: Partial<Record<keyof Values, boolean>>,
) {
  const changes: SelectionEditInput = {};
  const choice = values.choice.trim() || null;
  if (changed.choice && choice !== row.choice) changes.choice = choice;
  if (changed.notes && values.notes !== row.notes) changes.notes = values.notes;
  return changes;
}

/**
 * A saved feat or trait's own record, edited in place: its choice and notes.
 * Its order within its level moves with the row's Earlier and Later. The
 * editor stays open with the player's input until the save succeeds.
 */
export function SelectionRowEditor({
  row,
  controls,
  onClose,
}: {
  row: SelectionRowView & { entryId: NonNullable<SelectionRowView['entryId']> };
  controls: SelectionControls;
  onClose: () => void;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const form = useForm<Values>({
    resolver: zodResolver(
      z.object({
        choice: z.string(),
        notes: z.string(),
      }),
    ),
    values: toValues(row),
    resetOptions: { keepDirtyValues: true },
  });
  const { dirtyFields } = form.formState;
  const isSaving = controls.statusForEntry(row.entryId).kind === 'saving';
  const isDisabled = isSaving || maintenance.readOnly;

  async function save(values: Values) {
    const changes = listChanges(row, values, dirtyFields);
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    if (await controls.edit(row.entryId, changes)) onClose();
  }

  return (
    <Form {...form}>
      <form
        noValidate
        aria-label={`Edit ${row.name}`}
        className="border-foreground/20 mt-2 flex w-full flex-col gap-2 border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (isDisabled) return;
          void form.handleSubmit(save)();
        }}
      >
        <FormField
          control={form.control}
          name="choice"
          render={({ field }) => (
            <FormItem className="gap-0.5">
              <FormLabel className={fieldLabel}>
                {row.choiceLabel}{' '}
                <span className="sr-only">for {row.name}</span>
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoFocus
                  autoComplete="off"
                  className="h-11 md:h-8"
                />
              </FormControl>
              {row.choiceGuidance ? (
                <FormDescription className="text-xs">
                  {field.value.trim()
                    ? row.choiceGuidance
                    : 'Incomplete: choose a spell.'}
                </FormDescription>
              ) : null}
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem className="gap-0.5">
              <FormLabel className={fieldLabel}>
                Notes <span className="sr-only">for {row.name}</span>
              </FormLabel>
              <FormControl>
                <Textarea {...field} rows={2} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            size="sm"
            className={action}
            aria-describedby={reasonId}
            disabled={isDisabled}
          >
            {isSaving ? 'Saving…' : 'Save'}{' '}
            <span className="sr-only">{row.name}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={action}
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
