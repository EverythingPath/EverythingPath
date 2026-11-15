'use client';
import { useId } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { cn } from '~/lib/utils';
import { action, chip, fieldLabel } from './sheet-parts';
import type { useCharacterSheetLinkedInput } from './use-character-sheet-linked-input';

type LinkedInputController = ReturnType<typeof useCharacterSheetLinkedInput>;

// A playing card: lifts on hover, settles when chosen, stays put for reduced motion.
const card =
  'justify-start gap-2 text-left font-sans text-sm transition-all hover:-translate-y-0.5 hover:border-foreground motion-reduce:transition-none motion-reduce:hover:translate-y-0';

/**
 * The linked value's one open editor, beside or beneath its row: a fallback
 * used only while the value cannot be calculated, or the interpretation that
 * settles a conflict. Escape and Cancel close it without writing; a failed
 * save keeps the draft and its reason beside the form.
 */
export function CharacterLinkedInputEditor({
  controller,
}: {
  controller: LinkedInputController;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const groupLabelId = useId();
  const { editor, view, form } = controller;
  if (!editor || !view) return null;
  const isDisabled =
    controller.isDisabled || controller.status.kind === 'saving';
  const title =
    editor === 'fallback'
      ? `Fallback for ${view.label}`
      : `Interpretation for ${view.label}`;
  const firstFocus =
    view.options.find(
      (option) => option.sourceKey === form.getValues('sourceKey'),
    ) ?? view.options[0];
  return (
    <Form {...form}>
      <form
        noValidate
        aria-label={title}
        className="border-foreground/20 w-full min-w-0 space-y-3 border p-3"
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
        {editor === 'fallback' ? (
          <FormField
            control={form.control}
            name="value"
            render={({ field, fieldState }) => (
              <FormItem className="gap-0.5">
                <FormLabel className={fieldLabel}>{title}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    autoFocus
                    autoComplete="off"
                    inputMode="text"
                    pattern="[+-]?[0-9]+"
                    disabled={isDisabled}
                    className="min-h-11 w-full sm:w-32 md:min-h-9"
                  />
                </FormControl>
                <FormDescription className="text-xs">
                  {view.fallbackDescription}
                </FormDescription>
                <FormMessage role={fieldState.error ? 'alert' : undefined} />
              </FormItem>
            )}
          />
        ) : (
          <FormField
            control={form.control}
            name="sourceKey"
            render={({ field, fieldState }) => (
              <FormItem className="gap-0.5">
                <span
                  id={groupLabelId}
                  className={cn(
                    fieldLabel,
                    fieldState.error && 'text-destructive',
                  )}
                >
                  {title}
                </span>
                <FormControl>
                  <RadioGroup
                    aria-labelledby={groupLabelId}
                    name={field.name}
                    value={field.value}
                    disabled={isDisabled}
                    onBlur={field.onBlur}
                    onValueChange={(sourceKey) => {
                      form.setValue('sourceKey', sourceKey, {
                        shouldDirty: true,
                      });
                      form.clearErrors('sourceKey');
                    }}
                    className="grid-cols-1 gap-1 sm:grid-cols-2"
                  >
                    {view.options.map((option) => (
                      <RadioGroupItem
                        key={option.sourceKey}
                        value={option.sourceKey}
                        autoFocus={option === firstFocus}
                        className={card}
                      >
                        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                          {option.label}
                        </span>
                        <span className={chip}>{option.value}</span>
                      </RadioGroupItem>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage role={fieldState.error ? 'alert' : undefined} />
              </FormItem>
            )}
          />
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            type="submit"
            size="sm"
            className={action}
            aria-describedby={reasonId}
            disabled={isDisabled}
          >
            {editor === 'fallback' ? 'Save fallback' : 'Save interpretation'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={action}
            onClick={controller.closeEditor}
          >
            Cancel <span className="sr-only">{title}</span>
          </Button>
        </div>
      </form>
    </Form>
  );
}
