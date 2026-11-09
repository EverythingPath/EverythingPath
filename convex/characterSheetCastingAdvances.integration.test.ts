// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

async function fixture() {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const person of ['owner', 'member', 'outsider'])
      await ctx.db.insert('user', {
        tokenIdentifier: person,
        orgIds: [
          { orgId: person === 'outsider' ? 'other' : 'org', role: 'member' },
        ],
      });
    return ctx.db.insert('campaign', {
      name: 'Casting advances',
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
    name: 'Ilsa',
    kind: 'pc',
    operationId: 'create',
  });
  const scope = { organizationId: 'org', characterId };
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!initial) throw new Error('Missing prepared sheet');
  const catalog = (ruleIdentity: string) => {
    const found = initial.catalogEntries.find(
      (row) => row.ruleIdentity === ruleIdentity,
    );
    if (!found) throw new Error(`Missing ${ruleIdentity}`);
    return found._id;
  };
  const first = initial.entries.find((row) => row.kind === 'classLevel');
  if (!first) throw new Error('Missing first Class Level');
  /** Records the listed classes as Class Levels in order. */
  async function levels(classes: readonly string[]) {
    const ids: Id<'characterSheetEntry'>[] = [];
    for (const [index, identity] of classes.entries()) {
      if (index === 0) {
        await owner.mutation(api.characterSheet.editClassLevel, {
          ...scope,
          entryId: first!._id,
          classEntryId: catalog(identity),
          operationId: `level-${index}`,
        });
        ids.push(first!._id);
      } else
        ids.push(
          await owner.mutation(api.characterSheet.addClassLevel, {
            ...scope,
            classEntryId: catalog(identity),
            operationId: `level-${index}`,
          }),
        );
    }
    return ids;
  }
  async function read() {
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!sheet) throw new Error('Missing sheet');
    return sheet;
  }
  async function grantKeyOf(ruleIdentity: string) {
    const sheet = await read();
    const row = sheet.calculated.resolvedEntries.find(
      ({ entry }) =>
        'catalogEntryId' in entry &&
        entry.catalogEntryId === catalog(ruleIdentity),
    );
    if (!row || !('grantKey' in row.entry) || !row.entry.grantKey)
      throw new Error(`Missing ${ruleIdentity} Grant`);
    return row.entry.grantKey;
  }
  return {
    t,
    owner,
    member,
    outsider,
    scope,
    catalog,
    levels,
    read,
    grantKeyOf,
  };
}
function lastLevel(ids: readonly Id<'characterSheetEntry'>[]) {
  const last = ids.at(-1);
  if (!last) throw new Error('Missing Class Level');
  return last;
}
const repeat = (identity: string, count: number) =>
  Array.from({ length: count }, () => identity);

test('players assign each Mystic Theurge advance, keep split and cleared choices, and see the casting result', async () => {
  const { owner, member, scope, catalog, levels, read } = await fixture();
  const ids = await levels([
    ...repeat('wizard', 3),
    ...repeat('sorcerer', 3),
    ...repeat('cleric', 3),
    ...repeat('mystic-theurge', 2),
  ]);
  const [theurge1, theurge2] = ids.slice(-2);
  if (!theurge1 || !theurge2) throw new Error('Missing Mystic Theurge levels');
  const before = await read();
  expect(
    before.calculated.castingAdvances.map((advance) => [
      advance.entryId,
      advance.kind,
      advance.targetClassEntryId,
      advance.prefilled,
      advance.eligibleClassEntryIds.length,
    ]),
  ).toEqual([
    [theurge1, 'arcane', null, false, 2],
    [theurge1, 'divine', catalog('cleric'), true, 1],
    [theurge2, 'arcane', null, false, 2],
    [theurge2, 'divine', catalog('cleric'), true, 1],
  ]);
  expect(
    before.calculated.warnings
      .filter((warning) => warning.check === 'castingAdvanceMissing')
      .map((warning) => warning.target),
  ).toEqual([
    { kind: 'classLevel', entryId: theurge1, field: 'castingAdvances' },
    { kind: 'classLevel', entryId: theurge2, field: 'castingAdvances' },
  ]);
  await member.mutation(api.characterSheet.assignCastingAdvance, {
    ...scope,
    entryId: theurge1,
    index: 0,
    classEntryId: catalog('wizard'),
    operationId: 'theurge-1-arcane',
  });
  await member.mutation(api.characterSheet.assignCastingAdvance, {
    ...scope,
    entryId: theurge2,
    index: 0,
    classEntryId: catalog('sorcerer'),
    operationId: 'theurge-2-arcane',
  });
  const assigned = await read();
  // The pre-filled divine choice is recorded with the first explicit choice.
  expect(
    assigned.entries.flatMap((row) =>
      row.kind === 'classLevel' && row.state.castingAdvances
        ? [[row._id, row.state.castingAdvances]]
        : [],
    ),
  ).toEqual([
    [
      theurge1,
      [
        { classEntryId: catalog('wizard') },
        { classEntryId: catalog('cleric') },
      ],
    ],
    [
      theurge2,
      [
        { classEntryId: catalog('sorcerer') },
        { classEntryId: catalog('cleric') },
      ],
    ],
  ]);
  expect(
    assigned.calculated.spellcastings.map((casting) => [
      casting.classTag,
      casting.classLevels,
      casting.castingLevel,
      casting.casterLevel?.total,
    ]),
  ).toEqual([
    ['wizard', 3, 4, 4],
    ['sorcerer', 3, 4, 4],
    ['cleric', 3, 5, 5],
  ]);
  await owner.mutation(api.characterSheet.assignCastingAdvance, {
    ...scope,
    entryId: theurge2,
    index: 1,
    classEntryId: null,
    operationId: 'clear-divine',
  });
  const cleared = await read();
  expect(
    cleared.calculated.spellcastings.find((row) => row.classTag === 'cleric')
      ?.castingLevel,
  ).toBe(4);
  expect(
    cleared.calculated.warnings.filter(
      (warning) => warning.check === 'castingAdvanceMissing',
    ),
  ).toMatchObject([{ subject: `${theurge2}:castingAdvances:1` }]);
  await owner.mutation(api.characterSheet.assignCastingAdvance, {
    ...scope,
    entryId: theurge2,
    index: 1,
    classEntryId: null,
    operationId: 'clear-divine-again',
  });
  expect((await read()).revision).toBe(cleared.revision);
  // Removing the earlier wizard level keeps the recorded choice unchanged.
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: theurge1,
    classEntryId: catalog('fighter'),
    operationId: 'not-a-theurge',
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: theurge1,
    classEntryId: catalog('mystic-theurge'),
    operationId: 'theurge-again',
  });
  expect(
    (await read()).entries.find((row) => row._id === theurge1),
  ).toMatchObject({
    state: {
      castingAdvances: [
        { classEntryId: catalog('wizard') },
        { classEntryId: catalog('cleric') },
      ],
    },
  });
});

test('an untouched sibling without a pre-fill stays unrecorded and pre-fills once one class qualifies', async () => {
  const { owner, scope, catalog, levels, read } = await fixture();
  const [, sorcerer, , theurge] = await levels([
    'wizard',
    'sorcerer',
    'cleric',
    'mystic-theurge',
  ]);
  if (!sorcerer || !theurge) throw new Error('Missing Class Levels');
  await owner.mutation(api.characterSheet.assignCastingAdvance, {
    ...scope,
    entryId: theurge,
    index: 1,
    classEntryId: catalog('cleric'),
    operationId: 'divine',
  });
  const assigned = await read();
  expect(assigned.entries.find((row) => row._id === theurge)).toMatchObject({
    state: { castingAdvances: [null, { classEntryId: catalog('cleric') }] },
  });
  expect(
    assigned.calculated.castingAdvances.map((advance) => [
      advance.targetClassEntryId,
      advance.prefilled,
    ]),
  ).toEqual([
    [null, false],
    [catalog('cleric'), false],
  ]);
  // Only the wizard qualifies now, so the unrecorded arcane advance pre-fills.
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: sorcerer,
    classEntryId: catalog('fighter'),
    operationId: 'no-sorcerer',
  });
  expect(
    (await read()).calculated.castingAdvances.map((advance) => [
      advance.targetClassEntryId,
      advance.prefilled,
    ]),
  ).toEqual([
    [catalog('wizard'), true],
    [catalog('cleric'), false],
  ]);
});

test('advisory advance targets are kept with acceptable warnings while malformed choices are refused', async () => {
  const { owner, scope, catalog, levels, read } = await fixture();
  const ids = await levels([
    ...repeat('wizard', 3),
    ...repeat('cleric', 3),
    'mystic-theurge',
  ]);
  const [firstLevel] = ids;
  const theurge = ids.at(-1);
  if (!firstLevel || !theurge) throw new Error('Missing Class Levels');
  await owner.mutation(api.characterSheet.assignCastingAdvance, {
    ...scope,
    entryId: theurge,
    index: 0,
    classEntryId: catalog('cleric'),
    operationId: 'wrong-kind',
  });
  const sheet = await read();
  const warning = sheet.calculated.warnings.find(
    (row) => row.check === 'castingAdvanceTarget',
  );
  expect(warning).toMatchObject({
    kind: 'rules',
    message:
      'Mystic Theurge advances an arcane spellcasting class; Cleric does not cast arcane spells.',
  });
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning!.check,
    subject: warning!.subject,
    fingerprint: warning!.fingerprint,
    operationId: 'accept-kind',
  });
  expect(
    (await read()).calculated.spellcastings.find(
      (row) => row.classTag === 'cleric',
    )?.castingLevel,
  ).toBe(5);
  for (const [args, message] of [
    [
      { entryId: theurge, index: 2 },
      'Choose a casting advance of this Class Level',
    ],
    [
      { entryId: firstLevel, index: 0 },
      'Choose a casting advance of this Class Level',
    ],
  ] as const)
    await expect(
      owner.mutation(api.characterSheet.assignCastingAdvance, {
        ...scope,
        ...args,
        classEntryId: catalog('wizard'),
        operationId: 'invalid',
      }),
    ).rejects.toThrow(message);
});

test('a foreign class is refused as an advance target', async () => {
  const { owner, scope, levels, read } = await fixture();
  const ids = await levels([
    ...repeat('wizard', 3),
    ...repeat('cleric', 3),
    'mystic-theurge',
  ]);
  const campaignId = (await read()).character.campaignId;
  const otherId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Other caster',
    kind: 'pc',
    operationId: 'other',
  });
  const foreignWizard = withSheetCatalog(
    await owner.query(api.characterSheet.read, {
      organizationId: 'org',
      characterId: otherId,
    }),
  )?.catalogEntries.find((row) => row.ruleIdentity === 'wizard');
  if (!foreignWizard) throw new Error('Missing foreign Wizard');
  await expect(
    owner.mutation(api.characterSheet.assignCastingAdvance, {
      ...scope,
      entryId: lastLevel(ids),
      index: 0,
      classEntryId: foreignWizard._id,
      operationId: 'foreign',
    }),
  ).rejects.toThrow('Class does not belong to this Character');
});

test('domain and school choices grant slots and Spells, and opposition schools tag recorded Spells', async () => {
  const { t, owner, member, scope, catalog, levels, read, grantKeyOf } =
    await fixture();
  const ids = await levels([...repeat('cleric', 3), 'wizard']);
  const domains = await grantKeyOf('cleric-domains');
  const domainSource = {
    kind: 'prompt' as const,
    source: { kind: 'grant' as const, grantKey: domains },
    list: 'Domains',
    classLevel: 1,
  };
  await expect(
    member.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: catalog('weapon-finesse'),
      selectionSource: domainSource,
      operationId: 'not-a-domain',
    }),
  ).rejects.toThrow('Choose a domain for this prompt');
  await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: catalog('domain-fire'),
    selectionSource: domainSource,
    operationId: 'fire',
  });
  const cleric = (await read()).calculated.spellcastings.find(
    (row) => row.classTag === 'cleric',
  );
  expect(cleric).toMatchObject({
    extraSlots: [{ kind: 'domain', label: '+1 domain' }],
    choices: [
      { list: 'Domains', count: 2, selected: [{ name: 'Fire Domain' }] },
    ],
  });
  expect(
    cleric?.grantedSpells.map((spell) => [spell.name, spell.domainSlotOnly]),
  ).toEqual([
    ['Burning Hands', true],
    ['Produce Flame', true],
  ]);
  expect(cleric?.slots.map((slot) => slot.extra)).toEqual([0, 1, 1]);

  const school = await grantKeyOf('wizard-arcane-school');
  const evocation = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: catalog('school-evocation'),
    selectionSource: {
      kind: 'prompt',
      source: { kind: 'grant', grantKey: school },
      list: 'Arcane schools',
      classLevel: 1,
    },
    operationId: 'evocation',
  });
  expect(
    (await read()).calculated.warnings.find(
      (warning) => warning.check === 'oppositionSchoolsMissing',
    ),
  ).toMatchObject({
    kind: 'incomplete',
    target: { kind: 'entry', entryId: evocation },
  });
  await expect(
    member.mutation(api.characterSheet.setOppositionSchools, {
      ...scope,
      target: { entryId: evocation },
      schools: ['trs', 'trs'],
      operationId: 'duplicate',
    }),
  ).rejects.toThrow('Choose each opposition school once');
  await expect(
    member.mutation(api.characterSheet.setOppositionSchools, {
      ...scope,
      target: { grantKey: domains },
      schools: ['trs', 'nec'],
      operationId: 'not-a-school',
    }),
  ).rejects.toThrow('Choose opposition schools on an arcane school');
  await member.mutation(api.characterSheet.setOppositionSchools, {
    ...scope,
    target: { entryId: evocation },
    schools: ['trs', 'nec'],
    operationId: 'opposition',
  });
  const haste = await t.run(async (ctx) => {
    const row = await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_ruleIdentity', (q) =>
        q
          .eq('characterId', scope.characterId)
          .eq('ruleIdentity', 'pf1/s9amdo5398alb5p0'),
      )
      .unique();
    if (!row) throw new Error('Missing prepared Haste');
    return row._id;
  });
  await owner.mutation(api.characterSheetSpells.record, {
    ...scope,
    castingClassId: catalog('wizard'),
    catalogEntryId: haste,
    operationId: 'record-haste',
  });
  const recorded = await read();
  const wizard = recorded.calculated.spellcastings.find(
    (row) => row.classTag === 'wizard',
  );
  expect(wizard).toMatchObject({
    extraSlots: [{ kind: 'school', label: '+1 school (evocation)' }],
    school: {
      entryId: evocation,
      school: 'evo',
      oppositionSchools: ['trs', 'nec'],
    },
  });
  expect(
    recorded.calculated.spellCollections.collections
      .find((row) => row.classTag === 'wizard')
      ?.spells.map((spell) => [spell.name, spell.twoSlots]),
  ).toEqual([['Haste', true]]);
  expect(
    recorded.calculated.warnings.filter((warning) =>
      warning.check.startsWith('oppositionSchools'),
    ),
  ).toEqual([]);
  // Losing the wizard level keeps the school's recorded opposition schools.
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: lastLevel(ids),
    classEntryId: catalog('fighter'),
    operationId: 'no-wizard',
  });
  const dormant = await read();
  expect(
    dormant.calculated.resolvedEntries.find(
      (row) => row.storedEntryId === evocation,
    ),
  ).toMatchObject({
    dormant: true,
    entry: { state: { oppositionSchools: ['trs', 'nec'] } },
  });
});

test('casting choices refuse outsiders and obey every legacy Write Gate state', async () => {
  const { t, owner, outsider, scope, catalog, levels, grantKeyOf } =
    await fixture();
  const ids = await levels([
    ...repeat('wizard', 3),
    ...repeat('cleric', 3),
    'mystic-theurge',
  ]);
  const school = await grantKeyOf('wizard-arcane-school');
  const evocation = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: catalog('school-evocation'),
    selectionSource: {
      kind: 'prompt',
      source: { kind: 'grant', grantKey: school },
      list: 'Arcane schools',
      classLevel: 1,
    },
    operationId: 'evocation',
  });
  const domains = await grantKeyOf('cleric-domains');
  const commands = (caller: typeof owner) => [
    caller.mutation(api.characterSheet.assignCastingAdvance, {
      ...scope,
      entryId: lastLevel(ids),
      index: 0,
      classEntryId: catalog('wizard'),
      operationId: 'gated-advance',
    }),
    caller.mutation(api.characterSheet.setOppositionSchools, {
      ...scope,
      target: { entryId: evocation },
      schools: ['enc', 'nec'],
      operationId: 'gated-opposition',
    }),
    caller.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: catalog('domain-sun'),
      selectionSource: {
        kind: 'prompt',
        source: { kind: 'grant', grantKey: domains },
        list: 'Domains',
        classLevel: 1,
      },
      operationId: 'gated-domain',
    }),
  ];
  for (const caller of [t, outsider])
    for (const pending of commands(caller))
      await expect(pending).rejects.toThrow();
  await expect(
    owner.mutation(api.characterSheet.assignCastingAdvance, {
      ...scope,
      organizationId: 'other',
      entryId: lastLevel(ids),
      index: 0,
      classEntryId: catalog('wizard'),
      operationId: 'other-organization',
    }),
  ).rejects.toThrow();
  const controlId = await t.run(async (ctx) => {
    const runId = await ctx.db.insert('initialMigrationRun', {
      operationId: 'migration',
      epoch: 1,
      state: 'maintenance',
      frontendBuild: 'build',
      catalogManifest: 'catalog',
      startedAt: 0,
      deadline: 60_000,
    });
    return ctx.db.insert('initialMigrationControl', {
      key: 'character-sheet',
      epoch: 1,
      closed: true,
      authority: 'legacy',
      runId,
    });
  });
  for (const pending of commands(owner))
    await expect(pending).rejects.toThrow('MAINTENANCE');
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { closed: false }),
  );
  for (const pending of commands(owner))
    await expect(pending).rejects.toThrow('RELOAD_REQUIRED');
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, {
      epoch: 0,
      authority: 'sheet',
    }),
  );
  for (const pending of commands(owner))
    await expect(pending).rejects.toThrow('RELOAD_REQUIRED');
});
