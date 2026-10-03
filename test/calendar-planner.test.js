import test from 'node:test';
import assert from 'node:assert/strict';
import { CalendarPlanner, parseTomorrowSchedule } from '../src/calendar-planner.js';

test('parses a tomorrow schedule request into a timezone-aware event', () => {
  const result = parseTomorrowSchedule('schedule Gym tomorrow at 9 AM for 1 hour', { now: new Date('2026-10-02T16:00:00Z') });
  assert.equal(result.title, 'Gym');
  assert.equal(result.durationMinutes, 60);
  assert.match(result.event.time.start, /^2026-10-03T09:00:00-07:00$/);
});

test('marks a proposal as conflicting when Google returns an overlapping event', async () => {
  const planner = new CalendarPlanner({ now: () => new Date('2026-10-02T16:00:00Z'), google: { listBetween: async () => [{ start: { dateTime: '2026-10-03T09:30:00-07:00' }, end: { dateTime: '2026-10-03T10:30:00-07:00' } }] } });
  assert.equal((await planner.propose('schedule Gym tomorrow at 9 AM for 1 hour')).conflict, true);
});
