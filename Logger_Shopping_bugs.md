# Logger Shopping List — Bug Report

Identified by thorough code audit of the More tab → Shopping list flow.
All file:line references are relative to `src/logger/`.

---

## BUG 1 — Critical: Shopping item title always renders as "Bought " (item name is dropped)

**File:** `components/rows/EntryRow.tsx:44` and `constants.ts:139`

**Root cause:**
The Shopping `TypeSchema` has `logFormat: 'Bought {title}'`. The helper `formatLogTitle(logFormat, entry.data)` replaces `{key}` tokens using `entry.data[key]`. But `title` is a **top-level `Entry` field**, not a key inside `entry.data`. So `data['title']` is always `undefined`, and every shopping item renders as `"Bought "` with the item name silently dropped.

```ts
// EntryRow.tsx:44 — uses entry.data, NOT entry.title for the format substitution
const displayTitle = schema?.logFormat
  ? formatLogTitle(schema.logFormat, entry.data)  // ← data.title doesn't exist
  : entry.title;
```

**Symptom:** Every shopping item in the list shows "Bought" with nothing after it.

**Fix options:**
- Change `logFormat` to reference a data field that exists, e.g. keep the item name in `data.item` with a text field, and use `'Bought {item}'`
- OR pass both `entry.data` and `{ title: entry.title }` merged into `formatLogTitle`

---

## BUG 2 — Critical: Items added via FAB on GroupDetailPage land in "None" group

**Files:** `context/LoggerUIContext.tsx`, `LoggerShell.tsx:67`, `pages/GroupDetailPage.tsx`

**Root cause:**
The global FAB always calls `openCompose()` with no group context. `LoggerUIContext` has no `openComposeForGroup(groupId)` method, and `GroupDetailPage` never passes the current group to the compose flow. When ComposeSheet opens, `selectedGroup` initializes to `null`, the GroupPicker shows "None" selected, and if the user saves without manually scrolling through all groups and selecting the right one, the entry is written with no `groupId`.

```ts
// LoggerShell.tsx:67 — FAB has zero group awareness
<FAB onClick={openCompose} />

// ComposeSheet.tsx:51 — always null, even when opened from a group detail page
const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
```

The `LoggerUIContextType` interface (`types.ts:172`) also doesn't include any group preselection field.

**Symptom:** Shopping items added while viewing a list don't appear in that list. They show up on TodayPage/TimelinePage with no group label.

**Fix:** Add `openComposeForGroup(groupId: string)` to `LoggerUIContext`. On `GroupDetailPage`, intercept the FAB tap (or add a dedicated "Add item" button in the header) that calls `openComposeForGroup(groupId)`. In `ComposeSheet`, accept a `preselectedGroupId` prop and initialize `selectedGroup` from it.

---

## BUG 3 — High: GroupPicker in edit mode always shows "None" selected (wrong UI state)

**File:** `components/sheets/ComposeSheet.tsx:51`

**Root cause:**
`selectedGroup` is always initialized to `null`, even when `editEntry.groupId` is set. When the user opens an entry for editing that belongs to a group, the GroupPicker chip row shows "None" highlighted instead of the actual group. The user sees incorrect state — the entry appears un-grouped in the form even though it has a group in Firestore.

```ts
// ComposeSheet.tsx:51
const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
// ↑ Should initialize from editEntry.groupId if present
```

**Symptom:** Every time you edit a shopping list item, the GroupPicker shows "None" as if the item has no list. Reassuring and confusing — user never gets confirmation the item is in the right group.

**Fix:**
```ts
const groups = useGroupsStore((s) => s.groups);
const initialGroup = editEntry?.groupId
  ? groups.find((g) => g.id === editEntry.groupId) ?? null
  : null;
const [selectedGroup, setSelectedGroup] = useState<Group | null>(initialGroup);
```

---

## BUG 4 — High: Cannot remove a group assignment from an entry (group is permanent once set)

**File:** `components/sheets/ComposeSheet.tsx:96`, `stores/useEntriesStore.ts:106`

**Root cause:**
When user selects "None" in GroupPicker and saves an edit, `handleSave` builds `entryData` which omits `groupId` entirely (no `deleteField()`). Firestore's `updateDoc` only updates fields that are present in the payload — absent fields are untouched. So the old `groupId` persists in Firestore silently.

```ts
// ComposeSheet.tsx:96
...(selectedGroup ? { groupId: selectedGroup.id, groupPath: [selectedGroup.name] } : {}),
// ↑ If selectedGroup is null, groupId is absent from the update.
//   Firestore keeps the old value. Group cannot be removed.
```

**Symptom:** Once an entry is added to a group, it's permanently stuck in that group with no UI way to remove it.

**Fix:** Import `deleteField` from `firebase/firestore` and explicitly send it when user selects None:
```ts
...(selectedGroup
  ? { groupId: selectedGroup.id, groupPath: [selectedGroup.name] }
  : { groupId: deleteField(), groupPath: deleteField() }),
```

---

## BUG 5 — Medium: `subscribeToGroups` fallback subscription is never cleaned up (listener leak)

**File:** `firebase/groupQueries.ts:91-106`

**Root cause:**
When the primary `onSnapshot` query fails with `failed-precondition` (missing composite index), the error handler creates a second `onSnapshot` call. The unsubscribe function of this fallback is **discarded** — never returned or stored. The returned `Unsubscribe` from `subscribeToGroups` only closes the first (failed) query. The fallback listener runs forever.

```ts
// groupQueries.ts:91
return onSnapshot(q, (snap) => { ... }, (err) => {
  if (err.code === 'failed-precondition') {
    onSnapshot(fallbackQ, ...);  // ← unsubscribe never stored; leaks indefinitely
  }
});
```

**Symptom:** Every session where the composite index is absent (e.g., new users before the index propagates) leaves a dangling Firestore listener after the user navigates away from Logger, causing unnecessary reads and potential memory pressure.

**Fix:** Store the fallback unsubscribe in the outer scope and chain it into the returned function:
```ts
let fallbackUnsub: Unsubscribe | null = null;
const primaryUnsub = onSnapshot(q, ..., (err) => {
  if (err.code === 'failed-precondition') {
    fallbackUnsub = onSnapshot(fallbackQ, ...);
  }
});
return () => { primaryUnsub(); fallbackUnsub?.(); };
```

---

## BUG 6 — Medium: GroupDetailPage shows only last-90-days entries; older group items are invisible

**File:** `pages/GroupDetailPage.tsx:15`

**Root cause:**
`GroupDetailPage` filters from the global in-memory `entries` store, which is populated by `subscribeToAllEntries` — a query capped at entries created within the last 90 days. Any shopping item added more than 90 days ago and assigned to the group simply does not exist in the store and therefore does not appear in the detail view. Meanwhile, `childCount`/`doneCount` on the `Group` document reflect the true all-time count (from `recomputeGroupCounts`), so the progress bar can show `3/10` while only 3 items are visible on screen.

```ts
// GroupDetailPage.tsx:15 — reads from the 90-day in-memory store
const allEntries = useEntriesStore((s) => s.entries);
const entries = allEntries.filter((e) => e.groupId === groupId);
```

`subscribeToEntriesByGroup` in `loggerQueries.ts:117` already handles this correctly (no date cutoff), but it's not used here.

**Symptom:** Long-running shopping lists or projects silently lose historical items from view. Progress bar disagrees with visible item count.

**Fix:** Subscribe to `subscribeToEntriesByGroup(uid, groupId, ...)` inside `GroupDetailPage` instead of filtering the global store.

---

## BUG 7 — Low: `recomputeGroupCounts` silently fails when Firestore index is missing

**File:** `stores/useEntriesStore.ts:101,118,134` and `firebase/groupQueries.ts:56`

**Root cause:**
Every entry add/update/delete calls `recomputeGroupCounts(uid, groupId).catch(console.error)`. If the `groupId` field index hasn't been created in Firestore yet (new project, or Firestore emulator), the query throws but the error is swallowed into `console.error`. The group's `childCount`/`doneCount`/`totalSpent` is never updated, so the progress bar and money total on `GroupCard` stay stale forever — no toast, no retry, no indication to the user.

**Symptom:** Shopping list progress bar stays at 0/0 after adding items. Checking off items doesn't advance the counter.

**Fix:** Surface the error as a toast in the stores that call `recomputeGroupCounts`, or add retry logic with exponential backoff.

---

## BUG 8 — Low: Shopping `completionBridge.targetTypeId` is hardcoded `'expense'` — will never match

**File:** `constants.ts:151`

**Root cause:**
The Shopping TypeSchema has:
```ts
completionBridge: {
  targetTypeId: 'expense',  // ← hardcoded string
  ...
}
```
The Expense TypeSchema is seeded into Firestore via `addDoc` which generates a random document ID (e.g., `"aB3xQ7zP"`). No document will ever have the ID `'expense'`, so the bridge lookup will silently resolve to `undefined` when the Completion Bridge UI is implemented.

**Symptom:** The Completion Bridge feature (Shopping list → create Expense log on completion) will never work as written.

**Note:** This feature is flagged as not yet built in CLAUDE_logger.md, but the data model defect is baked in and will need a fix before implementation.

**Fix:** After seeding, resolve the Expense type's actual Firestore ID and update the Shopping type's `completionBridge.targetTypeId`, or use a stable string ID (`builtIn: true` types could use deterministic IDs set explicitly via `setDoc`).

---

---

## BUG 9 — Critical (Missing Feature): No quick text-based way to add items in a shopping list view

**File:** `pages/GroupDetailPage.tsx`

**Root cause:**
When viewing a shopping list at `/logger/groups/:id`, there is no inline way to add items. The only path is:
1. Tap the global FAB → TypePicker opens → pick Shopping → fill form → pick group manually → save

That's 4+ steps for what should be a single text input + Enter. Every mainstream checklist/shopping app (Reminders, Todoist, Google Keep) exposes an inline "Add item…" text input directly inside the list view. The Logger group detail view has no such affordance, and the FAB doesn't even pre-select the current group (Bug 2).

**Symptom:** Adding items to a shopping list is cumbersome enough that users abandon it. There is no fast "type and press Enter" flow.

**Fix:** Add an inline text input row at the top of the `GroupDetailPage` content area for `list`-kind groups:
- Input placeholder: `"Add item…"`
- On Enter or `+` button: look up the Shopping type from `useTypesStore`, create a todo entry with the typed title assigned to the current group, clear the input
- For `project`-kind groups: use Task type
- For `routine`-kind groups: use Habit type
- This requires no sheet, no FAB, no type picker — just type and go

---

## Summary Table

| # | Severity | Where | What |
|---|---|---|---|
| 1 | Critical | `EntryRow.tsx`, `constants.ts` | Shopping item title always renders as "Bought " — `{title}` not in `entry.data` |
| 2 | Critical | `LoggerUIContext`, `LoggerShell`, `GroupDetailPage` | FAB has no group context → items added from group detail land in "None" |
| 3 | High | `ComposeSheet.tsx:51` | Edit mode GroupPicker always shows "None" even for grouped entries |
| 4 | High | `ComposeSheet.tsx:96`, `useEntriesStore.ts` | Selecting "None" on edit doesn't remove group (no `deleteField()`) |
| 5 | Medium | `groupQueries.ts:91` | Fallback `onSnapshot` in `subscribeToGroups` error handler leaks forever |
| 6 | Medium | `GroupDetailPage.tsx:15` | Entries >90 days old are invisible in group detail; progress bar disagrees |
| 7 | Low | `useEntriesStore.ts`, `groupQueries.ts:56` | `recomputeGroupCounts` failures are silently swallowed; counts stay stale |
| 8 | Low | `constants.ts:151` | `completionBridge.targetTypeId: 'expense'` will never match a real Firestore ID |
| 9 | Critical (Missing) | `GroupDetailPage.tsx` | No inline quick-add text input in list/group detail — adding items requires 4+ steps |
