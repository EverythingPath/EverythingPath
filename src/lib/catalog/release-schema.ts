import { ConvexError } from 'convex/values';
import { sha256 } from './release-sha256.ts';
/** Runtime-independent release contract shared by the operator and Convex. */
export type ReleaseJson =
  | null
  | boolean
  | number
  | string
  | ReleaseJson[]
  | { [key: string]: ReleaseJson };
export const releaseRowKinds = [
  'definition',
  'resource',
  'remap',
  'report',
  'legal',
] as const;
export const releaseReportCategories = [
  'content',
  'resources',
  'holds',
  'retirement',
  'curation',
] as const;
export const releaseLegalKeys = [
  'requiredNotices',
  'permanentNoticeSuperset',
  'registry',
  'resources',
] as const;
export type ReleaseRow = {
  kind: (typeof releaseRowKinds)[number];
  key: string;
  payload: ReleaseJson;
};
export const releaseInputCategories = [
  'upstream',
  'remaps',
  'curation',
  'localData',
  'parsers',
  'sanitizers',
  'ruleResources',
  'legal',
  'attribution',
] as const;
export type ReleaseInputCategory = (typeof releaseInputCategories)[number];
export type CatalogReleaseManifest = {
  formatVersion: 1;
  releaseNumber: number;
  baseRelease: { releaseNumber: number; artifactFingerprint: string } | null;
  inputs: Record<ReleaseInputCategory, string>;
  compatibility: { schema: string; calculation: string };
  inputFingerprint: string;
  outputFingerprint: string;
  batches: { fingerprint: string; rowCount: number; byteCount: number }[];
  artifactFingerprint: string;
};
export type CatalogReleaseArtifact = {
  manifest: CatalogReleaseManifest;
  batches: ReleaseRow[][];
};
export const MAX_RELEASE_BATCH_ROWS = 100;
export const MAX_RELEASE_BATCH_BYTES = 512000;
export const MAX_RELEASE_MANIFEST_BYTES = 131072;
export const MAX_RELEASE_BATCHES = 1024;

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isJson(value: unknown): value is ReleaseJson {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJson);
  return isObject(value) && Object.values(value).every(isJson);
}
export function parseReleaseJson(value: unknown): ReleaseJson {
  if (!isJson(value)) throw new ConvexError('Invalid release JSON value.');
  return value;
}
export function canonicalReleaseJson(value: unknown): string {
  function canonicalize(input: unknown): ReleaseJson {
    if (Array.isArray(input)) return input.map(canonicalize);
    if (isObject(input))
      return Object.fromEntries(
        Object.entries(input)
          .filter(([, item]) => item !== undefined)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, item]) => [key, canonicalize(item)]),
      );
    if (isJson(input)) return input;
    throw new ConvexError('Release values must be finite JSON data.');
  }
  return JSON.stringify(canonicalize(value));
}
export function releaseByteCount(value: unknown): number {
  return new TextEncoder().encode(canonicalReleaseJson(value)).byteLength;
}
export async function releaseFingerprint(value: unknown): Promise<string> {
  return sha256(new TextEncoder().encode(canonicalReleaseJson(value)));
}
function parseText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new ConvexError(`Invalid release ${field}.`);
  return value;
}
function parseFingerprint(value: unknown, field: string): string {
  const result = parseText(value, field);
  if (!/^[a-f0-9]{64}$/.test(result))
    throw new ConvexError(`Invalid release ${field} fingerprint.`);
  return result;
}
function parseCount(value: unknown, field: string, maximum: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > maximum
  )
    throw new ConvexError(`Invalid release ${field}.`);
  return value;
}
export function releaseRowIdentity(
  row: Pick<ReleaseRow, 'kind' | 'key'>,
): string {
  return `${row.kind === 'definition' || row.kind === 'resource' ? 'catalog' : row.kind}:${row.key}`;
}
export function isReleaseRowKind(value: unknown): value is ReleaseRow['kind'] {
  return releaseRowKinds.some((kind) => kind === value);
}
export function validateCatalogReleaseRows(value: unknown): ReleaseRow[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_RELEASE_BATCH_ROWS
  )
    throw new ConvexError('Release batch must contain 1–100 rows.');
  const rows = value.map((row): ReleaseRow => {
    if (!isObject(row)) throw new ConvexError('Invalid release row.');
    const kind = row.kind;
    if (!isReleaseRowKind(kind))
      throw new ConvexError('Invalid release row kind.');
    if (!isJson(row.payload))
      throw new ConvexError('Invalid release row payload.');
    return { kind, key: parseText(row.key, 'row key'), payload: row.payload };
  });
  if (releaseByteCount(rows) > MAX_RELEASE_BATCH_BYTES)
    throw new ConvexError('Release batch exceeds byte limit.');
  if (new Set(rows.map(releaseRowIdentity)).size !== rows.length)
    throw new ConvexError('Duplicate release row.');
  return rows;
}
function parseBaseRelease(value: unknown) {
  if (!isObject(value))
    throw new ConvexError('Invalid release comparison base.');
  return {
    releaseNumber: parseCount(
      value.releaseNumber,
      'base number',
      Number.MAX_SAFE_INTEGER,
    ),
    artifactFingerprint: parseFingerprint(
      value.artifactFingerprint,
      'base artifact',
    ),
  };
}
export function validateCatalogReleaseManifest(
  value: unknown,
): CatalogReleaseManifest {
  if (
    !isObject(value) ||
    value.formatVersion !== 1 ||
    !isObject(value.inputs) ||
    !isObject(value.compatibility) ||
    !Array.isArray(value.batches)
  )
    throw new ConvexError('Invalid Catalog Release manifest.');
  const inputSource = value.inputs;
  // Each category is explicitly parsed; omitted categories cannot silently disappear.
  const inputs = {
    upstream: parseFingerprint(inputSource.upstream, 'upstream'),
    remaps: parseFingerprint(inputSource.remaps, 'remaps'),
    curation: parseFingerprint(inputSource.curation, 'curation'),
    localData: parseFingerprint(inputSource.localData, 'localData'),
    parsers: parseFingerprint(inputSource.parsers, 'parsers'),
    sanitizers: parseFingerprint(inputSource.sanitizers, 'sanitizers'),
    ruleResources: parseFingerprint(inputSource.ruleResources, 'ruleResources'),
    legal: parseFingerprint(inputSource.legal, 'legal'),
    attribution: parseFingerprint(inputSource.attribution, 'attribution'),
  };
  if (value.batches.length === 0 || value.batches.length > MAX_RELEASE_BATCHES)
    throw new ConvexError('Invalid release batch inventory.');
  const manifest: CatalogReleaseManifest = {
    formatVersion: 1,
    releaseNumber: parseCount(
      value.releaseNumber,
      'number',
      Number.MAX_SAFE_INTEGER,
    ),
    inputs,
    baseRelease:
      value.baseRelease === null ? null : parseBaseRelease(value.baseRelease),
    compatibility: {
      schema: parseText(value.compatibility.schema, 'schema compatibility'),
      calculation: parseText(
        value.compatibility.calculation,
        'calculation compatibility',
      ),
    },
    inputFingerprint: parseFingerprint(value.inputFingerprint, 'input'),
    outputFingerprint: parseFingerprint(value.outputFingerprint, 'output'),
    artifactFingerprint: parseFingerprint(
      value.artifactFingerprint,
      'artifact',
    ),
    batches: value.batches.map((batch) => {
      if (!isObject(batch))
        throw new ConvexError('Invalid release batch descriptor.');
      return {
        fingerprint: parseFingerprint(batch.fingerprint, 'batch'),
        rowCount: parseCount(
          batch.rowCount,
          'batch row count',
          MAX_RELEASE_BATCH_ROWS,
        ),
        byteCount: parseCount(
          batch.byteCount,
          'batch byte count',
          MAX_RELEASE_BATCH_BYTES,
        ),
      };
    }),
  };
  if (releaseByteCount(manifest) > MAX_RELEASE_MANIFEST_BYTES)
    throw new ConvexError('Release manifest exceeds byte limit.');
  if (canonicalReleaseJson(value) !== canonicalReleaseJson(manifest))
    throw new ConvexError('Unexpected release manifest fields.');
  return manifest;
}
export async function verifyCatalogReleaseManifest(
  manifest: CatalogReleaseManifest,
): Promise<void> {
  const { artifactFingerprint, ...body } = manifest;
  if (
    manifest.inputFingerprint !==
      (await releaseFingerprint({
        inputs: manifest.inputs,
        compatibility: manifest.compatibility,
        baseRelease: manifest.baseRelease,
      })) ||
    manifest.outputFingerprint !==
      (await releaseFingerprint(manifest.batches)) ||
    artifactFingerprint !== (await releaseFingerprint(body))
  )
    throw new ConvexError('Catalog Release manifest fingerprint mismatch.');
}
export async function validateCatalogReleaseArtifact(
  value: unknown,
): Promise<CatalogReleaseArtifact> {
  if (!isObject(value) || !Array.isArray(value.batches))
    throw new ConvexError('Invalid Catalog Release artifact.');
  const manifest = validateCatalogReleaseManifest(value.manifest);
  await verifyCatalogReleaseManifest(manifest);
  if (value.batches.length !== manifest.batches.length)
    throw new ConvexError('Catalog Release batch inventory mismatch.');
  const batches: ReleaseRow[][] = [];
  const identities = new Set<string>();
  for (const [index, batch] of value.batches.entries()) {
    const rows = validateCatalogReleaseRows(batch);
    const descriptor = manifest.batches[index];
    if (
      descriptor?.rowCount !== rows.length ||
      descriptor.byteCount !== releaseByteCount(rows) ||
      descriptor.fingerprint !== (await releaseFingerprint(rows))
    )
      throw new ConvexError('Catalog Release output fingerprint mismatch.');
    for (const row of rows) {
      const identity = releaseRowIdentity(row);
      if (identities.has(identity))
        throw new ConvexError('Duplicate release row across batches.');
      identities.add(identity);
    }
    batches.push(rows);
  }
  return { manifest, batches };
}
