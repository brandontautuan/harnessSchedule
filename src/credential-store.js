import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const SERVICE = 'com.harnessSchedule.google-calendar';
const ACCOUNT = 'default';

export class CredentialStoreError extends Error {}

export class GoogleCredentialStore {
  constructor({ keychain = process.platform === 'darwin', fallbackPath = join(homedir(), '.config', 'harness-schedule', 'google-calendar-oauth.json') } = {}) {
    this.keychain = keychain;
    this.fallbackPath = fallbackPath;
  }

  async load() {
    if (this.keychain) {
      try {
        const { stdout } = await execFileAsync('/usr/bin/security', ['find-generic-password', '-s', SERVICE, '-a', ACCOUNT, '-w'], { maxBuffer: 1024 * 1024 });
        return parseCredentialRecord(stdout);
      } catch (error) {
        if (!isMissingKeychainItem(error)) throw new CredentialStoreError('Could not read Google Calendar credentials from macOS Keychain');
      }
    }
    try { return parseCredentialRecord(await readFile(this.fallbackPath, 'utf8')); }
    catch (error) {
      if (error.code === 'ENOENT') return null;
      throw new CredentialStoreError('Could not read the local Google Calendar credential store');
    }
  }

  async save(record) {
    const json = JSON.stringify(record);
    if (this.keychain) {
      try {
        // `security` writes directly to Keychain. The value is never logged.
        await execFileAsync('/usr/bin/security', ['add-generic-password', '-U', '-s', SERVICE, '-a', ACCOUNT, '-w', json], { maxBuffer: 1024 * 1024 });
        return { location: 'macOS Keychain' };
      } catch {
        // Fall through to the owner-only local store if Keychain is unavailable.
      }
    }
    await mkdir(dirname(this.fallbackPath), { recursive: true, mode: 0o700 });
    await writeFile(this.fallbackPath, json, { mode: 0o600 });
    return { location: 'owner-only local credential file' };
  }
}

function isMissingKeychainItem(error) { return error?.code === 44 || /could not be found/i.test(error?.stderr || ''); }
function parseCredentialRecord(json) {
  try {
    const record = JSON.parse(json);
    if (!record?.clientId || !record?.clientSecret || !record?.tokens?.refresh_token) throw new Error('incomplete');
    return record;
  } catch { throw new CredentialStoreError('Saved Google Calendar credentials are invalid. Run the connect command again.'); }
}
