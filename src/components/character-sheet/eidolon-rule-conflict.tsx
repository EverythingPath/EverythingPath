'use client';
import { TriangleAlert } from 'lucide-react';
import { cn } from '~/lib/utils';
import type { EidolonProgressionView } from './character-eidolon-progression-view-model';
import { chip } from './sheet-parts';

type RuleConflict = NonNullable<
  EidolonProgressionView['ordinary']['ruleConflict']
>;

/**
 * Competing progression rules on one summoner (#420), such as Broodmaster
 * and Master Summoner: amber and advisory, with nothing to accept away,
 * because no published rule decides between them. The sheet's own warning
 * beneath says what is kept meanwhile.
 */
export function EidolonRuleConflict({ conflict }: { conflict: RuleConflict }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-start gap-1.5 text-xs text-amber-300">
        <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
        <span className="min-w-0 [overflow-wrap:anywhere]">
          {conflict.summary}
        </span>
      </p>
      {conflict.labels.length ? (
        <ul aria-label="Competing rules" className="flex flex-wrap gap-1 pl-5">
          {conflict.labels.map((label) => (
            <li
              key={label}
              className={cn(chip, 'border-amber-500/60 text-amber-300')}
            >
              {label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
