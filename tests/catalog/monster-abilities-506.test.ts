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
  assessCatalogAdmission,
  buildAssessmentBinding,
  collectReferences,
} from '../../scripts/catalog/admission';
import type { PreviewEntry } from '../../scripts/catalog/map';
import { naturalAttackIds } from '../../scripts/catalog/inventory';
import { naturalAttackProfiles } from '../../src/lib/character-sheet-natural-attacks';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import {
  review,
  assessedAttacks,
  excludedFolders,
  excludedAbilities,
  preview,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/monster-abilities-506/data';
import { materializePinnedTree, readPinned } from './pinned-sources';
import {
  bindSnapshotToCurrentNotices,
  findCommittedBatchOwnershipProblems,
} from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
const SWARM_ATTACK = 'pf1/qP52Vv8OelEql6Oq';
const UNARMED_STRIKE = 'pf1/1sU57tRb1My6XZMC';
const DISTRACTION = 'pf1/WMwjQfyTC5BCoZlf';
const NATURAL_ATTACKS_PAGE = '8zivKFrhTVkbtjm3';
function candidate(name: string) {
  const row = assessedAttacks.find(
    (row) => row.externalKey === name || row.name === name,
  );
  if (!row) throw new Error(`Missing review of ${name}`);
  return row;
}
function entry(name: string) {
  const row = preview.entries.find(
    (row) => row.externalKey === name || row.name === name,
  );
  if (!row) throw new Error(`Missing entry ${name}`);
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
    const found = byKey.get(current);
    if (found) stack.push(...collectReferences(found));
  }
  return [...seen].sort();
}
const hasUnchained = (key: string) =>
  JSON.stringify(byKey.get(key) ?? {}).includes('"unchained"');
// The role and Medium damage of each generic natural attack, as its body and
// the linked Natural Attacks table state them (Bestiary p.301).
const NATURAL = {
  Bite: ['primary', '1d6', ['piercing', 'bludgeoning', 'slashing']],
  Claw: ['primary', '1d4', ['bludgeoning', 'slashing']],
  Gore: ['primary', '1d6', ['piercing']],
  Hoof: ['secondary', '1d4', ['bludgeoning']],
  Pincer: ['secondary', '1d6', ['bludgeoning']],
  Slam: ['primary', '1d4', ['bludgeoning']],
  Sting: ['primary', '1d4', ['piercing']],
  'Tail Slap': ['secondary', '1d6', ['bludgeoning']],
  Talon: ['primary', '1d4', ['slashing']],
  Tentacle: ['secondary', '1d4', ['bludgeoning']],
  Wing: ['secondary', '1d4', ['bludgeoning']],
} as const;
const PROFILE = {
  Bite: 'bite',
  Claw: 'claw',
  Gore: 'gore',
  Hoof: 'hoof',
  Pincer: 'pincer',
  Slam: 'slam',
  Sting: 'sting',
  'Tail Slap': 'tailSlap',
  Talon: 'talons',
  Tentacle: 'tentacle',
  Wing: 'wing',
} as const;

it('excludes the folders and Universal Monster Rules records by contract and holds the 13 attacks on named reasons', () => {
  expect(review.candidates).toHaveLength(42);
  expect(review.counts).toEqual({
    total: 42,
    admitted: 0,
    held: 13,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 29,
    excludedFolders: 4,
    excludedByImportContract: 25,
    recordLevel35Holds: 0,
  });
  expect(excludedFolders.map((row) => row.name).sort()).toEqual([
    'Creature Subtypes',
    'Creature Traits',
    'Natural Attacks',
    'Universal Monster Rules',
  ]);
  // The import contract admits exactly the 12 generic natural attacks and the
  // unarmed strike from the pack: the batch's 13 assessed records.
  expect(assessedAttacks.map((row) => row.externalKey.slice(4)).sort()).toEqual(
    [...naturalAttackIds].sort(),
  );
  for (const row of excludedAbilities) {
    expect(naturalAttackIds.has(row.externalKey.slice(4)), row.name).toBe(
      false,
    );
    expect(row.contractReason).toContain('generic natural/unarmed attacks');
  }
  for (const row of assessedAttacks)
    expect(
      [row.disposition, row.assessmentStatus, row.holdIds.length > 0],
      row.name,
    ).toEqual(['held', 'unresolved', true]);
  expect(
    Object.fromEntries(
      assessedAttacks.map((row) => [
        row.name,
        row.holdIds.map((id) =>
          id
            .replace('monster-abilities-506-', '')
            .replace(/-[A-Za-z0-9]{16}$/, ''),
        ),
      ]),
    ),
  ).toEqual({
    ...Object.fromEntries(
      Object.keys(NATURAL).map((name) => [
        name,
        ['broken-reference', 'uncited'],
      ]),
    ),
    'Swarm Attack': ['broken-reference', 'whole-content'],
    'Unarmed Strike': ['whole-content'],
  });
});

it('maps each natural attack as its body and the Natural Attacks table state it, and keeps the role a Note', () => {
  for (const [name, [role, dice, types]] of Object.entries(NATURAL)) {
    const row = entry(name);
    expect(row.detail.kind, name).toBe('item');
    const weapon = row.detail.kind === 'item' ? row.detail.weapon : undefined;
    expect(
      [
        weapon?.dice,
        [...(weapon?.damageTypes ?? [])].sort(),
        weapon?.threat,
        weapon?.mult,
      ],
      name,
    ).toEqual([dice, [...types].sort(), 20, 2]);
    // The sheet's own natural attack profile (Bestiary p.301) agrees with
    // the body on role, Medium dice and damage types.
    const profile =
      naturalAttackProfiles[PROFILE[name as keyof typeof PROFILE]];
    expect(
      [profile.role, profile.dice[4], [...profile.damageTypes].sort()],
      name,
    ).toEqual([role, dice, [...types].sort()]);
    // The importer maps no role (an outstanding calculation): the reviewed
    // Note on attack states it in the body's words.
    expect(weapon && 'naturalAttack' in weapon, name).toBe(false);
    const notes = row.situationalNotes ?? [];
    expect(notes[0]?.target, name).toBe('attack');
    expect(notes[0]?.text.startsWith(`A ${role} natural`), name).toBe(true);
    expect(
      candidate(name).mechanicsReview.outstandingCalculations[0],
    ).toContain('primary or secondary role');
  }
  expect(
    ['Bite', 'Claw'].map((name) => entry(name).situationalNotes?.[1]),
  ).toEqual([
    {
      target: 'damage',
      text: 'It deals bludgeoning, slashing or piercing damage, whichever is most beneficial one.',
    },
    {
      target: 'damage',
      text: 'It deals bludgeoning and slashing damage, whichever is most beneficial.',
    },
  ]);
  // Swarm attack: no fixed dice (damage by Hit Dice is a Note and an
  // outstanding calculation); the unarmed strike: 1d3 bludgeoning, light.
  const swarm = entry(SWARM_ATTACK);
  expect(swarm.detail.kind === 'item' && swarm.detail.weapon?.dice).toBeNull();
  expect(swarm.situationalNotes?.map((note) => note.target ?? null)).toEqual([
    'attack',
    'attack',
    'damage',
    'damage',
    null,
    null,
  ]);
  expect(swarm.situationalNotes?.[2]?.text).toBe(
    'The amount of damage a swarm deals is based on its Hit Dice: 1d6 at 1-5 HD, 2d6 at 6-10 HD, 3d6 at 11-15 HD, 4d6 at 16-20 HD and 5d6 at 21 or more HD.',
  );
  const unarmed = entry(UNARMED_STRIKE);
  expect(
    unarmed.detail.kind === 'item' && {
      dice: unarmed.detail.weapon?.dice,
      handedness: unarmed.detail.weapon?.handedness,
      damageTypes: unarmed.detail.weapon?.damageTypes,
    },
  ).toEqual({ dice: '1d3', handedness: 'light', damageTypes: ['bludgeoning'] });
  expect(unarmed.situationalNotes).toEqual([
    {
      target: 'damage',
      text: 'The damage from an unarmed strike is considered weapon damage for the purposes of effects that give you a bonus on weapon damage rolls.',
    },
    {
      target: 'attack',
      text: 'Unarmed strikes do not count as natural weapons (see Combat in core rulebook).',
    },
  ]);
  // No attack carries a Modifier.
  for (const row of preview.entries)
    expect(row.modifiers, row.name).toEqual([]);
});

it('checks one description record per attack against its pinned body', () => {
  for (const row of assessedAttacks) {
    const records = row.mechanicsReview.curationRecords;
    expect(
      records.map((record) => record.kind),
      row.name,
    ).toEqual(['description']);
    const [record] = records;
    expect(record?.status).toBe('checked');
    expect(record?.diagnostics).toEqual([]);
    expect(record?.reviewedBy).toBe('Opus (AI curator) for the owner');
    expect(record?.text).toBe(row.mechanicsReview.descriptionText);
    expect(record?.outputs.length, row.name).toBeGreaterThan(0);
    // Every Note is the body's own sentence, apart from the swarm's Hit
    // Dice table, restated row by row.
    const body = row.mechanicsReview.descriptionText
      .replace(/<[^>]+>/g, ' ')
      .replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, '$1')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ');
    for (const output of record?.outputs ?? []) {
      expect(output.kind).toBe('note');
      if (output.kind !== 'note' || output.text.includes('1d6 at 1-5 HD'))
        continue;
      for (const sentence of output.text.split(/(?<=\.) /))
        expect(body, `${row.name}: ${sentence}`).toContain(
          sentence.replace(/\.$/, ''),
        );
    }
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' ')).not.toContain(text);
  }
});

it('records the cited, linked, inherited and Unchained notice dependencies and enforces every hold', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  const holdId = (book: string) =>
    `monster-abilities-506-notice-${book}-complete-chain`;
  for (const row of assessedAttacks) {
    expect(row.requiredNotices[0], row.name).toBe('PZO1110');
    for (const cited of row.citedSources)
      expect(row.requiredNotices, row.name).toContain(cited.book);
    for (const comparison of [row.comparison, ...row.additionalComparisonLeads])
      if (comparison)
        expect(row.requiredNotices, row.name).toContain(comparison.book);
    for (const notice of row.inheritedRuleNotices)
      expect(row.requiredNotices, row.name).toContain(notice.book);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices.filter((book) => book !== 'PZO1110').map(holdId),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
    for (const id of row.holdIds)
      expect(id, row.name).toMatch(
        new RegExp(
          `^monster-abilities-506-[a-z-]+-${row.externalKey.split('/')[1]}$`,
        ),
      );
  }
  // Every attack keeps Unchained action-cost metadata on its own action, and
  // its closure is the entry alone: all 13 require the held PZO1131.
  for (const row of assessedAttacks) {
    expect(closureOf(row.externalKey), row.name).toEqual([row.externalKey]);
    expect(hasUnchained(row.externalKey), row.name).toBe(true);
  }
  expect(
    assessedAttacks
      .filter((row) => row.requiredNotices.includes('PZO1131'))
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual(assessedAttacks.map((row) => row.externalKey).sort());
  // The natural attacks require the earliest book of the Natural Attacks
  // rules they link (PZO1112, as #387); the swarm attack its cited Bestiary
  // and the distraction rule it restates; the unarmed strike only its cited
  // Core Rulebook beside PZO1131.
  expect(
    Object.fromEntries(
      assessedAttacks.map((row) => [row.name, row.requiredNotices]),
    ),
  ).toEqual({
    ...Object.fromEntries(
      Object.keys(NATURAL).map((name) => [
        name,
        ['PZO1110', 'PZO1112', 'PZO1131'],
      ]),
    ),
    'Swarm Attack': ['PZO1110', 'PZO1112', 'PZO1131'],
    'Unarmed Strike': ['PZO1110', 'PZO1131'],
  });
  for (const name of Object.keys(NATURAL))
    expect(
      candidate(name).inheritedRuleSourceEvidence.map((row) => [
        row.pageId,
        row.sources.map((source) => source.id).sort()[0],
      ]),
      name,
    ).toEqual([[NATURAL_ATTACKS_PAGE, 'PZO1112']]);
  expect(
    candidate(SWARM_ATTACK).linkedContentReview.map((row) => row.externalKey),
  ).toEqual([DISTRACTION]);
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
  // Each excluded Universal Monster Rules record names the earliest book it
  // or its journal page lists, by PCGen publication date, for the records
  // that grant it (as #387 and #541): darkvision PZO1127; low-light vision,
  // scent and blindsense PZO1112.
  const earliest = Object.fromEntries(
    excludedAbilities.map((row) => [
      row.name,
      row.earliestUniversalMonsterRulesBook.book,
    ]),
  );
  expect(earliest).toMatchObject({
    Darkvision: 'PZO1127',
    'Low-Light Vision': 'PZO1112',
    Scent: 'PZO1112',
    Blindsense: 'PZO1112',
    Amphibious: 'PZO1112',
    'Breath Weapon': 'PZO1112',
    Lifesense: 'PZO1116',
    Mistsight: 'PZO1126',
  });
});

it('pins all 42 keys, the complete bodies, linked records and literal PCGen evidence in the shared store', async () => {
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    42,
  );
  expect(preview.entries).toHaveLength(13);
  expect(preview.closure).toEqual([]);
  for (const row of review.candidates) {
    const bytes = await readPinned(row.source.repo, row.source.path);
    expect(sha(bytes), row.externalKey).toBe(row.source.sha256);
    const raw = upstreamRecord.parse(parse(bytes));
    expect(raw._id).toBe(row.externalKey.split('/')[1]);
    expect(raw.name).toBe(row.name);
    if (row.kind === 'folder') {
      expect(raw._key, row.name).toBe(`!folders!${raw._id}`);
      continue;
    }
    expect(raw._key).toBe(`!items!${raw._id}`);
    const description = sourceDescription(raw);
    expect(sha(description)).toBe(row.descriptionSha256);
    if (row.kind === 'monsterAbility') {
      expect(raw.type).toBe('feat');
      continue;
    }
    expect(raw.type).toBe('attack');
    expect(raw.system).toEqual(row.sourceFields);
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
    expect(entry(row.externalKey).sources).toEqual(row.citedSources);
    for (const linked of [
      ...row.linkedContentReview,
      ...row.inheritedRuleSourceEvidence,
    ])
      expect(sha(await readPinned(linked.repo, linked.path))).toBe(
        linked.sha256,
      );
  }
  // The Natural Attacks journal page lists PZO1112 p.301 among its books.
  const journal = parse(
    await readPinned(
      'pf1',
      'packs/rules/universal-monster-rules-umr.nBnUY0koBzXqoEft.yaml',
    ),
  ) as { pages: { _id: string; text: { content: string } }[] };
  expect(
    journal.pages.find((page) => page._id === NATURAL_ATTACKS_PAGE)?.text
      .content,
  ).toContain('@Source[PZO1112;pages=301]');
  const files = new Map(
    review.comparisonSources.pcgenFiles.map((file) => [file.path, file.sha256]),
  );
  for (const [path, digest] of files) {
    const bytes = await readFile(`tests/fixtures/pinned/pcgen/${path}`);
    expect(sha(bytes), path).toBe(digest);
  }
  for (const row of assessedAttacks)
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
  // The unarmed strike's Core Rulebook row states its statistics but none of
  // its body's rules (no DESC).
  const unarmed = candidate(UNARMED_STRIKE);
  expect(unarmed.comparison?.literalRow).toMatch(
    /^Unarmed Strike\t.*DAMAGE:1d3\t.*WIELD:Light/,
  );
  expect(unarmed.comparison?.literalRow).not.toContain('DESC:');
  // Each excluded record's earliest book cites its PCGen publication date.
  for (const row of excludedAbilities) {
    const { path, line, text, sha256 } = row.earliestUniversalMonsterRulesBook;
    expect(files.get(path), row.name).toBe(sha256);
    const lines = (
      await readFile(`tests/fixtures/pinned/pcgen/${path}`, 'utf8')
    ).split(/\r?\n/);
    expect(lines[line - 1]?.trim(), row.name).toBe(text);
  }
});

it('reextracts the attacks from a clean shared fixture tree, admits none, fails the swarm attack’s stripped link and holds the rest', async () => {
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
      descriptions: { checked: 13 },
    });
    expect(
      artifact.catalog.entries.map((row) => row.externalKey).sort(),
    ).toEqual(assessedAttacks.map((row) => row.externalKey).sort());
    for (const row of artifact.catalog.entries) {
      const saved = entry(row.externalKey);
      expect(
        {
          detail: row.detail,
          modifiers: row.modifiers,
          situationalNotes: row.situationalNotes,
          sources: row.sources,
          unsupported: row.unsupported,
        },
        row.name,
      ).toEqual({
        detail: saved.detail,
        modifiers: saved.modifiers,
        situationalNotes: saved.situationalNotes,
        sources: saved.sources,
        unsupported: saved.unsupported,
      });
    }
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
    const ours = new Set(assessedAttacks.map((row) => row.externalKey));
    const gate = assessCatalogAdmission({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    expect(gate.admitted.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    expect(
      gate.dependentOmissions.filter((row) => ours.has(row.externalKey)),
    ).toEqual([]);
    // #738 keeps the natural attacks' Natural Attacks journal link as text;
    // the swarm attack's Distraction link is still stripped, so the gate
    // fails it alone and holds the eleven natural attacks.
    expect(
      gate.failures
        .filter((row) => ours.has(row.externalKey))
        .map((row) => [row.externalKey, row.reason]),
    ).toEqual([
      [
        SWARM_ATTACK,
        'Broken structure or reference: unresolved imported reference.',
      ],
    ]);
    for (const row of preview.entries)
      expect(
        row.unsupported.some((item) => item.field === 'description.link'),
        row.name,
      ).toBe(row.externalKey === SWARM_ATTACK);
    const held = gate.held.filter((row) => ours.has(row.externalKey));
    expect(held.map((row) => [row.name, row.reason]).sort()).toEqual(
      assessedAttacks
        .filter((row) => row.externalKey !== SWARM_ATTACK)
        .map((row) => [row.name, candidate(row.externalKey).rationale])
        .sort(),
    );
    for (const row of assessedAttacks) {
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
    // Confirming the unarmed strike would still hold it on its notices
    // (PZO1131); a changed reviewed Note invalidates its binding.
    const confirmed = reviewedAdmission.assessments.map((row) =>
      row.externalKey === UNARMED_STRIKE
        ? { ...row, status: 'confirmed' as const }
        : row,
    );
    const again = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: confirmed,
    });
    // PZO1131 is reviewed (2026-10-30): its uncleared chain holds hold it.
    expect(
      again.held.find((row) => row.externalKey === UNARMED_STRIKE)?.reason,
    ).toMatch(/^Notice holds: PZO1131 \(/);
    const changed = {
      ...authoritative,
      catalog: {
        ...authoritative.catalog,
        entries: authoritative.catalog.entries.map((row) =>
          row.externalKey === UNARMED_STRIKE
            ? { ...row, situationalNotes: row.situationalNotes?.slice(0, 1) }
            : row,
        ),
      },
    };
    expect(
      assessCatalogAdmission({
        artifact: changed,
        ...reviewedAdmission,
        assessments: confirmed,
      }).held.find((row) => row.externalKey === UNARMED_STRIKE)?.reason,
    ).toContain('no longer matches current content');
  } finally {
    await tree.dispose();
  }
});

it("keeps the batch's own rows as its inventory records them", () => {
  expect(
    findCommittedBatchOwnershipProblems(
      'scripts/catalog/legal/monster-abilities-506.json',
    ),
  ).toEqual([]);
});
