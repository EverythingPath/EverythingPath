import type {
  AttackLine,
  AttackStatistic,
  WeaponDetail,
} from '~/lib/character-sheet-attacks';
import type { SheetEntryInput } from './use-character-sheet-entries';
import type { SheetWarning } from '~/lib/character-sheet';
import { formatCriticalRange } from '~/lib/character-sheet-attacks';
import { defaultAttackRoutineConfiguration } from '~/lib/character-sheet-attacks';
import { builtInUnarmedWeapon } from '~/lib/character-sheet-attacks';
import { UNARMED_STRIKE_ID } from '~/lib/character-sheet-attack-types';
import { createItemDefinitionLookup } from '~/lib/character-sheet-items';
import { isCatalogSheetDefinition } from '~/lib/character-sheet-entries';
import {
  naturalAttackProfiles,
  naturalAttackRoleLabel,
  cloneWeaponDetail,
} from '~/lib/character-sheet-natural-attacks';
import type { CharacterSheetBreakdownTarget } from '~/lib/character-sheet-breakdowns';
import { formatSigned } from './equipment-statistics';
import { describeSituation } from './modifier-labels';
import type {
  CharacterSheetSnapshot,
  SheetWarningView,
} from './use-character-sheet';

/** Every displayed routine number carries the resolver's structured breakdown address. */
export function attackRoutineLineView({
  entryId,
  sequence,
  attackIndex,
  line,
  ammunitionName = null,
}: {
  entryId: string;
  sequence: 'single' | 'full';
  attackIndex: number;
  line: AttackLine;
  ammunitionName?: string | null;
}) {
  function target(statistic: AttackStatistic): CharacterSheetBreakdownTarget {
    return { kind: 'attackRoutine', entryId, sequence, attackIndex, statistic };
  }
  const threat = line.criticalThreat.total;
  const damage = line.damageBonus.total;
  const rangePenalty = line.rangePenalty;
  return {
    weaponEntryId: line.weaponEntryId,
    launcherEntryId: line.launcherEntryId,
    ammunitionEntryId: line.ammunitionEntryId,
    ammunitionName,
    weaponName: line.weaponName,
    attackKind: line.attackKind,
    naturalRole: line.naturalRole ?? null,
    damageKind: line.damageKind ?? null,
    damageKindLabel:
      line.damageKind === 'nonlethal'
        ? 'Nonlethal'
        : line.damageKind === 'lethalOrNonlethal'
          ? 'Lethal or nonlethal'
          : null,
    hand: line.hand,
    end: line.end,
    roleLabel: line.naturalRole
      ? naturalAttackRoleLabel(line.naturalRole)
      : null,
    positionLabel: line.hand === 'off' ? 'Off hand' : 'Main hand',
    endLabel: line.end === 'otherEnd' ? 'Other end' : null,
    mode: line.mode,
    position: sequence === 'single' ? null : attackIndex + 1,
    /** The rule giving an additional highest-bonus attack ("Haste"). */
    extraAttack: line.extraAttack
      ? { kind: line.extraAttack.kind, label: line.extraAttack.name }
      : null,
    /** Manyshot: "2 arrows" on the first full-attack shot. */
    projectilesLabel:
      line.projectiles && line.projectiles > 1
        ? `${line.projectiles} arrows`
        : null,
    /** Vital Strike: the multiplied dice are already in `damage.dice`. */
    vitalStrike: line.vitalStrike
      ? {
          /** The switched-on feat's name, such as Improved Vital Strike. */
          label: line.vitalStrike.name,
          weaponDice: line.vitalStrike.weaponDice,
          multiplier: line.vitalStrike.multiplier,
        }
      : null,
    /**
     * Item Ability dice, never multiplied on a critical: "+1d6 fire",
     * "+2d10 fire on a critical hit", "+2d6 vs. undead" (Situational until
     * that Situation is previewed).
     */
    extraDamage: line.extraDamage.map((part) => ({
      text: `+${part.dice}${part.damageType ? ` ${part.damageType}` : ''}${
        part.situation ? ` ${describeSituation(part.situation)}` : ''
      }${part.on === 'crit' ? ' on a critical hit' : ''}`,
      source: part.name,
      critical: part.on === 'crit',
      situation: part.situation,
      // The item carrying the die: a local Situation is that item's own.
      sheetEntryId: part.sheetEntryId,
      applies: part.applies,
    })),
    attack: {
      text: formatSigned(line.attackBonus.total),
      statistic: line.attackBonus,
      target: target('attackBonus'),
    },
    damage: {
      text: `${line.damageDice}${damage === 0 ? '' : formatSigned(damage)}`,
      dice: line.damageDice,
      statistic: line.damageBonus,
      target: target('damageBonus'),
      diceSource: line.damageDiceSource,
      damageType: line.damageType,
    },
    critical: {
      text: `${threat === 20 ? '' : `${formatCriticalRange(threat)}/`}×${line.criticalMultiplier.total}`,
      threat: {
        statistic: line.criticalThreat,
        target: target('criticalThreat'),
      },
      multiplier: {
        statistic: line.criticalMultiplier,
        target: target('criticalMultiplier'),
      },
    },
    range:
      line.rangeIncrement === null
        ? null
        : {
            text: `${line.rangeIncrement.total} ft.`,
            statistic: line.rangeIncrement,
            target: target('rangeIncrement'),
            /** The attack penalty for firing beyond the first increment, or null within it. */
            penalty: rangePenalty,
            penaltyText:
              rangePenalty === null ? null : formatSigned(rangePenalty),
          },
  };
}

/** Routine warnings use the sheet's acceptance without borrowing Gear warnings. */
export function listAttackRoutineWarnings(
  warnings: SheetWarningView[],
  row: { warnings: readonly SheetWarning[] },
): SheetWarningView[] {
  return row.warnings.map(
    (warning) =>
      warnings.find(
        (view) =>
          view.check === warning.check &&
          view.subject === warning.subject &&
          view.fingerprint === warning.fingerprint,
      ) ?? { ...warning, accepted: false },
  );
}

/** Resolve display addresses and retain the observed routine revision. */
export function listAttackRoutineRows(
  snapshot: CharacterSheetSnapshot | null | undefined,
) {
  const states = new Map<
    string,
    Extract<
      CharacterSheetSnapshot['entries'][number],
      { kind: 'attackRoutine' }
    >['state']
  >(
    (snapshot?.entries ?? []).flatMap((entry) =>
      entry.kind === 'attackRoutine' ? [[entry._id, entry.state] as const] : [],
    ),
  );
  const entries = new Map(
    (snapshot?.entries ?? []).map((entry): [string, typeof entry] => [
      entry._id,
      entry,
    ]),
  );
  const catalogNames = new Map(
    (snapshot?.catalogEntries ?? []).map((row): [string, string] => [
      row._id,
      row.name,
    ]),
  );
  function ammunitionName(entryId: string | null) {
    const entry = entryId === null ? undefined : entries.get(entryId);
    if (entry?.kind !== 'item') return null;
    return catalogNames.get(entry.catalogEntryId) ?? null;
  }
  return (snapshot?.calculated.attackRoutines ?? []).map((routine) => ({
    ...routine,
    /** The recorded switched-on options the editor saves as one list. */
    optionIds: states.get(routine.entryId)?.options ?? [],
    /** Switched-on options as chips; unavailable or inapplicable ones are flagged. */
    optionChips: routine.options.flatMap((option) =>
      option.switchedOn
        ? [
            {
              catalogEntryId: option.catalogEntryId,
              label: option.name,
              isInEffect: option.available && option.applicable,
            },
          ]
        : [],
    ),
    rendView: routine.twoWeaponRend
      ? {
          label: routine.twoWeaponRend.name,
          text: `${routine.twoWeaponRend.damageDice}${
            routine.twoWeaponRend.damageBonus.total === 0
              ? ''
              : formatSigned(routine.twoWeaponRend.damageBonus.total)
          }`,
          note: 'Once per round, when both hands hit.',
          statistic: routine.twoWeaponRend.damageBonus,
          target: {
            kind: 'twoWeaponRend',
            entryId: routine.entryId,
          } satisfies CharacterSheetBreakdownTarget,
        }
      : null,
    ammunitionEntryId: routine.ammunitionEntryId ?? null,
    rangeIncrements: routine.rangeIncrements ?? 1,
    naturalAttackEntryIds:
      states.get(routine.entryId)?.naturalAttackEntryIds ?? [],
    availableLimbs: states.get(routine.entryId)?.availableLimbs ?? 2,
    singleView: routine.single.map((line, attackIndex) =>
      attackRoutineLineView({
        entryId: routine.entryId,
        sequence: 'single',
        attackIndex,
        line,
        ammunitionName: ammunitionName(line.ammunitionEntryId),
      }),
    ),
    fullView: routine.full.map((line, attackIndex) =>
      attackRoutineLineView({
        entryId: routine.entryId,
        sequence: 'full',
        attackIndex,
        line,
        ammunitionName: ammunitionName(line.ammunitionEntryId),
      }),
    ),
    revision: states.get(routine.entryId)?.revision ?? 0,
  }));
}

/**
 * Definitions as the calculator sees them: a specific magic item takes its
 * weapon, and its armor unless it has its own, from its Base Item.
 */
function itemDefinitions(snapshot: CharacterSheetSnapshot | null | undefined) {
  return createItemDefinitionLookup(snapshot?.catalogEntries ?? []);
}

/** Number same-named recorded weapons in their stable sheet order. */
export function listAttackRoutineWeapons(
  snapshot: CharacterSheetSnapshot | null | undefined,
) {
  const definitionOf = itemDefinitions(snapshot);
  const available = (snapshot?.entries ?? []).flatMap((entry) => {
    if (entry.kind !== 'item') return [];
    const catalog = definitionOf(entry.catalogEntryId);
    if (catalog?.detail.kind !== 'item' || !catalog.detail.weapon) return [];
    // CRB p. 152: a shield attacks with its bash, which has its own
    // enhancement apart from its AC bonus.
    const primaryPart =
      catalog.detail.armor?.slot === 'shield'
        ? ('bash' as const)
        : ('primary' as const);
    const primary =
      primaryPart === 'bash' ? (entry.state.bash ?? {}) : entry.state;
    return [
      {
        entryId: entry._id,
        name: catalog.name,
        weapon: catalog.detail.weapon,
        active: entry.active,
        isBuiltIn: false,
        /** The item part the weapon's own details edit. */
        primaryPart,
        primaryState: {
          masterwork: primary.masterwork ?? false,
          enhancement: primary.enhancement ?? 0,
          material: primary.material ?? null,
        },
        otherEndState: {
          masterwork: entry.state.otherEnd?.masterwork ?? false,
          enhancement: entry.state.otherEnd?.enhancement ?? 0,
          material: entry.state.otherEnd?.material ?? null,
        },
      },
    ];
  });
  const builtIn = {
    entryId: UNARMED_STRIKE_ID,
    name: 'Unarmed strike',
    weapon: builtInUnarmedWeapon,
    active: true,
    isBuiltIn: true,
    primaryPart: 'primary' as const,
    primaryState: { masterwork: false, enhancement: 0, material: null },
    otherEndState: { masterwork: false, enhancement: 0, material: null },
  };
  const choices = snapshot ? [...available, builtIn] : available;
  const counts = new Map<string, number>();
  for (const weapon of choices)
    counts.set(weapon.name, (counts.get(weapon.name) ?? 0) + 1);
  const seen = new Map<string, number>();
  return choices.map((weapon) => {
    const index = (seen.get(weapon.name) ?? 0) + 1;
    seen.set(weapon.name, index);
    return {
      ...weapon,
      label:
        (counts.get(weapon.name) ?? 0) > 1
          ? `${weapon.name} ${index}`
          : weapon.name,
    };
  });
}

/** Ammunition remains a Gear choice even while switched off. */
export function listAttackRoutineAmmunition(
  snapshot: CharacterSheetSnapshot | null | undefined,
) {
  const definitionOf = itemDefinitions(snapshot);
  const available = (snapshot?.entries ?? []).flatMap((entry) => {
    if (entry.kind !== 'item') return [];
    const catalog = definitionOf(entry.catalogEntryId);
    if (catalog?.detail.kind !== 'item' || !catalog.detail.ammunition)
      return [];
    return [
      {
        entryId: entry._id,
        name: catalog.name,
        active: entry.active,
        /** Its own enhancement, masterwork and material, for its details. */
        state: {
          masterwork: entry.state.masterwork ?? false,
          enhancement: entry.state.enhancement ?? 0,
          material: entry.state.material ?? null,
        },
      },
    ];
  });
  const counts = new Map<string, number>();
  for (const choice of available)
    counts.set(choice.name, (counts.get(choice.name) ?? 0) + 1);
  const seen = new Map<string, number>();
  return available.map((choice) => {
    const index = (seen.get(choice.name) ?? 0) + 1;
    seen.set(choice.name, index);
    return {
      ...choice,
      label:
        (counts.get(choice.name) ?? 0) > 1
          ? `${choice.name} ${index}`
          : choice.name,
    };
  });
}

/** Adding ammunition selects the item definition without creating a routine. */
export function listAttackAmmunitionCatalog(
  snapshot: CharacterSheetSnapshot | null | undefined,
) {
  const definitionOf = itemDefinitions(snapshot);
  return (snapshot?.catalogEntries ?? []).flatMap((row) => {
    const entry = definitionOf(row._id) ?? row;
    return entry.detail.kind === 'item' &&
      entry.detail.ammunition &&
      !entry.detail.weapon
      ? [{ catalogEntryId: row._id, label: row.name }]
      : [];
  });
}

/** Natural attack references remain real sheet entries, including inactive choices. */
export function listAttackRoutineNaturalAttacks(
  snapshot: CharacterSheetSnapshot | null | undefined,
) {
  const entries = new Map(
    (snapshot?.entries ?? []).map((entry): [string, typeof entry] => [
      entry._id,
      entry,
    ]),
  );
  const catalogs = new Map(
    (snapshot?.catalogEntries ?? []).map((row): [string, typeof row] => [
      row._id,
      row,
    ]),
  );
  return listAttackRoutineWeapons(snapshot).flatMap((choice) => {
    const natural = choice.weapon.naturalAttack;
    if (!natural) return [];
    const role = natural.role ?? naturalAttackProfiles[natural.type].role;
    const entry = entries.get(choice.entryId);
    const catalog =
      entry?.kind === 'item' ? catalogs.get(entry.catalogEntryId) : undefined;
    if (!isCatalogSheetDefinition(catalog) || catalog.detail.kind !== 'item')
      return [];
    const value: SheetEntryInput = {
      name: catalog.name,
      modifiers: catalog.modifiers,
      detail: { ...catalog.detail, weapon: cloneWeaponDetail(choice.weapon) },
    };
    const canEdit =
      catalog.scope === 'character' &&
      catalog.characterId === snapshot?.character._id;
    return [
      {
        ...choice,
        value,
        canEdit,
        editReason: canEdit
          ? null
          : 'Shared definitions are read-only here; customize or detach the definition to edit it',
        naturalType: natural.type,
        naturalRole: role,
        roleLabel: naturalAttackRoleLabel(role),
      },
    ];
  });
}

/** Offer Gear choices without rejecting a table's unusual hand configuration. */
export function listAttackRoutineOffHands(
  weapons: ReturnType<typeof listAttackRoutineWeapons>,
  mainWeaponEntryId: string,
) {
  const main = weapons.find((weapon) => weapon.entryId === mainWeaponEntryId);
  const choices = [
    ...(main?.weapon.otherEnd
      ? [
          {
            ...main,
            choice: { kind: 'otherEnd' as const },
            label: `Other end of ${main.label}`,
            weapon: {
              ...main.weapon,
              ...main.weapon.otherEnd,
              handedness: 'light' as const,
            },
          },
        ]
      : []),
    ...weapons
      .filter((weapon) => !weapon.weapon.naturalAttack)
      .map((weapon) => ({
        ...weapon,
        choice: { kind: 'weapon' as const, weaponEntryId: weapon.entryId },
      })),
  ];
  return choices.map((choice) => ({
    ...choice,
    defaultMode: defaultAttackRoutineConfiguration(choice.weapon).mode,
  }));
}

/** Radio values identify a choice without overloading a Gear entry ID. */
export function attackOffHandChoiceValue(
  choice: { kind: 'weapon'; weaponEntryId: string } | { kind: 'otherEnd' },
) {
  return choice.kind === 'otherEnd'
    ? 'end:otherEnd'
    : `weapon:${choice.weaponEntryId}`;
}

/** Weapon catalog choices exclude armor, whose bash has no default routine. */
export function listAttackWeaponCatalog(
  snapshot: CharacterSheetSnapshot | null | undefined,
) {
  const definitionOf = itemDefinitions(snapshot);
  return (snapshot?.catalogEntries ?? []).flatMap((row) => {
    const entry = definitionOf(row._id) ?? row;
    return entry.detail.kind === 'item' &&
      entry.detail.weapon &&
      !entry.detail.armor
      ? [
          {
            catalogEntryId: row._id,
            label: row.name,
            weapon: entry.detail.weapon,
          },
        ]
      : [];
  });
}

const handednessLabels = {
  light: 'Light',
  oneHanded: 'One-handed',
  twoHanded: 'Two-handed',
} as const;

/** A weapon card's facts: "1d8 · 19–20/×2 · One-handed". */
export function describeWeapon(weapon: WeaponDetail) {
  const critical =
    weapon.threat === undefined || weapon.mult === undefined
      ? null
      : `${weapon.threat === 20 ? '' : `${formatCriticalRange(weapon.threat)}/`}×${weapon.mult}`;
  const range =
    weapon.rangeIncrement === undefined ? null : `${weapon.rangeIncrement} ft.`;
  // A thrown weapon's own increment, where it is not already the range above.
  const thrownRange =
    weapon.thrownRangeIncrement === undefined ||
    weapon.thrownRangeIncrement === weapon.rangeIncrement
      ? ''
      : ` ${weapon.thrownRangeIncrement} ft.`;
  return [
    weapon.dice ?? null,
    critical,
    weapon.naturalAttack
      ? naturalAttackRoleLabel(
          weapon.naturalAttack.role ??
            naturalAttackProfiles[weapon.naturalAttack.type].role,
        )
      : weapon.attackType === 'ranged'
        ? 'Ranged'
        : weapon.handedness
          ? handednessLabels[weapon.handedness]
          : null,
    range,
    weapon.thrown ? `Thrown${thrownRange}` : null,
  ]
    .filter((fact) => fact !== null)
    .join(' · ');
}

export const handsLabels = { one: 'One hand', two: 'Two hands' } as const;
export const modeLabels = {
  melee: 'Melee',
  ranged: 'Ranged',
  thrown: 'Thrown',
} as const;
