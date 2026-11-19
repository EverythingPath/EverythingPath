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
import { heldTraits, preview } from '../fixtures/racial-traits-399/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';

const modules = import.meta.glob('../../convex/**/*.ts');
const byKey = new Map(
  [...preview.entries, ...preview.closure].map((row) => [row.externalKey, row]),
);
const TIEFLING = 'pf1/nVjKDLZSRONzYm8f';
// The tiefling's ability score trait (the importer's local trait that "Base
// Statistics" resolves to once a heritage's ability line is curated), the
// tiefling's Skilled (#389), this batch's Demon-Spawn (Pitborn), which
// replaces the ability score trait, and this batch's Vestigial Wings, which
// replaces Skilled.
const ABILITY = 'local/race-ability-scores/pf1/nVjKDLZSRONzYm8f';
const SKILLED = 'pf1-content/AKuDJrwJUZULsJcS';
const PITBORN = 'pf1-content/emgcgmgSjpuv1GHa';
const WINGS = 'pf1-content/gxxWYxmCBUIWCPqU';

/**
 * Character-scoped copies of the full-corpus preview's tiefling ability score
 * trait, the tiefling's Skilled and two held records of this batch, with
 * stable keys mapped to the inserted IDs. The sheet uses a character-scoped
 * race with the pinned Tiefling identity that grants the two standard traits.
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

test('an isolated tiefling sheet takes the held Demon-Spawn (Pitborn) in place of the tiefling ability score trait and Vestigial Wings in place of Skilled, and keeps access to the campaign', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, otherCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `racial399|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed racial traits #399',
      description: '',
      organizationId: 'org',
      ownerId: 'racial399|owner',
      e2eFixture: {
        namespace: 'racial-traits-399',
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
      ownerId: 'racial399|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'racial399|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'racial399|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'racial399|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed racial trait preview',
    kind: 'pc',
    operationId: 'create-racial-traits-399',
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
  const alternates = [PITBORN, WINGS];
  const granted = [ABILITY, SKILLED];
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
      // The pinned Tiefling identity, granting the two standard traits.
      ids.set(
        TIEFLING,
        await ctx.db.insert('catalogEntry', {
          scope: 'character',
          characterId,
          name: 'Tiefling (identity only)',
          ruleIdentity: TIEFLING,
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
          'ability.dex',
          'ability.int',
          'ability.cha',
          'skill.blf',
          'skill.ste',
          'skill.fly',
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
    catalogEntryId: ids.get(TIEFLING)!,
    operationId: 'race',
  });
  // The tiefling's +2 Dexterity, +2 Intelligence and -2 Charisma; Skilled's
  // +2 racial Bluff and Stealth. Skills add the ability modifier.
  const tiefling = await read();
  const base = totals(tiefling);
  expect(base).toMatchObject({
    'ability.str': 10,
    'ability.dex': 12,
    'ability.int': 12,
    'ability.cha': 8,
    'skill.blf': 1,
    'skill.ste': 3,
    'skill.fly': 1,
  });
  const turn = async (key: string, selected: boolean) =>
    member.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: ids.get(key)!,
      selected,
      operationId: `${key}-${selected}`,
    });
  // Demon-Spawn (Pitborn): the curated ability line (+2 Str, +2 Cha, -2 Int)
  // replaces the tiefling's (+2 Dex, +2 Int, -2 Cha), and the skills follow
  // their abilities.
  await turn(PITBORN, true);
  const pitborn = await read();
  expect(totals(pitborn)).toEqual({
    'ability.str': 12,
    'ability.dex': 10,
    'ability.int': 8,
    'ability.cha': 12,
    'skill.blf': 3,
    'skill.ste': 2,
    'skill.fly': 0,
  });
  expect(notes(pitborn, PITBORN)).toContain('Ancestry Demon');
  // Vestigial Wings replaces Skilled: Bluff and Stealth lose their +2 racial
  // bonus and Fly gains the wings' +4 racial bonus.
  await turn(WINGS, true);
  const winged = await read();
  expect(totals(winged)).toEqual({
    ...totals(pitborn),
    'skill.blf': 1,
    'skill.ste': 0,
    'skill.fly': 4,
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
      catalogEntryId: ids.get(PITBORN)!,
      selected: true,
      operationId: 'outsider',
    }),
  ).rejects.toThrow();
  await expect(
    t.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: ids.get(PITBORN)!,
      selected: true,
      operationId: 'anonymous',
    }),
  ).rejects.toThrow();
  const foreign = await t.run(async (ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: otherCampaignId,
      ...traitDefinition(PITBORN, ids),
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
