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

The assistant can run through iMessage and Discord at the same time. iMessage
uses a local watcher; Discord uses on-demand slash-command interactions, so it
does not need a continuously running bot process.

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

## Discord on-demand slash commands

Create a Discord application and bot in the [Discord Developer Portal](https://discord.com/developers/applications), enable
the `applications.commands` install scope, and configure its **Interactions
Endpoint URL** to `https://your-host.example/discord/interactions`. Unlike a
text-listening bot, this uses slash commands and does not require the Message
Content Intent or an always-on Gateway connection.

The endpoint needs an HTTPS serverless host and a persistent state store.
This implementation uses [Upstash Redis](https://upstash.com/) through its REST
API, which works from serverless functions. Configure these deployment secrets
without committing them:

```sh
DISCORD_APPLICATION_ID="your Discord application ID"
DISCORD_PUBLIC_KEY="your Discord application public key"
DISCORD_ALLOWED_USER_IDS="your Discord user ID"
UPSTASH_REDIS_REST_URL="https://...upstash.io"
UPSTASH_REDIS_REST_TOKEN="..."
GOOGLE_CALENDAR_CREDENTIALS_JSON="{...OAuth credential record...}"
```

Run the interaction endpoint locally or on a traditional host with:

```sh
npm run run-discord-interactions
```

For an on-demand deployment, this repository includes a Vercel function at
`api/discord/interactions.js`. Import the repository into Vercel, add the
secrets above in the project settings, deploy it, and paste the deployed
`https://<project>.vercel.app/api/discord/interactions` URL into Discord's
Interactions Endpoint URL field. The function verifies Discord's Ed25519
signature before reading a command.

Register the commands once after setting `DISCORD_APPLICATION_ID` and
`DISCORD_BOT_TOKEN`. Set `DISCORD_GUILD_ID` too during development for near
immediate command updates; omit it to register global commands.

```sh
npm run configure-discord-commands
```

In Discord, use:

```text
/help
/schedule title:Gym when:"tomorrow at 9 AM" duration:"1 hour"
/approve
/status
```

Only IDs listed in `DISCORD_ALLOWED_USER_IDS` may use the assistant. Proposal
state is stored by Discord conversation and user in Redis, so `/approve` works
across separate serverless invocations. Discord responses are private
(ephemeral) by default.

### Hosting the Discord interactions endpoint

The Discord endpoint executes only when Discord invokes a slash command, so a
serverless host is appropriate. The iMessage watcher still must remain on a
signed-in Mac, but Discord stays available when the Mac is off.

Recommended hosting choices:

| Option | Typical cost | Notes |
| --- | ---: | --- |
| Serverless function host | free/low-cost | Recommended. Runs only for Discord slash-command requests; pair it with Upstash Redis. |
| Railway | free trial, then usage-based | Suitable as an HTTPS host, but its always-on service model is not necessary for this endpoint. |
| AWS Lightsail / Oracle VM | $0–$5/month | Works, but is more operational work and runs continuously. |

Keep `DISCORD_PUBLIC_KEY`, Redis credentials, and Google OAuth credentials in
the host's encrypted secret store, never in Git. The calendar credential secret
is a JSON OAuth record with `clientId`, `clientSecret`, and `tokens` (including
the refresh token), matching the secure record created by the local Google
connection flow.

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
