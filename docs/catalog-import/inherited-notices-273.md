# Inherited notice review: #273

Reviewed 2026-10-08 (Europe/Stockholm) by **Sol (AI curator) for the owner**. This batch reviews the fifteen immutable keys in [#273](https://github.com/AndreasUnunger/EverythingPath/issues/273), following [#264](inherited-notices-264.md). It establishes compilation notice evidence, not content attribution, printed-book verification or legal sufficiency.

## Evidence and disposition

All fifteen keys match SHA-256 of one complete physical UTF-8 notice line, excluding the newline, in pinned `pf1-content` 11.4.0. None is a heading or wrapped fragment; no joining is required. Copyright dates, contributors, punctuation and spacing remain verbatim. Each key receives a reviewed Registry record and an enforced notice-chain hold. No product-code, book-title or cross-variant alias is established.

- Content evidence: commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, [OGL.txt lines 173–187](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L173-187), full-file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`.
- System comparison: `foundryvtt-pathfinder1` v11.11, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`, [OGL.txt lines 41–43](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/OGL.txt#L41-43), full-file SHA-256 `0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9`. None of this batch's notices occurs there.
- Policy evidence: [#224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134) permits compilation evidence and identifies its limits; [#227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647) allows compilation review and requires permanent retention; [#241](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698) supersedes one-off attribution and requires current content-bound evidence. [PRD #251's acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) preserves those boundaries.

Full keys, line provenance, reviewer/date, dispositions and hold reasons are in [inherited-notices-273.json](../../scripts/catalog/legal/inherited-notices-273.json). Verbatim text is in [section15-registry.json](../../src/lib/catalog/data/section15-registry.json). `checkedAgainst: "pf1-content"` records the actual comparison; Registry provenance carries the reviewer because the existing schema has no reviewer field.

| Key suffix | Source line | Notice and copyright date | Disposition |
| --- | --- | --- | --- |
| `e048bab1…8d86972` | 173 | Nabasu Demon, Tome of Horrors, Revised; 2002; Neville White credit | Reviewed; chain and variant comparison held |
| `98e86dfc…c7b189d` | 174 | Nabasu Demon, Tome of Horrors; 2002; Gary Gygax credit | Reviewed; chain and variant comparison held |
| `2815e93b…96ba023` | 175 | Nabasu, Tome of Horrors Revised; 2002; Greene and Peterson | Reviewed; chain and variant comparison held |
| `e63877d6…cfdc0bc` | 176 | Necrophidius, Tome of Horrors Complete; 2011 | Reviewed; chain held |
| `f9daf267…4e1769f` | 177 | Nereid, Tome of Horrors Complete; 2011 | Reviewed; chain held |
| `df82f111…06865b3` | 178 | Occult Adventures; 2015 | Reviewed; chain held |
| `08f23ff6…61c875d` | 179 | Ooze, Magma, Tome of Horrors Complete; 2011 | Reviewed; chain held |
| `0c072724…83e99f` | 180 | Orc, Black, Tome of Horrors Complete; 2011 | Reviewed; chain held |
| `a92d5ac2…81f0e8` | 181 | Orcus, Tome of Horrors Revised; 2002 | Reviewed; chain held |
| `673b5cff…46cbecc` | 182 | Paizo Blog; 2010–2011 | Reviewed; coverage/chain held |
| `cccff64c…cc3b62` | 183 | Pathfinder 10: A History of Ashes; 2008 | Reviewed; chain held |
| `68606833…abcae2` | 184 | Pathfinder 11: Skeletons of Scarwall; 2008 | Reviewed; chain held |
| `e7c6621f…7cb655` | 185 | Pathfinder 12: Crown of Fangs; 2008 | Reviewed; chain held |
| `403dce25…9b246` | 186 | Pathfinder 13: Shadow in the Sky; 2008 | Reviewed; chain held |
| `44bdcdb8…a660665` | 187 | Pathfinder 14: Children of the Void; 2008 | Reviewed; chain held |

## Holds and discrepancies

Fifteen named `notice-273-complete-chain-<hash>` holds are registered in [held-notices.json](../../scripts/catalog/legal/held-notices.json). The eight creature excerpts do not establish complete Tome of Horrors notice chains or the Paizo books inheriting them. The six book notices do not delineate their complete inherited chains. The Paizo Blog compilation line does not identify individual posts or bound their complete content and notice requirements. These gaps require permitted evidence before the corresponding content can be admitted.

The three Nabasu notices have distinct titles and author/original-material credits. The permitted compilation supplies no basis to choose one as a correction or equate them; the comparison remains named in their holds. Preserve all three, the missing space in `Revised.©` (Nabasu and Orcus), and `Author Casey Christofferson` without adding a colon. Occult Adventures is distinct from the pre-existing Occult Mysteries correction hold. No discrepancy is silently repaired and no new Attribution Assessment is created.

All existing named holds remain, including Dynamite comics, Thornkeep, Refuge of Time, Horror Realms, Shattered Star #4, Ultimate Combat/Occult Mysteries corrections, free-PDF gaps and owner-transcription PDF checks. Both full upstream blocks and every historic notice version remain unchanged. No prior-use inventory was supplied; this batch asserts or clears no actual retained exception.

## Verification

All generated artifacts, logs and temporary directories use ignored `.scratch/curation-273/`, with `TMPDIR` pointing at its `tmp/` directory and a scratch-only CommonJS package boundary. No deployment or release activation is involved. Notice identities are legal records rather than selectable entry identities, so the corpus operator commands run without a content `--candidates` selector.

```sh
mkdir -p .scratch/curation-273/tmp
export TMPDIR="$PWD/.scratch/curation-273/tmp"
printf '{"type":"commonjs"}\n' > "$TMPDIR/package.json"
PF1_CURATION_SYSTEM=/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1
PF1_CURATION_CONTENT=/home/andreas/repos/everythingpath/sources/pf1-content
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:format --check
pnpm catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-273/drafts
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-273/preview
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --curation .scratch/curation-273/drafts/records.json --out .scratch/curation-273/preview-drafts
pnpm test tests/catalog/inherited-notices-273.test.ts tests/catalog/notice-holds.test.ts
pnpm test tests/catalog
git diff --check
```

The [25 focused batch tests](../../tests/catalog/inherited-notices-273.test.ts) verify the exact source-line bytes, keys, dates and provenance; legal-page generation and permanent retention; each of the fifteen enforced holds with otherwise current synthetic assessments; missing assessments; stale/missing/unreviewed notice bindings; unrelated admitted fixture behavior; and the literal Nabasu variants and punctuation. Synthetic assessments remain test-only. No actual Catalog Entry is assessed or admitted by this batch.

A direct `buildLegalPageData` probe using all fifteen keys returned `ogl`, `section15`, `section8` and `paizo` sections, fifteen Registry notices and eighteen total retained notices, with no outstanding notices or resources. A subsequent build with no requirements and no Registry retained the entire resulting superset unchanged. Both complete upstream OGL resources independently matched the pinned files byte for byte; all fifteen hashes had unique matches. Existing Registry records and hold entries remained equal to `HEAD`, with exactly fifteen additions to each. Legal resources, Attribution Assessments and attribution evidence were unchanged. No product-code fix was needed.

| Check | Result |
| --- | --- |
| `pnpm -s typecheck` | Pass, exit 0; repeated after the new test was present |
| `pnpm -s lint` | Pass, exit 0; the new test also passed a separate ESLint run |
| `pnpm -s check:initial-migration-writers` | Pass, 183 registrations checked |
| `pnpm catalog:pin` | Pass; `sha256:71c66667344e200747085cc47660277a9e7677da10cdd3d58033591444baa25b` |
| `pnpm catalog:format --check` | Pass; canonical data files |
| `catalog:curate` | Exit 0; 4,351 records, 3,628 new drafts, 0 missing bindings, 763 unresolved mechanics; coverage remains failed |
| Default `catalog:preview` | Expected gate exit 1; 53 admitted, 23,129 held, 2 dependent omissions, 0 retained exceptions, 4,734 failures |
| Draft-assisted `catalog:preview` | Expected gate exit 1; 53 admitted, 23,129 held, 2 dependent omissions, 0 retained exceptions, 1,869 failures |
| Focused batch and hold tests | 27 passed, exit 0; final run 0.753 seconds |
| `pnpm test tests/catalog` | 38 files, 612 tests passed, exit 0; 36.26 seconds |
| `git diff --check` | Pass |

The full test suite was not run; it is reserved for the orchestrator's landing gate.

The default preview verified both pinned commits and extracted 23,037 entries plus 538 resources. Its failures comprise 3,628 missing curation records, 715 unaccounted inventory records and 391 broken structures/references. Holds comprise 22,303 missing Attribution Assessments, 32 known upstream notice/evidence holds and 794 existing content-review holds. Only the previously reviewed `PZO1110` notice is required by admitted content, with no outstanding notice/resource. This batch adds no actual content assessment; its held keys are demonstrated independently by the focused synthetic gate tests. Default admission-report SHA-256: `184916fc2b929e2a65186b75638d0c025f34d79676a6431952d8b9d622ccc617`.

The draft-assisted preview has identical admitted/held/dependent/retained dispositions and reviewed/legal input fingerprints. It replaces the 3,628 missing-record failures with 763 unresolved-mechanics failures, alongside the same 715 inventory and 391 structural/reference failures. The two dependent omissions are Greater Vital Strike (`pf1/zKNk7a4XxXsygJ67`) and Lightning Stance (`pf1/jbvXxHpu7BVbCpwr`). These corpus gaps remain outside this notice batch; generated drafts were not promoted to reviewed content evidence. The final draft-assisted admission-report SHA-256 is `457e59b40b7260f678efb8ed428b81ec85f280c7bf9045ff646359f1a9793485`; extraction fingerprint `5aa09dda48f32cebc1288ae0bbbf398a918d39085ecf2d76b9b70923f2c7585e`; reviewed-input fingerprint `4f7136dbc0ed06bdd5c04ee0c1689444a854e0b73803e36711e6d7c717630c00`; legal-resource fingerprint `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`.

## Timing and handoff

Approximate UTC phase windows on 2026-10-07 (local date 2026-10-08): briefing/policy/source review 23:00–23:01:30, 1.5 minutes; delegated Registry/evidence/test work 23:01–23:04, three minutes; checks/operator commands 23:01–23:10, nine minutes; report, final audit and cleanup 23:02–23:11, nine minutes. Work overlapped; overall elapsed time was about eleven minutes.

Only the batch evidence, Registry, enforced holds, focused test and this report changed. All scratch reports, drafts, logs and temporary files were removed after recording the results. No commits, pushes, issues, PRs, environment files, private E2E material or upstream source changes were made. The launcher receives the final handoff through its answer-output mechanism; no answer file is added to the repository.

## Workflow observations

- The Registry records reviewer identity in provenance rather than a structured property; the batch inventory makes it auditable.
- The brief's inventory hashes resolve to physical source lines 173–187; use immutable keys rather than interpreting the ticket's ordinal range as line numbers.
- #257 still reported `OPEN` when checked, although its landed admission/legal tooling is present and the brief explicitly requires its use. Reconcile dependency state before scheduling from tracker status alone.
- The requested Opus/Fable model names are unavailable through this session's agent interface. The code/data/test work was delegated using the available inherited model.
- Full-corpus previews take several minutes for each small notice batch. The focused tests isolate notice behavior; shared corpus-gate execution or caching could reduce repeated work when scaling batches. Keep explicit verified source pins and the scratch `TMPDIR`/CommonJS boundary in the harness.
