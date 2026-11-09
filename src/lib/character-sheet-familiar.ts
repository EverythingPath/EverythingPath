import {
  familiarAffectedStatisticTargets,
  type FamiliarUnresolvedTarget,
} from './character-sheet-familiar-targets';
import {
  representativeFamiliarProgression,
  findRepresentativeFamiliar,
} from './catalog/representative-familiars';
import { linkedInputKey } from './character-sheet-linked-input-evaluation';
import type {
  CompanionLinkedInput,
  CompanionLinkedInputResolution,
} from './character-sheet-linked-inputs';
import { skillDefinitions } from './character-sheet-skill-definitions';
import type { SkillCalculationRules } from './character-sheet-skills';
import type {
  FamiliarBaseCreatureKey,
  RepresentativeFamiliar,
} from './catalog/representative-familiars';
import type { CompanionSourceRuleKind } from './catalog/representative-companion-rules';
import type {
  InputSourcedModifier,
  ModifierTarget,
  SourcedModifier,
  CharacterSheetInput,
  ResolveOptions,
} from './character-sheet';
import type { SkillTarget } from './character-sheet-skills';
import { creatureSizeSkillBonuses } from './character-sheet-creature-sizes';

export type FamiliarCalculationInput = {
  baseCreatureKey?: FamiliarBaseCreatureKey | null;
  linkedInputs: readonly CompanionLinkedInputResolution[];
};

/** A familiar's natural attacks use the greater of Strength or Dexterity. */
export const familiarAttackOptions: Pick<
  ResolveOptions,
  'naturalAttackAbility'
> = { naturalAttackAbility: 'greaterStrengthDexterity' };

function familiarProgressionFor(level: number | null) {
  if (level === null || level < 1 || level > 20) return null;
  const row = [...representativeFamiliarProgression]
    .reverse()
    .find((row) => row.level <= level);
  if (!row) return null;
  const specialAbilities = [
    { level: 1, name: 'Alertness' },
    { level: 1, name: 'Improved evasion' },
    { level: 1, name: 'Share spells' },
    { level: 1, name: 'Empathic link' },
    { level: 3, name: 'Deliver touch spells' },
    { level: 5, name: 'Speak with master' },
    { level: 7, name: 'Speak with animals of its kind' },
    { level: 11, name: 'Spell resistance' },
    { level: 13, name: 'Scry on familiar' },
  ]
    .filter((ability) => ability.level <= level)
    .map(({ name }) => name);
  return {
    level,
    naturalArmor: row.naturalArmor,
    intelligence: row.intelligence,
    spellResistance: level >= 11 ? level + 5 : null,
    specialAbilities,
  };
}

export function resolveFamiliar({
  baseCreatureKey,
  linkedInputs,
  actualHitDice,
}: FamiliarCalculationInput & { actualHitDice?: number }) {
  const baseCreature = findRepresentativeFamiliar(baseCreatureKey);
  const unresolvedInputs: CompanionLinkedInput[] = [];
  function readAndRecordUnresolved(input: CompanionLinkedInput) {
    const value =
      linkedInputs.find(
        (row) => linkedInputKey(row.input) === linkedInputKey(input),
      )?.value ?? null;
    if (value === null) unresolvedInputs.push(input);
    return value;
  }
  const progressionLevel = readAndRecordUnresolved({
    kind: 'familiarProgressionLevels',
  });
  const progression = familiarProgressionFor(progressionLevel);
  const masterLevel = readAndRecordUnresolved({ kind: 'characterLevel' });
  const maximumHp = readAndRecordUnresolved({ kind: 'maximumHp' });
  const masterBab = readAndRecordUnresolved({ kind: 'baseAttackBonus' });
  const masterFort = readAndRecordUnresolved({
    kind: 'baseSave',
    save: 'fort',
  });
  const masterRef = readAndRecordUnresolved({ kind: 'baseSave', save: 'ref' });
  const masterWill = readAndRecordUnresolved({
    kind: 'baseSave',
    save: 'will',
  });
  const skillRanks: Partial<Record<SkillTarget, number | null>> =
    Object.fromEntries(
      skillDefinitions.map(({ key }) => {
        const ranks = readAndRecordUnresolved({
          kind: 'skillRanks',
          skill: key,
        });
        return [key, ranks === null || !baseCreature ? null : ranks];
      }),
    );
  const save = (master: number | null, own: number | undefined) =>
    master === null || own === undefined ? null : Math.max(master, own);
  const unresolvedTargets: FamiliarUnresolvedTarget[] = [];
  if (!baseCreature) unresolvedTargets.push('hitDice', 'size');
  if (!progression)
    unresolvedTargets.push('ability.int', 'ac.natural', 'familiar.progression');
  if (masterLevel === null || !baseCreature)
    unresolvedTargets.push('familiar.effectiveHitDice');
  if (maximumHp === null) unresolvedTargets.push('hp');
  if (masterBab === null)
    unresolvedTargets.push(
      'bab',
      'attack.melee',
      'attack.ranged',
      'cmb',
      'cmd',
    );
  if (masterFort === null || !baseCreature) unresolvedTargets.push('save.fort');
  if (masterRef === null || !baseCreature) unresolvedTargets.push('save.ref');
  if (masterWill === null || !baseCreature) unresolvedTargets.push('save.will');
  for (const { key } of skillDefinitions)
    if (skillRanks[key] === null) unresolvedTargets.push(key);
  const creatureHitDice = baseCreature
    ? (actualHitDice ?? baseCreature.normalHitDice)
    : null;
  return {
    isBaseCreatureUnavailable: baseCreature === null,
    affectedStatisticTargets:
      familiarAffectedStatisticTargets(unresolvedTargets),
    baseCreature: baseCreature
      ? {
          ...baseCreature,
          classSkills: [...baseCreature.classSkills],
          sources: [...baseCreature.sources],
        }
      : null,
    progression,
    actualHitDice: creatureHitDice,
    effectiveHitDice:
      masterLevel === null || creatureHitDice === null
        ? null
        : Math.max(masterLevel, creatureHitDice),
    maximumHp: maximumHp === null ? null : Math.floor(maximumHp / 2),
    baseAttackBonus: masterBab,
    baseSaves: {
      fort: save(masterFort, baseCreature?.baseSaves.fort),
      ref: save(masterRef, baseCreature?.baseSaves.ref),
      will: save(masterWill, baseCreature?.baseSaves.will),
    },
    skillRanks,
    unresolvedInputs,
    unresolvedTargets,
    linkedInputs: linkedInputs.map(
      ({
        input,
        candidates,
        status,
        resolution,
        value,
        fallback,
        interpretation,
        fallbackState,
        contributions,
        prerequisiteStatus,
      }) => ({
        input,
        candidates,
        status,
        resolution,
        value,
        fallback,
        interpretation,
        fallbackState,
        contributions,
        prerequisiteStatus,
      }),
    ),
  };
}
export type FamiliarFacts = ReturnType<typeof resolveFamiliar>;

export function prepareFamiliarCreatureInput({
  input,
  key = input.familiarBaseCreatureKey,
  companionKind = 'familiar',
}: {
  input: CharacterSheetInput;
  key?: FamiliarBaseCreatureKey | null;
  companionKind?: CompanionSourceRuleKind;
}): CharacterSheetInput {
  if (companionKind !== 'familiar') return input;
  const creature = findRepresentativeFamiliar(key);
  if (!creature) return input;
  return {
    ...input,
    familiarBaseCreatureKey: creature.key,
    racialHitDice: input.racialHitDice ?? {
      count: creature.normalHitDice,
      hpGained: 4,
      progression: {
        bab: 'threeQuarters',
        saves: { fort: 'good', ref: 'good', will: 'poor' },
        skillRanksPerHitDie: 2,
        classSkills: [...creature.classSkills],
      },
    },
  };
}

export function familiarModifiers({
  familiar,
  modifiers,
}: {
  familiar: FamiliarFacts;
  modifiers: readonly InputSourcedModifier[];
}): InputSourcedModifier[] {
  const own = modifiers.filter((modifier) => {
    if (
      modifier.builtIn &&
      (modifier.target === 'bab' ||
        modifier.target.startsWith('save.') ||
        modifier.target === 'hp')
    )
      return false;
    return !(
      familiar.progression &&
      modifier.target === 'ability.int' &&
      modifier.bonusType === 'base'
    );
  });
  const contribution = (
    target: ModifierTarget,
    value: number | null,
  ): SourcedModifier[] =>
    value === null
      ? []
      : [
          {
            target,
            value,
            bonusType: target === 'ability.int' ? 'base' : 'untyped',
            sheetEntryId: `builtin:familiar:${target}`,
            entryName: 'Familiar',
            source: `familiar:${target}`,
            builtIn: true,
          },
        ];
  return [
    ...own,
    ...contribution('bab', familiar.baseAttackBonus),
    ...contribution('hp', familiar.maximumHp),
    ...contribution('save.fort', familiar.baseSaves.fort),
    ...contribution('save.ref', familiar.baseSaves.ref),
    ...contribution('save.will', familiar.baseSaves.will),
    ...contribution('ac.natural', familiar.progression?.naturalArmor ?? null),
    ...contribution('ability.int', familiar.progression?.intelligence ?? null),
  ];
}

export function familiarSkillRules({
  familiar,
  baseCreature,
}: {
  familiar: FamiliarFacts | null;
  baseCreature: RepresentativeFamiliar | null;
}): SkillCalculationRules {
  const creature = baseCreature ?? familiar?.baseCreature;
  if (!creature) return {};
  return {
    baselineRanks: creature.skillRanks,
    classSkills: creature.classSkills,
    minimumRanks: familiar?.skillRanks,
    abilityOverrides: creature.dexterityClimb
      ? { 'skill.clm': 'dexterity' }
      : {},
    modifiers: ({ skill, ranks }) => {
      const size = creatureSizeSkillBonuses[creature.size];
      const sizeBonuses: Partial<Record<SkillTarget, number>> = {
        'skill.ste': size.stealth,
        'skill.fly': size.fly,
      };
      const sizeBonus = sizeBonuses[skill] ?? 0;
      let focusBonus = 0;
      if (creature.skillFocus === skill) focusBonus = ranks >= 10 ? 6 : 3;
      const bonuses = [
        {
          value: creature.racialSkillBonuses[skill] ?? 0,
          bonusType: 'racial',
          id: 'racial',
          name: 'Creature racial bonus',
        },
        {
          value: sizeBonus,
          bonusType: 'size',
          id: 'size',
          name: 'Creature size',
        },
        {
          value: focusBonus,
          bonusType: 'untyped',
          id: 'focus',
          name: 'Skill Focus',
        },
      ] satisfies {
        value: number;
        bonusType: SourcedModifier['bonusType'];
        id: string;
        name: string;
      }[];
      return bonuses
        .filter(({ value }) => value !== 0)
        .map(({ value, bonusType, id, name }) => ({
          target: skill,
          value,
          bonusType,
          sheetEntryId: `builtin:${skill}:familiar-${id}`,
          entryName: name,
          source: `familiar:${skill}:${id}`,
          builtIn: true,
        }));
    },
  };
}
