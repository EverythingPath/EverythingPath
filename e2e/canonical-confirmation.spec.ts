import { verifyIndependentAuthorization } from './support/authorization-probes';
import { openCampaignSection } from './support/interactions';
import {
  showAllResultValues,
  summaryResult as historyResult,
} from './support/summary-result';
import { weeklyDraftDataSchema } from '../src/lib/weekly-draft-contract';
import { compoundAcceptanceFixture } from '../tests/rules/compound-acceptance-fixture';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { ConvexClient } from 'convex/browser';
import { draftKeySchema } from '../convex/lib/canonicalStorageValidators';
import { createConvexDraftTransport } from '../src/lib/convex-draft-persistence';
import { test, expect } from './support/fixtures';
import { canonicalPersistenceFixtureCall } from './support/process';
import { sanitizeLog } from './support/artifacts';
import { prepareContract } from './support/canonical-contract';
import {
  runConfirmationContract,
  type ConfirmationContractHarness,
} from '../tests/persistence/confirmation-contracts';
import { confirmationInspectionSchema } from '../src/lib/weekly-confirmation-contract';
import { historyPath } from '../src/lib/campaign-routes';
import type { Page } from '@playwright/test';
import type { z } from 'zod';
import { reviewFinishedWeeks } from './support/finished-weeks';

// The finished week's six sections, in rules order, then its Result row for
// one "Group · Label" fact (a table row from tablet width up).
const historySections = [
  '1 Upkeep',
  '2 Activity',
  '3 Event',
  '4 Persistent',
  'Table Adjustments',
  'Result',
];
const historyRow = (page: Page, label: string) =>
  historyResult(page).locator('tbody tr').filter({ hasText: label });
/** Value, At confirmation, Rules Baseline and Final of the treasury row. */
const recordedTreasury = [/^Militia · Treasury/, '1 gp', '0.8 gp', '0.87 gp'];

test.use({ caseKey: 'canonicalPersistence', comparisonCaseKey: 'isolation' });

test('shared Confirmation contract commits reviewed weeks in isolated Convex', async ({
  players,
  ownedCase,
  comparisonCase,
}) => {
  // 271 s of 300 s with one local worker (#729 run 1): 1.6× that, the slowdown
  // GitHub's 4-vCPU runner showed under parallel workers (#198).
  test.setTimeout(440_000);
  const { run, url, comparison, connect } = await prepareContract(
    players,
    comparisonCase!,
  );
  const first = connect(players.gm);
  const second = connect(players.player);
  const outsider = connect(players.outsider);
  const anonymous = new ConvexClient(url, { logger: false });
  try {
    let activeCampaign: string | undefined;
    let activeKey: z.infer<typeof draftKeySchema> | undefined;
    const confirmationHarness = async (
      verifyConfirmationAuthorization = false,
    ): Promise<ConfirmationContractHarness> => {
      const scope = draftKeySchema.parse(
        await canonicalPersistenceFixtureCall(run, 'resetAndInitialize', {
          scope: ownedCase.scope,
          now: 1_700_000_000_000,
          draftId: randomUUID(),
        }),
      );
      activeCampaign = scope.campaignId;
      activeKey = scope;
      const firstTransport = createConvexDraftTransport(first, scope);
      const inspect = async () =>
        confirmationInspectionSchema.parse(
          await canonicalPersistenceFixtureCall(run, 'inspect', {
            ...scope,
            scope: ownedCase.scope,
          }),
        );
      if (verifyConfirmationAuthorization) {
        await firstTransport.send({
          draftId: scope.draftId,
          operationId: randomUUID(),
          baseRevision: 0,
          edit: {
            kind: 'event_chance',
            roll: {
              diceTotal: 100,
              diceCount: 1,
              sides: 100,
              provenance: { kind: 'table' },
              modifiers: [],
            },
          },
        });
      }
      const before = await inspect();
      const preview = await firstTransport.preview();
      if (verifyConfirmationAuthorization) expect(preview.status).toBe('ready');
      await verifyIndependentAuthorization(
        [
          createConvexDraftTransport(outsider, scope),
          createConvexDraftTransport(anonymous, scope),
          createConvexDraftTransport(first, {
            ...scope,
            campaignId: comparison.campaignId,
          }),
        ].map((denied) => [
          () => expect(denied.preview()).rejects.toThrow(),
          ...(verifyConfirmationAuthorization
            ? [
                () =>
                  expect(
                    denied.confirm({
                      operationId: randomUUID(),
                      reviewed: preview.reviewed,
                    }),
                  ).rejects.toThrow(),
              ]
            : []),
        ]),
        async () => {
          expect(await inspect()).toEqual(before);
        },
      );
      return {
        first: firstTransport,
        second: createConvexDraftTransport(second, scope),
        inspect,
        changeSource: async (change) => {
          await canonicalPersistenceFixtureCall(run, 'changeSource', {
            ...scope,
            scope: ownedCase.scope,
            change,
          });
        },
        blockSuccessor: async (operationId) => {
          await canonicalPersistenceFixtureCall(run, 'blockSuccessor', {
            ...scope,
            scope: ownedCase.scope,
            operationId,
          });
        },
        dispose: async () => {
          // Authenticated connections belong to the whole contract run.
        },
      };
    };
    await runConfirmationContract(confirmationHarness);
    // One authored compound week exercises every stored ledger and retained reason.
    const compound = compoundAcceptanceFixture();
    const compoundKey = draftKeySchema.parse(
      await canonicalPersistenceFixtureCall(run, 'resetAndInitialize', {
        scope: ownedCase.scope,
        now: 1_700_000_000_000,
        draftId: compound.input.revision.draftId,
      }),
    );
    await canonicalPersistenceFixtureCall(run, 'installAcceptanceSource', {
      ...compoundKey,
      scope: ownedCase.scope,
      draft: weeklyDraftDataSchema.parse(compound.input.revision),
      snapshot: compound.input.militiaSnapshot,
    });
    const compoundTransport = createConvexDraftTransport(first, compoundKey);
    const compoundReview = await compoundTransport.preview();
    expect(compoundReview.status).toBe('ready');
    expect(compoundReview.outcome).toEqual(compound.expected);
    const compoundReceipt = await compoundTransport.confirm({
      operationId: randomUUID(),
      reviewed: compoundReview.reviewed,
    });
    const compoundStored = confirmationInspectionSchema.parse(
      await canonicalPersistenceFixtureCall(run, 'inspect', {
        ...compoundKey,
        scope: ownedCase.scope,
      }),
    );
    expect(compoundStored.snapshot).toEqual(compound.expected.militiaSnapshot);
    expect(compoundReceipt.record.source).toEqual(compound.input.revision);
    expect(compoundReceipt.record.sourceMilitiaSnapshot).toEqual(
      compound.input.militiaSnapshot,
    );
    expect(compoundReceipt.record.finalOutcome.data).toEqual(compound.expected);
    expect(compoundReceipt.record.finalPlan.data.before).toEqual(
      compound.before,
    );
    expect(compoundReceipt.record.finalPlan.data.after).toEqual(
      compound.expected,
    );
    expect(compoundReceipt.record.baselinePlan.data.after).toEqual(
      compoundReview.baseline,
    );
    expect(compoundReceipt.record.adjudication.tableAdjustments).toEqual(
      compound.input.revision.tableAdjustments,
    );
    expect(compoundReceipt.record.adjudication.rulesExceptions).toEqual(
      compound.input.revision.rulesExceptions,
    );
    expect(compoundStored.records).toEqual([compoundReceipt.record]);
    expect(compoundStored.openDrafts).toEqual([compoundReceipt.successor]);
    expect(compoundReceipt.successor.context).toEqual({
      ...compound.expected.context,
      persistentPhaseEligible: false,
    });
    const literal = await confirmationHarness(true);
    try {
      const initial = await literal.first.read();
      let revision = initial.revision;
      for (const edit of [
        {
          kind: 'stage' as const,
          slotId: 'left',
          choice: {
            choiceId: 'scout',
            actionId: 'special' as const,
            instruction: 'Scout road',
            costCopper: 20,
          },
        },
        {
          kind: 'acknowledge' as const,
          acknowledgement: {
            acknowledgementId: 'scout-result',
            subjectId: 'special:scout',
            outcome: 'Road safe',
          },
        },
        {
          kind: 'table_adjustments' as const,
          adjustments: [
            {
              kind: 'militia_value' as const,
              adjustmentId: 'reward',
              field: 'treasuryCopper' as const,
              operation: 'add' as const,
              value: 7,
              reason: 'Found seven copper',
            },
          ],
        },
      ]) {
        await literal.first.send({
          draftId: initial.draftId,
          operationId: randomUUID(),
          baseRevision: revision++,
          edit,
        });
      }
      const reviewed = await literal.second.preview();
      const reviewedDraft = await literal.second.read();
      expect(reviewed.status).toBe('ready');
      expect(reviewed.baseline?.militiaSnapshot.treasuryCopper).toBe(80);
      await literal.second.confirm({
        operationId: randomUUID(),
        reviewed: reviewed.reviewed,
      });
      const committed = await literal.inspect();
      expect(committed.snapshot).toEqual({
        rank: 1,
        training: 0,
        treasuryCopper: 87,
        notoriety: 0,
        focus: 'Loyalty',
        roster: { people: [], teams: [], officers: [] },
        characters: [],
        settlements: [],
        bonuses: [],
        eventBenefits: { skills: [], markets: [] },
      });
      expect(committed.source.status).toBe('closed');
      expect(committed.records).toHaveLength(1);
      expect(committed.openDrafts).toHaveLength(1);
      expect(committed.openDrafts[0]).toMatchObject({
        week: 2,
        revision: 0,
        context: {
          firstMilitiaWeek: false,
          startDay: 7,
          uneventfulCarry: false,
          carriedEvents: [],
          queuedEffects: [],
          orders: [],
          lastBuyoffWeek: null,
          operatedSettlementIds: [],
        },
        acknowledgements: [],
        rulesExceptions: [],
        tableAdjustments: [],
      });
      expect(
        committed.openDrafts[0]!.activity.slots.every(
          (slot) => slot.choice === null,
        ),
      ).toBe(true);
      const record = committed.records[0]!;
      expect(committed.snapshot).toEqual(reviewed.outcome?.militiaSnapshot);
      expect(record.source).toEqual(reviewedDraft.draft);
      expect(record.baselinePlan.data.after).toEqual(reviewed.baseline);
      expect(record.finalPlan.data.after).toEqual(reviewed.outcome);
      expect(record.finalOutcome.data).toEqual(reviewed.outcome);
      expect(record.successorContext).toEqual(reviewed.outcome?.context);
      expect(committed.openDrafts[0]!.context).toEqual({
        ...reviewed.outcome?.context,
        persistentPhaseEligible: false,
      });
      expect(record.adjudication.acknowledgements).toEqual(
        reviewedDraft.draft?.acknowledgements,
      );
      expect(record.sourceMilitiaSnapshot?.treasuryCopper).toBe(100);
      expect(record.source.activity.slots[0]?.choice).toMatchObject({
        choiceId: 'scout',
        instruction: 'Scout road',
        costCopper: 20,
      });
      expect(record.adjudication.tableAdjustments).toEqual([
        {
          kind: 'militia_value',
          adjustmentId: 'reward',
          field: 'treasuryCopper',
          operation: 'add',
          value: 7,
          reason: 'Found seven copper',
        },
      ]);
      expect(record.provenance).toBe('confirmation');
      expect(record.supersedesRecordId).toBeNull();
      const historyRoute = historyPath(activeCampaign!, { week: 1 });
      await Promise.all([
        players.gm.goto(historyRoute),
        players.player.goto(historyRoute),
        players.outsider.goto(historyRoute),
      ]);
      for (const page of [players.gm, players.player]) {
        await expect(page).toHaveURL(/\/campaigns\/[^/]+\/history\?week=1$/);
        await expect(
          page.getByRole('heading', { level: 1, name: 'Week 1', exact: true }),
        ).toBeVisible();
        // At confirmation, Rules Baseline and copper-exact Final, with the
        // adjustment's difference stated in words as well as emphasis.
        await expect(
          historyRow(page, 'Militia · Treasury').locator('td'),
        ).toHaveText(recordedTreasury);
        await expect(historyRow(page, 'Militia · Treasury')).toContainText(
          'Table Adjustments change the Rules Baseline 0.8 gp to 0.87 gp.',
        );
        const adjustments = page.getByRole('region', {
          name: 'Table Adjustments',
          exact: true,
        });
        await expect(adjustments).toContainText('Treasury +0.07 gp');
        await expect(adjustments).toContainText('Found seven copper');
        await expect(page.getByRole('textbox')).toHaveCount(0);
        await expect(
          page.getByRole('button', { name: 'Confirm week', exact: true }),
        ).toHaveCount(0);
      }
      await expect(
        players.gm.getByText(
          "Read-only. Recorded when the week was confirmed. Corrections to a finished week aren't available yet.",
        ),
      ).toBeVisible();
      await expect(
        players.player.getByText(
          "Read-only. Recorded when the week was confirmed. Corrections to a finished week aren't available yet.",
        ),
      ).toBeVisible();
      await expect(
        players.outsider.getByRole('heading', {
          level: 1,
          name: 'Week 1',
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(players.outsider.getByRole('main')).toContainText(
        "This campaign isn't available",
      );
      await players.player.screenshot({
        path: join(run.artifactDirectory, 'canonical-history-tablet.png'),
        fullPage: true,
      });
      const sectionOrder = await players.player
        .locator('section[aria-label]')
        .evaluateAll((sections) =>
          sections.map((section) => section.getAttribute('aria-label')),
        );
      expect(
        sectionOrder.filter(
          (label) => label !== null && historySections.includes(label),
        ),
      ).toEqual(historySections);
      // Show all values adds the recorded context to the changed facts.
      await showAllResultValues(players.player);
      await expect(
        historyRow(players.player, 'Next week · Start day')
          .locator('td')
          .last(),
      ).toHaveText('7');
      await expect(historyResult(players.player)).toContainText(
        'Skip first Upkeep',
      );
      await historyResult(players.player).scrollIntoViewIfNeeded();
      await players.player.screenshot({
        path: join(run.artifactDirectory, 'canonical-history-all-tablet.png'),
      });
      // Phone: the Result stacks each value with its column label.
      await players.player.setViewportSize({ width: 390, height: 844 });
      expect(
        await players.player.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await expect(
        historyResult(players.player).getByRole('table'),
      ).toBeHidden();
      await expect(
        historyResult(players.player)
          .getByRole('listitem')
          .filter({ hasText: 'Militia · Treasury' }),
      ).toContainText(/Final\s*0\.87 gp/);
      await players.player.screenshot({
        path: join(run.artifactDirectory, 'canonical-history-phone.png'),
      });
      await players.player.setViewportSize({ width: 1440, height: 900 });
      expect(
        await players.player.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await players.player.screenshot({
        path: join(run.artifactDirectory, 'canonical-history-desktop.png'),
      });
      await players.player.setViewportSize({ width: 1194, height: 834 });
      await literal.changeSource('treasury');
      await expect
        .poll(async () => (await literal.inspect()).snapshot.treasuryCopper)
        .toBe(94);
      await players.player.reload();
      // Today's treasury changed; the finished week's facts did not.
      await expect(
        historyRow(players.player, 'Militia · Treasury').locator('td'),
      ).toHaveText(recordedTreasury);
      await expect(historyResult(players.player)).not.toContainText('0.94 gp');
      // A single-entry week has no entries list; a direct record link still
      // selects that immutable record and survives reload.
      await players.gm.goto(
        `${players.gm.url()}&recordId=${encodeURIComponent(record.recordId)}`,
      );
      await expect
        .poll(() => new URL(players.gm.url()).searchParams.get('recordId'))
        .toBe(record.recordId);
      const selectedHistory = players.gm.url();
      await players.gm.reload();
      await expect(players.gm).toHaveURL(selectedHistory);
      await expect(
        players.gm.getByRole('heading', {
          level: 1,
          name: 'Week 1',
          exact: true,
        }),
      ).toBeVisible();
      await expect(players.gm.getByText(/Earlier entry/)).toHaveCount(0);
      // The latest row replaces the old Latest finished week button.
      await players.gm
        .getByRole('navigation', { name: 'Finished weeks' })
        .getByRole('link', { name: /^Week 1\b/ })
        .click();
      await expect
        .poll(() => new URL(players.gm.url()).searchParams.has('recordId'))
        .toBe(false);
      await expect(
        players.gm
          .getByRole('navigation', { name: 'Finished weeks' })
          .getByRole('link', { name: /^Week 1\b/ }),
      ).toHaveAttribute('aria-current', 'page');
      await players.gm.goBack();
      await expect(players.gm).toHaveURL(selectedHistory);
      await expect(
        players.gm.getByRole('heading', {
          level: 1,
          name: 'Week 1',
          exact: true,
        }),
      ).toBeVisible();
      await players.gm.goForward();
      await expect
        .poll(() => new URL(players.gm.url()).searchParams.has('recordId'))
        .toBe(false);
      await expect(
        players.gm.getByRole('heading', {
          level: 1,
          name: 'Week 1',
          exact: true,
        }),
      ).toBeVisible();
      await players.player
        .getByRole('link', { name: 'Return to current week' })
        .click();
      await expect(
        players.player.getByRole('heading', { name: 'Week 2 · Upkeep' }),
      ).toBeVisible();
      await expect(
        players.gm.getByRole('heading', {
          level: 1,
          name: 'Week 1',
          exact: true,
        }),
      ).toBeVisible();
      await openCampaignSection(players.player, 'history');
      await expect(
        historyRow(players.player, 'Militia · Treasury'),
      ).toContainText('0.87 gp');
      // More history than one entry (#146): week 1 gains six corrections,
      // and week 3 (past the open week 2) a reconstruction.
      await canonicalPersistenceFixtureCall(run, 'appendHistory', {
        ...activeKey!,
        scope: ownedCase.scope,
        corrections: 6,
        reconstructWeek: 3,
      });
      await reviewFinishedWeeks(
        players.player,
        record.recordId,
        run.artifactDirectory,
      );
    } finally {
      await literal.dispose();
    }
  } catch (error) {
    throw new Error(
      `Isolated authenticated Confirmation contract: ${sanitizeLog(
        error instanceof Error ? error.message : 'Verification failed',
      )}`,
    );
  } finally {
    await Promise.all([
      first.close(),
      second.close(),
      outsider.close(),
      anonymous.close(),
    ]);
  }
});
