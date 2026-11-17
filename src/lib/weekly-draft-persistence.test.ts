import { test } from 'vitest';
import { createWeeklyDraft } from './weekly-draft';
import { createMemoryDraftAuthority } from './memory-draft-persistence';
import { runPersistenceContract } from '../../tests/persistence/contracts';

test('[rules.P79.contract] shared persistence contract uses deterministic memory', async () => {
  await runPersistenceContract(async () => {
    const draft = createWeeklyDraft({
      draftId: 'contract',
      week: 1,
      slotIds: ['left', 'right', 'extra'],
      context: {
        firstMilitiaWeek: true,
        startDay: 0,
        uneventfulCarry: false,
        carriedEvents: [],
        queuedEffects: [],
        orders: [],
        lastBuyoffWeek: null,
      },
    });
    const authority = createMemoryDraftAuthority(draft, {
      rank: 1,
      training: 0,
      treasuryCopper: 100,
      notoriety: 0,
      focus: 'Loyalty',
      roster: { people: [], teams: [], officers: [] },
      characters: [],
      settlements: [],
      bonuses: [],
    });
    return {
      first: authority.transport,
      second: authority.transport,
      close: async () => authority.close(),
      dispose: async () => authority.close(),
    };
  });
});
