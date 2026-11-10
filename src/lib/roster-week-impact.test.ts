import { describe, expect, it } from 'vitest';
import { upkeepFixture } from '../../tests/rules/upkeep-fixture';
import type { CanonicalWeekState } from './canonical-weekly-source';
import {
  applyOfficerCorrection,
  applyRosterCorrection,
  assignOfficer,
  removeOfficer,
} from './roster-corrections';
import {
  allowancePreview,
  projectRosterWeek,
  rosterChoiceIssues,
} from './roster-week-impact';
import { createWeeklyDraft } from './weekly-draft';
import type { WeekStartFacts, WeeklyDraft } from './weekly-draft-contract';

// What a roster or officer correction newly asks of the open week (#183),
// read from the rules' projection of the week over each militia.

type Snapshot = CanonicalWeekState['militiaSnapshot'];

// Rank 3 (2 actions) with a PC Strategist, Kess, and a PC Ambassador; three
// Activity slots.
function week(carriedEvents: WeekStartFacts['carriedEvents'] = []) {
  const { draft: base, snapshot } = upkeepFixture();
  // A mutable copy of the week's draft.
  const draft = structuredClone(
    createWeeklyDraft({
      draftId: base.draftId,
      week: base.week,
      slotIds: ['one', 'two', 'three'],
      context: {
        firstMilitiaWeek: false,
        startDay: 273,
        uneventfulCarry: false,
        carriedEvents,
        queuedEffects: [],
        orders: [],
        lastBuyoffWeek: null,
      },
    }),
  );
  const militia: Snapshot = {
    ...snapshot,
    roster: {
      ...snapshot.roster,
      people: [
        ...snapshot.roster.people,
        { characterId: 'kess', kind: 'pc', hitDice: null },
      ],
      officers: [
        ...snapshot.roster.officers,
        { role: 'strategist', characterId: 'kess' },
      ],
    },
    characters: [
      ...snapshot.characters,
      { ...snapshot.characters[0]!, characterId: 'kess' },
    ],
  };
  return { draft, militia };
}
const records = [
  { characterId: 'pc', kind: 'pc' as const },
  { characterId: 'kess', kind: 'pc' as const },
];
const withoutKess = (militia: Snapshot) =>
  applyRosterCorrection(
    militia,
    militia.roster.people
      .filter((person) => person.characterId !== 'kess')
      .map(({ characterId, hitDice }) => ({ characterId, hitDice })),
    records,
  );
const issues = (draft: WeeklyDraft, before: Snapshot, after: Snapshot) =>
  rosterChoiceIssues(
    draft,
    projectRosterWeek(before, draft),
    projectRosterWeek(after, draft),
  );

describe('Strategist allowance', () => {
  it('previews the Activity actions a Strategist change gives or takes', () => {
    const { draft, militia } = week();
    const removed = applyOfficerCorrection(
      militia,
      removeOfficer(militia.roster.officers, 'strategist', 'kess'),
    );
    const before = projectRosterWeek(militia, draft);
    expect(before.allowance).toBe(3);
    expect(allowancePreview(before, projectRosterWeek(removed, draft))).toBe(
      'Activity actions this week: 3 → 2',
    );
    expect(allowancePreview(projectRosterWeek(removed, draft), before)).toBe(
      'Activity actions this week: 2 → 3',
    );
    expect(allowancePreview(before, before)).toBeNull();
  });

  it('without an open week, reads the rank and the Strategist', () => {
    const { militia } = week();
    expect(projectRosterWeek(militia, null).allowance).toBe(3);
  });

  it('names the staged slot the lowered allowance no longer covers', () => {
    const { draft, militia } = week();
    draft.activity.slots[2]!.choice = {
      choiceId: 'hide',
      actionId: 'lie_low',
    };
    const removed = applyOfficerCorrection(
      militia,
      removeOfficer(militia.roster.officers, 'strategist', 'kess'),
    );
    expect(issues(draft, militia, removed)).toEqual([
      {
        key: 'activitySlot:three',
        location: {
          kind: 'activitySlot',
          slotId: 'three',
          position: 3,
          actionId: 'lie_low',
        },
        phase: 'activity',
        reason: 'capacity',
      },
    ]);
  });
});

describe('pending Change Officer Role', () => {
  function pending() {
    const value = week();
    value.draft.activity.slots[0]!.choice = {
      choiceId: 'change',
      actionId: 'change_officer_role',
      characterId: 'kess',
      fromRole: 'strategist',
      toRole: 'spymaster',
    };
    return value;
  }
  const reasons = (list: ReturnType<typeof issues>) =>
    list.map((issue) => [issue.key, issue.reason]);

  it('is named when its role is removed, although Kess still exists', () => {
    const { draft, militia } = pending();
    const removed = applyOfficerCorrection(
      militia,
      removeOfficer(militia.roster.officers, 'strategist', 'kess'),
    );
    expect(reasons(issues(draft, militia, removed))).toEqual([
      ['activitySlot:one', 'fromRole'],
    ]);
  });

  it('is named when its character leaves the roster', () => {
    const { draft, militia } = pending();
    expect(reasons(issues(draft, militia, withoutKess(militia)))).toEqual([
      ['activitySlot:one', 'character'],
    ]);
  });

  it('is repaired by re-including the same character and restoring the role', () => {
    const { draft, militia } = pending();
    const removed = withoutKess(militia);
    // A later roster correction re-includes Kess from the existing record,
    // under the same identity; an officer correction restores the role.
    const rejoined = applyRosterCorrection(
      removed,
      [
        ...removed.roster.people.map(({ characterId, hitDice }) => ({
          characterId,
          hitDice,
        })),
        { characterId: 'kess', hitDice: null },
      ],
      records,
    );
    // Back on the roster, the slot still needs Kess to be Strategist.
    expect(reasons(issues(draft, militia, rejoined))).toEqual([
      ['activitySlot:one', 'fromRole'],
    ]);
    const restored = applyOfficerCorrection(
      rejoined,
      assignOfficer(rejoined.roster.officers, 'strategist', 'kess'),
    );
    expect(reasons(issues(draft, militia, restored))).toEqual([]);
    expect(projectRosterWeek(restored, draft).findings).toEqual(
      projectRosterWeek(militia, draft).findings,
    );
  });

  it('is not blamed for problems the week already had', () => {
    const { draft, militia } = pending();
    const removed = withoutKess(militia);
    expect(issues(draft, removed, removed)).toEqual([]);
  });
});

describe('locating findings', () => {
  const found = (...findings: string[]) => ({
    allowance: null,
    findings: new Set(findings),
  });

  it('places an Overseer selection at its event, and a carried decision in Persistent', () => {
    const { draft } = week([
      {
        eventId: 'feud',
        eventType: 'rivalry',
        startedWeek: 39,
        order: 0,
        targets: [],
      },
    ]);
    draft.event.occurrences = [
      { eventId: 'raid', origin: { kind: 'rolled' }, eventType: 'raid' },
    ];
    const list = rosterChoiceIssues(
      draft,
      found('raid:0:overseer-already-used'),
      found(
        'raid:0:overseer-already-used',
        'raid:0:overseer-ineligible',
        'feud:officer-assignment',
        'feud:officer-assignment:exception',
        'manager:pc:capacity',
        'raid:item:gone:reference',
      ),
    );
    expect(list.map((issue) => [issue.key, issue.phase, issue.reason])).toEqual(
      [
        ['event:raid', 'event', 'overseer'],
        ['persistentDecision:feud', 'persistent', 'exception'],
      ],
    );
  });
});
