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
import { heldTraits, preview } from '../fixtures/racial-traits-394/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';

const modules = import.meta.glob('../../convex/**/*.ts');
const byKey = new Map(
  [...preview.entries, ...preview.closure].map((row) => [row.externalKey, row]),
);
const HALFLING = 'pf1/Hf31mrYb3uucNyLO';
// The halfling's own Halfling Luck, Sure-Footed and Keen Senses (Halfling)
// (closure) and this batch's Unlucky Halfling, Secretive Survivor and Fey Magic
// (Halfling), which replace them one for one.
const HALFLING_LUCK = 'pf1-content/HVI7FNwj2ng10qtj';
const SURE_FOOTED = 'pf1-content/sSs0BK09PLxjbkAa';
const KEEN_SENSES = 'pf1-content/XVo4DApULZaETYcz';
const UNLUCKY = 'pf1-content/QK5CNiDmMqT3cdFB';
const SECRETIVE = 'pf1-content/O0p9WY2bZpciuXs4';
const FEY_MAGIC = 'pf1-content/Q9DPJigrJ8kDDemn';

/**
 * Character-scoped copies of the full-corpus preview's three halfling
 * standard traits and three held records of this batch, with stable keys mapped
 * to the inserted IDs. The sheet uses a character-scoped race with the pinned
 * Halfling identity that grants the three standard traits. No assessment or
 * Catalog Release is constructed.
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

test('an isolated halfling sheet takes the held Unlucky Halfling, Secretive Survivor and Fey Magic (Halfling) in place of the halfling traits they replace, and keeps access to the campaign', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, otherCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `racial394|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed racial traits #394',
      description: '',
      organizationId: 'org',
      ownerId: 'racial394|owner',
      e2eFixture: {
        namespace: 'racial-traits-394',
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
      ownerId: 'racial394|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'racial394|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'racial394|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'racial394|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed racial trait preview',
    kind: 'pc',
    operationId: 'create-racial-traits-394',
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
  const alternates = [UNLUCKY, SECRETIVE, FEY_MAGIC];
  for (const key of alternates)
    expect(heldTraits.find((row) => row.externalKey === key)?.disposition).toBe(
      'held',
    );
  const traits = [HALFLING_LUCK, SURE_FOOTED, KEEN_SENSES, ...alternates];
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
      // The pinned Halfling identity, granting the three standard traits.
      ids.set(
        HALFLING,
        await ctx.db.insert('catalogEntry', {
          scope: 'character',
          characterId,
          name: 'Halfling (identity only)',
          ruleIdentity: HALFLING,
          stacksWithItself: false,
          modifiers: [],
          sources: [],
          detail: {
            kind: 'race' as const,
            racialTraits: [
              ids.get(HALFLING_LUCK)!,
              ids.get(SURE_FOOTED)!,
              ids.get(KEEN_SENSES)!,
            ],
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
          'save.fort',
          'save.ref',
          'save.will',
          'skill.acr',
          'skill.clm',
          'skill.blf',
          'skill.ste',
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
    catalogEntryId: ids.get(HALFLING)!,
    operationId: 'race',
  });
  // Halfling Luck (+1 racial on all saves), Sure-Footed (+2 racial Acrobatics
  // and Climb) and Keen Senses (+2 racial Perception).
  const halfling = await read();
  const base = totals(halfling);
  const turn = async (key: string, selected: boolean) =>
    member.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: ids.get(key)!,
      selected,
      operationId: `${key}-${selected}`,
    });
  for (const key of alternates) await turn(key, true);
  // Unlucky Halfling: Halfling Luck goes dormant and its -1 untyped penalty
  // applies (+1 to -1). Secretive Survivor: Sure-Footed goes dormant and its
  // +2 racial Bluff and Stealth apply. Fey Magic (Halfling): Keen Senses goes
  // dormant; its spell-like abilities stay readable.
  const unlucky = await read();
  expect(totals(unlucky)).toEqual({
    ...base,
    'save.fort': base['save.fort']! - 2,
    'save.ref': base['save.ref']! - 2,
    'save.will': base['save.will']! - 2,
    'skill.acr': base['skill.acr']! - 2,
    'skill.clm': base['skill.clm']! - 2,
    'skill.blf': base['skill.blf']! + 2,
    'skill.ste': base['skill.ste']! + 2,
    'skill.per': base['skill.per']! - 2,
  });
  expect(notes(unlucky, FEY_MAGIC)).toContain('resist nature');
  expect(notes(unlucky, UNLUCKY)).toContain('ill omen');
  // Turning them off brings the replaced traits back.
  for (const key of alternates) await turn(key, false);
  const restored = await read();
  expect(totals(restored)).toEqual(base);
  // Outsiders, anonymous callers and another campaign's entries are refused.
  const before = await read();
  await expect(
    outsider.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: ids.get(UNLUCKY)!,
      selected: true,
      operationId: 'outsider',
    }),
  ).rejects.toThrow();
  await expect(
    t.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: ids.get(UNLUCKY)!,
      selected: true,
      operationId: 'anonymous',
    }),
  ).rejects.toThrow();
  const foreign = await t.run(async (ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: otherCampaignId,
      ...traitDefinition(UNLUCKY, ids),
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
