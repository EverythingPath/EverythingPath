/// <reference types="vite/client" />
// @vitest-environment node
import { expect, test } from 'vitest';
import { resolve } from 'node:path';
import { importCatalog } from '../scripts/catalog/import';
import { collectReferences } from '../scripts/catalog/admission';
import { reviewedCuration } from '../scripts/catalog/reviewed-curation-data';
import { prepare, releaseFixture } from '../tests/catalog-release-fixture';
import { candidateDefinition } from './lib/catalogCandidateDefinition';
import {
  abilityKeys,
  calculateCharacterSheet,
} from '../src/lib/character-sheet';
import heritageCases from '../tests/fixtures/race-import-740/heritages.json';
import { materializePinnedTree } from '../tests/catalog/pinned-sources';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import {
  canonicalReleaseJson,
  parseReleaseJson,
} from '../src/lib/catalog/release-schema';

function getFixtureId({
  ids,
  key,
}: {
  ids: Record<string, Id<'catalogEntry'> | undefined>;
  key: string;
}): Id<'catalogEntry'> {
  const id = ids[key];
  if (!id) throw new Error(`Missing stored fixture identity: ${key}`);
  return id;
}

const modules = import.meta.glob('./**/*.ts');
const dwarf = 'pf1/nEltI9y37rKJTeWo';
const hardy = 'pf1-content/AO5nhhUfI1b4M37H';
const stubborn = 'pf1-content/eew9hWENxwAiLP8S';
const ability = `local/race-ability-scores/${dwarf}`;

test.each(heritageCases)(
  '$name crosses the public sheet with supported mapping or explicit unresolved fallback',
  async (source) => {
    const tree = await materializePinnedTree(
      [source.raceFile, source.path, ...source.folderFiles],
      { sha256: { [source.path]: source.sourceSha256 } },
    );
    try {
      const artifact = await importCatalog({
        ...tree,
        remaps: [],
        curation: reviewedCuration,
      });
      const { owner, member, outsider, scope, ids } =
        await installPublishedFixture({
          artifact,
          roots: [source.race, source.externalKey],
        });
      await owner.mutation(api.characterSheet.editBaseScores, {
        ...scope,
        scores: {
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
        },
        operationId: 'base',
      });
      await owner.mutation(api.characterSheet.selectRace, {
        ...scope,
        catalogEntryId: getFixtureId({ ids, key: source.race }),
        operationId: 'race',
      });
      const read = async () => {
        const sheet = withSheetCatalog(
          await owner.query(api.characterSheet.read, scope),
        );
        if (!sheet) throw new Error('Missing sheet');
        return sheet;
      };
      const base = await read();
      const select = (selected: boolean) =>
        member.mutation(api.characterSheet.setRacialTraitSelected, {
          ...scope,
          catalogEntryId: getFixtureId({ ids, key: source.externalKey }),
          selected,
          operationId: selected ? 'select' : 'remove',
        });
      await select(true);
      const selected = await read();
      expect(
        abilityKeys.map(
          (ability) => selected.calculated.abilities[ability].score,
        ),
      ).toEqual(
        source.mapping === 'withheld-source-conflict'
          ? [10, 10, 10, 8, 12, 10]
          : source.ordinaryScores,
      );
      if (source.mapping === 'withheld-source-conflict') {
        const definition = selected.catalogEntries.find(
          (entry) =>
            entry._id === getFixtureId({ ids, key: source.externalKey }),
        );
        expect(definition?.detail).toMatchObject({
          replaces: [],
          unresolvedReplacements: ['Base Statistics'],
        });
        expect(definition?.modifiers).toEqual([]);
        expect(selected.calculated.warnings).toContainEqual(
          expect.objectContaining({ check: 'racialReplacementUnresolved' }),
        );
        const row = selected.entries.find(
          (entry) =>
            entry.kind === 'racialTrait' &&
            entry.catalogEntryId ===
              getFixtureId({ ids, key: source.externalKey }),
        );
        if (!row) throw new Error('Missing selected heritage');
        expect(
          calculateCharacterSheet(
            { ...selected, characterKind: selected.character.kind },
            {
              situations: [
                { local: 'while shapechanged', sheetEntryId: row._id },
              ],
            },
          ).abilities,
        ).toEqual(base.calculated.abilities);
      } else if (source.shapechangedAbility) {
        const row = selected.entries.find(
          (entry) =>
            entry.kind === 'racialTrait' &&
            entry.catalogEntryId ===
              getFixtureId({ ids, key: source.externalKey }),
        );
        if (!row) throw new Error('Missing heritage');
        const changed = calculateCharacterSheet(
          { ...selected, characterKind: selected.character.kind },
          {
            situations: [
              { local: 'while shapechanged', sheetEntryId: row._id },
            ],
          },
        );
        expect(
          abilityKeys.map((ability) => changed.abilities[ability].score),
        ).toEqual(
          source.ordinaryScores.map(
            (score, index) =>
              score +
              (abilityKeys[index] === source.shapechangedAbility ? 2 : 0),
          ),
        );
      }
      await select(false);
      expect(
        (await read()).calculated.warnings.some(
          (warning) => warning.check === 'racialReplacementUnresolved',
        ),
      ).toBe(false);
      expect((await read()).calculated.abilities).toEqual(
        base.calculated.abilities,
      );
      await select(true);
      expect(
        (await read()).calculated.warnings.some(
          (warning) => warning.check === 'racialReplacementUnresolved',
        ),
      ).toBe(source.mapping === 'withheld-source-conflict');
      expect((await read()).calculated.abilities).toEqual(
        selected.calculated.abilities,
      );
      await expect(
        outsider.query(api.characterSheet.read, scope),
      ).rejects.toThrow();
    } finally {
      await tree.dispose();
    }
  },
);

test('Oversized Goblins carries complete adjustments and Medium size through the public sheet', async () => {
  const race = 'pf1/bOv30pyHB1gFbSTj',
    alternate = 'pf1-content/xPtJg4WPKxVRmVdM';
  const artifact = await importCatalog({
    systemPath: resolve('tests/fixtures/race-ability-721/pf1'),
    contentPath: resolve('tests/fixtures/race-ability-721/pf1-content'),
    remaps: [],
    curation: reviewedCuration,
  });
  const { owner, member, scope, ids } = await installPublishedFixture({
    artifact,
    roots: [race, alternate],
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    operationId: 'base',
  });
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: getFixtureId({ ids, key: race }),
    operationId: 'race',
  });
  const read = async () =>
    withSheetCatalog(await owner.query(api.characterSheet.read, scope));
  const base = await read();
  await member.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: getFixtureId({ ids, key: alternate }),
    selected: true,
    operationId: 'oversized',
  });
  const selected = await read();
  expect(selected?.calculated.racial.size).toBe('medium');
  expect(selected?.calculated.abilities.strength.score).toBe(12);
  expect(selected?.calculated.abilities.dexterity.score).toBe(12);
  expect(selected?.calculated.abilities.charisma.score).toBe(8);
  await member.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: getFixtureId({ ids, key: alternate }),
    selected: false,
    operationId: 'small',
  });
  expect((await read())?.calculated.racial.size).toBe('small');
  expect((await read())?.calculated.abilities).toEqual(
    base?.calculated.abilities,
  );
});

test('Svirfneblin Skilled owns underground Stealth through conversion and public replacement/restoration', async () => {
  const race = 'pf1/fX9F2amW2BcYoHwb',
    skilled = 'pf1-content/gwRHgXExczYgcJOA';
  const artifact = await importCatalog({
    systemPath: resolve('tests/fixtures/racial-traits-719/pf1'),
    contentPath: resolve('tests/fixtures/racial-traits-719/pf1-content'),
    remaps: [],
    curation: reviewedCuration,
  });
  const { owner, member, scope, ids } = await installPublishedFixture({
    artifact,
    roots: [race],
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    operationId: 'base',
  });
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: getFixtureId({ ids, key: race }),
    operationId: 'race',
  });
  const read = async () => {
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!sheet) throw new Error('Missing saved sheet');
    return sheet;
  };
  const initial = await read();
  const underground = initial.calculated.breakdowns[
    'skill.ste'
  ].conditional.find(
    (modifier) =>
      typeof modifier.condition?.situation === 'object' &&
      'local' in modifier.condition.situation &&
      modifier.condition.situation.local === 'underground',
  );
  const stonework = initial.calculated.breakdowns['skill.per'].conditional.find(
    (modifier) =>
      typeof modifier.condition?.situation === 'object' &&
      'local' in modifier.condition.situation,
  );
  if (
    !underground ||
    !stonework ||
    typeof underground.condition?.situation !== 'object' ||
    !('local' in underground.condition.situation) ||
    typeof stonework.condition?.situation !== 'object' ||
    !('local' in stonework.condition.situation)
  )
    throw new Error('Missing actual Situations');
  const situations = [
    {
      ...underground.condition.situation,
      sheetEntryId: underground.sheetEntryId,
    },
    { ...stonework.condition.situation, sheetEntryId: stonework.sheetEntryId },
  ];
  expect(initial.calculated.breakdowns['skill.ste'].total).toBe(7);
  const selected = calculateCharacterSheet(
    { ...initial, characterKind: initial.character.kind },
    { situations },
  );
  expect(selected.breakdowns['skill.ste'].total).toBe(9);
  expect(selected.breakdowns['skill.per'].total).toBe(5);
  const entryId = await member.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    definition: {
      name: 'Table replacement for Skilled',
      sources: [],
      stacksWithItself: false,
      modifiers: [],
      detail: {
        kind: 'racialTrait',
        raceEntryIds: [getFixtureId({ ids, key: race })],
        replaces: [getFixtureId({ ids, key: skilled })],
      },
    },
    operationId: 'replacement',
  });
  const replaced = await read();
  expect(
    calculateCharacterSheet(
      { ...replaced, characterKind: replaced.character.kind },
      { situations },
    ).breakdowns['skill.ste'].total,
  ).toBe(5);
  expect(
    calculateCharacterSheet(
      { ...replaced, characterKind: replaced.character.kind },
      { situations },
    ).breakdowns['skill.per'].total,
  ).toBe(3);
  for (const [target, total] of [
    ['fortitude', 2],
    ['reflex', 3],
    ['will', 3],
  ] as const) {
    expect(initial.calculated.derivedStatistics[target].total).toBe(total);
    expect(replaced.calculated.derivedStatistics[target].total).toBe(total);
  }
  const replacement = replaced.entries.find((entry) => entry._id === entryId);
  if (replacement?.kind !== 'racialTrait')
    throw new Error('Missing tabletop replacement');
  await member.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: replacement.catalogEntryId,
    selected: false,
    operationId: 'restore',
  });
  const restored = await read();
  expect(
    calculateCharacterSheet(
      { ...restored, characterKind: restored.character.kind },
      { situations },
    ).breakdowns['skill.ste'].total,
  ).toBe(9);
});

test('Dual Talent saves two shared independent choices, warns about duplicates and restores dormant choices', async () => {
  const human = 'pf1/e6IaBxKgMxy1yKlr';
  const dual = 'pf1-content/SRBfqkzIldwETAHB';
  const artifact = await importCatalog({
    systemPath: resolve('tests/fixtures/racial-traits-719/pf1'),
    contentPath: resolve('tests/fixtures/racial-traits-719/pf1-content'),
    remaps: [],
    curation: reviewedCuration,
  });
  const { owner, member, outsider, scope, ids } = await installPublishedFixture(
    { artifact, roots: [human, dual] },
  );
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    operationId: 'base',
  });
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: getFixtureId({ ids, key: human }),
    operationId: 'human',
  });
  await member.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: getFixtureId({ ids, key: dual }),
    selected: true,
    operationId: 'dual',
  });
  const read = async () => {
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!sheet) throw new Error('Missing sheet');
    return sheet;
  };
  const selected = await read();
  const row = selected.entries.find(
    (entry) =>
      entry.kind === 'racialTrait' &&
      entry.catalogEntryId === getFixtureId({ ids, key: dual }),
  );
  if (!row) throw new Error('Missing Dual Talent Selection');
  const target = { entryId: row._id };
  await member.mutation(api.characterSheet.chooseRacialAbilityScore, {
    ...scope,
    target,
    ability: 'strength',
    operationId: 'first',
  });
  expect(
    (await read()).calculated.warnings.some(
      (warning) => warning.check === 'racialAbilityScoreChoice',
    ),
  ).toBe(true);
  await owner.mutation(api.characterSheet.chooseRacialAbilityScore, {
    ...scope,
    target,
    choiceIndex: 1,
    ability: 'dexterity',
    operationId: 'second',
  });
  const chosen = await read();
  expect(chosen.calculated.abilities.strength.score).toBe(12);
  expect(chosen.calculated.abilities.dexterity.score).toBe(12);
  expect(chosen.calculated.racial.bonusSkillRanksPerLevel).toBe(0);
  expect(
    chosen.entries.find((entry) => entry._id === row._id)?.state,
  ).toMatchObject({ choice: 'strength', secondChoice: 'dexterity' });
  await member.mutation(api.characterSheet.chooseRacialAbilityScore, {
    ...scope,
    target,
    choiceIndex: 1,
    ability: 'strength',
    operationId: 'duplicate',
  });
  const duplicate = await read();
  expect(duplicate.calculated.abilities.strength.score).toBe(12);
  expect(
    duplicate.calculated.warnings.some(
      (warning) => warning.check === 'racialAbilityScoreDistinct',
    ),
  ).toBe(true);
  await member.mutation(api.characterSheet.chooseRacialAbilityScore, {
    ...scope,
    target,
    choiceIndex: 1,
    ability: 'dexterity',
    operationId: 'different',
  });
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: null,
    operationId: 'away',
  });
  expect((await read()).calculated.abilities.strength.score).toBe(10);
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: getFixtureId({ ids, key: human }),
    operationId: 'back',
  });
  expect((await read()).calculated.abilities).toEqual(
    chosen.calculated.abilities,
  );
  await expect(
    outsider.mutation(api.characterSheet.chooseRacialAbilityScore, {
      ...scope,
      target,
      choiceIndex: 1,
      ability: 'wisdom',
      operationId: 'outsider',
    }),
  ).rejects.toThrow();
  await member.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: getFixtureId({ ids, key: dual }),
    selected: false,
    operationId: 'ordinary',
  });
  expect((await read()).calculated.abilities.strength.score).toBe(10);
  await member.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: getFixtureId({ ids, key: dual }),
    selected: true,
    operationId: 'restore-choice',
  });
  expect((await read()).calculated.abilities).toEqual(
    chosen.calculated.abilities,
  );
});

test.each(['legacy omission', 'explicit empty', 'resolved current'] as const)(
  'conversion preserves the manual replacement warning only for %s',
  async (mode) => {
    const artifact = await importCatalog({
      systemPath: resolve('tests/fixtures/racial-traits-719/pf1'),
      contentPath: resolve('tests/fixtures/racial-traits-719/pf1-content'),
      remaps: [],
      curation: reviewedCuration,
    });
    const body = artifact.catalog.entries.find(
      (entry) => entry.externalKey === stubborn,
    );
    if (body?.detail.kind !== 'racialTrait')
      throw new Error('Missing Stubborn');
    if (mode === 'legacy omission') {
      delete body.detail.unresolvedReplacements;
      delete body.detail.replaces;
    } else if (mode === 'explicit empty') {
      body.detail.unresolvedReplacements = [];
    }
    const { t, owner, scope, ids } = await installPublishedFixture({
      artifact,
      roots: [dwarf, stubborn],
    });
    await t.run(async (ctx) => {
      const id = getFixtureId({ ids, key: stubborn });
      const definition = await ctx.db.get('catalogEntry', id);
      if (definition?.detail.kind !== 'racialTrait')
        throw new Error('Missing stored Stubborn');
      await ctx.db.patch('catalogEntry', id, {
        detail: { ...definition.detail, unresolvedReplacements: ['Hardy'] },
      });
      const stored = await ctx.db.get('catalogEntry', id);
      const release = await ctx.db
        .query('catalogRelease')
        .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 1))
        .unique();
      if (!stored || !release) throw new Error('Missing release fixture');
      const { _id, _creationTime, ...candidate } = await candidateDefinition(
        ctx,
        release,
        stored,
      );
      if (candidate.detail.kind !== 'racialTrait')
        throw new Error('Wrong candidate kind');
      expect(candidate.detail.unresolvedReplacements).toEqual(
        mode === 'legacy omission'
          ? ['Hardy']
          : mode === 'explicit empty'
            ? []
            : undefined,
      );
      await ctx.db.replace('catalogEntry', _id, candidate);
    });
    await owner.mutation(api.characterSheet.selectRace, {
      ...scope,
      catalogEntryId: getFixtureId({ ids, key: dwarf }),
      operationId: 'race',
    });
    await owner.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: getFixtureId({ ids, key: stubborn }),
      selected: true,
      operationId: 'alternate',
    });
    const saved = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(
      saved?.calculated.warnings.some(
        (warning) => warning.check === 'racialReplacementUnresolved',
      ),
    ).toBe(mode === 'legacy omission');
    const definition = saved?.catalogEntries.find(
      (entry) => entry._id === getFixtureId({ ids, key: stubborn }),
    );
    expect(
      definition?.detail?.kind === 'racialTrait' &&
        Boolean(definition.detail.unresolvedReplacements?.length),
    ).toBe(mode === 'legacy omission');
  },
);

async function installPublishedFixture({
  artifact,
  roots,
}: {
  artifact: Awaited<ReturnType<typeof importCatalog>>;
  roots: string[];
}) {
  const byKey = new Map(
    artifact.catalog.entries.map((entry) => [entry.externalKey, entry]),
  );
  const needed = new Set(roots);
  for (const key of needed) {
    const entry = byKey.get(key);
    if (!entry) throw new Error(`Missing pinned body: ${key}`);
    for (const reference of collectReferences(entry)) needed.add(reference);
  }
  const bodies = [...needed].map((key) => {
    const entry = byKey.get(key);
    if (!entry) throw new Error(`Incomplete pinned closure: ${key}`);
    return entry;
  });
  const { t, owner, outsider, scope } = await releaseFixture(modules);
  await t.run((ctx) =>
    ctx.db.insert('user', {
      tokenIdentifier: 'test|member',
      orgIds: [{ orgId: 'org', role: 'member' }],
    }),
  );
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const ids = await t.run(async (ctx) => {
    const ids = new Map<string, Id<'catalogEntry'>>();
    for (const body of bodies) {
      const detail =
        body.detail.kind === 'race'
          ? { kind: 'race' as const, racialHitDice: 0, racialTraits: [] }
          : { kind: 'racialTrait' as const, raceEntryIds: [], replaces: [] };
      ids.set(
        body.externalKey,
        await ctx.db.insert('catalogEntry', {
          scope: 'global',
          name: body.name,
          ruleIdentity: body.externalKey,
          modifiers: [],
          sources: [],
          stacksWithItself: false,
          detail,
        }),
      );
    }
    return Object.fromEntries(ids);
  });
  await prepare(
    t,
    bodies.map((body) => ({
      kind: 'definition',
      key: body.externalKey,
      payload: parseReleaseJson(JSON.parse(canonicalReleaseJson(body))),
    })),
  );
  await t.run(async (ctx) => {
    const release = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 1))
      .unique();
    if (!release) throw new Error('Missing release');
    for (const body of bodies) {
      const id = getFixtureId({ ids, key: body.externalKey });
      const stored = await ctx.db.get('catalogEntry', id);
      if (!stored) throw new Error('Missing stored identity');
      const candidate = await candidateDefinition(ctx, release, stored);
      const { _id, _creationTime, ...definition } = candidate;
      await ctx.db.replace('catalogEntry', _id, definition);
    }
  });
  return { t, owner, outsider, member, scope, ids };
}

// Real pinned bodies in an isolated legal fixture exercise conversion and the
// saved-sheet API. They do not admit this held content or establish its notices.
test('remapped published Dwarf grants and Stubborn replacements survive release conversion and saved-sheet reselection', async () => {
  const retained = 'pf1-content/retainedHardy0740';
  const artifact = await importCatalog({
    systemPath: resolve('tests/fixtures/racial-traits-719/pf1'),
    contentPath: resolve('tests/fixtures/racial-traits-719/pf1-content'),
    curation: reviewedCuration,
    remaps: [
      {
        from: hardy,
        to: retained,
        kind: 'racialTrait',
        reason: 'Retain the identity of the pinned Hardy record after a move.',
        evidence: 'Pinned Hardy (Dwarf), CRB p. 21; identity transport test.',
        reviewedBy: 'test',
        reviewedOn: '2026-10-25',
      },
    ],
  });
  const { t, owner, outsider, member, scope, ids } =
    await installPublishedFixture({ artifact, roots: [dwarf, stubborn] });
  expect(ids[ability]).toBeDefined();
  expect(ids[retained]).toBeDefined();
  expect(ids[hardy]).toBeUndefined();
  await t.run(async (ctx) => {
    const race = await ctx.db.get(
      'catalogEntry',
      getFixtureId({ ids, key: dwarf }),
    );
    const alternate = await ctx.db.get(
      'catalogEntry',
      getFixtureId({ ids, key: stubborn }),
    );
    expect(race?.detail).toMatchObject({
      racialTraits: expect.arrayContaining([
        getFixtureId({ ids, key: ability }),
        getFixtureId({ ids, key: retained }),
      ]),
    });
    expect(alternate?.detail).toMatchObject({
      raceEntryIds: [getFixtureId({ ids, key: dwarf })],
      replaces: [getFixtureId({ ids, key: retained })],
    });
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    operationId: 'base',
  });
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: getFixtureId({ ids, key: dwarf }),
    operationId: 'select',
  });
  const read = async () => {
    const saved = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!saved) throw new Error('Missing sheet');
    return saved;
  };
  const base = await read();
  expect(base.calculated.abilities.constitution.score).toBe(12);
  expect(base.calculated.abilities.wisdom.score).toBe(12);
  expect(base.calculated.abilities.charisma.score).toBe(8);
  expect(
    base.calculated.breakdowns['ability.con'].applied.filter(
      (row) => row.bonusType === 'racial',
    ),
  ).toHaveLength(1);
  await member.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: getFixtureId({ ids, key: stubborn }),
    selected: true,
    operationId: 'stubborn',
  });
  const selected = await read();
  expect(
    selected.calculated.resolvedEntries.find(
      (row) =>
        row.entry.kind === 'racialTrait' &&
        row.entry.catalogEntryId === getFixtureId({ ids, key: retained }),
    )?.counting,
  ).toBe(false);
  expect(
    selected.calculated.resolvedEntries.find(
      (row) =>
        row.entry.kind === 'racialTrait' &&
        row.entry.catalogEntryId === getFixtureId({ ids, key: ability }),
    )?.counting,
  ).toBe(true);
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: null,
    operationId: 'remove',
  });
  expect((await read()).calculated.abilities.constitution.score).toBe(10);
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: getFixtureId({ ids, key: dwarf }),
    operationId: 'restore',
  });
  expect((await read()).calculated.abilities).toEqual(
    selected.calculated.abilities,
  );
  await owner.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: getFixtureId({ ids, key: stubborn }),
    selected: false,
    operationId: 'restore-hardy',
  });
  expect(
    (await read()).calculated.resolvedEntries.find(
      (row) =>
        row.entry.kind === 'racialTrait' &&
        row.entry.catalogEntryId === getFixtureId({ ids, key: retained }),
    )?.counting,
  ).toBe(true);
  await expect(
    outsider.query(api.characterSheet.read, scope),
  ).rejects.toThrow();
  await expect(
    outsider.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: getFixtureId({ ids, key: stubborn }),
      selected: true,
      operationId: 'outsider',
    }),
  ).rejects.toThrow();
  // Independently player-creatable homebrew proves retained choice state at
  // the public boundary without inventing published racial mechanics.
  const homebrewEntry = await member.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    definition: {
      name: 'Table-authored Dwarf adjustment',
      sources: [],
      stacksWithItself: false,
      modifiers: [{ target: 'ability.$choice', bonusType: 'racial', value: 2 }],
      detail: {
        kind: 'racialTrait',
        raceEntryIds: [getFixtureId({ ids, key: dwarf })],
        replaces: [getFixtureId({ ids, key: ability })],
      },
    },
    operationId: 'homebrew',
  });
  await member.mutation(api.characterSheet.chooseRacialAbilityScore, {
    ...scope,
    target: { entryId: homebrewEntry },
    ability: 'intelligence',
    operationId: 'homebrew-choice',
  });
  expect((await read()).calculated.abilities.intelligence.score).toBe(12);
  expect((await read()).calculated.abilities.constitution.score).toBe(10);
  await member.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: null,
    operationId: 'homebrew-dormant',
  });
  expect((await read()).calculated.abilities.intelligence.score).toBe(10);
  await member.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: getFixtureId({ ids, key: dwarf }),
    operationId: 'homebrew-restored',
  });
  const restored = await read();
  expect(restored.calculated.abilities.intelligence.score).toBe(12);
  expect(
    restored.entries.find((row) => row._id === homebrewEntry),
  ).toMatchObject({ state: { choice: 'intelligence' } });
  // Missing references and kind mismatches refuse the candidate; conversion
  // must never silently drop a Grant to make a bounded selection usable.
  for (const failure of ['missing', 'wrong kind'] as const) {
    await expect(
      t.run(async (ctx) => {
        const abilityId = getFixtureId({ ids, key: ability });
        if (failure === 'missing')
          await ctx.db.delete('catalogEntry', abilityId);
        else
          await ctx.db.patch('catalogEntry', abilityId, {
            detail: { kind: 'manual' },
          });
        const release = await ctx.db
          .query('catalogRelease')
          .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 1))
          .unique();
        const race = await ctx.db.get(
          'catalogEntry',
          getFixtureId({ ids, key: dwarf }),
        );
        if (!release || !race) throw new Error('Missing fixture');
        await candidateDefinition(ctx, release, race);
      }),
    ).rejects.toThrow(
      failure === 'missing' ? 'unavailable' : 'is not a racialTrait',
    );
  }
});

// The pinned Atavism page citation and Ferocity link remain held. This is an
// isolated conversion proof of the explicitly published race equivalence.
test('published Orc Atavism keeps Orc, removes Human and restores the saved ability choices through the public sheet', async () => {
  const halfOrc = 'pf1/dCAXgdA6Db1Z3ccz';
  const atavism = 'pf1-content/SJOcTJ2MQI3AoMeh';
  const ordinaryAbility = 'pf1-content/VHmuEYXmx81Q5EmC';
  const artifact = await importCatalog({
    systemPath: resolve('tests/fixtures/race-ability-721/pf1'),
    contentPath: resolve('tests/fixtures/race-ability-721/pf1-content'),
    remaps: [],
    curation: reviewedCuration,
  });
  const { owner, scope, ids } = await installPublishedFixture({
    artifact,
    roots: [halfOrc, atavism],
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    operationId: 'base',
  });
  const read = async () => {
    const saved = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!saved) throw new Error('Missing saved sheet');
    return saved;
  };
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: getFixtureId({ ids, key: halfOrc }),
    operationId: 'half-orc',
  });
  await owner.mutation(api.characterSheet.chooseRacialAbilityScore, {
    ...scope,
    target: { grantKey: { source: halfOrc, entry: ordinaryAbility } },
    ability: 'constitution',
    operationId: 'ordinary-choice',
  });
  expect((await read()).calculated.abilities.constitution.score).toBe(12);
  await owner.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: getFixtureId({ ids, key: atavism }),
    selected: true,
    operationId: 'atavism',
  });
  const selected = await read();
  const row = selected.entries.find(
    (entry) =>
      entry.kind === 'racialTrait' &&
      entry.catalogEntryId === getFixtureId({ ids, key: atavism }),
  );
  if (!row) throw new Error('Missing selected Atavism');
  await owner.mutation(api.characterSheet.chooseRacialAbilityScore, {
    ...scope,
    target: { entryId: row._id },
    ability: 'wisdom',
    operationId: 'atavism-choice',
  });
  const chosen = await read();
  expect(chosen.calculated.racial.countsAsRaces).toEqual(
    [halfOrc, 'pf1/JOuAdPAOTat7d5v6'].sort(),
  );
  expect(chosen.calculated.abilities.strength.score).toBe(12);
  expect(chosen.calculated.abilities.constitution.score).toBe(10);
  expect(chosen.calculated.abilities.wisdom.score).toBe(8);
  expect(
    chosen.calculated.breakdowns['ability.str'].applied.filter(
      (modifier) => modifier.bonusType === 'racial',
    ),
  ).toHaveLength(1);
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: null,
    operationId: 'remove',
  });
  expect((await read()).calculated.abilities.wisdom.score).toBe(10);
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: getFixtureId({ ids, key: halfOrc }),
    operationId: 'return',
  });
  expect((await read()).calculated.abilities).toEqual(
    chosen.calculated.abilities,
  );
  await owner.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: getFixtureId({ ids, key: atavism }),
    selected: false,
    operationId: 'ordinary-again',
  });
  const ordinary = await read();
  expect(ordinary.calculated.abilities.constitution.score).toBe(12);
  expect(ordinary.calculated.racial.countsAsRaces).toContain(
    'pf1/e6IaBxKgMxy1yKlr',
  );
});
