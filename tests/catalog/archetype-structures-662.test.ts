// archetype-barbarian-1 (#716; docs/catalog-import/archetype-structures-662.md):
// the structure records of six mechanical Barbarian archetypes (#662) of the
// Advanced Player's Guide, written drafted; the record step checked all ten
// on a captured review. One table holds the batch: each
// archetype's reviewed replacements and each owned feature's level, source
// hash and PRD paragraph. No root has a review item, so every record is a
// feature's description. Jungle Rager, Savage Technologist, Deepwater Rager
// and Mooncursed are left out (the report says why) and keep their state.
// Every case runs on the pinned tree.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { assessCatalogAdmission } from '../../scripts/catalog/admission';
import { importCatalog } from '../../scripts/catalog/import';
import { pcgenPin } from '../../scripts/catalog/inventory';
import { pcgenOwnerSelection } from '../../scripts/catalog/pcgen-owners';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import type { StructureRecord } from '../../scripts/catalog/structure-curation';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import {
  ownerEmissionFoundryFiles,
  pcgenOwnerEmissionFiles,
} from '../fixtures/pcgen-716/owner-emission-files';
import {
  materializePinnedTree,
  pinnedPath,
  readPinned,
} from './pinned-sources';

const APG = 'roleplaying_game/advanced_players_guide/apg_abilities_class.lst';
const ISC = 'campaign_setting/inner_sea_combat/isc_abilities_class.lst';
const TG = 'campaign_setting/technology_guide/tg_abilities_class.lst';
const LOTFW =
  'player_companion/legacy_of_the_first_world/lotfw_abilities_class.lst';
const HA = 'roleplaying_game/horror_adventures/ha_abilities_class.lst';
const apgPage = 'pages/advancedPlayersGuide/coreClasses/barbarian.html';
const BOOK = 'PZO1115';
/** The record step's receipt: the captured review that checked all ten records. */
const RECEIPT =
  't3-review-9f78883ff5829657ed25e5ce80c9690e8a29723b431d2754c01e3186002a7696';

/** The Barbarian's rows the ten candidate archetypes replace (Foundry ids). */
const barbarian = {
  rage: 'WSqWT9ZIshtC5vlV',
  fastMovement: '9EX00obqhGHcrOdp',
  uncannyDodge: '7WaQxnVaaoL4AGr8',
  trapSense: 'BoEkMviJrW0PKmhj',
  improvedUncannyDodge: 'ZfnHhhTFQVo0Lj4P',
  damageReduction: 'RENIeTVjWB7Mq6Mw',
  greaterRage: 'IWNz5tJCnpig4UtX',
  indomitableWill: 'Q3x319WbNkCssApD',
  tirelessRage: 'aYdjgDZJCNvKpLQP',
  mightyRage: '0v0NLj0tuVAu2Cla',
} as const;
type BarbarianRow = keyof typeof barbarian;
const row = (name: BarbarianRow) => `pf1/${barbarian[name]}`;

/**
 * The Barbarian class and the rows above with every pinned Foundry record
 * they link (`Compendium.pf1.<pack>.…<id>`), transitively. Without them the
 * class and those rows fail on unresolved references and the archetypes are
 * omitted behind them.
 */
async function barbarianClosure() {
  const packs = pinnedPath('pf1', 'packs');
  const byId = new Map<string, string>();
  for (const pack of await readdir(packs))
    for (const file of await readdir(join(packs, pack)).catch(() => []))
      byId.set(file.split('.').at(-2) ?? '', `packs/${pack}/${file}`);
  const files = new Set<string>();
  const queue: string[] = ['g3pq7xWWdUVYw6ai', ...Object.values(barbarian)];
  for (let id = queue.pop(); id; id = queue.pop()) {
    const path = byId.get(id);
    if (!path || files.has(path)) continue;
    files.add(path);
    const text = await readPinned('pf1', path);
    for (const [, linked] of text.matchAll(
      /Compendium\.pf1\.[a-z-]+\.(?:Item\.)?([A-Za-z0-9]{16})/g,
    ))
      if (linked) queue.push(linked);
  }
  return [...files].map((path) => `pf1/${path}`);
}

const pcgenFiles = [
  ...pcgenOwnerEmissionFiles,
  'roleplaying_game/advanced_players_guide/advanced_players_guide.pcc',
  APG,
  'campaign_setting/inner_sea_combat/_inner_sea_combat.pcc',
  ISC,
  'campaign_setting/technology_guide/_technology_guide.pcc',
  TG,
  'player_companion/legacy_of_the_first_world/_legacy_of_the_first_world.pcc',
  LOTFW,
  'roleplaying_game/horror_adventures/_horror_adventures.pcc',
  HA,
];
const tree = await materializePinnedTree([
  ...new Set([...ownerEmissionFoundryFiles, ...(await barbarianClosure())]),
  ...[...new Set(pcgenFiles)].map(
    (path) => `pcgen/${pcgenPin.directory}/${path}`,
  ),
]);
afterAll(() => tree.dispose());

const remaps: unknown = JSON.parse(
  await readFile('scripts/catalog/reviewed-remaps.json', 'utf8'),
);

type Feature = readonly [
  slug: string,
  pcgenName: string,
  classLevel: number,
  sourceSha256: string,
  /** The feature's paragraph on the APG barbarian page. */
  prdLine: number,
];
type Archetype = {
  /** PCGen's name: the record is `Barbarian Archetype ~ <name>`, a feature `<name> ~ <feature>`. */
  name: string;
  slug: string;
  /** The rows the archetype's own text replaces, whole, in the mapper's order. */
  replaces: readonly (readonly [BarbarianRow, number])[];
  features: readonly Feature[];
};

/** The batch, as the boundary and report give it (archetype-structures-662.md). */
const batch: readonly Archetype[] = [
  {
    name: 'Brutal Pugilist',
    slug: 'brutal-pugilist',
    replaces: [
      ['uncannyDodge', 2],
      ['trapSense', 3],
      ['improvedUncannyDodge', 5],
    ],
    features: [
      [
        'savage-grapple',
        'Savage Grapple',
        2,
        '583ef9e6143c2345064baf44b2f32baeaf0f9c14b4f898c1565e9aa8f1740527',
        405,
      ],
      [
        'pit-fighter',
        'Pit Fighter',
        3,
        '61a9162e1045d12db0902490091b32d5ce93ac919186e04805c2b5a7a0add397',
        406,
      ],
      [
        'improved-savage-grapple',
        'Improved Savage Grapple',
        5,
        '08e40c91308d9ed17b2ce6937e299056890b76336f57a702afd0410d6e0cddef',
        407,
      ],
    ],
  },
  {
    name: 'Drunken Brute',
    slug: 'drunken-brute',
    replaces: [['fastMovement', 1]],
    features: [
      [
        'raging-drunk',
        'Raging Drunk',
        1,
        '0679b2ebb764683805550e5e52304b0958773719038ad72c82164a69bcd48021',
        411,
      ],
    ],
  },
  {
    name: 'Elemental Kin',
    slug: 'elemental-kin',
    replaces: [['trapSense', 3]],
    features: [
      [
        'elemental-fury',
        'Elemental Fury',
        3,
        'f0ee0682a1068d12cc35e38c1bb2d630b46a30438a11a3e4b24713d561e8fa9d',
        415,
      ],
    ],
  },
  {
    name: 'Hurler',
    slug: 'hurler',
    replaces: [['fastMovement', 1]],
    features: [
      [
        'skilled-thrower',
        'Skilled Thrower',
        1,
        '8963825bdd7de53cb7b287a80c6e6c5ac27c799a071f9822c9092cc6fae9b1ed',
        419,
      ],
    ],
  },
  {
    name: 'Invulnerable Rager',
    slug: 'invulnerable-rager',
    replaces: [
      ['uncannyDodge', 2],
      ['improvedUncannyDodge', 5],
      ['damageReduction', 7],
      ['trapSense', 3],
    ],
    features: [
      [
        'invulnerability',
        'Invulnerability',
        2,
        'b2bbdf393ce7262c0b21cda76eb7fd158c851f960f8615b277d912bf87215c96',
        423,
      ],
      [
        'extreme-endurance',
        'Extreme Endurance',
        3,
        'e9d5f6e451cf770395631f7ccaabfc5e71baf43a595ddbbdf13b5d07640284c5',
        424,
      ],
    ],
  },
  {
    name: 'Mounted Fury',
    slug: 'mounted-fury',
    replaces: [
      ['fastMovement', 1],
      ['uncannyDodge', 2],
      ['improvedUncannyDodge', 5],
    ],
    features: [
      [
        'fast-rider',
        'Fast Rider',
        1,
        '6255be88a45ff64664abed07ecfe3e047fd432ba2e5756bb6d6b1d558ad7adc8',
        428,
      ],
      [
        'bestial-mount',
        'Bestial Mount',
        5,
        '14d758643d3f3b710fe817a8122acef6eb6c7ffeea096d7337dcd14f675ba3ba',
        429,
      ],
    ],
  },
];
/** The four candidates left out, which keep their state. */
const leftOutSelectors = [
  [ISC, 'Jungle Rager'],
  [TG, 'Savage Technologist'],
  [LOTFW, 'Deepwater Rager'],
  [HA, 'Mooncursed'],
] as const;
const leftOut = [
  'jungle-rager',
  'savage-technologist',
  'deepwater-rager',
  'mooncursed',
].map((slug) => `everythingpath/barbarian-${slug}`);

const rootKey = ({ slug }: Archetype) => `everythingpath/barbarian-${slug}`;
const featureKey = (archetype: Archetype, [slug]: Feature) =>
  `${rootKey(archetype)}-${slug}`;
const locator = ({ name }: Archetype, [, pcgenName]: Feature) =>
  `pcgen:${APG}#${name} ~ ${pcgenName}`;
const batchRows = batch.flatMap((archetype) => [
  rootKey(archetype),
  ...archetype.features.map((feature) => featureKey(archetype, feature)),
]);
const batchKeys = new Set(batchRows);

const ENTITIES: Record<string, string> = { mdash: '—', ndash: '–', amp: '&' };
const page = (await readPinned('prd', apgPage)).split('\n');
/** A PRD feature's paragraph as plain text: heading dropped, markup and entities read, spaces collapsed. */
function prdText(line: number) {
  return (page[line - 1] ?? '')
    .trim()
    .replace(/^<p[^>]*>/, '')
    .replace(/<\/p>$/, '')
    .replace(/^<b>.*?<\/b>\s*:?\s*/, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&(\w+);/g, (match, name: string) => {
      const text = ENTITIES[name];
      if (text === undefined) throw new Error(`Unread entity ${match}`);
      return text;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

const without = {
  ...reviewedCuration,
  structures: (reviewedCuration.structures ?? []).filter(
    ({ externalKey }) => !batchKeys.has(externalKey),
  ),
};
const withStructures = (structures: readonly StructureRecord[]) => ({
  ...without,
  structures: [...without.structures, ...structures],
});
const committed = (reviewedCuration.structures ?? [])
  .filter(({ externalKey }) => batchKeys.has(externalKey))
  .sort((a, b) => (a.externalKey < b.externalKey ? -1 : 1));
/**
 * The committed records, drafted in memory: each becomes a copy without its
 * reviewer, date and receipt, as the batch wrote it.
 */
const draftedInMemory = committed.map(
  (record): StructureRecord => ({
    externalKey: record.externalKey,
    sourceSha256: record.sourceSha256,
    fields: record.fields,
    resolves: record.resolves,
    rationale: record.rationale,
    status: 'drafted',
  }),
);

const selected = new Set(
  [...batch.map(({ name }) => [APG, name] as const), ...leftOutSelectors].map(
    ([file, name]) => `${file}#Barbarian Archetype ~ ${name}`,
  ),
);
const selection = pcgenOwnerSelection.filter(
  (owner) =>
    owner.kind === 'archetype' && selected.has(`${owner.file}#${owner.key}`),
);
type Artifact = Awaited<ReturnType<typeof importCatalog>>;
const emit = (curation: unknown) =>
  importCatalog({
    systemPath: tree.systemPath,
    contentPath: tree.contentPath,
    remaps,
    curation,
    pcgen: { path: tree.pcgenPath, selection },
  });
/** Every emitted key's admission outcome. */
const outcomes = (artifact: Artifact) => {
  const gate = assessCatalogAdmission({ artifact, ...reviewedAdmission });
  const all = new Map<string, { kind: string; reason: string }>();
  for (const kind of [
    'admitted',
    'held',
    'dependentOmissions',
    'failures',
  ] as const)
    for (const { externalKey, reason } of gate[kind])
      if (externalKey) all.set(externalKey, { kind, reason });
  return all;
};
const entryOf = (artifact: Artifact, key: string) =>
  artifact.catalog.entries.find((item) => item.externalKey === key);
const ours = <T extends { externalKey: string }>(items: readonly T[]) =>
  items.filter(({ externalKey }) => batchKeys.has(externalKey));

const base = await emit(without);
const asCommitted = await emit(reviewedCuration);
const drafted = await emit(withStructures(draftedInMemory));
const baseOutcomes = outcomes(base);

/** The records the table gives, rationale aside. */
const expected = batch
  .flatMap((archetype) =>
    archetype.features.map((feature) => ({
      externalKey: featureKey(archetype, feature),
      sourceSha256: feature[3],
      fields: { description: prdText(feature[4]) },
      resolves: [{ kind: 'ownedFeature', id: locator(archetype, feature) }],
    })),
  )
  .sort((a, b) => (a.externalKey < b.externalKey ? -1 : 1));

describe('the structure records of six mechanical Barbarian archetypes (archetype-barbarian-1, #716)', () => {
  it('are committed with exactly the reviewed descriptions, items and source hashes, all ten checked by the record step; the four left out have none', () => {
    expect(batchRows).toHaveLength(16);
    expect(
      committed.map((record) => ({
        externalKey: record.externalKey,
        sourceSha256: record.sourceSha256,
        fields: record.fields,
        resolves: record.resolves,
        status: record.status === 'checked' ? record.receipt : record.status,
        noMechanics: record.noMechanics,
      })),
    ).toEqual(
      expected.map((record) => ({
        ...record,
        status: RECEIPT,
        noMechanics: undefined,
      })),
    );
    expect(
      (reviewedCuration.structures ?? []).filter(({ externalKey }) =>
        leftOut.some((key) => externalKey.startsWith(key)),
      ),
    ).toEqual([]);
  });

  it('as committed (checked by the record step), settle every gate and apply, and admit all 16 rows under #227 on PZO1115; no other key changes', () => {
    const report = asCommitted.structure;
    if (!report) throw new Error('No structure report');
    expect({
      handReview: ours(report.handReview),
      unreviewedFeatures: ours(report.unreviewedFeatures),
      invalid: report.invalid,
      conflicts: ours(report.conflicts),
      stale: ours(report.stale),
      held: report.held.filter((key) => batchKeys.has(key)),
    }).toEqual({
      handReview: [],
      unreviewedFeatures: [],
      invalid: [],
      conflicts: [],
      stale: [],
      held: [],
    });
    expect(
      ours(report.applied)
        .map(({ externalKey }) => externalKey)
        .sort(),
    ).toEqual(expected.map(({ externalKey }) => externalKey));
    const after = outcomes(asCommitted);
    for (const key of batchRows)
      expect(after.get(key), key).toEqual({
        kind: 'admitted',
        reason: `Admitted under #227: declared book ${BOOK}.`,
      });
    for (const [key, outcome] of baseOutcomes)
      if (!batchKeys.has(key)) expect(after.get(key), key).toEqual(outcome);
    expect([...after.keys()].sort()).toEqual([...baseOutcomes.keys()].sort());
    for (const record of expected)
      expect(
        entryOf(asCommitted, record.externalKey),
        record.externalKey,
      ).toMatchObject({
        ...record.fields,
        detail: { kind: 'classFeature' },
        // No record gives a number on the sheet.
        modifiers: [],
      });
  });

  it('drafted in memory, change no key: every feature stays held on structure and every root omitted behind its features', () => {
    expect(outcomes(drafted)).toEqual(baseOutcomes);
    expect(ours(drafted.structure?.applied ?? [])).toEqual([]);
    for (const archetype of batch) {
      for (const feature of archetype.features)
        expect(baseOutcomes.get(featureKey(archetype, feature))).toEqual({
          kind: 'held',
          reason: `Structure hand review (#716 plan §6): owned feature ${locator(archetype, feature)}.`,
        });
      expect(baseOutcomes.get(rootKey(archetype))?.kind, archetype.name).toBe(
        'dependentOmissions',
      );
    }
    // Each left-out root is unadmitted (a dependent omission in the full
    // preview; on this reduced tree Mooncursed fails instead) and keeps its
    // state in every case.
    for (const key of leftOut)
      expect(baseOutcomes.get(key)?.kind, key).not.toBe('admitted');
  });

  it('as committed, replace exactly the rows each archetype’s own text names, whole, and add its features at their levels', () => {
    for (const archetype of batch) {
      const detail = entryOf(asCommitted, rootKey(archetype))?.detail;
      if (detail?.kind !== 'archetype') throw new Error(`No ${archetype.name}`);
      expect(
        {
          replaces: detail.replaces,
          featureChanges: detail.featureChanges,
          adds: detail.adds,
        },
        archetype.name,
      ).toEqual({
        replaces: archetype.replaces.map(([name, classLevel]) => ({
          externalKey: row(name),
          classLevel,
          scope: 'whole',
        })),
        featureChanges: archetype.replaces.map(([name]) => ({
          externalKey: row(name),
          scope: 'whole',
        })),
        adds: archetype.features.map((feature) => ({
          externalKey: featureKey(archetype, feature),
          classLevel: feature[2],
        })),
      });
    }
  });
});
