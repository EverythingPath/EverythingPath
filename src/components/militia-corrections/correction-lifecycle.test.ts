import { describe, expect, test } from 'vitest';
import { acceptedCampaignSetup } from '../../../tests/rules/accepted-campaign';
import { mergeSection, sectionValue } from '~/lib/militia-correction-sections';
import {
  applyOfficerCorrection,
  applyRosterCorrection,
} from '~/lib/roster-corrections';
import {
  closedCorrection,
  correctionReducer,
  correctionView,
  planRosterSave,
  planSectionSave,
  type AcceptedMilitia,
  type Correction,
  type CorrectionAction,
} from './correction-lifecycle';

function accepted(): AcceptedMilitia {
  return {
    revision: 3,
    draftId: 'week-9',
    state: acceptedCampaignSetup('officer').state,
  };
}
function withSnapshot(
  base: AcceptedMilitia,
  change: (
    snapshot: AcceptedMilitia['state']['militiaSnapshot'],
  ) => AcceptedMilitia['state']['militiaSnapshot'],
  revision = base.revision + 1,
): AcceptedMilitia {
  return {
    ...base,
    revision,
    state: {
      ...base.state,
      militiaSnapshot: change(base.state.militiaSnapshot),
    },
  };
}
const run = (
  actions: CorrectionAction[],
  state: Correction = closedCorrection,
) => actions.reduce(correctionReducer, state);
const openValues = (from = accepted()) =>
  run([
    {
      type: 'open',
      target: { kind: 'section', section: 'values' },
      accepted: from,
    },
  ]);
const yours = (from = accepted(), treasuryCopper = 50000) => ({
  ...sectionValue('values', from.state.militiaSnapshot),
  treasuryCopper,
});

function send(state: Correction, from: AcceptedMilitia, value = yours(from)) {
  const plan = planSectionSave(state, from, 'values', value);
  if (plan.kind !== 'send') throw new Error(`expected send, got ${plan.kind}`);
  return plan;
}

describe('opening and cancelling', () => {
  test('only one correction is open on a device; Cancel closes it without a write', () => {
    const base = accepted();
    const open = openValues(base);
    expect(open.kind).toBe('open');
    const second = correctionReducer(open, {
      type: 'open',
      target: { kind: 'officers' },
      accepted: base,
    });
    expect(second).toBe(open);
    expect(correctionReducer(open, { type: 'cancel' })).toEqual(
      closedCorrection,
    );
  });

  test('an unchanged section has nothing to save', () => {
    const base = accepted();
    const open = openValues(base);
    expect(
      planSectionSave(
        open,
        base,
        'values',
        sectionValue('values', base.state.militiaSnapshot),
      ),
    ).toEqual({ kind: 'unchanged' });
  });
});

describe('saving against the latest militia', () => {
  test('a change to another section merges onto the latest snapshot at its newest revision', () => {
    const opened = accepted();
    const open = openValues(opened);
    const latest = withSnapshot(opened, (snapshot) => ({
      ...snapshot,
      roster: {
        ...snapshot.roster,
        teams: snapshot.roster.teams.map((team) => ({
          ...team,
          notes: 'Found',
        })),
      },
    }));
    const plan = send(open, latest, yours(opened));
    expect(plan.attempt.expectedRevision).toBe(4);
    expect(plan.snapshot.treasuryCopper).toBe(50000);
    expect(plan.snapshot.roster.teams[0]?.notes).toBe('Found');
  });

  test('another player changing the same section is a conflict, never a field merge', () => {
    const opened = accepted();
    const open = openValues(opened);
    const theirs = withSnapshot(opened, (snapshot) => ({
      ...snapshot,
      notoriety: 30,
    }));
    expect(planSectionSave(open, theirs, 'values', yours(opened))).toEqual({
      kind: 'conflict',
    });
    const conflict = correctionReducer(open, { type: 'conflict' });
    expect(correctionView(conflict, theirs)).toEqual({ kind: 'conflict' });
  });

  test('Start again captures the newest section, so the next Save is no longer a conflict', () => {
    const opened = accepted();
    const theirs = withSnapshot(opened, (snapshot) => ({
      ...snapshot,
      notoriety: 30,
    }));
    const restarted = run(
      [{ type: 'conflict' }, { type: 'restart', accepted: theirs }],
      openValues(opened),
    );
    expect(correctionView(restarted, theirs)).toEqual({
      kind: 'editing',
      notice: null,
      message: null,
    });
    const plan = send(restarted, theirs, yours(theirs));
    expect(plan.snapshot.notoriety).toBe(30);
  });

  test('a pending Save cannot be duplicated, cancelled or restarted', () => {
    const base = accepted();
    const open = openValues(base);
    const plan = send(open, base);
    const saving = correctionReducer(open, {
      type: 'submit',
      attempt: plan.attempt,
    });
    expect(correctionView(saving, base)).toEqual({ kind: 'saving' });
    expect(planSectionSave(saving, base, 'values', yours(base))).toEqual({
      kind: 'busy',
    });
    for (const action of [
      { type: 'cancel' },
      { type: 'restart', accepted: base },
      { type: 'submit', attempt: { ...plan.attempt, candidate: 'other' } },
    ] satisfies CorrectionAction[])
      expect(correctionReducer(saving, action)).toBe(saving);
  });

  test('an accepted Save closes the correction with feedback for its section', () => {
    const base = accepted();
    const open = openValues(base);
    const { attempt } = send(open, base);
    expect(
      run(
        [
          { type: 'submit', attempt },
          { type: 'accepted', attempt },
        ],
        open,
      ),
    ).toEqual({
      kind: 'closed',
      feedback: { kind: 'saved', entry: 'values' },
    });
  });

  test('a late acknowledgement for another attempt is ignored', () => {
    const base = accepted();
    const open = openValues(base);
    const { attempt } = send(open, base);
    const saving = correctionReducer(open, { type: 'submit', attempt });
    const stale = { ...attempt, expectedRevision: 1 };
    expect(
      correctionReducer(saving, { type: 'accepted', attempt: stale }),
    ).toBe(saving);
  });
});

describe('failures and reconciliation', () => {
  test('a refusal at the newest revision keeps the input and reports it', () => {
    const base = accepted();
    const open = openValues(base);
    const { attempt } = send(open, base);
    const rejected = run(
      [
        { type: 'submit', attempt },
        { type: 'rejected', attempt, message: 'Campaign editing is paused' },
      ],
      open,
    );
    expect(correctionView(rejected, base)).toEqual({
      kind: 'editing',
      notice: 'rejected',
      message: 'Campaign editing is paused',
    });
    // Saving again is allowed and uses the same newest revision.
    expect(send(rejected, base).attempt.expectedRevision).toBe(3);
  });

  test('a revision race with another section asks for a retry against the refreshed militia', () => {
    const base = accepted();
    const open = openValues(base);
    const { attempt } = send(open, base);
    const rejected = run(
      [
        { type: 'submit', attempt },
        { type: 'rejected', attempt, message: null },
      ],
      open,
    );
    const characterEdit = withSnapshot(base, (snapshot) => ({
      ...snapshot,
      characters: snapshot.characters.map((c) => ({ ...c, charisma: 20 })),
    }));
    expect(correctionView(rejected, characterEdit)).toMatchObject({
      kind: 'editing',
      notice: 'retry',
    });
    const retry = send(rejected, characterEdit);
    expect(retry.attempt.expectedRevision).toBe(4);
    expect(retry.snapshot.characters[0]?.charisma).toBe(20);
  });

  test('a revision race with the same section becomes a conflict', () => {
    const base = accepted();
    const open = openValues(base);
    const { attempt } = send(open, base);
    const rejected = run(
      [
        { type: 'submit', attempt },
        { type: 'rejected', attempt, message: null },
      ],
      open,
    );
    const theirs = withSnapshot(base, (snapshot) => ({ ...snapshot, rank: 5 }));
    expect(correctionView(rejected, theirs)).toEqual({ kind: 'conflict' });
    expect(planSectionSave(rejected, theirs, 'values', yours(base))).toEqual({
      kind: 'conflict',
    });
  });

  test('an unknown acknowledgement is reconciled before another Save is offered', () => {
    const base = accepted();
    const open = openValues(base);
    const plan = send(open, base);
    const unknown = run(
      [
        { type: 'submit', attempt: plan.attempt },
        { type: 'unknown', attempt: plan.attempt },
      ],
      open,
    );
    // Not yet applied: saving again is bound to the same revision, so it can
    // never apply the correction twice.
    expect(correctionView(unknown, base)).toMatchObject({
      notice: 'unconfirmed',
    });
    expect(send(unknown, base).attempt.expectedRevision).toBe(3);
    // The militia now shows these values: close without claiming the reason
    // was stored.
    const applied = {
      ...base,
      revision: 4,
      state: { ...base.state, militiaSnapshot: plan.snapshot },
    };
    expect(correctionView(unknown, applied)).toEqual({
      kind: 'closed',
      feedback: { kind: 'matched', entry: 'values' },
    });
    // Another player changed this section instead.
    const theirs = withSnapshot(base, (snapshot) => ({ ...snapshot, rank: 5 }));
    expect(correctionView(unknown, theirs)).toEqual({ kind: 'conflict' });
    // Only another section changed: not applied, save again at the newer revision.
    const other = withSnapshot(base, (snapshot) =>
      mergeSection('settlements', snapshot, []),
    );
    expect(correctionView(unknown, other)).toMatchObject({
      notice: 'unconfirmed',
    });
    expect(send(unknown, other).attempt.expectedRevision).toBe(4);
  });

  test('a new week requires restarting from its facts; an old-week edit is never applied to it', () => {
    const base = accepted();
    const open = openValues(base);
    const next: AcceptedMilitia = {
      revision: 4,
      draftId: 'week-10',
      state: { ...base.state, week: 10 },
    };
    expect(correctionView(open, next)).toEqual({ kind: 'weekChanged' });
    expect(planSectionSave(open, next, 'values', yours(base))).toEqual({
      kind: 'busy',
    });
    const restarted = correctionReducer(open, {
      type: 'restart',
      accepted: next,
    });
    expect(correctionView(restarted, next)).toMatchObject({ kind: 'editing' });
  });
});

// Characters & officers' corrections (#183): Correct officers replaces
// only the assignments, Correct roster membership and overrides; both
// compare the whole roster baseline and merge everything else.
type Snapshot = AcceptedMilitia['state']['militiaSnapshot'];
const openRoster = (kind: 'officers' | 'roster', from = accepted()) =>
  run([{ type: 'open', target: { kind }, accepted: from }]);
const withMarshal = (latest: Snapshot) =>
  applyOfficerCorrection(latest, [
    ...latest.roster.officers.filter((officer) => officer.role !== 'marshal'),
    { role: 'marshal', characterId: 'officer' },
  ]);
function sendOfficers(state: Correction, from: AcceptedMilitia) {
  const plan = planRosterSave(state, from, withMarshal);
  if (plan.kind !== 'send') throw new Error(`expected send, got ${plan.kind}`);
  return plan;
}

describe('officer and roster corrections', () => {
  test('are exclusive with section editing and close with feedback when saved', () => {
    const base = accepted();
    const officers = run(
      [
        {
          type: 'open',
          target: { kind: 'section', section: 'values' },
          accepted: base,
        },
      ],
      openRoster('officers', base),
    );
    expect(officers).toMatchObject({
      kind: 'open',
      target: { kind: 'officers' },
    });
    expect(planSectionSave(officers, base, 'values', yours(base))).toEqual({
      kind: 'busy',
    });
    expect(planRosterSave(openValues(base), base, withMarshal)).toEqual({
      kind: 'busy',
    });
    const { attempt } = sendOfficers(officers, base);
    expect(
      run(
        [
          { type: 'submit', attempt },
          { type: 'accepted', attempt },
        ],
        officers,
      ),
    ).toEqual({
      kind: 'closed',
      feedback: { kind: 'saved', entry: 'officers' },
    });
  });

  test('merge onto the newest militia when only other facts changed; an unchanged roster is not sent', () => {
    const base = accepted();
    const officers = openRoster('officers', base);
    const moved = withSnapshot(base, (snapshot) => ({
      ...snapshot,
      notoriety: 30,
      characters: snapshot.characters.map((c) => ({ ...c, charisma: 20 })),
      roster: {
        ...snapshot.roster,
        teams: snapshot.roster.teams.map((team) => ({
          ...team,
          name: `${team.name} (renamed)`,
        })),
      },
    }));
    const plan = sendOfficers(officers, moved);
    expect(plan.attempt.expectedRevision).toBe(4);
    expect(plan.snapshot).toEqual(withMarshal(moved.state.militiaSnapshot));
    expect(planRosterSave(officers, moved, (latest) => latest)).toEqual({
      kind: 'unchanged',
    });
  });

  test('another player’s roster, assignment, manager or kind change is a conflict', () => {
    const base = accepted();
    const changes: ((snapshot: Snapshot) => Snapshot)[] = [
      (snapshot) => applyRosterCorrection(snapshot, [], []),
      (snapshot) => applyOfficerCorrection(snapshot, []),
      (snapshot) => ({
        ...snapshot,
        roster: {
          ...snapshot.roster,
          teams: snapshot.roster.teams.map((team) => ({
            ...team,
            managerCharacterId: null,
          })),
        },
      }),
      (snapshot) => ({
        ...snapshot,
        roster: {
          ...snapshot.roster,
          people: snapshot.roster.people.map((person) => ({
            ...person,
            kind: person.kind === 'pc' ? ('npc' as const) : ('pc' as const),
          })),
        },
      }),
    ];
    for (const change of changes)
      for (const kind of ['officers', 'roster'] as const) {
        const open = openRoster(kind, base);
        expect(
          planRosterSave(open, withSnapshot(base, change), withMarshal),
        ).toEqual({ kind: 'conflict' });
      }
  });

  test('a refusal raced by another section’s write retries against the rebuilt candidate', () => {
    const base = accepted();
    const roster = openRoster('roster', base);
    const { attempt } = sendOfficers(roster, base);
    const refused = run(
      [
        { type: 'submit', attempt },
        { type: 'rejected', attempt, message: 'Militia changed.' },
      ],
      roster,
    );
    const moved = withSnapshot(base, (snapshot) => ({
      ...snapshot,
      notoriety: 30,
    }));
    expect(correctionView(refused, moved)).toMatchObject({
      kind: 'editing',
      notice: 'retry',
    });
    expect(sendOfficers(refused, moved).attempt.expectedRevision).toBe(4);
  });

  test('an unconfirmed Save the militia now shows closes as matched; otherwise it stays open', () => {
    const base = accepted();
    const roster = openRoster('roster', base);
    const { attempt, snapshot } = sendOfficers(roster, base);
    const unknown = run(
      [
        { type: 'submit', attempt },
        { type: 'unknown', attempt },
      ],
      roster,
    );
    expect(correctionView(unknown, base)).toMatchObject({
      kind: 'editing',
      notice: 'unconfirmed',
    });
    expect(
      correctionView(
        unknown,
        withSnapshot(base, () => snapshot),
      ),
    ).toEqual({
      kind: 'closed',
      feedback: { kind: 'matched', entry: 'roster' },
    });
    expect(
      correctionView(
        unknown,
        withSnapshot(base, (latest) => ({ ...latest, notoriety: 30 })),
      ),
    ).toMatchObject({ kind: 'editing', notice: 'unconfirmed' });
  });
});

describe('settling an unconfirmed Save', () => {
  test('a retry refused because the first Save was applied closes as matched, not as a conflict', () => {
    const base = accepted();
    const open = openValues(base);
    const first = send(open, base);
    const unknown = run(
      [
        { type: 'submit', attempt: first.attempt },
        { type: 'unknown', attempt: first.attempt },
      ],
      open,
    );
    // Saved again before the first write was observed; refused as stale.
    const retry = send(unknown, base);
    const refused = run(
      [
        { type: 'submit', attempt: retry.attempt },
        { type: 'rejected', attempt: retry.attempt, message: null },
      ],
      unknown,
    );
    const applied = {
      ...base,
      revision: 4,
      state: { ...base.state, militiaSnapshot: first.snapshot },
    };
    expect(correctionView(refused, applied)).toEqual({
      kind: 'closed',
      feedback: { kind: 'matched', entry: 'values' },
    });
  });

  test('once settled, the correction closes and the page is free for the next one', () => {
    const base = accepted();
    const open = openValues(base);
    const { attempt } = send(open, base);
    const reconciled = run(
      [
        { type: 'submit', attempt },
        { type: 'unknown', attempt },
        { type: 'reconciled', feedback: { kind: 'matched', entry: 'values' } },
      ],
      open,
    );
    expect(reconciled).toEqual({
      kind: 'closed',
      feedback: { kind: 'matched', entry: 'values' },
    });
    expect(
      correctionReducer(reconciled, {
        type: 'open',
        target: { kind: 'roster' },
        accepted: base,
      }),
    ).toMatchObject({ kind: 'open' });
  });
});
