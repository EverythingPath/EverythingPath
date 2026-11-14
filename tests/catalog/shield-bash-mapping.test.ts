// @vitest-environment node
import { expect, it } from 'vitest';
import { importCatalog } from '../../scripts/catalog/import';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import { materializePinnedTree, readPinned } from './pinned-sources';

const SHIELDS = 'pf1/packs/armors-and-shields';
const PCGEN = 'data/pathfinder/paizo';
const CRB = `${PCGEN}/roleplaying_game/core_rulebook/cr_equip_arms_armor.lst`;
const APG = `${PCGEN}/roleplaying_game/advanced_players_guide/apg_equip_arms_armor.lst`;
const UC = `${PCGEN}/roleplaying_game/ultimate_combat/uc_equip_arms_armor.lst`;
const AA2 = `${PCGEN}/player_companion/adventurers_armory_2/aa2_equip_arms_armor.lst`;

type Citation = { file: string; line: number; name: string; tokens: string[] };
type Mapped = {
  key: string;
  file: string;
  proficiency: 'martial' | 'exotic';
  handedness: 'light' | 'oneHanded';
  dice: string;
  damageTypes: string[];
  /** Independent transcription of the pinned PCGen rows that settle it. */
  pcgen: Citation[];
};

// CRB p.152: a shield bash is a martial weapon, light for a light shield and
// one-handed for a heavy one (the two Shieldbash rows).
const lightBash: Citation = {
  file: CRB,
  line: 293,
  name: 'Shieldbash (Light Shield)',
  tokens: ['.Martial.', 'WIELD:Light'],
};
const heavyBash: Citation = {
  file: CRB,
  line: 294,
  name: 'Shieldbash (Heavy Shield)',
  tokens: ['.Martial.', 'WIELD:OneHanded'],
};
const shieldRow = (
  [file, line, name]: [string, number, string],
  wield: 'Light' | 'OneHanded',
): Citation => ({ file, line, name, tokens: [`WIELD:${wield}`] });
const bludgeoning = ['bludgeoning'];
const mapped: Mapped[] = [
  {
    key: 'pf1/l1qNkx4xGXelq6yY',
    file: 'light-wooden-shield.l1qNkx4xGXelq6yY.yaml',
    proficiency: 'martial',
    handedness: 'light',
    dice: '1d3',
    damageTypes: bludgeoning,
    pcgen: [shieldRow([CRB, 110, 'Light Wooden Shield'], 'Light'), lightBash],
  },
  {
    key: 'pf1/iRB7ACzHf14VIk4M',
    file: 'light-steel-shield.iRB7ACzHf14VIk4M.yaml',
    proficiency: 'martial',
    handedness: 'light',
    dice: '1d3',
    damageTypes: bludgeoning,
    pcgen: [shieldRow([CRB, 111, 'Light Steel Shield'], 'Light'), lightBash],
  },
  {
    key: 'pf1/6zjwZeZmhqmAFC82',
    file: 'heavy-wooden-shield.6zjwZeZmhqmAFC82.yaml',
    proficiency: 'martial',
    handedness: 'oneHanded',
    dice: '1d4',
    damageTypes: bludgeoning,
    pcgen: [
      shieldRow([CRB, 112, 'Heavy Wooden Shield'], 'OneHanded'),
      heavyBash,
    ],
  },
  {
    key: 'pf1/2fK608aSYU9QDmzw',
    file: 'heavy-steel-shield.2fK608aSYU9QDmzw.yaml',
    proficiency: 'martial',
    handedness: 'oneHanded',
    dice: '1d4',
    damageTypes: bludgeoning,
    pcgen: [
      shieldRow([CRB, 113, 'Heavy Steel Shield'], 'OneHanded'),
      heavyBash,
    ],
  },
  {
    key: 'pf1/mcDNhbR4RQ5Z1ckQ',
    file: 'light-wooden-shield-quickdraw.mcDNhbR4RQ5Z1ckQ.yaml',
    proficiency: 'martial',
    handedness: 'light',
    dice: '1d3',
    damageTypes: bludgeoning,
    pcgen: [
      shieldRow([APG, 53, 'Quickdraw Shield (Light/Wooden)'], 'Light'),
      lightBash,
    ],
  },
  {
    key: 'pf1/z5iAeUTo3r6qlEfd',
    file: 'light-steel-shield-quickdraw.z5iAeUTo3r6qlEfd.yaml',
    proficiency: 'martial',
    handedness: 'light',
    dice: '1d3',
    damageTypes: bludgeoning,
    pcgen: [
      shieldRow([APG, 54, 'Quickdraw Shield (Light/Steel)'], 'Light'),
      lightBash,
    ],
  },
  {
    key: 'pf1/OZHfmAh4i6Bkoun3',
    file: 'wooden-snarlshield.OZHfmAh4i6Bkoun3.yaml',
    proficiency: 'martial',
    handedness: 'oneHanded',
    dice: '1d4',
    damageTypes: bludgeoning,
    pcgen: [
      shieldRow([AA2, 32, 'Snarlshield, Wooden'], 'OneHanded'),
      heavyBash,
    ],
  },
  {
    key: 'pf1/Lq7YjIXW1SfV4EKr',
    file: 'steel-snarlshield.Lq7YjIXW1SfV4EKr.yaml',
    proficiency: 'martial',
    handedness: 'oneHanded',
    dice: '1d4',
    damageTypes: bludgeoning,
    pcgen: [shieldRow([AA2, 31, 'Snarlshield, Steel'], 'OneHanded'), heavyBash],
  },
  {
    key: 'pf1/kc4ZuOEIEx1ZlXgJ',
    file: 'leather-madu.kc4ZuOEIEx1ZlXgJ.yaml',
    proficiency: 'exotic',
    handedness: 'light',
    dice: '1d4',
    damageTypes: ['piercing'],
    pcgen: [
      {
        file: UC,
        line: 86,
        name: 'Madu (Leather)',
        tokens: ['PROFICIENCY:WEAPON|Madu', '.Exotic.', 'WIELD:Light'],
      },
    ],
  },
  {
    key: 'pf1/h8Jq6rEHJ8xc4SIn',
    file: 'steel-madu.h8Jq6rEHJ8xc4SIn.yaml',
    proficiency: 'exotic',
    handedness: 'light',
    dice: '1d4',
    damageTypes: ['piercing'],
    pcgen: [
      {
        file: UC,
        line: 87,
        name: 'Madu (Steel)',
        tokens: ['PROFICIENCY:WEAPON|Madu', '.Exotic.', 'WIELD:Light'],
      },
    ],
  },
  {
    key: 'pf1/inF1zaK0XoeTdBIc',
    file: 'dwarven-war-shield.inF1zaK0XoeTdBIc.yaml',
    proficiency: 'exotic',
    handedness: 'light',
    dice: '1d6',
    damageTypes: ['piercing', 'slashing'],
    pcgen: [
      {
        file: AA2,
        line: 48,
        name: 'War-Shield, Dwarven',
        tokens: [
          'PROFICIENCY:WEAPON|War-Shield (Dwarven/as Weapon)',
          '.Exotic.',
          'WIELD:Light',
        ],
      },
    ],
  },
];
/** No pinned source settles these: their bash keeps the legacy fallback. */
const held = [
  ['pf1/mDqCTp8wMKbSOo1x', `${SHIELDS}/klar.mDqCTp8wMKbSOo1x.yaml`],
  [
    'pf1/alQVMlHc89hMxK2M',
    'pf1/packs/technology/hard-light-shield.alQVMlHc89hMxK2M.yaml',
  ],
] as const;
/** Shields without a Bash action keep no weapon detail. */
const noBash = [
  ['pf1/gsE0PAOmCwivue5A', `${SHIELDS}/buckler.gsE0PAOmCwivue5A.yaml`],
  ['pf1/3mQTIhwAaZgvJq12', `${SHIELDS}/tower-shield.3mQTIhwAaZgvJq12.yaml`],
] as const;

async function importShields() {
  const tree = await materializePinnedTree([
    ...mapped.map((row) => `${SHIELDS}/${row.file}`),
    ...held.map(([, file]) => file),
    ...noBash.map(([, file]) => file),
    'pf1/packs/weapons-and-ammo/longsword.zWRlna42PMJVX6un.yaml',
  ]);
  try {
    return (await importCatalog({ ...tree, remaps })).catalog.entries;
  } finally {
    await tree.dispose();
  }
}

it('cites pinned PCGen rows that type each mapped bash with its proficiency and grip', async () => {
  for (const row of mapped)
    for (const citation of row.pcgen) {
      const line = (await readPinned('pcgen', citation.file)).split('\n')[
        citation.line - 1
      ];
      expect(line?.split('\t')[0], row.key).toBe(citation.name);
      for (const token of citation.tokens)
        expect(line, `${row.key} ${citation.file}:${citation.line}`).toContain(
          token,
        );
    }
});

it("maps a shield's Bash to the release weapon shape with the reviewed proficiency and handedness, and keeps the fallback where no source settles it", async () => {
  const entries = await importShields();
  const detail = (key: string) => {
    const row = entries.find((entry) => entry.externalKey === key);
    if (row?.detail.kind !== 'item') throw new Error(`Missing item ${key}`);
    return row.detail;
  };
  for (const row of mapped) {
    const { weapon, armor } = detail(row.key);
    expect(armor?.slot, row.key).toBe('shield');
    expect(weapon, row.key).toEqual({
      baseType: entries.find((entry) => entry.externalKey === row.key)?.name,
      proficiency: row.proficiency,
      groups: [],
      handedness: row.handedness,
      attackType: 'melee',
      dice: row.dice,
      damageTypes: row.damageTypes,
      threat: 20,
      mult: 2,
      finesse: false,
      monk: false,
      thrown: false,
      strengthDamage: 'melee',
    });
  }
  // A heavy shield is never mapped light, nor a light one one-handed.
  expect(detail('pf1/2fK608aSYU9QDmzw').weapon).toMatchObject({
    handedness: 'oneHanded',
  });
  expect(detail('pf1/iRB7ACzHf14VIk4M').weapon).toMatchObject({
    handedness: 'light',
  });
  for (const [key] of held) {
    const { weapon } = detail(key);
    expect(weapon, key).toHaveProperty('baseTypes');
    expect(weapon, key).not.toHaveProperty('baseType');
    expect(weapon, key).toMatchObject({ handedness: 'light' });
  }
  for (const [key] of noBash) expect(detail(key).weapon, key).toBeUndefined();
  // An ordinary weapon is unchanged by the shield rules.
  expect(detail('pf1/zWRlna42PMJVX6un').weapon).toMatchObject({
    baseType: 'Longsword',
    proficiency: 'martial',
    handedness: 'oneHanded',
    dice: '1d8',
    threat: 19,
  });
});
