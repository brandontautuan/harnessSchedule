import test from 'node:test';
import assert from 'node:assert/strict';
import { discordConfigFromEnv, discordInteractionsConfigFromEnv } from '../src/discord-config.js';

const userId = '123456789012345678';

test('Discord configuration requires a token and an authorized user', () => {
  assert.throws(() => discordConfigFromEnv({}), /DISCORD_BOT_TOKEN/);
  assert.throws(() => discordConfigFromEnv({ DISCORD_BOT_TOKEN: 'secret' }), /DISCORD_ALLOWED_USER_IDS/);
});

test('Discord configuration accepts user and channel allowlists', () => {
  const config = discordConfigFromEnv({
    DISCORD_BOT_TOKEN: 'secret',
    DISCORD_ALLOWED_USER_IDS: userId,
    DISCORD_ALLOWED_CHANNEL_IDS: '223456789012345678, 323456789012345678'
  });
  assert.deepEqual(config.allowedUserIds, [userId]);
  assert.deepEqual(config.allowedChannelIds, ['223456789012345678', '323456789012345678']);
  assert.equal(config.commandPrefix, '@assistant');
});

test('Discord interactions configuration requires serverless secrets', () => {
  assert.throws(() => discordInteractionsConfigFromEnv({}), /DISCORD_APPLICATION_ID/);
  const config = discordInteractionsConfigFromEnv({
    DISCORD_APPLICATION_ID: userId,
    DISCORD_PUBLIC_KEY: 'a'.repeat(64),
    DISCORD_ALLOWED_USER_IDS: userId,
    UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
    UPSTASH_REDIS_REST_TOKEN: 'secret'
  });
  assert.equal(config.applicationId, userId);
});
