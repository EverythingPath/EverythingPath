'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import type { ActivityBonusChoice } from './types';
import { signed } from './activity-check-row';

// Adds one modifier to the recorded check roll: an available rules bonus, or
// a custom table modifier with a signed value and a reason. Validation is
// structural only (a whole number, a nonblank reason); the rules warn about
// usage afterwards.

const CUSTOM = '__custom__';
const wholeNumber = /^[+-]?\d+$/;

const schema = z
  .object({
    source: z.string().min(1),
    value: z.string(),
    reason: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.source !== CUSTOM) return;
    const value = values.value.trim();
    if (value === '')
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Enter a value.',
      });
    else if (!wholeNumber.test(value) || !Number.isSafeInteger(Number(value)))
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Enter a whole number, such as -2 or 3.',
      });
    if (values.reason.trim() === '')
      ctx.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'A reason is required.',
      });
  });

export function ActivityModifierForm({
  bonusChoices,
  disabled,
  onAdd,
  onCancel,
}: {
  bonusChoices: ActivityBonusChoice[];
  disabled: boolean;
  onAdd: (modifier: RawRoll['modifiers'][number]) => void;
  onCancel: () => void;
}) {
  const form = useForm({
    defaultValues: {
      source: bonusChoices[0]?.sourceId ?? CUSTOM,
      value: '',
      reason: '',
    },
    resolver: zodResolver(schema),
  });
  const custom = form.watch('source') === CUSTOM;
  const submit = form.handleSubmit((values) => {
    const bonus = bonusChoices.find(
      (choice) => choice.sourceId === values.source,
    );
    onAdd(
      bonus
        ? { sourceId: bonus.sourceId, value: bonus.value, reason: bonus.label }
        : {
            sourceId: `custom:${crypto.randomUUID()}`,
            value: Number(values.value.trim()),
            reason: values.reason.trim(),
          },
    );
  });
  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={submit}
        aria-label="New modifier"
        className="bg-muted/40 max-w-xl space-y-3 rounded-md p-3"
      >
        <FormField
          control={form.control}
          name="source"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Modifier</FormLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={disabled}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {bonusChoices.map((choice) => (
                    <SelectItem key={choice.sourceId} value={choice.sourceId}>
                      {choice.label} {signed(choice.value)}
                    </SelectItem>
                  ))}
                  {bonusChoices.length > 0 && <SelectSeparator />}
                  <SelectItem value={CUSTOM}>Custom table modifier</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage role="alert" />
            </FormItem>
          )}
        />
        {custom && (
          <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,8rem)_minmax(0,1fr)]">
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Value</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      className="font-mono"
                      disabled={disabled}
                    />
                  </FormControl>
                  <FormMessage role="alert" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={disabled} />
                  </FormControl>
                  <FormMessage role="alert" />
                </FormItem>
              )}
            />
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={disabled}>
            Add modifier
          </Button>
        </div>
      </form>
    </Form>
  );
}
