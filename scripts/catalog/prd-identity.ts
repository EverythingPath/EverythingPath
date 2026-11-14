/**
 * The #716 PRD capture's identity (owner decision 1 of 2026-10-17), defined
 * once for the capture tool (`prd-capture.ts`), its network guard
 * (`prd-fetch.ts`) and the `prdPin` (`inventory.ts`).
 */

/**
 * The capture's folder name below `~/repos/everythingpath/sources/`: the
 * 2026-10-18 pages, byte-identical, and the base-class pages added on
 * 2026-10-20 (owner decision 8). The 2026-10-18 capture stays as it was.
 */
export const prdCaptureName = 'prd-2026-10-20';

/**
 * The capture the Section 15 confirmations (`section15-match.ts`) record for
 * a PRD book's pending comparison: they were reviewed against it, and the
 * 2026-10-20 capture holds its pages byte-identical.
 */
export const section15PrdCapture = 'prd-2026-10-18';

/**
 * The `pf1e-archetypes` module the checklist comes from (formerly
 * `tristangoucher/pf1e-archetypes`; GitLab redirects the old path), at its
 * pinned commit.
 */
export const checklistProject = 'Tryss_Farron/pf1e-archetypes';
export const checklistRepo = `https://gitlab.com/${checklistProject}`;
export const checklistCommit = '92ddcb60027e3088e5afd0645183c031ec3e9bb4';
