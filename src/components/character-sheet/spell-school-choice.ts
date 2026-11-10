const schoolLabels: Record<string, { label: string; abbreviation: string }> = {
  abj: { label: 'Abjuration', abbreviation: 'Abj' },
  con: { label: 'Conjuration', abbreviation: 'Conj' },
  div: { label: 'Divination', abbreviation: 'Div' },
  enc: { label: 'Enchantment', abbreviation: 'Ench' },
  evo: { label: 'Evocation', abbreviation: 'Evoc' },
  ill: { label: 'Illusion', abbreviation: 'Illus' },
  nec: { label: 'Necromancy', abbreviation: 'Necro' },
  trs: { label: 'Transmutation', abbreviation: 'Trans' },
  uni: { label: 'Universal', abbreviation: 'Univ' },
};

export type SchoolChoice<Value extends string = string> = {
  value: Value;
  label: string;
  abbreviation: string;
};

/**
 * A school as the browser shows it: its full name and short form for narrow
 * rows. The value keeps its type, so a `SpellSchoolKey` stays one.
 */
export function schoolChoice<Value extends string>(
  value: Value,
): SchoolChoice<Value> {
  const names = schoolLabels[value] ??
    Object.values(schoolLabels).find(
      ({ label }) => label.toLowerCase() === value.toLowerCase(),
    ) ?? { label: value, abbreviation: value };
  return { value, ...names };
}
