import { execFileSync } from 'node:child_process';

/**
 * Each blob's bytes as UTF-8 text, by blob id, from one `git cat-file
 * --batch` (`<id> <type> <size>\n<bytes>\n` per blob). A blob Git reports
 * missing is left out.
 */
export function readBlobTexts(
  root: string,
  blobs: readonly string[],
): Map<string, string> {
  const texts = new Map<string, string>();
  if (!blobs.length) return texts;
  const output = execFileSync('git', ['cat-file', '--batch'], {
    cwd: root,
    input: blobs.map((blob) => `${blob}\n`).join(''),
    maxBuffer: 1 << 28,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let at = 0;
  for (const blob of blobs) {
    const header = output.indexOf(0x0a, at);
    const [, type, size] = output.subarray(at, header).toString().split(' ');
    if (type === 'missing' || size === undefined) {
      at = header + 1;
      continue;
    }
    const end = header + 1 + Number(size);
    texts.set(blob, output.subarray(header + 1, end).toString('utf8'));
    at = end + 1;
  }
  return texts;
}
