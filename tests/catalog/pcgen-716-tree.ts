import { pcgenPin } from '../../scripts/catalog/inventory';
import { readPcgenTree } from '../../scripts/catalog/pcgen/lst';
import { pcgen716Files } from '../fixtures/pcgen-716/files';
import { materializePinnedTree } from './pinned-sources';

/** Reads #716 P3's pinned PCGen inputs (`pcgen716Files`) as one PCGen data folder. */
export async function readPcgen716Tree() {
  const materialized = await materializePinnedTree(
    pcgen716Files.map((path) => `pcgen/${pcgenPin.directory}/${path}`),
  );
  try {
    return await readPcgenTree(materialized.pcgenPath);
  } finally {
    await materialized.dispose();
  }
}

/** Reads pinned PCGen inputs, paths under `pcgenPin.directory`, as one PCGen data folder. */
export async function readPcgenFixtureTree(files: readonly string[]) {
  const materialized = await materializePinnedTree(
    files.map((path) => `pcgen/${pcgenPin.directory}/${path}`),
  );
  try {
    return await readPcgenTree(materialized.pcgenPath);
  } finally {
    await materialized.dispose();
  }
}
