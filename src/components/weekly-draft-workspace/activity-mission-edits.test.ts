import { describe, expect, test, vi } from 'vitest';
import type { MissionChoice } from './activity-mission-actions';
import { missionFieldEdits } from './activity-mission-edits';

function edits(choice: MissionChoice) {
  const change = vi.fn((_field: string, _value: unknown) => true);
  let next = 0;
  return {
    change,
    edits: missionFieldEdits(choice, change, () => `new-${++next}`),
  };
}

describe('mission field edits', () => {
  test('[rules.ACT-10.mission-text-edits] saved text is trimmed and blank text clears by omission; yes/no answers keep an explicit No and clear with null', () => {
    const { change, edits: covert } = edits({
      choiceId: 'covert',
      actionId: 'covert_action',
      mode: 'augment',
      location: 'Old mill',
    });
    covert.setText('location', '  Ruined chapel ');
    covert.setText('location', '   ');
    expect(change.mock.calls).toEqual([
      ['location', 'Ruined chapel'],
      ['location', undefined],
    ]);
    const { change: propagandaChange, edits: propaganda } = edits({
      choiceId: 'propaganda',
      actionId: 'spread_propaganda',
    });
    propaganda.setBoolean('occupied', true);
    propaganda.setBoolean('occupied', null);
    expect(propagandaChange.mock.calls).toEqual([
      ['occupied', true],
      ['occupied', undefined],
    ]);
  });

  test('[rules.ACT-10.mission-acknowledgement-edits] What happened keeps its identity when rewritten, gets one new identity when first saved, and clears only its own note', () => {
    const other = {
      acknowledgementId: 'legacy',
      subjectId: 'older:subject',
      outcome: 'Kept from an older editor',
    };
    const { change, edits: special } = edits({
      choiceId: 'special',
      actionId: 'special',
      acknowledgements: [
        other,
        {
          acknowledgementId: 'note',
          subjectId: 'special:special',
          outcome: 'Burned the bridge',
        },
      ],
    });
    special.saveAcknowledgement('special:special', ' Held the bridge ');
    special.clearAcknowledgement('special:special');
    expect(change.mock.calls).toEqual([
      [
        'acknowledgements',
        [
          other,
          {
            acknowledgementId: 'note',
            subjectId: 'special:special',
            outcome: 'Held the bridge',
          },
        ],
      ],
      ['acknowledgements', [other]],
    ]);
    const { change: freshChange, edits: fresh } = edits({
      choiceId: 'strike',
      actionId: 'strike_team',
    });
    fresh.saveAcknowledgement('strike_team:strike', 'Ready at the ford');
    fresh.clearAcknowledgement('strike_team:strike');
    expect(freshChange.mock.calls).toEqual([
      [
        'acknowledgements',
        [
          {
            acknowledgementId: 'new-1',
            subjectId: 'strike_team:strike',
            outcome: 'Ready at the ford',
          },
        ],
      ],
      // The last note removed omits the list.
      ['acknowledgements', undefined],
    ]);
  });

  test('[rules.ACT-10.mission-no-candidate-writes] Guarantee Event edits write only their own field and never the candidates or the selection', () => {
    const { change, edits: guarantee } = edits({
      choiceId: 'guarantee',
      actionId: 'guarantee_event',
      candidates: [{ eventId: 'a', origin: { kind: 'rolled' } }],
      selectedEventId: 'a',
    });
    guarantee.set('costCopper', 0);
    guarantee.setRoll('notoriety', {
      diceTotal: 4,
      diceCount: 1,
      sides: 6,
      provenance: { kind: 'table' },
      modifiers: [],
    });
    guarantee.saveAcknowledgement('guarantee_event:guarantee', 'Chose 2B');
    expect(change.mock.calls.map(([field]) => field)).toEqual([
      'costCopper',
      'rolls',
      'acknowledgements',
    ]);
    expect(change.mock.calls[0]).toEqual(['costCopper', 0]);
  });
});
