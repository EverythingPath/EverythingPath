/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import { z } from 'zod';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import {
  modifierConditionSchema,
  modifierTargets,
  situationalNoteSchema,
} from '../../src/lib/character-sheet';
import { withSheetCatalog } from '../character-sheet-catalog';
import { assessedItems, preview } from '../fixtures/weapons-and-ammo-428/data';
import { sheetWeapon } from '../fixtures/weapons-and-ammo-428/sheet';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';

const modules = import.meta.glob('../../convex/**/*.ts');
const byKey = new Map(preview.entries.map((row) => [row.externalKey, row]));
const SCIZORE = 'pf1/fqiZkTAd1BlgOaII';
const EARTH_BREAKER = 'pf1/b0hY6M0sYwvjnMZH';
const SEAX = 'pf1/kY1zv3pOlGUfyX29';

// These bodies have no Catalog Entry ID conditions: accept only shared or
// local Situations and the weapon's own attacks, never imported external
// keys as stored references.
const localSituationSchema = z.union([
  z.string().min(1),
  z.strictObject({ local: z.string().min(1).max(4096) }),
]);
const localConditionSchema = modifierConditionSchema
  .pick({ situation: true, weapon: true })
  .extend({ situation: localSituationSchema.optional() })
  .strict();
const fixtureModifier = outputSchema.options[0].omit({ kind: true }).extend({
  target: z.enum(modifierTargets),
  condition: localConditionSchema.optional(),
});
const fixtureNote = situationalNoteSchema
  .safeExtend({
    situation: localSituationSchema.optional(),
    condition: localConditionSchema.optional(),
  })
  .strict();
/**
 * A character-scoped copy of the full-corpus preview's item: its Modifiers,
 * Notes and, for a melee weapon, its imported weapon detail in the sheet's
 * weapon shape (the test adapter; see the batch report's importer gaps). No
 * assessment or Catalog Release is constructed.
 */
function itemDefinition(key: string) {
  const entry = importedCatalogEntrySchema.parse(byKey.get(key));
  if (entry.detail.kind !== 'item') throw new Error(`${key} is not an item`);
  const weapon = entry.detail.weapon ? sheetWeapon(key) : undefined;
  return {
    name: entry.name,
    ruleIdentity: entry.externalKey,
    stacksWithItself: false,
    sources: entry.sources,
    description: entry.description,
    modifiers: entry.modifiers.map((row) => fixtureModifier.parse(row)),
    ...(entry.situationalNotes
      ? {
          situationalNotes: entry.situationalNotes.map((note) =>
            fixtureNote.parse(note),
          ),
        }
      : {}),
    detail: {
      kind: 'item' as const,
      consumable: entry.detail.consumable,
      ...(weapon
        ? {
            weapon: {
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
            },
          }
        : {}),
    },
  };
}

test('an isolated sheet attacks with the held scizore, earth breaker and broken-back seax, keeps the scizore’s shield bonus situational and refuses outsiders', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, otherCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `weapon428|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed weapons and ammunition #428',
      description: '',
      organizationId: 'org',
      ownerId: 'weapon428|owner',
      e2eFixture: {
        namespace: 'weapons-and-ammo-428',
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
      ownerId: 'weapon428|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'weapon428|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'weapon428|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'weapon428|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed weapons preview',
    kind: 'pc',
    operationId: 'create-weapons-428',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: {
      strength: 14,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    operationId: 'base-scores',
  });
  for (const proficiency of [
    { category: 'simple' as const },
    { category: 'martial' as const },
  ])
    await member.mutation(api.characterSheet.setManualProficiency, {
      ...scope,
      proficiency,
      disposition: 'added',
      operationId: `proficiency-${proficiency.category}`,
    });
  // All three are held; their reviewed content is demonstrated on isolated
  // character-scoped copies.
  expect(
    [SCIZORE, EARTH_BREAKER, SEAX].map(
      (key) =>
        assessedItems.find((row) => row.externalKey === key)?.disposition,
    ),
  ).toEqual(['held', 'held', 'held']);
  const ids = new Map<string, Id<'catalogEntry'>>();
  for (const key of [SCIZORE, EARTH_BREAKER, SEAX])
    ids.set(
      key,
      await t.run((ctx) =>
        ctx.db.insert('catalogEntry', {
          scope: 'character',
          characterId,
          ...itemDefinition(key),
        }),
      ),
    );
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
  const entryIds = new Map<string, Id<'characterSheetEntry'>>();
  for (const key of [SCIZORE, EARTH_BREAKER, SEAX])
    entryIds.set(
      key,
      await member.mutation(api.characterSheet.selectEntry, {
        ...scope,
        catalogEntryId: ids.get(key)!,
        operationId: `carry-${key}`,
      }),
    );
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
  // Carrying a weapon gives it an Attack Routine. Strength 14: +2 on attack
  // rolls, +2 on one-handed and +3 on two-handed damage; the scizore takes
  // its −1 on every attack; the seax is exotic, so without its proficiency it
  // takes −4.
  const untrained = await read();
  expect(lines(untrained)).toEqual({
    Scizore: { attack: 1, damage: 2, dice: '1d10', multiplier: 2 },
    'Earth Breaker': { attack: 2, damage: 3, dice: '2d6', multiplier: 3 },
    'Broken-Back Seax': { attack: -2, damage: 2, dice: '1d10', multiplier: 2 },
  });
  // The scizore's +1 shield bonus and +10 against disarm attempts apply only
  // in their Situations: the shield and other AC leaves carry nothing from
  // it.
  expect(untrained.calculated.breakdowns['ac.shield'].total).toBe(0);
  expect(untrained.calculated.breakdowns['ac.other'].total).toBe(0);
  await member.mutation(api.characterSheet.setManualProficiency, {
    ...scope,
    proficiency: { baseType: 'broken-back seax' },
    disposition: 'added',
    operationId: 'proficiency-broken-back-seax',
  });
  const trained = await read();
  expect(lines(trained)['Broken-Back Seax']).toEqual({
    attack: 2,
    damage: 2,
    dice: '1d10',
    multiplier: 2,
  });
  // Outsiders, anonymous callers and another campaign's entries are refused.
  const before = await read();
  await expect(
    outsider.mutation(api.characterSheet.createAttackRoutine, {
      ...scope,
      weaponEntryId: entryIds.get(EARTH_BREAKER)!,
      operationId: 'outsider',
    }),
  ).rejects.toThrow();
  await expect(
    t.mutation(api.characterSheet.createAttackRoutine, {
      ...scope,
      weaponEntryId: entryIds.get(EARTH_BREAKER)!,
      operationId: 'anonymous',
    }),
  ).rejects.toThrow();
  const foreign = await t.run(async (ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: otherCampaignId,
      ...itemDefinition(SCIZORE),
    }),
  );
  await expect(
    member.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: foreign,
      operationId: 'foreign',
    }),
  ).rejects.toThrow();
  const after = await read();
  expect(after.entries).toEqual(before.entries);
  expect(after.revision).toBe(before.revision);
}, 60_000);
