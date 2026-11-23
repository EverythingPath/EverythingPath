import type { Section15Registry } from './admission-schema.ts';

export function createNoticeIndex({
  registry,
}: {
  registry: Section15Registry;
}) {
  const index = new Map<string, Section15Registry[string] | undefined>();
  for (const [code, notice] of Object.entries(registry)) {
    for (const identifier of new Set([code, ...notice.aliases])) {
      index.set(identifier, index.has(identifier) ? undefined : notice);
    }
  }
  return index;
}

export function resolveNotice({
  registry,
  code,
  index = createNoticeIndex({ registry }),
}: {
  registry: Section15Registry;
  code: string;
  index?: ReturnType<typeof createNoticeIndex>;
}) {
  return index.get(code);
}
