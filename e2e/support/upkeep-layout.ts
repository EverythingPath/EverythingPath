import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  expect,
  type ElementHandle,
  type Locator,
  type Page,
} from '@playwright/test';
import { savePrivate, type Run } from './process';
import {
  expectBoundedWeekHost,
  expectNoHorizontalOverflow,
  expectReachable,
  settleAnimations,
} from './responsive-shell';

// Upkeep's card content at phone and desktop sizes (#140 §8 bullet 5): the
// nearest-settlement cards, the missing team's return row, the disabled
// team's choice cards and the rank feat cards. The settlement/rank
// journey exercises the same content at the tablet size only. Phone
// landscape leaves the editor column about 100px tall, so every choice card
// must still fit it whole.
const sizes = [
  ['phone', 390, 844],
  ['phone-landscape', 844, 390],
  ['desktop', 1440, 900],
] as const;

/** Every visible control in the groups: in the viewport, above the bars, its label fits. */
async function reviewControls(
  page: Page,
  state: string,
  groups: Locator[],
  artifactDirectory: string,
) {
  for (const [size, width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await expect(groups[0]!).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectBoundedWeekHost(page);
    for (const group of groups) {
      const controls = await group.locator('button, a, input').all();
      expect(controls.length, `${state} ${size}: controls`).toBeGreaterThan(0);
      for (const control of controls) {
        if (!(await control.isVisible())) continue;
        await expectReachable(page, control);
        const fit = await control.evaluate((element) => ({
          isButton: element.tagName === 'BUTTON',
          label: element.getAttribute('aria-label') ?? element.textContent,
          fits: element.scrollWidth <= element.clientWidth + 1,
        }));
        // Inputs scroll long values inside their bounds by design.
        if (fit.isButton)
          expect(fit.fits, `${state} ${size}: ${fit.label}`).toBe(true);
      }
    }
    await savePrivate(
      join(artifactDirectory, `canonical-upkeep-${state}-${size}.png`),
      await page.screenshot({ fullPage: true }),
    );
  }
  await page.setViewportSize({ width: 1194, height: 834 });
}

/**
 * On the settlement/rank fixture (maximum notoriety, the missing Riders, the
 * disabled Scouts, a rank gain), opened on one page at the tablet size.
 */
export async function reviewUpkeepChoiceLayout(page: Page, run: Run) {
  const roll = (name: string) =>
    page.getByRole('textbox', { name, exact: true });
  await expect(roll('Attrition Loyalty roll')).toBeVisible();
  await roll('Attrition Loyalty roll').fill('10');
  await roll('Attrition training roll').fill('3');
  await roll('Maximum-notoriety training roll').fill('5');
  // A failed Loyalty check at maximum notoriety asks for the settlement.
  await roll('Notoriety Loyalty roll').fill('1');
  const settlements = page.getByRole('group', {
    name: 'Nearest settlement',
    exact: true,
  });
  const phaendar = settlements.getByRole('button', {
    name: 'Phaendar',
    exact: true,
  });
  await phaendar.click();
  await expect(phaendar).toHaveAttribute('aria-pressed', 'true');
  const riders = page.getByRole('group', {
    name: 'Riders return check',
    exact: true,
  });
  await riders
    .getByRole('textbox', { name: 'Riders return roll', exact: true })
    .fill('19');
  await expect(riders).toContainText('Returns at the end of the week');
  const scouts = page.getByRole('group', {
    name: 'Scouts team condition',
    exact: true,
  });
  await expect(
    scouts.getByRole('button', { name: 'Recover', exact: true }),
  ).toBeVisible();
  await reviewControls(
    page,
    'teams',
    [settlements, riders, scouts],
    run.artifactDirectory,
  );

  await scouts
    .getByRole('button', { name: 'Leave disabled', exact: true })
    .click();
  const rank = page
    .locator('[data-week-editor]')
    .getByRole('region', { name: 'Rank', exact: true });
  await expect(rank).toContainText('Rank 8 → 9');
  const feats = rank.getByRole('group', { name: /rank 9 feat$/ });
  await expect(
    feats.getByRole('button', { name: 'Iron Will', exact: true }),
  ).toBeVisible();
  await reviewControls(page, 'rank', [feats], run.artifactDirectory);
}

// The card's scrolling ancestor: the Week's bounded scroller, or the page's
// own scroller when no inner column scrolls.
function scrollerOf(card: Locator) {
  return card.evaluateHandle((element) => {
    for (let node = element.parentElement; node; node = node.parentElement)
      if (
        ['auto', 'scroll'].includes(getComputedStyle(node).overflowY) &&
        node.scrollHeight > node.clientHeight + 1
      )
        return node;
    return document.scrollingElement ?? document.documentElement;
  });
}

// How far the scroller is scrolled, and how much room it has left below.
function readScroll(scroller: ElementHandle<Element>) {
  return scroller.evaluate((element) => ({
    top: element.scrollTop,
    below: element.scrollHeight - element.clientHeight - element.scrollTop,
  }));
}

/**
 * Runs in the page on the card's scroller; the page's own scroller reports
 * its scroll events on the document. A scroller is quiet once neither a
 * `scroll` event of its own nor a change of `scrollTop` has come for 100 ms.
 * `armed` resolves true once it is quiet, so no earlier scroll is in flight,
 * and records that position. `rested` resolves true once it has left the
 * armed position, its own `scrollend` has come since its last movement, and
 * it is quiet again; movement after a `scrollend` needs a new one. Another
 * scroller's events never count. Each wait resolves false once its own
 * `timeout` ms have passed, on a timer that does not depend on the page's
 * animation frames, and a poll that runs late past that deadline cannot
 * succeed. `rested` needs the `scrollend` as well as the quiet: a starved
 * page can see an unchanged `scrollTop` while the scroll still runs off the
 * main thread.
 */
export function watchScroll(scroller: Element) {
  const target =
    scroller === (document.scrollingElement ?? document.documentElement)
      ? document
      : scroller;
  let top = scroller.scrollTop;
  let changedAt = performance.now();
  let armedTop: number | undefined;
  let ended = false;
  // Any movement restarts the quiet and needs a new `scrollend`.
  const moved = () => {
    top = scroller.scrollTop;
    changedAt = performance.now();
    ended = false;
  };
  const observe = () => {
    if (scroller.scrollTop !== top) moved();
  };
  const scrolled = (event: Event) => {
    if (event.target === target) moved();
  };
  const scrollEnded = (event: Event) => {
    if (event.target !== target) return;
    observe();
    if (armedTop !== undefined && top !== armedTop) ended = true;
  };
  target.addEventListener('scroll', scrolled);
  target.addEventListener('scrollend', scrollEnded);
  const quietAnd = (condition: () => boolean, timeout: number) =>
    new Promise<boolean>((resolve) => {
      const deadline = performance.now() + timeout;
      const finish = (result: boolean) => {
        clearInterval(poll);
        clearTimeout(timer);
        resolve(result);
      };
      const poll = setInterval(() => {
        // A poll overdue from a starved event loop cannot succeed late.
        if (performance.now() >= deadline) return finish(false);
        observe();
        if (performance.now() - changedAt >= 100 && condition()) finish(true);
      }, 16);
      const timer = setTimeout(() => finish(false), timeout);
    });
  return {
    armed: (timeout: number) =>
      quietAnd(() => {
        armedTop = top;
        ended = false;
        return true;
      }, timeout),
    rested: (timeout: number) =>
      quietAnd(() => ended && top !== armedTop, timeout),
    stop: () => {
      target.removeEventListener('scroll', scrolled);
      target.removeEventListener('scrollend', scrollEnded);
    },
  };
}

/**
 * Touch at the tablet size (touch is enabled in this project): a finger pan
 * that starts on a nearest-settlement card scrolls the week instead of
 * dragging the card, and changes no selection on either device; a tap then
 * chooses a card and a tap on the previous card restores it. Starts with
 * `selected` chosen and `other` not.
 */
export async function panAndTapSettlementCards(
  gm: Page,
  player: Page,
  selected: string,
  other: string,
) {
  const card = (page: Page, name: string) =>
    page
      .getByRole('group', { name: 'Nearest settlement', exact: true })
      .getByRole('button', { name, exact: true });
  const expectPressed = async (name: string, value: 'true' | 'false') => {
    for (const page of [gm, player])
      await expect(card(page, name)).toHaveAttribute('aria-pressed', value);
  };
  await expectPressed(selected, 'true');
  await expectPressed(other, 'false');
  // A card dropped outside the selection area glides back to its place, so
  // its box is read once it has settled and the finger lands on the card.
  await settleAnimations(gm);
  const start = await card(gm, other).boundingBox();
  if (!start) throw new Error('No settlement card under the pan');
  const scroller = await scrollerOf(card(gm, other));
  const before = await readScroll(scroller);
  const x = Math.round(start.x + start.width / 2);
  const y = Math.round(start.y + start.height / 2);
  expect(
    await card(gm, other).evaluate(
      (element, point) =>
        element.contains(document.elementFromPoint(point.x, point.y)),
      { x, y },
    ),
    'the pan starts on the card',
  ).toBe(true);
  // The finger moves up to scroll on, or down to scroll back when there is
  // more room above than below.
  const distance = before.top > before.below ? 160 : -160;
  // A finger that lifts while still moving flings the week on, and a tap
  // during that glide only stops it: Chromium, like a phone, sends no click.
  // So the finger comes to rest before it lifts, and the tap waits until the
  // week's scroller is at rest, watched from just before the pan starts.
  const cdp = await gm.context().newCDPSession(gm);
  const touch = (
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    touchPoints: { x: number; y: number }[],
  ) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  let watch;
  try {
    watch = await scroller.evaluateHandle(watchScroll);
    expect(
      await watch.evaluate((scroll) => scroll.armed(5_000)),
      'the week was at rest before the pan',
    ).toBe(true);
    // A finger's own touch events: headless Chromium's synthesized touch
    // scroll gesture sends only touchstart and touchend.
    await touch('touchStart', [{ x, y }]);
    for (let step = 1; step <= 20; step++)
      await touch('touchMove', [
        { x, y: Math.round(y + (distance * step) / 20) },
      ]);
    // It holds still at the end for 150 ms, so it lifts with no velocity and
    // the week does not glide on: its scroll ends as the finger lifts.
    for (let hold = 0; hold < 3; hold++) {
      await sleep(50);
      await touch('touchMove', [{ x, y: Math.round(y + distance) }]);
    }
    await touch('touchEnd', []);
  } finally {
    await cdp.detach();
  }
  expect(
    await watch.evaluate((scroll) => scroll.rested(10_000)),
    'the scroll came to rest after the pan',
  ).toBe(true);
  await watch.evaluate((scroll) => scroll.stop());
  await watch.dispose();
  expect(
    (await readScroll(scroller)).top,
    'the pan scrolled the week',
  ).not.toBe(before.top);
  await scroller.dispose();
  await expect(card(gm, other)).not.toHaveAttribute('style', /translate/);
  await expectPressed(selected, 'true');
  await expectPressed(other, 'false');

  await card(gm, other).tap();
  await expectPressed(other, 'true');
  await expectPressed(selected, 'false');
  await card(gm, selected).tap();
  await expectPressed(selected, 'true');
  await expectPressed(other, 'false');
}
