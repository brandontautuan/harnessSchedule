import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { resolve } from 'node:path';
import { discordConfigFromEnv } from './discord-config.js';
import { JsonStateStore, messageState } from './imessage-store.js';
import { ConversationPipeline } from './conversation-pipeline.js';
import { CalendarPlanner } from './calendar-planner.js';
import { GoogleCalendar } from './google.js';
import { GoogleCredentialStore } from './credential-store.js';

const config = discordConfigFromEnv();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});
const google = new GoogleCalendar({ calendarId: 'primary' }, new GoogleCredentialStore());

client.once(Events.ClientReady, (readyClient) => console.log(`Discord bot logged in as ${readyClient.user.tag}.`));
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || message.webhookId || !config.allowedUserIds.includes(message.author.id)) return;
  // Without an allowlisted channel the bot accepts authorized-user DMs only.
  if (!message.channel.isDMBased() && !config.allowedChannelIds.includes(message.channelId)) return;
  const statePath = resolve(config.stateDirectory, `${message.channelId}.json`);
  const pipeline = new ConversationPipeline({
    config,
    stateStore: new JsonStateStore(statePath, messageState()),
    send: (content) => message.reply({ content, allowedMentions: { repliedUser: false } }),
    planner: new CalendarPlanner({ google })
  });
  try {
    const text = normalizeMention(message.content, client.user?.id, config.commandPrefix);
    await pipeline.receive({ messageId: message.id, text, createdAt: message.createdAt.toISOString() });
  } catch (error) { console.error(`Discord message handling failed: ${error.message}`); }
});

client.login(config.token).catch((error) => { console.error(`Discord login failed: ${error.message}`); process.exitCode = 1; });

function normalizeMention(text, botId, prefix) {
  if (!botId) return text;
  return text.replace(new RegExp(`^<@!?${botId}>`), prefix);
}
