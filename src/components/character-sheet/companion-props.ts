import type { Id } from '@convex/_generated/dataModel';
import type { useCharacterCompanions } from './use-character-companions';

export type CompanionsController = ReturnType<typeof useCharacterCompanions>;
/** The associated Character's divided budgets (#410). */
export type CompanionAllocationsController =
  CompanionsController['allocations'];
/** A cohort's Cohort Equivalence and its leader's Leadership modifiers (#417). */
export type CohortController = CompanionsController['cohort'];
export type CompanionFieldProps = {
  controller: CompanionsController;
  isDisabled: boolean;
};
/** Remembers the control that opened an editor, to refocus when it closes. */
export type CompanionOpenerProps = {
  rememberOpener: (element: HTMLElement) => void;
};
/** What a relationship row needs to subscribe to its linked values. */
export type CompanionLinkedValueProps = {
  /** The viewed sheet, whichever side of the relationship it is on. */
  characterId: Id<'character'>;
  maintenanceMessage?: string;
};
