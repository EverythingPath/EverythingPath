// @vitest-environment node
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  gearOutputs,
  gearValueClass,
  reviewedBuckler,
  type ReviewedGear,
} from '../../scripts/catalog/launch-gear';
import { parseLaunchInventory } from '../../scripts/catalog/launch-inventory-document';
import type { LaunchRow } from '../../scripts/catalog/launch-inventory-schema';
import {
  launchMechanismProofSchema,
  launchMechanismProofs,
  proofNamesMechanism,
} from '../../scripts/catalog/launch-mechanism-proofs';
import {
  currentMechanismProofs,
  repositoryFileSha256,
  verifyLaunchRows,
  type LaunchGate,
  type LaunchVerificationInput,
} from '../../scripts/catalog/launch-verification';
import { currentCalculationIdentity } from '../../src/lib/catalog/calculation-identities';
import { realEntries, type RealEntry } from './launch-modifier-evidence';
import { pinnedStore } from './pinned-sources';
import { bodies as armorProofBodies } from '../gear-proof-armor';
import { bodies as wornItemProofBodies } from '../gear-proof-worn-items';

// Content verification, gear S1 (#782): the gear family. The inventory names
// `Gear and Item Abilities` for every item and Item Ability row
// (`launch-inventory-build.ts`); the family proves it only for a reviewed,
// admitted item whose only mechanism it is, whose source bytes and scoped
// entry's mechanical outputs equal the reviewed ones, and whose every output
// is of a shape the public saved-sheet proof
// (`convex/characterSheetGear.integration.test.ts`) covers: a worn armor or a
// shield without a bash in a proven category, local Situational attack
// penalties, and notes on attack and AC or on the entry. The rows, entries and
// records here are synthetic; the committed control below reads the real
// ones.
const proofTest = 'convex/characterSheetGear.integration.test.ts';
/** Gear S2's public proof of worn items' Modifiers and the tower shield. */
const modifiersTest = 'convex/characterSheetGearModifiers.integration.test.ts';
const name = 'Gear and Item Abilities';
const repository = (path: string) => repositoryFileSha256('.', path);
const family = launchMechanismProofs.find((proof) => proof.family === 'gear');

/** The fixed root keys of #782 the list holds (root decision R1). */
const listedRows = [['pf1/iGu21zy6QtroUZ4O', 'Chain Shirt']] as const;

const gear = (): LaunchRow['mechanisms'][number] => ({
  name,
  disposition: 'calculated',
  status: 'outstanding',
  contract:
    'Preserve Base Item/ammunition, proficiency, damage/ends, armor, enhancement, targets, Item Abilities, Situations and stacking where the source supplies them.',
  evidence: ['row.sources'],
});
const source = 'e'.repeat(64);
type Row = Parameters<typeof verifyLaunchRows>[0]['rows'][number];
function itemRow(key: string, change: Partial<Row> = {}) {
  return {
    key,
    kind: 'item',
    catalogKey: key,
    requirement: 'required' as const,
    holds: [],
    mechanisms: [gear()],
    sources: [
      {
        repository: 'pf1' as const,
        pin: 'baseline',
        locator: `src/${key}.yaml`,
        rawSha256: source,
        effectiveSha256: source,
      },
    ],
    noticeEvidence: { state: 'unreviewed' as const, evidence: ['row.sources'] },
    ...change,
  } satisfies Row;
}
/** A scoped item entry with its outputs (detail fields beside the text ones). */
function itemEntry(
  key: string,
  outputs: Record<string, unknown>,
  change: Record<string, unknown> = {},
) {
  const { detail, ...fields } = outputs;
  return {
    externalKey: key,
    upstreamKey: key.split('/')[1],
    pack: 'armors-and-shields',
    name: key,
    detail: { kind: 'item', price: 10, weight: 15, ...asObject(detail) },
    description: '',
    sources: [{ book: 'PZO1110', pages: '150' }],
    modifiers: [],
    unsupported: [],
    ...fields,
    ...change,
  };
}

const asObject = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? { ...value } : {};
const isFamily = (proof: unknown) => asObject(proof).family === 'gear';

// Synthetic rows: a worn light armor (Chain Shirt's shape), a shield with
// two local attack penalties and two targeted notes (Buckler's), and a
// control identical to the first but not reviewed.
const keys = {
  shirt: 'pf1/proofShirt',
  shield: 'pf1/proofShield',
  control: 'pf1/proofControl',
};
const shirtArmor = {
  slot: 'armor',
  category: 'lightArmor',
  bonus: 4,
  maxDex: 4,
  armorCheckPenalty: 2,
  asf: 20,
};
const shirtOutputs = { detail: { consumable: false, armor: shirtArmor } };
const meleePenalty = {
  target: 'attack.melee',
  bonusType: 'untyped',
  value: -1,
  condition: { situation: { local: 'while the shield arm wields a weapon' } },
};
const shieldOutputs = {
  detail: {
    consumable: false,
    armor: {
      slot: 'shield',
      category: 'other',
      bonus: 1,
      maxDex: null,
      armorCheckPenalty: 1,
      asf: 5,
    },
  },
  modifiers: [
    meleePenalty,
    {
      ...meleePenalty,
      target: 'attack.ranged',
      condition: {
        situation: { local: 'while the shield arm wields a sling' },
      },
    },
  ],
  situationalNotes: [
    { target: 'attack', text: 'Bows are unaffected.' },
    { target: 'ac', text: 'Lose the AC bonus after an off-hand attack.' },
  ],
};
const synthetic = [
  { key: keys.shirt, outputs: shirtOutputs, shape: 'worn-armor' },
  { key: keys.shield, outputs: shieldOutputs, shape: 'shield' },
];

// Gear S2's synthetic rows: a worn item with no armor block (a belt-shaped
// item with two ability enhancements, a zero-replaced Craft change whose +2
// a local Situation carries, and notes) and a tower shield with its −2 on
// attack, each with its `Modifier …` mechanisms.
const s2Keys = { belt: 'pf1/proofBelt', tower: 'pf1/proofTower' };
const beltMechanisms = [
  'Modifier str 4',
  'Modifier dex 4',
  'Modifier skill.crf 2',
];
const beltOutputs = {
  detail: { consumable: false },
  modifiers: [
    { target: 'ability.str', bonusType: 'enhancement', value: 4 },
    { target: 'ability.dex', bonusType: 'enhancement', value: 4 },
    { target: 'skill.crf', bonusType: 'circumstance', value: 0 },
    {
      target: 'skill.crf',
      bonusType: 'circumstance',
      value: 2,
      condition: { situation: { local: 'on Craft checks made with it' } },
    },
  ],
  situationalNotes: [
    { text: 'Treat this as a temporary ability bonus.' },
    { target: 'ability.str', text: 'Chosen when the belt is created.' },
  ],
};
const towerMechanisms = ['Modifier attack -2'];
const towerOutputs = {
  detail: {
    consumable: false,
    armor: {
      slot: 'shield',
      category: 'towerShield',
      bonus: 4,
      maxDex: 2,
      armorCheckPenalty: 10,
      asf: 50,
    },
  },
  modifiers: [{ target: 'attack', bonusType: 'untyped', value: -2 }],
  situationalNotes: [
    { target: 'ac', text: 'Total cover as a standard action.' },
  ],
};
const s2Synthetic = [
  {
    key: s2Keys.belt,
    outputs: beltOutputs,
    shape: 'worn-item',
    modifierMechanisms: beltMechanisms,
  },
  {
    key: s2Keys.tower,
    outputs: towerOutputs,
    shape: 'shield',
    modifierMechanisms: towerMechanisms,
  },
];
const reviewedRecord = (
  key: string,
  outputs: unknown,
  change: Record<string, unknown> = {},
) => ({
  key,
  name: key,
  sourceSha256: source,
  outputs,
  basis: 'Synthetic.',
  shape: 'worn-armor',
  ...change,
});
const syntheticReviewed = synthetic.map(({ key, outputs, shape }) =>
  reviewedRecord(key, outputs, { shape }),
);
const s2Reviewed = s2Synthetic.map(({ key, outputs, ...change }) =>
  reviewedRecord(key, outputs, change),
);

/** The registry with the family's reviewed list (and scope) replaced. */
function withReviewed(
  reviewed: unknown[],
  scope: Record<string, unknown> = {},
): unknown[] {
  if (!family || !('gear' in family))
    throw new Error('Missing the gear family');
  return launchMechanismProofs.map((proof) =>
    proof === family
      ? { ...family, gear: { ...family.gear, reviewed, ...scope } }
      : proof,
  );
}

const admittedGate = (keysAdmitted: readonly string[]): LaunchGate => ({
  admitted: keysAdmitted.map((externalKey) => ({
    externalKey,
    reason: 'Admitted.',
  })),
  held: [],
  dependentOmissions: [],
  retainedExceptions: [],
  failures: [],
});
function projectionInput(
  change: Partial<LaunchVerificationInput> = {},
): LaunchVerificationInput {
  return {
    admission: admittedGate(Object.values(keys)),
    scopeBuild: { entries: [], remaps: new Map(), resources: new Map() },
    unsupported: { entries: [] },
    proofs: { registry: withReviewed(syntheticReviewed), sha256Of: repository },
    proseCases: [],
    calculationIdentity: currentCalculationIdentity,
    stale: [],
    ...change,
  };
}
const baseRows = () => Object.values(keys).map((key) => itemRow(key));
const baseEntries = () => [
  ...synthetic.map(({ key, outputs }) => itemEntry(key, outputs)),
  itemEntry(keys.control, shirtOutputs),
];
/** Each row's proven mechanisms, keyed by row. */
function proven({
  rows = baseRows(),
  entries = baseEntries(),
  ...change
}: Partial<LaunchVerificationInput> & {
  rows?: Row[];
  entries?: unknown[];
} = {}) {
  return Object.fromEntries(
    verifyLaunchRows(
      { rows, edges: [] },
      projectionInput({
        scopeBuild: { entries, remaps: new Map(), resources: new Map() },
        ...change,
      }),
    ).map(({ key, mechanisms }) => [key, mechanisms]),
  );
}

describe('the gear family', () => {
  it('names its public saved-sheet proof with its current bytes, the current calculation identity, its scope and its reviewed rows', () => {
    // The registry's whole family list is pinned once, in
    // `launch-mechanism-registry.test.ts`.
    expect(
      launchMechanismProofs.filter((proof) => proof.family === 'gear'),
    ).toEqual([family]);
    expect(family).toMatchObject({
      mechanism: name,
      kinds: ['item'],
      tests: [
        { path: proofTest },
        { path: modifiersTest },
        { path: 'tests/gear-proof-armor.ts' },
        { path: 'tests/gear-proof-worn-items.ts' },
      ],
      calculationIdentity: currentCalculationIdentity,
      disqualifying: ['*'],
      gear: {
        shapes: [
          {
            shape: 'worn-armor',
            categories: ['lightArmor', 'mediumArmor', 'heavyArmor'],
          },
          { shape: 'shield', categories: ['other', 'towerShield'] },
          { shape: 'worn-item' },
        ],
        // Each target, bonus type and value class a public case proves
        // (the coverage tie below checks it against the public fixtures):
        // S1's shield penalties, and S2's worn-item Modifiers, the zeroed
        // Craft, Perform and Stealth changes and the tower shield's −2.
        modifiers: [
          {
            target: 'ac',
            bonusTypes: ['deflection', 'insight'],
            values: ['positive'],
          },
          {
            target: 'ac.natural',
            bonusTypes: ['enhancement'],
            values: ['positive'],
          },
          ...['str', 'dex', 'con', 'int', 'wis', 'cha'].map((ability) => ({
            target: `ability.${ability}`,
            bonusTypes: ['enhancement'],
            values: ['positive'],
          })),
          {
            target: 'skill.clm',
            bonusTypes: ['competence'],
            values: ['positive'],
          },
          {
            target: 'skill.crf',
            bonusTypes: ['circumstance'],
            values: ['zero'],
          },
          {
            target: 'skill.prf',
            bonusTypes: ['circumstance'],
            values: ['zero'],
          },
          { target: 'skill.ste', bonusTypes: ['competence'], values: ['zero'] },
          { target: 'attack', bonusTypes: ['untyped'], values: ['negative'] },
          // Gear S3: a cloak's resistance bonus, the stand-in for its
          // unmapped raw change.
          {
            target: 'saves',
            bonusTypes: ['resistance'],
            values: ['positive'],
          },
        ],
        situationalModifiers: [
          {
            target: 'attack.melee',
            bonusTypes: ['untyped'],
            values: ['negative'],
          },
          {
            target: 'attack.ranged',
            bonusTypes: ['untyped'],
            values: ['negative'],
          },
          { target: 'cmb', bonusTypes: ['insight'], values: ['positive'] },
          {
            target: 'skill.crf',
            bonusTypes: ['circumstance'],
            values: ['positive'],
          },
          {
            target: 'skill.prf',
            bonusTypes: ['circumstance'],
            values: ['positive'],
          },
          {
            target: 'skill.ste',
            bonusTypes: ['competence'],
            values: ['positive'],
          },
        ],
        // Gear S3: an amulet's enhancement bonus with unarmed strikes and
        // natural weapons, the stand-in for its unmapped raw changes.
        weaponModifiers: [
          {
            weapon: '$unarmedOrNatural',
            target: 'attack',
            bonusTypes: ['enhancement'],
            values: ['positive'],
          },
          {
            weapon: '$unarmedOrNatural',
            target: 'damage',
            bonusTypes: ['enhancement'],
            values: ['positive'],
          },
        ],
        noteTargets: [
          'attack',
          'ac',
          'ability.str',
          'ability.dex',
          'ability.con',
          'ability.int',
          'ability.wis',
          'ability.cha',
          'skill.prf',
        ],
      },
    });
    const reviewed = family && 'gear' in family ? family.gear.reviewed : [];
    expect(reviewed.map(({ key, name: rowName }) => [key, rowName])).toEqual(
      listedRows,
    );
    // Buckler waits for the owner's answer to O3, reviewed but not listed.
    expect(reviewed.map(({ key }) => key)).not.toContain(reviewedBuckler.key);
    expect(
      launchMechanismProofSchema.safeParse(
        withReviewed([...reviewed, reviewedBuckler]).find(isFamily),
      ).success,
    ).toBe(true);
    expect(
      currentMechanismProofs({
        registry: launchMechanismProofs,
        sha256Of: repository,
      }),
    ).toContainEqual(family);
    // The entry with any test or fixture file's bytes changed proves nothing.
    for (const test of [
      proofTest,
      modifiersTest,
      'tests/gear-proof-armor.ts',
      'tests/gear-proof-worn-items.ts',
    ])
      expect(
        currentMechanismProofs({
          registry: launchMechanismProofs,
          sha256Of: (path) =>
            path === test ? 'e'.repeat(64) : repository(path),
        }),
        test,
      ).not.toContainEqual(family);
  });

  it('proves a reviewed admitted item whose mechanical outputs equal its reviewed outputs', () => {
    expect(proven()).toEqual({
      [keys.shirt]: [name],
      [keys.shield]: [name],
      [keys.control]: [],
    });
  });

  it('projects an item entry to its armor block, consumable flag, Modifiers and notes, and refuses any other mechanical field', () => {
    expect(gearOutputs(itemEntry(keys.shirt, shirtOutputs))).toEqual(
      shirtOutputs,
    );
    expect(gearOutputs(itemEntry(keys.shield, shieldOutputs))).toEqual(
      shieldOutputs,
    );
    // Empty lists and absent notes hold nothing; price and weight are no
    // sheet number.
    expect(
      gearOutputs(
        itemEntry(keys.shirt, shirtOutputs, {
          modifiers: [],
          situationalNotes: [],
          guidanceText: 'Worn.',
        }),
      ),
    ).toEqual(shirtOutputs);
    const detailOf = (change: Record<string, unknown>) =>
      itemEntry(keys.shirt, {
        detail: { ...shirtOutputs.detail, ...change },
      });
    for (const [label, entry] of [
      ['a weapon', detailOf({ weapon: { baseType: 'Shield bash' } })],
      ['magic', detailOf({ magic: { enhancement: 1, masterwork: true } })],
      ['a Base Item', detailOf({ baseItemKey: 'pf1/proofBase' })],
      ['ammunition', detailOf({ ammunition: true })],
      ['an unknown detail field', detailOf({ hardness: 10 })],
      [
        'proficiencies',
        itemEntry(keys.shirt, shirtOutputs, {
          proficiencies: [{ category: 'light' }],
        }),
      ],
      [
        'a source key',
        itemEntry(keys.shirt, shirtOutputs, { sourceKey: 'pf1/x' }),
      ],
      [
        'prerequisites',
        itemEntry(keys.shirt, shirtOutputs, {
          prerequisites: [{ bab: 1, kind: 'bab' }],
        }),
      ],
      [
        'a feat slot',
        itemEntry(keys.shirt, shirtOutputs, {
          grantsSlots: [{ kind: 'feat', count: 1 }],
        }),
      ],
      [
        'an unknown entry field',
        itemEntry(keys.shirt, shirtOutputs, { grantsBuffs: ['pf1/x'] }),
      ],
      [
        'a feat detail',
        { ...itemEntry(keys.shirt, {}), detail: { kind: 'feat' } },
      ],
      ['no detail', { ...itemEntry(keys.shirt, {}), detail: undefined }],
    ] as const)
      expect(gearOutputs(entry), label).toBeUndefined();
  });

  it('refuses a reviewed armor or shield record with no armor block, or with an output of an unproven kind or shape', () => {
    const parses = (outputs: unknown, change: Record<string, unknown> = {}) =>
      launchMechanismProofSchema.safeParse(
        withReviewed([reviewedRecord(keys.shirt, outputs, change)]).find(
          isFamily,
        ),
      ).success;
    expect(parses(shirtOutputs)).toBe(true);
    expect(parses(shieldOutputs, { shape: 'shield' })).toBe(true);
    const detail = (change: Record<string, unknown>) => ({
      detail: { ...shirtOutputs.detail, ...change },
    });
    const withModifier = (change: Record<string, unknown>) => ({
      ...shieldOutputs,
      modifiers: [{ ...meleePenalty, ...change }],
    });
    for (const [label, outputs, change] of [
      ['no outputs', {}],
      ['no armor block', { detail: { consumable: false } }],
      ['a consumable', detail({ consumable: true })],
      ['a weapon', detail({ weapon: { baseType: 'Shield bash' } })],
      ['magic', detail({ magic: { enhancement: 1, masterwork: false } })],
      ['a Base Item', detail({ baseItemKey: 'pf1/proofBase' })],
      ['ammunition', detail({ ammunition: true })],
      ['price', detail({ price: 100 })],
      ['an armor field more', detail({ armor: { ...shirtArmor, speed: 20 } })],
      [
        'an armor field less',
        detail({ armor: { ...shirtArmor, asf: undefined } }),
      ],
      ['an empty category', detail({ armor: { ...shirtArmor, category: '' } })],
      ['an empty Modifier list', { ...shirtOutputs, modifiers: [] }],
      ['an empty note list', { ...shirtOutputs, situationalNotes: [] }],
      [
        'a shared Situation',
        withModifier({ condition: { situation: 'within30ft' } }),
      ],
      [
        'a weapon condition',
        withModifier({
          condition: { situation: { local: 'x' }, weapon: '$self' },
        }),
      ],
      ['a formula', withModifier({ value: { formula: '@cl' } })],
      [
        'a Modifier stacking within its entry',
        withModifier({ stacksWithinEntry: true }),
      ],
      [
        'a note in a Situation',
        {
          ...shirtOutputs,
          situationalNotes: [{ text: 'x', situation: 'fear' }],
        },
      ],
      [
        'proficiencies',
        { ...shirtOutputs, proficiencies: [{ category: 'light' }] },
      ],
      ['another shape', shirtOutputs, { shape: 'shield-bash' }],
      ['no basis', shirtOutputs, { basis: '' }],
    ] as const)
      expect(parses(outputs, change), label).toBe(false);
  });

  it('keeps the mechanism outstanding for any row, entry, review, gate or evidence that differs from the reviewed proof', () => {
    const shieldRow = (change: Partial<Row> = {}) =>
      itemRow(keys.shield, change);
    const shieldEntry = (
      outputs: Record<string, unknown> = shieldOutputs,
      change: Record<string, unknown> = {},
    ) => itemEntry(keys.shield, outputs, change);
    const reviewedShield = (outputs: unknown, change = {}) =>
      syntheticReviewed.map((record) =>
        record.key === keys.shield
          ? reviewedRecord(keys.shield, outputs, { shape: 'shield', ...change })
          : record,
      );
    /** The shield's proven mechanisms after one change. */
    function shieldProven({
      row,
      entry,
      registry,
      ...change
    }: Partial<LaunchVerificationInput> & {
      row?: Row;
      entry?: unknown;
      registry?: unknown[];
    }) {
      return (
        proven({
          rows: baseRows().map((other) =>
            other.key === keys.shield ? (row ?? other) : other,
          ),
          entries: baseEntries().flatMap((other) =>
            other.externalKey !== keys.shield
              ? [other]
              : entry === undefined
                ? [other]
                : entry === null
                  ? []
                  : [entry],
          ),
          ...(registry ? { proofs: { registry, sha256Of: repository } } : {}),
          ...change,
        })[keys.shield] ?? []
      );
    }
    const armor = shieldOutputs.detail.armor;
    const changedArmor = (change: Record<string, unknown>) =>
      shieldEntry({
        ...shieldOutputs,
        detail: { consumable: false, armor: { ...armor, ...change } },
      });
    const changedModifier = (change: Record<string, unknown>) =>
      shieldEntry({
        ...shieldOutputs,
        modifiers: [{ ...meleePenalty, ...change }, shieldOutputs.modifiers[1]],
      });
    const changedNote = (change: Record<string, unknown>) =>
      shieldEntry({
        ...shieldOutputs,
        situationalNotes: [
          { ...shieldOutputs.situationalNotes[0], ...change },
          shieldOutputs.situationalNotes[1],
        ],
      });
    /** Outputs the entry and the review share, so only the scope refuses. */
    const shared = (
      outputs: Record<string, unknown>,
      change: Record<string, unknown> = {},
    ) => ({
      entry: shieldEntry(outputs),
      registry: withReviewed(reviewedShield(outputs, change)),
    });
    const sharedArmor = (change: Record<string, unknown>) =>
      shared({
        ...shieldOutputs,
        detail: { consumable: false, armor: { ...armor, ...change } },
      });
    const detailed = (change: Record<string, unknown>) =>
      shieldEntry({
        ...shieldOutputs,
        detail: { ...shieldOutputs.detail, ...change },
      });
    const cases: [string, Parameters<typeof shieldProven>[0]][] = [
      // The list and the source bytes.
      [
        'off the reviewed list',
        {
          registry: withReviewed(
            syntheticReviewed.filter(({ key }) => key !== keys.shield),
          ),
        },
      ],
      [
        'a reviewed source hash the row does not bind',
        {
          registry: withReviewed(
            reviewedShield(shieldOutputs, { sourceSha256: 'f'.repeat(64) }),
          ),
        },
      ],
      [
        'changed source bytes',
        {
          row: shieldRow({
            sources: [
              {
                repository: 'pf1',
                pin: 'baseline',
                locator: 'src/proofShield.yaml',
                rawSha256: 'f'.repeat(64),
                effectiveSha256: 'f'.repeat(64),
              },
            ],
          }),
        },
      ],
      // The armor block against the reviewed one.
      ['another bonus', { entry: changedArmor({ bonus: 2 }) }],
      ['a max Dex cap', { entry: changedArmor({ maxDex: 4 }) }],
      [
        'another armor check penalty',
        { entry: changedArmor({ armorCheckPenalty: 2 }) },
      ],
      ['another spell failure', { entry: changedArmor({ asf: 15 }) }],
      [
        'another category',
        { entry: changedArmor({ category: 'lightShield' }) },
      ],
      ['another slot', { entry: changedArmor({ slot: 'armor' }) }],
      [
        'no armor block',
        {
          entry: shieldEntry({
            ...shieldOutputs,
            detail: { consumable: false },
          }),
        },
      ],
      ['a consumable', { entry: detailed({ consumable: true }) }],
      // The Modifiers and notes against the reviewed ones.
      [
        'a dropped Modifier',
        {
          entry: shieldEntry({
            ...shieldOutputs,
            modifiers: [shieldOutputs.modifiers[1]],
          }),
        },
      ],
      [
        'an extra Modifier',
        {
          entry: shieldEntry({
            ...shieldOutputs,
            modifiers: [...shieldOutputs.modifiers, meleePenalty],
          }),
        },
      ],
      ['another value', { entry: changedModifier({ value: -2 }) }],
      [
        'another bonus type',
        { entry: changedModifier({ bonusType: 'shield' }) },
      ],
      ['another target', { entry: changedModifier({ target: 'attack' }) }],
      [
        'another Situation text',
        {
          entry: changedModifier({
            condition: { situation: { local: 'while bashing' } },
          }),
        },
      ],
      [
        'a shared Situation',
        { entry: changedModifier({ condition: { situation: 'within30ft' } }) },
      ],
      ['no Situation', { entry: changedModifier({ condition: undefined }) }],
      [
        'a Modifier marked to stack within its entry',
        { entry: changedModifier({ stacksWithinEntry: true }) },
      ],
      [
        'a dropped note',
        {
          entry: shieldEntry({
            ...shieldOutputs,
            situationalNotes: [shieldOutputs.situationalNotes[1]],
          }),
        },
      ],
      [
        'an extra note',
        {
          entry: shieldEntry({
            ...shieldOutputs,
            situationalNotes: [
              ...shieldOutputs.situationalNotes,
              { text: 'More.' },
            ],
          }),
        },
      ],
      ['another note text', { entry: changedNote({ text: 'Bows suffer.' }) }],
      ['another note target', { entry: changedNote({ target: 'ac' }) }],
      ['an untargeted note', { entry: changedNote({ target: undefined }) }],
      // Fields that are no proven shape, on the entry and its detail.
      [
        'a bash weapon',
        { entry: detailed({ weapon: { baseType: 'Shield bash' } }) },
      ],
      [
        'magic',
        { entry: detailed({ magic: { enhancement: 1, masterwork: true } }) },
      ],
      ['a Base Item', { entry: detailed({ baseItemKey: 'pf1/proofBase' }) }],
      ['ammunition', { entry: detailed({ ammunition: true }) }],
      [
        'a detail field the projection does not know',
        { entry: detailed({ hardness: 10 }) },
      ],
      [
        'added proficiencies',
        {
          entry: shieldEntry(shieldOutputs, {
            proficiencies: [{ category: 'shield' }],
          }),
        },
      ],
      [
        'a source key',
        { entry: shieldEntry(shieldOutputs, { sourceKey: 'pf1/x' }) },
      ],
      [
        'an entry field the projection does not know',
        { entry: shieldEntry(shieldOutputs, { grantsBuffs: ['pf1/x'] }) },
      ],
      [
        'a reviewed output the entry lacks',
        {
          registry: withReviewed(
            reviewedShield({
              ...shieldOutputs,
              situationalNotes: [
                ...shieldOutputs.situationalNotes,
                { text: 'More.' },
              ],
            }),
          ),
        },
      ],
      // Outputs both share that the scope does not cover.
      ...['lightShield', 'heavyShield', 'buckler', 'lightArmor'].map(
        (category): [string, Parameters<typeof shieldProven>[0]] => [
          `a shield of category ${category}`,
          sharedArmor({ category }),
        ],
      ),
      [
        'a shield block reviewed as worn armor',
        shared(shieldOutputs, { shape: 'worn-armor' }),
      ],
      ...['ac', 'attack', 'damage.melee', 'skill.per'].map(
        (target): [string, Parameters<typeof shieldProven>[0]] => [
          `a ${target} Modifier`,
          shared({
            ...shieldOutputs,
            modifiers: [{ ...meleePenalty, target }],
          }),
        ],
      ),
      ...['shield', 'circumstance', 'enhancement'].map(
        (bonusType): [string, Parameters<typeof shieldProven>[0]] => [
          `a ${bonusType} bonus`,
          shared({
            ...shieldOutputs,
            modifiers: [{ ...meleePenalty, bonusType }],
          }),
        ],
      ),
      [
        'a note targeting skill.per',
        shared({
          ...shieldOutputs,
          situationalNotes: [{ text: 'x', target: 'skill.per' }],
        }),
      ],
      [
        'a shape the scope leaves out',
        {
          registry: withReviewed(syntheticReviewed, {
            shapes: [{ shape: 'worn-armor', categories: ['lightArmor'] }],
          }),
        },
      ],
      [
        'a target the scope leaves out',
        {
          registry: withReviewed(syntheticReviewed, {
            situationalModifiers: [
              {
                target: 'attack.ranged',
                bonusTypes: ['untyped'],
                values: ['negative'],
              },
            ],
          }),
        },
      ],
      [
        'a bonus type the scope leaves out',
        {
          registry: withReviewed(syntheticReviewed, {
            situationalModifiers: [
              {
                target: 'attack.melee',
                bonusTypes: ['shield'],
                values: ['negative'],
              },
              {
                target: 'attack.ranged',
                bonusTypes: ['shield'],
                values: ['negative'],
              },
            ],
          }),
        },
      ],
      [
        'a note target the scope leaves out',
        {
          registry: withReviewed(syntheticReviewed, {
            noteTargets: ['attack'],
          }),
        },
      ],
      // The row's mechanisms.
      [
        'a second mechanism (Tower Shield’s)',
        {
          row: shieldRow({
            mechanisms: [gear(), { ...gear(), name: 'Modifier attack -2' }],
          }),
        },
      ],
      [
        'two Gear and Item Abilities',
        { row: shieldRow({ mechanisms: [gear(), gear()] }) },
      ],
      // Issues: the family names every field.
      ...[
        'gameContent',
        'curation.mechanics',
        'changes',
        'armor',
        'weapon',
      ].map((field): [string, Parameters<typeof shieldProven>[0]] => [
        `a ${field} issue`,
        {
          unsupported: {
            entries: [{ externalKey: keys.shield, issues: [{ field }] }],
          },
        },
      ]),
      // The gate and the evidence.
      [
        'an unadmitted row',
        {
          admission: admittedGate(
            Object.values(keys).filter((key) => key !== keys.shield),
          ),
        },
      ],
      [
        'changed test bytes',
        {
          proofs: {
            registry: withReviewed(syntheticReviewed),
            sha256Of: (path) =>
              path === proofTest ? 'e'.repeat(64) : repository(path),
          },
        },
      ],
      [
        'another calculation identity',
        { calculationIdentity: `sha256:${'f'.repeat(64)}` },
      ],
      // The entry and row kinds.
      ['no scoped entry', { entry: null }],
      [
        'an entry of another kind',
        {
          entry: {
            ...shieldEntry(),
            detail: { kind: 'feat', featTypes: [], repeatable: 'no' },
          },
        },
      ],
      [
        'an Item Ability carrying the mechanism',
        {
          row: shieldRow({ kind: 'itemAbility' }),
        },
      ],
    ];
    expect(shieldProven({})).toEqual([name]);
    for (const [label, change] of cases)
      expect(shieldProven(change), label).toEqual([]);
    // Even a registry entry widened to Item Abilities proves only items.
    const widened = withReviewed(syntheticReviewed).map((proof) =>
      isFamily(proof)
        ? { ...asObject(proof), kinds: ['item', 'itemAbility'] }
        : proof,
    );
    expect(
      shieldProven({
        registry: widened,
        row: shieldRow({ kind: 'itemAbility' }),
      }),
    ).toEqual([]);
    // A scope proving no worn armor, or not its category, leaves the listed
    // shirt outstanding and still proves the shield.
    expect(
      proven({
        proofs: {
          registry: withReviewed(syntheticReviewed, {
            shapes: [
              {
                shape: 'worn-armor',
                categories: ['mediumArmor', 'heavyArmor'],
              },
              { shape: 'shield', categories: ['other'] },
            ],
          }),
          sha256Of: repository,
        },
      }),
    ).toEqual({ [keys.shirt]: [], [keys.shield]: [name], [keys.control]: [] });
    expect(
      proven({
        proofs: {
          registry: withReviewed(syntheticReviewed, {
            shapes: [{ shape: 'shield', categories: ['other'] }],
          }),
          sha256Of: repository,
        },
      }),
    ).toEqual({ [keys.shirt]: [], [keys.shield]: [name], [keys.control]: [] });
  });

  it('never proves Gear and Item Abilities from a named entry without the reviewed list', () => {
    const rope = 'pf1/proofRope';
    const entry = (change: Record<string, unknown> = {}) => ({
      family: 'unscoped',
      mechanism: name,
      kinds: ['item'],
      tests: [{ path: proofTest, sha256: repository(proofTest) }],
      calculationIdentity: currentCalculationIdentity,
      disqualifying: [],
      ...change,
    });
    const without = launchMechanismProofs.filter(
      (proof) => proof.family !== 'gear',
    );
    const rows = [...baseRows(), itemRow(rope)];
    const entries = [
      ...baseEntries(),
      itemEntry(rope, { detail: { consumable: false } }),
    ];
    const admission = admittedGate([...Object.values(keys), rope]);
    const none = {
      [keys.shirt]: [],
      [keys.shield]: [],
      [keys.control]: [],
      [rope]: [],
    };
    for (const [label, registry, expected] of [
      // Before `gearGate` this proved every admitted item, rope included.
      ['an unscoped entry', [...without, entry()], none],
      [
        'a scoped item entry',
        [
          ...without,
          entry({
            scope: { detailKind: 'item', nonEmpty: ['armor'], empty: [] },
          }),
        ],
        none,
      ],
      [
        'beside the family',
        [...withReviewed(syntheticReviewed), entry()],
        { ...none, [keys.shirt]: [name], [keys.shield]: [name] },
      ],
    ] as const)
      expect(
        proven({
          rows,
          entries,
          admission,
          proofs: { registry: [...registry], sha256Of: repository },
        }),
        label,
      ).toEqual(expected);
    // The same unscoped entry for another mechanism still proves it.
    const other = itemRow('pf1/proofOther', {
      mechanisms: [{ ...gear(), name: 'Other mechanism' }],
    });
    expect(
      proven({
        rows: [other],
        entries: [itemEntry(other.key, shirtOutputs)],
        admission: admittedGate([other.key]),
        proofs: {
          registry: [...without, entry({ mechanism: 'Other mechanism' })],
          sha256Of: repository,
        },
      }),
    ).toEqual({ [other.key]: ['Other mechanism'] });
  });
});

describe('the gear family on worn items and the tower shield (gear S2)', () => {
  const modifierMechanism = (mechanismName: string) => ({
    ...gear(),
    name: mechanismName,
  });
  const s2Row = (key: string, names: readonly string[], change = {}) =>
    itemRow(key, {
      mechanisms: [gear(), ...names.map(modifierMechanism)],
      ...change,
    });
  const rows = () => [
    s2Row(s2Keys.belt, beltMechanisms),
    s2Row(s2Keys.tower, towerMechanisms),
  ];
  const entries = () => [
    itemEntry(s2Keys.belt, beltOutputs, { pack: 'items' }),
    itemEntry(s2Keys.tower, towerOutputs),
  ];
  const registry = (reviewed: unknown[] = s2Reviewed, scope = {}) =>
    withReviewed([...syntheticReviewed, ...reviewed], scope);
  /** The S2 rows' proven mechanisms after one change. */
  function s2Proven({
    rows: changedRows = rows(),
    entries: changedEntries = entries(),
    reviewed,
    scope,
    ...change
  }: Partial<LaunchVerificationInput> & {
    rows?: Row[];
    entries?: unknown[];
    reviewed?: unknown[];
    scope?: Record<string, unknown>;
  } = {}) {
    return Object.fromEntries(
      verifyLaunchRows(
        { rows: changedRows, edges: [] },
        projectionInput({
          admission: admittedGate(Object.values(s2Keys)),
          scopeBuild: {
            entries: changedEntries,
            remaps: new Map(),
            resources: new Map(),
          },
          proofs: {
            registry: registry(reviewed, scope),
            sha256Of: repository,
          },
          ...change,
        }),
      ).map(({ key, mechanisms }) => [key, [...mechanisms].sort()]),
    );
  }
  const all = (names: readonly string[]) => [name, ...names].sort();
  const both = {
    [s2Keys.belt]: all(beltMechanisms),
    [s2Keys.tower]: all(towerMechanisms),
  };

  it('proves a listed worn item’s and tower shield’s Gear and Item Abilities with their Modifier mechanisms, together', () => {
    expect(s2Proven()).toEqual(both);
    // The family names a listed record's Modifier mechanisms for its own row
    // only; no other entry proves them on an item.
    const record = s2Reviewed[0];
    expect(record).toBeDefined();
    const without = launchMechanismProofs.filter(
      (proof) => proof.family !== 'gear',
    );
    expect(
      Object.values(
        Object.fromEntries(
          verifyLaunchRows(
            { rows: rows(), edges: [] },
            projectionInput({
              admission: admittedGate(Object.values(s2Keys)),
              scopeBuild: {
                entries: entries(),
                remaps: new Map(),
                resources: new Map(),
              },
              proofs: { registry: without, sha256Of: repository },
            }),
          ).map(({ key, mechanisms }) => [key, mechanisms]),
        ),
      ).flat(),
    ).toEqual([]);
  });

  it('refuses a worn-item record with an armor block or with nothing to compute, and a Modifier mechanism name of another prefix', () => {
    const parses = (record: Record<string, unknown>) =>
      launchMechanismProofSchema.safeParse(registry([record]).find(isFamily))
        .success;
    const belt = reviewedRecord(s2Keys.belt, beltOutputs, {
      shape: 'worn-item',
      modifierMechanisms: beltMechanisms,
    });
    expect(parses(belt)).toBe(true);
    expect(parses({ ...belt, outputs: towerOutputs }), 'an armor block').toBe(
      false,
    );
    expect(
      parses({ ...belt, outputs: { detail: { consumable: false } } }),
      'nothing to compute',
    ).toBe(false);
    expect(
      parses({ ...belt, modifierMechanisms: ['Source body mechanics'] }),
      'another mechanism',
    ).toBe(false);
    expect(parses({ ...belt, modifierMechanisms: [] }), 'an empty list').toBe(
      false,
    );
    expect(
      parses({ ...belt, shape: 'worn-armor' }),
      'worn armor without a block',
    ).toBe(false);
  });

  it('keeps every mechanism outstanding for a row whose mechanisms, outputs or scope differ from the reviewed proof', () => {
    const beltOnly = (
      change: Parameters<typeof s2Proven>[0],
    ): Record<string, string[]> => {
      const result = s2Proven(change);
      return { [s2Keys.belt]: result[s2Keys.belt] ?? [] };
    };
    const beltRow = (names: readonly string[]) => [
      s2Row(s2Keys.belt, names),
      s2Row(s2Keys.tower, towerMechanisms),
    ];
    const beltEntry = (outputs: Record<string, unknown>) => [
      itemEntry(s2Keys.belt, outputs),
      itemEntry(s2Keys.tower, towerOutputs),
    ];
    /** Outputs the entry and the review share, so only the scope refuses. */
    const shared = (outputs: Record<string, unknown>) => ({
      entries: beltEntry(outputs),
      reviewed: [
        reviewedRecord(s2Keys.belt, outputs, {
          shape: 'worn-item',
          modifierMechanisms: beltMechanisms,
        }),
        s2Reviewed[1],
      ],
    });
    const withBeltModifier = (modifier: Record<string, unknown>) =>
      shared({
        ...beltOutputs,
        modifiers: [...beltOutputs.modifiers, modifier],
      });
    const cases: [string, Parameters<typeof s2Proven>[0]][] = [
      // The row's mechanisms against the record's.
      [
        'a Modifier mechanism the record lacks',
        { rows: beltRow([...beltMechanisms, 'Modifier con 4']) },
      ],
      [
        'a dropped Modifier mechanism',
        { rows: beltRow(beltMechanisms.slice(1)) },
      ],
      [
        'another Modifier mechanism',
        { rows: beltRow(['Modifier str 6', ...beltMechanisms.slice(1)]) },
      ],
      [
        'a doubled Modifier mechanism',
        { rows: beltRow([...beltMechanisms, 'Modifier str 4']) },
      ],
      [
        'a mechanism of another kind',
        {
          rows: [
            itemRow(s2Keys.belt, {
              mechanisms: [
                gear(),
                ...beltMechanisms.map(modifierMechanism),
                modifierMechanism('Source body mechanics'),
              ],
            }),
          ],
        },
      ],
      [
        'no Gear and Item Abilities',
        {
          rows: [
            itemRow(s2Keys.belt, {
              mechanisms: beltMechanisms.map(modifierMechanism),
            }),
          ],
        },
      ],
      [
        'a record without its Modifier mechanisms',
        {
          reviewed: [
            reviewedRecord(s2Keys.belt, beltOutputs, { shape: 'worn-item' }),
          ],
        },
      ],
      // The outputs against the reviewed ones.
      [
        'another enhancement',
        {
          entries: beltEntry({
            ...beltOutputs,
            modifiers: [
              { target: 'ability.str', bonusType: 'enhancement', value: 6 },
              ...beltOutputs.modifiers.slice(1),
            ],
          }),
        },
      ],
      [
        'an unzeroed Craft change',
        {
          entries: beltEntry({
            ...beltOutputs,
            modifiers: beltOutputs.modifiers.map((modifier) =>
              modifier.value === 0 ? { ...modifier, value: 2 } : modifier,
            ),
          }),
        },
      ],
      [
        'the Situational bonus made unconditional',
        {
          entries: beltEntry({
            ...beltOutputs,
            modifiers: beltOutputs.modifiers.map(
              ({ condition: _condition, ...modifier }) => modifier,
            ),
          }),
        },
      ],
      [
        'an armor block on the worn item',
        { entries: beltEntry({ ...beltOutputs, detail: towerOutputs.detail }) },
      ],
      // Outputs both share that the scope does not cover.
      ...(
        [
          ['ac', 'enhancement'],
          ['ac', 'dodge'],
          ['ac.natural', 'naturalArmor'],
          ['ability.str', 'inherent'],
          ['skill.clm', 'circumstance'],
          ['skill.per', 'competence'],
          ['saves', 'luck'],
          ['attack', 'enhancement'],
          ['damage', 'untyped'],
          ['casterLevel', 'enhancement'],
        ] as const
      ).map(([target, bonusType]): [string, Parameters<typeof s2Proven>[0]] => [
        `an unconditional ${target} ${bonusType} Modifier`,
        withBeltModifier({ target, bonusType, value: 1 }),
      ]),
      ...(
        [
          ['cmb', 'untyped'],
          ['ac', 'insight'],
          ['attack', 'untyped'],
          ['skill.clm', 'competence'],
          ['saves', 'resistance'],
        ] as const
      ).map(([target, bonusType]): [string, Parameters<typeof s2Proven>[0]] => [
        `a Situational ${target} ${bonusType} Modifier`,
        withBeltModifier({
          target,
          bonusType,
          value: 1,
          condition: { situation: { local: 'x' } },
        }),
      ]),
      // Value classes the public cases don't prove: an unzeroed Craft
      // change, a zero or negative enhancement, a positive attack bonus.
      ...(
        [
          ['skill.crf', 'circumstance', 2],
          ['skill.prf', 'circumstance', 2],
          ['skill.ste', 'competence', 5],
          ['ability.con', 'enhancement', 0],
          ['ac', 'deflection', -1],
          ['attack', 'untyped', 1],
        ] as const
      ).map(
        ([target, bonusType, value]): [
          string,
          Parameters<typeof s2Proven>[0],
        ] => [
          `an unconditional ${target} ${bonusType} ${value}`,
          withBeltModifier({ target, bonusType, value }),
        ],
      ),
      [
        'a Situational Craft penalty',
        withBeltModifier({
          target: 'skill.crf',
          bonusType: 'circumstance',
          value: -2,
          condition: { situation: { local: 'x' } },
        }),
      ],
      [
        'an untyped Modifier in the weapon condition',
        withBeltModifier({
          target: 'attack',
          bonusType: 'untyped',
          value: 1,
          condition: { weapon: '$unarmedOrNatural' },
        }),
      ],
      [
        'an enhancement in another weapon condition',
        withBeltModifier({
          target: 'attack',
          bonusType: 'enhancement',
          value: 1,
          condition: { weapon: '$self' },
        }),
      ],
      [
        'a weapon-conditioned enhancement penalty',
        withBeltModifier({
          target: 'damage',
          bonusType: 'enhancement',
          value: -1,
          condition: { weapon: '$unarmedOrNatural' },
        }),
      ],
      [
        'a note on a target the scope leaves out',
        shared({
          ...beltOutputs,
          situationalNotes: [{ target: 'skill.per', text: 'x' }],
        }),
      ],
      [
        'a scope without the worn-item shape',
        {
          scope: {
            shapes: [
              {
                shape: 'worn-armor',
                categories: ['lightArmor', 'mediumArmor', 'heavyArmor'],
              },
              { shape: 'shield', categories: ['other', 'towerShield'] },
            ],
          },
        },
      ],
      [
        'a scope without the unconditional enhancement',
        {
          scope: {
            modifiers: [
              {
                target: 'skill.crf',
                bonusTypes: ['circumstance'],
                values: ['zero'],
              },
            ],
          },
        },
      ],
      [
        'a scope without the Situational Craft bonus',
        {
          scope: {
            situationalModifiers: [
              {
                target: 'attack.melee',
                bonusTypes: ['untyped'],
                values: ['negative'],
              },
            ],
          },
        },
      ],
      // Issues: the family still names every field.
      ...['description.link', 'changes', 'gameContent'].map(
        (field): [string, Parameters<typeof s2Proven>[0]] => [
          `a ${field} issue`,
          {
            unsupported: {
              entries: [{ externalKey: s2Keys.belt, issues: [{ field }] }],
            },
          },
        ],
      ),
    ];
    expect(beltOnly({})).toEqual({ [s2Keys.belt]: both[s2Keys.belt] });
    for (const [label, change] of cases)
      expect(beltOnly(change), label).toEqual({ [s2Keys.belt]: [] });
    // The tower shield: its category, block and −2.
    const towerCases: [string, Parameters<typeof s2Proven>[0]][] = [
      [
        'a scope without the tower shield category',
        {
          scope: {
            shapes: [
              {
                shape: 'worn-armor',
                categories: ['lightArmor', 'mediumArmor', 'heavyArmor'],
              },
              { shape: 'shield', categories: ['other'] },
              { shape: 'worn-item' },
            ],
          },
        },
      ],
      [
        'a tower shield reviewed as worn armor',
        {
          reviewed: [
            s2Reviewed[0],
            reviewedRecord(s2Keys.tower, towerOutputs, {
              shape: 'worn-armor',
              modifierMechanisms: towerMechanisms,
            }),
          ],
        },
      ],
      [
        'a scope without the untyped attack penalty',
        {
          scope: {
            modifiers: [
              {
                target: 'ability.str',
                bonusTypes: ['enhancement'],
                values: ['positive'],
              },
              {
                target: 'ability.dex',
                bonusTypes: ['enhancement'],
                values: ['positive'],
              },
              {
                target: 'skill.crf',
                bonusTypes: ['circumstance'],
                values: ['zero'],
              },
            ],
          },
        },
      ],
      [
        'another penalty',
        {
          entries: [
            itemEntry(s2Keys.belt, beltOutputs),
            itemEntry(s2Keys.tower, {
              ...towerOutputs,
              modifiers: [
                { target: 'attack', bonusType: 'untyped', value: -1 },
              ],
            }),
          ],
        },
      ],
      [
        'its Total cover action left as a gameContent issue',
        {
          unsupported: {
            entries: [
              {
                externalKey: s2Keys.tower,
                issues: [{ field: 'gameContent', reason: 'Retained.' }],
              },
            ],
          },
        },
      ],
    ];
    for (const [label, change] of towerCases)
      expect(s2Proven(change)[s2Keys.tower], label).toEqual([]);
  });

  it('names a listed record’s Modifier mechanisms for its own row only, so a committed projection stays current', () => {
    if (!family || !('gear' in family))
      throw new Error('Missing the gear family');
    const scope = {
      ...family.gear,
      reviewed: [...family.gear.reviewed, ...s2Reviewed],
    };
    const proof = { ...family, gear: scope };
    for (const mechanismName of beltMechanisms) {
      expect(proofNamesMechanism(proof, s2Keys.belt, mechanismName)).toBe(true);
      expect(proofNamesMechanism(proof, s2Keys.tower, mechanismName)).toBe(
        false,
      );
      expect(proofNamesMechanism(family, s2Keys.belt, mechanismName)).toBe(
        false,
      );
    }
    expect(proofNamesMechanism(proof, 'pf1/anyItem', name)).toBe(true);
  });
});

describe('the gear family on rows whose import issues a reviewed record binds (gear S3)', () => {
  const unmappedReason =
    'Unmapped target, bonus type, formula or calculation-stage dependency; contributes nothing.';
  const retainedReason =
    'Source game-content fields retained for feature curation; only explicitly mapped detail/modifiers have an interpretation.';
  const s3Keys = {
    cloak: 'pf1/proofCloak',
    fists: 'pf1/proofFists',
    tower: 'pf1/proofBoundTower',
  };
  // A cloak's resistance bonus on saves standing in for its unmapped
  // `resist` change; an amulet's enhancement bonus with unarmed strikes and
  // natural weapons standing in for its `nattack` and `ndamage` changes; a
  // tower shield's note on AC standing in for its retained Total cover
  // action.
  const resistance = { target: 'saves', bonusType: 'resistance', value: 1 };
  const [fistsAttack, fistsDamage] = (['attack', 'damage'] as const).map(
    (target) => ({
      target,
      bonusType: 'enhancement',
      value: 2,
      condition: { weapon: '$unarmedOrNatural' },
    }),
  );
  const totalCover = towerOutputs.situationalNotes[0];
  const raw = (target: string, formula: string, type: string) => ({
    target,
    formula,
    type,
  });
  const resist = raw('allSavingThrows', '1', 'resist');
  const nattack = raw('nattack', '2', 'enh');
  const ndamage = raw('ndamage', '2', 'enh');
  const cover = {
    actions: [{ name: 'Grant total cover', activation: { type: 'standard' } }],
  };
  type Issue = { field: string; reason?: string; value?: unknown };
  const changeIssue = (value: unknown): Issue => ({
    field: 'changes',
    reason: unmappedReason,
    value,
  });
  const coverIssue: Issue = {
    field: 'gameContent',
    reason: retainedReason,
    value: cover,
  };
  const boundChange = (source: unknown, modifier: unknown) => ({
    kind: 'unmappedChange',
    path: 'changes',
    source,
    deliveredBy: { modifier },
  });
  const boundCover = {
    kind: 'retainedGameContent',
    path: 'gameContent',
    source: cover,
    deliveredBy: { note: totalCover },
  };
  const rowsOf = {
    cloak: {
      outputs: {
        detail: { consumable: false },
        modifiers: [resistance],
      },
      shape: 'worn-item',
      modifierMechanisms: ['Modifier allSavingThrows 1'],
      issues: [changeIssue(resist)],
      bound: [boundChange(resist, resistance)],
    },
    fists: {
      outputs: {
        detail: { consumable: false },
        modifiers: [fistsAttack, fistsDamage],
      },
      shape: 'worn-item',
      modifierMechanisms: ['Modifier nattack 2', 'Modifier ndamage 2'],
      issues: [changeIssue(nattack), changeIssue(ndamage)],
      bound: [
        boundChange(nattack, fistsAttack),
        boundChange(ndamage, fistsDamage),
      ],
    },
    tower: {
      outputs: towerOutputs,
      shape: 'shield',
      modifierMechanisms: towerMechanisms,
      issues: [coverIssue],
      bound: [boundCover],
    },
  };
  type Label = keyof typeof rowsOf;
  const labels = Object.keys(rowsOf) as Label[];
  const record = (label: Label, change: Record<string, unknown> = {}) => {
    const { outputs, shape, modifierMechanisms, bound } = rowsOf[label];
    return reviewedRecord(s3Keys[label], outputs, {
      shape,
      modifierMechanisms,
      issues: bound,
      ...change,
    });
  };
  /** Each S3 row's proven mechanisms after one change to one row. */
  function s3Proven({
    label,
    issues,
    outputs,
    reviewed,
    scope,
  }: {
    label?: Label;
    issues?: Issue[];
    outputs?: Record<string, unknown>;
    reviewed?: Record<string, unknown>;
    scope?: Record<string, unknown>;
  } = {}) {
    const changed = <T>(of: Label, base: T, value: T | undefined) =>
      of === label && value !== undefined ? value : base;
    return Object.fromEntries(
      verifyLaunchRows(
        {
          rows: labels.map((of) =>
            itemRow(s3Keys[of], {
              mechanisms: [
                gear(),
                ...rowsOf[of].modifierMechanisms.map((mechanismName) => ({
                  ...gear(),
                  name: mechanismName,
                })),
              ],
            }),
          ),
          edges: [],
        },
        projectionInput({
          admission: admittedGate(Object.values(s3Keys)),
          scopeBuild: {
            entries: labels.map((of) =>
              itemEntry(s3Keys[of], changed(of, rowsOf[of].outputs, outputs), {
                pack: of === 'tower' ? 'armors-and-shields' : 'items',
                unsupported: changed(of, rowsOf[of].issues, issues),
              }),
            ),
            remaps: new Map(),
            resources: new Map(),
          },
          unsupported: {
            entries: labels.map((of) => ({
              externalKey: s3Keys[of],
              issues: changed(of, rowsOf[of].issues, issues),
            })),
          },
          proofs: {
            registry: withReviewed(
              labels.map((of) => changed(of, record(of), reviewed)),
              scope,
            ),
            sha256Of: repository,
          },
        }),
      ).map(({ key, mechanisms }) => [key, [...mechanisms].sort()]),
    );
  }
  const allOf = (label: Label) =>
    [name, ...rowsOf[label].modifierMechanisms].sort();
  const every = Object.fromEntries(
    labels.map((label) => [s3Keys[label], allOf(label)]),
  );

  it('proves a listed row whose every import issue its record binds, by exact identity, to a proven stand-in among its outputs', () => {
    expect(s3Proven()).toEqual(every);
    // Without the binding each issue refuses its row, as before gear S3: a
    // record's binding is the whole exception.
    for (const label of labels)
      expect(
        s3Proven({ label, reviewed: record(label, { issues: undefined }) })[
          s3Keys[label]
        ],
        label,
      ).toEqual([]);
  });

  it('refuses an unbound issue, a wrong identity, a binding the row lacks and a stand-in that isn’t a proven output', () => {
    const link = {
      field: 'description.link',
      reason: 'Unresolved catalog link stripped.',
      value: 'Compendium.pf1.spells.x',
    };
    const narrowed = (list: 'modifiers' | 'weaponModifiers') => {
      if (!family || !('gear' in family))
        throw new Error('Missing the gear family');
      const scoped = family.gear[list].filter(
        ({ target, bonusTypes }) =>
          !(target === 'saves' && bonusTypes.includes('resistance')) &&
          target !== 'damage',
      );
      return { [list]: scoped };
    };
    const luck = { target: 'saves', bonusType: 'luck', value: 1 };
    const cases: [string, Parameters<typeof s3Proven>[0] & { label: Label }][] =
      [
        // An issue on the entry the record doesn't bind.
        [
          'an unbound link issue beside the bound change',
          { label: 'cloak', issues: [...rowsOf.cloak.issues, link] },
        ],
        [
          'one of two changes unbound',
          {
            label: 'fists',
            reviewed: record('fists', { issues: [rowsOf.fists.bound[0]] }),
          },
        ],
        [
          'the same change twice on the entry, bound once',
          {
            label: 'cloak',
            issues: [...rowsOf.cloak.issues, ...rowsOf.cloak.issues],
          },
        ],
        // The identity: kind (the importer's reason), path and source bytes.
        [
          'another formula',
          {
            label: 'cloak',
            issues: [changeIssue(raw('allSavingThrows', '3', 'resist'))],
          },
        ],
        [
          'another bonus type',
          {
            label: 'cloak',
            issues: [changeIssue(raw('allSavingThrows', '1', 'luck'))],
          },
        ],
        [
          'another target',
          {
            label: 'fists',
            issues: [
              changeIssue(nattack),
              changeIssue(raw('nattack', '2', 'enh')),
            ],
          },
        ],
        [
          'an operator in the source',
          {
            label: 'cloak',
            issues: [changeIssue({ ...resist, operator: 'set' })],
          },
        ],
        [
          'another reason',
          {
            label: 'cloak',
            issues: [
              {
                ...changeIssue(resist),
                reason: 'Reviewed: no sheet statistic.',
              },
            ],
          },
        ],
        [
          'no reason',
          { label: 'cloak', issues: [{ field: 'changes', value: resist }] },
        ],
        [
          'another path',
          {
            label: 'cloak',
            issues: [{ ...changeIssue(resist), field: 'changes.0' }],
          },
        ],
        [
          'another action',
          {
            label: 'tower',
            issues: [
              { ...coverIssue, value: { actions: [{ name: 'Shield bash' }] } },
            ],
          },
        ],
        [
          'the action bound as a change',
          { label: 'tower', issues: [{ ...coverIssue, field: 'changes' }] },
        ],
        // A binding the row's issues lack.
        ['a bound change the entry lacks', { label: 'cloak', issues: [] }],
        [
          'one change bound twice',
          {
            label: 'fists',
            reviewed: record('fists', {
              issues: [rowsOf.fists.bound[0], rowsOf.fists.bound[0]],
            }),
          },
        ],
        // The stand-in: an output of the record, its own, of the change's
        // value, and proven.
        [
          'a stand-in that isn’t an output',
          {
            label: 'cloak',
            reviewed: record('cloak', {
              issues: [
                boundChange(resist, { ...resistance, bonusType: 'luck' }),
              ],
            }),
          },
        ],
        [
          'one stand-in for two changes',
          {
            label: 'fists',
            reviewed: record('fists', {
              issues: [
                boundChange(nattack, fistsAttack),
                boundChange(ndamage, fistsAttack),
              ],
            }),
          },
        ],
        [
          'a stand-in of another value than the change’s formula',
          {
            label: 'cloak',
            issues: [changeIssue(raw('allSavingThrows', '3', 'resist'))],
            reviewed: record('cloak', {
              issues: [
                boundChange(raw('allSavingThrows', '3', 'resist'), resistance),
              ],
            }),
          },
        ],
        [
          'a stand-in note that isn’t an output',
          {
            label: 'tower',
            reviewed: record('tower', {
              issues: [
                {
                  ...boundCover,
                  deliveredBy: { note: { target: 'ac', text: 'Cover.' } },
                },
              ],
            }),
          },
        ],
        [
          'an unproven stand-in, shared by the entry and the record',
          {
            label: 'cloak',
            outputs: { detail: { consumable: false }, modifiers: [luck] },
            reviewed: record('cloak', {
              outputs: { detail: { consumable: false }, modifiers: [luck] },
              issues: [boundChange(resist, luck)],
            }),
          },
        ],
        [
          'a scope without the resistance stand-in',
          { label: 'cloak', scope: narrowed('modifiers') },
        ],
        [
          'a scope without the damage stand-in',
          { label: 'fists', scope: narrowed('weaponModifiers') },
        ],
      ];
    for (const [label, change] of cases) {
      const result = s3Proven(change);
      expect(result[s3Keys[change.label]], label).toEqual([]);
      // The other rows are untouched by the change.
      for (const other of labels)
        if (other !== change.label && !change.scope)
          expect(result[s3Keys[other]], `${label}: ${other}`).toEqual(
            allOf(other),
          );
    }
  });

  it('refuses a binding record of an illegal shape, and types each kind with its own path, source and stand-in', () => {
    const parses = (change: Record<string, unknown>) =>
      launchMechanismProofSchema.safeParse(
        withReviewed([record('cloak', change)]).find(isFamily),
      ).success;
    expect(parses({})).toBe(true);
    const [bound] = rowsOf.cloak.bound;
    for (const [label, issues] of [
      ['an empty binding list', []],
      [
        'a change on the game-content path',
        [{ ...bound, path: 'gameContent' }],
      ],
      [
        'a change delivered by a note',
        [{ ...bound, deliveredBy: { note: totalCover } }],
      ],
      [
        'an action delivered by a Modifier',
        [{ ...boundCover, deliveredBy: { modifier: resistance } }],
      ],
      ['another kind', [{ ...bound, kind: 'descriptionLink' }]],
      [
        'a change source with another field',
        [{ ...bound, source: { ...resist, operator: 'set' } }],
      ],
      [
        'a binding without its stand-in',
        [{ ...bound, deliveredBy: undefined }],
      ],
    ] as const)
      expect(parses({ issues }), label).toBe(false);
    type Bound = NonNullable<ReviewedGear['issues']>;
    expectTypeOf<[]>().not.toExtend<Bound>();
    expectTypeOf<
      Extract<Bound[number], { kind: 'unmappedChange' }>
    >().toExtend<{
      path: 'changes';
      source: { target: string; formula: string; type: string };
      deliveredBy: { modifier: unknown };
    }>();
    expectTypeOf<
      Extract<Bound[number], { kind: 'retainedGameContent' }>
    >().toExtend<{
      path: 'gameContent';
      deliveredBy: { note: unknown };
    }>();
  });
});

// The coverage tie: everything the family's scope certifies is a shape the
// public proofs release and assert on. The two public tests release their
// fixtures' bodies (`tests/gear-proof-armor.ts`, `tests/gear-proof-worn-items.ts`,
// both bound by bytes in the registry entry beside the tests), so the
// certified set must be a subset of what those bodies carry.

type Scope = Extract<
  (typeof launchMechanismProofs)[number],
  { family: string; gear: unknown }
>['gear'];
const asList = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

/**
 * A released Modifier in the tie's words: its condition (unconditional, local
 * or its weapon condition; the fixtures' Situations are local ones), target,
 * bonus type and value class.
 */
function modifierWord(modifier: unknown) {
  const { target, bonusType, value, condition } = asObject(modifier);
  const { situation, weapon } = asObject(condition);
  if (typeof value !== 'number') return undefined;
  const scoped =
    typeof weapon === 'string'
      ? `weapon ${weapon}`
      : situation
        ? 'local'
        : 'unconditional';
  return `${scoped} ${String(target)} ${String(bonusType)} ${gearValueClass(value)}`;
}

/** What a public fixture releases, in the tie's words. */
function exercised(bodies: readonly unknown[]) {
  const words = new Set<string>();
  for (const released of bodies) {
    const { detail, modifiers, situationalNotes } = asObject(released);
    const { armor, weapon } = asObject(detail);
    if (armor) {
      const { slot, category } = asObject(armor);
      words.add(`shape ${String(slot)} ${String(category)}`);
    } else if (!weapon) words.add('shape worn-item');
    for (const word of asList(modifiers).map(modifierWord))
      if (word) words.add(word);
    for (const note of asList(situationalNotes)) {
      const { target } = asObject(note);
      if (typeof target === 'string') words.add(`note ${target}`);
    }
  }
  return words;
}

/** What the scope certifies, in the same words. */
function certified(scope: Scope) {
  const words = new Set<string>();
  for (const shape of scope.shapes)
    if (shape.shape === 'worn-item') words.add('shape worn-item');
    else
      for (const category of shape.categories)
        words.add(
          `shape ${shape.shape === 'shield' ? 'shield' : 'armor'} ${category}`,
        );
  for (const [condition, list] of [
    ['unconditional', scope.modifiers],
    ['local', scope.situationalModifiers],
    ...scope.weaponModifiers.map(
      ({ weapon, ...proven }) => [`weapon ${weapon}`, [proven]] as const,
    ),
  ] as const)
    for (const { target, bonusTypes, values } of list)
      for (const bonusType of bonusTypes)
        for (const value of values)
          words.add(`${condition} ${target} ${bonusType} ${value}`);
  for (const target of scope.noteTargets) words.add(`note ${target}`);
  return words;
}

/** What the scope certifies that no public fixture releases. */
function uncovered(
  scope: Scope,
  bodies: readonly unknown[] = [...armorProofBodies, ...wornItemProofBodies],
) {
  const released = exercised(bodies);
  return [...certified(scope)].filter((word) => !released.has(word)).sort();
}

describe('the gear scope’s coverage tie to its public proofs', () => {
  const scope = () => {
    if (!family || !('gear' in family))
      throw new Error('Missing the gear family');
    return family.gear;
  };

  it('certifies only shapes, Modifiers and note targets the public fixtures release', () => {
    expect(uncovered(scope())).toEqual([]);
    // The fixtures are bound beside the public tests: a changed fixture
    // leaves the entry stale until it is pinned again.
    expect(family?.tests.map(({ path }) => path)).toEqual([
      proofTest,
      modifiersTest,
      'tests/gear-proof-armor.ts',
      'tests/gear-proof-worn-items.ts',
    ]);
  });

  it('fails when a scratch scope certifies a pair, value class, category or note target no public case proves', () => {
    const base = scope();
    const cases: [string, Scope, string][] = [
      [
        'a nonzero unconditional Craft bonus',
        {
          ...base,
          modifiers: [
            ...base.modifiers,
            {
              target: 'skill.crf',
              bonusTypes: ['circumstance'],
              values: ['positive'],
            },
          ],
        },
        'unconditional skill.crf circumstance positive',
      ],
      [
        'an unproven pair',
        {
          ...base,
          modifiers: [
            ...base.modifiers,
            {
              target: 'saves',
              bonusTypes: ['luck'],
              values: ['positive'],
            },
          ],
        },
        'unconditional saves luck positive',
      ],
      [
        'an unproven stand-in in the weapon condition',
        {
          ...base,
          weaponModifiers: [
            ...base.weaponModifiers,
            {
              weapon: '$unarmedOrNatural',
              target: 'attack',
              bonusTypes: ['untyped'],
              values: ['positive'],
            },
          ],
        },
        'weapon $unarmedOrNatural attack untyped positive',
      ],
      [
        'an unproven value class in the weapon condition',
        {
          ...base,
          weaponModifiers: [
            ...base.weaponModifiers,
            {
              weapon: '$unarmedOrNatural',
              target: 'damage',
              bonusTypes: ['enhancement'],
              values: ['negative'],
            },
          ],
        },
        'weapon $unarmedOrNatural damage enhancement negative',
      ],
      [
        'an unproven Situational bonus type',
        {
          ...base,
          situationalModifiers: [
            ...base.situationalModifiers,
            { target: 'cmb', bonusTypes: ['luck'], values: ['positive'] },
          ],
        },
        'local cmb luck positive',
      ],
      [
        'an unproven note target',
        { ...base, noteTargets: [...base.noteTargets, 'skill.per'] },
        'note skill.per',
      ],
    ];
    for (const [label, widened, word] of cases)
      expect(uncovered(widened), label).toEqual([word]);
    // The scope's category enums admit no category outside the fixtures, so
    // the category tie's negative case drops a released body instead: a
    // fixture without its tower shield leaves `towerShield` and its −2
    // uncovered, and one without the buckler `other`, the Situational attack
    // penalties and the note on attack.
    const without = (name: string) =>
      [...armorProofBodies, ...wornItemProofBodies].filter(
        (released) => asObject(released).name !== name,
      );
    expect(uncovered(base, without('Proof tower'))).toEqual([
      'shape shield towerShield',
      'unconditional attack untyped negative',
    ]);
    expect(uncovered(base, without('Proof Buckler'))).toEqual([
      'local attack.melee untyped negative',
      'local attack.ranged untyped negative',
      'note attack',
      'shape shield other',
    ]);
    // Gear S3's stand-ins: without the amulet its weapon-conditioned
    // enhancements, and without both cloaks their resistance bonus.
    expect(uncovered(base, without('Proof fists'))).toEqual([
      'weapon $unarmedOrNatural attack enhancement positive',
      'weapon $unarmedOrNatural damage enhancement positive',
    ]);
    expect(
      uncovered(
        base,
        without('Proof resistance').filter(
          (released) => asObject(released).name !== 'Proof lesserResistance',
        ),
      ),
    ).toEqual(['unconditional saves resistance positive']);
    // A weapon-conditioned body is never read as an unconditional one.
    expect(
      exercised([
        {
          detail: { kind: 'item' },
          modifiers: [
            {
              target: 'attack',
              bonusType: 'enhancement',
              value: 1,
              condition: { weapon: '$unarmedOrNatural' },
            },
          ],
        },
      ]),
    ).toEqual(
      new Set([
        'shape worn-item',
        'weapon $unarmedOrNatural attack enhancement positive',
      ]),
    );
  });

  it('makes a reviewed record’s illegal shapes unrepresentable', () => {
    const block = {
      slot: 'shield',
      category: 'towerShield',
      bonus: 4,
      maxDex: 2,
      armorCheckPenalty: 10,
      asf: 50,
    } as const;
    const record = {
      key: 'pf1/x',
      name: 'x',
      sourceSha256: source,
      basis: 'x',
    };
    const legal: ReviewedGear[] = [
      {
        ...record,
        shape: 'shield',
        outputs: { detail: { consumable: false, armor: block } },
      },
      {
        ...record,
        shape: 'worn-item',
        outputs: {
          detail: { consumable: false },
          situationalNotes: [{ text: 'x' }],
        },
      },
    ];
    type Shaped<Shape extends ReviewedGear['shape']> = Extract<
      ReviewedGear,
      { shape: Shape }
    >['outputs'];
    // Each shape's block is in its own slot, and a worn item has none and
    // carries a Modifier or a note.
    expectTypeOf<
      Shaped<'worn-armor'>['detail']['armor']['slot']
    >().toEqualTypeOf<'armor'>();
    expectTypeOf<
      Shaped<'shield'>['detail']['armor']['slot']
    >().toEqualTypeOf<'shield'>();
    expectTypeOf<Shaped<'worn-item'>['detail']>().toEqualTypeOf<{
      consumable: false;
    }>();
    expectTypeOf<{
      detail: { consumable: false };
    }>().not.toExtend<Shaped<'worn-item'>>();
    expectTypeOf<{
      detail: { consumable: false };
    }>().not.toExtend<Shaped<'shield'>>();
    // An empty Modifier or note list is no output: each list is a non-empty
    // tuple, so a worn item with only empty lists doesn't typecheck.
    expectTypeOf<{
      detail: { consumable: false };
      modifiers: [];
    }>().not.toExtend<Shaped<'worn-item'>>();
    expectTypeOf<{
      detail: { consumable: false };
      situationalNotes: [];
    }>().not.toExtend<Shaped<'worn-item'>>();
    expectTypeOf<{
      detail: { consumable: false };
      modifiers: [];
      situationalNotes: [];
    }>().not.toExtend<Shaped<'worn-item'>>();
    const parses = (reviewed: unknown) =>
      launchMechanismProofSchema.safeParse(
        withReviewed([reviewed]).find(isFamily),
      ).success;
    expect(legal.map(parses)).toEqual([true, true]);
    // The parse refuses what the types refuse.
    const [shield, wornItem] = legal;
    expect(
      [
        { ...shield, outputs: { detail: { consumable: false } } },
        {
          ...wornItem,
          outputs: { detail: { consumable: false, armor: block } },
        },
        { ...wornItem, outputs: { detail: { consumable: false } } },
        { ...shield, shape: 'worn-armor' },
        ...[
          { modifiers: [] },
          { situationalNotes: [] },
          { modifiers: [], situationalNotes: [] },
        ].map((empty) => ({
          ...wornItem,
          outputs: { detail: { consumable: false }, ...empty },
        })),
      ].map(parses),
    ).toEqual([false, false, false, false, false, false, false]);
  });
});

// The committed control: the real listed rows, re-imported from the pinned
// store by the current importer with its context packs
// (`launch-modifier-evidence.ts`), and the committed inventory's every row
// carrying the mechanism.

/** A row's one Foundry source, when the pinned store holds it. */
function storedSource(row: LaunchRow) {
  const [bound, ...others] = row.sources.filter(
    ({ repository: repo }) => repo === 'pf1' || repo === 'pf1-content',
  );
  return bound &&
    !others.length &&
    existsSync(join(pinnedStore, bound.repository, bound.locator))
    ? bound
    : undefined;
}

/**
 * A row carrying the mechanism with no stored source gets a best-case item
 * entry: Chain Shirt's exact outputs, so only the list can refuse it.
 */
const bestCase = (row: LaunchRow) =>
  itemEntry(
    row.key,
    row.kind === 'item' ? shirtOutputs : { detail: { kind: row.kind } },
  );

/** The family's reviewed list. */
function reviewedList() {
  if (!family || !('gear' in family))
    throw new Error('Missing the gear family');
  return family.gear.reviewed;
}

/**
 * The committed inventory with the current importer's evidence for every row
 * carrying the mechanism whose source the store holds, and the rows that
 * prove it under a registry with every catalog row admitted: real entries
 * where the store holds the source, best-case ones elsewhere. Loaded once.
 */
async function readControl() {
  const committed = parseLaunchInventory(
    JSON.parse(
      await readFile('scripts/catalog/scopes/campaign-mvp-v1.json', 'utf8'),
    ),
  );
  const catalogRows = committed.rows.filter(
    ({ catalogKey, key }) => catalogKey && !/^(?:notice|rule)\//.test(key),
  );
  const carrying = catalogRows.filter(({ mechanisms }) =>
    mechanisms.some((mechanism) => mechanism.name === name),
  );
  const stored = carrying.filter((row) => storedSource(row));
  const real: Map<string, RealEntry> = await realEntries(stored);
  const entries = (best: boolean) => [
    ...[...real.values()].flatMap(({ entry }) => (entry ? [entry] : [])),
    ...(best ? carrying.filter(({ key }) => !real.has(key)).map(bestCase) : []),
  ];
  const project = (
    registry: readonly unknown[],
    best = true,
    issuesOf = (issues: RealEntry['issues']) => issues,
  ) =>
    verifyLaunchRows(committed, {
      ...projectionInput(),
      admission: admittedGate(catalogRows.map(({ key }) => key)),
      scopeBuild: {
        entries: entries(best),
        remaps: new Map(),
        resources: new Map(),
      },
      unsupported: {
        entries: [...real].map(([externalKey, { issues }]) => ({
          externalKey,
          issues: issuesOf(issues),
        })),
      },
      proofs: { registry, sha256Of: repository },
    })
      .filter(({ mechanisms }) => mechanisms.includes(name))
      .map(({ key }) => key)
      .sort();
  return { carrying, real, project };
}
/** What a listed row's check reads of its row and real evidence. */
function listedEvidence(row: LaunchRow | undefined, evidence?: RealEntry) {
  if (!row || !evidence) throw new Error('Missing a listed row');
  return {
    kind: row.kind,
    requirement: row.requirement,
    mechanisms: row.mechanisms.map((mechanism) => mechanism.name),
    source: storedSource(row)?.rawSha256,
    outputs: gearOutputs(evidence.entry),
    issues: evidence.issues,
  };
}
let control: ReturnType<typeof readControl> | undefined;
const committedControl = () => (control ??= readControl());

describe('the gear family over the committed inventory', () => {
  it('re-imports each listed row with its reviewed outputs and source bytes, and proves exactly the listed rows', async () => {
    const { carrying, real, project } = await committedControl();
    const reviewed = reviewedList();
    const byKey = new Map(carrying.map((row) => [row.key, row]));
    for (const record of [...reviewed, reviewedBuckler])
      expect(
        listedEvidence(byKey.get(record.key), real.get(record.key)),
        record.name,
      ).toEqual({
        kind: 'item',
        requirement: 'required',
        mechanisms: [name],
        source: record.sourceSha256,
        outputs: record.outputs,
        issues: [],
      });
    // Every catalog row admitted, real entries where the store holds the
    // source and best-case ones elsewhere: exactly the listed row proves.
    const listed = reviewed.map(({ key }) => key).sort();
    expect(
      carrying.filter(({ requirement }) => requirement === 'required').length,
    ).toBe(1009);
    expect(project(launchMechanismProofs)).toEqual(listed);
    expect(project(launchMechanismProofs, false)).toEqual(listed);
    // The list is what refuses the others: Buckler (O3) and Leather Armor,
    // whose real entries are in the store, each prove once listed with their
    // bytes and outputs.
    expect(project(withReviewed([...reviewed, reviewedBuckler]))).toEqual(
      [...listed, reviewedBuckler.key].sort(),
    );
    const leather = carrying.find(
      ({ name: rowName, kind }) =>
        kind === 'item' && rowName === 'Leather Armor',
    );
    const leatherSource = leather && storedSource(leather);
    const leatherOutputs = gearOutputs(leather && real.get(leather.key)?.entry);
    if (!leather || !leatherSource || !leatherOutputs)
      throw new Error('Missing Leather Armor');
    expect(leatherOutputs).toEqual({
      detail: {
        consumable: false,
        armor: {
          slot: 'armor',
          category: 'lightArmor',
          bonus: 2,
          maxDex: 6,
          armorCheckPenalty: 0,
          asf: 10,
        },
      },
    });
    expect(
      project(
        withReviewed([
          ...reviewed,
          reviewedRecord(leather.key, leatherOutputs, {
            sourceSha256: leatherSource.rawSha256,
          }),
        ]),
      ),
    ).toEqual([...listed, leather.key].sort());
    // Gear S2: a held worn item proves once listed with its real bytes,
    // outputs and Modifier mechanisms (Musical instrument, masterwork: its
    // change zeroed by a reviewed replacement, its +2 in a local Situation,
    // its note on Perform); a listed Tower Shield stays refused by its real
    // gameContent issue (the Total cover action), and a listed Ring of
    // Protection +2 by the description.link issues the store gives it.
    const listedS2 = (rowName: string, shape: string) => {
      const row = carrying.find(
        (found) => found.kind === 'item' && found.name === rowName,
      );
      const bound = row && storedSource(row);
      const outputs = gearOutputs(row && real.get(row.key)?.entry);
      if (!row || !bound || !outputs) throw new Error(`Missing ${rowName}`);
      const modifierMechanisms = row.mechanisms
        .map((mechanism) => mechanism.name)
        .filter((mechanismName) => mechanismName !== name);
      return {
        row,
        issues: real.get(row.key)?.issues.map(({ field }) => field),
        outputs,
        modifierMechanisms,
        record: reviewedRecord(row.key, outputs, {
          shape,
          sourceSha256: bound.rawSha256,
          modifierMechanisms,
        }),
      };
    };
    const instrument = listedS2('Musical instrument, masterwork', 'worn-item');
    expect(instrument.issues).toEqual([]);
    expect(instrument.modifierMechanisms).toEqual(['Modifier skill.prf 2']);
    expect(instrument.outputs).toMatchObject({
      detail: { consumable: false },
      modifiers: [
        { target: 'skill.prf', bonusType: 'circumstance', value: 0 },
        {
          target: 'skill.prf',
          bonusType: 'circumstance',
          value: 2,
          condition: {
            situation: {
              local: 'on Perform checks made to perform with the instrument',
            },
          },
        },
      ],
      situationalNotes: [{ target: 'skill.prf' }],
    });
    expect(project(withReviewed([...reviewed, instrument.record]))).toEqual(
      [...listed, instrument.row.key].sort(),
    );
    const tower = listedS2('Tower Shield', 'shield');
    expect(tower.issues).toEqual(['gameContent']);
    expect(tower.modifierMechanisms).toEqual(['Modifier attack -2']);
    const ring = listedS2('Ring of Protection +2', 'worn-item');
    expect(new Set(ring.issues)).toEqual(new Set(['description.link']));
    expect(
      project(withReviewed([...reviewed, tower.record, ring.record])),
    ).toEqual(listed);
    // Gear S3: a listed row whose record binds each real issue to its
    // stand-in. Tower Shield, its Total cover action bound to its note on
    // AC, proves. Cloak of Resistance +1 (its `resist` change bound to its
    // resistance bonus on saves) and Amulet of Mighty Fists +2 (its
    // `nattack` and `ndamage` changes bound to its weapon-conditioned
    // enhancements) stay refused by the description.link issues the store
    // gives them, unbound; without those (the full corpus resolves the
    // links), they prove.
    const issueOf = (rowName: string, field: string) => {
      const row = carrying.find(
        (found) => found.kind === 'item' && found.name === rowName,
      );
      return (row ? (real.get(row.key)?.issues ?? []) : []).filter(
        (issue) => issue.field === field,
      );
    };
    const changeBinding = (
      source: unknown,
      modifier: unknown,
    ): Record<string, unknown> => ({
      kind: 'unmappedChange',
      path: 'changes',
      source,
      deliveredBy: { modifier },
    });
    const [cover] = issueOf('Tower Shield', 'gameContent');
    expect(cover).toMatchObject({
      value: { actions: [{ name: 'Grant total cover' }] },
    });
    const boundTower = {
      ...tower.record,
      issues: [
        {
          kind: 'retainedGameContent',
          path: 'gameContent',
          source: cover?.value,
          deliveredBy: {
            note: asList(asObject(tower.outputs).situationalNotes)[0],
          },
        },
      ],
    };
    const cloak = listedS2('Cloak of Resistance +1', 'worn-item');
    expect(cloak.modifierMechanisms).toEqual(['Modifier allSavingThrows 1']);
    const resist = { target: 'allSavingThrows', formula: '1', type: 'resist' };
    expect(
      issueOf('Cloak of Resistance +1', 'changes').map(({ value }) => value),
    ).toEqual([resist]);
    const modifiersOf = (outputs: unknown) =>
      asList(asObject(outputs).modifiers);
    expect(modifiersOf(cloak.outputs)).toEqual([
      { target: 'saves', bonusType: 'resistance', value: 1 },
    ]);
    const boundCloak = {
      ...cloak.record,
      issues: [changeBinding(resist, modifiersOf(cloak.outputs)[0])],
    };
    const fists = listedS2('Amulet of Mighty Fists +2', 'worn-item');
    expect([...fists.modifierMechanisms].sort()).toEqual([
      'Modifier nattack 2',
      'Modifier ndamage 2',
    ]);
    const fistsChanges = ['nattack', 'ndamage'].map((target) => ({
      target,
      formula: '2',
      type: 'enh',
    }));
    expect(
      issueOf('Amulet of Mighty Fists +2', 'changes').map(({ value }) => value),
    ).toEqual(fistsChanges);
    expect(modifiersOf(fists.outputs)).toEqual(
      ['attack', 'damage'].map((target) => ({
        target,
        bonusType: 'enhancement',
        value: 2,
        condition: { weapon: '$unarmedOrNatural' },
      })),
    );
    const boundFists = {
      ...fists.record,
      issues: fistsChanges.map((change, index) =>
        changeBinding(change, modifiersOf(fists.outputs)[index]),
      ),
    };
    expect(new Set(cloak.issues)).toEqual(
      new Set(['changes', 'description.link']),
    );
    expect(new Set(fists.issues)).toEqual(
      new Set(['changes', 'description.link']),
    );
    const s3Registry = withReviewed([
      ...reviewed,
      boundTower,
      boundCloak,
      boundFists,
    ]);
    expect(project(s3Registry)).toEqual([...listed, tower.row.key].sort());
    expect(
      project(s3Registry, true, (issues) =>
        issues.filter(({ field }) => field !== 'description.link'),
      ),
    ).toEqual([...listed, tower.row.key, cloak.row.key, fists.row.key].sort());
    // Unbound, the same issues still refuse all three.
    expect(
      project(
        withReviewed([...reviewed, tower.record, cloak.record, fists.record]),
        true,
        (issues) => issues.filter(({ field }) => field !== 'description.link'),
      ),
    ).toEqual(listed);
  }, 300_000);
});
