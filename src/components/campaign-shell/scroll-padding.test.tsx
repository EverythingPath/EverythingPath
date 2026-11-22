import { fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useRef } from 'react';
import { useScrollPaddingFor } from './scroll-padding';

afterEach(() => {
  vi.unstubAllGlobals();
});

function Bar({ name }: { name: string }) {
  const bar = useRef<HTMLDivElement>(null);
  useScrollPaddingFor(bar);
  return <div ref={bar} data-bar={name} />;
}

// Two pinned bars at once, such as the phone bottom bar (display:none from
// 768px) and the Characters save point: the reservations add up, and one
// bar leaving or collapsing never clears the other's (#198).
test('pinned bars reserve the sum of their heights, and one leaving keeps the other', () => {
  const observed: { target: Element; notify: () => void }[] = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: () => void) {}
      observe(target: Element) {
        observed.push({ target, notify: this.callback });
      }
      disconnect() {
        observed.length = 0;
      }
    },
  );
  const heights = new Map<string, number>([
    ['shell', 0],
    ['save', 120],
  ]);
  const view = render(
    <>
      <Bar name="shell" />
      <Bar name="save" />
    </>,
  );
  for (const { target } of observed)
    Object.defineProperty(target, 'offsetHeight', {
      get: () => heights.get(target.getAttribute('data-bar')!)!,
    });
  const notify = () => observed.forEach((entry) => entry.notify());
  const root = document.documentElement.style;
  notify();
  expect(root.scrollPaddingBottom).toBe('136px');
  heights.set('shell', 49);
  notify();
  expect(root.scrollPaddingBottom).toBe('185px');
  view.rerender(<Bar name="shell" />);
  expect(root.scrollPaddingBottom).toBe('65px');
  view.unmount();
  expect(root.scrollPaddingBottom).toBe('');
});

test('a pinned bar clears controls in its scrolling rail host, follows resizes, and releases the host on unmount', () => {
  let notify: () => void = () => undefined;
  const disconnect = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        notify = callback;
      }
      observe = vi.fn();
      disconnect = disconnect;
    },
  );
  const view = render(
    <div data-rail-host style={{ overflowY: 'auto' }}>
      <Bar name="save" />
    </div>,
  );
  const host = view.container.querySelector<HTMLElement>('[data-rail-host]')!;
  const bar = view.container.querySelector<HTMLElement>('[data-bar]')!;
  let height = 120;
  Object.defineProperty(bar, 'offsetHeight', { get: () => height });

  notify();
  expect(host.style.scrollPaddingBottom).toBe('136px');
  expect(document.documentElement.style.scrollPaddingBottom).toBe('');
  height = 160;
  notify();
  expect(host.style.scrollPaddingBottom).toBe('176px');
  height = 0;
  notify();
  expect(host.style.scrollPaddingBottom).toBe('');
  height = 120;
  notify();
  view.unmount();
  expect(host.style.scrollPaddingBottom).toBe('');
  expect(disconnect).toHaveBeenCalledOnce();
});

test('a rail host on phone keeps document clearance and moves it when the rail starts scrolling at tablet width', () => {
  let notify: () => void = () => undefined;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        notify = callback;
      }
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
  const view = render(
    <div data-rail-host style={{ overflowY: 'visible' }}>
      <Bar name="save" />
    </div>,
  );
  const host = view.container.querySelector<HTMLElement>('[data-rail-host]')!;
  const bar = view.container.querySelector<HTMLElement>('[data-bar]')!;
  Object.defineProperty(bar, 'offsetHeight', { value: 120 });
  notify();
  expect(document.documentElement.style.scrollPaddingBottom).toBe('136px');
  expect(host.style.scrollPaddingBottom).toBe('');

  // The CSS breakpoint can change the scrolling element without changing
  // the bar's height, so its ResizeObserver need not emit an entry.
  host.style.overflowY = 'auto';
  fireEvent.resize(window);
  expect(host.style.scrollPaddingBottom).toBe('136px');
  expect(document.documentElement.style.scrollPaddingBottom).toBe('');
  host.style.overflowY = 'visible';
  fireEvent.resize(window);
  expect(document.documentElement.style.scrollPaddingBottom).toBe('136px');
  expect(host.style.scrollPaddingBottom).toBe('');

  view.unmount();
  expect(document.documentElement.style.scrollPaddingBottom).toBe('');
  fireEvent.resize(window);
  expect(document.documentElement.style.scrollPaddingBottom).toBe('');
  expect(host.style.scrollPaddingBottom).toBe('');
});

test('clearance belongs to each scrolling ancestor and removing one bar preserves the other container', () => {
  const observed = new Set<() => void>();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: () => void) {}
      observe() {
        observed.add(this.callback);
      }
      disconnect() {
        observed.delete(this.callback);
      }
    },
  );
  const view = render(
    <>
      <Bar name="phone" />
      <div data-rail-host style={{ overflowY: 'auto' }}>
        <div data-detail-pane style={{ overflowY: 'scroll' }}>
          <Bar name="save" />
        </div>
      </div>
    </>,
  );
  for (const bar of view.container.querySelectorAll('[data-bar]'))
    Object.defineProperty(bar, 'offsetHeight', {
      value: bar.getAttribute('data-bar') === 'phone' ? 49 : 120,
    });
  for (const notify of observed) notify();
  const rail = view.container.querySelector<HTMLElement>('[data-rail-host]')!;
  const detail =
    view.container.querySelector<HTMLElement>('[data-detail-pane]')!;
  expect(document.documentElement.style.scrollPaddingBottom).toBe('65px');
  expect(rail.style.scrollPaddingBottom).toBe('');
  expect(detail.style.scrollPaddingBottom).toBe('136px');

  view.rerender(<Bar name="phone" />);
  expect(detail.style.scrollPaddingBottom).toBe('');
  expect(document.documentElement.style.scrollPaddingBottom).toBe('65px');
  view.unmount();
  expect(document.documentElement.style.scrollPaddingBottom).toBe('');
  expect(observed.size).toBe(0);
});
