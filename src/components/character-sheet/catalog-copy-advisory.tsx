/**
 * The original of an edited copy changed. The name comes only from the
 * current advisory read; the copy is never refreshed from it.
 */
export function CatalogCopyAdvisory({
  originalName,
}: {
  originalName: string;
}) {
  return (
    <p className="text-xs [overflow-wrap:anywhere] text-amber-300">
      The original “{originalName}” has changed. Your copy is unchanged.
    </p>
  );
}
