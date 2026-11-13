import type { z } from 'zod';
import type {
  CastingAdvanceKind,
  classCastingAdvancesSchema,
} from '../../../src/lib/character-sheet-casting-tables';
import type { PreviewEntry } from '../map';
import {
  hashStructureSource,
  type StructureReviewItem,
  type StructureSourcePart,
  type StructureSubject,
} from '../structure-curation';
import type { PcgenEffectiveRecord } from './effective';
import {
  pcgenProvenance,
  productIdentityHolds,
  skillListOf,
} from './entry-fields';
import { toPcgenKey } from './keys';
import type { PcgenPrestigeClass } from './lst';
import { isPrerequisiteToken, parsePrerequisite } from './pre';
import {
  renderRequirement,
  translateRequirement,
  type PrestigeReferences,
  type TranslatedRequirement,
} from './requirements';
import {
  levelsOf,
  type PcgenLevelLine,
  type PcgenSourcedToken,
} from './tokens';

/**
 * #716 P4: a PCGen prestige class as an imported class entry (#406), with its
 * typed entry requirements (plan §3, `requirements.ts`), its casting advances
 * (#415) and the review items the structure gate holds it on (plan §6).
 *
 * - Progression: `HD`, `STARTSKILLPTS`, `CSKILL`, and the BAB and save
 *   formulas (`classlevel` alone is full BAB, `*3/4` three-quarters, `/2`
 *   half; a save divided by 2 is good, by 3 poor). Alignment is a
 *   prerequisite, never `detail.alignments`, which would warn on every level.
 * - Casting advances: one row per class level from its `ADD:SPELLCASTER|ANY`,
 *   `|Arcane` and `|Divine` tokens, same-level tokens merged (Mystic Theurge
 *   gives `['arcane', 'divine']`); a level without one has no row. A
 *   `N:REPEATLEVEL:S` line applies through MAXLEVEL. What the model can't
 *   express is an `uncheckedCasting` item, not a row: a named class or class
 *   list, a counted or feature-granted advance, a whole class-level advance
 *   (`BONUS:PCLEVEL`), the class's own casting, and Master Chymist's
 *   alchemist advance, whose PCGen `Arcane` rows are left out.
 * - Review items: an `uncheckedRequirement` per unchecked clause, a
 *   `conflict` per named requirement exception or data error, an
 *   `uncheckedCasting` per advance the model can't express, `productIdentity`
 *   for NAMEISPI and `option` for a Pathfinder Society record. Variants are
 *   P6's (plan §5).
 * - The source hash covers the block's class and level lines and its applied
 *   `.MOD` lines, each by its raw text.
 */
export type PrestigeClassInput = {
  /** The class's effective record, which wraps its prestige record. */
  effective: PcgenEffectiveRecord & { record: PcgenPrestigeClass };
  externalKey: string;
  references: PrestigeReferences;
};
export type PrestigeClassMapping = {
  subject: StructureSubject;
  items: StructureReviewItem[];
  requirements: TranslatedRequirement[];
};
type Item = Omit<StructureReviewItem, 'externalKey' | 'sourceSha256'>;
type CastingAdvanceRow = z.infer<typeof classCastingAdvancesSchema>[number];

/**
 * Named exceptions by folded class KEY: whether the casting requirement
 * accepts alchemist extracts is open (S8; research note 716-p4 §1, trap 2),
 * so it stays unchecked. The classes' feature text describes what they gain
 * after entry, not their requirement.
 */
const openCastingRequirements = new Map([
  [
    toPcgenKey('Master Chymist'),
    'whether alchemist extracts meet it is open (S8)',
  ],
  [
    toPcgenKey('Thuvian Alchemist'),
    'whether alchemist extracts meet it is open (S8)',
  ],
]);
/**
 * Classes whose text advances a casting the model can't target while PCGen's
 * level lines give a kind: their rows are left out and the advance is held.
 */
const unexpressedAdvances = new Map([
  [
    toPcgenKey('Master Chymist'),
    'Extracts per Day advances alchemist extracts, “as if she had also gained a level in alchemist” (apg_abilities_class.lst:1362); PCGen’s level lines give ADD:SPELLCASTER|Arcane, so no advance rows are mapped.',
  ],
]);
/**
 * Advances a chosen feature grants, not the class table (research note 716-p4
 * §2): PCGen grants them through a selection, so the class's rows can't show
 * them.
 */
const featureAdvances = new Map([
  [
    toPcgenKey('Aspis Agent'),
    'Its Master Caster secret advances a bard, inquisitor or mesmerist casting (ADD:SPELLCASTER|Bard,Inquisitor,Mesmerist, ag_abilities_class.lst:82).',
  ],
  [
    toPcgenKey('Westcrown Devil'),
    'Its Occult Studies I–III talents advance a psychic casting class (ADD:SPELLCASTER|Medium,Mesmerist,Occultist,Psychic,Spiritualist, ag_abilities_class.lst:575-577); the model has no psychic advance kind.',
  ],
  [
    toPcgenKey('Living Monolith'),
    'Its Ib Stone advances a casting from 2nd level (ADD:SPELLCASTER|LivingMonolithLVL-1|ANY, psand_abilities_class.lst:48), a choice that “cannot be changed”, where the model allows a choice per level.',
  ],
  [
    toPcgenKey('Genie Binder'),
    'Its Spellcasting Bonus feature grants a further advance (ADD:SPELLCASTER|ANY, emh_abilities_class_pu.lst:18-19).',
  ],
  [
    toPcgenKey('Pathfinder Field Agent'),
    'Its Greater Casting training advances a casting (ADD:SPELLCASTER|ANY, pfsp_abilities_class.lst:26).',
  ],
  [
    toPcgenKey('Evangelist'),
    'Its Aligned Class adds whole class levels to the chosen class (BONUS:PCLEVEL, campaign_setting/inner_sea_gods/support/abilities_rowpg.lst:24), not a casting advance.',
  ],
]);
const advanceKinds: Record<string, CastingAdvanceKind> = {
  any: 'any',
  arcane: 'arcane',
  divine: 'divine',
};
const advanceFields = ['detail.castingAdvances'];

const tagOf = (token: string) =>
  token.slice(0, Math.max(0, token.indexOf(':')));
const valueOf = (token: string) => token.slice(token.indexOf(':') + 1);
function sourced(tokens: readonly PcgenSourcedToken[], tag: string) {
  return tokens.filter(({ token }) => tagOf(token) === tag);
}
const camelCase = (text: string) =>
  text
    .replace(/[^A-Za-z0-9]+(.)?/g, (_, next: string | undefined) =>
      next ? next.toUpperCase() : '',
    )
    .replace(/^./, (first) => first.toLowerCase());

// --- Requirements ----------------------------------------------------------

function requirementsOf({
  key,
  tokens,
  references,
}: {
  key: string;
  tokens: readonly PcgenSourcedToken[];
  references: PrestigeReferences;
}) {
  const preTokens = tokens.filter(({ token }) => isPrerequisiteToken(token));
  return {
    preTokens,
    requirements: preTokens.map(({ token }) =>
      translateRequirement(parsePrerequisite(token), {
        references,
        openCastingRequirement: openCastingRequirements.get(toPcgenKey(key)),
      }),
    ),
  };
}

/** One item per unchecked clause, and one conflict per exception or data error. */
function requirementItems(requirements: readonly TranslatedRequirement[]) {
  const fields = ['prerequisites'];
  const seen = new Map<string, number>();
  const unique = (id: string) => {
    const count = (seen.get(id) ?? 0) + 1;
    seen.set(id, count);
    return count === 1 ? id : `${id}#${count}`;
  };
  return requirements.flatMap(({ token, clauses, findings }): Item[] => [
    ...clauses.flatMap((clause): Item[] =>
      'unchecked' in clause.prerequisite
        ? [
            {
              kind: 'uncheckedRequirement',
              id: unique(token),
              text: `${token} stays unchecked (${clause.rule.replace(/^unchecked: /, '')}): “${clause.prerequisite.unchecked}”.`,
              fields,
            },
          ]
        : [],
    ),
    ...findings.map(
      (finding): Item => ({
        kind: 'conflict',
        id: unique(`${finding.kind}:${finding.id}`),
        text: finding.text,
        fields,
      }),
    ),
  ]);
}

// --- Progression -----------------------------------------------------------

/** `classlevel("APPLIEDAS=NONEPIC")*3/4` → `CL*3/4`. */
const normalizeFormula = (formula: string) =>
  formula.replace(/classlevel\([^)]*\)/g, 'CL').replace(/[\s()]/g, '');

function babOf(tokens: readonly PcgenSourcedToken[]) {
  const formulas = sourced(tokens, 'BONUS')
    .filter(({ token }) => token.startsWith('BONUS:COMBAT|BASEAB|'))
    .map((found) => ({
      found,
      formula: normalizeFormula(found.token.split('|')[2] ?? ''),
    }));
  const [first] = formulas;
  if (!first || formulas.length > 1) return undefined;
  const bab =
    first.formula === 'CL'
      ? 'full'
      : first.formula === 'CL*3/4'
        ? 'threeQuarters'
        : /^CL(\*1)?\/2$/.test(first.formula)
          ? 'half'
          : undefined;
  return bab ? { bab, found: first.found } : undefined;
}

type Save = 'fort' | 'ref' | 'will';
const saveNames: Record<string, Save> = {
  'BASE.Fortitude': 'fort',
  'BASE.Reflex': 'ref',
  'BASE.Will': 'will',
};
function savesOf(tokens: readonly PcgenSourcedToken[]) {
  const saves: Partial<Record<Save, 'good' | 'poor'>> = {};
  let found: PcgenSourcedToken | undefined;
  for (const token of sourced(tokens, 'BONUS')) {
    if (!token.token.startsWith('BONUS:SAVE|')) continue;
    const [, targets = '', formula = '', ...rest] = token.token.split('|');
    if (
      rest.some((part) => /^PREVAREQ:UseAlternateSaveProgression,1$/.test(part))
    )
      continue;
    const divisor = /\/([23])/.exec(normalizeFormula(formula))?.[1];
    for (const target of targets.split(',')) {
      const save = saveNames[target];
      if (!save || !divisor || saves[save]) return undefined;
      saves[save] = divisor === '2' ? 'good' : 'poor';
    }
    found ??= token;
  }
  const { fort, ref, will } = saves;
  return fort && ref && will && found
    ? { saves: { fort, ref, will }, found }
    : undefined;
}

function progressionOf(tokens: readonly PcgenSourcedToken[]) {
  const numberOf = (tag: string) => {
    const [found] = sourced(tokens, tag);
    const value = found ? Number(valueOf(found.token)) : NaN;
    return found && Number.isFinite(value) ? { value, found } : undefined;
  };
  return {
    hitDie: numberOf('HD'),
    ranks: numberOf('STARTSKILLPTS'),
    maxLevel: numberOf('MAXLEVEL'),
    bab: babOf(tokens),
    saves: savesOf(tokens),
  };
}
type Progression = ReturnType<typeof progressionOf>;

/** The level repeating lines run through: MAXLEVEL, else the highest level line. */
const lastLevelOf = (
  progression: Progression,
  levelLines: readonly PcgenLevelLine[],
) =>
  progression.maxLevel?.value ??
  Math.max(0, ...levelLines.map(({ level }) => level));

function progressionConflicts(
  progression: Progression,
  levelLines: readonly PcgenLevelLine[],
): Item[] {
  const conflict = (id: string, text: string, field: string): Item => ({
    kind: 'conflict',
    id,
    text,
    fields: [field],
  });
  const repeats = levelLines.some(({ repeatEvery }) => repeatEvery !== null);
  return [
    ...(progression.hitDie
      ? []
      : [conflict('HD', 'PCGen gives no hit die.', 'detail.hitDie')]),
    ...(progression.ranks
      ? []
      : [
          conflict(
            'STARTSKILLPTS',
            'PCGen gives no skill ranks per level.',
            'detail.skillRanksPerLevel',
          ),
        ]),
    ...(progression.bab
      ? []
      : [
          conflict(
            'BASEAB',
            'PCGen’s BAB formula is not full, three-quarters or half.',
            'detail.bab',
          ),
        ]),
    ...(progression.saves
      ? []
      : [
          conflict(
            'SAVE',
            'PCGen’s save formulas don’t give each save once as good or poor.',
            'detail.saves',
          ),
        ]),
    ...(progression.maxLevel || !repeats
      ? []
      : [
          conflict(
            'MAXLEVEL',
            `PCGen gives no MAXLEVEL; repeating level lines apply through level ${lastLevelOf(progression, levelLines)}, the highest level line.`,
            'detail.castingAdvances',
          ),
        ]),
  ];
}

/** CSKILL names as runtime skill keys, and the names no runtime skill fits. */
function classSkillsOf(tokens: readonly PcgenSourcedToken[]) {
  const { keys, unsupported } = skillListOf(tokens, 'CSKILL');
  return { classSkills: keys, unsupported };
}

// --- Casting ---------------------------------------------------------------

/**
 * ADD:SPELLCASTER rows by class level, and a hold for each token whose
 * argument names no advance kind (a class, class list or count).
 */
function advanceRowsOf({
  levelLines,
  lastLevel,
}: {
  levelLines: readonly PcgenLevelLine[];
  lastLevel: number;
}) {
  const rows = new Map<number, CastingAdvanceKind[]>();
  const holds: Item[] = [];
  let found: PcgenSourcedToken | undefined;
  for (const line of levelLines)
    for (const token of line.tokens.slice(1)) {
      if (!token.startsWith('ADD:SPELLCASTER|')) continue;
      const kind =
        advanceKinds[token.slice('ADD:SPELLCASTER|'.length).toLowerCase()];
      if (!kind) {
        holds.push({
          kind: 'uncheckedCasting',
          id: `${line.tokens[0]}:${token}`,
          text: `Level ${line.tokens[0]} of ${line.file}:${line.line} gives ${token}, an advance the casting advance model can’t express (a named class, class list or count).`,
          fields: advanceFields,
        });
        continue;
      }
      found ??= { token, file: line.file, line: line.line };
      for (const level of levelsOf(line, lastLevel))
        rows.set(level, [...(rows.get(level) ?? []), kind]);
    }
  const castingAdvances = [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([classLevel, kinds]): CastingAdvanceRow => ({ classLevel, kinds }));
  return { castingAdvances, holds, found };
}

/** The class's own spellcasting tags, which need a casting table, not advances. */
function ownCastingOf({
  tokens,
  levelLines,
}: {
  tokens: readonly PcgenSourcedToken[];
  levelLines: readonly PcgenLevelLine[];
}): Item[] {
  const [own] = [
    ...['SPELLSTAT', 'SPELLTYPE'].flatMap((tag) => sourced(tokens, tag)),
    ...sourced(tokens, 'BONUS').filter(({ token }) =>
      token.startsWith('BONUS:CASTERLEVEL|'),
    ),
    ...levelLines.flatMap((line) =>
      line.tokens
        .slice(1)
        .filter((token) => /^(CAST|KNOWN):/.test(token))
        .map((token) => ({ token, file: line.file, line: line.line })),
    ),
  ];
  return own
    ? [
        {
          kind: 'uncheckedCasting',
          id: 'ownCasting',
          text: `The class has its own spellcasting (${own.token}, ${own.file}:${own.line}); it needs a reviewed casting table, not advances.`,
          fields: ['detail.casting'],
        },
      ]
    : [];
}

/** The named holds: a feature's advance, and an advance the class text gives a named class. */
function namedCastingHolds(key: string): Item[] {
  const hold = (id: string, text: string | undefined): Item[] =>
    text ? [{ kind: 'uncheckedCasting', id, text, fields: advanceFields }] : [];
  return [
    ...hold('feature', featureAdvances.get(toPcgenKey(key))),
    ...hold('alchemist', unexpressedAdvances.get(toPcgenKey(key))),
  ];
}

function castingOf({
  key,
  tokens,
  levelLines,
  lastLevel,
}: {
  key: string;
  tokens: readonly PcgenSourcedToken[];
  levelLines: readonly PcgenLevelLine[];
  lastLevel: number;
}) {
  const rows = advanceRowsOf({ levelLines, lastLevel });
  const unexpressed = unexpressedAdvances.has(toPcgenKey(key));
  return {
    castingAdvances: unexpressed ? [] : rows.castingAdvances,
    found: unexpressed ? undefined : rows.found,
    holds: [
      ...rows.holds,
      ...ownCastingOf({ tokens, levelLines }),
      ...namedCastingHolds(key),
    ],
  };
}

// --- Entry -----------------------------------------------------------------

function recordItems(record: PcgenPrestigeClass) {
  const at = `${record.locator.file}:${record.locator.line}`;
  const items: Item[] = [];
  if (record.isNamePI)
    items.push({
      kind: 'productIdentity',
      id: 'NAMEISPI',
      text: `PCGen marks the name ${record.locator.key} as Product Identity (${at}).`,
    });
  if (record.isPfs)
    items.push({
      kind: 'option',
      id: 'pfs',
      text: `A Pathfinder Society record (${at}), loaded only with its campaign.`,
    });
  return items;
}

function sourcePartsOf(
  effective: PrestigeClassInput['effective'],
): [StructureSourcePart, ...StructureSourcePart[]] {
  const { record } = effective;
  const lines = [
    ...record.classLines,
    ...record.levelLines,
    ...effective.appliedMods.flatMap((mod) => [mod, ...mod.levelLines]),
  ];
  const parts = lines.map(
    (line): StructureSourcePart => ({
      source: {
        source: 'pcgen',
        locator: { file: line.file, line: line.line, key: record.locator.key },
      },
      text: line.text,
    }),
  );
  const [first, ...rest] = parts;
  if (!first) throw new Error(`${record.locator.key} has no class line.`);
  return [first, ...rest];
}

/** A prestige class's effective source hash, as its structure records bind it. */
export function prestigeSourceSha256(
  effective: PrestigeClassInput['effective'],
) {
  return hashStructureSource(sourcePartsOf(effective));
}

/** Maps one PCGen prestige class (plan §3, §6; #406, #415). */
export function mapPrestigeClass({
  effective,
  externalKey,
  references,
}: PrestigeClassInput): PrestigeClassMapping {
  const { record, tokens, levelLines } = effective;
  const { key } = record.locator;
  const { preTokens, requirements } = requirementsOf({
    key,
    tokens,
    references,
  });
  const progression = progressionOf(tokens);
  const casting = castingOf({
    key,
    tokens,
    levelLines,
    lastLevel: lastLevelOf(progression, levelLines),
  });
  const skills = classSkillsOf(tokens);
  const [outputName] = sourced(tokens, 'OUTPUTNAME');
  const [page] = sourced(tokens, 'SOURCEPAGE');
  const [cskill] = sourced(tokens, 'CSKILL');
  const [firstPre] = preTokens;
  const entry: PreviewEntry = {
    externalKey,
    upstreamKey: `pcgen:${record.locator.file}#${key}`,
    pack: record.pack,
    name: outputName ? valueOf(outputName.token) : key,
    detail: {
      kind: 'class',
      classKind: 'prestige',
      tag: camelCase(key),
      hitDie: progression.hitDie?.value ?? 0,
      bab: progression.bab?.bab ?? 'half',
      saves: progression.saves?.saves ?? {
        fort: 'poor',
        ref: 'poor',
        will: 'poor',
      },
      classSkills: skills.classSkills,
      skillRanksPerLevel: progression.ranks?.value ?? 0,
      featuresByLevel: [],
      ...(casting.castingAdvances.length
        ? { castingAdvances: casting.castingAdvances }
        : {}),
    },
    description: '',
    ...(requirements.length
      ? {
          prerequisiteText: preTokens
            .map(({ token }) => renderRequirement(parsePrerequisite(token)))
            .join('; '),
          prerequisites: requirements.flatMap(({ clauses }) =>
            clauses.map(({ prerequisite }) => prerequisite),
          ),
        }
      : {}),
    sources: [
      {
        book: record.book,
        ...(page
          ? { pages: valueOf(page.token).replace(/^p\.?\s*/i, '') }
          : {}),
      },
    ],
    modifiers: [],
    unsupported: [...productIdentityHolds(record), ...skills.unsupported],
    provenance: pcgenProvenance(key, {
      name: record.locator,
      sources: page ?? record.locator,
      prerequisites: firstPre,
      prerequisiteText: firstPre,
      'detail.hitDie': progression.hitDie?.found,
      'detail.skillRanksPerLevel': progression.ranks?.found,
      'detail.bab': progression.bab?.found,
      'detail.saves': progression.saves?.found,
      'detail.classSkills': cskill,
      'detail.castingAdvances': casting.found,
    }),
  };
  const items = [
    ...requirementItems(requirements),
    ...progressionConflicts(progression, levelLines),
    ...casting.holds,
    ...recordItems(record),
  ];
  const sourceSha256 = prestigeSourceSha256(effective);
  return {
    subject: { entry, sourceSha256, locator: entry.upstreamKey },
    items: items.map((item) => ({ ...item, externalKey, sourceSha256 })),
    requirements,
  };
}
