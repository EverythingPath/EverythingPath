// @vitest-environment node
import { expect, expectTypeOf, test } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  auditWriters,
  readWriterSources,
  writerInventory,
} from '../scripts/lib/initial-migration-writers';
import {
  decideWrite,
  type GatedWriterClass,
  type WriteDecision,
} from '../convex/lib/writeGate';
import type {
  sheetCharacterWriteGate,
  writeGate,
} from '../convex/lib/writeGate';

test('public mutation validators accept an optional numeric write epoch, including retired endpoints', () => {
  const audit = auditWriters({
    'convex/example.ts': `
    import { mutation as save } from './_generated/server';
    import * as server from './_generated/server';
    import { v } from 'convex/values';
    import { rejectRetiredWorkflow } from './lib/retiredWorkflow';
    export const missing = save({args:{}, handler: rejectRetiredWorkflow});
    export const required = save({args:{writeEpoch: v.number()}, handler: rejectRetiredWorkflow});
    export const wrongType = save({args:{writeEpoch: v.optional(v.string())}, handler: rejectRetiredWorkflow});
    export const supported = server.mutation({args:{writeEpoch: v.optional(v.number())}, handler: rejectRetiredWorkflow});
    export const legacy = save({args: v.any(), handler: rejectRetiredWorkflow});
  `,
  });
  expect(audit.errors).toEqual([
    'convex/example.ts:missing public mutation must accept optional writeEpoch',
    'convex/example.ts:required public mutation must accept optional writeEpoch',
    'convex/example.ts:wrongType public mutation must accept optional writeEpoch',
  ]);
});

test('new raw writers fail even when an import disguises the registration name', () => {
  const audit = auditWriters({
    'convex/canonicalDraftPersistence.ts': `
    import { internalMutation } from './_generated/server';
    export const retireOtherDraft = internalMutation({args:{}, handler: async () => null});
  `,
    'convex/new.ts': `
    import { internalMutation as save } from './_generated/server';
    export const importCharacters = save({args:{}, handler: async ctx => ctx.db.insert('character', {})});
  `,
  });
  expect(audit.errors).toEqual([
    'convex/canonicalDraftPersistence.ts:retireOtherDraft is not gated or a reviewed exception',
    'convex/new.ts:importCharacters is not gated or a reviewed exception',
  ]);
});

test('candidate backfill exceptions cover only the reviewed private operator commands', () => {
  const audit = auditWriters({
    'convex/initialCharacterBackfill.ts': `
    import { internalMutation as operator } from './_generated/server';
    export const start = operator({args:{}, handler: async () => null});
    export const batch = operator({args:{}, handler: async () => null});
    export const resume = batch;
    export const validate = operator({args:{}, handler: async () => null});
    export const startValidation = operator({args:{}, handler: async () => null});
    export const startDriver = operator({args:{}, handler: async () => null});
    export const drive = operator({args:{}, handler: async () => null});
    export const stopDriver = operator({args:{}, handler: async () => null});

    export const abortBeforeActivation = operator({args:{}, handler: async () => null});
    export const bypass = operator({args:{}, handler: async () => null});
  `,
  });
  expect(audit.errors).toEqual([
    'convex/initialCharacterBackfill.ts:bypass is not gated or a reviewed exception',
  ]);
  expect(audit.writers.filter(({ name }) => !name.endsWith(':bypass'))).toEqual(
    [
      {
        name: 'convex/initialCharacterBackfill.ts:abortBeforeActivation',
        writerClass: 'operator',
        policy:
          'Operator: aborts the current capture and reopens only its unactivated run',
      },
      ...[
        'batch',
        'drive',
        'resume',
        'start',
        'startDriver',
        'startValidation',
        'stopDriver',
        'validate',
      ].map((command) => ({
        name: `convex/initialCharacterBackfill.ts:${command}`,
        writerClass: 'operator',
        policy:
          'Operator: private candidate preparation requires the closed legacy gate, current run, epoch and input capture',
      })),
    ],
  );
});

test('candidate operator exceptions reject public writers and registrations from unreviewed modules', () => {
  const audit = auditWriters({
    'convex/initialCharacterBackfill.ts': `
    import { mutation } from './_generated/server';
    export const batch = mutation({args:{writeEpoch: v.optional(v.number())}, handler: async () => null});
  `,
    'convex/anotherBackfill.ts': `
    import { internalMutation } from './_generated/server';
    export const batch = internalMutation({args:{}, handler: async () => null});
  `,
  });
  expect(audit.errors).toEqual([
    'convex/anotherBackfill.ts:batch is not gated or a reviewed exception',
    'convex/initialCharacterBackfill.ts:batch migration operator must use internalMutation from the generated server',
  ]);
});

test('initial migration operators must be internal mutations from the generated server', () => {
  const audit = auditWriters({
    'convex/initialMigration.ts': `
    import { mutation, internalMutation } from './_generated/server';
    import { generalInternalMutation } from './lib/writeGate';
    export const start = internalMutation({args:{}, handler: async () => null});
    export const activate = mutation({args:{writeEpoch: v.optional(v.number())}, handler: async () => null});
    export const abortBeforeActivation = generalInternalMutation({args:{}, handler: async () => null});
  `,
  });
  expect(audit.errors).toEqual([
    'convex/initialMigration.ts:activate migration operator must use internalMutation from the generated server',
    'convex/initialMigration.ts:abortBeforeActivation migration operator must use internalMutation from the generated server',
  ]);
});

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
/** Every non-test source file that could call a Convex function. */
function callerSources() {
  const files: string[] = ['package.json', 'netlify.toml'];
  function walk(directory: string) {
    for (const entry of readdirSync(join(repositoryRoot, directory), {
      withFileTypes: true,
    })) {
      const path = posix.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!['_generated', 'node_modules'].includes(entry.name)) walk(path);
      } else if (
        /\.(ts|tsx|js|mjs|cjs|sh|ya?ml)$/.test(entry.name) &&
        !/\.test\.(ts|tsx)$/.test(entry.name)
      )
        files.push(path);
    }
  }
  for (const directory of ['convex', 'src', 'scripts', 'e2e', '.github'])
    walk(directory);
  return files;
}

/** A call names the reference or the CLI path; comments that only cite it don't. */
function callsActivate(source: string) {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)(\/\/|#).*$/gm, '$1');
  return /initialMigration[.:]activate\b/.test(withoutComments);
}

test('the activate caller scan reads workflow steps, and a step that runs activate counts as a caller', () => {
  expect(callerSources()).toEqual(
    expect.arrayContaining([
      '.github/workflows/ci.yaml',
      '.github/workflows/rules-coverage.yml',
    ]),
  );
  expect(
    callsActivate(`
      steps:
        - name: Cut over
          run: pnpm exec convex run initialMigration:activate '{}'
    `),
  ).toBe(true);
  expect(
    callsActivate(`
      steps:
        # initialMigration:activate stays an operator command
        - run: pnpm exec convex run initialMigration:status '{"now":0}'
    `),
  ).toBe(false);
});

test('nothing outside tests reaches initialMigration:activate, which only an operator can run as an internal mutation', () => {
  const callers = callerSources().filter((path) =>
    callsActivate(readFileSync(join(repositoryRoot, path), 'utf8')),
  );
  expect(callers).toEqual([]);
  expect(
    inventory.find(
      ({ name }) => name === 'convex/initialMigration.ts:activate',
    ),
  ).toMatchObject({ writerClass: 'operator' });
});

test('gated aliases pass, retired names only pass while their handler rejects', () => {
  const audit = auditWriters({
    'convex/example.ts': `
    import { gatedMutation as save } from './lib/writeGate';
    import { mutation } from './_generated/server';
    import { rejectRetiredWorkflow } from './lib/retiredWorkflow';
    export const current = save({args:{}, handler: async () => null});
    export const retired = mutation({args:{writeEpoch: v.optional(v.number())}, handler: rejectRetiredWorkflow});
    export const revived = mutation({args:{writeEpoch: v.optional(v.number())}, handler: async () => null});
  `,
  });
  expect(audit.errors).toEqual([
    'convex/example.ts:revived is not gated or a reviewed exception',
  ]);
  expect(audit.writers).toHaveLength(3);
});

test('the inventory distinguishes legacy and sheet Character fences from general writer gates', () => {
  const audit = auditWriters({
    'convex/example.ts': `
    import { gatedInternalMutation, generalInternalMutation, sheetCharacterInternalMutation } from './lib/writeGate';
    import { campaignMutation, sheetCharacterMutation } from './lib/campaignRuntime';
    export const legacyImport = gatedInternalMutation({args:{}, handler: async () => null});
    export const prepareRelease = generalInternalMutation({args:{}, handler: async () => null});
    export const editWeek = campaignMutation({args:{}, handler: async () => null});
    export const editCharacter = sheetCharacterMutation({args:{}, handler: async () => null});
    export const returnCharacter = sheetCharacterInternalMutation({args:{}, handler: async () => null});
    `,
  });
  expect(audit.errors).toEqual([]);
  expect(
    audit.writers.map(({ name, writerClass }) => ({ name, writerClass })),
  ).toEqual([
    { name: 'convex/example.ts:editCharacter', writerClass: 'sheetCharacter' },
    { name: 'convex/example.ts:editWeek', writerClass: 'general' },
    { name: 'convex/example.ts:legacyImport', writerClass: 'legacyCharacter' },
    { name: 'convex/example.ts:prepareRelease', writerClass: 'general' },
    {
      name: 'convex/example.ts:returnCharacter',
      writerClass: 'sheetCharacter',
    },
  ]);
});

test('a Character builder name imported from outside its gate module is not a fence', () => {
  const audit = auditWriters({
    'convex/example.ts': `
    import { sheetCharacterMutation } from './lib/writeGate';
    import { gatedInternalMutation } from './lib/campaignRuntime';
    export const edit = sheetCharacterMutation({args:{}, handler: async () => null});
    export const step = gatedInternalMutation({args:{}, handler: async () => null});
    `,
  });
  expect(audit.errors).toEqual([
    'convex/example.ts:edit is not gated or a reviewed exception',
    'convex/example.ts:step is not gated or a reviewed exception',
  ]);
});

test('general campaign writers cannot insert Characters without the legacy Character fence', () => {
  const audit = auditWriters({
    'convex/example.ts': `
    import { campaignMutation } from './lib/campaignRuntime';
    export const create = campaignMutation({args:{}, handler: async ctx => ctx.db.insert('character', {})});
    `,
  });
  expect(audit.errors).toEqual([
    'convex/example.ts:create writes character without a legacy Character builder',
  ]);
});

test('general writer checks follow named handlers and module-local helper calls', () => {
  const audit = auditWriters({
    'convex/example.ts': `
    import { generalInternalMutation as save } from './lib/writeGate';
    async function remove(ctx) { await ctx.db.delete('characterSheetEntry', 'id'); }
    const replace = async ctx => { await ctx.db.replace('catalogEntry', 'id', {}); };
    async function handler(ctx) { await remove(ctx); await replace(ctx); }
    export const edit = save({args:{}, handler});
    `,
  });
  expect(audit.errors).toEqual([
    'convex/example.ts:edit writes characterSheetEntry without a legacy Character builder',
    'convex/example.ts:edit writes catalogEntry without a legacy Character builder',
  ]);
});

test('general writers cannot patch or delete protected tables through typed IDs', () => {
  const audit = auditWriters({
    'convex/example.ts': `
    import { campaignMutation } from './lib/campaignRuntime';
    import { Id } from './_generated/dataModel';
    import { v } from 'convex/values';
    async function clear(ctx, id: Id<'acceptedWarning'>) { await ctx.db.delete(id); }
    export const edit = campaignMutation({
      args: {characterId: v.id('character'), warningId: v.id('acceptedWarning')},
      handler: async (ctx, args) => {
        await ctx.db.patch(args.characterId, {});
        await clear(ctx, args.warningId);
      },
    });
    `,
  });
  expect(audit.errors).toEqual([
    'convex/example.ts:edit writes character without a legacy Character builder',
    'convex/example.ts:edit writes acceptedWarning without a legacy Character builder',
  ]);
});

test.each(
  [
    'character',
    'characterSheetEntry',
    'characterLinkedInput',
    'companionRelationship',
    'catalogEntry',
    'campaignSpellMembership',
    'acceptedWarning',
    'characterSpell',
    'spell',
  ].flatMap((table) =>
    ['insert', 'patch', 'delete', 'replace'].map((operation) => ({
      table,
      operation,
    })),
  ),
)(
  'general writers reject $operation writes to $table',
  ({ table, operation }) => {
    const writeArguments =
      operation === 'insert'
        ? `'${table}', {}`
        : operation === 'delete'
          ? `'${table}', 'id'`
          : `'${table}', 'id', {}`;
    const audit = auditWriters({
      'convex/example.ts': `
    import { campaignInternalMutation as save } from './lib/campaignRuntime';
    export const edit = save({args:{}, handler: async ctx => ctx.db.${operation}(${writeArguments})});
    `,
    });
    expect(audit.errors).toEqual([
      `convex/example.ts:edit writes ${table} without a legacy Character builder`,
    ]);
  },
);

test('safe general writers and legacy Character writers pass without auditing unrelated helpers', () => {
  const audit = auditWriters({
    'convex/example.ts': `
    import { campaignMutation, sheetCharacterMutation } from './lib/campaignRuntime';
    import { generalInternalMutation, gatedWebhookMutation } from './lib/writeGate';
    async function create(ctx) { await ctx.db.insert('character', {}); }
    export const editWeek = campaignMutation({args:{}, handler: async (ctx, args) => {
      const create = async () => null;
      await create();
      return ctx.db.patch('campaign', args.create, {});
    }});
    export const prepare = generalInternalMutation({args:{}, async handler(ctx) {
      await ctx.db.insert('catalogRelease', {});
    }});
    export const receive = gatedWebhookMutation({args:{}, handler: async ctx => ctx.db.patch('user', 'id', {})});
    export const character = sheetCharacterMutation({args:{}, handler: create});
    `,
  });
  expect(audit.errors).toEqual([]);
});

test('general writers follow transitive and recursive helper calls once per table', () => {
  const audit = auditWriters({
    'convex/example.ts': `
    import { gatedWebhookMutation } from './lib/writeGate';
    async function first(ctx) { await second(ctx); }
    const second = async ctx => {
      await ctx.db.patch('spell', 'id', {});
      if (false) await first(ctx);
    };
    const handler = async ctx => first(ctx);
    export const edit = gatedWebhookMutation({args:{}, handler});
    `,
  });
  expect(audit.errors).toEqual([
    'convex/example.ts:edit writes spell without a legacy Character builder',
  ]);
});

test('general writers ignore nested functions and arrows that are never called', () => {
  const audit = auditWriters({
    'convex/example.ts': `
    import { campaignMutation } from './lib/campaignRuntime';
    export const edit = campaignMutation({args:{}, handler: async ctx => {
      async function unused(ctx) { await ctx.db.insert('character', {}); }
      const unusedArrow = async ctx => ctx.db.delete('spell', 'id');
      await ctx.db.patch('campaign', 'id', {});
    }});
    `,
  });
  expect(audit.errors).toEqual([]);
});

test('parentheses preserve named handler and typed argument write checks', () => {
  const audit = auditWriters({
    'convex/example.ts': `
    import { campaignMutation } from './lib/campaignRuntime';
    import { v } from 'convex/values';
    async function handler(ctx) { await ctx.db.insert('character', {}); }
    export const named = campaignMutation({args:{}, handler: (handler)});
    export const inline = campaignMutation({
      args:{characterId: v.id('character')},
      handler: (async (ctx, args) => ctx.db.delete(args.characterId)),
    });
    `,
  });
  expect(audit.errors).toEqual([
    'convex/example.ts:named writes character without a legacy Character builder',
    'convex/example.ts:inline writes character without a legacy Character builder',
  ]);
});

test('called nested helpers, inline callbacks and immediately invoked functions remain audited', () => {
  const audit = auditWriters({
    'convex/example.ts': `
    import { campaignMutation } from './lib/campaignRuntime';
    export const edit = campaignMutation({args:{}, handler: async ctx => {
      async function remove() { await ctx.db.delete('characterSheetEntry', 'id'); }
      const replace = async () => ctx.db.replace('spell', 'id', {});
      await (remove)();
      await replace();
      await Promise.all([1].map(async () => ctx.db.insert('catalogEntry', {})));
      await (async () => ctx.db.delete('acceptedWarning', 'id'))();
    }});
    `,
  });
  expect(audit.errors).toEqual([
    'convex/example.ts:edit writes characterSheetEntry without a legacy Character builder',
    'convex/example.ts:edit writes spell without a legacy Character builder',
    'convex/example.ts:edit writes catalogEntry without a legacy Character builder',
    'convex/example.ts:edit writes acceptedWarning without a legacy Character builder',
  ]);
});

test('namespace registration and new side effects in a read-only exception fail closed', () => {
  const audit = auditWriters({
    'convex/new.ts': `import * as server from './_generated/server'; export const save = server.mutation({args:{writeEpoch: v.optional(v.number())}, handler: async () => null});`,
    'convex/canonicalPersistenceFixtures.ts': `import { internalMutation as inspectMutation } from './_generated/server'; export const inspect = inspectMutation({handler: async ctx => ctx.db.patch('id', {})});`,
  });
  expect(audit.errors).toEqual([
    'convex/canonicalPersistenceFixtures.ts:inspect read-only exception now writes or schedules work',
    'convex/new.ts:save is not gated or a reviewed exception',
  ]);
});

test('raw builder aliases and custom wrappers cannot escape the inventory', () => {
  const audit = auditWriters({
    'convex/escape.ts': `
    import { mutation } from './_generated/server';
    import { customMutation } from 'convex-helpers/server/customFunctions';
    const save = mutation;
    export const hidden = save({handler: async () => null});
    export const wrapped = customMutation(mutation, {});
  `,
  });
  expect(audit.errors).toEqual([
    'convex/escape.ts raw builder mutation escapes a direct registration',
    'convex/escape.ts raw builder mutation escapes a direct registration',
  ]);
});

test('webhooks and reviewed draft retirement declare their epoch exemptions', () => {
  const audit = auditWriters({
    'convex/example.ts': `
    import { gatedWebhookMutation } from './lib/writeGate';
    export const receive = gatedWebhookMutation({args:{}, handler: async () => null});
  `,
    'convex/canonicalDraftPersistence.ts': `
    import { internalMutation } from './_generated/server';
    export const retireClosedDraft = internalMutation({args:{}, handler: async () => null});
  `,
  });
  expect(audit.errors).toEqual([]);
  expect(audit.writers).toEqual([
    {
      name: 'convex/canonicalDraftPersistence.ts:retireClosedDraft',
      writerClass: 'general',
      policy:
        'Write gate (maintenance defers); accepted draft retirement is idempotent across epochs and Character authority',
    },
    {
      name: 'convex/example.ts:receive',
      writerClass: 'general',
      policy: 'Write gate (maintenance); idempotent webhook, epoch exempt',
    },
  ]);
});

test('every current registration is gated or reviewed and the committed inventory is complete', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const audit = auditWriters(readWriterSources(root));
  expect(audit.errors).toEqual([]);
  const doc = readFileSync(
    new URL(
      '../docs/initial-character-migration-write-gate.md',
      import.meta.url,
    ),
    'utf8',
  ).split('\n');
  const start = doc.indexOf(
    '| Registered writer | Class | Gate or reviewed exception |',
  );
  const end = doc.findIndex((line, i) => i > start && !line.startsWith('|'));
  const committed = doc.slice(start, end === -1 ? undefined : end).join('\n');
  expect(committed).toEqual(writerInventory(audit.writers));
});

type GateOutcome = 'allowed' | 'MAINTENANCE' | 'RELOAD_REQUIRED';
// Each gate state with the epoch the command carries: the current one, or an
// older one a page loaded before the last epoch change still holds.
const gateStates = {
  'no control row, current epoch': { control: null, writeEpoch: 0 },
  'legacy authority, open, current epoch': {
    control: { closed: false, epoch: 2, authority: 'legacy' },
    writeEpoch: 2,
  },
  'legacy authority, open, stale epoch': {
    control: { closed: false, epoch: 2, authority: 'legacy' },
    writeEpoch: 1,
  },
  'legacy authority, closed': {
    control: { closed: true, epoch: 2, authority: 'legacy' },
    writeEpoch: 2,
  },
  'sheet authority, open, current epoch': {
    control: { closed: false, epoch: 2, authority: 'sheet' },
    writeEpoch: 2,
  },
  'sheet authority, open, stale epoch': {
    control: { closed: false, epoch: 2, authority: 'sheet' },
    writeEpoch: 1,
  },
  'sheet authority, closed': {
    control: { closed: true, epoch: 2, authority: 'sheet' },
    writeEpoch: 2,
  },
} as const satisfies Record<
  string,
  {
    control: Parameters<typeof decideWrite>[0];
    writeEpoch: number;
  }
>;
// Under legacy authority the sheet class accepts and refuses exactly as the
// legacy Character class does; only sheet authority tells them apart.
const expectedOutcomes: Record<
  GatedWriterClass,
  Record<keyof typeof gateStates, GateOutcome>
> = {
  legacyCharacter: {
    'no control row, current epoch': 'allowed',
    'legacy authority, open, current epoch': 'allowed',
    'legacy authority, open, stale epoch': 'RELOAD_REQUIRED',
    'legacy authority, closed': 'MAINTENANCE',
    'sheet authority, open, current epoch': 'RELOAD_REQUIRED',
    'sheet authority, open, stale epoch': 'RELOAD_REQUIRED',
    'sheet authority, closed': 'MAINTENANCE',
  },
  sheetCharacter: {
    'no control row, current epoch': 'allowed',
    'legacy authority, open, current epoch': 'allowed',
    'legacy authority, open, stale epoch': 'RELOAD_REQUIRED',
    'legacy authority, closed': 'MAINTENANCE',
    'sheet authority, open, current epoch': 'allowed',
    'sheet authority, open, stale epoch': 'RELOAD_REQUIRED',
    'sheet authority, closed': 'MAINTENANCE',
  },
  general: {
    'no control row, current epoch': 'allowed',
    'legacy authority, open, current epoch': 'allowed',
    'legacy authority, open, stale epoch': 'RELOAD_REQUIRED',
    'legacy authority, closed': 'MAINTENANCE',
    'sheet authority, open, current epoch': 'allowed',
    'sheet authority, open, stale epoch': 'RELOAD_REQUIRED',
    'sheet authority, closed': 'MAINTENANCE',
  },
};

const inventory = auditWriters(
  readWriterSources(fileURLToPath(new URL('../', import.meta.url))),
).writers;

test.each(
  inventory.flatMap((writer) =>
    writer.writerClass === 'legacyCharacter' ||
    writer.writerClass === 'sheetCharacter' ||
    writer.writerClass === 'general'
      ? [{ ...writer, writerClass: writer.writerClass }]
      : [],
  ),
)(
  '$name ($writerClass) is allowed or refused by authority and gate state',
  ({ writerClass, policy }) => {
    const outcomes = Object.fromEntries(
      Object.entries(gateStates).map(([state, { control, writeEpoch }]) => {
        const decision = decideWrite(control, writerClass, writeEpoch);
        return [state, decision.kind === 'allowed' ? 'allowed' : decision.code];
      }),
    );
    // Reviewed exceptions in the general class decide maintenance themselves.
    if (policy.startsWith('Shared write gate'))
      expect(outcomes).toEqual(expectedOutcomes[writerClass]);
  },
);

test('every registration has a class and only the fixture builders stay legacy-only', () => {
  const counts: Record<string, number> = {};
  for (const { writerClass } of inventory)
    counts[writerClass] = (counts[writerClass] ?? 0) + 1;
  expect(counts).toEqual({
    general: 46,
    housekeeping: 2,
    legacyCharacter: 4,
    operator: 12,
    readOnly: 2,
    retired: 33,
    sheetCharacter: 85,
  });
  expect(inventory.filter(({ policy }) => policy === 'UNGATED')).toEqual([]);
  expect(
    inventory
      .filter(({ writerClass }) => writerClass === 'legacyCharacter')
      .map(({ name }) => name),
  ).toEqual([
    'convex/canonicalPersistenceFixtures.ts:acceptedCampaign',
    'convex/canonicalPersistenceFixtures.ts:resetAndInitialize',
    'convex/e2eFixtures.ts:cleanupCase',
    'convex/e2eFixtures.ts:resetCase',
  ]);
});

test('gate decisions and writer contexts refuse illegal shapes', () => {
  expectTypeOf<WriteDecision>().toEqualTypeOf<
    | { kind: 'allowed'; epoch: number; authority: 'legacy' | 'sheet' }
    | { kind: 'refused'; code: 'MAINTENANCE' | 'RELOAD_REQUIRED' }
  >();
  const illegal: WriteDecision[] = [
    // @ts-expect-error an admitted write carries no refusal code
    { kind: 'allowed', epoch: 0, authority: 'sheet', code: 'MAINTENANCE' },
    // @ts-expect-error a refusal names its code
    { kind: 'refused' },
    // @ts-expect-error a refusal carries only a Write Gate code
    { kind: 'refused', code: 'FORBIDDEN' },
  ];
  expect(illegal).toHaveLength(3);
  // @ts-expect-error operator commands are not decided by the shared gate
  expect(() => decideWrite(null, 'operator')).not.toThrow();
  // A sheet writer learns the authority it runs under; a legacy one never runs
  // under sheet authority, so it has nothing to learn.
  expectTypeOf<
    Awaited<ReturnType<typeof sheetCharacterWriteGate.input>>['ctx']
  >().toEqualTypeOf<{
    writeEpoch: number;
    characterAuthority: 'legacy' | 'sheet';
  }>();
  expectTypeOf<
    Awaited<ReturnType<typeof writeGate.input>>['ctx']
  >().toEqualTypeOf<{ writeEpoch: number }>();
});
