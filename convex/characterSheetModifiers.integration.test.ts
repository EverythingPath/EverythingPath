// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { prepare, releaseFixture } from '../tests/catalog-release-fixture';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import {
  canonicalReleaseJson,
  parseReleaseJson,
} from '../src/lib/catalog/release-schema';
import { candidateDefinition } from './lib/catalogCandidateDefinition';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');

// The plain-Modifiers mechanism family's public proof
// (`scripts/catalog/launch-mechanism-proofs.ts`): each proven (source target,
// formula shape) pair, as the importer emits it, reaches its saved-sheet
// total through a Catalog Release, the app's candidate conversion and public
// reads and writes. The bodies are a synthetic fixture shaped as imported
// feats and Racial Traits: one race whose standard traits carry the racial
// pairs, and five feats with the untyped ones.
const race = 'pf1/modifierProofRace';
const skillFocus = 'pf1/modifierProofSkillFocus';
const traits = {
  // `skill.per 2`, racial (Keen Senses).
  perception: 'pf1-content/modifierProofPerception',
  // `skill.int 2`, racial (Intimidating).
  intimidate: 'pf1-content/modifierProofIntimidate',
  // `skill.acr 2` and `skill.clm 2`, racial (Sure-Footed).
  footing: 'pf1-content/modifierProofFooting',
  // `allSavingThrows 1`, racial (Halfling Luck).
  luck: 'pf1-content/modifierProofLuck',
  // `bonusFeats 1`: an open bonus feat slot (Bonus Feat (Human)).
  bonusFeat: 'pf1-content/modifierProofBonusFeat',
  // `bonusFeats 1`: a bonus feat slot for listed feats only (Adaptability).
  listedFeat: 'pf1-content/modifierProofListedFeat',
  // `bonusSkillRanks @attributes.hd.total`: one rank per level (Skilled).
  ranks: 'pf1-content/modifierProofRanks',
} as const;
const feats = {
  // `will 2`, untyped (Iron Will).
  will: 'pf1/modifierProofWill',
  // `fort 2`, untyped (Great Fortitude).
  fortitude: 'pf1/modifierProofFortitude',
  // `ref 2`, untyped (Lightning Reflexes).
  reflex: 'pf1/modifierProofReflex',
  // `init 4`, untyped (Improved Initiative).
  initiative: 'pf1/modifierProofInitiative',
  // `skill.int @abilities.str.mod`, untyped (Intimidating Prowess, after its
  // reviewed replacement: no floor at 0).
  strength: 'pf1/modifierProofStrength',
} as const;

type Body = {
  externalKey: string;
  name: string;
  detail: Record<string, unknown>;
  modifiers?: {
    target: string;
    bonusType: string;
    value: number | { formula: string };
  }[];
  grantsSlots?: { kind: 'feat'; count: number; feats?: string[] }[];
};
function body({
  externalKey,
  name,
  detail,
  modifiers = [],
  grantsSlots,
}: Body) {
  return {
    externalKey,
    upstreamKey: externalKey,
    pack: detail.kind === 'feat' ? 'feats' : 'races',
    name,
    detail,
    description: `${name}.`,
    sources: [{ book: 'PZO1110', pages: '1' }],
    modifiers,
    ...(grantsSlots ? { grantsSlots } : {}),
    unsupported: [],
  };
}
const racialTrait = (
  externalKey: string,
  name: string,
  change: Omit<Body, 'externalKey' | 'name' | 'detail'> & {
    bonusSkillRanksPerLevel?: number;
  },
) =>
  body({
    externalKey,
    name,
    detail: {
      kind: 'racialTrait',
      bonusSkillRanksPerLevel: change.bonusSkillRanksPerLevel ?? 0,
      raceKeys: [race],
      standard: true,
      replaces: [],
    },
    modifiers: change.modifiers,
    grantsSlots: change.grantsSlots,
  });
const racial = (target: string, value: number) => ({
  target,
  bonusType: 'racial',
  value,
});
const feat = (
  externalKey: string,
  name: string,
  modifiers: Body['modifiers'] = [],
) =>
  body({
    externalKey,
    name,
    detail: { kind: 'feat', featTypes: ['General'], repeatable: 'no' },
    modifiers,
  });
const untyped = (target: string, value: number | { formula: string }) => ({
  target,
  bonusType: 'untyped',
  value,
});
const bodies = [
  body({
    externalKey: race,
    name: 'Modifier Proof Race',
    detail: {
      kind: 'race',
      racialHitDice: 0,
      creatureTypes: ['humanoid'],
      creatureSubtypes: [],
      racialTraits: Object.values(traits),
      size: 'medium',
    },
  }),
  racialTrait(traits.perception, 'Proof Senses', {
    modifiers: [racial('skill.per', 2)],
  }),
  racialTrait(traits.intimidate, 'Proof Menace', {
    modifiers: [racial('skill.int', 2)],
  }),
  racialTrait(traits.footing, 'Proof Footing', {
    modifiers: [racial('skill.acr', 2), racial('skill.clm', 2)],
  }),
  racialTrait(traits.luck, 'Proof Luck', { modifiers: [racial('saves', 1)] }),
  racialTrait(traits.bonusFeat, 'Proof Bonus Feat', {
    grantsSlots: [{ kind: 'feat', count: 1 }],
  }),
  racialTrait(traits.listedFeat, 'Proof Listed Feat', {
    grantsSlots: [{ kind: 'feat', count: 1, feats: [skillFocus] }],
  }),
  racialTrait(traits.ranks, 'Proof Ranks', { bonusSkillRanksPerLevel: 1 }),
  feat(feats.will, 'Proof Will', [untyped('save.will', 2)]),
  feat(feats.fortitude, 'Proof Fortitude', [untyped('save.fort', 2)]),
  feat(feats.reflex, 'Proof Reflex', [untyped('save.ref', 2)]),
  feat(feats.initiative, 'Proof Initiative', [untyped('init', 4)]),
  feat(feats.strength, 'Proof Strength', [
    untyped('skill.int', { formula: '@ability.str.mod' }),
  ]),
  feat(skillFocus, 'Proof Skill Focus'),
];

/**
 * The bodies through a prepared Catalog Release and the app's candidate
 * conversion (as `raceImport740.integration.test.ts` installs them), and a
 * Cleric 7 (no class bonus feats) with Strength 14 and every other score 10.
 */
async function fixture() {
  const { t, owner, outsider, scope } = await releaseFixture(modules);
  await t.run((ctx) =>
    ctx.db.insert('user', {
      tokenIdentifier: 'test|member',
      orgIds: [{ orgId: 'org', role: 'member' }],
    }),
  );
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const ids: Record<string, Id<'catalogEntry'>> = await t.run(async (ctx) => {
    const ids: Record<string, Id<'catalogEntry'>> = {};
    for (const { externalKey, name, detail } of bodies)
      ids[externalKey] = await ctx.db.insert('catalogEntry', {
        scope: 'global',
        name,
        ruleIdentity: externalKey,
        modifiers: [],
        sources: [],
        stacksWithItself: false,
        detail:
          detail.kind === 'race'
            ? { kind: 'race', racialHitDice: 0, racialTraits: [] }
            : detail.kind === 'feat'
              ? { kind: 'feat' }
              : { kind: 'racialTrait', raceEntryIds: [], replaces: [] },
      });
    return ids;
  });
  await prepare(
    t,
    bodies.map((entry) => ({
      kind: 'definition',
      key: entry.externalKey,
      payload: parseReleaseJson(JSON.parse(canonicalReleaseJson(entry))),
    })),
  );
  await t.run(async (ctx) => {
    const release = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 1))
      .unique();
    if (!release) throw new Error('Missing release');
    for (const id of Object.values(ids)) {
      const stored = await ctx.db.get('catalogEntry', id);
      if (!stored) throw new Error('Missing stored identity');
      const { _id, _creationTime, ...definition } = await candidateDefinition(
        ctx,
        release,
        stored,
      );
      await ctx.db.replace('catalogEntry', _id, definition);
    }
  });
  const id = (key: string) => {
    const found = ids[key];
    if (!found) throw new Error(`Missing ${key}`);
    return found;
  };
  const read = async (viewer = owner) => {
    const sheet = withSheetCatalog(
      await viewer.query(api.characterSheet.read, scope),
    );
    if (!sheet) throw new Error('Missing saved sheet');
    return sheet;
  };
  const initial = await read();
  const level = initial.entries.find((entry) => entry.kind === 'classLevel');
  const cleric = initial.catalogEntries.find(
    (entry) => entry.detail.kind === 'class' && entry.name === 'Cleric',
  );
  if (!level || !cleric) throw new Error('Missing Cleric baseline');
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: cleric._id,
    operationId: 'cleric-1',
  });
  for (let index = 2; index <= 7; index += 1)
    await member.mutation(api.characterSheet.addClassLevel, {
      ...scope,
      classEntryId: cleric._id,
      operationId: `cleric-${index}`,
    });
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: {
      strength: 14,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    operationId: 'scores',
  });
  return { owner, member, outsider, scope, id, read };
}

type Sheet = Awaited<ReturnType<Awaited<ReturnType<typeof fixture>>['read']>>;

/** The totals the family's pairs reach, from one public read. */
function totals({ calculated }: Sheet) {
  const { breakdowns, derivedStatistics: statistics } = calculated;
  return {
    'skill.per': breakdowns['skill.per'].total,
    'skill.int': breakdowns['skill.int'].total,
    'skill.acr': breakdowns['skill.acr'].total,
    'skill.clm': breakdowns['skill.clm'].total,
    fortitude: statistics.fortitude.total,
    reflex: statistics.reflex.total,
    will: statistics.will.total,
    initiative: statistics.initiative.total,
    bonusFeats: calculated.selectionRules.budgets.bonusFeats,
    skillRanks: calculated.classLevels.map((row) => row.skillRankBudget),
  };
}

/** The applied contributions a definition makes to a breakdown. */
function applied(
  breakdown: { applied: readonly { source?: string; value: number }[] },
  key: string,
) {
  return breakdown.applied
    .filter((row) => row.source === key)
    .map((row) => row.value);
}

test('each plain Modifier pair reaches its saved-sheet total: skills, saves, initiative, bonus feats, bonus skill ranks and a Strength-modifier formula', async () => {
  const { owner, member, outsider, scope, id, read } = await fixture();
  const base = totals(await read());
  // A Cleric 7 with Strength 14: no class bonus feats, 2 ranks per level.
  expect(base).toMatchObject({
    bonusFeats: 0,
    skillRanks: [2, 2, 2, 2, 2, 2, 2],
  });

  // The race's standard traits: each racial pair adds once, the two slots
  // are bonus feats, and Skilled adds one rank at each level.
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: id(race),
    operationId: 'race',
  });
  const raced = await read();
  expect(totals(raced)).toEqual({
    ...base,
    'skill.per': base['skill.per'] + 2,
    'skill.int': base['skill.int'] + 2,
    'skill.acr': base['skill.acr'] + 2,
    'skill.clm': base['skill.clm'] + 2,
    fortitude: base.fortitude + 1,
    reflex: base.reflex + 1,
    will: base.will + 1,
    bonusFeats: 2,
    skillRanks: [3, 3, 3, 3, 3, 3, 3],
  });
  const { breakdowns, derivedStatistics } = raced.calculated;
  expect(applied(breakdowns['skill.per'], traits.perception)).toEqual([2]);
  expect(applied(breakdowns['skill.int'], traits.intimidate)).toEqual([2]);
  expect(applied(breakdowns['skill.acr'], traits.footing)).toEqual([2]);
  expect(applied(breakdowns['skill.clm'], traits.footing)).toEqual([2]);
  for (const save of ['fortitude', 'reflex', 'will'] as const)
    expect(applied(derivedStatistics[save], traits.luck)).toEqual([1]);

  // The open slot takes any feat; the listed slot takes only its feat.
  const slots = raced.calculated.selectionRules.slots.filter(
    (slot) => slot.kind === 'feat' && slot.grantedBy,
  );
  expect(slots.map((slot) => slot.label)).toEqual([
    'Proof Bonus Feat',
    'Proof Listed Feat',
  ]);
  const open = slots.find((slot) => !slot.feats?.length);
  const listed = slots.find((slot) => slot.feats?.length);
  if (!open || !listed) throw new Error('Missing bonus feat slots');
  expect(listed.feats).toEqual([id(skillFocus)]);
  expect([open.count, listed.count]).toEqual([1, 1]);

  // A Cleric 7 has four general feat slots; the open bonus slot holds the fifth.
  const choose = (slotId: string, position: number, key: string) =>
    member.mutation(api.characterSheet.fillSelectionSlot, {
      ...scope,
      slotId,
      position,
      catalogEntryId: id(key),
      operationId: `choose-${key}`,
    });
  const general = [feats.will, feats.fortitude, feats.reflex, feats.initiative];
  for (const [position, key] of general.entries())
    await choose('feat:general', position, key);
  await choose(open.id, 0, feats.strength);
  const listedId = await choose(listed.id, 0, skillFocus);
  const featured = await read();
  expect(totals(featured)).toEqual({
    ...totals(raced),
    'skill.int': base['skill.int'] + 2 + 2,
    fortitude: base.fortitude + 1 + 2,
    reflex: base.reflex + 1 + 2,
    will: base.will + 1 + 2,
    initiative: base.initiative + 4,
  });
  const statistics = featured.calculated.derivedStatistics;
  expect(applied(statistics.will, feats.will)).toEqual([2]);
  expect(applied(statistics.fortitude, feats.fortitude)).toEqual([2]);
  expect(applied(statistics.reflex, feats.reflex)).toEqual([2]);
  expect(applied(statistics.initiative, feats.initiative)).toEqual([4]);
  expect(
    applied(featured.calculated.breakdowns['skill.int'], feats.strength),
  ).toEqual([2]);
  const slotWarnings = (sheet: Sheet) =>
    sheet.calculated.warnings.filter(
      (warning) =>
        warning.check === 'featSlotType' || warning.check === 'featSlotBudget',
    );
  expect(slotWarnings(featured)).toEqual([]);
  // Another feat in the listed slot does not match it.
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: listedId,
    catalogEntryId: id(feats.will),
    operationId: 'unlisted',
  });
  expect(slotWarnings(await read())).toContainEqual(
    expect.objectContaining({ check: 'featSlotType' }),
  );
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: listedId,
    catalogEntryId: id(skillFocus),
    operationId: 'listed',
  });

  // The formula reads the current Strength modifier, a penalty included.
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 8 },
    operationId: 'weaker',
  });
  const weaker = await read();
  expect(
    applied(weaker.calculated.breakdowns['skill.int'], feats.strength),
  ).toEqual([-1]);
  expect(totals(weaker)['skill.int']).toBe(base['skill.int'] + 2 - 1);

  // Without the race, its traits' contributions go and the general feats'
  // stay.
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: null,
    operationId: 'no-race',
  });
  expect(totals(await read(member))).toMatchObject({
    'skill.per': base['skill.per'],
    'skill.acr': base['skill.acr'],
    fortitude: base.fortitude + 2,
    reflex: base.reflex + 2,
    will: base.will + 2,
    bonusFeats: 0,
    skillRanks: base.skillRanks,
  });
  await expect(outsider.query(api.characterSheet.read, scope)).rejects.toThrow(
    'You do not have access to this org',
  );
});
