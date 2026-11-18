# Uncorrelated T3 review regression

`earlier-762-spec.json` is a byte-identical copy of the archived actual
`766-inputs/actual-task-status-spec.json` supplied for #766. It describes the
ordinary #762 round-3 Spec review. It has no promotion-specific pre-dispatch
capture and is never promotion evidence. Tests supply its unchanged `result`
at initial binding to reproduce the replay defect. Variants in test code are
explicit negative fixtures, not claimed API metadata or executed tasks.

`earlier-762-original.json` is the unchanged original durable first-page response saved by the read-only correlation research. Together with the unchanged status fixture it is used only for foreign-task rejection at initial binding. It does not qualify a #766 review. Synthetic tools/messages in `tests/catalog/t3-code-mode-fixture.ts` model the documented API shapes and are explicitly disposable test data.

`failed-binding-observation.json` and `failed-binding-request.json` are byte-identical copies of `766-authentic-r1/failed-binding-observation.json` and `766-authentic-r1/capture/request.json` under the shared MVP run directory. Authentic qualification failed on candidate `4ea6343`: the saved original is the exact review-role prefix plus unchanged frozen task. The original fixture review subsequently returned FIX FIRST (22 confirmed, nine rationale corrections, Hawkeye mechanics/binding rejected); this failed attempt is never approving promotion evidence. Tests replay the unchanged full message/request with clearly synthetic pagination envelopes, since the independent saved full read exceeded the adapter's 2,048-code-unit slice size. Integrated workflow tests use entirely synthetic captures/API responses. Historical bare-v2 reconstruction is a labelled synthetic compatibility fixture, not a retrofitted actual binding.
