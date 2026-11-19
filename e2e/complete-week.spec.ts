import type { Page } from '@playwright/test';
import { openCampaignSection } from './support/interactions';
import { test, expect } from './support/fixtures';
import { loadRun } from './support/process';
import { observeDraftIds, observeDraftKey } from './support/draft-key';
import { controlTransport } from './support/transport';
import {
  confirmedWeekNotice,
  expectConfirmedWeek,
  pinnedConfirm,
  referencePanel,
  remoteChangeNote,
  reviewConfirm,
  saveState,
} from './support/week-frame';

const heading = (page: Page, name: string) =>
  page.getByRole('heading', { name, exact: true });
const step = (page: Page, name: string) =>
  page.getByRole('button', { name, exact: true }).click();
const chanceRoll = (page: Page) =>
  page.getByRole('textbox', { name: 'Event chance roll', exact: true });
const militiaValues = (page: Page) =>
  referencePanel(page).getByRole('table', { name: 'Militia values' });

// Counts loading skeletons (the week's by default) inserted from now on: a
// genuine handoff must never show one, and a final absence check alone would
// miss a transient flash.
async function watchSkeletons(page: Page, selector = '[data-week-skeleton]') {
  await page.evaluate((selector) => {
    const window_ = window as Window & { __skeletons?: number };
    window_.__skeletons = 0;
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes)
          if (
            node instanceof Element &&
            (node.matches(selector) || node.querySelector(selector))
          )
            window_.__skeletons! += 1;
    }).observe(document.body, { childList: true, subtree: true });
  }, selector);
  return () =>
    page.evaluate(
      () => (window as Window & { __skeletons?: number }).__skeletons,
    );
}

test.use({ caseKey: 'completeWeek' });
test('a player confirms a complete week, every device moves to the next week once it is usable, and the outcome survives reload', async ({
  players,
}) => {
  test.setTimeout(240_000);
  const run = await loadRun();
  const gm = players.gm;
  const player = players.player;
  const gmTransport = await controlTransport(gm, run.fixture!.convexUrl);
  const playerTransport = await controlTransport(
    player,
    run.fixture!.convexUrl,
  );
  const draftKey = observeDraftKey(gm);
  for (const page of [gm, player]) {
    await page.goto('/campaigns');
    // Continue week: the first week skips Upkeep; Event is first unready.
    await openCampaignSection(page, 'week');
    await expect(heading(page, 'Week 1 · Event')).toBeVisible();
    // Initial load announces nothing: no other-player note, no notice.
    await expect(remoteChangeNote(page)).toBeEmpty();
    await expect(confirmedWeekNotice(page)).toBeEmpty();
  }
  // A third continuously mounted observer enters the Week directly without
  // a phase query; it stays on Upkeep (address unchanged) until the
  // successor arrives, and must then get an explicit `phase=upkeep`.
  const campaignId = /\/campaigns\/([^/?#]+)/.exec(gm.url())![1]!;
  const watcher = await gm.context().newPage();
  await watcher.goto(`/campaigns/${campaignId}/week`);
  await expect(heading(watcher, 'Week 1 · Upkeep')).toBeVisible();
  expect(new URL(watcher.url()).searchParams.get('phase')).toBeNull();
  await expect(confirmedWeekNotice(watcher)).toBeEmpty();
  // The player's other device edits a character record, unsaved, while the
  // week is confirmed: the page never falls back to its skeleton and the
  // dialog keeps the typed name through the new week's draft (#198).
  const records = await player.context().newPage();
  const recordDrafts = observeDraftIds(records);
  await records.goto(`/campaigns/${campaignId}/officers`);
  await records
    .getByRole('region', { name: 'Characters', exact: true })
    .getByRole('button', { name: /^Edit / })
    .filter({ visible: true })
    .first()
    .click();
  const record = records.getByRole('dialog', {
    name: 'Edit character',
    exact: true,
  });
  const recordName = record.getByRole('textbox', { name: 'Name', exact: true });
  await recordName.fill('Unsaved new name');
  const recordSkeletons = await watchSkeletons(
    records,
    '[aria-label="Loading characters…"]',
  );
  expect(recordDrafts()).toHaveLength(1);
  await step(gm, 'Event');
  await chanceRoll(gm).fill('100');
  await chanceRoll(gm).blur();
  await expect(saveState(gm)).toHaveAttribute('data-week-feedback', 'saved');
  await step(player, 'Event');
  await expect(chanceRoll(player)).toHaveValue('100');
  await expect(remoteChangeNote(player)).toHaveText(
    'Another player changed Event.',
  );
  await expect(remoteChangeNote(gm)).toBeEmpty();
  // The observer keeps an independent, non-Upkeep phase throughout.
  await step(player, 'Activity');
  await expect(heading(player, 'Week 1 · Activity')).toBeVisible();
  const oldValues = (await militiaValues(player).textContent())!;
  await step(gm, 'Review & confirm');
  await expect(reviewConfirm(gm)).toBeEnabled();
  // Hold each device's hydration of the successor draft independently while
  // the Confirmation, its receipt and the server's source updates flow: the
  // reviewed week must stay on screen read-only on both devices, with no
  // skeleton and no notice, until that device's successor is usable (#153).
  const key = await draftKey();
  const gmHold = gmTransport.holdSuccessorHydration(key);
  const playerHold = playerTransport.holdSuccessorHydration(key);
  const gmSkeletons = await watchSkeletons(gm);
  const playerSkeletons = await watchSkeletons(player);
  try {
    // This Confirmation goes through the footer's pinned Confirm week; the
    // review block's shows the same pending control.
    await expect(pinnedConfirm(gm)).toBeEnabled();
    await pinnedConfirm(gm).click();
    await expect(saveState(gm)).toHaveAttribute(
      'data-week-feedback',
      'confirming',
    );
    const confirming = [
      reviewConfirm(gm, 'Confirming…'),
      pinnedConfirm(gm, 'Confirming…'),
    ];
    for (const control of confirming) {
      await expect(control).toBeDisabled();
      await expect(control).toHaveAttribute('aria-busy', 'true');
    }
    await expect.poll(gmHold.observed, { timeout: 20_000 }).toBe(true);
    await expect.poll(playerHold.observed, { timeout: 20_000 }).toBe(true);
    expect(gmHold.failure()).toBeNull();
    expect(playerHold.failure()).toBeNull();
    // Caller: the old week stays, navigable and read-only, still Confirming.
    await expect(heading(gm, 'Week 1 · Review & confirm')).toBeVisible();
    for (const control of confirming) await expect(control).toBeDisabled();
    await expect(confirmedWeekNotice(gm)).toBeEmpty();
    await step(gm, 'Event');
    await expect(heading(gm, 'Week 1 · Event')).toBeVisible();
    await expect(chanceRoll(gm)).toBeDisabled();
    await expect(chanceRoll(gm)).toHaveValue('100');
    await expect(militiaValues(gm)).toBeVisible();
    await expect(saveState(gm)).toHaveAttribute(
      'data-week-feedback',
      'confirming',
    );
    // Observer: same old facts, its own phase, every weekly write disabled,
    // Summary explains the wait; no notice, no skeleton.
    await expect(heading(player, 'Week 1 · Activity')).toBeVisible();
    await expect(confirmedWeekNotice(player)).toBeEmpty();
    await step(player, 'Event');
    await expect(heading(player, 'Week 1 · Event')).toBeVisible();
    await expect(chanceRoll(player)).toBeDisabled();
    await expect(chanceRoll(player)).toHaveValue('100');
    expect(await militiaValues(player).textContent()).toBe(oldValues);
    await step(player, 'Review & confirm');
    await expect(heading(player, 'Week 1 · Review & confirm')).toBeVisible();
    await expect(reviewConfirm(player)).toBeDisabled();
    await expect(
      player.locator('[data-week-footer]:visible [data-week-readiness]'),
    ).toHaveText('Opening the next week…');
    await expect(pinnedConfirm(player)).toBeDisabled();
    await expect(pinnedConfirm(player)).toHaveAccessibleDescription(
      /Opening the next week…$/,
    );
    await expect(saveState(player)).not.toHaveAttribute(
      'data-week-feedback',
      'confirming',
    );
    for (const page of [gm, player])
      await expect(page.locator('[data-week-skeleton]')).toHaveCount(0);
    // The unheld watcher simply observes the successor: Week 2 on Upkeep,
    // its address now explicit, one notice with the exact link.
    await expectConfirmedWeek(watcher, 1);
    expect(new URL(watcher.url()).searchParams.get('phase')).toBe('upkeep');
    await expect(heading(gm, 'Week 1 · Event')).toBeVisible();
    await expect(heading(player, 'Week 1 · Review & confirm')).toBeVisible();
    // Release the observer first: it moves alone. The caller is still held.
    playerHold.release();
    await expectConfirmedWeek(player, 1);
    await expect(heading(gm, 'Week 1 · Event')).toBeVisible();
    await expect(confirmedWeekNotice(gm)).toBeEmpty();
    await expect(saveState(gm)).toHaveAttribute(
      'data-week-feedback',
      'confirming',
    );
    await expect(chanceRoll(gm)).toBeDisabled();
    gmHold.release();
    await expectConfirmedWeek(gm, 1);
    expect(gmHold.failure()).toBeNull();
    expect(playerHold.failure()).toBeNull();
  } finally {
    gmHold.release();
    playerHold.release();
  }
  // The watcher's address stays as written: exactly one phase value.
  expect([...new URL(watcher.url()).searchParams.getAll('phase')]).toEqual([
    'upkeep',
  ]);
  await expect(confirmedWeekNotice(watcher)).toHaveCount(1);
  await watcher.close();
  // The records page observed the new week's draft, with no skeleton.
  await expect.poll(() => recordDrafts().length).toBe(2);
  await expect(record).toBeVisible();
  await expect(recordName).toHaveValue('Unsaved new name');
  expect(
    await recordSkeletons(),
    'no characters skeleton across the week change',
  ).toBe(0);
  await records.close();
  expect(await gmSkeletons(), 'no skeleton on the caller').toBe(0);
  expect(await playerSkeletons(), 'no skeleton on the observer').toBe(0);
  await expect(saveState(gm)).not.toHaveAttribute(
    'data-week-feedback',
    'confirming',
  );
  await expect(
    gm.getByRole('button', { name: 'Confirming…', exact: true }),
  ).toHaveCount(0);
  await expect(remoteChangeNote(gm)).toBeEmpty();
  await expect(remoteChangeNote(player)).toBeEmpty();
  // Ordinary work on the new week neither repeats nor removes a notice.
  const transition = (page: Page) =>
    confirmedWeekNotice(page)
      .locator('[data-week-confirmed-transition]')
      .getAttribute('data-week-confirmed-transition');
  const gmTransition = await transition(gm);
  const playerTransition = await transition(player);
  await step(gm, 'Event');
  await expect(chanceRoll(gm)).toBeEnabled();
  await expect(chanceRoll(gm)).toHaveValue('');
  await chanceRoll(gm).fill('100');
  await chanceRoll(gm).blur();
  await expect(saveState(gm)).toHaveAttribute('data-week-feedback', 'saved');
  await expect(remoteChangeNote(player)).toHaveText(
    'Another player changed Event.',
  );
  for (const [page, id] of [
    [gm, gmTransition],
    [player, playerTransition],
  ] as const) {
    await expect(confirmedWeekNotice(page)).toHaveCount(1);
    await expect(
      confirmedWeekNotice(page).locator('[data-week-confirmed-transition]'),
    ).toHaveAttribute('data-week-confirmed-transition', id!);
  }
  // The observer dismisses its notice; the caller's stays.
  await confirmedWeekNotice(player)
    .getByRole('button', { name: 'Dismiss', exact: true })
    .click();
  await expect(confirmedWeekNotice(player)).toBeEmpty();
  await expect(confirmedWeekNotice(gm)).toHaveCount(1);
  // The link opens the confirmed week in Finished weeks. Back returns to the
  // address that was left (Upkeep, chosen here), as a fresh load without a
  // fabricated notice.
  await step(gm, 'Upkeep');
  await expect(gm).toHaveURL(/phase=upkeep/);
  await confirmedWeekNotice(gm)
    .getByRole('link', { name: 'Open in Finished weeks', exact: true })
    .click();
  await expect(gm).toHaveURL(/\/history\?week=1$/);
  await expect(gm.getByRole('heading', { name: /Week 1/ })).toBeVisible();
  await gm.goBack();
  await expect(heading(gm, 'Week 2 · Upkeep')).toBeVisible();
  await expect(gm.locator('[data-week-skeleton]')).toHaveCount(0);
  await expect(confirmedWeekNotice(gm)).toBeEmpty();
  await gm.reload();
  await expect(heading(gm, 'Week 2 · Upkeep')).toBeVisible();
  await expect(confirmedWeekNotice(gm)).toBeEmpty();
  await openCampaignSection(gm, 'history');
  await expect(gm.getByRole('heading', { name: /Week 1/ })).toBeVisible();
});
