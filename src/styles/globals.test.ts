import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { expect, test } from 'vitest';

// The compiled stylesheet, scanning every component (the shared primitives
// that use the enter/exit animations and every screen's transitions). This
// is the seam the browser actually receives.
async function compiledStyles() {
  const root = join(__dirname, '..', '..');
  const source = readFileSync(join(__dirname, 'globals.css'), 'utf8').replace(
    "@import 'tailwindcss';",
    `@import 'tailwindcss' source(none);\n@source "${join(root, 'src/components')}";`,
  );
  const result = await postcss([tailwind({ base: root })]).process(source, {
    from: join(__dirname, 'globals.css'),
  });
  return result.css;
}

function keyframeBlocks(css: string) {
  return [...css.matchAll(/@keyframes ([\w-]+)\s*\{[\s\S]*?\}\s*\}/g)].map(
    (match) => ({ name: match[1]!, body: match[0] }),
  );
}

// WebKit's Skia compositor crashes when an animation interpolates `filter`
// into the element's own `filter: none`, which tw-animate-css's default
// enter/exit keyframes do even for fade/zoom/slide-only surfaces (#151,
// character-ledger WebKit failure). The app must never emit such keyframes
// while keeping the fade/zoom/slide animations themselves.
test('[styles.animation] no emitted keyframes animate filter, and enter/exit animations keep opacity and transform', async () => {
  const css = await compiledStyles();
  const blocks = keyframeBlocks(css);
  expect(blocks.map((block) => block.name)).toEqual(
    expect.arrayContaining(['enter-unfiltered', 'exit-unfiltered']),
  );
  expect(blocks.filter((block) => /filter\s*:/.test(block.body))).toEqual([]);
  const enter = blocks.find((block) => block.name === 'enter-unfiltered')!;
  const exit = blocks.find((block) => block.name === 'exit-unfiltered')!;
  for (const block of [enter, exit]) {
    expect(block.body).toMatch(/opacity:\s*var\(--tw-(enter|exit)-opacity/);
    expect(block.body).toMatch(/transform:\s*translate3d\(/);
    expect(block.body).toMatch(/scale3d\(/);
  }
  // The animate-in/animate-out utilities the primitives use (inlined by the
  // theme) resolve to those keyframes, never to the library's filtered
  // `enter`/`exit`, which must not be emitted at all.
  expect(css).toMatch(/animate-in\s*\{[^}]*animation:\s*enter-unfiltered\s/);
  expect(css).toMatch(/animate-out\s*\{[^}]*animation:\s*exit-unfiltered\s/);
  expect(css).not.toMatch(/animation:\s*enter\s/);
  expect(css).not.toMatch(/animation:\s*exit\s/);
  expect(blocks.some((block) => block.name === 'enter')).toBe(false);
  expect(blocks.some((block) => block.name === 'exit')).toBe(false);
});

// The same fault applies to CSS transitions: a state whose filter list is
// non-empty transitioning to `filter: none` (the ledger shell's former
// closed-state blur/brightness). No emitted rule may transition `filter`
// explicitly, and the shorthand transitions the app declares itself must
// name their properties instead of `all` wherever a filter is involved.
test('[styles.transition] no emitted rule transitions filter', async () => {
  const css = await compiledStyles();
  const explicit = [
    ...css.matchAll(/transition(?:-property)?\s*:\s*([^;]*filter[^;]*);/g),
  ]
    .map((match) => match[1]!.replace(/\s+/g, ' '))
    // Tailwind's stock `.transition` list names filter; it is inert as long
    // as no emitted utility ever sets a filter (asserted below).
    .filter((list) => !list.startsWith('color, background-color'));
  expect(explicit).toEqual([]);
  const filterSetters = [
    ...css.matchAll(
      /\.(blur|brightness|contrast|grayscale|hue-rotate|invert|saturate|sepia|drop-shadow)(-[^\s{]*)?\s*\{/g,
    ),
  ].map((match) => match[0]);
  expect(filterSetters).toEqual([]);
  expect(css).toMatch(
    /\.corner-brackets::before[\s\S]*?transition:\s*background-size/,
  );
});

// The document scrolls on <html>, so a body that hides its overflow becomes
// a scroll container as tall as the page: every sticky bar inside (the phone
// bottom bar, Setup's footer) then sticks to the end of the page instead of
// the viewport (#198). The body clips instead, also while Radix's scroll
// lock is on, which would otherwise set it to hidden.
test('[styles.sticky] the body clips its overflow and never becomes a scroll container', async () => {
  const css = await compiledStyles();
  const body = /body\.scanlines\s*\{([^}]*)\}/.exec(css)?.[1];
  expect(body).toMatch(/overflow:\s*clip/);
  expect(css).toMatch(
    /html body\[data-scroll-locked\]\s*\{\s*overflow:\s*clip\s*!important/,
  );
  expect(css).toMatch(/html\s*\{[^}]*overflow-y:\s*scroll/);
});

// Tailwind's automatic source detection would otherwise read test titles,
// fixtures, docs and rules data as class candidates: in #408 a test titled
// with "blur" emitted a real `.blur` utility. Each candidate below appears
// only in this file or in a probe file written for this test, so compiling
// the real stylesheet exactly as the app does must emit none of them.
const probes = [
  { file: null, candidate: 'tracking-[0.4242em]' },
  { file: 'docs/tailwind-source-probe.md', candidate: 'tracking-[0.4243em]' },
  {
    file: 'convex/data/tailwind-source-probe.js',
    candidate: 'tracking-[0.4244em]',
  },
];

test('[styles.sources] tests, docs and Convex data are never scanned for utility candidates', async () => {
  const root = join(__dirname, '..', '..');
  const from = join(__dirname, 'globals.css');
  const written = probes.flatMap(({ file }) =>
    file ? [join(root, file)] : [],
  );
  probes.forEach(({ file, candidate }) => {
    if (file) writeFileSync(join(root, file), `'${candidate}'\n`);
  });
  try {
    // The plugin caches its scanner per file, base and `optimize`; an
    // explicit `optimize` keeps this compile apart from compiledStyles()'.
    const result = await postcss([
      tailwind({ base: root, optimize: false }),
    ]).process(readFileSync(from, 'utf8'), { from });
    expect(result.css).toMatch(/\.corner-brackets/);
    // Emitted, a selector would read `.tracking-\[0\.4242em\]`.
    const emitted = probes.filter(({ candidate }) =>
      result.css.includes(candidate.slice(-8, -1)),
    );
    expect(emitted).toEqual([]);
  } finally {
    for (const file of written) rmSync(file, { force: true });
  }
});

test('[styles.setup] the pinned Setup footer reserves clearance on both document and rail scrolling', async () => {
  const css = await compiledStyles();
  const selectors: string[] = [];
  postcss.parse(css).walkRules((rule) => {
    if (
      rule.nodes.some(
        (node) =>
          node.type === 'decl' &&
          node.prop === 'scroll-padding-bottom' &&
          node.value === '5rem',
      )
    )
      selectors.push(...rule.selectors);
  });
  expect(selectors).toEqual(
    expect.arrayContaining([
      "html:has([data-setup-layout='wide'])",
      "[data-rail-host]:has([data-setup-layout='wide'])",
    ]),
  );
});
