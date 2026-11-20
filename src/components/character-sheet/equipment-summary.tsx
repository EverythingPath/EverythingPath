'use client';
import type { ReactNode } from 'react';
import {
  describeArmorCheckPenalty,
  describeMaxDexterity,
  describeSpellFailure,
  formatPercent,
  formatSigned,
} from './equipment-statistics';
import { fieldLabel } from './sheet-parts';
import { SheetStatistic } from './sheet-statistic';
import type { useCharacterSheet } from './use-character-sheet';

type Totals = NonNullable<
  ReturnType<typeof useCharacterSheet>['equipment']['totals']
>;

function SummaryFigure({
  term,
  children,
}: {
  term: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className={fieldLabel}>{term}</dt>
      <dd className="text-lg">{children}</dd>
    </div>
  );
}

/**
 * What everything equipped adds up to, as the resolver states it: the armor
 * check penalty (already inside the skill totals), arcane spell failure, and
 * the lowest maximum Dexterity bonus, which caps AC but not CMD. Each opens
 * its items.
 */
export function EquipmentSummary({ totals }: { totals: Totals }) {
  const maxDexterity = describeMaxDexterity(totals);
  return (
    <dl className="border-foreground/15 grid grid-cols-1 gap-x-3 gap-y-2 border-b pb-2 sm:grid-cols-3">
      <SummaryFigure term="Armor check penalty">
        <SheetStatistic
          label="Armor check penalty"
          statistic={describeArmorCheckPenalty(totals)}
          format={(total) => (total === 0 ? '0' : formatSigned(total))}
          formatContribution={formatSigned}
        />
      </SummaryFigure>
      <SummaryFigure term="Arcane spell failure">
        <SheetStatistic
          label="Arcane spell failure"
          statistic={describeSpellFailure(totals)}
          format={formatPercent}
          formatContribution={formatPercent}
        />
      </SummaryFigure>
      <SummaryFigure term="Maximum Dexterity bonus to AC">
        {maxDexterity ? (
          <SheetStatistic
            label="Maximum Dexterity bonus to AC"
            statistic={maxDexterity}
            format={formatSigned}
            formatContribution={formatSigned}
          />
        ) : (
          <span className="inline-flex min-h-8 items-center px-1 font-mono">
            No limit
          </span>
        )}
      </SummaryFigure>
    </dl>
  );
}
