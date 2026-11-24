import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  attribution227MatchesDrift,
  buildAttribution227Matches,
  buildPcgenNameIndex,
  matchesDifferences,
  matchesPath,
  readMatcherInputHashes,
  readPcgenFiles,
  readStoredInputs,
  serializeAttribution227Matches,
  storedBooksOf,
} from './attribution-227-matcher.ts';
import { pcgenPin } from './inventory.ts';
import {
  foundryCheckout,
  pcgenCheckout,
  pinnedCheckoutProblem,
  verifyPinnedCheckout,
  type PinnedCheckout,
} from './pinned-checkouts.ts';
import { readAttribution227Matches } from './legal/attribution-227-matches.ts';
import {
  importPinnedCatalog,
  verifiedPinnedCatalogCheckouts,
} from './pinned-import.ts';
import { committedReviewedPcgenRecords } from './reviewed-pcgen-records.ts';

/** Where the pinned checkouts live on a host that has them: every local host. */
export const attribution227Host = join(homedir(), 'repos/everythingpath');
/** The pinned checkouts a generation reads, beside the repository's parent. */
export const attribution227Checkouts = (() => {
  const parent = attribution227Host;
  return {
    pcgen: join(parent, `.ep-cache/pcgen-${pcgenPin.commit.slice(0, 8)}`),
    system: join(parent, 'sources/foundryvtt-pathfinder1'),
    content: join(parent, 'sources/pf1-content'),
  };
})();

/**
 * The three checkouts a generation reads, each validated as the generation
 * validates it (`pinned-checkouts.ts`).
 */
export const attribution227PinnedCheckouts: readonly PinnedCheckout[] = [
  pcgenCheckout(attribution227Checkouts.pcgen),
  foundryCheckout('pf1', attribution227Checkouts.system),
  foundryCheckout('pf1-content', attribution227Checkouts.content),
];

/**
 * Remote CI, the one place the pinned checkouts cannot exist: `CI=true` (the
 * runner's pinned environment, remote_checks.ENVIRONMENT, which passes no
 * GitHub variable) on a host without `~/repos/everythingpath`. `CI` alone
 * is not enough: capped.sh and bounded.sh set it on local hosts too, and
 * every local host has that directory.
 */
export const isRemoteCi = (
  env: Readonly<Record<string, string | undefined>>,
  host = attribution227Host,
) => env.CI === 'true' && !existsSync(host);

/**
 * Whether the fresh comparison (`attribution-227-matches-fresh.test.ts`, a
 * host audit) runs: at the pins it runs; without them it may skip only in
 * remote CI, saying so, and on the landing host it is refused, naming each
 * checkout and why (cavalier-master-tactician fix r5).
 */
export function freshComparisonRun({
  checkouts,
  remoteCi,
}: {
  checkouts: readonly PinnedCheckout[];
  remoteCi: boolean;
}):
  | { kind: 'run' }
  | { kind: 'skip'; note: string }
  | { kind: 'refuse'; reason: string } {
  const problems = checkouts.flatMap(
    (item) => pinnedCheckoutProblem(item) ?? [],
  );
  if (!problems.length) return { kind: 'run' };
  return remoteCi
    ? {
        kind: 'skip',
        note: `skipped: no pinned checkouts (remote CI): ${problems.join('; ')}`,
      }
    : {
        kind: 'refuse',
        reason: `the fresh comparison of the scripted match cannot run on the landing host, where it is required: ${problems.join('; ')}`,
      };
}

/**
 * The #227 scripted match generated now from the repository at `root` (its
 * stored inputs and its reviewed remaps and curation) and the pinned
 * checkouts (`catalog:attribution-227-matches --write`): the whole corpus
 * imported at the Foundry pins (`pinned-import.ts`), the PCGen checkout at
 * `pcgenPin`.
 * Fails when a checkout is missing or not at its pin.
 */
export async function generateAttribution227Matches(root: string) {
  const { pcgen, system, content } = attribution227Checkouts;
  verifyPinnedCheckout(pcgenCheckout(pcgen));
  const { artifact } = await importPinnedCatalog({
    checkouts: await verifiedPinnedCatalogCheckouts({ system, content }),
    root,
  });
  const stored = storedBooksOf(await readStoredInputs(root));
  const inputs = await readMatcherInputHashes(root);
  const document = buildAttribution227Matches({
    entries: [...artifact.catalog.entries, ...artifact.catalog.resources],
    index: buildPcgenNameIndex({
      files: await readPcgenFiles(join(pcgen, pcgenPin.directory)),
    }),
    stored,
    reviewedRecords: committedReviewedPcgenRecords,
    inputs,
  });
  const matched = document.matches.filter(
    ({ status }) => status === 'matched',
  ).length;
  return {
    document,
    inputs,
    stored,
    text: serializeAttribution227Matches(document),
    counts: `${document.matches.length} records: ${matched} matched, ${document.matches.length - matched} held.`,
  };
}

/**
 * Why the committed matches file at `root` is not current
 * (`catalog:attribution-227-matches --check`): drift from its pinned inputs
 * or its own binding, and every difference from a fresh generation, record
 * for record and as text. An empty list means current.
 */
export async function attribution227MatchesCheck(root: string) {
  const fresh = await generateAttribution227Matches(root);
  const committedText = await readFile(join(root, matchesPath), 'utf8');
  const committed = readAttribution227Matches(JSON.parse(committedText));
  const problems = [
    ...attribution227MatchesDrift({
      document: committed,
      inputs: fresh.inputs,
      stored: fresh.stored,
    }),
    ...matchesDifferences(committed.matches, fresh.document.matches),
  ];
  if (committedText !== fresh.text)
    problems.push(
      `${matchesPath} differs from a fresh generation (${fresh.counts}); run --write.`,
    );
  return { problems, counts: fresh.counts };
}
