// @vitest-environment node
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';

const read = (name: string) =>
  readFileSync(join(process.cwd(), '.github', 'workflows', name), 'utf8');
const workflow = read('e2e-runner.yaml');

it("derives the runner's deadline from the job's budget, which each caller sets for its suite", () => {
  // The budget starts with the job, before checkout and installation.
  expect(workflow).toContain(
    'echo "E2E_DEADLINE=$(( $(date +%s) + BUDGET_SECONDS ))" >> "$GITHUB_ENV"',
  );
  expect(workflow).toContain('BUDGET_SECONDS: ${{ inputs.budget_seconds }}');
  expect(workflow).toContain('timeout-minutes: ${{ inputs.timeout_minutes }}');
  // The runner ends its run, reaps and finalizes before this interrupt.
  expect(workflow).toMatch(
    /timeout --signal=INT --kill-after=5s "\$\{remaining\}s" pnpm test:e2e --resources e2e\/resources\.ci\.json --outer-deadline-epoch "\$E2E_DEADLINE" "\$\{args\[@\]\}"/,
  );
  expect(workflow).toContain('args=(--suite "$SUITE")');
});

it('never compares an actor with the repository owner, which is the organization', () => {
  const actor = String.raw`github\.(?:actor|triggering_actor|event\.pull_request\.user\.login)`;
  const owner = String.raw`github\.repository_owner`;
  const comparison = new RegExp(
    `${actor}\\s*[!=]=\\s*${owner}|${owner}\\s*[!=]=\\s*${actor}`,
  );
  const files = readdirSync(join(process.cwd(), '.github', 'workflows')).filter(
    (name) => /\.ya?ml$/.test(name),
  );
  expect(files).toContain('e2e.yaml');
  expect(files.filter((name) => comparison.test(read(name)))).toEqual([]);
});

it.each([
  // D-17: provisional until the new mandatory suite is measured on GitHub.
  ['e2e.yaml', 'mandatory', 1050, 20],
  // D-12: the nightly full regression and compatibility projects.
  ['e2e-nightly.yaml', 'nightly', 2700, 48],
] as const)(
  '%s runs the %s suite with a %i-second budget and at least 2.5 minutes more for the job',
  (file, suite, budget, minutes) => {
    const caller = read(file);
    expect(caller).toContain(`suite: ${suite}`);
    expect(caller).toContain(`budget_seconds: ${budget}`);
    expect(caller).toContain(`timeout_minutes: ${minutes}`);
    expect(minutes * 60 - budget).toBeGreaterThanOrEqual(150);
  },
);

type Step = { name?: string; id?: string; run?: string; if?: string };
const workflows = () =>
  readdirSync(join(process.cwd(), '.github', 'workflows'))
    .filter((name) => /\.ya?ml$/.test(name))
    .flatMap((file) =>
      Object.entries(
        (parse(read(file)) as { jobs: Record<string, { steps?: Step[] }> })
          .jobs,
      ).map(([job, { steps = [] }]) => ({ file, job, steps })),
    );
// A step that runs the Vitest suite, which holds real-Chromium support tests
// (control-geometry.test.ts, #774): `pnpm test`, the rules coverage
// collection, the gate's remote heavy checks (each suite shard; the
// assemble job's merge reads blob reports and runs no test) and WIP CI's
// shards. `pnpm test:e2e` is Playwright's own runner, in its pinned container.
const runsVitest = (run: string) =>
  /\bpnpm(?: -s)? test(?![:\w-])|\brules:check\b|(?:remote|wip)_ci\.py (?:--label|shard)\b/.test(
    run,
  );
const installsChromium = (run: string) =>
  /\bplaywright(?:@\S+)? install --with-deps --only-shell chromium\b/.test(run);

it('installs Chromium before every CI step that runs the Vitest suite, so its browser tests run instead of failing or skipping', () => {
  const found = workflows().flatMap(({ file, job, steps }) =>
    steps.flatMap((step, index) =>
      step.run && runsVitest(step.run)
        ? [
            {
              at: `${file} ${job}: ${step.name ?? step.run.split('\n')[0]}`,
              installed: steps
                .slice(0, index)
                .some((earlier) => installsChromium(earlier.run ?? '')),
            },
          ]
        : [],
    ),
  );
  // The scan finds every job that runs the suite today.
  expect(found.map(({ at }) => at.split(':')[0])).toEqual([
    'ci.yaml checks',
    'ci.yaml remote-shard',
    'ci.yaml wip-shard',
    'rules-coverage.yml catalog',
  ]);
  expect(found.filter(({ installed }) => !installed)).toEqual([]);
});

it("installs the gate's Chromium through the frozen offline dependencies before the suite shard that runs its tests", () => {
  const job = workflows().find(
    ({ file, job }) => file === 'ci.yaml' && job === 'remote-shard',
  )!;
  const ids = job.steps.map((step) => step.id);
  const chromium = job.steps.find((step) => installsChromium(step.run ?? ''))!;
  const offline = job.steps.find((step) =>
    (step.run ?? '').includes('pnpm install --offline --frozen-lockfile'),
  )!;
  expect(job.steps.indexOf(offline)).toBeLessThan(job.steps.indexOf(chromium));
  expect(job.steps.indexOf(chromium)).toBeLessThan(ids.indexOf('shard'));
  // Shard 1 alone holds the tests that launch Chromium (tests/shard-plan.ts).
  expect(chromium.if).toBe('${{ matrix.index == 1 }}');
  expect(offline.if).toBeUndefined();
  // Run the step's script with a pnpm that records its arguments.
  const bin = mkdtempSync(join(tmpdir(), 'ci-chromium-'));
  try {
    const pnpm = join(bin, 'pnpm');
    writeFileSync(
      pnpm,
      '#!/bin/sh\n' +
        'if [ "$1" = install ] && [ "${CI:-}" != true ]; then\n' +
        '  echo "CI=true required for noninteractive install" >&2\n' +
        '  exit 1\n' +
        'fi\n' +
        'echo "pnpm $*"\n',
    );
    chmodSync(pnpm, 0o755);
    const ran = spawnSync(
      'bash',
      ['-e', '-c', `${offline.run!}\n${chromium.run!}`],
      {
        cwd: process.cwd(),
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
        encoding: 'utf8',
      },
    );
    expect(ran.status, ran.stderr).toBe(0);
    // Resolve the browser installer through the committed package integrity,
    // not a separate registry lookup that merely matches the version.
    expect(ran.stdout.trim().split('\n')).toEqual([
      'pnpm install --offline --frozen-lockfile',
      'pnpm exec playwright install --with-deps --only-shell chromium',
    ]);
  } finally {
    rmSync(bin, { recursive: true, force: true });
  }
});

type Job = {
  if?: string;
  permissions?: Record<string, string>;
  steps?: (Step & { uses?: string; with?: Record<string, unknown> })[];
};
const ciJobs = () =>
  Object.entries(
    (parse(read('ci.yaml')) as { jobs: Record<string, Job> }).jobs,
  );
const artifactNames = (job: Job) =>
  (job.steps ?? []).flatMap((step) =>
    /^actions\/(?:upload|download)-artifact@/.test(step.uses ?? '')
      ? [String(step.with?.name ?? step.with?.pattern)]
      : [],
  );

// A gate name or a credential no wip-* job may carry.
const gateNames = [
  'remote_ci.py',
  'remote_checks',
  'remote-',
  'manifest.json',
  'gate/',
  'secrets.',
];
const expectWipJob = (name: string, job: Job) => {
  const text = JSON.stringify(job);
  for (const gate of gateNames)
    expect(text, `${name} names ${gate}`).not.toContain(gate);
  expect(job.if, name).toContain("startsWith(github.ref, 'refs/heads/wip/')");
  expect(job.permissions, name).toEqual({ contents: 'read' });
  // The shared setup's first step is the gate probe (remote_ci.py probe); WIP jobs turn it off.
  const setups = (job.steps ?? []).filter(
    (step) => step.uses === './.github/actions/ep-setup',
  );
  for (const step of setups)
    expect(step.with?.['gate-probe'], name).toBe('false');
  for (const artifact of artifactNames(job))
    expect(artifact, name).toMatch(/^wip-/);
};

it('keeps WIP CI apart from landing evidence: no wip-* job runs the gate driver or touches a gate artifact', () => {
  // Owner 2026-11-06: WIP CI is information only, never landing evidence.
  const wip = ciJobs().filter(([name]) => name.startsWith('wip-'));
  expect(wip.map(([name]) => name).sort()).toEqual([
    'wip-plan',
    'wip-shard',
    'wip-static',
    'wip-summary',
  ]);
  for (const [name, job] of wip) expectWipJob(name, job);
});

it('keeps the gate jobs and checks off wip/ pushes and WIP artifacts', () => {
  const jobs = ciJobs();
  const gate = jobs.filter(([name]) => name.startsWith('remote-'));
  expect(gate.map(([name]) => name).sort()).toEqual([
    'remote-checks',
    'remote-shard',
    'remote-static',
  ]);
  for (const [name, job] of gate) {
    expect(job.if, name).not.toContain('wip/');
    for (const artifact of artifactNames(job))
      expect(artifact, name).toMatch(/^remote-/);
  }
  const checks = jobs.find(([name]) => name === 'checks')!;
  expect(checks[1].if).toContain("!startsWith(github.ref, 'refs/heads/wip/')");
});
