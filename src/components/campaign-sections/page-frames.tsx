import type { ReactNode } from 'react';

// The outer frames of the Militia and Characters & officers pages, shared
// with their route fallbacks so the skeleton and the page sit in the same
// box and nothing jumps when one replaces the other. They live apart from
// the sections because those pull in Convex and the correction hooks.

export function MilitiaPageFrame({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <h1 className="text-2xl">Militia</h1>
      {children}
    </main>
  );
}

export function CharactersPageFrame({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <h1 className="sr-only">Characters &amp; officers</h1>
      {children}
    </main>
  );
}
