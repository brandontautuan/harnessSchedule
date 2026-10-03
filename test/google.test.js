import test from 'node:test';
import assert from 'node:assert/strict';
import { GoogleCalendar } from '../src/google.js';

test('lists primary events using Google’s startTime sort parameter', async () => {
  let requestedUrl;
  const client = new GoogleCalendar(
    { calendarId: 'primary' },
    { load: async () => ({ clientId: 'id', clientSecret: 'secret', tokens: { access_token: 'token', expiry_date: Date.now() + 60_000, refresh_token: 'refresh' } }), save: async () => {} },
    async (url) => { requestedUrl = new URL(url); return new Response(JSON.stringify({ items: [] }), { status: 200 }); }
  );
  // Avoid a real OAuth call: listUpcoming needs only a valid current bearer token.
  client.client = { getAccessToken: async () => ({ token: 'token' }) };
  const result = await client.listUpcoming();
  assert.equal(result.calendar, 'primary');
  assert.equal(requestedUrl.searchParams.get('orderBy'), 'startTime');
  assert.equal(requestedUrl.searchParams.get('singleEvents'), 'true');
});
