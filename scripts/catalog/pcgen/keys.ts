/** A PCGen KEY (or category name) in its case-folded form: PCGen keys ignore case. */
export type PcgenKey = string & { readonly pcgenKey: unique symbol };

/** Case-folds a KEY as PCGen compares keys. */
export function toPcgenKey(key: string): PcgenKey {
  // Safe cast: a lower-cased KEY is exactly what PcgenKey brands.
  return key.toLowerCase() as PcgenKey;
}

/** Same-key records by folded key, variants in path order. */
export type PcgenKeyIndex<T> = ReadonlyMap<PcgenKey, readonly T[]>;

/** Adds a value to the list under a key. */
export function appendTo<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
