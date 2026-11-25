import type { RawRoll } from '~/lib/weekly-draft-facts';
import { EVENT_TYPES, type EventType } from '~/lib/militia-domain';
import {
  normalizeRawRoll,
  type NormalizedRoll,
  type RollSpec,
} from '~/lib/raw-roll';

// Reader-side roll facts: the original recorded roll stays beside the shared
// normalization so views can show recorded data honestly and calculate only
// through the pure normalizer. Nothing here rewrites or fabricates dice.
export type RollReadFacts = {
  recorded: RawRoll | null;
  normalized: NormalizedRoll;
};

export function rollNotation(spec: RollSpec) {
  return `${spec.count}d${spec.sides}`;
}
export function rollReadFacts(
  raw: RawRoll | null | undefined,
  spec: RollSpec,
): RollReadFacts {
  return { recorded: raw ?? null, normalized: normalizeRawRoll(raw, spec) };
}
// A deliberate numeric edit writes a total against the rule's expected
// specification, never the recorded dice count. Provenance and modifiers
// survive from the prior roll; only a genuinely new roll defaults to a table
// roll with no modifiers.
export function totalRoll(
  diceTotal: number,
  spec: RollSpec,
  prior: RawRoll | null | undefined,
): RawRoll {
  return {
    diceTotal,
    diceCount: spec.count,
    sides: spec.sides,
    provenance: prior?.provenance ?? { kind: 'table' },
    modifiers: prior?.modifiers ?? [],
  };
}
// The value an editor shows: a complete roll's dice-only total, and nothing
// for missing or wrong-specification data.
export function editableTotal(facts: RollReadFacts): number | null {
  return facts.normalized.status === 'complete'
    ? facts.normalized.diceTotal
    : null;
}
// Resolves the rule specification for a nested roll from its path relative to
// the edited structure (e.g. ['targetChecks', 0, 'rolls', 'loss']) and the
// CURRENT local form root, so context that the player is still editing (an
// unsaved candidate table roll) counts immediately. Null means no
// authoritative specification; editors then never write a number.
export type RollSpecResolver = (
  path: readonly (string | number)[],
  root: unknown,
) => RollSpec | null;
export function rollPathSegments(path: string): (string | number)[] {
  return path
    .split('.')
    .filter(Boolean)
    .map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));
}

// Explains recorded data that the current specification cannot use as a
// complete roll, so the player sees exactly what is retained until they type
// a replacement or clear it. Null for missing or complete rolls.
export function recordedRollExplanation(
  recorded: RawRoll | null | undefined,
  spec: RollSpec,
): string | null {
  if (!recorded || normalizeRawRoll(recorded, spec).status !== 'incomplete')
    return null;
  return `Recorded total ${recorded.diceTotal} was entered for ${rollNotation({ count: recorded.diceCount, sides: recorded.sides })}, but this step needs ${rollNotation(spec)}. Enter the total or clear the recorded roll.`;
}
// Advisory wording for a complete roll outside its usual range; never blocks.
export function rangeAdvisory(
  normalized: NormalizedRoll,
  spec: RollSpec,
): string | null {
  if (normalized.status !== 'complete' || !normalized.rangeWarning) return null;
  return `The usual range is ${spec.count}–${spec.count * spec.sides}. Your entered total is retained for the table.`;
}
// Narrows a projected event type string to the domain type for spec lookups.
export function resolvedEventType(value: string | null): EventType | null {
  const types: readonly string[] = EVENT_TYPES;
  // Safe cast: the cast branch only runs when EVENT_TYPES includes value.
  return types.includes(value ?? '') ? (value as EventType) : null;
}
