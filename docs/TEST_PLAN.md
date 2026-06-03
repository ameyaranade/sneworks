# sneworks — Test Plan (state machine)

Tests treat each surface as a **state machine**: enumerate the data + UX states,
assert each one *looks and behaves as expected*, then assert each *transition*
between them. A single happy-path click-through is not a test plan — it proves
one edge of the graph and ignores the rest.

Enforced by the `ux-invariants-build` skill (tenet 3). When a change adds a
state or transition, add it here and verify it. Tooling: Vitest (`npm test`) for
unit/component, Playwright (`npm run test:e2e`) for flows.

**Coverage:** every route in `App.tsx`, every sheet, and the cross-cutting
systems (auth, cache, spawner, theme, nav/FAB, toast, swipe). A surface that
isn't listed here is untested by definition — add it before shipping it.

---

## Baseline state set (every data-driven surface must consider these)
| State | Meaning | What to assert |
|-------|---------|----------------|
| **empty** | no data (first run / last item deleted) | `EmptyState` shows, no broken layout |
| **cache-first-paint** | stale cache renders before Firestore | cached data visible instantly, then reconciles without flicker/dupes |
| **loading** | in-flight, no data yet | skeleton/spinner, no layout shift on resolve |
| **populated** | typical data | correct ordering, grouping, counts |
| **boundary** | long strings / 0 / negative / huge / one / many / missing optionals | no overflow, no NaN, no broken truncation |
| **error** | write fail / offline / permission denied | recoverable Toast, UI not dead |
| **optimistic-pending** | local change before server confirm | change shown immediately; defined behavior if the write later fails |
| **offline/reconnect** | no network, then restored | cache serves; snapshot reconciles on reconnect |
| **concurrency** | same data changed in another tab/device | snapshot reconciles, no dupes or loss |

## Baseline transitions (every mutating surface)
- create → populated · delete-last → empty · edit → populated(updated)
- submit → optimistic-pending → populated | error → retry → populated
- navigate away + back → state preserved, one-shot signals **not** replayed
- destructive action → ConfirmSheet → (confirm → gone + Undo toast) | (cancel → unchanged)

**Transition assertions:** no flash of wrong intermediate UI, no ghost rows, no
"deleted" item reappearing after the next snapshot.

---

# Page surfaces

## Surface: TodayPage (`/`)
Sections: Overdue · Up Next · Shopping · Projects · Done Today · Today's Logs.

**States**
- [ ] empty — no todos/logs today → each section hidden or EmptyState; page scrolls cleanly; nav + FAB still visible.
- [ ] cache-first-paint — todos appear from cache before Firestore snapshot; counts don't jump.
- [ ] loading — cold start, no cache → no dead frame; nav present (D1).
- [ ] populated — overdue (`dueAt < startOfToday`) and up-next correctly split; project-grouped + shopping items **excluded** from Overdue/Up Next; grouped routine items render as collapsible group cards (collapsed by default) with `pending·done/total` counts.
- [ ] boundary — very long todo title (truncates, no overflow); 50+ items; a group with 0 done vs all done; a money-reminder with huge/zero/negative amount.
- [ ] optimistic-pending — completing a todo moves it to Done Today immediately, before server confirm.
- [ ] error — complete fails → Toast surfaced, item state stays consistent with store (no rollback per architecture).

**Transitions**
- [ ] complete last up-next item → Up Next empties, item appears under Done Today.
- [ ] check ungrouped shopping item first time today → auto-trip group `Shopping:dd-mm-YYYY` created, item moves into it.
- [ ] open Add via FAB, navigate back → add sheet does not re-open (one-shot `location.state` consumed via `replaceState`).
- [ ] delete a group → all its todos (incl. deferred) gone; none reappear after snapshot (uses `removeAllTodosForGroup` + `deleteAllTodosForGroup`).
- [ ] swipe a row → complete/defer/skip/delete/unmark (see Swipeable rows surface).
- [ ] tap group card header → expands/collapses; state local, not persisted.

## Surface: RoutinesPage (`/routines`)
Sections: Active routines · Recurring todos · Archived routines.

**States**
- [ ] empty — no routines → EmptyState + "New routine" entry point.
- [ ] cache-first-paint — routine cards from cache; streak/`0/N today` counts reconcile.
- [ ] populated — Daily/weekly badge per recurrence (`recurrenceLabel`); `N/M today` progress; streak fire icons; archived section collapsed.
- [ ] boundary — routine with 0 template items; 1 vs many items; long routine name; multi-day `weekly:MON,WED,FRI` badge.
- [ ] optimistic-pending — archive/unarchive reflects immediately.
- [ ] error — archive write fails → Toast, card state consistent.

**Transitions**
- [ ] create routine → appears in Active.
- [ ] archive routine → ConfirmSheet → moves to Archived, spawned-but-incomplete handling correct (archive uses `deletePendingTodosForGroup`, keeps completed history).
- [ ] delete archived routine → ConfirmSheet → gone + Undo; all todos incl. deferred removed, none reappear.
- [ ] edit recurring todo → EditRecurringSheet → values update in place.
- [ ] tap routine card → navigates to `/routines/:routineId`.

## Surface: RoutineDetailPage (`/routines/:routineId`)
**States**
- [ ] empty — routine with no spawned items today → EmptyState/today-empty copy.
- [ ] not-found — invalid `:routineId` → graceful (redirect or NotFound-style), not a crash.
- [ ] populated — today's spawned items list, template list, recurrence label, defer state.
- [ ] boundary — deferred routine (`deferUntil` set); long template; many items.

**Transitions**
- [ ] complete an item → reflected here and on Today.
- [ ] defer routine → DeferSheet → `deferUntil` set, items adjust.
- [ ] edit template → changes persist and re-spawn correctly next due day.
- [ ] delete routine here → ConfirmSheet → cascade cleanup, navigate back to `/routines`.

## Surface: TimelinePage (`/timeline`)
**States**
- [ ] empty — no logs → EmptyState.
- [ ] cache-first-paint — logs from cache; "THIS WEEK SPENT" total reconciles.
- [ ] populated — day-grouped chronological logs; expense (red, negative), income, health, generic-note icons; weekly spend summary card correct.
- [ ] boundary — log with zero/huge amount; very long title/notes; single log; 100+ logs; logs spanning many days.
- [ ] error — log delete/edit fails → Toast.

**Transitions**
- [ ] tap a log → opens ComposeSheet edit prefill.
- [ ] edit log amount → weekly total recomputes.
- [ ] delete log → ConfirmSheet → gone + Undo; total recomputes; no ghost row.

## Surface: MorePage (`/more`)
Sections: Shopping lists · Items to buy · Projects nav · Settings.

**States**
- [ ] empty — "No ungrouped items"; no shopping lists → EmptyState per section.
- [ ] populated — active shopping lists as cards; ungrouped items list with inline add; Projects collapsed; Settings button.
- [ ] boundary — long list name; many lists; many ungrouped items.

**Transitions**
- [ ] add ungrouped item inline → appears in Items to buy.
- [ ] create new list → appears in Shopping lists.
- [ ] open Settings → settings panel/section (dark mode + font scale).
- [ ] toggle dark mode → `data-theme` flips on `.sn-shell`, persists to settings + `localStorage['sneworks-dark']`; every surface re-themes (tenet 2: both themes correct).
- [ ] change font scale → `data-font` flips, `--sn-font-scale` applies app-wide, persists.

## Surface: GroupDetailPage (`/groups/:groupId`) — shopping list checklist
**States**
- [ ] empty — list with no items → EmptyState + inline add.
- [ ] not-found — invalid `:groupId` → graceful.
- [ ] populated — checklist; price-tracking column when enabled; `totalSpent` sum; done/total progress.
- [ ] boundary — item with no price; huge price; long item name; all checked (group completes); many items.
- [ ] optimistic-pending — checking an item updates progress immediately.

**Transitions**
- [ ] check all items → group `completed` + `completedAt` set (`recomputeGroupCounts`).
- [ ] inline add item → appears, counts update.
- [ ] edit price → `totalSpent` recomputes.
- [ ] delete item → ConfirmSheet → gone + Undo.
- [ ] archive list → moves to Archived (MorePage), history kept.

## Surface: ProjectsPage (`/projects`)
**States**
- [ ] empty — "No active projects" empty state; Completed/Archived collapsed.
- [ ] populated — active project cards; Completed + Archived sections.
- [ ] boundary — project with 0 tasks; deep nesting; long name; deadline past/future.

**Transitions**
- [ ] create project → appears in Active.
- [ ] complete all tasks → project moves to Completed (propagation via `recomputeGroupCounts`).
- [ ] archive/delete project → ConfirmSheet → cascade cleanup.
- [ ] tap project → `/projects/:projectId`.

## Surface: ProjectDetailPage (`/projects/:projectId`)
**States**
- [ ] empty — project with no sub-projects/tasks → EmptyState.
- [ ] not-found — invalid id → graceful.
- [ ] populated — Sub-projects (hidden when `ancestorPath.length >= 1`, max 2 levels) + Tasks; progress bar.
- [ ] boundary — max-depth sub-project; many tasks; long titles.

**Transitions**
- [ ] add sub-project → appears (only at top level).
- [ ] add task → appears, counts update.
- [ ] complete task → progress updates, propagates to parent.
- [ ] delete project → ConfirmSheet → cascade removes child todos + sub-groups; navigate back.

## Surface: HealthDetailPage (`/health`) — hub
Sections: active routine cards · archived routines · log history · streak/week stats.

**States**
- [ ] empty — no health routines, no health logs → EmptyState + "New routine" / log entry point. (Re-verify: this rendered blank in live exploration — confirm it's a true empty state and not a dead frame.)
- [ ] cache-first-paint — routine cards + stats from cache.
- [ ] loading — no dead/blank frame; nav present.
- [ ] populated — health routine cards (goal rings, weekly chart preview); log history list; streak + this-week stats.
- [ ] boundary — routine with no logs (0% rings); calorie/duration goals at 0; one log vs many; missing optional fields (no distance/sets).

**Transitions**
- [ ] log a workout → appears in log history; week stats + rings update.
- [ ] tap routine card → `/health/routines/:routineId` dashboard.
- [ ] new routine → `/health/routines/new`.
- [ ] archive/delete health routine → ConfirmSheet → cascade.

## Surface: HealthRoutineEditPage (`/health/routines/new` + `/:routineId/edit`)
**States**
- [ ] create mode — empty form: schedule, goals, workout items, task items.
- [ ] edit mode — prefilled from existing `RoutineGroup` (every field, incl. goals + each `templateChildren` item).
- [ ] not-found (edit) — invalid id → graceful.
- [ ] boundary — 0 items; many items; workout vs generic-task template item (`isWorkout` discriminator); multi-day `weekly:` recurrence via day picker; goals empty vs set.
- [ ] validation — required fields (name, at least schedule) gate submit.

**Transitions**
- [ ] save create → routine appears on `/health` + `/routines`; spawner picks it up next due day.
- [ ] save edit → values persist; template change re-spawns correctly.
- [ ] add/remove template item → list updates; sort order stable.
- [ ] cancel → no write.
- [ ] page uses `min-height: 100%` (not `100dvh`) — no extra scroll (CLAUDE.md shell rule).

## Surface: HealthRoutineDashPage (`/health/routines/:routineId`) — daily dashboard
**States**
- [ ] empty — routine with no items today / nothing logged → 0% rings, empty checklist.
- [ ] not-found — invalid id → graceful.
- [ ] populated — progress bar, GoalRings (calories/duration), WeeklyBarChart, WorkoutCards (target vs logged), task checklist.
- [ ] boundary — over-goal (>100% ring clamps); goal of 0 (no divide-by-zero/NaN); long activity names; missing optional targets.

**Transitions**
- [ ] tap workout card "log" → ComposeSheet health-log prefilled from template (`openComposeHealthLog(prefill)`).
- [ ] save that log → matching spawned todo (`groupId===sourceRoutineId && sortOrder===sourceTemplateIdx`) marked done; rings/chart update.
- [ ] check a task item → checklist + progress update.

## Surface: HealthProfilePage (`/health/profile`)
Single editable field: body weight (drives `calcCalories`).

**States**
- [ ] loading — `getSettings` in flight → form hidden until resolved (no flash of empty field).
- [ ] empty — no saved `healthWeightKg` → blank input with placeholder, autofocus.
- [ ] populated — existing weight prefilled from settings.
- [ ] boundary — value at min 20 / max 300; non-numeric / blank (saves `null`); decimal step 0.5.
- [ ] saving — Save disabled + "Saving…" label while write in flight.
- [ ] error — save fails → error Toast, stays on page, button usable again.

**Transitions**
- [ ] save → "Health profile saved" toast → navigate `/health`; future calorie estimates use new weight.
- [ ] cancel / back → no write, return to `/health`.
- [ ] weight input uses theme-correct `color-scheme` (native number spinner).

## Surface: LoginPage (`/login`)
**States**
- [ ] unauthenticated — Google sign-in button, no app chrome.
- [ ] in-progress — popup open; button disabled/spinner.
- [ ] error — popup closed/blocked/denied → recoverable message, button usable again.
- [ ] already-authed — visiting `/login` while signed in → redirect into app.

**Transitions**
- [ ] sign-in success → `sneworks_auth_hint` saved (7-day TTL), redirect to `/`.
- [ ] sign-out (from Settings) → `clearAllCache()` wipes `sneworks*` keys, back to `/login`.

## Surface: NotFoundPage (404)
**States**
- [ ] populated — unknown route → "404 Page not found" + "Go home" link.
**Transitions**
- [ ] "Go home" → `/`.

---

# Sheet surfaces

## Surface: ComposeSheet (create/edit, all todo + log types)
**States**
- [ ] type-picker — opened via FAB with no type → shows todo/log type picker.
- [ ] form (per todo type) — money-reminder / shopping-item / generic-task render correct fields (amount/category, quantity/price, plain).
- [ ] form (per log type) — expense / income / generic-note / health-log render correct fields.
- [ ] edit prefill — `openComposeForEdit(entry)` populates every field of that type.
- [ ] group-preselect — `openComposeForGroup(groupId, todoType?)` pre-fills group.
- [ ] boundary — empty required field → submit disabled/validated; huge amount; long notes; zero/negative amount.
- [ ] health-log conditional fields — distance shows only for distance activities; sets/reps only for `showsSetsReps`; calories auto-estimate via `calcCalories`.

**Transitions**
- [ ] submit create → sheet closes, item appears in the right surface (optimistic).
- [ ] submit edit → values update in place.
- [ ] health log with `sourceRoutineId`+`sourceTemplateIdx` → matching spawned todo marked done.
- [ ] cancel / scrim-tap / Escape → no write, sheet closes, no partial state (D3: modal, focus-trapped).
- [ ] sheet portals to `#sn-portal` inside `[data-theme]` → fully themed, not transparent (CLAUDE.md portal rule).

## Surface: DeferSheet
**States**
- [ ] open — date/time picker with theme-correct native chrome (`color-scheme: var(--sn-color-scheme)`).
- [ ] boundary — defer to today / far future / past (rejected or clamped).

**Transitions**
- [ ] pick date → `dueAt`/`deferUntil` set, item leaves current view as expected.
- [ ] cancel → no change.

## Surface: EditRecurringSheet
**States**
- [ ] open — prefilled `RecurringTodoGroup` fields (type, recurrence, amount/category).
- [ ] boundary — change recurrence string (daily/weekdays/weekly/monthly…); empty name validation.

**Transitions**
- [ ] save → group updates; future spawns use new recurrence.
- [ ] cancel → no change.

## Surface: ConfirmSheet (shared destructive gate)
**States**
- [ ] open — title + message + Cancel/Confirm; `danger` → red confirm.
- [ ] focus-trapped, Escape/scrim closes (D3).

**Transitions**
- [ ] confirm → action fires + Undo toast where applicable.
- [ ] cancel → nothing changes.
- [ ] required before **every** delete/archive across the app (affordance parity, tenet 2).

## Surface: Swipeable rows (`TodoRow` / `SwipeableRow`)
**States**
- [ ] resting — row flat, actions hidden (z 0–1, under nav).
- [ ] revealed — swipe exposes action set (complete/defer/skip/delete/unmark).
- [ ] boundary — long title under revealed actions; rapid swipe; swipe on a done vs pending row (different actions).

**Transitions**
- [ ] swipe → complete → moves to Done Today + Undo toast.
- [ ] swipe → defer → DeferSheet.
- [ ] swipe → delete → ConfirmSheet → gone + Undo.
- [ ] swipe → unmark (on done row) → returns to pending.
- [ ] partial swipe release → snaps back, no stuck half-open row.

## Surface: Data control — Export & Erase (Settings → "Your data")
Tenet-1 account-level controls. Registry: `src/firebase/userDataRegistry.ts`.

**Export (projects only)**
- [ ] empty — no projects → export still produces a valid file with empty `projects`/`projectTasks` arrays (no crash).
- [ ] populated — project groups (top-level + sub-projects) + their tasks included; JSON downloads as `sneworks-projects-YYYY-MM-DD.json`.
- [ ] boundary — many projects / many tasks; project with no tasks; archived project still exported.
- [ ] in-progress — button shows "Exporting…" + disabled while building.
- [ ] error — build/download fails → error Toast, button re-enabled.
- [ ] scope — only the `groups` store is `exportable`; coverage test asserts this (`userDataRegistry.test.ts`).

**Erase (everything)**
- [ ] confirm-gated — "Delete all my data" opens `ConfirmSheet` (danger); nothing deleted on cancel.
- [ ] populated → wiped — confirm iterates every registry store (todos/logs/groups/settings), batch-deletes all docs, clears all `sneworks*` cache, signs out, lands on `/login`.
- [ ] boundary — >400 docs in a collection → batched commits (no single-batch overflow).
- [ ] error — a wipe fails mid-way → error Toast, user not silently left half-erased without feedback.
- [ ] registry coverage — adding a new collection without registering it fails `userDataRegistry.test.ts` (export/erase can't silently miss a store).

---

# Cross-cutting systems (verified across surfaces, not one page)

## Auth + optimistic auth
- [ ] cold load, no hint → `/login`.
- [ ] refresh with valid `sneworks_auth_hint` → `optimistic=true`, app renders immediately without waiting for Firebase confirm.
- [ ] hint expired (>7 days) → falls back to real auth check.
- [ ] session expiry / sign-out → `clearAllCache()`, redirect `/login`, no stale data flash.

## Cache first-paint (todos / logs / groups stores)
- [ ] each store seeds synchronously from `sneworks_{uid}_{key}` before Firestore.
- [ ] Timestamp revival correct (`{__firestoreTimestamp}` → `Timestamp`); no `Invalid Date`.
- [ ] snapshot reconciles cache without flicker, dupes, or dropped optimistic edits.
- [ ] logout clears all `sneworks*` keys (also part of erase — see data-control gap).

## Spawner (routineSpawner)
- [ ] runs once per session after `groupsLoaded` (guarded by `useRef`); not re-run on every render.
- [ ] `lastSpawnedAt === today` → skips (no double-spawn).
- [ ] `daily` / `weekdays` / `weekly:X` / multi-day `weekly:X,Y` / `monthly:N` / `quarterly:N` / `yearly:N` each spawn on the right day (`isDueToday`).
- [ ] recurring-todo group spawns one todo per due date; health routine spawns template items with correct `dueAt`/`groupId`/`sortOrder`.

## Theme + font scale
- [ ] `data-theme=dark|light` on `.sn-shell` → every surface, every sheet (via `#sn-portal`), and native inputs render correctly in **both** (tenet 2 hard rule).
- [ ] `data-font=small|medium|large` → `--sn-font-scale` applied app-wide via `calc(13px * var(--sn-font-scale))`.
- [ ] first-paint seeds theme from `localStorage['sneworks-dark']` (no flash of wrong theme).

## Nav + FAB (D1)
- [ ] BottomNav + SplitPillFAB persist across all route changes, including during a lazy page's Suspense (no navless frame).
- [ ] FAB left (Log) → `openComposeLog()`; right (TODO) → `openComposeTodo()`.
- [ ] active tab highlight matches route; 44px+ touch targets.
- [ ] safe-area bottom padding present (D2) — nav not under home indicator on notched PWA.

## Toast (`useToast`)
- [ ] success/info/error variants render; sits above sheets (z 300, D3) so Undo is always reachable.
- [ ] Undo action restores deleted entity (todo/log/group) fully.
- [ ] auto-dismiss timing; stacking multiple toasts; long message wraps.

## Mechanical floor
- [ ] `npm run check:ux` → zero hits (no hardcoded color literals, no `100dvh/100vh` on pages, no literal `color-scheme`). Clean baseline as of 2026-06-03 — keep it zero.

---

# Known coverage gaps (open work, not yet a state to test)
- **Export breadth** — export is intentionally **projects-only** for now (registry `exportable` flag). Todos/logs/settings are CRUD-from-UI but not in the export bundle yet; widen the registry flags + this surface when that changes.
- **Streak auto-computation** — `streakCount` is not auto-incremented yet; no transition to test until built.
- **Offline beyond cache** — no service worker; offline/reconnect states above are limited to cache behavior.

---

## How to add a surface here
1. List its reachable states (start from the baseline set; drop the N/A ones with a reason).
2. List its transitions (start from the baseline transitions).
3. For each, write the expected look/behavior, then cover it with a Vitest
   component test or a Playwright flow. Check the box when verified.
