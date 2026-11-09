/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { z } from 'zod';
import { beforeAll, expect, test } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { candidateDefinition } from '../../convex/lib/catalogCandidateDefinition';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';
import { withSheetCatalog } from '../character-sheet-catalog';
import {
  activationArgs,
  discover,
  prepare,
  reconcile,
  releaseFixture,
  type ReleaseTest,
} from '../catalog-release-fixture';
import {
  canonicalReleaseJson,
  type ReleaseJson,
} from '../../src/lib/catalog/release-schema';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import type { PreviewEntry } from '../../scripts/catalog/map';
import { baseline } from './weapon-baseline';
import { readPinned } from './pinned-sources';

const modules = import.meta.glob('../../convex/**/*.ts');
const LONGSWORD = 'pf1/zWRlna42PMJVX6un';
const DAGGER = 'pf1/fOSuWwRSZLTrROch';
const JAVELIN = 'pf1/KmbhZ4Z674Yk9yIh';
const SHORTBOW = 'pf1/Ata6ajiY9wuAnBLB';
const COMPOSITE = 'pf1/msTiRxZVnecbPCA8';
const CROSSBOW = 'pf1/RWbjRwSPsuPAUDhw';
const SLING = 'pf1/cJV7OBm9KiF2WWiu';
const ARROW = 'pf1/23HXFjpPnuLFOylm';
const BOLT = 'pf1/v04yeRzoqrhYx0G7';
const FROST = 'pf1/TXd09UXUUNBWPk4Q';
const GREATSWORD = 'pf1/oyUApQSVsAqzyjdz';
const PRONGED = 'pf1/3sWj5S5ukzxl8oxK';
const preserved = [
  'two-bladed-sword.4nFjnETINUoBFWKX',
  'quarterstaff.6eAg4BT0RM8tfyUN',
  'orc-double-axe.PmiF2bF8uhzghtuz',
  'dire-flail.RY3sfrMSDs0OGLAH',
  'gnome-hooked-hammer.VM6EF0t88wdSMQDd',
  'chain-spear.aQRocmXzAwvZkBEZ',
  'dwarven-urgrosh.aji2yHRoqFAHHfm6',
  'heavy-ballista.KOXje9UR6yAX0Z4i',
  'plague-bundle-siege.6S3DVUP2kyWPREt0',
];
const fallbackSources = [
  'items/ghast-retch-flask.2PN3qewFLwGkAfIv',
  'weapons-and-ammo/gas-cylinder.8ZULFlFHvgrLZn3N',
  'items/thunderstone.akgicrcsuznrhvkk',
  'items/tanglefoot-bag.utncinnlwzscpzbd',
  'weapons-and-ammo/gargantuan-siege-tower.azCXfad0MVjPrRlm',
  'weapons-and-ammo/m1917-chemical-grenade.ePbnk98skXUyRdDY',
];
const angelfallFile = 'src/pf-magic-items/Angelfall_Bow_zaEFBVAIFds18oVh.yaml';
const angelfallSha256 =
  'd6a6a5ec5c6c1a52e05721bdaba9094a3e0d3e1c266de582883ca4276caf4ee3';
const sourceInventorySchema = z.object({
  candidates: z.array(
    z.object({
      source: z.object({
        repo: z.literal('pf1'),
        path: z.string(),
        sha256: z.string(),
      }),
    }),
  ),
});
const weaponSourceBindings = [425, 426, 427, 428, 429].flatMap((batch) => {
  const raw: unknown = JSON.parse(
    readFileSync(
      new URL(
        `../../scripts/catalog/legal/weapons-and-ammo-${batch}.json`,
        import.meta.url,
      ),
      'utf8',
    ),
  );
  return sourceInventorySchema.parse(raw).candidates.map((row) => row.source);
});
const laserPistolFile = 'packs/technology/laser-pistol.Cv5xR3jr618ojBYm.yaml';
const launcherCases = [
  [
    'pf1/RRh1u2ccgLv1ynu8',
    'packs/weapons-and-ammo/pistol.RRh1u2ccgLv1ynu8.yaml',
    '    capacity: 1',
  ],
  [
    'pf1/t5h6nBc1BuN8Eh5d',
    'packs/weapons-and-ammo/gastraphetes.t5h6nBc1BuN8Eh5d.yaml',
    'Reloading takes a full-round action',
  ],
  [
    'pf1/cy4pO52j4iAedcHZ',
    'packs/weapons-and-ammo/stonebow.cy4pO52j4iAedcHZ.yaml',
    'Loading a stonebow is a move action',
  ],
  [
    'pf1/rXxv6Q9b6Px3qhFE',
    'packs/weapons-and-ammo/tube-arrow-shooter.rXxv6Q9b6Px3qhFE.yaml',
    'Reloading a tube is a full-round action',
  ],
  [
    'pf1/eD48G3YnHyBYB3LC',
    'packs/weapons-and-ammo/heavy-wrist-launcher.eD48G3YnHyBYB3LC.yaml',
    'crossbow bolt instead of a featherweight dart',
  ],
  [
    'pf1/n0vno5RNBzsHvH33',
    'packs/weapons-and-ammo/brutal-bola.n0vno5RNBzsHvH33.yaml',
    'These bolas function as standard',
  ],
  [
    'pf1/Cv5xR3jr618ojBYm',
    laserPistolFile,
    '1 charge; <strong>Special</strong> Semi-automatic',
  ],
] as const;
let entries: PreviewEntry[];

beforeAll(async () => {
  const { materializePinnedTree } = await import('./pinned-sources');
  const { importCatalog } = await import('../../scripts/catalog/import');
  const { default: remaps } =
    await import('../../scripts/catalog/reviewed-remaps.json');
  const { reviewedCuration } =
    await import('../../scripts/catalog/reviewed-curation-data');
  const files = [
    ...new Set([
      ...weaponSourceBindings.map((row) => `${row.repo}/${row.path}`),
      `pf1/${laserPistolFile}`,
      ...baseline.map((row) => `pf1/${row.source}`),
      ...fallbackSources.map((source) => `pf1/packs/${source}.yaml`),
      'pf1/packs/weapons-and-ammo/horse-bow.lNkiFRCBELwKFaTg.yaml',
      'pf1/packs/weapons-and-ammo/orc-hornbow.2GcN9zdtzr0YbLve.yaml',
      'pf1/packs/weapons-and-ammo/pronged-arrow.3sWj5S5ukzxl8oxK.yaml',
      'pf1/packs/weapons-and-ammo/pistol.RRh1u2ccgLv1ynu8.yaml',
      ...preserved.map((name) => `pf1/packs/weapons-and-ammo/${name}.yaml`),
      `pf1-content/${angelfallFile}`,
    ]),
  ];
  const tree = await materializePinnedTree(files, {
    sha256: Object.fromEntries([
      ...weaponSourceBindings.map((row) => [
        `${row.repo}/${row.path}`,
        row.sha256,
      ]),
      ...baseline.map((row) => [`pf1/${row.source}`, row.sha256]),
      [
        `pf1/${laserPistolFile}`,
        '4ead7274b89be36da2d8de7eb02067d1b37524ecac889bf5f623c67c473ad0c4',
      ],
      [`pf1-content/${angelfallFile}`, angelfallSha256],
    ]),
  });
  try {
    entries = (
      await importCatalog({ ...tree, remaps, curation: reviewedCuration })
    ).catalog.entries;
  } finally {
    await tree.dispose();
  }
});

function payload(key: string) {
  const row = entries.find((row) => row.externalKey === key);
  if (!row) throw new Error(`Missing fresh import ${key}`);
  return row;
}
const releasePayload = (entry: unknown) =>
  JSON.parse(JSON.stringify(entry)) as ReleaseJson;
function install(t: ReleaseTest, key: string) {
  return t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: key,
      ruleIdentity: key,
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'item', consumable: false },
    }),
  );
}
async function candidate(
  t: ReleaseTest,
  id: Id<'catalogEntry'>,
  releaseNumber = 1,
) {
  return t.run(async (ctx) => {
    const release = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) =>
        q.eq('releaseNumber', releaseNumber),
      )
      .unique();
    const stored = await ctx.db.get('catalogEntry', id);
    if (!release || !stored) throw new Error('Missing release or definition');
    return candidateDefinition(ctx, release, stored);
  });
}

// Each expected shape is an independent native/PCGen transcription, not an
// adapter passed to the release or sheet. All payloads come from importCatalog.
test('all 101 selected imports retain source expectations; supported profiles cross the release and public saved-sheet boundary', async () => {
  expect(baseline).toHaveLength(101);
  const supported = baseline.filter((row) => !row.candidateRefusal);
  const { t, owner, outsider, scope } = await releaseFixture(modules);
  const ids = new Map<string, Id<'catalogEntry'>>();
  for (const row of supported) {
    const id = await install(t, row.key);
    ids.set(row.key, id);
    await t.run((ctx) =>
      ctx.db.insert('characterSheetEntry', {
        characterId: scope.characterId,
        catalogEntryId: id,
        kind: 'item',
        active: true,
        state: { kind: 'item' },
      }),
    );
  }
  await prepare(
    t,
    supported.map((row) => ({
      kind: 'definition',
      key: row.key,
      payload: releasePayload(payload(row.key)),
    })),
  );
  for (const row of baseline) {
    expect(payload(row.key).detail, row.key).toMatchObject(row.expected);
    for (const field of [
      'dice',
      'threat',
      'mult',
      'reload',
      'strengthDamage',
      'strengthRating',
      'rangeIncrement',
      'thrownRangeIncrement',
    ])
      if (row.expected.weapon && !Object.hasOwn(row.expected.weapon, field))
        expect(payload(row.key).detail, row.key).not.toHaveProperty(
          `weapon.${field}`,
        );
    if (row.candidateRefusal) continue;
    expect(
      (await candidate(t, ids.get(row.key)!)).detail,
      row.key,
    ).toMatchObject(row.expected);
  }
  const runId = await reconcile(t, scope.characterId);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(runId),
  );
  for (let reload = 0; reload < 2; reload++) {
    const saved = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    for (const row of supported) {
      const detail = saved?.catalogEntries.find(
        (entry) => entry._id === ids.get(row.key),
      )?.detail;
      expect(detail, row.key).toMatchObject(row.expected);
      for (const field of [
        'dice',
        'threat',
        'mult',
        'reload',
        'strengthDamage',
        'strengthRating',
        'rangeIncrement',
        'thrownRangeIncrement',
      ])
        if (row.expected.weapon && !Object.hasOwn(row.expected.weapon, field))
          expect(detail, row.key).not.toHaveProperty(`weapon.${field}`);
      if ('weapon' in row.expected)
        expect(detail).not.toHaveProperty('ammunition');
    }
    expect(
      saved?.catalogEntries.find((row) => row._id === ids.get(FROST))?.detail,
    ).toMatchObject({
      baseItem: ids.get(GREATSWORD),
      magic: { enhancement: 3, masterwork: true },
    });
  }
  await expect(outsider.query(api.characterSheet.read, scope)).rejects.toThrow(
    'You do not have access to this org',
  );
  await expect(
    outsider.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: ids.get(LONGSWORD)!,
      operationId: 'outsider',
    }),
  ).rejects.toThrow('You do not have access to this org');
});

test('published weapon routines retain Strength, thrown ranges, reload and inherited Frost Brand statistics after save and reload', async () => {
  const { t, owner, outsider, scope } = await releaseFixture(modules);
  const keys = [
    LONGSWORD,
    DAGGER,
    JAVELIN,
    SHORTBOW,
    COMPOSITE,
    CROSSBOW,
    SLING,
    ARROW,
    BOLT,
    FROST,
    GREATSWORD,
    'pf1/lNkiFRCBELwKFaTg',
    'pf1/2GcN9zdtzr0YbLve',
  ];
  const ids = new Map<string, Id<'catalogEntry'>>();
  for (const key of keys) ids.set(key, await install(t, key));
  // One carried item makes this Character part of the release impact run.
  await t.run((ctx) =>
    ctx.db.insert('characterSheetEntry', {
      characterId: scope.characterId,
      catalogEntryId: ids.get(ARROW)!,
      kind: 'item',
      active: true,
      state: { kind: 'item' },
    }),
  );
  await prepare(
    t,
    keys.map((key) => ({
      kind: 'definition',
      key,
      payload: releasePayload(payload(key)),
    })),
  );
  const runId = await reconcile(t, scope.characterId);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(runId),
  );
  for (const category of ['simple', 'martial'] as const)
    await owner.mutation(api.characterSheet.setManualProficiency, {
      ...scope,
      proficiency: { category },
      disposition: 'added',
      operationId: `proficiency-${category}`,
    });
  for (const baseType of ['Longbow', 'Orc Hornbow'])
    await owner.mutation(api.characterSheet.setManualProficiency, {
      ...scope,
      proficiency: { baseType },
      disposition: 'added',
      operationId: `proficiency-${baseType}`,
    });
  const itemIds = new Map<string, Id<'characterSheetEntry'>>();
  for (const key of keys.filter((key) => key !== ARROW && key !== GREATSWORD))
    itemIds.set(
      key,
      await owner.mutation(api.characterSheet.selectEntry, {
        ...scope,
        catalogEntryId: ids.get(key)!,
        operationId: `carry-${key}`,
      }),
    );
  const read = async () => {
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!sheet) throw new Error('Missing saved sheet');
    return sheet;
  };
  const routine = (sheet: Awaited<ReturnType<typeof read>>, key: string) => {
    const row = sheet.calculated.attackRoutines.find(
      (row) => row.name === payload(key).name,
    );
    if (!row) throw new Error(`Missing routine ${key}`);
    return row;
  };
  for (const [strength, bowDamage, compositeDamage, slingDamage] of [
    [8, -1, -1, -1],
    [18, 0, 0, 4],
  ]) {
    await owner.mutation(api.characterSheet.editBaseScores, {
      ...scope,
      scores: { strength },
      operationId: `strength-${strength}`,
    });
    const saved = await read();
    expect(routine(saved, LONGSWORD).single[0]?.damageDice).toBe('1d8');
    expect(routine(saved, LONGSWORD).single[0]?.criticalThreat.total).toBe(19);
    expect(routine(saved, LONGSWORD).single[0]?.criticalMultiplier.total).toBe(
      2,
    );
    expect(routine(saved, SHORTBOW).single[0]?.attackBonus.total).toBe(0);
    expect(routine(saved, COMPOSITE).single[0]?.attackBonus.total).toBe(
      strength === 8 ? -2 : 0,
    );
    for (const [key, feet] of [
      [SHORTBOW, 60],
      [COMPOSITE, 110],
      [CROSSBOW, 80],
      [SLING, 50],
      [JAVELIN, 30],
    ] as const)
      expect(routine(saved, key).single[0]?.rangeIncrement?.total).toBe(feet);
    expect(routine(saved, SHORTBOW).single[0]?.damageBonus.total).toBe(
      bowDamage,
    );
    expect(routine(saved, SHORTBOW).single[0]?.damageDice).toBe('1d6');
    expect(routine(saved, SHORTBOW).single[0]?.criticalMultiplier.total).toBe(
      3,
    );
    expect(routine(saved, COMPOSITE).single[0]?.damageBonus.total).toBe(
      compositeDamage,
    );
    for (const key of ['pf1/lNkiFRCBELwKFaTg', 'pf1/2GcN9zdtzr0YbLve']) {
      expect(routine(saved, key).single[0]?.damageBonus.total).toBe(
        compositeDamage,
      );
      expect(routine(saved, key).single[0]?.attackBonus.total).toBe(
        strength === 8 ? -2 : 0,
      );
    }
    expect(routine(saved, CROSSBOW).single[0]?.damageBonus.total).toBe(0);
    expect(routine(saved, SLING).single[0]?.damageBonus.total).toBe(
      slingDamage,
    );
    expect(routine(saved, CROSSBOW).attackRateNotes.join(' ')).toContain(
      'move',
    );
    expect(routine(saved, DAGGER).mode).toBe('melee');
    expect(routine(saved, JAVELIN).mode).toBe('thrown');
    expect(routine(saved, FROST).single[0]?.damageDice).toBe('2d6');
    expect(routine(saved, FROST).single[0]?.damageBonus.total).toBe(
      strength === 8 ? 2 : 9,
    );
    expect((await read()).calculated.attackRoutines).toEqual(
      saved.calculated.attackRoutines,
    );
  }
  const saved = await read();
  expect(
    saved.entries.some(
      (row) =>
        'catalogEntryId' in row && row.catalogEntryId === ids.get(GREATSWORD),
    ),
  ).toBe(false);
  expect(
    saved.catalogEntries.some((row) => row._id === ids.get(GREATSWORD)),
  ).toBe(true);
  const plainArrow = saved.entries.find(
    (row) => row.kind === 'item' && row.catalogEntryId === ids.get(ARROW),
  );
  if (!plainArrow) throw new Error('Missing plain Arrow');
  for (const [weaponKey, ammoId] of [
    [SHORTBOW, plainArrow._id],
    [CROSSBOW, itemIds.get(BOLT)!],
  ] as const) {
    const attack = saved.entries.find(
      (row) =>
        row.kind === 'attackRoutine' &&
        row.state.weaponEntryId === itemIds.get(weaponKey),
    );
    if (!attack) throw new Error('Missing ammunition attack');
    await owner.mutation(api.characterSheet.editAttackRoutine, {
      ...scope,
      entryId: attack._id,
      ammunitionEntryId: ammoId,
      operationId: `plain-ammunition-${weaponKey}`,
    });
  }
  expect(
    (await read()).calculated.attackRoutines.find(
      (row) => row.name === 'Shortbow',
    )?.ammunitionEntryId,
  ).toBe(plainArrow._id);
  expect(
    (await read()).calculated.attackRoutines.find(
      (row) => row.name === 'Light Crossbow',
    )?.ammunitionEntryId,
  ).toBe(itemIds.get(BOLT));
  const composite = saved.catalogEntries.find(
    (row) => row._id === ids.get(COMPOSITE),
  );
  if (composite?.detail?.kind !== 'item' || !composite.detail.weapon)
    throw new Error('Missing composite profile');
  // A normal authored equipment record can specify the CRB Strength rating.
  await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Composite Longbow (+2 Strength)',
    modifiers: [],
    detail: {
      ...composite.detail,
      weapon: { ...composite.detail.weapon, strengthRating: 2 },
    },
    operationId: 'rated-composite',
  });
  for (const [strength, damage] of [
    [18, 2],
    [8, -1],
  ]) {
    await owner.mutation(api.characterSheet.editBaseScores, {
      ...scope,
      scores: { strength },
      operationId: `rated-strength-${strength}`,
    });
    const rated = (await read()).calculated.attackRoutines.find(
      (row) => row.name === 'Composite Longbow (+2 Strength)',
    );
    expect(rated?.single[0]?.damageBonus.total).toBe(damage);
  }
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 18 },
    operationId: 'restore-strength',
  });
  const daggerRoutine = saved.entries.find(
    (row) =>
      row.kind === 'attackRoutine' &&
      row.state.weaponEntryId === itemIds.get(DAGGER),
  );
  if (!daggerRoutine) throw new Error('Missing Dagger routine');
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: daggerRoutine._id,
    mode: 'thrown',
    rangeIncrements: 2,
    operationId: 'throw-dagger',
  });
  const thrown = routine(await read(), DAGGER);
  expect(thrown.mode).toBe('thrown');
  expect(thrown.single[0]?.rangeIncrement?.total).toBe(10);
  expect(thrown.single[0]?.rangePenalty).toBe(-2);
  expect(thrown.single[0]?.damageBonus.total).toBe(4);
  await expect(
    outsider.mutation(api.characterSheet.createAttackRoutine, {
      ...scope,
      weaponEntryId: itemIds.get(DAGGER)!,
      operationId: 'outsider-routine',
    }),
  ).rejects.toThrow('You do not have access to this org');
});

for (const invalid of ['missing', 'duplicate', 'wrongKind'] as const)
  test(`Base Item refuses a ${invalid} stable target`, async () => {
    const { t } = await releaseFixture(modules);
    const frost = await install(t, FROST);
    if (invalid === 'wrongKind')
      await t.run((ctx) =>
        ctx.db.insert('catalogEntry', {
          scope: 'global',
          name: 'Target',
          ruleIdentity: GREATSWORD,
          stacksWithItself: false,
          sources: [],
          modifiers: [],
          detail: { kind: 'manual' },
        }),
      );
    if (invalid === 'duplicate') {
      await install(t, GREATSWORD);
      await install(t, GREATSWORD);
    }
    await prepare(t, [
      {
        kind: 'definition',
        key: FROST,
        payload: releasePayload(payload(FROST)),
      },
    ]);
    const expected = {
      missing: `Candidate reference ${GREATSWORD} is unavailable for ${FROST}`,
      duplicate: `Duplicate global ruleIdentity ${GREATSWORD}`,
      wrongKind: `Candidate Base Item ${GREATSWORD} is not an item`,
    };
    await expect(candidate(t, frost)).rejects.toMatchObject({
      data: expected[invalid],
    });
  });

test('released pinned Pronged Arrow Situation affects only the saved routine firing that ammunition', async () => {
  const { t, owner, scope } = await releaseFixture(modules);
  const keys = [SHORTBOW, CROSSBOW, PRONGED, BOLT];
  const ids = new Map<string, Id<'catalogEntry'>>();
  for (const key of keys) ids.set(key, await install(t, key));
  await t.run((ctx) =>
    ctx.db.insert('characterSheetEntry', {
      characterId: scope.characterId,
      catalogEntryId: ids.get(PRONGED)!,
      kind: 'item',
      active: true,
      state: { kind: 'item' },
    }),
  );
  await prepare(
    t,
    keys.map((key) => ({
      kind: 'definition',
      key,
      payload: releasePayload(payload(key)),
    })),
  );
  const runId = await reconcile(t, scope.characterId);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(runId),
  );
  const itemIds = new Map<string, Id<'characterSheetEntry'>>();
  const first = await owner.query(api.characterSheet.read, scope);
  const arrow = first?.entries.find(
    (row) => row.kind === 'item' && row.catalogEntryId === ids.get(PRONGED),
  );
  if (!arrow) throw new Error('Missing Pronged Arrow');
  itemIds.set(PRONGED, arrow._id);
  for (const key of [SHORTBOW, CROSSBOW, BOLT])
    itemIds.set(
      key,
      await owner.mutation(api.characterSheet.selectEntry, {
        ...scope,
        catalogEntryId: ids.get(key)!,
        operationId: `ammo-carry-${key}`,
      }),
    );
  for (const { weapon, ammo } of [
    { weapon: SHORTBOW, ammo: PRONGED },
    { weapon: CROSSBOW, ammo: BOLT },
  ]) {
    const sheet = await owner.query(api.characterSheet.read, scope);
    const routine = sheet?.entries.find(
      (row) =>
        row.kind === 'attackRoutine' &&
        row.state.weaponEntryId === itemIds.get(weapon),
    );
    if (!routine) throw new Error('Missing ammunition routine');
    await owner.mutation(api.characterSheet.editAttackRoutine, {
      ...scope,
      entryId: routine._id,
      ammunitionEntryId: itemIds.get(ammo)!,
      operationId: `ammo-${weapon}`,
    });
  }
  for (let reload = 0; reload < 2; reload++) {
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!sheet) throw new Error('Missing ammunition sheet');
    const arrow = sheet.catalogEntries.find(
      (row) => row._id === ids.get(PRONGED),
    );
    expect(arrow?.detail).toMatchObject({ ammunition: true });
    expect(arrow?.situationalNotes?.map((note) => note.text)).toContain(
      'Originally used for hunting game, a pronged arrow deals damage as if one size category smaller, but you gain a +1 bonus on attack rolls against creatures or objects one or more size categories smaller than you.',
    );
    expect(arrow?.modifiers).toContainEqual({
      target: 'attack',
      bonusType: 'untyped',
      value: 1,
      condition: {
        weapon: '$self',
        situation: {
          local:
            'against creatures or objects one or more size categories smaller than you',
        },
      },
    });
    const local =
      'against creatures or objects one or more size categories smaller than you';
    const selected = calculateCharacterSheetPreview(
      sheet,
      {},
      { situations: [{ local, sheetEntryId: itemIds.get(PRONGED)! }] },
    );
    const attacks = (routines: typeof selected.attackRoutines) =>
      Object.fromEntries(
        routines.map((row) => [row.name, row.single[0]?.attackBonus.total]),
      );
    const before = attacks(sheet.calculated.attackRoutines),
      after = attacks(selected.attackRoutines);
    expect(after.Shortbow).toBe(before.Shortbow! + 1);
    expect(after['Light Crossbow']).toBe(before['Light Crossbow']);
  }
});

const expectedMalformedIssue = {
  enum: expect.objectContaining({
    code: 'invalid_union',
    path: ['detail', 'weapon'],
    errors: expect.arrayContaining([
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid_value',
          path: ['proficiency'],
          values: ['simple', 'martial', 'exotic', 'always'],
        }),
      ]),
    ]),
  }),
  formula: expect.objectContaining({
    code: 'invalid_format',
    path: ['detail', 'weapon', 'dice'],
  }),
  reference: expect.objectContaining({
    code: 'invalid_format',
    path: ['detail', 'baseItemKey'],
  }),
  unknownWeaponField: expect.objectContaining({
    code: 'invalid_union',
    path: ['detail', 'weapon'],
    errors: expect.arrayContaining([
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unrecognized_keys',
          path: [],
          keys: ['inventedMechanic'],
        }),
      ]),
    ]),
  }),
  unknownItemField: expect.objectContaining({
    code: 'unrecognized_keys',
    path: ['detail'],
    keys: ['inventedMechanic'],
  }),
};

for (const invalid of [
  'enum',
  'formula',
  'reference',
  'unknownWeaponField',
  'unknownItemField',
] as const)
  test(`release ingestion refuses malformed ${invalid} without dropping it`, async () => {
    const { t } = await releaseFixture(modules);
    const body = payload(LONGSWORD);
    if (body.detail.kind !== 'item' || !body.detail.weapon)
      throw new Error('Missing weapon');
    const weapon = body.detail.weapon;
    const details = {
      enum: { ...body.detail, weapon: { ...weapon, proficiency: 'siege' } },
      formula: { ...body.detail, weapon: { ...weapon, dice: '1d8 + @str' } },
      reference: { ...body.detail, baseItemKey: '../Greatsword' },
      unknownWeaponField: {
        ...body.detail,
        weapon: { ...weapon, inventedMechanic: true },
      },
      unknownItemField: { ...body.detail, inventedMechanic: true },
    };
    const poisoned = { ...body, detail: details[invalid] };
    const parsed = importedCatalogEntrySchema.safeParse(poisoned);
    if (parsed.success)
      throw new Error(`Malformed ${invalid} passed validation`);
    expect(parsed.error.issues).toEqual(
      expect.arrayContaining([expectedMalformedIssue[invalid]]),
    );
    const row = {
      kind: 'definition' as const,
      key: LONGSWORD,
      payload: releasePayload(poisoned),
    };
    const rejection = expect(prepare(t, [row])).rejects;
    if (
      invalid === 'enum' ||
      invalid === 'unknownWeaponField' ||
      invalid === 'unknownItemField'
    )
      await rejection.toMatchObject({
        message: `Validator error: Expected one of object, object, object, object, object, got \`${canonicalReleaseJson(row)}\``,
      });
    else
      await rejection.toMatchObject({
        name: 'ZodError',
        issues: expect.arrayContaining([expectedMalformedIssue[invalid]]),
      });
  });

for (const source of preserved.slice(0, 8))
  test(`excluded ${source} retains its legacy shape and refuses single-ended candidate admission`, async () => {
    const key = `pf1/${source.split('.')[1]}`;
    const imported = payload(key);
    expect(imported.detail).toHaveProperty('weapon.baseTypes');
    expect(imported.detail).not.toHaveProperty('weapon.baseType');
    const { t } = await releaseFixture(modules);
    const id = await install(t, key);
    await prepare(t, [
      { kind: 'definition', key, payload: releasePayload(imported) },
    ]);
    await expect(candidate(t, id)).rejects.toThrow(
      `Unsupported candidate weapon ${key}: unsupported or incomplete imported profile (legacy weapon shape)`,
    );
  });

test('siege ammunition retains its previous unsupported classification', () => {
  expect(payload('pf1/6S3DVUP2kyWPREt0').detail).not.toHaveProperty(
    'ammunition',
  );
});

for (const source of fallbackSources)
  test(`fallback diagnostics describe only the selected legacy mapping: ${source}`, () => {
    const row = payload(`pf1/${source.split('.')[1]}`);
    expect(row.detail).toHaveProperty('weapon.baseTypes');
    expect(
      row.unsupported.filter((finding) => finding.field.startsWith('weapon')),
    ).toEqual([
      {
        field: 'weapon.damage',
        reason: 'Damage formula needs feature mapping.',
        value: '',
      },
    ]);
  });

// Archived old-shape bodies: Angelfall's native placeholder is 1d4 melee despite
// its composite-longbow description; no historical release conversion supported it.
for (const [key, baseType, handedness, dice] of [
  ['pf1-content/zaEFBVAIFds18oVh', 'Longbow', 'light', '1d4'],
  [LONGSWORD, 'Longsword', '1h', '1d8'],
  [CROSSBOW, 'Light Crossbow', 'ranged', '1d8'],
] as const)
  test(`candidate conversion refuses unqualified old weapon shape with identity: ${key}`, async () => {
    const { t, scope } = await releaseFixture(modules);
    const id = await install(t, key);
    const body = payload(LONGSWORD);
    await t.run((ctx) =>
      ctx.db.insert('characterSheetEntry', {
        characterId: scope.characterId,
        catalogEntryId: id,
        kind: 'item',
        active: true,
        state: { kind: 'item' },
      }),
    );
    await prepare(t, [
      {
        kind: 'definition',
        key,
        payload: releasePayload({
          ...body,
          externalKey: key,
          upstreamKey: key,
          detail: {
            kind: 'item',
            consumable: false,
            price: 0,
            weight: 0,
            weapon: {
              baseTypes: [baseType],
              proficiency: 'simple',
              groups: [],
              handedness,
              dice,
              damageTypes: [],
              threat: 20,
              mult: 2,
              finesse: false,
              thrown: false,
            },
          },
        }),
      },
    ]);
    await expect(candidate(t, id)).rejects.toThrow(
      `Unsupported candidate weapon ${key}: unsupported or incomplete imported profile (legacy weapon shape)`,
    );
    await expect(candidate(t, id)).rejects.toMatchObject({
      data: `Unsupported candidate weapon ${key}: unsupported or incomplete imported profile (legacy weapon shape)`,
    });
  });

for (const key of ['pf1/lNkiFRCBELwKFaTg', 'pf1/2GcN9zdtzr0YbLve'])
  test(`native composite tag supplies the bow profile independently of display name: ${key}`, () => {
    expect(payload(key).detail).toMatchObject({
      weapon: {
        strengthDamage: 'compositeBow',
        strengthRating: 0,
        reload: 'free',
      },
    });
  });

for (const [key, expected] of [
  ['pf1/7zvBqNNlc5i5EtFd', { thrown: true, thrownRangeIncrement: 10 }],
  ['pf1/mCwwHo32SU7kjGyu', { handedness: 'light' }],
  ['pf1/42M7kFLkyccrj1uf', { handedness: 'light' }],
  [
    'pf1/ZBnZt4RlEg7ckoKE',
    { handedness: 'oneHanded', dice: '1d8', reload: 'move' },
  ],
] as const)
  test(`source context resolves the selected grip or thrown contract: ${key}`, () => {
    expect(payload(key).detail).toMatchObject({ weapon: expected });
  });

test('Mancatcher no-critical source contract stays explicitly unresolved in the attack model', () => {
  const body = payload('pf1/c2cwyWi0Jn5PMggb');
  expect(body.detail).not.toHaveProperty('weapon.threat');
  expect(body.detail).not.toHaveProperty('weapon.mult');
  expect(body.unsupported).toContainEqual({
    field: 'weapon.critical',
    reason:
      'Source specifies no critical multiplier; the stored attack model cannot represent a non-critical attack.',
  });
});

for (const [key, field] of [
  ['pf1/CUFJ4SDh7TKSrjx0', 'strengthDamage'],
  ['pf1/vyRDu111njgEV8xw', 'reload'],
  ['pf1/J0zfGICU57qryKxj', 'criticalEffects'],
] as const)
  test(`held ${field} cannot produce a calculable candidate: ${key}`, async () => {
    const { t } = await releaseFixture(modules);
    const id = await install(t, key);
    await prepare(t, [
      { kind: 'definition', key, payload: releasePayload(payload(key)) },
    ]);
    await expect(candidate(t, id)).rejects.toMatchObject({
      data: `Unsupported candidate weapon ${key}: unresolved ${field}`,
    });
  });

test('the independent expectation fixture reproduces from pinned source files and explicit source decisions', () => {
  expect(
    execFileSync(process.execPath, ['tests/fixtures/weapon-baseline-761.mjs'], {
      encoding: 'utf8',
    }),
  ).toContain('Source-derived expectations: 101 records;');
});

test('the actual pinned Angelfall Bow placeholder is refused at the real candidate boundary', async () => {
  const key = 'pf1-content/zaEFBVAIFds18oVh';
  expect(
    createHash('sha256')
      .update(await readPinned('pf1-content', angelfallFile))
      .digest('hex'),
  ).toBe(angelfallSha256);
  const body = payload(key);
  expect(body.name).toBe('Angelfall Bow');
  expect(body.detail).toMatchObject({
    weapon: { baseTypes: ['Longbow'], dice: '1d4', handedness: 'light' },
  });
  const { t } = await releaseFixture(modules);
  const id = await install(t, key);
  await prepare(t, [
    { kind: 'definition', key, payload: releasePayload(body) },
  ]);
  await expect(candidate(t, id)).rejects.toMatchObject({
    data: `Unsupported candidate weapon ${key}: unsupported or incomplete imported profile (legacy weapon shape)`,
  });
});

test('unreviewed sling variants refuse instead of inheriting ordinary sling statistics', async () => {
  const cases = [
    [
      'pf1/JRfUcNzydUeBm76p',
      'spear-sling.JRfUcNzydUeBm76p',
      'Loading a spear-sling is a standard',
    ],
    [
      'pf1/VwxTLVOEPfbvIv9B',
      'sling-glove.VwxTLVOEPfbvIv9B',
      'Loading a sling glove is a free action',
    ],
    [
      'pf1/nSZTb7vN2SH2KwRG',
      'halfling-double-sling.nSZTb7vN2SH2KwRG',
      'use the second end to make one additional ranged attack',
    ],
  ] as const;
  const { t } = await releaseFixture(modules);
  const ids = new Map<string, Id<'catalogEntry'>>();
  for (const [key, file, passage] of cases) {
    expect(
      await readPinned('pf1', `packs/weapons-and-ammo/${file}.yaml`),
    ).toContain(passage);
    ids.set(key, await install(t, key));
  }
  await prepare(
    t,
    cases.map(([key]) => ({
      kind: 'definition',
      key,
      payload: releasePayload(payload(key)),
    })),
  );
  for (const [key] of cases) {
    // These used to have plausible but incorrect fields already present, so
    // the missing-field guard alone could not protect this source contract.
    await expect(candidate(t, ids.get(key)!)).rejects.toMatchObject({
      data: `Unsupported candidate weapon ${key}: unsupported or incomplete imported profile (legacy weapon shape)`,
    });
    expect(payload(key).detail, key).not.toHaveProperty('weapon.reload');
    expect(payload(key).detail, key).not.toHaveProperty(
      'weapon.strengthDamage',
    );
  }
});

test('the native double group refuses a one-ended conversion independently of its base-type name', async () => {
  const key = 'pf1/nSZTb7vN2SH2KwRG';
  const path =
    'packs/weapons-and-ammo/halfling-double-sling.nSZTb7vN2SH2KwRG.yaml';
  const raw: unknown = parseYaml(await readPinned('pf1', path));
  const source = z
    .looseObject({
      system: z.looseObject({
        baseTypes: z.array(z.string()),
        weaponGroups: z.array(z.string()),
        properties: z.record(z.string(), z.unknown()).optional(),
      }),
    })
    .parse(raw);
  expect(source.system.weaponGroups).toContain('double');
  expect(source.system.properties?.dbl).not.toBe(true);
  // Mutate only the isolated copy's base alias. The real source's double
  // classification must still win over a reviewed single-ended profile.
  source.system.baseTypes = ['Sling'];
  const { materializePinnedTree } = await import('./pinned-sources');
  const { importCatalog } = await import('../../scripts/catalog/import');
  const { default: remaps } =
    await import('../../scripts/catalog/reviewed-remaps.json');
  const { reviewedCuration } =
    await import('../../scripts/catalog/reviewed-curation-data');
  const tree = await materializePinnedTree([`pf1/${path}`]);
  try {
    await writeFile(join(tree.systemPath, path), stringifyYaml(source));
    const artifact = await importCatalog({
      ...tree,
      remaps,
      curation: reviewedCuration,
    });
    const body = artifact.catalog.entries.find(
      (row) => row.externalKey === key,
    );
    expect(body?.detail).toHaveProperty(
      'weapon.groups',
      expect.arrayContaining(['double']),
    );
    const { t } = await releaseFixture(modules);
    const id = await install(t, key);
    await prepare(t, [
      { kind: 'definition', key, payload: releasePayload(body) },
    ]);
    await expect(candidate(t, id)).rejects.toMatchObject({
      data: `Unsupported candidate weapon ${key}: unsupported or incomplete imported profile (legacy weapon shape)`,
    });
  } finally {
    await tree.dispose();
  }
});

test('saved Whip, Sickle, Mancatcher, Net and Lasso profiles expose incomplete statistics instead of ordinary attacks', async () => {
  const keys = [
    'pf1/OPTlPwKg2NyQAjhe',
    'pf1/oAb9EXEzaLRGfYxL',
    'pf1/c2cwyWi0Jn5PMggb',
    'pf1/6oevs2mE3QqqQEAK',
    'pf1/P1zlk4ivL3jjyvp2',
  ];
  const { t, owner, scope } = await releaseFixture(modules);
  const ids = new Map<string, Id<'catalogEntry'>>();
  for (const key of keys) ids.set(key, await install(t, key));
  await t.run((ctx) =>
    ctx.db.insert('characterSheetEntry', {
      characterId: scope.characterId,
      catalogEntryId: ids.get(keys[0]!)!,
      kind: 'item',
      active: true,
      state: { kind: 'item' },
    }),
  );
  await prepare(
    t,
    keys.map((key) => ({
      kind: 'definition',
      key,
      payload: releasePayload(payload(key)),
    })),
  );
  const runId = await reconcile(t, scope.characterId);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(runId),
  );
  const routines: Id<'characterSheetEntry'>[] = [];
  for (const key of keys) {
    const weaponEntryId = await owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: ids.get(key)!,
      operationId: `unresolved-carry-${key}`,
    });
    routines.push(
      await owner.mutation(api.characterSheet.createAttackRoutine, {
        ...scope,
        weaponEntryId,
        operationId: `unresolved-routine-${key}`,
      }),
    );
  }
  for (let reload = 0; reload < 2; reload++) {
    const saved = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!saved) throw new Error('Missing unresolved profile sheet');
    for (const id of routines) {
      const routine = saved.calculated.attackRoutines.find(
        (row) => row.entryId === id,
      );
      expect(routine?.single).toEqual([]);
      expect(routine?.full).toEqual([]);
      expect(
        routine?.warnings.some(
          (warning) =>
            warning.kind === 'unresolved' &&
            warning.message.includes('statistics are incomplete'),
        ),
      ).toBe(true);
    }
  }
});

// Pinned Pistol (Ultimate Combat p.43): capacity 1 and firearm ammunition;
// its reload/Strength procedure has no reviewed stored-profile mapping.
test('an unreviewed native Pistol cannot become unlimited attacks with zero Strength', async () => {
  const key = 'pf1/RRh1u2ccgLv1ynu8';
  const body = payload(key);
  expect(body.name).toBe('Pistol');
  const { t, owner, scope } = await releaseFixture(modules);
  const id = await install(t, key);
  await prepare(t, [
    { kind: 'definition', key, payload: releasePayload(body) },
  ]);
  await expect(candidate(t, id)).rejects.toMatchObject({
    data: `Unsupported candidate weapon ${key}: unresolved strengthDamage, reload`,
  });
  const before = await owner.query(api.characterSheet.read, scope);
  const runId = await discover(t);
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId }),
  ).toBe(false);
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
});

test('source-backed unreviewed ranged procedures are explicitly held before conversion', async () => {
  for (const [key, path, passage] of launcherCases) {
    expect(await readPinned('pf1', path), key).toContain(passage);
    expect(payload(key).detail, key).toHaveProperty('weapon.unresolved', [
      'strengthDamage',
      'reload',
    ]);
  }
});

test('every nonselected calculable native profile with missing ranged semantics refuses at the real candidate boundary', async () => {
  const included = new Set(baseline.map((row) => row.key));
  const incomplete = entries.flatMap((row) => {
    if (included.has(row.externalKey) || row.detail.kind !== 'item') return [];
    const weapon = row.detail.weapon;
    if (
      !weapon ||
      !('baseType' in weapon) ||
      weapon.attackType !== 'ranged' ||
      !weapon.dice ||
      weapon.threat === undefined ||
      weapon.mult === undefined
    )
      return [];
    // The stored calculator otherwise interprets these omissions as zero
    // Strength damage and unlimited attacks. This is its completeness contract,
    // not a list of weapon names or an expected profile copied from the mapper.
    const missing: ('strengthDamage' | 'reload')[] = [];
    if (weapon.strengthDamage === undefined) missing.push('strengthDamage');
    if (!weapon.thrown && weapon.reload === undefined) missing.push('reload');
    return missing.length ? [{ row, missing }] : [];
  });
  const { t } = await releaseFixture(modules);
  const ids = new Map<string, Id<'catalogEntry'>>();
  for (const { row } of incomplete)
    ids.set(row.externalKey, await install(t, row.externalKey));
  await prepare(
    t,
    incomplete.map(({ row }) => ({
      kind: 'definition',
      key: row.externalKey,
      payload: releasePayload(row),
    })),
  );
  for (const { row, missing } of incomplete) {
    expect(row.detail, row.externalKey).toHaveProperty(
      'weapon.unresolved',
      missing,
    );
    await expect(candidate(t, ids.get(row.externalKey)!)).rejects.toMatchObject(
      {
        data: `Unsupported candidate weapon ${row.externalKey}: unresolved ${missing.join(', ')}`,
      },
    );
  }
  for (const [key] of launcherCases)
    expect(incomplete.map(({ row }) => row.externalKey)).toContain(key);
});

test('a self-referential Base Item refuses with identity and preserves the public saved sheet', async () => {
  const { t, owner, scope } = await releaseFixture(modules);
  const id = await install(t, FROST);
  await install(t, GREATSWORD);
  await t.run((ctx) =>
    ctx.db.insert('characterSheetEntry', {
      characterId: scope.characterId,
      catalogEntryId: id,
      kind: 'item',
      active: true,
      state: { kind: 'item' },
    }),
  );
  const first = await prepare(
    t,
    [FROST, GREATSWORD].map((key) => ({
      kind: 'definition',
      key,
      payload: releasePayload(payload(key)),
    })),
  );
  const firstRun = await reconcile(t, scope.characterId);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(firstRun),
  );
  const selected = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: id,
    operationId: 'valid-frost',
  });
  const frostRoutineId = await owner.mutation(
    api.characterSheet.createAttackRoutine,
    {
      ...scope,
      weaponEntryId: selected,
      operationId: 'valid-frost-routine',
    },
  );
  const before = await owner.query(api.characterSheet.read, scope);
  const calculated = withSheetCatalog(before)?.calculated;
  const frostRoutines = calculated?.attackRoutines.filter(
    (routine) => routine.entryId === frostRoutineId,
  );
  expect(frostRoutines).toHaveLength(1);
  expect(frostRoutines?.[0]?.single[0]?.damageDice).toBe('2d6');
  const body = payload(FROST);
  if (body.detail.kind !== 'item') throw new Error('Missing Frost Brand item');
  await prepare(
    t,
    [
      {
        kind: 'definition',
        key: FROST,
        payload: releasePayload({
          ...body,
          detail: { ...body.detail, baseItemKey: FROST },
        }),
      },
    ],
    2,
    {
      releaseNumber: 1,
      artifactFingerprint: first.manifest.artifactFingerprint,
    },
  );
  await expect(candidate(t, id, 2)).rejects.toMatchObject({
    data: `Candidate Base Item ${FROST} cannot reference itself`,
  });
  const nextRun = await discover(t, 2);
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId: nextRun }),
  ).toBe(false);
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
});
