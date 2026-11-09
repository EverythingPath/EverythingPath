export type ReleaseDependencyEdge = { from: string; to: string };

/** Old and new edges both count; a removed dependency still affects its sheet. */
export function planReleaseImpact({
  roots,
  oldEdges,
  newEdges,
  changed,
  hasCalculationChanged,
}: {
  roots: readonly string[];
  oldEdges: readonly ReleaseDependencyEdge[];
  newEdges: readonly ReleaseDependencyEdge[];
  changed: readonly string[];
  hasCalculationChanged: boolean;
}) {
  const reachable = new Set(roots);
  const edges = [...oldEdges, ...newEdges];
  const pending = [...roots];
  while (pending.length) {
    const source = pending.pop();
    for (const edge of edges)
      if (edge.from === source && !reachable.has(edge.to)) {
        reachable.add(edge.to);
        pending.push(edge.to);
      }
  }
  const reasons = [
    ...new Set(changed.filter((key) => reachable.has(key))),
  ].sort();
  if (hasCalculationChanged) reasons.unshift('calculation');
  return { isAffected: reasons.length > 0, reasons };
}
