import type { SpellEffectView } from './spell-effect-target-chips';
import type { SheetWarningView } from './use-character-sheet';

/** A Spell Effect's target as the calculation reports it. */
export type SpellEffectTargetView = NonNullable<SpellEffectView['target']>;

export const unavailableText = 'No longer on the sheet';

// What the field waits for, by what the effect enhances (data model,
// "Spells on an item").
export const missingText: Record<SpellEffectTargetView['itemTarget'], string> =
  {
    weapon: 'Choose the weapon it enhances; until then it adds nothing.',
    natural:
      'Choose the natural weapon or unarmed strike it enhances; until then it adds nothing.',
    armorOrShield:
      'Choose the armor or shield it enhances; until then it adds nothing.',
  };

const targetChecks = new Set<SheetWarningView['check']>([
  'spellEffectTargetUnavailable',
  'spellEffectTargetUnsuitable',
]);

/** The target advisories about one Spell Effect row. */
export function listSpellEffectTargetWarnings(
  warnings: SheetWarningView[],
  entryId: string,
) {
  return warnings.filter(
    ({ check, target }) =>
      targetChecks.has(check) &&
      target.kind === 'entry' &&
      target.entryId === entryId,
  );
}

/** What the field reads for the recorded target. */
export function describeTarget(target: SpellEffectTargetView) {
  if (target.status === 'unavailable') return unavailableText;
  if (target.status === 'missing' || target.name === null) return 'No target';
  return target.status === 'inactive'
    ? `${target.name} · not equipped`
    : target.name;
}
