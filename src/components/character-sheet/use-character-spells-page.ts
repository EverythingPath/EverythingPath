'use client';

import { characterScopeKey, type CharacterScope } from './character-scope';
import type { SpellsPageController } from './character-spells-page-types';
import { useCharacterSpellBrowser } from './use-character-spell-browser';
import { useCharacterSpellCollections } from './use-character-spell-collections';
import {
  selectSpellsRoute,
  spellsRouteActions,
  useCharacterSpellsRoute,
} from './use-character-spells-route';
import { useSpellDescriptionExpansion } from './use-spell-description-expansion';
import { useCompleteView } from './use-complete-view';

export { schoolChoice } from './spell-school-choice';

/** URL state selects the view; the sheet and bounded browser own all Spell data. */
export function useCharacterSpellsPage(
  scope: CharacterScope,
  controller: SpellsPageController,
) {
  const route = useCharacterSpellsRoute(
    controller.sheet?.calculated.spellcastings ?? [],
  );
  const browser = useCharacterSpellBrowser({
    scope,
    sheet: controller.sheet,
    route,
  });
  const scopeKey = characterScopeKey(scope);
  const releaseNumber = controller.sheet?.catalogView?.releaseNumber;
  const isComplete =
    !route.isBrowsing ||
    releaseNumber === undefined ||
    browser.catalogReleaseNumber === releaseNumber;
  const displayed = useCompleteView(
    scopeKey,
    isComplete || !controller.sheet ? controller.sheet : undefined,
  );
  const visible = {
    ...controller,
    sheet: displayed === undefined ? controller.sheet : displayed,
  };
  const spellcastings = visible.sheet?.calculated.spellcastings ?? [];
  const selection = selectSpellsRoute(spellcastings, route.params);
  const { selected } = selection;
  const collections = useCharacterSpellCollections({
    controller: visible,
    selected,
    browserRows: browser.browser.results,
  });
  const descriptions = useSpellDescriptionExpansion(
    `${scope.characterId}/${selected?.classEntryId ?? ''}`,
  );

  return {
    spellcastings,
    ...selection,
    query: route.query,
    searching: browser.searching,
    school: browser.school,
    schools: browser.schools,
    levels: browser.levels,
    selectedLevel: browser.selectedLevel,
    isLoading: browser.isLoading,
    browserStatus: browser.browser.status,
    ...collections,
    warnings: controller.warnings,
    writes: controller.spells,
    /** Casting sum, extra slots, Granted Spells and specialist school. */
    features: selected
      ? controller.spellcastingChoices.viewFor(selected.classEntryId)
      : null,
    ...spellsRouteActions({ spellcastings, selection, update: route.update }),
    setLevel: browser.setLevel,
    setSchool: browser.setSchool,
    loadMore: browser.loadMore,
    ...descriptions,
  };
}
