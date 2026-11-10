import {
  calculateFixtureSheet as calculateCharacterSheet,
  buildSheet,
  characterId,
  emptyOwnerCandidates,
  type Accepted,
} from './character-sheet-test-fixture';
import type { Id } from '@convex/_generated/dataModel';
import {
  Children,
  isValidElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react';
import { vi } from 'vitest';
import type { FunctionReference } from 'convex/server';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import {
  type CharacterSheetClassDetail,
  type CharacterSheetInput,
} from '~/lib/character-sheet';
import { findReviewedClassCasting } from '~/lib/character-sheet-casting-tables';
import { catalogRuntimeCompatibility } from '~/lib/catalog/runtime-compatibility';

import type { CharacterSheetSnapshot } from './use-character-sheet';

// The Spells page's component tests: a sheet read with casting classes,
// Spell definitions and recorded Spells, calculated by the public resolver,
// and a small in-memory class-list browser behind the Convex hooks. Each
// test file mocks `convex/react`, `next/navigation`, the navigation guard,
// maintenance and the select primitive with the factories below. This module
// imports no component, so the mock factories may load it.

type Entry = CharacterSheetSnapshot['entries'][number];
type CatalogEntry = CharacterSheetSnapshot['catalogEntries'][number];
type BrowserStatus =
  | 'LoadingFirstPage'
  | 'CanLoadMore'
  | 'LoadingMore'
  | 'Exhausted';

type SpellDefinition = {
  id: string;
  name: string;
  levels: Record<string, number>;
  school?: string;
  description?: string;
};

export const spells = {
  detectMagic: {
    id: 'detect-magic',
    name: 'Detect magic',
    levels: { wizard: 0, sorcerer: 0, cleric: 0, alchemist: 1, witch: 0 },
    school: 'div',
    description: 'Detects spells and magic items within 60 ft.',
  },
  shield: {
    id: 'shield',
    name: 'Shield',
    levels: { wizard: 1, sorcerer: 1 },
    school: 'abj',
    description: 'Invisible disc gives +4 to AC, blocks magic missiles.',
  },
  magicMissile: {
    id: 'magic-missile',
    name: 'Magic missile',
    levels: { wizard: 1, sorcerer: 1 },
    school: 'evocation',
    description: '1d4+1 damage; +1 missile per two levels above 1st (max 5).',
  },
  fireball: {
    id: 'fireball',
    name: 'Fireball',
    levels: { wizard: 3, sorcerer: 3, alchemist: 3 },
    school: 'evo',
    description: '1d6 damage per level, 20-ft. radius.',
  },
  bless: {
    id: 'bless',
    name: 'Bless',
    levels: { cleric: 1 },
    school: 'enc',
    description: 'Allies gain +1 on attack rolls and saves against fear.',
  },
  cureLightWounds: {
    id: 'cure-light-wounds',
    name: 'Cure light wounds',
    levels: { cleric: 1, alchemist: 1, witch: 1 },
    school: 'con',
    description: 'Cures 1d8 damage + 1/level (max +5).',
  },
} satisfies Record<string, SpellDefinition>;

export type Recorded = {
  id: string;
  spell: SpellDefinition;
  castingClassId: string | null;
  level?: number | null;
};

const extraClassNames: Record<string, string> = {
  sorcerer: 'Sorcerer',
  alchemist: 'Alchemist',
  witch: 'Witch',
};

/** A casting class the representative catalog lacks, with its reviewed casting data. */
function classCatalog(classTag: string): CatalogEntry {
  return {
    _id: classTag as Id<'catalogEntry'>,
    _creationTime: 3,
    scope: 'character',
    characterId,
    name: extraClassNames[classTag] ?? classTag,
    ruleIdentity: `class:${classTag}`,
    stacksWithItself: false,
    sources: [],
    modifiers: [],
    detail: {
      kind: 'class',
      classKind: 'base',
      hitDie: 8,
      bab: 'half',
      saves: { fort: 'poor', ref: 'poor', will: 'good' },
      skillRanksPerLevel: 2,
      casting: findReviewedClassCasting(classTag),
    } as CharacterSheetClassDetail,
  } as unknown as CatalogEntry;
}

function spellCatalog(spell: SpellDefinition): CatalogEntry {
  return {
    _id: spell.id as Id<'catalogEntry'>,
    _creationTime: 7,
    scope: 'character',
    characterId,
    name: spell.name,
    ruleIdentity: `spell:${spell.id}`,
    stacksWithItself: false,
    sources: [],
    modifiers: [],
    detail: {
      kind: 'spell',
      levels: spell.levels,
      ...(spell.school ? { school: spell.school } : {}),
      ...(spell.description ? { description: spell.description } : {}),
    },
  } as unknown as CatalogEntry;
}

function recordedEntry(recorded: Recorded, index: number): Entry {
  return {
    _id: recorded.id as Id<'characterSheetEntry'>,
    _creationTime: 40 + index,
    characterId,
    kind: 'spell',
    active: true,
    catalogEntryId: recorded.spell.id as Id<'catalogEntry'>,
    state: {
      kind: 'spell',
      ...(recorded.castingClassId
        ? { castingClassId: recorded.castingClassId }
        : {}),
      ...(recorded.level != null ? { level: recorded.level } : {}),
    },
  } as unknown as Entry;
}

/**
 * A sheet whose Class Levels name `classes` in order (a tag repeated for
 * more levels), with every Spell definition the Character owns and the
 * Spells it has recorded.
 */
export function buildSpellSheet({
  classes = [],
  recorded = [],
  definitions = Object.values(spells),
  lastOperationId = 'seed',
  name = 'Kesh',
  accepted = [],
}: {
  classes?: string[];
  recorded?: Recorded[];
  definitions?: SpellDefinition[];
  lastOperationId?: string;
  name?: string;
  accepted?: Accepted[];
} = {}): CharacterSheetSnapshot {
  const base = buildSheet({
    hasClasses: true,
    accepted,
    lastOperationId,
    name,
    levels: classes.map((classId, index) => ({
      id: `level-${index + 1}`,
      hp: 6,
      classId,
    })),
  });
  const extraClasses = [...new Set(classes)].filter(
    (tag) => !base.catalogEntries.some((entry) => entry._id === tag),
  );
  const entries = [...base.entries, ...recorded.map(recordedEntry)];
  const catalogEntries = [
    ...base.catalogEntries,
    ...extraClasses.map(classCatalog),
    ...definitions.map(spellCatalog),
  ];
  const input = {
    entries,
    catalogEntries,
    characterKind: 'pc',
  } satisfies CharacterSheetInput;
  return {
    ...base,
    entries,
    catalogEntries,
    catalogView: {
      releaseNumber: null,
      calculationIdentity: catalogRuntimeCompatibility.calculation,
      resources: { castingTables: undefined },
      legalInputs: null,
      definitions: catalogEntries,
      advisories: [],
    },
    calculated: calculateCharacterSheet(input),
    permanentCalculated: calculateCharacterSheet(input, {
      permanentOnly: true,
    }),
  };
}

type Write = {
  name: string;
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

/** The test's read, browser and write state behind the mocked Convex hooks. */
export const spellsTransport = {
  snapshot: undefined as CharacterSheetSnapshot | null | undefined,
  definitions: Object.values(spells) as SpellDefinition[],
  browserStatus: 'Exhausted' as BrowserStatus,
  browserInfoLoaded: true,
  loadMore: vi.fn(),
  writes: [] as Write[],
  params: new URLSearchParams(),
  replace: vi.fn(),
  maintenance: {
    kind: 'ready',
    readOnly: false,
    message: '',
  } as MigrationMaintenance,
};

export function resetSpellsTransport(query = 'from=%2Fcharacters') {
  spellsTransport.snapshot = undefined;
  spellsTransport.definitions = Object.values(spells);
  spellsTransport.browserStatus = 'Exhausted';
  spellsTransport.browserInfoLoaded = true;
  spellsTransport.loadMore = vi.fn();
  spellsTransport.writes = [];
  spellsTransport.params = new URLSearchParams(query);
  spellsTransport.replace = vi.fn((href: string) => {
    spellsTransport.params = new URLSearchParams(href.split('?')[1] ?? '');
  });
  spellsTransport.maintenance = { kind: 'ready', readOnly: false, message: '' };
}

/** The last write of this mutation, to settle it. */
export function lastWrite(name: string) {
  const write = [...spellsTransport.writes]
    .reverse()
    .find((call) => call.name === name);
  if (!write) throw new Error(`Expected a ${name} write`);
  return write;
}

type BrowseArgs = {
  catalogReleaseNumber?: number | null;
  castingClassId: string;
  spellLevel?: number;
  search?: string;
  school?: string;
  includeOtherLists?: boolean;
};

// As the class-list index stores it: a Spell's level on this list, else
// its recorded explicit level, else its lowest level on any list.
function indexedLevel(spell: SpellDefinition, castingClassId: string) {
  const listed = spell.levels[castingClassId];
  if (listed !== undefined) return listed;
  const recorded = spellsTransport.snapshot?.entries.find(
    (entry) =>
      entry.kind === 'spell' &&
      entry.catalogEntryId === spell.id &&
      entry.state.castingClassId === castingClassId,
  );
  if (recorded?.kind === 'spell' && recorded.state.level !== undefined)
    return recorded.state.level;
  const levels = Object.values(spell.levels);
  return levels.length > 0 ? Math.min(...levels) : null;
}

function isRecorded(spell: SpellDefinition, castingClassId: string) {
  return (
    spellsTransport.snapshot?.entries.some(
      (entry) =>
        entry.kind === 'spell' &&
        entry.catalogEntryId === spell.id &&
        entry.state.castingClassId === castingClassId,
    ) ?? false
  );
}

function listRows(args: BrowseArgs) {
  return spellsTransport.definitions.filter(
    (spell) =>
      args.includeOtherLists === true ||
      spell.levels[args.castingClassId] !== undefined ||
      isRecorded(spell, args.castingClassId),
  );
}

function browseRows(args: BrowseArgs) {
  return listRows(args)
    .filter((spell) => {
      if (args.school && spell.school !== args.school) return false;
      if (args.search)
        return spell.name.toLowerCase().includes(args.search.toLowerCase());
      return indexedLevel(spell, args.castingClassId) === args.spellLevel;
    })
    .map((spell) => ({
      catalogReleaseNumber:
        spellsTransport.snapshot?.catalogView?.releaseNumber,
      catalogEntryId: spell.id as Id<'catalogEntry'>,
      ruleIdentity: `spell:${spell.id}`,
      name: spell.name,
      school: spell.school ?? '',
      description: spell.description ?? '',
      spellLevel: indexedLevel(spell, args.castingClassId),
      onList: spell.levels[args.castingClassId] !== undefined,
      recorded: isRecorded(spell, args.castingClassId),
    }));
}

function browserInfo(args: BrowseArgs) {
  if (!spellsTransport.browserInfoLoaded) return undefined;
  const rows = listRows(args);
  const levels = [
    ...new Set(
      rows.flatMap((spell) => {
        const level = indexedLevel(spell, args.castingClassId);
        return level === null ? [] : [level];
      }),
    ),
  ].sort((a, b) => a - b);
  return {
    catalogReleaseNumber: spellsTransport.snapshot?.catalogView?.releaseNumber,
    levels,
    defaultLevel: levels.includes(1) ? 1 : (levels[0] ?? 0),
    schools: [
      ...new Set(rows.map((spell) => spell.school ?? '').filter(Boolean)),
    ].sort(),
  };
}

const nameOf = characterSheetNames();

export function createSpellsConvexMock() {
  return {
    useQuery: (query: FunctionReference<'query'>, args: unknown) => {
      const name = nameOf(query);
      if (args === 'skip') return undefined;
      // Not a Synthesist: no Combined Form (#421).
      if (name === 'combinedForm') return null;
      if (name === 'read') return spellsTransport.snapshot;
      if (['companions', 'catalogList', 'catalogAdvisories'].includes(name))
        return [];
      if (name === 'spellBrowserInfo') return browserInfo(args as BrowseArgs);
      throw new Error(`Unexpected query ${name}`);
    },
    usePaginatedQuery: (query: FunctionReference<'query'>, args: unknown) => {
      const name = nameOf(query);
      if (name !== 'browseSpells') return emptyOwnerCandidates();
      if (args === 'skip')
        return { results: [], status: 'LoadingFirstPage', loadMore: vi.fn() };
      const status = spellsTransport.browserStatus;
      return {
        results:
          status === 'LoadingFirstPage' ? [] : browseRows(args as BrowseArgs),
        status,
        loadMore: spellsTransport.loadMore,
      };
    },
    useMutation: (mutation: FunctionReference<'mutation'>) => {
      const name = nameOf(mutation);
      return (args: Record<string, unknown>) =>
        new Promise((resolve, reject) => {
          spellsTransport.writes.push({ name, args, resolve, reject });
        });
    },
  };
}

export function createSpellsNavigationMock() {
  return {
    useParams: () => ({ characterId: characterId }),
    usePathname: () => `/characters/${characterId}/spells`,
    useSearchParams: () => spellsTransport.params,
    useRouter: () => ({
      replace: spellsTransport.replace,
      push: vi.fn(),
    }),
  };
}

/** A select as a native one, so a test chooses an option by its value. */
export function createSelectMock() {
  const Select = ({
    value,
    onValueChange,
    disabled,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    disabled?: boolean;
    children: ReactNode;
  }) => {
    const parts = Children.toArray(children);
    const trigger = parts.find(
      (part): part is ReactElement<{ 'aria-label': string }> =>
        isValidElement<{ 'aria-label'?: string }>(part) &&
        typeof part.props['aria-label'] === 'string',
    );
    return (
      <select
        aria-label={trigger?.props['aria-label']}
        disabled={disabled}
        value={value}
        onChange={(event) => onValueChange?.(event.target.value)}
      >
        {parts.filter((part) => part !== trigger)}
      </select>
    );
  };
  return {
    Select,
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectItem: ({
      value,
      children,
    }: {
      value: string;
      children: ReactNode;
    }) => <option value={value}>{children}</option>,
  };
}

export function GuardedLinkMock({
  href,
  children,
  ...props
}: ComponentProps<'a'> & { href: string }) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}

export const sheetOrigin = {
  href: '/campaigns/campaign-1/characters',
  organization: { kind: 'organization', id: 'org' },
} as const;
