/// <reference types="vite/client" />
// @vitest-environment edge-runtime
// pbl-released-gear (PRD #251): the gear batch integration tests
// (armorsAndShields424, weaponsAndAmmo425 to 429, items430 and items431), on
// entries imported from the pinned store. Each sheet case saves
// character-scoped copies of imported items, checks that the client preview
// equals the saved sheet, the kind's rule, and that outsiders, anonymous
// callers and another campaign's entries are refused. The two release cases
// take the named records through import, serialization, staging and
// finalization. No assertion reads an entry's description, so its links (to
// keys the import leaves out) are not imported.
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { describe, expect, it, test } from 'vitest';
import { z } from 'zod';
import { api, internal } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import { computeFingerprint } from '../../scripts/catalog/admission';
import { importCatalog } from '../../scripts/catalog/import';
import { serializeCatalogRelease } from '../../scripts/catalog/release';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { releaseLegalInputsSchema } from '../../src/lib/catalog/release-legal-inputs';
import { validateCatalogReleaseArtifact } from '../../src/lib/catalog/release-schema';
import type { CatalogReleaseStatus } from '../../src/lib/catalog/release-validators';
import {
  legalResources,
  reviewedAdmission,
} from '../../src/lib/catalog/reviewed-data';
import { catalogRuntimeCompatibility } from '../../src/lib/catalog/runtime-compatibility';
import {
  modifierConditionSchema,
  modifierTargets,
  situationalNoteSchema,
} from '../../src/lib/character-sheet';
import { armorCategory } from '../../src/lib/character-sheet-armor-categories';
import { withSheetCatalog } from '../character-sheet-catalog';
import { createBatchRelease } from './batch-admission';
import { materializePinnedTree } from './pinned-sources';
import { armorKeys } from './released-armor';
import { importReleasedEntries, releasedRecordFiles } from './released-entries';
import { weaponSheets } from './released-gear-sheet';

const modules = import.meta.glob('../../convex/**/*.ts');

/** The weapons the five weapon cases save, by the weapons-and-ammo key list they came from. */
const weapons = {
  shotel: 'pf1/1vNxFfAeYalooWIF', // 425
  punchingDagger: 'pf1/05NnBuNnkMsaNoXf', // 425
  machete: 'pf1/A7H1FjMo0jGDY3dB', // 425
  butcheringAxe: 'pf1/P2HkbmWWfqb9fOwD', // 426
  battleAxe: 'pf1/JIljkqPWhmvAPYbI', // 426
  boardingAxe: 'pf1/KkLxcudnFBKuK7JI', // 426
  sickleSword: 'pf1/a6w5DSGKSZo6LvTN', // 427
  greataxe: 'pf1/Wx22UaMqWgCrYi7r', // 427
  boulderHelmet: 'pf1/QXs5iZ1gpobwCNp9', // 427
  scizore: 'pf1/fqiZkTAd1BlgOaII', // 428
  earthBreaker: 'pf1/b0hY6M0sYwvjnMZH', // 428
  seax: 'pf1/kY1zv3pOlGUfyX29', // 428
  meteorHammer: 'pf1/otf7OZQZhkAWoUR4', // 429
  greatsword: 'pf1/oyUApQSVsAqzyjdz', // 429
  thornblade: 'pf1/zOgD72irWuvqTCUq', // 429
} as const;
/** The items the two item cases save (items-430 and items-431 key lists). */
const items = {
  entertainersOutfit: 'pf1/6kZGQ2chmr3jpS1t',
  ringOfProtection: 'pf1/0AIz2Gk74uaiLQIh',
  iounStone: 'pf1/71VGp1a4z1BQFNXu',
  horseshoe: 'pf1/7P3H1yV8835Am6c6',
  mightBelt: 'pf1/1hPPkMMfEuJha8YB',
  monksOutfit: 'pf1/GFOu4GXWqb6MJQQJ',
  explorersOutfit: 'pf1/LZLwdGasEUnMplnc',
  bracers: 'pf1/IjptxC4fEDAhYrZT',
  perfectionBelt: 'pf1/MvIylLVVvfr3kcW2',
  tinCap: 'pf1/KxHYgsJaMhsLI2Xu',
  elvenkindCloak: 'pf1/HSF0j88RR9JeTaJi',
} as const;
const CHAIN_SHIRT = 'pf1/iGu21zy6QtroUZ4O';
const { buckler: BUCKLER, breastplate: BREASTPLATE } = armorKeys;
const HEAVY_STEEL_SHIELD = armorKeys.heavySteelShield;
const ARROW = 'pf1/23HXFjpPnuLFOylm';

// One import for every sheet case.
const { entries } = await importReleasedEntries([
  ...Object.values(weapons),
  ...Object.values(items),
  CHAIN_SHIRT,
  BUCKLER,
  BREASTPLATE,
  HEAVY_STEEL_SHIELD,
]);
const { sheetWeapon } = weaponSheets(entries);

/**
 * The committed admission's disposition of a key, as the batch reviews
 * recorded it: a confirmed assessment is admitted, an unresolved one held.
 */
function disposition(key: string) {
  const status = reviewedAdmission.assessments.find(
    (row) => row.externalKey === key,
  )?.status;
  return status === 'confirmed'
    ? 'admitted'
    : status === 'unresolved'
      ? 'held'
      : status;
}

// These bodies have no Catalog Entry ID conditions: accept only shared or
// local Situations (and, by kind, the weapon's own attacks or a school),
// never imported external keys as stored references.
const localSituationSchema = z.union([
  z.string().min(1),
  z.strictObject({ local: z.string().min(1).max(4096) }),
]);
function storedRows(kind: 'weapon' | 'armor' | 'item') {
  const condition = modifierConditionSchema
    .pick(
      kind === 'weapon'
        ? { situation: true, weapon: true }
        : kind === 'armor'
          ? { situation: true, school: true }
          : { situation: true },
    )
    .extend({ situation: localSituationSchema.optional() })
    .strict();
  return {
    modifier: outputSchema.options[0].omit({ kind: true }).extend({
      target: z.enum(modifierTargets),
      condition: condition.optional(),
    }),
    note: situationalNoteSchema
      .safeExtend({
        situation: localSituationSchema.optional(),
        condition: condition.optional(),
      })
      .strict(),
  };
}
/** A melee weapon in the stored sheet weapon shape. */
function storedWeapon(key: string) {
  const weapon = sheetWeapon(key);
  return {
    baseType: weapon.baseType,
    proficiency: weapon.proficiency,
    groups: [...(weapon.groups ?? [])],
    ...(weapon.handedness ? { handedness: weapon.handedness } : {}),
    attackType: 'melee' as const,
    ...(weapon.dice ? { dice: weapon.dice } : {}),
    damageTypes: [...(weapon.damageTypes ?? [])],
    ...(weapon.threat ? { threat: weapon.threat } : {}),
    ...(weapon.mult ? { mult: weapon.mult } : {}),
    finesse: weapon.finesse === true,
    strengthDamage: 'melee' as const,
  };
}
type ImportedArmor = NonNullable<
  Extract<
    ReturnType<typeof importedCatalogEntrySchema.parse>['detail'],
    { kind: 'item' }
  >['armor']
>;
/** An imported armor block in the stored shape. */
function storedArmor(armor: ImportedArmor) {
  return {
    slot: armor.slot,
    category: armor.category as never,
    bonus: armor.bonus,
    maxDex: armor.maxDex,
    armorCheckPenalty: armor.armorCheckPenalty,
    asf: armor.asf,
  };
}
/** Refuses an armor copy of an item without a known armor category. */
function requireArmor(key: string, armor: ImportedArmor | undefined) {
  if (!armor) throw new Error(`${key} is not armor or a shield`);
  if (!armorCategory(armor.category))
    throw new Error(`${key} has no known category`);
}
/**
 * A character-scoped copy of an imported item: its Modifiers and Notes and,
 * by kind, its melee weapon in the sheet's weapon shape, its armor block (a
 * shield's bash weapon left out) or its armor block when it has one. No
 * assessment or Catalog Release is constructed.
 */
function itemDefinition(kind: 'weapon' | 'armor' | 'item', key: string) {
  const entry = importedCatalogEntrySchema.parse(entries.get(key));
  if (entry.detail.kind !== 'item') throw new Error(`${key} is not an item`);
  const rows = storedRows(kind);
  const { armor, weapon } = entry.detail;
  if (kind === 'armor') requireArmor(key, armor);
  return {
    name: entry.name,
    ruleIdentity: entry.externalKey,
    stacksWithItself: false,
    sources: entry.sources,
    description: entry.description,
    modifiers: entry.modifiers.map((row) => rows.modifier.parse(row)),
    ...(entry.situationalNotes
      ? {
          situationalNotes: entry.situationalNotes.map((note) =>
            rows.note.parse(note),
          ),
        }
      : {}),
    detail: {
      kind: 'item' as const,
      consumable: entry.detail.consumable,
      ...(kind === 'weapon' && weapon ? { weapon: storedWeapon(key) } : {}),
      ...(kind !== 'weapon' && armor ? { armor: storedArmor(armor) } : {}),
    },
  };
}

type Scores = {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
};
const tens: Scores = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

/**
 * An owner, a member and an outsider (another organization); a campaign
 * with an e2e fixture marker and another campaign; a character with the
 * given base scores and manual proficiencies.
 */
async function isolatedSheet({
  prefix,
  campaign,
  namespace,
  character,
  operationId,
  scores,
  proficiencies,
}: {
  prefix: string;
  campaign: string;
  namespace: string;
  character: string;
  operationId: string;
  scores: Partial<Scores>;
  proficiencies: readonly (
    | { category: 'simple' | 'martial' | 'light' | 'medium' | 'shield' }
    | { baseType: string }
  )[];
}) {
  const t = convexTest(schema, modules);
  const { campaignId, otherCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `${prefix}|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: campaign,
      description: '',
      organizationId: 'org',
      ownerId: `${prefix}|owner`,
      e2eFixture: {
        namespace,
        version: 1,
        workerKey: '0',
        caseKey: 'reviewed',
        campaignKey: 'reviewed',
      },
    });
    const otherCampaignId = await ctx.db.insert('campaign', {
      name: 'Other isolated campaign',
      description: '',
      organizationId: 'org',
      ownerId: `${prefix}|owner`,
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: `${prefix}|owner` });
  const member = t.withIdentity({ tokenIdentifier: `${prefix}|member` });
  const outsider = t.withIdentity({ tokenIdentifier: `${prefix}|outsider` });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: character,
    kind: 'pc',
    operationId,
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { ...tens, ...scores },
    operationId: 'base-scores',
  });
  for (const proficiency of proficiencies)
    await member.mutation(api.characterSheet.setManualProficiency, {
      ...scope,
      proficiency,
      disposition: 'added',
      operationId:
        'category' in proficiency
          ? `proficiency-${proficiency.category}`
          : `proficiency-${proficiency.baseType.replaceAll(' ', '-')}`,
    });
  /** Inserts a character-scoped copy of each key's imported item. */
  const insert = async (kind: 'weapon' | 'armor' | 'item', keys: string[]) => {
    const ids = new Map<string, Id<'catalogEntry'>>();
    for (const key of keys)
      ids.set(
        key,
        await t.run((ctx) =>
          ctx.db.insert('catalogEntry', {
            scope: 'character',
            characterId,
            ...itemDefinition(kind, key),
          }),
        ),
      );
    return ids;
  };
  const select = async (
    ids: Map<string, Id<'catalogEntry'>>,
    keys: string[],
    prefixId: string,
  ) => {
    const entryIds = new Map<string, Id<'characterSheetEntry'>>();
    for (const key of keys)
      entryIds.set(
        key,
        await member.mutation(api.characterSheet.selectEntry, {
          ...scope,
          catalogEntryId: ids.get(key)!,
          operationId: `${prefixId}-${key}`,
        }),
      );
    return entryIds;
  };
  /**
   * Outsiders, anonymous callers and another campaign's entries are
   * refused, and the sheet is unchanged.
   */
  const refusesOthers = async (
    read: () => Promise<{ entries: unknown; revision: unknown }>,
    attempt: (
      caller: typeof outsider | typeof t,
      operationId: string,
    ) => Promise<unknown>,
    foreign: { kind: 'weapon' | 'armor' | 'item'; key: string },
  ) => {
    const before = await read();
    await expect(attempt(outsider, 'outsider')).rejects.toThrow(
      'You do not have access to this org',
    );
    await expect(attempt(t, 'anonymous')).rejects.toThrow(
      'You do not have access to this org',
    );
    const foreignId = await t.run(async (ctx) =>
      ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: otherCampaignId,
        ...itemDefinition(foreign.kind, foreign.key),
      }),
    );
    await expect(
      member.mutation(api.characterSheet.selectEntry, {
        ...scope,
        catalogEntryId: foreignId,
        operationId: 'foreign',
      }),
    ).rejects.toThrow('Catalog Entry does not belong to this Character');
    const after = await read();
    expect(after.entries).toEqual(before.entries);
    expect(after.revision).toBe(before.revision);
  };
  return { owner, member, scope, insert, select, refusesOthers };
}

type Line = {
  attack: number;
  damage: number;
  dice: string;
  multiplier: number;
};
type Leaf = 'cmb' | 'ac.other' | 'ac.shield' | 'skill.clm' | 'skill.sur';
/**
 * A trained weapon's check: its complete line, or (`attack`) its attack
 * bonus alone, as the weapons-and-ammo-429 test checked the elven
 * thornblade, which the added proficiency does not cover.
 */
type TrainedCheck =
  | { kind: 'line'; name: string; line: Line; attack?: never }
  | { kind: 'attack'; name: string; attack: number; line?: never };
/**
 * A weapon case: three carried weapons (each held in the committed
 * admission), their Attack Routines' complete lines without the exotic
 * proficiencies, the totals of the sheet leaves their situational Modifiers
 * would reach (the saved sheet selects no Situation, so these show only that
 * no bonus applies unconditionally; the bonus under its Situation is the
 * unit case's, released-gear.test.ts), and the trained weapons' checks after
 * one exotic proficiency is added.
 */
type WeaponCase = {
  title: string;
  number: 425 | 426 | 427 | 428 | 429;
  weapons: readonly [string, string, string];
  untrained: Record<string, Line>;
  leaves: readonly [[Leaf, number], ...[Leaf, number][]];
  proficiency: string;
  trained: readonly [TrainedCheck, ...TrainedCheck[]];
  /** The weapon an outsider and an anonymous caller try to make a routine for. */
  routineFor: string;
  /** The weapon another campaign holds a copy of. */
  foreign: string;
};
const weaponCases: WeaponCase[] = [
  {
    title:
      'shotel, punching dagger and machete, the shotel with a −4 penalty until its proficiency is added and Survival with no unconditional bonus from the machete',
    number: 425,
    weapons: [weapons.shotel, weapons.punchingDagger, weapons.machete],
    // Strength 14: +2 on attack and damage rolls; the shotel is exotic, so
    // without its proficiency it takes −4.
    untrained: {
      Shotel: { attack: -2, damage: 2, dice: '1d8', multiplier: 3 },
      'Punching Dagger': { attack: 2, damage: 2, dice: '1d4', multiplier: 3 },
      Machete: { attack: 2, damage: 2, dice: '1d6', multiplier: 2 },
    },
    // Survival carries no unconditional bonus from the machete; its +1
    // under its Situation is the unit case 'weapons and ammunition (the weapons-and-ammo-425 keys) › applies each curated Modifier only under its Situation'.
    leaves: [['skill.sur', 0]],
    proficiency: 'shotel',
    trained: [
      {
        kind: 'line',
        name: 'Shotel',
        line: { attack: 2, damage: 2, dice: '1d8', multiplier: 3 },
      },
    ],
    routineFor: weapons.machete,
    foreign: weapons.shotel,
  },
  {
    title:
      'butchering axe, battle axe and boarding axe, the butchering axe with a −4 penalty until its proficiency is added and Climb with no unconditional bonus from the boarding axe',
    number: 426,
    weapons: [weapons.butcheringAxe, weapons.battleAxe, weapons.boardingAxe],
    // Strength 14: +2 on attack rolls, +2 on one-handed and +3 on two-handed
    // damage; the butchering axe is exotic, so without its proficiency it
    // takes −4.
    untrained: {
      'Butchering Axe': { attack: -2, damage: 3, dice: '3d6', multiplier: 3 },
      'Battle Axe': { attack: 2, damage: 2, dice: '1d8', multiplier: 3 },
      'Boarding Axe': { attack: 2, damage: 2, dice: '1d6', multiplier: 3 },
    },
    // Climb is the Strength modifier alone: no unconditional bonus from the
    // boarding axe; its +2 under its Situation is the unit case 'weapons and ammunition (the weapons-and-ammo-426 keys) › applies each curated Modifier only under its Situation'.
    leaves: [['skill.clm', 2]],
    proficiency: 'butchering axe',
    trained: [
      {
        kind: 'line',
        name: 'Butchering Axe',
        line: { attack: 2, damage: 3, dice: '3d6', multiplier: 3 },
      },
    ],
    routineFor: weapons.boardingAxe,
    foreign: weapons.butcheringAxe,
  },
  {
    title:
      'sickle-sword, greataxe and dwarven boulder helmet, the sickle-sword with a −4 penalty until its proficiency is added and CMB and other AC with no unconditional bonus from the helmet',
    number: 427,
    weapons: [weapons.sickleSword, weapons.greataxe, weapons.boulderHelmet],
    // Strength 14: +2 on attack rolls, +2 on one-handed and light and +3 on
    // two-handed damage; the sickle-sword and the helmet are exotic, so
    // without their proficiencies they take −4.
    untrained: {
      'Sickle-Sword': { attack: -2, damage: 2, dice: '1d8', multiplier: 2 },
      Greataxe: { attack: 2, damage: 3, dice: '1d12', multiplier: 3 },
      'Dwarven Boulder Helmet': {
        attack: -2,
        damage: 2,
        dice: '1d4',
        multiplier: 2,
      },
    },
    // The CMB and other-AC-bonus leaves carry no unconditional bonus from
    // the helmet; its two +2 circumstance bonuses under their Situations are
    // the unit case 'weapons and ammunition (the weapons-and-ammo-427 keys) › applies each curated Modifier only under its Situation'.
    leaves: [
      ['cmb', 0],
      ['ac.other', 0],
    ],
    proficiency: 'sickle-sword',
    trained: [
      {
        kind: 'line',
        name: 'Sickle-Sword',
        line: { attack: 2, damage: 2, dice: '1d8', multiplier: 2 },
      },
    ],
    routineFor: weapons.greataxe,
    foreign: weapons.sickleSword,
  },
  {
    title:
      'scizore, earth breaker and broken-back seax, the seax with a −4 penalty until its proficiency is added and the shield and other AC leaves with no unconditional bonus from the scizore',
    number: 428,
    weapons: [weapons.scizore, weapons.earthBreaker, weapons.seax],
    // Strength 14: +2 on attack rolls, +2 on one-handed and +3 on two-handed
    // damage; the scizore takes its −1 on every attack; the seax is exotic,
    // so without its proficiency it takes −4.
    untrained: {
      Scizore: { attack: 1, damage: 2, dice: '1d10', multiplier: 2 },
      'Earth Breaker': { attack: 2, damage: 3, dice: '2d6', multiplier: 3 },
      'Broken-Back Seax': {
        attack: -2,
        damage: 2,
        dice: '1d10',
        multiplier: 2,
      },
    },
    // The shield and other AC leaves carry no unconditional bonus from the
    // scizore; its +1 shield bonus under its Situation is the unit case 'weapons and ammunition (the weapons-and-ammo-428 keys) › applies each curated Modifier only under its Situation'.
    leaves: [
      ['ac.shield', 0],
      ['ac.other', 0],
    ],
    proficiency: 'broken-back seax',
    trained: [
      {
        kind: 'line',
        name: 'Broken-Back Seax',
        line: { attack: 2, damage: 2, dice: '1d10', multiplier: 2 },
      },
    ],
    routineFor: weapons.earthBreaker,
    foreign: weapons.scizore,
  },
  {
    title:
      'meteor hammer, greatsword and elven thornblade, the meteor hammer with a −4 penalty until its proficiency is added and the shield and other AC leaves with no unconditional bonus from the meteor hammer',
    number: 429,
    weapons: [weapons.meteorHammer, weapons.greatsword, weapons.thornblade],
    // Strength 14: +2 on attack rolls, +2 on one-handed and +3 on two-handed
    // damage; the meteor hammer and elven thornblade are exotic, so without
    // their proficiency they take −4.
    untrained: {
      'Meteor Hammer': { attack: -2, damage: 3, dice: '1d8', multiplier: 2 },
      Greatsword: { attack: 2, damage: 3, dice: '2d6', multiplier: 2 },
      'Elven Thornblade': {
        attack: -2,
        damage: 2,
        dice: '1d6',
        multiplier: 2,
      },
    },
    // The shield and other AC leaves carry no unconditional bonus from the
    // meteor hammer; its +1 shield bonus in fortress mode is the unit case 'weapons and ammunition (the weapons-and-ammo-429 keys) › applies each curated Modifier only under its Situation'.
    leaves: [
      ['ac.shield', 0],
      ['ac.other', 0],
    ],
    proficiency: 'meteor hammer',
    trained: [
      {
        kind: 'line',
        name: 'Meteor Hammer',
        line: { attack: 2, damage: 3, dice: '1d8', multiplier: 2 },
      },
      { kind: 'attack', name: 'Elven Thornblade', attack: -2 },
    ],
    routineFor: weapons.greatsword,
    foreign: weapons.meteorHammer,
  },
];

describe('weapons', () => {
  for (const weaponCase of weaponCases)
    test(`an isolated sheet attacks with the ${weaponCase.title}, and refuses outsiders (the weapons-and-ammo-${weaponCase.number} keys)`, async () => {
      const { number } = weaponCase;
      const sheet = await isolatedSheet({
        prefix: `weapon${number}`,
        campaign: `Isolated reviewed weapons and ammunition #${number}`,
        namespace: `weapons-and-ammo-${number}`,
        character: 'Reviewed weapons preview',
        operationId: `create-weapons-${number}`,
        scores: { strength: 14 },
        proficiencies: [{ category: 'simple' }, { category: 'martial' }],
      });
      const { owner, member, scope } = sheet;
      const keys = [...weaponCase.weapons];
      // All three are held; their content is demonstrated on isolated
      // character-scoped copies.
      expect(keys.map(disposition)).toEqual(['held', 'held', 'held']);
      const ids = await sheet.insert('weapon', keys);
      const read = async () => {
        const saved = withSheetCatalog(
          await owner.query(api.characterSheet.read, scope),
        );
        if (!saved) throw new Error('Missing saved sheet');
        expect(calculateCharacterSheetPreview(saved).attackRoutines).toEqual(
          saved.calculated.attackRoutines,
        );
        return saved;
      };
      const entryIds = await sheet.select(ids, keys, 'carry');
      const lines = (saved: Awaited<ReturnType<typeof read>>) =>
        Object.fromEntries(
          saved.calculated.attackRoutines.map((routine) => [
            routine.name,
            {
              attack: routine.single[0]?.attackBonus.total,
              damage: routine.single[0]?.damageBonus.total,
              dice: routine.single[0]?.damageDice,
              multiplier: routine.single[0]?.criticalMultiplier.total,
            },
          ]),
        );
      // Carrying a weapon gives it an Attack Routine.
      const untrained = await read();
      expect(lines(untrained)).toEqual(weaponCase.untrained);
      for (const [leaf, total] of weaponCase.leaves)
        expect(untrained.calculated.breakdowns[leaf].total, leaf).toBe(total);
      await member.mutation(api.characterSheet.setManualProficiency, {
        ...scope,
        proficiency: { baseType: weaponCase.proficiency },
        disposition: 'added',
        operationId: `proficiency-${weaponCase.proficiency.replaceAll(' ', '-')}`,
      });
      const trained = await read();
      for (const check of weaponCase.trained)
        if (check.kind === 'line')
          expect(lines(trained)[check.name], check.name).toEqual(check.line);
        else
          expect(lines(trained)[check.name]?.attack, check.name).toBe(
            check.attack,
          );
      await sheet.refusesOthers(
        read,
        (caller, operationId) =>
          caller.mutation(api.characterSheet.createAttackRoutine, {
            ...scope,
            weaponEntryId: entryIds.get(weaponCase.routineFor)!,
            operationId,
          }),
        { kind: 'weapon', key: weaponCase.foreign },
      );
    }, 60_000);
});

/**
 * The totals every item case compares, complete: both cases name all nine
 * (the items-430 test compared six of them; the other three are literals
 * from the same sheet, so its check is stronger).
 */
type Totals = {
  strength: number;
  dexterity: number;
  constitution: number;
  wisdom: number;
  ac: number;
  fortitude: number;
  reflex: number;
  will: number;
  stealth: number;
};
/**
 * An item case: items whose imported entry has no armor block, stored; held
 * items worn, with every total before and after (complete equality); one
 * worn item's Note; and that item taken off, where `changed` lists only the
 * totals the removal changes (a partial match, as the batch tests checked
 * it).
 */
type ItemCase = {
  title: string;
  number: 430 | 431;
  scores: Partial<Scores>;
  /** Items stored that import no armor block (#762). */
  noArmor: readonly [string, ...string[]];
  worn: readonly [string, string, string];
  /** The keys whose disposition the case checks. */
  held: readonly [string, ...string[]];
  /** Their expected dispositions, one per key, written out. */
  dispositions: readonly ['held', ...'held'[]];
  before: Totals;
  wornTotals: Totals;
  note: { key: string; text: string };
  removed: { key: string; operationId: string; changed: Partial<Totals> };
};
const itemCases: ItemCase[] = [
  {
    title:
      'stores the outfit and the ring without an armor block (#762), wears held magic items without one, takes off the horseshoe',
    number: 430,
    scores: { dexterity: 14 },
    noArmor: [items.entertainersOutfit, items.ringOfProtection],
    worn: [items.iounStone, items.mightBelt, items.horseshoe],
    held: [
      items.entertainersOutfit,
      items.iounStone,
      items.mightBelt,
      items.horseshoe,
    ],
    dispositions: ['held', 'held', 'held', 'held'],
    // Stealth is the Dexterity modifier alone: +2 before, +4 with the
    // belt's +4 Dexterity.
    before: {
      strength: 10,
      dexterity: 14,
      constitution: 10,
      wisdom: 10,
      ac: 12,
      fortitude: 0,
      reflex: 2,
      will: 0,
      stealth: 2,
    },
    // Strength and Dexterity +4 enhancement, +1 insight to AC and +1 luck on
    // every save.
    wornTotals: {
      strength: 14,
      dexterity: 18,
      constitution: 10,
      wisdom: 10,
      ac: 15,
      fortitude: 1,
      reflex: 5,
      will: 1,
      stealth: 4,
    },
    note: {
      key: items.horseshoe,
      text: '+4 luck bonus on a single saving throw',
    },
    // Taking the horseshoe off removes its +1 luck bonus.
    removed: {
      key: items.horseshoe,
      operationId: 'remove-horseshoe',
      changed: { fortitude: 0, reflex: 4, will: 0 },
    },
  },
  {
    title:
      'stores the Core Rulebook outfits and the bracers without an armor block (#762), wears held items without one, takes off the tin cap',
    number: 431,
    scores: { dexterity: 14 },
    noArmor: [items.monksOutfit, items.explorersOutfit, items.bracers],
    worn: [items.perfectionBelt, items.tinCap, items.elvenkindCloak],
    held: [
      items.monksOutfit,
      items.explorersOutfit,
      items.perfectionBelt,
      items.tinCap,
      items.elvenkindCloak,
    ],
    dispositions: ['held', 'held', 'held', 'held', 'held'],
    // Stealth is the Dexterity modifier alone: +2 before, +4 with the
    // belt's +4 Dexterity.
    before: {
      strength: 10,
      dexterity: 14,
      constitution: 10,
      wisdom: 10,
      ac: 12,
      fortitude: 0,
      reflex: 2,
      will: 0,
      stealth: 2,
    },
    // Strength, Dexterity and Constitution +4 enhancement (belt), Wisdom −2
    // (the tin cap's penalty, which the curated record supplies), and no
    // Stealth bonus from the cloak until its hood is drawn up (its raw +5
    // imports as 0).
    wornTotals: {
      strength: 14,
      dexterity: 18,
      constitution: 14,
      wisdom: 8,
      ac: 14,
      fortitude: 2,
      reflex: 4,
      will: -1,
      stealth: 4,
    },
    note: { key: items.tinCap, text: 'always attempt saving throws' },
    // Taking the tin cap off removes its −2 to Wisdom.
    removed: {
      key: items.tinCap,
      operationId: 'remove-tin-cap',
      changed: { wisdom: 10, will: 0 },
    },
  },
];

it('refuses a trained check that mixes the line and attack-only shapes', () => {
  const line: Line = { attack: 2, damage: 2, dice: '1d8', multiplier: 3 };
  const complete = { kind: 'line', name: 'Shotel', line } as const;
  const attackOnly = { kind: 'attack', name: 'Shotel', attack: 2 } as const;
  const checks: TrainedCheck[] = [
    // @ts-expect-error An attack-only check carries no line.
    { kind: 'attack', name: 'Shotel', attack: 2, line },
    // @ts-expect-error A complete row spread into an attack-only check keeps its line.
    { ...complete, kind: 'attack', attack: 2 },
    // @ts-expect-error A complete check carries no separate attack.
    { kind: 'line', name: 'Shotel', line, attack: 2 },
    // @ts-expect-error An attack-only row spread into a complete check keeps its attack.
    { ...attackOnly, kind: 'line', line },
    {
      kind: 'line',
      name: 'Shotel',
      // @ts-expect-error A complete check names every field of its line.
      line: { attack: 2, damage: 2, dice: '1d8' },
    },
  ];
  expect(checks).toHaveLength(5);
});

it('refuses item totals that leave a total out', () => {
  const { stealth: _stealth, ...withoutStealth } = itemCases[0]!.before;
  const shapes: Totals[] = [
    // @ts-expect-error Every total is compared, Stealth included.
    {
      strength: 10,
      dexterity: 14,
      constitution: 10,
      wisdom: 10,
      ac: 12,
      fortitude: 0,
      reflex: 2,
      will: 0,
    },
    // @ts-expect-error A spread that drops a total is refused too.
    { ...withoutStealth },
  ];
  expect(shapes).toHaveLength(2);
});

describe('items', () => {
  for (const itemCase of itemCases)
    test(`an isolated sheet ${itemCase.title}, and keeps access to the campaign (the items-${itemCase.number} keys)`, async () => {
      const { number } = itemCase;
      const sheet = await isolatedSheet({
        prefix: `items${number}`,
        campaign: `Isolated reviewed items #${number}`,
        namespace: `items-${number}`,
        character: 'Reviewed items preview',
        operationId: `create-items-${number}`,
        scores: itemCase.scores,
        proficiencies: [],
      });
      const { owner, member, scope } = sheet;
      // #762: these import no armor block, so the stored entry schema
      // accepts them (the release path: armor-mapping.integration.test.ts).
      for (const key of itemCase.noArmor)
        expect(entries.get(key)?.detail, key).not.toHaveProperty('armor');
      await sheet.insert('item', [...itemCase.noArmor]);
      expect(itemCase.held.map(disposition)).toEqual(itemCase.dispositions);
      const keys = [...itemCase.worn];
      const ids = await sheet.insert('item', keys);
      const read = async () => {
        const saved = withSheetCatalog(
          await owner.query(api.characterSheet.read, scope),
        );
        if (!saved) throw new Error('Missing saved sheet');
        expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
          saved.calculated.derivedStatistics,
        );
        return saved;
      };
      const totals = (saved: Awaited<ReturnType<typeof read>>): Totals => ({
        strength: saved.calculated.breakdowns['ability.str'].total,
        dexterity: saved.calculated.breakdowns['ability.dex'].total,
        constitution: saved.calculated.breakdowns['ability.con'].total,
        wisdom: saved.calculated.breakdowns['ability.wis'].total,
        ac: saved.calculated.derivedStatistics.ac.total,
        fortitude: saved.calculated.derivedStatistics.fortitude.total,
        reflex: saved.calculated.derivedStatistics.reflex.total,
        will: saved.calculated.derivedStatistics.will.total,
        stealth: saved.calculated.breakdowns['skill.ste'].total,
      });
      expect(totals(await read())).toEqual(itemCase.before);
      const entryIds = await sheet.select(ids, keys, 'wear');
      const worn = await read();
      expect(totals(worn)).toEqual(itemCase.wornTotals);
      const notes =
        worn.catalogEntries
          .find((row) => row._id === ids.get(itemCase.note.key))
          ?.situationalNotes?.map((note) => note.text)
          .join(' ') ?? '';
      expect(notes).toContain(itemCase.note.text);
      await member.mutation(api.characterSheet.editSheetEntry, {
        ...scope,
        entryId: entryIds.get(itemCase.removed.key)!,
        active: false,
        operationId: itemCase.removed.operationId,
      });
      expect(totals(await read())).toMatchObject(itemCase.removed.changed);
      await sheet.refusesOthers(
        read,
        (caller, operationId) =>
          caller.mutation(api.characterSheet.editSheetEntry, {
            ...scope,
            entryId: entryIds.get(itemCase.removed.key)!,
            active: true,
            operationId,
          }),
        { kind: 'item', key: itemCase.removed.key },
      );
    }, 60_000);
});

test('an isolated sheet wears the admitted chain shirt and buckler, then swaps in the held breastplate and heavy steel shield, and keeps access to the campaign (the armors-and-shields-424 keys)', async () => {
  const sheet = await isolatedSheet({
    prefix: 'armor424',
    campaign: 'Isolated reviewed armor and shields #424',
    namespace: 'armors-and-shields-424',
    character: 'Reviewed armor preview',
    operationId: 'create-armor-424',
    scores: { dexterity: 18 },
    proficiencies: [
      { category: 'light' },
      { category: 'medium' },
      { category: 'shield' },
    ],
  });
  const { owner, member, scope } = sheet;
  expect(
    Object.fromEntries(
      [CHAIN_SHIRT, BUCKLER, BREASTPLATE, HEAVY_STEEL_SHIELD].map((key) => [
        key,
        disposition(key),
      ]),
    ),
  ).toEqual({
    [CHAIN_SHIRT]: 'admitted',
    [BUCKLER]: 'admitted',
    [BREASTPLATE]: 'held',
    [HEAVY_STEEL_SHIELD]: 'held',
  });
  const ids = await sheet.insert('armor', [
    CHAIN_SHIRT,
    BUCKLER,
    BREASTPLATE,
    HEAVY_STEEL_SHIELD,
  ]);
  const read = async () => {
    const saved = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!saved) throw new Error('Missing saved sheet');
    expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
      saved.calculated.derivedStatistics,
    );
    return saved;
  };
  const defense = (saved: Awaited<ReturnType<typeof read>>) => ({
    armor: saved.calculated.breakdowns['ac.armor'].total,
    shield: saved.calculated.breakdowns['ac.shield'].total,
    ac: saved.calculated.derivedStatistics.ac.total,
    armorCheckPenalty: saved.calculated.equipment.armorCheckPenalty,
    spellFailure: saved.calculated.equipment.spellFailure,
    maxDexterityBonus: saved.calculated.equipment.maxDexterityBonus,
    nonproficiency: saved.calculated.equipment.nonproficiencyAttackPenalty,
  });
  const entryIds = await sheet.select(ids, [CHAIN_SHIRT, BUCKLER], 'wear');
  // Chain shirt +4 armor, buckler +1 shield, Dexterity capped at +4.
  const worn = await read();
  expect(defense(worn)).toEqual({
    armor: 4,
    shield: 1,
    ac: 19,
    armorCheckPenalty: -3,
    spellFailure: 25,
    maxDexterityBonus: 4,
    nonproficiency: 0,
  });
  const bucklerNotes =
    worn.catalogEntries
      .find((row) => row._id === ids.get(BUCKLER))
      ?.situationalNotes?.map((note) => note.text)
      .join(' ') ?? '';
  expect(bucklerNotes).toContain('lose the buckler’s AC bonus');
  // Taking the buckler off removes its shield bonus and penalty.
  await member.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: entryIds.get(BUCKLER)!,
    active: false,
    operationId: 'remove-buckler',
  });
  expect(defense(await read())).toMatchObject({
    shield: 0,
    ac: 18,
    armorCheckPenalty: -2,
    spellFailure: 20,
  });
  // The breastplate and heavy steel shield, worn instead: highest-only
  // stacking keeps the breastplate's +6 over the chain shirt's +4, and the
  // shield's +2 sits on its own leaf; the breastplate caps Dexterity at +3.
  await sheet.select(ids, [BREASTPLATE, HEAVY_STEEL_SHIELD], 'wear');
  expect(defense(await read())).toEqual({
    armor: 6,
    shield: 2,
    ac: 21,
    armorCheckPenalty: -8,
    spellFailure: 60,
    maxDexterityBonus: 3,
    nonproficiency: 0,
  });
  await sheet.refusesOthers(
    read,
    (caller, operationId) =>
      caller.mutation(api.characterSheet.editEquipment, {
        ...scope,
        entryId: entryIds.get(BUCKLER)!,
        active: true,
        operationId,
      }),
    { kind: 'armor', key: BUCKLER },
  );
}, 60_000);

/**
 * A release of named records through import, serialization, staging and
 * finalization in convex-test's isolated database. Each row states, as
 * literals, the candidates and the keys the release must publish and hold;
 * none is derived from the admission the release reads. `mixed` publishes
 * its admitted items and none of its held ones, and once a fixture-only
 * control activates the release its legal inputs require the named notices.
 * `heldOnly` publishes nothing and its legal rows require no notice: it has
 * no `published` or `requiredNotices` field, not even one spread from a
 * mixed row.
 */
type ReleaseCase = {
  releaseNumber: 424 | 425;
  /** The proof name the release's parsers and sanitizers inputs carry. */
  proof: string;
  /** The keys the release must not publish. */
  held: readonly [string, ...string[]];
  /** The candidate records the release imports, counted by hand. */
  candidates: number;
} & (
  | {
      kind: 'mixed';
      /** The keys the release must publish. */
      published: readonly [string, ...string[]];
      requiredNotices: readonly [string, ...string[]];
    }
  | { kind: 'heldOnly'; published?: never; requiredNotices?: never }
);
const mixedRelease: Extract<ReleaseCase, { kind: 'mixed' }> = {
  // The equipment batches' mixed release boundary: two admitted items and
  // two held ones, none with description links.
  kind: 'mixed',
  releaseNumber: 424,
  proof: 'isolated-armors-and-shields-424-proof',
  candidates: 4,
  published: [CHAIN_SHIRT, BUCKLER],
  held: [BREASTPLATE, HEAVY_STEEL_SHIELD],
  // Only the admitted items' Core Rulebook notice is required; the held
  // items' Ultimate Equipment and Unchained notices are not.
  requiredNotices: ['PZO1110'],
};
const releaseCases: ReleaseCase[] = [
  mixedRelease,
  {
    // The empty-held boundary: three held items without description links,
    // two weapons and the arrow, whose body is the Core Rulebook DESC.
    kind: 'heldOnly',
    releaseNumber: 425,
    proof: 'isolated-weapons-and-ammo-425-proof',
    candidates: 3,
    held: [weapons.shotel, weapons.punchingDagger, ARROW],
  },
];

it('refuses a release case whose fields do not match its kind', () => {
  const held = [CHAIN_SHIRT] as const;
  const base = { releaseNumber: 425, proof: 'p', held, candidates: 1 } as const;
  const shapes: ReleaseCase[] = [
    // @ts-expect-error A mixed release names the notices it requires.
    { ...base, kind: 'mixed', published: held },
    // @ts-expect-error A mixed release names the keys it publishes.
    { ...base, kind: 'mixed', requiredNotices: ['PZO1110'] },
    {
      ...base,
      kind: 'mixed',
      published: held,
      // @ts-expect-error A mixed release requires at least one notice.
      requiredNotices: [],
    },
    // @ts-expect-error A held-only release requires no notice.
    { ...base, kind: 'heldOnly', requiredNotices: ['PZO1110'] },
    // @ts-expect-error A held-only release publishes nothing.
    { ...base, kind: 'heldOnly', published: held },
    // @ts-expect-error A held-only row spread from a mixed one keeps its notices and published keys.
    { ...mixedRelease, kind: 'heldOnly' },
    // @ts-expect-error There is no other kind.
    { ...base, kind: 'admittedOnly' },
  ];
  expect(shapes).toHaveLength(7);
});

it('refuses a held-only release that keeps either field of a mixed row alone', () => {
  // Each forbidden field on its own, spread from the mixed row with the
  // other field taken out, so removing either `never` breaks one check.
  const { published: _published, ...withNotices } = mixedRelease;
  const { requiredNotices: _notices, ...withPublished } = mixedRelease;
  const shapes: ReleaseCase[] = [
    // @ts-expect-error A held-only release keeps no notices from a spread.
    { ...withNotices, kind: 'heldOnly', releaseNumber: 425 },
    // @ts-expect-error A held-only release keeps no published keys from a spread.
    { ...withPublished, kind: 'heldOnly', releaseNumber: 425 },
  ];
  expect(shapes).toHaveLength(2);
});

describe('releases', () => {
  for (const release of releaseCases)
    test(`an isolated ${release.kind === 'mixed' ? 'release publishes the admitted items and none of the held ones' : 'release of held weapons and ammunition publishes none of them and requires no notice'} (release ${release.releaseNumber})`, async () => {
      const { releaseNumber } = release;
      const published = release.published ?? [];
      const keys = [...published, ...release.held];
      const files = await releasedRecordFiles(keys);
      expect(files).toHaveLength(release.candidates);
      const tree = await materializePinnedTree(files);
      try {
        // Each row imports its own candidates: the release is built from
        // the whole artifact, so one import of both rows' records would put
        // the admitted 424 items into the held-only 425 release. Each import
        // takes about 0.5 s on this host.
        const artifact = await importCatalog({
          ...tree,
          remaps,
          curation: reviewedCuration,
          candidateKeys: keys,
          wholeCorpus: false,
        });
        expect(artifact.curation.missing).toEqual([]);
        const created = await createBatchRelease({
          artifact,
          attribution: reviewedAdmission,
          legalResources,
          releaseNumber,
          compatibility: catalogRuntimeCompatibility,
          inputValues: {
            remaps,
            curation: reviewedCuration,
            localData: [],
            parsers: release.proof,
            sanitizers: release.proof,
            ruleResources: [],
            upstreamVerification: { status: 'unverified' },
          },
        });
        const transported = await validateCatalogReleaseArtifact(
          JSON.parse(serializeCatalogRelease(created)),
        );
        expect(computeFingerprint(transported)).toBe(
          computeFingerprint(created),
        );
        const rows = transported.batches.flat();
        const definitions = rows
          .filter((row) => row.kind === 'definition')
          .map((row) => row.key);
        for (const key of published) expect(definitions, key).toContain(key);
        for (const key of release.held)
          expect(definitions, key).not.toContain(key);
        const t = convexTest(schema, modules);
        const writeBatch = makeFunctionReference<
          'mutation',
          { releaseNumber: number; batchIndex: number; rows: unknown },
          CatalogReleaseStatus
        >('catalogRelease:writeBatch');
        await t.mutation(internal.catalogRelease.begin, {
          manifest: transported.manifest,
        });
        for (const [batchIndex, batch] of transported.batches.entries())
          await t.mutation(writeBatch, {
            releaseNumber,
            batchIndex,
            rows: batch,
          });
        await t.mutation(internal.catalogRelease.finalize, { releaseNumber });
        if (release.kind === 'heldOnly') {
          // No held item's notice is required: the release's legal rows list
          // none. No deployment or production catalog is touched.
          expect(
            rows.find(
              (row) => row.kind === 'legal' && row.key === 'requiredNotices',
            )?.payload,
          ).toEqual([]);
          return;
        }
        expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
        // This control exists only in convex-test's isolated database. No
        // deployment or production catalog is touched by the test.
        await t.run(async (ctx) => {
          const releaseId = (
            await ctx.db
              .query('catalogRelease')
              .withIndex('by_releaseNumber', (q) =>
                q.eq('releaseNumber', releaseNumber),
              )
              .unique()
          )?._id;
          if (!releaseId) throw new Error('Missing isolated prepared release');
          await ctx.db.insert('catalogReleaseControl', {
            key: 'global',
            releaseNumber,
            releaseId,
            schemaIdentity: catalogRuntimeCompatibility.schema,
            calculationIdentity: catalogRuntimeCompatibility.calculation,
            isFixtureOnly: true,
          });
        });
        const legal = releaseLegalInputsSchema.parse(
          await t.query(api.catalogRelease.legalInputs, {}),
        );
        expect(legal.requiredNotices).toEqual(release.requiredNotices);
        expect(computeFingerprint(legal.registry)).toBe(
          computeFingerprint(reviewedAdmission.registry),
        );
        expect(computeFingerprint(legal.resources)).toBe(
          computeFingerprint(legalResources),
        );
      } finally {
        await tree.dispose();
      }
    }, 90_000);
});
