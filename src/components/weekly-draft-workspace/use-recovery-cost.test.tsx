import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { UpkeepDisabledTeam } from './types';
import { useRecoveryCost } from './use-recovery-cost';

function team(
  adjustment: UpkeepDisabledTeam['adjustment'] = null,
): UpkeepDisabledTeam {
  return {
    teamId: 'scouts',
    name: 'Scouts',
    typeName: 'Patrons',
    tier: 1,
    decision: 'recover',
    rulesCostCopper: 3000,
    enteredCostCopper: 3000 - (adjustment?.deltaCopper ?? 0),
    adjustment,
    fundsException: null,
    issues: [],
  };
}

function setup(initial = team()) {
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
  const hook = renderHook(({ team }) => useRecoveryCost(team, edit), {
    initialProps: { team: initial },
  });
  return { edit, hook };
}

const recover = (
  recoveryAdjustment: { deltaCopper: number; reason: string } | null,
) => ({
  kind: 'upkeep_team',
  teamId: 'scouts',
  decision: { teamId: 'scouts', decision: 'recover', costCopper: 3000 },
  recoveryAdjustment,
});

test('the recovery cost starts from the shared price in gp', () => {
  const { hook } = setup(team({ deltaCopper: 2993, reason: 'Favour owed' }));
  expect(hook.result.current.form.getValues()).toEqual({
    cost: '0.07',
    reason: 'Favour owed',
  });
  expect(hook.result.current.changed).toBe(true);
});

test('a changed cost waits locally for its reason, then saves the atomic adjustment', async () => {
  const { edit, hook } = setup();
  act(() => hook.result.current.change('cost', '25.5'));
  expect(edit).not.toHaveBeenCalled();
  expect(hook.result.current.form.getValues('cost')).toBe('25.5');
  await waitFor(() =>
    expect(hook.result.current.form.formState.errors.reason?.message).toBe(
      'A reason is required for a changed recovery cost.',
    ),
  );
  act(() => hook.result.current.change('reason', 'Haggled'));
  expect(edit).toHaveBeenLastCalledWith(
    recover({ deltaCopper: 450, reason: 'Haggled' }),
  );
});

test('malformed and empty costs stay local with field errors', async () => {
  const { edit, hook } = setup();
  act(() => hook.result.current.change('cost', '12a'));
  await waitFor(() =>
    expect(hook.result.current.form.formState.errors.cost?.message).toBe(
      'Enter an amount in gp, such as 12 or 0.07.',
    ),
  );
  act(() => hook.result.current.change('cost', ''));
  await waitFor(() =>
    expect(hook.result.current.form.formState.errors.cost?.message).toBe(
      'A recovery cost is required.',
    ),
  );
  expect(hook.result.current.form.getValues('cost')).toBe('');
  expect(edit).not.toHaveBeenCalled();
});

test('returning to the rules cost saves without an adjustment', () => {
  const { edit, hook } = setup(team({ deltaCopper: 500, reason: 'Haggled' }));
  act(() => hook.result.current.change('cost', '30'));
  expect(edit).toHaveBeenLastCalledWith(recover(null));
});

test('Use rules cost clears the adjustment and any invalid local entry', async () => {
  const { edit, hook } = setup(team({ deltaCopper: 500, reason: 'Haggled' }));
  act(() => hook.result.current.change('cost', '1x'));
  act(() => hook.result.current.applyRulesCost());
  expect(edit).toHaveBeenLastCalledWith(recover(null));
  expect(hook.result.current.form.getValues()).toEqual({
    cost: '30',
    reason: '',
  });
  await waitFor(() =>
    expect(hook.result.current.form.formState.errors).toEqual({}),
  );
});

test('a newer shared price replaces a valid local entry but never an invalid one', async () => {
  const { hook } = setup();
  act(() => hook.result.current.change('cost', '30.'));
  hook.rerender({ team: team({ deltaCopper: 1000, reason: 'Remote' }) });
  await waitFor(() =>
    expect(hook.result.current.form.getValues()).toEqual({
      cost: '20',
      reason: 'Remote',
    }),
  );
  act(() => hook.result.current.change('reason', ''));
  hook.rerender({ team: team({ deltaCopper: 2000, reason: 'Other' }) });
  await waitFor(() =>
    expect(hook.result.current.form.formState.errors.reason).toBeDefined(),
  );
  expect(hook.result.current.form.getValues()).toEqual({
    cost: '20',
    reason: '',
  });
});

test('the saved text is kept while it still represents the shared price', () => {
  const { edit, hook } = setup();
  act(() => hook.result.current.change('reason', 'Haggled'));
  act(() => hook.result.current.change('cost', '12.'));
  const saved = edit.mock.lastCall![0];
  expect(saved).toEqual(recover({ deltaCopper: 1800, reason: 'Haggled' }));
  hook.rerender({ team: team({ deltaCopper: 1800, reason: 'Haggled' }) });
  expect(hook.result.current.form.getValues('cost')).toBe('12.');
});
