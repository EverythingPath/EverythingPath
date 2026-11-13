/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';
import type { personalBonusTypes } from '../../src/lib/character-sheet';
import { withSheetCatalog } from '../character-sheet-catalog';
import { preloadCalledConvexModules } from '../convex-modules';
import { review } from '../fixtures/buffs-547/data';
import { buffEntry } from '../fixtures/buffs-547/sheet';

const modules = import.meta.glob('../../convex/**/*.ts');
preloadCalledConvexModules({ modules, testFile: import.meta.url });

type BonusType = (typeof personalBonusTypes)[number];
const FIGHTING_DEFENSIVELY = 'pf1/V8cRFtOQA6ltklEl';
const SHIELD_OF_FAITH = 'pf1/WgCWQxR53UdVSGPB';

/**
 * An isolated fighter with 3 ranks in Acrobatics. The sheet records a
 * character-scoped copy of the held Fighting Defensively (its numbers are
 * reviewed; only its duration lacks evidence), with the
 * full-corpus preview's imported and reviewed Modifiers, and a player-authored
 * running Shield of Faith carrying the held effect's reviewed caster-level
 * Modifier (a public-writer fixture, never an admitted Spell Effect). No
 * assessment or Catalog Release is constructed.
 */
test('a saved sheet applies fighting defensively by its Acrobatics ranks and a running shield of faith by its caster level, and keeps access to the campaign', async () => {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `buffs547|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    return ctx.db.insert('campaign', {
      name: 'Isolated reviewed buffs #547',
      description: '',
      organizationId: 'org',
      ownerId: 'buffs547|owner',
      e2eFixture: {
        namespace: 'buffs-547',
        version: 1,
        workerKey: '0',
        caseKey: 'reviewed',
        campaignKey: 'reviewed',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'buffs547|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'buffs547|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'buffs547|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Defender',
    kind: 'pc',
    operationId: 'defender',
  });
  const scope = { characterId };
  const created = await owner.query(api.characterSheet.read, scope);
  const level = created?.entries.find((entry) => entry.kind === 'classLevel');
  if (!level) throw new Error('Class Level fixture missing');
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    skillRank: { skill: 'skill.acr', ranks: 3 },
    operationId: 'acrobatics',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!before) throw new Error('Missing saved sheet');
  const acBefore = before.calculated.breakdowns['ac.other'].total;
  const attackBefore = before.calculated.breakdowns['attack.melee'].total;

  // The held combat option, copied with its imported and reviewed
  // Modifiers: -4 on attack rolls and +2 dodge to AC, +3 with 3 Acrobatics
  // ranks.
  const defensively = buffEntry(FIGHTING_DEFENSIVELY);
  expect(
    review.candidates.find((row) => row.externalKey === FIGHTING_DEFENSIVELY)
      ?.disposition,
  ).toBe('held');
  expect(defensively.modifiers).toEqual([
    { target: 'attack', bonusType: 'untyped', value: -4 },
    {
      target: 'ac',
      bonusType: 'dodge',
      value: { formula: '2 + min(1, floor(@skillRanks.acr / 3))' },
    },
  ]);
  const sheetEntryId = await t.run(async (ctx) => {
    const catalogEntryId = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: defensively.name,
      ruleIdentity: defensively.externalKey,
      stacksWithItself: false,
      modifiers: defensively.modifiers.map((modifier) => ({
        target: modifier.target as 'ac' | 'attack',
        bonusType: modifier.bonusType as BonusType,
        value: modifier.value,
      })),
      sources: defensively.sources,
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
  const fighting = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  if (!fighting) throw new Error('Missing saved sheet');
  expect(fighting.calculated.breakdowns['ac.other'].total).toBe(acBefore + 3);
  expect(fighting.calculated.breakdowns['attack.melee'].total).toBe(
    attackBefore - 4,
  );
  expect(
    fighting.calculated.breakdowns['ac.other'].applied.find(
      (row) => row.entryName === 'Fighting Defensively',
    ),
  ).toMatchObject({ bonusType: 'dodge', value: 3 });
  // The client catalog preview calculates the same.
  const local = calculateCharacterSheetPreview(fighting);
  expect(local.breakdowns['ac.other'].total).toBe(acBefore + 3);
  expect(local.breakdowns['attack.melee'].total).toBe(attackBefore - 4);

  // A running shield of faith at caster level 12: +4 deflection.
  const faith = buffEntry(SHIELD_OF_FAITH);
  expect(faith.detail).toMatchObject({
    kind: 'spellEffect',
    spellKey: 'pf1/y2uhoqr4itdbw5g4',
    defaultCasterLevel: 1,
  });
  const effectId = await member.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Isolated running Shield of Faith',
    modifiers: faith.modifiers.map((modifier) => ({
      target: modifier.target as 'ac',
      bonusType: modifier.bonusType as BonusType,
      value: modifier.value,
    })),
    detail: {
      kind: 'spellEffect',
      spellKey: 'pf1/y2uhoqr4itdbw5g4',
      defaultCasterLevel: 1,
      lastsOverOneDay: false,
    },
    casterLevel: 12,
    operationId: 'running-shield-of-faith',
  });
  const shielded = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!shielded) throw new Error('Missing saved sheet');
  expect(shielded.calculated.breakdowns['ac.other'].total).toBe(
    acBefore + 3 + 4,
  );
  expect(
    calculateCharacterSheetPreview(shielded).breakdowns['ac.other'].total,
  ).toBe(acBefore + 7);
  // Switching both off restores the sheet: the running effect through the
  // public writer.
  await member.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId: effectId,
    active: false,
    operationId: 'stop-shield-of-faith',
  });
  // The manual copy is a fixture row, switched off directly.
  await t.run((ctx) => ctx.db.patch(sheetEntryId, { active: false }));
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(after?.calculated.breakdowns['ac.other'].total).toBe(acBefore);
  expect(after?.calculated.breakdowns['attack.melee'].total).toBe(attackBefore);
  // Outsiders are refused.
  await expect(
    outsider.query(api.characterSheet.read, scope),
  ).rejects.toThrow();
});
