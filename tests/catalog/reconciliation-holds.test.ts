// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
} from '../../scripts/catalog/admission';
import { classifyGate } from '../../scripts/catalog/launch-verification';
import type { PreviewEntry } from '../../scripts/catalog/map';
import { holdReasons } from '../../scripts/catalog/party/party-status';
import {
  holdUntilReconciled,
  reconciliationHolds,
  type ReconciliationHold,
} from '../../scripts/catalog/reconciliation-holds';
import type {
  AttributionAssessment,
  AttributionEvidence,
} from '../../src/lib/catalog/admission-schema';
import type {
  ReleaseJson,
  ReleaseRow,
} from '../../src/lib/catalog/release-schema';

// party-gates: a scoped build holds what reconciliation would refuse. Each
// case is a body as the release would carry it; the holds join the gate's
// review holds (as `release-operator.ts` adds them), and the gate decides
// the rest, dependent omission included.

const feat = (externalKey: string, description = '<p>Fixture.</p>') =>
  entry(externalKey, {
    description,
    detail: { kind: 'feat', featTypes: [], repeatable: 'unreviewed' },
  });

function entry(
  externalKey: string,
  fields: Pick<PreviewEntry, 'detail'> & Partial<PreviewEntry>,
): PreviewEntry {
  return {
    externalKey,
    upstreamKey: externalKey,
    pack: 'fixture',
    name: externalKey,
    description: '<p>Fixture.</p>',
    sources: [],
    modifiers: [],
    unsupported: [],
    ...fields,
  };
}

/** Flaming's body before a curation record gives it `bonusEquivalent`. */
const refusedAbility = entry('pf1-content/ability', {
  detail: { kind: 'itemAbility', appliesTo: 'weapon' },
});
const converting = feat('pf1/converts');
/** A feat whose description cites the refused ability: a gate dependency. */
const dependent = feat(
  'pf1/dependent',
  '<p>See <a href="catalog:pf1-content/ability">the ability</a>.</p>',
);
const companionFeature = entry('pf1/share-spells', {
  pack: 'class-abilities',
  detail: { kind: 'companionFeature', tag: 'shareSpells', associations: [] },
});
/** An imported resource of a kind discovery still refuses (#784). */
const creatureType = entry('pf1/animal', {
  pack: 'creature-types',
  detail: {
    kind: 'creatureType',
    tag: 'animal',
    hitDie: 8,
    bab: 'threeQuarters',
    saves: { fort: 'good', ref: 'good', will: 'poor' },
    classSkills: [],
    skillRanksPerHitDie: 2,
  },
});

const cases = [
  {
    name: 'a body that converts',
    key: converting.externalKey,
    hold: undefined,
    gate: 'admitted',
    clears: undefined,
  },
  {
    name: 'a definition the candidate adapter refuses',
    key: refusedAbility.externalKey,
    hold: `Reconciliation refuses it: Candidate definition ${refusedAbility.externalKey} is not supported by the prepared sheet resolver`,
    gate: 'held',
    clears:
      'stored shape refused by the candidate adapter: needs a curated stored shape (an item ability: its curation record, #764)',
  },
  {
    name: 'a definition depending on a refused one',
    key: dependent.externalKey,
    hold: undefined,
    gate: 'dependent-omitted',
    clears: undefined,
  },
  {
    name: 'a companion feature resource discovery accepts (#784)',
    key: companionFeature.externalKey,
    hold: undefined,
    gate: 'admitted',
    clears: undefined,
  },
  {
    name: 'a resource of a kind discovery refuses',
    key: creatureType.externalKey,
    hold: 'Reconciliation refuses it: resource discovery accepts no imported creatureType resource; it accepts only companion, familiar and companionFeature resources (#784).',
    gate: 'held',
    clears:
      'resource discovery refuses its kind: discovery accepting the kind (#784 accepts companion, familiar and companionFeature resources only)',
  },
] as const;

const definitions = [converting, refusedAbility, dependent];
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as ReleaseJson;
const rows: ReleaseRow[] = [
  ...definitions.map((body) => ({
    kind: 'definition' as const,
    key: body.externalKey,
    payload: json({ ...body, verification: { state: 'verified' } }),
  })),
  ...[companionFeature, creatureType].map((body) => ({
    kind: 'resource' as const,
    key: body.externalKey,
    payload: json(body),
  })),
  // An authored built-in resource is never held: discovery accepts it.
  {
    kind: 'resource',
    key: 'builtin:casting-tables',
    payload: json({ tables: [] }),
  },
];

function gateWith(holds: { externalKey: string; reason: string }[]) {
  const entries = definitions;
  const resources = [companionFeature, creatureType];
  const summary = {
    upstreamRecords: 5,
    admitted: 5,
    excluded: 0,
    unassigned: 0,
    byKind: {},
  };
  const artifact = {
    curation: {
      passed: true,
      missing: [],
      applied: [],
      stale: [],
      unused: [],
      unresolvedMechanics: [],
      unresolvedDescriptions: [],
      reviewHolds: holds,
      summary: {
        required: 0,
        drafted: 0,
        checked: 0,
        missing: 0,
        descriptions: { candidates: 0, drafted: 0, checked: 0 },
      },
    },
    catalog: {
      purpose: 'preview',
      releaseAdmission: 'not-evaluated',
      remaps: [],
      inputs: [],
      summary,
      entries,
      resources,
    },
    unsupported: {
      purpose: 'preview',
      summary: { entries: 0, issues: 0 },
      entries: [],
    },
    comparison: {
      coverageComplete: true,
      summary,
      packs: [],
      records: [...entries, ...resources].map((item) => ({
        repo: 'pf1' as const,
        pack: item.pack,
        path: `${item.externalKey}.yaml`,
        externalKey: item.upstreamKey,
        name: item.name,
        status: 'admitted' as const,
        reason: 'In scope',
      })),
    },
  };
  const registry = {
    BOOK: {
      title: 'Fixture book',
      notice: 'Fixture copyright notice.',
      checkedAgainst: 'printed' as const,
      checkedOn: '2026-10-02',
      aliases: [] as string[],
      reviewStatus: 'reviewed' as const,
      provenance: ['Fixture printed book'],
    },
  };
  const evidence: AttributionEvidence = {
    comparison: { content: 'Whole fixture content compared.' },
  };
  const assessments: AttributionAssessment[] = [...entries, ...resources].map(
    (item) => ({
      externalKey: item.externalKey,
      status: 'confirmed',
      ...buildAssessmentBinding({
        entry: item,
        artifact,
        evidence,
        registry,
        requiredNotices: ['BOOK'],
        evidenceIds: ['comparison'],
      }),
      requiredNotices: ['BOOK'],
      rationale: 'The complete definition matches the fixture book.',
      reviewedBy: 'Fixture reviewer',
      reviewedOn: '2026-10-02',
    }),
  );
  return assessCatalogAdmission({ artifact, registry, evidence, assessments });
}

describe('what reconciliation would refuse', () => {
  it('admits every case without the holds', () => {
    const gate = gateWith([]);
    expect(gate.passed).toBe(true);
    expect(gate.admitted.map(({ externalKey }) => externalKey).sort()).toEqual(
      cases.map(({ key }) => key).sort(),
    );
  });

  it.each(cases)('$name', async ({ key, hold, gate, clears }) => {
    const holds = await reconciliationHolds(rows);
    const found = holds.find(({ externalKey }) => externalKey === key);
    if (hold) expect(found?.reason).toContain(hold);
    else expect(found).toBeUndefined();
    const assessed = gateWith(holds);
    expect(assessed.passed).toBe(true);
    expect(classifyGate(assessed).get(key)?.gate).toBe(gate);
    if (clears)
      expect(
        holdReasons(found?.reason ?? '').map((reason) =>
          reason.kind === 'named'
            ? `${reason.reason}: ${reason.clears.join(', ')}`
            : reason.kind === 'per-row'
              ? `${reason.reason}: needs ${reason.record}`
              : reason.reason,
        ),
      ).toEqual([clears]);
  });

  it('holds exactly the refused definition and the refused resource kind', async () => {
    expect(
      (await reconciliationHolds(rows)).map(({ externalKey }) => externalKey),
    ).toEqual([refusedAbility.externalKey, creatureType.externalKey]);
  });

  it('holds an unknown built-in key whatever its payload', async () => {
    // The `builtin:` namespace holds only the known built-ins: an
    // accepted companion feature under another `builtin:` key is held.
    const [found] = await reconciliationHolds([
      {
        kind: 'resource',
        key: 'builtin:share-spells',
        payload: json(companionFeature),
      },
    ]);
    expect(found).toEqual({
      externalKey: 'builtin:share-spells',
      reason:
        'Reconciliation refuses it: resource discovery accepts no unknown built-in resource; a builtin: key must name one of the built-in resources (#784).',
    });
    expect(holdReasons(found?.reason ?? '')).toEqual([
      {
        kind: 'per-row',
        reason: 'unknown built-in resource key',
        record:
          'a built-in resource key, or an imported resource key outside builtin:',
      },
    ]);
  });
});

describe('the hold loop', () => {
  // A release whose rows a hold removes, or, for a hold that does not take
  // effect, the same rows again.
  type State = { rows: ReleaseRow[]; held: ReconciliationHold[] };
  const refused = (key: string): ReleaseRow => ({
    kind: 'resource',
    key,
    payload: json(creatureType),
  });
  const accepted: ReleaseRow = {
    kind: 'resource',
    key: 'builtin:casting-tables',
    payload: json({ tables: [] }),
  };

  function loop(effective: boolean, rows: ReleaseRow[]) {
    const passes: string[][] = [];
    const settled = holdUntilReconciled<State>(
      { rows, held: [] },
      {
        release: (state) => Promise.resolve(state.rows),
        held: (state) => state.held,
        hold: (state, holds) => {
          passes.push(holds.map(({ externalKey }) => externalKey));
          const keys = new Set(holds.map(({ externalKey }) => externalKey));
          return Promise.resolve({
            rows: effective
              ? state.rows.filter(({ key }) => !keys.has(key))
              : state.rows,
            held: [...state.held, ...holds],
          });
        },
      },
    );
    return { settled, passes };
  }

  it('ends once the release holds nothing reconciliation refuses', async () => {
    const { settled, passes } = loop(true, [refused('pf1/animal'), accepted]);
    expect((await settled).rows).toEqual([accepted]);
    expect(passes).toEqual([['pf1/animal']]);
  });

  it('ends with an error naming the rows a pass could not remove', async () => {
    const { settled, passes } = loop(false, [
      refused('pf1/animal'),
      refused('builtin:casting-table'),
      accepted,
    ]);
    await expect(settled).rejects.toThrow(
      'Reconciliation holds did not take effect: the release still emits builtin:casting-table, pf1/animal although they are held, so the scoped build cannot remove them.',
    );
    expect(passes).toEqual([['builtin:casting-table', 'pf1/animal']]);
  });

  it('ends a release the gates refuse without holding anything', async () => {
    const hold = vi.fn();
    await expect(
      holdUntilReconciled(
        { rows: [refused('pf1/animal')] },
        {
          release: () => Promise.resolve(undefined),
          held: () => [],
          hold,
        },
      ),
    ).resolves.toEqual({ rows: [refused('pf1/animal')] });
    expect(hold).not.toHaveBeenCalled();
  });
});
