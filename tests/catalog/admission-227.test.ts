// @vitest-environment node
import { describe, expect, expectTypeOf, it } from 'vitest';
import { parse } from 'yaml';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
  type AttributionPath,
} from '../../scripts/catalog/admission';
import {
  attribution227Schema,
  committedAttribution227,
  declaredBookCode,
  declaredBookTitles,
  describeAttribution227Decision,
  holdsUnderAttribution227,
  type Attribution227Decision,
  type Attribution227Rule,
} from '../../scripts/catalog/legal/attribution-227';
import { heldNoticeInForce } from '../../scripts/catalog/legal/notice-clearances';
import { readLaunchLegalInventories } from '../../scripts/catalog/launch-inventory-sources';
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
import { legalResources } from '../../src/lib/catalog/legal-resources-data';
import { resolveNotice } from '../../src/lib/catalog/resolve-notice';
import { section15Registry } from '../../src/lib/catalog/section15-registry-data';
import { readPinned } from './pinned-sources';

// The #227 rule (owner decision 2026-11-10, item 1; design
// `research/admission-227-design.md` §A): with no assessment, an unresolved
// one or a confirmed one whose bindings drifted, the gate admits a definition
// on its declared book when every notice that book needs is a reviewed
// Registry record, no hold is in force and its key is no exception. Pinned
// Foundry records, the committed Registry.

async function pinnedRecord(pack: string, path: string) {
  return {
    repo: 'pf1' as const,
    pack,
    path,
    record: upstreamRecord.parse(parse(await readPinned('pf1', path))),
  };
}

/** A pinned record as the importer maps it, its links resolving to `linked`. */
async function pinnedEntry({
  pack,
  path,
  kind,
  linked = [],
}: {
  pack: string;
  path: string;
  kind: 'feat' | 'spell' | 'classFeature';
  linked?: Awaited<ReturnType<typeof pinnedRecord>>[];
}): Promise<PreviewEntry> {
  const lookup = new Map(
    linked.map((source) => [`pf1/${source.record._id}`, source]),
  );
  return mapEntry({
    source: await pinnedRecord(pack, path),
    kind,
    resolveKey: (key) => (lookup.has(key) ? key : undefined),
    lookup,
    spellClassTags: new Set(),
  });
}

// Core Rulebook p. 117 (PZO1110).
const alertness = await pinnedEntry({
  pack: 'feats',
  path: 'packs/feats/alertness.Q1cY8r0Pvb66pMG0.yaml',
  kind: 'feat',
});
// Core Rulebook p. 122 (PZO1110).
const dodge = await pinnedEntry({
  pack: 'feats',
  path: 'packs/feats/dodge.JreaiTHdyWFNj3Tb.yaml',
  kind: 'feat',
});
// Core Rulebook p. 130 (PZO1110): its prerequisite links Dodge.
const mobilityWithDodge = await pinnedEntry({
  pack: 'feats',
  path: 'packs/feats/mobility.R7L4SlGRlnThqFrP.yaml',
  kind: 'feat',
  linked: [
    await pinnedRecord('feats', 'packs/feats/dodge.JreaiTHdyWFNj3Tb.yaml'),
  ],
});
// The same record without Dodge: its link is unresolved.
const mobilityAlone = await pinnedEntry({
  pack: 'feats',
  path: 'packs/feats/mobility.R7L4SlGRlnThqFrP.yaml',
  kind: 'feat',
});
// Ranged Tactics Toolbox p. 30 (PZO9452): no reviewed Registry notice.
const bloodyArrows = await pinnedEntry({
  pack: 'spells',
  path: 'packs/spells/bloody-arrows.z0xmgt8qucfgpn9c.yaml',
  kind: 'spell',
});
// Core Rulebook p. 34 and Advanced Class Guide p. 16.
const damageReduction = await pinnedEntry({
  pack: 'class-abilities',
  path: 'packs/class-abilities/damage-reduction.RENIeTVjWB7Mq6Mw.yaml',
  kind: 'classFeature',
});
/** The Barbarian table's 10th-level row, as the schedule overlay emits it. */
const damageReduction10: PreviewEntry = {
  externalKey: 'everythingpath/barbarian-damage-reduction-10',
  upstreamKey: damageReduction.upstreamKey,
  pack: 'everythingpath-schedules',
  name: 'Damage Reduction 2/—',
  detail: {
    kind: 'classFeature',
    parentFeature: damageReduction.externalKey,
    part: `10:${damageReduction.externalKey}`,
  },
  description:
    "<p>Damage Reduction 2/—: the Barbarian table's 10th-level row of Damage Reduction (Pathfinder RPG Core Rulebook pp. 31–34). The Damage Reduction entry's own rules give its value.</p>",
  sources: [{ book: 'Pathfinder RPG Core Rulebook', pages: '31–34' }],
  modifiers: [],
  unsupported: [],
  attributionFrom: damageReduction.externalKey,
};

const evidence: AttributionEvidence = {
  'alertness-comparison': {
    content: 'Alertness compared with Core Rulebook p. 117.',
  },
};
const noRule: Attribution227Rule = {
  ...committedAttribution227,
  exceptions: [],
};

function artifactOf(entries: PreviewEntry[]) {
  const summary = {
    upstreamRecords: entries.length,
    admitted: entries.length,
    excluded: 0,
    unassigned: 0,
    byKind: {},
  };
  return {
    curation: { missing: [], unresolvedMechanics: [] },
    catalog: { entries, resources: [] as PreviewEntry[], remaps: [] },
    comparison: {
      coverageComplete: true,
      summary,
      packs: [],
      records: [...new Set(entries.map((entry) => entry.upstreamKey))].map(
        (upstreamKey) => ({
          repo: 'pf1',
          pack: 'feats',
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

function gate({
  entries,
  assessments = [],
  registry = section15Registry,
  attribution227 = noRule,
  assessmentsOnly = false,
  clearedHoldIds,
  missingCuration = [],
}: {
  entries: PreviewEntry[];
  assessments?: AttributionAssessment[];
  registry?: Section15Registry;
  attribution227?: Attribution227Rule;
  /** Run the gate on the assessment path alone, as a batch's tests do. */
  assessmentsOnly?: boolean;
  clearedHoldIds?: string[];
  missingCuration?: string[];
}) {
  const artifact = artifactOf(entries);
  return assessCatalogAdmission({
    artifact: {
      ...artifact,
      curation: {
        missing: missingCuration.map((externalKey) => ({
          externalKey,
          kind: 'note' as const,
          target: 'skill.per',
          text: 'Fixture note.',
          textSha256: '0'.repeat(64),
        })),
        unresolvedMechanics: [],
      },
    },
    assessments,
    registry,
    evidence,
    attributionPath: assessmentsOnly
      ? { kind: 'assessments-only' }
      : { kind: 'declared-book', rule: attribution227 },
    ...(clearedHoldIds ? { clearedHoldIds } : {}),
  });
}

/** Alertness's confirmed assessment, bound to `bound` (its content then). */
function confirmedAlertness(bound: PreviewEntry): AttributionAssessment {
  return {
    externalKey: alertness.externalKey,
    status: 'confirmed',
    ...buildAssessmentBinding({
      entry: bound,
      artifact: artifactOf([bound]),
      evidence,
      registry: section15Registry,
      requiredNotices: ['PZO1110'],
      evidenceIds: ['alertness-comparison'],
    }),
    requiredNotices: ['PZO1110'],
    rationale: 'Alertness matches Core Rulebook p. 117.',
    reviewedBy: 'Fixture reviewer',
    reviewedOn: '2026-11-11',
  };
}

const keys = (rows: { externalKey: string }[]) =>
  rows.map(({ externalKey }) => externalKey).sort();
const rowOf = (rows: { externalKey: string; reason: string }[], key: string) =>
  rows.find((row) => row.externalKey === key);

describe('admission on the declared book (#227)', () => {
  it('admits a definition with no assessment on its declared, reviewed book', () => {
    const result = gate({ entries: [alertness] });
    expect(result.passed).toBe(true);
    expect(keys(result.admitted)).toEqual([alertness.externalKey]);
    expect(result.admitted[0]).toMatchObject({
      reason: 'Admitted under #227: declared book PZO1110.',
      requiredNotices: ['PZO1110'],
      missingNotices: [],
    });
  });

  it('admits a definition whose assessment is unresolved', () => {
    const unresolved: AttributionAssessment = {
      ...confirmedAlertness(alertness),
      status: 'unresolved',
      rationale:
        'feats-000-whole-content-Q1cY8r0Pvb66pMG0: no complete comparison.',
    };
    const result = gate({ entries: [alertness], assessments: [unresolved] });
    expect(keys(result.admitted)).toEqual([alertness.externalKey]);
    expect(rowOf(result.admitted, alertness.externalKey)?.reason).toBe(
      'Admitted under #227: declared book PZO1110.',
    );
  });

  it('keeps an unresolved assessment’s own notices as required ones', () => {
    const unresolved: AttributionAssessment = {
      ...confirmedAlertness(alertness),
      status: 'unresolved',
      requiredNotices: ['PZO1115'],
    };
    const result = gate({ entries: [alertness], assessments: [unresolved] });
    expect(result.admitted[0]?.requiredNotices).toEqual(['PZO1110', 'PZO1115']);
  });

  it('holds a declared book without a reviewed notice, naming it', () => {
    const result = gate({ entries: [bloodyArrows] });
    expect(result.admitted).toEqual([]);
    expect(result.held).toEqual([
      expect.objectContaining({
        externalKey: bloodyArrows.externalKey,
        reason:
          'Held under #227: declared book PZO9452 lacks reviewed notices: PZO9452.',
        missingNotices: ['PZO9452'],
      }),
    ]);
    expect(result.passed).toBe(true);
  });

  it('counts only a reviewed Registry record as the notice', () => {
    // The Core Rulebook's record is keyed CRB, with PZO1110 as an alias.
    const { CRB: crb, ...rest } = section15Registry;
    if (!crb?.aliases.includes('PZO1110'))
      throw new Error('The Registry has no CRB record for PZO1110.');
    const unreviewed = {
      ...rest,
      CRB: { ...crb, reviewStatus: 'unreviewed' as const },
    };
    expect(gate({ entries: [alertness], registry: unreviewed }).held).toEqual([
      expect.objectContaining({
        reason:
          'Held under #227: declared book PZO1110 lacks reviewed notices: PZO1110.',
      }),
    ]);
    expect(gate({ entries: [alertness], registry: rest }).admitted).toEqual([]);
  });

  it('holds a definition while a notice hold on its book is in force', () => {
    // Uncleared, the batches' notice-chain holds on the Advanced Class
    // Guide hold Damage Reduction.
    const result = gate({ entries: [damageReduction], clearedHoldIds: [] });
    expect(result.admitted).toEqual([]);
    expect(rowOf(result.held, damageReduction.externalKey)?.reason).toMatch(
      /^Held under #227: notice holds PZO1129 \(.+-notice-PZO1129-complete-chain.*\)\.$/,
    );
    expect(gate({ entries: [damageReduction] }).held).toEqual([]);
  });

  it('holds an exception key with its reason', () => {
    const rule: Attribution227Rule = {
      ...committedAttribution227,
      exceptions: [
        {
          kind: 'retained-hold',
          externalKey: alertness.externalKey,
          batch: 'scripts/catalog/legal/feats-000.json',
          holdIds: ['feats-000-broken-reference-Q1cY8r0Pvb66pMG0'],
        },
        {
          kind: 'reviewed',
          externalKey: dodge.externalKey,
          reason: 'The declared book is a reprint of another book.',
        },
      ],
    };
    const result = gate({ entries: [alertness, dodge], attribution227: rule });
    expect(result.admitted).toEqual([]);
    expect(rowOf(result.held, alertness.externalKey)?.reason).toBe(
      'Held under #227: named holds kept: feats-000-broken-reference-Q1cY8r0Pvb66pMG0 (scripts/catalog/legal/feats-000.json).',
    );
    expect(rowOf(result.held, dodge.externalKey)?.reason).toBe(
      'Held under #227: reviewed exception: The declared book is a reprint of another book.',
    );
  });

  it('admits a confirmed assessment whose bindings drifted on its declared book', () => {
    const before = { ...alertness, description: '<p>Earlier text.</p>' };
    const result = gate({
      entries: [alertness],
      assessments: [confirmedAlertness(before)],
    });
    expect(result.held).toEqual([]);
    expect(rowOf(result.admitted, alertness.externalKey)?.reason).toBe(
      'Admitted under #227: declared book PZO1110.',
    );
  });

  it('still admits a current confirmed assessment on its own rationale', () => {
    const result = gate({
      entries: [alertness],
      assessments: [confirmedAlertness(alertness)],
    });
    expect(rowOf(result.admitted, alertness.externalKey)?.reason).toBe(
      'Alertness matches Core Rulebook p. 117.',
    );
  });

  it('keeps revoked evidence revoked: the row is held, not admitted on its book', () => {
    const result = assessCatalogAdmission({
      artifact: artifactOf([alertness]),
      assessments: [confirmedAlertness(alertness)],
      registry: section15Registry,
      evidence: {
        'alertness-comparison': {
          content: 'Alertness compared with Core Rulebook p. 117.',
          revoked: true,
        },
      },
      attributionPath: { kind: 'declared-book', rule: noRule },
    });
    expect(result.admitted).toEqual([]);
    expect(result.held[0]?.reason).toMatch(/alertness-comparison \(revoked\)/);
  });

  it('fails a broken reference as before', () => {
    const result = gate({ entries: [mobilityAlone] });
    expect(result.admitted).toEqual([]);
    expect(result.failures).toEqual([
      {
        externalKey: mobilityAlone.externalKey,
        reason: 'Broken structure or reference: unresolved imported reference.',
      },
    ]);
  });

  it('keeps an importer hold in front of the rule', () => {
    const held = {
      ...alertness,
      unsupported: [
        ...alertness.unsupported,
        { field: 'attribution', reason: 'Importer attribution hold.' },
      ],
    };
    expect(gate({ entries: [held] }).held).toEqual([
      expect.objectContaining({ reason: 'Importer attribution hold.' }),
    ]);
  });

  it('omits a definition that references one the rule holds', () => {
    const rule: Attribution227Rule = {
      ...committedAttribution227,
      exceptions: [
        {
          kind: 'reviewed',
          externalKey: dodge.externalKey,
          reason: 'Fixture exception.',
        },
      ],
    };
    const result = gate({
      entries: [dodge, mobilityWithDodge],
      attribution227: rule,
    });
    expect(result.admitted).toEqual([]);
    expect(result.dependentOmissions).toEqual([
      expect.objectContaining({
        externalKey: mobilityWithDodge.externalKey,
        reason: `Dependent omission: ${dodge.externalKey}.`,
      }),
    ]);
  });

  it('admits a schedule row exactly with its feature, on the feature’s books', () => {
    const result = gate({ entries: [damageReduction, damageReduction10] });
    expect(keys(result.admitted)).toEqual(
      keys([damageReduction, damageReduction10]),
    );
    expect(rowOf(result.admitted, damageReduction10.externalKey)).toMatchObject(
      {
        reason: 'Admitted under #227: declared book PZO1110, PZO1129.',
        requiredNotices: ['PZO1110', 'PZO1129'],
      },
    );
    const uncurated = gate({
      entries: [damageReduction, damageReduction10],
      missingCuration: [damageReduction.externalKey],
    });
    expect(uncurated.admitted).toEqual([]);
    expect(keys(uncurated.held)).toEqual(
      keys([damageReduction, damageReduction10]),
    );
  });

  it('reads an overlay row’s declared title as its book’s code', () => {
    // The row as the overlay writes it, standing alone.
    const { attributionFrom: _owner, ...row } = damageReduction10;
    const overlay: PreviewEntry = {
      ...row,
      upstreamKey: row.externalKey,
      detail: { kind: 'classFeature' },
    };
    expect(gate({ entries: [overlay] }).admitted).toEqual([
      expect.objectContaining({
        externalKey: overlay.externalKey,
        reason: 'Admitted under #227: declared book PZO1110.',
        requiredNotices: ['PZO1110'],
      }),
    ]);
  });

  it('holds a definition with a missing curation record instead of refusing the release', () => {
    const result = gate({
      entries: [alertness, dodge],
      missingCuration: [alertness.externalKey],
    });
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
    expect(keys(result.admitted)).toEqual([dodge.externalKey]);
    expect(rowOf(result.held, alertness.externalKey)?.reason).toBe(
      `Missing curation record: note skill.per (${'0'.repeat(64)}).`,
    );
  });

  it('still fails a missing curation record that names no candidate', () => {
    const result = gate({
      entries: [alertness],
      missingCuration: ['pf1/not-a-candidate'],
    });
    expect(result.passed).toBe(false);
    expect(result.failures).toEqual([
      expect.objectContaining({ externalKey: 'pf1/not-a-candidate' }),
    ]);
  });

  it('never creates notice text: the legal page shows only Registry notices', () => {
    const result = gate({ entries: [alertness, damageReduction] });
    const page = buildLegalPageData({
      registry: section15Registry,
      resources: legalResources,
      requiredNotices: result.requiredNotices,
      permanentNoticeSuperset: [],
    });
    expect(result.requiredNotices).toEqual(['PZO1110', 'PZO1129']);
    expect(page.outstandingNotices).toEqual([]);
    for (const code of result.requiredNotices)
      expect(
        resolveNotice({ registry: section15Registry, code })?.reviewStatus,
      ).toBe('reviewed');
  });
});

describe('the assessment path alone', () => {
  it('holds a definition with no assessment, or an unresolved one, on a reviewed declared book', () => {
    const none = gate({ entries: [alertness], assessmentsOnly: true });
    expect(none.admitted).toEqual([]);
    expect(rowOf(none.held, alertness.externalKey)?.reason).toBe(
      'missing Attribution Assessment',
    );
    const unresolved = gate({
      entries: [alertness],
      assessments: [{ ...confirmedAlertness(alertness), status: 'unresolved' }],
      assessmentsOnly: true,
    });
    expect(unresolved.admitted).toEqual([]);
    expect(keys(unresolved.held)).toEqual([alertness.externalKey]);
  });

  it('holds a confirmed assessment whose bindings drifted, and admits a current one', () => {
    const before = { ...alertness, description: '<p>Earlier text.</p>' };
    const drifted = gate({
      entries: [alertness],
      assessments: [confirmedAlertness(before)],
      assessmentsOnly: true,
    });
    expect(drifted.admitted).toEqual([]);
    expect(rowOf(drifted.held, alertness.externalKey)?.reason).toMatch(
      /re-review required/,
    );
    const current = gate({
      entries: [alertness],
      assessments: [confirmedAlertness(alertness)],
      assessmentsOnly: true,
    });
    expect(rowOf(current.admitted, alertness.externalKey)?.reason).toBe(
      'Alertness matches Core Rulebook p. 117.',
    );
  });

  it('is a path with no rule, and the #227 path names its rule', () => {
    const paths: AttributionPath[] = [
      { kind: 'assessments-only' },
      { kind: 'declared-book', rule: noRule },
    ];
    // @ts-expect-error The #227 path needs its rule's exceptions.
    const noExceptions: AttributionPath = { kind: 'declared-book' };
    const ruled: AttributionPath = {
      kind: 'assessments-only',
      // @ts-expect-error The assessment path alone takes no #227 rule.
      rule: noRule,
    };
    // @ts-expect-error There is no other path.
    const other: AttributionPath = { kind: 'scripted-match' };
    expect([...paths, noExceptions, ruled, other]).toHaveLength(5);
  });
});

describe('the #227 decision types', () => {
  it('refuses an admission without a basis and a basis without a book', () => {
    expectTypeOf<
      Extract<Attribution227Decision, { kind: 'admitted' }>['basis']['books']
    >().toEqualTypeOf<readonly [string, ...string[]]>();
    const admitted: Attribution227Decision = {
      kind: 'admitted',
      basis: { kind: 'declared-book', books: ['PZO1110'] },
      requiredNotices: ['PZO1110'],
    };
    expect(describeAttribution227Decision(admitted)).toBe(
      'Admitted under #227: declared book PZO1110.',
    );
    // @ts-expect-error An admission names its basis.
    const noBasis: Attribution227Decision = {
      kind: 'admitted',
      requiredNotices: ['PZO1110'],
    };
    const noBook: Attribution227Decision = {
      kind: 'admitted',
      // @ts-expect-error A declared-book basis names at least one book.
      basis: { kind: 'declared-book', books: [] },
      requiredNotices: ['PZO1110'],
    };
    const bareHold: Attribution227Decision = {
      kind: 'held',
      // @ts-expect-error A hold names its kind's details.
      hold: { kind: 'unreviewed-notices', books: ['PZO9452'] },
      requiredNotices: [],
    };
    const scripted: Attribution227Decision = {
      kind: 'admitted',
      // @ts-expect-error The rule has no other basis yet.
      basis: { kind: 'scripted-match', books: ['PZO1110'] },
      requiredNotices: ['PZO1110'],
    };
    expect([noBasis, noBook, bareHold, scripted]).toHaveLength(4);
  });
});

const foundrySources = await readPinned('pf1', 'module/registry/sources.mjs');
describe('the declared-book title map', () => {
  const sources = foundrySources;
  /** Foundry's name for a code: the `name` after its `_id`. */
  const foundryName = (code: string) =>
    new RegExp(`_id: "${code}",\\s*name: "([^"]+)"`).exec(sources)?.[1];

  it.each(Object.entries(declaredBookTitles))(
    'maps %j to %s, its exact Foundry title in its line',
    (title, code) => {
      const name = foundryName(code);
      expect(name).toBeDefined();
      // The overlay writes the product line before Foundry's name, and one
      // writes its apostrophe curly.
      expect([name, `Pathfinder RPG ${name}`]).toContain(
        title.replace('’', "'"),
      );
      expect(declaredBookCode(title)).toBe(code);
    },
  );

  it('leaves a code or an unknown title as declared', () => {
    expect(declaredBookCode('PZO1110')).toBe('PZO1110');
    expect(declaredBookCode('Paizo Blog - Ultimate Cantrips')).toBe(
      'Paizo Blog - Ultimate Cantrips',
    );
  });
});

describe('the committed #227 rule', () => {
  it('is drafted, from the owner decision of 2026-11-10', () => {
    expect(attribution227Schema.parse(committedAttribution227)).toEqual(
      committedAttribution227,
    );
    expect(committedAttribution227).toMatchObject({
      decidedOn: '2026-11-10',
      review: { status: 'drafted' },
      ownerDecision: {
        path: 'ep-orch/mvp-20261023/owner-decision-20261110-rework-three-prd-decisions.md',
      },
    });
    expect(
      committedAttribution227.supersededHoldKinds.map(
        ({ kind, segment }) => `${kind}:${segment}`,
      ),
    ).toEqual([
      'superseded:whole-content',
      'superseded:owner-owed-content',
      'superseded:unbounded-origins',
      'superseded:unbounded-mapping',
      'cleared-notice:complete-chain',
    ]);
  });

  it('supersedes by hold-ID kind only', () => {
    const holds = holdsUnderAttribution227(committedAttribution227, () => true);
    expect(holds('spells-534-whole-content-lsboosfk26m0ycqv')).toBe(false);
    expect(holds('class-abilities-625-owner-owed-content')).toBe(false);
    expect(holds('class-abilities-625-owner-owed-PZO9491')).toBe(true);
    expect(holds('items-431-importer-gap-762-0cIAkfoDAK5Pq2XU')).toBe(true);
    expect(holds('pf-companions-508-broken-reference-0cIAkfoDAK5Pq2XU')).toBe(
      true,
    );
    expect(holds('716-notice-PZO1110-complete-chain')).toBe(true);
    expect(
      holdsUnderAttribution227(
        committedAttribution227,
        heldNoticeInForce(),
      )('716-notice-PZO1110-complete-chain'),
    ).toBe(false);
  });

  it('keeps every batch hold the rule does not supersede as an exception', async () => {
    const holds = holdsUnderAttribution227(
      committedAttribution227,
      heldNoticeInForce(),
    );
    const derived = [...(await readLaunchLegalInventories('.')).values()]
      .map((candidate) => ({
        kind: 'retained-hold',
        externalKey: candidate.externalKey,
        batch: candidate.path,
        holdIds: (candidate.holdIds ?? []).filter(holds).sort(),
      }))
      .filter(({ holdIds }) => holdIds.length)
      .sort((a, b) => (a.externalKey < b.externalKey ? -1 : 1));
    expect(
      committedAttribution227.exceptions.filter(
        ({ kind }) => kind === 'retained-hold',
      ),
    ).toEqual(derived);
    expect(derived).toHaveLength(195);
  }, 120_000);
});
