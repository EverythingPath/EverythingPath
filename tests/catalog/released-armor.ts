// pbl-reseed-generic (PRD #251): the Foundry armor and shield keys the gear
// sheet tests import with importReleasedEntries, which took them from the
// armors-and-shields-424 batch preview before.

export const armorKeys = {
  buckler: 'pf1/gsE0PAOmCwivue5A',
  dwarvenWarShield: 'pf1/inF1zaK0XoeTdBIc',
  heavySteelShield: 'pf1/2fK608aSYU9QDmzw',
  towerShield: 'pf1/3mQTIhwAaZgvJq12',
  breastplate: 'pf1/5TzaS38RPAx1oj9p',
  fullPlate: 'pf1/h65qEp22nsyRoeRa',
} as const;

/** The 15 shields the armors-and-shields-424 batch preview held, in its order. */
export const shieldKeys = [
  armorKeys.heavySteelShield,
  armorKeys.towerShield,
  'pf1/6zjwZeZmhqmAFC82', // Heavy Wooden Shield
  armorKeys.buckler,
  'pf1/h8Jq6rEHJ8xc4SIn', // Steel Madu
  armorKeys.dwarvenWarShield,
  'pf1/iRB7ACzHf14VIk4M', // Light Steel Shield
  'pf1/J3o844mQGeLhJk0V', // Poisoner's Buckler
  'pf1/kc4ZuOEIEx1ZlXgJ', // Leather Madu
  'pf1/l1qNkx4xGXelq6yY', // Light Wooden Shield
  'pf1/Lq7YjIXW1SfV4EKr', // Steel Snarlshield
  'pf1/mcDNhbR4RQ5Z1ckQ', // Light Wooden Shield (Quickdraw)
  'pf1/mDqCTp8wMKbSOo1x', // Klar
  'pf1/OZHfmAh4i6Bkoun3', // Wooden Snarlshield
  'pf1/z5iAeUTo3r6qlEfd', // Light Steel Shield (Quickdraw)
] as const;
