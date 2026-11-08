// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import { upstreamRecord, sourceBody } from '../../scripts/catalog/records';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
  collectReferences,
  computeFingerprint,
} from '../../scripts/catalog/admission';
import { readCompanionSource, pinnedCompanionBody } from './companion-source';
import { sanitizeDescription } from '../../scripts/catalog/sanitize';
import type { PreviewEntry } from '../../scripts/catalog/map';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { representativeAnimalCompanions } from '../../src/lib/catalog/representative-animal-companions';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import {
  review,
  preview,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/pf-companions-508/data';
import { materializePinnedTree, readPinned } from './pinned-sources';
import {
  bindSnapshotToCurrentNotices,
  findCommittedBatchOwnershipProblems,
} from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
const BALUCHITHERIUM = 'pf1-content/R410WuiWcnxbqEGQ';
const HIPPOPOTAMUS = 'pf1-content/0dheEWrsMf3PmJx7';
const WOLF = 'pf1-content/9gMnOdTPE6GA1DGi';
const HORSE = 'pf1-content/069F47e2x4CbT6s9';
const INA_LINK = 'Compendium.pf-content.pf-feats.Item.n1wLrcwaqOSDqrOo';
const BROKEN = 'Broken structure or reference: unresolved imported reference.';
function candidate(name: string) {
  const row = review.candidates.find(
    (row) => row.externalKey === name || row.name === name,
  );
  if (!row) throw new Error(`Missing review of ${name}`);
  return row;
}
function entry(key: string) {
  const row = preview.entries.find((row) => row.externalKey === key);
  if (!row) throw new Error(`Missing resource ${key}`);
  return row;
}
const byKey = new Map(
  ([...preview.entries, ...preview.closure] as unknown as PreviewEntry[]).map(
    (row) => [row.externalKey, row],
  ),
);
const hasUnchained = (key: string) =>
  JSON.stringify(byKey.get(key) ?? {}).includes('"unchained"');

// The holds #507 records on each record the companions embed a copy of.
const HELD_IN_507 = {
  'Animal Companion': ['pf-companion-features-507-improved-evasion-level'],
  'Bonus Tricks': ['pf-companion-features-507-whole-content-I9aVgYTVbwwmdZYz'],
  Link: [],
  'Natural Armor Bonus': [],
  'Share Spells': [],
  'STR/DEX Bonus': [],
  'Animal Companion Feats': [
    'pf-companion-features-507-whole-content-w8QhU9qZ4VXxO4Ij',
    'pf-companion-features-507-broken-reference-w8QhU9qZ4VXxO4Ij',
    'pf-companion-features-507-notice-PZO1131-complete-chain',
  ],
};
// The companions no PCGen companion row (or other permitted source) names.
const NO_PCGEN = [
  'Embolotherium',
  'Faerie Mount',
  'Gallerok',
  'Gliding Turtle',
  'Hobbe Hound',
  'Impaler Shrike',
  'Marax',
  'Mome Rath',
  'Pilo',
  'Ringhorn',
  'Sorico',
  'Switchback Jackal',
  'Warcat of Rull',
  'Yolubilis Heron',
];
// Every disagreement with the chosen PCGen version, by companion and field.
const CONFLICTS = {
  Cameroceras: ['speed'],
  Dimetrodon: ['startingAbilityScores'],
  'Dolphin, Orca': ['naturalArmor'],
  'Giant Caterpillar': ['speed'],
  'Giant Cockroach': ['speed'],
  'Goliath Grog': ['speed'],
  'Grizzly Bear': [
    'startingAbilityScores',
    'size',
    'naturalArmor',
    'advancementLevel',
  ],
  'Gulper Plant': ['startingAbilityScores'],
  Elephant: ['advancementLevel'],
  Hippopotamus: ['advancementSizeSteps'],
  Kangaroo: ['advancementSizeSteps'],
  'Megaprimatus (Ape)': ['speed'],
  Megalania: ['startingAbilityScores'],
  Pachycephalosaurus: ['startingAbilityScores'],
  Baluchitherium: ['startingAbilityScores'],
  Panda: ['startingAbilityScores'],
  'Snake, Constrictor': ['startingAbilityScores'],
  Spinosaurus: ['startingAbilityScores'],
  Stag: ['speed'],
};

it('holds all 100 companions on the broken embedded link and their whole content', () => {
  expect(review.candidates).toHaveLength(100);
  expect(review.counts).toEqual({
    total: 100,
    admitted: 0,
    held: 100,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 0,
    excludedFolders: 0,
    recordLevel35Holds: 0,
  });
  for (const row of review.candidates) {
    const id = row.externalKey.split('/')[1];
    expect(row.holdIds, row.name).toEqual([
      `pf-companions-508-broken-reference-${id}`,
      `pf-companions-508-whole-content-${id}`,
    ]);
    // The rationale names both holds and the #507 holds the embedded rules
    // carry.
    for (const hold of [
      ...row.holdIds,
      'pf-companion-features-507-improved-evasion-level',
      'pf-companion-features-507-whole-content-w8QhU9qZ4VXxO4Ij',
      'pf-companion-features-507-whole-content-I9aVgYTVbwwmdZYz',
    ])
      expect(row.rationale, row.name).toContain(hold);
  }
  expect(
    review.candidates
      .filter((row) => row.comparison === null)
      .map((row) => row.name)
      .sort(),
  ).toEqual(NO_PCGEN);
  for (const name of NO_PCGEN) {
    expect(candidate(name).missingEvidence).toContain('PCGen has no companion');
    expect(candidate(name).inheritedRuleUnresolvedOrigins).toHaveLength(1);
  }
});

it('maps each companion with its complete pinned body, scores, stripped link and embedded items, and no Modifier or Note', async () => {
  expect(preview.entries).toHaveLength(100);
  expect(preview.closure).toEqual([]);
  for (const row of review.candidates) {
    const resource = entry(row.externalKey);
    const review = row.mechanicsReview.companionReview;
    expect(resource.detail.kind, row.name).toBe('companion');
    expect(resource.pack).toBe('pf-companions');
    expect(resource.modifiers).toEqual([]);
    expect(resource.situationalNotes ?? []).toEqual([]);
    expect(resource.sources).toEqual([]);
    // The importer keeps the pinned ability scores (Foundry omits a 10).
    if (resource.detail.kind === 'companion')
      for (const [ability, score] of Object.entries(resource.detail.abilities))
        expect(
          review.structured.abilities[ability as 'str'],
          `${row.name} ${ability}`,
        ).toBe(score);
    // Its only stripped link is the embedded Animal Companion Feats copy's
    // wrong-pack Improved Natural Armor.
    expect(
      resource.unsupported
        .filter((issue) => issue.field === 'description.link')
        .map((issue) => issue.value),
      row.name,
    ).toEqual([INA_LINK]);
    expect(
      resource.unsupported.map((issue) => issue.field),
      row.name,
    ).toEqual(
      expect.arrayContaining([
        'companion',
        'gameContent',
        'description.link',
        'embeddedItems',
      ]),
    );
    const source = await readCompanionSource(row.externalKey);
    const body = pinnedCompanionBody(source.record);
    expect(resource.description, row.name).toBe(
      sanitizeDescription({ html: body, link: () => undefined }),
    );
    expect(sha(body), row.name).toBe(review.statBlockSha256);
    expect(review.statisticsField).toBe(
      row.externalKey === HIPPOPOTAMUS ? 'details.biography' : 'details.notes',
    );
    expect(resource.description).toContain('Base Stats');
    expect(resource.description).toContain('Advancement');
    // Its embedded Animal Companion class and features copy #507's records:
    // the same mechanics, and the same text but for whitespace and a heading.
    expect(review.embeddedCopies.map((copy) => copy.name)).toEqual([
      'Animal Companion',
      'Bonus Tricks',
      'Link',
      'Natural Armor Bonus',
      'Share Spells',
      'STR/DEX Bonus',
      'Animal Companion Feats',
    ]);
    // Each copy names the holds #507 records on its record: the Animal
    // Companion record, Bonus Tricks and Animal Companion Feats are held,
    // the other four admitted.
    expect(
      Object.fromEntries(
        review.embeddedCopies.map((copy) => [copy.name, copy.heldIn507]),
      ),
      row.name,
    ).toEqual(HELD_IN_507);
    expect(
      row.inheritedRuleSourceEvidence.map((linked) => linked.externalKey),
    ).toEqual([
      'pf1-content/oczJR5oLDOOxV8mk',
      'pf1-content/w8QhU9qZ4VXxO4Ij',
      'pf1-content/I9aVgYTVbwwmdZYz',
    ]);
    for (const copy of review.embeddedCopies) {
      expect(copy.sameMechanics, `${row.name} ${copy.name}`).toBe(true);
      expect(
        [copy.sameDescription, copy.descriptionDifference],
        `${row.name} ${copy.name}`,
      ).toContainEqual(
        copy.name === 'Animal Companion Feats'
          ? 'the copy adds the heading "Animal Feats"; the text is otherwise identical'
          : copy.name === 'Bonus Tricks' && !copy.sameDescription
            ? 'whitespace only'
            : true,
      );
    }
  }
});

it('binds one complete covered/no-output description judgment per companion', () => {
  expect(review.descriptionReview).toMatchObject({
    reviewedBy: 'Claude Opus 5.5 (independent Spec review for #763)',
    reviewedOn: '2026-10-27',
    reviewedCommit: 'be99c2635c5998b4815e0faff7ca033b12af0e10',
    reportSha256:
      '5670537554c3165d900eea6421c5de036f9b426572baf6bc61ff56f5aeff8bd8',
  });
  for (const row of review.candidates) {
    const records = row.mechanicsReview.curationRecords;
    expect(records.map((record) => record.kind)).toEqual(['description']);
    const [record] = records;
    if (!record)
      throw new Error(`Missing description judgment for ${row.name}`);
    expect(record).toMatchObject({
      status: 'checked',
      reviewedBy:
        row.externalKey === HIPPOPOTAMUS
          ? 'Opus (AI curator) for the owner'
          : 'Claude Opus 5.5 (independent Spec review for #763)',
      reviewedOn:
        row.externalKey === HIPPOPOTAMUS ? '2026-10-21' : '2026-10-27',
      outputs: [],
      diagnostics: [],
      text: row.mechanicsReview.descriptionText,
    });
    expect(record?.rationale).toContain('Explicit covered/no-output');
    expect(record?.rationale).toContain('#326');
    if (row.externalKey !== HIPPOPOTAMUS) {
      expect(record?.rationale).toContain('#763');
      expect(record?.text).toContain('Base Stats');
      expect(record?.text).toContain('Advancement');
      expect(row.mechanicsReview.descriptionReview).toBe('#/descriptionReview');
      const [history] = row.history ?? [];
      if (!history) throw new Error(`Missing previous binding for ${row.name}`);
      expect(row.history).toHaveLength(1);
      expect(history.previousDescriptionJudgment).toBe(
        '#/descriptionReviewHistory/0/previousDescriptionJudgment',
      );
      expect(history.previousBinding.contentFingerprint).toBe(
        computeFingerprint({
          [row.externalKey]: { ...entry(row.externalKey), description: '' },
        }),
      );
    } else {
      expect(row.history).toBeUndefined();
      expect(row.mechanicsReview.descriptionReview).toBeUndefined();
    }
    expect(row.mechanicsReview.reviewedBy).toBe(
      'Opus (AI curator) for the owner',
    );
    expect(row.mechanicsReview.reviewedOn).toBe('2026-10-21');
  }
});

it('records the companion, Bestiary, darkvision and Unchained notice dependencies and enforces every hold', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  for (const row of review.candidates) {
    const companion = row.mechanicsReview.companionReview;
    const chosen = companion.pcgen.filter((version) => version.chosen);
    expect(row.requiredNotices[0], row.name).toBe('PZO1110');
    expect(row.requiredNotices, row.name).toContain('PZO1112');
    for (const version of chosen)
      expect(row.requiredNotices, row.name).toContain(version.book);
    // Rejected alternate versions' books are not required.
    for (const version of companion.pcgen.filter((v) => !v.chosen))
      expect(row.requiredNotices, row.name).not.toContain(version.book);
    const darkvision = 'dv' in companion.structured.senses;
    expect(row.requiredNotices.includes('PZO1127'), row.name).toBe(
      darkvision || chosen.some((version) => version.book === 'PZO1127'),
    );
    // PZO1131 exactly where the record's own embedded attacks keep Unchained
    // action-cost metadata; its closure is the record alone.
    expect(collectReferences(byKey.get(row.externalKey)!), row.name).toEqual(
      [],
    );
    expect(row.requiredNotices.includes('PZO1131'), row.name).toBe(
      hasUnchained(row.externalKey),
    );
    expect(companion.unchainedActions.length > 0).toBe(
      hasUnchained(row.externalKey),
    );
    for (const notice of row.inheritedRuleNotices)
      expect(row.requiredNotices).toContain(notice.book);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `pf-companions-508-notice-${book}-complete-chain`),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  // Every companion but the attackless Baluchitherium requires PZO1131.
  expect(
    review.candidates
      .filter((row) => !row.requiredNotices.includes('PZO1131'))
      .map((row) => row.externalKey),
  ).toEqual([BALUCHITHERIUM]);
  expect(
    Object.fromEntries(
      review.noticeRequirements.map((row) => [row.book, row.candidates.length]),
    ),
  ).toEqual({
    PZO1110: 100,
    PZO1112: 100,
    PZO1116: 8,
    PZO1117: 4,
    PZO1120: 9,
    PZO1127: 20,
    PZO1130: 1,
    PZO1131: 99,
    PZO1133: 8,
    PZO1137: 2,
    PZO1140: 28,
    'PZO9000-6E': 1,
    PZO9268: 2,
  });
  for (const row of review.noticeRequirements) {
    if (row.book === 'PZO1110') {
      expect(row.holdId).toBeNull();
      continue;
    }
    expect(held.get(row.holdId ?? ''), row.book).toEqual([
      row.book,
      ...row.registryKeys.filter((key) => key !== row.book),
    ]);
    for (const key of row.candidates)
      expect(candidate(key).noticeHoldIds).toContain(row.holdId);
  }
});

it('validates each companion against its PCGen version, pinning every disagreement', () => {
  const conflicts: Record<string, string[]> = {};
  for (const row of review.candidates) {
    const companion = row.mechanicsReview.companionReview;
    // The stat block's base scores are the actor's.
    expect(companion.statBlockMatchesStructuredScores, row.name).toBe(true);
    expect([4, 7, 9]).toContain(companion.statBlock.advancementLevel);
    const chosen = companion.pcgen.filter((version) => version.chosen);
    expect(chosen.length > 0, row.name).toBe(!NO_PCGEN.includes(row.name));
    const fields = chosen.flatMap((version) =>
      version.checks
        .filter((check) => check.agrees === false)
        .map((check) => check.field),
    );
    if (fields.length) conflicts[row.name] = fields;
    for (const version of chosen) {
      // The size-change adjustments come from PCGen's game mode, outside the
      // pinned data set: never claimed as agreeing.
      const adjustments = version.checks.find(
        (check) => check.field === 'advancementAbilityAdjustments',
      );
      expect(adjustments?.agrees).toBeNull();
      expect(version.checks.map((check) => check.field)).toEqual([
        'startingAbilityScores',
        'size',
        'speed',
        'naturalArmor',
        'advancementLevel',
        'advancementSizeSteps',
        'advancementAbilityAdjustments',
      ]);
    }
  }
  expect(conflicts).toEqual(CONFLICTS);
  // Version decisions: the Hippogriff follows Inner Sea Combat (the Curse of
  // the Crimson Throne Player's Guide row disagrees); the Elk and the Giant
  // Vulture have two identical versions, both required.
  expect(
    Object.fromEntries(
      review.candidates
        .filter((row) => row.mechanicsReview.companionReview.pcgen.length > 1)
        .map((row) => [
          row.name,
          row.mechanicsReview.companionReview.versionDecision,
        ]),
    ),
  ).toEqual({
    Hippogriff:
      "Chosen: Inner Sea Combat; rejected: Curse of the Crimson Throne Player's Guide.",
    'Giant Vulture': 'Chosen: Bestiary 3, Monster Codex; rejected: none.',
    Elk: "Chosen: Kingmaker Player's Guide, Bestiary 3; rejected: none.",
  });
  expect(candidate('Hippogriff').rejectedRootComparisonEvidence).toHaveLength(
    1,
  );
  // The Grizzly Bear's pinned statistics are not Ultimate Wilderness's.
  expect(
    candidate('Grizzly Bear')
      .mechanicsReview.companionReview.pcgen[0]?.checks.filter(
        (check) => check.agrees === false,
      )
      .map((check) => [check.field, check.pinned, check.pcgen]),
  ).toEqual([
    [
      'startingAbilityScores',
      { str: 15, dex: 15, con: 13, int: 2, wis: 12, cha: 6 },
      { str: 17, dex: 13, con: 13, int: 2, wis: 13, cha: 6 },
    ],
    ['size', 'S', 'M'],
    ['naturalArmor', 2, 1],
    ['advancementLevel', 4, 7],
  ]);
});

it('gives the wolf and the horse the starting statistics and advancement of the representative CRB species', () => {
  for (const [key, species] of [
    [WOLF, representativeAnimalCompanions.wolf],
    [HORSE, representativeAnimalCompanions.horse],
  ] as const) {
    const companion = candidate(key).mechanicsReview.companionReview;
    const { abilities, size, naturalAC } = companion.structured;
    expect({
      scores: {
        strength: abilities.str,
        dexterity: abilities.dex,
        constitution: abilities.con,
        intelligence: abilities.int,
        wisdom: abilities.wis,
        charisma: abilities.cha,
      },
      size: { med: 'medium', lg: 'large' }[size],
      naturalArmor: naturalAC,
    }).toEqual({
      scores: species.scores,
      size: species.size,
      naturalArmor: species.naturalArmor,
    });
    const advancement = companion.statBlock.advancement;
    const adjustments = Object.fromEntries(
      [...String(advancement.Ability).matchAll(/(Str|Dex|Con) ([+-]\d+)/g)].map(
        ([, ability, value]) => [ability, Number(value)],
      ),
    );
    expect({
      level: companion.statBlock.advancementLevel,
      naturalArmor: Number(advancement.AC),
      strength: adjustments.Str ?? 0,
      dexterity: adjustments.Dex ?? 0,
      constitution: adjustments.Con ?? 0,
    }).toEqual({
      level: species.advancement.level,
      naturalArmor: species.advancement.naturalArmor,
      ...species.advancement.scores,
    });
    expect(companion.representativeSpecies).toContain(
      'representative-animal-companions.ts',
    );
  }
});

it('pins the 100 records, the #507 records they copy and the literal PCGen rows in the shared store', async () => {
  for (const row of review.candidates) {
    const bytes = await readPinned(row.source.repo, row.source.path);
    expect(sha(bytes), row.externalKey).toBe(row.source.sha256);
    const raw = upstreamRecord.parse(parse(bytes));
    expect(raw._id).toBe(row.externalKey.split('/')[1]);
    expect(raw._key).toBe(`!actors!${raw._id}`);
    expect(raw.name).toBe(row.name);
    expect(raw.system).toEqual(row.sourceFields);
    const description = sourceBody({
      source: {
        repo: row.source.repo,
        pack: 'pf-companions',
        path: row.source.path,
        record: raw,
      },
    });
    expect(sha(description)).toBe(row.descriptionSha256);
    for (const reviewed of row.mechanicsReview.curationRecords)
      expect(
        reviewedCuration.records.find(
          (current) =>
            current.externalKey === row.externalKey &&
            current.kind === reviewed.kind &&
            current.textSha256 === reviewed.textSha256,
        ),
      ).toEqual(reviewed);
    for (const linked of row.inheritedRuleSourceEvidence)
      expect(sha(await readPinned(linked.repo, linked.path))).toBe(
        linked.sha256,
      );
  }
  const files = new Map(
    review.comparisonSources.pcgenFiles.map((file) => [file.path, file.sha256]),
  );
  for (const [path, digest] of files)
    expect(sha(await readPinned('pcgen', path)), path).toBe(digest);
  const lines = async (path: string) =>
    (await readPinned('pcgen', path)).split(/\r?\n/);
  for (const row of review.candidates)
    for (const comparison of [
      row.comparison,
      ...row.additionalComparisonLeads,
      ...row.rejectedRootComparisonEvidence,
    ]) {
      if (!comparison) continue;
      expect(files.get(comparison.path)).toBe(comparison.comparisonFileSha256);
      expect((await lines(comparison.path))[comparison.line - 1]).toBe(
        comparison.literalRow,
      );
      expect(sha(comparison.literalRow)).toBe(comparison.comparisonLineSha256);
      const { path, line, text, sha256 } = comparison.publicationAnchor;
      expect(files.get(path)).toBe(sha256);
      expect((await lines(path))[line - 1]?.split('\t')[0]).toBe(text);
      expect(text).toBe(`SOURCELONG:${comparison.publicationTitle}`);
    }
  // Book codes: each chosen PCGen title in Foundry's pinned book list.
  const sources = await readPinned(
    'pf1',
    review.comparisonSources.bookCodes.path,
  );
  expect(sha(sources)).toBe(review.comparisonSources.bookCodes.sha256);
  for (const row of review.candidates)
    if (row.comparison)
      expect(sources, row.name).toMatch(
        new RegExp(
          `_id: "${row.comparison.book}",\\s*\\n\\s*name: "${row.comparison.publicationTitle.replace(/^Bestiary$/, 'Bestiary [1]').replace(/[[\]]/g, '\\$&')}"`,
        ),
      );
  // The starting scores recomputed from the pinned rows: kit STAT plus the
  // race row's BONUS:STAT (the wolf's 11+2, 11+4, 11+4, 10-8, 10+2, 10-4).
  const wolf = candidate(WOLF);
  const race = wolf.comparison!.literalRow;
  const kit = wolf.additionalComparisonLeads.find((lead) =>
    lead.literalRow.startsWith('STAT:'),
  )!.literalRow;
  const base = Object.fromEntries(
    [...kit.matchAll(/(STR|DEX|CON|INT|WIS|CHA)=(\d+)/g)].map(([, s, v]) => [
      s,
      Number(v),
    ]),
  );
  for (const [, stat, value] of race.matchAll(
    /BONUS:STAT\|(STR|DEX|CON|INT|WIS|CHA)\|(-?\d+)/g,
  ))
    base[stat!] = (base[stat!] ?? 10) + Number(value);
  expect(base).toEqual({
    STR: 13,
    DEX: 15,
    CON: 15,
    INT: 2,
    WIS: 12,
    CHA: 6,
  });
  expect(race).toContain('PREVARGTEQ:MasterLevel,7');
});

it('reextracts the companions from a clean shared fixture tree, admits none and fails all 100 on the broken link', async () => {
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
    expect(artifact.curation.missing).toEqual([]);
    expect(artifact.curation.stale).toEqual([]);
    expect(artifact.curation.summary).toMatchObject({
      required: 0,
      missing: 0,
      descriptions: { candidates: 100, drafted: 0, checked: 100 },
    });
    expect(
      artifact.curation.applied.filter((row) => row.kind === 'description'),
    ).toHaveLength(100);
    const resources = artifact.catalog.resources ?? [];
    expect(resources.map((row) => row.externalKey).sort()).toEqual(
      review.candidates.map((row) => row.externalKey).sort(),
    );
    for (const row of resources) {
      const saved = entry(row.externalKey);
      for (const field of [
        'description',
        'detail',
        'modifiers',
        'situationalNotes',
        'sources',
        'unsupported',
      ] as const)
        expect(row[field], `${row.name} ${field}`).toEqual(saved[field]);
    }
    const authoritative = {
      ...artifact,
      catalog: {
        ...artifact.catalog,
        resources: preview.entries as unknown as typeof resources,
      },
    };
    const ours = new Set(review.candidates.map((row) => row.externalKey));
    const gate = assessCatalogAdmission({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    expect(gate.admitted.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    expect(
      gate.failures
        .filter((row) => ours.has(row.externalKey))
        .map((row) => row.reason),
    ).toEqual(Array(100).fill(BROKEN));
    for (const row of review.candidates) {
      const assessment = reviewedAdmission.assessments.find(
        (a) => a.externalKey === row.externalKey,
      );
      expect(assessment).toMatchObject({
        status: 'unresolved',
        ...bindSnapshotToCurrentNotices(row.currentBinding),
        requiredNotices: row.requiredNotices,
        rationale: row.rationale,
      });
      expect(
        buildAssessmentBinding({
          artifact: authoritative,
          entry: byKey.get(row.externalKey)!,
          requiredNotices: row.requiredNotices,
          evidenceIds: [row.evidenceId],
          ...reviewedAdmission,
        }),
      ).toEqual(bindSnapshotToCurrentNotices(row.currentBinding));
    }
    // Were the link resolved, the wolf would still be held on its whole
    // content; confirmed, it would be held on its notices; and a changed
    // resource no longer matches its binding.
    const withoutLink = (key: string) => ({
      ...authoritative,
      catalog: {
        ...authoritative.catalog,
        resources: authoritative.catalog.resources.map((row) =>
          row.externalKey === key
            ? {
                ...row,
                unsupported: row.unsupported.filter(
                  (issue) => issue.field !== 'description.link',
                ),
              }
            : row,
        ),
      },
    });
    const unlinked = withoutLink(WOLF);
    expect(
      assessCatalogAdmission({
        artifact: unlinked,
        ...reviewedAdmission,
      }).held.find((row) => row.externalKey === WOLF)?.reason,
    ).toBe(candidate(WOLF).rationale);
    // Confirmed and bound to the unlinked content, it is held on its
    // notices: the Bestiary's and the pending Unchained notice.
    const unlinkedBinding = buildAssessmentBinding({
      artifact: unlinked,
      entry: unlinked.catalog.resources.find(
        (row) => row.externalKey === WOLF,
      )!,
      requiredNotices: candidate(WOLF).requiredNotices,
      evidenceIds: [candidate(WOLF).evidenceId],
      ...reviewedAdmission,
    });
    const confirmed = reviewedAdmission.assessments.map((row) =>
      row.externalKey === WOLF
        ? { ...row, ...unlinkedBinding, status: 'confirmed' as const }
        : row,
    );
    expect(
      assessWithUnclearedHolds({
        artifact: unlinked,
        ...reviewedAdmission,
        assessments: confirmed,
      }).held.find((row) => row.externalKey === WOLF)?.reason,
    ).toMatch(/^Notice holds: PZO1112 \(.*\); PZO1131 \(/);
    const changed = {
      ...unlinked,
      catalog: {
        ...unlinked.catalog,
        resources: unlinked.catalog.resources.map((row) =>
          row.externalKey === WOLF
            ? { ...row, situationalNotes: [{ text: 'Changed.' }] }
            : row,
        ),
      },
    };
    expect(
      assessCatalogAdmission({
        artifact: changed,
        ...reviewedAdmission,
        assessments: confirmed,
      }).held.find((row) => row.externalKey === WOLF)?.reason,
    ).toContain('no longer matches current content');
  } finally {
    await tree.dispose();
  }
}, 120_000);

it("keeps the batch's own rows as its inventory records them", () => {
  expect(
    findCommittedBatchOwnershipProblems(
      'scripts/catalog/legal/pf-companions-508.json',
    ),
  ).toEqual([]);
});

it('pins the pinned fixture files the importer reads', async () => {
  // Each listed file exists in the store with its recorded digest.
  for (const file of pinnedFiles) {
    const [repo, ...path] = file.split('/');
    expect(sha(await readPinned(repo as 'pf1', path.join('/')))).toBe(
      pinnedSha256[file],
    );
  }
  // 100 companions, the three held #507 records and the 41 linked feats.
  expect(pinnedFiles).toHaveLength(144);
  await expect(
    readFile('tests/fixtures/pf-companions-508/preview.json', 'utf8'),
  ).resolves.toContain('"pf-companions"');
});
