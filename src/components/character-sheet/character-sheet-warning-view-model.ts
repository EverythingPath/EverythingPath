import type { SheetWarning } from '~/lib/character-sheet';
import type {
  CharacterSheetSnapshot,
  SheetWarningView,
} from './use-character-sheet';

export function buildSheetWarningViews(
  warnings: readonly SheetWarning[],
  acceptedWarnings: CharacterSheetSnapshot['acceptedWarnings'],
): SheetWarningView[] {
  return warnings.map((warning) => ({
    ...warning,
    accepted:
      warning.kind === 'rules' &&
      acceptedWarnings.some(
        (accepted) =>
          accepted.check === warning.check &&
          accepted.subject === warning.subject &&
          accepted.fingerprint === warning.fingerprint,
      ),
  }));
}
