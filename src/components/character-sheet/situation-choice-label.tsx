'use client';
import { describeSituationChoice } from './situation-copy';
import type { SituationGroup } from './stat-breakdown-groups';

/**
 * A Situation choice as text: an entry's own circumstance carries its
 * entry's name ("First: in darkness") so equally worded ones read apart.
 */
export function SituationChoiceLabel({
  group,
  findPrerequisiteName,
}: {
  group: Pick<SituationGroup, 'text' | 'selection' | 'entryName'>;
  findPrerequisiteName: (catalogEntryId: string) => string | null;
}) {
  const isLocal =
    typeof group.selection !== 'string' && 'local' in group.selection;
  if (!isLocal || !group.entryName)
    return <span>{describeSituationChoice(group, findPrerequisiteName)}</span>;
  return (
    <>
      <span className="opacity-80">{group.entryName}:</span>{' '}
      <span>{group.text}</span>
    </>
  );
}
