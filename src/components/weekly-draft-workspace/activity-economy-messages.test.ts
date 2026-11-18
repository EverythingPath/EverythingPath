import { expect, test } from 'vitest';
import { foundationWeek } from '../../../tests/rules/foundation-acceptance-fixtures';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import { activityView } from './activity-facts';
import { subjectMessage, summaryMessage } from './summary-messages';

test('[rules.ACT-17.economy-messages] market, cache and order codes read as table instructions, per item and per action', () => {
  expect(subjectMessage('m:purchases', 'm')).toBe(
    'Record the purchases, or record that there are none.',
  );
  expect(subjectMessage('m:sale:gear', 'm')).toBe(
    'Every sold item must be held when the market opens.',
  );
  expect(subjectMessage('m:acknowledgement:availability:wand', 'm')).toBe(
    'Record whether each purchased or ordered item is available.',
  );
  expect(subjectMessage('c:cache-tier:exception', 'c')).toBe(
    'This team’s tier does not normally handle this cache class or a secure location. Record a reasoned Rules Exception or revise the choice.',
  );
  expect(subjectMessage('o:item', 'o', false, 'special_order')).toBe(
    'Name the ordered item and enter its weight.',
  );
  expect(subjectMessage('m:settlement', 'm', false, 'broker_market')).toBe(
    'Choose the market’s settlement; its reputation sets purchase prices.',
  );
  // Phase-wide lists name the owning choice.
  expect(
    summaryMessage('m:duplicate-item:gear', {
      adjustments: [],
      options: { subjectId: [{ value: 'm', label: 'Broker Market' }] },
    }),
  ).toBe('Broker Market: Each purchase needs a new item; this one exists.');
});

test('[rules.ACT-15.receipt-messages] a Special Order’s receipt codes are explained in its slot', () => {
  const input = foundationWeek(3);
  input.militiaSnapshot.economy = {
    items: [],
    caches: [],
    markets: [],
    orders: [],
  };
  input.revision.activity.slots[0]!.choice = {
    choiceId: 'order-choice',
    actionId: 'special_order',
    orderId: 'order',
    receipt: { receivedDay: 30, acknowledgementId: 'receipt' },
  };
  const view = activityView(
    input.revision,
    workspaceSourceSchema.parse({
      key: {
        campaignId: 'campaign',
        militiaId: 'militia',
        draftId: input.revision.draftId,
      },
      week: input.revision.week,
      sourceRevision: 0,
      snapshot: input.militiaSnapshot,
      people: [],
    }),
    projectWeeklyDraft(input),
  );
  expect(view.slots[0]!.issues).toContainEqual({
    code: 'order:unreceived-order',
    message: 'This order is not waiting for delivery.',
  });
});
