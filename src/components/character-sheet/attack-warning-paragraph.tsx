import type { SheetWarning } from '~/lib/character-sheet';

export function AttackWarningParagraph({
  warning,
}: {
  warning: Pick<SheetWarning, 'message'>;
}) {
  return (
    <p className="text-xs [overflow-wrap:anywhere] text-amber-300">
      {warning.message}
    </p>
  );
}
