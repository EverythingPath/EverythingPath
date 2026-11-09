import {
  eidolonBaseForms,
  eidolonChosenClassSkillCount,
} from './catalog/representative-eidolons';
import { unchainedSubtypeChoiceOptions } from './catalog/representative-unchained-eidolons';
import { abilityKeys, abilityTargets } from './character-sheet-abilities';
import {
  broodSizePlaces,
  companionComponentLabels,
  getCompanionComponentRule,
} from './character-sheet-companion-components';
import type { CharacterSheetInput } from './character-sheet';
import {
  conflictingRuleKinds,
  conflictingRuleLabels,
  hasConflictingRules,
} from './character-sheet-companion-sources';
import {
  companionRankWarnings,
  type CompanionWarn,
} from './character-sheet-companion-rank-warnings';
import {
  pointCount,
  type EidolonProgressionResolution,
  type EidolonProgressionState,
} from './character-sheet-eidolon-progression';

/**
 * Advisory eidolon checks. Recorded selections are never trimmed: a shrinking
 * pool or an unmet requirement only warns, and the choices keep calculating.
 */
export function eidolonProgressionWarnings({
  input,
  state,
  progression,
  warn,
}: {
  input: CharacterSheetInput;
  state: EidolonProgressionState;
  progression: EidolonProgressionResolution;
  warn: CompanionWarn;
}) {
  if (progression.versionMismatch) {
    const [own, other] =
      progression.version === 'unchained'
        ? ['An Unchained', 'original']
        : ['An original', 'Unchained'];
    warn(
      'eidolonVersionMismatch',
      `${own} eidolon advances only from summoner levels of its own version, and its supporting summoner levels are ${other} summoner levels, which Pathfinder Unchained has a Character use exclusively of the other version. Every recorded choice is kept; change the eidolon’s or the summoner’s version to calculate it.`,
      [progression.version, progression.contributions],
      'unresolved',
    );
  } else if (ruleConflictWarning({ progression, warn })) {
    // The conflict explains the unresolved progression.
  } else if (progression.status === 'unresolved')
    warn(
      'companionProgressionUnresolved',
      'Eidolon progression needs an available summoner level within the level 1–20 table.',
      progression.contributions,
      'unresolved',
    );
  if (progression.status === 'dormant')
    warn(
      'companionProgressionDormant',
      'Eidolon choices are retained while no summoner source counts.',
      [state.baseForm, state.keep],
    );
  broodWarnings({ progression, warn });
  poolWarnings({ progression, warn });
  rankWarnings({ state, progression, warn });
  formWarnings({ input, state, progression, warn });
  versionWarnings({ state, progression, warn });
}

/**
 * Rules that each change the progression of one counting source, with no
 * published precedence (#420): no rule wins, and nothing recorded is lost.
 */
function ruleConflictWarning({
  progression,
  warn,
}: {
  progression: EidolonProgressionResolution;
  warn: CompanionWarn;
}) {
  if (!hasConflictingRules(progression.contributions)) return false;
  const conflicts = conflictingRuleKinds(progression.contributions);
  // Without access to the summoner the competing rules stay unnamed.
  if (!conflicts.length) {
    warn(
      'companionProgressionRuleConflict',
      'Rules on the summoner each change how this eidolon advances from the same summoner levels, and no published rule decides between them. Every recorded choice and share is kept until one of them is turned off.',
      ['undisclosed'],
      'unresolved',
    );
    return true;
  }
  warn(
    'companionProgressionRuleConflict',
    `${listAll(conflictingRuleLabels(progression.contributions))} each change how this eidolon advances from the same summoner levels, and no published rule decides between them. Every recorded choice and share is kept; turn one of the Archetypes off to calculate the eidolon.`,
    conflicts,
    'unresolved',
  );
  return true;
}

/**
 * Unchained subtype checks, and recorded state the current version's rules
 * do not offer: it stays recorded and visible, but it does not count.
 */
function versionWarnings({
  state,
  progression,
  warn,
}: {
  state: EidolonProgressionState;
  progression: EidolonProgressionResolution;
  warn: CompanionWarn;
}) {
  const { subtype } = progression;
  if (progression.version === 'unchained' && !state.subtype)
    warn(
      'eidolonSubtypeMissing',
      'Choose the Unchained eidolon’s subtype; it decides the base forms it may take and the evolutions it gains.',
      [state.baseForm],
      'incomplete',
    );
  if (subtype && !subtype.baseForms.includes(state.baseForm))
    warn(
      'eidolonSubtypeBaseForm',
      `${subtype.name} eidolons use the ${subtype.baseForms.map((form) => eidolonBaseForms[form].name).join(' or ')} base form; the recorded ${eidolonBaseForms[state.baseForm].name} base form is kept.`,
      [subtype.key, state.baseForm],
    );
  if (subtype?.missingChoices.length)
    warn(
      'eidolonSubtypeChoiceMissing',
      `Choose the ${subtype.name} subtype’s ${subtype.missingChoices.map((key) => unchainedSubtypeChoiceOptions[key].label).join(', ')}.`,
      [subtype.key, subtype.missingChoices],
      'incomplete',
    );
  const versionDormantChoices = progression.dormantChoices.filter(
    (item) => item.reason === 'version',
  );
  const dormantEvolutions = progression.evolutions.filter(
    (item) => item.dormant.length,
  );
  const version = progression.version === 'unchained' ? 'Unchained' : 'APG';
  const messages = [
    ...versionDormantChoices.map(dormantChoiceMessage),
    ...dormantEvolutions.map((item) => dormantEvolutionMessage(item, version)),
  ];
  if (messages.length)
    warn('eidolonVersionUnavailable', messages.join(' '), [
      progression.version,
      versionDormantChoices,
      dormantEvolutions.map(({ key, choice, upgrades, dormant }) => [
        key,
        choice,
        upgrades,
        dormant,
      ]),
    ]);
  for (const name of progression.unsupportedArchetypes)
    warn(
      'eidolonUnchainedArchetype',
      `${name} was written for the original summoner; its eidolon changes are not applied to an Unchained eidolon.`,
      [name],
    );
}

/**
 * Broodmaster component checks (UM p. 78). Recorded shares and group
 * purchases are never trimmed or moved to another eidolon.
 */
function broodWarnings({
  progression,
  warn,
}: {
  progression: EidolonProgressionResolution;
  warn: CompanionWarn;
}) {
  const { brood } = progression;
  const contribution = progression.contributions.find(
    (item) => item.kind === 'component' && item.counting,
  );
  if (!brood || contribution?.kind !== 'component') return;
  const { label } = getCompanionComponentRule(contribution.ruleKind);
  if (brood.missing.length)
    warn(
      'companionComponentMissing',
      `Allocate this eidolon’s ${listAll(
        brood.missing.map((key) => companionComponentLabels[key]),
      )} from the ${label} brood.`,
      [contribution.ruleKind, brood.missing],
      'unresolved',
    );
  const hitDice = brood.components?.hitDice;
  if (hitDice !== undefined && hitDice < 1)
    warn(
      'broodEidolonHitDice',
      `Each ${label} eidolon has at least 1 Hit Die; ${hitDice} is recorded.`,
      [contribution.ruleKind, hitDice],
    );
  const { pool, budget } = brood;
  if (pool && budget && brood.overBudgetComponents.length)
    warn(
      'companionComponentBudget',
      `${label} allocations across ${pool.companions} eidolons exceed the brood’s budget: ${brood.overBudgetComponents
        .map(
          (key) =>
            `${companionComponentLabels[key]} ${pool.allocated[key]} of ${budget[key]}`,
        )
        .join('; ')}. Recorded allocations are kept.`,
      [contribution.ruleKind, budget, pool.allocated],
    );
  const unmet = (brood.groupPurchases ?? []).filter(
    (purchase) => purchase.issues.length,
  );
  if (unmet.length)
    warn(
      'companionGroupPurchase',
      unmet
        .map(
          (purchase) =>
            `The brood’s ${purchase.label.toLowerCase()}: ${purchase.issues.join(' ')}`,
        )
        .join(' '),
      unmet.map(({ key, issues }) => [key, issues]),
    );
  if (
    brood.largestSize &&
    broodSizePlaces(progression.size) > broodSizePlaces(brood.largestSize)
  )
    warn(
      'broodEidolonSize',
      `The brood’s group purchases allow eidolons up to ${brood.largestSize}; this eidolon is ${progression.size}.`,
      [progression.size, brood.largestSize],
    );
}

/** Joins names as "A, B and C". */
export function listAll(names: readonly string[]) {
  if (names.length < 2) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
}

function dormantChoiceMessage(
  item: EidolonProgressionResolution['dormantChoices'][number],
) {
  if (item.kind === 'subtype')
    return `The Unchained subtype ${item.label} is kept without counting on an original eidolon.`;
  return `The Unchained ${item.label} choice (${item.choice ?? ''}) is kept without counting on an original eidolon.`;
}

function dormantEvolutionMessage(
  item: EidolonProgressionResolution['evolutions'][number],
  version: string,
) {
  const parts = item.dormant
    .map((part) => (part === 'choice' ? 'choice' : 'upgrade'))
    .join(' and ');
  const verb = item.dormant.length === 1 ? 'is' : 'are';
  return `${item.name}: its recorded ${parts} ${verb} not part of the ${version} rules and ${verb} kept without counting.`;
}

function poolWarnings({
  progression,
  warn,
}: {
  progression: EidolonProgressionResolution;
  warn: CompanionWarn;
}) {
  const { total, spent, remaining, sources } = progression.evolutionPool;
  if (total !== null && remaining !== null && remaining < 0)
    warn(
      'eidolonEvolutionPoolBudget',
      `Evolutions cost ${pointCount(spent)}, above the ${total}-point evolution pool; every recorded evolution is kept.`,
      [total, spent, sources],
    );
  if (total !== null && remaining !== null && remaining > 0)
    warn(
      'eidolonEvolutionPointsUnspent',
      `The evolution pool has ${pointCount(remaining)} left to spend.`,
      [total, spent],
      'incomplete',
    );
  const maxAttacks = progression.budgets.maxAttacks;
  if (maxAttacks !== null && progression.attackCount > maxAttacks)
    warn(
      'eidolonMaxAttacks',
      `Evolutions give ${progression.attackCount} natural attacks, above the eidolon’s maximum of ${maxAttacks}.`,
      [
        maxAttacks,
        progression.naturalAttacks.map(({ type, count }) => [type, count]),
      ],
    );
  const unmet = progression.evolutions.filter((item) => item.issues.length);
  if (unmet.length)
    warn(
      'eidolonEvolutionRequirement',
      unmet.map((item) => `${item.name}: ${item.issues.join(' ')}`).join(' '),
      unmet.map(({ key, choice, issues }) => [key, choice, issues]),
    );
  const missing = progression.evolutions.filter(
    (item) => item.missingChoice && item.origin === 'chosen',
  );
  if (missing.length)
    warn(
      'eidolonEvolutionChoiceMissing',
      `Choose what ${missing.map((item) => item.name).join(', ')} ${missing.length === 1 ? 'applies' : 'apply'} to.`,
      missing.map(({ key }) => key),
      'incomplete',
    );
}

function rankWarnings({
  state,
  progression,
  warn,
}: {
  state: EidolonProgressionState;
  progression: EidolonProgressionResolution;
  warn: CompanionWarn;
}) {
  companionRankWarnings({
    creature: 'eidolon',
    skillRanks: state.skillRanks,
    abilityIncreases: state.abilityIncreases,
    budgets: progression.budgets,
    hitDice: progression.hitDice,
    warn,
  });
  if (state.classSkills.length > eidolonChosenClassSkillCount)
    warn(
      'eidolonClassSkillCount',
      `The summoner chooses ${eidolonChosenClassSkillCount} additional eidolon class skills; ${state.classSkills.length} are recorded.`,
      state.classSkills,
    );
}

function formWarnings({
  input,
  state,
  progression,
  warn,
}: {
  input: CharacterSheetInput;
  state: EidolonProgressionState;
  progression: EidolonProgressionResolution;
  warn: CompanionWarn;
}) {
  const { total } = progression.armor;
  if (total !== null && state.armorBonusAsArmor > total)
    warn(
      'eidolonArmorBonusSplit',
      `Only ${total} of the table armor bonus can become an armor bonus; ${state.armorBonusAsArmor} is recorded.`,
      [total, state.armorBonusAsArmor],
    );
  const base = input.entries.find((entry) => entry.kind === 'base');
  const definition =
    base && 'catalogEntryId' in base
      ? input.catalogEntries.find((entry) => entry._id === base.catalogEntryId)
      : undefined;
  if (!definition) return;
  const form = eidolonBaseForms[state.baseForm];
  const recorded = Object.fromEntries(
    abilityKeys.map((ability) => [
      ability,
      definition.modifiers.find(
        (modifier) => modifier.target === abilityTargets[ability],
      )?.value,
    ]),
  );
  if (abilityKeys.some((ability) => recorded[ability] !== form.scores[ability]))
    warn(
      'eidolonBaseFormScores',
      `The ${form.name} base form starts with Str ${form.scores.strength}, Dex ${form.scores.dexterity}, Con ${form.scores.constitution}, Int ${form.scores.intelligence}, Wis ${form.scores.wisdom} and Cha ${form.scores.charisma}; recorded base scores are kept.`,
      [state.baseForm, recorded],
    );
}
