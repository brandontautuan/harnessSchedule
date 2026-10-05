# Dual Calendar Agent

Creates a distinct copy of a requested event in both Google Calendar and an
iCloud calendar. It deliberately has one canonical request, plus a stored
mapping to each provider's event identifier. That makes retries safe and makes
future update/cancel support possible.

## What exists now

- `POST /v1/events` validates a provider-neutral JSON event and writes it to
  Google Calendar and CalDAV/iCloud.
- Google uses a local installed-app OAuth flow and the Calendar Events API.
- iCloud uses a configured CalDAV calendar collection URL and an app-specific
  password.
- A local JSON store records the idempotency key, canonical event, external
  identifiers, and partial failures.

This is an initial service, not a background sync engine yet. Updates,
cancellations, discovery of a CalDAV calendar URL, attendees, and recurrence
are intentionally rejected/omitted until their provider-specific semantics are
implemented.

## Setup

1. Connect Google Calendar. This opens your Mac browser, obtains an offline
   refresh token, stores it in macOS Keychain, and performs a read-only check
   of your primary calendar:

   ```sh
   npm run connect-google-calendar -- "/Users/you/Downloads/credentials.json"
   ```

   The credentials file must be a **Desktop app** OAuth client downloaded from
   Google Cloud. Enable the Google Calendar API for its Cloud project, and if
   the OAuth consent screen is in Testing, add the Google account you will use
   as a test user. The command requests only
   `https://www.googleapis.com/auth/calendar.events`.
2. Copy `.env.example` to `.env` and load only the non-Google runtime settings
   you need. Do not commit `.env`.
3. Configure `CALDAV_CALENDAR_URL` with the exact writable iCloud calendar
   collection URL, and create an Apple app-specific password for
   `CALDAV_APP_PASSWORD`.
4. Run `npm start` with Node 20+.

Google OAuth client secrets, authorization codes, and tokens are never printed
or stored in the repository. The command uses macOS Keychain; if Keychain is
unavailable it falls back to an owner-only file at
`~/.config/harness-schedule/google-calendar-oauth.json`.

## Messaging interfaces

The assistant can run through iMessage and Discord at the same time. Both
adapters use the same proposal, approval, deduplication, and calendar-planning
workflow, but keep their conversation state separate.

## iMessage self-chat mode

This is a local-only development interface for one self-chat. It accepts only
messages in the saved chat that begin with `@assistant`; all other Messages
events are ignored. The chat configuration and conversation state are written
to ignored, owner-only files in `data/`.

After sending yourself `@assistant setup test`, configure and run the watcher:

```sh
npm run configure-imessage-self-chat
npm run run-imessage
```

Examples:

```text
@assistant help
@assistant status
@assistant draft Gym tomorrow at 9 AM for 30 minutes
@assistant yes
```

`yes` only approves an existing proposal. This initial iMessage slice never
creates a calendar event until both Google and Apple Calendar connectors are
configured; it will say so instead of silently writing only one calendar.

## Discord text bot

Create a Discord application and bot in the [Discord Developer Portal](https://discord.com/developers/applications), enable
the **Message Content Intent**, then invite it to your server if you want to
use a shared channel. Configure these environment variables without committing
the bot token:

```sh
DISCORD_BOT_TOKEN="your bot token"
DISCORD_ALLOWED_USER_IDS="your Discord user ID"
# Optional: comma-separated channel IDs. Without this, only authorized-user DMs are accepted.
DISCORD_ALLOWED_CHANNEL_IDS="your private channel ID"
```

Start it alongside the iMessage watcher if desired:

```sh
npm run run-discord
```

In an authorized DM or channel, send the same text commands used by iMessage:

```text
@assistant help
@assistant schedule Gym tomorrow at 9 AM for 1 hour
@assistant yes
```

You can also mention the bot instead of typing `@assistant`. The bot ignores
other users, bots, webhooks, and unapproved server channels. Discord state is
stored locally under `data/discord-state/` and is separate for each channel.

### Hosting the Discord bot

Discord requires a process that remains connected to its gateway, so do not use
a sleeping free web host or a serverless function for `npm run run-discord`.
The iMessage watcher must remain on a signed-in Mac, but the Discord bot can be
hosted independently so it remains available when the Mac is off.

Recommended hosting choices:

| Option | Typical cost | Notes |
| --- | ---: | --- |
| Oracle Cloud Always Free VM | $0 | A Linux VM can run the bot continuously, but free capacity may be unavailable and idle instances can be reclaimed. |
| AWS Lightsail Nano | $5/month | Recommended for a simple, predictable deployment with persistent disk storage. |
| Render background worker | about $7/month | Managed deployment, but attach persistent storage or move state to a database. |
| Railway persistent service | usage-based | Convenient GitHub deployments and secret environment variables; use an always-on service rather than a cron job. |

On a VM, run the bot under a process manager such as `systemd` so it restarts
after a crash or reboot. Keep `DISCORD_BOT_TOKEN` and calendar credentials in
the host's secret/configuration store, never in Git.

The current Discord implementation persists conversation state as local JSON
files and uses local Google credentials. Before deploying it to a managed host,
move Google credentials to that host's secret store and either keep a persistent
disk or migrate the JSON state to a managed database. This prevents lost pending
proposals after a deploy or restart.

## Create an event

```sh
curl -X POST http://localhost:3000/v1/events \
  -H 'content-type: application/json' \
  -d '{
    "idempotency_key": "planning-2026-10-07-1500",
    "event": {
      "title": "Planning session",
      "description": "Bring the draft agenda.",
      "location": "Conference Room A",
      "time": {
        "kind": "timed",
        "start": "2026-10-07T15:00:00-07:00",
        "end": "2026-10-07T16:00:00-07:00",
        "timezone": "America/Los_Angeles"
      }
    }
  }'
```

The response is `201` on complete success, `202` for a partial success that
can safely be retried using the same idempotency key, and `409` if the key is
reused with different event data.

## Agent contract

The agent should collect and validate the request before calling the service:

- Require an explicit date, start and end time, and IANA timezone for timed
  events.
- Ask for confirmation before creating an event, especially if invitees or
  recurring events are added in a later release.
- Never expose credentials, provider event IDs, or raw error bodies to a user.

`POST /v1/events` currently supports only `timed` events. All-day, attendees,
recurrence, updates, and cancellation return validation errors rather than
silently losing data.
