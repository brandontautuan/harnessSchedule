export function configFromEnv(env = process.env) {
  const required = [
    'CALDAV_CALENDAR_URL',
    'CALDAV_USERNAME',
    'CALDAV_APP_PASSWORD'
  ];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);

  const url = new URL(env.CALDAV_CALENDAR_URL);
  if (url.protocol !== 'https:') throw new Error('CALDAV_CALENDAR_URL must use HTTPS');
  if (!url.pathname.endsWith('/')) throw new Error('CALDAV_CALENDAR_URL must end with /');

  return {
    port: Number(env.PORT || 3000),
    storePath: env.EVENT_STORE_PATH || './data/events.json',
    google: {
      calendarId: env.GOOGLE_CALENDAR_ID || 'primary'
    },
    caldav: { calendarUrl: url.toString(), username: env.CALDAV_USERNAME, password: env.CALDAV_APP_PASSWORD }
  };
}
