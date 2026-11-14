import { expect, type Locator, type Page } from '@playwright/test';
import { readControls, settleAnimations } from './control-geometry';

export { settleAnimations };

// Geometry and reachability checks for the campaign shell (#150) and the
// Week frame (#151). Viewport resizing here is layout evidence only:
// headless browsers open no OS keyboard and report zero safe-area insets,
// so keyboard and notch behavior need a real device. The phone layout
// applies below 768px; from 768px the top bar carries the section links.
// The Week route is bounded to the viewport at every width and scrolls its
// editor column. Other Militia pages scroll within their rail host from
// 768px and as a document on phone; pages without a rail use the document.

// The document, and on the bounded Week route also the frame that clips it,
// the editor column that scrolls, the docked reference panel and any open
// dialog or sheet, all fit their own width. The top bar's controls are
// checked by their boxes too: a header that clips its own overflow would
// hide controls without any document overflow. The Pages strip scrolls
// horizontally, so its own box and current page must fit instead.
export async function expectNoHorizontalOverflow(page: Page) {
  const overflowing = await page.evaluate(() => {
    const boxes = [
      document.documentElement,
      ...document.querySelectorAll(
        'header, [data-shell-frame="bounded"], [data-week-host], [data-week-editor], [data-week-reference], [role="dialog"]',
      ),
    ];
    return boxes
      .filter((box) => box.scrollWidth > box.clientWidth + 1)
      .map((box) => box.tagName.toLowerCase());
  });
  expect(overflowing, 'no horizontal overflow').toEqual([]);
  const { width } = page.viewportSize()!;
  // One snapshot of the same page state the document check above read, in
  // one browser call (#774); a page without a top bar has no controls here.
  for (const control of await readControls(
    page.locator(
      'header :is(a, button, [role="combobox"]):visible:not(nav[aria-label="Pages"] *)',
    ),
  )) {
    expect(control.bounds, 'top bar content has a box').not.toBeNull();
    const bounds = control.bounds!;
    expect(
      bounds.x + bounds.width,
      'top bar content fits the viewport',
    ).toBeLessThanOrEqual(width + 1);
    expect(
      bounds.x,
      'top bar content starts inside the viewport',
    ).toBeGreaterThanOrEqual(-1);
  }
  for (const strip of await page
    .locator('nav[aria-label="Pages"]:visible')
    .all()) {
    const bounds = (await strip.boundingBox())!;
    expect(
      bounds.x,
      'Pages strip starts inside the viewport',
    ).toBeGreaterThanOrEqual(-1);
    expect(
      bounds.x + bounds.width,
      'Pages strip fits the viewport',
    ).toBeLessThanOrEqual(width + 1);
    const active = strip.locator('a[aria-current="page"]');
    await expect(active).toHaveCount(1);
    await expect
      .poll(
        async () => {
          const visible = await strip.boundingBox();
          const current = await active.boundingBox();
          return (
            visible !== null &&
            current !== null &&
            current.x >= visible.x - 1 &&
            current.x + current.width <= visible.x + visible.width + 1
          );
        },
        { message: 'current page fits wholly inside the visible Pages strip' },
      )
      .toBe(true);
  }
}

/**
 * The top bar's own row stays one line: every visible control in it shares
 * a horizontal band. At tablet landscape (1180 and 1194px) every page,
 * the Week included now that the top bar carries no save status, fits one
 * slim row (#135 §1, #198). The maintenance banner
 * above it is not part of the row.
 */
export async function expectTopBarOneRow(page: Page) {
  const bands = () =>
    page
      .locator('[data-top-bar-row] :is(a, button, [role="combobox"]):visible')
      .evaluateAll((elements) =>
        elements.map((element) => {
          const { top, bottom } = element.getBoundingClientRect();
          return { top, bottom };
        }),
      );
  await expect
    .poll(
      async () => {
        const boxes = await bands();
        return (
          boxes.length > 0 &&
          Math.max(...boxes.map((box) => box.top)) <
            Math.min(...boxes.map((box) => box.bottom))
        );
      },
      { message: 'the top bar keeps one row' },
    )
    .toBe(true);
}

// The phone bar is the visible sections navigation that carries More.
function bottomNavigation(page: Page) {
  return page
    .locator('nav[aria-label="Areas"]:visible')
    .filter({ has: page.getByRole('button', { name: 'More' }) });
}

// The bar's bottom edge against the layout viewport's (headless browsers
// report no safe-area inset, so the bar's padding below the tabs is 0). The
// bar is found by its status-strip host rather than by role: an open sheet
// hides everything outside it from the accessibility tree.
async function expectBarAtViewportBottom(page: Page, when: string) {
  const bar = (await page
    .locator('[data-shell-slot="phone-status-strip"]')
    .locator('..')
    .boundingBox({ timeout: 5_000 }))!;
  const viewport = await page.evaluate(
    () => document.documentElement.clientHeight,
  );
  expect(
    Math.abs(bar.y + bar.height - viewport),
    `the bottom bar is pinned to the viewport's bottom edge ${when}`,
  ).toBeLessThanOrEqual(1);
}

/**
 * Below 768px the bottom bar stays pinned to the viewport's bottom edge
 * wherever the document is scrolled: at the top, midway and at the end. The
 * body must never become a scroll container of its own (only visible or
 * clipped overflow), or the sticky bar would stick to the end of the page
 * instead (#198). With `tall`, the page must actually scroll, so the check
 * cannot pass on a page the bar would end anyway. Restores the scroll.
 */
export async function expectBottomBarPinned(page: Page, tall = false) {
  await expect(bottomNavigation(page)).toHaveCount(1);
  for (const overflow of await page.evaluate(() => {
    const { overflowX, overflowY } = getComputedStyle(document.body);
    return [overflowX, overflowY];
  }))
    expect(
      ['visible', 'clip'],
      'the body is never a scroll container',
    ).toContain(overflow);
  const start = await page.evaluate(() => window.scrollY);
  const end = await page.evaluate(
    () =>
      document.documentElement.scrollHeight -
      document.documentElement.clientHeight,
  );
  if (tall) expect(end, 'the page scrolls as a document').toBeGreaterThan(0);
  try {
    for (const [when, y] of [
      ['at the top', 0],
      ['midway down the page', Math.floor(end / 2)],
      ['at the end of the page', end],
    ] as const) {
      await page.evaluate((to) => window.scrollTo(0, to), y);
      await expectBarAtViewportBottom(page, when);
    }
  } finally {
    await page.evaluate((to) => window.scrollTo(0, to), start);
  }
}

/**
 * The control is inside the visual viewport on both axes and accepts a
 * pointer without force. Page content (not part of the bottom bar, not in a
 * dialog) must also sit above the phone bottom bar. `toBeVisible` alone
 * misses occlusion by fixed chrome.
 */
export async function expectReachable(page: Page, control: Locator) {
  await control.scrollIntoViewIfNeeded();
  await expectControlWithinViewport(page, control);
  await control.click({ trial: true });
}

async function expectControlWithinViewport(page: Page, control: Locator) {
  await expect(control).toBeVisible();
  const bounds = await control.boundingBox();
  expect(bounds, 'control has visible bounds').not.toBeNull();
  const { width, height } = page.viewportSize()!;
  expect(bounds!.x, 'control left edge fits viewport').toBeGreaterThanOrEqual(
    0,
  );
  expect(
    bounds!.x + bounds!.width,
    'control right edge fits viewport',
  ).toBeLessThanOrEqual(width + 1);
  expect(bounds!.y, 'control top edge fits viewport').toBeGreaterThanOrEqual(0);
  expect(
    bounds!.y + bounds!.height,
    'control bottom edge fits viewport',
  ).toBeLessThanOrEqual(height + 1);
  const nav = bottomNavigation(page);
  if ((await nav.count()) > 0 && (await isPageContent(control))) {
    // The whole sticky bar, including the Week frame's status strip above
    // the tabs, must not cover page content.
    const bar = (await nav.first().locator('..').boundingBox())!;
    expect(
      bounds!.y + bounds!.height,
      'page content sits above the bottom bar and its status strip',
    ).toBeLessThanOrEqual(bar.y + 1);
  }
  // The footer is pinned under the editor column only; the reference panel
  // beside it legitimately occupies the same vertical band.
  const footer = page.locator('[data-week-footer]:visible');
  const isInEditor = await isEditorContent(control);
  if ((await footer.count()) > 0 && isInEditor) {
    const pinned = (await footer.first().boundingBox())!;
    expect(
      bounds!.y + bounds!.height,
      'editor content sits above the pinned week footer',
    ).toBeLessThanOrEqual(pinned.y + 1);
  }
  // From 768px Setup's footer is pinned under its detail pane only (#138
  // §3); the step index beside it legitimately shares its vertical band.
  const setupFooter = page.locator('[data-setup-layout="wide"] footer');
  if ((await setupFooter.count()) > 0 && (await isAboveSetupFooter(control))) {
    const pinned = (await setupFooter.boundingBox())!;
    expect(
      bounds!.y + bounds!.height,
      'Setup content sits above the pinned Setup footer',
    ).toBeLessThanOrEqual(pinned.y + 1);
  }
  // The editor column clips what it scrolls: a control above its top edge
  // sits behind the pinned stepper, and one taller than the column can never
  // be seen whole. Long text is read by scrolling, so only controls count.
  if (isInEditor && (await isControl(control))) {
    const column = (await page.locator('[data-week-editor]').boundingBox())!;
    expect(
      bounds!.y,
      'editor content starts inside its scroll column',
    ).toBeGreaterThanOrEqual(column.y - 1);
    expect(
      bounds!.y + bounds!.height,
      'editor content ends inside its scroll column',
    ).toBeLessThanOrEqual(column.y + column.height + 1);
  }
}

/**
 * Every enabled control shown in `scope` is reachable (see
 * `expectReachable`). Each is focused first. In focus mode, only that focus
 * may scroll the control into view; no trial click moves the pointer onto
 * disclosures that open on hover. Visually hidden and aria-hidden elements
 * (such as a native select mirroring a custom one) are not controls a player
 * reaches.
 */
export async function expectControlsReachable(
  page: Page,
  scope: Locator,
  what: string,
  interaction: 'pointer' | 'focus' = 'pointer',
) {
  // Keep scrolling controls from moving underneath a resting pointer and
  // opening hover disclosures during a focus sweep.
  if (interaction === 'focus') await page.mouse.move(0, 0);
  const controls = scope.locator(
    ':is(button, input, textarea, a[href], [role="combobox"]):visible:not(:disabled):not([aria-disabled="true"]):not([aria-hidden="true"]):not(.sr-only)',
  );
  expect(await controls.count(), `${what}: controls`).toBeGreaterThan(0);
  for (const control of await controls.all()) {
    await control.focus();
    if (interaction === 'focus') {
      await expect(control).toBeFocused();
      await expectControlWithinViewport(page, control);
      expect(
        await control.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          const target = document.elementFromPoint(
            bounds.x + bounds.width / 2,
            bounds.y + bounds.height / 2,
          );
          return target !== null && element.contains(target);
        }),
        'focused control is not covered by pinned chrome or another element',
      ).toBe(true);
    } else await expectReachable(page, control);
  }
}

function isEditorContent(control: Locator) {
  return control.evaluate(
    (element) => element.closest('[data-week-editor]') !== null,
  );
}

// In Setup's detail pane (the footer's column) but not in the footer.
function isAboveSetupFooter(control: Locator) {
  return control.evaluate((element) => {
    const pinned = document.querySelector('[data-setup-layout="wide"] footer');
    return (
      pinned !== null &&
      !pinned.contains(element) &&
      pinned.parentElement!.contains(element)
    );
  });
}

function isControl(control: Locator) {
  return control.evaluate((element) =>
    element.matches(
      'button, input, select, textarea, a[href], summary, [role="button"], [role="combobox"]',
    ),
  );
}

// Page content is anything outside a dialog, outside the sticky bar that
// holds the bottom navigation and outside the week footer (their own
// controls sit in them by design).
function isPageContent(control: Locator) {
  return control.evaluate((element) => {
    if (element.closest('[role="dialog"]')) return false;
    if (element.closest('[data-week-footer]')) return false;
    const bar = Array.from(
      document.querySelectorAll('nav[aria-label="Areas"]'),
    ).find((nav) => nav.querySelector('button'))?.parentElement;
    return !bar?.contains(element);
  });
}

async function expectFocusInsideMore(page: Page) {
  expect(
    await page
      .getByRole('dialog', { name: 'More' })
      .evaluate((dialog) => dialog.contains(document.activeElement)),
    'focus stays inside the More sheet',
  ).toBe(true);
}

async function expectMoreClosed(page: Page) {
  await expect(page.getByRole('dialog', { name: 'More' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'More' })).toBeFocused();
}

// The page's first heading a sighted player sees. A visually hidden page
// title (sr-only: 1x1 px and clipped) is for screen readers; it never
// receives a pointer, so a trial click on it would wait forever.
function shownHeading(page: Page) {
  return page.getByRole('heading').and(page.locator(':not(.sr-only)')).first();
}

function sectionNames(nav: Locator) {
  return Promise.all([
    ...['Finished weeks', 'Militia', 'Characters & officers'].map((name) =>
      expect(nav.getByRole('link', { name, exact: true })).toBeVisible(),
    ),
    expect(nav.getByRole('link', { name: /^Week( \d+)?$/ })).toBeVisible(),
    expect(nav.locator('[aria-current="page"]')).toHaveCount(1),
  ]);
}

/** Below 768px: phone bottom bar and More sheet — names, dismissal, focus return, layout. */
export async function exercisePhoneShell(page: Page) {
  const { width, height } = page.viewportSize()!;
  expect(width, 'phone layout applies below 768px').toBeLessThan(768);
  const nav = page
    .getByRole('navigation', { name: 'Areas', exact: true })
    .locator('visible=true');
  await expect(nav).toHaveCount(1);
  await expect(nav.getByRole('button', { name: 'More' })).toBeVisible();
  await expect(
    nav.getByRole('link', { name: 'Campaign', exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole('link', { name: 'Militia', exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole('link', { name: 'Characters', exact: true }),
  ).toBeVisible();
  await sectionNames(
    page.getByRole('navigation', { name: 'Pages', exact: true }),
  );
  // The active tab carries a bar along its top edge, not only a colour.
  expect(
    await nav.locator('[aria-current="page"]').evaluate((tab) => {
      const bar = getComputedStyle(tab, '::before');
      return bar.content !== 'none' && parseFloat(bar.height) > 0;
    }),
    'the active tab shows an indicator bar',
  ).toBe(true);
  await expectNoHorizontalOverflow(page);
  // A short viewport always has more page than screen.
  await expectBottomBarPinned(page, height < 520);
  await expectReachable(page, shownHeading(page));
  const switcher = page.getByRole('combobox', { name: 'Where you are' });
  await expectReachable(page, switcher);

  const more = page.getByRole('button', { name: 'More' });
  await expectReachable(page, more);
  // From the top of the page, so a bar that let go of the viewport while
  // the sheet locks scrolling would drop to the end of the page.
  await page.evaluate(() => window.scrollTo(0, 0));
  await more.focus();
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'More' });
  await expect(sheet).toBeVisible();
  await expectBarAtViewportBottom(page, 'while the More sheet is open');
  const organizationGroup = sheet.getByRole('group', {
    name: 'Organization',
    exact: true,
  });
  const organization = organizationGroup.getByRole('combobox', {
    name: 'Organization',
  });
  await expectReachable(page, organization);
  const label = organizationGroup.getByText('Organization', { exact: true });
  const labelBox = (await label.boundingBox())!;
  const controlBox = (await organization.boundingBox())!;
  expect(
    labelBox.y + labelBox.height,
    'organization label sits above its control',
  ).toBeLessThanOrEqual(controlBox.y + 1);
  await expectReachable(
    page,
    organizationGroup.getByRole('button', { name: 'New organization' }),
  );
  const account = sheet.getByRole('group', { name: 'Account', exact: true });
  await expectReachable(
    page,
    account.getByRole('button', { name: 'Manage account', exact: true }),
  );
  await expectReachable(
    page,
    account.getByRole('button', { name: 'Sign out', exact: true }),
  );
  for (let step = 0; step < 6; step += 1) {
    await page.keyboard.press('Tab');
    await expectFocusInsideMore(page);
  }
  for (let step = 0; step < 6; step += 1) {
    await page.keyboard.press('Shift+Tab');
    await expectFocusInsideMore(page);
  }
  // Escape closes only the open chooser, then the sheet.
  await organization.click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expectMoreClosed(page);

  await more.click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await expectMoreClosed(page);
  expect(page.viewportSize()).toEqual({ width, height });
}

/** From 768px (including a short phone-landscape viewport): top-bar links, no bottom bar. */
export async function exerciseTopBarShell(page: Page) {
  expect(page.viewportSize()!.width).toBeGreaterThanOrEqual(768);
  const nav = page
    .getByRole('navigation', { name: 'Militia pages', exact: true })
    .locator('visible=true');
  await expect(nav).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'More' })).toBeHidden();
  await sectionNames(nav);
  await expectNoHorizontalOverflow(page);
  await expectReachable(page, shownHeading(page));
  const switcher = page.getByRole('combobox', { name: 'Where you are' });
  await expectReachable(page, switcher);
  // A truncated campaign name stays readable in full.
  await expect(switcher).toHaveAttribute('title', /\S/);
  await expectReachable(
    page,
    nav.getByRole('link', { name: 'Characters & officers', exact: true }),
  );
}

// The pinned Week chrome at the current width: the stepper (tablet row or
// desktop rail), the footer from 768px, and the phone bottom bar with its
// status strip below 768px. Each must end within the viewport.
async function pinnedWeekChrome(page: Page) {
  const chrome = [
    page
      .getByRole('navigation', { name: 'Week phases' })
      .locator('visible=true'),
    page.locator('[data-week-footer]:visible'),
    bottomNavigation(page).locator('..'),
  ];
  const boxes: { name: string; box: { y: number; height: number } }[] = [];
  for (const [index, locator] of chrome.entries()) {
    if ((await locator.count()) === 0) continue;
    const box = (await locator.first().boundingBox())!;
    boxes.push({ name: ['stepper', 'footer', 'bottom bar'][index]!, box });
  }
  return boxes;
}

/**
 * The Week route at every width: the host starts after the top bar and
 * ends within the viewport, the document never scrolls, and the editor
 * column is the scroller. With content taller than that column, its first
 * and last enabled controls are reached by scrolling the column while the
 * stepper, footer and phone bar stay exactly where they were. Editors with
 * no enabled controls must still expose their first and last text content.
 */
export async function expectBoundedWeekHost(page: Page) {
  // The top bar sits above the pinned chrome and wraps on a narrow tablet,
  // so a control that finishes loading there (organizations, the account
  // avatar) can reflow it and move the chrome by a row. Capture the baseline
  // once the bar has loaded, so only scrolling can move the chrome. A web
  // font swapping in would reflow it the same way.
  await expect(
    page.locator('header').getByRole('status', { name: /^Loading / }),
    'the top bar has loaded its controls',
  ).toHaveCount(0);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  // Resizing can start finite CSS transitions on the responsive chrome.
  // Capture its baseline only after those settle.
  await settleAnimations(page);
  const host = page.locator('[data-week-host]');
  await expect(host).toHaveCount(1);
  const { height } = page.viewportSize()!;
  const header = (await page.locator('header').first().boundingBox())!;
  const box = (await host.boundingBox())!;
  expect(box.y, 'week host starts after the top bar').toBeGreaterThanOrEqual(
    header.y + header.height - 1,
  );
  expect(
    box.y + box.height,
    'week host ends within the viewport',
  ).toBeLessThanOrEqual(height + 1);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollHeight <= window.innerHeight + 1 &&
        window.scrollY === 0,
    ),
    'the document does not scroll on the week',
  ).toBe(true);
  // Neither the body nor the bounded frame may be a scroll container: a
  // clipped-but-scrollable ancestor lets focus or scrolling into view move
  // the top bar and the pinned chrome off screen with no way back.
  expect(
    await page.evaluate(() =>
      [document.body, document.querySelector('[data-shell-frame]')]
        .filter((element): element is HTMLElement => element !== null)
        .filter((element) => {
          element.scrollTop = 1;
          const scrolled = element.scrollTop !== 0;
          element.scrollTop = 0;
          return scrolled;
        })
        .map((element) => element.tagName.toLowerCase()),
    ),
    'the shell around the week never scrolls',
  ).toEqual([]);
  const chrome = await pinnedWeekChrome(page);
  expect(chrome.length, 'some week chrome is pinned').toBeGreaterThan(0);
  for (const { name, box: pinned } of chrome)
    expect(
      pinned.y + pinned.height,
      `${name} ends within the viewport`,
    ).toBeLessThanOrEqual(height + 1);
  const editor = host.locator('[data-week-editor]');
  await expect(editor).toHaveCount(1);
  // Positioned content, such as a warning's visually hidden prefix, is laid
  // out by the column: one positioned by an ancestor outside it never
  // scrolls with the column and hangs below the clipped frame, unreachable.
  // (An element that is not rendered has no offset parent.)
  expect(
    await editor.evaluate((column) =>
      Array.from(column.querySelectorAll<HTMLElement>('*'))
        .filter(
          (element) =>
            getComputedStyle(element).position === 'absolute' &&
            element.offsetParent !== null &&
            !column.contains(element.offsetParent),
        )
        .map((element) => element.outerHTML.slice(0, 80)),
    ),
    'positioned editor content scrolls with the editor column',
  ).toEqual([]);
  const controls = editor.locator(
    ':is(button, input, select, textarea, a[href], summary, [role="button"], [role="combobox"], [contenteditable="true"]):visible:not(:disabled):not([aria-disabled="true"])',
  );
  const targets = (await controls.count())
    ? controls
    : editor.locator('*:visible:not(:has(*))').filter({ hasText: /\S/ });
  expect(
    await targets.count(),
    'the editor has reachable controls or nonempty text content',
  ).toBeGreaterThan(0);
  const tall = await editor.evaluate(
    (element) => element.scrollHeight > element.clientHeight + 1,
  );
  await expectReachable(page, targets.last());
  if (tall) {
    // The last control in page order can sit near the top of a tall column,
    // so reach the lowest visible content to prove the column scrolls.
    // Only content a player can see and reach counts: skip faded or
    // click-through leaves such as an empty, hidden form message.
    const leaves = editor.locator('*:visible:not(:has(*))');
    const bottoms = await leaves.evaluateAll((elements) =>
      elements.map((element) => {
        const usable =
          element.checkVisibility({
            opacityProperty: true,
            visibilityProperty: true,
          }) &&
          getComputedStyle(element).pointerEvents !== 'none' &&
          (element.textContent?.trim() !== '' ||
            element.matches('button, input, select, textarea, a[href]'));
        return usable ? element.getBoundingClientRect().bottom : -Infinity;
      }),
    );
    await expectReachable(
      page,
      leaves.nth(bottoms.indexOf(Math.max(...bottoms))),
    );
    expect(
      await editor.evaluate((element) => element.scrollTop),
      'the editor column scrolled to reach its last target',
    ).toBeGreaterThan(0);
    expect(
      await page.evaluate(() => window.scrollY),
      'the document still did not scroll',
    ).toBe(0);
    expect(await pinnedWeekChrome(page), 'chrome unmoved after scroll').toEqual(
      chrome,
    );
  }
  await expectReachable(page, targets.first());
  expect(
    await editor.evaluate(
      (element) =>
        element.scrollTop >= 0 &&
        element.scrollTop <= element.scrollHeight - element.clientHeight + 1,
    ),
    'the editor stays within its scroll bounds',
  ).toBe(true);
  expect(await pinnedWeekChrome(page), 'chrome unmoved at the top').toEqual(
    chrome,
  );
}

/**
 * Every non-week page: Militia pages scroll within the rail host from
 * 768px, and other pages scroll as a document. Its last control stays
 * reachable, with the phone bottom bar pinned throughout.
 */
export async function expectSectionScrollHost(page: Page) {
  await expect(page.locator('[data-week-host]')).toHaveCount(0);
  const withRail =
    (await page.locator('nav[aria-label="Militia pages"]:visible').count()) > 0;
  const scroll = await page.getByRole('main').evaluate((main) => {
    const documentHost = document.scrollingElement ?? document.documentElement;
    let host: Element = documentHost;
    for (
      let parent = main.parentElement;
      parent;
      parent = parent.parentElement
    ) {
      if (['auto', 'scroll'].includes(getComputedStyle(parent).overflowY)) {
        host = parent;
        break;
      }
    }
    const end = host.scrollHeight - host.clientHeight;
    host.scrollTop = end;
    const bounds = host.getBoundingClientRect();
    return {
      inner: host !== documentHost,
      reachedEnd: Math.abs(host.scrollTop - end) <= 1,
      withinViewport:
        bounds.top >= 0 && bounds.bottom <= window.innerHeight + 1,
      documentBounded:
        document.documentElement.scrollHeight <= window.innerHeight + 1 &&
        window.scrollY === 0,
    };
  });
  expect(
    scroll.inner,
    'Militia pages use the inner rail host from tablet',
  ).toBe(withRail);
  expect(scroll.reachedEnd, 'the section host reaches its last content').toBe(
    true,
  );
  if (withRail) {
    expect(
      scroll.withinViewport,
      'the rail host fits the remaining viewport',
    ).toBe(true);
    expect(
      scroll.documentBounded,
      'the document stays still around the rail host',
    ).toBe(true);
  }
  if ((await bottomNavigation(page).count()) > 0)
    await expectBottomBarPinned(page);
  await expectReachable(page, page.locator('main button:visible').last());
}
