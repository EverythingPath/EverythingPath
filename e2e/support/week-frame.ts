import { expect, type Locator, type Page } from '@playwright/test';
import { settleAnimations } from './responsive-shell';

// The Week frame (#151): five positions in rules order, readiness as each
// step's accessible description, a locked Persistent that stays visible,
// previous/next that skip it and never wrap, and the phone step sheet.
// Readiness counts are rules-driven, so these checks assert structure and
// the relationship between positions, not specific numbers.

const positions = [
  'Upkeep',
  'Activity',
  'Event',
  'Persistent',
  'Review & confirm',
] as const;

function stepper(page: Page) {
  return page
    .getByRole('navigation', { name: 'Week phases', exact: true })
    .locator('visible=true');
}

async function currentStep(page: Page) {
  return stepper(page).locator('button[aria-current="step"]');
}

// The readiness line lives in the visible frame chrome: the pinned footer
// from 768px (the full sentence), the strip above the bottom tabs below it
// (the short "N to decide" / "N warning(s)" form inside the reference
// trigger). An empty line (the correct Review & confirm state when
// confirmable) has no height, so the visible container is asserted and the
// line itself is read without a visibility requirement.
async function readinessLine(page: Page) {
  const chrome = page.locator(
    '[data-week-footer]:visible, [data-week-strip]:visible',
  );
  await expect(chrome).toHaveCount(1);
  const line = chrome.locator('[data-week-readiness]');
  await expect(line).toHaveCount(1);
  return line;
}

type ConfirmName = 'Confirm week' | 'Confirming…';

/** The review block's Confirm week at the top of Review & confirm. */
export function reviewConfirm(page: Page, name: ConfirmName = 'Confirm week') {
  return page
    .getByRole('region', { name: 'Review the week', exact: true })
    .getByRole('button', { name, exact: true });
}

/**
 * The frame's pinned Confirm week on Review & confirm: at the footer's next
 * position from 768px, at the phone strip's next end below it. The two
 * "Week actions" regions are never shown together.
 */
export function pinnedConfirm(page: Page, name: ConfirmName = 'Confirm week') {
  return page
    .getByRole('region', { name: 'Week actions', exact: true })
    .getByRole('button', { name, exact: true });
}

/**
 * Scrolled down to Table Adjustments, the pinned Confirm stays whole in
 * the viewport, shows the same control as the review block's, and counts
 * the review block's own Warnings list (visible beside its label and in
 * its description; the count never disables it). Returns that count.
 */
export async function expectPinnedConfirm(page: Page) {
  const adjustments = page.getByRole('region', {
    name: 'Table Adjustments',
    exact: true,
  });
  await adjustments.evaluate((element) =>
    element.scrollIntoView({ block: 'end' }),
  );
  await expect(adjustments).toBeInViewport();
  const pinned = pinnedConfirm(page);
  await expect(pinned).toBeVisible();
  await expect(pinned).toBeInViewport({ ratio: 1 });
  const box = (await pinned.boundingBox())!;
  expect(box.height, 'pinned Confirm tap target').toBeGreaterThanOrEqual(44);
  expect(box.width, 'pinned Confirm tap target').toBeGreaterThanOrEqual(44);
  const enabled = await reviewConfirm(page).isEnabled();
  if (enabled) await expect(pinned).toBeEnabled();
  else await expect(pinned).toBeDisabled();
  const review = page.getByRole('region', {
    name: 'Review the week',
    exact: true,
  });
  const warnings = await review
    .getByRole('region', { name: 'Warnings', exact: true })
    .getByRole('listitem')
    .count();
  const counted = `${warnings} warning${warnings === 1 ? '' : 's'}`;
  const wide = page.viewportSize()!.width >= 768;
  if (warnings) {
    await expect(pinned).toHaveAccessibleDescription(
      new RegExp(`^${counted}\\b`),
    );
    await expect(pinned).toHaveText(
      wide ? `Confirm week · ${counted}` : `Confirm · ${warnings}`,
    );
  } else {
    await expect(pinned).not.toHaveAccessibleDescription(/warning/);
    await expect(pinned).toHaveText(wide ? 'Confirm week' : 'Confirm');
  }
  return warnings;
}

/**
 * Tablet and desktop (from 768px): stepper positions, descriptions, the
 * locked Persistent, and footer previous/next skipping and endpoints. Ends
 * on the phase it started on.
 */
export async function exerciseWeekFrame(page: Page) {
  expect(page.viewportSize()!.width).toBeGreaterThanOrEqual(768);
  const nav = stepper(page);
  await expect(nav).toHaveCount(1);
  const buttons = nav.getByRole('button');
  await expect(buttons).toHaveCount(5);
  for (const [index, name] of positions.entries())
    await expect(buttons.nth(index)).toHaveAccessibleName(name);
  const current = await currentStep(page);
  await expect(current).toHaveCount(1);
  const origin = (await current.getAttribute('aria-label'))!;
  // Readiness is a description, never part of the name; Review & confirm
  // has none at all.
  for (const name of positions.slice(0, 4))
    await expect(
      nav.getByRole('button', { name, exact: true }),
    ).toHaveAccessibleDescription(/^(Ready|\d+ to decide|No carried events)/);
  await expect(
    nav.getByRole('button', { name: 'Review & confirm', exact: true }),
  ).not.toHaveAttribute('aria-describedby', /.+/);
  const persistent = nav.getByRole('button', {
    name: 'Persistent',
    exact: true,
  });
  const locked = await persistent.isDisabled();
  if (locked)
    await expect(persistent).toHaveAccessibleDescription('No carried events');
  const next = (name: string) =>
    page.getByRole('button', { name: `Next: ${name}`, exact: true });
  const previous = (name: string) =>
    page.getByRole('button', { name: `Previous: ${name}`, exact: true });

  await nav.getByRole('button', { name: 'Event', exact: true }).click();
  await expect(
    nav.getByRole('button', { name: 'Event', exact: true }),
  ).toHaveAttribute('aria-current', 'step');
  await expect(previous('Activity')).toBeEnabled();
  await expect(
    locked ? next('Review & confirm') : next('Persistent'),
  ).toBeEnabled();
  await (locked ? next('Review & confirm') : next('Persistent')).click();
  if (!locked) {
    await expect(
      nav.getByRole('button', { name: 'Persistent', exact: true }),
    ).toHaveAttribute('aria-current', 'step');
    await next('Review & confirm').click();
  }
  await expect(
    nav.getByRole('button', { name: 'Review & confirm', exact: true }),
  ).toHaveAttribute('aria-current', 'step');
  await expect(page).toHaveURL(/phase=summary/);
  // The last position: no wrap forward and no Next control; the footer's
  // next position holds the pinned Confirm week, the same control as the
  // review block's, beside a disabled-Confirmation reason (or nothing);
  // never a ready/needs-attention line.
  await expect(page.getByRole('button', { name: /^Next\b/ })).toHaveCount(0);
  const line = await readinessLine(page);
  const reason = (await line.textContent())!.trim();
  const confirmable = await reviewConfirm(page).isEnabled();
  const pinned = pinnedConfirm(page);
  await expect(pinned).toBeVisible();
  await expect(
    page.locator('[data-week-footer]:visible [data-week-endpoint="next"]'),
  ).toHaveCount(0);
  // Confirmable: nothing at all. Otherwise exactly one disabled reason,
  // which also describes the pinned Confirm; never the removed
  // ready/needs-attention sentence.
  if (confirmable) {
    expect(reason, 'no caption when confirmable').toBe('');
    await expect(pinned).toBeEnabled();
  } else {
    expect(reason, 'only the disabled-Confirmation reason').toMatch(
      /^(\d+ decisions? left|Review .*|Confirming the week…|Opening the next week…)$/,
    );
    await expect(pinned).toBeDisabled();
    await expect(pinned).toHaveAccessibleDescription(
      new RegExp(`${reason.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
    );
  }
  expect(reason).not.toMatch(/ready for confirmation|attention/i);
  await previous(locked ? 'Event' : 'Persistent').click();
  await nav.getByRole('button', { name: 'Upkeep', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Previous\b/ })).toHaveCount(
    0,
  );
  await expect(next('Activity')).toBeEnabled();
  await expect(await readinessLine(page)).toHaveText(
    /^(Upkeep is ready\.|Complete the required rolls and decisions to finish Upkeep\.)/,
  );
  await nav.getByRole('button', { name: origin, exact: true }).click();
  await expect(await currentStep(page)).toHaveAttribute('aria-label', origin);
}

/**
 * Phone (below 768px): the Step N of 5 button opens a sheet listing every
 * position with the same semantics; Escape and choosing close it and focus
 * returns to the button. Ends on the phase it started on.
 */
export async function exercisePhoneSteps(page: Page) {
  expect(page.viewportSize()!.width).toBeLessThan(768);
  await expect(stepper(page)).toHaveCount(0);
  const trigger = page.getByRole('button', { name: /^Step \d of 5 · / });
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  await trigger.focus();
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: /^Week \d+$/ });
  await expect(sheet).toBeVisible();
  const buttons = sheet.getByRole('button', {
    name: /^(Upkeep|Activity|Event|Persistent|Review & confirm)$/,
  });
  await expect(buttons).toHaveCount(5);
  for (const [index, name] of positions.entries())
    await expect(buttons.nth(index)).toHaveAccessibleName(name);
  const current = sheet.locator('button[aria-current="step"]');
  await expect(current).toHaveCount(1);
  // Capture the current phase from the sheet's semantic state while open.
  const origin = (await current.getAttribute('aria-label'))!;
  expect(positions).toContain(origin);
  await expect(
    sheet.getByRole('button', { name: 'Review & confirm', exact: true }),
  ).not.toHaveAttribute('aria-describedby', /.+/);
  expect(
    await sheet.evaluate((dialog) => dialog.contains(document.activeElement)),
    'focus moves into the step sheet',
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
  // The modal hides background controls from accessibility while open.
  // Once closed, the trigger's name (decorative glyph excluded) must agree
  // with the sheet's current phase and its numeric position.
  await expect(trigger).toHaveAccessibleName(
    new RegExp(
      `^Step ${positions.indexOf(origin as never) + 1} of 5 · ${origin}`,
    ),
  );
  // Choose a different available step, then return.
  await trigger.click();
  await expect(sheet).toBeVisible();
  const target = origin === 'Activity' ? 'Event' : 'Activity';
  await sheet.getByRole('button', { name: target, exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`phase=${target.toLowerCase()}`));
  await expect(trigger).toHaveAccessibleName(
    new RegExp(`^Step \\d of 5 · ${target}`),
  );
  await readinessLine(page);
  await expect(
    page.getByRole('button', { name: /^Previous: /, exact: false }),
  ).toBeVisible();
  await trigger.click();
  await sheet.getByRole('button', { name: origin, exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(trigger).toHaveAccessibleName(
    new RegExp(`^Step \\d of 5 · ${origin}`),
  );
}

// The reference surfaces (#152): from 768px a closable docked panel with
// This phase above Militia / Officers / History tabs and same-campaign
// links; below 768px the strip's middle opens a bottom sheet with the same
// body. Values are rules-driven, so these checks assert structure: Now and
// After columns, an honest After, link targets and local visibility.

/**
 * The store's save state (idle, pending, saved, failed, confirming), read
 * from the board's invisible `data-week-feedback` hook. The top-bar save
 * status was removed at the user's request (2026-09-28, amending #137), so
 * no sentence shows it; tests wait on this instead of on visible text.
 */
export function saveState(page: Page) {
  return page.locator('[data-week-feedback]');
}

/** The failed-save alert in the frame's status row: always mounted, empty unless a save failed. */
export function saveFailure(page: Page) {
  return page.locator('[data-week-save-failure]');
}

/** "Another player changed …" in the frame's status row (#153). */
export function remoteChangeNote(page: Page) {
  return page.locator('[data-week-remote-note]');
}

/**
 * The transient "Week N confirmed." notice with its Finished weeks link,
 * shown once on every device after the successor week arrives (#153).
 */
export function confirmedWeekNotice(page: Page) {
  return page.locator('[data-week-confirmed]');
}

/**
 * Asserts the confirmed-week notice for `week` exactly once on this page:
 * the text, the exact history link within this campaign, and the page on
 * the successor's Upkeep.
 */
export async function expectConfirmedWeek(page: Page, week: number) {
  const campaignId = campaignIdFromUrl(page);
  const notice = confirmedWeekNotice(page);
  await expect(notice).toHaveCount(1);
  await expect(notice).toContainText(`Week ${week} confirmed.`);
  await expect(
    notice.getByRole('link', { name: 'Open in Finished weeks', exact: true }),
  ).toHaveAttribute('href', `/campaigns/${campaignId}/history?week=${week}`);
  await expect(page).toHaveURL(/phase=upkeep/);
  await expect(
    page.getByRole('heading', {
      name: `Week ${week + 1} · Upkeep`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('[data-week-skeleton]')).toHaveCount(0);
}

export function referencePanel(page: Page) {
  return page.getByRole('complementary', { name: 'Reference panel' });
}

function campaignIdFromUrl(page: Page) {
  const match = /\/campaigns\/([^/?#]+)/.exec(page.url());
  expect(match, 'on a campaign page').not.toBeNull();
  return match![1]!;
}

// The History tab in health: the reader settles to at most three distinct
// recent effective weeks, or the empty state, never a failure card.
async function expectHealthyHistory(root: Locator, campaignId: string) {
  await expect(root.getByRole('status')).toBeHidden();
  await expect(root.getByRole('alert')).toHaveCount(0);
  const list = root.getByRole('list', { name: 'Recent weeks' });
  const empty = root.getByText('No finished weeks yet.', { exact: true });
  await expect(list.or(empty)).toHaveCount(1);
  if ((await list.count()) === 1) {
    const links = list.getByRole('link');
    const count = await links.count();
    expect(count, 'between one and three recent weeks').toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(3);
    const hrefs: string[] = [];
    for (const link of await links.all()) {
      const href = (await link.getAttribute('href'))!;
      expect(href).toMatch(
        new RegExp(`^/campaigns/${campaignId}/history\\?week=\\d+$`),
      );
      await expect(link).toHaveText(/^Week \d+$/);
      hrefs.push(href);
    }
    expect(new Set(hrefs).size, 'distinct weeks').toBe(hrefs.length);
  }
  await expect(
    root.getByRole('link', { name: 'All finished weeks', exact: true }),
  ).toHaveAttribute('href', `/campaigns/${campaignId}/history`);
}

async function expectReferenceBody(page: Page, root: Locator) {
  const campaignId = campaignIdFromUrl(page);
  await expect(root.getByRole('region', { name: 'This phase' })).toHaveCount(1);
  await expect(root.getByRole('tab', { name: 'Militia' })).toBeVisible();
  const values = root.getByRole('table', { name: 'Militia values' });
  await expect(values).toBeVisible();
  await expect(values.getByRole('columnheader', { name: 'Now' })).toBeVisible();
  await expect(
    values.getByRole('columnheader', { name: 'After the week' }),
  ).toBeVisible();
  for (const name of ['Rank', 'Training', 'Treasury', 'Notoriety', 'Focus'])
    await expect(
      values.getByRole('rowheader', { name, exact: true }),
    ).toBeVisible();
  // After the week is either a value or the explicit awaiting state; a
  // zero-looking fallback is never shown for an incomplete forecast.
  const training = values.getByRole('row', { name: /^Training/ });
  await expect(training.getByRole('cell').nth(0)).toHaveText(/^\d+$/);
  await expect(training.getByRole('cell').nth(1)).toHaveText(
    /^(\d+|Awaiting decisions)$/,
  );
  await expect(root.getByRole('region', { name: 'This week' })).toContainText(
    /used/,
  );
  await expect(
    root.getByRole('link', { name: 'Open militia', exact: true }),
  ).toHaveAttribute('href', `/campaigns/${campaignId}/militia`);
  await root.getByRole('tab', { name: 'Officers' }).click();
  await expect(
    root.getByRole('link', { name: 'Characters & officers', exact: true }),
  ).toHaveAttribute('href', `/campaigns/${campaignId}/officers`);
  await root.getByRole('tab', { name: 'History' }).click();
  await expectHealthyHistory(root, campaignId);
  await root.getByRole('tab', { name: 'Militia' }).click();
  // Long team, officer and event names wrap inside the fixed-width surface
  // rather than widening it or scrolling sideways.
  expect(
    await root.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
    'the reference surface does not overflow sideways',
  ).toBe(true);
}

// Scroll offsets and the footer's box, for the pinned-chrome checks.
function pinnedGeometry(page: Page) {
  return page.evaluate(() => {
    const scrollTop = (selector: string) =>
      document.querySelector(selector)!.scrollTop;
    const footer = document
      .querySelector('[data-week-footer]')!
      .getBoundingClientRect();
    return {
      document: window.scrollY,
      host: scrollTop('[data-week-host]'),
      editor: scrollTop('[data-week-editor]'),
      footer: { y: footer.y, height: footer.height },
    };
  });
}

// The panel scrolls its own long contents while the document, the editor
// column and the pinned chrome stay exactly where they were.
async function expectPanelScrolls(page: Page, panel: Locator) {
  const editor = page.locator('[data-week-editor]');
  // Opening the panel and switching steps start transitions (buttons use
  // transition-all); the pinned chrome's baseline is its settled position.
  await settleAnimations(page);
  const before = await pinnedGeometry(page);
  const last = panel
    .locator('*:visible:not(:has(*))')
    .filter({ hasText: /\S/ });
  await expect(last.last()).toBeAttached();
  await last.last().scrollIntoViewIfNeeded();
  await expect(last.last()).toBeVisible();
  const tall = await panel.evaluate(
    (element) => element.scrollHeight > element.clientHeight + 1,
  );
  if (tall)
    expect(
      await panel.evaluate((element) => element.scrollTop),
      'the panel scrolled to reach its last content',
    ).toBeGreaterThan(0);
  await settleAnimations(page);
  const after = await pinnedGeometry(page);
  expect(after.document, 'the document did not scroll').toBe(before.document);
  expect(after.editor, 'the editor did not scroll').toBe(before.editor);
  expect(after.host, 'the week host did not scroll').toBe(before.host);
  expect(
    after.footer.y,
    `the footer stayed pinned (height ${before.footer.height} → ${after.footer.height})`,
  ).toBe(before.footer.y);
  await expect(editor).toBeVisible();
  await panel.evaluate((element) => element.scrollTo(0, 0));
}

/**
 * From 768px: the docked panel's body and links, its own scrolling, the
 * toggle, and the remembered (browser-local) visibility across a reload.
 */
export async function exerciseReferencePanel(page: Page) {
  expect(page.viewportSize()!.width).toBeGreaterThanOrEqual(768);
  const { height } = page.viewportSize()!;
  const panel = referencePanel(page);
  const show = page.getByRole('button', { name: 'Show reference panel' });
  const hide = page.getByRole('button', { name: 'Hide reference panel' });
  if (await show.isVisible()) await show.click();
  await expect(panel).toHaveCount(1);
  await expect(panel).toBeVisible();
  const box = (await panel.boundingBox())!;
  expect(
    box.y + box.height,
    'panel ends within the viewport',
  ).toBeLessThanOrEqual(height + 1);
  await expectReferenceBody(page, panel);
  await expectPanelScrolls(page, panel);
  await expect(hide).toHaveAttribute('aria-expanded', 'true');
  await hide.focus();
  await page.keyboard.press('Enter');
  await expect(panel).toBeHidden();
  await expect(show).toHaveAttribute('aria-expanded', 'false');
  await expect(show).toBeFocused();
  // The editor takes the panel's space; readiness stays in the stepper.
  await expect(
    stepper(page).locator('button[aria-current="step"]'),
  ).toHaveCount(1);
  await page.reload();
  await expect(show).toBeVisible();
  await expect(panel).toBeHidden();
  await show.click();
  await expect(panel).toBeVisible();
  await page.reload();
  await expect(panel).toBeVisible();
}

/**
 * A history read that fails stays inside the History tab (failure card and
 * Try again) while the editor keeps saving; a retry after the fault clears
 * restores the healthy list. `network` is the page's websocket control.
 */
export async function exerciseReferenceHistoryFailure(
  page: Page,
  network: { failHistory: (failing: boolean) => void },
  editInput: Locator,
  values: [string, string],
) {
  expect(page.viewportSize()!.width).toBeGreaterThanOrEqual(768);
  const campaignId = campaignIdFromUrl(page);
  const panel = referencePanel(page);
  await expect(panel).toBeVisible();
  // Leave History so the next visit subscribes afresh under the fault.
  await panel.getByRole('tab', { name: 'Militia' }).click();
  network.failHistory(true);
  await panel.getByRole('tab', { name: 'History' }).click();
  const failure = panel.getByRole('alert');
  await expect(failure).toHaveCount(1);
  await expect(failure).toHaveText(/Recent weeks could not be loaded\./);
  await expect(
    panel.getByRole('link', { name: 'All finished weeks', exact: true }),
  ).toHaveAttribute('href', `/campaigns/${campaignId}/history`);
  // Editing is unaffected: the input accepts a value and the store
  // reports the save.
  await editInput.fill(values[0]);
  await expect(editInput).toHaveValue(values[0]);
  await expect(saveState(page)).toHaveAttribute('data-week-feedback', 'saved');
  await expect(failure).toHaveCount(1);
  network.failHistory(false);
  await failure.getByRole('button', { name: 'Try again', exact: true }).click();
  await expectHealthyHistory(panel, campaignId);
  await editInput.fill(values[1]);
  await expect(saveState(page)).toHaveAttribute('data-week-feedback', 'saved');
  await panel.getByRole('tab', { name: 'Militia' }).click();
}

/**
 * Below 768px: the strip's middle button carries Training and Treasury and
 * opens the reference sheet; Escape and Close each close it and return
 * focus.
 */
export async function exercisePhoneReference(page: Page) {
  expect(page.viewportSize()!.width).toBeLessThan(768);
  await expect(referencePanel(page)).toBeHidden();
  const trigger = page.locator('[data-week-strip-trigger]');
  await expect(trigger).toHaveCount(1);
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAccessibleName(/^Reference:.*Training.*Treasury/);
  await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  await expectStripValuesWhole(page);
  await trigger.focus();
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'Reference', exact: true });
  await expect(sheet).toBeVisible();
  expect(
    await sheet.evaluate((dialog) => dialog.contains(document.activeElement)),
    'focus moves into the reference sheet',
  ).toBe(true);
  await expectReferenceBody(page, sheet);
  // Tab never leaves the sheet while it is open.
  for (let step = 0; step < 8; step += 1) {
    await page.keyboard.press('Tab');
    expect(
      await sheet.evaluate((dialog) => dialog.contains(document.activeElement)),
      'focus stays inside the reference sheet',
    ).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
}

/** A failed save is one visible alert with the exact text, and nothing else says so. */
export async function expectSaveFailed(page: Page) {
  const failure = saveFailure(page);
  await expect(failure).toHaveCount(1);
  await expect(failure).toHaveText(
    /^Changes could not be saved\. The latest saved values are shown\./,
  );
  await expect(failure).toHaveAttribute('role', 'alert');
  await expect(saveState(page)).toHaveAttribute('data-week-feedback', 'failed');
}

/**
 * The failure (and any other-player note) is visible text at every size in
 * the frame's own row, inside the viewport and outside the top bar. No top-
 * bar save status, phone glyph or Status details button remains, and the
 * normal save sentences are never shown.
 */
export async function expectVisibleFailure(page: Page) {
  const { width } = page.viewportSize()!;
  const failure = saveFailure(page);
  await expect(failure).toBeVisible();
  const box = (await failure.boundingBox())!;
  expect(box.width, 'failure has visible width').toBeGreaterThan(24);
  expect(box.height, 'failure has visible height').toBeGreaterThan(8);
  expect(box.x, 'failure starts inside the viewport').toBeGreaterThanOrEqual(
    -1,
  );
  expect(box.x + box.width, 'failure fits the viewport').toBeLessThanOrEqual(
    width + 1,
  );
  await expect(page.locator('header [data-week-save-failure]')).toHaveCount(0);
  const note = remoteChangeNote(page);
  if ((await note.textContent())!.trim()) await expect(note).toBeVisible();
  await expectNoSaveStatus(page);
}

/** The removed top-bar save status stays gone at this size. */
export async function expectNoSaveStatus(page: Page) {
  await expect(page.locator('[data-shell-slot="top-bar-status"]')).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: /Show status details$/ }),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      /^(Prepare the week together\.|Saving changes…|Changes saved\.)$/,
    ),
  ).toHaveCount(0);
}

/**
 * The phone strip exists to show Training and Treasury now → after, so
 * neither value line may be cut off: each fits its own line in full,
 * including beside the compact Confirm on Review & confirm.
 */
export async function expectStripValuesWhole(page: Page) {
  // "→ …" is the honest after value while decisions are open, so the check
  // is geometric: no line is narrower than its own text.
  const lines = await page
    .locator('[data-week-strip-trigger]')
    .evaluate((trigger) =>
      Array.from(trigger.children)
        .filter((line) => /^(Training|Treasury) /.test(line.textContent ?? ''))
        .map((line) => ({
          label: line.textContent.split(' ')[0],
          clipped: line.scrollWidth > line.clientWidth + 1,
          height: line.getBoundingClientRect().height,
        })),
    );
  expect(lines.map((line) => line.label)).toEqual(['Training', 'Treasury']);
  for (const line of lines) {
    expect(line.clipped, `${line.label} is shown in full`).toBe(false);
    expect(line.height, `${line.label} is visible`).toBeGreaterThan(4);
  }
}

/**
 * From 768px the reference panel toggle has no row of its own: on tablet it
 * ends the stepper row, on desktop it shares the rail's "Week N" line above
 * the steps. The frame's status row above the stepper takes no space while
 * it has nothing to show (no failure, other-player note, notice or notes).
 */
export async function expectPanelToggleBesideStepper(page: Page) {
  const { width } = page.viewportSize()!;
  expect(width).toBeGreaterThanOrEqual(768);
  const toggle = page.getByRole('button', {
    name: /^(Show|Hide) reference panel$/,
  });
  await expect(toggle).toHaveCount(1);
  await expect(toggle).toBeVisible();
  const toggleBox = (await toggle.boundingBox())!;
  const steps = stepper(page).getByRole('button');
  const first = (await steps.first().boundingBox())!;
  const last = (await steps.last().boundingBox())!;
  if (width < 1280) {
    // One band: the toggle overlaps the step buttons vertically, after them.
    expect(toggleBox.y, 'toggle within the stepper row').toBeLessThan(
      first.y + first.height,
    );
    expect(toggleBox.y + toggleBox.height).toBeGreaterThan(first.y);
    expect(toggleBox.x, 'toggle ends the stepper row').toBeGreaterThanOrEqual(
      last.x + last.width - 1,
    );
  } else {
    // Above the rail's first step, within the rail's width.
    expect(toggleBox.y + toggleBox.height).toBeLessThanOrEqual(first.y + 1);
    expect(toggleBox.x + toggleBox.width).toBeLessThanOrEqual(
      first.x + first.width + 1,
    );
  }
  const row = page.locator(':has(> [data-week-status-row-group])');
  await expect(row).toHaveCount(1);
  const empty = await row.evaluate(
    (element) =>
      !Array.from(element.querySelectorAll('*')).some(
        (child) =>
          !child.hasAttribute('data-week-status-row-group') &&
          child.childNodes.length > 0,
      ),
  );
  if (empty) await expect(row).toBeHidden();
  else await expect(row).toBeVisible();
}
