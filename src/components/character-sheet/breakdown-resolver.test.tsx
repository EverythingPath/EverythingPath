import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, test, vi } from 'vitest';
import {
  BreakdownResolverProvider,
  useBreakdownResolver,
  type SelectedSituations,
} from './breakdown-resolver';
import { buildSheet } from './character-sheet-test-fixture';

test('number explanations share previews across Situation picks and refresh when the sheet preview changes', () => {
  const sheet = buildSheet();
  let previewSituation = vi.fn(() => sheet.calculated);
  let selected: SelectedSituations = {
    selections: [],
    selectedKeys: [],
    text: '',
  };
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <BreakdownResolverProvider
        previewSituation={previewSituation}
        adjustments={[]}
        spellcastings={[]}
        selected={selected}
      >
        {children}
      </BreakdownResolverProvider>
    );
  }
  const view = renderHook(() => useBreakdownResolver(), { wrapper: Wrapper });
  expect(view.result.current.previewSituation(['fear'])).toBe(sheet.calculated);
  view.result.current.previewSituation(['fear']);
  expect(previewSituation).toHaveBeenCalledTimes(1);
  selected = { selections: ['fear'], selectedKeys: ['fear'], text: 'vs. fear' };
  view.rerender();
  view.result.current.previewSituation(['fear']);
  expect(previewSituation).toHaveBeenCalledTimes(1);
  previewSituation = vi.fn(() => sheet.calculated);
  view.rerender();
  view.result.current.previewSituation(['fear']);
  view.result.current.previewSituation(['fear']);
  expect(previewSituation).toHaveBeenCalledTimes(1);
});
