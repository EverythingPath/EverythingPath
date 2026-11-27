type QueryOptions = {
  queryKey: readonly [string, string, Record<string, unknown> | 'skip'];
};

/** Data-only reads for form tests; cache behavior uses queryCacheFixture. */
export function queryDataMock(
  read: (name: string, args: Record<string, unknown>) => unknown,
) {
  return {
    useQuery: ({ queryKey: [, name, args] }: QueryOptions) => ({
      data: args === 'skip' ? undefined : read(name, args),
    }),
  };
}
