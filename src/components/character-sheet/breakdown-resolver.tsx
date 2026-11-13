'use client';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { SourcedSituationalNote } from '~/lib/character-sheet';
import type { RequestedSituation } from '~/lib/character-sheet-situations';
import type { ResolvedSpellcasting } from '~/lib/character-sheet-spellcasting';
import type { SheetStatisticTarget } from '~/lib/character-sheet-unresolved-targets';
import { UnresolvedStatisticsProvider } from './unresolved-statistics';
import type { useCharacterSheet } from './use-character-sheet';
import { findEntrySituationNotes } from './situations-view-model';

type Controller = ReturnType<typeof useCharacterSheet>;
type Adjustments = NonNullable<Controller['sheet']>['adjustments'];
type PreviewSituation = Controller['previewSituation'];

/** The Situations the player picked for the sheet, in choice order. */
export type SelectedSituations = {
  selections: readonly RequestedSituation[];
  /** Opaque; only used to tell a picked choice from the others. */
  selectedKeys: readonly string[];
  /** The picked choices in words: "vs. spells + vs. fear". */
  text: string;
};

const noSelectedSituations: SelectedSituations = {
  selections: [],
  selectedKeys: [],
  text: '',
};

/**
 * What a breakdown asks the sheet: the numbers resolved in a Situation, and
 * the name behind a prerequisite so "while … is active" names the entry.
 */
export type BreakdownResolver = {
  previewSituation: PreviewSituation;
  findPrerequisiteName: (catalogEntryId: string) => string | null;
  findCastingClassName: (classTag: string) => string | null;
  selected: SelectedSituations;
  entryNotes: readonly SourcedSituationalNote[];
};

const BreakdownResolverContext = createContext<BreakdownResolver | null>(null);

// Every number on the sheet asks about the same few Situations; each answer
// is worked out once per sheet calculation and shared.
function sharePreviews(previewSituation: PreviewSituation): PreviewSituation {
  const previews = new Map<string, ReturnType<PreviewSituation>>();
  return (situations) => {
    const key = JSON.stringify(situations);
    if (!previews.has(key)) previews.set(key, previewSituation(situations));
    return previews.get(key) ?? null;
  };
}

/** Provided once by the sheet; every number's breakdown resolves itself. */
export function BreakdownResolverProvider({
  previewSituation,
  adjustments,
  spellcastings,
  unresolved = { targets: [], reason: '' },
  findPrerequisiteName,
  selected = noSelectedSituations,
  entryNotes = [],
  children,
}: {
  previewSituation: PreviewSituation;
  adjustments: Adjustments;
  spellcastings: readonly ResolvedSpellcasting[];
  /** The statistics without a finished value, and why. */
  unresolved?: { targets: readonly SheetStatisticTarget[]; reason: string };
  findPrerequisiteName?: BreakdownResolver['findPrerequisiteName'];
  /** The sheet's Situation picker; none picked without one. */
  selected?: SelectedSituations;
  /** Situational Notes that belong to an entry rather than a number. */
  entryNotes?: readonly SourcedSituationalNote[];
  children: ReactNode;
}) {
  const sharedPreview = useMemo(
    () => sharePreviews(previewSituation),
    [previewSituation],
  );
  const resolver: BreakdownResolver = {
    previewSituation: sharedPreview,
    selected,
    entryNotes,
    findCastingClassName: (classTag) =>
      spellcastings.find((casting) => casting.classTag === classTag)?.name ??
      null,
    findPrerequisiteName: (catalogEntryId) =>
      findPrerequisiteName?.(catalogEntryId) ??
      adjustments.find((row) => row.catalogEntryId === catalogEntryId)?.name ??
      null,
  };
  return (
    <BreakdownResolverContext value={resolver}>
      <UnresolvedStatisticsProvider {...unresolved}>
        {children}
      </UnresolvedStatisticsProvider>
    </BreakdownResolverContext>
  );
}

export function useBreakdownResolver() {
  const resolver = useContext(BreakdownResolverContext);
  if (!resolver)
    throw new Error(
      'StatBreakdown needs a BreakdownResolverProvider above it.',
    );
  return resolver;
}

/**
 * The untargeted Situational Notes of one Sheet Entry, with the names its
 * conditions refer to; none where the sheet provides no calculation.
 */
export function useEntrySituationNotes(entryId: string) {
  const resolver = useContext(BreakdownResolverContext);
  return {
    notes: resolver
      ? findEntrySituationNotes(resolver.entryNotes, entryId)
      : [],
    findPrerequisiteName: resolver?.findPrerequisiteName ?? (() => null),
    findCastingClassName: resolver?.findCastingClassName ?? (() => null),
  };
}
