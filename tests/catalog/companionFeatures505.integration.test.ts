/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';
import { withSheetCatalog } from '../character-sheet-catalog';
import { preloadCalledConvexModules } from '../convex-modules';
import {
  assessedCandidates,
  preview,
} from '../fixtures/companion-features-505/data';

const modules = import.meta.glob('../../convex/**/*.ts');
preloadCalledConvexModules({ modules, testFile: import.meta.url });
const selectBaseCreature = makeFunctionReference<
  'mutation',
  {
    characterId: Id<'character'>;
    relationshipId: Id<'companionRelationship'>;
    baseCreatureKey: string | null;
    operationId: string;
  }
>('characterSheetFamiliars:selectBaseCreature');

const EVASION = 'pf1/ooxP3ifhV6kC0wTM';
const SHARE_SPELLS = 'pf1/B4tsrPOAtyEOmwAr';
const FAMILIAR = 'pf1/EbgtpUXqVup5iXeD';

/**
 * An isolated wizard 1 with a linked cat familiar (CRB pp. 82-83). The
 * familiar sheet records character-scoped manual copies of two admitted
 * resources of this batch from the full-corpus preview, so their reviewed
 * Notes reach the saved sheet. No assessment or Catalog Release is
 * constructed.
 */
test('a saved familiar sheet names the admitted first-level abilities, shows their reviewed Notes and keeps access to the campaign', async () => {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `companion505|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    return ctx.db.insert('campaign', {
      name: 'Isolated reviewed companion features #505',
      description: '',
      organizationId: 'org',
      ownerId: 'companion505|owner',
      e2eFixture: {
        namespace: 'companion-features-505',
        version: 1,
        workerKey: '0',
        caseKey: 'reviewed',
        campaignKey: 'reviewed',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'companion505|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'companion505|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'companion505|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Wizard',
    kind: 'pc',
    operationId: 'wizard',
  });
  const companionId = await member.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Cat',
    kind: 'npc',
    operationId: 'cat',
  });
  const firstClassLevel = (id: Id<'character'>) =>
    t.run((ctx) =>
      ctx.db
        .query('characterSheetEntry')
        .withIndex('by_characterId_and_kind_and_active', (q) =>
          q.eq('characterId', id).eq('kind', 'classLevel').eq('active', true),
        )
        .first(),
    );
  const companionLevel = await firstClassLevel(companionId);
  if (!companionLevel) throw new Error('Companion fixture missing');
  await member.mutation(api.characterSheet.deleteClassLevel, {
    characterId: companionId,
    entryId: companionLevel._id,
    operationId: 'creature-only',
  });
  const wizard = await t.run((ctx) =>
    ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_ruleIdentity', (q) =>
        q.eq('characterId', characterId).eq('ruleIdentity', 'wizard'),
      )
      .unique(),
  );
  const level = await firstClassLevel(characterId);
  if (!wizard || !level) throw new Error('Wizard fixture missing');
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: level._id,
    classEntryId: wizard._id,
    hpGained: 6,
    operationId: 'wizard1',
  });
  const relationshipId = await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: companionId,
    kind: 'familiar',
    sources: [
      {
        key: 'wizard',
        label: 'Arcane bond',
        enabled: true,
        sheetEntryId: level._id,
      },
    ],
    operationId: 'link',
  });
  await member.mutation(selectBaseCreature, {
    characterId: companionId,
    relationshipId,
    baseCreatureKey: 'cat',
    operationId: 'choose-cat',
  });
  // Character-scoped manual copies of two admitted resources.
  for (const key of [EVASION, SHARE_SPELLS]) {
    expect(
      assessedCandidates.find((row) => row.externalKey === key)?.disposition,
    ).toBe('admitted');
    const resource = preview.entries.find((row) => row.externalKey === key);
    if (!resource) throw new Error(`Missing ${key}`);
    await t.run(async (ctx) => {
      const catalogEntryId = await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId: companionId,
        name: resource.name,
        ruleIdentity: resource.externalKey,
        stacksWithItself: false,
        modifiers: [],
        // These reviewed Notes carry text and an optional target only.
        situationalNotes: (resource.situationalNotes ?? []).map(
          ({ text, target }) => (target ? { text, target } : { text }),
        ),
        sources: resource.sources,
        detail: { kind: 'manual' },
      });
      await ctx.db.insert('characterSheetEntry', {
        characterId: companionId,
        kind: 'manual',
        active: true,
        catalogEntryId,
        state: { kind: 'manual' },
      });
    });
  }
  const saved = withSheetCatalog(
    await member.query(api.characterSheet.read, { characterId: companionId }),
  );
  if (!saved) throw new Error('Missing saved familiar sheet');
  // CRB Familiar table, master level 1: natural armor +1, Intelligence 6 and
  // the four first-level abilities the Familiar record grants.
  const firstLevel = (
    assessedCandidates.find((row) => row.externalKey === FAMILIAR)
      ?.mechanicsReview.companionReview.schedule ?? []
  )
    .filter((row) => row.masterLevel === 1)
    .flatMap((row) => row.abilities)
    .map((key) =>
      preview.entries
        .find((row) => row.externalKey === key)
        ?.name.toLowerCase(),
    )
    .sort();
  expect(firstLevel).toEqual([
    'alertness',
    'empathic link',
    'improved evasion',
    'share spells',
  ]);
  for (const projection of [saved.calculated, saved.permanentCalculated]) {
    expect(projection.familiar?.progression).toMatchObject({
      level: 1,
      naturalArmor: 1,
      intelligence: 6,
      spellResistance: null,
    });
    expect(
      projection.familiar?.progression?.specialAbilities
        .map((name) => name.toLowerCase())
        .sort(),
    ).toEqual(firstLevel);
    expect(projection.abilities.intelligence.score).toBe(6);
  }
  const evasionNote =
    'Improved evasion: against an attack that allows a Reflex save for half damage, the familiar takes no damage on a successful save and half damage on a failed save.';
  expect(
    saved.calculated.breakdowns['save.ref'].notes?.map((note) => note.text),
  ).toEqual([evasionNote]);
  expect(saved.calculated.entryNotes.map((note) => note.text)).toEqual([
    preview.entries.find((row) => row.externalKey === SHARE_SPELLS)
      ?.situationalNotes?.[0]?.text,
  ]);
  // The client catalog preview shows the same Notes.
  const local = calculateCharacterSheetPreview(saved);
  expect(local.breakdowns['save.ref'].notes?.map((note) => note.text)).toEqual([
    evasionNote,
  ]);
  expect(local.entryNotes).toEqual(saved.calculated.entryNotes);
  // Campaign members read it; outsiders are refused.
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId: companionId }),
    )?.calculated.breakdowns['save.ref'].notes?.map((note) => note.text),
  ).toEqual([evasionNote]);
  await expect(
    outsider.query(api.characterSheet.read, { characterId: companionId }),
  ).rejects.toThrow();
});
