import {
  bindingKey,
  collectCurationInputs,
  hashText,
  noteTargetAliases,
  type CurationData,
  type CurationRecord,
} from './curation.ts';
import {
  findRaceAbilityTraitRule,
  findRacialTraitRules,
  matchesRawChange,
  proseAbilityLineReason,
  unmappedAbilityChangesReason,
  raceAbilityTraitKey,
  reviewedAbilityLineSubraces,
  reviewedDescriptionRehomes,
  reviewedRaceAbilityTraits,
  reviewedTraitNameAliases,
  reviewedUnresolvedAlternates,
  type DescriptionRehomeRule,
  type RaceAbilityTraitRule,
  type RacialTraitFact,
  type RacialTraitRule,
  type ReviewedRawChange,
} from './racial-trait-rules.ts';
import {
  sourceDescription,
  toExternalKey,
  uuidKey,
  type LoadedRecord,
  type SourceRecord,
  type Unsupported,
} from './records.ts';
import { readArray, readObject, readStrings, readText } from './values.ts';

// #719: the pf1-content racial traits pack binds a trait to its race only by
// folder: `<Core Races|Other Races>/<Race>/Standard`, or a flat `<Race>` folder
// whose records are standard unless they carry a "Replaced Trait(s)" header.
// A Foundry race record binds to the folder with exactly its name.

type RawChange = Record<string, unknown>;
/** Whether one raw change of a record maps to a Modifier on its own. */
export type MapsChange = (input: {
  record: SourceRecord;
  kind: 'race' | 'racialTrait';
  change: RawChange;
}) => boolean;
export type TraitPlacement = {
  /** Upstream keys of the races whose folder holds this trait. */
  races: string[];
  isStandard: boolean;
  /** Upstream keys of the same race's standard traits this alternate replaces. */
  replaces: string[];
  /** Replaced names left to the player: every name, when any is unmatched. */
  unresolvedReplacements: string[];
  /** Replaced names that match no standard trait of the race. */
  unmatched: string[];
  /** An alternate without a parseable "Replaced Trait(s)" header. */
  lacksHeader: boolean;
  /** The reviewed reason an unresolved alternate stays unresolved. */
  reason?: string;
};
/**
 * #721: a race's reviewed ability score trait. No pinned record holds it; it
 * carries the race record's own fixed ability changes.
 */
export type RaceAbilityTrait = {
  /** Stable identity, from the race's stable key. */
  key: string;
  name: string;
  /** Normalised names an alternate's header may give for it. */
  names: string[];
  race: LoadedRecord;
  /** The race's stable key. */
  raceKey: string;
  /** The race description's heading for the line it stands for. */
  heading: string;
  /** Indices of the race changes it carries, in record order. */
  indices: number[];
};
type AbilityTraitRow = {
  race: string;
  trait: string;
  evidence: RaceAbilityTraitRule['evidence'];
  pcgen: string;
  note?: string;
} & ({ status: 'applied' } | { status: 'stale' | 'unused'; reason: string });
type PlannedAbilityTrait =
  | { status: 'applied'; trait: RaceAbilityTrait; row: AbilityTraitRow }
  | { status: 'stale'; row: AbilityTraitRow };

/** The race changes a reviewed ability score trait carries, in record order. */
export function abilityTraitChanges({ race, indices }: RaceAbilityTrait) {
  const changes = readArray(race.record.system.changes).map(readObject);
  return indices.flatMap((index): RawChange[] => {
    const change = changes[index];
    return change ? [change] : [];
  });
}
type RaceRelocation = {
  standard: LoadedRecord[];
  /** Why the race links no standard trait. */
  unlinkedReason?: string;
  ownedChanges: Set<number>;
  relocated: {
    target: string;
    formula: string;
    type: string;
    traits: string[];
  }[];
  ownerlessNotes: string[];
  rehomedNotes: { target: string; trait: string }[];
  /** Trait notes a re-homed checked race note stands in for. */
  coveredTraitNotes: { trait: string; target: string; text: string }[];
  /** The owner's notes on that target that state other numbers: required. */
  uncoveredTraitNotes: { trait: string; target: string; text: string }[];
  staleNotes: { target: string; reason: string }[];
  weaponProf: 'none' | 'owned' | 'ownerless';
  unmatchedTraitNames: string[];
  abilityTrait?: RaceAbilityTrait;
  abilityTraitRow?: AbilityTraitRow;
};
export type RacialTraitPlan = ReturnType<typeof planRacialTraits>;
type StableKeyOf = (upstreamKey: string) => string;

const replacedHeader =
  /<strong>\s*Replaced\s+Traits?\s*(?:\(s\))?\s*<\/strong>\s*:?\s*([\s\S]*?)(?:<br\s*\/?>|<\/p>|<hr)/i;
const uuidLink = /@UUID\[([^\]]+)\](?:\{([^}]*)\})?/g;
const abilityTargets = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha']);
const raceGroups = ['Core Races', 'Other Races'];

function isTraitRecord(source: LoadedRecord) {
  return source.repo === 'pf1-content' && source.pack === 'pf-racial-traits';
}
function isFolder(source: LoadedRecord) {
  return source.record._key.startsWith('!folders!');
}
function toPlainText(html: string) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&rsquo;/g, "'");
}
/** A name without its trailing `(Race)` or `(Race - Subrace)` label. */
function withoutLabel(name: string) {
  return name.replace(/\s*\([^)]*\)\s*$/, '');
}
/** A trait name without its trailing `(Race)` or `(Race - Subrace)` label. */
export function normalizeTraitName(name: string) {
  return withoutLabel(toPlainText(name))
    .replace(/[.:]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
function hasReplacedHeader(source: LoadedRecord) {
  return /Replaced\s+Trait/i.test(sourceDescription(source.record));
}
/** Code-point order, so artifacts do not depend on the host locale. */
export function compare(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
function sortByKey(records: LoadedRecord[]) {
  return records.sort((left, right) =>
    compare(toExternalKey(left), toExternalKey(right)),
  );
}
function changesOn(trait: LoadedRecord, target: string) {
  return readArray(trait.record.system.changes)
    .map(readObject)
    .filter((change) => readText({ value: change.target }) === target);
}
function notesOf(trait: LoadedRecord) {
  return readArray(trait.record.system.contextNotes).map((value) => {
    const note = readObject(value);
    return {
      target: readText({ value: note.target }),
      text: readText({ value: note.text }),
    };
  });
}
/** The binding of a trait's raw note, as its curation input would carry it. */
function traitNoteBinding({
  trait,
  target,
  text,
}: {
  trait: string;
  target: string;
  text: string;
}) {
  return bindingKey({
    externalKey: trait,
    kind: 'note',
    target,
    textSha256: hashText(text),
  });
}

function indexFolders(loaded: LoadedRecord[]) {
  const folders = new Map<string, { name: string; parent?: string }>();
  for (const source of loaded)
    if (isTraitRecord(source) && isFolder(source))
      folders.set(source.record._id, {
        name: source.record.name,
        parent: source.record.folder ?? undefined,
      });
  const raceFolders = new Map<string, string>();
  for (const [id, folder] of folders) {
    const group = folder.parent ? folders.get(folder.parent) : undefined;
    if (group && !group.parent && raceGroups.includes(group.name))
      raceFolders.set(id, folder.name);
  }
  return { folders, raceFolders };
}

/** The race folder holding a trait and the folder directly below it. */
function placeInFolders(
  source: LoadedRecord,
  { folders, raceFolders }: ReturnType<typeof indexFolders>,
) {
  let below: string | undefined;
  let current = source.record.folder ?? undefined;
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    visited.add(current);
    if (raceFolders.has(current))
      return {
        raceFolder: current,
        subfolder: below ? folders.get(below)?.name : undefined,
      };
    below = current;
    current = folders.get(current)?.parent;
  }
  return undefined;
}

/**
 * #304: an alternate with any unmatched name imports with an empty
 * `replaces`; every name it gives is left for the player to resolve.
 */
function settleReplacements({
  replaces,
  names,
  unmatched,
  lacksHeader,
  reason,
}: {
  replaces: string[];
  names: string[];
  unmatched: string[];
  lacksHeader: boolean;
  reason?: string;
}): Omit<TraitPlacement, 'races' | 'isStandard'> {
  const isUnresolved = unmatched.length > 0;
  return {
    replaces: isUnresolved ? [] : [...replaces].sort(),
    unresolvedReplacements: isUnresolved ? names : [],
    unmatched,
    lacksHeader,
    ...(reason && (isUnresolved || lacksHeader) ? { reason } : {}),
  };
}

/** How an alternate's replaced names resolve against its race's traits. */
type NameIndex = {
  /** Normalised name to trait key: records, reviewed aliases, new traits. */
  byName: ReadonlyMap<string, string>;
  /** The race's standard trait records, for `@UUID` links. */
  standard: LoadedRecord[];
  /** Ability score traits, which only mapped ability changes replace. */
  abilityTraits: ReadonlySet<string>;
};
/** #721: an alternate's own ability changes, raw or curated. */
type AbilityChanges = 'mapped' | 'unmapped' | 'none';
type AlternateFacts = {
  abilityChanges: AbilityChanges;
  /** The key its "Base Statistics" stands for (#721 heritage subraces). */
  baseStatistics?: string;
  /** A reviewed reason it stays unresolved. */
  reviewedReason?: string;
};

/**
 * #721: a name that stands for an ability score trait resolves only when the
 * alternate's own ability changes map, so no base adjustment goes dormant
 * without its replacement. Otherwise it stays unmatched, with this reason.
 */
function blockedReason(key: string, index: NameIndex, facts: AlternateFacts) {
  if (!index.abilityTraits.has(key) || facts.abilityChanges === 'mapped')
    return undefined;
  return facts.abilityChanges === 'none'
    ? proseAbilityLineReason
    : unmappedAbilityChangesReason;
}

/** Each name an alternate gives, with the trait keys it stands for. */
type ReplacedName = { name: string; keys: string[] };

/** The names of a "Replaced Trait(s)" header and its `@UUID` links. */
function headerNames({
  header,
  index,
  byName,
}: {
  header: string;
  index: NameIndex;
  byName: ReadonlyMap<string, string>;
}) {
  const standardKeys = new Set(index.standard.map(toExternalKey));
  const named: ReplacedName[] = [];
  const text = header.replace(
    uuidLink,
    (_link: string, uuid: string, label: string | undefined) => {
      const linked = uuidKey(uuid);
      if (!linked || !standardKeys.has(linked)) return label ?? '';
      const record = index.standard.find(
        (trait) => toExternalKey(trait) === linked,
      );
      named.push({
        name: label ?? record?.record.name ?? linked,
        keys: [linked],
      });
      return ',';
    },
  );
  for (const part of toPlainText(text).split(/[,;]/)) {
    const label = part
      .replace(/^\s*and\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\.$/, '');
    const name = normalizeTraitName(label);
    if (!name) continue;
    const key = byName.get(name);
    // "A and B" names two traits unless "A and B" is itself one trait's name.
    const pieces = name.split(/\s+and\s+/);
    const keys = pieces.flatMap((piece) => byName.get(piece) ?? []);
    named.push({
      name: label,
      keys: key
        ? [key]
        : pieces.length > 1 && keys.length === pieces.length
          ? keys
          : [],
    });
  }
  return named;
}

function resolveReplacements({
  source,
  subfolder,
  index,
  facts,
}: {
  source: LoadedRecord;
  subfolder?: string;
  index: NameIndex;
  facts: AlternateFacts;
}) {
  const byName = new Map(index.byName);
  if (facts.baseStatistics) byName.set('base statistics', facts.baseStatistics);
  const header = replacedHeader.exec(sourceDescription(source.record))?.[1];
  // A Subrace Standard record without a header replaces the same-named trait.
  const isSubraceStandard = subfolder === 'Subrace Standard';
  const sameNamed = byName.get(normalizeTraitName(source.record.name));
  const named: ReplacedName[] = header
    ? headerNames({ header, index, byName })
    : [
        {
          name: source.record.name,
          keys: isSubraceStandard && sameNamed ? [sameNamed] : [],
        },
      ];
  const replaces = new Set<string>();
  const unmatched: string[] = [];
  let reason = facts.reviewedReason;
  for (const { name, keys } of named) {
    const blocked = keys.flatMap(
      (key) => blockedReason(key, index, facts) ?? [],
    );
    if (keys.length && !blocked.length)
      for (const key of keys) replaces.add(key);
    else if (header || isSubraceStandard) unmatched.push(name);
    reason = blocked[0] ?? reason;
  }
  return settleReplacements({
    replaces: [...replaces],
    names: named.map(({ name }) => name),
    unmatched,
    lacksHeader: !header && !replaces.size,
    ...(reason ? { reason } : {}),
  });
}

function describedTraitNames(race: LoadedRecord) {
  const description = sourceDescription(race.record);
  const start = description.search(/Racial Traits/i);
  if (start < 0) return [];
  return [
    ...description.slice(start).matchAll(/<strong>([^<]+?)<\/strong>/g),
  ].flatMap((match) => {
    const name = toPlainText(match[1] ?? '')
      .replace(/:\s*$/, '')
      .trim();
    return name ? [name] : [];
  });
}

/** The numbers and formulas a raw note states, without signs or roll brackets. */
function noteNumbers(text: string) {
  return [
    ...new Set(
      [...text.matchAll(/\[\[([^\]]+)\]\]|(\d+)/g)].flatMap((match) => {
        const value = (match[1] ?? match[2] ?? '').replace(/^[+-]/, '').trim();
        return value ? [value] : [];
      }),
    ),
  ];
}

function isApplicable(record: CurationRecord) {
  return record.status === 'checked' || record.diagnostics.length === 0;
}

/** Which standard traits carry a change or a note on each raw target. */
function indexTraitOwners(standard: LoadedRecord[]) {
  const changeOwners = new Map<string, LoadedRecord[]>();
  const noteOwners = new Map<
    string,
    { trait: LoadedRecord; texts: string[] }[]
  >();
  for (const trait of standard) {
    for (const value of readArray(trait.record.system.changes)) {
      const target = readText({ value: readObject(value).target });
      const owners = changeOwners.get(target) ?? [];
      if (target && !owners.includes(trait))
        changeOwners.set(target, [...owners, trait]);
    }
    for (const { target, text } of notesOf(trait)) {
      const owners = noteOwners.get(target) ?? [];
      const owner = owners.find((candidate) => candidate.trait === trait);
      if (owner) owner.texts.push(text);
      else noteOwners.set(target, [...owners, { trait, texts: [text] }]);
    }
  }
  return { changeOwners, noteOwners };
}

/**
 * A race change whose target a standard trait's change also carries belongs to
 * that trait, which keeps its own version. When no owner's version maps, the
 * one owner receives the race's version; with several owners, no trait owns it
 * and it stays on the race, so relocation never drops a counted Modifier.
 */
function planRaceChanges({
  race,
  changeOwners,
  mapsChange,
  stableKeyOf,
}: {
  race: LoadedRecord;
  changeOwners: ReadonlyMap<string, LoadedRecord[]>;
  mapsChange: MapsChange;
  stableKeyOf: StableKeyOf;
}) {
  const ownedChanges = new Set<number>();
  const relocated: RaceRelocation['relocated'] = [];
  const moved = new Map<string, RawChange[]>();
  for (const [index, value] of readArray(
    race.record.system.changes,
  ).entries()) {
    const change = readObject(value);
    const target = readText({ value: change.target });
    const owners = changeOwners.get(target) ?? [];
    const [owner] = owners;
    if (!target || !owner) continue;
    const isMappedByOwner = owners.some((trait) =>
      changesOn(trait, target).some((own) =>
        mapsChange({ record: trait.record, kind: 'racialTrait', change: own }),
      ),
    );
    if (!isMappedByOwner && owners.length > 1) continue;
    ownedChanges.add(index);
    if (!isMappedByOwner) {
      const key = toExternalKey(owner);
      moved.set(key, [...(moved.get(key) ?? []), change]);
    }
    relocated.push({
      target,
      formula: readText({ value: change.formula }),
      type: readText({ value: change.type }),
      traits: owners.map((trait) => stableKeyOf(toExternalKey(trait))),
    });
  }
  return { ownedChanges, relocated, moved };
}

/**
 * A reviewed race note applies to the one standard trait with a note on the
 * same target. A checked note record of that trait supersedes it; until then,
 * a checked race record stands in for the trait's own notes on the target that
 * state the same numbers, which are no longer required inputs.
 */
function planRaceNotes({
  race,
  raceKey,
  noteOwners,
  data,
  stableKeyOf,
}: {
  race: LoadedRecord;
  raceKey: string;
  noteOwners: ReturnType<typeof indexTraitOwners>['noteOwners'];
  data: CurationData;
  stableKeyOf: StableKeyOf;
}) {
  const homes = new Map<string, string>();
  const notRequired = new Set<string>();
  const ownerless: string[] = [];
  const rehomed: RaceRelocation['rehomedNotes'] = [];
  const covered: RaceRelocation['coveredTraitNotes'] = [];
  const uncovered: RaceRelocation['uncoveredTraitNotes'] = [];
  const stale: RaceRelocation['staleNotes'] = [];
  const records = new Map(
    data.records.map((record) => [bindingKey(record), record]),
  );
  for (const input of collectCurationInputs({
    source: race,
    externalKey: raceKey,
    kind: 'race',
  })) {
    if (input.kind !== 'note') continue;
    const owners = noteOwners.get(input.target) ?? [];
    if (!owners.length) {
      ownerless.push(input.target);
      continue;
    }
    // Several traits note the same statistic: the owner is the one trait
    // whose note states the race note's numbers.
    const numbers = noteNumbers(input.text);
    const matching =
      owners.length > 1 && numbers.length
        ? owners.filter(({ texts }) => {
            const stated = new Set(texts.flatMap(noteNumbers));
            return numbers.every((number) => stated.has(number));
          })
        : owners;
    const [owner] = matching;
    if (!owner || matching.length > 1) {
      notRequired.add(bindingKey(input));
      stale.push({
        target: input.target,
        reason: `Several standard traits carry a ${input.target} note: ${owners.map(({ trait }) => stableKeyOf(toExternalKey(trait))).join(', ')}.`,
      });
      continue;
    }
    const trait = stableKeyOf(toExternalKey(owner.trait));
    const isCheckedOnTrait = data.records.some(
      (record) =>
        record.externalKey === trait &&
        record.kind === 'note' &&
        record.target === input.target &&
        record.status === 'checked',
    );
    if (isCheckedOnTrait) {
      notRequired.add(bindingKey(input));
      stale.push({
        target: input.target,
        reason: `Superseded by ${trait}'s own checked ${input.target} note record.`,
      });
      continue;
    }
    homes.set(bindingKey(input), trait);
    rehomed.push({ target: input.target, trait });
    if (records.get(bindingKey(input))?.status !== 'checked') continue;
    // A checked race record stands in only for the owner's notes that state
    // the same numbers; a note stating others stays required.
    const stated = new Set(numbers);
    for (const text of owner.texts) {
      const own = noteNumbers(text);
      if (own.length === stated.size && own.every((n) => stated.has(n))) {
        notRequired.add(
          traitNoteBinding({ trait, target: input.target, text }),
        );
        covered.push({ trait, target: input.target, text });
      } else uncovered.push({ trait, target: input.target, text });
    }
  }
  return { homes, notRequired, ownerless, rehomed, covered, uncovered, stale };
}

function weaponProfOwnership(race: LoadedRecord, standard: LoadedRecord[]) {
  if (!readStrings(race.record.system.weaponProf).length) return 'none';
  return standard.some(
    (trait) => readStrings(trait.record.system.weaponProf).length,
  )
    ? 'owned'
    : 'ownerless';
}

/** Whether a standard trait record carries the race's ability adjustments. */
function ownsAbilities(
  trait: LoadedRecord,
  hasAbilityChoice: (traitKey: string) => boolean,
) {
  return (
    hasAbilityChoice(toExternalKey(trait)) ||
    readArray(trait.record.system.changes).some((change) =>
      abilityTargets.has(readText({ value: readObject(change).target })),
    )
  );
}

/** Trait names the race description gives that no standard trait has. */
function unmatchedTraitNamesOf({
  race,
  standard,
  abilityTrait,
  hasAbilityChoice,
}: {
  race: LoadedRecord;
  standard: LoadedRecord[];
  abilityTrait?: RaceAbilityTrait;
  hasAbilityChoice: (traitKey: string) => boolean;
}) {
  const standardNames = new Set([
    ...standard.map((trait) => normalizeTraitName(trait.record.name)),
    ...(abilityTrait?.names ?? []),
  ]);
  const ownsAny =
    abilityTrait !== undefined ||
    standard.some((trait) => ownsAbilities(trait, hasAbilityChoice));
  return describedTraitNames(race).filter(
    (name) =>
      !standardNames.has(normalizeTraitName(name)) &&
      !(ownsAny && /^ability (score )?modifiers$/i.test(name.trim())),
  );
}

function unlinkedReasonOf({
  name,
  folder,
  standard,
  folderNames,
}: {
  name: string;
  folder?: string;
  standard: LoadedRecord[];
  folderNames: ReadonlySet<string>;
}) {
  if (standard.length) return undefined;
  if (folder)
    return `The "${name}" race folder holds no standard trait record.`;
  const base = withoutLabel(name);
  return base !== name && folderNames.has(base)
    ? `No race folder is named "${name}"; the "${base}" folder binds only a race of exactly that name.`
    : `No race folder is named "${name}".`;
}

/** Why a reviewed ability score trait rule no longer matches its race. */
function abilityTraitIssue({
  race,
  changes,
  indices,
  isComplete,
  ownedChanges,
  mapsChange,
}: {
  race: LoadedRecord;
  changes: RawChange[];
  indices: number[];
  isComplete: boolean;
  ownedChanges: ReadonlySet<number>;
  mapsChange: MapsChange;
}) {
  if (!isComplete)
    return 'The race record no longer has the reviewed ability changes.';
  if (indices.some((index) => ownedChanges.has(index)))
    return 'A standard trait record carries these ability changes.';
  const isUnlisted = changes.some(
    (change, index) =>
      !indices.includes(index) &&
      !ownedChanges.has(index) &&
      abilityTargets.has(readText({ value: change.target })),
  );
  if (isUnlisted)
    return 'The race record has an ability change the rule does not list.';
  const isUnmapped = indices.some(
    (index) =>
      !mapsChange({
        record: race.record,
        kind: 'race',
        change: changes[index] ?? {},
      }),
  );
  return isUnmapped
    ? 'A reviewed ability change no longer maps to a Modifier.'
    : undefined;
}

/**
 * #721: the race's reviewed ability score trait, when its rule still matches
 * exactly the race record's ability changes that no standard trait owns.
 */
function planAbilityTrait({
  race,
  raceKey,
  ownedChanges,
  mapsChange,
}: {
  race: LoadedRecord;
  raceKey: string;
  ownedChanges: ReadonlySet<number>;
  mapsChange: MapsChange;
}): PlannedAbilityTrait | undefined {
  const rule = findRaceAbilityTraitRule(toExternalKey(race));
  if (!rule) return undefined;
  const key = raceAbilityTraitKey(raceKey);
  const row = {
    race: raceKey,
    trait: key,
    evidence: rule.evidence,
    pcgen: rule.pcgen,
    ...(rule.note ? { note: rule.note } : {}),
  };
  const changes = readArray(race.record.system.changes).map(readObject);
  const used = new Set<number>();
  for (const raw of rule.consumes) {
    const index = changes.findIndex(
      (change, at) => !used.has(at) && matchesRawChange(change, raw),
    );
    if (index >= 0) used.add(index);
  }
  const indices = [...used].sort((left, right) => left - right);
  const issue = abilityTraitIssue({
    race,
    changes,
    indices,
    isComplete: indices.length === rule.consumes.length,
    ownedChanges,
    mapsChange,
  });
  if (issue)
    return {
      status: 'stale',
      row: { ...row, status: 'stale', reason: issue },
    };
  const name = `Ability Score Modifiers (${rule.name})`;
  return {
    status: 'applied',
    row: { ...row, status: 'applied' },
    trait: {
      key,
      name,
      names: [...new Set([name, rule.heading].map(normalizeTraitName))],
      race,
      raceKey,
      heading: rule.heading,
      indices,
    },
  };
}

function relocatedOnto(trait: RaceAbilityTrait) {
  return abilityTraitChanges(trait).map((change) => ({
    target: readText({ value: change.target }),
    formula: readText({ value: change.formula }),
    type: readText({ value: change.type }),
    traits: [trait.key],
  }));
}

function planRaceRelocation({
  race,
  raceKey,
  standard,
  unlinkedReason,
  data,
  stableKeyOf,
  hasAbilityChoice,
  mapsChange,
}: {
  race: LoadedRecord;
  raceKey: string;
  standard: LoadedRecord[];
  unlinkedReason?: string;
  data: CurationData;
  stableKeyOf: StableKeyOf;
  hasAbilityChoice: (traitKey: string) => boolean;
  mapsChange: MapsChange;
}) {
  const { changeOwners, noteOwners } = indexTraitOwners(standard);
  const changes = planRaceChanges({
    race,
    changeOwners,
    mapsChange,
    stableKeyOf,
  });
  const notes = planRaceNotes({ race, raceKey, noteOwners, data, stableKeyOf });
  const ability = planAbilityTrait({
    race,
    raceKey,
    ownedChanges: changes.ownedChanges,
    mapsChange,
  });
  const abilityTrait =
    ability?.status === 'applied' ? ability.trait : undefined;
  for (const index of abilityTrait?.indices ?? [])
    changes.ownedChanges.add(index);
  const relocation: RaceRelocation = {
    standard,
    ...(unlinkedReason ? { unlinkedReason } : {}),
    ownedChanges: changes.ownedChanges,
    relocated: [
      ...changes.relocated,
      ...(abilityTrait ? relocatedOnto(abilityTrait) : []),
    ],
    ownerlessNotes: notes.ownerless,
    rehomedNotes: notes.rehomed,
    coveredTraitNotes: notes.covered,
    uncoveredTraitNotes: notes.uncovered,
    staleNotes: notes.stale,
    weaponProf: weaponProfOwnership(race, standard),
    unmatchedTraitNames: unmatchedTraitNamesOf({
      race,
      standard,
      abilityTrait,
      hasAbilityChoice,
    }),
    ...(abilityTrait ? { abilityTrait } : {}),
    ...(ability ? { abilityTraitRow: ability.row } : {}),
  };
  return {
    relocation,
    noteHomes: notes.homes,
    notRequired: notes.notRequired,
    moved: changes.moved,
  };
}

/** Why a reviewed description re-home no longer applies, if it does not. */
function descriptionRehomeIssue({
  rule,
  race,
  record,
  trait,
  data,
  stableKeyOf,
}: {
  rule: DescriptionRehomeRule;
  race: LoadedRecord;
  record?: CurationRecord;
  trait?: LoadedRecord;
  data: CurationData;
  stableKeyOf: StableKeyOf;
}) {
  if (hashText(sourceDescription(race.record)) !== rule.descriptionSha256)
    return 'The race description changed since review.';
  if (!record)
    return 'No applicable checked description record carries this output.';
  if (!trait) return 'The trait is not one of the race standard traits.';
  const { supersedes } = rule;
  if (supersedes.kind === 'change')
    return readArray(trait.record.system.changes).some((change) =>
      matchesRawChange(readObject(change), supersedes.change),
    )
      ? undefined
      : 'The trait no longer carries the superseded change.';
  if (
    !notesOf(trait).some(
      (note) =>
        note.target === supersedes.target && note.text === supersedes.text,
    )
  )
    return 'The trait no longer carries the superseded note.';
  const binding = traitNoteBinding({
    trait: stableKeyOf(rule.trait),
    target: supersedes.target,
    text: supersedes.text,
  });
  return data.records.some(
    (candidate) =>
      bindingKey(candidate) === binding &&
      candidate.status === 'checked' &&
      candidate.outputs.length > 0,
  )
    ? "The trait's own note has a checked record; review which one counts."
    : undefined;
}

function planDescriptionRehomes({
  races,
  standardOf,
  stableKeyOf,
  data,
}: {
  races: ReadonlyMap<string, LoadedRecord>;
  standardOf: (raceKey: string) => LoadedRecord[];
  stableKeyOf: StableKeyOf;
  data: CurationData;
}) {
  const homes = new Map<string, { outputTarget: string; trait: string }[]>();
  const superseded = new Map<string, ReviewedRawChange[]>();
  const notRequired = new Set<string>();
  const rules: {
    race: string;
    trait: string;
    outputTarget: string;
    status: 'applied' | 'stale' | 'unused';
    reason?: string;
  }[] = [];
  for (const rule of reviewedDescriptionRehomes) {
    const race = races.get(rule.race);
    const raceKey = stableKeyOf(rule.race);
    const traitKey = stableKeyOf(rule.trait);
    const row = {
      race: raceKey,
      trait: traitKey,
      outputTarget: rule.outputTarget,
    };
    if (!race) {
      rules.push({
        ...row,
        status: 'unused',
        reason: 'The race record is not in these inputs.',
      });
      continue;
    }
    const record = data.records.find(
      (candidate) =>
        candidate.externalKey === raceKey &&
        candidate.kind === 'description' &&
        candidate.textSha256 === rule.descriptionSha256 &&
        isApplicable(candidate) &&
        candidate.outputs.some(
          (output) =>
            output.kind === 'modifier' && output.target === rule.outputTarget,
        ),
    );
    const trait = standardOf(rule.race).find(
      (source) => toExternalKey(source) === rule.trait,
    );
    const reason = descriptionRehomeIssue({
      rule,
      race,
      record,
      trait,
      data,
      stableKeyOf,
    });
    if (reason || !record) {
      rules.push({ ...row, status: 'stale', ...(reason ? { reason } : {}) });
      continue;
    }
    rules.push({ ...row, status: 'applied' });
    homes.set(bindingKey(record), [
      ...(homes.get(bindingKey(record)) ?? []),
      {
        outputTarget: rule.outputTarget,
        trait: traitKey,
      },
    ]);
    const { supersedes } = rule;
    if (supersedes.kind === 'change')
      superseded.set(rule.trait, [
        ...(superseded.get(rule.trait) ?? []),
        supersedes.change,
      ]);
    else
      notRequired.add(
        traitNoteBinding({
          trait: traitKey,
          target: supersedes.target,
          text: supersedes.text,
        }),
      );
  }
  return { homes, superseded, notRequired, rules };
}

function indexRaces(loaded: LoadedRecord[]) {
  const races = new Map<string, LoadedRecord>();
  for (const source of loaded)
    if (
      source.repo === 'pf1' &&
      source.pack === 'races' &&
      source.record.type === 'race' &&
      !isFolder(source)
    )
      races.set(toExternalKey(source), source);
  return races;
}

function placeTraits(
  loaded: LoadedRecord[],
  folderIndex: ReturnType<typeof indexFolders>,
) {
  return loaded.flatMap((source) => {
    if (!isTraitRecord(source) || isFolder(source)) return [];
    const place = placeInFolders(source, folderIndex);
    if (!place) return [];
    const isStandard =
      place.subfolder === 'Standard' ||
      (place.subfolder === undefined && !hasReplacedHeader(source));
    return [{ source, ...place, isStandard }];
  });
}

function groupBy<T>(items: T[], keyOf: (item: T) => string | undefined) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    if (key !== undefined) groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

/**
 * #721: whether an alternate's own ability changes map to Modifiers: a raw
 * ability change that maps, one a reviewed rule maps (such as a choice), or an
 * applicable Curation Overlay Modifier on an ability.
 */
function abilityChangesOf({
  source,
  stableKeyOf,
  data,
  mapsChange,
}: {
  source: LoadedRecord;
  stableKeyOf: StableKeyOf;
  data: CurationData;
  mapsChange: MapsChange;
}): AbilityChanges {
  const upstreamKey = toExternalKey(source);
  const key = stableKeyOf(upstreamKey);
  const applicableRules = findRacialTraitRules(upstreamKey).filter(
    (rule) => matchRacialTraitRule({ source, rule }) !== undefined,
  );
  // An untargeted change is a choice, such as Dual Talent's.
  const changes = readArray(source.record.system.changes)
    .map(readObject)
    .filter((change) => {
      const target = readText({ value: change.target });
      return !target || abilityTargets.has(target);
    });
  const isCurated = data.records.some(
    (record) =>
      record.externalKey === key &&
      isApplicable(record) &&
      record.outputs.some(
        (output) =>
          output.kind === 'modifier' && output.target.startsWith('ability.'),
      ),
  );
  // Every own ability change must map, so none is silently dropped.
  const isMapped =
    changes.length > 0 &&
    changes.every(
      (change) =>
        applicableRules.some(
          (rule) =>
            (rule.fact.kind === 'abilityChoice' ||
              rule.fact.kind === 'racialAbilities') &&
            rule.consumes.some((raw) => matchesRawChange(change, raw)),
        ) ||
        (readText({ value: change.target }) !== '' &&
          mapsChange({ record: source.record, kind: 'racialTrait', change })),
    );
  const hasProseRule = applicableRules.some(
    (rule) =>
      rule.fact.kind === 'racialAbilities' &&
      rule.descriptionSha256 !== undefined &&
      rule.descriptionSha256 === hashText(sourceDescription(source.record)),
  );
  if (isCurated || isMapped || hasProseRule) return 'mapped';
  return changes.length ? 'unmapped' : 'none';
}

function reviewedReasonOf(upstreamKey: string) {
  const rule = reviewedUnresolvedAlternates.find(
    (candidate) => candidate.externalKey === upstreamKey,
  );
  return rule ? { reviewedReason: rule.reason } : {};
}

/**
 * The names an alternate of this race folder may replace: its standard trait
 * records, their reviewed aliases and the race's reviewed ability score trait.
 */
function buildNameIndex({
  standard,
  abilityTraits,
  hasAbilityChoice,
}: {
  standard: LoadedRecord[];
  abilityTraits: RaceAbilityTrait[];
  hasAbilityChoice: (traitKey: string) => boolean;
}): NameIndex {
  const byName = new Map<string, string>();
  for (const trait of standard)
    byName.set(normalizeTraitName(trait.record.name), toExternalKey(trait));
  // Reviewed aliases and new traits never displace a record's own name.
  const standardKeys = new Set(standard.map(toExternalKey));
  const aliases = reviewedTraitNameAliases
    .filter((alias) => standardKeys.has(alias.trait))
    .flatMap((alias) => alias.names.map((name) => [name, alias.trait]));
  const derived = abilityTraits.flatMap((trait) =>
    trait.names.map((name) => [name, trait.key]),
  );
  for (const [name = '', key = ''] of [...aliases, ...derived]) {
    const normalized = normalizeTraitName(name);
    if (!byName.has(normalized)) byName.set(normalized, key);
  }
  return {
    byName,
    standard,
    abilityTraits: new Set([
      ...standard
        .filter((trait) => ownsAbilities(trait, hasAbilityChoice))
        .map(toExternalKey),
      ...abilityTraits.map((trait) => trait.key),
    ]),
  };
}

/**
 * Each alternate's replacements, matched against its race folder's name index.
 * A heritage subrace's "Base Statistics" stands for the ability score trait of
 * the one race its folder binds; with several, it stays unmatched.
 */
function placeAlternates({
  placed,
  racesByFolder,
  indexOf,
  abilityTraitsOf,
  facts,
}: {
  placed: ReturnType<typeof placeTraits>;
  racesByFolder: ReadonlyMap<string, string[]>;
  indexOf: (folder: string) => NameIndex;
  abilityTraitsOf: (folder: string) => RaceAbilityTrait[];
  facts: (source: LoadedRecord) => AbilityChanges;
}) {
  const subraceLines = new Set([
    ...reviewedAbilityLineSubraces.map((rule) => rule.externalKey),
    'pf1-content/xPtJg4WPKxVRmVdM',
  ]);
  // Only a folder that binds exactly one race names whose trait it is.
  const baseStatisticsOf = (upstreamKey: string, folder: string) => {
    const races = racesByFolder.get(folder) ?? [];
    const [ability] =
      subraceLines.has(upstreamKey) && races.length === 1
        ? abilityTraitsOf(folder)
        : [];
    return ability ? { baseStatistics: ability.key } : {};
  };
  const placements = new Map<string, TraitPlacement>();
  for (const trait of placed) {
    const upstreamKey = toExternalKey(trait.source);
    const replacement = trait.isStandard
      ? settleReplacements({
          replaces: [],
          names: [],
          unmatched: [],
          lacksHeader: false,
        })
      : resolveReplacements({
          source: trait.source,
          subfolder: trait.subfolder,
          index: indexOf(trait.raceFolder),
          facts: {
            abilityChanges: facts(trait.source),
            ...baseStatisticsOf(upstreamKey, trait.raceFolder),
            ...reviewedReasonOf(upstreamKey),
          },
        });
    placements.set(upstreamKey, {
      races: racesByFolder.get(trait.raceFolder) ?? [],
      isStandard: trait.isStandard,
      ...replacement,
    });
  }
  return placements;
}

/**
 * Binds races to their standard Racial Trait records, resolves alternates'
 * replacements and decides which race changes and reviewed race notes belong to
 * a trait. Pure over the loaded records, identity map and Curation Overlay.
 */
export function planRacialTraits({
  loaded,
  resolveKey,
  data,
  hasAbilityChoice,
  mapsChange,
}: {
  loaded: LoadedRecord[];
  resolveKey: (key: string) => string | undefined;
  data: CurationData;
  hasAbilityChoice: (traitKey: string) => boolean;
  mapsChange: MapsChange;
}) {
  const stableKeyOf: StableKeyOf = (key) => resolveKey(key) ?? key;
  const folderIndex = indexFolders(loaded);
  const races = indexRaces(loaded);
  const placed = placeTraits(loaded, folderIndex);
  const standardByFolder = new Map(
    [
      ...groupBy(
        placed.filter((trait) => trait.isStandard),
        (trait) => trait.raceFolder,
      ),
    ].map(([folder, traits]) => [
      folder,
      sortByKey(traits.map(({ source }) => source)),
    ]),
  );
  const folderByName = new Map(
    [...folderIndex.raceFolders].map(([id, name]) => [name, id]),
  );
  const folderOf = (race: string) =>
    folderByName.get(races.get(race)?.record.name ?? '');
  const racesByFolder = groupBy([...races.keys()].sort(), folderOf);
  const standardOf = (race: string) =>
    standardByFolder.get(folderOf(race) ?? '') ?? [];

  const folderNames = new Set(folderIndex.raceFolders.values());
  const relocations = new Map<string, RaceRelocation>();
  const noteHomes = new Map<string, string>();
  const notRequired = new Set<string>();
  const movedChanges = new Map<
    string,
    { race: LoadedRecord; changes: RawChange[] }
  >();
  for (const [race, source] of races) {
    const standard = standardOf(race);
    const planned = planRaceRelocation({
      race: source,
      raceKey: stableKeyOf(race),
      standard,
      unlinkedReason: unlinkedReasonOf({
        name: source.record.name,
        folder: folderOf(race),
        standard,
        folderNames,
      }),
      data,
      stableKeyOf,
      hasAbilityChoice,
      mapsChange,
    });
    relocations.set(race, planned.relocation);
    for (const [key, home] of planned.noteHomes) noteHomes.set(key, home);
    for (const key of planned.notRequired) notRequired.add(key);
    for (const [trait, changes] of planned.moved)
      movedChanges.set(trait, { race: source, changes });
  }
  const abilityTraitsOf = (folder: string) =>
    (racesByFolder.get(folder) ?? []).flatMap(
      (race) => relocations.get(race)?.abilityTrait ?? [],
    );
  const indexes = new Map<string, NameIndex>();
  const placements = placeAlternates({
    placed,
    racesByFolder,
    abilityTraitsOf,
    indexOf: (folder) => {
      const index =
        indexes.get(folder) ??
        buildNameIndex({
          standard: standardByFolder.get(folder) ?? [],
          abilityTraits: abilityTraitsOf(folder),
          hasAbilityChoice,
        });
      indexes.set(folder, index);
      return index;
    },
    facts: (source) =>
      abilityChangesOf({ source, stableKeyOf, data, mapsChange }),
  });
  const abilityTraitRows = reviewedRaceAbilityTraits.map(
    (rule) =>
      relocations.get(rule.race)?.abilityTraitRow ?? {
        race: stableKeyOf(rule.race),
        trait: raceAbilityTraitKey(stableKeyOf(rule.race)),
        status: 'unused' as const,
        reason: 'The race record is not in these inputs.',
        evidence: rule.evidence,
        pcgen: rule.pcgen,
        ...(rule.note ? { note: rule.note } : {}),
      },
  );
  const descriptions = planDescriptionRehomes({
    races,
    standardOf,
    stableKeyOf,
    data,
  });
  for (const key of descriptions.notRequired) notRequired.add(key);
  const weaponBaseTypes = new Map<string, string>();
  for (const source of loaded)
    if (source.record.type === 'weapon')
      for (const baseType of readStrings(source.record.system.baseTypes))
        if (!weaponBaseTypes.has(compactName(baseType)))
          weaponBaseTypes.set(compactName(baseType), baseType);
  return {
    stableKeyOf,
    weaponBaseTypes,
    races,
    standardOf,
    placementOf: (trait: string) => placements.get(trait),
    relocationOf: (race: string) => relocations.get(race),
    /** #721: the race's reviewed ability score trait, when its rule applies. */
    abilityTraitOf: (race: string) => relocations.get(race)?.abilityTrait,
    abilityTraitRows,
    /** The race changes that move onto this standard trait. */
    movedChangesOf: (trait: string) => movedChanges.get(trait),
    placements,
    /** Bindings of the race and trait note inputs that are not required. */
    notRequired,
    noteHomes,
    descriptionHomes: descriptions.homes,
    supersededChanges: descriptions.superseded,
    descriptionRules: descriptions.rules,
  };
}

/** Where a reviewed race record's output applies, when a trait owns it. */
export function racialOutputHome(
  plan: Pick<RacialTraitPlan, 'noteHomes' | 'descriptionHomes'>,
  record: CurationRecord,
  output: CurationRecord['outputs'][number],
) {
  const key = bindingKey(record);
  if (record.kind === 'note') return plan.noteHomes.get(key);
  return output.kind === 'modifier'
    ? plan.descriptionHomes
        .get(key)
        ?.find((home) => output.target === home.outputTarget)?.trait
    : undefined;
}

export function isSupersededTraitChange(
  plan: Pick<RacialTraitPlan, 'supersededChanges'> | undefined,
  trait: string,
  change: RawChange,
) {
  return (plan?.supersededChanges.get(trait) ?? []).some((raw) =>
    matchesRawChange(change, raw),
  );
}

function compactName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

type RuleFacts = {
  size?: 'medium';
  abilityChoiceCount?: 2;
  modifiers?: {
    target: string;
    bonusType: string;
    value: number;
    condition?: { situation: { local: string } };
  }[];
  grantsSlots?: { kind: 'feat'; count: number; feats?: string[] }[];
  countsAsRaces?: string[];
  favoredClassCount?: 2;
};

/** Match the complete source fact, including repeated untargeted choices. */
function matchRacialTraitRule({
  source,
  rule,
  consumed = new Set<number>(),
}: {
  source: LoadedRecord;
  rule: RacialTraitRule;
  consumed?: ReadonlySet<number>;
}) {
  if (
    rule.descriptionSha256 !== undefined &&
    rule.descriptionSha256 !== hashText(sourceDescription(source.record))
  )
    return undefined;
  const changes = readArray(source.record.system.changes).map(readObject);
  const matched: number[] = [];
  for (const raw of rule.consumes) {
    const index = changes.findIndex(
      (change, index) =>
        !consumed.has(index) &&
        !matched.includes(index) &&
        matchesRawChange(change, raw),
    );
    if (index < 0) return undefined;
    matched.push(index);
  }
  return matched;
}

function ruleFacts({
  fact,
  supplements,
  stableKeyOf,
}: {
  fact: RacialTraitFact;
  supplements: string[];
  stableKeyOf: StableKeyOf;
}): RuleFacts {
  switch (fact.kind) {
    case 'abilityChoice':
      return {
        ...(fact.count ? { abilityChoiceCount: fact.count } : {}),
        modifiers: [
          { target: 'ability.$choice', bonusType: 'racial', value: fact.value },
        ],
      };
    case 'racialAbilities':
      return {
        ...(fact.size ? { size: fact.size } : {}),
        modifiers: fact.abilities.map(({ target, value, situation }) => ({
          target: `ability.${target}`,
          bonusType: 'racial',
          value,
          ...(situation ? { condition: { situation } } : {}),
        })),
      };
    case 'bonusFeat':
      return { grantsSlots: [{ kind: 'feat', count: 1 }] };
    case 'supplementedFeat':
      return {
        grantsSlots: [
          { kind: 'feat', count: 1, feats: [...new Set(supplements)].sort() },
        ],
      };
    case 'favoredClassCount':
      return { favoredClassCount: 2 };
    case 'countsAsRaces':
      return { countsAsRaces: fact.races.map(stableKeyOf).sort() };
    default: {
      const unknown: never = fact;
      throw new Error(`Unknown Racial Trait fact: ${JSON.stringify(unknown)}`);
    }
  }
}

/** Feat keys linked from the `supplements` of the races owning this trait. */
function supplementsOf({
  plan,
  upstreamKey,
  stableKeyOf,
}: {
  plan?: RacialTraitPlan;
  upstreamKey: string;
  stableKeyOf: StableKeyOf;
}) {
  return (plan?.placementOf(upstreamKey)?.races ?? []).flatMap((race) => {
    const links = readObject(plan?.races.get(race)?.record.system.links);
    return readArray(links.supplements).flatMap((link) => {
      const key = uuidKey(readText({ value: readObject(link).uuid }));
      return key ? [stableKeyOf(key)] : [];
    });
  });
}

/** The reviewed rules' facts, and the changes they consume, where they match. */
function applyRacialTraitRules({
  source,
  consumed,
  plan,
  stableKeyOf,
}: {
  source: LoadedRecord;
  consumed: ReadonlySet<number>;
  plan?: RacialTraitPlan;
  stableKeyOf: StableKeyOf;
}): { consumed: number[]; facts: RuleFacts; unsupported: Unsupported[] } {
  const upstreamKey = toExternalKey(source);
  const supplements = supplementsOf({ plan, upstreamKey, stableKeyOf });
  const taken = new Set(consumed);
  const result: {
    consumed: number[];
    facts: RuleFacts;
    unsupported: Unsupported[];
  } = { consumed: [], facts: {}, unsupported: [] };
  for (const rule of findRacialTraitRules(upstreamKey)) {
    const matched = matchRacialTraitRule({ source, rule, consumed: taken });
    if (
      !matched ||
      (rule.fact.kind === 'supplementedFeat' && supplements.length === 0)
    ) {
      result.unsupported.push({
        field: 'racialTraitRule',
        reason:
          'The reviewed Racial Trait rule no longer matches this record; it imports without the rule.',
        value: { name: rule.name, evidence: rule.evidence },
      });
      continue;
    }
    for (const index of matched) taken.add(index);
    result.consumed.push(...matched);
    const facts = ruleFacts({ fact: rule.fact, supplements, stableKeyOf });
    result.facts = {
      ...result.facts,
      ...facts,
      ...(result.facts.modifiers || facts.modifiers
        ? {
            modifiers: [
              ...(result.facts.modifiers ?? []),
              ...(facts.modifiers ?? []),
            ],
          }
        : {}),
    };
  }
  return result;
}

/** Named weapon familiarity as base-type proficiencies; the rest stays prose. */
function weaponProficiencies(source: LoadedRecord, plan?: RacialTraitPlan) {
  const proficiencies = new Map<string, { baseType: string }>();
  const unsupported: Unsupported[] = [];
  for (const name of readStrings(source.record.system.weaponProf)) {
    const baseType = plan?.weaponBaseTypes.get(compactName(name));
    if (baseType) proficiencies.set(baseType, { baseType });
    else
      unsupported.push({
        field: 'weaponProf',
        reason:
          'Weapon familiarity name matches no pinned weapon base type; it stays prose.',
        value: name,
      });
  }
  return {
    proficiencies: [...proficiencies.values()].sort((left, right) =>
      compare(left.baseType, right.baseType),
    ),
    unsupported,
  };
}

/**
 * #720: a race's own named weapon proficiencies, when no standard trait owns
 * them (the Drow Noble). An owned list is the trait's; without a plan, nothing
 * resolves the list, so each name is reported.
 */
export function mapRaceProficiencies({
  source,
  plan,
}: {
  source: LoadedRecord;
  plan?: RacialTraitPlan;
}) {
  if (!plan)
    return {
      proficiencies: [],
      unsupported: readStrings(source.record.system.weaponProf).map(
        (value) => ({
          field: 'weaponProf',
          reason:
            'No Racial Trait plan resolves this weapon familiarity to a pinned weapon base type; it stays prose.',
          value,
        }),
      ),
    };
  return plan.relocationOf(toExternalKey(source))?.weaponProf === 'ownerless'
    ? weaponProficiencies(source, plan)
    : undefined;
}

function isSkilledChange(change: RawChange) {
  // One rank at each Hit Die: Skilled (Human), CRB p. 27.
  return (
    change.target === 'bonusSkillRanks' &&
    change.formula === '@attributes.hd.total'
  );
}

/**
 * The structured facts a Racial Trait record supports: Skilled's ranks, the
 * reviewed choice and counts-as rules, and named weapon familiarity. Changes it
 * consumes are not also mapped or reported as unmapped Modifiers.
 */
export function mapRacialTraitFacts({
  source,
  plan,
  resolveKey,
}: {
  source: LoadedRecord;
  plan?: RacialTraitPlan;
  resolveKey: (key: string) => string | undefined;
}) {
  const stableKeyOf = plan?.stableKeyOf ?? ((key) => resolveKey(key) ?? key);
  const upstreamKey = toExternalKey(source);
  const changes = readArray(source.record.system.changes).map(readObject);
  const indicesWhere = (test: (change: RawChange) => boolean) =>
    changes.flatMap((change, index) => (test(change) ? [index] : []));
  const skilled = indicesWhere(isSkilledChange);
  const preconsumed = new Set([
    ...skilled,
    ...indicesWhere((change) =>
      isSupersededTraitChange(plan, upstreamKey, change),
    ),
  ]);
  const rule = applyRacialTraitRules({
    source,
    consumed: preconsumed,
    plan,
    stableKeyOf,
  });
  const weapons = weaponProficiencies(source, plan);
  const { modifiers = [], ...facts } = rule.facts;
  return {
    consumed: new Set([...preconsumed, ...rule.consumed]),
    modifiers,
    unsupported: [...rule.unsupported, ...weapons.unsupported],
    bonusSkillRanksPerLevel: skilled.length,
    ...facts,
    ...(weapons.proficiencies.length
      ? { proficiencies: weapons.proficiencies }
      : {}),
  };
}
export type RacialTraitFacts = ReturnType<typeof mapRacialTraitFacts>;

function multisetDifference(left: string[], right: string[]) {
  const remaining = new Map<string, number>();
  for (const item of right) remaining.set(item, (remaining.get(item) ?? 0) + 1);
  return left.filter((item) => {
    const count = remaining.get(item) ?? 0;
    if (count) remaining.set(item, count - 1);
    return !count;
  });
}
function parseJson(text: string): unknown {
  return JSON.parse(text);
}

// The curation note aliases, plus natural armor, which curation drafts do not
// alias. A school DC is the resolver's spell DC; a raw skill target is already
// the runtime skill key.
const extraStatistics: Record<string, string> = { nac: 'ac.natural' };
function statisticsOf(rawTarget: string) {
  if (rawTarget.startsWith('dc.school.')) return ['spellDC'];
  return [
    extraStatistics[rawTarget] ?? noteTargetAliases[rawTarget] ?? rawTarget,
  ];
}

type ReportedEntry = {
  externalKey: string;
  name: string;
  modifiers: {
    target: string;
    bonusType: string;
    value: unknown;
    condition?: unknown;
  }[];
  unsupported: Unsupported[];
};
type ReportedModifier = ReportedEntry['modifiers'][number];

function isUnconditioned(modifier: ReportedModifier) {
  return modifier.condition === undefined;
}

/**
 * A race Modifier and a standard trait Modifier on one statistic, one of them
 * unconditioned: a possible double count to review.
 */
function overlapsOf(race: ReportedEntry, traits: ReportedEntry[]) {
  return race.modifiers.flatMap((modifier) =>
    traits
      .filter((trait) =>
        trait.modifiers.some(
          (other) =>
            other.target === modifier.target &&
            (isUnconditioned(other) || isUnconditioned(modifier)),
        ),
      )
      .map((trait) => ({ target: modifier.target, trait: trait.externalKey })),
  );
}

/**
 * A race Modifier on a statistic that a standard trait's uncurated note or
 * unmapped change also covers, such as a reviewed race description output and
 * the trait's raw school DC: the trait's curation must not count it again.
 */
function latentOverlapsOf({
  race,
  standard,
  traits,
  stableKeyOf,
}: {
  race: ReportedEntry;
  standard: LoadedRecord[];
  traits: ReadonlyMap<string, ReportedEntry>;
  stableKeyOf: StableKeyOf;
}) {
  const covered = standard.map((source) => {
    const trait = stableKeyOf(toExternalKey(source));
    const unmapped = (traits.get(trait)?.unsupported ?? []).flatMap((issue) =>
      issue.field === 'changes'
        ? [readText({ value: readObject(issue.value).target })]
        : [],
    );
    return {
      trait,
      statistics: new Set(
        [...notesOf(source).map(({ target }) => target), ...unmapped].flatMap(
          statisticsOf,
        ),
      ),
    };
  });
  return race.modifiers.flatMap((modifier) =>
    covered
      .filter(({ statistics }) => statistics.has(modifier.target))
      .map(({ trait }) => ({ target: modifier.target, trait })),
  );
}

function reportRace({
  plan,
  upstreamKey,
  source,
  byKey,
  extracted,
  mapRaceChanges,
}: {
  plan: RacialTraitPlan;
  upstreamKey: string;
  source: LoadedRecord;
  byKey: ReadonlyMap<string, ReportedEntry>;
  extracted: (key: string) => ReportedModifier[];
  mapRaceChanges: (race: LoadedRecord, changes: unknown[]) => unknown[];
}) {
  const externalKey = plan.stableKeyOf(upstreamKey);
  const entry = byKey.get(externalKey);
  const relocation = plan.relocationOf(upstreamKey);
  if (!entry || !relocation) return [];
  const standard = [
    ...relocation.standard.map((trait) =>
      plan.stableKeyOf(toExternalKey(trait)),
    ),
    ...(relocation.abilityTrait ? [relocation.abilityTrait.key] : []),
  ].sort(compare);
  const traitEntries = standard.flatMap((key) => byKey.get(key) ?? []);
  // Extracted Modifiers before curation: the single-entry race against
  // the race and its traits now. Equal multisets mean equal totals.
  const before = [
    ...extracted(externalKey),
    ...mapRaceChanges(
      source,
      readArray(source.record.system.changes).filter((_change, index) =>
        relocation.ownedChanges.has(index),
      ),
    ),
  ].map((modifier) => JSON.stringify(modifier));
  const after = [...extracted(externalKey), ...standard.flatMap(extracted)].map(
    (modifier) => JSON.stringify(modifier),
  );
  return [
    {
      externalKey,
      name: source.record.name,
      racialTraits: standard.filter((key) => byKey.has(key)),
      ...(relocation.unlinkedReason
        ? { unlinkedReason: relocation.unlinkedReason }
        : {}),
      unlinkedStandardTraits: standard.filter((key) => !byKey.has(key)),
      unmatchedTraitNames: relocation.unmatchedTraitNames,
      relocatedChanges: relocation.relocated,
      ownerlessModifiers: extracted(externalKey),
      ownerlessNotes: relocation.ownerlessNotes,
      // Modifiers the single-entry race counted that no entry counts now,
      // and trait Modifiers it did not count (such as a trait change that
      // maps where the race's version did not).
      lostModifiers: multisetDifference(before, after).map(parseJson),
      addedModifiers: multisetDifference(after, before).map(parseJson),
      rehomedNotes: relocation.rehomedNotes,
      coveredTraitNotes: relocation.coveredTraitNotes,
      uncoveredTraitNotes: relocation.uncoveredTraitNotes,
      staleNotes: relocation.staleNotes,
      weaponProf: relocation.weaponProf,
      overlaps: overlapsOf(entry, traitEntries),
      latentOverlaps: latentOverlapsOf({
        race: entry,
        standard: relocation.standard,
        traits: byKey,
        stableKeyOf: plan.stableKeyOf,
      }),
    },
  ];
}

function reportAlternates({
  plan,
  byKey,
}: {
  plan: RacialTraitPlan;
  byKey: ReadonlyMap<string, ReportedEntry>;
}) {
  const alternates = [...plan.placements]
    .filter(([, placement]) => !placement.isStandard)
    .map(([upstreamKey, placement]) => ({
      externalKey: plan.stableKeyOf(upstreamKey),
      placement,
    }))
    .filter(({ externalKey }) => byKey.has(externalKey));
  const unresolved = alternates
    .filter(
      ({ placement }) => placement.unmatched.length || placement.lacksHeader,
    )
    .map(({ externalKey, placement }) => ({
      externalKey,
      name: byKey.get(externalKey)?.name ?? externalKey,
      races: placement.races.map(plan.stableKeyOf),
      replaces: placement.replaces.map(plan.stableKeyOf),
      unmatched: placement.unmatched,
      missingHeader: placement.lacksHeader,
      ...(placement.reason ? { reason: placement.reason } : {}),
    }))
    .sort((left, right) => compare(left.externalKey, right.externalKey));
  return { count: alternates.length, unresolved };
}

/**
 * The import report: each race's linked standard traits, unmatched trait
 * names, relocated and ownerless Modifiers and notes, and every alternate whose
 * replacement is unresolved. `extractedModifierCounts` gives each entry's
 * Modifier count before curation outputs were appended.
 */
export function reportRacialTraits({
  plan,
  entries,
  extractedModifierCounts,
  mapRaceChanges,
}: {
  plan: RacialTraitPlan;
  entries: ReportedEntry[];
  extractedModifierCounts: ReadonlyMap<string, number>;
  /** The Modifiers the race's own raw changes map to. */
  mapRaceChanges: (race: LoadedRecord, changes: unknown[]) => unknown[];
}) {
  const byKey = new Map(entries.map((entry) => [entry.externalKey, entry]));
  const extracted = (key: string) =>
    (byKey.get(key)?.modifiers ?? []).slice(
      0,
      extractedModifierCounts.get(key) ?? 0,
    );
  const races = [...plan.races]
    .flatMap(([upstreamKey, source]) =>
      reportRace({
        plan,
        upstreamKey,
        source,
        byKey,
        extracted,
        mapRaceChanges,
      }),
    )
    .sort((left, right) => compare(left.externalKey, right.externalKey));
  const alternates = reportAlternates({ plan, byKey });
  const count = (select: (race: (typeof races)[number]) => unknown[]) =>
    races.reduce((sum, race) => sum + select(race).length, 0);
  const rulesWith = (
    status: (typeof plan.descriptionRules)[number]['status'],
    rules: readonly { status: string }[] = plan.descriptionRules,
  ) => rules.filter((rule) => rule.status === status).length;
  return {
    summary: {
      races: races.length,
      racesWithTraits: races.filter((race) => race.racialTraits.length).length,
      linkedTraits: count((race) => race.racialTraits),
      unlinkedStandardTraits: count((race) => race.unlinkedStandardTraits),
      unmatchedTraitNames: count((race) => race.unmatchedTraitNames),
      relocatedChanges: count((race) => race.relocatedChanges),
      ownerlessModifiers: count((race) => race.ownerlessModifiers),
      ownerlessNotes: count((race) => race.ownerlessNotes),
      lostModifiers: count((race) => race.lostModifiers),
      addedModifiers: count((race) => race.addedModifiers),
      rehomedNotes: count((race) => race.rehomedNotes),
      coveredTraitNotes: count((race) => race.coveredTraitNotes),
      uncoveredTraitNotes: count((race) => race.uncoveredTraitNotes),
      staleNotes: count((race) => race.staleNotes),
      ownerlessWeaponProf: races.filter(
        (race) => race.weaponProf === 'ownerless',
      ).length,
      overlaps: count((race) => race.overlaps),
      latentOverlaps: count((race) => race.latentOverlaps),
      alternates: alternates.count,
      alternatesFullyResolved: alternates.count - alternates.unresolved.length,
      descriptionRehomes: {
        applied: rulesWith('applied'),
        stale: rulesWith('stale'),
        unused: rulesWith('unused'),
      },
      abilityTraits: {
        applied: rulesWith('applied', plan.abilityTraitRows),
        stale: rulesWith('stale', plan.abilityTraitRows),
        unused: rulesWith('unused', plan.abilityTraitRows),
      },
    },
    races,
    unresolvedAlternates: alternates.unresolved,
    descriptionRehomes: plan.descriptionRules,
    // Unused rules, whose race is outside these inputs, are only counted.
    abilityTraits: plan.abilityTraitRows.filter(
      (row) => row.status !== 'unused',
    ),
  };
}
