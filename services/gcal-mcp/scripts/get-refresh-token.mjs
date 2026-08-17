/**
 * One-time helper to obtain a Google OAuth refresh token for the Calendar API.
 *
 * Prereqs (Google Cloud Console → APIs & Services):
 *   1. Enable the "Google Calendar API".
 *   2. Create an OAuth 2.0 Client ID of type "Desktop app" (or "Web app" with the
 *      redirect URI below). Note the client id + secret.
 *   3. On the OAuth consent screen add YOUR Google account as a Test user.
 *
 * Run:
 *   GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy node scripts/get-refresh-token.mjs
 *
 * It opens a local callback server, prints an auth URL, and after you approve in
 * the browser it prints the refresh_token. Store that as the GOOGLE_REFRESH_TOKEN
 * secret for the Cloud Run service.
 *
 * Alternative (no code): use https://developers.google.com/oauthplayground with
 * scope https://www.googleapis.com/auth/calendar.events and your own client creds.
 */
import http from 'node:http';
import { google } from 'googleapis';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PORT = 4321;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars first.');
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline', // required to receive a refresh_token
  prompt: 'consent', // force a refresh_token even on re-auth
  scope: ['https://www.googleapis.com/auth/calendar.events'],
});

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith('/oauth2callback')) {
    res.writeHead(404).end();
    return;
  }
  const code = new URL(req.url, REDIRECT_URI).searchParams.get('code');
  if (!code) {
    res.writeHead(400).end('Missing code');
    return;
  }
  try {
    const { tokens } = await oauth2.getToken(code);
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('Refresh token captured — you can close this tab and return to the terminal.');
    console.log('\n=== GOOGLE_REFRESH_TOKEN ===\n' + tokens.refresh_token + '\n');
    if (!tokens.refresh_token) {
      console.warn('No refresh_token returned. Revoke prior access at ' +
        'https://myaccount.google.com/permissions and re-run.');
    }
  } catch (err) {
    console.error('Token exchange failed:', err);
    res.writeHead(500).end('Token exchange failed');
  } finally {
    server.close();
  }
});

server.listen(PORT, () => {
  console.log('Open this URL in your browser and approve:\n\n' + authUrl + '\n');
});
