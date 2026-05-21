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
      TrackerShell.tsx           # Bottom tab bar + Outlet + DrawerContext (openDrawerWithActivity) + TrackerProvider wrapper
      tracker-shell.css
      context/
        TrackerProvider.tsx      # useTracker() → { settings, todayActivities, weekActivities, monthActivities, reminders, loading }
      firebase/
        trackerQueries.ts        # All Firestore CRUD for activities, reminders, settings
      components/
        BottomTabBar.tsx         # Fixed bottom nav (Today | Calendar | + | Go To)
        bottom-tab-bar.css
        AddEntryDrawer.tsx       # Slide-up drawer: type picker → form (types: finance, exercise, grocery, payment, generic)
        add-entry-drawer.css
        GoToMenu.tsx             # Slide-up sheet: Finances | Exercise & Health | Groceries | Reminders
        go-to-menu.css
        PriorityBanner.tsx       # Overdue/due-today finance reminders banner on dashboard
        DueIndicator.tsx         # Due status badge (overdue/due-today/upcoming/paid/skipped)
        Toast.tsx                # Toast notification component
      forms/
        FinanceForm.tsx          # Amount + category chips + expense/income toggle
        ExerciseForm.tsx         # Workout toggle + duration + weight + mood selector
        PaymentTemplateForm.tsx  # Name + amount + frequency + due day (creates FinanceReminder)
        GroceryForm.tsx          # Item name input (creates GroceryReminder)
        GenericActivityForm.tsx  # Date + notes (creates GenericActivity)
        GenericReminderForm.tsx  # Name + optional due date + notes (creates GenericReminder)
        form-shared.css          # Shared form styles
      pages/
        TodayDashboard.tsx       # Date range toggle + summary cards + activity log
        today-dashboard.css
        CalendarPage.tsx         # Month grid + day detail panel + activity dots
        calendar-page.css
        SettingsPage.tsx         # Currency picker, dark mode toggle, notifications toggle, logout
        settings-page.css
        FinancesDetailPage.tsx   # Finance activity history + collapsible Recurring Bills section
        finances-detail-page.css
        ExerciseDetailPage.tsx   # Workout streak + exercise activity log
        exercise-detail-page.css
        GroceriesPage.tsx        # Active grocery checklist + past trips archive
        groceries-page.css
        RemindersPage.tsx        # Generic reminders: add / complete / delete
        reminders-page.css
    shared/
      Layout.tsx                # Nav bar (SNE Works brand + Games/Tracker links + gear icon for settings) + <Outlet />
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
- **Auth:** `AuthProvider` wraps all routes in `App.tsx`. `useAuth()` hook gives `{ user, loading }` anywhere in the tree. Games work without auth. `ProtectedRoute` redirects to `/login` if no user.
- **Routing:** React Router v6 with `<BrowserRouter>`. `/tracker` uses nested routes under `<TrackerShell>` which provides bottom tab navigation and the add-entry drawer. Firebase Hosting SPA rewrite sends all paths to `index.html`.
- **Tracker context:** `TrackerProvider` (inside `TrackerShell`) provides `useTracker()` hook with `{ settings, todayActivities, weekActivities, monthActivities, reminders, loading }`. All data is live via Firestore `onSnapshot`. The drawer is controlled via `useDrawer()` from `TrackerShell` — call `openDrawerWithActivity(activity)` to open in edit mode.
- **CSS:** Per-component CSS files imported directly (no Tailwind, no CSS-in-JS). Shared styles in `shared/styles/global.css` and `layout.css`. Tracker forms share styles via `forms/form-shared.css`.
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
generic:  + { dueDate?, completed, completedAt? }
```

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

---

## Tracker — Feature Status (all complete)

- **Dashboard** — Today/week toggle, summary cards, activity log, edit/delete, PriorityBanner
- **Finances** — Activity history (infinite scroll) + Recurring Bills section (mark paid/skip/delete)
- **Exercise** — Streak + monthly count header, expandable activity rows, edit/delete
- **Groceries** — Individual reminder docs per item, check/uncheck, archive trip → GroceryActivity
- **Calendar** — Month grid with colored activity dots, day detail panel
- **Reminders** — Generic reminders: add, complete, delete
- **Settings** — Currency, dark mode, notifications toggle, logout
- **Go To menu** — Bottom sheet nav: Finances | Exercise & Health | Groceries | Reminders
- **Add drawer** — Types: Finances, Exercise, Groceries, Payments (bill template), Other (generic)
- **Edit mode** — Drawer opens pre-filled via `openDrawerWithActivity(activity)`
- **Dark mode** — Full CSS custom property system, applied app-wide
- **Error handling** — Toast notifications on all Firestore mutation failures
- **Loading states** — Shimmer skeletons on Finances and Exercise pages

### Future (not yet built)
- [ ] Trend charts for exercise/health (weight, mood, frequency over time)
- [ ] Push notifications via Firebase Cloud Messaging
- [ ] Custom finance categories (currently 10 fixed)
- [ ] Budget goals / targets per category

### Design Decisions
- **Mobile-first** — 44px+ touch targets, bottom tab nav, slide-up drawer
- **No external libraries** for animations, calendar, or swipe — all CSS transitions
- **State management** — React Context only (TrackerProvider), no Redux/Zustand
- **Date storage** — YYYY-MM-DD strings (not Timestamps) to avoid timezone bugs
- **Client-side sorting** to avoid Firestore composite index requirements
- **`computeDueStatus`** checks payments against the start of the current billing cycle (not just the next due date), so early payments are correctly recognised as paid

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
