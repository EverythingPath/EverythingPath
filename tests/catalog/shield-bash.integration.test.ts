/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { beforeAll, expect, test } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { candidateDefinition } from '../../convex/lib/catalogCandidateDefinition';
import { withSheetCatalog } from '../character-sheet-catalog';
import {
  activationArgs,
  prepare,
  reconcile,
  releaseFixture,
  type ReleaseTest,
} from '../catalog-release-fixture';
import type { ReleaseJson } from '../../src/lib/catalog/release-schema';
import type { PreviewEntry } from '../../scripts/catalog/map';

const modules = import.meta.glob('../../convex/**/*.ts');
const HEAVY_STEEL = 'pf1/2fK608aSYU9QDmzw';
const LIGHT_STEEL = 'pf1/iRB7ACzHf14VIk4M';
const KLAR = 'pf1/mDqCTp8wMKbSOo1x';
const LONGSWORD = 'pf1/zWRlna42PMJVX6un';
const SHIELDS = 'pf1/packs/armors-and-shields';
// The pinned bodies the #424 and weapon batches recorded.
const sha256 = {
  [`${SHIELDS}/heavy-steel-shield.2fK608aSYU9QDmzw.yaml`]:
    '16eabd32f96d9c27969f85e0a14d07e626bfc305fe156737ca46675348a6f751',
  [`${SHIELDS}/light-steel-shield.iRB7ACzHf14VIk4M.yaml`]:
    '9a1547d6537a901d4df3457744149ad34fb3c1e78acfc945f573084ef94f102d',
  [`${SHIELDS}/klar.mDqCTp8wMKbSOo1x.yaml`]:
    '738a1555775be8dcc5f7cc808c58c7ab12df98a08069c5c3a9093e8b639cd1ae',
  'pf1/packs/weapons-and-ammo/longsword.zWRlna42PMJVX6un.yaml':
    '4a7249726b003f9fa57b8c1f7b3488a926b473f918914c98a5182ed7e2e9ed62',
};
let entries: PreviewEntry[];

beforeAll(async () => {
  const { materializePinnedTree } = await import('./pinned-sources');
  const { importCatalog } = await import('../../scripts/catalog/import');
  const { default: remaps } =
    await import('../../scripts/catalog/reviewed-remaps.json');
  const { reviewedCuration } =
    await import('../../scripts/catalog/reviewed-curation-data');
  const tree = await materializePinnedTree(Object.keys(sha256), { sha256 });
  try {
    entries = (
      await importCatalog({ ...tree, remaps, curation: reviewedCuration })
    ).catalog.entries;
  } finally {
    await tree.dispose();
  }
});

function imported(key: string) {
  const row = entries.find((row) => row.externalKey === key);
  if (!row) throw new Error(`Missing fresh import ${key}`);
  return row;
}
const releaseJson = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as ReleaseJson;
const payload = (key: string) => releaseJson(imported(key));
function install(t: ReleaseTest, key: string) {
  return t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: key,
      ruleIdentity: key,
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'item', consumable: false },
    }),
  );
}
function candidate(t: ReleaseTest, id: Id<'catalogEntry'>) {
  return t.run(async (ctx) => {
    const release = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 1))
      .unique();
    const stored = await ctx.db.get('catalogEntry', id);
    if (!release || !stored) throw new Error('Missing release or definition');
    return candidateDefinition(ctx, release, stored);
  });
}

test('the pinned Heavy Steel Shield body converts through the candidate adapter; its at-base legacy body and the held Klar are refused', async () => {
  // At the base the importer gave the shield's bash the legacy shape (the
  // base full-corpus preview's body, shield-bash slice evidence).
  const atBase = {
    baseTypes: [],
    groups: [],
    proficiency: 'shield',
    handedness: 'light',
    dice: '1d4',
    damageTypes: ['bludgeoning'],
    threat: 20,
    mult: 2,
    finesse: false,
    thrown: false,
  };
  const legacy = await releaseFixture(modules);
  const legacyId = await install(legacy.t, HEAVY_STEEL);
  const klarId = await install(legacy.t, KLAR);
  const fresh = imported(HEAVY_STEEL);
  await prepare(legacy.t, [
    {
      kind: 'definition',
      key: HEAVY_STEEL,
      payload: releaseJson({
        ...fresh,
        detail: { ...fresh.detail, weapon: atBase },
      }),
    },
    { kind: 'definition', key: KLAR, payload: payload(KLAR) },
  ]);
  for (const [id, key] of [
    [legacyId, HEAVY_STEEL],
    [klarId, KLAR],
  ] as const)
    await expect(candidate(legacy.t, id)).rejects.toMatchObject({
      data: `Unsupported candidate weapon ${key}: unsupported or incomplete imported profile (legacy weapon shape)`,
    });

  const { t } = await releaseFixture(modules);
  const id = await install(t, HEAVY_STEEL);
  await prepare(t, [
    { kind: 'definition', key: HEAVY_STEEL, payload: payload(HEAVY_STEEL) },
  ]);
  expect((await candidate(t, id)).detail).toEqual({
    kind: 'item',
    consumable: false,
    price: 20,
    weight: 15,
    weapon: {
      baseType: 'Heavy Steel Shield',
      proficiency: 'martial',
      groups: [],
      handedness: 'oneHanded',
      attackType: 'melee',
      dice: '1d4',
      damageTypes: ['bludgeoning'],
      threat: 20,
      mult: 2,
      finesse: false,
      monk: false,
      thrown: false,
      strengthDamage: 'melee',
    },
    armor: {
      slot: 'shield',
      category: 'heavyShield',
      bonus: 2,
      maxDex: null,
      armorCheckPenalty: 2,
      asf: 15,
    },
  });
});

test('a Character wields the released Heavy Steel Shield: a one-handed martial bash, its enhancement on AC only, and Bashing still binding', async () => {
  const { t, owner, scope } = await releaseFixture(modules);
  const keys = [HEAVY_STEEL, LIGHT_STEEL, LONGSWORD];
  const ids = new Map<string, Id<'catalogEntry'>>();
  for (const key of keys) ids.set(key, await install(t, key));
  // One carried item makes this Character part of the release impact run.
  await t.run((ctx) =>
    ctx.db.insert('characterSheetEntry', {
      characterId: scope.characterId,
      catalogEntryId: ids.get(LONGSWORD)!,
      kind: 'item',
      active: true,
      state: { kind: 'item' },
    }),
  );
  await prepare(
    t,
    keys.map((key) => ({ kind: 'definition', key, payload: payload(key) })),
  );
  const runId = await reconcile(t, scope.characterId);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(runId),
  );
  const bashing = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Bashing',
      ruleIdentity: 'bashing',
      sourceKey: 'bashing',
      stacksWithItself: false,
      sources: [],
      modifiers: [
        {
          target: 'attack',
          bonusType: 'enhancement',
          value: 1,
          condition: { weapon: '$self' },
        },
        {
          target: 'damage',
          bonusType: 'enhancement',
          value: 1,
          condition: { weapon: '$self' },
        },
      ],
      detail: { kind: 'itemAbility', appliesTo: 'shield', bonusEquivalent: 1 },
    }),
  );
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    operationId: 'scores',
  });
  for (const category of ['simple', 'shield'] as const)
    await owner.mutation(api.characterSheet.setManualProficiency, {
      ...scope,
      proficiency: { category },
      disposition: 'added',
      operationId: `proficiency-${category}`,
    });
  const carry = (key: string) =>
    owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: ids.get(key)!,
      operationId: `carry-${key}`,
    });
  const sword = await carry(LONGSWORD);
  const heavy = await carry(HEAVY_STEEL);
  const read = async () => {
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!sheet) throw new Error('Missing saved sheet');
    return sheet;
  };
  const routine = (await read()).entries.find(
    (row) => row.kind === 'attackRoutine' && row.state.weaponEntryId === sword,
  );
  if (!routine) throw new Error('Missing sword routine');
  const offHand = async (shield: Id<'characterSheetEntry'>) => {
    await owner.mutation(api.characterSheet.editAttackRoutine, {
      ...scope,
      entryId: routine._id,
      offHand: { kind: 'weapon', weaponEntryId: shield, mode: 'melee' },
      operationId: `off-${shield}`,
    });
    const sheet = await read();
    const calculated = sheet.calculated.attackRoutines.find(
      (row) => row.entryId === routine._id,
    );
    const line = calculated?.full.find((row) => row.hand === 'off');
    if (!line) throw new Error('Missing off-hand bash');
    return {
      sheet,
      line,
      attack: line.attackBonus.total,
      summary: calculated?.twoWeaponPenaltySummary,
    };
  };
  // The saved definition carries the reviewed rule.
  expect(
    (await read()).catalogEntries.find(
      (row) => row._id === ids.get(HEAVY_STEEL),
    )?.detail,
  ).toMatchObject({
    weapon: { proficiency: 'martial', handedness: 'oneHanded', dice: '1d4' },
  });

  // Without martial proficiency the bash is a nonproficient attack (-4).
  const nonproficient = await offHand(heavy);
  expect(nonproficient.line.damageDice).toBe('1d4');
  await owner.mutation(api.characterSheet.setManualProficiency, {
    ...scope,
    proficiency: { category: 'martial' },
    disposition: 'added',
    operationId: 'proficiency-martial',
  });
  const heavyBash = await offHand(heavy);
  expect(heavyBash.attack - nonproficient.attack).toBe(4);
  // A heavy shield's bash is one-handed: the off hand takes -10 without
  // Two-Weapon Fighting (CRB p. 202).
  expect(heavyBash.attack).toBe(-10);
  expect(heavyBash.summary).not.toContain('light off hand');

  // The shield's own +2 enhancement improves its AC bonus, not its bash.
  await owner.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: heavy,
    enhancement: 2,
    operationId: 'shield-enhancement',
  });
  const enhanced = await offHand(heavy);
  expect(enhanced.sheet.calculated.breakdowns['ac.shield'].total).toBe(4);
  expect(enhanced.attack).toBe(-10);
  expect(
    enhanced.line.attackBonus.applied.some(
      (row) => row.bonusType === 'enhancement',
    ),
  ).toBe(false);

  // Bashing on the shield: a +1 bash two size categories larger (1d8).
  await owner.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: heavy,
    abilities: [{ catalogEntryId: bashing }],
    operationId: 'bashing',
  });
  const bashed = await offHand(heavy);
  expect(bashed.line.damageDice).toBe('1d8');
  expect(bashed.attack).toBe(-9);
  expect(bashed.sheet.calculated.breakdowns['ac.shield'].total).toBe(4);

  // A light shield's bash is light: the off hand takes -8.
  const lightBash = await offHand(await carry(LIGHT_STEEL));
  expect(lightBash.attack).toBe(-8);
  expect(lightBash.line.damageDice).toBe('1d3');
  expect(lightBash.summary).toContain('light off hand');
});
