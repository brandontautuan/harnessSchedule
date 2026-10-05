import http from 'node:http';
import { discordInteractionsHandlerFromEnv } from './discord-interactions-server.js';

const { port, handler } = discordInteractionsHandlerFromEnv();
http.createServer((request, response) => {
  if (request.url === '/discord/interactions' || request.url === '/health') return handler(request, response);
  response.writeHead(404, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: 'Not found' }));
}).listen(port, () => console.log(`Discord interactions endpoint listening on :${port}`));
