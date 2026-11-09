// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import { listCurationFormulaIssues } from '../../scripts/catalog/curation';
import {
  upstreamRecord,
  sourceDescription,
} from '../../scripts/catalog/records';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
  collectReferences,
} from '../../scripts/catalog/admission';
import type { PreviewEntry } from '../../scripts/catalog/map';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import {
  review,
  assessedBuffs,
  excludedRows,
  preview,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/buffs-547/data';
import {
  buffEntry,
  buffModifiers,
  buffSituations,
  total,
} from '../fixtures/buffs-547/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import {
  bindSnapshotToCurrentNotices,
  findCommittedBatchOwnershipProblems,
} from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
const FIGHTING_DEFENSIVELY = 'pf1/V8cRFtOQA6ltklEl';
const TOTAL_DEFENSE = 'pf1/DvcRWaWndZ1s2tB4';
const LESSER_AGE_RESISTANCE = 'pf1/8MI2BpO4ewblrCvp';
const VEEMOD_BLACK = 'pf1/G4KDVMpA5nH0r9sF';
const VEEMOD_POWERED_ARMOR = 'pf1/WRwcMIspQq9acUQW';
function candidate(name: string) {
  const row = assessedBuffs.find(
    (row) => row.externalKey === name || row.name === name,
  );
  if (!row) throw new Error(`Missing review of ${name}`);
  return row;
}
const asPreviewEntries = (rows: typeof preview.entries) =>
  rows as unknown as PreviewEntry[];
const byKey = new Map(
  asPreviewEntries([...preview.entries, ...preview.closure]).map((row) => [
    row.externalKey,
    row,
  ]),
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
const hasUnchained = (key: string) =>
  JSON.stringify(byKey.get(key) ?? {}).includes('"unchained"');
// The buffs whose own body or bound closure keeps Unchained action-cost
// metadata, so they require the held PZO1131: every Spell Effect through its
// Spell's action, the Unchained rage and stances and the class buffs whose
// class ability has an action, and the technology buffs through their items.
// Pinned by key from the full-corpus closures: every assessed buff but these
// three, whose closures keep none.
const WITHOUT_UNCHAINED = [
  'pf1/3p34GJemfcLdKckV', // Inspire Courage
  'pf1/DvcRWaWndZ1s2tB4', // Total Defense
  'pf1/V8cRFtOQA6ltklEl', // Fighting Defensively
];

it('excludes the eight folders, omits Inspire Courage and holds the rest on named reasons', () => {
  expect(review.candidates).toHaveLength(82);
  expect(review.counts).toEqual({
    total: 82,
    admitted: 0,
    held: 73,
    dependentlyOmitted: 1,
    unsupportedProseOnly: 0,
    excluded: 8,
    excludedFolders: 8,
    recordLevel35Holds: 0,
  });
  expect(excludedRows.map((row) => row.name).sort()).toEqual([
    'Alchemist',
    'Barbarian',
    'Bard',
    'Class Abilities',
    'Placeholder Buffs',
    'Spells',
    'Technology',
    'Witch',
  ]);
  expect(
    assessedBuffs
      .filter((row) => row.disposition !== 'held')
      .map((row) => [row.name, row.disposition]),
  ).toEqual([['Inspire Courage', 'dependently-omitted']]);
  // Fighting defensively's numbers have PCGen evidence, but its duration
  // ("until the start of your next turn") has none (Sol review, 2026-10-20).
  expect(candidate(FIGHTING_DEFENSIVELY)).toMatchObject({
    disposition: 'held',
    assessmentStatus: 'unresolved',
    requiredNotices: ['PZO1110'],
    holdIds: ['buffs-547-whole-content-V8cRFtOQA6ltklEl'],
    noticeHoldIds: [],
    closureDependencies: [],
  });
  // Each held buff names a content hold, a notice hold, or both.
  for (const row of assessedBuffs)
    if (row.disposition === 'held')
      expect(
        row.holdIds.length + row.noticeHoldIds.length,
        row.name,
      ).toBeGreaterThan(0);
  expect(
    Object.fromEntries(
      assessedBuffs
        .filter((row) => row.holdIds.length)
        .map((row) => [
          row.name,
          row.holdIds.map((id) =>
            id.replace('buffs-547-', '').replace(/-[A-Za-z0-9]{16}$/, ''),
          ),
        ]),
    ),
  ).toEqual({
    'Age Resistance, Lesser': ['broken-reference'],
    Bane: ['source-page'],
    Darkvision: ['uncited'],
    'Darkvision, Greater': ['uncited'],
    'Enlarge Person': ['whole-content'],
    'Fighting Defensively': ['whole-content'],
    'Filter Mask': ['whole-content'],
    'Force Field': ['whole-content'],
    'Invisibility, Greater': ['source-page'],
    Jetpack: ['whole-content'],
    Magboots: ['whole-content'],
    'Mutagen, Con': ['bonus-type'],
    'Mutagen, Dex': ['bonus-type'],
    'Mutagen, Str': ['bonus-type'],
    'Neraplast Armor': ['whole-content'],
    'Powered Armor': ['whole-content'],
    'Prayer (Negative)': ['whole-content'],
    'Reckless Stance': ['whole-content'],
    'Reduce Person': ['whole-content'],
    'Total Defense': ['whole-content'],
    'Veemod (Black)': ['whole-content'],
    'Veemod (Blue)': ['whole-content'],
    'Veemod (Brown)': ['whole-content'],
    'Veemod (Green)': ['whole-content'],
    'Veemod (Powered Armor)': ['whole-content'],
    'Veemod (Red)': ['whole-content'],
    'Veemod (White)': ['whole-content'],
  });
});

it('applies the reviewed Modifiers through the public resolver', () => {
  // Fighting defensively: -4 on attack rolls and +2 dodge to AC, +3 with 3 or
  // more Acrobatics ranks.
  const fd = buffModifiers('Fighting Defensively');
  for (const [ranks, ac] of [
    [0, 2],
    [2, 2],
    [3, 3],
    [10, 3],
  ] as const)
    expect(
      total(fd, 'ac.other', { skillRanks: { 'skill.acr': ranks } }),
      `${ranks}`,
    ).toBe(ac);
  expect(total(fd, 'attack.melee')).toBe(-4);
  expect(total(fd, 'attack.ranged')).toBe(-4);
  // Total defense: +4 dodge, +6 with 3 Acrobatics ranks; dodge bonuses stack,
  // so the sheet doesn't stop both being on (an outstanding calculation).
  const td = buffModifiers('Total Defense');
  expect(total(td, 'ac.other', { skillRanks: { 'skill.acr': 2 } })).toBe(4);
  expect(total(td, 'ac.other', { skillRanks: { 'skill.acr': 3 } })).toBe(6);
  expect(
    total([...td, ...fd], 'ac.other', { skillRanks: { 'skill.acr': 3 } }),
  ).toBe(9);
  // Caster-level formulas read the effect's recorded caster level.
  const cl = (name: string, target: Parameters<typeof total>[1]) =>
    [1, 3, 5, 6, 9, 11, 12, 18, 20].map((casterLevel) =>
      total(buffModifiers(name, { casterLevel }), target),
    );
  expect(cl('Shield of Faith', 'ac.other')).toEqual([
    2, 2, 2, 3, 3, 3, 4, 5, 5,
  ]);
  expect(cl('Divine Favor', 'attack.melee')).toEqual([
    1, 1, 1, 2, 3, 3, 3, 3, 3,
  ]);
  expect(cl('Divine Favor', 'damage.ranged')).toEqual([
    1, 1, 1, 2, 3, 3, 3, 3, 3,
  ]);
  expect(cl('Barkskin', 'ac.natural')).toEqual([2, 2, 2, 3, 4, 4, 5, 5, 5]);
  expect(cl('Fly', 'skill.fly')).toEqual([4, 5, 6, 7, 8, 9, 10, 13, 14]);
  // Armor and shield bonuses sit on their own AC leaves (#734).
  expect(total(buffModifiers('Mage Armor'), 'ac.armor')).toBe(4);
  expect(total(buffModifiers('Shield'), 'ac.shield')).toBe(4);
  expect(total(buffModifiers('Hard Light Shield'), 'ac.shield')).toBe(2);
  expect(total(buffModifiers('Mage Armor'), 'ac.other')).toBe(0);
  // Haste: +1 on attack rolls, +1 dodge to AC and Reflex.
  const haste = buffModifiers('Haste');
  expect(
    ['attack.melee', 'attack.ranged', 'ac.other', 'save.ref', 'save.fort'].map(
      (target) => total(haste, target as 'ac.other'),
    ),
  ).toEqual([1, 1, 1, 1, 0]);
  // Rage: +4 morale to Strength and Constitution and +2 on Will, raised at
  // barbarian level 11 and 20; -2 AC. Foundry's own formula gave +2 at 1st.
  for (const [level, ability, will] of [
    [1, 4, 2],
    [10, 4, 2],
    [11, 6, 3],
    [19, 6, 3],
    [20, 8, 4],
  ] as const) {
    const rows = buffModifiers('Rage');
    const options = { classLevels: { barbarian: level } };
    expect(
      [
        total(rows, 'ability.str', options),
        total(rows, 'ability.con', options),
        total(rows, 'save.will', options),
        total(rows, 'ac.other', options),
      ],
      `${level}`,
    ).toEqual([ability, ability, will, -2]);
  }
  // Unchained rage and its stances read the unchained barbarian's level;
  // calm stance cancels the rage's bonuses and AC penalty.
  const unchained = (level: number) => ({
    classLevels: { barbarianUnchained: level },
  });
  const rage = buffModifiers('Rage (Unchained)');
  for (const [level, bonus] of [
    [1, 2],
    [11, 3],
    [20, 4],
  ] as const) {
    expect(
      ['attack.melee', 'damage.melee', 'save.will', 'attack.ranged'].map(
        (target) => total(rage, target as 'save.will', unchained(level)),
      ),
    ).toEqual([bonus, bonus, bonus, 0]);
    const calm = [...rage, ...buffModifiers('Calm Stance')];
    expect(
      ['attack.melee', 'damage.melee', 'save.will', 'ac.other'].map((target) =>
        total(calm, target as 'save.will', unchained(level)),
      ),
    ).toEqual([0, 0, 0, 0]);
  }
  for (const [level, bonus] of [
    [1, 1],
    [4, 2],
    [8, 3],
    [20, 6],
  ] as const) {
    expect(
      total(buffModifiers('Accurate Stance'), 'attack.melee', unchained(level)),
    ).toBe(bonus);
    expect(
      total(buffModifiers('Guarded Stance'), 'ac.other', unchained(level)),
    ).toBe(bonus);
    expect(
      total(buffModifiers('Powerful Stance'), 'damage.melee', unchained(level)),
    ).toBe(bonus);
    expect(
      total(buffModifiers('Strength Stance'), 'cmd', unchained(level)),
    ).toBe(bonus);
    const reckless = buffModifiers('Reckless Stance');
    expect([
      total(reckless, 'attack.ranged', unchained(level)),
      total(reckless, 'ac.other', unchained(level)),
    ]).toEqual([bonus, -bonus]);
  }
  // Imported numbers that need no review.
  expect(total(buffModifiers("Bull's Strength"), 'ability.str')).toBe(4);
  expect(total(buffModifiers('Heroism, Greater'), 'skill.per')).toBe(4);
  expect(total(buffModifiers('Prayer (Negative)'), 'damage.melee')).toBe(-1);
  expect(total(buffModifiers('Dire Prophecy'), 'save.fort')).toBe(-4);
  // The reviewed change replacements: the black veemod's +10 becomes +2 and
  // the powered armor veemods' +5 becomes +10.
  expect(total(buffModifiers('Veemod (Black)'), 'skill.per')).toBe(2);
  expect(total(buffModifiers('Veemod (Powered Armor)'), 'skill.per')).toBe(10);
  expect(total(buffModifiers('Veemod (Green)'), 'skill.per')).toBe(10);
});

it('applies each situational Modifier only under its Situation, with the tiers mutually exclusive', () => {
  // Bless, aid and bane use the shared fear Situation on saves.
  for (const [name, value] of [
    ['Bless', 1],
    ['Aid', 1],
    ['Bane', -1],
  ] as const) {
    const rows = buffModifiers(name);
    expect(buffSituations(name), name).toEqual(['fear']);
    expect(total(rows, 'save.will'), name).toBe(0);
    expect(total(rows, 'save.will', { situations: ['fear'] }), name).toBe(
      value,
    );
  }
  // Inspire courage: one tier per performing bard level, each with its own
  // Situations; selecting one tier applies only that tier.
  const courage = buffModifiers('Inspire Courage');
  const courageScopes = buffSituations('Inspire Courage');
  expect(courageScopes).toHaveLength(8);
  expect(total(courage, 'attack.melee')).toBe(0);
  for (const tier of [1, 2, 3, 4]) {
    const scopes = courageScopes.filter(
      (scope) =>
        typeof scope !== 'string' &&
        scope.local.startsWith(`inspire courage +${tier} `),
    );
    expect(scopes, `${tier}`).toHaveLength(2);
    const [general, charmFear] = scopes;
    expect([
      total(courage, 'attack.melee', { situations: [general!] }),
      total(courage, 'damage.ranged', { situations: [general!] }),
      total(courage, 'save.will', { situations: [general!] }),
      total(courage, 'save.will', { situations: [charmFear!] }),
    ]).toEqual([tier, tier, 0, tier]);
  }
  // Ward: +2, +3 or +4 by the warding witch's level, on AC and saves.
  const ward = buffModifiers('Ward');
  const wardScopes = buffSituations('Ward');
  expect(wardScopes).toHaveLength(3);
  expect(total(ward, 'ac.other')).toBe(0);
  wardScopes.forEach((scope, index) =>
    expect([
      total(ward, 'ac.other', { situations: [scope] }),
      total(ward, 'save.ref', { situations: [scope] }),
    ]).toEqual([index + 2, index + 2]),
  );
  // Technology: magboots on Climb while climbing metal surfaces, the brown
  // veemod on saves against bright light; one Situation each.
  for (const [name, target, value] of [
    ['Magboots', 'skill.clm', 10],
    ['Veemod (Brown)', 'save.fort', 1],
  ] as const) {
    const rows = buffModifiers(name);
    const scopes = buffSituations(name);
    expect(scopes, name).toHaveLength(1);
    expect(total(rows, target), name).toBe(0);
    expect(total(rows, target, { situations: scopes }), name).toBe(value);
  }
});

it('checks every description and context-note record against the pinned bodies', () => {
  let descriptions = 0;
  let notes = 0;
  for (const row of assessedBuffs) {
    const records = row.mechanicsReview.curationRecords;
    expect(records[0]?.kind, row.name).toBe('description');
    for (const record of records) {
      expect(record.status, row.name).toBe('checked');
      expect(record.diagnostics, row.name).toEqual([]);
      expect(record.reviewedBy).toBe('Opus (AI curator) for the owner');
      expect(
        listCurationFormulaIssues({
          record,
          isSpellEffect: row.kind === 'spellEffect',
        }),
        row.name,
      ).toEqual([]);
      if (record.kind === 'description') {
        descriptions++;
        expect(record.text).toBe(row.mechanicsReview.descriptionText);
        if (!record.outputs.length)
          expect(record.rationale, row.name).toContain(
            'Explicit covered/no-output',
          );
      } else {
        notes++;
        expect(record.kind, row.name).toBe('note');
        expect(
          (row.sourceFields.contextNotes as { text: string }[]).map(
            (note) => note.text,
          ),
          row.name,
        ).toContain(record.text);
      }
    }
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
  }
  // One description record per buff (#759's ownership sweep) and every
  // required context-note record.
  expect(descriptions).toBe(74);
  expect(notes).toBe(19);
  // The reviewed Notes and Modifiers reach the imported entries.
  expect(buffEntry('Slow').situationalNotes?.map((note) => note.text)).toEqual([
    'You are staggered.',
    'You move at half speed (round down to the next 5-foot increment).',
  ]);
  expect(
    buffEntry('Knockdown Stance').situationalNotes?.map((note) => note.text),
  ).toEqual([
    "Once per round, you can make a trip attack against one target in place of a melee attack; it doesn't provoke an attack of opportunity.",
  ]);
});

it('records the cited, governing, inherited and Unchained notice dependencies and enforces every hold', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  const holdId = (book: string) => `buffs-547-notice-${book}-complete-chain`;
  for (const row of assessedBuffs) {
    expect(row.requiredNotices[0], row.name).toBe('PZO1110');
    for (const cited of row.citedSources)
      expect(row.requiredNotices, row.name).toContain(cited.book);
    for (const comparison of [row.comparison, ...row.additionalComparisonLeads])
      if (comparison)
        expect(row.requiredNotices, row.name).toContain(comparison.book);
    for (const notice of row.inheritedRuleNotices)
      expect(row.requiredNotices, row.name).toContain(notice.book);
    for (const linked of row.linkedContentReview)
      for (const book of linked.sources)
        expect(row.requiredNotices, row.name).toContain(book.id);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices.filter((book) => book !== 'PZO1110').map(holdId),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
    for (const id of row.holdIds)
      expect(id, row.name).toMatch(
        new RegExp(`^buffs-547-[a-z-]+-${row.externalKey.split('/')[1]}$`),
      );
  }
  // Unchained action-cost metadata anywhere in the full-corpus closure
  // requires the held PZO1131; the set is pinned by key.
  const unchained = assessedBuffs
    .filter((row) => closureOf(row.externalKey).some(hasUnchained))
    .map((row) => row.externalKey)
    .sort();
  expect(unchained).toHaveLength(71);
  expect(unchained).toEqual(
    assessedBuffs
      .map((row) => row.externalKey)
      .filter((key) => !WITHOUT_UNCHAINED.includes(key))
      .sort(),
  );
  expect(
    assessedBuffs
      .filter((row) => row.requiredNotices.includes('PZO1131'))
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual(unchained);
  // Monster abilities the effects grant: darkvision PZO1127, low-light vision
  // PZO1112, see in darkness PZO1116, all-around vision PZO1127.
  expect(
    Object.fromEntries(
      assessedBuffs
        .map(
          (row) =>
            [
              row.name,
              row.inheritedRuleNotices
                .filter((notice) => /monster|Monster Rules/.test(notice.rule))
                .map((notice) => notice.book),
            ] as const,
        )
        .filter(([, books]) => books.length),
    ),
  ).toEqual({
    Darkvision: ['PZO1127'],
    'Darkvision, Greater': ['PZO1127'],
    'Blessing of the Mole': ['PZO1127'],
    'Veemod (Red)': ['PZO1127'],
    'Veemod (Blue)': ['PZO1127'],
    'Veemod (Gray)': ['PZO1112'],
    'Veemod (Orange)': ['PZO1116'],
    'Veemod (Powered Armor)': ['PZO1112', 'PZO1127', 'PZO1127'],
  });
  // A Spell Effect's governing Spell is its spellKey (bar the unresolved
  // lesser age resistance) and the first linked body.
  for (const row of assessedBuffs.filter((row) => row.kind === 'spellEffect')) {
    const governing = row.linkedContentReview[0];
    expect(row.inheritedRuleSourceEvidence, row.name).toEqual([governing]);
    expect(row.mechanicsReview.effectReview.spellKey ?? null, row.name).toBe(
      row.externalKey === LESSER_AGE_RESISTANCE ? null : governing?.externalKey,
    );
  }
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

it('pins all 82 keys, the complete bodies, linked bodies and literal PCGen evidence in the shared store', async () => {
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    82,
  );
  for (const row of excludedRows) {
    const raw = upstreamRecord.parse(
      parse(await readPinned(row.source.repo, row.source.path)),
    );
    expect(raw._key, row.name).toBe(`!folders!${raw._id}`);
  }
  expect(preview.entries).toHaveLength(74);
  for (const row of review.candidates) {
    const bytes = await readPinned(row.source.repo, row.source.path);
    expect(sha(bytes), row.externalKey).toBe(row.source.sha256);
    const raw = upstreamRecord.parse(parse(bytes));
    expect(raw._id).toBe(row.externalKey.split('/')[1]);
    expect(raw.name).toBe(row.name);
    if (row.disposition === 'excluded') continue;
    expect(raw.system).toEqual(row.sourceFields);
    const description = sourceDescription(raw);
    expect(sha(description)).toBe(row.descriptionSha256);
    expect(description).toBe(row.mechanicsReview.descriptionText);
    for (const reviewed of row.mechanicsReview.curationRecords) {
      expect(sha(reviewed.text)).toBe(reviewed.textSha256);
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
    expect(buffEntry(row.externalKey).sources).toEqual(row.citedSources);
    for (const linked of row.linkedContentReview)
      expect(sha(await readPinned(linked.repo, linked.path)), linked.name).toBe(
        linked.sha256,
      );
  }
  const files = new Map(
    review.comparisonSources.pcgenFiles.map((file) => [file.path, file.sha256]),
  );
  for (const [path, digest] of files) {
    const bytes = await readFile(`tests/fixtures/pinned/pcgen/${path}`);
    expect(sha(bytes), path).toBe(digest);
  }
  for (const row of assessedBuffs)
    for (const comparison of [
      row.comparison,
      ...row.additionalComparisonLeads,
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
  // Fighting defensively's PCGen evidence: the Core Rulebook combat template,
  // the -4 attack penalty variable and the dodge bonus on AC.
  const fd = candidate(FIGHTING_DEFENSIVELY);
  expect(fd.comparison?.literalRow).toContain(
    'TEMPBONUS:ANYPC|VAR|FightingDefensivelyACBonus|1|TYPE=Temp2|PRESKILL:1,Acrobatics=3',
  );
  expect(fd.comparison?.publicationTitle).toBe('Core Rulebook');
  expect(fd.additionalComparisonLeads.map((row) => row.literalRow)).toEqual([
    expect.stringContaining(
      'BONUS:VAR|FightingDefensivelyAttackPenalty|4|TYPE=Base',
    ),
    expect.stringContaining(
      'BONUS:COMBAT|AC|max(FightingDefensivelyAC,TotalDefenseAC)|TYPE=Dodge',
    ),
  ]);
  // The reviewed change replacements are recorded with their evidence.
  expect(
    review.changeReplacements.map((row) => [
      row.externalKey,
      row.change,
      row.formula,
    ]),
  ).toEqual([
    [
      VEEMOD_BLACK,
      { target: 'skill.per', formula: '10', type: 'competence' },
      '2',
    ],
    [
      VEEMOD_POWERED_ARMOR,
      { target: 'skill.per', formula: '5', type: 'competence' },
      '10',
    ],
  ]);
});

it('reextracts the buffs from a clean shared fixture tree, admits none and holds all but Inspire Courage', async () => {
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
      required: 19,
      checked: 19,
      missing: 0,
      descriptions: { checked: 74 },
    });
    expect(
      artifact.catalog.entries.map((row) => row.externalKey).sort(),
    ).toEqual(assessedBuffs.map((row) => row.externalKey).sort());
    for (const row of artifact.catalog.entries) {
      const saved = buffEntry(row.externalKey);
      expect(
        {
          detail: row.detail,
          modifiers: row.modifiers,
          situationalNotes: row.situationalNotes,
          sources: row.sources,
        },
        row.name,
      ).toEqual({
        detail: saved.detail,
        modifiers: saved.modifiers,
        situationalNotes: saved.situationalNotes,
        sources: saved.sources,
      });
    }
    // The assessments are bound against the full-corpus content closure: the
    // committed entries and the entries their closures reach.
    const authoritative = {
      ...artifact,
      catalog: {
        ...artifact.catalog,
        entries: [
          ...preview.entries,
          ...preview.closure,
        ] as unknown as typeof artifact.catalog.entries,
      },
    };
    const ours = new Set(assessedBuffs.map((row) => row.externalKey));
    const gate = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    expect(
      gate.admitted
        .filter((row) => ours.has(row.externalKey))
        .map((row) => row.name),
    ).toEqual([]);
    expect(
      gate.failures
        .filter((row) => ours.has(row.externalKey))
        .map((row) => [row.externalKey, row.reason]),
    ).toEqual([
      [
        LESSER_AGE_RESISTANCE,
        'Broken structure or reference: unresolved imported reference.',
      ],
    ]);
    // Inspire Courage is supported and needs only the reviewed CRB notice, but
    // its governing class ability has no assessment yet.
    expect(
      gate.dependentOmissions
        .filter((row) => ours.has(row.externalKey))
        .map((row) => [row.name, row.reason]),
    ).toEqual([
      ['Inspire Courage', 'Dependent omission: pf1/h56K6HEBOItImPPL.'],
    ]);
    const held = gate.held.filter((row) => ours.has(row.externalKey));
    expect(held).toHaveLength(72);
    for (const row of held) {
      const reviewed = candidate(row.externalKey);
      if (reviewed.assessmentStatus === 'unresolved')
        expect(row.reason, row.name).toBe(reviewed.rationale);
      else
        expect(row.reason, row.name).toMatch(
          /^(Notice holds|Missing or unreviewed required notices): /,
        );
    }
    for (const row of assessedBuffs) {
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
          entry: authoritative.catalog.entries.find(
            (candidate) => candidate.externalKey === row.externalKey,
          )!,
          requiredNotices: row.requiredNotices,
          evidenceIds: [row.evidenceId],
          ...reviewedAdmission,
        }),
      ).toEqual(bindSnapshotToCurrentNotices(row.currentBinding));
    }
    // Confirming Fighting Defensively (only its duration lacks evidence)
    // would admit it on the reviewed CRB notice; a changed reviewed Modifier
    // then invalidates its binding, and the gate holds it again.
    const confirmed = reviewedAdmission.assessments.map((row) =>
      row.externalKey === FIGHTING_DEFENSIVELY
        ? { ...row, status: 'confirmed' as const }
        : row,
    );
    expect(
      assessCatalogAdmission({
        artifact: authoritative,
        ...reviewedAdmission,
        assessments: confirmed,
      })
        .admitted.filter((row) => ours.has(row.externalKey))
        .map((row) => row.name),
    ).toEqual(['Fighting Defensively']);
    const changed = {
      ...authoritative,
      catalog: {
        ...authoritative.catalog,
        entries: authoritative.catalog.entries.map((row) =>
          row.externalKey === FIGHTING_DEFENSIVELY
            ? { ...row, modifiers: row.modifiers.slice(0, 1) }
            : row,
        ),
      },
    };
    const stale = assessCatalogAdmission({
      artifact: changed,
      ...reviewedAdmission,
      assessments: confirmed,
    });
    expect(
      stale.held.find((row) => row.externalKey === FIGHTING_DEFENSIVELY)
        ?.reason,
    ).toContain('no longer matches current content');
    // Total defense's dodge bonus is supported, but its other rules aren't:
    // confirming it would admit it, so the hold is its own named reason.
    expect(candidate(TOTAL_DEFENSE).holdIds).toEqual([
      'buffs-547-whole-content-DvcRWaWndZ1s2tB4',
    ]);
  } finally {
    await tree.dispose();
  }
});

it("keeps the batch's own rows as its inventory records them", () => {
  expect(
    findCommittedBatchOwnershipProblems('scripts/catalog/legal/buffs-547.json'),
  ).toEqual([]);
});
