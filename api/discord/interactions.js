import { discordInteractionsHandlerFromEnv } from '../../src/discord-interactions-server.js';

// Vercel serverless function entry point. Other serverless hosts can adapt the
// same Node request handler from src/discord-interactions-server.js.
// Signature verification requires the exact, unparsed Discord request body.
export const config = { api: { bodyParser: false } };
const { handler } = discordInteractionsHandlerFromEnv();
export default handler;
