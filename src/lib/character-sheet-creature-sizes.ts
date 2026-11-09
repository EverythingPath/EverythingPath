export const creatureSizes = [
  'fine',
  'diminutive',
  'tiny',
  'small',
  'medium',
  'large',
  'huge',
  'gargantuan',
  'colossal',
] as const;
export type CreatureSize = (typeof creatureSizes)[number];

// CRB size modifiers: Stealth changes by four and Fly by two per size step.
export const creatureSizeSkillBonuses: Record<
  CreatureSize,
  { stealth: number; fly: number }
> = {
  fine: { stealth: 16, fly: 8 },
  diminutive: { stealth: 12, fly: 6 },
  tiny: { stealth: 8, fly: 4 },
  small: { stealth: 4, fly: 2 },
  medium: { stealth: 0, fly: 0 },
  large: { stealth: -4, fly: -2 },
  huge: { stealth: -8, fly: -4 },
  gargantuan: { stealth: -12, fly: -6 },
  colossal: { stealth: -16, fly: -8 },
};
