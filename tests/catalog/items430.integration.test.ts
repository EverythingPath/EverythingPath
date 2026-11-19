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
import { assessedItems, preview } from '../fixtures/items-430/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';

const modules = import.meta.glob('../../convex/**/*.ts');
const byKey = new Map(preview.entries.map((row) => [row.externalKey, row]));
const ENTERTAINERS_OUTFIT = 'pf1/6kZGQ2chmr3jpS1t';
const RING_OF_PROTECTION = 'pf1/0AIz2Gk74uaiLQIh';
const IOUN_STONE = 'pf1/71VGp1a4z1BQFNXu';
const HORSESHOE = 'pf1/7P3H1yV8835Am6c6';
const MIGHT_BELT = 'pf1/1hPPkMMfEuJha8YB';

// These bodies have no Catalog Entry ID conditions: accept only shared or
// local Situations, never imported external keys as stored references.
const localSituationSchema = z.union([
  z.string().min(1),
  z.strictObject({ local: z.string().min(1).max(4096) }),
]);
const localConditionSchema = modifierConditionSchema
  .pick({ situation: true })
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
 * A character-scoped copy of the full-corpus preview's item: its imported
 * Modifiers, Notes and armor block, unchanged. No assessment or Catalog
 * Release is constructed.
 */
function itemDefinition(key: string) {
  const entry = importedCatalogEntrySchema.parse(byKey.get(key));
  if (entry.detail.kind !== 'item') throw new Error(`${key} is not an item`);
  const armor = entry.detail.armor;
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
      ...(armor
        ? {
            armor: {
              slot: armor.slot,
              category: armor.category as never,
              bonus: armor.bonus,
              maxDex: armor.maxDex,
              armorCheckPenalty: armor.armorCheckPenalty,
              asf: armor.asf,
            },
          }
        : {}),
    },
  };
}

test('an isolated sheet stores the outfit and the ring without an armor block (#762), wears held magic items without one, takes off the horseshoe, and keeps access to the campaign', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, otherCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `items430|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed items #430',
      description: '',
      organizationId: 'org',
      ownerId: 'items430|owner',
      e2eFixture: {
        namespace: 'items-430',
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
      ownerId: 'items430|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'items430|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'items430|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'items430|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed items preview',
    kind: 'pc',
    operationId: 'create-items-430',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: {
      strength: 10,
      dexterity: 14,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    operationId: 'base-scores',
  });
  // #762: the outfit and the ring import no armor block, so the stored entry schema
  // accepts them (the release path: armor-mapping.integration.test.ts).
  for (const key of [ENTERTAINERS_OUTFIT, RING_OF_PROTECTION]) {
    expect(byKey.get(key)?.detail, key).not.toHaveProperty('armor');
    await t.run((ctx) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...itemDefinition(key),
      }),
    );
  }
  const keys = [IOUN_STONE, MIGHT_BELT, HORSESHOE];
  expect(
    [ENTERTAINERS_OUTFIT, ...keys].map(
      (key) =>
        assessedItems.find((row) => row.externalKey === key)?.disposition,
    ),
  ).toEqual(['held', 'held', 'held', 'held']);
  const ids = new Map<string, Id<'catalogEntry'>>();
  for (const key of keys)
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
    expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
      saved.calculated.derivedStatistics,
    );
    return saved;
  };
  const totals = (saved: Awaited<ReturnType<typeof read>>) => ({
    strength: saved.calculated.breakdowns['ability.str'].total,
    dexterity: saved.calculated.breakdowns['ability.dex'].total,
    ac: saved.calculated.derivedStatistics.ac.total,
    fortitude: saved.calculated.derivedStatistics.fortitude.total,
    reflex: saved.calculated.derivedStatistics.reflex.total,
    will: saved.calculated.derivedStatistics.will.total,
  });
  expect(totals(await read())).toEqual({
    strength: 10,
    dexterity: 14,
    ac: 12,
    fortitude: 0,
    reflex: 2,
    will: 0,
  });
  // The held items worn: Strength and Dexterity +4 enhancement, +1 insight
  // to AC and +1 luck on every save.
  const entryIds = new Map<string, Id<'characterSheetEntry'>>();
  for (const key of keys)
    entryIds.set(
      key,
      await member.mutation(api.characterSheet.selectEntry, {
        ...scope,
        catalogEntryId: ids.get(key)!,
        operationId: `wear-${key}`,
      }),
    );
  const worn = await read();
  expect(totals(worn)).toEqual({
    strength: 14,
    dexterity: 18,
    ac: 15,
    fortitude: 1,
    reflex: 5,
    will: 1,
  });
  const horseshoeNotes =
    worn.catalogEntries
      .find((row) => row._id === ids.get(HORSESHOE))
      ?.situationalNotes?.map((note) => note.text)
      .join(' ') ?? '';
  expect(horseshoeNotes).toContain('+4 luck bonus on a single saving throw');
  // Taking the horseshoe off removes its +1 luck bonus.
  await member.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId: entryIds.get(HORSESHOE)!,
    active: false,
    operationId: 'remove-horseshoe',
  });
  expect(totals(await read())).toMatchObject({
    fortitude: 0,
    reflex: 4,
    will: 0,
  });
  // Outsiders, anonymous callers and another campaign's entries are refused.
  const before = await read();
  await expect(
    outsider.mutation(api.characterSheet.editSheetEntry, {
      ...scope,
      entryId: entryIds.get(HORSESHOE)!,
      active: true,
      operationId: 'outsider',
    }),
  ).rejects.toThrow();
  await expect(
    t.mutation(api.characterSheet.editSheetEntry, {
      ...scope,
      entryId: entryIds.get(HORSESHOE)!,
      active: true,
      operationId: 'anonymous',
    }),
  ).rejects.toThrow();
  const foreign = await t.run(async (ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: otherCampaignId,
      ...itemDefinition(HORSESHOE),
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
