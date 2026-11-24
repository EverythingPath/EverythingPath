// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  partyBuildsPath,
  partyCharacterGaps,
  parsePartyBuilds,
  type PartyCharacter,
} from '../../scripts/catalog/party/party-builds';
import {
  decodePartyScope,
  partyScopePath,
} from '../../scripts/catalog/party/party-scope';
import { reviewedPrestigeSchedule } from '../../scripts/catalog/pcgen/prestige-schedules';

// Party slice party-dd-rows (#767; research party-code §1, D3): character 7
// (Bloodrager 4 / Monk 1 / Dragon Disciple 3) names the Dragon Disciple class
// and the features its sheet lists at Dragon Disciple levels 1 to 3 by the
// keys #716 D1 froze and emits, and its "Bloodline Feat" is Dragon
// Disciple's, not the bloodrager's 12th-level increment. The scope's closure
// adds the class's eleven features, since its featuresByLevel names them all.
const DRAGON_DISCIPLE = 'everythingpath/dragon-disciple';
const feature = (name: string) => `${DRAGON_DISCIPLE}-${name}`;
/** The sheet's Dragon Disciple features, at their PRD levels (dragonDisciple.html:363-365). */
const sheetFeatures = [
  { key: feature('natural-armor-increase'), classLevel: 1 },
  { key: feature('ability-boost'), classLevel: 2 },
  { key: feature('bloodline-feat'), classLevel: 2 },
  { key: feature('dragon-bite'), classLevel: 2 },
  { key: feature('breath-weapon'), classLevel: 3 },
];
/** The class's eleven features (pcgen-prestige-emission.test.ts). */
const allFeatures = [
  'weapon-and-armor-proficiency',
  'spells-per-day',
  'blood-of-dragons',
  'natural-armor-increase',
  'ability-boost',
  'bloodline-feat',
  'dragon-bite',
  'breath-weapon',
  'blindsense',
  'dragon-form',
  'wings',
].map(feature);
const BLOODRAGER_BLOODLINE_FEAT_12 =
  'everythingpath/bloodrager-bloodline-feat-12';

const bytes = readFileSync(partyBuildsPath, 'utf8');
const builds = parsePartyBuilds(JSON.parse(bytes));
const seven = builds.characters.find(
  (row): row is Extract<PartyCharacter, { kind: 'character' }> =>
    row.id === '7' && row.kind === 'character',
)!;
const scope = decodePartyScope(
  JSON.parse(readFileSync(partyScopePath, 'utf8')),
);
const ledger = JSON.parse(
  readFileSync('scripts/catalog/everythingpath-identities.json', 'utf8'),
) as {
  identities: {
    externalKey: string;
    kind: string;
    sources: { locator: { key: string } }[];
  }[];
};
const frozen = new Map(
  ledger.identities.map((identity) => [identity.externalKey, identity]),
);

describe('D3: character 7’s Dragon Disciple rows', () => {
  it('names the Dragon Disciple class and the sheet’s features by their frozen keys, leaving no unmatched name', () => {
    expect(seven.levels).toMatchObject({
      build: {
        now: expect.arrayContaining([{ class: 'Dragon Disciple', level: 3 }]),
      },
    });
    expect(seven.keys.classes).toContainEqual(
      expect.objectContaining({ kind: 'matched', key: DRAGON_DISCIPLE }),
    );
    const named = (seven.keys.classFeatures ?? []).flatMap((entry) =>
      entry.kind === 'matched' && entry.key.startsWith(`${DRAGON_DISCIPLE}-`)
        ? [entry.key]
        : [],
    );
    expect(named.sort()).toEqual(sheetFeatures.map(({ key }) => key).sort());
    expect(partyCharacterGaps(seven)).toEqual([]);
    expect(frozen.get(DRAGON_DISCIPLE)?.kind).toBe('prestigeClass');
    for (const { key } of sheetFeatures)
      expect(frozen.get(key)?.kind).toBe('prestigeClassFeature');
  });

  it('names only features of the levels the character has, as the reviewed schedule grants them', () => {
    const schedule = reviewedPrestigeSchedule('Dragon Disciple');
    const levelOf = (key: string) =>
      schedule?.rows.find(
        (row) => row.feature === frozen.get(key)?.sources[0]?.locator.key,
      )?.classLevel;
    expect(
      sheetFeatures.map(({ key }) => ({ key, classLevel: levelOf(key) })),
    ).toEqual(sheetFeatures);
  });

  it('re-keys the sheet’s "Bloodline Feat" from the bloodrager’s 12th-level increment to Dragon Disciple’s', () => {
    const bloodlineFeats = (seven.keys.classFeatures ?? []).filter(
      (entry) => entry.name === 'Bloodline Feat',
    );
    expect(bloodlineFeats).toEqual([
      expect.objectContaining({
        kind: 'matched',
        key: feature('bloodline-feat'),
      }),
    ]);
    expect(
      scope.roots.find((root) => root.key === BLOODRAGER_BLOODLINE_FEAT_12),
    ).toBeUndefined();
    // Still a row: the bloodrager class's schedule reaches it for 7 and 10.
    expect(
      scope.rows.find((row) => row.key === BLOODRAGER_BLOODLINE_FEAT_12),
    ).toMatchObject({ characters: ['7', '10'] });
  });

  it('is in the committed scope, from these builds: the class and the sheet’s features as 7’s roots, and all eleven features as 7’s rows', () => {
    expect(scope.binding.builds.sha256).toBe(
      createHash('sha256').update(bytes).digest('hex'),
    );
    for (const key of [DRAGON_DISCIPLE, ...sheetFeatures.map(({ key }) => key)])
      expect(scope.roots.find((root) => root.key === key)).toMatchObject({
        characters: ['7'],
      });
    const rows = scope.rows.filter(
      (row) =>
        row.key === DRAGON_DISCIPLE ||
        row.key.startsWith(`${DRAGON_DISCIPLE}-`),
    );
    expect(
      rows.map(({ key, kind, characters }) => ({ key, kind, characters })),
    ).toEqual(
      expect.arrayContaining([
        { key: DRAGON_DISCIPLE, kind: 'class', characters: ['7'] },
        ...allFeatures.map((key) => ({
          key,
          kind: 'classFeature',
          characters: ['7'],
        })),
      ]),
    );
    expect(rows).toHaveLength(12);
  });
});
