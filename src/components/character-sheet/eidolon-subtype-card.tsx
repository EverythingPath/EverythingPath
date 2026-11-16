'use client';
import { useId } from 'react';
import { ordinal } from '~/lib/character-sheet-spell-labels';
import { cn } from '~/lib/utils';
import { chip, fieldLabel } from './sheet-parts';
import type { useCharacterCompanionProgression } from './use-character-companion-progression';

export type UnchainedSubtypeChoice = ReturnType<
  typeof useCharacterCompanionProgression
>['unchainedSubtypes'][number];

const note = 'text-muted-foreground text-xs [overflow-wrap:anywhere]';
// A playing card: lifts on hover, stays put for reduced motion.
const card =
  'border-foreground/40 bg-card focus-visible:ring-ring/50 flex min-h-11 w-full flex-col items-start gap-1.5 border p-3 text-left font-sans transition-all outline-none hover:-translate-y-0.5 hover:border-foreground focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:hover:translate-y-0 md:min-h-9';

/**
 * One Unchained subtype as a choosable card: its name and alignment, the
 * base forms it allows with the free evolutions each brings, and the
 * evolutions it grants by summoner level.
 */
export function EidolonSubtypeCard({
  subtype,
  isDisabled,
  reasonId,
  onChoose,
}: {
  subtype: UnchainedSubtypeChoice;
  isDisabled: boolean;
  reasonId: string | undefined;
  onChoose: () => void;
}) {
  const id = useId();
  const facts = [
    {
      label: 'Base forms',
      value: subtype.baseForms
        .map((form) => `${form.label}: ${form.freeEvolutions.join(', ')}`)
        .join(' · '),
    },
    {
      label: 'Evolutions',
      value: subtype.evolutionsByLevel
        .map(({ level, names }) => `${ordinal(level)}: ${names.join(', ')}`)
        .join(' · '),
    },
  ];
  return (
    <button
      type="button"
      aria-labelledby={`${id}-name`}
      aria-describedby={cn(`${id}-alignment`, `${id}-facts`, reasonId)}
      disabled={isDisabled}
      onClick={onChoose}
      className={card}
    >
      <span className="flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span id={`${id}-name`} className="text-base leading-tight">
          {subtype.label}
        </span>
        <span id={`${id}-alignment`} className={chip}>
          {subtype.alignment}
        </span>
      </span>
      <dl id={`${id}-facts`} className="flex flex-col gap-0.5">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="flex flex-col items-baseline gap-x-1.5 gap-y-0"
          >
            <dt className={fieldLabel}>{fact.label}</dt>
            <dd className={note}>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </button>
  );
}
