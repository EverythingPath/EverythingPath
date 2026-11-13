'use client';
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
import { cn } from '~/lib/utils';
import type { CompanionAllocationsController } from './companion-props';
import { progressionInput } from './companion-progression-number-field';
import type { SaveStatus } from './save-status';
import { action, fieldLabel } from './sheet-parts';

/**
 * The one open share editor, in the companion's own row: the effective
 * levels typed as a plain number, Save and Cancel beside it, and its message
 * growing inside the field so the row's name stays where it is. Escape and
 * Cancel close it without writing; a refused save keeps the draft, its
 * reason shown by the row's own save feedback.
 */
export function CompanionAllocationEditor({
  controller,
  title,
  status,
  reasonId,
}: {
  controller: CompanionAllocationsController;
  /** "Fang's Beast Master share": names the form, its field and its buttons. */
  title: string;
  status: SaveStatus;
  reasonId: string | undefined;
}) {
  const isDisabled = controller.isDisabled || status.kind === 'saving';
  return (
    <Form {...controller.form}>
      <form
        noValidate
        aria-label={`Edit ${title}`}
        className="flex min-w-0 flex-col gap-1"
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
        <FormField
          control={controller.form.control}
          name="levels"
          render={({ field, fieldState }) => (
            <FormItem className="min-w-0 gap-1">
              <FormLabel className={fieldLabel}>Effective levels</FormLabel>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <FormControl>
                  <Input
                    {...field}
                    aria-label={title}
                    autoFocus
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    disabled={isDisabled}
                    className={cn(progressionInput, 'w-20')}
                  />
                </FormControl>
                <Button
                  type="submit"
                  size="sm"
                  className={action}
                  aria-describedby={reasonId}
                  disabled={isDisabled}
                >
                  Save <span className="sr-only">{title}</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={action}
                  onClick={controller.closeEditor}
                >
                  Cancel <span className="sr-only">editing {title}</span>
                </Button>
              </div>
              <FormMessage
                role={fieldState.error ? 'alert' : undefined}
                className="text-xs [overflow-wrap:anywhere]"
              />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
