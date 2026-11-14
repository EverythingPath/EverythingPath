// The class-feature level-grant family's public proof's bodies (#775,
// `convex/characterSheetFeatureGrants.integration.test.ts`), shaped as
// imported: a class listing a parent at 2nd level and two increments at 6th
// and 10th (each with the parent and part the importer gives it,
// `incrementEntries`), a second class listing none of them, and two
// Archetypes, one replacing the parent whole and one replacing the 6th-level
// part; and a class listing a second parent at 1st with an increment at every
// later level to 20th, beside another class listing that parent at 1st as
// well. Each class is read at every class level from 1st to `readThrough`.
// The registry entry of `class-feature-level-grants` binds these bytes, and
// `tests/catalog/launch-feature-grants.test.ts` ties the family's listed rows
// to the class levels, listings and replacements these bodies carry.
export const classKey = 'pf1/featureGrantsProofClass';
export const otherClassKey = 'pf1/featureGrantsProofOtherClass';
export const parentKey = 'pf1/featureGrantsProofParent';
export const sixthKey = 'everythingpath/feature-grants-proof-parent-6';
export const tenthKey = 'everythingpath/feature-grants-proof-parent-10';
export const wholeKey = 'pf1/featureGrantsProofWhole';
export const partKey = 'pf1/featureGrantsProofPart';
export const levelOf = {
  [parentKey]: 2,
  [sixthKey]: 6,
  [tenthKey]: 10,
} as const;
export const featureKeys = [parentKey, sixthKey, tenthKey] as const;

export const everyLevelClassKey = 'pf1/featureGrantsProofEveryLevelClass';
export const sharedClassKey = 'pf1/featureGrantsProofSharedClass';
export const everyLevelParentKey = 'pf1/featureGrantsProofEveryLevel';
/** The every-level parent's rows: its acquisition at 1st, then an increment at each later level. */
export const everyLevelRows = Array.from({ length: 20 }, (_, index) => ({
  classLevel: index + 1,
  key:
    index === 0
      ? everyLevelParentKey
      : `everythingpath/feature-grants-proof-every-level-${index + 1}`,
}));

/** The last class level the proof reads each listing class at. */
export const readThrough: Readonly<Record<string, number>> = {
  [classKey]: 12,
  [otherClassKey]: 12,
  [everyLevelClassKey]: 20,
  [sharedClassKey]: 1,
};

type Body = {
  externalKey: string;
  name: string;
  pack: string;
  detail: Record<string, unknown>;
};
function body({ externalKey, name, pack, detail }: Body) {
  return {
    externalKey,
    upstreamKey: externalKey,
    pack,
    name,
    detail,
    description: `<p>${name} body.</p>`,
    sources: [{ book: 'PZO1110', pages: '9' }],
    modifiers: [],
    unsupported: [],
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
const increment = (
  externalKey: string,
  name: string,
  { parent, classLevel }: { parent: string; classLevel: number },
) =>
  body({
    externalKey,
    name,
    pack: 'everythingpath-schedules',
    detail: {
      kind: 'classFeature',
      parentFeature: parent,
      part: `${classLevel}:${parent}`,
    },
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
      classKeys: [classKey],
      replaces: [replaces],
      adds: [],
    },
  });
const parentFeature = (externalKey: string, name: string) =>
  body({
    externalKey,
    name,
    pack: 'class-abilities',
    detail: { kind: 'classFeature' },
  });

export const bodies = [
  parentFeature(parentKey, 'Proof Feature'),
  increment(sixthKey, 'Proof Feature 2', { parent: parentKey, classLevel: 6 }),
  increment(tenthKey, 'Proof Feature 3', {
    parent: parentKey,
    classLevel: 10,
  }),
  classBody(
    classKey,
    'Proof Class',
    featureKeys.map((key) => ({ classLevel: levelOf[key], key })),
  ),
  classBody(otherClassKey, 'Other Proof Class', []),
  archetype(wholeKey, 'Proof Whole Archetype', {
    classLevel: 2,
    externalKey: parentKey,
    scope: 'whole',
  }),
  archetype(partKey, 'Proof Part Archetype', {
    classLevel: 6,
    externalKey: sixthKey,
    scope: 'part',
  }),
  parentFeature(everyLevelParentKey, 'Every Level Proof Feature'),
  ...everyLevelRows.slice(1).map(({ classLevel, key }) =>
    increment(key, `Every Level Proof Feature ${classLevel}`, {
      parent: everyLevelParentKey,
      classLevel,
    }),
  ),
  classBody(everyLevelClassKey, 'Every Level Proof Class', everyLevelRows),
  classBody(sharedClassKey, 'Shared Proof Class', everyLevelRows.slice(0, 1)),
];
