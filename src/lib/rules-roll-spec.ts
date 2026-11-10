import type { RollSpec } from './raw-roll';
import type { EventType } from './militia-domain';
import type {
  ActivityRollField,
  StagedActionChoice,
} from './weekly-draft-facts';

export const RULE_ROLL_SPECS = {
  check: { count: 1, sides: 20 },
  percentile: { count: 1, sides: 100 },
  singleD4: { count: 1, sides: 4 },
  singleD6: { count: 1, sides: 6 },
  twoD6: { count: 2, sides: 6 },
} as const satisfies Record<string, RollSpec>;

const { check, singleD4, singleD6, twoD6 } = RULE_ROLL_SPECS;
const activitySpecs: Partial<
  Record<
    StagedActionChoice['actionId'],
    Partial<Record<ActivityRollField, RollSpec>>
  >
> = {
  activate_black_market: { check, notoriety: singleD6 },
  dismiss_team: { check, notoriety: singleD6 },
  drill_militia: { check, notoriety: singleD6, training: twoD6 },
  earn_gold: { check, notoriety: singleD6 },
  gather_information: { check, notoriety: singleD6 },
  guarantee_event: { notoriety: singleD6 },
  knowledge_check: { check },
  recruit_team: { check, notoriety: singleD6 },
  reduce_danger: { check, notoriety: singleD4 },
  rescue_character: { check },
  secure_cache: { check },
  special_order: { delivery: twoD6 },
  spread_propaganda: { check },
};

export function activityRollSpec(
  actionId: StagedActionChoice['actionId'],
  field: ActivityRollField,
): RollSpec | null {
  return activitySpecs[actionId]?.[field] ?? null;
}

export type EventRollContext = {
  kind: 'occurrence';
  eventType: EventType | null;
};

type RollPath = readonly (string | number)[];

function isPath(path: RollPath, ...expected: string[]) {
  return (
    path.length === expected.length &&
    path.every((part, index) => part === expected[index])
  );
}

function occurrenceRootRollSpec(
  eventType: EventType | null,
  path: RollPath,
): RollSpec | null {
  if (!eventType) return null;
  if (
    isPath(path, 'officerCheck', 'roll') &&
    ['rivalry', 'turncoat'].includes(eventType)
  )
    return RULE_ROLL_SPECS.check;
  if (
    isPath(path, 'rolls', 'check') &&
    ['sickness', 'theft'].includes(eventType)
  )
    return RULE_ROLL_SPECS.check;
  if (eventType === 'turncoat' && isPath(path, 'rolls', 'loss'))
    return RULE_ROLL_SPECS.singleD6;
  return null;
}

function isTargetRollPath(path: RollPath) {
  const [targetChecks, index, rolls] = path;
  return (
    path.length === 4 &&
    targetChecks === 'targetChecks' &&
    typeof index === 'number' &&
    Number.isInteger(index) &&
    index >= 0 &&
    rolls === 'rolls'
  );
}

function targetRollSpec(
  eventType: EventType | null,
  path: RollPath,
): RollSpec | null {
  if (!isTargetRollPath(path)) return null;
  const field = path[3];
  if (
    field === 'check' &&
    (eventType === 'raid' || eventType === 'cache_discovered')
  )
    return RULE_ROLL_SPECS.check;
  if (field === 'loss' && eventType === 'raid')
    return RULE_ROLL_SPECS.percentile;
  return null;
}

export function eventRollSpec(
  context: EventRollContext,
  path: RollPath,
): RollSpec | null {
  if (isPath(path, 'tableRoll')) return RULE_ROLL_SPECS.percentile;
  if (isPath(path, 'sabotage', 'rolls', 'check')) return RULE_ROLL_SPECS.check;
  if (isPath(path, 'sabotage', 'rolls', 'notoriety'))
    return RULE_ROLL_SPECS.singleD6;
  if (path[0] === 'targetChecks')
    return targetRollSpec(context.eventType, path);
  return occurrenceRootRollSpec(context.eventType, path);
}
