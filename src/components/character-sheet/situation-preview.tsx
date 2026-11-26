'use client';
import { BreakdownLine, contributionKey } from './breakdown-line';
import { BreakdownNotes } from './breakdown-notes';
import { useBreakdownResolver } from './breakdown-resolver';
import { SituationChoiceLabel } from './situation-choice-label';
import { SituationDiceLines, type SituationDice } from './situation-dice-lines';
import { SituationMarker } from './situation-marker';
import { describePrerequisite } from './stat-breakdown-groups';
import { SuppressedLines } from './suppressed-lines';
import type { SituationBreakdownGroup } from './use-situation-breakdown';

export const previewUnavailableText = 'Situation preview is unavailable.';

/**
 * "Only when vs. spells": what the number becomes there, with what newly
 * applies, what that sets aside, its rules, and, dimmed, what still waits on
 * a prerequisite even then. A Situation that changes no number, such as
 * one with only rules, shows no total.
 */
export function SituationPreview({
  group,
  format,
  formatContribution,
  dice,
}: {
  group: SituationBreakdownGroup;
  format: (total: number) => string;
  formatContribution?: (value: number) => string;
  /** Item Ability dice that join the number in this Situation. */
  dice?: readonly SituationDice[];
}) {
  const resolver = useBreakdownResolver();
  const { change, statistic } = group;
  const total = change?.total ?? null;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-1.5 text-sky-300">
          <SituationMarker
            isDecorative
            className="relative top-0 shrink-0 self-center"
          />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            <SituationChoiceLabel
              group={group}
              findPrerequisiteName={resolver.findPrerequisiteName}
            />
          </span>
        </span>
        {total !== null ? (
          <span className="shrink-0 font-mono">
            <span className="text-muted-foreground text-xs">becomes </span>
            <span className="text-lg">{format(total)}</span>
          </span>
        ) : null}
      </div>
      {change && statistic ? (
        <ul className="space-y-0.5 pl-3">
          {change.applied.map((item, index) => (
            <BreakdownLine
              key={contributionKey(item, index)}
              contribution={item}
              format={formatContribution}
            />
          ))}
          <SuppressedLines
            items={change.suppressed}
            statistic={statistic}
            format={formatContribution}
          />
          {change.waiting.map((item, index) => (
            <BreakdownLine
              key={contributionKey(item, index)}
              contribution={item}
              className="text-muted-foreground/70"
              format={formatContribution}
              detail={`${describePrerequisite(item, resolver.findPrerequisiteName, resolver.findCastingClassName)} — not now`}
            />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground pl-3 text-xs">
          {previewUnavailableText}
        </p>
      )}
      <SituationDiceLines dice={dice} />
      <BreakdownNotes notes={group.notes} className="pl-3 text-xs" />
    </li>
  );
}
