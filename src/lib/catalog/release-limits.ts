/** Shared limits for bounded release preparation, activation and browsing. */
export const catalogReleaseLimits = {
  activationIdentityLength: 64,
  sheetRows: 128,
  candidateReadBytes: 1_048_576,
  characterBatchRows: 32,
  reverseSpellBatchRows: 8,
  dependencies: 256,
  resourceRows: 32,
  inspectionRows: 32,
  spellMetadataRows: 256,
  spellMetadataBytes: 1_048_576,
  spellClassLists: 32,
  spellCopies: 64,
  identityLookupRows: 8,
} as const;
