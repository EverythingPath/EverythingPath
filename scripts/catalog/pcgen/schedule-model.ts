/**
 * #716 P5/P7: the model of a reviewed base class schedule (plan §4.3) and the
 * helpers its authored records share. A class's printed table gives one row
 * per acquisition or increment; Foundry links only first acquisitions
 * (`links.classAssociations`), and PCGen gates acquisitions
 * (`PREVARGTEQ:<Class>_CFP_Level,N`) apart from the increases it numbers
 * (`<Class>_CF_<Feature><n>`) or holds only in a formula. Each schedule is the
 * Curation Overlay's reviewed record of one table: its rows, the PCGen
 * variable names that remove or touch each feature, and a cited decision
 * wherever a source disagrees with the table or with the other source.
 *
 * - Every numbered variable has an explicit class level, numbered by class
 *   level (`BonusFeat4` is level 4) or by order (`ArmorTraining1` is level
 *   3).
 * - A formula-held feature has no numbered variable: PCGen gives it one row,
 *   and only the reviewed table gives its later rows. An archetype removing
 *   it removes it whole.
 * - PCGen's defects are review items, never behaviour: the mapper names them
 *   on every archetype that touches their variables.
 */
export type ScheduleClassName =
  | 'Fighter'
  | 'Rogue'
  | 'Ranger'
  | 'Wizard'
  | 'Druid'
  | 'Summoner'
  | 'Summoner (Unchained)'
  | 'Hunter'
  | 'Shifter'
  | 'Monk'
  | 'Monk (Unchained)'
  | 'Brawler'
  | 'Ninja'
  | 'Rogue (Unchained)'
  | 'Bard'
  | 'Barbarian'
  | 'Barbarian (Unchained)'
  | 'Skald'
  | 'Bloodrager'
  | 'Paladin'
  | 'Antipaladin'
  | 'Cavalier'
  | 'Samurai'
  | 'Alchemist'
  | 'Investigator'
  | 'Slayer'
  | 'Vigilante'
  | 'Inquisitor'
  | 'Magus'
  | 'Cleric'
  | 'Sorcerer'
  | 'Oracle'
  | 'Witch';

/** A pinned source line, `<file>:<line>`. */
export type At = string;

/** A PCGen grant: the record (or `pool:<name>`) granted, at a level, and where. */
export type PcgenGrant = { granted: string; level: number; at: At };

export type ScheduledFeature = {
  /** Stable among the class's features, such as `weapon-training`. */
  id: string;
  name: string;
  /** The Foundry class feature (`pf1/<id>`) every row of the feature names. */
  externalKey: string;
  /** Each level the printed table gives the feature: acquisition, then increments. */
  levels: readonly number[];
  /** `<Class>_CF_<suffix>` (and `_Archetype_<suffix>`) suffixes naming the whole feature. */
  whole: readonly string[];
  /** Numbered suffixes, each with its explicit class level. */
  parts: Readonly<Record<string, number>>;
  /**
   * How PCGen holds the later rows: `numbered` gates part variables,
   * `formula` holds the value in a formula only, `none` has no later rows.
   */
  increments: 'none' | 'numbered' | 'formula';
  /** The record (or `pool:<name>`) PCGen's acquisition gate grants, and where. */
  pcgen: PcgenGrant | null;
  /**
   * Later rows PCGen grants as records of their own on the feature's gate,
   * each at a level the table gives the feature (`Summoner ~ Gate` at 19,
   * the summon monster row the table names Gate, #716 P7a).
   */
  laterGrants?: readonly PcgenGrant[];
  /** Foundry's class association. */
  foundry: { level: number; at: At } | null;
  /**
   * The table's label of the nth row (0 the acquisition), such as
   * `Bravery +2`, for the increment entries (#716 P6); a feature without
   * one has a single row, labelled with its name.
   */
  incrementName?: (index: number) => string;
  /** Touching it changes the class's casting (#422). */
  casting?: true;
  /**
   * The Foundry line where the acquisition record computes the feature's
   * value from the class level, so the acquisition row carries every
   * increment's benefit (#716 P6).
   */
  acquisitionFormula?: At;
  /** The cited decision where a source differs from the table. */
  decision?: string;
  /**
   * The feature (its `id`) whose named subfeature this is: a bard
   * performance of bardic performance, a skald's raging song of raging song
   * (research note 716-p7-rules §6, decision 1). It keeps its own rows and
   * identity, so archetypes replacing different subfeatures stack (FAQ June
   * 2015, APT:44); a whole removal or alteration of the parent reaches every
   * subfeature too, so conflicts are found across the parent.
   */
  subfeatureOf?: string;
  /**
   * The PCGen variable that counts the feature's picks, which its numbered
   * part gates read (the paladin's `Mercies`, cr_abilities_class.lst:1361,
   * :1367). A record an archetype grants can lower it directly, beside or
   * instead of a part flag (Oath against Undeath's ghost touch aura,
   * um_abilities_class.lst:1558): the mapper names each such decrement for
   * review (#716 P7d).
   */
  countVariable?: string;
};
/** A variable that names no table row. */
export type ScheduleNonRow =
  | { kind: 'classSkills' }
  | { kind: 'proficiency' }
  | { kind: 'notOnTable'; text: string }
  /**
   * A change to the class's casting named by its own flag, bound to the
   * casting row it changes (`Summoner_CF_SummonMonsterSpells`: the summon
   * spells on the class's spell list, #716 P7a): touching it is a #422
   * review item, never a removal.
   */
  | { kind: 'casting'; of: string; text: string }
  /** An option of a feature, such as the animal companion of hunter's bond. */
  | { kind: 'option'; of: string }
  /**
   * A numbered part the table prints on its feature's acquisition row, which
   * also carries the rest of the feature (the bloodrager's 1st-level
   * bloodline power, on the Bloodline row): no row removes the part alone,
   * so a removal is held for review, never a replacement of that row.
   */
  | { kind: 'sharedRow'; of: string; level: number; text: string };
export type ScheduleDefect = {
  id: string;
  /** The `<Class>_CF_` suffixes the defect concerns. */
  suffixes: readonly string[];
  text: string;
};
/** What every class schedule names: its classes, skill ranks and class skills. */
export type ScheduleBasis = {
  /** The Foundry class. */
  classKey: string;
  /** The Foundry class record, under the pinned packs. */
  foundryFile: string;
  /**
   * The PCGen `CATEGORY:Class` records whose gates grant this version's class
   * features: the class record, or a version's own record
   * (`Barbarian ~ Unchained Class Full`), never an `Ex-Class` record (#716
   * P7-0).
   */
  acquisitionRecords: readonly string[];
  /**
   * The records read only for `DEFINE`s and TYPE bridges: the class record
   * and every version's record, since the versions share their flags
   * (`Barbarian_CF_Rage` gates both rages, pu_abilities_class.lst:132).
   */
  metadataRecords: readonly string[];
  /**
   * The PCGen class: its `<namespace>_CF_`, `_Archetype_` and `_CFP_Level`
   * variables, its `PRECLASS` name and its `CLASS:` block, shared by its
   * versions (`Barbarian`).
   */
  flagNamespace: string;
  /** The schedule's identity in increment keys, the seeds' (`unchained-barbarian`). */
  slug: string;
  /**
   * The PCGen record holding the class skills: an `Internal` record, else a
   * `Special Ability` one (`Unchained Summoner ~ Skills`,
   * pu_abilities_class.lst:727). Null where no record holds them, only the
   * class block's `CSKILL` (the oracle's, apg_classes.lst:109): an
   * archetype's class skill changes then read against no base list, so the
   * mapper holds them for review.
   */
  classSkillsRecord: string | null;
  /** The table's skill ranks per level, and Foundry's `skillsPerLevel` line. */
  skillRanksPerLevel: number;
  skillRanksAt: At;
};
/**
 * Where a P7 schedule's rows were checked against the printed class table
 * (#716 P7, owner decision 8): the PRD capture's page, or why the capture
 * can't hold it, so its table-derived conclusions are pending table review.
 */
export type PrintedTable =
  | {
      status: 'reviewed';
      /** The capture page, under `pages/`, and the line of its 1st-level row. */
      page: string;
      firstRow: number;
      /** The table's caption, without a `Table:` prefix. */
      caption: string;
      /**
       * Rows the Special column doesn't print, by feature id, with the cited
       * reason: the class's casting, which the Spells per Day columns and the
       * class text give, or a value the table prints in a column of its own
       * (the monk's AC Bonus column, #716 P7b). Every other row's label
       * (`incrementName`, else the feature's name) is the Special column's
       * entry at its level.
       */
      unprinted: Readonly<Record<string, string>>;
      /**
       * Special column entries a row prints beside its own label, by feature
       * id, each at its level with the cited reason: the unchained monk's ki
       * pool row at 3rd is also "ki strike (magic)", since its ki pool holds
       * the ki strike (#716 P7b).
       */
      alsoPrinted?: Readonly<
        Record<
          string,
          readonly { level: number; entry: string; text: string }[]
        >
      >;
      /**
       * Features whose later rows a column of their own prints, by feature
       * id, with the cited reading (#716 P7b): the acquisition row is the
       * Special column's entry (or `unprinted`), and each later row a step of
       * the column, where its printed value changes (`value`: the monks'
       * unarmed damage, AC bonus and fast movement) or where the attacks it
       * prints beyond those of a base attack bonus equal to the class level
       * change (`extraAttacks`: the CRB monk's flurry).
       */
      columns?: Readonly<
        Record<
          string,
          { column: string; reading: 'value' | 'extraAttacks'; text: string }
        >
      >;
    }
  | {
      status: 'pendingTableReview';
      /** The capture's named exclusion (`prdClassExclusions`). */
      exclusion: 'not-in-prd';
    };

/** A class whose printed table is reviewed: its rows and how PCGen names them. */
export type ReviewedSchedule = ScheduleBasis & {
  kind: 'reviewed';
  className: ScheduleClassName;
  /** The printed table. */
  source: { book: string; pages: string };
  /** The P7 schedules' check against the PRD's table (P5's predate it). */
  printedTable?: PrintedTable;
  features: readonly ScheduledFeature[];
  nonRows: Readonly<Record<string, ScheduleNonRow>>;
  /**
   * PCGen class grants with no `_CF_` gate that are no table row, by the
   * record granted (`Summoner ~ Weapon and Armor Proficiency`), with the
   * reviewed reason (#716 P7a).
   */
  grantNonRows: Readonly<Record<string, ScheduleNonRow>>;
  /** TYPE tokens neither a GV bridge nor `<Class><suffix>` resolves, by review. */
  typeAliases: Readonly<Record<string, string>>;
  /** Foundry associations that aren't table rows, with the cited reason. */
  foundryNonRows: readonly {
    externalKey: string;
    level: number;
    text: string;
  }[];
  defects: readonly ScheduleDefect[];
};
/**
 * A class whose table no one has reviewed yet (P7): it has no rows, no
 * non-rows, aliases or defects, so it can't claim any.
 */
export type UnscheduledClass = ScheduleBasis & {
  kind: 'unscheduled';
  className: string;
  features: readonly [];
  nonRows: Readonly<Record<string, never>>;
  grantNonRows: Readonly<Record<string, never>>;
  typeAliases: Readonly<Record<string, never>>;
  foundryNonRows: readonly [];
  defects: readonly [];
};
/** The schedule the archetype mapper reads a class's archetypes on. */
export type ClassSchedule = ReviewedSchedule | UnscheduledClass;

// --- Helpers the authored schedules share ----------------------------------

export const at = (file: string, line: number): At => `${file}:${line}`;
/** A PCGen grant in one file: `grantIn(file)(granted, level, line)`. */
export const grantIn =
  (file: string) =>
  (granted: string, level: number, line: number): PcgenGrant => ({
    granted,
    level,
    at: at(file, line),
  });

/** Parts numbered by class level: `<stem><level>` at that level. */
export const byLevel = (stem: string, levels: readonly number[]) =>
  Object.fromEntries(levels.map((level) => [`${stem}${level}`, level]));
/** Parts numbered by order: `<stem><n>` at the nth level. */
export const byOrder = (stem: string, levels: readonly number[]) =>
  Object.fromEntries(
    levels.map((level, index) => [`${stem}${index + 1}`, level]),
  );
export const evens = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
export const odds = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
export const proficiency = { kind: 'proficiency' } as const;
export const classSkills = { kind: 'classSkills' } as const;
export const option = (of: string) => ({ kind: 'option', of }) as const;
export const notOnTable = (text: string) =>
  ({ kind: 'notOnTable', text }) as const;
export const sharedRow = ({
  of,
  level,
  text,
}: {
  of: string;
  level: number;
  text: string;
}) => ({ kind: 'sharedRow', of, level, text }) as const;

export function feature(
  fields: Omit<ScheduledFeature, 'whole' | 'parts' | 'increments'> &
    Partial<Pick<ScheduledFeature, 'whole' | 'parts' | 'increments'>>,
): ScheduledFeature {
  return {
    whole: [fields.name.replace(/[^A-Za-z]/g, '')],
    parts: {},
    increments: fields.levels.length > 1 ? 'formula' : 'none',
    ...fields,
  };
}

/** A feature row of one class, by its Foundry id and its source lines. */
export type RowFields = Omit<
  ScheduledFeature,
  'externalKey' | 'pcgen' | 'foundry' | 'whole' | 'parts' | 'increments'
> &
  Partial<Pick<ScheduledFeature, 'whole' | 'parts' | 'increments'>> & {
    /** The Foundry feature's id. */
    key: string;
    /** The line of PCGen's grant, or null where PCGen grants no row. */
    pcgenLine: number | null;
    /** PCGen's record name after `<prefix> ~ `, where it isn't the feature's name. */
    pcgenName?: string;
    /** PCGen's whole record name, where it has no `<prefix> ~ ` (`Uncanny Dodge ~ Base`). */
    pcgenRecord?: string;
    /** The line of Foundry's class association, or null where it links none. */
    foundryLine: number | null;
    /** The level Foundry links the feature at, where it isn't the table's (a cited defect). */
    foundryLevel?: number;
  };

/**
 * The row builder of one class: PCGen grants `<recordPrefix> ~ <name>` in
 * `grantFile`, and Foundry links the feature in the class record, both at
 * the feature's first level.
 */
export function classRows({
  recordPrefix,
  grantFile,
  foundryFile,
}: {
  recordPrefix: string;
  grantFile: string;
  foundryFile: string;
}) {
  const grant = grantIn(grantFile);
  return ({
    key,
    pcgenLine,
    pcgenName,
    pcgenRecord,
    foundryLine,
    foundryLevel,
    ...fields
  }: RowFields): ScheduledFeature => {
    const [level = 1] = fields.levels;
    // PCGen spells the apostrophe straight (`Shifter ~ Shifter's Fury`).
    const granted =
      pcgenRecord ??
      `${recordPrefix} ~ ${pcgenName ?? fields.name.replace('’', "'")}`;
    return feature({
      ...fields,
      externalKey: `pf1/${key}`,
      pcgen: pcgenLine === null ? null : grant(granted, level, pcgenLine),
      foundry:
        foundryLine === null
          ? null
          : { level: foundryLevel ?? level, at: at(foundryFile, foundryLine) },
    });
  };
}

/** A citer of a class table's rows: the line of each level's row, the 1st-level row at `firstRow`. */
export const makeTableRowCiter =
  ({ page, firstRow }: { page: string; firstRow: number }) =>
  (level: number) =>
    `${page}:${firstRow + level - 1}`;

/** The table rows of some levels, by a table citer, comma-separated. */
export const citeRows = ({
  tableRow,
  levels,
}: {
  tableRow: (level: number) => string;
  levels: readonly number[];
}) => levels.map(tableRow).join(', ');

/** A feature's rows as level and label pairs, the acquisition first. */
export type Steps = readonly (readonly [level: number, label: string])[];
/** A feature's levels and row labels from its steps, each label with `suffix` (` (UC)`). */
export function scheduleSteps({
  steps,
  suffix = '',
}: {
  steps: Steps;
  suffix?: string;
}) {
  return {
    levels: steps.map(([level]) => level),
    incrementName: (index: number) => `${steps[index]?.[1] ?? ''}${suffix}`,
  };
}

/** `1/day` to `n/day` labels: `<name> <1 + index>/day` (lore master, smite, challenge). */
export const buildPerDaySteps = ({
  name,
  levels,
}: {
  name: string;
  levels: readonly number[];
}): Steps =>
  levels.map((level, index) => [level, `${name} ${index + 1}/day`] as const);

/**
 * Rising-bonus labels: `<name> +<first + index × step><unit>` (trap sense
 * `+1` to `+6`, poison resistance `+2` to `+6`, sneak attack `+1d6`).
 */
export const buildPlusSteps = ({
  name,
  levels,
  first = 1,
  step = 1,
  unit = '',
}: {
  name: string;
  levels: readonly number[];
  first?: number;
  step?: number;
  unit?: string;
}): Steps =>
  levels.map(
    (level, index) =>
      [level, `${name} +${first + index * step}${unit}`] as const,
  );

/** An Unchained row builder: the feature named `<name> (UC)`, its flags and PCGen record named as the standard ones are. */
export function makeUnchainedRowBuilder(
  classRow: (fields: RowFields) => ScheduledFeature,
) {
  return ({ name, whole, pcgenName, ...fields }: RowFields) =>
    classRow({
      ...fields,
      name: `${name} (UC)`,
      pcgenName: pcgenName ?? name.replace('’', "'"),
      whole: whole ?? [name.replace(/[^A-Za-z]/g, '')],
    });
}

/** The decision of a casting row PCGen grants no row for (#422). */
export const describeCastingRow = ({
  name,
  foundryLevel,
}: {
  name: string;
  foundryLevel: number;
}) =>
  `PCGen grants no ${name} row; Foundry links ${name} at ${foundryLevel}. It carries the class's casting, so it stays a casting row: touching it is a #422 review item.`;

/** A pinned Foundry class record's path. */
export const classFile = (file: string) => `packs/classes/${file}.yaml`;
/** A line of a pinned Foundry class feature record. */
export const abilityFile = (file: string, line: number) =>
  at(`packs/class-abilities/${file}.yaml`, line);

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 20th. */
export function ordinal(level: number) {
  const suffix =
    Math.floor(level / 10) === 1
      ? 'th'
      : ({ 1: 'st', 2: 'nd', 3: 'rd' }[level % 10] ?? 'th');
  return `${level}${suffix}`;
}
