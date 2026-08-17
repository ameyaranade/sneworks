# Dev / Task Plan — In-app Chat Agent

Detailed build breakdown for the AI chat agent (evolving the single-shot "AI assist"
into a conversational agent that does in-app CRUD). Grouped by the 4 phases from the
approved plan. Each item lists the exact file, whether it's **new** or **edit**, and
what goes in it.

Gate reminder: the whole feature is **off by default**, opt-in via a new
`assistantEnabled` setting. Backend trigger no-ops unless on; UI entry point hidden
unless on.

---

## Phase 1 — Backend agent core (no approval gate yet)

Goal: a working "ask / act on my todos" agent. Read + low-risk write tools auto-execute.
Ships behind the settings flag.

### Data model
- **New collection** `users/{uid}/chatSessions/{sid}` — session doc:
  `{ title?, status: 'idle'|'running'|'awaiting-approval', createdAt, updatedAt }`.
- **Subcollection** `.../messages/{mid}` —
  `{ role: 'user'|'assistant', content: string, toolActivity?: {tool,summary,status}[], processedAt?, createdAt }`.
- **Subcollection** `.../proposedActions/{aid}` — Phase 2 only (defined now, unused in P1).
- Rules: already covered by the recursive `users/{uid}/{document=**}` owner rule —
  **no `firestore.rules` change needed**; add a one-line comment noting agent fields
  are Admin-SDK-written (D14 convention).

### Files
| File | New/Edit | Contents |
|---|---|---|
| `functions/src/ai/agentTools.ts` | **new** | Admin-SDK ports of todo/log/group CRUD + `recomputeGroupCounts`; `betaTool` definitions (raw JSON-schema, no zod dep) for the P1 tool set; a `buildTools(uid, activityLog)` factory whose `run()` fns execute against Admin SDK and push to `activityLog`. **Read + low-risk only in P1.** |
| `functions/src/ai/assistantAgent.ts` | **new** | `onDocumentCreated('users/{uid}/chatSessions/{sid}/messages/{mid}')`. Guards: `role==='user'`, idempotency (`processedAt`), settings `assistantEnabled===true`, per-user daily rate limit. Loads history → runs SDK **Tool Runner** loop (`client.beta.messages.toolRunner`, `max_iterations` cap) → writes assistant message (text + toolActivity) back. Injection defense in system prompt. Anthropic prompt caching (`cache_control` on frozen system block; today's date/tz injected into the user turn, not the cached prefix). `pause_turn` handled. |
| `functions/src/index.ts` | edit | `export { assistantAgent } from './ai/assistantAgent';` |

### P1 tool set
- `list_todos` (filters: status, group, overdue/today), `list_groups`, `list_logs` — **read, auto**
- `create_todo`, `create_generic_group` (list/project), `create_log` — **low, auto**
- `update_todo` (title/notes/dueAt/status/groupId), `complete_todo`, `defer_todo` — **low, auto**
- (delete/bulk deferred to Phase 2)
- Every grouped write calls `recomputeGroupCounts`.

### Model / SDK
- `@anthropic-ai/sdk@^0.115` (already installed). `betaTool` from
  `@anthropic-ai/sdk/helpers/beta/json-schema` (no zod).
- Model constant `AGENT_MODEL` = **`claude-sonnet-5`** (cost-conscious default, matches
  existing `claude-sonnet-4-6` choice; opus-5 is a one-line swap). `max_tokens` 4096,
  non-streaming.
- Reuses `checkAndIncrementRateLimit` pattern, `ANTHROPIC_API_KEY` secret.

### Client wiring (Tenet 1 — required in P1)
| File | New/Edit | Contents |
|---|---|---|
| `src/types.ts` | edit | `ChatSession`, `ChatMessage`, `ProposedAction` interfaces. |
| `src/firebase/settingsQueries.ts` | edit | add `assistantEnabled?: boolean` (NOT in `DEFAULT_SETTINGS` → off by default). |
| `src/firebase/userDataRegistry.ts` | edit | add `'chatSessions'` to `USER_DATA_COLLECTIONS` + registry entry: label, cacheKey, `exportAll`, `eraseAll` (cascade-delete `messages`/`proposedActions` subcollections). |
| `src/firebase/userDataRegistry.test.ts` | edit | update the "only groups+sharedProjects exportable" assertion to include `chatSessions`. |

### P1 verification
- `npx tsc --noEmit` (root + functions) clean.
- `npm test` — `userDataRegistry.test.ts` green with `chatSessions`.
- Functions unit tests (Firestore emulator): each tool create/update + `recomputeGroupCounts`;
  guard tests (disabled setting → no-op; non-user role → no-op).

---

## Phase 2 — Approval gate

Goal: high-risk tools (`delete_todo`, `delete_group`, bulk deletes) gated by
propose → approve → execute across the stateless function boundary.

| File | New/Edit | Contents |
|---|---|---|
| `functions/src/ai/agentTools.ts` | edit | add high-risk tools tagged `risk:'high'`; their `run()` throws a `PendingApproval` sentinel instead of executing. |
| `functions/src/ai/assistantAgent.ts` | edit | on `PendingApproval`: persist in-flight `messages[]` + pending tool call on the session doc, write a `proposedActions/{aid}` doc (tool + human summary + args), set session `status:'awaiting-approval'`, return. |
| `functions/src/ai/resumeAgent.ts` | **new** | `onDocumentUpdated('.../proposedActions/{aid}')` — on `status` → `approved`/`rejected`: feed the tool result (execute on approve; `"user declined"` on reject) back into a resumed Tool Runner loop; continue to next assistant turn. |
| `functions/src/index.ts` | edit | export `resumeAgent`. |
| client approval-card UI | (Phase 3) | renders `proposedAction`; approve/reject sets `.status`. |

Verification: emulator tests for halt→approve→execute and halt→reject→"declined";
injection text in a todo/tool-result never triggers an unapproved action.

---

## Phase 3 — Chat UI + design language

| File | New/Edit | Contents |
|---|---|---|
| `src/stores/useChatStore.ts` | **new** | Zustand + cache-seed + Firestore subscription (mirrors existing stores); writes user turns, subscribes to messages + proposedActions. |
| `src/pages/AssistantPage.tsx` + css | **new** | Chat surface: message list, tool-activity chips, approval card, composer. `--sn-*` tokens + shared primitives only. |
| `src/App.tsx` | edit | lazy route `/assistant` under the shell. |
| `src/context/UIContext.tsx` / nav / FAB | edit | entry point **gated on `assistantEnabled`**. |
| `src/pages/MorePage.tsx` | edit | Settings toggle for `assistantEnabled` (next to the summary toggle). |
| `docs/DESIGN_LANGUAGE.md` | edit | document the new patterns (message bubble, tool chip, approval card). |
| `docs/TEST_PLAN.md` | edit | state machine: empty / cache-first-paint / loading / streaming-in / awaiting-approval / error / rejected + transitions. |

Verification: `npm run check:ux` zero violations; state-machine walkthrough; live E2E
via Chrome extension on sneworks.com.

---

## Phase 4 — Extend tools + capture decisions

- Fold the existing calendar connector (`services/gcal-mcp`) into the agent's tool
  surface (low-risk, auto).
- Scaffold future high-risk outbound connectors behind the same gate.
- Capture 4 decisions via `decision-capture` skill: (1) in-function tools vs MCP for
  in-app data; (2) risk classification + auto-low/gate-high; (3) destructive-action
  gate parity with ConfirmSheet; (4) Firestore-doc transport + chat as registered
  user-data + **off-by-default settings gate**.

---

## Open questions before execution
1. **Model:** default `claude-sonnet-5` (cost) or `claude-opus-5` (reasoning)?
   Plan currently defaults to sonnet-5.
2. **Deletes:** keep behind the approval gate (current plan), or auto with an Undo
   like the rest of the app?
3. **Scope for the first pass:** build all of Phase 1 now, or Phase 1 minus the client
   UI (backend + tenet-1 wiring only) so you can review the agent before any UI ships?
4. **Emulator available?** Is the Firebase emulator set up locally for the function
   unit tests, or should verification lean on the live deploy + Chrome extension?
