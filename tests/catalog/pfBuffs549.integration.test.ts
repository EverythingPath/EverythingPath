/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { expect, test } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import type { CatalogReleaseStatus } from '../../src/lib/catalog/release-validators';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';
import type { personalBonusTypes } from '../../src/lib/character-sheet';
import { withSheetCatalog } from '../character-sheet-catalog';
import { preloadCalledConvexModules } from '../convex-modules';
import { assessedBuffs, review } from '../fixtures/pf-buffs-549/data';
import { buffEntry } from '../fixtures/pf-buffs-549/sheet';

const modules = import.meta.glob('../../convex/**/*.ts');
preloadCalledConvexModules({ modules, testFile: import.meta.url });

type BonusType = (typeof personalBonusTypes)[number];
const EXPERTISE = 'pf1-content/Xwk4zZksBg2KvyEG';
const MANTLE = 'pf1-content/bU5ry2F5WAKhacZI';
const MANTLE_SPELL = 'pf1/1gz3zdpxu7uic5ky';

/**
 * An isolated level-0 character (base attack bonus +0). The sheet records a
 * character-scoped copy of the admitted Combat Expertise buff with the
 * full-corpus preview's imported and reviewed Modifiers, and a player-authored
 * running Wrathful Mantle carrying the held effect's reviewed caster-level
 * Modifier (a public-writer fixture, never an admitted Spell Effect). No
 * assessment or Catalog Release is constructed.
 */
test('a saved sheet applies combat expertise and a running wrathful mantle by its caster level, and keeps access to the campaign', async () => {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `pfbuffs549|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    return ctx.db.insert('campaign', {
      name: 'Isolated reviewed pf-buffs #549',
      description: '',
      organizationId: 'org',
      ownerId: 'pfbuffs549|owner',
      e2eFixture: {
        namespace: 'pf-buffs-549',
        version: 1,
        workerKey: '0',
        caseKey: 'reviewed',
        campaignKey: 'reviewed',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'pfbuffs549|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'pfbuffs549|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'pfbuffs549|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Duelist',
    kind: 'pc',
    operationId: 'duelist',
  });
  const scope = { characterId };
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!before) throw new Error('Missing saved sheet');
  const acBefore = before.calculated.breakdowns['ac.other'].total;
  const attackBefore = before.calculated.breakdowns['attack.melee'].total;
  const rangedBefore = before.calculated.breakdowns['attack.ranged'].total;
  const cmbBefore = before.calculated.breakdowns.cmb.total;
  const willBefore = before.calculated.breakdowns['save.will'].total;
  expect(before.calculated.breakdowns.bab.total).toBe(0);

  // The admitted combat buff, copied with its Modifiers: at base attack bonus
  // +0, -1 on melee attacks and combat maneuver checks and +1 dodge to AC.
  const expertise = buffEntry(EXPERTISE);
  expect(
    review.candidates.find((row) => row.externalKey === EXPERTISE)?.disposition,
  ).toBe('admitted');
  expect(expertise.modifiers).toEqual([
    {
      target: 'attack.melee',
      bonusType: 'untyped',
      value: { formula: '-(1 + (floor(@bab / 4)))' },
    },
    {
      target: 'ac',
      bonusType: 'dodge',
      value: { formula: '(1 + (floor(@bab / 4)))' },
    },
    {
      target: 'cmb',
      bonusType: 'untyped',
      value: { formula: '-(1 + (floor(@bab / 4)))' },
    },
  ]);
  const sheetEntryId = await t.run(async (ctx) => {
    const catalogEntryId = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: expertise.name,
      ruleIdentity: expertise.externalKey,
      stacksWithItself: false,
      modifiers: expertise.modifiers.map((modifier) => ({
        target: modifier.target as 'ac' | 'attack.melee' | 'cmb',
        bonusType: modifier.bonusType as BonusType,
        value: modifier.value,
      })),
      sources: expertise.sources,
      detail: { kind: 'manual' },
    });
    return ctx.db.insert('characterSheetEntry', {
      characterId,
      kind: 'manual',
      active: true,
      catalogEntryId,
      state: { kind: 'manual' },
    });
  });
  const defending = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  if (!defending) throw new Error('Missing saved sheet');
  expect(defending.calculated.breakdowns['ac.other'].total).toBe(acBefore + 1);
  expect(defending.calculated.breakdowns['attack.melee'].total).toBe(
    attackBefore - 1,
  );
  expect(defending.calculated.breakdowns.cmb.total).toBe(cmbBefore - 1);
  expect(defending.calculated.breakdowns['attack.ranged'].total).toBe(
    rangedBefore,
  );
  // The client catalog preview calculates the same.
  const local = calculateCharacterSheetPreview(defending);
  expect(local.breakdowns['ac.other'].total).toBe(acBefore + 1);
  expect(local.breakdowns.cmb.total).toBe(cmbBefore - 1);

  // A running wrathful mantle at caster level 12: +3 resistance on saves.
  const mantle = buffEntry(MANTLE);
  expect(mantle.detail).toMatchObject({
    kind: 'spellEffect',
    spellKey: MANTLE_SPELL,
    defaultCasterLevel: 5,
  });
  const effectId = await member.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Isolated running Wrathful Mantle',
    modifiers: mantle.modifiers.map((modifier) => ({
      target: modifier.target as 'saves',
      bonusType: modifier.bonusType as BonusType,
      value: modifier.value,
    })),
    detail: {
      kind: 'spellEffect',
      spellKey: MANTLE_SPELL,
      defaultCasterLevel: 5,
      lastsOverOneDay: false,
    },
    casterLevel: 12,
    operationId: 'running-wrathful-mantle',
  });
  const mantled = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!mantled) throw new Error('Missing saved sheet');
  expect(mantled.calculated.breakdowns['save.will'].total).toBe(willBefore + 3);
  expect(
    calculateCharacterSheetPreview(mantled).breakdowns['save.will'].total,
  ).toBe(willBefore + 3);
  // Switching both off restores the sheet: the running effect through the
  // public writer.
  await member.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId: effectId,
    active: false,
    operationId: 'stop-wrathful-mantle',
  });
  // The manual copy is a fixture row, switched off directly.
  await t.run((ctx) => ctx.db.patch(sheetEntryId, { active: false }));
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(after?.calculated.breakdowns['ac.other'].total).toBe(acBefore);
  expect(after?.calculated.breakdowns['attack.melee'].total).toBe(attackBefore);
  expect(after?.calculated.breakdowns.cmb.total).toBe(cmbBefore);
  expect(after?.calculated.breakdowns['save.will'].total).toBe(willBefore);
  // Outsiders are refused.
  await expect(
    outsider.query(api.characterSheet.read, scope),
  ).rejects.toThrow();
});

/**
 * The admitted Combat Expertise through the release path: a clean shared-store
 * tree of the buff and the Core Rulebook feat it links is imported, built into
 * a Catalog Release with the reviewed attribution, transported and published
 * in convex-test's isolated database, selected as the fixture-only release,
 * and its released definition chosen on a sheet through the public writer.
 * The global catalog row is only the stable identity the release projects
 * onto (its stored Modifiers are empty); every number comes from the release.
 */
test('an isolated release publishes the admitted Combat Expertise, and a sheet that selects it applies the released penalties and dodge bonus', async () => {
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
  const row = assessedBuffs.find((buff) => buff.externalKey === EXPERTISE);
  if (!row) throw new Error('Missing Combat Expertise review');
  expect(row.disposition).toBe('admitted');
  // The buff and its governing feat (an admitted Core Rulebook feat).
  const pinned = [row.source, ...row.linkedContentReview];
  expect(row.linkedContentReview.map((linked) => linked.externalKey)).toEqual([
    'pf1/NFxHebU1XhEs5WJh',
  ]);
  const tree = await materializePinnedTree(
    pinned.map((file) => `${file.repo}/${file.path}`),
    {
      sha256: Object.fromEntries(
        pinned.map((file) => [`${file.repo}/${file.path}`, file.sha256]),
      ),
    },
  );
  try {
    const artifact = await importCatalog({
      ...tree,
      remaps,
      curation: reviewedCuration,
      candidateKeys: [EXPERTISE, 'pf1/NFxHebU1XhEs5WJh'],
    });
    expect(artifact.curation.missing).toEqual([]);
    const release = await createCatalogRelease({
      artifact,
      attribution: reviewedAdmission,
      legalResources,
      releaseNumber: 549,
      compatibility: catalogRuntimeCompatibility,
      inputValues: {
        remaps,
        curation: reviewedCuration,
        localData: [],
        parsers: 'isolated-pf-buffs-549-proof',
        sanitizers: 'isolated-pf-buffs-549-proof',
        ruleResources: [],
        upstreamVerification: { status: 'unverified' },
      },
    });
    const transported = await validateCatalogReleaseArtifact(
      JSON.parse(serializeCatalogRelease(release)),
    );
    expect(computeFingerprint(transported)).toBe(computeFingerprint(release));
    const published = transported.batches
      .flat()
      .find(
        (candidate) =>
          candidate.kind === 'definition' && candidate.key === EXPERTISE,
      );
    if (!published) throw new Error('Combat Expertise was not published');
    expect(published.payload).toMatchObject({
      name: 'Combat Expertise',
      detail: { kind: 'manual' },
      modifiers: buffEntry(EXPERTISE).modifiers,
    });
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
        releaseNumber: 549,
        batchIndex,
        rows: batch,
      });
    await t.mutation(internal.catalogRelease.finalize, { releaseNumber: 549 });
    // This control exists only in convex-test's isolated database. No
    // deployment or production catalog is touched by the test.
    await t.run(async (ctx) => {
      const releaseId = (
        await ctx.db
          .query('catalogRelease')
          .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 549))
          .unique()
      )?._id;
      if (!releaseId) throw new Error('Missing isolated prepared release');
      await ctx.db.insert('catalogReleaseControl', {
        key: 'global',
        releaseNumber: 549,
        releaseId,
        schemaIdentity: catalogRuntimeCompatibility.schema,
        calculationIdentity: catalogRuntimeCompatibility.calculation,
        isFixtureOnly: true,
      });
    });
    const legal = releaseLegalInputsSchema.parse(
      await t.query(api.catalogRelease.legalInputs, {}),
    );
    expect(legal.requiredNotices).toEqual(['PZO1110']);
    const campaignId = await t.run(async (ctx) => {
      await ctx.db.insert('user', {
        tokenIdentifier: 'pfbuffs549release|owner',
        orgIds: [{ orgId: 'org', role: 'member' }],
        characterSheetDemo: true,
      });
      return ctx.db.insert('campaign', {
        name: 'Isolated released pf-buffs #549',
        description: '',
        organizationId: 'org',
        ownerId: 'pfbuffs549release|owner',
        e2eFixture: {
          namespace: 'pf-buffs-549',
          version: 1,
          workerKey: '0',
          caseKey: 'released',
          campaignKey: 'released',
        },
      });
    });
    const owner = t.withIdentity({
      tokenIdentifier: 'pfbuffs549release|owner',
    });
    const characterId = await owner.mutation(api.characterSheet.create, {
      campaignId,
      organizationId: 'org',
      name: 'Released duelist',
      kind: 'pc',
      operationId: 'released-duelist',
    });
    const scope = { characterId };
    const before = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!before) throw new Error('Missing saved sheet');
    expect(before.calculated.breakdowns.bab.total).toBe(0);
    const totals = (sheet: typeof before) => [
      sheet.calculated.breakdowns['attack.melee'].total,
      sheet.calculated.breakdowns.cmb.total,
      sheet.calculated.breakdowns['ac.other'].total,
      sheet.calculated.breakdowns['attack.ranged'].total,
    ];
    const [melee, cmb, ac, ranged] = totals(before);
    // The stable global identity the selected release projects onto.
    const globalId = await t.run((ctx) =>
      ctx.db.insert('catalogEntry', {
        scope: 'global',
        name: 'Combat Expertise',
        ruleIdentity: EXPERTISE,
        stacksWithItself: false,
        sources: [],
        modifiers: [],
        detail: { kind: 'manual' },
      }),
    );
    await owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: globalId,
      operationId: 'select-released-combat-expertise',
    });
    const after = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!after) throw new Error('Missing saved sheet');
    // At base attack bonus +0: -1 on melee attacks and combat maneuver
    // checks, +1 dodge to AC, ranged attacks unchanged.
    expect(totals(after)).toEqual([melee! - 1, cmb! - 1, ac! + 1, ranged]);
    expect(totals(after)).toEqual([
      calculateCharacterSheetPreview(after).breakdowns['attack.melee'].total,
      calculateCharacterSheetPreview(after).breakdowns.cmb.total,
      calculateCharacterSheetPreview(after).breakdowns['ac.other'].total,
      calculateCharacterSheetPreview(after).breakdowns['attack.ranged'].total,
    ]);
  } finally {
    await tree.dispose();
  }
}, 90_000);
