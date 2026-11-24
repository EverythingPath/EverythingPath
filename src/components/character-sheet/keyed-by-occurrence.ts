/**
 * Keys for a list whose words may repeat, such as an evolution taken twice:
 * each entry's words with how many like it come before.
 */
export function keyedByOccurrence<T>(
  items: readonly T[],
  words: (item: T) => string,
) {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const text = words(item);
    const count = seen.get(text) ?? 0;
    seen.set(text, count + 1);
    return { key: `${text}/${count}`, item };
  });
}
