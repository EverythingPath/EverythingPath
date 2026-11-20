'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import type { EventWhatHappened } from './types';

const schema = z.object({
  outcome: z.string().trim().min(1, 'Say what happened before saving.'),
});

// The table's own account of an event's outcome, one line with Save. The
// owner validates the saved text against the draft and hands back a message,
// shown at the field like any other field error. `subject` distinguishes a
// second line in the same block (a reaction's account) for assistive
// technology; the visible label stays "What happened".
export function EventWhatHappenedLine({
  facts,
  disabled,
  onSave,
  onClear,
  subject,
}: {
  facts: EventWhatHappened;
  disabled: boolean;
  onSave: (outcome: string) => string | null;
  onClear: () => void;
  subject?: string;
}) {
  const named = (label: string) => (subject ? `${label} · ${subject}` : label);
  const form = useForm({
    values: { outcome: facts.acknowledgement?.outcome ?? '' },
    resolver: zodResolver(schema),
  });
  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(({ outcome }) => {
          const message = onSave(outcome);
          if (message) form.setError('outcome', { message });
        })}
        className="flex min-w-0 flex-wrap items-start gap-x-3 gap-y-2"
      >
        <FormField
          control={form.control}
          name="outcome"
          render={({ field }) => (
            <FormItem className="min-w-0 flex-1 basis-64">
              <FormLabel>
                What happened{' '}
                <span className="text-muted-foreground text-xs font-normal">
                  {facts.required ? 'required' : 'optional'}
                </span>
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  aria-label={named('What happened')}
                  disabled={disabled}
                />
              </FormControl>
              <FormDescription className="min-w-0 text-xs [overflow-wrap:anywhere]">
                {facts.hint}
              </FormDescription>
              <FormMessage role="alert" />
            </FormItem>
          )}
        />
        {/* Offset to sit beside the input on a tablet: the label above it is one line. */}
        <div className="flex flex-wrap gap-2 sm:pt-6">
          <Button
            type="submit"
            aria-label={named('Save what happened')}
            disabled={disabled}
          >
            Save
          </Button>
          {facts.acknowledgement && (
            <Button
              type="button"
              variant="outline"
              aria-label={subject ? named('Clear what happened') : undefined}
              disabled={disabled}
              onClick={onClear}
            >
              Clear what happened
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
