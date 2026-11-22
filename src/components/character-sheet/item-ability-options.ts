import type { Id } from '@convex/_generated/dataModel';
import type { ItemPart } from '~/lib/character-sheet-attack-types';
import {
  itemAbilitySuits,
  type ItemPartKind,
} from '~/lib/character-sheet-items';
import type { CatalogDefinition } from './sheet-catalog-context';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import type { EquipmentEditInput } from './use-character-sheet-equipment';

// The item editor's view of one Gear item: its parts as the resolver states
// them, and the Item Abilities the catalog offers each.

export type ItemPartsView =
  CharacterSheetSnapshot['calculated']['itemParts'][number];
export type ItemPartView = ItemPartsView['parts'][number];
export type ItemAbilityView = ItemPartView['abilities'][number];
/** One reference as the writer takes it: the ability and bane's foe. */
export type ItemAbilityInput = NonNullable<
  EquipmentEditInput['abilities']
>[number];

export type ItemAbilityOption = {
  catalogEntryId: Id<'catalogEntry'>;
  name: string;
  bonusEquivalent: number;
  description: string | null;
  requiresChoice: 'creatureType' | null;
};

/**
 * The Item Abilities a part of this kind can carry, by name. A convenience
 * for the picker, never a rule: an unsuitable ability already on the item
 * stays listed with its advisory.
 */
export function listItemAbilityOptions(
  catalogEntries: readonly CatalogDefinition[],
  kind: ItemPartKind,
): ItemAbilityOption[] {
  return catalogEntries
    .flatMap((entry) =>
      entry.detail.kind === 'itemAbility' &&
      itemAbilitySuits(entry.detail.appliesTo, kind)
        ? [
            {
              catalogEntryId: entry._id,
              name: entry.name,
              bonusEquivalent: entry.detail.bonusEquivalent,
              description: entry.description ?? null,
              requiresChoice: entry.detail.choice ?? null,
            },
          ]
        : [],
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** One item part as the resolver states it, or null while unknown. */
export function findItemPart(
  items: readonly ItemPartsView[] | undefined,
  entryId: string,
  part: ItemPart,
): ItemPartView | null {
  return (
    items
      ?.find((item) => item.entryId === entryId)
      ?.parts.find((candidate) => candidate.part === part) ?? null
  );
}

/** "+1", "+2"; nothing for a flat-priced ability. */
export function describeBonusEquivalent(bonusEquivalent: number) {
  return bonusEquivalent > 0 ? `+${bonusEquivalent}` : null;
}

/** The references the writer takes: the whole list, choices only where made. */
export function toItemAbilityInputs(
  abilities: readonly Pick<ItemAbilityView, 'catalogEntryId' | 'choice'>[],
): ItemAbilityInput[] {
  return abilities.map(({ catalogEntryId, choice }) => ({
    catalogEntryId,
    ...(choice ? { choice } : {}),
  }));
}

/** What a shield bash's own details are. */
export const bashHint =
  "Shield bash: its own enhancement and Item Abilities, apart from the shield's AC bonus.";

const partTitles: Record<Exclude<ItemPart, 'primary'>, string> = {
  otherEnd: 'Other end',
  bash: 'Shield bash',
};

/** "Armor", "Shield", "Weapon", "Ammunition", "Other end", "Shield bash". */
export function describeItemPart(
  part: ItemPartView,
  { isAmmunition = false }: { isAmmunition?: boolean } = {},
) {
  if (part.part !== 'primary') return partTitles[part.part];
  if (part.kind === 'armor') return 'Armor';
  if (part.kind === 'shield') return 'Shield';
  return isAmmunition ? 'Ammunition' : 'Weapon';
}

/**
 * A specific item's own material: "Mithral (included in its numbers)" when
 * its own numbers already include it (a mithral shirt), else "Adamantine
 * (applied to its numbers)" (dwarven plate, built on full plate).
 */
export function describeBakedMaterial({
  name,
  includedInNumbers,
}: NonNullable<ItemPartsView['bakedMaterial']>) {
  const trimmed = name.trim();
  const label = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return `${label} (${includedInNumbers ? 'included in' : 'applied to'} its numbers)`;
}
