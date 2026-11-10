import { expect, test } from 'vitest';
import { createMemoryDraftAuthority } from '~/lib/memory-draft-persistence';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import {
  workspaceSourceSchema,
  type WorkspaceSource,
} from '~/lib/weekly-workspace-source';
import type { WorkspaceGateway } from '~/components/weekly-draft-workspace/gateway';
import { createWorkspace } from '~/components/weekly-draft-workspace/store';
import type {
  Phase,
  PhaseReadiness,
} from '~/components/weekly-draft-workspace/types';
import { persistentEventFixture } from '../../../tests/rules/persistent-event-fixture';
import { roll, upkeepFixture } from '../../../tests/rules/upkeep-fixture';
import { continuePhase, continueTarget } from './continue-week';

const order: Phase[] = ['upkeep', 'activity', 'event', 'persistent', 'summary'];

// Every phase ready and available unless the case says otherwise.
function phases(
  patch: Partial<Record<Phase, Partial<PhaseReadiness>>> = {},
): PhaseReadiness[] {
  return order.map((phase) => ({
    phase,
    available: true,
    ready: true,
    requirements: [],
    warnings: [],
    ...patch[phase],
  }));
}
const unready = { ready: false, requirements: [{ id: 'x', message: 'x' }] };

test.each(['upkeep', 'activity', 'event', 'persistent'] as const)(
  'Continue opens %s when it is the first unready phase',
  (phase) => {
    const later = order.slice(order.indexOf(phase) + 1);
    expect(
      continuePhase(
        phases({
          [phase]: unready,
          ...Object.fromEntries(later.map((item) => [item, unready])),
        }),
      ),
    ).toBe(phase);
  },
);

test('an ineligible Persistent phase is skipped even when it is not ready', () => {
  expect(
    continuePhase(phases({ persistent: { ...unready, available: false } })),
  ).toBe('summary');
  expect(
    continuePhase(
      phases({
        persistent: { ...unready, available: false },
        summary: unready,
      }),
    ),
  ).toBe('summary');
});

test('warnings alone do not stop Continue, and all ready opens review', () => {
  expect(
    continuePhase(
      phases({
        upkeep: { warnings: [{ id: 'w', message: 'Heads up' }] },
        event: { warnings: [{ id: 'w', message: 'Heads up' }] },
      }),
    ),
  ).toBe('summary');
  // A skipped first-week Upkeep is ready.
  expect(continuePhase(phases({ upkeep: { skipped: true } }))).toBe('summary');
});

function source(draft: WeeklyDraft, snapshot: WorkspaceSource['snapshot']) {
  return workspaceSourceSchema.parse({
    key: {
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: draft.draftId,
    },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [],
  });
}

// The Week frame's own readiness for the same accepted draft.
async function weekFrameTarget(
  draft: WeeklyDraft,
  workspaceSource: WorkspaceSource,
) {
  const authority = createMemoryDraftAuthority(draft, workspaceSource.snapshot);
  const gateway: WorkspaceGateway = {
    subscribe(next) {
      next(workspaceSource);
      return () => undefined;
    },
    transport: () => authority.transport,
  };
  const workspace = createWorkspace(gateway);
  const stop = workspace.start();
  try {
    await expect.poll(() => workspace.getSnapshot().status).toBe('ready');
    const snapshot = workspace.getSnapshot();
    if (snapshot.status !== 'ready') throw new Error('Expected ready');
    return continuePhase(snapshot.phases);
  } finally {
    stop();
  }
}

function drafts() {
  const openUpkeep = upkeepFixture();
  const firstWeek = upkeepFixture();
  firstWeek.draft.context = {
    ...firstWeek.draft.context,
    firstMilitiaWeek: true,
  };
  const allReady = upkeepFixture();
  allReady.draft.context = {
    ...allReady.draft.context,
    firstMilitiaWeek: true,
  };
  allReady.draft.event.chanceRoll = roll(100, 100);
  return {
    openUpkeep,
    firstWeek,
    allReady,
    persistent: persistentEventFixture(),
  };
}

test.each(Object.keys(drafts()) as (keyof ReturnType<typeof drafts>)[])(
  'home chooses the same phase as the Week frame for the %s draft',
  async (name) => {
    const { draft, snapshot } = drafts()[name];
    const workspaceSource = source(draft, snapshot);
    const target = continueTarget(draft, workspaceSource);
    expect(target.week).toBe(draft.week);
    expect(target.phase).toBe(await weekFrameTarget(draft, workspaceSource));
  },
);

test('each accepted draft opens its first unready phase in rules order', () => {
  const { openUpkeep, firstWeek, allReady } = drafts();
  expect(
    continueTarget(
      openUpkeep.draft,
      source(openUpkeep.draft, openUpkeep.snapshot),
    ),
  ).toEqual({ week: 40, phase: 'upkeep' });
  // The first week skips Upkeep; its Event chance roll is still undecided.
  expect(
    continueTarget(firstWeek.draft, source(firstWeek.draft, firstWeek.snapshot))
      .phase,
  ).toBe('event');
  expect(
    continueTarget(allReady.draft, source(allReady.draft, allReady.snapshot))
      .phase,
  ).toBe('summary');
});

test('Persistent follows the week fixed eligibility, not later event changes', () => {
  const { draft, snapshot } = persistentEventFixture('theft');
  draft.context = { ...draft.context, firstMilitiaWeek: true };
  draft.event.chanceRoll = roll(100, 100);
  // A mitigation attempt still waits for its check.
  draft.persistent.decisions = [{ kind: 'mitigate', eventId: 'carried' }];
  expect(continueTarget(draft, source(draft, snapshot)).phase).toBe(
    'persistent',
  );
  // The same unready decision never opens Persistent in an ineligible week.
  draft.context = { ...draft.context, persistentPhaseEligible: false };
  expect(continueTarget(draft, source(draft, snapshot)).phase).not.toBe(
    'persistent',
  );
});
