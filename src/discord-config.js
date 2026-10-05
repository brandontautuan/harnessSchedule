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

export function discordInteractionsConfigFromEnv(env = process.env) {
  const required = ['DISCORD_APPLICATION_ID', 'DISCORD_PUBLIC_KEY', 'DISCORD_ALLOWED_USER_IDS', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'];
  const missing = required.filter((name) => !env[name]);
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  if (!/^\d{15,22}$/.test(env.DISCORD_APPLICATION_ID)) throw new Error('DISCORD_APPLICATION_ID must be a Discord application ID');
  if (!/^[0-9a-f]{64}$/i.test(env.DISCORD_PUBLIC_KEY)) throw new Error('DISCORD_PUBLIC_KEY must be a 64-character hexadecimal Ed25519 public key');
  const allowedUserIds = identifiers(env.DISCORD_ALLOWED_USER_IDS, 'DISCORD_ALLOWED_USER_IDS');
  if (!allowedUserIds.length) throw new Error('DISCORD_ALLOWED_USER_IDS must contain at least one authorized Discord user ID');
  return {
    applicationId: env.DISCORD_APPLICATION_ID,
    publicKey: env.DISCORD_PUBLIC_KEY,
    allowedUserIds,
    redis: { url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN },
    google: { calendarId: env.GOOGLE_CALENDAR_ID || 'primary' },
    port: Number(env.PORT || 3000)
  };
}
