import type { EVENT_TYPES } from './militia-domain';
const boundaries: [number, (typeof EVENT_TYPES)[number]][] = [
  [4, 'week_of_serenity'],
  [12, 'war_games'],
  [16, 'night_ops'],
  [20, 'broke_the_code'],
  [24, 'found_fire'],
  [28, 'high_morale'],
  [32, 'turn_around'],
  [36, 'festival'],
  [40, 'market_day'],
  [44, 'hidden_agenda'],
  [48, 'all_is_calm'],
  [52, 'roll_twice'],
  [56, 'calm_before_the_storm'],
  [60, 'turncoat'],
  [64, 'cache_discovered'],
  [68, 'rivalry'],
  [72, 'missing_in_action'],
  [76, 'theft'],
  [80, 'raid'],
  [84, 'invasion'],
  [88, 'low_morale'],
  [96, 'sickness'],
  [99, 'double_agent'],
  [100, 'week_of_pain'],
];

export const militiaEventTable = boundaries.map(([max, eventType], index) => ({
  // Safe cast: `index` is non-zero in this branch, so `index - 1` is the
  // previous boundary's position.
  min: index === 0 ? 1 : boundaries[index - 1]![0] + 1,
  max,
  eventType,
  name:
    eventType === 'calm_before_the_storm'
      ? 'Calm before the Storm'
      : eventType
          .split('_')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
          .replace(/\b(Of|The|In)\b/g, (word) => word.toLowerCase()),
}));
export function eventTypeForPercentile(value: number) {
  return (
    militiaEventTable.find((entry) => value <= entry.max)?.eventType ??
    'week_of_pain'
  );
}
