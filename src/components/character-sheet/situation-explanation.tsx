'use client';
import type {
  ResolvedStatistic,
  SourcedModifier,
  SourcedSituationalNote,
} from '~/lib/character-sheet';
import { cn } from '~/lib/utils';
import { BreakdownContributions } from './breakdown-contributions';
import { BreakdownLine, contributionKey } from './breakdown-line';
import { BreakdownNotes } from './breakdown-notes';
import { useBreakdownResolver } from './breakdown-resolver';
import { fieldLabel } from './sheet-parts';
import { describePrerequisite } from './stat-breakdown-groups';

/**
 * A number in a Situation or a picked combination, resolved afresh: every
 * contribution that applies there, what stacking sets aside there, what
 * still waits on another entry, and the rules that hold there.
 */
export function SituationExplanation({
  statistic,
  waiting,
  notes,
  formatContribution,
  hasContributions = true,
}: {
  statistic: ResolvedStatistic;
  waiting: readonly SourcedModifier[];
  notes: readonly SourcedSituationalNote[];
  formatContribution?: (value: number) => string;
  /** Off where the number is unchanged and its lines are already shown. */
  hasContributions?: boolean;
}) {
  const resolver = useBreakdownResolver();
  return (
    <>
      {hasContributions ? (
        <BreakdownContributions
          statistic={statistic}
          formatContribution={formatContribution}
        />
      ) : null}
      {waiting.length > 0 ? (
        <>
          <p className={cn(fieldLabel, 'mt-2')}>Waiting</p>
          <ul className="space-y-0.5">
            {waiting.map((item, index) => (
              <BreakdownLine
                key={contributionKey(item, index)}
                contribution={item}
                className="text-muted-foreground/70"
                format={formatContribution}
                detail={describePrerequisite(
                  item,
                  resolver.findPrerequisiteName,
                  resolver.findCastingClassName,
                )}
              />
            ))}
          </ul>
        </>
      ) : null}
      {notes.length > 0 ? (
        <>
          <p className={cn(fieldLabel, 'mt-2')}>Rules</p>
          <BreakdownNotes notes={notes} hasSituation className="text-xs" />
        </>
      ) : null}
    </>
  );
}
