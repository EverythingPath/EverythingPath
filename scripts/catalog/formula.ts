import {
  FormulaError,
  parseFormula,
} from '../../src/lib/character-sheet-formulas.ts';
import { skillDefinitions } from '../../src/lib/character-sheet-skill-definitions.ts';

// #724: `@skillRanks.<skill>` reads a skill's recorded ranks, for reviewed
// formulas such as Skill Focus's rank threshold. Foundry's own
// `@skills.<skill>.rank` is not mapped onto it.
const skillRankVariables = new Set(
  skillDefinitions.map(({ key }) => `@skillRanks.${key.slice('skill.'.length)}`),
);

// Parse only the documented arithmetic grammar. No Foundry expression is executed.
export function mapFormula({
  input,
  classTag,
  allowCasterLevel = false,
  allowItemEnhancement = false,
}: {
  input: string;
  classTag?: string;
  allowCasterLevel?: boolean;
  /** #764: an Item Ability's `@item.enhancement`, its item part's enhancement. */
  allowItemEnhancement?: boolean;
}): string | number | undefined {
  const formula = input
    .replace(/@abilities\.(str|dex|con|int|wis|cha)\.mod\b/g, '@ability.$1.mod')
    .replaceAll('@attributes.hd.total', '@hitDice')
    .replaceAll('@attributes.bab.total', '@bab')
    .replaceAll('@details.level', '@level')
    .replaceAll(
      '@class.level',
      classTag ? `@classLevel.${classTag}` : '@unresolvedClass',
    )
    .replace(/@item\.level\b/g, '@unresolvedItem');
  try {
    parseFormula(formula);
  } catch (error) {
    if (!(error instanceof FormulaError)) throw error;
    return undefined;
  }
  if (/^-?\d+$/.test(formula.trim())) {
    const number = Number(formula);
    return Number.isSafeInteger(number) ? number : undefined;
  }
  const variables = formula.match(/@[A-Za-z][A-Za-z0-9_.]*/g) ?? [];
  const supportedVariable =
    /^@(?:level|hitDice|bab|ability\.(?:str|dex|con|int|wis|cha)\.mod|classLevel\.[A-Za-z][A-Za-z0-9_.]*|casterLevel\.[A-Za-z][A-Za-z0-9_.]*)$/;
  if (
    variables.some(
      (name) =>
        !supportedVariable.test(name) &&
        !skillRankVariables.has(name) &&
        !(allowCasterLevel && name === '@casterLevel') &&
        !(allowItemEnhancement && name === '@item.enhancement'),
    )
  )
    return undefined;
  return formula.trim();
}
