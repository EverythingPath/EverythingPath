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
import {
  companionComponentKeys,
  companionComponentLabels,
} from '~/lib/character-sheet-companion-components';
import { cn } from '~/lib/utils';
import type { CompanionAllocationsController } from './companion-props';
import { progressionInput } from './companion-progression-number-field';
import type { SaveStatus } from './save-status';
import { action, fieldLabel } from './sheet-parts';

/**
 * The one open component editor, in the eidolon's own row (#419): its eight
 * shares typed as plain numbers, saved together, with Save and Cancel below
 * them and each message growing inside its own field so the fields beside
 * it stay aligned. Escape and Cancel close it without writing; a refused
 * save keeps the draft, its reason shown by the row's own save feedback.
 */
export function CompanionComponentEditor({
  controller,
  title,
  status,
  reasonId,
}: {
  controller: CompanionAllocationsController;
  /** "Brute's Broodmaster share": names the form and its buttons. */
  title: string;
  status: SaveStatus;
  reasonId: string | undefined;
}) {
  const isDisabled = controller.isDisabled || status.kind === 'saving';
  return (
    <Form {...controller.componentForm}>
      <form
        noValidate
        aria-label={`Edit ${title}`}
        className="flex min-w-0 flex-col gap-2 md:w-[26rem]"
        onSubmit={(event) => {
          event.preventDefault();
          if (isDisabled) return;
          void controller.submitComponents();
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          controller.closeComponentEditor();
        }}
      >
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-4">
          {companionComponentKeys.map((key, index) => (
            <FormField
              key={key}
              control={controller.componentForm.control}
              name={key}
              render={({ field, fieldState }) => (
                <FormItem className="min-w-0 content-start gap-1">
                  <FormLabel className={fieldLabel}>
                    {companionComponentLabels[key]}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoFocus={index === 0}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      disabled={isDisabled}
                      className={cn(progressionInput, 'w-full min-w-0')}
                    />
                  </FormControl>
                  <FormMessage
                    role={fieldState.error ? 'alert' : undefined}
                    className="text-xs [overflow-wrap:anywhere]"
                  />
                </FormItem>
              )}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
            onClick={controller.closeComponentEditor}
          >
            Cancel <span className="sr-only">editing {title}</span>
          </Button>
        </div>
      </form>
    </Form>
  );
}
