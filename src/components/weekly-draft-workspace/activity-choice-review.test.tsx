import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { RawRoll, StagedActionChoice } from '~/lib/weekly-draft-facts';
vi.mock('~/components/ui/select', () => import('./native-select-test-double'));
import { ActivityView } from './activity-view';
import {
  activityFacts,
  activitySlot,
  selectSlot,
} from './activity-view-fixture';
import {
  reviewRequirementMessage as reviewMessage,
  subjectMessage,
} from './summary-messages';
import type { ActivityView as Facts } from './types';

// A Character's departure flags the staged choices it affects (#316): each
// is reviewed, corrected or cleared on its own, keeping its rolls.

type Result = 'accepted' | 'failed';
const roll: RawRoll = {
  sides: 20,
  diceCount: 1,
  diceTotal: 14,
  provenance: { kind: 'table' },
  modifiers: [{ sourceId: 'custom', value: 2, reason: 'Drill sergeant' }],
};
const drill: StagedActionChoice = {
  choiceId: 'drill',
  actionId: 'drill_militia',
  reviewRequired: true,
  rolls: { check: roll },
};
const officer = (choiceId: string): StagedActionChoice => ({
  choiceId,
  actionId: 'change_officer_role',
  characterId: 'vessa',
  toRole: 'marshal',
  reviewRequired: true,
});
const gold: StagedActionChoice = { choiceId: 'gold', actionId: 'earn_gold' };

function flagged(choice: StagedActionChoice, slotId: string, number: number) {
  const code = `${choice.choiceId}:review`;
  return activitySlot(choice, {
    slotId,
    number,
    requirements: choice.reviewRequired ? [code] : [],
    issues: choice.reviewRequired ? [{ code, message: reviewMessage }] : [],
  });
}
function facts(choices: StagedActionChoice[]): Facts {
  return activityFacts(
    choices.map((choice, index) =>
      flagged(choice, `slot-${index + 1}`, index + 1),
    ),
    {
      characters: [
        { characterId: 'ameiko', name: 'Ameiko', level: 6 },
        { characterId: 'jagrin', name: 'Jagrin', level: 5 },
      ],
    },
  );
}
function deferredEdit() {
  const replies: ((result: Result) => void)[] = [];
  const edit = vi.fn(
    (_edit: WeeklyDraftEdit) =>
      new Promise<Result>((resolve) => replies.push(resolve)),
  );
  return { edit, reply: (result: Result) => replies.shift()!(result) };
}
const details = (number: number) =>
  within(screen.getByRole('region', { name: `Action Slot ${number} details` }));

test('a flagged choice asks for review once and resubmits its current detail with rolls and modifiers kept; other slots are untouched', async () => {
  const { edit, reply } = deferredEdit();
  const view = render(
    <ActivityView view={facts([drill, gold])} edit={edit} disabled={false} />,
  );
  selectSlot('Earn Gold', 2);
  expect(
    details(2).queryByRole('button', { name: 'Review choice' }),
  ).toBeNull();
  expect(screen.queryByText(reviewMessage)).toBeNull();

  // The projected requirement reads the same in the slot and the summary.
  expect(subjectMessage('drill:review', 'drill', false, 'drill_militia')).toBe(
    reviewMessage,
  );
  selectSlot('Drill Militia', 1);
  const slot = details(1);
  expect(slot.getAllByText(reviewMessage)).toHaveLength(1);
  const review = slot.getByRole('button', { name: 'Review choice' });
  fireEvent.click(review);
  expect(edit).toHaveBeenCalledTimes(1);
  expect(edit).toHaveBeenCalledWith({
    kind: 'detail',
    slotId: 'slot-1',
    choiceId: 'drill',
    choice: drill,
  });
  // Pending: acknowledged locally, not repeatable.
  expect(review).toBeDisabled();
  expect(slot.getByRole('status')).toHaveTextContent('Saving review…');
  fireEvent.click(review);
  expect(edit).toHaveBeenCalledTimes(1);

  await act(async () => reply('accepted'));
  const { reviewRequired: _flag, ...reviewed } = drill;
  view.rerender(
    <ActivityView
      view={facts([reviewed as StagedActionChoice, gold])}
      edit={edit}
      disabled={false}
    />,
  );
  expect(screen.queryByText(reviewMessage)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Review choice' })).toBeNull();
});

test('a failed review keeps the flag with the reason and can be retried; read-only weeks disable it', async () => {
  const { edit, reply } = deferredEdit();
  const view = render(
    <ActivityView view={facts([drill])} edit={edit} disabled={false} />,
  );
  selectSlot('Drill Militia');
  fireEvent.click(details(1).getByRole('button', { name: 'Review choice' }));
  await act(async () => reply('failed'));
  const notice = within(
    details(1).getByRole('group', { name: 'Choice review' }),
  );
  expect(notice.getByRole('alert')).toHaveTextContent(
    'This review wasn’t saved. Try again.',
  );
  expect(details(1).getByText(reviewMessage)).toBeVisible();
  const review = details(1).getByRole('button', { name: 'Review choice' });
  expect(review).toBeEnabled();
  review.focus();
  fireEvent.click(review);
  expect(edit).toHaveBeenCalledTimes(2);
  expect(review).toHaveFocus();
  await act(async () => reply('accepted'));

  view.rerender(<ActivityView view={facts([drill])} edit={edit} disabled />);
  expect(
    details(1).getByRole('button', { name: 'Review choice' }),
  ).toBeDisabled();
});

test('a choice naming the departed character is corrected or cleared, each obsolete choice on its own', async () => {
  const { edit, reply } = deferredEdit();
  const choices = [officer('demote'), officer('promote'), gold];
  const view = render(
    <ActivityView view={facts(choices)} edit={edit} disabled={false} />,
  );
  selectSlot('Change Officer Role', 1);
  const first = details(1);
  expect(first.getByText(reviewMessage)).toBeVisible();
  expect(
    first.getByText(/names a character who is no longer here/),
  ).toBeVisible();
  // Resubmitting the missing reference would be refused, so it isn't offered.
  expect(first.queryByRole('button', { name: 'Review choice' })).toBeNull();
  const characters = within(
    first.getByRole('radiogroup', { name: 'Character' }),
  );
  expect(
    characters.getByRole('radio', { name: /Missing character/ }),
  ).toBeChecked();

  // A refused replacement leaves the flag as the saved Activity has it.
  fireEvent.click(characters.getByRole('radio', { name: /^Jagrin/ }));
  expect(edit).toHaveBeenLastCalledWith(
    expect.objectContaining({
      kind: 'detail',
      slotId: 'slot-1',
      choiceId: 'demote',
      choice: expect.objectContaining({ characterId: 'jagrin' }),
    }),
  );
  await act(async () => reply('failed'));
  expect(details(1).getByText(reviewMessage)).toBeVisible();

  fireEvent.click(
    details(1).getByRole('button', { name: /^Clear Change Officer Role/ }),
  );
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'clear',
    slotId: 'slot-1',
    choiceId: 'demote',
  });
  await act(async () => reply('accepted'));
  view.rerender(
    <ActivityView
      view={facts([choices[1]!, gold])}
      edit={edit}
      disabled={false}
    />,
  );
  selectSlot('Change Officer Role', 1);
  expect(details(1).getByText(reviewMessage)).toBeVisible();
  fireEvent.click(
    details(1).getByRole('button', { name: /^Clear Change Officer Role/ }),
  );
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'clear',
    slotId: 'slot-1',
    choiceId: 'promote',
  });
  expect(edit).toHaveBeenCalledTimes(3);
});

test('review reads the latest choice when clicked, preserving a roll received since rendering', async () => {
  const edit = vi.fn(
    async (_edit: WeeklyDraftEdit): Promise<Result> => 'accepted',
  );
  let latest = facts([drill]);
  render(
    <ActivityView
      view={facts([drill])}
      latest={() => latest}
      edit={edit}
      disabled={false}
    />,
  );
  selectSlot('Drill Militia');
  const updated: StagedActionChoice = {
    ...drill,
    rolls: { check: { ...roll, diceTotal: 19 } },
  };
  latest = facts([updated]);
  await act(async () =>
    fireEvent.click(details(1).getByRole('button', { name: 'Review choice' })),
  );
  expect(edit).toHaveBeenCalledWith({
    kind: 'detail',
    slotId: 'slot-1',
    choiceId: 'drill',
    choice: updated,
  });
});
