import type { RollReadFacts } from './roll-facts';
import type { RollFact, UpkeepView } from './types';
import { rollNotation } from './roll-facts';
import { formatGold } from './week-frame/reference-copy';
const rollNames: Record<string, [string, RollFact['field']]> = {
  'upkeep:attrition': ['Attrition Loyalty', 'check'],
  'upkeep:attrition-training': ['Attrition training', 'training'],
  'upkeep:notoriety-training': ['Maximum-notoriety training', 'notoriety'],
  'upkeep:notoriety': ['Notoriety Loyalty', 'notorietyCheck'],
  'upkeep:shortage': ['Treasury-shortage training', 'loss'],
};
export type UpkeepWarningFacts = Pick<
  UpkeepView,
  'transfers' | 'officers' | 'rolls'
> & {
  teams: {
    teamId: string;
    name: string;
    rulesCostCopper: number;
    returnRoll: RollReadFacts | null;
  }[];
};
// A recorded total warns about its whole range.
function rangeMessage(name: string, fact: RollFact | undefined) {
  const recorded = fact?.recorded;
  if (fact && recorded)
    return `${name} total ${recorded.diceTotal} is outside the usual ${fact.count}–${fact.count * fact.sides} range for ${rollNotation(fact)}. The recorded total is retained for the table.`;
  return `${name} total is outside its usual range. The recorded total is retained for the table.`;
}
export function upkeepWarningMessage(code: string, facts: UpkeepWarningFacts) {
  const team = facts.teams.find((team) =>
    code.startsWith(`team:${team.teamId}:`),
  );
  if (team) {
    if (code.endsWith(':recovery-funds'))
      return `${team.name} recovery costs more than the available treasury. Record a table ruling to proceed.`;
    if (code.endsWith(':recovery-cost-baseline'))
      return `${team.name} has an entered recovery cost that differs from the rules cost of ${formatGold(team.rulesCostCopper)}. Use a reasoned recovery adjustment to change the final treasury.`;
    if (code.endsWith(':roll-range'))
      return team.returnRoll?.recorded
        ? `${team.name}'s return roll total ${team.returnRoll.recorded.diceTotal} is outside the usual 1–20 range. The recorded total is retained.`
        : `${team.name}'s return roll total is outside the usual 1–20 range. The recorded total is retained.`;
  }
  const transfer = facts.transfers.find((transfer) =>
    code.startsWith(`transfer:${transfer.transferId}:`),
  );
  if (transfer && code.endsWith(':funds'))
    return `This withdrawal of ${formatGold(transfer.copper)} exceeds the available treasury. Record a table ruling to proceed.`;
  const officer = facts.officers.find(
    (person) => code === `officer:${person.characterId}:archived`,
  );
  if (officer)
    return `${officer.name ?? 'An assigned officer'} is archived. Review the assignment and its check bonus.`;
  if (code === 'rank:pc-cap')
    return 'The militia rank exceeds the highest player-character level. Review the rank with the table.';
  const roll = Object.entries(rollNames).find(
    ([key]) => code === `${key}:roll-range`,
  );
  if (roll)
    return rangeMessage(
      roll[1][0],
      facts.rolls.find((fact) => fact.field === roll[1][1]),
    );
  return 'An Upkeep rule needs review. Check the affected roll or decision with the table before confirming.';
}

// A roll field already shows its own range advisory under the input, so the
// notes beside that field leave out the roll's range warning instead of
// repeating it. The code still reaches readiness, This phase and the Summary.
export function omitRollRangeIssues<Issue extends { code: string }>(
  issues: Issue[],
) {
  return issues.filter((issue) => !issue.code.endsWith(':roll-range'));
}
