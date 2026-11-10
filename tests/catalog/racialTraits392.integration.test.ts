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
import { heldTraits, preview } from '../fixtures/racial-traits-392/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';

const modules = import.meta.glob('../../convex/**/*.ts');
const byKey = new Map(
  [...preview.entries, ...preview.closure].map((row) => [row.externalKey, row]),
);
const CHANGELING = 'pf1/9FBT6uqlRgaw9gug';
// The changeling's own ability trait (closure) and this batch's Hag Racial
// Trait (Changeling - Sea Lungs) and Snow May ability record.
const CHANGELING_ABILITIES = 'pf1-content/PxjUu8YOjXmWdagL';
const SEA_LUNGS = 'pf1-content/IQphttqw1U0aVd3j';
const SNOW_MAY = 'pf1-content/HEOPhaWDWb6tyTnS';

/**
 * Character-scoped copies of the full-corpus preview's changeling ability
 * trait and three held records of this batch, with stable keys mapped to the
 * inserted IDs. The race itself is outside the batch's closure, so the sheet
 * uses a character-scoped race with the pinned Changeling identity that grants
 * the two standard traits. No assessment or Catalog Release is constructed.
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

test('an isolated changeling sheet takes the held Snow May ability record in place of the changeling ability trait, keeps the Sea Lungs Note and keeps access to the campaign', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, otherCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `racial392|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed racial traits #392',
      description: '',
      organizationId: 'org',
      ownerId: 'racial392|owner',
      e2eFixture: {
        namespace: 'racial-traits-392',
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
      ownerId: 'racial392|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'racial392|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'racial392|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'racial392|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed racial trait preview',
    kind: 'pc',
    operationId: 'create-racial-traits-392',
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
  for (const key of [SEA_LUNGS, SNOW_MAY])
    expect(heldTraits.find((row) => row.externalKey === key)?.disposition).toBe(
      'held',
    );
  const traits = [CHANGELING_ABILITIES, SEA_LUNGS, SNOW_MAY];
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
      // The pinned Changeling identity, granting the two standard traits.
      ids.set(
        CHANGELING,
        await ctx.db.insert('catalogEntry', {
          scope: 'character',
          characterId,
          name: 'Changeling (identity only)',
          ruleIdentity: CHANGELING,
          stacksWithItself: false,
          modifiers: [],
          sources: [],
          detail: {
            kind: 'race' as const,
            racialTraits: [ids.get(CHANGELING_ABILITIES)!, ids.get(SEA_LUNGS)!],
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
  const scores = (saved: Awaited<ReturnType<typeof read>>) =>
    Object.fromEntries(
      (['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((ability) => [
        ability,
        saved.calculated.breakdowns[`ability.${ability}`].total,
      ]),
    );
  const notes = (saved: Awaited<ReturnType<typeof read>>, key: string) =>
    saved.catalogEntries
      .find((row) => row._id === ids.get(key))
      ?.situationalNotes?.map((note) => note.text)
      .join(' ') ?? '';
  await member.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: ids.get(CHANGELING)!,
    operationId: 'race',
  });
  // The changeling's ability trait (+2 Wis, +2 Cha, -2 Con); Sea Lungs adds
  // only its readable Note (holding breath for 3 x Constitution rounds).
  const changeling = await read();
  expect(scores(changeling)).toEqual({
    str: 10,
    dex: 10,
    con: 8,
    int: 10,
    wis: 12,
    cha: 12,
  });
  expect(notes(changeling, SEA_LUNGS)).toContain('hold her breath');
  await member.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: ids.get(SNOW_MAY)!,
    selected: true,
    operationId: 'snow-may',
  });
  // The Snow May ability record replaces it: +2 Int, +2 Wis, -2 Con.
  const snow = await read();
  expect(scores(snow)).toEqual({
    str: 10,
    dex: 10,
    con: 8,
    int: 12,
    wis: 12,
    cha: 10,
  });
  expect(snow.calculated.breakdowns.concentration.total).toBe(
    changeling.calculated.breakdowns.concentration.total,
  );
  // Turning the record off brings the ability trait back.
  await member.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: ids.get(SNOW_MAY)!,
    selected: false,
    operationId: 'snow-may-off',
  });
  expect(scores(await read())).toEqual(scores(changeling));
  // Outsiders, anonymous callers and another campaign's entries are refused.
  const before = await read();
  await expect(
    outsider.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: ids.get(SNOW_MAY)!,
      selected: true,
      operationId: 'outsider',
    }),
  ).rejects.toThrow();
  await expect(
    t.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: ids.get(SNOW_MAY)!,
      selected: true,
      operationId: 'anonymous',
    }),
  ).rejects.toThrow();
  const foreign = await t.run(async (ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: otherCampaignId,
      ...traitDefinition(SNOW_MAY, ids),
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
