// @vitest-environment node
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  gearOutputs,
  reviewedBuckler,
} from '../../scripts/catalog/launch-gear';
import { parseLaunchInventory } from '../../scripts/catalog/launch-inventory-document';
import type { LaunchRow } from '../../scripts/catalog/launch-inventory-schema';
import {
  launchMechanismProofSchema,
  launchMechanismProofs,
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
      tests: [{ path: proofTest }],
      calculationIdentity: currentCalculationIdentity,
      disqualifying: ['*'],
      gear: {
        shapes: [
          {
            shape: 'worn-armor',
            categories: ['lightArmor', 'mediumArmor', 'heavyArmor'],
          },
          { shape: 'shield', categories: ['other'] },
        ],
        targets: ['attack.melee', 'attack.ranged'],
        bonusTypes: ['untyped'],
        noteTargets: ['attack', 'ac'],
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
    // The entry with its test file's bytes changed proves nothing.
    expect(
      currentMechanismProofs({
        registry: launchMechanismProofs,
        sha256Of: (path) =>
          path === proofTest ? 'e'.repeat(64) : repository(path),
      }),
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

  it('refuses a reviewed record with no armor block, or with an output of an unproven kind or shape', () => {
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
      ['an unconditional Modifier', withModifier({ condition: undefined })],
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
      ...[
        'lightShield',
        'heavyShield',
        'towerShield',
        'buckler',
        'lightArmor',
      ].map((category): [string, Parameters<typeof shieldProven>[0]] => [
        `a shield of category ${category}`,
        sharedArmor({ category }),
      ]),
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
            targets: ['attack.ranged'],
          }),
        },
      ],
      [
        'a bonus type the scope leaves out',
        {
          registry: withReviewed(syntheticReviewed, { bonusTypes: ['shield'] }),
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
  const project = (registry: readonly unknown[], best = true) =>
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
          issues,
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
  }, 300_000);
});
