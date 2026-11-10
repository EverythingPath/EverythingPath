import { expect } from 'vitest';
import { baseline } from './weapon-baseline';
import type { preparedItemWeapon } from '../../src/lib/catalog/imported-item';

type Weapon = Parameters<typeof preparedItemWeapon>[0]['weapon'];

/** Independent baseline expectations supersede historical mapper observations.
 * Other records retain their original bounded inventory checks.
 */
export function expectWeaponObservations({
  key,
  name,
  weapon,
  statistics,
  ability,
}: {
  key: string;
  name: string;
  weapon: Weapon;
  statistics: readonly { field: string; pinned: unknown; mapped: unknown }[];
  ability?: { critRange?: number | null; critMult?: number };
}) {
  const stat = (field: string) => statistics.find((row) => row.field === field);
  const expected = baseline.find((row) => row.key === key)?.expected.weapon;
  if (expected) expect(weapon, name).toEqual(expected);
  else {
    const canonical = 'baseType' in weapon;
    expect(
      (canonical ? stat('damage')?.pinned : stat('damage')?.mapped) ?? null,
      name,
    ).toBe(weapon.dice ?? null);
    const nativeThreat = ability?.critRange;
    const noCritical =
      canonical && (nativeThreat === null || nativeThreat === 0);
    const threat = noCritical
      ? undefined
      : canonical && !weapon.dice
        ? nativeThreat
        : stat('threat')?.mapped;
    expect(weapon.threat, name).toBe(threat);
    expect(weapon.mult, name).toBe(
      canonical && !weapon.dice
        ? ability?.critMult
        : stat('multiplier')?.mapped,
    );
    const nativeRange = stat('rangeIncrement')?.mapped;
    const hasIncrement =
      !canonical || weapon.attackType === 'ranged' || weapon.thrown;
    const range = canonical
      ? hasIncrement && typeof nativeRange === 'number' && nativeRange > 0
        ? nativeRange
        : undefined
      : (nativeRange ?? undefined);
    expect(
      canonical
        ? (weapon.rangeIncrement ?? weapon.thrownRangeIncrement)
        : weapon.rangeIncrement,
      name,
    ).toBe(range);
  }
  expect(stat('threat')?.pinned, name).toBe(ability?.critRange ?? 20);
  expect(stat('multiplier')?.pinned, name).toBe(ability?.critMult ?? 2);
}
