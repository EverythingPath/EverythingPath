import { abilityLabels } from '~/lib/character-sheet';
import {
  isLinkedInputInterpretationCandidate,
  type CompanionLinkedInput,
} from '~/lib/character-sheet-linked-inputs';
import { skillDefinitions } from '~/lib/character-sheet-skills';
import type { LinkedInputSnapshot } from './use-character-sheet-linked-input';

function inputLabel(input: CompanionLinkedInput, classLabel?: string) {
  switch (input.kind) {
    case 'characterLevel':
      return 'Character level';
    case 'familiarProgressionLevels':
      return 'Familiar progression levels';
    case 'actualHitDice':
      return 'Actual Hit Dice';
    case 'classLevels':
      return classLabel ? `${classLabel} class levels` : 'Class Levels';
    case 'baseAttackBonus':
      return 'Class-derived base attack bonus';
    case 'baseSave':
      return `${{ fort: 'Fortitude', ref: 'Reflex', will: 'Will' }[input.save]} base save`;
    case 'skillRanks':
      return `${skillDefinitions.find((skill) => skill.key === input.skill)?.name ?? 'Skill'} ranks`;
    case 'maximumHp':
      return 'Calculated maximum hit points';
    case 'abilityModifier':
      return `${abilityLabels[input.ability]} modifier`;
  }
}

function resolutionExplanation(snapshot: LinkedInputSnapshot, label: string) {
  if (snapshot.resolution === 'interpretation')
    return `${label} uses the saved interpretation.`;
  if (snapshot.resolution === 'precedence')
    return `${label} follows the published rules precedence.`;
  if (snapshot.status === 'conflicting')
    return `${label} has conflicting rules. Choose an interpretation or enter a fallback for this value.`;
  if (snapshot.status !== 'unavailable')
    return snapshot.fallback === null
      ? 'Saved for when the value is unavailable'
      : null;
  switch (snapshot.unavailableReason) {
    case 'inaccessible':
      return `${label} is unavailable because the linked Character cannot be accessed.`;
    case 'interrupted':
      return `${label} is unavailable while the Companion Relationship is interrupted.`;
    default:
      return `${label} needs a missing input on the linked Character.`;
  }
}

export function buildLinkedInputView({
  snapshot,
  classLabel,
}: {
  snapshot: LinkedInputSnapshot;
  classLabel?: string;
}) {
  const label = inputLabel(snapshot.input, classLabel);
  const options = snapshot.candidates.flatMap((candidate) =>
    isLinkedInputInterpretationCandidate(candidate)
      ? [
          {
            sourceKey: candidate.sourceKey,
            label:
              snapshot.sources.find(
                (source) => source.key === candidate.sourceKey,
              )?.label ?? 'Supporting source',
            value: candidate.value,
          },
        ]
      : [],
  );
  const explanation = resolutionExplanation(snapshot, label);
  const fallbackExplanation =
    snapshot.fallbackState === 'suspended'
      ? `Saved fallback ${snapshot.fallback} is suspended while ${label} can be calculated. Saved for when the value is unavailable.`
      : snapshot.fallbackState === 'applied'
        ? `Using saved fallback ${snapshot.fallback} for ${label}.`
        : null;
  return {
    label,
    valueLabel: snapshot.value === null ? 'Unresolved' : String(snapshot.value),
    explanation,
    fallbackExplanation,
    options,
    canChooseInterpretation:
      snapshot.status !== 'available' && options.length > 0,
    hasFallback: snapshot.fallback !== null,
    hasInterpretation: snapshot.interpretation !== null,
    fallbackDescription:
      'Saved for when the value is unavailable. For lasting changes, use a personal adjustment.',
  };
}
