// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
} from '../../scripts/catalog/admission';
import type { Section15Confirmation } from '../../scripts/catalog/legal/section15-confirmations';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import { committedNoticeClearances } from '../../scripts/catalog/legal/notice-clearances';
import {
  mapEntry,
  upstreamRecord,
  type PreviewEntry,
} from '../../scripts/catalog/map';
import type {
  AttributionAssessment,
  AttributionEvidence,
  Section15Registry,
} from '../../src/lib/catalog/admission-schema';
import { buildLegalPageData } from '../../src/lib/catalog/legal-page-data';
import {
  legalResources,
  reviewedAdmission,
} from '../../src/lib/catalog/reviewed-data';
import { draftedSection15, settledSection15 } from './section15-drafted';

// #716 P10a, plan §7 "Which holds clear" and "Candidate eligibility": the
// gate with #716 candidates from pinned PCGen records. The confirmations are
// the matcher's over the pinned files, settled in memory so each waives every
// chain hold committed now (`settledSection15`; a later batch's chain hold
// would otherwise lag and hold the book's #716 records, fail closed), as the
// implementer would write them (drafted), with six marked checked here in
// memory only, as the orchestrator's record step would after Sol's review.
const receipt = {
  status: 'checked' as const,
  reviewedBy: 'Sol (AI review) for the owner',
  reviewedOn: '2026-10-20',
  receipt: 'reviewer-20261020-000000-1',
};
const settled = await settledSection15();
const asWritten = draftedSection15({
  confirmations: settled.state.previous,
  registry: settled.state.registry,
});
const confirmationOf = (code: string) => {
  const confirmation = asWritten.confirmations.find((row) => row.code === code);
  if (!confirmation) throw new Error(`No confirmation ${code}.`);
  return confirmation;
};
const checkedCodes = [
  'PZO1140',
  'PZO9213',
  'PZO9450',
  'PZO9451',
  'PZO9452',
  'PZO9464',
];
const checked: Section15Confirmation[] = asWritten.confirmations.map((row) =>
  checkedCodes.includes(row.code) ? { ...row, review: receipt } : row,
);
/** The Registry once the record step has checked those books' confirmations. */
const registry: Section15Registry = Object.fromEntries(
  Object.entries(asWritten.registry).map(([key, notice]) => [
    key,
    checkedCodes.some((code) => key === `pcgen:${code}`)
      ? { ...notice, reviewStatus: 'reviewed', checkedOn: receipt.reviewedOn }
      : notice,
  ]),
);
const registryKeyOf = (code: string) => {
  const key = confirmationOf(code).registry.key;
  if (!key) throw new Error(`${code} has no Registry notice.`);
  return key;
};

/** A #716 archetype as the importer will emit it: an `everythingpath/` key with its PCGen locator and book code. */
function pcgenArchetype({
  slug,
  file,
  key,
  name,
  book,
}: {
  slug: string;
  file: string;
  key: string;
  name: string;
  book: string;
}): PreviewEntry {
  return {
    externalKey: `everythingpath/${slug}`,
    upstreamKey: `pcgen:${file}#${key}`,
    pack: file.slice(0, file.lastIndexOf('/')),
    name,
    detail: { kind: 'archetype', classKeys: [], replaces: [], adds: [] },
    description: `<p>${name}.</p>`,
    sources: [{ book }],
    modifiers: [],
    unsupported: [],
  };
}
// roleplaying_game/ultimate_wilderness/uw_abilities_class.lst:120
const herbalist = pcgenArchetype({
  slug: 'alchemist-herbalist',
  file: 'roleplaying_game/ultimate_wilderness/uw_abilities_class.lst',
  key: 'Alchemist Archetype ~ Herbalist',
  name: 'Herbalist',
  book: 'PZO1140',
});
// player_companion/champions_of_corruption/coc_abilities_class.lst:12
const dreadVanguard = pcgenArchetype({
  slug: 'paladin-dread-vanguard',
  file: 'player_companion/champions_of_corruption/coc_abilities_class.lst',
  key: 'Paladin Archetype ~ Dread Vanguard',
  name: 'Dread Vanguard',
  book: 'PZO9450',
});
// player_companion/ranged_tactics_toolbox/rtt_abilities_class.lst:39
const primalHunter = pcgenArchetype({
  slug: 'barbarian-primal-hunter',
  file: 'player_companion/ranged_tactics_toolbox/rtt_abilities_class.lst',
  key: 'Barbarian Archetype ~ Primal Hunter',
  name: 'Primal Hunter',
  book: 'PZO9452',
});
// player_companion/agents_of_evil/support/aoe_abilities_class_pu.lst:7, an
// Unchained Summoner archetype, so it requires PZO1131 too.
const devilImpostor = pcgenArchetype({
  slug: 'unchained-summoner-devil-impostor',
  file: 'player_companion/agents_of_evil/support/aoe_abilities_class_pu.lst',
  key: 'Unchained Summoner ~ Devil Impostor',
  name: 'Devil Impostor',
  book: 'PZO9464',
});
// player_companion/advanced_class_origins/aco_abilities_class.lst:10
const twilightSage = pcgenArchetype({
  slug: 'arcanist-twilight-sage',
  file: 'player_companion/advanced_class_origins/aco_abilities_class.lst',
  key: 'Arcanist Archetype ~ Twilight Sage',
  name: 'Twilight Sage',
  book: 'PZO9451',
});
// campaign_setting/book_of_the_damned_volume_1/botd1_classes.lst:6
const diabolist: PreviewEntry = {
  ...pcgenArchetype({
    slug: 'diabolist',
    file: 'campaign_setting/book_of_the_damned_volume_1/botd1_classes.lst',
    key: 'Diabolist',
    name: 'Diabolist',
    book: 'PZO9213',
  }),
  detail: { kind: 'feat', featTypes: [], repeatable: 'unreviewed' },
};
/**
 * The #328 Ghoran (`pf1/2mWMyKiPWk6Y8cNx`, PZO1140 p. 15) with its committed,
 * unresolved Attribution Assessment; a stand-in body, since the gate reads
 * only its key, sources and assessment here.
 */
const ghoran: PreviewEntry = {
  externalKey: 'pf1/2mWMyKiPWk6Y8cNx',
  upstreamKey: 'pf1/2mWMyKiPWk6Y8cNx',
  pack: 'races',
  name: 'Ghoran',
  detail: { kind: 'feat', featTypes: [], repeatable: 'unreviewed' },
  description: '<p>Ghoran.</p>',
  sources: [{ book: 'PZO1140', pages: '15' }],
  modifiers: [],
  unsupported: [],
};
const ghoranAssessment = reviewedAdmission.assessments.find(
  ({ externalKey }) => externalKey === ghoran.externalKey,
);
if (!ghoranAssessment) throw new Error('No #328 Ghoran assessment.');

function artifactOf(entries: PreviewEntry[]) {
  return {
    catalog: { entries, resources: [] as PreviewEntry[] },
    comparison: {
      packs: [],
      records: entries.map((entry) => ({
        repo: entry.upstreamKey.startsWith('pcgen:') ? 'pcgen' : 'pf1',
        pack: entry.pack,
        path: entry.upstreamKey,
        externalKey: entry.upstreamKey,
        name: entry.name,
        status: 'admitted' as const,
        reason: 'In scope',
      })),
    },
  };
}
const evidence: AttributionEvidence = {
  comparison: { content: 'Fixture: whole content compared with the book.' },
};
/** A confirmed assessment of the candidate, bound to the notices it requires. */
function confirm({
  entry,
  requiredNotices,
  artifact,
}: {
  entry: PreviewEntry;
  requiredNotices: string[];
  artifact: ReturnType<typeof artifactOf>;
}): AttributionAssessment {
  return {
    externalKey: entry.externalKey,
    status: 'confirmed',
    ...buildAssessmentBinding({
      entry,
      artifact,
      evidence,
      registry,
      requiredNotices,
      evidenceIds: ['comparison'],
    }),
    requiredNotices,
    rationale: 'Fixture: the complete definition matches its book.',
    reviewedBy: 'Fixture reviewer',
    reviewedOn: '2026-10-20',
  };
}
/**
 * The gate over these candidates and the #328 Ghoran. Unless told otherwise
 * it clears no hold, so the hold rules show; the committed clearance (owner,
 * 2026-10-30) clears every one.
 */
function gate({
  candidates,
  confirmations = checked,
  currentSha256,
  clearedHoldIds = [],
}: {
  candidates: { entry: PreviewEntry; requiredNotices: string[] }[];
  confirmations?: Section15Confirmation[];
  currentSha256?: (path: string) => string | undefined;
  clearedHoldIds?: readonly string[];
}) {
  const artifact = artifactOf([
    ...candidates.map(({ entry }) => entry),
    ghoran,
  ]);
  return assessCatalogAdmission({
    artifact,
    registry,
    evidence,
    assessments: [
      ...candidates.map(({ entry, requiredNotices }) =>
        confirm({ entry, requiredNotices, artifact }),
      ),
      ghoranAssessment!,
    ],
    section15: { confirmations, ...(currentSha256 ? { currentSha256 } : {}) },
    clearedHoldIds,
  });
}
const heldOn = (code: string) =>
  heldNotices
    .filter(({ notices }) => notices.includes(code))
    .map(({ id }) => id);

describe('a #716 candidate of a matched book', () => {
  const uwNotice = registryKeyOf('PZO1140');
  const herbalistNotices = ['pcgen:PZO1140', uwNotice];

  it('requires the Ultimate Wilderness notice and pcgen:PZO1140, and passes the waived chain holds', () => {
    expect(heldOn('PZO1140')).toContain('race-328-notice-PZO1140');
    expect(confirmationOf('PZO1140').waivedHoldIds).toContain(
      'race-328-notice-PZO1140',
    );
    const result = gate({
      candidates: [{ entry: herbalist, requiredNotices: herbalistNotices }],
    });
    expect(result.admitted).toEqual([
      expect.objectContaining({
        externalKey: herbalist.externalKey,
        requiredNotices: herbalistNotices,
        missingNotices: [],
      }),
    ]);
    expect(result.requiredNotices).toEqual(herbalistNotices);
  });

  it('holds it while its confirmation lags a chain hold it doesn’t waive yet', () => {
    // The fail-closed lag (plan §7, waivers): a chain hold registered after
    // the confirmation was checked holds the book's #716 records until a
    // redrafted confirmation waives it and is reviewed again.
    const late = 'race-328-notice-PZO1140';
    const lagging = checked.map((row) =>
      row.code === 'PZO1140'
        ? {
            ...row,
            waivedHoldIds: row.waivedHoldIds.filter((id) => id !== late),
          }
        : row,
    );
    const result = gate({
      candidates: [{ entry: herbalist, requiredNotices: herbalistNotices }],
      confirmations: lagging,
    });
    expect(result.admitted).toEqual([]);
    const [row] = result.held.filter(
      ({ externalKey }) => externalKey === herbalist.externalKey,
    );
    expect(row).toMatchObject({
      requiredNotices: herbalistNotices,
      missingNotices: [],
      reason: expect.stringMatching(
        new RegExp(`^Notice holds: .*\\b${late}\\b`),
      ),
    });
  });

  it('leaves the #328 Ghoran held with its reason unchanged, and counts PCGen’s block for it too (owner, 2026-10-30)', () => {
    const ghoranWithBlock = {
      ...ghoran,
      externalKey: 'pf1/ghoran-requiring-pcgen-block',
      upstreamKey: 'pf1/ghoran-requiring-pcgen-block',
    };
    const result = gate({
      candidates: [
        { entry: herbalist, requiredNotices: herbalistNotices },
        {
          entry: ghoranWithBlock,
          requiredNotices: ['PZO1140', 'pcgen:PZO1140'],
        },
      ],
    });
    // #716 decision 5, extended to every candidate: the book's code reads
    // as its notices, and only #716 candidates pass the waived chain holds.
    expect(result.admitted.map(({ externalKey }) => externalKey)).toEqual([
      herbalist.externalKey,
    ]);
    expect(result.held).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalKey: ghoran.externalKey,
          reason: ghoranAssessment.rationale,
          requiredNotices: herbalistNotices,
          missingNotices: [],
        }),
        expect.objectContaining({
          externalKey: ghoranWithBlock.externalKey,
          reason: expect.stringMatching(
            /^Notice holds: .*\brace-328-notice-PZO1140\b/,
          ),
          requiredNotices: herbalistNotices,
          missingNotices: [],
        }),
      ]),
    );
  });

  it('admits a Champions of Corruption archetype requiring both readings of its own line', () => {
    const notices = [registryKeyOf('PZO9450'), 'pcgen:PZO9450'].sort();
    const result = gate({
      candidates: [{ entry: dreadVanguard, requiredNotices: notices }],
    });
    expect(result.admitted).toEqual([
      expect.objectContaining({
        externalKey: dreadVanguard.externalKey,
        requiredNotices: notices,
      }),
    ]);
  });

  it('admits an Advanced Class Origins archetype on PCGen’s block alone, as its book has no Registry notice', () => {
    const result = gate({
      candidates: [{ entry: twilightSage, requiredNotices: ['pcgen:PZO9451'] }],
    });
    expect(result.admitted).toEqual([
      expect.objectContaining({ requiredNotices: ['pcgen:PZO9451'] }),
    ]);
  });

  it('publishes pcgen:PZO9451 on the legal page for a release with that archetype, and not without', () => {
    const page = (requiredNotices: string[]) =>
      buildLegalPageData({
        registry,
        resources: legalResources,
        permanentNoticeSuperset: [],
        requiredNotices,
      }).sections[1]?.notices.find(({ id }) => id === 'registry:pcgen:PZO9451');
    const withArchetype = gate({
      candidates: [{ entry: twilightSage, requiredNotices: ['pcgen:PZO9451'] }],
    });
    expect(page(withArchetype.requiredNotices)?.text).toBe(
      registry['pcgen:PZO9451']?.notice,
    );
    const without = gate({ candidates: [] });
    expect(page(without.requiredNotices)).toBeUndefined();
  });

  it('keeps Devil Impostor held on PZO1131, which is never waived', () => {
    // Agents of Evil has no Registry notice; its PCGen block matches.
    expect(confirmationOf('PZO9464').status).toBe('matched');
    const notices = ['PZO1131', 'pcgen:PZO9464'];
    const result = gate({
      candidates: [{ entry: devilImpostor, requiredNotices: notices }],
    });
    expect(result.admitted).toEqual([]);
    expect(result.held).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalKey: devilImpostor.externalKey,
          reason: expect.stringContaining('PZO1131'),
        }),
      ]),
    );
  });

  it('stays held when a changed OGL.txt hash makes the confirmation stale', () => {
    const result = gate({
      candidates: [{ entry: herbalist, requiredNotices: herbalistNotices }],
      currentSha256: () => '0'.repeat(64),
    });
    expect(result.admitted).toEqual([]);
    expect(result.held).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalKey: herbalist.externalKey,
          missingNotices: ['pcgen:PZO1140'],
        }),
      ]),
    );
  });

  it('stays held while its confirmation is drafted', () => {
    const result = gate({
      candidates: [{ entry: herbalist, requiredNotices: herbalistNotices }],
      confirmations: asWritten.confirmations,
    });
    expect(result.admitted).toEqual([]);
  });

  it('never waives a named hold: Princes of Darkness stays held on its variant comparison', () => {
    const notices = ['pcgen:PZO9213', registryKeyOf('PZO9213')].sort();
    expect(confirmationOf('PZO9213').waivedHoldIds).not.toContain(
      'notice-282-princes-of-darkness-variant-320',
    );
    const result = gate({
      candidates: [{ entry: diabolist, requiredNotices: notices }],
    });
    expect(result.admitted).toEqual([]);
    const [row] = result.held.filter(
      ({ externalKey }) => externalKey === diabolist.externalKey,
    );
    expect(row?.reason).toMatch(
      /^Notice holds: .*\(notice-282-princes-of-darkness-variant-320\)\.$/,
    );
  });
});

describe('a #716 candidate of a mismatched book', () => {
  it('keeps a Ranged Tactics Toolbox archetype held under its #716 hold and the earlier holds', () => {
    const notice = registryKeyOf('PZO9452');
    const result = gate({
      candidates: [{ entry: primalHunter, requiredNotices: [notice] }],
    });
    expect(result.admitted).toEqual([]);
    const [row] = result.held.filter(
      ({ externalKey }) => externalKey === primalHunter.externalKey,
    );
    expect(row?.requiredNotices).toEqual([notice]);
    expect(row?.missingNotices).toEqual([]);
    const earlier = [...new Set([...heldOn('PZO9452'), ...heldOn(notice)])];
    expect(earlier.length).toBeGreaterThan(0);
    expect(row?.reason).toBe(
      `Notice holds: ${notice} (${['716-notice-PZO9452-complete-chain', ...earlier].sort().join(', ')}).`,
    );
  });
});

// The Shifter's Kit (Ultimate Wilderness p. 244) as the importer maps its
// pinned record, with the notices its committed assessment requires.
const kitPath = 'packs/items/kit-shifter-s.InAHKpiWiATsMJNe.yaml';
const shiftersKit = mapEntry({
  source: {
    repo: 'pf1',
    pack: 'items',
    path: kitPath,
    record: upstreamRecord.parse(
      parse(await readFile(`tests/fixtures/pinned/pf1/${kitPath}`, 'utf8')),
    ),
  },
  kind: 'item',
  resolveKey: () => undefined,
  lookup: new Map(),
  spellClassTags: new Set(),
});
const kitNotices = reviewedAdmission.assessments.find(
  ({ externalKey }) => externalKey === shiftersKit.externalKey,
)?.requiredNotices;
if (!kitNotices) throw new Error("No Shifter's Kit assessment.");

// Owner decision 2026-10-30 (follow-up): a matched, checked PCGen block counts
// as notice evidence for every candidate of its book, not only #716's.
describe('a candidate of a matched book that isn’t from #716', () => {
  const readNotices = ['PZO1110', 'pcgen:PZO1140', registryKeyOf('PZO1140')];
  const cleared = committedNoticeClearances.cleared.heldNotices;

  it('is the published kit, requiring Ultimate Wilderness and the Core Rulebook', () => {
    expect(shiftersKit).toMatchObject({
      externalKey: 'pf1/InAHKpiWiATsMJNe',
      name: "Kit, Shifter's",
      sources: [{ book: 'PZO1140', pages: '244' }],
      unsupported: [],
    });
    expect([...kitNotices].sort()).toEqual(['PZO1110', 'PZO1140']);
  });

  it('requires and publishes the book’s notices in its code’s place, bound to its own code', () => {
    const result = gate({
      candidates: [{ entry: shiftersKit, requiredNotices: kitNotices }],
      clearedHoldIds: cleared,
    });
    expect(result.admitted).toEqual([
      expect.objectContaining({
        externalKey: shiftersKit.externalKey,
        requiredNotices: readNotices,
        missingNotices: [],
      }),
    ]);
    expect(result.requiredNotices).toEqual(readNotices);
    const page = buildLegalPageData({
      registry,
      resources: legalResources,
      permanentNoticeSuperset: [],
      requiredNotices: result.requiredNotices,
    });
    expect(page.outstandingNotices).toEqual([]);
    expect(
      page.sections[1]?.notices.find(
        ({ id }) => id === 'registry:pcgen:PZO1140',
      )?.text,
    ).toBe(registry['pcgen:PZO1140']?.notice);
  });

  it('stays held on a hold of its book’s code, which only #716 candidates pass', () => {
    const result = gate({
      candidates: [{ entry: shiftersKit, requiredNotices: kitNotices }],
    });
    expect(result.admitted).toEqual([]);
    const [row] = result.held.filter(
      ({ externalKey }) => externalKey === shiftersKit.externalKey,
    );
    expect(row).toMatchObject({
      requiredNotices: readNotices,
      missingNotices: [],
      reason: expect.stringMatching(
        /^Notice holds: .*\brace-328-notice-PZO1140\b/,
      ),
    });
  });

  it.each([
    ['drafted', { confirmations: asWritten.confirmations }],
    ['stale', { currentSha256: () => '0'.repeat(64) }],
  ] as const)(
    'keeps the code missing while the confirmation is %s',
    (_state, options) => {
      const result = gate({
        candidates: [{ entry: shiftersKit, requiredNotices: kitNotices }],
        clearedHoldIds: cleared,
        ...options,
      });
      expect(result.admitted).toEqual([]);
      expect(
        result.held.find(
          ({ externalKey }) => externalKey === shiftersKit.externalKey,
        ),
      ).toMatchObject({
        reason: 'Missing or unreviewed required notices: PZO1140.',
        requiredNotices: ['PZO1110', 'PZO1140'],
        missingNotices: ['PZO1140'],
      });
    },
  );
});

describe('the committed clearance', () => {
  it('clears a #716 book hold: the Ranged Tactics Toolbox archetype is admitted', () => {
    const notice = registryKeyOf('PZO9452');
    const result = gate({
      candidates: [{ entry: primalHunter, requiredNotices: [notice] }],
      clearedHoldIds: committedNoticeClearances.cleared.heldNotices,
    });
    expect(result.admitted).toEqual([
      expect.objectContaining({
        externalKey: primalHunter.externalKey,
        requiredNotices: [notice],
      }),
    ]);
  });
});

describe('retained uses', () => {
  it('count an eligible book’s PCGen block for every definition (owner, 2026-10-30)', () => {
    // #716 decision 5 is extended to every candidate: the block counts
    // whether or not the artifact proves the definition comes from #716.
    const uses = [
      { useId: 'use-716', externalKey: twilightSage.externalKey },
      { useId: 'use-pf1', externalKey: 'pf1/retained-feat' },
      {
        useId: 'use-unproven',
        externalKey: 'everythingpath/retained-without-provenance',
      },
    ].map((use) => ({
      ...use,
      name: 'Retained',
      characterId: 'character-1',
      definitionFingerprint: 'fixture',
      admittedRelease: 1,
      requiredNotices: ['pcgen:PZO9451'],
    }));
    const result = assessCatalogAdmission({
      artifact: artifactOf([twilightSage]),
      registry,
      evidence,
      assessments: [],
      retainedUses: uses,
      retainedExceptions: uses.map(({ useId, externalKey }) => ({
        useId,
        externalKey,
        definitionFingerprint: 'fixture',
        reason: 'Fixture: kept for an existing character.',
        requiredNotices: ['pcgen:PZO9451'],
      })),
      section15: { confirmations: checked },
    });
    expect(
      result.retainedExceptions.map(({ useId, missingNotices }) => [
        useId,
        missingNotices,
      ]),
    ).toEqual([
      ['use-716', []],
      ['use-pf1', []],
      ['use-unproven', []],
    ]);
  });
});
