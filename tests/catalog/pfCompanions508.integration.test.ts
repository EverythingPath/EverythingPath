/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { animalCompanionTable } from '../../src/lib/catalog/representative-animal-companions';
import { withSheetCatalog } from '../character-sheet-catalog';
import { preloadCalledConvexModules } from '../convex-modules';
import {
  review,
  pinnedSha256,
  preview,
} from '../fixtures/pf-companions-508/data';

const modules = import.meta.glob('../../convex/**/*.ts');
preloadCalledConvexModules({ modules, testFile: import.meta.url });

const WOLF = 'pf1-content/9gMnOdTPE6GA1DGi';
const HORSE = 'pf1-content/069F47e2x4CbT6s9';

/** The pinned record's starting scores and advancement, from the inventory. */
function pinnedStatistics(key: string) {
  const row = review.candidates.find((row) => row.externalKey === key);
  if (!row) throw new Error(`Missing ${key}`);
  const { structured, statBlock } = row.mechanicsReview.companionReview;
  const adjustments = Object.fromEntries(
    [
      ...String(statBlock.advancement.Ability).matchAll(
        /(Str|Dex|Con) ([+-]\d+)/g,
      ),
    ].map(([, ability, value]) => [ability, Number(value)]),
  );
  return {
    row,
    scores: {
      strength: structured.abilities.str,
      dexterity: structured.abilities.dex,
      constitution: structured.abilities.con,
      intelligence: structured.abilities.int,
      wisdom: structured.abilities.wis,
      charisma: structured.abilities.cha,
    },
    naturalArmor: Number(structured.naturalAC),
    advancement: {
      level: statBlock.advancementLevel,
      naturalArmor: Number(statBlock.advancement.AC),
      strength: adjustments.Str ?? 0,
      dexterity: adjustments.Dex ?? 0,
      constitution: adjustments.Con ?? 0,
    },
  };
}

/**
 * An isolated druid of the given level with a linked animal companion whose
 * base scores are the held pf-companions record's. The sheet calculates the
 * representative CRB species of the same name (#325); this shows the pinned
 * version-specific statistics through the public progression, not an
 * admission. No assessment or Catalog Release is constructed.
 */
async function savedCompanion({
  key,
  species,
  druidLevel,
}: {
  key: string;
  species: 'wolf' | 'horse';
  druidLevel: number;
}) {
  const pinned = pinnedStatistics(key);
  expect(pinned.row.disposition).toBe('held');
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `companion508|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    return ctx.db.insert('campaign', {
      name: 'Isolated reviewed companions #508',
      description: '',
      organizationId: 'org',
      ownerId: 'companion508|owner',
      e2eFixture: {
        namespace: 'pf-companions-508',
        version: 1,
        workerKey: '0',
        caseKey: species,
        campaignKey: 'reviewed',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'companion508|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'companion508|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'companion508|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Druid',
    kind: 'pc',
    operationId: 'druid',
  });
  await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      characterId,
      scope: 'character',
      name: 'druid',
      ruleIdentity: 'druid',
      sources: [{ book: 'Pathfinder RPG Core Rulebook', pages: '48–54' }],
      modifiers: [],
      stacksWithItself: false,
      detail: {
        kind: 'class',
        classKind: 'base',
        hitDie: 8,
        bab: 'threeQuarters',
        saves: { fort: 'good', ref: 'poor', will: 'good' },
        skillRanksPerLevel: 4,
        classSkills: [],
        featuresByLevel: [],
        picksByLevel: [],
      },
    }),
  );
  const master = await owner.query(api.characterSheet.read, { characterId });
  const druid = master?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'druid',
  );
  const initialLevel = master?.entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (!druid || !initialLevel) throw new Error('Druid fixture missing');
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: initialLevel._id,
    classEntryId: druid._id,
    hpGained: 8,
    operationId: 'druid-one',
  });
  for (let position = 2; position <= druidLevel; position++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      characterId,
      classEntryId: druid._id,
      operationId: `druid-${position}`,
    });
  const companionId = await member.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: pinned.row.name,
    kind: 'npc',
    operationId: 'companion',
  });
  const companion = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  const unwantedLevel = companion?.entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (!unwantedLevel) throw new Error('Companion fixture missing');
  await member.mutation(api.characterSheet.deleteClassLevel, {
    characterId: companionId,
    entryId: unwantedLevel._id,
    operationId: 'creature-only',
  });
  await member.mutation(api.characterSheet.editBaseScores, {
    characterId: companionId,
    scores: pinned.scores,
    operationId: 'pinned-scores',
  });
  await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: companionId,
    kind: 'animalCompanion',
    sources: [
      {
        key: 'nature-bond',
        label: 'Nature bond',
        sheetEntryId: initialLevel._id,
        enabled: true,
      },
    ],
    operationId: 'link',
  });
  await member.mutation(api.characterSheet.setCompanionProgression, {
    characterId: companionId,
    operationId: 'progression',
    progression: {
      species,
      hpGained: null,
      skillRanks: {},
      abilityIncreases: [],
      advancementChoice: 'species',
      keep: false,
    },
  });
  const saved = withSheetCatalog(
    await member.query(api.characterSheet.read, { characterId: companionId }),
  );
  if (!saved) throw new Error('Missing saved companion sheet');
  await expect(
    outsider.query(api.characterSheet.read, { characterId: companionId }),
  ).rejects.toThrow();
  return { saved, pinned };
}

test('a saved wolf and horse companion calculate the pinned starting scores, advancement and table at their druid levels, and refuse outsiders', async () => {
  for (const [key, species, druidLevel] of [
    [WOLF, 'wolf', 7],
    [HORSE, 'horse', 4],
  ] as const) {
    const { saved, pinned } = await savedCompanion({
      key,
      species,
      druidLevel,
    });
    const row = animalCompanionTable[druidLevel - 1];
    if (!row) throw new Error(`No table row ${druidLevel}`);
    // At its advancement level the pinned advancement applies: the starting
    // scores plus the advancement's adjustments plus the table's Str/Dex
    // bonus, and natural armor from all three.
    expect(pinned.advancement.level).toBe(druidLevel);
    const expected = {
      strength:
        pinned.scores.strength +
        pinned.advancement.strength +
        row.strengthDexterity,
      dexterity:
        pinned.scores.dexterity +
        pinned.advancement.dexterity +
        row.strengthDexterity,
      constitution:
        pinned.scores.constitution + pinned.advancement.constitution,
      naturalArmor:
        pinned.naturalArmor +
        pinned.advancement.naturalArmor +
        row.naturalArmor,
    };
    for (const projection of [saved.calculated, saved.permanentCalculated]) {
      expect(projection.companionProgression).toMatchObject({
        status: 'active',
        effectiveLevel: druidLevel,
        hitDice: row.hitDice,
        size: 'large',
        advancement: { level: druidLevel, applied: true },
      });
      expect({
        strength: projection.abilities.strength.score,
        dexterity: projection.abilities.dexterity.score,
        constitution: projection.abilities.constitution.score,
        naturalArmor: projection.breakdowns['ac.natural'].total,
      }).toEqual(expected);
    }
  }
  // The wolf: 13 + 8 + 2 Str, 15 - 2 + 2 Dex, 15 + 4 Con, 2 + 2 + 4 natural
  // armor; the horse: 16 + 2 + 1, 13 + 0 + 1, 15 + 2, 4 + 0 + 2.
  expect(pinnedStatistics(WOLF).scores.strength).toBe(13);
  expect(pinnedStatistics(HORSE).advancement).toEqual({
    level: 4,
    naturalArmor: 0,
    strength: 2,
    dexterity: 0,
    constitution: 2,
  });
}, 120_000);

test('the release path refuses the held wolf and horse: the gate fails both on the broken embedded link', async () => {
  const { materializePinnedTree } = await import('./pinned-sources');
  const { importCatalog } = await import('../../scripts/catalog/import');
  const { reviewedCuration } =
    await import('../../scripts/catalog/reviewed-curation-data');
  const { createCatalogRelease } =
    await import('../../scripts/catalog/release');
  const { catalogRuntimeCompatibility } =
    await import('../../src/lib/catalog/runtime-compatibility');
  const { reviewedAdmission, legalResources } =
    await import('../../src/lib/catalog/reviewed-data');
  const { default: remaps } =
    await import('../../scripts/catalog/reviewed-remaps.json');
  const keys = [WOLF, HORSE];
  const files = review.candidates
    .filter((row) => keys.includes(row.externalKey))
    .map((row) => `${row.source.repo}/${row.source.path}`);
  const tree = await materializePinnedTree(files, {
    sha256: Object.fromEntries(
      files.map((file) => [file, pinnedSha256[file]!]),
    ),
  });
  try {
    const artifact = await importCatalog({
      ...tree,
      remaps,
      curation: reviewedCuration,
      candidateKeys: keys,
    });
    expect(artifact.curation.missing).toEqual([]);
    expect(
      (artifact.catalog.resources ?? []).map((row) => row.externalKey).sort(),
    ).toEqual([...keys].sort());
    for (const key of keys)
      expect(
        (artifact.catalog.resources ?? []).find(
          (row) => row.externalKey === key,
        )?.detail,
      ).toEqual(preview.entries.find((row) => row.externalKey === key)?.detail);
    // The release path refuses both: the gate fails each held resource on
    // its broken embedded link, so no Catalog Release can carry them.
    const attempt = createCatalogRelease({
      artifact,
      attribution: reviewedAdmission,
      legalResources,
      releaseNumber: 508,
      compatibility: catalogRuntimeCompatibility,
      inputValues: {
        remaps,
        curation: reviewedCuration,
        localData: [],
        parsers: 'isolated-pf-companions-508-proof',
        sanitizers: 'isolated-pf-companions-508-proof',
        ruleResources: [],
        upstreamVerification: { status: 'unverified' },
      },
    });
    await expect(attempt).rejects.toThrow(/^Catalog Release gates failed/);
    const message: string = await attempt.then(
      () => '',
      (error: Error) => error.message,
    );
    const failures = JSON.parse(
      message.replace(/^Catalog Release gates failed: /, ''),
    ).failures as { externalKey: string; reason: string }[];
    expect(failures).toEqual(
      [...keys].sort().map((externalKey) => ({
        externalKey,
        reason: 'Broken structure or reference: unresolved imported reference.',
      })),
    );
  } finally {
    await tree.dispose();
  }
}, 120_000);
