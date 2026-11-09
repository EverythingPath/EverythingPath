'use client';
import type { ItemPart } from '~/lib/character-sheet-attack-types';
import { cn } from '~/lib/utils';
import { focusEntryRow } from './sheet-catalog-context';
import { chip } from './sheet-parts';
import type { CharacterSheetSnapshot } from './use-character-sheet';

/** One Spell Effect as the calculation reports it (#416). */
export type SpellEffectView =
  CharacterSheetSnapshot['calculated']['spellEffects'][number];

/** The active Spell Effects whose recorded target is this item part. */
export function listSpellEffectsOn(
  spellEffects: readonly SpellEffectView[],
  entryId: string,
  part: ItemPart,
) {
  const end = part === 'primary' ? null : part;
  return spellEffects.filter(
    (effect) =>
      effect.active &&
      effect.target?.onItem?.entry === entryId &&
      (effect.target.onItem.end ?? null) === end,
  );
}

/**
 * A muted chip per active Spell Effect on an item part, "Magic weapon ·
 * CL 1", on the Gear row and in the routine panel's Weapon details (#416).
 * The numbers are already in the lines and the AC leaf; tapping a chip goes
 * to the effect's row, where its caster level and target are edited.
 * Nothing while no effect targets the part.
 */
export function SpellEffectTargetChips({
  spellEffects,
  entryId,
  part,
  className,
}: {
  spellEffects: readonly SpellEffectView[];
  entryId: string;
  part: ItemPart;
  className?: string;
}) {
  const effects = listSpellEffectsOn(spellEffects, entryId, part);
  if (effects.length === 0) return null;
  return (
    <ul
      aria-label="Spell Effects on this item"
      className={cn('flex flex-wrap items-center gap-1', className)}
    >
      {effects.map((effect) => (
        <li key={effect.entryId} className="flex">
          <button
            type="button"
            className={cn(
              chip,
              'text-muted-foreground hover:text-foreground hover:border-foreground min-h-11 md:min-h-0',
            )}
            onClick={() => focusEntryRow(effect.entryId)}
          >
            <span className="sr-only">Spell Effect </span>
            {effect.name} · CL {effect.casterLevel}
            <span className="sr-only">, go to its row</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
