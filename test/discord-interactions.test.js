import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { executeDiscordCommand, verifyDiscordRequest } from '../src/discord-interactions.js';

const userId = '123456789012345678';
const interaction = (name, options = []) => ({ user: { id: userId }, data: { name, options } });

function stateStore() {
  let state = { pendingProposal: null };
  return { load: async () => structuredClone(state), save: async (value) => { state = structuredClone(value); }, read: () => state };
}

test('Discord commands are restricted to authorized users', async () => {
  const result = await executeDiscordCommand({ user: { id: 'not-allowed' }, data: { name: 'help' } }, { allowedUserIds: [userId], stateStore: stateStore(), planner: null });
  assert.match(result.content, /not authorized/);
});

test('schedule stores a proposal and approve clears it without writing a calendar', async () => {
  const store = stateStore();
  const planner = { propose: async () => ({ title: 'Gym', durationMinutes: 60, conflict: false, event: { time: { timezone: 'America/Los_Angeles', start: '2026-10-05T16:00:00.000Z' } } }) };
  const scheduled = await executeDiscordCommand(interaction('schedule', [{ name: 'title', value: 'Gym' }, { name: 'when', value: 'tomorrow at 9 AM' }, { name: 'duration', value: '1 hour' }]), { allowedUserIds: [userId], stateStore: store, planner });
  assert.match(scheduled.content, /Proposed: Gym/);
  assert.equal(store.read().pendingProposal.kind, 'calendar_event');
  const approved = await executeDiscordCommand(interaction('approve'), { allowedUserIds: [userId], stateStore: store, planner });
  assert.match(approved.content, /No calendar was changed/);
  assert.equal(store.read().pendingProposal, null);
});

test('verifies Discord Ed25519 request signatures', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const rawKey = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
  const body = '{"type":1}'; const timestamp = '12345';
  const signature = sign(null, Buffer.from(timestamp + body), privateKey).toString('hex');
  assert.equal(verifyDiscordRequest({ publicKey: rawKey, signature, timestamp, body }), true);
  assert.equal(verifyDiscordRequest({ publicKey: rawKey, signature, timestamp, body: '{}' }), false);
});
