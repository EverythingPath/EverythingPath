import type { At, ScheduleClassName } from './schedule-model';
import { reviewedSchedule, rowKeyOf } from './schedules';

/**
 * S3: the reviewed bonus feat slots of a class schedule's rows. Each rule
 * gives one feat slot, restricted to the feat types the printed rule names,
 * to the feature's acquisition and to each of its increments, so a part
 * replacement of a row removes that row's slot. The types are Foundry's
 * feat tags (`Combat`, `Item Creation`, `Metamagic`, `Teamwork`); the sheet
 * warns, never refuses, on a feat of another type (#313).
 *
 * Outstanding, with no default (S3 design §2d):
 * - Wizard 5/10/15/20, "a metamagic feat, an item creation feat, or Spell
 *   Mastery" (wizard.html:397): the sheet ANDs feat types with named feats,
 *   so the union needs calculator code (#716).
 * - Monk and Unchained Monk: a named list with prerequisites ignored
 *   (monk.html:402), whose feats would become dependencies; research first
 *   (#716, feats #330-#366).
 * - Ranger combat style, Sorcerer and Bloodrager bloodline feats: the pool
 *   depends on a choice (#716/#739).
 */
export type ScheduleSlotRule = {
  className: ScheduleClassName;
  /** The schedule's feature (`id`) whose rows each grant a slot. */
  feature: string;
  /** Foundry feat tags; a feat of any of them fits the slot. */
  featTypes: readonly string[];
  /** The PRD line printing the rule, under the capture's `pages/`. */
  printed: At;
};

export const scheduleSlotRules: readonly ScheduleSlotRule[] = [
  {
    // "These bonus feats must be selected from those listed as combat feats."
    className: 'Fighter',
    feature: 'bonus-feats',
    featTypes: ['Combat'],
    printed: 'coreRulebook/classes/fighter.html:380',
  },
  {
    // "These bonus feats must be selected from those listed as combat feats."
    className: 'Cavalier',
    feature: 'bonus-feat',
    featTypes: ['Combat'],
    printed: 'advancedPlayersGuide/baseClasses/cavalier.html:392',
  },
  {
    // "...from those listed as combat, item creation, or metamagic feats."
    className: 'Magus',
    feature: 'bonus-feats',
    featTypes: ['Combat', 'Item Creation', 'Metamagic'],
    printed: 'ultimateMagic/spellcasters/magus.html:424',
  },
  {
    // "These bonus feats must be selected from those listed as teamwork feats."
    className: 'Inquisitor',
    feature: 'teamwork-feat',
    featTypes: ['Teamwork'],
    printed: 'advancedPlayersGuide/baseClasses/inquisitor.html:432',
  },
];

export type ScheduleSlot = {
  kind: 'feat';
  count: number;
  featTypes: string[];
};

/**
 * Each slot-bearing row's catalog key (the acquisition's Foundry key, else
 * the increment's), with its slot. A rule naming no reviewed class or
 * feature, or a row two rules claim, throws.
 */
export function reviewedScheduleSlots(
  rules: readonly ScheduleSlotRule[] = scheduleSlotRules,
) {
  const slots = new Map<string, ScheduleSlot>();
  for (const rule of rules) {
    const schedule = reviewedSchedule(rule.className);
    if (!schedule)
      throw new Error(`Slot rule names no reviewed class: ${rule.className}.`);
    const feature = schedule.features.find(({ id }) => id === rule.feature);
    if (!feature)
      throw new Error(
        `Slot rule names no ${rule.className} feature: ${rule.feature}.`,
      );
    for (const classLevel of feature.levels) {
      const key = rowKeyOf(schedule, feature, classLevel);
      if (slots.has(key)) throw new Error(`Two slot rules name ${key}.`);
      slots.set(key, {
        kind: 'feat',
        count: 1,
        featTypes: [...rule.featTypes],
      });
    }
  }
  return slots;
}
