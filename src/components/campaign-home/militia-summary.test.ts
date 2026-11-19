import { expect, test } from 'vitest';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import { militiaSummaryParts } from './militia-summary';

type Snapshot = WorkspaceSource['snapshot'];
type Team = Snapshot['roster']['teams'][number];
type Settlement = Snapshot['settlements'][number];

const team = (teamId: string, status: Team['status']): Team => ({
  teamId,
  teamType: 'spies',
  name: teamId,
  status,
  rewardCapExempt: false,
  managerCharacterId: null,
  notes: '',
});
const settlement = (
  name: string,
  reputation: Settlement['reputation'],
): Settlement => ({
  settlementId: name,
  name,
  reputation,
  secured: null,
  occupied: null,
  temporaryReputationShift: 2,
  refugeActivatedWeek: null,
  refugeActiveUntilWeek: null,
});

function snapshot(patch: Partial<Snapshot> = {}): Snapshot {
  return {
    rank: 3,
    training: 30,
    treasuryCopper: 3000,
    notoriety: 0,
    focus: 'Secrecy',
    roster: { people: [], teams: [], officers: [] },
    characters: [],
    settlements: [],
    bonuses: [],
    ...patch,
  };
}

test('counts teams with each non-active condition', () => {
  expect(
    militiaSummaryParts(
      snapshot({
        roster: {
          people: [],
          officers: [],
          teams: [
            team('a', 'active'),
            team('b', 'active'),
            team('c', 'disabled'),
            team('d', 'missing'),
          ],
        },
      }),
    )[2],
  ).toBe('4 teams (1 disabled, 1 missing)');
  expect(
    militiaSummaryParts(
      snapshot({
        roster: { people: [], officers: [], teams: [team('a', 'active')] },
      }),
    )[2],
  ).toBe('1 team');
  expect(militiaSummaryParts(snapshot())[2]).toBe('No teams');
});

test('counts occupied role categories out of six, not holders', () => {
  const officers = [
    { role: 'commandant', characterId: 'a' },
    { role: 'commandant', characterId: 'b' },
    { role: 'commandant', characterId: 'c' },
    { role: 'marshal', characterId: 'a' },
  ] as const;
  expect(
    militiaSummaryParts(
      snapshot({ roster: { people: [], teams: [], officers: [...officers] } }),
    )[3],
  ).toBe('2 of 6 officer roles');
});

test('shows the stored rank, focus and settlement attitudes, never projected shifts', () => {
  expect(
    militiaSummaryParts(
      snapshot({
        settlements: [
          settlement('Phaendar', 'Friendly'),
          settlement('Crossroads', 'Indifferent'),
        ],
      }),
    ),
  ).toEqual([
    'Rank 3',
    'Secrecy',
    'No teams',
    '0 of 6 officer roles',
    'Phaendar Friendly, Crossroads Indifferent',
  ]);
  expect(
    militiaSummaryParts(
      snapshot({ focus: null, settlements: [settlement('Phaendar', null)] }),
    ),
  ).toEqual([
    'Rank 3',
    'Focus not set',
    'No teams',
    '0 of 6 officer roles',
    'Phaendar attitude unknown',
  ]);
  expect(militiaSummaryParts(snapshot())[4]).toBe('No settlements');
});
