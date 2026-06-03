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

## How to add a decision
When you make a deliberate cross-cutting call (something a future change could
plausibly undo without realizing it was intentional), add an entry: state the
decision, the **why** (the failure it prevents), how to apply it, and the
file:line anchor. An undocumented decision is one iteration away from being
reverted.
