'use client';

import { api } from '@convex/_generated/api';
import { usePaginatedQuery, useQuery } from 'convex/react';
import { characterScopeKey, type CharacterScope } from './character-scope';
import type { SpellsPageSheet } from './character-spells-page-types';
import { schoolChoice } from './spell-school-choice';
import type { useCharacterSpellsRoute } from './use-character-spells-route';
import { useCompleteView } from './use-complete-view';

export function useCharacterSpellBrowser({
  scope,
  sheet,
  route,
}: {
  scope: CharacterScope;
  sheet: SpellsPageSheet;
  route: ReturnType<typeof useCharacterSpellsRoute>;
}) {
  const { selected, params, isBrowsing, includeOtherLists, query } = route;
  const catalogReleaseNumber = sheet?.catalogView?.releaseNumber;
  const castingClass = sheet?.classChoices.find(
    (entry) => entry._id === selected?.classEntryId,
  );
  const queryScope =
    sheet && castingClass
      ? {
          ...scope,
          characterId: sheet.character._id,
          castingClassId: castingClass._id,
          ...(catalogReleaseNumber !== undefined
            ? { catalogReleaseNumber }
            : {}),
        }
      : null;
  const browserInfo = useQuery(
    api.characterSheetSpells.browserInfo,
    isBrowsing && queryScope
      ? {
          ...queryScope,
          ...(includeOtherLists ? { includeOtherLists: true } : {}),
        }
      : 'skip',
  );
  const incomingLevels = browserInfo?.levels ?? [];
  const rawLevel = params.get('level');
  const selectedLevel =
    rawLevel !== null &&
    /^\d+$/.test(rawLevel) &&
    incomingLevels.includes(Number(rawLevel))
      ? Number(rawLevel)
      : (browserInfo?.defaultLevel ?? 1);
  const incomingSchools = (browserInfo?.schools ?? []).map(schoolChoice);
  const incomingSchool = incomingSchools.some(
    (item) => item.value === params.get('school'),
  )
    ? params.get('school')
    : null;
  const searching = query.trim().length > 0;
  const browser = usePaginatedQuery(
    api.characterSheetSpells.browse,
    isBrowsing && queryScope && browserInfo
      ? {
          ...queryScope,
          ...(searching
            ? { search: query.trim() }
            : { spellLevel: selectedLevel }),
          ...(incomingSchool ? { school: incomingSchool } : {}),
          ...(includeOtherLists ? { includeOtherLists: true } : {}),
        }
      : 'skip',
    { initialNumItems: 25 },
  );
  const scopeKey = characterScopeKey(scope, [
    params.get('spellcasting'),
    params.get('other'),
    query,
    params.get('level'),
    params.get('school'),
    params.get('add'),
  ]);
  const isComplete = Boolean(
    browserInfo &&
    browser.status !== 'LoadingFirstPage' &&
    browserInfo.catalogReleaseNumber === catalogReleaseNumber &&
    browser.results.every(
      (row) => row.catalogReleaseNumber === catalogReleaseNumber,
    ),
  );
  const visible = useCompleteView(
    scopeKey,
    !sheet
      ? null
      : isComplete
        ? {
            info: browserInfo,
            results: browser.results,
            status: browser.status,
            selectedLevel,
          }
        : undefined,
  );
  const levels = visible?.info?.levels ?? [];
  const schools = (visible?.info?.schools ?? []).map(schoolChoice);
  const school = schools.some((item) => item.value === params.get('school'))
    ? params.get('school')
    : null;
  return {
    levels,
    selectedLevel: visible?.selectedLevel ?? selectedLevel,
    schools,
    school,
    searching,
    browser: {
      ...browser,
      results: visible?.results ?? [],
      status: visible?.status ?? browser.status,
    },
    catalogReleaseNumber: visible?.info?.catalogReleaseNumber,
    isLoading: isBrowsing && !visible,
    loadMore: () => {
      if (isBrowsing && isComplete && browser.status === 'CanLoadMore')
        browser.loadMore(25);
    },
    setLevel: (spellLevel: number) => {
      if (levels.includes(spellLevel))
        route.update({ changes: { level: String(spellLevel), q: null } });
    },
    setSchool: (value: string | null) => {
      if (value === null || schools.some((school) => school.value === value))
        route.update({ changes: { school: value } });
    },
  };
}
