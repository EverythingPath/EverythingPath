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
  'damage-reduction-comparison': {
    content:
      'Damage Reduction compared with Core Rulebook p. 34 and Advanced Class Guide p. 16.',
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

/** Damage Reduction's confirmed assessment, current, on both its books. */
function confirmedDamageReduction(): AttributionAssessment {
  return {
    externalKey: damageReduction.externalKey,
    status: 'confirmed',
    ...buildAssessmentBinding({
      entry: damageReduction,
      artifact: artifactOf([damageReduction]),
      evidence,
      registry: section15Registry,
      requiredNotices: ['PZO1110', 'PZO1129'],
      evidenceIds: ['damage-reduction-comparison'],
    }),
    requiredNotices: ['PZO1110', 'PZO1129'],
    rationale: 'Damage Reduction matches its two books.',
    reviewedBy: 'Fixture reviewer',
    reviewedOn: '2026-11-11',
  };
}

/** Alertness's evidence, revoked. */
const revokedEvidence: AttributionEvidence = {
  ...evidence,
  'alertness-comparison': {
    content: 'Alertness compared with Core Rulebook p. 117.',
    revoked: true,
  },
};

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

  it('holds an exception key on a current confirmed assessment too', () => {
    const exceptions: Attribution227Rule['exceptions'] = [
      {
        kind: 'retained-hold',
        externalKey: alertness.externalKey,
        batch: 'scripts/catalog/legal/feats-000.json',
        holdIds: ['feats-000-broken-reference-Q1cY8r0Pvb66pMG0'],
      },
      {
        kind: 'reviewed',
        externalKey: alertness.externalKey,
        reason: 'The declared book is a reprint of another book.',
      },
    ];
    const reasons = [
      'Held under #227: named holds kept: feats-000-broken-reference-Q1cY8r0Pvb66pMG0 (scripts/catalog/legal/feats-000.json).',
      'Held under #227: reviewed exception: The declared book is a reprint of another book.',
    ];
    exceptions.forEach((exception, index) => {
      const result = gate({
        entries: [alertness],
        assessments: [confirmedAlertness(alertness)],
        attribution227: { ...committedAttribution227, exceptions: [exception] },
      });
      expect(result.admitted).toEqual([]);
      expect(rowOf(result.held, alertness.externalKey)?.reason).toBe(
        reasons[index],
      );
    });
    // Without the exception the same assessment admits the row.
    expect(
      keys(
        gate({
          entries: [alertness],
          assessments: [confirmedAlertness(alertness)],
        }).admitted,
      ),
    ).toEqual([alertness.externalKey]);
  });

  it('holds a schedule row on its feature’s confirmed assessment when either key is an exception', () => {
    const entries = [damageReduction, damageReduction10];
    const assessments = [confirmedDamageReduction()];
    expect(keys(gate({ entries, assessments }).admitted)).toEqual(
      keys(entries),
    );
    const exception = (externalKey: string) => ({
      ...committedAttribution227,
      exceptions: [
        {
          kind: 'reviewed' as const,
          externalKey,
          reason: 'Fixture exception.',
        },
      ],
    });
    // The feature's exception holds the row it attributes.
    const owner = gate({
      entries,
      assessments,
      attribution227: exception(damageReduction.externalKey),
    });
    expect(owner.admitted).toEqual([]);
    expect(rowOf(owner.held, damageReduction10.externalKey)?.reason).toBe(
      'Held under #227: reviewed exception: Fixture exception.',
    );
    // The row's own exception holds it while its feature stays admitted.
    const row = gate({
      entries,
      assessments,
      attribution227: exception(damageReduction10.externalKey),
    });
    expect(keys(row.admitted)).toEqual([damageReduction.externalKey]);
    expect(rowOf(row.held, damageReduction10.externalKey)?.reason).toBe(
      'Held under #227: reviewed exception: Fixture exception.',
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

  it('keeps revoked evidence revoked on every assessment that would fall back to its book', () => {
    const drifted = confirmedAlertness({
      ...alertness,
      description: '<p>Earlier text.</p>',
    });
    const unresolved: AttributionAssessment = {
      ...confirmedAlertness(alertness),
      status: 'unresolved',
    };
    for (const assessment of [unresolved, drifted]) {
      const result = assessCatalogAdmission({
        artifact: artifactOf([alertness]),
        assessments: [assessment],
        registry: section15Registry,
        evidence: revokedEvidence,
        attributionPath: { kind: 'declared-book', rule: noRule },
      });
      expect(result.admitted).toEqual([]);
      expect(rowOf(result.held, alertness.externalKey)?.reason).toMatch(
        /alertness-comparison \(revoked\)/,
      );
    }
    // Unrevoked, the unresolved assessment falls back to its book.
    expect(
      keys(gate({ entries: [alertness], assessments: [unresolved] }).admitted),
    ).toEqual([alertness.externalKey]);
  });

  // #411 with #227: every fallback passes one check. Each cell is an
  // assessment × the record its evidence id names × whether an earlier
  // release recorded that id revoked for the key (`priorRevocations`, which
  // a release reads from its base's `holds:<key>` rows).
  describe('the revocation matrix', () => {
    const unresolved: AttributionAssessment = {
      ...confirmedAlertness(alertness),
      status: 'unresolved',
    };
    const assessments = {
      none: undefined,
      unresolved,
      'confirmed current': confirmedAlertness(alertness),
      'confirmed drifted': confirmedAlertness({
        ...alertness,
        description: '<p>Earlier text.</p>',
      }),
    };
    const { 'alertness-comparison': comparison, ...withoutComparison } =
      evidence;
    if (!comparison) throw new Error('Missing the Alertness comparison');
    const records = {
      'supplied and live': evidence,
      'supplied and revoked': revokedEvidence,
      omitted: withoutComparison,
    };
    const byRationale = 'Alertness matches Core Rulebook p. 117.';
    const onBook = 'Admitted under #227: declared book PZO1110.';
    // With no prior revocation: the admitted cells and their reasons; every
    // other cell is held.
    const admittedCells: Record<string, string> = {
      'none / supplied and live': onBook,
      // Nothing names this record as the key's: no assessment references it
      // and no release recorded it for the key.
      'none / supplied and revoked': onBook,
      'none / omitted': onBook,
      'unresolved / supplied and live': onBook,
      'confirmed current / supplied and live': byRationale,
      'confirmed drifted / supplied and live': onBook,
    };
    const heldReasons: Record<string, RegExp> = {
      'supplied and revoked': /alertness-comparison \(revoked\)/,
      omitted: /alertness-comparison \(missing\)/,
    };
    for (const [assessmentName, assessment] of Object.entries(assessments))
      for (const [recordName, records_] of Object.entries(records))
        for (const prior of [false, true]) {
          const cell = `${assessmentName} / ${recordName}`;
          const admittedReason = prior ? undefined : admittedCells[cell];
          it(`${cell} / ${prior ? 'revoked for the key earlier' : 'no earlier revocation'}: ${admittedReason ? 'admitted' : 'held'}`, () => {
            const result = assessCatalogAdmission({
              artifact: artifactOf([alertness]),
              assessments: assessment ? [assessment] : [],
              registry: section15Registry,
              evidence: records_,
              attributionPath: { kind: 'declared-book', rule: noRule },
              ...(prior
                ? {
                    priorRevocations: new Map([
                      [alertness.externalKey, ['alertness-comparison']],
                    ]),
                  }
                : {}),
            });
            expect(result.failures).toEqual([]);
            if (admittedReason) {
              expect(
                rowOf(result.admitted, alertness.externalKey)?.reason,
              ).toBe(admittedReason);
              return;
            }
            expect(result.admitted).toEqual([]);
            const row = rowOf(result.held, alertness.externalKey);
            expect(row?.reason).toMatch(
              prior
                ? /alertness-comparison \(revoked\)/
                : (heldReasons[recordName] ?? /^$/),
            );
            // The held row names the revoked id, so the next release reads
            // the same association from it.
            if (prior)
              expect(
                result.held.find(
                  ({ externalKey }) => externalKey === alertness.externalKey,
                )?.evidence,
              ).toContain('alertness-comparison');
          });
        }

    it('lifts an earlier revocation for the key through a current confirmed assessment on new evidence', () => {
      const rereviewed: AttributionEvidence = {
        ...revokedEvidence,
        'alertness-rereview': {
          content: 'Alertness re-reviewed against Core Rulebook p. 117.',
        },
      };
      const assessment: AttributionAssessment = {
        ...confirmedAlertness(alertness),
        ...buildAssessmentBinding({
          entry: alertness,
          artifact: artifactOf([alertness]),
          evidence: rereviewed,
          registry: section15Registry,
          requiredNotices: ['PZO1110'],
          evidenceIds: ['alertness-rereview'],
        }),
      };
      const priorRevocations = new Map([
        [alertness.externalKey, ['alertness-comparison']],
      ]);
      const run = (assessments: AttributionAssessment[]) =>
        assessCatalogAdmission({
          artifact: artifactOf([alertness]),
          assessments,
          registry: section15Registry,
          evidence: rereviewed,
          attributionPath: { kind: 'declared-book', rule: noRule },
          priorRevocations,
        });
      // The re-review admits on its own rationale; its row names only its
      // own evidence, so the release it builds records no revocation for the
      // key and a later fallback is free again.
      expect(run([assessment]).admitted).toEqual([
        expect.objectContaining({
          externalKey: alertness.externalKey,
          reason: byRationale,
          evidence: ['alertness-rereview'],
        }),
      ]);
      // The same re-review drifted still may not fall back to the book.
      const drifted = {
        ...assessment,
        contentFingerprint: confirmedAlertness({
          ...alertness,
          description: '<p>Earlier text.</p>',
        }).contentFingerprint,
      };
      const held = run([drifted]);
      expect(held.admitted).toEqual([]);
      expect(rowOf(held.held, alertness.externalKey)?.reason).toMatch(
        /alertness-comparison \(revoked\)/,
      );
      expect(held.held[0]?.evidence).toEqual([
        'alertness-rereview',
        'alertness-comparison',
      ]);
    });

    it('reads an earlier revocation recorded for a schedule row’s feature', () => {
      const entries = [damageReduction, damageReduction10];
      const priorRevocations = new Map([
        [damageReduction.externalKey, ['damage-reduction-comparison']],
      ]);
      const result = assessCatalogAdmission({
        artifact: artifactOf(entries),
        assessments: [],
        registry: section15Registry,
        evidence,
        attributionPath: { kind: 'declared-book', rule: noRule },
        priorRevocations,
      });
      expect(result.admitted).toEqual([]);
      expect(keys(result.held)).toEqual(keys(entries));
      // Without it both fall back to their books.
      expect(keys(gate({ entries }).admitted)).toEqual(keys(entries));
    });
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
    // The feature's missing curation record labels the row it attributes.
    const uncurated = gate({
      entries: [damageReduction, damageReduction10],
      missingCuration: [damageReduction.externalKey],
    });
    expect(uncurated.held).toEqual([]);
    expect(
      uncurated.admitted.map(({ externalKey, unverified }) => ({
        externalKey,
        unverified,
      })),
    ).toEqual([
      {
        externalKey: damageReduction.externalKey,
        unverified: ['no curation record'],
      },
      {
        externalKey: damageReduction10.externalKey,
        unverified: ['no curation record'],
      },
    ]);
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

  it('admits a definition with a missing curation record when its attribution passes, labelled unverified', () => {
    const result = gate({
      entries: [alertness, dodge],
      missingCuration: [alertness.externalKey],
    });
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.held).toEqual([]);
    expect(rowOf(result.admitted, alertness.externalKey)).toMatchObject({
      reason: 'Admitted under #227: declared book PZO1110.',
      unverified: ['no curation record'],
    });
    expect(rowOf(result.admitted, dodge.externalKey)).not.toHaveProperty(
      'unverified',
    );
  });

  it('holds a definition with a missing curation record for its attribution, as before', () => {
    const rule: Attribution227Rule = {
      ...committedAttribution227,
      exceptions: [
        {
          kind: 'reviewed',
          externalKey: alertness.externalKey,
          reason: 'Fixture exception.',
        },
      ],
    };
    const { CRB: crb, ...rest } = section15Registry;
    if (!crb) throw new Error('The Registry has no CRB record.');
    const unreviewed = {
      ...rest,
      CRB: { ...crb, reviewStatus: 'unreviewed' as const },
    };
    for (const [input, reason] of [
      [
        { attribution227: rule },
        'Held under #227: reviewed exception: Fixture exception.',
      ],
      [
        { registry: unreviewed },
        'Held under #227: declared book PZO1110 lacks reviewed notices: PZO1110.',
      ],
    ] as const) {
      const result = gate({
        entries: [alertness],
        missingCuration: [alertness.externalKey],
        ...input,
      });
      expect(result.admitted).toEqual([]);
      expect(result.held).toEqual([
        expect.objectContaining({ externalKey: alertness.externalKey, reason }),
      ]);
    }
  });

  it('admits a definition with unresolved curation mechanics, labelled unverified, instead of failing the gate', () => {
    const artifact = artifactOf([alertness]);
    const result = assessCatalogAdmission({
      artifact: {
        ...artifact,
        curation: {
          missing: [],
          unresolvedMechanics: [
            {
              externalKey: alertness.externalKey,
              kind: 'note',
              target: 'skill.per',
              text: 'Fixture note.',
              textSha256: '0'.repeat(64),
              status: 'drafted',
              outputs: [],
              rationale: 'Fixture awaiting review.',
              diagnostics: [
                { kind: 'unresolved', text: 'Unsupported target.' },
              ],
              seedBindings: [],
            },
          ],
        },
      },
      assessments: [],
      registry: section15Registry,
      evidence,
      attributionPath: { kind: 'declared-book', rule: noRule },
    });
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
    expect(rowOf(result.admitted, alertness.externalKey)).toMatchObject({
      unverified: ['unresolved curation mechanics'],
    });
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

  it('never creates notice text: Section 15 publishes Registry records’ notice bytes and committed resources only', () => {
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
    // Section 15's text: each required book's notice is the bytes of the
    // Registry record its code resolves to (PZO1110 is `CRB` by alias), and
    // every other notice is a committed legal resource.
    const section15 = page.sections.find(({ id }) => id === 'section15');
    const published = (section15?.notices ?? []).map(({ id, text }) => ({
      id,
      text,
    }));
    const registryRecord = (code: string) => {
      const notice = resolveNotice({ registry: section15Registry, code });
      const [canonical] =
        Object.entries(section15Registry).find(
          ([, record]) => record === notice,
        ) ?? [];
      return { id: `registry:${canonical}`, text: notice?.notice };
    };
    expect(published.filter(({ id }) => id.startsWith('registry:'))).toEqual(
      result.requiredNotices.map(registryRecord),
    );
    expect(published.filter(({ id }) => !id.startsWith('registry:'))).toEqual(
      [
        ...legalResources.upstreamNotices,
        ...(legalResources.projectNotice ? [legalResources.projectNotice] : []),
      ].map(({ id, text }) => ({ id, text })),
    );
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
      // @ts-expect-error A scripted-match basis names its match.
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
