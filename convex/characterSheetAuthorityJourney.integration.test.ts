// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import { representativeClassCatalog } from './lib/representativeClassCatalog';
import { selectCharacterAuthority } from '../tests/character-authority';
import {
  activationArgs,
  discover,
  prepare,
} from '../tests/catalog-release-fixture';
import { elfAbilityBody, installElf } from '../tests/catalog-release-elf';

const modules = import.meta.glob('./**/*.ts');

// CRB p. 127: Iron Will, +2 on all Will saving throws, no prerequisites.
const ironWill = {
  name: 'Iron Will',
  ruleIdentity: 'iron-will',
  sources: [{ book: 'Pathfinder RPG Core Rulebook', pages: '127' }],
  stacksWithItself: false,
  detail: { kind: 'feat' as const, featTypes: [], repeatable: 'no' as const },
};
const ironWillBody = {
  externalKey: 'iron-will',
  upstreamKey: 'iron-will',
  pack: 'feats',
  name: 'Iron Will',
  detail: { kind: 'feat', featTypes: [], repeatable: 'no' },
  description: 'You get a +2 bonus on all Will saving throws.',
  sources: [{ book: 'Pathfinder RPG Core Rulebook', pages: '127' }],
  modifiers: [{ target: 'save.will', bonusType: 'untyped', value: 2 }],
  unsupported: [],
};
// CRB p. 310: Magic Missile, a 1st-level wizard evocation.
const magicMissileBody = {
  externalKey: 'pf1/magic-missile',
  upstreamKey: 'magic-missile',
  pack: 'spells',
  name: 'Magic Missile',
  detail: {
    kind: 'spell' as const,
    levels: { wizard: 1 },
    grantedLevels: {},
    school: 'evo',
    subschools: [],
    descriptors: ['force'],
  },
  description: 'A missile of magical energy darts forth from your fingertip.',
  sources: [{ book: 'Pathfinder RPG Core Rulebook', pages: '310' }],
  modifiers: [],
  unsupported: [],
};

/**
 * An ordinary deployment after activation: an ordinary campaign with a
 * militia, a player without the demo grant, and a selected Catalog Release
 * whose curated bodies differ from the uncurated global rows (the elf's
 * Ability Scores and Iron Will carry their Modifiers only in the release).
 * Activation itself is a later slice (#413 F6), so its result is seeded.
 */
async function activatedDeployment() {
  const t = convexTest(schema, modules);
  const gm = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const seeded = await gm.run((ctx) => seedAcceptedCampaign(ctx));
  const elf = await installElf(t);
  const catalog = await t.run(async (ctx) => {
    await ctx.db.patch('catalogEntry', elf.ability, { modifiers: [] });
    const wizard = representativeClassCatalog.find(
      (row) => row.ruleIdentity === 'wizard',
    );
    if (!wizard) throw new Error('Missing Wizard');
    return {
      wizard: await ctx.db.insert('catalogEntry', {
        ...wizard,
        scope: 'global',
      }),
      ironWill: await ctx.db.insert('catalogEntry', {
        ...ironWill,
        scope: 'global',
        modifiers: [],
      }),
      magicMissile: await ctx.db.insert('catalogEntry', {
        scope: 'global',
        name: 'Magic Missile',
        ruleIdentity: magicMissileBody.externalKey,
        stacksWithItself: false,
        sources: magicMissileBody.sources,
        modifiers: [],
        detail: { kind: 'spell', levels: { wizard: 1 }, school: 'evocation' },
      }),
    };
  });
  await selectCharacterAuthority(t, 'sheet');
  await prepare(t, [
    {
      kind: 'definition',
      key: elfAbilityBody.externalKey,
      payload: elfAbilityBody,
    },
    {
      kind: 'definition',
      key: ironWillBody.externalKey,
      payload: ironWillBody,
    },
    {
      kind: 'definition',
      key: magicMissileBody.externalKey,
      payload: magicMissileBody,
    },
  ]);
  const runId = await discover(t);
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId }),
  ).toBe(true);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(runId),
  );
  return {
    t,
    player: t.withIdentity({ tokenIdentifier: 'test|player' }),
    campaignId: seeded.key.campaignId,
    catalog: { ...catalog, elf: elf.elf },
  };
}

type Deployment = Awaited<ReturnType<typeof activatedDeployment>>;

/** The player's journey through public functions only. */
async function buildAndLevel(
  { player, catalog }: Deployment,
  characterId: Id<'character'>,
) {
  const read = async () => {
    const sheet = await player.query(api.characterSheet.read, { characterId });
    if (!sheet) throw new Error('Missing sheet');
    return sheet;
  };
  const firstLevel = (await read()).entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (!firstLevel) throw new Error('Missing Class Level');
  await player.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: firstLevel._id,
    classEntryId: catalog.wizard,
    hpGained: 6,
    operationId: 'wizard-1',
  });
  await player.mutation(api.characterSheet.selectRace, {
    characterId,
    catalogEntryId: catalog.elf,
    operationId: 'elf',
  });
  await player.mutation(api.characterSheet.selectEntry, {
    characterId,
    catalogEntryId: catalog.ironWill,
    operationId: 'iron-will',
  });
  await player.mutation(api.characterSheetSpells.record, {
    characterId,
    castingClassId: catalog.wizard,
    catalogEntryId: catalog.magicMissile,
    operationId: 'magic-missile',
  });
  await player.mutation(api.characterSheet.addClassLevel, {
    characterId,
    classEntryId: catalog.wizard,
    operationId: 'wizard-2',
  });
  return await read();
}

function expectBuiltWizard(sheet: Awaited<ReturnType<typeof buildAndLevel>>) {
  expect(sheet.calculated.level).toBe(2);
  // CRB p. 22 through the release: +2 Dex, +2 Int, −2 Con on base 10s.
  expect(sheet.calculated.abilities.dexterity.score).toBe(12);
  expect(sheet.calculated.abilities.intelligence.score).toBe(12);
  expect(sheet.calculated.abilities.constitution.score).toBe(8);
  // Wizard 2 has a good Will save of +3 (CRB p. 78); Iron Will adds +2 and
  // the Wisdom of 10 adds nothing.
  expect(sheet.calculated.breakdowns['save.will'].total).toBe(5);
  expect(
    sheet.catalogEntries.filter(
      (row) => row.detail.kind === 'spell' && row.name === 'Magic Missile',
    ),
  ).toHaveLength(1);
  expect(sheet.entries.filter((entry) => entry.kind === 'spell')).toHaveLength(
    1,
  );
  // An ordinary sheet carries no representative seeds.
  expect(
    sheet.catalogEntries.filter(
      (row) => row.scope === 'character' && row.detail.kind === 'class',
    ),
  ).toEqual([]);
}

test('under sheet authority a player in an ordinary campaign builds and levels a Character from the selected release', async () => {
  const deployment = await activatedDeployment();
  const { player, campaignId } = deployment;
  const characterId = await player.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Ilyana',
    kind: 'pc',
    operationId: 'create-ilyana',
  });
  const sheet = await buildAndLevel(deployment, characterId);
  expectBuiltWizard(sheet);
  expect(sheet.campaign?.ownershipAvailable).toBe(true);
  // The campaign's Characters read the sheet's facts.
  const row = (
    await player.query(api.character.listByCampaign, {
      organizationId: 'org',
      campaignId,
    })
  ).find(({ _id }) => _id === characterId);
  expect(row).toMatchObject({ level: 2, dexterity: 12, constitution: 8 });
});

test('under sheet authority a player without the demo grant builds and levels a private Character from the selected release', async () => {
  const deployment = await activatedDeployment();
  const { t, player } = deployment;
  const characterId = await player.mutation(api.characterSheet.create, {
    name: 'Corin',
    kind: 'pc',
    operationId: 'create-corin',
  });
  // An ordinary private Character carries no demo marker.
  expect(
    (await t.run((ctx) => ctx.db.get('character', characterId)))?.sheetDemo,
  ).toBeUndefined();
  expectBuiltWizard(await buildAndLevel(deployment, characterId));
  const owned = await player.query(api.character.listOwned, {});
  expect(
    owned.find((group) => group.kind === 'noCampaign')?.characters,
  ).toEqual([
    expect.objectContaining({
      _id: characterId,
      sheetPermanentFacts: expect.objectContaining({ level: 2, dexterity: 12 }),
    }),
  ]);
});
