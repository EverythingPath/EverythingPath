import { expect, test } from 'vitest';
import { foundationWeek } from '../../../tests/rules/foundation-acceptance-fixtures';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { createMemoryDraftAuthority } from '~/lib/memory-draft-persistence';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import {
  stagedActionChoiceSchema,
  type StagedActionChoice,
} from '~/lib/weekly-draft-facts';
import { createDraftPersistence } from '~/lib/weekly-draft-persistence';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import { isEconomyChoice } from './activity-economy-detail';
import {
  economyFieldEdits,
  type EconomyFieldEdits,
} from './activity-economy-edits';
import { activityView } from './activity-facts';

type Device = ReturnType<typeof createDraftPersistence>;
type Team = UpkeepSnapshot['roster']['teams'][number];
const team = (teamId: string, teamType: Team['teamType']): Team => ({
  teamId,
  teamType,
  name: teamId,
  status: 'active',
  managerCharacterId: null,
  rewardCapExempt: false,
  notes: '',
});

// A Fixers team brokering a market in Phaendar (Indifferent: list prices)
// and a Spies team in the second slot; the militia holds Gear.
function week(choices: [StagedActionChoice, StagedActionChoice | null]) {
  const input = foundationWeek(3);
  const snapshot = input.militiaSnapshot;
  snapshot.roster.teams = [team('fix', 'fixers'), team('spy', 'spies')];
  snapshot.settlements.push(
    ...(['phaendar', 'kassen'] as const).map((settlementId) => ({
      settlementId,
      name: settlementId,
      reputation: 'Indifferent' as const,
      secured: false,
      occupied: false,
      temporaryReputationShift: 0,
      refugeActivatedWeek: null,
      refugeActiveUntilWeek: null,
    })),
  );
  snapshot.economy = {
    items: [
      {
        itemId: 'gear',
        name: 'Gear',
        valueCopper: 1000,
        weight: 1,
        location: 'held',
      },
    ],
    caches: [],
    markets: [],
    orders: [],
  };
  const draft = input.revision;
  draft.activity.slots = [
    { slotId: 'one', choice: choices[0] },
    { slotId: 'two', choice: choices[1] },
  ];
  const authority = createMemoryDraftAuthority(draft, snapshot);
  const source = workspaceSourceSchema.parse({
    key: {
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: draft.draftId,
    },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [{ characterId: 'pc', name: 'Ameiko' }],
  });
  const facts = (device: Device) => {
    const current = device.getSnapshot().observation!.draft!;
    return activityView(
      current,
      source,
      projectWeeklyDraft({ revision: current, militiaSnapshot: snapshot }),
    );
  };
  // The detail edit the slot's editor would stage from this device's facts.
  const detailEdit = (
    device: Device,
    index: number,
    write: (edits: EconomyFieldEdits) => unknown,
  ) => {
    const slot = facts(device).slots[index]!;
    const choice = slot.choice!;
    if (!isEconomyChoice(choice)) throw new Error('Expected an economy choice');
    let staged: WeeklyDraftEdit | null = null;
    write(
      economyFieldEdits(choice, (fields) => {
        staged = {
          kind: 'detail',
          slotId: slot.slotId,
          choiceId: choice.choiceId,
          choice: stagedActionChoiceSchema.parse(
            Object.fromEntries(
              Object.entries({ ...choice, ...fields }).filter(
                ([, value]) => value !== undefined,
              ),
            ),
          ),
        };
        return true;
      }),
    );
    if (!staged) throw new Error('No edit staged');
    return staged as WeeklyDraftEdit;
  };
  return { authority, facts, detailEdit, snapshot };
}
async function devices(authority: ReturnType<typeof week>['authority']) {
  const first = createDraftPersistence(authority.transport);
  const second = createDraftPersistence(authority.transport);
  await Promise.all([first.ready, second.ready]);
  return [first, second] as const;
}
const market: StagedActionChoice = {
  choiceId: 'market',
  actionId: 'broker_market',
  teamId: 'fix',
  settlementId: 'phaendar',
  purchases: [{ itemId: 'wand', name: 'Wand', priceCopper: 5000, weight: 1 }],
  acknowledgements: [
    {
      acknowledgementId: 'ack-wand',
      subjectId: 'availability:wand',
      outcome: 'In stock',
    },
  ],
};

test('[rules.WEEK-04.economy-concurrent] two devices editing different market fields both land; the same purchases field is taken in order, and the rejected device retries from fresh facts', async () => {
  const { authority, facts, detailEdit } = week([market, null]);
  const [first, second] = await devices(authority);
  const rope = { name: 'Rope', priceCopper: 100, weight: 2 };
  expect(
    await Promise.all([
      first.edit(detailEdit(first, 0, (edits) => edits.addPurchase(rope))),
      second.edit(
        detailEdit(second, 0, (edits) => edits.set('settlementId', 'kassen')),
      ),
    ]),
  ).toEqual(['accepted', 'accepted']);
  await Promise.all([first.settled(), second.settled()]);
  const merged = facts(second).slots[0]!.choice;
  expect(merged).toMatchObject({
    settlementId: 'kassen',
    purchases: [market.purchases![0], { ...rope, itemId: expect.any(String) }],
    acknowledgements: market.acknowledgements,
  });
  // Both remove a different purchase from the same list at once.
  const ropeId =
    merged!.actionId === 'broker_market' ? merged.purchases![1]!.itemId : '';
  const removals = [
    first.edit(detailEdit(first, 0, (edits) => edits.removePurchase('wand'))),
    second.edit(detailEdit(second, 0, (edits) => edits.removePurchase(ropeId))),
  ];
  expect(await Promise.all(removals)).toEqual(['accepted', 'failed']);
  await Promise.all([first.settled(), second.settled()]);
  expect(
    await second.edit(
      detailEdit(second, 0, (edits) => edits.removePurchase(ropeId)),
    ),
  ).toBe('accepted');
  expect(facts(first).slots[0]!.choice).toEqual({
    ...market,
    settlementId: 'kassen',
    purchases: undefined,
    acknowledgements: undefined,
  });
  first.dispose();
  second.dispose();
});

const lostCache: StagedActionChoice = {
  choiceId: 'cache',
  actionId: 'secure_cache',
  teamId: 'spy',
  mode: 'retrieve',
  cacheId: 'lost-cache',
};

test('[rules.ACT-10.economy-orphans] while a missing item is referenced an unrelated edit is refused and removing the reference lands; with a second orphan no single repair lands', async () => {
  const one = week([{ ...market, sales: ['gear', 'gone'] }, null]);
  const [device] = await devices(one.authority);
  // The rules cannot sell what the militia does not hold.
  expect(one.facts(device).slots[0]!.requirements).toContain(
    'market:sale:gone',
  );
  expect(
    await device.edit(
      one.detailEdit(device, 0, (edits) => edits.set('settlementId', 'kassen')),
    ),
  ).toBe('failed');
  await device.settled();
  expect(
    await device.edit(
      one.detailEdit(device, 0, (edits) => edits.removeSale('gone')),
    ),
  ).toBe('accepted');
  await device.settled();
  expect(one.facts(device).slots[0]!.choice).toMatchObject({
    settlementId: 'phaendar',
    sales: ['gear'],
  });
  device.dispose();
  // A missing cache elsewhere keeps the draft invalid, so neither repair
  // alone is accepted; restoring a source is Militia corrections' job.
  const two = week([{ ...market, sales: ['gear', 'gone'] }, lostCache]);
  const [other] = await devices(two.authority);
  expect(
    await other.edit(
      two.detailEdit(other, 0, (edits) => edits.removeSale('gone')),
    ),
  ).toBe('failed');
  await other.settled();
  expect(
    await other.edit(
      two.detailEdit(other, 1, (edits) => edits.clear('cacheId')),
    ),
  ).toBe('failed');
  await other.settled();
  expect(two.facts(other).slots.map((slot) => slot.choice)).toEqual([
    { ...market, sales: ['gear', 'gone'] },
    lostCache,
  ]);
  other.dispose();
});

test('[rules.ACT-11.economy-cost] a brokered market’s calculated cost is its activation plus each available purchase at the settlement’s price, and a sale is income', async () => {
  const { authority, facts, snapshot } = week([
    { ...market, sales: ['gear'] },
    null,
  ]);
  const [device] = await devices(authority);
  const view = facts(device);
  const slot = view.slots[0]!;
  expect(slot.requirements).toEqual([]);
  expect(slot.calculatedCostCopper).toBe(10000 + 5000);
  // The purchase is on order and the Gear sold after this slot.
  const plan = projectWeeklyDraft({
    revision: device.getSnapshot().observation!.draft!,
    militiaSnapshot: snapshot,
  }).phases!.activity.plan;
  expect(plan).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'item',
        after: expect.objectContaining({ itemId: 'gear', location: 'sold' }),
      }),
      expect.objectContaining({
        kind: 'order',
        order: expect.objectContaining({ itemId: 'wand', priceCopper: 5000 }),
      }),
    ]),
  );
  // Without the availability answer the purchase waits for it.
  const unanswered = week([{ ...market, acknowledgements: undefined }, null]);
  const [other] = await devices(unanswered.authority);
  expect(unanswered.facts(other).slots[0]!.requirements).toEqual([
    'market:acknowledgement:availability:wand',
  ]);
  device.dispose();
  other.dispose();
});
