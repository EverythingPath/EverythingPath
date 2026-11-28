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

/** Rank-modifiers slice 2 (#777): a skill-pair feat's formula for one skill. */
export function getSkillPairFormula(target: SkillTarget) {
  return `2 + 2 * min(1, floor(@skillRanks.${target.slice('skill.'.length)} / 10))`;
}

/**
 * The behaviour the 10 Core Rulebook skill-pair feats share (#777 O1, feat
 * wave FW1): one untyped Modifier per skill with no Situation, +2 on each
 * skill and +4 on a skill with 10 or more recorded ranks, each skill on its
 * own ranks (CRB pp. 117-135), and a same-Source copy that doesn't stack.
 */
export function expectAutomaticSkillPair({
  modifiers,
  targets,
}: {
  modifiers: readonly InputSourcedModifier[];
  targets: readonly [SkillTarget, SkillTarget];
}) {
  expect(
    modifiers.map((row) => [
      row.target,
      row.bonusType,
      row.value,
      row.condition,
    ]),
    targets.join(),
  ).toEqual(
    targets.map((target) => [
      target,
      'untyped',
      { formula: getSkillPairFormula(target) },
      undefined,
    ]),
  );
  const [first, second] = targets;
  const resolveAt = (a: number, b: number) => {
    const result = resolveSheet(modifiers, {
      skillRanks: { [first]: a, [second]: b },
    });
    return [result[first].total, result[second].total];
  };
  expect(resolveAt(0, 0), targets.join()).toEqual([2, 2]);
  expect(resolveAt(9, 10), targets.join()).toEqual([2, 4]);
  expect(resolveAt(10, 9), targets.join()).toEqual([4, 2]);
  const copy = modifiers.map((row) => ({
    ...row,
    sheetEntryId: 'copy',
    catalogEntryId: 'copy',
  }));
  const doubled = resolveSheet([...modifiers, ...copy], {
    skillRanks: { [first]: 10, [second]: 10 },
  });
  expect([doubled[first].total, doubled[second].total]).toEqual([4, 4]);
}
