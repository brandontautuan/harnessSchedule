import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCreateRequest, ValidationError } from '../src/event.js';
import { toVCalendar } from '../src/caldav.js';

const request = {
  idempotency_key: 'planning-2026-10-07-1500',
  event: {
    title: ' Planning, Q4 ', description: 'Line one\nLine two', location: 'Room; A',
    time: { kind: 'timed', start: '2026-10-07T15:00:00-07:00', end: '2026-10-07T16:00:00-07:00', timezone: 'America/Los_Angeles' }
  }
};

test('normalizes a timed create request', () => {
  const normalized = validateCreateRequest(request);
  assert.equal(normalized.event.title, 'Planning, Q4');
  assert.equal(normalized.event.time.timezone, 'America/Los_Angeles');
});

test('rejects ambiguous all-day input until it is implemented', () => {
  assert.throws(() => validateCreateRequest({ ...request, event: { ...request.event, time: { kind: 'all_day' } } }), ValidationError);
});

test('emits local iCalendar times with escaped text', () => {
  const calendar = toVCalendar(validateCreateRequest(request).event, 'event-1');
  assert.match(calendar, /DTSTART;TZID=America\/Los_Angeles:20261007T150000/);
  assert.match(calendar, /DTEND;TZID=America\/Los_Angeles:20261007T160000/);
  assert.match(calendar, /SUMMARY:Planning\\, Q4/);
  assert.match(calendar, /LOCATION:Room\\; A/);
  assert.match(calendar, /DESCRIPTION:Line one\\nLine two/);
});
