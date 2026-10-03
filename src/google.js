const API_ROOT = 'https://www.googleapis.com/calendar/v3';

export class GoogleCalendarApiError extends Error {
  constructor(context, status, reason) { super(`${context} failed (${status})`); this.status = status; this.reason = reason; }
}

async function responseJson(response, context) {
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 500) }; }
  if (!response.ok) throw new GoogleCalendarApiError(context, response.status, body.error_description || body.error?.message || 'unknown error');
  return body;
}

export class GoogleCalendar {
  constructor(config, credentialStore, fetchImpl = fetch) { this.config = config; this.credentialStore = credentialStore; this.fetch = fetchImpl; this.client = null; }
  async oauthClient() {
    if (this.client) return this.client;
    const record = await this.credentialStore.load();
    if (!record) throw new Error('Google Calendar is not connected. Run: npm run connect-google-calendar -- <credentials-json-path>');
    const { OAuth2Client } = await import('google-auth-library');
    const client = new OAuth2Client(record.clientId, record.clientSecret);
    client.setCredentials(record.tokens);
    client.on('tokens', (tokens) => this.credentialStore.save({ ...record, tokens: { ...record.tokens, ...tokens }, refreshedAt: new Date().toISOString() }).catch(() => {}));
    this.client = client;
    return client;
  }
  async accessToken() {
    const token = await (await this.oauthClient()).getAccessToken();
    if (!token?.token) throw new Error('Google access token could not be refreshed. Reconnect Google Calendar.');
    return token.token;
  }
  async create(event, externalId) {
    const token = await this.accessToken();
    const url = `${API_ROOT}/calendars/${encodeURIComponent(this.config.calendarId)}/events`;
    const response = await this.fetch(url, {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ id: externalId, summary: event.title, description: event.description, location: event.location, start: { dateTime: event.time.start, timeZone: event.time.timezone }, end: { dateTime: event.time.end, timeZone: event.timezone } })
    });
    const created = await responseJson(response, 'Google event creation');
    return { providerEventId: created.id, url: created.htmlLink };
  }
  async listUpcoming() {
    const token = await this.accessToken();
    const url = new URL(`${API_ROOT}/calendars/primary/events`);
    url.search = new URLSearchParams({ timeMin: new Date().toISOString(), maxResults: '10', singleEvents: 'true', orderBy: 'startTime' });
    const response = await this.fetch(url, { headers: { authorization: `Bearer ${token}` } });
    const result = await responseJson(response, 'Google Calendar verification');
    return { calendar: 'primary', count: result.items?.length || 0 };
  }
  async listBetween(start, end) {
    const token = await this.accessToken();
    const url = new URL(`${API_ROOT}/calendars/${encodeURIComponent(this.config.calendarId || 'primary')}/events`);
    url.search = new URLSearchParams({ timeMin: start, timeMax: end, singleEvents: 'true', orderBy: 'startTime' });
    const response = await this.fetch(url, { headers: { authorization: `Bearer ${token}` } });
    const result = await responseJson(response, 'Google Calendar availability check');
    return result.items || [];
  }
}
