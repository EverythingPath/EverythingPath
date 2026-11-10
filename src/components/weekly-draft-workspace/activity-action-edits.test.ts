import { describe, expect, test, vi } from 'vitest';
import type { RawRoll, StagedActionChoice } from '~/lib/weekly-draft-facts';
import {
  actionFieldEdits,
  recruitmentCheckFormSchema,
  recruitmentCheckFromForm,
} from './activity-action-edits';

type Drill = Extract<StagedActionChoice, { actionId: 'drill_militia' }>;
const total = (sides: number, count: number, value: number): RawRoll => ({
  sides,
  diceCount: count,
  diceTotal: value,
  provenance: { kind: 'table' },
  modifiers: [],
});
function edits(choice: StagedActionChoice) {
  const change = vi.fn((_field: string, _value: unknown) => true);
  return {
    change,
    edits: actionFieldEdits(choice as Drill, change),
  };
}

describe('detail field edits', () => {
  test('[rules.ACT-12.detail-roll-edits] a roll total replaces only its own roll; a blank clears it and an empty rolls map is omitted', () => {
    const check = total(20, 1, 12);
    const drill: Drill = {
      choiceId: 'drill',
      actionId: 'drill_militia',
      rolls: { check, training: total(6, 2, 7) },
    };
    const { change, edits: drillEdits } = edits(drill);
    drillEdits.setRoll('notoriety', total(6, 1, 4));
    expect(change).toHaveBeenLastCalledWith('rolls', {
      check,
      training: total(6, 2, 7),
      notoriety: total(6, 1, 4),
    });
    drillEdits.setRoll('training', null);
    expect(change).toHaveBeenLastCalledWith('rolls', { check });
    const only = edits({
      choiceId: 'drill',
      actionId: 'drill_militia',
      rolls: { training: total(6, 2, 7) },
    });
    only.edits.setRoll('training', null);
    expect(only.change).toHaveBeenLastCalledWith('rolls', undefined);
  });

  test('[rules.ACT-12.detail-roll-modifiers] roll modifiers are added and removed one recorded entry at a time', () => {
    const training: RawRoll = {
      ...total(6, 2, 7),
      modifiers: [
        { sourceId: 'custom:a', value: 1, reason: 'Veteran drill' },
        { sourceId: 'custom:a', value: 1, reason: 'Veteran drill' },
      ],
    };
    const { change, edits: drillEdits } = edits({
      choiceId: 'drill',
      actionId: 'drill_militia',
      rolls: { training },
    });
    drillEdits.removeRollModifier('training', 1);
    expect(change).toHaveBeenLastCalledWith('rolls', {
      training: { ...training, modifiers: [training.modifiers[0]] },
    });
    drillEdits.addRollModifier('training', {
      sourceId: 'custom:b',
      value: -2,
      reason: 'Rain',
    });
    expect(change).toHaveBeenLastCalledWith('rolls', {
      training: {
        ...training,
        modifiers: [
          ...training.modifiers,
          { sourceId: 'custom:b', value: -2, reason: 'Rain' },
        ],
      },
    });
    // Without a recorded roll there is nothing to attach a modifier to.
    change.mockClear();
    expect(
      drillEdits.addRollModifier('notoriety', {
        sourceId: 'custom:c',
        value: 1,
        reason: 'x',
      }),
    ).toBe(false);
    expect(change).not.toHaveBeenCalled();
  });

  test('[rules.ACT-10.detail-field-edits] consumables, destination and recruitment check write their own field and clear by omission', () => {
    const earn = edits({
      choiceId: 'earn',
      actionId: 'earn_gold',
      consumableIds: ['rumour'],
    });
    earn.edits.addConsumable('map');
    expect(earn.change).toHaveBeenLastCalledWith('consumableIds', [
      'rumour',
      'map',
    ]);
    earn.edits.removeConsumable('rumour');
    expect(earn.change).toHaveBeenLastCalledWith('consumableIds', undefined);
    const rescue = edits({ choiceId: 'rescue', actionId: 'rescue_character' });
    rescue.edits.setDestination('refuge:town');
    expect(rescue.change).toHaveBeenLastCalledWith('destination', {
      kind: 'refuge',
      settlementId: 'town',
    });
    rescue.edits.setDestination('headquarters');
    expect(rescue.change).toHaveBeenLastCalledWith('destination', {
      kind: 'headquarters',
    });
    rescue.edits.setDestination(null);
    expect(rescue.change).toHaveBeenLastCalledWith('destination', undefined);
    const recruit = edits({ choiceId: 'recruit', actionId: 'recruit_team' });
    recruit.edits.setRecruitmentCheck({ check: 'security', dc: 0 });
    expect(recruit.change).toHaveBeenLastCalledWith('recruitmentCheck', {
      check: 'security',
      dc: 0,
    });
    recruit.edits.setRecruitmentCheck(null);
    expect(recruit.change).toHaveBeenLastCalledWith(
      'recruitmentCheck',
      undefined,
    );
  });

  test('[rules.WEEK-14.recruitment-check] the table recruitment check needs a kind and a DC, telling a missing DC from a malformed one', () => {
    const errors = (values: { check?: string; dc: string }) => {
      const parsed = recruitmentCheckFormSchema.safeParse(values);
      return parsed.success
        ? []
        : parsed.error.issues.map((issue) => [issue.path[0], issue.message]);
    };
    expect(errors({ dc: '' })).toEqual([
      ['check', 'Choose a check.'],
      ['dc', 'Enter the DC.'],
    ]);
    expect(errors({ check: 'loyalty', dc: '1e3' })).toEqual([
      ['dc', 'Use digits only.'],
    ]);
    const parsed = recruitmentCheckFormSchema.parse({
      check: 'loyalty',
      dc: '0',
    });
    expect(recruitmentCheckFromForm(parsed)).toEqual({
      check: 'loyalty',
      dc: 0,
    });
  });
});
