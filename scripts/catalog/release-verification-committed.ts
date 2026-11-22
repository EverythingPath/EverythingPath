import {
  committedVerification,
  readCommittedProjection,
} from '../mvp-status.ts';
import {
  releaseVerificationOf,
  type ReleaseVerification,
} from './release-verification.ts';

/**
 * #227 slice 4: the labels' source for a release built from this checkout,
 * run from the repository root: the committed verification projection over
 * the committed launch inventory when it is current, else stale with why, as
 * `mvp:status` reads it. Pass `document` to read another projection.
 */
export async function readCommittedReleaseVerification(
  document?: unknown,
): Promise<ReleaseVerification> {
  const { manifest, verification } = await committedVerification(
    document === undefined ? await readCommittedProjection() : document,
  );
  return releaseVerificationOf({
    inventory: manifest.rows,
    status: verification,
  });
}
