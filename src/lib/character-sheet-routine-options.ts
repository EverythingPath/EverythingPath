import type {
  CharacterSheetCatalogEntry,
  CharacterSheetInput,
  SheetEntry,
  SheetWarning,
} from './character-sheet';
import type { WeaponDetail } from './character-sheet-attacks';
import {
  flurryIdentityOf,
  isFlurryIdentity,
  type FlurryIdentity,
} from './character-sheet-flurry';

/** A switched-on option's active feat row, credited in breakdowns. */
export type RoutineOptionSource = { sheetEntryId: string; name: string };
export type RoutineOptionEffects = {
  powerAttack?: RoutineOptionSource;
  rapidShot?: RoutineOptionSource;
  manyshot?: RoutineOptionSource;
  vitalStrike?: RoutineOptionSource & { multiplier: number };
  lunge?: RoutineOptionSource;
  medusasWrath?: RoutineOptionSource;
  /** A monk's flurry of blows, from its counting class feature (#414). */
  flurry?: RoutineOptionSource & { identity: FlurryIdentity };
  /** FAQ o72: a core flurry's Combat Expertise uses the flurry BAB. */
  combatExpertise?: RoutineOptionSource;
};
type RoutineOptionRule =
  /** Its option-scoped Modifiers carry the numbers. */
  | { kind: 'data' }
  /** The Attack Routine resolver applies this hand-written effect. */
  | {
      kind: 'effect';
      effect: Exclude<
        keyof RoutineOptionEffects,
        'vitalStrike' | 'flurry' | 'combatExpertise'
      >;
    }
  /** A class feature's flurry of blows (CRB p. 57; PU p. 14). */
  | { kind: 'flurry' }
  /** CRB p. 136: roll the weapon's damage dice this many times. */
  | { kind: 'vitalStrike'; multiplier: number };

/**
 * The CRB Routine Options (#229, #237). Each is an ordinary feat Selection
 * recognized by durable rule identity; a renamed Catalog Copy keeps its
 * behavior.
 */
const routineOptionRules = {
  'power-attack': { kind: 'effect', effect: 'powerAttack' }, // CRB p. 131
  'deadly-aim': { kind: 'data' }, // CRB p. 121
  'combat-expertise': { kind: 'data' }, // CRB p. 119
  'arcane-strike': { kind: 'data' }, // CRB p. 118
  'rapid-shot': { kind: 'effect', effect: 'rapidShot' }, // CRB p. 132
  manyshot: { kind: 'effect', effect: 'manyshot' }, // CRB p. 130
  'vital-strike': { kind: 'vitalStrike', multiplier: 2 }, // CRB p. 136
  'improved-vital-strike': { kind: 'vitalStrike', multiplier: 3 }, // CRB p. 128
  'greater-vital-strike': { kind: 'vitalStrike', multiplier: 4 }, // CRB p. 126
  lunge: { kind: 'effect', effect: 'lunge' }, // CRB p. 130
  'medusas-wrath': { kind: 'effect', effect: 'medusasWrath' }, // CRB p. 130
  'monk-flurry': { kind: 'flurry' }, // CRB p. 57
  'unchained-monk-flurry': { kind: 'flurry' }, // PU p. 14
} satisfies Record<string, RoutineOptionRule>;
type RoutineOptionIdentity = keyof typeof routineOptionRules;

function isRoutineOptionIdentity(
  identity: string,
): identity is RoutineOptionIdentity {
  return Object.hasOwn(routineOptionRules, identity);
}

/**
 * A feat is a Routine Option when the builder writes its rule by hand or
 * its Modifiers apply only inside routines that switch it on. Of class
 * features, only the two flurries of blows are (#414).
 */
export function isRoutineOptionDefinition(
  definition: Pick<
    CharacterSheetCatalogEntry,
    'ruleIdentity' | 'modifiers' | 'detail'
  >,
) {
  if (definition.detail?.kind === 'classFeature')
    return isFlurryIdentity(definition.ruleIdentity);
  if (definition.detail?.kind !== 'feat') return false;
  return (
    isRoutineOptionIdentity(definition.ruleIdentity) ||
    definition.modifiers.some((modifier) => modifier.condition?.option)
  );
}

/** One option row a routine's editor shows. */
export type RoutineOptionView = {
  /** The recorded choice, or the feat's Catalog Entry when not switched on. */
  catalogEntryId: string;
  name: string;
  ruleIdentity: string | null;
  switchedOn: boolean;
  /** Whether an active feat Selection supplies it. */
  available: boolean;
  /** Whether it changes anything in this routine as configured. */
  applicable: boolean;
};

type RoutineEntry = Extract<SheetEntry, { kind: 'attackRoutine' }>;
/** A feat Selection or, for a flurry, its counting class-feature Grant. */
type RoutineOptionEntry = Extract<
  SheetEntry,
  { kind: 'feat' | 'classFeature' }
>;
/** A sheet row that may supply a Routine Option, with its definition. */
type RoutineOptionCandidate = {
  entry: RoutineOptionEntry;
  definition: CharacterSheetCatalogEntry;
};

function listRoutineOptionCandidates(
  input: CharacterSheetInput,
  entries: readonly SheetEntry[] = input.entries,
): RoutineOptionCandidate[] {
  return entries.flatMap((entry) => {
    if (entry.kind !== 'feat' && entry.kind !== 'classFeature') return [];
    const definition = input.catalogEntries.find(
      (candidate) => candidate._id === entry.catalogEntryId,
    );
    return definition ? [{ entry, definition }] : [];
  });
}

const routineOptionProblems = [
  'not-option',
  'inactive',
  'missing',
  /** A class feature's option whose Grant no longer counts (#414). */
  'not-counting',
] as const;
/** Why a switched-on option has no effect, recorded in its warning's facts. */
export type RoutineOptionProblem = (typeof routineOptionProblems)[number];
type RoutineOptionWarningFacts = readonly [
  catalogEntryId: string,
  problem: RoutineOptionProblem,
];

function isRoutineOptionProblem(value: unknown): value is RoutineOptionProblem {
  return routineOptionProblems.some((problem) => problem === value);
}

/** The routine-owned warning subject of one recorded option. */
export function routineOptionWarningSubject(
  routineEntryId: string,
  catalogEntryId: string,
) {
  return `${routineEntryId}:option:${catalogEntryId}`;
}

/** The problem an option warning's fingerprint facts record, if any. */
export function readRoutineOptionProblem(
  warning: Pick<SheetWarning, 'check' | 'fingerprint'>,
): RoutineOptionProblem | null {
  if (
    warning.check !== 'missingRoutineOption' &&
    warning.check !== 'invalidRoutineOption'
  )
    return null;
  let facts: unknown;
  try {
    facts = JSON.parse(warning.fingerprint);
  } catch {
    return null;
  }
  const problem: unknown = Array.isArray(facts) ? facts[1] : null;
  return isRoutineOptionProblem(problem) ? problem : null;
}

function optionWarning({
  routine,
  check,
  facts,
  message,
}: {
  routine: RoutineEntry;
  check: Extract<
    SheetWarning['check'],
    'missingRoutineOption' | 'invalidRoutineOption'
  >;
  facts: RoutineOptionWarningFacts;
  message: string;
}): SheetWarning {
  return {
    kind: 'rules',
    check,
    target: { kind: 'entry', entryId: routine._id },
    subject: routineOptionWarningSubject(routine._id, facts[0]),
    fingerprint: JSON.stringify(facts),
    message,
  };
}

type SwitchedOnOption = {
  identity: string;
  name: string;
  entry: RoutineOptionEntry;
};
type RecordedOption = {
  view: RoutineOptionView;
  warning?: SheetWarning;
  switchedOn?: SwitchedOnOption;
};

/**
 * A recorded option applies through an active feat Selection with the same
 * Catalog Entry or, for a copy, the same rule identity. Otherwise it stays
 * switched on with an advisory warning and has no effect.
 */
function resolveRecordedOption({
  id,
  routine,
  input,
  candidates,
  recordedCandidates,
}: {
  id: string;
  routine: RoutineEntry;
  input: CharacterSheetInput;
  candidates: readonly RoutineOptionCandidate[];
  recordedCandidates: readonly RoutineOptionCandidate[];
}): RecordedOption {
  const definition = input.catalogEntries.find(
    (candidate) => candidate._id === id,
  );
  const name = definition?.name ?? 'A switched-on option';
  const unavailable = {
    catalogEntryId: id,
    name,
    ruleIdentity: definition?.ruleIdentity ?? null,
    switchedOn: true,
    available: false,
    applicable: false,
  };
  if (!definition)
    return {
      view: unavailable,
      warning: optionWarning({
        routine,
        check: 'invalidRoutineOption',
        facts: [id, 'missing'],
        message: `A switched-on option of ${routine.state.name} is no longer available. Switch it off in this routine.`,
      }),
    };
  if (!isRoutineOptionDefinition(definition))
    return {
      view: unavailable,
      warning: optionWarning({
        routine,
        check: 'invalidRoutineOption',
        facts: [id, 'not-option'],
        message: `${name} is not a Routine Option. Switch it off in ${routine.state.name}.`,
      }),
    };
  const matching = (candidate: RoutineOptionCandidate) =>
    candidate.entry.catalogEntryId === id ||
    candidate.definition.ruleIdentity === definition.ruleIdentity;
  const active = candidates.find(
    (candidate) => candidate.entry.active && matching(candidate),
  );
  if (!active && definition.detail?.kind === 'classFeature')
    return {
      view: unavailable,
      warning: optionWarning({
        routine,
        check: 'missingRoutineOption',
        facts: [id, 'not-counting'],
        message: `${name} is switched on in ${routine.state.name}, but the class feature doesn't count on this sheet. It has no effect until it does.`,
      }),
    };
  if (!active) {
    const inactive = recordedCandidates.some(matching);
    return {
      view: unavailable,
      warning: optionWarning({
        routine,
        check: 'missingRoutineOption',
        facts: [id, inactive ? 'inactive' : 'missing'],
        message: inactive
          ? `${name} is switched on in ${routine.state.name}, but the feat is switched off. It has no effect until the feat is switched on.`
          : `${name} is switched on in ${routine.state.name}, but the feat isn't on the sheet. It has no effect until the feat is added.`,
      }),
    };
  }
  const activeName = active.definition.name ?? name;
  return {
    view: {
      ...unavailable,
      name: activeName,
      available: true,
      applicable: true,
    },
    switchedOn: {
      identity: definition.ruleIdentity,
      name: activeName,
      entry: active.entry,
    },
  };
}

/** The active option feats this routine offers but has not switched on. */
function offeredOptionViews({
  candidates,
  recordedIdentities,
  hasUnarmedStrike,
}: {
  candidates: readonly RoutineOptionCandidate[];
  recordedIdentities: ReadonlySet<string>;
  hasUnarmedStrike: boolean;
}): RoutineOptionView[] {
  const offered = new Set(recordedIdentities);
  return candidates.flatMap(({ entry, definition }) => {
    if (!entry.active || !isRoutineOptionDefinition(definition)) return [];
    if (offered.has(definition.ruleIdentity)) return [];
    if (definition.ruleIdentity === 'medusas-wrath' && !hasUnarmedStrike)
      return [];
    offered.add(definition.ruleIdentity);
    return [
      {
        catalogEntryId: entry.catalogEntryId,
        name: definition.name ?? definition.ruleIdentity,
        ruleIdentity: definition.ruleIdentity,
        switchedOn: false,
        available: true,
        applicable: true,
      },
    ];
  });
}

/** The hand-written effects of the switched-on options; the best Vital Strike wins. */
function collectOptionEffects(
  switchedOn: readonly SwitchedOnOption[],
): RoutineOptionEffects {
  const effects: RoutineOptionEffects = {};
  for (const option of switchedOn) {
    // A flurry may be the Foundry feature or a #716 identity (#741).
    const flurry = flurryIdentityOf(option.identity);
    const identity = flurry ?? option.identity;
    if (!isRoutineOptionIdentity(identity)) continue;
    const rule: RoutineOptionRule = routineOptionRules[identity];
    const source = { sheetEntryId: option.entry._id, name: option.name };
    if (rule.kind === 'effect') effects[rule.effect] ??= source;
    if (rule.kind === 'flurry' && flurry)
      effects.flurry ??= { ...source, identity: flurry };
    // Data only, but a core flurry recomputes its steps (FAQ o72).
    if (option.identity === 'combat-expertise')
      effects.combatExpertise ??= source;
    if (
      rule.kind === 'vitalStrike' &&
      rule.multiplier > (effects.vitalStrike?.multiplier ?? 0)
    )
      effects.vitalStrike = { ...source, multiplier: rule.multiplier };
  }
  return effects;
}

/**
 * The routine's switched-on options, matched to active feat Selections by
 * Catalog Entry or, for a copy, by rule identity. A recorded option whose
 * feat left the sheet or is switched off stays switched on with an advisory
 * warning and has no effect.
 */
export function resolveRoutineOptionChoices({
  routine,
  input,
  recordedEntries = input.entries,
  hasUnarmedStrike,
}: {
  routine: RoutineEntry;
  input: CharacterSheetInput;
  /** Recorded rows, including switched-off feats the calculation omits. */
  recordedEntries?: readonly SheetEntry[];
  /** Medusa's Wrath is offered only on routines with an unarmed strike. */
  hasUnarmedStrike: boolean;
}) {
  const candidates = listRoutineOptionCandidates(input);
  const recordedCandidates = listRoutineOptionCandidates(
    input,
    recordedEntries,
  );
  const recorded = [...new Set(routine.state.options ?? [])].map((id) =>
    resolveRecordedOption({
      id,
      routine,
      input,
      candidates,
      recordedCandidates,
    }),
  );
  const switchedOn = recorded.flatMap((option) =>
    option.switchedOn ? [option.switchedOn] : [],
  );
  const recordedIdentities = new Set(
    recorded.flatMap(({ view }) =>
      view.ruleIdentity ? [view.ruleIdentity] : [],
    ),
  );
  return {
    /** Catalog Entries whose option-scoped Modifiers apply on these lines. */
    routineOptions: [
      ...new Set(switchedOn.map((option) => option.entry.catalogEntryId)),
    ],
    effects: collectOptionEffects(switchedOn),
    views: [
      ...recorded.map((option) => option.view),
      ...offeredOptionViews({
        candidates,
        recordedIdentities,
        hasUnarmedStrike,
      }),
    ],
    warnings: recorded.flatMap((option) =>
      option.warning ? [option.warning] : [],
    ),
  };
}

/** CRB p. 131: −1/+2, and −1/+2 more at base attack bonus +4 and every 4 after. */
export function powerAttackSteps(bab: number) {
  return 1 + Math.floor(Math.max(0, bab) / 4);
}

/** CRB p. 136: roll the weapon's damage dice two, three or four times. */
export function multiplyDamageDice(dice: string, multiplier: number) {
  const match = /^(\d+)d(\d+)$/.exec(dice.trim());
  if (match) return `${Number(match[1]) * multiplier}d${match[2]}`;
  if (/^\d+$/.test(dice.trim())) return String(Number(dice) * multiplier);
  return Array.from({ length: multiplier }, () => dice).join('+');
}

/**
 * CRB p. 127 (Improved Critical), p. 469 (keen); #237 A15: any number of
 * threat-range expanders double the range once. 19–20 becomes 17–20.
 */
export function doubledThreat(threat: number) {
  return threat - (21 - threat);
}

export function normalizeWeaponChoice(value: string | null | undefined) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
}

/**
 * CRB p. 136: light weapons, natural weapons and unarmed strikes, plus
 * weapons with the finesse property: the feat names the rapier, whip and
 * spiked chain, and a weapon's description can add it, as the elven curve
 * blade's does.
 */
export function isFinesseWeapon(
  weapon: Pick<WeaponDetail, 'handedness' | 'naturalAttack' | 'finesse'>,
) {
  return (
    weapon.handedness === 'light' ||
    Boolean(weapon.naturalAttack) ||
    weapon.finesse === true
  );
}

/**
 * CRB p. 293; FAQ "Speed Weapons": haste, boots of speed and the speed
 * property share the `haste` Source, so any number of them gives one extra
 * attack. A speed weapon's own extra attack is the routine's, with that
 * weapon (#764).
 */
export const HASTE_SOURCE = 'haste';

/** The sheet's own haste-like entries: haste, boots of speed. */
export function findHasteSource(
  input: CharacterSheetInput,
  isExcluded: (
    entry: SheetEntry,
    definition: CharacterSheetCatalogEntry,
  ) => boolean,
): RoutineOptionSource | undefined {
  for (const entry of input.entries) {
    if (!entry.active || entry.kind === 'spell' || !('catalogEntryId' in entry))
      continue;
    const definition = input.catalogEntries.find(
      (candidate) => candidate._id === entry.catalogEntryId,
    );
    if (!definition || isExcluded(entry, definition)) continue;
    if ((definition.sourceKey ?? definition.ruleIdentity) === HASTE_SOURCE)
      return {
        sheetEntryId: entry._id,
        name: definition.name ?? 'Haste',
      };
  }
  return undefined;
}
