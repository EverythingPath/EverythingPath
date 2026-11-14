// The rank-modifiers family's public proof's fixture
// (`convex/characterSheetRankModifiers.integration.test.ts`, #777): feat
// bodies shaped as imported, each carrying #724's reviewed rank-threshold
// output. The family's registry entry (`launch-mechanism-proofs.ts`) binds
// these bytes, and `tests/catalog/launch-rank-modifiers.test.ts` ties the
// family's pairs to the skills and thresholds the fixture releases.
export const listedSkills = [
  'acr',
  'blf',
  'clm',
  'crf',
  'dev',
  'dip',
  'dis',
  'esc',
  'fly',
  'han',
  'hea',
  'int',
  'kar',
  'kdu',
  'khi',
  'kna',
  'kpl',
  'kre',
  'per',
  'rid',
  'sen',
  'slt',
  'spl',
  'ste',
  'sur',
  'swm',
  'umd',
] as const;
export type Skill = (typeof listedSkills)[number];
export const target = (skill: Skill) => `skill.${skill}` as const;

export const focus = (skill: Skill) => `pf1/rankProofFocus-${skill}`;
// Perception and Sense Motive share one feat (Alertness's skills); the rest
// pair in list order, the last on its own.
const others = listedSkills.filter(
  (skill) => skill !== 'per' && skill !== 'sen',
);
const pairs: Skill[][] = [
  ['per', 'sen'],
  ...Array.from({ length: Math.ceil(others.length / 2) }, (_, index) =>
    others.slice(index * 2, index * 2 + 2),
  ),
];
const pairKey = (skills: readonly Skill[]) =>
  `pf1/rankProofPair-${skills.join('-')}`;
export const pairOf = (skill: Skill) => {
  const found = pairs.find((skills) => skills.includes(skill));
  if (!found) throw new Error(`No pair feat for ${skill}`);
  return pairKey(found);
};

/** #724's reviewed output for a threshold of `below`, rising by `step` at 10. */
const rankModifier = (skill: Skill, below: number, step: number) => ({
  target: target(skill),
  bonusType: 'untyped',
  value: {
    formula: `${below} + ${step} * min(1, floor(@skillRanks.${skill} / 10))`,
  },
});
function feat(
  externalKey: string,
  name: string,
  modifiers: ReturnType<typeof rankModifier>[],
) {
  return {
    externalKey,
    upstreamKey: externalKey,
    pack: 'feats',
    name,
    detail: { kind: 'feat', featTypes: ['General'], repeatable: 'no' },
    description: `${name}.`,
    sources: [{ book: 'PZO1110', pages: '1' }],
    modifiers,
    unsupported: [],
  };
}
export const bodies = [
  ...listedSkills.map((skill) =>
    feat(focus(skill), `Rank Proof Focus (${skill})`, [
      rankModifier(skill, 3, 3),
    ]),
  ),
  ...pairs.map((skills) =>
    feat(
      pairKey(skills),
      `Rank Proof Pair (${skills.join(', ')})`,
      skills.map((skill) => rankModifier(skill, 2, 2)),
    ),
  ),
];
