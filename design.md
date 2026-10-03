Personal Assistant Harness — High-Level Plan
Goal
Build a personal assistant that can be reached through iMessage, understands ongoing conversations, and completes useful tasks through connected services. Google Calendar is the first integration. Tasks, document intake, and interview preparation are planned extensions.
The core project is a harness that coordinates TypeSafe AI's Jev, a generative LLM, ordinary application logic, and external tools. The assistant should use the appropriate component for each operation rather than require a generative model for every step.
Daily Use Cases
- Ask what is scheduled tomorrow and where there is free time.
- Request a study or interview preparation block without manually opening a calendar.
- Revise a proposal conversationally: “Make it shorter” or “Move it later.”
- Reschedule an event previously created by the assistant.
- Eventually send an invitation or assignment screenshot and turn it into proposed events and tasks.
- Eventually ask the assistant to organize interview preparation around existing obligations.
Calendar scheduling is the first complete workflow. Broader planning provides the open-ended use cases where an agent can decide what information to gather and which actions to take next.
Intelligence Strategy
Jev: Bounded Decisions
Use Jev for questions with predefined outputs, such as request classification, capability routing, selecting among known candidates, and deciding whether clarification is appropriate.
Candidate decisions include:
- New request, proposal revision, approval, cancellation, or unrelated message.
- Calendar, tasks, documents, broader planning, or unsupported request.
- Selection among retrieved event candidates, including an explicit ambiguous option.
- Whether the available information is sufficient for a supported workflow.
Supply the relevant conversation state and clear options. Treat these as proposed use cases to evaluate, not assumed capabilities. Typed outputs do not guarantee correct decisions, and confidence thresholds must be calibrated on representative requests.
Generative LLM: Interpretation and Planning
Use an LLM when the task requires open-ended content: interpreting detailed instructions into structured proposals, generating preparation plans, synthesizing document information, or composing contextual explanations.
Route known generative tasks directly to the LLM. Escalate bounded decisions when the decision model is uncertain or the workflow cannot resolve the request. Some uncertainty should produce a question to the user rather than another model call.
Ordinary Code: Exact Operations
Use deterministic logic for calendar arithmetic, timezone conversion, schema validation, permissions, deduplication, API execution, and persistence.
Neither Jev nor an LLM directly authorizes external changes. The harness controls execution. Extracted event fields still require validation, regardless of which component produced them.
High-Level Architecture
Component	Responsibility
Messaging adapter	Receive messages, identify the sender and conversation, and deliver replies.
Conversation manager	Track active requests, proposals, clarifications, and approvals.
Decision layer	Use Jev and deterministic rules to select appropriate capabilities and workflow branches.
Planning layer	Use an LLM for requests requiring generated plans or flexible interpretation.
Tool executor	Validate requests, enforce permissions, and call integrations.
Persistent state	Save conversations, proposals, operation records, and external identifiers.
Observability	Record decisions, tool outcomes, latency, model usage, and failures.


Start with one assistant and modular capabilities. Separate specialist agents are not required for the initial version.
Planned Integrations
Google Calendar — First
Connect one user's account through OAuth and operate on one explicitly selected calendar.
Initial operations:
- Read events within a bounded date range.
- Calculate available slots using calendar events and user constraints.
- Propose new events.
- Create approved events and retrieve them to verify the result.
- Update events created by the assistant after approval.
Keep credentials outside model context. Resolve relative dates using the user's timezone and the message timestamp. Ask about ambiguous times instead of guessing.
iMessage — Communication Channel
Use iMessage as the intended daily interface. Verify the available bridge, device requirements, inbound access, and outbound delivery before choosing an implementation. Do not assume a supported direct integration or an always-running Mac is available.
Keep the messaging adapter independent of the harness. Begin with a terminal interface that uses the same internal message contract so integration work does not block development of the assistant.
Initially support text from one authorized user. Add attachments after text conversations and execution are reliable.
Later Extensions
- A persistent task store for assignments, preparation steps, and deadlines.
- Screenshot and document processing for invitations and assignment instructions.
- Interview preparation using user-provided job descriptions and experience.
- Optional research tools when planning requires external information.
Core Conversation Flow
1. Receive a message and reject duplicate deliveries.
2. Load the conversation, pending proposal, and relevant preferences.
3. Classify the request and choose a workflow or planning path.
4. Gather information through permitted tools.
5. Ask for missing details or present a concrete proposal.
6. Save revisions as the user adjusts the proposal.
7. Bind approval to the current proposal version.
8. Execute the approved action and verify the external result.
9. Save the outcome and respond with a concise confirmation.
Example:
User: Find an hour tomorrow afternoon for interview prep.
Assistant: You are free from 2–3 p.m. Create an interview preparation block?
User: Make it 30 minutes.
Assistant: Updated to 2–2:30 p.m. Create it?
User: Yes.
Assistant: Created the block for tomorrow, 2–2:30 p.m.

The final confirmation is sent only after verifying the calendar result. An approval for an older proposal must not authorize a revised action.
Reliability Requirements
- Persist state so restarts preserve pending conversations and completed work.
- Track attempted, completed, failed, and uncertain external operations.
- Prevent duplicate incoming messages and repeated approvals from duplicating events.
- On an uncertain write result, reconcile with the calendar before retrying.
- Use bounded retries, tool-call limits, and model budgets.
- Recheck relevant calendar state before committing a proposal; ask again if a material conflict changes the action.
- Treat imported documents and messages as untrusted content, not permission grants.
- Log decisions and tool results without exposing credentials or unnecessary personal content.
- Clearly distinguish proposed actions, completed actions, and unresolved failures.
Build Sequence
1. Establish calendar authorization and direct read/write operations.
2. Build a persistent conversation loop through a terminal interface.
3. Add Jev routing and an LLM path for flexible interpretation.
4. Implement proposal revision, explicit approval, and verified execution.
5. Exercise duplicate delivery, timeouts, ambiguous references, and restart recovery.
6. Integrate the verified iMessage bridge.
7. Add tasks and one broader workflow: interview preparation around existing commitments.
8. Add screenshot intake after the text workflow is dependable.
Evaluation
Compare an LLM-only routing baseline with Jev-assisted routing on the same labeled requests and conversation scenarios.
Measure decision accuracy, clarification quality, successful task completion, incorrect external changes, duplicate events, recovery behavior, latency, model cost, and escalation frequency. Include multi-turn revisions and requests that should remain unsupported.
Use deterministic checks for dates, identifiers, permissions, and calendar outcomes. Evaluate model decisions against human-reviewed expectations. Select escalation thresholds from measured behavior rather than arbitrary confidence cutoffs.
Initial Scope and Success Criteria
The first version supports one user, one calendar, text input, event lookup, free-time calculation, proposal revision, approved event creation, and updates to assistant-created events.
It succeeds when a user can request a calendar action, revise it conversationally, approve it, and receive verified confirmation. The workflow should survive a restart and avoid duplicate writes after repeated messages or uncertain responses.
The next milestone adds genuine planning: turn an interview invitation and job description into preparation tasks, use calendar availability to propose work sessions, and adapt the plan to new constraints.
Open Decisions
- Which iMessage bridge is usable, and what device must remain available?
- Is Jev access available for development and evaluation?
- Which LLM provider meets the project's needs?
- Which calendar should the assistant use?
- Which actions, if any, may eventually run without per-action approval?
- What user preferences and task estimates should persist across conversations?
These choices should be resolved during integration work without coupling the core harness to a specific messaging bridge or model provider.

Implementation Status and TODO

Completed
- [x] Google Calendar Desktop OAuth flow with a Keychain-backed refresh token and read-only verification of the primary calendar.
- [x] Google event creation adapter with idempotency and provider event mappings.
- [x] Local iMessage self-chat bridge using `imsg`, restricted to one configured chat and `@assistant`-prefixed commands.
- [x] Persistent message state, incoming-message deduplication, a durable outbound queue, and a one-reply response policy.
- [x] A first deterministic proposal pattern: “schedule <title> tomorrow at <time> AM/PM for <duration>”.
- [x] Google conflict lookup for that proposal pattern.
- [x] Explicit proposal approval flow. Approval currently does not write when Apple Calendar is unavailable.

Next: Make the dual-calendar workflow complete
- [ ] Connect an iCloud/Apple calendar through CalDAV using an app-specific password and a selected writable calendar collection.
- [ ] Store CalDAV credentials in Keychain or an owner-only credential store; do not use tracked environment files for secrets.
- [ ] Add a calendar-connection health check for both Google and Apple providers.
- [ ] On `@assistant yes`, create the approved canonical event in both providers, save both external IDs, and retrieve each event to verify success.
- [ ] Handle partial success safely: report which provider succeeded, reconcile before retrying, and never duplicate the successful provider's event.
- [ ] Support cancellation and update only for events created by the harness, with the same approval/version binding.

Next: Improve the conversation and planning layer
- [ ] Expand deterministic parsing for dates, all-day events, locations, recurrence, and revisions such as “make it 30 minutes”.
- [ ] Add free/busy lookup and propose available alternatives when a requested time conflicts.
- [ ] Choose and integrate the LLM runtime for flexible natural-language interpretation; keep date math, validation, permissions, and execution deterministic.
- [ ] Add a typed intent/proposal contract so model output cannot directly create, update, or delete calendar events.
- [ ] Persist a conversation ID, proposal version, and message-to-operation links so restarts and delayed messages remain safe.

Next: Harden the iMessage service
- [ ] Run the watcher under a launchd service so it starts after login/reboot and records restart failures.
- [ ] Add a health/status command that reports bridge, Google, Apple, and pending-proposal status without exposing private message data.
- [ ] Add bounded retry/backoff for failed outgoing Messages and an explicit operator-visible failed-outbox state.
- [ ] Keep self-chat mode as a development interface. Move to a dedicated assistant Apple Account on a separate always-on Mac if a non-duplicated production iMessage experience is needed.
- [ ] Add integration tests using recorded, redacted `imsg` event fixtures; do not test against real personal message history.

Later
- [ ] Add a task store, task creation/revision commands, and a daily agenda view.
- [ ] Add document and screenshot intake with untrusted-content handling.
- [ ] Add interview-preparation planning that converts requirements into tasks and proposes calendar blocks.
- [ ] Establish evaluation cases for duplicate messages, stale approvals, provider timeouts, time-zone boundaries, and ambiguous natural-language requests.
