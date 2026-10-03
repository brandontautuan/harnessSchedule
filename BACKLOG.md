# Harness Backlog

## Next: Complete dual-calendar execution

- [ ] Run `npm run connect-apple-calendar -- "your-apple-account@email.com"` to discover iCloud calendars, then rerun with the chosen calendar number.
- [ ] Wire the Keychain-backed Apple CalDAV credential into the runtime calendar service.
- [ ] On `@assistant yes`, create the approved canonical event in both Google Calendar and the selected iCloud calendar.
- [ ] Retrieve both created events and send one verified completion message.
- [ ] Handle partial success safely: preserve the successful provider event ID, reconcile before retrying, and report the failed provider without duplicating the successful event.
- [ ] Add cancellation and update support for harness-created events, bound to the current proposal version and explicit approval.

## Conversation and planning

- [ ] Expand scheduling beyond “tomorrow at <time> for <duration>”.
- [ ] Support revisions, all-day events, locations, recurrence, and free-time alternatives.
- [ ] Choose an LLM runtime for flexible requests while keeping validation, approval, and execution deterministic.
- [ ] Persist conversation IDs and proposal revisions across restarts.

## iMessage operations

- [ ] Run the watcher as a launchd service after the workflow is stable.
- [ ] Add retry/backoff and operator-visible failed-outbox handling.
- [ ] Keep self-chat mode for development; use a separate assistant identity and dedicated Mac only if a non-mirrored production iMessage experience is needed.
