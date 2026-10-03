import { randomUUID } from 'node:crypto';
import { ResponseKind, response, shouldSend } from './response-policy.js';

export class SelfChatPipeline {
  constructor({ config, stateStore, send, planner = null }) { Object.assign(this, { config, stateStore, send, planner }); }
  async receive(message) {
    if (message.chat_id !== this.config.chatId || message.chat_guid !== this.config.chatGuid) return { ignored: 'wrong_chat' };
    if (typeof message.guid !== 'string' || typeof message.text !== 'string') return { ignored: 'unsupported_message' };
    const state = await this.stateStore.load();
    if (state.processedMessageIds.includes(message.guid)) return { ignored: 'duplicate' };
    state.processedMessageIds = [...state.processedMessageIds, message.guid].slice(-500);
    const command = commandText(message.text, this.config.commandPrefix);
    if (!command) { await this.stateStore.save(state); return { ignored: 'not_a_command' }; }
    const commandKey = recentCommandKey(message.text, message.created_at);
    state.recentCommandKeys ??= [];
    if (commandKey && state.recentCommandKeys.includes(commandKey)) { await this.stateStore.save(state); return { ignored: 'duplicate_command' }; }
    if (commandKey) state.recentCommandKeys = [...state.recentCommandKeys, commandKey].slice(-500);
    const decision = await this.route(command, state);
    if (decision.pendingProposal !== undefined) state.pendingProposal = decision.pendingProposal;
    this.queueDecision(state, decision, message.created_at);
    await this.stateStore.save(state);
    await this.deliverQueued();
    return { accepted: true, decision: decision.kind };
  }
  async route(command, state) {
    if (command.toLowerCase() === 'help') return response(ResponseKind.INFO, 'Send @assistant schedule <title> tomorrow at <time> AM/PM for <duration>. I will reply only with a question, proposal, verified result, or actionable failure.');
    if (command.toLowerCase() === 'status') return response(ResponseKind.INFO, state.pendingProposal ? 'A calendar proposal is awaiting approval. Reply @assistant yes to continue.' : 'No action is pending.');
    if (command.toLowerCase() === 'yes') {
      if (!state.pendingProposal) return response(ResponseKind.CLARIFICATION, 'There is no pending proposal to approve. Send a scheduling request first.');
      return response(ResponseKind.FAILURE, 'Approval received, but Apple Calendar is not connected. No calendar was changed.', null);
    }
    if (command.toLowerCase().startsWith('schedule ')) {
      if (!this.planner) return response(ResponseKind.FAILURE, 'Calendar planning is not connected. No calendar was changed.');
      try {
        const proposal = await this.planner.propose(command);
        const start = new Intl.DateTimeFormat('en-US', { timeZone: proposal.event.time.timezone, weekday: 'long', hour: 'numeric', minute: '2-digit' }).format(new Date(proposal.event.time.start));
        const conflict = proposal.conflict ? ' It overlaps an existing Google Calendar event.' : ' Google Calendar shows no conflict.';
        return response(ResponseKind.PROPOSAL, `Proposed: ${proposal.title}, ${start} for ${proposal.durationMinutes} minutes.${conflict} Reply @assistant yes to approve; no event will be created until Apple Calendar is also connected.`, { kind: 'calendar_event', event: proposal.event, version: 1, createdAt: new Date().toISOString() });
      } catch (error) { return response(ResponseKind.CLARIFICATION, error.message || 'I could not create a calendar proposal.'); }
    }
    if (command.toLowerCase().startsWith('draft ')) return response(ResponseKind.PROPOSAL, 'Draft saved. Reply @assistant yes to approve once both calendar connections are configured.', { kind: 'calendar_draft', request: command.slice(6), version: 1, createdAt: new Date().toISOString() });
    return response(ResponseKind.CLARIFICATION, 'I need a schedule request, for example: @assistant schedule Gym tomorrow at 9 AM for 1 hour.');
  }
  queueDecision(state, decision, receivedAt) {
    if (!shouldSend(decision)) return;
    state.recentResponseKeys ??= [];
    const key = `${decision.kind}|${decision.text}|${receivedAt || ''}`;
    if (state.recentResponseKeys.includes(key)) return;
    state.recentResponseKeys = [...state.recentResponseKeys, key].slice(-500);
    state.outbound.push({ id: randomUUID(), kind: decision.kind, text: decision.text, status: 'queued', createdAt: new Date().toISOString() });
  }
  async deliverQueued() {
    const state = await this.stateStore.load();
    for (const item of state.outbound.filter((entry) => entry.status === 'queued')) {
      try { await this.send(item.text); item.status = 'sent'; item.sentAt = new Date().toISOString(); }
      catch { item.status = 'failed'; item.failedAt = new Date().toISOString(); }
    }
    await this.stateStore.save(state);
  }
}

function commandText(text, prefix) {
  const normalized = text.trim();
  if (!normalized.toLowerCase().startsWith(prefix.toLowerCase())) return null;
  const command = normalized.slice(prefix.length).trim();
  return command || 'help';
}

function recentCommandKey(text, createdAt) {
  if (!createdAt || Number.isNaN(Date.parse(createdAt))) return null;
  return `${text.trim().toLowerCase()}|${createdAt}`;
}
