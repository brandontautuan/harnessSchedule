import { verify } from 'node:crypto';

const EPHEMERAL = 1 << 6;

export function verifyDiscordRequest({ publicKey, signature, timestamp, body }) {
  if (!signature || !timestamp || !/^[0-9a-f]{128}$/i.test(signature)) return false;
  try {
    // Discord supplies a raw Ed25519 public key; Node expects an SPKI wrapper.
    const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(publicKey, 'hex')]);
    return verify(null, Buffer.concat([Buffer.from(timestamp), Buffer.from(body)]), { key: spki, format: 'der', type: 'spki' }, Buffer.from(signature, 'hex'));
  } catch { return false; }
}

export async function executeDiscordCommand(interaction, { allowedUserIds, stateStore, planner }) {
  const userId = interaction.member?.user?.id || interaction.user?.id;
  if (!userId || !allowedUserIds.includes(userId)) return privateMessage('You are not authorized to use this assistant.');
  const state = await stateStore.load();
  const command = interaction.data?.name;
  if (command === 'help') return privateMessage('Use `/schedule` to propose a block, `/approve` to approve the current proposal, or `/status` to check it.');
  if (command === 'status') return privateMessage(state.pendingProposal ? 'A calendar proposal is awaiting approval. Use `/approve` to continue.' : 'No action is pending.');
  if (command === 'approve') {
    if (!state.pendingProposal) return privateMessage('There is no pending proposal to approve. Use `/schedule` first.');
    state.pendingProposal = null;
    await stateStore.save(state);
    // Keep the established safety behavior until the dual-calendar write path
    // has been completed and verified.
    return privateMessage('Approval received, but Apple Calendar is not connected. No calendar was changed.');
  }
  if (command === 'schedule') {
    const values = optionValues(interaction.data?.options);
    if (!values.title || !values.when || !values.duration) return privateMessage('Use `/schedule` with a title, time, and duration.');
    try {
      const proposal = await planner.propose(`schedule ${values.title} ${values.when} for ${values.duration}`);
      const start = new Intl.DateTimeFormat('en-US', { timeZone: proposal.event.time.timezone, weekday: 'long', hour: 'numeric', minute: '2-digit' }).format(new Date(proposal.event.time.start));
      const conflict = proposal.conflict ? ' It overlaps an existing Google Calendar event.' : ' Google Calendar shows no conflict.';
      state.pendingProposal = { kind: 'calendar_event', event: proposal.event, version: 1, createdAt: new Date().toISOString() };
      await stateStore.save(state);
      return privateMessage(`Proposed: ${proposal.title}, ${start} for ${proposal.durationMinutes} minutes.${conflict} Use /approve to approve; no event will be created until Apple Calendar is also connected.`);
    } catch (error) { return privateMessage(error.message || 'I could not create a calendar proposal.'); }
  }
  return privateMessage('Unsupported command. Use `/help`.');
}

export function initialInteractionResponse() { return { type: 5, data: { flags: EPHEMERAL } }; }

export async function editOriginalInteractionResponse({ applicationId, token, content, fetchImpl = fetch }) {
  const response = await fetchImpl(`https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/@original`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content })
  });
  if (!response.ok) throw new Error(`Discord interaction response failed (${response.status})`);
}

function optionValues(options = []) { return Object.fromEntries(options.map((option) => [option.name, option.value])); }
function privateMessage(content) { return { content, flags: EPHEMERAL }; }
