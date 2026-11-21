'use client';
import { useId } from 'react';
import { cn } from '~/lib/utils';
import type { CompanionProgressionView } from './character-companion-progression-view-model';
import { chip, fieldLabel, formatModifier } from './sheet-parts';

type Projection = CompanionProgressionView['ordinary'];
export type Fact = {
  label: string;
  value: number | null;
  /** The engine's name for this total in `unresolvedStatistics`. */
  statistic?: string;
  isSigned?: boolean;
};

/** A number the sheet supplies, or Unresolved; never 0 in place of null. */
function FactValue({
  fact,
  unresolvedStatistics,
}: {
  fact: Fact;
  unresolvedStatistics: readonly string[];
}) {
  const labelId = useId();
  const value =
    fact.statistic && unresolvedStatistics.includes(fact.statistic)
      ? null
      : fact.value;
  return (
    <div className="flex min-w-0 flex-col">
      <dt id={labelId} className={fieldLabel}>
        {fact.label}
      </dt>
      <dd
        aria-labelledby={labelId}
        className={cn(
          'font-mono text-base leading-tight tabular-nums',
          value === null && 'text-muted-foreground text-sm',
        )}
      >
        {value === null
          ? 'Unresolved'
          : fact.isSigned
            ? formatModifier(value)
            : value}
      </dd>
    </div>
  );
}

/** One labelled row of facts, shared with the eidolon's facts (#409). */
export function FactList({
  facts,
  unresolvedStatistics = [],
  label,
}: {
  facts: Fact[];
  /** The engine's names for totals it cannot resolve. */
  unresolvedStatistics?: readonly string[];
  label: string;
}) {
  return (
    <dl
      aria-label={label}
      className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4"
    >
      {facts.map((fact) => (
        <FactValue
          key={fact.label}
          fact={fact}
          unresolvedStatistics={unresolvedStatistics}
        />
      ))}
    </dl>
  );
}

/**
 * The Companion's numbers as the sheet calculates them for the chosen
 * projection: its progression, actual Hit Dice and own Class Levels kept
 * apart, the totals they give, then the budgets and what it has learned.
 */
export function CompanionProgressionFacts({
  projection,
}: {
  projection: Projection;
}) {
  return (
    <div className="flex flex-col gap-3">
      <FactList
        label="Progression"
        unresolvedStatistics={projection.unresolvedStatistics}
        facts={[
          {
            label: 'Effective progression level',
            value: projection.effectiveLevel,
          },
          {
            label: 'Actual Hit Dice',
            value: projection.actualHitDice,
            statistic: 'actualHitDice',
          },
          { label: 'Class Levels', value: projection.classLevels },
          {
            label: 'Maximum HP',
            value: projection.hp,
            statistic: 'maximumHp',
          },
        ]}
      />
      <p className="text-muted-foreground text-xs">
        The effective progression level comes from the granting sources below.
        It sets Hit Dice and budgets and is never counted as Class Levels.
      </p>
      <FactList
        label="Base results"
        unresolvedStatistics={projection.unresolvedStatistics}
        facts={[
          {
            label: 'Base attack bonus',
            value: projection.bab,
            statistic: 'baseAttackBonus',
            isSigned: true,
          },
          {
            label: 'Fortitude',
            value: projection.saves.fortitude,
            statistic: 'save.fort',
            isSigned: true,
          },
          {
            label: 'Reflex',
            value: projection.saves.reflex,
            statistic: 'save.ref',
            isSigned: true,
          },
          {
            label: 'Will',
            value: projection.saves.will,
            statistic: 'save.will',
            isSigned: true,
          },
        ]}
      />
      <FactList
        label="Budgets"
        unresolvedStatistics={projection.unresolvedStatistics}
        facts={[
          { label: 'General feats', value: projection.budgets.generalFeats },
          { label: 'Skill ranks', value: projection.budgets.skillRanks },
          {
            label: 'Ability increases',
            value: projection.budgets.abilityIncreases,
          },
          { label: 'Bonus tricks', value: projection.bonusTricks },
        ]}
      />
      <div className="flex flex-col gap-1">
        <span className={fieldLabel}>Features</span>
        {projection.features.length > 0 ? (
          <ul aria-label="Features" className="flex flex-wrap gap-1">
            {projection.features.map((feature) => (
              <li key={feature} className={chip}>
                {feature}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            {projection.effectiveLevel === null ? 'Unresolved' : 'None'}
          </p>
        )}
      </div>
    </div>
  );
}
