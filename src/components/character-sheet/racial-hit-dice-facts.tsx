'use client';
import type { RaceStatisticsView } from './character-sheet-races-view-model';
import { fieldLabel } from './sheet-parts';

/**
 * Character level, actual Hit Dice and the feat budget side by side, as the
 * sheet calculates them from what is saved: racial Hit Dice add to Hit Dice
 * and the feats they earn, never to character level.
 */
export function RacialHitDiceFacts({
  statistics,
}: {
  statistics: Pick<
    RaceStatisticsView,
    'characterLevel' | 'actualHitDice' | 'featBudget'
  >;
}) {
  const facts = [
    { label: 'Character level', value: statistics.characterLevel },
    { label: 'Hit Dice', value: statistics.actualHitDice },
    { label: 'Feat budget', value: statistics.featBudget },
  ];
  return (
    <div className="flex flex-col gap-1">
      <dl className="flex flex-wrap gap-x-5 gap-y-1">
        {facts.map((fact) => (
          <div key={fact.label} className="flex flex-col">
            <dt className={fieldLabel}>{fact.label}</dt>
            <dd className="font-mono text-base leading-tight tabular-nums">
              {fact.value ?? 'Unresolved'}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-muted-foreground text-xs">
        Racial Hit Dice count toward Hit Dice, not character level. The feat
        budget is one feat at the first Hit Die and one at each odd Hit Die
        after it.
      </p>
    </div>
  );
}
