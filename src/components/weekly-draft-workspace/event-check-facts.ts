import type { RollSpec } from '~/lib/raw-roll';
import { RULE_ROLL_SPECS } from '~/lib/rules-roll-spec';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import type { EventCheckFacts, EventView } from './types';

type ProjectedCheck = EventView['checks'][number];
export type OrganizationCheck = 'loyalty' | 'secrecy' | 'security';

export const checkNames: Record<OrganizationCheck, string> = {
  loyalty: 'Loyalty',
  secrecy: 'Secrecy',
  security: 'Security',
};

// Contribution names in an Event check breakdown. The rules calculate these
// for every check; the people supplying them are never named here.
export const EVENT_CHECK_SOURCES: Record<string, string> = {
  'rank-focus': 'Rank and focus',
  officers: 'Officers',
  'overseer-support': 'Overseer',
  strategist: 'Strategist',
  helpful: 'Helpful settlement support',
};

/**
 * One Event check's row facts from the engine's projected check. The check
 * id is the engine's (`<event>:<target>:mitigation`, `<event>:sickness`, …);
 * a missing projection (an inactive event) reads as awaiting its roll.
 * `label` names the target; the modifier names come from `modifierLabel`.
 */
export function eventCheckFacts({
  checkId,
  check,
  dc,
  target,
  mandatory,
  projected,
  requirements,
  recorded,
  modifierLabel,
  result,
  spec = RULE_ROLL_SPECS.check,
}: {
  checkId: string;
  check: OrganizationCheck;
  dc: number;
  // "Wren Ashby"; null for a check of the whole event.
  target: string | null;
  mandatory: boolean;
  projected: ProjectedCheck | undefined;
  requirements: readonly string[];
  recorded: RawRoll | undefined;
  modifierLabel: (source: string, recorded: RawRoll | undefined) => string;
  // What success and failure mean for this event.
  result: { success: string; failure: string };
  spec?: RollSpec;
}): EventCheckFacts {
  const name = checkNames[check];
  const total = projected?.total ?? null;
  const succeeded = total === null ? null : total >= dc;
  return {
    checkId,
    label: target ? `${name} check for ${target}` : `${name} check`,
    // The dice are stated once, on the roll field itself.
    legend: `${name} DC ${dc}`,
    spec,
    dc,
    mandatory,
    modifier: projected?.modifier ?? null,
    total,
    breakdown: (projected?.modifiers ?? []).map((modifier) => ({
      source: modifier.source,
      label:
        EVENT_CHECK_SOURCES[modifier.source] ??
        modifierLabel(modifier.source, recorded),
      value: modifier.value,
    })),
    succeeded,
    resultText:
      succeeded === null ? null : succeeded ? result.success : result.failure,
    required: requirements.some((code) => code.startsWith(`${checkId}:`)),
  };
}
