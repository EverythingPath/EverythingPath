/**
 * The deployment a Convex admin or deploy key names, by the rule the installed
 * Convex CLI applies (convex 1.45.0, `dist/esm/cli/lib/deployment.js`:
 * `deploymentTypeFromAdminKey`, `deploymentNameFromAdminKey`,
 * `isPreviewDeployKey`, `isProjectKey`): the part before the first `|` is
 * `<type>:<name>`.
 *
 * - `prod:<name>|…`, `dev:<name>|…` and `preview:<name>|…` name their kind and
 *   deployment.
 * - `<name>|…`, with no type, is a self-hosted backend's key, as the local
 *   `ep-dev-*` and `ep-e2e-*` instances issue it: a name and no kind. (The CLI
 *   reads a key without a type as production; here its kind is unknown.)
 * - Anything else names neither: a key without `|`, a project key
 *   (`project:<team>:<project>|…`), a preview deploy key
 *   (`preview:<team>:<project>|…`) or another type.
 */
export type DeploymentKeyOwner =
  | { kind: 'production' | 'development' | 'preview'; name: string }
  | { kind: 'unknown'; name: string | null };

const kindsByType = new Map<
  string,
  Extract<DeploymentKeyOwner['kind'], 'production' | 'development' | 'preview'>
>([
  ['prod', 'production'],
  ['dev', 'development'],
  ['preview', 'preview'],
]);

export function deploymentKeyOwner(key: string): DeploymentKeyOwner {
  const separator = key.indexOf('|');
  if (separator < 0) return { kind: 'unknown', name: null };
  const [type = '', name, ...rest] = key.slice(0, separator).split(':');
  if (name === undefined)
    return { kind: 'unknown', name: type === '' ? null : type };
  const kind = kindsByType.get(type);
  return kind && rest.length === 0
    ? { kind, name }
    : { kind: 'unknown', name: null };
}

/**
 * Refuses a key for another deployment than the declared target, before the
 * key is sent (#413 F6c): a key's kind and name must both be the target's, and
 * a key whose kind is unknown serves only a local target, whose instance name
 * is checked against the running backend, and then only under its own name
 * when it carries one. A refusal names the key's deployment whenever the key
 * names one, and the target (#413 F7b).
 */
export function assertKeyForTarget(
  key: string,
  target: { kind: string; name: string },
) {
  const owner = deploymentKeyOwner(key);
  const declared = `the target is ${target.kind} deployment ${target.name}`;
  if (owner.kind === 'unknown') {
    if (target.kind !== 'local')
      throw new Error(
        `The admin key ${owner.name === null ? '' : `is for deployment ${owner.name} and `}names no deployment kind, which only a local target accepts; ${declared}.`,
      );
    if (owner.name !== null && owner.name !== target.name)
      throw new Error(
        `The admin key is for deployment ${owner.name}; ${declared}.`,
      );
    return;
  }
  if (owner.kind !== target.kind || owner.name !== target.name)
    throw new Error(
      `The admin key is for ${owner.kind} deployment ${owner.name}; ${declared}.`,
    );
}
