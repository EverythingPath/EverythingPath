'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
import { Textarea } from '~/components/ui/textarea';
import { action, fieldLabel } from './sheet-parts';

const schema = z.object({ choice: z.string(), notes: z.string() });
type Values = z.infer<typeof schema>;

/** The entered state, an empty choice meaning none. */
export type EntryState = { choice: string | null; notes: string };
/** Which fields the player deliberately changed. */
export type ChangedEntryState = { choice: boolean; notes: boolean };

const readChoice = (choice: string) => choice.trim() || null;

/**
 * The recorded state of one sheet entry, edited in place: its structural
 * choice where the entry has one, and its notes. Both may be empty. The
 * editor stays open, with what was entered, until the save is confirmed or
 * the player cancels.
 */
export function EntryStateEditor({
  subject,
  choiceLabel = 'Choice',
  choice,
  notes,
  canEditChoice,
  isSaving,
  onSave,
  onClose,
}: {
  /** Names the form and its controls, as in "Notes for {subject}". */
  subject: string;
  choiceLabel?: string;
  choice: string | null;
  notes: string;
  canEditChoice: boolean;
  isSaving: boolean;
  onSave: (state: EntryState, changed: ChangedEntryState) => Promise<boolean>;
  onClose: () => void;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: { choice: choice ?? '', notes },
    resetOptions: { keepDirtyValues: true },
  });
  // Subscribe so incoming values preserve only fields the player edited.
  const { dirtyFields } = form.formState;
  const isDisabled = isSaving || maintenance.readOnly;

  async function save(values: Values) {
    const state = { choice: readChoice(values.choice), notes: values.notes };
    const changed = {
      choice:
        canEditChoice && dirtyFields.choice === true && state.choice !== choice,
      notes: dirtyFields.notes === true && state.notes !== notes,
    };
    if (await onSave(state, changed)) onClose();
  }

  return (
    <Form {...form}>
      <form
        noValidate
        aria-label={`Edit ${subject}`}
        className="border-foreground/20 mt-2 w-full space-y-2 border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (isDisabled) return;
          void form.handleSubmit(save)();
        }}
      >
        {canEditChoice ? (
          <FormField
            control={form.control}
            name="choice"
            render={({ field, fieldState }) => (
              <FormItem className="gap-0.5">
                <FormLabel className={fieldLabel}>
                  {choiceLabel} <span className="sr-only">for {subject}</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    autoFocus
                    autoComplete="off"
                    disabled={isDisabled}
                    className="h-11 md:h-8"
                  />
                </FormControl>
                <FormMessage role={fieldState.error ? 'alert' : undefined} />
              </FormItem>
            )}
          />
        ) : null}
        <FormField
          control={form.control}
          name="notes"
          render={({ field, fieldState }) => (
            <FormItem className="gap-0.5">
              <FormLabel className={fieldLabel}>
                Notes <span className="sr-only">for {subject}</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  autoFocus={!canEditChoice}
                  rows={2}
                  disabled={isDisabled}
                  className="min-h-11 md:min-h-8"
                />
              </FormControl>
              <FormMessage role={fieldState.error ? 'alert' : undefined} />
            </FormItem>
          )}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            type="submit"
            size="sm"
            className={action}
            disabled={isDisabled}
          >
            Save <span className="sr-only">{subject}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={action}
            onClick={onClose}
          >
            Cancel <span className="sr-only">editing {subject}</span>
          </Button>
        </div>
      </form>
    </Form>
  );
}
