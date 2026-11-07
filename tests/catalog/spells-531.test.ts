// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile, mkdir, copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { beforeAll, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import {
  buildAssessmentBinding,
  computeFingerprint,
} from '../../scripts/catalog/admission';
import {
  sourceDescription,
  upstreamRecord,
} from '../../scripts/catalog/records';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import { calculateCharacterSheetProjections } from '../../src/lib/character-sheet';
import {
  review,
  spells,
  preview,
  bindingPreview,
  provenance,
  bibliography,
  snapshot,
} from '../fixtures/spells-531/data';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-531/sheet';
import {
  findCommittedBatchOwnershipProblems,
  findRecordedBindingProblems,
  findCitedNoticeProblems,
} from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';
const root = resolve('tests/fixtures/spells-531');
const keys = review.candidates.map((row) => row.externalKey);
const hash = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');
const inputs = {
  systemPath: join(root, 'pf1'),
  contentPath: join(root, 'pf1-content'),
  remaps: bindingPreview.remaps,
  candidateKeys: bindingPreview.entries.map((row) => row.externalKey),
  curation: reviewedCuration,
};
let bounded: Awaited<ReturnType<typeof importCatalog>>;
let complete: Awaited<ReturnType<typeof importCatalog>>;
beforeAll(async () => {
  bounded = await importCatalog({ ...inputs, candidateKeys: keys });
  complete = await importCatalog(inputs);
});
it('binds this complete inventory to owning ticket 531 even when another ticket has the same candidate count', () => {
  const owning = z.object({ ticket: z.literal(531) });
  const raw = z
    .object({ ticket: z.number(), candidates: z.array(z.unknown()) })
    .parse(snapshot('../../../scripts/catalog/legal/spells-531.json'));
  expect(review.ticket).toBe(531);
  expect(owning.safeParse(raw).success).toBe(true);
  expect(raw.candidates).toHaveLength(100);
  expect(owning.safeParse({ ...raw, ticket: 530 }).success).toBe(false);
  for (const row of spells) {
    expect(row.evidenceId).toBe(`spells-531-${row.externalKey.split('/')[1]}`);
    expect(row.holdIds).toContain(
      `spells-531-whole-content-${row.externalKey.split('/')[1]}`,
    );
    expect(reviewedAdmission.evidence[row.evidenceId]?.content).toMatch(
      /^#531 Sol \(AI curator\) for the owner, 2026-10-10\./,
    );
  }
});
it('accounts for exactly 100 Spell keys and holds Diamond Spray’s literal record-level 3.5 tag', async () => {
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(hash(keys.join('\n'))).toBe(provenance.orderedTicketKeysSha256);
  expect(provenance.orderedTicketKeysSha256).toBe(
    'f807198c506e0d5af0210b047d5a8b1dadc3f7e179301c813a73fa90a9ebf205',
  );
  expect(spells).toHaveLength(100);
  expect(review.summary).toEqual({
    rawCandidates: 100,
    spellDefinitions: 100,
    held: 100,
    admitted: 0,
    excluded: 0,
    dependentOmissions: 0,
    unsupportedProseOnly: 0,
    recordLevel35Holds: 1,
  });
  const diamond = spells.find((r) => r.name === 'Diamond Spray');
  expect(diamond?.externalKey).toBe('pf1/iHgN3OH0lPEMM6on');
  expect(diamond?.holdIds).toContain(
    'spells-531-Diamond-Spray-record-level3.5tag',
  );
  const raw = upstreamRecord.parse(
    parse(
      await readFile(
        join(inputs.systemPath, diamond?.source.path ?? ''),
        'utf8',
      ),
    ),
  );
  expect(raw.system.tags).toEqual(['3.5']);
  expect(raw._key).toBe('!items!iHgN3OH0lPEMM6on');
});
it('independently binds every literal root body, class level map, citation and action metadata', async () => {
  for (const row of spells) {
    const raw = upstreamRecord.parse(
      parse(await readFile(join(inputs.systemPath, row.source.path), 'utf8')),
    );
    expect(raw.type).toBe('spell');
    expect(hash(sourceDescription(raw)), row.name).toBe(row.descriptionSha256);
    expect(row.fullContentReview.descriptionText).toBe(sourceDescription(raw));
    expect(row.citedSources).toEqual(raw.system.sources);
    expect(row.learnedAt).toEqual(raw.system.learnedAt);
    expect(row.mechanicsReview.metadata.actions).toEqual(raw.system.actions);
    expect(row.descriptorReview.published).toEqual(
      raw.system.descriptors ?? [],
    );
    const entry = bounded.catalog.entries.find(
      (item) => item.externalKey === row.externalKey,
    );
    if (entry?.detail.kind !== 'spell') throw new Error(row.name);
    expect(entry.detail.levels).toEqual(
      z
        .object({ class: z.record(z.string(), z.number()) })
        .parse(raw.system.learnedAt).class,
    );
    // #738 imports the published descriptors; `imported` records what the
    // importer read when this batch was reviewed.
    expect(entry.detail.descriptors).toEqual(row.descriptorReview.published);
    expect(entry.modifiers).toEqual([]);
    const record = reviewedCuration.records.find(
      (item) =>
        item.externalKey === row.externalKey && item.kind === 'description',
    );
    expect(record).toMatchObject({
      status: 'checked',
      text: sourceDescription(raw),
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-10',
    });
    expect(record?.outputs.every((item) => item.kind === 'note')).toBe(true);
    expect(record?.outputs).toEqual(
      row.mechanicsReview.protectedHistoricalContext
        ? []
        : row.mechanicsReview.reviewedOptionalOutputs,
    );
    expect(
      record?.diagnostics
        .filter((item) => item.kind === 'unresolved')
        .map((item) => item.text),
    ).toEqual(row.mechanicsReview.descriptionRecord.unresolved);
    expect(row.mechanicsReview.descriptionRecord.unresolved).toEqual(
      row.mechanicsReview.protectedHistoricalContext
        ? []
        : row.mechanicsReview.outstanding,
    );
    expect(row.holdIds).toContain(`spells-531-whole-content-${raw._id}`);
    expect(reviewedAdmission.evidence[row.evidenceId]?.content).toContain(
      row.source.sha256,
    );
    expect(
      record?.outputs
        .map((item) => (item.kind === 'note' ? item.text : ''))
        .join('\n'),
    ).not.toMatch(/notice hold|whole-content|Review required:|spells-531-/i);
  }
});
it('uses the 49 pinned class records only as lookup context for the 179 Spell definitions', async () => {
  expect(provenance.classContext).toHaveLength(49);
  expect(new Set(provenance.classContext.map((row) => row.tag)).size).toBe(49);
  for (const row of provenance.classContext) {
    const raw = upstreamRecord.parse(
      parse(await readFile(join(root, row.repo, row.path), 'utf8')),
    );
    expect(raw.type).toBe('class');
    expect(raw.system.tag).toBe(row.tag);
    expect(
      complete.catalog.entries.some(
        (entry) => entry.externalKey === row.externalKey,
      ),
    ).toBe(false);
  }
  expect(complete.catalog.entries).toHaveLength(179);
  expect(
    complete.catalog.entries.every((entry) => entry.detail.kind === 'spell'),
  ).toBe(true);
});
it('protects the complete historical context union, including held dependency roots', () => {
  const protection = z
    .object({
      sources: z.array(
        z.object({
          path: z.string(),
          sha256: z.string(),
          keys: z.array(z.string()),
        }),
      ),
      seedKeys: z.array(z.string()),
      closureKeys: z.array(z.string()),
      protectedRoots: z.array(z.string()),
      definitions: z.record(z.string(), z.string()),
    })
    .parse(snapshot('protected-context.json'));
  // The protected roots come from other batches' inventories and fixtures as
  // they were at this batch's base; those files are theirs to change (#749).
  expect(
    [...new Set(protection.sources.flatMap((source) => source.keys))].sort(),
  ).toEqual(protection.seedKeys);
  expect(protection.sources).toHaveLength(167);
  expect(protection.seedKeys).toHaveLength(4102);
  expect(protection.closureKeys).toHaveLength(5343);
  expect(Object.keys(protection.definitions)).toHaveLength(5291);
  expect(protection.protectedRoots).toHaveLength(22);
  expect(
    spells
      .filter((row) => protection.closureKeys.includes(row.externalKey))
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual(protection.protectedRoots);
  for (const key of protection.protectedRoots) {
    const record = reviewedCuration.records.find(
      (row) => row.externalKey === key && row.kind === 'description',
    );
    expect(record, key).toMatchObject({ outputs: [], diagnostics: [] });
    expect(
      spells.find((row) => row.externalKey === key)?.fullContentReview
        .descriptionText,
    ).toBe(record?.text);
  }
  let checked = 0;
  for (const entry of complete.catalog.entries) {
    const original = protection.definitions[entry.externalKey];
    if (!original) continue;
    expect(computeFingerprint(entry), entry.externalKey).toBe(original);
    checked++;
  }
  expect(checked).toBe(
    provenance.rawSources
      .concat(provenance.dependencies)
      .filter((r) => Object.hasOwn(protection.definitions, r.externalKey))
      .length,
  );
});
it('replays selected and closed-context artifacts and accounts for selection-only reference failures', () => {
  const ordered = (rows: { externalKey: string }[]) =>
    [...rows].sort((a, b) => a.externalKey.localeCompare(b.externalKey));
  expect(computeFingerprint(ordered(bounded.catalog.entries))).toBe(
    computeFingerprint(ordered(preview.entries)),
  );
  expect(computeFingerprint(ordered(complete.catalog.entries))).toBe(
    computeFingerprint(ordered(bindingPreview.entries)),
  );
  expect(computeFingerprint(complete.catalog.resources)).toBe(
    computeFingerprint(bindingPreview.resources),
  );
  expect(bounded.curation.passed).toBe(true);
  expect(bounded.curation.summary.required).toBe(0);
  expect(bounded.curation.summary.missing).toBe(0);
  expect(bounded.curation.summary.descriptions.checked).toBe(100);
  expect(bounded.curation.unresolvedMechanics).toEqual([]);
  expect(bounded.curation.unresolvedDescriptions).toHaveLength(
    review.mechanicsSummary.optionalUnresolvedDescriptions ?? -1,
  );
  const gate = assessWithUnclearedHolds({
    artifact: complete,
    ...reviewedAdmission,
  });
  // #738 keeps Solidify Earth's and Debilitating Speech's rules journal
  // links as text, so neither fails on a reference.
  expect(gate.failures).toEqual([]);
  expect(gate.admitted).toEqual([]);
  expect(
    gate.held.filter((row) => keys.includes(row.externalKey)),
  ).toHaveLength(100);
  const selected = assessWithUnclearedHolds({
    artifact: bounded,
    ...reviewedAdmission,
  });
  expect(selected.admitted).toEqual([]);
  expect(selected.failures).toHaveLength(
    preview.admissionCounts.failures ?? -1,
  );
  expect(
    selected.failures.every((row) =>
      row.reason.startsWith('Broken structure or reference:'),
    ),
  ).toBe(true);
});
it('compares every current inventory binding to the live assessment and independently recomputed complete closure', () => {
  for (const row of spells) {
    const assessment = reviewedAdmission.assessments.find(
      (item) => item.externalKey === row.externalKey,
    );
    const entry = complete.catalog.entries.find(
      (item) => item.externalKey === row.externalKey,
    );
    if (!entry || !assessment) throw new Error(row.name);
    const current = buildAssessmentBinding({
      entry,
      artifact: complete,
      ...reviewedAdmission,
      requiredNotices: row.requiredNotices,
      evidenceIds: [row.evidenceId],
    });
    expect(assessment).toMatchObject({
      status: 'unresolved',
      requiredNotices: row.requiredNotices,
      ...current,
    });
    expect(
      findRecordedBindingProblems({
        recorded: row.binding,
        current,
        evidenceId: row.evidenceId,
      }),
      row.name,
    ).toEqual([]);
    for (const dep of row.inheritedRuleNotices)
      expect(row.requiredNotices).toContain(dep.book);
  }
});
it('requires inherited class, mythic and item dependencies separately from root books', () => {
  for (const [name, book] of [
    ['Caging Bomb Admixture', 'PZO1115'],
    ['Font of Spirit Magic', 'PZO1129'],
    ['Wrathful Weapon', 'PZO1129'],
    ['Sustaining Legend', 'PZO1126'],
    ['Preserve Grace', 'PZO1123'],
    ['Technomancy', 'PZO9000-15E'],
  ] as const) {
    const row = spells.find((r) => r.name === name);
    expect(row?.requiredNotices).toContain(book);
    expect(row?.inheritedRuleNotices.some((r) => r.book === book)).toBe(true);
  }
});
it('requires core notices for the actual citation, skills, condition and governing spell clauses missed in the review', () => {
  for (const [name, literals] of [
    ['Sky Swim', ['Swim checks', '<i>Core Rulebook</i> 439']],
    [
      'Focused Scrutiny',
      ['Perception', 'Sense Motive', 'Survival', 'Diplomacy', 'Intimidate'],
    ],
    ["Deadeye's Lore", ['Survival checks', 'tracking']],
    ['Id Insinuation IV', ['confused condition']],
    [
      'Caging Bomb Admixture',
      ['Like a Wall of Force', 'dispel magic', 'disintegrate'],
    ],
  ] as const) {
    const spell = spells.find((row) => row.name === name);
    if (!spell) throw new Error(name);
    for (const literal of literals)
      expect(spell.fullContentReview.descriptionText).toContain(literal);
    expect(spell.requiredNotices, name).toEqual(
      expect.arrayContaining(['CRB', 'PZO1110']),
    );
    expect(
      spell.inheritedRuleNotices.some((row) => row.book === 'PZO1110'),
    ).toBe(true);
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === spell.externalKey,
    );
    expect(assessment?.requiredNotices).toEqual(
      expect.arrayContaining(['CRB', 'PZO1110']),
    );
  }
  const returning = spells.find(
    (row) => row.name === 'Returning Weapon, Communal',
  );
  expect(
    returning?.fullContentReview.linkedContentReview[0]?.descriptionText,
  ).toContain('page 471 of the <i>Core</i> Rulebook');
  expect(returning?.requiredNotices).toEqual(
    expect.arrayContaining(['CRB', 'PZO1110']),
  );
  const planar = spells.find((row) => row.name === 'Bestow Planar Infusion II');
  expect(planar?.mechanicsReview.metadata.actions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        save: expect.objectContaining({ description: 'Fortitude negates' }),
      }),
    ]),
  );
  expect(planar?.requiredNotices).toEqual(
    expect.arrayContaining(['CRB', 'PZO1110', 'PZO1141']),
  );
});
it('checks core rules in every complete root and supporting body and every declared supporting publication', async () => {
  const literalCore =
    /\b(?:confused|dazed|stunned|panicked|cowering|shaken|fatigued|exhausted|entangled|Survival|Swim|Perception|Sense Motive|Diplomacy|Intimidate|Acrobatics|Escape Artist|Spellcraft|damage|hardness|masterwork|line of sight|familiar|saving throws?|(?:Will|Reflex|Fortitude) save|(?:move|standard|swift|full-round) action)\b/i;
  for (const spell of spells) {
    const bodies = [
      {
        text: spell.fullContentReview.descriptionText,
        sources: spell.citedSources,
      },
      ...spell.fullContentReview.linkedContentReview.map((row) => ({
        text: row.descriptionText,
        sources: row.completeRawSystem.sources,
      })),
      ...[
        ...spell.mechanicsReview.governingSpellBodies,
        ...spell.mechanicsReview.auditOnlySpellBodies,
      ].map((row) => ({
        text: row.descriptionText,
        sources: row.sources,
      })),
    ];
    for (const body of bodies) {
      if (
        literalCore.test(body.text) ||
        /Core(?:<\/i>)? Rulebook/.test(body.text)
      )
        expect(spell.requiredNotices, spell.name).toEqual(
          expect.arrayContaining(['CRB', 'PZO1110']),
        );
      for (const source of z
        .array(z.object({ id: z.string().optional() }))
        .default([])
        .parse(body.sources))
        if (source.id)
          expect(spell.requiredNotices, spell.name).toContain(source.id);
    }
    for (const base of [
      ...spell.mechanicsReview.governingSpellBodies,
      ...spell.mechanicsReview.auditOnlySpellBodies,
    ]) {
      const bytes = await readFile(join(root, base.fixturePath));
      const raw = upstreamRecord.parse(parse(bytes.toString()));
      expect(hash(bytes)).toBe(base.source.sha256);
      expect(sourceDescription(raw)).toBe(base.descriptionText);
      expect(hash(sourceDescription(raw))).toBe(base.descriptionSha256);
      expect(raw.system.sources ?? []).toEqual(base.sources);
    }
  }
});
it('keeps Ward Shield’s Fireball example and Symbol of Slowing’s recursive references out of applied Notes', async () => {
  const ward = complete.catalog.entries.find(
    (row) => row.name === 'Ward Shield',
  );
  const symbol = complete.catalog.entries.find(
    (row) => row.name === 'Symbol of Slowing',
  );
  if (!ward?.situationalNotes || !symbol?.situationalNotes)
    throw new Error('Missing public definitions or their Notes');
  expect(ward.situationalNotes).toHaveLength(1);
  expect(ward.situationalNotes[0]?.text).toContain('such as fireball');
  const fireball = upstreamRecord.parse(
    parse(
      await readFile(
        join(inputs.systemPath, 'packs/spells/fireball.6oq1wcryviik9ice.yaml'),
        'utf8',
      ),
    ),
  );
  const fireballSpecific =
    'deals 1d6 points of fire damage per caster level (maximum 10d6) to every creature within the area';
  expect(sourceDescription(fireball)).toContain(fireballSpecific);
  expect(ward.situationalNotes.map((row) => row.text).join(' ')).not.toContain(
    fireballSpecific,
  );
  const wardReview = spells.find((row) => row.name === 'Ward Shield');
  expect(wardReview?.mechanicsReview.governingSpellBodies).toEqual([]);
  const symbolReview = spells.find((row) => row.name === 'Symbol of Slowing');
  expect(
    symbolReview?.mechanicsReview.governingSpellBodies.map((row) => row.name),
  ).toEqual(['Symbol of Death', 'Slow']);
  expect(symbol.situationalNotes.map((row) => row.text).join(' ')).not.toMatch(
    /Prismatic Wall \(|Teleport(?:, Greater)? \(|Permanency \(|Haste \(/,
  );
});
it('labels every direct-base Note chunk with its identity and precise scope while retaining the complete base text', () => {
  const normalized = (text: string) => text.replace(/\s+/g, ' ').trim();
  const readable = (text: string) =>
    text
      .replace(
        /@UUID\[Compendium\.pf1\.spells\.(?:Item\.)?([^\]]+)\](?:\{([^}]+)\})?/g,
        (_match: string, id: string, label: string | undefined) =>
          label ??
          bindingPreview.entries.find((row) => row.externalKey === 'pf1/' + id)
            ?.name ??
          id,
      )
      .replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, '$1')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&amp;/g, '&');
  let splitBase = false;
  for (const spell of spells) {
    const outputs = spell.mechanicsReview.reviewedOptionalOutputs;
    let offset = spell.mechanicsReview.ownNoteCount;
    for (const base of spell.mechanicsReview.governingSpellBodies) {
      expect(
        spell.fullContentReview.descriptionText.slice(
          base.rootEvidenceStart,
          base.rootEvidenceEnd,
        ),
      ).toBe(base.rootEvidence);
      expect(base.prefix).toContain(
        base.name + ' (direct base rules for ' + spell.name,
      );
      expect(base.prefix).toContain(base.limits);
      const notes = outputs.slice(offset, offset + base.noteCount);
      expect(notes).toHaveLength(base.noteCount);
      const text = notes
        .map((note) => {
          if (note.kind !== 'note') throw new Error(spell.name);
          expect(
            note.text.startsWith(base.prefix),
            spell.name + '/' + base.name,
          ).toBe(true);
          expect(note.text.length).toBeLessThanOrEqual(4096);
          return note.text.slice(base.prefix.length);
        })
        .join(' ');
      expect(normalized(text), spell.name + '/' + base.name).toBe(
        normalized(readable(base.descriptionText)),
      );
      if (base.noteCount > 1) splitBase = true;
      offset += base.noteCount;
    }
    expect(offset).toBe(outputs.length);
  }
  expect(splitBase).toBe(true);
  const immunity = spells.find(
    (row) => row.name === 'Spell Immunity, Greater Communal',
  );
  expect(
    immunity?.mechanicsReview.governingSpellBodies.map((row) => row.name),
  ).toEqual(['Spell Immunity, Greater']);
  const wall = spells.find((row) => row.name === 'Wall of Sound');
  expect(
    wall?.mechanicsReview.governingSpellBodies.map((row) => row.name),
  ).toEqual([]);
  expect(
    wall?.mechanicsReview.auditOnlySpellBodies.map((row) => row.name),
  ).toEqual(['Wind Wall']);
});
it('shares Guardian of Faith’s complete common protection body across its four exclusive choices', () => {
  const spell = spells.find((row) => row.name === 'Guardian of Faith');
  const entry = complete.catalog.entries.find(
    (row) => row.name === 'Guardian of Faith',
  );
  if (!spell || !entry?.situationalNotes)
    throw new Error('Missing Guardian of Faith');
  expect(entry.situationalNotes[0]?.text).toContain(
    'your choice of Protection from Chaos , evil , good , or law',
  );
  const common = spell.mechanicsReview.governingSpellBodies.find(
    (row) => row.name === 'Protection from Evil',
  );
  if (!common) throw new Error('Missing common protection body');
  expect(common.limits).toContain(
    'common protection mechanics for all four choices',
  );
  expect(common.limits).toContain(
    'alignment benefits are alternatives and do not stack',
  );
  expect(common.functionsLikeEvidence?.map((row) => row.name)).toEqual([
    'Protection from Chaos',
    'Protection from Good',
    'Protection from Law',
  ]);
  for (const [name, alignment] of [
    ['Protection from Chaos', 'chaotic'],
    ['Protection from Evil', 'evil'],
    ['Protection from Good', 'good'],
    ['Protection from Law', 'lawful'],
  ]) {
    const base = spell.mechanicsReview.governingSpellBodies.find(
      (row) => row.name === name,
    );
    if (!base) throw new Error(name);
    expect(base.descriptionText).toContain(alignment + ' creatures');
    if (name !== 'Protection from Evil') {
      expect(base.limits).toContain(
        'only when ' +
          (name === 'Protection from Chaos'
            ? 'chaos'
            : name === 'Protection from Law'
              ? 'law'
              : 'good') +
          ' protection is chosen',
      );
      const evidence = common.functionsLikeEvidence?.find(
        (row) => row.name === name,
      );
      if (!evidence) throw new Error('Missing functions-like evidence');
      expect(base.descriptionText.slice(evidence.start, evidence.end)).toBe(
        evidence.evidence,
      );
      expect(evidence.evidence).toContain('This spell functions like');
      expect(evidence.evidence).toContain('{Protection from Evil}');
      expect(evidence.descriptionSha256).toBe(base.descriptionSha256);
    }
    const notes = entry.situationalNotes.filter((row) =>
      row.text.startsWith(base.prefix),
    );
    expect(notes).toHaveLength(base.noteCount);
    for (const note of notes) {
      expect(note.text).toContain(
        name + ' (direct base rules for Guardian of Faith',
      );
      expect(note.text.length).toBeLessThanOrEqual(4096);
    }
  }
  const commonNotes = entry.situationalNotes
    .filter((row) => row.text.startsWith(common.prefix))
    .map((row) => row.text)
    .join(' ');
  expect(commonNotes).toContain('another saving throw');
  expect(commonNotes).toContain(
    'immune to any new attempts to possess or exercise mental control',
  );
  expect(commonNotes).toContain(
    'Spell resistance can allow a creature to overcome this protection',
  );
  expect(commonNotes).not.toContain('only when evil protection is chosen');
});
it('preserves complete comparison bodies as audit evidence without installing their conflicting values', async () => {
  const cases = [
    {
      name: 'Caging Bomb Admixture',
      bases: ['Wall of Force'],
      own: ['hardness of 20', '20 per alchemist level'],
      absent: ['hardness 30'],
    },
    {
      name: 'Metabolic Molting',
      bases: ['Temporal Stasis', 'Regenerate', 'Raise Dead'],
      own: [
        'For 7 days',
        'regains 5 hit points per Hit Die',
        'gains 1 permanent negative level',
        'stabilizes at 0 hit points',
      ],
      absent: ['4d8', 'two permanent negative levels'],
    },
    {
      name: 'Wall of Sound',
      bases: ['Wind Wall'],
      own: [
        'rebound harmlessly',
        '2d4 points of sonic damage',
        '2d6 points of sonic damage',
      ],
      absent: ['30% miss chance'],
    },
  ];
  for (const item of cases) {
    const spell = spells.find((row) => row.name === item.name);
    const entry = complete.catalog.entries.find(
      (row) => row.name === item.name,
    );
    if (!spell || !entry?.situationalNotes) throw new Error(item.name);
    expect(spell.mechanicsReview.governingSpellBodies).toEqual([]);
    expect(
      spell.mechanicsReview.auditOnlySpellBodies.map((row) => row.name),
    ).toEqual(item.bases);
    expect(entry.situationalNotes).toHaveLength(
      spell.mechanicsReview.ownNoteCount,
    );
    const applied = entry.situationalNotes.map((row) => row.text).join(' ');
    for (const literal of item.own) expect(applied).toContain(literal);
    for (const literal of item.absent) {
      expect(
        spell.mechanicsReview.auditOnlySpellBodies.some((row) =>
          row.descriptionText.includes(literal),
        ),
      ).toBe(true);
      expect(applied).not.toContain(literal);
    }
    for (const base of spell.mechanicsReview.auditOnlySpellBodies) {
      const bytes = await readFile(join(root, base.fixturePath));
      const raw = upstreamRecord.parse(parse(bytes.toString()));
      expect(hash(bytes)).toBe(base.source.sha256);
      expect(sourceDescription(raw)).toBe(base.descriptionText);
      expect(hash(sourceDescription(raw))).toBe(base.descriptionSha256);
      expect(raw.system.sources ?? []).toEqual(base.sources);
      expect(
        spell.fullContentReview.descriptionText.slice(
          base.rootEvidenceStart,
          base.rootEvidenceEnd,
        ),
      ).toBe(base.rootEvidence);
      expect(base.application).toBe('audit-only');
      expect(base.auditOnlyReason).toContain('comparison evidence only');
      expect(base.noteCount).toBe(0);
      expect(base.previousAppliedNoteCount).toBeGreaterThan(0);
      for (const source of z
        .array(z.object({ id: z.string().optional() }))
        .parse(base.sources))
        if (source.id) expect(spell.requiredNotices).toContain(source.id);
    }
  }
  const cloud = spells.find((row) => row.name === 'Cloudkill');
  expect(
    cloud?.mechanicsReview.governingSpellBodies.map((row) => row.name),
  ).toEqual(['Fog Cloud']);
});
it('pins complete inherited bodies and keeps metadata/book/term minima at their stated evidence layer', async () => {
  for (const row of spells.flatMap((item) => item.inheritedNoticeReview)) {
    const p = new URL(row.sourceLocation).pathname.split('/packs/')[1];
    if (!p) throw new Error(row.sourceLocation);
    const location = [
      ...spells.flatMap((r) => [
        ...r.mechanicsReview.governingSpellBodies,
        ...r.mechanicsReview.auditOnlySpellBodies,
      ]),
    ].find((r) => r.source.path === 'packs/' + p);
    const file = await readFile(
      location
        ? join(root, location.fixturePath)
        : join(inputs.systemPath, 'packs', p),
    );
    expect(hash(file)).toBe(row.sourceFileSha256);
    const raw = upstreamRecord.parse(parse(file.toString()));
    if (row.role === 'core-save-metadata-minimum') {
      const actions = z
        .array(
          z.object({
            _id: z.string().optional(),
            save: z.record(z.string(), z.unknown()).optional(),
          }),
        )
        .parse(raw.system.actions);
      expect(JSON.parse(row.evidence)).toEqual(
        actions
          .filter((a) => ['will', 'fort', 'ref'].includes(String(a.save?.type)))
          .map((a) => ({ actionId: a._id, save: a.save })),
      );
      expect(hash(row.evidence)).toBe(row.evidenceSha256);
    } else if (row.role === 'action-metadata-minimum') {
      const actions = z
        .array(
          z.object({
            activation: z.object({ unchained: z.unknown().optional() }),
          }),
        )
        .parse(raw.system.actions);
      expect(JSON.parse(row.evidence)).toEqual(
        actions.flatMap((a) =>
          a.activation.unchained === undefined ? [] : [a.activation.unchained],
        ),
      );
    } else {
      expect(hash(sourceDescription(raw))).toBe(row.sourceDescriptionSha256);
      expect(sourceDescription(raw)).toContain(row.evidence);
      expect(hash(row.evidence)).toBe(row.evidenceSha256);
      if (row.role === 'complete-referenced-spell-body')
        expect(row.evidence).toBe(sourceDescription(raw));
    }
  }
  for (const row of [
    ...provenance.rawSources,
    ...provenance.dependencies,
    ...provenance.classContext,
  ]) {
    const repo = z
      .enum(['pf1', 'pf1-content'])
      .parse('repo' in row ? row.repo : 'pf1');
    expect(hash(await readFile(join(root, repo, row.path)))).toBe(row.sha256);
  }
  for (const row of provenance.comparisonFiles)
    expect(hash(await readFile(join(root, row.path)))).toBe(row.sha256);
  for (const quote of bibliography.quotes) {
    expect(hash(quote.text)).toBe(quote.sha256);
    expect(quote.text.split('\n')).toHaveLength(quote.endLine - quote.line + 1);
    expect(quote.text).toMatch(/_id: "[^"]+",\n +name: "/);
  }
});
it('retains seven complete non-Spell dependency bodies without selecting the supporting definitions', async () => {
  let count = 0;
  for (const candidate of spells)
    for (const source of candidate.inheritedRuleSourceEvidence) {
      const bytes = await readFile(join(root, source.fixturePath));
      expect(hash(bytes)).toBe(source.sha256);
      const raw = upstreamRecord.parse(parse(bytes.toString()));
      expect(sourceDescription(raw)).toBe(source.descriptionText);
      expect(hash(source.descriptionText)).toBe(source.descriptionSha256);
      const sources = z
        .array(z.object({ id: z.string() }))
        .default([])
        .parse(raw.system.sources);
      for (const { id } of sources)
        expect(candidate.requiredNotices, source.name).toContain(id);
      expect(
        complete.catalog.entries.some(
          (r) => r.externalKey === source.externalKey,
        ),
      ).toBe(false);
      for (const book of source.books)
        expect(candidate.requiredNotices).toContain(book);
      count++;
    }
  expect(count).toBe(7);
});
it('independently recomputes complete positive DisplayFullSpell equality instead of trusting saved booleans', async () => {
  let count = 0;
  let matches = 0;
  const normalize = (text: string) =>
    text
      .replace(/&amp;/g, '&')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
  const readable = (text: string) =>
    text
      .replace(
        /@UUID\[Compendium\.pf1\.spells\.(?:Item\.)?([^\]]+)\](?:\{([^}]+)\})?/g,
        (_match: string, id: string, label: string | undefined) =>
          label ??
          bindingPreview.entries.find((r) => r.externalKey === 'pf1/' + id)
            ?.name ??
          id,
      )
      .replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, '$1')
      .replace(/<[^>]*>/g, ' ')
      .replace(
        /&(?:amp|lt|gt|quot|apos);/g,
        (entity) =>
          ({
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&apos;': "'",
          })[entity] ?? entity,
      );
  for (const row of spells) {
    const comparison = row.fullContentReview.directComparison;
    if (!comparison) continue;
    const bytes = await readFile(join(root, comparison.source));
    const lines = bytes.toString().split('\n');
    expect(hash(bytes)).toBe(comparison.fileSha256);
    expect(lines[comparison.line - 1]).toBe(comparison.text);
    expect(hash(comparison.text)).toBe(comparison.lineSha256);
    const body = comparison.fullDescription;
    if (!body) throw new Error(row.name + ' missing complete comparison');
    expect(lines[body.line - 1]).toBe(body.text);
    expect(hash(body.text)).toBe(body.lineSha256);
    expect(body.text).toContain('|PRERULE:1,DisplayFullSpell');
    expect(body.text).not.toContain('|!PRERULE:1,DisplayFullSpell');
    const compared = body.text.split('DESC:')[1]?.split('|PRERULE:')[0];
    if (!compared) throw new Error(row.name);
    const equal =
      normalize(readable(row.fullContentReview.descriptionText)) ===
      normalize(compared);
    expect(body.normalizedEqual, row.name).toBe(equal);
    count++;
    if (equal) matches++;
  }
  expect(count).toBe(22);
  expect(matches).toBe(17);
});
it('enforces every known notice identity and never treats a publication anchor as complete-chain approval', () => {
  for (const row of review.noticeRequirements) {
    if (row.book === 'PZO1110') {
      expect(row.holdId).toBeNull();
      expect(row.registryKeys).toEqual(['CRB']);
    } else
      expect(heldNotices.find((item) => item.id === row.holdId)).toEqual({
        id: row.holdId,
        notices: [...new Set([row.book, ...row.registryKeys])],
        evidence: ['scripts/catalog/legal/spells-531.json'],
      });
    for (const notice of row.registryIdentityEvidence)
      expect(findCitedNoticeProblems(notice), notice.key).toEqual([]);
  }
  const entry = complete.catalog.entries.find((r) => r.name === 'Aid');
  const assessment = reviewedAdmission.assessments.find(
    (r) => r.externalKey === entry?.externalKey,
  );
  if (!entry || !assessment) throw new Error('Aid');
  for (const [notice, reason] of [
    ['PZO1115', 'Notice holds: PZO1115 ('],
    [
      'pf1-content/notice/7d75468ec859d3452bcef8458792e6ef19c7aafcf9cbaf2f759fdf4bc923b2a2',
      'spells-529-notice-PZO1115-complete-chain',
    ],
  ] as const) {
    const requiredNotices = ['PZO1110', notice];
    const binding = buildAssessmentBinding({
      entry,
      artifact: complete,
      ...reviewedAdmission,
      requiredNotices,
      evidenceIds: Object.keys(assessment.evidenceFingerprints),
    });
    const gate = assessWithUnclearedHolds({
      artifact: complete,
      ...reviewedAdmission,
      assessments: [
        { ...assessment, ...binding, status: 'confirmed', requiredNotices },
      ],
    });
    expect(gate.admitted).toEqual([]);
    expect(
      gate.held.find((r) => r.externalKey === entry.externalKey)?.reason,
    ).toContain(reason);
  }
});
it('keeps required publication minima separate from any title association', () => {
  for (const row of review.noticeRequirements)
    for (const key of row.registryKeys) {
      const record = reviewedAdmission.registry[key];
      expect(key === row.book || record?.aliases?.includes(row.book), key).toBe(
        true,
      );
    }
  expect(
    review.noticeRequirements.find((r) => r.book === 'PZO1118')?.registryKeys,
  ).toEqual([]);
  expect(
    spells.find((r) => r.name === 'Caging Bomb Admixture')?.noticeHoldIds,
  ).toContain('spells-531-notice-PZO1115-complete-chain');
});
it.each([
  ['Mental Barrier I', '+4'],
  ['Plant Shape II', '+4 size bonus'],
  ['Prayer', '+1 luck bonus'],
  ['Firebrand', '+1d6'],
  ['Insect Scouts', 'AC 20'],
  ['Harrowing', '+2 luck bonus'],
  ['Diamond Spray', 'maximum 10d6'],
  ['Caging Bomb Admixture', 'hardness of 20'],
  ['Grease', '+10 circumstance bonus'],
  ['Blood Money', '500-999'],
  ['Aid', '1d8+10'],
])(
  'preserves published %s values without granting passive bonuses',
  (name, text) => {
    const row = spells.find((r) => r.name === name);
    if (!row) throw new Error(name);
    expect(row.mechanicsReview.manualRule).toContain(text);
    expect(
      row.mechanicsReview.reviewedOptionalOutputs
        .map((r) => (r.kind === 'note' ? r.text : ''))
        .join('\n'),
    ).toContain(text);
    const calculated = calculateCharacterSheetProjections(
      recordedSpellSheet(
        name,
        Object.keys(spellFixture(name).detail.levels)[0] ?? 'wizard',
      ),
    );
    for (const view of [calculated.current, calculated.permanent]) {
      expect(view.abilities.strength.score).toBe(10);
      expect(view.abilities.constitution.score).toBe(10);
    }
  },
);
it('scopes only the applicable save clauses with shared Situations and keeps each complete Note within the sheet limit', () => {
  for (const [name, key] of [
    ['Aid', 'fear'],
    ['Ward Shield', 'spells'],
  ] as const) {
    const spell = spells.find((row) => row.name === name);
    if (!spell) throw new Error(name);
    expect(
      spell.mechanicsReview.reviewedOptionalOutputs.filter(
        (row) => row.kind === 'note' && row.situation === key,
      ),
    ).toHaveLength(1);
    expect(
      spell.mechanicsReview.reviewedOptionalOutputs.some(
        (row) => row.kind === 'modifier',
      ),
    ).toBe(false);
  }
  const batchKeys = new Set(keys);
  for (const record of reviewedCuration.records.filter((row) =>
    batchKeys.has(row.externalKey),
  ))
    for (const note of record.outputs)
      if (note.kind === 'note')
        expect(note.text.length).toBeLessThanOrEqual(4096);
});
it('retains incomplete and contradictory source branches without inventing a repair', () => {
  expect(
    spells
      .find((r) => r.name === 'Irregular Size')
      ?.mechanicsReview.discrepancies.join(' '),
  ).toContain('only the Arms branch');
  expect(
    spells
      .find((r) => r.name === 'Ward Shield')
      ?.mechanicsReview.discrepancies.join(' '),
  ).toContain('spell shield');
  expect(
    spells
      .find((r) => r.name === 'Blood Money')
      ?.mechanicsReview.discrepancies.join(' '),
  ).toContain('1,000-1,500');
  const speech = spells.find((r) => r.name === 'Debilitating Speech');
  expect(speech?.mechanicsReview.manualRule).toContain('1d4 rounds');
  expect(speech?.mechanicsReview.discrepancies.join(' ')).toContain(
    'as a standard action or as a full-round action',
  );
  expect(speech?.mechanicsReview.discrepancies.join(' ')).toContain(
    'Will negates',
  );
  expect(speech?.mechanicsReview.discrepancies.join(' ')).toContain(
    'no saving-throw clause and no damage amount',
  );
  expect(speech?.mechanicsReview.discrepancies.join(' ')).toContain(
    'no favored save, damage, duration, target or casting-time reading',
  );
  expect(speech?.mechanicsReview.outstanding.join(' ')).toContain(
    'selected casting time',
  );
});
it('keeps its own description records, assessments, evidence and holds as recorded', () => {
  expect(
    findCommittedBatchOwnershipProblems(
      'scripts/catalog/legal/spells-531.json',
    ),
  ).toEqual([]);
});
it('reconstructs the exact fixture from declared published inputs and empty directory markers on any machine', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'spells-531-fixture-'));
  try {
    for (const repo of ['pf1', 'pf1-content']) {
      const manifest = provenance.manifests.find((r) => r.repo === repo);
      if (!manifest) throw new Error(repo);
      const data = z
        .object({ packs: z.array(z.object({ name: z.string() })) })
        .parse(
          JSON.parse(await readFile(join(root, repo, manifest.path), 'utf8')),
        );
      for (const pack of data.packs) {
        const dir = join(
          scratch,
          repo,
          repo === 'pf1' ? 'packs' : 'src',
          pack.name,
        );
        await mkdir(dir, { recursive: true });
        if (
          ![
            ...provenance.rawSources,
            ...provenance.dependencies,
            ...provenance.classContext,
          ].some(
            (r) => repo === 'pf1' && r.path.startsWith(`packs/${pack.name}/`),
          )
        )
          await copyFile(
            join(
              root,
              repo,
              repo === 'pf1' ? 'packs' : 'src',
              pack.name,
              '.gitkeep',
            ),
            join(dir, '.gitkeep'),
          );
      }
    }
    for (const row of [
      ...provenance.rawSources,
      ...provenance.dependencies,
      ...provenance.classContext,
      ...provenance.manifests,
    ]) {
      const repo = 'repo' in row ? row.repo : 'pf1';
      const target = join(scratch, repo, row.path);
      await mkdir(join(target, '..'), { recursive: true });
      await copyFile(join(root, repo, row.path), target);
    }
    const replay = await importCatalog({
      ...inputs,
      systemPath: join(scratch, 'pf1'),
      contentPath: join(scratch, 'pf1-content'),
    });
    expect(computeFingerprint(replay.catalog.entries)).toBe(
      computeFingerprint(complete.catalog.entries),
    );
    expect(computeFingerprint(replay.catalog.resources)).toBe(
      computeFingerprint(complete.catalog.resources),
    );
    expect(
      assessWithUnclearedHolds({ artifact: replay, ...reviewedAdmission })
        .failures,
    ).toEqual([]);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
