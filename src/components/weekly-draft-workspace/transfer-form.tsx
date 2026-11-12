'use client';
import { Plus } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '~/components/ui/form';
import { cn } from '~/lib/utils';
import { directionCopy } from './staged-transfer';
import type { UpkeepEdit } from './upkeep-edits';
import { useTransferForm } from './use-transfer-form';

const directions = ['deposit', 'withdraw'] as const;

// Deposit / Withdraw, an amount in gp and Add. The hook stages the edit and
// keeps an invalid amount in the field with its message.
export function TransferForm({
  edit,
  disabled,
}: {
  edit: UpkeepEdit;
  disabled: boolean;
}) {
  const { form, submit } = useTransferForm(edit);
  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={submit}
        className="flex flex-wrap items-start gap-x-3 gap-y-2"
      >
        <FormField
          name="direction"
          render={({ field }) => (
            <div
              role="group"
              aria-label="Transfer direction"
              className="inline-flex rounded-md border p-0.5 sm:mt-[1.375rem]"
            >
              {directions.map((direction) => {
                const pressed = field.value === direction;
                return (
                  <Button
                    key={direction}
                    type="button"
                    size="sm"
                    variant={pressed ? 'default' : 'ghost'}
                    aria-pressed={pressed}
                    disabled={disabled}
                    onClick={() => field.onChange(direction)}
                    className={cn(
                      'min-h-9 rounded-sm',
                      pressed ? null : 'text-muted-foreground',
                    )}
                  >
                    {directionCopy[direction].action}
                  </Button>
                );
              })}
            </div>
          )}
        />
        <FormField
          name="amount"
          render={({ field }) => (
            <FormItem className="w-full sm:w-52">
              <FormLabel className="sm:whitespace-nowrap">
                Transfer amount (gp)
              </FormLabel>
              <FormControl>
                <Input
                  inputMode="decimal"
                  autoComplete="off"
                  className="font-mono"
                  disabled={disabled}
                  {...field}
                />
              </FormControl>
              <FormMessage role="alert" />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          variant="outline"
          disabled={disabled}
          className="sm:mt-[1.375rem]"
        >
          <Plus />
          Add
        </Button>
      </form>
    </Form>
  );
}
