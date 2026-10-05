import { ConversationPipeline } from './conversation-pipeline.js';

// iMessage filtering stays at the adapter boundary; the workflow itself is
// shared with Discord and any future messaging adapter.
export class SelfChatPipeline extends ConversationPipeline {
  async receive(message) {
    if (message.chat_id !== this.config.chatId || message.chat_guid !== this.config.chatGuid) return { ignored: 'wrong_chat' };
    return super.receive({ messageId: message.guid, text: message.text, createdAt: message.created_at });
  }
}
