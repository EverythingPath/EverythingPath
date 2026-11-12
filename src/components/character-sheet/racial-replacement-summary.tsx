import type { RacialTraitOptionView } from './character-sheet-races-view-model';

/** The standards a selected alternate replaces, in words. */
export function RacialReplacementSummary({
  option,
}: {
  option: RacialTraitOptionView;
}) {
  if (option.replacementNames.length === 0) return null;
  return (
    <p className="text-muted-foreground text-xs [overflow-wrap:anywhere]">
      Replaces {option.replacementNames.join(', ')}
    </p>
  );
}
