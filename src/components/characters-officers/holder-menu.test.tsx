import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { RoleHolder } from '~/lib/officer-board';
import { HolderMenu } from './holder-menu';

afterEach(() => {
  vi.restoreAllMocks();
});

const holder: RoleHolder = {
  characterId: 'nara',
  name: 'Nara',
  archived: false,
  counts: true,
  contribution: 'Security +3',
  nonStacking: null,
};

// jsdom has no layout: place ⋯ with its right edge at `right` and give the
// list a 198px width (w-44 at the app's 18px root size).
function openWithTriggerAt(right: number) {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(198);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ x: right - 50, y: 0, width: 50, height: 50 }),
  );
  render(
    <HolderMenu
      holder={holder}
      role="marshal"
      roleLabel="Marshal"
      actions={{ moveTargets: () => [], move: vi.fn(), remove: vi.fn() }}
      onDone={vi.fn()}
    />,
  );
  const options = screen.getByRole('button', { name: 'Options for Nara' });
  fireEvent.click(options);
  return document.getElementById(options.getAttribute('aria-controls')!)!;
}

function renderMenu(targets: { role: 'spymaster'; label: string }[] = []) {
  render(
    <HolderMenu
      holder={holder}
      role="marshal"
      roleLabel="Marshal"
      actions={{
        moveTargets: () => targets,
        move: vi.fn(),
        remove: vi.fn(),
      }}
      onDone={vi.fn()}
    />,
  );
  return screen.getByRole('button', { name: 'Options for Nara' });
}

test('⋯ takes focus back only once the list has closed', () => {
  const options = renderMenu([{ role: 'spymaster', label: 'Spymaster' }]);
  fireEvent.click(options);
  const listId = options.getAttribute('aria-controls')!;
  fireEvent.click(screen.getByRole('button', { name: 'Move to…' }));
  const listOnFocus: boolean[] = [];
  options.addEventListener('focus', () =>
    listOnFocus.push(document.getElementById(listId) !== null),
  );
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(options).toHaveFocus();
  expect(listOnFocus).toEqual([false]);
});

test('Escape closes the list and returns focus to ⋯ when focus has left it for the page', () => {
  const options = renderMenu([{ role: 'spymaster', label: 'Spymaster' }]);
  fireEvent.click(options);
  fireEvent.click(screen.getByRole('button', { name: 'Move to…' }));
  // Focus drops to the page, as when the focused role stops being offered.
  (document.activeElement as HTMLElement).blur();
  fireEvent.keyDown(document.body, { key: 'Escape' });
  expect(options).toHaveAttribute('aria-expanded', 'false');
  expect(options).toHaveFocus();
});

test('Escape in another control never pulls focus back to ⋯', () => {
  const options = renderMenu([{ role: 'spymaster', label: 'Spymaster' }]);
  const elsewhere = document.createElement('button');
  document.body.append(elsewhere);
  fireEvent.click(options);
  (document.activeElement as HTMLElement).blur();
  elsewhere.focus();
  fireEvent.keyDown(elsewhere, { key: 'Escape' });
  expect(elsewhere).toHaveFocus();
  elsewhere.remove();
});

test('with no role to move to, focus stays in the list and Escape returns it to ⋯', () => {
  const options = renderMenu();
  fireEvent.click(options);
  fireEvent.click(screen.getByRole('button', { name: 'Move to…' }));
  expect(screen.getByText('None available.')).toBeVisible();
  const list = document.getElementById(options.getAttribute('aria-controls')!);
  expect(list).toContainElement(document.activeElement as HTMLElement);
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(options).toHaveFocus();
});

test('the list hangs from the right of ⋯ when there is room to its left', () => {
  const list = openWithTriggerAt(360);
  expect(list).toHaveClass('right-0');
  expect(list).not.toHaveClass('left-0');
});

test('the list opens rightwards when hanging from ⋯ would cross the viewport’s left edge (a phone board’s left column)', () => {
  // At 390×844 the left card's ⋯ ends 174px in; a right-hung list started at -24px.
  const list = openWithTriggerAt(174);
  expect(list).toHaveClass('left-0');
  expect(list).not.toHaveClass('right-0');
  expect(screen.getByRole('button', { name: 'Move to…' })).toBeInTheDocument();
});
