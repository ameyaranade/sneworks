# Test Plan — sneworks.com Tracker

## DB Tests

Every Firestore read and write triggered by the UI. Test each manually; check browser console for errors after each action.

### Reads (Subscriptions — fire on mount, live updates)

| # | Trigger | Collection path | Status |
|---|---------|----------------|--------|
| R1 | Any `/tracker/*` page load | `users/{uid}/settings/preferences` (TrackerProvider) | ✅ Pass |
| R2 | Any `/tracker/*` page load | `users/{uid}/entries` where `date == today` (TrackerProvider) | ✅ Pass |
| R3 | Any `/tracker/*` page load | `users/{uid}/entries` where `date` in last 30 days (TrackerProvider) | ✅ Pass |
| R4 | Any `/tracker/*` page load | `users/{uid}/groceryLists/active` (TrackerProvider) | ✅ Pass |
| R5 | Any `/tracker/*` page load | `users/{uid}/recurringItems` where `active == true` (TrackerProvider) | ✅ Pass |
| R6 | Dashboard — Today/Week toggle or prev/next nav | `users/{uid}/entries` for selected date range | ✅ Pass |
| R7 | `/tracker/finances` page load | `users/{uid}/entries` where `type == finance` | ✅ Pass |
| R8 | `/tracker/exercise` page load | `users/{uid}/entries` where `type == exercise` | ✅ Pass |
| R9 | `/tracker/calendar` page load or month nav (←/→) | `users/{uid}/entries` for calendar month | ✅ Pass |
| R10 | `/tracker/calendar` page load or month nav (←/→) | `users/{uid}/groceryLists` for calendar month | ✅ Pass |

### Reads (One-shot — getDocs/getDoc)

| # | Trigger | Collection path | Status |
|---|---------|----------------|--------|
| R11 | First-ever login (no settings doc yet) | `users/{uid}/settings/preferences` — read then write defaults | ⚠️ Not tested (requires fresh account) |
| R12 | `/tracker/groceries` page load | `users/{uid}/groceryLists` (all trips except `active`) | ✅ Pass |

### Writes — Settings

| # | Trigger | Operation | Path | Status |
|---|---------|-----------|------|--------|
| W1 | Settings: tap currency button (INR/USD) | `setDoc` (merge) | `users/{uid}/settings/preferences` | ✅ Pass |
| W2 | Settings: toggle dark mode | `setDoc` (merge) | `users/{uid}/settings/preferences` | ✅ Pass |

### Writes — Finance Entries

| # | Trigger | Operation | Path | Status |
|---|---------|-----------|------|--------|
| W3 | + → Finances → fill form → Save | `addDoc` | `users/{uid}/entries` | ✅ Pass |
| W4 | Finances page → pencil icon → edit form → Save | `updateDoc` | `users/{uid}/entries/{id}` | ✅ Pass |
| W5 | Today dashboard → × on finance entry | `deleteDoc` | `users/{uid}/entries/{id}` | ✅ Pass |
| W6 | Finances page → × on finance entry | `deleteDoc` | `users/{uid}/entries/{id}` | ✅ Pass |

### Writes — Exercise Entries

| # | Trigger | Operation | Path | Status |
|---|---------|-----------|------|--------|
| W7 | + → Exercise → fill form → Save | `addDoc` | `users/{uid}/entries` | ✅ Pass |
| W8 | Exercise page → expand row → edit → Save | `updateDoc` | `users/{uid}/entries/{id}` | ✅ Pass (edit via pencil on Today dashboard) |
| W9 | Today dashboard → × on exercise entry | `deleteDoc` | `users/{uid}/entries/{id}` | ✅ Pass |
| W10 | Exercise page → expand row → Delete | `deleteDoc` | `users/{uid}/entries/{id}` | ✅ Pass |

### Writes — Grocery List

| # | Trigger | Operation | Path | Status |
|---|---------|-----------|------|--------|
| W11 | Groceries: type item name → Add | `setDoc` | `users/{uid}/groceryLists/active` | ✅ Pass |
| W12 | Groceries: tap checkbox to check item | `setDoc` | `users/{uid}/groceryLists/active` | ✅ Pass |
| W13 | Groceries: tap checkbox to uncheck item | `setDoc` | `users/{uid}/groceryLists/active` | ✅ Pass |
| W14 | Groceries: tap × to remove item | `setDoc` | `users/{uid}/groceryLists/active` | ✅ Pass |
| W15 | Groceries: Done → Complete Trip | `addDoc` (new trip) + `setDoc` (active list) | `users/{uid}/groceryLists` | ✅ Pass |

### Writes — Payments / Recurring Items

| # | Trigger | Operation | Path | Status |
|---|---------|-----------|------|--------|
| W16 | + → Payments → fill template form → Save | `addDoc` | `users/{uid}/recurringItems` | ✅ Pass |
| W17 | Payments page: Mark Paid button | `addDoc` (payment entry) | `users/{uid}/entries` | ✅ Pass |
| W18 | Payments page: Skip button | `addDoc` (payment entry) | `users/{uid}/entries` | ✅ Pass |
| W19 | Payments page: × to delete recurring item | `deleteDoc` | `users/{uid}/recurringItems/{id}` | ✅ Pass |
| W20 | Today dashboard: inline notes edit on payment entry | `updateDoc` | `users/{uid}/entries/{id}` | ✅ Pass |
| W21 | Today dashboard: Unmark button on payment entry | `deleteDoc` | `users/{uid}/entries/{id}` | ✅ Pass |

---

## Manual Test Log

Fill in Status column above with: ✅ Pass | ❌ Fail | ⚠️ Pass with warning

Record failures here:

| # | Error observed | Console message |
|---|---------------|----------------|
| | | |
