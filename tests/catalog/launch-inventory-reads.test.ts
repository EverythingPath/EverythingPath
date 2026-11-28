// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { readGraphInput } from '../../scripts/affected-tests';
import { readLegalRecordsIn } from '../../scripts/catalog/legal-records';
import { launchManifestCopies } from './launch-manifest';
import {
  launchInventoryEntries,
  legalRecordLoader,
  loaderReachProblems,
} from './legal-loader-reach';
import { loaderProbes, type LoaderProbe } from './legal-loader-reach-probes';

// Per-book licensing (owner, 2026-11-25; pbl-inventory-slim): the launch
// inventory and `mvp:status` read no per-entry legal record. A content row's
// holds and frozen observations come from the inventory's own sources.

const root = process.cwd();
const graph = readGraphInput(root);

it('reaches no legal-record loader from the inventory command or mvp:status', () => {
  const { reached, problems } = loaderReachProblems(graph);
  for (const entry of launchInventoryEntries) expect(reached).toContain(entry);
  // The closure reaches the build and the verification builder.
  expect(reached).toContain('scripts/catalog/launch-inventory-build.ts');
  expect(reached).toContain('scripts/catalog/launch-verification-build.ts');
  expect(reached).not.toContain(legalRecordLoader);
  expect(problems).toEqual([]);
});

/** The guard's problems on a scratch copy of the graph with one probe applied. */
function probed({ path, prefix, added = {} }: LoaderProbe) {
  const files = new Map(graph.files);
  for (const [file, text] of [[path, prefix], ...Object.entries(added)])
    if (file !== undefined && text !== undefined)
      files.set(file, `${text}\n${graph.files.get(file) ?? ''}`);
  return loaderReachProblems({ ...graph, files }).problems;
}

it('keeps 33 probes, each with what the guard gives for it', () => {
  expect(loaderProbes).toHaveLength(33);
});

// Every reference to the loader in a reachable module fails, naming it.
it.each(loaderProbes)('judges the probe $name', (probe) => {
  expect(probed(probe)).toEqual(probe.expected);
});

it('has no readLaunchLegalInventories anywhere', () => {
  const named = [...graph.files].filter(
    ([path, source]) =>
      path !== 'tests/catalog/launch-inventory-reads.test.ts' &&
      typeof source === 'string' &&
      source.includes('readLaunchLegalInventories'),
  );
  expect(named.map(([path]) => path)).toEqual([]);
});

it('keeps no contentEvidence field and no legal record hold on any committed inventory row', async () => {
  const document: unknown = JSON.parse(
    await readFile('scripts/catalog/scopes/campaign-mvp-v1.json', 'utf8'),
  );
  const { rows } = launchManifestCopies(document)();
  const legalHolds = new Set<string>();
  for (const { record } of readLegalRecordsIn(root)) {
    const candidates = (record as { candidates?: unknown }).candidates;
    if (!Array.isArray(candidates)) continue;
    for (const candidate of candidates as {
      holdIds?: string[];
      noticeHoldIds?: string[];
    }[])
      for (const id of [
        ...(candidate.holdIds ?? []),
        ...(candidate.noticeHoldIds ?? []),
      ])
        legalHolds.add(id);
  }
  expect(legalHolds.size).toBeGreaterThan(1000);
  expect(rows.filter((row) => 'contentEvidence' in row)).toEqual([]);
  expect(
    rows.flatMap(({ key, holds }) =>
      holds.some(({ reason }) => legalHolds.has(reason)) ? [key] : [],
    ),
  ).toEqual([]);
  // A content row's frozen admission is unreviewed and cites no legal record,
  // evidence id, disposition or assessment.
  expect(
    rows.filter(
      ({ catalogKey, admission }) =>
        catalogKey && admission.state !== 'unreviewed',
    ),
  ).toEqual([]);
  expect(
    rows.filter(({ admission }) =>
      admission.evidence.some((item) =>
        /scripts\/catalog\/legal\/|disposition|assessment/i.test(item),
      ),
    ),
  ).toEqual([]);
}, 120_000);
