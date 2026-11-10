/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { expect, test } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import type { CatalogReleaseStatus } from '../../src/lib/catalog/release-validators';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { z } from 'zod';
import {
  modifierConditionSchema,
  situationalNoteSchema,
} from '../../src/lib/character-sheet';
import type { NaturalAttackType } from '../../src/lib/character-sheet-attack-types';
import { withSheetCatalog } from '../character-sheet-catalog';
import {
  assessedAttacks,
  pinnedSha256,
  preview,
} from '../fixtures/monster-abilities-506/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';

const modules = import.meta.glob('../../convex/**/*.ts');
const byKey = new Map(preview.entries.map((row) => [row.externalKey, row]));
const BITE = 'pf1/szjeStouwI3F3WdP';
const TAIL_SLAP = 'pf1/ogIJ8XWiWFlJIF6S';
const CLAW = 'pf1/MZnbCVzqpvPsMvfT';
const UNARMED_STRIKE = 'pf1/1sU57tRb1My6XZMC';

// These bodies have no Catalog Entry ID conditions: accept only shared or
// local Situations, never imported external keys as stored references.
const localSituationSchema = z.union([
  z.string().min(1),
  z.strictObject({ local: z.string().min(1).max(4096) }),
]);
const fixtureNote = situationalNoteSchema
  .safeExtend({
    situation: localSituationSchema.optional(),
    condition: modifierConditionSchema
      .pick({ situation: true, weapon: true })
      .extend({ situation: localSituationSchema.optional() })
      .strict()
      .optional(),
  })
  .strict();

/**
 * A character-scoped copy of the full-corpus preview's natural attack: its
 * reviewed Notes and imported weapon detail (dice, damage types, critical)
 * in the sheet's natural weapon shape. The importer maps no natural attack
 * type or role (see the batch report's gaps), so this test-only adapter names
 * the type; the sheet's natural attack profiles then supply the role the
 * reviewed Note states. No assessment or Catalog Release is constructed.
 */
function naturalDefinition(key: string, type: NaturalAttackType) {
  const entry = importedCatalogEntrySchema.parse(byKey.get(key));
  const weapon = entry.detail.kind === 'item' ? entry.detail.weapon : undefined;
  const dice = weapon?.dice;
  if (entry.detail.kind !== 'item' || !weapon || !dice)
    throw new Error(`${key} is not a mapped attack`);
  return {
    name: entry.name,
    ruleIdentity: entry.externalKey,
    stacksWithItself: false,
    sources: entry.sources,
    description: entry.description,
    modifiers: [],
    situationalNotes: (entry.situationalNotes ?? []).map((note) =>
      fixtureNote.parse(note),
    ),
    detail: {
      kind: 'item' as const,
      consumable: entry.detail.consumable,
      weapon: {
        baseType: type,
        proficiency: 'always' as const,
        groups: [...weapon.groups],
        handedness: 'light' as const,
        attackType: 'melee' as const,
        dice,
        damageTypes: [...weapon.damageTypes],
        ...(weapon.threat ? { threat: weapon.threat } : {}),
        ...(weapon.mult ? { mult: weapon.mult } : {}),
        strengthDamage: 'melee' as const,
        naturalAttack: { type },
      },
    },
  };
}

test('an isolated sheet attacks with the held bite and tail slap as primary and secondary natural attacks and refuses outsiders', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, otherCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `monster506|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed monster abilities #506',
      description: '',
      organizationId: 'org',
      ownerId: 'monster506|owner',
      e2eFixture: {
        namespace: 'monster-abilities-506',
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
      ownerId: 'monster506|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'monster506|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'monster506|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'monster506|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed natural attacks preview',
    kind: 'npc',
    operationId: 'create-monster-506',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: {
      strength: 14,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    operationId: 'base-scores',
  });
  // Both are held; their reviewed content is demonstrated on isolated
  // character-scoped copies.
  expect(
    [BITE, TAIL_SLAP].map(
      (key) =>
        assessedAttacks.find((row) => row.externalKey === key)?.disposition,
    ),
  ).toEqual(['held', 'held']);
  const definitions = new Map<string, Id<'catalogEntry'>>();
  for (const [key, type] of [
    [BITE, 'bite'],
    [TAIL_SLAP, 'tailSlap'],
  ] as const)
    definitions.set(
      key,
      await t.run((ctx) =>
        ctx.db.insert('catalogEntry', {
          scope: 'character',
          characterId,
          ...naturalDefinition(key, type),
        }),
      ),
    );
  const read = async () => {
    const saved = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!saved) throw new Error('Missing saved sheet');
    expect(calculateCharacterSheetPreview(saved).attackRoutines).toEqual(
      saved.calculated.attackRoutines,
    );
    return saved;
  };
  const lines = (saved: Awaited<ReturnType<typeof read>>) =>
    Object.fromEntries(
      saved.calculated.attackRoutines.map((routine) => [
        routine.name,
        {
          attack: routine.single[0]?.attackBonus.total,
          damage: routine.single[0]?.damageBonus.total,
          dice: routine.single[0]?.damageDice,
          role: routine.single[0]?.naturalRole,
        },
      ]),
    );
  const bite = await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: definitions.get(BITE)!,
    operationId: 'carry-bite',
  });
  await member.mutation(api.characterSheet.createAttackRoutine, {
    ...scope,
    weaponEntryId: bite,
    name: 'Bite',
    operationId: 'bite-routine',
  });
  // Strength 14: a sole natural attack is primary with 1-1/2 times the
  // Strength bonus on damage (+3); the imported bite deals 1d6.
  const alone = await read();
  expect(lines(alone)).toEqual({
    Bite: { attack: 2, damage: 3, dice: '1d6', role: 'primary' },
  });
  // The reviewed Notes reach the saved definition: the role and the
  // most-beneficial damage type.
  expect(
    alone.catalogEntries
      .find((row) => row._id === definitions.get(BITE))
      ?.situationalNotes?.map((note) => [note.target, note.text]),
  ).toEqual([
    [
      'attack',
      'A primary natural weapon that crushes, punctures and tears with teeth and jaws.',
    ],
    [
      'damage',
      'It deals bludgeoning, slashing or piercing damage, whichever is most beneficial one.',
    ],
  ]);
  const tailSlap = await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: definitions.get(TAIL_SLAP)!,
    operationId: 'carry-tail-slap',
  });
  await member.mutation(api.characterSheet.createAttackRoutine, {
    ...scope,
    weaponEntryId: tailSlap,
    name: 'Tail Slap',
    operationId: 'tail-slap-routine',
  });
  // With two kinds of natural attack, the bite is primary (full Strength)
  // and the tail slap secondary: -5 on the attack and half Strength on
  // damage, as the reviewed Notes and Table 3-1 state.
  const both = await read();
  expect(lines(both)).toEqual({
    Bite: { attack: 2, damage: 2, dice: '1d6', role: 'primary' },
    'Tail Slap': { attack: -3, damage: 1, dice: '1d6', role: 'secondary' },
  });
  // Outsiders, anonymous callers and another campaign's entries are refused.
  const before = await read();
  await expect(
    outsider.mutation(api.characterSheet.createAttackRoutine, {
      ...scope,
      weaponEntryId: bite,
      operationId: 'outsider',
    }),
  ).rejects.toThrow();
  await expect(
    t.mutation(api.characterSheet.createAttackRoutine, {
      ...scope,
      weaponEntryId: bite,
      operationId: 'anonymous',
    }),
  ).rejects.toThrow();
  const foreign = await t.run(async (ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: otherCampaignId,
      ...naturalDefinition(CLAW, 'claw'),
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

test('an isolated release of the held unarmed strike publishes none of it and requires no notice', async () => {
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
  const { computeFingerprint } =
    await import('../../scripts/catalog/admission');
  const { reviewedAdmission, legalResources } =
    await import('../../src/lib/catalog/reviewed-data');
  const { default: remaps } =
    await import('../../scripts/catalog/reviewed-remaps.json');
  // The one attack without a description link: the unarmed strike.
  const row = assessedAttacks.find((row) => row.externalKey === UNARMED_STRIKE);
  if (!row) throw new Error('Missing unarmed strike');
  const file = `${row.source.repo}/${row.source.path}`;
  const tree = await materializePinnedTree([file], {
    sha256: { [file]: pinnedSha256[file]! },
  });
  try {
    const artifact = await importCatalog({
      ...tree,
      remaps,
      curation: reviewedCuration,
      candidateKeys: [UNARMED_STRIKE],
    });
    expect(artifact.curation.missing).toEqual([]);
    expect(
      artifact.catalog.entries
        .find((entry) => entry.externalKey === UNARMED_STRIKE)
        ?.situationalNotes?.map((note) => note.target),
    ).toEqual(['damage', 'attack']);
    const release = await createCatalogRelease({
      artifact,
      attribution: reviewedAdmission,
      legalResources,
      releaseNumber: 506,
      compatibility: catalogRuntimeCompatibility,
      inputValues: {
        remaps,
        curation: reviewedCuration,
        localData: [],
        parsers: 'isolated-monster-abilities-506-proof',
        sanitizers: 'isolated-monster-abilities-506-proof',
        ruleResources: [],
        upstreamVerification: { status: 'unverified' },
      },
    });
    const transported = await validateCatalogReleaseArtifact(
      JSON.parse(serializeCatalogRelease(release)),
    );
    expect(computeFingerprint(transported)).toBe(computeFingerprint(release));
    const published = transported.batches.flat();
    expect(
      published.some(
        (candidate) =>
          candidate.kind === 'definition' && candidate.key === UNARMED_STRIKE,
      ),
    ).toBe(false);
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
        releaseNumber: 506,
        batchIndex,
        rows: batch,
      });
    await t.mutation(internal.catalogRelease.finalize, { releaseNumber: 506 });
    // The held strike's notices are not required: the release's legal rows
    // list none. No deployment or production catalog is touched by the test.
    expect(
      published.find(
        (candidate) =>
          candidate.kind === 'legal' && candidate.key === 'requiredNotices',
      )?.payload,
    ).toEqual([]);
  } finally {
    await tree.dispose();
  }
}, 90_000);
