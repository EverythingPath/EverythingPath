export const weaponEnds = ['primary', 'otherEnd'] as const;
export const attackHands = ['main', 'off'] as const;

export type AttackWeaponEnd = (typeof weaponEnds)[number];
export type AttackHand = (typeof attackHands)[number];

export const UNARMED_STRIKE_ID = 'unarmed';

export function isUnarmedStrike(
  weaponEntryId: string,
): weaponEntryId is typeof UNARMED_STRIKE_ID {
  return weaponEntryId === UNARMED_STRIKE_ID;
}

export const naturalAttackTypes = [
  'bite',
  'claw',
  'gore',
  'hoof',
  'pincer',
  'slam',
  'sting',
  'tailSlap',
  'talons',
  'tentacle',
  'wing',
  'other',
] as const;
export type NaturalAttackType = (typeof naturalAttackTypes)[number];
export const naturalAttackRoles = ['primary', 'secondary'] as const;
export type NaturalAttackRole = (typeof naturalAttackRoles)[number];

/**
 * The parts of one item with state of their own: the item itself, a double
 * weapon's other end and a shield's bash, each with independent enhancement
 * and abilities.
 */
export const itemParts = ['primary', 'otherEnd', 'bash'] as const;
export type ItemPart = (typeof itemParts)[number];

/** What an Item Ability may be placed on (pf1-content `pf-special-qualities` tags). */
export const itemAbilityTargets = [
  'melee',
  'ranged',
  'weapon',
  'armor',
  'shield',
  'armorOrShield',
] as const;
export type ItemAbilityTarget = (typeof itemAbilityTargets)[number];

/**
 * An Item Ability's Situation placeholder for the foe chosen on the item
 * (bane's): the resolver replaces it with that foe's shared Situation.
 */
export const CHOSEN_FOE_SITUATION = '$choice';

/**
 * What a Spell Effect on one item may target (#236 "Spells on an item"):
 * manufactured weapons and a monk's unarmed strike (magic weapon), natural
 * weapons and the unarmed strike (magic fang), or armor and shields (magic
 * vestment).
 */
export const spellEffectItemTargets = [
  'weapon',
  'natural',
  'armorOrShield',
] as const;
export type SpellEffectItemTarget = (typeof spellEffectItemTargets)[number];
