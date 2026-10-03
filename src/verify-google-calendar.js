import { GoogleCredentialStore } from './credential-store.js';
import { GoogleCalendar, GoogleCalendarApiError } from './google.js';

try {
  const verification = await new GoogleCalendar({ calendarId: 'primary' }, new GoogleCredentialStore()).listUpcoming();
  console.log(`Google Calendar verification succeeded. Checked calendar: ${verification.calendar}. Upcoming events found: ${verification.count}. Refresh token stored: yes.`);
} catch (error) {
  if (error instanceof GoogleCalendarApiError && /calendar api has not been used|access not configured|api.*disabled/i.test(error.reason)) {
    console.error('Google Calendar verification failed: Enable Google Calendar API in Google Cloud Console under APIs & Services → Library, then rerun this command.');
  } else if (error instanceof GoogleCalendarApiError && error.status === 401) {
    console.error('Google Calendar verification failed: the saved authorization was revoked or expired. Run the connect command again.');
  } else {
    console.error('Google Calendar verification failed. Reconnect with npm run connect-google-calendar -- "/path/to/credentials.json".');
  }
  process.exitCode = 1;
}
