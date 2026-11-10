/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { expect, test } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import type { CatalogReleaseStatus } from '../../src/lib/catalog/release-validators';
import { z } from 'zod';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import {
  modifierConditionSchema,
  modifierTargets,
  situationalNoteSchema,
} from '../../src/lib/character-sheet';
import { armorCategory } from '../../src/lib/character-sheet-armor-categories';
import { withSheetCatalog } from '../character-sheet-catalog';
import {
  assessedItems,
  preview,
} from '../fixtures/armors-and-shields-424/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';

const modules = import.meta.glob('../../convex/**/*.ts');
const byKey = new Map(preview.entries.map((row) => [row.externalKey, row]));
const CHAIN_SHIRT = 'pf1/iGu21zy6QtroUZ4O';
const BUCKLER = 'pf1/gsE0PAOmCwivue5A';
const BREASTPLATE = 'pf1/5TzaS38RPAx1oj9p';
const HEAVY_STEEL_SHIELD = 'pf1/2fK608aSYU9QDmzw';

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
/**
 * A character-scoped copy of the full-corpus preview's item: its imported
 * armor block, Modifiers and Notes. The shield bash weapon is left out (its
 * proficiency is an importer fallback the sheet doesn't take). No assessment
 * or Catalog Release is constructed.
 */
function itemDefinition(key: string) {
  const entry = importedCatalogEntrySchema.parse(byKey.get(key));
  if (entry.detail.kind !== 'item' || !entry.detail.armor)
    throw new Error(`${key} is not armor or a shield`);
  const category = armorCategory(entry.detail.armor.category);
  if (!category) throw new Error(`${key} has no known category`);
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
      armor: {
        slot: entry.detail.armor.slot,
        category: entry.detail.armor.category as typeof category,
        bonus: entry.detail.armor.bonus,
        maxDex: entry.detail.armor.maxDex,
        armorCheckPenalty: entry.detail.armor.armorCheckPenalty,
        asf: entry.detail.armor.asf,
      },
    },
  };
}

test('an isolated sheet wears the admitted chain shirt and buckler, then swaps in the held breastplate and heavy steel shield, and keeps access to the campaign', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, otherCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `armor424|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed armor and shields #424',
      description: '',
      organizationId: 'org',
      ownerId: 'armor424|owner',
      e2eFixture: {
        namespace: 'armors-and-shields-424',
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
      ownerId: 'armor424|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'armor424|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'armor424|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'armor424|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed armor preview',
    kind: 'pc',
    operationId: 'create-armor-424',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: {
      strength: 10,
      dexterity: 18,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    operationId: 'base-scores',
  });
  for (const category of ['light', 'medium', 'shield'] as const)
    await member.mutation(api.characterSheet.setManualProficiency, {
      ...scope,
      proficiency: { category },
      disposition: 'added',
      operationId: `proficiency-${category}`,
    });
  expect(
    Object.fromEntries(
      [CHAIN_SHIRT, BUCKLER, BREASTPLATE, HEAVY_STEEL_SHIELD].map((key) => [
        key,
        assessedItems.find((row) => row.externalKey === key)?.disposition,
      ]),
    ),
  ).toEqual({
    [CHAIN_SHIRT]: 'admitted',
    [BUCKLER]: 'admitted',
    [BREASTPLATE]: 'held',
    [HEAVY_STEEL_SHIELD]: 'held',
  });
  const ids = new Map<string, Id<'catalogEntry'>>();
  for (const key of [CHAIN_SHIRT, BUCKLER, BREASTPLATE, HEAVY_STEEL_SHIELD])
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
  const defense = (saved: Awaited<ReturnType<typeof read>>) => ({
    armor: saved.calculated.breakdowns['ac.armor'].total,
    shield: saved.calculated.breakdowns['ac.shield'].total,
    ac: saved.calculated.derivedStatistics.ac.total,
    armorCheckPenalty: saved.calculated.equipment.armorCheckPenalty,
    spellFailure: saved.calculated.equipment.spellFailure,
    maxDexterityBonus: saved.calculated.equipment.maxDexterityBonus,
    nonproficiency: saved.calculated.equipment.nonproficiencyAttackPenalty,
  });
  const entryIds = new Map<string, Id<'characterSheetEntry'>>();
  for (const key of [CHAIN_SHIRT, BUCKLER])
    entryIds.set(
      key,
      await member.mutation(api.characterSheet.selectEntry, {
        ...scope,
        catalogEntryId: ids.get(key)!,
        operationId: `wear-${key}`,
      }),
    );
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
  // The held breastplate and heavy steel shield, worn instead: highest-only
  // stacking keeps the breastplate's +6 over the chain shirt's +4, and the
  // shield's +2 sits on its own leaf; the breastplate caps Dexterity at +3.
  for (const key of [BREASTPLATE, HEAVY_STEEL_SHIELD])
    await member.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: ids.get(key)!,
      operationId: `wear-${key}`,
    });
  expect(defense(await read())).toEqual({
    armor: 6,
    shield: 2,
    ac: 21,
    armorCheckPenalty: -8,
    spellFailure: 60,
    maxDexterityBonus: 3,
    nonproficiency: 0,
  });
  // Outsiders, anonymous callers and another campaign's entries are refused.
  const before = await read();
  await expect(
    outsider.mutation(api.characterSheet.editEquipment, {
      ...scope,
      entryId: entryIds.get(BUCKLER)!,
      active: true,
      operationId: 'outsider',
    }),
  ).rejects.toThrow();
  await expect(
    t.mutation(api.characterSheet.editEquipment, {
      ...scope,
      entryId: entryIds.get(BUCKLER)!,
      active: true,
      operationId: 'anonymous',
    }),
  ).rejects.toThrow();
  const foreign = await t.run(async (ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: otherCampaignId,
      ...itemDefinition(BUCKLER),
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

// The equipment batches' mixed release boundary: admitted and held items in one
// release, with fixture-only activation and the public legal inputs. The
// empty-held boundary is weaponsAndAmmo425's release test.
test('an isolated release publishes the admitted chain shirt and buckler and none of the held items', async () => {
  const { materializePinnedTree } = await import('./pinned-sources');
  const { importCatalog } = await import('../../scripts/catalog/import');
  const { reviewedCuration } =
    await import('../../scripts/catalog/reviewed-curation-data');
  const { createCatalogRelease, serializeCatalogRelease } =
    await import('../../scripts/catalog/release');
  const { validateCatalogReleaseArtifact } =
    await import('../../src/lib/catalog/release-schema');
  const { catalogRuntimeCompatibility } =
    await import('../../src/lib/catalog/runtime-compatibility');
  const { releaseLegalInputsSchema } =
    await import('../../src/lib/catalog/release-legal-inputs');
  const { computeFingerprint } =
    await import('../../scripts/catalog/admission');
  const { reviewedAdmission, legalResources } =
    await import('../../src/lib/catalog/reviewed-data');
  const { default: remaps } =
    await import('../../scripts/catalog/reviewed-remaps.json');
  // Two admitted items and two held ones, none with description links.
  const rows = assessedItems.filter((row) =>
    [CHAIN_SHIRT, BUCKLER, BREASTPLATE, HEAVY_STEEL_SHIELD].includes(
      row.externalKey,
    ),
  );
  expect(rows).toHaveLength(4);
  const files = rows.map((row) => `${row.source.repo}/${row.source.path}`);
  const tree = await materializePinnedTree(files, {
    sha256: Object.fromEntries(
      rows.map((row) => [
        `${row.source.repo}/${row.source.path}`,
        row.source.sha256,
      ]),
    ),
  });
  try {
    const artifact = await importCatalog({
      ...tree,
      remaps,
      curation: reviewedCuration,
      candidateKeys: rows.map((row) => row.externalKey),
    });
    expect(artifact.curation.missing).toEqual([]);
    const release = await createCatalogRelease({
      artifact,
      attribution: reviewedAdmission,
      legalResources,
      releaseNumber: 424,
      compatibility: catalogRuntimeCompatibility,
      inputValues: {
        remaps,
        curation: reviewedCuration,
        localData: [],
        parsers: 'isolated-armors-and-shields-424-proof',
        sanitizers: 'isolated-armors-and-shields-424-proof',
        ruleResources: [],
        upstreamVerification: { status: 'unverified' },
      },
    });
    const transported = await validateCatalogReleaseArtifact(
      JSON.parse(serializeCatalogRelease(release)),
    );
    expect(computeFingerprint(transported)).toBe(computeFingerprint(release));
    const published = transported.batches.flat();
    for (const row of rows)
      expect(
        published.some(
          (candidate) =>
            candidate.kind === 'definition' &&
            candidate.key === row.externalKey,
        ),
        row.name,
      ).toBe(row.disposition === 'admitted');
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
        releaseNumber: 424,
        batchIndex,
        rows: batch,
      });
    await t.mutation(internal.catalogRelease.finalize, { releaseNumber: 424 });
    expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
    // This control exists only in convex-test's isolated database. No
    // deployment or production catalog is touched by the test.
    await t.run(async (ctx) => {
      const releaseId = (
        await ctx.db
          .query('catalogRelease')
          .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 424))
          .unique()
      )?._id;
      if (!releaseId) throw new Error('Missing isolated prepared release');
      await ctx.db.insert('catalogReleaseControl', {
        key: 'global',
        releaseNumber: 424,
        releaseId,
        schemaIdentity: catalogRuntimeCompatibility.schema,
        calculationIdentity: catalogRuntimeCompatibility.calculation,
        isFixtureOnly: true,
      });
    });
    const legal = releaseLegalInputsSchema.parse(
      await t.query(api.catalogRelease.legalInputs, {}),
    );
    // Only the admitted items' Core Rulebook notice is required; the held
    // items' Ultimate Equipment and Unchained notices are not.
    expect(legal.requiredNotices).toEqual(['PZO1110']);
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
