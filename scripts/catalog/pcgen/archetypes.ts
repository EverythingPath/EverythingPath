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
import type { PcgenEffectiveRecord, PcgenEffectiveView } from './effective';
import {
  pcgenProvenance,
  productIdentityHolds,
  skillListOf,
} from './entry-fields';
import { resolveGrant } from './inventory';
import { toPcgenKey } from './keys';
import { recordsByKey, type PcgenRecord, type PcgenTree } from './lst';
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
 *   level. Granted `CSKILL` lists add class skills (new − base) and, when the
 *   archetype removes the base list (`_CF_ClassSkills`), the replacement list
 *   removes base − new; `CCSKILL` lists remove class skills; a
 *   `BONUS:SKILLPOINTS|NUMBER|n` changes the class's skill ranks per level by
 *   n. A granted `~ Class Skills` or `~ Skill Ranks per Level` record is no
 *   addition.
 * - Review items, never guessed behaviour: an alteration, an option, an
 *   unknown variable, a skill-rank form #305 can't express and a feature
 *   named like a base feature the archetype doesn't remove
 *   (`unmatchedReplacement`), a casting touch (`uncheckedCasting`, #422), a
 *   schedule defect, a whole removal whose text names only some increments,
 *   a stacking guard that names other features than the removals, and a
 *   granted choice the text contradicts (`conflict`). Proficiency changes
 *   stay prose (`unsupported`).
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
};
export type ArchetypeMapping = {
  subject: StructureSubject;
  /** One subject per feature record the archetype owns directly. */
  features: StructureSubject[];
  items: StructureReviewItem[];
  ownedFeatures: OwnedFeature[];
  /** Whether the archetype changes the class skills, which #305 has no identity for (A3). */
  touchesClassSkills: boolean;
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

/** A TYPE token's variable suffix: a GV bridge, a reviewed alias, else `<Class><suffix>`. */
function typeSuffix(context: ArchetypeClassContext, type: string) {
  const { flagNamespace: namespace, typeAliases } = context.schedule;
  const bridged = context.pcgen.typeBridges.get(type);
  if (bridged) return bridged;
  if (Object.hasOwn(typeAliases, type)) return typeAliases[type];
  if (!type.startsWith(namespace) || type === `${namespace}Archetype`)
    return undefined;
  return type.slice(namespace.length).replace(/_ALL$/, '');
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
    for (const key of grant.keys) {
      const { records } = index
        ? resolveGrant(index, key, archetype.record.pack)
        : { records: [] };
      if (!records.length) unresolved.push(`${grant.category}|${key}`);
      for (const record of records) {
        const effective = view.records.get(record);
        if (effective)
          granted.push({
            effective,
            classLevel: preclassLevel(
              grant.prerequisites,
              context.schedule.flagNamespace,
            ),
            isFeature,
            category: grant.category,
            key,
          });
      }
    }
  }
  return { granted, unresolved };
}

const descOf = (effective: PcgenEffectiveRecord) =>
  effective.tokens
    .filter(({ token }) => tagOf(token) === 'DESC')
    .map(({ token }) => (valueOf(token).split('|')[0] ?? '').trim())
    .filter(Boolean)
    .join(' ');

/** "replaces bravery 1", "replaces armor training 1, 2, 3, and 4". */
function namedIncrements(desc: string, feature: ScheduledFeature) {
  const name = feature.name.toLowerCase().replace(/’/g, "'");
  const text = desc.toLowerCase().replace(/’/g, "'");
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
  const decrement = new RegExp(
    `^BONUS:VAR\\|${variable}\\|-\\d+(?:\\||$)`,
    'i',
  );
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
    ...(skills.skillRanksPerLevel === undefined
      ? {}
      : { skillRanksPerLevel: skills.skillRanksPerLevel }),
  };
  const { page, sources } = sourcesOf(effective);
  const entry: PreviewEntry = {
    externalKey,
    upstreamKey: upstreamKeyOf(record),
    pack: record.pack,
    name: record.name,
    detail,
    description: descOf(effective),
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
    ...archetypeItems({ record, signals }),
    ...castingAdditionItems({ schedule, effective, granted }),
  ];
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
    touchesClassSkills: skills.touchesClassSkills,
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

/** Two archetypes that both change class skills, held on each (A3). */
function classSkillItems(
  first: ArchetypeMapping,
  second: ArchetypeMapping,
): StructureReviewItem[] {
  if (!first.touchesClassSkills || !second.touchesClassSkills) return [];
  return [
    [first, second],
    [second, first],
  ].map(([mapping, other]) => ({
    kind: 'conflict',
    id: `classSkills:${other?.subject.entry.externalKey}`,
    text: `${mapping?.subject.entry.name} and ${other?.subject.entry.name} both change the class skills, which #305 gives no feature identity, so the sheet can't warn that they don't stack (APG p.72; A3).`,
    externalKey: mapping?.subject.entry.externalKey ?? '',
    sourceSha256: mapping?.subject.sourceSha256 ?? '',
  }));
}

/**
 * Where two archetypes of the same class can't stack (APG p.72; FAQ June
 * 2015, APT:36, :44): the same feature identity, whole against anything or
 * the same part, as the sheet finds it (`character-sheet-archetypes.ts`).
 * Class skills have no #305 identity, so two archetypes that both change
 * them are a `conflict` review item on each (A3), not a sheet warning.
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
    items: pairs.flatMap(([first, second]) => classSkillItems(first, second)),
  };
}
