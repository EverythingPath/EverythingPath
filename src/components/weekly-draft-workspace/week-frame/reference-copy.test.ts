import { expect, test } from 'vitest';
import type { PhaseReadiness } from '../types';
import {
  actionsLine,
  awaitingDecisions,
  carriedEventLine,
  eventChanceLine,
  formatGold,
  notYetRecruited,
  officerRoles,
  stripReadiness,
  stripValues,
  teamRows,
  valueRows,
} from './reference-copy';
import { referenceFactsFixture } from './reference-test-fixture';

test('copper is shown as gp without inventing precision', () => {
  expect(formatGold(5000)).toBe('50 gp');
  expect(formatGold(5050)).toBe('50.5 gp');
  expect(formatGold(0)).toBe('0 gp');
});

test('After the week says it is awaiting decisions until a final outcome exists', () => {
  const rows = valueRows(referenceFactsFixture());
  expect(rows.map((row) => [row.label, row.now, row.after])).toEqual([
    ['Rank', '2', awaitingDecisions],
    ['Training', '14', awaitingDecisions],
    ['Treasury', '50 gp · minimum 20 gp', awaitingDecisions],
    ['Notoriety', '1', awaitingDecisions],
    ['Focus', 'Loyalty', awaitingDecisions],
  ]);
  expect(stripValues(referenceFactsFixture())).toEqual([
    { label: 'Training', value: '14 → …' },
    { label: 'Treasury', value: '50 gp → …' },
  ]);
});

test('a final outcome fills After, an unsupported minimum and unset focus stay honest', () => {
  const facts = referenceFactsFixture();
  const after = {
    ...facts.now,
    training: 17,
    treasuryCopper: 6100,
    minimumTreasuryCopper: null,
    focus: null,
  };
  const rows = valueRows({ ...facts, after });
  expect(rows[1]).toEqual({
    key: 'Training',
    label: 'Training',
    now: '14',
    after: '17',
  });
  expect(rows[2]!.after).toBe('61 gp · minimum unknown');
  expect(rows[4]!.after).toBe('Not set');
  expect(stripValues({ ...facts, after })).toEqual([
    { label: 'Training', value: '14 → 17' },
    { label: 'Treasury', value: '50 gp → 61 gp' },
  ]);
  // An unchanged value is not repeated with an arrow.
  expect(
    stripValues({ ...facts, after: { ...after, training: 14 } })[0]!.value,
  ).toBe('14');
});

test('team conditions keep the exceptional blocked status and follow the final roster', () => {
  const facts = referenceFactsFixture();
  expect(teamRows(facts)).toEqual([
    {
      key: 'wardens',
      label: 'Iron Wardens',
      now: 'Active',
      after: awaitingDecisions,
    },
    {
      key: 'scouts',
      label: 'Ashen Scouts',
      now: 'Blocked',
      after: awaitingDecisions,
    },
  ]);
  const after = {
    ...facts.now,
    teams: [
      { teamId: 'wardens', name: 'Iron Wardens', status: 'missing' as const },
    ],
  };
  expect(teamRows({ ...facts, after })).toEqual([
    { key: 'wardens', label: 'Iron Wardens', now: 'Active', after: 'Missing' },
    { key: 'scouts', label: 'Ashen Scouts', now: 'Blocked', after: 'Gone' },
  ]);
});

test('this week facts are labelled as draft context and provisional when upstream is incomplete', () => {
  const facts = referenceFactsFixture();
  expect(actionsLine(facts)).toBe(
    '1 of 2 used · provisional until Upkeep is ready',
  );
  expect(eventChanceLine(facts)).toBe(
    '35% · provisional until Upkeep and Activity are ready',
  );
  expect(
    actionsLine({
      ...facts,
      thisWeek: {
        ...facts.thisWeek,
        actions: { used: 0, allowance: null, provisional: false },
      },
    }),
  ).toBe('0 used · allowance unavailable');
  expect(
    eventChanceLine({
      ...facts,
      thisWeek: {
        ...facts.thisWeek,
        eventChance: { percent: 100, guaranteed: true, provisional: false },
      },
    }),
  ).toBe('100% · an event is guaranteed');
  expect(
    eventChanceLine({
      ...facts,
      thisWeek: { ...facts.thisWeek, eventChance: null },
    }),
  ).toBe('Unavailable');
});

test('officer roles read as names, a member without a role says so, carried events name the militia', () => {
  expect(officerRoles(['commandant', 'marshal'])).toBe('Commandant, Marshal');
  expect(officerRoles([])).toBe('No officer role');
  expect(
    carriedEventLine({
      eventId: 'x',
      name: 'Theft',
      ageWeeks: 3,
      targetNames: [],
    }),
  ).toBe('Theft · 3 weeks · Militia');
  expect(
    carriedEventLine({
      eventId: 'x',
      name: 'Riot',
      ageWeeks: 1,
      targetNames: ['Phaendar'],
    }),
  ).toBe('Riot · 1 weeks · Phaendar');
});

test('the strip readiness prefers open decisions, then warnings, and Review & confirm shows only the reason', () => {
  const step = (over: Partial<PhaseReadiness>): PhaseReadiness => ({
    phase: 'activity',
    available: true,
    ready: true,
    requirements: [],
    warnings: [],
    ...over,
  });
  const item = (id: string) => ({ id, message: id });
  expect(stripReadiness(step({}), null)).toBe('');
  expect(
    stripReadiness(
      step({ requirements: [item('a'), item('b')], warnings: [item('w')] }),
      null,
    ),
  ).toBe('2 to decide');
  expect(stripReadiness(step({ warnings: [item('w')] }), null)).toBe(
    '1 warning',
  );
  expect(stripReadiness(step({ warnings: [item('w'), item('x')] }), null)).toBe(
    '2 warnings',
  );
  expect(
    stripReadiness(step({ phase: 'persistent', available: false }), null),
  ).toBe('');
  expect(
    stripReadiness(
      step({ phase: 'summary', requirements: [item('a')] }),
      '1 decision left',
    ),
  ).toBe('1 decision left');
  expect(stripReadiness(step({ phase: 'summary' }), null)).toBe('');
});

test('a team recruited this week appears with an honest Now and rows keep team identity as keys', () => {
  const facts = referenceFactsFixture();
  const after = {
    ...facts.now,
    teams: [
      { teamId: 'wardens', name: 'Iron Wardens', status: 'active' as const },
      { teamId: 'scouts', name: 'Ashen Scouts', status: 'active' as const },
      { teamId: 'new', name: 'Iron Wardens', status: 'active' as const },
    ],
  };
  const rows = teamRows({ ...facts, after });
  expect(rows).toEqual([
    { key: 'wardens', label: 'Iron Wardens', now: 'Active', after: 'Active' },
    { key: 'scouts', label: 'Ashen Scouts', now: 'Blocked', after: 'Active' },
    {
      key: 'new',
      label: 'Iron Wardens',
      now: notYetRecruited,
      after: 'Active',
    },
  ]);
  // Two teams may share a name; their keys still differ.
  expect(new Set(rows.map((row) => row.key)).size).toBe(3);
  // Without a final outcome a recruit is not yet known at all.
  expect(teamRows(facts).map((row) => row.key)).toEqual(['wardens', 'scouts']);
});
