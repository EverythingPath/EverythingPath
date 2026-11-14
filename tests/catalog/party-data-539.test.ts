// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { assessCatalogAdmission } from '../../scripts/catalog/admission';
import { committedAttribution227 } from '../../scripts/catalog/legal/attribution-227';
import { committedAttribution227Matches } from '../../scripts/catalog/legal/attribution-227-matches';
import { committedSection15Confirmations } from '../../scripts/catalog/legal/section15-confirmations';
import type { PreviewEntry } from '../../scripts/catalog/map';
import {
  partyBuildsPath,
  partyCharacterGaps,
  parsePartyBuilds,
} from '../../scripts/catalog/party/party-builds';
import {
  decodePartyScope,
  partyScopePath,
} from '../../scripts/catalog/party/party-scope';
import { pcgenNoticeBooks } from '../../scripts/catalog/pcgen-books';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { describeLaunchFeature, REVIEWER } from './class-abilities-596';
import { readPinned } from './pinned-sources';

// Party batch party-data-2 (#539's number, the lowest owning issue of its
// keys): four causes that kept characters 5, 8 and 9 from the party release
// and needed no owner answer.
// - K1, Arcane Pool (Magus), #640: a false #227 scripted match (seven
//   archetypes' pools of the same name) held it on PZO9493 and omitted the
//   Magus; a confirmed, content-bound assessment admits it.
// - K2, Weapon Training, #625: its PZO9491 hold is retired, PZO9491 being a
//   reviewed Registry alias; PZO9493's stays the owner's.
// - K3, Snowball, #539: Reign of Winter part 1 (PZO9067) joins the notice
//   books on its own OGL.txt line; the record step checked its confirmation
//   on a captured review, which admits Snowball.
// - K6, Bloodline Arcana (character 5): matched through the Efreeti
//   Bloodline record that folds it in.
const PARTY_REVIEWED_ON = '2026-11-14';
const ARCANE_POOL = 'pf1/mpe3JHJMINddqLWr';
const MAGUS = 'pf1/xZLcyrEKYZoJPS2k';
const WEAPON_TRAINING = 'pf1/RzEzudurxQFirFoF';
const SNOWBALL = 'pf1/rm5kl4j5srzgr333';
const EFREETI_BLOODLINE = 'pf1/Ce5bdKql2WZR8AsL';
const PZO9067_RECEIPT =
  't3-review-8a163712399286d52a6ef7e5a30e162c32db58a5ffd04cc21452c6d5da110c14';

const entriesOf = (path: string) =>
  z
    .object({ entries: z.array(importedCatalogEntrySchema) })
    .parse(JSON.parse(readFileSync(path, 'utf8')))
    .entries as unknown as PreviewEntry[];
const fixtureEntry = (path: string, key: string) => {
  const entry = entriesOf(path).find((row) => row.externalKey === key);
  if (!entry) throw new Error(`${path} lacks ${key}`);
  return entry;
};

/** A release artifact over these entries, every upstream record in scope. */
function artifactOf(rows: PreviewEntry[]) {
  return {
    curation: { missing: [], unresolvedMechanics: [] },
    catalog: { entries: rows, resources: [] as PreviewEntry[], remaps: [] },
    comparison: {
      coverageComplete: true,
      summary: {
        upstreamRecords: rows.length,
        admitted: rows.length,
        excluded: 0,
        unassigned: 0,
        byKind: {},
      },
      packs: [],
      records: [...new Set(rows.map((entry) => entry.upstreamKey))].map(
        (upstreamKey) => ({
          repo: 'pf1',
          pack: 'class-abilities',
          path: `${upstreamKey}.yaml`,
          externalKey: upstreamKey,
          name: upstreamKey,
          status: 'admitted' as const,
          reason: 'In scope',
        }),
      ),
    },
  };
}
/** The release gate under the #227 rule over the committed data, or as given. */
const gateOver = (
  rows: PreviewEntry[],
  options: Partial<Parameters<typeof assessCatalogAdmission>[0]> = {},
) =>
  assessCatalogAdmission({
    artifact: artifactOf(rows),
    ...reviewedAdmission,
    attributionPath: {
      kind: 'declared-book',
      rule: committedAttribution227,
      matches: committedAttribution227Matches,
    },
    ...options,
  });

describe('K1: Arcane Pool (Magus), a false scripted match', () => {
  const { candidate, entry } = describeLaunchFeature({
    batch: 640,
    key: ARCANE_POOL,
    name: 'Arcane Pool',
    disposition: 'admitted',
    reviewer: REVIEWER,
    reviewedOn: PARTY_REVIEWED_ON,
    books: ['PZO1117'],
    classes: [MAGUS],
  });
  const withoutAssessment = reviewedAdmission.assessments.filter(
    (row) => row.externalKey !== ARCANE_POOL,
  );
  // The Magus and its full-corpus closure, the row aside.
  const closure = [
    ...entriesOf('tests/fixtures/party-data-539/dependents.json'),
    entry,
  ];

  it('records it at Magus 1st through 20th on the Magus’s book and Unchained’s, its body the PRD text', () => {
    expect(candidate.requiredNotices).toEqual(['PZO1117', 'PZO1131']);
    expect(
      candidate.mechanicsReview.classFeatureReview.schedule.map(
        (row) => row.value,
      ),
    ).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5]);
    expect(candidate.prdComparison.lines.map((row) => row.line)).toEqual([
      395, 396, 397, 398,
    ]);
    expect(candidate.comparison.literalRow).toMatch(
      /^Arcane Pool\t+KEY:Magus ~ Arcane Pool\t/,
    );
  });

  it('is held on PZO9493 through the archetypes’ lines without its assessment, and admitted on it now', () => {
    const match = committedAttribution227Matches.matches.find(
      (row) => row.externalKey === ARCANE_POOL,
    );
    expect(match?.status).toBe('matched');
    const lines =
      match?.status === 'matched'
        ? match.evidence.flatMap((item) =>
            item.kind === 'pcgen' ? [`${item.file}:${item.line}`] : [],
          )
        : [];
    // Its own row and the seven archetypes' pools of the same name.
    expect(lines).toContain(
      'roleplaying_game/ultimate_magic/um_abilities_class.lst:40',
    );
    expect(lines).toContain(
      'player_companion/martial_arts_handbook/mah_abilities_class.lst:29',
    );
    expect(lines).toHaveLength(8);
    expect(
      match?.status === 'matched'
        ? match.evidence.filter((item) => item.kind === 'stored-assessment')
        : [],
    ).toEqual([
      {
        kind: 'stored-assessment',
        notices: ['PZO1117', 'PZO1131'],
        batch: 'scripts/catalog/legal/class-abilities-640.json',
        comparison: {
          file: 'roleplaying_game/ultimate_magic/um_abilities_class.lst',
          line: 40,
        },
      },
    ]);

    const base = gateOver([entry], { assessments: withoutAssessment });
    expect(base.admitted).toEqual([]);
    expect(base.held.map((row) => row.externalKey)).toEqual([ARCANE_POOL]);
    expect(base.held[0]?.reason).toMatch(
      /^Held under #227: scripted match .* lacks reviewed notices: PZO9493\.$/,
    );

    const now = gateOver([entry]);
    expect(now.failures).toEqual([]);
    expect(now.held).toEqual([]);
    expect(
      now.admitted.find((row) => row.externalKey === ARCANE_POOL),
    ).toMatchObject({
      requiredNotices: ['PZO1117', 'PZO1131'],
      missingNotices: [],
    });
  });

  it('omits the Magus for it alone without its assessment, and admits the whole closure with it', () => {
    const base = gateOver(closure, { assessments: withoutAssessment });
    expect(base.failures).toEqual([]);
    expect(base.held.map((row) => row.externalKey)).toEqual([ARCANE_POOL]);
    expect(
      base.dependentOmissions.map((row) => [row.externalKey, row.reason]),
    ).toEqual([[MAGUS, `Dependent omission: ${ARCANE_POOL}.`]]);

    const now = gateOver(closure);
    expect(now.failures).toEqual([]);
    expect(now.held).toEqual([]);
    expect(now.dependentOmissions).toEqual([]);
    expect(now.admitted.map((row) => row.externalKey).sort()).toEqual(
      closure.map((row) => row.externalKey).sort(),
    );
  });
});

describe('K2: Weapon Training’s stale PZO9491 hold', () => {
  const entry = fixtureEntry(
    'tests/fixtures/class-abilities-625/preview.json',
    WEAPON_TRAINING,
  );

  it('reads PZO9491 as the reviewed Heroes from the Fringe line through its alias', () => {
    const [key, notice] =
      Object.entries(reviewedAdmission.registry).find(([, row]) =>
        row.aliases.includes('PZO9491'),
      ) ?? [];
    expect(key).toBe(
      'pf1-content/notice/be3193ca396c387da0ad63e7a2d1ed9d2909fed5561cd9c42ab56914585bcf07',
    );
    expect(notice?.reviewStatus).toBe('reviewed');
    expect(notice?.title).toBe(
      'Pathfinder Player Companion: Heroes from the Fringe',
    );
  });

  it('keeps only the PZO9493 hold, in the committed exception and on the gate', () => {
    expect(
      committedAttribution227.exceptions.find(
        (row) =>
          row.kind === 'retained-hold' && row.externalKey === WEAPON_TRAINING,
      ),
    ).toMatchObject({
      batch: 'scripts/catalog/legal/class-abilities-625.json',
      holdIds: ['class-abilities-625-owner-owed-PZO9493'],
    });
    const result = gateOver([entry]);
    expect(result.failures).toEqual([]);
    expect(result.held.map((row) => [row.externalKey, row.reason])).toEqual([
      [
        WEAPON_TRAINING,
        'Held under #227: named holds kept: class-abilities-625-owner-owed-PZO9493 (scripts/catalog/legal/class-abilities-625.json).',
      ],
    ]);
  });
});

describe('K3: Reign of Winter part 1 (PZO9067), a book with its own Section 15 line', () => {
  const snowball = fixtureEntry(
    'tests/fixtures/spells-539/preview.json',
    SNOWBALL,
  );
  const row = pcgenNoticeBooks.books.find(({ code }) => code.id === 'PZO9067');
  const confirmation = committedSection15Confirmations.find(
    (item) => item.code === 'PZO9067',
  );

  it('is a notice book outside the crosswalk, its code reviewed and its own line matched and checked', async () => {
    expect(row).toMatchObject({
      book: 'Reign of Winter, Part 1: The Snows of Summer',
      packs: [
        {
          folder: 'adventure_path/reign_of_winter/ap67',
          pcc: 'adventure_path/reign_of_winter/ap67/ap67.pcc',
        },
      ],
      // The code row stays drafted, as PZO90116's does: the record step
      // checks the confirmation, not the crosswalk row.
      code: {
        id: 'PZO9067',
        match: 'reviewed',
        foundryName: 'Reign of Winter #1: The Snows of Summer',
        review: { status: 'drafted' },
      },
      registry: null,
    });
    expect(confirmation).toMatchObject({
      status: 'matched',
      ownLine: {
        line: 49,
        title: 'Pathfinder Adventure Path #67: The Snows of Summer',
        titleFrom: 'own-line-alias',
      },
      review: {
        status: 'checked',
        reviewedOn: PARTY_REVIEWED_ON,
        receipt: PZO9067_RECEIPT,
      },
    });
    const text = await readPinned(
      'pcgen',
      'data/pathfinder/paizo/adventure_path/reign_of_winter/ap67/OGL.txt',
    );
    expect(createHash('sha256').update(text).digest('hex')).toBe(
      confirmation?.status === 'matched' ? confirmation.pcgen.sha256 : '',
    );
    expect(text.split('\n')[48]).toBe(
      'Pathfinder Adventure Path #67: The Snows of Summer Copyright 2013, Paizo Publishing, LLC; Author: Neil Spicer.',
    );
    expect(reviewedAdmission.registry['pcgen:PZO9067']?.reviewStatus).toBe(
      'reviewed',
    );
  });

  it('admits Snowball on the checked confirmation', () => {
    const now = gateOver([snowball]);
    expect(now.failures).toEqual([]);
    expect(now.held).toEqual([]);
    const admitted = now.admitted.find((item) => item.externalKey === SNOWBALL);
    expect(admitted).toMatchObject({ missingNotices: [] });
    expect(admitted?.requiredNotices).toContain('pcgen:PZO9067');
  });

  it('holds Snowball on PZO9067 when the confirmation is drafted', () => {
    // The state the batch was written in, before the record step.
    const drafted = committedSection15Confirmations.map((item) =>
      item.code === 'PZO9067'
        ? { ...item, review: { status: 'drafted' as const } }
        : item,
    );
    const record = reviewedAdmission.registry['pcgen:PZO9067']!;
    const before = gateOver([snowball], {
      registry: {
        ...reviewedAdmission.registry,
        'pcgen:PZO9067': { ...record, reviewStatus: 'unreviewed' },
      },
      section15: { confirmations: drafted },
    });
    expect(before.admitted).toEqual([]);
    expect(before.held.map((item) => [item.externalKey, item.reason])).toEqual([
      [
        SNOWBALL,
        'Held under #227: declared book PZO1140, PZO9067, PZO9428 lacks reviewed notices: PZO9067.',
      ],
    ]);
  });
});

describe('K6: Bloodline Arcana, matched through its bloodline', () => {
  const bytes = readFileSync(partyBuildsPath, 'utf8');
  const builds = parsePartyBuilds(JSON.parse(bytes));
  const five = builds.characters.find((row) => row.id === '5')!;

  it('leaves character 5 no unmatched name, and matches the sheet’s word on the Efreeti Bloodline', () => {
    expect(partyCharacterGaps(five)).toEqual([]);
    expect(five.keys.bloodlinesAndDomains).toEqual([
      {
        kind: 'matched',
        key: EFREETI_BLOODLINE,
        name: 'Efreeti Bloodline',
        note: expect.stringContaining('"Bloodline Arcana"'),
      },
    ]);
  });

  it('is the Efreeti Bloodline root of the committed scope, from these builds', async () => {
    const scope = decodePartyScope(
      JSON.parse(readFileSync(partyScopePath, 'utf8')),
    );
    expect(scope.binding.builds.sha256).toBe(
      createHash('sha256').update(bytes).digest('hex'),
    );
    expect(
      scope.roots.find((root) => root.key === EFREETI_BLOODLINE),
    ).toMatchObject({ characters: ['5'] });
    // The bloodline record is the one that states it.
    const body = await readPinned(
      'pf1',
      'packs/class-abilities/efreeti-bloodline.Ce5bdKql2WZR8AsL.yaml',
    );
    expect(body).toContain('<p><b>Bloodline Arcana:</b> Whenever you cast');
  });
});
