// @vitest-environment node
import { afterEach, expect, it } from 'vitest';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  importCatalog,
  draftCatalogCuration,
} from '../../scripts/catalog/import';
import { assessCatalogAdmission } from '../../scripts/catalog/admission';
import { resolveSheet } from '../../src/lib/character-sheet';
import type { CurationRecord } from '../../scripts/catalog/curation';

const temporary: string[] = [];
const bounded = {
  systemPath: resolve('tests/fixtures/curation/pf1'),
  contentPath: resolve('tests/fixtures/curation/pf1-content'),
  remaps: [],
};

it('reproduces the committed checked/drafted/no-output fixture artifacts at the import seam', async () => {
  const records = JSON.parse(
    await readFile(
      resolve('tests/fixtures/curation/expected/reviewed-records.json'),
      'utf8',
    ),
  );
  const artifact = await importCatalog({ ...bounded, curation: records });
  expect(JSON.stringify(artifact, null, 2) + '\n').toBe(
    await readFile(
      resolve('tests/fixtures/curation/expected/pipeline.json'),
      'utf8',
    ),
  );
  expect(artifact.curation).toMatchObject({
    passed: true,
    summary: {
      required: 10,
      drafted: 8,
      checked: 2,
      missing: 0,
      descriptions: { candidates: 1, drafted: 1, checked: 0 },
    },
  });
  expect(
    artifact.catalog.entries.some(
      (entry) =>
        entry.externalKey.endsWith('upTvrmZoeKq2LI0F') ||
        entry.externalKey.endsWith('jTaeREVBdEeawArA'),
    ),
  ).toBe(false);
});
afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function fixture(systemFields: object = {}) {
  const root = await mkdtemp(join(tmpdir(), 'catalog-curation-'));
  temporary.push(root);
  const systemPath = join(root, 'system');
  const contentPath = join(root, 'content');
  await mkdir(join(systemPath, 'public'), { recursive: true });
  await mkdir(join(systemPath, 'packs/feats'), { recursive: true });
  await mkdir(join(contentPath, 'src'), { recursive: true });
  await writeFile(
    join(systemPath, 'public/system.json'),
    JSON.stringify({ version: '11.11', packs: [{ name: 'feats' }] }),
  );
  await writeFile(
    join(contentPath, 'module.json'),
    JSON.stringify({ version: '11.4.0', packs: [] }),
  );
  const file = join(systemPath, 'packs/feats/fixture.yaml');
  await writeFile(
    file,
    JSON.stringify({
      _id: 'FixtureNote',
      _key: '!items!FixtureNote',
      name: 'Fixture note',
      type: 'feat',
      system: systemFields,
    }),
  );
  return { root, file, systemPath, contentPath, remaps: [] };
}

it('fails catalog admission with an itemised missing-note record even when attribution is held', async () => {
  const input = await fixture({
    contextNotes: [
      { target: 'allSavingThrows', text: '+[[2]] Racial vs poison' },
    ],
  });
  const artifact = await importCatalog(input);
  expect(artifact.curation).toMatchObject({
    passed: false,
    missing: [
      {
        externalKey: 'pf1/FixtureNote',
        kind: 'note',
        target: 'allSavingThrows',
        text: '+[[2]] Racial vs poison',
      },
    ],
  });
  const admission = assessCatalogAdmission({
    artifact,
    assessments: [],
    evidence: {},
    registry: {},
  });
  expect(admission.failures).toContainEqual(
    expect.objectContaining({
      externalKey: 'pf1/FixtureNote',
      reason: expect.stringContaining('Missing curation record'),
    }),
  );
});

it('drafts a numeric note and applies its runtime-shaped Modifier without adding it to unconditional totals', async () => {
  const input = await fixture({
    contextNotes: [
      { target: 'allSavingThrows', text: '+[[2]] Racial vs poison' },
    ],
  });
  const draft = await draftCatalogCuration(input);
  expect(draft.added).toHaveLength(1);
  expect(draft.records[0]).toMatchObject({
    status: 'drafted',
    kind: 'note',
    outputs: [
      {
        kind: 'modifier',
        target: 'saves',
        bonusType: 'racial',
        value: 2,
        condition: { situation: { local: 'vs poison' } },
      },
    ],
  });
  const artifact = await importCatalog({ ...input, curation: draft });
  expect(artifact.curation).toMatchObject({
    passed: true,
    summary: { required: 1, drafted: 1, checked: 0, missing: 0 },
  });
  expect(artifact.catalog.entries[0]?.modifiers).toEqual([
    {
      target: 'saves',
      bonusType: 'racial',
      value: 2,
      condition: { situation: { local: 'vs poison' } },
    },
  ]);
});

it.each([
  {
    key: 'pf1/Compound',
    field: 'modifiers',
    expected: [
      {
        target: 'cmd',
        bonusType: 'racial',
        value: 4,
        condition: { situation: { local: 'vs bull rush while on ground' } },
      },
      {
        target: 'cmd',
        bonusType: 'racial',
        value: 4,
        condition: { situation: { local: 'vs trip while on ground' } },
      },
    ],
  },
  {
    key: 'pf1/Action',
    field: 'modifiers',
    expected: [
      {
        target: 'attack',
        bonusType: 'enhancement',
        value: 1,
        condition: { weapon: '$self', situation: { local: 'Within 30 ft' } },
      },
    ],
  },
  {
    key: 'pf1-content/Flaming',
    field: 'detail',
    expected: expect.objectContaining({
      bonusEquivalent: 1,
      damageDice: [{ on: 'hit', dice: '1d6', damageType: 'fire' }],
    }),
  },
  {
    key: 'pf1/Formula',
    field: 'modifiers',
    expected: [
      {
        target: 'save.will',
        bonusType: 'morale',
        value: { formula: 'floor((@classLevel.fighter + 2) / 4)' },
        condition: { situation: { local: 'vs fear' } },
      },
    ],
  },
  {
    key: 'pf1/Immunity',
    field: 'situationalNotes',
    expected: [
      {
        target: 'saves',
        text: 'Immune to Magic Sleep',
        situation: { local: 'Magic Sleep' },
      },
    ],
  },
  {
    key: 'pf1/EmptyTarget',
    field: 'situationalNotes',
    expected: [{ text: 'May reroll critical confirmation once' }],
  },
  {
    key: 'pf1-content/Keen',
    field: 'detail',
    expected: expect.objectContaining({
      bonusEquivalent: 1,
      appliesTo: 'melee',
      doublesThreat: true,
      weaponDamageTypes: ['piercing', 'slashing'],
    }),
  },
  {
    key: 'pf1-content/Shadow',
    field: 'modifiers',
    expected: [{ target: 'skill.ste', bonusType: 'competence', value: 5 }],
  },
])(
  'drafts and imports the bounded category $key',
  async ({ key, field, expected }) => {
    const draft = await draftCatalogCuration(bounded);
    const artifact = await importCatalog({ ...bounded, curation: draft });
    expect(
      artifact.catalog.entries.find((entry) => entry.externalKey === key),
    ).toHaveProperty(field, expected);
  },
);

it('drafts prose-only descriptions separately without making undrafted descriptions gate failures', async () => {
  const normal = await draftCatalogCuration(bounded);
  expect(normal.records.some((record) => record.kind === 'description')).toBe(
    false,
  );
  expect(
    (await importCatalog({ ...bounded, curation: normal })).curation.passed,
  ).toBe(true);
  const prose = await draftCatalogCuration({
    ...bounded,
    curation: normal,
    descriptions: true,
  });
  expect(prose.added).toContainEqual(
    expect.objectContaining({ externalKey: 'pf1/Prose', kind: 'description' }),
  );
  const artifact = await importCatalog({ ...bounded, curation: prose });
  expect(
    artifact.catalog.entries.find((entry) => entry.externalKey === 'pf1/Prose')
      ?.modifiers,
  ).toEqual([
    {
      target: 'cmd',
      bonusType: 'racial',
      value: 2,
      condition: { situation: { local: 'against bull rush' } },
    },
  ]);
});

it('refreshes only a stale helper-seeded ability and resumes unchanged records without duplicates', async () => {
  const root = await mkdtemp(join(tmpdir(), 'curation-seeds-'));
  temporary.push(root);
  await cp(resolve('tests/fixtures/curation'), root, { recursive: true });
  const paths = {
    systemPath: join(root, 'pf1'),
    contentPath: join(root, 'pf1-content'),
    remaps: [],
  };
  const original = await draftCatalogCuration(paths);
  const helper = join(
    paths.contentPath,
    'src/pf-special-qualities/_Weapon_Enchant_Conditional_Modifiers_upTvrmZoeKq2LI0F.yaml',
  );
  const text = await readFile(helper, 'utf8');
  const { parse, stringify } = await import('yaml');
  const record = parse(text);
  const flaming = record.system.actions[0].conditionals.find(
    (value: { name: string }) => value.name === 'Flaming',
  );
  flaming.modifiers[0].formula = '2d6';
  await writeFile(helper, stringify(record));
  expect(
    (await importCatalog({ ...paths, curation: original })).curation.missing,
  ).toContainEqual(
    expect.objectContaining({ externalKey: 'pf1-content/Flaming' }),
  );
  const resumed = await draftCatalogCuration({ ...paths, curation: original });
  expect(resumed.added.map((value) => value.externalKey)).toEqual([
    'pf1-content/Flaming',
  ]);
  expect(resumed.records).toHaveLength(original.records.length);
  expect(resumed.replaced).toHaveLength(1);
  const refreshed = await importCatalog({ ...paths, curation: resumed });
  expect(refreshed.curation.missing).toEqual([]);
  expect(refreshed.curation.unresolvedMechanics).toContainEqual(
    expect.objectContaining({ externalKey: 'pf1-content/Flaming' }),
  );
  expect(
    (await draftCatalogCuration({ ...paths, curation: resumed })).added,
  ).toEqual([]);
});

it('applies checked records and explicit covered/no-output records, and leaves missing siblings visible', async () => {
  const input = await fixture({
    contextNotes: [
      { target: 'will', text: '+[[2]] Racial vs fear' },
      { target: 'will', text: 'Already covered by another racial trait' },
      { target: 'will', text: '+[[1]] Racial vs poison' },
    ],
  });
  const draft = await draftCatalogCuration(input);
  const first = draft.records[0];
  const covered = draft.records[1];
  if (!first || !covered) throw new Error('Fixture records missing');
  const checked: CurationRecord = {
    ...first,
    status: 'checked',
    reviewedBy: 'Fixture reviewer',
    reviewedOn: '2026-10-03',
  };
  const curation = {
    records: [
      checked,
      {
        ...covered,
        outputs: [],
        rationale: 'The separate racial trait already supplies this effect.',
      },
    ],
  };
  const artifact = await importCatalog({ ...input, curation });
  expect(artifact.curation).toMatchObject({
    passed: false,
    summary: { checked: 1, drafted: 1, missing: 1 },
  });
  expect(artifact.catalog.entries[0]?.unsupported).toContainEqual(
    expect.objectContaining({
      field: 'contextNotes',
      value: expect.objectContaining({ text: '+[[1]] Racial vs poison' }),
    }),
  );
  const resumed = await draftCatalogCuration({ ...input, curation });
  expect(resumed.added.map((record) => record.text)).toEqual([
    '+[[1]] Racial vs poison',
  ]);
  expect(resumed.records.slice(0, 2)).toEqual(
    curation.records.map((record) => ({ ...record, seedBindings: [] })),
  );
});

it.each(['note text', 'conditional formula', 'ability description'])(
  'invalidates exact changed %s while preserving unrelated records',
  async (change) => {
    const root = await mkdtemp(join(tmpdir(), 'curation-binding-'));
    temporary.push(root);
    await cp(resolve('tests/fixtures/curation'), root, { recursive: true });
    const paths = {
      systemPath: join(root, 'pf1'),
      contentPath: join(root, 'pf1-content'),
      remaps: [],
    };
    const draft = await draftCatalogCuration(paths);
    const file =
      change === 'note text'
        ? join(paths.systemPath, 'packs/feats/Numeric.yaml')
        : change === 'conditional formula'
          ? join(paths.systemPath, 'packs/feats/Action.yaml')
          : join(paths.contentPath, 'src/pf-special-qualities/Flaming.yaml');
    const original = await readFile(file, 'utf8');
    await writeFile(
      file,
      change === 'note text'
        ? original.replace('vs poison', 'vs  poison')
        : change === 'conditional formula'
          ? original.replace('"formula": "1"', '"formula": "2"')
          : original.replace('extra 1d6', 'extra 2d6'),
    );
    const artifact = await importCatalog({ ...paths, curation: draft });
    expect(artifact.curation.missing).toHaveLength(1);
    expect(artifact.curation.stale).toHaveLength(1);
    const resumed = await draftCatalogCuration({ ...paths, curation: draft });
    expect(resumed.added).toHaveLength(1);
    expect(
      (await importCatalog({ ...paths, curation: resumed })).curation.missing,
    ).toEqual([]);
  },
);

it('uses reviewed shared Situations and resolves imported numeric output through the sheet resolver', async () => {
  const input = await fixture({
    contextNotes: [{ target: 'will', text: '+[[2]] Racial vs poison' }],
  });
  const draft = await draftCatalogCuration({
    ...input,
    curation: {
      records: [],
      situations: [
        {
          key: 'poison',
          label: 'vs. poison',
          aliases: ['vs poison'],
          reviewedBy: 'Fixture reviewer',
          reviewedOn: '2026-10-03',
        },
      ],
    },
  });
  const artifact = await importCatalog({ ...input, curation: draft });
  const record = artifact.curation.applied[0];
  const output = record?.outputs[0];
  if (output?.kind !== 'modifier' || output.target !== 'save.will')
    throw new Error('Fixture Will Modifier missing');
  const modifier = {
    ...output,
    target: output.target,
    sheetEntryId: 'poison-trait',
    entryName: 'Poison trait',
    source: 'poison-trait',
    builtIn: false,
  };
  expect(resolveSheet([modifier])['save.will'].total).toBe(0);
  expect(
    resolveSheet([modifier], { situations: ['poison'] })['save.will'].total,
  ).toBe(2);
  expect(
    resolveSheet([modifier], { situations: ['spells'] })['save.will'].total,
  ).toBe(0);
});

it.each([
  'duplicate',
  'unknown target',
  'unknown bonus',
  'unreviewed situation',
  'drafted stacking',
  'missing reviewer',
  'hash mismatch',
  'empty rationale',
])('rejects invalid operator records: %s', async (change) => {
  const input = await fixture({
    contextNotes: [{ target: 'will', text: '+[[2]] Racial vs poison' }],
  });
  const draft = await draftCatalogCuration(input);
  const record = draft.records[0];
  if (!record) throw new Error('Fixture record missing');
  const modifier = record.outputs[0];
  if (modifier?.kind !== 'modifier')
    throw new Error('Fixture Modifier missing');
  const altered =
    change === 'unknown target'
      ? { ...modifier, target: 'criticalConfirmation' }
      : change === 'unknown bonus'
        ? { ...modifier, bonusType: 'invented' }
        : change === 'unreviewed situation'
          ? { ...modifier, condition: { situation: 'poison' } }
          : { ...modifier, stacksWithinEntry: true };
  const curation =
    change === 'duplicate'
      ? { records: [record, record] }
      : {
          records: [
            {
              ...record,
              ...(change === 'missing reviewer'
                ? { status: 'checked' }
                : change === 'hash mismatch'
                  ? { textSha256: '0'.repeat(64) }
                  : change === 'empty rationale'
                    ? { rationale: '' }
                    : { outputs: [altered] }),
            },
          ],
        };
  await expect(importCatalog({ ...input, curation })).rejects.toThrow();
});

it('parses each numeric clause of a compound note with its own value', async () => {
  const input = await fixture({
    contextNotes: [
      {
        target: 'will',
        text: '+[[2]] Racial vs poison and +[[4]] Racial vs fear',
      },
    ],
  });
  const draft = await draftCatalogCuration(input);
  expect(draft.records[0]?.outputs).toEqual([
    {
      kind: 'modifier',
      target: 'save.will',
      bonusType: 'racial',
      value: 2,
      condition: { situation: { local: 'vs poison' } },
    },
    {
      kind: 'modifier',
      target: 'save.will',
      bonusType: 'racial',
      value: 4,
      condition: { situation: { local: 'vs fear' } },
    },
  ]);
});

it('keeps unparsed prose mechanics outside the note gate and reports them separately', async () => {
  const input = await fixture({
    description: { value: '<p>+2 competence bonus when climbing.</p>' },
  });
  const draft = await draftCatalogCuration({ ...input, descriptions: true });
  const artifact = await importCatalog({ ...input, curation: draft });
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.unresolvedDescriptions).toHaveLength(1);
  expect(
    assessCatalogAdmission({
      artifact,
      assessments: [],
      evidence: {},
      registry: {},
    }).failures,
  ).toEqual([]);
});

it('reports removed and retargeted records as stale', async () => {
  const input = await fixture({
    contextNotes: [{ target: 'will', text: '+[[2]] Racial vs poison' }],
  });
  const draft = await draftCatalogCuration(input);
  const original = JSON.parse(await readFile(input.file, 'utf8'));
  original.system.contextNotes[0].target = 'fort';
  await writeFile(input.file, JSON.stringify(original));
  expect(
    (await importCatalog({ ...input, curation: draft })).curation.stale,
  ).toHaveLength(1);
  original.system.contextNotes = [];
  await writeFile(input.file, JSON.stringify(original));
  expect(
    (await importCatalog({ ...input, curation: draft })).curation.stale,
  ).toHaveLength(1);
});

it('does not let an Item Ability price hide unparsed numeric mechanics', async () => {
  const root = await mkdtemp(join(tmpdir(), 'curation-ability-'));
  temporary.push(root);
  await cp(resolve('tests/fixtures/curation'), root, { recursive: true });
  const paths = {
    systemPath: join(root, 'pf1'),
    contentPath: join(root, 'pf1-content'),
    remaps: [],
  };
  const file = join(paths.contentPath, 'src/pf-special-qualities/Shadow.yaml');
  const original = JSON.parse(await readFile(file, 'utf8'));
  original.system.description.value =
    '<p>Price +1 bonus; wearer gains +5 competence bonus on Clamber checks.</p>';
  await writeFile(file, JSON.stringify(original));
  const draft = await draftCatalogCuration(paths);
  const artifact = await importCatalog({ ...paths, curation: draft });
  expect(artifact.curation.passed).toBe(false);
  expect(artifact.curation.unresolvedMechanics).toContainEqual(
    expect.objectContaining({ externalKey: 'pf1-content/Shadow' }),
  );
  expect(
    draft.records.find((record) => record.externalKey === 'pf1-content/Shadow')
      ?.outputs,
  ).toContainEqual(
    expect.objectContaining({
      text: 'Review required: replace this placeholder with readable rules text or structured outputs.',
    }),
  );
});

it('binds notes before sanitization and never shares records across entries or retained identity remaps', async () => {
  const input = await fixture({
    contextNotes: [
      { target: 'will', text: '+[[2]] Racial vs poison<script>first</script>' },
    ],
  });
  const draft = await draftCatalogCuration(input);
  const text = await readFile(input.file, 'utf8');
  await writeFile(
    input.file,
    text.replace('first</script>', 'second</script>'),
  );
  expect(
    (await importCatalog({ ...input, curation: draft })).curation.missing,
  ).toHaveLength(1);
  await writeFile(input.file, text);
  await writeFile(
    join(input.systemPath, 'packs/feats/other.yaml'),
    text.replaceAll('FixtureNote', 'OtherNote'),
  );
  expect(
    (await importCatalog({ ...input, curation: draft })).curation.missing.map(
      (record) => record.externalKey,
    ),
  ).toEqual(['pf1/OtherNote']);
  const remaps = [
    {
      from: 'pf1/FixtureNote',
      to: 'pf1/RetainedNote',
      kind: 'feat',
      reason: 'Reviewed fixture identity',
      evidence: 'Fixture identity evidence',
      reviewedBy: 'Fixture reviewer',
      reviewedOn: '2026-10-03',
    },
  ];
  const remapped = await draftCatalogCuration({ ...input, remaps });
  expect(remapped.records.map((record) => record.externalKey)).toContain(
    'pf1/RetainedNote',
  );
  expect(
    (await importCatalog({ ...input, remaps, curation: remapped })).curation
      .passed,
  ).toBe(true);
});

it('keeps stable action bindings when actions are reordered', async () => {
  const action = {
    _id: 'firstAction',
    conditionals: [
      {
        _id: 'firstConditional',
        name: 'vs poison',
        modifiers: [
          {
            target: 'attack',
            subTarget: 'allAttack',
            type: 'enh',
            formula: '1',
          },
        ],
      },
    ],
  };
  const second = { ...action, _id: 'secondAction' };
  const input = await fixture({ actions: [action, second] });
  const draft = await draftCatalogCuration(input);
  const record = JSON.parse(await readFile(input.file, 'utf8'));
  record.system.actions.reverse();
  await writeFile(input.file, JSON.stringify(record));
  expect(
    (await importCatalog({ ...input, curation: draft })).curation.missing,
  ).toEqual([]);
  expect(
    (await draftCatalogCuration({ ...input, curation: draft })).added,
  ).toEqual([]);
});

it('holds unsupported formula drafts for review and applies readable checked Notes with formula warnings', async () => {
  const input = await fixture({
    contextNotes: [
      { target: 'will', text: '+[[@resources.rage]] Morale vs fear' },
    ],
  });
  const draft = await draftCatalogCuration(input);
  const record = draft.records[0];
  if (!record) throw new Error('Fixture record missing');
  expect(record.outputs).toContainEqual({
    kind: 'note',
    target: 'save.will',
    text: '+rage Morale vs fear',
  });
  expect(record.diagnostics).toContainEqual(
    expect.objectContaining({ kind: 'review' }),
  );
  const held = await importCatalog({ ...input, curation: draft });
  expect(held.catalog.entries[0]?.modifiers).toEqual([]);
  expect(held.curation.passed).toBe(false);
  const artifact = await importCatalog({
    ...input,
    curation: {
      records: [
        {
          ...record,
          status: 'checked',
          reviewedBy: 'Fixture reviewer',
          reviewedOn: '2026-10-03',
        },
      ],
    },
  });
  expect(artifact.catalog.entries[0]?.modifiers).toEqual([
    {
      target: 'save.will',
      bonusType: 'morale',
      value: { formula: '@resources.rage' },
      condition: { situation: { local: 'vs fear' } },
    },
  ]);
  expect(artifact.catalog.entries[0]?.unsupported).toContainEqual(
    expect.objectContaining({ field: 'curation.formula' }),
  );
  expect(artifact.catalog.entries[0]?.situationalNotes).toEqual([
    { target: 'save.will', text: '+rage Morale vs fear' },
  ]);
});

it('holds target-dependent helper mechanics until their Situation is drafted explicitly', async () => {
  const root = await mkdtemp(join(tmpdir(), 'curation-holy-'));
  temporary.push(root);
  await cp(resolve('tests/fixtures/curation'), root, { recursive: true });
  const paths = {
    systemPath: join(root, 'pf1'),
    contentPath: join(root, 'pf1-content'),
    remaps: [],
  };
  await writeFile(
    join(paths.contentPath, 'src/pf-special-qualities/Holy.yaml'),
    JSON.stringify({
      _id: 'Holy',
      _key: '!items!Holy',
      name: 'Holy',
      type: 'feat',
      system: {
        description: {
          value:
            '<p>Deals +2d6 damage against evil creatures. Price +2 bonus</p>',
        },
      },
    }),
  );
  const draft = await draftCatalogCuration(paths);
  const record = draft.records.find(
    (value) => value.externalKey === 'pf1-content/Holy',
  );
  if (!record) throw new Error('Fixture record missing');
  const note = record.outputs.find((output) => output.kind === 'note');
  expect(note).toEqual({
    kind: 'note',
    text: 'Review required: replace this placeholder with readable rules text or structured outputs.',
  });
  const checked = {
    ...record,
    status: 'checked',
    reviewedBy: 'Fixture reviewer',
    reviewedOn: '2026-10-03',
  };
  await expect(
    importCatalog({ ...paths, curation: { records: [checked] } }),
  ).rejects.toThrow(/placeholder/i);
  const edited = await importCatalog({
    ...paths,
    curation: {
      records: [
        {
          ...checked,
          diagnostics: [],
          outputs: [
            {
              kind: 'note',
              text: 'Deals extra damage against evil creatures.',
            },
          ],
        },
      ],
    },
  });
  expect(
    edited.catalog.entries.find(
      (entry) => entry.externalKey === 'pf1-content/Holy',
    )?.situationalNotes,
  ).toEqual([{ text: 'Deals extra damage against evil creatures.' }]);
  const artifact = await importCatalog({ ...paths, curation: draft });
  expect(artifact.curation.passed).toBe(false);
  expect(artifact.curation.unresolvedMechanics).toContainEqual(
    expect.objectContaining({ externalKey: 'pf1-content/Holy' }),
  );
  expect(
    artifact.catalog.entries.find(
      (entry) => entry.externalKey === 'pf1-content/Holy',
    )?.detail,
  ).not.toHaveProperty('damageDice');
});

it('preserves prose preceding a numeric clause instead of silently covering it', async () => {
  const input = await fixture({
    contextNotes: [
      {
        target: 'will',
        text: 'Immune to magic sleep; +[[2]] Racial vs poison',
      },
    ],
  });
  const draft = await draftCatalogCuration(input);
  expect(draft.records[0]?.outputs).toContainEqual({
    kind: 'note',
    target: 'save.will',
    text: 'Immune to magic sleep',
    situation: { local: 'magic sleep' },
  });
  expect(draft.records[0]?.outputs).toContainEqual(
    expect.objectContaining({ kind: 'modifier', value: 2 }),
  );
});

it('does not let seeded dice cover a separate unparsed Item Ability bonus', async () => {
  const root = await mkdtemp(join(tmpdir(), 'curation-seeded-bonus-'));
  temporary.push(root);
  await cp(resolve('tests/fixtures/curation'), root, { recursive: true });
  const paths = {
    systemPath: join(root, 'pf1'),
    contentPath: join(root, 'pf1-content'),
    remaps: [],
  };
  const file = join(paths.contentPath, 'src/pf-special-qualities/Flaming.yaml');
  const original = JSON.parse(await readFile(file, 'utf8'));
  original.system.description.value =
    '<p>Price +1 bonus; extra 1d6 fire damage; +5 competence bonus on Clamber checks.</p>';
  await writeFile(file, JSON.stringify(original));
  const draft = await draftCatalogCuration(paths);
  expect(
    (await importCatalog({ ...paths, curation: draft })).curation
      .unresolvedMechanics,
  ).toContainEqual(
    expect.objectContaining({ externalKey: 'pf1-content/Flaming' }),
  );
});

it('admits recorded Spell Effect caster-level formulas in the same context as ordinary imported changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'curation-spell-effect-'));
  temporary.push(root);
  await cp(resolve('tests/fixtures/curation'), root, { recursive: true });
  const paths = {
    systemPath: join(root, 'pf1'),
    contentPath: join(root, 'pf1-content'),
    remaps: [],
  };
  await writeFile(
    join(paths.contentPath, 'src/pf-buffs/Effect.yaml'),
    JSON.stringify({
      _id: 'Effect',
      _key: '!items!Effect',
      name: 'Effect',
      type: 'buff',
      system: {
        subType: 'spell',
        contextNotes: [
          {
            target: 'will',
            text: '+[[floor(@casterLevel / 2)]] Resistance vs poison',
          },
        ],
      },
    }),
  );
  const draft = await draftCatalogCuration(paths);
  const artifact = await importCatalog({ ...paths, curation: draft });
  expect(
    artifact.catalog.entries
      .find((entry) => entry.externalKey === 'pf1-content/Effect')
      ?.unsupported.filter((issue) => issue.field === 'curation.formula'),
  ).toEqual([]);
  expect(
    artifact.catalog.entries.find(
      (entry) => entry.externalKey === 'pf1-content/Effect',
    )?.modifiers,
  ).toContainEqual({
    target: 'save.will',
    bonusType: 'resistance',
    value: { formula: 'floor(@casterLevel / 2)' },
    condition: { situation: { local: 'vs poison' } },
  });
});

it('keeps fully structured Item Ability mechanics out of Situational Notes', async () => {
  const draft = await draftCatalogCuration(bounded);
  const artifact = await importCatalog({ ...bounded, curation: draft });
  for (const externalKey of [
    'pf1-content/Flaming',
    'pf1-content/Keen',
    'pf1-content/Shadow',
  ]) {
    expect(
      draft.records
        .find((record) => record.externalKey === externalKey)
        ?.outputs.filter((output) => output.kind === 'note'),
    ).toEqual([]);
    expect(
      artifact.catalog.entries.find(
        (entry) => entry.externalKey === externalKey,
      )?.situationalNotes ?? [],
    ).toEqual([]);
  }
});

it('preserves only uncovered Item Ability prose as sanitized plain text lines', async () => {
  const root = await mkdtemp(join(tmpdir(), 'curation-residual-'));
  temporary.push(root);
  await cp(resolve('tests/fixtures/curation'), root, { recursive: true });
  const paths = {
    systemPath: join(root, 'pf1'),
    contentPath: join(root, 'pf1-content'),
    remaps: [],
  };
  const file = join(paths.contentPath, 'src/pf-special-qualities/Flaming.yaml');
  const original = JSON.parse(await readFile(file, 'utf8'));
  original.system.description.value +=
    '<p>May reroll &amp; keep the result.<script>bad</script></p><p>Ignore <strong>concealment</strong>.</p>';
  await writeFile(file, JSON.stringify(original));
  const draft = await draftCatalogCuration(paths);
  const artifact = await importCatalog({ ...paths, curation: draft });
  expect(
    artifact.catalog.entries.find(
      (entry) => entry.externalKey === 'pf1-content/Flaming',
    )?.situationalNotes,
  ).toEqual([{ text: 'May reroll & keep the result.\nIgnore concealment.' }]);
});

it.each(['review', 'unresolved'])(
  'holds diagnosed %s drafts until checked and keeps unresolved mechanics gated',
  async (kind) => {
    const input = await fixture({
      contextNotes: [{ target: 'will', text: '+[[2]] Racial vs poison' }],
    });
    const draft = await draftCatalogCuration(input);
    const record = draft.records[0];
    if (!record) throw new Error('Fixture record missing');
    const curation = {
      records: [
        {
          ...record,
          diagnostics: [{ kind, text: 'Operator needs to check this effect.' }],
        },
      ],
    };
    const held = await importCatalog({ ...input, curation });
    expect(held.catalog.entries[0]?.modifiers).toEqual([]);
    expect(held.curation).toMatchObject({
      passed: false,
      applied: [],
      missing: [],
      unresolvedMechanics: [
        expect.objectContaining({
          diagnostics: [{ kind, text: 'Operator needs to check this effect.' }],
        }),
      ],
    });
    const checked = await importCatalog({
      ...input,
      curation: {
        records: curation.records.map((value) => ({
          ...value,
          status: 'checked',
          reviewedBy: 'Fixture reviewer',
          reviewedOn: '2026-10-03',
        })),
      },
    });
    expect(checked.catalog.entries[0]?.modifiers).toHaveLength(1);
    expect(checked.curation.passed).toBe(kind === 'review');
  },
);

it('drafts every comma-separated prose Situation without truncating the circumstances', async () => {
  const input = await fixture({
    description: {
      value:
        '<p>You gain a +2 racial bonus on saving throws against spells, spell-like abilities, and supernatural abilities.</p>',
    },
  });
  const draft = await draftCatalogCuration({ ...input, descriptions: true });
  expect(draft.records[0]?.diagnostics).toEqual([]);
  const artifact = await importCatalog({ ...input, curation: draft });
  expect(artifact.catalog.entries[0]?.modifiers).toEqual([
    {
      target: 'saves',
      bonusType: 'racial',
      value: 2,
      condition: { situation: { local: 'against spells' } },
    },
    {
      target: 'saves',
      bonusType: 'racial',
      value: 2,
      condition: { situation: { local: 'against spell-like abilities' } },
    },
    {
      target: 'saves',
      bonusType: 'racial',
      value: 2,
      condition: { situation: { local: 'against supernatural abilities' } },
    },
  ]);
});

it.each([
  'You gain a +2 racial bonus on saving throws and a +4 racial bonus to CMD against bull rush.',
  'You gain a +2 racial bonus on saving throws against spells. You gain a +4 bonus when climbing.',
  'May reroll against spells.',
  'You gain a +2 racial bonus on saving throws and CMD against spells.',
  'You gain a +2 racial bonus on saving throws against spells, but not divine spells.',
])(
  'holds incomplete prose candidates for review without applying guessed output: %s',
  async (text) => {
    const input = await fixture({ description: { value: `<p>${text}</p>` } });
    const draft = await draftCatalogCuration({ ...input, descriptions: true });
    expect(draft.records[0]?.diagnostics).toContainEqual(
      expect.objectContaining({ kind: 'review' }),
    );
    const artifact = await importCatalog({ ...input, curation: draft });
    expect(artifact.curation).toMatchObject({
      passed: true,
      applied: [],
      unresolvedDescriptions: [
        expect.objectContaining({ kind: 'description' }),
      ],
    });
    expect(artifact.catalog.entries[0]?.modifiers).toEqual([]);
    expect(artifact.catalog.entries[0]?.situationalNotes ?? []).toEqual([]);
    if (text === 'May reroll against spells.')
      expect(draft.records[0]?.outputs).toEqual([]);
  },
);

it.each([
  { price: '<p>Price +3 bonus</p>', equivalent: 3 },
  {
    price:
      '<p><strong>Slot</strong> armor quality; <strong>Price</strong> +3 bonus;</p>',
    equivalent: 3,
  },
  { price: '<p>Price +3,750 gp</p>', equivalent: 0 },
  { price: '', equivalent: undefined },
])(
  'reads only price metadata and structures recognized skill mechanics: $price',
  async ({ price, equivalent }) => {
    const root = await mkdtemp(join(tmpdir(), 'curation-skill-'));
    temporary.push(root);
    await cp(resolve('tests/fixtures/curation'), root, { recursive: true });
    const paths = {
      systemPath: join(root, 'pf1'),
      contentPath: join(root, 'pf1-content'),
      remaps: [],
    };
    const file = join(
      paths.contentPath,
      'src/pf-special-qualities/Shadow.yaml',
    );
    const original = JSON.parse(await readFile(file, 'utf8'));
    original.system.description.value = `<p>This armor grants a +5 competence bonus on Climb checks.</p>${price}`;
    await writeFile(file, JSON.stringify(original));
    const draft = await draftCatalogCuration(paths);
    const artifact = await importCatalog({ ...paths, curation: draft });
    const entry = artifact.catalog.entries.find(
      (value) => value.externalKey === 'pf1-content/Shadow',
    );
    expect(entry?.modifiers).toEqual([
      { target: 'skill.clm', bonusType: 'competence', value: 5 },
    ]);
    expect(entry?.detail).toMatchObject(
      equivalent === undefined ? {} : { bonusEquivalent: equivalent },
    );
    if (equivalent === undefined)
      expect(entry?.detail).not.toHaveProperty('bonusEquivalent');
    expect(entry?.situationalNotes ?? []).toEqual([]);
  },
);

it('retains hit and critical dice from separate helper seeds sharing an Item Ability name', async () => {
  const root = await mkdtemp(join(tmpdir(), 'curation-merge-dice-'));
  temporary.push(root);
  await cp(resolve('tests/fixtures/curation'), root, { recursive: true });
  const paths = {
    systemPath: join(root, 'pf1'),
    contentPath: join(root, 'pf1-content'),
    remaps: [],
  };
  const helper = join(
    paths.contentPath,
    'src/pf-special-qualities/_Weapon_Enchant_Conditional_Modifiers_upTvrmZoeKq2LI0F.yaml',
  );
  const { parse, stringify } = await import('yaml');
  const record = parse(await readFile(helper, 'utf8'));
  record.system.actions[0].conditionals.push({
    _id: 'extraFlaming',
    name: 'Flaming',
    modifiers: [
      {
        target: 'damage',
        subTarget: 'allDamage',
        critical: 'crit',
        formula: '1d10',
        damageType: ['fire'],
      },
    ],
  });
  await writeFile(helper, stringify(record));
  const draft = await draftCatalogCuration(paths);
  const artifact = await importCatalog({ ...paths, curation: draft });
  expect(
    artifact.catalog.entries.find(
      (entry) => entry.externalKey === 'pf1-content/Flaming',
    )?.detail,
  ).toMatchObject({
    bonusEquivalent: 1,
    damageDice: [
      { on: 'hit', dice: '1d6', damageType: 'fire' },
      { on: 'crit', dice: '1d10', damageType: 'fire' },
    ],
  });
});

it('holds conditional Item Ability skill prose instead of applying an unconditional bonus', async () => {
  const root = await mkdtemp(join(tmpdir(), 'curation-conditional-skill-'));
  temporary.push(root);
  await cp(resolve('tests/fixtures/curation'), root, { recursive: true });
  const paths = {
    systemPath: join(root, 'pf1'),
    contentPath: join(root, 'pf1-content'),
    remaps: [],
  };
  const file = join(paths.contentPath, 'src/pf-special-qualities/Shadow.yaml');
  const original = JSON.parse(await readFile(file, 'utf8'));
  original.system.description.value =
    '<p>This armor only while swimming grants a +5 competence bonus on Stealth checks.</p><p>Price +3,750 gp</p>';
  await writeFile(file, JSON.stringify(original));
  const draft = await draftCatalogCuration(paths);
  const artifact = await importCatalog({ ...paths, curation: draft });
  expect(
    artifact.catalog.entries.find(
      (entry) => entry.externalKey === 'pf1-content/Shadow',
    )?.modifiers,
  ).toEqual([]);
  expect(artifact.curation.unresolvedMechanics).toContainEqual(
    expect.objectContaining({ externalKey: 'pf1-content/Shadow' }),
  );
});

it('sanitizes checked operator notes to readable plain text at application time', async () => {
  const input = await fixture({
    contextNotes: [{ target: 'will', text: 'Immune to sleep' }],
  });
  const draft = await draftCatalogCuration(input);
  const record = draft.records[0];
  if (!record) throw new Error('Fixture record missing');
  const checked: CurationRecord = {
    ...record,
    status: 'checked',
    reviewedBy: 'Fixture reviewer',
    reviewedOn: '2026-10-03',
    outputs: [
      {
        kind: 'note',
        target: 'save.will',
        text: '<p>Immune to <strong>sleep</strong> &amp; fatigue.<script>bad</script></p><p>May reroll.</p>',
      },
    ],
  };
  const artifact = await importCatalog({
    ...input,
    curation: { records: [checked] },
  });
  expect(artifact.catalog.entries[0]?.situationalNotes).toEqual([
    { target: 'save.will', text: 'Immune to sleep & fatigue.\nMay reroll.' },
  ]);
});

it('recognizes covered dice across prose variants and keeps the remaining nonnumeric rules', async () => {
  const root = await mkdtemp(join(tmpdir(), 'curation-dice-prose-'));
  temporary.push(root);
  await cp(resolve('tests/fixtures/curation'), root, { recursive: true });
  const paths = {
    systemPath: join(root, 'pf1'),
    contentPath: join(root, 'pf1-content'),
    remaps: [],
  };
  const file = join(paths.contentPath, 'src/pf-special-qualities/Flaming.yaml');
  const original = JSON.parse(await readFile(file, 'utf8'));
  original.system.description.value =
    '<p>A blazing weapon deals an extra 1d6 points of fire damage on a successful hit. The fire does not harm the wielder. It remains until commanded to cease.</p><p>Price +1 bonus</p>';
  await writeFile(file, JSON.stringify(original));
  const draft = await draftCatalogCuration(paths);
  const artifact = await importCatalog({ ...paths, curation: draft });
  expect(
    artifact.catalog.entries.find(
      (entry) => entry.externalKey === 'pf1-content/Flaming',
    )?.situationalNotes,
  ).toEqual([
    {
      text: 'The fire does not harm the wielder.\nIt remains until commanded to cease.',
    },
  ]);
});

it.each([
  'This ability does not double the threat range of a weapon.',
  'This ability doubles the threat range of a weapon when raging.',
])(
  'holds ambiguous threat mechanics for review without applying an unconditional expansion: %s',
  async (text) => {
    const root = await mkdtemp(join(tmpdir(), 'curation-threat-'));
    temporary.push(root);
    await cp(resolve('tests/fixtures/curation'), root, { recursive: true });
    const paths = {
      systemPath: join(root, 'pf1'),
      contentPath: join(root, 'pf1-content'),
      remaps: [],
    };
    const file = join(paths.contentPath, 'src/pf-special-qualities/Keen.yaml');
    const original = JSON.parse(await readFile(file, 'utf8'));
    original.system.description.value = `<p>${text}</p><p>Price +1 bonus</p>`;
    await writeFile(file, JSON.stringify(original));
    const draft = await draftCatalogCuration(paths);
    const candidate = draft.records.find(
      (record) => record.externalKey === 'pf1-content/Keen',
    );
    expect(candidate?.outputs).not.toContainEqual(
      expect.objectContaining({ doublesThreat: true }),
    );
    expect(candidate?.diagnostics).toContainEqual(
      expect.objectContaining({ kind: 'review' }),
    );
    const artifact = await importCatalog({ ...paths, curation: draft });
    expect(artifact.curation).toMatchObject({
      passed: false,
      unresolvedMechanics: [
        expect.objectContaining({ externalKey: 'pf1-content/Keen' }),
      ],
    });
    const entry = artifact.catalog.entries.find(
      (value) => value.externalKey === 'pf1-content/Keen',
    );
    expect(entry?.detail).not.toHaveProperty('doublesThreat');
    expect(entry?.detail).not.toHaveProperty('bonusEquivalent');
  },
);

it('requires unresolved action Notes to be edited before checking instead of publishing raw mechanics', async () => {
  const input = await fixture({
    actions: [
      {
        _id: 'action',
        conditionals: [
          {
            _id: 'conditional',
            name: 'Against a chosen foe',
            modifiers: [
              {
                target: 'unsupported',
                subTarget: 'custom',
                type: 'enh',
                formula: '@resources.rage',
              },
            ],
          },
        ],
      },
    ],
  });
  const draft = await draftCatalogCuration(input);
  const record = draft.records[0];
  if (!record) throw new Error('Fixture record missing');
  expect(record.outputs).toEqual([
    {
      kind: 'note',
      text: 'Review required: replace this placeholder with readable rules text or structured outputs.',
    },
  ]);
  const checked = {
    ...record,
    status: 'checked',
    reviewedBy: 'Fixture reviewer',
    reviewedOn: '2026-10-03',
  };
  await expect(
    importCatalog({ ...input, curation: { records: [checked] } }),
  ).rejects.toThrow(/placeholder/i);
  const artifact = await importCatalog({
    ...input,
    curation: {
      records: [
        {
          ...checked,
          diagnostics: [],
          outputs: [
            { kind: 'note', text: 'May reroll attacks against a chosen foe.' },
          ],
        },
      ],
    },
  });
  expect(artifact.catalog.entries[0]?.situationalNotes).toEqual([
    { text: 'May reroll attacks against a chosen foe.' },
  ]);
  expect(artifact.curation.passed).toBe(true);
});

it('holds unparsed numeric Notes as placeholders and rejects unchanged placeholder text after review', async () => {
  const input = await fixture({
    contextNotes: [{ target: 'will', text: 'Unparsed +[[2]] bonus vs poison' }],
  });
  const draft = await draftCatalogCuration(input);
  const record = draft.records[0];
  if (!record) throw new Error('Fixture record missing');
  expect(record.outputs).toEqual([
    {
      kind: 'note',
      target: 'save.will',
      situation: { local: 'poison' },
      text: 'Review required: replace this placeholder with readable rules text or structured outputs.',
    },
  ]);
  const checked = {
    ...record,
    status: 'checked',
    reviewedBy: 'Fixture reviewer',
    reviewedOn: '2026-10-03',
    outputs: [
      {
        kind: 'note',
        text: 'Review required: replace this placeholder with readable rules text or structured outputs.',
      },
    ],
  };
  await expect(
    importCatalog({ ...input, curation: { records: [checked] } }),
  ).rejects.toThrow(/placeholder/i);
});

it('records offline rules citations for reviewed Item Ability policies while preserving haste equivalence and target-dependent holds', async () => {
  const root = await mkdtemp(join(tmpdir(), 'curation-policies-'));
  temporary.push(root);
  await cp(resolve('tests/fixtures/curation'), root, { recursive: true });
  const paths = {
    systemPath: join(root, 'pf1'),
    contentPath: join(root, 'pf1-content'),
    remaps: [],
  };
  const policies = [
    { name: 'Speed', id: 'Speed', source: 'PZO1123 p. 148' },
    { name: 'Bane', id: 'Bane', source: 'PZO1123 p. 136' },
    { name: 'Holy', id: 'Holy', source: 'PZO1123 p. 143' },
    { name: 'Unholy', id: 'Unholy', source: 'PZO1123 p. 149' },
    { name: 'Axiomatic', id: 'Axiomatic', source: 'PZO1123 p. 136' },
    { name: 'Anarchic', id: 'Anarchic', source: 'PZO1123 p. 135' },
    { name: 'Blood-Hunting', id: 'BloodHunting', source: 'PZO1129 p. 212' },
    { name: 'Breaking', id: 'Breaking', source: 'PZO9430 p. 28' },
    { name: 'Disruption', id: 'Disruption', source: 'PZO1123 p. 140' },
  ];
  for (const { name, id } of policies)
    await writeFile(
      join(paths.contentPath, `src/pf-special-qualities/${id}.yaml`),
      JSON.stringify({
        _id: id,
        _key: `!items!${id}`,
        name,
        type: 'feat',
        system: { description: { value: '<p>Price +1 bonus</p>' } },
      }),
    );
  const helper = join(
    paths.contentPath,
    'src/pf-special-qualities/_Weapon_Enchant_Conditional_Modifiers_upTvrmZoeKq2LI0F.yaml',
  );
  const { parse, stringify } = await import('yaml');
  const record = parse(await readFile(helper, 'utf8'));
  record.system.actions[0].conditionals.push({
    _id: 'disruptionSeed',
    name: 'Disruption',
    modifiers: [
      {
        target: 'damage',
        subTarget: 'allDamage',
        formula: '1d6',
        damageType: ['untyped'],
      },
    ],
  });
  await writeFile(helper, stringify(record));
  const draft = await draftCatalogCuration(paths);
  const artifact = await importCatalog({ ...paths, curation: draft });
  for (const { name, id, source } of policies) {
    const candidate = draft.records.find(
      (value) => value.externalKey === `pf1-content/${id}`,
    );
    expect(candidate?.rationale).toContain(source);
    expect(candidate?.rationale).toContain(
      'pf1-content 11.4.0 src/pf-special-qualities/',
    );
    const entry = artifact.catalog.entries.find(
      (value) => value.externalKey === `pf1-content/${id}`,
    );
    if (name === 'Speed') expect(entry?.sourceKey).toBe('haste');
    else {
      expect(candidate?.diagnostics).toContainEqual(
        expect.objectContaining({
          kind: 'unresolved',
          text: expect.stringContaining('target-dependent'),
        }),
      );
      expect(entry?.detail).not.toHaveProperty('damageDice');
      expect(entry?.modifiers).toEqual([]);
    }
  }
});

it('counts required gate records separately from drafted and checked prose-pass records', async () => {
  const curation = JSON.parse(
    await readFile(
      resolve('tests/fixtures/curation/expected/reviewed-records.json'),
      'utf8',
    ),
  );
  const artifact = await importCatalog({ ...bounded, curation });
  expect(artifact.curation.summary).toEqual({
    required: 10,
    drafted: 8,
    checked: 2,
    missing: 0,
    descriptions: { candidates: 1, drafted: 1, checked: 0 },
  });
  const proseChecked = {
    ...curation,
    records: curation.records.map((record: CurationRecord) =>
      record.kind === 'description'
        ? {
            ...record,
            status: 'checked',
            reviewedBy: 'Fixture reviewer',
            reviewedOn: '2026-10-03',
          }
        : record,
    ),
  };
  expect(
    (await importCatalog({ ...bounded, curation: proseChecked })).curation
      .summary,
  ).toEqual({
    required: 10,
    drafted: 8,
    checked: 2,
    missing: 0,
    descriptions: { candidates: 1, drafted: 0, checked: 1 },
  });
});

it('keeps unresolved Item Ability inline-roll mechanics held while preparing readable Note text', async () => {
  const root = await mkdtemp(join(tmpdir(), 'curation-ability-inline-'));
  temporary.push(root);
  await cp(resolve('tests/fixtures/curation'), root, { recursive: true });
  const paths = {
    systemPath: join(root, 'pf1'),
    contentPath: join(root, 'pf1-content'),
    remaps: [],
  };
  const file = join(paths.contentPath, 'src/pf-special-qualities/Shadow.yaml');
  const original = JSON.parse(await readFile(file, 'utf8'));
  original.system.description.value =
    '<p>Grants [[@resources.rage]] protection against fear.</p><p>Price +1 bonus</p>';
  await writeFile(file, JSON.stringify(original));
  const draft = await draftCatalogCuration(paths);
  const artifact = await importCatalog({ ...paths, curation: draft });
  expect(artifact.curation.unresolvedMechanics).toContainEqual(
    expect.objectContaining({ externalKey: 'pf1-content/Shadow' }),
  );
  expect(
    artifact.catalog.entries.find(
      (entry) => entry.externalKey === 'pf1-content/Shadow',
    )?.situationalNotes ?? [],
  ).toEqual([]);
});

it('rejects checking a review placeholder wrapped in HTML because its visible text is still unchanged', async () => {
  const input = await fixture({
    contextNotes: [{ target: 'will', text: 'Unparsed +[[2]] bonus vs poison' }],
  });
  const draft = await draftCatalogCuration(input);
  const record = draft.records[0];
  if (!record) throw new Error('Fixture record missing');
  await expect(
    importCatalog({
      ...input,
      curation: {
        records: [
          {
            ...record,
            status: 'checked',
            reviewedBy: 'Fixture reviewer',
            reviewedOn: '2026-10-03',
            diagnostics: [],
            outputs: [
              {
                kind: 'note',
                text: '<p>Review required: replace this placeholder with readable rules text or structured outputs.</p>',
              },
            ],
          },
        ],
      },
    }),
  ).rejects.toThrow(/placeholder/i);
});
