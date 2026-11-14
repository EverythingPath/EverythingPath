'use client';
import { TriangleAlert } from 'lucide-react';
import {
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import type { FieldError, UseFormRegisterReturn } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { warningText, wrap } from '~/components/week-review/review-parts';
import { cn } from '~/lib/utils';
import type { AdjustmentFormValues, Choice } from './summary-adjustment-form';
import type { AdjustmentForm } from './use-summary-forms';

// The kind-specific fields of one Table Adjustment form and the reason field
// every local form shares. Presentation only: values, validation and saving
// live in the form hooks.

/** A visible validation message; a missing reason is a warning, not an error. */
export function FieldMessage({
  id,
  tone,
  children,
}: {
  id: string;
  tone: 'error' | 'warning';
  children: ReactNode;
}) {
  return (
    <p
      id={id}
      role="alert"
      className={cn(
        'flex gap-1.5 text-sm',
        wrap,
        tone === 'warning' ? warningText : 'text-destructive',
      )}
    >
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span className={wrap}>{children}</span>
    </p>
  );
}

/** The failure and remote-change notes of a local form. */
export function FormNotes({
  failure,
  hasRemoteChange,
  remoteMessage,
}: {
  failure: string | null;
  hasRemoteChange: boolean;
  remoteMessage: string;
}) {
  return (
    <>
      {failure && (
        <p role="alert" className={cn('text-destructive text-sm', wrap)}>
          {failure}
        </p>
      )}
      {hasRemoteChange && remoteMessage && (
        <p role="status" className={cn('text-sm', warningText, wrap)}>
          {remoteMessage}
        </p>
      )}
    </>
  );
}

/**
 * Grows a reason field to show all of its text where the browser cannot
 * size it to its content (`field-sizing` is not supported everywhere).
 */
function fitToContent(field: HTMLTextAreaElement) {
  if (typeof CSS?.supports !== 'function') return;
  if (CSS.supports('field-sizing', 'content')) return;
  field.style.height = 'auto';
  field.style.height = `${field.scrollHeight + field.offsetHeight - field.clientHeight}px`;
}

/**
 * A single-paragraph reason that wraps and grows instead of clipping. Enter
 * submits the form; a blank reason reads as a warning until it is filled.
 */
export function ReasonField({
  label,
  registration,
  value,
  error,
  disabled,
  onEnter,
  className,
}: {
  label: string;
  registration: UseFormRegisterReturn;
  /** The current text; blank warns before the schema has run. */
  value: string;
  error?: FieldError;
  disabled: boolean;
  onEnter: () => void;
  className?: string;
}) {
  const id = useId();
  const messageId = `${id}-message`;
  const message =
    error?.message ?? (value.trim() === '' ? 'A reason is required.' : null);
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);
  // Text set from outside (accepted refresh, Cancel) is fitted as well.
  useLayoutEffect(() => {
    if (fieldRef.current) fitToContent(fieldRef.current);
  }, [value]);
  return (
    <div className={cn('min-w-0 space-y-1', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Textarea
        id={id}
        rows={1}
        placeholder="Reason (required)"
        autoComplete="off"
        disabled={disabled}
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        className={cn(
          '[field-sizing:content] min-h-9 w-full resize-none py-1.5 [overflow-wrap:anywhere]',
          message &&
            'border-amber-500/70 aria-invalid:border-amber-500/70 aria-invalid:ring-amber-500/20',
        )}
        onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
          if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
          event.preventDefault();
          if (!event.shiftKey) onEnter();
        }}
        {...registration}
        ref={(node) => {
          registration.ref(node);
          fieldRef.current = node;
        }}
      />
      {message && (
        <FieldMessage id={messageId} tone="warning">
          {message}
        </FieldMessage>
      )}
    </div>
  );
}

type ChoiceName = Exclude<
  keyof AdjustmentFormValues,
  'kind' | 'value' | 'reason'
>;

/** A row of pressable choices standing in for a select; one is pressed. */
function SegmentedChoice({
  label,
  name,
  choices,
  empty,
  form,
  disabled,
}: {
  label: string;
  name: ChoiceName;
  choices: Choice[];
  /** Shown instead of the buttons when nothing can be chosen. */
  empty?: string;
  form: AdjustmentForm['form'];
  disabled: boolean;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const messageId = `${id}-message`;
  const value = form.watch(name);
  const error = form.formState.errors[name];
  return (
    <div className="min-w-0 space-y-1">
      <p id={labelId} className="text-muted-foreground text-xs font-medium">
        {label}
      </p>
      {choices.length === 0 ? (
        <p className={cn('text-muted-foreground text-sm', wrap)}>{empty}</p>
      ) : (
        <div
          role="group"
          aria-labelledby={labelId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? messageId : undefined}
          tabIndex={error ? -1 : undefined}
          className="flex flex-wrap gap-1.5 rounded-md outline-none"
        >
          {choices.map((choice) => (
            <Button
              key={choice.value}
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={choice.value === value}
              disabled={disabled}
              onClick={() =>
                form.setValue(name, choice.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              className={cn(
                'hover:border-primary/60 aria-pressed:border-primary aria-pressed:bg-primary/15 aria-pressed:hover:border-primary aria-pressed:hover:bg-primary/15 hover:bg-background hover:text-foreground min-h-9 min-w-0 border-2 px-3 py-1.5 text-left whitespace-normal',
                error && 'border-destructive/60',
              )}
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {choice.label}
              </span>
            </Button>
          ))}
        </div>
      )}
      {error?.message && (
        <FieldMessage id={messageId} tone="error">
          {error.message}
        </FieldMessage>
      )}
    </div>
  );
}

function AmountField({
  form,
  disabled,
}: {
  form: AdjustmentForm['form'];
  disabled: boolean;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const messageId = `${id}-message`;
  const money = form.watch('field') === 'treasuryCopper';
  const adding = form.watch('operation') === 'add';
  const error = form.formState.errors.value;
  const hint = adding
    ? money
      ? 'Use a minus sign to subtract, e.g. -0.07 gp.'
      : 'Use a minus sign to subtract, e.g. -2.'
    : null;
  return (
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className="text-muted-foreground text-xs font-medium">
        Amount
      </label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="text"
          autoComplete="off"
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [error ? messageId : null, hint ? hintId : null]
              .filter(Boolean)
              .join(' ') || undefined
          }
          className="max-w-40 font-mono"
          {...form.register('value')}
        />
        {money && (
          <span aria-hidden className="text-muted-foreground text-sm">
            gp
          </span>
        )}
      </div>
      {hint && (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
      {error?.message && (
        <FieldMessage id={messageId} tone="error">
          {error.message}
        </FieldMessage>
      )}
    </div>
  );
}

/** The fields of the form's kind, above its reason. */
export function AdjustmentFields({
  form,
  disabled,
}: {
  form: AdjustmentForm;
  disabled: boolean;
}) {
  const { choices } = form;
  const kind = form.form.watch('kind');
  const segmented = { form: form.form, disabled };
  switch (kind) {
    case 'militia_value':
      return (
        <div className="min-w-0 space-y-3">
          <SegmentedChoice
            label="Field"
            name="field"
            choices={choices.fields}
            {...segmented}
          />
          <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
            <SegmentedChoice
              label="Operation"
              name="operation"
              choices={choices.operations}
              {...segmented}
            />
            <AmountField form={form.form} disabled={disabled} />
          </div>
        </div>
      );
    case 'team_status':
      return (
        <div className="min-w-0 space-y-3">
          <SegmentedChoice
            label="Team"
            name="teamId"
            choices={choices.teams}
            empty="No teams are part of this week."
            {...segmented}
          />
          <SegmentedChoice
            label="Condition"
            name="status"
            choices={choices.conditions}
            {...segmented}
          />
        </div>
      );
    case 'settlement_reputation':
      return (
        <div className="min-w-0 space-y-3">
          <SegmentedChoice
            label="Settlement"
            name="settlementId"
            choices={choices.settlements}
            empty="No settlements are part of this week."
            {...segmented}
          />
          <SegmentedChoice
            label="Reputation"
            name="reputation"
            choices={choices.reputations}
            {...segmented}
          />
        </div>
      );
    case 'event_end':
      return (
        <SegmentedChoice
          label="Event"
          name="eventId"
          choices={choices.events}
          empty="No carried events can end this week."
          {...segmented}
        />
      );
  }
}
