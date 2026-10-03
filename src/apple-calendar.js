import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const SERVICE = 'com.harnessSchedule.apple-calendar';

export class AppleCalendarCredentialStore {
  async load() {
    try {
      const { stdout } = await execFileAsync('/usr/bin/security', ['find-generic-password', '-s', SERVICE, '-a', 'default', '-w']);
      const value = JSON.parse(stdout);
      if (!value?.username || !value?.password || !value?.calendarUrl) throw new Error('invalid');
      return value;
    } catch { return null; }
  }
  async save(value) {
    await execFileAsync('/usr/bin/security', ['add-generic-password', '-U', '-s', SERVICE, '-a', 'default', '-w', JSON.stringify(value)]);
  }
}

const xml = (property) => `<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop>${property === 'calendar-home-set' ? '<c:calendar-home-set/>' : `<d:${property}/>`}</d:prop></d:propfind>`;
const href = (body, property) => {
  const block = body.match(new RegExp(`<[^>]*${property}[^>]*>[\\s\\S]*?<[^>]*href[^>]*>([^<]+)`, 'i'));
  return block?.[1]?.trim();
};
const absolute = (path, base) => new URL(path, base).toString();

async function propfind(url, body, depth, authorization, fetchImpl) {
  const response = await fetchImpl(url, { method: 'PROPFIND', headers: { authorization, depth: String(depth), 'content-type': 'application/xml; charset=utf-8' }, body });
  if (!response.ok && response.status !== 207) throw new Error(`iCloud CalDAV discovery failed (${response.status}). Verify the Apple Account and app-specific password.`);
  return response.text();
}

export async function discoverICloudCalendars({ username, password, fetchImpl = fetch }) {
  const root = 'https://caldav.icloud.com/';
  const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  const principalXml = await propfind(root, xml('current-user-principal'), 0, authorization, fetchImpl);
  const principal = href(principalXml, 'current-user-principal');
  if (!principal) throw new Error('iCloud did not provide a CalDAV principal.');
  const homeXml = await propfind(absolute(principal, root), xml('calendar-home-set'), 0, authorization, fetchImpl);
  const home = href(homeXml, 'calendar-home-set');
  if (!home) throw new Error('iCloud did not provide a calendar home set.');
  const calendarsXml = await propfind(absolute(home, root), '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/><d:resourcetype/></d:prop></d:propfind>', 1, authorization, fetchImpl);
  return [...calendarsXml.matchAll(/<[^>]*response[^>]*>([\s\S]*?)<\/[^>]*response>/gi)].map((match) => {
    const body = match[1];
    if (!/calendar/i.test(body)) return null;
    const path = body.match(/<[^>]*href[^>]*>([^<]+)<\/[^>]*href>/i)?.[1]?.trim();
    const name = body.match(/<[^>]*displayname[^>]*>([^<]*)<\/[^>]*displayname>/i)?.[1]?.trim() || 'Unnamed calendar';
    return path ? { name, calendarUrl: absolute(path, root) } : null;
  }).filter(Boolean);
}
