// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

// The NPC Codex's Cruel Devotee (monk 5, Str 16) flurries +6/+6 (CRB p. 57,
// Table: Monk). Unchained (PU p. 14), the same Character's monk 5 has BAB
// +5 and flurries +8/+8 with no penalty.
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
        characterSheetDemo: true,
      });
    return ctx.db.insert('campaign', {
      name: 'Flurry fixture',
      description: '',
      organizationId: 'org',
      ownerId: 'owner',
      e2eFixture: {
        namespace: 'flurry',
        version: 1,
        workerKey: '0',
        caseKey: 'flurry',
        campaignKey: 'flurry',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'owner' });
  const member = t.withIdentity({ tokenIdentifier: 'member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Cruel Devotee',
    kind: 'pc',
    operationId: 'create',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 16 },
    operationId: 'strength',
  });
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  function definition(ruleIdentity: string) {
    const row = initial?.catalogEntries.find(
      (entry) => entry.ruleIdentity === ruleIdentity,
    );
    if (!row) throw new Error(`Missing representative ${ruleIdentity}`);
    return row._id;
  }
  const first = initial?.entries.find((row) => row.kind === 'classLevel');
  if (!first) throw new Error('Missing first Class Level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: definition('monk'),
    operationId: 'monk-1',
  });
  for (let level = 2; level <= 5; level++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      ...scope,
      classEntryId: definition('monk'),
      operationId: `monk-${level}`,
    });
  const fists = await member.mutation(api.characterSheet.createAttackRoutine, {
    ...scope,
    weaponEntryId: 'unarmed',
    name: 'Fists',
    operationId: 'fists',
  });
  const kick = await member.mutation(api.characterSheet.createAttackRoutine, {
    ...scope,
    weaponEntryId: 'unarmed',
    name: 'Kick',
    operationId: 'kick',
  });
  async function read() {
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!sheet) throw new Error('Missing sheet');
    const routine = (id: Id<'characterSheetEntry'>) => {
      const entry = sheet.entries.find((row) => row._id === id);
      const calculated = sheet.calculated.attackRoutines.find(
        (row) => row.entryId === id,
      );
      if (entry?.kind !== 'attackRoutine' || !calculated)
        throw new Error('Missing routine');
      return { entry, calculated };
    };
    return { sheet, fists: routine(fists), kick: routine(kick) };
  }
  return {
    owner,
    member,
    outsider,
    scope,
    definition,
    first: first._id,
    fists,
    read,
  };
}

const totals = (lines: readonly { attackBonus: { total: number } }[]) =>
  lines.map((line) => line.attackBonus.total);

test('a member switches flurry on as a Routine Option and the single attack stays unchanged', async () => {
  const { member, outsider, scope, definition, fists, read } = await fixture();
  const before = await read();
  expect(before.fists.calculated.options).toEqual([
    {
      catalogEntryId: definition('monk-flurry'),
      name: 'Flurry of Blows',
      ruleIdentity: 'monk-flurry',
      switchedOn: false,
      available: true,
      applicable: true,
    },
  ]);
  await expect(
    outsider.mutation(api.characterSheet.editAttackRoutine, {
      ...scope,
      entryId: fists,
      options: [definition('monk-flurry')],
      operationId: 'outsider-flurry',
    }),
  ).rejects.toThrow();
  await member.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: fists,
    options: [definition('monk-flurry')],
    operationId: 'flurry-on',
  });
  const { fists: flurry, kick } = await read();
  expect(flurry.entry.state.options).toEqual([definition('monk-flurry')]);
  expect(totals(flurry.calculated.single)).toEqual([6]);
  expect(totals(flurry.calculated.full)).toEqual([6, 6]);
  expect(flurry.calculated.full[1]?.extraAttack).toMatchObject({
    kind: 'flurry',
    name: 'Flurry of Blows',
  });
  expect(flurry.calculated.flurry).toMatchObject({
    version: 'core',
    monkLevel: 5,
    extraAttacks: 1,
    attackPenalty: -2,
    baseAttackBonus: { total: 5 },
  });
  expect(totals(kick.calculated.full)).toEqual([6]);
  expect(kick.calculated.flurry).toBeNull();
});

test('switching the monk’s class version maps a recorded flurry to the other version', async () => {
  const { owner, member, scope, definition, first, fists, read } =
    await fixture();
  await member.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: fists,
    options: [definition('monk-flurry')],
    operationId: 'flurry-on',
  });
  const core = await read();
  const revision = core.fists.entry.state.revision ?? 0;
  await member.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: first,
    classEntryId: definition('unchained-monk'),
    operationId: 'unchained',
  });
  const unchained = await read();
  expect(unchained.fists.entry.state.options).toEqual([
    definition('unchained-monk-flurry'),
  ]);
  expect(unchained.fists.entry.state.revision).toBe(revision + 1);
  expect(unchained.kick.entry.state.options).toBeUndefined();
  expect(totals(unchained.fists.calculated.full)).toEqual([8, 8]);
  expect(unchained.fists.calculated.flurry).toMatchObject({
    version: 'unchained',
    monkLevel: 5,
    attackPenalty: 0,
  });
  expect(
    unchained.fists.calculated.warnings.filter(
      (warning) => warning.check === 'missingRoutineOption',
    ),
  ).toEqual([]);
  await member.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: first,
    classEntryId: definition('unchained-monk'),
    operationId: 'unchained-retry',
  });
  expect((await read()).sheet.revision).toBe(unchained.sheet.revision);
  await owner.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: first,
    classEntryId: definition('monk'),
    operationId: 'original',
  });
  const restored = await read();
  expect(restored.fists.entry.state.options).toEqual([
    definition('monk-flurry'),
  ]);
  expect(totals(restored.fists.calculated.full)).toEqual([6, 6]);
});

test('a recorded flurry without its counting class feature stays switched on with a warning', async () => {
  const { member, scope, definition, fists, read } = await fixture();
  await member.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: fists,
    options: [definition('unchained-monk-flurry')],
    operationId: 'other-version',
  });
  const { fists: routine } = await read();
  expect(routine.entry.state.options).toEqual([
    definition('unchained-monk-flurry'),
  ]);
  expect(routine.calculated.flurry).toBeNull();
  expect(totals(routine.calculated.full)).toEqual([6]);
  expect(routine.calculated.warnings).toContainEqual(
    expect.objectContaining({
      check: 'missingRoutineOption',
      message:
        "Flurry of Blows (UC) is switched on in Fists, but the class feature doesn't count on this sheet. It has no effect until it does.",
    }),
  );
});

// APG p. 115: the zen archer flurries "only when using a bow"; the seeded
// archetype replaces the monk's Flurry of Blows, so a recorded core flurry is
// dormant with an advisory. The archetype was written for the core monk, so
// switching to Unchained maps the option to a flurry that counts, and
// switching back makes it dormant again.
test('a zen archer’s dormant flurry follows the class-version switch', async () => {
  const { owner, member, scope, definition, first, fists, read } =
    await fixture();
  await member.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: definition('monk'),
    catalogEntryId: definition('monk-zen-archer'),
    selected: true,
    operationId: 'zen-archer',
  });
  await member.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: fists,
    options: [definition('monk-flurry')],
    operationId: 'flurry-on',
  });
  const notCounting = expect.objectContaining({
    check: 'missingRoutineOption',
    message:
      "Flurry of Blows is switched on in Fists, but the class feature doesn't count on this sheet. It has no effect until it does.",
  });
  const zenArcher = await read();
  expect(zenArcher.fists.calculated.flurry).toBeNull();
  expect(totals(zenArcher.fists.calculated.full)).toEqual([6]);
  expect(zenArcher.fists.calculated.warnings).toContainEqual(notCounting);
  await owner.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: first,
    classEntryId: definition('unchained-monk'),
    operationId: 'unchained',
  });
  const unchained = await read();
  expect(unchained.fists.entry.state.options).toEqual([
    definition('unchained-monk-flurry'),
  ]);
  expect(totals(unchained.fists.calculated.full)).toEqual([8, 8]);
  expect(unchained.fists.calculated.flurry).toMatchObject({
    version: 'unchained',
    monkLevel: 5,
  });
  expect(
    unchained.fists.calculated.warnings.filter(
      (warning) => warning.check === 'missingRoutineOption',
    ),
  ).toEqual([]);
  expect(
    unchained.sheet.calculated.warnings.map((warning) => warning.check),
  ).toContain('archetypeUnchainedMonk');
  await owner.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: first,
    classEntryId: definition('monk'),
    operationId: 'original',
  });
  const restored = await read();
  expect(restored.fists.entry.state.options).toEqual([
    definition('monk-flurry'),
  ]);
  expect(restored.fists.calculated.flurry).toBeNull();
  expect(restored.fists.calculated.warnings).toContainEqual(notCounting);
});
