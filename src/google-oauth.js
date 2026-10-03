import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { OAuth2Client } from 'google-auth-library';

const execFileAsync = promisify(execFile);
export const CALENDAR_EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

export class GoogleAuthorizationError extends Error {
  constructor(message, code = 'authorization_failed') { super(message); this.code = code; }
}

export async function readDesktopOAuthCredentials(path) {
  let document;
  try { document = JSON.parse(await readFile(path, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') throw new GoogleAuthorizationError(`Credentials file was not found: ${path}`, 'credentials_file_missing');
    throw new GoogleAuthorizationError('Credentials file is not valid JSON.', 'credentials_file_invalid');
  }
  const credentials = document?.installed;
  if (!credentials || document.web || typeof credentials.client_id !== 'string' || typeof credentials.client_secret !== 'string') {
    throw new GoogleAuthorizationError('Credentials must be a Google OAuth Desktop app JSON file (with an "installed" entry). Create a Desktop app OAuth client in Google Cloud.', 'credentials_not_desktop');
  }
  return { clientId: credentials.client_id, clientSecret: credentials.client_secret };
}

export async function connectGoogleCalendar({ credentialsPath, credentialStore, timeoutMs = 300_000, openBrowser = openDefaultBrowser }) {
  const credentials = await readDesktopOAuthCredentials(credentialsPath);
  const callback = await startCallbackServer(timeoutMs);
  const client = new OAuth2Client(credentials.clientId, credentials.clientSecret, callback.redirectUri);
  try {
    const authorizationUrl = client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: [CALENDAR_EVENTS_SCOPE] });
    await openBrowser(authorizationUrl);
    const code = await callback.waitForCode();
    const { tokens } = await client.getToken({ code, redirect_uri: callback.redirectUri });
    if (!tokens.refresh_token) throw new GoogleAuthorizationError('Google did not return a refresh token. Remove this app from your Google Account permissions, then run the connect command again and approve access.', 'refresh_token_missing');
    const storage = await credentialStore.save({ clientId: credentials.clientId, clientSecret: credentials.clientSecret, tokens, connectedAt: new Date().toISOString() });
    client.setCredentials(tokens);
    return { client, storage, refreshTokenStored: true };
  } catch (error) {
    if (error instanceof GoogleAuthorizationError) throw error;
    if (/access_denied/i.test(error.message)) throw new GoogleAuthorizationError('Google access was denied. Run the command again and approve Calendar access.', 'consent_denied');
    throw new GoogleAuthorizationError('Google authorization did not complete. Confirm the Calendar API is enabled and that this Google account is listed as a test user while the OAuth app is in Testing.', 'authorization_failed');
  } finally { callback.close(); }
}

async function startCallbackServer(timeoutMs) {
  let settle;
  const result = new Promise((resolve, reject) => { settle = { resolve, reject }; });
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname !== '/oauth2callback') { response.writeHead(404); return response.end('Not found'); }
    if (url.searchParams.get('error')) {
      response.writeHead(200, { 'content-type': 'text/html' }); response.end('<h1>Google Calendar was not connected.</h1><p>You can close this window.</p>');
      return settle.reject(new GoogleAuthorizationError('Google access was denied. Run the command again and approve Calendar access.', 'consent_denied'));
    }
    const code = url.searchParams.get('code');
    if (!code) { response.writeHead(400); return response.end('Authorization response did not contain a code.'); }
    response.writeHead(200, { 'content-type': 'text/html' }); response.end('<h1>Google Calendar connected.</h1><p>You can close this window and return to the terminal.</p>');
    settle.resolve(code);
  });
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const timer = setTimeout(() => settle.reject(new GoogleAuthorizationError('Timed out waiting for Google authorization. Run the command again and complete approval within five minutes.', 'callback_timeout')), timeoutMs);
  return {
    redirectUri: `http://127.0.0.1:${address.port}/oauth2callback`,
    waitForCode: () => result.finally(() => clearTimeout(timer)),
    close: () => { clearTimeout(timer); server.close(); }
  };
}

async function openDefaultBrowser(url) {
  if (process.platform !== 'darwin') throw new GoogleAuthorizationError(`Open this URL in a browser to continue: ${url}`, 'browser_unavailable');
  try { await execFileAsync('open', [url]); }
  catch { throw new GoogleAuthorizationError('Could not open your browser. Run the command from an interactive macOS session and try again.', 'browser_unavailable'); }
}
