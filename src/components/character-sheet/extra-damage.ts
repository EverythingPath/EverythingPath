import {
  identifySituation,
  serializeSituationIdentity,
  situationMatches,
  type RequestedSituation,
} from '~/lib/character-sheet-situations';
import type { Situation } from '~/lib/character-sheet';
import type { useCharacterSheet } from './use-character-sheet';

type Line = ReturnType<
  typeof useCharacterSheet
>['attacks']['rows'][number]['singleView'][number];
export type ExtraDamageView = Line['extraDamage'][number];

export type ShownExtraDamage = {
  part: ExtraDamageView;
  /** Shown only because its Situation is picked in the preview. */
  isPreviewed: boolean;
};

/** A key for one die part by its place on the line, so two flamings read apart. */
export function extraDamageKey(
  part: ExtraDamageView,
  parts: readonly ExtraDamageView[],
) {
  return `${parts.indexOf(part)}:${part.source}`;
}

/** "1d6 fire": the dice without their leading sign, for "plus 1d6 fire". */
export function describeExtraDice(part: ExtraDamageView) {
  return part.text.replace(/^\+/, '');
}

/**
 * Where each Item Ability die reads on a line: always-on dice on its face,
 * burst dice as a critical-hit note, and Situational dice nowhere until
 * their Situation is picked in the preview, when they join the face marked
 * as previewed. Unpicked Situational dice earn the damage its marker and
 * read in its breakdown's "Only when…" group.
 */
export function sortExtraDamage(
  parts: readonly ExtraDamageView[],
  selections: readonly RequestedSituation[],
) {
  const hit: ShownExtraDamage[] = [];
  const critical: ShownExtraDamage[] = [];
  const situational: ExtraDamageView[] = [];
  for (const part of parts) {
    const isPreviewed =
      part.situation !== null &&
      !part.applies &&
      situationMatches(part.situation, part.sheetEntryId, selections);
    if (!part.applies && !isPreviewed) {
      situational.push(part);
      continue;
    }
    (part.critical ? critical : hit).push({ part, isPreviewed });
  }
  return { hit, critical, situational };
}

/** The breakdown's key for a Situational die's Situation on its item. */
export function extraDamageSituationKey(
  situation: Situation,
  sheetEntryId: string,
) {
  return serializeSituationIdentity(identifySituation(situation, sheetEntryId));
}
