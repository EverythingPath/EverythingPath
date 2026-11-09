import { z } from 'zod';
import {
  catalogKeySchema,
  importedCatalogEntrySchema,
} from '../../src/lib/catalog/imported-entry-schema.ts';
import { canonicalReleaseJson } from '../../src/lib/catalog/release-schema.ts';
import {
  normalizePrerequisiteAtom,
  prerequisiteSchema,
} from '../../src/lib/character-sheet-prerequisite-schema.ts';
import type { LaunchRow } from './launch-inventory-schema.ts';
import type { LaunchMechanismProof } from './launch-mechanism-proofs.ts';
import { sourcePrerequisitesMechanism } from './launch-prose-categories.ts';

/**
 * The feat Source-prerequisites family (source-prereqs S1, #776). The
 * inventory names one `Source prerequisites` mechanism per source
 * Prerequisites paragraph (`launch-inventory-build.ts`); its contract is the
 * complete source requirement. The public saved-sheet proof
 * (`convex/characterSheetSourcePrerequisites.integration.test.ts`) shows that
 * released `prerequisites` and `prerequisiteText` reach the saved sheet
 * unchanged, that ability, BAB, feat and skill-rank clauses are checked now
 * and at the recorded level (`gainedAtClassLevel`, `choiceOrder`) with
 * inclusive minima, that a feat clause needs possession only, that a
 * caster-level clause (#780) reads the sheet's highest caster level, met at
 * its threshold, unmet below it and re-checked as that level changes, and
 * that every check advises without blocking: an accepted warning survives
 * unrelated edits and reopens when its facts change.
 *
 * The list rule: a row is proven only when it is on the reviewed list, bound
 * to its source bytes and to the exact clauses the importer gives it, because
 * a misparse that keeps plausible kinds (#739: an "or" read as "and", a lost
 * minimum, a citation read as a feat) can't be seen structurally. A record's
 * `basis` quotes the Prerequisites paragraph and the benefit sentence showing
 * that the body adds no eligibility condition the paragraph doesn't state
 * (Greater Spell Focus's "same school" is such a condition), and, for a body
 * kept as text by #237, the attacks contract line. A changed source or
 * importer output drops the row, visibly, until it is reviewed again. A row
 * joins through a list amendment in the wave that admits it.
 *
 * Joined later (#780): the seven item-creation feats, once the importer gave
 * their caster level a typed clause, and Dodge, whose `Modifier ac 1` the
 * plain-Modifiers family proves.
 *
 * Out of the list, with owners: 5 feats whose clauses the importer leaves
 * unchecked (Extra Ki, Alignment Channel, Improved Critical, Weapon Focus,
 * Rapid Reload: #739); the 7 hand-written attack feats whose automation keys
 * the hand-written identity (Two-Weapon Fighting, Improved and Greater
 * Two-Weapon Fighting, Power Attack, Vital Strike, Lunge, Medusa's Wrath:
 * #719/#720); Combat Expertise, whose flurry steps a core flurry recomputes
 * for the hand-written identity only (`docs/character-sheet/attacks.md:100`:
 * #719/#720); Spell Mastery (Wizard not admitted: #767); and Greater Spell
 * Focus (a same-choice clause: #739). Race, class-feature, proficiency,
 * class-level and alternative (`anyOf`) clauses are unproven kinds, and only
 * feats carry the family.
 */

/** The clause kinds the public proof checks. */
const sourcePrerequisiteKinds = [
  'ability',
  'bab',
  'casterLevel',
  'feat',
  'skillRanks',
] as const;
type ProvenKind = (typeof sourcePrerequisiteKinds)[number];

/** How a reviewed feat's body stands beside its prerequisites. */
const sourcePrerequisiteBodies = [
  /** Text by the owner's #237 decision (`docs/character-sheet/attacks.md`). */
  'text-237',
  /** No sheet number is promised. */
  'no-sheet-number',
  /**
   * Only the Modifiers the entry already carries, curated or imported, each
   * its own `Modifier …` mechanism.
   */
  'curated-modifiers',
] as const;

const reviewedSourcePrerequisiteSchema = z.strictObject({
  key: catalogKeySchema,
  name: z.string().min(1),
  /** The row's bound source bytes (`sources[].rawSha256`). */
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  /** The exact clauses the importer gives the row, in order. */
  clauses: z.array(prerequisiteSchema).nonempty(),
  /**
   * The Prerequisites paragraph, the benefit sentence showing it adds no
   * eligibility condition, and the #237 line for a body kept as text.
   */
  basis: z.string().min(1),
  body: z.enum(sourcePrerequisiteBodies),
});

/** The family's scope: the proven clause kinds and the reviewed list. */
export const sourcePrerequisitesScopeSchema = z.strictObject({
  kinds: z.array(z.enum(sourcePrerequisiteKinds)).nonempty(),
  reviewed: z.array(reviewedSourcePrerequisiteSchema),
});
type SourcePrerequisitesScope = z.infer<typeof sourcePrerequisitesScopeSchema>;

const ability = (name: string, min: number) => ({
  ability: name,
  min,
  kind: 'ability',
});
const bab = (value: number) => ({ bab: value, kind: 'bab' });
const casterLevel = (value: number) => ({
  casterLevel: value,
  kind: 'casterLevel',
});
const feat = (key: string) => ({ feat: key, kind: 'feat' });
const ride = { skillRanks: 'skill.rid', min: 1, kind: 'skillRanks' };
const unarmed = 'pf1/2aTFNMs3pW6nUBlr';
const combatExpertise = 'pf1/NFxHebU1XhEs5WJh';
const mountedCombat = 'pf1/0spsP9ylE3goD3jc';
const dodge = 'pf1/JreaiTHdyWFNj3Tb';
const attacks = (line: number, words: string) =>
  `Text by #237: docs/character-sheet/attacks.md:${line} (${words}).`;
const itemCreation = (spellNote = '') =>
  `See the magic item creation rules in Magic Items for more information"; no eligibility condition${spellNote}. A Character who casts nothing has caster level 0, which meets no threshold.`;
const combatTrick =
  'Its appended Combat Trick waives Int 13 only under the Pathfinder Unchained stamina rules, an alternate system the app keeps as prose with no stamina pool (docs/character-sheet/unchained-classes.md:5).';

/**
 * The reviewed list: 19 admitted feats (source-prereqs S1), the seven
 * item-creation feats and Dodge (#780), each read at the pf1 pin
 * `418761d2`. Every named feat is admitted. `drafted` until a cross-model
 * review checks it.
 */
const reviewedSourcePrerequisites = [
  {
    key: 'pf1/nNVFVFRBCT4O2ab9',
    name: 'Brew Potion',
    sourceSha256:
      '64a7c1bedf53d440d66807a443f8c06db8525b0597de49c4f4a42d214c749c0a',
    clauses: [casterLevel(3)],
    basis: `Prerequisites: Caster level 3rd. Benefits: "You can create a potion of any 3rd-level or lower spell that you know and that targets one or more creatures or objects. … ${itemCreation('; the spell limits bound what is brewed, not who may take the feat')}`,
    body: 'no-sheet-number',
  },
  {
    key: 'pf1/4hNO4OAWYF5vXphH',
    name: 'Craft Magic Arms and Armor',
    sourceSha256:
      '27b78a17fc693761ca24b698c317ba3336a3f15b09435583ee6771a898e797f9',
    clauses: [casterLevel(5)],
    basis: `Prerequisites: Caster level 5th. Benefits: "You can create magic weapons, armor, or shields. … ${itemCreation()}`,
    body: 'no-sheet-number',
  },
  {
    key: 'pf1/lIlQnrRkC3YJ1V6t',
    name: 'Craft Staff',
    sourceSha256:
      'e18ba693834da391356484c736848016108eb3f8d9e8d710ce8416e2586dcda7',
    clauses: [casterLevel(11)],
    basis: `Prerequisites: Caster level 11th. Benefits: "You can create any staff whose prerequisites you meet. … ${itemCreation("; a staff's own prerequisites bound what is crafted")}`,
    body: 'no-sheet-number',
  },
  {
    key: 'pf1/V6du9lXESc2spA7B',
    name: 'Craft Wand',
    sourceSha256:
      '302ffe068c9965b87316fa926068f47a2c5ef1b2ea5ef460dd61127d0d004f4b',
    clauses: [casterLevel(5)],
    basis: `Prerequisites: Caster level 5th. Benefits: "You can create a wand of any 4th-level or lower spell that you know. … ${itemCreation('; the spell limit bounds what is crafted')}`,
    body: 'no-sheet-number',
  },
  {
    key: 'pf1/tD76K8QGco9scT0r',
    name: 'Craft Wondrous Item',
    sourceSha256:
      '104837f1bf8e32e6546f74bcebeef734082d1c14656a75ff65a67e9a08566f8c',
    clauses: [casterLevel(3)],
    basis: `Prerequisites: Caster level 3rd. Benefits: "You can create a wide variety of magic wondrous items. … ${itemCreation()}`,
    body: 'no-sheet-number',
  },
  {
    key: 'pf1/ACEQfonKVqh0fwkK',
    name: 'Deflect Arrows',
    sourceSha256:
      'dc934abab96d713cf0c0b8b7ba618bab0e4aba8ca2aed34140ce7685f8ac3de2',
    clauses: [ability('dexterity', 13), feat(unarmed)],
    basis:
      'Prerequisites: Dex 13, Improved Unarmed Strike. Benefits: "Once per round when you would normally be hit with an attack from a ranged weapon, you may deflect it so that you take no damage from it"; the free hand and awareness are conditions of use, not of eligibility.',
    body: 'no-sheet-number',
  },
  {
    key: dodge,
    name: 'Dodge',
    sourceSha256:
      '40937a5acedc7c6690c29c4a97fd670201aa6a7d4f2544e4a1ccf6aa7932dc8e',
    clauses: [ability('dexterity', 13)],
    basis:
      'Prerequisites: Dex 13. Benefits: "You gain a +1 dodge bonus to your AC. A condition that makes you lose your Dex bonus to AC also makes you lose the benefits of this feat"; no eligibility condition. Its imported Modifier, ac +1 dodge, is its own `Modifier ac 1` mechanism, which the plain-Modifiers `ac` pair proves.',
    body: 'curated-modifiers',
  },
  {
    key: 'pf1/HVu9JzllWoLzKKqH',
    name: 'Forge Ring',
    sourceSha256:
      'e1667251aec327ce08b8c0cbbf427039fe493155e85b08c56bf109157f750658',
    clauses: [casterLevel(7)],
    basis: `Prerequisites: Caster level 7th. Benefits: "You can create magic rings. … ${itemCreation()}`,
    body: 'no-sheet-number',
  },
  {
    key: 'pf1/nhUawPP4jfED3CYV',
    name: "Gorgon's Fist",
    sourceSha256:
      '5d93cb5fa31e730142e62509b1566e46889c408a2b30d2fe22d6e16a940add52',
    clauses: [feat(unarmed), feat('pf1/2AfSIVge3bg8r6wr'), bab(6)],
    basis: `Prerequisites: Improved Unarmed Strike, Scorpion Style, base attack bonus +6. Benefits: "As a standard action, make a single unarmed melee attack against a foe whose speed is reduced"; no eligibility condition. ${attacks(6, "feats that change no line's numbers")}`,
    body: 'text-237',
  },
  {
    key: 'pf1/dn2KgHFQRbuoNRx0',
    name: 'Improved Bull Rush',
    sourceSha256:
      '2081ae65a2738126c5b77172ca805e83ef311c8873209fd06e1a722f7a01ad24',
    clauses: [ability('strength', 13), feat('pf1/FUW5mIXHNBBIQ1Sq'), bab(1)],
    basis:
      'Prerequisites: Str 13, Power Attack, base attack bonus +1. Benefits: "You do not provoke an attack of opportunity when performing a bull rush combat maneuver. In addition, you receive a +2 bonus on checks made to bull rush a foe"; no eligibility condition.',
    body: 'curated-modifiers',
  },
  {
    key: 'pf1/711B9WNFgpdDKKf2',
    name: 'Improved Disarm',
    sourceSha256:
      '82c0ecaea3078422d6716d9966f645cc3c84e08559ac9e1b9ba3812c2f75fa91',
    clauses: [ability('intelligence', 13), feat(combatExpertise)],
    basis: `Prerequisites: Int 13, Combat Expertise. Benefits: "You do not provoke an attack of opportunity when performing a disarm combat maneuver. In addition, you receive a +2 bonus on checks made to disarm a foe"; no eligibility condition. ${combatTrick}`,
    body: 'curated-modifiers',
  },
  {
    key: 'pf1/tocde3sKG1O3GKgd',
    name: 'Improved Feint',
    sourceSha256:
      '279873939366dd1859d5963c769bb3afba9fe87027871cb9939e69b41985899d',
    clauses: [ability('intelligence', 13), feat(combatExpertise)],
    basis:
      'Prerequisites: Int 13, Combat Expertise. Benefits: "You can make a Bluff check to feint in combat as a move action"; no eligibility condition.',
    body: 'no-sheet-number',
  },
  {
    key: 'pf1/ZmQkRk93nbHxsQSt',
    name: 'Improved Grapple',
    sourceSha256:
      'a02b326170ca82cb5fca28fa1870589877579181457f846a09847a2b18421f3d',
    clauses: [ability('dexterity', 13), feat(unarmed)],
    basis:
      'Prerequisites: Dex 13, Improved Unarmed Strike. Benefits: "You do not provoke an attack of opportunity when performing a grapple combat maneuver. In addition, you receive a +2 bonus on checks made to grapple a foe"; no eligibility condition.',
    body: 'curated-modifiers',
  },
  {
    key: 'pf1/cKxfEL5XOWuzLhfO',
    name: 'Improved Iron Will',
    sourceSha256:
      '5886e55b076ce4aff2778d36d7f520bc6204bafb06521073d7fbe2eea7be7291',
    clauses: [feat('pf1/iAbIGhm7T2OK9Brt')],
    basis:
      'Prerequisites: Iron Will. Benefits: "Once per day, you may reroll a Will save"; no eligibility condition.',
    body: 'no-sheet-number',
  },
  {
    key: 'pf1/PrthT5jZl4t3znqR',
    name: 'Improved Lightning Reflexes',
    sourceSha256:
      '65baa125520da5a3b91eb89fa55b9c70b325253ed15734fe71197650831ab6f5',
    clauses: [feat('pf1/0bZf3SDkvVOe2ujH')],
    basis:
      'Prerequisites: Lightning Reflexes. Benefits: "Once per day, you may reroll a Reflex save"; no eligibility condition.',
    body: 'no-sheet-number',
  },
  {
    key: 'pf1/gTrGPxzN054GfpkM',
    name: 'Improved Trip',
    sourceSha256:
      '23605d29a645bdacccc146cb5d284f9931b05c5030689be0e948adc602f9bb20',
    clauses: [ability('intelligence', 13), feat(combatExpertise)],
    basis: `Prerequisites: Int 13, Combat Expertise. Benefits: "You do not provoke an attack of opportunity when performing a trip combat maneuver. In addition, you receive a +2 bonus on checks made to trip a foe"; no eligibility condition. ${combatTrick}`,
    body: 'curated-modifiers',
  },
  {
    key: 'pf1/R7L4SlGRlnThqFrP',
    name: 'Mobility',
    sourceSha256:
      '5f7efe64f8637455d3d339fdc5fa3b142370c198fa352df9c0642fae9f74d31b',
    clauses: [ability('dexterity', 13), feat(dodge)],
    basis:
      'Prerequisites: Dex 13, Dodge. Benefits: "You get a +4 dodge bonus to Armor Class against attacks of opportunity caused when you move out of or within a threatened area"; no eligibility condition.',
    body: 'curated-modifiers',
  },
  {
    key: 'pf1/rp9HV7wYcMb333si',
    name: 'Mounted Archery',
    sourceSha256:
      '751ada34b87b4f38008904a1b890608ee2de04e6c53c6e6315b18618b51d828c',
    clauses: [ride, feat(mountedCombat)],
    basis: `Prerequisites: Ride 1 rank, Mounted Combat. Benefits: "The penalty you take when using a ranged weapon while mounted is halved"; no eligibility condition. ${attacks(8, 'mounted penalties')}`,
    body: 'text-237',
  },
  {
    key: mountedCombat,
    name: 'Mounted Combat',
    sourceSha256:
      '38c4a5b3c7fbc94cc88cdce154ced97c89233d7ca915297d5543397803806d9c',
    clauses: [ride],
    basis:
      'Prerequisites: Ride 1 rank. Benefits: "Once per round when your mount is hit in combat, you may attempt a Ride check (as an immediate action) to negate the hit"; no eligibility condition.',
    body: 'no-sheet-number',
  },
  {
    key: 'pf1/VMVAqGze4cs3naya',
    name: 'Nimble Moves',
    sourceSha256:
      'faedebe22be0fa858c6b9b97f8bbf6bb7227a4c976ed29ab5d716d24b50ca76d',
    clauses: [ability('dexterity', 13)],
    basis:
      'Prerequisites: Dex 13. Benefits: "Whenever you move, you may move through 5 feet of difficult terrain each round as if it were normal terrain"; no eligibility condition.',
    body: 'no-sheet-number',
  },
  {
    key: 'pf1/liPAO5urMI9chctT',
    name: 'Ride-By Attack',
    sourceSha256:
      '2c95c39ed959ff8b605f5b6529933c7b97381eb88844916ab0b95fef6aa57b3e',
    clauses: [ride, feat(mountedCombat)],
    basis: `Prerequisites: Ride 1 rank, Mounted Combat. Benefits: "When you are mounted and use the charge action, you may move and attack as if with a standard charge and then move again"; no eligibility condition. ${attacks(6, "feats that change no line's numbers")}`,
    body: 'text-237',
  },
  {
    key: 'pf1/2AfSIVge3bg8r6wr',
    name: 'Scorpion Style',
    sourceSha256:
      'd6395702036862391490209df5ba02a94ecc30efce836d390b469db1830f1675',
    clauses: [feat(unarmed)],
    basis: `Prerequisites: Improved Unarmed Strike. Benefits: "To use this feat, you must make a single unarmed attack as a standard action"; no eligibility condition. ${attacks(6, "feats that change no line's numbers")}`,
    body: 'text-237',
  },
  {
    key: 'pf1/tlRu8SYjzA7WCHN7',
    name: 'Scribe Scroll',
    sourceSha256:
      '32825de35dd70794500b078dc1d0c1f0080612a47e19f671413b9139b413c31b',
    clauses: [casterLevel(1)],
    basis: `Prerequisites: Caster level 1st. Benefits: "You can create a scroll of any spell that you know. … ${itemCreation('; the known spell bounds what is scribed')}`,
    body: 'no-sheet-number',
  },
  {
    key: 'pf1/bHcqTC4Lf3aVl3VO',
    name: 'Snatch Arrows',
    sourceSha256:
      '0386a045e7e03a08da0e3b678f4ad5088d28e440b7e4b1ebd296534c7727e731',
    clauses: [
      ability('dexterity', 15),
      feat('pf1/ACEQfonKVqh0fwkK'),
      feat(unarmed),
    ],
    basis:
      'Prerequisites: Dex 15, Deflect Arrows, Improved Unarmed Strike. Benefits: "When using the Deflect Arrows feat you may choose to catch the weapon instead of just deflecting it"; the free hand is a condition of use, not of eligibility.',
    body: 'no-sheet-number',
  },
  {
    key: 'pf1/jKVhOxHu6VmUgFdp',
    name: 'Spirited Charge',
    sourceSha256:
      '3e8ab934b654d0a3596cf4b9a96a378c77d816a9f9f2f3a2dad2286a2480d593',
    clauses: [ride, feat(mountedCombat), feat('pf1/liPAO5urMI9chctT')],
    basis: `Prerequisites: Ride 1 rank, Mounted Combat, Ride-By Attack. Benefits: "When mounted and using the charge action, you deal double damage with a melee weapon (or triple damage with a lance)"; no eligibility condition. ${attacks(7, 'multipliers')}`,
    body: 'text-237',
  },
  {
    key: 'pf1/ugQyUpqPBDsqLyra',
    name: 'Spring Attack',
    sourceSha256:
      '49f643bec7069d2f67e4b76b613ecd60da7b5e8699c3015d3957a1879f2faa65',
    clauses: [
      ability('dexterity', 13),
      feat(dodge),
      feat('pf1/R7L4SlGRlnThqFrP'),
      bab(4),
    ],
    basis: `Prerequisites: Dex 13, Dodge, Mobility, base attack bonus +4. Benefits: "As a full-round action, you can move up to your speed and make a single melee attack without provoking any attacks of opportunity from the target of your attack"; no eligibility condition. ${attacks(6, "feats that change no line's numbers")}`,
    body: 'text-237',
  },
  {
    key: 'pf1/PkktjwppuVzoLn19',
    name: 'Strike Back',
    sourceSha256:
      '19332563b39f8b1aaa7320661d21da08e1cac1f819f64865eadfad7d25ed00f7',
    clauses: [bab(11)],
    basis: `Prerequisites: Base attack bonus +11. Benefits: "You can ready an action to make a melee attack against any foe that attacks you in melee, even if the foe is outside of your reach"; no eligibility condition. ${attacks(6, "feats that change no line's numbers")}`,
    body: 'text-237',
  },
];

/** The family's raw registry entry (`launchMechanismProofs`). */
export const sourcePrerequisitesProofEntry = {
  family: 'source-prerequisites',
  mechanism: sourcePrerequisitesMechanism,
  kinds: ['feat'],
  tests: [
    {
      path: 'convex/characterSheetSourcePrerequisites.integration.test.ts',
      sha256:
        '8b6bd576f5eb15f276b930b7902858930ffebc2127adbb0c94c0ba8a93dfa0ac',
    },
  ],
  calculationIdentity:
    'sha256:494b2a54bf200f0da65d23018b92f5e56850007579b988f81c947f33823830c9',
  disqualifying: ['prerequisites'],
  prerequisites: {
    kinds: [...sourcePrerequisiteKinds],
    reviewed: reviewedSourcePrerequisites,
  },
};

/** The inventory's contract text before the Prerequisites paragraph. */
const contractPrefix =
  'Preserve all alternatives, minima, conditions and recorded-level/active checks in the complete source requirement: ';

/** The paragraph an inventory contract names, or none. */
function contractParagraph(contract: string) {
  return contract.startsWith(contractPrefix)
    ? contract.slice(contractPrefix.length)
    : undefined;
}

/**
 * A Prerequisites paragraph read as text: each `@UUID[…]{label}` as its
 * label, without the heading and the final period.
 */
function prerequisiteParagraphText(paragraph: string) {
  return paragraph
    .replace(/@(?:UUID|Compendium)\[[^\]]*\]\{([^}]*)\}/g, '$1')
    .replace(/^Prerequisites?\s*:\s*/i, '')
    .replace(/\.$/, '')
    .trim();
}

/**
 * A clause the public proof checks: an atom (never `anyOf`) of a scope kind,
 * with its kind recorded; a feat clause names no choice, since only
 * possession is proven.
 */
function provenClause(clause: unknown, kinds: readonly ProvenKind[]) {
  const parsed = prerequisiteSchema.safeParse(clause);
  if (!parsed.success || 'anyOf' in parsed.data) return false;
  const atom = normalizePrerequisiteAtom(parsed.data);
  return (
    kinds.some((kind) => kind === atom.kind) &&
    parsed.data.kind === atom.kind &&
    !(atom.kind === 'feat' && atom.choice !== undefined)
  );
}

type ProvenRow = Pick<LaunchRow, 'key' | 'kind' | 'mechanisms' | 'sources'>;
type SourcePrerequisitesInput = {
  row: ProvenRow;
  /** The row's scoped build entry. */
  entry: unknown;
  /** Whether the gate admits a release key. */
  admitted: (key: string) => boolean;
};

/**
 * The row's reviewed record and its one `Source prerequisites` paragraph:
 * a feat row on the list, bound to the reviewed source bytes, with exactly
 * one such mechanism whose contract is the inventory's.
 */
function reviewedRow(scope: SourcePrerequisitesScope, row: ProvenRow) {
  const mechanisms = row.mechanisms.filter(
    ({ name }) => name === sourcePrerequisitesMechanism,
  );
  const reviewed = scope.reviewed.find(({ key }) => key === row.key);
  const paragraph =
    mechanisms.length === 1 && mechanisms[0]
      ? contractParagraph(mechanisms[0].contract)
      : undefined;
  return row.kind === 'feat' &&
    reviewed &&
    paragraph !== undefined &&
    row.sources.some(({ rawSha256 }) => rawSha256 === reviewed.sourceSha256)
    ? { reviewed, paragraph }
    : undefined;
}

/** The scoped feat entry and its clauses exactly as the build emits them. */
function featEntry(entry: unknown) {
  const parsed = importedCatalogEntrySchema.safeParse(entry);
  const clauses =
    typeof entry === 'object' && entry !== null && 'prerequisites' in entry
      ? entry.prerequisites
      : undefined;
  if (
    !parsed.success ||
    parsed.data.detail.kind !== 'feat' ||
    !Array.isArray(clauses)
  )
    return undefined;
  const emitted: unknown[] = clauses;
  return { parsed: parsed.data, clauses: emitted };
}

/**
 * Whether the family proves the row's `Source prerequisites`: the row is a
 * feat with exactly one such mechanism, on the reviewed list with its bound
 * source bytes; its scoped feat entry's clauses equal the reviewed ones
 * exactly, each a proven atom; its `prerequisiteText` is its contract
 * paragraph read as text; and every feat a clause names is admitted.
 */
function sourcePrerequisitesProven(
  scope: SourcePrerequisitesScope,
  { row, entry, admitted }: SourcePrerequisitesInput,
) {
  const listed = reviewedRow(scope, row);
  const built = featEntry(entry);
  if (!listed || !built) return false;
  const { parsed, clauses } = built;
  return (
    canonicalReleaseJson(clauses) ===
      canonicalReleaseJson(listed.reviewed.clauses) &&
    clauses.every((clause) => provenClause(clause, scope.kinds)) &&
    parsed.prerequisiteText === prerequisiteParagraphText(listed.paragraph) &&
    (parsed.prerequisites ?? []).every(
      (clause) => !('feat' in clause) || admitted(clause.feat),
    )
  );
}

/**
 * The projection's gate for one registry entry and row: this family's entry
 * proves only through `sourcePrerequisitesProven`; any other entry naming
 * `Source prerequisites`, with a scope or without, proves nothing; every
 * other entry passes.
 */
export function sourcePrerequisitesGate(
  proof: LaunchMechanismProof,
  input: SourcePrerequisitesInput,
) {
  if ('prerequisites' in proof)
    return sourcePrerequisitesProven(proof.prerequisites, input);
  return !(
    'mechanism' in proof && proof.mechanism === sourcePrerequisitesMechanism
  );
}
