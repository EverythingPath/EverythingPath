import { z } from 'zod';
import {
  characterSheetClassFamily,
  isUnchainedClass,
} from './character-sheet-archetype-helpers';
import {
  conflictingRuleLabels,
  getCompanionFusionRule,
} from './character-sheet-companion-sources';
import {
  creatureSizes,
  type CreatureSize,
} from './character-sheet-creature-sizes';
import { synthesistCitation } from './catalog/representative-companion-rules';
import { classProgressionEntryId } from './character-sheet-class-levels';
import { eidolonEvolutionKeySchema } from './catalog/representative-eidolons';
import type {
  calculateCharacterSheet,
  CharacterSheetCatalogEntry,
  CharacterSheetInput,
  InputSourcedModifier,
  LeafTarget,
  ModifierTarget,
  ResolveOptions,
  SheetEntry,
} from './character-sheet';
import { ruleKeyMatches } from './character-sheet-rule-keys';

// The Synthesist's Combined Form (#421): a static view of the summoner fused
// with its eidolon, calculated from the two separate Character builds. It is
// never stored, declares no current fusion and changes no other statistic.
//
// Ultimate Magic pp. 80–81, Fused Eidolon: "the synthesist uses the
// eidolon's Strength, Dexterity, and Constitution, but retains his own
// Intelligence, Wisdom, and Charisma. The synthesist gains the eidolon's hit
// points as temporary hit points ... uses the eidolon's base attack bonus,
// and gains the eidolon's armor and natural armor bonuses ... While fused,
// the synthesist loses the benefits of his armor."

type Calculated = ReturnType<typeof calculateCharacterSheet>;
const physicalAbilities = ['strength', 'dexterity', 'constitution'] as const;
const mentalAbilities = ['intelligence', 'wisdom', 'charisma'] as const;
const abilities = [...physicalAbilities, ...mentalAbilities] as const;
type PhysicalAbility = (typeof physicalAbilities)[number];
type Ability = (typeof abilities)[number];
const targets: Record<Ability, LeafTarget> = {
  strength: 'ability.str',
  dexterity: 'ability.dex',
  constitution: 'ability.con',
  intelligence: 'ability.int',
  wisdom: 'ability.wis',
  charisma: 'ability.cha',
};
const abilityLabels: Record<Ability, string> = {
  strength: 'Strength',
  dexterity: 'Dexterity',
  constitution: 'Constitution',
  intelligence: 'Intelligence',
  wisdom: 'Wisdom',
  charisma: 'Charisma',
};

/**
 * What the eidolon's build supplies to the summoner's fused calculation.
 * The resolver substitutes these for the summoner's own contributions.
 */
export type CombinedFormSubstitution = {
  /** The class whose built-in BAB the eidolon's BAB replaces. */
  replacedClassRuleIdentity: string;
  baseAttackBonus: number;
  /** The eidolon's scores, and its modifier penalty from ability damage. */
  physicalScores: Record<
    PhysicalAbility,
    { score: number; damagePenalty: number }
  >;
  armorBonus: number;
  naturalArmor: number;
  size: CreatureSize;
  skillBonuses: readonly {
    target: ModifierTarget;
    value: number;
    bonusType: 'racial' | 'size';
    name: string;
  }[];
  shieldedMeld: { name: string; value: number } | null;
};

const fusedEntryPrefix = 'builtin:combined-form:';

/** Whether an entry is armor the synthesist wears, which stops functioning. */
function isWornArmor(
  entry: SheetEntry,
  catalogEntries: readonly CharacterSheetCatalogEntry[],
) {
  if (entry.kind !== 'item') return false;
  const definition = catalogEntries.find(
    (candidate) => candidate._id === entry.catalogEntryId,
  );
  return (
    definition?.detail?.kind === 'item' &&
    definition.detail.armor?.slot === 'armor'
  );
}

/**
 * The summoner's counting entries while fused: worn armor does not function
 * (official FAQ: "any armor the synthesist wears does not function while the
 * eidolon is present"), so neither its bonuses nor its penalties apply.
 */
export function combinedFormEntries(
  entries: readonly SheetEntry[],
  catalogEntries: readonly CharacterSheetCatalogEntry[],
) {
  return entries.filter((entry) => !isWornArmor(entry, catalogEntries));
}

/**
 * Ability damage while fused: the eidolon's Strength, Dexterity and
 * Constitution damage (official FAQ), the summoner's own mental damage.
 */
export function combinedFormAbilityDamage(
  combinedForm: CombinedFormSubstitution,
  damage: Partial<Record<Ability, number>>,
): Partial<Record<Ability, number>> {
  return {
    ...damage,
    ...Object.fromEntries(
      physicalAbilities.map((ability) => [
        ability,
        combinedForm.physicalScores[ability].damagePenalty * 2,
      ]),
    ),
  };
}

/** One of the eidolon's contributions as a built-in Modifier of the form. */
function fusedModifier({
  id,
  target,
  value,
  name,
  bonusType = 'untyped',
}: {
  id: string;
  target: ModifierTarget;
  value: number;
  name: string;
  bonusType?: InputSourcedModifier['bonusType'];
}): InputSourcedModifier {
  return {
    target,
    value,
    bonusType,
    sheetEntryId: `${fusedEntryPrefix}${id}`,
    entryName: name,
    source: `${fusedEntryPrefix}${id}`,
    builtIn: true,
  };
}

/**
 * The summoner's Modifiers with the eidolon's contributions substituted:
 * its physical scores replace the summoner's, its BAB replaces only the
 * summoner class's BAB, and its armor, natural armor, size, Skilled bonuses
 * and the Synthesist's Shielded Meld join the summoner's own.
 */
export function combinedFormModifiers(
  combinedForm: CombinedFormSubstitution,
  modifiers: readonly InputSourcedModifier[],
): InputSourcedModifier[] {
  const physicalTargets = physicalAbilities.map((ability) => targets[ability]);
  const replacedBab = classProgressionEntryId(
    combinedForm.replacedClassRuleIdentity,
  );
  const own = modifiers.filter(
    (modifier) =>
      !physicalTargets.some((target) => target === modifier.target) &&
      !(
        modifier.builtIn &&
        modifier.target === 'bab' &&
        modifier.sheetEntryId === replacedBab
      ) &&
      // The fused size replaces the summoner's own size adjustments; the
      // resolver's size AC already reads the eidolon's size.
      !(
        modifier.bonusType === 'size' &&
        modifier.sheetEntryId !== 'builtin:size-ac'
      ),
  );
  const { armorBonus, naturalArmor, shieldedMeld } = combinedForm;
  const fused: InputSourcedModifier[] = [
    ...physicalAbilities.map((ability) =>
      fusedModifier({
        id: ability,
        target: targets[ability],
        value: combinedForm.physicalScores[ability].score,
        name: `Eidolon ${abilityLabels[ability]}`,
        bonusType: 'base',
      }),
    ),
    fusedModifier({
      id: 'bab',
      target: 'bab',
      value: combinedForm.baseAttackBonus,
      name: 'Eidolon BAB',
    }),
    ...(armorBonus
      ? [
          fusedModifier({
            id: 'armor',
            target: 'ac.armor',
            value: armorBonus,
            name: 'Eidolon armor bonus',
            bonusType: 'armor',
          }),
        ]
      : []),
    ...(naturalArmor
      ? [
          fusedModifier({
            id: 'natural-armor',
            target: 'ac.natural',
            value: naturalArmor,
            name: 'Eidolon natural armor',
            bonusType: 'naturalArmor',
          }),
        ]
      : []),
    ...combinedForm.skillBonuses.map((bonus, index) =>
      fusedModifier({ id: `skill:${index}`, ...bonus }),
    ),
    ...(shieldedMeld
      ? [
          fusedModifier({
            id: 'shielded-meld:ac',
            target: 'ac.shield',
            value: shieldedMeld.value,
            name: shieldedMeld.name,
            bonusType: 'shield',
          }),
          fusedModifier({
            id: 'shielded-meld:saves',
            target: 'saves',
            value: shieldedMeld.value,
            name: shieldedMeld.name,
            bonusType: 'circumstance',
          }),
        ]
      : []),
  ];
  return [...own, ...fused];
}

const provenanceSchema = z.enum(['summoner', 'eidolon']);
const contributionSchema = z.object({
  label: z.string(),
  value: z.number(),
  from: provenanceSchema,
});
const nullableNumber = z.number().nullable();
const fusedStatisticSchema = z.object({
  total: nullableNumber,
  contributions: z.array(contributionSchema),
});
export const combinedFormUnresolvedReasons = [
  'noEidolon',
  'eidolonUnavailable',
  'multipleEidolons',
  'eidolonProgressionUnresolved',
  'unchainedSummoner',
  'eidolonHitPoints',
] as const;
export type CombinedFormUnresolvedReason =
  (typeof combinedFormUnresolvedReasons)[number];
export const combinedFormSchema = z.object({
  status: z.enum(['calculated', 'unresolved']),
  /** The Synthesist's summoner level; the summoner's own Class Levels. */
  summonerLevel: z.number(),
  unresolved: z.array(
    z.object({
      reason: z.enum(combinedFormUnresolvedReasons),
      message: z.string(),
    }),
  ),
  /** Rules the two builds break; informational, never blocking. */
  advisories: z.array(
    z.object({
      kind: z.enum(['eidolonSmallerThanSynthesist']),
      message: z.string(),
    }),
  ),
  size: z.enum(creatureSizes).nullable(),
  abilities: z.array(
    z.object({
      ability: z.enum(abilities),
      score: nullableNumber,
      modifier: nullableNumber,
      from: provenanceSchema,
      /** Eidolon contributions this fused score does not receive. */
      excluded: z.array(z.object({ label: z.string(), value: z.number() })),
    }),
  ),
  baseAttackBonus: fusedStatisticSchema.extend({
    /** The summoner class BAB the eidolon's BAB replaces. */
    replaced: z.array(z.object({ label: z.string(), value: z.number() })),
  }),
  hitPoints: z.object({
    /** The summoner's own maximum HP, with the fused Constitution. */
    total: nullableNumber,
    /** The eidolon's maximum HP, gained as temporary hit points. */
    temporary: nullableNumber,
  }),
  armorClass: fusedStatisticSchema.extend({
    touch: nullableNumber,
    flatFooted: nullableNumber,
  }),
  saves: z.object({
    fortitude: fusedStatisticSchema,
    reflex: fusedStatisticSchema,
    will: fusedStatisticSchema,
  }),
  combatManeuverBonus: nullableNumber,
  combatManeuverDefense: nullableNumber,
  initiative: nullableNumber,
  skills: z.array(
    z.object({
      skill: z.string(),
      name: z.string(),
      total: nullableNumber,
      /** The eidolon's Skilled evolution bonus the synthesist gains. */
      skilled: nullableNumber,
    }),
  ),
  evolutions: z.object({
    /** Evolution effects read the eidolon's Hit Dice (official FAQ). */
    hitDice: nullableNumber,
    /** The summoner's own Hit Dice, which evolutions never read. */
    characterHitDice: nullableNumber,
    maxAttacks: nullableNumber,
    attackCount: z.number(),
    list: z.array(
      z.object({
        key: eidolonEvolutionKeySchema,
        name: z.string(),
        choice: z.string().nullable(),
      }),
    ),
  }),
  /** The eidolon's linked summoner-level inputs, with any fallback state. */
  inputs: z.array(
    z.object({
      label: z.string(),
      value: nullableNumber,
      resolution: z.enum([
        'calculated',
        'interpretation',
        'precedence',
        'fallback',
        'unresolved',
      ]),
      fallbackState: z.enum(['none', 'applied', 'suspended']),
    }),
  ),
  features: z.array(z.object({ name: z.string(), summary: z.string() })),
  sources: z.array(z.object({ title: z.string(), url: z.string() })),
});
export type CombinedForm = z.infer<typeof combinedFormSchema>;

const faqUrl = 'https://paizo.com/paizo/faq/v5748nruor1fz';
const combinedFormSources: CombinedForm['sources'] = [
  {
    title: `${synthesistCitation.book} pp. ${synthesistCitation.pages}, Synthesist`,
    url: synthesistCitation.url,
  },
  {
    title: 'Ultimate Magic FAQ: synthesist Hit Dice and BAB',
    url: `${faqUrl}#v5748eaic9obc`,
  },
  {
    title: 'Ultimate Magic FAQ: synthesist Skilled and mental ability scores',
    url: `${faqUrl}#v5748eaic9obb`,
  },
  {
    title: 'Ultimate Magic FAQ: synthesist armor',
    url: `${faqUrl}#v5748eaic9ob7`,
  },
  {
    title: 'Ultimate Magic FAQ: synthesist ability damage and drain',
    url: `${faqUrl}#v5748eaic9ob9`,
  },
];

/**
 * The Synthesist Archetype active on the summoner, with the summoner level
 * and the class version it applies to; null when the Character is not a
 * Synthesist.
 */
export function findSynthesist({
  input,
  calculated,
}: {
  input: Pick<CharacterSheetInput, 'catalogEntries'>;
  calculated: Pick<Calculated, 'archetypes' | 'classLevels'>;
}) {
  const rule = getCompanionFusionRule('synthesistEidolon');
  const definition = (id: string | null) =>
    input.catalogEntries.find((entry) => entry._id === id);
  const applied = calculated.archetypes.classes.find(
    (effects) =>
      ruleKeyMatches(effects.classIdentity, rule.classRuleIdentity) &&
      effects.archetypes.some(
        (archetype) =>
          ruleKeyMatches(archetype.ruleIdentity, rule.archetypeIdentity) &&
          archetype.active &&
          archetype.applicable,
      ),
  );
  const summonerClass = applied ? definition(applied.classEntryId) : undefined;
  if (!summonerClass) return null;
  const summonerLevels = calculated.classLevels.filter((row) => {
    const level = definition(row.classEntryId);
    return (
      level &&
      ruleKeyMatches(
        characterSheetClassFamily(level, input.catalogEntries),
        rule.classRuleIdentity,
      )
    );
  });
  return {
    classRuleIdentity: summonerClass.ruleIdentity,
    // Synthesist is an original-summoner Archetype: an Unchained summoner's
    // Combined Form is never assumed (#226).
    isUnchained:
      isUnchainedClass(summonerClass) ||
      summonerLevels.some((row) => {
        const level = definition(row.classEntryId);
        return level ? isUnchainedClass(level) : false;
      }),
    summonerLevel: summonerLevels.length,
  };
}

export type EidolonInput =
  | { kind: 'calculated'; calculated: Calculated }
  | {
      kind: 'unavailable';
      reason: Extract<
        CombinedFormUnresolvedReason,
        'noEidolon' | 'eidolonUnavailable' | 'multipleEidolons'
      >;
    };
type Summoner = { input: CharacterSheetInput; calculated: Calculated };
type Synthesist = NonNullable<ReturnType<typeof findSynthesist>>;
type EidolonProgression = Extract<
  NonNullable<Calculated['companionProgression']>,
  { kind: 'eidolon' }
>;
type FusedStatistic = z.infer<typeof fusedStatisticSchema>;

const unavailableMessages: Record<CombinedFormUnresolvedReason, string> = {
  noEidolon: 'No eidolon is linked to this synthesist.',
  eidolonUnavailable:
    'The eidolon is unavailable, so its fused statistics cannot be calculated.',
  multipleEidolons:
    'More than one eidolon is linked to this synthesist; the fused eidolon is not chosen.',
  eidolonProgressionUnresolved:
    'The eidolon’s progression is unresolved, so its fused statistics cannot be calculated.',
  unchainedSummoner:
    'Synthesist is written for the original summoner; its Combined Form is not assumed for the Unchained summoner.',
  eidolonHitPoints:
    'The eidolon’s hit points are not recorded, so its temporary hit points are unresolved.',
};

const isMentalAbility = (ability: Ability) =>
  mentalAbilities.some((mental) => mental === ability);
function identifyProvenance(modifier: { sheetEntryId: string }) {
  return modifier.sheetEntryId.startsWith(fusedEntryPrefix)
    ? ('eidolon' as const)
    : ('summoner' as const);
}
function listContributions(statistic: {
  applied: readonly {
    entryName: string;
    value: number;
    sheetEntryId: string;
  }[];
}) {
  return statistic.applied.map((modifier) => ({
    label: modifier.entryName,
    value: modifier.value,
    from: identifyProvenance(modifier),
  }));
}
function describeStatistic(statistic: {
  total: number | null;
  applied: Parameters<typeof listContributions>[0]['applied'];
}): FusedStatistic {
  return {
    total: statistic.total,
    contributions: listContributions(statistic),
  };
}

/**
 * The Combined Form with no fused values: only the summoner's own mental
 * scores and Hit Dice are stated, with the reasons nothing else is.
 */
function buildUnresolvedForm({
  synthesist,
  summoner,
  reasons,
  inputs = [],
}: {
  synthesist: Synthesist;
  summoner: Summoner;
  reasons: readonly {
    reason: CombinedFormUnresolvedReason;
    message?: string;
  }[];
  inputs?: CombinedForm['inputs'];
}): CombinedForm {
  const own = summoner.calculated.abilities;
  const unresolvedStatistic = { total: null, contributions: [] };
  return {
    status: 'unresolved',
    summonerLevel: synthesist.summonerLevel,
    unresolved: reasons.map(({ reason, message }) => ({
      reason,
      message: message ?? unavailableMessages[reason],
    })),
    advisories: [],
    size: null,
    abilities: abilities.map((ability) => {
      const isMental = isMentalAbility(ability);
      return {
        ability,
        score: isMental ? own[ability].score : null,
        modifier: isMental ? own[ability].modifier : null,
        from: isMental ? 'summoner' : 'eidolon',
        excluded: [],
      };
    }),
    baseAttackBonus: { ...unresolvedStatistic, replaced: [] },
    hitPoints: { total: null, temporary: null },
    armorClass: { ...unresolvedStatistic, touch: null, flatFooted: null },
    saves: {
      fortitude: unresolvedStatistic,
      reflex: unresolvedStatistic,
      will: unresolvedStatistic,
    },
    combatManeuverBonus: null,
    combatManeuverDefense: null,
    initiative: null,
    skills: [],
    evolutions: {
      hitDice: null,
      characterHitDice: summoner.calculated.hitDice,
      maxAttacks: null,
      attackCount: 0,
      list: [],
    },
    inputs,
    features: [],
    sources: combinedFormSources,
  };
}

/** The eidolon's linked summoner-level inputs, with any fallback state. */
function listLinkedInputs(
  progression: EidolonProgression,
): CombinedForm['inputs'] {
  return progression.contributions
    .filter((contribution) => contribution.counting)
    .map((contribution) => ({
      label: 'Summoner level',
      value: contribution.classLevels,
      resolution: contribution.resolution,
      fallbackState: contribution.fallbackState,
    }));
}

/** Why an unresolved eidolon progression leaves the form unresolved. */
function explainUnresolvedProgression(progression: EidolonProgression) {
  const conflicts = conflictingRuleLabels(progression.contributions);
  return {
    reason: 'eidolonProgressionUnresolved' as const,
    ...(conflicts.length
      ? {
          message: `${conflicts.join(' and ')} each replace the eidolon with no published precedence, so its fused statistics cannot be calculated.`,
        }
      : {}),
  };
}

/**
 * The Synthesist's Combined Form from its own build and its eidolon's,
 * or null when the Character is not a Synthesist. `calculateFused`
 * calculates the summoner's sheet with the eidolon's substitution.
 */
export function resolveCombinedForm({
  summoner,
  eidolon,
  calculateFused,
}: {
  summoner: Summoner;
  eidolon: EidolonInput;
  calculateFused: (options: Pick<ResolveOptions, 'combinedForm'>) => Calculated;
}): CombinedForm | null {
  const synthesist = findSynthesist(summoner);
  if (!synthesist) return null;
  if (synthesist.isUnchained)
    return buildUnresolvedForm({
      synthesist,
      summoner,
      reasons: [{ reason: 'unchainedSummoner' }],
    });
  if (eidolon.kind === 'unavailable')
    return buildUnresolvedForm({
      synthesist,
      summoner,
      reasons: [{ reason: eidolon.reason }],
    });
  const fusedEidolon = eidolon.calculated;
  const progression = fusedEidolon.companionProgression;
  if (progression?.kind !== 'eidolon')
    return buildUnresolvedForm({
      synthesist,
      summoner,
      reasons: [{ reason: 'eidolonProgressionUnresolved' }],
    });
  const inputs = listLinkedInputs(progression);
  const bab = fusedEidolon.ownProgression.totalBases.bab;
  if (progression.status !== 'active' || bab === null)
    return buildUnresolvedForm({
      synthesist,
      summoner,
      reasons: [explainUnresolvedProgression(progression)],
      inputs,
    });
  const shieldedMeld = findShieldedMeld(summoner);
  const skillBonuses = eidolonSkillBonuses(fusedEidolon);
  const fused = calculateFused({
    combinedForm: {
      replacedClassRuleIdentity: synthesist.classRuleIdentity,
      baseAttackBonus: bab,
      physicalScores: {
        strength: physicalScore(fusedEidolon, 'strength'),
        dexterity: physicalScore(fusedEidolon, 'dexterity'),
        constitution: physicalScore(fusedEidolon, 'constitution'),
      },
      armorBonus: fusedEidolon.breakdowns['ac.armor'].total,
      naturalArmor: fusedEidolon.breakdowns['ac.natural'].total,
      size: progression.size,
      skillBonuses,
      shieldedMeld,
    },
  });
  const statistics = fused.derivedStatistics;
  const temporary = fusedEidolon.hp;
  return {
    status: 'calculated',
    summonerLevel: synthesist.summonerLevel,
    unresolved:
      temporary === null
        ? [
            {
              reason: 'eidolonHitPoints',
              message: unavailableMessages.eidolonHitPoints,
            },
          ]
        : [],
    advisories: checkFusedSize(summoner, progression.size),
    size: progression.size,
    abilities: describeFusedAbilities(fused, fusedEidolon),
    baseAttackBonus: {
      ...describeStatistic(statistics.bab),
      replaced: listReplacedBab(summoner, synthesist),
    },
    hitPoints: { total: fused.hp, temporary },
    armorClass: {
      ...describeStatistic(statistics.ac),
      touch: statistics.touchAc.total,
      flatFooted: statistics.flatFootedAc.total,
    },
    saves: {
      fortitude: describeStatistic(statistics.fortitude),
      reflex: describeStatistic(statistics.reflex),
      will: describeStatistic(statistics.will),
    },
    combatManeuverBonus: statistics.cmb.total,
    combatManeuverDefense: statistics.cmd.total,
    initiative: statistics.initiative.total,
    skills: describeFusedSkills(fused, skillBonuses),
    evolutions: {
      hitDice: fusedEidolon.hitDice,
      characterHitDice: summoner.calculated.hitDice,
      maxAttacks: progression.budgets.maxAttacks,
      attackCount: progression.attackCount,
      list: progression.evolutions.map(({ key, name, choice }) => ({
        key,
        name,
        choice,
      })),
    },
    inputs,
    features: shieldedMeld
      ? [
          {
            name: shieldedMeld.name,
            summary: `+${shieldedMeld.value} shield bonus to AC and +${shieldedMeld.value} circumstance bonus on saving throws while fused.`,
          },
        ]
      : [],
    sources: combinedFormSources,
  };
}

/**
 * The fused scores: the eidolon's physical scores and the summoner's own
 * mental scores. Official FAQ: an eidolon's mental Ability Increase "has no
 * effect on the synthesist because he uses his own mental ability scores",
 * so each is listed as excluded.
 */
function describeFusedAbilities(
  fused: Calculated,
  fusedEidolon: Calculated,
): CombinedForm['abilities'] {
  return abilities.map((ability) => {
    const isMental = isMentalAbility(ability);
    return {
      ability,
      score: fused.abilities[ability].score,
      modifier: fused.abilities[ability].modifier,
      from: isMental ? 'summoner' : 'eidolon',
      excluded: isMental
        ? fusedEidolon.breakdowns[targets[ability]].applied.flatMap(
            (modifier) =>
              modifier.builtIn &&
              modifier.sheetEntryId.startsWith('builtin:eidolon:')
                ? [{ label: modifier.entryName, value: modifier.value }]
                : [],
          )
        : [],
    };
  });
}

/** The summoner class BAB the eidolon's BAB replaces. */
function listReplacedBab(summoner: Summoner, synthesist: Synthesist) {
  return summoner.calculated.breakdowns.bab.applied.flatMap((modifier) =>
    modifier.builtIn &&
    modifier.sheetEntryId ===
      classProgressionEntryId(synthesist.classRuleIdentity)
      ? [{ label: modifier.entryName, value: modifier.value }]
      : [],
  );
}

/** Each fused skill total, with the eidolon's Skilled bonus it includes. */
function describeFusedSkills(
  fused: Calculated,
  skillBonuses: CombinedFormSubstitution['skillBonuses'],
): CombinedForm['skills'] {
  const skilled = new Map(
    skillBonuses.flatMap((bonus) =>
      bonus.bonusType === 'racial' ? [[bonus.target, bonus.value]] : [],
    ),
  );
  return fused.skills.map(({ key, name }) => ({
    skill: key,
    name,
    total: fused.breakdowns[key].total,
    skilled: skilled.get(key) ?? null,
  }));
}

/**
 * Ultimate Magic p. 80, Fused Eidolon: "The eidolon must be at least the
 * same size as the synthesist." A smaller eidolon is advised, not blocked.
 */
function checkFusedSize(
  summoner: Summoner,
  eidolonSize: CreatureSize,
): CombinedForm['advisories'] {
  const synthesistSize = summoner.calculated.racial.size ?? 'medium';
  return creatureSizes.indexOf(eidolonSize) <
    creatureSizes.indexOf(synthesistSize)
    ? [
        {
          kind: 'eidolonSmallerThanSynthesist',
          message: `Fused Eidolon requires the eidolon to be at least the synthesist’s size; this eidolon is ${eidolonSize} and the synthesist ${synthesistSize}.`,
        },
      ]
    : [];
}

/** The eidolon's score, and the modifier penalty its ability damage causes. */
function physicalScore(fusedEidolon: Calculated, ability: PhysicalAbility) {
  const { score, modifier } = fusedEidolon.abilities[ability];
  return { score, damagePenalty: Math.floor((score - 10) / 2) - modifier };
}

// Ultimate Magic p. 81: Shielded Meld (4th) grants +2; Greater Shielded
// Meld (12th) raises it to +4. Greatest first.
const shieldedMelds = [
  {
    featureIdentity: 'summoner-synthesist-greater-shielded-meld',
    name: 'Greater Shielded Meld',
    value: 4,
  },
  {
    featureIdentity: 'summoner-synthesist-shielded-meld',
    name: 'Shielded Meld',
    value: 2,
  },
] as const;

/**
 * The greatest Shielded Meld the summoner's Synthesist Grants supply. A
 * dormant or deactivated Grant supplies nothing.
 */
/** The greatest counting Shielded Meld of the synthesist, if any (Ultimate Magic p. 81). */
export function findShieldedMeld({ input, calculated }: Summoner) {
  const counting = new Set(
    calculated.resolvedEntries.flatMap(({ entry, counting }) =>
      counting && 'catalogEntryId' in entry
        ? [
            input.catalogEntries.find(
              (definition) => definition._id === entry.catalogEntryId,
            )?.ruleIdentity,
          ]
        : [],
    ),
  );
  const meld = shieldedMelds.find(({ featureIdentity }) =>
    [...counting].some((identity) => ruleKeyMatches(identity, featureIdentity)),
  );
  return meld ? { name: meld.name, value: meld.value } : null;
}

/**
 * The eidolon's skill contributions the synthesist gains: each Skilled
 * evolution's racial bonus (official FAQ), the only racial skill bonus an
 * eidolon's own rules add, and its size adjustments. The eidolon has no
 * skills of its own, so its ranks and finished totals are never read.
 */
function eidolonSkillBonuses(
  fusedEidolon: Calculated,
): CombinedFormSubstitution['skillBonuses'] {
  return fusedEidolon.skills.flatMap(({ key }) =>
    fusedEidolon.breakdowns[key].applied.flatMap((modifier) =>
      modifier.builtIn &&
      modifier.sheetEntryId.startsWith('builtin:eidolon:') &&
      (modifier.bonusType === 'racial' || modifier.bonusType === 'size')
        ? [
            {
              target: key,
              value: modifier.value,
              bonusType: modifier.bonusType,
              name: modifier.entryName,
            },
          ]
        : [],
    ),
  );
}
