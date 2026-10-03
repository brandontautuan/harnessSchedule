import { createHash } from 'node:crypto';

export class ValidationError extends Error {}

export function validateCreateRequest(body) {
  if (!body || typeof body !== 'object') throw new ValidationError('Body must be a JSON object');
  if (typeof body.idempotency_key !== 'string' || body.idempotency_key.length < 8 || body.idempotency_key.length > 200) {
    throw new ValidationError('idempotency_key must be a 8–200 character string');
  }
  const event = body.event;
  if (!event || typeof event !== 'object') throw new ValidationError('event is required');
  if (typeof event.title !== 'string' || !event.title.trim()) throw new ValidationError('event.title is required');
  if (event.attendees || event.recurrence || event.reminders) throw new ValidationError('attendees, recurrence, and reminders are not implemented yet');
  const time = event.time;
  if (!time || time.kind !== 'timed') throw new ValidationError('Only timed events are supported; event.time.kind must be "timed"');
  if (typeof time.start !== 'string' || typeof time.end !== 'string' || typeof time.timezone !== 'string') {
    throw new ValidationError('Timed events require start, end, and timezone');
  }
  const start = new Date(time.start);
  const end = new Date(time.end);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || end <= start) throw new ValidationError('end must be after a valid start');
  try { Intl.DateTimeFormat(undefined, { timeZone: time.timezone }); } catch { throw new ValidationError('time.timezone must be an IANA timezone'); }

  return {
    idempotencyKey: body.idempotency_key,
    event: {
      title: event.title.trim(),
      description: typeof event.description === 'string' ? event.description : '',
      location: typeof event.location === 'string' ? event.location : '',
      time: { kind: 'timed', start: time.start, end: time.end, timezone: time.timezone }
    }
  };
}

export function eventFingerprint(event) {
  return createHash('sha256').update(JSON.stringify(event)).digest('hex');
}
