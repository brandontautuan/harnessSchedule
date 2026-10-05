import { REST, Routes } from 'discord.js';

const { DISCORD_APPLICATION_ID: applicationId, DISCORD_BOT_TOKEN: token, DISCORD_GUILD_ID: guildId } = process.env;
if (!applicationId || !token) throw new Error('DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN are required to register slash commands.');

const commands = [
  { name: 'help', description: 'Show scheduling help' },
  { name: 'status', description: 'Show the current calendar proposal' },
  { name: 'approve', description: 'Approve the current calendar proposal' },
  {
    name: 'schedule', description: 'Propose a calendar block', options: [
      { name: 'title', description: 'Event title', type: 3, required: true },
      { name: 'when', description: 'Example: tomorrow at 9 AM', type: 3, required: true },
      { name: 'duration', description: 'Example: 1 hour', type: 3, required: true }
    ]
  }
];

const rest = new REST({ version: '10' }).setToken(token);
const route = guildId ? Routes.applicationGuildCommands(applicationId, guildId) : Routes.applicationCommands(applicationId);
await rest.put(route, { body: commands });
console.log(`Registered ${commands.length} ${guildId ? 'guild' : 'global'} Discord slash commands.`);
