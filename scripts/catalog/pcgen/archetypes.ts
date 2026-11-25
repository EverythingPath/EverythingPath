import type { z } from 'zod';
import type { importedArchetypeDetailSchema } from '../../../src/lib/catalog/imported-entry-schema';
import type { PreviewEntry } from '../map';
import type { Unsupported } from '../records';
import {
  hashStructureSource,
  type OwnedFeature,
  type StructureReviewItem,
  type StructureSourcePart,
  type StructureSubject,
} from '../structure-curation';
import {
  featuresNamedIn,
  isNamedIn,
  normaliseText,
  sentencesOf,
  suffixWords,
} from './archetype-text';
import { archetypeRaceRequirements } from './archetype-races';
import type { PcgenEffectiveRecord, PcgenEffectiveView } from './effective';
import {
  pcgenProvenance,
  productIdentityHolds,
  skillListOf,
} from './entry-fields';
import { resolveGrant } from './inventory';
import { toPcgenKey } from './keys';
import {
  recordsByKey,
  type PcgenIndex,
  type PcgenRecord,
  type PcgenTree,
} from './lst';
import { requirementItems } from './prestige';
import { reviewedGrantsOf } from './reviewed-grants';
import {
  isPrerequisiteToken,
  parsePrerequisite,
  type PcgenPrerequisite,
} from './pre';
import {
  pcgenSchedule,
  resolveSuffix,
  rowKeyOf,
  type PcgenSchedule,
  type ClassSchedule,
  type ScheduledFeature,
  type ScheduleTarget,
} from './schedules';
import type { PcgenSourcedToken } from './tokens';

/**
 * #716 P5: a PCGen archetype as an imported `archetype` entry on the #305
 * model (plan §4; research note 716-p5 §2–§4), with the review items the
 * structure gate holds it on (plan §6) and the features it owns.
 *
 * - PCGen has no REPLACES token. `FACT:<Class>_CF_<F>|true`, or an old-style
 *   TYPE token on the archetype (a GV bridge, else `<Class><F>`), removes F:
 *   a replacement by feature identity. `FACT:<Class>_Archetype_<F>|true`
 *   alone marks F touched: an alteration, which keeps the row and is held
 *   for review (APT A2: whether it replaces the row is read from the text).
 * - Variables map by name through the reviewed schedule, never by PCGen's
 *   gates: a numbered variable is a `part` at its tabled level, an unnumbered
 *   or `_ALL` one the `whole` feature. A feature removed whole and by part is
 *   removed whole; a whole touch flag beside part removals is their stacking
 *   guard, not an alteration.
 * - `featureChanges` names every touched feature, normalised the same way, so
 *   the sheet finds conflicts at the replaced-feature identity (APG p.72;
 *   FAQ June 2015, APT:36, :44).
 * - Additions are the archetype's grants at their `PRECLASS:1,<Class>=N`
 *   level, then its reviewed grants (`reviewed-grants.ts`) at theirs. Granted `CSKILL` lists add class skills (new − base) and, when the
 *   archetype removes the base list (`_CF_ClassSkills`), the replacement list
 *   removes base − new; `CCSKILL` lists remove class skills; a
 *   `BONUS:SKILLPOINTS|NUMBER|n` changes the class's skill ranks per level by
 *   n. A granted `~ Class Skills` or `~ Skill Ranks per Level` record is no
 *   addition.
 * - Review items, never guessed behaviour: an alteration, an option, an
 *   unknown variable, a skill-rank form #305 can't express, a feature
 *   named like a base feature the archetype doesn't remove and a granted
 *   record the import neither emits nor reads (`unemittedGrantItems`)
 *   (`unmatchedReplacement`), a casting touch (`uncheckedCasting`, #422), a
 *   schedule defect, a whole removal whose text names only some increments,
 *   a stacking guard that names other features than the removals, and a
 *   granted choice the text contradicts (`conflict`). Proficiency changes
 *   stay prose (`unsupported`).
 * - A race restriction (archetype-race-eligibility) is a `race` clause in the
 *   entry's `prerequisites`, read from the record's own `PRERACE` and
 *   `PREFACT:1,TEMPLATES,Is<Race>=true` tokens (`archetype-races.ts`); one it
 *   can't type stays an `unchecked` clause, held as an `uncheckedRequirement`.
 */
export type ArchetypeClassContext = {
  tree: PcgenTree;
  view: PcgenEffectiveView;
  schedule: ClassSchedule;
  pcgen: PcgenSchedule;
  /** The base class's skills, as runtime skill keys. */
  baseClassSkills: readonly string[];
};
export type ArchetypeInput = {
  context: ArchetypeClassContext;
  record: PcgenRecord;
  externalKey: string;
  /** The stable key of a feature record the archetype grants. */
  featureKeyOf: (feature: PcgenRecord) => string;
  /**
   * The race keys the import emits: a race requirement naming another is
   * held (`archetype-races.ts`). Omitted, the reviewed race map's keys stand.
   */
  importedRaceKeys?: ReadonlySet<string>;
};
export type ArchetypeMapping = {
  subject: StructureSubject;
  /** One subject per feature record the archetype owns directly. */
  features: StructureSubject[];
  items: StructureReviewItem[];
  ownedFeatures: OwnedFeature[];
};
type Item = Omit<StructureReviewItem, 'externalKey' | 'sourceSha256'>;
type ArchetypeDetail = z.infer<typeof importedArchetypeDetailSchema>;

/** The context of one class's archetypes: its reviewed schedule and PCGen's. */
export function archetypeClassContext({
  tree,
  view,
  schedule,
}: Pick<ArchetypeClassContext, 'tree' | 'view' | 'schedule'>) {
  const pcgen = pcgenSchedule({ tree, view, schedule });
  // An `Internal` record, else a `Special Ability` one (Unchained Summoner
  // ~ Skills, pu_abilities_class.lst:727; Shifter ~ Class Skills,
  // uw_abilities_class.lst:10).
  const { classSkillsRecord } = schedule;
  const [skills] =
    classSkillsRecord === null
      ? []
      : ['Internal', 'Special Ability'].flatMap((category) =>
          recordsByKey(
            tree.abilities.get(toPcgenKey(category)) ?? new Map(),
            classSkillsRecord,
          ),
        );
  const effective = skills ? view.records.get(skills) : undefined;
  return {
    tree,
    view,
    schedule,
    pcgen,
    baseClassSkills: skillListOf(effective?.tokens ?? [], 'CSKILL').keys,
  } satisfies ArchetypeClassContext;
}

const tagOf = (token: string) =>
  token.slice(0, Math.max(0, token.indexOf(':')));
const valueOf = (token: string) => token.slice(token.indexOf(':') + 1);
const fold = (text: string) => text.toLowerCase();
const atOf = ({ file, line }: Pick<PcgenSourcedToken, 'file' | 'line'>) =>
  `${file.split('/').at(-1) ?? file}:${line}`;
const dedupe = <T>(values: readonly T[], keyOf: (value: T) => string) => [
  ...new Map(values.map((value) => [keyOf(value), value])).values(),
];

// --- Signals ---------------------------------------------------------------

/** One removal or touch flag: its variable suffix and the token that set it. */
type Signal = {
  suffix: string;
  removes: boolean;
  token: PcgenSourcedToken;
};

/**
 * The archetype category TYPE, which names no feature: `<Class>Archetype`, or
 * with a space, as the archetype's KEY begins (`TYPE:Archetype.Sorcerer
 * Archetype`, ism_abilities_class.lst:335; `TYPE:Rogue
 * Archetype.RogueArchetype`, oa_abilities_class.lst:1895).
 */
const isCategoryType = (namespace: string, type: string) =>
  type === `${namespace}Archetype` || type === `${namespace} Archetype`;

/**
 * An old-style `<F>Lvl<n>` suffix as the schedule's numbered suffix of F at
 * class level n: a part, or a part the table prints on the acquisition row
 * (`sharedRow`). The level is the class level, not the part's number: a
 * Psychonaut's BombDamageLvl15 is the bomb damage increase at 15th ("replaces
 * the increase to bomb damage at this level",
 * ultimateMagic/spellcastingClassOptions/alchemist.html:421), and Razmiran
 * Priest's BloodlineSpellLvl3 the bloodline spell gained at 3rd,
 * `BloodlineSpell1`. PCGen spells the magus's bridges the same way
 * (`MagusArcanaLvl3`, um_abilities_globalvar.lst:99). Undefined when no
 * numbered suffix of F stands at that level.
 */
function levelledSuffix(schedule: ClassSchedule, suffix: string) {
  const [, stem, level] = /^(\w+?)Lvl(\d+)$/.exec(suffix) ?? [];
  if (!stem || !level) return undefined;
  const classLevel = Number(level);
  const numbered = new RegExp(`^${stem}\\d+$`, 'i');
  const part = schedule.features
    .flatMap(({ parts }) => Object.entries(parts))
    .find(([name, at]) => at === classLevel && numbered.test(name));
  const shared = Object.entries(schedule.nonRows).find(
    ([name, nonRow]) =>
      nonRow.kind === 'sharedRow' &&
      nonRow.level === classLevel &&
      numbered.test(name),
  );
  return (part ?? shared)?.[0];
}

/** A TYPE token's variable suffix: a GV bridge, a reviewed alias, else `<Class><suffix>`. */
function typeSuffix(context: ArchetypeClassContext, type: string) {
  const { flagNamespace: namespace, typeAliases } = context.schedule;
  const bridged = context.pcgen.typeBridges.get(type);
  if (bridged) return bridged;
  if (Object.hasOwn(typeAliases, type)) return typeAliases[type];
  if (!type.startsWith(namespace) || isCategoryType(namespace, type))
    return undefined;
  const suffix = type.slice(namespace.length).replace(/_ALL$/, '');
  return levelledSuffix(context.schedule, suffix) ?? suffix;
}

function signalsOf(
  context: ArchetypeClassContext,
  tokens: readonly PcgenSourcedToken[],
) {
  const { flagNamespace: namespace } = context.schedule;
  const fact = new RegExp(
    `^FACT:${namespace}_(CF|Archetype)_(\\w+)\\|true$`,
    'i',
  );
  const signals: Signal[] = [];
  for (const sourced of tokens) {
    const match = fact.exec(sourced.token);
    if (match?.[1] && match[2])
      signals.push({
        suffix: match[2],
        removes: fold(match[1]) === 'cf',
        token: sourced,
      });
    if (tagOf(sourced.token) !== 'TYPE') continue;
    for (const type of valueOf(sourced.token).split('.')) {
      const suffix = typeSuffix(context, type);
      if (suffix) signals.push({ suffix, removes: true, token: sourced });
    }
  }
  return signals;
}

// --- Targets ---------------------------------------------------------------

type FeatureTouch = {
  feature: ScheduledFeature;
  wholeRemoval: boolean;
  partRemovals: Set<number>;
  markedWhole: boolean;
  markedParts: Set<number>;
  /** Its parent's whole alteration reaches it (`carryToSubfeatures`). */
  isAlteredWithParent: boolean;
  signals: Signal[];
};

function touchesOf(context: ArchetypeClassContext, signals: readonly Signal[]) {
  const features = new Map<string, FeatureTouch>();
  const others: { signal: Signal; target: ScheduleTarget }[] = [];
  for (const signal of signals) {
    const target = resolveSuffix(context.schedule, signal.suffix);
    if (target.kind !== 'feature') {
      others.push({ signal, target });
      continue;
    }
    const touch = features.get(target.feature.id) ?? {
      feature: target.feature,
      wholeRemoval: false,
      partRemovals: new Set<number>(),
      markedWhole: false,
      markedParts: new Set<number>(),
      isAlteredWithParent: false,
      signals: [],
    };
    touch.signals.push(signal);
    if (!signal.removes)
      if (target.classLevel === null) touch.markedWhole = true;
      else touch.markedParts.add(target.classLevel);
    else if (target.classLevel === null) touch.wholeRemoval = true;
    else touch.partRemovals.add(target.classLevel);
    features.set(target.feature.id, touch);
  }
  return { features: [...features.values()], others };
}

const isAlteration = (touch: FeatureTouch) =>
  !touch.wholeRemoval && touch.partRemovals.size === 0;

/**
 * The touches with each whole touch of a feature carried to its named
 * subfeatures (`subfeatureOf`, research note 716-p7-rules §6, decision 1): a
 * removal of bardic performance removes every performance (“do not gain the
 * bardic performance ability or any of its performance types”, Archaeologist,
 * UC p.32), and an alteration of it alters each whole, beside any part the
 * archetype removes, so conflicts are found across the parent (FAQ June 2015,
 * APT:44; docs/character-sheet/archetypes-and-prestige-classes.md:11). A
 * subfeature's own touch keeps its place; the others follow in schedule
 * order.
 */
function carryToSubfeatures({
  schedule,
  touches,
}: {
  schedule: ClassSchedule;
  touches: readonly FeatureTouch[];
}): FeatureTouch[] {
  const expanded = touches.map((touch) => ({ ...touch }));
  const byId = new Map(expanded.map((touch) => [touch.feature.id, touch]));
  for (const parent of touches) {
    const isRemoval = parent.wholeRemoval;
    if (!isRemoval && !(isAlteration(parent) && parent.markedWhole)) continue;
    for (const feature of schedule.features) {
      if (feature.subfeatureOf !== parent.feature.id) continue;
      const touch = byId.get(feature.id) ?? {
        feature,
        wholeRemoval: false,
        partRemovals: new Set<number>(),
        markedWhole: false,
        markedParts: new Set<number>(),
        isAlteredWithParent: false,
        signals: parent.signals,
      };
      if (isRemoval) touch.wholeRemoval = true;
      else touch.isAlteredWithParent = true;
      if (!byId.has(feature.id)) {
        byId.set(feature.id, touch);
        expanded.push(touch);
      }
    }
  }
  return expanded;
}

function structureOf(
  schedule: ClassSchedule,
  touches: readonly FeatureTouch[],
) {
  const replaces: ArchetypeDetail['replaces'] = [];
  const featureChanges: NonNullable<ArchetypeDetail['featureChanges']> = [];
  for (const touch of carryToSubfeatures({ schedule, touches })) {
    const { feature, wholeRemoval, partRemovals } = touch;
    const { externalKey } = feature;
    const altered = isAlteration(touch);
    // The whole changes on a whole removal or alteration, its own or its
    // parent's; a parent's alteration keeps it whole beside the parts the
    // archetype removes, which it still replaces.
    const isWholeChange =
      wholeRemoval ||
      (altered && touch.markedWhole) ||
      touch.isAlteredWithParent;
    if (isWholeChange) featureChanges.push({ externalKey, scope: 'whole' });
    if (wholeRemoval) {
      replaces.push({
        classLevel: feature.levels[0] ?? 1,
        externalKey,
        scope: 'whole',
      });
      continue;
    }
    // An alteration changes what it marks; removals change what they remove.
    const parts = [...(altered ? touch.markedParts : partRemovals)].sort(
      (a, b) => a - b,
    );
    for (const classLevel of parts) {
      if (!isWholeChange)
        featureChanges.push({ externalKey, scope: 'part', classLevel });
      // A part replacement names its row: the increment's own key (P6).
      if (!altered)
        replaces.push({
          classLevel,
          externalKey: rowKeyOf(schedule, feature, classLevel),
          scope: 'part',
        });
    }
  }
  return { replaces, featureChanges };
}

// --- Touch items ------------------------------------------------------------

/** An alteration: a feature marked touched and never removed (APT A2). */
function alterationItems(touches: readonly FeatureTouch[]): Item[] {
  return touches.flatMap((touch) => {
    const [first] = touch.signals;
    return isAlteration(touch) && first
      ? [
          {
            kind: 'unmatchedReplacement',
            id: `alters:${touch.feature.id}`,
            text: `${first.token.token} (${atOf(first.token)}) marks ${touch.feature.name} touched without removing it: an alteration. Whether the archetype's feature replaces the row is read from its text (APT A2).`,
            fields: ['detail.replaces'],
          },
        ]
      : [];
  });
}

/** A touch of a feature that carries the class's casting (#422). */
function castingItems(
  schedule: ClassSchedule,
  touches: readonly FeatureTouch[],
): Item[] {
  return touches.flatMap(({ feature, signals: [first] }) =>
    feature.casting && first
      ? [
          {
            kind: 'uncheckedCasting',
            id: `casting:${feature.id}`,
            text: `The archetype touches ${schedule.className} ${feature.name} (${first.token.token}, ${atOf(first.token)}), a casting change #422 reviews by hand.`,
            fields: ['detail.casting'],
          },
        ]
      : [],
  );
}

/**
 * A part removal of some, not all, rows of a feature whose acquisition record
 * computes every increment from the class level (#716 P6): the increment
 * entries carry no modifiers, so the acquisition row alone yields the value,
 * the full benefit while it survives and none once it is removed. The
 * archetype is held until the remaining value is reviewed. Armor training's
 * numbered parts are one (`armor-training.5JFfSqLMCpbRmERa.yaml:16`).
 */
function partialFormulaItems(touches: readonly FeatureTouch[]): Item[] {
  return touches.flatMap(({ feature, wholeRemoval, partRemovals, signals }) => {
    const isPartial =
      partRemovals.size > 0 && partRemovals.size < feature.levels.length;
    if (wholeRemoval || !isPartial || !feature.acquisitionFormula) return [];
    const removal = signals.find(({ removes }) => removes);
    const levels = [...partRemovals].sort((a, b) => a - b).join(', ');
    return [
      {
        kind: 'conflict',
        id: `partialFormula:${feature.id}`,
        text: `${removal?.token.token ?? 'The archetype'} (${removal ? atOf(removal.token) : '—'}) removes ${feature.name} at ${levels} of ${feature.levels.join(', ')}, but its acquisition record computes every increment from the class level (${feature.acquisitionFormula}), so the remaining rows can't carry their own value.`,
        fields: ['detail.replaces'],
      },
    ];
  });
}

/** A schedule defect whose variables the archetype touches. */
function defectItems(
  schedule: ClassSchedule,
  signals: readonly Signal[],
): Item[] {
  const suffixes = new Set(signals.map(({ suffix }) => fold(suffix)));
  return schedule.defects.flatMap((defect) =>
    defect.suffixes.some((suffix) => suffixes.has(fold(suffix)))
      ? [{ kind: 'conflict', id: `defect:${defect.id}`, text: defect.text }]
      : [],
  );
}

/** A touch of an option, a non-table feature or an unknown variable. */
function nonRowItem(
  schedule: ClassSchedule,
  { signal, target }: { signal: Signal; target: ScheduleTarget },
): Item[] {
  if (target.kind === 'proficiency' || target.kind === 'classSkills') return [];
  const at = `${signal.token.token} (${atOf(signal.token)})`;
  // The same item a touch of the casting row raises (`castingItems`).
  if (target.kind === 'casting')
    return [
      {
        kind: 'uncheckedCasting',
        id: `casting:${target.of}`,
        text: `${at}: ${target.text} A casting change #422 reviews by hand.`,
        fields: ['detail.casting'],
      },
    ];
  const text =
    target.kind === 'option'
      ? `${at} touches an option of ${schedule.features.find(({ id }) => id === target.of)?.name ?? target.of}, which is no table row.`
      : target.kind === 'notOnTable' || target.kind === 'sharedRow'
        ? `${at}: ${target.text}`
        : schedule.kind === 'unscheduled'
          ? `${at}: the ${schedule.className} has no reviewed schedule yet, so what this replaces is read from the text.`
          : `${at} names no ${schedule.className} feature of the reviewed schedule.`;
  return [
    {
      kind: 'unmatchedReplacement',
      id: `${target.kind}:${signal.suffix}`,
      text,
      fields: ['detail.replaces'],
    },
  ];
}

/** A removed proficiency stays prose (plan §4). */
function proficiencyNotes(
  others: ReturnType<typeof touchesOf>['others'],
): Unsupported[] {
  return others.flatMap(({ signal, target }) =>
    target.kind === 'proficiency' && signal.removes
      ? [
          {
            field: 'proficiencies',
            reason: 'Archetype proficiency changes stay prose (#716 plan §4).',
            value: signal.token.token,
          },
        ]
      : [],
  );
}

function touchItems({
  schedule,
  signals,
  touches: { features, others },
}: {
  schedule: ClassSchedule;
  signals: readonly Signal[];
  touches: ReturnType<typeof touchesOf>;
}) {
  const items = [
    ...alterationItems(features),
    ...partialFormulaItems(features),
    ...castingItems(schedule, features),
    ...defectItems(schedule, signals),
    ...others.flatMap((other) => nonRowItem(schedule, other)),
  ];
  return {
    items: dedupe(items, ({ kind, id }) => `${kind} ${id}`),
    unsupported: dedupe(proficiencyNotes(others), (note) =>
      JSON.stringify(note),
    ),
  };
}

// --- Grants ----------------------------------------------------------------

type Granted = {
  effective: PcgenEffectiveRecord;
  classLevel: number;
  isFeature: boolean;
  category: string;
  key: string;
};

function preclassLevel(
  prerequisites: readonly PcgenPrerequisite[],
  className: string,
) {
  for (const node of prerequisites) {
    if (node.kind !== 'PRECLASS' || node.isNegated) continue;
    for (const item of node.items) {
      const match = typeof item === 'string' ? /^(.+)=(\d+)$/.exec(item) : null;
      if (match?.[2] && fold(match[1] ?? '') === fold(className))
        return Number(match[2]);
    }
  }
  return 1;
}

/**
 * An `Internal` record with `SPELLLEVEL:CLASS|` tokens: spells the archetype
 * adds to a class's list at levels of its own, such as an oath's spells
 * (Oath of Vengeance ~ Oath Spells, um_abilities_class.lst:1599). The import
 * emits it as a feature the archetype owns, never dropped, with its
 * description left as PCGen gives it (none) until a record gives one, and
 * holds the archetype on a casting-contract item (`spellLevelItems`).
 */
function isSpellLevelGrant(category: string, effective: PcgenEffectiveRecord) {
  return (
    toPcgenKey(category) === toPcgenKey('Internal') &&
    effective.tokens.some(({ token }) => token.startsWith('SPELLLEVEL:CLASS|'))
  );
}

const internalIndexes = new WeakMap<PcgenEffectiveView, PcgenIndex>();

/** The view's `Internal` records by KEY, as the tree indexes an ability category. */
function internalIndexOf(view: PcgenEffectiveView) {
  const cached = internalIndexes.get(view);
  if (cached) return cached;
  const index = new Map<ReturnType<typeof toPcgenKey>, PcgenRecord[]>();
  for (const { record } of view.records.values()) {
    if (toPcgenKey(record.category) !== toPcgenKey('Internal')) continue;
    const key = toPcgenKey(record.locator.key);
    index.set(key, [...(index.get(key) ?? []), record]);
  }
  internalIndexes.set(view, index);
  return index;
}

/**
 * The spell-level grants (`isSpellLevelGrant`) one key of an archetype's
 * grant resolves to, through the view's `Internal` records, so a forgotten
 * variant is never a candidate. Emission (`grantsOf`) and the identity
 * assignment (`spellLevelGrantsOf`, `featureSubjects`) both resolve them
 * here, so they can't disagree on which record the archetype owns.
 */
function spellLevelGrantRecords({
  view,
  archetype,
  category,
  key,
}: {
  view: PcgenEffectiveView;
  archetype: PcgenEffectiveRecord;
  category: string;
  key: string;
}) {
  if (toPcgenKey(category) !== toPcgenKey('Internal')) return [];
  return resolveGrant(internalIndexOf(view), key, archetype.record.pack)
    .records.flatMap((record) => view.records.get(record) ?? [])
    .filter((effective) => isSpellLevelGrant(category, effective));
}

/** The archetype's spell-level grants: the identity assignment keys each as a feature the archetype owns (`featureSubjects`). */
export function spellLevelGrantsOf(
  archetype: PcgenEffectiveRecord,
  view: PcgenEffectiveView,
) {
  return archetype.grants.flatMap(({ category, keys }) =>
    keys.flatMap((key) =>
      spellLevelGrantRecords({ view, archetype, category, key }),
    ),
  );
}

function grantsOf(
  context: ArchetypeClassContext,
  archetype: PcgenEffectiveRecord,
) {
  const { tree, view } = context;
  const granted: Granted[] = [];
  const unresolved: string[] = [];
  for (const grant of archetype.grants) {
    const isFeature =
      grant.category === 'Special Ability' ||
      tree.abilityCategories.get(grant.category) === 'Special Ability';
    const index = isFeature
      ? tree.features
      : tree.abilities.get(toPcgenKey(grant.category));
    const classLevel = preclassLevel(
      grant.prerequisites,
      context.schedule.flagNamespace,
    );
    for (const key of grant.keys) {
      const { records } = index
        ? resolveGrant(index, key, archetype.record.pack)
        : { records: [] };
      if (!records.length) unresolved.push(`${grant.category}|${key}`);
      const resolved = records.flatMap(
        (record) => view.records.get(record) ?? [],
      );
      // Spell-level grants resolve as the identity assignment resolves them.
      for (const effective of resolved.filter(
        (record) => !isSpellLevelGrant(grant.category, record),
      ))
        granted.push({
          effective,
          classLevel,
          isFeature,
          category: grant.category,
          key,
        });
      for (const effective of spellLevelGrantRecords({
        view,
        archetype,
        category: grant.category,
        key,
      }))
        granted.push({
          effective,
          classLevel,
          isFeature: true,
          category: grant.category,
          key,
        });
    }
  }
  for (const { grant, feature } of reviewedGrantsOf(archetype, view))
    granted.push({
      effective: feature,
      classLevel: grant.classLevel,
      isFeature: true,
      category: grant.category,
      key: grant.feature.key,
    });
  return { granted, unresolved };
}

/**
 * A record's description: its DESC bodies in order, each formula and
 * condition after `|` dropped, an exact repeat of an earlier body dropped
 * (the Bloodrider's `.MOD` line repeats its DESC, acg_abilities_class.lst:
 * 2709, :4618) and `%%`, PCGen's escape, read as a literal `%` ("by 5%%",
 * isc_abilities_class.lst:134). Any other `%` is left as it stands, so a
 * `%1` formula token stays a token.
 */
const descOf = (effective: PcgenEffectiveRecord) =>
  [
    ...new Set(
      effective.tokens
        .filter(({ token }) => tagOf(token) === 'DESC')
        .map(({ token }) => (valueOf(token).split('|')[0] ?? '').trim())
        .filter(Boolean),
    ),
  ]
    .join(' ')
    .replace(/%%/g, '%');

/** The names the schedule knows that are no row: its non-rows' and defects' variables. */
const maskNamesOf = (schedule: ClassSchedule) => [
  ...new Set(
    [
      ...Object.keys(schedule.nonRows),
      ...schedule.defects.flatMap(({ suffixes }) => suffixes),
    ].map(suffixWords),
  ),
];

/** Where a replaces list starts and ends in its sentence's normalised text. */
type ReplaceList = { start: number; end: number };

/**
 * Where the list after a clause's "replaces" starts and ends; the class's
 * feature names in it are read longest first (`replacedFeatureIdsOf`), so
 * "replaces improved evasion" names Improved Evasion and not Evasion, and
 * "alters smite evil, and it replaces aura of good" names only Aura of Good
 * (`featuresNamedIn`). The list ends at "but", "with", "from", "for", a
 * semicolon, a dash or a next verb ("and alters", "and modifies"):
 * "replaces cantrips, but … places them in his spellbook" (Siege Mage)
 * replaces no spellbook, "replaces fast movement and alters bloodline feats"
 * (Blood Conduit) no bloodline feat, and "replaces the tongue of the sun
 * and moon for the chosen forbidden ki power" (Unchained Black Asp) no ki
 * power. "replace" in other senses ("can replace one
 * of her spells known with any bard spell", Studious Librarian) is no
 * replacement.
 */
function replaceListOf(clause: string): ReplaceList | undefined {
  const verb = /\breplaces\b/.exec(clause);
  if (!verb) return undefined;
  const start = verb.index + verb[0].length;
  const after = clause.slice(start);
  const stop =
    /,?\s+(?:but|with|from|for)\b|;|\s[-—]|—|,?\s+and\s+(?:it\s+)?(?:also\s+)?(?:alters|modifies)\b/.exec(
      after,
    );
  return { start, end: start + (stop ? stop.index : after.length) };
}

/**
 * The schedule features a normalised sentence's replaces list
 * (`replaceListOf`, read once by `readReplaces`) names, every feature in
 * one pass.
 */
function replacedFeatureIdsOf({
  text,
  list,
  schedule,
}: {
  text: string;
  list: ReplaceList;
  schedule: ClassSchedule;
}): ReadonlySet<string> {
  return new Set(
    featuresNamedIn(text, schedule.features, maskNamesOf(schedule))
      .filter(({ at, end }) => at >= list.start && end <= list.end)
      .map(({ feature }) => feature.id),
  );
}

/**
 * "replaces bravery 1", "replaces armor training 1, 2, 3, and 4": the
 * name as written, anywhere in a replace clause (Lore Warden's partial
 * text).
 */
function namedIncrements(desc: string, feature: ScheduledFeature) {
  const text = desc.toLowerCase().replace(/’/g, "'");
  const name = feature.name.toLowerCase().replace(/’/g, "'");
  const numbers = new Set<number>();
  let whole = false;
  for (const clause of text.split(/(?<=\.)\s/)) {
    if (!/\breplaces?\b/.test(clause)) continue;
    const at = clause.indexOf(name);
    if (at === -1) continue;
    const after = clause.slice(at + name.length);
    const listed = /^\s+(\d+(?:\s*,\s*\d+)*(?:,?\s*and\s+\d+)?)/.exec(after);
    if (listed?.[1])
      for (const found of listed[1].matchAll(/\d+/g))
        numbers.add(Number(found[0]));
    else whole = true;
  }
  return { numbers, whole };
}

/** A whole removal whose text names only some of its increments (Lore Warden). */
function partialTextItem(
  touch: FeatureTouch,
  granted: readonly Granted[],
): Item[] {
  const { feature } = touch;
  if (!touch.wholeRemoval || feature.levels.length < 2) return [];
  const found = granted.map(({ effective }) => ({
    effective,
    ...namedIncrements(descOf(effective), feature),
  }));
  const named = new Set(found.flatMap(({ numbers }) => [...numbers]));
  if (found.some(({ whole }) => whole) || !named.size) return [];
  if (named.size >= feature.levels.length) return [];
  const quotes = found
    .filter(({ numbers }) => numbers.size)
    .map(
      ({ effective, numbers }) =>
        `${effective.record.locator.key} replaces ${feature.name.toLowerCase()} ${[...numbers].join(', ')} (${atOf(effective.record.locator)})`,
    );
  const removal = touch.signals.find(({ removes }) => removes);
  return [
    {
      kind: 'conflict',
      id: `partialText:${feature.id}`,
      text: `${quotes.join('; ')}, but ${removal?.token.token ?? 'PCGen'} (${removal ? atOf(removal.token) : '—'}) removes all of ${feature.name.toLowerCase()} (${feature.levels.join(', ')}).`,
      fields: ['detail.replaces', 'detail.featureChanges'],
    },
  ];
}

/**
 * A granted feature named like a base feature the archetype doesn't remove
 * alters that feature at its own level (Archer's Weapon Mastery, granted at
 * Fighter 1 by PCGen). The archetype is held until a checked record binds
 * the addition's level and the alteration's identity.
 */
function sameNameItems({
  schedule,
  touches,
  granted,
}: {
  schedule: ClassSchedule;
  touches: readonly FeatureTouch[];
  granted: readonly Granted[];
}): Item[] {
  const touched = new Set(touches.map(({ feature }) => feature.id));
  return granted.flatMap(({ effective, isFeature, classLevel }) => {
    const name = effective.record.locator.key.split(' ~ ').at(-1) ?? '';
    const base = schedule.features.find(
      (feature) => fold(feature.name) === fold(name),
    );
    if (!isFeature || !base || touched.has(base.id)) return [];
    const text = descOf(effective);
    return [
      {
        kind: 'unmatchedReplacement',
        id: `alters:${base.id}`,
        text: `${effective.record.locator.key} (${atOf(effective.record.locator)}${text ? `: “${text}”` : ''}) is granted at ${schedule.className} ${classLevel} and named like the ${schedule.className}'s ${base.name}, gained at ${base.levels.join(', ')} (${base.foundry?.at ?? base.pcgen?.at ?? (schedule.kind === 'reviewed' ? schedule.source.pages : schedule.foundryFile)}), which the archetype doesn't remove: it alters it. The addition's level and the alteration of ${base.name} need review.`,
        fields: ['detail.adds', 'detail.featureChanges'],
      },
    ];
  });
}

/** A granted choice the text contradicts (Dandy's urban favored terrain). */
function contradictedChoiceItems(effective: PcgenEffectiveRecord): Item[] {
  const terrain = /favored terrain \((\w+)\)/i.exec(descOf(effective))?.[1];
  const chosen = effective.grants
    .flatMap(({ keys }) => keys)
    .map((key) => /^Favored Terrain ~ (.+)$/.exec(key)?.[1])
    .find((found) => found !== undefined);
  return terrain && chosen && fold(terrain) !== fold(chosen)
    ? [
        {
          kind: 'conflict',
          id: 'favoredTerrain',
          text: `${effective.record.locator.key} grants Favored Terrain ~ ${chosen} (${atOf(effective.record.locator)}), where its text gives favored terrain (${terrain}).`,
        },
      ]
    : [];
}

/** A granted record's direct lowering of a count variable, at its level. */
type CountDecrement = { sourced: PcgenSourcedToken; level: number };

/** A token lowering a count variable: `BONUS:VAR|<variable>|-<n>`, with or without a prerequisite after it. */
const countDecrementPattern = (variable: string) =>
  new RegExp(`^BONUS:VAR\\|${variable}\\|-\\d+(?:\\||$)`, 'i');

/**
 * The granted records' `BONUS:VAR|<variable>|-<n>` tokens, each at its own
 * `PRECLASS:1,<namespace>=N` level, else at the level the record is granted.
 */
function findCountDecrements({
  variable,
  namespace,
  granted,
}: {
  variable: string;
  namespace: string;
  granted: readonly Granted[];
}): CountDecrement[] {
  const decrement = countDecrementPattern(variable);
  return granted.flatMap(({ effective, classLevel }) =>
    effective.tokens
      .filter(({ token }) => decrement.test(token))
      .map((sourced) => {
        const prerequisites = sourced.token
          .split('|')
          .filter(isPrerequisiteToken)
          .map(parsePrerequisite);
        const isLevelled = prerequisites.some(
          ({ kind }) => kind === 'PRECLASS',
        );
        return {
          sourced,
          level: isLevelled
            ? preclassLevel(prerequisites, namespace)
            : classLevel,
        };
      }),
  );
}

/**
 * The archetype's own removal flags of a feature beside a direct decrement
 * of its count: those flags' gates count the lowered variable again, so
 * PCGen removes their rows twice.
 */
function describeRelatedRemovals({
  schedule,
  feature,
  touch,
  variable,
}: {
  schedule: ClassSchedule;
  feature: ScheduledFeature;
  touch: FeatureTouch | undefined;
  variable: string;
}) {
  const name = feature.name.toLowerCase();
  const flags = dedupe(
    (touch?.signals ?? []).filter(
      ({ removes, suffix }) =>
        removes && resolveSuffix(schedule, suffix).kind === 'feature',
    ),
    ({ suffix }) => fold(suffix),
  ).map(({ suffix }) => suffix);
  const [firstFlag, ...otherFlags] = flags;
  if (!firstFlag) return `No flag the archetype sets removes ${name}.`;
  const removedAt = [...(touch?.partRemovals ?? [])].sort((a, b) => a - b);
  const flagNames = [
    `${schedule.flagNamespace}_CF_${firstFlag}`,
    ...otherFlags,
  ].join(' and ');
  const levels = removedAt.length ? ` at ${removedAt.join(', ')}` : '';
  return `${flagNames} also remove ${name}${levels}, and their gates count ${variable} again, so PCGen takes those rows off twice.`;
}

/**
 * A granted record that lowers a feature's count variable directly
 * (`countVariable`, #716 P7d), which PCGen's part gates for that feature
 * read: Oath against Undeath's ghost touch aura takes Mercies down by 1 at
 * Paladin 3 and 9 (um_abilities_class.lst:1558) beside the Mercy3 and Mercy9
 * flags its archetype sets. The archetype is held, citing the flags that
 * remove the feature too, if any; what it replaces is read from its text.
 */
function listCountDecrementItems({
  schedule,
  touches,
  granted,
}: {
  schedule: ClassSchedule;
  touches: readonly FeatureTouch[];
  granted: readonly Granted[];
}): Item[] {
  return schedule.features.flatMap((feature): Item[] => {
    const variable = feature.countVariable;
    if (!variable) return [];
    const found = findCountDecrements({
      variable,
      namespace: schedule.flagNamespace,
      granted,
    });
    const [first] = found;
    if (!first) return [];
    const levels = [...new Set(found.map(({ level }) => level))].sort(
      (a, b) => a - b,
    );
    const records = dedupe(
      found.map(({ sourced }) => sourced),
      ({ file, line }) => `${file}:${line}`,
    ).map((sourced) => atOf(sourced));
    const related = describeRelatedRemovals({
      schedule,
      feature,
      touch: touches.find((candidate) => candidate.feature === feature),
      variable,
    });
    return [
      {
        kind: 'conflict',
        id: `countDecrement:${feature.id}`,
        text: `${first.sourced.token} lowers ${variable}, the count ${feature.name}'s part gates read, directly at ${levels.join(', ')} (${records.join(', ')}). ${related} What the archetype replaces is read from its text.`,
        fields: ['detail.replaces'],
      },
    ];
  });
}

function grantItems({
  schedule,
  touches,
  granted,
  unresolved,
}: {
  schedule: ClassSchedule;
  touches: readonly FeatureTouch[];
  granted: readonly Granted[];
  unresolved: readonly string[];
}) {
  const featureItems = new Map<PcgenEffectiveRecord, Item[]>();
  for (const { effective, isFeature } of granted) {
    const own = isFeature ? contradictedChoiceItems(effective) : [];
    if (own.length) featureItems.set(effective, own);
  }
  return {
    items: [
      ...touches.flatMap((touch) => partialTextItem(touch, granted)),
      ...listCountDecrementItems({ schedule, touches, granted }),
      ...sameNameItems({ schedule, touches, granted }),
      ...unresolved.map(
        (grant): Item => ({
          kind: 'unmatchedReplacement',
          id: `grant:${grant}`,
          text: `The archetype grants ${grant}, which no feature record resolves.`,
        }),
      ),
    ],
    featureItems,
  };
}

// --- Text disagreements ----------------------------------------------------

/**
 * An alters sentence, read on normalised text (`normaliseText`). Either it
 * says the archetype changes a class feature without replacing it: "This
 * ability alters rage." (Savage Technologist ~ Rage, tg_abilities_class.lst:
 * 44), "This modifies the tactician, greater tactician, and master tactician
 * abilities." (Huntmaster), "…replaces fast movement and alters bloodline
 * feats." (Blood Conduit ~ Contact Specialist, acg_abilities_class.lst:2725);
 * or it describes the archetype's ability by comparison: "This ability
 * otherwise functions as the barbarian ability of the same name." (Jungle
 * Rager ~ Damage Reduction), "In all other ways, this ability functions as
 * and replaces the banner cavalier ability." (Spellscar Drifter). A sentence
 * using these words otherwise, such as "a rogue talent that modifies sneak
 * attacks" or "acts as remove curse", is neither.
 */
const altersVerb =
  /^(?:this|it)(?:\s+[\w-]+)?\s+(?:alters|modifies)\b|(?:,|\band)\s+(?:it\s+)?(?:also\s+)?(?:alters|modifies)\b/;
const worksLikeVerb =
  /\botherwise,?\s+(?:works|functions|acts)\s+(?:like|as)\b|\bin all other (?:ways|respects),?\s+(?:this|it)\b[^.]*?\b(?:works|functions|acts)\s+(?:like|as)\b/;

/**
 * An alters sentence's parts: what an alters verb alters (up to a later
 * "replaces", Gray Paladin ~ Weakened Grace, ui_abilities_class.lst:587:
 * "This ability alters smite evil, …, and it replaces aura of good and
 * divine grace."), or a comparison's subject and what it is compared with.
 */
type AltersReading =
  | { kind: 'alters'; altered: string }
  | { kind: 'comparison'; subject: string; object: string };

function readAlters(text: string): AltersReading | undefined {
  const works = worksLikeVerb.exec(text);
  const alters = altersVerb.exec(text);
  if (alters && (!works || alters.index < works.index)) {
    const after = text.slice(alters.index + alters[0].length);
    const replaces = /\breplaces?\b/.exec(after);
    return {
      kind: 'alters',
      altered: replaces ? after.slice(0, replaces.index) : after,
    };
  }
  return works
    ? {
        kind: 'comparison',
        subject: text.slice(0, works.index),
        object: text.slice(works.index + works[0].length),
      }
    : undefined;
}

/**
 * What an alters sentence that names no schedule feature changes, when it
 * names one of the class's parts the schedule keeps off its rows.
 */
const nonRowSubjects = [
  // Proficiency changes stay prose (plan §4): no structure disagrees.
  { subject: 'proficiencies', pattern: /\bproficienc(?:y|ies)\b/ },
  {
    subject: 'classSkills',
    pattern: /\b(?:class|bonus) skills?\b|\bskill ranks\b/,
  },
  {
    subject: 'casting',
    pattern: /\bspellcasting\b|\bspells?\b|\bspell list\b|\bcasting\b/,
  },
] as const;

/**
 * A text the archetype holds, with the class level its feature is granted
 * at and the schedule features its own TYPE tags name (`taggedFeatureIds`).
 */
type TextHolder = {
  effective: PcgenEffectiveRecord;
  text: string;
  classLevel?: number;
  tagged: ReadonlySet<string>;
};

/**
 * The schedule features a granted feature's own TYPE tags name, read as the
 * archetype's are (`typeSuffix`): PCGen tags an archetype's feature with the
 * class feature it replaces (Samurai Sword Saint ~ Brutal Slash, `TYPE:
 * SpecialAttack.Extraordinary.SamuraiMountedArcher`, dep_abilities_class
 * .lst:28, whose text says "replaces mounted charge").
 */
function taggedFeatureIds(
  context: ArchetypeClassContext,
  effective: PcgenEffectiveRecord,
): ReadonlySet<string> {
  const types = effective.tokens.filter(({ token }) => tagOf(token) === 'TYPE');
  return new Set(
    signalsOf(context, types).flatMap(({ suffix }) => {
      const target = resolveSuffix(context.schedule, suffix);
      return target.kind === 'feature' ? [target.feature.id] : [];
    }),
  );
}

/**
 * The archetype's text: its own DESC (whose TYPE tags are its flags, so
 * none is read as a holder's), then each granted feature's.
 */
function textHoldersOf(
  context: ArchetypeClassContext,
  archetype: PcgenEffectiveRecord,
  granted: readonly Granted[],
): TextHolder[] {
  const features = granted.flatMap(({ effective, isFeature, classLevel }) =>
    isFeature
      ? [
          {
            effective,
            classLevel,
            tagged: taggedFeatureIds(context, effective),
          },
        ]
      : [],
  );
  return dedupe(
    [{ effective: archetype, tagged: new Set<string>() }, ...features],
    ({ effective }) => upstreamKeyOf(effective.record),
  ).map(({ effective, ...rest }) => ({
    effective,
    text: descOf(effective),
    ...rest,
  }));
}

const quoteOf = ({ effective }: TextHolder, sentence: string) =>
  `${effective.record.locator.key} (${atOf(effective.record.locator)}): “${sentence}”`;

/**
 * What a sentence's replaces clause says (`readReplaces`): no replaces
 * list; a list that leaves what it replaces to a choice (`choiceMarker`);
 * or a list naming what it replaces, which may refer back to what the
 * sentence named before it (`referredToOf`). A choice and a back-reference
 * are read from their list and never stand without it, and each list
 * carries the schedule features it names (`replacedFeatureIdsOf`).
 */
export type ReplacesReading =
  | { kind: 'none' }
  | { kind: 'choice'; list: ReplaceList; replaced: ReadonlySet<string> }
  | {
      kind: 'named';
      list: ReplaceList;
      replaced: ReadonlySet<string>;
      referredTo: ReferredTo | undefined;
    };

/**
 * One sentence of the archetype's text, read once for both item paths
 * (`altersTextItems`, `textReplacesItems`): its normalised text, what its
 * replaces clause says (`ReplacesReading`) and what it alters or compares
 * (`readAlters`).
 */
type TextSentence = {
  holder: TextHolder;
  /** The archetype's own DESC holds it, not a granted feature's. */
  isOwnText: boolean;
  sentence: string;
  /** Its place in its holder's text, for a sentence item's id. */
  index: number;
  text: string;
  quote: string;
  replaces: ReplacesReading;
  alters: AltersReading | undefined;
};

const noFeatures: ReadonlySet<string> = new Set();

/** The schedule features a sentence's replaces list names, none without one. */
const replacedBy = (replaces: ReplacesReading) =>
  replaces.kind === 'none' ? noFeatures : replaces.replaced;

/**
 * What a replaces list referring back ("…otherwise identical to quarry and
 * replaces that ability.", Tanglebriar Demonslayer) means: the features
 * the sentence named before its verb, each standing as itself, and whether
 * it named any.
 */
type ReferredTo = { features: ReadonlySet<string>; named: boolean };

function referredToOf({
  schedule,
  classWords,
  text,
  list,
}: {
  schedule: ClassSchedule;
  classWords: ReadonlySet<string>;
  text: string;
  list: ReplaceList;
}): ReferredTo | undefined {
  if (!anaphora.test(text.slice(list.start, list.end))) return;
  const before = text.slice(0, list.start);
  const named = featuresNamedIn(
    before,
    schedule.features,
    maskNamesOf(schedule),
  );
  return {
    features: new Set(
      named
        .filter(({ at }) => standsAlone(before, at, classWords))
        .map(({ feature }) => feature.id),
    ),
    named: named.length > 0,
  };
}

/** What a normalised sentence's replaces clause says, its list read once. */
function readReplaces({
  schedule,
  classWords,
  text,
}: {
  schedule: ClassSchedule;
  classWords: ReadonlySet<string>;
  text: string;
}): ReplacesReading {
  const list = replaceListOf(text);
  if (!list) return { kind: 'none' };
  const replaced = replacedFeatureIdsOf({ text, list, schedule });
  return choiceMarker.test(text.slice(0, list.end))
    ? { kind: 'choice', list, replaced }
    : {
        kind: 'named',
        list,
        replaced,
        referredTo: referredToOf({ schedule, classWords, text, list }),
      };
}

function readSentences({
  schedule,
  classWords,
  holders,
}: {
  schedule: ClassSchedule;
  classWords: ReadonlySet<string>;
  holders: readonly TextHolder[];
}): TextSentence[] {
  return holders.flatMap((holder, at) =>
    sentencesOf(holder.text).map((sentence, index) => {
      const text = normaliseText(sentence);
      return {
        holder,
        isOwnText: at === 0,
        sentence,
        index,
        text,
        quote: quoteOf(holder, sentence),
        replaces: readReplaces({ schedule, classWords, text }),
        alters: readAlters(text),
      };
    }),
  );
}

/**
 * Whether no row of the feature survives the archetype: its base entry is
 * removed (`wholeRemoval`), or every one of its scheduled rows is, by
 * numbered flags (Armiger's Fighter_CF_BonusFeat1 … BonusFeat20,
 * ag_abilities_class.lst: all eleven Bonus Feat rows).
 */
const isRemovedWhole = ({
  feature,
  wholeRemoval,
  partRemovals,
}: FeatureTouch) =>
  wholeRemoval ||
  (feature.levels.length > 0 &&
    feature.levels.every((level) => partRemovals.has(level)));

/**
 * The features the archetype removes, its parents' removals carried: by any
 * part (`removed`), and whole (`wholeRemoved`, `isRemovedWhole`).
 */
function removedFeatureIds(
  schedule: ClassSchedule,
  touches: readonly FeatureTouch[],
) {
  const carried = carryToSubfeatures({ schedule, touches });
  const ids = (keep: (touch: FeatureTouch) => boolean) =>
    new Set(carried.filter(keep).map(({ feature }) => feature.id));
  return {
    removed: ids(
      ({ wholeRemoval, partRemovals }) => wholeRemoval || partRemovals.size > 0,
    ),
    wholeRemoved: ids(isRemovedWhole),
  };
}

/** Words that may stand before a feature's name in a comparison and leave it the feature. */
const comparisonQualifiers = new Set([
  'like',
  'as',
  'to',
  'per',
  'and',
  'or',
  'replaces',
  'standard',
  'normal',
  'regular',
  'usual',
  'base',
  'same',
  'identically',
  'its',
  'his',
  'her',
  'their',
  'own',
]);

const classWordsCache = new WeakMap<PcgenTree, ReadonlySet<string>>();

/** Each base class's name as the word a comparison qualifies a feature by ("the druid's"). */
function classWordsOf(tree: PcgenTree) {
  const cached = classWordsCache.get(tree);
  if (cached) return cached;
  const words = new Set(
    tree.baseClasses.flatMap(({ locator }) =>
      normaliseText(locator.key).split(' ').slice(-1),
    ),
  );
  classWordsCache.set(tree, words);
  return words;
}

/** The class's own name as a comparison names it ("monk" for the Unchained Monk). */
const classWordOf = (schedule: ClassSchedule) =>
  normaliseText(schedule.className.replace(/\s*\([^()]*\)$/, ''))
    .split(' ')
    .at(-1) ?? '';

/**
 * Whether a name found at `at` stands as the feature itself: after nothing,
 * punctuation, a qualifier ("standard", "normal") or a class's name, and not
 * as the last word of another name ("the greater mutagen discovery").
 */
function standsAlone(
  text: string,
  at: number,
  classWords: ReadonlySet<string>,
) {
  const word = /([\w-]+)\s*$/.exec(text.slice(0, at))?.[1];
  return (
    word === undefined || comparisonQualifiers.has(word) || classWords.has(word)
  );
}

/**
 * The class features a comparison compares with: those its object names,
 * before a "replaces" when that part names any ("This ability otherwise
 * functions as and replaces fiendish boon."), each standing as the feature
 * itself and not as the last word of another name: "works like the greater
 * mutagen discovery" (Bramble Brewer ~ Dendrite Mutagen, arg_abilities_class
 * .lst:220) names one discovery an alchemist selects, not the Discovery row,
 * while "the standard ranger's combat style" and "the druid's animal
 * companion" name the feature. Else the features its subject names ("A zen
 * archer's flurry of blows otherwise functions as normal for a monk of his
 * level."); else, for "the <class> ability of the same name", the holder's.
 */
function comparedFeatures({
  schedule,
  holder,
  reading,
  classWords,
}: {
  schedule: ClassSchedule;
  holder: TextHolder;
  reading: Extract<AltersReading, { kind: 'comparison' }>;
  classWords: ReadonlySet<string>;
}) {
  const masks = maskNamesOf(schedule);
  const { subject, object } = reading;
  const named = featuresNamedIn(object, schedule.features, masks).filter(
    ({ at }) => standsAlone(object, at, classWords),
  );
  const replaces = /\breplaces?\b/.exec(object)?.index;
  const before =
    replaces === undefined ? [] : named.filter(({ end }) => end <= replaces);
  const compared = (before.length ? before : named).map(
    ({ feature }) => feature,
  );
  if (compared.length) return compared;
  const own = featuresNamedIn(subject, schedule.features, masks).map(
    ({ feature }) => feature,
  );
  if (own.length) return own;
  const classWord = classWordOf(schedule);
  const holderForms = [
    // "the barbarian ability of the same name" (Jungle Rager), "the paladin
    // ability" (Shining Knight ~ Divine Bond), "normal for a monk of her
    // level" (Hamatulatsu Master ~ Ki Pool): the class's feature the
    // holder is named like.
    /^\W*(?:([\w-]+)\s+)?(?:class\s+)?(?:ability|feature)(?:\s+of\s+same\s+name)?\W*$/,
    /\b(?:([\w-]+)\s+)?(?:class\s+)?(?:ability|feature)\s+of\s+same\s+name\b/,
    /^\W*normal\s+for\s+([\w-]+)\b/,
  ];
  const owner = holderForms
    .map((form) => form.exec(object))
    .find((match) => match !== null);
  if (!owner || (owner[1] !== undefined && owner[1] !== classWord)) return [];
  return holderFeatures(schedule, holder);
}

/**
 * The class's features named with the class's possessive ("Witch's
 * Familiar", "Oracle's Curse") that an alters sentence names by the noun
 * alone, when that noun is all it alters: "This ability alters familiar."
 * (Gingerbread Witch ~ Gingerbread Familiar, ha_abilities_class.lst:270)
 * alters the Witch's Familiar. Elsewhere in a sentence the noun alone is no
 * name ("charge" is no Cavalier's Charge), nor is a name without the
 * possessive ("This alters spells.", Speaker of the Palatine Eye, is
 * casting, not the Bard Spells row).
 */
function classNamedFeatures(schedule: ClassSchedule, altered: string) {
  const classWord = classWordOf(schedule);
  const noun = (words: string) =>
    words
      .replace(/[^\w\s'-]/g, ' ')
      .trim()
      .replace(/(?<=\w{3})s$/, '');
  const object = noun(altered);
  return schedule.features.filter(({ name }) => {
    const bare = name.replace(/\s*\([^()]*\)$/, '');
    const words = normaliseText(bare);
    return (
      /^\S+['’]s\s/.test(bare) &&
      words.startsWith(`${classWord} `) &&
      noun(words.slice(classWord.length + 1)) === object
    );
  });
}

/**
 * The schedule features what an alters sentence alters names
 * (`featuresNamedIn`), or, naming none, those named with the class's
 * possessive that it names by the noun alone (`classNamedFeatures`).
 */
function alteredFeatures(schedule: ClassSchedule, altered: string) {
  const named = featuresNamedIn(
    altered,
    schedule.features,
    maskNamesOf(schedule),
  ).map(({ feature }) => feature);
  return named.length ? named : classNamedFeatures(schedule, altered);
}

/** The class's features named like the feature holding the text ("Jungle Rager ~ Damage Reduction"). */
function holderFeatures(schedule: ClassSchedule, holder: TextHolder) {
  const holderName = normaliseText(
    holder.effective.record.locator.key.split(' ~ ').at(-1) ?? '',
  );
  return schedule.features.filter(
    ({ name }) =>
      normaliseText(name.replace(/\s*\([^()]*\)$/, '')) === holderName,
  );
}

type AltersSubject = (typeof nonRowSubjects)[number]['subject'];

/**
 * An alters sentence (`readAlters`) about a feature the archetype removes
 * whole (research archetype-mapper-alters §3, kind A): the sheet replaces the row
 * and adds the archetype's own feature, which loses the base row's numbers,
 * so a root record confirms the replacement (`altersText:<f>`). Each
 * schedule feature the sentence alters or compares with is attributed; a
 * feature the archetype only marks touched already has its `alters:` item,
 * and one it keeps is no replacement to confirm. An alters verb altering no
 * feature is read as the class's proficiencies (prose, plan §4), class
 * skills or casting when what it alters names them: an item only when the
 * mapping records no such change (`altersText:classSkills`,
 * `altersText:casting`); else it can't be attributed and raises an item
 * naming the sentence (`altersText:sentence:<holder KEY>#<n>`), never
 * nothing. A comparison with no feature of the class raises none.
 *
 * What one alters sentence is about: the features it alters or compares
 * with, one of the class's parts no row holds, a comparison with no feature
 * of the class (a spell, a feat, another class's or archetype's ability:
 * the sentence describes the archetype's new ability and claims nothing
 * about the class), an alteration of the parts of features the same
 * sentence replaces some of, or nothing it can attribute.
 */
export type AltersAttribution =
  | {
      kind: 'features';
      features: readonly [ScheduledFeature, ...ScheduledFeature[]];
    }
  | { kind: 'nonRow'; subject: AltersSubject }
  | { kind: 'newAbility' }
  | { kind: 'keptParts' }
  | { kind: 'unattributed' };

function attributeAlters({
  schedule,
  entry: { holder, isOwnText, replaces },
  reading,
  classWords,
}: {
  schedule: ClassSchedule;
  entry: TextSentence;
  reading: AltersReading;
  classWords: ReadonlySet<string>;
}): AltersAttribution {
  if (reading.kind === 'comparison') {
    const [first, ...rest] = comparedFeatures({
      schedule,
      holder,
      reading,
      classWords,
    });
    if (first) return { kind: 'features', features: [first, ...rest] };
    // A comparison with the class's own something it can't name ("…
    // functions like and replaces the standard ranger's combat style bonus
    // feats", Wave Warden) is about the class.
    return new RegExp(
      `^\\W*(?:and\\s+replaces\\s+)?(?:(?:standard|normal|regular|usual|base)\\s+)?${classWordOf(schedule)}\\b`,
    ).test(reading.object)
      ? { kind: 'unattributed' }
      : { kind: 'newAbility' };
  }
  const named = alteredFeatures(schedule, reading.altered);
  if (named.length) {
    // "replaces the combat style feat gained at 6th level and alters combat
    // style feats" (Sentinel): the alteration is of the parts it keeps.
    const replaced = replacedBy(replaces);
    const [first, ...rest] = named.filter(
      (feature) => !replaced.has(feature.id),
    );
    return first
      ? { kind: 'features', features: [first, ...rest] }
      : { kind: 'keptParts' };
  }
  const subject = nonRowSubjects.find(({ pattern }) =>
    pattern.test(reading.altered),
  )?.subject;
  if (subject) return { kind: 'nonRow', subject };
  // A granted feature's "This alters the ranger's combat style." is about
  // the class feature it is named like (Stormwalker ~ Combat Style Feat).
  const [first, ...rest] = isOwnText ? [] : holderFeatures(schedule, holder);
  return first
    ? { kind: 'features', features: [first, ...rest] }
    : { kind: 'unattributed' };
}

type TextItemContext = {
  schedule: ClassSchedule;
  verb: 'alters' | 'replaces';
  quote: string;
  changesClassSkills: boolean;
  hasCastingItem: boolean;
};

/** The item for an alters or replaces sentence about no feature: a non-row part's, or the sentence's own. */
function unattributedTextItem({
  attribution,
  id,
  ...context
}: TextItemContext & {
  attribution: Extract<AltersAttribution, { kind: 'nonRow' | 'unattributed' }>;
  id: string;
}): Item[] {
  if (attribution.kind === 'nonRow')
    return nonRowTextItems({ ...context, subject: attribution.subject });
  const { schedule, verb, quote } = context;
  return [
    verb === 'alters'
      ? {
          kind: 'unmatchedReplacement',
          id,
          text: `${quote} says the archetype alters or works like something no ${schedule.className} feature of the reviewed schedule names: what it changes is read from the text.`,
        }
      : {
          kind: 'unmatchedReplacement',
          id,
          text: `${quote} says the archetype replaces something no ${schedule.className} feature of the reviewed schedule names: what it replaces is read from the text.`,
          fields: ['detail.replaces', 'detail.featureChanges'],
        },
  ];
}

/**
 * A sentence about the class's proficiencies (prose, plan §4), class skills
 * or casting: an item only when the mapping records no such change.
 */
function nonRowTextItems({
  schedule,
  verb,
  quote,
  changesClassSkills,
  hasCastingItem,
  subject,
}: TextItemContext & { subject: AltersSubject }): Item[] {
  const family = verb === 'alters' ? 'altersText' : 'textReplaces';
  switch (subject) {
    case 'proficiencies':
      return [];
    case 'classSkills':
      return changesClassSkills
        ? []
        : [
            {
              kind: 'unmatchedReplacement',
              id: `${family}:classSkills`,
              text: `${quote} ${verb} the ${schedule.className}'s class skills, but the archetype records no class skill or skill rank change.`,
              fields: ['detail.classSkillsAdded', 'detail.classSkillsRemoved'],
            },
          ];
    case 'casting':
      return hasCastingItem
        ? []
        : [
            {
              kind: 'uncheckedCasting',
              id: `${family}:casting`,
              text: `${quote} ${verb === 'alters' ? 'alters' : 'replaces part of'} the ${schedule.className}'s casting, which the archetype's flags don't touch: a casting change #422 reviews by hand.`,
              fields: ['detail.casting'],
            },
          ];
  }
}

function altersTextItems({
  schedule,
  classWords,
  sentences,
  removed,
  changesClassSkills,
  hasCastingItem,
}: {
  schedule: ClassSchedule;
  classWords: ReadonlySet<string>;
  sentences: readonly TextSentence[];
  removed: ReadonlySet<string>;
  changesClassSkills: boolean;
  hasCastingItem: boolean;
}): Item[] {
  const byFeature = new Map<
    string,
    { feature: ScheduledFeature; quotes: string[] }
  >();
  const items: Item[] = [];
  for (const entry of sentences) {
    const { holder, index, quote, alters: reading } = entry;
    if (!reading) continue;
    const attribution = attributeAlters({
      schedule,
      entry,
      reading,
      classWords,
    });
    if (attribution.kind === 'newAbility' || attribution.kind === 'keptParts')
      continue;
    if (attribution.kind === 'features') {
      for (const feature of attribution.features) {
        if (!removed.has(feature.id)) continue;
        const altered = byFeature.get(feature.id) ?? { feature, quotes: [] };
        altered.quotes.push(quote);
        byFeature.set(feature.id, altered);
      }
      continue;
    }
    items.push(
      ...unattributedTextItem({
        schedule,
        verb: 'alters',
        attribution,
        quote,
        id: `altersText:sentence:${holder.effective.record.locator.key}#${index + 1}`,
        changesClassSkills,
        hasCastingItem,
      }),
    );
  }
  return [
    ...[...byFeature.values()].map(
      ({ feature, quotes }): Item => ({
        kind: 'unmatchedReplacement',
        id: `altersText:${feature.id}`,
        text: `${quotes.join('; ')}: the text alters the ${schedule.className}'s ${feature.name}, which the archetype's flags remove. The sheet replaces the row and adds the archetype's feature, so the base row's numbers are lost unless a record carries them; a root record confirms the replacement.`,
        fields: ['detail.replaces'],
      }),
    ),
    ...dedupe(items, ({ id }) => id),
  ];
}

/**
 * A replacement the text leaves to the player, which no flag can express:
 * "This ability replaces one of the cleric's two 1st-level domain powers
 * (her choice)." (Hidden Priest ~ False Arcanist, ism_abilities_class.lst:
 * 191), "If he chooses to do so, he replaces the monk class ability the
 * black asp gives up for the chosen forbidden ki power." (Black Asp ~
 * Forbidden Powers, ui_abilities_class.lst:536). Read up to the end of the
 * replaces list.
 */
const choiceMarker =
  /\bchooses?\b|\bchoice\b|\bone of\b|\bany of\b|\bwhichever\b|\bgives? up\b/;

/**
 * Whether an own replacement's list (`ownReplacement`) is read as naming
 * what the flags change, so it raises no sentence item: it names a feature
 * or a part the schedule knows off its rows; or its holder is granted at a
 * level where the flags remove a row ("This ability replaces frightening
 * performance.", Dervish Dancer ~ Leaf on the Wind, granted at 14th, where
 * they remove Frightening Tune: a name no row has, read as that row); or
 * its holder's own TYPE tags name a feature the flags remove (Brutal
 * Slash's "replaces mounted charge", tagged Mounted Archer); or the words of removed features' names stand in it a word or two apart
 * ("the 1st-level fighter bonus combat feat"). An anaphor naming a feature,
 * or an option of one ("the greater mutagen discovery", whose row is kept),
 * is attributed by `textReplacesItems` itself.
 */
function namesWhatTheFlagsChange({
  schedule,
  replaced,
  holder,
  removed,
  replacedLevels,
}: {
  schedule: ClassSchedule;
  replaced: string;
  holder: TextHolder;
  removed: ReadonlySet<string>;
  replacedLevels: ReadonlySet<number>;
}) {
  const masks = maskNamesOf(schedule);
  if (
    featuresNamedIn(replaced, schedule.features, masks).length ||
    masks.some((mask) => isNamedIn(replaced, mask))
  )
    return true;
  if (holder.classLevel !== undefined && replacedLevels.has(holder.classLevel))
    return true;
  if ([...holder.tagged].some((id) => removed.has(id))) return true;
  const loose = schedule.features.filter((feature) =>
    looselyNamedIn(replaced, feature.name),
  );
  return loose.length > 0 && loose.every(({ id }) => removed.has(id));
}

/** A replaces list that refers back: "replaces that ability", "replaces it". */
const anaphora =
  /^\s*(?:(?:that|this|those|these|same)\s+(?:class\s+)?(?:ability|abilities|feature|features)|it|them)\b/;

/** The words of a name of two or more words, in order, at most two words apart. */
function looselyNamedIn(text: string, name: string) {
  const words = normaliseText(name.replace(/\s*\([^()]*\)$/, ''))
    .split(' ')
    .map((word) => word.replace(/[^\w'-]/g, ''));
  if (words.length < 2) return false;
  const last = (words.pop() ?? '').replace(/(?<=\w{3})s$/, '');
  const pattern = [...words, last].join(String.raw`(?:\s+\S+){0,2}?\s+`);
  return new RegExp(String.raw`\b${pattern}(?:e?s)?\b`).test(text);
}

/** A sentence saying what its own ability replaces: "This ability replaces …", "It replaces …". */
const ownReplacement = /^(?:this|it)\b[^.]*?\breplaces\b/;

/**
 * A feature the archetype's text replaces that its flags don't remove
 * (research archetype-mapper-alters §3, kind B): Tetori's Inescapable Grasp
 * "replaces abundant step, improved evasion, timeless body, and tongue of sun
 * and moon" (uc_abilities_class.lst:1402) while its `.MOD` line (:1921)
 * removes neither. Each sentence with a replace verb is read for the
 * schedule features named after it (`namedIncrements`); a feature the
 * archetype removes, whole or by any part, agrees, and one it marks touched
 * already has its `alters:` item. A root record binding what the archetype
 * replaces settles it (`textReplaces:<f>`). A sentence it can't attribute
 * to one feature raises an item naming the sentence
 * (`textReplaces:sentence:<holder KEY>#<n>`), never nothing: one that
 * leaves the replacement to a choice (`choiceMarker`), whatever it names,
 * and one saying what its own ability replaces (`ownReplacement`) that
 * names no feature and no part the schedule knows off its rows, granted at
 * a level where the flags remove no row (else it is read as that row's,
 * however the text spells it); one naming
 * the class's proficiencies is prose (plan §4), and one naming its class
 * skills or casting raises an item only when the mapping records no such
 * change, as an alters sentence does.
 */
function textReplacesItems({
  schedule,
  sentences,
  removed,
  replacedLevels,
  itemized,
  changesClassSkills,
  hasCastingItem,
}: {
  schedule: ClassSchedule;
  sentences: readonly TextSentence[];
  removed: ReadonlySet<string>;
  replacedLevels: ReadonlySet<number>;
  itemized: ReadonlySet<string>;
  changesClassSkills: boolean;
  hasCastingItem: boolean;
}): Item[] {
  // A choice raises its sentence item below, whatever its list names.
  const attributable = sentences.flatMap(({ replaces, quote }) =>
    replaces.kind === 'named' ? [{ ...replaces, quote }] : [],
  );
  const featureItems = schedule.features.flatMap((feature): Item[] => {
    if (removed.has(feature.id) || itemized.has(feature.id)) return [];
    const quotes = attributable.flatMap(({ replaced, referredTo, quote }) =>
      replaced.has(feature.id) || referredTo?.features.has(feature.id)
        ? [quote]
        : [],
    );
    return quotes.length
      ? [
          {
            kind: 'unmatchedReplacement',
            id: `textReplaces:${feature.id}`,
            text: `${quotes.join('; ')}: the text replaces the ${schedule.className}'s ${feature.name} (${feature.levels.join(', ')}), which no flag the archetype sets removes.`,
            fields: ['detail.replaces', 'detail.featureChanges'],
          },
        ]
      : [];
  });
  const sentenceItems = sentences.flatMap((entry): Item[] => {
    const { holder, index, text, quote, replaces } = entry;
    const id = `textReplaces:sentence:${holder.effective.record.locator.key}#${index + 1}`;
    switch (replaces.kind) {
      // No replaces list: the sentence replaces nothing.
      case 'none':
        return [];
      case 'choice':
        return [
          {
            kind: 'unmatchedReplacement',
            id,
            text: `${quote} leaves what the archetype replaces to a choice, which the flags can't express: a root record says what it replaces.`,
            fields: ['detail.replaces', 'detail.featureChanges'],
          },
        ];
      case 'named':
        return ownReplacementItems({
          schedule,
          holder,
          text,
          quote,
          id,
          replaces,
          removed,
          replacedLevels,
          changesClassSkills,
          hasCastingItem,
        });
      default:
        return replaces satisfies never;
    }
  });
  return [...featureItems, ...dedupe(sentenceItems, ({ id }) => id)];
}

/**
 * The item for a sentence naming what its own ability replaces
 * (`ownReplacement`) that the replaced features don't account for: none
 * when the sentence is no own replacement (its features raise their own
 * items), refers back to features it named before its list, or names what
 * the flags change (`namesWhatTheFlagsChange`); else a non-row part's
 * item or the sentence's own (`unattributedTextItem`).
 */
function ownReplacementItems({
  schedule,
  holder,
  text,
  quote,
  id,
  replaces: { list, referredTo },
  removed,
  replacedLevels,
  changesClassSkills,
  hasCastingItem,
}: {
  schedule: ClassSchedule;
  holder: TextHolder;
  text: string;
  quote: string;
  id: string;
  replaces: Extract<ReplacesReading, { kind: 'named' }>;
  removed: ReadonlySet<string>;
  replacedLevels: ReadonlySet<number>;
  changesClassSkills: boolean;
  hasCastingItem: boolean;
}): Item[] {
  if (!ownReplacement.test(text) || referredTo?.named) return [];
  const replaced = text.slice(list.start, list.end);
  if (
    namesWhatTheFlagsChange({
      schedule,
      replaced,
      holder,
      removed,
      replacedLevels,
    })
  )
    return [];
  const subject = nonRowSubjects.find(({ pattern }) =>
    pattern.test(replaced),
  )?.subject;
  return unattributedTextItem({
    schedule,
    verb: 'replaces',
    attribution: subject
      ? { kind: 'nonRow', subject }
      : { kind: 'unattributed' },
    quote,
    id,
    changesClassSkills,
    hasCastingItem,
  });
}

/**
 * Where the archetype's own text disagrees with the mapping (archetype-mapper-2):
 * a replacement its flags miss (`textReplacesItems`) and an alteration of a
 * feature they remove (`altersTextItems`), beside the items already raised.
 */
function textDisagreementItems({
  schedule,
  classWords,
  replacedLevels,
  holders,
  touches,
  skills,
  items,
}: {
  schedule: ClassSchedule;
  classWords: ReadonlySet<string>;
  /** The class levels of the rows the archetype replaces. */
  replacedLevels: ReadonlySet<number>;
  holders: readonly TextHolder[];
  touches: readonly FeatureTouch[];
  skills: Pick<
    ReturnType<typeof skillChangesOf>,
    'touchesClassSkills' | 'skillRanksPerLevel'
  >;
  items: readonly Item[];
}): Item[] {
  const { removed, wholeRemoved } = removedFeatureIds(schedule, touches);
  const itemized = new Set(
    items.flatMap(({ id }) => (id.startsWith('alters:') ? [id.slice(7)] : [])),
  );
  const changesClassSkills =
    skills.touchesClassSkills || skills.skillRanksPerLevel !== undefined;
  // A casting change already raised, or a casting feature the flags touch
  // (Urban Druid's spontaneous casting), says what the text says.
  const hasCastingItem =
    items.some(({ kind }) => kind === 'uncheckedCasting') ||
    schedule.features.some(
      ({ id, casting }) => casting && (removed.has(id) || itemized.has(id)),
    );
  const sentences = readSentences({ schedule, classWords, holders });
  return [
    ...textReplacesItems({
      schedule,
      sentences,
      removed,
      replacedLevels,
      itemized,
      changesClassSkills,
      hasCastingItem,
    }),
    ...altersTextItems({
      schedule,
      classWords,
      sentences,
      // A part removal keeps the other rows, which carry the alteration
      // ("Whenever a pack hunter would gain a new rage power, she can
      // instead select a teamwork feat. This alters rage power."): only a
      // removal that leaves no row, whole or by every numbered part, loses
      // them.
      removed: wholeRemoved,
      changesClassSkills,
      hasCastingItem,
    }),
  ];
}

/** Tags that carry no effect of their own: identity, display, prerequisites and definitions. */
const inertTag =
  /^(?:|KEY|CATEGORY|TYPE|SOURCE\w*|DESC|DESCISPI|NAMEISPI|COST|VISIBLE|OUTPUTNAME|SORTKEY|DEFINE|!?PRE\w+)$/;

/**
 * A granted record the import neither emits as a feature nor reads
 * (research archetype-mapper-alters §3, kind I): a Words of Power word, an
 * oracle's bonus spell (`SPELLKNOWN`), an ability pool (Scaled Fist ~
 * Energy Type, lod_abilities_class.lst:280), a granted feat, an `Internal`
 * proficiency. The mapper reads class skill lists (`CSKILL`, `CCSKILL`),
 * skill ranks (`BONUS:SKILLPOINTS|`, a form #305 can't express raising its
 * own item) and the lowering of a feature's count variable
 * (`countDecrementPattern`); a token of identity, display, definition or
 * prerequisite (`inertTag`) has no effect of its own. Any other token is
 * dropped, so the archetype is held with `unemittedGrant:<KEY>` naming the
 * record and its dropped tokens, never silently. A record the archetype owns
 * (`isFeature`) is emitted and raises none.
 */
function unemittedGrantItems(
  schedule: ClassSchedule,
  granted: readonly Granted[],
): Item[] {
  const decrements = schedule.features.flatMap(({ countVariable }) =>
    countVariable ? [countDecrementPattern(countVariable)] : [],
  );
  const isRead = (token: string) =>
    ['CSKILL', 'CCSKILL'].includes(tagOf(token)) ||
    token.startsWith('BONUS:SKILLPOINTS|') ||
    decrements.some((pattern) => pattern.test(token));
  const items = granted.flatMap(
    ({ effective, isFeature, category }): Item[] => {
      if (isFeature) return [];
      const dropped = effective.tokens.filter(
        ({ token }) => !inertTag.test(tagOf(token)) && !isRead(token),
      );
      if (!dropped.length) return [];
      const { locator } = effective.record;
      return [
        {
          kind: 'unmatchedReplacement',
          id: `unemittedGrant:${locator.key}`,
          text: `The archetype grants ${category}|${locator.key} (${atOf(locator)}), which the import neither emits nor reads: ${dropped.map(({ token }) => token).join(' ')}.`,
        },
      ];
    },
  );
  return dedupe(items, ({ id }) => id);
}

// --- Skills -------------------------------------------------------------------

/** A granted class skill list or skill rank budget, which is no addition. */
const isSkillRecord = ({ key }: Granted) =>
  /~ (Class Skills|Skill Ranks per Level)$/i.test(key);

const skillPoints = /^BONUS:SKILLPOINTS\|NUMBER\|(-?\d+)$/;

/** `BONUS:SKILLPOINTS|NUMBER|n` budgets on the granted records, and the forms #305 can't express. */
function skillRanksOf(schedule: ClassSchedule, granted: readonly Granted[]) {
  const tokens = granted.flatMap(({ effective }) =>
    effective.tokens.filter(({ token }) =>
      token.startsWith('BONUS:SKILLPOINTS|'),
    ),
  );
  const changes = tokens.map((sourced) => ({
    sourced,
    change: skillPoints.exec(sourced.token)?.[1],
  }));
  const unexpressed = changes.filter(({ change }) => change === undefined);
  const items: Item[] = unexpressed.map(({ sourced }) => ({
    kind: 'unmatchedReplacement',
    id: `skillRanks:${sourced.token}`,
    text: `${sourced.token} (${atOf(sourced)}) changes skill ranks in a form #305's skillRanksPerLevel can't express.`,
    fields: ['detail.skillRanksPerLevel'],
  }));
  const total = changes.reduce(
    (sum, { change }) => sum + Number(change ?? 0),
    0,
  );
  return {
    skillRanksPerLevel:
      tokens.length && !unexpressed.length
        ? schedule.skillRanksPerLevel + total
        : undefined,
    first: tokens[0],
    items,
  };
}

/**
 * Class skill and skill rank changes (#305): `CSKILL` lists add skills, a
 * replacement `~ Class Skills` list removes the base skills it leaves out
 * when the base list is removed, and `CCSKILL` lists remove skills.
 */
function skillChangesOf({
  context,
  granted,
  others,
}: {
  context: ArchetypeClassContext;
  granted: readonly Granted[];
  others: ReturnType<typeof touchesOf>['others'];
}) {
  const { schedule, baseClassSkills } = context;
  const tokensOf = (list: readonly Granted[]) =>
    list.flatMap(({ effective }) => effective.tokens);
  const gained = skillListOf(tokensOf(granted), 'CSKILL');
  const lost = skillListOf(tokensOf(granted), 'CCSKILL');
  const lists = granted.filter(
    (grant) =>
      isSkillRecord(grant) &&
      skillListOf(grant.effective.tokens, 'CSKILL').first,
  );
  const replacement = skillListOf(tokensOf(lists), 'CSKILL').keys;
  const removesBase = others.some(
    ({ signal, target }) => signal.removes && target.kind === 'classSkills',
  );
  const base = new Set(baseClassSkills);
  const removed = new Set(lost.keys.filter((key) => base.has(key)));
  if (removesBase && lists.length)
    for (const key of baseClassSkills)
      if (!replacement.includes(key)) removed.add(key);
  const ranks = skillRanksOf(schedule, granted);
  const items: Item[] = [...ranks.items];
  if (removesBase && !lists.length && !lost.first)
    items.push({
      kind: 'unmatchedReplacement',
      id: 'classSkills',
      text: `The archetype removes the ${schedule.className}'s class skills but grants no CSKILL or CCSKILL list.`,
      fields: ['detail.classSkillsAdded', 'detail.classSkillsRemoved'],
    });
  const touchesClassSkills =
    Boolean(gained.first ?? lost.first) ||
    others.some(({ target }) => target.kind === 'classSkills');
  // No record holds the class's skills (`classSkillsRecord`), so what the
  // archetype adds or removes was read against an empty base list.
  if (schedule.classSkillsRecord === null && touchesClassSkills)
    items.push({
      kind: 'unmatchedReplacement',
      id: 'classSkillsBase',
      text: `PCGen holds the ${schedule.className}'s class skills on its class block alone, in no class skills record, so the archetype's class skill changes read against no base list: what it adds or removes is read from its text.`,
      fields: ['detail.classSkillsAdded', 'detail.classSkillsRemoved'],
    });
  return {
    classSkillsAdded: gained.keys.filter((key) => !base.has(key)),
    classSkillsRemoved: [...removed].sort(),
    skillRanksPerLevel: ranks.skillRanksPerLevel,
    touchesClassSkills,
    unsupported: [...gained.unsupported, ...lost.unsupported],
    provenance: {
      'detail.classSkillsAdded': gained.first,
      'detail.classSkillsRemoved':
        lost.first ?? (removed.size ? gained.first : undefined),
      'detail.skillRanksPerLevel': ranks.first,
    },
    items,
  };
}

// --- Stacking guard --------------------------------------------------------

/** The negated names of the archetype's `PREMULT` stacking guards, as variable suffixes. */
function guardSuffixes(
  context: ArchetypeClassContext,
  tokens: readonly PcgenSourcedToken[],
) {
  const { flagNamespace: namespace } = context.schedule;
  const marker = new RegExp(`^${namespace}_(?:CF|Archetype)_(\\w+)=true$`, 'i');
  const guards: string[][] = [];
  for (const { token } of tokens) {
    if (!token.startsWith('PREMULT:')) continue;
    const node = parsePrerequisite(token);
    const suffixes: string[] = [];
    for (const item of node.items) {
      if (typeof item === 'string' || !item.isNegated) continue;
      for (const value of item.items) {
        if (typeof value !== 'string') continue;
        const fact = marker.exec(value)?.[1];
        const type = /^TYPE[.=](.+)$/.exec(value)?.[1];
        const suffix = fact ?? (type ? typeSuffix(context, type) : undefined);
        if (suffix) suffixes.push(suffix);
      }
    }
    if (suffixes.length) guards.push(suffixes);
  }
  return guards;
}

/** Suffixes as comparable touches: a feature whole (or all its parts), a part, or a non-row. */
function normaliseTouches(
  schedule: ClassSchedule,
  suffixes: readonly string[],
) {
  const parts = new Map<string, Set<number>>();
  const wholes = new Set<string>();
  const rest = new Set<string>();
  for (const suffix of suffixes) {
    const target = resolveSuffix(schedule, suffix);
    if (target.kind === 'feature') {
      if (target.classLevel === null) wholes.add(target.feature.id);
      else
        parts.set(
          target.feature.id,
          (parts.get(target.feature.id) ?? new Set()).add(target.classLevel),
        );
    } else if (target.kind === 'option') wholes.add(target.of);
    else if (target.kind === 'sharedRow')
      rest.add(`${target.of}:${target.level}`);
    else if (target.kind === 'proficiency') rest.add('proficiency');
    else if (target.kind === 'unknown') rest.add(`unknown:${fold(suffix)}`);
    else rest.add(target.kind);
  }
  for (const [id, levels] of parts) {
    const feature = schedule.features.find((candidate) => candidate.id === id);
    if (wholes.has(id) || levels.size === feature?.levels.length)
      wholes.add(id);
    else for (const level of levels) rest.add(`${id}:${level}`);
  }
  return [...[...wholes].map((id) => `${id}:whole`), ...rest].sort();
}

function guardItems(
  context: ArchetypeClassContext,
  tokens: readonly PcgenSourcedToken[],
  signals: readonly Signal[],
): Item[] {
  const touched = normaliseTouches(
    context.schedule,
    signals.map(({ suffix }) => suffix),
  );
  return guardSuffixes(context, tokens).flatMap((guard, index) => {
    const named = normaliseTouches(context.schedule, guard);
    const missing = touched.filter((touch) => !named.includes(touch));
    const extra = named.filter((touch) => !touched.includes(touch));
    return missing.length || extra.length
      ? [
          {
            kind: 'conflict',
            id: index === 0 ? 'stackingGuard' : `stackingGuard#${index + 1}`,
            text: `The archetype's PREMULT stacking guard ${
              extra.length ? `also names ${extra.join(', ')}` : ''
            }${extra.length && missing.length ? ' and ' : ''}${
              missing.length ? `leaves out ${missing.join(', ')}` : ''
            }, against its removal and touch flags.`,
          } satisfies Item,
        ]
      : [];
  });
}

// --- Entry -----------------------------------------------------------------

function sourceParts(
  effective: PcgenEffectiveRecord,
): [StructureSourcePart, ...StructureSourcePart[]] {
  const { record } = effective;
  const part = (
    file: string,
    line: number,
    text: string,
  ): StructureSourcePart => ({
    source: {
      source: 'pcgen',
      locator: { file, line, key: record.locator.key },
    },
    text,
  });
  return [
    part(record.locator.file, record.locator.line, record.text),
    ...effective.appliedMods.map((mod) => part(mod.file, mod.line, mod.text)),
  ];
}

/** An ability record's effective source hash: its line and applied `.MOD` lines (P2). */
export function archetypeSourceSha256(effective: PcgenEffectiveRecord) {
  return hashStructureSource(sourceParts(effective));
}

const upstreamKeyOf = (record: PcgenRecord) =>
  `pcgen:${record.locator.file}#${record.locator.key}`;

function sourcesOf(effective: PcgenEffectiveRecord) {
  const page = effective.tokens.find(
    ({ token }) => tagOf(token) === 'SOURCEPAGE',
  );
  return {
    page,
    sources: [
      {
        book: effective.record.book,
        ...(page
          ? { pages: valueOf(page.token).replace(/^p\.?\s*/i, '') }
          : {}),
      },
    ],
  };
}

function recordItems(record: PcgenRecord): Item[] {
  const at = atOf(record.locator);
  return [
    ...(record.isNamePI
      ? [
          {
            kind: 'productIdentity',
            id: 'NAMEISPI',
            text: `PCGen marks the name ${record.locator.key} as Product Identity (${at}).`,
          } satisfies Item,
        ]
      : []),
    ...(record.isPfs
      ? [
          {
            kind: 'option',
            id: 'pfs',
            text: `A Pathfinder Society record (${at}), loaded only with its campaign.`,
          } satisfies Item,
        ]
      : []),
  ];
}

/** An owned feature as an imported class feature entry. */
export function mapArchetypeFeature({
  effective,
  externalKey,
}: {
  effective: PcgenEffectiveRecord;
  externalKey: string;
}): StructureSubject {
  const { record } = effective;
  const { page, sources } = sourcesOf(effective);
  const entry: PreviewEntry = {
    externalKey,
    upstreamKey: upstreamKeyOf(record),
    pack: record.pack,
    name: record.name,
    detail: { kind: 'classFeature' },
    description: descOf(effective),
    sources,
    modifiers: [],
    unsupported: productIdentityHolds(record),
    provenance: pcgenProvenance(record.locator.key, {
      name: record.locator,
      description: effective.tokens.find(
        ({ token }) => tagOf(token) === 'DESC',
      ),
      sources: page ?? record.locator,
    }),
  };
  return {
    entry,
    sourceSha256: archetypeSourceSha256(effective),
    locator: entry.upstreamKey,
  };
}

/** The archetype's own review items, beyond its touches and grants. */
/**
 * Casting changes the imported `casting` contract can't carry yet, by folded
 * KEY (#716 P6). The imported change names a list by its class tag only, so a
 * list with an archetype's own spell levels has no field a record could bind:
 * the item names one, and the archetype stays held until a contract decision.
 */
const castingContractGaps: ReadonlyMap<string, string> = new Map([
  [
    toPcgenKey('Investigator Archetype ~ Psychic Detective'),
    "Occult Adventures p.120 gives the psychic detective's spell list eleven spell levels of its own (detect chaos, detect evil, detect good, detect law and find traps at 1st; calm spirit and daylight at 3rd; modify memory at 4th; banishment, moment of prescience and greater scrying at 6th), which the imported casting change, a list's class tag only, can't carry.",
  ],
]);

function castingContractItems(record: PcgenRecord): Item[] {
  const text = castingContractGaps.get(toPcgenKey(record.locator.key));
  return text
    ? [
        {
          kind: 'uncheckedCasting',
          id: 'castingContract',
          text: `${text} Held until the import contract can express it.`,
          fields: ['detail.casting.spellList.add'],
        },
      ]
    : [];
}

/**
 * The casting-contract item of each spell-level grant the archetype owns
 * (`isSpellLevelGrant`), as `castingContractGaps` raises for other lists
 * with spell levels of their own: the imported casting change names a list
 * by its class tag only, so its levels have no field a record could bind.
 */
function spellLevelItems(granted: readonly Granted[]): Item[] {
  return dedupe(
    granted.filter(({ effective, category }) =>
      isSpellLevelGrant(category, effective),
    ),
    ({ effective }) => upstreamKeyOf(effective.record),
  ).map(({ effective }) => {
    const levels = effective.tokens
      .filter(({ token }) => token.startsWith('SPELLLEVEL:'))
      .map(({ token }) => token)
      .join(' ');
    return {
      kind: 'uncheckedCasting',
      id: `castingContract:${effective.record.locator.key}`,
      text: `${effective.record.locator.key} (${atOf(effective.record.locator)}) adds spells at levels of its own (${levels}), which the imported casting change, a list's class tag only, can't carry. Held until the import contract can express it.`,
      fields: ['detail.casting.spellList.add'],
    };
  });
}

/** PCGen tokens that make the holder a caster of some class's spells. */
const castingTokenPattern = /^(?:ADD:SPELLCASTER|BONUS:CASTERLEVEL)\|/;
/** A granted feature that is the archetype's spellcasting (`Warlock ~ Spellcasting`). */
const castingFeaturePattern = / ~ (?:Spellcasting|Spells)$/i;

/**
 * Spellcasting an archetype adds to a class whose reviewed schedule has no
 * casting row (#716 P7e): its own casting tokens (`ADD:SPELLCASTER|VWarlock`,
 * ui_abilities_class.lst:973) or a granted spellcasting feature (`Magical
 * Child ~ Spellcasting`, support/ui_abilities_class_pu.lst:97). It touches no
 * casting row, so `castingItems` can't see it; it is a casting change, held
 * for review (PRD #251 decision 7). An unscheduled class's rows are unknown,
 * so it raises none.
 */
function castingAdditionItems({
  schedule,
  effective,
  granted,
}: {
  schedule: ClassSchedule;
  effective: PcgenEffectiveRecord;
  granted: readonly Granted[];
}): Item[] {
  if (
    schedule.kind !== 'reviewed' ||
    schedule.features.some(({ casting }) => casting)
  )
    return [];
  const token = effective.tokens.find(({ token: text }) =>
    castingTokenPattern.test(text),
  );
  const feature = granted.find(({ effective: grant }) =>
    castingFeaturePattern.test(grant.record.locator.key),
  );
  const evidence = token
    ? `${token.token} (${atOf(token)})`
    : feature
      ? `${feature.effective.record.locator.key} (${atOf(feature.effective.record.locator)})`
      : null;
  return evidence
    ? [
        {
          kind: 'uncheckedCasting',
          id: 'castingAddition',
          text: `${evidence} adds spellcasting to the ${schedule.className}, whose schedule has no casting row: a casting change #422 reviews by hand.`,
          fields: ['detail.casting'],
        },
      ]
    : [];
}

function archetypeItems({
  record,
  signals,
}: {
  record: PcgenRecord;
  signals: readonly Signal[];
}): Item[] {
  return [
    ...(signals.length
      ? []
      : [
          {
            kind: 'unmatchedReplacement',
            id: 'noRemovalSignal',
            text: `${record.locator.key} (${atOf(record.locator)}) sets no removal or touch flag and no TYPE token, so nothing it replaces is known.`,
            fields: ['detail.replaces'],
          } satisfies Item,
        ]),
    ...castingContractItems(record),
    ...recordItems(record),
  ];
}

/** Items about one owned feature, bound to that feature's entry. */
function featureBoundItems(
  featureItems: ReadonlyMap<PcgenEffectiveRecord, Item[]>,
  subjects: readonly StructureSubject[],
): StructureReviewItem[] {
  return [...featureItems].flatMap(([grant, own]) => {
    const subject = subjects.find(
      ({ locator }) => locator === upstreamKeyOf(grant.record),
    );
    return subject
      ? own.map((item) => ({
          ...item,
          externalKey: subject.entry.externalKey,
          sourceSha256: subject.sourceSha256,
        }))
      : [];
  });
}

/** Maps one PCGen archetype onto #305 (plan §4, §6). */
export function mapArchetype({
  context,
  record,
  externalKey,
  featureKeyOf,
  importedRaceKeys,
}: ArchetypeInput): ArchetypeMapping {
  const effective = context.view.records.get(record);
  if (!effective) throw new Error(`${record.locator.key} is forgotten.`);
  const { schedule } = context;
  const signals = signalsOf(context, effective.tokens);
  const touches = touchesOf(context, signals);
  const { replaces, featureChanges } = structureOf(schedule, touches.features);
  const touched = touchItems({ schedule, signals, touches });
  const { granted, unresolved } = grantsOf(context, effective);
  const skills = skillChangesOf({ context, granted, others: touches.others });
  const additions = granted.filter(
    (grant) => grant.isFeature && !isSkillRecord(grant),
  );
  const grants = grantItems({
    schedule,
    touches: touches.features,
    granted,
    unresolved,
  });
  const detail: ArchetypeDetail = {
    kind: 'archetype',
    classKeys: [schedule.classKey],
    replaces,
    adds: additions.map(({ effective: grant, classLevel }) => ({
      classLevel,
      externalKey: featureKeyOf(grant.record),
    })),
    ...(featureChanges.length ? { featureChanges } : {}),
    ...(skills.classSkillsAdded.length
      ? { classSkillsAdded: skills.classSkillsAdded }
      : {}),
    ...(skills.classSkillsRemoved.length
      ? { classSkillsRemoved: skills.classSkillsRemoved }
      : {}),
    // rotation-3: the sheet's class-skill identity, also where no list
    // records the change (a prose skill, a removal flag alone).
    ...(skills.touchesClassSkills ? { changesClassSkills: true as const } : {}),
    ...(skills.skillRanksPerLevel === undefined
      ? {}
      : { skillRanksPerLevel: skills.skillRanksPerLevel }),
  };
  const { page, sources } = sourcesOf(effective);
  const race = archetypeRaceRequirements({
    tokens: effective.tokens,
    importedRaceKeys,
  });
  const entry: PreviewEntry = {
    externalKey,
    upstreamKey: upstreamKeyOf(record),
    pack: record.pack,
    name: record.name,
    detail,
    description: descOf(effective),
    ...race.fields,
    sources,
    modifiers: [],
    unsupported: dedupe(
      [
        ...productIdentityHolds(record),
        ...touched.unsupported,
        ...skills.unsupported,
      ],
      (note) => JSON.stringify(note),
    ),
    provenance: pcgenProvenance(record.locator.key, {
      name: record.locator,
      sources: page ?? record.locator,
      prerequisites: race.first,
      'detail.replaces': signals.find(({ removes }) => removes)?.token,
      'detail.featureChanges': signals[0]?.token,
      'detail.adds': effective.tokens.find(({ token }) =>
        token.startsWith('ABILITY:'),
      ),
      ...skills.provenance,
    }),
  };
  const sourceSha256 = archetypeSourceSha256(effective);
  const owned = granted
    .filter(({ isFeature }) => isFeature)
    .map(({ effective: grant }) =>
      mapArchetypeFeature({
        effective: grant,
        externalKey: featureKeyOf(grant.record),
      }),
    );
  const items = [
    ...touched.items,
    ...grants.items,
    ...skills.items,
    ...guardItems(context, effective.tokens, signals),
    ...requirementItems(race.requirements),
    ...archetypeItems({ record, signals }),
    ...castingAdditionItems({ schedule, effective, granted }),
    ...spellLevelItems(granted),
  ];
  items.push(
    ...textDisagreementItems({
      schedule,
      classWords: classWordsOf(context.tree),
      replacedLevels: new Set(replaces.map(({ classLevel }) => classLevel)),
      holders: textHoldersOf(context, effective, granted),
      touches: touches.features,
      skills,
      items,
    }),
    ...unemittedGrantItems(schedule, granted),
  );
  return {
    subject: { entry, sourceSha256, locator: entry.upstreamKey },
    features: owned,
    items: [
      ...items.map((item) => ({ ...item, externalKey, sourceSha256 })),
      ...featureBoundItems(grants.featureItems, owned),
    ],
    ownedFeatures: owned.map(
      ({ entry: feature, sourceSha256: hash, locator }) => ({
        externalKey: feature.externalKey,
        sourceSha256: hash,
        owner: externalKey,
        locator,
      }),
    ),
  };
}

// --- Stacking --------------------------------------------------------------

type StackingConflict = {
  archetypes: [string, string];
  feature: string;
  part: number | null;
};

const archetypeDetailOf = (mapping: ArchetypeMapping) => {
  const { detail } = mapping.subject.entry;
  return detail.kind === 'archetype' ? detail : undefined;
};

const shareClass = (first: ArchetypeMapping, second: ArchetypeMapping) =>
  (archetypeDetailOf(first)?.classKeys ?? []).some((key) =>
    (archetypeDetailOf(second)?.classKeys ?? []).includes(key),
  );

/** Same feature identity, whole against anything or the same part. */
function featureOverlaps(
  first: ArchetypeMapping,
  second: ArchetypeMapping,
): StackingConflict[] {
  const archetypes: [string, string] = [
    first.subject.entry.externalKey,
    second.subject.entry.externalKey,
  ];
  const overlaps = (archetypeDetailOf(first)?.featureChanges ?? []).flatMap(
    (left) =>
      (archetypeDetailOf(second)?.featureChanges ?? []).flatMap(
        (right): StackingConflict[] => {
          if (left.externalKey !== right.externalKey) return [];
          if (left.scope === 'whole' || right.scope === 'whole')
            return [{ archetypes, feature: left.externalKey, part: null }];
          return left.classLevel === right.classLevel
            ? [{ archetypes, feature: left.externalKey, part: left.classLevel }]
            : [];
        },
      ),
  );
  return dedupe(
    overlaps,
    ({ feature, part }) => `${feature}:${part ?? 'whole'}`,
  );
}

/**
 * Where two archetypes of the same class can't stack (APG p.72; FAQ June
 * 2015, APT:36, :44): the same feature identity, whole against anything or
 * the same part, as the sheet finds it (`character-sheet-archetypes.ts`).
 * Two that both change the class skills (`changesClassSkills`) are the
 * sheet's to warn about, on its class-skill identity (rotation-3), and raise
 * no item here.
 */
export function stackingConflicts(mappings: readonly ArchetypeMapping[]) {
  const pairs = mappings.flatMap((first, index) =>
    mappings
      .slice(index + 1)
      .filter((second) => shareClass(first, second))
      .map((second) => [first, second] as const),
  );
  return {
    conflicts: pairs.flatMap(([first, second]) =>
      featureOverlaps(first, second),
    ),
  };
}
