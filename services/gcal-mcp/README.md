# gcal-mcp

A minimal, self-hosted **MCP server** exposing one tool — `create_event` — backed by the Google
Calendar API. It's consumed by the sneworks `processAiTask` Cloud Function through Anthropic's
[MCP connector](https://platform.claude.com/docs), which dials into this server's URL and calls the
tool on Claude's behalf.

This is deliberately small — the goal is to understand how an MCP server is built end to end.

## How it fits together

```
Claude (Anthropic MCP connector)  ──HTTP──▶  this server (Cloud Run)  ──▶  Google Calendar API
        authorization_token  ─────────────────┘ (bearer check)            refresh_token
```

- **Transport:** Streamable-HTTP (remote), not stdio — the connector must reach us over the internet.
- **Protocol:** JSON-RPC (`initialize` → `tools/list` → `tools/call`), handled by `@modelcontextprotocol/sdk`.
- **Mode:** stateless — a fresh `McpServer` per request; no session state to keep.

## The one tool

`create_event({ summary, date?, startDateTime?, endDateTime?, description?, timeZone? })`
— pass `date` (YYYY-MM-DD) for an all-day reminder, or `startDateTime` for a timed event. Returns the
created event's `id` and `htmlLink`.

## Environment variables

| Var | Purpose |
|---|---|
| `MCP_BEARER_TOKEN` | Secret the caller must send as `Authorization: Bearer …`. This is Anthropic's `authorization_token`. Generate any long random string. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth client from Google Cloud Console. |
| `GOOGLE_REFRESH_TOKEN` | Long-lived token for your calendar (see below). |
| `GOOGLE_CALENDAR_ID` | Optional; defaults to `primary`. |
| `DEFAULT_TIMEZONE` | Optional; defaults to `Asia/Kolkata`. |

## 1. Get a Google refresh token (one time)

1. Google Cloud Console → **APIs & Services** → enable **Google Calendar API**.
2. Create an **OAuth 2.0 Client ID** (Desktop app). Note the client id + secret.
3. On the **OAuth consent screen**, add your Google account as a **Test user**.
4. Run the helper (from `services/gcal-mcp`):
   ```bash
   npm install
   GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy npm run get-refresh-token
   ```
   Approve in the browser; it prints `GOOGLE_REFRESH_TOKEN`. (Alternative with no code:
   [OAuth Playground](https://developers.google.com/oauthplayground) with scope
   `https://www.googleapis.com/auth/calendar.events`.)

## 2. Run locally

```bash
npm install && npm run build
MCP_BEARER_TOKEN=dev-secret \
GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy GOOGLE_REFRESH_TOKEN=zzz \
  npm start
```

Smoke-test the MCP handshake + tool list with curl (note the two required Accept types):

```bash
curl -s http://localhost:8080/mcp \
  -H 'Authorization: Bearer dev-secret' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

A missing/wrong bearer token must return **401**. For an interactive UI, use the
[MCP Inspector](https://github.com/modelcontextprotocol/inspector) pointed at `http://localhost:8080/mcp`.

## 3. Deploy to Cloud Run (same `sneworks-app` project)

Store secrets in Secret Manager, then deploy from source:

```bash
# one-time: create secrets
printf '%s' "$MCP_BEARER_TOKEN"     | gcloud secrets create CALENDAR_MCP_TOKEN   --data-file=- --project sneworks-app
printf '%s' "$GOOGLE_REFRESH_TOKEN" | gcloud secrets create GOOGLE_REFRESH_TOKEN --data-file=- --project sneworks-app

gcloud run deploy gcal-mcp \
  --source . \
  --project sneworks-app \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLIENT_ID=xxx,GOOGLE_CLIENT_SECRET=yyy,GOOGLE_CALENDAR_ID=primary,DEFAULT_TIMEZONE=Asia/Kolkata" \
  --set-secrets "MCP_BEARER_TOKEN=CALENDAR_MCP_TOKEN:latest,GOOGLE_REFRESH_TOKEN=GOOGLE_REFRESH_TOKEN:latest"
```

`--allow-unauthenticated` makes the URL publicly reachable (Anthropic connects from outside your VPC),
but our own `MCP_BEARER_TOKEN` bearer check is the real gate. The command prints the service URL —
that `https://gcal-mcp-….run.app` is the `CAL_MCP_URL` the Cloud Function needs (append `/mcp`).

## 4. Wire into the Cloud Function

Set the function-side config so `processAiTask` can reach this server:

```bash
firebase functions:secrets:set CALENDAR_MCP_TOKEN   # same value as above
# CAL_MCP_URL is non-secret; set it as an env/param (see functions/src/ai/processAiTask.ts)
```
