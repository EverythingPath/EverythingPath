import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { computeFingerprint } from '../../scripts/catalog/admission';
import type { Section15Registry } from '../../src/lib/catalog/admission-schema';
import {
  retainedPriorCalculationIdentity,
  supersededCalculationIdentities,
} from '../../src/lib/catalog/calculation-identities';
import { catalogRuntimeCompatibility } from '../../src/lib/catalog/runtime-compatibility';
import {
  bindNoticeFingerprints,
  findBatchOwnershipProblems,
  findCitedNoticeProblems,
  findCommittedBatchOwnershipProblems,
  findRecordedBindingProblems,
  readBatchInventory,
  sharedCatalogData,
  type SharedCatalogData,
} from './batch-ownership';
import {
  featReleaseFixtureCalculation,
  findReleaseCompatibilityProblems,
} from './release-compatibility';

// Negative tests for the #749 preservation checks, one per pattern. Each uses
// real batch rows: #529's Suppress Primal Magic (held on its whole content and
// its Wilderness Origins PZO9237 notice chain), #355's Skill Focus (Climb), the
// batch's one admitted CRB feat, and #345's Monastic Legacy (Mythic), from a
// batch whose inventory recorded no binding snapshot.
const spellsPath = 'scripts/catalog/legal/spells-529.json';
const featsPath = 'scripts/catalog/legal/feats-355.json';
const unsnapshottedPath = 'scripts/catalog/legal/feats-345.json';
const inventories = new Map(
  [spellsPath, featsPath, unsnapshottedPath].map((path) => [
    path,
    readBatchInventory(path),
  ]),
);
const suppress = 'pf1/eucwnai4r3awfl5m';
const skillFocus = 'pf1-content/eLQUV5Hswm8vNLfE';
const monasticLegacy = 'pf1-content/KE9ULlgbbzOYKBrb';

// #296's reviewed Ultimate Combat notice (Paizo PRD licence page, line 387).
const ultimateCombatNotice =
  'Pathfinder Roleplaying Game Ultimate Combat. © 2011, Paizo Publishing, LLC; Authors: Dennis Baker, Jesse Benner, Benjamin Bruck, Jason Bulmahn, Brian J. Cortijo, Jim Groves, Tim Hitchcock, Richard A. Hunt, Colin McComb, Jason Nelson, Tom Phillips, Patrick Renie, Sean K Reynolds, and Russ Taylor.';
const ultimateCombat: Section15Registry[string] = {
  title: 'Pathfinder Roleplaying Game Ultimate Combat',
  notice: ultimateCombatNotice,
  checkedAgainst: 'prd',
  checkedOn: '2026-10-13',
  aliases: [],
  reviewStatus: 'reviewed',
  provenance: ['https://paizo.com/pathfinderRPG/prd/openGameLicense.html'],
};

function findMutatedProblems({
  inventoryPath,
  mutate,
}: {
  inventoryPath: string;
  mutate: (data: SharedCatalogData) => SharedCatalogData;
}) {
  const inventory = inventories.get(inventoryPath);
  if (!inventory) throw new Error(inventoryPath);
  return findBatchOwnershipProblems({
    inventoryPath,
    inventory,
    data: mutate(structuredClone(sharedCatalogData)),
  });
}
function findAssessment({
  data,
  externalKey,
}: {
  data: SharedCatalogData;
  externalKey: string;
}) {
  const row = data.assessments.find((item) => item.externalKey === externalKey);
  if (!row) throw new Error(externalKey);
  return row;
}
function findEvidence({ data, id }: { data: SharedCatalogData; id: string }) {
  const entry = data.evidence[id];
  if (!entry) throw new Error(id);
  return entry;
}

describe('a batch own rows check', () => {
  it('keeps currentBinding authoritative and refuses malformed supplemental hashes rather than falling back to legacy binding', () => {
    const root = mkdtempSync(join(tmpdir(), 'ownership-current-binding-'));
    try {
      const path = join(root, 'racial-traits-393.json');
      const raw = JSON.parse(
        readFileSync('scripts/catalog/legal/racial-traits-393.json', 'utf8'),
      );
      const subject = raw.candidates.find(
        (row: { externalKey: string }) =>
          row.externalKey === 'pf1-content/Mb0hz0BAj51wOmUr',
      );
      const expected = subject.currentBinding;
      subject.binding = {
        contentFingerprint: '0'.repeat(64),
        mappingFingerprint: expected.mappingFingerprint,
        evidenceFingerprint: expected.evidenceFingerprints[subject.evidenceId],
        noticeFingerprints: expected.noticeFingerprints,
      };
      writeFileSync(path, JSON.stringify(raw));
      const parsed = readBatchInventory(path).candidates.find(
        (row) => row.externalKey === subject.externalKey,
      );
      expect(parsed?.kind === 'assessed' && parsed.recorded).toMatchObject({
        kind: 'snapshot',
        contentFingerprint: expected.contentFingerprint,
        evidenceFingerprints: expected.evidenceFingerprints,
      });
      subject.currentBinding.evidenceFingerprints[
        'race-740-rule-Mb0hz0BAj51wOmUr'
      ] = 'not-a-fingerprint';
      writeFileSync(path, JSON.stringify(raw));
      expect(() => readBatchInventory(path)).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a supplemental payload edit even when its assessment is re-bound to the edit', () => {
    const inventoryPath = 'scripts/catalog/legal/racial-traits-393.json';
    const inventory = readBatchInventory(inventoryPath);
    const data = structuredClone(sharedCatalogData);
    const id = 'race-740-rule-Mb0hz0BAj51wOmUr';
    findEvidence({ data, id }).content += ' altered';
    findAssessment({
      data,
      externalKey: 'pf1-content/Mb0hz0BAj51wOmUr',
    }).evidenceFingerprints[id] = computeFingerprint(data.evidence[id]);
    expect(
      findBatchOwnershipProblems({ inventoryPath, inventory, data }),
    ).toContain(
      `Wereboar-Kin (Ragebred) (pf1-content/Mb0hz0BAj51wOmUr): evidence ${id} differs from the recorded one`,
    );
  });

  it.each([
    'payload-only',
    'assessment-hash-only',
    'missing-payload',
    'missing-assessment-hash',
    'missing-expected-hash',
    'mismatched-expected-hash',
    'extraneous-assessment-id',
    'extraneous-expected-id',
  ])('rejects supplemental evidence %s against the recorded map', (change) => {
    const inventoryPath = 'scripts/catalog/legal/racial-traits-393.json';
    const inventory = readBatchInventory(inventoryPath);
    const data = structuredClone(sharedCatalogData);
    const id = 'race-740-rule-Mb0hz0BAj51wOmUr';
    const externalKey = 'pf1-content/Mb0hz0BAj51wOmUr';
    const assessment = findAssessment({ data, externalKey });
    const candidate = inventory.candidates.find(
      (row) => row.externalKey === externalKey,
    );
    if (
      candidate?.kind !== 'assessed' ||
      candidate.recorded.kind !== 'snapshot'
    )
      throw new Error('Missing recorded snapshot');
    switch (change) {
      case 'payload-only':
        findEvidence({ data, id }).content += ' altered';
        break;
      case 'assessment-hash-only':
        assessment.evidenceFingerprints[id] = '0'.repeat(64);
        break;
      case 'missing-payload':
        delete data.evidence[id];
        break;
      case 'missing-assessment-hash':
        delete assessment.evidenceFingerprints[id];
        break;
      case 'missing-expected-hash':
        delete candidate.recorded.evidenceFingerprints[id];
        break;
      case 'mismatched-expected-hash':
        candidate.recorded.evidenceFingerprints[id] = '0'.repeat(64);
        break;
      case 'extraneous-assessment-id':
        assessment.evidenceFingerprints.unrecorded = '0'.repeat(64);
        break;
      case 'extraneous-expected-id':
        candidate.recorded.evidenceFingerprints.unrecorded = '0'.repeat(64);
        break;
    }
    expect(
      findBatchOwnershipProblems({ inventoryPath, inventory, data }),
    ).toContainEqual(
      expect.stringContaining(
        change === 'missing-payload'
          ? `evidence ${id} is missing`
          : change.includes('-id') ||
              change === 'missing-expected-hash' ||
              change === 'missing-assessment-hash'
            ? 'assessment no longer cites'
            : `evidence ${id} differs from the recorded one`,
      ),
    );
  });

  it('accepts the exact bound supplemental evidence set and still refuses removal of the original or an unrecorded addition', () => {
    const inventoryPath = 'scripts/catalog/legal/racial-traits-393.json';
    const inventory = readBatchInventory(inventoryPath);
    const check = (data: SharedCatalogData) =>
      findBatchOwnershipProblems({ inventoryPath, inventory, data });
    expect(check(sharedCatalogData)).toEqual([]);
    const removed = structuredClone(sharedCatalogData);
    const assessment = findAssessment({
      data: removed,
      externalKey: 'pf1-content/Mb0hz0BAj51wOmUr',
    });
    delete assessment.evidenceFingerprints[
      'racial-traits-393-Mb0hz0BAj51wOmUr'
    ];
    expect(check(removed)).toContainEqual(
      expect.stringContaining('assessment no longer cites'),
    );
    const added = structuredClone(sharedCatalogData);
    findAssessment({
      data: added,
      externalKey: 'pf1-content/Mb0hz0BAj51wOmUr',
    }).evidenceFingerprints.unrecorded = '0'.repeat(64);
    expect(check(added)).toContainEqual(
      expect.stringContaining('assessment no longer cites'),
    );
  });
  it.each([
    'feats-343',
    'feats-345',
    'feats-346',
    'feats-347',
    'feats-355',
    'spells-529',
  ])('passes on the committed shared data for %s', (batch) => {
    expect(
      findCommittedBatchOwnershipProblems(
        `scripts/catalog/legal/${batch}.json`,
      ),
    ).toEqual([]);
  });

  it('passes when a notice correction re-binds its assessments, and fails until it does', () => {
    const applyCorrection = ({
      data,
      isRebound,
    }: {
      data: SharedCatalogData;
      isRebound: boolean;
    }) => {
      const { PZO1118: _old, ...before } = data.registry;
      const after = { ...before, PZO1118: ultimateCombat };
      for (const row of data.assessments)
        if (row.requiredNotices.includes('PZO1118'))
          row.noticeFingerprints = bindNoticeFingerprints({
            requiredNotices: row.requiredNotices,
            registry: isRebound ? after : before,
          });
      return { ...data, registry: after };
    };
    expect(
      findMutatedProblems({
        inventoryPath: spellsPath,
        mutate: (data) => applyCorrection({ data, isRebound: true }),
      }),
    ).toEqual([]);
    expect(
      findMutatedProblems({
        inventoryPath: spellsPath,
        mutate: (data) => applyCorrection({ data, isRebound: false }),
      }),
    ).toEqual([
      'Litany of Escape (pf1/fz6q0s2jzgwfdsa2): notice bindings are not current',
      'Phantom Driver (pf1/g0kc3kexbiun6l0z): notice bindings are not current',
    ]);
  });

  it('passes when other batches rows change or disappear', () => {
    const ownKeys = new Set(
      [...inventories.values()].flatMap((inventory) =>
        inventory.candidates.map((row) => row.externalKey),
      ),
    );
    expect(
      findMutatedProblems({
        inventoryPath: spellsPath,
        mutate: (data) => ({
          ...data,
          records: data.records.filter((row) => ownKeys.has(row.externalKey)),
          assessments: data.assessments.filter((row) =>
            ownKeys.has(row.externalKey),
          ),
        }),
      }),
    ).toEqual([]);
  });

  it('fails when its description record is altered or removed', () => {
    const findDescription = (data: SharedCatalogData) => {
      const row = data.records.find(
        (item) => item.externalKey === suppress && item.kind === 'description',
      );
      if (!row) throw new Error(suppress);
      return row;
    };
    expect(
      findMutatedProblems({
        inventoryPath: spellsPath,
        mutate: (data) => {
          findDescription(data).text += ' Edited.';
          return data;
        },
      }),
    ).toEqual([
      `Suppress Primal Magic (${suppress}): description record differs from the recorded one`,
    ]);
    expect(
      findMutatedProblems({
        inventoryPath: spellsPath,
        mutate: (data) => {
          findDescription(data).status = 'drafted';
          return data;
        },
      }),
    ).toHaveLength(1);
    expect(
      findMutatedProblems({
        inventoryPath: spellsPath,
        mutate: (data) => ({
          ...data,
          records: data.records.filter((row) => row.externalKey !== suppress),
        }),
      }),
    ).toEqual([`Suppress Primal Magic (${suppress}): 0 description records`]);
  });

  it("takes an Item Ability's itemAbility record as its description record", () => {
    // #501's Speed: an itemAbility entry gets no prose-pass input, so its
    // checked itemAbility record binds its description.
    const abilitiesPath = 'scripts/catalog/legal/pf-special-qualities-501.json';
    const speed = 'pf1-content/E5jfgma2vpopfrkr';
    const inventory = readBatchInventory(abilitiesPath);
    const check = (mutate: (data: SharedCatalogData) => SharedCatalogData) =>
      findBatchOwnershipProblems({
        inventoryPath: abilitiesPath,
        inventory,
        data: mutate(structuredClone(sharedCatalogData)),
      });
    expect(check((data) => data)).toEqual([]);
    expect(
      check((data) => {
        const row = data.records.find(
          (item) => item.externalKey === speed && item.kind === 'itemAbility',
        );
        if (!row) throw new Error(speed);
        row.status = 'drafted';
        return data;
      }),
    ).toEqual([
      `Speed (${speed}): description record differs from the recorded one`,
    ]);
    expect(
      check((data) => ({
        ...data,
        records: data.records.filter((row) => row.externalKey !== speed),
      })),
    ).toEqual([`Speed (${speed}): 0 description records`]);
  });

  it('checks a dependently omitted row like any assessed row', () => {
    // #547's Inspire Courage: confirmed and needing only the reviewed CRB
    // notice, but omitted until its governing class ability is admitted.
    const buffsPath = 'scripts/catalog/legal/buffs-547.json';
    const inspireCourage = 'pf1/3p34GJemfcLdKckV';
    const inventory = readBatchInventory(buffsPath);
    expect(
      inventory.candidates.find((row) => row.externalKey === inspireCourage),
    ).toMatchObject({
      kind: 'assessed',
      disposition: 'dependently-omitted',
      assessmentStatus: 'confirmed',
    });
    const data = structuredClone(sharedCatalogData);
    findAssessment({ data, externalKey: inspireCourage }).status = 'unresolved';
    expect(
      findBatchOwnershipProblems({ inventoryPath: buffsPath, inventory, data }),
    ).toEqual([
      `Inspire Courage (${inspireCourage}): assessment is unresolved, recorded confirmed`,
    ]);
  });

  it('fails when its disposition is altered or its assessment removed', () => {
    expect(
      findMutatedProblems({
        inventoryPath: spellsPath,
        mutate: (data) => {
          findAssessment({ data, externalKey: suppress }).status = 'confirmed';
          return data;
        },
      }),
    ).toEqual([
      `Suppress Primal Magic (${suppress}): assessment is confirmed, recorded unresolved`,
    ]);
    expect(
      findMutatedProblems({
        inventoryPath: featsPath,
        mutate: (data) => {
          findAssessment({ data, externalKey: skillFocus }).status =
            'unresolved';
          return data;
        },
      }),
    ).toEqual([
      `Skill Focus (Climb) (${skillFocus}): assessment is unresolved, recorded confirmed`,
    ]);
    expect(
      findMutatedProblems({
        inventoryPath: spellsPath,
        mutate: (data) => {
          findAssessment({ data, externalKey: suppress }).requiredNotices = [
            'PZO1110',
          ];
          return data;
        },
      }),
    ).toContain(
      `Suppress Primal Magic (${suppress}): required notices differ from the recorded ones`,
    );
    expect(
      findMutatedProblems({
        inventoryPath: spellsPath,
        mutate: (data) => ({
          ...data,
          assessments: data.assessments.filter(
            (row) => row.externalKey !== suppress,
          ),
        }),
      }),
    ).toEqual([`Suppress Primal Magic (${suppress}): 0 assessments`]);
  });

  it('fails when one of its holds is altered or removed', () => {
    const noticeHold = 'spells-529-notice-PZO9237-complete-chain';
    expect(
      findMutatedProblems({
        inventoryPath: spellsPath,
        mutate: (data) => ({
          ...data,
          heldNotices: data.heldNotices.filter((row) => row.id !== noticeHold),
        }),
      }),
    ).toContain(
      `Suppress Primal Magic (${suppress}): hold ${noticeHold} is missing`,
    );
    expect(
      findMutatedProblems({
        inventoryPath: spellsPath,
        mutate: (data) => {
          const hold = data.heldNotices.find((row) => row.id === noticeHold);
          if (!hold) throw new Error(noticeHold);
          hold.notices = hold.notices.filter((code) => code !== 'PZO9237');
          return data;
        },
      }),
    ).toEqual([`PZO9237: hold ${noticeHold} no longer holds PZO9237`]);
    expect(
      findMutatedProblems({
        inventoryPath: spellsPath,
        mutate: (data) => {
          findAssessment({ data, externalKey: suppress }).rationale =
            'Reviewed.';
          return data;
        },
      }),
    ).toEqual([
      `Suppress Primal Magic (${suppress}): hold spells-529-whole-content-eucwnai4r3awfl5m is gone from the assessment`,
    ]);
  });

  it('fails when its evidence entry is altered or removed', () => {
    const id = 'spells-529-eucwnai4r3awfl5m';
    expect(
      findMutatedProblems({
        inventoryPath: spellsPath,
        mutate: (data) => {
          findEvidence({ data, id }).content += ' Edited.';
          return data;
        },
      }),
    ).toEqual([
      `Suppress Primal Magic (${suppress}): evidence ${id} differs from the recorded one`,
    ]);
    expect(
      findMutatedProblems({
        inventoryPath: featsPath,
        mutate: (data) => {
          const entry = findEvidence({
            data,
            id: 'feats-355-eLQUV5Hswm8vNLfE',
          });
          entry.content = entry.content.replace(
            /[0-9a-f]{64}/g,
            '0'.repeat(64),
          );
          return data;
        },
      }),
    ).toEqual([
      `Skill Focus (Climb) (${skillFocus}): evidence feats-355-eLQUV5Hswm8vNLfE differs from the recorded one`,
      `Skill Focus (Climb) (${skillFocus}): evidence feats-355-eLQUV5Hswm8vNLfE lost its source fingerprint`,
    ]);
    expect(
      findMutatedProblems({
        inventoryPath: spellsPath,
        mutate: (data) => {
          const { [id]: _removed, ...evidence } = data.evidence;
          return { ...data, evidence };
        },
      }),
    ).toEqual([
      `Suppress Primal Magic (${suppress}): evidence ${id} is missing`,
    ]);
  });

  it('fails when its source content fingerprint is altered', () => {
    expect(
      findMutatedProblems({
        inventoryPath: featsPath,
        mutate: (data) => {
          findAssessment({ data, externalKey: skillFocus }).contentFingerprint =
            '0'.repeat(64);
          return data;
        },
      }),
    ).toEqual([
      `Skill Focus (Climb) (${skillFocus}): content binding differs from the recorded one`,
    ]);
  });
});

describe('a batch without recorded binding snapshots', () => {
  const id = 'feats-345-KE9ULlgbbzOYKBrb';
  const label = `Monastic Legacy (Mythic) (${monasticLegacy})`;

  it('fails when its evidence is revoked and its assessment re-bound to it', () => {
    expect(
      findMutatedProblems({
        inventoryPath: unsnapshottedPath,
        mutate: (data) => {
          const entry = findEvidence({ data, id });
          entry.revoked = true;
          findAssessment({
            data,
            externalKey: monasticLegacy,
          }).evidenceFingerprints[id] = computeFingerprint(entry);
          return data;
        },
      }),
    ).toEqual([`${label}: evidence ${id} differs from the recorded one`]);
  });

  it('fails when its evidence is edited, removed or no longer cited', () => {
    expect(
      findMutatedProblems({
        inventoryPath: unsnapshottedPath,
        mutate: (data) => {
          const entry = findEvidence({ data, id });
          entry.content += ' Edited.';
          findAssessment({
            data,
            externalKey: monasticLegacy,
          }).evidenceFingerprints[id] = computeFingerprint(entry);
          return data;
        },
      }),
    ).toEqual([`${label}: evidence ${id} differs from the recorded one`]);
    expect(
      findMutatedProblems({
        inventoryPath: unsnapshottedPath,
        mutate: (data) => {
          const { [id]: _removed, ...evidence } = data.evidence;
          return { ...data, evidence };
        },
      }),
    ).toEqual([`${label}: evidence ${id} is missing`]);
    expect(
      findMutatedProblems({
        inventoryPath: unsnapshottedPath,
        mutate: (data) => {
          findAssessment({
            data,
            externalKey: monasticLegacy,
          }).evidenceFingerprints = {};
          return data;
        },
      }),
    ).toEqual([
      `${label}: assessment no longer cites ${id}`,
      `${label}: evidence ${id} differs from the recorded one`,
    ]);
  });

  it('still checks its disposition and current notice bindings', () => {
    expect(
      findMutatedProblems({
        inventoryPath: unsnapshottedPath,
        mutate: (data) => {
          const assessment = findAssessment({
            data,
            externalKey: monasticLegacy,
          });
          assessment.status = 'confirmed';
          assessment.noticeFingerprints.PZO1110 = '0'.repeat(64);
          return data;
        },
      }),
    ).toEqual([
      `${label}: assessment is confirmed, recorded unresolved`,
      `${label}: notice bindings are not current`,
    ]);
  });
});

describe('a recorded binding snapshot', () => {
  const [row] = inventories.get(spellsPath)?.candidates ?? [];
  if (row?.kind !== 'assessed' || row.recorded.kind !== 'snapshot')
    throw new Error('Missing #529 binding');
  const { evidenceId, recorded } = row;
  const evidenceFingerprint = recorded.evidenceFingerprints[evidenceId];
  if (!evidenceFingerprint)
    throw new Error('Missing #529 evidence fingerprint');
  const current = {
    contentFingerprint: recorded.contentFingerprint,
    mappingFingerprint: recorded.mappingFingerprint,
    evidenceFingerprints: {
      [evidenceId]: evidenceFingerprint,
    },
    noticeFingerprints: bindNoticeFingerprints({
      requiredNotices: row.requiredNotices,
    }),
  };
  const snapshot = {
    contentFingerprint: recorded.contentFingerprint,
    mappingFingerprint: recorded.mappingFingerprint,
    evidenceFingerprint,
    noticeFingerprints: current.noticeFingerprints,
  };

  it('accepts either snapshot shape with notice fingerprints from a corrected Registry', () => {
    const corrected = {
      ...current,
      noticeFingerprints: bindNoticeFingerprints({
        requiredNotices: row.requiredNotices,
        registry: { ...sharedCatalogData.registry, PZO1118: ultimateCombat },
      }),
    };
    expect(
      findRecordedBindingProblems({
        recorded: snapshot,
        current: corrected,
        evidenceId,
      }),
    ).toEqual([]);
    expect(
      findRecordedBindingProblems({
        recorded: current,
        current: corrected,
        evidenceId,
      }),
    ).toEqual([]);
  });

  it('rejects a changed content, mapping or evidence fingerprint or notice code', () => {
    for (const field of ['contentFingerprint', 'mappingFingerprint'] as const)
      expect(
        findRecordedBindingProblems({
          recorded: snapshot,
          current: { ...current, [field]: '0'.repeat(64) },
          evidenceId,
        }),
      ).toEqual(['content, mapping or evidence binding differs']);
    expect(
      findRecordedBindingProblems({
        recorded: snapshot,
        current: { ...current, evidenceFingerprints: { [evidenceId]: '0' } },
        evidenceId,
      }),
    ).toEqual(['content, mapping or evidence binding differs']);
    expect(
      findRecordedBindingProblems({
        recorded: snapshot,
        current: { ...current, noticeFingerprints: { PZO1110: '0' } },
        evidenceId,
      }),
    ).toEqual(['notice codes differ']);
  });
});

describe('a cited Registry notice check', () => {
  // #530 recorded the defective pf1-content Ultimate Combat line it observed.
  const citation = {
    key: 'pf1-content/notice/1f140446831e591d9fe1c75ca40740def94b6a1a5064f04ce94573a4205f1747',
    textSha256:
      '1f140446831e591d9fe1c75ca40740def94b6a1a5064f04ce94573a4205f1747',
  };
  const cited = sharedCatalogData.registry[citation.key];
  if (!cited) throw new Error(citation.key);

  it('accepts an in-place correction of the cited notice text', () => {
    expect(findCitedNoticeProblems(citation)).toEqual([]);
    expect(
      findCitedNoticeProblems({
        ...citation,
        registry: {
          ...sharedCatalogData.registry,
          [citation.key]: { ...cited, notice: ultimateCombatNotice },
        },
      }),
    ).toEqual([]);
  });

  it('rejects a removed notice and a recorded hash that is not its key', () => {
    const { [citation.key]: _removed, ...withoutCited } =
      sharedCatalogData.registry;
    expect(
      findCitedNoticeProblems({ ...citation, registry: withoutCited }),
    ).toEqual([`${citation.key}: no longer in the Registry`]);
    expect(
      findCitedNoticeProblems({ ...citation, textSha256: '0'.repeat(64) }),
    ).toEqual([
      `${citation.key}: recorded text hash ${'0'.repeat(64)} is not its key`,
    ]);
  });
});

describe('a release fixture compatibility check', () => {
  const recordedCalculation = featReleaseFixtureCalculation;
  const schema = catalogRuntimeCompatibility.schema;

  it('accepts the identity the release recorded, whatever the current one', () => {
    expect(
      findReleaseCompatibilityProblems({
        compatibility: { schema, calculation: recordedCalculation },
        recordedCalculation,
      }),
    ).toEqual([]);
    expect([
      catalogRuntimeCompatibility.calculation,
      retainedPriorCalculationIdentity,
      ...supersededCalculationIdentities,
    ]).toContain(recordedCalculation);
  });

  it('rejects another identity, an unknown one or another schema', () => {
    const oldest = supersededCalculationIdentities.at(-1) ?? '';
    expect(
      findReleaseCompatibilityProblems({
        compatibility: { schema, calculation: oldest },
        recordedCalculation,
      }),
    ).toEqual([
      `calculation ${oldest} is not the recorded ${recordedCalculation}`,
    ]);
    expect(
      findReleaseCompatibilityProblems({
        compatibility: { schema, calculation: 'sha256:unknown' },
        recordedCalculation: 'sha256:unknown',
      }),
    ).toEqual(['calculation sha256:unknown is not a known identity']);
    expect(
      findReleaseCompatibilityProblems({
        compatibility: {
          schema: 'character-sheet-v0',
          calculation: recordedCalculation,
        },
        recordedCalculation,
      }),
    ).toEqual(['schema character-sheet-v0 is not character-sheet-v1']);
  });
});
