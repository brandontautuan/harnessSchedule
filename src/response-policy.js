export const ResponseKind = Object.freeze({
  SILENT: 'silent',
  CLARIFICATION: 'clarification',
  PROPOSAL: 'proposal',
  APPROVAL_NEEDED: 'approval_needed',
  COMPLETION: 'completion',
  FAILURE: 'failure',
  INFO: 'info'
});

export function response(kind, text, pendingProposal) {
  return { kind, text, ...(pendingProposal !== undefined ? { pendingProposal } : {}) };
}

export function shouldSend(decision) {
  return decision.kind !== ResponseKind.SILENT && typeof decision.text === 'string' && decision.text.trim().length > 0;
}
