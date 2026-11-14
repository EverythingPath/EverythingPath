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
 * unrelated edits and reopens when its facts change. Each ability and skill
 * a listed record names is checked against its own score or ranks (Strength,
 * Dexterity, Intelligence and Wisdom; Ride, Intimidate and Spellcraft). The
 * entry binds the test's fixture (`tests/source-prerequisites-proof.ts`) by
 * bytes beside the test, and the coverage tie
 * (`tests/catalog/launch-source-prerequisites.test.ts`) fails when the
 * scope's kinds, or an ability or skill a listed record names, exceed what
 * the fixture releases.
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
 * plain-Modifiers family proves. Feat wave FW1 (#330-#332) lists the 25
 * feats it admits on whole-content re-assessment; it holds out the feats
 * calculated by a hand-written identity (owner-q-prereq-bodies O1). Feat
 * wave FW2a lists 14 more, among them Craft Construct and Craft Rod on their
 * caster level, the first pf1-content (Advanced Player's Guide) feats, and
 * Lightning Stance, which FW1's Wind Stance admitted. It holds out Pushing
 * Assault, which replaces the hand-written Power Attack's extra damage
 * (owner-q-prereq-bodies O1), and Diviner's Delving and Tenacious
 * Transmutation, whose Spell Focus clause names a school.
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
const ranks = (skill: string, min: number) => ({
  skillRanks: skill,
  min,
  kind: 'skillRanks',
});
const ride = ranks('skill.rid', 1);
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
 * item-creation feats and Dodge (#780), the 25 feats feat wave FW1 admits
 * (#330-#332), and the 14 feats feat wave FW2a admits with Lightning Stance,
 * each read at the pf1 pin `418761d2` or the pf1-content pin `02f4ab0d`.
 * Every named feat is admitted. `drafted` until a cross-model review checks
 * it.
 */
const reviewedSourcePrerequisites = [
  {
    key: 'pf1/B6wEQOUMv2ifm2Nj',
    name: 'Acrobatic Steps',
    sourceSha256:
      '053c0af3bbdf57ba01b7644ed341b14a6c3007d1c8fea3ca42f515939dfaea34',
    clauses: [ability('dexterity', 15), feat('pf1/VMVAqGze4cs3naya')],
    basis:
      'Prerequisites: Dex 15, Nimble Moves. Benefits: "Whenever you move, you may move through up to 15 feet of difficult terrain each round as if it were normal terrain"; no eligibility condition.',
    body: 'no-sheet-number',
  },
  {
    key: 'pf1-content/xKJhMF8gS9c53RGl',
    name: 'Bloody Assault',
    sourceSha256:
      '3ed4183e73812a7a515305ae002b4fe71da347b6e16a0efe10db48dd5d284eaf',
    clauses: [ability('strength', 13), feat('pf1/FUW5mIXHNBBIQ1Sq'), bab(6)],
    basis:
      'Prerequisites: Str 13, Power Attack, base attack bonus +6. Benefits: "You can choose to take a -5 penalty on all melee attack rolls and combat maneuver checks to inflict 1d4 points of bleed damage with your weapon melee attacks"; no eligibility condition. Its −5 on melee attack rolls and combat maneuver checks are the entry\'s curated conditional Modifiers.',
    body: 'curated-modifiers',
  },
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
    key: 'pf1/Zeq6RWYv5otvg8q7',
    name: 'Cleave',
    sourceSha256:
      '3829754c56ce65bb84861567858bd29e8f9a81c9f70fa205d76069bc616773d1',
    clauses: [ability('strength', 13), feat('pf1/FUW5mIXHNBBIQ1Sq'), bab(1)],
    basis: `Prerequisites: Str 13, Power Attack, base attack bonus +1. Benefits: "As a standard action, you can make a single attack at your full base attack bonus against a foe within reach"; no eligibility condition. Its −2 AC until your next turn is the entry's curated conditional Modifier. ${attacks(6, "feats that change no line's numbers")}`,
    body: 'text-237',
  },
  {
    key: 'pf1-content/CZPFbXtRnYZi6yQk',
    name: 'Combat Patrol',
    sourceSha256:
      '66398ff17f8465a5ca951f4c5f50e0b00811209fbae9156eef9fcfe6e4a2b3c0',
    clauses: [
      feat('pf1/h9nHYLxXvIXBTmup'),
      feat('pf1/R7L4SlGRlnThqFrP'),
      bab(5),
    ],
    basis: `Prerequisites: Combat Reflexes, Mobility, base attack bonus +5. Benefits: "As a full-round action, you may set up a combat patrol, increasing your threatened area by 5 feet for every 5 points of your base attack bonus"; no eligibility condition. ${attacks(5, 'other books: text when no plain Modifier expresses it')}`,
    body: 'text-237',
  },
  {
    key: 'pf1/DMSYzt5jD9vk0DGy',
    name: 'Craft Construct',
    sourceSha256:
      '831f136f69bf3d35ffaa7df9e35b09b183ff260528f118b3b4c0e4c05456ac81',
    clauses: [
      casterLevel(5),
      feat('pf1/4hNO4OAWYF5vXphH'),
      feat('pf1/tD76K8QGco9scT0r'),
    ],
    basis:
      'Prerequisites: Caster level 5th, Craft Magic Arms and Armor, Craft Wondrous Item. Benefits: "You can create any construct whose prerequisites you meet"; no eligibility condition. A Character who casts nothing has caster level 0, which meets no threshold.',
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
    key: 'pf1/rt2cBQvEU0ANE3z4',
    name: 'Craft Rod',
    sourceSha256:
      '33c755554d605500882be270f905f2b12d54bf3f79a0f0e03001295a4fb49a6a',
    clauses: [casterLevel(9)],
    basis: `Prerequisites: Caster level 9th. Benefits: "You can create magic rods. Crafting a rod takes 1 day for each 1,000 gp in its base price. … ${itemCreation()}`,
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
    key: 'pf1-content/OlN0hWOhnp1yUpZG',
    name: 'Dazing Assault',
    sourceSha256:
      'ee47169653fcec60b6bf61a83f5a61426288ebd2eaecea8a857add17996cdfbd',
    clauses: [ability('strength', 13), feat('pf1/FUW5mIXHNBBIQ1Sq'), bab(11)],
    basis:
      'Prerequisites: Str 13, Power Attack, base attack bonus +11. Benefits: "You can choose to take a -5 penalty on all melee attack rolls and combat maneuver checks to daze opponents you hit with your melee attacks for 1 round"; no eligibility condition. Its −5 on melee attack rolls and combat maneuver checks are the entry\'s curated conditional Modifiers.',
    body: 'curated-modifiers',
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
    key: 'pf1-content/R351L670WEKmPCFW',
    name: 'Enforcer',
    sourceSha256:
      'c310824c11bcf7a812c13167b0df368be30aaf8a83f0b59adc50eca096450b99',
    clauses: [ranks('skill.int', 1)],
    basis:
      'Prerequisites: Intimidate 1 rank. Benefits: "Whenever you deal nonlethal damage with a melee weapon, you can make an Intimidate check to demoralize your target as a free action"; no eligibility condition.',
    body: 'no-sheet-number',
  },
  {
    key: 'pf1/HMCAM3Zyo77kG8Yg',
    name: 'Far Shot',
    sourceSha256:
      '8087d214f7b48c8f5e154e38658e2b429750ccbd381671117a72a0d62a5a0e40',
    clauses: [feat('pf1/8rsFtye3PwM6CKli')],
    basis: `Prerequisites: Point-Blank Shot. Benefits: "You only suffer a -1 penalty per full range increment between you and your target when using a ranged weapon"; no eligibility condition. ${attacks(8, "Far Shot's adjustment to range increments")}`,
    body: 'text-237',
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
    key: 'pf1/6HSMdwX1VS6nZ6Zf',
    name: 'Great Cleave',
    sourceSha256:
      '2a0a6405d5cc937b472934ec6104ff254f858bfa626222f9529f6e7d147b1af2',
    clauses: [
      ability('strength', 13),
      feat('pf1/Zeq6RWYv5otvg8q7'),
      feat('pf1/FUW5mIXHNBBIQ1Sq'),
      bab(4),
    ],
    basis: `Prerequisites: Str 13, Cleave, Power Attack, base attack bonus +4. Benefits: "As a standard action, you can make a single attack at your full base attack bonus against a foe within reach"; no eligibility condition. ${attacks(6, "feats that change no line's numbers")}`,
    body: 'text-237',
  },
  {
    key: 'pf1/XGvS0hHv58XAeQij',
    name: 'Greater Bull Rush',
    sourceSha256:
      '653feeed0bc5929c118b6b9dbbca562825ef8d00d292f0e5d86e84ef1a74274d',
    clauses: [
      feat('pf1/dn2KgHFQRbuoNRx0'),
      feat('pf1/FUW5mIXHNBBIQ1Sq'),
      bab(6),
      ability('strength', 13),
    ],
    basis:
      'Prerequisites: Improved Bull Rush, Power Attack, base attack bonus +6, Str 13. Benefits: "You receive a +2 bonus on checks made to bull rush a foe. This bonus stacks with the bonus granted by Improved Bull Rush"; no eligibility condition.',
    body: 'curated-modifiers',
  },
  {
    key: 'pf1/1AY9Xjbg109TsnVl',
    name: 'Greater Disarm',
    sourceSha256:
      '3d238d5b6fa46c10138a75416d38af0dbf6e9df6d2fef70f847f6990454f80ed',
    clauses: [
      feat(combatExpertise),
      feat('pf1/711B9WNFgpdDKKf2'),
      bab(6),
      ability('intelligence', 13),
    ],
    basis: `Prerequisites: Combat Expertise, Improved Disarm, base attack bonus +6, Int 13. Benefits: "You receive a +2 bonus on checks made to disarm a foe. This bonus stacks with the bonus granted by Improved Disarm"; no eligibility condition. ${combatTrick}`,
    body: 'curated-modifiers',
  },
  {
    key: 'pf1/0VM8AdwP25nHWnV8',
    name: 'Greater Feint',
    sourceSha256:
      '71c8f5816b534d7a4bcfab6013b92927f8272a7e8ef5322ed0799222720eaeaa',
    clauses: [
      feat(combatExpertise),
      feat('pf1/tocde3sKG1O3GKgd'),
      bab(6),
      ability('intelligence', 13),
    ],
    basis:
      'Prerequisites: Combat Expertise, Improved Feint, base attack bonus +6, Int 13. Benefits: "Whenever you use feint to cause an opponent to lose his Dexterity bonus, he loses that bonus until the beginning of your next turn"; no eligibility condition.',
    body: 'no-sheet-number',
  },
  {
    key: 'pf1/hc7CRKHvhmKRzNKb',
    name: 'Greater Grapple',
    sourceSha256:
      'b74b6e439d5e1dd19707411f4ffbd104728b89abd94a41d9dc5e4b6e72021a13',
    clauses: [
      feat('pf1/ZmQkRk93nbHxsQSt'),
      feat(unarmed),
      bab(6),
      ability('dexterity', 13),
    ],
    basis:
      'Prerequisites: Improved Grapple, Improved Unarmed Strike, base attack bonus +6, Dex 13. Benefits: "You receive a +2 bonus on checks made to grapple a foe. This bonus stacks with the bonus granted by Improved Grapple"; no eligibility condition.',
    body: 'curated-modifiers',
  },
  {
    key: 'pf1/tkWfEP1fD7CZt8Kw',
    name: 'Greater Overrun',
    sourceSha256:
      '19c22c6601f6bc5a57933ddab5043813b8979bcbc68924f35b7e0357cbcbd73d',
    clauses: [
      feat('pf1/go4xOiSUP8R1QJ5N'),
      feat('pf1/FUW5mIXHNBBIQ1Sq'),
      bab(6),
      ability('strength', 13),
    ],
    basis:
      'Prerequisites: Improved Overrun, Power Attack, base attack bonus +6, Str 13. Benefits: "You receive a +2 bonus on checks made to overrun a foe. This bonus stacks with the bonus granted by Improved Overrun"; no eligibility condition.',
    body: 'curated-modifiers',
  },
  {
    key: 'pf1/3HjwKckDBDDPcY2c',
    name: 'Greater Spell Penetration',
    sourceSha256:
      '250e156b4e6a5ffee4c96f575a712f910383568cb47cf93d6fc5a0e8ed287abc',
    clauses: [feat('pf1/nWFr8SNcjcMqsXSH')],
    basis:
      'Prerequisites: Spell Penetration. Benefits: "You get a +2 bonus on caster level checks (1d20 + caster level) made to overcome a creature\'s spell resistance"; no eligibility condition.',
    body: 'curated-modifiers',
  },
  {
    key: 'pf1/wJNggbGTZBx7BW9W',
    name: 'Greater Sunder',
    sourceSha256:
      '45bdbf75cb00fecd93315c1790cbec033a1962407afec0d366af4bc27fd5aded',
    clauses: [
      feat('pf1/lpXdFoT6OqS5vi2X'),
      feat('pf1/FUW5mIXHNBBIQ1Sq'),
      bab(6),
      ability('strength', 13),
    ],
    basis:
      'Prerequisites: Improved Sunder, Power Attack, base attack bonus +6, Str 13. Benefits: "You receive a +2 bonus on checks made to sunder an item. This bonus stacks with the bonus granted by Improved Sunder"; no eligibility condition.',
    body: 'curated-modifiers',
  },
  {
    key: 'pf1/lNyMFFQaOxxTOW7M',
    name: 'Greater Trip',
    sourceSha256:
      'e71b29fdbdbf92deb4c61dcb619788fd16926e5ab54153f7499c2e75320482a8',
    clauses: [
      feat(combatExpertise),
      feat('pf1/gTrGPxzN054GfpkM'),
      bab(6),
      ability('intelligence', 13),
    ],
    basis: `Prerequisites: Combat Expertise, Improved Trip, base attack bonus +6, Int 13. Benefits: "You receive a +2 bonus on checks made to trip a foe. This bonus stacks with the bonus granted by Improved Trip"; no eligibility condition. ${combatTrick}`,
    body: 'curated-modifiers',
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
    key: 'pf1/1hxjrJ68yWsiCCFD',
    name: 'Improved Great Fortitude',
    sourceSha256:
      '08f334abc0fba8ac11ab9791acff832079330cec07417440599570ca71bab9ff',
    clauses: [feat('pf1/fVRnBIHR4Jq6btvm')],
    basis:
      'Prerequisites: Great Fortitude. Benefits: "Once per day, you may reroll a Fortitude save"; no eligibility condition.',
    body: 'no-sheet-number',
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
    key: 'pf1/go4xOiSUP8R1QJ5N',
    name: 'Improved Overrun',
    sourceSha256:
      'e3e5708b39d3c1a671b72a265bf22c2c204b398fb20587da025e4b0a309f9f88',
    clauses: [ability('strength', 13), feat('pf1/FUW5mIXHNBBIQ1Sq'), bab(1)],
    basis:
      'Prerequisites: Str 13, Power Attack, base attack bonus +1. Benefits: "You do not provoke an attack of opportunity when performing an overrun combat maneuver"; no eligibility condition.',
    body: 'curated-modifiers',
  },
  {
    key: 'pf1/lpXdFoT6OqS5vi2X',
    name: 'Improved Sunder',
    sourceSha256:
      'c0f2e2054cca7125fe918fd39ab7f93d76f058b0c5b9962d45a25cd594745871',
    clauses: [ability('strength', 13), feat('pf1/FUW5mIXHNBBIQ1Sq'), bab(1)],
    basis:
      'Prerequisites: Str 13, Power Attack, base attack bonus +1. Benefits: "You do not provoke an attack of opportunity when performing a sunder combat maneuver"; no eligibility condition.',
    body: 'curated-modifiers',
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
    key: 'pf1/jbvXxHpu7BVbCpwr',
    name: 'Lightning Stance',
    sourceSha256:
      'c1481e8f3ea82174299c8db611fb21d9ced481dc82428cdcf5e132826f7c1d58',
    clauses: [
      ability('dexterity', 17),
      feat(dodge),
      feat('pf1/9p0aAtCyLdcwnftS'),
      bab(11),
    ],
    basis:
      'Prerequisites: Dex 17, Dodge, Wind Stance, base attack bonus +11. Benefits: "If you take two actions to move or a withdraw action in a turn, you gain 50% concealment for 1 round"; no eligibility condition.',
    body: 'no-sheet-number',
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
    key: 'pf1/ln2Dhw97Fol1BCxU',
    name: 'Outflank',
    sourceSha256:
      '2df236b49791339579ecd4c21d8f8c813624167b5d8472fd537068ac201a69e6',
    clauses: [bab(4)],
    basis: `Prerequisites: Base attack bonus +4. Benefits: "Whenever you and an ally who also has this feat are flanking the same creature, your flanking bonus on attack rolls increases to +4"; no eligibility condition. The ally who also has the feat is a condition of use, not of eligibility. ${attacks(5, 'other books: text when no plain Modifier expresses it')}`,
    body: 'text-237',
  },
  {
    key: 'pf1/NdrNsfFKYGy3VXDF',
    name: 'Precise Strike',
    sourceSha256:
      '0135e617504b3b4b824375bfb3221523d27086a60540b1a60de5fbba62aaa5e0',
    clauses: [ability('dexterity', 13), bab(1)],
    basis: `Prerequisites: Dex 13, base attack bonus +1. Benefits: "Whenever you and an ally who also has this feat are flanking the same the creature, you deal an additional 1d6 points of precision damage with each successful melee attack"; no eligibility condition. The ally who also has the feat is a condition of use, not of eligibility. ${attacks(5, 'other books: text when no plain Modifier expresses it')}`,
    body: 'text-237',
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
    key: 'pf1-content/qfC7oCO4ISFFJ2Pq',
    name: 'Second Chance',
    sourceSha256:
      '76a6e3742c2140b55a1e600217a01dfa7311f57480365ac188841abcfcf8eb5d',
    clauses: [ability('intelligence', 13), feat(combatExpertise), bab(6)],
    basis: `Prerequisites: Int 13, Combat Expertise, base attack bonus +6. Benefits: "When making a full attack, if you miss on your first attack, you can forgo making any other attacks for the rest of your turn to reroll that attack at your highest base attack bonus"; no eligibility condition. ${combatTrick} ${attacks(5, 'other books: text when no plain Modifier expresses it')}`,
    body: 'text-237',
  },
  {
    key: 'pf1-content/iOq9V3Kidk1c5KLr',
    name: 'Selective Spell',
    sourceSha256:
      '41bc5b0007272eef34f34b1820b589f68601f62417e0d6b46663cd97ad219f1f',
    clauses: [ranks('skill.spl', 10)],
    basis:
      'Prerequisites: Spellcraft 10 ranks. Benefits: "When casting a selective spell with an area effect and a duration of instantaneous, you can choose a number of targets in the area equal to the ability score modifier used to determine bonus spells of the same type"; no eligibility condition.',
    body: 'no-sheet-number',
  },
  {
    key: 'pf1-content/wPsBzXRmPqq1sBH9',
    name: 'Shadow Strike',
    sourceSha256:
      '6be6a3061ce0d85d5c2d1e3773a28a32ce6b5b78e424efd61ccf55961da2215d',
    clauses: [bab(1)],
    basis: `Prerequisites: Base attack bonus +1. Benefits: "You can deal precision damage, such as sneak attack damage, against targets with concealment (but not total concealment)"; no eligibility condition. ${attacks(5, 'other books: text when no plain Modifier expresses it')}`,
    body: 'text-237',
  },
  {
    key: 'pf1-content/j7eMQ1ExZORIO63I',
    name: 'Shield of Swings',
    sourceSha256:
      '72d674f15973830649ad74e4f746fa390abcadfab55a2d7c10de1e9b6fe3fd86',
    clauses: [ability('strength', 13), feat('pf1/FUW5mIXHNBBIQ1Sq'), bab(1)],
    basis:
      'Prerequisites: Str 13, Power Attack, base attack bonus +1. Benefits: "When you take a full-attack action while wielding a two-handed weapon, you can choose to reduce the damage by 1/2 to gain a +4 shield bonus to AC and CMD until the beginning of your next turn"; no eligibility condition. Its +4 shield bonus to AC and CMD are the entry\'s curated conditional Modifiers.',
    body: 'curated-modifiers',
  },
  {
    key: 'pf1/ymtj17MI4MdwB0v2',
    name: 'Shot on the Run',
    sourceSha256:
      '2d044ca67b0284271d65063f9c0091c466ced9a5a5254295c5bc854f306d09e7',
    clauses: [
      ability('dexterity', 13),
      feat(dodge),
      feat('pf1/R7L4SlGRlnThqFrP'),
      feat('pf1/8rsFtye3PwM6CKli'),
      bab(4),
    ],
    basis: `Prerequisites: Dex 13, Dodge, Mobility, Point-Blank Shot, base attack bonus +4. Benefits: "As a full-round action, you can move up to your speed and make a single ranged attack at any point during your movement"; no eligibility condition. ${attacks(6, "feats that change no line's numbers")}`,
    body: 'text-237',
  },
  {
    key: 'pf1-content/gagxv8M42Z8M0hvW',
    name: 'Sidestep',
    sourceSha256:
      '12e9c877a78c3405649ce981ba918102ca6f3e54b6d53ee54fb3a79843e1453a',
    clauses: [
      ability('dexterity', 13),
      feat(dodge),
      feat('pf1/R7L4SlGRlnThqFrP'),
    ],
    basis:
      'Prerequisites: Dex 13, Dodge, Mobility. Benefits: "Whenever an opponent misses you with a melee attack, you may move 5 feet as an immediate action so long as you remain within that opponent\'s threatened area"; no eligibility condition.',
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
    key: 'pf1/3S01BGUthIbp3Hju',
    name: 'Stand Still',
    sourceSha256:
      '03fe2f5bd8dec5d3d3d5bc07e5eb3e069029ade2ae1a98144b60ba1407c05563',
    clauses: [feat('pf1/h9nHYLxXvIXBTmup')],
    basis:
      'Prerequisites: Combat Reflexes. Benefits: "When a foe provokes an attack of opportunity due to moving through your adjacent squares, you can make a combat maneuver check as your attack of opportunity"; no eligibility condition.',
    body: 'no-sheet-number',
  },
  {
    key: 'pf1/Mz8ZG6nqW3NKFZhK',
    name: 'Step Up',
    sourceSha256:
      '26cb9fe205d0f60729b59f5551ccc0e7f56e8a08da98a2cec00bd58796d02f62',
    clauses: [bab(1)],
    basis:
      'Prerequisites: Base attack bonus +1. Benefits: "Whenever an adjacent foe attempts to take a 5-foot step away from you, you may also make a 5-foot step as an immediate action"; no eligibility condition.',
    body: 'no-sheet-number',
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
  {
    key: 'pf1-content/lvhrOXNgrzbnr5SW',
    name: 'Stunning Assault',
    sourceSha256:
      '6d95e45f38824ac237d5edbf1abe7c1ea512260ac8f4147d9e171e93b6142d7c',
    clauses: [ability('strength', 13), feat('pf1/FUW5mIXHNBBIQ1Sq'), bab(16)],
    basis:
      'Prerequisites: Str 13, Power Attack, base attack bonus +16. Benefits: "You can choose to take a -5 penalty on all melee attack rolls and combat maneuver checks to stun targets you hit with your melee attacks for 1 round"; no eligibility condition. Its −5 on melee attack rolls and combat maneuver checks are the entry\'s curated conditional Modifiers.',
    body: 'curated-modifiers',
  },
  {
    key: 'pf1/GsjouI6B8X7BA5wN',
    name: 'Stunning Fist',
    sourceSha256:
      '65dc8b7080aeaf26381073342ae8555fe37cce696c0b86d81ac8b80580217bb1',
    clauses: [
      ability('dexterity', 13),
      ability('wisdom', 13),
      feat(unarmed),
      bab(8),
    ],
    basis: `Prerequisites: Dex 13, Wis 13, Improved Unarmed Strike, base attack bonus +8. Benefits: "You must declare that you are using this feat before you make your attack roll"; no eligibility condition. Its Special lets a monk take it at 1st level without the prerequisites: a class grant, not a condition of selection. ${attacks(6, "feats that change no line's numbers")}`,
    body: 'text-237',
  },
  {
    key: 'pf1/8mS9B8Uc8odklIpl',
    name: 'Trample',
    sourceSha256:
      'cf3dd125f312a44d937c0bec5af70b64fcbf927ab4e4f16635b7d5a7a90b130d',
    clauses: [ride, feat(mountedCombat)],
    basis: `Prerequisites: Ride 1 rank, Mounted Combat. Benefits: "When you attempt to overrun an opponent while mounted, your target may not choose to avoid you"; no eligibility condition. ${attacks(6, "feats that change no line's numbers")}`,
    body: 'text-237',
  },
  {
    key: 'pf1-content/tcBSikJXg2YhVXPF',
    name: 'Trick Riding',
    sourceSha256:
      'deb144787ba07fa2e02d28d14ed14cd16823d665c50298a8c877a2cf369d9f03',
    clauses: [ranks('skill.rid', 9), feat(mountedCombat)],
    basis:
      'Prerequisites: Ride 9 ranks, Mounted Combat. Benefits: "While wearing light or no armor, you do not need to make Ride skill checks for any task listed in the Ride skill with a DC of 15 or lower"; no eligibility condition.',
    body: 'no-sheet-number',
  },
  {
    key: 'pf1/YDqp3yrAsuXh103W',
    name: 'Two-Weapon Defense',
    sourceSha256:
      'babb93f02d41eb37281cab703d2a8dde4cb968aee5ea008bb0fdf500e90fb2f4',
    clauses: [ability('dexterity', 15), feat('pf1/Ee7JHADKEK37tTHs')],
    basis:
      'Prerequisites: Dex 15, Two-Weapon Fighting. Benefits: "When wielding a double weapon or two weapons (not including natural weapons or unarmed strikes), you gain a +1 shield bonus to your AC"; no eligibility condition. Its two shield bonuses are the entry\'s curated conditional Modifiers.',
    body: 'curated-modifiers',
  },
  {
    key: 'pf1/4fAgch4ut1JYPBbL',
    name: 'Unseat',
    sourceSha256:
      'e113c45df3ce68de4f08a17e1e0b8a140afe1279e89433f8987dcebef14686a4',
    clauses: [
      ability('strength', 13),
      ride,
      feat(mountedCombat),
      feat('pf1/FUW5mIXHNBBIQ1Sq'),
      feat('pf1/dn2KgHFQRbuoNRx0'),
      bab(1),
    ],
    basis: `Prerequisites: Str 13, Ride 1 rank, Mounted Combat, Power Attack, Improved Bull Rush, base attack bonus +1. Benefits: "When charging an opponent while mounted and wielding a lance, resolve the attack as normal"; no eligibility condition. Mounted and wielding a lance are conditions of use, not of eligibility. ${attacks(6, "feats that change no line's numbers")}`,
    body: 'text-237',
  },
  {
    key: 'pf1/UnmST9BvRhxT4vq3',
    name: 'Whirlwind Attack',
    sourceSha256:
      '9edae71dcbb686b42b4a4012303ca742fb81f4a9f5026d77fc6114825d8bd126',
    clauses: [
      ability('dexterity', 13),
      ability('intelligence', 13),
      feat(combatExpertise),
      feat(dodge),
      feat('pf1/R7L4SlGRlnThqFrP'),
      feat('pf1/ugQyUpqPBDsqLyra'),
      bab(4),
    ],
    basis: `Prerequisites: Dex 13, Int 13, Combat Expertise, Dodge, Mobility, Spring Attack, base attack bonus +4. Benefits: "When you use the full-attack action, you can give up your regular attacks and instead make one melee attack at your highest base attack bonus against each opponent within reach"; no eligibility condition. ${attacks(6, "feats that change no line's numbers")}`,
    body: 'text-237',
  },
  {
    key: 'pf1/9p0aAtCyLdcwnftS',
    name: 'Wind Stance',
    sourceSha256:
      '1b41ca173c3267c7b907e1ed4868f6111c0bf491e72a99235df2e9bd576c3d86',
    clauses: [ability('dexterity', 15), feat(dodge), bab(6)],
    basis:
      'Prerequisites: Dex 15, Dodge, base attack bonus +6. Benefits: "If you move more than 5 feet this turn, you gain 20% concealment for 1 round against ranged attacks"; no eligibility condition.',
    body: 'no-sheet-number',
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
        '7d2451aac6e980b846e7a5f85f5e4763ef8038e1f2e7d605358930d57449ee38',
    },
    // The public test's fixture, bound as the test is: the coverage tie
    // (`tests/catalog/launch-source-prerequisites.test.ts`) reads it.
    {
      path: 'tests/source-prerequisites-proof.ts',
      sha256:
        'f93f46ae2a43d0c5c5b39d0300c71e31fedcb7def9d75a31a568bf0df6710b3b',
    },
  ],
  calculationIdentity:
    'sha256:406caa629bacef252f34ad4d920c7f07bcd5c54391375dc88ce6462c84d44101',
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
