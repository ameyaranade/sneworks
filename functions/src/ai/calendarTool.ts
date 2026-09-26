// calendarTool.ts — folds the self-hosted Google Calendar MCP connector
// (services/gcal-mcp) into the chat agent as a LOW-RISK, auto-executing tool
// (docs/ASSISTANT_AGENT_DEV_PLAN.md Phase 4; D14 low-vs-high-stakes split).
//
// Why a nested Anthropic call instead of adding the MCP toolset to the main
// toolRunner: the SDK's toolRunner ignores MCP references (they execute
// server-side) and breaks its loop on `pause_turn`, so it can't drive an
// MCP-connector tool to completion. Encapsulating the connector inside one
// client-run tool — which owns its own `pause_turn` loop, mirroring the proven
// functions/src/ai/processAiTask.ts — keeps the main loop all-client-tools and
// robust. Calendar creation is reversible/low-blast, so it auto-executes (no gate).
import Anthropic from '@anthropic-ai/sdk';
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema';

export interface CalendarToolConfig {
  apiKey: string;
  mcpUrl: string;
  mcpToken: string;
  /** IANA tz for interpreting times, e.g. "Asia/Kolkata". */
  tz: string;
  /** Current UTC offset for `tz`, e.g. "+05:30" (DST-correct). */
  tzOffset: string;
  log: (tool: string, summary: string, status?: 'ok' | 'error') => void;
}

// The nested call is a trivial single-tool formatting task; a small fast model
// is plenty and keeps the per-reminder cost low.
const CAL_MODEL = 'claude-haiku-4-5-20251001';

/** Pull the created-event JSON out of the MCP tool-result block, if any.
 *  (Same shape processAiTask reads.) */
function extractEventResult(content: unknown): { id?: string; htmlLink?: string } | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    const b = block as { type?: string; content?: unknown };
    if (b.type === 'mcp_tool_result' && Array.isArray(b.content)) {
      for (const inner of b.content) {
        const t = inner as { type?: string; text?: string };
        if (t.type === 'text' && typeof t.text === 'string') {
          try { return JSON.parse(t.text); } catch { /* not our JSON — keep scanning */ }
        }
      }
    }
  }
  return null;
}

export function buildCalendarReminderTool(cfg: CalendarToolConfig) {
  return betaTool({
    name: 'create_calendar_reminder',
    description:
      'Add a reminder to the user\'s Google Calendar. Use for "remind me on my calendar", ' +
      '"put X on my calendar", scheduling an event, etc. Pass an absolute date/time (resolve ' +
      'relative phrases like "tomorrow" yourself first). For a specific time set `startDateTime` ' +
      '(ISO like 2026-08-20T09:00); for a whole-day reminder set `date` (YYYY-MM-DD). Executes ' +
      'immediately — this does NOT create a todo, only a calendar event.',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Event title.' },
        startDateTime: { type: 'string', description: 'Timed start, ISO local like 2026-08-20T09:00 (no offset needed).' },
        endDateTime: { type: 'string', description: 'Optional timed end, ISO local.' },
        date: { type: 'string', description: 'All-day date, YYYY-MM-DD (use instead of startDateTime).' },
        description: { type: 'string' },
      },
      required: ['summary'],
      additionalProperties: false,
    },
    run: async (args) => {
      if (!args.startDateTime && !args.date) {
        return 'Need either a specific time (startDateTime) or an all-day date (date). Ask the user when.';
      }
      try {
        const anthropic = new Anthropic({ apiKey: cfg.apiKey });
        const system =
          'You create exactly one Google Calendar event via the create_event tool, then stop. ' +
          `The user is in timezone ${cfg.tz} (current UTC offset ${cfg.tzOffset}). ` +
          'For a timed event, pass `startDateTime` (and `endDateTime` if given) as a full RFC3339 ' +
          `string that INCLUDES the offset ${cfg.tzOffset}, e.g. "2026-08-20T09:00:00${cfg.tzOffset}" — ` +
          'never a naive time. For an all-day event pass `date` as YYYY-MM-DD. Do not ask questions.';

        const params = {
          model: CAL_MODEL,
          max_tokens: 1024,
          betas: ['mcp-client-2025-11-20'],
          system,
          mcp_servers: [
            { type: 'url', name: 'gcal', url: cfg.mcpUrl, authorization_token: cfg.mcpToken },
          ],
          tools: [{ type: 'mcp_toolset', mcp_server_name: 'gcal' }],
          messages: [
            {
              role: 'user',
              content:
                `Create this calendar event:\n` +
                `- summary: ${args.summary}\n` +
                (args.startDateTime ? `- startDateTime: ${args.startDateTime}\n` : '') +
                (args.endDateTime ? `- endDateTime: ${args.endDateTime}\n` : '') +
                (args.date ? `- date (all-day): ${args.date}\n` : '') +
                (args.description ? `- description: ${args.description}\n` : ''),
            },
          ],
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let response: any = await anthropic.beta.messages.create(params as any);
        let guard = 0;
        while (response?.stop_reason === 'pause_turn' && guard++ < 5) {
          const resume = { ...params, messages: [...params.messages, { role: 'assistant', content: response.content }] };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          response = await anthropic.beta.messages.create(resume as any);
        }

        const event = extractEventResult(response?.content);
        if (event) {
          cfg.log('create_calendar_reminder', `Added "${args.summary}" to your calendar`);
          return JSON.stringify({ ok: true, htmlLink: event.htmlLink });
        }
        cfg.log('create_calendar_reminder', `Couldn't add "${args.summary}" to calendar`, 'error');
        return JSON.stringify({ ok: false, error: 'The calendar event was not created.' });
      } catch (e) {
        cfg.log('create_calendar_reminder', `Calendar reminder failed for "${args.summary}"`, 'error');
        throw e;
      }
    },
  });
}
