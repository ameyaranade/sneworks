/**
 * gcal-mcp — a minimal, self-hosted MCP server.
 *
 * WHAT AN MCP SERVER IS (the mental model):
 *   The Model Context Protocol is just JSON-RPC 2.0 over some transport. A server
 *   advertises a set of "tools" (name + input schema + description); a client
 *   (here, Anthropic's hosted MCP connector) performs an `initialize` handshake,
 *   asks for the tool list (`tools/list`), and calls a tool (`tools/call`). We
 *   never talk to Claude directly — Claude's servers dial INTO the URL below.
 *
 * TRANSPORT — why HTTP, not stdio:
 *   Most MCP tutorials use the *stdio* transport (a local subprocess Claude
 *   Desktop launches). That can't be reached over the internet. The Messages-API
 *   MCP connector needs a *remote* server, so we use the Streamable-HTTP
 *   transport behind an Express route. We run it STATELESS: a fresh McpServer +
 *   transport per request, since our one tool keeps no cross-request state.
 *
 * AUTH — two independent layers:
 *   1. Bearer token on THIS endpoint (MCP_BEARER_TOKEN) so only our Cloud
 *      Function can call us — this is what Anthropic passes as `authorization_token`.
 *   2. Google OAuth (a refresh token) that THIS server uses to reach the
 *      Calendar API. The two never mix.
 */
import express, { type Request, type Response, type NextFunction } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { google } from 'googleapis';

// ─── Google Calendar ────────────────────────────────────────────────────────

function getCalendarClient() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  // A refresh token lets the server mint fresh access tokens indefinitely
  // without a browser — see README for how to obtain one.
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.calendar({ version: 'v3', auth: oauth2 });
}

/** All-day event end dates are EXCLUSIVE in the Calendar API, so a one-day
 *  event on 2026-09-07 needs end.date = 2026-09-08. */
function nextDay(yyyyMmDd: string): string {
  const d = new Date(`${yyyyMmDd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

interface CreateEventArgs {
  summary: string;
  date?: string;
  startDateTime?: string;
  endDateTime?: string;
  description?: string;
  timeZone?: string;
}

async function createCalendarEvent(args: CreateEventArgs) {
  const calendar = getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
  const timeZone = args.timeZone || process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata';

  const requestBody: Record<string, unknown> = {
    summary: args.summary,
    description: args.description,
  };

  if (args.date) {
    // All-day event.
    requestBody.start = { date: args.date };
    requestBody.end = { date: nextDay(args.date) };
  } else if (args.startDateTime) {
    // Timed event; default to a 30-minute block if no end supplied.
    const start = new Date(args.startDateTime);
    const end = args.endDateTime
      ? new Date(args.endDateTime)
      : new Date(start.getTime() + 30 * 60_000);
    requestBody.start = { dateTime: start.toISOString(), timeZone };
    requestBody.end = { dateTime: end.toISOString(), timeZone };
  } else {
    throw new Error('Provide either `date` (all-day) or `startDateTime` (timed).');
  }

  const res = await calendar.events.insert({ calendarId, requestBody });
  return { id: res.data.id, htmlLink: res.data.htmlLink, start: res.data.start };
}

// ─── MCP server ─────────────────────────────────────────────────────────────

/** Build a fresh McpServer with our single tool registered. Called per request
 *  (stateless mode). `inputSchema` is a Zod raw shape — the SDK turns it into the
 *  JSON Schema that Claude sees when deciding whether/how to call the tool. */
function buildMcpServer(): McpServer {
  const server = new McpServer({ name: 'gcal-mcp', version: '1.0.0' });

  server.registerTool(
    'create_event',
    {
      title: 'Create Google Calendar event',
      description:
        'Create an event on the user\'s Google Calendar. For a whole-day reminder pass ' +
        '`date` as YYYY-MM-DD. For a timed event pass `startDateTime` (and optionally ' +
        '`endDateTime`) as RFC3339. Returns the created event id and htmlLink.',
      inputSchema: {
        summary: z.string().describe('Event title'),
        date: z.string().optional().describe('All-day date, YYYY-MM-DD'),
        startDateTime: z.string().optional().describe('Timed start, RFC3339'),
        endDateTime: z.string().optional().describe('Timed end, RFC3339'),
        description: z.string().optional(),
        timeZone: z.string().optional().describe('IANA tz, e.g. Asia/Kolkata'),
      },
    },
    async (args) => {
      const event = await createCalendarEvent(args as CreateEventArgs);
      return { content: [{ type: 'text', text: JSON.stringify(event) }] };
    },
  );

  return server;
}

// ─── HTTP layer ───────────────────────────────────────────────────────────────

function bearerAuth(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.MCP_BEARER_TOKEN;
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!expected || token !== expected) {
    res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null });
    return;
  }
  next();
}

const app = express();
app.use(express.json());

// Unauthenticated health check for Cloud Run.
app.get('/health', (_req, res) => res.json({ ok: true }));

// The MCP endpoint. Stateless: a new server + transport per POST.
app.post('/mcp', bearerAuth, async (req: Request, res: Response) => {
  const server = buildMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('MCP request failed:', err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

// Stateless mode has no server-initiated SSE stream / session teardown.
const methodNotAllowed = (_req: Request, res: Response) =>
  res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null });
app.get('/mcp', methodNotAllowed);
app.delete('/mcp', methodNotAllowed);

const port = Number(process.env.PORT) || 8080;
app.listen(port, () => console.log(`gcal-mcp listening on :${port}`));
