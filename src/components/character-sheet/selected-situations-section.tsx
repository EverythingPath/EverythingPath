'use client';
import { cn } from '~/lib/utils';
import { useBreakdownResolver } from './breakdown-resolver';
import { fieldLabel } from './sheet-parts';
import { SituationExplanation } from './situation-explanation';
import { previewUnavailableText } from './situation-preview';
import type { SituationBreakdownView } from './use-situation-breakdown';

/**
 * The Situations picked for the sheet, together: the one total they give
 * this number, resolved with all of them at once, with its explanation. A
 * combination that leaves the number as it is says so, and still lists
 * the rules it brings.
 */
export function SelectedSituationsSection({
  selected,
  format,
  formatContribution,
}: {
  selected: SituationBreakdownView['selected'];
  format: (total: number) => string;
  formatContribution?: (value: number) => string;
}) {
  const resolver = useBreakdownResolver();
  if (resolver.selected.selections.length === 0) return null;
  return (
    <div className="border-foreground/15 mt-2 border-t pt-2">
      <p className={cn(fieldLabel, 'mb-1')}>Selected Situations</p>
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 [overflow-wrap:anywhere] text-sky-300">
          {resolver.selected.text}
        </span>
        {selected?.changed ? (
          <span className="shrink-0 font-mono">
            <span className="text-muted-foreground text-xs">becomes </span>
            <span className="text-lg">{format(selected.statistic.total)}</span>
          </span>
        ) : null}
      </div>
      {selected ? (
        <>
          {selected.changed ? null : (
            <p className="text-muted-foreground text-xs">
              They don&apos;t change this number.
            </p>
          )}
          <div className="pl-3">
            <SituationExplanation
              statistic={selected.statistic}
              waiting={selected.waiting}
              notes={selected.notes.filter(
                (note) =>
                  (note.situation ?? note.condition?.situation) !== undefined,
              )}
              formatContribution={formatContribution}
              hasContributions={selected.changed}
            />
          </div>
        </>
      ) : (
        <p className="text-muted-foreground text-xs">
          {previewUnavailableText}
        </p>
      )}
    </div>
  );
}
