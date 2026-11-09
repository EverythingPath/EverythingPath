// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { releaseFixture } from '../tests/catalog-release-fixture';
import {
  installReleasedBodies,
  readSavedSheet,
} from '../tests/released-catalog-entries';
import {
  evaluateFormula,
  parseFormula,
} from '../src/lib/character-sheet-formulas';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');

// The class-level slots family's public proof (#783,
// `scripts/catalog/launch-class-level-slots.ts`, `class-level-slots`; and the
// level grants of its parents, `class-feature-level-grants`): a released
// class's `featuresByLevel` grants a bonus feat parent and its schedule
// increments, each carrying the one reviewed feat slot the importer gives it
// (`class-schedules.ts` `withSlot`), and the sheet's bonus feat slots then
// equal the parent's Foundry `bonusFeats` formula on `@class.level`, which
// imports as nothing. The bodies are synthetic and shaped as imported, one
// class per real parent's shape, with its Foundry formula and printed feat
// types (pf1 418761d2 packs/class-abilities; scripts/catalog/pcgen/
// schedule-slots.ts): Fighter Bonus Feats (1st, then every even level,
// Combat), Bonus Feat (CAV) (6th and every six, Combat), Bonus Feats (MAG)
// (5th and every six, Combat, Item Creation or Metamagic) and Teamwork Feat
// (3rd and every three, Teamwork), each with two increments; a class listing
// none of them; and two Archetypes of the Fighter shape, one replacing the
// parent whole and one replacing the 2nd-level part. Every read and write the
// test makes is public.
type ShapeName = 'fighter' | 'cavalier' | 'magus' | 'inquisitor';
const shapes: Record<
  ShapeName,
  {
    formula: string;
    featTypes: string[];
    levels: readonly [number, number, number];
  }
> = {
  fighter: {
    formula: '1 + floor(@class.level / 2)',
    featTypes: ['Combat'],
    levels: [1, 2, 4],
  },
  cavalier: {
    formula: 'floor(@class.level / 6)',
    featTypes: ['Combat'],
    levels: [6, 12, 18],
  },
  magus: {
    formula: 'floor((@class.level + 1) / 6)',
    featTypes: ['Combat', 'Item Creation', 'Metamagic'],
    levels: [5, 11, 17],
  },
  inquisitor: {
    formula: 'floor(@class.level / 3)',
    featTypes: ['Teamwork'],
    levels: [3, 6, 9],
  },
};
const shapeNames = Object.keys(shapes) as ShapeName[];
const classKeyOf = (shape: ShapeName) => `pf1/classLevelSlotsProof${shape}`;
const parentKeyOf = (shape: ShapeName) =>
  `pf1/classLevelSlotsProof${shape}BonusFeats`;
/** The shape's rows: the acquisition, then each increment, by class level. */
const rowsOf = (shape: ShapeName) =>
  shapes[shape].levels.map((classLevel, index) => ({
    classLevel,
    key:
      index === 0
        ? parentKeyOf(shape)
        : `everythingpath/class-level-slots-proof-${shape}-${classLevel}`,
  }));
const otherClassKey = 'pf1/classLevelSlotsProofOtherClass';
const wholeKey = 'pf1/classLevelSlotsProofWhole';
const partKey = 'pf1/classLevelSlotsProofPart';
const feats = {
  powerAttack: ['Combat'],
  cleave: ['Combat'],
  dodge: ['Combat'],
  craftWand: ['Item Creation'],
  extendSpell: ['Metamagic'],
  preciseStrike: ['Teamwork'],
  alertness: ['General'],
} as const;
type FeatName = keyof typeof feats;
const featKey = (feat: FeatName) => `pf1/classLevelSlotsProofFeat${feat}`;

/** The Foundry formula's value at a class level, as the app's grammar reads it. */
const formulaAt = (shape: ShapeName, classLevel: number) =>
  evaluateFormula(parseFormula(shapes[shape].formula), (name) => {
    if (name !== '@class.level') throw new Error(`Unexpected ${name}`);
    return classLevel;
  });

type Body = {
  externalKey: string;
  name: string;
  pack: string;
  detail: Record<string, unknown>;
  grantsSlots?: unknown[];
};
function body({ externalKey, name, pack, detail, grantsSlots }: Body) {
  return {
    externalKey,
    upstreamKey: externalKey,
    pack,
    name,
    detail,
    description: `<p>${name} body.</p>`,
    sources: [{ book: 'PZO1115', pages: '9' }],
    modifiers: [],
    unsupported: [],
    ...(grantsSlots ? { grantsSlots } : {}),
  };
}
const classBody = (
  externalKey: string,
  name: string,
  features: readonly { classLevel: number; key: string }[],
) =>
  body({
    externalKey,
    name,
    pack: 'classes',
    detail: {
      kind: 'class',
      hitDie: 10,
      bab: 'full',
      saves: { fort: 'good', ref: 'poor', will: 'poor' },
      classSkills: [],
      tag: name.toLowerCase().replaceAll(' ', ''),
      classKind: 'base',
      skillRanksPerLevel: 2,
      featuresByLevel: features.map(({ classLevel, key }) => ({
        classLevel,
        externalKey: key,
      })),
      picksByLevel: [],
    },
  });
const featureBodies = shapeNames.flatMap((shape) => {
  const parent = parentKeyOf(shape);
  const grantsSlots = [
    { kind: 'feat', count: 1, featTypes: [...shapes[shape].featTypes] },
  ];
  return rowsOf(shape).map(({ classLevel, key }, index) =>
    index === 0
      ? body({
          externalKey: key,
          name: `Proof ${shape} Bonus Feats`,
          pack: 'class-abilities',
          detail: { kind: 'classFeature' },
          grantsSlots,
        })
      : body({
          externalKey: key,
          name: `Proof ${shape} Bonus Feats ${index + 1}`,
          pack: 'everythingpath-schedules',
          detail: {
            kind: 'classFeature',
            parentFeature: parent,
            part: `${classLevel}:${parent}`,
          },
          grantsSlots,
        }),
  );
});
const archetype = (
  externalKey: string,
  name: string,
  replaces: { classLevel: number; externalKey: string; scope: string },
) =>
  body({
    externalKey,
    name,
    pack: 'archetypes',
    detail: {
      kind: 'archetype',
      classKeys: [classKeyOf('fighter')],
      replaces: [replaces],
      adds: [],
    },
  });
const [fighterParent, fighterSecond, fighterFourth] = rowsOf('fighter') as [
  { classLevel: number; key: string },
  { classLevel: number; key: string },
  { classLevel: number; key: string },
];
const bodies = [
  ...featureBodies,
  ...shapeNames.map((shape) =>
    classBody(classKeyOf(shape), `Proof ${shape}`, rowsOf(shape)),
  ),
  classBody(otherClassKey, 'Other Proof Class', []),
  archetype(wholeKey, 'Proof Whole Archetype', {
    classLevel: 1,
    externalKey: fighterParent.key,
    scope: 'whole',
  }),
  archetype(partKey, 'Proof Part Archetype', {
    classLevel: 2,
    externalKey: fighterSecond.key,
    scope: 'part',
  }),
  ...(Object.keys(feats) as FeatName[]).map((feat) =>
    body({
      externalKey: featKey(feat),
      name: `Proof ${feat}`,
      pack: 'feats',
      detail: { kind: 'feat', featTypes: [...feats[feat]], repeatable: 'no' },
    }),
  ),
];

const classStub = {
  kind: 'class' as const,
  classKind: 'base' as const,
  hitDie: 6,
  bab: 'half' as const,
  saves: {
    fort: 'poor' as const,
    ref: 'poor' as const,
    will: 'good' as const,
  },
  skillRanksPerLevel: 2,
  classSkills: [],
  featuresByLevel: [],
  picksByLevel: [],
};

type Viewer = Awaited<ReturnType<typeof releaseFixture>>['owner'];
type Sheet = Awaited<ReturnType<typeof readSavedSheet>>;

/** The bodies as a prepared Catalog Release's candidates, and Characters of them. */
async function fixture() {
  const { t, owner, outsider, scope, create } = await releaseFixture(modules);
  await t.run((ctx) =>
    ctx.db.insert('user', {
      tokenIdentifier: 'test|member',
      orgIds: [{ orgId: 'org', role: 'member' }],
    }),
  );
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const ids = new Map<string, Id<'catalogEntry'>>();
  const id = (key: string) => {
    const found = ids.get(key);
    if (!found) throw new Error(`Missing ${key}`);
    return found;
  };
  await t.run(async (ctx) => {
    const identity = (externalKey: string, name: string) => ({
      scope: 'global' as const,
      name,
      ruleIdentity: externalKey,
      modifiers: [],
      sources: [],
      stacksWithItself: false,
    });
    // The classes before the Archetypes, which name the Fighter shape.
    for (const { externalKey, name, detail } of bodies) {
      if (detail.kind === 'archetype') continue;
      const stored = identity(externalKey, name);
      ids.set(
        externalKey,
        detail.kind === 'class'
          ? await ctx.db.insert('catalogEntry', {
              ...stored,
              detail: classStub,
            })
          : detail.kind === 'feat'
            ? await ctx.db.insert('catalogEntry', {
                ...stored,
                detail: { kind: 'feat' },
              })
            : await ctx.db.insert('catalogEntry', {
                ...stored,
                detail: { kind: 'classFeature' },
              }),
      );
    }
    for (const { externalKey, name } of bodies.filter(
      ({ detail }) => detail.kind === 'archetype',
    ))
      ids.set(
        externalKey,
        await ctx.db.insert('catalogEntry', {
          ...identity(externalKey, name),
          detail: {
            kind: 'archetype',
            classEntryIds: [id(classKeyOf('fighter'))],
            replaces: [],
            adds: [],
          },
        }),
      );
  });
  await installReleasedBodies(t, bodies, id);

  let characters = 0;
  /**
   * A Character whose first Class Level is of this class, with an
   * `addLevel` for more of a class (this one by default).
   */
  async function character(classKey: string) {
    characters += 1;
    const characterId =
      characters === 1
        ? scope.characterId
        : await create(`Slots ${characters}`);
    const own = { organizationId: 'org', characterId };
    const read = (viewer: Viewer = member) => readSavedSheet(viewer, own);
    const first = (await read(owner)).entries.find(
      (entry) => entry.kind === 'classLevel',
    );
    if (!first) throw new Error('Missing first Class Level');
    await member.mutation(api.characterSheet.editClassLevel, {
      ...own,
      entryId: first._id,
      classEntryId: id(classKey),
      operationId: 'first-level',
    });
    let count = 1;
    const addLevel = (levelClassKey = classKey) =>
      member.mutation(api.characterSheet.addClassLevel, {
        ...own,
        classEntryId: id(levelClassKey),
        operationId: `level-${(count += 1)}`,
      });
    /** Selects a feat into the slot of the shape's row at this class level. */
    const selectInto = (feat: FeatName, shape: ShapeName, classLevel: number) =>
      member.mutation(api.characterSheet.selectEntry, {
        ...own,
        catalogEntryId: id(featKey(feat)),
        selectionSource: {
          kind: 'slot',
          grantedBy: { kind: 'grant', grantKey: grantKey(shape, classLevel) },
        },
        operationId: `select-${feat}-${classLevel}`,
      });
    return { scope: own, read, addLevel, selectInto };
  }
  return { owner, member, outsider, id, character };
}

/** The Grant Key of the shape's row at this class level. */
function grantKey(shape: ShapeName, classLevel: number) {
  const found = rowsOf(shape).find((row) => row.classLevel === classLevel);
  if (!found) throw new Error(`No ${shape} row at ${classLevel}`);
  return { source: classKeyOf(shape), classLevel, entry: found.key };
}

/** The sheet's bonus feat budget and its Grant slots, by row in class-level order. */
function bonusSlots({ calculated }: Sheet) {
  return {
    bonusFeats: calculated.selectionRules.budgets.bonusFeats,
    slots: calculated.selectionRules.slots
      .flatMap((slot) =>
        slot.grantedBy?.kind === 'grant'
          ? [
              {
                entry: slot.grantedBy.grantKey.entry,
                classLevel: slot.grantedBy.grantKey.classLevel,
                count: slot.count,
                featTypes: slot.featTypes,
              },
            ]
          : [],
      )
      .sort((left, right) => (left.classLevel ?? 0) - (right.classLevel ?? 0)),
  };
}
/** The slots the shape's rows grant at a class level. */
const expectedSlots = (shape: ShapeName, classLevel: number) =>
  rowsOf(shape)
    .filter((row) => row.classLevel <= classLevel)
    .map((row) => ({
      entry: row.key,
      classLevel: row.classLevel,
      count: 1,
      featTypes: shapes[shape].featTypes,
    }));
/** The feat-slot type warnings of a sheet, by Selection. */
const typeWarnings = ({ calculated }: Sheet) =>
  calculated.warnings
    .filter(({ check }) => check === 'featSlotType')
    .map(({ subject }) => subject);

test('each shape’s bonus feat slots equal its Foundry formula at every class level tested, and only through the listing class', async () => {
  const { character, owner, outsider } = await fixture();
  for (const shape of shapeNames) {
    const sheet = await character(classKeyOf(shape));
    const last = shapes[shape].levels[2];
    for (let level = 1; level <= last; level += 1) {
      if (level > 1) await sheet.addLevel();
      const read = bonusSlots(await sheet.read());
      expect(read.bonusFeats, `${shape} ${level}`).toBe(
        formulaAt(shape, level),
      );
      expect(read.slots, `${shape} ${level}`).toEqual(
        expectedSlots(shape, level),
      );
    }
    // Another member's read and the owner's agree.
    expect(bonusSlots(await sheet.read(owner))).toEqual(
      bonusSlots(await sheet.read()),
    );
  }
  // A class that doesn't list them grants none.
  const other = await character(otherClassKey);
  for (let level = 2; level <= 6; level += 1) await other.addLevel();
  expect(bonusSlots(await other.read())).toEqual({ bonusFeats: 0, slots: [] });
  // Levels of another class don't count: a Fighter 2 / other 2 has the
  // Fighter's slots at its 2nd class level, not at character level 4.
  const multiclass = await character(classKeyOf('fighter'));
  await multiclass.addLevel();
  await multiclass.addLevel(otherClassKey);
  await multiclass.addLevel(otherClassKey);
  expect(bonusSlots(await multiclass.read())).toEqual({
    bonusFeats: formulaAt('fighter', 2),
    slots: expectedSlots('fighter', 2),
  });
  expect(formulaAt('fighter', 2)).not.toBe(formulaAt('fighter', 4));
  await expect(
    outsider.query(api.characterSheet.read, multiclass.scope),
  ).rejects.toThrow('You do not have access to this org');
});

test('a feat selected into a slot survives reload and another member’s read; a feat of another type warns and is kept; the three-type slot takes each type', async () => {
  const { character, owner, outsider, id } = await fixture();
  const fighter = await character(classKeyOf('fighter'));
  for (let level = 2; level <= 4; level += 1) await fighter.addLevel();
  const selected = {
    powerAttack: await fighter.selectInto('powerAttack', 'fighter', 1),
    cleave: await fighter.selectInto('cleave', 'fighter', 2),
    alertness: await fighter.selectInto('alertness', 'fighter', 4),
  };
  for (const viewer of [undefined, owner]) {
    const sheet = await fighter.read(viewer);
    for (const [feat, classLevel] of [
      ['powerAttack', 1],
      ['cleave', 2],
      ['alertness', 4],
    ] as const)
      expect(
        sheet.entries.find((entry) => entry._id === selected[feat]),
        feat,
      ).toMatchObject({
        catalogEntryId: id(featKey(feat)),
        selectionSource: {
          kind: 'slot',
          grantedBy: {
            kind: 'grant',
            grantKey: grantKey('fighter', classLevel),
          },
        },
      });
    // Only the General feat warns, and it is kept and counts.
    expect(typeWarnings(sheet)).toEqual([selected.alertness]);
    expect(
      sheet.calculated.resolvedEntries.find(
        (row) => row.storedEntryId === selected.alertness,
      ),
    ).toMatchObject({ counting: true });
    expect(
      sheet.calculated.selectionRules.slots
        .filter((slot) => slot.grantedBy?.kind === 'grant')
        .map(({ used, remaining }) => ({ used, remaining })),
    ).toEqual([
      { used: 1, remaining: 0 },
      { used: 1, remaining: 0 },
      { used: 1, remaining: 0 },
    ]);
  }

  // The Magus shape's slot takes a Combat, an Item Creation and a Metamagic
  // feat; a Teamwork feat warns.
  const magus = await character(classKeyOf('magus'));
  for (let level = 2; level <= 17; level += 1) await magus.addLevel();
  await magus.selectInto('dodge', 'magus', 5);
  await magus.selectInto('craftWand', 'magus', 11);
  await magus.selectInto('extendSpell', 'magus', 17);
  expect(typeWarnings(await magus.read())).toEqual([]);
  const teamworkMagus = await character(classKeyOf('magus'));
  for (let level = 2; level <= 5; level += 1) await teamworkMagus.addLevel();
  const preciseStrike = await teamworkMagus.selectInto(
    'preciseStrike',
    'magus',
    5,
  );
  expect(typeWarnings(await teamworkMagus.read(owner))).toEqual([
    preciseStrike,
  ]);
  await expect(
    outsider.mutation(api.characterSheet.selectEntry, {
      ...fighter.scope,
      catalogEntryId: id(featKey('dodge')),
      selectionSource: {
        kind: 'slot',
        grantedBy: { kind: 'grant', grantKey: grantKey('fighter', 4) },
      },
      operationId: 'outsider-select',
    }),
  ).rejects.toThrow('You do not have access to this org');
});

test('deleting a level makes its slot’s Grant dormant with the Selection’s slot kept, and regaining it restores both', async () => {
  const { character, member, owner } = await fixture();
  const fighter = await character(classKeyOf('fighter'));
  for (let level = 2; level <= 4; level += 1) await fighter.addLevel();
  const cleave = await fighter.selectInto('cleave', 'fighter', 4);
  // A note on the 4th-level Grant keeps its row listed while it is dormant.
  await member.mutation(api.characterSheet.editGrantState, {
    ...fighter.scope,
    grantKey: grantKey('fighter', 4),
    state: { notes: 'Table note' },
    operationId: 'grant-note',
  });
  const slot = {
    kind: 'slot',
    grantedBy: { kind: 'grant', grantKey: grantKey('fighter', 4) },
  };
  const rowOf = (sheet: Sheet, key: string) =>
    sheet.calculated.resolvedEntries.find(
      (row) =>
        row.origin === 'grant' &&
        'grantKey' in row.entry &&
        row.entry.grantKey?.entry === key,
    );
  const levels = (await fighter.read()).entries.filter(
    (entry) => entry.kind === 'classLevel',
  );
  const fourth = levels[3];
  if (!fourth) throw new Error('Missing fourth Class Level');
  await member.mutation(api.characterSheet.deleteClassLevel, {
    ...fighter.scope,
    entryId: fourth._id,
    operationId: 'delete-level',
  });
  const dormant = await fighter.read(owner);
  expect(rowOf(dormant, fighterFourth.key)).toMatchObject({
    dormant: true,
    counting: false,
    reason: { kind: 'sourceMissing' },
    entry: { notes: 'Table note' },
  });
  expect(bonusSlots(dormant)).toEqual({
    bonusFeats: formulaAt('fighter', 3),
    slots: expectedSlots('fighter', 3),
  });
  expect(dormant.entries.find((entry) => entry._id === cleave)).toMatchObject({
    selectionSource: slot,
  });
  expect(
    dormant.calculated.resolvedEntries.find(
      (row) => row.storedEntryId === cleave,
    ),
  ).toMatchObject({ dormant: true, counting: false });

  await fighter.addLevel();
  const restored = await fighter.read();
  expect(rowOf(restored, fighterFourth.key)).toMatchObject({
    dormant: false,
    counting: true,
    entry: { notes: 'Table note' },
  });
  expect(bonusSlots(restored)).toEqual({
    bonusFeats: formulaAt('fighter', 4),
    slots: expectedSlots('fighter', 4),
  });
  expect(
    restored.calculated.resolvedEntries.find(
      (row) => row.storedEntryId === cleave,
    ),
  ).toMatchObject({ counting: true, entry: { selectionSource: slot } });
  expect(typeWarnings(restored)).toEqual([]);
});

test('an Archetype replacing the parent whole removes every slot; a part replacement removes only that level’s', async () => {
  const { character, member, id } = await fixture();
  const fighter = await character(classKeyOf('fighter'));
  for (let level = 2; level <= 4; level += 1) await fighter.addLevel();
  const select = (key: string, selected: boolean) =>
    member.mutation(api.characterSheet.setArchetypeSelected, {
      ...fighter.scope,
      classEntryId: id(classKeyOf('fighter')),
      catalogEntryId: id(key),
      selected,
      operationId: `${key}-${String(selected)}`,
    });
  await select(wholeKey, true);
  expect(bonusSlots(await fighter.read())).toEqual({
    bonusFeats: 0,
    slots: [],
  });
  await select(wholeKey, false);
  expect(bonusSlots(await fighter.read())).toEqual({
    bonusFeats: formulaAt('fighter', 4),
    slots: expectedSlots('fighter', 4),
  });
  await select(partKey, true);
  expect(bonusSlots(await fighter.read())).toEqual({
    bonusFeats: formulaAt('fighter', 4) - 1,
    slots: expectedSlots('fighter', 4).filter(
      ({ entry }) => entry !== fighterSecond.key,
    ),
  });
});
