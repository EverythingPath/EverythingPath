'use client';
import type { GrantEntryView } from './character-sheet-grants-view-model';
import { RuleValueChips } from './rule-value-chips';

/**
 * An active race's own dice and per-day maxima, each increase not counted
 * beside them (rotation-6 fix r2), under the race cards, named: "Elf 3/day".
 * The panel shows one per active race, the selected one first (fix r3).
 * Nothing while it has none.
 */
export function RaceRuleValues({ race }: { race: GrantEntryView }) {
  if (!race.featureNumbers && !race.dailyMaxima) return null;
  return (
    <div
      role="group"
      aria-label={race.name}
      className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
    >
      <span className="font-sans text-sm [overflow-wrap:anywhere]">
        {race.name}
      </span>
      <RuleValueChips
        featureNumbers={race.featureNumbers}
        dailyMaxima={race.dailyMaxima}
      />
    </div>
  );
}
