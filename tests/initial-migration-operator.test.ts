// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FunctionReturnType } from 'convex/server';
import { ConvexError } from 'convex/values';
import { ZodError } from 'zod';
import { afterEach, beforeEach, expect, expectTypeOf, it, vi } from 'vitest';
import type { internal } from '../convex/_generated/api';
import {
  runInitialMigrationOperator,
  type InitialMigrationStatus,
} from '../scripts/initial-migration/operator';

// #413 F6c fix r1: the operator verifies the declared target against the
// admin key before the key is sent, and reads the run by stage.

const remote = 'quiet-otter-123';
const local = 'ep-dev-0123456789ab';
const urls = {
  production: `https://${remote}.convex.cloud`,
  development: `https://${remote}.convex.cloud`,
  preview: `https://${remote}.convex.cloud`,
  local: 'http://127.0.0.1:3210',
} as const;
type Kind = keyof typeof urls;
const nameOf = (kind: Kind) => (kind === 'local' ? local : remote);
const openLegacy = {
  epoch: 0,
  closed: false,
  authority: 'legacy',
  budgetExceeded: false,
  run: null,
  catchUp: null,
};

let directory: string;
let keyFile: string;
let requested: string[];
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'initial-migration-operator-'));
  keyFile = join(directory, 'admin.key');
  requested = [];
  vi.stubGlobal('fetch', (url: unknown) => {
    requested.push(String(url));
    return Promise.resolve(
      String(url).endsWith('/instance_name')
        ? new Response(local)
        : new Response(
            JSON.stringify({ status: 'success', value: openLegacy }),
          ),
    );
  });
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(directory, { recursive: true, force: true });
});

async function runAgainst(kind: Kind, key: string, step = 'status') {
  await writeFile(keyFile, key);
  return runInitialMigrationOperator({
    args: [
      step,
      '--deployment-name',
      nameOf(kind),
      '--deployment-url',
      urls[kind],
      '--target-kind',
      kind,
      '--admin-key-file',
      keyFile,
      ...(kind === 'production' ? ['--production'] : []),
      ...(step === 'start'
        ? [
            '--operation-id',
            'switch-1',
            '--number',
            '1',
            '--budget-minutes',
            '60',
            '--build-identity',
            'https://site.example/build-identity.json',
          ]
        : []),
    ],
    readBuildIdentity: async () => ({ frontendBuild: 'a'.repeat(40) }),
  });
}
/** Requests that carried the key: everything but the local instance probe. */
const keyedRequests = () =>
  requested.filter((url) => !url.endsWith('/instance_name'));

const kinds = ['production', 'development', 'preview', 'local'] as const;
const accepted = 'accepted';
/**
 * Every recognised key format against every declared kind, with the target's
 * name: the kind's own typed key, and a key of unknown kind only for local.
 */
type Combination = [key: (name: string) => string, Record<Kind, string>];
const combinations: Combination[] = [
  [
    (name) => `prod:${name}|secret`,
    {
      production: accepted,
      development: `The admin key is for production deployment ${remote}; the target is development deployment ${remote}.`,
      preview: `The admin key is for production deployment ${remote}; the target is preview deployment ${remote}.`,
      local: `The admin key is for production deployment ${local}; the target is local deployment ${local}.`,
    },
  ],
  [
    (name) => `dev:${name}|secret`,
    {
      production: `The admin key is for development deployment ${remote}; the target is production deployment ${remote}.`,
      development: accepted,
      preview: `The admin key is for development deployment ${remote}; the target is preview deployment ${remote}.`,
      local: `The admin key is for development deployment ${local}; the target is local deployment ${local}.`,
    },
  ],
  [
    (name) => `preview:${name}|secret`,
    {
      production: `The admin key is for preview deployment ${remote}; the target is production deployment ${remote}.`,
      development: `The admin key is for preview deployment ${remote}; the target is development deployment ${remote}.`,
      preview: accepted,
      local: `The admin key is for preview deployment ${local}; the target is local deployment ${local}.`,
    },
  ],
  // A self-hosted backend's `<instance>|…`: a name and no kind. A refusal
  // names the key's deployment too.
  [
    (name) => `${name}|secret`,
    {
      production: `The admin key is for deployment ${remote} and names no deployment kind, which only a local target accepts; the target is production deployment ${remote}.`,
      development: `The admin key is for deployment ${remote} and names no deployment kind, which only a local target accepts; the target is development deployment ${remote}.`,
      preview: `The admin key is for deployment ${remote} and names no deployment kind, which only a local target accepts; the target is preview deployment ${remote}.`,
      local: accepted,
    },
  ],
  // No recognised kind or name: a key without a prefix, project and preview
  // deploy keys, another type.
  ...[
    () => 'secret-without-a-prefix',
    () => 'project:team:project|secret',
    () => 'preview:team:project|secret',
    (name: string) => `local:${name}|secret`,
  ].map(
    (key): Combination => [
      key,
      {
        production: `The admin key names no deployment kind, which only a local target accepts; the target is production deployment ${remote}.`,
        development: `The admin key names no deployment kind, which only a local target accepts; the target is development deployment ${remote}.`,
        preview: `The admin key names no deployment kind, which only a local target accepts; the target is preview deployment ${remote}.`,
        local: accepted,
      },
    ],
  ),
];

it.each(
  combinations.flatMap(([key, outcomes]) =>
    kinds.map((kind) => [key(nameOf(kind)), kind, outcomes[kind]] as const),
  ),
)('a key %s on a declared %s target: %s', async (key, kind, outcome) => {
  if (outcome === accepted) {
    await expect(runAgainst(kind, key)).resolves.toMatchObject({
      step: 'status',
    });
    expect(keyedRequests()).toEqual([`${urls[kind]}/api/function`]);
    return;
  }
  await expect(runAgainst(kind, key)).rejects.toThrow(outcome);
  expect(keyedRequests()).toEqual([]);
});

it.each(kinds)(
  'a key for another deployment of the declared %s kind is refused, naming both, before it is sent',
  async (kind) => {
    const type = {
      production: 'prod',
      development: 'dev',
      preview: 'preview',
      local: null,
    }[kind];
    const other = kind === 'local' ? 'ep-dev-ba9876543210' : 'other-otter-1';
    await expect(
      runAgainst(kind, `${type ? `${type}:` : ''}${other}|secret`),
    ).rejects.toThrow(
      type
        ? `The admin key is for ${kind} deployment ${other}; the target is ${kind} deployment ${nameOf(kind)}.`
        : `The admin key is for deployment ${other}; the target is local deployment ${local}.`,
    );
    expect(keyedRequests()).toEqual([]);
  },
);

// #413 F7b (f6c operator review r2, follow-up 1): a key for another
// deployment of another kind names both deployments, whatever the key's kind.
it.each([
  [
    'ep-dev-ba9876543210|secret',
    'preview',
    `The admin key is for deployment ep-dev-ba9876543210 and names no deployment kind, which only a local target accepts; the target is preview deployment ${remote}.`,
  ],
  [
    'ep-dev-ba9876543210|secret',
    'production',
    `The admin key is for deployment ep-dev-ba9876543210 and names no deployment kind, which only a local target accepts; the target is production deployment ${remote}.`,
  ],
  [
    'prod:other-otter-1|secret',
    'preview',
    `The admin key is for production deployment other-otter-1; the target is preview deployment ${remote}.`,
  ],
  [
    'dev:other-otter-1|secret',
    'local',
    `The admin key is for development deployment other-otter-1; the target is local deployment ${local}.`,
  ],
] as const)(
  'a key %s for another deployment on a declared %s target of another kind is refused naming both',
  async (key, kind, outcome) => {
    await expect(runAgainst(kind, key)).rejects.toThrow(outcome);
    expect(keyedRequests()).toEqual([]);
  },
);

it('a production key with a kept preview kind never closes production: start is refused before any request', async () => {
  await expect(
    runAgainst('preview', `prod:${remote}|secret`, 'start'),
  ).rejects.toThrow(
    `The admin key is for production deployment ${remote}; the target is preview deployment ${remote}.`,
  );
  expect(requested).toEqual([]);
});

const runFields = {
  runId: 'run-1',
  epoch: 1,
  operationId: 'switch-1',
  frontendBuild: 'a'.repeat(40),
};
const activation = { activationId: 'activation-1' };
const publication = { nextPage: 0, published: 0, isDone: false };
const smoke = { smokeId: 'smoke-1', outcome: 'passed', epoch: 1 };
const statusWith = (run: unknown, catchUp: unknown = null) => ({
  epoch: 1,
  closed: true,
  authority: 'sheet',
  budgetExceeded: false,
  run,
  catchUp,
});
const statusOf = (run: unknown, catchUp?: unknown) =>
  runInitialMigrationOperator({
    args: ['status', '--target-kind', 'local'],
    adapter: {
      query: async () => statusWith(run, catchUp),
      mutation: () => Promise.reject(new Error('no mutation expected')),
    },
  });

it.each([
  ['maintenance', { ...runFields, state: 'maintenance' }],
  ['aborted', { ...runFields, state: 'aborted', abortedAt: 1 }],
  [
    'activated',
    { ...runFields, state: 'activated', activation, publication, smoke: null },
  ],
  [
    'reopened',
    { ...runFields, state: 'reopened', activation, publication, smoke },
  ],
  [
    'repairing',
    { ...runFields, state: 'repairing', activation, publication, smoke: null },
  ],
])('reads a %s run with its own records', async (_state, run) => {
  await expect(statusOf(run)).resolves.toMatchObject({
    details: { run },
  });
});

it.each([
  ['activated without its records', { ...runFields, state: 'activated' }],
  [
    'activated without a publication',
    { ...runFields, state: 'activated', activation, smoke: null },
  ],
  [
    'maintenance with a publication',
    { ...runFields, state: 'maintenance', publication },
  ],
  [
    'aborted with an activation',
    { ...runFields, state: 'aborted', activation },
  ],
  [
    'reopened with a failed smoke check',
    {
      ...runFields,
      state: 'reopened',
      activation,
      publication,
      smoke: { ...smoke, outcome: 'failed' },
    },
  ],
  [
    'reopened without a smoke check',
    { ...runFields, state: 'reopened', activation, publication, smoke: null },
  ],
])('refuses a run %s', async (_shape, run) => {
  await expect(statusOf(run)).rejects.toThrow(ZodError);
});

// #413 F7b: status shows the catch-up sweep `reopen` scheduled, and the
// reopened deployment's next step says what the sweep found.
const reopenedRun = {
  ...runFields,
  state: 'reopened',
  activation,
  publication,
  smoke,
};
const counts = {
  characters: 6,
  departuresStarted: 1,
  deletionsResumed: 1,
  unknownOwners: 2,
};
const sweeping = {
  epoch: 1,
  startedAt: 1,
  counts,
  state: 'sweeping',
  nextPage: 1,
  cursor: 'c',
  lastUnknownOwner: 'gm',
};
const completed = {
  epoch: 1,
  startedAt: 1,
  counts,
  state: 'completed',
  pages: 2,
  completedAt: 2,
};

it.each([
  [
    'not yet run at this epoch',
    null,
    'none: open under sheet authority; the catch-up sweep has not run yet, read status again; close-for-repair to repair',
  ],
  [
    'from an earlier epoch',
    { ...completed, epoch: 0 },
    'none: open under sheet authority; the catch-up sweep has not run yet, read status again; close-for-repair to repair',
  ],
  [
    'sweeping',
    sweeping,
    'none: open under sheet authority; the catch-up sweep is running, read status again; close-for-repair to repair',
  ],
  [
    'completed with unknown owners',
    completed,
    'none: open under sheet authority; the catch-up sweep found 2 Character owner(s) with no account and no deletion: compare them with Clerk; close-for-repair to repair',
  ],
  [
    'completed with every owner known',
    { ...completed, counts: { ...counts, unknownOwners: 0 } },
    'none: open under sheet authority; close-for-repair to repair',
  ],
])('status shows a catch-up sweep %s', async (_case, catchUp, next) => {
  await expect(statusOf(reopenedRun, catchUp)).resolves.toMatchObject({
    next,
    details: { catchUp },
  });
});

it.each([
  ['sweeping without its next page', { ...sweeping, nextPage: undefined }],
  ['completed with a next page', { ...completed, nextPage: 1 }],
  ['completed without its page count', { ...completed, pages: undefined }],
  ['without its counts', { ...completed, counts: undefined }],
])('refuses a catch-up sweep %s', async (_shape, catchUp) => {
  await expect(statusOf(reopenedRun, catchUp)).rejects.toThrow(ZodError);
});

it('types the run by stage: every status the backend returns, and no illegal shape', () => {
  type BackendStatus = FunctionReturnType<
    typeof internal.initialMigration.status
  >;
  expectTypeOf<BackendStatus>().toExtend<InitialMigrationStatus>();
  type Run = NonNullable<InitialMigrationStatus['run']>;
  const fields = { runId: 'run-1', epoch: 1, operationId: 'switch-1' };
  const legal: Run[] = [
    { ...fields, state: 'maintenance' },
    { ...fields, state: 'activated', activation, publication, smoke: null },
  ];
  expect(legal).toHaveLength(2);
  // @ts-expect-error activated carries its activation and publication
  const bare: Run = { ...fields, state: 'activated', smoke: null };
  // @ts-expect-error maintenance has no publication yet
  const early: Run = { ...fields, state: 'maintenance', publication };
  // @ts-expect-error reopened relied on a passed smoke check
  const unchecked: Run = {
    ...fields,
    state: 'reopened',
    activation,
    publication,
    smoke: null,
  };
  expect([bare, early, unchecked]).toHaveLength(3);
});

// #413 F7b: `membership-backfill` loops `organizationMembership:backfill`
// with the status epoch until it reports done, before `start`.
const openAt = (epoch: number, closed = false) => ({
  epoch,
  closed,
  authority: 'legacy',
  budgetExceeded: false,
  run: null,
  catchUp: null,
});
/** A deployment whose backfill answers each call in turn. */
function membershipDeployment(
  status: unknown,
  answers: (() => Promise<unknown>)[],
) {
  const calls: unknown[] = [];
  const mutation = vi.fn((name: string, args: unknown) => {
    calls.push([name, args]);
    const answer = answers.shift();
    if (!answer) throw new Error('no more answers');
    return answer();
  });
  const run = () =>
    runInitialMigrationOperator({
      args: ['membership-backfill', '--target-kind', 'local'],
      adapter: { query: async () => status, mutation },
    });
  return { run, calls };
}
const page = (isDone: boolean, continueCursor: string) => async () => ({
  isDone,
  continueCursor,
});

it('membership-backfill finishes in one call when the first page is the last', async () => {
  const { run, calls } = membershipDeployment(openAt(3), [page(true, 'end')]);
  await expect(run()).resolves.toMatchObject({
    step: 'membership-backfill',
    did: 'Reconciled the membership directory in 1 call.',
    next: 'start',
  });
  expect(calls).toEqual([
    ['organizationMembership:backfill', { cursor: null, writeEpoch: 3 }],
  ]);
});

it('membership-backfill passes each cursor on, with the status epoch, until done', async () => {
  const { run, calls } = membershipDeployment(openAt(3), [
    page(false, 'a'),
    page(false, 'b'),
    page(true, 'c'),
  ]);
  await expect(run()).resolves.toMatchObject({
    did: 'Reconciled the membership directory in 3 calls.',
  });
  expect(calls).toEqual(
    [null, 'a', 'b'].map((cursor) => [
      'organizationMembership:backfill',
      { cursor, writeEpoch: 3 },
    ]),
  );
});

it('membership-backfill after a lost response says so, and a rerun starts again from the beginning', async () => {
  const lost = membershipDeployment(openAt(0), [
    page(false, 'a'),
    () => Promise.reject(new Error('socket closed')),
  ]);
  await expect(lost.run()).rejects.toThrow(
    'membership-backfill: no answer from the deployment (socket closed). The step may have committed; rerun the same command to resume.',
  );
  const rerun = membershipDeployment(openAt(0), [
    page(false, 'a'),
    page(true, 'b'),
  ]);
  await expect(rerun.run()).resolves.toMatchObject({
    did: 'Reconciled the membership directory in 2 calls.',
  });
  expect(rerun.calls[0]).toEqual([
    'organizationMembership:backfill',
    { cursor: null, writeEpoch: 0 },
  ]);
});

it('membership-backfill while the gate is closed is sent and refused with the server reason', async () => {
  const { run, calls } = membershipDeployment(openAt(1, true), [
    () =>
      Promise.reject(
        new ConvexError({ code: 'MAINTENANCE', message: 'Closed.' }),
      ),
  ]);
  await expect(run()).rejects.toThrow(
    'membership-backfill refused by the deployment: MAINTENANCE: Closed. Inspect with `pnpm initial-migration status`.',
  );
  expect(calls).toHaveLength(1);
});
