import { expect, test } from 'vitest';
import { acceptedCampaignSetup } from '../../tests/rules/accepted-campaign';
import {
  MILITIA_ENTRY_LABELS,
  type MilitiaEntryKey,
} from './militia-correction-sections';
import {
  militiaEntryFacts,
  officerFacts,
  rosterFacts,
  type EntryFacts,
} from './militia-section-facts';

const names = new Map([['officer', 'Ada']]);
const text = (facts: EntryFacts) =>
  facts.groups
    .flatMap((group) => [
      group.title,
      ...group.rows.map((row) => `${row.label}: ${row.value}`),
      ...group.entries.flatMap((entry) => [
        entry.title,
        ...entry.rows.map((row) => `${row.label}: ${row.value}`),
      ]),
    ])
    .filter(Boolean);

function state() {
  const { state } = acceptedCampaignSetup('officer');
  state.militiaSnapshot.economy!.orders[0]!.deliveryDays = 1.5;
  state.context.carriedEvents[0]!.mitigation = {
    week: 8,
    retainedIncomePercent: 90,
  };
  return state;
}

test('every entry has readable facts, a count and a preview line', () => {
  for (const key of Object.keys(MILITIA_ENTRY_LABELS) as MilitiaEntryKey[]) {
    const facts = militiaEntryFacts(key, state(), names);
    expect(facts.groups.length).toBeGreaterThan(0);
    expect(facts.preview).not.toBe('');
  }
});

test('Values show every value with treasury in gp and copper', () => {
  const facts = militiaEntryFacts('values', state(), names);
  expect(facts.count).toBeNull();
  expect(text(facts)).toEqual([
    'Focus: Security',
    'Rank: 4',
    'Training: 42',
    'Treasury: 123.45 gp (12,345 cp)',
    'Notoriety: 17',
  ]);
  expect(facts.preview).toBe('Focus Security · Rank 4 · Training 42');
});

test('list sections name their entries and resolve references to names, never identities', () => {
  const teams = text(militiaEntryFacts('teams', state(), names));
  expect(teams).toContain('Manager: Ada');
  expect(teams).toContain('Condition: Missing');
  const orders = text(militiaEntryFacts('orders', state(), names));
  expect(orders).toEqual(
    expect.arrayContaining([
      'Sword',
      'Settlement: Town',
      'Delivery days: 1.5',
      'Due: Day 56',
      'Receipt: Not received',
    ]),
  );
  for (const line of orders) expect(line).not.toMatch(/sword-order|town\b/);
});

test('Week & carried effects shows the week, persistent events with age, targets and mitigation, queued effects and bonuses', () => {
  const facts = militiaEntryFacts('weekCarried', state(), names);
  expect(text(facts)).toEqual(
    expect.arrayContaining([
      'This week',
      'Current week: 9',
      'First militia week (skips Upkeep): No',
      'Last persistent buyoff: Week 6',
      'Sickness · Event 1',
      'Age: 2 weeks',
      'Targets: Patrol',
      'Mitigation: Week 8, 90% of income retained',
      '+2 Loyalty check',
      'Source: Reward',
    ]),
  );
  expect(facts.count).toBe(1 + state().context.queuedEffects.length + 1);
});

test('the roster conflict view shows each effective Hit Dice: the override, zero included, or else the level', () => {
  const hitDice = (value: number | null) => {
    const current = state();
    current.militiaSnapshot.roster.people[0]!.hitDice = value;
    return text(rosterFacts(current.militiaSnapshot, names)).filter((row) =>
      row?.startsWith('Hit Dice'),
    );
  };
  expect(hitDice(8)).toEqual(['Hit Dice: 8 (override)']);
  expect(hitDice(0)).toEqual(['Hit Dice: 0 (override)']);
  expect(hitDice(null)).toEqual(['Hit Dice: 12']);
});

test('the officer conflict view lists every role, vacant ones included', () => {
  const current = state().militiaSnapshot;
  const rows = text(officerFacts(current, names));
  expect(rows).toHaveLength(6);
  expect(rows).toContain('Strategist: Vacant');
});
