import { Fragment } from 'react';
import type { DailyMaximum, FeatureNumber } from '~/lib/character-sheet';
import { cn } from '~/lib/utils';
import { formatSigned } from './equipment-statistics';
import { featureNumberChips, notCountedChip } from './feature-number-chips';
import { chip, unresolvedValue } from './sheet-parts';

const mutedChip = cn(chip, 'text-muted-foreground');

/**
 * An entry's rule-value chips beside its name, on every kind of row that can
 * carry them: a Grant row (`grant-entry-row.tsx`: class features, granted
 * feats and traits, racial traits, and any other granted entry), a saved
 * feat or trait (`selection-row.tsx`), the selected race
 * (`race-rule-values.tsx`), a selected Archetype (`archetype-card.tsx`), an
 * item, a Spell Effect or a Condition (`character-sheet-entries.tsx`) and a
 * personal adjustment (`personal-adjustments.tsx`), each kind checked by
 * `rule-value-row-coverage.test.tsx` (rotation-6 fix r2). First its dice,
 * then its per-day maxima, each with the increases not counted beside it.
 */
export function RuleValueChips({
  featureNumbers = [],
  dailyMaxima = [],
}: {
  featureNumbers?: readonly FeatureNumber[];
  dailyMaxima?: readonly DailyMaximum[];
}) {
  return (
    <>
      <FeatureNumberChips numbers={featureNumbers} />
      <DailyMaximumChips maxima={dailyMaxima} />
    </>
  );
}

/**
 * The entry's dice, such as Channel Energy's 3d6, each dice increase its own
 * chip beside the total (`featureNumberChips`); unresolved dice muted.
 */
function FeatureNumberChips({
  numbers,
}: {
  numbers: readonly FeatureNumber[];
}) {
  return numbers.map((number) => {
    const { dice, increases } = featureNumberChips(number);
    return (
      <Fragment key={`${number.entryId}:${number.ruleValueIndex}`}>
        <span className={number.count === null ? mutedChip : chip}>{dice}</span>
        {/* One increase per entry and key: an entry repeats none. */}
        {increases.map(({ entryId, text }) => (
          <span key={entryId} className={mutedChip}>
            {text}
          </span>
        ))}
        <NotCountedChips lines={number.notCounted} />
      </Fragment>
    );
  });
}

/**
 * Each increase not counted on a maximum or dice (rotation-6), a muted
 * chip beside it saying why (`notCountedChip`). One entry may give two lines
 * on one maximum (two increases of its key), so each chip is keyed by its
 * line's entry and reason and, for a repeated one, which repeat it is,
 * within its maximum's or dice's own fragment (rotation-6 fix r1).
 */
function NotCountedChips({
  lines = [],
}: {
  lines?: DailyMaximum['notCounted'];
}) {
  const repeats = new Map<string, number>();
  return lines.map((line) => {
    const base = `${line.entryId}:${line.reason}`;
    const repeat = repeats.get(base) ?? 0;
    repeats.set(base, repeat + 1);
    return (
      <span key={`${base}:${repeat}`} className={mutedChip}>
        {notCountedChip(line)}
      </span>
    );
  });
}

/**
 * The entry's per-day maxima, such as 5/day or 12 rounds/day: the maximum
 * only (owner 2026-11-17), nothing to tally uses with. A total floored at 0
 * (rotation-5) says so in a muted chip beside it, with the sum it came to.
 */
function DailyMaximumChips({ maxima }: { maxima: readonly DailyMaximum[] }) {
  return maxima.map((maximum) => {
    const value = maximum.value ?? unresolvedValue;
    const key = `${maximum.entryId}:${maximum.ruleValueIndex}`;
    return (
      <Fragment key={key}>
        <span className={maximum.value === null ? mutedChip : chip}>
          {maximum.unit === 'uses'
            ? `${value}/day`
            : `${value} ${maximum.unit}/day`}
        </span>
        {maximum.floor ? (
          <span className={mutedChip}>
            {`Floored at 0 (sum ${formatSigned(maximum.floor.sum)})`}
          </span>
        ) : null}
        <NotCountedChips lines={maximum.notCounted} />
      </Fragment>
    );
  });
}
