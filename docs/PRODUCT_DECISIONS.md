# sneworks — Product & Architecture Decision Log

Durable, cross-cutting decisions that were made deliberately during the project
and that **future iterations must honor**. These are not style tokens (see
[`DESIGN_LANGUAGE.md`](DESIGN_LANGUAGE.md)) or test states (see
[`TEST_PLAN.md`](TEST_PLAN.md)) — they are *behavioral/structural calls* with a
rationale, the kind of thing that gets silently undone in a later change because
the reason wasn't written down.

**Rule for any change touching shell layout, navigation, modals/sheets,
z-index, scroll, or safe-area/keyboard handling:** read this file first and
honor these decisions, or amend the entry with a new rationale in the same
change. The `ux-invariants-build` skill treats this as part of tenet 2.

### Entry format
Each entry: **Decision** · **Why** · **How to apply** · **Anchor** (where it
lives, so the decision is verifiable and not just folklore).

---

## D1 — The bottom nav persists across all page navigation
**Decision:** `BottomNav` (and the sheet portal) are rendered once in `AppShell`
as siblings of `<Outlet />`, never inside a page. Pages swap inside `.sn-content`;
the nav and any open sheet stay mounted and stable, including during a page's
lazy-load/suspense.
**Why:** the nav is global app chrome; re-mounting it per route causes flicker,
loses FAB state, and makes lazy-loaded pages show a navless frame mid-load.
**How to apply:** never render nav/FAB/sheets from a page component. New global
chrome goes in `AppShell`, beside the Outlet. Page-level Suspense fallbacks must
not cover the nav.
**Anchor:** `src/AppShell.tsx:103` (`<Outlet/>`), `:107` (`<BottomNav/>`),
`:110` (`#sn-portal`).

## D2 — Safe-area + keyboard padding on every edge surface (PWA-correct)
**Decision:** top/bottom edges use `env(safe-area-inset-*)`. The shell pads the
top inset; the nav and every sheet pad the bottom inset; scrollable pages reserve
extra bottom space with `max(…, calc(env(safe-area-inset-bottom) + …))`.
**Why:** installed as a PWA on notched phones, fixed chrome otherwise sits under
the home indicator / status bar; the on-screen keyboard otherwise covers the last
form field and the sheet's action row.
**How to apply:** any new fixed/edge-anchored surface (sheet, nav, banner,
sticky header) must include the matching `env(safe-area-inset-*)` padding. Form
sheets keep their submit row above the keyboard via the `max(...)` bottom-padding
pattern. Page bottom padding is still `calc(var(--sn-nav-height) + 24px)` on top
of this.
**Anchor:** `src/app-shell.css:11`, `src/components/nav/bottom-nav.css:10`,
`src/components/primitives/bottom-sheet.css:24` & `:46`,
`src/pages/more-page.css:9`.

## D3 — Edit/compose drawers are modal and own the top of the z-index ladder
**Decision:** sheets (ComposeSheet, DeferSheet, EditRecurring, ConfirmSheet via
`BottomSheet`) render a full-screen scrim + panel that is **modal** — it traps
focus, closes on Escape/scrim-tap, and sits above all page chrome and the nav.
Only transient toasts may appear above a sheet.
**Why:** an edit surface must not be reachable "around" — a non-modal drawer that
sits under the nav or lets the page scroll behind it produces lost edits and
mis-taps. Toasts stay on top so an Undo is reachable even with a sheet open.
**How to apply:** honor the z-index ladder below; do not introduce a new layer
between nav and sheet, and never give page content a z-index that competes with
a sheet. New modals reuse `BottomSheet` (portals to `#sn-portal`, inside
`[data-theme]`) rather than a hand-rolled overlay.
**Anchor:** `src/components/primitives/bottom-sheet.css:5` (scrim 200) & `:20`
(panel 201); `BottomSheet.tsx:30` (top-level sibling so z-index isn't trapped).

### Canonical z-index ladder (do not reorder)
| Layer | z-index | Source |
|-------|---------|--------|
| Swipe row (resting / revealed actions) | 0–1 | `swipeable-row.css` |
| Bottom nav bar | 10 | `bottom-nav.css:9` |
| Split-pill FAB | 20 | `split-pill-fab.css:13` |
| Sheet scrim (modal backdrop) | 200 | `bottom-sheet.css:5` |
| Sheet panel | 201 | `bottom-sheet.css:20` |
| Toast (always reachable) | 300 | `toast.css:6` |

---

## D4 — One data registry drives export, account-erase, and cache-clear
**Decision:** Every `users/{uid}/*` store is declared once in
`userDataRegistry.ts` (`USER_DATA_COLLECTIONS` + a registry entry). Export,
account-erase, and local cache-clear **iterate that registry** rather than
hand-listing collections; `userDataRegistry.test.ts` fails if a collection isn't
registered. Export is scoped to **projects only** for now via a per-store
`exportable` flag — all other types are full-CRUD-from-UI but not yet in the
export bundle.
**Why:** the prior failure mode was adding a Firestore collection and silently
forgetting to wire it into erase/export — a missed checkbox that leaves user
data un-erasable/un-exportable (a tenet-1 violation). A registry + coverage test
converts that latent gap into a red test.
**How to apply:** a new user-data collection → add it to `USER_DATA_COLLECTIONS`
and a registry entry (with `eraseAll`, plus `exportAll` if it should export).
Never hand-list collections in an export/erase/cache-clear path — iterate the
registry. Keep the coverage test green. To widen export beyond projects, flip the
per-store `exportable` flag (and update `TEST_PLAN.md` → Data control surface).
**Anchor:** `src/firebase/userDataRegistry.ts`,
`src/firebase/userDataRegistry.test.ts`; UI at MorePage Settings → "Your data"
(`src/pages/MorePage.tsx`).

---

## D5 — Irreversible deletes require a ConfirmSheet; reversible updates do not
**Decision:** Every action that **permanently destroys data** (delete a todo,
log, group, project, shopping list, routine, recurring todo, archived routine,
or "Delete all my data") must be gated by a `ConfirmSheet` *before* the
Firestore write fires — even when an Undo toast follows. Conversely, actions
that are technically a state *update* and therefore reversible — completing a
todo, skipping, deferring, archiving (soft-delete), unarchiving, marking
pending — do **not** require confirmation; they fire immediately (with an Undo
toast where it aids recovery).
**Why:** a destructive swipe/tap is one mis-tap away from unrecoverable loss; a
short Undo window is not a substitute for intent confirmation (the toast can be
missed, auto-dismissed, or lost on navigation). Update actions are cheap to
reverse from the UI, so a confirmation step there is pure friction. The split
keeps confirmations meaningful instead of training users to dismiss them
reflexively. The prior failure mode: HealthDetailPage deleted a health log
straight from a swipe with only an Undo toast, while TimelinePage gated the
*same* log type behind a ConfirmSheet — an inconsistency that this decision
closes.
**How to apply:** a new permanent-delete control sets a `pending…`/`confirm…`
state and renders `<ConfirmSheet danger … />`; the actual delete runs only from
`onConfirm`. Never call a `delete*` store/query action directly from a swipe
`onTrigger` or button `onClick`. Soft-delete (set `archivedAt`) and status
updates stay one-tap. Mirrors the design-language rule "Destructive = confirm +
undo."
**Anchor:** `src/components/rows/TodoRow.tsx:144`/`:149` (swipe → `setConfirmDelete(true)`)
& `:163` (ConfirmSheet); `src/pages/TimelinePage.tsx:270` (`pendingDelete` →
ConfirmSheet); `src/pages/HealthDetailPage.tsx` (`pendingDeleteLog` →
ConfirmSheet); `src/pages/ProjectsPage.tsx`, `RoutinesPage.tsx`,
`GroupDetailPage.tsx`, `MorePage.tsx` ("Delete all my data").

---

## D6 — Pre-auth / first-paint surfaces self-provision tokens + theme (they live outside `.sn-shell`)
**Decision:** Any surface rendered **outside** `AppShell` — the `LoginPage`, the
`index.html` first-paint script, future pre-auth or error/boot screens — must
provision its own design context: import `app-tokens.css`, set its own
`[data-theme]`, and (for a full-viewport root) use the `.sn-shell` pattern
`position: fixed; inset: 0` rather than `100dvh`/`100vh`. They do **not** inherit
the theme attribute or token scope that `AppShell` puts on `.sn-shell`.
**Why:** `--sn-*` tokens are scoped to `[data-theme]`, which only `AppShell`
sets. A surface outside that subtree resolves every token to nothing — the prior
failure was `login.css` referencing dead tracker variables and rendering an
unstyled page, plus a near-miss where `100dvh` on the login root tripped the
viewport-height check (that rule is for scroll pages inside `.sn-content`; a
fixed/inset root is the correct out-of-shell equivalent).
**How to apply:** a new route/screen outside `AppShell` imports
`styles/app-tokens.css`, wraps itself in an element with `data-theme={resolved}`
(resolved via `theme.ts`, see D7), and fills the viewport with `fixed; inset: 0`.
Never assume token/theme inheritance from the shell. Keep viewport-height units
out of these roots so `check:ux` stays clean.
**Anchor:** `src/auth/LoginPage.tsx:10` (`app-tokens` import) & `:61`
(`data-theme`); `src/auth/login.css` (`.login-root` fixed/inset); `index.html:21`
(first-paint script).

## D7 — Theme is a 3-way mode (light/dark/system) defaulting to system, resolved centrally
**Decision:** Theme is `themeMode: 'dark' | 'light' | 'system'` (settings field),
**default `system`**. `system` resolves through `prefers-color-scheme` and reacts
**live** to OS changes (no reload). All resolution, persistence
(`localStorage['sneworks-theme-mode']`), and OS-change subscription live in one
module, `src/theme.ts`; every consumer (AppShell, LoginPage, the `index.html`
first-paint script) resolves through it. The legacy boolean `darkMode` is
deprecated — kept only for back-compat reads, never the source of truth; a
missing `themeMode` falls through to `system`.
**Why:** a single boolean can't express "follow the OS", and duplicated
ad-hoc theme reads (the old `getInitialDark` in two files keyed on
`sneworks-dark`) drift apart and miss live OS changes. Centralizing prevents an
FOUC on first paint and keeps the pre-auth login page in lockstep with the app.
**How to apply:** read/resolve theme only via `theme.ts`
(`resolveTheme`, `getStoredThemeMode`, `storeThemeMode`, `onSystemThemeChange`) —
never re-read `prefers-color-scheme` or the storage key directly. A surface that
honors `system` must register an `onSystemThemeChange` listener gated on the
active mode. New theme-mode UI writes `settings.themeMode`. If a one-time
`darkMode → themeMode` migration is ever wanted, add it at the settings read, not
by reviving `darkMode` as a parallel source of truth.
**Anchor:** `src/theme.ts` (resolution + storage + OS subscription);
`src/firebase/settingsQueries.ts:20` (`themeMode`) & `:35` (default `system`);
`src/AppShell.tsx:98` (OS listener) & `:112` (apply resolved);
`src/auth/LoginPage.tsx:36`; `index.html:24`; UI at MorePage Settings → "Theme".

---

## D8 — Shared projects live top-level, opt-in, editor-only; the ACL is mutated only by functions; owner-erase deletes for all
**Decision:** A shared project moves out of `users/{uid}/groups` into top-level
`sharedProjects/{pid}` (tasks in a `/todos` subcollection); personal projects stay
per-user, distinguished by a `location` discriminator. Sharing is **opt-in** and
migrates data in (share) and out (owner unshare). The `members` map is the ACL —
a **single editor role** — with `ownerUid` tracked separately for owner-only
actions. The `members`/`ownerUid` fields are mutated **only** by callable Cloud
Functions (invite-accept, leave, remove-member); client writes to them are
rejected by rules. Owner account-erase **cascade-deletes the project for
everyone**; a member erasing their account only removes themselves.
**Why:** the app is single-tenant (`request.auth.uid == uid` rules) — a
collaborator can neither see nor be authorized on another user's tree, so shared
data must live somewhere both users can reach. A top-level, **projects-only**
space isolates the blast radius (personal todos/logs/routines untouched) and is
the canonical Firestore multi-tenant pattern. Server-side-only ACL mutation stops
a rogue editor from rewriting membership or escalating. The erase split keeps
tenet-1 erasability honest without destroying a collaborator's own copy of shared
work.
**How to apply:** never grant cross-user access to `users/{uid}/*`. A new shared
entity goes top-level under membership rules **and** gets a `userDataRegistry`
entry (export = projects the user is a member of + tasks; erase = owner cascade /
member leave). Membership changes go through Cloud Functions, never client
writes. Keep `userDataRegistry.test.ts` green.
**Anchor:** `firestore.rules` (`sharedProjects` + `invites`),
`functions/src/index.ts` (`inviteToProject`/`acceptInvite`/`leaveProject`/`removeMember`),
`src/firebase/userDataRegistry.ts`,
[`docs/SHAREABLE_PROJECTS_SPEC.md`](SHAREABLE_PROJECTS_SPEC.md) §1–§3.

## D9 — Realtime collaboration is last-write-wins over snapshots, with ephemeral RTDB presence and a visible remote-change + manual-refresh affordance
**Decision:** Concurrent edits sync via the existing Firestore `onSnapshot`
listeners; conflicts resolve **last-write-wins per field, no locking**. "Active /
editing" presence is **ephemeral** on Realtime Database (`presence/{pid}/{uid}`
heartbeat + `onDisconnect`, entries older than a fixed staleness window treated as
gone) — never persisted to Firestore, never exported/erased as durable data.
Remote edits surface a **visible, non-disruptive affordance** (row highlight /
"updated by X"); a **manual refresh** re-subscribes when snapshots stall.
**Why:** pessimistic locking is overkill for a personal app, and Firestore
already streams changes in real time. Presence is high-churn and disposable, so it
belongs on RTDB with auto-expiry, not in the durable per-user data model (putting
it in Firestore would also make it a registry/export/erase obligation for no
reason). Silent live mutation is disorienting without a "something changed" cue,
and a stalled listener needs a user-visible recovery path rather than a frozen
view.
**How to apply:** don't add locks to shared writes. Presence writes go to RTDB
with `onDisconnect` cleanup and a staleness window; never treat presence as
durable user data (document its N/A in the registry). Any live-updating shared
surface shows a remote-change affordance and offers manual refresh; reconciliation
must not drop local optimistic edits or jump scroll. The persistent shared badge
(shown whenever `memberCount > 1`) is the design-language counterpart — see
`DESIGN_LANGUAGE.md` → Collaboration patterns.
**Anchor:** `firestore.rules`, RTDB `presence/*`, the shared ProjectDetail
snapshot listener, [`docs/SHAREABLE_PROJECTS_SPEC.md`](SHAREABLE_PROJECTS_SPEC.md)
§5.2–§5.3, [`docs/DESIGN_LANGUAGE.md`](DESIGN_LANGUAGE.md) → Collaboration patterns.

## D10 — A `list` query against a rule-guarded shared collection must carry filters that PROVE the rule
**Decision:** Any client `onSnapshot`/`get` **list** query over a collection whose
read rule depends on `resource.data` (e.g. `invites`, `sharedProjects`) must
include `where(...)` filters that constrain exactly the fields the rule checks —
otherwise Firestore rejects the whole query with `permission-denied`. Concretely:
the owner's ShareSheet invite list filters `where('invitedBy','==',ownerUid)`
because the invites rule's owner branch is `request.auth.uid == invitedBy`; the
invitee's banner filters `where('invitedEmail','==',myEmail)` to match the email
branch. Every such subscription also passes an `onSnapshot` error callback (never
the 2-arg form) so a denied/failed listener logs instead of silently returning an
empty list.
**Why:** Firestore does **not** filter a list query's results by rules — it
evaluates whether the query's *constraints* guarantee the rule holds for every
possibly-matched document, and rejects the entire query if not. A rule that reads
`resource.data.invitedBy` is only satisfiable-by-construction if the query pins
that field. The live failure: the owner's invite list queried only
`pid + status` (not `invitedBy`), so it was denied and rendered empty — while the
invitee banner (which pinned `invitedEmail`) worked, masking the cause. The
2-arg `onSnapshot` (no error handler) made it silent, because the SDK tears down a
listener on error and never retries.
**How to apply:** when adding a query over a rule-guarded shared collection, read
the collection's rule first and mirror each `resource.data.X` predicate as a
`where('X','==',…)` in the query (scoping to the current user where the rule
does). Always supply the `onSnapshot` error callback. If a query genuinely needs
to span docs the rule can't prove per-row, move it server-side (callable/Admin
SDK) instead of loosening the rule.
**Anchor:** `firestore.rules` (`match /invites`),
`src/firebase/sharedProjectQueries.ts` (`subscribeToProjectInvites` /
`subscribeToMyPendingInvites` — filters + error callbacks),
`src/components/sheets/ShareSheet.tsx` (owner-only invite subscription).

## D11 — Invite spam is stopped at the source by a recipient block list, enforced server-side, failing neutrally
**Decision:** A user can **block** the sender of an invite. Blocking is stored as
`blockedInviters` (array of `{uid,email,name,blockedAt}`) on the recipient's
`settings/preferences`, keyed by **sender uid**. `inviteToProject` (Cloud
Function) resolves the recipient's account and **refuses to create the invite doc
at all** if the sender is on their block list — so a blocked person can't flood
the recipient. The refusal returns a **neutral error** ("Couldn't send an invite
to this address"), identical to a generic failure, so block status can't be
probed. **Block and decline are separate actions**: decline dismisses one invite;
block (via the `blockInviter` callable) adds the sender to the list **and**
declines all their pending invites to the recipient, atomically. Unblock is a
plain client write to the user's own settings (no cross-user side effects).
Invites live at `/invites` (all of them, with a Blocked-senders section to
unblock); Today shows the top 2 with a "See all" link.
**Why:** an Undo/decline-only model still lets a malicious sender flood a user's
home screen indefinitely — the user asked for a hard "never allow from this
person" that can't be worked around. Enforcing at invite-creation (not just
hiding on read) means blocked invites never reach Firestore, so there's nothing
to flood. Neutral failure prevents using the invite endpoint as a block-status
oracle (harassment/retaliation vector). Block-by-uid (not email) survives the
sender changing display name and is the stable identity; keeping name+email
alongside is display-only for the unblock UI.
**How to apply:** never surface "you are blocked" to a sender — reuse the neutral
send-error string. Any new invite-creation path must run the same block check
before writing. Membership/invite-status mutations with cross-user effects (block,
decline-others) stay in Cloud Functions; only side-effect-free self edits
(unblock) may be client writes. `blockedInviters` rides on `settings`, already in
the data registry (tenet 1) — it exports/erases with the account.
**Anchor:** `functions/src/index.ts` (`inviteToProject` block check +
`invitedByEmail`; `blockInviter` callable),
`src/firebase/settingsQueries.ts` (`BlockedInviter`, `blockedInviters`,
`unblockInviter`), `src/pages/InvitesPage.tsx`,
`src/components/sharing/PendingSharesBanner.tsx` (top-2 + See all),
UI entry at MorePage → "Invites".

## D12 — Sharing generalizes to any shareable group under one `sharedProjects` collection; sharing is a group capability, not a project feature
**Decision:** The single top-level `sharedProjects` collection holds **any
shareable group**, discriminated by `groupKind`. **Projects and shopping lists are
shareable; routines and recurring-todos are not** (they're personal spawning
mechanics). All of D8–D11 apply unchanged to every shareable kind — one
migration/membership/invite/presence/blocking mechanism, parameterized by
`groupKind`, never a parallel per-kind stack. Shopping lists are the single-layer
case (no sub-groups). The `sharedProjects` name is kept as-is (a bare Firestore
collection label, invisible to users); no rename, so there is **nothing to
migrate** — shopping lists simply start writing into the same collection projects
already use.
**Reversal note:** an earlier revision of D12 renamed the collection
`sharedProjects` → `sharedGroups` so the name read honestly. That rename was
**reverted**. The rename was cosmetic but forced a one-time cross-collection data
migration; the migration was a callable Cloud Function that Cloud Run refused to
expose publicly (the newly-created service never got the `allUsers → run.invoker`
binding — an org-policy block), so existing shared projects were stranded in the
old-named collection and data appeared duplicated. Keeping the original name
eliminates the migration, the one-shot function, and the duplication entirely.
Lesson: don't rename a live collection for cosmetics when the name is not
user-visible — the migration cost and failure surface dwarf the readability gain.
**Why:** shared projects and shared shopping lists are the same collaboration
primitive — a group of items with a member ACL — differing only in item shape and
nesting depth. A second parallel `sharedShoppingLists` collection (with cloned
functions/store/rules) would double the surface area and let the two drift (the
exact failure D4/D8 guard against). Generalizing keeps one code path, one rules
block, one presence namespace. Export stays **projects-only** (D4) via a
`groupKind` filter, so generalizing storage doesn't silently widen the export
surface.
**How to apply:** a new shareable group kind → allow it in
`readPersonalGroupFamily`'s kind guard (`functions/src/index.ts`) and render its
detail page with the shared wiring; never fork a per-kind shared collection/function
set. Keep `exportSharedProjects` filtered to `groupKind === 'project'` until export
scope is deliberately widened. Any surface that lists a shareable kind (Today, More,
Projects, group/list detail) must merge the shared store + show `SharedBadge`,
mirroring the projects surfaces.
**Anchor:** `firestore.rules` (`match /sharedProjects`), `functions/src/index.ts`
(`readPersonalGroupFamily` kind guard), `src/firebase/sharedProjectQueries.ts`,
`src/stores/useSharedProjectsStore.ts`, `src/pages/GroupDetailPage.tsx` (shared
wiring), `docs/SHAREABLE_PROJECTS_SPEC.md` §8.

---

## D13 — Shared vs. personal groups are deliberately near-identical UX; no "unshare / make personal" flow
**Decision:** A shared group and a personal group present the **same core
experience**. The only user-visible differences are the `SharedBadge` and a Share
entry point; the collaborative machinery (presence avatars, live remote-update
highlight, manual refresh) only carries meaning once a group has **>1 member**.
There is intentionally **no** owner-facing "unshare" / "make personal" / "convert
to personal" control, even though an `unshareProject` Cloud Function exists — it
stays an internal capability, unwired to UI.
**Why:** for a single-member shared group the delta over a personal one is one
icon, so an explicit unshare action changes nothing the user can perceive — it's
UI weight and a support burden for ~zero value. An owner who wants to stop
collaborating just removes the other members in the ShareSheet, which already
yields an effectively-personal group (badge drops). Building a dedicated convert
flow would also reintroduce cross-tree data movement (shared collection ↔ personal
`users/{uid}` subtree) — the exact migration surface D12's reversal just removed.
**How to apply:** don't add an unshare/convert button or a "shared vs. personal"
mode toggle. Keep the personal and shared detail pages rendering the same
primitives, diverging only on the badge + member-count-gated collaborative
affordances. To de-collaborate, the owner removes members via `ShareSheet`; the
single-member doc stays in `sharedProjects` and simply loses its badge.
**Anchor:** `src/components/sheets/ShareSheet.tsx` (member removal is the only
"reduce sharing" path), `src/pages/GroupDetailPage.tsx` /
`src/pages/ProjectDetailPage.tsx` (shared wiring gated on member count),
`src/firebase/sharedProjectQueries.ts` (`unshareProject`, intentionally UI-less).

---

## D14 — AI-connector starter: self-hosted MCP + AI-flagged trigger + server-side execution for low-risk connectors
**Decision:** The first "AI decides which connector to call" slice (task text →
resolve date → create a Google Calendar reminder) is built as three deliberate
choices that later connectors should follow or consciously revisit:
1. **Connectors are reached through MCP servers we host ourselves** — starting
   with `services/gcal-mcp` on Cloud Run (same `sneworks-app` GCP project), a
   remote Streamable-HTTP MCP server exposing one `create_event` tool, gated by a
   bearer token. Not a hosted aggregator, not stdio.
2. **AI runs only on explicitly AI-flagged tasks** — an "AI assist" toggle in the
   task compose form sets `aiAssist: true`; the `processAiTask` Firestore trigger
   no-ops on every other write. AI never runs on all user writes.
3. **Low-risk connectors execute server-side during the Claude call** (Anthropic's
   MCP connector runs the tool) with **no propose/approve gate**. The
   decide→propose→approve→execute split is reserved for **high-stakes** connectors
   (payments, outbound messages) and is deliberately absent here.
Also: the AI outcome fields (`aiProcessedAt`/`aiResult`/`aiError` on
`users/{uid}/todos`) are **server-written but not rules-locked**, because those
todos are owner-scoped (see the comment in `firestore.rules`).
**Why:** MCP is the reusable connector interface the broader vision needs, so we
invest in it on a low-stakes connector first. Flag-gating keeps AI cost bounded
and makes the trigger surface explicit. Server-side execution is acceptable *only*
because a calendar reminder is reversible and low-blast-radius — the moment a
connector spends money or messages a third party, the approval gate becomes
mandatory (untrusted task text must not flow straight into an irreversible
action). Field-locking owner-scoped personal data adds rules-restructure risk for
no security gain, unlike the multi-user `sharedProjects` lock.
**How to apply:** new low-risk connectors can reuse this shape (own MCP server +
flag-gated trigger + server-side execution). **Do not** extend server-side
auto-execution to a high-stakes connector — add the proposed-action record +
human approval step first. Keep the AI-assist trigger gated on an explicit flag,
never "run on every task."
**Anchor:** `services/gcal-mcp/` (MCP server), `functions/src/ai/processAiTask.ts`
(trigger + MCP connector call + `pause_turn` loop), `src/components/sheets/ComposeSheet.tsx`
(AI-assist toggle), `firestore.rules` (owner-scoped AI-field comment).

---

## D15 — In-app agent: off-by-default, Firestore-doc transport, in-function Admin-SDK tools, risk-gated writes
**Decision:** The conversational agent (`assistantAgent`) is a Firestore-triggered
Cloud Function that runs an Anthropic Tool Runner loop over the user's own data.
Four sub-calls are fixed: (1) **off by default** — gated on
`settings.assistantEnabled` (absent from `DEFAULT_SETTINGS`); the trigger no-ops
and the UI entry point hides unless on. (2) **Transport is Firestore docs** —
the client appends a user `message` doc; the function writes the assistant reply;
chat is a **registered user-data store** (`chatSessions` in `userDataRegistry.ts`,
erase-cascades its `messages`/`proposedActions` subcollections, non-exportable).
(3) **Tools are in-function Admin-SDK ports** (not MCP) for in-app CRUD, targeting
`users/{uid}/{todos,logs,groups}`, with `uid` bound at construction so the model
can never supply it. (4) **Risk classification** — read + low-risk writes
auto-execute; destructive tools (delete / bulk) are withheld until they can sit
behind a propose→approve→execute gate (Phase 2). Model default `claude-sonnet-5`;
per-user daily rate limit; a system-prompt injection-defense clause treats all
todo/log/group text as data, never instructions.
**Why:** A feature that acts on user data must be opt-in and fully
data-controllable (tenet 1). Firestore-doc transport survives the stateless
function boundary and gives free realtime sync + persisted history. In-function
Admin-SDK tools (vs. an MCP hop like D14) fit trusted in-app data. Auto-executing
only reversible low-risk writes while gating destructive ones mirrors the app's
ConfirmSheet convention (D5) and the D14 low-vs-high-stakes split — untrusted item
text must never flow straight into an irreversible action.
**How to apply:** New agent tools inherit the risk rule — reversible/low-risk may
auto-run; anything destructive or outbound must go through the approval gate
before it executes (do not add a `delete_*`/bulk tool that auto-runs). Keep the
`assistantEnabled` flag; never run the agent for users who haven't opted in. Any
new `users/{uid}/*` collection the agent writes must be registered in
`userDataRegistry.ts` (or `userDataRegistry.test.ts` fails).
**Phase-2 realization (approval gate):** a destructive tool's `run()` never mutates
— it writes a `proposedActions/{aid}` doc and returns a "stop, await approval"
result; the session ends `awaiting-approval`. Approval is a plain owner write
(`status: approved|rejected`) that a **separate** `resumeAgent`
(`onDocumentUpdated`) reacts to. **We execute deterministically from the stored
`{tool, args}` (an executor dispatch), NOT by resuming the model's Tool Runner
loop.** Why: serializing a suspended toolRunner across the stateless-function
boundary is fragile, and re-invoking the model would let intervening/injected
content re-steer an already-approved action; a fixed executor keeps
approve→execute exact and un-hijackable. Idempotency via an `executedAt` guard on
the proposal doc (safe against at-least-once redelivery). If a future action needs
post-execution model reasoning, add it explicitly — do not make the gate re-run the
model by default.
**Anchor:** `functions/src/ai/assistantAgent.ts` (trigger + Tool Runner loop +
gate + rate limit), `functions/src/ai/agentTools.ts` (Admin-SDK tools + `propose`
+ `executeProposedAction`), `functions/src/ai/resumeAgent.ts` (approve/reject
executor), `src/firebase/userDataRegistry.ts` (`chatSessions` registration),
`src/firebase/chatQueries.ts`, `src/pages/AssistantPage.tsx` (approval card).

---

## How to add a decision
When you make a deliberate cross-cutting call (something a future change could
plausibly undo without realizing it was intentional), add an entry: state the
decision, the **why** (the failure it prevents), how to apply it, and the
file:line anchor. An undocumented decision is one iteration away from being
reverted.
