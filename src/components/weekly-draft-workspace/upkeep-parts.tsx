'use client';
import { Check, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
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
import { cn } from '~/lib/utils';
import type { RollFact, UpkeepIssue, UpkeepSectionStatus } from './types';
import { formatGold } from './week-frame/reference-copy';

// Pieces the numbered Upkeep sections share: the section frame, the bonus
// and result summary beside a roll, in-place issue notes and the reasoned
// decision editor. Everything here renders derived facts; nothing decides.

export const modifierLabels: Record<string, string> = {
  'rank-focus': 'Rank and focus',
  officers: 'Officers',
  helpful: 'Settlement support',
  overseer: 'Overseer',
};

export function signed(value: number) {
  return value < 0 ? `−${Math.abs(value)}` : `+${value}`;
}

export function signedGold(copper: number) {
  return `${copper < 0 ? '−' : '+'}${formatGold(Math.abs(copper))}`;
}

// A numbered Upkeep step. The header carries this step's own contribution or
// what it still waits for; an inapplicable step is only its reason.
export function Step({
  number,
  title,
  status,
  effect,
  anchor,
  children,
}: {
  number: number;
  title: string;
  status: UpkeepSectionStatus;
  effect: string;
  /** The DOM id a link from another phase brings into view and focus. */
  anchor?: string;
  children?: ReactNode;
}) {
  const inapplicable = status === 'inapplicable';
  return (
    <section
      aria-label={title}
      id={anchor}
      tabIndex={anchor ? -1 : undefined}
      className={cn(
        'focus-visible:ring-ring/50 rounded-sm border-l-2 pl-4 outline-none focus-visible:ring-[3px]',
        inapplicable ? 'border-border opacity-70' : 'border-foreground/20',
      )}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          aria-hidden
          className={cn(
            'bg-background flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-sm',
            status === 'resolved'
              ? 'border-emerald-500 text-emerald-500'
              : inapplicable
                ? 'border-border text-muted-foreground'
                : 'border-primary text-primary',
          )}
        >
          {status === 'resolved' ? (
            <Check className="size-4" />
          ) : inapplicable ? (
            <Minus className="size-3.5" />
          ) : (
            number
          )}
        </span>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-muted-foreground min-w-0 text-sm [overflow-wrap:anywhere] sm:ml-auto">
          {effect}
        </p>
      </header>
      {!inapplicable && children && (
        <div className="mt-3 space-y-4 pb-2">{children}</div>
      )}
    </section>
  );
}

export function IssueNotes({ issues }: { issues: UpkeepIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="space-y-1">
      {issues.map((issue) => (
        <li key={issue.code} role="note" className="text-sm text-amber-300">
          {issue.message}
        </li>
      ))}
    </ul>
  );
}

// "Loyalty DC 10 · bonus +1 = total 13", the modifier breakdown and the
// result, beside a roll field. Total and result stay blank until the roll is
// complete.
export function CheckSummary({
  dc,
  fact,
  result,
}: {
  dc: string | null;
  fact: Pick<RollFact, 'modifier' | 'total' | 'modifiers'>;
  result: string | null;
}) {
  return (
    <div className="min-w-0 space-y-1 text-sm">
      <p className="flex flex-wrap gap-x-3">
        {dc && <span className="text-muted-foreground">{dc}</span>}
        {fact.modifier !== null && (
          <span>
            bonus <strong className="font-mono">{signed(fact.modifier)}</strong>
            {fact.total !== null && (
              <>
                {' '}
                = total <strong className="font-mono">{fact.total}</strong>
              </>
            )}
          </span>
        )}
      </p>
      {fact.modifiers.length > 0 && (
        <p className="text-muted-foreground text-xs">
          {fact.modifiers
            .map(
              (modifier) =>
                `${modifierLabels[modifier.source] ?? 'Other rule modifier'} ${signed(modifier.value)}`,
            )
            .join(' · ')}
        </p>
      )}
      {result && <p>{result}</p>}
    </div>
  );
}

// A roll field and its summary side by side; they stack on a phone.
export function RollRow({
  field,
  summary,
}: {
  field: ReactNode;
  summary: ReactNode;
}) {
  return (
    <div className="grid items-start gap-x-6 gap-y-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
      {field}
      {summary}
    </div>
  );
}

// A free-text decision with its record and clear buttons. The labels default
// to a reasoned decision; a boon outcome editor names its own.
export function ReasonedDecision({
  label,
  current,
  disabled,
  onSave,
  onClear,
  submitLabel = 'Record decision',
  clearLabel = 'Clear decision',
  requiredMessage = 'A reason is required.',
}: {
  label: string;
  current: string;
  disabled: boolean;
  onSave: (reason: string) => void;
  onClear: () => void;
  submitLabel?: string;
  clearLabel?: string;
  requiredMessage?: string;
}) {
  const form = useForm({
    values: { reason: current },
    resolver: zodResolver(
      z.object({ reason: z.string().trim().min(1, requiredMessage) }),
    ),
  });
  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => onSave(values.reason))}
        className="space-y-2"
      >
        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{label}</FormLabel>
              <FormControl>
                <Input {...field} disabled={disabled} />
              </FormControl>
              <FormMessage role="alert" />
            </FormItem>
          )}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={disabled}>
            {submitLabel}
          </Button>
          {current && (
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={onClear}
            >
              {clearLabel}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
