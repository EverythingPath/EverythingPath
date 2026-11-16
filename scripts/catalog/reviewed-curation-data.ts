import { parseCuration } from './curation.ts';
import curationData from './reviewed-curation.json';

/**
 * The reviewed curation overlay, typed by its schema rather than by JSON
 * inference: the type-aware lint's project service skips the contents of
 * non-TypeScript files over 4 MiB, so a direct import loses its type once the
 * overlay outgrows that. Import the overlay from here, never the JSON.
 */
export const reviewedCuration = parseCuration(curationData);
