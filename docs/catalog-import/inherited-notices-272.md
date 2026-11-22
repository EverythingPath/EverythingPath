# Inherited notice review: #272

Reviewed by **Sol (AI curator) for the owner** on **2026-10-08**. [Ticket #272](https://github.com/AndreasUnunger/EverythingPath/issues/272) lists fifteen occurrences of fourteen distinct immutable keys. This batch establishes compilation-level notice evidence; it does not establish content attribution or legal sufficiency.

The [batch inventory](../../scripts/catalog/legal/inherited-notices-272.json) records every full key, source line, hash, disposition, comparison and hold. The [Section 15 Registry](../../src/lib/catalog/data/section15-registry.json) retains verbatim text and reviewer/date provenance. All fourteen unique blocks are complete physical notice lines. No heading or wrapped fragment needs joining; aliases and `joinedWith` lists are empty.

| Occurrence | Hash prefix | Line | Notice | Copyright date | Disposition |
| --- | --- | --- | --- | --- | --- |
| 1 | `cb04529a` | 158 | Killer Frog, Tome of Horrors Complete | 2011 | Reviewed; chain held |
| 2 | `2733e096` | 159 | Korred, Tome of Horrors Complete | 2011 | Reviewed; chain held |
| 3 | `83b00be9` | 160 | Kostchtchie, Tome of Horrors Revised | 2002 | Reviewed; chain held |
| 4 | `a0bcdbb8` | 161 | Leprechaun, Tome of Horrors Complete | 2011 | Reviewed; chain held |
| 5 | `19ed469a` | 162 | Marid, Tome of Horrors III | 2005 | Reviewed; chain held |
| 6 | `6abe598a` | 163 | Mihstu, Tome of Horrors Complete | 2011 | Reviewed; chain held |
| 7 | `68711b05` | 164 | Mite, Tome of Horrors Complete | 2011 | Reviewed; chain held |
| 8 | `68711b05` | 164 | Mite, Tome of Horrors Complete | 2011 | Duplicate of occurrence 7; same record and hold |
| 9 | `af13e0ae` | 166 | Mite, Tome of Horrors | 2002 | Reviewed separately; chain held |
| 10 | `38d926e5` | 167 | Mongrelman, Tome of Horrors Complete | 2011 | Reviewed; chain held |
| 11 | `c3df64ce` | 168 | Mongrelman, Tome of Horrors Revised | 2002 | Reviewed separately; chain held |
| 12 | `949901ef` | 169 | Monster Codex | 2014 | Reviewed; chain held |
| 13 | `69eae546` | 170 | Moon Dog, Tome of Horrors Complete | 2011 | Reviewed; chain held |
| 14 | `020865e2` | 171 | Muckdweller, Tome of Horrors Complete | 2011 | Reviewed; chain held |
| 15 | `26abbbcb` | 172 | Mythic Adventures | 2013 | Reviewed; chain held |

## Evidence and holds

Source evidence is [pf1-content 11.4.0 OGL.txt, lines 158–172](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L158), commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, complete-file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`. The companion system checkout is `v11.11`, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`, OGL file SHA-256 `0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9`. Immutable keys hash the complete UTF-8 physical line without its line ending, preserving every space and punctuation mark.

[#224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134) identifies permitted compilations and known defects. [#227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647) permits compilation verification and requires permanent notice retention. Its [amendment](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5955032870) points to the later [#241 resolution](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698), which requires current content-bound Attribution Assessments and reviewed notices for admission. [PRD #251 decision 17 and its acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) carry these boundaries forward. A seed, name match or broad collection of notices supplies no content assessment.

Line 165 repeats line 164 with a final ASCII space; its distinct hash is `decea4c7db268f8c43acf0d5373c72207cf78edbe2852e114dc0eb458f9c517e`. The ticket repeats line 164's key at occurrences 7 and 8. No Registry record or alias is created for the unlisted variant, and both original physical lines remain in the permanent upstream notice block. The older Mite and Mongrelman notices retain separate identities. Literal wording is preserved, including Killer Frog's `Authors` without a colon, Kostchtchie's `Revised.©` without an intervening space, Marid's `III. ©`, Mongrelman's `Copyright 2002` and `Author Scott Greene`, and Mythic Adventures' comma before `©`. No discrepancy requiring correction of these exact lines is established by the permitted evidence. Review dates remain separate from copyright dates; `checkedAgainst: "pf1-content"` does not claim printed verification.

Fourteen `notice-272-complete-chain-<full hash>` holds name the missing complete book-chain and alias evidence. The compilation does not establish the complete Tome of Horrors chains, every book inheriting a creature notice, or the full Monster Codex and Mythic Adventures inheritance chains. Every hold is enforced in [held-notices.json](../../scripts/catalog/legal/held-notices.json), following [the curation convention](curation.md#notice-holds-from-content-batches). A reviewed Registry line does not lift its chain hold. No product-code or book-title aliases, Attribution Assessments or shipping content evidence are added.

All 89 prior Registry records and 250 prior hold registrations remain equal to `HEAD`; fourteen Registry records and fourteen enforced holds are added. Existing named source exclusions, Ultimate Combat/Occult Mysteries corrections, free-PDF gaps and owner-transcription PDF checks remain unresolved. The complete upstream blocks and committed permanent superset are unchanged. No prior-use inventory was supplied, so no actual retained exception is asserted or cleared.

## Verification

Commands use the pinned read-only sibling checkouts. Scratch files and process temporary directories stay in ignored `.scratch/curation-272/`; `tmp/package.json` contains `{"type":"commonjs"}`. Notice hashes are not catalog candidate IDs, so full-corpus commands accompany the bounded notice tests.

```sh
mkdir -p .scratch/curation-272/tmp
export TMPDIR="$PWD/.scratch/curation-272/tmp"
printf '{"type":"commonjs"}\n' > "$TMPDIR/package.json"
PF1_CURATION_SYSTEM="/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="/home/andreas/repos/everythingpath/sources/pf1-content"
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:format --check
pnpm catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-272/drafts
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-272/preview
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --curation .scratch/curation-272/drafts/records.json --out .scratch/curation-272/preview-drafts
pnpm test tests/catalog/inherited-notices-272.test.ts tests/catalog/notice-holds.test.ts
pnpm test tests/catalog
git diff --check
```

Independent byte/hash/pin comparison against the read-only checkouts passed for all fourteen unique blocks and fifteen ticket occurrences. The [focused batch tests](../../tests/catalog/inherited-notices-272.test.ts), together with the hold-registration tests, passed: two files, 26 tests, 669 ms. Synthetic assessments prove gate behavior without certifying imported content. A direct `buildLegalPageData` invocation using all fifteen occurrence keys produced the four `ogl`, `section15`, `section8` and `paizo` sections and seventeen notices: fourteen Registry notices, both upstream blocks and the project line. Outstanding notices/resources were empty. These synthetic requirements do not establish actual content admission.

| Check | Result |
| --- | --- |
| `pnpm -s typecheck` | Pass, exit 0 |
| `pnpm -s lint` | Pass, exit 0 |
| `pnpm -s check:initial-migration-writers` | Pass; 183 registrations checked |
| `pnpm catalog:pin` | Pass; `sha256:71c66667344e200747085cc47660277a9e7677da10cdd3d58033591444baa25b` |
| `pnpm catalog:format --check` | Pass; canonical shared data |
| `catalog:curate` | Exit 0; 4,251 records, 3,628 new drafts, no missing bindings, 763 unresolved mechanics; coverage remains failed |
| Default `catalog:preview` | Expected gate exit 1; 53 admitted, 23,129 held, 2 dependent omissions, 0 retained exceptions, 4,734 failures |
| Draft-assisted `catalog:preview` | Expected gate exit 1; same dispositions, 1,869 failures |
| Focused batch and hold-registration tests | Pass; 26 tests across 2 files, 669 ms |
| `pnpm test tests/catalog` | Pass, exit 0; 36 files, 572 tests, 38.48 seconds |
| `git diff --check` | Pass |

The curation report includes 192 unresolved descriptions, 3,488 applied records and no stale or unused records. Its records fingerprint is `554879e2dbca51da53b0bd97bb93318b68ea9ab048504c079e15c1e0e4f6ec38`. Drafts do not become reviewed Attribution Assessments.

Both previews verify the required commits and extract 23,037 entries plus 538 resources. Holds comprise 22,401 missing Attribution Assessments and 728 existing source/content-assessment holds. Greater Vital Strike (`pf1/zKNk7a4XxXsygJ67`) is omitted because Improved Vital Strike (`pf1/DorPGQ2mifJbMKH8`) remains held; Lightning Stance (`pf1/jbvXxHpu7BVbCpwr`) is omitted because Wind Stance (`pf1/9p0aAtCyLdcwnftS`) remains held. Existing unrelated admitted content requires only `PZO1110`; outstanding notices/resources are empty. Held-only batch notices do not become admitted requirements. This batch establishes no new content attribution for the 53 admitted entries.

Default failures comprise 3,628 missing curation records, 715 unaccounted inventory records and 391 broken references. Draft-assisted failures replace missing records with 763 unresolved curation mechanics and retain the 1,106 inventory/reference failures. All admitted, held, dependent-omission and retained-exception dispositions, notice requirements and outstanding notices/resources match between previews. These corpus-wide gaps remain outside this batch; no product-code fix is needed.

Both previews use reviewed-input fingerprint `273d32fe4d1e632b7686b38a859fce17adf708bc338e834103c04a13fd1e6dda` and legal-resource fingerprint `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`. Default admission-report SHA-256 is `7608f6b13644bfca4aadbf2528266a11f4c7975e455c095fe9c9f8c7dada4f58`; extraction fingerprint `d7e2b89c12b5639475cca600451aa7ceebcef96ceef5eed8be2aff0e3ad17f05`. Draft-assisted admission-report SHA-256 is `c7c237e95ec3e21959fd435537b622b0df9b1827eaf050cb56d6789fc1103b80`; extraction fingerprint `f44254005f4e6568e78bdd3e75a72663795807e0bcab50b33fc9c94228ba246f`. These identify the observed reports after scratch cleanup.

The full `pnpm test` is reserved for the orchestrator's landing gate. No Convex integration test is needed because no backend or product code changed.

## Phase timing and handoff

Approximate elapsed windows on **2026-10-07 UTC**, corresponding to **2026-10-08 in Europe/Stockholm**: briefing/policy/source review 22:39–22:41, two minutes; Registry/evidence/test implementation 22:40–22:42, two minutes; operator commands and verification 22:40–22:47, seven minutes; reporting and final audit 22:41–22:48, seven minutes. Overall elapsed time is about nine minutes; overlapping phases are not additive. Gates finished at 22:47:22 UTC. The review date uses the local calendar date.

Only the Registry, enforced holds, batch inventory, focused test and this report changed. Scratch drafts, preview reports, logs and process temporary files are removed after reporting, before handoff. Changes remain uncommitted. No commits, pushes, issues, PRs, deployments, environment-file accesses, private E2E accesses or upstream changes were made. The final handoff uses the launcher's output handling; no answer file is placed in the repository.

## Workflow observations

- Validate slice uniqueness and preserve physical-byte identities. The ticket repeats line 164's hash while line 165 differs by a final space; record both ticket occurrences without substituting the unlisted variant.
- The Registry stores reviewer identity in free-text provenance. The structured batch inventory supplies reviewer/date, dispositions and evidence for audit.
- Worktree-local temporary directories need the CommonJS package boundary used by earlier batches. The catalog suite ran with its ordinary configuration; no tracked timeout or assertion is changed.
- #257 remains `OPEN` despite the landed gate implementation explicitly exercised by this brief. Reconcile tracker dependencies before scheduling later batches.
- Requested Opus/Fable model names and foreground flags are unavailable in this interface. Implementation delegation uses the inherited available model; the main session reviews evidence, runs operator checks and reports results.
