/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { expect, test } from 'vitest';
import { z } from 'zod';
import { api, internal } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import type { CatalogReleaseStatus } from '../../src/lib/catalog/release-validators';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import {
  modifierConditionSchema,
  modifierTargets,
  situationalNoteSchema,
} from '../../src/lib/character-sheet';
import { withSheetCatalog } from '../character-sheet-catalog';
import {
  assessedAbilities,
  preview,
} from '../fixtures/pf-special-qualities-501/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';

const modules = import.meta.glob('../../convex/**/*.ts');
const byName = new Map(preview.entries.map((row) => [row.name, row]));
const keyOf = (name: string) => {
  const row = byName.get(name);
  if (!row) throw new Error(name);
  return row.externalKey;
};

const HUNTSMAN_DAMAGE =
  'against a creature the wielder has tracked with Survival in the past day';
const HUNTSMAN_SURVIVAL =
  'to track a creature the weapon has damaged in the past day';

// These bodies have no Catalog Entry ID conditions: accept only shared or
// local Situations, never imported external keys as stored references.
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
 * A character-scoped copy of the full-corpus preview's Item Ability: its
 * imported detail, Modifiers and Notes, unchanged. No assessment or Catalog
 * Release is constructed.
 */
function abilityDefinition(name: string) {
  const entry = importedCatalogEntrySchema.parse(byName.get(name));
  if (entry.detail.kind !== 'itemAbility') throw new Error(name);
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
    detail: entry.detail as never,
  };
}

test('an isolated sheet wears held Greater Shadow and Mind Buttressing, Arrow Catching and Corrosive Burst, and keeps access to the campaign', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, otherCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `abilities501|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed Item Abilities #501',
      description: '',
      organizationId: 'org',
      ownerId: 'abilities501|owner',
      e2eFixture: {
        namespace: 'pf-special-qualities-501',
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
      ownerId: 'abilities501|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'abilities501|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'abilities501|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'abilities501|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed Item Abilities preview',
    kind: 'pc',
    operationId: 'create-abilities-501',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: {
      strength: 16,
      dexterity: 12,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    operationId: 'base-scores',
  });
  const read = async (identity = owner) => {
    const saved = withSheetCatalog(
      await identity.query(api.characterSheet.read, scope),
    );
    if (!saved) throw new Error('Missing saved sheet');
    expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
      saved.calculated.derivedStatistics,
    );
    return saved;
  };
  const representative = async (ruleIdentity: string) => {
    const row = (await read()).catalogEntries.find(
      (entry) => entry.ruleIdentity === ruleIdentity,
    );
    if (!row) throw new Error(`Missing ${ruleIdentity}`);
    return row._id;
  };
  // #764: the pinned "Universal Armor & Shield Qualities" tag imports as
  // armor or shield, so Poison-Resistant now stores.
  expect(byName.get('Poison-Resistant')?.detail).toMatchObject({
    appliesTo: 'armorOrShield',
  });
  // Huntsman (pinned body): "+1d6 points of damage to creatures the wielder
  // has tracked with Survival in the past day", a die under a local Situation.
  expect(byName.get('Huntsman')?.detail).toMatchObject({
    damageDice: [
      {
        on: 'hit',
        dice: '1d6',
        damageType: 'untyped',
        situation: { local: HUNTSMAN_DAMAGE },
      },
    ],
  });
  const names = [
    'Shadow, Greater',
    'Mind Buttressing',
    'Poison-Resistant',
    'Arrow Catching',
    'Corrosive Burst',
    'Huntsman',
  ];
  expect(
    names.map(
      (name) =>
        assessedAbilities.find((row) => row.externalKey === keyOf(name))
          ?.disposition,
    ),
  ).toEqual(names.map(() => 'held'));
  const ids = new Map<string, Id<'catalogEntry'>>();
  for (const name of names)
    ids.set(
      name,
      await t.run((ctx) =>
        ctx.db.insert('catalogEntry', {
          scope: 'character',
          characterId,
          ...abilityDefinition(name),
        }),
      ),
    );
  const select = async (ruleIdentity: string) =>
    member.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: await representative(ruleIdentity),
      operationId: `wear-${ruleIdentity}`,
    });
  const plate = await select('full-plate');
  const shield = await select('heavy-steel-shield');
  const sword = await select('longsword');
  const totals = (saved: Awaited<ReturnType<typeof read>>) => ({
    stealth: saved.calculated.breakdowns['skill.ste'].total,
    will: saved.calculated.derivedStatistics.will.total,
    ac: saved.calculated.derivedStatistics.ac.total,
  });
  const plain = totals(await read());
  for (const [entryId, abilities, operationId] of [
    [plate, ['Shadow, Greater', 'Mind Buttressing', 'Poison-Resistant'], 'plate'],
    [shield, ['Arrow Catching'], 'shield'],
    [sword, ['Corrosive Burst', 'Huntsman'], 'sword'],
  ] as const)
    await member.mutation(api.characterSheet.editEquipment, {
      ...scope,
      entryId,
      enhancement: 1,
      abilities: abilities.map((name) => ({ catalogEntryId: ids.get(name)! })),
      operationId,
    });
  const worn = await read(member);
  // +1 enhancement each: masterwork full plate (-1 armor check penalty) and
  // shield; Greater Shadow +15 competence on Stealth, Mind Buttressing +2
  // resistance on Will. Arrow Catching's +1 deflection is conditional.
  expect(totals(worn)).toEqual({
    stealth: plain.stealth + 15 + 2,
    will: plain.will + 2,
    ac: plain.ac + 2,
  });
  expect(worn.calculated.breakdowns['ac.other'].conditional).toEqual([
    expect.objectContaining({
      bonusType: 'deflection',
      value: 1,
      condition: { situation: { local: 'against ranged weapons' } },
    }),
  ]);
  const routine = worn.calculated.attackRoutines.find(
    (row) => row.weaponEntryId === sword,
  );
  expect(
    routine?.single[0]?.extraDamage.map(
      ({ dice, on, damageType, situation, applies }) => ({
        dice,
        on,
        damageType,
        situation,
        applies,
      }),
    ),
  ).toEqual([
    { dice: '1d6', on: 'hit', damageType: 'acid', situation: null, applies: true },
    {
      dice: '1d10',
      on: 'crit',
      damageType: 'acid',
      situation: null,
      applies: true,
    },
    // Huntsman's die waits on its local Situation.
    {
      dice: '1d6',
      on: 'hit',
      damageType: 'untyped',
      situation: { local: HUNTSMAN_DAMAGE },
      applies: false,
    },
  ]);
  // Huntsman's Survival bonus is the sword's +1 enhancement while tracking.
  expect(worn.calculated.breakdowns['skill.sur'].conditional).toEqual([
    expect.objectContaining({
      bonusType: 'enhancement',
      value: 1,
      entryName: 'Huntsman',
      condition: { situation: { local: HUNTSMAN_SURVIVAL } },
    }),
  ]);
  // Poison-Resistant's +3 resistance applies vs. poison, with no warning
  // that the armor can't carry it.
  expect(worn.calculated.breakdowns['save.fort'].conditional).toContainEqual(
    expect.objectContaining({
      bonusType: 'resistance',
      value: 3,
      entryName: 'Poison-Resistant',
      condition: { situation: 'poison' },
    }),
  );
  expect(
    worn.calculated.warnings.filter(
      (warning) => warning.check === 'itemAbilityAppliesTo',
    ),
  ).toEqual([]);
  const notes =
    worn.catalogEntries
      .find((row) => row._id === ids.get('Arrow Catching'))
      ?.situationalNotes?.map((note) => note.text)
      .join(' ') ?? '';
  expect(notes).toContain('targets the shield');
  // Huntsman reads the sword's effective enhancement (#764): greater magic
  // weapon at caster level 12 gives +3 (CRB p. 307, +1 per four levels),
  // which wins over the sword's own +1; with neither, it gives +0.
  const survival = (saved: Awaited<ReturnType<typeof read>>) =>
    saved.calculated.breakdowns['skill.sur'].conditional
      .filter((row) => row.entryName === 'Huntsman')
      .map((row) => row.value);
  expect(survival(worn)).toEqual([1]);
  const greater = await select(
    'representative-spell-effect-greater-magic-weapon',
  );
  await member.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId: greater,
    casterLevel: 12,
    onItem: { entry: sword },
    operationId: 'gmw-on-sword',
  });
  const enchanted = await read();
  expect(survival(enchanted)).toEqual([3]);
  expect(
    enchanted.calculated.attackRoutines.find(
      (row) => row.weaponEntryId === sword,
    )?.single[0]?.attackBonus.total,
  ).toBe(
    (routine?.single[0]?.attackBonus.total ?? 0) + 2,
  );
  await member.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId: greater,
    onItem: null,
    operationId: 'gmw-off',
  });
  await member.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: sword,
    enhancement: 0,
    abilities: ['Corrosive Burst', 'Huntsman'].map((name) => ({
      catalogEntryId: ids.get(name)!,
    })),
    operationId: 'sword-plain',
  });
  expect(survival(await read())).toEqual([0]);
  // Outsiders, anonymous callers and another campaign's entries are refused.
  const before = await read();
  await expect(
    outsider.mutation(api.characterSheet.editEquipment, {
      ...scope,
      entryId: plate,
      abilities: [],
      operationId: 'outsider',
    }),
  ).rejects.toThrow();
  await expect(
    t.mutation(api.characterSheet.editEquipment, {
      ...scope,
      entryId: plate,
      abilities: [],
      operationId: 'anonymous',
    }),
  ).rejects.toThrow();
  const foreign = await t.run(async (ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: otherCampaignId,
      ...abilityDefinition('Shadow, Greater'),
    }),
  );
  await expect(
    member.mutation(api.characterSheet.editEquipment, {
      ...scope,
      entryId: plate,
      abilities: [{ catalogEntryId: foreign }],
      operationId: 'foreign',
    }),
  ).rejects.toThrow();
  const after = await read();
  expect(after.entries).toEqual(before.entries);
  expect(after.revision).toBe(before.revision);
}, 60_000);

test('an isolated release holds the abilities and publishes none of them', async () => {
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
  const { computeFingerprint, assessCatalogAdmission } =
    await import('../../scripts/catalog/admission');
  const { reviewedAdmission, legalResources } =
    await import('../../src/lib/catalog/reviewed-data');
  const { default: remaps } =
    await import('../../scripts/catalog/reviewed-remaps.json');
  const rows = assessedAbilities.filter((row) =>
    [
      'Shadow, Greater',
      'Arrow Catching',
      'Corrosive Burst',
      'Poison-Resistant',
    ].includes(row.name),
  );
  expect(rows).toHaveLength(4);
  // The records and the helper record Corrosive Burst's seeded record binds.
  const sources = rows.flatMap((row) => [row.source, ...row.seedSources]);
  const tree = await materializePinnedTree(
    sources.map((row) => `${row.repo}/${row.path}`),
    {
      sha256: Object.fromEntries(
        sources.map((row) => [`${row.repo}/${row.path}`, row.sha256]),
      ),
    },
  );
  try {
    const artifact = await importCatalog({
      ...tree,
      remaps,
      curation: reviewedCuration,
      candidateKeys: rows.map((row) => row.externalKey),
    });
    expect(artifact.curation.missing).toEqual([]);
    const gate = assessCatalogAdmission({ artifact, ...reviewedAdmission });
    expect(gate.admitted).toEqual([]);
    expect(
      gate.held.map((row) => [row.externalKey, row.reason]).sort(),
    ).toEqual(rows.map((row) => [row.externalKey, row.rationale]).sort());
    const release = await createCatalogRelease({
      artifact,
      attribution: reviewedAdmission,
      legalResources,
      releaseNumber: 501,
      compatibility: catalogRuntimeCompatibility,
      inputValues: {
        remaps,
        curation: reviewedCuration,
        localData: [],
        parsers: 'isolated-pf-special-qualities-501-proof',
        sanitizers: 'isolated-pf-special-qualities-501-proof',
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
      ).toBe(false);
    expect(
      published.find((row) => row.kind === 'report' && row.key === 'holds')
        ?.payload,
    ).toMatchObject({ held: 4 });
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
        releaseNumber: 501,
        batchIndex,
        rows: batch,
      });
    await t.mutation(internal.catalogRelease.finalize, { releaseNumber: 501 });
    // No held ability's notice is required: the release's legal rows list
    // none. No deployment or production catalog is touched by the test.
    expect(
      published.find(
        (row) => row.kind === 'legal' && row.key === 'requiredNotices',
      )?.payload,
    ).toEqual([]);
  } finally {
    await tree.dispose();
  }
}, 90_000);
