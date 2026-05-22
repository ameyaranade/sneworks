# sneworks.com — Project Reference

## What This Is
A personal multi-app SPA at **sneworks.com** built with Vite + React + TypeScript + Firebase.
- `/` — Landing hub
- `/games` — Public games section (no login required)
- `/games/connect4` — Connect 4 (2-player local)
- `/games/minesweeper` — Minesweeper
- `/tracker` — Activity tracker (auth required) — Finances, Exercise, Groceries, Reminders
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
      types.ts                   # All TypeScript types — Activity + Reminder discriminated unions
      constants.ts               # ACTIVITY_TYPE_META, REMINDER_TYPE_META, categories, frequencies, mood options
      utils.ts                   # computeDueStatus, computeNextDueDate, date helpers, currency formatter
      TrackerShell.tsx           # Bottom tab bar + Outlet + DrawerContext + TrackerProvider wrapper
      tracker-shell.css
      context/
        TrackerProvider.tsx      # useTracker() → { settings, todayActivities, weekActivities, monthActivities, reminders, loading }
      firebase/
        trackerQueries.ts        # All Firestore CRUD for activities, reminders, settings
      components/
        BottomTabBar.tsx         # Fixed bottom nav — 5 tabs: Home | Money | Health | Shop | Reminder
                                 #   Each tab: SVG icon + text label (10px) underneath
                                 #   Tab bar height: 64px
        bottom-tab-bar.css
        AddEntryDrawer.tsx       # Slide-up drawer: type picker → form
                                 #   4 types with SVG icons: Money | Health | Shopping | Other
                                 #   Money sub-toggle: Expense/Income vs Recurring Bill
        add-entry-drawer.css
        MoodSvg.tsx              # Shared SVG mood face component (moods 1–5, quadratic bezier mouth)
        PriorityBanner.tsx       # Overdue/due-today finance reminders banner on dashboard
        DueIndicator.tsx         # Due status badge (overdue/due-today/upcoming/paid/skipped)
        Toast.tsx                # Toast notification component
      forms/
        FinanceForm.tsx          # Amount + category chips (label only, no emoji) + expense/income toggle
        ExerciseForm.tsx         # Workout toggle + duration + weight + MoodSvg mood selector
        PaymentTemplateForm.tsx  # Name + amount + frequency + due day (creates FinanceReminder)
        GroceryForm.tsx          # Item name input (creates GroceryReminder)
        GenericActivityForm.tsx  # Date + notes (creates GenericActivity)
        GenericReminderForm.tsx  # Name + optional due date + time + notes (creates GenericReminder)
        form-shared.css          # Shared form styles
      pages/
        TodayDashboard.tsx       # Today/week/month toggle + summary cards + activity log
                                 #   Quick-add popover with SVG icons (no emoji)
                                 #   + button: SVG cross outline (no colored circle)
                                 #   Entry meta: "Category · notes" format (no emoji badges)
                                 #   Edit buttons: bordered pill, muted style
        today-dashboard.css
        CalendarPage.tsx         # Month grid + day detail panel + activity dots
        calendar-page.css
        SettingsPage.tsx         # Currency picker, dark mode toggle, notifications toggle, logout
        settings-page.css
        FinancesDetailPage.tsx   # Finance activity history (expandable rows: click → Edit/Delete)
                                 #   + collapsible Recurring Bills section (no emoji in heading)
        finances-detail-page.css
        ExerciseDetailPage.tsx   # Workout streak + exercise activity log
                                 #   Collapsed chip row shows: type · duration · weight · MoodSvg · notes
                                 #   Page title: "Exercise & Health" (no emoji)
        exercise-detail-page.css
        GroceriesPage.tsx        # Active grocery checklist + past trips archive
                                 #   All accent colors use var(--color-accent) (no hardcoded orange)
                                 #   Page title: "Groceries" (no emoji)
        groceries-page.css
        RemindersPage.tsx        # Generic reminders: add / complete / delete
                                 #   Form: name + date (default today) + time + notes
                                 #   Due display: "Due 21 May 2026 at 09:00"
                                 #   Collapsible "Archived" section: lazy-loaded, client-side paginated (10/page)
        reminders-page.css
    shared/
      Layout.tsx                # Nav bar (SNE Works brand + Games/Tracker links + gear icon) + <Outlet />
      styles/
        global.css              # Resets, shared button styles, dark mode CSS vars, shimmer skeleton
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
- **Auth:** `AuthProvider` wraps all routes in `App.tsx`. `useAuth()` hook gives `{ user, loading, optimistic }` anywhere in the tree. Games work without auth. `ProtectedRoute` redirects to `/login` if no user.
  - **Optimistic auth** — `AuthContext` persists an auth hint (`sneworks_auth_hint`) to localStorage on every successful login (uid + timestamp, 7-day TTL). On refresh, `optimistic=true` lets `ProtectedRoute` render children immediately without waiting for Firebase to confirm the session. `clearAllCache()` (exported from `AuthContext`) wipes all `sneworks*` localStorage keys on logout or session expiry. `getCachedUid()` returns the hint uid synchronously — used by `TrackerProvider` for instant cache reads.
- **Routing:** React Router v6 with `<BrowserRouter>`. `/tracker` uses nested routes under `<TrackerShell>` which provides bottom tab navigation and the add-entry drawer. Firebase Hosting SPA rewrite sends all paths to `index.html`.
- **Tracker context:** `TrackerProvider` (inside `TrackerShell`) provides `useTracker()` hook with `{ settings, todayActivities, monthActivities, reminders, loading }`. All data is live via Firestore `onSnapshot`.
  - **localStorage cache** — All four subscriptions (settings, todayActivities, monthActivities, reminders) are cached under `sneworks_{uid}_{key}`. Cache is read synchronously in `useState` lazy initializers using `getCachedUid()`, so the very first render already has data. Firestore Timestamps are serialized via `JSON.stringify` (Firebase's `toJSON()` emits `{ type, seconds, nanoseconds }`) and revived by `reviveTimestamps()` on read. Cache is written on every subscription callback and cleared on logout.
  - **TodayDashboard** seeds its own `activities` state from `todayActivities` at mount (frame 1 has data). A `userReadyRef` distinguishes first-auth (skip loading if cache exists) from range/offset change (clear + reload). Archived Reminders are lazy-loaded on first expand of the "Archived" section — intentional, not a bug.
- **Drawer context:** `DrawerContext` in `TrackerShell` exposes `useDrawer()` → `{ openDrawer, openDrawerWithActivity, openDrawerWithType }`. Call `openDrawerWithActivity(activity)` to open in edit mode; `openDrawerWithType('finance')` to pre-select a type.
- **CSS:** Per-component CSS files imported directly (no Tailwind, no CSS-in-JS). Shared styles in `shared/styles/global.css` and `layout.css`. Tracker forms share styles via `forms/form-shared.css`.
- **No emoji in UI** — All structural UI elements (page titles, tab labels, type picker, entry badges, category chips, popover, past trips mode label) use SVG icons or plain text only.
- **Realtime Database:** Not initialized at startup to avoid crashing on missing `databaseURL`. Use `getRtdb()` export from `firebase/config.ts` when needed.
- **Firebase config:** Real values already in `src/firebase/config.ts`. Do not commit to a public repo without moving to env vars.

---

## Tracker — Data Model

### Two universal primitives

**Activity** — a log of something that happened. Stored in `users/{uid}/activities/{id}`.
```
Common: { type, date (YYYY-MM-DD), notes, createdAt, updatedAt }
finance:  + { amount, direction: 'expense'|'income', category }
exercise: + { workout: { completed, durationMinutes?, workoutType? }, health?: { weightKg?, mood? } }
payment:  + { reminderId, amount, status: 'paid'|'skipped' }
grocery:  + { tripName, tripMode: 'store'|'online', tripItems: GroceryTripItem[] }
generic:  (common fields only)
```

**Reminder** — something to do. Stored in `users/{uid}/reminders/{id}`.
```
Common: { type, name, notes, active, createdAt, updatedAt }
finance:  + { amount, frequency, dueDay, category? }
exercise: + { dueDate? }
grocery:  + { checked, checkedAt?, sortOrder }
generic:  + { dueDate?, dueTime?, completed, completedAt? }
```
Note: `GenericReminder.dueTime` is stored as `"HH:MM"` string for future push notification scheduling.

**Settings** — `users/{uid}/settings/preferences`
```
{ currency, currencySymbol, darkMode, notificationsEnabled, updatedAt }
```

### Key query functions (`trackerQueries.ts`)
- `addActivity / updateActivity / deleteActivity`
- `subscribeToActivitiesForDate / subscribeToActivitiesForDateRange / subscribeToActivitiesByType`
- `addReminder / updateReminder / deleteReminder`
- `subscribeToReminders` (all active) / `subscribeToRemindersByType`
- `toggleGroceryReminder` — sets checked + checkedAt
- `archiveGroceryTrip` — creates GroceryActivity + batch-deletes checked GroceryReminders
- `completeGenericReminder` — sets completed: true, active: false
- `getCompletedGenericReminders(uid)` — one-shot fetch of archived generic reminders, sorted by completedAt desc (client-side; avoids composite index)

---

## Tracker — Feature Status (all complete)

- **Dashboard** — Today/week/month toggle, summary cards (no emoji headers), activity log
  - Entry meta format: `"Category · notes"` (no badge, no emoji)
  - Quick-add popover: SVG icons, opens drawer pre-typed
  - Edit buttons: bordered pill style matching "Unmark" styling
  - PriorityBanner for overdue/due-today finance reminders
- **Finances** — Activity history with expandable rows (click row → chevron rotates → Edit/Delete revealed)
  - Category chips: label text only (no emoji)
  - Recurring Bills section: collapsible, no emoji in heading
- **Exercise & Health** — Streak + monthly count header, expandable activity rows
  - Collapsed chip row shows: type · duration · weight · MoodSvg face · notes
  - MoodSvg: SVG face icon, moods 1–5 with bezier mouth curve
  - Page title: "Exercise & Health"
- **Shop (Groceries)** — Individual reminder docs per item, check/uncheck, archive trip → GroceryActivity
  - Page title: "Shop"; default trip name: "Shop: dd-mm-yyyy"
  - All accent colors use `var(--color-accent)` (no hardcoded orange)
  - Archive button, add button, checkboxes all use outline/accent style
  - Past trips: collapsible rows with × delete button (calls `deleteActivity`); no emoji in mode label (Store/Online plain text)
- **Reminders** — Generic reminders: add (name + due date defaulting to today + due time + notes), complete, delete
  - Due shown as: "Due 21 May 2026 at 09:00"
  - Collapsible "Archived" section: lazy-loaded on first expand, client-side pagination (10/page), shows completion date, delete button
  - +Add button: neutral outlined pill (no accent/blue color)
- **Calendar** — Month grid with colored activity dots, day detail panel
- **Settings** — Currency, dark mode, notifications toggle, logout
- **Add drawer** — 4 types with SVG icons: Money (Expense/Income or Recurring Bill sub-toggle) | Health | Shopping | Other
- **Bottom tab bar** — 5 tabs, each with SVG icon + text label: Home | Money | Health | Shop | Reminder (64px tall)
- **Edit mode** — Drawer opens pre-filled via `openDrawerWithActivity(activity)`
- **Dark mode** — Full CSS custom property system, applied app-wide
- **Error handling** — Toast notifications on all Firestore mutation failures
- **Loading states** — Shimmer skeletons on Finances and Exercise pages; Dashboard shows cached data instantly on refresh (no skeleton)

### Future (not yet built)
- [ ] Push notifications via Firebase Cloud Messaging (dueTime already stored for scheduling)
- [ ] Trend charts for exercise/health (weight, mood, frequency over time)
- [ ] Custom finance categories (currently 10 fixed)
- [ ] Budget goals / targets per category

### Design Decisions
- **Mobile-first** — 44px+ touch targets, bottom tab nav, slide-up drawer
- **No emoji in structural UI** — Page titles, nav labels, type pickers, entry badges, category chips all use SVG or plain text
- **No external libraries** for animations, calendar, icons, or swipe — all CSS transitions + inline SVG
- **State management** — React Context only (TrackerProvider + DrawerContext), no Redux/Zustand
- **Date storage** — YYYY-MM-DD strings (not Timestamps) to avoid timezone bugs; time stored as HH:MM string
- **Client-side sorting/filtering** to avoid Firestore composite index requirements
- **`computeDueStatus`** checks payments against the start of the current billing cycle (not just the next due date), so early payments are correctly recognised as paid
- **Cross-page navigation signals** — `useLocation` state (e.g., `{ openAdd: true }`) consumed once via `window.history.replaceState({}, document.title)` to prevent re-trigger on back navigation

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
