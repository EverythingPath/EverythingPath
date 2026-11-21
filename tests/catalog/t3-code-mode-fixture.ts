import { type ChildProcess, execFile } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { z } from 'zod';
import { runT3ReviewCodeMode } from '../../scripts/catalog/t3-review-code-mode';
import callerRead from '../fixtures/t3-thread-configure/read-own-thread.json';

const exec = promisify(execFile);
type ExecResult = {
  exit_code?: number;
  session_id?: number;
  output: string;
  original_token_count?: number;
};
const repo = fileURLToPath(new URL('../../', import.meta.url));
/**
 * The bridge processes' system temporary directory (TMPDIR) unless a test
 * gives one: a directory of its own beside the test's rounds, since every
 * round command declines a TMPDIR that contains the round it operates on, and
 * the rounds lie in the test's own TMPDIR. Removed when the process exits.
 */
let bridgeTemporary: string | undefined;
function defaultBridgeTemporary() {
  if (bridgeTemporary === undefined) {
    const made = mkdtempSync(join(tmpdir(), 't3-bridge-tmp-'));
    process.once('exit', () => rmSync(made, { recursive: true, force: true }));
    bridgeTemporary = made;
  }
  return bridgeTemporary;
}
/** Bridge processes the synthetic tools started and that are still running. */
const running = new Set<ChildProcess>();
/**
 * Kills the bridge processes the synthetic tools started that are still
 * running (each in its own process group, so a shell's child goes with it),
 * and no other process.
 */
export function killSyntheticChildren() {
  for (const child of running)
    if (child.pid !== undefined)
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        // Already gone.
      }
  running.clear();
}
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
/**
 * The direct delegate_task return as T3 recorded it in code mode
 * (`$EP_ORCH/runs/t3-review-b9b39010…/dispatch-return.json`, 2026-11-18): the
 * task as JSON text, the same task as structuredContent, and isError false.
 */
export const syntheticDirectReturn = (task: unknown) => ({
  content: [{ type: 'text', text: JSON.stringify(task) }],
  structuredContent: task,
  isError: false,
});
/**
 * Synthetic tools at the external API seam: code mode's T3 tools as recorded
 * on 2026-11-20 (no delegate_task) and the operator's direct delegate_task.
 * The filesystem bridge is the real CLI.
 */
export async function syntheticTools({
  dir,
  task,
  status = syntheticStatus(),
  returned = status,
  mutateRead,
  mutateExec,
  caller = 'synthetic:parent',
  tmp,
}: {
  dir: string;
  /**
   * The system temporary directory of the bridge processes (`TMPDIR`); by
   * default one of the fixture's own, beside the test's rounds.
   */
  tmp?: string;
  task?: string;
  status?: unknown;
  returned?: unknown;
  caller?: string;
  mutateRead?: (
    page: ReturnType<typeof syntheticPage>,
    args: unknown,
  ) => unknown;
  /** Replace a bridge call's result; `run` runs the real call (or `cmd`). */
  mutateExec?: (
    args: { cmd: string },
    run: (cmd?: string) => Promise<ExecResult>,
  ) => ExecResult | undefined | Promise<ExecResult | undefined>;
}) {
  const frozen = z
    .object({ task: z.string() })
    .parse(JSON.parse(await readFile(`${dir}/request.json`, 'utf8')));
  const requests: unknown[] = [];
  const returns: unknown[] = [];
  const reads: unknown[] = [];
  /** What each t3_thread_read returned, in order. */
  const readResults: unknown[] = [];
  const statuses: unknown[] = [];
  const configures: unknown[] = [];
  const tools: Parameters<typeof runT3ReviewCodeMode>[0]['tools'] = {
    exec_command: async (args) => {
      const run = async (cmd = args.cmd): Promise<ExecResult> => {
        // Its own process group, so killSyntheticChildren reaches the shell's
        // child too (execFile passes detached to spawn; its type omits it).
        const options = {
          cwd: args.workdir,
          maxBuffer: 1000000,
          detached: true,
          env: { ...process.env, TMPDIR: tmp ?? defaultBridgeTemporary() },
        };
        const pending = exec('bash', ['-c', cmd], options);
        running.add(pending.child);
        try {
          const result = await pending;
          return { exit_code: 0, output: result.stdout };
        } catch (error) {
          const parsed = z.object({ stderr: z.string() }).parse(error);
          return { exit_code: 1, output: parsed.stderr };
        } finally {
          running.delete(pending.child);
        }
      };
      return (await mutateExec?.(args, run)) ?? run();
    },
    // The recorded read-form result; the arguments are kept so tests can
    // assert the helper never passes modelSelection (which sets the model).
    mcp__t3_code__t3_thread_configure: async (args) => {
      configures.push(args);
      return { structuredContent: { ...callerRead, threadId: caller } };
    },
    mcp__t3_code__task_status: async (args) => {
      statuses.push(args);
      return { structuredContent: status };
    },
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
      const read = {
        structuredContent: mutateRead ? mutateRead(page, args) : page,
      };
      readResults.push(read);
      return read;
    },
  };
  // The operator's direct call, outside code mode.
  const direct = {
    delegate_task: async (request: unknown): Promise<unknown> => {
      requests.push(request);
      return syntheticDirectReturn(returned);
    },
  };
  const bind = (supplied: unknown) =>
    runT3ReviewCodeMode({
      tools,
      root: repo,
      dir,
      operation: 'bind',
      returned: supplied,
    });
  return {
    tools,
    direct,
    requests,
    returns,
    reads,
    readResults,
    statuses,
    configures,
    frozen,
    bind,
    /**
     * 'dispatch' follows the operator's procedure: the helper's prepare, the
     * direct call with request.json as read from disk, then bind with its return.
     */
    execute: async (operation: 'dispatch' | 'complete', report?: string) => {
      if (operation === 'complete') {
        if (report === undefined) throw new Error('complete takes a report.');
        return runT3ReviewCodeMode({
          tools,
          root: repo,
          dir,
          operation,
          report,
        });
      }
      await runT3ReviewCodeMode({
        tools,
        root: repo,
        dir,
        operation: 'prepare',
      });
      const request: unknown = JSON.parse(
        await readFile(`${dir}/request.json`, 'utf8'),
      );
      const response = await direct.delegate_task(request);
      returns.push(response);
      return bind(response);
    },
  };
}
