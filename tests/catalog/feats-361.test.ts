// @vitest-environment node
import { recordedPrerequisiteFacts } from './prerequisite-audit-739';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import {
  upstreamRecord,
  sourceDescription,
} from '../../scripts/catalog/records';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
} from '../../scripts/catalog/admission';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import {
  modifierTargets,
  resolveSheet,
  calculateCharacterSheetProjections,
} from '../../src/lib/character-sheet';
import {
  review,
  preview,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/feats-361/data';
import { reviewedFeatSheet } from '../fixtures/feats-361/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { expectAutomaticSkillFocus } from './skill-focus-assertions';
import { assessWithUnclearedHolds } from './uncleared-holds';

const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
function entry(name: string) {
  const row = preview.entries.find((row) => row.name === name);
  if (!row) throw new Error(`Missing ${name}`);
  if (row.detail.kind !== 'feat') throw new Error('Expected feat');
  return { ...row, detail: row.detail };
}
function candidate(name: string) {
  const row = review.candidates.find((row) => row.name === name);
  if (!row) throw new Error(`Missing review of ${name}`);
  return row;
}
function modifiers(name: string, sheetEntryId = entry(name).externalKey) {
  const row = entry(name);
  return row.modifiers.map((raw) => ({
    ...outputSchema.options[0]
      .omit({ kind: true })
      .extend({ target: z.enum(modifierTargets) })
      .parse(raw),
    sheetEntryId,
    catalogEntryId: row.externalKey,
    source: row.externalKey,
    entryName: row.name,
    builtIn: false,
  }));
}
function situation(
  name: string,
  index = 0,
  sheetEntryId = entry(name).externalKey,
) {
  const scope = modifiers(name)[index]?.condition?.situation;
  if (typeof scope !== 'object' || !('local' in scope))
    throw new Error('Expected local Situation');
  return { ...scope, sheetEntryId };
}
// An unrelated entry's bonus of the given type, for stacking checks.
function other(
  row: ReturnType<typeof modifiers>[number],
  value: number,
  source = 'other-entry',
) {
  return {
    ...row,
    sheetEntryId: source,
    catalogEntryId: source,
    source,
    entryName: source,
    value,
    condition: undefined,
  };
}

const noRow = [
  'Frost Warrior',
  'Sense Metals and Minerals',
  'Mighty Boughs',
  'Ancient Tradition',
  "Vanth's Scythe",
  'Ineffable Count of the Clock',
  "Giant's Wallop",
  'Calculating Mind',
  'Buffeting Wings',
  'Rushing Winds',
  'Aboleth Deceiver',
  'Famine Tolerance',
  'Poison Resin',
  'Esoteric Transmutation',
  'Barracuda Slam',
  'Cunning',
  'Fiendish Serpent',
];

// #724: the rank threshold is automatic, read from Craft's recorded ranks.
it("resolves the admitted Skill Focus (Craft) from the chosen Craft's ranks only, without stacking copies", () => {
  const name = 'Skill Focus (Craft)';
  const rows = modifiers(name);
  expectAutomaticSkillFocus({ modifiers: rows, target: 'skill.crf' });
  expect(
    resolveSheet(rows, { skillRanks: { 'skill.crf': 10, 'skill.pro': 10 } })[
      'skill.pro'
    ].total,
  ).toBe(0);
  expect(candidate(name)).toMatchObject({
    disposition: 'admitted',
    assessmentStatus: 'confirmed',
    requiredNotices: ['PZO1110'],
    holdIds: [],
    noticeHoldIds: [],
    noticeRequirementsComplete: true,
  });
  expect(candidate(name).comparison).toMatchObject({
    book: 'PZO1110',
    completeDirectComparison: true,
    evidenceRole: 'complete-root-comparison',
  });
  expect(candidate(name).comparison?.literalRow).toContain(
    'BENEFIT:You get a +3 bonus on all checks involving the chosen skill. If you have 10 or more ranks in that skill, this bonus increases to +6.',
  );
  expect(
    candidate(name).inheritedRuleComparisonEvidence[0]?.literalRow,
  ).toMatch(/^Craft \(Alchemy\)\t.*TYPE:Intelligence\.Craft\.Base/);
  const [record] = candidate(name).mechanicsReview.curationRecords;
  expect(record?.diagnostics).toEqual([]);
  // No ranks and Intelligence 10: Skill Focus's +3 alone.
  expect(
    calculateCharacterSheetProjections(reviewedFeatSheet(name)).current
      .breakdowns['skill.crf'].total,
  ).toBe(3);
});

it('keeps exclusive rank, base attack bonus and completion branches to the strongest applicable bonus', () => {
  const beacon = modifiers('Spirit Beacon');
  expect(beacon.map((row) => [row.target, row.bonusType, row.value])).toEqual([
    ['skill.per', 'untyped', 1],
    ['skill.per', 'untyped', 2],
    ['skill.sen', 'untyped', 1],
    ['skill.sen', 'untyped', 2],
    ['ac', 'dodge', 1],
    ['save.will', 'insight', 1],
  ]);
  expect(resolveSheet(beacon)['skill.per'].total).toBe(0);
  const chosen = resolveSheet(beacon, {
    situations: [situation('Spirit Beacon'), situation('Spirit Beacon', 3)],
  });
  expect([chosen['skill.per'].total, chosen['skill.sen'].total]).toEqual([
    1, 2,
  ]);
  const defended = resolveSheet(beacon, {
    situations: [situation('Spirit Beacon', 4), situation('Spirit Beacon', 5)],
  });
  expect([
    defended['ac.other'].total,
    defended['save.will'].total,
    defended['save.fort'].total,
  ]).toEqual([1, 1, 0]);
  const phantom = modifiers('Vigilant Phantom');
  expect(
    resolveSheet(phantom, {
      situations: [
        situation('Vigilant Phantom'),
        situation('Vigilant Phantom', 1),
      ],
    })['skill.per'].total,
  ).toBe(8);
  expect(
    resolveSheet(phantom, {
      situations: [situation('Vigilant Phantom', 0, 'another-holder')],
    })['skill.per'].total,
  ).toBe(0);
  const snap = modifiers('Greater Snap Shot');
  expect(snap.map((row) => [row.target, row.value])).toEqual([
    ['damage.ranged', 2],
    ['damage.ranged', 4],
    ['damage.ranged', 6],
  ]);
  expect(
    resolveSheet(snap, {
      situations: [situation('Greater Snap Shot', 1)],
    })['damage.ranged'].total,
  ).toBe(4);
  expect(
    resolveSheet(snap, {
      situations: [situation('Greater Snap Shot', 1)],
    })['damage.melee'].total,
  ).toBe(0);
  const champion = modifiers('Champion');
  const challenge = resolveSheet(champion, {
    situations: [situation('Champion')],
  });
  expect([
    challenge['attack.melee'].total,
    challenge['attack.ranged'].total,
    challenge['ac.other'].total,
  ]).toEqual([1, 1, 1]);
  const completed = resolveSheet(champion, {
    situations: [
      situation('Champion'),
      situation('Champion', 1),
      situation('Champion', 2),
      situation('Champion', 3),
    ],
  });
  expect([
    completed['attack.melee'].total,
    completed['ac.other'].total,
  ]).toEqual([2, 2]);
  const ended = resolveSheet(champion, {
    situations: [situation('Champion', 4), situation('Champion', 5)],
  });
  expect([ended['attack.melee'].total, ended['ac.other'].total]).toEqual([
    -2, -2,
  ]);
  expect(
    calculateCharacterSheetProjections(reviewedFeatSheet('Champion')).current
      .breakdowns['attack.melee'].total,
  ).toBe(0);
});

it('uses the shared identifyMagicItems Situation, stacks Soulless Gaze tiers and adds the Deft Hands (Mythic) increment only', () => {
  const relic = modifiers('Relic Familiarity');
  expect(relic[1]?.condition?.situation).toBe('identifyMagicItems');
  expect(resolveSheet(relic)['skill.spl'].total).toBe(0);
  expect(
    resolveSheet(relic, { situations: ['identifyMagicItems'] })['skill.spl']
      .total,
  ).toBe(2);
  expect(
    resolveSheet(relic, { situations: [situation('Relic Familiarity')] })[
      'skill.apr'
    ].total,
  ).toBe(2);
  // Fox Trickery's Intelligence 19 condition keeps it off the shared Situation.
  const fox = modifiers('Fox Trickery');
  expect(resolveSheet(fox, { situations: ['dirtyTrick'] }).cmb.total).toBe(0);
  expect(
    resolveSheet(fox, { situations: [situation('Fox Trickery')] }).cmb.total,
  ).toBe(4);
  const gaze = modifiers('Soulless Gaze');
  expect(gaze.map((row) => [row.value, row.stacksWithinEntry])).toEqual([
    [2, undefined],
    [2, true],
  ]);
  expect(resolveSheet(gaze)['skill.int'].total).toBe(2);
  expect(
    resolveSheet(gaze, { situations: [situation('Soulless Gaze', 1)] })[
      'skill.int'
    ].total,
  ).toBe(4);
  const deft = modifiers('Deft Hands (Mythic)');
  expect(deft.map((row) => [row.target, row.value, row.condition])).toEqual([
    ['skill.dev', 2, undefined],
    ['skill.slt', 2, undefined],
  ]);
  // Deft Hands' own untyped +2 from its entry stacks to the restated +4.
  expect(
    resolveSheet([...deft, other(deft[0]!, 2, 'deft-hands')])['skill.dev']
      .total,
  ).toBe(4);
  expect(
    calculateCharacterSheetProjections(reviewedFeatSheet('Deft Hands (Mythic)'))
      .current.breakdowns['skill.slt'].total,
  ).toBe(2);
  expect(
    calculateCharacterSheetProjections(reviewedFeatSheet('Soulless Gaze'))
      .current.breakdowns['skill.int'].total,
  ).toBe(2);
});

it('routes shield, dodge and penalty Modifiers to their published scope', () => {
  const underfoot = resolveSheet(modifiers('Underfoot (BotB)'), {
    situations: [
      situation('Underfoot (BotB)'),
      situation('Underfoot (BotB)', 1),
    ],
  });
  expect([
    underfoot['ac.shield'].total,
    underfoot['attack.melee'].total,
  ]).toEqual([2, 2]);
  const sword = modifiers('Swordplay Style');
  // A shield bonus from another source does not stack with Swordplay Style.
  expect(
    resolveSheet([...sword, other(sword[0]!, 2)], {
      situations: [situation('Swordplay Style')],
    })['ac.shield'].total,
  ).toBe(2);
  expect(
    resolveSheet(modifiers('Stone Dodger'), {
      situations: [situation('Stone Dodger')],
    })['ac.other'].total,
  ).toBe(4);
  expect(
    resolveSheet(modifiers('Serpent Lash'), {
      situations: [situation('Serpent Lash')],
    }).cmb.total,
  ).toBe(-4);
  const shamed = resolveSheet(modifiers('Shamed'), {
    situations: [situation('Shamed')],
  });
  expect([
    shamed['attack.ranged'].total,
    shamed['skill.ste'].total,
    shamed['save.will'].total,
  ]).toEqual([1, 1, 0]);
  const associate = modifiers('Associate');
  expect(associate[0]?.bonusType).toBe('circumstance');
  const metals = resolveSheet(modifiers('Sense Metals and Minerals'), {
    situations: [
      situation('Sense Metals and Minerals'),
      situation('Sense Metals and Minerals', 1),
    ],
  });
  expect([metals['skill.per'].total, metals['skill.apr'].total]).toEqual([
    4, 4,
  ]);
});

it('keeps choice, dice, resource, speed, recipient and mythic-tier bodies off holder totals', () => {
  for (const name of [
    'Ancient Tradition',
    'Virtuous Creed',
    'Esoteric Transmutation',
    'Graceful Athlete',
    'Frost Warrior',
    'Gather Might',
    'Hands of Valor',
    'Beacon of Hope',
    'Tengu Wings',
    'Defensive Combat Training (Mythic)',
    'Cunning',
    'Expert Sniper',
    'Meditation Master',
    'Tenebrous Spell',
  ]) {
    expect(modifiers(name), name).toEqual([]);
    expect(entry(name).situationalNotes?.[0]?.text, name).toBeTruthy();
    expect(
      candidate(name).mechanicsReview.outstandingCalculations.length +
        candidate(name).mechanicsReview.proseOnlyRules.length,
      name,
    ).toBeGreaterThan(0);
  }
  expect(entry('Cunning').unsupported).toEqual([
    expect.objectContaining({ field: 'changes' }),
  ]);
  // #724: each Skill Focus has one automatic Modifier instead of two.
  expect(preview.entries.flatMap((row) => row.modifiers)).toHaveLength(35);
  expect(
    preview.entries.filter((row) => row.modifiers.length > 0),
  ).toHaveLength(16);
  expect(
    preview.entries.flatMap((row) =>
      row.modifiers.filter((modifier) =>
        ['casterLevel', 'spellDC', 'hp'].includes(modifier.target),
      ),
    ),
  ).toEqual([]);
});

it('records inherited-rule notices, alternate versions and enforced notice holds without inventing attribution', () => {
  const tricks = [
    'Greater Snap Shot',
    'Armored Athlete',
    'Surprise Follow-Through',
    'Improved Whip Mastery',
    'Bludgeoner',
    'Whip Mastery',
    'Coordinated Charge',
    'Intercept Charge',
  ];
  for (const name of tricks) {
    expect(candidate(name).requiredNotices, name).toContain('PZO1131');
    expect(candidate(name).inheritedRuleComparisonEvidence, name).toEqual([
      expect.objectContaining({
        evidenceRole: 'inherited-rule-comparison',
        appliesToRootBody: false,
      }),
    ]);
    expect(
      candidate(name).inheritedRuleComparisonEvidence[0]?.literalRow,
      name,
    ).toContain(`KEY:Combat Trick ~ ${name}`);
  }
  expect(candidate('Armored Athlete').requiredNotices).toEqual([
    'PZO9455',
    'PZO9467',
    'PZO1131',
    'PZO1110',
  ]);
  for (const name of [
    'Arcane Armor Training (Mythic)',
    'Defensive Combat Training (Mythic)',
    'Deft Hands (Mythic)',
  ])
    expect(candidate(name).requiredNotices, name).toEqual([
      'PZO1126',
      'PZO1110',
    ]);
  expect(candidate('Dastardly Finish (Mythic)').requiredNotices).toEqual([
    'PZO1126',
    'PZO1115',
    'PZO1110',
  ]);
  for (const name of ['Champion', 'Shamed'])
    expect(candidate(name).requiredNotices, name).toEqual([
      'PZO1125',
      'PZO1110',
    ]);
  for (const [name, book] of [
    ['Conditional Spell', 'PZO1134'],
    ['Serpent Lash', 'PZO9403'],
    ['Serpent Lash', 'PZO1115'],
    ['Fox Trickery', 'PZO1115'],
    ['Instant Judgment', 'PZO1115'],
    ['Eyes of Judgment', 'PZO1115'],
    ['Shielded Gauntlet Attack', 'PZO1129'],
    ['Swordplay Style', 'PZO1129'],
    ['Enduring Might', 'PZO1132'],
    ['Gather Might', 'PZO1132'],
    ['Overpowering Stare', 'PZO1132'],
    ['Cranial Implantation', 'PZO1117'],
    ['Ferocious Beast', 'PZO1117'],
    ['Fey Spell Lore', 'PZO1117'],
    ['Spirit Beacon', 'PZO1114'],
    ['Stone Dodger', 'PZO1118'],
    ['Exsanguinate', 'PZO1112'],
    ['Famine Tolerance', 'PZO1127'],
    ['Graceful Athlete', 'PZO1131'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Rejected versions' books are not required; the body does not cite them.
  for (const [name, root, rejected] of [
    ['Cypher Script', 'PZO1138', ['PZO9401', 'PZO9226']],
    ['Underfoot (BotB)', 'PZO9473', ['PZO1115']],
  ] as const) {
    expect(candidate(name).comparison?.book, name).toBe(root);
    expect(
      candidate(name).rejectedRootComparisonEvidence.map((row) => row.book),
      name,
    ).toEqual(rejected);
    for (const book of rejected)
      expect(candidate(name).requiredNotices, name).not.toContain(book);
  }
  expect(
    candidate('Spirit Beacon').additionalComparisonLeads.map(
      (row) => row.literalRow.split('\t')[0],
    ),
  ).toEqual(['Spirit Beacon (Undead)', 'Spirit Beacon (Outsiders)']);
  expect(candidate('Spirit Beacon').comparison?.literalRow).toMatch(
    /^Spirit Beacon \(Fey\)\t/,
  );
  expect(candidate('Vermin Heart').comparison?.literalRow).toMatch(
    /^Verminheart\t/,
  );
  expect(candidate('Enduring Might').comparison?.path).toContain(
    'martial_arts_handbook/support/',
  );
  for (const name of noRow) {
    expect(candidate(name).comparison, name).toBeNull();
    expect(candidate(name).inheritedRuleUnresolvedOrigins[0], name).toContain(
      'no PCGen row at the pin',
    );
  }
  expect(review.candidates.filter((row) => !row.comparison)).toHaveLength(
    noRow.length,
  );
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  for (const requirement of review.noticeRequirements) {
    if (requirement.book === 'PZO1110') {
      expect(requirement.holdId).toBeNull();
      continue;
    }
    expect(held.get(requirement.holdId ?? ''), requirement.book).toEqual([
      requirement.book,
      ...requirement.registryKeys,
    ]);
    for (const key of requirement.candidates)
      expect(
        review.candidates.find((row) => row.externalKey === key)?.noticeHoldIds,
      ).toContain(requirement.holdId);
  }
  for (const row of review.candidates)
    expect(row.holdIds, row.name).toEqual(
      row.name === 'Skill Focus (Craft)'
        ? []
        : [`feats-361-whole-content-${row.externalKey.split('/')[1]}`],
    );
});

it('retains recorded parser findings and checks current bounded or advisory clauses', () => {
  const kinds = (name: string) =>
    entry(name).prerequisites?.map((atom) =>
      'kind' in atom ? atom.kind : 'anyOf',
    );
  expect(kinds('Greater Snap Shot')).toEqual([
    'ability',
    'feat',
    'feat',
    'feat',
    'feat',
    'bab',
  ]);
  expect(kinds('Celestial Servant')).toEqual(['unchecked']);
  expect(kinds('Ferocious Beast')).toEqual(['skillRanks', 'unchecked']);
  expect(kinds('Juju Way')).toEqual(['skillRanks', 'unchecked']);
  for (const [name, gap] of [
    ['Greater Snap Shot', 'not to the Snap Shot feat'],
    ['Champion', 'five unchecked fragments'],
    ['Maddening Style', 'pinned Stunning Fist feat exists'],
    ['Armored Athlete', 'at "or"'],
    ['Spiritual Guardian', 'at "or"'],
    ['Vanguard Style', 'at "or"'],
    ['Worldwound Walker', '"5" and "more Hit Dice"'],
    ['Celestial Servant', 'needs only one of them'],
    ['Ferocious Beast', 'the companion takes the feat'],
    ['Juju Way', 'loses the Mwangi ethnicity restriction'],
    ['Potion Glutton', 'worshiper of Iomedae'],
    ['Human Spirit', '1st-level-only'],
  ] as const)
    expect(
      recordedPrerequisiteFacts({
        batch: 'feats-361',
        candidate: candidate(name),
      }),
      name,
    ).toEqual(expect.arrayContaining([expect.stringContaining(gap)]));
  for (const name of [
    'Spirit Beacon',
    'Armored Athlete',
    'Associate',
    'Distant Jinx',
    'Skill Focus (Craft)',
    'Virtuous Creed',
  ])
    expect(
      candidate(name).mechanicsReview.prerequisiteReview.repeatability,
      name,
    ).toContain('Special');
});
it('pins all 100 complete bodies, checked bindings and literal PCGen evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(review.counts).toMatchObject({
    admitted: 1,
    held: 99,
    dependentlyOmitted: 0,
    excluded: 0,
    recordLevel35Holds: 0,
  });
  expect(preview.entries).toHaveLength(100);
  for (const row of review.candidates) {
    const bytes = await readPinned(row.source.repo, row.source.path);
    expect(sha(bytes), row.externalKey).toBe(row.source.sha256);
    const raw = upstreamRecord.parse(parse(bytes));
    expect(raw._id).toBe(row.externalKey.split('/')[1]);
    expect(raw.name).toBe(row.name);
    expect(raw.system).toEqual(row.sourceFields);
    expect(row.sourceFields.tags).not.toContain('3.5');
    const description = sourceDescription(raw);
    expect(sha(description)).toBe(row.descriptionSha256);
    expect(description).toBe(row.mechanicsReview.descriptionText);
    const [record, ...rest] = row.mechanicsReview.curationRecords;
    const isSkillFocus = row.name === 'Skill Focus (Craft)';
    expect(rest).toEqual([]);
    expect(record).toMatchObject({
      kind: 'description',
      target: 'description',
      text: description,
      textSha256: sha(description),
      status: 'checked',
      diagnostics: [],
      // #724 re-reviewed the Skill Focus records' rank Modifiers on 2026-10-14.
      reviewedBy: 'Opus (AI curator) for the owner',
      reviewedOn: isSkillFocus ? '2026-10-14' : '2026-10-13',
    });
    expect(
      reviewedCuration.records.find(
        (current) =>
          current.externalKey === row.externalKey &&
          current.kind === record?.kind &&
          current.target === record.target &&
          current.textSha256 === record.textSha256,
      ),
    ).toEqual(record);
    expect(entry(row.name).sources).toEqual([]);
    expect(row.mechanicsReview.prerequisiteReview.normalizedAtoms).toEqual(
      entry(row.name).prerequisites ?? [],
    );
  }
  const files = new Map(
    review.comparisonSources.pcgenFiles.map((file) => [file.path, file.sha256]),
  );
  for (const [path, digest] of files) {
    const bytes = await readFile(`tests/fixtures/pinned/pcgen/${path}`);
    expect(sha(bytes), path).toBe(digest);
  }
  for (const row of review.candidates) {
    for (const comparison of [
      row.comparison,
      ...row.additionalComparisonLeads,
      ...row.rejectedRootComparisonEvidence,
      ...row.inheritedRuleComparisonEvidence,
    ]) {
      if (!comparison) continue;
      expect(files.get(comparison.path)).toBe(comparison.comparisonFileSha256);
      const lines = (
        await readFile(`tests/fixtures/pinned/pcgen/${comparison.path}`, 'utf8')
      ).split(/\r?\n/);
      expect(lines[comparison.line - 1]).toBe(comparison.literalRow);
      expect(sha(comparison.literalRow)).toBe(comparison.comparisonLineSha256);
      const { path, line, text, sha256 } = comparison.publicationAnchor;
      expect(files.get(path)).toBe(sha256);
      const publication = await readFile(
        `tests/fixtures/pinned/pcgen/${path}`,
        'utf8',
      );
      expect(publication.split(/\r?\n/)[line - 1]?.split('\t')[0]).toBe(text);
    }
  }
  // The Gloom Sight body equals its Advanced Race Guide row's benefit.
  expect(candidate('Gloom Sight').comparison?.literalRow).toContain(
    'BENEFIT:You gain darkvision 90 ft., but gain the light sensitivity weakness.',
  );
  expect(candidate('Gloom Sight').mechanicsReview.descriptionText).toContain(
    '<strong>Benefits</strong>: You gain darkvision 90 ft., but gain the light sensitivity weakness.',
  );
});

it('reextracts source-bound mechanics from a clean shared fixture tree and enforces current content and notice holds', async () => {
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
    expect(artifact.curation.passed).toBe(true);
    expect(artifact.curation.missing).toEqual([]);
    expect(artifact.curation.stale).toEqual([]);
    expect(artifact.curation.summary).toMatchObject({
      required: 0,
      checked: 0,
      descriptions: { candidates: 100, checked: 100 },
    });
    for (const row of artifact.catalog.entries) {
      const saved = entry(row.name);
      expect({
        description: row.description,
        modifiers: row.modifiers,
        situationalNotes: row.situationalNotes,
        sources: row.sources,
      }).toEqual({
        description: saved.description,
        modifiers: saved.modifiers,
        situationalNotes: saved.situationalNotes,
        sources: saved.sources,
      });
    }
    // The reduced tree cannot reproduce every whole-corpus prerequisite
    // identity; gate the full-source snapshot after reproducing its mechanics.
    const authoritative = {
      ...artifact,
      catalog: {
        ...artifact.catalog,
        entries: preview.entries.map((row) => {
          if (row.detail.kind !== 'feat') throw new Error('Expected feat');
          return { ...row, detail: row.detail };
        }),
      },
    };
    const gate = assessCatalogAdmission({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    expect(gate.admitted.map((row) => row.name)).toEqual([
      'Skill Focus (Craft)',
    ]);
    expect(gate.held).toHaveLength(99);
    expect(gate.dependentOmissions).toEqual([]);
    expect(gate.failures).toEqual([]);
    for (const row of gate.held)
      expect(row.reason, row.name).toMatch(/^feats-361-whole-content-/);
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
          entry: entry(row.name),
          requiredNotices: row.requiredNotices,
          evidenceIds: [row.evidenceId],
          ...reviewedAdmission,
        }),
      ).toEqual(bindSnapshotToCurrentNotices(row.currentBinding));
    }
    // A changed admitted body invalidates its binding and is no longer admitted.
    const craft = entry('Skill Focus (Craft)');
    const edited = assessCatalogAdmission({
      artifact: {
        ...authoritative,
        catalog: {
          ...authoritative.catalog,
          entries: authoritative.catalog.entries.map((row) =>
            row.externalKey === craft.externalKey
              ? { ...row, modifiers: row.modifiers.slice(1) }
              : row,
          ),
        },
      },
      ...reviewedAdmission,
    });
    expect(edited.admitted).toEqual([]);
    // Confirming a held body still holds it on its held notices.
    const confirm = (name: string) => {
      const key = candidate(name).externalKey;
      const result = assessWithUnclearedHolds({
        artifact: authoritative,
        ...reviewedAdmission,
        assessments: reviewedAdmission.assessments.map((row) =>
          row.externalKey === key
            ? { ...row, status: 'confirmed' as const }
            : row,
        ),
      });
      return { key, result };
    };
    const deft = confirm('Deft Hands (Mythic)');
    expect(
      deft.result.held.find((row) => row.externalKey === deft.key)?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
    expect(deft.result.admitted.map((row) => row.name)).toEqual([
      'Skill Focus (Craft)',
    ]);
    // A no-row body that needs only the reviewed CRB notice is kept out only
    // by its unresolved whole-content assessment; the admitted body stays.
    expect(candidate('Sense Metals and Minerals').requiredNotices).toEqual([
      'PZO1110',
    ]);
    const metals = confirm('Sense Metals and Minerals');
    expect(metals.result.admitted.map((row) => row.externalKey).sort()).toEqual(
      [craft.externalKey, metals.key].sort(),
    );
  } finally {
    await tree.dispose();
  }
});
