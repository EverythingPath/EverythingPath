import {
  recordsByKey,
  type PcgenIndex,
  type PcgenPrestigeClass,
  type PcgenRecord,
  type PcgenTree,
} from './lst';
import { toPcgenKey } from './keys';
import { tagValue, type PcgenGrant } from './tokens';

/**
 * The #716 inventory of PCGen archetypes, prestige classes and the features
 * they own (plan §1, Appendices A, B, D, F, G), over the raw source inventory.
 *
 * - Every `CATEGORY:Archetype` line is an owner of one kind; none is dropped.
 *   Helpers are `VISIBLE:NO`/`QUALIFY` lines; options are records such as
 *   "Alternate Alignment" or "Remove Scribe Scroll"; a key outside the
 *   `<Class> Archetype ~ <Name>[ ~ <SUFFIX>]` form is noncanonical, its class
 *   taken from `ASPECT:Archetype Base Class` or else left to review.
 * - Every prestige `CLASS:` record is an owner.
 * - An owned row is one (owner locator, feature locator) pair. An owner's
 *   direct grants are its raw grants (its lines' and its bound `.MOD`
 *   lines'); a prestige class's `CATEGORY:Class` grants expand to that
 *   record's grants. Grants of owned features are followed as nested rows
 *   (depth 2 and up).
 * - Only Special Ability grants are features: `Special Ability`, or an
 *   ABILITYCATEGORY whose parent is Special Ability. Selector grants (`%`,
 *   `TYPE…`) are counted, not resolved.
 * - A grant binds to the same-key variants in the owner's own pack, else to
 *   every variant of the key. Each variant is its own row, with its own
 *   locator, book and Product Identity flags.
 */
export type PcgenOwnerKind =
  | 'canonical'
  | 'noncanonical'
  | 'familiar/companion'
  | 'option'
  | 'helper'
  | 'prestige';
export type PcgenOwner =
  | {
      kind: Exclude<PcgenOwnerKind, 'prestige'>;
      record: PcgenRecord;
      /** The base class (`Fighter`, `Unchained Monk`); null for a noncanonical key or option left to review. */
      className: string | null;
    }
  | { kind: 'prestige'; record: PcgenPrestigeClass; className: null };
type RowFields = {
  owner: PcgenOwner;
  /** The granted key, as the grant spells it. */
  key: string;
  /** How many records have the key (all variants, in every pack). */
  variants: number;
  /** 1 for a direct grant; 2 and up for grants of owned features. */
  depth: number;
  /** The key of the owned feature that granted a nested row. */
  via: string | null;
};
/**
 * `same-pack`: the owner's pack has the key; `other-pack`: it doesn't, so
 * every variant binds; `unresolved`: no record has the key.
 */
export type PcgenOwnedRow = RowFields &
  (
    | { binding: 'same-pack' | 'other-pack'; feature: PcgenRecord }
    | { binding: 'unresolved'; feature: null }
  );
export type PcgenInventory = {
  owners: PcgenOwner[];
  rows: PcgenOwnedRow[];
  /** Selector grants (`%`, `TYPE…`) met while following owners' grants. */
  selectorGrants: number;
};

const canonicalKey =
  /^(?<className>.+?) Archetype ~ (?<name>.+?)(?: ~ (?<suffix>[A-Z]+))?$/;
const optionKey = /Alternate Alignment|^Remove |\/ Remove /;

function archetypeKind(record: PcgenRecord, className: string | null) {
  const visible = tagValue(record.tokens, 'VISIBLE');
  if (visible === 'NO' || visible === 'QUALIFY') return 'helper';
  if (optionKey.test(record.locator.key)) return 'option';
  if (!canonicalKey.test(record.locator.key)) return 'noncanonical';
  return className === 'Familiar' || className === 'Companion'
    ? 'familiar/companion'
    : 'canonical';
}

/**
 * Archetypes whose key names another class than the one their source
 * requires, each given its required class on review (#716 P7d). Both are
 * antipaladin archetypes keyed `Paladin Archetype ~`: they require the
 * antipaladin (`PRECLASS:1,Antipaladin=1`) and are typed
 * `AntipaladinArchetype`. Their keys, and so their identities, stay. A
 * general "the required class wins" rule would also move 18 other canonical
 * archetypes, where PCGen's `PRECLASS` is the copied mistake (Untamed Rager
 * requires the alchemist, player_companion/dirty_tactics_toolbox/
 * dtt_abilities_class.lst:38)
 * or names the class an Unchained version shares (`PRECLASS:1,Monk=1` on
 * every Unchained monk archetype, roleplaying_game/ultimate_intrigue/support/
 * ui_abilities_class_pu.lst:15-16), so it is no rule.
 */
const reviewedArchetypeClasses: ReadonlyMap<string, string> = new Map([
  // Champions of Corruption p.22; coc_abilities_class.lst:12.
  [toPcgenKey('Paladin Archetype ~ Dread Vanguard'), 'Antipaladin'],
  // Ultimate Combat p.63; uc_abilities_class.lst:1446.
  [toPcgenKey('Paladin Archetype ~ Knight Of The Sepulcher'), 'Antipaladin'],
]);

function classifyArchetype(record: PcgenRecord): PcgenOwner {
  const aspect = record.tokens.find((token) =>
    token.startsWith('ASPECT:Archetype Base Class|'),
  );
  const className =
    reviewedArchetypeClasses.get(toPcgenKey(record.locator.key)) ??
    canonicalKey.exec(record.locator.key)?.groups?.className ??
    aspect?.split('|').at(-1) ??
    null;
  return { kind: archetypeKind(record, className), record, className };
}

/** Records a grant binds to: its same-pack variants, else every variant. A trailing `(choice)` falls back to the bare key. */
export function resolveGrant(index: PcgenIndex, key: string, pack: string) {
  const exact = recordsByKey(index, key);
  const variants =
    exact.length > 0
      ? exact
      : recordsByKey(index, key.replace(/ \([^()]*\)$/, ''));
  const local = variants.filter((variant) => variant.pack === pack);
  if (local.length > 0)
    return {
      records: local,
      binding: 'same-pack' as const,
      variants: variants.length,
    };
  return {
    records: variants,
    binding:
      variants.length > 0 ? ('other-pack' as const) : ('unresolved' as const),
    variants: variants.length,
  };
}

export const locatorId = (record: PcgenRecord) =>
  `${record.locator.file}:${record.locator.line}`;

type GrantedKey = { category: string; key: string };

/** Every granted key of some grants, with its category. */
const grantedKeys = (grants: readonly PcgenGrant[]): GrantedKey[] =>
  grants.flatMap(({ category, keys }) =>
    keys.map((key) => ({ category, key })),
  );

function directGrants(tree: PcgenTree, owner: PcgenOwner) {
  const granted = grantedKeys(owner.record.grants);
  if (owner.kind !== 'prestige') return granted;
  return granted.flatMap((pair) =>
    pair.category === 'Class'
      ? grantedKeys(
          resolveGrant(
            tree.classRecords,
            pair.key,
            owner.record.pack,
          ).records.flatMap((record) => record.grants),
        )
      : [pair],
  );
}

const isSelector = (key: string) => key.includes('%') || key.startsWith('TYPE');

type Visit = GrantedKey & { depth: number; via: string | null };

/** One owner's rows: a breadth-first walk of its feature grants. */
function ownedRows(tree: PcgenTree, owner: PcgenOwner) {
  const isFeature = (category: string) =>
    category === 'Special Ability' ||
    tree.abilityCategories.get(category) === 'Special Ability';
  const rows: PcgenOwnedRow[] = [];
  const seen = new Set<string>();
  let selectorGrants = 0;
  const frontier: Visit[] = directGrants(tree, owner).map((granted) => ({
    ...granted,
    depth: 1,
    via: null,
  }));
  for (let next = frontier.shift(); next; next = frontier.shift()) {
    const { category, key, depth, via } = next;
    if (!isFeature(category)) continue;
    if (isSelector(key)) {
      selectorGrants += 1;
      continue;
    }
    const resolved = resolveGrant(tree.features, key, owner.record.pack);
    const fields = { owner, key, variants: resolved.variants, depth, via };
    if (resolved.binding === 'unresolved') {
      if (!seen.has(`?${key}`))
        rows.push({ ...fields, binding: 'unresolved', feature: null });
      seen.add(`?${key}`);
      continue;
    }
    for (const feature of resolved.records) {
      if (seen.has(locatorId(feature))) continue;
      seen.add(locatorId(feature));
      rows.push({ ...fields, binding: resolved.binding, feature });
      frontier.push(
        ...grantedKeys(feature.grants).map((granted) => ({
          ...granted,
          depth: depth + 1,
          via: key,
        })),
      );
    }
  }
  return { rows, selectorGrants };
}

/** Inventories every archetype and prestige class owner and the features each owns. */
export function inventoryPcgen(tree: PcgenTree): PcgenInventory {
  const owners: PcgenOwner[] = [
    ...tree.archetypes.map(classifyArchetype),
    ...tree.prestigeClasses.map(
      (record): PcgenOwner => ({ kind: 'prestige', record, className: null }),
    ),
  ];
  const walks = owners.map((owner) => ownedRows(tree, owner));
  return {
    owners,
    rows: walks.flatMap((walk) => walk.rows),
    selectorGrants: walks.reduce((sum, walk) => sum + walk.selectorGrants, 0),
  };
}
