// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { releaseFixture } from '../tests/catalog-release-fixture';
import {
  installReleasedBodies,
  readSavedSheet,
} from '../tests/released-catalog-entries';
import {
  promptPickRefusal,
  type PromptPickRefusalReason,
} from '../src/lib/character-sheet-prompt-picks';
import { api } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');
const sources = import.meta.glob<string>('./**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

// fg-1a: a class feature's pool prompt names its members by stable key; a
// Catalog Release resolves each key to its Catalog Entry and durable rule
// identity, and the public write path refuses a pick outside the members, and
// a prompt list or level its source doesn't define, each with its typed
// reason. The bodies are synthetic, shaped as imported: a class listing a
// "Rage Powers" parent at 2nd level whose prompts at 2nd and 4th are pools,
// plus a tagged open prompt and an untagged (pre-fg-1a) open prompt.
const classKey = 'pf1/fgPromptBarbarian';
const parentKey = 'pf1/fgPromptRagePowers';
const memberKey = 'pf1/fgPromptAnimalFury';
const fourthMemberKey = 'pf1/fgPromptRollingDodge';
const outsiderKey = 'pf1/fgPromptEvilEye';
// Another entry with a member's name: a pick never matches a member by name.
const namesakeKey = 'pf1/fgPromptAnimalFuryNamesake';
const list = 'Barbarian: Rage Power';
const openList = 'Barbarian: Open Choice';
const legacyList = 'Barbarian: Legacy Choice';

const body = ({
  externalKey,
  name,
  pack,
  detail,
}: {
  externalKey: string;
  name: string;
  pack: string;
  detail: Record<string, unknown>;
}) => ({
  externalKey,
  upstreamKey: externalKey,
  pack,
  name,
  detail,
  description: `<p>${name} body.</p>`,
  sources: [{ book: 'PZO1110', pages: '9' }],
  modifiers: [],
  unsupported: [],
});
const parentBody = (members: readonly [string, ...string[]]) =>
  body({
    externalKey: parentKey,
    name: 'Rage Powers',
    pack: 'class-abilities',
    detail: {
      kind: 'classFeature',
      picksByLevel: [
        { kind: 'pool', classLevel: 2, list, count: 1, members },
        {
          kind: 'pool',
          classLevel: 4,
          list,
          count: 1,
          members: [memberKey, fourthMemberKey],
        },
        { kind: 'open', classLevel: 2, list: openList, count: 1 },
        { classLevel: 2, list: legacyList, count: 1 },
      ],
    },
  });
const option = (externalKey: string, name: string) =>
  body({
    externalKey,
    name,
    pack: 'class-abilities',
    detail: { kind: 'classFeature' },
  });
const classBody = body({
  externalKey: classKey,
  name: 'Prompt Barbarian',
  pack: 'classes',
  detail: {
    kind: 'class',
    hitDie: 12,
    bab: 'full',
    saves: { fort: 'good', ref: 'poor', will: 'poor' },
    classSkills: [],
    tag: 'promptbarbarian',
    classKind: 'base',
    skillRanksPerLevel: 4,
    featuresByLevel: [{ classLevel: 2, externalKey: parentKey }],
    picksByLevel: [],
  },
});
const classStub = {
  kind: 'class' as const,
  classKind: 'base' as const,
  hitDie: 6,
  bab: 'half' as const,
  saves: {
    fort: 'poor' as const,
    ref: 'poor' as const,
    will: 'good' as const,
  },
  skillRanksPerLevel: 2,
  classSkills: [],
  featuresByLevel: [],
  picksByLevel: [],
};
const releasedBodies = [
  parentBody([memberKey]),
  option(memberKey, 'Animal Fury'),
  option(fourthMemberKey, 'Rolling Dodge'),
  option(outsiderKey, 'Evil Eye'),
  option(namesakeKey, 'Animal Fury'),
  classBody,
];

/** Stored identity stubs for `stubs`, then `released` through a release. */
async function fixture({
  stubs,
  released,
}: {
  stubs: readonly { externalKey: string; name: string; kind: string }[];
  released: readonly { externalKey: string }[];
}) {
  const { t, owner, scope } = await releaseFixture(modules);
  const ids = new Map<string, Id<'catalogEntry'>>();
  const id = (key: string) => {
    const found = ids.get(key);
    if (!found) throw new Error(`Missing ${key}`);
    return found;
  };
  await t.run(async (ctx) => {
    for (const { externalKey, name, kind } of stubs) {
      const identity = {
        scope: 'global' as const,
        name,
        ruleIdentity: externalKey,
        modifiers: [],
        sources: [],
        stacksWithItself: false,
      };
      ids.set(
        externalKey,
        kind === 'class'
          ? await ctx.db.insert('catalogEntry', {
              ...identity,
              detail: classStub,
            })
          : await ctx.db.insert('catalogEntry', {
              ...identity,
              detail: { kind: 'classFeature' },
            }),
      );
    }
  });
  const install = () => installReleasedBodies(t, released, id);
  return { t, owner, scope, id, install };
}

const stubOf = (entry: ReturnType<typeof body>) => ({
  externalKey: entry.externalKey,
  name: entry.name,
  kind: String(entry.detail.kind),
});

/** The released bodies and a Character at Prompt Barbarian 2. */
async function barbarian() {
  const context = await fixture({
    stubs: releasedBodies.map(stubOf),
    released: releasedBodies,
  });
  await context.install();
  const { owner, scope, id } = context;
  const read = () => readSavedSheet(owner, scope);
  const level = (await read()).entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (!level) throw new Error('Missing first Class Level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: id(classKey),
    operationId: 'level-1',
  });
  await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: id(classKey),
    operationId: 'level-2',
  });
  const grantKey = { source: classKey, classLevel: 2, entry: parentKey };
  const source = (promptList: string, classLevel: number) => ({
    kind: 'prompt' as const,
    source: { kind: 'grant' as const, grantKey },
    list: promptList,
    classLevel,
  });
  let operation = 0;
  const operationId = () => `op-${(operation += 1)}`;
  const pickId = (
    catalogEntryId: Id<'catalogEntry'>,
    promptList: string,
    classLevel: number,
  ) =>
    owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId,
      selectionSource: source(promptList, classLevel),
      operationId: operationId(),
    });
  const pick = (key: string, promptList: string, classLevel: number) =>
    pickId(id(key), promptList, classLevel);
  const edit = (
    entryId: Id<'characterSheetEntry'>,
    change: {
      catalogEntryId?: Id<'catalogEntry'>;
      selectionSource?: ReturnType<typeof source>;
      notes?: string;
    },
  ) =>
    owner.mutation(api.characterSheet.editSelection, {
      ...scope,
      entryId,
      ...change,
      operationId: operationId(),
    });
  const row = async (entryId: Id<'characterSheetEntry'>) =>
    (await read()).calculated.resolvedEntries.find(
      (resolved) => resolved.storedEntryId === entryId,
    );
  return {
    ...context,
    read,
    source,
    pick,
    pickId,
    edit,
    row,
    operationId,
  };
}

/** The refusal's `ConvexError` data. */
async function refusalOf(write: Promise<unknown>) {
  return await write.then(
    () => {
      throw new Error('The write was saved');
    },
    (error: { data?: unknown }) => error.data,
  );
}
const refused = (reason: PromptPickRefusalReason) => promptPickRefusal(reason);

test('a release keeps a pool prompt members by stable key and rule identity, and emits every open prompt tagged', async () => {
  const { t, id } = await barbarian();
  const parent = await t.run((ctx) =>
    ctx.db.get('catalogEntry', id(parentKey)),
  );
  const member = (key: string) => ({
    catalogEntryId: id(key),
    ruleIdentity: key,
  });
  expect(parent?.detail).toEqual({
    kind: 'classFeature',
    picksByLevel: [
      {
        kind: 'pool',
        classLevel: 2,
        list,
        count: 1,
        members: [member(memberKey)],
      },
      {
        kind: 'pool',
        classLevel: 4,
        list,
        count: 1,
        members: [member(memberKey), member(fourthMemberKey)],
      },
      { kind: 'open', classLevel: 2, list: openList, count: 1 },
      { kind: 'open', classLevel: 2, list: legacyList, count: 1 },
    ],
  });
});

// The input family is a prompt pick: a `prompt` source and a chosen entry.
// The public mutations that accept a `selectionSource` are pinned here, so a
// new one fails this test until it is covered below.
/** A function module: not a test, generated code or a Node action module. */
const isFunctionModule = (path: string) =>
  !path.includes('.test.') &&
  !path.startsWith('./_generated/') &&
  !/^['"]use node['"]/m.test(sources[path] ?? '');
/** A public mutation whose arguments include a Selection source. */
function acceptsSelectionSource(registered: unknown) {
  const fn = registered as {
    isMutation?: boolean;
    isPublic?: boolean;
    exportArgs?: () => string;
  } | null;
  return Boolean(
    fn?.isMutation &&
    fn.isPublic &&
    typeof fn.exportArgs === 'function' &&
    fn.exportArgs().includes('"selectionSource"'),
  );
}

test('the public mutations that accept a prompt source are exactly selectEntry and editSelection', async () => {
  const accepting: string[] = [];
  const unloadable: string[] = [];
  for (const [path, load] of Object.entries(modules).filter(([path]) =>
    isFunctionModule(path),
  )) {
    // A module that only loads in the Convex runtime, such as the component
    // configuration, is skipped, and pinned below.
    const exports = (await load().catch(() => {
      unloadable.push(path);
      return {};
    })) as Record<string, unknown>;
    for (const [name, registered] of Object.entries(exports))
      if (acceptsSelectionSource(registered)) accepting.push(`${path}:${name}`);
  }
  expect(unloadable).toEqual(['./convex.config.ts']);
  expect(accepting.sort()).toEqual([
    './characterSheet.ts:editSelection',
    './characterSheet.ts:selectEntry',
  ]);
});

// The refused set, over every pinned path: selectEntry, and editSelection
// changing the chosen entry, the source, or both.
const refusedPicks: readonly {
  name: string;
  entry: string;
  list: string;
  level: number;
  reason: PromptPickRefusalReason;
}[] = [
  {
    name: 'another entry',
    entry: outsiderKey,
    list,
    level: 2,
    reason: 'outsidePool',
  },
  {
    name: "a member's namesake",
    entry: namesakeKey,
    list,
    level: 2,
    reason: 'outsidePool',
  },
  {
    name: "the 4th-level pool's own member",
    entry: fourthMemberKey,
    list,
    level: 2,
    reason: 'outsidePool',
  },
  {
    name: 'an undefined list',
    entry: memberKey,
    list: 'Witch: Hex',
    level: 2,
    reason: 'undefinedList',
  },
  {
    name: 'an undefined level of a pool',
    entry: memberKey,
    list,
    level: 3,
    reason: 'undefinedLevel',
  },
  {
    name: 'an undefined level of an open list',
    entry: memberKey,
    list: openList,
    level: 4,
    reason: 'undefinedLevel',
  },
];

test('every path that accepts a prompt pick refuses the whole refused set with its typed reason, and saves nothing', async () => {
  const { id, read, source, pick, edit, row } = await barbarian();

  // What is accepted: an in-pool pick, which counts; the 4th-level pool's
  // own member; any option at an open prompt, tagged or untagged.
  const picked = await pick(memberKey, list, 2);
  expect(await row(picked)).toMatchObject({ counting: true, dormant: false });
  await pick(fourthMemberKey, list, 4);
  await pick(outsiderKey, openList, 2);
  await pick(outsiderKey, legacyList, 2);

  const before = (await read()).entries;
  for (const { name, entry, list: promptList, level, reason } of refusedPicks) {
    const expected = refused(reason);
    expect(
      await refusalOf(pick(entry, promptList, level)),
      `selectEntry: ${name}`,
    ).toEqual(expected);
    expect(
      await refusalOf(
        edit(picked, {
          catalogEntryId: id(entry),
          selectionSource: source(promptList, level),
        }),
      ),
      `editSelection, entry and source: ${name}`,
    ).toEqual(expected);
    if (promptList === list && level === 2)
      expect(
        await refusalOf(edit(picked, { catalogEntryId: id(entry) })),
        `editSelection, entry: ${name}`,
      ).toEqual(expected);
    if (entry === memberKey)
      expect(
        await refusalOf(
          edit(picked, { selectionSource: source(promptList, level) }),
        ),
        `editSelection, source: ${name}`,
      ).toEqual(expected);
  }
  expect((await read()).entries).toEqual(before);
});

test('a pool accepts a member through successive Catalog Copies and a campaign preference, by rule identity', async () => {
  const { t, owner, scope, id, read, pick, pickId, row, operationId } =
    await barbarian();

  // Detach, then Save to catalog, twice: the second campaign copy's
  // immediate origin is the first copy, not the member.
  const picked = await pick(memberKey, list, 2);
  const definitionOf = async (entryId: Id<'characterSheetEntry'>) => {
    const entry = (await read()).entries.find((row) => row._id === entryId);
    if (!entry || !('catalogEntryId' in entry)) throw new Error('Missing pick');
    return entry.catalogEntryId;
  };
  let copy: Id<'catalogEntry'> = id(memberKey);
  for (const round of [1, 2]) {
    const detached = await owner.mutation(api.catalogCopies.detach, {
      ...scope,
      target: { kind: 'entry', entryId: picked },
      operationId: `detach-${round}`,
    });
    copy = await owner.mutation(api.catalogCopies.saveToCatalog, {
      ...scope,
      catalogEntryId: detached,
      operationId: `save-${round}`,
    });
  }
  const second = await t.run((ctx) => ctx.db.get('catalogEntry', copy));
  expect(second).toMatchObject({ scope: 'campaign', ruleIdentity: memberKey });
  expect(second?.copiedFrom).not.toBe(id(memberKey));
  expect(await definitionOf(picked)).toBe(copy);
  expect(await row(picked)).toMatchObject({ counting: true, dormant: false });
  const again = await pickId(copy, list, 2);
  expect(await row(again)).toMatchObject({ counting: true, dormant: false });

  // A campaign preference: choosing the member saves its preferred copy.
  const preferred = await owner.mutation(
    api.catalogCopies.customizeForCampaign,
    {
      ...scope,
      catalogEntryId: id(fourthMemberKey),
      operationId: operationId(),
    },
  );
  const remapped = await pick(fourthMemberKey, list, 4);
  expect(await definitionOf(remapped)).toBe(preferred);

  // A copy of an outsider is still outside the pool.
  const outsiderCopy = await owner.mutation(
    api.catalogCopies.customizeForCampaign,
    { ...scope, catalogEntryId: id(outsiderKey), operationId: operationId() },
  );
  expect(await refusalOf(pickId(outsiderCopy, list, 2))).toEqual(
    refused('outsidePool'),
  );
});

test('after its source drops the prompt, changing the chosen entry refuses, and other edits keep the dormant pick', async () => {
  const { t, owner, scope, id, edit, pick, row, operationId } =
    await barbarian();
  const picked = await pick(memberKey, list, 2);
  const parentCopy = await owner.mutation(
    api.catalogCopies.customizeForCampaign,
    { ...scope, catalogEntryId: id(parentKey), operationId: operationId() },
  );
  const prompts = async () => {
    const parent = await t.run((ctx) => ctx.db.get('catalogEntry', parentCopy));
    if (parent?.detail.kind !== 'classFeature')
      throw new Error('Missing parent copy');
    return parent.detail.picksByLevel ?? [];
  };
  type Prompt = Awaited<ReturnType<typeof prompts>>[number];
  const keep = async (kept: (prompt: Prompt) => boolean) =>
    await owner.mutation(api.catalogCopies.editDefinition, {
      ...scope,
      catalogEntryId: parentCopy,
      detail: {
        kind: 'classFeature',
        picksByLevel: (await prompts()).filter(kept),
      } as Extract<Doc<'catalogEntry'>['detail'], { kind: 'classFeature' }>,
      operationId: operationId(),
    });

  // The list stays, at 4th level only.
  await keep((prompt) => prompt.list !== list || prompt.classLevel === 4);
  expect(await row(picked)).toMatchObject({ dormant: true });
  expect(
    await refusalOf(edit(picked, { catalogEntryId: id(fourthMemberKey) })),
  ).toEqual(refused('undefinedLevel'));
  await edit(picked, { notes: 'Kept while dormant' });

  // The list is gone.
  await keep((prompt) => prompt.list !== list);
  expect(
    await refusalOf(edit(picked, { catalogEntryId: id(outsiderKey) })),
  ).toEqual(refused('undefinedList'));
  await edit(picked, { notes: 'Still kept' });
  expect(await row(picked)).toMatchObject({
    dormant: true,
    entry: { catalogEntryId: id(memberKey), notes: 'Still kept' },
  });
});

test('a renamed or removed member refuses the release; a pick never matches a member by name', async () => {
  const renamedKey = 'pf1/fgPromptAnimalFuryRenamed';
  // The parent still names the member's old key; the catalog has "Animal
  // Fury" only under its new key.
  const renamed = [
    parentBody([memberKey]),
    option(renamedKey, 'Animal Fury'),
    option(fourthMemberKey, 'Rolling Dodge'),
    classBody,
  ];
  const first = await fixture({
    stubs: renamed.map(stubOf),
    released: renamed,
  });
  await expect(first.install()).rejects.toThrow(
    `Candidate reference ${memberKey} is unavailable for ${parentKey}`,
  );

  // A member key with no Catalog Entry at all.
  const removedKey = 'pf1/fgPromptRemoved';
  const removed = [
    parentBody([removedKey]),
    option(memberKey, 'Animal Fury'),
    option(fourthMemberKey, 'Rolling Dodge'),
    classBody,
  ];
  const second = await fixture({
    stubs: removed.map(stubOf),
    released: removed,
  });
  await expect(second.install()).rejects.toThrow(
    `Candidate reference ${removedKey} is unavailable for ${parentKey}`,
  );
});
