import type { MilitiaSetup } from './canonical-setup';
import {
  SETUP_SECTIONS,
  type SetupSectionKey,
  type SetupSectionMessage,
} from './setup-sections';
import type { SetupErrorDescriptor } from './setup-validation';

// Guided Militia Setup: nine freely navigable steps over one form. Pure status
// and preview derivation; the form and its presentation live in
// `components/militia-setup`.
export type SetupStepKey = SetupSectionKey;
// Safe cast: SETUP_SECTIONS is keyed by exactly the SetupStepKey values.
export const SETUP_STEP_KEYS = Object.keys(SETUP_SECTIONS) as SetupStepKey[];
// Optional, and initially empty, for a New militia.
const OPTIONAL_STEPS: readonly SetupStepKey[] = [
  'characterConditions',
  'assets',
  'carriedEffects',
];

// Errors outrank warnings, which outrank completion. A step's errors show once
// it has been opened or a start was attempted; Review always counts them all.
export type SetupStepState =
  | 'error'
  | 'warning'
  | 'skipped'
  | 'done'
  | 'ready'
  | 'none';
export type SetupStep = {
  key: SetupStepKey;
  label: string;
  number: number;
  optional: boolean;
  errors: SetupErrorDescriptor[];
  warnings: SetupSectionMessage[];
  state: SetupStepState;
  caption: string;
};

const count = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

export function setupSteps({
  values,
  errors,
  warnings,
  visited,
  attempted,
}: {
  values: MilitiaSetup;
  errors: readonly SetupErrorDescriptor[];
  warnings: readonly SetupSectionMessage[];
  visited: ReadonlySet<SetupStepKey>;
  attempted: boolean;
}): SetupStep[] {
  return SETUP_STEP_KEYS.map((key, index) => {
    const base = {
      key,
      label: SETUP_SECTIONS[key],
      number: index + 1,
      optional: values.mode === 'new' && OPTIONAL_STEPS.includes(key),
      warnings: warnings.filter((warning) => warning.section === key),
    };
    if (key === 'review') {
      return {
        ...base,
        // Review also holds the errors that no step can locate.
        errors: errors.filter(
          (error) => error.section === 'review' || error.section === undefined,
        ),
        ...(errors.length > 0
          ? { state: 'error', caption: `${errors.length} to fix` }
          : { state: 'ready', caption: 'Ready to start' }),
      } satisfies SetupStep;
    }
    const stepErrors = errors.filter((error) => error.section === key);
    const [state, caption]: [SetupStepState, string] =
      stepErrors.length > 0 && (attempted || visited.has(key))
        ? ['error', `${stepErrors.length} to fix`]
        : base.optional && isEmptyStep(key, values)
          ? ['skipped', 'Optional · skipped']
          : base.warnings.length > 0
            ? ['warning', count(base.warnings.length, 'warning')]
            : visited.has(key)
              ? ['done', 'Done']
              : ['none', ''];
    return { ...base, errors: stepErrors, state, caption };
  });
}

// Lists read defensively: unfinished form values may lack optional groups.
function carriedCounts(values: MilitiaSetup) {
  const snapshot = values.state.militiaSnapshot;
  const economy = snapshot.economy;
  return {
    characterConditions: [
      [snapshot.characterActions?.people.length ?? 0, 'character condition'],
    ],
    assets: [
      [economy?.items.length ?? 0, 'item'],
      [economy?.caches.length ?? 0, 'cache'],
      [economy?.orders.length ?? 0, 'order'],
      [economy?.markets.length ?? 0, 'marketplace'],
    ],
    carriedEffects: [
      [values.state.context.carriedEvents.length, 'persistent event'],
      [values.state.context.queuedEffects.length, 'queued effect'],
      [snapshot.bonuses.length, 'one-use bonus', 'one-use bonuses'],
      [snapshot.eventBenefits?.skills.length ?? 0, 'skill benefit'],
      [snapshot.eventBenefits?.markets.length ?? 0, 'Market Day benefit'],
    ],
  } satisfies Record<string, [number, string, string?][]>;
}
function isEmptyStep(key: SetupStepKey, values: MilitiaSetup) {
  if (!OPTIONAL_STEPS.includes(key)) return false;
  const counts =
    // Safe cast: every optional step is a carriedCounts key.
    carriedCounts(values)[key as keyof ReturnType<typeof carriedCounts>];
  return counts.every(([n]) => n === 0);
}

const phases: Record<MilitiaSetup['phase'], string> = {
  upkeep: 'Upkeep',
  activity: 'Activity',
  event: 'Event',
  persistent: 'Persistent',
  summary: 'Review & confirm',
};
const names = (labels: string[], none: string, noun: string) =>
  labels.length === 0
    ? none
    : labels.length <= 3
      ? labels.join(', ')
      : count(labels.length, noun);
// Entered input as typed; an empty field shows a dash.
const shown = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === '' ? '—' : String(value);

// A one-line summary of a step's entered values, for the wide step index.
// Raw invalid input is shown as entered. Empty optional steps of a New militia
// and Review have none.
export function setupStepPreview(
  key: SetupStepKey,
  values: MilitiaSetup,
  characters: readonly { characterId: string; name: string }[],
): string | null {
  const snapshot = values.state.militiaSnapshot;
  switch (key) {
    case 'startingPoint':
      return `${snapshot.focus} · rank ${shown(snapshot.rank)} · training ${shown(snapshot.training)} · ${shown(snapshot.treasuryCopper)} copper`;
    case 'week':
      return `Week ${shown(values.state.week)} · day ${shown(values.state.context.startDay)} · opens in ${phases[values.phase]}`;
    case 'people': {
      const people = names(
        snapshot.roster.people.map(
          (person, index) =>
            characters.find(
              (character) => character.characterId === person.characterId,
            )?.name ?? `Person ${index + 1}`,
        ),
        'No people',
        'person',
      );
      const officers = snapshot.roster.officers.length;
      return officers > 0
        ? `${people} · ${count(officers, 'officer')}`
        : people;
    }
    case 'teams':
      return names(
        snapshot.roster.teams.map(
          (team, index) => team.name || `Team ${index + 1}`,
        ),
        'No teams',
        'team',
      );
    case 'settlements':
      return names(
        snapshot.settlements.map(
          (town, index) => town.name || `Settlement ${index + 1}`,
        ),
        'No settlements',
        'settlement',
      );
    case 'characterConditions':
    case 'assets':
    case 'carriedEffects': {
      const entered = carriedCounts(values)
        [key].filter(([n]) => n > 0)
        .map(([n, one, many]) => count(n, one, many));
      if (entered.length > 0) return entered.join(' · ');
      return values.mode === 'new' ? null : 'None';
    }
    case 'review':
      return null;
  }
}

// Field names as the step editors label them.
const fieldLabels: Record<string, string> = {
  'state.militiaSnapshot.focus': 'Focus',
  'state.militiaSnapshot.rank': 'Rank',
  'state.militiaSnapshot.training': 'Training',
  'state.militiaSnapshot.treasuryCopper': 'Treasury (copper)',
  'state.militiaSnapshot.notoriety': 'Notoriety',
  'state.week': 'Current week',
  'state.context.startDay': 'Week start day',
  'state.context.firstMilitiaWeek': 'First militia week',
  'state.context.uneventfulCarry': 'Previous week was uneventful',
  'state.context.lastBuyoffWeek': 'Last persistent buyoff week',
  phase: 'Open phase',
  notes: 'Setup notes',
};
// Repeatable entries, named as their editors number them.
const entryLabels: Record<string, string> = {
  'roster.people': 'Person',
  'roster.teams': 'Team',
  'roster.officers': 'Officer role',
  'militiaSnapshot.characters': 'Character',
  'militiaSnapshot.settlements': 'Settlement',
  'characterActions.people': 'Character condition',
  'economy.items': 'Item',
  'economy.caches': 'Cache',
  'economy.orders': 'Order',
  'economy.markets': 'Marketplace',
  'militiaSnapshot.bonuses': 'Bonus',
  'eventBenefits.skills': 'Skill benefit',
  'eventBenefits.markets': 'Market Day benefit',
  'context.carriedEvents': 'Event',
  'context.queuedEffects': 'Queued effect',
  'context.orders': 'Order',
};
const words = (key: string) =>
  key === 'hitDice'
    ? 'Hit Dice'
    : key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`);
function fieldLabel(field: string) {
  if (fieldLabels[field]) return fieldLabels[field];
  const path = field.split('.');
  const index = path.findIndex((part) => /^\d+$/.test(part));
  const entry =
    index >= 2 ? entryLabels[`${path[index - 2]}.${path[index - 1]}`] : null;
  const leaf = [...path].reverse().find((part) => !/^\d+$/.test(part)) ?? field;
  if (!entry) return words(leaf);
  const name = `${entry} ${Number(path[index]) + 1}`;
  return index === path.length - 1 ? name : `${name}: ${words(leaf)}`;
}
function valueAt(values: unknown, field: string) {
  // Safe cast: value is a non-null object here; a missing key reads undefined.
  return field
    .split('.')
    .reduce<unknown>(
      (value, key) =>
        value !== null && typeof value === 'object'
          ? (value as Record<string, unknown>)[key]
          : undefined,
      values,
    );
}

// A summary line for one blocking error. A control's own type or format error
// names the control and tells empty from malformed input; rules across values
// keep their message.
export function setupSummaryMessage(
  error: SetupErrorDescriptor,
  values: unknown,
) {
  if (error.kind !== 'field' || !error.field) return error.message;
  const label = fieldLabel(error.field);
  const value = valueAt(values, error.field);
  return value === null || value === undefined || value === ''
    ? `${label} is required.`
    : `Enter a valid value for ${label}.`;
}
