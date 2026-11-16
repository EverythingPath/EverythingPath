import {
  eidolonBaseFormKeys,
  eidolonBaseForms,
  eidolonChoiceOptionLabel,
  eidolonChoiceOptions,
  eidolonEvolutionKeys,
  eidolonEvolutions,
  type EidolonBaseFormKey,
  type EidolonEvolutionKey,
} from '~/lib/catalog/representative-eidolons';
import {
  unchainedEidolonEvolutions,
  unchainedEidolonSubtypeKeys,
  unchainedEidolonSubtypes,
  unchainedSubtypeChoiceKeys,
  unchainedSubtypeChoiceOptions,
  type UnchainedEidolonSubtypeKey,
  type UnchainedEvolutionDefinition,
  type UnchainedSubtypeChoiceKey,
} from '~/lib/catalog/representative-unchained-eidolons';
import {
  companionComponentKeys,
  companionComponentLabels,
} from '~/lib/character-sheet-companion-components';
import { naturalAttackRoleLabel } from '~/lib/character-sheet-natural-attacks';
import { ordinal } from '~/lib/character-sheet-spell-labels';
import { skillDefinitions } from '~/lib/character-sheet-skill-definitions';
import {
  eidolonVersionRuleKinds,
  isEidolonState,
  pointCount,
  type EidolonEvolutionSelection,
  type EidolonProgressionResolution,
  type EidolonProgressionState,
  type EidolonVersion,
} from '~/lib/character-sheet-eidolon-progression';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { buildSheetWarningViews } from './character-sheet-warning-view-model';
import {
  contributionFamilyLabel,
  describeCompanionAllocation,
  formatCount,
  reductionStepLabel,
} from './character-companion-allocations-view-model';
import { classLabels } from '~/lib/catalog/representative-companion-rules';
import {
  conflictingRuleLabels,
  hasConflictingRules,
  getCompanionReductionRule,
} from '~/lib/character-sheet-companion-sources';
import { listAll } from '~/lib/character-sheet-eidolon-warnings';

const statusLabels: Record<EidolonProgressionResolution['status'], string> = {
  active: 'Active',
  dormant: 'Not counting now',
  unresolved: 'Unresolved',
};
const valueLabels: Record<
  EidolonProgressionResolution['contributions'][number]['resolution'],
  string
> = {
  calculated: 'Calculated',
  interpretation: 'Chosen interpretation',
  precedence: 'Published precedence',
  fallback: 'Using saved fallback',
  unresolved: 'Unresolved',
};
const sizeLabels: Partial<
  Record<EidolonProgressionResolution['size'], string>
> = { small: 'Small', medium: 'Medium', large: 'Large', huge: 'Huge' };
const skillOptions = skillDefinitions.map(({ key, name }) => ({
  value: key,
  label: name,
}));
/** An evolution choice's curated label, such as a Skilled skill's name. */
export const eidolonEvolutionChoiceLabel = (
  key: EidolonEvolutionKey,
  value: string,
) =>
  (eidolonEvolutions[key].choice === 'skill'
    ? skillOptions.find((option) => option.value === value)?.label
    : eidolonChoiceOptionLabel(key, value)) ?? value;

const evolutionNames = (
  references: readonly { key: EidolonEvolutionKey; choice?: string }[],
) =>
  references.map(({ key, choice }) =>
    choice
      ? `${eidolonEvolutions[key].name} (${eidolonEvolutionChoiceLabel(key, choice)})`
      : eidolonEvolutions[key].name,
  );

export const eidolonBaseFormChoices = eidolonBaseFormKeys.map((value) => {
  const form = eidolonBaseForms[value];
  return {
    value,
    label: form.name,
    speed: form.speed,
    scores: form.scores,
    goodSaves: form.goodSaves,
    freeEvolutions: evolutionNames(form.freeEvolutions),
  };
});

export const eidolonVersionChoices: readonly {
  value: EidolonVersion;
  label: string;
  description: string;
}[] = [
  {
    value: 'original',
    label: 'Original',
    description:
      'Advanced Player’s Guide eidolon, for original summoner levels.',
  },
  {
    value: 'unchained',
    label: 'Unchained',
    description:
      'Pathfinder Unchained eidolon with a subtype, for Unchained summoner levels.',
  },
];
const versionLabels: Record<EidolonVersion, string> = {
  original: 'Original',
  unchained: 'Unchained',
};

/**
 * The Unchained subtypes for the subtype choice: alignment, the base forms
 * the subtype allows with their free evolutions, the evolutions it grants by
 * summoner level and the choices it asks for.
 */
export const unchainedEidolonSubtypeChoices = unchainedEidolonSubtypeKeys.map(
  (value) => {
    const subtype = unchainedEidolonSubtypes[value];
    const levels = [
      ...new Set(subtype.evolutions.map(({ level }) => level)),
    ].sort((a, b) => a - b);
    return {
      value,
      label: subtype.name,
      alignment: subtype.alignment,
      pages: subtype.pages,
      baseForms: eidolonBaseFormKeys.flatMap((form) => {
        const free = subtype.baseForms[form];
        return free
          ? [
              {
                value: form,
                label: eidolonBaseForms[form].name,
                freeEvolutions: evolutionNames(free),
              },
            ]
          : [];
      }),
      evolutionsByLevel: levels.map((level) => ({
        level,
        names: evolutionNames(
          subtype.evolutions.filter((item) => item.level === level),
        ),
      })),
      features: subtype.features.map(({ level, text }) => ({ level, text })),
      choices: unchainedSubtypeChoiceKeys
        .filter((key) => unchainedSubtypeChoiceOptions[key].subtype === value)
        .map((key) => ({ key, ...unchainedSubtypeChoiceOptions[key] })),
    };
  },
);

function catalogFor(
  definitions: Record<EidolonEvolutionKey, UnchainedEvolutionDefinition>,
) {
  return eidolonEvolutionKeys.map((key) => {
    const definition = definitions[key];
    const options =
      definition.choice === 'skill'
        ? skillOptions
        : definition.choice
          ? eidolonChoiceOptions[definition.choice]
          : [];
    return {
      key,
      name: definition.name,
      cost: definition.cost,
      summary: definition.summary,
      minimumLevel: definition.minimumLevel ?? null,
      baseForms:
        definition.baseForms?.map((form) => eidolonBaseForms[form].name) ??
        null,
      /** Unchained subtypes allowed to take it; null when any may. */
      subtypes:
        definition.subtypes?.map(
          (subtype) => unchainedEidolonSubtypes[subtype].name,
        ) ?? null,
      choiceOptions: options.map((option) => ({
        ...option,
        extraCost: definition.choiceCosts?.[option.value] ?? 0,
      })),
      upgrade: definition.upgrade ?? null,
    };
  });
}
/** The curated evolution list for the picker, grouped by cost by the UI. */
export const eidolonEvolutionCatalog = catalogFor(eidolonEvolutions);
const unchainedEidolonEvolutionCatalog = catalogFor(unchainedEidolonEvolutions);
/** Each version's evolution list: the Unchained one has its own rules. */
export function eidolonEvolutionCatalogFor(version: EidolonVersion) {
  return version === 'unchained'
    ? unchainedEidolonEvolutionCatalog
    : eidolonEvolutionCatalog;
}

export function newEidolonProgression(
  baseForm: EidolonBaseFormKey,
  version: EidolonVersion = 'original',
): EidolonProgressionState {
  return {
    kind: 'eidolon',
    ...(version === 'unchained' ? { version, subtypeChoices: [] } : {}),
    baseForm,
    size: 'medium',
    hpGained: null,
    skillRanks: {},
    abilityIncreases: [],
    classSkills: [],
    armorBonusAsArmor: 0,
    evolutions: [],
    keep: false,
  };
}
/** Changing the version keeps every recorded choice for the other rules. */
export function withEidolonVersion(
  state: EidolonProgressionState,
  version: EidolonVersion,
): EidolonProgressionState {
  return { ...state, version };
}
/** A new subtype keeps the former subtype's choices, dormant until return. */
export function withEidolonSubtype(
  state: EidolonProgressionState,
  subtype: UnchainedEidolonSubtypeKey,
): EidolonProgressionState {
  return { ...state, subtype };
}
export function withEidolonSubtypeChoice(
  state: EidolonProgressionState,
  key: UnchainedSubtypeChoiceKey,
  choice: string,
): EidolonProgressionState {
  return {
    ...state,
    subtypeChoices: [
      ...(state.subtypeChoices ?? []).filter((item) => item.key !== key),
      { key, choice },
    ],
  };
}
/**
 * Discards one dormant entry: a subtype choice leaves `subtypeChoices`; the
 * subtype itself leaves an original eidolon. Every other choice is kept.
 */
export function withoutEidolonDormantChoice(
  state: EidolonProgressionState,
  entry: { kind: 'subtype' | 'subtypeChoice'; key: string },
): EidolonProgressionState {
  if (entry.kind === 'subtype') {
    const { subtype: _subtype, ...rest } = state;
    return rest;
  }
  return {
    ...state,
    subtypeChoices: (state.subtypeChoices ?? []).filter(
      (item) => item.key !== entry.key,
    ),
  };
}
export function withEidolonEvolution(
  state: EidolonProgressionState,
  selection: EidolonEvolutionSelection,
): EidolonProgressionState {
  return { ...state, evolutions: [...state.evolutions, selection] };
}
export function withoutEidolonEvolution(
  state: EidolonProgressionState,
  index: number,
): EidolonProgressionState {
  return {
    ...state,
    evolutions: state.evolutions.filter((_, position) => position !== index),
  };
}

function projectionView(
  calculated: Pick<
    CharacterSheetSnapshot['calculated'],
    | 'companionProgression'
    | 'level'
    | 'hitDice'
    | 'hp'
    | 'derivedStatistics'
    | 'warnings'
  >,
  acceptedWarnings: CharacterSheetSnapshot['acceptedWarnings'],
) {
  const progression =
    calculated.companionProgression?.kind === 'eidolon'
      ? calculated.companionProgression
      : null;
  if (!progression) return null;
  const isResolved = progression.hitDice !== null;
  const resolved = (value: number | null) => (isResolved ? value : null);
  const pool = progression.evolutionPool;
  const maxAttacks = progression.budgets.maxAttacks;
  const ownRuleKinds = eidolonVersionRuleKinds(progression.version);
  const otherVersion =
    progression.version === 'unchained' ? 'Original' : 'Unchained';
  return {
    version: progression.version,
    versionLabel: versionLabels[progression.version],
    /** Supporting summoner levels are of the other version; see the warning. */
    versionMismatch: progression.versionMismatch,
    subtype: progression.subtype
      ? {
          ...progression.subtype,
          elementLabel: progression.subtype.element
            ? (unchainedSubtypeChoiceOptions['elemental-element'].options.find(
                (option) => option.value === progression.subtype?.element,
              )?.label ?? progression.subtype.element)
            : null,
          baseFormNames: progression.subtype.baseForms.map(
            (form) => eidolonBaseForms[form].name,
          ),
          missingChoices: progression.subtype.missingChoices.map((key) => ({
            key,
            ...unchainedSubtypeChoiceOptions[key],
          })),
        }
      : null,
    /** Recorded subtype state kept without counting, for “Not counting now”. */
    dormantChoices: progression.dormantChoices.map(
      ({ kind, key, label, choice, reason }) => ({
        kind,
        key,
        label,
        choice,
        reasonLabel:
          reason === 'version'
            ? 'Not part of the original rules'
            : 'Belongs to another subtype',
      }),
    ),
    unsupportedArchetypes: progression.unsupportedArchetypes,
    status: progression.status,
    statusLabel: statusLabels[progression.status],
    summonerLevel: progression.effectiveLevel,
    actualHitDice: resolved(calculated.hitDice),
    classLevels: calculated.level,
    hp: calculated.hp,
    bab: resolved(calculated.derivedStatistics.bab.total),
    saves: {
      fortitude: resolved(calculated.derivedStatistics.fortitude.total),
      reflex: resolved(calculated.derivedStatistics.reflex.total),
      will: resolved(calculated.derivedStatistics.will.total),
    },
    sizeLabel: isResolved
      ? (sizeLabels[progression.size] ?? progression.size)
      : 'Unresolved',
    armor: progression.armor,
    strengthDexterityBonus: progression.strengthDexterityBonus,
    budgets: progression.budgets,
    pool: {
      ...pool,
      isOverBudget: pool.remaining !== null && pool.remaining < 0,
      sources: pool.sources.map((source) => ({
        ...source,
        sourceLabel: 'Eidolon',
      })),
    },
    brood: broodView(progression.brood),
    reduction: reductionView(progression.contributions),
    ruleConflict: ruleConflictView(progression.contributions),
    contributions: progression.contributions.map((source) => ({
      ...source,
      sourceLabel: eidolonSourceLabels[source.ruleKind] ?? 'Eidolon',
      /** Summoner levels of the other version, listed without counting. */
      isOtherVersion: !ownRuleKinds.includes(source.ruleKind),
      valueLabel: contributionValueLabel({
        source,
        isOtherVersion: !ownRuleKinds.includes(source.ruleKind),
        otherVersion,
      }),
      hasSavedFallback: source.fallbackState !== 'none',
      allocationSummary: describeCompanionAllocation(source),
      familyLabel: contributionFamilyLabel(source),
    })),
    maxAttacks,
    attackCount: progression.attackCount,
    isOverAttackLimit:
      maxAttacks !== null && progression.attackCount > maxAttacks,
    naturalAttacks: progression.naturalAttacks.map((attack) => ({
      ...attack,
      // The resolver names an attack by its evolution; only Wing Buffet's
      // attacks read differently.
      name: attack.type === 'wing' ? 'Wing buffets' : attack.name,
      roleLabel: naturalAttackRoleLabel(attack.role),
      missing: Math.max(0, attack.count - attack.recorded),
      /** The printed Medium dice, to prefill a new natural attack entry. */
      mediumDice:
        attack.evolutions
          .map(({ key }) => eidolonEvolutions[key].attack?.dice.medium)
          .find((dice) => dice !== undefined) ?? null,
    })),
    evolutions: progression.evolutions.map((item) => ({
      ...item,
      choiceLabel: item.choice
        ? eidolonEvolutionChoiceLabel(item.key, item.choice)
        : null,
      /** Base form and subtype evolutions cannot be removed. */
      isFixed: item.origin !== 'chosen',
      costLabel: evolutionCostLabel(item, progression.subtype?.name),
      dormantLabel: item.dormant.length
        ? `${item.dormant.map((part) => (part === 'choice' ? 'Choice' : 'Upgrade')).join(' and ')} not part of the ${versionLabels[progression.version]} rules`
        : null,
    })),
    multiattack: progression.multiattack,
    classSkills: progression.classSkills.map(
      (key) => skillDefinitions.find((skill) => skill.key === key)?.name ?? key,
    ),
    features: progression.features,
    sources: progression.sources,
    restrictions: progression.restrictions,
    retained: progression.retained,
    warnings: buildSheetWarningViews(
      calculated.warnings.filter(
        (warning) => warning.subject === 'companionProgression',
      ),
      acceptedWarnings,
    ),
  };
}

const eidolonSourceLabels: Partial<
  Record<
    EidolonProgressionResolution['contributions'][number]['ruleKind'],
    string
  >
> = {
  broodmasterEidolon: 'Eidolon brood',
  masterSummonerEidolon: 'Lesser eidolon',
  synthesistEidolon: 'Fused eidolon',
};

type Contribution = EidolonProgressionResolution['contributions'][number];
/** How one summoner source's level counts toward the eidolon. */
function contributionValueLabel({
  source,
  isOtherVersion,
  otherVersion,
}: {
  source: Contribution;
  isOtherVersion: boolean;
  otherVersion: string;
}) {
  if (isOtherVersion) return `${otherVersion} summoner levels`;
  if (!source.counting) return 'Not contributing';
  if (hasConflictingRules([source])) return 'Competing rules';
  return valueLabels[source.resolution];
}
/**
 * A counting reduced progression (#420), such as Master Summoner's Lesser
 * Eidolon: the actual summoner level, each step in order and the level the
 * table is read at. Null for an eidolon without one.
 */
function reductionView(contributions: readonly Contribution[]) {
  const reduced = contributions.find(
    (item): item is Extract<Contribution, { kind: 'reduced' }> =>
      item.kind === 'reduced' && item.counting,
  );
  if (!reduced) return null;
  const rule = getCompanionReductionRule(reduced.ruleKind);
  const family = classLabels[rule.classRuleIdentity] ?? rule.classRuleIdentity;
  return {
    label: `${rule.featureLabel} (${rule.label})`,
    /** The summoner's actual level, never reduced on its own sheet. */
    summonerLevel: reduced.classLevels,
    tableLevel: reduced.effectiveLevel,
    steps: [
      { label: `${family} level`, value: reduced.classLevels },
      ...reduced.reduction.steps.map((step) => ({
        label: reductionStepLabel(step),
        value: step.result,
      })),
    ],
  };
}

/** Rules competing for one counting source, with no published precedence. */
function ruleConflictView(contributions: readonly Contribution[]) {
  if (!hasConflictingRules(contributions)) return null;
  const labels = conflictingRuleLabels(contributions);
  // Undisclosed without access to the summoner: no rule is named.
  if (!labels.length)
    return {
      labels,
      summary:
        'Rules on the summoner compete to change this eidolon’s progression; it calculates once one of them is turned off.',
    };
  return {
    labels,
    summary: `${listAll(labels)} ${labels.length === 2 ? 'both' : 'all'} change this eidolon’s progression; turn one of the Archetypes off to calculate it.`,
  };
}

type EvolutionRow = EidolonProgressionResolution['evolutions'][number];
/** Where an evolution comes from, or what it costs from the pool. */
function evolutionCostLabel(
  item: EvolutionRow,
  subtypeName: string | undefined,
) {
  if (item.origin === 'baseForm') return 'Base form';
  if (item.origin === 'subtype')
    return `${subtypeName ?? 'Subtype'} subtype, ${ordinal(item.level ?? 1)} level`;
  if (!item.paidByGroup) return pointCount(item.cost);
  // The brood's huge purchase paid for the large evolution (UM p. 78).
  return item.cost
    ? `Paid by the brood, ${pointCount(item.cost)} more`
    : 'Paid by the brood';
}

/**
 * A Broodmaster eidolon's divided components (#419): each recorded share
 * beside the whole brood's budget when the summoner is visible, the missing
 * shares, the brood's group purchases and its largest allowed size.
 */
function broodView(
  brood: Extract<
    NonNullable<CharacterSheetSnapshot['calculated']['companionProgression']>,
    { kind: 'eidolon' }
  >['brood'],
) {
  if (!brood) return null;
  return {
    components: companionComponentKeys.map((key) => ({
      key,
      label: companionComponentLabels[key],
      value: brood.components?.[key] ?? null,
      budget: brood.budget?.[key] ?? null,
      broodTotal: brood.pool?.allocated[key] ?? null,
      overBudget: brood.overBudgetComponents.includes(key),
    })),
    missingLabels: brood.missing.map((key) => companionComponentLabels[key]),
    budgetLabel: brood.budget
      ? `From a brood of ${formatCount(brood.pool?.companions ?? 0, 'eidolon')}`
      : 'The brood’s budget is unresolved',
    groupPurchases: brood.groupPurchases,
    largestSizeLabel: brood.largestSize
      ? (sizeLabels[brood.largestSize] ?? brood.largestSize)
      : null,
  };
}

/**
 * The eidolon's progression for display: recorded choices, the summoner's
 * pool with its source, and both projections. It never recalculates rules.
 */
export function buildEidolonProgressionView(snapshot: CharacterSheetSnapshot) {
  const ordinary = projectionView(
    snapshot.calculated,
    snapshot.acceptedWarnings,
  );
  const permanent = projectionView(
    snapshot.permanentCalculated,
    snapshot.acceptedWarnings,
  );
  if (!ordinary || !permanent) return null;
  const recorded = snapshot.entries.find((entry) => entry.kind === 'base')
    ?.state.companionProgression;
  const choices = recorded && isEidolonState(recorded) ? recorded : null;
  return {
    baseFormName: choices ? eidolonBaseForms[choices.baseForm].name : null,
    subtypeName: choices?.subtype
      ? unchainedEidolonSubtypes[choices.subtype].name
      : null,
    choices,
    ordinary,
    permanent,
  };
}

export type EidolonProgressionView = NonNullable<
  ReturnType<typeof buildEidolonProgressionView>
>;
