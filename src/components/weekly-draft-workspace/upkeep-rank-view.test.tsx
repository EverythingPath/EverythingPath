import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { roll, upkeepFixture } from '../../../tests/rules/upkeep-fixture';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import type { WeeklyDraft, WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import { phaseView } from './phase-view';
import { Rank } from './upkeep-rank-view';

// Rank 8 with 110 training and plenty of treasury: an ordinary attrition
// success losing 1 training still reaches rank 9 (105), Captain.
function fixture(
  arrange: (draft: WeeklyDraft, snapshot: UpkeepSnapshot) => void = () =>
    undefined,
) {
  const { draft, snapshot } = upkeepFixture();
  snapshot.rank = 8;
  snapshot.training = 110;
  snapshot.treasuryCopper = 100000;
  draft.upkeep.rolls = { check: roll(20, 12), training: roll(6, 1) };
  arrange(draft, snapshot);
  const source = workspaceSourceSchema.parse({
    key: { campaignId: 'campaign', militiaId: 'militia', draftId: 'draft' },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [
      { characterId: 'pc', name: 'Ameiko' },
      { characterId: 'pc-2', name: 'Koya' },
    ],
  });
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: source.snapshot,
  });
  const view = phaseView('upkeep', draft, source, preview);
  if (view.phase !== 'upkeep' || !view.sections)
    throw new Error('Expected Upkeep sections');
  return view.sections.rank;
}

function secondPc(snapshot: UpkeepSnapshot) {
  snapshot.roster.people.push({ characterId: 'pc-2', kind: 'pc', hitDice: 9 });
  snapshot.characters.push({
    ...snapshot.characters[0]!,
    characterId: 'pc-2',
    level: 9,
  });
}

function renderRank(
  rank: ReturnType<typeof fixture>,
  options: { disabled?: boolean } = {},
) {
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
  render(<Rank rank={rank} edit={edit} disabled={options.disabled ?? false} />);
  return edit;
}

const section = () => screen.getByRole('region', { name: 'Rank' });
const group = (name: string) => screen.getByRole('group', { name });
const captainFeats = ['Great Fortitude', 'Iron Will', 'Lightning Reflexes'];

test('reaching Captain shows the transition, the threshold and one feat row per PC', () => {
  const edit = renderRank(fixture((_, snapshot) => secondPc(snapshot)));
  expect(section()).toHaveTextContent('Rank 8 → 9');
  expect(
    screen.getByText('Training 109 reaches rank 9. Rank 10 needs 160.'),
  ).toBeVisible();
  const boon = screen.getByRole('region', { name: 'Rank 9 boon' });
  expect(boon).toHaveTextContent('Rank 9 · training 105');
  expect(boon).toHaveTextContent(
    'Title: Captain. Each PC chooses one bonus feat',
  );
  for (const name of ['Ameiko', 'Koya']) {
    const row = group(`${name} rank 9 feat`);
    expect(within(row).getByText(name)).toBeVisible();
    const cards = within(row).getAllByRole('button');
    expect(cards.map((card) => card.textContent)).toEqual(captainFeats);
    for (const card of cards)
      expect(card).toHaveAttribute('aria-pressed', 'false');
  }
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.click(
    within(group('Ameiko rank 9 feat')).getByRole('button', {
      name: 'Iron Will',
    }),
  );
  expect(edit).toHaveBeenCalledTimes(1);
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'acknowledge',
    acknowledgement: {
      acknowledgementId: 'ack:upkeep:boon:9:pc',
      subjectId: 'upkeep:boon:9:pc',
      outcome: 'Iron Will',
    },
  });
});

test('the chosen feat card is pressed and tapping it again clears the record', () => {
  const edit = renderRank(
    fixture((draft) => {
      draft.acknowledgements = [
        {
          acknowledgementId: 'ack-old',
          subjectId: 'upkeep:boon:9:pc',
          outcome: 'Iron Will',
        },
      ];
    }),
  );
  const row = group('Ameiko rank 9 feat');
  const ironWill = within(row).getByRole('button', { name: 'Iron Will' });
  expect(ironWill).toHaveAttribute('aria-pressed', 'true');
  expect(
    within(row).getByRole('button', { name: 'Great Fortitude' }),
  ).toHaveAttribute('aria-pressed', 'false');
  expect(row).not.toHaveTextContent('Choose a feat');
  fireEvent.click(ironWill);
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'clear_acknowledgement',
    acknowledgementId: 'ack-old',
  });
});

test('several gains in one week list each rank with its cards or outcome editor', async () => {
  const edit = renderRank(
    fixture((_, snapshot) => {
      snapshot.rank = 3;
      snapshot.training = 41;
    }),
  );
  expect(section()).toHaveTextContent('Rank 3 → 6');
  expect(
    screen.getByText('Training 40 reaches rank 6. Rank 7 needs 55.'),
  ).toBeVisible();
  const director = screen.getByRole('region', { name: 'Rank 4 boon' });
  expect(director).toHaveTextContent('Rank 4 · training 20');
  expect(
    within(group('Ameiko rank 4 feat'))
      .getAllByRole('button')
      .map((card) => card.textContent),
  ).toEqual(['Alertness', 'Deceitful', 'Persuasive', 'Stealthy']);
  const xp = screen.getByRole('region', { name: 'Rank 5 boon' });
  expect(xp).toHaveTextContent('Rank 5 · training 30');
  expect(xp).toHaveTextContent('XP award');
  const xpField = within(xp).getByRole('textbox', {
    name: 'Ameiko boon outcome',
  });
  expect(xpField).toHaveValue('');
  expect(within(xp).getByText('Record the outcome for Ameiko.')).toBeVisible();
  expect(
    within(xp).queryByRole('button', { name: 'Clear outcome' }),
  ).not.toBeInTheDocument();
  const gift = screen.getByRole('region', { name: 'Rank 6 boon' });
  expect(gift).toHaveTextContent('Rank 6 · training 40');
  expect(gift).toHaveTextContent('Gift');
  expect(
    within(gift).getByRole('textbox', { name: 'Ameiko boon outcome' }),
  ).toBeVisible();
  fireEvent.change(xpField, { target: { value: 'Split 1,200 XP' } });
  fireEvent.click(within(xp).getByRole('button', { name: 'Record outcome' }));
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'acknowledge',
      acknowledgement: {
        acknowledgementId: 'ack:upkeep:boon:5:pc',
        subjectId: 'upkeep:boon:5:pc',
        outcome: 'Split 1,200 XP',
      },
    }),
  );
});

test('the highest PC level caps training that reaches a higher rank', () => {
  renderRank(
    fixture((_, snapshot) => {
      snapshot.characters[0]!.level = 8;
      snapshot.training = 170;
    }),
  );
  expect(section()).toHaveTextContent('Stays rank 8');
  expect(
    screen.getByText(
      'Training 169 reaches rank 10, but the highest player-character level (8) holds the militia at rank 8.',
    ),
  ).toBeVisible();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('a rank above the highest PC level names the level, not only the training, as the limit', () => {
  renderRank(
    fixture((_, snapshot) => {
      snapshot.characters[0]!.level = 7;
      snapshot.training = 90;
    }),
  );
  expect(section()).toHaveTextContent('Stays rank 8');
  expect(
    screen.getByText(
      'Training 89. Rank 9 needs 105 training and a level 9 player character; the highest is level 7.',
    ),
  ).toBeVisible();
  expect(
    within(section()).getByText(
      'The militia rank exceeds the highest player-character level. Review the rank with the table.',
    ),
  ).toBeVisible();
});

test('an unchanged rank names the next threshold', () => {
  renderRank(
    fixture((_, snapshot) => {
      snapshot.training = 90;
    }),
  );
  expect(section()).toHaveTextContent('Stays rank 8');
  expect(
    screen.getByText('Training 89 of the 105 that rank 9 needs.'),
  ).toBeVisible();
});

test('confirmation disables every card, field and button', () => {
  renderRank(
    fixture((draft, snapshot) => {
      snapshot.rank = 3;
      snapshot.training = 41;
      draft.acknowledgements = [
        {
          acknowledgementId: 'ack-gift',
          subjectId: 'upkeep:boon:6:pc',
          outcome: 'Took the gold',
        },
      ];
    }),
    { disabled: true },
  );
  const buttons = screen.getAllByRole('button');
  expect(buttons.length).toBeGreaterThan(4);
  for (const button of buttons) expect(button).toBeDisabled();
  for (const field of screen.getAllByRole('textbox'))
    expect(field).toBeDisabled();
});

test('rank waits for the steps above without any boon controls', () => {
  renderRank(
    fixture((draft) => {
      draft.upkeep.rolls = {};
    }),
  );
  expect(section()).toHaveTextContent('Waiting for the steps above');
  expect(
    screen.getByText(
      'Rank is worked out once every roll and decision above is in.',
    ),
  ).toBeVisible();
  expect(screen.queryByText(/Training/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
