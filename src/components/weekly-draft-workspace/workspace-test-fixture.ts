import { createWeeklyDraft } from '~/lib/weekly-draft';
import { createMemoryDraftAuthority } from '~/lib/memory-draft-persistence';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { WorkspaceGateway } from './gateway';

// A memory-backed Workspace environment for UI tests: real store, real
// persistence client, controlled delivery. `hold()` delays every send until
// the returned release runs, so pending work can be observed deterministically.
export function workspaceFixture() {
  const draft = createWeeklyDraft({
    draftId: 'workspace',
    week: 4,
    slotIds: ['left'],
    context: {
      firstMilitiaWeek: false,
      startDay: 21,
      uneventfulCarry: false,
      carriedEvents: [],
      queuedEffects: [],
      orders: [],
      lastBuyoffWeek: null,
    },
  });
  const source = workspaceSourceSchema.parse({
    key: {
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: draft.draftId,
    },
    week: draft.week,
    sourceRevision: 0,
    snapshot: {
      rank: 2,
      training: 14,
      treasuryCopper: 5000,
      notoriety: 0,
      focus: 'Loyalty',
      roster: { people: [], teams: [], officers: [] },
      characters: [],
      settlements: [],
      bonuses: [],
    },
    people: [],
  });
  const authority = createMemoryDraftAuthority(draft, source.snapshot);
  let holding: Promise<void> | null = null;
  const gateway: WorkspaceGateway = {
    subscribe(next) {
      next(source);
      return () => undefined;
    },
    transport: () => ({
      ...authority.transport,
      async send(operation) {
        if (holding) await holding;
        return authority.transport.send(operation);
      },
    }),
  };
  return {
    gateway,
    authority,
    source,
    hold() {
      let release!: () => void;
      holding = new Promise<void>((resolve) => {
        release = resolve;
      });
      return () => {
        holding = null;
        release();
      };
    },
  };
}

export function upkeepRoll(field: 'check' | 'training', value: number) {
  return {
    kind: 'upkeep_roll' as const,
    field,
    roll: {
      diceTotal: value,
      diceCount: 1,
      sides: field === 'check' ? 20 : 6,
      provenance: { kind: 'table' as const },
      modifiers: [],
    },
  };
}
