import { z } from 'zod';
import { skillDefinitions } from '../character-sheet-skill-definitions';
import { linkedInputKey } from '../character-sheet-linked-input-evaluation';
import { leadershipCitation } from './representative-cohorts';
import type {
  CompanionLinkedInput,
  CompanionLinkedInputCandidate,
} from '../character-sheet-linked-inputs';

// Representative prepared-sheet rules, not complete companion progression or a
// curated Catalog Release. Effective-level allocations and increases (#410),
// separately allocated component budgets (#419), reduced progressions (#420)
// and the Synthesist's fused eidolon (#421) are cited per rule.
export const companionSourceRuleKindSchema = z.enum([
  'animalCompanion',
  'familiar',
  'cohort',
  'eidolon',
  'unchainedEidolon',
  'wizardFamiliar',
  'sorcererFamiliar',
  'witchFamiliar',
  'druidCompanion',
  'rangerCompanion',
  'cavalierMount',
  'beastMasterCompanion',
  'packLordCompanion',
  'packmasterCompanion',
  'boonCompanion',
  'broodmasterEidolon',
  'masterSummonerEidolon',
  'synthesistEidolon',
]);
export type CompanionSourceRuleKind = z.infer<
  typeof companionSourceRuleKindSchema
>;
type Binding = {
  input: CompanionLinkedInput;
  sourceInput: CompanionLinkedInput;
  role?: CompanionLinkedInputCandidate['role'];
  precedence?: number;
};
type Citation = { book: string; pages: string; url: string };
// A source that divides one effective-level budget among the associated
// Character's companions before each companion's progression lookup.
type LevelAllocation = {
  label: string;
  classRuleIdentity: string;
  /** The Archetype whose Selection, Class Level or feature Grant supplies it. */
  archetypeIdentity: string;
  featureIdentities: readonly string[];
  budget: (classLevels: number) => number;
  restriction: string;
};
// A source that raises one companion's effective level, capped by the
// associated Character's level, without supporting a companion by itself.
type LevelIncrease = {
  label: string;
  featIdentity: string;
  amount: number;
  restriction: string;
};
// A purchase made once for every companion sharing a component budget, paid
// from that budget before the rest is divided.
type GroupPurchase = {
  label: string;
  cost: number;
  minimumLevel: number;
  requires?: string;
};
// A source that divides the components of one undivided table row among the
// associated Character's companions after the lookup (#419).
type ComponentAllocation = {
  label: string;
  classRuleIdentity: string;
  /** The Archetype whose Selection, Class Level or feature Grant supplies it. */
  archetypeIdentity: string;
  featureIdentities: readonly string[];
  groupPurchases: Readonly<Record<string, GroupPurchase>>;
  restriction: string;
};
/**
 * One step of a reduced progression, applied in order to the class level
 * the source reads. Division rounds down (CRB Getting Started, Rounding).
 */
export type ProgressionReductionStep =
  | { kind: 'divide'; divisor: number }
  | { kind: 'minimum'; value: number };
// A source that transforms the class level it reads before the one table
// lookup (#420): no player divides anything, and the actual class level
// stays distinct from the reduced level the table reads.
type ProgressionReduction = {
  /** The Archetype, as the rule's owner. */
  label: string;
  /** The feature carrying the reduction. */
  featureLabel: string;
  /** The table the reduced level is looked up in. */
  tableLabel: string;
  classRuleIdentity: string;
  /** The Archetype whose Selection, Class Level or feature Grant supplies it. */
  archetypeIdentity: string;
  featureIdentities: readonly string[];
  steps: readonly ProgressionReductionStep[];
  restriction: string;
};
// A source whose companion fuses with the associated Character (#421): the
// companion progresses as normal, but its rule replaces the class's
// ordinary companion feature, so it competes with other such rules.
type Fusion = {
  /** The Archetype, as the rule's owner. */
  label: string;
  /** The feature carrying the fusion. */
  featureLabel: string;
  classRuleIdentity: string;
  /** The Archetype whose Selection, Class Level or feature Grant supplies it. */
  archetypeIdentity: string;
  featureIdentities: readonly string[];
  restriction: string;
};
type Rule = {
  contributingClassRuleIdentity?: string;
  inputs: Binding[];
  sources: Citation[];
  allocation?: LevelAllocation;
  increase?: LevelIncrease;
  componentAllocation?: ComponentAllocation;
  reduction?: ProgressionReduction;
  fusion?: Fusion;
};
const sameInput = (input: CompanionLinkedInput): Binding => ({
  input,
  sourceInput: input,
});
const classLevels = (classRuleIdentity: string): CompanionLinkedInput => ({
  kind: 'classLevels',
  classRuleIdentity,
});
const familiarInputs: Binding[] = [
  sameInput({ kind: 'characterLevel' }),
  sameInput({ kind: 'actualHitDice' }),
  sameInput({ kind: 'maximumHp' }),
  sameInput({ kind: 'baseAttackBonus' }),
  ...(['fort', 'ref', 'will'] as const).map((save) =>
    sameInput({ kind: 'baseSave', save }),
  ),
  ...skillDefinitions.map(({ key }) =>
    sameInput({ kind: 'skillRanks', skill: key }),
  ),
];
const crb = {
  book: 'Pathfinder RPG Core Rulebook',
  pages: '51–54, 67, 78, 82–83',
  url: 'https://legacy.aonprd.com/coreRulebook/classes.html',
};
const witch = {
  book: 'Pathfinder RPG Advanced Player’s Guide',
  pages: '66–69',
  url: 'https://legacy.aonprd.com/advancedPlayersGuide/baseClasses/witch.html',
};
const apg = {
  book: 'Pathfinder RPG Advanced Player’s Guide',
  pages: '54–63',
  url: 'https://legacy.aonprd.com/advancedPlayersGuide/baseClasses/summoner.html',
};
const beastMaster = {
  book: 'Pathfinder RPG Advanced Player’s Guide',
  pages: '124',
  url: 'https://legacy.aonprd.com/advancedPlayersGuide/coreClasses/ranger.html#beast-master',
};
const packLord = {
  book: 'Pathfinder RPG Ultimate Magic',
  pages: '38',
  url: 'https://aonprd.com/ArchetypeDisplay.aspx?FixedName=Druid%20Pack%20Lord',
};
const packmaster = {
  book: 'Pathfinder RPG Advanced Class Guide',
  pages: '96',
  url: 'https://aonprd.com/ArchetypeDisplay.aspx?FixedName=Hunter%20Packmaster',
};
const boonCompanion = [
  {
    book: 'Pathfinder RPG Ultimate Wilderness',
    pages: '217',
    url: 'https://aonprd.com/FeatDisplay.aspx?ItemName=Boon%20Companion',
  },
  {
    book: 'Pathfinder Campaign Setting: Seekers of Secrets',
    pages: '16',
    url: 'https://aonprd.com/FeatDisplay.aspx?ItemName=Boon%20Companion',
  },
];
const broodmaster = {
  book: 'Pathfinder RPG Ultimate Magic',
  pages: '78',
  url: 'https://legacy.aonprd.com/ultimateMagic/spellcastingClassOptions/summoner.html#broodmaster-(archetype)',
};
const masterSummoner = {
  book: 'Pathfinder RPG Ultimate Magic',
  pages: '80',
  url: 'https://legacy.aonprd.com/ultimateMagic/spellcastingClassOptions/summoner.html#master-summoner-(archetype)',
};
// The official FAQ cites the archetype at p. 80; Archives of Nethys' source
// line gives p. 81, where Fused Eidolon continues.
export const synthesistCitation = {
  book: 'Pathfinder RPG Ultimate Magic',
  pages: '80–81',
  url: 'https://legacy.aonprd.com/ultimateMagic/spellcastingClassOptions/summoner.html#synthesist-(archetype)',
};
const unchained = {
  book: 'Pathfinder Unchained',
  pages: '25–34',
  url: 'https://legacy.aonprd.com/unchained/classes/summoner.html',
};
export const representativeCompanionRules: Record<
  CompanionSourceRuleKind,
  Rule
> = {
  familiar: {
    inputs: [
      ...familiarInputs,
      sameInput({ kind: 'familiarProgressionLevels' }),
      sameInput(classLevels('wizard')),
      sameInput(classLevels('sorcerer')),
      sameInput(classLevels('witch')),
    ],
    sources: [crb, witch],
  },
  wizardFamiliar: {
    contributingClassRuleIdentity: 'wizard',
    inputs: [
      ...familiarInputs,
      sameInput(classLevels('wizard')),
      {
        input: { kind: 'familiarProgressionLevels' },
        sourceInput: { kind: 'familiarProgressionLevels' },
        role: 'alternative',
        precedence: 1,
      },
    ],
    sources: [crb],
  },
  sorcererFamiliar: {
    contributingClassRuleIdentity: 'sorcerer',
    inputs: [
      ...familiarInputs,
      sameInput(classLevels('sorcerer')),
      {
        input: { kind: 'familiarProgressionLevels' },
        sourceInput: { kind: 'familiarProgressionLevels' },
        role: 'alternative',
        precedence: 1,
      },
    ],
    sources: [crb],
  },
  witchFamiliar: {
    contributingClassRuleIdentity: 'witch',
    inputs: [
      ...familiarInputs,
      sameInput(classLevels('witch')),
      {
        input: { kind: 'familiarProgressionLevels' },
        sourceInput: { kind: 'familiarProgressionLevels' },
        role: 'alternative',
        precedence: 0,
      },
    ],
    sources: [witch],
  },
  animalCompanion: {
    inputs: [sameInput(classLevels('druid')), sameInput(classLevels('ranger'))],
    sources: [crb],
  },
  druidCompanion: { inputs: [sameInput(classLevels('druid'))], sources: [crb] },
  rangerCompanion: {
    inputs: [sameInput(classLevels('ranger'))],
    sources: [crb],
  },
  cavalierMount: {
    inputs: [sameInput(classLevels('cavalier'))],
    sources: [
      {
        book: 'Pathfinder RPG Advanced Player’s Guide',
        pages: '32–33',
        url: 'https://legacy.aonprd.com/advancedPlayersGuide/baseClasses/cavalier.html#mount',
      },
    ],
  },
  beastMasterCompanion: {
    inputs: [sameInput(classLevels('ranger'))],
    sources: [beastMaster],
    allocation: {
      label: 'Beast Master',
      classRuleIdentity: 'ranger',
      archetypeIdentity: 'ranger-beast-master',
      featureIdentities: [
        'ranger-beast-master-animal-companion',
        'ranger-beast-master-strong-bond',
      ],
      // Ranger level − 3; Strong Bond makes it the ranger level from 12th.
      budget: (levels) => (levels >= 12 ? levels : Math.max(0, levels - 3)),
      restriction:
        'Beast Master divides its effective druid level among its animal companions and may choose any animal companion a druid can.',
    },
  },
  packLordCompanion: {
    inputs: [sameInput(classLevels('druid'))],
    sources: [packLord],
    allocation: {
      label: 'Pack Lord',
      classRuleIdentity: 'druid',
      archetypeIdentity: 'druid-pack-lord',
      featureIdentities: ['druid-pack-lord-pack-bond'],
      budget: (levels) => levels,
      restriction:
        'Pack Lord divides its druid level among its animal companions; share spells affects one companion at a time.',
    },
  },
  packmasterCompanion: {
    inputs: [sameInput(classLevels('hunter'))],
    sources: [packmaster],
    allocation: {
      label: 'Packmaster',
      classRuleIdentity: 'hunter',
      archetypeIdentity: 'hunter-packmaster',
      featureIdentities: ['hunter-packmaster-pack-bond'],
      budget: (levels) => levels,
      restriction:
        'Packmaster divides its hunter level among its animal companions; share spells affects one companion at a time.',
    },
  },
  boonCompanion: {
    inputs: [sameInput({ kind: 'characterLevel' })],
    sources: boonCompanion,
    increase: {
      label: 'Boon Companion',
      featIdentity: 'boon-companion',
      amount: 4,
      restriction:
        'Boon Companion adds four effective levels to one companion that another source supports, to at most the associated Character’s level.',
    },
  },
  // CRB p. 129: the Leadership Score is the leader's level plus Charisma
  // modifier; the cohort's own Class Levels never read these inputs.
  cohort: {
    inputs: [
      sameInput({ kind: 'characterLevel' }),
      sameInput({ kind: 'abilityModifier', ability: 'charisma' }),
    ],
    sources: [leadershipCitation],
  },
  eidolon: { inputs: [sameInput(classLevels('summoner'))], sources: [apg] },
  broodmasterEidolon: {
    inputs: [sameInput(classLevels('summoner'))],
    sources: [broodmaster, apg],
    componentAllocation: {
      label: 'Broodmaster',
      classRuleIdentity: 'summoner',
      archetypeIdentity: 'summoner-broodmaster',
      featureIdentities: ['summoner-broodmaster-eidolon-brood'],
      // Larger Brood: the large evolution at 8th, then the huge evolution at
      // 13th, each spent from the pool before it is divided.
      groupPurchases: {
        large: { label: 'Large evolution', cost: 4, minimumLevel: 8 },
        huge: {
          label: 'Huge evolution',
          cost: 6,
          minimumLevel: 13,
          requires: 'large',
        },
      },
      restriction:
        'Broodmaster eidolons share the summoner level’s base attack bonus and saves; Hit Dice (at least 1 each), skill ranks, feats, armor bonus, Strength and Dexterity bonuses, evolution points and maximum natural attacks are divided among the brood. Each eidolon buys its own evolutions.',
    },
  },
  masterSummonerEidolon: {
    inputs: [sameInput(classLevels('summoner'))],
    sources: [masterSummoner, apg],
    reduction: {
      label: 'Master Summoner',
      featureLabel: 'Lesser Eidolon',
      tableLabel: 'eidolon table',
      classRuleIdentity: 'summoner',
      archetypeIdentity: 'summoner-master-summoner',
      featureIdentities: ['summoner-master-summoner-lesser-eidolon'],
      // "A master summoner's class level is halved (minimum 1) for the
      // purposes of determining his eidolon's abilities, Hit Dice, evolution
      // pool, and so on."
      steps: [
        { kind: 'divide', divisor: 2 },
        { kind: 'minimum', value: 1 },
      ],
      restriction:
        'Lesser Eidolon halves the summoner level, rounded down to at least 1, before the eidolon table is read: its Hit Dice, base attack bonus, saves, feats, armor, Str/Dex bonus, evolution pool, maximum attacks, special abilities and evolution level requirements all use the halved level. The eidolon otherwise functions as normal.',
    },
  },
  synthesistEidolon: {
    inputs: [sameInput(classLevels('summoner'))],
    sources: [synthesistCitation, apg],
    fusion: {
      label: 'Synthesist',
      featureLabel: 'Fused Eidolon',
      classRuleIdentity: 'summoner',
      archetypeIdentity: 'summoner-synthesist',
      featureIdentities: ['summoner-synthesist-fused-eidolon'],
      // "In all other cases, this ability functions as the summoner's normal
      // eidolon ability ... This ability replaces the class's eidolon
      // ability, bond senses, and life bond."
      restriction:
        'Fused Eidolon: the eidolon progresses as a normal eidolon of the summoner level, but it is worn as the synthesist’s living armor. Its fused statistics appear on the summoner’s sheet as a Combined Form; the eidolon keeps its own build.',
    },
  },
  unchainedEidolon: {
    inputs: [sameInput(classLevels('summoner'))],
    sources: [unchained],
  },
};

export const classLabels: Record<string, string> = {
  wizard: 'Wizard',
  sorcerer: 'Sorcerer',
  witch: 'Witch',
  druid: 'Druid',
  ranger: 'Ranger',
  cavalier: 'Cavalier',
  summoner: 'Summoner',
  hunter: 'Hunter',
};
export function listCuratedCompanionInputs({
  kind,
  sources,
}: {
  kind: CompanionSourceRuleKind;
  sources: readonly { ruleKind?: CompanionSourceRuleKind }[];
}) {
  const inputs = new Map<
    string,
    { input: CompanionLinkedInput; classLabel?: string }
  >();
  for (const source of sources)
    for (const { input } of representativeCompanionRules[
      source.ruleKind ?? kind
    ].inputs)
      inputs.set(linkedInputKey(input), {
        input,
        ...(input.kind === 'classLevels'
          ? { classLabel: classLabels[input.classRuleIdentity] }
          : {}),
      });
  return [...inputs.values()];
}
