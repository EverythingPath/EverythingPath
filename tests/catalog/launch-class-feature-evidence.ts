// The class-feature families' committed-inventory control evidence
// (`class-feature-level-grants`, `class-level-slots`): the rows a control
// selects, each class whose grant edge names one and each schedule increment
// whose requirement edge names one, with the entries and issues the current
// importer gives them from the pinned store, read as
// `buildLaunchVerification` reads the pinned checkouts (`importedEvidence`).
import { readFile } from 'node:fs/promises';
import type { LaunchRow } from '../../scripts/catalog/launch-inventory-schema';
import { parseLaunchInventory } from '../../scripts/catalog/launch-inventory-document';
import {
  repositoryFileSha256,
  verifyLaunchRows,
} from '../../scripts/catalog/launch-verification';
import { currentCalculationIdentity } from '../../src/lib/catalog/calculation-identities';
import {
  confirmedAssessments,
  type ProjectedRows,
} from './launch-admission-control';
import { importedEvidence } from './launch-modifier-evidence';
import { materializePinnedTree } from './pinned-sources';

const repository = (path: string) => repositoryFileSha256('.', path);
const incrementMechanism = 'Reviewed schedule increment';

/**
 * The evidence for every admitted classFeature row the predicate selects,
 * with its classes and increments. `project` runs the projection over the
 * whole committed inventory with the base's gate, a registry and, optionally,
 * a change to the real entries (a mutation check), and gives each row's
 * proven mechanisms by key.
 *
 * The expected admission comes from the gate's reviewed input, not from the
 * projection under test: a row is admitted with a confirmed attribution
 * assessment (`attribution-assessments.json`), and a schedule increment,
 * which takes its parent's assessment, with its one parent's. `admission`
 * compares the committed projection with it over the family's whole scope:
 * every selected classFeature row, admitted or not, and every increment of
 * one (`expectAdmissionAgreement`; `added` is an unadmitted row as a
 * projection would admit it). The test can't recompute the gate's fingerprints, notices or closures,
 * so a confirmed row the gate holds for another reason fails the comparison
 * rather than passing. Classes are outside it: a family proof needs no class
 * admitted (root decision R1).
 */
export async function loadClassFeatureControl(
  selects: (row: LaunchRow) => boolean,
) {
  const inventory = parseLaunchInventory(
    JSON.parse(
      await readFile('scripts/catalog/scopes/campaign-mvp-v1.json', 'utf8'),
    ),
  );
  const byKey = new Map(inventory.rows.map((found) => [found.key, found]));
  const isIncrement = (key: string) =>
    byKey
      .get(key)
      ?.mechanisms.some(({ name }) => name === incrementMechanism) ?? false;
  const confirmed = await confirmedAssessments();
  const expectedAdmitted = (key: string) => {
    if (!isIncrement(key)) return confirmed.has(key);
    const parents = inventory.edges.filter(
      ({ kind, from }) => kind === 'requirement' && from === key,
    );
    return parents.length === 1 && parents.every(({ to }) => confirmed.has(to));
  };
  const admitted = inventory.rows
    .map(({ key }) => key)
    .filter(expectedAdmitted);
  const admittedKeys = new Set(admitted);
  const candidates = inventory.rows.filter(
    (found) => found.kind === 'classFeature' && selects(found),
  );
  const candidateKeys = new Set(candidates.map(({ key }) => key));
  const scope = [
    ...candidateKeys,
    ...new Set(
      inventory.edges
        .filter(
          ({ kind, from, to }) =>
            kind === 'requirement' &&
            candidateKeys.has(to) &&
            isIncrement(from),
        )
        .map(({ from }) => from),
    ),
  ].sort();
  const expected = scope.filter((key) => admittedKeys.has(key));
  const admission = {
    expected,
    unadmitted: scope.filter((key) => !admittedKeys.has(key)),
    /** The scope rows a projection admits against the expected ones. */
    agreement(rows: ProjectedRows) {
      const projected = new Set(rows.map(({ key }) => key));
      return {
        missing: expected.filter((key) => !projected.has(key)),
        extra: scope.filter(
          (key) => projected.has(key) && !admittedKeys.has(key),
        ),
      };
    },
    added: (key: string): ProjectedRows[number] => ({
      key,
      verified: ['admission'],
      mechanisms: [],
      prose: [],
      evidence: [],
    }),
  };
  const familyRows = candidates.filter(({ key }) => admittedKeys.has(key));
  const familyKeys = new Set(familyRows.map(({ key }) => key));
  const classRows = [
    ...new Set(
      inventory.edges
        .filter(
          ({ kind, from, to }) =>
            kind === 'grant' &&
            familyKeys.has(to) &&
            byKey.get(from)?.kind === 'class',
        )
        .map(({ from }) => from),
    ),
  ].flatMap((key) => byKey.get(key) ?? []);
  const incrementKeys = [
    ...new Set(
      inventory.edges
        .filter(
          ({ kind, from, to }) =>
            kind === 'requirement' && familyKeys.has(to) && isIncrement(from),
        )
        .map(({ from }) => from),
    ),
  ];
  const files = [...familyRows, ...classRows].map(({ key, sources }) => {
    const [bound, ...others] = sources.filter(
      ({ repository: repo }) => repo === 'pf1' || repo === 'pf1-content',
    );
    if (!bound || others.length)
      throw new Error(`${key} binds no single Foundry source.`);
    return {
      file: `${bound.repository}/${bound.locator}`,
      sha: bound.rawSha256,
    };
  });
  const tree = await materializePinnedTree(
    files.map(({ file }) => file),
    { sha256: Object.fromEntries(files.map(({ file, sha }) => [file, sha])) },
  );
  const evidence = await importedEvidence(tree).finally(() => tree.dispose());
  // Increments come from their class's import, beside it.
  const keysRead = [
    ...[...familyRows, ...classRows].map(({ key }) => key),
    ...incrementKeys.filter((key) => evidence.entries.has(key)),
  ];
  const missing = [...familyRows, ...classRows]
    .map(({ key }) => key)
    .filter((key) => !evidence.entries.has(key));
  if (missing.length)
    throw new Error(`No real entry for ${missing.join(', ')}.`);
  type Entry = NonNullable<ReturnType<typeof evidence.entries.get>>;
  const project = (
    registry: readonly unknown[],
    change: (key: string, entry: Entry) => Entry = (_, entry) => entry,
  ) =>
    new Map(
      verifyLaunchRows(inventory, {
        admission: {
          admitted: admitted.map((externalKey) => ({
            externalKey,
            reason: 'Admitted at the base.',
          })),
          held: [],
          dependentOmissions: [],
          retainedExceptions: [],
          failures: [],
        },
        scopeBuild: {
          entries: keysRead.flatMap((key) => {
            const entry = evidence.entries.get(key);
            return entry ? [change(key, entry)] : [];
          }),
          remaps: new Map(),
          resources: new Map(),
        },
        unsupported: {
          entries: keysRead.map((externalKey) => ({
            externalKey,
            issues: evidence.issues.get(externalKey) ?? [],
          })),
        },
        proofs: { registry, sha256Of: repository },
        proseCases: [],
        calculationIdentity: currentCalculationIdentity,
        stale: [],
      }).map(({ key, mechanisms }) => [key, mechanisms]),
    );
  return {
    project,
    inventory,
    familyRows,
    classRows,
    incrementKeys,
    evidence,
    admission,
  };
}

/** The keys a projection proves this mechanism on, sorted. */
export function provingKeys(
  projected: ReadonlyMap<string, readonly string[]>,
  proves: (name: string) => boolean,
) {
  return [...projected]
    .filter(([, mechanisms]) => mechanisms.some(proves))
    .map(([key]) => key)
    .sort();
}
