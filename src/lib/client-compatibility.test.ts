import { expect, test } from 'vitest';
import {
  DEVELOPMENT_FRONTEND_BUILD,
  frontendBuildIdentity,
} from './client-compatibility';
import manifest from '../../package.json';

test('a Netlify build is identified by its commit and any other build as a development build, which nothing else can claim', () => {
  const commit = '0123456789abcdef0123456789abcdef01234567';
  expect(frontendBuildIdentity(commit)).toEqual({ frontendBuild: commit });
  expect(frontendBuildIdentity(undefined)).toEqual({
    frontendBuild: DEVELOPMENT_FRONTEND_BUILD,
  });
  expect(frontendBuildIdentity(' ')).toEqual({ frontendBuild: 'dev' });
  expect(() => frontendBuildIdentity('main')).toThrow('Invalid');
});

test('the web build writes the identity file before Next builds the site', () => {
  expect(manifest.scripts['build:web']).toBe(
    'node --import tsx scripts/write-build-identity.ts && next build',
  );
});
