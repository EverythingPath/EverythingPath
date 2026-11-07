// @vitest-environment node
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
  calculateCharacterSheet,
  modifierTargets,
  resolveSheet,
} from '../../src/lib/character-sheet';
import {
  review,
  assessedItems,
  excludedRows,
  preview,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/armors-and-shields-424/data';
import { armorSheet } from '../fixtures/armors-and-shields-424/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
const CHAIN_SHIRT = 'pf1/iGu21zy6QtroUZ4O';
const BUCKLER = 'pf1/gsE0PAOmCwivue5A';
const ADMITTED = [BUCKLER, CHAIN_SHIRT];
function entry(name: string) {
  const row = preview.entries.find(
    (row) => row.externalKey === name || row.name === name,
  );
  if (!row) throw new Error(`Missing ${name}`);
  if (row.detail.kind !== 'item' || !row.detail.armor)
    throw new Error('Expected armor or a shield');
  return { ...row, detail: row.detail, armor: row.detail.armor };
}
function candidate(name: string) {
  const row = assessedItems.find(
    (row) => row.externalKey === name || row.name === name,
  );
  if (!row) throw new Error(`Missing review of ${name}`);
  return row;
}
function modifiers(name: string) {
  const row = entry(name);
  return row.modifiers.map((raw) => ({
    ...outputSchema.options[0]
      .omit({ kind: true })
      .extend({ target: z.enum(modifierTargets) })
      .parse(raw),
    sheetEntryId: row.externalKey,
    catalogEntryId: row.externalKey,
    source: row.externalKey,
    entryName: row.name,
    builtIn: false,
  }));
}
// One resolved statistic of one entry's Modifiers, with its Situations selected.
type Situation = string | { local: string; sheetEntryId: string };
function resolved(name: string, target: string, selected = false) {
  const situations: Situation[] = [];
  if (selected)
    for (const row of modifiers(name)) {
      const scope = row.condition?.situation;
      if (!scope) continue;
      if (typeof scope === 'string') situations.push(scope);
      else if ('local' in scope)
        situations.push({
          local: scope.local,
          sheetEntryId: entry(name).externalKey,
        });
      else throw new Error('Expected a local Situation');
    }
  return resolveSheet(modifiers(name), { situations })[target as 'attack.melee']
    .total;
}
// Every record whose own action keeps Unchained action-cost metadata: the
// shields' Bash actions, the tower shield's total cover and Armor of Insults'
// once-a-day use; Armor of Insults also binds the confusion spell, whose
// action keeps it too.
const unchainedOwn = [
  'pf1/2fK608aSYU9QDmzw', // Heavy Steel Shield
  'pf1/3mQTIhwAaZgvJq12', // Tower Shield
  'pf1/6zjwZeZmhqmAFC82', // Heavy Wooden Shield
  'pf1/Lq7YjIXW1SfV4EKr', // Steel Snarlshield
  'pf1/OZHfmAh4i6Bkoun3', // Wooden Snarlshield
  'pf1/h8Jq6rEHJ8xc4SIn', // Steel Madu
  'pf1/iRB7ACzHf14VIk4M', // Light Steel Shield
  'pf1/inF1zaK0XoeTdBIc', // Dwarven War-Shield
  'pf1/kc4ZuOEIEx1ZlXgJ', // Leather Madu
  'pf1/l1qNkx4xGXelq6yY', // Light Wooden Shield
  'pf1/mDqCTp8wMKbSOo1x', // Klar
  'pf1/mcDNhbR4RQ5Z1ckQ', // Light Wooden Shield (Quickdraw)
  'pf1/olBieN7p2yJWgDW4', // Armor of Insults
  'pf1/z5iAeUTo3r6qlEfd', // Light Steel Shield (Quickdraw)
];
const unchainedBound = ['pf1/olBieN7p2yJWgDW4'];

it('resolves the admitted chain shirt and buckler, and a shield beside armor, through the public resolver', () => {
  // A proficient wearer with Dexterity 18: +4 armor, +1 shield, Dexterity
  // capped at +4, armor check penalties 2 + 1, spell failure 20% + 5%.
  const worn = calculateCharacterSheet(
    armorSheet({
      items: [CHAIN_SHIRT, BUCKLER],
      dexterity: 18,
      proficiencies: ['light', 'shield'],
    }),
  );
  expect(worn.breakdowns['ac.armor'].total).toBe(4);
  expect(worn.breakdowns['ac.shield'].total).toBe(1);
  expect(worn.derivedStatistics.ac.total).toBe(19);
  expect(worn.derivedStatistics.touchAc.total).toBe(14);
  expect(worn.equipment).toMatchObject({
    armorCheckPenalty: -3,
    spellFailure: 25,
    maxDexterityBonus: 4,
    nonproficiencyAttackPenalty: 0,
  });
  expect(worn.breakdowns['skill.clm'].total).toBe(-3);
  // Without the Proficiencies the armor check penalties reach attack rolls.
  const untrained = calculateCharacterSheet(
    armorSheet({ items: [CHAIN_SHIRT, BUCKLER], dexterity: 18 }),
  );
  expect(untrained.equipment.nonproficiencyAttackPenalty).toBe(-3);
  // The buckler's −1 applies only while its arm wields a weapon, never to a
  // bow or crossbow ("You can use a bow or crossbow without penalty while
  // carrying it"): one Situation for melee, one for other ranged weapons.
  expect(
    modifiers('Buckler').map((row) => [
      row.target,
      row.bonusType,
      row.value,
      JSON.stringify(row.condition?.situation),
    ]),
  ).toEqual([
    [
      'attack.melee',
      'untyped',
      -1,
      JSON.stringify({
        local:
          'while your buckler arm wields a melee weapon (an off-hand weapon, or helping to wield a two-handed weapon)',
      }),
    ],
    [
      'attack.ranged',
      'untyped',
      -1,
      JSON.stringify({
        local:
          'while your buckler arm wields a ranged weapon other than a bow or crossbow',
      }),
    ],
  ]);
  const buckler = (labels: string[]) =>
    resolveSheet(modifiers('Buckler'), {
      situations: labels.map((local) => ({
        local,
        sheetEntryId: BUCKLER,
      })),
    });
  const [melee, ranged] = modifiers('Buckler').map((row) => {
    const scope = row.condition?.situation;
    if (!scope || typeof scope === 'string' || !('local' in scope))
      throw new Error('Expected a local Situation');
    return scope.local;
  }) as [string, string];
  // Exempt: shooting a bow with the buckler worn selects no Situation, and
  // even with an off-hand melee weapon in the buckler arm the bow is untouched.
  expect(buckler([])['attack.ranged'].total).toBe(0);
  expect(buckler([melee])['attack.ranged'].total).toBe(0);
  // Penalised: an off-hand melee weapon, or another ranged weapon (such as an
  // off-hand thrown dagger), in the buckler arm.
  expect(buckler([melee])['attack.melee'].total).toBe(-1);
  expect(buckler([ranged])['attack.ranged'].total).toBe(-1);
  expect(buckler([ranged])['attack.melee'].total).toBe(0);
  // A held shield beside held armor: each bonus on its own leaf, so they add.
  const pair = calculateCharacterSheet(
    armorSheet({
      items: ['pf1/5TzaS38RPAx1oj9p', 'pf1/2fK608aSYU9QDmzw'],
      proficiencies: ['medium', 'shield'],
    }),
  );
  expect(pair.breakdowns['ac.armor'].total).toBe(6);
  expect(pair.breakdowns['ac.shield'].total).toBe(2);
  expect(pair.derivedStatistics.ac.total).toBe(18);
  // The tower shield's imported −2 attack change is its encumbrance penalty.
  expect(resolved('Tower Shield', 'attack.melee')).toBe(-2);
  const tower = calculateCharacterSheet(
    armorSheet({
      items: ['pf1/3mQTIhwAaZgvJq12'],
      dexterity: 18,
      proficiencies: ['towerShield'],
    }),
  );
  expect(tower.breakdowns['ac.shield'].total).toBe(4);
  expect(tower.equipment.maxDexterityBonus).toBe(2);
  // Situation-gated item bonuses.
  for (const [name, target, value] of [
    ['Dancing Scarves', 'skill.blf', 2],
    ['Ice Coat', 'skill.ste', 2],
    ['Parade Armor', 'skill.dip', 2],
    ['Parade Armor', 'skill.int', 2],
  ] as const) {
    expect(resolved(name, target), `${name} ${target}`).toBe(0);
    expect(resolved(name, target, true), `${name} ${target}`).toBe(value);
  }
  expect(
    new Set(
      modifiers('Parade Armor').map((row) =>
        JSON.stringify(row.condition?.situation),
      ),
    ).size,
  ).toBe(1);
  // No armor, shield or natural armor bonus sits on ac.other.
  for (const row of preview.entries)
    for (const modifier of row.modifiers)
      if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
        expect(modifier.target, row.name).not.toBe('ac.other');
});

it('validates every item’s statistics, Base Item, defaults and end state against the pinned record and PCGen', async () => {
  for (const row of assessedItems) {
    const gear = row.mechanicsReview.gearReview;
    const mapped = entry(row.externalKey);
    expect(gear.slot, row.name).toBe(mapped.armor.slot);
    expect(gear.category, row.name).toBe(mapped.armor.category);
    expect(row.itemKind, row.name).toBe(mapped.armor.slot);
    // Shields are the records whose pinned subType is shield.
    expect(mapped.armor.slot, row.name).toBe(
      row.sourceFields.subType === 'shield' ? 'shield' : 'armor',
    );
    const value = Object.fromEntries(
      gear.statistics.map((stat) => [stat.field, stat.mapped]),
    );
    expect(value, row.name).toEqual({
      bonus: mapped.armor.bonus,
      maxDex: mapped.armor.maxDex,
      armorCheckPenalty: mapped.armor.armorCheckPenalty,
      arcaneSpellFailure: mapped.armor.asf,
      price: mapped.detail.price,
      weight: mapped.detail.weight,
    });
    expect(gear.statisticsAgree, row.name).toBe(
      gear.statistics.every((stat) => stat.agrees !== false),
    );
    expect(gear.defaults ?? null, row.name).toEqual(
      mapped.detail.magic ?? null,
    );
    expect(Boolean(gear.bash), row.name).toBe(Boolean(mapped.detail.weapon));
  }
  // Every light armor and shield maps a category the sheet knows.
  expect(
    preview.entries
      .filter(
        (row) => row.detail.kind === 'item' && !row.detail.armor?.category,
      )
      .map((row) => row.name),
  ).toEqual([]);
  // The statistics PCGen disagrees on, each a recorded discrepancy.
  expect(
    Object.fromEntries(
      assessedItems
        .filter((row) => !row.mechanicsReview.gearReview.statisticsAgree)
        .map((row) => [
          row.name,
          row.mechanicsReview.gearReview.statistics
            .filter((stat) => stat.agrees === false)
            .map((stat) => [stat.field, stat.pinned, stat.pcgen]),
        ]),
    ),
  ).toEqual({
    'Dancing Scarves': [['bonus', 2, 0]],
    'Gray Maiden Plate': [['armorCheckPenalty', 6, 5]],
    'Leaf Armor': [['price', 500, 350]],
    'Rosewood Armor': [['price', 50, 0]],
    'Spider-Silk Bodysuit': [['arcaneSpellFailure', 10, 0]],
    'Wooden Snarlshield': [
      ['price', 50, 37],
      ['weight', 20, 15],
    ],
  });
  for (const name of Object.keys({
    'Dancing Scarves': 0,
    'Gray Maiden Plate': 0,
    'Leaf Armor': 0,
    'Rosewood Armor': 0,
    'Spider-Silk Bodysuit': 0,
    'Wooden Snarlshield': 0,
  }))
    expect(
      candidate(name).mechanicsReview.sourceDiscrepancies.length,
      name,
    ).toBeGreaterThan(0);
  // The admitted items match the Core Rulebook row in every statistic.
  for (const key of ADMITTED) {
    const gear = candidate(key).mechanicsReview.gearReview;
    expect(gear.statistics.every((stat) => stat.agrees === true)).toBe(true);
  }
  expect(
    candidate(CHAIN_SHIRT).mechanicsReview.gearReview.statistics.map((stat) => [
      stat.field,
      stat.pinned,
    ]),
  ).toEqual([
    ['bonus', 4],
    ['maxDex', 4],
    ['armorCheckPenalty', 2],
    ['arcaneSpellFailure', 20],
    ['price', 100],
    ['weight', 25],
  ]);
  // Shield bashes: the Core Rulebook damage and the importer's fallbacks.
  for (const [name, dice] of [
    ['Light Steel Shield', '1d3'],
    ['Light Wooden Shield', '1d3'],
    ['Heavy Steel Shield', '1d4'],
    ['Heavy Wooden Shield', '1d4'],
  ] as const) {
    const bash = candidate(name).mechanicsReview.gearReview.bash;
    expect(bash, name).toMatchObject({ dice, pcgenDamage: dice });
    expect(entry(name).detail.weapon?.damageTypes, name).toEqual([
      'bludgeoning',
    ]);
  }
  // Specific items: Armor of Insults' +1 is its default; no Base Item is mapped.
  expect(entry('Armor of Insults').detail.magic).toEqual({
    enhancement: 1,
    masterwork: false,
  });
  for (const name of ['Armor of Insults', 'Elven Chain'])
    expect(candidate(name).mechanicsReview.gearReview.baseItem, name).toContain(
      'the importer maps no baseItem',
    );
  // Masterwork without an enhancement is dropped (Elven Chain keeps 3).
  expect(entry('Elven Chain').armor.armorCheckPenalty).toBe(3);
  expect(entry('Elven Chain').detail.magic).toBeUndefined();
});

it('checks every description record against the pinned bodies', () => {
  let records = 0;
  for (const row of assessedItems) {
    for (const record of row.mechanicsReview.curationRecords) {
      records++;
      expect(record, row.name).toMatchObject({
        kind: 'description',
        status: 'checked',
        diagnostics: [],
        text: row.mechanicsReview.descriptionText,
      });
      // Every Note is the body's own sentences, sanitized.
      const notes = record.outputs.flatMap((output) =>
        output.kind === 'note' ? [output.text] : [],
      );
      const texts = (entry(row.externalKey).situationalNotes ?? []).map(
        (note) => note.text,
      );
      for (const text of notes) {
        expect(texts, row.name).toContain(text);
        expect(text, row.name).not.toContain('@UUID');
      }
    }
    // Exactly one description record per item (the batch-ownership sweep).
    expect(row.mechanicsReview.curationRecords, row.name).toHaveLength(1);
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
  }
  expect(records).toBe(66);
  // The twelve prose-pass candidates have reviewed outputs.
  for (const name of [
    'Reinforced Tunic',
    'Tower Shield',
    'Hellknight Plate',
    'Quilted Cloth',
    'Steel Snarlshield',
    'Wooden Snarlshield',
    'Fortress Plate',
    'Elven Chain',
    'Gray Maiden Plate',
    'Dwarven War-Shield',
    'Dancing Scarves',
    'Armor of Insults',
  ])
    expect(
      candidate(name).mechanicsReview.curationRecords[0]?.outputs.length,
      name,
    ).toBeGreaterThan(0);
  // 36 descriptive bodies state no rule beyond their statistics: explicit
  // covered/no-output records, adding no Note or Modifier.
  const covered = assessedItems.filter(
    (row) => !row.mechanicsReview.curationRecords[0]?.outputs.length,
  );
  expect(covered).toHaveLength(36);
  for (const row of covered) {
    expect(
      row.mechanicsReview.curationRecords[0]?.rationale,
      row.name,
    ).toContain('Explicit covered/no-output');
    expect(entry(row.externalKey).situationalNotes ?? [], row.name).toEqual([]);
  }
  for (const name of ['Chain Shirt', 'Breastplate', 'Do-Maru'])
    expect(
      covered.map((row) => row.name),
      name,
    ).toContain(name);
  // Notes on the statistic they qualify.
  for (const [name, targets] of [
    ['Buckler', ['ac', 'attack']],
    ['Tower Shield', ['ac']],
    ['Wooden Armor', ['skill.swm']],
    ['Reinforced Tunic', ['ac']],
    ['Leather Madu', ['attack']],
  ] as const)
    expect(
      entry(name)
        .situationalNotes?.map((note) => note.target)
        .sort(),
      name,
    ).toEqual(targets);
});

it('records the cited, PCGen and Unchained notice dependencies and enforces every hold', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  const holdId = (book: string) =>
    `armors-and-shields-424-notice-${book}-complete-chain`;
  for (const row of assessedItems) {
    expect(row.requiredNotices.at(-1), row.name).toBe('PZO1110');
    for (const cited of row.citedSources)
      expect(row.requiredNotices, row.name).toContain(cited.book);
    for (const comparison of [row.comparison, ...row.additionalComparisonLeads])
      if (comparison)
        expect(row.requiredNotices, row.name).toContain(comparison.book);
    for (const linked of row.linkedContentReview)
      for (const book of linked.sources)
        expect(row.requiredNotices, row.name).toContain(book.id);
    if (row.disposition === 'admitted') {
      expect(row.requiredNotices, row.name).toEqual(['PZO1110']);
      expect(row.holdIds, row.name).toEqual([]);
      expect(row.noticeHoldIds, row.name).toEqual([]);
      continue;
    }
    expect(row.holdIds, row.name).toEqual([
      `armors-and-shields-424-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices.filter((book) => book !== 'PZO1110').map(holdId),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  // Rejected rows add no book: the Ultimate Equipment reprint the chain
  // shirt's Core Rulebook wording doesn't follow, and the hide shirt's other
  // statistics.
  expect(
    candidate('Chain Shirt').rejectedRootComparisonEvidence.map(
      (row) => row.book,
    ),
  ).toEqual(['PZO1123']);
  expect(candidate('Hide Shirt').requiredNotices).not.toContain('PZO9000-2S');
  // Core Rulebook items whose body isn't the Core Rulebook wording also
  // require Ultimate Equipment, whose rows reprint them.
  for (const name of ['Breastplate', 'Full Plate', 'Heavy Steel Shield'])
    expect(candidate(name).requiredNotices, name).toEqual([
      'PZO1123',
      ...(name === 'Heavy Steel Shield' ? ['PZO1131'] : []),
      'PZO1110',
    ]);
  // Unchained action-cost metadata anywhere in the bound closure requires
  // the held PZO1131.
  expect(
    assessedItems
      .filter((row) => row.requiredNotices.includes('PZO1131'))
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual(unchainedOwn);
  for (const row of assessedItems) {
    const own =
      (
        row.sourceFields.actions as
          | { activation?: { unchained?: unknown } }[]
          | undefined
      )?.some((action) => action.activation?.unchained) ?? false;
    expect(own, row.name).toBe(unchainedOwn.includes(row.externalKey));
    const rules = row.inheritedRuleNotices
      .filter((notice) => notice.book === 'PZO1131')
      .map((notice) => notice.rule);
    expect(
      rules.some((rule) => rule.includes("item's own action")),
      row.name,
    ).toBe(own);
    expect(
      rules.some((rule) => rule.includes('on the bound')),
      row.name,
    ).toBe(unchainedBound.includes(row.externalKey));
  }
  // The buckler and chain shirt have no action.
  for (const key of ADMITTED)
    expect(candidate(key).sourceFields.actions, key).toBeUndefined();
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

it('pins all 71 keys, the complete bodies and literal PCGen evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(71);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    71,
  );
  expect(review.counts).toEqual({
    total: 71,
    admitted: 2,
    held: 64,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 5,
    excludedFolders: 5,
    recordLevel35Holds: 0,
  });
  for (const row of excludedRows) {
    const raw = upstreamRecord.parse(
      parse(await readPinned(row.source.repo, row.source.path)),
    );
    expect(raw._key, row.name).toBe(`!folders!${raw._id}`);
  }
  expect(preview.entries).toHaveLength(66);
  for (const row of review.candidates) {
    const bytes = await readPinned(row.source.repo, row.source.path);
    expect(sha(bytes), row.externalKey).toBe(row.source.sha256);
    const raw = upstreamRecord.parse(parse(bytes));
    expect(raw._id).toBe(row.externalKey.split('/')[1]);
    expect(raw.name).toBe(row.name);
    if (row.disposition === 'excluded') continue;
    expect(raw.system).toEqual(row.sourceFields);
    expect(row.sourceFields.tags ?? []).not.toContain('3.5');
    const description = sourceDescription(raw);
    expect(sha(description)).toBe(row.descriptionSha256);
    expect(description).toBe(row.mechanicsReview.descriptionText);
    for (const reviewed of row.mechanicsReview.curationRecords) {
      expect(reviewed).toMatchObject({
        status: 'checked',
        reviewedBy: 'Opus (AI curator) for the owner',
        reviewedOn: expect.stringMatching(/^2026-10-(19|20)$/),
      });
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
  for (const row of assessedItems)
    for (const comparison of [
      row.comparison,
      ...row.additionalComparisonLeads,
      ...row.rejectedRootComparisonEvidence,
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
  // The admitted items: a complete Core Rulebook row whose DESC is the body.
  for (const key of ADMITTED) {
    const row = candidate(key);
    expect(row.comparison).toMatchObject({
      book: 'PZO1110',
      completeDirectComparison: true,
      evidenceRole: 'complete-root-comparison',
    });
    const desc = /\tDESC:([^\t]*)/.exec(row.comparison!.literalRow)?.[1];
    const words = (text: string) =>
      text
        .replace(/<[^>]+>/g, '')
        .replace(/[’']/g, "'")
        .replace(/[–-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    expect(words(row.mechanicsReview.descriptionText)).toBe(words(desc ?? ''));
  }
  // Records with no PCGen data row stay held on an unresolved root origin.
  expect(
    assessedItems
      .filter((row) => !row.comparison)
      .map((row) => row.name)
      .sort(),
  ).toEqual(['Armored Kilt', 'Ice Coat', "Poisoner's Buckler"]);
});

it('reextracts the reviewed items from a clean shared fixture tree, admits the chain shirt and buckler and holds the rest on their own holds', async () => {
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
      descriptions: { checked: 66 },
    });
    expect(
      artifact.catalog.entries.map((row) => row.externalKey).sort(),
    ).toEqual(assessedItems.map((row) => row.externalKey).sort());
    for (const row of artifact.catalog.entries) {
      const saved = entry(row.externalKey);
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
    const ours = new Set(assessedItems.map((row) => row.externalKey));
    const gate = assessCatalogAdmission({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    expect(
      gate.admitted
        .filter((row) => ours.has(row.externalKey))
        .map((row) => row.externalKey)
        .sort(),
    ).toEqual(ADMITTED);
    expect(gate.failures.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    const held = gate.held.filter((row) => ours.has(row.externalKey));
    expect(held).toHaveLength(64);
    for (const row of held)
      expect(row.reason, row.name).toBe(candidate(row.externalKey).rationale);
    for (const row of assessedItems) {
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
    // Confirming a held Core Rulebook item's whole content still holds it on
    // the held Ultimate Equipment and Unchained notices.
    const shield = candidate('Heavy Steel Shield');
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === shield.externalKey
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(
      confirmed.admitted.some((row) => row.externalKey === shield.externalKey),
    ).toBe(false);
    expect(
      confirmed.held.find((row) => row.externalKey === shield.externalKey)
        ?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
  } finally {
    await tree.dispose();
  }
});
