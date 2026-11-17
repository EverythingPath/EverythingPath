// @vitest-environment node
// Bane (#502's key) and Flaming (#503's key), the party's two weapon Item
// Abilities: their checked curation records, the imported detail they give the
// pinned bodies, and what the sheet's resolver calculates from them
// (docs/catalog-import/item-abilities-party-502.md).
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import type { PreviewEntry } from '../../scripts/catalog/map';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import {
  calculateCharacterSheet,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
} from '../../src/lib/character-sheet';
import { abilitySheet } from '../fixtures/pf-special-qualities-501/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';

const BANE = 'pf1-content/aaAmYJA3sBANIVeZ';
const FLAMING = 'pf1-content/bcWTxWA8Yi0V3FGZ';
const HELPER = 'pf1-content/upTvrmZoeKq2LI0F';
const DIR = 'pf1-content/src/pf-special-qualities';
// The pinned bodies (pf1-content 11.4.0, 02f4ab0d) and the Weapon Enchant
// Conditional Modifiers helper whose conditionals seed both records.
const PINNED = {
  [`${DIR}/Bane_aaAmYJA3sBANIVeZ.yaml`]:
    'd7c3223d5c41ee15d25a9154022b7dfe6e05ae1a493a287a736a93519a4439b5',
  [`${DIR}/Flaming_bcWTxWA8Yi0V3FGZ.yaml`]:
    '31912494345d9465f6b6d9959edafc1e2bd6e2353724685f9a7b4fb6a62dd2c2',
  [`${DIR}/_Weapon_Enchant_Conditional_Modifiers_upTvrmZoeKq2LI0F.yaml`]:
    '586d908414ecb1a2b4b1f63b8fe6cc07388d7394e5ef9c51df072ddc2ca173a9',
};
const REVIEWER = 'Sol (AI curator) for the owner';
const BANE_DAMAGE_NOTE =
  'Against a designated foe, the weapon also deals an extra 2d6 points of damage.';
const FLAMING_NOTE = 'The fire does not harm the wielder.';

const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const recordOf = (key: string) => {
  const rows = reviewedCuration.records.filter(
    (row) => row.externalKey === key,
  );
  expect(rows, key).toHaveLength(1);
  return rows[0]!;
};

async function importPinned(curation = reviewedCuration) {
  const tree = await materializePinnedTree(Object.keys(PINNED), {
    sha256: PINNED,
  });
  try {
    return await importCatalog({
      ...tree,
      remaps,
      curation,
      candidateKeys: [BANE, FLAMING],
    });
  } finally {
    await tree.dispose();
  }
}

function entryOf(entries: readonly PreviewEntry[], key: string) {
  const row = entries.find((entry) => entry.externalKey === key);
  if (!row) throw new Error(`Missing ${key}`);
  return row;
}

it('keeps one checked Item Ability record per key, bound to the pinned body and its helper seed', async () => {
  for (const [file, digest] of Object.entries(PINNED)) {
    const [repo, ...path] = file.split('/');
    expect(sha(await readPinned(repo as 'pf1-content', path.join('/')))).toBe(
      digest,
    );
  }
  const bane = recordOf(BANE);
  const flaming = recordOf(FLAMING);
  for (const record of [bane, flaming]) {
    expect(record).toMatchObject({
      kind: 'itemAbility',
      target: 'description',
      status: 'checked',
      diagnostics: [],
      reviewedBy: REVIEWER,
      reviewedOn: '2026-11-13',
    });
    expect(record.textSha256).toBe(sha(record.text));
    expect(record.seedBindings.map((seed) => seed.externalKey)).toEqual([
      HELPER,
    ]);
  }
  // Price +1 bonus; +2 better against the designated foe (pinned body,
  // PCGen cr_equipmods.lst:232). The extra 2d6 against the foe is a Note:
  // the overlay refuses a curated $choice die.
  expect(bane.outputs).toEqual([
    {
      kind: 'itemAbility',
      bonusEquivalent: 1,
      choice: 'creatureType',
      foeEnhancement: 2,
    },
    { kind: 'note', target: 'damage', text: BANE_DAMAGE_NOTE },
  ]);
  expect(bane.seedBindings[0]?.conditionalId).toBe('bnmukmzny3q5kkq8');
  // Price +1 bonus; 1d6 fire on a hit (pinned body, cr_equipmods.lst:238).
  expect(flaming.outputs).toEqual([
    {
      kind: 'itemAbility',
      bonusEquivalent: 1,
      damageDice: [{ on: 'hit', dice: '1d6', damageType: 'fire' }],
    },
    { kind: 'note', text: FLAMING_NOTE },
  ]);
  expect(flaming.seedBindings[0]?.conditionalId).toBe('82a2c967wtlp9zil');
});

it('states the price and effect in the literal PCGen rows', async () => {
  const lines = (
    await readPinned(
      'pcgen',
      'data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_equipmods.lst',
    )
  ).split('\n');
  const fields = (line: number) => lines[line - 1]?.split('\t') ?? [];
  expect(fields(232)).toEqual(
    expect.arrayContaining([
      'KEY:Special Ability ~ Bane ~ Weapon',
      'PLUS:1',
      'SPROP:%CHOICE weapons have +2 enhancement bonus and deal +2d6 bonus damage against the chosen foe',
    ]),
  );
  expect(fields(238)).toEqual(
    expect.arrayContaining([
      'KEY:Special Ability ~ Flaming ~ Weapon',
      'PLUS:1',
      'SPROP:+1d6 fire damage',
    ]),
  );
});

it('gives the imported pinned bodies the stored Item Ability detail, which the uncurated bodies lack', async () => {
  const uncurated = await importPinned({
    situations: reviewedCuration.situations,
    records: [],
  });
  expect(
    uncurated.curation.missing.map((row) => row.externalKey).sort(),
  ).toEqual([BANE, FLAMING]);
  for (const key of [BANE, FLAMING])
    expect(entryOf(uncurated.catalog.entries, key).detail).toEqual({
      kind: 'itemAbility',
      appliesTo: 'weapon',
    });

  const curated = await importPinned();
  expect(curated.curation.missing).toEqual([]);
  expect(curated.curation.stale).toEqual([]);
  expect(curated.curation.unresolvedMechanics).toEqual([]);
  const bane = entryOf(curated.catalog.entries, BANE);
  expect(bane.detail).toEqual({
    kind: 'itemAbility',
    appliesTo: 'weapon',
    bonusEquivalent: 1,
    choice: 'creatureType',
    foeEnhancement: 2,
  });
  expect(bane.modifiers).toEqual([]);
  expect(bane.situationalNotes).toEqual([
    { target: 'damage', text: BANE_DAMAGE_NOTE },
  ]);
  const flaming = entryOf(curated.catalog.entries, FLAMING);
  expect(flaming.detail).toEqual({
    kind: 'itemAbility',
    appliesTo: 'weapon',
    bonusEquivalent: 1,
    damageDice: [{ on: 'hit', dice: '1d6', damageType: 'fire' }],
  });
  expect(flaming.modifiers).toEqual([]);
  expect(flaming.situationalNotes).toEqual([{ text: FLAMING_NOTE }]);
});

/** The imported Item Ability as a resolver catalog entry, its detail as imported. */
function resolverEntry(entry: PreviewEntry): CharacterSheetCatalogEntry {
  return {
    _id: entry.externalKey,
    name: entry.name,
    ruleIdentity: entry.externalKey,
    modifiers: [],
    ...(entry.situationalNotes
      ? { situationalNotes: entry.situationalNotes }
      : {}),
    detail: entry.detail as CharacterSheetCatalogEntry['detail'],
  };
}

it('calculates the published values through the public resolver', async () => {
  const { catalog } = await importPinned();
  const abilities = [BANE, FLAMING].map((key) =>
    resolverEntry(entryOf(catalog.entries, key)),
  );
  // Str 16, BAB 11, a +1 longsword (1d8) listing the ability.
  const sheet = (ability: { catalogEntryId: string; choice?: string }) => {
    const input: CharacterSheetInput = abilitySheet({
      items: [
        {
          id: 'sword',
          definition: 'longsword',
          state: { enhancement: 1, abilities: [ability] },
        },
      ],
      abilities: [],
      routines: [{ id: 'routine', weapon: 'sword' }],
    });
    return {
      ...input,
      catalogEntries: [...input.catalogEntries, ...abilities],
    };
  };
  const line = (input: CharacterSheetInput, situations?: string[]) => {
    const result = calculateCharacterSheet(
      input,
      situations ? { situations } : {},
    );
    const routine = result.attackRoutines.find(
      (row) => row.entryId === 'routine',
    );
    const [first] = routine?.single ?? [];
    if (!first) throw new Error('Missing attack line');
    return {
      attack: first.attackBonus.total,
      damage: first.damageBonus.total,
      extra: first.extraDamage.map(
        ({ dice, damageType, on, situation, applies }) => ({
          dice,
          damageType,
          on,
          situation,
          applies,
        }),
      ),
      parts: result.itemParts,
    };
  };

  // Flaming: +11 BAB +3 Str +1 = +15, 1d8+4, and 1d6 fire on every hit.
  const flaming = line(sheet({ catalogEntryId: FLAMING }));
  expect(flaming).toMatchObject({ attack: 15, damage: 4 });
  expect(flaming.extra).toEqual([
    {
      dice: '1d6',
      damageType: 'fire',
      on: 'hit',
      situation: null,
      applies: true,
    },
  ]);

  // Bane contributes nothing until its foe is chosen.
  const unchosen = line(sheet({ catalogEntryId: BANE }));
  expect(unchosen).toMatchObject({ attack: 15, damage: 4, extra: [] });
  expect(unchosen.parts[0]?.parts[0]?.abilities[0]).toMatchObject({
    bonusEquivalent: 1,
    choiceMissing: true,
  });
  // Chosen (undead): outside the foe's Situation the weapon stays +1.
  const chosen = sheet({ catalogEntryId: BANE, choice: 'Undead' });
  expect(line(chosen)).toMatchObject({ attack: 15, damage: 4, extra: [] });
  // Against the foe its enhancement is +2 better: +3, so +17 and 1d8+6. The
  // extra 2d6 is the Note, not a die.
  expect(line(chosen, ['undead'])).toMatchObject({
    attack: 17,
    damage: 6,
    extra: [],
  });
  expect(line(chosen, ['undead']).parts[0]?.parts[0]).toMatchObject({
    bonusEquivalent: 2,
  });
});
