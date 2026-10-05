import { discordInteractionsConfigFromEnv } from './discord-config.js';
import { EnvironmentGoogleCredentialStore } from './credential-store.js';
import { GoogleCalendar } from './google.js';
import { CalendarPlanner } from './calendar-planner.js';
import { RedisStateStore } from './redis-store.js';
import { messageState } from './imessage-store.js';
import { editOriginalInteractionResponse, executeDiscordCommand, initialInteractionResponse, verifyDiscordRequest } from './discord-interactions.js';

export function discordInteractionsHandlerFromEnv(env = process.env) {
  const config = discordInteractionsConfigFromEnv(env);
  const planner = new CalendarPlanner({ google: new GoogleCalendar(config.google, new EnvironmentGoogleCredentialStore(env.GOOGLE_CALENDAR_CREDENTIALS_JSON)) });
  return { port: config.port, handler: createDiscordInteractionsHandler({ config, planner }) };
}

export function createDiscordInteractionsHandler({ config, planner }) {
  return async (request, response) => {
    if (request.method === 'GET') return send(response, 200, { ok: true });
    if (request.method !== 'POST') return send(response, 405, { error: 'Method not allowed' });
    try {
      const body = await readBody(request);
      if (!verifyDiscordRequest({ publicKey: config.publicKey, signature: request.headers['x-signature-ed25519'], timestamp: request.headers['x-signature-timestamp'], body })) return send(response, 401, { error: 'Invalid request signature' });
      const interaction = JSON.parse(body);
      if (interaction.type === 1) return send(response, 200, { type: 1 });
      if (interaction.type !== 2) return send(response, 400, { error: 'Unsupported interaction type' });
      send(response, 200, initialInteractionResponse());
      const userId = interaction.member?.user?.id || interaction.user?.id || 'unknown';
      const conversationId = interaction.channel_id || userId;
      const stateStore = new RedisStateStore({ ...config.redis, key: `harness-discord:${conversationId}:${userId}`, initialState: messageState() });
      const result = await executeDiscordCommand(interaction, { allowedUserIds: config.allowedUserIds, stateStore, planner });
      await editOriginalInteractionResponse({ applicationId: config.applicationId, token: interaction.token, content: result.content });
    } catch (error) {
      console.error(`Discord interaction failed: ${error.message}`);
      if (!response.headersSent) send(response, 500, { error: 'Internal server error' });
    }
  };
}

function send(response, status, body) { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(body)); }
async function readBody(request) {
  let body = '';
  for await (const chunk of request) { body += chunk; if (body.length > 100_000) throw new Error('Request body is too large'); }
  return body;
}
