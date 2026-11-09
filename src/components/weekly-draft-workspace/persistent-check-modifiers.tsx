'use client';
import { Plus } from 'lucide-react';
import { useState } from 'react';
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
import { newModifierSource } from './persistent-check-edits';
import type {
  PersistentBonusChoice,
  PersistentRecordedModifier,
} from './types';
import { signed } from './upkeep-parts';
import type { ModifierChange } from './use-persistent-check';

type Result = 'accepted' | 'failed';

// The modifiers recorded on one check's roll: a list with in-place edit and
// removal, and a small form behind "+ Modifier". A modifier belongs to its
// roll, so nothing can be added before the roll is in. A failed save keeps
// the form open with what was typed.
type Editing =
  | { kind: 'add' }
  | { kind: 'edit'; shown: PersistentRecordedModifier };
const alerts = {
  save: 'This modifier wasn’t saved. Try again.',
  remove: 'This modifier wasn’t removed. Try again.',
};

export function CheckModifiers({
  subject,
  modifiers,
  bonusChoices,
  hasRoll,
  disabled,
  onChange,
}: {
  subject: string;
  modifiers: PersistentRecordedModifier[];
  bonusChoices: PersistentBonusChoice[];
  hasRoll: boolean;
  disabled: boolean;
  onChange: (change: ModifierChange) => Promise<Result>;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [alert, setAlert] = useState<keyof typeof alerts | null>(null);
  const open = (next: Editing) => {
    setAlert(null);
    setEditing(next);
  };
  const close = () => {
    setAlert(null);
    setEditing(null);
  };
  async function save(change: ModifierChange) {
    setAlert(null);
    const result = await onChange(change);
    if (result === 'accepted') setEditing(null);
    else setAlert('save');
    return result;
  }
  async function remove(shown: PersistentRecordedModifier) {
    setAlert(null);
    const result = await onChange({ kind: 'remove', shown });
    if (result === 'failed') setAlert('remove');
  }
  return (
    <div className="min-w-0 space-y-2">
      {modifiers.length > 0 && (
        <ul aria-label={`${subject} modifiers`} className="space-y-1 text-sm">
          {modifiers.map((modifier) => (
            <li
              key={modifier.index}
              className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1"
            >
              <span className="font-mono">{signed(modifier.value)}</span>
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {modifier.label}
              </span>
              <span className="flex gap-1 sm:ml-auto">
                {modifier.kind !== 'bonus' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11 sm:min-h-8"
                    disabled={disabled}
                    aria-label={`Edit modifier ${modifier.label}`}
                    onClick={() => open({ kind: 'edit', shown: modifier })}
                  >
                    Edit
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11 sm:min-h-8"
                  disabled={disabled}
                  aria-label={`Remove modifier ${modifier.label}`}
                  onClick={() => void remove(modifier)}
                >
                  Remove
                </Button>
              </span>
              {modifier.note && (
                <span
                  role="note"
                  className="w-full min-w-0 text-xs [overflow-wrap:anywhere] text-amber-300"
                >
                  {modifier.note}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing ? (
        <ModifierForm
          key={editing.kind === 'add' ? 'add' : editing.shown.index}
          initial={editing.kind === 'edit' ? editing.shown : null}
          bonusChoices={editing.kind === 'add' ? bonusChoices : []}
          disabled={disabled}
          alert={alert === 'save' ? alerts.save : null}
          onCancel={close}
          onSave={({ sourceId, value, reason }) =>
            save(
              editing.kind === 'edit'
                ? { kind: 'edit', shown: editing.shown, value, reason }
                : {
                    kind: 'add',
                    modifier: {
                      sourceId: sourceId ?? newModifierSource(),
                      value,
                      reason,
                    },
                  },
            )
          }
        />
      ) : (
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || !hasRoll}
            aria-label="Add modifier"
            className="text-muted-foreground min-h-11 sm:min-h-8"
            onClick={() => open({ kind: 'add' })}
          >
            <Plus aria-hidden />
            Modifier
          </Button>
          {!hasRoll && (
            <p className="text-muted-foreground min-w-0 text-xs [overflow-wrap:anywhere]">
              Enter the roll first: modifiers are recorded with it.
            </p>
          )}
          {alert && (
            <p role="alert" className="text-destructive text-sm">
              {alerts[alert]}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// One modifier's form: a rules bonus from the list, or a custom table
// modifier with a signed value and a reason. Validation is structural only;
// whether an entry counts is the rules' fact, shown as a note on the row.
const CUSTOM = '__custom__';
const wholeNumber = /^[+-]?\d+$/;
const modifierSchema = z
  .object({ source: z.string(), value: z.string(), reason: z.string() })
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

function ModifierForm({
  initial,
  bonusChoices,
  disabled,
  alert,
  onSave,
  onCancel,
}: {
  initial: PersistentRecordedModifier | null;
  bonusChoices: PersistentBonusChoice[];
  disabled: boolean;
  alert: string | null;
  onSave: (modifier: {
    sourceId?: string;
    value: number;
    reason: string;
  }) => Promise<Result>;
  onCancel: () => void;
}) {
  const form = useForm({
    defaultValues: {
      source: bonusChoices[0]?.sourceId ?? CUSTOM,
      value: initial ? String(initial.value) : '',
      reason: initial?.reason ?? '',
    },
    resolver: zodResolver(modifierSchema),
  });
  const custom = form.watch('source') === CUSTOM;
  const saving = form.formState.isSubmitting;
  const submit = form.handleSubmit(async (values) => {
    const bonus = bonusChoices.find(
      (choice) => choice.sourceId === values.source,
    );
    await onSave(
      bonus
        ? { sourceId: bonus.sourceId, value: bonus.value, reason: bonus.label }
        : // "-0" would otherwise record a negative zero.
          {
            value: Number(values.value.trim()) || 0,
            reason: values.reason.trim(),
          },
    );
  });
  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={submit}
        aria-label={initial ? 'Edit modifier' : 'New modifier'}
        className="bg-background/50 max-w-xl min-w-0 space-y-3 rounded-md border p-3"
      >
        {bonusChoices.length > 0 && (
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
                    <SelectTrigger className="min-h-11 w-full sm:min-h-9">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {bonusChoices.map((choice) => (
                      <SelectItem key={choice.sourceId} value={choice.sourceId}>
                        {choice.label} {signed(choice.value)}
                      </SelectItem>
                    ))}
                    <SelectSeparator />
                    <SelectItem value={CUSTOM}>
                      Custom table modifier
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage role="alert" />
              </FormItem>
            )}
          />
        )}
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
                    <Input {...field} autoComplete="off" disabled={disabled} />
                  </FormControl>
                  <FormMessage role="alert" />
                </FormItem>
              )}
            />
          </div>
        )}
        {alert && (
          <p role="alert" className="text-destructive text-sm">
            {alert}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={disabled || saving}>
            {saving ? 'Saving…' : initial ? 'Save modifier' : 'Add modifier'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
