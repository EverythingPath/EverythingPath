import type { AttackHand } from './character-sheet-attack-types';
import {
  isTemporaryEffect,
  builtIn,
  type CharacterSheetInput,
  type InputSourcedModifier,
  type SheetWarning,
} from './character-sheet';
import {
  isProficient,
  matchesProficiency,
  isHandDependentWeapon,
  normalizeProficiencyName,
  proficiencyKey,
  type ResolvedProficiencies,
  type ManualProficiency,
} from './character-sheet-proficiencies';
import type { AttackRoutineState } from './character-sheet-attacks';
import { armorMaterialAdjustments } from './character-sheet-items';
import { ruleKeyMatches } from './character-sheet-rule-keys';

/**
 * Fighter Armor Training (CRB p. 56; PRD coreRulebook/classes/fighter.html:383),
 * as a code rule keyed by the feature's rule identity: 1 from 3rd level, +1 at
 * 7th, 11th and 15th, at most 4, while an active Armor Training entry is on the
 * sheet. An archetype that replaces the feature leaves no such entry. It counts
 * fighter Class Levels only.
 */
export function armorTrainingTier(
  input: CharacterSheetInput,
  fighterLevels: number,
) {
  const active = input.entries.some(
    (entry) =>
      entry.active &&
      'catalogEntryId' in entry &&
      ruleKeyMatches(
        input.catalogEntries.find(
          (candidate) => candidate._id === entry.catalogEntryId,
        )?.ruleIdentity,
        'fighter-armor-training',
      ),
  );
  return active ? Math.min(4, Math.floor((fighterLevels + 1) / 4)) : 0;
}

/** What Armor Training does to the armor's own numbers, said on the item. */
function armorTrainingNote(tier: number) {
  return `Armor Training ${tier}: maximum Dexterity bonus +${tier}, armor check penalty reduced by ${tier} (to a minimum of 0).`;
}

function equipmentProblem(enhancement: number, armorCheckPenalty: number) {
  if (!Number.isSafeInteger(enhancement) || enhancement < 0)
    return 'Enhancement must be a nonnegative whole number.';
  if (!Number.isFinite(armorCheckPenalty) || armorCheckPenalty < 0)
    return 'Armor check penalty must be a nonnegative number.';
  return null;
}

/** Armor or a shield worn without proficiency: its penalty on every attack roll. */
export function hasNonproficiencyAttackPenalty(item: {
  category: string | null;
  proficient: boolean;
  armorCheckPenalty: number;
}) {
  return (
    item.category !== null && !item.proficient && item.armorCheckPenalty !== 0
  );
}

/**
 * Every active armor or shield item, with its definition: the one place that
 * finds worn armor. Each reader keeps its own policy on top: whether a
 * temporary effect counts in the permanent projection, and whether a shield
 * counts.
 */
export function listActiveArmor(input: CharacterSheetInput) {
  return input.entries.flatMap((entry) => {
    if (entry.kind !== 'item' || !entry.active) return [];
    const catalog = input.catalogEntries.find(
      (candidate) => candidate._id === entry.catalogEntryId,
    );
    const detail = catalog?.detail;
    if (!catalog || detail?.kind !== 'item' || !detail.armor) return [];
    return [{ entry, catalog, detail, armor: detail.armor }];
  });
}

export function resolveEquipment({
  input,
  proficiencies,
  permanentOnly = false,
  armorTraining = 0,
}: {
  input: CharacterSheetInput;
  proficiencies: ResolvedProficiencies;
  permanentOnly?: boolean;
  /** The Armor Training tier (`armorTrainingTier`); it adjusts armor only, never a shield. */
  armorTraining?: number;
}) {
  const warnings: SheetWarning[] = [];
  const items = listActiveArmor(input).flatMap((found) => {
    const { entry, catalog, detail, armor } = found;
    if (permanentOnly && isTemporaryEffect(entry, detail)) return [];
    const enhancement = entry.state.enhancement ?? 0;
    const name = catalog.name ?? (armor.slot === 'shield' ? 'Shield' : 'Armor');
    const problem = equipmentProblem(enhancement, armor.armorCheckPenalty);
    if (problem) {
      warnings.push({
        kind: 'unresolved',
        check: 'armorCheckPenaltyUnresolved',
        subject: entry._id,
        target: { kind: 'entry', entryId: entry._id },
        fingerprint: JSON.stringify([
          name,
          String(entry.state.enhancement),
          String(armor.armorCheckPenalty),
          problem,
        ]),
        message: `${name} armor check penalty is unresolved. ${problem} This item's penalty is omitted from Strength and Dexterity skill totals.`,
      });
      return [];
    }
    // Enhancement over +5 is a construction check in character-sheet-items.
    const material = armorMaterialAdjustments(detail, entry.state);
    const maxDex = armor.maxDex ?? null;
    const training = armor.slot === 'armor' ? armorTraining : 0;
    const proficient = armor.category
      ? isProficient(proficiencies, {
          kind: 'armor',
          category: armor.category,
        })
      : false;
    return [
      {
        entryId: entry._id,
        name,
        slot: armor.slot,
        category: armor.category ?? null,
        armorBonus: armor.bonus ?? 0,
        enhancement,
        maxDexterityBonus:
          maxDex === null
            ? null
            : maxDex + material.maxDexterityIncrease + training,
        armorCheckPenalty: -Math.max(
          0,
          armor.armorCheckPenalty - material.penaltyReduction - training,
        ),
        spellFailure: Math.max(
          0,
          (armor.asf ?? 0) - material.spellFailureReduction,
        ),
        masterwork: material.masterwork,
        adjustmentExplanation:
          [material.note, training ? armorTrainingNote(training) : null]
            .filter((note) => note !== null)
            .join(' ') || null,
        proficient,
      },
    ];
  });
  const caps = items.flatMap((item) =>
    item.maxDexterityBonus === null ? [] : [item.maxDexterityBonus],
  );
  const modifiers: InputSourcedModifier[] = items.flatMap((item) => {
    const target = item.slot === 'armor' ? 'ac.armor' : 'ac.shield';
    return [
      {
        ...builtIn({
          target,
          id: `${item.entryId}:armor`,
          sheetEntryId: item.entryId,
          name: item.name,
          value: item.armorBonus,
        }),
        bonusType: item.slot,
        armorItem: { entryId: item.entryId, component: 'base' },
      },
      {
        ...builtIn({
          target,
          id: `${item.entryId}:enhancement`,
          sheetEntryId: item.entryId,
          name: `${item.name} enhancement`,
          value: item.enhancement,
        }),
        bonusType: 'enhancement',
        armorItem: { entryId: item.entryId, component: 'enhancement' },
      },
      ...(hasNonproficiencyAttackPenalty(item)
        ? (['attack.melee', 'attack.ranged'] as const).map((target) => ({
            ...builtIn({
              target,
              id: `${item.entryId}:nonproficiency`,
              sheetEntryId: item.entryId,
              name: `Not proficient: ${item.name}`,
              value: item.armorCheckPenalty,
            }),
          }))
        : []),
    ];
  });
  return {
    items,
    armorCheckPenalty: items.reduce(
      (sum, item) => sum + item.armorCheckPenalty,
      0,
    ),
    spellFailure: items.reduce((sum, item) => sum + item.spellFailure, 0),
    maxDexterityBonus: caps.length ? Math.min(...caps) : null,
    nonproficiencyAttackPenalty: items.reduce(
      (sum, item) =>
        sum +
        (hasNonproficiencyAttackPenalty(item) ? item.armorCheckPenalty : 0),
      0,
    ),
    modifiers,
    warnings,
  };
}

export function resolveWeaponProficiencies(
  input: CharacterSheetInput,
  proficiencies: ResolvedProficiencies,
  equipment: ReturnType<typeof resolveEquipment>,
  uses: readonly {
    entryId: string;
    routineEntryId?: string;
    hand?: AttackHand;
    hands: AttackRoutineState['hands'];
    attack?: 'melee' | 'ranged';
  }[] = [],
) {
  const warnings: SheetWarning[] = [];
  const routineWarningFingerprints = new Map<string, string>();
  const weapons = uses.flatMap((use) => {
    const entry = input.entries.find((row) => row._id === use.entryId);
    if (entry?.kind !== 'item' || !entry.active) return [];
    const catalog = input.catalogEntries.find(
      (row) => row._id === entry.catalogEntryId,
    );
    const weapon =
      catalog?.detail?.kind === 'item' ? catalog.detail.weapon : undefined;
    if (!weapon) return [];
    const name = catalog?.name ?? weapon.baseType;
    const subject = { kind: 'weapon' as const, ...weapon, hands: use.hands };
    const proficient =
      Boolean(weapon.naturalAttack) || isProficient(proficiencies, subject);
    const attackPenalty = proficient ? 0 : -4;
    const attackTarget =
      use.attack === 'ranged' ? 'attack.ranged' : 'attack.melee';
    const grants = [
      ...proficiencies.grants.map((grant) => grant.proficiency),
      ...proficiencies.added,
    ];
    const familiarity = grants.some(
      (grant) =>
        'baseType' in grant &&
        grant.asMartial &&
        normalizeProficiencyName(grant.baseType) ===
          normalizeProficiencyName(weapon.baseType),
    );
    const relevantNames = (
      values: readonly ManualProficiency[],
      { removals = false } = {},
    ) =>
      [
        ...new Set(
          values
            .filter((grant) => {
              if ('category' in grant)
                return grant.category === 'martial' && familiarity;
              if ('group' in grant && !removals) return false;
              return matchesProficiency(grant, subject, true);
            })
            .map(proficiencyKey),
        ),
      ].sort();

    if (
      !proficient &&
      use.hands === 'one' &&
      isHandDependentWeapon(weapon.baseType)
    ) {
      const warning: SheetWarning = {
        kind: 'rules',
        check: 'oneHandedExotic',
        subject: entry._id,
        target: { kind: 'entry', entryId: entry._id },
        fingerprint: JSON.stringify([
          normalizeProficiencyName(weapon.baseType),
          use.hands,
          relevantNames(grants),
          relevantNames(proficiencies.removed, { removals: true }),
        ]),
        message: `${name} needs its named proficiency to be used in one hand. Not proficient: −4 on attacks.`,
      };
      if (use.routineEntryId)
        routineWarningFingerprints.set(
          use.hand === 'off' ? `${use.routineEntryId}:off` : use.routineEntryId,
          warning.fingerprint,
        );
      else warnings.push(warning);
    }
    return [
      {
        entryId: entry._id,
        name,
        hands: use.hands,
        proficient,
        attackPenalty,
        armorNonproficiencyPenalty: equipment.nonproficiencyAttackPenalty,
        totalAttackPenalty:
          attackPenalty + equipment.nonproficiencyAttackPenalty,
        breakdown: {
          total: attackPenalty + equipment.nonproficiencyAttackPenalty,
          applied: [
            ...(attackPenalty
              ? [
                  builtIn({
                    target: attackTarget,
                    id: `${entry._id}:weapon-proficiency`,
                    sheetEntryId: entry._id,
                    name: `Not proficient: ${name}`,
                    value: attackPenalty,
                  }),
                ]
              : []),
            ...equipment.modifiers
              .filter(
                (modifier) =>
                  modifier.target === attackTarget &&
                  typeof modifier.value === 'number',
              )
              .map((modifier) => ({
                ...modifier,
                value: typeof modifier.value === 'number' ? modifier.value : 0,
              })),
          ],
          suppressed: [],
          conditional: [],
        },
      },
    ];
  });
  return { weapons, warnings, routineWarningFingerprints };
}
