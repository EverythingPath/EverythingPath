import { openCampaignSection } from './support/interactions';
import {
  expectBoundedWeekHost,
  expectNoHorizontalOverflow,
  expectReachable,
  expectTopBarOneRow,
} from './support/responsive-shell';
import {
  confirmedWeekNotice,
  exercisePhoneReference,
  exercisePhoneSteps,
  exerciseReferenceHistoryFailure,
  exerciseReferencePanel,
  exerciseWeekFrame,
  expectConfirmedWeek,
  expectSaveFailed,
  expectPanelToggleBesideStepper,
  expectVisibleFailure,
  referencePanel,
  remoteChangeNote,
  reviewConfirm,
  saveFailure,
  saveState,
} from './support/week-frame';
import {
  prepareWeekHistory,
  stayOnPendingWeek,
  leavePendingWeek,
} from './support/pending-navigation';
import { exerciseMilitiaSetup } from './support/setup-workspace';
import {
  reviewSummaryWorkspace,
  reviewSummarySettlement,
} from './support/summary-qa';
import { resultCell } from './support/summary-result';
import {
  expectPersistentRestoreDelivered,
  reviewPersistentWorkspace,
} from './support/persistent-qa';
import { exerciseEventWorkspace } from './support/event-workspace';
import {
  prepareInvasion,
  reviewEventLayout,
  reviewSummaryLayout,
} from './support/event-review-layout';
import { exercisePersistentWorkspace } from './support/persistent-workspace';
import {
  exerciseActivityWorkspace,
  exerciseDrillRolls,
  exerciseGuaranteeEvent,
} from './support/activity-workspace';
import { exerciseRollCompatibility } from './support/roll-compatibility';
import { exerciseTeamConditionRows } from './support/team-conditions';
import {
  panAndTapSettlementCards,
  reviewUpkeepChoiceLayout,
} from './support/upkeep-layout';
import {
  confirmWithOpenPicker,
  followAllowanceCorrections,
  openActivity,
  panAndTapPicker,
  reviewActivityLandscapes,
} from './support/activity-layout';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Page } from '@playwright/test';
import { join } from 'node:path';
import { draftKeySchema } from '../convex/lib/canonicalStorageValidators';
import { confirmationInspectionSchema } from '../src/lib/weekly-confirmation-contract';
import { weekPath } from '../src/lib/campaign-routes';
import { test, expect, type Fixture } from './support/fixtures';
import { exerciseRankBoon } from './support/rank-boons';
import { workspaceCaseKey } from './support/matrix';
import {
  canonicalPersistenceFixtureCall,
  loadRun,
  savePrivate,
} from './support/process';
import { controlNextDraftEdit } from './support/held-mutation';
import { controlTransport } from './support/transport';
import { initialUpkeep } from './support/upkeep-scenario';

function observeEditRejection(page: Page) {
  let rejected = false;
  page.on('websocket', (socket) => {
    const requests = new Set<number>();
    socket.on('framesent', ({ payload }) => {
      try {
        const parsed = z
          .object({
            type: z.literal('Mutation'),
            requestId: z.number(),
            udfPath: z.literal('canonicalDraftPersistence:edit'),
          })
          .safeParse(JSON.parse(payload.toString()));
        if (parsed.success) requests.add(parsed.data.requestId);
      } catch {
        /* Non-protocol frames are irrelevant. */
      }
    });
    socket.on('framereceived', ({ payload }) => {
      try {
        const parsed = z
          .object({
            type: z.literal('MutationResponse'),
            requestId: z.number(),
            success: z.literal(false),
          })
          .safeParse(JSON.parse(payload.toString()));
        if (parsed.success && requests.has(parsed.data.requestId))
          rejected = true;
      } catch {
        /* Provider payloads remain private. */
      }
    });
  });
  return () => rejected;
}

// Each journey resets and seeds its own catalog case, so the journeys are
// independent and may run on different worker cohorts at the same time.
test.describe.configure({ mode: 'parallel' });
test.use({
  caseKey: async ({}, use, info) => await use(workspaceCaseKey(info.title)),
});

// Seeds the case's plain Upkeep week (week 4) and holds the GM's next draft
// edit on demand; each journey keeps its own case and releases the control.
async function openUpkeepWeek({
  ownedCase,
  gm,
}: {
  ownedCase: Fixture;
  gm: Page;
}) {
  const run = await loadRun();
  const scope = draftKeySchema.parse(
    await canonicalPersistenceFixtureCall(run, 'initializeUpkeep', {
      scope: ownedCase.scope,
      draftId: randomUUID(),
    }),
  );
  return {
    run,
    route: weekPath(scope.campaignId),
    network: await controlNextDraftEdit(gm, run.fixture!.convexUrl),
  };
}

const die = (page: Page) =>
  page.getByRole('textbox', { name: 'Attrition Loyalty roll', exact: true });
const training = (page: Page) =>
  page.getByRole('textbox', { name: 'Attrition training roll', exact: true });

// The Upkeep core (#752, D-7): shared week edits and save recovery on the
// week. Its setup part and its week-frame and responsive part are journeys of
// their own below; the local field and transfer validation is proven by the
// component tests (whole-number-field, roll-total-field, upkeep-transfers),
// while zero, a blank clear and a 0.07 gp deposit still reach the player.
test('players prepare shared Upkeep with independent navigation and save recovery', async ({
  players,
  ownedCase,
}) => {
  // 108 s of 130 s with one local worker (#729 run 1) before #752 moved its
  // setup, frame and responsive parts out; 1.6× (#198).
  test.setTimeout(175_000);
  const { route, network } = await openUpkeepWeek({
    ownedCase,
    gm: players.gm,
  });
  const gm = players.gm,
    player = players.player;
  const editor = gm.locator('[data-week-editor]');
  const attrition = editor.getByRole('region', {
    name: 'Training attrition',
    exact: true,
  });
  const saved = () =>
    expect(saveState(gm)).toHaveAttribute('data-week-feedback', 'saved');
  try {
    await test.step('members open the week and the outsider is refused', async () => {
      await Promise.all([
        gm.goto(route),
        player.goto(route),
        players.outsider.goto(route),
      ]);
      await expect(
        gm.getByRole('heading', { name: 'Week 4 · Upkeep', exact: true }),
      ).toBeVisible();
      await expect(gm).toHaveURL(/\/campaigns\/[^/]+\/week(?:\?|$)/);
      await expect(
        player.getByRole('heading', { name: 'Week 4 · Upkeep', exact: true }),
      ).toBeVisible();
      await expect(
        players.outsider.getByText(/This campaign isn't available/),
      ).toBeVisible();
      await expect(
        players.outsider.getByRole('textbox', {
          name: 'Attrition Loyalty roll',
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(attrition.getByText('Loyalty DC 10')).toBeVisible();
      await expect(attrition).toContainText('bonus +3');
      // Initial load announces no other-player change on either device.
      await expect(remoteChangeNote(gm)).toBeEmpty();
      await expect(remoteChangeNote(player)).toBeEmpty();
    });

    await test.step("another player's attrition entries are announced without moving focus or phase, and add up", async () => {
      // The receiving player is typing in a field the other write does not
      // touch: the note names the phase without moving focus or phase.
      const transferAmount = player.getByRole('textbox', {
        name: 'Transfer amount (gp)',
        exact: true,
      });
      await transferAmount.focus();
      await die(gm).fill('10');
      await expect(die(player)).toHaveValue('10');
      await expect(remoteChangeNote(player)).toHaveText(
        'Another player changed Upkeep.',
      );
      const firstBatch = await remoteChangeNote(player).getAttribute(
        'data-week-remote-sequence',
      );
      await expect(transferAmount).toBeFocused();
      await expect(remoteChangeNote(gm)).toBeEmpty();
      await training(gm).fill('3');
      await expect(training(player)).toHaveValue('3');
      // A second accepted change in the same phase is a new batch (announced
      // again) with the same words; focus and both phases stay put.
      await expect(remoteChangeNote(player)).toHaveText(
        'Another player changed Upkeep.',
      );
      await expect(remoteChangeNote(player)).not.toHaveAttribute(
        'data-week-remote-sequence',
        firstBatch!,
      );
      await expect(transferAmount).toBeFocused();
      await expect(remoteChangeNote(gm)).toBeEmpty();
      await expect(
        player.getByRole('heading', { name: 'Week 4 · Upkeep', exact: true }),
      ).toBeVisible();
      await expect(
        gm.getByRole('heading', { name: 'Week 4 · Upkeep', exact: true }),
      ).toBeVisible();
      // The step header reports its own change: 13 succeeds, losing 1d6 = 3.
      await expect(attrition).toContainText('bonus +3 = total 13');
      await expect(attrition).toContainText('Training −3');
      await saved();
    });

    await test.step('zero and a blank clear reach the other device', async () => {
      await die(gm).fill('0');
      await expect(die(player)).toHaveValue('0');
      await die(gm).fill('');
      await die(gm).press('Tab');
      await expect(die(player)).toHaveValue('');
      await die(gm).fill('10');
      await expect(die(player)).toHaveValue('10');
      await training(gm).fill('3');
      await expect(training(player)).toHaveValue('3');
      await saved();
    });

    await test.step("a 0.07 gp deposit updates the other device's Treasury", async () => {
      // Transfers are entered in gp with no character to choose.
      await gm
        .getByRole('textbox', { name: 'Transfer amount (gp)', exact: true })
        .fill('0.07');
      await gm.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(
        player.getByRole('region', {
          name: 'Deposits and withdrawals',
          exact: true,
        }),
      ).toContainText('Treasury 50 gp → 50.07 gp');
      await saved();
    });

    await test.step('Back and Forward ask before leaving a held edit, which still commits', async () => {
      const charactersUrl = await prepareWeekHistory(gm);
      await expect(die(gm)).toHaveValue('10');
      const heldBack = network.hold();
      await die(gm).fill('11');
      await heldBack;
      await stayOnPendingWeek(gm, 'back', 'pending');
      await expect(die(gm)).toHaveValue('11');
      await expect(die(player)).toHaveValue('10');
      await leavePendingWeek(gm, 'back', charactersUrl);
      network.release();
      await expect(die(player)).toHaveValue('11');
      await gm.goForward();
      await expect(die(gm)).toHaveValue('11');
      await expect(
        gm.getByRole('heading', { name: 'Week 4 · Upkeep', exact: true }),
      ).toHaveCount(1);

      // Forward traversal has the same protection and must keep its direction
      // after Stay; Leave must consume that entry rather than push a duplicate.
      await openCampaignSection(gm, 'officers');
      await gm.goBack();
      await expect(die(gm)).toHaveValue('11');
      const heldForward = network.hold();
      await die(gm).fill('13');
      await heldForward;
      await stayOnPendingWeek(gm, 'forward', 'pending');
      await expect(die(gm)).toHaveValue('13');
      await expect(die(player)).toHaveValue('11');
      await leavePendingWeek(gm, 'forward', charactersUrl);
      network.release();
      await expect(die(player)).toHaveValue('13');
      await gm.goBack();
      await expect(die(gm)).toHaveValue('13');
    });

    await test.step('a refused held edit asks before reload, shows the latest saved values at every size and needs a fresh review', async () => {
      const captured = network.hold();
      await die(gm).fill('12');
      await captured;
      await expect(saveState(gm)).toHaveAttribute(
        'data-week-feedback',
        'pending',
      );
      await gm.getByRole('button', { name: 'Activity', exact: true }).tap();
      await expect(
        gm.getByRole('heading', { name: 'Week 4 · Activity', exact: true }),
      ).toBeVisible();
      await expect(
        player.getByRole('heading', { name: 'Week 4 · Upkeep', exact: true }),
      ).toBeVisible();
      await gm
        .getByRole('button', { name: 'Review & confirm', exact: true })
        .click();
      await expect(reviewConfirm(gm)).toBeDisabled();
      const dialog = gm.waitForEvent('dialog');
      const reload = gm.reload({ timeout: 10_000 }).catch(() => null);
      const warning = await dialog;
      expect(warning.type()).toBe('beforeunload');
      await warning.dismiss();
      await reload;
      await die(player).fill('14');
      await expect(saveState(player)).toHaveAttribute(
        'data-week-feedback',
        'saved',
      );
      network.release();
      await expect(saveFailure(gm)).toHaveText(
        'Changes could not be saved. The latest saved values are shown.',
      );
      await expectSaveFailed(gm);
      // The failure is visible text in the frame's own row at every size,
      // phones included, without widening the page; the top bar carries no
      // save status (removed 2026-09-28) and keeps one row at tablet width.
      await expectNoHorizontalOverflow(gm);
      await expectVisibleFailure(gm);
      for (const [width, height] of [
        [390, 844],
        [740, 360],
        [844, 390],
        [1180, 820],
        [1194, 834],
      ] as const) {
        await gm.setViewportSize({ width, height });
        await expectNoHorizontalOverflow(gm);
        await expectSaveFailed(gm);
        await expectVisibleFailure(gm);
        if (width >= 1180) await expectTopBarOneRow(gm);
      }
      await gm.setViewportSize({ width: 1194, height: 834 });
      await expect(reviewConfirm(gm)).toBeDisabled();
      const updatedReview = gm.getByRole('button', {
        name: 'Review updated week',
        exact: true,
      });
      await expect(updatedReview).toBeEnabled();
      await updatedReview.click();
      await expect(reviewConfirm(gm)).toBeEnabled();
      await gm.getByRole('button', { name: 'Upkeep', exact: true }).click();
      await expect(die(gm)).toHaveValue('14');
      await die(gm).fill('16');
      await expect(die(player)).toHaveValue('16');
      await saved();
      await gm
        .getByRole('button', { name: 'Review & confirm', exact: true })
        .click();
      await expect(reviewConfirm(gm)).toBeEnabled();
    });

    await test.step('the player confirms and both devices reach Week 5', async () => {
      await player
        .getByRole('button', { name: 'Review & confirm', exact: true })
        .click();
      await expect(reviewConfirm(player)).toBeEnabled();
      await reviewConfirm(player).click();
      await expect(
        player.getByRole('heading', { name: /Week 5/ }),
      ).toBeVisible();
      await expect(gm.getByRole('heading', { name: /Week 5/ })).toBeVisible();
    });
  } finally {
    network.release();
  }
});

// Split from the Upkeep journey (#752, D-7): Setup for a new and an existing
// militia, which resets the shared Upkeep case for each and leaves it reset.
test('players set up a new and an existing militia while the other member follows and the outsider is refused', async ({
  players,
  ownedCase,
}) => {
  // Not yet measured on its own; Setup was part of the Upkeep journey's
  // 108 s (#729 run 1).
  test.setTimeout(120_000);
  const run = await loadRun();
  await test.step('a new and an existing militia are set up', () =>
    exerciseMilitiaSetup(run, ownedCase.scope, players));
});

// Split from the Upkeep journey (#752, D-7): the week frame, the reference
// panel and its History failure, and the layout at every size, on a fresh
// Upkeep week. A pasted malformed roll changes nothing (no lower-layer test
// covers the clipboard).
test('the Upkeep week frame, reference panel and a failed History stay usable at every size', async ({
  players,
  ownedCase,
}) => {
  // Not yet measured on its own; these checks were part of the Upkeep
  // journey's 108 s (#729 run 1).
  test.setTimeout(120_000);
  const { run, route, network } = await openUpkeepWeek({
    ownedCase,
    gm: players.gm,
  });
  const gm = players.gm,
    player = players.player;
  try {
    await test.step('a pasted malformed roll keeps the saved one', async () => {
      await Promise.all([gm.goto(route), player.goto(route)]);
      await expect(
        gm.getByRole('heading', { name: 'Week 4 · Upkeep', exact: true }),
      ).toBeVisible();
      await die(gm).fill('10');
      await expect(die(player)).toHaveValue('10');
      await training(gm).fill('3');
      await expect(training(player)).toHaveValue('3');
      await expect(saveState(gm)).toHaveAttribute(
        'data-week-feedback',
        'saved',
      );
      await gm
        .context()
        .grantPermissions(['clipboard-read', 'clipboard-write']);
      await gm.evaluate(() => navigator.clipboard.writeText('12x'));
      await die(gm).press('ControlOrMeta+A');
      await die(gm).press('ControlOrMeta+V');
      await expect(die(gm)).toHaveValue('10');
    });

    await test.step('the week frame, reference panel and a failed History stay usable', async () => {
      await exerciseWeekFrame(gm);
      await exerciseReferencePanel(gm);
      await exerciseReferenceHistoryFailure(gm, network, die(gm), ['15', '16']);
      await expect(die(player)).toHaveValue('16');
    });

    await test.step('the week fits tablet, narrow tablet, phone and desktop, and a phone tap chooses Withdraw', async () => {
      for (const [name, width, height] of [
        ['tablet', 1194, 834],
        ['tablet-narrow', 1180, 820],
        ['phone', 390, 844],
        ['desktop', 1440, 900],
      ] as const) {
        await gm.setViewportSize({ width, height });
        await expect(
          gm.getByRole('heading', { name: 'Week 4 · Upkeep', exact: true }),
        ).toBeVisible();
        if (name === 'phone') {
          await exercisePhoneSteps(gm);
          await exercisePhoneReference(gm);
        } else {
          // The panel is open at every wide size; the editor stays bounded
          // and reachable with it open and with it closed.
          await expect(referencePanel(gm)).toBeVisible();
          await expectNoHorizontalOverflow(gm);
          await expectBoundedWeekHost(gm);
          await expectPanelToggleBesideStepper(gm);
          if (name !== 'desktop') await expectTopBarOneRow(gm);
          await gm
            .getByRole('button', { name: 'Hide reference panel' })
            .click();
          await expect(referencePanel(gm)).toBeHidden();
          await expectBoundedWeekHost(gm);
          await expectPanelToggleBesideStepper(gm);
          await gm
            .getByRole('button', { name: 'Show reference panel' })
            .click();
          await expect(referencePanel(gm)).toBeVisible();
        }
        await expectNoHorizontalOverflow(gm);
        const withdraw = gm
          .getByRole('group', { name: 'Transfer direction', exact: true })
          .getByRole('button', { name: 'Withdraw', exact: true });
        const bounds = await withdraw.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
        expect(
          await withdraw.evaluate(
            (element) => element.scrollWidth <= element.clientWidth,
          ),
        ).toBe(true);
        if (name === 'phone') {
          await withdraw.tap();
          await expect(withdraw).toHaveAttribute('aria-pressed', 'true');
          // The tapped control itself stays reachable above the bottom bar.
          await expectReachable(gm, withdraw);
        }
        await expectBoundedWeekHost(gm);
        await savePrivate(
          join(run.artifactDirectory, `canonical-upkeep-${name}.png`),
          await gm.screenshot({ fullPage: true }),
        );
      }
    });
  } finally {
    network.release();
  }
});

test('players choose the nearest settlement at maximum notoriety and resolve team conditions', async ({
  players,
  ownedCase,
}) => {
  // 26 s of 30 s with one local worker (#729 run 1); 1.6× (#198).
  test.setTimeout(45_000);
  const run = await loadRun();
  // Before the split these steps shared the first journey's socket control;
  // keep the same routed transport even where no edit is held.
  const network = await controlNextDraftEdit(
    players.gm,
    run.fixture!.convexUrl,
  );
  const gm = players.gm,
    player = players.player;
  try {
    // The nearest settlement is chosen only at maximum notoriety, once the
    // Loyalty check fails; its cards are exercised on that fixture.
    const { route: notorietyRoute } = await initialUpkeep(run, ownedCase, {
      choices: true,
      maximumNotoriety: true,
      missingTeam: true,
      rankGain: true,
    });
    await Promise.all([gm.goto(notorietyRoute), player.goto(notorietyRoute)]);
    await expect(die(gm)).toBeVisible();
    await die(gm).fill('10');
    await expect(die(player)).toHaveValue('10');
    await training(gm).fill('3');
    await expect(training(player)).toHaveValue('3');
    await gm
      .getByRole('textbox', {
        name: 'Maximum-notoriety training roll',
        exact: true,
      })
      .fill('5');
    await gm
      .getByRole('textbox', { name: 'Notoriety Loyalty roll', exact: true })
      .fill('1');
    await expect(
      player.getByRole('textbox', {
        name: 'Notoriety Loyalty roll',
        exact: true,
      }),
    ).toHaveValue('1');
    const settlementCards = gm.getByRole('group', {
      name: 'Nearest settlement',
      exact: true,
    });
    const selectedSettlement = gm.locator(
      '[aria-label="Nearest settlement selection"]',
    );
    await settlementCards.scrollIntoViewIfNeeded();
    const phaendar = settlementCards.getByRole('button', {
      name: 'Phaendar',
      exact: true,
    });
    const cardBounds = await phaendar.boundingBox();
    const targetBounds = await selectedSettlement.boundingBox();
    expect(cardBounds).not.toBeNull();
    expect(targetBounds).not.toBeNull();
    expect(cardBounds!.y).toBeGreaterThanOrEqual(0);
    expect(cardBounds!.y + cardBounds!.height).toBeLessThanOrEqual(834);
    expect(targetBounds!.y).toBeGreaterThanOrEqual(0);
    await gm.mouse.move(
      cardBounds!.x + cardBounds!.width / 2,
      cardBounds!.y + cardBounds!.height / 2,
    );
    await gm.mouse.down();
    await gm.mouse.move(
      targetBounds!.x + targetBounds!.width / 2,
      targetBounds!.y + targetBounds!.height / 2,
      { steps: 12 },
    );
    await expect(selectedSettlement).toHaveAttribute(
      'data-drop-active',
      'true',
    );
    await savePrivate(
      join(run.artifactDirectory, 'canonical-upkeep-drag-tablet.png'),
      await gm.screenshot({ fullPage: true }),
    );
    await gm.mouse.up();
    await expect(
      player
        .getByRole('group', { name: 'Nearest settlement', exact: true })
        .getByRole('button', { name: 'Phaendar', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    const misthome = settlementCards.getByRole('button', {
      name: 'Misthome',
      exact: true,
    });
    const invalidBounds = await misthome.boundingBox();
    expect(invalidBounds).not.toBeNull();
    await gm.mouse.move(
      invalidBounds!.x + invalidBounds!.width / 2,
      invalidBounds!.y + invalidBounds!.height / 2,
    );
    await gm.mouse.down();
    await gm.mouse.move(5, 5, { steps: 12 });
    await gm.mouse.up();
    await expect(
      gm.getByText(
        'Place the card in the highlighted selection area. Your selection is unchanged.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(phaendar).toHaveAttribute('aria-pressed', 'true');
    await expect(misthome).toHaveAttribute('aria-pressed', 'false');
    // The touch pan and tap on these cards have their own journey.
    await exerciseTeamConditionRows(gm, player);
    await exerciseRankBoon(gm, player);
  } finally {
    network.release();
  }
});

test('players recover a team at an adjusted cost and confirm a week through Activity and Event', async ({
  players,
  ownedCase,
}) => {
  // Run 2 used 112 s; the limit is 1.6 times that (README, Per-test limits).
  test.setTimeout(180_000);
  const run = await loadRun();
  const network = await controlNextDraftEdit(
    players.gm,
    run.fixture!.convexUrl,
  );
  const gm = players.gm,
    player = players.player;
  const saved = () =>
    expect(saveState(gm)).toHaveAttribute('data-week-feedback', 'saved');
  const recovery = gm.getByRole('group', {
    name: 'Scouts team condition',
    exact: true,
  });
  const remoteRecovery = player.getByRole('group', {
    name: 'Scouts team condition',
    exact: true,
  });
  const cost = (group: typeof recovery) =>
    group.getByRole('textbox', {
      name: 'Scouts: Recovery cost (gp)',
      exact: true,
    });
  const reason = (group: typeof recovery) =>
    group.getByRole('textbox', {
      name: 'Scouts: Reason for the changed cost',
      exact: true,
    });
  try {
    const { key: choicesScope } =
      await test.step('enter the attrition rolls below maximum notoriety', async () => {
        const scenario = await initialUpkeep(run, ownedCase, { choices: true });
        await Promise.all([
          gm.goto(scenario.route),
          player.goto(scenario.route),
        ]);
        await expect(die(gm)).toBeVisible();
        await die(gm).fill('10');
        await expect(die(player)).toHaveValue('10');
        await training(gm).fill('3');
        await expect(training(player)).toHaveValue('3');
        // Below maximum notoriety the step collapses and no settlement is asked.
        await expect(
          gm.getByRole('group', { name: 'Nearest settlement', exact: true }),
        ).toHaveCount(0);
        return scenario;
      });
    await test.step('a recovery price converges on every device and survives a reload', async () => {
      // Recover saves at once at the rules cost, shown in gp.
      await recovery
        .getByRole('button', { name: 'Recover', exact: true })
        .click();
      await expect(
        remoteRecovery.getByRole('button', { name: 'Recover', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      await expect(cost(recovery)).toHaveValue('20');
      await expect(cost(remoteRecovery)).toHaveValue('20');
      // A changed price stays local until its reason is present.
      await cost(recovery).fill('15');
      await expect(
        recovery.getByRole('alert').filter({
          hasText: 'A reason is required for a changed recovery cost.',
        }),
      ).toBeVisible();
      await expect(cost(remoteRecovery)).toHaveValue('20');
      await cost(recovery).fill('15x');
      await expect(
        recovery.getByRole('alert').filter({
          hasText: 'Enter an amount in gp, such as 12 or 0.07.',
        }),
      ).toBeVisible();
      await cost(recovery).fill('15');
      await reason(recovery).fill('Local healer donated supplies');
      await expect(cost(remoteRecovery)).toHaveValue('15');
      await expect(reason(remoteRecovery)).toHaveValue(
        'Local healer donated supplies',
      );
      await saved();
      // Both players change the price at once: every device converges on the
      // latest accepted edit, never a mix or an older price.
      await Promise.all([
        cost(recovery).fill('14'),
        cost(remoteRecovery).fill('16'),
      ]);
      await expect(async () => {
        const [local, remote] = await Promise.all([
          cost(recovery).inputValue(),
          cost(remoteRecovery).inputValue(),
        ]);
        expect(local).toBe(remote);
        expect(['14', '16']).toContain(local);
      }).toPass();
      await cost(recovery).fill('15');
      await expect(cost(remoteRecovery)).toHaveValue('15');
      await saved();
      // An accepted price and reason survive a reload.
      await player.reload();
      await expect(cost(remoteRecovery)).toHaveValue('15');
      await expect(reason(remoteRecovery)).toHaveValue(
        'Local healer donated supplies',
      );
    });
    await test.step('Review shows the adjusted Treasury on both devices', async () => {
      await gm
        .getByRole('button', { name: 'Review & confirm', exact: true })
        .click();
      await player
        .getByRole('button', { name: 'Review & confirm', exact: true })
        .click();
      for (const page of [gm, player]) {
        await expect(
          await resultCell(page, 'Treasury', 'Rules Baseline'),
        ).toHaveText('30 gp');
        await expect(await resultCell(page, 'Treasury', 'Final')).toHaveText(
          '35 gp',
        );
        await expect(reviewConfirm(page)).toBeEnabled();
      }
      await savePrivate(
        join(run.artifactDirectory, 'canonical-recovery-summary-tablet.png'),
        await gm.screenshot({ fullPage: true }),
      );
    });
    await test.step('Leave disabled clears the price and a second recovery restores it', async () => {
      await gm.getByRole('button', { name: 'Upkeep', exact: true }).click();
      await player.getByRole('button', { name: 'Upkeep', exact: true }).click();
      // Leave disabled clears the recovery price and its adjustment.
      await recovery
        .getByRole('button', { name: 'Leave disabled', exact: true })
        .click();
      await expect(
        remoteRecovery.getByRole('button', {
          name: 'Leave disabled',
          exact: true,
        }),
      ).toHaveAttribute('aria-pressed', 'true');
      await expect(cost(remoteRecovery)).toHaveCount(0);
      await expect(remoteRecovery.getByText(/Table Adjustment/)).toHaveCount(0);
      await recovery
        .getByRole('button', { name: 'Recover', exact: true })
        .click();
      await expect(cost(remoteRecovery)).toHaveValue('20');
      await expect(reason(remoteRecovery)).toHaveCount(0);
      await cost(recovery).fill('15');
      await reason(recovery).fill('Local healer donated supplies');
      await expect(
        remoteRecovery.getByRole('button', { name: 'Recover', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      await expect(cost(remoteRecovery)).toHaveValue('15');
      await saved();
      for (const [name, width, height] of [
        ['tablet', 1194, 834],
        ['phone', 390, 844],
      ] as const) {
        await gm.setViewportSize({ width, height });
        await expectNoHorizontalOverflow(gm);
        await savePrivate(
          join(run.artifactDirectory, `canonical-recovery-${name}.png`),
          await gm.screenshot({ fullPage: true }),
        );
      }
      // The other Activity checks on this recovered week have their own
      // journey, which seeds this state. They left the GM page at the
      // project viewport with every choice cleared, as this does.
      await gm.setViewportSize({ width: 1194, height: 834 });
    });
    await test.step("Guarantee Event's candidates are chosen in Event and cleared with the choice", async () => {
      await Promise.all([
        gm.getByRole('button', { name: 'Activity', exact: true }).click(),
        player.getByRole('button', { name: 'Activity', exact: true }).click(),
      ]);
      await exerciseGuaranteeEvent(gm, player);
      await Promise.all([
        gm.getByRole('button', { name: 'Upkeep', exact: true }).click(),
        player.getByRole('button', { name: 'Upkeep', exact: true }).click(),
      ]);
    });
    await test.step('Event prepares and records events, then restores the quiet week', () =>
      exerciseEventWorkspace(gm, player, network, run.artifactDirectory));
    await test.step('a Confirmation closes the open action picker with the week', async () => {
      await reviewSummarySettlement(gm, player);
      await player
        .getByRole('button', { name: 'Review & confirm', exact: true })
        .click();
      await expect(reviewConfirm(player)).toBeEnabled();
      // A Confirmation arriving while another player's action picker is open
      // closes it with the week; nothing is placed in either week.
      await gm.getByRole('button', { name: 'Activity', exact: true }).click();
      await gm
        .getByRole('button', {
          name: 'Choose an action for Action Slot 1',
          exact: true,
        })
        .click();
      await expect(gm.getByRole('dialog')).toBeVisible();
      await reviewConfirm(player).click();
      await expect(
        player.getByRole('heading', { name: /Week 5/ }),
      ).toBeVisible();
      await expect(gm.getByRole('dialog')).toHaveCount(0);
      await expect(gm.getByRole('heading', { name: /Week 5/ })).toBeVisible();
    });
    await test.step('the confirmed week keeps the recovery and its adjustment', async () => {
      const committed = confirmationInspectionSchema.parse(
        await canonicalPersistenceFixtureCall(run, 'inspect', {
          ...choicesScope,
          scope: ownedCase.scope,
        }),
      );
      expect(committed.snapshot.treasuryCopper).toBe(3500);
      expect(committed.records).toHaveLength(1);
      expect(committed.records[0]?.sourceMilitiaSnapshot?.treasuryCopper).toBe(
        5000,
      );
      expect(committed.records[0]?.source.upkeep.teamDecisions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ decision: 'recover', costCopper: 2000 }),
        ]),
      );
      expect(committed.records[0]?.adjudication.tableAdjustments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'militia_value',
            field: 'treasuryCopper',
            value: 500,
            reason: 'Local healer donated supplies',
          }),
        ]),
      );
    });
  } finally {
    network.release();
  }
});

test('players review and buy off carried persistent events before confirming the week', async ({
  players,
  ownedCase,
}) => {
  // 71 s of 80 s with one local worker (#729 run 1); 1.6× (#198).
  test.setTimeout(115_000);
  const run = await loadRun();
  const network = await controlNextDraftEdit(
    players.gm,
    run.fixture!.convexUrl,
  );
  const gm = players.gm,
    player = players.player;
  try {
    const { key: persistentScope, route: persistentRoute } =
      await initialUpkeep(run, ownedCase, { persistent: true });
    await Promise.all([gm.goto(persistentRoute), player.goto(persistentRoute)]);
    await reviewSummaryWorkspace(gm, player, run.artifactDirectory);
    await exercisePersistentWorkspace(
      gm,
      player,
      network,
      run.artifactDirectory,
    );
    await reviewPersistentWorkspace(gm, player, run.artifactDirectory);
    // The player's Confirmation must review the restored buyoff: a stale
    // review is correctly rejected (#774).
    await expectPersistentRestoreDelivered(gm, player);
    const beforePersistentConfirmation = confirmationInspectionSchema.parse(
      await canonicalPersistenceFixtureCall(run, 'inspect', {
        ...persistentScope,
        scope: ownedCase.scope,
      }),
    );
    expect(beforePersistentConfirmation.snapshot.treasuryCopper).toBe(50000);
    expect(beforePersistentConfirmation.records).toHaveLength(0);
    await player
      .getByRole('button', { name: 'Review & confirm', exact: true })
      .click();
    await expect(reviewConfirm(player)).toBeEnabled();
    await reviewConfirm(player).click();
    for (const page of [gm, player]) {
      await expect(page.getByRole('heading', { name: /Week 5/ })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Persistent', exact: true }),
      ).toBeDisabled();
    }
    const afterPersistentConfirmation = confirmationInspectionSchema.parse(
      await canonicalPersistenceFixtureCall(run, 'inspect', {
        ...persistentScope,
        scope: ownedCase.scope,
      }),
    );
    expect(afterPersistentConfirmation.snapshot.treasuryCopper).toBe(42000);
    expect(afterPersistentConfirmation.records).toHaveLength(1);
    expect(afterPersistentConfirmation.openDrafts).toHaveLength(1);
    expect(afterPersistentConfirmation.openDrafts[0]?.context).toMatchObject({
      carriedEvents: [],
      lastBuyoffWeek: 4,
      persistentPhaseEligible: false,
    });
  } finally {
    network.release();
  }
});

test('racing Confirmations commit one reviewed week and reject stale and delayed changes', async ({
  players,
  ownedCase,
}) => {
  // 49 s of 55 s with one local worker (#729 run 1); 1.6× (#198).
  test.setTimeout(80_000);
  const run = await loadRun();
  const gm = players.gm,
    player = players.player;
  const { key: summaryScope, route: summaryRoute } = await initialUpkeep(
    run,
    ownedCase,
  );
  const first = await gm.context().newPage();
  const second = await player.context().newPage();
  const late = await gm.context().newPage();
  const firstTransport = await controlTransport(first, run.fixture!.convexUrl);
  const secondTransport = await controlTransport(
    second,
    run.fixture!.convexUrl,
  );
  const lateTransport = await controlNextDraftEdit(
    late,
    run.fixture!.convexUrl,
  );
  const lateRejected = observeEditRejection(late);
  const releases: (() => void)[] = [];
  const summary = (page: Page) =>
    page.getByRole('button', { name: 'Review & confirm', exact: true }).click();
  const confirm = (page: Page) => reviewConfirm(page);
  const confirming = (page: Page) => reviewConfirm(page, 'Confirming…');
  try {
    await Promise.all([
      first.goto(summaryRoute),
      second.goto(summaryRoute),
      late.goto(summaryRoute),
    ]);
    // Incoming dice totals are read, cleared and re-entered on this fresh
    // week before its original inputs are restored for the Confirmation race.
    await exerciseRollCompatibility(first, second, run, summaryScope, [late]);
    const confirmationCharactersUrl = await prepareWeekHistory(first);
    // Review lists what is missing with only its disabled reason beside
    // Confirm, and a Go link leads this device to the source step.
    await summary(first);
    const review = first.getByRole('region', {
      name: 'Review the week',
      exact: true,
    });
    await expect(review.getByText(/^\d+ decisions? left$/)).toBeVisible();
    await expect(review).not.toContainText(/ready for confirmation|attention/);
    await review
      .getByRole('region', { name: 'Required decisions', exact: true })
      .getByRole('listitem')
      .filter({ hasText: /^Upkeep: Enter the attrition Loyalty roll\b/ })
      .getByRole('button', { name: 'Go to Upkeep', exact: true })
      .click();
    await expect(
      first.getByRole('region', { name: 'Training attrition', exact: true }),
    ).toBeFocused();
    await die(first).fill('20');
    await expect(die(second)).toHaveValue('20');
    await training(first).fill('1');
    await expect(training(second)).toHaveValue('1');
    await Promise.all([summary(first), summary(second)]);
    await expect(confirm(first)).toBeEnabled();
    await expect(confirm(second)).toBeEnabled();
    const stale = firstTransport.next('delay-request');
    releases.push(stale.release);
    await confirm(first).click();
    await expect.poll(stale.observed).toBe(true);
    await expect(saveState(first)).toHaveAttribute(
      'data-week-feedback',
      'confirming',
    );
    await stayOnPendingWeek(first, 'back', 'confirming');
    // The initiating control itself reads Confirming… while held; the
    // ready label must not exist meanwhile.
    await expect(confirming(first)).toBeDisabled();
    await expect(confirming(first)).toHaveAttribute('aria-busy', 'true');
    await expect(confirm(first)).toHaveCount(0);
    await expect(confirmedWeekNotice(first)).toBeEmpty();
    await expect(
      second.getByRole('heading', {
        name: 'Week 4 · Review & confirm',
        exact: true,
      }),
    ).toBeVisible();
    await canonicalPersistenceFixtureCall(run, 'changeSource', {
      ...summaryScope,
      scope: ownedCase.scope,
      change: 'treasury',
    });
    await expect(await resultCell(second, 'Treasury', 'Final')).toHaveText(
      '50.07 gp',
    );
    stale.release();
    await expect(
      first.getByRole('button', { name: 'Review updated week', exact: true }),
    ).toBeEnabled();
    // Rejected as stale: back to the ready label, disabled with its reason
    // beside it, no success.
    await expect(confirm(first)).toBeDisabled();
    await expect(
      review.getByText('Review the updated week before confirming.', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(confirming(first)).toHaveCount(0);
    await expect(confirmedWeekNotice(first)).toBeEmpty();
    await expect(
      first.getByRole('heading', {
        name: 'Week 4 · Review & confirm',
        exact: true,
      }),
    ).toBeVisible();
    await expect(await resultCell(first, 'Treasury', 'Final')).toHaveText(
      '50.07 gp',
    );
    // Leaving Review & confirm and returning is not the explicit review.
    await first.getByRole('button', { name: 'Upkeep', exact: true }).click();
    await summary(first);
    await expect(review.getByRole('alert')).toContainText(
      'The week could not be confirmed as reviewed.',
    );
    await expect(confirm(first)).toBeDisabled();
    await first
      .getByRole('button', { name: 'Review updated week', exact: true })
      .click();
    await expect(confirm(first)).toBeEnabled();
    await expect(confirm(first)).toBeFocused();
    await expect(review.getByRole('alert')).toHaveCount(0);
    await expect(confirm(second)).toBeEnabled();
    const delayed = lateTransport.hold();
    releases.push(() => lateTransport.release());
    await die(late).fill('7');
    await delayed;
    await summary(late);
    await expect(confirm(late)).toBeDisabled();
    await expect(
      late
        .getByRole('main')
        .getByText('Review will be ready when your changes are saved.', {
          exact: true,
        }),
    ).toBeVisible();
    const raceFirst = firstTransport.next('delay-request');
    const raceSecond = secondTransport.next('delay-request');
    releases.push(raceFirst.release, raceSecond.release);
    await Promise.all([confirm(first).click(), confirm(second).click()]);
    await expect.poll(raceFirst.observed).toBe(true);
    await expect.poll(raceSecond.observed).toBe(true);
    await leavePendingWeek(first, 'back', confirmationCharactersUrl);
    raceFirst.release();
    raceSecond.release();
    await expect(second.getByRole('heading', { name: /Week 5/ })).toBeVisible();
    // Every continuously observing device lands on the successor's Upkeep
    // with exactly one Week 4 notice and its exact history link, whether
    // it won, lost or merely watched. `first` left the Week meanwhile and
    // returns to a fresh page, which must not invent an old-week notice.
    await expectConfirmedWeek(second, 4);
    await expectConfirmedWeek(late, 4);
    await expect(saveState(second)).not.toHaveAttribute(
      'data-week-feedback',
      'confirming',
    );
    await expect(confirming(second)).toHaveCount(0);
    await first.goForward();

    for (const page of [first, second, late])
      await expect(page.getByRole('heading', { name: /Week 5/ })).toBeVisible();
    // A fresh load after returning never fabricates the transient notice.
    await expect(first.locator('[data-week-skeleton]')).toHaveCount(0);
    await expect(confirmedWeekNotice(first)).toBeEmpty();
    const secondTransition = await confirmedWeekNotice(second)
      .locator('[data-week-confirmed-transition]')
      .getAttribute('data-week-confirmed-transition');
    lateTransport.release();
    await expect.poll(lateRejected).toBe(true);
    // The delayed old edit was rejected without touching the new week or
    // the notices already shown.
    await expectConfirmedWeek(late, 4);
    await expect(confirmedWeekNotice(second)).toHaveCount(1);
    await expect(
      confirmedWeekNotice(second).locator('[data-week-confirmed-transition]'),
    ).toHaveAttribute('data-week-confirmed-transition', secondTransition!);
    await expect(die(late)).toHaveValue('');
    const resolved = confirmationInspectionSchema.parse(
      await canonicalPersistenceFixtureCall(run, 'inspect', {
        ...summaryScope,
        scope: ownedCase.scope,
      }),
    );
    expect(resolved.records).toHaveLength(1);
    expect(resolved.openDrafts).toHaveLength(1);
    expect(resolved.snapshot.treasuryCopper).toBe(5007);
    // The total writer confirmed one dice total against the 1d20 rule
    // specification; the record keeps exactly that form, with no dice key.
    expect(resolved.records[0]?.source.upkeep.rolls.check).toEqual({
      diceTotal: 20,
      diceCount: 1,
      sides: 20,
      provenance: { kind: 'table' },
      modifiers: [],
    });
    expect(resolved.openDrafts[0]?.upkeep.rolls.check).toBeUndefined();
    // The notice survives an ordinary save on the new week, stays
    // reachable on a phone beside the pinned chrome, and is dismissed
    // from inside itself.
    await die(second).fill('3');
    await expect(saveState(second)).toHaveAttribute(
      'data-week-feedback',
      'saved',
    );
    await expect(die(late)).toHaveValue('3');
    await expect(confirmedWeekNotice(second)).toHaveCount(1);
    await expect(
      confirmedWeekNotice(second).locator('[data-week-confirmed-transition]'),
    ).toHaveAttribute('data-week-confirmed-transition', secondTransition!);
    for (const [width, height] of [
      [390, 844],
      [844, 390],
      [1180, 820],
      [1440, 900],
    ] as const) {
      await second.setViewportSize({ width, height });
      await expectNoHorizontalOverflow(second);
      await expectBoundedWeekHost(second);
      await expectReachable(
        second,
        confirmedWeekNotice(second).getByRole('link', {
          name: 'Open in Finished weeks',
          exact: true,
        }),
      );
      await expectReachable(
        second,
        confirmedWeekNotice(second).getByRole('button', {
          name: 'Dismiss',
          exact: true,
        }),
      );
    }
    await second.setViewportSize({ width: 1194, height: 834 });
    await confirmedWeekNotice(second)
      .getByRole('button', { name: 'Dismiss', exact: true })
      .click();
    await expect(confirmedWeekNotice(second)).toBeEmpty();
    await expect(confirmedWeekNotice(late)).toHaveCount(1);
    await die(second).fill('');
    await expect(saveState(second)).toHaveAttribute(
      'data-week-feedback',
      'saved',
    );
    await expect(confirmedWeekNotice(second)).toBeEmpty();
    for (const page of [first, second, late]) {
      await summary(page);
      // The successor week starts from the externally corrected treasury.
      await expect(await resultCell(page, 'Treasury', 'Now')).toHaveText(
        '50.07 gp',
      );
    }
    await savePrivate(
      join(run.artifactDirectory, 'canonical-confirmation-successor.png'),
      await first.screenshot({ fullPage: true }),
    );
  } finally {
    for (const release of releases) release();
    await Promise.all([first.close(), second.close(), late.close()]);
  }
});

// The settlement/rank journey's fixture, on one page: its cards and repairs
// at phone and desktop sizes (#140). Its own case keeps that journey well
// under its limit.
test('settlement and rank cards and team repairs stay reachable on phone and desktop', async ({
  players,
  ownedCase,
}) => {
  test.setTimeout(60_000);
  const run = await loadRun();
  const { route } = await initialUpkeep(run, ownedCase, {
    choices: true,
    maximumNotoriety: true,
    missingTeam: true,
    rankGain: true,
  });
  await players.gm.goto(route);
  await reviewUpkeepChoiceLayout(players.gm, run);
});

// The Event blocks and Review & confirm at phone landscape and on the narrow
// tablet with the reference panel open and closed, and Review's warnings and
// recorded outcomes in place (#143, #145). Its own case keeps the Activity
// and Event journey and the persistent journey clear of their limits.
test('Event blocks and the week review stay reachable at phone landscape and on a narrow tablet', async ({
  players,
  ownedCase,
}) => {
  test.setTimeout(60_000);
  const run = await loadRun();
  const { route } = await initialUpkeep(run, ownedCase, { persistent: true });
  const gm = players.gm;
  await gm.goto(route);
  await test.step('an Invasion is recorded after an out-of-range chance roll', () =>
    prepareInvasion(gm));
  await test.step('the Event blocks fit phone landscape and the narrow tablet', () =>
    reviewEventLayout(gm, run.artifactDirectory));
  await test.step('Review lists the warning and the outcome in place at every size', () =>
    reviewSummaryLayout(gm, run.artifactDirectory));
});

// Activity checks #142 §6 names beyond the tablet journey, on their own
// case: the board, details and picker at phone landscape and 1180x820, a
// touch pan on the picker, an allowance lowered by another device's Militia
// correction, and a Confirmation arriving while the picker is open.
test('Activity fits landscape sizes, pans by touch and follows a correction and a Confirmation from another device', async ({
  players,
  ownedCase,
}) => {
  test.setTimeout(90_000);
  const run = await loadRun();
  const gm = players.gm,
    player = players.player;
  const gmTransport = await controlTransport(gm, run.fixture!.convexUrl);
  const scope = await test.step('seed the week and open Activity', async () => {
    const { key, route } = await initialUpkeep(run, ownedCase);
    await openActivity(gm, player, route);
    return key;
  });
  await test.step('a touch pan scrolls the picker and places nothing; a tap places', () =>
    panAndTapPicker(gm, player));
  await test.step('the board, details and picker fit phone landscape and 1180x820', () =>
    reviewActivityLandscapes(gm, run));
  await test.step("another device's Militia correction moves a slot beyond the allowance", () =>
    followAllowanceCorrections(gm, player, scope.campaignId));
  await test.step('a Confirmation locks the open picker and moves to the next week', () =>
    confirmWithOpenPicker(
      gm,
      player,
      gmTransport,
      run,
      ownedCase.scope,
      scope,
    ));
});

// The nearest-settlement touch pan and tap (#198), moved from the
// settlement/rank journey so it keeps its margin. Same fixture and rolls; a
// mouse chooses Phaendar and then misses the selection area with Misthome,
// which is where the pan began in that journey.
test('a finger pan over the settlement cards scrolls and chooses nothing, and a tap chooses', async ({
  players,
  ownedCase,
}) => {
  test.setTimeout(60_000);
  const run = await loadRun();
  // The settlement/rank journey's routed transport, where no edit is held.
  const network = await controlNextDraftEdit(
    players.gm,
    run.fixture!.convexUrl,
  );
  const gm = players.gm,
    player = players.player;
  try {
    await test.step('reach the nearest-settlement cards at maximum notoriety', async () => {
      const { route } = await initialUpkeep(run, ownedCase, {
        choices: true,
        maximumNotoriety: true,
        missingTeam: true,
        rankGain: true,
      });
      await Promise.all([gm.goto(route), player.goto(route)]);
      await expect(die(gm)).toBeVisible();
      await die(gm).fill('10');
      await expect(die(player)).toHaveValue('10');
      await training(gm).fill('3');
      await expect(training(player)).toHaveValue('3');
      await gm
        .getByRole('textbox', {
          name: 'Maximum-notoriety training roll',
          exact: true,
        })
        .fill('5');
      await gm
        .getByRole('textbox', { name: 'Notoriety Loyalty roll', exact: true })
        .fill('1');
      await expect(
        player.getByRole('textbox', {
          name: 'Notoriety Loyalty roll',
          exact: true,
        }),
      ).toHaveValue('1');
    });
    await test.step('a mouse chooses Phaendar and misses with Misthome', async () => {
      const settlementCards = gm.getByRole('group', {
        name: 'Nearest settlement',
        exact: true,
      });
      await settlementCards.scrollIntoViewIfNeeded();
      await settlementCards
        .getByRole('button', { name: 'Phaendar', exact: true })
        .click();
      const misthome = settlementCards.getByRole('button', {
        name: 'Misthome',
        exact: true,
      });
      const bounds = await misthome.boundingBox();
      expect(bounds).not.toBeNull();
      await gm.mouse.move(
        bounds!.x + bounds!.width / 2,
        bounds!.y + bounds!.height / 2,
      );
      await gm.mouse.down();
      await gm.mouse.move(5, 5, { steps: 12 });
      await gm.mouse.up();
      await expect(
        gm.getByText(
          'Place the card in the highlighted selection area. Your selection is unchanged.',
          { exact: true },
        ),
      ).toBeVisible();
    });
    await test.step('a finger pan scrolls and chooses nothing; taps choose', () =>
      panAndTapSettlementCards(gm, player, 'Phaendar', 'Misthome'));
  } finally {
    network.release();
  }
});

// Drill's notoriety and Training rolls show only when its check needs them,
// and at maximum rank it resolves with a reasoned exception (#198). Moved
// from the Activity-and-Event journey so it keeps its margin; that journey
// clears Drill before Confirmation, so its outcome never used these rolls.
test('Drill shows its notoriety and Training rolls only when its check needs them, with a maximum-rank exception', async ({
  players,
  ownedCase,
}) => {
  test.setTimeout(60_000);
  const run = await loadRun();
  const gm = players.gm,
    player = players.player;
  await test.step('seed the week and open Activity', async () => {
    const { route } = await initialUpkeep(run, ownedCase);
    await openActivity(gm, player, route);
  });
  await test.step('Drill shows each roll only when its check needs it', () =>
    exerciseDrillRolls(gm, player));
});

// The tablet Activity checks beside the recovered Scouts (#198), moved from
// the recovery journey so it keeps its margin. The fixture seeds the week
// that journey reaches in Upkeep: attrition rolls of 10 and 3, and the Scouts
// recovered at 15 gp instead of 20 gp with its reason. The checks clear every
// choice they stage, so that journey's Event and Confirmation never used them.
test('players stage, move and clear Activity choices for a recovered team and see a stale replacement rejected', async ({
  players,
  ownedCase,
}) => {
  test.setTimeout(90_000);
  const run = await loadRun();
  // The held edit for the stale replacement, installed before the first
  // navigation as in the recovery journey.
  const network = await controlNextDraftEdit(
    players.gm,
    run.fixture!.convexUrl,
  );
  const gm = players.gm,
    player = players.player;
  try {
    await test.step('open the week with the Scouts recovered at 15 gp', async () => {
      const { route } = await initialUpkeep(run, ownedCase, {
        choices: true,
        adjustedRecovery: true,
      });
      await Promise.all([gm.goto(route), player.goto(route)]);
      for (const page of [gm, player]) {
        const scouts = page.getByRole('group', {
          name: 'Scouts team condition',
          exact: true,
        });
        await expect(
          scouts.getByRole('button', { name: 'Recover', exact: true }),
        ).toHaveAttribute('aria-pressed', 'true');
        await expect(
          scouts.getByRole('textbox', {
            name: 'Scouts: Recovery cost (gp)',
            exact: true,
          }),
        ).toHaveValue('15');
      }
    });
    await test.step('Activity choices are staged, moved, cleared and replaced', () =>
      exerciseActivityWorkspace(gm, player, network, run.artifactDirectory));
  } finally {
    network.release();
  }
});
