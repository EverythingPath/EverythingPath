import { SelectionGuidance } from './selection-guidance';
import type { SelectionRowView } from './selection-view-types';

/** Choice readiness and manual rules stay visible even while a trait is dormant. */
export function SelectionChoiceGuidance({
  row,
}: {
  row: Pick<SelectionRowView, 'choiceIncomplete' | 'choiceGuidance'>;
}) {
  return (
    <>
      {row.choiceIncomplete ? (
        <p className="text-xs text-sky-300">Incomplete: choose a spell.</p>
      ) : null}
      <SelectionGuidance text={row.choiceGuidance} />
    </>
  );
}
