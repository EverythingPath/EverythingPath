/**
 * A Convex Cloud deployment's URL: https://<name>(.<region>)?.convex.cloud,
 * the plain host or a regional one such as eu-west-1, and nothing else (no
 * port, path, query, fragment or further label). Capture 1 is the name,
 * capture 2 the region. Owner decision 2026-10-16 (#753).
 */
export const convexDeploymentUrlPattern =
  /^https:\/\/([a-z0-9-]+)(?:\.([a-z]{2}-[a-z]+-[0-9]+))?\.convex\.cloud$/;

/** Whether `url` is the URL of the deployment called `name`. */
export function isNamedDeploymentUrl({
  name,
  url,
}: {
  name: string;
  url: string;
}) {
  return convexDeploymentUrlPattern.exec(url)?.[1] === name;
}
