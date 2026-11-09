import { TriangleAlert } from 'lucide-react';
import { PrerequisiteGroups } from './prerequisite-groups';
import { PrerequisiteProse } from './prerequisite-status';
import type { SelectionPreview } from './selection-view-types';

/**
 * What a candidate would mean in this slot, before it is saved: its
 * prerequisites now and at the recorded level, each checkable clause met or
 * not, the catalog's prose, and the other advisories it would raise. None of
 * it blocks adding the candidate, and nothing here can be accepted yet.
 */
export function SelectionPreviewDetails({
  preview,
}: {
  preview: SelectionPreview;
}) {
  const advisories = preview.otherWarnings.filter(
    (warning) => warning.kind === 'rules',
  );
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <PrerequisiteGroups groups={preview} />
      <PrerequisiteProse text={preview.prerequisiteText} />
      {advisories.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-xs text-amber-300">
          {advisories.map((warning) => (
            <li
              key={`${warning.check}:${warning.subject}`}
              className="flex items-start gap-1.5 [overflow-wrap:anywhere]"
            >
              <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
              <span className="min-w-0">{warning.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
