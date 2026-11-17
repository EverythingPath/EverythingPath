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
import { review } from '../fixtures/pf-buffs-548/data';
import { buffEntry } from '../fixtures/pf-buffs-548/sheet';

const modules = import.meta.glob('../../convex/**/*.ts');
preloadCalledConvexModules({ modules, testFile: import.meta.url });

type BonusType = (typeof personalBonusTypes)[number];
const SQUEEZING = 'pf1-content/Ej91vWnfFTaxMhyZ';
const DIVINE_POWER = 'pf1-content/0hRYCva2hdwUNFh6';
const DIVINE_POWER_SPELL = 'pf1/0yvwyclhkf76veo1';

/**
 * An isolated fighter. The sheet records a character-scoped copy of the held
 * Squeezing (large) (its numbers are the Core Rulebook's; only its missing
 * citation holds it), with the full-corpus preview's imported Modifiers, and a
 * player-authored running Divine Power carrying the held effect's reviewed
 * caster-level Modifiers (a public-writer fixture, never an admitted Spell
 * Effect). No assessment or Catalog Release is constructed.
 */
test('a saved sheet applies squeezing and a running divine power by its caster level, and keeps access to the campaign', async () => {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `pfbuffs548|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    return ctx.db.insert('campaign', {
      name: 'Isolated reviewed pf-buffs #548',
      description: '',
      organizationId: 'org',
      ownerId: 'pfbuffs548|owner',
      e2eFixture: {
        namespace: 'pf-buffs-548',
        version: 1,
        workerKey: '0',
        caseKey: 'reviewed',
        campaignKey: 'reviewed',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'pfbuffs548|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'pfbuffs548|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'pfbuffs548|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Squeezer',
    kind: 'pc',
    operationId: 'squeezer',
  });
  const scope = { characterId };
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!before) throw new Error('Missing saved sheet');
  const acBefore = before.calculated.breakdowns['ac.other'].total;
  const attackBefore = before.calculated.breakdowns['attack.melee'].total;
  const damageBefore = before.calculated.breakdowns['damage.melee'].total;
  const climbBefore = before.calculated.breakdowns['skill.clm'].total;

  // The held combat state, copied with its imported Modifiers: -4 on attack
  // rolls and -4 to AC.
  const squeezing = buffEntry(SQUEEZING);
  expect(
    review.candidates.find((row) => row.externalKey === SQUEEZING)?.disposition,
  ).toBe('held');
  expect(squeezing.modifiers).toEqual([
    { target: 'attack', bonusType: 'untyped', value: -4 },
    { target: 'ac', bonusType: 'untyped', value: -4 },
  ]);
  const sheetEntryId = await t.run(async (ctx) => {
    const catalogEntryId = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: squeezing.name,
      ruleIdentity: squeezing.externalKey,
      stacksWithItself: false,
      modifiers: squeezing.modifiers.map((modifier) => ({
        target: modifier.target as 'ac' | 'attack',
        bonusType: modifier.bonusType as BonusType,
        value: modifier.value,
      })),
      sources: squeezing.sources,
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
  const squeezed = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  if (!squeezed) throw new Error('Missing saved sheet');
  expect(squeezed.calculated.breakdowns['ac.other'].total).toBe(acBefore - 4);
  expect(squeezed.calculated.breakdowns['attack.melee'].total).toBe(
    attackBefore - 4,
  );
  // The client catalog preview calculates the same.
  const local = calculateCharacterSheetPreview(squeezed);
  expect(local.breakdowns['ac.other'].total).toBe(acBefore - 4);
  expect(local.breakdowns['attack.melee'].total).toBe(attackBefore - 4);

  // A running divine power at caster level 12: +4 luck on attack rolls,
  // weapon damage and Climb.
  const power = buffEntry(DIVINE_POWER);
  expect(power.detail).toMatchObject({
    kind: 'spellEffect',
    spellKey: DIVINE_POWER_SPELL,
    defaultCasterLevel: 7,
  });
  const effectId = await member.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Isolated running Divine Power',
    modifiers: power.modifiers.map((modifier) => ({
      target: modifier.target as 'attack',
      bonusType: modifier.bonusType as BonusType,
      value: modifier.value,
    })),
    detail: {
      kind: 'spellEffect',
      spellKey: DIVINE_POWER_SPELL,
      defaultCasterLevel: 7,
      lastsOverOneDay: false,
    },
    casterLevel: 12,
    operationId: 'running-divine-power',
  });
  const powered = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!powered) throw new Error('Missing saved sheet');
  expect(powered.calculated.breakdowns['attack.melee'].total).toBe(
    attackBefore - 4 + 4,
  );
  expect(powered.calculated.breakdowns['damage.melee'].total).toBe(
    damageBefore + 4,
  );
  expect(powered.calculated.breakdowns['skill.clm'].total).toBe(
    climbBefore + 4,
  );
  expect(
    calculateCharacterSheetPreview(powered).breakdowns['skill.clm'].total,
  ).toBe(climbBefore + 4);
  // Switching both off restores the sheet: the running effect through the
  // public writer.
  await member.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId: effectId,
    active: false,
    operationId: 'stop-divine-power',
  });
  // The manual copy is a fixture row, switched off directly.
  await t.run((ctx) => ctx.db.patch(sheetEntryId, { active: false }));
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(after?.calculated.breakdowns['ac.other'].total).toBe(acBefore);
  expect(after?.calculated.breakdowns['attack.melee'].total).toBe(attackBefore);
  expect(after?.calculated.breakdowns['skill.clm'].total).toBe(climbBefore);
  // Outsiders are refused.
  await expect(
    outsider.query(api.characterSheet.read, scope),
  ).rejects.toThrow();
});
