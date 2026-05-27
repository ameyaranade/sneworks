# Sandbox — Product Spec

> A unified TODO + logging app at `/sandbox` with type-specific UX for money, shopping, health, and generic tasks.

---

## 0. Context

The existing `/tracker` app works but suffers from a fundamental UX problem: every TODO and log type needs its own add/edit/complete/group workflow, yet they all share the same generic drawer. This creates friction — checking off a shopping item shouldn't feel like logging an expense.

Sandbox solves this by:
- Giving each TODO type its own completion flow (tap-to-pay, checklist, simple checkbox)
- Separating the "add a TODO" and "log something" actions into a split pill FAB
- Providing type-specific inline add inside groups (text input for shopping, full form for generic)
- Making recurring items first-class citizens with their own Routines tab

This is a **fresh /sandbox route** — separate codebase, separate Firestore collections, separate stores. It references the existing `/logger` architecture patterns but does not share code with it.

---

## 1. Data Model

### 1.1 Firestore Collections

All under `users/{uid}/`:

| Collection | Path | Description |
|---|---|---|
| TODOs | `sandbox_todos` | All pending/active items (money reminders, shopping items, generic tasks) |
| Logs | `sandbox_logs` | All completed/recorded entries (expenses, notes, health) |
| Groups | `sandbox_groups` | Containers: shopping lists, projects, routines |

### 1.2 TODO Schema

Discriminated union on `todoType` field.

#### Base fields (all TODOs share these):

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | string | auto | Firestore ID | Document ID |
| `todoType` | `'money-reminder' \| 'shopping-item' \| 'generic-task'` | yes | — | Discriminator |
| `title` | string | yes | — | Display name |
| `notes` | string | no | — | Optional detail |
| `status` | `'pending' \| 'done' \| 'skipped' \| 'deferred'` | yes | `'pending'` | Current state |
| `groupId` | string | no | — | Parent group reference |
| `groupPath` | string[] | no | — | Breadcrumb chain e.g. `["Diwali", "Gifts"]` |
| `pinnedToday` | boolean | no | false | Floats to Today view |
| `dueAt` | Timestamp | no | — | When this is due |
| `completedAt` | Timestamp | no | — | When completed |
| `recurrence` | string | no | — | RRule string e.g. `"FREQ=MONTHLY;BYMONTHDAY=1"` |
| `recurrenceId` | string | no | — | Links spawned instances to source |
| `sourceLogId` | string | no | — | Links to auto-created Log from completion bridge |
| `sortOrder` | number | yes | 0 | Ordering within group |
| `createdAt` | Timestamp | yes | serverTimestamp | — |
| `updatedAt` | Timestamp | yes | serverTimestamp | — |

#### Money Reminder specific fields:

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `amount` | number | no | — | Expected payment amount |
| `category` | string | no | — | From seeded list (Rent, Utilities, Subscriptions, Insurance, Salary, Groceries, Transport, Education, Other) |
| `lastCycleStatus` | `'paid' \| 'skipped' \| null` | no | null | Status from previous billing cycle |
| `lastCycleCompletedAt` | Timestamp | no | — | When last cycle was resolved |

#### Shopping Item specific fields:

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `categoryTag` | string | no | — | Optional: groceries, household, personal, electronics, pharmacy, other |
| `quantity` | number | no | 1 | Item quantity |
| `price` | number | no | — | Actual price (if price tracking enabled on parent list) |
| `lastKnownPrice` | number | no | — | Price from previous purchase (for quick-fill) |

#### Generic Task specific fields:

No additional fields beyond base. Due time is encoded in the `dueAt` Timestamp.

### 1.3 Log Schema

Discriminated union on `logType` field.

#### Base fields (all Logs share these):

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | string | auto | Firestore ID | Document ID |
| `logType` | `'expense' \| 'income' \| 'generic-note' \| 'health-log'` | yes | — | Discriminator |
| `title` | string | yes | — | Display text |
| `notes` | string | no | — | Optional detail |
| `occurredAt` | Timestamp | yes | now | When it happened |
| `sourceTodoId` | string | no | — | If created from completing a TODO |
| `sourceGroupId` | string | no | — | Group the source TODO belonged to |
| `sortOrder` | number | yes | 0 | Ordering |
| `createdAt` | Timestamp | yes | serverTimestamp | — |
| `updatedAt` | Timestamp | yes | serverTimestamp | — |

#### Expense specific fields:

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `amount` | number | yes | — | Amount spent |
| `spentOn` | string | yes | — | What the money was spent on |
| `category` | string | no | — | Same seeded list as Money Reminder |

#### Income specific fields:

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `amount` | number | yes | — | Amount earned |
| `source` | string | yes | — | Where the money came from |

#### Generic Note specific fields:

Uses base `title` as the headline (e.g. "Swam today"). No separate `entry` field.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `noteCategory` | string | yes | `'General'` | Seeded: Work, Personal, Health, Idea, General. User-extensible. |

#### Health Log specific fields:

Uses base `title` as the entry name (e.g. "Swam today"). No separate `entryName` field.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `workoutType` | string | no | — | swim, run, gym, cycle, yoga, walk, other |
| `mood` | number | no | — | 1-5 rating |
| `weightKg` | number | no | — | Body weight |

### 1.4 Group Schema

Discriminated union on `groupKind` field.

#### Base fields (all Groups share these):

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | string | auto | Firestore ID | Document ID |
| `groupKind` | `'shopping-list' \| 'project' \| 'routine'` | yes | — | Discriminator |
| `name` | string | yes | — | Display name |
| `description` | string | no | — | Optional user notes about the group |
| `color` | string | no | `'accent'` | Theme color key |
| `glyph` | string | no | `'Folder'` | Lucide icon name |
| `parentGroupId` | string | no | — | For nesting (max 2 levels) |
| `ancestorPath` | string[] | no | `[]` | Full path of parent names |
| `showProgress` | boolean | yes | true | Show "x/y done" on card |
| `showSumMoney` | boolean | yes | false | Show money aggregation |
| `childCount` | number | yes | 0 | Denormalized: total children |
| `doneCount` | number | yes | 0 | Denormalized: completed children |
| `completed` | boolean | yes | false | Whether group itself is done |
| `completedAt` | Timestamp | no | — | When group was completed |
| `archivedAt` | Timestamp | no | — | Soft-delete timestamp |
| `createdAt` | Timestamp | yes | serverTimestamp | — |
| `updatedAt` | Timestamp | yes | serverTimestamp | — |

#### Shopping List specific fields:

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `priceTrackingEnabled` | boolean | yes | false | Whether to show price column |
| `totalSpent` | number | yes | 0 | Denormalized sum of item prices |

#### Project specific fields:

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `deadline` | Timestamp | no | — | Project deadline |

#### Routine specific fields:

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `recurrence` | string | yes | — | RRule string |
| `spawnTime` | string | yes | `"06:00"` | When to create today's instance |
| `templateChildren` | TemplateItem[] | yes | `[]` | Items to spawn each cycle |
| `lastSpawnedAt` | Timestamp | no | — | Tracks most recent spawn |
| `streakCount` | number | yes | 0 | Consecutive all-done days |

**TemplateItem shape:**
```ts
{ title: string; todoType?: TodoType; scheduledTime?: string; estimatedDuration?: number }
```

### 1.5 Recurrence Model

Uses the `rrule` library (already in dependencies). The `recurrence` field on both TODOs and Groups stores an RRule string.

**For TODOs (money reminders):** The reminder is a persistent document. When completed, `status` flips to `'done'` and `completedAt` is set. On the next billing cycle (determined by parsing the RRule), the TODO resets: `status` returns to `'pending'`, `lastCycleStatus` stores the previous result, `lastCycleCompletedAt` stores when. If the previous cycle was never completed, `lastCycleStatus` stays `null` and the item shows as overdue.

**For Groups (routines):** A `spawnDueRoutines()` function runs once per session. It checks each routine group's RRule against today's date. If today is an occurrence and `lastSpawnedAt` is not today, it batch-creates TODO entries from `templateChildren` with `groupId` pointing to the routine group.

**Reset mechanism — `resetDueRecurringTodos()`:** Runs once per session (alongside `spawnDueRoutines()`). For each TODO with a `recurrence` field and `status === 'done'`: parse the RRule, determine the current billing cycle. If the current cycle's occurrence date has passed and `completedAt` falls in a previous cycle, reset: set `status` to `'pending'`, copy `status` → `lastCycleStatus`, copy `completedAt` → `lastCycleCompletedAt`, clear `completedAt`. This is a Firestore batch write.

### 1.6 Completion Bridge (TODO → Log)

When certain TODOs are completed, a Log is automatically created:

| TODO Type | Trigger | Log Created | Fields Mapped |
|---|---|---|---|
| Money Reminder | Tap checkbox (quick pay) | Expense | amount, category, title → spentOn |
| Shopping Item (price-tracked list) | Check off + price entered | Expense | price → amount, title → spentOn |
| Generic Task | Tap checkbox | — (no log) | — |

The created Log gets `sourceTodoId` set to the TODO's ID, enabling the "link back" from log to source reminder.

### 1.7 Denormalized Counts

After any TODO write (add, status change, delete) within a group, `recomputeGroupCounts(uid, groupId)` runs. It reads all TODOs with that `groupId`, computes `childCount`, `doneCount`, and `totalSpent`, and writes them to the group document.

If `doneCount === childCount` and `childCount > 0`, the group's `completed` field is set to `true` and `completedAt` is set.

### 1.8 Uncheck from Archive

When a completed TODO inside a completed group is unchecked (set back to `'pending'`):
1. The TODO's `status` reverts to `'pending'`, `completedAt` is cleared
2. The parent group's `completed` flag is set to `false`, `completedAt` cleared
3. Group counts are recomputed
4. If this TODO had a `sourceLogId` (auto-created expense), that link is preserved but the log is NOT deleted (user can delete manually if needed)

---

## 2. Navigation

### 2.1 Bottom Tab Bar

5-position layout with split pill FAB centered:

```
[ Today ]  [ Routines ]  [Log | TODO]  [ Timeline ]  [ More ]
     1          2          (center)         3           4
```

| Position | Label | Lucide Icon | Route | Description |
|---|---|---|---|---|
| 1 | Today | `CalendarCheck` | `/sandbox` | Active items, due/overdue, pinned |
| 2 | Routines | `Repeat` | `/sandbox/routines` | Recurring item management |
| Center | Split Pill | `Pencil` / `Plus` | — | Opens compose sheet |
| 3 | Timeline | `Clock` | `/sandbox/timeline` | Chronological log history |
| 4 | More | `MoreHorizontal` | `/sandbox/more` | Groups, settings, archived |

### 2.2 Split Pill FAB

A capsule-shaped floating button centered above the tab bar. Two halves:
- **Left half ("Log"):** Pencil icon. Tapping opens compose sheet in log-type-picker mode.
- **Right half ("TODO"):** Plus icon. Tapping opens compose sheet in todo-type-picker mode.

Same behavior on every page. Inside a group detail page, the FAB is context-aware: tapping TODO pre-selects that group.

### 2.3 Route Tree

```
/sandbox                       → SandboxShell
  index                        → TodayPage
  routines                     → RoutinesPage
  timeline                     → TimelinePage
  more                         → MorePage
  health                       → HealthDetailPage
  groups/:groupId              → GroupDetailPage  (shopping lists)
  projects/:projectId          → ProjectDetailPage (projects + sub-projects)
```

---

## 3. Pages

### 3.1 Today Page

**Purpose:** What needs attention right now.

**Data sources:** `useTodosStore`, `useGroupsStore`

**Sections (top to bottom):**

1. **Overdue** (red section header)
   - All TODOs where `status` is `'pending'` or `'deferred'` AND `dueAt < startOfToday`
   - Red left-border accent (`--sb-danger`)
   - Sorted by how overdue (oldest first)
   - Includes money reminders from previous unpaid cycles

2. **Up Next** (default section)
   - All TODOs due today with `status` `'pending'` or `'deferred'`, sorted by `dueAt` then `sortOrder`
   - Items with a `groupId` show an inline breadcrumb: `Diwali › Gifts` in accent text above the title (tapping breadcrumb navigates to group)
   - Items with `pinnedToday === true` also appear here (even if no `dueAt`)
   - Shows time component of `dueAt` if set: "Call mom · 3:00 PM"
   - Routine spawned items appear here with group breadcrumb

3. **Active Groups** (collapsed cards)
   - Groups with pending items, shown as cards with progress ("4/12 done")
   - Tap to navigate to group detail
   - Shopping lists show "2/5 bought"
   - **Ungrouped shopping items** appear as a virtual "Shopping" card (only if ungrouped items exist). Tap drills into a checklist view.

4. **Health Summary Card** (conditional)
   - Only shows if health logs exist today
   - Shows: streak count, today's workout, goal progress if set
   - Tap navigates to More > Health

5. **Done Today** (muted section)
   - Completed TODOs from today
   - Opacity 0.55, green checkmark, strikethrough title

6. **Today's Logs** (timestamped)
   - Logs from today shown with timestamp badges
   - Neutral dot indicator, normal text, edit/delete via swipe

**Empty state:** "Nothing planned today. Tap + to add a task."

### 3.2 Routines Page

**Purpose:** Manage recurring items — setup, streaks, next-due.

**Data sources:** `useGroupsStore` (filtered to `groupKind === 'routine'`), `useTodosStore` (filtered to those with `recurrence` field)

**Sections:**

1. **Active Routines** (group cards)
   - Each routine group as a card: name, recurrence badge ("Daily" / "Weekdays" / "Weekly"), streak count, next-due date
   - Progress shows today's spawned instance: "2/4 done today"
   - Tap navigates to group detail

2. **Recurring TODOs** (standalone)
   - Money reminders and generic tasks with `recurrence` field but no `groupId`
   - Shows: name, next due date, last completed, recurrence badge
   - Example: "Pay cook salary · Monthly on 1st · Due in 5 days"

3. **Create** button → opens GroupCreateSheet with routine kind pre-selected, OR opens compose with recurrence field visible

### 3.3 Timeline Page

**Purpose:** Chronological log history.

**Data sources:** `useLogsStore`

**Layout:** Day-grouped entries, newest day first. Each day gets a `DayHeader` with date and entry count. Within each day, entries sorted by `occurredAt` descending.

- 30-day lookback from today
- `NowLine` separator between past days and today
- Each entry shows: type icon + title + timestamp + amount (if expense/income)
- Swipe left: Edit, Delete
- No right-swipe (logs don't defer)

**Filters (optional, in header):** All | Expense | Income | Notes | Health (pill selector)

### 3.4 More Page

**Purpose:** Everything else — groups, detail pages, settings.

**Sections (top to bottom):**

1. **Projects**
   - "New project" button → `NewProjectSheet` (name input, creates `groupKind: 'project'`, navigates to `ProjectDetailPage`)
   - Active project cards (FolderOpen icon, name, `X/Y done` meta, progress bar, ChevronRight → `/sandbox/projects/:id`)
   - Empty state: "No active projects. Tap New project to track tasks and goals."
   - **Completed (N)** collapsible toggle — appears only when ≥1 project has `completed: true`. Expands to show completed project cards in a muted style. Tapping a completed project navigates into it so the user can add tasks or unmark items — which automatically re-activates it. The toggle auto-hides when the completed count drops to 0.

2. **Shopping Lists**
   - "New list" button → `NewListSheet`
   - Active shopping list cards
   - Empty state: "No active lists…"

3. **Items to buy** — ungrouped shopping items (no `groupId`). Virtual section, no Firestore doc. "Add item" button opens compose in shopping-item mode.

4. **Health** — nav card → `/sandbox/health`

5. **Routines** — nav card (disabled, Phase 6)

6. *(Future)* **Settings** — notification toggle, custom note categories, currency

### 3.5 Health Detail Page (`/sandbox/more/health`)

**Purpose:** Health log history + streak/goal management.

**Layout:**
- **Summary header** — streak count, this week's workouts, goal progress bar
- **Goal setting** — "Exercise 5x/week" with a slider or number input
- **Log history** — health logs sorted by date, with workout type pills, mood face, weight

### 3.6 Group Detail Page (`/sandbox/groups/:groupId`)

**Purpose:** Inside view of a shopping list.

**Header:** Group name, subtitle showing `X/Y done`, archive button (→ sets `archivedAt`, navigates back to More).

**Layout:**
- Full-width progress bar (3px, green fill)
- Inline add row: text input + "Add" button. Enter or button press creates a shopping item in the group.
- Checklist of items, pending first then done. Each item: swipe left for Edit / Delete.
- If `priceTrackingEnabled`: price shown on each row; footer shows "Total spent ₹X".

### 3.7 Project Detail Page (`/sandbox/projects/:projectId`)

**Purpose:** Inside view of a project — tasks and optional one level of sub-projects.

**Header:** Back button (→ parent project if nested, else More), project name, subtitle (`X/Y done` or description if set), archive button.

**Layout:**
- Full-width progress bar (accent fill while in-progress, green when complete)
- **"PROJECT COMPLETE"** green banner shown when `completed: true`
- **Sub-projects section** (only shown on top-level projects where `ancestorPath.length === 0`):
  - Section header: "Sub-projects" + count chip + "Add" button
  - Sub-project cards: FolderOpen icon, name, progress bar, `X/Y` count (or "Done" badge if complete), ChevronRight → navigate to that sub-project
  - Empty state: "No sub-projects yet."
  - "Add" button → `NewSubProjectSheet` (name input, creates child project with `parentGroupId` and `ancestorPath` set)
- **Tasks section** (shown on all projects):
  - Section header: "Tasks" + count chip + "Add" button (opens compose in `generic-task` mode, pre-set to this project's `groupId`)
  - Quick-add inline row: text input → Enter/Add button creates task directly
  - Task rows via `TodoRow` (checkbox, title, swipe actions). Pending first, then done sorted by `completedAt` desc.
  - Empty state: "No tasks yet."

**Depth enforcement:** Sub-project pages (`ancestorPath.length === 1`) do not show a Sub-projects section — only Tasks.

**Completion propagation:**
- When all tasks in a sub-project are done → `recomputeGroupCounts` sets sub-project `completed: true`, then propagates up to the parent project.
- When all tasks AND all sub-projects are done in the parent → parent `completed: true`, "PROJECT COMPLETE" banner appears.
- Adding a new pending task to a completed project immediately un-completes it (`recomputeGroupCounts` sets `completed: false`).

**Routine:**
- Shows today's spawned instance: checklist of template items.
- User can add/remove items for today only (doesn't change template).
- Streak display in header.
- "Edit template" button → opens routine edit sheet.

---

## 4. Compose Flow

### 4.1 TODO Compose

Triggered by tapping the "TODO" side of the split pill.

**Step 1: Type Picker**
Three cards in a column:
- **Money Reminder** — IndianRupee icon, gold color. "Bills, payments, recurring"
- **Shopping Item** — ShoppingCart icon, accent color. "Items to buy"
- **Generic Task** — CheckSquare icon, text color. "Anything else"

**Step 2: Type-specific form**

**Money Reminder form:**
- Name (text input, required, placeholder: "What's this payment for?")
- Amount (currency input with ₹ prefix, optional)
- Category (pill selector: Rent, Utilities, Subscriptions, Insurance, Salary, Groceries, Transport, Education, Other)
- Due date (date picker, required)
- Recurrence (toggle: None | Daily | Weekly | Monthly | Yearly | Custom RRule)
- Notes (textarea, optional)
- Group picker (optional, shows existing groups)

**Shopping Item form:**
- Item name (text input, required, placeholder: "What do you need?")
- Category tag (optional pill: groceries, household, personal, electronics, pharmacy, other)
- Quantity (number stepper, default 1)
- Group picker (optional — lists existing shopping lists; "Create new list" option; leaving empty means ungrouped)

**Generic Task form:**
- Name (text input, required, placeholder: "What needs to be done?") → maps to `title`
- Due date + time (date picker, optional; time picker shown when date is set — both encoded into `dueAt` Timestamp)
- Notes (textarea, optional)
- Group picker (optional)

### 4.2 Log Compose

Triggered by tapping the "Log" side of the split pill.

**Step 1: Type Picker**
Four cards:
- **Expense** — IndianRupee icon, danger color. "Something you spent"
- **Income** — TrendingUp icon, success color. "Something you earned"
- **Note** — StickyNote icon, accent color. "Thought, observation, event"
- **Health** — Heart icon, success color. "Workout, mood, weight"

**Step 2: Type-specific form**

**Expense form:**
- Amount (currency input, required)
- Spent on (text input, required, placeholder: "What was it for?")
- Category (optional pill selector, same as money reminder categories)
- Notes (optional textarea)

**Income form:**
- Amount (currency input, required)
- Source (text input, required, placeholder: "Where from?")
- Notes (optional textarea)

**Generic Note form:**
- Title (text input, required, placeholder: "What happened?") → maps to base `title`
- Notes (optional textarea, placeholder: "More detail...")
- Category (pill selector: Work, Personal, Health, Idea, General + user-defined)

**Health Log form:**
- Title (text input, required, placeholder: "What did you do?") → maps to base `title`
- Workout type (pill selector: swim, run, gym, cycle, yoga, walk, other — optional)
- Mood (1-5 rating selector, optional)
- Weight (number input with "kg" suffix, optional)
- Notes (optional textarea)

### 4.3 Edit Flow

Tapping an existing entry row (TODO or Log) opens the compose sheet pre-filled with that entry's data. The "Save" button changes to "Update". The type picker step is skipped — goes straight to the form.

### 4.4 Inline Add (within groups)

Group detail pages have an inline input at the bottom of the item list:

- **Shopping list:** Single text input. Pressing Enter creates a Shopping Item TODO in that group.
- **Project:** "Add item" input + "Add sub-group" button. Item creates a Generic Task. Sub-group opens GroupCreateSheet with `parentGroupId` pre-set.
- **Routine:** "Add to today" input. Creates a TODO in the routine group for today only. "Edit template" modifies future spawns.

---

## 5. Interaction Patterns

### 5.1 Swipe Actions

| Item State | Right Swipe (defer) | Left Swipe (act) |
|---|---|---|
| Pending TODO | +1h, Tomorrow, Pick date | Edit, Skip, Delete |
| Done TODO | — (empty) | Unmark, Edit, Delete |
| Overdue TODO | +1h, Tomorrow, Pick date | Edit, Skip, Delete |
| Log entry | — (empty) | Edit, Delete |
| Shopping item (pending) | — (empty, not scheduled) | Edit, Delete |
| Shopping item (done) | — (empty) | Unmark, Edit, Delete |

**Right swipe colors:** +1h = accent-soft, Tomorrow = purple, Pick = deep purple
**Left swipe colors:** Edit = accent-soft, Skip = muted, Delete = danger, Unmark = warn-soft, Complete = success

### 5.2 Checkbox Tap Behavior

| TODO Type | On Tap | Side Effects |
|---|---|---|
| Generic Task | Set `status: 'done'`, `completedAt: now` | None |
| Money Reminder | Set `status: 'done'`, `completedAt: now` | Auto-create Expense log with amount + category + title |
| Shopping Item | Set `status: 'done'`, `completedAt: now` | Recompute group counts. If all items done → group `completed: true` |

### 5.3 Defer Flow

Right swipe on a pending TODO reveals defer chips. Tapping "+1h" or "Tomorrow" applies immediately. Tapping "Pick date" opens a DeferSheet with:
- Quick options: +1 hour, Tomorrow, In 2 days, This weekend, Next Monday, Next week, Someday (no date)
- Calendar grid for custom date selection
- "Move to [date]" button

The TODO's `dueAt` is updated and `status` set to `'deferred'`. It disappears from Today and reappears when the new date arrives. The Today page treats `'deferred'` the same as `'pending'` in its filters — no status reset is needed; when `dueAt` matches today, the item simply shows up.

### 5.4 Undo

All destructive actions (delete, skip, defer, mark-all-done) show a toast with "Undo" button for 5 seconds. Undo restores the previous state.

Toast format:
```
[●] Moved to Monday · 25 May          [UNDO]
    Call mom · was today
```

### 5.5 Overdue Detection

A TODO is overdue when: `status` is `'pending'` or `'deferred'` AND `dueAt` is before start of today.

For recurring money reminders: overdue means the current billing cycle has passed without completion. Computed by parsing the RRule, finding the most recent past occurrence, and checking if `completedAt` falls after that occurrence.

Overdue items get:
- Red left-border accent
- Red gradient background
- Float to top of Today page in "Overdue" section

---

## 6. Groups

### 6.1 Group Creation

Triggered from: "New group" button on More page, or inline from compose flow.

**GroupCreateSheet steps:**
1. Group name (text input)
2. Type picker (3 options):
   - **Shopping List** — ShoppingCart icon. "Items to buy, check off as you go"
   - **Project** — Layers icon. "Multi-step plan with sub-groups"
   - **Routine** — Repeat icon. "Recurring daily/weekly checklist"
3. Toggles (vary by type):
   - All types: Show progress (default ON)
   - Shopping: Price tracking (default OFF)
   - Project: Show deadline (default OFF), Show money sum (default OFF)
   - Routine: Recurrence selector (Daily/Weekdays/Weekly/Custom), Spawn time
4. For routines: Template children editor (add items with optional scheduled time)
5. Parent group picker (only for Project kind, and only if creating a sub-group)

**"Create group" button** → saves to Firestore.

### 6.2 Ungrouped Shopping Items & Auto-Trip Creation

Shopping items created without a group (`groupId` is undefined) display in a **virtual "fake group"** on the More page and Today page. This is a UI-only grouping — no Firestore document.

**Auto-trip creation on check-off:**
1. When a user checks off an ungrouped shopping item for the first time on a given day, a real shopping list group is auto-created: `{ groupKind: 'shopping-list', name: 'Shopping:dd-mm-YYYY' }`
2. The checked item's `groupId` is set to this new group.
3. Subsequent same-day check-offs of ungrouped items auto-append to that day's group (set `groupId`).
4. If the user checks off items on a different day, a new dated group is created.

This means completed shopping items always belong to a real group (the dated trip), while pending items can be ungrouped (floating) or manually assigned to a user-created list.

### 6.3 Group Completion

A group is considered complete when all of its children (direct todos AND sub-groups) are done:

```
allTodosDone = childCount === 0 || doneCount === childCount
allSubsDone  = subGroups.length === 0 || every sub-group has completed: true
completed    = totalItems > 0 && allTodosDone && allSubsDone
```

`recomputeGroupCounts(uid, groupId, depth)` handles this. After updating the group, it reads back the group's `parentGroupId` and recursively calls itself on the parent (depth-guarded at 3 to prevent runaway recursion).

**When `completed` becomes `true`:**
- `completedAt: Timestamp.now()` is set on the group
- `ProjectDetailPage` shows a green "PROJECT COMPLETE" banner

**Re-activation:** Adding a new pending TODO to a completed group, or unmarking an existing done TODO, triggers `recomputeGroupCounts` which sets `completed: false` and clears `completedAt`. The banner disappears immediately. On MorePage the project moves from Completed back to Active.

**Where completed projects live:** On the More page, completed (non-archived) projects appear in a collapsible **"Completed (N)"** section below the active projects list. Users can expand it to re-enter any completed project. Manually archiving a project (via the archive button) sets `archivedAt` and removes it from both sections entirely.

### 6.4 Nesting (Projects only)

Max depth: 2 levels (top-level project → sub-project → leaf tasks).

| Level | `parentGroupId` | `ancestorPath` | Can have sub-projects? |
|---|---|---|---|
| Top-level project | `undefined` | `[]` | Yes |
| Sub-project | parent's ID | `[parentId]` | No — UI hides the Sub-projects section |

**Creating a sub-project:** Sets `parentGroupId: parentId` and `ancestorPath: [...parent.ancestorPath, parentId]`.

**Depth enforcement:** `ancestorPath.length === 0` → show Sub-projects section. `ancestorPath.length >= 1` → hide it.

**MorePage selectors:**
- `getActiveProjects()` — `groupKind === 'project' && !completed && !archivedAt && !parentGroupId`
- `getCompletedProjects()` — `groupKind === 'project' && completed && !archivedAt && !parentGroupId`
- `getSubGroups(parentGroupId)` — `g.parentGroupId === parentGroupId` (all depths, filtered client-side)

**Completion propagation:**
When all tasks inside a sub-project are done → sub-project `completed: true` → `recomputeGroupCounts` walks up to parent → if all parent's tasks + all sub-projects are done → parent `completed: true`.

### 6.5 Bulk Actions

Available in group detail page header:

- **Mark all done** — batch sets all pending TODOs in the group to `status: 'done'`. Triggers completion bridge for each applicable item.
- **Delete group** — deletes the group document + all TODOs with that `groupId`. Shows confirmation dialog first.

---

## 7. Streaks and Goals

### 7.1 Health Streaks

Computed client-side from health logs.

**Streak definition:** Consecutive calendar days with at least one health log entry.

**Display:**
- Routines page: streak badge on routine cards
- Today page: health summary card shows "🔥 8 day streak"
- Health detail page: prominent streak display

### 7.2 Health Goals

Stored as a setting (in user preferences or a dedicated `sandbox_settings` document):
```
{ healthGoal: { frequency: 5, period: 'week' } }
```

**Display:**
- Health detail page: "3/5 this week" with progress bar
- Today page health card: goal progress

### 7.3 Routine Streaks

Tracked per routine group in `streakCount` field.

**Streak definition:** Consecutive scheduled days where ALL spawned items were completed.

**Updated:** After the last item in a routine's daily instance is checked off, check if all items are done. If yes, increment `streakCount`. If a day is missed (routine spawns but not all completed by end of day), reset to 0.

---

## 8. Notifications

### 8.1 Client Setup

Reuse `src/firebase/messaging.ts` for FCM token retrieval. Store token in `users/{uid}/sandbox_settings/preferences`.

### 8.2 Notification Triggers

| Trigger | When | Message |
|---|---|---|
| Money reminder due | Day of `dueAt`, at 9:00 AM | "Rent is due today — ₹15,000" |
| Generic task due | At `dueAt` time component (or 9:00 AM if date-only) | "Call mom — due now" |
| Overdue reminder | Day after `dueAt`, 9:00 AM | "Rent is overdue — was due yesterday" |
| Routine spawn | At routine's `spawnTime` | "Morning routine is ready — 4 items" |

### 8.3 Implementation

Extend existing Cloud Function (`functions/src/index.ts`) with a `checkSandboxNotifications` scheduled function that runs every 15 minutes. Queries `sandbox_todos` for items where `dueAt` falls within the check window and `status === 'pending'`.

---

## 9. State Management

### 9.1 Zustand Stores

Three stores, one per collection. Follow the pattern from `src/logger/stores/useEntriesStore.ts`.

**`useTodosStore`:**
- State: `todos: Todo[]`, `loaded: boolean`
- Init: `init(uid)` → subscribes to `sandbox_todos`, returns unsubscribe
- Selectors: `getTodayTodos()`, `getOverdueTodos()`, `getTodosForGroup(groupId)`, `getTodosForDate(date)`
- CRUD: `addTodo()`, `updateTodo()`, `deleteTodo()`
- Status: `completeTodo()` (with bridge logic), `skipTodo()`, `deferTodo()`, `markPending()`
- Cache: localStorage with `sneworks_sandbox_{uid}_todos` key

**`useLogsStore`:**
- State: `logs: Log[]`, `loaded: boolean`
- Init: `init(uid)` → subscribes to `sandbox_logs` (90-day window)
- Selectors: `getLogsForDate()`, `getLogsForDateRange()`, `getLogsByType()`
- CRUD: `addLog()`, `updateLog()`, `deleteLog()`
- Cache: localStorage with `sneworks_sandbox_{uid}_logs` key

**`useGroupsStore`:**
- State: `groups: Group[]`, `loaded: boolean`
- Init: `init(uid)` → subscribes to `sandbox_groups` (non-archived, ordered by `createdAt` desc), returns unsubscribe
- Selectors:
  - `getActiveShoppingLists()` — shopping lists where `!completed`
  - `getTodayShoppingListGroup()` — shopping list named `Shopping:dd-mm-YYYY` for today
  - `getActiveProjects()` — top-level projects where `!completed && !archivedAt && !parentGroupId`
  - `getCompletedProjects()` — top-level projects where `completed && !archivedAt && !parentGroupId`
  - `getSubGroups(parentGroupId)` — all groups with matching `parentGroupId`
- CRUD: `addGroup()`, `updateGroup()`, `deleteGroup()`
- Cache: localStorage with `sneworks_sandbox_{uid}_groups` key

### 9.2 SandboxUIContext

Manages compose sheet and defer sheet state:

```ts
interface SandboxUIContextType {
  // Compose
  composeOpen: boolean;
  composeMode: 'todo' | 'log';
  composeTodoType?: TodoType;
  composeLogType?: LogType;
  composeEntry?: Todo | Log;        // editing existing
  composeGroupId?: string;           // pre-selected group
  composeDate?: Date;                // pre-selected date
  openComposeTodo: () => void;
  openComposeLog: () => void;
  openComposeForEdit: (entry: Todo | Log) => void;
  openComposeForGroup: (groupId: string) => void;
  closeCompose: () => void;
  // Defer
  deferOpen: boolean;
  deferTodoId?: string;
  openDefer: (todoId: string) => void;
  closeDefer: () => void;
}
```

### 9.3 Shell Initialization

`SandboxShell.tsx` wraps `<SandboxUIProvider>` → `<ToastProvider>` → `<SandboxShellInner>`. Inner component:
1. Calls `useTodosStore.init(uid)`, `useLogsStore.init(uid)`, `useGroupsStore.init(uid)` in a single `useEffect`
2. Runs `spawnDueRoutines(uid, groups)` and `resetDueRecurringTodos(uid, todos)` once after all stores loaded (via `useRef` guard)
3. Renders `<Outlet />`, `<SandboxBottomNav />`, `<SplitPillFAB />`, conditional `<ComposeSheet />` and `<DeferSheet />`

---

## 10. CSS Tokens

Scoped under `[data-sandbox-theme="dark"]` attribute. Variable prefix: `--sb-`.

### 10.1 Colors

```css
--sb-bg: #0a0b10;
--sb-bg-elev: #14151c;
--sb-bg-card: #181a23;
--sb-bg-card-hover: #1f2230;
--sb-bg-input: #12141c;
--sb-bg-sheet: #1a1c26;
--sb-border: #252836;
--sb-border-strong: #3a3f52;
--sb-text: #f0f1f5;
--sb-text-dim: #8a8fa3;
--sb-text-muted: #5a5f70;
--sb-accent: #9eb3ff;
--sb-accent-soft: #6b8aff;
--sb-accent-glow: rgba(158, 179, 255, 0.12);
--sb-success: #6ee7a8;
--sb-success-glow: rgba(110, 231, 168, 0.12);
--sb-danger: #ff8a8a;
--sb-danger-glow: rgba(255, 138, 138, 0.12);
--sb-warn: #fcd34d;
--sb-gold: #e5c07b;
--sb-gold-glow: rgba(229, 192, 123, 0.1);
--sb-purple: #c5b4ff;
```

### 10.2 Typography

```css
--sb-font-display: 'Fraunces', serif;
--sb-font-body: 'Inter', -apple-system, sans-serif;
--sb-font-mono: 'JetBrains Mono', monospace;
```

### 10.3 Layout

```css
--sb-nav-height: 64px;
--sb-fab-height: 44px;
--sb-sheet-radius: 28px;
--sb-card-radius: 14px;
```

---

## 11. Build Phases

### Phase 1: Foundation + Generic Tasks
**Scope:** Scaffold, stores, shell, today page, compose sheet (generic task only), swipe actions, defer.
**Files:**
- `src/sandbox/` directory structure (types, constants, utils, stores, firebase, pages, components, styles, context)
- `SandboxShell.tsx`, `SandboxUIContext.tsx`
- `useTodosStore`, `todoQueries.ts`
- `SandboxBottomNav`, `SplitPillFAB`
- `TodayPage` (overdue, up next, done sections)
- `ComposeSheet` (type picker + generic task form)
- `SwipeableRow`, `EntryRow`, `DeferSheet`
- Routes in `App.tsx`
**Test:** Create, complete, defer, skip, delete generic tasks. Today page shows correct sections.

### Phase 2: Shopping Lists
**Scope:** Shopping item form, groups store, shopping list creation, group detail page, More page, auto-trip creation.
**Files:**
- `useGroupsStore`, `groupQueries.ts`
- Shopping Item form in ComposeSheet
- `GroupDetailPage` (shopping variant with inline text add, group name/description editing)
- `GroupCreateSheet` (shopping list)
- `MorePage` (groups section + ungrouped shopping "fake group" card)
- Auto-trip creation logic: on check-off of ungrouped item → create/append to `Shopping:dd-mm-YYYY` group
- `recomputeGroupCounts()`
**Test:** Create shopping items (ungrouped), check off → see auto-trip group created. Create manual lists, add items, check off, see progress, auto-complete.

### Phase 3: Money
**Scope:** Money reminder form, logs store, expense/income forms, completion bridge, timeline.
**Files:**
- `useLogsStore`, `logQueries.ts`
- Money Reminder + Expense + Income forms
- Completion bridge logic in `completeTodo()`
- `TimelinePage`
- Overdue cycle detection for money reminders
**Test:** Create money reminders with recurrence, tap-to-pay creates expense, view timeline.

### Phase 4: Health + Notes
**Scope:** Health log form, generic note form, health summary card, streak computation.
**Files:**
- Health Log + Generic Note forms
- Health summary card component
- Streak computation utility
- `HealthDetailPage`
- Note category management (user-extensible)
**Test:** Log health entries, see streaks, create notes with categories.

### Phase 5: Projects (Nested Groups) ✅ Complete
**Scope:** Project group kind, `ProjectDetailPage`, sub-group creation, nesting, completion propagation, completed-projects archive section on MorePage.
**Files:**
- `ProjectDetailPage.tsx` at `/sandbox/projects/:projectId`
  - Header: back (→ parent project or More), name + subtitle, archive button
  - Progress bar (accent → green when complete), "PROJECT COMPLETE" green banner
  - Sub-projects section (top-level only): sub-project cards + `NewSubProjectSheet`
  - Tasks section: quick-add inline input + `TodoRow` list
- `project-detail-page.css`
- `useGroupsStore` — added `getActiveProjects()`, `getCompletedProjects()`, `getSubGroups()`
- `groupQueries.ts` — `recomputeGroupCounts()` extended to handle sub-groups + recursive parent propagation (depth guard at 3)
- `MorePage.tsx` — Projects section (active cards + collapsible "Completed (N)" toggle), `NewProjectSheet`
- `more-page.css` — completed section toggle styles, muted completed card variant
- `App.tsx` — `/sandbox/projects/:projectId` route
**Test golden path:** Create project → add tasks → add sub-project → add tasks to sub-project → complete sub-project tasks (sub-project marks complete, parent shows 1/N done) → complete parent tasks (parent "PROJECT COMPLETE") → back to More (project disappears from Active, appears in Completed toggle) → expand Completed → tap project → add task → project re-activates in Active.

### Phase 6: Routines
**Scope:** Routine group kind, template spawner, routines page, streaks.
**Files:**
- `RoutinesPage`
- `RoutineCreateSheet`
- `spawnDueRoutines()` in `routineSpawner.ts`
- Routine variant of GroupDetailPage
- Streak tracking
**Test:** Create daily routines, see them spawn, track streaks.

### Phase 7: Notifications + Polish
**Scope:** FCM integration, Cloud Function extension, archive flows, search.
**Files:**
- Notification setup in settings
- Cloud Function updates
- Archive flow for completed groups
- Search on More page
- Edge cases: timezone, overdue cycles, undo reliability

---

## 12. Edge Cases

1. **Overdue money reminder cycle:** Parse RRule, find the most recent past occurrence, check if a `'done'` status exists after that date. If not → overdue.
2. **Shopping list re-open:** Unchecking any item in a completed list sets `completed: false` on the group.
3. **Routine customization:** Editing a spawned TODO does NOT modify the template. Only the "Edit template" action changes future spawns.
4. **Group delete cascade:** Deleting a group also deletes all TODOs with that `groupId`. Uses batch write. Confirmation dialog required.
5. **Nesting limit:** UI hides "Add sub-group" at depth 2. `ancestorPath.length >= 2` check.
6. **Auto-trip creation:** On first ungrouped shopping item check-off of the day, create `Shopping:dd-mm-YYYY` group. Subsequent same-day check-offs append to it. If user manually created a list and checks off items there, no auto-trip — the item already has a `groupId`.
7. **Completion bridge failure:** If auto-creating an Expense log fails after checking off a money reminder, show toast error but keep the TODO as `'done'`. User can manually create the log.
8. **Timezone:** All Timestamps in UTC. Display converted to local. Cloud Function uses `timezoneOffset` from user settings.
9. **Cache keys:** All use `sneworks_sandbox_{uid}_{key}` prefix. Cleared by `clearAllCache()` on logout.
10. **Empty groups:** A group with 0 children shows "No items yet. Tap + to add." with the inline add input.
11. **Completed project re-activation:** When a new pending task is added to a completed project (or any sub-project), `recomputeGroupCounts` fires and sets `completed: false` because `allTodosDone` is now false. The "PROJECT COMPLETE" banner disappears immediately and the project moves back to the Active section on MorePage. The Completed toggle auto-hides once count reaches 0.
12. **Completed vs Archived:** `completed: true` means all work is done but the project is still accessible. `archivedAt: Timestamp` means the user has explicitly hidden it — it disappears from both Active and Completed sections. Archiving is intentional; completion is automatic.

---

## 13. Reference Files

These existing files should be used as implementation templates:

| Purpose | Reference File |
|---|---|
| Types structure | `src/logger/types.ts` |
| Zustand store pattern | `src/logger/stores/useEntriesStore.ts` |
| Shell component | `src/logger/LoggerShell.tsx` |
| Firebase queries | `src/logger/firebase/loggerQueries.ts` |
| Routine spawner | `src/logger/firebase/routineQueries.ts` |
| Swipe component | `src/logger/components/swipe/SwipeableRow.tsx` |
| Bottom sheet | `src/logger/components/primitives/BottomSheet.tsx` |
| CSS tokens | `src/logger/styles/logger-tokens.css` |
| App routing | `src/App.tsx` |

Shared code to import (not copy):
- `src/auth/AuthContext.tsx` — `useAuth`, `getCachedUid`
- `src/auth/ProtectedRoute.tsx`
- `src/shared/components/Toast.tsx` — `ToastProvider`, `useToast`
- `src/firebase/config.ts` — `db`, `auth`

---

## 14. Visual References

The three HTML mockups in `C:\Users\Ameya\Downloads\` serve as the design reference:

- `grouped-todos-mock.html` — Group cards, drill-in navigation, breadcrumbs, sub-group link rows, routine instances, pinned-to-today pattern
- `swipe-actions-mock.html` — Swipe gesture UX, defer chips, date picker sheet, toast with undo, context-aware action matrix
- `shopping-flows-mock.html` — Shopping list expand/collapse, inline price prompt, mid-trip state, completion banner, auto-group suggestion

These use the same design tokens (Fraunces + Inter + JetBrains Mono, dark theme with `#0a0b10` background, blue accent `#9eb3ff`).
