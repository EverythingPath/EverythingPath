// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FunctionReturnType } from 'convex/server';
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
  // No recognised kind: a self-hosted backend's `<instance>|…`, a key
  // without a prefix, project and preview deploy keys, another type.
  ...[
    (name: string) => `${name}|secret`,
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
const statusWith = (run: unknown) => ({
  epoch: 1,
  closed: true,
  authority: 'sheet',
  budgetExceeded: false,
  run,
});
const statusOf = (run: unknown) =>
  runInitialMigrationOperator({
    args: ['status', '--target-kind', 'local'],
    adapter: {
      query: async () => statusWith(run),
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
