import { toPcgenKey } from './keys';
import {
  recordsByKey,
  type PcgenBoundMod,
  type PcgenDirective,
  type PcgenIndex,
  type PcgenClassBlock,
  type PcgenRecord,
  type PcgenTree,
} from './lst';
import { type PcgenLoadCondition } from './pcc';
import { isPrerequisiteToken } from './pre';
import {
  grantsOf,
  sourcedTokens,
  type PcgenGrant,
  type PcgenLevelLine,
  type PcgenSourcedToken,
} from './tokens';

/**
 * PCGen's effective records (#716 plan §2), merged as PCGen's loader does:
 * native records, then `.COPY`, then `.MOD` in `.pcc` load order, then
 * `.FORGET`. The raw inventory (`lst.ts`) keeps every record and line; this
 * view is what the mappers read.
 *
 * - A copy starts from its source's native content (tokens, grants and their
 *   provenance), its own pack's variant else the first loaded, and its line's
 *   tokens apply over it.
 * - A `.MOD` applies all its tokens (a `CLASS:<name>.MOD` header's too, and
 *   adds its level lines) to each record it binds to.
 * - A token applies by its tag: `TAG:.CLEAR` removes the tag (`PRE:.CLEAR`
 *   every prerequisite); a single-valued tag (KEY, OUTPUTNAME, SOURCEPAGE,
 *   VISIBLE, …) replaces; `FACT:<name>|…` replaces that fact; any other tag
 *   (ABILITY, BONUS, TYPE, DESC, …) adds.
 * - A `.FORGET` removes every record of its key, copies and later sources
 *   included: PCGen runs copies, then modifications, then forgets
 *   (`LstObjectFileLoader.java:96-103`), each forget resolving the object
 *   finally loaded under its key (`:629`).
 * - `.MOD` lines apply in `.pcc` load order: campaigns by descending RANK
 *   (`SourceFileLoader.java:879`), each campaign's files in order, each
 *   file's lines in order (`LstObjectFileLoader.java:641`).
 * - A `.MOD` or `.FORGET` from a conditionally loaded file (a `.pcc` line's
 *   `PRECAMPAIGN`, or a `_pfs` campaign) is not applied: it is an optional
 *   overlay on its targets, with its condition.
 */
export type PcgenOptionalOverlay = {
  kind: 'mod' | 'forget';
  directive: PcgenDirective;
  condition: PcgenLoadCondition;
};
export type PcgenEffectiveRecord = {
  record: PcgenRecord;
  /** For a copy, the record whose content it copied. */
  copiedFrom: PcgenRecord | null;
  /** The merged tokens, each with the line it comes from. */
  tokens: PcgenSourcedToken[];
  levelLines: PcgenLevelLine[];
  grants: PcgenGrant[];
  /** The `.MOD` lines applied, in load order. */
  appliedMods: PcgenBoundMod[];
  optionalOverlays: PcgenOptionalOverlay[];
};
export type PcgenEffectiveView = {
  /** Effective records of every record not forgotten. */
  records: ReadonlyMap<PcgenRecord, PcgenEffectiveRecord>;
  forgotten: { record: PcgenRecord; directive: PcgenDirective }[];
};

const singleValuedTags = new Set([
  'ABB',
  'CATEGORY',
  'CHOOSE',
  'COST',
  'DESCISPI',
  'EDITABLE',
  'EXCLASS',
  'HD',
  'KEY',
  'MAXLEVEL',
  'MEMORIZE',
  'MULT',
  'NAMEISPI',
  'OUTPUTNAME',
  'SORTKEY',
  'SOURCEDATE',
  'SOURCELONG',
  'SOURCEPAGE',
  'SOURCESHORT',
  'SOURCEWEB',
  'SPELLSTAT',
  'SPELLTYPE',
  'STACK',
  'STARTSKILLPTS',
  'VISIBLE',
]);

const tagOf = (token: string) =>
  token.slice(0, Math.max(0, token.indexOf(':')));
const factName = (token: string) => token.slice('FACT:'.length).split('|')[0];

function removalOf(token: string): (existing: string) => boolean {
  const tag = tagOf(token);
  const value = token.slice(tag.length + 1);
  if (tag === 'PRE') return isPrerequisiteToken;
  if (value === '.CLEAR' || value === '.CLEARALL')
    return (existing) => tagOf(existing) === tag;
  if (value.startsWith('.CLEAR')) {
    const cleared = `${tag}:${value.slice('.CLEAR'.length + 1)}`;
    return (existing) => existing === cleared;
  }
  if (singleValuedTags.has(tag)) return (existing) => tagOf(existing) === tag;
  if (tag === 'FACT')
    return (existing) =>
      tagOf(existing) === 'FACT' && factName(existing) === factName(token);
  return () => false;
}

/** Applies a directive line's tokens (all but its header) over merged tokens. */
export function applyTokens(
  merged: readonly PcgenSourcedToken[],
  added: readonly PcgenSourcedToken[],
) {
  return added.reduce<PcgenSourcedToken[]>(
    (result, next) => {
      const isRemoved = removalOf(next.token);
      const kept = result.filter(
        ({ token }, index) => index === 0 || !isRemoved(token),
      );
      return next.token.includes(':.CLEAR') ? kept : [...kept, next];
    },
    [...merged],
  );
}

const isClassBlock = (record: PcgenRecord): record is PcgenClassBlock =>
  'classLines' in record;

/** A record's own content: its line, or every line of a class block. */
function nativeTokens(record: PcgenRecord) {
  const [first, ...rest] = isClassBlock(record)
    ? record.classLines
    : [{ ...record.locator, tokens: record.tokens }];
  return rest.reduce(
    (merged, line) => applyTokens(merged, sourcedTokens(line).slice(1)),
    first ? sourcedTokens(first) : [],
  );
}

function newEffective(
  record: PcgenRecord,
  tokens: PcgenSourcedToken[],
): PcgenEffectiveRecord {
  return {
    record,
    copiedFrom: null,
    tokens,
    levelLines: isClassBlock(record) ? [...record.levelLines] : [],
    grants: [],
    appliedMods: [],
    optionalOverlays: [],
  };
}

const compareLoads = (a: PcgenDirective, b: PcgenDirective) =>
  a.load.position === b.load.position
    ? a.line - b.line
    : a.load.position - b.load.position;

function copySource(index: PcgenIndex, copy: PcgenDirective) {
  const natives = recordsByKey(index, copy.key).filter(
    (record) => !record.copyOf,
  );
  const own = natives.filter((record) => record.pack === copy.pack);
  return [...(own.length > 0 ? own : natives)].sort(
    (a, b) =>
      a.load.position - b.load.position || a.locator.line - b.locator.line,
  )[0];
}

/** Copies: their source's native content, then the copy line over it. */
function startEffective(
  tree: PcgenTree,
  record: PcgenRecord,
  natives: ReadonlyMap<PcgenRecord, PcgenSourcedToken[]>,
) {
  const copy = record.copyOf;
  if (!copy) return newEffective(record, natives.get(record) ?? []);
  const index = tree.abilities.get(toPcgenKey(copy.category)) ?? new Map();
  const source = copySource(index, copy);
  const [name] = sourcedTokens({ ...record.locator, tokens: record.tokens });
  const inherited = (source ? (natives.get(source) ?? []) : []).slice(1);
  const effective = newEffective(
    record,
    applyTokens(
      name ? [name, ...inherited] : inherited,
      sourcedTokens(copy).slice(1),
    ),
  );
  effective.copiedFrom = source ?? null;
  return effective;
}

function applyMods(effective: PcgenEffectiveRecord) {
  for (const mod of [...effective.record.mods].sort(compareLoads)) {
    if (mod.load.condition) {
      effective.optionalOverlays.push({
        kind: 'mod',
        directive: mod,
        condition: mod.load.condition,
      });
      continue;
    }
    effective.tokens = applyTokens(
      effective.tokens,
      sourcedTokens(mod).slice(1),
    );
    effective.levelLines.push(...mod.levelLines);
    effective.appliedMods.push(mod);
  }
}

/** The `.FORGET` that removes a record, recording conditional ones as overlays. */
function applyForgets(effective: PcgenEffectiveRecord) {
  const unconditional = effective.record.forgottenBy.filter(
    (forget) => !forget.load.condition,
  );
  for (const forget of effective.record.forgottenBy)
    if (forget.load.condition)
      effective.optionalOverlays.push({
        kind: 'forget',
        directive: forget,
        condition: forget.load.condition,
      });
  return unconditional[0] ?? null;
}

function allRecords(tree: PcgenTree) {
  return [
    ...[...tree.abilities.values()].flatMap((index) =>
      [...index.values()].flat(),
    ),
    ...tree.prestigeClasses,
    ...tree.baseClasses,
  ];
}

/** Builds the effective view of a raw tree. */
export function buildEffectiveView(tree: PcgenTree): PcgenEffectiveView {
  const records = allRecords(tree);
  const natives = new Map(
    records
      .filter((record) => !record.copyOf)
      .map((record) => [record, nativeTokens(record)]),
  );
  const view = new Map<PcgenRecord, PcgenEffectiveRecord>();
  const forgotten: PcgenEffectiveView['forgotten'] = [];
  for (const record of records) {
    const effective = startEffective(tree, record, natives);
    applyMods(effective);
    effective.grants = grantsOf([
      ...effective.tokens,
      ...effective.levelLines.flatMap(sourcedTokens),
    ]);
    const forget = applyForgets(effective);
    if (forget) forgotten.push({ record, directive: forget });
    else view.set(record, effective);
  }
  return { records: view, forgotten };
}
