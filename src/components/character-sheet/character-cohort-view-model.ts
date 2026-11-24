import {
  leadershipCohortModifiers,
  leadershipReputationKeySchema,
  leadershipReputationModifiers,
  monsterCohortCitations,
  monsterCohortKeySchema,
  monsterCohorts,
  type CohortCitation,
} from '~/lib/catalog/representative-cohorts';
import {
  calculateLeadership,
  noLeadershipModifiers,
  type CohortEquivalenceState,
  type CohortResolution,
} from '~/lib/character-sheet-cohort';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import type { CompanionRelationshipView } from './character-companions-view-model';
import { buildSheetWarningViews } from './character-sheet-warning-view-model';
import { formatModifier } from './sheet-parts';

/** Published monster cohorts to choose from, in the book's order. */
export const cohortCreatureChoices = monsterCohortKeySchema.options.map(
  (value) => {
    const creature = monsterCohorts[value];
    return {
      value,
      label: creature.name,
      level: creature.level,
      book: monsterCohortCitations[creature.book].book,
    };
  },
);
/** CRB p. 129's reputation modifiers, chosen from the cohort's view. */
export const leadershipReputationChoices =
  leadershipReputationKeySchema.options.map((value) => ({
    value,
    label: leadershipReputationModifiers[value].label,
    modifier: formatModifier(leadershipReputationModifiers[value].value),
  }));
/** CRB p. 129's modifiers for attracting a cohort. */
export const leadershipCohortModifierChoices = {
  hasCompanion: {
    label: leadershipCohortModifiers.hasCompanion.label,
    modifier: formatModifier(leadershipCohortModifiers.hasCompanion.value),
  },
  differentAlignment: {
    label: leadershipCohortModifiers.differentAlignment.label,
    modifier: formatModifier(
      leadershipCohortModifiers.differentAlignment.value,
    ),
  },
  cohortDeaths: {
    label: leadershipCohortModifiers.cohortDeaths.label,
    modifier: `${formatModifier(leadershipCohortModifiers.cohortDeaths.value)} each`,
  },
};

const statusLabels: Record<CohortResolution['status'], string> = {
  active: 'Supported by its leader',
  dormant: 'No supporting source counts now',
  unlinked: 'Not linked to a leader',
};
const basisLabels: Record<CohortResolution['equivalence']['basis'], string> = {
  classLevels: 'Class Levels',
  published: 'Published monster cohort',
  entered: 'Entered equivalence',
};
type LeaderInput = NonNullable<
  CohortResolution['leadership']
>['characterLevel'];
const resolutionLabels: Record<LeaderInput['resolution'], string> = {
  calculated: 'Calculated',
  interpretation: 'Chosen interpretation',
  precedence: 'Published precedence',
  fallback: 'Using saved fallback',
  unresolved: 'Unresolved',
};

function ordinal(level: number) {
  const tens = level % 100;
  const suffix =
    tens >= 11 && tens <= 13
      ? 'th'
      : ({ 1: 'st', 2: 'nd', 3: 'rd' }[level % 10] ?? 'th');
  return `${level}${suffix}`;
}
export function formatCohortLevel(level: number | null) {
  if (level === null) return 'Unresolved';
  return level === 0 ? 'No cohort' : `${ordinal(level)} level`;
}
function citationLabel(citation: CohortCitation) {
  return citation.pages
    ? `${citation.book}, p. ${citation.pages}`
    : citation.book;
}
function inputView(
  label: string,
  input: LeaderInput,
  format: (value: number) => string,
) {
  return {
    label,
    value: input.value,
    display: input.value === null ? 'Unresolved' : format(input.value),
    resolution: input.resolution,
    resolutionLabel: resolutionLabels[input.resolution],
    fallbackState: input.fallbackState,
  };
}

function describeEquivalence(equivalence: CohortResolution['equivalence']) {
  const levels = `${equivalence.classLevels} Class ${equivalence.classLevels === 1 ? 'Level' : 'Levels'}`;
  if (equivalence.basis === 'classLevels')
    return equivalence.missing
      ? 'This cohort has Racial Hit Dice. Choose a published monster cohort or enter its equivalence; its Hit Dice are never used.'
      : `An ordinary cohort’s equivalence is its ${levels}.`;
  if (equivalence.creatureLevel === null)
    return `Enter the equivalence for ${equivalence.creature}. Its Hit Dice and Challenge Rating are never used.`;
  const origin =
    equivalence.basis === 'published' ? 'published cohort level' : 'entered';
  return `${equivalence.creature} (${origin} ${equivalence.creatureLevel}) + ${levels} = ${equivalence.value}.`;
}

/** What a Leadership Score's table level would attract now. */
function wouldAttract(scoreLevel: number) {
  return scoreLevel === 0
    ? 'would attract no cohort now'
    : `would attract a cohort of up to ${formatCohortLevel(scoreLevel).toLowerCase()} now`;
}
const leaderInputsNeeded =
  'The leader’s character level and Charisma modifier are needed. Save fallbacks while they are unavailable.';
function describeLeadership(
  leadership: NonNullable<CohortResolution['leadership']>,
) {
  if (leadership.conflict)
    return 'The supporting sources record different Leadership modifiers, so no score is chosen.';
  const level = leadership.characterLevel.value;
  const charisma = leadership.charismaModifier.value;
  if (level === null || charisma === null) return leaderInputsNeeded;
  if (leadership.areModifiersUndisclosed)
    return 'The leader’s Leadership modifiers are shown only with access to the leader, so its Leadership Score and the level it would attract stay unresolved.';
  if (leadership.scoreLevel === null) return leaderInputsNeeded;
  const parts = [
    `level ${level}`,
    `Charisma ${formatModifier(charisma)}`,
    ...(leadership.modifierTotal
      ? [`modifiers ${formatModifier(leadership.modifierTotal)}`]
      : []),
  ];
  // CRB p. 129 consults the table only when a cohort is attracted.
  return `Leadership Score ${leadership.score} (${parts.join(', ')}) ${wouldAttract(leadership.scoreLevel)}. The table applies only when a cohort is attracted; afterwards a cohort stays two or more levels below its leader.`;
}
/** A permanent-projection label, set only when Temporary Effects differ. */
function permanentLabel(current: number | null, permanent: number | null) {
  return permanent !== current ? formatCohortLevel(permanent) : null;
}

/**
 * The cohort's own view: its Cohort Equivalence with provenance and, while
 * a leader supports it, the level that leader allows. Every value comes
 * from the calculation; nothing is recalculated here.
 */
export function buildCohortView(
  snapshot: Pick<
    CharacterSheetSnapshot,
    'calculated' | 'permanentCalculated' | 'entries' | 'acceptedWarnings'
  >,
) {
  const cohort = snapshot.calculated.cohort;
  if (!cohort) return null;
  const base = snapshot.entries.find((entry) => entry.kind === 'base');
  const recorded: CohortEquivalenceState | null =
    base?.kind === 'base' ? (base.state.cohortEquivalence ?? null) : null;
  const { equivalence, leadership } = cohort;
  const permanent = snapshot.permanentCalculated.cohort?.leadership ?? null;
  return {
    status: cohort.status,
    statusLabel: statusLabels[cohort.status],
    recorded,
    equivalence: {
      ...equivalence,
      basisLabel: basisLabels[equivalence.basis],
      display:
        equivalence.value === null ? 'Unresolved' : String(equivalence.value),
      summary: describeEquivalence(equivalence),
      citationLabel: equivalence.citation
        ? citationLabel(equivalence.citation)
        : null,
    },
    leadership: leadership
      ? {
          inputs: [
            inputView(
              'Leader’s character level',
              leadership.characterLevel,
              String,
            ),
            inputView(
              'Leader’s Charisma modifier',
              leadership.charismaModifier,
              formatModifier,
            ),
          ],
          modifiers: leadership.modifiers.map((row) => ({
            ...row,
            display: formatModifier(row.value),
          })),
          /** Hidden with the leader: "Unavailable", never "None". */
          areModifiersUndisclosed: leadership.areModifiersUndisclosed,
          score: leadership.score,
          /** Information only: the table applies when attracting a cohort. */
          scoreLevelLabel: formatCohortLevel(leadership.scoreLevel),
          permanentScoreLevelLabel: permanentLabel(
            leadership.scoreLevel,
            permanent?.scoreLevel ?? null,
          ),
          /** Two or more levels below the leader, the limit that persists. */
          allowedLabel: formatCohortLevel(leadership.leaderLevelLimit),
          permanentAllowedLabel: permanentLabel(
            leadership.leaderLevelLimit,
            permanent?.leaderLevelLimit ?? null,
          ),
          conflict: leadership.conflict,
          summary: describeLeadership(leadership),
        }
      : null,
    warnings: buildSheetWarningViews(
      snapshot.calculated.warnings.filter(
        (warning) => warning.subject === 'cohort',
      ),
      snapshot.acceptedWarnings,
    ),
    sources: cohort.sources.map(citationLabel),
  };
}
/**
 * The leader's view of one cohort relationship's Leadership modifiers,
 * with the score they give from the leader's own sheet. Only sources that
 * support a cohort record modifiers.
 */
export function buildLeadershipSourcesView({
  row,
  leader,
}: {
  row: CompanionRelationshipView;
  leader: Pick<CharacterSheetSnapshot, 'calculated'> | null | undefined;
}) {
  if (row.kind !== 'cohort' || row.role !== 'companion') return [];
  return row.sources.flatMap((source) => {
    if (source.ruleKind !== 'cohort') return [];
    const modifiers = source.leadershipModifiers ?? noLeadershipModifiers;
    const preview = calculateLeadership({
      characterLevel: leader?.calculated.level ?? null,
      charismaModifier: leader?.calculated.abilities.charisma.modifier ?? null,
      modifiers,
    });
    return [
      {
        key: `${row.relationshipId}/${source.key}`,
        relationshipId: row.relationshipId,
        sourceKey: source.key,
        sourceLabel: source.label,
        cohortName: row.name,
        recorded: source.leadershipModifiers ?? null,
        modifiers,
        rows: preview.modifiers.map((item) => ({
          ...item,
          display: formatModifier(item.value),
        })),
        score: preview.score,
        /** The level a cohort could be attracted at now. */
        maximumLabel: formatCohortLevel(preview.maximumLevel),
        summary:
          preview.maximumLevel === null
            ? 'The Leadership Score needs this Character’s level and Charisma modifier.'
            : `Leadership Score ${preview.score} ${wouldAttract(preview.maximumLevel)}.`,
      },
    ];
  });
}
export type LeadershipSourceView = ReturnType<
  typeof buildLeadershipSourcesView
>[number];
