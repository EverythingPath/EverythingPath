import { describe, expect, test } from 'vitest';
import {
  describeAdjustment,
  describeChange,
  phaseChips,
  type PlanChange,
} from './review-changes';
import type { ReviewNames } from './review-text';

const names: ReviewNames = {
  team: (id) => ({ scouts: 'Hollow Scouts' })[id] ?? 'Unavailable team',
  settlement: (id) => ({ town: 'Longshadow' })[id] ?? 'Unavailable settlement',
  character: () => 'Kasvarina',
  event: (id) => ({ theft: 'Theft · Event 1' })[id] ?? 'Recorded event',
  item: () => 'Wand',
  cache: () => 'Bridge cache',
  source: (value) => value,
};

describe('[SUM-10] plan descriptions shared by live and recorded weeks', () => {
  test('changes name their subject and effect without opaque identities', () => {
    expect(
      describeChange(
        'upkeep',
        {
          kind: 'treasury',
          sourceId: 'recovery:scouts',
          before: 5000,
          after: 4200,
        },
        names,
      ),
    ).toMatchObject({
      subject: 'team:scouts',
      title: 'Hollow Scouts',
      effect: 'Treasury −8 gp',
    });
    expect(
      describeChange(
        'event',
        {
          kind: 'event_team_status',
          eventId: 'ambush',
          teamId: 'scouts',
          before: 'active',
          after: 'disabled',
        },
        names,
      ),
    ).toMatchObject({
      subject: 'event:ambush',
      effect: 'Hollow Scouts Active → Disabled',
    });
    expect(
      describeChange(
        'persistent',
        {
          kind: 'persistent_mitigation',
          eventId: 'theft',
          week: 4,
          succeeded: true,
          total: 22,
          dc: 20,
        },
        names,
      ),
    ).toMatchObject({
      title: 'Theft · Event 1',
      effect: 'Mitigated this week',
      detail: 'Mitigation 22 vs DC 20 · succeeded',
    });
  });

  test('an unfamiliar recorded change stays readable through the general fact text', () => {
    const described = describeChange(
      'activity',
      {
        kind: 'future_kind',
        choiceId: 'c',
        settlementId: 'town',
        costCopper: 7,
      } as unknown as PlanChange,
      names,
    );
    expect(described).toMatchObject({
      subject: 'choice:c',
      effect: 'Future kind',
      detail: 'Future kind · Settlement: Longshadow · Cost: 0.07 gp',
    });
  });

  test('phase chips net the phase plan and never include Table Adjustments', () => {
    const plan: PlanChange[] = [
      { kind: 'training', step: 'attrition', before: 30, after: 25 },
      {
        kind: 'treasury',
        sourceId: 'recovery:scouts',
        before: 5000,
        after: 4200,
      },
      {
        kind: 'team_status',
        teamId: 'scouts',
        status: 'active',
        timing: 'start',
      },
      { kind: 'training', step: 'shortage', before: 25, after: 17 },
    ];
    expect(phaseChips('upkeep', plan)).toEqual([
      'Training −13',
      'Treasury −8 gp',
      '1 team back',
    ]);
    expect(phaseChips('upkeep', [])).toEqual([]);
    // Sabotage requests +4 Notoriety; at 99 the resolver applies only +1.
    const sabotage = {
      choiceId: 'c',
      eventId: 'e',
      checkId: 'e:sabotage:c',
      dc: 20,
      total: 25,
      succeeded: true,
      notoriety: 4,
      acknowledgement: null,
    };
    expect(phaseChips('event', [], [sabotage])).toEqual(['Notoriety +4']);
    expect(phaseChips('event', [], [sabotage], 1)).toEqual(['Notoriety +1']);
  });

  test('adjustments describe exact signed gp, set values and named targets', () => {
    expect(
      describeAdjustment(
        {
          kind: 'militia_value',
          adjustmentId: 'a',
          field: 'treasuryCopper',
          operation: 'add',
          value: -7,
          reason: 'r',
        },
        names,
      ),
    ).toEqual({ kind: 'Militia value', effect: 'Treasury −0.07 gp' });
    expect(
      describeAdjustment(
        {
          kind: 'militia_value',
          adjustmentId: 'a',
          field: 'training',
          operation: 'set',
          value: 0,
          reason: 'r',
        },
        names,
      ).effect,
    ).toBe('Training set to 0');
    expect(
      describeAdjustment(
        {
          kind: 'team_status',
          adjustmentId: 'a',
          teamId: 'gone',
          status: 'missing',
          reason: 'r',
        },
        names,
      ).effect,
    ).toBe('Unavailable team → Missing');
    expect(
      describeAdjustment(
        { kind: 'event_end', adjustmentId: 'a', eventId: 'theft', reason: 'r' },
        names,
      ),
    ).toEqual({ kind: 'End persistent event', effect: 'Ends Theft · Event 1' });
  });
});
