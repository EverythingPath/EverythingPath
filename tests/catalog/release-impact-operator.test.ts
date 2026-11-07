// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { runCatalogReleaseOperator } from '../../scripts/catalog/release-operator';
import { isObject } from '../../src/lib/catalog/release-schema';

it.each([false, true])(
  'reconciles through the installed administrative client and reports discovery failures (discovery error: %s)',
  async (discoveryFails) => {
    const directory = await mkdtemp(join(tmpdir(), 'catalog-impact-operator-'));
    const keyFile = join(directory, 'admin.key');
    await writeFile(keyFile, 'synthetic-admin-key');
    const requests: { path: string; args: Record<string, unknown> }[] = [];
    let registered = false;
    let isDiscoveryComplete = false;
    let pendingCount = 1;
    vi.stubGlobal('fetch', async (_url: unknown, options: RequestInit) => {
      if (typeof options.body !== 'string')
        throw new Error('Expected HTTP JSON body');
      const body: unknown = JSON.parse(options.body);
      if (
        !isObject(body) ||
        typeof body.path !== 'string' ||
        !isObject(body.args)
      )
        throw new Error('Invalid administrative request');
      requests.push({ path: body.path, args: body.args });
      let value: unknown;
      switch (body.path) {
        case 'catalogReleaseImpact:start':
          registered = true;
          value = 'candidate-run';
          break;
        case 'catalogReleaseImpact:status':
          value = {
            isDiscoveryComplete,
            pendingCount,
            failedCount: discoveryFails ? 1 : 0,
            isReady:
              !discoveryFails && isDiscoveryComplete && pendingCount === 0,
            hasTruncatedCounts: pendingCount > 0,
            ...(discoveryFails
              ? {
                  discoveryError:
                    'Resource inventory exceeds representative limit',
                }
              : {}),
          };
          break;
        case 'catalogReleaseImpact:discover':
          if (!registered) throw new Error('Discovery ran before registration');
          isDiscoveryComplete = true;
          value = true;
          break;
        case 'catalogReleaseImpact:inspectWork':
          value = {
            page: [{ characterId: 'character-vessa' }],
            isDone: true,
            continueCursor: '',
          };
          break;
        case 'catalogReleaseImpact:evaluate':
          value = {
            revision: 1,
            inputFingerprint: 'inputs',
            result: {
              kind: 'ready',
              facts: {
                characterId: 'character-vessa',
                level: 1,
                strength: 10,
                dexterity: 10,
                constitution: 10,
                intelligence: 18,
                wisdom: 10,
                charisma: 10,
                isActive: true,
              },
              hasFactsChanged: false,
              reasons: ['resource:builtin:casting-tables'],
              castingEvidence: [
                { classTag: 'wizard', spellLevel: 1, base: 7, total: 8 },
              ],
            },
          };
          break;
        case 'catalogReleaseImpact:complete':
          pendingCount = 0;
          value = true;
          break;
        case 'catalogReleaseImpact:finish':
          value = true;
          break;
        default:
          throw new Error(`Unexpected operator endpoint: ${body.path}`);
      }
      return new Response(JSON.stringify({ status: 'success', value }));
    });
    try {
      expect(
        await runCatalogReleaseOperator({
          args: [
            'reconcile',
            '--number',
            '7',
            '--write-epoch',
            '4',
            '--max-steps',
            '3',
            '--deployment-name',
            'synthetic-preview',
            '--deployment-url',
            'https://synthetic-preview.convex.cloud',
            '--target-kind',
            'preview',
            '--admin-key-file',
            keyFile,
          ],
        }),
      ).toMatchObject(
        discoveryFails
          ? {
              stopped: 'failed',
              status: {
                isReady: false,
                hasTruncatedCounts: true,
                discoveryError:
                  'Resource inventory exceeds representative limit',
              },
            }
          : {
              stopped: 'ready',
              status: {
                isDiscoveryComplete: true,
                pendingCount: 0,
                failedCount: 0,
                isReady: true,
                hasTruncatedCounts: false,
              },
            },
      );
      expect(
        requests
          .filter((request) =>
            ['start', 'discover', 'complete'].some((endpoint) =>
              request.path.endsWith(`:${endpoint}`),
            ),
          )
          .every((request) => request.args.writeEpoch === 4),
      ).toBe(true);
      if (!discoveryFails)
        expect(
          requests.find((request) => request.path.endsWith(':inspectWork'))
            ?.args.paginationOpts,
        ).toEqual({
          cursor: null,
          numItems: 32,
          maximumRowsRead: 32,
          maximumBytesRead: 512000,
        });
      if (!discoveryFails)
        expect(
          requests.find((request) => request.path.endsWith(':complete'))?.args
            .evaluation,
        ).toMatchObject({
          result: {
            castingEvidence: [
              { classTag: 'wizard', spellLevel: 1, base: 7, total: 8 },
            ],
          },
        });
      expect(JSON.stringify(requests)).not.toContain('synthetic-admin-key');
    } finally {
      vi.unstubAllGlobals();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
