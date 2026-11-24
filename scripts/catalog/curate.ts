import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  draftCatalogCurationWithReport,
  parseCandidateKeys,
} from './import.ts';
import { validateOutput, resolveOutputPath, verifyInputs } from './operator.ts';
import { computeFingerprint } from './admission.ts';
import { formatCatalogData } from './data-files.ts';

type CatalogCurationOutcome = { status: 0 | 1; stdout: string; stderr: string };

const catalogCurationUsage =
  'Usage: pnpm catalog:curate --system PATH --content PATH [--records PATH] [--candidates PATH] [--out PATH] [--descriptions] [--allow-unverified-checkouts]\nWrites gap-only drafts to records.json and a coverage/draft report to curation.json. --candidates supplies a JSON array of at most 100 exact upstream keys (three class definitions). --records supplies previous drafts or checked records. --descriptions runs the separate prose-only pass. Drafted and checked records apply; drafts with diagnostics require checking before preview admission. Inputs must be pinned clean checkouts unless the explicit fixture override is supplied.\n';

function parseCurationArguments(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      system: { type: 'string' },
      content: { type: 'string' },
      records: { type: 'string' },
      candidates: { type: 'string' },
      out: { type: 'string', default: '.catalog-curation' },
      descriptions: { type: 'boolean' },
      'allow-unverified-checkouts': { type: 'boolean' },
      help: { type: 'boolean' },
    },
    strict: true,
    allowPositionals: false,
  });
  if (values.help) return;
  if (!values.system || !values.content)
    throw new Error('Both --system PATH and --content PATH are required.');
  if (!values.out.trim()) throw new Error('--out PATH must not be empty.');
  if (values.records !== undefined && !values.records.trim())
    throw new Error('--records PATH must not be empty.');
  if (values.candidates !== undefined && !values.candidates.trim())
    throw new Error('--candidates PATH must not be empty.');
  return { ...values, system: values.system, content: values.content };
}

async function resolveCurationPaths(
  values: NonNullable<ReturnType<typeof parseCurationArguments>>,
) {
  const system = await realpath(resolve(values.system));
  const content = await realpath(resolve(values.content));
  const recordsPath = await realpath(
    values.records
      ? resolve(values.records)
      : new URL('./reviewed-curation.json', import.meta.url),
  );
  const output = await resolveOutputPath(resolve(values.out));
  const candidatesPath = values.candidates
    ? await realpath(resolve(values.candidates))
    : undefined;
  await validateOutput({
    output,
    sources: [system, content, ...(candidatesPath ? [candidatesPath] : [])],
    reports: ['records.json', 'curation.json'],
  });
  const outputRecords = await resolveOutputPath(join(output, 'records.json'));
  if (outputRecords !== recordsPath)
    await validateOutput({
      output,
      sources: [recordsPath],
      reports: ['records.json', 'curation.json'],
    });
  return { system, content, recordsPath, output, candidatesPath };
}

async function draftCuration({
  system,
  content,
  recordsPath,
  candidatesPath,
  shouldCollectDescriptions,
  wholeCorpus,
}: Awaited<ReturnType<typeof resolveCurationPaths>> & {
  shouldCollectDescriptions: boolean;
  wholeCorpus: boolean;
}) {
  const remaps: unknown = JSON.parse(
    await readFile(new URL('./reviewed-remaps.json', import.meta.url), 'utf8'),
  );
  const previous: unknown = JSON.parse(await readFile(recordsPath, 'utf8'));
  return draftCatalogCurationWithReport({
    systemPath: system,
    contentPath: content,
    remaps,
    curation: previous,
    descriptions: shouldCollectDescriptions,
    candidateKeys: candidatesPath
      ? parseCandidateKeys(JSON.parse(await readFile(candidatesPath, 'utf8')))
      : undefined,
    wholeCorpus,
  });
}

type CurationResult = Awaited<ReturnType<typeof draftCuration>>;
function buildCurationReports({
  result: { draft, report: coverage, inputs, candidateKeys },
  inputVerification,
  shouldCollectDescriptions,
}: {
  result: CurationResult;
  inputVerification: Awaited<ReturnType<typeof verifyInputs>>;
  shouldCollectDescriptions: boolean;
}) {
  const curation = formatCatalogData('curation', {
    records: draft.records,
    situations: draft.situations,
  });
  const report = {
    ...coverage,
    ...(candidateKeys ? { candidateKeys } : {}),
    purpose: 'draft',
    pass: shouldCollectDescriptions ? 'descriptions' : 'notes',
    inputVerification,
    inputs,
    recordsFingerprint: computeFingerprint(JSON.parse(curation)),
    added: draft.added,
    replaced: draft.replaced,
  };
  return { curation, report };
}

async function writeCurationReports({
  output,
  curation,
  report,
}: ReturnType<typeof buildCurationReports> & { output: string }) {
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'records.json'), curation);
  await writeFile(
    join(output, 'curation.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
}

function reportCuration({
  result: { draft, report },
  output,
}: {
  result: CurationResult;
  output: string;
}) {
  return `Wrote ${draft.records.length} records (${draft.added.length} new drafts, ${draft.replaced.length} replaced) to ${output}. ${report.missing.length} missing, ${report.unresolvedMechanics.length} unresolved mechanics.\n`;
}

async function runCuration(args: string[]): Promise<CatalogCurationOutcome> {
  const values = parseCurationArguments(args);
  if (!values) return { status: 0, stdout: catalogCurationUsage, stderr: '' };
  const paths = await resolveCurationPaths(values);
  const inputVerification = await verifyInputs({
    ...paths,
    allowUnverified: values['allow-unverified-checkouts'] === true,
  });
  const shouldCollectDescriptions = values.descriptions === true;
  const result = await draftCuration({
    ...paths,
    shouldCollectDescriptions,
    wholeCorpus: inputVerification.status === 'verified',
  });
  const reports = buildCurationReports({
    result,
    inputVerification,
    shouldCollectDescriptions,
  });
  await writeCurationReports({ ...reports, output: paths.output });
  return {
    status: 0,
    stdout: reportCuration({ result, output: paths.output }),
    stderr: '',
  };
}

/** `pnpm catalog:curate`: writes gap-only drafts and their report; see the usage. */
export async function runCatalogCuration({
  args,
}: {
  args: string[];
}): Promise<CatalogCurationOutcome> {
  try {
    return await runCuration(args);
  } catch (error: unknown) {
    return {
      status: 1,
      stdout: '',
      stderr: `${error instanceof Error ? error.message : String(error)}\n`,
    };
  }
}
