# UX Invariants Checklist (draft)

A review gate for any feature touching UI or user data. The goal: catch the
"inconsistencies Claude didn't add" *before* handoff, so they don't become
review iterations.

Two halves:
- **Reusable core** — generic invariants that apply to any app with users + data.
- **Project layer** — sneworks-specific checks (swap this section per project).

Each item is phrased so it can be answered yes/no/N-A. If an item is N/A, say
why in one line — an explicit "N/A because…" is the signal that it was
considered, not skipped.

---

## REUSABLE CORE

### 1. Data lifecycle & user control
*Principle: every piece of user data must be reachable, editable, exportable, and erasable. If a user created it, they can see all of it and delete all of it.*

For each **new data type / collection / field** introduced:
- [ ] **Create** — user can produce it through the UI (not just seeded/migrated).
- [ ] **Read** — it is visible somewhere; nothing is write-only or orphaned.
- [ ] **Update** — user can edit it (or it's explicitly immutable by design).
- [ ] **Delete** — user can remove the individual item, with confirmation for destructive deletes.
- [ ] **Cascade** — deleting a parent cleans up *all* children (incl. non-obvious states: deferred, archived, draft, optimistic-pending). No orphans left behind a status filter.
- [ ] **Export / retrievable** — the data type is included in whatever "export my data" / account-data path exists. A new type that's invisible to export is a silent gap.
- [ ] **Erase / account wipe** — included in the "delete everything" path. New collections must be added to the erase routine, not forgotten.
- [ ] **Local/cache copies** — any cached/localStorage/IndexedDB copy is cleared on logout and on erase. No user data survives sign-out on a shared device.

### 2. Visual & interaction consistency
*Principle: a new surface should look and behave like it was always part of the app.*

- [ ] **Tokens only** — colors/spacing/typography come from the design-token system, no one-off hardcoded values.
- [ ] **Theme correctness** — renders correctly in *every* theme (dark/light/high-contrast). Native controls (date/color/select) respect the theme.
- [ ] **Reuse over reinvent** — uses existing primitives (buttons, sheets, rows, empty states) instead of a bespoke variant.
- [ ] **Spacing & rhythm** — matches the app's spacing scale; aligns with sibling sections.
- [ ] **Affordance parity** — same action looks the same everywhere (e.g. all destructive buttons styled alike; all "add" entry points behave alike).
- [ ] **Touch targets** — interactive elements meet the minimum hit size.
- [ ] **Copy & casing** — labels match the app's voice/casing conventions; no stray emoji in structural UI if the app forbids it.
- [ ] **Loading/disabled/active states** — every interactive element has visible feedback for each state, consistent with peers.

### 3. State-machine test coverage
*Principle: test the states and transitions, not one happy-path click-through. A single user flow proves one path works and says nothing about the other seven.*

Enumerate the states the surface can be in, then verify each:
- [ ] **Empty** — no data yet (first run, after deleting the last item).
- [ ] **First paint from cache** — stale cache shows instantly, then reconciles with server.
- [ ] **Loading** — in-flight, before first data.
- [ ] **Populated** — typical data.
- [ ] **Boundary data** — very long strings, 0 / negative / huge numbers, missing optional fields, one item, many items.
- [ ] **Error** — write fails, network down, permission denied. User sees a recoverable message, not a dead UI.
- [ ] **Optimistic-pending** — local change applied before server confirms; behavior on subsequent failure is defined.
- [ ] **Offline / reconnect** — what the user sees offline and when connectivity returns.
- [ ] **Concurrency** — same data changed in another tab/device; the snapshot/subscription reconciles without duplicating or losing items.

And the **transitions** between them:
- [ ] Each action moves between states predictably (create → populated, delete-last → empty, error → retry → populated).
- [ ] Back/forward navigation and re-entry don't replay one-shot signals (e.g. an "open add sheet" flag firing again on back).
- [ ] No transition strands the user (a delete that leaves a ghost row; a defer that reappears).

### 4. Accessibility & robustness (lightweight)
- [ ] Keyboard reachable; focus visible and trapped in modals/sheets.
- [ ] Meaningful labels on icon-only buttons.
- [ ] Color is not the only carrier of meaning.
- [ ] Respects reduced-motion if the app animates.

### 5. Definition of done (process)
- [ ] Ran the deterministic check script (Layer A) — zero hits.
- [ ] Walked sections 1–4 above and answered each item or marked N/A with a reason.
- [ ] Verified the change in the running app, exercising the *state list* in §3 — not a single flow.
- [ ] Listed what was verified vs. what couldn't be (e.g. "couldn't test offline").

---

## MECHANICAL CHECKS (Layer A — make these a script + hook)
*These are pass/fail by grep; they should never depend on the model remembering.
Express the project's hard rules as patterns so CI/a hook can enforce them.*

Generic candidates:
- [ ] No hardcoded color literals in component styles (hex / rgb / hsl) outside the token file.
- [ ] No fixed viewport-height units on scrollable page roots if the app uses a fixed-shell scroll pattern.
- [ ] Required bottom/safe-area padding present on full pages.
- [ ] No console.log left in shipped code (warn).
- [ ] No TODO/FIXME introduced without an issue reference (warn).

---

## PROJECT LAYER — sneworks.com
*Swap this whole section for a different project. These mirror the pitfalls already in CLAUDE.md so the gate enforces them.*

### Data lifecycle (sneworks specifics)
- [ ] New Firestore field/collection under `users/{uid}/…` is covered by an export path **and** by `clearAllCache()` + any account-erase routine.
- [ ] New cache key (`sneworks_{uid}_*`) is wiped by `clearAllCache()` on logout/session expiry.
- [ ] Group/recurring deletion uses `deleteAllTodosForGroup` + `removeAllTodosForGroup` (no status filter) — deferred todos don't reappear.
- [ ] Destructive action shows `ConfirmSheet` first.

### Visual consistency (sneworks specifics)
- [ ] Only `--sn-*` tokens; no hardcoded hex/rgba.
- [ ] Inputs set `color-scheme: var(--sn-color-scheme, light)`.
- [ ] Pages use `min-height: 100%` (never `100dvh`/`100vh`).
- [ ] Page bottom padding = `calc(var(--sn-nav-height) + 24px)`.
- [ ] Flex page bodies set `min-width: 0; overflow-x: hidden`.
- [ ] Font sizes use `calc(13px * var(--sn-font-scale, 1))`.
- [ ] Sheets portal to `#sn-portal` (inside `[data-theme]`), never `document.body`.

### State-machine tests (sneworks specifics)
- [ ] Verified empty / cache-first-paint / loading / populated / error / optimistic states for the surface.
- [ ] Re-entry doesn't replay `useLocation` state signals (`{ openAdd: true }` consumed once via `replaceState`).
- [ ] Spawner double-spawn guard respected (`lastSpawnedAt` today → skip).
- [ ] Cross-tab Firestore snapshot reconciles without dupes.

### Mechanical script targets (sneworks)
- [ ] grep hex/rgb/hsl in `src/**/*.css` excluding `app-tokens.css`.
- [ ] grep `100dvh|100vh` in page CSS.
- [ ] grep `color-scheme:\s*(dark|light)\b` not using the var.
- [ ] grep portal-to-`document.body` in sheet code.
