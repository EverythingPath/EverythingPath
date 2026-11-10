import { join } from 'node:path';
import { expect, type Page, type Locator } from '@playwright/test';
import { measureVisibleControls } from './control-geometry';
import { savePrivate } from './process';
import { expectNoHorizontalOverflow } from './responsive-shell';
import {
  expectPinnedConfirm,
  expectStripValuesWhole,
  reviewConfirm,
  saveState,
} from './week-frame';
import {
  resultCell,
  showAllResultValues,
  summaryResult,
} from './summary-result';

const region = (page: Page) =>
  page.getByRole('region', { name: 'Table Adjustments', exact: true });
const button = (scope: Locator, name: string) =>
  scope.getByRole('button', { name, exact: true });
async function openSummary(page: Page) {
  await page
    .getByRole('button', { name: 'Review & confirm', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Review the week', exact: true }),
  ).toBeVisible();
}
async function start(page: Page, kind: string) {
  await region(page)
    .getByRole('group', { name: 'New Table Adjustment', exact: true })
    .getByRole('button', { name: kind, exact: true })
    .click();
  return region(page).getByRole('form', {
    name: `New ${kind} adjustment`,
    exact: true,
  });
}
const adjustmentReason = (page: Page, number?: number) =>
  region(page).getByRole('textbox', {
    name: number ? `Reason for adjustment ${number}` : /^Reason for adjustment/,
  });
async function save(page: Page, peer: Page, form: Locator, reason: string) {
  await form.getByRole('textbox', { name: 'Reason', exact: true }).fill(reason);
  await button(form, 'Save adjustment').click();
  await expect(form).toHaveCount(0);
  await expect(adjustmentReason(peer).last()).toHaveValue(reason);
  await expect(saveState(page)).toHaveAttribute('data-week-feedback', 'saved');
}
const confirmButton = (page: Page) => reviewConfirm(page);
const requiredDecisions = (page: Page) =>
  page.getByRole('region', { name: 'Required decisions', exact: true });
/**
 * A cleared reason is local: amber with its error and a local Required
 * decision on this device only, nothing sent, and Cancel restores it.
 */
async function clearReasonLocally(page: Page, peer: Page) {
  const reason = adjustmentReason(page, 1);
  const saved = await reason.inputValue();
  await reason.fill('');
  await expect(reason).toHaveAttribute('aria-invalid', 'true');
  await expect(requiredDecisions(page)).toContainText(
    /Table Adjustment 1 “.+” needs a reason\./,
  );
  await expect(confirmButton(page)).toBeDisabled();
  await expect(
    page
      .getByText('Save or cancel your unsaved change first.')
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await requiredDecisions(page)
    .getByRole('button', { name: 'Go to form', exact: true })
    .click();
  await expect(reason).toBeFocused();
  await expect(adjustmentReason(peer, 1)).toHaveValue(saved);
  await expect(
    requiredDecisions(peer).getByText(/needs a reason\./),
  ).toHaveCount(0);
  await button(region(page), 'Cancel changes to adjustment 1').click();
  await expect(reason).toHaveValue(saved);
  await expect(page.getByText(/needs a reason\./)).toHaveCount(0);
}
async function choose(form: Locator, field: string, value: string) {
  await form
    .getByRole('group', { name: field, exact: true })
    .getByRole('button', { name: value, exact: true })
    .click();
}
const sectionLabels = [
  '1 Upkeep',
  '2 Activity',
  '3 Event',
  '4 Persistent',
  'Table Adjustments',
  'Result',
];
/** Four expanded phase sections, then Table Adjustments and Result, in order. */
async function expectSixSections(page: Page) {
  for (const name of sectionLabels) {
    const section = page.getByRole('region', { name, exact: true });
    await expect(section).toBeVisible();
    // Expanded: no collapsed disclosure hides a consequence.
    await expect(section.locator('details')).toHaveCount(0);
  }
  const order = await page
    .locator('section[aria-label]')
    .evaluateAll((sections) =>
      sections.map((section) => section.getAttribute('aria-label')),
    );
  expect(order.filter((label) => sectionLabels.includes(label!))).toEqual(
    sectionLabels,
  );
}

// Show all values lists every militia, roster, officer and next-week fact
// beside the changed ones.
async function openOutcomes(page: Page) {
  await showAllResultValues(page);
  const result = summaryResult(page);
  await expect(result).toContainText('Next week');
  await expect(result).toContainText('Roster');
  await expect(result).toContainText('Officers');
}

/** Real controls, all outcome disclosures, and responsive layout on the owned persistent fixture. */
export async function reviewSummaryWorkspace(
  page: Page,
  peer: Page,
  artifactDirectory: string,
) {
  await Promise.all([openSummary(page), openSummary(peer)]);
  await expectSixSections(page);
  // The carried event's consequence belongs to Persistent, not Event.
  await expect(
    page.getByRole('region', { name: '4 Persistent', exact: true }),
  ).toContainText('Theft · Event 1');
  await expect(
    page.getByRole('region', { name: '3 Event', exact: true }),
  ).not.toContainText('Theft · Event 1');
  const baselineViewport = page.viewportSize() ?? { width: 1194, height: 834 };
  const baseline = await summaryResult(page).innerText();
  let form = await start(page, 'Militia value');
  await expect(button(form, 'Treasury')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await button(form, 'Save adjustment').click();
  await expect(form.getByRole('alert')).not.toHaveCount(0);
  await expect(region(peer).locator('article')).toHaveCount(0);
  await choose(form, 'Operation', 'Set to');
  await form.getByRole('textbox', { name: 'Amount', exact: true }).fill('500');
  await save(
    page,
    peer,
    form,
    'The table sets the treasury after the rules calculation.',
  );
  form = await start(page, 'Militia value');
  // Exact signed gp: −0.07 gp is −7 copper.
  await form
    .getByRole('textbox', { name: 'Amount', exact: true })
    .fill('-0.07');
  await save(page, peer, form, 'Seven copper paid for local supplies.');
  await clearReasonLocally(page, peer);
  // Order matters: set 500 gp then −0.07 gp, or −0.07 gp then set 500 gp.
  await expect(await resultCell(page, 'Treasury', 'Final')).toHaveText(
    '499.93 gp',
  );
  await button(region(page), 'Move adjustment 2 earlier').click();
  await expect(await resultCell(peer, 'Treasury', 'Final')).toHaveText(
    '500 gp',
  );
  await button(region(page), 'Move adjustment 1 later').click();
  await expect(await resultCell(peer, 'Treasury', 'Final')).toHaveText(
    '499.93 gp',
  );
  form = await start(page, 'Team condition');
  await choose(form, 'Team', 'Scouts');
  await choose(form, 'Condition', 'Disabled');
  await save(page, peer, form, 'Scouts rest after a narrative encounter.');
  form = await start(page, 'End persistent event');
  await choose(form, 'Event', 'Theft · Event 1');
  await save(page, peer, form, 'The thieves have left the region.');
  await expect(region(peer).locator('article')).toHaveCount(4);
  // Applying an adjustment is the table's decision, shown by its reason: it
  // is never repeated as a warning under the row, in Warnings or This phase.
  for (const player of [page, peer])
    await expect(player.getByText(/(?<!New )Table Adjustment: /)).toHaveCount(
      0,
    );
  await openOutcomes(page);
  const final = summaryResult(page);
  await expect(await resultCell(page, 'Scouts', 'Final', 'Teams')).toHaveText(
    'Disabled',
  );
  await expect(final).not.toContainText('theft-old');
  await expect(final).not.toContainText('persistent-team-');
  for (const [name, width, height] of [
    ['tablet', 1194, 834],
    ['phone', 390, 844],
    ['desktop', 1440, 900],
  ] as const) {
    await page.setViewportSize({ width, height });
    if (name !== 'phone')
      await expect(summaryResult(page).getByRole('table')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    // Down at the four adjustments, Confirm week is still at hand.
    await expectPinnedConfirm(page);
    // Beside the strip's compact Confirm, Training and Treasury stay whole.
    if (name === 'phone') await expectStripValuesWhole(page);
    for (const control of await measureVisibleControls(
      page.locator('main button, main input'),
      name,
    )) {
      const { bounds } = control;
      const label = control.ariaLabel ?? control.text;
      expect(bounds, `${name}: ${label}`).not.toBeNull();
      expect(bounds!.x, `${name}: ${label}`).toBeGreaterThanOrEqual(0);
      expect(
        bounds!.x + bounds!.width,
        `${name}: ${label}`,
      ).toBeLessThanOrEqual(width);
      if (control.tag === 'BUTTON')
        expect(control.contentFits, `${name}: ${label} text fits`).toBe(true);
    }
    const splitWords = await region(page)
      .locator('button')
      .evaluateAll((buttons) => {
        const split: string[] = [];
        for (const button of buttons) {
          const group = button
            .closest('[role="group"]')
            ?.getAttribute('aria-label');
          if (
            group &&
            ![
              'Field',
              'Operation',
              'Condition',
              'New Table Adjustment',
            ].includes(group)
          )
            continue;
          const walker = document.createTreeWalker(
            button,
            NodeFilter.SHOW_TEXT,
          );
          let node = walker.nextNode();
          while (node) {
            for (const match of (node.textContent ?? '').matchAll(/\S+/g)) {
              const range = document.createRange();
              range.setStart(node, match.index);
              range.setEnd(node, match.index + match[0].length);
              if (range.getClientRects().length > 1) split.push(match[0]);
            }
            node = walker.nextNode();
          }
        }
        return split;
      });
    expect(
      splitWords,
      `${name}: adjustment cards keep individual words readable`,
    ).toEqual([]);
    await expect(region(page)).not.toContainText('TreasuryCopper');
    await savePrivate(
      join(artifactDirectory, `reviewer-summary-${name}.png`),
      await page.screenshot({ fullPage: true }),
    );
  }
  for (let count = 4; count > 0; count--) {
    await button(region(page), `Remove adjustment ${count}`).click();
    await expect(region(peer).locator('article')).toHaveCount(count - 1);
  }
  await expect(saveState(page)).toHaveAttribute('data-week-feedback', 'saved');
  // Compare the displayed pre-adjustment Result with the restored one, back
  // on the default changed-only presentation.
  await showAllResultValues(page, false);
  await page.setViewportSize(baselineViewport);
  await expect(final).toHaveText(baseline, { useInnerText: true });
}

/** Settlement variant uses the owned fixture that actually contains settlements. */
export async function reviewSummarySettlement(page: Page, peer: Page) {
  await Promise.all([openSummary(page), openSummary(peer)]);
  const count = await region(page).locator('article').count();
  const form = await start(page, 'Settlement reputation');
  await choose(form, 'Settlement', 'Phaendar');
  await choose(form, 'Reputation', 'Friendly');
  await save(
    page,
    peer,
    form,
    'The settlement welcomed the militia after a table ruling.',
  );
  const final = await resultCell(peer, 'Phaendar', 'Final', 'Settlements');
  await expect(final).toHaveText('Friendly');
  await button(region(page), `Remove adjustment ${count + 1}`).click();
  await expect(region(peer).locator('article')).toHaveCount(count);
  await expect(final).not.toHaveText('Friendly');
}

/**
 * Review & confirm edits a Rules Exception's reason inline: a blank reason
 * stays local (never sent), and a saved one reaches the source phase on the
 * other device. Leaves `page` back on Persistent.
 */
export async function reviewSummaryExceptionReason(
  page: Page,
  peer: Page,
  peerReason: Locator,
) {
  await openSummary(page);
  const persistent = page.getByRole('region', {
    name: '4 Persistent',
    exact: true,
  });
  const reason = persistent.getByRole('textbox', {
    name: /^Reason for .+ exception$/,
  });
  const saved = await reason.inputValue();
  await reason.fill('');
  await expect(reason).toHaveAttribute('aria-invalid', 'true');
  await expect(requiredDecisions(page)).toContainText(
    /exception needs a reason\. Save one, cancel, or clear the exception\./,
  );
  await expect(peerReason).toHaveValue(saved);
  await reason.fill('Both buyoffs stand by table ruling.');
  await persistent.getByRole('button', { name: /^Save .+ reason$/ }).click();
  await expect(peerReason).toHaveValue('Both buyoffs stand by table ruling.');
  await expect(
    requiredDecisions(page).getByText(
      /exception needs a reason|save or cancel the new reason/,
    ),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Persistent', exact: true }).click();
}
