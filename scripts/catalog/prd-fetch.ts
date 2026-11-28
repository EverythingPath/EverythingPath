import { setTimeout as sleep } from 'node:timers/promises';
import { checklistCommit, checklistProject } from './prd-identity.ts';

/**
 * The one-time PRD capture's only network access (#716 P8, owner decision 1
 * of 2026-10-17): Wayback snapshots of paizo.com's PRD and the pinned
 * `pf1e-archetypes` commit on GitLab. Requests are sequential, at most one a
 * second, with a descriptive User-Agent; a 429, a 5xx or a dropped connection is
 * retried at most twice with backoff. Nothing in the build or the tests calls this.
 */
export const userAgent =
  'everythingpath-prd-capture/1.0 (one-time archival capture of the Pathfinder PRD for an open-source character builder; sequential, 1 request/s)';

const allowed = [
  /^https:\/\/web\.archive\.org\/(?:web\/\d{14}id_\/https?:\/\/paizo\.com(?::80)?\/pathfinder[Rr][Pp][Gg]\/prd\/|cdx\/search\/cdx\?url=paizo\.com\/pathfinderRPG\/prd\/)/,
];

/** A GraphQL query against the pinned `pf1e-archetypes` commit only. */
type GraphqlQuery = {
  query: string;
  variables: { project: string; ref: string } & Record<string, unknown>;
};

let last = 0;
/**
 * GitLab throttled one request a second for each file (HTTP 429), so the
 * checklist is read through batched GraphQL queries, five seconds apart.
 */
const spacing = (url: string) =>
  url.startsWith('https://gitlab.com/') ? 5000 : 1000;
let requests = 0;
let received = 0;

/** Requests and bytes received so far, for the capture's totals. */
export function fetchTotals() {
  return { requests, bytes: received };
}

type Response = {
  status: number;
  headers: Headers;
  body: Buffer;
};

/** Authorization: only the approved Wayback paths and the pinned checklist commit. */
function assertApproved({ url, query }: { url: string; query?: GraphqlQuery }) {
  const approved = query
    ? url === 'https://gitlab.com/api/graphql' &&
      query.variables.project === checklistProject &&
      query.variables.ref === checklistCommit
    : allowed.some((pattern) => pattern.test(url));
  if (!approved)
    throw new Error(`Refusing a URL outside the approved capture: ${url}`);
}

/**
 * One request, spaced from the last; `null` for a dropped connection.
 * Redirects aren't followed: a Wayback redirect means the requested snapshot
 * isn't the original page, which the caller reports.
 */
async function request({
  url,
  query,
}: {
  url: string;
  query?: GraphqlQuery;
}): Promise<Response | null> {
  const wait = last + spacing(url) - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  requests++;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        ...(query && { 'Content-Type': 'application/json' }),
      },
      redirect: 'manual',
      ...(query && { method: 'POST', body: JSON.stringify(query) }),
    });
    const body = Buffer.from(await response.arrayBuffer());
    received += body.length;
    return { status: response.status, headers: response.headers, body };
  } catch {
    return null;
  } finally {
    last = Date.now();
  }
}

const retries = 2;
const retryable = (response: Response) =>
  response.status === 429 || response.status >= 500;

/**
 * The backoff before retry `attempt`: 30 s, then 60 s, or as long as the
 * server's Retry-After asks (at most 15 minutes).
 */
function backoff({
  attempt,
  response,
}: {
  attempt: number;
  response: Response | null;
}) {
  const retryAfter = Number(response?.headers.get('retry-after') ?? 0);
  return Math.max(30_000 * 2 ** attempt, Math.min(retryAfter, 900) * 1000);
}

/**
 * Fetches one approved URL politely and returns its status, headers and body,
 * retrying a 429, a 5xx or a dropped connection at most twice.
 */
export async function politeFetch(url: string, query?: GraphqlQuery) {
  assertApproved({ url, query });
  for (let attempt = 0; ; attempt++) {
    const response = await request({ url, query });
    if (response && (!retryable(response) || attempt === retries))
      return response;
    if (attempt === retries)
      throw new Error(
        `The connection dropped for ${url} ${retries + 1} times.`,
      );
    process.stderr.write(
      `${response?.status ?? 'dropped connection'} for ${url}; retrying\n`,
    );
    await sleep(backoff({ attempt, response }));
  }
}
