import { expect, type Page } from '@playwright/test';
import { test } from './support/fixtures';
import { loadCommittedLegalPageData } from './support/legal-notices';
import { loadRun } from './support/process';
import { expectNoHorizontalOverflow } from './support/responsive-shell';

// The public legal page against the grown Section 15 Registry (#294, #348).
// The preview has no active Catalog Release, so the page shows the committed
// notice inputs; the expected sections, notices and their verbatim texts are
// computed from those same inputs, so the journey follows the Registry as it
// grows. A member reaches it from the app's footer, and anyone reads it
// signed out, at phone, tablet and desktop widths.

const phone = { width: 390, height: 844 };
const tablet = { width: 1024, height: 768 };
const desktop = { width: 1440, height: 900 };

type LegalData = ReturnType<typeof loadCommittedLegalPageData>;

async function expectNotices({ page, data }: { page: Page; data: LegalData }) {
  const main = page.getByRole('main');
  await expect(
    main.getByRole('heading', { level: 1, name: data.title, exact: true }),
  ).toBeVisible();
  const links = main
    .getByRole('navigation', { name: 'Legal sections', exact: true })
    .getByRole('link');
  await expect(links).toHaveText([
    ...data.sections.map((section) => section.title),
    ...(data.outstandingNotices.length ? ['Outstanding notices'] : []),
  ]);
  for (const section of data.sections) {
    const region = main.getByRole('region', {
      name: section.title,
      exact: true,
    });
    await expect(region).toBeVisible();
    // A notice titled like its section shows no heading of its own.
    await expect(region.getByRole('heading', { level: 3 })).toHaveText(
      section.notices
        .filter((notice) => notice.title !== section.title)
        .map((notice) => notice.title),
    );
    // Each notice's body is its text verbatim, with its line breaks, then
    // the section's notes.
    const bodies = region.getByRole('paragraph');
    const expectedBodies = [
      ...section.notices.map((notice) => notice.text),
      ...section.notes,
    ];
    await expect(bodies).toHaveText(expectedBodies);
    expect(await bodies.allTextContents()).toEqual(expectedBodies);
  }
}

test.use({ caseKey: 'legalNotices', viewport: tablet });
test('anyone reads the legal notices of the committed Registry, from the app footer or signed out, at every width', async ({
  browser,
  players,
  ownedCase,
}) => {
  test.setTimeout(120_000);
  const data = loadCommittedLegalPageData();
  const section15 = data.sections.find(({ id }) => id === 'section15');
  expect(section15?.notices.length).toBeGreaterThan(0);
  const member = players.player;

  await test.step('a member follows Legal notices from the campaign’s footer', async () => {
    await member.goto(`/campaigns/${ownedCase.campaignId}/characters`);
    await expect(
      member.getByRole('heading', { level: 1, name: 'Characters' }),
    ).toBeVisible();
    await member
      .getByRole('link', { name: 'Legal notices', exact: true })
      .first()
      .click();
    await expect(member).toHaveURL(/\/legal$/);
    await expectNotices({ page: member, data });
  });

  await test.step('the section links reach their notices without overflow at phone, tablet and desktop', async () => {
    for (const size of [phone, tablet, desktop]) {
      await member.setViewportSize(size);
      await member.goto('/legal');
      await expect(
        member.getByRole('heading', { level: 1, name: data.title }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(member);
      await member
        .getByRole('navigation', { name: 'Legal sections', exact: true })
        .getByRole('link', { name: section15!.title, exact: true })
        .click();
      await expect(member).toHaveURL(/\/legal#section15$/);
      await expect(
        member
          .getByRole('region', { name: section15!.title, exact: true })
          .getByRole('heading', { level: 2 }),
      ).toBeInViewport();
      await expectNoHorizontalOverflow(member);
    }
    await member.setViewportSize(tablet);
  });

  await test.step('a visitor who is not signed in reads the same notices', async () => {
    const run = await loadRun();
    const visitor = await browser.newContext({
      baseURL: run.baseURL,
      viewport: phone,
    });
    try {
      const page = await visitor.newPage();
      await page.goto('/legal');
      await expect(page).toHaveURL(/\/legal$/);
      await expectNotices({ page, data });
      await expectNoHorizontalOverflow(page);
    } finally {
      await visitor.close();
    }
  });
});
