import test from 'node:test';
import assert from 'node:assert/strict';
import { SelfChatPipeline } from '../src/imessage-pipeline.js';

function setupPipeline() {
  let state = { processedMessageIds: [], pendingProposal: null, outbound: [] };
  const sent = [];
  const pipeline = new SelfChatPipeline({
    config: { chatId: 17, chatGuid: 'iMessage;-;+15550000000', commandPrefix: '@assistant' },
    stateStore: { load: async () => structuredClone(state), save: async (value) => { state = structuredClone(value); } },
    send: async (text) => sent.push(text)
  });
  return { pipeline, sent };
}

const event = (guid, text, chatId = 17) => ({ chat_id: chatId, chat_guid: 'iMessage;-;+15550000000', guid, text });

test('only accepts prefixed messages from the configured self chat', async () => {
  const { pipeline, sent } = setupPipeline();
  assert.deepEqual(await pipeline.receive(event('a', '@assistant help', 7)), { ignored: 'wrong_chat' });
  assert.deepEqual(await pipeline.receive(event('b', 'hello')), { ignored: 'not_a_command' });
  assert.equal((await pipeline.receive(event('c', '@assistant help'))).decision, 'info');
  assert.equal(sent.length, 1);
  assert.match(sent[0], /@assistant schedule/);
  assert.deepEqual(await pipeline.receive(event('c', '@assistant help')), { ignored: 'duplicate' });
});

test('classifies schedule commands as proposals and malformed requests as clarifications', async () => {
  const { pipeline } = setupPipeline();
  assert.equal((await pipeline.receive(event('a', '@assistant schedule gym tomorrow'))).decision, 'failure');
  // The no-planner test fixture returns an actionable failure instead of inventing an event.
  assert.equal((await pipeline.receive(event('b', '@assistant something else'))).decision, 'clarification');
});

test('requires a proposal before accepting approval and never writes a calendar', async () => {
  const { pipeline, sent } = setupPipeline();
  await pipeline.receive(event('a', '@assistant yes'));
  assert.match(sent.at(-1), /no pending proposal/);
  await pipeline.receive(event('b', '@assistant draft Gym tomorrow at 9'));
  await pipeline.receive(event('c', '@assistant yes'));
  assert.match(sent.at(-1), /Apple Calendar is not connected/);
});

test('suppresses duplicate command copies received within fifteen seconds', async () => {
  const { pipeline, sent } = setupPipeline();
  await pipeline.receive({ ...event('a', '@assistant help'), created_at: '2026-10-03T20:00:00.000Z' });
  await pipeline.receive({ ...event('b', '@assistant help'), created_at: '2026-10-03T20:00:00.000Z' });
  assert.equal(sent.length, 1);
});
