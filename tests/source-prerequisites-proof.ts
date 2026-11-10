// The feat Source-prerequisites family's public proof's fixture
// (`convex/characterSheetSourcePrerequisites.integration.test.ts`): feat and
// class bodies shaped as imported. The family's registry entry
// (`scripts/catalog/launch-source-prerequisites.ts`) binds these bytes, and
// `tests/catalog/launch-source-prerequisites.test.ts` ties the family's scope
// to the clauses the fixture releases.
export const classKey = 'pf1/sourcePrerequisitesProofClass';
export const feats = {
  // `Dex 13` (Nimble Moves).
  dex: 'pf1/sourcePrerequisitesProofDex',
  // `Proof Dex, Dex 15, base attack bonus +4` (Spring Attack's shape).
  bab: 'pf1/sourcePrerequisitesProofBab',
  // `Ride 1 rank` (Mounted Combat).
  ride: 'pf1/sourcePrerequisitesProofRide',
  // `Str 13, Int 13`: each ability reads its own score.
  abilities: 'pf1/sourcePrerequisitesProofAbilities',
  // `Caster level 3rd` (Brew Potion, Craft Wondrous Item).
  casterLevel: 'pf1/sourcePrerequisitesProofCasterLevel',
  // `Caster level 1st` (Scribe Scroll).
  firstCasterLevel: 'pf1/sourcePrerequisitesProofFirstCasterLevel',
  // `Wis 13` (Stunning Fist's Wisdom).
  wisdom: 'pf1/sourcePrerequisitesProofWisdom',
  // `Intimidate 1 rank, Spellcraft 2 ranks` (Enforcer's and Selective
  // Spell's skills): each skill reads its own ranks.
  skills: 'pf1/sourcePrerequisitesProofSkills',
} as const;

type Body = {
  externalKey: string;
  name: string;
  pack: string;
  detail: Record<string, unknown>;
  prerequisiteText?: string;
  prerequisites?: unknown[];
};
const body = ({ externalKey, name, pack, detail, ...rest }: Body) => ({
  externalKey,
  upstreamKey: externalKey,
  pack,
  name,
  detail,
  description: `${name}.`,
  sources: [{ book: 'PZO1110', pages: '1' }],
  modifiers: [],
  unsupported: [],
  ...rest,
});
const feat = (
  externalKey: string,
  name: string,
  [prerequisiteText, prerequisites]: [string, unknown[]],
) =>
  body({
    externalKey,
    name,
    pack: 'feats',
    detail: { kind: 'feat', featTypes: ['Combat'], repeatable: 'no' },
    prerequisiteText,
    prerequisites,
  });
export const bodies = [
  body({
    externalKey: classKey,
    name: 'Proof Warrior',
    pack: 'classes',
    detail: {
      kind: 'class',
      tag: 'sourcePrerequisitesProof',
      classKind: 'base',
      hitDie: 10,
      bab: 'full',
      saves: { fort: 'good', ref: 'poor', will: 'poor' },
      classSkills: ['skill.rid'],
      skillRanksPerLevel: 2,
      featuresByLevel: [],
      picksByLevel: [],
    },
  }),
  feat(feats.dex, 'Proof Dex', [
    'Dex 13',
    [{ ability: 'dexterity', min: 13, kind: 'ability' }],
  ]),
  feat(feats.bab, 'Proof Bab', [
    'Proof Dex, Dex 15, base attack bonus +4',
    [
      { feat: feats.dex, kind: 'feat' },
      { ability: 'dexterity', min: 15, kind: 'ability' },
      { bab: 4, kind: 'bab' },
    ],
  ]),
  feat(feats.ride, 'Proof Ride', [
    'Ride 1 rank',
    [{ skillRanks: 'skill.rid', min: 1, kind: 'skillRanks' }],
  ]),
  feat(feats.abilities, 'Proof Abilities', [
    'Str 13, Int 13',
    [
      { ability: 'strength', min: 13, kind: 'ability' },
      { ability: 'intelligence', min: 13, kind: 'ability' },
    ],
  ]),
  feat(feats.casterLevel, 'Proof Caster Level', [
    'Caster level 3rd',
    [{ casterLevel: 3, kind: 'casterLevel' }],
  ]),
  feat(feats.firstCasterLevel, 'Proof First Caster Level', [
    'Caster level 1st',
    [{ casterLevel: 1, kind: 'casterLevel' }],
  ]),
  feat(feats.wisdom, 'Proof Wisdom', [
    'Wis 13',
    [{ ability: 'wisdom', min: 13, kind: 'ability' }],
  ]),
  feat(feats.skills, 'Proof Skills', [
    'Intimidate 1 rank, Spellcraft 2 ranks',
    [
      { skillRanks: 'skill.int', min: 1, kind: 'skillRanks' },
      { skillRanks: 'skill.spl', min: 2, kind: 'skillRanks' },
    ],
  ]),
];
