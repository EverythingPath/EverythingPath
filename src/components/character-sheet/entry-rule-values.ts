import type { DailyMaximum, FeatureNumber } from '~/lib/character-sheet';

/** One entry's own dice and per-day maxima, each present only when it has one. */
export type EntryRuleValues = {
  featureNumbers?: readonly FeatureNumber[];
  dailyMaxima?: readonly DailyMaximum[];
};
/** An entry's own rule values, by its sheet entry ID. */
export type EntryRuleValueLookup = (entryId: string) => EntryRuleValues;

/**
 * The read's dice and per-day maxima grouped by entry once (rotation-6 fix
 * r2), so every view model that builds a row gives it the same numbers:
 * the grant rows, the saved feats and traits, each active race, the sheet
 * entries and the personal adjustments; `buildCharacterSheetView` builds it
 * once per sheet view and gives it to each (fix r3). Which row shows each kind is
 * checked kind by kind by `rule-value-row-coverage.test.tsx`.
 */
export function indexEntryRuleValues({
  featureNumbers,
  dailyMaxima,
}: {
  featureNumbers: readonly FeatureNumber[];
  dailyMaxima: readonly DailyMaximum[];
}): EntryRuleValueLookup {
  const byEntry = new Map<
    string,
    { featureNumbers: FeatureNumber[]; dailyMaxima: DailyMaximum[] }
  >();
  const valuesOf = (entryId: string) => {
    const known = byEntry.get(entryId);
    if (known) return known;
    const created = { featureNumbers: [], dailyMaxima: [] };
    byEntry.set(entryId, created);
    return created;
  };
  for (const number of featureNumbers)
    valuesOf(number.entryId).featureNumbers.push(number);
  for (const maximum of dailyMaxima)
    valuesOf(maximum.entryId).dailyMaxima.push(maximum);
  return (entryId) => {
    const values = byEntry.get(entryId);
    if (!values) return {};
    return {
      ...(values.featureNumbers.length
        ? { featureNumbers: values.featureNumbers }
        : {}),
      ...(values.dailyMaxima.length ? { dailyMaxima: values.dailyMaxima } : {}),
    };
  };
}
