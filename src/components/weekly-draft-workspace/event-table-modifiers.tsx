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
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '~/components/ui/form';
import type { EventBlock } from './types';
import { signed } from './upkeep-parts';
import {
  newTableModifierSource,
  type TableModifier,
  type useEventEdits,
} from './use-event-edits';

// The extra modifiers a table adds to one event's table roll: a list with
// in-place edit and removal, and a small form behind "+ Table modifier".
// Validation is the form's own; whether an entry applies is the rules' fact.

const WHOLE_NUMBER = 'Use a whole number such as 4 or -3.';
const modifierSchema = z.object({
  value: z
    .string()
    .min(1, 'A value is required.')
    .regex(/^-?[0-9]+$/, WHOLE_NUMBER)
    .refine(
      (value) => Number.isSafeInteger(Number(value)),
      'Enter a smaller whole number.',
    ),
  reason: z.string().trim().min(1, 'A reason is required.'),
});

// Recorded entries may repeat a source, so the list position identifies one.
type Editing = { kind: 'add' } | { kind: 'edit'; index: number };

export function EventTableModifiers({
  block,
  disabled,
  edits,
}: {
  block: EventBlock;
  disabled: boolean;
  edits: ReturnType<typeof useEventEdits>;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState('');
  const modifiers = block.table.modifiers;
  // Recorded entries may repeat a source: number repeats for stable keys.
  const keys = modifiers.map(
    (modifier, index) =>
      `${modifier.sourceId}#${
        modifiers
          .slice(0, index)
          .filter((entry) => entry.sourceId === modifier.sourceId).length
      }`,
  );
  const rolled = Boolean(block.item.occurrence.tableRoll);
  if (!rolled && modifiers.length === 0) return null;
  function commit(list: TableModifier[]) {
    const message = edits.setTableModifiers(block.eventId, list);
    setError(message ?? '');
    if (message === null) setEditing(null);
  }
  const current =
    editing?.kind === 'edit' ? modifiers[editing.index] : undefined;
  return (
    <div className="min-w-0 space-y-2">
      {modifiers.length > 0 && (
        <ul className="space-y-1 text-sm">
          {modifiers.map((modifier, index) => (
            <li
              key={keys[index]}
              className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1"
            >
              <span className="font-mono">{signed(modifier.value)}</span>
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {modifier.reason}
              </span>
              {modifier.ignored && (
                <span className="text-muted-foreground min-w-0 text-xs [overflow-wrap:anywhere]">
                  {modifier.ignored === 'settlement'
                    ? '(not applied: settlement reputation changes only the chance roll)'
                    : '(not applied: a later entry from the same source counts instead)'}
                </span>
              )}
              <span className="flex gap-1 sm:ml-auto">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  aria-label={`Edit table modifier ${modifier.reason}`}
                  onClick={() => {
                    setError('');
                    setEditing({ kind: 'edit', index });
                  }}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  aria-label={`Remove table modifier ${modifier.reason}`}
                  onClick={() =>
                    commit(modifiers.filter((_, other) => other !== index))
                  }
                >
                  Remove
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {editing ? (
        <TableModifierForm
          key={editing.kind === 'add' ? 'add' : editing.index}
          initial={current ?? null}
          disabled={disabled}
          error={error}
          onCancel={() => {
            setError('');
            setEditing(null);
          }}
          onSave={(value, reason) =>
            commit(
              editing.kind === 'edit'
                ? modifiers.map((entry, index) =>
                    index === editing.index
                      ? { ...entry, value, reason }
                      : entry,
                  )
                : [
                    ...modifiers,
                    {
                      sourceId: newTableModifierSource(),
                      value,
                      reason,
                      ignored: null,
                    },
                  ],
            )
          }
        />
      ) : (
        <>
          {error && (
            <p role="alert" className="text-sm text-amber-300">
              {error}
            </p>
          )}
          {rolled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              aria-label="Add table modifier"
              className="text-muted-foreground"
              onClick={() => {
                setError('');
                setEditing({ kind: 'add' });
              }}
            >
              <Plus aria-hidden />
              Table modifier
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function TableModifierForm({
  initial,
  disabled,
  error,
  onSave,
  onCancel,
}: {
  initial: TableModifier | null;
  disabled: boolean;
  error: string;
  onSave: (value: number, reason: string) => void;
  onCancel: () => void;
}) {
  const form = useForm({
    defaultValues: {
      value: initial ? String(initial.value) : '',
      reason: initial?.reason ?? '',
    },
    resolver: zodResolver(modifierSchema),
  });
  return (
    <Form {...form}>
      <form
        noValidate
        aria-label={initial ? 'Edit table modifier' : 'Add table modifier'}
        onSubmit={form.handleSubmit((values) =>
          // "-0" would otherwise record a negative zero.
          onSave(Number(values.value) || 0, values.reason.trim()),
        )}
        className="bg-background/50 min-w-0 space-y-2 rounded-md border p-3"
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,8rem)_minmax(0,1fr)]">
          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Table modifier value</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className="font-mono"
                    disabled={disabled}
                    onChange={(event) => {
                      const text = event.target.value;
                      if (!/^-?[0-9]*$/.test(text)) {
                        form.setError('value', { message: WHOLE_NUMBER });
                        return;
                      }
                      form.clearErrors('value');
                      field.onChange(text);
                    }}
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
                <FormLabel>Table modifier reason</FormLabel>
                <FormControl>
                  <Input {...field} disabled={disabled} />
                </FormControl>
                <FormMessage role="alert" />
              </FormItem>
            )}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-amber-300">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={disabled}>
            Save table modifier
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
