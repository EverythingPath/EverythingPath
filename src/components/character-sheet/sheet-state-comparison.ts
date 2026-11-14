import type {
  FavoredClassBonus,
  Modifier,
  Situation,
} from '~/lib/character-sheet';
import type { buildCharacterSheetView } from './character-sheet-view-model';

type Sheet = ReturnType<typeof buildCharacterSheetView>;

function equalRows<Value>(
  previous: readonly Value[] | null,
  next: readonly Value[] | null,
  equal: (left: Value, right: Value) => boolean,
) {
  if (previous === null || next === null) return previous === next;
  return (
    previous.length === next.length &&
    // Safe cast: the length check above keeps every index of previous in next.
    previous.every((row, index) => equal(row, next[index]!))
  );
}

function equalFavoredBonus(
  left: FavoredClassBonus | null | undefined,
  right: FavoredClassBonus | null | undefined,
) {
  if (!left || !right) return left === right;
  if (left.choice !== right.choice) return false;
  return (
    left.choice !== 'alt' ||
    (right.choice === 'alt' && left.note === right.note)
  );
}

function equalRanks(
  left: Record<string, number> | undefined,
  right: Record<string, number> | undefined,
) {
  const keys = Object.keys(left ?? {});
  return (
    keys.length === Object.keys(right ?? {}).length &&
    keys.every(
      (key) => Object.hasOwn(right ?? {}, key) && left?.[key] === right?.[key],
    )
  );
}

export function equalClassLevels(
  previous: Sheet['levels'] | null,
  next: Sheet['levels'] | null,
) {
  return equalRows(
    previous,
    next,
    (left, right) =>
      left._id === right._id &&
      left.active === right.active &&
      left.state.position === right.state.position &&
      left.state.classEntryId === right.state.classEntryId &&
      left.state.hpGained === right.state.hpGained &&
      left.state.abilityIncrease === right.state.abilityIncrease &&
      left.state.proficiencyChoice === right.state.proficiencyChoice &&
      equalFavoredBonus(
        left.state.favoredClassBonus,
        right.state.favoredClassBonus,
      ) &&
      equalRanks(left.state.skillRanks, right.state.skillRanks),
  );
}

function equalSituation(
  left: Situation | undefined,
  right: Situation | undefined,
) {
  if (typeof left === 'string' || typeof right === 'string' || !left || !right)
    return left === right;
  if ('local' in left) return 'local' in right && left.local === right.local;
  return 'option' in right && left.option === right.option;
}

function equalModifier(left: Modifier, right: Modifier) {
  const equalValue =
    typeof left.value === 'number' || typeof right.value === 'number'
      ? left.value === right.value
      : left.value.formula === right.value.formula;
  return (
    left.target === right.target &&
    left.bonusType === right.bonusType &&
    equalValue &&
    left.stacksWithinEntry === right.stacksWithinEntry &&
    left.condition?.whileActive === right.condition?.whileActive &&
    equalSituation(left.condition?.situation, right.condition?.situation)
  );
}

export function equalAdjustments(
  previous: Sheet['adjustments'] | null,
  next: Sheet['adjustments'] | null,
) {
  return equalRows(
    previous,
    next,
    (left, right) =>
      left.entryId === right.entryId &&
      left.catalogEntryId === right.catalogEntryId &&
      left.active === right.active &&
      left.name === right.name &&
      equalRows(left.modifiers, right.modifiers, equalModifier),
  );
}
