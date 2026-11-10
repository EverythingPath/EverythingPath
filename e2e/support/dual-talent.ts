import { expect, type Locator, type Page } from '@playwright/test';
import { test } from './fixtures';
import {
  expectControlsReachable,
  expectNoHorizontalOverflow,
} from './responsive-shell';
import type { controlSheetWrites } from './character-sheet-transport';

const incomplete = 'Choose two ability scores for these racial adjustments.';
const duplicate =
  'Choose two different ability scores for these racial adjustments.';
const humanAbility = '+2 to One Ability Score (Human)';

function getRaceRegion(page: Page) {
  return page
    .getByRole('main')
    .getByRole('region', { name: 'Race', exact: true });
}
function getTraitRow({
  page,
  name = 'Dual Talent',
}: {
  page: Page;
  name?: string;
}) {
  return getRaceRegion(page).getByRole('listitem', { name, exact: true });
}
function getAbilityChoice({ page, index }: { page: Page; index: 1 | 2 }) {
  return getTraitRow({ page }).getByRole('combobox', {
    name: `+2 ability score ${index}`,
    exact: true,
  });
}
function getAbilityControls(page: Page) {
  // Both selectors and their shared feedback live together. Replaced traits
  // below this row have their own controls and acknowledgements.
  return getAbilityChoice({ page, index: 1 }).locator('..');
}
async function chooseAbilityScore({
  page,
  control,
  value,
}: {
  page: Page;
  control: Locator;
  value: string;
}) {
  // Exercise the real Radix chooser with the keyboard, including its empty item.
  await control.focus();
  await control.press('Enter');
  const option = page.getByRole('option', { name: value, exact: true });
  await expect(option).toBeVisible();
  await option.press('Enter');
  await expect(control).toContainText(value);
  await expect(control).toBeEnabled();
}
async function expectChoices({
  pages,
  first,
  second,
}: {
  pages: Page[];
  first: string;
  second: string;
}) {
  for (const page of pages) {
    await expect(getAbilityChoice({ page, index: 1 })).toBeVisible();
    await expect(getAbilityChoice({ page, index: 2 })).toBeVisible();
    await expect(getAbilityChoice({ page, index: 1 })).toContainText(first);
    await expect(getAbilityChoice({ page, index: 2 })).toContainText(second);
  }
}
async function expectScores({
  pages,
  scores,
}: {
  pages: Page[];
  scores: readonly number[];
}) {
  const names = [
    'Strength',
    'Dexterity',
    'Constitution',
    'Intelligence',
    'Wisdom',
    'Charisma',
  ];
  for (const page of pages) {
    const block = page
      .getByRole('main')
      .getByRole('region', { name: 'Ability scores', exact: true });
    for (const [index, name] of names.entries()) {
      await expect(
        block.getByRole('textbox', { name, exact: true }),
      ).toHaveValue('10');
      await expect(
        block.getByRole('button', {
          name: `${name} ${scores[index]}, breakdown`,
          exact: true,
        }),
      ).toBeVisible();
    }
  }
}
async function expectContribution({
  page,
  ability,
  total,
  source,
}: {
  page: Page;
  ability: string;
  total: number;
  source: string;
}) {
  const button = page
    .getByRole('region', { name: 'Ability scores', exact: true })
    .getByRole('button', {
      name: `${ability} ${total}, breakdown`,
      exact: true,
    });
  await button.focus();
  await button.press('Enter');
  const breakdown = page.getByRole('group', {
    name: `${ability} breakdown`,
    exact: true,
  });
  // Literal base 10 plus exactly one racial +2. This also catches an accidental
  // retained Human bonus or duplicate contribution hidden behind a right total.
  const rows = breakdown.getByRole('listitem');
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: 'Base scores' })).toHaveText(
    'Base scores+10',
  );
  await expect(rows.filter({ hasText: source })).toHaveText(
    `${source}racial+2`,
  );
  await breakdown
    .getByRole('button', { name: 'Close breakdown', exact: true })
    .click();
}
async function expectAdvisory({
  pages,
  kind,
}: {
  pages: Page[];
  kind: 'incomplete' | 'duplicate' | 'none';
}) {
  for (const page of pages) {
    await expect(
      getTraitRow({ page }).getByText(incomplete, { exact: true }),
    ).toHaveCount(kind === 'incomplete' ? 1 : 0);
    await expect(
      getTraitRow({ page }).getByText(duplicate, { exact: true }),
    ).toHaveCount(kind === 'duplicate' ? 1 : 0);
    await expect(
      getAbilityControls(page).getByText(
        'Choose two different ability scores.',
        {
          exact: true,
        },
      ),
    ).toHaveCount(kind === 'duplicate' ? 1 : 0);
  }
}
async function selectHuman(page: Page) {
  const card = getRaceRegion(page).getByRole('radio', { name: /^Human / });
  await card.focus();
  await card.press('Space');
  await expect(card).toBeChecked();
  await expect(
    getRaceRegion(page).getByText('Race saved.', { exact: true }),
  ).toBeVisible();
}
async function setDualTalent({
  page,
  selected,
}: {
  page: Page;
  selected: boolean;
}) {
  const card = getRaceRegion(page).getByRole('checkbox', {
    name: 'Dual Talent selected',
    exact: true,
  });
  await expect(card).toBeChecked({ checked: !selected });
  await card.focus();
  await card.press('Space');
  await expect(card).toBeChecked({ checked: selected });
  await expect(
    getRaceRegion(page).getByText(
      selected ? 'Trait selected.' : 'Trait deselected.',
      {
        exact: true,
      },
    ),
  ).toBeVisible();
}
function getTraitHeading(page: Page) {
  return getTraitRow({ page })
    .getByRole('heading', { name: 'Dual Talent', exact: true })
    .locator('..');
}
async function expectInactiveDualTalent(page: Page) {
  await expect(
    getRaceRegion(page).getByRole('radio', { name: /^Human / }),
  ).toBeChecked();
  await expect(
    getRaceRegion(page).getByRole('checkbox', {
      name: 'Dual Talent selected',
      exact: true,
    }),
  ).not.toBeChecked();
  await expect(getTraitRow({ page })).toBeVisible();
  await expect(getTraitHeading(page)).toContainText('Off');
  await expect(
    getAbilityControls(page).getByText('Not counting now', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    getRaceRegion(page).getByRole('button', {
      name: /^Not counting now \(/,
    }),
  ).toHaveCount(0);
}
async function revealRaceDormantDualTalent(page: Page) {
  await expect(
    getRaceRegion(page).getByRole('radio', { name: 'No race', exact: true }),
  ).toBeChecked();
  const disclosure = getRaceRegion(page).getByRole('button', {
    name: /^Not counting now \(/,
  });
  await expect(disclosure).toBeVisible();
  if ((await disclosure.getAttribute('aria-expanded')) === 'false')
    await disclosure.click();
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  await expect(getTraitRow({ page })).toBeVisible();
  await expect(getTraitHeading(page)).toContainText('Not counting now');
}
async function expectSkillBudget({
  pages,
  budget,
}: {
  pages: Page[];
  budget: 2 | 3;
}) {
  for (const page of pages) {
    await expect(
      page
        .getByRole('region', { name: 'Skills', exact: true })
        .getByText(new RegExp(`^0/${budget} spent`)),
    ).toBeVisible();

    const bonusFeat = page
      .getByRole('region', { name: 'Feats & traits', exact: true })
      .getByRole('group', { name: 'Bonus Feat (Human)', exact: true });
    if (budget === 3)
      await expect(bonusFeat.getByText('0/1', { exact: true })).toBeVisible();
    else await expect(bonusFeat).toHaveCount(0);
  }
}

/** Source-derived legal fixture only; held real catalog content is not admitted. */
export async function exerciseDualTalent({
  owner,
  member,
  writes,
  recordLayout,
}: {
  owner: Page;
  member: Page;
  writes: Awaited<ReturnType<typeof controlSheetWrites>>;
  recordLayout: (layout: {
    page: Page;
    name: string;
    geometry: unknown;
  }) => Promise<void>;
}) {
  const pages = [owner, member];
  await test.step('Human and Dual Talent are chosen from their cards with the published two-score rule', async () => {
    for (const page of pages)
      await page.setViewportSize({ width: 1024, height: 768 });
    await selectHuman(owner);
    for (const page of pages)
      await expect(
        getRaceRegion(page).getByRole('radio', { name: /^Human / }),
      ).toBeChecked();
    await chooseAbilityScore({
      page: owner,
      control: getTraitRow({ page: owner, name: humanAbility }).getByRole(
        'combobox',
        {
          name: '+2 ability score',
          exact: true,
        },
      ),
      value: '+2 Charisma',
    });
    await expectScores({ pages, scores: [10, 10, 10, 10, 10, 12] });
    await expectSkillBudget({ pages, budget: 3 });
    await expectContribution({
      page: member,
      ability: 'Charisma',
      total: 12,
      source: humanAbility,
    });

    await setDualTalent({ page: owner, selected: true });
    for (const page of pages) {
      await expect(getTraitRow({ page })).toContainText(
        'These humans pick two ability scores and gain a +2 racial bonus in each of those scores.',
      );
      await expect(getTraitRow({ page })).toContainText(
        'This racial trait replaces the +2 bonus to any one ability score, the bonus feat, and the skilled traits.',
      );
      for (const name of [
        humanAbility,
        'Bonus Feat (Human)',
        'Skilled (Human)',
      ])
        await expect(
          getTraitRow({ page }).getByRole('listitem', { name, exact: true }),
        ).toBeVisible();
    }
    await expectChoices({
      pages,
      first: 'Choose ability score',
      second: 'Choose ability score',
    });
    await expectAdvisory({ pages, kind: 'incomplete' });
    await expectScores({ pages, scores: [10, 10, 10, 10, 10, 10] });
    await expectSkillBudget({ pages, budget: 2 });
  });

  await test.step('each authenticated member saves a different field without overwriting the other choice', async () => {
    await Promise.all([
      chooseAbilityScore({
        page: owner,
        control: getAbilityChoice({ page: owner, index: 1 }),
        value: '+2 Strength',
      }),
      chooseAbilityScore({
        page: member,
        control: getAbilityChoice({ page: member, index: 2 }),
        value: '+2 Dexterity',
      }),
    ]);
    await expectChoices({
      pages,
      first: '+2 Strength',
      second: '+2 Dexterity',
    });
    await expectScores({ pages, scores: [12, 12, 10, 10, 10, 10] });
    await expectAdvisory({ pages, kind: 'none' });
    for (const page of pages) {
      await expect(
        getAbilityControls(page).getByText('Ability score saved.', {
          exact: true,
        }),
      ).toBeVisible();
    }
    await expectContribution({
      page: owner,
      ability: 'Strength',
      total: 12,
      source: 'Dual Talent',
    });
    await expectContribution({
      page: member,
      ability: 'Dexterity',
      total: 12,
      source: 'Dual Talent',
    });
    await member.reload();
    await expectChoices({
      pages,
      first: '+2 Strength',
      second: '+2 Dexterity',
    });
    await expectScores({ pages, scores: [12, 12, 10, 10, 10, 10] });
  });

  await test.step('a dirty notes draft survives a remote choice and clean notes follow the saved draft', async () => {
    for (const page of pages)
      await getTraitRow({ page })
        .getByRole('button', { name: 'Edit Dual Talent', exact: true })
        .click();
    const draft = getTraitRow({ page: owner }).getByRole('textbox', {
      name: 'Notes for Dual Talent',
      exact: true,
    });
    const clean = getTraitRow({ page: member }).getByRole('textbox', {
      name: 'Notes for Dual Talent',
      exact: true,
    });
    await expect(clean).toHaveValue('');
    await draft.fill('Training at the table');
    await chooseAbilityScore({
      page: member,
      control: getAbilityChoice({ page: member, index: 2 }),
      value: '+2 Constitution',
    });
    await expectChoices({
      pages,
      first: '+2 Strength',
      second: '+2 Constitution',
    });
    await expect(draft).toHaveValue('Training at the table');
    await expectScores({ pages, scores: [12, 10, 12, 10, 10, 10] });
    await getTraitRow({ page: owner })
      .getByRole('button', { name: 'Save Dual Talent', exact: true })
      .click();
    await expect(
      getTraitRow({ page: owner }).getByRole('form', {
        name: 'Edit Dual Talent',
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(clean).toHaveValue('Training at the table');
    await expectChoices({
      pages,
      first: '+2 Strength',
      second: '+2 Constitution',
    });
    await getTraitRow({ page: member })
      .getByRole('button', { name: 'Cancel editing Dual Talent', exact: true })
      .click();
  });

  await test.step('clearing and duplicating choices stays advisory and survives reload with exact totals', async () => {
    await chooseAbilityScore({
      page: owner,
      control: getAbilityChoice({ page: owner, index: 1 }),
      value: 'Choose ability score',
    });
    await expectChoices({
      pages,
      first: 'Choose ability score',
      second: '+2 Constitution',
    });
    await expectScores({ pages, scores: [10, 10, 12, 10, 10, 10] });
    await expectAdvisory({ pages, kind: 'incomplete' });
    await owner.reload();
    await expectChoices({
      pages,
      first: 'Choose ability score',
      second: '+2 Constitution',
    });
    await expectAdvisory({ pages, kind: 'incomplete' });
    await expectScores({ pages, scores: [10, 10, 12, 10, 10, 10] });
    await chooseAbilityScore({
      page: owner,
      control: getAbilityChoice({ page: owner, index: 1 }),
      value: '+2 Constitution',
    });
    await expectChoices({
      pages,
      first: '+2 Constitution',
      second: '+2 Constitution',
    });
    await expectAdvisory({ pages, kind: 'duplicate' });
    await expectScores({ pages, scores: [10, 10, 12, 10, 10, 10] });
    await member.reload();
    await expectAdvisory({ pages, kind: 'duplicate' });
    await expectChoices({
      pages,
      first: '+2 Constitution',
      second: '+2 Constitution',
    });
    await expectScores({ pages, scores: [10, 10, 12, 10, 10, 10] });
    await expectContribution({
      page: member,
      ability: 'Constitution',
      total: 12,
      source: 'Dual Talent',
    });
    await chooseAbilityScore({
      page: owner,
      control: getAbilityChoice({ page: owner, index: 1 }),
      value: '+2 Strength',
    });
    await expectAdvisory({ pages, kind: 'none' });
    await expectScores({ pages, scores: [12, 10, 12, 10, 10, 10] });
    // Clearing the second field exercises choiceIndex=1 with a null value too.
    await chooseAbilityScore({
      page: member,
      control: getAbilityChoice({ page: member, index: 2 }),
      value: 'Choose ability score',
    });
    await owner.reload();
    await expectChoices({
      pages,
      first: '+2 Strength',
      second: 'Choose ability score',
    });
    await expectAdvisory({ pages, kind: 'incomplete' });
    await expectScores({ pages, scores: [12, 10, 10, 10, 10, 10] });
    await chooseAbilityScore({
      page: member,
      control: getAbilityChoice({ page: member, index: 2 }),
      value: '+2 Constitution',
    });
    await expectAdvisory({ pages, kind: 'none' });
    await expectScores({ pages, scores: [12, 10, 12, 10, 10, 10] });
  });

  await test.step('a targeted socket refusal stays on the ability control; only the UI operation is retried', async () => {
    writes.refuseNext('characterSheet:chooseRacialAbilityScore');
    // A refused selector returns to its saved value, unlike a dirty text draft.
    await getAbilityChoice({ page: member, index: 2 }).click();
    await member
      .getByRole('option', { name: '+2 Wisdom', exact: true })
      .click();
    const error = getAbilityControls(member).getByRole('alert');
    await expect(error).toHaveText(
      "Ability bonus wasn't saved: Sheet writes are refused (test). Try again.",
    );
    expect(writes.isArmed()).toBe(false);
    await expectChoices({
      pages,
      first: '+2 Strength',
      second: '+2 Constitution',
    });
    await expectScores({ pages, scores: [12, 10, 12, 10, 10, 10] });
    await expect(getAbilityControls(owner).getByRole('alert')).toHaveCount(0);
    await chooseAbilityScore({
      page: member,
      control: getAbilityChoice({ page: member, index: 2 }),
      value: '+2 Wisdom',
    });
    await expect(error).toHaveCount(0);
    await expectChoices({ pages, first: '+2 Strength', second: '+2 Wisdom' });
    await expectScores({ pages, scores: [12, 10, 10, 10, 12, 10] });
    await expectAdvisory({ pages, kind: 'none' });
    await member.reload();
    await expectChoices({ pages, first: '+2 Strength', second: '+2 Wisdom' });
    await expectScores({ pages, scores: [12, 10, 10, 10, 12, 10] });
  });

  await test.step('trait removal and race dormancy restore the Human baseline and retain both choices and notes', async () => {
    await setDualTalent({ page: member, selected: false });
    for (const page of pages) {
      await expectInactiveDualTalent(page);
      await expect(getTraitRow({ page })).toContainText(
        'Training at the table',
      );
      await expect(
        getTraitRow({ page, name: humanAbility }).getByRole('combobox', {
          name: '+2 ability score',
          exact: true,
        }),
      ).toContainText('+2 Charisma');
    }
    await expectChoices({ pages, first: '+2 Strength', second: '+2 Wisdom' });
    await expectScores({ pages, scores: [10, 10, 10, 10, 10, 12] });
    await expectSkillBudget({ pages, budget: 3 });
    await expectContribution({
      page: owner,
      ability: 'Charisma',
      total: 12,
      source: humanAbility,
    });
    await owner.reload();
    await expectInactiveDualTalent(owner);
    await expect(getTraitRow({ page: owner })).toContainText(
      'Training at the table',
    );
    await expect(
      getTraitRow({ page: owner, name: humanAbility }).getByRole('combobox', {
        name: '+2 ability score',
        exact: true,
      }),
    ).toContainText('+2 Charisma');
    await expectChoices({ pages, first: '+2 Strength', second: '+2 Wisdom' });
    await expectScores({ pages, scores: [10, 10, 10, 10, 10, 12] });
    await expectSkillBudget({ pages, budget: 3 });
    await setDualTalent({ page: owner, selected: true });
    await expectChoices({ pages, first: '+2 Strength', second: '+2 Wisdom' });
    await expectScores({ pages, scores: [12, 10, 10, 10, 12, 10] });
    await expectSkillBudget({ pages, budget: 2 });
    const noRace = getRaceRegion(owner).getByRole('radio', {
      name: 'No race',
      exact: true,
    });
    await noRace.focus();
    await noRace.press('Space');
    for (const page of pages) {
      await expect(
        getRaceRegion(page).getByRole('radio', {
          name: 'No race',
          exact: true,
        }),
      ).toBeChecked();
      await revealRaceDormantDualTalent(page);
      await expect(getTraitRow({ page })).toContainText(
        'Training at the table',
      );
    }
    await expectChoices({ pages, first: '+2 Strength', second: '+2 Wisdom' });
    await expectScores({ pages, scores: [10, 10, 10, 10, 10, 10] });
    await member.reload();
    await revealRaceDormantDualTalent(member);
    await expect(getTraitRow({ page: member })).toContainText(
      'Training at the table',
    );
    await expectChoices({ pages, first: '+2 Strength', second: '+2 Wisdom' });
    await expectScores({ pages, scores: [10, 10, 10, 10, 10, 10] });
    await selectHuman(member);
    for (const page of pages) {
      await expect(
        getRaceRegion(page).getByRole('checkbox', {
          name: 'Dual Talent selected',
          exact: true,
        }),
      ).toBeChecked();
      await expect(getTraitHeading(page)).not.toContainText(
        /Off|Not counting now/,
      );
    }
    await expectChoices({ pages, first: '+2 Strength', second: '+2 Wisdom' });
    await expectScores({ pages, scores: [12, 10, 10, 10, 12, 10] });
    await expectSkillBudget({ pages, budget: 2 });
    await expectAdvisory({ pages, kind: 'none' });
    for (const page of pages)
      await expect(getTraitRow({ page })).toContainText(
        'Training at the table',
      );
    await expectContribution({
      page: owner,
      ability: 'Wisdom',
      total: 12,
      source: 'Dual Talent',
    });
  });

  await test.step('Dual Talent controls work by keyboard and fit tablet, phone and desktop with recorded geometry', async () => {
    for (const [name, size] of [
      ['tablet', { width: 1024, height: 768 }],
      ['phone', { width: 390, height: 844 }],
      ['desktop', { width: 1440, height: 900 }],
    ] as const) {
      await owner.setViewportSize(size);
      await expectNoHorizontalOverflow(owner);
      await expectControlsReachable(
        owner,
        getTraitRow({ page: owner }),
        `${name} Dual Talent`,
        'focus',
      );
      const boxes = [];
      for (const index of [1, 2] as const) {
        const control = getAbilityChoice({ page: owner, index });
        await control.focus();
        await control.press('Enter');
        await expect(
          owner.getByRole('option', { name: '+2 Charisma', exact: true }),
        ).toBeVisible();
        await owner.keyboard.press('Escape');
        await expect(control).toBeFocused();
        const box = await control.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return {
            x: bounds.left + window.scrollX,
            y: bounds.top + window.scrollY,
            width: bounds.width,
            height: bounds.height,
          };
        });
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(size.width);
        boxes.push(box);
      }
      const [first, second] = boxes;
      expect(
        first!.x + first!.width <= second!.x + 1 ||
          second!.x + second!.width <= first!.x + 1 ||
          first!.y + first!.height <= second!.y + 1 ||
          second!.y + second!.height <= first!.y + 1,
        'the two independently labelled controls do not overlap',
      ).toBe(true);
      await recordLayout({
        page: owner,
        name,
        geometry: { viewport: size, controls: boxes },
      });
    }
    await expectChoices({ pages, first: '+2 Strength', second: '+2 Wisdom' });
    await expectScores({ pages, scores: [12, 10, 10, 10, 12, 10] });
  });
}
