import { expect, test } from 'vitest';
import { projectUpkeep } from './rules-upkeep';
import { newMilitiaSetup, prepareMilitiaSetup } from './canonical-setup';

test('[setup.defaults] a new militia enters an empty first week with chosen focus and ten gold', () => {
  const setup = newMilitiaSetup('Security');
  const result = prepareMilitiaSetup(setup, 'first-draft');
  expect(result.snapshot).toMatchObject({
    rank: 1,
    training: 0,
    treasuryCopper: 1000,
    notoriety: 0,
    focus: 'Security',
  });
  expect(result.draft).toMatchObject({
    week: 1,
    revision: 0,
    context: {
      firstMilitiaWeek: true,
      startDay: 0,
      persistentPhaseEligible: false,
    },
    activity: { slots: [] },
  });
  expect(result.warnings).toEqual([]);
});

test('[setup.integrity] invalid event identities return structural errors and cannot crash validation', async () => {
  const { militiaSetupSchema } = await import('./canonical-setup');
  const setup = newMilitiaSetup('Loyalty');
  const event = {
    eventId: 'same',
    eventType: 'rivalry' as const,
    startedWeek: 0,
    order: 0,
    targets: [],
  };
  setup.state.context.carriedEvents = [event, event];
  expect(militiaSetupSchema.safeParse(setup).success).toBe(false);
});

test('[setup.rank-cap] rank above the PC cap is a visible, preserved deviation', () => {
  const setup = newMilitiaSetup('Loyalty');
  setup.state.militiaSnapshot.rank = 6;
  setup.state.militiaSnapshot.roster.people = [
    { characterId: 'pc', kind: 'pc', hitDice: 2 },
  ];
  setup.state.militiaSnapshot.characters = [
    {
      characterId: 'pc',
      level: 2,
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      isActive: true,
    },
  ];
  const plan = prepareMilitiaSetup(setup, 'cap');
  expect(plan.snapshot.rank).toBe(6);
  expect(plan.warnings).toContain('Rank exceeds the highest active PC level.');
});

test('[setup.required-facts] incomplete delivery timing cannot be stranded in a started week', async () => {
  const { militiaSetupSchema } = await import('./canonical-setup');
  const setup = newMilitiaSetup('Loyalty');
  setup.state.militiaSnapshot.settlements = [
    {
      settlementId: 'home',
      name: 'Home',
      reputation: 'Indifferent',
      secured: false,
      occupied: false,
      temporaryReputationShift: 0,
      refugeActivatedWeek: null,
      refugeActiveUntilWeek: null,
    },
  ];
  setup.state.militiaSnapshot.economy!.items = [
    {
      itemId: 'item',
      name: 'Item',
      valueCopper: 0,
      weight: 0,
      location: 'order',
    },
  ];
  setup.state.militiaSnapshot.economy!.orders = [
    {
      orderId: 'order',
      itemId: 'item',
      settlementId: 'home',
      source: 'special_order',
      mode: 'purchase',
      orderedWeek: 1,
      orderedDay: 0,
      dueDay: null,
      dueActivityWeek: null,
      priceCopper: 0,
      deliveryDays: null,
      enchantmentValueCopper: 0,
      receipt: null,
    },
  ];
  expect(militiaSetupSchema.safeParse(setup).success).toBe(false);
  setup.state.militiaSnapshot.economy!.orders[0]!.dueDay = 1;
  expect(militiaSetupSchema.safeParse(setup).success).toBe(true);
});

test('[rules.U01.setup-existing] resumed militias run Upkeep despite a stale first-week flag', () => {
  for (const week of [1, 9, 40]) {
    const setup = newMilitiaSetup('Loyalty');
    setup.mode = 'existing';
    setup.state.week = week;
    const plan = prepareMilitiaSetup(setup, 'resumed');
    expect(plan.draft.context.firstMilitiaWeek).toBe(false);
    expect(projectUpkeep(plan.draft, plan.snapshot).skipped).toBe(false);
    expect(setup.state.context.firstMilitiaWeek).toBe(true);
  }
  const fresh = newMilitiaSetup('Loyalty');
  fresh.state.week = 40;
  const plan = prepareMilitiaSetup(fresh, 'new-at-week-40');
  expect(projectUpkeep(plan.draft, plan.snapshot).skipped).toBe(true);
});
