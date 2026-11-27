import { readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { assessCatalogAdmission, computeFingerprint } from './admission.ts';
import { importCatalog } from './import.ts';
import { launchMechanismProofs } from './launch-mechanism-proofs.ts';
import { launchProseCases } from './launch-prose-categories.ts';
import { launchResourceInputs } from './launch-resource-audit.ts';
import { launchVerificationClosure } from './launch-verification-inputs.ts';
import { launchVerificationPackages } from './package-resolution.ts';
import {
  authoredResourceSources,
  mechanismProofsSha256,
  repositoryFileSha256,
  scopeBuildResources,
  verifyLaunchRows,
  type LaunchVerification,
} from './launch-verification.ts';
import { verifyInputs } from './operator.ts';
import { readReleaseScope } from './release-scope.ts';
import { catalogImplementationInputs } from './release-inputs.ts';
import { pinnedPcgenListPath } from './pinned-pcgen-store.ts';
import {
  committedAttribution227Matches,
  readPinnedPcgenListAt,
  requirePinnedPcgenLists,
  reviewedRecordLines,
  type Attribution227Matches,
} from './legal/attribution-227-matches.ts';
import { readCommittedRegisterAdmission } from './register-admission.ts';
import { legalResources } from '../../src/lib/catalog/legal-resources-data.ts';
import { currentCalculationIdentity } from '../../src/lib/catalog/calculation-identities.ts';

const scopeVersion = 'campaign-mvp-v1';
const reviewedFiles = [
  'scripts/catalog/reviewed-curation.json',
  'scripts/catalog/reviewed-remaps.json',
  'src/lib/catalog/data/section15-registry.json',
  'src/lib/catalog/data/resources.json',
];

/**
 * Every file the build can read, by path: the builder's own runtime closure
 * (`launchVerificationClosure`, which names the reviewed files above by their
 * literal paths), with the importer's dependency graph, the reviewed files,
 * the resource rows' sources, the proof registry's test files and the pinned
 * PCGen lists the gate reads the matches file's reviewed-record lines in
 * added. The additions only add; the closure is never replaced.
 */
export async function launchVerificationBinding(
  repoRoot: string,
  matches: Pick<
    Attribution227Matches,
    'matches'
  > = committedAttribution227Matches,
) {
  const implementation = await catalogImplementationInputs();
  const closure = launchVerificationClosure(repoRoot);
  const pinnedLists = reviewedRecordLines(matches.matches).map(({ line }) =>
    pinnedPcgenListPath(line.file),
  );
  const paths = new Set([
    ...closure.files,
    ...Object.keys(implementation.parsers.files),
    ...reviewedFiles,
    ...launchResourceInputs.map(([, locator]) => locator),
    ...launchMechanismProofs.flatMap(({ tests }) =>
      tests.map(({ path }) => path),
    ),
    ...pinnedLists,
  ]);
  return {
    implementation,
    paths: [...paths].sort(),
    packages: await launchVerificationPackages(closure.packages),
  };
}

/**
 * The bound inputs' hashes (`binding.inputs`), read now: every path
 * `launchVerificationBinding` names must be readable, and a pinned list a
 * reviewed-record line reads stops the build with the gate's own error
 * (`requirePinnedPcgenLists`).
 */
export async function launchVerificationInputs(
  repoRoot: string,
  matches: Pick<
    Attribution227Matches,
    'matches'
  > = committedAttribution227Matches,
) {
  requirePinnedPcgenLists(matches, readPinnedPcgenListAt(repoRoot));
  const binding = await launchVerificationBinding(repoRoot, matches);
  const inputs: Record<string, string> = {};
  for (const path of binding.paths) {
    const hash = repositoryFileSha256(repoRoot, path);
    if (!hash) throw new Error(`Missing bound verification input ${path}.`);
    inputs[path] = hash;
  }
  return { ...binding, inputs };
}

/**
 * `catalog:launch-inventory --verify`: one build at the inventory's pinned
 * inputs, projected onto the committed inventory. The full preview's gate
 * (`assessCatalogAdmission` over the whole corpus) gives each row's gate
 * class; the scoped build (the import a `--scope campaign-mvp-v1` release
 * reads, with its authored and legal resources) gives the entries and
 * resources it would emit. The header binds every file these can read and the
 * package resolution they run on (`launchVerificationBinding`), so a later
 * cheap check (`mvp:status`) can tell when the projection went stale.
 */
export async function buildLaunchVerification({
  repoRoot,
  systemPath,
  contentPath,
}: {
  repoRoot: string;
  systemPath: string;
  contentPath: string;
}): Promise<LaunchVerification> {
  const read = (path: string) => readFile(join(repoRoot, path), 'utf8');
  const system = await realpath(systemPath);
  const content = await realpath(contentPath);
  const inputVerification = await verifyInputs({
    system,
    content,
    allowUnverified: false,
  });
  if (inputVerification.status !== 'verified')
    throw new Error('Verification needs the pinned upstream checkouts.');
  const sha256Of = (path: string) => repositoryFileSha256(repoRoot, path);
  // Bound first, so the projection describes the files as they were read.
  const { implementation, packages, inputs } =
    await launchVerificationInputs(repoRoot);
  const scope = await readReleaseScope({ version: scopeVersion });
  const remaps: unknown = JSON.parse(await read(reviewedFiles[1] ?? ''));
  const curation: unknown = JSON.parse(await read(reviewedFiles[0] ?? ''));
  const reviewed = await readCommittedRegisterAdmission();
  // The full preview: the whole corpus's gate, as `catalog:preview` assesses it.
  const preview = await (async () => {
    const artifact = await importCatalog({
      systemPath: system,
      contentPath: content,
      remaps,
      curation,
      // Verified above: a key these inputs lack is in no pinned file.
      wholeCorpus: true,
    });
    const gate = assessCatalogAdmission({ artifact, ...reviewed });
    return {
      gate: {
        admitted: gate.admitted,
        held: gate.held,
        dependentOmissions: gate.dependentOmissions,
        retainedExceptions: gate.retainedExceptions,
        failures: gate.failures,
      },
      unsupported: artifact.unsupported,
      fingerprints: {
        extractionFingerprint: computeFingerprint(artifact),
        reviewedInputsFingerprint: computeFingerprint(reviewed),
        legalResourcesFingerprint: computeFingerprint(legalResources),
      },
    };
  })();
  const scoped = await importCatalog({
    systemPath: system,
    contentPath: content,
    remaps,
    curation,
    scopeKeys: scope.importKeys,
    wholeCorpus: true,
  });
  const resources = scopeBuildResources({
    authored: authoredResourceSources(implementation.ruleResources),
    registry: await read('src/lib/catalog/data/section15-registry.json'),
    legalResources: await read('src/lib/catalog/data/resources.json'),
  });
  const rows = verifyLaunchRows(scope.manifest, {
    admission: preview.gate,
    scopeBuild: {
      entries: scoped.catalog.entries,
      remaps: new Map(
        scoped.catalog.remaps
          .filter(({ applied }) => applied)
          .map(({ from, to }) => [from, to]),
      ),
      resources,
    },
    unsupported: preview.unsupported,
    proofs: { registry: launchMechanismProofs, sha256Of },
    proseCases: launchProseCases,
    calculationIdentity: currentCalculationIdentity,
    stale: [],
  });
  return {
    version: 1,
    scopeVersion,
    binding: {
      launchScopeIdentity: scope.binding.launchScopeIdentity,
      calculationIdentity: currentCalculationIdentity,
      proofsSha256: mechanismProofsSha256(launchMechanismProofs),
      gate: {
        ...preview.fingerprints,
        upstream: inputVerification.repositories.map(
          ({ repository, commit }) => ({ repository, commit }),
        ),
      },
      inputs,
      packages,
    },
    rows,
  };
}
