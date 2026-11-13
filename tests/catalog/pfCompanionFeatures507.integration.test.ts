/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';
import { withSheetCatalog } from '../character-sheet-catalog';
import { preloadCalledConvexModules } from '../convex-modules';
import { review, preview } from '../fixtures/pf-companion-features-507/data';
import { wolf } from '../fixtures/pf-companion-features-507/sheet';

const modules = import.meta.glob('../../convex/**/*.ts');
preloadCalledConvexModules({ modules, testFile: import.meta.url });

const DEVOTION = 'pf1-content/5uKoaeTitZUnfnQ1';
const SHARE_SPELLS = 'pf1-content/ZaBFpK3HT49DAUpE';
const LINK = 'pf1-content/g6t6hQoc95ASlz7D';
// Devotion's one reviewed Modifier: +4 morale on Will under the shared
// enchantment Situation.
const devotionModifier = {
  target: 'save.will' as const,
  bonusType: 'morale' as const,
  value: 4,
  condition: { situation: 'enchantment' },
};

/**
 * An isolated druid 6 with a linked wolf animal companion (CRB pp. 51-53).
 * The companion sheet records character-scoped manual copies of three admitted
 * resources of this batch from the full-corpus preview, so their reviewed
 * Notes and Devotion's situational Modifier reach the saved sheet. No
 * assessment or Catalog Release is constructed.
 */
test("a saved animal companion sheet names the features of its effective druid level, shows the reviewed Notes and Devotion's situational Will bonus, and keeps access to the campaign", async () => {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `companion507|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    return ctx.db.insert('campaign', {
      name: 'Isolated reviewed companion features #507',
      description: '',
      organizationId: 'org',
      ownerId: 'companion507|owner',
      e2eFixture: {
        namespace: 'pf-companion-features-507',
        version: 1,
        workerKey: '0',
        caseKey: 'reviewed',
        campaignKey: 'reviewed',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'companion507|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'companion507|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'companion507|outsider' });
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
  for (let position = 2; position <= 6; position++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      characterId,
      classEntryId: druid._id,
      operationId: `druid-${position}`,
    });
  const companionId = await member.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Wolf',
    kind: 'npc',
    operationId: 'wolf',
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
    scores: {
      strength: 13,
      dexterity: 15,
      constitution: 15,
      intelligence: 2,
      wisdom: 12,
      charisma: 6,
    },
    operationId: 'wolf-scores',
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
    operationId: 'wolf-progression',
    progression: wolf,
  });
  // Character-scoped manual copies of three admitted resources.
  for (const key of [DEVOTION, SHARE_SPELLS, LINK]) {
    expect(
      review.candidates.find((row) => row.externalKey === key)?.disposition,
    ).toBe('admitted');
    const resource = preview.entries.find((row) => row.externalKey === key);
    if (!resource) throw new Error(`Missing ${key}`);
    expect(resource.modifiers).toEqual(
      key === DEVOTION ? [devotionModifier] : [],
    );
    await t.run(async (ctx) => {
      const catalogEntryId = await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId: companionId,
        name: resource.name,
        ruleIdentity: resource.externalKey,
        stacksWithItself: false,
        modifiers: key === DEVOTION ? [devotionModifier] : [],
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
  if (!saved) throw new Error('Missing saved companion sheet');
  // CRB animal companion at effective druid level 6: 6 Hit Dice, natural armor
  // +4 on the wolf's +2, Str/Dex +2, and the features the Animal Companion
  // record grants by then that the progression names.
  for (const projection of [saved.calculated, saved.permanentCalculated]) {
    expect(projection.companionProgression).toMatchObject({
      status: 'active',
      effectiveLevel: 6,
      hitDice: 6,
      bonusTricks: 3,
      features: ['Link', 'Share spells', 'Evasion', 'Devotion'],
    });
    expect(projection.breakdowns['ac.natural'].total).toBe(6);
    expect(projection.abilities.strength.score).toBe(15);
  }
  // Devotion's +4 morale waits on its Situation: it is listed as conditional,
  // not added to Will.
  const will = saved.calculated.breakdowns['save.will'];
  expect(will.applied.map((row) => row.entryName)).not.toContain('Devotion');
  expect(
    will.conditional.map(({ value, bonusType, condition }) => ({
      value,
      bonusType,
      condition,
    })),
  ).toEqual([
    { value: 4, bonusType: 'morale', condition: { situation: 'enchantment' } },
  ]);
  const notes = [SHARE_SPELLS, LINK].map(
    (key) =>
      preview.entries.find((row) => row.externalKey === key)
        ?.situationalNotes?.[0]?.text,
  );
  expect(saved.calculated.entryNotes.map((note) => note.text)).toEqual(notes);
  // The client catalog preview shows the same.
  const local = calculateCharacterSheetPreview(saved);
  expect(local.entryNotes).toEqual(saved.calculated.entryNotes);
  expect(
    local.breakdowns['save.will'].conditional.map((row) => row.value),
  ).toEqual([4]);
  // Campaign members read it; outsiders are refused.
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId: companionId }),
    )?.calculated.entryNotes.map((note) => note.text),
  ).toEqual(notes);
  await expect(
    outsider.query(api.characterSheet.read, { characterId: companionId }),
  ).rejects.toThrow();
});
