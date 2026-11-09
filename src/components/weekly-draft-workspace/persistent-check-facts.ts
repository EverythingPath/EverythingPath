import type { CanonicalResolutionPreview } from '~/lib/canonical-weekly-resolution';
import { officerCheckExtras } from '~/lib/rules-persistent-events';
import { RULE_ROLL_SPECS } from '~/lib/rules-roll-spec';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import { checkModifierLabel } from './activity-facts';
import { eventCheckFacts } from './event-check-facts';
import type {
  PersistentBonusChoice,
  PersistentRecordedModifier,
  PersistentRetained,
  PersistentRivalryCheck,
  PersistentTheftCheck,
  PersistentView,
  RivalrySkill,
} from './types';
import { officerRoleLabels } from './week-frame/reference-copy';

// The facts behind a carried event's own check: Theft's Loyalty check for
// this week's temporary mitigation and Rivalry's officer check that ends it.
// Totals and bonuses are the Resolution Preview's; this only names them and
// lists what the entered roll records.

type Carried = WeeklyDraft['context']['carriedEvents'][number];
type Decision = WeeklyDraft['persistent']['decisions'][number];
type Mitigation = Extract<Decision, { kind: 'mitigate' }>;
type Phases = NonNullable<CanonicalResolutionPreview['phases']>;
type Event = PersistentView['events'][number];

export type PersistentCheckContext = {
  draft: WeeklyDraft;
  source: WorkspaceSource;
  phases: Phases | null;
};

// Sources the rules calculate themselves; a recorded copy adds nothing.
const calculated =
  /^(rank-focus|officers|overseer-support|strategist|helpful)$|^(queued|officer|manager):/;

// Why an entered modifier adds nothing, or null when it counts.
function uncountedNote(entry: {
  counted: boolean;
  twice: boolean;
  bonus: boolean;
  repeated: string;
}) {
  if (entry.counted) return null;
  if (entry.twice) return entry.repeated;
  if (entry.bonus)
    return 'This bonus is not available for this check, so it adds nothing.';
  return 'The rules already count this source, so this copy adds nothing.';
}

/**
 * The modifiers recorded on one check roll, by list position. `counts` says
 * whether the rules add that entry; one they do not (a copy of a calculated
 * source, an unavailable bonus, a repeated source) stays listed and
 * removable with the reason it adds nothing.
 */
function recordedModifiers(
  roll: RawRoll | undefined,
  bonusLabel: (sourceId: string) => string,
  counts: (sourceId: string, index: number) => boolean,
  repeated: string,
): PersistentRecordedModifier[] {
  const modifiers = roll?.modifiers ?? [];
  return modifiers.map((modifier, index) => {
    const bonus = modifier.sourceId.startsWith('bonus:');
    const kind = bonus
      ? ('bonus' as const)
      : modifier.sourceId.startsWith('custom:')
        ? ('custom' as const)
        : ('other' as const);
    const twice =
      modifiers.filter((entry) => entry.sourceId === modifier.sourceId).length >
      1;
    return {
      index,
      sourceId: modifier.sourceId,
      value: modifier.value,
      reason: modifier.reason,
      label: bonus ? bonusLabel(modifier.sourceId) : modifier.reason,
      kind,
      note: uncountedNote({
        counted: counts(modifier.sourceId, index),
        twice,
        bonus,
        repeated,
      }),
    };
  });
}

// One-use bonuses a Persistent Loyalty check can still take this week.
function bonusChoices(
  context: PersistentCheckContext,
  roll: RawRoll | undefined,
  own: ReadonlySet<string>,
): PersistentBonusChoice[] {
  const { draft, phases, source } = context;
  const recorded = new Set(roll?.modifiers.map((entry) => entry.sourceId));
  const used = new Set(
    (phases?.persistent.checkUsage.bonusIds ?? []).filter((id) => !own.has(id)),
  );
  const bonuses = phases?.event.outcome.bonuses ?? source.snapshot.bonuses;
  return bonuses.flatMap((bonus) =>
    bonus.availableWeek === draft.week &&
    (bonus.consumedWeek === null || own.has(bonus.bonusId)) &&
    !used.has(bonus.bonusId) &&
    !recorded.has(`bonus:${bonus.bonusId}`) &&
    bonus.teamId === undefined &&
    (bonus.phase === undefined || bonus.phase === 'persistent') &&
    (bonus.check === 'any' || bonus.check === 'loyalty')
      ? [
          {
            sourceId: `bonus:${bonus.bonusId}`,
            label: bonus.source,
            value: bonus.value,
          },
        ]
      : [],
  );
}

/**
 * Theft's DC 20 Loyalty check for this week's temporary mitigation, read
 * from the preview's check. `otherThefts` names other Theft events still
 * taking half of this week's gains: the 90% applies only once every active
 * Theft is mitigated.
 */
export function theftCheckFacts(
  context: PersistentCheckContext,
  event: Pick<Event, 'eventId' | 'checks' | 'requirements'>,
  decision: Mitigation,
  otherThefts: readonly string[],
): PersistentTheftCheck {
  const checkId = `${event.eventId}:mitigation`;
  const projected = event.checks.find((check) => check.checkId === checkId);
  const recorded = decision.rolls?.check;
  const label = (sourceId: string) =>
    checkModifierLabel(sourceId, {
      draft: context.draft,
      source: context.source,
      helpfulName: null,
      recorded: recorded?.modifiers ?? [],
    });
  const applied = new Set(projected?.modifiers.map((entry) => entry.source));
  const own = new Set(
    [...applied].flatMap((entry) =>
      entry.startsWith('bonus:') ? [entry.slice(6)] : [],
    ),
  );
  const modifiers = recorded?.modifiers ?? [];
  const others = otherThefts.join(' and ');
  return {
    row: eventCheckFacts({
      checkId,
      check: 'loyalty',
      dc: 20,
      target: null,
      mandatory: false,
      projected,
      requirements: event.requirements,
      recorded,
      modifierLabel: label,
      result: {
        success: others
          ? `This Theft keeps 90%, but ${others} still ${otherThefts.length === 1 ? 'takes' : 'take'} half of this week’s gains.`
          : 'Keeps 90% of this week’s incoming gains. The Theft stays.',
        failure: 'Half of this week’s incoming gains are lost as usual.',
      },
    }),
    recorded,
    // The rules add an entered source once, at its first entry.
    modifiers: recordedModifiers(
      recorded,
      label,
      (sourceId, index) =>
        applied.has(sourceId) &&
        !calculated.test(sourceId) &&
        modifiers.findIndex((entry) => entry.sourceId === sourceId) === index,
      'This source is recorded more than once; only its first entry counts.',
    ),
    bonusChoices: bonusChoices(context, recorded, own),
  };
}

// A person's recorded name; a blank or missing one reads as `fallback`.
function personName(
  context: PersistentCheckContext,
  characterId: string,
  fallback: string,
) {
  const name =
    context.source.people
      .find((person) => person.characterId === characterId)
      ?.name?.trim() ?? '';
  return name === '' ? fallback : name;
}

type Militia = Pick<Phases['event']['outcome'], 'characters' | 'roster'>;
/**
 * The militia's characters with the officer roles each holds, for an
 * officer's own skill check in Event or Persistent.
 */
export function officerCandidateFacts(militia: Militia) {
  return militia.characters.map((character) => ({
    characterId: character.characterId,
    roles: militia.roster.officers
      .filter((officer) => officer.characterId === character.characterId)
      .map((officer) => officerRoleLabels[officer.role] ?? officer.role),
    archived: !character.isActive,
  }));
}

// Characters who could make the officer check, as the Persistent phase
// sees the militia, with their officer roles for context.
function officerCandidates(
  context: PersistentCheckContext,
  recordedId: string | undefined,
): PersistentRivalryCheck['characters'] {
  const outcome = context.phases?.event.outcome ?? context.source.snapshot;
  const name = (characterId: string) =>
    personName(context, characterId, 'Unnamed character');
  const options = officerCandidateFacts(outcome).map((character) => ({
    value: character.characterId,
    label: [
      name(character.characterId),
      character.roles.length ? character.roles.join(', ') : 'not an officer',
      ...(character.archived ? ['archived'] : []),
    ].join(' · '),
    officer: character.roles.length > 0,
    available: true,
  }));
  // A recorded character no longer in the militia stays visible to repair.
  if (recordedId && !options.some((option) => option.value === recordedId))
    options.unshift({
      value: recordedId,
      label: 'Unavailable character',
      officer: false,
      available: false,
    });
  return options;
}

/**
 * Rivalry's officer check: the chosen character's Diplomacy, Bluff or
 * Intimidate against DC 20. It is that character's skill check, so only the
 * entered skill bonus and custom modifiers count; no organization, officer
 * or Overseer bonus.
 */
export function rivalryCheckFacts(
  context: PersistentCheckContext,
  event: Pick<Event, 'eventId' | 'changes' | 'requirements' | 'warnings'>,
  decision: Mitigation,
): PersistentRivalryCheck {
  const input = decision.officerCheck;
  const recorded = input?.roll;
  const modifiers = recorded?.modifiers ?? [];
  const extras = input ? officerCheckExtras(input) : [];
  const counted = new Set(extras.map((extra) => extra.source));
  const latest = (sourceId: string) =>
    modifiers.map((entry) => entry.sourceId).lastIndexOf(sourceId);
  const reason = (sourceId: string) =>
    modifiers[latest(sourceId)]?.reason ?? 'Table modifier';
  const skillBonus = input?.skillBonus ?? null;
  const change = event.changes.find(
    (entry) => entry.kind === 'persistent_officer_check',
  );
  const total =
    change?.kind === 'persistent_officer_check' ? change.total : null;
  const succeeded = total === null ? null : total >= 20;
  const has = (code: string) =>
    event.requirements.includes(`${event.eventId}:${code}`);
  return {
    characterId: input?.characterId ?? null,
    characters: officerCandidates(context, input?.characterId),
    skill: input?.skill ?? null,
    skillBonus,
    recorded,
    spec: RULE_ROLL_SPECS.check,
    modifier:
      skillBonus === null
        ? null
        : skillBonus + extras.reduce((sum, extra) => sum + extra.value, 0),
    total,
    breakdown:
      skillBonus === null
        ? []
        : [
            { source: 'skill-bonus', label: 'Skill bonus', value: skillBonus },
            ...extras.map((extra) => ({
              ...extra,
              label: reason(extra.source),
            })),
          ],
    succeeded,
    resultText:
      succeeded === null
        ? null
        : succeeded
          ? 'Ends the Rivalry for good.'
          : 'The Rivalry stays. Another officer check can be tried next week.',
    required: {
      character: has('officer-check') || has('officer'),
      skillBonus: has('skill-bonus'),
      roll: has('officer:1d20'),
    },
    unavailable: has('officer'),
    notOfficer: event.warnings.includes(`${event.eventId}:officer-assignment`),
    // A repeated source counts once, at its latest entry.
    modifiers: recordedModifiers(
      recorded,
      reason,
      (sourceId, index) => counted.has(sourceId) && latest(sourceId) === index,
      'This source is recorded more than once; only its latest entry counts.',
    ),
  };
}

export const rivalrySkillLabels: Record<RivalrySkill, string> = {
  diplomacy: 'Diplomacy',
  bluff: 'Bluff',
  intimidate: 'Intimidate',
};

function rollText(roll: RawRoll | undefined) {
  return roll ? `roll ${roll.diceTotal}` : 'no roll';
}

/**
 * Values a check decision records that its check does not use: the other
 * event's check, or Overseer support on a Rivalry skill check. They stay
 * visible and removable, never counted.
 */
export function retainedFields(
  context: PersistentCheckContext,
  eventType: Carried['eventType'],
  decision: Mitigation,
): PersistentRetained[] {
  const name = (characterId: string) =>
    personName(context, characterId, 'Unavailable character');
  const fields: PersistentRetained[] = [];
  if (eventType === 'theft' && decision.officerCheck) {
    const input = decision.officerCheck;
    fields.push({
      field: 'officerCheck',
      label: 'Officer check',
      value: [
        name(input.characterId),
        rivalrySkillLabels[input.skill],
        ...(input.skillBonus === undefined
          ? []
          : [
              `skill bonus ${input.skillBonus < 0 ? '' : '+'}${input.skillBonus}`,
            ]),
        rollText(input.roll),
      ].join(' · '),
    });
  }
  if (eventType === 'rivalry' && decision.rolls?.check)
    fields.push({
      field: 'rolls',
      label: 'Loyalty check',
      value: rollText(decision.rolls.check),
    });
  if (eventType === 'rivalry' && decision.overseerCharacterId)
    fields.push({
      field: 'overseerCharacterId',
      label: 'Overseer support',
      value: 'adds nothing to a skill check',
    });
  return fields;
}

// Other Theft events, by section name, whose loss still halves some of
// this week's gains: every one without a successful check of its own. One
// ended by Activity or Event still took its half of the gains before then.
export function unmitigatedThefts(
  events: readonly { eventId: string; eventType: string; name: string }[],
  phases: Phases | null,
  eventId: string,
) {
  const mitigated = new Set(
    phases?.persistent.plan.flatMap((change) =>
      change.kind === 'persistent_mitigation' && change.succeeded
        ? [change.eventId]
        : [],
    ),
  );
  return events
    .filter(
      (event) =>
        event.eventType === 'theft' &&
        event.eventId !== eventId &&
        !mitigated.has(event.eventId),
    )
    .map((event) => event.name);
}
