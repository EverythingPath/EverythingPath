import { expect } from 'vitest';
import {
  resolveSheet,
  type InputSourcedModifier,
} from '../../src/lib/character-sheet';
import type { SkillTarget } from '../../src/lib/character-sheet-skills';

/** #724: Skill Focus's reviewed rank formula for its own skill. */
export function getSkillFocusFormula(target: SkillTarget) {
  return `3 + 3 * min(1, floor(@skillRanks.${target.slice('skill.'.length)} / 10))`;
}

/**
 * The behaviour every admitted Skill Focus (<skill>) record shares (#724):
 * one untyped Modifier on its skill with no Situation, +3 at 0 and 9 recorded
 * ranks and +6 at 10 (CRB p. 134), and a same-Source copy that doesn't stack.
 * Batch-specific admission checks stay in each batch's own test.
 */
export function expectAutomaticSkillFocus({
  modifiers,
  target,
}: {
  modifiers: readonly InputSourcedModifier[];
  target: SkillTarget;
}) {
  expect(
    modifiers.map((row) => [
      row.target,
      row.bonusType,
      row.value,
      row.condition,
    ]),
    target,
  ).toEqual([
    [target, 'untyped', { formula: getSkillFocusFormula(target) }, undefined],
  ]);
  const resolveAt = (ranks: number) =>
    resolveSheet(modifiers, { skillRanks: { [target]: ranks } })[target].total;
  expect([0, 9, 10].map(resolveAt), target).toEqual([3, 3, 6]);
  const copy = modifiers.map((row) => ({
    ...row,
    sheetEntryId: 'copy',
    catalogEntryId: 'copy',
  }));
  expect(
    resolveSheet([...modifiers, ...copy], { skillRanks: { [target]: 10 } })[
      target
    ].total,
    target,
  ).toBe(6);
}
