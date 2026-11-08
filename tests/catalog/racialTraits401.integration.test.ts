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
import { heldTraits, preview } from '../fixtures/racial-traits-401/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';

const modules = import.meta.glob('../../convex/**/*.ts');
const byKey = new Map(
  [...preview.entries, ...preview.closure].map((row) => [row.externalKey, row]),
);
const SKINWALKER = 'pf1/apWl6JIJ8U8p0azq';
// The skinwalker's ability score trait (the importer's local trait that "Base
// Statistics" resolves to once a heritage's ability line is curated), the
// skinwalker's Animal-Minded (#392), this batch's Werebat-Kin (Bloodmarked),
// which replaces the ability score trait, and this batch's Alternate Skill
// Modifiers (Skinwalker - Bloodmarked), which replaces Animal-Minded.
const ABILITY = 'local/race-ability-scores/pf1/apWl6JIJ8U8p0azq';
const ANIMAL_MINDED = 'pf1-content/bPkht5w4AKauP8Ip';
const WEREBAT = 'pf1-content/mBfn8hCLwEsAxlnl';
const BLOODMARKED = 'pf1-content/mDDre98oyYIFLJy5';

/**
 * Character-scoped copies of the full-corpus preview's skinwalker ability
 * score trait, the skinwalker's Animal-Minded and two held records of this
 * batch, with stable keys mapped to the inserted IDs. The sheet uses a
 * character-scoped race with the pinned Skinwalker identity that grants the
 * two standard traits.
 * No assessment or Catalog Release is constructed.
 */
// These bodies have no Catalog Entry ID conditions: accept only shared or
// local Situations, never imported external keys as stored references.
const localSituationSchema = z.union([
  z.string().min(1),
  z.strictObject({ local: z.string().min(1).max(4096) }),
]);
const localConditionSchema = modifierConditionSchema
  .pick({ situation: true, school: true })
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
function common(key: string) {
  const entry = importedCatalogEntrySchema.parse(byKey.get(key));
  return {
    entry,
    fields: {
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
    },
  };
}
function mapped(ids: Map<string, Id<'catalogEntry'>>) {
  return (ref: string) => {
    const found = ids.get(ref);
    if (!found) throw new Error(`Missing fixture ${ref}`);
    return found;
  };
}
function traitDefinition(key: string, ids: Map<string, Id<'catalogEntry'>>) {
  const { entry, fields } = common(key);
  if (entry.detail.kind !== 'racialTrait')
    throw new Error(`${key} is not a racial trait`);
  return {
    ...fields,
    detail: {
      kind: 'racialTrait' as const,
      raceEntryIds: (entry.detail.raceKeys ?? []).map(mapped(ids)),
      replaces: (entry.detail.replaces ?? []).map(mapped(ids)),
    },
  };
}

test('an isolated skinwalker sheet takes the held Werebat-Kin (Bloodmarked) in place of the skinwalker ability score trait and the Bloodmarked skill part in place of Animal-Minded, and keeps access to the campaign', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, otherCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `racial401|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed racial traits #401',
      description: '',
      organizationId: 'org',
      ownerId: 'racial401|owner',
      e2eFixture: {
        namespace: 'racial-traits-401',
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
      ownerId: 'racial401|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'racial401|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'racial401|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'racial401|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed racial trait preview',
    kind: 'pc',
    operationId: 'create-racial-traits-401',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    operationId: 'base-scores',
  });
  const alternates = [WEREBAT, BLOODMARKED];
  const granted = [ABILITY, ANIMAL_MINDED];
  for (const key of alternates)
    expect(heldTraits.find((row) => row.externalKey === key)?.disposition).toBe(
      'held',
    );
  const traits = [...granted, ...alternates];
  const ids = await t
    .run(async (ctx) => {
      const ids = new Map<string, Id<'catalogEntry'>>();
      // Insert placeholders first so references can be mapped, then fill them.
      for (const key of traits)
        ids.set(
          key,
          await ctx.db.insert('catalogEntry', {
            scope: 'character',
            characterId,
            name: key,
            ruleIdentity: key,
            stacksWithItself: false,
            modifiers: [],
            sources: [],
            detail: {
              kind: 'racialTrait' as const,
              raceEntryIds: [],
              replaces: [],
            },
          }),
        );
      // The pinned Skinwalker identity, granting the two standard traits.
      ids.set(
        SKINWALKER,
        await ctx.db.insert('catalogEntry', {
          scope: 'character',
          characterId,
          name: 'Skinwalker (identity only)',
          ruleIdentity: SKINWALKER,
          stacksWithItself: false,
          modifiers: [],
          sources: [],
          detail: {
            kind: 'race' as const,
            racialTraits: granted.map((key) => ids.get(key)!),
          },
        }),
      );
      for (const key of traits)
        await ctx.db.replace('catalogEntry', ids.get(key)!, {
          scope: 'character',
          characterId,
          ...traitDefinition(key, ids),
        });
      return Object.fromEntries(ids);
    })
    .then((rows) => new Map(Object.entries(rows)));
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
  const totals = (saved: Awaited<ReturnType<typeof read>>) =>
    Object.fromEntries(
      (
        [
          'ability.dex',
          'ability.int',
          'ability.wis',
          'skill.han',
          'skill.fly',
          'skill.per',
        ] as const
      ).map((target) => [target, saved.calculated.breakdowns[target].total]),
    );
  const notes = (saved: Awaited<ReturnType<typeof read>>, key: string) =>
    saved.catalogEntries
      .find((row) => row._id === ids.get(key))
      ?.situationalNotes?.map((note) => note.text)
      .join(' ') ?? '';
  await member.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: ids.get(SKINWALKER)!,
    operationId: 'race',
  });
  // The skinwalker's +2 Wisdom and -2 Intelligence; Animal-Minded's +2 racial
  // Handle Animal. Skills add the ability modifier.
  const skinwalker = await read();
  const base = totals(skinwalker);
  expect(base).toEqual({
    'ability.dex': 10,
    'ability.int': 8,
    'ability.wis': 12,
    'skill.han': 2,
    'skill.fly': 0,
    'skill.per': 1,
  });
  const turn = async (key: string, selected: boolean) =>
    member.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: ids.get(key)!,
      selected,
      operationId: `${key}-${selected}`,
    });
  // Werebat-Kin (Bloodmarked): the curated ability line (+2 Int, -2 Wis)
  // replaces the skinwalker's (+2 Wis, -2 Int), and Perception follows Wisdom.
  await turn(WEREBAT, true);
  const werebat = await read();
  expect(totals(werebat)).toEqual({
    'ability.dex': 10,
    'ability.int': 12,
    'ability.wis': 8,
    'skill.han': 2,
    'skill.fly': 0,
    'skill.per': -1,
  });
  expect(notes(werebat, WEREBAT)).toContain('Ancestry werebat');
  // The Bloodmarked skill part replaces Animal-Minded: Handle Animal loses its
  // +2 racial bonus and Fly gains one; the Perception bonus at night is a
  // Situation the player selects.
  await turn(BLOODMARKED, true);
  const bloodmarked = await read();
  expect(totals(bloodmarked)).toEqual({
    ...totals(werebat),
    'skill.han': 0,
    'skill.fly': 2,
  });
  // Turning them off brings the replaced traits back.
  for (const key of alternates) await turn(key, false);
  const restored = await read();
  expect(totals(restored)).toEqual(base);
  // Outsiders, anonymous callers and another campaign's entries are refused.
  const before = await read();
  await expect(
    outsider.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: ids.get(WEREBAT)!,
      selected: true,
      operationId: 'outsider',
    }),
  ).rejects.toThrow();
  await expect(
    t.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: ids.get(WEREBAT)!,
      selected: true,
      operationId: 'anonymous',
    }),
  ).rejects.toThrow();
  const foreign = await t.run(async (ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: otherCampaignId,
      ...traitDefinition(WEREBAT, ids),
    }),
  );
  await expect(
    member.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: foreign,
      selected: true,
      operationId: 'foreign',
    }),
  ).rejects.toThrow();
  const after = await read();
  expect(after.entries).toEqual(before.entries);
  expect(after.revision).toBe(before.revision);
}, 60_000);
