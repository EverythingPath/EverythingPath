import { z } from 'zod';
import { canonicalRosterSchema } from './canonical-roster';
import {
  contextBonusSchema,
  contextSettlementSchema,
} from './canonical-campaign-context';
import { economyStateSchema } from './rules-economy-state';
import { characterActionStateSchema } from './rules-character-state';
import { eventBenefitsSchema } from './rules-event-benefits';
import { identitySchema } from './weekly-draft-facts';
import { abilityKeys } from './character-sheet-abilities';
import {
  weeklyDraftDataSchema,
  weekStartFactsSchema,
} from './weekly-draft-contract';

// Structural bounds only. Rules limits and missing rule context belong to readiness.
export const militiaSnapshotSchema = z
  .strictObject({
    rank: z.number().int(),
    training: z.number().int(),
    treasuryCopper: z.number().int(),
    notoriety: z.number().int(),
    focus: z.enum(['Loyalty', 'Security', 'Secrecy']).nullable(),
    roster: canonicalRosterSchema,
    characters: z.array(
      z.strictObject({
        characterId: identitySchema,
        level: z.number().int(),
        // Frozen snapshots without racial facts retain zero racial Hit Dice.
        racialHitDice: z.number().int().nonnegative().optional(),
        // Absent on old snapshots; null preserves unavailable advancement.
        actualHitDice: z.number().int().nonnegative().nullable().optional(),
        strength: z.number().int(),
        dexterity: z.number().int(),
        constitution: z.number().int(),
        intelligence: z.number().int(),
        wisdom: z.number().int(),
        charisma: z.number().int(),
        // A listed score is a partial total: the week's rules that read it
        // require it first. Writers omit the field when every score is
        // known; an empty list, like the Convex validators, reads the same.
        unresolvedAbilities: z.array(z.enum(abilityKeys)).optional(),
        isActive: z.boolean(),
      }),
    ),
    settlements: z.array(contextSettlementSchema),
    bonuses: z.array(contextBonusSchema),
    economy: economyStateSchema.optional(),
    characterActions: characterActionStateSchema.optional(),
    eventBenefits: eventBenefitsSchema.optional(),
  })
  .superRefine((snapshot, ctx) => {
    for (const [label, ids] of [
      ['characters', snapshot.characters.map((x) => x.characterId)],
      ['settlements', snapshot.settlements.map((x) => x.settlementId)],
      ['bonuses', snapshot.bonuses.map((x) => x.bonusId)],
    ] as const) {
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({
          code: 'custom',
          path: [label],
          message: 'Duplicate identity',
        });
    }
    for (const person of snapshot.roster.people)
      if (
        !snapshot.characters.some((x) => x.characterId === person.characterId)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['roster', 'people'],
          message: 'Unknown character',
        });
    const characters = new Set(snapshot.characters.map((x) => x.characterId));
    const settlements = new Set(
      snapshot.settlements.map((x) => x.settlementId),
    );
    const items = new Set(snapshot.economy?.items.map((x) => x.itemId) ?? []);
    const teams = new Set(snapshot.roster.teams.map((x) => x.teamId));
    function reference(
      value: string | undefined | null,
      ids: Set<string>,
      path: (string | number)[],
    ) {
      if (value != null && !ids.has(value))
        ctx.addIssue({
          code: 'custom',
          path,
          message: 'Unknown referenced entity',
        });
    }
    snapshot.economy?.items.forEach((item, i) =>
      reference(item.ownerCharacterId, characters, [
        'economy',
        'items',
        i,
        'ownerCharacterId',
      ]),
    );
    snapshot.economy?.caches.forEach((cache, i) =>
      cache.itemIds.forEach((item, j) =>
        reference(item, items, ['economy', 'caches', i, 'itemIds', j]),
      ),
    );
    snapshot.economy?.orders.forEach((order, i) => {
      reference(order.itemId, items, ['economy', 'orders', i, 'itemId']);
      reference(order.settlementId, settlements, [
        'economy',
        'orders',
        i,
        'settlementId',
      ]);
    });
    snapshot.economy?.markets.forEach((market, i) =>
      reference(market.settlementId, settlements, [
        'economy',
        'markets',
        i,
        'settlementId',
      ]),
    );
    snapshot.characterActions?.people.forEach((person, i) => {
      reference(person.characterId, characters, [
        'characterActions',
        'people',
        i,
        'characterId',
      ]);
      if (person.location.kind === 'refuge')
        reference(person.location.settlementId, settlements, [
          'characterActions',
          'people',
          i,
          'location',
        ]);
    });
    snapshot.bonuses.forEach((bonus, i) =>
      reference(bonus.teamId, teams, ['bonuses', i, 'teamId']),
    );
    snapshot.eventBenefits?.skills.forEach((benefit, i) => {
      benefit.characterIds.forEach((character, j) =>
        reference(character, characters, [
          'eventBenefits',
          'skills',
          i,
          'characterIds',
          j,
        ]),
      );
      reference(benefit.settlementId, settlements, [
        'eventBenefits',
        'skills',
        i,
        'settlementId',
      ]);
    });
    snapshot.eventBenefits?.markets.forEach((benefit, i) =>
      benefit.settlementIds.forEach((settlement, j) =>
        reference(settlement, settlements, [
          'eventBenefits',
          'markets',
          i,
          'settlementIds',
          j,
        ]),
      ),
    );
  });
export const reviewedWeeklySourceSchema = z.strictObject({
  revision: weeklyDraftDataSchema,
  militiaSnapshot: militiaSnapshotSchema,
});
export type ReviewedWeeklySource = z.infer<typeof reviewedWeeklySourceSchema>;
export const canonicalWeekStateSchema = z.strictObject({
  week: z.number().int().nonnegative(),
  militiaSnapshot: militiaSnapshotSchema,
  context: weekStartFactsSchema,
});
export type CanonicalWeekState = z.infer<typeof canonicalWeekStateSchema>;

// Exact canonical serialization, not a collision-prone hash. Object key order is
// irrelevant, while ordered slots, dice, adjustments and event occurrences matter.
export function weeklySourceKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(weeklySourceKey).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => `${JSON.stringify(key)}:${weeklySourceKey(v)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
