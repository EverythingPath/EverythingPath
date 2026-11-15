// @vitest-environment node
import { expect, it } from 'vitest';
import { importCatalog } from '../../scripts/catalog/import';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import { materializePinnedTree } from './pinned-sources';

const PACK = 'pf1/packs/armors-and-shields';

it('maps pinned shields to the shield slot and armor by category, defaulting to light armor', async () => {
  // Pinned v11 packs leave out template defaults (pf1 public/template.json,
  // equipment: subType 'armor', equipmentSubtype 'lightArmor'): shields say
  // subType: shield, and light armors such as Chain Shirt carry no
  // equipmentSubtype.
  const tree = await materializePinnedTree([
    `${PACK}/buckler.gsE0PAOmCwivue5A.yaml`,
    `${PACK}/heavy-steel-shield.2fK608aSYU9QDmzw.yaml`,
    `${PACK}/chain-shirt.iGu21zy6QtroUZ4O.yaml`,
    `${PACK}/breastplate.5TzaS38RPAx1oj9p.yaml`,
    `${PACK}/full-plate.h65qEp22nsyRoeRa.yaml`,
  ]);
  try {
    const { catalog } = await importCatalog({ ...tree, remaps });
    const armor = (key: string) => {
      const detail = catalog.entries.find(
        (row) => row.externalKey === key,
      )?.detail;
      if (detail?.kind !== 'item') throw new Error(`Missing item ${key}`);
      return detail.armor;
    };
    expect(armor('pf1/gsE0PAOmCwivue5A')).toMatchObject({
      slot: 'shield',
      category: 'other',
    });
    expect(armor('pf1/2fK608aSYU9QDmzw')).toMatchObject({
      slot: 'shield',
      category: 'heavyShield',
    });
    expect(armor('pf1/iGu21zy6QtroUZ4O')).toMatchObject({
      slot: 'armor',
      category: 'lightArmor',
    });
    expect(armor('pf1/5TzaS38RPAx1oj9p')).toMatchObject({
      slot: 'armor',
      category: 'mediumArmor',
    });
    expect(armor('pf1/h65qEp22nsyRoeRa')).toMatchObject({
      slot: 'armor',
      category: 'heavyArmor',
    });
  } finally {
    await tree.dispose();
  }
});

const ITEMS = 'pf1/packs/items';

it('imports armor blocks only for real armor; a wondrous item’s armor value is an armor bonus, not worn armor (#762)', async () => {
  // Pinned v11 records: clothing and wondrous items carry a material-only
  // system.armor ({material: {base: {value: leather}}}); the bracers carry
  // only armor.value 4 ("an armor bonus of +4 ... just as though he were
  // wearing armor", CRB p. 504). Foundry pf1 adds any equipped item's
  // armor.value to armor AC (base-character.mjs, "Add armor bonuses from
  // equipment").
  const tree = await materializePinnedTree([
    `${ITEMS}/ring-of-protection-2.0AIz2Gk74uaiLQIh.yaml`,
    `${ITEMS}/entertainer-s-outfit.6kZGQ2chmr3jpS1t.yaml`,
    `${ITEMS}/bracers-of-armor-4.7r3OittOtOxLNlKS.yaml`,
    `${PACK}/chain-shirt.iGu21zy6QtroUZ4O.yaml`,
  ]);
  try {
    const { catalog } = await importCatalog({ ...tree, remaps });
    const item = (key: string) => {
      const row = catalog.entries.find((row) => row.externalKey === key);
      if (row?.detail.kind !== 'item') throw new Error(`Missing item ${key}`);
      return { ...row, detail: row.detail };
    };
    // Ring of Protection +2: its +2 deflection change, and no armor block.
    const ring = item('pf1/0AIz2Gk74uaiLQIh');
    expect(ring.detail.armor).toBeUndefined();
    expect(ring.modifiers).toEqual([
      { target: 'ac', bonusType: 'deflection', value: 2 },
    ]);
    // Entertainer's outfit (CRB p. 159): clothing, no armor block or bonus.
    const outfit = item('pf1/6kZGQ2chmr3jpS1t');
    expect(outfit.detail.armor).toBeUndefined();
    expect(outfit.modifiers).toEqual([]);
    expect(outfit.unsupported).toEqual([]);
    // Bracers of Armor +4: a +4 armor bonus on armor AC, without an armor
    // block, so it is never worn armor.
    const bracers = item('pf1/7r3OittOtOxLNlKS');
    expect(bracers.detail.armor).toBeUndefined();
    expect(bracers.modifiers).toEqual([
      { target: 'ac.armor', bonusType: 'armor', value: 4 },
    ]);
    // Chain Shirt (CRB p. 150): real armor keeps its whole block.
    expect(item('pf1/iGu21zy6QtroUZ4O').detail.armor).toEqual({
      slot: 'armor',
      category: 'lightArmor',
      bonus: 4,
      maxDex: 4,
      armorCheckPenalty: 2,
      asf: 20,
    });
    expect(item('pf1/iGu21zy6QtroUZ4O').modifiers).toEqual([]);
  } finally {
    await tree.dispose();
  }
});
