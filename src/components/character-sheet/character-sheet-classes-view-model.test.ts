import { expect, test } from 'vitest';
import {
  buildSheet,
  calculateFixtureSheet as calculateCharacterSheet,
  isClassCatalogEntry,
  withClasses,
} from './character-sheet-test-fixture';
import { buildCharacterSheetClassesView } from './character-sheet-classes-view-model';

test('the Prestige Class picker checks entry before its first-level base attack bonus and keeps an unmet class selectable', () => {
  const snapshot = buildSheet({
    levels: [{ id: 'fighter-1', hp: 10, classId: 'fighter' }],
  });
  const fighter = snapshot.catalogEntries.find(
    (entry) => isClassCatalogEntry(entry) && entry.ruleIdentity === 'fighter',
  );
  if (!fighter || !isClassCatalogEntry(fighter))
    throw new Error('Missing Fighter');
  const prestige = {
    ...fighter,
    _id: 'prestige' as typeof fighter._id,
    name: 'Prestige example',
    ruleIdentity: 'prestige-example',
    detail: { ...fighter.detail, classKind: 'prestige' as const },
    prerequisites: [{ bab: 2 }],
  };
  const view = buildCharacterSheetClassesView(snapshot, [prestige]);
  expect(
    view.choices.find((choice) => choice.classEntryId === prestige._id),
  ).toMatchObject({
    name: 'Prestige example',
    classKind: 'prestige',
    entryRequirements: {
      status: 'unmet',
      label: 'Entry requirements not met',
      checks: [{ label: 'BAB +2', met: false }],
    },
  });
});

test('a Rogue Class Level offers the original and Unchained versions and retains distinct catalog choices', () => {
  const snapshot = buildSheet({
    levels: [{ id: 'rogue-1', hp: 8, classId: 'rogue' }],
  });
  const rogue = snapshot.catalogEntries.find(
    (entry) => isClassCatalogEntry(entry) && entry.ruleIdentity === 'rogue',
  );
  if (!rogue || !isClassCatalogEntry(rogue)) throw new Error('Missing Rogue');
  const unchained = {
    ...rogue,
    _id: 'unchained-rogue' as typeof rogue._id,
    name: 'Rogue (Unchained)',
    ruleIdentity: 'unchained-rogue',
    detail: { ...rogue.detail, counterpartOf: rogue._id },
  };
  const view = buildCharacterSheetClassesView(snapshot, [unchained]);
  expect(
    view.choices.filter((choice) => choice.name.includes('Rogue')),
  ).toHaveLength(2);
  expect(
    view.rulesChoicesFor(
      snapshot.entries.find((entry) => entry.kind === 'classLevel')!._id,
    ),
  ).toMatchObject([
    { classEntryId: rogue._id, version: 'original', inUse: true },
    { classEntryId: unchained._id, version: 'unchained', inUse: false },
  ]);
});

test('an existing Prestige Class distinguishes entry at its recorded first level from later qualification without changing the sheet', () => {
  const initial = buildSheet({
    levels: [
      { id: 'early-entry', hp: 10, classId: 'fighter' },
      { id: 'later-level', hp: 10, classId: 'fighter' },
    ],
  });
  const fighter = initial.catalogEntries.find(
    (entry) => isClassCatalogEntry(entry) && entry.ruleIdentity === 'fighter',
  );
  if (!fighter || !isClassCatalogEntry(fighter))
    throw new Error('Missing Fighter');
  const prestige = {
    ...fighter,
    _id: 'prestige' as typeof fighter._id,
    ruleIdentity: 'prestige',
    name: 'Prestige example',
    detail: { ...fighter.detail, classKind: 'prestige' as const },
    prerequisites: [{ bab: 2 }],
  };
  const entries = initial.entries.map((entry) =>
    entry.kind === 'classLevel' && entry._id === 'early-entry'
      ? { ...entry, state: { ...entry.state, classEntryId: prestige._id } }
      : entry,
  );
  const catalogEntries = [...initial.catalogEntries, prestige];
  const snapshot = {
    ...initial,
    entries,
    catalogEntries,
    calculated: calculateCharacterSheet({
      entries,
      catalogEntries,
      characterKind: 'pc',
    }),
  };
  const before = structuredClone(snapshot);
  const choice = buildCharacterSheetClassesView(snapshot).choices.find(
    (choice) => choice.classEntryId === prestige._id,
  );
  expect(choice?.entryRequirements).toMatchObject({
    status: 'unmet',
    currentStatus: 'met',
    recordedLevelLabel: 'Prerequisites at recorded level 1',
  });
  expect(snapshot).toEqual(before);
});

test('class controls expose mixed-version, unmatched-replacement and original-Monk warnings with independent acceptance', () => {
  const initial = buildSheet({
    accepted: [
      {
        check: 'classVersions',
        subject: 'class:rogue',
        fingerprint: 'mixed-v1',
      },
    ],
  });
  const snapshot = {
    ...initial,
    calculated: {
      ...initial.calculated,
      warnings: [
        ...initial.calculated.warnings,
        {
          kind: 'rules' as const,
          check: 'classVersions' as const,
          subject: 'class:rogue',
          fingerprint: 'mixed-v1',
          target: { kind: 'classLevels' as const },
          message:
            'Original and Unchained versions of the same class are both present.',
        },
        {
          kind: 'rules' as const,
          check: 'archetypeReplacementUnmatched' as const,
          subject: 'scout:missing',
          fingerprint: 'replacement-v1',
          target: { kind: 'entry' as const, entryId: 'scout-selection' },
          message:
            'Scout: the replaced feature has no matching row in Rogue (Unchained).',
        },
        {
          kind: 'rules' as const,
          check: 'archetypeUnchainedMonk' as const,
          subject: 'monk-selection',
          fingerprint: 'monk-v1',
          target: { kind: 'entry' as const, entryId: 'monk-selection' },
          message:
            "This Archetype was written for the original class and cannot automatically replace this class's features.",
        },
      ],
    },
  };
  expect(buildCharacterSheetClassesView(snapshot).warnings).toMatchObject([
    { check: 'classVersions', accepted: true },
    { check: 'archetypeReplacementUnmatched', accepted: false },
    { check: 'archetypeUnchainedMonk', accepted: false },
  ]);
});

test('unmodeled Prestige entry stays readable prose without an invented failed status', () => {
  const snapshot = buildSheet({
    levels: [{ id: 'fighter-1', hp: 10, classId: 'fighter' }],
  });
  const fighter = snapshot.catalogEntries.find(
    (entry) => isClassCatalogEntry(entry) && entry.ruleIdentity === 'fighter',
  );
  if (!fighter || !isClassCatalogEntry(fighter))
    throw new Error('Missing Fighter');
  const prestige = {
    ...fighter,
    _id: 'prestige' as typeof fighter._id,
    ruleIdentity: 'prestige',
    detail: { ...fighter.detail, classKind: 'prestige' as const },
    prerequisites: [{ unchecked: 'Must have joined the guild.' }],
  };
  expect(
    buildCharacterSheetClassesView(snapshot, [prestige]).choices.find(
      (choice) => choice.classEntryId === prestige._id,
    )?.entryRequirements,
  ).toMatchObject({
    status: null,
    label: null,
    prerequisiteText: 'Must have joined the guild.',
    checks: [],
    warnings: [],
  });
});

test('changing an earlier Class Level previews Prestige entry at that position rather than after later Fighter levels', () => {
  const snapshot = buildSheet({
    levels: [
      { id: 'first', hp: 10, classId: 'fighter' },
      { id: 'later', hp: 10, classId: 'fighter' },
    ],
  });
  const fighter = snapshot.catalogEntries.find(
    (entry) => isClassCatalogEntry(entry) && entry.ruleIdentity === 'fighter',
  );
  if (!fighter || !isClassCatalogEntry(fighter))
    throw new Error('Missing Fighter');
  const prestige = {
    ...fighter,
    _id: 'prestige' as typeof fighter._id,
    ruleIdentity: 'prestige',
    detail: { ...fighter.detail, classKind: 'prestige' as const },
    prerequisites: [{ bab: 2 }],
  };
  const classes = buildCharacterSheetClassesView(snapshot, [prestige]);
  expect(
    classes.choices.find((choice) => choice.classEntryId === prestige._id)
      ?.entryRequirements?.status,
  ).toBe('met');
  const first = snapshot.entries.find((entry) => entry.kind === 'classLevel');
  if (!first) throw new Error('Missing Class Level');
  expect(classes.preview(prestige._id, first._id)).toMatchObject({
    status: 'unmet',
    recordedLevelLabel: 'Prerequisites at recorded level 1',
  });
});

test('generic Perform ranks cannot mark the exact Perform dance entry requirement met', () => {
  const snapshot = buildSheet({
    levels: [
      {
        id: 'bard-placeholder',
        hp: 10,
        classId: 'fighter',
        skillRanks: { 'skill.prf': 5 },
      },
    ],
  });
  const fighter = snapshot.catalogEntries.find(
    (entry) => isClassCatalogEntry(entry) && entry.ruleIdentity === 'fighter',
  );
  if (!fighter || !isClassCatalogEntry(fighter))
    throw new Error('Missing Fighter');
  const prestige = {
    ...fighter,
    _id: 'prestige' as typeof fighter._id,
    ruleIdentity: 'prestige',
    name: 'Shadowdancer requirement example',
    detail: { ...fighter.detail, classKind: 'prestige' as const },
    prerequisiteText: 'Perform (dance) 5 ranks.',
    prerequisites: [{ skillRanks: 'skill.prf.dance', min: 5 }],
  };
  expect(
    buildCharacterSheetClassesView(snapshot, [prestige]).choices.find(
      (choice) => choice.classEntryId === prestige._id,
    )?.entryRequirements,
  ).toMatchObject({
    status: null,
    label: null,
    prerequisiteText: 'Perform (dance) 5 ranks.',
    checks: [],
    warnings: [],
  });
});

test('an inactive Class Level previews Prestige entry at its recorded level without counting later levels or changing its active state', () => {
  const initial = withClasses(
    buildSheet({
      levels: [
        { id: 'first', hp: 10, classId: 'fighter' },
        { id: 'later', hp: 10, classId: 'fighter' },
      ],
    }),
    [
      {
        id: 'prestige',
        name: 'Prestige example',
        like: 'fighter',
        classKind: 'prestige',
        prerequisites: [{ bab: 1 }],
      },
    ],
  );
  const first = initial.entries.find((entry) => entry._id === 'first');
  const prestige = initial.catalogEntries.find(
    (entry) => entry._id === 'prestige',
  );
  if (first?.kind !== 'classLevel' || !prestige)
    throw new Error('Missing preview fixture');
  const snapshot = {
    ...initial,
    entries: initial.entries.map((entry) =>
      entry.kind === 'classLevel' && entry._id === first._id
        ? { ...entry, active: false }
        : entry,
    ),
  };
  const before = structuredClone(snapshot);
  expect(
    buildCharacterSheetClassesView(snapshot).preview(prestige._id, first._id),
  ).toMatchObject({
    status: 'unmet',
    recordedLevelLabel: 'Prerequisites at recorded level 1',
    checks: [{ label: 'BAB +1', met: false }],
    currentStatus: null,
  });
  expect(snapshot).toEqual(before);
});

test('Prestige choices and repeated previews share the entry result for each recorded position', () => {
  const snapshot = withClasses(
    buildSheet({
      levels: [
        { id: 'first', hp: 10, classId: 'fighter' },
        { id: 'later', hp: 10, classId: 'fighter' },
      ],
    }),
    [
      {
        id: 'prestige',
        name: 'Prestige example',
        like: 'fighter',
        classKind: 'prestige',
        prerequisites: [{ bab: 2 }],
      },
    ],
  );
  const view = buildCharacterSheetClassesView(snapshot);
  const choice = view.choices.find(
    (entry) => entry.classEntryId === 'prestige',
  );
  const first = snapshot.entries.find((entry) => entry._id === 'first');
  if (!choice || !first) throw new Error('Missing preview fixture');
  const appended = view.preview(choice.classEntryId);
  expect(appended?.status).toBe('met');
  expect(view.preview(choice.classEntryId)).toBe(appended);
  expect(choice.entryRequirements).toBe(appended);
  const recorded = view.preview(choice.classEntryId, first._id);
  expect(recorded?.status).toBe('unmet');
  expect(view.preview(choice.classEntryId, first._id)).toBe(recorded);
  expect(recorded).not.toBe(appended);
});

test('"Rules used" lists every copy of each version once per class, the row picker one card per class, and previews a version switch', () => {
  const snapshot = buildSheet({
    levels: [
      { id: 'rogue-1', hp: 8, classId: 'rogue' },
      { id: 'fighter-1', hp: 10, classId: 'fighter' },
      { id: 'rogue-2', hp: 6, classId: 'rogue' },
    ],
  });
  const rogue = snapshot.catalogEntries.find(
    (entry) => isClassCatalogEntry(entry) && entry.ruleIdentity === 'rogue',
  );
  if (!rogue || !isClassCatalogEntry(rogue)) throw new Error('Missing Rogue');
  // Pathfinder Unchained pp. 20–24, and the campaign's Customize copy.
  const unchained = {
    ...rogue,
    _id: 'unchained-rogue' as typeof rogue._id,
    name: 'Rogue (Unchained)',
    ruleIdentity: 'unchained-rogue',
    detail: { ...rogue.detail, counterpartOf: rogue._id },
  };
  const { characterId: _characterId, ...shared } = rogue;
  const campaignCopy = {
    ...shared,
    _id: 'rogue-campaign' as typeof rogue._id,
    scope: 'campaign' as const,
    campaignId: snapshot.character.campaignId,
    copiedFrom: rogue._id,
    campaignPreference: true as const,
  };
  const view = buildCharacterSheetClassesView(snapshot, [
    unchained,
    campaignCopy,
  ]);
  const rogueLevel = 'rogue-2' as (typeof snapshot.entries)[number]['_id'];
  expect(view.rulesChoicesFor(rogueLevel)).toMatchObject([
    {
      classEntryId: 'rogue-campaign',
      label: 'Rogue (campaign)',
      origin: 'campaign version',
      version: 'original',
      inUse: false,
    },
    {
      classEntryId: rogue._id,
      label: 'Rogue (this Character)',
      origin: 'this Character',
      version: 'original',
      inUse: true,
    },
    {
      classEntryId: 'unchained-rogue',
      version: 'unchained',
      inUse: false,
    },
  ]);
  expect(view.rulesChoicesFor('fighter-1' as typeof rogueLevel)).toEqual([]);
  expect(view.firstLevelOfClass(rogueLevel)).toBe('rogue-1');
  expect(view.firstLevelOfClass('fighter-1' as typeof rogueLevel)).toBe(
    'fighter-1',
  );
  // The picker offers the Rogue in use, never its campaign copy beside it.
  expect(
    view.choices
      .filter((choice) => choice.name === 'Rogue')
      .map((choice) => choice.classEntryId),
  ).toEqual([rogue._id]);
  const preview = view.previewDefinitionSwitch(rogueLevel, unchained._id);
  expect(preview?.levelIds).toEqual(['rogue-1', 'rogue-2']);
  expect(view.previewDefinitionSwitch(rogueLevel, unchained._id)).toBe(preview);
});
