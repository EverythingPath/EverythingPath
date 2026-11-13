'use client';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { StagedActionChoice } from '~/lib/weekly-draft-facts';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { WholeNumberField } from './whole-number-field';
type OrderChoice = Extract<StagedActionChoice, { actionId: 'special_order' }>;
const receiptInput = z.object({
  receivedDay: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .refine((value) => value !== null, 'A received day is required.'),
  outcome: z.string().trim().min(1, 'Describe what was received.'),
});
export function ActivityReceipt({
  choice,
  startDay,
  disabled,
  save,
}: {
  choice: OrderChoice;
  startDay: number;
  disabled: boolean;
  save: (choice: OrderChoice) => unknown;
}) {
  const acknowledgement = choice.acknowledgements?.find(
    (item) => item.acknowledgementId === choice.receipt?.acknowledgementId,
  );
  const values: { receivedDay: number | null; outcome: string } = {
    receivedDay: choice.receipt?.receivedDay ?? startDay,
    outcome: acknowledgement?.outcome ?? '',
  };
  const form = useForm({
    values,
    resolver: zodResolver(receiptInput),
  });
  return (
    <Form {...form}>
      <form
        noValidate
        className="space-y-3 rounded-md border p-3"
        onSubmit={form.handleSubmit(({ receivedDay, outcome }) => {
          if (receivedDay === null || !choice.orderId) return;
          const acknowledgementId =
            choice.receipt?.acknowledgementId ?? crypto.randomUUID();
          save({
            ...choice,
            receipt: { receivedDay, acknowledgementId },
            acknowledgements: [
              ...(choice.acknowledgements ?? []).filter(
                (item) => item.acknowledgementId !== acknowledgementId,
              ),
              { acknowledgementId, subjectId: choice.orderId, outcome },
            ],
          });
        })}
      >
        <h3 className="text-sm font-semibold">Order receipt</h3>
        <p className="text-muted-foreground text-xs">
          Record receipt only when the item has arrived. Delivery timing remains
          part of the weekly review.
        </p>
        <WholeNumberField
          label="Received day"
          value={form.watch('receivedDay')}
          required
          disabled={disabled}
          onValue={(value) => form.setValue('receivedDay', value)}
        />
        {form.formState.errors.receivedDay && (
          <p role="alert" className="text-destructive text-sm">
            {form.formState.errors.receivedDay.message}
          </p>
        )}
        <FormField
          control={form.control}
          name="outcome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Receipt notes</FormLabel>
              <FormControl>
                <Input {...field} disabled={disabled} />
              </FormControl>
              <FormMessage role="alert" />
            </FormItem>
          )}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            variant="outline"
            disabled={disabled || !choice.orderId}
          >
            Record receipt
          </Button>
          {choice.receipt && (
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => {
                const { receipt, ...rest } = choice;
                save({
                  ...rest,
                  acknowledgements: (choice.acknowledgements ?? []).filter(
                    (item) =>
                      item.acknowledgementId !== receipt?.acknowledgementId,
                  ),
                });
              }}
            >
              Clear receipt
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
