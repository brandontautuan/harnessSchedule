import { resolve } from 'node:path';
import { JsonStateStore, messageState } from './imessage-store.js';
import { IMessageClient } from './imessage-client.js';
import { SelfChatPipeline } from './imessage-pipeline.js';
import { CalendarPlanner } from './calendar-planner.js';
import { GoogleCalendar } from './google.js';
import { GoogleCredentialStore } from './credential-store.js';

const config = await new JsonStateStore(resolve('data/imessage-self-chat.json'), null).load();
if (!config?.chatId || !config?.chatGuid) {
  console.error('iMessage self-chat is not configured. Run: npm run configure-imessage-self-chat');
  process.exitCode = 1;
} else {
  const client = new IMessageClient();
  const google = new GoogleCalendar({ calendarId: 'primary' }, new GoogleCredentialStore());
  const pipeline = new SelfChatPipeline({ config, stateStore: new JsonStateStore(resolve('data/imessage-state.json'), messageState()), send: (text) => client.sendText(config.chatGuid, text), planner: new CalendarPlanner({ google }) });
  const watcher = client.watch(config.chatId, new Date().toISOString(), (message) => pipeline.receive(message).catch(() => {}), (error) => console.error(`iMessage watcher: ${error.message}`));
  console.log('iMessage self-chat watcher is running. Only @assistant commands in the configured chat are processed. Press Ctrl+C to stop.');
  process.on('SIGINT', () => watcher.kill());
}
