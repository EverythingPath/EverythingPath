// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

async function fixture() {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const [person, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: person,
        orgIds: [{ orgId, role: 'member' }],
      });
    return ctx.db.insert('campaign', {
      name: 'Casting fixture',
      description: '',
      organizationId: 'org',
      ownerId: 'owner',
      e2eFixture: {
        namespace: 'casting',
        version: 1,
        workerKey: '0',
        caseKey: 'casting',
        campaignKey: 'casting',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'owner' });
  const member = t.withIdentity({ tokenIdentifier: 'member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Vessa',
    kind: 'pc',
    operationId: 'create',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const level = initial?.entries.find((entry) => entry.kind === 'classLevel');
  const wizard = initial?.catalogEntries.find(
    (entry) => entry.name === 'Wizard',
  );
  const cleric = initial?.catalogEntries.find(
    (entry) => entry.name === 'Cleric',
  );
  if (!level || !wizard || !cleric) throw new Error('Missing casting fixture');
  return { t, owner, member, outsider, scope, level, wizard, cleric };
}

test('members read independent Wizard and Cleric Spellcastings after shared Class Level choices', async () => {
  // CRB tables 3–6 and 3–16: each 1st-level caster has one 1st-level slot.
  // Int/Wis 18 grant one bonus 1st-level slot, never a 2nd-level slot yet.
  const { owner, member, scope, level, wizard, cleric } = await fixture();
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { intelligence: 18, wisdom: 18 },
    operationId: 'casting-scores',
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: wizard._id,
    operationId: 'wizard',
  });
  await member.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: cleric._id,
    operationId: 'cleric',
  });
  const sheet = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  expect(sheet?.calculated).toMatchObject({
    spellcastings: [
      { name: 'Wizard', castingLevel: 1, casterLevel: { total: 1 } },
      { name: 'Cleric', castingLevel: 1, casterLevel: { total: 1 } },
    ],
  });
  for (const casting of sheet?.calculated.spellcastings ?? []) {
    expect(casting.concentration?.total).toBe(5);
    expect(casting.castableSpellLevels).toEqual([0, 1]);
    expect(casting.slots.find((slot) => slot.spellLevel === 1)).toMatchObject({
      base: 1,
      bonus: 1,
      total: 2,
      known: null,
      prepared: null,
      dc: { total: 15 },
    });
  }
  expect(sheet?.permanentCalculated.spellcastings).toEqual(
    sheet?.calculated.spellcastings,
  );
});

test('current casting follows saved temporary Intelligence and school conditions while bonus slots stay permanent', async () => {
  const { owner, member, scope, level, wizard } = await fixture();
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { intelligence: 18 },
    operationId: 'intelligence',
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: wizard._id,
    operationId: 'wizard',
  });
  await member.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: "Fox's cunning",
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 3,
    },
    modifiers: [{ target: 'ability.int', bonusType: 'enhancement', value: 4 }],
    operationId: 'fox',
  });
  await member.mutation(api.characterSheet.createPersonalAdjustment, {
    ...scope,
    name: 'Spell Focus',
    modifiers: [
      {
        target: 'spellDC',
        bonusType: 'untyped',
        value: 1,
        condition: { castingClass: 'wizard', school: 'evocation' },
      },
      {
        target: 'spellDC',
        bonusType: 'untyped',
        value: 2,
        condition: { castingClass: 'cleric' },
      },
    ],
    operationId: 'focus',
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const casting = sheet?.calculated.spellcastings[0];
  const slot = casting?.slots.find((slot) => slot.spellLevel === 1);
  expect(casting?.concentration?.total).toBe(7);
  expect(slot).toMatchObject({
    base: 1,
    bonus: 1,
    total: 2,
    dc: { total: 17 },
    schoolDCs: [{ school: 'evocation', breakdown: { total: 18 } }],
  });
  expect(slot?.dc.applied).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        entryName: 'Casting ability modifier',
        value: 6,
      }),
    ]),
  );
  expect(slot?.schoolDCs[0]?.breakdown.applied).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        entryName: 'Spell Focus',
        value: 1,
        condition: { castingClass: 'wizard', school: 'evocation' },
      }),
    ]),
  );
  const permanent = sheet?.permanentCalculated.spellcastings[0];
  expect(permanent?.concentration?.total).toBe(5);
  expect(permanent?.slots.find((slot) => slot.spellLevel === 1)).toMatchObject({
    total: 2,
    bonus: 1,
    dc: { total: 15 },
  });
});

test('Spellcasting reads refuse outsiders and forged campaign context', async () => {
  const { owner, outsider, scope } = await fixture();
  await expect(
    outsider.query(api.characterSheet.read, scope),
  ).rejects.toThrow();
  await expect(
    owner.query(api.characterSheet.read, { ...scope, organizationId: 'other' }),
  ).rejects.toThrow();
});
