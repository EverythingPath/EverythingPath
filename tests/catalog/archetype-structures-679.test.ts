// archetype-monk-1 (#716; docs/catalog-import/archetype-structures-679.md):
// the structure records of eight mechanical Monk archetypes (#679), written
// drafted; the record step checked 36 of the 37 on a captured review, and
// Flowing Monk's Bonus Feat stays drafted until the next Monk batch. One table
// holds the batch: each archetype's PCGen record, book and reviewed
// replacements, and each owned feature's source hash and where its description
// comes from (a pinned PRD page's paragraph, PCGen's own DESC, or none for a
// noMechanics disposition). Only Flowing Monk's root has a review item, so it
// is the one root with a record. Tetori, Black Asp and Treetop Monk are left
// out (the report says why) and keep their state. Every case runs on the
// pinned tree.
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
const UC = 'roleplaying_game/ultimate_combat/uc_abilities_class.lst';
const ISC = 'campaign_setting/inner_sea_combat/isc_abilities_class.lst';
const UI = 'roleplaying_game/ultimate_intrigue/ui_abilities_class.lst';
const ARG = 'roleplaying_game/advanced_race_guide/arg_abilities_class.lst';
const apgPage = 'pages/advancedPlayersGuide/coreClasses/monk.html';
const ucPage = 'pages/ultimateCombat/classArchetypes/monk.html';
/** The record step's receipt: the captured review that checked 36 of the 37 records. */
const RECEIPT =
  't3-review-362dfd4573e7e05fe5a73f66e6739ce642473c8a3dc25f0485a1d7b1b5a6bc2f';
/** The one record the review did not confirm (its rationale's count); it stays drafted. */
const bonusFeat = 'everythingpath/monk-flowing-monk-bonus-feat';
const flowingMonk = 'everythingpath/monk-flowing-monk';

/** The Monk's rows the eleven candidate archetypes replace (Foundry ids). */
const monk = {
  bonusFeat: 'VjHjPja5QABBgRvR',
  stunningFist: '2ausI8g6SsmbOpgF',
  fastMovement: 'CK5L0YJDENqBxLqv',
  purityOfBody: '82G7gl4C1AvtSHI4',
  diamondBody: 'nRffrQSKTqjeBAO5',
  quiveringPalm: 'n4SWyKVcdmZK4t7d',
  wholenessOfBody: 'ZPrMO00Iz2SfrNMq',
  diamondSoul: 'bCdFkzKiVg52ufhu',
  abundantStep: 'XJtvco1XWggmr5LU',
  perfectSelf: 'NNEU7hzPSu2LTyZv',
  timelessBody: '5JlthJkVGEHPZypG',
  tongue: 'NKzRm45051DUHkd5',
  evasion: 'KQYCRLEdD4bGA5ak',
  slowFall: 'M4bXVPXouXroIt90',
  highJump: 'WJEF9WHs27kaFYJL',
  improvedEvasion: 'Cc2eFfhJYlClCGEH',
  maneuverTraining: 'E7enBZN7FCsoyIof',
  flurry: 'JKJoHy5NveXGaZqv',
  emptyBody: 'dtnkUkinLVIl1b2T',
  stillMind: '8VUae7CIgCidvSfg',
} as const;
type MonkRow = keyof typeof monk;
const row = (name: MonkRow) => `pf1/${monk[name]}`;

/**
 * The Monk class and the rows above with every pinned Foundry record they
 * link (`Compendium.pf1.<pack>.…<id>`), transitively: the Monk's schedule, the
 * feats its bonus-feat list and Stunning Fist name, and theirs. Without them the
 * class and those rows fail on unresolved references and the archetypes are
 * omitted behind them.
 */
async function monkClosure() {
  const packs = pinnedPath('pf1', 'packs');
  const byId = new Map<string, string>();
  for (const pack of await readdir(packs))
    for (const file of await readdir(join(packs, pack)).catch(() => []))
      byId.set(file.split('.').at(-2) ?? '', `packs/${pack}/${file}`);
  const files = new Set<string>();
  const queue: string[] = ['W8dxwZ1CZiwLKsqr', ...Object.values(monk)];
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
  'roleplaying_game/ultimate_combat/_ultimate_combat.pcc',
  UC,
  'campaign_setting/inner_sea_combat/_inner_sea_combat.pcc',
  ISC,
  'roleplaying_game/ultimate_intrigue/_ultimate_intrigue.pcc',
  UI,
  'roleplaying_game/advanced_race_guide/advanced_race_guide.pcc',
  ARG,
];
const tree = await materializePinnedTree([
  ...new Set([...ownerEmissionFoundryFiles, ...(await monkClosure())]),
  ...[...new Set(pcgenFiles)].map(
    (path) => `pcgen/${pcgenPin.directory}/${path}`,
  ),
]);
afterAll(() => tree.dispose());

const remaps: unknown = JSON.parse(
  await readFile('scripts/catalog/reviewed-remaps.json', 'utf8'),
);

/** Where a feature's description comes from. */
type TextSource =
  | { prd: string; lines: readonly number[] }
  | 'pcgen'
  | 'noMechanics';
type Feature = readonly [
  slug: string,
  pcgenName: string,
  classLevel: number,
  sourceSha256: string,
  text: TextSource,
];
type Archetype = {
  /** PCGen's name: the record is `Monk Archetype ~ <name>`, a feature `<name> ~ <feature>`. */
  name: string;
  slug: string;
  file: string;
  book: string;
  /** The rows the archetype's own text replaces, whole, in the mapper's order. */
  replaces: readonly (readonly [MonkRow, number])[];
  /** The root's record, when the root has review items to settle. */
  root?: { sourceSha256: string; resolves: { kind: string; id: string }[] };
  features: readonly Feature[];
};
const apg = (...lines: number[]) => ({ prd: apgPage, lines });
const uc = (...lines: number[]) => ({ prd: ucPage, lines });

/** The batch, as the boundary and report give it (archetype-structures-679.md). */
const batch: readonly Archetype[] = [
  {
    name: 'Flowing Monk',
    slug: 'flowing-monk',
    file: UC,
    book: 'PZO1118',
    replaces: [
      ['bonusFeat', 1],
      ['stunningFist', 1],
      ['purityOfBody', 5],
      ['diamondBody', 11],
      ['fastMovement', 3],
      ['quiveringPalm', 15],
    ],
    root: {
      sourceSha256:
        'c0076ff1d8831fe48aec27e2f4489cf8a186a2d4a010b3e0b7fa121d55a86386',
      resolves: [{ kind: 'conflict', id: 'stackingGuard' }],
    },
    features: [
      [
        'bonus-feat',
        'Bonus Feat',
        1,
        'de69108e1d76384c977e7a0b03388f6a2f1d59c559fc7b6bb1b0ee00aed2bbd5',
        uc(352),
      ],
      [
        'redirection',
        'Redirection',
        1,
        '92cd253750f81e50359523d97f75383532ef322ba825686c76b97f665b5a2d5a',
        uc(353, 354),
      ],
      [
        'unbalancing-counter',
        'Unbalancing Counter',
        2,
        '8dd4b51e42e9f7a0557fe93f3b548b62af32fb83efe2a41049cfed4fb5680ace',
        uc(355),
      ],
      [
        'flowing-dodge',
        'Flowing Dodge',
        3,
        '716bcbb139301e37df494bd573f24fe3f077bdae83f2e08415d314f97be4f660',
        uc(356),
      ],
      [
        'elusive-target',
        'Elusive Target',
        5,
        '7b4d49147c923c8c19f90a8fa2caaba2ed0884ad4468b7df8a6a288f89a0efc9',
        uc(357),
      ],
      [
        'volley-spell',
        'Volley Spell',
        15,
        'b1b52f9a915b4ed844cb798511765ca3ed88fe305a51f12925bfd1493d67e024',
        uc(358),
      ],
    ],
  },
  {
    name: 'Hungry Ghost Monk',
    slug: 'hungry-ghost-monk',
    file: APG,
    book: 'PZO1115',
    replaces: [
      ['stunningFist', 1],
      ['purityOfBody', 5],
      ['wholenessOfBody', 7],
      ['diamondBody', 11],
      ['diamondSoul', 13],
    ],
    features: [
      [
        'punishing-kick',
        'Punishing Kick',
        1,
        'e6958ee224858eeb129858ff501c750c006885fd6c9d62e5533cff15404f0180',
        apg(359),
      ],
      [
        'steal-ki',
        'Steal Ki',
        5,
        'b5976599fb8184f957d9952071b17f97caf03d0fc3ad2b41a556538599701c03',
        apg(360),
      ],
      [
        'life-funnel',
        'Life Funnel',
        7,
        'aacb61949278b6538a83b3778d99577c3828fdb6198d0368201b5edb58280a36',
        apg(361),
      ],
      [
        'life-from-a-stone',
        'Life from a Stone',
        11,
        'e9d59ef0f9e3210520fb09a0bf5ec0fd9515c0abdbea6bd6a75ad3f6d3e14abf',
        apg(362),
      ],
      [
        'sipping-demon',
        'Sipping Demon',
        13,
        'c5f2d9d3afacdafeb2b3b0d849f395475771ec796d9381c57495cba4451b774d',
        apg(363),
      ],
    ],
  },
  {
    name: 'Monk of the Four Winds',
    slug: 'monk-of-the-four-winds',
    file: APG,
    book: 'PZO1115',
    replaces: [
      ['stunningFist', 1],
      ['abundantStep', 12],
      ['perfectSelf', 20],
      ['timelessBody', 17],
    ],
    features: [
      [
        'elemental-fist',
        'Elemental Fist',
        1,
        '6d5b62791246a6482e7823d79679216f9531b3a145f2e6517df58872cd3c8e95',
        apg(381),
      ],
      [
        'slow-time',
        'Slow Time',
        12,
        '0862652b0970078675d7805749030743ce14da8a92277b0fde588bf76cfc8410',
        apg(382),
      ],
      [
        'aspect-master',
        'Aspect Master',
        17,
        '27731f21d300f0da515bb1db347f2733dff6470a4c97d266e99803c2075b8d84',
        apg(383),
      ],
      [
        'immortality',
        'Immortality',
        20,
        'adef33129716dbdfcdff0b51cbd77e26a48bf74199071efa4a159f07ae19a0c6',
        apg(390),
      ],
    ],
  },
  {
    name: 'Monk of the Healing Hand',
    slug: 'monk-of-the-healing-hand',
    file: APG,
    book: 'PZO1115',
    replaces: [
      ['wholenessOfBody', 7],
      ['diamondBody', 11],
      ['quiveringPalm', 15],
      ['perfectSelf', 20],
    ],
    features: [
      [
        'ancient-healing-hand',
        'Ancient Healing Hand',
        7,
        '393f316a9b7c172c1df798acc68c4d39aa61049663dc6fa25439043311726168',
        apg(393),
      ],
      [
        'ki-sacrifice',
        'Ki Sacrifice',
        11,
        '88c959c36daeb364c7b09984c2159efe64bc2fc35541110c4f5e98493aa64b29',
        apg(394),
      ],
      [
        'true-sacrifice',
        'True Sacrifice',
        20,
        '6caf36f6fcbc40b2adeb2a25faa9be98d35758b17c9df8768e4ce6004e437831',
        apg(395),
      ],
    ],
  },
  {
    name: 'Monk of the Lotus',
    slug: 'monk-of-the-lotus',
    file: APG,
    book: 'PZO1115',
    replaces: [
      ['stunningFist', 1],
      ['abundantStep', 12],
      ['quiveringPalm', 15],
      ['tongue', 17],
    ],
    features: [
      [
        'touch-of-serenity',
        'Touch of Serenity',
        1,
        'c1ff862f5f2f3db83b8440207a06da60728b49714316328780bbffff372a7972',
        apg(398),
      ],
      [
        'touch-of-surrender',
        'Touch of Surrender',
        12,
        '53e3b3d69abe5e4826bf3f9bb8df8098109024cd2f2441097639fd04187a57ee',
        apg(399),
      ],
      [
        'touch-of-peace',
        'Touch of Peace',
        15,
        '9d9c0a01d476c8b5b3ffc9aa5681fc02785c5061d4350930a10f948d7ad34981',
        apg(400),
      ],
      [
        'learned-master',
        'Learned Master',
        17,
        '1879e6ff612a622704ecfe9148537bfb816433e0b1b7e516ede6bc32e3c70ef5',
        apg(401),
      ],
    ],
  },
  {
    name: 'Monk of the Sacred Mountain',
    slug: 'monk-of-the-sacred-mountain',
    file: APG,
    book: 'PZO1115',
    replaces: [
      ['evasion', 2],
      ['slowFall', 4],
      ['highJump', 5],
      ['improvedEvasion', 9],
      ['tongue', 17],
    ],
    features: [
      [
        'iron-monk',
        'Iron Monk',
        2,
        '9958506c3f5f89f11ce90dfb82f67b1e1a756040e3f024a056d23f420ee9caf8',
        apg(404),
      ],
      [
        'bastion-stance',
        'Bastion Stance',
        4,
        '12a95dc3e75e6068c0d20b688ef6c2ff3e34e911d3ee91b141c5bc522e01ac94',
        apg(405),
      ],
      [
        'iron-limb-defense',
        'Iron Limb Defense',
        5,
        'fceb599d49ea4b6bbc945e78b8f3ef51e178792e9e98314bc641825ae83d87b7',
        apg(406),
      ],
      [
        'adamantine-monk',
        'Adamantine Monk',
        9,
        'e194e4bbbdda2fdb635617a0ebeeb541e10587e48b3dba1b1967120ff76cd1d5',
        apg(407),
      ],
      [
        'vow-of-silence',
        'Vow of Silence',
        17,
        'bd32c79094a13328be14dae977161a55dc7560ca3bebb6525e0afd2e5abb42f6',
        apg(408),
      ],
    ],
  },
  {
    name: 'Monk of the Seven Forms',
    slug: 'monk-of-the-seven-forms',
    file: ISC,
    book: 'PZO9268',
    replaces: [
      ['stunningFist', 1],
      ['maneuverTraining', 3],
      ['abundantStep', 12],
      ['quiveringPalm', 15],
    ],
    features: [
      [
        'bonus-feats',
        'Bonus Feats',
        1,
        '8d783719d864f9fa50d1e3b1ed8ce659c46d21aa63d84c0bf28c45837816e973',
        'pcgen',
      ],
      [
        'lightning-finish',
        'Lightning Finish',
        1,
        'cbf5bc29f38ec3b3741ed4f8b19c627115f778ac34c80f9962fa096f9b78d3d6',
        'pcgen',
      ],
      [
        'endurance',
        'Endurance',
        3,
        '01850c0abb7b4f917bdfef28414978f0f1a934025fa4214f60d607a1e9013792',
        'pcgen',
      ],
      // Complete, but with scanning errors no allowed source corrects.
      [
        'sirocco-fury',
        'Sirocco Fury',
        11,
        'b43b08f97c1cfbaec8c89399495fc15d920dd812cdf308b19cd6c25c9a698b34',
        'noMechanics',
      ],
    ],
  },
  {
    name: 'Weapon Adept',
    slug: 'weapon-adept',
    file: APG,
    book: 'PZO1115',
    replaces: [
      ['stunningFist', 1],
      ['evasion', 2],
      ['improvedEvasion', 9],
      ['timelessBody', 17],
      ['perfectSelf', 20],
    ],
    features: [
      [
        'perfect-strike',
        'Perfect Strike',
        1,
        '13c636edaac4800f0088d8926ce968a544272e3182f34c4b527247f74ad1a1e4',
        apg(411),
      ],
      [
        'way-of-the-weapon-master',
        'Way of the Weapon Master',
        2,
        '528f637aa23ad53a27c2c65cbba72348197e4a698f6823fa604b12ddb618586b',
        apg(412),
      ],
      [
        'evasion',
        'Evasion',
        9,
        '93030022268892d062ca5287adb010d8cb610f44d9ff7b046da79e87feb1dd4c',
        apg(413),
      ],
      [
        'uncanny-initiative',
        'Uncanny Initiative',
        17,
        '043017c0e2fe59b31a19fbd3faaa2d682a7093c2f8fdd4af8598bb72ff223745',
        apg(414),
      ],
      [
        'pure-power',
        'Pure Power',
        20,
        '26032f28187503f48d26b74c01d90768d0133ef4680039678d4038dc299f4783',
        apg(415),
      ],
    ],
  },
];
/** The three candidates left out, which keep their state. */
const leftOut = ['tetori', 'black-asp', 'treetop-monk'].map(
  (slug) => `everythingpath/monk-${slug}`,
);
const leftOutSelectors = [
  [UC, 'Tetori'],
  [UI, 'Black Asp'],
  [ARG, 'Treetop Monk'],
] as const;

const rootKey = ({ slug }: Archetype) => `everythingpath/monk-${slug}`;
const featureKey = (archetype: Archetype, [slug]: Feature) =>
  `${rootKey(archetype)}-${slug}`;
const locator = ({ file, name }: Archetype, [, pcgenName]: Feature) =>
  `pcgen:${file}#${name} ~ ${pcgenName}`;
const batchRows = batch.flatMap((archetype) => [
  { key: rootKey(archetype), book: archetype.book },
  ...archetype.features.map((feature) => ({
    key: featureKey(archetype, feature),
    book: archetype.book,
  })),
]);
const batchKeys = new Set(batchRows.map(({ key }) => key));

const ENTITIES: Record<string, string> = { mdash: '—', ndash: '–', amp: '&' };
/** A PRD feature's paragraphs as plain text: heading dropped, markup and entities read, spaces collapsed, joined by a space. */
async function prdText({
  prd,
  lines,
}: {
  prd: string;
  lines: readonly number[];
}) {
  const page = (await readPinned('prd', prd)).split('\n');
  return lines
    .map((line, index) => {
      let html = (page[line - 1] ?? '')
        .trim()
        .replace(/^<p[^>]*>/, '')
        .replace(/<\/p>$/, '');
      if (index === 0) html = html.replace(/^<b>.*?<\/b>\s*:?\s*/, '');
      return html
        .replace(/<[^>]+>/g, '')
        .replace(/&(\w+);/g, (match, name: string) => {
          const text = ENTITIES[name];
          if (text === undefined) throw new Error(`Unread entity ${match}`);
          return text;
        })
        .replace(/\s+/g, ' ')
        .trim();
    })
    .join(' ');
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
    ...(record.noMechanics ? { noMechanics: record.noMechanics } : {}),
    resolves: record.resolves,
    rationale: record.rationale,
    status: 'drafted',
  }),
);
/** The committed records with the one still drafted checked in memory (the record step's part). */
const checkedInMemory = committed.map(
  (record): StructureRecord =>
    record.status === 'checked'
      ? record
      : {
          ...record,
          status: 'checked',
          reviewedBy: 'in-memory check (archetype-structures-679.test.ts)',
          reviewedOn: '2026-11-17',
          receipt: `t3-review-${'0'.repeat(64)}`,
        },
);

const selected = new Set([
  ...batch.map(({ file, name }) => `${file}#Monk Archetype ~ ${name}`),
  ...leftOutSelectors.map(([file, name]) => `${file}#Monk Archetype ~ ${name}`),
]);
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
const checked = await emit(withStructures(checkedInMemory));
const baseOutcomes = outcomes(base);

/** A record as the table gives it, rationale aside. */
type Expected = {
  externalKey: string;
  sourceSha256: string;
  fields: Record<string, unknown>;
  noMechanics?: true;
  resolves: { kind: string; id: string }[];
};
/** The records the table gives. */
const expected = (
  await Promise.all(
    batch.map(
      async (archetype): Promise<Expected[]> => [
        ...(archetype.root
          ? [
              {
                externalKey: rootKey(archetype),
                sourceSha256: archetype.root.sourceSha256,
                fields: {
                  'detail.adds': archetype.features.map((feature) => ({
                    externalKey: featureKey(archetype, feature),
                    classLevel: feature[2],
                  })),
                  'detail.featureChanges': archetype.replaces.map(([name]) => ({
                    externalKey: row(name),
                    scope: 'whole',
                  })),
                  'detail.replaces': archetype.replaces.map(
                    ([name, classLevel]) => ({
                      externalKey: row(name),
                      classLevel,
                      scope: 'whole',
                    }),
                  ),
                },
                resolves: archetype.root.resolves,
              },
            ]
          : []),
        ...(await Promise.all(
          archetype.features.map(async (feature) => {
            const [, , , sourceSha256, text] = feature;
            const key = featureKey(archetype, feature);
            const description =
              text === 'pcgen'
                ? entryOf(base, key)?.description
                : text === 'noMechanics'
                  ? undefined
                  : await prdText(text);
            return {
              externalKey: key,
              sourceSha256,
              fields: description === undefined ? {} : { description },
              ...(text === 'noMechanics' ? { noMechanics: true as const } : {}),
              resolves: [
                { kind: 'ownedFeature', id: locator(archetype, feature) },
              ],
            };
          }),
        )),
      ],
    ),
  )
)
  .flat()
  .sort((a, b) => (a.externalKey < b.externalKey ? -1 : 1));

describe('the structure records of eight mechanical Monk archetypes (archetype-monk-1, #716)', () => {
  it('are committed with exactly the reviewed fields, items and source hashes: 36 checked by the record step, Flowing Monk’s Bonus Feat drafted', () => {
    expect(batchRows).toHaveLength(44);
    expect(
      committed.map((record) => ({
        externalKey: record.externalKey,
        sourceSha256: record.sourceSha256,
        fields: record.fields,
        ...(record.noMechanics ? { noMechanics: record.noMechanics } : {}),
        resolves: record.resolves,
        status: record.status === 'checked' ? record.receipt : record.status,
      })),
    ).toEqual(
      expected.map((record) => ({
        ...record,
        status: record.externalKey === bonusFeat ? 'drafted' : RECEIPT,
      })),
    );
    expect(
      (reviewedCuration.structures ?? []).filter(({ externalKey }) =>
        leftOut.some((key) => externalKey.startsWith(key)),
      ),
    ).toEqual([]);
  });

  it('as committed, the 36 checked records settle their gates and apply, and 42 rows are admitted under #227 on their declared books; Bonus Feat, drafted, stays held on structure and Flowing Monk is omitted behind it; no other key changes', () => {
    const report = asCommitted.structure;
    if (!report) throw new Error('No structure report');
    const bonusFeatLocator = `pcgen:${UC}#Flowing Monk ~ Bonus Feat`;
    expect({
      handReview: ours(report.handReview),
      unreviewedFeatures: ours(report.unreviewedFeatures),
      invalid: report.invalid,
      conflicts: ours(report.conflicts),
      stale: ours(report.stale),
      held: report.held.filter((key) => batchKeys.has(key)),
    }).toEqual({
      handReview: [],
      unreviewedFeatures: [
        {
          externalKey: bonusFeat,
          locator: bonusFeatLocator,
          owner: flowingMonk,
          sourceSha256:
            'de69108e1d76384c977e7a0b03388f6a2f1d59c559fc7b6bb1b0ee00aed2bbd5',
        },
      ],
      invalid: [],
      conflicts: [],
      stale: [],
      held: [bonusFeat],
    });
    expect(
      ours(report.applied)
        .map(({ externalKey }) => externalKey)
        .sort(),
    ).toEqual(
      expected
        .filter(
          (record) => !record.noMechanics && record.externalKey !== bonusFeat,
        )
        .map(({ externalKey }) => externalKey),
    );
    const after = outcomes(asCommitted);
    expect(after.get(bonusFeat)).toEqual({
      kind: 'held',
      reason: `Structure hand review (#716 plan §6): owned feature ${bonusFeatLocator}.`,
    });
    expect(after.get(flowingMonk)).toEqual({
      kind: 'dependentOmissions',
      reason: `Dependent omission: ${bonusFeat}.`,
    });
    for (const { key, book } of batchRows)
      if (key !== bonusFeat && key !== flowingMonk)
        expect(after.get(key), key).toEqual({
          kind: 'admitted',
          reason: `Admitted under #227: declared book ${book}.`,
        });
    for (const [key, outcome] of baseOutcomes)
      if (!batchKeys.has(key)) expect(after.get(key), key).toEqual(outcome);
    expect([...after.keys()].sort()).toEqual([...baseOutcomes.keys()].sort());
  });

  it('drafted in memory, change no key: every row stays held on structure or omitted behind a held feature', () => {
    expect(outcomes(drafted)).toEqual(baseOutcomes);
    expect(ours(drafted.structure?.applied ?? [])).toEqual([]);
    for (const archetype of batch) {
      for (const feature of archetype.features)
        expect(baseOutcomes.get(featureKey(archetype, feature))).toEqual({
          kind: 'held',
          reason: `Structure hand review (#716 plan §6): owned feature ${locator(archetype, feature)}.`,
        });
      expect(baseOutcomes.get(rootKey(archetype))?.kind, archetype.name).toBe(
        archetype.root ? 'held' : 'dependentOmissions',
      );
    }
  });

  it('checked in memory, settle every gate and apply, and admit all 44 rows under #227 on their declared books; no other key changes', () => {
    const report = checked.structure;
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
    // Every field record applies; the noMechanics disposition binds nothing.
    expect(
      ours(report.applied)
        .map(({ externalKey }) => externalKey)
        .sort(),
    ).toEqual(
      expected
        .filter((record) => !record.noMechanics)
        .map(({ externalKey }) => externalKey),
    );
    const after = outcomes(checked);
    for (const { key, book } of batchRows)
      expect(after.get(key), key).toEqual({
        kind: 'admitted',
        reason: `Admitted under #227: declared book ${book}.`,
      });
    for (const [key, outcome] of baseOutcomes)
      if (!batchKeys.has(key)) expect(after.get(key), key).toEqual(outcome);
    expect([...after.keys()].sort()).toEqual([...baseOutcomes.keys()].sort());
    for (const record of expected.filter(
      ({ fields }) => 'description' in fields,
    ))
      expect(
        entryOf(checked, record.externalKey),
        record.externalKey,
      ).toMatchObject({
        ...record.fields,
        detail: { kind: 'classFeature' },
        // No record gives a number on the sheet.
        modifiers: [],
      });
  });

  it('checked in memory, replace exactly the rows each archetype’s own text names, whole, and add its features at their levels', () => {
    for (const archetype of batch) {
      const detail = entryOf(checked, rootKey(archetype))?.detail;
      if (detail?.kind !== 'archetype') throw new Error(`No ${archetype.name}`);
      const byKey = (a: { externalKey: string }, b: { externalKey: string }) =>
        a.externalKey < b.externalKey ? -1 : 1;
      expect(
        {
          replaces: [...detail.replaces].sort(byKey),
          adds: [...detail.adds].sort(byKey),
        },
        archetype.name,
      ).toEqual({
        replaces: archetype.replaces
          .map(([name, classLevel]) => ({
            externalKey: row(name),
            classLevel,
            scope: 'whole',
          }))
          .sort(byKey),
        adds: archetype.features
          .map((feature) => ({
            externalKey: featureKey(archetype, feature),
            classLevel: feature[2],
          }))
          .sort(byKey),
      });
    }
  });
});
