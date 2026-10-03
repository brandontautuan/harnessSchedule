import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readDesktopOAuthCredentials, GoogleAuthorizationError } from '../src/google-oauth.js';

test('accepts Desktop app credentials without returning the source document', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'harness-google-oauth-'));
  const path = join(directory, 'credentials with spaces.json');
  await writeFile(path, JSON.stringify({ installed: { client_id: 'client-id', client_secret: 'client-secret' } }));
  assert.deepEqual(await readDesktopOAuthCredentials(path), { clientId: 'client-id', clientSecret: 'client-secret' });
});

test('rejects web OAuth client credentials', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'harness-google-oauth-'));
  const path = join(directory, 'web.json');
  await writeFile(path, JSON.stringify({ web: { client_id: 'client-id', client_secret: 'client-secret' } }));
  await assert.rejects(() => readDesktopOAuthCredentials(path), (error) => error instanceof GoogleAuthorizationError && error.code === 'credentials_not_desktop');
});
