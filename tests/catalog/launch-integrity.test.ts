// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { launchManifestCopies } from './launch-manifest';
import { inspectLaunchInventory } from '../../scripts/catalog/launch-inventory';

const document: unknown = JSON.parse(
  await readFile(
    new URL(
      '../../scripts/catalog/scopes/campaign-mvp-v1.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const freshManifest = launchManifestCopies(document);
const resources = [
  'builtin:casting-tables',
  'builtin:representative-class-catalog',
  'builtin:representative-selection-catalog',
  'builtin:representative-archetype-catalog',
  'builtin:representative-spellcasting-catalog',
  'builtin:representative-race-catalog',
  'companion-progression-rules',
  'section15-registry',
  'legal-resources',
];

describe('launch governing resource integrity', () => {
  it.each(resources)(
    'rejects omission of %s together with every incident edge',
    (name) => {
      const value = freshManifest();
      const key = `resource/${name}`;
      value.rows = value.rows.filter((row) => row.key !== key);
      value.edges = value.edges.filter(
        (edge) => edge.from !== key && edge.to !== key,
      );
      const report = inspectLaunchInventory(value);
      expect(report.genericComplete).toBe(false);
      expect(report.inventoryErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'resource-required',
            key,
            owner: expect.objectContaining({ issue: 770 }),
          }),
        ]),
      );
    },
  );
});

describe('launch printed checkpoint integrity', () => {
  it.each([
    'altered hash',
    'changed column',
    'nonexistent scheduled key',
    'wrong receiving class',
    'missing source binding',
  ])('rejects %s even when observed bindings are supplied', (change) => {
    const value = freshManifest();
    const checkpoint = value.checkpoints.find(
      (entry) => entry.className === 'Barbarian' && entry.level === 17,
    );
    if (!checkpoint) throw new Error('Pinned Barbarian level 17 is missing.');
    if (change === 'altered hash') checkpoint.source.rawSha256 = '0'.repeat(64);
    if (change === 'changed column')
      checkpoint.sourceColumns['column-1'] = '+1';
    if (change === 'nonexistent scheduled key')
      checkpoint.scheduledKeys.push('pf1/0000000000000000');
    if (change === 'wrong receiving class') {
      const wizard = value.checkpoints.find(
        (entry) => entry.className === 'Wizard' && entry.level === 1,
      );
      if (!wizard) throw new Error('Pinned Wizard checkpoint is missing.');
      checkpoint.scheduledKeys = [...wizard.scheduledKeys];
    }
    if (change === 'missing source binding') {
      const row = value.rows.find((entry) => entry.key === checkpoint.classKey);
      if (!row) throw new Error('Pinned Barbarian class is missing.');
      row.sources = row.sources.filter((source) => source.repository !== 'prd');
    }
    const report = inspectLaunchInventory(value, {
      bindings: [
        ...value.rows.flatMap((row) => row.sources),
        ...value.checkpoints.map((entry) => entry.source),
      ],
    });
    expect(report.inventoryErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: expect.stringMatching(/^checkpoint-/),
          key: `${checkpoint.classKey}:17`,
        }),
      ]),
    );
    expect(report.genericComplete).toBe(false);
  });
});

describe('settled Witch collection contract', () => {
  it('rejects the destructive W3 effective requirement through public inspection', () => {
    const value = freshManifest();
    const id = 'rule/advanced/finding/W3';
    const contract = value.semanticContracts.find((entry) => entry.id === id);
    const row = value.rows.find((entry) => entry.key === id);
    if (!contract || !row?.mechanisms[0])
      throw new Error('Missing pinned W3 contract.');
    const destructive =
      "All Witch familiar storage/learning/replacement and familiar→master conditions in `cross-worker-contracts.json` remain required, even though species partition is separate. Cauldron grants Brew Potion and Craft(alchemy)+4; Cackle's list of extendable hexes is a conditional interaction, not a prerequisite forcing every witch to learn Agony/etc. Downstream acceptance: **#771**, companion **#763/#707**, original hex batches. Test Witch replacement at level5 knows allcantrips+two of each castable level+patron bonus spells; ordinary learned spells lost with the old familiar are not silently copied wholesale.";
    contract.contract = destructive;
    row.mechanisms[0].contract = destructive;
    expect(inspectLaunchInventory(value).inventoryErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'advanced-contract', key: id }),
      ]),
    );
  });
  it('accepts the unchanged Witch-owned collection while retaining nonoperative printed comparison', () => {
    const value = freshManifest();
    const replacement = value.semanticContracts.find(
      (entry) => entry.id === 'rule/advanced/paragraph/594',
    );
    expect(replacement?.contract).toContain(
      'Printed comparison (nonoperative starting allowance)',
    );
    expect(replacement?.contract).toContain(
      'one complete, unchanged Witch-owned spell collection',
    );
    expect(replacement?.qualification).toBe('product policy');
    expect(replacement?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          repository: 'everythingpath',
          locator: 'docs/character-sheet/companions.md',
        }),
        expect.objectContaining({
          repository: 'prd',
          locator: 'pages/advancedPlayersGuide/baseClasses/witch.html:486',
        }),
      ]),
    );
    expect(inspectLaunchInventory(value).genericComplete).toBe(true);
  });
});

it.each(['source binding', 'ownership', 'incoming path', 'coverage reference'])(
  'rejects changed governing resource %s independently of observed bindings',
  (change) => {
    const value = freshManifest();
    const key = 'resource/builtin:casting-tables';
    const row = value.rows.find((entry) => entry.key === key);
    if (!row?.sources[0]) throw new Error('Missing required casting resource.');
    if (change === 'source binding') row.sources[0].rawSha256 = '0'.repeat(64);
    if (change === 'ownership') row.implementationOwner.issue = 716;
    if (change === 'incoming path')
      value.edges = value.edges.filter((edge) => edge.to !== key);
    if (change === 'coverage reference') {
      for (const coverage of value.coverage)
        coverage.keys = coverage.keys.filter((entry) => entry !== key);
    }
    expect(
      inspectLaunchInventory(value, {
        bindings: [
          ...value.rows.flatMap((row) => row.sources),
          ...value.checkpoints.map((entry) => entry.source),
        ],
      }).inventoryErrors,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: expect.stringMatching(/^resource-/),
          key,
        }),
      ]),
    );
  },
);

it('retains the reviewed Tireless Rage correction and reviews every class schedule', () => {
  const value = freshManifest();
  const barbarian = value.checkpoints.filter(
    (entry) => entry.className === 'Barbarian',
  );
  const at17 = barbarian.find((entry) => entry.level === 17);
  const tireless = value.rows.find(
    (row) => row.key === 'pf1/aYdjgDZJCNvKpLQP' && row.name === 'Tireless Rage',
  );
  expect(tireless?.key).toBeDefined();
  expect(at17?.scheduledKeys).toContain(tireless?.key);
  expect(
    barbarian.find((entry) => entry.level === 16)?.scheduledKeys,
  ).not.toContain(tireless?.key);
  expect(
    new Set(
      value.checkpoints
        .filter((entry) => entry.scheduleStatus === 'outstanding schedule')
        .map((entry) => entry.className),
    ),
  ).toEqual(new Set());
  // #771B reviews the last two (Oracle, Witch): every printed level of all
  // 21 classes is a reviewed schedule's.
  expect(
    value.checkpoints.filter(
      (entry) => entry.scheduleStatus === 'reviewed schedule',
    ),
  ).toHaveLength(420);
});

it.each([
  [
    'rule/advanced/interface/2',
    'Wizard familiar base + APG6 new choices. Stack entitled classes; use Witch rules where mixed. Store Witch spells only; all cantrips +3 first-level+Int, then2/level; patron spells additional. Replacement after1day,500gp/Witchlevel,8h; allcantrips+2/eligible spelllevel+bonus patron spells. Deliver touch spells/hexes at3. Teaching and destroyed scroll Spellcraft15+spell level. Public proof: Wizard/Witch shared familiar receives one stacked master progression; familiar stores only Witch spells; replacement retains patron bonuses.',
  ],
  [
    'rule/advanced/paragraph/594',
    "If a familiar is lost or dies, it can be replaced 1 day later through a special ritual that costs 500 gp per witch level. The ritual takes 8 hours to complete. A new familiar begins knowing all of the 0-level spells plus two spells of every level the witch is able to cast. These are in addition to any bonus spells known by the familiar based on the witch's level and her patron (see patron spells).",
  ],
])(
  'rejects the printed replacement allowance as the effective %s contract',
  (id, printed) => {
    const value = freshManifest();
    const contract = value.semanticContracts.find((entry) => entry.id === id);
    const row = value.rows.find((entry) => entry.key === id);
    if (!contract || !row?.mechanisms[0])
      throw new Error('Missing Witch replacement contract.');
    contract.contract = printed;
    row.mechanisms[0].contract = printed;
    expect(inspectLaunchInventory(value).inventoryErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'advanced-contract', key: id }),
      ]),
    );
  },
);
