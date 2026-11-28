import type { ReferenceFacts } from '../reference-facts';
import type { ReferencePanel } from './use-reference-panel';

// Hand-built reference facts and panel state for component tests. The
// shapes are the store's; the values are arbitrary but internally honest
// (After is null until a final outcome exists).
export function referenceFactsFixture(
  overrides: Partial<ReferenceFacts> = {},
): ReferenceFacts {
  return {
    now: {
      rank: 2,
      training: 14,
      treasuryCopper: 5000,
      minimumTreasuryCopper: 2000,
      notoriety: 1,
      focus: 'Loyalty',
      teams: [
        { teamId: 'wardens', name: 'Iron Wardens', status: 'active' },
        { teamId: 'scouts', name: 'Ashen Scouts', status: 'blocked' },
      ],
    },
    after: null,
    thisWeek: {
      actions: { used: 1, allowance: 2, provisional: true },
      eventChance: { percent: 35, guaranteed: false, provisional: true },
    },
    officers: [
      { characterId: 'a', name: 'Aldric', roles: ['commandant', 'marshal'] },
      { characterId: 'b', name: 'Unnamed character', roles: [] },
    ],
    carriedEvents: [
      { eventId: 'theft', name: 'Theft', ageWeeks: 3, targetNames: [] },
    ],
    afterCarriedEvents: null,
    ...overrides,
  };
}

export function referencePanelFixture(
  overrides: Partial<ReferencePanel> = {},
): ReferencePanel {
  return {
    open: true,
    setOpen: () => undefined,
    sheetOpen: false,
    setSheetOpen: () => undefined,
    tab: 'militia',
    setTab: () => undefined,
    campaignId: 'campaign' as ReferencePanel['campaignId'],
    history: { status: 'idle', weeks: [], retry: () => undefined },
    ...overrides,
  };
}
