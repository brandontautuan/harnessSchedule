import { GoogleCredentialStore } from './credential-store.js';
import { connectGoogleCalendar, GoogleAuthorizationError } from './google-oauth.js';
import { GoogleCalendar, GoogleCalendarApiError } from './google.js';

const credentialsPath = process.argv[2];
if (!credentialsPath) {
  console.error('Usage: npm run connect-google-calendar -- "/path/to/desktop-oauth-credentials.json"');
  process.exitCode = 2;
} else {
  try {
    const credentialStore = new GoogleCredentialStore();
    const result = await connectGoogleCalendar({ credentialsPath, credentialStore });
    const verification = await new GoogleCalendar({ calendarId: 'primary' }, credentialStore).listUpcoming();
    console.log(`Google Calendar connected successfully. Checked calendar: ${verification.calendar}. Upcoming events found: ${verification.count}. Refresh token stored: ${result.refreshTokenStored ? 'yes' : 'no'} (${result.storage.location}).`);
  } catch (error) {
    const message = connectionRecoveryMessage(error);
    console.error(`Google Calendar connection failed: ${message}`);
    process.exitCode = 1;
  }
}

function connectionRecoveryMessage(error) {
  if (error instanceof GoogleAuthorizationError) return error.message;
  if (error instanceof GoogleCalendarApiError && /calendar api has not been used|access not configured|api.*disabled/i.test(error.reason)) {
    return 'Authorization succeeded and credentials were saved, but the Google Calendar API is disabled for this OAuth project. In Google Cloud Console, go to APIs & Services → Library → Google Calendar API → Enable, then run npm run verify-google-calendar.';
  }
  if (error instanceof GoogleCalendarApiError && error.status === 401) {
    return 'The saved Google authorization was revoked or expired. Run npm run connect-google-calendar -- "/path/to/credentials.json" again and approve access.';
  }
  if (error instanceof GoogleCalendarApiError && error.status === 403) {
    return 'Google denied Calendar access. In Google Auth Platform → Audience, add the account as a Test user (while the app is Testing), then rerun the connect command.';
  }
  return 'Could not verify Google Calendar. The authorization credential was kept; run npm run verify-google-calendar after correcting Google Cloud configuration.';
}
