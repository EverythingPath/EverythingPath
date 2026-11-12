import {
  alignments,
  alignmentNames,
  type Alignment,
  type Prerequisite,
  type PrerequisiteAtom,
} from '../../../src/lib/character-sheet-prerequisite-schema';
import type { ManualProficiency } from '../../../src/lib/character-sheet-proficiency-schema';
import { skillDefinitions } from '../../../src/lib/character-sheet-skill-definitions';
import { formatPrerequisite, type PcgenPrerequisite } from './pre';

/**
 * Plan §3: a prestige class's PCGen PRExxx tokens as #313/#320 prerequisites.
 * A tag translates only by the plan's rules and the named exceptions below;
 * anything else becomes one `unchecked` clause of readable text, which
 * evaluates as unresolved, never failed. "n-of-k" is a tag that requires n of
 * its k items: all of them become separate clauses, one of them a flat
 * `anyOf`, and any other count stays unchecked.
 *
 * Each tag's rendering and translation live together in `tagHandlers`, so a
 * newly supported tag is one entry; a tag without a translation stays
 * unchecked.
 *
 * Named exceptions (research note `716-p4-rules.md` §1, owner brief P4), each
 * reported as a finding so the class goes to review:
 * - `Armor Proficiency (X)`, `Shield Proficiency` and `Exotic Weapon
 *   Proficiency (X)` are proficiency atoms, not feats: a fighter or paladin
 *   holds them through class proficiency. The Foundry prerequisite parser
 *   reads them the same way (`scripts/catalog/prerequisites.ts`).
 * - Eldritch Knight's `CATEGORY=Internal,Weapon Prof ~ Martial` is
 *   proficiency with all martial weapons.
 * - A class whose casting requirement may accept alchemist extracts keeps
 *   its `PRESPELLTYPE` unchecked while that reading is open (S8).
 */
export type PrestigeReferences = {
  /** A feat's catalog key by its PCGen KEY, without a choice (`Weapon Focus`). */
  feat(key: string): string | undefined;
  /** A crosswalked class feature by its PCGen Special Ability KEY (`Alchemist ~ Mutagen`). */
  classFeature(
    key: string,
  ):
    | Pick<
        Extract<PrerequisiteAtom, { classFeature: string }>,
        'classFeature' | 'classFeatureName' | 'classFeatureClass'
      >
    | undefined;
  race(key: string): string | undefined;
  spell(key: string): string | undefined;
  className(key: string): string | undefined;
};
/** One prerequisite a token became, with the rule that made it. */
export type RequirementClause = { rule: string; prerequisite: Prerequisite };
/** Why a translated token needs review: a named exception, or an error in PCGen's data. */
export type RequirementFinding = {
  kind: 'exception' | 'dataError';
  id: string;
  text: string;
};
export type TranslatedRequirement = {
  /** The PRExxx token as PCGen writes it. */
  token: string;
  clauses: RequirementClause[];
  findings: RequirementFinding[];
};
export type RequirementContext = {
  references: PrestigeReferences;
  /**
   * Why the class's casting requirement (`PRESPELLTYPE`) stays unchecked, when
   * its reading is open; otherwise undefined.
   */
  openCastingRequirement: string | undefined;
};
type Translation = Omit<TranslatedRequirement, 'token'>;
type TagHandler = {
  render: (node: PcgenPrerequisite) => string;
  /** Absent: the tag always stays unchecked. */
  translate?: (
    node: PcgenPrerequisite,
    context: RequirementContext,
  ) => Translation;
};

const ordinal = (value: number) => {
  const suffix =
    value % 10 === 1 && value !== 11
      ? 'st'
      : value % 10 === 2 && value !== 12
        ? 'nd'
        : value % 10 === 3 && value !== 13
          ? 'rd'
          : 'th';
  return `${value}${suffix}`;
};
const strings = (node: PcgenPrerequisite) =>
  node.items.filter((item): item is string => typeof item === 'string');
const nodes = (node: PcgenPrerequisite) =>
  node.items.filter(
    (item): item is PcgenPrerequisite => typeof item !== 'string',
  );
const splitPair = (item: string) => {
  const at = item.lastIndexOf('=');
  return at === -1
    ? { name: item.trim(), value: '' }
    : { name: item.slice(0, at).trim(), value: item.slice(at + 1).trim() };
};
const isSelector = (name: string) =>
  /^TYPE[.=]/i.test(name) || name.includes('%');
const nameAfterTilde = (key: string) => key.split(' ~ ').at(-1) ?? key;

/** PCGen's alignment abbreviations; TN is true neutral. */
const pcgenAlignments: Record<string, Alignment> = {
  LG: 'LG',
  LN: 'LN',
  LE: 'LE',
  NG: 'NG',
  TN: 'N',
  NE: 'NE',
  CG: 'CG',
  CN: 'CN',
  CE: 'CE',
};
const spellKinds: Record<string, 'arcane' | 'divine' | 'psychic' | null> = {
  arcane: 'arcane',
  divine: 'divine',
  psychic: 'psychic',
  any: null,
};

// --- Readable text ---------------------------------------------------------

function renderList(count: number | null, labels: string[], joiner = ', ') {
  if (count === null || count >= labels.length) return labels.join(joiner);
  if (count === 1) return `one of ${labels.join(', ')}`;
  return `${count} of ${labels.join(', ')}`;
}
/** A tag that lists its items, `<prefix><n of items>`. */
const listed =
  (prefix: string, joiner = ', ', label = (item: string) => item) =>
  (node: PcgenPrerequisite) =>
    `${prefix}${renderList(node.count, strings(node).map(label), joiner)}`;
function renderSkill(item: string) {
  const { name, value } = splitPair(item);
  const label = /^TYPE\./i.test(name)
    ? `any ${name.slice('TYPE.'.length)} skill`
    : name;
  return `${label} ${value} ranks`;
}
function renderAbility(node: PcgenPrerequisite) {
  const [category = '', ...names] = strings(node);
  const kind = category.replace(/^CATEGORY=/i, '');
  const labels = names.map((name) =>
    /^TYPE[.=]/i.test(name)
      ? `any ${name.replace(/^TYPE[.=]/i, '')} ${kind === 'FEAT' ? 'feat' : 'ability'}`
      : kind === 'FEAT'
        ? name
        : `${nameAfterTilde(name)} (${kind})`,
  );
  return renderList(node.count, labels);
}
function renderSpellType(item: string) {
  const { name, value } = splitPair(item);
  const kind = spellKinds[name.toLowerCase()];
  return `able to cast ${ordinal(Number(value))}-level ${kind ? `${kind} ` : ''}spells`;
}
function renderSpellsOf(node: PcgenPrerequisite) {
  const labels = strings(node).map((item) => {
    const { name, value } = splitPair(item);
    return `${name} spells of ${ordinal(Number(value))} level or higher`;
  });
  return `casts ${node.count ?? ''} ${labels.join(' or ')}`.replace(
    /\s+/g,
    ' ',
  );
}
function renderSpellCast(node: PcgenPrerequisite) {
  return strings(node)
    .map((item) =>
      /^TYPE=/i.test(item)
        ? `casts ${item.slice(5).toLowerCase()} spells`
        : /^MEMORIZE=Y$/i.test(item)
          ? 'prepares spells'
          : /^MEMORIZE=N$/i.test(item)
            ? 'casts spells without preparing them'
            : item,
    )
    .join(', ');
}
function renderAlignment(node: PcgenPrerequisite) {
  const names = strings(node).map((item) => {
    const alignment = pcgenAlignments[item.toUpperCase()];
    return alignment ? alignmentNames[alignment] : `${item} (PCGen)`;
  });
  return `alignment: ${names.join(' or ')}`;
}
function renderDeity(node: PcgenPrerequisite) {
  const items = strings(node);
  if (items.length === 1 && /^(Y|ANY)$/i.test(items[0] ?? ''))
    return 'worships a deity';
  return listed('worships ', ' or ', (item) =>
    item.replace(/^PANTHEON\./, 'a deity of the pantheon '),
  )(node);
}
function renderClass(item: string) {
  const { name, value } = splitPair(item);
  const spellcaster = /^SPELLCASTER\./i.test(name);
  return `${name.replace(/^SPELLCASTER\./i, '')} ${spellcaster ? 'spellcaster ' : ''}level ${value}`;
}
function renderLevel(node: PcgenPrerequisite) {
  return strings(node)
    .map((item) => {
      const { name, value } = splitPair(item);
      return `character level ${value} or ${/^MAX$/i.test(name) ? 'lower' : 'higher'}`;
    })
    .join(' and ');
}
const renderVariable =
  (relation: string) =>
  (node: PcgenPrerequisite): string => {
    const [variable = '', value = ''] = strings(node);
    return `PCGen variable ${variable} ${relation} ${value}`;
  };
function renderMultiple(node: PcgenPrerequisite) {
  const branches = nodes(node).map(
    (branch) => `(${renderRequirement(branch)})`,
  );
  if (node.count === branches.length) return branches.join(' and ');
  if (node.count === 1) return branches.join(' or ');
  return `${node.count} of ${branches.join(', ')}`;
}

// --- Translation -----------------------------------------------------------

const unchecked = (node: PcgenPrerequisite, why: string): Translation => ({
  clauses: [
    {
      rule: `unchecked: ${why}`,
      prerequisite: { kind: 'unchecked', unchecked: renderRequirement(node) },
    },
  ],
  findings: [],
});
const typed = (
  rule: string,
  prerequisite: Prerequisite,
): RequirementClause => ({ rule, prerequisite });
const single = (rule: string, prerequisite: Prerequisite): Translation => ({
  clauses: [typed(rule, prerequisite)],
  findings: [],
});

/** An n-of-k tag: all → separate clauses; one of several → a flat anyOf; else unchecked. */
function byCardinality(
  node: PcgenPrerequisite,
  atoms: (PrerequisiteAtom | undefined)[],
  atomRule: string,
  findings: RequirementFinding[] = [],
): Translation {
  const count = node.count ?? atoms.length;
  if (count > atoms.length)
    return {
      ...unchecked(node, `${node.kind} ${count}-of-${atoms.length}`),
      findings: [
        {
          kind: 'dataError',
          id: formatPrerequisite(node),
          text: `PCGen requires ${count} of only ${atoms.length} items.`,
        },
      ],
    };
  const resolved = atoms.filter((atom) => atom !== undefined);
  if (resolved.length < atoms.length)
    return unchecked(node, `${node.kind} unresolved reference`);
  if (count === resolved.length)
    return {
      clauses: resolved.map((atom) =>
        typed(`${node.kind} all → ${atomRule}`, atom),
      ),
      findings,
    };
  if (count === 1)
    return {
      clauses: [
        typed(`${node.kind} 1-of-${resolved.length} → anyOf ${atomRule}`, {
          anyOf: resolved,
        }),
      ],
      findings,
    };
  return unchecked(node, `${node.kind} ${count}-of-${resolved.length}`);
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** A skill's runtime key: a sheet skill, a named specialty (`skill.prf.dance`), or generic Perform for `TYPE.Perform`. */
export function pcgenSkillKey(name: string) {
  const clean = name.replace(/\s*\(\s*/, ' (').trim();
  if (/^TYPE\.Perform$/i.test(clean)) return 'skill.prf';
  const lower = clean.toLowerCase();
  const exact = skillDefinitions.find(
    (definition) => definition.name.toLowerCase() === lower,
  );
  if (exact) return exact.key;
  const specialty = /^(craft|perform|profession) \((.+)\)$/.exec(lower);
  const base =
    specialty &&
    skillDefinitions.find(
      (definition) => definition.name.toLowerCase() === specialty[1],
    );
  return base && specialty[2] ? `${base.key}.${slug(specialty[2])}` : undefined;
}

function translateSkills(node: PcgenPrerequisite): Translation {
  const items = strings(node).map(splitPair);
  if (
    items.some(({ name }) => isSelector(name) && !/^TYPE\.Perform$/i.test(name))
  )
    return unchecked(node, 'PRESKILL type selector');
  return byCardinality(
    node,
    items.map(({ name, value }) => {
      const key = pcgenSkillKey(name);
      return key
        ? { kind: 'skillRanks', skillRanks: key, min: Number(value) }
        : undefined;
    }),
    'skillRanks',
  );
}

const armorProficiency = /^Armor Proficiency \((Light|Medium|Heavy)\)$/i;
const exoticWeapon = /^Exotic Weapon Proficiency \((.+)\)$/i;

/** A proficiency "feat" read as the proficiency itself (named exception). */
function proficiencyOf(name: string): ManualProficiency | undefined {
  const armor = armorProficiency.exec(name)?.[1]?.toLowerCase();
  if (armor === 'light' || armor === 'medium' || armor === 'heavy')
    return { category: armor };
  if (/^Shield Proficiency$/i.test(name)) return { category: 'shield' };
  if (/^Tower Shield Proficiency$/i.test(name))
    return { category: 'towerShield' };
  const weapon = exoticWeapon.exec(name)?.[1];
  return weapon ? { baseType: weapon } : undefined;
}

function translateFeats(
  node: PcgenPrerequisite,
  names: string[],
  { references }: RequirementContext,
): Translation {
  if (names.some(isSelector))
    return unchecked(node, 'PREABILITY type selector or variable choice');
  const findings: RequirementFinding[] = [];
  const atoms = names.map((name): PrerequisiteAtom | undefined => {
    const proficiency = proficiencyOf(name);
    if (proficiency) {
      findings.push({
        kind: 'exception',
        id: `proficiency:${name}`,
        text: `${name} is read as a proficiency, not a feat: a character can hold it through class proficiency (research note 716-p4 §1, trap 1).`,
      });
      return { kind: 'proficiency', proficiency };
    }
    const choice = /^(.+?) \((.+)\)$/.exec(name);
    const feat = references.feat((choice?.[1] ?? name).trim());
    if (!feat) return undefined;
    return choice?.[2]
      ? { kind: 'feat', feat, choice: choice[2] }
      : { kind: 'feat', feat };
  });
  return byCardinality(node, atoms, 'feat', findings);
}

function translateClassFeatures(
  node: PcgenPrerequisite,
  names: string[],
  { references }: RequirementContext,
): Translation {
  if (names.some(isSelector))
    return unchecked(node, 'PREABILITY type selector or variable choice');
  return byCardinality(
    node,
    names.map((name) => {
      const feature = references.classFeature(name);
      return feature && { kind: 'classFeature', ...feature };
    }),
    'classFeature',
  );
}

/** Eldritch Knight's internal tag for proficiency with all martial weapons (named exception). */
const martialProficiency: Translation = {
  clauses: [
    typed('PREABILITY Internal martial → proficiency', {
      kind: 'proficiency',
      proficiency: { category: 'martial' },
    }),
  ],
  findings: [
    {
      kind: 'exception',
      id: 'proficiency:Weapon Prof ~ Martial',
      text: 'PCGen’s internal martial weapon proficiency tag is read as proficiency with all martial weapons (research note 716-p4 §1, Eldritch Knight).',
    },
  ],
};

function translateAbility(
  node: PcgenPrerequisite,
  context: RequirementContext,
): Translation {
  const [category = '', ...names] = strings(node);
  const kind = category.replace(/^CATEGORY=/i, '');
  if (/^FEAT$/i.test(kind)) return translateFeats(node, names, context);
  if (/^Special Ability$/i.test(kind))
    return translateClassFeatures(node, names, context);
  const [name = ''] = names;
  if (
    /^Internal$/i.test(kind) &&
    node.count === 1 &&
    names.length === 1 &&
    /^Weapon Prof ~ Martial$/i.test(name)
  )
    return martialProficiency;
  return unchecked(node, `PREABILITY CATEGORY=${kind}`);
}

function translateAlignment(node: PcgenPrerequisite): Translation {
  const items = strings(node);
  const mapped = items.map((item) => pcgenAlignments[item.toUpperCase()]);
  if (mapped.some((alignment) => alignment === undefined))
    return unchecked(node, `PREALIGN ${items.join(',')}`);
  const listedSet = new Set(mapped);
  const alignment = alignments.filter(
    (value) => listedSet.has(value) !== node.isNegated,
  );
  return single(
    node.isNegated
      ? 'PREALIGN negated → alignment complement'
      : 'PREALIGN → alignment',
    { kind: 'alignment', alignment },
  );
}

function translateSpellType(
  node: PcgenPrerequisite,
  { openCastingRequirement }: RequirementContext,
): Translation {
  if (openCastingRequirement)
    return unchecked(node, `PRESPELLTYPE ${openCastingRequirement}`);
  const atoms = strings(node)
    .map(splitPair)
    .map(({ name, value }): PrerequisiteAtom | undefined => {
      const kind = spellKinds[name.toLowerCase()];
      if (kind === undefined || !/^\d+$/.test(value)) return undefined;
      const spellLevel = Number(value);
      return kind
        ? { kind: 'canCast', canCast: { spellLevel, kind } }
        : { kind: 'canCast', canCast: { spellLevel } };
    });
  if (atoms.some((atom) => atom === undefined))
    return unchecked(node, 'PRESPELLTYPE kind');
  return byCardinality(node, atoms, 'canCast');
}

/** A tag of named items, each resolved to an atom. */
const namedItems =
  (
    atomRule: string,
    resolve: (
      name: string,
      context: RequirementContext,
    ) => PrerequisiteAtom | undefined,
  ) =>
  (node: PcgenPrerequisite, context: RequirementContext): Translation => {
    const items = strings(node);
    if (items.some(isSelector))
      return unchecked(node, `${node.kind} type selector`);
    return byCardinality(
      node,
      items.map((name) => resolve(name, context)),
      atomRule,
    );
  };

function translateDeity(node: PcgenPrerequisite): Translation {
  const items = strings(node);
  if (
    items.some(
      (item) => /^(Y|ANY|None)$/i.test(item) || /^PANTHEON\./i.test(item),
    )
  )
    return unchecked(node, 'PREDEITY any deity or pantheon');
  return byCardinality(
    node,
    items.map((deity) => ({ kind: 'deity', deity })),
    'deity',
  );
}

function translateRace(
  node: PcgenPrerequisite,
  { references }: RequirementContext,
): Translation {
  const items = strings(node);
  if (items.some((item) => /^RACE(SUB)?TYPE=|^TYPE[.=]/i.test(item)))
    return unchecked(node, 'PRERACE type');
  const keys = items.flatMap((item) => references.race(item) ?? []);
  if (keys.length < items.length)
    return unchecked(node, 'PRERACE unresolved reference');
  if ((node.count ?? 1) !== 1) return unchecked(node, 'PRERACE count');
  return single('PRERACE → race', { kind: 'race', race: keys });
}

function translateClass(
  node: PcgenPrerequisite,
  { references }: RequirementContext,
): Translation {
  const items = strings(node).map(splitPair);
  if (items.some(({ name }) => /^SPELLCASTER\.|^TYPE[.=]/i.test(name)))
    return unchecked(node, 'PRECLASS type');
  return byCardinality(
    node,
    items.map(({ name, value }) => {
      const classLevel = references.className(name);
      return classLevel
        ? { kind: 'classLevel', classLevel, min: Number(value) }
        : undefined;
    }),
    'classLevel',
  );
}

/** `PRELEVEL:MIN=n` is character level n; a maximum level has no atom. */
function translateLevel(node: PcgenPrerequisite): Translation {
  const items = strings(node).map(splitPair);
  const [only] = items;
  if (items.length !== 1 || !only || !/^MIN$/i.test(only.name))
    return unchecked(node, 'PRELEVEL maximum');
  if (!/^\d+$/.test(only.value)) return unchecked(node, 'PRELEVEL formula');
  return single('PRELEVEL MIN → characterLevel', {
    kind: 'characterLevel',
    characterLevel: Number(only.value),
  });
}

function translateTotalBab(node: PcgenPrerequisite): Translation {
  return node.count === null
    ? unchecked(node, 'PRETOTALAB')
    : single('PRETOTALAB → bab', { kind: 'bab', bab: node.count });
}

const isBypass = (item: PcgenPrerequisite) => {
  const [variable = '', value = ''] = strings(item);
  return (
    item.kind === 'PREVAREQ' &&
    !item.isNegated &&
    variable.startsWith('BypassClassAlignment_') &&
    value === '1'
  );
};
/** A single typed atom: not an `anyOf` and not unchecked. */
const typedAtom = (clauses: readonly RequirementClause[]) => {
  const [only] = clauses;
  return clauses.length === 1 &&
    only &&
    !('anyOf' in only.prerequisite) &&
    !('unchecked' in only.prerequisite)
    ? only.prerequisite
    : undefined;
};
const relabel = (translated: Translation, prefix: string): Translation => ({
  clauses: translated.clauses.map((clause) => ({
    ...clause,
    rule: `${prefix} → ${clause.rule}`,
  })),
  findings: translated.findings,
});
const merged = (translations: readonly Translation[]): Translation => ({
  clauses: translations.flatMap(({ clauses }) => clauses),
  findings: translations.flatMap(({ findings }) => findings),
});

/** PCGen's `PREMULT:1,[rule],[PREVAREQ:BypassClassAlignment_*,1]`: the rule alone (plan §3). */
function bypassedRule(
  parts: readonly PcgenPrerequisite[],
  count: number | null,
) {
  const [rule, bypass] = parts;
  return count === 1 && parts.length === 2 && bypass && isBypass(bypass)
    ? rule
    : undefined;
}

function translateMultiple(
  node: PcgenPrerequisite,
  context: RequirementContext,
): Translation {
  const parts = nodes(node);
  if (parts.length !== node.items.length)
    return unchecked(node, 'PREMULT item');
  const rule = bypassedRule(parts, node.count);
  if (rule)
    return relabel(
      translateBranch(rule, context),
      'PREMULT rule + PCGen alignment bypass',
    );
  const translated = parts.map((branch) => translateBranch(branch, context));
  if (node.count === parts.length)
    return relabel(merged(translated), 'PREMULT all-of');
  const atoms = translated.flatMap(({ clauses }) => typedAtom(clauses) ?? []);
  if (node.count === 1 && atoms.length === parts.length)
    return {
      clauses: [typed('PREMULT 1-of-k → flat anyOf', { anyOf: atoms })],
      findings: merged(translated).findings,
    };
  return unchecked(
    node,
    `PREMULT ${node.count}-of-${parts.length} or compound branch`,
  );
}

/** A PREMULT branch: any tag but a nested PREMULT. */
function translateBranch(node: PcgenPrerequisite, context: RequirementContext) {
  return node.kind === 'PREMULT'
    ? unchecked(node, 'nested PREMULT')
    : translateNode(node, context);
}

// --- Tags ------------------------------------------------------------------

const tagHandlers: Record<string, TagHandler> = {
  PRETEXT: {
    render: (node) => formatPrerequisite(node).slice('PRETEXT:'.length).trim(),
  },
  PRESKILL: {
    render: (node) => renderList(node.count, strings(node).map(renderSkill)),
    translate: translateSkills,
  },
  PREABILITY: { render: renderAbility, translate: translateAbility },
  PRETOTALAB: {
    render: (node) =>
      `base attack bonus +${node.count ?? strings(node)[0] ?? ''}`,
    translate: translateTotalBab,
  },
  PREALIGN: { render: renderAlignment, translate: translateAlignment },
  PRESPELLTYPE: {
    render: (node) =>
      renderList(node.count, strings(node).map(renderSpellType), ' and '),
    translate: translateSpellType,
  },
  PREDEITY: { render: renderDeity, translate: translateDeity },
  PRESPELL: {
    render: listed('casts ', ' or '),
    translate: namedItems('castsSpell', (name, { references }) => {
      const castsSpell = references.spell(name);
      return castsSpell ? { kind: 'castsSpell', castsSpell } : undefined;
    }),
  },
  PREWEAPONPROF: {
    render: listed('proficient with ', ', ', (item) =>
      /^TYPE\./i.test(item)
        ? `any ${item.slice(5).toLowerCase()} weapon`
        : item,
    ),
    translate: namedItems('proficiency', (baseType) => ({
      kind: 'proficiency',
      proficiency: { baseType },
    })),
  },
  PRERACE: {
    render: listed('race: ', ' or ', (item) =>
      item.replace(/^RACETYPE=/i, 'type '),
    ),
    translate: translateRace,
  },
  PRECLASS: {
    render: listed('', ' or ', renderClass),
    translate: translateClass,
  },
  PRELEVEL: { render: renderLevel, translate: translateLevel },
  PREMULT: { render: renderMultiple, translate: translateMultiple },
  PRELANG: { render: listed('speaks ') },
  PRESPELLSCHOOL: { render: renderSpellsOf },
  PRESPELLDESCRIPTOR: { render: renderSpellsOf },
  PRESPELLCAST: { render: renderSpellCast },
  PREGENDER: { render: (node) => `gender: ${strings(node).join(', ')}` },
  PRETEMPLATE: { render: listed('template: ', ' or ') },
  PREFACT: {
    render: (node) => `PCGen fact ${strings(node).slice(1).join(', ')}`,
  },
  PREVARGTEQ: { render: renderVariable('at least') },
  PREVARGT: { render: renderVariable('above') },
  PREVAREQ: { render: renderVariable('equal to') },
  PREVARLT: { render: renderVariable('below') },
};

/** A PCGen requirement as readable text: the PRETEXT itself, or a rendering of the tag. */
export function renderRequirement(node: PcgenPrerequisite): string {
  if (node.isNegated)
    return `not: ${renderRequirement({ ...node, isNegated: false })}`;
  return tagHandlers[node.kind]?.render(node) ?? formatPrerequisite(node);
}

function translateNode(
  node: PcgenPrerequisite,
  context: RequirementContext,
): Translation {
  if (node.isNegated && node.kind !== 'PREALIGN')
    return unchecked(node, 'negation');
  const translate = tagHandlers[node.kind]?.translate;
  return translate ? translate(node, context) : unchecked(node, node.kind);
}

/** Translates one PRExxx token of a prestige class (plan §3). */
export function translateRequirement(
  node: PcgenPrerequisite,
  context: RequirementContext,
): TranslatedRequirement {
  return { token: formatPrerequisite(node), ...translateNode(node, context) };
}
