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
import { heldTraits, preview } from '../fixtures/racial-traits-397/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';

const modules = import.meta.glob('../../convex/**/*.ts');
const byKey = new Map(
  [...preview.entries, ...preview.closure].map((row) => [row.externalKey, row]),
);
const OREAD = 'pf1/4qEXPDlfIj1cIvCe';
// The oread's ability score trait (the importer's local trait that "Base
// Statistics" resolves to once a heritage's ability line is curated) and
// Energy Resistance (Oread) (closure), this batch's Spell-Like Ability
// (Oread), and this batch's Gemsoul (Crystal Oread), Granite Skin and
// Mountain-Born, which replace them.
const ABILITY = 'local/race-ability-scores/pf1/4qEXPDlfIj1cIvCe';
const ENERGY = 'pf1-content/pbItjcPIPXPP15oc';
const MAGIC = 'pf1-content/b7b9LL5pcA63eOv1';
const GEMSOUL = 'pf1-content/a1otKF9eFw6gSfvB';
const GRANITE = 'pf1-content/aD19XOFMcxvFTIYY';
const MOUNTAIN = 'pf1-content/XXB7Lnp9pMBlS5Or';

/**
 * Character-scoped copies of the full-corpus preview's oread ability score
 * trait and Energy Resistance (Oread), and four held records of this batch,
 * with stable keys mapped to the inserted IDs. The sheet uses a
 * character-scoped race with the pinned Oread identity that grants the three
 * standard traits. No assessment or Catalog Release is constructed.
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

test('an isolated oread sheet takes the held Gemsoul (Crystal Oread), Granite Skin and Mountain-Born in place of the oread traits they replace, and keeps access to the campaign', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, otherCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `racial397|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed racial traits #397',
      description: '',
      organizationId: 'org',
      ownerId: 'racial397|owner',
      e2eFixture: {
        namespace: 'racial-traits-397',
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
      ownerId: 'racial397|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'racial397|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'racial397|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'racial397|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed racial trait preview',
    kind: 'pc',
    operationId: 'create-racial-traits-397',
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
  const alternates = [GEMSOUL, GRANITE, MOUNTAIN];
  for (const key of alternates)
    expect(heldTraits.find((row) => row.externalKey === key)?.disposition).toBe(
      'held',
    );
  const granted = [ABILITY, ENERGY, MAGIC];
  expect(heldTraits.find((row) => row.externalKey === MAGIC)?.disposition).toBe(
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
      // The pinned Oread identity, granting the three standard traits.
      ids.set(
        OREAD,
        await ctx.db.insert('catalogEntry', {
          scope: 'character',
          characterId,
          name: 'Oread (identity only)',
          ruleIdentity: OREAD,
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
          'ability.str',
          'ability.wis',
          'ability.cha',
          'ac.natural',
          'skill.sen',
          'skill.acr',
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
    catalogEntryId: ids.get(OREAD)!,
    operationId: 'race',
  });
  // The oread's +2 Strength, +2 Wisdom and -2 Charisma; Sense Motive adds
  // the Wisdom modifier (+1).
  const oread = await read();
  const base = totals(oread);
  expect(base).toMatchObject({
    'ability.str': 12,
    'ability.wis': 12,
    'ability.cha': 8,
    'ac.natural': 0,
    'skill.sen': 1,
    'skill.acr': 0,
  });
  const turn = async (key: string, selected: boolean) =>
    member.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: ids.get(key)!,
      selected,
      operationId: `${key}-${selected}`,
    });
  for (const key of alternates) await turn(key, true);
  // Gemsoul: the curated ability line (+2 Str, +2 Cha, -2 Wis) replaces the
  // oread's ability score trait (+2 Str, +2 Wis, -2 Cha), so Wisdom falls to
  // 8 and Sense Motive loses 2 with it. Granite Skin: +1 racial natural armor in
  // place of energy resistance. Mountain-Born's Acrobatics bonus is a manual
  // Situation, so the total stays.
  const crystal = await read();
  expect(totals(crystal)).toEqual({
    ...base,
    'ability.wis': base['ability.wis']! - 4,
    'ability.cha': base['ability.cha']! + 4,
    'ac.natural': base['ac.natural']! + 1,
    'skill.sen': base['skill.sen']! - 2,
  });
  expect(notes(crystal, GEMSOUL)).toContain('Gemsouls');
  expect(notes(crystal, MOUNTAIN)).toContain('narrow ledges');
  expect(notes(crystal, MAGIC)).toContain('magic stone');
  // Turning them off brings the replaced traits back.
  for (const key of alternates) await turn(key, false);
  const restored = await read();
  expect(totals(restored)).toEqual(base);
  // Outsiders, anonymous callers and another campaign's entries are refused.
  const before = await read();
  await expect(
    outsider.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: ids.get(GEMSOUL)!,
      selected: true,
      operationId: 'outsider',
    }),
  ).rejects.toThrow();
  await expect(
    t.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: ids.get(GEMSOUL)!,
      selected: true,
      operationId: 'anonymous',
    }),
  ).rejects.toThrow();
  const foreign = await t.run(async (ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: otherCampaignId,
      ...traitDefinition(GEMSOUL, ids),
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
