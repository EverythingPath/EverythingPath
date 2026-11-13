'use client';
import { spellcastingBreakdownTarget } from '~/lib/character-sheet-breakdowns';
import { cn } from '~/lib/utils';
import {
  casterLevelDependencies,
  concentrationDependencies,
  describeChoiceWait,
  perDayDependencies,
} from './archetype-casting-view-model';
import { formatModifier } from './sheet-parts';
import { SheetStatistic } from './sheet-statistic';
import type { useCharacterSheet } from './use-character-sheet';

// Small pieces the sheet's Spellcasting section and the Spells page share:
// the casting row type, spell level names, the explained dash and the
// per-day figure.

type Sheet = NonNullable<ReturnType<typeof useCharacterSheet>['sheet']>;
export type Spellcasting = Sheet['calculated']['spellcastings'][number];
export type SpellcastingSlot = Spellcasting['slots'][number] & {
  extra?: number;
};

const unresolvedNames: Record<string, string> = {
  casterLevel: 'caster level',
  concentration: 'concentration',
  spellDC: 'save DC',
  casting: 'casting',
  castingLevel: 'casting level',
  // #422: casting properties an Archetype choice still decides.
  presence: 'spellcasting choice',
  table: 'casting table',
  recording: 'preparation and recording',
  casterLevelOffset: 'caster level choice',
  spellKind: 'spell kind',
  spellList: 'spell list',
  grantedSpells: 'Granted Spells',
  extraSlots: 'extra slots',
  ability: 'casting ability',
};

/** "0", "1st", "2nd", "3rd", "4th"… "11th", "21st": a spell level as the class tables print it. */
export function formatSpellLevel(level: number) {
  if (level === 0) return '0';
  const lastTwo = level % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${level}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[level % 10] ?? 'th';
  return `${level}${suffix}`;
}

/** "0-level", "1st-level": the heading of one spell level's Spells. */
export const formatSpellLevelHeading = (level: number) =>
  `${formatSpellLevel(level)}-level`;

/**
 * The witch's familiar recording model keeps its Spells on the witch (#326);
 * other collections need no note.
 */
export function describeCollectionNote(
  casting: Pick<Spellcasting, 'record' | 'bookType'> | null | undefined,
) {
  return casting?.record === 'book' && casting.bookType === 'familiar'
    ? 'Witch Spells stay with the witch through familiar replacement and restoration.'
    : null;
}

export { capitalize } from '~/lib/character-sheet-casting-copy';

/** A number the sheet cannot state, with its reason for a screen reader. */
export function Dash({ reason }: { reason: string }) {
  return (
    <span className="text-muted-foreground font-mono">
      <span aria-hidden>—</span>
      <span className="sr-only">{reason}</span>
    </span>
  );
}

// "Not complete: caster level, save DC." The resolver names what it could
// not settle; the sheet never guesses a number in its place.
export function describeUnresolved(unresolved: readonly string[]) {
  if (unresolved.length === 0) return null;
  const names = unresolved.map(
    (key) => unresolvedNames[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2'),
  );
  return `Not complete: ${names.join(', ')}.`;
}

const isAtWill = (casting: Spellcasting, slot: SpellcastingSlot) =>
  slot.spellLevel === 0 && casting.cantrips;

/** Why a per-day total waits, when an Archetype choice decides it (#422). */
export function describePerDayWait(casting: Pick<Spellcasting, 'unresolved'>) {
  return describeChoiceWait(casting.unresolved, perDayDependencies);
}

/** A value an open Archetype choice still decides: its reason, in words. */
export function WaitingValue({
  reason,
  className,
}: {
  reason: string;
  className?: string;
}) {
  return (
    <span className={cn('text-muted-foreground text-xs', className)}>
      {reason}
    </span>
  );
}

/**
 * One per-day figure: at will, the total, or a dash the sheet can explain.
 * A total an Archetype choice decides shows its reason instead, in full
 * (`isReasonShown`) or for the screen reader where a line states it once.
 */
export function PerDay({
  casting,
  slot,
  className,
  isReasonShown = false,
}: {
  casting: Spellcasting;
  slot: SpellcastingSlot;
  className?: string;
  isReasonShown?: boolean;
}) {
  if (isAtWill(casting, slot))
    return <span className={cn('font-mono', className)}>At will</span>;
  if (slot.total === null) {
    const wait = describePerDayWait(casting);
    if (wait && isReasonShown) return <WaitingValue reason={wait} />;
    return <Dash reason={wait ?? 'Not available'} />;
  }
  return <span className={cn('font-mono', className)}>{slot.total}</span>;
}

/**
 * Caster level or concentration: its breakdown, a dash while there is none,
 * or the Archetype choice it waits for (#422).
 */
export function CastingFigure({
  casting,
  kind,
  className,
}: {
  casting: Spellcasting;
  kind: 'casterLevel' | 'concentration';
  className?: string;
}) {
  const statistic = casting[kind];
  const label =
    kind === 'casterLevel'
      ? `${casting.name} caster level`
      : `${casting.name} concentration`;
  if (!statistic) {
    const wait = describeChoiceWait(
      casting.unresolved,
      kind === 'casterLevel'
        ? casterLevelDependencies
        : concentrationDependencies,
    );
    if (wait) return <WaitingValue reason={wait} />;
    return (
      <Dash
        reason={
          kind === 'casterLevel'
            ? 'Caster level not available'
            : 'Concentration not available'
        }
      />
    );
  }
  const target = spellcastingBreakdownTarget(casting.classEntryId, { kind });
  const format = kind === 'concentration' ? formatModifier : String;
  const incompleteReason = casting.unresolved.includes(kind)
    ? describeUnresolved([kind])
    : null;
  return (
    <>
      <SheetStatistic
        label={label}
        statistic={statistic}
        target={target}
        format={format}
        incompleteReason={incompleteReason}
        className={className}
        alternates={{}}
      />
    </>
  );
}
