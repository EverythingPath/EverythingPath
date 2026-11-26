'use client';
import { useId } from 'react';
import { cn } from '~/lib/utils';

// As in `StatRow`: the row's rule runs under its label; the value sits on
// that edge and covers its stretch of the rule with its own dotted underline.
const onRule = 'bg-card -mb-px self-end';

/**
 * A Defenses line whose number is a rule value, not a Modifier total, so it
 * has no breakdown (GLOSSARY: Rule value): as `StatRow`, the body-font label
 * and the value together on the row's solid rule, the value with its dotted
 * underline; the lines it comes from are listed beneath that rule.
 */
export function RuleValueRow({
  label,
  value,
  lines,
}: {
  label: string;
  value: string;
  /** Each line it comes from, keyed by its entry and rule value. */
  lines: readonly { key: string; text: string }[];
}) {
  const labelId = useId();
  return (
    <li className="pt-1">
      <div role="group" aria-labelledby={labelId}>
        <div className="border-foreground/15 flex items-end gap-3 border-b">
          <span
            id={labelId}
            className="min-w-0 flex-1 pb-1.5 text-sm leading-tight"
          >
            {label}
          </span>
          <span
            className={cn(
              onRule,
              'border-foreground/40 inline-flex min-h-8 min-w-12 items-center justify-end border-b border-dotted px-1 font-mono text-xl leading-none',
            )}
          >
            {value}
          </span>
        </div>
        <ul className="text-muted-foreground pt-1 pb-1.5 text-xs [overflow-wrap:anywhere]">
          {lines.map((line) => (
            <li key={line.key}>{line.text}</li>
          ))}
        </ul>
      </div>
    </li>
  );
}
