// The Catalog Release the release-qualification suite (#753) builds, prepares,
// reconciles and activates on the freshly recreated E2E preview. Its only
// admitted definition is the feats-365 batch's one admission, read from the
// pinned source store (tests/fixtures/pinned) and checked against the digest
// in its legal inventory (scripts/catalog/legal/feats-365.json). The full
// corpus can't pass the release gates yet (#742), so this is the documented
// bounded input; see docs/catalog-import/releases.md.
export const releaseQualification = {
  // The first release a fresh preview has seen.
  releaseNumber: 1,
  activationId: 'e2e-release-qualification-1',
  feat: {
    externalKey: 'pf1-content/xgRstzkd1nDznrjH',
    name: 'Skill Focus (Acrobatics)',
    batch: 'feats-365',
    source: {
      repo: 'pf1-content',
      path: 'src/pf-feats/Skill_Focus__Acrobatics__xgRstzkd1nDznrjH.yaml',
      sha256:
        '9423026eb62d5ff2bbd16954806b0ab824904d73eab65065e9387fa212ce99f1',
    },
    // CRB p. 134: +3 on all checks with the chosen skill, +6 from 10 ranks
    // (#724 applies it from the recorded ranks). A level-1 Fighter with
    // Dexterity 10 and no ranks or armor goes from Acrobatics +0 to +3.
    skill: { target: 'skill.acr', label: 'Acrobatics' },
    bonus: 3,
  },
  // The second seeded Character of the case already holds the feat, so
  // reconciliation evaluates a Character the release changes.
  reconciledCharacter: 'E2E catalog-release-reconciled',
} as const;
