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
import { bodies as grantedProofBodies } from '../spell-granted-levels-proof';

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
        { path: 'tests/spell-granted-levels-proof.ts' },
        { path: 'convex/characterSheetSpellClassList.integration.test.ts' },
        { path: 'tests/spell-class-list-proof.ts' },
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

// The coverage tie: every route and level the family's scope certifies is
// one its public proof grants. The proof
// (`convex/characterSheetGrantedSpells.integration.test.ts`) releases its
// fixture's bodies (`tests/spell-granted-levels-proof.ts`, bound by bytes in
// the registry entry beside the test) and reads each granted Spell and slot
// at every level, so the certified set must be a subset of what those bodies
// grant. The scope's class levels are the class-list scope's own, which that
// family's tie covers.

type GrantedScope = NonNullable<
  NonNullable<NamedMechanismProof['scope']>['grantedLevels']
>;
type ProofBody = (typeof grantedProofBodies)[number];
const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};
const asList = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

/**
 * What the fixture grants, in the tie's words: a domain's slot-style Spell at
 * a level, with the domain slot, and a bloodline's schedule-style Spell at
 * spell level N from class level 2N + 1, each where the Spell's own granted
 * levels name its kind at that level. A feature whose chosen options grant
 * nothing (`optionGrantsSpells: false`) grants no word.
 */
function exercisedRoutes(proofBodies: readonly ProofBody[]) {
  const grantedAt = new Map<string, Record<string, unknown>>();
  for (const { externalKey, detail } of proofBodies)
    if (detail.kind === 'spell')
      grantedAt.set(externalKey, asObject(detail.grantedLevels));
  const words = new Set<string>();
  for (const { detail } of proofBodies)
    if (detail.kind === 'classFeature')
      for (const word of featureRoutes(
        asObject(detail.spellcasting),
        grantedAt,
      ))
        words.add(word);
  return words;
}

/** One feature's words: each listed Spell its own granted levels confirm. */
function featureRoutes(
  facts: Record<string, unknown>,
  grantedAt: ReadonlyMap<string, Record<string, unknown>>,
) {
  if (facts.optionGrantsSpells === false) return [];
  const kind = String(facts.optionKind);
  const granted = asObject(facts.grantedSpells);
  return asList(granted.spells).flatMap((listed) => {
    const { spellLevel, spellKey } = asObject(listed);
    const levels = Object.values(
      asObject(grantedAt.get(String(spellKey))?.[kind]),
    );
    if (typeof spellLevel !== 'number' || !levels.includes(spellLevel))
      return [];
    return routeWords(facts, spellLevel);
  });
}

/** The route a granted Spell at this level takes, in the tie's words. */
function routeWords(facts: Record<string, unknown>, spellLevel: number) {
  const kind = String(facts.optionKind);
  const granted = asObject(facts.grantedSpells);
  if (granted.style === 'slot')
    return facts.extraSlot === 'domain'
      ? [`route ${kind} slot domain ${spellLevel}`]
      : [];
  const sorcerer = asList(granted.schedule).some((row) => {
    const { spellLevel: level, classLevel } = asObject(row);
    return level === spellLevel && classLevel === 2 * spellLevel + 1;
  });
  return granted.style === 'schedule' && sorcerer
    ? [`route ${kind} schedule sorcerer ${spellLevel}`]
    : [];
}

/** What the scope certifies, in the same words. */
function certifiedRoutes(scope: GrantedScope) {
  const words = new Set<string>();
  for (const route of scope)
    for (const level of route.levels)
      words.add(
        route.style === 'slot'
          ? `route ${route.optionKind} slot ${route.extraSlot} ${level}`
          : `route ${route.optionKind} schedule ${route.schedule} ${level}`,
      );
  return words;
}

function uncoveredRoutes(
  scope: GrantedScope = family?.scope?.grantedLevels ?? [],
  proofBodies: readonly ProofBody[] = grantedProofBodies,
) {
  const granted = exercisedRoutes(proofBodies);
  return [...certifiedRoutes(scope)]
    .filter((word) => !granted.has(word))
    .sort();
}

/** The fixture with one body's detail changed. */
const changedBody = (
  key: string,
  change: (detail: Record<string, unknown>) => Record<string, unknown>,
) =>
  grantedProofBodies.map((proofBody) =>
    proofBody.externalKey === key
      ? { ...proofBody, detail: change(proofBody.detail) }
      : proofBody,
  );

describe('the spell granted-levels scope’s coverage tie to its public proof', () => {
  it('certifies only routes and levels the public fixture grants, and the class-list scope’s class levels', () => {
    expect(family?.scope?.grantedLevels?.length).toBe(2);
    expect(uncoveredRoutes()).toEqual([]);
    const classList = launchMechanismProofs.find(
      (proof): proof is NamedMechanismProof =>
        'mechanism' in proof && proof.family === 'spell-class-list',
    );
    expect(family?.scope?.collections).toEqual(classList?.scope?.collections);
    // The entry binds both public tests and both fixtures.
    expect(family?.tests.map(({ path }) => path)).toEqual([
      'convex/characterSheetGrantedSpells.integration.test.ts',
      'tests/spell-granted-levels-proof.ts',
      'convex/characterSheetSpellClassList.integration.test.ts',
      'tests/spell-class-list-proof.ts',
    ]);
  });

  it('reports a level the fixture’s domain or bloodline no longer grants', () => {
    // The domain without its 9th-level Spell.
    expect(
      uncoveredRoutes(
        undefined,
        changedBody('pf1/grantedProofDomain', (detail) => {
          const facts = asObject(detail.spellcasting);
          const granted = asObject(facts.grantedSpells);
          return {
            ...detail,
            spellcasting: {
              ...facts,
              grantedSpells: {
                ...granted,
                spells: asList(granted.spells).filter(
                  (row) => asObject(row).spellLevel !== 9,
                ),
              },
            },
          };
        }),
      ),
    ).toEqual(['route domain slot domain 9']);
    // A bloodline granting its 3rd-level Spell at sorcerer 6, not 7.
    expect(
      uncoveredRoutes(
        undefined,
        changedBody('pf1/grantedProofBloodline', (detail) => {
          const facts = asObject(detail.spellcasting);
          const granted = asObject(facts.grantedSpells);
          return {
            ...detail,
            spellcasting: {
              ...facts,
              grantedSpells: {
                ...granted,
                schedule: asList(granted.schedule).map((row) =>
                  asObject(row).spellLevel === 3
                    ? { spellLevel: 3, classLevel: 6 }
                    : row,
                ),
              },
            },
          };
        }),
      ),
    ).toEqual(['route bloodline schedule sorcerer 3']);
    // A domain Spell whose own granted levels name another level.
    expect(
      uncoveredRoutes(
        undefined,
        changedBody('pf1/grantedProofDomainSpell4', (detail) => ({
          ...detail,
          grantedLevels: { domain: { Proof: 5 } },
        })),
      ),
    ).toEqual(['route domain slot domain 4']);
  });
});
