// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import type { Doc, Id } from '../_generated/dataModel';
import { planCharacterMove } from './characterMovePlan';
import { validate } from 'convex-helpers/validators';
import schema from '../schema';
import { calculateDefinitionFingerprint } from './catalogCopies';

const characterId = 'character' as Id<'character'>;
const campaignId = 'campaign-a' as Id<'campaign'>;
const catalogId = (id: string) => id as Id<'catalogEntry'>;

function definition(
  id: string,
  fields: Partial<Omit<Doc<'catalogEntry'>, 'detail' | 'modifiers'>> & {
    detail?: Doc<'catalogEntry'>['detail'];
  } = {},
): Doc<'catalogEntry'> {
  const row = {
    _id: catalogId(id),
    _creationTime: 0,
    scope: 'campaign',
    campaignId,
    name: id,
    ruleIdentity: id,
    stacksWithItself: false,
    sources: [],
    modifiers: [],
    detail: { kind: 'manual' },
    ...fields,
  };
  if (!validate(schema.doc('catalogEntry'), row))
    throw new Error('Invalid catalog fixture');
  return row;
}

test.each(['campaign', 'global'] as const)(
  'an unused retained %s definition remains a root with its complete dependencies',
  async (scope) => {
    const result = await planCharacterMove({
      characterId,
      sourceCampaignId: campaignId,
      sheet: { entries: [] },
      retainedDefinitionIds: [catalogId('retained')],
      definitions: [
        definition('retained', {
          scope,
          campaignId: scope === 'global' ? undefined : campaignId,
          grants: [{ catalogEntryId: catalogId('future-child') }],
        }),
        definition('future-child'),
        definition('unrelated'),
      ],
      allocatedIds: {
        retained: catalogId('own-retained'),
        'future-child': catalogId('own-child'),
      },
    });
    expect(result.requiredDefinitionIds).toEqual(['future-child', 'retained']);
    expect(result.copySourceIds).toEqual(
      scope === 'campaign' ? ['future-child', 'retained'] : ['future-child'],
    );
    expect(result.sheet).toEqual({ entries: [] });
  },
);

test.each(['missing', 'foreign'])(
  'a %s retained definition refuses departure rather than dropping its preservation root',
  async (kind) => {
    await expect(
      planCharacterMove({
        characterId,
        sourceCampaignId: campaignId,
        sheet: { entries: [] },
        retainedDefinitionIds: [catalogId('retained')],
        definitions:
          kind === 'missing'
            ? []
            : [
                definition('retained', {
                  campaignId: 'foreign-campaign' as Id<'campaign'>,
                }),
              ],
      }),
    ).rejects.toThrow('Catalog dependency does not belong to this Character');
  },
);

test('departure copies required campaign definitions and retains live global identities', async () => {
  const sheet = {
    entries: [
      { _id: 'row-a', catalogEntryId: catalogId('homebrew'), active: false },
      { _id: 'row-b', catalogEntryId: catalogId('global'), active: true },
    ],
  };
  const result = await planCharacterMove({
    characterId,
    sourceCampaignId: campaignId,
    sheet,
    definitions: [
      definition('homebrew'),
      definition('global', { scope: 'global', campaignId: undefined }),
      definition('unrelated'),
    ],
    allocatedIds: { homebrew: catalogId('carried') },
  });

  expect(result.complete).toBe(true);
  expect(result.copySourceIds).toEqual(['homebrew']);
  expect(result.requiredDefinitionIds).toEqual(['global', 'homebrew']);
  expect(result.sheet.entries).toEqual([
    { _id: 'row-a', catalogEntryId: 'carried', active: false },
    { _id: 'row-b', catalogEntryId: 'global', active: true },
  ]);
  expect(result.copies).toMatchObject([
    {
      sourceId: 'homebrew',
      id: 'carried',
      definition: {
        scope: 'character',
        characterId,
        copiedFrom: 'homebrew',
        ruleIdentity: 'homebrew',
      },
    },
  ]);
  expect(result.copies[0]?.definition).not.toHaveProperty('campaignId');
  expect(sheet.entries[0]?.catalogEntryId).toBe('homebrew');
});

test.each(['campaign', 'global'] as const)(
  'a %s class carries unrecorded keyed spell lists and future prompt options',
  async (scope) => {
    const castingClass = definition('class', {
      scope,
      campaignId: scope === 'global' ? undefined : campaignId,
      detail: {
        kind: 'class',
        classKind: 'base',
        hitDie: 8,
        bab: 'half',
        saves: { fort: 'poor', ref: 'poor', will: 'good' },
        skillRanksPerLevel: 2,
        classSkills: [],
        featuresByLevel: [
          { classLevel: 20, catalogEntryId: catalogId('talent') },
        ],
        picksByLevel: [{ classLevel: 20, list: 'future-talents', count: 1 }],
        casting: {
          classTag: 'homebrew-list',
          type: 'prepared',
          spellKind: 'arcane',
          ability: 'intelligence',
          record: 'none',
          cantrips: true,
          casterLevelOffset: 0,
          table: 'prepared-full',
        },
      },
    });
    const result = await planCharacterMove({
      characterId,
      sourceCampaignId: campaignId,
      sheet: [{ classEntryId: catalogId('class') }],
      definitions: [
        castingClass,
        definition('spell', {
          detail: { kind: 'spell', levels: { 'homebrew-list': 9 } },
        }),
        definition('talent', {
          detail: { kind: 'classFeature' },
          grants: [{ catalogEntryId: catalogId('talent-child') }],
        }),
        definition('talent-child'),
        definition('other-list', {
          detail: { kind: 'spell', levels: { other: 1 } },
        }),
      ],
      allocatedIds: {
        class: catalogId('class-copy'),
        spell: catalogId('spell-copy'),
        talent: catalogId('talent-copy'),
        'talent-child': catalogId('child-copy'),
      },
    });
    expect(result.requiredDefinitionIds).toEqual([
      'class',
      'spell',
      'talent',
      'talent-child',
    ]);
    expect(result.copies.map(({ sourceId }) => sourceId)).toEqual(
      scope === 'global'
        ? ['spell', 'talent', 'talent-child']
        : ['class', 'spell', 'talent', 'talent-child'],
    );
    expect(result.sheet[0]?.classEntryId).toBe(
      scope === 'global' ? 'class' : 'class-copy',
    );
    expect(
      result.copies.find(({ sourceId }) => sourceId === 'spell')?.definition
        .detail,
    ).toEqual({
      kind: 'spell',
      levels: { 'homebrew-list': 9 },
    });
  },
);

test.each([
  {
    variant: 'identical own copy',
    scope: 'character',
    owner: characterId,
    edited: false,
    reuse: true,
  },
  {
    variant: 'edited own copy',
    scope: 'character',
    owner: characterId,
    edited: true,
    reuse: false,
  },
  {
    variant: 'another Character copy',
    scope: 'character',
    owner: 'someone-else' as Id<'character'>,
    edited: false,
    reuse: false,
  },
  {
    variant: 'shared destination copy',
    scope: 'campaign',
    owner: undefined,
    edited: false,
    reuse: false,
  },
] as const)(
  '$variant preserves choices and reuses only an identical definition belonging to this Character',
  async ({ scope, owner, edited, reuse }) => {
    const original = definition('original', {
      ruleIdentity: 'shared-rule',
      sourceKey: 'same-source',
    });
    const candidate = definition('previous-copy', {
      ...original,
      _id: catalogId('previous-copy'),
      scope,
      campaignId:
        scope === 'campaign' ? ('destination' as Id<'campaign'>) : undefined,
      characterId: owner,
      copiedFrom: catalogId('original'),
      name: edited ? 'My edited choice' : original.name,
    });
    const result = await planCharacterMove({
      characterId,
      sourceCampaignId: campaignId,
      sheet: [{ catalogEntryId: catalogId('original') }],
      definitions: [original, candidate],
      allocatedIds: { original: catalogId('new-copy') },
    });
    expect(result.sheet[0]?.catalogEntryId).toBe(
      reuse ? 'previous-copy' : 'new-copy',
    );
    expect(result.copies).toHaveLength(reuse ? 0 : 1);
    expect(result.updates).toEqual([]);
    expect(candidate.name).toBe(edited ? 'My edited choice' : 'original');
  },
);

test('complete progression and cyclic shared dependencies use mappings allocated before remapping', async () => {
  const definitions = [
    definition('class', {
      detail: {
        kind: 'class',
        classKind: 'base',
        hitDie: 8,
        bab: 'full',
        saves: { fort: 'good', ref: 'poor', will: 'poor' },
        skillRanksPerLevel: 2,
        classSkills: [],
        picksByLevel: [],
        featuresByLevel: [
          { classLevel: 20, catalogEntryId: catalogId('future') },
        ],
      },
    }),
    definition('future', { grants: [{ catalogEntryId: catalogId('shared') }] }),
    definition('shared', { grants: [{ catalogEntryId: catalogId('future') }] }),
    definition('another', {
      grants: [{ catalogEntryId: catalogId('shared') }],
    }),
  ];
  const input = {
    characterId,
    sourceCampaignId: campaignId,
    sheet: [
      { classEntryId: catalogId('class') },
      { catalogEntryId: catalogId('another') },
    ],
    definitions,
  };
  const discovery = await planCharacterMove(input);
  expect(discovery.copySourceIds).toEqual([
    'another',
    'class',
    'future',
    'shared',
  ]);
  expect(discovery.complete).toBe(false);
  expect(discovery.copies).toEqual([]);
  expect(discovery.sheet).toEqual(input.sheet);
  const result = await planCharacterMove({
    ...input,
    allocatedIds: {
      another: catalogId('a-copy'),
      class: catalogId('c-copy'),
      future: catalogId('f-copy'),
      shared: catalogId('s-copy'),
    },
  });
  expect(result.complete).toBe(true);
  expect(
    result.copies.map(({ sourceId, definition: row }) => [
      sourceId,
      row.grants,
    ]),
  ).toEqual([
    ['another', [{ catalogEntryId: 's-copy' }]],
    ['class', undefined],
    ['future', [{ catalogEntryId: 's-copy' }]],
    ['shared', [{ catalogEntryId: 'f-copy' }]],
  ]);
  expect(result.copies[1]?.definition.detail).toMatchObject({
    featuresByLevel: [{ classLevel: 20, catalogEntryId: 'f-copy' }],
  });
});

test.each(['off', 'dormant', 'kept', 'orphaned'])(
  'retained %s state and unused own customizations carry dependencies without changing saved identities',
  async (state) => {
    const sheet = {
      entries: [
        {
          _id: 'saved-row',
          catalogEntryId: catalogId('retained'),
          active: false,
          status: state,
          grantKey: { source: 'retained', entry: 'retained', classLevel: 9 },
          state: {
            choice: 'retained',
            gainedAtClassLevel: 'broken-class-link',
          },
        },
      ],
      acceptedWarnings: [
        { subject: 'retained', fingerprint: 'accepted-facts' },
      ],
    };
    const customized = definition('unused-own', {
      scope: 'character',
      characterId,
      campaignId: undefined,
      browseOnly: true,
      name: 'My unselected customization',
      grants: [{ catalogEntryId: catalogId('unused-dependency') }],
    });
    const result = await planCharacterMove({
      characterId,
      sourceCampaignId: campaignId,
      sheet,
      definitions: [
        definition('retained'),
        customized,
        definition('unused-dependency'),
      ],
      allocatedIds: {
        retained: catalogId('retained-copy'),
        'unused-dependency': catalogId('dependency-copy'),
      },
    });
    expect(result.requiredDefinitionIds).toEqual([
      'retained',
      'unused-dependency',
      'unused-own',
    ]);
    expect(result.sheet).toEqual({
      ...sheet,
      entries: [{ ...sheet.entries[0], catalogEntryId: 'retained-copy' }],
    });
    expect(result.updates).toMatchObject([
      {
        id: 'unused-own',
        definition: {
          name: 'My unselected customization',
          browseOnly: true,
          grants: [{ catalogEntryId: 'dependency-copy' }],
        },
      },
    ]);
    expect(customized.grants).toEqual([
      { catalogEntryId: 'unused-dependency' },
    ]);
  },
);

test.each([
  {
    label: 'foreign private',
    definition: definition('ref', {
      scope: 'character',
      characterId: 'other' as Id<'character'>,
      campaignId: undefined,
    }),
  },
  {
    label: 'foreign campaign',
    definition: definition('ref', { campaignId: 'other' as Id<'campaign'> }),
  },
  { label: 'missing', definition: undefined },
])('refuses $label content dependencies', async ({ definition: row }) => {
  await expect(
    planCharacterMove({
      characterId,
      sourceCampaignId: campaignId,
      sheet: { catalogEntryId: catalogId('ref') },
      definitions: row ? [row] : [],
      allocatedIds: { ref: catalogId('new') },
    }),
  ).rejects.toThrow('Catalog dependency does not belong to this Character');
});

test('missing Class Level and symbolic conditions remain recorded while provenance and equality identities are not dependencies', async () => {
  const own = definition('own', {
    scope: 'character',
    characterId,
    campaignId: undefined,
    copiedFrom: catalogId('inaccessible-origin'),
    ruleIdentity: 'inaccessible-origin',
  });
  const sheet = {
    classEntryId: catalogId('missing-class'),
    condition: { option: 'unrepresented-symbolic-option' },
    grantKey: { source: 'inaccessible-origin', entry: 'inaccessible-origin' },
  };
  const result = await planCharacterMove({
    characterId,
    sheet,
    definitions: [own],
  });
  expect(result.complete).toBe(true);
  expect(result.copySourceIds).toEqual([]);
  expect(result.requiredDefinitionIds).toEqual(['own']);
  expect(result.sheet).toEqual(sheet);
});

test('ID-based scoped list keys remap with their class while durable Grant keys stay unchanged', async () => {
  const castingClass = definition('class', {
    detail: {
      kind: 'class',
      classKind: 'base',
      hitDie: 6,
      bab: 'half',
      saves: { fort: 'poor', ref: 'poor', will: 'good' },
      skillRanksPerLevel: 2,
      classSkills: [],
      featuresByLevel: [],
      picksByLevel: [{ classLevel: 20, list: 'class', count: 1 }],
      casting: {
        classTag: 'class',
        type: 'prepared',
        spellKind: 'arcane',
        ability: 'intelligence',
        record: 'none',
        cantrips: true,
        casterLevelOffset: 0,
        table: 'prepared-full',
      },
    },
  });
  const result = await planCharacterMove({
    characterId,
    sourceCampaignId: campaignId,
    sheet: {
      classEntryId: catalogId('class'),
      selectionSource: { list: 'class' },
      grantKey: { source: 'class', entry: 'spell' },
    },
    definitions: [
      castingClass,
      definition('spell', { detail: { kind: 'spell', levels: { class: 5 } } }),
    ],
    allocatedIds: {
      class: catalogId('class-copy'),
      spell: catalogId('spell-copy'),
    },
  });
  expect(result.sheet).toEqual({
    classEntryId: 'class-copy',
    selectionSource: { list: 'class-copy' },
    grantKey: { source: 'class', entry: 'spell' },
  });
  expect(result.copies[0]?.definition.detail).toMatchObject({
    casting: { classTag: 'class-copy' },
    picksByLevel: [{ classLevel: 20, list: 'class-copy', count: 1 }],
  });
  expect(result.copies[1]?.definition.detail).toEqual({
    kind: 'spell',
    levels: { 'class-copy': 5 },
  });
});

test.each([false, true])(
  'a previously carried dependency graph is reused after reselecting its source (cycle: %s)',
  async (cycle) => {
    const sourceParent = definition('parent', {
      grants: [{ catalogEntryId: catalogId('child') }],
    });
    const sourceChild = definition(
      'child',
      cycle ? { grants: [{ catalogEntryId: catalogId('parent') }] } : {},
    );
    const carriedParent = definition('own-parent', {
      ...sourceParent,
      _id: catalogId('own-parent'),
      scope: 'character',
      campaignId: undefined,
      characterId,
      copiedFrom: catalogId('parent'),
      grants: [{ catalogEntryId: catalogId('own-child') }],
    });
    const carriedChild = definition('own-child', {
      ...sourceChild,
      _id: catalogId('own-child'),
      scope: 'character',
      campaignId: undefined,
      characterId,
      copiedFrom: catalogId('child'),
      ...(cycle
        ? { grants: [{ catalogEntryId: catalogId('own-parent') }] }
        : {}),
    });
    const result = await planCharacterMove({
      characterId,
      sourceCampaignId: campaignId,
      sheet: { catalogEntryId: catalogId('parent') },
      definitions: [sourceParent, sourceChild, carriedParent, carriedChild],
    });
    expect(result.complete).toBe(true);
    expect(result.sheet.catalogEntryId).toBe('own-parent');
    expect(result.remapping).toEqual({
      parent: 'own-parent',
      child: 'own-child',
    });
    expect(result.copies).toEqual([]);
    expect(result.updates).toEqual([]);
  },
);

test('round-trip arrival retains divergent carried copies and edited choices without relinking', async () => {
  const first = definition('first', {
    ruleIdentity: 'shared-rule',
    sourceKey: 'same-source',
  });
  const divergent = definition('divergent', {
    copiedFrom: catalogId('first'),
    ruleIdentity: 'shared-rule',
    sourceKey: 'same-source',
    name: 'Different definition',
  });
  const moved = await planCharacterMove({
    characterId,
    sourceCampaignId: campaignId,
    sheet: [
      { catalogEntryId: catalogId('first') },
      { catalogEntryId: catalogId('divergent') },
    ],
    definitions: [first, divergent],
    allocatedIds: {
      first: catalogId('own-first'),
      divergent: catalogId('own-divergent'),
    },
  });
  expect(moved.copies).toHaveLength(2);
  const carried = moved.copies.map(({ id, definition: row }) =>
    definition(id, {
      ...row,
      name: id === 'own-first' ? 'Edited while away' : row.name,
    }),
  );
  const returned = await planCharacterMove({
    characterId,
    sourceCampaignId: 'campaign-b' as Id<'campaign'>,
    sheet: moved.sheet,
    definitions: carried,
  });
  expect(returned.complete).toBe(true);
  expect(returned.copies).toEqual([]);
  expect(returned.updates).toEqual([]);
  expect(returned.sheet).toEqual(moved.sheet);
  expect(carried.map((row) => [row._id, row.name, row.ruleIdentity])).toEqual([
    ['own-divergent', 'Different definition', 'shared-rule'],
    ['own-first', 'Edited while away', 'shared-rule'],
  ]);
});

test('a live global parent carries its effective campaign dependency without mutating the global', async () => {
  const global = definition('global', {
    scope: 'global',
    campaignId: undefined,
    grants: [{ catalogEntryId: catalogId('preferred') }],
  });
  const result = await planCharacterMove({
    characterId,
    sourceCampaignId: campaignId,
    sheet: { catalogEntryId: catalogId('global') },
    definitions: [
      global,
      definition('preferred', {
        campaignPreference: true,
        copiedFrom: catalogId('global-child'),
      }),
    ],
    allocatedIds: { preferred: catalogId('carried-child') },
  });
  expect(result.sheet.catalogEntryId).toBe('global');
  expect(result.remapping).toEqual({ preferred: 'carried-child' });
  expect(result.updates).toEqual([]);
  expect(result.copies).toMatchObject([
    { sourceId: 'preferred', id: 'carried-child' },
  ]);
  expect(global.grants).toEqual([{ catalogEntryId: 'preferred' }]);
});

test('copy-time advisories use the persisted origin fingerprint while effective dependency references are carried', async () => {
  const raw = definition('parent', {
    grants: [{ catalogEntryId: catalogId('global-child') }],
  });
  const effective = definition('parent', {
    grants: [{ catalogEntryId: catalogId('preferred-child') }],
  });
  const fingerprint = await calculateDefinitionFingerprint(raw);
  const result = await planCharacterMove({
    characterId,
    sourceCampaignId: campaignId,
    sheet: { catalogEntryId: catalogId('parent') },
    definitions: [effective, definition('preferred-child')],
    sourceFingerprints: { parent: fingerprint },
    allocatedIds: {
      parent: catalogId('carried-parent'),
      'preferred-child': catalogId('carried-child'),
    },
  });
  expect(
    result.copies.find(({ sourceId }) => sourceId === 'parent')?.definition,
  ).toMatchObject({
    copiedFromFingerprint: fingerprint,
    grants: [{ catalogEntryId: 'carried-child' }],
  });
});

test('a missing required dependency is rejected even when the same ID is first seen as a missing Class Level', async () => {
  await expect(
    planCharacterMove({
      characterId,
      definitions: [],
      sheet: {
        catalogEntryId: catalogId('missing'),
        classEntryId: catalogId('missing'),
      },
    }),
  ).rejects.toThrow('Catalog dependency does not belong to this Character');
});

test('obsolete client-declared keyed edges do not expand the required definition closure', async () => {
  const result = await planCharacterMove({
    characterId,
    sourceCampaignId: campaignId,
    sheet: [{ catalogEntryId: catalogId('root') }],
    definitions: [
      definition('root', { requiredDependencyKeys: ['made-up-list'] }),
      definition('unrelated', { dependencyKeys: ['made-up-list'] }),
    ],
    allocatedIds: { root: catalogId('root-copy') },
  });
  expect(result.requiredDefinitionIds).toEqual(['root']);
  expect(result.copySourceIds).toEqual(['root']);
});

test.each([
  ['no remapping', {}],
  ['a remapping it does not name', { 'other-source': catalogId('other-copy') }],
])(
  'a planned sheet with %s is a copy the caller’s sheet does not share',
  async (_case, allocatedIds) => {
    const sheet = { entries: [{ note: { text: 'kept' } }] };
    const result = await planCharacterMove({
      characterId,
      sourceCampaignId: campaignId,
      sheet,
      definitions: [definition('other-source')],
      retainedDefinitionIds: Object.keys(allocatedIds).map(catalogId),
      allocatedIds,
    });
    expect(result.complete).toBe(true);
    expect(result.sheet).toEqual(sheet);
    expect(result.sheet).not.toBe(sheet);
    expect(result.sheet.entries[0]?.note).not.toBe(sheet.entries[0]?.note);
  },
);
