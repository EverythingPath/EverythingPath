// Locating a directly linked audit entry's sequence ("Entry N") with the
// existing five-entry audit pages, newest first. Reads stop at the entry, at
// the oldest page, or when the caller cancels; the whole chain is never read
// at once.

export type AuditPage = {
  audit: { recordId: string; sequence: number }[];
  earlierSequence: number | null;
} | null;

export type AuditPageReader = (
  beforeSequence: number | undefined,
) => Promise<AuditPage>;

export async function locateAuditSequence(
  read: AuditPageReader,
  recordId: string,
  { from, signal }: { from?: number; signal: { cancelled: boolean } },
): Promise<number | null> {
  let before = from;
  for (;;) {
    const page = await read(before);
    if (signal.cancelled || !page) return null;
    const entry = page.audit.find((item) => item.recordId === recordId);
    if (entry) return entry.sequence;
    const next = page.earlierSequence;
    // Pages move strictly toward sequence zero; anything else ends the search.
    if (next === null || (before !== undefined && next >= before)) return null;
    before = next;
  }
}
