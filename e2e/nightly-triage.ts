import { execFileSync, type StdioOptions } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import { z } from 'zod';
import {
  failureCatalog,
  historySchema,
  recurringFailures,
  summarizeNightly,
} from './support/nightly-history';
import { HarnessFailure } from './support/diagnostics';
import { classifyError, failureReport } from './support/setup-failure';

// gh's stderr is never forwarded; a failure still reports its exit status.
const quiet: StdioOptions = ['ignore', 'pipe', 'ignore'];

const mode = process.argv[2];
// An uncaught execFileSync error would make Node print the command's
// arguments and captured output; report only fixed text and a closed class.
async function triage() {
  if (mode === 'summarize') {
    const root = 'e2e-artifacts/e2e-local-ci-slot-0';
    const reports = await readdir(root).catch(() => []);
    const report =
      reports.length === 1
        ? await readFile(join(root, reports[0]!, 'report.json'), 'utf8')
            .then((value) => JSON.parse(value) as unknown)
            .catch(() => null)
        : null;
    await writeFile(
      'nightly-summary.json',
      JSON.stringify(summarizeNightly(report)),
    );
  } else if (mode === 'publish') {
    const repository = process.env.GITHUB_REPOSITORY!;
    const runId = Number(process.env.GITHUB_RUN_ID);
    const api = (path: string) =>
      JSON.parse(
        execFileSync('gh', ['api', path], {
          encoding: 'utf8',
          maxBuffer: 32_000_000,
          stdio: quiet,
        }),
      ) as unknown;
    const runs = z
      .object({
        workflow_runs: z.array(
          z.object({
            id: z.number(),
            run_number: z.number(),
            status: z.string(),
          }),
        ),
      })
      .parse(
        api(
          `repos/${repository}/actions/workflows/e2e-nightly.yaml/runs?per_page=100`,
        ),
      ).workflow_runs;
    const current = runs.find((run) => run.id === runId);
    if (!current) throw new HarnessFailure({ kind: 'triage-current-missing' });
    const previous = runs
      .filter(
        (run) =>
          run.run_number < current.run_number && run.status === 'completed',
      )
      .slice(0, 19);
    const history = [
      historySchema.parse(
        JSON.parse(await readFile('nightly-summary.json', 'utf8')),
      ),
    ];
    for (const run of previous) {
      const artifacts = z
        .object({
          artifacts: z.array(
            z.object({
              id: z.number(),
              name: z.string(),
              expired: z.boolean(),
            }),
          ),
        })
        .parse(
          api(`repos/${repository}/actions/runs/${run.id}/artifacts`),
        ).artifacts;
      const artifact = artifacts.find(
        (item) => item.name === 'nightly-summary' && !item.expired,
      );
      if (!artifact) {
        // Unknown history cannot establish a recurrence.
        history.push({ failures: [] });
        continue;
      }
      const archive = execFileSync(
        'gh',
        ['api', `repos/${repository}/actions/artifacts/${artifact.id}/zip`],
        { maxBuffer: 2_000_000, stdio: quiet },
      );
      const data = unzipSync(archive)['nightly-summary.json'];
      if (!data)
        throw new HarnessFailure({ kind: 'triage-history-incomplete' });
      history.push(
        historySchema.parse(JSON.parse(Buffer.from(data).toString('utf8'))),
      );
    }
    const keys = recurringFailures(history).filter((key) =>
      failureCatalog.some((failure) => failure.key === key.split(':')[0]),
    );
    if (keys.length) {
      // Listing all states also finds closed issues so recurrence reopens one ticket.
      const issues = z
        .array(
          z.array(
            z.object({
              number: z.number(),
              body: z.string().nullable(),
              state: z.string(),
            }),
          ),
        )
        .parse(
          JSON.parse(
            execFileSync(
              'gh',
              [
                'api',
                '--paginate',
                '--slurp',
                `repos/${repository}/issues?state=all&per_page=100`,
              ],
              { encoding: 'utf8', maxBuffer: 32_000_000, stdio: quiet },
            ),
          ),
        )
        .flat();
      for (const key of keys) {
        const failure = failureCatalog.find(
          (item) => item.key === key.split(':')[0],
        )!;
        const marker = `<!-- nightly-failure:${key} -->`;
        const count = history.filter((run) =>
          run.failures.includes(key),
        ).length;
        const body = `${marker}\nRecurring nightly failure: **${failure.project}** — ${failure.journey}.\n\nFailed in ${count} of the last ${history.length} runs (maximum window: 20). Expected: every selected journey passes on its first attempt.\n\n[Latest run and sanitized evidence](https://github.com/${repository}/actions/runs/${runId}). The safe report identifies observing players, assertion expectations and last visible state.\n\nNightly compatibility is advisory and does not change the E2E required merge result.\n`;
        await writeFile('nightly-issue.md', body);
        const existing = issues.find((issue) => issue.body?.includes(marker));
        if (existing) {
          if (existing.state === 'closed')
            execFileSync(
              'gh',
              [
                'issue',
                'reopen',
                String(existing.number),
                '--repo',
                repository,
              ],
              { stdio: quiet },
            );
          execFileSync(
            'gh',
            [
              'issue',
              'edit',
              String(existing.number),
              '--repo',
              repository,
              '--body-file',
              'nightly-issue.md',
            ],
            { stdio: quiet },
          );
        } else {
          execFileSync(
            'gh',
            [
              'issue',
              'create',
              '--repo',
              repository,
              '--title',
              `Nightly: ${failure.project} — ${failure.journey}`,
              '--body-file',
              'nightly-issue.md',
            ],
            { stdio: quiet },
          );
        }
      }
    }
  } else {
    throw new HarnessFailure({ kind: 'triage-usage' });
  }
}

try {
  await triage();
} catch (error) {
  process.stderr.write(
    `${
      error instanceof HarnessFailure
        ? failureReport(error).join('\n')
        : `E2E nightly triage failed (${classifyError(error)})`
    }\n`,
  );
  process.exitCode = 1;
}
