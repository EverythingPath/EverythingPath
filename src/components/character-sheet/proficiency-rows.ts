import {
  proficiencyKey,
  type ManualProficiency,
} from '~/lib/character-sheet-proficiencies';
import type { useCharacterSheet } from './use-character-sheet';

type Resolved = NonNullable<
  ReturnType<typeof useCharacterSheet>['proficiencies']['value']
>;

export type ProficiencyRowView = {
  rowKey: string;
  /** The manual change's key: its row status and its Clear or Restore. */
  statusKey: string;
  proficiency: ManualProficiency;
  origin: 'grant' | 'added' | 'removed';
  /** The granting source's name, for a grant. */
  source: string | null;
  /** A grant the table removed by hand. */
  isRemoved: boolean;
};

/**
 * Grants with their sources, then the table's own additions and removals.
 * A grant whose exact Proficiency was removed by hand stays listed, marked.
 */
export function listProficiencyRows(value: Resolved): ProficiencyRowView[] {
  const removedKeys = new Set(value.removed.map(proficiencyKey));
  const grants = value.grants.map((grant) => {
    const statusKey = proficiencyKey(grant.proficiency);
    return {
      rowKey: `grant:${grant.entryId}:${statusKey}`,
      statusKey,
      proficiency: grant.proficiency,
      origin: 'grant' as const,
      source: grant.name,
      isRemoved: removedKeys.has(statusKey),
    };
  });
  const manual = (
    proficiencies: ManualProficiency[],
    origin: 'added' | 'removed',
  ) =>
    proficiencies.map((proficiency) => {
      const statusKey = proficiencyKey(proficiency);
      return {
        rowKey: `${origin}:${statusKey}`,
        statusKey,
        proficiency,
        origin,
        source: null,
        isRemoved: false,
      };
    });
  return [
    ...grants,
    ...manual(value.added, 'added'),
    ...manual(value.removed, 'removed'),
  ];
}
