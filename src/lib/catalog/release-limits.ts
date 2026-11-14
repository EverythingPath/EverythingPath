/** Shared limits for bounded release preparation, activation and browsing. */
export const catalogReleaseLimits = {
  activationIdentityLength: 64,
  /** One Character Sheet's rows that release reconciliation reads. */
  sheetRows: 256,
  /** Candidate features, references, prompt members or Modifiers of one definition. */
  definitionRows: 128,
  candidateReadBytes: 1_048_576,
  characterBatchRows: 32,
  reverseSpellBatchRows: 8,
  /** Distinct definitions and keys one sheet's reconciliation reaches. */
  dependencies: 256,
  /** Distinct relationships (edges) among them, old and new counted once. */
  relationships: 512,
  /** Changed Spells a list or a Character's browser names before standing for the rest. */
  listedSpellReasons: 32,
  /** A Character's changed Spell references reconciliation checks for liveness. */
  spellReferenceScan: 64,
  /** One Spell's browser rows or private definitions on one Character. */
  spellReferenceRows: 128,
  resourceRows: 32,
  inspectionRows: 32,
  /** Rows one Spell browser request reads, its page and lookups together. */
  spellPageRows: 256,
  /** Bytes of definitions one Spell browser request reads. */
  spellPageBytes: 1_048_576,
  spellClassLists: 32,
  spellCopies: 64,
  identityLookupRows: 8,
} as const;
