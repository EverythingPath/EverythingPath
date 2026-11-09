import { z } from 'zod';
import { canonicalWeekStateSchema } from './canonical-weekly-source';
import { createWeeklyDraft } from './weekly-draft';
import { draftReferenceRequirements } from './weekly-draft-references';
import {
  getAdvancementForRank,
  getMaxTeamsForRank,
  getMinimumTreasuryForRank,
} from './militia-progression-rules';
import { rosterWarningDescriptors } from './canonical-roster';
import type { SetupSectionMessage } from './setup-sections';

// Field-level validation: types, required values and each list's own identity
// and reference rules. Setup supplies facts, never resolved outcomes or
// pre-confirmed choices.
export const militiaSetupFieldsSchema = z.strictObject({
  mode: z.enum(['new', 'existing']),
  state: canonicalWeekStateSchema,
  phase: z.enum(['upkeep', 'activity', 'event', 'persistent', 'summary']),
  notes: z.string().trim().max(2000),
});
type SetupFields = z.infer<typeof militiaSetupFieldsSchema>;

// `path` and `message` are the reported issue; `target` is the entry or field
// that needs repair, so a form can show the error in the right place.
export type SetupReferenceIssue = {
  path: (string | number)[];
  message: string;
  target: (string | number)[];
};

export const CARRIED_REFERENCE_MESSAGE =
  'A carried event, order or queued effect refers to an entity missing from this setup. Restore it or choose another target.';

// Cross-reference validation: facts that a started week needs across sections.
export function militiaSetupReferenceIssues(
  setup: SetupFields,
): SetupReferenceIssue[] {
  let draft;
  try {
    draft = createWeeklyDraft({
      draftId: 'setup-validation',
      week: setup.state.week,
      context: setup.state.context,
      slotIds: [],
    });
  } catch (error) {
    if (!(error instanceof z.ZodError)) throw error;
    return error.issues.map((issue) => ({
      path: ['state', 'context'],
      message: issue.message,
      target:
        issue.path[0] === 'context' || issue.path[0] === 'week'
          ? ['state', ...issue.path.filter((key) => typeof key !== 'symbol')]
          : ['state', 'context'],
    }));
  }
  const issues: SetupReferenceIssue[] = [];
  const snapshot = setup.state.militiaSnapshot;
  snapshot.economy?.orders.forEach((order, index) => {
    const field =
      order.source === 'special_order' ? 'dueDay' : 'dueActivityWeek';
    const path = [
      'state',
      'militiaSnapshot',
      'economy',
      'orders',
      index,
      field,
    ];
    if (order[field] === null)
      issues.push({
        path,
        message: 'Record the delivery date before starting the week.',
        target: path,
      });
  });
  const [missing] = draftReferenceRequirements(draft, snapshot, snapshot);
  if (missing !== undefined)
    issues.push({
      path: ['state', 'context'],
      message: CARRIED_REFERENCE_MESSAGE,
      target: referringEntry(setup.state.context, missing),
    });
  return issues;
}
// Requirement keys name the referring entity as `<kind>:<id>:…`.
function referringEntry(
  context: SetupFields['state']['context'],
  requirement: string,
) {
  const refers = (kinds: readonly string[], id: string) =>
    kinds.some((kind) => requirement.startsWith(`${kind}:${id}:`));
  for (const [list, kinds, ids] of [
    [
      'carriedEvents',
      ['event', 'decision'],
      context.carriedEvents.map((event) => event.eventId),
    ],
    [
      'queuedEffects',
      ['queue'],
      context.queuedEffects.map((effect) => effect.effectId),
    ],
    ['orders', ['order'], context.orders.map((order) => order.orderId)],
  ] as const) {
    const index = ids.findIndex((id) => refers(kinds, id));
    if (index >= 0) return ['state', 'context', list, index];
  }
  return ['state', 'context'];
}

export const militiaSetupSchema = militiaSetupFieldsSchema.superRefine(
  (setup, ctx) => {
    for (const { path, message } of militiaSetupReferenceIssues(setup))
      ctx.addIssue({ code: 'custom', path, message });
  },
);
export type MilitiaSetup = z.infer<typeof militiaSetupSchema>;

export function newMilitiaSetup(
  focus: 'Loyalty' | 'Security' | 'Secrecy',
): MilitiaSetup {
  return {
    mode: 'new',
    phase: 'upkeep',
    notes: '',
    state: {
      week: 1,
      militiaSnapshot: {
        rank: 1,
        training: 0,
        treasuryCopper: getMinimumTreasuryForRank(1) * 100,
        notoriety: 0,
        focus,
        roster: { people: [], teams: [], officers: [] },
        characters: [],
        settlements: [],
        bonuses: [],
        economy: { items: [], caches: [], orders: [], markets: [] },
        characterActions: { people: [] },
        eventBenefits: { skills: [], markets: [] },
      },
      context: {
        firstMilitiaWeek: true,
        startDay: 0,
        uneventfulCarry: false,
        carriedEvents: [],
        queuedEffects: [],
        orders: [],
        lastBuyoffWeek: null,
      },
    },
  };
}

export function prepareMilitiaSetup(input: MilitiaSetup, draftId: string) {
  const { draft, snapshot, warnings } = planMilitiaSetup(
    militiaSetupSchema.parse(input),
    draftId,
  );
  return {
    draft,
    snapshot,
    warnings: warnings.map((warning) => warning.message),
  };
}
// The same rules warnings as `prepareMilitiaSetup`, in the same order, with the
// Setup step and field each one concerns. Warnings about a character use its
// name from `names` when known, else its position among the characters.
export function militiaSetupWarnings(
  input: MilitiaSetup,
  names?: ReadonlyMap<string, string>,
) {
  return planMilitiaSetup(
    militiaSetupSchema.parse(input),
    'setup-review',
    names,
  ).warnings;
}
function planMilitiaSetup(
  setup: MilitiaSetup,
  draftId: string,
  names?: ReadonlyMap<string, string>,
) {
  const { militiaSnapshot: snapshot, context, week } = setup.state;
  const draft = createWeeklyDraft({
    draftId,
    week,
    context: {
      ...context,
      firstMilitiaWeek:
        setup.mode === 'existing' ? false : context.firstMilitiaWeek,
    },
    slotIds: [],
  });
  const warnings: SetupSectionMessage[] = [
    ...rosterWarningDescriptors(
      snapshot.roster,
      snapshot.characters.map((character, index) => ({
        ...character,
        name: names?.get(character.characterId) ?? `Character ${index + 1}`,
      })),
      getMaxTeamsForRank(snapshot.rank),
    ).map(({ list, message, path }) => ({
      section: list,
      message,
      ...(path && {
        field: ['state', 'militiaSnapshot', 'roster', ...path].join('.'),
      }),
    })),
    ...advancementWarnings(snapshot),
    ...startingValueWarnings(snapshot),
  ];
  if (setup.phase === 'persistent' && !draft.context.persistentPhaseEligible)
    warnings.push({
      section: 'week',
      field: 'phase',
      message:
        'There are no carried persistent events. The week will open in Upkeep.',
    });
  return { draft, snapshot, warnings };
}

type SetupSnapshot = MilitiaSetup['state']['militiaSnapshot'];
const valueWarning = (
  value: 'rank' | 'training' | 'treasuryCopper' | 'notoriety',
  message: string,
): SetupSectionMessage => ({
  section: 'startingPoint',
  field: `state.militiaSnapshot.${value}`,
  message,
});
function advancementWarnings(snapshot: SetupSnapshot) {
  const warnings: SetupSectionMessage[] = [];
  const advancement = getAdvancementForRank(snapshot.rank);
  if (!advancement)
    warnings.push(
      valueWarning(
        'rank',
        'Rank is outside the standard advancement table (1–20).',
      ),
    );
  if (advancement && snapshot.training < advancement.training)
    warnings.push(
      valueWarning(
        'training',
        `Training is below the rank ${snapshot.rank} threshold of ${advancement.training}. Rank never decreases after training loss; check this against your table history.`,
      ),
    );
  const pcIds = new Set(
    snapshot.roster.people
      .filter((person) => person.kind === 'pc')
      .map((person) => person.characterId),
  );
  const pcLevels = snapshot.characters
    .filter(
      (character) => pcIds.has(character.characterId) && character.isActive,
    )
    .map((character) => character.level);
  if (pcLevels.length && snapshot.rank > Math.max(...pcLevels))
    warnings.push(
      valueWarning('rank', 'Rank exceeds the highest active PC level.'),
    );
  return warnings;
}
function startingValueWarnings(snapshot: SetupSnapshot) {
  const warnings: SetupSectionMessage[] = [];
  if (snapshot.training < 0)
    warnings.push(valueWarning('training', 'Training is below zero.'));
  if (snapshot.treasuryCopper < getMinimumTreasuryForRank(snapshot.rank) * 100)
    warnings.push(
      valueWarning(
        'treasuryCopper',
        'Treasury is below the normal minimum. Upkeep may require a training loss.',
      ),
    );
  if (snapshot.notoriety < 0 || snapshot.notoriety > 100)
    warnings.push(
      valueWarning(
        'notoriety',
        'Notoriety is outside the normal range of 0–100.',
      ),
    );
  return warnings;
}
