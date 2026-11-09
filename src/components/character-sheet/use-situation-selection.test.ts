import { act, renderHook } from '@testing-library/react';
import { expect, test } from 'vitest';
import { useSituationSelection } from './use-situation-selection';
import type { SituationGroup } from './stat-breakdown-groups';

const groups: SituationGroup[] = [
  { key: 'shared:fear', text: 'vs. fear', selection: 'fear' },
  {
    key: 'local:first:in darkness',
    text: 'in darkness',
    selection: { local: 'in darkness', sheetEntryId: 'first' },
  },
  {
    key: 'local:second:in darkness',
    text: 'in darkness',
    selection: { local: 'in darkness', sheetEntryId: 'second' },
  },
];

test('players explicitly combine shared and entry-local Situations and clear the preview', () => {
  const view = renderHook(() =>
    useSituationSelection({ groups, scopeKey: 'character-one' }),
  );
  act(() => view.result.current.toggle('shared:fear'));
  act(() => view.result.current.toggle('local:first:in darkness'));
  expect(view.result.current.selections).toEqual([
    'fear',
    { local: 'in darkness', sheetEntryId: 'first' },
  ]);
  expect(view.result.current.isSelected('local:second:in darkness')).toBe(
    false,
  );
  act(() => view.result.current.clear());
  expect(view.result.current.selections).toEqual([]);
});

test('selection clears when changing Character and does not resurrect when returning', () => {
  const view = renderHook(
    ({ scopeKey }) => useSituationSelection({ groups, scopeKey }),
    { initialProps: { scopeKey: 'one' } },
  );
  act(() => view.result.current.toggle('shared:fear'));
  view.rerender({ scopeKey: 'two' });
  expect(view.result.current.selections).toEqual([]);
  view.rerender({ scopeKey: 'one' });
  expect(view.result.current.selections).toEqual([]);
});

test('a removed Situation is forgotten rather than reactivated when its entry returns', () => {
  const view = renderHook(
    ({ choices }) =>
      useSituationSelection({ groups: choices, scopeKey: 'one' }),
    { initialProps: { choices: groups } },
  );
  act(() => view.result.current.toggle('local:first:in darkness'));
  view.rerender({
    choices: groups.filter((group) => group.key !== 'local:first:in darkness'),
  });
  expect(view.result.current.selections).toEqual([]);
  view.rerender({ choices: groups });
  expect(view.result.current.selections).toEqual([]);
});

test('selected Situations stay in picking order when choices reorder or disappear', () => {
  const view = renderHook(
    ({ choices }) =>
      useSituationSelection({ groups: choices, scopeKey: 'one' }),
    { initialProps: { choices: groups } },
  );
  act(() => view.result.current.toggle('local:second:in darkness'));
  act(() => view.result.current.toggle('shared:fear'));
  act(() => view.result.current.toggle('local:first:in darkness'));
  expect(view.result.current.selectedKeys).toEqual([
    'local:second:in darkness',
    'shared:fear',
    'local:first:in darkness',
  ]);
  view.rerender({
    choices: [...groups]
      .reverse()
      .filter((group) => group.key !== 'shared:fear'),
  });
  expect(view.result.current.selections).toEqual([
    { local: 'in darkness', sheetEntryId: 'second' },
    { local: 'in darkness', sheetEntryId: 'first' },
  ]);
});
