import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ConvexClient } from 'convex/browser';
import { expect, type Page } from '@playwright/test';
import type { z } from 'zod';
import type { draftKeySchema } from '../../convex/lib/canonicalStorageValidators';
import type { WeeklyDraftEdit } from '../../src/lib/weekly-draft-contract';
import type { RawRoll } from '../../src/lib/weekly-draft-facts';
import { createConvexDraftTransport } from '../../src/lib/convex-draft-persistence';
import { savePrivate, type Run } from './process';
import {
  expectBoundedWeekHost,
  expectNoHorizontalOverflow,
  expectReachable,
} from './responsive-shell';
import { reviewConfirm, saveState } from './week-frame';

type DraftKey = z.infer<typeof draftKeySchema>;
// A recorded dice total, sent through the ordinary authenticated edit so the
// scenario can record values (an out-of-range total, a total for another
// specification) that the pages then have to read honestly.
function total(sides: number, diceCount: number, diceTotal: number): RawRoll {
  return {
    sides,
    diceCount,
    diceTotal,
    provenance: { kind: 'table' },
    modifiers: [],
  };
}
export type ConnectablePage = Pick<Page, 'waitForFunction' | 'evaluate'>;
export type AuthenticatedClient = Pick<ConvexClient, 'setAuth'>;
// Wait for the page's Clerk session BEFORE configuring the client: `setAuth`
// requests a token immediately, and a still-loading page answers null, so
// the client would authenticate as nobody (same ordering as
// `prepareContract`). Provider logs may contain authentication payloads;
// keep them out of the harness report.
export async function connectAs(
  page: ConnectablePage,
  convexUrl: string,
): Promise<ConvexClient>;
export async function connectAs<Client extends AuthenticatedClient>(
  page: ConnectablePage,
  convexUrl: string,
  createClient: (url: string) => Client,
): Promise<Client>;
export async function connectAs(
  page: ConnectablePage,
  convexUrl: string,
  createClient: (url: string) => AuthenticatedClient = (url) =>
    new ConvexClient(url, { logger: false }),
): Promise<AuthenticatedClient> {
  await page.waitForFunction(() => Boolean(window.Clerk?.session));
  const client = createClient(convexUrl);
  client.setAuth(async ({ forceRefreshToken }) =>
    page.evaluate(
      async (skipCache) =>
        (await window.Clerk.session?.getToken({
          template: 'convex',
          skipCache,
        })) ?? null,
      forceRefreshToken,
    ),
  );
  return client;
}

// Recorded dice totals (#154, #155), run inside an existing fresh Upkeep
// session (both pages already open on the week): the Upkeep, Event and Summary
// pages must read an incoming total as recorded data, never as blank required
// dice, advise on a total outside its usual range, keep readiness honest for
// a total that does not match the required specification, and let a player
// clear it through the whole-roll edit before re-entering a total. The
// original week inputs are restored through ordinary edits so the caller's
// own journey continues with unchanged semantics.
export async function exerciseRollCompatibility(
  first: Page,
  second: Page,
  run: Run,
  key: DraftKey,
  observers: Page[] = [],
) {
  const phase = (page: Page, name: string) =>
    page.getByRole('button', { name, exact: true }).click();
  const field = (page: Page, name: string) =>
    page.getByRole('textbox', { name, exact: true });
  const heading = (page: Page) =>
    page.getByRole('heading', { name: 'Week 4 · Upkeep', exact: true });
  const client = await connectAs(second, run.fixture!.convexUrl);
  const transport = createConvexDraftTransport(client, key);
  async function record(
    edit: Extract<
      WeeklyDraftEdit,
      { kind: 'upkeep_roll' | 'event_chance' | 'upkeep' }
    >,
  ) {
    const observed = await transport.read();
    await transport.send({
      draftId: key.draftId,
      operationId: randomUUID(),
      baseRevision: observed.revision,
      edit,
    });
  }
  try {
    for (const page of [first, second])
      await expect(heading(page)).toBeVisible();
    const original = (await transport.read()).draft;
    expect(original?.draftId).toBe(key.draftId);
    // Another client records totals through the ordinary authenticated edit
    // while both devices watch: a zero d20 check (fails DC 10 with its
    // warning), the failure branch's complete 2d4 training total and a
    // percentile chance total that produces no event.
    await record({
      kind: 'upkeep_roll',
      field: 'check',
      roll: total(20, 1, 0),
    });
    await record({
      kind: 'upkeep_roll',
      field: 'training',
      roll: total(4, 2, 7),
    });
    await record({ kind: 'event_chance', roll: total(100, 1, 100) });
    // The incoming totals survive a full reload as recorded data.
    await first.reload();
    for (const page of [first, second]) {
      await expect(heading(page)).toBeVisible();
      // Recorded totals show in the single total field; nothing per die.
      await expect(field(page, 'Attrition Loyalty roll')).toHaveValue('0');
      await expect(field(page, 'Attrition training roll')).toHaveValue('7');
      await expect(
        page.getByText('2d4 · total of the dice only'),
      ).toBeVisible();
      await expect(page.getByRole('textbox', { name: /die/ })).toHaveCount(0);
      await expect(
        page
          .getByRole('main')
          .getByRole('alert')
          .filter({ hasText: 'A value is required.' }),
      ).toHaveCount(0);
      // One range advisory under the field; the step's notes do not repeat
      // it. Review & confirm below still lists the warning.
      const attrition = page.getByRole('region', {
        name: 'Training attrition',
        exact: true,
      });
      await expect(
        attrition.getByText(
          'The usual range is 1–20. Your entered total is retained for the table.',
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        attrition.getByText(/outside the usual 1–20 range/),
      ).toHaveCount(0);
      // The calculated check still resolves from the recorded total.
      await expect(attrition).toContainText(/bonus [+−]\d+ = total \d+/);
    }
    await phase(first, 'Event');
    await expect(field(first, 'Event chance roll')).toHaveValue('100');
    await expect(
      first.getByText('1d100 · total of the dice only').first(),
    ).toBeVisible();
    await phase(first, 'Review & confirm');
    await expect(reviewConfirm(first)).toBeEnabled();
    await expect(first.getByRole('main')).toContainText(
      /outside its usual range/,
    );
    await phase(first, 'Upkeep');

    // A total for another specification arrives: the pages show what was
    // recorded and what the step needs, and readiness becomes honest again.
    await record({
      kind: 'upkeep_roll',
      field: 'training',
      roll: total(6, 1, 5),
    });
    for (const page of [first, second]) {
      await expect(field(page, 'Attrition training roll')).toHaveValue('');
      await expect(
        page.getByText(
          /Recorded total 5 was entered for 1d6, but this step needs 2d4/,
        ),
      ).toBeVisible();
    }
    await phase(second, 'Review & confirm');
    await expect(reviewConfirm(second)).toBeDisabled();
    await expect(
      second
        .getByRole('region', { name: 'Required decisions', exact: true })
        .getByText('Upkeep: Enter the attrition training roll (2d4).'),
    ).toBeVisible();
    await phase(second, 'Upkeep');

    // Deliberate clear through the existing nullable edit, then re-entry as
    // one dice total; the untouched check total is preserved.
    await first
      .getByRole('button', {
        name: 'Clear attrition training roll',
        exact: true,
      })
      .click();
    await expect(saveState(first)).toHaveAttribute(
      'data-week-feedback',
      'saved',
    );
    for (const page of [first, second]) {
      await expect(field(page, 'Attrition training roll')).toHaveValue('');
      await expect(
        page.getByText(/Recorded total 5 was entered for 1d6/),
      ).toHaveCount(0);
    }
    // Deliberate re-entry writes one 2d4 total; the other device mirrors it.
    await field(first, 'Attrition training roll').fill('7');
    await expect(field(second, 'Attrition training roll')).toHaveValue('7');
    await expect(saveState(first)).toHaveAttribute(
      'data-week-feedback',
      'saved',
    );
    await expect(field(second, 'Attrition Loyalty roll')).toHaveValue('0');
    await phase(second, 'Review & confirm');
    await expect(reviewConfirm(second)).toBeEnabled();
    await phase(second, 'Upkeep');
    // The other device shows the re-entered total beside the untouched
    // recorded totals; storage-shape equality belongs to the persistence
    // contract suite, so the browser asserts only rendered outcomes.
    await expect(field(second, 'Attrition training roll')).toHaveValue('7');
    await phase(second, 'Event');
    await expect(field(second, 'Event chance roll')).toHaveValue('100');
    await phase(second, 'Upkeep');

    // The recorded-total presentation fits every target viewport with the
    // reference panel open and closed where it exists.
    for (const [name, width, height] of [
      ['phone', 390, 844],
      ['phone-landscape', 844, 390],
      ['tablet', 1180, 820],
      ['desktop', 1440, 900],
    ] as const) {
      await first.setViewportSize({ width, height });
      await expect(heading(first)).toBeVisible();
      await expectNoHorizontalOverflow(first);
      await expectBoundedWeekHost(first);
      await expectReachable(first, field(first, 'Attrition Loyalty roll'));
      if (width >= 1024) {
        await first
          .getByRole('button', { name: 'Hide reference panel' })
          .click();
        await expectNoHorizontalOverflow(first);
        await expectBoundedWeekHost(first);
        await first
          .getByRole('button', { name: 'Show reference panel' })
          .click();
      }
      await savePrivate(
        join(run.artifactDirectory, `canonical-roll-total-${name}.png`),
        await first.screenshot({ fullPage: true }),
      );
    }
    await first.setViewportSize({ width: 1194, height: 834 });

    // Restore the week's original inputs through ordinary edits so the
    // caller's journey continues exactly as before.
    await record({ kind: 'upkeep', inputs: original!.upkeep });
    await record({
      kind: 'event_chance',
      roll: original!.event.chanceRoll ?? null,
    });
    const originalCheck = original!.upkeep.rolls.check;
    const originalCheckTotal = originalCheck
      ? String(originalCheck.diceTotal)
      : '';
    const originalChance = original!.event.chanceRoll;
    const originalChanceTotal = originalChance
      ? String(originalChance.diceTotal)
      : '';
    // Every page shows the original inputs again in the same total fields,
    // and the event chance field carries the original recorded value.
    for (const page of [first, second, ...observers]) {
      await expect(field(page, 'Attrition Loyalty roll')).toHaveValue(
        originalCheckTotal,
      );
      await expect(page.getByText(/Recorded total/)).toHaveCount(0);
      await phase(page, 'Event');
      await expect(field(page, 'Event chance roll')).toHaveValue(
        originalChanceTotal,
      );
      await phase(page, 'Upkeep');
      await expect(heading(page)).toBeVisible();
    }
  } finally {
    await client.close();
  }
}
