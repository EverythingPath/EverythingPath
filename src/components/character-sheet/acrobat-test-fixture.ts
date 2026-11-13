import type { CharacterSheetCatalogEntry } from '~/lib/character-sheet';

// #583/#716: APG p.132 Acrobat (PCGen apg_abilities_class.lst:2941, its .MOD
// :3703) as P5's archetype mapper prepares it on the reviewed CRB Rogue
// schedule, and the Foundry classes and features it meets (the Unchained
// rogue's rows are P7b's reviewed schedule). They are
// published records, not invented ones: `tests/catalog/pcgen-archetypes.test.ts`
// checks every value here against the mapper and the pinned Foundry files.

/** Foundry's Rogue and Rogue (Unchained) (packs/classes/rogue*.yaml). */
export const foundryRogue = 'pf1/24b0LaabeAlUx5gN';
export const foundryUnchainedRogue = 'pf1/5tsZI6zk29yX1ckA';
const trapfinding = 'pf1/pEODJDoTk7uhCZY7';
const trapSense = 'pf1/BoEkMviJrW0PKmhj';
const dangerSense = 'pf1/sTlu3zgAEDdJnER5';

/** The prepared Acrobat: trapfinding and trap sense replaced whole. */
export const acrobatDetail = {
  kind: 'archetype' as const,
  classEntryIds: [foundryRogue],
  replaces: [
    { classLevel: 1, catalogEntryId: trapfinding, scope: 'whole' as const },
    { classLevel: 3, catalogEntryId: trapSense, scope: 'whole' as const },
  ],
  adds: [
    { classLevel: 1, catalogEntryId: 'everythingpath/rogue-acrobat-expert-acrobat' },
    { classLevel: 3, catalogEntryId: 'everythingpath/rogue-acrobat-second-chance' },
  ],
  featureChanges: [
    { featureIdentity: trapfinding, scope: 'whole' as const },
    { featureIdentity: trapSense, scope: 'whole' as const },
  ],
};

type Sourced = CharacterSheetCatalogEntry & {
  sources: { book: string; pages: string }[];
};
const apg = [{ book: "Advanced Player's Guide", pages: '132' }];
const crb = (pages: string) => [{ book: 'Core Rulebook', pages }];
const feature = (
  id: string,
  name: string,
  sources: Sourced['sources'],
): Sourced => ({
  _id: id,
  ruleIdentity: id,
  name,
  modifiers: [],
  sources,
  detail: { kind: 'classFeature' },
});

/** The Acrobat, its two features and the Foundry features it names. */
export const acrobatCatalog: Sourced[] = [
  {
    _id: 'everythingpath/rogue-acrobat',
    ruleIdentity: 'everythingpath/rogue-acrobat',
    name: 'Acrobat',
    modifiers: [],
    sources: apg,
    detail: acrobatDetail,
  },
  feature('everythingpath/rogue-acrobat-expert-acrobat', 'Expert Acrobat', apg),
  feature('everythingpath/rogue-acrobat-second-chance', 'Second Chance', apg),
  // Foundry's names and first sources: trapfinding.pEODJDoTk7uhCZY7.yaml
  // (PZO1110 p.63), trap-sense.BoEkMviJrW0PKmhj.yaml (PZO1110 pp.31, 69) and
  // danger-sense.sTlu3zgAEDdJnER5.yaml (PZO1131 pp.13, 22).
  feature(trapfinding, 'Trapfinding', crb('63')),
  feature(trapSense, 'Trap Sense', crb('31, 69')),
  feature(dangerSense, 'Danger Sense', [
    { book: 'Pathfinder Unchained', pages: '13, 22' },
  ]),
];
