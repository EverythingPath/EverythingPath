import {
  modifierTargets,
  type BonusType,
  type Modifier,
  type ModifierTarget,
  type Situation,
} from '~/lib/character-sheet';
import { formatModifier } from './sheet-parts';

// Readable names for the closed Modifier lists. Internal keys never reach
// the player; the pickers and breakdowns speak in these.

export const bonusTypeLabels: Record<BonusType, string> = {
  alchemical: 'alchemical',
  armor: 'armor',
  circumstance: 'circumstance',
  competence: 'competence',
  deflection: 'deflection',
  dodge: 'dodge',
  enhancement: 'enhancement',
  inherent: 'inherent',
  insight: 'insight',
  luck: 'luck',
  morale: 'morale',
  naturalArmor: 'natural armor',
  profane: 'profane',
  racial: 'racial',
  resistance: 'resistance',
  sacred: 'sacred',
  shield: 'shield',
  size: 'size',
  trait: 'trait',
  untyped: 'untyped',
  base: 'base',
};

/** Text colour per bonus type (approved prototype); amber stays for warnings. */
export const bonusTypeClasses: Record<BonusType, string> = {
  base: 'text-foreground',
  untyped: 'text-muted-foreground',
  racial: 'text-sky-300',
  trait: 'text-sky-300',
  enhancement: 'text-violet-300',
  armor: 'text-emerald-300',
  shield: 'text-emerald-300',
  naturalArmor: 'text-emerald-300',
  deflection: 'text-emerald-300',
  dodge: 'text-teal-300',
  resistance: 'text-indigo-300',
  morale: 'text-rose-300',
  luck: 'text-yellow-200',
  competence: 'text-cyan-300',
  insight: 'text-cyan-300',
  circumstance: 'text-muted-foreground',
  alchemical: 'text-lime-300',
  inherent: 'text-violet-300',
  profane: 'text-fuchsia-300',
  sacred: 'text-fuchsia-300',
  size: 'text-muted-foreground',
};

export const modifierTargetLabels: Record<ModifierTarget, string> = {
  'ability.str': 'Strength',
  'ability.dex': 'Dexterity',
  'ability.con': 'Constitution',
  'ability.int': 'Intelligence',
  'ability.wis': 'Wisdom',
  'ability.cha': 'Charisma',
  ac: 'All AC',
  'ac.armor': 'Armor AC',
  'ac.shield': 'Shield AC',
  'ac.natural': 'Natural armor AC',
  'ac.other': 'Other AC',
  saves: 'All saves',
  'save.fort': 'Fortitude save',
  'save.ref': 'Reflex save',
  'save.will': 'Will save',
  skills: 'All skills',
  'skill.acr': 'Acrobatics',
  'skill.apr': 'Appraise',
  'skill.blf': 'Bluff',
  'skill.clm': 'Climb',
  'skill.crf': 'Craft',
  'skill.dip': 'Diplomacy',
  'skill.dev': 'Disable Device',
  'skill.dis': 'Disguise',
  'skill.esc': 'Escape Artist',
  'skill.fly': 'Fly',
  'skill.han': 'Handle Animal',
  'skill.hea': 'Heal',
  'skill.int': 'Intimidate',
  'skill.kar': 'Knowledge (arcana)',
  'skill.kdu': 'Knowledge (dungeoneering)',
  'skill.ken': 'Knowledge (engineering)',
  'skill.kge': 'Knowledge (geography)',
  'skill.khi': 'Knowledge (history)',
  'skill.klo': 'Knowledge (local)',
  'skill.kna': 'Knowledge (nature)',
  'skill.kno': 'Knowledge (nobility)',
  'skill.kpl': 'Knowledge (planes)',
  'skill.kre': 'Knowledge (religion)',
  'skill.lin': 'Linguistics',
  'skill.per': 'Perception',
  'skill.prf': 'Perform',
  'skill.pro': 'Profession',
  'skill.rid': 'Ride',
  'skill.sen': 'Sense Motive',
  'skill.slt': 'Sleight of Hand',
  'skill.spl': 'Spellcraft',
  'skill.ste': 'Stealth',
  'skill.sur': 'Survival',
  'skill.swm': 'Swim',
  'skill.umd': 'Use Magic Device',
  bab: 'Base attack bonus',
  attack: 'All attacks',
  'attack.melee': 'Melee attack',
  'attack.ranged': 'Ranged attack',
  damage: 'All damage',
  'damage.melee': 'Melee damage',
  'damage.ranged': 'Ranged damage',
  cmb: 'CMB',
  cmd: 'CMD',
  init: 'Initiative',
  hp: 'Hit points',
  casterLevel: 'Caster level',
  spellDC: 'Spell DC',
  concentration: 'Concentration',
};

type TargetGroup = { label: string; targets: ModifierTarget[] };

const groupOf = (target: ModifierTarget) => {
  if (target.startsWith('ability.')) return 'Abilities';
  if (target === 'hp' || target === 'cmd' || target.startsWith('ac'))
    return 'Defenses';
  if (target.startsWith('save')) return 'Saves';
  if (target.startsWith('skill')) return 'Skills';
  if (
    target === 'bab' ||
    target === 'cmb' ||
    target === 'init' ||
    target.startsWith('attack') ||
    target.startsWith('damage')
  )
    return 'Offense';
  return 'Spellcasting';
};

/**
 * The statistic picker's options, grouped, parents ("All saves") first in
 * their group. `modifierTargets` has no `ability.$choice`: a manual row has
 * no ability choice to point at.
 */
export const targetPickerGroups: TargetGroup[] = [
  'Abilities',
  'Defenses',
  'Saves',
  'Skills',
  'Offense',
  'Spellcasting',
].map((label) => ({
  label,
  targets: modifierTargets.filter((target) => groupOf(target) === label),
}));

/** Display text of the shared Situation vocabulary (data model, "Conditional Modifiers"). */
const sharedSituationText: Record<string, string> = {
  traps: 'vs. traps',
  fear: 'vs. fear',
  spells: 'vs. spells',
  spellLikeAbilities: 'vs. spell-like abilities',
  poison: 'vs. poison',
  enchantment: 'vs. enchantment spells and effects',
  giants: 'vs. giants',
  orcsGoblinoids: 'vs. orcs and goblinoids',
  bullRushTrip: 'vs. bull rush and trip while standing on the ground',
  sneak: 'when flanking or the target is denied its Dex bonus',
  // Canonical reviewed CRB Condition identities retain their authored keys.
  'opposed-perception': 'on opposed Perception checks',
  'sight-based': 'on sight-based Perception checks',
  'reaction-check': 'on skill checks made as reactions',
  'grapple-or-escape': 'on grapple or escape checks',
  'grapple-while-invisible': 'vs. grapple while invisible',
  'sighted-opponent': 'vs. opponents that cannot see you',
  'ranged-attack': 'vs. ranged attacks',
  'melee-attack': 'vs. melee attacks',
  fightingDefensively: 'when fighting defensively',
  totalDefense: 'during total defense',
  charging: 'when charging',
  shootingIntoMelee: 'when shooting into melee',
  within30ft: 'within 30 ft.',
};

/** A key the table does not know still reads as words: `undead` → "vs. undead". */
const wordsOf = (key: string) =>
  key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

export function describeSituation(situation: Situation) {
  if (typeof situation === 'string')
    return sharedSituationText[situation] ?? `vs. ${wordsOf(situation)}`;
  if ('local' in situation) return situation.local;
  return 'a chosen option';
}

/** " (vs. poison)" for a shared Situation; " (only when raging)" for the entry's own. */
function describeWhen(situation: Situation | undefined) {
  if (situation === undefined) return '';
  if (typeof situation === 'string')
    return ` (${describeSituation(situation)})`;
  return ` (only when ${describeSituation(situation)})`;
}

// #724: a bonus that rises once its own skill has enough recorded ranks, as
// Skill Focus's `3 + 3 * min(1, floor(@skillRanks.spl / 10))`.
const skillRankStep =
  /^(\d+) \+ (\d+) \* min\(1, floor\(@skillRanks\.(\w+) \/ (\d+)\)\)$/;

function describeSkillRankStep({
  formula,
  target,
}: {
  formula: string;
  target: ModifierTarget;
}) {
  const [, base, step, skill, ranks] = skillRankStep.exec(formula) ?? [];
  if (!base || !step || !ranks || `skill.${skill}` !== target) return null;
  return {
    base: formatModifier(Number(base)),
    raised: `; ${formatModifier(Number(base) + Number(step))} with ${ranks} or more ranks`,
  };
}

/**
 * "+4 enhancement to Strength", "+2 racial to All saves (vs. poison)",
 * "+3 to Spellcraft; +6 with 10 or more ranks".
 */
export function describeModifier(modifier: Modifier) {
  const type =
    modifier.bonusType === 'untyped'
      ? ''
      : ` ${bonusTypeLabels[modifier.bonusType]}`;
  const step =
    typeof modifier.value === 'number'
      ? null
      : describeSkillRankStep({
          formula: modifier.value.formula,
          target: modifier.target,
        });
  const value =
    typeof modifier.value === 'number'
      ? formatModifier(modifier.value)
      : (step?.base ?? modifier.value.formula);
  return `${value}${type} to ${modifierTargetLabels[modifier.target]}${step?.raised ?? ''}${describeWhen(modifier.condition?.situation)}`;
}
