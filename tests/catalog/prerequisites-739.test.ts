// @vitest-environment node
import { expect, test } from 'vitest';
import { parse } from 'yaml';
import { mapEntry } from '../../scripts/catalog/map';
import {
  sourceDescription,
  upstreamRecord,
  type LoadedRecord,
} from '../../scripts/catalog/records';
import { calculateCharacterSheet } from '../../src/lib/character-sheet';
import {
  prerequisiteSheet,
  selectedFeat,
} from '../../src/lib/character-sheet-prerequisite-fixture';
import { readPinned } from './pinned-sources';

async function mapPinned(
  path: string,
  context: string[],
  editDescription?: (html: string) => string,
) {
  const records = await Promise.all(
    [path, ...context].map(async (file): Promise<LoadedRecord> => {
      const [repo, directory, pack, ...rest] = file.split('/');
      if (repo !== 'pf1' && repo !== 'pf1-content')
        throw new Error(`Unknown repository ${repo}`);
      const sourcePath = [directory, pack, ...rest].join('/');
      return {
        repo,
        pack: pack ?? '',
        path: sourcePath,
        record: upstreamRecord.parse(parse(await readPinned(repo, sourcePath))),
      };
    }),
  );
  const source = records[0];
  if (!source) throw new Error('Missing prerequisite source');
  if (editDescription)
    source.record.system.description = {
      value: editDescription(sourceDescription(source.record)),
    };
  const lookup = new Map(
    records.map((record) => [`${record.repo}/${record.record._id}`, record]),
  );
  return mapEntry({
    source,
    kind: source.pack === 'pf-traits' ? 'trait' : 'feat',
    lookup,
    resolveKey: (key) => (lookup.has(key) ? key : undefined),
    spellClassTags: new Set(),
  });
}

const ironhide = 'pf1-content/src/pf-feats/Ironhide_bX7KwmeNRQv2tBTh.yaml';
const ironhideRaces = [
  'pf1/packs/races/dwarf.nEltI9y37rKJTeWo.yaml',
  'pf1/packs/races/half-orc.dCAXgdA6Db1Z3ccz.yaml',
  'pf1/packs/races/orc.JOuAdPAOTat7d5v6.yaml',
];

test('pinned Ironhide requires Constitution and any one listed race, with failures advisory', async () => {
  const mapped = await mapPinned(ironhide, [
    ...ironhideRaces,
    'pf1-content/src/pf-racial-traits/Dwarf_cHfF0MzvRePtnPBS.yaml',
    'pf1-content/src/pf-racial-traits/Orc_l7CqdrmNxsmEsBBG.yaml',
  ]);
  expect(mapped.prerequisites).toEqual([
    { kind: 'ability', ability: 'constitution', min: 13 },
    {
      anyOf: ironhideRaces.map((path) => ({
        kind: 'race',
        race: [`pf1/${path.split('.').at(-2)}`],
      })),
    },
  ]);
  for (const race of [
    ...ironhideRaces.map((path) => `pf1/${path.split('.').at(-2)}`),
    'other',
  ]) {
    const input = prerequisiteSheet(
      [selectedFeat('ironhide')],
      [
        {
          _id: 'ironhide',
          ruleIdentity: mapped.externalKey,
          modifiers: [],
          detail: { kind: 'feat' },
          prerequisites: mapped.prerequisites,
        },
        {
          _id: 'race',
          ruleIdentity: race,
          modifiers: [],
          detail: { kind: 'race', racialTraits: [] },
        },
      ],
    );
    input.entries = [
      ...input.entries,
      {
        _id: 'race-row',
        kind: 'race',
        active: true,
        catalogEntryId: 'race',
        state: { kind: 'race' },
      },
    ];
    input.catalogEntries[0]!.modifiers = input.catalogEntries[0]!.modifiers.map(
      (row) => (row.target === 'ability.con' ? { ...row, value: 13 } : row),
    );
    const checks = calculateCharacterSheet(input).prerequisites.filter(
      (row) => row.view === 'current',
    );
    expect(checks.map((row) => row.met)).toEqual([true, race !== 'other']);
    input.catalogEntries[0]!.modifiers = input.catalogEntries[0]!.modifiers.map(
      (row) => (row.target === 'ability.con' ? { ...row, value: 12 } : row),
    );
    expect(
      calculateCharacterSheet(input)
        .prerequisites.filter((row) => row.view === 'current')
        .map((row) => row.met),
    ).toEqual([false, race !== 'other']);
  }
});

const bullCatcher =
  'pf1-content/src/pf-feats/Bull_Catcher_Wrangler_htoNOEwtY5Reb7pa.yaml';
const bullContext = [
  'pf1-content/src/pf-feats/Bull_Catcher_Style_QmQVSgZBDBcECMRz.yaml',
  'pf1-content/src/pf-feats/Bull_Catcher_Toss_HjPc9WT7tHZfSOuL.yaml',
  'pf1/packs/feats/improved-grapple.ZmQkRk93nbHxsQSt.yaml',
  'pf1/packs/feats/improved-unarmed-strike.2aTFNMs3pW6nUBlr.yaml',
  'pf1/packs/classes/brawler.iDlGMIezGuqqt8Us.yaml',
  'pf1/packs/classes/monk.W8dxwZ1CZiwLKsqr.yaml',
  'pf1/packs/class-abilities/brawler.5K2nfB7kaAhKEruh.yaml',
  'pf1-content/src/pf-class-abilities/Monk_hDdONmiC8ZlK1pXt.yaml',
];

test('Bull-Catcher Wrangler retains its preceding conjunction and resolves class alternatives in the complete same-name context', async () => {
  const mapped = await mapPinned(bullCatcher, bullContext);
  expect(mapped.prerequisites).toEqual([
    { kind: 'ability', ability: 'dexterity', min: 13 },
    { kind: 'feat', feat: 'pf1-content/QmQVSgZBDBcECMRz' },
    { kind: 'feat', feat: 'pf1-content/HjPc9WT7tHZfSOuL' },
    { kind: 'feat', feat: 'pf1/ZmQkRk93nbHxsQSt' },
    { kind: 'feat', feat: 'pf1/2aTFNMs3pW6nUBlr' },
    {
      anyOf: [
        { kind: 'bab', bab: 12 },
        { kind: 'classLevel', classLevel: 'pf1/iDlGMIezGuqqt8Us', min: 8 },
        { kind: 'classLevel', classLevel: 'pf1/W8dxwZ1CZiwLKsqr', min: 8 },
      ],
    },
  ]);
});

test('Manipulative Presence shares 19 only between Int and Cha and retains the complete spellcasting condition', async () => {
  const mapped = await mapPinned(
    'pf1-content/src/pf-feats/Manipulative_Presence_hB5R3di0387Zb2Uk.yaml',
    [],
  );
  expect(mapped.prerequisites).toEqual([
    {
      anyOf: [
        { kind: 'ability', ability: 'intelligence', min: 19 },
        { kind: 'ability', ability: 'charisma', min: 19 },
      ],
    },
    { kind: 'unchecked', unchecked: 'Hidden Presence' },
    {
      kind: 'unchecked',
      unchecked: 'ability to cast possession or greater possession',
    },
  ]);
  for (const [intelligence, charisma, met] of [
    [19, 10, true],
    [10, 19, true],
    [18, 18, false],
  ] as const) {
    const input = prerequisiteSheet(
      [selectedFeat('presence')],
      [
        {
          _id: 'presence',
          ruleIdentity: mapped.externalKey,
          modifiers: [],
          detail: { kind: 'feat' },
          prerequisites: mapped.prerequisites,
        },
      ],
    );
    input.catalogEntries[0]!.modifiers = input.catalogEntries[0]!.modifiers.map(
      (row) =>
        row.target === 'ability.int'
          ? { ...row, value: intelligence }
          : row.target === 'ability.cha'
            ? { ...row, value: charisma }
            : row,
    );
    expect(
      calculateCharacterSheet(input)
        .prerequisites.filter((row) => row.view === 'current')
        .map((row) => row.met),
    ).toEqual([met, null, null]);
  }
});

test('Ace Disarm treats the book and page as a citation while Voracious Blade retains its weapon choice', async () => {
  const ace = await mapPinned(
    'pf1-content/src/pf-feats/Ace_Disarm_kty3YnZbUWwB3gUR.yaml',
    [
      'pf1-content/src/pf-feats/Ranged_Disarm_Y0QdKaSOgwgVWFgL.yaml',
      'pf1/packs/feats/deadly-aim.K4FEFu94JKOP2l51.yaml',
    ],
  );
  expect(ace.prerequisites?.[2]).toEqual({
    kind: 'feat',
    feat: 'pf1-content/Y0QdKaSOgwgVWFgL',
  });
  expect(ace.prerequisiteText).toContain(
    'Ranged Disarm (Ranged Tactics Toolbox 8)',
  );
  const blade = await mapPinned(
    'pf1-content/src/pf-feats/Voracious_Blade_qIApIMMuzczqRPQi.yaml',
    ['pf1/packs/feats/weapon-focus.n250dFlbykAIAg5Z.yaml'],
  );
  expect(blade.prerequisites?.[0]).toEqual({
    kind: 'feat',
    feat: 'pf1/n250dFlbykAIAg5Z',
    choice: 'rhoka sword',
  });
});

const elementalFeat =
  'pf1-content/src/pf-feats/Elemental_Focus_1frgqDSnQFiTq0MC.yaml';
const elementalFeature =
  'pf1/packs/class-abilities/elemental-focus.x9TM9MHoUl4cv9Ht.yaml';
const kineticist = 'pf1/packs/classes/kineticist.vh9TZBE6BRu9sCfE.yaml';
const greaterElemental =
  'pf1-content/src/pf-feats/Greater_Elemental_Focus_l4yE4RGFbORuDfp7.yaml';

const improvedAwesomeBlow =
  'pf1-content/src/pf-feats/Improved_Awesome_Blow_LwguZfORlrl8aMNq.yaml';
const awesomeContext = [
  'pf1/packs/feats/awesome-blow.KPaC3H6EQGG4sXLT.yaml',
  'pf1/packs/class-abilities/awesome-blow.EnMgClQRxY1GXg4e.yaml',
  'pf1/packs/classes/brawler.iDlGMIezGuqqt8Us.yaml',
  'pf1/packs/feats/power-attack.FUW5mIXHNBBIQ1Sq.yaml',
];

test('Improved Awesome Blow scopes feat and feature evidence to each alternative in the full same-name context', async () => {
  const mapped = await mapPinned(improvedAwesomeBlow, awesomeContext);
  expect(mapped.prerequisites).toEqual([
    { kind: 'ability', ability: 'strength', min: 13 },
    {
      anyOf: [
        { kind: 'feat', feat: 'pf1/KPaC3H6EQGG4sXLT' },
        {
          kind: 'classFeature',
          classFeature: 'pf1/EnMgClQRxY1GXg4e',
          classFeatureName: 'Awesome Blow',
          classFeatureClass: 'pf1/iDlGMIezGuqqt8Us',
        },
      ],
    },
    { kind: 'feat', feat: 'pf1/FUW5mIXHNBBIQ1Sq' },
  ]);
  for (const held of ['feat', 'classFeature', 'neither'] as const) {
    for (const strength of [12, 13]) {
      for (const powerAttack of [false, true]) {
        const input = prerequisiteSheet(
          [
            selectedFeat('improved'),
            ...(held === 'feat' ? [selectedFeat('awesome-feat')] : []),
            ...(held === 'classFeature'
              ? [
                  {
                    _id: 'awesome-feature',
                    catalogEntryId: 'awesome-feature',
                    kind: 'classFeature' as const,
                    active: true,
                    state: { kind: 'classFeature' as const },
                  },
                ]
              : []),
            ...(powerAttack ? [selectedFeat('power')] : []),
          ],
          [
            {
              _id: 'improved',
              ruleIdentity: mapped.externalKey,
              modifiers: [],
              detail: { kind: 'feat' },
              prerequisites: mapped.prerequisites,
            },
            {
              _id: 'awesome-feat',
              ruleIdentity: 'pf1/KPaC3H6EQGG4sXLT',
              modifiers: [],
              detail: { kind: 'feat' },
            },
            {
              _id: 'awesome-feature',
              ruleIdentity: 'pf1/EnMgClQRxY1GXg4e',
              modifiers: [],
              detail: { kind: 'classFeature' },
            },
            {
              _id: 'power',
              ruleIdentity: 'pf1/FUW5mIXHNBBIQ1Sq',
              modifiers: [],
              detail: { kind: 'feat' },
            },
          ],
        );
        input.catalogEntries[0]!.modifiers =
          input.catalogEntries[0]!.modifiers.map((row) =>
            row.target === 'ability.str' ? { ...row, value: strength } : row,
          );
        expect(
          calculateCharacterSheet(input)
            .prerequisites.filter(
              (row) => row.view === 'current' && row.entryId === 'improved',
            )
            .map((row) => row.met),
        ).toEqual([strength >= 13, held !== 'neither', powerAttack]);
      }
    }
  }
});

test('an explicit Awesome Blow UUID governs even when its label and neighboring branch name another kind', async () => {
  const mapped = await mapPinned(improvedAwesomeBlow, awesomeContext, (html) =>
    html.replace(
      'Awesome Blow or',
      '@UUID[Compendium.pf1.feats.KPaC3H6EQGG4sXLT]{awesome blow class feature} or',
    ),
  );
  expect(mapped.prerequisites?.[1]).toMatchObject({
    anyOf: [
      { kind: 'feat', feat: 'pf1/KPaC3H6EQGG4sXLT' },
      { kind: 'classFeature', classFeature: 'pf1/EnMgClQRxY1GXg4e' },
    ],
  });
});

test("Shifter's Rush keeps the entire ambiguous Wild Shape clause unchecked and still checks shifter level four", async () => {
  const mapped = await mapPinned(
    'pf1-content/src/pf-feats/Shifter_s_Rush_l8EhQVMGiejaiJTI.yaml',
    [
      'pf1/packs/class-abilities/wild-shape.sJdBOE9lwz5XAkUi.yaml',
      'pf1/packs/class-abilities/wild-shape-shi.qjpLIatoQIzmcehq.yaml',
      'pf1/packs/classes/druid.7eZQP0MzeO2svmVF.yaml',
      'pf1/packs/classes/shifter.16mfrGi2UHTsME4W.yaml',
    ],
  );
  expect(mapped.prerequisites).toEqual([
    { kind: 'unchecked', unchecked: 'Wild shape class feature' },
    { kind: 'classLevel', classLevel: 'pf1/16mfrGi2UHTsME4W', min: 4 },
  ]);
  expect(mapped.prerequisiteText).toBe(
    'Wild shape class feature, shifter level 4th',
  );
  for (const feature of [
    'pf1/qjpLIatoQIzmcehq',
    'pf1/sJdBOE9lwz5XAkUi',
    undefined,
  ]) {
    for (const levels of [3, 4]) {
      const input = prerequisiteSheet(
        [
          selectedFeat('rush'),
          ...(feature
            ? [
                {
                  _id: 'shape',
                  catalogEntryId: 'shape',
                  kind: 'classFeature' as const,
                  active: true,
                  state: { kind: 'classFeature' as const },
                },
              ]
            : []),
        ],
        [
          {
            _id: 'rush',
            ruleIdentity: mapped.externalKey,
            modifiers: [],
            detail: { kind: 'feat' },
            prerequisites: mapped.prerequisites,
          },
          {
            _id: 'shape',
            ruleIdentity: feature ?? 'none',
            modifiers: [],
            detail: { kind: 'classFeature' },
          },
        ],
      );
      input.catalogEntries = input.catalogEntries.map((row) =>
        row._id === 'fighter'
          ? { ...row, ruleIdentity: 'pf1/16mfrGi2UHTsME4W' }
          : row,
      );
      for (let position = 2; position <= levels; position++)
        input.entries = [
          ...input.entries,
          {
            _id: `level-${position}`,
            kind: 'classLevel',
            active: true,
            state: {
              kind: 'classLevel',
              position,
              classEntryId: 'fighter',
              hpGained: 5,
            },
          },
        ];
      const result = calculateCharacterSheet(input);
      expect(
        result.prerequisites
          .filter((row) => row.view === 'current' && row.entryId === 'rush')
          .map((row) => row.met),
      ).toEqual([null, levels >= 4]);
    }
  }
});

test.each([
  {
    feat: 'Accursed_Hex_jAtgvGE8SGw3wRUc.yaml',
    features: ['hex.GBkIhC1Bpp2MAD4e.yaml', 'hex-sha.PW7CGt2iZsQFeZUI.yaml'],
    unchecked: 'Hex class feature',
  },
  {
    feat: 'Command_Plants_kAuQhaJHSl8Ixboc.yaml',
    features: [
      'channel-energy.kXXz1lO4i7CibHJ9.yaml',
      'channel-energy-war.Ktda1hno3geFi4j8.yaml',
    ],
    unchecked: 'Channel energy class feature',
  },
])(
  'retains $unchecked intact when native owner qualifications would otherwise choose a single wrong owner',
  async ({ feat, features, unchecked }) => {
    const mapped = await mapPinned(
      `pf1-content/src/pf-feats/${feat}`,
      features.map((file) => `pf1/packs/class-abilities/${file}`),
    );
    expect(mapped.prerequisites?.[0]).toEqual({ kind: 'unchecked', unchecked });
    const input = prerequisiteSheet(
      [selectedFeat('target')],
      [
        {
          _id: 'target',
          ruleIdentity: mapped.externalKey,
          modifiers: [],
          detail: { kind: 'feat' },
          prerequisites: mapped.prerequisites,
        },
      ],
    );
    expect(
      calculateCharacterSheet(input)
        .prerequisites.filter(
          (row) => row.view === 'current' && row.entryId === 'target',
        )
        .every((row) => row.met === null),
    ).toBe(true);
  },
);

test('Greater Elemental Focus uses the source-named feat despite the entire same-name kineticist context', async () => {
  const mapped = await mapPinned(greaterElemental, [
    elementalFeature,
    elementalFeat,
    kineticist,
  ]);
  expect(mapped.prerequisites).toEqual([
    { kind: 'feat', feat: 'pf1-content/1frgqDSnQFiTq0MC' },
  ]);
  const missing = await mapPinned(greaterElemental, [
    elementalFeature,
    kineticist,
  ]);
  expect(missing.prerequisites).toEqual([
    { kind: 'unchecked', unchecked: 'Elemental Focus' },
  ]);
  const flumefire = await mapPinned(
    'pf1-content/src/pf-feats/Flumefire_Rage_ha1lYbP2D9octSFB.yaml',
    [
      elementalFeature,
      elementalFeat,
      kineticist,
      'pf1/packs/class-abilities/bloodrage.5op6M5xchCJNsYRt.yaml',
      'pf1/packs/classes/bloodrager.E27lMw9YNOAjS009.yaml',
      'pf1-content/src/pf-feats/Varisian_Tattoo_HZcLHUmCoWirryD0.yaml',
    ],
  );
  expect(flumefire.prerequisites).toEqual([
    { kind: 'ability', ability: 'charisma', min: 15 },
    {
      anyOf: [
        {
          kind: 'classFeature',
          classFeature: 'pf1/5op6M5xchCJNsYRt',
          classFeatureName: 'Bloodrage',
          classFeatureClass: 'pf1/E27lMw9YNOAjS009',
        },
        {
          kind: 'classFeature',
          classFeature: 'pf1/x9TM9MHoUl4cv9Ht',
          classFeatureName: 'Elemental Focus',
          classFeatureClass: 'pf1/vh9TZBE6BRu9sCfE',
        },
        {
          kind: 'feat',
          feat: 'pf1-content/HZcLHUmCoWirryD0',
          choice: 'evocation',
        },
      ],
    },
  ]);
});

test('Crisis of Conscience accepts each neutral alignment and keeps its complete alignment history independently unresolved', async () => {
  const mapped = await mapPinned(
    'pf1-content/src/pf-feats/Crisis_of_Conscience_kIwMlVVYDRfoLLrH.yaml',
    [],
  );
  const history =
    'Your alignment must have shifted from either good or evil at least once since 1st level or the last time you completed this feat (see Special)';
  expect(mapped.prerequisites).toEqual([
    { kind: 'alignment', alignment: ['LN', 'N', 'CN'] },
    { kind: 'unchecked', unchecked: history },
  ]);
  for (const alignment of ['LN', 'N', 'CN', 'LG'] as const) {
    const input = prerequisiteSheet(
      [selectedFeat('crisis')],
      [
        {
          _id: 'crisis',
          ruleIdentity: mapped.externalKey,
          modifiers: [],
          detail: { kind: 'feat' },
          prerequisites: mapped.prerequisites,
        },
      ],
    );
    input.entries = input.entries.map((row) =>
      row.kind === 'base'
        ? { ...row, state: { ...row.state, alignment } }
        : row,
    );
    expect(
      calculateCharacterSheet(input)
        .prerequisites.filter((row) => row.view === 'current')
        .map((row) => row.met),
    ).toEqual([alignment !== 'LG', null]);
  }
});

test('same-name suffixes distinguish literal feat titles, saved choices and unsupported ancestry restrictions', async () => {
  const mythic = await mapPinned(
    'pf1-content/src/pf-feats/Critical_Mastery__Mythic__gpHQYsS62Pt945AW.yaml',
    ['pf1-content/src/pf-feats/Critical_Focus__Mythic__QPCkumnUx0drEa5J.yaml'],
  );
  expect(mythic.prerequisites?.[0]).toEqual({
    kind: 'feat',
    feat: 'pf1-content/QPCkumnUx0drEa5J',
  });
  const ancestry = await mapPinned(
    'pf1-content/src/pf-feats/One_Mind_hx14wugUCN6e0twu.yaml',
    ['pf1/packs/races/human.e6IaBxKgMxy1yKlr.yaml'],
  );
  expect(ancestry.prerequisites?.at(-1)).toEqual({
    kind: 'unchecked',
    unchecked: 'human (Vudrani)',
  });
  const claws = await mapPinned(
    'pf1-content/src/pf-feats/Eldritch_Claws_eZ1aqBIrR5L8sVu8.yaml',
    ['pf1-content/src/pf-racial-traits/Natural_Weapons_hP6ZbMYnXdVA42E8.yaml'],
  );
  expect(claws.prerequisites?.[1]).toEqual({
    kind: 'unchecked',
    unchecked: 'natural weapons',
  });
});

test('bounded feat lists are alternatives and narrative commas and numeric or phrases stay intact', async () => {
  const marked = await mapPinned(
    'pf1-content/src/pf-feats/Marked_for_Glory_bbJYORXfTotMVd8C.yaml',
    [
      'pf1/packs/feats/great-fortitude.fVRnBIHR4Jq6btvm.yaml',
      'pf1/packs/feats/iron-will.iAbIGhm7T2OK9Brt.yaml',
      'pf1/packs/feats/lightning-reflexes.0bZf3SDkvVOe2ujH.yaml',
    ],
  );
  expect(marked.prerequisites).toEqual([
    {
      anyOf: [
        { kind: 'feat', feat: 'pf1/fVRnBIHR4Jq6btvm' },
        { kind: 'feat', feat: 'pf1/iAbIGhm7T2OK9Brt' },
        { kind: 'feat', feat: 'pf1/0bZf3SDkvVOe2ujH' },
      ],
    },
  ]);
  const liberator = await mapPinned(
    'pf1-content/src/pf-feats/Liberator_cAwcKnzi84f2yfOy.yaml',
    [],
  );
  expect(liberator.prerequisites).toEqual([
    {
      kind: 'unchecked',
      unchecked:
        'You must have been enslaved for at least 6 months, or have the Imprisoned or Kidnapped background (see Ultimate Campaign)',
    },
  ]);
  const multiweapon = await mapPinned(
    'pf1-content/src/pf-feats/Multiweapon_Defense_cWQhG1ssb128lunj.yaml',
    [],
  );
  expect(multiweapon.prerequisites).toEqual([
    { kind: 'unchecked', unchecked: 'Three or more arms' },
    { kind: 'ability', ability: 'dexterity', min: 21 },
  ]);
});

test('each Bull-Catcher level or BAB branch qualifies independently and none bypasses the preceding requirements', async () => {
  const mapped = await mapPinned(bullCatcher, bullContext);
  const requiredFeats = [
    'pf1-content/QmQVSgZBDBcECMRz',
    'pf1-content/HjPc9WT7tHZfSOuL',
    'pf1/ZmQkRk93nbHxsQSt',
    'pf1/2aTFNMs3pW6nUBlr',
  ];
  for (const [classIdentity, levels, branchMet] of [
    ['fighter', 12, true],
    ['pf1/iDlGMIezGuqqt8Us', 8, true],
    ['pf1/W8dxwZ1CZiwLKsqr', 8, true],
    ['fighter', 1, false],
  ] as const) {
    for (const missing of [undefined, 'dexterity', ...requiredFeats]) {
      const feats = requiredFeats.filter((identity) => identity !== missing);
      const input = prerequisiteSheet(
        [
          ...feats.map((identity) => selectedFeat(identity)),
          selectedFeat('wrangler'),
        ],
        [
          ...requiredFeats.map((identity) => ({
            _id: identity,
            ruleIdentity: identity,
            modifiers: [],
            detail: { kind: 'feat' as const },
          })),
          {
            _id: 'wrangler',
            ruleIdentity: mapped.externalKey,
            modifiers: [],
            detail: { kind: 'feat' },
            prerequisites: mapped.prerequisites,
          },
        ],
      );
      input.catalogEntries = input.catalogEntries.map((row) =>
        row._id === 'fighter' && row.detail?.kind === 'class'
          ? {
              ...row,
              ruleIdentity: classIdentity,
              detail: {
                ...row.detail,
                bab:
                  classIdentity === 'pf1/W8dxwZ1CZiwLKsqr'
                    ? 'threeQuarters'
                    : 'full',
              },
            }
          : row,
      );
      input.catalogEntries[0]!.modifiers =
        input.catalogEntries[0]!.modifiers.map((row) =>
          row.target === 'ability.dex'
            ? { ...row, value: missing === 'dexterity' ? 12 : 13 }
            : row,
        );
      for (let index = 2; index <= levels; index++)
        input.entries = [
          ...input.entries,
          {
            _id: `level-${index}`,
            kind: 'classLevel',
            active: true,
            state: {
              kind: 'classLevel',
              position: index,
              classEntryId: 'fighter',
              hpGained: 5,
            },
          },
        ];
      const current = calculateCharacterSheet(input).prerequisites.filter(
        (row) => row.view === 'current' && row.entryId === 'wrangler',
      );
      expect(current.map((row) => row.met)).toEqual([
        missing !== 'dexterity',
        ...requiredFeats.map((identity) => identity !== missing),
        branchMet,
      ]);
    }
  }
});

test('Elemental Strike offers each of its four races and fails when none is present', async () => {
  const races = [
    'pf1/packs/races/ifrit.TPHe88Yhy4SsDpKo.yaml',
    'pf1/packs/races/oread.4qEXPDlfIj1cIvCe.yaml',
    'pf1/packs/races/sylph.pbX1xj9Z0ZhUfKvZ.yaml',
    'pf1/packs/races/undine.iqJvhd7NbmybUl0y.yaml',
  ];
  const mapped = await mapPinned(
    'pf1-content/src/pf-feats/Elemental_Strike_hKUr4z34XChiYgY1.yaml',
    races,
  );
  expect(mapped.prerequisites).toEqual([
    {
      anyOf: [
        { kind: 'race', race: ['pf1/TPHe88Yhy4SsDpKo'] },
        { kind: 'race', race: ['pf1/4qEXPDlfIj1cIvCe'] },
        { kind: 'race', race: ['pf1/pbX1xj9Z0ZhUfKvZ'] },
        { kind: 'race', race: ['pf1/iqJvhd7NbmybUl0y'] },
      ],
    },
  ]);
  for (const race of [
    'pf1/TPHe88Yhy4SsDpKo',
    'pf1/4qEXPDlfIj1cIvCe',
    'pf1/pbX1xj9Z0ZhUfKvZ',
    'pf1/iqJvhd7NbmybUl0y',
    'other',
  ]) {
    const input = prerequisiteSheet(
      [
        selectedFeat('strike'),
        {
          _id: 'race-row',
          kind: 'race',
          active: true,
          catalogEntryId: 'race',
          state: { kind: 'race' },
        },
      ],
      [
        {
          _id: 'strike',
          ruleIdentity: mapped.externalKey,
          modifiers: [],
          detail: { kind: 'feat' },
          prerequisites: mapped.prerequisites,
        },
        {
          _id: 'race',
          ruleIdentity: race,
          modifiers: [],
          detail: { kind: 'race', racialTraits: [] },
        },
      ],
    );
    expect(
      calculateCharacterSheet(input)
        .prerequisites.filter((row) => row.view === 'current')
        .map((row) => row.met),
    ).toEqual([race !== 'other']);
  }
});

test('Expert Explorer shares five ranks only between its named skills', async () => {
  const mapped = await mapPinned(
    'pf1-content/src/pf-feats/Expert_Explorer_fUoPMjOAcW9esoOI.yaml',
    [],
  );
  expect(mapped.prerequisites).toEqual([
    {
      anyOf: [
        { kind: 'skillRanks', skillRanks: 'skill.kna', min: 5 },
        { kind: 'skillRanks', skillRanks: 'skill.sur', min: 5 },
      ],
    },
  ]);
  for (const [skill, ranks, met] of [
    ['kna', 5, true],
    ['sur', 5, true],
    ['kna', 4, false],
    ['clm', 5, false],
  ] as const) {
    const input = prerequisiteSheet(
      [{ ...selectedFeat('explorer'), gainedAtClassLevel: 'level-5' }],
      [
        {
          _id: 'explorer',
          ruleIdentity: mapped.externalKey,
          modifiers: [],
          detail: { kind: 'feat' },
          prerequisites: mapped.prerequisites,
        },
      ],
    );
    input.entries = input.entries.map((row) =>
      row.kind === 'classLevel'
        ? { ...row, state: { ...row.state, skillRanks: { [skill]: 1 } } }
        : row,
    );
    for (let position = 2; position <= 5; position++)
      input.entries = [
        ...input.entries,
        {
          _id: `level-${position}`,
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            position,
            classEntryId: 'fighter',
            hpGained: 5,
            skillRanks: { [skill]: position <= ranks ? 1 : 0 },
          },
        },
      ];
    expect(
      calculateCharacterSheet(input)
        .prerequisites.filter((row) => row.view === 'current')
        .map((row) => row.met),
    ).toEqual([met]);
  }
});

test('Expanded Studies shares level sixteen between classes and keeps Wisdom separately required', async () => {
  const mapped = await mapPinned(
    'pf1-content/src/pf-feats/Expanded_Studies_niFbxfv2vdPfDZrY.yaml',
    [
      'pf1/packs/classes/hunter.Immo2BuSe5WGdRW9.yaml',
      'pf1/packs/classes/warpriest.KgxFsHNv0g1GbvmS.yaml',
    ],
  );
  expect(mapped.prerequisites).toEqual([
    { kind: 'ability', ability: 'wisdom', min: 17 },
    {
      anyOf: [
        { kind: 'classLevel', classLevel: 'pf1/Immo2BuSe5WGdRW9', min: 16 },
        { kind: 'classLevel', classLevel: 'pf1/KgxFsHNv0g1GbvmS', min: 16 },
      ],
    },
  ]);
  for (const [identity, levels, met] of [
    ['pf1/Immo2BuSe5WGdRW9', 16, true],
    ['pf1/KgxFsHNv0g1GbvmS', 16, true],
    ['pf1/Immo2BuSe5WGdRW9', 15, false],
    ['class/fighter', 16, false],
  ] as const) {
    const input = prerequisiteSheet(
      [selectedFeat('studies')],
      [
        {
          _id: 'studies',
          ruleIdentity: mapped.externalKey,
          modifiers: [],
          detail: { kind: 'feat' },
          prerequisites: mapped.prerequisites,
        },
      ],
    );
    input.catalogEntries = input.catalogEntries.map((row) =>
      row._id === 'fighter' ? { ...row, ruleIdentity: identity } : row,
    );
    input.catalogEntries[0]!.modifiers = input.catalogEntries[0]!.modifiers.map(
      (row) => (row.target === 'ability.wis' ? { ...row, value: 17 } : row),
    );
    for (let position = 2; position <= levels; position++)
      input.entries = [
        ...input.entries,
        {
          _id: `level-${position}`,
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            position,
            classEntryId: 'fighter',
            hpGained: 5,
          },
        },
      ];
    expect(
      calculateCharacterSheet(input)
        .prerequisites.filter((row) => row.view === 'current')
        .map((row) => row.met),
    ).toEqual([true, met]);
    input.catalogEntries[0]!.modifiers = input.catalogEntries[0]!.modifiers.map(
      (row) => (row.target === 'ability.wis' ? { ...row, value: 16 } : row),
    );
    expect(
      calculateCharacterSheet(input)
        .prerequisites.filter((row) => row.view === 'current')
        .map((row) => row.met),
    ).toEqual([false, met]);
  }
});

test('native race-trait tags make the Tusked race labels alternatives without weakening ordinary feat conjunctions', async () => {
  const mapped = await mapPinned(
    'pf1-content/src/pf-traits/Tusked__Half_Orc__Orc__2Ae8iSvWHKjqVgNy.yaml',
    [
      'pf1/packs/races/half-orc.dCAXgdA6Db1Z3ccz.yaml',
      'pf1/packs/races/orc.JOuAdPAOTat7d5v6.yaml',
      'pf1-content/src/pf-racial-traits/Orc_l7CqdrmNxsmEsBBG.yaml',
    ],
  );
  expect(mapped.prerequisites).toEqual([
    {
      anyOf: [
        { kind: 'race', race: ['pf1/dCAXgdA6Db1Z3ccz'] },
        { kind: 'race', race: ['pf1/JOuAdPAOTat7d5v6'] },
      ],
    },
  ]);
  for (const identity of [
    'pf1/dCAXgdA6Db1Z3ccz',
    'pf1/JOuAdPAOTat7d5v6',
    'pf1/e6IaBxKgMxy1yKlr',
  ]) {
    const input = prerequisiteSheet(
      [
        {
          _id: 'tusked',
          catalogEntryId: 'tusked',
          kind: 'trait',
          active: true,
          state: { kind: 'trait' },
        },
        {
          _id: 'race-row',
          catalogEntryId: 'race',
          kind: 'race',
          active: true,
          state: { kind: 'race' },
        },
      ],
      [
        {
          _id: 'tusked',
          ruleIdentity: mapped.externalKey,
          modifiers: [],
          detail: { kind: 'trait', traitType: 'race' },
          prerequisites: mapped.prerequisites,
        },
        {
          _id: 'race',
          ruleIdentity: identity,
          modifiers: [],
          detail: { kind: 'race', racialTraits: [] },
        },
      ],
    );
    expect(
      calculateCharacterSheet(input)
        .prerequisites.filter((row) => row.view === 'current')
        .map((row) => row.met),
    ).toEqual([identity !== 'pf1/e6IaBxKgMxy1yKlr']);
  }
});

test('Conceal Aura groups every alignment category and excludes true neutral', async () => {
  const mapped = await mapPinned(
    'pf1-content/src/pf-feats/Conceal_Aura_3clO9dR5TKOkg5SS.yaml',
    [],
  );
  expect(mapped.prerequisites).toEqual([
    {
      kind: 'alignment',
      alignment: ['CG', 'CN', 'CE', 'LE', 'NE', 'LG', 'NG', 'LN'],
    },
  ]);
  for (const alignment of [
    'LG',
    'NG',
    'CG',
    'LN',
    'N',
    'CN',
    'LE',
    'NE',
    'CE',
  ] as const) {
    const input = prerequisiteSheet(
      [selectedFeat('aura')],
      [
        {
          _id: 'aura',
          ruleIdentity: mapped.externalKey,
          modifiers: [],
          detail: { kind: 'feat' },
          prerequisites: mapped.prerequisites,
        },
      ],
    );
    input.entries = input.entries.map((row) =>
      row.kind === 'base'
        ? { ...row, state: { ...row.state, alignment } }
        : row,
    );
    expect(
      calculateCharacterSheet(input)
        .prerequisites.filter((row) => row.view === 'current')
        .map((row) => row.met),
    ).toEqual([alignment !== 'N']);
  }
});

test('Totemic Master keeps its totem exclusion intact beside the independently required feats', async () => {
  const mapped = await mapPinned(
    'pf1-content/src/pf-feats/Totemic_Master_20rB8UNFwhjTka52.yaml',
    [
      'pf1-content/src/pf-feats/Totemic_Disciple_23vl8taZ6srdVZQL.yaml',
      'pf1-content/src/pf-feats/Totemic_Initiate_smJnIdniC0at6osM.yaml',
    ],
  );
  expect(mapped.prerequisites).toContainEqual({
    kind: 'unchecked',
    unchecked:
      'no barbarian totem rage powers except those chosen with this feat, Totemic Disciple, or Totemic Initiate',
  });
  expect(mapped.prerequisites?.some((atom) => 'anyOf' in atom)).toBe(false);
});
