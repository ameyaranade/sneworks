# Logger — Implementation Reference

This file documents the complete `/logger` feature implementation for `sneworks.com`. Use it as the authoritative reference for any future work on the Logger section.

---

## What Logger Is

A schema-driven activity tracker at `/logger` that lives parallel to `/tracker`. The key philosophy: **only two primitives exist**.

- **Log** — something that *happened* (past event, immutable once written)
- **Todo** — something *to do* (future intent, can be completed / deferred / skipped)

Everything else — Money, Water, Shopping, Habits, Projects, Routines — is **configuration** expressed as `TypeSchema` documents stored in Firestore, not hardcoded UI. The same engine renders all of them.

---

## Architectural Decisions

### 1. Route & Coexistence
- Lives at `/logger` in React Router v6, nested under the `<Layout>` shell
- `/tracker` is **untouched** — no shared state, no shared stores
- Both routes can be open simultaneously in different browser tabs without conflict

### 2. Firestore Collections
All under `users/{uid}/` with the `logger_` prefix to avoid colliding with tracker's `activities/`, `reminders/`, `settings/`:

| Collection | Document Type | Purpose |
|---|---|---|
| `logger_entries/{id}` | Entry | All logs + todos (unified) |
| `logger_types/{id}` | TypeSchema | Type definitions driving form rendering |
| `logger_groups/{id}` | Group | Projects, lists, routine groups |
| `logger_routines/{id}` | Routine | Recurrence templates |

Existing Firestore wildcard rule `users/{uid}/{document=**}` already covers all four collections — no rule changes needed.

### 3. CSS Isolation
- **Attribute scope**: All Logger tokens defined under `[data-logger-theme]` (set on the root shell div)
- **Class prefix**: Every Logger CSS class uses `lg-` prefix
- **Token prefix**: Every CSS custom property uses `--lg-` prefix
- Tracker uses `[data-theme="dark"]` and `--color-*` tokens — zero overlap

Logger has its own darker palette: `#0a0b10` background vs tracker's `#0f0f1e`. Accent is `#9eb3ff` vs tracker's `#5599ff`.

### 4. State Management
- **Logger**: Zustand stores (4 stores, one per collection)
- **Tracker**: Stays on React Context (TrackerProvider + DrawerContext)
- Rationale: Logger's cross-referencing data (entries reference typeId → types, groupId → groups) benefits from Zustand's selector-based re-rendering

### 5. localStorage Cache Strategy
Same pattern as TrackerProvider, reused in all 4 Zustand stores:
- Cache key: `sneworks_logger_{uid}_{key}` (via `loggerCacheKey()` in `constants.ts`)
- Read synchronously in `useState` lazy initializer via `getCachedUid()` → first render has data
- Write on every `onSnapshot` callback
- Cleared on logout (uses `clearAllCache()` from AuthContext which wipes all `sneworks*` keys)
- Timestamps serialized with `__firestoreTimestamp` discriminator, revived by `reviveTimestamps()`

### 6. Font Loading
Fonts loaded via Google Fonts `<link>` in `index.html` (not @font-face downloads):
- `Fraunces` — display/heading font (`--lg-font-display`)
- `JetBrains Mono` — monospace/label font (`--lg-font-mono`)
- `Inter` — body font (`--lg-font-body`)

### 7. Offline Persistence
`src/firebase/config.ts` uses `initializeFirestore(app, { localCache: persistentLocalCache() })` instead of `getFirestore(app)`. This enables IndexedDB offline caching for all Firestore data (both tracker and logger). Wrapped in try/catch to fall back to memory cache if IndexedDB is unavailable.

### 8. Auto-Seeding Default Types
On first use, `subscribeToTypes` fires with an empty snapshot → calls `seedDefaultTypes(uid)` → batch-writes 8 built-in `TypeSchema` docs with `builtIn: true`. Subscription fires again with data. No duplicate seed: `seedDefaultTypes` runs `getDocs` first and returns early if collection is non-empty.

### 9. Routine Spawner
Runs in `LoggerShell` via `useEffect` with a `useRef` guard (fires once per session):
- Loads after `useRoutinesStore.loaded === true`
- Calls `spawnDueRoutines(uid, routines)` from `routineQueries.ts`
- For each routine: parses RRule string, checks if today is a valid occurrence, batch-creates pending todo entries from `templateChildren`, advances `lastSpawnedAt`
- Entries created with `source: 'recurring'`, `recurrenceId: routine.id`, `instanceOf: routine.id`

### 10. Shared Toast
`src/tracker/components/Toast.tsx` was moved to `src/shared/components/Toast.tsx` and enhanced:
- Added `type: 'error' | 'success' | 'info'`
- Added `action?: { label: string; onClick: () => void }` for 5-second undo toasts
- Added `duration?: number` (defaults differ by type)
- Tracker's `Toast.tsx` now re-exports from shared path — zero tracker import changes needed

---

## Directory Structure

```
src/logger/
  LoggerShell.tsx              # Shell: providers → stores init → layout → sheets → nav
  logger-shell.css
  types.ts                     # All TypeScript interfaces
  constants.ts                 # DEFAULT_TYPE_SCHEMAS (8 built-ins) + loggerCacheKey()
  utils.ts                     # Date helpers, cache helpers, formatLogTitle, relativeDateLabel

  styles/
    logger-tokens.css          # All --lg-* CSS vars scoped under [data-logger-theme]
    logger-typography.css      # @font-face / Google Fonts import

  context/
    LoggerUIContext.tsx         # Sheet orchestration (compose/defer open/close state)

  stores/
    useEntriesStore.ts         # Entries CRUD + optimistic updates + selectors
    useTypesStore.ts           # TypeSchema subscription + typesMap (Map<id, TypeSchema>)
    useGroupsStore.ts          # Groups subscription + recomputeGroupCounts trigger
    useRoutinesStore.ts        # Routines subscription + CRUD

  firebase/
    loggerQueries.ts           # Entry CRUD + onSnapshot subscriptions
    typeQueries.ts             # TypeSchema CRUD + seedDefaultTypes
    groupQueries.ts            # Group CRUD + recomputeGroupCounts
    routineQueries.ts          # Routine CRUD + spawnDueRoutines

  components/
    primitives/
      LoggerBottomNav.tsx      # 4 NavLink tabs: Today | Timeline | Plan | More
      BottomSheet.tsx           # Slide-up sheet: 28px radius, backdrop, handle, focus trap
      FAB.tsx                   # Center floating action button (52px, accent glow shadow)
      SegmentedControl.tsx      # N-segment toggle with sliding CSS indicator
      Chip.tsx                  # Select/deselect chip (border+color on selected)
      StatusDot.tsx             # filled/outline/dashed/colored dot (log/pending/recurring/done)
    inputs/
      SchemaFieldInput.tsx     # Renders any SchemaField by type (11 variants)
      TypePicker.tsx            # 2-col card grid of types from useTypesStore
      GroupPicker.tsx           # Chip row of groups for entry→group assignment
      QuickPills.tsx            # Quick-value pills (+50/+100/+200/+500 for currency)
    rows/
      EntryRow.tsx              # Schema-driven entry display: checkbox/dot + title + type badge
      GroupCard.tsx              # Card with left stripe, name, kind tag, agg strip, progress bar
      DayHeader.tsx             # Past / Today / Future day header with entry count
    composites/
      EntryList.tsx             # Maps entries → SwipeableRow wrapping EntryRow
      WeekStrip.tsx             # 7-day horizontal strip with density dots
      NowLine.tsx               # "Now" divider for Timeline between future and past days
    sheets/
      ComposeSheet.tsx          # Step 1: TypePicker → Step 2: form (kind toggle + fields + group)
      DeferSheet.tsx            # Tomorrow / Next Week / Pick Date date picker
      GroupCreateSheet.tsx      # Name + kind (list/project/routine) + agg toggles
      RoutineCreateSheet.tsx    # Name + recurrence chips + spawn time + template items
    swipe/
      SwipeableRow.tsx          # framer-motion drag="x", threshold 80px, left+right actions

  pages/
    TodayPage.tsx              # SegmentedControl (Today/Week/Month) + Overdue/UpNext/Log/Done sections
    TimelinePage.tsx           # Day-grouped entries, NowLine between future/past, last 30 days
    PlanPage.tsx               # Week navigation, WeekStrip, day entry list
    MorePage.tsx               # Search + Groups + Routines + Activity Types + GroupCreate
    GroupDetailPage.tsx        # Breadcrumb header + agg strip + filtered entry sections
```

---

## Data Model

### Entry (unified Log + Todo)
```typescript
interface Entry {
  id?: string;
  kind: 'log' | 'todo';          // THE only two primitives
  typeId: string;                 // → logger_types/{typeId}
  title: string;
  notes?: string;
  data: Record<string, unknown>;  // schema-driven: { amount: 120, category: 'Food' }
  occurredAt?: Timestamp;         // logs: when it happened
  dueAt?: Timestamp;              // todos: when due
  completedAt?: Timestamp;
  status?: 'pending' | 'done' | 'skipped' | 'deferred';
  groupId?: string;
  groupPath?: string[];           // e.g. ["Diwali", "Gifts"]
  pinnedToday?: boolean;
  recurrenceId?: string;          // routine.id if spawned by routine
  instanceOf?: string;            // same as recurrenceId for spawned entries
  sortOrder: number;              // Date.now() at creation
  source: 'manual' | 'quick-add' | 'parsed' | 'recurring';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### TypeSchema
```typescript
interface TypeSchema {
  id?: string;
  name: string;
  glyph: string;          // lucide-react icon name (e.g. "IndianRupee", "Droplets")
  color: string;          // 'accent' | 'success' | 'danger' | 'gold' | '#hex'
  fields: SchemaField[];
  defaultKind: 'log' | 'todo';
  cardLayout: 'split' | 'latest' | 'progress' | 'counter' | 'checklist';
  logFormat?: string;     // "{amount} on {category}" → displayed as title
  aggregations?: AggregationConfig[];
  completionBridge?: CompletionBridge;  // shopping → creates expense on completion
  builtIn?: boolean;
  sortOrder: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface SchemaField {
  key: string;
  type: 'number' | 'text' | 'enum' | 'date' | 'duration' | 'currency'
      | 'boolean' | 'select' | 'multi-select' | 'time' | 'rating' | 'url';
  label: string;
  prefix?: string;       // "₹" for currency fields
  suffix?: string;       // "ml" for water, "min" for duration
  options?: string[];    // for enum/select/multi-select
  required?: boolean;
  defaultValue?: unknown;
  aggregatable?: boolean;
}
```

### Group
```typescript
interface Group {
  id?: string;
  name: string;
  kind: 'project' | 'list' | 'routine';
  color: string;
  glyph: string;
  parentGroupId?: string;
  ancestorPath: string[];
  deadline?: Timestamp;
  budget?: number;
  showProgress: boolean;    // show progress bar on GroupCard
  showSumMoney: boolean;    // show ₹ total on GroupCard
  showBudget: boolean;
  showDeadline: boolean;
  showTime: boolean;
  showStreak: boolean;
  childCount: number;       // denormalized, recomputed on entry write
  doneCount: number;        // denormalized
  totalSpent: number;       // denormalized, sum of currency fields
  archivedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Routine
```typescript
interface Routine {
  id?: string;
  name: string;
  recurrence: string;           // RRule string e.g. "FREQ=DAILY", "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
  spawnTime: string;            // "06:00" — display only (spawning is client-side on load)
  templateChildren: TemplateItem[];
  aggregations: ('progress' | 'streak')[];
  lastSpawnedAt?: Timestamp;    // advances each time routine is spawned
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface TemplateItem {
  title: string;
  typeId?: string;
  scheduledTime?: string;
  estimatedDuration?: number;
}
```

---

## 8 Built-in TypeSchemas (seeded from constants.ts)

| # | Name | Glyph | Color | Kind | logFormat |
|---|---|---|---|---|---|
| 1 | Expense | IndianRupee | danger | log | `₹{amount} on {category}` |
| 2 | Income | TrendingUp | success | log | `+₹{amount} — {source}` |
| 3 | Water | Droplets | accent | log | `{amount} {unit}` |
| 4 | Workout | Dumbbell | #c5b4ff | log | `{type} for {duration} min` |
| 5 | Habit | Repeat | success | todo | `{title} done` |
| 6 | Shopping | ShoppingCart | accent | todo | `Bought {title}` |
| 7 | Note | FileText | #8a8fa3 | log | `{notes}` |
| 8 | Task | CheckSquare | accent | todo | `{title}` |

Shopping has a `completionBridge` → when a shopping list group is completed, creates an Expense log entry with the total price.

---

## Key Patterns

### logFormat Interpolation
`formatLogTitle(logFormat, data)` in `utils.ts` — replaces `{key}` placeholders with `data[key]`. Used in:
- `EntryRow.tsx` to compute the display title
- `ComposeSheet.tsx` title input placeholder and "Save · …" button label

### Dynamic Icon Resolution
Lucide icons looked up by glyph string at runtime:
```tsx
const icons = LucideIcons as Record<string, React.ComponentType<LucideIconProps>>;
const Icon = icons[glyph]; // e.g. icons["IndianRupee"]
```
Used in: `EntryRow.tsx`, `TypePicker.tsx`, `MorePage.tsx`

### Color Resolution
Token names mapped to CSS vars in `EntryRow.tsx`:
```ts
const colorMap = { accent: 'var(--lg-accent)', success: 'var(--lg-success)',
                   danger: 'var(--lg-danger)', gold: 'var(--lg-gold)', warn: 'var(--lg-warn)' };
return colorMap[color] ?? color; // raw hex falls through
```

### Group Stripe Colors
Left border accent on `GroupCard`, used throughout:
- `project` → `var(--lg-gold)` (#e5c07b)
- `routine` → `var(--lg-purple)` (#c5b4ff)
- `list` → `var(--lg-accent)` (#9eb3ff)

### Status Dots (StatusDot.tsx)
| variant | appearance | used for |
|---|---|---|
| `log` | filled solid | past log entries |
| `pending` | open circle | pending todos |
| `done` | filled green | completed todos |
| `skipped` | dim circle | skipped todos |
| `recurring` | dashed circle | routine-spawned entries |
| `overdue` | filled red | overdue pending todos |

### SwipeableRow
- `framer-motion` `drag="x"` with `dragConstraints={{ left: 0, right: 0 }}`
- `dragElastic={0.08}` for natural feel
- Threshold 80px: if exceeded, snaps to reveal action buttons; otherwise springs back
- Left swipe reveals: Edit / Skip or Unmark / Delete
- Right swipe reveals: Defer (todos only)
- Action buttons revealed underneath via absolute-positioned containers

### ComposeSheet Two-Step Flow
1. **Step: type** — `TypePicker` 2-column grid. Skipped if `preselectedTypeId` or `editEntry` is set
2. **Step: form** — Back button + type name + Log/Todo kind toggle + title input + `SchemaFieldInput` for each field + `GroupPicker` + Save button
   - Save label: `"Save · {formatLogTitle(logFormat, fieldData)}"` or `"Save {TypeName}"`
   - Supports edit mode: pre-fills all fields from `editEntry`, calls `updateEntry` instead of `addEntry`

### LoggerUIContext — Sheet Orchestration
```ts
openCompose()                  // blank compose
openComposeWithType(typeId)    // pre-select type, skip TypePicker step
openComposeForEdit(entry)      // edit mode, all fields pre-filled
openComposeForDate(date)       // compose with specific date pre-set
openDefer(entryId)             // open DeferSheet for a specific entry
```
State resets 300ms after close (matches sheet slide-out animation duration).

### Zustand Store Pattern
All 4 stores follow the same shape:
```ts
interface XState {
  items: X[];
  loaded: boolean;
  init: (uid: string) => Unsubscribe;   // subscribe to Firestore, returns cleanup
  addX / updateX / deleteX             // optimistic update + Firestore write
}
```
Initialised in `LoggerShell` via `useEffect`, cleaned up on unmount (+ spawner ref reset).

### Firestore subscribeToGroups Index Fallback
`groupQueries.subscribeToGroups` queries `archivedAt == null` + `orderBy('createdAt')` which requires a composite index. If that index doesn't exist (`failed-precondition`), it falls back to just `orderBy('createdAt')` with client-side `archivedAt == null` filter.

---

## CSS Token Reference

All defined in `src/logger/styles/logger-tokens.css` under `[data-logger-theme]`:

```css
/* Backgrounds */
--lg-bg: #0a0b10;         --lg-bg-elev: #14151c;
--lg-bg-card: #181a23;    --lg-bg-input: #12141c;    --lg-bg-sheet: #1a1c26;

/* Borders */
--lg-border: #252836;     --lg-border-strong: #3a3f52;

/* Text */
--lg-text: #f0f1f5;       --lg-text-dim: #8a8fa3;    --lg-text-muted: #5a5f70;

/* Brand */
--lg-accent: #9eb3ff;     --lg-accent-glow: rgba(158,179,255,0.12);
--lg-success: #6ee7a8;    --lg-danger: #ff8a8a;
--lg-gold: #e5c07b;       --lg-purple: #c5b4ff;

/* Radii */
--lg-radius-sheet: 28px;  --lg-radius-card: 14px;
--lg-radius-pill: 100px;  --lg-radius-input: 10px;   --lg-radius-chip: 100px;

/* Fonts */
--lg-font-display: 'Fraunces', Georgia, serif;
--lg-font-body: 'Inter', -apple-system, sans-serif;
--lg-font-mono: 'JetBrains Mono', monospace;

/* Layout */
--lg-nav-height: 64px;    --lg-fab-size: 52px;       --lg-touch-target: 44px;

/* Animation */
--lg-transition-fast: 0.15s ease;
--lg-transition-swipe: 0.28s cubic-bezier(0.2, 0.85, 0.3, 1.0);
```

---

## Routing (App.tsx)

```tsx
// Lazy-loaded Logger pages
const LoggerShell          = lazy(() => import('./logger/LoggerShell'));
const LoggerTodayPage      = lazy(() => import('./logger/pages/TodayPage'));
const LoggerTimelinePage   = lazy(() => import('./logger/pages/TimelinePage'));
const LoggerPlanPage       = lazy(() => import('./logger/pages/PlanPage'));
const LoggerMorePage       = lazy(() => import('./logger/pages/MorePage'));
const LoggerGroupDetailPage= lazy(() => import('./logger/pages/GroupDetailPage'));

// Route definition (inside <Route element={<Layout />}>)
<Route path="/logger" element={<ProtectedRoute><LoggerShell /></ProtectedRoute>}>
  <Route index element={<LoggerTodayPage />} />
  <Route path="timeline" element={<LoggerTimelinePage />} />
  <Route path="plan" element={<LoggerPlanPage />} />
  <Route path="more" element={<LoggerMorePage />} />
  <Route path="groups/:groupId" element={<LoggerGroupDetailPage />} />
</Route>
```

---

## Chunk Splitting (vite.config.ts)

```ts
manualChunks: {
  'vendor-motion': ['framer-motion'],       // ~43KB gzip — SwipeableRow
  'vendor-icons': ['lucide-react'],         // ~166KB gzip — all icons (tree-shaken)
  'vendor-utils': ['zustand', 'date-fns', 'rrule'],  // ~13KB gzip
  logger: [
    './src/logger/LoggerShell.tsx',
    './src/logger/pages/TodayPage.tsx',
    './src/logger/pages/TimelinePage.tsx',
    './src/logger/pages/PlanPage.tsx',
    './src/logger/pages/MorePage.tsx',
    './src/logger/pages/GroupDetailPage.tsx',
  ],  // ~14KB gzip
}
```

---

## Firebase Queries Summary

### loggerQueries.ts
| Function | Description |
|---|---|
| `addEntry(uid, entry)` | Create entry, returns id |
| `updateEntry(uid, id, partial)` | Patch entry fields |
| `deleteEntry(uid, id)` | Hard delete |
| `batchUpdateEntryStatus(uid, ids[], status)` | Batch status change |
| `subscribeToAllEntries(uid, cb)` | Last 90 days, ordered by `createdAt desc` |
| `subscribeToEntriesByGroup(uid, groupId, cb)` | Ordered by `sortOrder asc` |

### typeQueries.ts
| Function | Description |
|---|---|
| `subscribeToTypes(uid, cb)` | Ordered by `sortOrder asc`; seeds defaults on empty |
| `seedDefaultTypes(uid)` | Batch-writes 8 built-ins; no-op if collection non-empty |
| `addTypeSchema / updateTypeSchema / deleteTypeSchema` | Standard CRUD |

### groupQueries.ts
| Function | Description |
|---|---|
| `subscribeToGroups(uid, cb)` | `archivedAt == null`, ordered by `createdAt`; index fallback |
| `recomputeGroupCounts(uid, groupId)` | Recomputes `childCount`, `doneCount`, `totalSpent` from entry scan |
| `addGroup / updateGroup / deleteGroup` | Standard CRUD |

### routineQueries.ts
| Function | Description |
|---|---|
| `subscribeToRoutines(uid, cb)` | All with `updatedAt != null` |
| `spawnDueRoutines(uid, routines)` | Checks RRule, batch-creates entries, advances `lastSpawnedAt` |
| `addRoutine / updateRoutine / deleteRoutine` | Standard CRUD |

---

## Pages — Behaviour Summary

### TodayPage
- SegmentedControl: `Today | Week | Month`
- Sections (all from in-memory store, no extra Firestore calls):
  - **Overdue** — todos past their dueAt window (today view only)
  - **Up next** — pending todos in selected range
  - **Log** — all logs in range
  - **Done** — completed/skipped todos in range
- Shimmer skeleton while `!loaded`

### TimelinePage
- Groups all entries by calendar day (`startOfDay`)
- Sorted descending (newest day first), last 30 days visible
- `NowLine` inserted between day groups where future → today boundary falls
- `DayHeader` shows past/today/future styling + entry count

### PlanPage
- `weekOffset` state → `startOfWeek(now) + offset * 7 days`
- `WeekStrip` shows 7 day cells with up to 3 density dots (entry count)
- Clicking a day cell updates `selectedDate` → `EntryList` below updates
- Prev/Next chevrons adjust `weekOffset`

### MorePage
- **Search**: live client-side filter across `entries` by title + type name, max 30 results
- **Groups**: `GroupCard` list → taps navigate to `GroupDetailPage`
- **Routines**: list with `friendlyRecurrence()` label + item count + delete button
- **Activity Types**: collapsible list showing all type schemas with icons and field counts; `builtIn` types show no delete button

### GroupDetailPage
- Route: `/logger/groups/:groupId`
- Header: back button + group name (colored by kind) + kind tag
- Agg strip: progress ratio + progress bar, money total (if configured)
- Sections: To do / Log / Done

---

## Dependencies Added

```json
"framer-motion": "^11.x",   // SwipeableRow drag gesture
"lucide-react": "^0.x",     // icon library (dynamic glyph lookup by string)
"zustand": "^4.x",          // store management for logger
"date-fns": "^3.x",         // date utilities (imported but utils.ts provides own helpers)
"rrule": "^2.x"             // RRule string parsing for routine recurrence
```

Installed with `--legacy-peer-deps` due to `eslint-plugin-jsx-a11y@6.10.2` requiring eslint `≤9` while project uses eslint@10.

---

## What's Not Yet Built (Future Work)

### Completion Bridge (Shopping → Expense)
The data model (`TypeSchema.completionBridge`) and the shopping type's config are in place. The UI flow — detecting when a shopping-type group reaches 100% completion and prompting to create an Expense log — is not implemented. GroupDetailPage would need a "Complete list" button that reads `completionBridge.askFields`, prompts for price inputs, and calls `addEntry` for the Expense type.

### Type Creation UI
Users can delete custom types in MorePage but cannot create or edit them via UI yet. The Firestore CRUD functions (`addTypeSchema`, `updateTypeSchema`) are ready. A `TypeCreateSheet` would follow the same pattern as `GroupCreateSheet`.

### Streak Computation
`TypeSchema.aggregations` supports `{ type: 'streak' }` and the Habit type is configured for it. Computing consecutive-day completion streaks requires querying entry history grouped by day — not yet surfaced in any UI.

### Push Notifications for Routines
`Routine.spawnTime` is stored as `"HH:MM"` but routine spawning is currently client-side on app load. Server-side scheduling via Firebase Cloud Functions would use this field to trigger notifications and spawning even when the app is closed.

### Search Across All 90 Days
MorePage search filters the in-memory entry cache (last 90 days). Entries older than that require a Firestore query — not implemented.

### Archive Groups
`Group.archivedAt` field exists; setting it to a Timestamp would hide the group from the default subscription (which filters `archivedAt == null`). No archive/unarchive UI yet.

### Recurring Entries Dashed Dot in Timeline
`EntryRow` checks `entry.recurrenceId` and maps it to `StatusDot` variant `'recurring'` (dashed outline). This is already implemented in `StatusDot.tsx`. The visual difference is correctly applied.

---

## Files Modified in Existing Codebase

| File | Change |
|---|---|
| `src/App.tsx` | Added lazy imports + `/logger` route block under `<Layout>` |
| `vite.config.ts` | Added `logger` chunk + 3 vendor chunks (motion, icons, utils) |
| `index.html` | Added Google Fonts preconnect + link for Fraunces + JetBrains Mono |
| `src/firebase/config.ts` | `getFirestore` → `initializeFirestore` with `persistentLocalCache()` |
| `src/tracker/components/Toast.tsx` | Now re-exports from `../../shared/components/Toast` |
| `src/shared/components/Toast.tsx` | New file — enhanced Toast with type, action (undo), duration |
| `src/pages/LandingPage.tsx` | Added Logger card to landing hub |
