// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import {
  upstreamRecord,
  sourceDescription,
} from '../../scripts/catalog/records';
import {
  buildAssessmentBinding,
  collectReferences,
} from '../../scripts/catalog/admission';
import type { PreviewEntry } from '../../scripts/catalog/map';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import { calculateCharacterSheet } from '../../src/lib/character-sheet';
import {
  animalCompanionTable,
  representativeAnimalCompanions,
} from '../../src/lib/catalog/representative-animal-companions';
import {
  review,
  preview,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/pf-companion-features-507/data';
import {
  companionSheet,
  druidCompanion,
  previewResource,
} from '../fixtures/pf-companion-features-507/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import {
  bindSnapshotToCurrentNotices,
  findCommittedBatchOwnershipProblems,
} from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
// The committed rows are the full-corpus preview's own output, checked by the
// imported entry schema, whose optional detail fields are wider than the
// importer's type; the binding code reads them as imported, as
// cross-batch-bindings.ts does.
function asPreviewEntries(rows: typeof preview.entries) {
  return rows as unknown as PreviewEntry[];
}
const resources = asPreviewEntries(preview.entries);
const closureEntries = asPreviewEntries(preview.closure);
function candidate(name: string) {
  const row = review.candidates.find((row) => row.name === name);
  if (!row) throw new Error(`Missing review of ${name}`);
  return row;
}
const CRA =
  'data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_abilities_companion.lst';
const UNCHAINED_HOLD =
  'pf-companion-features-507-notice-PZO1131-complete-chain';
const BESTIARY_HOLD = 'pf-companion-features-507-notice-PZO1112-complete-chain';
const LEVEL_HOLD = 'pf-companion-features-507-improved-evasion-level';
const FEATS_HOLD = 'pf-companion-features-507-whole-content-w8QhU9qZ4VXxO4Ij';
const TRICKS_HOLD = 'pf-companion-features-507-whole-content-I9aVgYTVbwwmdZYz';
const admittedNames = [
  'Devotion',
  'Ability Score Increase',
  'Share Spells',
  'Link',
  'STR/DEX Bonus',
  'Natural Armor Bonus',
];
const held: Record<string, [string, string[], string[], string[]]> = {
  'Improved Evasion': ['unresolved', ['PZO1110'], [LEVEL_HOLD], []],
  // Only its count and trick pool have PCGen text (Sol review, 2026-10-20).
  'Bonus Tricks': ['unresolved', ['PZO1110'], [TRICKS_HOLD], []],
  'Animal Companion': ['unresolved', ['PZO1110'], [LEVEL_HOLD], []],
  Evasion: ['confirmed', ['PZO1110', 'PZO1131'], [], [UNCHAINED_HOLD]],
  Multiattack: [
    'confirmed',
    ['PZO1110', 'PZO1112'],
    ['pf-companion-features-507-broken-reference-fZ8uC8TAnvzYp9YQ'],
    [BESTIARY_HOLD],
  ],
  'Animal Companion Feats': [
    'unresolved',
    ['PZO1110', 'PZO1131'],
    [FEATS_HOLD, 'pf-companion-features-507-broken-reference-w8QhU9qZ4VXxO4Ij'],
    [UNCHAINED_HOLD],
  ],
};
const byKey = new Map(
  [...resources, ...closureEntries].map((row) => [row.externalKey, row]),
);
function closureOf(key: string) {
  const seen = new Set<string>();
  const stack = [key];
  while (stack.length) {
    const current = stack.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    const entry = byKey.get(current);
    if (entry) stack.push(...collectReferences(entry));
  }
  return [...seen].sort();
}
const descOf = (row: string) =>
  row
    .split('\t')
    .find((cell) => cell.startsWith('DESC:'))
    ?.slice(5);
const plain = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/@(?:UUID|Compendium)\[[^\]]+\]\{([^}]*)\}/g, '$1')
    .replaceAll('&ldquo;', '"')
    .replaceAll('&rdquo;', '"')
    .replaceAll('“', '"')
    .replaceAll('”', '"');

it('admits six CRB animal companion features and holds six on named reasons', () => {
  expect(review.counts).toEqual({
    total: 12,
    admitted: 6,
    held: 6,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 0,
    excludedFolders: 0,
    recordLevel35Holds: 0,
  });
  for (const name of admittedNames)
    expect(candidate(name), name).toMatchObject({
      disposition: 'admitted',
      assessmentStatus: 'confirmed',
      requiredNotices: ['PZO1110'],
      holdIds: [],
      noticeHoldIds: [],
      // pf1-content records cite no source; PCGen's Core Rulebook rows do.
      citedSources: [],
    });
  for (const [name, [status, notices, holds, noticeHolds]] of Object.entries(
    held,
  ))
    expect(candidate(name), name).toMatchObject({
      disposition: 'held',
      assessmentStatus: status,
      requiredNotices: notices,
      holdIds: holds,
      noticeHoldIds: noticeHolds,
    });
  expect(
    review.candidates.filter((row) => row.disposition === 'held'),
  ).toHaveLength(Object.keys(held).length);
  // Every named hold is in the assessment's rationale.
  for (const row of review.candidates) {
    const assessment = reviewedAdmission.assessments.find(
      (a) => a.externalKey === row.externalKey,
    );
    expect(assessment?.status, row.name).toBe(row.assessmentStatus);
    for (const id of row.holdIds)
      expect(assessment?.rationale, row.name).toContain(id);
  }
  // Unchained action costs anywhere in the bound closure require PZO1131:
  // Evasion's own Use action, and Spring Attack and Combat Reflexes in Animal
  // Companion Feats' closure. The Animal Companion's classAssociations are
  // inert game content, not references, so its closure is the record alone.
  const unchained = Object.fromEntries(
    review.candidates.map((row) => [
      row.name,
      closureOf(row.externalKey).filter((key) =>
        JSON.stringify(byKey.get(key)).includes('"unchained"'),
      ),
    ]),
  );
  expect(
    Object.fromEntries(
      Object.entries(unchained).filter(([, keys]) => keys.length),
    ),
  ).toEqual({
    Evasion: ['pf1-content/Jcth45jjTCvvGBUS'],
    'Animal Companion Feats': ['pf1/h9nHYLxXvIXBTmup', 'pf1/ugQyUpqPBDsqLyra'],
  });
  expect(closureOf(candidate('Animal Companion').externalKey)).toEqual([
    'pf1-content/oczJR5oLDOOxV8mk',
  ]);
  for (const row of review.candidates)
    expect(row.requiredNotices.includes('PZO1131'), row.name).toBe(
      unchained[row.name]!.length > 0,
    );
  const registered = new Map(heldNotices.map((row) => [row.id, row]));
  const evidence = ['scripts/catalog/legal/pf-companion-features-507.json'];
  expect(registered.get(UNCHAINED_HOLD)).toEqual({
    id: UNCHAINED_HOLD,
    notices: [
      'PZO1131',
      'pf1-content/notice/6f81aca96be61467bd8a9bb23af4573934cd649d8e46fa10010f26fb105429f7',
    ],
    evidence,
  });
  expect(registered.get(BESTIARY_HOLD)).toEqual({
    id: BESTIARY_HOLD,
    notices: [
      'PZO1112',
      'pf1-content/notice/7b8bd4df6ed85ccfbf802a13d2060aec55ba16e32eccb6d7e4b3693c910b7e4c',
    ],
    evidence,
  });
  expect(
    review.noticeRequirements.map((row) => [
      row.book,
      row.holdId,
      row.candidates.length,
    ]),
  ).toEqual([
    ['PZO1110', null, 12],
    ['PZO1131', UNCHAINED_HOLD, 2],
    ['PZO1112', BESTIARY_HOLD, 1],
  ]);
  // Multiattack grants the Bestiary Multiattack feat (pinned pf1 record, p. 315).
  expect(
    candidate('Multiattack').inheritedRuleSourceEvidence.map((row) => [
      row.externalKey,
      row.sources,
    ]),
  ).toEqual([['pf1/RmhtvELGu73iR8yh', [{ id: 'PZO1112', pages: '315' }]]]);
});

it('pins all twelve complete records, checked bindings and literal Core Rulebook PCGen rows in the shared store', async () => {
  expect(preview.entries).toHaveLength(12);
  for (const row of review.candidates) {
    const bytes = await readPinned(row.source.repo, row.source.path);
    expect(sha(bytes), row.externalKey).toBe(row.source.sha256);
    const raw = upstreamRecord.parse(parse(bytes));
    expect(raw._id).toBe(row.externalKey.split('/')[1]);
    expect(raw.name).toBe(row.name);
    expect(raw.system).toEqual(row.sourceFields);
    expect(raw.system.sources ?? []).toEqual([]);
    const description = sourceDescription(raw);
    expect(sha(description)).toBe(row.descriptionSha256);
    expect(description).toBe(row.mechanicsReview.descriptionText);
    const [record] = row.mechanicsReview.curationRecords;
    expect(record).toMatchObject({
      kind: 'description',
      target: 'description',
      text: description,
      textSha256: sha(description),
      status: 'checked',
      diagnostics: [],
      reviewedBy: 'Opus (AI curator) for the owner',
      reviewedOn: '2026-10-20',
    });
    for (const reviewed of row.mechanicsReview.curationRecords)
      expect(
        reviewedCuration.records.find(
          (current) =>
            current.externalKey === row.externalKey &&
            current.kind === reviewed.kind &&
            current.target === reviewed.target &&
            current.textSha256 === reviewed.textSha256,
        ),
      ).toEqual(reviewed);
  }
  const files = new Map(
    review.comparisonSources.pcgenFiles.map((file) => [file.path, file.sha256]),
  );
  expect([...files.keys()]).toEqual([
    'data/pathfinder/paizo/roleplaying_game/core_essentials/ce_feats.lst',
    'data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_abilities_class.lst',
    CRA,
    'data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_classes_companion.lst',
    'data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_companionmods.lst',
    'data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_races_companion.lst',
    'data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_skills.lst',
  ]);
  for (const [path, digest] of files)
    expect(
      sha(await readFile(`tests/fixtures/pinned/pcgen/${path}`)),
      path,
    ).toBe(digest);
  const lines = async (path: string) =>
    (await readPinned('pcgen', path)).split(/\r?\n/);
  for (const row of review.candidates) {
    expect(row.comparison.book, row.name).toBe('PZO1110');
    for (const comparison of [
      row.comparison,
      ...row.additionalComparisonLeads,
      ...row.inheritedRuleComparisonEvidence,
    ]) {
      expect(files.get(comparison.path)).toBe(comparison.comparisonFileSha256);
      expect((await lines(comparison.path))[comparison.line - 1]).toBe(
        comparison.literalRow,
      );
      expect(sha(comparison.literalRow)).toBe(comparison.comparisonLineSha256);
      const { path, line, text } = comparison.publicationAnchor;
      expect(text).toBe(
        comparison.book === 'PZO1112'
          ? 'SOURCELONG:Bestiary'
          : 'SOURCELONG:Core Rulebook',
      );
      expect((await lines(path))[line - 1]?.split('\t')[0]).toBe(text);
    }
  }
  // Word-for-word bodies: Devotion and Multiattack exactly; Share Spells and
  // Link with the row's "master" for the body's "druid".
  const exact = (name: string) =>
    plain(candidate(name).mechanicsReview.descriptionText);
  const row = (name: string) => descOf(candidate(name).comparison.literalRow);
  expect(exact('Devotion')).toBe(row('Devotion'));
  expect(exact('Multiattack')).toBe(row('Multiattack'));
  for (const name of ['Share Spells', 'Link'])
    expect(
      exact(name)
        .replace('The druid', 'The master')
        .replace('A druid', 'A master'),
      name,
    ).toBe(row(name));
  // Improved Evasion: the same rule, the body omitting "normally"; its level
  // conflicts with PCGen's schedule (held).
  expect(exact('Improved Evasion')).toBe(
    `If your effective druid level is at least 15:${row('Improved Evasion')?.replace(' normally allows', ' allows')}`,
  );
  // Animal Companion Feats against PCGen's Core Rulebook animal companion feats.
  const block = (await lines(CRA))
    .slice(226, 255)
    .map((line) => line.split('\t')[0]!);
  expect(block).toHaveLength(29);
  const crb = block.map((name) =>
    name.replace(/ \((Light|Medium|Heavy)\)$/, ', $1'),
  );
  const listed = [
    ...candidate(
      'Animal Companion Feats',
    ).mechanicsReview.descriptionText.matchAll(/@UUID\[[^\]]+\]\{([^}]*)\}/g),
  ].map(([, name]) => name!);
  expect(listed).toHaveLength(42);
  expect(crb.filter((name) => !listed.includes(name))).toEqual([
    'Improved Natural Attack',
    'Weapon Finesse',
  ]);
  expect(listed.filter((name) => !crb.includes(name))).toEqual([
    'Devotion against the Unnatural',
    'Disruptive Companion',
    'Feral Grace',
    'Ferocious Beast',
    'Ferocious Feint',
    'Friendly Face',
    'Greater Tenacious Hunter',
    'Hefty Brute',
    'Improved Intercept Blow',
    'Intercept Blow',
    'Linnorm Hunter Style',
    'Linnorm Hunter Retreat',
    'Reflexive Interception',
    'Share Feature',
    'Tenacious Hunter',
  ]);
});

it('validates the Animal Companion schedule, Hit Dice and table through effective druid level 20 against the public companion progression', async () => {
  const root = candidate('Animal Companion');
  const source = root.sourceFields as {
    customHD: string;
    links: { classAssociations: { level: number; uuid: string }[] };
  };
  const fromLinks = source.links.classAssociations.map(({ level, uuid }) => [
    level,
    `pf1-content/${uuid.split('.').at(-1)}`,
  ]);
  const schedule = root.mechanicsReview.companionReview.schedule ?? [];
  expect(
    schedule.flatMap(({ masterLevel, features }) =>
      features.map((key) => [masterLevel, key]),
    ),
  ).toEqual(fromLinks);
  expect(fromLinks).toHaveLength(11);
  for (const row of review.candidates)
    if (row.name !== 'Animal Companion')
      expect(
        fromLinks.find(([, key]) => key === row.externalKey)?.[0],
        row.name,
      ).toBe(row.mechanicsReview.companionReview.masterLevel);
  // PCGen's Core Rulebook schedule agrees on every gated feature but
  // Improved Evasion (15 pinned, 16 in PCGen: held).
  const gates = Object.fromEntries(
    [
      ...((await readPinned('pcgen', CRA)).split(/\r?\n/)[45] ?? '').matchAll(
        /Animal Companion ~ ([^|]+)\|PREVARGTEQ:MasterLevel,(\d+)/g,
      ),
    ].map(([, name, level]) => [name, Number(level)]),
  );
  const names = new Map(
    preview.entries.map((row) => [row.externalKey, row.name]),
  );
  const pinnedLevel = (name: string) =>
    fromLinks.find(([, key]) => names.get(String(key)) === name)?.[0];
  for (const name of [
    'Bonus Tricks',
    'Link',
    'Share Spells',
    'Ability Score Increase',
    'Devotion',
    'Multiattack',
    'Evasion',
  ])
    expect(gates[name], name).toBe(pinnedLevel(name));
  expect([pinnedLevel('Improved Evasion'), gates['Improved Evasion']]).toEqual([
    15, 16,
  ]);
  expect(source.customHD).toBe('(round(@item.level * 0.75) + 1)');
  // The progression names exactly these features of the schedule.
  const named = new Map([
    ['Link', 'link'],
    ['Share Spells', 'share spells'],
    ['Evasion', 'evasion'],
    ['Devotion', 'devotion'],
    ['Multiattack', 'multiattack'],
    ['Improved Evasion', 'improved evasion'],
  ]);
  const wolf = representativeAnimalCompanions.wolf;
  for (let level = 1; level <= 20; level++) {
    const table = animalCompanionTable[level - 1]!;
    const result = calculateCharacterSheet(
      companionSheet(),
      druidCompanion(level),
    );
    const progression = result.companionProgression;
    expect(progression, `level ${level}`).toMatchObject({
      status: 'active',
      effectiveLevel: level,
      // The pinned customHD, round(level * 0.75) + 1.
      hitDice: Math.round(level * 0.75) + 1,
      // Bonus Tricks' floor(level / 3) + 1 and PCGen's 1 + level / 3.
      bonusTricks: Math.floor(level / 3) + 1,
    });
    // Ability Score Increase: PCGen's pool, one per 4 Hit Dice.
    const increases = [4, 9, 14, 20].filter((at) => at <= level).length;
    expect(progression?.budgets.abilityIncreases).toBe(increases);
    expect(increases).toBe(Math.floor((Math.round(level * 0.75) + 1) / 4));
    // Natural Armor Bonus and STR/DEX Bonus: the imported formulas and PCGen's.
    expect(table.naturalArmor).toBe(Math.floor(level / 3) * 2);
    expect(table.strengthDexterity).toBe(Math.floor(level / 3));
    const advanced = level >= wolf.advancement.level;
    expect(result.breakdowns['ac.natural'].total, `level ${level}`).toBe(
      wolf.naturalArmor +
        Math.floor(level / 3) * 2 +
        (advanced ? wolf.advancement.naturalArmor : 0),
    );
    expect(result.abilities.strength.score).toBe(
      wolf.scores.strength +
        Math.floor(level / 3) +
        (advanced ? wolf.advancement.scores.strength : 0),
    );
    expect(result.abilities.dexterity.score).toBe(
      wolf.scores.dexterity +
        Math.floor(level / 3) +
        (advanced ? wolf.advancement.scores.dexterity : 0),
    );
    expect(
      progression?.features.map((name) => name.toLowerCase()).sort(),
      `level ${level}`,
    ).toEqual(
      fromLinks
        .filter(([at]) => Number(at) <= level)
        .map(([, key]) => named.get(names.get(String(key)) ?? ''))
        .filter(Boolean)
        .sort(),
    );
  }
});

it("shows the reviewed Notes and Devotion's situational Will bonus on a companion sheet without changing any other statistic", () => {
  const side = [
    'Devotion',
    'Improved Evasion',
    'Evasion',
    'Share Spells',
    'Link',
    'Bonus Tricks',
    'Ability Score Increase',
    'STR/DEX Bonus',
    'Natural Armor Bonus',
  ];
  for (const row of preview.entries)
    expect(row.modifiers, row.name).toEqual(
      row.name === 'Devotion'
        ? [
            {
              target: 'save.will',
              bonusType: 'morale',
              value: 4,
              condition: { situation: 'enchantment' },
            },
          ]
        : [],
    );
  const totals = (result: ReturnType<typeof calculateCharacterSheet>) =>
    Object.fromEntries(
      Object.entries(result.breakdowns).map(([key, row]) => [key, row.total]),
    );
  const bare = calculateCharacterSheet(companionSheet(), druidCompanion(15));
  const reviewed = calculateCharacterSheet(
    companionSheet(side),
    druidCompanion(15),
  );
  expect(totals(reviewed)).toEqual(totals(bare));
  const enchanted = calculateCharacterSheet(companionSheet(side), {
    ...druidCompanion(15),
    situations: ['enchantment'],
  });
  // Devotion adds +4 morale to Will only while its Situation is selected.
  expect(enchanted.breakdowns['save.will'].total).toBe(
    bare.breakdowns['save.will'].total + 4,
  );
  const { 'save.will': _bareWill, ...bareRest } = totals(bare);
  const { 'save.will': _enchantedWill, ...enchantedRest } = totals(enchanted);
  expect(enchantedRest).toEqual(bareRest);
  expect(
    reviewed.breakdowns['save.ref'].notes?.map((note) => note.text),
  ).toEqual([
    'Improved evasion: against an attack that allows a Reflex save for half damage, the animal companion takes no damage on a successful save and half damage on a failed save.',
    'Evasion: against an attack that normally deals half damage on a successful Reflex save, the animal companion takes no damage on a successful save.',
  ]);
  expect(reviewed.entryNotes.map((note) => note.text)).toEqual(
    side
      .filter(
        (name) => !['Devotion', 'Improved Evasion', 'Evasion'].includes(name),
      )
      .map((name) => previewResource(name).situationalNotes?.[0]?.text),
  );
  // The imported Link note is the master's bonus: no Modifier on the
  // companion's Handle Animal.
  expect(candidate('Link').mechanicsReview.curationRecords[1]).toMatchObject({
    kind: 'note',
    target: 'skill.han',
    status: 'checked',
    outputs: [],
  });
  expect(reviewed.breakdowns['skill.han']?.total).toBe(
    bare.breakdowns['skill.han']?.total,
  );
  // Reviewed Notes replace Foundry inline rolls and worksheet fields.
  for (const row of preview.entries) {
    const text = (row.situationalNotes ?? [])
      .map((note) => note.text)
      .join('\n');
    expect(text, row.name).not.toMatch(
      /@UUID|@Compendium|\[\[|Tricks selected|<a /,
    );
  }
  expect(previewResource('Ability Score Increase').situationalNotes).toEqual([
    {
      text: 'The animal companion adds +1 to one of its ability scores for every 4 Hit Dice it gains.',
    },
  ]);
  expect(previewResource('STR/DEX Bonus').situationalNotes?.[0]?.text).toBe(
    "Str/Dex bonus: add effective druid level / 3 (rounded down) to the animal companion's Strength and Dexterity scores.",
  );
  // The imported changes stay unmapped: the progression calculates them.
  expect(
    Object.fromEntries(
      ['STR/DEX Bonus', 'Natural Armor Bonus', 'Multiattack'].map((name) => [
        name,
        previewResource(name)
          .unsupported.filter((row) => row.field === 'changes')
          .map((row) => (row.value as { target: string }).target),
      ]),
    ),
  ).toEqual({
    'STR/DEX Bonus': ['str', 'dex'],
    'Natural Armor Bonus': ['nac'],
    Multiattack: ['bonusFeats'],
  });
});

it('reextracts the resources from a clean shared fixture tree and enforces current bindings, holds and broken references', async () => {
  const tree = await materializePinnedTree(pinnedFiles, {
    sha256: pinnedSha256,
  });
  try {
    const artifact = await importCatalog({
      ...tree,
      remaps,
      curation: reviewedCuration,
      candidateKeys: review.candidates.map((row) => row.externalKey),
    });
    expect(artifact.catalog.entries).toEqual([]);
    expect(artifact.curation.passed).toBe(true);
    expect(artifact.curation.missing).toEqual([]);
    expect(artifact.curation.stale).toEqual([]);
    expect(artifact.curation.summary).toMatchObject({
      required: 4,
      checked: 4,
      descriptions: { candidates: 12, checked: 12 },
    });
    expect(artifact.catalog.resources).toHaveLength(12);
    for (const row of artifact.catalog.resources ?? []) {
      const saved = preview.entries.find(
        (entry) => entry.externalKey === row.externalKey,
      );
      expect({
        detail: row.detail,
        modifiers: row.modifiers,
        situationalNotes: row.situationalNotes,
        sources: row.sources,
      }).toEqual({
        detail: saved?.detail,
        modifiers: saved?.modifiers,
        situationalNotes: saved?.situationalNotes,
        sources: saved?.sources,
      });
    }
    // Gate the full-corpus snapshot: the batch's resources and their closure
    // (the feats Animal Companion Feats links) as the whole corpus has them.
    const authoritative = {
      ...artifact,
      catalog: { ...artifact.catalog, entries: closureEntries, resources },
    };
    const gate = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    const ours = new Set(review.candidates.map((row) => row.externalKey));
    const own = <T extends { externalKey: string }>(rows: T[]) =>
      rows.filter((row) => ours.has(row.externalKey));
    const name = (key: string) => names.get(key);
    const names = new Map(
      review.candidates.map((row) => [row.externalKey, row.name]),
    );
    expect(
      own(gate.admitted)
        .map((row) => row.name)
        .sort(),
    ).toEqual([...admittedNames].sort());
    expect(
      Object.fromEntries(own(gate.held).map((row) => [row.name, row.reason])),
    ).toEqual({
      'Improved Evasion': expect.stringContaining(LEVEL_HOLD),
      'Animal Companion': expect.stringContaining(LEVEL_HOLD),
      'Bonus Tricks': expect.stringContaining(TRICKS_HOLD),
      Evasion: expect.stringMatching(/^Notice holds: PZO1131 \(/),
    });
    // Both stripped wrong-pack links fail the gate as broken references.
    expect(
      own(gate.failures).map((row) => [name(row.externalKey), row.reason]),
    ).toEqual([
      [
        'Multiattack',
        'Broken structure or reference: unresolved imported reference.',
      ],
      [
        'Animal Companion Feats',
        'Broken structure or reference: unresolved imported reference.',
      ],
    ]);
    expect(
      resources
        .filter((row) =>
          ['Multiattack', 'Animal Companion Feats'].includes(row.name),
        )
        .map((row) => [
          row.name,
          row.unsupported
            .filter((item) => item.field === 'description.link')
            .map((item) => item.value),
        ]),
    ).toEqual([
      ['Multiattack', ['Compendium.pf-content.pf-feats.RmhtvELGu73iR8yh']],
      [
        'Animal Companion Feats',
        ['Compendium.pf-content.pf-feats.Item.n1wLrcwaqOSDqrOo'],
      ],
    ]);
    expect(own(gate.dependentOmissions)).toEqual([]);
    for (const row of review.candidates) {
      const assessment = reviewedAdmission.assessments.find(
        (a) => a.externalKey === row.externalKey,
      );
      expect(assessment).toMatchObject({
        status: row.assessmentStatus,
        ...bindSnapshotToCurrentNotices(row.currentBinding),
        requiredNotices: row.requiredNotices,
      });
      expect(
        buildAssessmentBinding({
          artifact: authoritative,
          entry: resources.find(
            (entry) => entry.externalKey === row.externalKey,
          )!,
          requiredNotices: row.requiredNotices,
          evidenceIds: [row.evidenceId],
          ...reviewedAdmission,
        }),
        row.name,
      ).toEqual(bindSnapshotToCurrentNotices(row.currentBinding));
    }
    // A changed admitted body invalidates its binding and is no longer admitted.
    const devotion = candidate('Devotion').externalKey;
    const edited = assessWithUnclearedHolds({
      artifact: {
        ...authoritative,
        catalog: {
          ...authoritative.catalog,
          resources: resources.map((row) =>
            row.externalKey === devotion ? { ...row, modifiers: [] } : row,
          ),
        },
      },
      ...reviewedAdmission,
    });
    expect(own(edited.admitted).map((row) => row.name)).not.toContain(
      'Devotion',
    );
    expect(own(edited.admitted)).toHaveLength(5);
  } finally {
    await tree.dispose();
  }
});

it('keeps its own description records, assessments, evidence and holds as recorded', () => {
  expect(
    findCommittedBatchOwnershipProblems(
      'scripts/catalog/legal/pf-companion-features-507.json',
    ),
  ).toEqual([]);
});

// Earlier batches cite Animal Companion (#351) and Devotion (#356) only as
// evidence; no entry in the committed full-corpus closure links a batch key.
it('is reached by no other entry of the committed closure', () => {
  const ours = new Set(review.candidates.map((row) => row.externalKey));
  expect(closureEntries).toHaveLength(41);
  expect(
    closureEntries
      .filter((row) => collectReferences(row).some((key) => ours.has(key)))
      .map((row) => row.externalKey),
  ).toEqual([]);
});
