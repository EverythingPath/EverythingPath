import { importedWeaponSchema } from '../../src/lib/catalog/imported-item.ts';
import {
  findSlingWeaponRule,
  findWeaponImportRule,
  weaponReloadRule,
} from './weapon-import-rules.ts';
import { selectionImportRule } from './selection-import-rules.ts';
import type { ConditionKey } from '../../src/lib/character-sheet-conditions.ts';
import type { CuratedItemAbility } from './curation.ts';
import type { ImportKind } from './inventory.ts';
import {
  compare,
  type RacialTraitFacts,
  type RacialTraitPlan,
} from './racial-traits.ts';
import {
  sourceDescription,
  toExternalKey,
  uuidKey,
  type SourceRecord,
  type LoadedRecord,
  type Unsupported,
} from './records.ts';
import {
  readObject,
  readArray,
  readStrings,
  readNumber,
  readText,
  parseDelimitedStrings,
  runtimeSkillKey,
  sheetlessSkills,
} from './values.ts';
import type { CreatureSize } from '../../src/lib/character-sheet-creature-sizes.ts';
import type { Ability } from '../../src/lib/character-sheet-abilities.ts';
import type { z } from 'zod';
import type {
  importedArchetypeDetailSchema,
  importedDetailSchema,
} from '../../src/lib/catalog/imported-entry-schema.ts';

type DetailContext = {
  record: SourceRecord;
  upstreamKey: string;
  resolveKey: (key: string) => string | undefined;
  lookup: ReadonlyMap<string, LoadedRecord>;
  spellClassTags: ReadonlySet<string>;
  unsupported: Unsupported[];
  racial?: RacialTraitPlan;
  traitFacts?: RacialTraitFacts;
};

/** Class skills as runtime keys; a skill the sheet lacks is reported. */
function mapClassSkills({
  record: { system },
  unsupported,
}: Pick<DetailContext, 'record' | 'unsupported'>) {
  const abbreviations = Object.entries(readObject(system.classSkills))
    .filter(([, value]) => value === true)
    .map(([abbreviation]) => abbreviation);
  unsupported.push(
    ...abbreviations
      .filter((abbreviation) => !runtimeSkillKey(abbreviation))
      .map((abbreviation) => ({
        field: 'classSkills',
        reason: sheetlessSkills.has(abbreviation)
          ? 'The sheet has no Artistry or Lore skill; this class skill stays prose.'
          : 'No runtime skill has this key; this class skill stays prose.',
        value: abbreviation,
      })),
  );
  return abbreviations
    .flatMap((abbreviation) => runtimeSkillKey(abbreviation) ?? [])
    .sort();
}

function mapProgression(context: DetailContext) {
  const { system } = context.record;
  const saves = readObject(system.savingThrows);
  const babProgressions = new Map([
    ['high', 'full'],
    ['med', 'threeQuarters'],
  ]);
  return {
    hitDie: readNumber({ value: system.hd, fallback: 8 }),
    bab: babProgressions.get(readText({ value: system.bab })) ?? 'half',
    saves: Object.fromEntries(
      ['fort', 'ref', 'will'].map((key) => [
        key,
        readObject(saves[key]).value === 'high' ? 'good' : 'poor',
      ]),
    ),
    classSkills: mapClassSkills(context),
  };
}

// Foundry's size abbreviations (`module/config.mjs`); a race record without
// one has the template's `med`.
const foundrySizes: Record<string, CreatureSize> = {
  fine: 'fine',
  dim: 'diminutive',
  tiny: 'tiny',
  sm: 'small',
  med: 'medium',
  lg: 'large',
  huge: 'huge',
  grg: 'gargantuan',
  col: 'colossal',
};

function mapRaceSize({
  record: { system },
  unsupported,
}: Pick<DetailContext, 'record' | 'unsupported'>) {
  const size = system.size ?? 'med';
  const mapped = typeof size === 'string' ? foundrySizes[size] : undefined;
  if (!mapped)
    unsupported.push({
      field: 'size',
      reason: 'Unknown Foundry size; the race imports without a size.',
      value: size,
    });
  return mapped;
}

function mapRace({
  record,
  upstreamKey,
  resolveKey,
  racial,
  unsupported,
}: DetailContext) {
  const { system } = record;
  const size = mapRaceSize({ record, unsupported });
  const abilityTrait = racial?.abilityTraitOf(upstreamKey);
  return {
    kind: 'race' as const,
    racialHitDice: 0,
    // #720: the size fact the resolver derives AC, attack, CMB, CMD, Stealth
    // and Fly size modifiers from.
    ...(size ? { size } : {}),
    creatureTypes: readStrings(system.creatureTypes),
    creatureSubtypes: readStrings(system.creatureSubtypes),
    // #719: the standard Racial Traits this race grants, by stable key, and
    // #721: its reviewed ability score trait, which no pinned record holds.
    racialTraits: [
      ...(racial?.standardOf(upstreamKey) ?? []).flatMap(
        (trait) => resolveKey(toExternalKey(trait)) ?? [],
      ),
      ...(abilityTrait ? [abilityTrait.key] : []),
    ].sort(compare),
  };
}

function mapClassFeatures({
  record: { system },
  resolveKey,
  unsupported,
}: DetailContext) {
  return readArray(readObject(system.links).classAssociations).flatMap(
    (value) => {
      const link = readObject(value);
      const upstream = uuidKey(readText({ value: link.uuid }));
      const key = upstream && resolveKey(upstream);
      if (key) return [{ classLevel: link.level, externalKey: key }];
      unsupported.push({
        field: 'links.classAssociations',
        reason: 'Missing or out-of-scope feature reference.',
        value: { level: link.level, uuid: readText({ value: link.uuid }) },
      });
      return [];
    },
  );
}

/**
 * S3: Foundry's casting ability codes, as stored casting names them
 * (`classCastingSchema`), so an imported caster compares equal to its
 * reviewed casting record.
 */
const foundryCastingAbilities: Readonly<Record<string, Ability>> = {
  str: 'strength',
  dex: 'dexterity',
  con: 'constitution',
  int: 'intelligence',
  wis: 'wisdom',
  cha: 'charisma',
};

/**
 * The stored name of a Foundry ability code. Any other code, even a stored
 * name, is kept and reported, and admission fails the class on it.
 */
function mapCastingAbility(code: unknown, unsupported: Unsupported[]) {
  if (code === undefined) return undefined;
  if (typeof code === 'string' && Object.hasOwn(foundryCastingAbilities, code))
    return foundryCastingAbilities[code];
  unsupported.push({
    field: 'casting.ability',
    reason: 'Unknown Foundry casting ability code.',
    value: code,
  });
  return code;
}

function mapCasting({ record: { system }, unsupported }: DetailContext) {
  const casting = readObject(system.casting);
  if (!Object.keys(casting).length) return {};
  unsupported.push({
    field: 'casting',
    reason: 'Casting tables and class schedules require feature curation.',
  });
  return {
    casting: {
      ability: mapCastingAbility(casting.ability, unsupported),
      spellKind: casting.spells,
      casterLevelOffset: casting.offset,
      type: casting.type,
    },
  };
}

function mapClass(context: DetailContext) {
  const { system } = context.record;
  const classKinds = new Map([
    ['prestige', 'prestige'],
    ['npc', 'npc'],
  ]);
  return {
    kind: 'class' as const,
    ...mapProgression(context),
    tag: readText({ value: system.tag }),
    classKind: classKinds.get(readText({ value: system.subType })) ?? 'base',
    skillRanksPerLevel: readNumber({
      value: system.skillsPerLevel,
      fallback: 2,
    }),
    featuresByLevel: mapClassFeatures(context),
    ...mapCasting(context),
  };
}

function mapCreatureType(context: DetailContext) {
  const { system } = context.record;
  mapClassFeatures(context);
  return {
    kind: 'creatureType' as const,
    ...mapProgression(context),
    tag: readText({ value: system.tag }),
    skillRanksPerHitDie: readNumber({
      value: system.skillsPerLevel,
      fallback: 2,
    }),
  };
}

// #716 P5/P6: an imported class feature may carry an increment's parent and part.
function mapClassFeature(): Extract<
  z.infer<typeof importedDetailSchema>,
  { kind: 'classFeature' }
> {
  return { kind: 'classFeature' };
}
function mapManual() {
  return { kind: 'manual' as const };
}
function mapFeat({ record }: DetailContext) {
  const { system } = record;
  return {
    kind: 'feat' as const,
    featTypes: readStrings(system.tags),
    repeatable: 'unreviewed',
    ...selectionImportRule({ kind: 'feat', record })?.detail,
  };
}
function mapTrait({ record: { system } }: DetailContext) {
  return {
    kind: 'trait' as const,
    traitType: readText({ value: system.traitType }),
  };
}
function mapRacialTrait({
  upstreamKey,
  resolveKey,
  racial,
  traitFacts,
}: DetailContext) {
  const placement = racial?.placementOf(upstreamKey);
  const stableKeyOf = racial?.stableKeyOf ?? ((key) => resolveKey(key) ?? key);
  return {
    kind: 'racialTrait' as const,
    ...(traitFacts?.abilityChoiceCount
      ? { abilityChoiceCount: traitFacts.abilityChoiceCount }
      : {}),
    ...(traitFacts?.size ? { size: traitFacts.size } : {}),
    // Skilled's ranks come from its `bonusSkillRanks` change (#719).
    bonusSkillRanksPerLevel: traitFacts?.bonusSkillRanksPerLevel ?? 0,
    ...(placement
      ? {
          raceKeys: placement.races.map(stableKeyOf),
          standard: placement.isStandard,
          replaces: placement.replaces.map(stableKeyOf),
          ...(placement.unresolvedReplacements.length
            ? { unresolvedReplacements: placement.unresolvedReplacements }
            : {}),
        }
      : {}),
    ...(traitFacts?.favoredClassCount
      ? { favoredClassCount: traitFacts.favoredClassCount }
      : {}),
  };
}

function mapSpell({
  record: { system },
  spellClassTags,
  unsupported,
}: DetailContext) {
  const learnedAt = readObject(system.learnedAt);
  const levels = readObject(learnedAt.class);
  for (const tag of Object.keys(levels))
    if (!spellClassTags.has(tag))
      unsupported.push({
        field: `levels.${tag}`,
        reason: 'No class with this tag in the extracted inputs.',
        value: levels[tag],
      });
  return {
    kind: 'spell' as const,
    levels,
    grantedLevels: Object.fromEntries(
      Object.entries(learnedAt).filter(([key]) => key !== 'class'),
    ),
    school: readText({ value: system.school }),
    subschools: parseDelimitedStrings(system.subschool),
    // Pinned pf1 v11 stores descriptors in `descriptors`; `types` is the
    // pre-v10 field Foundry migrates from (#738).
    descriptors: parseDelimitedStrings(system.descriptors ?? system.types),
  };
}

function normalizeSpellName(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*$/, '')
    .split(',')
    .reverse()
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function mapSpellAssociation({
  record,
  lookup,
  resolveKey,
  unsupported,
}: DetailContext) {
  const link =
    /@(?:UUID\[Compendium\.|Compendium\[)(pf1\.spells\.(?:Item\.)?[A-Za-z0-9]+)\]/.exec(
      sourceDescription(record),
    );
  const key = link?.[1] && uuidKey(`Compendium.${link[1]}`);
  const spellName = key && lookup.get(key)?.record.name;
  if (
    key &&
    spellName &&
    normalizeSpellName(spellName) === normalizeSpellName(record.name)
  )
    return { spellKey: resolveKey(key) };
  unsupported.push({
    field: 'spellKey',
    reason: 'Spell effect needs a reviewed spell association.',
    value: key ?? null,
  });
  return {};
}

function mapSpellEffect(context: DetailContext) {
  const {
    record: { system },
    unsupported,
  } = context;
  const duration = readObject(system.duration);
  const multiplier: Record<string, number> = {
    round: 6,
    minute: 60,
    hour: 3600,
    day: 86400,
  };
  const seconds =
    readNumber({ value: duration.value, fallback: Number.NaN }) *
    (multiplier[readText({ value: duration.units })] ?? Number.NaN);
  if (!Number.isFinite(seconds) && duration.units !== 'perm')
    unsupported.push({
      field: 'duration',
      reason:
        'Duration requires reviewed formula interpretation; permanent eligibility is not established.',
      value: {
        units: readText({ value: duration.units }),
        value:
          typeof duration.value === 'string' ||
          typeof duration.value === 'number'
            ? duration.value
            : null,
      },
    });
  return {
    kind: 'spellEffect' as const,
    defaultCasterLevel: readNumber({ value: system.level, fallback: 1 }),
    lastsOverOneDay: duration.units === 'perm' || seconds > 86400,
    ...mapSpellAssociation(context),
  };
}

function mapLegacyWeapon({ record, unsupported }: DetailContext) {
  const { system } = record;
  const actions = readArray(system.actions).map(readObject);
  const first = primaryWeaponAction(actions);
  if (!['weapon', 'attack'].includes(record.type) && first?.name !== 'Bash')
    return {};
  const damage = readObject(readArray(readObject(first?.damage).parts)[0]);
  const dice = /^sizeRoll\(\s*(\d+)\s*,\s*(\d+)\s*,\s*@size\s*\)$/.exec(
    readText({ value: damage.formula }),
  );
  const ability = readObject(first?.ability);
  const ranged = actions.find(
    (action) => readObject(action.range).units === 'ft',
  );
  const rangeIncrement = ranged
    ? Number(readObject(ranged.range).value)
    : Number.NaN;
  if (!dice)
    unsupported.push({
      field: 'weapon.damage',
      reason: 'Damage formula needs feature mapping.',
      value: readText({ value: damage.formula }),
    });
  return {
    weapon: {
      baseTypes: readStrings(system.baseTypes),
      groups: readStrings(system.weaponGroups),
      proficiency:
        system.proficient === true
          ? 'always'
          : readText({ value: system.subType, fallback: 'simple' }),
      handedness: readText({ value: system.weaponSubtype, fallback: 'light' }),
      dice: dice ? `${dice[1]}d${dice[2]}` : null,
      damageTypes: readStrings(damage.types),
      threat: readNumber({ value: ability.critRange, fallback: 20 }),
      mult: readNumber({ value: ability.critMult, fallback: 2 }),
      finesse: readObject(system.properties).fin === true,
      thrown: actions.some((action) => action.actionType === 'twak'),
      ...(Number.isFinite(rangeIncrement) ? { rangeIncrement } : {}),
    },
  };
}

type WeaponProfile = z.infer<typeof importedWeaponSchema>;

function weaponStrengthDamage({
  system,
  baseType,
  ranged,
  thrown,
}: {
  system: SourceRecord['system'];
  baseType: string;
  ranged: boolean;
  thrown: boolean;
}): WeaponProfile['strengthDamage'] {
  const sling = findSlingWeaponRule(baseType);
  if (sling) return sling.strengthDamage;
  if (/crossbow/i.test(baseType)) return 'crossbow';
  if (readStrings(system.tags).includes('Composite')) return 'compositeBow';
  if (/^(?:Shortbow|Longbow)$/.test(baseType)) return 'bow';
  if (!ranged) return 'melee';
  if (thrown) return 'thrown';
}

function weaponHandedness(system: SourceRecord['system']) {
  if (system.weaponSubtype === 'ranged')
    return system.hands === 2 ? 'twoHanded' : 'oneHanded';
  if (system.weaponSubtype === '1h') return 'oneHanded';
  if (system.weaponSubtype === '2h') return 'twoHanded';
  return readText({ value: system.weaponSubtype, fallback: 'light' });
}

function weaponReload({
  baseType,
  strengthDamage,
}: Pick<WeaponProfile, 'baseType' | 'strengthDamage'>) {
  const sling = findSlingWeaponRule(baseType);
  if (sling) return sling.reload;
  if (strengthDamage === 'bow' || strengthDamage === 'compositeBow')
    return 'free' as const;
  return weaponReloadRule(baseType);
}

function mapWeaponCritical({
  ability,
  hasDice,
  criticalDisabled,
  noCritical,
}: {
  ability: Record<string, unknown>;
  hasDice: boolean;
  criticalDisabled: boolean;
  noCritical: boolean;
}) {
  if (noCritical) return {};
  if (hasDice)
    return {
      ...(!criticalDisabled
        ? { threat: readNumber({ value: ability.critRange, fallback: 20 }) }
        : {}),
      mult: readNumber({ value: ability.critMult, fallback: 2 }),
    };
  return {
    ...(typeof ability.critRange === 'number' && ability.critRange > 0
      ? { threat: ability.critRange }
      : {}),
    ...(typeof ability.critMult === 'number' ? { mult: ability.critMult } : {}),
  };
}

function weaponRanges({
  actions,
  ranged,
}: {
  actions: Record<string, unknown>[];
  ranged: boolean;
}) {
  const range = actions.find(
    (action) =>
      (ranged ||
        ['rwak', 'twak'].includes(readText({ value: action.actionType }))) &&
      readObject(action.range).units === 'ft',
  );
  const increment = Number(readObject(range?.range).value);
  if (!Number.isFinite(increment) || increment <= 0) return {};
  if (ranged) return { rangeIncrement: increment };
  return { thrownRangeIncrement: increment };
}

function primaryWeaponAction(actions: Record<string, unknown>[]) {
  return actions.find((action) => action.name === 'Bash') ?? actions[0];
}

function findIncompleteRangedFields(weapon: WeaponProfile) {
  const missing: {
    field: 'strengthDamage' | 'reload';
    reason: string;
  }[] = [];
  // Existing refusals and incomplete attack statistics already fail safely.
  // A newly calculable native ranged profile must not certify model defaults.
  if (
    weapon.attackType !== 'ranged' ||
    !weapon.dice ||
    weapon.threat === undefined ||
    weapon.mult === undefined ||
    weapon.unresolved
  )
    return missing;
  if (!weapon.strengthDamage)
    missing.push({
      field: 'strengthDamage',
      reason:
        'Ranged Strength behavior has no reviewed mapping; zero Strength damage is not confirmed.',
    });
  if (!weapon.thrown && !weapon.reload)
    missing.push({
      field: 'reload',
      reason:
        'Ranged firing/reload procedure has no reviewed mapping; unlimited attacks are not confirmed.',
    });
  return missing;
}

/** Native action defaults are in pf1 public/template.json; PCGen CRB/APG
 * equipment rows supply launcher Strength and reload semantics. Extra actions
 * and special qualities remain separately owned curation findings. */
function mapCanonicalWeapon(context: DetailContext) {
  const { record, unsupported } = context;
  const { system } = record;
  const actions = readArray(system.actions).map(readObject);
  const bash = actions.find((action) => action.name === 'Bash');
  if (!['weapon', 'attack'].includes(record.type) && !bash) return {};
  // Double ends and siege classification remain #761 work. Keep their exact
  // legacy bodies and holds rather than admitting a single end here.
  if (
    !context.upstreamKey.startsWith('pf1/') ||
    record.type === 'attack' ||
    readObject(system.ammo).type === 'siege' ||
    actions.some((action) => readObject(action.ammo).type === 'siege') ||
    readObject(system.properties).dbl === true ||
    readStrings(system.weaponGroups).includes('double') ||
    system.subType === 'siege' ||
    system.weaponSubtype === 'siege' ||
    system.extraType === 'siege'
  )
    return undefined;
  const first = primaryWeaponAction(actions);
  const damage = readObject(readArray(readObject(first?.damage).parts)[0]);
  const formula = readText({ value: damage.formula });
  const dice =
    /^sizeRoll\(\s*(\d+)\s*,\s*(\d+)\s*,\s*@size\s*\)(?: \+ min\(@abilities\.str\.mod, 0\)\[Strength\])?$/.exec(
      formula,
    );
  const baseTypes = readStrings(system.baseTypes);
  if ((!dice && formula) || baseTypes.length > 1) return undefined;
  if (!dice)
    unsupported.push({
      field: 'weapon.damage',
      reason:
        'Source has no primary damage dice; special non-damaging attack remains held.',
    });
  const baseType = baseTypes[0] ?? record.name;
  const sling = findSlingWeaponRule(baseType);
  // A family name is sufficient to withhold an unreviewed variant, never to
  // grant the ordinary sling's Strength, reload or projectile interpretation.
  if (/sling/i.test(baseType) && !sling) return undefined;
  const ability = readObject(first?.ability);
  const properties = readObject(system.properties);
  // Native null explicitly disables criticals (pf1 action.mjs: critRange).
  // The stored attack model cannot express that yet; keep it unresolved.
  const rule = findWeaponImportRule(context.upstreamKey);
  const criticalPolicy = rule?.criticalPolicy?.kind;
  const noCritical = criticalPolicy === 'noCritical';
  const criticalDisabled =
    noCritical || ability.critRange === null || ability.critRange === 0;
  if (
    dice &&
    criticalDisabled &&
    criticalPolicy !== 'sourceConflict' &&
    !noCritical
  )
    return undefined;
  if (noCritical)
    unsupported.push({
      field: 'weapon.critical',
      reason:
        'Source specifies no critical multiplier; the stored attack model cannot represent a non-critical attack.',
    });
  else if (dice && criticalDisabled)
    unsupported.push({
      field: 'weapon.threat',
      reason:
        'Native action disables criticals; critical behavior needs source review before calculation.',
    });
  const ranged = system.weaponSubtype === 'ranged';
  const thrownAction = actions.find((action) => action.actionType === 'twak');
  const strengthDamage = weaponStrengthDamage({
    system,
    baseType,
    ranged,
    thrown: Boolean(thrownAction),
  });
  const reload = weaponReload({ baseType, strengthDamage });
  const crossbow = strengthDamage === 'crossbow';
  const handedness = rule?.handedness ?? weaponHandedness(system);
  const unresolved: NonNullable<WeaponProfile['unresolved']> = [];
  const hold = (
    field: NonNullable<WeaponProfile['unresolved']>[number],
    reason: string,
  ) => {
    unresolved.push(field);
    unsupported.push({ field: `weapon.${field}`, reason });
  };
  if (crossbow && !reload)
    hold(
      'reload',
      'Reload procedure needs reviewed mapping; standard-action and special reloads are not represented by the sheet reload choices.',
    );
  if (rule?.strengthDamageHold) hold('strengthDamage', rule.strengthDamageHold);
  if (criticalPolicy === 'keenInclusive')
    hold(
      'criticalEffects',
      'Source critical range includes keen; its interaction with Improved Critical is not represented.',
    );
  const weapon = importedWeaponSchema.safeParse({
    ...(unresolved.length ? { unresolved } : {}),
    baseType,
    groups: readStrings(system.weaponGroups),
    proficiency:
      system.proficient === true
        ? 'always'
        : readText({ value: system.subType, fallback: 'simple' }),
    handedness,
    attackType: ranged ? 'ranged' : 'melee',
    ...(dice ? { dice: `${dice[1]}d${dice[2]}` } : {}),
    damageTypes: readStrings(damage.types),
    ...mapWeaponCritical({
      ability,
      hasDice: Boolean(dice),
      criticalDisabled,
      noCritical,
    }),
    finesse: properties.fin === true,
    monk: properties.mnk === true,
    thrown:
      (Boolean(thrownAction) || rule?.thrownRangeIncrement !== undefined) &&
      (sling?.thrown ?? true),
    ...(strengthDamage ? { strengthDamage } : {}),
    ...(strengthDamage === 'compositeBow'
      ? { strengthRating: readNumber({ value: ability.max, fallback: 0 }) }
      : {}),
    ...weaponRanges({ actions, ranged }),
    ...(rule?.thrownRangeIncrement
      ? { thrownRangeIncrement: rule.thrownRangeIncrement }
      : {}),
    ...(reload ? { reload } : {}),
  });
  if (!weapon.success) return undefined;
  const missing = findIncompleteRangedFields(weapon.data);
  if (missing.length) {
    weapon.data.unresolved = missing.map(({ field }) => field);
    for (const { field, reason } of missing)
      unsupported.push({ field: `weapon.${field}`, reason });
  }
  return { weapon: weapon.data };
}

function mapWeapon(context: DetailContext) {
  const findings: Unsupported[] = [];
  const result = mapCanonicalWeapon({ ...context, unsupported: findings });
  if (!result) return mapLegacyWeapon(context);
  context.unsupported.push(...findings);
  return result;
}

/**
 * Whether a record's `system.armor` is worn armor. Packs leave out the
 * template default subType 'armor' (pf1 public/template.json). Clothing and
 * wondrous items carry a material-only block (#762); a few upstream records
 * filed under another subType still state an armor check penalty or a max
 * Dex, so they stay armor.
 */
function isArmor(system: Record<string, unknown>) {
  const armor = readObject(system.armor);
  if (!Object.keys(armor).length) return false;
  const subType = readText({ value: system.subType, fallback: 'armor' });
  return (
    subType === 'armor' ||
    subType === 'shield' ||
    'acp' in armor ||
    'dex' in armor
  );
}

/**
 * #762: an item that isn't armor but states an armor value (bracers of armor,
 * CRB p. 504: "an armor bonus ... just as though he were wearing armor")
 * grants that armor bonus as a Modifier, as Foundry pf1 adds any equipped
 * item's armor.value to armor AC; it never becomes worn armor.
 */
export function mapItemArmorBonus(system: Record<string, unknown>) {
  if (isArmor(system)) return [];
  const value = readNumber({
    value: readObject(system.armor).value,
    fallback: 0,
  });
  return value
    ? [{ target: 'ac.armor', bonusType: 'armor', value } as const]
    : [];
}

function mapArmor(system: Record<string, unknown>) {
  if (!isArmor(system)) return {};
  const armor = readObject(system.armor);
  // Packs leave out template defaults: subType 'armor', equipmentSubtype
  // 'lightArmor' (pf1 public/template.json).
  const subType = readText({ value: system.subType, fallback: 'armor' });
  return {
    armor: {
      slot: subType === 'shield' ? 'shield' : 'armor',
      category: readText({
        value: system.equipmentSubtype,
        fallback: subType === 'armor' ? 'lightArmor' : '',
      }),
      bonus: readNumber({ value: armor.value, fallback: 0 }),
      maxDex: armor.dex ?? null,
      armorCheckPenalty: readNumber({ value: armor.acp, fallback: 0 }),
      asf: readNumber({ value: system.spellFailure, fallback: 0 }),
    },
  };
}

function mapItemMagic(system: Record<string, unknown>) {
  const armor = readObject(system.armor);
  if (system.enh === undefined && armor.enh === undefined) return {};
  return {
    magic: {
      enhancement: readNumber({ value: armor.enh ?? system.enh, fallback: 0 }),
      masterwork: system.masterwork === true,
    },
  };
}

function mapItem(context: DetailContext) {
  const { record } = context;
  const { system } = record;
  const baseItemKey = findWeaponImportRule(context.upstreamKey)?.baseItemKey;
  return {
    kind: 'item' as const,
    consumable: record.type === 'consumable',
    ...(context.upstreamKey.startsWith('pf1/') &&
    record.type === 'loot' &&
    system.subType === 'ammo' &&
    system.extraType !== 'siege'
      ? { ammunition: true }
      : {}),
    ...(baseItemKey
      ? { baseItemKey: context.resolveKey(baseItemKey) ?? baseItemKey }
      : {}),
    price: readNumber({ value: system.price, fallback: 0 }),
    weight: readNumber({ value: readObject(system.weight).value, fallback: 0 }),
    ...mapWeapon(context),
    ...mapArmor(system),
    ...mapItemMagic(system),
  };
}

function mapItemAbility({ record: { system }, unsupported }: DetailContext) {
  const applies: Record<string, string> = {
    'Universal Weapon Qualities': 'weapon',
    'Melee Qualities': 'melee',
    'Ranged Qualities': 'ranged',
    'Armor Qualities': 'armor',
    'Shield Qualities': 'shield',
    'Armor and Shield Qualities': 'armorOrShield',
    // The pinned pf1-content pack's tag (#764).
    'Universal Armor & Shield Qualities': 'armorOrShield',
  };
  unsupported.push({
    field: 'itemAbility',
    reason:
      'Bonus equivalent, dice and conditional mechanics require reviewed curation.',
  });
  return {
    kind: 'itemAbility' as const,
    appliesTo:
      readStrings(system.tags)
        .map((tag) => applies[tag])
        .find(Boolean) ?? null,
  };
}

function recordCompanionCuration(unsupported: Unsupported[]) {
  unsupported.push({
    field: 'companion',
    reason:
      'Companion templates, embedded items and progression need feature-owned resources; actor IDs are not playable definitions.',
  });
}

function mapCompanionFeatureFields({
  record: { system },
  unsupported,
}: DetailContext) {
  recordCompanionCuration(unsupported);
  return {
    tag: readText({ value: system.tag }),
    associations: readStrings(readObject(system.associations).classes),
  };
}
function mapCompanionFields({
  record: { system },
  unsupported,
}: DetailContext) {
  recordCompanionCuration(unsupported);
  return {
    abilities: Object.fromEntries(
      Object.entries(readObject(system.abilities)).map(([key, value]) => [
        key,
        readObject(value).value,
      ]),
    ),
    size: readObject(system.traits).size,
    creatureTypes: readStrings(readObject(system.traits).creatureTypes),
  };
}
function mapCompanionFeature(context: DetailContext) {
  return {
    kind: 'companionFeature' as const,
    ...mapCompanionFeatureFields(context),
  };
}
function mapCompanion(context: DetailContext) {
  return { kind: 'companion' as const, ...mapCompanionFields(context) };
}
function mapFamiliar(context: DetailContext) {
  return { kind: 'familiar' as const, ...mapCompanionFields(context) };
}
function mapEidolonForm(context: DetailContext) {
  return { kind: 'eidolonForm' as const, ...mapCompanionFields(context) };
}
function mapEidolonEvolution(context: DetailContext) {
  return {
    kind: 'eidolonEvolution' as const,
    ...mapCompanionFeatureFields(context),
  };
}

export const detailMappers = {
  race: mapRace,
  class: mapClass,
  creatureType: mapCreatureType,
  classFeature: mapClassFeature,
  feat: mapFeat,
  trait: mapTrait,
  racialTrait: mapRacialTrait,
  spell: mapSpell,
  spellEffect: mapSpellEffect,
  item: mapItem,
  itemAbility: mapItemAbility,
  manual: mapManual,
  companionFeature: mapCompanionFeature,
  companion: mapCompanion,
  familiar: mapFamiliar,
  eidolonForm: mapEidolonForm,
  eidolonEvolution: mapEidolonEvolution,
} satisfies Record<
  ImportKind,
  (context: DetailContext) => { kind: ImportKind }
>;

type ImportedDetail = ReturnType<(typeof detailMappers)[ImportKind]>;
export type PreviewDetail =
  | {
      kind: 'condition';
      conditionKey: ConditionKey;
      unmodeled: string[];
      deniesDexterityBonus: boolean;
      citations: string[];
      sourceSections: string[];
      curationInputs: Record<string, string>;
    }
  | Exclude<ImportedDetail, { kind: 'itemAbility' }>
  | (Extract<ImportedDetail, { kind: 'itemAbility' }> &
      Omit<CuratedItemAbility, 'sourceKey'>)
  // #716 P5: the PCGen archetype mapper's entries.
  | z.infer<typeof importedArchetypeDetailSchema>;
