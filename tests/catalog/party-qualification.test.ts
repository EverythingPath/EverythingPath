// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { GateClass } from '../../scripts/catalog/launch-verification';
import { parsePartyBuilds } from '../../scripts/catalog/party/party-builds';
import {
  parsePartyExceptions,
  type PartyException,
} from '../../scripts/catalog/party/party-exceptions';
import {
  qualifyPartyScope,
  type PartyBuildState,
} from '../../scripts/catalog/party/party-qualification';
import {
  buildPartyScope,
  type PartyCatalogEntry,
} from '../../scripts/catalog/party/party-scope';

const entry = ([externalKey, name, kind]: [string, string, string]) =>
  ({
    externalKey,
    name,
    description: '',
    detail: { kind },
  }) as unknown as PartyCatalogEntry;

const human = 'pf1/human';
const level = (name: string) => ({
  kind: 'written' as const,
  build: {
    now: [{ class: name, level: 3 }],
    next: { kind: 'known' as const, classes: [{ class: name, level: 4 }] },
  },
});
const builds = parsePartyBuilds({
  schemaVersion: 1,
  scopeVersion: 'campaign-party-v1',
  note: 'Fixture.',
  characters: [
    {
      id: '1',
      kind: 'character',
      race: { kind: 'matched', key: human, name: 'Human' },
      levels: level('Fighter'),
      keys: {
        classes: [{ kind: 'matched', key: 'pf1/fighter', name: 'Fighter' }],
        feats: [
          { kind: 'matched', key: 'pf1/dodge', name: 'Dodge' },
          { kind: 'unmatched', name: 'Lethal Stance', note: 'No record.' },
        ],
      },
    },
    {
      id: '2',
      kind: 'character',
      race: { kind: 'open', note: 'The sheet writes no race.' },
      levels: level('Witch'),
      keys: {
        classes: [{ kind: 'matched', key: 'pf1/witch', name: 'Witch' }],
        equipment: [{ kind: 'matched', key: 'pf1/acid', name: 'Acid' }],
        spells: [{ kind: 'matched', key: 'pf1/bleed', name: 'Bleed' }],
      },
    },
  ],
});
const scope = buildPartyScope({
  builds,
  buildsBytes: 'fixture',
  catalog: {
    entries: [
      entry([human, 'Human', 'race']),
      entry(['pf1/fighter', 'Fighter', 'class']),
      entry(['pf1/dodge', 'Dodge', 'feat']),
      entry(['pf1/witch', 'Witch', 'class']),
      entry(['pf1/acid', 'Acid', 'item']),
      entry(['pf1/bleed', 'Bleed', 'spell']),
    ],
    upstream: [],
  },
});

const held = 'Structure hand review (#716 plan §6): item witch-hexes.';
/** Every row admitted, Dodge unverified, each case changing one row. */
function gate({
  classes = {},
  missingNotices = {},
  missing = [],
}: {
  classes?: Record<string, { gate: GateClass; reason: string }>;
  missingNotices?: Record<string, string[]>;
  missing?: string[];
} = {}) {
  const keys = scope.rows
    .map(({ key }) => key)
    .filter((key) => !missing.includes(key));
  return {
    classes: new Map(
      keys.map((key) => [
        key,
        classes[key] ?? { gate: 'admitted' as const, reason: 'Admitted.' },
      ]),
    ),
    missingNotices: new Map(Object.entries(missingNotices)),
    imported: new Set(keys),
    remapped: new Map<string, string>(),
  };
}
const exception = (subject: PartyException['subject']): PartyException => ({
  subject,
  reason: 'Entered as a one-off entry.',
  decidedBy: 'orchestrator',
  decidedOn: '2026-11-12',
});
const lethalStance = exception({ kind: 'unmatched', name: 'Lethal Stance' });

function qualify(
  build: PartyBuildState,
  exceptions: PartyException[] = [lethalStance],
) {
  return qualifyPartyScope({ scope, builds, exceptions, build });
}
const outcomeOf = (report: ReturnType<typeof qualify>, name: string) =>
  report.rows.find((row) => row.name === name);

describe('party scope qualification', () => {
  it.each([
    {
      case: 'admitted and unverified',
      build: { stage: 'built', gate: gate() },
      name: 'Dodge',
      outcome: { outcome: 'included' },
    },
    {
      case: 'admitted with an unreviewed notice',
      build: {
        stage: 'built',
        gate: gate({ missingNotices: { 'pf1/acid': ['PZO9445'] } }),
      },
      name: 'Acid',
      outcome: {
        outcome: 'failed',
        cause: 'unreviewed-notice',
        reason: 'Admitted without reviewed notices: PZO9445.',
      },
    },
    {
      case: 'held',
      build: {
        stage: 'built',
        gate: gate({
          classes: { 'pf1/witch': { gate: 'held', reason: held } },
        }),
      },
      name: 'Witch',
      outcome: {
        outcome: 'failed',
        cause: 'held',
        reason: held,
        owner:
          'structure hand review (#716): needs a structure curation record',
      },
    },
    {
      case: 'dependent-omitted',
      build: {
        stage: 'built',
        gate: gate({
          classes: {
            'pf1/bleed': { gate: 'dependent-omitted', reason: 'Omitted.' },
          },
        }),
      },
      name: 'Bleed',
      outcome: { outcome: 'failed', cause: 'dependent-omitted' },
    },
    {
      case: 'missing from the build',
      build: { stage: 'built', gate: gate({ missing: ['pf1/bleed'] }) },
      name: 'Bleed',
      outcome: {
        outcome: 'failed',
        cause: 'no-candidate',
        reason: 'The release inputs produce no candidate for this row.',
      },
    },
    {
      case: 'admitted in a refused release',
      build: {
        stage: 'refused',
        reason: 'Catalog Release gates failed: {...}',
        gate: gate(),
      },
      name: 'Dodge',
      outcome: {
        outcome: 'failed',
        cause: 'unreleased',
        reason: 'Catalog Release gates failed',
      },
    },
    {
      case: 'an unmatched name with an exception',
      build: { stage: 'built', gate: gate() },
      name: 'Lethal Stance',
      outcome: { subject: 'gap', outcome: 'excepted' },
    },
    {
      case: 'an open race',
      build: { stage: 'built', gate: gate() },
      name: 'race not written',
      outcome: { outcome: 'failed', cause: 'race-open', characters: ['2'] },
    },
  ] satisfies {
    case: string;
    build: PartyBuildState;
    name: string;
    outcome: object;
  }[])('$case', ({ build, name, outcome }) => {
    expect(outcomeOf(qualify(build), name)).toMatchObject(outcome);
  });

  it('passes a held row with a recorded exception and lists the exception', () => {
    const report = qualify(
      {
        stage: 'built',
        gate: gate({
          classes: { 'pf1/witch': { gate: 'held', reason: held } },
        }),
      },
      [exception({ kind: 'key', key: 'pf1/witch' }), lethalStance],
    );
    expect(outcomeOf(report, 'Witch')).toMatchObject({
      outcome: 'excepted',
      exception: 'Entered as a one-off entry.',
    });
    expect(
      report.qualification.exceptions.map(({ subject }) => subject),
    ).toEqual(['key pf1/witch', 'unmatched Lethal Stance']);
    expect(report.qualification.findings).toEqual([]);
  });

  it('finds a stale exception: an admitted row, a row outside the scope, a name the builds match', () => {
    const report = qualify({ stage: 'built', gate: gate() }, [
      exception({ kind: 'key', key: 'pf1/dodge' }),
      exception({ kind: 'key', key: 'pf1/gone' }),
      exception({ kind: 'unmatched', name: 'Ironfang Training' }),
      exception({ kind: 'form', name: 'Spell-in-item consumables' }),
    ]);
    expect(report.qualification.findings).toEqual([
      {
        code: 'exception-stale',
        key: 'key pf1/dodge',
        reason: 'The gate admits pf1/dodge; remove its exception.',
      },
      {
        code: 'exception-stale',
        key: 'key pf1/gone',
        reason: 'pf1/gone is no row of campaign-party-v1.',
      },
      {
        code: 'exception-stale',
        key: 'unmatched Ironfang Training',
        reason:
          "No character's builds leave Ironfang Training unmatched; remove its exception.",
      },
    ]);
    // The admitted row is included; its exception only fails the scope.
    expect(outcomeOf(report, 'Dodge')).toMatchObject({ outcome: 'included' });
    expect(report.qualification.status).toBe('FAILED');
  });

  it('qualifies only when every row and name passes, and says which characters it serves', () => {
    const failed = qualify({
      stage: 'built',
      gate: gate({ classes: { 'pf1/witch': { gate: 'held', reason: held } } }),
    });
    expect(failed.qualification.status).toBe('FAILED');
    expect(failed.qualification.counts).toMatchObject({
      rows: 6,
      gaps: 2,
      included: 5,
      excepted: 1,
      failed: 2,
      failedByCause: { held: 1, 'race-open': 1 },
    });
    expect(failed.qualification.characters).toEqual([
      { id: '1', served: true, failing: [], unreleased: 0 },
      {
        id: '2',
        served: false,
        failing: [
          { key: 'pf1/witch', name: 'Witch', cause: 'held' },
          { name: 'race not written', cause: 'race-open' },
        ],
        unreleased: 0,
      },
    ]);
    const qualified = qualifyPartyScope({
      scope,
      builds: parsePartyBuilds({
        ...builds,
        characters: builds.characters.filter(({ id }) => id === '1'),
      }),
      exceptions: [lethalStance],
      build: { stage: 'built', gate: gate() },
    });
    expect(qualified.qualification.status).toBe('QUALIFIED');
    // A refused release serves nobody; its admitted rows are counted apart.
    const refused = qualify({
      stage: 'refused',
      reason: 'Refused',
      gate: gate(),
    });
    expect(refused.qualification.characters[0]).toEqual({
      id: '1',
      served: false,
      failing: [],
      unreleased: 3,
    });
  });

  it('refuses an exceptions file out of order or with a subject twice', () => {
    const file = (exceptions: PartyException[]) => ({
      schemaVersion: 1,
      scopeVersion: 'campaign-party-v1',
      note: 'Fixture.',
      exceptions,
    });
    expect(parsePartyExceptions(file([lethalStance]))).toEqual([lethalStance]);
    expect(() =>
      parsePartyExceptions(
        file([lethalStance, exception({ kind: 'form', name: 'Consumables' })]),
      ),
    ).toThrow('out of order');
    expect(() =>
      parsePartyExceptions(file([lethalStance, lethalStance])),
    ).toThrow('appears twice');
    expect(() =>
      parsePartyExceptions(file([{ ...lethalStance, decidedOn: 'yesterday' }])),
    ).toThrow('Invalid ISO date');
  });
});
