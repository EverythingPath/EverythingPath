import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { z } from 'zod';
import { runT3ReviewCodeMode } from '../../scripts/catalog/t3-review-code-mode';

const exec = promisify(execFile);
const repo = fileURLToPath(new URL('../../', import.meta.url));
export const syntheticStatus = () => ({
  taskId: 'synthetic:task',
  childThreadId: 'synthetic:thread',
  childNodeId: 'synthetic:node',
  childRunId: 'synthetic:run:1',
  providerInstanceId: 'codex',
  model: 'gpt-6-astra',
  options: [
    { id: 'reasoningEffort', value: 'high' },
    { id: 'serviceTier', value: 'default' },
  ],
  status: 'completed',
  workState: 'result_available',
  hasPendingChildRuns: false,
  hasPendingQuestion: false,
  pendingApproval: null,
  latestTerminalRunId: 'synthetic:run:1',
  latestTerminalStatus: 'completed',
  waitTimedOut: false,
  summary: 'Synthetic fixture confirmation.',
  resultContextTransferId: 'synthetic:result',
});
export function syntheticPage({
  task,
  offset = 0,
  threadId = 'synthetic:thread',
}: {
  task: string;
  offset?: number;
  threadId?: string;
}) {
  const end = Math.min(task.length, offset + 2048);
  return {
    thread: {
      threadId,
      parentThreadId: 'synthetic:parent',
      relationshipToParent: 'subagent',
      createdBy: 'agent',
      creationSource: 'mcp',
      createdAt: '2026-10-23T00:00:00Z',
      latestRunId: 'synthetic:run:1',
      activeRunId: null,
      runCount: 1,
      pendingRequestCount: 0,
    },
    recentRuns: [], // Not an exhaustive run history; never used for the original join.
    items: [
      {
        itemId: 'synthetic:item:original',
        messageId: 'synthetic:message:original',
        position: 0,
        runId: 'synthetic:run:1',
        sourceThreadId: threadId,
        senderThreadId: 'synthetic:parent',
        visibility: 'local',
        type: 'user_message',
        createdBy: 'agent',
        creationSource: 'mcp',
        status: 'completed',
        title: null,
        updatedAt: '2026-10-23T00:00:00Z',
        text: task.slice(offset, end),
        textTruncated: end < task.length,
        nextTextOffset: end < task.length ? end : null,
      },
    ],
    hasMore: false,
    nextPosition: 0,
  };
}
/** Synthetic tools at the external API seam. The filesystem bridge is the real CLI. */
export async function syntheticTools({
  dir,
  task,
  status = syntheticStatus(),
  returned = status,
  mutateRead,
  mutateExec,
  caller = 'synthetic:parent',
}: {
  dir: string;
  task?: string;
  status?: unknown;
  returned?: unknown;
  caller?: string;
  mutateRead?: (
    page: ReturnType<typeof syntheticPage>,
    args: unknown,
  ) => unknown;
  mutateExec?: (args: {
    cmd: string;
  }) => { exit_code?: number; session_id?: number; output: string } | undefined;
}) {
  const frozen = z
    .object({ task: z.string() })
    .parse(JSON.parse(await readFile(`${dir}/request.json`, 'utf8')));
  const requests: unknown[] = [];
  const reads: unknown[] = [];
  const tools: Parameters<typeof runT3ReviewCodeMode>[0]['tools'] = {
    exec_command: async (args) => {
      const changed = mutateExec?.(args);
      if (changed) return changed;
      try {
        const result = await exec('bash', ['-c', args.cmd], {
          cwd: args.workdir,
          maxBuffer: 1000000,
        });
        return { exit_code: 0, output: result.stdout };
      } catch (error) {
        const parsed = z.object({ stderr: z.string() }).parse(error);
        return { exit_code: 1, output: parsed.stderr };
      }
    },
    mcp__t3_code__t3_thread_configuration: async () => ({
      structuredContent: { threadId: caller },
    }),
    mcp__t3_code__delegate_task: async (request) => {
      requests.push(request);
      return { structuredContent: returned };
    },
    mcp__t3_code__task_status: async () => ({ structuredContent: status }),
    mcp__t3_code__t3_thread_read: async (args) => {
      reads.push(args);
      const { textOffset = 0 } = z
        .object({ textOffset: z.number().optional() })
        .parse(args);
      const page = syntheticPage({
        task:
          'Act as the review sub-agent for this task.\n\n' +
          (task ?? frozen.task),
        offset: textOffset,
      });
      return { structuredContent: mutateRead ? mutateRead(page, args) : page };
    },
  };
  return {
    tools,
    requests,
    reads,
    frozen,
    execute: (operation: 'dispatch' | 'bind' | 'complete', report?: string) =>
      runT3ReviewCodeMode({ tools, root: repo, dir, operation, report }),
  };
}
