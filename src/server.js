import http from 'node:http';
import { configFromEnv } from './config.js';
import { validateCreateRequest, ValidationError } from './event.js';
import { EventStore } from './store.js';
import { GoogleCalendar } from './google.js';
import { CalDavCalendar } from './caldav.js';
import { CalendarService } from './service.js';
import { GoogleCredentialStore } from './credential-store.js';

function send(response, status, body) { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(body)); }
async function readJson(request) {
  let data = '';
  for await (const chunk of request) { data += chunk; if (data.length > 100_000) throw new ValidationError('Request body is too large'); }
  try { return JSON.parse(data); } catch { throw new ValidationError('Body must be valid JSON'); }
}

const config = configFromEnv();
const service = new CalendarService({ store: new EventStore(config.storePath), google: new GoogleCalendar(config.google, new GoogleCredentialStore()), caldav: new CalDavCalendar(config.caldav) });
const server = http.createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') return send(response, 200, { ok: true });
  if (request.method !== 'POST' || request.url !== '/v1/events') return send(response, 404, { error: 'Not found' });
  try {
    const result = await service.create(validateCreateRequest(await readJson(request)));
    if (result.conflict) return send(response, 409, { error: 'idempotency_key was already used with different event data' });
    const complete = result.record.status === 'created';
    return send(response, complete ? 201 : 202, { id: result.record.id, status: result.record.status, providers: result.record.providers });
  } catch (error) {
    if (error instanceof ValidationError) return send(response, 400, { error: error.message });
    console.error(error);
    return send(response, 500, { error: 'Internal server error' });
  }
});
server.listen(config.port, () => console.log(`Dual Calendar Agent listening on :${config.port}`));
