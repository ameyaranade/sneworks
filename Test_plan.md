# Test Plan — sneworks.com Tracker

## DB Tests

Every Firestore read and write triggered by the UI. Test each manually; check browser console for errors after each action.

> **Schema:** `users/{uid}/activities/{id}` · `users/{uid}/reminders/{id}` · `users/{uid}/settings/preferences`

### Reads (Subscriptions — fire on mount, live updates)

| # | Trigger | Collection path | Status |
|---|---------|----------------|--------|
| R1 | Any `/tracker/*` page load | `users/{uid}/settings/preferences` (TrackerProvider) | ✅ Pass |
| R2 | Any `/tracker/*` page load | `users/{uid}/activities` where `date == today` (TrackerProvider) | ✅ Pass |
| R3 | Any `/tracker/*` page load | `users/{uid}/activities` where `date` in current week (TrackerProvider) | ✅ Pass |
| R4 | Any `/tracker/*` page load | `users/{uid}/activities` where `date` in last 30 days (TrackerProvider) | ✅ Pass |
| R5 | Any `/tracker/*` page load | `users/{uid}/reminders` where `active == true` (TrackerProvider) | ✅ Pass |
| R6 | Dashboard — Today/Week toggle or prev/next nav | `users/{uid}/activities` for selected date range | ✅ Pass |
| R7 | `/tracker/finances` page load | `users/{uid}/activities` where `type == finance` | ✅ Pass |
| R8 | `/tracker/exercise` page load | `users/{uid}/activities` where `type == exercise` | ✅ Pass |
| R9 | `/tracker/groceries` page load | `users/{uid}/activities` where `type == grocery` (past trips) | ✅ Pass |
| R10 | `/tracker/reminders` page load | reads from TrackerProvider `reminders` (already subscribed) | ✅ Pass |
| R11 | `/tracker/calendar` page load or month nav (←/→) | `users/{uid}/activities` for calendar month | ✅ Pass |

### Reads (One-shot)

| # | Trigger | Collection path | Status |
|---|---------|----------------|--------|
| R12 | First-ever login (no settings doc yet) | `users/{uid}/settings/preferences` — read then write defaults | ⚠️ Not tested (requires fresh account) |

### Writes — Settings

| # | Trigger | Operation | Path | Status |
|---|---------|-----------|------|--------|
| W1 | Settings: tap currency button (INR/USD) | `setDoc` (merge) | `users/{uid}/settings/preferences` | |
| W2 | Settings: toggle dark mode | `setDoc` (merge) | `users/{uid}/settings/preferences` | |

### Writes — Finance Activities

| # | Trigger | Operation | Path | Status |
|---|---------|-----------|------|--------|
| W3 | + → Finances → fill form → Save | `addDoc` | `users/{uid}/activities` (type: finance) | ✅ Pass |
| W4 | Finances page → pencil icon → edit form → Save | `updateDoc` | `users/{uid}/activities/{id}` | ✅ Pass |
| W5 | Today dashboard → × on finance activity | `deleteDoc` | `users/{uid}/activities/{id}` | ✅ Pass |
| W6 | Finances page → × on finance activity | `deleteDoc` | `users/{uid}/activities/{id}` | |

### Writes — Exercise Activities

| # | Trigger | Operation | Path | Status |
|---|---------|-----------|------|--------|
| W7 | + → Exercise → fill form → Save | `addDoc` | `users/{uid}/activities` (type: exercise) | |
| W8 | Exercise page → expand row → pencil → edit → Save | `updateDoc` | `users/{uid}/activities/{id}` | |
| W9 | Today dashboard → × on exercise activity | `deleteDoc` | `users/{uid}/activities/{id}` | |
| W10 | Exercise page → expand row → Delete | `deleteDoc` | `users/{uid}/activities/{id}` | |

### Writes — Generic Activities

| # | Trigger | Operation | Path | Status |
|---|---------|-----------|------|--------|
| W11 | + → Other → fill form → Save | `addDoc` | `users/{uid}/activities` (type: generic) | |
| W12 | Today dashboard → × on generic activity | `deleteDoc` | `users/{uid}/activities/{id}` | |

### Writes — Grocery Reminders & Trips

| # | Trigger | Operation | Path | Status |
|---|---------|-----------|------|--------|
| W13 | Groceries: type item name → Add | `addDoc` | `users/{uid}/reminders` (type: grocery) | ✅ Pass |
| W14 | Groceries: tap checkbox to check item | `updateDoc` | `users/{uid}/reminders/{id}` (checked: true, checkedAt) | ✅ Pass |
| W15 | Groceries: tap checkbox to uncheck item | `updateDoc` | `users/{uid}/reminders/{id}` (checked: false) | |
| W16 | Groceries: tap × to remove item | `deleteDoc` | `users/{uid}/reminders/{id}` | |
| W17 | Groceries: Done → Complete Trip | `addDoc` (GroceryActivity) + batch `deleteDoc` checked reminders | `users/{uid}/activities` + `users/{uid}/reminders` | ✅ Pass |

### Writes — Finance Reminders (Recurring Bills)

| # | Trigger | Operation | Path | Status |
|---|---------|-----------|------|--------|
| W18 | + → Payments → fill template form → Save | `addDoc` | `users/{uid}/reminders` (type: finance) | ✅ Pass |
| W19 | Finances page → bills section → Mark Paid | `addDoc` (PaymentActivity) | `users/{uid}/activities` (type: payment) | ✅ Pass |
| W20 | Finances page → bills section → Skip | `addDoc` (PaymentActivity, status: skipped) | `users/{uid}/activities` (type: payment) | |
| W21 | Finances page → bills section → × delete bill | `deleteDoc` | `users/{uid}/reminders/{id}` | ✅ Pass |
| W22 | Today dashboard: inline notes edit on payment activity | `updateDoc` | `users/{uid}/activities/{id}` | |
| W23 | Today dashboard: Unmark button on payment activity | `deleteDoc` | `users/{uid}/activities/{id}` | |

### Writes — Generic Reminders

| # | Trigger | Operation | Path | Status |
|---|---------|-----------|------|--------|
| W24 | Reminders page: fill name → Add | `addDoc` | `users/{uid}/reminders` (type: generic) | ✅ Pass |
| W25 | Reminders page: Complete button | `updateDoc` (completed: true, active: false) | `users/{uid}/reminders/{id}` | ✅ Pass |
| W26 | Reminders page: × delete reminder | `deleteDoc` | `users/{uid}/reminders/{id}` | |

---

## Navigation / UX Tests

| # | Test | Expected | Status |
|---|------|----------|--------|
| N1 | Go To menu → Finances | Navigates to `/tracker/finances` | ✅ Pass |
| N2 | Go To menu → Exercise & Health | Navigates to `/tracker/exercise` | ✅ Pass |
| N3 | Go To menu → Groceries | Navigates to `/tracker/groceries` | ✅ Pass |
| N4 | Go To menu → Reminders | Navigates to `/tracker/reminders` | ✅ Pass |
| N5 | Go To menu does NOT show "Payments" | Payments entry absent | ✅ Pass |
| N6 | Today dashboard: payment card tap | Navigates to `/tracker/finances` (not `/tracker/payments`) | |
| N7 | PriorityBanner overdue/due-today tap | Navigates to `/tracker/finances` | |

---

## Manual Test Log

Fill in Status column above with: ✅ Pass | ❌ Fail | ⚠️ Pass with warning

Record failures here:

| # | Error observed | Console message |
|---|---------------|----------------|
| | | |
