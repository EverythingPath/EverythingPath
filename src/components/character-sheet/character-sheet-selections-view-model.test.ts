import { magicalLineage } from '../../../e2e/fixtures/magical-lineage';
import {
  calculateFixtureSheet as calculateCharacterSheet,
  buildSheet,
} from './character-sheet-test-fixture';
import { expect, test } from 'vitest';

import {
  buildCharacterSheetSelectionsView,
  previewSelectionSlot,
  createSelectionSlotPreview,
} from './character-sheet-selections-view-model';
import {
  createCatalogSheetEntryState,
  selectableCatalogSheetEntryKinds,
} from '~/lib/character-sheet-entries';
import { buildCharacterSheetView } from './character-sheet-view-model';
import type { CharacterSheetSnapshot } from './use-character-sheet';

function selectionSheet(
  prerequisites: NonNullable<
    CharacterSheetSnapshot['catalogEntries'][number]['prerequisites']
  > = [],
  legacy = false,
) {
  const snapshot = buildSheet();
  const catalog = {
    ...snapshot.baseScoresEntry,
    _id: 'feat-catalog' as typeof snapshot.baseScoresEntry._id,
    name: 'Weapon Focus',
    ruleIdentity: 'weapon-focus',
    modifiers: [],
    detail: {
      kind: 'feat' as const,
      featTypes: ['combat'],
      repeatable: 'newChoice' as const,
    },
    prerequisites,
    ...(legacy
      ? {
          proficiencyPrerequisites: [
            {
              kind: 'proficiency' as const,
              proficiency: { category: 'martial' as const },
            },
          ],
        }
      : {}),
  };
  const entry = {
    ...snapshot.entries[0]!,
    _id: 'feat-entry' as CharacterSheetSnapshot['entries'][number]['_id'],
    catalogEntryId: catalog._id,
    kind: 'feat' as const,
    active: true,
    state: {
      kind: 'feat' as const,
      choice: 'Longsword',
      slot: 'general' as const,
    },
    gainedAtClassLevel: snapshot.entries[1]!._id,
    choiceOrder: 0,
    selectionSlot: { id: 'feat:general', position: 0 },
  };
  const entries = [...snapshot.entries, entry];
  const catalogEntries = [...snapshot.catalogEntries, catalog];
  return {
    ...snapshot,
    entries,
    catalogEntries,
    calculated: calculateCharacterSheet({
      entries,
      catalogEntries,
      characterKind: 'pc',
    }),
  };
}

test('an unfilled first-Hit-Die feat slot and two trait slots expose their budgets without invented failures', () => {
  const view = buildCharacterSheetSelectionsView(buildSheet());
  expect(view.slots.find((slot) => slot.id === 'feat:general')).toMatchObject({
    count: 1,
    used: 0,
    remaining: 1,
  });
  expect(view.slots.find((slot) => slot.id === 'trait:general')).toMatchObject({
    count: 2,
    used: 0,
    remaining: 2,
  });
  expect(view.rows).toEqual([]);
});

test('unmodeled prose stays readable without displaying uncheckable rows or a failed picker status', () => {
  const snapshot = selectionSheet([
    { unchecked: 'Member of the local militia' },
  ]);
  const row = buildCharacterSheetSelectionsView(snapshot).rows[0]!;
  expect(row.prerequisiteText).toBe('Member of the local militia');
  expect(row.currentStatus).toBeNull();
  expect(row.checks).toEqual([]);
  expect(row.warnings).toEqual([]);
  const preview = previewSelectionSlot(snapshot, {
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: row.entryId
      ? snapshot.catalogEntries.at(-1)!._id
      : snapshot.baseScoresEntry._id,
  });
  expect(preview).toMatchObject({
    currentStatus: null,
    checks: [],
    isSelectable: true,
    prerequisiteText: 'Member of the local militia',
  });
});

test('legacy proficiency prerequisites expose distinct current and recorded warnings and stay selectable', () => {
  const snapshot = selectionSheet([], true);
  const row = buildCharacterSheetSelectionsView(snapshot).rows[0]!;
  expect(row.currentStatus).toBe('unmet');
  expect(row.recordedStatus).toBe('unmet');
  expect(row.currentWarnings).toHaveLength(1);
  expect(row.recordedWarnings).toHaveLength(1);
  expect(row.checks).toHaveLength(2);
  expect(row.checks.filter((check) => check.view === 'current')).toHaveLength(
    1,
  );
  expect(row.checks.filter((check) => check.view === 'recorded')).toHaveLength(
    1,
  );
  expect(row.currentWarnings[0]!.subject).toBe('feat-entry:current:0');
  expect(row.recordedWarnings[0]!.subject).toBe('feat-entry:recorded:0');
  const preview = previewSelectionSlot(snapshot, {
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: snapshot.catalogEntries.at(-1)!._id,
  });
  expect(preview).toMatchObject({
    currentStatus: 'unmet',
    recordedStatus: 'unmet',
    isSelectable: true,
  });
  expect(preview?.checks).toHaveLength(2);
  expect(preview?.currentWarnings).toHaveLength(1);
  expect(preview?.recordedWarnings).toHaveLength(1);
  expect(
    preview?.checks.filter((check) => check.view === 'current'),
  ).toHaveLength(1);
  expect(
    preview?.checks.filter((check) => check.view === 'recorded'),
  ).toHaveLength(1);
});

test('a class feature requirement keeps its authored name when the original definition is unavailable', () => {
  const snapshot = selectionSheet([
    { classFeature: 'original-sneak-attack', classFeatureName: 'Sneak Attack' },
  ]);
  const row = buildCharacterSheetSelectionsView(snapshot).rows[0]!;
  expect(row.checks.map((check) => check.label)).toEqual([
    'Sneak Attack',
    'Sneak Attack',
  ]);
  const preview = previewSelectionSlot(snapshot, {
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: snapshot.catalogEntries.at(-1)!._id,
  });
  expect(preview?.checks.map((check) => check.label)).toEqual([
    'Sneak Attack',
    'Sneak Attack',
  ]);
});

test('prerequisite row labels use the same canonical skill and ability labels as engine messages', () => {
  const snapshot = selectionSheet([
    { ability: 'strength', min: 13 },
    { bab: 1 },
    { skillRanks: 'per', min: 2 },
  ]);
  const row = buildCharacterSheetSelectionsView(snapshot).rows[0]!;
  expect(
    row.checks
      .filter((check) => check.view === 'current')
      .map((check) => check.label),
  ).toEqual(['Strength 13', 'BAB +1', 'Perception 2 ranks']);
});

test('drawback guidance is a separate field from prerequisite prose and descriptions stay available', () => {
  const snapshot = selectionSheet();
  const catalogEntries = snapshot.catalogEntries.map((entry) =>
    entry.ruleIdentity === 'weapon-focus'
      ? {
          ...entry,
          description: 'A narrative consequence.',
          guidanceText: 'Record consequences in notes.',
          detail: { kind: 'trait' as const, traitType: 'drawback' as const },
        }
      : entry,
  );
  const entries = snapshot.entries.map((entry) =>
    entry.kind === 'feat'
      ? {
          ...entry,
          kind: 'trait' as const,
          state: { kind: 'trait' as const, choice: null },
          selectionSlot: { id: 'trait:drawback', position: 0 },
        }
      : entry,
  );
  const updated = {
    ...snapshot,
    entries,
    catalogEntries,
    calculated: calculateCharacterSheet({
      entries,
      catalogEntries,
      characterKind: 'pc',
    }),
  };
  const view = buildCharacterSheetSelectionsView(updated);
  expect(view.rows[0]).toMatchObject({
    prerequisiteText: '',
    guidanceText: 'Record consequences in notes.',
    description: 'A narrative consequence.',
  });
  expect(view.candidates[0]).toMatchObject({
    prerequisiteText: '',
    guidanceText: 'Record consequences in notes.',
  });
  expect(
    previewSelectionSlot(updated, {
      slotId: 'trait:drawback',
      position: 0,
      catalogEntryId: catalogEntries.at(-1)!._id,
    }),
  ).toMatchObject({
    prerequisiteText: '',
    guidanceText: 'Record consequences in notes.',
  });
});

test('picker previews reuse unchanged inputs and refresh when the saved sheet changes', () => {
  const snapshot = selectionSheet([{ ability: 'strength', min: 13 }]);
  const input = {
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: snapshot.catalogEntries.at(-1)!._id,
  };
  const preview = createSelectionSlotPreview(snapshot);
  const first = preview(input);
  expect(first?.currentStatus).toBe('unmet');
  expect(preview({ ...input })).toBe(first);
  const strengthenedBase = buildSheet({
    scores: { ...snapshot.character, strength: 14 },
  });
  const strengthened = {
    ...snapshot,
    catalogEntries: snapshot.catalogEntries.map((catalog) =>
      catalog._id === snapshot.baseScoresEntry._id
        ? strengthenedBase.baseScoresEntry
        : catalog,
    ),
  };
  expect(createSelectionSlotPreview(strengthened)(input)?.currentStatus).toBe(
    'met',
  );
});

for (const order of [0, undefined]) {
  test(`replacement preview keeps ${order === undefined ? 'unknown' : 'tied'} recorded order before a later prerequisite feat`, () => {
    const snapshot = selectionSheet([{ feat: 'foundation' }]);
    const dependent = snapshot.entries.find((entry) => entry.kind === 'feat');
    const definition = snapshot.catalogEntries.at(-1);
    if (!dependent || !definition) throw new Error('Missing Selection');
    const foundationDefinition = {
      ...definition,
      _id: 'foundation-catalog' as typeof definition._id,
      ruleIdentity: 'foundation',
      name: 'Foundation',
      prerequisites: [],
    };
    const foundation = {
      ...dependent,
      _id: 'foundation-entry' as typeof dependent._id,
      catalogEntryId: foundationDefinition._id,
      choiceOrder: order,
      selectionSlot: { id: 'feat:general', position: 1 },
    };
    const entries = [
      ...snapshot.entries.map((entry) =>
        entry._id === dependent._id
          ? { ...dependent, choiceOrder: order }
          : entry,
      ),
      foundation,
    ];
    const catalogEntries = [...snapshot.catalogEntries, foundationDefinition];
    const updated = {
      ...snapshot,
      entries,
      catalogEntries,
      calculated: calculateCharacterSheet({
        entries,
        catalogEntries,
        characterKind: 'pc',
      }),
    };
    expect(
      previewSelectionSlot(updated, {
        slotId: 'feat:general',
        position: 0,
        catalogEntryId: definition._id,
      }),
    ).toMatchObject({ currentStatus: 'met', recordedStatus: 'unmet' });
  });
}

for (const sourceKind of ['selectionSource', 'state.slot'] as const) {
  test(`a legacy bonus feat with ${sourceKind} reports its prerequisite exemption without slot placement metadata`, () => {
    const snapshot = selectionSheet([{ ability: 'strength', min: 99 }]);
    const base = snapshot.entries.find((entry) => entry.kind === 'base');
    const feat = snapshot.entries.find((entry) => entry.kind === 'feat');
    if (!base || !feat) throw new Error('Missing base or feat');
    const source = {
      kind: 'slot' as const,
      grantedBy: { kind: 'entry' as const, entryId: base._id },
      slotIndex: 0,
    };
    const { selectionSlot: _slot, ...legacy } = feat;
    const entries = snapshot.entries.map((entry) =>
      entry._id === feat._id
        ? {
            ...legacy,
            ...(sourceKind === 'selectionSource'
              ? { selectionSource: source }
              : { state: { ...feat.state, slot: source } }),
          }
        : entry,
    );
    const catalogEntries = snapshot.catalogEntries.map((definition) =>
      definition._id === base.catalogEntryId
        ? {
            ...definition,
            grantsSlots: [
              { kind: 'feat' as const, count: 1, ignoresPrerequisites: true },
            ],
          }
        : definition,
    );
    const updated = {
      ...snapshot,
      entries,
      catalogEntries,
      calculated: calculateCharacterSheet({
        entries,
        catalogEntries,
        characterKind: 'pc',
      }),
    };
    expect(buildCharacterSheetSelectionsView(updated).rows[0]).toMatchObject({
      currentStatus: 'exempt',
      recordedStatus: 'exempt',
      checks: [],
      currentWarnings: [],
      recordedWarnings: [],
    });
  });
}

type StructuredClassDefinition = Extract<
  CharacterSheetSnapshot['catalogEntries'][number],
  { detail: { kind: 'class'; hitDie: number } }
>;

function isStructuredClassDefinition(
  definition: CharacterSheetSnapshot['catalogEntries'][number],
): definition is StructuredClassDefinition {
  return (
    definition.detail.kind === 'class' &&
    'hitDie' in definition.detail &&
    typeof definition.detail.hitDie === 'number'
  );
}

test('a generated class feature bonus slot keeps its prerequisite exemption in the selection view', () => {
  const snapshot = selectionSheet([{ ability: 'strength', min: 99 }]);
  snapshot.catalogEntries = [
    ...snapshot.catalogEntries,
    ...buildSheet({ hasClasses: true }).catalogEntries.filter(
      (definition) => definition.detail.kind === 'class',
    ),
  ];
  const fighter = snapshot.catalogEntries.find(
    (definition) => definition.name === 'Fighter',
  );
  const wizard = snapshot.catalogEntries.find(
    (definition) => definition.name === 'Wizard',
  );
  const feat = snapshot.entries.find((entry) => entry.kind === 'feat');
  if (!fighter || !wizard || !feat)
    throw new Error('Missing fixture definitions');
  const catalogEntries = snapshot.catalogEntries.map((definition) =>
    definition._id === fighter._id && isStructuredClassDefinition(definition)
      ? {
          ...definition,
          detail: {
            ...definition.detail,
            featuresByLevel: [{ classLevel: 1, catalogEntryId: wizard._id }],
          },
        }
      : definition._id === wizard._id
        ? {
            ...definition,
            detail: { kind: 'classFeature' as const },
            grantsSlots: [
              { kind: 'feat' as const, count: 1, ignoresPrerequisites: true },
            ],
          }
        : definition,
  );
  const classEntries = snapshot.entries.map((entry) =>
    entry.kind === 'classLevel'
      ? { ...entry, state: { ...entry.state, classEntryId: fighter._id } }
      : entry,
  );
  const prepared = calculateCharacterSheet({
    entries: classEntries,
    catalogEntries,
    characterKind: 'pc',
  });
  const slot = prepared.selectionRules.slots.find(
    (slot) => slot.grantedBy?.kind === 'grant',
  );
  if (!slot || slot.grantedBy?.kind !== 'grant')
    throw new Error('Missing generated slot');
  const grantSource = slot.grantedBy;
  const entries = classEntries.map((entry) =>
    entry.kind === 'feat'
      ? {
          ...entry,
          selectionSlot: { id: slot.id, position: 0 },
          selectionSource: {
            kind: 'slot' as const,
            grantedBy: grantSource,
            slotIndex: 0,
          },
        }
      : entry,
  );
  const updated = {
    ...snapshot,
    entries,
    catalogEntries,
    calculated: calculateCharacterSheet({
      entries,
      catalogEntries,
      characterKind: 'pc',
    }),
  };
  expect(entries.some((entry) => entry.kind === 'classFeature')).toBe(false);
  expect(buildCharacterSheetSelectionsView(updated).rows[0]).toMatchObject({
    currentStatus: 'exempt',
    recordedStatus: 'exempt',
    checks: [],
  });
});

test('all dated Selection kinds share one level order with earlier and later controls', () => {
  const snapshot = selectionSheet([{ ability: 'strength', min: 13 }]);
  const feat = snapshot.entries.find((entry) => entry.kind === 'feat');
  if (!feat) throw new Error('Missing feat');
  const definition = snapshot.catalogEntries.at(-1)!;
  const featureDefinition = {
    ...definition,
    _id: 'feature-catalog' as typeof definition._id,
    name: 'Combat talent',
    ruleIdentity: 'combat-talent',
    detail: { kind: 'classFeature' as const },
  };
  const feature = {
    ...feat,
    _id: 'feature-entry' as typeof feat._id,
    catalogEntryId: featureDefinition._id,
    kind: 'classFeature' as const,
    state: { kind: 'classFeature' as const },
    choiceOrder: 1,
  };
  const entries = [...snapshot.entries, feature];
  const catalogEntries = [...snapshot.catalogEntries, featureDefinition];
  const view = buildCharacterSheetSelectionsView({
    ...snapshot,
    entries,
    catalogEntries,
    calculated: calculateCharacterSheet({
      entries,
      catalogEntries,
      characterKind: 'pc',
    }),
  });
  expect(view.rows.map((row) => row.kind)).toEqual(['feat']);
  expect(view.allRows.find((row) => row.entryId === feat._id)).toMatchObject({
    canMoveEarlier: false,
    canMoveLater: true,
    orderPosition: 1,
    orderCount: 2,
  });
  expect(view.allRows.find((row) => row.entryId === feature._id)).toMatchObject(
    {
      kind: 'classFeature',
      canMoveEarlier: true,
      canMoveLater: false,
      orderPosition: 2,
      orderCount: 2,
      recordedLevelLabel: 'Prerequisites at recorded level 1',
      currentStatus: 'unmet',
      recordedStatus: 'unmet',
    },
  );
  const featureRow = view.allRows.find((row) => row.entryId === feature._id)!;
  expect(featureRow.currentWarnings).toHaveLength(1);
  expect(featureRow.recordedWarnings).toHaveLength(1);
});

test('generic Selection rows expose separately accepted prerequisite groups', () => {
  const snapshot = selectionSheet([{ ability: 'strength', min: 13 }]);
  const selected = snapshot.entries.find((entry) => entry.kind === 'feat')!;
  const definition = snapshot.catalogEntries.at(-1)!;
  const entries = snapshot.entries.map((entry) =>
    entry._id === selected._id
      ? {
          ...selected,
          kind: 'classFeature' as const,
          state: { kind: 'classFeature' as const },
        }
      : entry,
  );
  const catalogEntries = snapshot.catalogEntries.map((catalog) =>
    catalog._id === definition._id
      ? { ...definition, detail: { kind: 'classFeature' as const } }
      : catalog,
  );
  const calculated = calculateCharacterSheet({
    entries,
    catalogEntries,
    characterKind: 'pc',
  });
  const recordedWarning = calculated.warnings.find(
    (warning) => warning.check === 'prerequisites.recordedLevel',
  )!;
  const view = buildCharacterSheetView({
    ...snapshot,
    entries,
    catalogEntries,
    calculated,
    acceptedWarnings: buildSheet({ accepted: [recordedWarning] })
      .acceptedWarnings,
  });
  const row = view.grants.find((section) => section.kind === 'classFeature')!
    .rows[0]!;
  expect(
    row.selection?.currentWarnings.map((warning) => warning.accepted),
  ).toEqual([false]);
  expect(
    row.selection?.recordedWarnings.map((warning) => warning.accepted),
  ).toEqual([true]);
  expect(row.selection?.currentChecks.map((check) => check.label)).toEqual([
    'Strength 13',
  ]);
  expect(row.selection?.recordedChecks.map((check) => check.label)).toEqual([
    'Strength 13',
  ]);
  expect(
    row.selection?.otherWarnings.some((warning) =>
      warning.check.startsWith('prerequisites.'),
    ),
  ).toBe(false);
});

test('a feature granted by a dated Selection keeps its source’s recorded prerequisite group without being exempt', () => {
  const snapshot = selectionSheet();
  const feat = snapshot.entries.find((entry) => entry.kind === 'feat')!;
  const definition = snapshot.catalogEntries.at(-1)!;
  const grantedDefinition = {
    ...definition,
    _id: 'granted-feature-catalog' as typeof definition._id,
    name: 'Granted training',
    ruleIdentity: 'granted-training',
    detail: { kind: 'classFeature' as const },
    prerequisites: [{ ability: 'strength' as const, min: 13 }],
  };
  const catalogEntries = [
    ...snapshot.catalogEntries.map((entry) =>
      entry._id === definition._id
        ? { ...definition, grants: [{ catalogEntryId: grantedDefinition._id }] }
        : entry,
    ),
    grantedDefinition,
  ];
  const calculated = calculateCharacterSheet({
    entries: snapshot.entries,
    catalogEntries,
    characterKind: 'pc',
  });
  const view = buildCharacterSheetSelectionsView({
    ...snapshot,
    catalogEntries,
    calculated,
  });
  const row = view.allRows.find((row) => row.kind === 'classFeature')!;
  expect(row).toMatchObject({
    origin: 'grant',
    entryId: null,
    currentStatus: 'unmet',
    recordedStatus: 'unmet',
    recordedLevelLabel: 'Prerequisites at recorded level 1',
    canMoveEarlier: false,
    canMoveLater: false,
  });
  expect(row.currentWarnings).toHaveLength(1);
  expect(row.recordedWarnings).toHaveLength(1);
  expect(view.allRows.find((row) => row.entryId === feat._id)?.orderCount).toBe(
    1,
  );
});

test.each(selectableCatalogSheetEntryKinds)(
  '%s Selections have ordering only when they are dated prerequisite inputs',
  (kind) => {
    const snapshot = selectionSheet();
    const feat = snapshot.entries.find((entry) => entry.kind === 'feat')!;
    const definition = snapshot.catalogEntries.at(-1)!;
    const common = {
      ...definition,
      _id: 'other-catalog' as typeof definition._id,
      ruleIdentity: 'other-rule',
      modifiers: [],
    };
    const definitions = {
      race: { ...common, detail: { kind: 'race', racialTraits: [] } },
      racialTrait: {
        ...common,
        detail: { kind: 'racialTrait', raceEntryIds: [], replaces: [] },
      },
      archetype: {
        ...common,
        detail: {
          kind: 'archetype',
          classEntryIds: [],
          replaces: [],
          adds: [],
        },
      },
      classFeature: { ...common, detail: { kind: 'classFeature' } },
      feat: { ...common, detail: { kind: 'feat' } },
      trait: { ...common, detail: { kind: 'trait' } },
      manual: { ...common, detail: { kind: 'manual' } },
      item: { ...common, detail: { kind: 'item', consumable: false } },
      spell: { ...common, detail: { kind: 'spell' } },
      spellEffect: {
        ...common,
        detail: {
          kind: 'spellEffect',
          lastsOverOneDay: false,
          defaultCasterLevel: 1,
        },
      },
      condition: { ...common, detail: { kind: 'condition' } },
    } satisfies Record<
      typeof kind,
      CharacterSheetSnapshot['catalogEntries'][number]
    >;
    const addedDefinition = definitions[kind];
    const other = {
      ...feat,
      ...createCatalogSheetEntryState({ kind }),
      _id: 'other-entry' as typeof feat._id,
      catalogEntryId: addedDefinition._id,
      choiceOrder: 1,
    };
    const entries = [...snapshot.entries, other];
    const catalogEntries = [...snapshot.catalogEntries, addedDefinition];
    const view = buildCharacterSheetSelectionsView({
      ...snapshot,
      entries,
      catalogEntries,
      calculated: calculateCharacterSheet({
        entries,
        catalogEntries,
        characterKind: 'pc',
      }),
    });
    const isUndated = [
      'race',
      'manual',
      'item',
      'spellEffect',
      'condition',
    ].includes(kind);
    expect(view.allRows.find((row) => row.entryId === other._id)).toMatchObject(
      {
        kind,
        canMoveEarlier: !isUndated,
        canMoveLater: false,
        orderPosition: isUndated ? null : 2,
        orderCount: isUndated ? 0 : 2,
      },
    );
    expect(
      view.allRows.find((row) => row.entryId === feat._id)?.orderCount,
    ).toBe(isUndated ? 1 : 2);
  },
);

test('an unusable recorded level keeps current checks and omits ordering and the recorded group', () => {
  const snapshot = selectionSheet([{ ability: 'strength', min: 13 }]);
  const entries = snapshot.entries.map((entry) =>
    entry.kind === 'feat'
      ? {
          ...entry,
          gainedAtClassLevel:
            'deleted-level' as typeof entry.gainedAtClassLevel,
        }
      : entry,
  );
  const view = buildCharacterSheetSelectionsView({
    ...snapshot,
    entries,
    calculated: calculateCharacterSheet({
      entries,
      catalogEntries: snapshot.catalogEntries,
      characterKind: 'pc',
    }),
  });
  expect(view.rows[0]).toMatchObject({
    currentStatus: 'unmet',
    recordedStatus: null,
    recordedLevelLabel: null,
    canMoveEarlier: false,
    canMoveLater: false,
    recordedChecks: [],
    recordedWarnings: [],
  });
});

test('the first prestige row exposes entry prerequisite groups while later levels omit them', () => {
  const snapshot = buildSheet({
    hasClasses: true,
    levels: [
      { id: 'prestige-1', hp: null, classId: 'fighter' },
      { id: 'prestige-2', hp: null, classId: 'fighter' },
    ],
  });
  const catalogEntries = snapshot.catalogEntries.map((definition) =>
    definition.detail.kind === 'class' &&
    'classKind' in definition.detail &&
    definition.name === 'Fighter'
      ? {
          ...definition,
          modifiers: [],
          detail: { ...definition.detail, classKind: 'prestige' as const },
          prerequisites: [{ ability: 'strength' as const, min: 13 }],
        }
      : definition,
  );
  const calculated = calculateCharacterSheet({
    entries: snapshot.entries,
    catalogEntries,
    characterKind: 'pc',
  });
  const view = buildCharacterSheetView({
    ...snapshot,
    catalogEntries,
    calculated,
  });
  expect(view.levels[0]?.prerequisites).toMatchObject({
    currentStatus: 'unmet',
    recordedStatus: 'unmet',
    recordedLevelLabel: 'Prerequisites at recorded level 1',
  });
  expect(view.levels[1]?.prerequisites).toMatchObject({
    currentChecks: [],
    recordedChecks: [],
    recordedLevelLabel: null,
  });
});

// #753: a feat the Character's sheet doesn't hold yet, such as the active
// Catalog Release's admitted Skill Focus (Acrobatics) on its global identity,
// reaches the feat picker through the read's catalog choices
// (`readCatalogChoices`), already projected through the selected release.
type CatalogEntry = CharacterSheetSnapshot['catalogEntries'][number];
function releaseChoices(snapshot: CharacterSheetSnapshot): CatalogEntry[] {
  const base = snapshot.baseScoresEntry;
  const definition = (
    id: string,
    name: string,
    modifiers: CatalogEntry['modifiers'] = [],
  ): CatalogEntry => ({
    ...base,
    _id: id as typeof base._id,
    scope: 'global',
    characterId: undefined,
    name,
    ruleIdentity: `pf1-content/${id}`,
    modifiers,
    detail: { kind: 'feat', featTypes: ['General'], repeatable: 'unreviewed' },
  });
  return [
    // The release body (CRB p. 134, #724), not the global stand-in's [].
    definition('global-skill-focus', 'Skill Focus (Acrobatics)', [
      {
        target: 'skill.acr',
        bonusType: 'untyped',
        value: { formula: '3 + 3 * min(1, floor(@skillRanks.acr / 10))' },
      },
    ]),
    definition('global-held', 'Retired Feat'),
    // Not a feat or trait: never a selection candidate.
    { ...base, _id: 'global-other' as typeof base._id, scope: 'global' },
  ];
}

test('with the read’s catalog choices the feat picker offers exactly them: the sheet’s version for the same ID, held ones unavailable, no original beside its preferred campaign copy, and no global the read left out', () => {
  const sheet = buildSheet();
  const base = sheet.baseScoresEntry;
  const feat = (
    id: string,
    name: string,
    extra: Partial<CatalogEntry> = {},
  ): CatalogEntry =>
    ({
      ...base,
      _id: id as typeof base._id,
      name,
      ruleIdentity: id,
      modifiers: [],
      detail: { kind: 'feat', featTypes: ['combat'], repeatable: 'no' },
      ...extra,
    }) as CatalogEntry;
  // A representative seed: a definition of the Character's own.
  const own = feat('own-dodge', 'Dodge');
  // Globals the sheet holds only by reference (an existing Selection, a
  // copied parent). The read leaves them out: not admitted by the active
  // release, or replaced by the campaign's preferred copy.
  const unadmitted = feat('sheet-global', 'Unadmitted Feat', {
    scope: 'global',
    characterId: undefined,
  });
  const original = feat('replaced-global', 'Cleave', {
    scope: 'global',
    characterId: undefined,
  });
  const copy = feat('campaign-copy', 'Cleave (Ironfang drill)', {
    scope: 'campaign',
    characterId: undefined,
    campaignId: 'campaign-1' as CatalogEntry['campaignId'],
    copiedFrom: original._id,
    campaignPreference: true,
  });
  const snapshot = {
    ...sheet,
    catalogEntries: [...sheet.catalogEntries, own, unadmitted, original],
    catalogView: {
      releaseNumber: 1,
      heldDefinitionIds: ['global-held'],
    },
  } as CharacterSheetSnapshot;
  const choices = [
    // The read lists the Character's own definitions, as it found them.
    ...snapshot.catalogEntries
      .filter((entry) => entry.scope === 'character')
      .map((entry) =>
        entry._id === own._id ? { ...own, name: 'Stale' } : entry,
      ),
    ...releaseChoices(snapshot),
    copy,
    // Even listed beside its preferred copy, the original is not offered.
    original,
  ];
  const { candidates } = buildCharacterSheetSelectionsView(snapshot, choices);
  const offered = (id: string) =>
    candidates.filter((row) => row.catalogEntryId === id);
  expect(offered('global-skill-focus')).toEqual([
    expect.objectContaining({
      name: 'Skill Focus (Acrobatics)',
      unavailableReason: null,
    }),
  ]);
  expect(offered('global-held')[0]?.unavailableReason).toEqual(
    expect.any(String),
  );
  expect(offered('global-other')).toEqual([]);
  expect(offered(own._id)).toEqual([
    expect.objectContaining({ name: 'Dodge' }),
  ]);
  expect(offered(copy._id)).toEqual([
    expect.objectContaining({ name: 'Cleave (Ironfang drill)' }),
  ]);
  expect(offered(original._id)).toEqual([]);
  expect(offered(unadmitted._id)).toEqual([]);
  // The representative seeds the sheet offered stay offered.
  const seeds = buildCharacterSheetSelectionsView(snapshot).candidates.filter(
    (row) => ![unadmitted._id, original._id].includes(row.catalogEntryId),
  );
  expect(seeds.length).toBeGreaterThan(0);
  for (const seed of seeds)
    expect(offered(seed.catalogEntryId)).toHaveLength(1);
  // The full sheet view passes its catalog choices on.
  expect(
    buildCharacterSheetView(snapshot, choices).selections.candidates,
  ).toEqual(candidates);
});

test('while the catalog choices are loading the picker offers the sheet’s own definitions, as before', () => {
  const snapshot = selectionSheet();
  const { candidates } = buildCharacterSheetSelectionsView(snapshot);
  expect(candidates.length).toBeGreaterThan(0);
  expect(buildCharacterSheetView(snapshot).selections.candidates).toEqual(
    candidates,
  );
  expect(
    buildCharacterSheetSelectionsView(snapshot, undefined).candidates,
  ).toEqual(candidates);
});

test('a catalog-choice feat previews in its slot, and its release body gives +3 Acrobatics at 0 ranks', () => {
  const snapshot = buildSheet();
  const choices = releaseChoices(snapshot);
  const input = {
    slotId: 'feat:general',
    position: 0,
    catalogEntryId:
      'global-skill-focus' as CharacterSheetSnapshot['catalogEntries'][number]['_id'],
  };
  expect(previewSelectionSlot(snapshot, input)).toBeNull();
  expect(previewSelectionSlot(snapshot, input, choices)).toMatchObject({
    name: 'Skill Focus (Acrobatics)',
    isSelectable: true,
  });
  expect(createSelectionSlotPreview(snapshot, choices)(input)).toMatchObject({
    name: 'Skill Focus (Acrobatics)',
  });
  // Saved, the sheet calculates the release body: CRB p. 134 via #724.
  const feat = choices[0]!;
  const entries = [
    ...snapshot.entries,
    {
      ...snapshot.entries[0]!,
      _id: 'release-feat' as CharacterSheetSnapshot['entries'][number]['_id'],
      kind: 'feat' as const,
      active: true,
      catalogEntryId: feat._id,
      state: { kind: 'feat' as const, choice: null, slot: 'general' as const },
      selectionSlot: { id: 'feat:general', position: 0 },
    },
  ];
  const before = calculateCharacterSheet({
    entries: snapshot.entries,
    catalogEntries: snapshot.catalogEntries,
    characterKind: 'pc',
  });
  const after = calculateCharacterSheet({
    entries,
    catalogEntries: [...snapshot.catalogEntries, feat],
    characterKind: 'pc',
  });
  expect(before.breakdowns['skill.acr']?.total).toBe(0);
  expect(after.breakdowns['skill.acr']?.total).toBe(3);
});

test.each([null, '', '   ', 'Fireball'])(
  'Magical Lineage identifies the chosen-spell presentation by rule identity with choice %j',
  (choice) => {
    const snapshot = selectionSheet();
    const original = snapshot.catalogEntries.at(-1)!;
    const catalogEntries = snapshot.catalogEntries.map((catalog) =>
      catalog === original
        ? { ...catalog, ...magicalLineage, name: 'Family spell' }
        : catalog,
    );
    const entries = snapshot.entries.map((entry) =>
      entry.kind === 'feat'
        ? {
            ...entry,
            kind: 'trait' as const,
            state: { kind: 'trait' as const, choice },
          }
        : entry,
    );
    const sheet = {
      ...snapshot,
      entries,
      catalogEntries,
      calculated: calculateCharacterSheet({
        entries,
        catalogEntries,
        characterKind: 'pc',
      }),
    };
    expect(buildCharacterSheetSelectionsView(sheet).rows[0]).toMatchObject({
      name: 'Family spell',
      choice,
      choiceLabel: 'Chosen spell',
      choiceIncomplete: choice !== 'Fireball',
      choiceGuidance: 'Apply the metamagic adjustment manually.',
    });
    const unrelatedCatalog = catalogEntries.map((catalog) =>
      catalog._id === original._id
        ? {
            ...catalog,
            name: 'Magical Lineage',
            ruleIdentity: 'homebrew/family-spell',
          }
        : catalog,
    );
    expect(
      buildCharacterSheetSelectionsView({
        ...sheet,
        catalogEntries: unrelatedCatalog,
      }).rows[0],
    ).toMatchObject({
      choiceLabel: 'Choice',
      choiceIncomplete: false,
      choiceGuidance: '',
    });
  },
);
