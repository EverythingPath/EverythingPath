'use client';
import type { ResolvedStatistic } from '~/lib/character-sheet';
import type { CharacterSheetBreakdownTarget } from '~/lib/character-sheet-breakdowns';
import { useBreakdownResolver } from './breakdown-resolver';
import { buildSituationBreakdownView } from './situations-view-model';
import { useUnresolvedReason } from './unresolved-statistics';

export type SituationBreakdownView = ReturnType<
  typeof buildSituationBreakdownView
>;
export type SituationBreakdownGroup = SituationBreakdownView['groups'][number];

/**
 * One sheet number in every Situation that touches it, and in the picked
 * combination, each freshly resolved. A number with no sheet statistic
 * behind it (a summary) has none.
 */
export function useSituationBreakdown(
  statistic: ResolvedStatistic,
  target: CharacterSheetBreakdownTarget | undefined,
) {
  const resolver = useBreakdownResolver();
  const unresolvedReason = useUnresolvedReason(target);
  if (target === undefined) return null;
  return buildSituationBreakdownView({
    ordinary: statistic,
    target,
    previewSituation:
      unresolvedReason === null ? resolver.previewSituation : () => null,
    selected: resolver.selected.selections,
    findPrerequisiteName: resolver.findPrerequisiteName,
  });
}
