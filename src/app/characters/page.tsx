'use client';
import { CharactersListLoading } from '~/components/character-navigation/characters-list-loading';
import { OwnedCharactersView } from '~/components/character-navigation/owned-characters-view';
import { useOwnedCharacters } from '~/components/character-navigation/use-character-lists';
export default function CharactersRoute() {
  const { groups, returning, newHref } = useOwnedCharacters();
  return groups === undefined ? (
    <CharactersListLoading />
  ) : (
    <OwnedCharactersView
      groups={groups}
      returning={returning}
      newHref={newHref}
    />
  );
}
