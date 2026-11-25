import { fireEvent } from '@testing-library/react';
import { expect } from 'vitest';

/**
 * Tab to a control and press Enter, as far as jsdom can: it performs neither
 * Tab navigation nor a native button's Enter or Space activation, and the
 * project has no user-event. The control must be a native, enabled button in
 * the tab order (tabIndex 0) that no ancestor makes inert or hidden; it is
 * focused, its Enter keydown must not be cancelled, and it then gets the click
 * a real Enter produces on a native button (detail 0). A tabIndex of -1, a
 * non-button control or a cancelled Enter fails here.
 */
export function pressWithKeyboard(control: HTMLElement) {
  expect(control).toBeInstanceOf(HTMLButtonElement);
  expect(control).toBeEnabled();
  expect(control.tabIndex).toBe(0);
  expect(control).toBeVisible();
  for (
    let node: HTMLElement | null = control;
    node;
    node = node.parentElement
  ) {
    expect(node).not.toHaveAttribute('inert');
    expect(node).not.toHaveAttribute('aria-hidden', 'true');
  }
  control.focus();
  expect(control).toHaveFocus();
  expect(fireEvent.keyDown(control, { key: 'Enter', code: 'Enter' })).toBe(
    true,
  );
  fireEvent.click(control, { detail: 0 });
}
