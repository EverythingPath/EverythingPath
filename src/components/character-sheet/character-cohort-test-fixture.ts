import type { Id } from '@convex/_generated/dataModel';
import type {
  CohortCalculationInput,
  CohortEquivalenceState,
} from '~/lib/character-sheet-cohort';
import { resolveCompanionLinkedInput } from '~/lib/character-sheet-linked-inputs';
import type { CompanionRelationship } from './character-companions-view-model';
import {
  buildSheet,
  calculateFixtureSheet,
} from './character-sheet-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';

type Leader = {
  level: number | null;
  charisma: number | null;
  /** Saved fallbacks the cohort's relationship applies while a value is unavailable. */
  fallbacks?: { level?: number; charisma?: number };
};

/**
 * A cohort's sheet as the calculation supplies it (#417): its Class Levels,
 * any recorded equivalence, and the leader's values its relationship
 * borrows. `leader: null` leaves the Character unlinked; a source that is
 * not counting makes the link dormant.
 */
export function buildCohortSheet({
  levels = 5,
  equivalence,
  leader = { level: 9, charisma: 2 },
  permanentCharisma = leader?.charisma ?? null,
  sources = [{ sourceKey: 'leadership', counting: true }],
  areModifiersUndisclosed = false,
}: {
  levels?: number;
  equivalence?: CohortEquivalenceState;
  leader?: Leader | null;
  permanentCharisma?: number | null;
  sources?: CohortCalculationInput['sources'];
  /** The reader has no access to the leader, so its modifiers stay hidden. */
  areModifiersUndisclosed?: boolean;
} = {}): CharacterSheetSnapshot {
  const snapshot = buildSheet({
    levels: Array.from({ length: levels }, (_, index) => ({
      id: `level-${index + 1}`,
      hp: 6,
    })),
  });
  const input = {
    ...snapshot,
    characterKind: snapshot.character.kind,
    ...(equivalence ? { cohortEquivalence: equivalence } : {}),
  };
  const candidate = (value: number | null) =>
    value === null
      ? {
          sourceKey: 'leadership',
          kind: 'unavailable' as const,
          reason: 'inaccessible' as const,
        }
      : { sourceKey: 'leadership', kind: 'available' as const, value };
  const options = (charisma: number | null) =>
    leader
      ? {
          cohort: {
            sources,
            ...(areModifiersUndisclosed
              ? { areModifiersUndisclosed: true as const }
              : {}),
            linkedInputs: [
              resolveCompanionLinkedInput({
                input: { kind: 'characterLevel' },
                candidates: [candidate(leader.level)],
                fallback: leader.fallbacks?.level,
              }),
              resolveCompanionLinkedInput({
                input: { kind: 'abilityModifier', ability: 'charisma' },
                candidates: [candidate(charisma)],
                fallback: leader.fallbacks?.charisma,
              }),
            ],
          },
        }
      : {};
  return {
    ...snapshot,
    entries: snapshot.entries.map((entry) =>
      entry.kind === 'base' && equivalence
        ? {
            ...entry,
            state: { ...entry.state, cohortEquivalence: equivalence },
          }
        : entry,
    ),
    calculated: calculateFixtureSheet(input, options(leader?.charisma ?? null)),
    permanentCalculated: calculateFixtureSheet(input, {
      ...options(permanentCharisma),
      permanentOnly: true,
    }),
  };
}

/** The Leadership feat as a cohort relationship's supporting source. */
export const leadershipSource = {
  key: 'leadership',
  label: 'Leadership',
  enabled: true,
  available: true,
  ruleKind: 'cohort',
} satisfies CompanionRelationship['sources'][number];

/** A leader's relationship with its cohort Bryn, supported by Leadership. */
export const brynRelationship = {
  relationshipId: 'rel-bryn' as Id<'companionRelationship'>,
  role: 'companion',
  kind: 'cohort',
  status: 'active',
  interruption: null,
  endpoint: { characterId: 'bryn' as Id<'character'>, name: 'Bryn' },
  linkedInputs: [],
  lastOperationId: 'seed',
  sources: [leadershipSource],
} satisfies CompanionRelationship;
