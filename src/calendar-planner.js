export class ScheduleParseError extends Error {}

export function parseTomorrowSchedule(text, { timezone = 'America/Los_Angeles', now = new Date() } = {}) {
  const match = text.match(/^schedule\s+(.+?)\s+tomorrow\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s+for\s+(\d+)\s*(minutes?|mins?|hours?|hrs?)$/i);
  if (!match) throw new ScheduleParseError('Use: schedule <title> tomorrow at <time> am/pm for <duration>. Example: schedule Gym tomorrow at 9 AM for 1 hour');
  const [, rawTitle, rawHour, rawMinute = '0', meridiem, rawDuration, unit] = match;
  let hour = Number(rawHour); const minute = Number(rawMinute);
  if (hour < 1 || hour > 12 || minute > 59) throw new ScheduleParseError('That time is invalid.');
  hour = hour % 12 + (meridiem.toLowerCase() === 'pm' ? 12 : 0);
  const durationMinutes = Number(rawDuration) * (/hour|hr/i.test(unit) ? 60 : 1);
  if (durationMinutes < 5 || durationMinutes > 12 * 60) throw new ScheduleParseError('Duration must be between 5 minutes and 12 hours.');
  const tomorrow = localTomorrow(now, timezone);
  const offset = offsetFor(tomorrow, hour, minute, timezone);
  const start = `${tomorrow}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${offset}`;
  const end = new Date(new Date(start).getTime() + durationMinutes * 60_000).toISOString();
  return { title: rawTitle.trim(), durationMinutes, event: { title: rawTitle.trim(), description: '', location: '', time: { kind: 'timed', start, end, timezone } } };
}

export class CalendarPlanner {
  constructor({ google, timezone = 'America/Los_Angeles', now = () => new Date() }) { Object.assign(this, { google, timezone, now }); }
  async propose(text) {
    const proposal = parseTomorrowSchedule(text, { timezone: this.timezone, now: this.now() });
    const events = await this.google.listBetween(proposal.event.time.start, proposal.event.time.end);
    const conflict = events.some((item) => overlaps(proposal.event.time.start, proposal.event.time.end, item));
    return { ...proposal, conflict };
  }
}

function localTomorrow(now, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (kind) => parts.find((part) => part.type === kind).value;
  const localMidday = new Date(`${get('year')}-${get('month')}-${get('day')}T12:00:00Z`);
  localMidday.setUTCDate(localMidday.getUTCDate() + 1);
  return localMidday.toISOString().slice(0, 10);
}

function offsetFor(date, hour, minute, timezone) {
  const sample = new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`);
  const name = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' }).formatToParts(sample).find((part) => part.type === 'timeZoneName').value;
  const match = name.match(/^GMT([+-]\d{2}):(\d{2})$/);
  if (!match) throw new ScheduleParseError('Could not resolve the local timezone offset.');
  return `${match[1]}:${match[2]}`;
}

function overlaps(start, end, item) {
  const eventStart = item.start?.dateTime || `${item.start?.date || ''}T00:00:00Z`;
  const eventEnd = item.end?.dateTime || `${item.end?.date || ''}T00:00:00Z`;
  return new Date(eventStart) < new Date(end) && new Date(eventEnd) > new Date(start);
}
