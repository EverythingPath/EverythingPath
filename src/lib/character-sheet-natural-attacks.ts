import type { CreatureSize } from './character-sheet';
import type {
  NaturalAttackType,
  NaturalAttackRole,
} from './character-sheet-attack-types';
import type { WeaponDetail } from './character-sheet-attacks';

// Bestiary p. 301, Natural Attacks by Size (non-CRB), retained in bca5f2a.
// A dash is a missing printed damage value, not a guessed one-point attack.
const biteDice = ['1', '1d2', '1d3', '1d4', '1d6', '1d8', '2d6', '2d8', '4d6'];
const clawDice = ['—', '1', '1d2', '1d3', '1d4', '1d6', '1d8', '2d6', '2d8'];
export const naturalAttackProfiles: Record<
  NaturalAttackType,
  {
    name: string;
    role: NaturalAttackRole;
    damageTypes: string[];
    dice: readonly string[];
    needsFreeLimb: boolean;
  }
> = {
  bite: {
    name: 'Bite',
    role: 'primary',
    damageTypes: ['bludgeoning', 'slashing', 'piercing'],
    dice: biteDice,
    needsFreeLimb: false,
  },
  claw: {
    name: 'Claw',
    role: 'primary',
    damageTypes: ['bludgeoning', 'slashing'],
    dice: clawDice,
    needsFreeLimb: true,
  },
  gore: {
    name: 'Gore',
    role: 'primary',
    damageTypes: ['piercing'],
    dice: biteDice,
    needsFreeLimb: false,
  },
  hoof: {
    name: 'Hoof',
    role: 'secondary',
    damageTypes: ['bludgeoning'],
    dice: clawDice,
    needsFreeLimb: false,
  },
  pincer: {
    name: 'Pincer',
    role: 'secondary',
    damageTypes: ['bludgeoning'],
    dice: biteDice,
    needsFreeLimb: false,
  },
  slam: {
    name: 'Slam',
    role: 'primary',
    damageTypes: ['bludgeoning'],
    dice: clawDice,
    needsFreeLimb: true,
  },
  sting: {
    name: 'Sting',
    role: 'primary',
    damageTypes: ['piercing'],
    dice: clawDice,
    needsFreeLimb: false,
  },
  tailSlap: {
    name: 'Tail slap',
    role: 'secondary',
    damageTypes: ['bludgeoning'],
    dice: biteDice,
    needsFreeLimb: false,
  },
  talons: {
    name: 'Talons',
    role: 'primary',
    damageTypes: ['slashing'],
    dice: clawDice,
    needsFreeLimb: false,
  },
  tentacle: {
    name: 'Tentacle',
    role: 'secondary',
    damageTypes: ['bludgeoning'],
    dice: clawDice,
    needsFreeLimb: true,
  },
  wing: {
    name: 'Wing',
    role: 'secondary',
    damageTypes: ['bludgeoning'],
    dice: clawDice,
    needsFreeLimb: false,
  },
  other: {
    name: 'Other natural attack',
    role: 'secondary',
    damageTypes: ['bludgeoning', 'slashing', 'piercing'],
    dice: clawDice,
    needsFreeLimb: false,
  },
};

export function naturalAttackRoleLabel(role: NaturalAttackRole) {
  return role === 'primary'
    ? 'Primary natural attack'
    : 'Secondary natural attack';
}

export function cloneWeaponDetail(weapon: WeaponDetail) {
  const { groups, damageTypes, otherEnd, ...detail } = weapon;
  return {
    ...detail,
    ...(weapon.naturalAttack
      ? { naturalAttack: { ...weapon.naturalAttack } }
      : {}),
    ...(groups ? { groups: [...groups] } : {}),
    ...(damageTypes ? { damageTypes: [...damageTypes] } : {}),
    ...(otherEnd
      ? {
          otherEnd: {
            dice: otherEnd.dice,
            threat: otherEnd.threat,
            mult: otherEnd.mult,
            ...(otherEnd.damageTypes
              ? { damageTypes: [...otherEnd.damageTypes] }
              : {}),
          },
        }
      : {}),
  };
}

export function createNaturalAttackWeapon(
  type: NaturalAttackType,
): WeaponDetail {
  const profile = naturalAttackProfiles[type];
  return {
    baseType: profile.name.toLowerCase(),
    proficiency: 'always',
    groups: ['natural'],
    handedness: 'light',
    attackType: 'melee',
    dice: profile.dice[sizeIndex.medium],
    damageTypes: [...profile.damageTypes],
    threat: 20,
    mult: 2,
    strengthDamage: 'melee',
    naturalAttack: { type },
  };
}

const sizeIndex: Record<CreatureSize, number> = {
  fine: 0,
  diminutive: 1,
  tiny: 2,
  small: 3,
  medium: 4,
  large: 5,
  huge: 6,
  gargantuan: 7,
  colossal: 8,
};
const damageProgression = [
  '1',
  '1d2',
  '1d3',
  '1d4',
  '1d6',
  '1d8',
  '1d10',
  '2d6',
  '2d8',
  '3d6',
  '3d8',
  '4d6',
  '4d8',
  '6d6',
  '6d8',
  '8d6',
  '8d8',
  '12d6',
  '12d8',
  '16d6',
];

/** CRB March 2015 FAQ v5748eaic9t3f; #237 A14 applies it to unarmed. */
export function scaleAttackDice(
  dice: string,
  from: CreatureSize,
  to: CreatureSize,
): string | undefined {
  if (from === to) return dice;
  const normalized = dice === '2d4' ? '1d8' : dice === '1d12' ? '2d6' : dice;
  let damageIndex = damageProgression.indexOf(normalized);
  let currentSize = sizeIndex[from];
  if (dice === '2d10') {
    const increasing = sizeIndex[to] > currentSize;
    damageIndex = damageProgression.indexOf(increasing ? '4d8' : '2d8');
    currentSize += increasing ? 1 : -1;
  }
  if (damageIndex < 0) return undefined;
  while (currentSize !== sizeIndex[to]) {
    const increasing = currentSize < sizeIndex[to];
    const steps = increasing
      ? currentSize <= 3 || damageIndex <= 4
        ? 1
        : 2
      : currentSize <= 4 || damageIndex <= 5
        ? 1
        : 2;
    damageIndex = Math.max(0, damageIndex + (increasing ? steps : -steps));
    currentSize += increasing ? 1 : -1;
  }
  return damageProgression[damageIndex];
}

export function resolveNaturalAttackDice(
  weapon: WeaponDetail,
  size: CreatureSize,
) {
  const natural = weapon.naturalAttack;
  if (!natural) return weapon.dice;
  const profile = naturalAttackProfiles[natural.type];
  if (!weapon.dice || weapon.dice === profile.dice[sizeIndex.medium]) {
    const printed = profile.dice[sizeIndex[size]];
    return printed === '—' ? undefined : printed;
  }
  return scaleAttackDice(weapon.dice, 'medium', size);
}
