// #413 F2 (#732 P-11): test-only level-12 builds from published content,
// measured against release reconciliation's row, definition and
// relationship limits. The research's "typical Wizard 12" and a Cleric 12
// (`ep-orch/research/413-readiness.md`, section C).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { api, internal } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';
import type { ReleaseRow } from '../src/lib/catalog/release-schema';
import type { releaseFixture } from './catalog-release-fixture';
import { withSheetCatalog } from './character-sheet-catalog';
import { pinnedPath } from './catalog/pinned-sources';

type Fixture = Awaited<ReturnType<typeof releaseFixture>>;
type Scope = { organizationId: string; characterId: Id<'character'> };

/** A pinned pf1 v11.11 Spell: its file, name, school and class lists. */
export type PinnedSpell = {
  key: string;
  name: string;
  school: string;
  levels: Record<string, number>;
  sources: { book: string; pages?: string }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

let pinnedSpells: PinnedSpell[] | undefined;
/** Every Spell in the pinned store, in file order. */
export function readPinnedSpells() {
  if (pinnedSpells) return pinnedSpells;
  const folder = pinnedPath('pf1', 'packs/spells');
  pinnedSpells = readdirSync(folder)
    .filter((file) => file.endsWith('.yaml'))
    .sort()
    .flatMap((file): PinnedSpell[] => {
      const document: unknown = parse(readFileSync(join(folder, file), 'utf8'));
      if (!isRecord(document) || !isRecord(document.system)) return [];
      const system = document.system;
      const learned = isRecord(system.learnedAt) ? system.learnedAt : {};
      const classes = isRecord(learned.class) ? learned.class : {};
      const levels = Object.fromEntries(
        Object.entries(classes).filter(
          (entry): entry is [string, number] => typeof entry[1] === 'number',
        ),
      );
      const id = typeof document._id === 'string' ? document._id : file;
      return typeof document.name === 'string' &&
        typeof system.school === 'string'
        ? [
            {
              key: `pf1/${id}`,
              name: document.name,
              school: system.school,
              levels,
              sources: Array.isArray(system.sources)
                ? system.sources.flatMap((source) =>
                    isRecord(source) && typeof source.id === 'string'
                      ? [
                          {
                            book: source.id,
                            ...(typeof source.pages === 'string'
                              ? { pages: source.pages }
                              : {}),
                          },
                        ]
                      : [],
                  )
                : [],
            },
          ]
        : [];
    });
  return pinnedSpells;
}

/** The first `count` pinned Spells at `level` on `list`, in file order. */
export function pinnedSpellsAt(list: string, level: number, count: number) {
  const spells = readPinnedSpells().filter(
    (spell) => spell.levels[list] === level,
  );
  if (spells.length < count)
    throw new Error(`Only ${spells.length} pinned ${list} ${level} Spells`);
  return spells.slice(0, count);
}

/** A pinned Spell as the importer shapes it for a prepared Catalog Release. */
export function importedSpell(spell: PinnedSpell, description = '') {
  return {
    externalKey: spell.key,
    upstreamKey: spell.key,
    pack: 'spells',
    name: spell.name,
    detail: {
      kind: 'spell' as const,
      levels: spell.levels,
      grantedLevels: {},
      school: spell.school,
      subschools: [],
      descriptors: [],
    },
    description,
    sources: spell.sources,
    modifiers: [],
    unsupported: [],
  };
}

// Core Rulebook feats and traits a level-12 caster takes (CRB ch. 5; APG
// ch. 8 for traits): their names, and the identity each release names.
const wizardFeats = [
  'Improved Initiative',
  'Toughness',
  'Spell Focus',
  'Greater Spell Focus',
  'Craft Wondrous Item',
  'Extend Spell',
  'Quicken Spell',
  'Spell Penetration',
  'Combat Casting',
];
const clericFeats = [
  'Selective Channeling',
  'Extra Channel',
  'Improved Channel',
  'Combat Casting',
  'Craft Wondrous Item',
  'Quicken Spell',
  'Spell Focus',
  'Toughness',
];
const traits = ['Magical Lineage', 'Reactionary'];
// CRB ch. 15 magic items and ch. 6 gear a level-12 caster carries, with
// their listed price (gp) and weight (lb.).
const gear: readonly (readonly [string, number, number])[] = [
  ['Cloak of Resistance +3', 9_000, 1],
  ['Headband of Vast Intelligence +4', 16_000, 1],
  ['Ring of Protection +2', 8_000, 0],
  ['Amulet of Natural Armor +1', 2_000, 0],
  ['Bracers of Armor +4', 16_000, 1],
  ['Belt of Mighty Constitution +2', 4_000, 1],
  ['Ring of Feather Falling', 2_200, 0],
  ['Pearl of Power (1st)', 1_000, 0],
  ['Pearl of Power (2nd)', 4_000, 0],
  ['Pearl of Power (3rd)', 9_000, 0],
  ['Handy Haversack', 2_000, 5],
  ['Wand of Magic Missile', 750, 0],
  ['Wand of Mage Armor', 750, 0],
  ['Wand of Cure Light Wounds', 750, 0],
  ['Scroll of Fly', 375, 0],
  ['Scroll of Dispel Magic', 375, 0],
  ['Scroll of Invisibility', 150, 0],
  ['Scroll of Teleport', 1_125, 0],
  ['Potion of Cure Moderate Wounds', 300, 0],
  ['Potion of Lesser Restoration', 300, 0],
  ['Metamagic Rod, Extend (Lesser)', 3_000, 5],
  ['Metamagic Rod, Silent (Lesser)', 3_000, 5],
  ['Ioun Stone (Clear Spindle)', 4_000, 0],
  ['Boots of Striding and Springing', 5_500, 1],
  ['Spell Component Pouch', 5, 2],
  ['Spellbook', 15, 3],
  ['Quarterstaff', 0, 4],
  ['Light Crossbow', 35, 4],
  ['Bedroll', 0.1, 5],
  ['Silk Rope (50 ft.)', 10, 5],
];
const items = gear.map(([name]) => name);
const traitTypes: Record<string, string> = {
  'Magical Lineage': 'magic',
  Reactionary: 'combat',
};

function keyOf(kind: string, name: string) {
  return `pf1/${kind}-${name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`;
}

type IdentityKind = 'feat' | 'trait' | 'item';

/** Global identities for published feats, traits and items, as F1 allocates them. */
async function insertIdentities(
  t: Fixture['t'],
  kind: IdentityKind,
  names: readonly string[],
) {
  return await t.run(async (ctx) => {
    const ids: Id<'catalogEntry'>[] = [];
    for (const name of names) {
      const ruleIdentity = keyOf(kind, name);
      const existing = await ctx.db
        .query('catalogEntry')
        .withIndex('by_scope_and_ruleIdentity', (q) =>
          q.eq('scope', 'global').eq('ruleIdentity', ruleIdentity),
        )
        .unique();
      const shared = {
        scope: 'global' as const,
        name,
        ruleIdentity,
        stacksWithItself: false,
        modifiers: [],
        sources: [{ book: 'PZO1110' }],
      };
      ids.push(
        existing?._id ??
          (kind === 'item'
            ? await ctx.db.insert('catalogEntry', {
                ...shared,
                detail: { kind, consumable: false },
              })
            : kind === 'feat'
              ? await ctx.db.insert('catalogEntry', {
                  ...shared,
                  detail: { kind },
                })
              : await ctx.db.insert('catalogEntry', {
                  ...shared,
                  detail: { kind },
                })),
      );
    }
    return ids;
  });
}

/** The release bodies of the published feats, traits and items. */
export function publishedRows(): ReleaseRow[] {
  const row = (
    kind: IdentityKind,
    name: string,
    detail: Record<string, string | number | boolean | never[]>,
  ): ReleaseRow => ({
    kind: 'definition',
    key: keyOf(kind, name),
    payload: {
      externalKey: keyOf(kind, name),
      upstreamKey: keyOf(kind, name),
      pack: `${kind}s`,
      name,
      detail,
      description: `${name}.`,
      sources: [{ book: 'PZO1110' }],
      modifiers: [],
      unsupported: [],
    },
  });
  return [
    ...[...new Set([...wizardFeats, ...clericFeats])].map((name) =>
      row('feat', name, { kind: 'feat', featTypes: [], repeatable: 'no' }),
    ),
    ...traits.map((name) =>
      row('trait', name, {
        kind: 'trait',
        traitType: traitTypes[name] ?? 'basic',
      }),
    ),
    ...gear.map(([name, price, weight]) =>
      row('item', name, {
        kind: 'item',
        consumable: /^(Wand|Scroll|Potion) of /.test(name),
        price,
        weight,
      }),
    ),
  ];
}

async function insertEntries(
  t: Fixture['t'],
  characterId: Id<'character'>,
  rows: readonly { kind: 'feat' | 'trait' | 'item'; id: Id<'catalogEntry'> }[],
) {
  await t.run(async (ctx) => {
    for (const { kind, id } of rows) {
      const common = {
        characterId,
        active: true,
        catalogEntryId: id,
      };
      if (kind === 'feat')
        await ctx.db.insert('characterSheetEntry', {
          ...common,
          kind,
          state: { kind, slot: 'general' },
        });
      else if (kind === 'trait')
        await ctx.db.insert('characterSheetEntry', {
          ...common,
          kind,
          state: { kind },
        });
      else
        await ctx.db.insert('characterSheetEntry', {
          ...common,
          kind,
          state: { kind },
        });
    }
  });
}

async function levelTo(
  { owner }: Fixture,
  scope: Scope,
  { className, level }: { className: string; level: number },
) {
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const casting = sheet?.catalogEntries.find((row) => row.name === className);
  const human = sheet?.catalogEntries.find((row) => row.name === 'Human');
  const first = sheet?.entries.find((row) => row.kind === 'classLevel');
  if (!casting || !human || !first) throw new Error(`Missing ${className}`);
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: human._id,
    operationId: 'race',
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: casting._id,
    operationId: 'level-1',
  });
  for (let position = 2; position <= level; position++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      ...scope,
      classEntryId: casting._id,
      operationId: `level-${position}`,
    });
  return casting._id;
}

/**
 * The research's typical Wizard 12: 12 Wizard levels, a Human, 9 feats, 2
 * traits, 30 items and a spellbook of 74 published Spells. The research
 * counts 35 cantrips, 29 leveled and 10 bought Spells; the pinned store
 * holds 24 wizard cantrips, so its 11 more are leveled Spells.
 */
export async function buildWizard12(fixture: Fixture, scope: Scope) {
  const wizard = await levelTo(fixture, scope, {
    className: 'Wizard',
    level: 12,
  });
  const spellbook = [
    ...pinnedSpellsAt('wizard', 0, 24),
    ...Object.entries({ 1: 9, 2: 9, 3: 9, 4: 8, 5: 8, 6: 7 }).flatMap(
      ([level, count]) => pinnedSpellsAt('wizard', Number(level), count),
    ),
  ];
  await recordSpells(fixture, scope, {
    castingClassId: wizard,
    spells: spellbook,
  });
  await addPublishedEntries(fixture, scope.characterId, wizardFeats);
  return { castingClassId: wizard, spellbook };
}

/**
 * A Wizard 12 whose spellbook installs `spells` and records the first
 * `recorded` of them, with no feats, traits or gear (#413 F2 fix r1).
 */
export async function buildWizardSpellbook(
  fixture: Fixture,
  scope: Scope,
  { spells, recorded }: { spells: readonly PinnedSpell[]; recorded: number },
) {
  const wizard = await levelTo(fixture, scope, {
    className: 'Wizard',
    level: 12,
  });
  await recordSpells(fixture, scope, {
    castingClassId: wizard,
    spells,
    recorded,
  });
  return { castingClassId: wizard };
}

/** A Cleric 12: 12 Cleric levels, a Human, 8 feats, 2 traits and 30 items. */
export async function buildCleric12(fixture: Fixture, scope: Scope) {
  const cleric = await levelTo(fixture, scope, {
    className: 'Cleric',
    level: 12,
  });
  await addPublishedEntries(fixture, scope.characterId, clericFeats);
  return { castingClassId: cleric };
}

async function addPublishedEntries(
  fixture: Fixture,
  characterId: Id<'character'>,
  feats: readonly string[],
) {
  const { t } = fixture;
  const featIds = await insertIdentities(t, 'feat', feats);
  const traitIds = await insertIdentities(t, 'trait', traits);
  const itemIds = await insertIdentities(t, 'item', items);
  await insertEntries(t, characterId, [
    ...featIds.map((id) => ({ kind: 'feat' as const, id })),
    ...traitIds.map((id) => ({ kind: 'trait' as const, id })),
    ...itemIds.map((id) => ({ kind: 'item' as const, id })),
  ]);
}

/**
 * The Spells installed as prepared imports, the first `recorded` of them
 * (all by default) recorded in the spellbook.
 */
async function recordSpells(
  { owner }: Fixture,
  scope: Scope,
  {
    castingClassId,
    spells,
    recorded = spells.length,
  }: {
    castingClassId: Id<'catalogEntry'>;
    spells: readonly PinnedSpell[];
    recorded?: number;
  },
) {
  const ids: Id<'catalogEntry'>[] = [];
  for (let offset = 0; offset < spells.length; offset += 64)
    ids.push(
      ...(await owner.mutation(
        internal.characterSheetSpells.installPreparedCatalog,
        {
          ...scope,
          spells: spells
            .slice(offset, offset + 64)
            .map((spell) => importedSpell(spell)),
          operationId: `install-${offset}`,
        },
      )),
    );
  for (const [index, catalogEntryId] of ids.slice(0, recorded).entries())
    await owner.mutation(api.characterSheetSpells.record, {
      ...scope,
      castingClassId,
      catalogEntryId,
      operationId: `record-${index}`,
    });
}

/** Adds published gear until the sheet holds `rows` rows. */
export async function fillToRows(
  t: Fixture['t'],
  characterId: Id<'character'>,
  rows: number,
) {
  await t.run(async (ctx) => {
    const existing = await ctx.db
      .query('characterSheetEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .take(rows + 1);
    const gear = await ctx.db
      .query('catalogEntry')
      .withIndex('by_scope_and_ruleIdentity', (q) =>
        q.eq('scope', 'global').eq('ruleIdentity', 'pf1/item-bedroll'),
      )
      .unique();
    const bedroll =
      gear?._id ??
      (await ctx.db.insert('catalogEntry', {
        scope: 'global',
        name: 'Bedroll',
        ruleIdentity: 'pf1/item-bedroll',
        stacksWithItself: false,
        modifiers: [],
        sources: [{ book: 'PZO1110' }],
        detail: { kind: 'item', consumable: false },
      }));
    for (let row = existing.length; row < rows; row++)
      await ctx.db.insert('characterSheetEntry', {
        characterId,
        kind: 'item',
        active: true,
        catalogEntryId: bedroll,
        state: { kind: 'item' },
      });
  });
}
