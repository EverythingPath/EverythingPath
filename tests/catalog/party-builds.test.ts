// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  parsePartyBuilds,
  partyCharacterGaps,
  partyCharacterKeys,
  partyGroupKinds,
  partyRaceKinds,
  readPartyBuilds,
} from '../../scripts/catalog/party/party-builds';
import { decodePartyScope } from '../../scripts/catalog/party/party-scope';

const witch = {
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
    feats: [
      { kind: 'matched', key: 'pf1/extra-hex', name: 'Extra Hex' },
      { kind: 'unmatched', name: 'Lethal Stance', note: 'No record.' },
    ],
  },
};
const builds = (...characters: unknown[]) => ({
  schemaVersion: 1,
  scopeVersion: 'campaign-party-v1',
  note: 'Fixture.',
  characters,
});

describe('the party builds file', () => {
  it('reads a character with its keys, unmatched entries and open race', () => {
    const [character] = parsePartyBuilds(builds(witch)).characters;
    expect(partyCharacterKeys(character)).toEqual([
      ['classes', 'pf1/witch'],
      ['feats', 'pf1/extra-hex'],
    ]);
    expect(partyCharacterGaps(character)).toEqual([
      {
        group: 'race',
        name: 'race not written',
        note: 'The sheet writes no race.',
      },
      { group: 'feats', name: 'Lethal Stance', note: 'No record.' },
    ]);
  });

  it('carries two builds where the level is open', () => {
    const open = {
      ...witch,
      levels: {
        kind: 'open',
        note: 'The sheet writes no level.',
        builds: [
          {
            now: [{ class: 'Witch', level: 8 }],
            next: { kind: 'known', classes: [{ class: 'Witch', level: 9 }] },
          },
          {
            now: [{ class: 'Witch', level: 9 }],
            next: { kind: 'known', classes: [{ class: 'Witch', level: 10 }] },
          },
        ],
      },
    };
    expect(parsePartyBuilds(builds(open)).characters[0]).toMatchObject({
      levels: { kind: 'open' },
    });
    // One build is not open.
    expect(() =>
      parsePartyBuilds(
        builds({
          ...open,
          levels: { ...open.levels, builds: [open.levels.builds[0]] },
        }),
      ),
    ).toThrow('expected object, received undefined');
  });

  it.each([
    [
      'a key under two groups',
      [
        witch,
        {
          ...witch,
          id: '2',
          keys: {
            ...witch.keys,
            traits: [
              { kind: 'matched', key: 'pf1/extra-hex', name: 'Extra Hex' },
            ],
          },
        },
      ],
      'pf1/extra-hex is under feats and traits',
    ],
    [
      'a key named twice by one character',
      [
        {
          ...witch,
          keys: {
            ...witch.keys,
            spells: [{ kind: 'matched', key: 'pf1/witch', name: 'Witch' }],
          },
        },
      ],
      'Character 1 names pf1/witch twice',
    ],
    [
      'a level in a class the character doesn’t name',
      [{ ...witch, keys: { feats: witch.keys.feats } }],
      'levels in Witch, which its classes don',
    ],
    [
      'a next level that skips one',
      [
        {
          ...witch,
          levels: {
            kind: 'written',
            build: {
              now: [{ class: 'Witch', level: 6 }],
              next: { kind: 'known', classes: [{ class: 'Witch', level: 8 }] },
            },
          },
        },
      ],
      'next level is 8, not 7',
    ],
    [
      'a companion of no character',
      [
        witch,
        { id: '4c', kind: 'companion', companionOf: '4', hitDice: 6, keys: {} },
      ],
      'belongs to no character 4',
    ],
    ['a character id twice', [witch, witch], 'Character 1 appears twice'],
  ])('refuses %s', (_, characters, message) => {
    expect(() => parsePartyBuilds(builds(...characters))).toThrow(message);
  });

  it('refuses a name where a number belongs and fields it doesn’t know', () => {
    expect(() =>
      parsePartyBuilds(builds({ ...witch, id: 'not-a-number' })),
    ).toThrow('Invalid string');
    expect(() =>
      parsePartyBuilds(builds({ ...witch, player: 'someone' })),
    ).toThrow('player');
    expect(() =>
      parsePartyBuilds(
        builds({ ...witch, keys: { ...witch.keys, languages: [] } }),
      ),
    ).toThrow('languages');
  });
});

describe('the committed party builds', () => {
  it('validates: 13 characters and the companion', async () => {
    const { builds } = await readPartyBuilds();
    expect(builds.characters.map(({ id }) => id)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '4c',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      '11',
      '12',
      '13',
    ]);
  });

  it('puts no key under the wrong kind: each key has its group’s catalog kind in the committed scope', async () => {
    const { builds } = await readPartyBuilds();
    const scope = decodePartyScope(
      JSON.parse(
        await readFile('scripts/catalog/scopes/campaign-party-v1.json', 'utf8'),
      ),
    );
    const kinds = new Map(scope.rows.map(({ key, kind }) => [key, kind]));
    const wrong = builds.characters.flatMap((character) =>
      partyCharacterKeys(character).flatMap(([group, key]) => {
        const allowed: readonly string[] =
          group === 'race' ? partyRaceKinds : partyGroupKinds[group];
        const kind = kinds.get(key);
        return kind && allowed.includes(kind)
          ? []
          : [`${character.id} ${group} ${key} ${kind ?? 'not in the scope'}`];
      }),
    );
    expect(wrong).toEqual([]);
  });
});
