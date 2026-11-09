// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { prepare, releaseFixture } from '../tests/catalog-release-fixture';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import {
  canonicalReleaseJson,
  parseReleaseJson,
} from '../src/lib/catalog/release-schema';
import {
  calculateCharacterSheet,
  type ResolvedStatistic,
} from '../src/lib/character-sheet';
import type { RequestedSituation } from '../src/lib/character-sheet-situations';
import { candidateDefinition } from './lib/catalogCandidateDefinition';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';

const modules = import.meta.glob('./**/*.ts');

// The Source-body family's public proof (`scripts/catalog/launch-source-body.ts`):
// each output kind a reviewed body is delivered by, as the importer emits it,
// reaches the saved sheet through a Catalog Release, the app's candidate
// conversion and public reads and writes. Situational Modifiers on saves and
// each save, AC (dodge), CMB, CMD, skills, caster level, spell DC,
// concentration, attack and ranged attack and damage stay out of every total
// and are listed in `conditional` with their Situation; the read's own
// Situations apply them, as the client does, trait bonuses highest only
// beside racial ones; situational notes reach the entry or their statistic;
// counting as another race meets a race prerequisite; two favored classes are
// allowed; and a trait Selection's outputs leave the sheet when it is made
// inactive. The bodies are a synthetic fixture shaped as the imported rows
// they name: one race whose standard traits carry the racial outputs, two
// alternates, four feats, nine traits, two classes and two weapons.
const race = 'pf1/sourceBodyProofRace';
const countedRace = 'pf1/sourceBodyProofCountedRace';
const traits = {
  // `ac` +4 dodge in `giants`, and its description note (Defensive Training).
  defensive: 'pf1-content/sourceBodyProofDefensive',
  // `saves` +2 racial in `poison`, `spells` and `spellLike` (Hardy).
  hardy: 'pf1-content/sourceBodyProofHardy',
  // `saves` +2 racial in `enchantment`, and an untargeted note (Elven
  // Immunities).
  immunities: 'pf1-content/sourceBodyProofImmunities',
  // `saves` +2 racial in `fear`, marked to stack within its entry (Fearless).
  fearless: 'pf1-content/sourceBodyProofFearless',
  // `saves` +1 racial, unconditional (Halfling Luck, beside Fearless).
  luck: 'pf1-content/sourceBodyProofLuck',
  // `cmd` +4 racial in `bullRushGround` and `tripGround` (Stability).
  stability: 'pf1-content/sourceBodyProofStability',
  // `skill.apr` +2 racial in a local Situation (Greed).
  greed: 'pf1-content/sourceBodyProofGreed',
  // `skill.per` +2 untyped in a local Situation, and an untargeted note
  // (Stonecunning).
  stonecunning: 'pf1-content/sourceBodyProofStonecunning',
  // `skill.spl` +2 racial in `identifyMagicItems` and `casterLevel` +2
  // racial in `spellResistance` (Elven Magic).
  magic: 'pf1-content/sourceBodyProofMagic',
  // `attack` +1 racial in two local Situations (Hatred).
  hatred: 'pf1-content/sourceBodyProofHatred',
  // A note on `saves` in `fear`: a targeted situational note.
  wary: 'pf1-content/sourceBodyProofWary',
  // `countsAsRaces` (Elf Blood).
  blood: 'pf1-content/sourceBodyProofBlood',
  // `favoredClassCount: 2` (Multitalented).
  multitalented: 'pf1-content/sourceBodyProofMultitalented',
  // `cmb` +2 untyped in `sunder` (Gatecrasher).
  gatecrasher: 'pf1-content/sourceBodyProofGatecrasher',
  // `cmb` +2 untyped in two local Situations (Relentless).
  relentless: 'pf1-content/sourceBodyProofRelentless',
  // `save.fort` +4 racial in a local Situation (Desert Runner).
  desertRunner: 'pf1-content/sourceBodyProofDesertRunner',
  // `ac` +1 dodge and `save.ref` +1 untyped, each in a local Situation
  // (Underfoot).
  underfoot: 'pf1-content/sourceBodyProofUnderfoot',
  // `save.will` +2 racial in a local Situation, and a note on `save.will`
  // (Stubborn).
  stubborn: 'pf1-content/sourceBodyProofStubborn',
  // `skill.crf` and `skill.pro` +2 racial in one local Situation
  // (Craftsman).
  craftsman: 'pf1-content/sourceBodyProofCraftsman',
} as const;
// Traits, chosen as Selections: the `trait` kind and bonus type.
const traitSelections = {
  // `saves` +2 trait in `fear` (Courageous).
  courageous: 'pf1-content/sourceBodyProofCourageous',
  // `saves` +1 trait in a local Situation (History of Heresy).
  heresy: 'pf1-content/sourceBodyProofHeresy',
  // `skill.blf` and `skill.dip` +1 trait in one local Situation and
  // `spellDC` +1 trait in another (Charming).
  charming: 'pf1-content/sourceBodyProofCharming',
  // `skill.dev`, `skill.esc` and `skill.slt` +1 trait, each in its own local
  // Situation (Vagabond Child).
  vagabond: 'pf1-content/sourceBodyProofVagabond',
  // `skill.sen` +5 trait in a local Situation (Canter).
  canter: 'pf1-content/sourceBodyProofCanter',
  // `skill.kpl` +3 trait and `save.will` +2 trait, each in a local Situation
  // (Asmodean Demon Hunter).
  hunter: 'pf1-content/sourceBodyProofHunter',
  // `skill.sur` +4 trait in a local Situation, and a note on `skill.sur`
  // (Starchild).
  starchild: 'pf1-content/sourceBodyProofStarchild',
  // `skill.spl` +2 trait in `identifyMagicItems` (Loreseeker).
  loreseeker: 'pf1-content/sourceBodyProofLoreseeker',
  // `attack` +1 trait in a local Situation (Fencer).
  fencer: 'pf1-content/sourceBodyProofFencer',
} as const;
const alternates = {
  // Replaces the counting trait (as Dual Minded replaces Elf Blood).
  lineage: 'pf1-content/sourceBodyProofLineage',
  // Replaces the favored-class trait (as Arcane Training replaces
  // Multitalented).
  training: 'pf1-content/sourceBodyProofTraining',
} as const;
const feats = {
  // `concentration` +4 untyped in a local Situation (Combat Casting).
  casting: 'pf1/sourceBodyProofCasting',
  // `casterLevel` +2 untyped in `spellResistance` (Spell Penetration).
  penetration: 'pf1/sourceBodyProofPenetration',
  // `attack.ranged` and `damage.ranged` +1 untyped in `within30ft`
  // (Point-Blank Shot).
  pointBlank: 'pf1/sourceBodyProofPointBlank',
  // A feat whose one clause is the counted race.
  counted: 'pf1/sourceBodyProofCounted',
} as const;
const classes = {
  first: 'pf1/sourceBodyProofFirstClass',
  second: 'pf1/sourceBodyProofSecondClass',
} as const;
const weapons = {
  melee: 'pf1/sourceBodyProofSword',
  ranged: 'pf1/sourceBodyProofBow',
} as const;

const local = {
  greed:
    'to determine the price of nonmagical goods containing precious metals or gemstones',
  stonework: 'to notice unusual stonework',
  orcs: 'vs. humanoids of the orc subtype',
  goblinoids: 'vs. humanoids of the goblinoid subtype',
  casting: 'casting defensively or while grappled',
  bullRush:
    'to bull rush an opponent while both you and it are standing on the ground',
  overrun:
    'to overrun an opponent while both you and it are standing on the ground',
  march:
    'to avoid fatigue, exhaustion, or ill effects from running, forced marches, starvation, thirst, or hot or cold environments',
  larger: 'against foes larger than you',
  trample: 'to avoid trample attacks',
  compulsion:
    'vs. spells and spell-like abilities of the enchantment (charm) and enchantment (compulsion) schools',
  craft: 'to create objects from metal or stone',
  heresy:
    'against divine spells, while you have no levels in a class that grants divine spellcasting',
  attracted: 'on a character that is (or could be) sexually attracted to you',
  languageDependent:
    'on language-dependent spells you cast on a character that is (or could be) sexually attracted to you',
  disable: 'if you chose Disable Device',
  escape: 'if you chose Escape Artist',
  sleight: 'if you chose Sleight of Hand',
  message: 'to intercept a secret message',
  demons: 'on Knowledge (planes) checks about demons',
  demonMinds: 'against mind-affecting spells and effects from demons',
  lost: 'to avoid becoming lost',
  opportunity:
    'on attacks of opportunity made with daggers, swords and similar bladed weapons',
};
const sleepNote = 'Immune to magic sleep effects.';
const stoneNote =
  'Receive a Perception check to notice unusual stonework whenever passing within 10 feet, even without actively looking.';
const fearNote = 'Reroll one failed save against fear each day.';
const stubbornNote =
  'If you fail such a save, you receive another save 1 round later to prematurely end the effect.';
const northNote = 'You can automatically determine where true north is.';

type Situation = string | { local: string };
type Modifier = {
  target: string;
  bonusType: string;
  value: number;
  condition?: { situation: Situation };
  stacksWithinEntry?: true;
};
type Note = { text: string; target?: string; situation?: Situation };
type Body = {
  externalKey: string;
  name: string;
  pack: string;
  detail: Record<string, unknown>;
  modifiers?: Modifier[];
  situationalNotes?: Note[];
  countsAsRaces?: string[];
  prerequisites?: unknown[];
  prerequisiteText?: string;
};
const body = ({ externalKey, modifiers = [], ...rest }: Body) => ({
  externalKey,
  upstreamKey: externalKey,
  description: `${rest.name}.`,
  sources: [{ book: 'PZO1110', pages: '1' }],
  modifiers,
  unsupported: [],
  ...rest,
});
/** A Situational Modifier: `<target> <bonus type> <value>` in a Situation. */
const situational = (
  [target, bonusType, value]: [string, string, number],
  situation: Situation,
): Modifier => ({ target, bonusType, value, condition: { situation } });
const racialTrait = (
  externalKey: string,
  name: string,
  change: Omit<Body, 'externalKey' | 'name' | 'pack' | 'detail'> & {
    detail?: Record<string, unknown>;
  } = {},
) =>
  body({
    externalKey,
    name,
    pack: 'racial-traits',
    ...change,
    detail: {
      kind: 'racialTrait',
      bonusSkillRanksPerLevel: 0,
      raceKeys: [race],
      standard: true,
      ...change.detail,
    },
  });
const alternate = (externalKey: string, name: string, replaced: string) =>
  racialTrait(externalKey, name, {
    detail: { standard: false, replaces: [replaced] },
  });
const feat = (
  externalKey: string,
  name: string,
  change: Omit<Body, 'externalKey' | 'name' | 'pack' | 'detail'> = {},
) =>
  body({
    externalKey,
    name,
    pack: 'feats',
    detail: { kind: 'feat', featTypes: ['General'], repeatable: 'no' },
    ...change,
  });
const trait = (
  externalKey: string,
  name: string,
  change: Omit<Body, 'externalKey' | 'name' | 'pack' | 'detail'> = {},
) =>
  body({
    externalKey,
    name,
    pack: 'pf-traits',
    detail: { kind: 'trait', traitType: 'combat' },
    ...change,
  });
const classBody = (externalKey: string, name: string, tag: string) =>
  body({
    externalKey,
    name,
    pack: 'classes',
    detail: {
      kind: 'class',
      tag,
      classKind: 'base',
      hitDie: 10,
      bab: 'full',
      saves: { fort: 'good', ref: 'poor', will: 'poor' },
      classSkills: [],
      skillRanksPerLevel: 2,
      featuresByLevel: [],
      picksByLevel: [],
    },
  });
const weapon = (
  externalKey: string,
  name: string,
  profile: Record<string, unknown>,
) =>
  body({
    externalKey,
    name,
    pack: 'weapons-and-ammo',
    detail: {
      kind: 'item',
      consumable: false,
      price: 15,
      weight: 3,
      weapon: {
        proficiency: 'martial',
        threat: 20,
        mult: 2,
        finesse: false,
        monk: false,
        thrown: false,
        ...profile,
      },
    },
  });

const bodies = [
  body({
    externalKey: race,
    name: 'Source Body Proof Race',
    pack: 'races',
    detail: {
      kind: 'race',
      racialHitDice: 0,
      creatureTypes: ['humanoid'],
      creatureSubtypes: [],
      racialTraits: Object.values(traits),
      size: 'medium',
    },
  }),
  body({
    externalKey: countedRace,
    name: 'Source Body Counted Race',
    pack: 'races',
    detail: {
      kind: 'race',
      racialHitDice: 0,
      creatureTypes: ['humanoid'],
      creatureSubtypes: [],
      racialTraits: [],
      size: 'medium',
    },
  }),
  racialTrait(traits.defensive, 'Proof Defensive Training', {
    modifiers: [situational(['ac', 'dodge', 4], 'giants')],
    situationalNotes: [
      { text: 'Proof dwarves get a +4 dodge bonus to AC against giants.' },
    ],
  }),
  racialTrait(traits.hardy, 'Proof Hardy', {
    modifiers: ['poison', 'spells', 'spellLike'].map((situation) =>
      situational(['saves', 'racial', 2], situation),
    ),
  }),
  racialTrait(traits.immunities, 'Proof Immunities', {
    modifiers: [situational(['saves', 'racial', 2], 'enchantment')],
    situationalNotes: [{ text: sleepNote }],
  }),
  racialTrait(traits.fearless, 'Proof Fearless', {
    modifiers: [
      {
        ...situational(['saves', 'racial', 2], 'fear'),
        stacksWithinEntry: true,
      },
    ],
  }),
  racialTrait(traits.luck, 'Proof Luck', {
    modifiers: [{ target: 'saves', bonusType: 'racial', value: 1 }],
  }),
  racialTrait(traits.stability, 'Proof Stability', {
    modifiers: ['bullRushGround', 'tripGround'].map((situation) =>
      situational(['cmd', 'racial', 4], situation),
    ),
  }),
  racialTrait(traits.greed, 'Proof Greed', {
    modifiers: [
      situational(['skill.apr', 'racial', 2], { local: local.greed }),
    ],
  }),
  racialTrait(traits.stonecunning, 'Proof Stonecunning', {
    modifiers: [
      situational(['skill.per', 'untyped', 2], { local: local.stonework }),
    ],
    situationalNotes: [{ text: stoneNote }],
  }),
  racialTrait(traits.magic, 'Proof Magic', {
    modifiers: [
      situational(['skill.spl', 'racial', 2], 'identifyMagicItems'),
      situational(['casterLevel', 'racial', 2], 'spellResistance'),
    ],
  }),
  racialTrait(traits.hatred, 'Proof Hatred', {
    modifiers: [
      situational(['attack', 'racial', 1], { local: local.orcs }),
      situational(['attack', 'racial', 1], { local: local.goblinoids }),
    ],
  }),
  racialTrait(traits.wary, 'Proof Wary', {
    situationalNotes: [{ target: 'saves', situation: 'fear', text: fearNote }],
  }),
  racialTrait(traits.blood, 'Proof Blood', { countsAsRaces: [countedRace] }),
  racialTrait(traits.multitalented, 'Proof Multitalented', {
    detail: { favoredClassCount: 2 },
  }),
  racialTrait(traits.gatecrasher, 'Proof Gatecrasher', {
    modifiers: [situational(['cmb', 'untyped', 2], 'sunder')],
  }),
  racialTrait(traits.relentless, 'Proof Relentless', {
    modifiers: [local.bullRush, local.overrun].map((name) =>
      situational(['cmb', 'untyped', 2], { local: name }),
    ),
  }),
  racialTrait(traits.desertRunner, 'Proof Desert Runner', {
    modifiers: [
      situational(['save.fort', 'racial', 4], { local: local.march }),
    ],
  }),
  racialTrait(traits.underfoot, 'Proof Underfoot', {
    modifiers: [
      situational(['ac', 'dodge', 1], { local: local.larger }),
      situational(['save.ref', 'untyped', 1], { local: local.trample }),
    ],
  }),
  racialTrait(traits.stubborn, 'Proof Stubborn', {
    modifiers: [
      situational(['save.will', 'racial', 2], { local: local.compulsion }),
    ],
    situationalNotes: [{ target: 'save.will', text: stubbornNote }],
  }),
  racialTrait(traits.craftsman, 'Proof Craftsman', {
    modifiers: (['skill.crf', 'skill.pro'] as const).map((target) =>
      situational([target, 'racial', 2], { local: local.craft }),
    ),
  }),
  trait(traitSelections.courageous, 'Proof Courageous', {
    modifiers: [situational(['saves', 'trait', 2], 'fear')],
  }),
  trait(traitSelections.heresy, 'Proof Heresy', {
    modifiers: [situational(['saves', 'trait', 1], { local: local.heresy })],
  }),
  trait(traitSelections.charming, 'Proof Charming', {
    modifiers: [
      situational(['skill.blf', 'trait', 1], { local: local.attracted }),
      situational(['skill.dip', 'trait', 1], { local: local.attracted }),
      situational(['spellDC', 'trait', 1], { local: local.languageDependent }),
    ],
  }),
  trait(traitSelections.vagabond, 'Proof Vagabond', {
    modifiers: [
      situational(['skill.dev', 'trait', 1], { local: local.disable }),
      situational(['skill.esc', 'trait', 1], { local: local.escape }),
      situational(['skill.slt', 'trait', 1], { local: local.sleight }),
    ],
  }),
  trait(traitSelections.canter, 'Proof Canter', {
    modifiers: [
      situational(['skill.sen', 'trait', 5], { local: local.message }),
    ],
  }),
  trait(traitSelections.hunter, 'Proof Hunter', {
    modifiers: [
      situational(['skill.kpl', 'trait', 3], { local: local.demons }),
      situational(['save.will', 'trait', 2], { local: local.demonMinds }),
    ],
  }),
  trait(traitSelections.starchild, 'Proof Starchild', {
    modifiers: [situational(['skill.sur', 'trait', 4], { local: local.lost })],
    situationalNotes: [{ target: 'skill.sur', text: northNote }],
  }),
  trait(traitSelections.loreseeker, 'Proof Loreseeker', {
    modifiers: [situational(['skill.spl', 'trait', 2], 'identifyMagicItems')],
  }),
  trait(traitSelections.fencer, 'Proof Fencer', {
    modifiers: [
      situational(['attack', 'trait', 1], { local: local.opportunity }),
    ],
  }),
  alternate(alternates.lineage, 'Proof Lineage', traits.blood),
  alternate(alternates.training, 'Proof Training', traits.multitalented),
  feat(feats.casting, 'Proof Casting', {
    modifiers: [
      situational(['concentration', 'untyped', 4], { local: local.casting }),
    ],
  }),
  feat(feats.penetration, 'Proof Penetration', {
    modifiers: [situational(['casterLevel', 'untyped', 2], 'spellResistance')],
  }),
  feat(feats.pointBlank, 'Proof Point-Blank', {
    modifiers: [
      situational(['attack.ranged', 'untyped', 1], 'within30ft'),
      situational(['damage.ranged', 'untyped', 1], 'within30ft'),
    ],
  }),
  feat(feats.counted, 'Proof Counted', {
    prerequisiteText: 'Source Body Counted Race',
    prerequisites: [{ race: [countedRace], kind: 'race' }],
  }),
  classBody(classes.first, 'Proof First Class', 'sourceBodyProofFirst'),
  classBody(classes.second, 'Proof Second Class', 'sourceBodyProofSecond'),
  weapon(weapons.melee, 'Proof Sword', {
    baseType: 'Longsword',
    groups: ['bladesHeavy'],
    handedness: 'oneHanded',
    attackType: 'melee',
    dice: '1d8',
    damageTypes: ['slashing'],
    strengthDamage: 'melee',
  }),
  weapon(weapons.ranged, 'Proof Bow', {
    baseType: 'Shortbow',
    groups: ['bows'],
    handedness: 'twoHanded',
    attackType: 'ranged',
    dice: '1d6',
    damageTypes: ['piercing'],
    rangeIncrement: 60,
    strengthDamage: 'bow',
    reload: 'free',
  }),
];

/**
 * Inserts the stored identity a body starts from, before the release: the
 * stored class is a half-BAB class, so its full BAB comes from the release.
 */
function insertIdentity(
  ctx: MutationCtx,
  { externalKey, name, detail }: (typeof bodies)[number],
) {
  const identity = {
    scope: 'global' as const,
    name,
    ruleIdentity: externalKey,
    modifiers: [],
    sources: [],
    stacksWithItself: false,
  };
  switch (detail.kind) {
    case 'race':
      return ctx.db.insert('catalogEntry', {
        ...identity,
        detail: { kind: 'race', racialHitDice: 0, racialTraits: [] },
      });
    case 'racialTrait':
      return ctx.db.insert('catalogEntry', {
        ...identity,
        detail: { kind: 'racialTrait', raceEntryIds: [], replaces: [] },
      });
    case 'feat':
      return ctx.db.insert('catalogEntry', {
        ...identity,
        detail: { kind: 'feat' },
      });
    case 'trait':
      return ctx.db.insert('catalogEntry', {
        ...identity,
        detail: { kind: 'trait' },
      });
    case 'item':
      return ctx.db.insert('catalogEntry', {
        ...identity,
        detail: { kind: 'item', consumable: false },
      });
    default:
      return ctx.db.insert('catalogEntry', {
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
      });
  }
}

/**
 * The bodies through a prepared Catalog Release and the app's candidate
 * conversion (as `characterSheetModifiers.integration.test.ts` installs
 * them), and a Character of one level in each class with every score 10,
 * the race chosen and both weapons carried.
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
    for (const entry of bodies)
      ids[entry.externalKey] = await insertIdentity(ctx, entry);
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
  const first = (await read()).entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (!first) throw new Error('Missing first Class Level');
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: id(classes.first),
    operationId: 'level-1',
  });
  const second = await member.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: id(classes.second),
    operationId: 'level-2',
  });
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    operationId: 'scores',
  });
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: id(race),
    operationId: 'race',
  });
  const select = (key: string) =>
    member.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: id(key),
      operationId: `select-${key}`,
    });
  const sword = await select(weapons.melee);
  const bow = await select(weapons.ranged);
  return {
    owner,
    member,
    outsider,
    scope,
    id,
    read,
    select,
    levels: [first._id, second],
    sword,
    bow,
  };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;
type Sheet = Awaited<ReturnType<Fixture['read']>>;
type Statistic = Pick<ResolvedStatistic, 'total' | 'conditional'>;

/** A source's conditional contributions to a statistic, with their Situations. */
function conditionalOf(statistic: Statistic, key: string) {
  return statistic.conditional
    .filter((row) => row.source === key)
    .map(({ value, bonusType, condition }) => ({
      value,
      bonusType,
      situation: condition?.situation,
    }));
}

/**
 * Every Situation the read lists in `conditional`, as the client requests
 * it: a shared key as it is, a local one with its sheet entry.
 */
function listedSituations(sheet: Sheet): RequestedSituation[] {
  const { breakdowns, derivedStatistics, attackRoutines } = sheet.calculated;
  const statistics: Statistic[] = [
    ...Object.values(breakdowns),
    ...Object.values(derivedStatistics),
    ...attackRoutines.flatMap((routine) =>
      routine.single.flatMap((line) => [line.attackBonus, line.damageBonus]),
    ),
  ];
  const found = new Map<string, RequestedSituation>();
  for (const { conditional } of statistics)
    for (const { condition, sheetEntryId } of conditional) {
      const situation = condition?.situation;
      if (typeof situation === 'string') found.set(situation, situation);
      else if (situation && 'local' in situation)
        found.set(`${sheetEntryId}:${situation.local}`, {
          local: situation.local,
          sheetEntryId,
        });
    }
  return [...found.values()];
}

/** The sheet as if these Situations held, from one read's own data. */
function resolved(sheet: Sheet, situations: readonly RequestedSituation[]) {
  return calculateCharacterSheet(
    { ...sheet, characterKind: sheet.character.kind },
    { situations: [...situations] },
  );
}
type Calculated = ReturnType<typeof resolved> | Sheet['calculated'];

/** The totals the family's situational Modifiers reach. */
function totals(calculated: Calculated) {
  const { breakdowns, derivedStatistics: statistics } = calculated;
  return {
    fortitude: statistics.fortitude.total,
    reflex: statistics.reflex.total,
    will: statistics.will.total,
    ac: statistics.ac.total,
    touchAc: statistics.touchAc.total,
    flatFootedAc: statistics.flatFootedAc.total,
    cmd: statistics.cmd.total,
    appraise: breakdowns['skill.apr'].total,
    perception: breakdowns['skill.per'].total,
    spellcraft: breakdowns['skill.spl'].total,
    casterLevel: breakdowns.casterLevel.total,
    concentration: breakdowns.concentration.total,
    cmb: statistics.cmb.total,
    craft: breakdowns['skill.crf'].total,
    profession: breakdowns['skill.pro'].total,
    bluff: breakdowns['skill.blf'].total,
    diplomacy: breakdowns['skill.dip'].total,
    disableDevice: breakdowns['skill.dev'].total,
    escapeArtist: breakdowns['skill.esc'].total,
    sleightOfHand: breakdowns['skill.slt'].total,
    senseMotive: breakdowns['skill.sen'].total,
    knowledgePlanes: breakdowns['skill.kpl'].total,
    survival: breakdowns['skill.sur'].total,
    spellDC: breakdowns.spellDC.total,
  };
}

/** One weapon's first single-attack line. */
function line(calculated: Calculated, weaponEntryId: string) {
  const found = calculated.attackRoutines.find(
    (routine) => routine.weaponEntryId === weaponEntryId,
  )?.single[0];
  if (!found) throw new Error(`Missing a routine for ${weaponEntryId}`);
  return found;
}

/** The requested Situation a source's local Situation is, on this read. */
function localSituation(
  statistic: Statistic,
  key: string,
  name: string,
): RequestedSituation {
  const row = statistic.conditional.find(
    ({ source, condition }) =>
      source === key &&
      typeof condition?.situation === 'object' &&
      'local' in condition.situation &&
      condition.situation.local === name,
  );
  if (!row) throw new Error(`Missing the local Situation ${name}`);
  return { local: name, sheetEntryId: row.sheetEntryId };
}

test('situational Modifiers stay out of every total and are listed in conditional with their Situation', async () => {
  const { read, select } = await fixture();
  const raced = await read();
  for (const key of [feats.casting, feats.penetration, feats.pointBlank])
    await select(key);
  const sheet = await read();
  const { breakdowns, derivedStatistics: statistics } = sheet.calculated;
  // Only the unconditional +1 racial on saves enters a total, and the feats
  // change none.
  expect(totals(sheet.calculated)).toEqual(totals(raced.calculated));
  expect(
    statistics.will.applied
      .filter(({ source }) => source?.startsWith('pf1'))
      .map(({ source, value }) => [source, value]),
  ).toEqual([[traits.luck, 1]]);
  for (const save of ['fortitude', 'reflex', 'will'] as const) {
    expect(conditionalOf(statistics[save], traits.hardy), save).toEqual(
      ['poison', 'spells', 'spellLike'].map((situation) => ({
        value: 2,
        bonusType: 'racial',
        situation,
      })),
    );
    expect(conditionalOf(statistics[save], traits.immunities)).toEqual([
      { value: 2, bonusType: 'racial', situation: 'enchantment' },
    ]);
    expect(conditionalOf(statistics[save], traits.fearless)).toEqual([
      { value: 2, bonusType: 'racial', situation: 'fear' },
    ]);
  }
  // The dodge bonus is listed on AC, touch AC and CMD, never flat-footed AC.
  const giants = [{ value: 4, bonusType: 'dodge', situation: 'giants' }];
  expect(conditionalOf(statistics.ac, traits.defensive)).toEqual(giants);
  expect(conditionalOf(statistics.touchAc, traits.defensive)).toEqual(giants);
  expect(conditionalOf(statistics.cmd, traits.defensive)).toEqual(giants);
  expect(conditionalOf(statistics.flatFootedAc, traits.defensive)).toEqual([]);
  expect(conditionalOf(statistics.cmd, traits.stability)).toEqual(
    ['bullRushGround', 'tripGround'].map((situation) => ({
      value: 4,
      bonusType: 'racial',
      situation,
    })),
  );
  expect(conditionalOf(breakdowns['skill.apr'], traits.greed)).toEqual([
    { value: 2, bonusType: 'racial', situation: { local: local.greed } },
  ]);
  expect(conditionalOf(breakdowns['skill.per'], traits.stonecunning)).toEqual([
    { value: 2, bonusType: 'untyped', situation: { local: local.stonework } },
  ]);
  expect(conditionalOf(breakdowns['skill.spl'], traits.magic)).toEqual([
    { value: 2, bonusType: 'racial', situation: 'identifyMagicItems' },
  ]);
  expect(conditionalOf(breakdowns.casterLevel, traits.magic)).toEqual([
    { value: 2, bonusType: 'racial', situation: 'spellResistance' },
  ]);
  expect(conditionalOf(breakdowns.casterLevel, feats.penetration)).toEqual([
    { value: 2, bonusType: 'untyped', situation: 'spellResistance' },
  ]);
  expect(conditionalOf(breakdowns.concentration, feats.casting)).toEqual([
    { value: 4, bonusType: 'untyped', situation: { local: local.casting } },
  ]);
  const hatred = [local.orcs, local.goblinoids].map((name) => ({
    value: 1,
    bonusType: 'racial',
    situation: { local: name },
  }));
  expect(conditionalOf(breakdowns['attack.melee'], traits.hatred)).toEqual(
    hatred,
  );
  expect(conditionalOf(breakdowns['attack.ranged'], traits.hatred)).toEqual(
    hatred,
  );
  const within = [{ value: 1, bonusType: 'untyped', situation: 'within30ft' }];
  expect(conditionalOf(breakdowns['attack.ranged'], feats.pointBlank)).toEqual(
    within,
  );
  expect(conditionalOf(breakdowns['damage.ranged'], feats.pointBlank)).toEqual(
    within,
  );
  expect(conditionalOf(breakdowns['attack.melee'], feats.pointBlank)).toEqual(
    [],
  );
  expect(conditionalOf(breakdowns['damage.melee'], feats.pointBlank)).toEqual(
    [],
  );
});

test('the read’s own Situations apply them: AC reaches touch AC and CMD, one entry’s Situations never stack, separate traits do, and caster level rises only against spell resistance', async () => {
  const { read, select } = await fixture();
  for (const key of [feats.casting, feats.penetration]) await select(key);
  const sheet = await read();
  const base = totals(sheet.calculated);
  const { breakdowns } = sheet.calculated;
  const under = (...situations: RequestedSituation[]) =>
    totals(resolved(sheet, situations));
  // The listed Situations, and nothing applies with none of them.
  expect(listedSituations(sheet)).toEqual(
    expect.arrayContaining([
      'giants',
      'poison',
      'spells',
      'spellLike',
      'enchantment',
      'fear',
      'bullRushGround',
      'tripGround',
      'identifyMagicItems',
      'spellResistance',
    ]),
  );
  expect(under()).toEqual(base);
  // +4 dodge against giants: AC, touch AC and CMD, never flat-footed AC.
  expect(under('giants')).toEqual({
    ...base,
    ac: base.ac + 4,
    touchAc: base.touchAc + 4,
    cmd: base.cmd + 4,
  });
  // One entry's Situations: +2 against poison, and still +2 against a
  // poisonous spell.
  const saves = (change: number) => ({
    fortitude: base.fortitude + change,
    reflex: base.reflex + change,
    will: base.will + change,
  });
  expect(under('poison')).toEqual({ ...base, ...saves(2) });
  expect(under('poison', 'spells', 'spellLike')).toEqual({
    ...base,
    ...saves(2),
  });
  expect(under('enchantment')).toEqual({ ...base, ...saves(2) });
  // Separate traits stack: Fearless's +2 against fear beside the
  // unconditional +1 already in the total, +3 in all, and Hardy's +2
  // against a frightening poison.
  expect(under('fear')).toEqual({ ...base, ...saves(2) });
  const racialOn = (calculated: Calculated) =>
    calculated.derivedStatistics.will.applied
      .filter(({ bonusType }) => bonusType === 'racial')
      .map(({ source, value }) => [source, value]);
  expect(racialOn(sheet.calculated)).toEqual([[traits.luck, 1]]);
  expect(racialOn(resolved(sheet, ['fear'])).sort()).toEqual(
    [
      [traits.luck, 1],
      [traits.fearless, 2],
    ].sort(),
  );
  expect(under('fear', 'poison')).toEqual({ ...base, ...saves(4) });
  // +4 CMD in either ground Situation, and +4 with both.
  expect(under('bullRushGround')).toEqual({ ...base, cmd: base.cmd + 4 });
  expect(under('tripGround')).toEqual({ ...base, cmd: base.cmd + 4 });
  expect(under('bullRushGround', 'tripGround')).toEqual({
    ...base,
    cmd: base.cmd + 4,
  });
  expect(under('giants', 'tripGround')).toEqual({
    ...base,
    ac: base.ac + 4,
    touchAc: base.touchAc + 4,
    cmd: base.cmd + 8,
  });
  // Skills, each in its own Situation, local ones with their entry.
  expect(
    under(localSituation(breakdowns['skill.apr'], traits.greed, local.greed)),
  ).toEqual({ ...base, appraise: base.appraise + 2 });
  expect(
    under(
      localSituation(
        breakdowns['skill.per'],
        traits.stonecunning,
        local.stonework,
      ),
    ),
  ).toEqual({ ...base, perception: base.perception + 2 });
  expect(under('identifyMagicItems')).toEqual({
    ...base,
    spellcraft: base.spellcraft + 2,
  });
  // A local Situation named alike on another entry matches nothing.
  expect(under({ local: local.greed, sheetEntryId: 'another-entry' })).toEqual(
    base,
  );
  // Caster level: +2 racial and +2 untyped stack, against spell resistance
  // only; the ordinary caster level is unchanged, in any other Situation.
  expect(under('spellResistance')).toEqual({
    ...base,
    casterLevel: base.casterLevel + 4,
  });
  expect(under('spells', 'identifyMagicItems').casterLevel).toBe(
    base.casterLevel,
  );
  expect(
    under(
      localSituation(breakdowns.concentration, feats.casting, local.casting),
    ),
  ).toEqual({ ...base, concentration: base.concentration + 4 });
});

test('routine lines carry the attack and ranged Modifiers in their Situations', async () => {
  const { read, select, sword, bow } = await fixture();
  await select(feats.pointBlank);
  const sheet = await read();
  const { breakdowns } = sheet.calculated;
  const lines = (situations: RequestedSituation[]) => {
    const calculated = resolved(sheet, situations);
    return {
      swordAttack: line(calculated, sword).attackBonus.total,
      swordDamage: line(calculated, sword).damageBonus.total,
      bowAttack: line(calculated, bow).attackBonus.total,
      bowDamage: line(calculated, bow).damageBonus.total,
    };
  };
  const base = lines([]);
  expect({
    swordAttack: line(sheet.calculated, sword).attackBonus.total,
    swordDamage: line(sheet.calculated, sword).damageBonus.total,
    bowAttack: line(sheet.calculated, bow).attackBonus.total,
    bowDamage: line(sheet.calculated, bow).damageBonus.total,
  }).toEqual(base);
  // Each line lists its Modifiers in their Situations.
  const hatred = [local.orcs, local.goblinoids].map((name) => ({
    value: 1,
    bonusType: 'racial',
    situation: { local: name },
  }));
  const within = [{ value: 1, bonusType: 'untyped', situation: 'within30ft' }];
  expect(
    conditionalOf(line(sheet.calculated, sword).attackBonus, traits.hatred),
  ).toEqual(hatred);
  expect(
    conditionalOf(line(sheet.calculated, bow).attackBonus, traits.hatred),
  ).toEqual(hatred);
  expect(
    conditionalOf(line(sheet.calculated, bow).attackBonus, feats.pointBlank),
  ).toEqual(within);
  expect(
    conditionalOf(line(sheet.calculated, bow).damageBonus, feats.pointBlank),
  ).toEqual(within);
  expect(
    conditionalOf(line(sheet.calculated, sword).attackBonus, feats.pointBlank),
  ).toEqual([]);
  // Against an orc: +1 on every line's attack; two of the entry's
  // Situations together are still +1.
  const orcs = localSituation(
    breakdowns['attack.melee'],
    traits.hatred,
    local.orcs,
  );
  const goblinoids = localSituation(
    breakdowns['attack.melee'],
    traits.hatred,
    local.goblinoids,
  );
  expect(lines([orcs])).toEqual({
    ...base,
    swordAttack: base.swordAttack + 1,
    bowAttack: base.bowAttack + 1,
  });
  expect(lines([orcs, goblinoids])).toEqual(lines([orcs]));
  // Within 30 feet: +1 attack and +1 damage on ranged lines only.
  expect(lines(['within30ft'])).toEqual({
    ...base,
    bowAttack: base.bowAttack + 1,
    bowDamage: base.bowDamage + 1,
  });
  expect(lines(['within30ft', orcs])).toEqual({
    ...base,
    swordAttack: base.swordAttack + 1,
    bowAttack: base.bowAttack + 2,
    bowDamage: base.bowDamage + 1,
  });
});

test('untargeted notes reach the entry and a targeted note its statistic, changing no number', async () => {
  const { read } = await fixture();
  const sheet = await read();
  const { entryNotes, derivedStatistics, breakdowns } = sheet.calculated;
  expect(
    entryNotes
      .filter(({ text }) => [sleepNote, stoneNote].includes(text))
      .map(({ source, text }) => [source, text]),
  ).toEqual([
    [traits.immunities, sleepNote],
    [traits.stonecunning, stoneNote],
  ]);
  expect(entryNotes.some(({ text }) => text === fearNote)).toBe(false);
  for (const save of ['save.fort', 'save.ref', 'save.will'] as const)
    expect(
      (breakdowns[save].notes ?? []).map(({ source, situation, text }) => ({
        source,
        situation,
        text,
      })),
      save,
    ).toEqual([
      { source: traits.wary, situation: 'fear', text: fearNote },
      // A note on one save reaches that save only.
      ...(save === 'save.will'
        ? [
            {
              source: traits.stubborn,
              situation: undefined,
              text: stubbornNote,
            },
          ]
        : []),
    ]);
  expect(totals(resolved(sheet, ['fear'])).will).toBe(
    derivedStatistics.will.total + 2,
  );
});

test('counting as another race meets a race prerequisite only while the trait is active', async () => {
  const { member, scope, read, select, id } = await fixture();
  const counted = await select(feats.counted);
  const met = async () =>
    (await read()).calculated.prerequisites
      .filter((row) => row.entryId === counted && row.view === 'current')
      .map((row) => row.met);
  expect((await read()).calculated.racial.countsAsRaces).toContain(countedRace);
  expect(await met()).toEqual([true]);
  // The alternate replaces the counting trait: the clause is unmet.
  const lineage = (selected: boolean, operationId: string) =>
    member.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: id(alternates.lineage),
      selected,
      operationId,
    });
  await lineage(true, 'lineage');
  expect((await read()).calculated.racial.countsAsRaces).not.toContain(
    countedRace,
  );
  expect(await met()).toEqual([false]);
  expect(
    (await read()).calculated.warnings.filter((warning) =>
      warning.check.startsWith('prerequisites.'),
    ),
  ).not.toEqual([]);
  // Restored, it is met again.
  await lineage(false, 'restore');
  expect(await met()).toEqual([true]);
});

test('two favored classes are allowed only with the trait, and a favored class bonus on either class counts', async () => {
  const { member, scope, read, id, levels } = await fixture();
  const [firstLevel, secondLevel] = levels;
  if (!firstLevel || !secondLevel) throw new Error('Missing Class Levels');
  const checks = (sheet: Sheet) =>
    sheet.calculated.warnings
      .map(({ check }) => check)
      .filter((check) => check.startsWith('favoredClass'))
      .sort();
  const hp = (sheet: Sheet) => sheet.calculated.breakdowns.hp.total;
  const before = await read();
  await member.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    settings: {},
    favoredClassIds: [id(classes.first), id(classes.second)],
    operationId: 'favored',
  });
  for (const [entryId, operationId] of [
    [firstLevel, 'bonus-1'],
    [secondLevel, 'bonus-2'],
  ] as const)
    await member.mutation(api.characterSheet.editClassLevel, {
      ...scope,
      entryId,
      favoredClassBonus: { choice: 'hp' },
      operationId,
    });
  const favored = await read();
  expect(favored.calculated.racial.favoredClassCount).toBe(2);
  // Both levels' +1 HP count, with no count or "not favored" warning.
  expect(checks(favored)).toEqual([]);
  expect(hp(favored)).toBe(hp(before) + 2);
  // The alternate replaces the trait: one favored class only.
  await member.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: id(alternates.training),
    selected: true,
    operationId: 'training',
  });
  const single = await read();
  expect(single.calculated.racial.favoredClassCount).toBe(1);
  expect(checks(single)).toContain('favoredClassCount');
});

/** Each trait chosen as a Selection, and their sheet entries. */
async function withTraits({ select }: Fixture) {
  const entries: Record<string, string> = {};
  for (const key of Object.values(traitSelections))
    entries[key] = await select(key);
  return entries;
}

test('cmb, save, skill and spell DC Modifiers and trait Selections’ trait bonuses stay out of every total and are listed in conditional with their Situation', async () => {
  const f = await fixture();
  const raced = await f.read();
  await withTraits(f);
  const sheet = await f.read();
  const { breakdowns, derivedStatistics: statistics } = sheet.calculated;
  expect(totals(sheet.calculated)).toEqual(totals(raced.calculated));
  const listed = (value: number, bonusType: string, situation: Situation) => [
    { value, bonusType, situation },
  ];
  const at = (name: string) => ({ local: name });
  // CMB, never CMD.
  expect(conditionalOf(statistics.cmb, traits.gatecrasher)).toEqual(
    listed(2, 'untyped', 'sunder'),
  );
  expect(conditionalOf(statistics.cmb, traits.relentless)).toEqual(
    [local.bullRush, local.overrun].map((name) => ({
      value: 2,
      bonusType: 'untyped',
      situation: at(name),
    })),
  );
  for (const key of [traits.gatecrasher, traits.relentless])
    expect(conditionalOf(statistics.cmd, key)).toEqual([]);
  // A save target reaches its own save only.
  const saves = ['fortitude', 'reflex', 'will'] as const;
  for (const [key, save, value, bonusType, name] of [
    [traits.desertRunner, 'fortitude', 4, 'racial', local.march],
    [traits.underfoot, 'reflex', 1, 'untyped', local.trample],
    [traits.stubborn, 'will', 2, 'racial', local.compulsion],
    [traitSelections.hunter, 'will', 2, 'trait', local.demonMinds],
  ] as const)
    for (const other of saves)
      expect(conditionalOf(statistics[other], key), `${key} ${other}`).toEqual(
        other === save ? listed(value, bonusType, at(name)) : [],
      );
  // Trait bonuses on every save, in a shared and a local Situation.
  for (const save of saves) {
    expect(conditionalOf(statistics[save], traitSelections.courageous)).toEqual(
      listed(2, 'trait', 'fear'),
    );
    expect(conditionalOf(statistics[save], traitSelections.heresy)).toEqual(
      listed(1, 'trait', at(local.heresy)),
    );
  }
  // Skills: each target its own skill.
  for (const [target, key, value, bonusType, name] of [
    ['skill.crf', traits.craftsman, 2, 'racial', local.craft],
    ['skill.pro', traits.craftsman, 2, 'racial', local.craft],
    ['skill.blf', traitSelections.charming, 1, 'trait', local.attracted],
    ['skill.dip', traitSelections.charming, 1, 'trait', local.attracted],
    ['skill.dev', traitSelections.vagabond, 1, 'trait', local.disable],
    ['skill.esc', traitSelections.vagabond, 1, 'trait', local.escape],
    ['skill.slt', traitSelections.vagabond, 1, 'trait', local.sleight],
    ['skill.sen', traitSelections.canter, 5, 'trait', local.message],
    ['skill.kpl', traitSelections.hunter, 3, 'trait', local.demons],
    ['skill.sur', traitSelections.starchild, 4, 'trait', local.lost],
  ] as const)
    expect(conditionalOf(breakdowns[target], key), target).toEqual(
      listed(value, bonusType, at(name)),
    );
  expect(
    conditionalOf(breakdowns['skill.spl'], traitSelections.loreseeker),
  ).toEqual(listed(2, 'trait', 'identifyMagicItems'));
  // Spell DC: Charming's spell clause, not its skill one.
  expect(conditionalOf(breakdowns.spellDC, traitSelections.charming)).toEqual(
    listed(1, 'trait', at(local.languageDependent)),
  );
  // A trait's attack bonus on melee and ranged attacks.
  for (const target of ['attack.melee', 'attack.ranged'] as const)
    expect(conditionalOf(breakdowns[target], traitSelections.fencer)).toEqual(
      listed(1, 'trait', at(local.opportunity)),
    );
});

test('the read’s own Situations apply them: CMB per maneuver, a save target on its save only, trait bonuses highest-only beside racial ones, and spell DC', async () => {
  const f = await fixture();
  await withTraits(f);
  const sheet = await f.read();
  const base = totals(sheet.calculated);
  const { breakdowns, derivedStatistics: statistics } = sheet.calculated;
  const under = (...situations: RequestedSituation[]) =>
    totals(resolved(sheet, situations));
  const at = (statistic: Statistic, key: string, name: string) =>
    localSituation(statistic, key, name);
  expect(under()).toEqual(base);
  // CMB: +2 to sunder; Relentless's two Situations are one +2; separate
  // untyped bonuses stack. CMD is unchanged.
  const bullRush = at(statistics.cmb, traits.relentless, local.bullRush);
  const overrun = at(statistics.cmb, traits.relentless, local.overrun);
  expect(under('sunder')).toEqual({ ...base, cmb: base.cmb + 2 });
  expect(under(bullRush)).toEqual({ ...base, cmb: base.cmb + 2 });
  expect(under(bullRush, overrun)).toEqual({ ...base, cmb: base.cmb + 2 });
  expect(under('sunder', bullRush)).toEqual({ ...base, cmb: base.cmb + 4 });
  // Each save target raises its own save only.
  expect(
    under(at(statistics.fortitude, traits.desertRunner, local.march)),
  ).toEqual({ ...base, fortitude: base.fortitude + 4 });
  expect(under(at(statistics.reflex, traits.underfoot, local.trample))).toEqual(
    { ...base, reflex: base.reflex + 1 },
  );
  expect(under(at(statistics.will, traits.stubborn, local.compulsion))).toEqual(
    { ...base, will: base.will + 2 },
  );
  // Underfoot's dodge bonus: AC, touch AC and CMD.
  expect(under(at(statistics.ac, traits.underfoot, local.larger))).toEqual({
    ...base,
    ac: base.ac + 1,
    touchAc: base.touchAc + 1,
    cmd: base.cmd + 1,
  });
  // Trait bonuses: against fear, Courageous's +2 trait stacks with
  // Fearless's +2 racial; History of Heresy's +1 trait alone is +1, and
  // beside Courageous only the higher trait bonus applies.
  const allSaves = (change: number) => ({
    fortitude: base.fortitude + change,
    reflex: base.reflex + change,
    will: base.will + change,
  });
  const heresy = at(statistics.will, traitSelections.heresy, local.heresy);
  expect(under('fear')).toEqual({ ...base, ...allSaves(4) });
  expect(under(heresy)).toEqual({ ...base, ...allSaves(1) });
  expect(under('fear', heresy)).toEqual({ ...base, ...allSaves(4) });
  const traitOn = (calculated: Calculated) =>
    calculated.derivedStatistics.will.applied
      .filter(({ bonusType }) => bonusType === 'trait')
      .map(({ source, value }) => [source, value]);
  const both = resolved(sheet, ['fear', heresy]);
  expect(traitOn(both)).toEqual([[traitSelections.courageous, 2]]);
  expect(
    both.derivedStatistics.will.suppressed
      .filter(({ bonusType }) => bonusType === 'trait')
      .map(({ source, value }) => [source, value]),
  ).toEqual([[traitSelections.heresy, 1]]);
  // Two trait Situations on Will: the higher +2, not +4.
  const demonMinds = at(
    statistics.will,
    traitSelections.hunter,
    local.demonMinds,
  );
  expect(under(demonMinds)).toEqual({ ...base, will: base.will + 2 });
  expect(under(demonMinds, heresy)).toEqual({
    ...base,
    ...allSaves(1),
    will: base.will + 2,
  });
  // Skills, each in its own Situation; Craftsman's one Situation reaches
  // Craft and Profession, Charming's Bluff and Diplomacy.
  expect(
    under(at(breakdowns['skill.crf'], traits.craftsman, local.craft)),
  ).toEqual({
    ...base,
    craft: base.craft + 2,
    profession: base.profession + 2,
  });
  expect(
    under(
      at(breakdowns['skill.blf'], traitSelections.charming, local.attracted),
    ),
  ).toEqual({ ...base, bluff: base.bluff + 1, diplomacy: base.diplomacy + 1 });
  for (const [target, key, name, total, value] of [
    ['skill.dev', traitSelections.vagabond, local.disable, 'disableDevice', 1],
    ['skill.esc', traitSelections.vagabond, local.escape, 'escapeArtist', 1],
    ['skill.slt', traitSelections.vagabond, local.sleight, 'sleightOfHand', 1],
    ['skill.sen', traitSelections.canter, local.message, 'senseMotive', 5],
    ['skill.kpl', traitSelections.hunter, local.demons, 'knowledgePlanes', 3],
    ['skill.sur', traitSelections.starchild, local.lost, 'survival', 4],
  ] as const)
    expect(under(at(breakdowns[target], key, name)), target).toEqual({
      ...base,
      [total]: base[total] + value,
    });
  // Loreseeker's +2 trait and Elven Magic's +2 racial stack on Spellcraft.
  expect(under('identifyMagicItems')).toEqual({
    ...base,
    spellcraft: base.spellcraft + 4,
  });
  // Spell DC: +1 for a language-dependent spell on such a creature only.
  expect(
    under(
      at(breakdowns.spellDC, traitSelections.charming, local.languageDependent),
    ),
  ).toEqual({ ...base, spellDC: base.spellDC + 1 });
});

test('a trait’s attack bonus reaches every routine line in its Situation, beside a racial one', async () => {
  const f = await fixture();
  await withTraits(f);
  const sheet = await f.read();
  const { breakdowns } = sheet.calculated;
  const attacks = (situations: RequestedSituation[]) => {
    const calculated = resolved(sheet, situations);
    return {
      sword: line(calculated, f.sword).attackBonus.total,
      bow: line(calculated, f.bow).attackBonus.total,
    };
  };
  const base = attacks([]);
  for (const weapon of [f.sword, f.bow])
    expect(
      conditionalOf(
        line(sheet.calculated, weapon).attackBonus,
        traitSelections.fencer,
      ),
    ).toEqual([
      { value: 1, bonusType: 'trait', situation: { local: local.opportunity } },
    ]);
  const opportunity = localSituation(
    breakdowns['attack.melee'],
    traitSelections.fencer,
    local.opportunity,
  );
  const orcs = localSituation(
    breakdowns['attack.melee'],
    traits.hatred,
    local.orcs,
  );
  expect(attacks([opportunity])).toEqual({
    sword: base.sword + 1,
    bow: base.bow + 1,
  });
  expect(attacks([opportunity, orcs])).toEqual({
    sword: base.sword + 2,
    bow: base.bow + 2,
  });
});

test('a trait’s note on a skill reaches that skill, and a trait made inactive leaves the sheet', async () => {
  const f = await fixture();
  const chosen = await withTraits(f);
  const sheet = await f.read();
  const { breakdowns } = sheet.calculated;
  const notesOf = (target: 'skill.sur' | 'skill.per', key: string) =>
    (breakdowns[target].notes ?? [])
      .filter(({ source }) => source === key)
      .map(({ text }) => text);
  expect(notesOf('skill.sur', traitSelections.starchild)).toEqual([northNote]);
  expect(notesOf('skill.per', traitSelections.starchild)).toEqual([]);
  expect(
    sheet.calculated.entryNotes.some(({ text }) => text === northNote),
  ).toBe(false);
  // Courageous made inactive: no trait bonus is listed or applies.
  const entryId = chosen[traitSelections.courageous];
  if (!entryId) throw new Error('Missing Courageous');
  await f.member.mutation(api.characterSheet.editSelection, {
    ...f.scope,
    entryId: entryId as Id<'characterSheetEntry'>,
    active: false,
    operationId: 'courageous-off',
  });
  const off = await f.read();
  expect(
    conditionalOf(
      off.calculated.derivedStatistics.will,
      traitSelections.courageous,
    ),
  ).toEqual([]);
  expect(totals(resolved(off, ['fear'])).will).toBe(
    off.calculated.derivedStatistics.will.total + 2,
  );
});

test('an outsider is refused', async () => {
  const { outsider, scope } = await fixture();
  await expect(outsider.query(api.characterSheet.read, scope)).rejects.toThrow(
    'You do not have access to this org',
  );
});
