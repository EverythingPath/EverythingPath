// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  pinComment,
  regeneratePin,
  scopeChanges,
  type ScopeRevision,
} from '../scripts/orchestration/prep-regen';

// The shape of tests/catalog/launch-document.test.ts around its CLI pin.
function pinFile(comments: string[], identity: string, outstanding: number) {
  return [
    "it('exposes the preserved inventory identity', () => {",
    "  const output = '';",
    ...comments.map((line) => `  // ${line}`),
    '  expect(JSON.parse(output)).toEqual({',
    "    version: 'campaign-mvp-v1',",
    '    identity:',
    `      '${identity}',`,
    `    outstandingRequirements: ${outstanding},`,
    '  });',
    '}, 70_000);',
    '',
  ].join('\n');
}
const identity = (digit: string) => `sha256:${digit.repeat(64)}`;

describe('pinComment', () => {
  const waveBase = pinFile(['#780 (96583).'], identity('1'), 96583);

  it('is the comment lines the wave added just above the pin', () => {
    const wave = pinFile(
      ['#780 (96583).', 'Wave CL2 re-assesses 48', '(96583 - 46).'],
      identity('2'),
      96537,
    );
    expect(pinComment(waveBase, wave)).toBe(
      '  // Wave CL2 re-assesses 48\n  // (96583 - 46).\n',
    );
  });

  it('is empty when the wave changed only the pinned values', () => {
    expect(
      pinComment(waveBase, pinFile(['#780 (96583).'], identity('2'), 1)),
    ).toBe('');
  });

  it('refuses a wave that changed the file outside its pin', () => {
    const edited = pinFile(['#780 (96583).'], identity('1'), 96583).replace(
      "const output = '';",
      "const output = 'x';",
    );
    expect(() => pinComment(waveBase, edited)).toThrow(
      /outside its pinned values and the comment above them\. Generated launch artifacts are never hand-merged: repair the inputs or the generator and regenerate them, or escalate\./,
    );
    const reworded = pinFile(['#780 (96584).'], identity('1'), 96583);
    expect(() => pinComment(waveBase, reworded)).toThrow(/outside/);
    const code = pinFile(['#780 (96583).'], identity('1'), 96583).replace(
      '  expect(JSON',
      '  const extra = 1;\n  expect(JSON',
    );
    expect(() => pinComment(waveBase, code)).toThrow(/outside/);
  });

  it('refuses a file without exactly one pin', () => {
    expect(() => pinComment(waveBase, 'no pin\n')).toThrow(/one CLI pin/);
  });
});

describe('regeneratePin', () => {
  const summary = {
    version: 'campaign-mvp-v1',
    identity: identity('3'),
    outstandingRequirements: 96537,
  };

  it("pins the regenerated summary under the base's comments and the wave's", async () => {
    const base = pinFile(
      ['#772 (96600).', '#780 (96583).'],
      identity('1'),
      96583,
    );
    expect(
      await regeneratePin({
        base,
        comment: '  // Wave CL2 (96583 - 46).\n',
        summary,
      }),
    ).toBe(
      pinFile(
        ['#772 (96600).', '#780 (96583).', 'Wave CL2 (96583 - 46).'],
        identity('3'),
        96537,
      ),
    );
  });

  it('keeps a comment the base already carries once', async () => {
    const base = pinFile(['#780 (96583).', 'Wave CL2.'], identity('1'), 1);
    expect(
      await regeneratePin({ base, comment: '  // Wave CL2.\n', summary }),
    ).toBe(pinFile(['#780 (96583).', 'Wave CL2.'], identity('3'), 96537));
  });
});

describe('scopeChanges', () => {
  const revision = (
    documents: Record<string, unknown>,
    authority: Record<string, unknown> = { noticeAuthoritySha256: 'a' },
  ): ScopeRevision => ({
    documents: Object.fromEntries(
      Object.entries({ ...documents, authority }).map(([name, value]) => [
        name,
        JSON.stringify(value),
      ]),
    ),
    records: undefined,
  });
  const authored = {
    advanced: [1],
    checkpoints: [2],
    companions: [3],
    core: [4],
  };

  it('accepts a wave that moved only the notice authority hash', async () => {
    expect(
      await scopeChanges(
        revision(authored),
        revision(authored, { noticeAuthoritySha256: 'b' }),
      ),
    ).toEqual([]);
  });

  it('names each authored scope document whose content the wave changed', async () => {
    expect(
      await scopeChanges(
        revision(authored),
        revision(
          { ...authored, core: [4, 5] },
          { noticeAuthoritySha256: 'b', fingerprint: 'new' },
        ),
      ),
    ).toEqual(['campaign-mvp-v1.authority.json', 'campaign-mvp-v1.core.json']);
  });

  it('counts a scope document the wave added or removed as a change', async () => {
    const { advanced: _, ...rest } = authored;
    expect(await scopeChanges(revision(authored), revision(rest))).toEqual([
      'campaign-mvp-v1.advanced.json',
    ]);
  });
});
