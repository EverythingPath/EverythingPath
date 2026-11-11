import { act, renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { useSourceFocus } from './use-source-focus';
import type { Phase } from './types';

const nextFrame = () =>
  act(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );

test('[PER-02.link] a source link shows its phase locally, then focuses the named slot once it renders', async () => {
  const target = document.createElement('div');
  target.id = 'activity-slot-left';
  target.tabIndex = -1;
  const scroll = vi.fn();
  target.scrollIntoView = scroll;
  document.body.append(target);
  const choose = vi.fn();
  const { result, rerender } = renderHook(
    ({ shown }: { shown: Phase }) => useSourceFocus(shown, choose),
    { initialProps: { shown: 'persistent' as Phase } },
  );
  act(() =>
    result.current({ phase: 'activity', anchor: 'activity-slot-left' }),
  );
  expect(choose).toHaveBeenCalledWith('activity');
  expect(document.activeElement).not.toBe(target);
  rerender({ shown: 'activity' });
  await nextFrame();
  expect(scroll).toHaveBeenCalledTimes(1);
  expect(document.activeElement).toBe(target);
  // A later, unrelated return to Activity does not move focus again.
  target.blur();
  rerender({ shown: 'event' });
  rerender({ shown: 'activity' });
  await nextFrame();
  expect(scroll).toHaveBeenCalledTimes(1);
  expect(document.activeElement).not.toBe(target);
  target.remove();
});

test('[SUM-02.go-local] a Review link to its own form focuses the form without re-choosing Review', async () => {
  const form = document.createElement('div');
  form.id = 'review-form-adjustment:bonus';
  const edit = document.createElement('button');
  const reason = document.createElement('textarea');
  reason.setAttribute('aria-invalid', 'true');
  form.append(edit, reason);
  form.scrollIntoView = vi.fn();
  document.body.append(form);
  const choose = vi.fn();
  const { result } = renderHook(() => useSourceFocus('summary', choose));
  act(() =>
    result.current({
      phase: 'summary',
      anchor: 'review-form-adjustment:bonus',
    }),
  );
  await nextFrame();
  // Choosing Review again would count as reviewing the updated week.
  expect(choose).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(reason);
  form.remove();
});

test('[SUM-02.go-phase] a phase-wide or vanished item falls back to the phase editor', async () => {
  const editor = document.createElement('main');
  editor.id = 'week-phase-editor';
  editor.tabIndex = -1;
  editor.scrollTo = vi.fn();
  document.body.append(editor);
  const choose = vi.fn();
  const { result, rerender } = renderHook(
    ({ shown }: { shown: Phase }) => useSourceFocus(shown, choose),
    { initialProps: { shown: 'summary' as Phase } },
  );
  act(() => result.current({ phase: 'event', anchor: null }));
  expect(choose).toHaveBeenCalledWith('event');
  rerender({ shown: 'event' });
  await nextFrame();
  expect(document.activeElement).toBe(editor);
  editor.blur();
  rerender({ shown: 'summary' });
  act(() =>
    result.current({ phase: 'upkeep', anchor: 'upkeep-step-attrition' }),
  );
  rerender({ shown: 'upkeep' });
  await nextFrame();
  expect(document.activeElement).toBe(editor);
  editor.remove();
});
