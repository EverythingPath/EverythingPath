import { execFileSync } from 'node:child_process';

// The listing grows with the repository (about 1.3 MB at #729, mostly
// tests/fixtures); Node's default 1 MiB would kill git mid-listing.
const listingMaxBytes = 256 * 1024 * 1024;

/**
 * The repository's source files: tracked ones (including those deleted from
 * the working tree) and untracked ones git does not ignore, each once.
 */
export function listSourceFiles(root: string) {
  const listing = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: listingMaxBytes,
      // The child's stderr can echo paths or configuration; never forward it.
      stdio: ['ignore', 'pipe', 'ignore'],
    },
  );
  return [...new Set(listing.split('\0').filter(Boolean))];
}
