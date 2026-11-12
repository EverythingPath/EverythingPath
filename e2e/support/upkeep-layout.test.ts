import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchScroll } from './upkeep-layout';

// The settlement touch journey taps only once its pan's scroll has come to
// rest: a tap during the momentum stops the scroll without a click (GitHub
// run 36624233202). Only the Week scroller's own rest after the pan counts,
// and every wait ends within its own bound.
describe('watchScroll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
    document.documentElement.scrollTop = 0;
  });

  async function settled<T>(promise: Promise<T>) {
    return Promise.race([promise, Promise.resolve('pending' as const)]);
  }

  function scroller(parent: Element = document.body) {
    return parent.appendChild(document.createElement('div'));
  }

  // A glide: the scroller moves 10px every 5ms, with its scroll events, until
  // stopped.
  function glide(element: Element) {
    const timer = setInterval(() => {
      element.scrollTop += 10;
      element.dispatchEvent(new Event('scroll'));
    }, 5);
    return () => clearInterval(timer);
  }

  // Arms the watch on a scroller at rest, as the pan does.
  async function arm(element: Element) {
    const watch = watchScroll(element);
    const armed = watch.armed(5_000);
    await vi.advanceTimersByTimeAsync(150);
    expect(await settled(armed)).toBe(true);
    return watch;
  }

  it('rests once its scroller has moved, sent its scrollend and stayed quiet', async () => {
    const week = scroller();
    const watch = await arm(week);
    const stop = glide(week);
    const rested = watch.rested(10_000);
    await vi.advanceTimersByTimeAsync(200);
    expect(await settled(rested)).toBe('pending');
    stop();
    await vi.advanceTimersByTimeAsync(300);
    expect(await settled(rested)).toBe('pending');
    week.dispatchEvent(new Event('scrollend'));
    await vi.advanceTimersByTimeAsync(50);
    expect(await settled(rested)).toBe(true);
  });

  it("ignores another scroller's scrollend while its own is still scrolling", async () => {
    const week = scroller();
    const inner = scroller(week);
    const sidebar = scroller();
    const watch = await arm(week);
    const stop = glide(week);
    const rested = watch.rested(10_000);
    sidebar.scrollTop = 40;
    sidebar.dispatchEvent(new Event('scrollend'));
    inner.dispatchEvent(new Event('scrollend', { bubbles: true }));
    document.dispatchEvent(new Event('scrollend'));
    await vi.advanceTimersByTimeAsync(100);
    stop();
    await vi.advanceTimersByTimeAsync(300);
    expect(await settled(rested)).toBe('pending');
    week.dispatchEvent(new Event('scrollend'));
    await vi.advanceTimersByTimeAsync(50);
    expect(await settled(rested)).toBe(true);
  });

  it('ignores a stale scrollend before its scroller has moved', async () => {
    const week = scroller();
    week.scrollTop = 100;
    const watch = await arm(week);
    const rested = watch.rested(10_000);
    week.dispatchEvent(new Event('scrollend'));
    week.scrollTop = 260;
    await vi.advanceTimersByTimeAsync(300);
    expect(await settled(rested)).toBe('pending');
    week.dispatchEvent(new Event('scrollend'));
    await vi.advanceTimersByTimeAsync(50);
    expect(await settled(rested)).toBe(true);
  });

  it('ignores a stale scrollend followed by a pause and resumed motion', async () => {
    const week = scroller();
    const watch = await arm(week);
    let stop = glide(week);
    const rested = watch.rested(10_000);
    await vi.advanceTimersByTimeAsync(30);
    week.dispatchEvent(new Event('scrollend'));
    stop();
    await vi.advanceTimersByTimeAsync(60);
    expect(await settled(rested)).toBe('pending');
    stop = glide(week);
    await vi.advanceTimersByTimeAsync(200);
    expect(await settled(rested)).toBe('pending');
    stop();
    week.dispatchEvent(new Event('scrollend'));
    await vi.advanceTimersByTimeAsync(150);
    expect(await settled(rested)).toBe(true);
  });

  it('needs a new scrollend once its scroller has moved again', async () => {
    const week = scroller();
    const watch = await arm(week);
    let stop = glide(week);
    const rested = watch.rested(10_000);
    await vi.advanceTimersByTimeAsync(200);
    stop();
    week.dispatchEvent(new Event('scrollend'));
    await vi.advanceTimersByTimeAsync(50);
    stop = glide(week);
    await vi.advanceTimersByTimeAsync(200);
    stop();
    await vi.advanceTimersByTimeAsync(300);
    expect(await settled(rested)).toBe('pending');
    week.dispatchEvent(new Event('scrollend'));
    await vi.advanceTimersByTimeAsync(150);
    expect(await settled(rested)).toBe(true);
  });

  it('refuses a success that an overdue poll finds past the deadline', async () => {
    const week = scroller();
    const watch = await arm(week);
    const rested = watch.rested(10_000);
    const stop = glide(week);
    await vi.advanceTimersByTimeAsync(100);
    stop();
    await vi.advanceTimersByTimeAsync(20);
    week.dispatchEvent(new Event('scrollend'));
    // A starved event loop: the clock jumps past the deadline in one go, and
    // the overdue poll runs before the timeout does.
    const now = performance.now.bind(performance);
    vi.spyOn(performance, 'now').mockImplementation(() => now() + 20_000);
    await vi.advanceTimersByTimeAsync(16);
    expect(await settled(rested)).toBe(false);
  });

  it('arms only once its scroller has come to rest', async () => {
    const week = scroller();
    const stop = glide(week);
    const armed = watchScroll(week).armed(5_000);
    await vi.advanceTimersByTimeAsync(200);
    expect(await settled(armed)).toBe('pending');
    stop();
    await vi.advanceTimersByTimeAsync(150);
    expect(await settled(armed)).toBe(true);
  });

  it("watches the document when the page's own scroller moves", async () => {
    const page = document.documentElement;
    const watch = await arm(page);
    const rested = watch.rested(10_000);
    page.scrollTop = 160;
    scroller().dispatchEvent(new Event('scrollend', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(300);
    expect(await settled(rested)).toBe('pending');
    document.dispatchEvent(new Event('scrollend'));
    await vi.advanceTimersByTimeAsync(50);
    expect(await settled(rested)).toBe(true);
  });

  it('bounds each wait by its own timeout', async () => {
    const week = scroller();
    const stop = glide(week);
    const watch = watchScroll(week);
    const armed = watch.armed(5_000);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(await settled(armed)).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    expect(await settled(armed)).toBe(false);
    stop();
    const rearmed = watch.armed(5_000);
    await vi.advanceTimersByTimeAsync(150);
    expect(await settled(rearmed)).toBe(true);
    glide(week);
    const rested = watch.rested(10_000);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(await settled(rested)).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    expect(await settled(rested)).toBe(false);
  });

  it('ends every wait within its bound when animation frames stop', async () => {
    vi.stubGlobal('requestAnimationFrame', () => 0);
    const week = scroller();
    const stop = glide(week);
    const watch = watchScroll(week);
    const armed = watch.armed(5_000);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await settled(armed)).toBe(false);
    stop();
    const rested = watch.rested(10_000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await settled(rested)).toBe(false);
  });
});
