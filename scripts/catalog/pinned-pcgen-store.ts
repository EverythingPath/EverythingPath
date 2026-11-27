import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pcgenPin } from './inventory.ts';

/**
 * Where the pinned store keeps its copy of PCGen's data folder
 * (`tests/fixtures/pinned/README.md`), byte-identical to the pin: the one
 * resolver the Section 15 check and the #227 gate's line read share.
 */
/** The copy's folder, from a checkout's root. */
export const pinnedPcgenDirectory = `tests/fixtures/pinned/pcgen/${pcgenPin.directory}`;
/** A PCGen file's path in the copy, from a checkout's root. */
export const pinnedPcgenListPath = (file: string) =>
  `${pinnedPcgenDirectory}/${file}`;
/** The copy in the checkout at `root`. */
export const pinnedPcgenRootAt = (root: string) =>
  join(root, `${pinnedPcgenDirectory}/`);
/**
 * This checkout's root, from the module's path, not a URL object: a jsdom
 * test's global URL is not Node's, and fileURLToPath refuses it.
 */
export const thisCheckout = join(
  dirname(fileURLToPath(import.meta.url)),
  '../..',
);
/** This checkout's copy. */
export const pinnedPcgenRoot = pinnedPcgenRootAt(thisCheckout);
