function identifiers(value, name) {
  if (!value) return [];
  const result = value.split(',').map((item) => item.trim()).filter(Boolean);
  if (result.some((item) => !/^\d{15,22}$/.test(item))) throw new Error(`${name} must be a comma-separated list of Discord IDs`);
  return result;
}

export function discordConfigFromEnv(env = process.env) {
  if (!env.DISCORD_BOT_TOKEN) throw new Error('Missing required environment variable: DISCORD_BOT_TOKEN');
  const allowedUserIds = identifiers(env.DISCORD_ALLOWED_USER_IDS, 'DISCORD_ALLOWED_USER_IDS');
  if (!allowedUserIds.length) throw new Error('DISCORD_ALLOWED_USER_IDS must contain at least one authorized Discord user ID');
  const commandPrefix = env.DISCORD_COMMAND_PREFIX || '@assistant';
  if (!commandPrefix.trim()) throw new Error('DISCORD_COMMAND_PREFIX must not be empty');
  return {
    token: env.DISCORD_BOT_TOKEN,
    allowedUserIds,
    allowedChannelIds: identifiers(env.DISCORD_ALLOWED_CHANNEL_IDS, 'DISCORD_ALLOWED_CHANNEL_IDS'),
    commandPrefix: commandPrefix.trim(),
    stateDirectory: env.DISCORD_STATE_DIRECTORY || './data/discord-state'
  };
}
