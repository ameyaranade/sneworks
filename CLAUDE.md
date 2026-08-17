# sneworks.com — Project Reference

## What This Is
A personal productivity SPA at **sneworks.com** built with Vite + React + TypeScript + Firebase.

**Live app:** https://sneworks.com (also https://sneworks-app.web.app)
**This is a TODO + log app** — users track tasks, routines, projects, shopping lists, money reminders, health logs, and notes.

The old `/tracker` (TrackerProvider/DrawerContext) has been **superseded** by the current architecture below. Do not reference tracker code patterns — they are dead. The current app lives at `/`.

---

## UX invariants (enforced — read first)

This project follows three non-negotiable product tenets. Two user-level skills carry the detail; **apply them, don't re-derive**:

- **Spec / planning work** → use the **`ux-invariants-spec`** skill. Any new feature spec must define its data-control surfaces, design-language conformance, and a state-machine test plan *up front*.
- **Building / testing / "is this done?"** → use the **`ux-invariants-build`** skill as the definition-of-done gate before declaring ANY UI or user-data change complete. Answer each item with a cited `file:line`/test, or an explicit `N/A because …`.

The tenets:
1. **All user data is viewable / editable / deletable (and exportable) from the UI** — not just via Firestore. A new `users/{uid}/*` collection must be reachable in the UI for view + edit + delete, cascade-cleaned on parent delete, and registered in [`src/firebase/userDataRegistry.ts`](src/firebase/userDataRegistry.ts) (the single source of truth that drives export, account-erase, and cache-clear). Add its name to `USER_DATA_COLLECTIONS` + a registry entry, or `userDataRegistry.test.ts` fails.
2. **All UX conforms to one design language** — `--sn-*` tokens + shared primitives only; no hardcoded colors and no one-off components. See [`docs/DESIGN_LANGUAGE.md`](docs/DESIGN_LANGUAGE.md); a new pattern updates it in the same change. Run `npm run check:ux` for the deterministic floor (tokens / viewport-height / color-scheme).
3. **UX is tested as a state machine** — verify empty / cache-first-paint / loading / populated / boundary / error / optimistic-pending states **and the transitions between them**, not a single click-through. Record states/transitions in [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md).

**Before changing shell layout, navigation, sheets/modals, z-index, scroll, safe-area/keyboard handling, theming/tokens, or any pre-auth / first-paint surface, read [`docs/PRODUCT_DECISIONS.md`](docs/PRODUCT_DECISIONS.md)** — the log of deliberate cross-cutting calls (nav persistence, PWA/keyboard padding, modal z-index ladder, out-of-shell token/theme provisioning, 3-way theme model, …). Honor each decision or amend its entry with a new rationale in the same change.

**Proactively capture new decisions:** when a durable cross-cutting call gets made during our work (an "always/never/from now on" rule, a structural layout/nav/modal/z-index/scroll/safe-area choice, a data-control call, a constraint workaround, or a reversal of a prior approach), use the **`decision-capture`** skill — draft the entry, confirm it with me, then append it to `docs/PRODUCT_DECISIONS.md`. Don't let a deliberate decision live only in chat.

Data-control (tenet 1) is wired: [`src/firebase/userDataRegistry.ts`](src/firebase/userDataRegistry.ts) is the registry of every user-data store; **export (projects only, for now)** and **account-erase (everything)** live in MorePage → Settings → "Your data", and `userDataRegistry.test.ts` is the coverage gate. `npm run check:ux` reports **zero violations** (clean baseline as of 2026-06-03) — wire both `check:ux` and `npm test` into CI or a pre-commit hook as a blocking gate.

---

## Codebase hygiene (ongoing)

Identifying cleanup and **filing a cleanup task for it** is a standing, ongoing
responsibility — not a one-off. Whenever work surfaces drift (dead code, unused
imports/vars, stale docs/comments, duplicated logic, an unconfirmed destructive
action, a token/primitive violation), either fix it inline when it's in scope
and trivial, **or** capture it as a tracked cleanup task so it isn't lost.

- Keep the typecheck floor clean: `npx tsc --noEmit` should report **zero
  errors** before declaring work done. Unused-import / unused-var errors
  (`TS6133`) get removed, not left.
- Out-of-scope finds → file them (a task / the `spawn_task` chip) rather than
  expanding the current change.
- This pairs with the tenet gates: a "done" UI/data change runs
  `npm run check:ux` + `npm test` clean **and** leaves no new dead code behind.

---

## Firebase Project
- **Project ID:** `sneworks-app`
- **Console:** https://console.firebase.google.com/project/sneworks-app
- **Services:** Hosting, Authentication (Google), Firestore, Cloud Functions
- **Realtime Database:** active (`sneworks-app-default-rtdb`) — used **only** for ephemeral shared-project presence (`presence/{pid}/{uid}`, D9). Rules in `database.rules.json`; `prunePresence` scheduled fn sweeps stale entries. Gated client-side by `RTDB_ENABLED` in `config.ts`.
- **Firestore collections (per user):** `users/{uid}/todos`, `users/{uid}/logs`, `users/{uid}/groups`, `users/{uid}/settings/preferences` (enumerated in `userDataRegistry.ts`)

### Firebase Setup (already done)
- [x] Google sign-in enabled
- [x] `sneworks.com` authorized domain
- [x] Firestore in production mode
- [x] Custom domain connected
- [x] Cloud Function `sendReminders` deployed

---

## Dev Commands
```bash
npm run dev      # Vite dev server (port 5173, may climb if in use)
npm run build    # Production build → dist/
npm run deploy   # build + firebase deploy (hosting + functions)
```
**Note:** The live site at sneworks.com requires Google login. Dev server also requires login. Chrome extension (`mcp__Claude_in_Chrome__*`) is the correct tool for UI verification — use the live tab, never the preview tools.

---

## Project Structure

```
C:\coding\sneworks\
  src/
    index.tsx               # Vite entry
    App.tsx                 # BrowserRouter + AuthProvider + ALL routes (lazy-loaded)
    AppShell.tsx            # Root shell: theme, stores init, spawner, sheets, nav
    app-shell.css           # .sn-shell + .sn-content
    types.ts                # ALL TypeScript types (single file)
    utils.ts                # Cache helpers, date helpers, Timestamp serialization
    auth/
      AuthContext.tsx        # AuthProvider, useAuth(), getCachedUid(), clearAllCache()
      ProtectedRoute.tsx     # Redirects to /login if unauthenticated
      LoginPage.tsx          # Google signInWithPopup
    context/
      UIContext.tsx          # UIProvider, useUI() — compose/defer sheet state
    stores/
      useTodosStore.ts       # Zustand: sandbox_todos subscription + CRUD + status actions
      useLogsStore.ts        # Zustand: sandbox_logs subscription + CRUD
      useGroupsStore.ts      # Zustand: sandbox_groups subscription + CRUD + selectors
    firebase/
      config.ts              # Firebase init (auth, db, lazy rtdb)
      todoQueries.ts         # Firestore CRUD for todos (add/update/delete/subscribe/batch)
      logQueries.ts          # Firestore CRUD for logs
      groupQueries.ts        # Firestore CRUD for groups + recomputeGroupCounts()
      routineSpawner.ts      # spawnDueRoutines(), spawnDueRecurringTodos(), isDueToday(), recurrenceLabel()
      healthQueries.ts       # filterRoutineLogs(), groupLogsByDay(), sumCalories(), sumDuration(), last7DayKeys()
      settingsQueries.ts     # subscribeToSettings(), updateSettings(), DEFAULT_SETTINGS
      messaging.ts           # FCM push token setup
    constants/
      health.ts              # WORKOUT_TYPES, MET_TABLE, INTENSITY_LEVELS, INTENSITY_COLORS, calcCalories()
    components/
      nav/
        BottomNav.tsx        # 4-tab bar + SplitPillFAB (Today | Routines | [pill] | Health | More)
        SplitPillFAB.tsx     # Centered split pill: Log (left) | + TODO (right)
        bottom-nav.css
      primitives/
        BottomSheet.tsx      # Slide-up modal — portals to #sn-portal
        ConfirmSheet.tsx     # Danger confirmation dialog (wraps BottomSheet)
        DetailPageHeader.tsx # Back button + title + optional rightSlot
        CollapsibleSection.tsx
        EmptyState.tsx
        ProgressBar.tsx
        SheetFormActions.tsx
        bottom-sheet.css
        confirm-sheet.css
      sheets/
        ComposeSheet.tsx     # Universal compose: todo types + log types + health log + edit
        DeferSheet.tsx       # Defer date picker sheet
        EditRecurringSheet.tsx # Edit RecurringTodoGroup fields
        compose-sheet.css
        defer-sheet.css
        edit-recurring-sheet.css
      rows/
        TodoRow.tsx          # Swipeable todo row (checkbox, title, swipe actions)
        todo-row.css
      swipe/
        SwipeableRow.tsx     # Generic swipe gesture component
      health/
        ActivityIcon.tsx     # SVG icon per WorkoutType
        GoalRing.tsx         # SVG donut ring (pct, color, size, label)
        WeeklyBarChart.tsx   # 7-column SVG bar chart with goal line
        WorkoutCard.tsx      # Expandable workout card for routine dashboard
        IntensityDot.tsx     # Small colored circle for intensity level
        health-components.css
    pages/
      TodayPage.tsx          # / — Overdue, Up Next, Shopping, Projects, Done Today
      RoutinesPage.tsx       # /routines — Active routines + Recurring todos + Archived
      TimelinePage.tsx       # /timeline — Chronological log list
      MorePage.tsx           # /more — Shopping lists, Projects nav, Settings
      GroupDetailPage.tsx    # /groups/:groupId — Shopping list checklist
      ProjectsPage.tsx       # /projects — Project list
      ProjectDetailPage.tsx  # /projects/:projectId — Sub-projects + Tasks
      RoutineDetailPage.tsx  # /routines/:routineId — Routine detail + today's items
      HealthDetailPage.tsx   # /health — Hub: routine cards + health log list
      HealthRoutineEditPage.tsx  # /health/routines/new, /health/routines/:id/edit
      HealthRoutineDashPage.tsx  # /health/routines/:routineId — Daily dashboard
      NotFoundPage.tsx
      *.css                  # Per-page CSS files
    shared/
      components/
        Toast.tsx            # ToastProvider + useToast() — success/info/error toasts
    styles/
      app-tokens.css         # All --sn-* CSS custom properties (dark + light)
      app-shared.css         # Shared utility classes
  functions/
    src/index.ts             # Cloud Functions: sendReminders (scheduled), FCM
  docs/
    SANDBOX_PRODUCT_SPEC.md  # Full product spec (reference for feature context)
    SHAREABLE_PROJECTS_SPEC.md # Shared/collaborative groups (projects + shopping lists) feature spec (D8–D12; §8 = lists)
  firebase.json              # Hosting SPA rewrite + Functions config
  .firebaserc                # project: sneworks-app
  package.json               # name: sneworks
```

---

## Architecture — Shell & Scroll

### Fixed shell pattern (CRITICAL — read before touching layout CSS)

```
.sn-shell  →  position: fixed; inset: 0; overflow: hidden
  .sn-content  →  flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch
    <Outlet />   ← all pages render here
  <BottomNav />  ← fixed at bottom inside sn-shell
  <div id="sn-portal" />  ← sheet portal target (MUST be inside sn-shell)
  <ComposeSheet />  <DeferSheet />  <EditRecurringSheet />
```

**Rules that follow from this:**
1. **Pages must NOT use `min-height: 100dvh` or `height: 100vh`** — this inflates the page beyond the scroll container and creates extra scroll. Use `min-height: 100%` instead.
2. **Bottom padding on all pages:** `calc(var(--sn-nav-height) + 24px)` = `calc(64px + 24px) = 88px`. Without this the last content hides behind the nav.
3. **`overflow-x: hidden` + `min-width: 0` on flex children** — flex children without `min-width: 0` can overflow their container horizontally. Add both to page containers and body wrappers.
4. **Max-width containers:** Use `max-width: 600px; margin: 0 auto` for readable content columns.

### Theme & CSS Variables

All `--sn-*` variables are scoped to `[data-theme]`. The `data-theme` attribute lives on `.sn-shell`. All CSS must reference these variables — **no hardcoded hex colors** that only work in one theme.

Key variables to know:
```css
--sn-bg, --sn-bg-elev, --sn-bg-card, --sn-bg-card-hover, --sn-bg-input, --sn-bg-sheet
--sn-border, --sn-border-strong
--sn-text, --sn-text-dim, --sn-text-muted
--sn-accent, --sn-accent-soft, --sn-accent-glow, --sn-accent-text
--sn-success, --sn-success-soft
--sn-danger, --sn-danger-soft
--sn-warning, --sn-warn, --sn-warn-soft
--sn-gold, --sn-purple
--sn-nav-height (64px)
--sn-color-scheme (dark | light)  ← for native browser input rendering
--sn-font-scale (0.88 | 1 | 1.15)  ← from data-font attribute
```

**Dark mode:** `data-theme="dark"` on `.sn-shell`. Set from settings doc (`darkMode` field). Seeded from `localStorage['sneworks-dark']` for instant first paint.
**Font scale:** `data-font="small|medium|large"` on `.sn-shell`. `--sn-font-scale` CSS var used as `font-size: calc(13px * var(--sn-font-scale, 1))` everywhere.

### Input color-scheme (CRITICAL)
**All** date pickers, text inputs, and color inputs must have:
```css
color-scheme: var(--sn-color-scheme, light);
```
Without this, the browser renders the native date picker chrome in dark mode always, even when the app is in light mode.

---

## Architecture — Sheets (Bottom Sheets)

### BottomSheet portal pattern
`BottomSheet.tsx` portals its content to `document.getElementById('sn-portal')` (falls back to `document.body`).

**The `#sn-portal` div MUST be inside `.sn-shell`** (which has `data-theme`). If sheets are portaled to `document.body`, they escape `[data-theme]` and all `--sn-*` CSS variables resolve to nothing — sheets become transparent/unstyled.

```tsx
// AppShell.tsx — correct structure:
<div className="sn-shell" data-theme={...} ref={themeRef}>
  <div className="sn-content"><Outlet /></div>
  <BottomNav />
  <div id="sn-portal" />   {/* ← sheets portal here, inside [data-theme] */}
  {composeOpen && <ComposeSheet ... />}
  {deferOpen && <DeferSheet ... />}
  {editRecurringGroup && <EditRecurringSheet ... />}
</div>
```

### Sheets available
- **ComposeSheet** — universal create/edit for all todo types + all log types. Opened via `useUI()`:
  - `openComposeTodo(todoType?)` — opens type picker or jumps to form
  - `openComposeLog(logType?)` — opens log type picker or jumps to form
  - `openComposeHealthLog(prefill?)` — opens health log form with optional prefill from a routine
  - `openComposeForEdit(entry)` — opens pre-filled edit form
  - `openComposeForGroup(groupId, todoType?)` — pre-selects group
- **DeferSheet** — date/time picker for deferring a todo. Opened via `openDefer(todoId)`.
- **EditRecurringSheet** — edit a `RecurringTodoGroup`. Opened via `openEditRecurring(group)`.
- **ConfirmSheet** — wraps BottomSheet for yes/no confirmation. Required before any delete/archive action.

### ConfirmSheet usage pattern
```tsx
const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

// In JSX:
{confirmDeleteId && (
  <ConfirmSheet
    title="Delete this?"
    message="This cannot be undone."
    confirmLabel="Delete"
    danger    // red confirm button
    onConfirm={() => { setConfirmDeleteId(null); handleDelete(confirmDeleteId); }}
    onCancel={() => setConfirmDeleteId(null)}
  />
)}

// On delete button click:
<button onClick={() => setConfirmDeleteId(item.id)}>Delete</button>
```

---

## Architecture — Stores (Zustand)

Three Zustand stores, one per Firestore collection. All follow the same pattern:

### Pattern
```ts
// 1. Cache seed — synchronous, instant first render
const cachedUid = getCachedUid();
const initialData = cachedUid ? readCache(cacheKey(cachedUid, KEY)) ?? [] : [];

// 2. Init subscribes to Firestore, writes cache on each snapshot
init: (uid) => {
  const unsub = subscribeToAll(uid, (data) => {
    set({ data, loaded: true });
    writeCache(cacheKey(uid, KEY), data);
  });
  return unsub;  // AppShell calls unsub on cleanup
}
```

**Cache keys:** `sneworks_{uid}_todos`, `sneworks_{uid}_logs`, `sneworks_{uid}_groups`

**Timestamp serialization:** `readCache`/`writeCache` in `utils.ts` handle serialization. Timestamps are stored as `{ __firestoreTimestamp: true, seconds, nanoseconds }` and revived back to `Timestamp` instances on read. This is transparent — just use `readCache`/`writeCache`.

**Optimistic updates:** Status changes (complete, skip, defer) update local store state first, then fire Firestore write. On error, the error is surfaced via toast but local state is NOT rolled back (acceptable UX trade-off for simplicity).

### useTodosStore selectors
```ts
getOverdueTodos()           // pending/deferred with dueAt < startOfToday (excludes shopping items)
getTodayTodos()             // pending/deferred with dueAt today OR no dueAt (excludes shopping items)
getDoneTodayTodos()         // status=done and completedAt today
getTodosForGroup(groupId)   // all todos with matching groupId
getUngroupedShoppingItems() // shopping-item todos with no groupId
```

### useGroupsStore selectors
```ts
getActiveShoppingLists()         // groupKind=shopping-list, not archived
getArchivedShoppingLists()       // groupKind=shopping-list, archivedAt set
getActiveProjects()              // groupKind=project, !completed, !archivedAt, !parentGroupId
getCompletedProjects()           // groupKind=project, completed, !archivedAt, !parentGroupId
getArchivedProjects()            // groupKind=project, archivedAt set
getActiveRoutines()              // groupKind=routine, !archivedAt
getArchivedRoutines()            // groupKind=routine, archivedAt set
getActiveRecurringTodos()        // groupKind=recurring-todo, !archivedAt
getSubGroups(parentGroupId)      // all groups with matching parentGroupId
```

### Circular store dependency (IMPORTANT)
`useGroupsStore.deleteGroup` needs to clean up todos from `useTodosStore`. Importing `useTodosStore` at module level creates a circular dependency. Solution: **lazy dynamic import inside the async function**:
```ts
deleteGroup: async (uid, groupId) => {
  // optimistic local update first
  set((s) => ({ groups: s.groups.filter((g) => g.id !== groupId) }));
  // lazy import to avoid circular dependency
  const { useTodosStore } = await import('./useTodosStore');
  useTodosStore.getState().removeAllTodosForGroup(groupId);
  // then Firestore
  await fbDeleteGroup(uid, groupId);
  deleteAllTodosForGroup(uid, groupId).catch(console.error);
}
```

### Group deletion — clean up ALL todos (not just pending)
When a `RecurringTodoGroup` or `RoutineGroup` is deleted, use **`deleteAllTodosForGroup`** (no status filter). Using `deletePendingTodosForGroup` (status === 'pending' filter) leaves behind deferred todos which reappear in Today view after the Firestore snapshot fires.
- `deleteAllTodosForGroup(uid, groupId)` — Firestore batch delete, no status filter
- `deletePendingTodosForGroup(uid, groupId)` — only use for archiving (keeps completed history)
- `removeAllTodosForGroup(groupId)` — local store removal, no status filter
- `removePendingTodosForGroup(groupId)` — local store removal, only pending

---

## Architecture — Routing

All routes are nested under `ProtectedRoute` → `AppShell`. Everything is lazy-loaded.

```
/                          → TodayPage
/routines                  → RoutinesPage
/routines/:routineId       → RoutineDetailPage
/timeline                  → TimelinePage
/more                      → MorePage
/groups/:groupId           → GroupDetailPage  (shopping lists)
/projects                  → ProjectsPage
/projects/:projectId       → ProjectDetailPage
/health                    → HealthDetailPage  (hub: routines + log list)
/health/routines/new       → HealthRoutineEditPage
/health/routines/:routineId      → HealthRoutineDashPage
/health/routines/:routineId/edit → HealthRoutineEditPage
/login                     → LoginPage  (outside AppShell)
```

**Navigation state signals:** `useLocation` state (e.g. `{ openAdd: true }`) consumed once via `window.history.replaceState({}, document.title)` to prevent re-trigger on back navigation.

---

## Data Model

### Types file: `src/types.ts` (single source of truth)

#### Todos (Firestore: `sandbox_todos`)
```ts
type TodoType = 'money-reminder' | 'shopping-item' | 'generic-task';
type TodoStatus = 'pending' | 'done' | 'skipped' | 'deferred';

interface TodoBase {
  id?: string;
  todoType: TodoType;
  title: string;
  notes?: string;
  status: TodoStatus;
  groupId?: string;
  groupPath?: string[];
  pinnedToday?: boolean;
  dueAt?: Timestamp;
  completedAt?: Timestamp;
  recurrence?: string;
  recurrenceId?: string;
  sourceLogId?: string;
  sortOrder: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
// MoneyReminderTodo adds: amount?, category?, lastCycleStatus?, lastCycleCompletedAt?
// ShoppingItemTodo adds: categoryTag?, quantity?, price?, lastKnownPrice?
// GenericTaskTodo: no additional fields
```

#### Logs (Firestore: `sandbox_logs`)
```ts
type LogType = 'expense' | 'income' | 'generic-note' | 'health-log';

interface LogBase {
  id?: string;
  logType: LogType;
  title: string;
  notes?: string;
  occurredAt: Timestamp;
  sourceTodoId?: string;
  sourceGroupId?: string;
  sortOrder: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
// ExpenseLog adds: amount, spentOn, category?
// IncomeLog adds: amount, source
// GenericNoteLog adds: noteCategory
// HealthLog adds: workoutType?, mood?, weightKg?, durationMin?, durationSec?,
//   intensity?, caloriesBurned?, caloriesEstimated?, distanceValue?, distanceUnit?,
//   sets?, reps?, sourceRoutineId?, sourceTemplateIdx?
```

#### Groups (Firestore: `sandbox_groups`)
```ts
type GroupKind = 'shopping-list' | 'project' | 'routine' | 'recurring-todo';

interface GroupBase {
  id?: string;
  groupKind: GroupKind;
  name: string;
  description?: string;
  color?: string;
  glyph?: string;
  parentGroupId?: string;
  ancestorPath: string[];
  showProgress: boolean;
  showSumMoney: boolean;
  childCount: number;
  doneCount: number;
  completed: boolean;
  completedAt?: Timestamp;
  archivedAt?: Timestamp;     // soft-delete
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
// ShoppingListGroup adds: priceTrackingEnabled, totalSpent
// ProjectGroup adds: deadline?
// RoutineGroup adds: recurrence, spawnTime, templateChildren: TemplateItem[],
//   lastSpawnedAt?, streakCount, deferUntil?,
//   isHealthRoutine?, dailyCalorieGoal?, dailyDurationGoal?, weeklySessionGoal?,
//   reminderEnabled?, reminderMinutesBefore?
// RecurringTodoGroup adds: recurTodoType, recurrence, amount?, category?,
//   lastSpawnedAt?, streakCount
```

#### TemplateItem (inside RoutineGroup.templateChildren)
```ts
interface TemplateItem {
  title: string;
  todoType?: TodoType;
  scheduledTime?: string;
  estimatedDuration?: number;
  // Health workout fields (isWorkout: true discriminates workout vs generic task)
  isWorkout?: boolean;
  workoutType?: WorkoutType;
  targetDurationMin?: number;
  targetIntensity?: IntensityLevel;
  targetDistanceValue?: number;
  targetDistanceUnit?: 'km' | 'm';
  targetSets?: number;
  targetReps?: number;
}
```

### Recurrence string encoding
```
'daily'         → every day
'weekdays'      → Mon–Fri
'weekly:MON'    → every Monday
'weekly:MON,WED,FRI' → multi-day (health routines use this)
'monthly:N'     → Nth of each month
'quarterly:N'   → Nth of Jan/Apr/Jul/Oct
'yearly:N'      → Nth of January each year
```
Parsed by `isDueToday()` and `recurrenceLabel()` in `src/firebase/routineSpawner.ts`.

---

## Spawner (routineSpawner.ts)

Runs once per session in `AppShell` after `groupsLoaded === true` (guarded by `useRef`).

```ts
spawnDueRoutines(uid)        // RoutineGroup → spawns TemplateItem todos for today
spawnDueRecurringTodos(uid)  // RecurringTodoGroup → spawns one todo per due date
```

**Spawn guard:** Checks `lastSpawnedAt` — if today, skips. Writes `lastSpawnedAt: Timestamp.now()` after spawn.
**Multi-day weekly:** `weekly:MON,WED,FRI` is supported. `isDueToday` splits on commas and checks if any match today.

---

## Health Feature

### Route map
- `/health` — HealthDetailPage: hub showing active routine cards + archived routines + log history + streak/week stats
- `/health/routines/new` — HealthRoutineEditPage (create mode)
- `/health/routines/:routineId` — HealthRoutineDashPage (daily dashboard)
- `/health/routines/:routineId/edit` — HealthRoutineEditPage (edit mode)

### Discriminator: isHealthRoutine
`RoutineGroup.isHealthRoutine === true` marks a health routine. Generic routines have this `undefined`/`false`. The same Firestore collection, same spawner — health routines just carry extra optional fields.

### Log pre-fill from routine
```ts
// In UIContext:
openComposeHealthLog(prefill?: HealthLogPrefill)

interface HealthLogPrefill {
  workoutType?: WorkoutType;
  targetDurationMin?: number;
  targetIntensity?: IntensityLevel;
  targetDistanceValue?: number;
  targetDistanceUnit?: 'km' | 'm';
  targetSets?: number;
  targetReps?: number;
  sourceRoutineId?: string;
  sourceTemplateIdx?: number;
}
```

### Log → Todo link
When a health log is saved with `sourceRoutineId` + `sourceTemplateIdx`, `ComposeSheet` marks the matching spawned todo as done (finds it by `groupId === sourceRoutineId` and `sortOrder === sourceTemplateIdx`).

### Health log enrichment (WorkoutType, IntensityLevel)
```ts
type WorkoutType = 'Run' | 'Walk' | 'Cycle' | 'Gym' | 'Yoga' | 'Swim' | 'Other';
type IntensityLevel = 'Low' | 'Moderate' | 'High' | 'Max';
```
Constants + helpers in `src/constants/health.ts`:
- `WORKOUT_TYPES`, `MET_TABLE`, `INTENSITY_LEVELS`, `INTENSITY_COLORS`
- `calcCalories(activity, intensity, durationMin, weightKg)` — MET formula
- `distanceUnit(activity)` — 'km' | 'm' | null
- `showsDistance(activity)`, `showsSetsReps(activity)` — conditional field visibility

### Health components
- `ActivityIcon` — SVG icon per WorkoutType
- `GoalRing` — SVG donut ring: `<GoalRing pct={0.7} color="#fb923c" size={90} strokeWidth={9} label="350" sublabel="/ 500 kcal" />`
- `WeeklyBarChart` — 7-column bar chart: `<WeeklyBarChart data={[...7 numbers]} goal={500} labels={['M','T',...]} height={90} />`
- `WorkoutCard` — expandable card with target vs logged comparison
- `IntensityDot` — small colored circle: `<IntensityDot intensity="High" size={6} />`

---

## Navigation & Bottom Nav

5-position layout with centered split pill FAB:
```
[ Today ]  [ Routines ]  [ Log | + ]  [ Health ]  [ More ]
     /        /routines    (center)     /health      /more
```

Implemented in `BottomNav.tsx` + `SplitPillFAB.tsx`. The center slot is a spacer (`aria-hidden`); the FAB floats above using `position: absolute; bottom: calc(var(--sn-nav-height) + ...)`.

**SplitPillFAB halves:**
- Left (Pencil icon, "Log") → `openComposeLog()`
- Right (Plus icon, "TODO") → `openComposeTodo()`

---

## Key Patterns & Pitfalls

### ❌ Never hardcode colors
```css
/* BAD */
color: #fb923c;
background: rgba(251, 146, 60, 0.12);

/* GOOD */
color: var(--sn-warning);
background: var(--sn-warn-soft);
```

### ❌ Never hardcode color-scheme on inputs
```css
/* BAD — breaks light mode */
color-scheme: dark;

/* GOOD */
color-scheme: var(--sn-color-scheme, light);
```

### ❌ Never use min-height: 100dvh on pages
```css
/* BAD — causes extra scroll inside sn-content */
.sn-hre-page { min-height: 100dvh; }

/* GOOD */
.sn-hre-page { min-height: 100%; }
```

### ❌ Never portal sheets to document.body
If `BottomSheet` portals to `document.body`, it escapes `[data-theme]` and all `--sn-*` CSS vars fail. Always portal to `#sn-portal`.

### ❌ Never delete recurring group without cleaning up spawned todos
`deleteGroup` must call both:
- `removeAllTodosForGroup(groupId)` — local store (no status filter — catches deferred items)
- `deleteAllTodosForGroup(uid, groupId)` — Firestore batch delete

Using `deletePendingTodosForGroup` (status === 'pending' only) leaves deferred todos behind.

### ❌ Never delete without confirmation
All destructive actions (delete group, delete recurring, delete archived routine) must show `ConfirmSheet` before firing. Pattern: `useState<string | null>(null)` for the ID being confirmed.

### ✅ Bottom padding on pages
Every page needs padding at the bottom so content doesn't hide behind the nav:
```css
padding-bottom: calc(var(--sn-nav-height) + 24px);
/* equivalent to: padding-bottom: 88px; */
```

### ✅ Flex overflow prevention
When page body has `display: flex; flex-direction: column`, add:
```css
.sn-page-body {
  min-width: 0;      /* prevents flex child from overflowing horizontally */
  overflow-x: hidden;
  width: 100%;
}
```

### ✅ Touch targets
All interactive elements: `min-height: 44px; min-width: 44px`. Use `-webkit-tap-highlight-color: transparent` on buttons.

### ✅ Font sizes
Always use CSS var scale:
```css
font-size: calc(13px * var(--sn-font-scale, 1));
```

### ✅ Project todos — Today page filter
Project-grouped todos must NOT appear in Up Next / Overdue (they appear in the Projects section instead). Filter in `TodayPage`:
```ts
buildGroupedTodos(upNext, groupMap).filter((tg) => tg.group?.groupKind !== 'project')
```

---

## Auth Architecture

`AuthProvider` in `App.tsx` wraps all routes. `useAuth()` → `{ user, loading, optimistic }`.

**Optimistic auth:** On login, saves `sneworks_auth_hint = { uid, ts }` to localStorage (7-day TTL). On refresh, `optimistic=true` → `ProtectedRoute` renders children immediately without waiting for Firebase session confirmation.

**`getCachedUid()`** — synchronous, reads the auth hint. Used by stores for cache seed before `user` is available.

**`clearAllCache()`** — wipes all `sneworks*` localStorage keys. Called on logout/session expiry.

**Store initialization:** `AppShell` calls `initTodos(uid)`, `initGroups(uid)`, `initLogs(uid)` in a `useEffect` on `user`. Returns unsubscribes, cleaned up on unmount.

---

## TodayPage Layout

Sections top to bottom:
1. **Overdue** (red header) — `dueAt < startOfToday`, status pending/deferred, excludes shopping items, excludes project-grouped items
2. **Up Next** — due today OR no dueAt, status pending/deferred, excludes shopping items, excludes project-grouped items
3. **Active Shopping Lists** — compact cards → `/groups/:groupId`
4. **Active Projects** — compact cards → `/projects/:projectId`
5. **Done Today** — completed today, muted
6. **Today's Logs** — log entries from today

Items with `groupId` are shown as collapsible group cards (collapsed by default). Ungrouped items are a flat list.

---

## Group & Project Mechanics

### recomputeGroupCounts
Called after any TODO write within a group. Reads all todos with `groupId`, computes `childCount`, `doneCount`, `totalSpent`. If all done → sets `completed: true`, `completedAt`.

Recursive for projects: propagates up to `parentGroupId` (max depth 3 to guard against runaway).

### Project nesting (max 2 levels)
- Top-level: `parentGroupId: undefined`, `ancestorPath: []`
- Sub-project: `parentGroupId: parentId`, `ancestorPath: [parentId]`
- `ProjectDetailPage` hides Sub-projects section when `ancestorPath.length >= 1`

### Shopping auto-trip
When an ungrouped shopping item is checked off for the first time on a given day, an auto-trip group `Shopping:dd-mm-YYYY` is created and the item's `groupId` is set to it.

### Routine spawning
`RoutineGroup.templateChildren` are spawned as `GenericTaskTodo` items with `groupId = routineGroup.id` and `dueAt` set to today. `lastSpawnedAt` is updated to prevent double-spawning.

---

## Feature Status

### ✅ Complete
- Today page (overdue, up-next, shopping, projects, done-today, today-logs)
- Routines page (active routines, recurring todos with edit/delete, archived routines)
- Routine detail page (today's items, template edit, defer)
- Timeline page (log history, day-grouped)
- More page (shopping lists, projects nav, settings: dark mode, font scale)
- Group detail page (shopping list checklist, inline add, price tracking)
- Projects page + Project detail page (sub-projects, tasks, completion propagation)
- ComposeSheet (all todo types + all log types + health log enriched form)
- DeferSheet, EditRecurringSheet
- Swipe actions on todo rows (complete, defer, skip, delete, unmark)
- Health page hub (routine cards, log list, streak/week stats, archived routines)
- Health routine edit page (create + edit: schedule, goals, workout items, task items)
- Health routine dashboard (progress bar, goal rings, weekly chart, workout cards, task checklist)
- Dark/light mode (full CSS var system, settings persistence)
- Font scale (small/medium/large, settings persistence)
- localStorage cache (instant first render from cache, all three stores)
- Optimistic auth (instant page render on refresh)
- Toast notifications (success/info/error with Undo action)
- Confirmation sheets before all delete/archive actions
- Push notifications setup (FCM, Cloud Function `sendReminders`)

### 🔲 Not yet built
- Settings page (notifications toggle, font size toggle — currently done inline in MorePage)
- Health goals (frequency target + progress)
- Streak auto-computation (currently `streakCount` on group is not auto-incremented)
- Multi-day weekly UI for health routine recurrence (data model supports it, UI has the day picker)
- Search / filter on More/Timeline
- Offline support beyond cache (PWA service worker)

---

## Design Principles

- **Mobile-first** — 44px+ touch targets, bottom tab nav, slide-up sheets
- **No emoji in structural UI** — page titles, nav labels, type pickers, badges all use SVG or plain text
- **No Tailwind, no CSS-in-JS** — per-component CSS files, shared tokens in `app-tokens.css`
- **No Redux/Zustand middleware complexity** — plain Zustand with `set`/`get`, optimistic updates
- **Client-side filtering** — avoids Firestore composite index requirements
- **Date storage** — `Timestamp` for todos/logs (`dueAt`, `completedAt`, `occurredAt`). YYYY-MM-DD strings only for human-readable display where needed.
- **No external animation/chart/icon libraries** — all CSS transitions, inline SVG, Lucide for icons
- **Undo pattern** — toast with `{ action: { label: 'Undo', onClick: restoreFn } }` on destructive actions

---

## Firebase Config
Real values in `src/firebase/config.ts`. Do not commit to a public repo without moving to env vars. The existing file is not in `.gitignore` — this is intentional for a private project.

## Cloud Functions
`functions/src/index.ts` contains:
- `sendReminders` — scheduled, checks todos with upcoming/overdue `dueAt`, sends FCM push

Deploy: `npm run deploy` (deploys hosting + functions together).
