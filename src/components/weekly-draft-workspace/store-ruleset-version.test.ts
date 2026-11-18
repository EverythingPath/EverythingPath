import { expect, test, vi } from 'vitest';
import * as resolution from '../../lib/canonical-weekly-resolution';
import { createMemoryDraftAuthority } from '../../lib/memory-draft-persistence';
import { workspaceSourceSchema } from '../../lib/weekly-workspace-source';
import { upkeepFixture } from '../../../tests/rules/upkeep-fixture';
import { createWorkspace } from './store';

vi.mock('../../lib/canonical-weekly-resolution', async (original) => {
  const actual = await original<typeof resolution>();
  return { ...actual, projectWeeklyDraft: vi.fn(actual.projectWeeklyDraft) };
});

// #413 F6c: local previews use the Ruleset Version `clientStatus` reported.
test('local previews use the deployment Ruleset Version once it is known, and the current one before', async () => {
  const { draft, snapshot } = upkeepFixture();
  const source = workspaceSourceSchema.parse({
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
  const authority = createMemoryDraftAuthority(draft, snapshot);
  const workspace = createWorkspace({
    subscribe(next) {
      next(source);
      return () => undefined;
    },
    transport: () => authority.transport,
  });
  const project = vi.mocked(resolution.projectWeeklyDraft);
  const stop = workspace.start();
  try {
    await expect.poll(() => workspace.getSnapshot().status).toBe('ready');
    expect(project.mock.lastCall?.[0].rulesetVersion).toBeUndefined();
    workspace.setRulesetVersion(10);
    expect(project.mock.lastCall?.[0].rulesetVersion).toBe(10);
    const calls = project.mock.calls.length;
    workspace.setRulesetVersion(10);
    expect(project.mock.calls).toHaveLength(calls);
  } finally {
    stop();
  }
});
