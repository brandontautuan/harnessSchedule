import { randomUUID } from 'node:crypto';

function icalText(value = '') { return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
function icalTime(value) { return value.replace(/[-:]/g, '').replace(/\.\d+/, ''); }
function localIcalTime(value, timezone) {
  const pieces = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(value));
  const part = (type) => pieces.find((item) => item.type === type).value;
  return `${part('year')}${part('month')}${part('day')}T${part('hour')}${part('minute')}${part('second')}`;
}

export function toVCalendar(event, uid) {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dual Calendar Agent//EN', 'BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${icalTime(new Date().toISOString())}`, `DTSTART;TZID=${event.time.timezone}:${localIcalTime(event.time.start, event.time.timezone)}`, `DTEND;TZID=${event.time.timezone}:${localIcalTime(event.time.end, event.time.timezone)}`, `SUMMARY:${icalText(event.title)}`, event.description && `DESCRIPTION:${icalText(event.description)}`, event.location && `LOCATION:${icalText(event.location)}`, 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n') + '\r\n';
}

export class CalDavCalendar {
  constructor(config, fetchImpl = fetch) { this.config = config; this.fetch = fetchImpl; }
  async create(event, uid = randomUUID()) {
    const url = new URL(`${uid}.ics`, this.config.calendarUrl).toString();
    const credentials = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
    const response = await this.fetch(url, { method: 'PUT', headers: { authorization: `Basic ${credentials}`, 'content-type': 'text/calendar; charset=utf-8', 'if-none-match': '*' }, body: toVCalendar(event, uid) });
    if (!response.ok && response.status !== 201 && response.status !== 204) throw new Error(`CalDAV event creation failed (${response.status})`);
    return { providerEventId: uid, url };
  }
}
