// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePartyBuilds } from '../../scripts/catalog/party/party-builds';
import {
  buildPartyScope,
  type PartyCatalogEntry,
} from '../../scripts/catalog/party/party-scope';
import {
  holdReasons,
  partyStatus,
  partyStatusLines,
} from '../../scripts/catalog/party/party-status';

const entry = (
  [externalKey, name, kind]: [string, string, string],
  refs: string[] = [],
) =>
  ({
    externalKey,
    name,
    description: '',
    detail: { kind, features: refs.map((key) => ({ externalKey: key })) },
  }) as unknown as PartyCatalogEntry;

const builds = parsePartyBuilds({
  schemaVersion: 1,
  scopeVersion: 'campaign-party-v1',
  note: 'Fixture.',
  characters: [
    {
      id: '1',
      kind: 'character',
      race: { kind: 'open', note: 'The sheet writes no race.' },
      levels: {
        kind: 'written',
        build: {
          now: [{ class: 'Witch', level: 6 }],
          next: { kind: 'known', classes: [{ class: 'Witch', level: 7 }] },
        },
      },
      keys: {
        classes: [{ kind: 'matched', key: 'pf1/witch', name: 'Witch' }],
        spells: [{ kind: 'matched', key: 'pf1/bleed', name: 'Bleed' }],
      },
    },
    {
      id: '2',
      kind: 'character',
      race: { kind: 'matched', key: 'pf1/human', name: 'Human' },
      levels: {
        kind: 'written',
        build: {
          now: [{ class: 'Fighter', level: 3 }],
          next: { kind: 'known', classes: [{ class: 'Fighter', level: 4 }] },
        },
      },
      keys: {
        classes: [{ kind: 'matched', key: 'pf1/fighter', name: 'Fighter' }],
        equipment: [
          { kind: 'matched', key: 'pf1/acid', name: 'Acid' },
          { kind: 'matched', key: 'pf1/bow', name: 'Longbow' },
        ],
        feats: [
          { kind: 'unmatched', name: 'Lethal Stance', note: 'No record.' },
        ],
      },
    },
    {
      id: '3',
      kind: 'character',
      race: { kind: 'matched', key: 'pf1/human', name: 'Human' },
      levels: {
        kind: 'written',
        build: {
          now: [{ class: 'Fighter', level: 3 }],
          next: { kind: 'known', classes: [{ class: 'Fighter', level: 4 }] },
        },
      },
      keys: {
        classes: [{ kind: 'matched', key: 'pf1/fighter', name: 'Fighter' }],
      },
    },
  ],
});
const scope = buildPartyScope({
  builds,
  buildsBytes: '{}',
  catalog: {
    upstream: [],
    entries: [
      entry(['pf1/witch', 'Witch', 'class'], ['pf1/grand-hex', 'pf1/bleed']),
      entry(['pf1/grand-hex', 'Grand Hex', 'classFeature']),
      entry(['pf1/bleed', 'Bleed', 'spell']),
      entry(['pf1/human', 'Human', 'race']),
      entry(['pf1/fighter', 'Fighter', 'class'], ['pf1/training']),
      entry(
        ['pf1/training', 'Weapon Training', 'classFeature'],
        ['pf1/training-2'],
      ),
      entry(['pf1/training-2', 'Weapon Training 2', 'classFeature']),
      entry(['pf1/acid', 'Acid', 'item']),
      entry(['pf1/bow', 'Longbow', 'item']),
    ],
  },
});
const scripted =
  'Held under #227: scripted match held: no PCGen match or stored assessment; only its class association names a book: Witch (PZO1115).';
const gate = {
  admitted: [
    { externalKey: 'pf1/bleed' },
    { externalKey: 'pf1/human' },
    { externalKey: 'pf1/bow' },
    { externalKey: 'pf1/fighter' },
    { externalKey: 'pf1/training' },
    { externalKey: 'pf1/training-2' },
  ],
  held: [
    { externalKey: 'pf1/grand-hex', reason: scripted },
    {
      externalKey: 'pf1/acid',
      reason:
        'Held under #227: declared book PZO1110, PZO9445 lacks reviewed notices: PZO9445.',
    },
  ],
  dependentOmissions: [
    { externalKey: 'pf1/witch', reason: 'Dependent omission: pf1/grand-hex.' },
  ],
  failures: [],
};
const labels = new Map([
  ['pf1/bleed', 'verified' as const],
  ['pf1/human', 'unverified' as const],
]);

describe('the party status', () => {
  const status = partyStatus({ builds, scope, gate, labels });

  it('counts each character’s rows by the gate’s result and its unmatched entries and open race', () => {
    expect(
      status.characters.map(
        ({
          id,
          needed,
          admitted,
          held,
          omitted,
          failed,
          unmatched,
          verified,
          unverified,
        }) => ({
          id,
          needed,
          admitted,
          held,
          omitted,
          failed,
          unmatched,
          verified,
          unverified,
        }),
      ),
    ).toEqual([
      {
        id: '1',
        needed: 4,
        admitted: 1,
        held: 1,
        omitted: 1,
        failed: 0,
        unmatched: 1,
        verified: 1,
        unverified: 0,
      },
      {
        id: '2',
        needed: 7,
        admitted: 5,
        held: 1,
        omitted: 0,
        failed: 0,
        unmatched: 1,
        verified: 0,
        unverified: 5,
      },
      {
        id: '3',
        needed: 4,
        admitted: 4,
        held: 0,
        omitted: 0,
        failed: 0,
        unmatched: 0,
        verified: 0,
        unverified: 4,
      },
    ]);
    expect(status.total).toMatchObject({
      needed: 11,
      admitted: 6,
      held: 2,
      omitted: 1,
      unmatched: 2,
    });
  });

  it('never counts a held row as admitted, even when the gate lists it twice', () => {
    const twice = partyStatus({
      builds,
      scope,
      gate: {
        ...gate,
        admitted: [...gate.admitted, { externalKey: 'pf1/acid' }],
      },
      labels,
    });
    expect(twice.total).toMatchObject({ admitted: 6, held: 2 });
    // A scope row the gate says nothing of is not admitted either.
    const silent = partyStatus({
      builds,
      scope,
      gate: { ...gate, admitted: gate.admitted.slice(1) },
      labels,
    });
    expect(silent.total).toMatchObject({ admitted: 5, absent: 1 });
    expect(silent.characters[0]?.ready).toBe(false);
  });

  it('groups held rows by reason with the notice code or record that would clear them', () => {
    expect(status.total.heldBy).toEqual([
      {
        reason: '#227 scripted match held',
        rows: 1,
        clearedBy:
          'a stored assessment or a reviewed #227 exception for each: Grand Hex',
      },
      { reason: 'notice not reviewed', rows: 1, clearedBy: 'notice PZO9445' },
    ]);
  });

  it('names the omitted classes and what they are omitted on', () => {
    expect(status.omitted).toEqual([
      {
        key: 'pf1/witch',
        kind: 'class',
        name: 'Witch',
        characters: ['1'],
        state: 'omitted',
        on: [
          'Grand Hex is held (#227 scripted match held: needs a stored assessment or a reviewed #227 exception)',
        ],
      },
    ]);
  });

  it('says per character whether it is ready, or the first thing that stops it', () => {
    expect(
      status.characters.map(({ id, firstStop }) => [id, firstStop]),
    ).toEqual([
      ['1', 'race not written (The sheet writes no race.)'],
      ['2', 'Lethal Stance has no catalog entry (No record.)'],
      ['3', null],
    ]);
    const lines = partyStatusLines(status);
    expect(lines.slice(-4)).toEqual([
      'Ready (every row admitted):',
      '  1: not ready: race not written (The sheet writes no race.)',
      '  2: not ready: Lethal Stance has no catalog entry (No record.)',
      '  3: ready',
    ]);
  });
});

describe('hold reasons', () => {
  it.each([
    [
      'Held under #227: named holds kept: class-abilities-625-owner-owed-PZO9491, class-abilities-625-owner-owed-PZO9493 (scripts/catalog/legal/class-abilities-625.json).',
      [
        {
          kind: 'named',
          reason: 'named hold',
          clears: [
            'class-abilities-625-owner-owed-PZO9491',
            'class-abilities-625-owner-owed-PZO9493',
          ],
        },
      ],
    ],
    [
      'Missing or unreviewed required notices: PZO9413.',
      [
        {
          kind: 'named',
          reason: 'notice not reviewed',
          clears: ['notice PZO9413'],
        },
      ],
    ],
    [
      'Structure hand review (#716 plan §6): owned feature pcgen:a.lst#X. Product Identity: DESCISPI (a.lst:3)',
      [
        {
          kind: 'per-row',
          reason: 'structure hand review (#716)',
          record: 'a structure curation record',
        },
        {
          kind: 'per-row',
          reason: 'Product Identity',
          record: 'a reviewed Product Identity decision',
        },
      ],
    ],
    ['Something new.', [{ kind: 'unclassified', reason: 'Something new.' }]],
  ])('classifies %s', (text, expected) => {
    expect(holdReasons(text)).toEqual(expected);
  });
});
