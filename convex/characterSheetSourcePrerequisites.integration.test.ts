// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { prepare, releaseFixture } from '../tests/catalog-release-fixture';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import {
  canonicalReleaseJson,
  parseReleaseJson,
} from '../src/lib/catalog/release-schema';
import { candidateDefinition } from './lib/catalogCandidateDefinition';
import { bodies, classKey, feats } from '../tests/source-prerequisites-proof';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');

// The feat Source-prerequisites family's public proof
// (`scripts/catalog/launch-source-prerequisites.ts`): a feat's released
// `prerequisites` and `prerequisiteText`, as the importer emits them, reach
// the saved sheet through a Catalog Release, the app's candidate conversion
// and public reads and writes, where each proven clause kind (ability, BAB,
// feat and skill ranks) is checked now and at its recorded level, and every
// check advises without blocking. A caster-level clause (#780) reads the
// sheet's highest caster level. The bodies are a synthetic fixture shaped as
// imported feats and an imported class.
const scores = {
  strength: 13,
  dexterity: 12,
  constitution: 10,
  intelligence: 12,
  wisdom: 10,
  charisma: 10,
};

/**
 * The bodies through a prepared Catalog Release and the app's candidate
 * conversion (as `characterSheetModifiers.integration.test.ts` installs
 * them), and a Character with `levels` Class Levels of the released class
 * and the scores above. The stored class starts as a half-BAB class without
 * class skills, so its full BAB and Ride come from the release. `className`
 * names a class of the sheet's catalog to take the levels in instead.
 */
async function fixture(levels: number, className?: string) {
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
    for (const { externalKey, name, detail } of bodies) {
      const identity = {
        scope: 'global' as const,
        name,
        ruleIdentity: externalKey,
        modifiers: [],
        sources: [],
        stacksWithItself: false,
      };
      ids[externalKey] =
        detail.kind === 'class'
          ? await ctx.db.insert('catalogEntry', {
              ...identity,
              detail: {
                kind: 'class',
                classKind: 'base',
                hitDie: 6,
                bab: 'half',
                saves: { fort: 'poor', ref: 'poor', will: 'good' },
                skillRanksPerLevel: 2,
                classSkills: [],
                featuresByLevel: [],
                picksByLevel: [],
              },
            })
          : await ctx.db.insert('catalogEntry', {
              ...identity,
              detail: { kind: 'feat' },
            });
    }
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
  const first = initial.entries.find((entry) => entry.kind === 'classLevel');
  if (!first) throw new Error('Missing first Class Level');
  const named = initial.catalogEntries.find(
    (entry) => entry.detail.kind === 'class' && entry.name === className,
  );
  if (className && !named) throw new Error(`Missing ${className}`);
  const levelClass = named?._id ?? id(classKey);
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: levelClass,
    operationId: 'level-1',
  });
  const levelIds: Id<'characterSheetEntry'>[] = [first._id];
  for (let level = 2; level <= levels; level += 1)
    levelIds.push(
      await member.mutation(api.characterSheet.addClassLevel, {
        ...scope,
        classEntryId: levelClass,
        operationId: `level-${level}`,
      }),
    );
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores,
    operationId: 'scores',
  });
  const select = (
    key: string,
    gainedAtClassLevel?: Id<'characterSheetEntry'>,
  ) =>
    member.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: id(key),
      ...(gainedAtClassLevel ? { gainedAtClassLevel } : {}),
      operationId: `select-${key}`,
    });
  const setScores = (change: Partial<typeof scores>, operationId: string) =>
    member.mutation(api.characterSheet.editBaseScores, {
      ...scope,
      scores: change,
      operationId,
    });
  return {
    owner,
    member,
    outsider,
    scope,
    id,
    read,
    levelClass,
    levelIds,
    select,
    setScores,
  };
}

type Sheet = Awaited<ReturnType<Awaited<ReturnType<typeof fixture>>['read']>>;

/** One Selection's clauses' results in one view, in clause order. */
function met(sheet: Sheet, entryId: string, view: 'current' | 'recorded') {
  return sheet.calculated.prerequisites
    .filter((row) => row.entryId === entryId && row.view === view)
    .sort((a, b) => a.clauseIndex - b.clauseIndex)
    .map((row) => row.met);
}
/** The prerequisite warnings' messages, sorted. */
function messages(sheet: Sheet) {
  return sheet.calculated.warnings
    .filter((warning) => warning.check.startsWith('prerequisites.'))
    .map((warning) => warning.message)
    .sort();
}

test('released prerequisites and their text reach the saved sheet unchanged', async () => {
  const { read, select, id } = await fixture(1);
  for (const key of Object.values(feats)) await select(key);
  const sheet = await read();
  for (const released of bodies.slice(1)) {
    const stored = sheet.catalogEntries.find(
      (row) => row.ruleIdentity === released.externalKey,
    );
    expect(stored?._id).toBe(id(released.externalKey));
    expect(stored?.prerequisites).toEqual(released.prerequisites);
    expect(stored?.prerequisiteText).toBe(released.prerequisiteText);
  }
  // The class body comes from the release: full BAB, Ride a class skill.
  const level = sheet.catalogEntries.find(
    (row) => row.ruleIdentity === classKey,
  );
  expect(level?.detail).toMatchObject({
    kind: 'class',
    bab: 'full',
    classSkills: ['skill.rid'],
  });
});

test('ability, BAB and skill-rank clauses are checked now, each minimum inclusive and each ability its own', async () => {
  const { member, scope, read, select, setScores, levelIds, id } =
    await fixture(3);
  const dex = await select(feats.dex);
  const bab = await select(feats.bab);
  const ride = await select(feats.ride);
  const abilities = await select(feats.abilities);
  let sheet = await read();
  // Dex 12, BAB +3 (three full-BAB levels), no Ride rank, Str 13, Int 12.
  expect(met(sheet, dex, 'current')).toEqual([false]);
  expect(met(sheet, bab, 'current')).toEqual([true, false, false]);
  expect(met(sheet, ride, 'current')).toEqual([false]);
  expect(met(sheet, abilities, 'current')).toEqual([true, false]);
  expect(messages(sheet)).toEqual(
    [
      'Proof Abilities: Intelligence 13 not met now.',
      'Proof Bab: BAB +4 not met now.',
      'Proof Bab: Dexterity 15 not met now.',
      'Proof Dex: Dexterity 13 not met now.',
      'Proof Ride: Ride 1 ranks not met now.',
    ].sort(),
  );
  // Each minimum is met at exactly its value.
  await setScores({ dexterity: 13 }, 'dex-13');
  sheet = await read();
  expect(met(sheet, dex, 'current')).toEqual([true]);
  expect(met(sheet, bab, 'current')).toEqual([true, false, false]);
  expect(messages(sheet)).not.toContain('Proof Dex: Dexterity 13 not met now.');
  await setScores({ dexterity: 15 }, 'dex-15');
  await member.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: id(classKey),
    operationId: 'level-4',
  });
  expect(met(await read(), bab, 'current')).toEqual([true, true, true]);
  const firstLevel = levelIds[0];
  if (!firstLevel) throw new Error('Missing first level');
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: firstLevel,
    skillRank: { skill: 'skill.rid', ranks: 1 },
    operationId: 'ride-rank',
  });
  expect(met(await read(), ride, 'current')).toEqual([true]);
  // Strength and Intelligence each read their own score.
  await setScores({ intelligence: 13 }, 'int-13');
  expect(met(await read(), abilities, 'current')).toEqual([true, true]);
  await setScores({ strength: 12 }, 'str-12');
  sheet = await read();
  expect(met(sheet, abilities, 'current')).toEqual([false, true]);
  expect(messages(sheet)).toEqual([
    'Proof Abilities: Strength 13 not met now.',
  ]);
});

test('a Wisdom clause reads Wisdom, and Intimidate and Spellcraft clauses each read their own ranks, summed over the Class Levels', async () => {
  const { member, scope, read, select, setScores, levelIds } = await fixture(3);
  const [first, second] = levelIds;
  if (!first || !second) throw new Error('Missing levels');
  const wisdom = await select(feats.wisdom);
  const skills = await select(feats.skills);
  let sheet = await read();
  // Wis 10, Cha 10, no Intimidate or Spellcraft rank.
  expect(met(sheet, wisdom, 'current')).toEqual([false]);
  expect(met(sheet, skills, 'current')).toEqual([false, false]);
  expect(messages(sheet)).toEqual(
    [
      'Proof Skills: Intimidate 1 ranks not met now.',
      'Proof Skills: Spellcraft 2 ranks not met now.',
      'Proof Wisdom: Wisdom 13 not met now.',
    ].sort(),
  );
  // Charisma 13 is no Wisdom; Wisdom 13 meets it at exactly its minimum.
  await setScores({ charisma: 13 }, 'cha-13');
  expect(met(await read(), wisdom, 'current')).toEqual([false]);
  await setScores({ wisdom: 13 }, 'wis-13');
  expect(met(await read(), wisdom, 'current')).toEqual([true]);
  // An Intimidate rank meets its clause only; Spellcraft needs two ranks,
  // one on each of two Class Levels.
  const rank = (entryId: Id<'characterSheetEntry'>, skill: string) =>
    member.mutation(api.characterSheet.editClassLevel, {
      ...scope,
      entryId,
      skillRank: { skill, ranks: 1 },
      operationId: `${skill}-${entryId}`,
    });
  await rank(first, 'skill.int');
  expect(met(await read(), skills, 'current')).toEqual([true, false]);
  await rank(first, 'skill.spl');
  expect(met(await read(), skills, 'current')).toEqual([true, false]);
  await rank(second, 'skill.spl');
  sheet = await read();
  expect(met(sheet, skills, 'current')).toEqual([true, true]);
  expect(messages(sheet)).toEqual([]);
});

test('the recorded-level check reads the recorded build: its Class Level and its order among the choices there', async () => {
  const { member, scope, read, select, setScores, levelIds } = await fixture(4);
  const [first, second, , fourth] = levelIds;
  if (!first || !second || !fourth) throw new Error('Missing levels');
  await setScores({ dexterity: 15 }, 'dex-15');
  const dex = await select(feats.dex, first);
  const bab = await select(feats.bab, second);
  let sheet = await read();
  // BAB +4 at four levels; +2 as recorded at level 2.
  expect(met(sheet, bab, 'current')).toEqual([true, true, true]);
  expect(met(sheet, bab, 'recorded')).toEqual([true, true, false]);
  expect(messages(sheet)).toEqual([
    'Proof Bab: BAB +4 not met at level 2 as recorded.',
  ]);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: bab,
    gainedAtClassLevel: fourth,
    operationId: 'bab-at-4',
  });
  sheet = await read();
  expect(met(sheet, bab, 'recorded')).toEqual([true, true, true]);
  expect(messages(sheet)).toEqual([]);
  // Proof Dex moved to level 4 comes after Proof Bab there, so Proof Bab
  // doesn't see it as recorded; moving it earlier does.
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: dex,
    gainedAtClassLevel: fourth,
    operationId: 'dex-at-4',
  });
  sheet = await read();
  expect(met(sheet, bab, 'current')).toEqual([true, true, true]);
  expect(met(sheet, bab, 'recorded')).toEqual([false, true, true]);
  expect(messages(sheet)).toEqual([
    'Proof Bab: Proof Dex not met at level 4 as recorded.',
  ]);
  await member.mutation(api.characterSheet.moveSelection, {
    ...scope,
    entryId: dex,
    direction: 'earlier',
    operationId: 'dex-earlier',
  });
  sheet = await read();
  expect(met(sheet, bab, 'recorded')).toEqual([true, true, true]);
  expect(messages(sheet)).toEqual([]);
});

test('a feat clause needs the feat only, and removing or switching off the named feat fails it', async () => {
  const { member, scope, read, select, setScores } = await fixture(4);
  await setScores({ dexterity: 15 }, 'dex-15');
  const dex = await select(feats.dex);
  const bab = await select(feats.bab);
  // Proof Dex's own Dex 13 fails; Proof Bab's clause naming it is still met.
  await setScores({ dexterity: 12 }, 'dex-12');
  let sheet = await read();
  expect(met(sheet, dex, 'current')).toEqual([false]);
  expect(met(sheet, bab, 'current')).toEqual([true, false, true]);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: dex,
    active: false,
    operationId: 'dex-off',
  });
  expect(met(await read(), bab, 'current')).toEqual([false, false, true]);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: dex,
    active: true,
    operationId: 'dex-on',
  });
  expect(met(await read(), bab, 'current')).toEqual([true, false, true]);
  await member.mutation(api.characterSheet.clearSelectionSlot, {
    ...scope,
    entryId: dex,
    operationId: 'dex-removed',
  });
  sheet = await read();
  expect(sheet.entries.some((row) => row._id === dex)).toBe(false);
  expect(met(sheet, bab, 'current')).toEqual([false, false, true]);
  // The removed feat's definition is no longer read, so the warning names
  // the clause by its kind; it is Proof Bab's first clause.
  expect(
    sheet.calculated.warnings.filter(
      (row) =>
        row.check === 'prerequisites.current' && row.subject === `${bab}:0`,
    ),
  ).toHaveLength(1);
});

test('the checks advise and never block: an accepted warning survives an unrelated edit and another member’s read, and reopens when its fact changes', async () => {
  const { owner, member, outsider, scope, read, select, setScores, id } =
    await fixture(1);
  // Selecting a feat whose prerequisites fail succeeds.
  const dex = await select(feats.dex);
  let sheet = await read();
  expect(sheet.entries.find((row) => row._id === dex)).toMatchObject({
    active: true,
  });
  const warning = sheet.calculated.warnings.find(
    (row) =>
      row.check === 'prerequisites.current' && row.subject === `${dex}:0`,
  );
  if (!warning) throw new Error('Missing the Dex warning');
  expect(warning).toMatchObject({
    kind: 'rules',
    message: 'Proof Dex: Dexterity 13 not met now.',
  });
  await member.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept-dex',
  });
  const accepted = (viewer = owner) =>
    read(viewer).then((current) =>
      current.acceptedWarnings.filter(
        (row) => row.check === warning.check && row.subject === warning.subject,
      ),
    );
  expect(await accepted()).toMatchObject([
    { fingerprint: warning.fingerprint },
  ]);
  // Charisma is no fact of the clause; the acceptance stays for everyone.
  await setScores({ charisma: 14 }, 'charisma');
  expect(await accepted(member)).toMatchObject([
    { fingerprint: warning.fingerprint },
  ]);
  expect(await accepted(owner)).toMatchObject([
    { fingerprint: warning.fingerprint },
  ]);
  // The accepted warning changes no result.
  sheet = await read();
  expect(met(sheet, dex, 'current')).toEqual([false]);
  // A lower Dexterity is a new fact: the warning reopens.
  await setScores({ dexterity: 11 }, 'dex-11');
  expect(await accepted()).toEqual([]);
  sheet = await read();
  expect(messages(sheet)).toEqual(['Proof Dex: Dexterity 13 not met now.']);
  // An outsider can neither read nor write the sheet.
  await expect(outsider.query(api.characterSheet.read, scope)).rejects.toThrow(
    'You do not have access to this org',
  );
  await expect(
    outsider.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: id(feats.ride),
      operationId: 'outsider-select',
    }),
  ).rejects.toThrow('You do not have access to this org');
});

test('a caster-level clause reads the highest caster level: met at its threshold, unmet below it, re-checked as the caster level changes, and only advisory', async () => {
  const { member, outsider, scope, read, select, levelClass, levelIds, id } =
    await fixture(2, 'Wizard');
  const [first, second] = levelIds;
  if (!first || !second) throw new Error('Missing levels');
  /** The sheet's highest caster level, as the clause reads it. */
  const casterLevel = (sheet: Sheet) =>
    Math.max(
      0,
      ...sheet.calculated.spellcastings.map(
        (casting) => casting.casterLevel?.total ?? 0,
      ),
    );
  // Selecting a feat whose caster level is unmet succeeds.
  const third = await select(feats.casterLevel, second);
  const firstLevel = await select(feats.firstCasterLevel, first);
  let sheet = await read();
  expect(casterLevel(sheet)).toBe(2);
  expect(sheet.entries.find((row) => row._id === third)).toMatchObject({
    active: true,
  });
  expect(met(sheet, third, 'current')).toEqual([false]);
  expect(met(sheet, firstLevel, 'current')).toEqual([true]);
  expect(met(sheet, firstLevel, 'recorded')).toEqual([true]);
  expect(messages(sheet)).toEqual([
    'Proof Caster Level: Caster level 3 not met at level 2 as recorded.',
    'Proof Caster Level: Caster level 3 not met now.',
  ]);
  // Accepting the warning changes no result.
  const warning = sheet.calculated.warnings.find(
    (row) =>
      row.check === 'prerequisites.current' && row.subject === `${third}:0`,
  );
  if (!warning) throw new Error('Missing the caster-level warning');
  await member.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept-caster-level',
  });
  const accepted = async () =>
    (await read()).acceptedWarnings.filter(
      (row) => row.check === warning.check && row.subject === warning.subject,
    );
  expect(await accepted()).toMatchObject([
    { fingerprint: warning.fingerprint },
  ]);
  expect(met(await read(), third, 'current')).toEqual([false]);
  // A third Wizard level is caster level 3: met now at exactly the
  // threshold, still unmet as recorded at level 2.
  await member.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: levelClass,
    operationId: 'level-3',
  });
  sheet = await read();
  expect(casterLevel(sheet)).toBe(3);
  expect(met(sheet, third, 'current')).toEqual([true]);
  expect(met(sheet, third, 'recorded')).toEqual([false]);
  expect(messages(sheet)).toEqual([
    'Proof Caster Level: Caster level 3 not met at level 2 as recorded.',
  ]);
  // Its second level as a class that casts nothing drops the caster level
  // to 2: the clause fails again, and the accepted warning reopens.
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: second,
    classEntryId: id(classKey),
    operationId: 'second-warrior',
  });
  sheet = await read();
  expect(casterLevel(sheet)).toBe(2);
  expect(met(sheet, third, 'current')).toEqual([false]);
  expect(met(sheet, firstLevel, 'current')).toEqual([true]);
  expect(await accepted()).toEqual([]);
  // A Character who casts nothing meets no caster level.
  const levels = (await read()).entries.filter(
    (row) => row.kind === 'classLevel' && row._id !== second,
  );
  for (const level of levels)
    await member.mutation(api.characterSheet.editClassLevel, {
      ...scope,
      entryId: level._id,
      classEntryId: id(classKey),
      operationId: `warrior-${level._id}`,
    });
  sheet = await read();
  expect(sheet.calculated.spellcastings).toEqual([]);
  expect(met(sheet, third, 'current')).toEqual([false]);
  expect(met(sheet, firstLevel, 'current')).toEqual([false]);
  // An outsider can neither read nor write the sheet.
  await expect(outsider.query(api.characterSheet.read, scope)).rejects.toThrow(
    'You do not have access to this org',
  );
  await expect(
    outsider.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: id(feats.casterLevel),
      operationId: 'outsider-select',
    }),
  ).rejects.toThrow('You do not have access to this org');
});
