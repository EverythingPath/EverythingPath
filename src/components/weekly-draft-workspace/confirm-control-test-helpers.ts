import { screen, within } from '@testing-library/react';
import { expect } from 'vitest';
import type { ConfirmControl } from './confirm-control';

/** A Confirmation control for views rendered without the store. */
export function confirmControlFixture(
  overrides: Partial<ConfirmControl> = {},
): ConfirmControl {
  return {
    confirming: false,
    disabled: false,
    reason: null,
    confirm: () => undefined,
    ...overrides,
  };
}

const confirmName = /^(Confirm week|Confirming…)$/;

/**
 * The frame's pinned Confirm week. jsdom applies no breakpoint, so without
 * the shell's strip host this is the footer's.
 */
export function pinnedConfirm() {
  return within(screen.getByRole('region', { name: 'Week actions' })).getByRole(
    'button',
    { name: confirmName },
  );
}

/**
 * The review block's Confirm week, after checking that every pinned Confirm
 * shows the same control: the same name, enabled state and pending flag.
 */
export function expectSameConfirm() {
  const top = within(
    screen.getByRole('region', { name: 'Review the week' }),
  ).getByRole('button', { name: confirmName });
  const pinned = screen
    .getAllByRole('region', { name: 'Week actions' })
    .map((region) => within(region).getByRole('button', { name: confirmName }));
  expect(pinned.length).toBeGreaterThan(0);
  for (const button of pinned) {
    expect(button).toHaveAccessibleName(top.textContent.trim());
    expect((button as HTMLButtonElement).disabled).toBe(
      (top as HTMLButtonElement).disabled,
    );
    expect(button.getAttribute('aria-busy')).toBe(
      top.getAttribute('aria-busy'),
    );
  }
  return top;
}
