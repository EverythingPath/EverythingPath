'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import type { EventEditResult } from './event-family-inputs';
import {
  newRewardItemId,
  rewardFormSchema,
  rewardFormValues,
  type RewardFormValues,
} from './event-reward-values';
import type { EventReward, EventRewardFacts } from './types';
import type { EventRewardInput } from './use-event-edits';

// One Found Fire reward's inline form: the recipient, name, value, weight
// and flags of a new reward for one PC or of a recorded one being edited.
// Values are validated field by field on Save; a refused save stays in the
// form with its message. A new reward takes its item identity once, when
// the form opens, so a retried save keeps it. `subject` is the block label.
export function EventRewardForm({
  reward,
  recipient,
  choices,
  subject,
  disabled,
  onSave,
  onClose,
}: {
  // The recorded reward being edited, or null for a new one.
  reward: EventReward | null;
  // The PC a new reward is for.
  recipient: { characterId: string; name: string };
  choices: EventRewardFacts['choices'];
  subject: string;
  disabled: boolean;
  onSave: (reward: EventRewardInput) => EventEditResult;
  onClose: () => void;
}) {
  const [itemId] = useState(() => reward?.itemId ?? newRewardItemId());
  const [refusal, setRefusal] = useState<string | null>(null);
  // The recorded recipient stays choosable while editing, even when no
  // longer an active PC, so an older entry can be saved before it is moved.
  const options =
    reward && !choices.some((choice) => choice.value === reward.characterId)
      ? [...choices, { value: reward.characterId, label: reward.recipient }]
      : choices;
  const form = useForm<RewardFormValues, unknown, EventRewardInput>({
    defaultValues: rewardFormValues(reward, recipient.characterId),
    resolver: zodResolver(
      rewardFormSchema(
        options.map((option) => option.value),
        itemId,
      ),
    ),
  });
  const label = `${
    reward ? `Edit ${reward.name}` : `New reward for ${recipient.name}`
  } · ${subject}`;
  return (
    <Form {...form}>
      <form
        noValidate
        role="group"
        aria-label={label}
        onSubmit={form.handleSubmit((parsed) => {
          const result = onSave(parsed);
          if (result) {
            setRefusal(result);
            return;
          }
          setRefusal(null);
          onClose();
        })}
        className="bg-background/50 min-w-0 space-y-3 rounded-md border p-3"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="recipient"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Recipient</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={disabled}
                >
                  <FormControl>
                    <SelectTrigger className="min-h-11 w-full sm:min-h-9">
                      <SelectValue placeholder="Choose a PC" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage role="alert" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="off" disabled={disabled} />
                </FormControl>
                <FormMessage role="alert" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Value (gp)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="text"
                    inputMode="decimal"
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
            name="weight"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Weight (lb)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    className="font-mono"
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage role="alert" />
              </FormItem>
            )}
          />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <RewardFlag form={form} name="alchemical" disabled={disabled}>
            Alchemical
          </RewardFlag>
          <RewardFlag form={form} name="poison" disabled={disabled}>
            Poison
          </RewardFlag>
        </div>
        {refusal && (
          <p role="alert" className="text-destructive text-sm">
            {refusal}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            className="min-h-11 sm:min-h-9"
            disabled={disabled}
            aria-label={`Save reward · ${subject}`}
          >
            Save reward
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 sm:min-h-9"
            aria-label={`Cancel · ${subject}`}
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}

// A yes/no flag of the reward as a native checkbox: there is no checkbox
// primitive in this app's kit, so the theme's accent colour and focus ring
// style it and the label carries its words.
function RewardFlag({
  form,
  name,
  disabled,
  children,
}: {
  form: ReturnType<typeof useForm<RewardFormValues, unknown, EventRewardInput>>;
  name: 'alchemical' | 'poison';
  disabled: boolean;
  children: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex min-h-11 flex-row items-center gap-2 sm:min-h-9">
          <FormControl>
            <input
              type="checkbox"
              name={field.name}
              ref={field.ref}
              checked={field.value}
              disabled={disabled}
              onBlur={field.onBlur}
              onChange={(event) => field.onChange(event.target.checked)}
              className="accent-primary border-input focus-visible:ring-ring/50 size-4 rounded border outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
            />
          </FormControl>
          <FormLabel className="font-normal">{children}</FormLabel>
        </FormItem>
      )}
    />
  );
}
