import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { ChoiceCards } from './choice-cards';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
class TestPointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;
  isPrimary: boolean;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? 'mouse';
    this.isPrimary = init.isPrimary ?? true;
  }
}
function fixture() {
  vi.stubGlobal('PointerEvent', TestPointerEvent);
  const change = vi.fn();
  render(
    <ChoiceCards
      label="Nearest settlement"
      value="old"
      choices={[
        { value: 'old', label: 'Old town' },
        { value: 'new', label: 'New town' },
      ]}
      onChange={change}
      disabled={false}
    />,
  );
  const card = screen.getByRole('button', { name: 'New town' });
  const target = screen.getByRole('group', {
    name: 'Nearest settlement selection',
  });
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(100, 100, 120, 80),
  );
  return { change, card, target };
}
test('[rules.P81.card-drag] a valid pointer drop highlights its target, stages once and suppresses the synthetic click', () => {
  const { card, target, change } = fixture();
  fireEvent.pointerDown(card, { button: 0, clientX: 20, clientY: 20 });
  fireEvent.pointerMove(card, { clientX: 150, clientY: 130 });
  expect(target).toHaveAttribute('data-drop-active', 'true');
  expect(card.style.transform).not.toBe('');
  fireEvent.pointerUp(card, { clientX: 150, clientY: 130 });
  expect(change).toHaveBeenCalledExactlyOnceWith('new');
  fireEvent.click(card, { detail: 1 });
  expect(change).toHaveBeenCalledTimes(1);
  expect(card.style.transform).toBe('');
  expect(target).toHaveAttribute('data-drop-active', 'false');
});
test('[rules.P81.card-return] outside or cancelled drags restore the card and current selection while tap and keyboard selection remain available', () => {
  const { card, change } = fixture();
  fireEvent.pointerDown(card, { button: 0, clientX: 20, clientY: 20 });
  fireEvent.pointerMove(card, { clientX: 40, clientY: 45 });
  fireEvent.pointerUp(card, { clientX: 40, clientY: 45 });
  fireEvent.click(card, { detail: 1 });
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Old town' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByRole('status')).toHaveTextContent(
    'Your selection is unchanged',
  );
  expect(card.style.transform).toBe('');
  fireEvent.pointerDown(card, { button: 0, clientX: 20, clientY: 20 });
  fireEvent.pointerMove(card, { clientX: 150, clientY: 130 });
  fireEvent.keyDown(card, { key: 'Escape' });
  fireEvent.pointerUp(card, { clientX: 150, clientY: 130 });
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(card, { detail: 0 });
  expect(change).toHaveBeenCalledExactlyOnceWith('new');
  change.mockClear();
  fireEvent.pointerDown(card, { button: 0, clientX: 20, clientY: 20 });
  fireEvent.pointerUp(card, { clientX: 21, clientY: 20 });
  fireEvent.click(card, { detail: 1 });
  expect(change).toHaveBeenCalledExactlyOnceWith('new');
});

test('a finger or pen moving over a card never drags it, so the page can scroll, and its tap still chooses the card', () => {
  const { card, target, change } = fixture();
  expect(card.className.split(' ')).not.toContain('touch-none');
  for (const pointerType of ['touch', 'pen']) {
    fireEvent.pointerDown(card, {
      button: 0,
      pointerType,
      clientX: 20,
      clientY: 20,
    });
    fireEvent.pointerMove(card, { pointerType, clientX: 150, clientY: 130 });
    expect(target).toHaveAttribute('data-drop-active', 'false');
    expect(card.style.transform).toBe('');
    fireEvent.pointerUp(card, { pointerType, clientX: 150, clientY: 130 });
    expect(change).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  }
  // A pan ends in pointercancel and no click; a tap ends in a click.
  fireEvent.pointerCancel(card, { pointerType: 'touch' });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  fireEvent.click(card, { detail: 1 });
  expect(change).toHaveBeenCalledExactlyOnceWith('new');
});

test('a tap still chooses the card when a mouse drag ended without its click', () => {
  const { card, change } = fixture();
  // A drop outside the selection area whose click the browser never sends,
  // as when the card glides back from under the pointer.
  fireEvent.pointerDown(card, { button: 0, clientX: 20, clientY: 20 });
  fireEvent.pointerMove(card, { clientX: 40, clientY: 45 });
  fireEvent.pointerUp(card, { clientX: 40, clientY: 45 });
  expect(change).not.toHaveBeenCalled();
  fireEvent.pointerDown(card, {
    pointerType: 'touch',
    clientX: 20,
    clientY: 20,
  });
  fireEvent.pointerUp(card, { pointerType: 'touch', clientX: 20, clientY: 20 });
  fireEvent.click(card, { detail: 1 });
  expect(change).toHaveBeenCalledExactlyOnceWith('new');
});

test('hovering a card never swaps its fill or text colour, so it cannot dim or imitate the selection', () => {
  fixture();
  for (const name of ['Old town', 'New town']) {
    const classes = screen.getByRole('button', { name }).className.split(' ');
    expect(classes).not.toContain('hover:bg-accent');
    expect(classes).not.toContain('hover:text-accent-foreground');
    expect(classes).toContain('hover:text-foreground');
  }
  expect(screen.getByRole('button', { name: 'Old town' }).className).toContain(
    'aria-pressed:hover:bg-primary/15',
  );
});
