import { resolve } from 'node:path';
import { JsonStateStore } from './imessage-store.js';
import { IMessageClient } from './imessage-client.js';

const testText = process.argv[2] || '@assistant setup test';
try {
  const matches = await new IMessageClient().findExactText(testText);
  const directChats = new Map();
  for (const message of matches) {
    if (!message.is_group && message.chat_id && message.chat_guid) directChats.set(`${message.chat_id}|${message.chat_guid}`, message);
  }
  if (directChats.size !== 1) throw new Error('ambiguous');
  const message = [...directChats.values()][0];
  await new JsonStateStore(resolve('data/imessage-self-chat.json'), {}).save({ chatId: message.chat_id, chatGuid: message.chat_guid, commandPrefix: '@assistant', configuredAt: new Date().toISOString() });
  console.log('Self-chat configuration saved locally. The chat identifier was not printed.');
} catch {
  console.error('Could not configure the self-chat. Send a unique @assistant setup test message to yourself, then rerun this command.');
  process.exitCode = 1;
}
