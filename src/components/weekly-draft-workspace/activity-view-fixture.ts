import { fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import { activityRollSpec } from '~/lib/rules-roll-spec';
import {
  actionChoiceRolls,
  type StagedActionChoice,
} from '~/lib/weekly-draft-facts';
import { activityLabel } from './activity-labels';
import type { ActivityView } from './types';

type Slot = ActivityView['slots'][number];

// Hand-built Activity facts for presentation tests. The check and recorded
// modifiers follow the choice unless a test supplies its own facts.
export function activitySlot(
  choice: StagedActionChoice | null,
  overrides: Partial<Slot> = {},
): Slot {
  const spec = choice ? activityRollSpec(choice.actionId, 'check') : null;
  const recorded = choice ? actionChoiceRolls(choice).check : undefined;
  const requirements = overrides.requirements ?? [];
  return {
    slotId: 'one',
    choice,
    number: 1,
    actionName: choice ? activityLabel(choice.actionId) : null,
    overAllowance: false,
    strategistBonus: false,
    allowance: 2,
    beyondAllowance: false,
    allowanceKnown: true,
    status: !choice
      ? { kind: 'empty' }
      : requirements.length
        ? { kind: 'todo', count: requirements.length }
        : { kind: 'ready' },
    issues: [],
    warningCount: 0,
    removable: false,
    team: choice?.teamId
      ? { teamId: choice.teamId, name: choice.teamId }
      : null,
    check: spec
      ? {
          spec,
          organizationCheck: null,
          dc: null,
          modifier: null,
          total: null,
          succeeded: null,
          breakdown: [],
        }
      : null,
    modifiers: (recorded?.modifiers ?? []).map((modifier, index) => ({
      index,
      sourceId: modifier.sourceId,
      kind: modifier.sourceId === 'helpful' ? 'helpful' : 'custom',
      label: modifier.reason,
      value: modifier.value,
      reason: modifier.reason,
      warning: null,
    })),
    bonusChoices: [],
    calculatedCostCopper: null,
    warnings: [],
    exceptions: [],
    position: null,
    ...overrides,
    requirements,
  };
}

export function activityFacts(
  slots: Slot[],
  overrides: Partial<ActivityView> = {},
): ActivityView {
  return {
    phase: 'activity',
    ready: false,
    occupiedSlots: slots.filter((slot) => slot.choice).length,
    allowance: {
      occupied: slots.filter((slot) => slot.choice).length,
      actions: 2,
      rank: 3,
      rankActions: 2,
      strategist: false,
      changes: [],
      removalBlocked: null,
    },
    slots,
    teamRoster: [],
    candidateSets: [],
    helpful: null,
    operating: { selected: null, missing: false, choices: [] },
    blockedActions: [],
    actions: [],
    items: [],
    caches: [],
    events: [],
    bonuses: [],
    startDay: 21,
    automaticSources: [],
    modifierSources: [
      { value: 'helpful', label: 'Helpful settlement support' },
    ],
    teams: [],
    settlements: [],
    people: [],
    characters: [],
    operatingSettlementId: null,
    checks: [],
    requirements: [],
    warnings: [],
    ...overrides,
  };
}

// Selecting an occupied slot shows its details below the board.
export function selectSlot(action: string, number = 1) {
  fireEvent.click(
    screen.getByRole('button', { name: `Action Slot ${number} · ${action}` }),
  );
}

// A Workspace edit that the (fake) persistence accepts.
export function acceptingEdit() {
  return vi.fn<(edit: WeeklyDraftEdit) => Promise<'accepted' | 'failed'>>(() =>
    Promise.resolve('accepted'),
  );
}
