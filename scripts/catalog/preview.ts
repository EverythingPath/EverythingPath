import { mkdir, writeFile, realpath, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { importCatalog, parseCandidateKeys } from './import.ts';
import { appendConditionResources } from './conditions.ts';
import type { AdmissionArtifact } from './admission.ts';
import { assessCatalogAdmission, computeFingerprint } from './admission.ts';
import { legalResources } from '../../src/lib/catalog/legal-resources-data.ts';
import { reviewedAdmissionSchema } from '../../src/lib/catalog/admission-schema.ts';
import { parseReviewedAdmissionInput } from '../../src/lib/catalog/attribution-evidence-codec.ts';
import { readCommittedReviewedAdmission } from './reviewed-data-files.ts';
import { resolveOutputPath, validateOutput, verifyInputs } from './operator.ts';
import { buildLegalPageData } from '../../src/lib/catalog/legal-page-data.ts';

type CatalogPreviewOutcome = { status: 0 | 1; stdout: string; stderr: string };

const catalogPreviewUsage =
  'Usage: pnpm catalog:preview --system PATH --content PATH [--out PATH] [--attribution PATH] [--curation PATH] [--candidates PATH] [--conditions] [--allow-unverified-checkouts]\nInputs must be clean Git checkouts at the pinned commits. The override marks fixture/development output as unverified. --attribution supplies reviewed admission JSON instead of the committed evidence. --curation supplies note records instead of the committed overlay. --candidates scopes extraction to a JSON array of at most 100 exact keys; coverage then describes only that selection. --conditions includes locally authored CRB conditions and their fingerprinted resources. Admission and curation failures write reports and exit nonzero.\n';

function parsePreviewArguments(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      system: { type: 'string' },
      content: { type: 'string' },
      out: { type: 'string', default: '.catalog-preview' },
      attribution: { type: 'string' },
      curation: { type: 'string' },
      candidates: { type: 'string' },
      conditions: { type: 'boolean' },
      help: { type: 'boolean' },
      'allow-unverified-checkouts': { type: 'boolean' },
    },
    strict: true,
    allowPositionals: false,
  });
  if (values.help) return;
  if (!values.system || !values.content) {
    throw new Error('Both --system PATH and --content PATH are required.');
  }
  if (!values.out.trim()) throw new Error('--out PATH must not be empty.');
  if (values.attribution !== undefined && !values.attribution.trim())
    throw new Error('--attribution PATH must not be empty.');
  if (values.curation !== undefined && !values.curation.trim())
    throw new Error('--curation PATH must not be empty.');
  if (values.candidates !== undefined && !values.candidates.trim())
    throw new Error('--candidates PATH must not be empty.');
  return { ...values, system: values.system, content: values.content };
}

async function resolvePreviewPaths(
  values: NonNullable<ReturnType<typeof parsePreviewArguments>>,
  cwd: string,
) {
  const output = await resolveOutputPath(resolve(cwd, values.out));
  const system = await realpath(resolve(cwd, values.system));
  const content = await realpath(resolve(cwd, values.content));
  const attributionPath = values.attribution
    ? await realpath(resolve(cwd, values.attribution))
    : undefined;
  const candidatesPath = values.candidates
    ? await realpath(resolve(cwd, values.candidates))
    : undefined;
  const curationPath = await realpath(
    values.curation
      ? resolve(cwd, values.curation)
      : new URL('./reviewed-curation.json', import.meta.url),
  );
  await validateOutput({
    output,
    sources: [
      system,
      content,
      curationPath,
      ...(attributionPath ? [attributionPath] : []),
      ...(candidatesPath ? [candidatesPath] : []),
    ],
  });
  return {
    output,
    system,
    content,
    attributionPath,
    curationPath,
    candidatesPath,
  };
}

async function loadReviewedInputs(attributionPath: string | undefined) {
  return attributionPath
    ? reviewedAdmissionSchema.parse(
        parseReviewedAdmissionInput(await readFile(attributionPath, 'utf8')),
      )
    : await readCommittedReviewedAdmission();
}

async function extractCatalog({
  system,
  content,
  curationPath,
  candidatesPath,
}: {
  system: string;
  content: string;
  curationPath: string;
  candidatesPath?: string;
}) {
  const remaps: unknown = JSON.parse(
    await readFile(new URL('./reviewed-remaps.json', import.meta.url), 'utf8'),
  );
  return importCatalog({
    systemPath: system,
    contentPath: content,
    remaps,
    curation: JSON.parse(await readFile(curationPath, 'utf8')),
    candidateKeys: candidatesPath
      ? parseCandidateKeys(JSON.parse(await readFile(candidatesPath, 'utf8')))
      : undefined,
  });
}

type CatalogArtifact = AdmissionArtifact;
function buildPreviewReports({
  result,
  reviewedInputs,
  inputVerification,
}: {
  result: CatalogArtifact;
  reviewedInputs: Awaited<ReturnType<typeof loadReviewedInputs>>;
  inputVerification: Awaited<ReturnType<typeof verifyInputs>>;
}) {
  const gate = assessCatalogAdmission({ artifact: result, ...reviewedInputs });
  const legalPage = buildLegalPageData({
    registry: reviewedInputs.registry,
    resources: legalResources,
    requiredNotices: gate.requiredNotices,
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
  });
  const admission = {
    ...gate,
    curation: result.curation,
    purpose: 'preview',
    inputVerification,
    inputs: result.catalog.inputs,
    localResources: result.catalog.localResources ?? [],
    extractionFingerprint: computeFingerprint(result),
    reviewedInputsFingerprint: computeFingerprint(reviewedInputs),
    legalResourcesFingerprint: computeFingerprint(legalResources),
    outstandingNotices: legalPage.outstandingNotices,
    outstandingResources: legalPage.outstandingResources,
  };
  const files = [
    [
      'curation.json',
      {
        ...result.curation,
        purpose: 'preview',
        inputVerification,
        inputs: result.catalog.inputs,
      },
    ],
    ['catalog.json', { ...result.catalog, inputVerification }],
    ['unsupported.json', result.unsupported],
    ['comparison.json', result.comparison],
    ['admission.json', admission],
  ] as const;
  return { admission, files };
}

async function writePreviewReports({
  files,
  output,
}: {
  files: ReturnType<typeof buildPreviewReports>['files'];
  output: string;
}) {
  const serialized = files.map(
    ([name, report]) => [name, JSON.stringify(report, null, 2) + '\n'] as const,
  );
  await mkdir(output, { recursive: true });
  await Promise.all(
    serialized.map(([name, json]) => writeFile(join(output, name), json)),
  );
}

function reportPreview({
  result,
  admission,
  output,
}: {
  result: CatalogArtifact;
  admission: ReturnType<typeof buildPreviewReports>['admission'];
  output: string;
}): CatalogPreviewOutcome {
  return {
    status: admission.passed ? 0 : 1,
    stdout:
      `Wrote ${result.catalog.entries.length} catalog entries and ${result.catalog.resources.length} resources with reports to ${output}\n` +
      `Admission: ${admission.admitted.length} admitted, ${admission.held.length} held, ${admission.dependentOmissions.length} dependent omissions, ${admission.retainedExceptions.length} retained exceptions, ${admission.failures.length} failures.\n`,
    stderr: admission.passed
      ? ''
      : 'Catalog admission failed; inspect admission.json for individually reported failures.\n',
  };
}

async function runCatalogPreview(
  args: string[],
  cwd: string,
): Promise<CatalogPreviewOutcome> {
  const values = parsePreviewArguments(args);
  if (!values) return { status: 0, stdout: catalogPreviewUsage, stderr: '' };
  const paths = await resolvePreviewPaths(values, cwd);
  const inputVerification = await verifyInputs({
    ...paths,
    allowUnverified: values['allow-unverified-checkouts'] === true,
  });
  const extracted = await extractCatalog(paths);
  const result = values.conditions
    ? await appendConditionResources(extracted)
    : extracted;
  const reviewedInputs = await loadReviewedInputs(paths.attributionPath);
  const { admission, files } = buildPreviewReports({
    result,
    reviewedInputs,
    inputVerification,
  });
  await writePreviewReports({ files, output: paths.output });
  return reportPreview({ result, admission, output: paths.output });
}

/**
 * The whole `pnpm catalog:preview` command, without the process: what it
 * prints and its exit status. Relative paths resolve against `cwd`. Admission
 * failures still write reports; any other failure is reported, never thrown.
 */
export async function runCatalogPreviewCommand({
  args,
  cwd = process.cwd(),
}: {
  args: string[];
  cwd?: string;
}): Promise<CatalogPreviewOutcome> {
  try {
    return await runCatalogPreview(args, cwd);
  } catch (error: unknown) {
    return {
      status: 1,
      stdout: '',
      stderr: `${error instanceof Error ? error.message : String(error)}\n`,
    };
  }
}
