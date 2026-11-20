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
import {
  assessedTraits,
  heldTraits,
  preview,
} from '../fixtures/racial-traits-391/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';

const modules = import.meta.glob('../../convex/**/*.ts');
const byKey = new Map(
  [...preview.entries, ...preview.closure].map((row) => [row.externalKey, row]),
);
const ELF = 'pf1/NgIhxRI0axrf3fcO';
// The elf's Keen Senses (Elf) and Elven Magic (closure) and this batch's
// Weapon Familiarity (Elf), Fey Wisdom and Dragon Magic.
const KEEN_SENSES = 'pf1-content/WOF6A7695wxFO2ie';
const ELVEN_MAGIC = 'pf1-content/bRO90tmeaH1tFi2g';
const WEAPON_FAMILIARITY = 'pf1-content/GS07eqHZBCT979tA';
const FEY_WISDOM = 'pf1-content/GSkWHI5OKIScXKx3';
const DRAGON_MAGIC = 'pf1-content/H1bYc9y68ZKt1auL';

/**
 * Character-scoped copies of the full-corpus preview's elf Keen Senses and
 * Elven Magic traits and three held records of this batch, with stable keys
 * mapped to the inserted IDs. The race itself is outside the batch's closure,
 * so the sheet uses a character-scoped race with the pinned Elf identity that
 * grants the three standard traits. No assessment or Catalog Release is
 * constructed.
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

test('an isolated elf sheet takes the held Fey Wisdom in place of Keen Senses and Dragon Magic in place of Elven Magic, adds no Perception and keeps access to the campaign', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, otherCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `racial391|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed racial traits #391',
      description: '',
      organizationId: 'org',
      ownerId: 'racial391|owner',
      e2eFixture: {
        namespace: 'racial-traits-391',
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
      ownerId: 'racial391|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'racial391|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'racial391|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'racial391|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed racial trait preview',
    kind: 'pc',
    operationId: 'create-racial-traits-391',
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
  // #328 S4-B admits Weapon Familiarity (Elf); the two alternates stay held.
  expect(
    assessedTraits.find((row) => row.externalKey === WEAPON_FAMILIARITY)
      ?.disposition,
  ).toBe('admitted');
  for (const key of [FEY_WISDOM, DRAGON_MAGIC])
    expect(heldTraits.find((row) => row.externalKey === key)?.disposition).toBe(
      'held',
    );
  const traits = [
    KEEN_SENSES,
    ELVEN_MAGIC,
    WEAPON_FAMILIARITY,
    FEY_WISDOM,
    DRAGON_MAGIC,
  ];
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
      // The pinned Elf identity, granting the three standard traits.
      ids.set(
        ELF,
        await ctx.db.insert('catalogEntry', {
          scope: 'character',
          characterId,
          name: 'Elf (identity only)',
          ruleIdentity: ELF,
          stacksWithItself: false,
          modifiers: [],
          sources: [],
          detail: {
            kind: 'race' as const,
            racialTraits: [
              ids.get(KEEN_SENSES)!,
              ids.get(ELVEN_MAGIC)!,
              ids.get(WEAPON_FAMILIARITY)!,
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
  const skills = (saved: Awaited<ReturnType<typeof read>>) =>
    Object.fromEntries(
      (['skill.per', 'skill.dip', 'skill.kna'] as const).map((target) => [
        target,
        saved.calculated.breakdowns[target].total,
      ]),
    );
  const notes = (saved: Awaited<ReturnType<typeof read>>, key: string) =>
    saved.catalogEntries
      .find((row) => row._id === ids.get(key))
      ?.situationalNotes?.map((note) => note.text)
      .join(' ') ?? '';
  await member.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: ids.get(ELF)!,
    operationId: 'race',
  });
  // Keen Senses (Elf) gives +2 racial Perception; Weapon Familiarity (Elf)
  // adds its readable Note.
  const elf = await read();
  expect(skills(elf)).toEqual({
    'skill.per': 2,
    'skill.dip': 0,
    'skill.kna': 0,
  });
  expect(notes(elf, WEAPON_FAMILIARITY)).toContain('longbows');
  await member.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: ids.get(FEY_WISDOM)!,
    selected: true,
    operationId: 'fey-wisdom',
  });
  // Fey Wisdom replaces Keen Senses: +1 racial Diplomacy and Knowledge
  // (nature), and the +2 Perception goes dormant.
  const wise = await read();
  expect(skills(wise)).toEqual({
    'skill.per': 0,
    'skill.dip': 1,
    'skill.kna': 1,
  });
  // Dragon Magic replaces Elven Magic; its raw +2 Perception imports as 0
  // (reviewed change replacement), so no statistic changes.
  await member.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: ids.get(DRAGON_MAGIC)!,
    selected: true,
    operationId: 'dragon-magic',
  });
  const both = await read();
  expect(skills(both)).toEqual(skills(wise));
  expect(notes(both, DRAGON_MAGIC)).toContain('draconic bloodline');
  // Turning Fey Wisdom off brings Keen Senses back.
  await member.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: ids.get(FEY_WISDOM)!,
    selected: false,
    operationId: 'fey-wisdom-off',
  });
  expect(skills(await read())).toEqual(skills(elf));
  // Outsiders, anonymous callers and another campaign's entries are refused.
  const before = await read();
  await expect(
    outsider.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: ids.get(FEY_WISDOM)!,
      selected: true,
      operationId: 'outsider',
    }),
  ).rejects.toThrow();
  await expect(
    t.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: ids.get(FEY_WISDOM)!,
      selected: true,
      operationId: 'anonymous',
    }),
  ).rejects.toThrow();
  const foreign = await t.run(async (ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: otherCampaignId,
      ...traitDefinition(FEY_WISDOM, ids),
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
