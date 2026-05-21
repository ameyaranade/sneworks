# sneworks.com — Project Reference

## What This Is
A personal multi-app SPA at **sneworks.com** built with Vite + React + TypeScript + Firebase.
- `/` — Landing hub
- `/games` — Public games section (no login required)
- `/games/connect4` — Connect 4 (2-player local)
- `/games/minesweeper` — Minesweeper
- `/tracker` — Activity tracker (auth required) — Finances, Exercise, Groceries, Payments
- `/login` — Google sign-in

---

## Firebase Project
- **Project ID:** `sneworks-app`
- **Console:** https://console.firebase.google.com/project/sneworks-app
- **Hosting URL:** https://sneworks-app.web.app (also live at sneworks.com)
- **Services in use:** Hosting, Authentication (Google), Firestore
- **Realtime Database:** Not active yet — lazy-initialized in config, add `databaseURL` when needed

### Firebase Console Checklist (already done)
- [x] Google sign-in enabled (Authentication → Sign-in method)
- [x] `sneworks.com` added as authorized domain (Authentication → Settings)
- [x] Firestore database created (test mode)
- [x] Custom domain `sneworks.com` connected to Hosting

---

## Domain & DNS (Cloudflare)
- **Registrar/DNS:** Cloudflare
- **Records in place:**
  - `A sneworks.com → 199.36.158.100` (Firebase Hosting)
  - `TXT sneworks.com → "hosting-site=sneworks-app"` (domain verification)
- No subdomain routing — all paths handled by React Router client-side

---

## Project Structure
```
C:\coding\sneworks\
  src/
    index.tsx                  # Entry point
    App.tsx                    # BrowserRouter + AuthProvider + all Routes
    firebase/
      config.ts                # Firebase init (auth, db, lazy rtdb)
    auth/
      AuthContext.tsx           # AuthProvider + useAuth hook
      ProtectedRoute.tsx        # Redirects unauthenticated users to /login
      LoginPage.tsx             # Google sign-in via signInWithPopup
      login.css
    pages/
      LandingPage.tsx           # Hub: cards linking to /games and /tracker
      NotFoundPage.tsx          # 404
      landing.css
    games/
      GamesHub.tsx              # /games index with game cards
      games-hub.css
      connect4/
        Connect4Game.tsx        # Game board + useNavigate back button
        Cell.tsx                # Individual cell component
        useConnect4Game.ts      # Game state hook (no JSX)
        GameStatus.ts           # Win detection, types, board logic
        connect4.css
      minesweeper/
        MinesweeperGame.tsx     # Full game logic + useNavigate back button
        MinesweeperCell.tsx     # Individual cell component
        types.ts                # Shared CellState, CellData, GameStatus types
        minesweeper.css
    tracker/
      types.ts                   # All TypeScript types (TrackerEntry, FinanceEntry, ExerciseEntry, etc.)
      constants.ts               # Fixed categories, frequencies, mood emojis, defaults
      utils.ts                   # computeDueStatus, date helpers, currency formatter
      TrackerPage.tsx            # (Legacy placeholder — no longer used in routing)
      TrackerShell.tsx            # Bottom tab bar + Outlet + drawer state + TrackerProvider wrapper
      tracker-shell.css
      context/
        TrackerProvider.tsx      # React context: Firestore subscriptions for settings, entries, grocery, recurring
      firebase/
        trackerQueries.ts        # All Firestore CRUD: entries, settings, grocery lists, recurring items; subscribeToGroceryTripsForDateRange added for calendar
      components/
        BottomTabBar.tsx         # Fixed bottom nav (Today|Calendar|+|Settings)
        bottom-tab-bar.css
        AddEntryDrawer.tsx       # Slide-up bottom sheet: type picker → form
        add-entry-drawer.css
      forms/
        FinanceForm.tsx          # Amount + scrollable category chips + expense/income toggle
        ExerciseForm.tsx         # Workout yes/no + duration + weight + mood selector
        form-shared.css          # Shared form styles (inputs, buttons, chips, mood, toggles)
      pages/
        TodayDashboard.tsx       # Date range toggle + summary cards + entry log
        today-dashboard.css
        CalendarPage.tsx         # Placeholder — month grid + day detail (not yet built)
        calendar-page.css
        SettingsPage.tsx         # Currency picker, dark mode toggle, notifications toggle
        settings-page.css
        FinancesDetailPage.tsx   # Placeholder — monthly breakdown
        ExerciseDetailPage.tsx   # Placeholder — workout/health log
        GroceriesPage.tsx        # Placeholder — active list + trip archive
        PaymentsPage.tsx         # Placeholder — recurring items + mark paid/skip
    shared/
      Layout.tsx                # Nav bar (SNE Works brand + Games/Tracker links + login state) + <Outlet />
      styles/
        global.css              # Resets, shared button styles (btn-new, btn-back)
        layout.css              # Nav bar styles
  vite.config.ts
  firebase.json                 # Hosting: serves dist/, SPA rewrite ** → index.html
  .firebaserc                   # default project: sneworks-app
  package.json                  # name: sneworks
  tsconfig.json
  index.html                    # title: SNE Works
```

---

## Key Dependencies
```json
"firebase": "^11.0.0",
"react": "^18.2.0",
"react-dom": "^18.2.0",
"react-router-dom": "^6.28.0"
```

---

## Dev Commands
```bash
npm run dev        # Start local dev server at http://localhost:5173
npm run build      # Production build to dist/
npm run deploy     # Build + deploy to Firebase Hosting (sneworks.com)
```

---

## Architecture Notes
- **Auth:** `AuthProvider` wraps all routes in `App.tsx`. `useAuth()` hook gives `{ user, loading }` anywhere in the tree. Games work without auth. `ProtectedRoute` redirects to `/login` if no user.
- **Routing:** React Router v6 with `<BrowserRouter>`. `/tracker` uses nested routes under `<TrackerShell>` which provides bottom tab navigation and the add-entry drawer. Firebase Hosting SPA rewrite sends all paths to `index.html`.
- **Tracker context:** `TrackerProvider` (inside `TrackerShell`) provides `useTracker()` hook with `{ settings, todayEntries, weekEntries, activeGroceryList, recurringItems, loading }`. All data is live via Firestore `onSnapshot`. The drawer is controlled via `useDrawer()` from `TrackerShell`.
- **CSS:** Per-component CSS files imported directly (no Tailwind, no CSS-in-JS). Shared styles in `shared/styles/global.css` and `layout.css`. Tracker forms share styles via `forms/form-shared.css`.
- **Realtime Database:** Not initialized at startup to avoid crashing on missing `databaseURL`. Use `getRtdb()` export from `firebase/config.ts` when needed.
- **Firebase config:** Real values already in `src/firebase/config.ts`. Do not commit to a public repo without moving to env vars.

---

## Tracker — Current State & Remaining Work

### What's Built (Phases 1-3)

**Foundation:**
- `TrackerShell` with fixed bottom tab bar (Today | Calendar | + | Settings)
- Nested routes under `/tracker/*` in `App.tsx` — all wrapped in `ProtectedRoute`
- Top nav (`Layout.tsx`) stays visible; bottom tabs only appear in `/tracker/*`

**Data layer:**
- `trackerQueries.ts` — full Firestore CRUD with real-time `onSnapshot` subscriptions
- `TrackerProvider` context — subscribes to settings, today's entries, week entries, active grocery list, recurring items
- Queries use client-side sorting to avoid composite Firestore index requirements

**Settings page (`/tracker/settings`):**
- Currency picker (INR ₹ / USD $) — persists to Firestore
- Dark mode toggle (schema ready, CSS not yet applied)
- Notifications toggle (greyed out, "Coming soon")

**Add Entry drawer:**
- Slide-up bottom sheet with backdrop (CSS animation, no library)
- Type picker grid: Finances, Exercise, Groceries, Payments
- Back button to return to type picker from a form

**Finance form:**
- Expense/income toggle (red/green)
- Amount input with currency symbol from settings
- Horizontal scrollable category chip row (10 categories: Food, Transport, Rent, etc.)
- Date picker (defaults today), notes field
- Saves to `users/{uid}/entries/{entryId}`

**Exercise form:**
- Workout yes/no toggle (conditionally shows duration + type fields)
- Weight input (kg), mood selector (5 emoji buttons: Awful → Great)
- Date picker, notes field
- Saves to `users/{uid}/entries/{entryId}`

**Dashboard (`/tracker`):**
- Date range toggle: Today (default) | This Week
- Summary cards per activity type with accent color borders
- Finance card: total spent/earned with currency formatting
- Exercise card: workout status, mood emoji, weight
- Full entry log with type badges, amounts, metadata, delete buttons

### Firestore Schema

```
users/{uid}/
  settings/preferences              → { currency, currencySymbol, darkMode, notificationsEnabled, updatedAt }
  entries/{entryId}                  → FinanceEntry | ExerciseEntry | PaymentEntry
                                       Common: { type, date (YYYY-MM-DD), notes, createdAt, updatedAt }
                                       Finance: + { amount, direction, category, target? }
                                       Exercise: + { workout: { completed, durationMinutes?, workoutType? }, health?: { weightKg?, mood? } }
                                       Payment: + { recurringItemId, amount, status }
  groceryLists/active                → { items: GroceryItem[], updatedAt }
  groceryLists/{tripId}              → { name, items, tripMode, completedAt, date }
  recurringItems/{itemId}            → { name, amount, frequency, dueDay, notes, active, category?, reminderDate?, reminderSent? }
```

### Remaining Work Checklist

#### Phase 4 — Payments ✓ COMPLETE
- [x] `PaymentTemplateForm.tsx` — name, amount, frequency picker, due day, notes
- [x] `PaymentsPage.tsx` — list all recurring items with due status (overdue/due-today/upcoming)
- [x] Mark Paid / Skip flow — creates a `PaymentEntry` referencing the recurring item
- [x] `PriorityBanner.tsx` — overdue (red) and due-today (orange) alerts on dashboard
- [x] `DueIndicator.tsx` — status badge component
- [x] Wire `computeDueStatus()` from `utils.ts` into dashboard and payments page

#### Phase 5 — Groceries ✓ COMPLETE
- [x] `GroceriesPage.tsx` — active checklist with add/check/uncheck items
- [x] Check timestamps recorded on each item (`checkedAt` field)
- [x] "Done" button → auto-names trip "Grocery Run DD-MM-YYYY" with inline rename
- [x] Trip mode picker (Store / Online)
- [x] Archive flow: checked items bundled into trip, unchecked items stay on active list
- [x] Past trips section — expandable list showing items with timestamps
- [x] `GroceryForm.tsx` — simple add-item form (for use in drawer as shortcut)

#### Phase 6 — Calendar ✓ COMPLETE
- [x] `CalendarPage.tsx` — month grid (7-column CSS grid, no library)
- [x] Colored dots on days with entries (one color per activity type, including grocery trips)
- [x] Day detail panel below grid — shows all entries + grocery trip for tapped day
- [x] Month navigation (prev/next arrows) — re-subscribes Firestore per month
- [x] Toggle: tapping same day again collapses the detail panel

#### Phase 7 — Go To Navigation Menu ✓ COMPLETE
- [x] `GoToMenu.tsx` — slide-up sheet triggered by a "Go To" button in the bottom tab bar (replaces the Settings tab)
- [x] Menu lists entry points: Groceries (`/tracker/groceries`), Finances (`/tracker/finances`), Exercise & Health (`/tracker/exercise`), Payments (`/tracker/payments`)
- [x] Each entry is a tappable row with emoji, label, and a `›` arrow — tapping closes the menu and navigates
- [x] Bottom tab bar becomes: Today | Calendar | + | Go To (Settings tab removed from bottom bar)
- [x] Settings link moved to the top-level nav (`Layout.tsx`) — visible when logged in, in place of the current LogOut button; rendered as a gear SVG icon (no text label, `title="Settings"` tooltip)
- [x] LogOut button moved inside `SettingsPage.tsx` (stays there, not in the nav)
- [x] Login button stays in the top-level nav when the user is NOT logged in (no change)
- [x] `go-to-menu.css` — styles for the slide-up sheet
- [x] Go To tab uses a hamburger SVG icon (3 lines); Settings nav uses a gear SVG icon — no emoji

#### Phase 8 — Detail Pages ✓ 8A COMPLETE

##### 8A — FinancesDetailPage ✓ COMPLETE
- [x] Paginated history list, newest-first, with infinite scroll (IntersectionObserver, 20 at a time)
- [x] Each entry row shows: amount, direction, category emoji + label, date, notes
- [x] Create (tap + opens drawer) and delete — live via `onSnapshot` subscription
- [ ] Edit inline — deferred to Phase 9
- [x] Data: `onSnapshot` subscription (changed from `getDocs` to keep list live after adds/deletes)

##### 8B — ExerciseDetailPage ✓ COMPLETE
- [x] Header: workout streak (consecutive days with `workout.completed = true`) + total workouts in current month
- [x] Chronological list (newest-first): workout status, duration, type, mood emoji, weight chips
- [x] Each row tappable — expands to show full detail (Workout / Weight / Mood / Notes) + Delete button
- [ ] Edit — deferred to Phase 9
- [x] Data: same `onSnapshot` subscription pattern as 8A

#### Phase 9 — Edit Entries ✓ COMPLETE
- [x] Add edit mode to `AddEntryDrawer` — accept an optional `entryToEdit` prop; when set, skip type picker and go straight to the pre-filled form; title shows "Edit Finances" / "Edit Exercise"
- [x] `FinanceForm` — accept `initialValues`/`entryId` props to prefill all fields; on submit calls `updateEntry()` instead of `addEntry()`
- [x] `ExerciseForm` — same as above
- [x] Payments — "Unmark" button on payment entries (deletes the PaymentEntry) + inline notes editing (tap notes text → input → blur/Enter to save via `updateEntry`)
- [x] `updateEntry(uid, entryId, partial)` already existed in `trackerQueries.ts` (no change needed)
- [x] `TrackerShell` — extended `DrawerContext` with `openDrawerWithEntry(entry)` for wiring edit from any page
- [x] Wire edit from `TodayDashboard` log rows: pencil icon for finance/exercise, "Unmark" button for payments

#### Phase 10 — Polish ✓ COMPLETE
- [x] Empty state messages per page / activity type — already present on all pages
- [x] Error handling: `Toast.tsx` + `ToastProvider` in `TrackerShell`; all Firestore mutations (add, update, delete) wrapped in try/catch across TodayDashboard, FinancesDetailPage, ExerciseDetailPage, GroceriesPage, PaymentsPage
- [x] Loading skeletons for Finances and Exercise detail pages — shimmer animation via `@keyframes shimmer` in global.css; skeleton rows replace "Loading…" text
- [x] Dark mode CSS — full CSS custom property system in `global.css` (`:root` + `[data-theme="dark"]`); all 18 CSS files updated to use vars; `TrackerProvider` applies `document.body.dataset.theme` on settings change
- [x] Dark mode scope: entire app (landing, games, auth, all tracker pages)

#### Future (Not in v1)
- [ ] Swipeable/horizontal scroll-snap dashboard cards (`SwipeableCards.tsx` + `ActivityCard.tsx`)
- [ ] Trend charts for exercise/health (weight over time, mood over time, workout frequency)
- [ ] Push notifications via Firebase Cloud Messaging (schema fields already in place)
- [ ] Custom finance categories (currently 10 fixed)
- [ ] Budget goals / targets per category (schema `target` field already in types)
- [ ] Sharing activities with other users

### Design Decisions Reference
- **Mobile-first** — 44px+ touch targets, bottom tab nav, slide-up drawer
- **No external libraries** for animations, calendar, or swipe — all built with CSS transitions/scroll-snap
- **State management** — React Context only (TrackerProvider), no Redux/Zustand
- **Date storage** — YYYY-MM-DD strings (not Timestamps) to avoid timezone bugs
- **Single `entries` collection** with type discriminator for unified calendar queries
- **Client-side sorting** to avoid Firestore composite index requirements
- **Detailed plan file**: `C:\Users\Ameya\.claude\plans\i-want-to-make-humble-ocean.md`

---

## What To Build Next (Other Features)

### Games
- Add new game: create `src/games/<gamename>/` folder, add card to `src/games/GamesHub.tsx`
- Score saving: use Firestore `users/{uid}/scores/{game}` once user is logged in

### Claude API Integration
- Add Firebase Cloud Functions (`functions/` folder)
- Proxy Claude API calls through a Cloud Function to keep API key server-side
- `firebase.json` will need a `functions` section and `/api/**` rewrite rule

### Auth Improvements
- Currently Google-only. Can add email/password via `createUserWithEmailAndPassword` if needed.

---

## Original Games Source
The game code was originally at `C:\Users\Ameya\Documents\test_code\games\connect4` (old project: `my-small-web-games`, now disconnected from sneworks.com). That project can be ignored going forward — all code has been moved and updated here.
