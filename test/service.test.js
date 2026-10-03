import test from 'node:test';
import assert from 'node:assert/strict';
import { CalendarService } from '../src/service.js';

const event = { title: 'Test', description: '', location: '', time: { kind: 'timed', start: '2026-10-07T15:00:00-07:00', end: '2026-10-07T16:00:00-07:00', timezone: 'America/Los_Angeles' } };

test('retries only the provider that failed', async () => {
  const data = new Map();
  const store = { get: async (key) => data.get(key), put: async (key, value) => data.set(key, structuredClone(value)) };
  let googleCalls = 0;
  const google = { create: async () => ({ providerEventId: `g-${++googleCalls}` }) };
  let caldavCalls = 0;
  const caldav = { create: async () => { caldavCalls++; if (caldavCalls === 1) throw new Error('offline'); return { providerEventId: 'c-1' }; } };
  const service = new CalendarService({ store, google, caldav });
  assert.equal((await service.create({ idempotencyKey: 'request-key', event })).record.status, 'partial_failure');
  assert.equal((await service.create({ idempotencyKey: 'request-key', event })).record.status, 'created');
  assert.equal(googleCalls, 1);
  assert.equal(caldavCalls, 2);
});
