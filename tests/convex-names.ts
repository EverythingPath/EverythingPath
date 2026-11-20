import {
  getFunctionName,
  type FunctionReference,
  type FunctionType,
} from 'convex/server';

type Reference = FunctionReference<FunctionType>;
type FunctionName = `${string}:${string}`;

/**
 * Names Convex functions inside mocked `convex/react` and
 * `@tanstack/react-query` hooks. Don't mock `@convex/_generated/api`: it is
 * `anyApi` at runtime, so every path resolves, including functions a test
 * never lists. Give short names to the functions a test cares about, typed
 * against the real `api`; a reference or a `convexQuery` key string matches
 * by `getFunctionName`, and any other function keeps its Convex name, such as
 * `characterSheet:read`.
 */
export function convexNames<const Name extends string>(
  names: Record<Name, Reference>,
) {
  const byFunction = new Map<string, Name>();
  for (const name of Object.keys(names) as Name[])
    byFunction.set(getFunctionName(names[name]), name);
  return (reference: Reference | string): Name | FunctionName => {
    const functionName = (
      typeof reference === 'string' ? reference : getFunctionName(reference)
    ) as FunctionName;
    return byFunction.get(functionName) ?? functionName;
  };
}
