// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { GrantedSpellRecord } from '../../scripts/catalog/granted-spells';
import type { LaunchRow } from '../../scripts/catalog/launch-inventory-schema';
import {
  launchMechanismProofs,
  type NamedMechanismProof,
} from '../../scripts/catalog/launch-mechanism-proofs';
import {
  currentMechanismProofs,
  repositoryFileSha256,
  verifyLaunchRows,
  type LaunchVerificationInput,
} from '../../scripts/catalog/launch-verification';
import { currentCalculationIdentity } from '../../src/lib/catalog/calculation-identities';

// Granted-levels S1 scope wiring: the `spell-granted-levels` family proves a
// Spell's granted pairs only through a checked granted-spell record whose
// feature is a required, admitted row granting the Spell at that level by a
// proven route. The rows, entries and records are synthetic.
const mechanism = 'Class-list and granted-spell metadata';
const family = launchMechanismProofs.find(
  (proof): proof is NamedMechanismProof =>
    'mechanism' in proof && proof.family === 'spell-granted-levels',
);
const currentRegistry = {
  registry: launchMechanismProofs,
  sha256Of: (path: string) => repositoryFileSha256('.', path),
};
const keys = {
  domainSpell: 'pf1/proofDomainSpell',
  bloodlineSpell: 'pf1/proofBloodlineSpell',
  domain: 'pf1/proofDomain',
  bloodline: 'pf1/proofBloodline',
};

function row(key: string, change: Partial<LaunchRow> = {}) {
  return {
    key,
    kind: 'classFeature',
    catalogKey: key,
    requirement: 'required' as const,
    holds: [],
    mechanisms: [],
    sources: [],
    noticeEvidence: { state: 'unreviewed' as const, evidence: ['row.sources'] },
    ...change,
  };
}
const spellRow = (key: string) =>
  row(key, {
    kind: 'spell',
    mechanisms: [
      {
        name: mechanism,
        disposition: 'recorded choice',
        status: 'outstanding',
        contract: 'Preserve every applicable class list level.',
        evidence: ['row.sources'],
      },
    ],
  });
function entry(key: string, detail: Record<string, unknown>) {
  return {
    externalKey: key,
    upstreamKey: key,
    pack: detail.kind === 'spell' ? 'spells' : 'class-abilities',
    name: key,
    detail,
    description: '',
    sources: [{ book: 'PZO1110' }],
    modifiers: [],
    unsupported: [],
  };
}
const spell = (
  key: string,
  grantedLevels: Record<string, Record<string, number>>,
  levels: Record<string, number> = { cleric: 3 },
) =>
  entry(key, {
    kind: 'spell',
    levels,
    grantedLevels,
    school: 'evo',
    subschools: [],
    descriptors: [],
  });
const domainFacts = (spellLevel = 3) => ({
  optionKind: 'domain',
  extraSlot: 'domain',
  grantedSpells: {
    style: 'slot',
    spells: [{ spellLevel, spellKey: keys.domainSpell }],
  },
});
const bloodlineFacts = (classLevel = 7) => ({
  optionKind: 'bloodline',
  grantedSpells: {
    style: 'schedule',
    schedule: [{ spellLevel: 3, classLevel }],
    spells: [{ spellLevel: 3, spellKey: keys.bloodlineSpell }],
  },
});
const checked = {
  status: 'checked',
  reviewedBy: 'reviewer',
  reviewedOn: '2026-11-06',
  receipt: `t3-review-${'0'.repeat(64)}`,
} as const;
const domainRecord = {
  featureKey: keys.domain,
  bodySha256: 'a'.repeat(64),
  grantedLevels: { kind: 'domain', name: 'Proof' },
  optionKind: 'domain',
  style: 'slot',
  extraSlot: 'domain',
  spells: [{ spellLevel: 3, spellKey: keys.domainSpell }],
  ...checked,
} satisfies GrantedSpellRecord;
const bloodlineRecord = {
  featureKey: keys.bloodline,
  bodySha256: 'b'.repeat(64),
  grantedLevels: { kind: 'bloodline', name: 'Proof' },
  optionKind: 'bloodline',
  style: 'schedule',
  schedule: 'sorcerer',
  spells: [{ spellLevel: 3, spellKey: keys.bloodlineSpell }],
  ...checked,
} satisfies GrantedSpellRecord;
const records: GrantedSpellRecord[] = [domainRecord, bloodlineRecord];
const {
  reviewedBy: _by,
  reviewedOn: _on,
  receipt: _receipt,
  ...domainUnreviewed
} = domainRecord;

type Case = {
  committedMap?: true;
  records?: readonly GrantedSpellRecord[];
  domainRow?: Partial<LaunchRow>;
  admitted?: readonly string[];
  domainFacts?: unknown;
  bloodlineFacts?: unknown;
  domainSpell?: ReturnType<typeof spell>;
};
/** The mechanisms each spell row has proven, for one synthetic build. */
function proven(change: Case = {}) {
  const input: LaunchVerificationInput = {
    admission: {
      admitted: (change.admitted ?? Object.values(keys)).map((externalKey) => ({
        externalKey,
        reason: 'Admitted.',
      })),
      held: [],
      dependentOmissions: [],
      retainedExceptions: [],
      failures: [],
    },
    scopeBuild: {
      entries: [
        change.domainSpell ?? spell(keys.domainSpell, { domain: { Proof: 3 } }),
        spell(keys.bloodlineSpell, { bloodline: { Proof: 3 } }, {}),
        entry(keys.domain, {
          kind: 'classFeature',
          spellcasting: change.domainFacts ?? domainFacts(),
        }),
        entry(keys.bloodline, {
          kind: 'classFeature',
          spellcasting: change.bloodlineFacts ?? bloodlineFacts(),
        }),
      ],
      remaps: new Map(),
      resources: new Map(),
    },
    unsupported: { entries: [] },
    proofs: currentRegistry,
    proseCases: [],
    calculationIdentity: currentCalculationIdentity,
    stale: [],
    // Without `grantedSpells`, the projection reads the committed map.
    ...(change.committedMap
      ? {}
      : { grantedSpells: change.records ?? records }),
  };
  const manifest = {
    rows: [
      spellRow(keys.domainSpell),
      spellRow(keys.bloodlineSpell),
      row(keys.domain, change.domainRow),
      row(keys.bloodline),
    ],
    edges: [],
  };
  const rows = verifyLaunchRows(manifest, input);
  const of = (key: string) =>
    rows.find((verified) => verified.key === key)?.mechanisms ?? [];
  return { domain: of(keys.domainSpell), bloodline: of(keys.bloodlineSpell) };
}

describe('the spell granted-levels family', () => {
  it('names its public proof and the class-list proof with their current bytes, the current calculation identity and its two routes', () => {
    expect(family).toMatchObject({
      mechanism,
      kinds: ['spell'],
      calculationIdentity: currentCalculationIdentity,
      tests: [
        { path: 'convex/characterSheetGrantedSpells.integration.test.ts' },
        { path: 'convex/characterSheetSpellClassList.integration.test.ts' },
      ],
      scope: {
        detailKind: 'spell',
        nonEmpty: ['grantedLevels'],
        empty: [],
        grantedLevels: [
          {
            optionKind: 'domain',
            style: 'slot',
            extraSlot: 'domain',
            levels: [1, 2, 3, 4, 5, 6, 7, 8, 9],
          },
          {
            optionKind: 'bloodline',
            style: 'schedule',
            schedule: 'sorcerer',
            levels: [1, 2, 3, 4, 5, 6, 7, 8, 9],
          },
        ],
      },
    });
    expect(currentMechanismProofs(currentRegistry)).toContainEqual(family);
  });

  it('proves nothing with the committed empty map', () => {
    expect(proven({ committedMap: true })).toEqual({
      domain: [],
      bloodline: [],
    });
  });

  it('proves a domain Spell and a sorcerer bloodline Spell granted by their records’ required, admitted features', () => {
    expect(proven()).toEqual({ domain: [mechanism], bloodline: [mechanism] });
  });

  it('keeps a Spell outstanding when its only feature is optional, unadmitted or grants it otherwise', () => {
    const outstanding = { domain: [], bloodline: [mechanism] };
    expect(proven({ domainRow: { requirement: 'optional' } })).toEqual(
      outstanding,
    );
    expect(
      proven({
        admitted: [keys.domainSpell, keys.bloodlineSpell, keys.bloodline],
      }),
    ).toEqual(outstanding);
    expect(proven({ domainFacts: domainFacts(4) })).toEqual(outstanding);
    // A domain without its extra slot fails the imported schema's routes.
    expect(
      proven({ domainFacts: { ...domainFacts(), extraSlot: undefined } }),
    ).toEqual(outstanding);
    expect(proven({ bloodlineFacts: bloodlineFacts(6) })).toEqual({
      domain: [mechanism],
      bloodline: [],
    });
  });

  it('keeps a Spell outstanding when its pairs and the records’ disagree, a route is unproven or a class list level is', () => {
    const outstanding = { domain: [], bloodline: [mechanism] };
    // The Spell names a pair no record supplies (a subdomain).
    expect(
      proven({
        domainSpell: spell(keys.domainSpell, {
          domain: { Proof: 3 },
          subDomain: { Proofwork: 3 },
        }),
      }),
    ).toEqual(outstanding);
    // A record grants the Spell for a pair it doesn't name (Instant Summons).
    expect(
      proven({
        records: [
          ...records,
          {
            ...domainRecord,
            featureKey: 'pf1/otherDomain',
            grantedLevels: { kind: 'domain', name: 'Other' },
          },
        ],
      }),
    ).toEqual(outstanding);
    // The record grants it at another level than the Spell names.
    expect(
      proven({
        domainSpell: spell(keys.domainSpell, { domain: { Proof: 4 } }),
      }),
    ).toEqual(outstanding);
    // A drafted record proves nothing.
    expect(
      proven({
        records: [{ ...domainUnreviewed, status: 'drafted' }, bloodlineRecord],
      }),
    ).toEqual(outstanding);
    // A class level outside the class-list scope (an alchemist cantrip).
    expect(
      proven({
        domainSpell: spell(
          keys.domainSpell,
          { domain: { Proof: 3 } },
          { alchemist: 0 },
        ),
      }),
    ).toEqual(outstanding);
  });
});
