type Definition = {
  _id: string;
  scope: string;
  characterId?: string;
  browseOnly?: true;
};

/**
 * A sheet read loads the Character's browse-only definitions only when it
 * needs them; its catalog view offers them. Merged, the sheet sees every
 * definition the Character has, as it did before they were browse-only.
 */
export function mergeBrowseOnlyDefinitions<
  Row extends Definition,
  Snapshot extends {
    character: { _id: string };
    catalogEntries: Row[];
    catalogView?: { definitions: Row[] };
  },
>(snapshot: Snapshot): Snapshot {
  const loaded = new Set(snapshot.catalogEntries.map((row) => row._id));
  const browseOnly = (snapshot.catalogView?.definitions ?? []).filter(
    (row) =>
      row.browseOnly &&
      row.scope === 'character' &&
      row.characterId === snapshot.character._id &&
      !loaded.has(row._id),
  );
  return browseOnly.length
    ? {
        ...snapshot,
        catalogEntries: [...snapshot.catalogEntries, ...browseOnly],
      }
    : snapshot;
}
