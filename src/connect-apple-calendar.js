import { AppleCalendarCredentialStore, discoverICloudCalendars } from './apple-calendar.js';

const [appleId, indexArg] = process.argv.slice(2);
if (!appleId || !process.stdin.isTTY) {
  console.error('Usage: npm run connect-apple-calendar -- "you@example.com" [calendar-number]\nOmit calendar-number first to list calendars; the app-specific password is requested privately.');
  process.exitCode = 2;
} else {
  const password = await hiddenPrompt('Paste Apple app-specific password: ');
  try {
    const calendars = await discoverICloudCalendars({ username: appleId, password });
    const requested = indexArg === undefined ? null : Number(indexArg);
    if (requested === null || !Number.isInteger(requested) || requested < 0 || requested >= calendars.length) {
      console.log('Available iCloud calendars:'); calendars.forEach((calendar, index) => console.log(`${index}: ${calendar.name}`));
      console.log('Run the same command again with the calendar number you want.');
    } else {
      await new AppleCalendarCredentialStore().save({ username: appleId, password, calendarUrl: calendars[requested].calendarUrl, calendarName: calendars[requested].name, connectedAt: new Date().toISOString() });
      console.log('Apple Calendar connected and saved in macOS Keychain. The calendar URL and password were not printed.');
    }
  } catch (error) { console.error(`Apple Calendar connection failed: ${error.message}`); process.exitCode = 1; }
}

async function hiddenPrompt(label) {
  process.stdout.write(label); process.stdin.setRawMode(true); process.stdin.resume();
  return new Promise((resolve) => { let value = ''; process.stdin.on('data', (buffer) => { const key = buffer.toString(); if (key === '\r' || key === '\n') { process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); resolve(value); } else if (key === '\u007f') value = value.slice(0, -1); else if (!key.startsWith('\u0003')) value += key; }); });
}
