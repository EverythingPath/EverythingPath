import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';
import type { RawRoll, StagedActionChoice } from '~/lib/weekly-draft-facts';
import { ActivityView } from './activity-view';
import type { ActivityView as Facts } from './types';
import {
  activityFacts,
  activitySlot,
  acceptingEdit,
  selectSlot,
} from './activity-view-fixture';

function total(sides: number, diceCount: number, diceTotal: number): RawRoll {
  return {
    sides,
    diceCount,
    diceTotal,
    provenance: { kind: 'table' },
    modifiers: [],
  };
}
const recordedCheck = total(20, 1, 10);
// `succeeded` is the rules' reading of the check. It defaults to a success so
// Drill's Training roll, used only then, shows.
function facts(
  choice: StagedActionChoice,
  requirements: string[] = [],
  succeeded: boolean | null = true,
): Facts {
  const slot = activitySlot(choice, { requirements });
  return activityFacts([
    { ...slot, check: slot.check && { ...slot.check, succeeded } },
  ]);
}
const drill = (
  rolls: Extract<StagedActionChoice, { actionId: 'drill_militia' }>['rolls'],
): StagedActionChoice => ({
  actionId: 'drill_militia',
  choiceId: 'drill',
  costCopper: 0,
  rolls,
});
function open(action = 'Drill Militia') {
  selectSlot(action);
}
const textbox = (name: string) => screen.getByRole('textbox', { name });
function lastChoice(edit: ReturnType<typeof acceptingEdit>) {
  const call = edit.mock.lastCall![0];
  if (call.kind !== 'detail') throw new Error('Expected detail edit');
  return call.choice;
}

test('[rules.ACT-12.total] Drill training (2d6) shows a recorded total in its one field, writes a replacement against the rule spec and blanks to the existing rolls omission', () => {
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={facts(drill({ check: recordedCheck, training: total(6, 2, 9) }))}
      edit={edit}
      disabled={false}
    />,
  );
  open();
  expect(textbox('Training roll')).toHaveValue('9');
  expect(screen.getByText(/2d6 · total of the dice only/)).toBeVisible();
  expect(textbox('Check roll')).toHaveValue('10');
  expect(
    screen.queryByRole('textbox', { name: /die/ }),
  ).not.toBeInTheDocument();
  fireEvent.change(textbox('Training roll'), { target: { value: '11' } });
  expect(lastChoice(edit)).toEqual(
    drill({ check: recordedCheck, training: total(6, 2, 11) }),
  );
  fireEvent.change(textbox('Training roll'), { target: { value: '' } });
  expect(lastChoice(edit)).toEqual(drill({ check: recordedCheck }));
});

test('[rules.ACT-13.check-metadata] a recorded check shows its value without a write and a new number preserves its provenance and modifiers', () => {
  const generated = { kind: 'generated' as const, sourceId: 'roller' };
  const modifiers = [{ sourceId: 'helpful', value: 2, reason: 'Allies' }];
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={facts(
        drill({
          check: { ...recordedCheck, provenance: generated, modifiers },
        }),
      )}
      edit={edit}
      disabled={false}
    />,
  );
  open();
  expect(textbox('Check roll')).toHaveValue('10');
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(textbox('Check roll'), { target: { value: '20' } });
  expect(lastChoice(edit)).toEqual(
    drill({
      check: {
        diceTotal: 20,
        diceCount: 1,
        sides: 20,
        provenance: generated,
        modifiers,
      },
    }),
  );
});

test('[rules.ACT-12.modifiers] adding a custom modifier to a total roll preserves its numeric representation exactly', async () => {
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={facts(drill({ check: total(20, 1, 0) }))}
      edit={edit}
      disabled={false}
    />,
  );
  open();
  expect(textbox('Check roll')).toHaveValue('0');
  expect(screen.getByText(/usual range is 1–20/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Add modifier' }));
  fireEvent.change(textbox('Value'), { target: { value: '2' } });
  fireEvent.change(textbox('Reason'), {
    target: { value: 'Favourable weather' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add modifier' }));
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
  const choice = lastChoice(edit);
  if (choice.actionId !== 'drill_militia') throw new Error('Expected Drill');
  expect(choice.rolls?.check).toEqual({
    ...total(20, 1, 0),
    modifiers: [
      {
        sourceId: expect.stringMatching(/^custom:/),
        value: 2,
        reason: 'Favourable weather',
      },
    ],
  });
});

test('[rules.ACT-12.wrong-count] a total recorded for another specification stays required, explains the mismatch and is replaced only by a deliberate total', () => {
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={facts(drill({ check: recordedCheck, training: total(6, 1, 4) }), [
        'drill:training:2d6',
      ])}
      edit={edit}
      disabled={false}
    />,
  );
  open();
  expect(textbox('Training roll')).toHaveValue('');
  expect(
    screen.getByText(
      /Recorded total 4 was entered for 1d6, but this step needs 2d6/,
    ),
  ).toBeVisible();
  expect(screen.getByText(/2d6 · total of the dice only/)).toBeVisible();
  fireEvent.change(textbox('Training roll'), { target: { value: '8' } });
  expect(lastChoice(edit)).toEqual(
    drill({ check: recordedCheck, training: total(6, 2, 8) }),
  );
});

test('[rules.ACT-12.specs] Special Order delivery is 2d6, Reduce Danger notoriety is 1d4, and roll-less actions render no roll field', () => {
  const edit = acceptingEdit();
  const { rerender } = render(
    <ActivityView
      view={facts(
        {
          actionId: 'special_order',
          choiceId: 'order',
          itemId: 'item',
          settlementId: 'town',
        } as StagedActionChoice,
        ['order:delivery:2d6'],
      )}
      edit={edit}
      disabled={false}
    />,
  );
  open('Special Order');
  expect(screen.getByText(/2d6 · total of the dice only/)).toBeVisible();
  fireEvent.change(textbox('Delivery roll'), { target: { value: '7' } });
  expect(lastChoice(edit)).toMatchObject({
    actionId: 'special_order',
    rolls: { delivery: total(6, 2, 7) },
  });
  rerender(
    <ActivityView
      view={facts(
        {
          actionId: 'reduce_danger',
          choiceId: 'danger',
          settlementId: 'town',
          rolls: { notoriety: total(4, 1, 3) },
        } as StagedActionChoice,
        [],
        // Its notoriety roll is used only when the check fails.
        false,
      )}
      edit={edit}
      disabled={false}
    />,
  );
  open('Reduce Danger');
  expect(screen.getByText(/1d4 · total of the dice only/)).toBeVisible();
  expect(textbox('Notoriety roll')).toHaveValue('3');
  rerender(
    <ActivityView
      view={facts({
        actionId: 'lie_low',
        choiceId: 'low',
      } as StagedActionChoice)}
      edit={edit}
      disabled={false}
    />,
  );
  open('Lie Low');
  expect(
    screen.queryByRole('textbox', { name: /roll/ }),
  ).not.toBeInTheDocument();
});
