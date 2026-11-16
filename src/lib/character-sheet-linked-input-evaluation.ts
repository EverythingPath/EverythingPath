import type {
  CompanionLinkedInput,
  CompanionLinkedInputResolution,
} from './character-sheet-linked-inputs';
import type { PrerequisiteStatus } from './character-sheet-prerequisite-status';

export function linkedInputKey(input: CompanionLinkedInput): string {
  switch (input.kind) {
    case 'classLevels':
      return JSON.stringify([input.kind, input.classRuleIdentity]);
    case 'baseSave':
      return JSON.stringify([input.kind, input.save]);
    case 'skillRanks':
      return JSON.stringify([input.kind, input.skill]);
    case 'abilityModifier':
      return JSON.stringify([input.kind, input.ability]);
    case 'familiarProgressionLevels':
    case 'characterLevel':
    case 'actualHitDice':
    case 'baseAttackBonus':
    case 'maximumHp':
      return JSON.stringify([input.kind]);
  }
  const unsupported: never = input;
  throw new Error(`Unknown linked input: ${JSON.stringify(unsupported)}`);
}

export function evaluateCompanionLinkedInputPrerequisite({
  resolution,
  evaluate,
}: {
  resolution: CompanionLinkedInputResolution;
  evaluate: (value: number) => PrerequisiteStatus;
}): PrerequisiteStatus {
  return resolution.value === null ? 'unresolved' : evaluate(resolution.value);
}
