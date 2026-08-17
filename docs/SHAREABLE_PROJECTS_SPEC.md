# sneworks — Shareable Groups (Projects + Shopping Lists) (feature spec)

Multi-user collaborative **groups**: a project **or a shopping list** can be
shared with other people by email, and everyone with access can view and edit its
items in real time. This spec bakes in the three UX-invariant tenets (data
control, design language, state-machine testing) as first-class requirements and
is the plan the build phase (`ux-invariants-build`) is gated against.

> **Scope note (v2):** originally scoped to projects only. §8 generalizes the
> mechanism to any shareable group — projects and shopping lists — under the same
> top-level `sharedProjects` collection (D12; the name is kept, no rename). Wherever
> this doc says "project", read "shareable group" unless a §8 note narrows it.
> Routines and recurring-todos are **not** shareable (they're personal spawning
> mechanics).

> Companion docs: architecture context in [`CLAUDE.md`](../CLAUDE.md); design
> patterns in [`DESIGN_LANGUAGE.md`](DESIGN_LANGUAGE.md); test states in
> [`TEST_PLAN.md`](TEST_PLAN.md); decisions in
> [`PRODUCT_DECISIONS.md`](PRODUCT_DECISIONS.md).

---

## 1. Product decisions (locked)
| # | Decision |
|---|----------|
| Storage | Shared projects move **out** of `users/{uid}/groups` into a top-level `sharedProjects/{pid}` collection (tasks in a `sharedProjects/{pid}/todos` subcollection). Personal projects stay per-user. A project is **either** personal **or** shared (`location` discriminator). |
| Sharing model | **Opt-in** per project. Sharing migrates the project + its tasks + sub-projects to the shared collection; unsharing (owner only) migrates them back. |
| Membership | `members: { <uid>: true }` map = the ACL. **Single role: editor** (everyone with access edits equally). `ownerUid` is tracked separately for owner-only actions (unshare, delete, remove member). |
| Invites | **By email**, via callable Cloud Functions. Owner enters an email → `inviteToProject` creates `invites/{id}`. Invitee sees a pending share on next login → `acceptInvite` adds their uid to `members` server-side. |
| Membership mutation | Only Cloud Functions mutate the `members` map / `ownerUid` (invite-accept, leave, remove-member). Client writes to those fields are rejected by rules — prevents a rogue editor rewriting the ACL. |
| Owner erase | Owner erasing their account **deletes the shared project for everyone** (cascade delete of project + sub-projects + tasks). Members erasing only remove themselves. |
| Realtime | Edits sync via existing Firestore `onSnapshot` listeners. **Last-write-wins per field**, no locking. Remote changes surface a visible indicator (see §5.3). |
| Presence | "Active" / "editing" is an **ephemeral** signal on Realtime Database (already lazy-init'd), not Firestore. Heartbeat with a staleness window; auto-expires. |

---

## 2. Data model

```
sharedProjects/{pid}                       ← GroupBase + shared fields
  ownerUid: string
  members: { [uid]: true }                 ← ACL, mutated only by functions
  rootSharedId: string                     ← self for root; root id for sub-projects
  location: 'shared'                        ← discriminator (personal groups: 'personal')
  memberCount: number                       ← denormalized for the shared badge (>1 ⇒ show)
  sharedProjects/{pid}/todos/{tid}         ← SharedTask (TodoBase shape)

invites/{inviteId}
  pid, projectName, invitedEmail (lowercased), invitedBy, invitedByName,
  status: 'pending' | 'accepted' | 'declined' | 'revoked', createdAt

RTDB: presence/{pid}/{uid}                  ← ephemeral, not Firestore
  { name, at: <serverTimestamp>, editingTaskId?: string }
  onDisconnect() clears it; clients treat entries older than the staleness window as gone
```

New `types.ts` additions: shared-project fields on the project shape, a
`location: 'personal' | 'shared'` discriminator, an `Invite` type, and a
`Presence` type.

---

## 3. Tenet 1 — User-data control (per entity)

Every entity below has a UI path to view/edit/delete, and is wired into the
registry-driven export + account-erase + cache-clear (`userDataRegistry.ts`,
guarded by `userDataRegistry.test.ts`).

| Entity | View (where) | Edit (where) | Delete (where) | In export? | In account-erase? |
|--------|--------------|--------------|----------------|------------|-------------------|
| Shared project (root) | ProjectsPage + ProjectDetailPage (shared) | ProjectDetailPage; membership via ShareSheet | Owner: unshare (→ back to personal) / delete (ConfirmSheet). Member: leave (ConfirmSheet). | Yes — member's projects + tasks | Owner: cascade delete for all. Member: leave (self removed). |
| Shared sub-project | ProjectDetailPage (nested, ≤2 levels) | ProjectDetailPage | Owner delete (cascade) | With parent | With root cascade |
| Shared task | ProjectDetailPage task list (`TodoRow`) | `TodoRow` / ComposeSheet | Swipe → ConfirmSheet | With parent project | With root cascade |
| Invite (outgoing) | ShareSheet "People" list (pending) | Immutable; resend = new invite | Owner revokes (ConfirmSheet) | No (transient control record) | Owner's invites deleted on erase |
| Invite (incoming) | Pending-shares surface | Accept / Decline | Invitee declines | No | Removed when invitee erases |
| Membership (self) | ShareSheet member list | N/A (single role) | Leave project (ConfirmSheet) | N/A (implied by project) | Removed on erase |
| Presence | Presence indicator only | N/A (ephemeral) | Auto-expires; cleared on leave/erase/disconnect | No (ephemeral) | Cleared, not persisted |

Requirements:
- [ ] Registry: add a `sharedProjects` store entry + `invites` handling; export = shared projects the user is a **member** of, plus their tasks; erase per the owner/member split above. `USER_DATA_COLLECTIONS` + registry entry updated so `userDataRegistry.test.ts` stays green.
- [ ] Cascade: deleting/erasing a root shared project removes all sub-projects, all tasks, all `invites` for it, and all `presence/{pid}` entries — no orphans.
- [ ] Leaving a project removes the user's cache copy of it; erase clears all `sneworks*` cache (existing path).
- [ ] Presence is declared **ephemeral / non-durable** in the registry doc comment (so its absence from export/erase is intentional, not a missed store).

---

## 4. Tenet 2 — Design-language conformance

All new UI uses `--sn-*` tokens + existing primitives; new patterns are added to
[`DESIGN_LANGUAGE.md`](DESIGN_LANGUAGE.md) in the same change. New surfaces:

- **ShareSheet** — reuses `BottomSheet` + `SheetFormActions`; email input sets `color-scheme: var(--sn-color-scheme)`; member list + pending invites; leave/unshare/remove gated by `ConfirmSheet` (D5).
- **Pending-share surface** — banner/prompt using existing card + button tokens; Accept (accent) / Decline (ghost).
- **Shared badge** (new pattern) — a persistent indicator on every shared project (people/users glyph, Lucide), shown wherever a project is represented (Today Projects section, ProjectsPage cards, ProjectDetailPage header) **whenever `memberCount > 1`**. Token: neutral/`--sn-accent` chip; no hardcoded color.
- **Presence indicator** (new pattern) — stacked member avatars + an "active" dot in the ProjectDetailPage header; per-row "X is editing…" affordance. Avatars are initials on tinted token backgrounds (`--sn-accent`/`--sn-purple` families), no emoji.
- **Remote-update affordance** (new pattern) — a subtle, token-styled signal when a remote edit lands (e.g. a brief row highlight + optional "Updated by X" micro-label), plus a manual refresh fallback. No layout shift, no lost local focus.

Requirements:
- [ ] No hardcoded colors / literal `color-scheme` — `npm run check:ux` stays at zero.
- [ ] Shared badge, presence indicator, and remote-update affordance are documented as reusable patterns/components in `DESIGN_LANGUAGE.md` (not one-off inline styles).
- [ ] Both themes (dark + light) render every new surface correctly.

---

## 5. New UX states (the three requirements) + Tenet 3

These are added to [`TEST_PLAN.md`](TEST_PLAN.md) as states/transitions and each
is verified. They extend the baseline **concurrency** and **offline/reconnect**
states rather than replace them.

### 5.1 Persistent shared indicator (requirement 1)
- **State `shared-badge`:** any project with `memberCount > 1` shows the shared indicator on **every** surface it appears (Today, ProjectsPage, ProjectDetailPage). A personal (1-member) project never shows it.
- **Transition:** accepting an invite (member count 1 → 2) makes the badge appear on the owner's surfaces without reload; the last member leaving (2 → 1) removes it.

### 5.2 Active-collaborator indicator (requirement 2)
- **State `collaborator-present`:** another member has a fresh presence heartbeat (within the staleness window) → their avatar + active dot show in the header.
- **State `collaborator-editing`:** a member's heartbeat carries `editingTaskId` → that task row shows an "X is editing…" affordance.
- **State `collaborator-idle`/absent:** heartbeat older than the window or `onDisconnect` fired → indicator clears (no ghost "active" avatar).
- **Transitions:** open project → self heartbeat starts; focus a task → `editingTaskId` set; blur/close/disconnect → cleared for others within the window.

### 5.3 Realtime sync + refresh mechanism (requirement 3)
- **State `remote-update-pending`:** a Firestore snapshot brings a change made by another member → task list reconciles live; a remote-update affordance flags what changed; **no dupes, no lost local optimistic edit, no scroll jump**.
- **State `conflict` (last-write-wins):** two members edit the same task field near-simultaneously → the later write wins; the losing client's snapshot updates to the winning value (no crash, no half-merge). This is the accepted policy (no locking).
- **State `stale/manual-refresh`:** if snapshots stall (permission change, transient offline), a manual refresh control re-subscribes and reconciles; on reconnect the snapshot self-heals.
- **State `permission-revoked`:** owner removes a member while that member is viewing → their listener denies → they land on a graceful "You no longer have access" state, not a crash.
- **Transitions:** member A checks a task → member B's list reflects it live + affordance fires · A and B edit same title → last write wins, both converge · B removed mid-view → B's view degrades gracefully.

---

## 6. Enforcement (already wired)
CLAUDE.md carries the `ux-invariants-build` gate and names the four living docs.
This spec adds no new enforcement mechanism — it declares the obligations above,
which the build phase must satisfy with cited `file:line`/test evidence before
the feature is "done", and which the decision log (§ PRODUCT_DECISIONS D8) must
record.

## 7. Definition of done (spec → build handoff)
- [ ] Data inventory table (§3) satisfied — every entity view/edit/delete/export/erase wired; registry + coverage test green.
- [ ] Design-language patterns (§4) documented in `DESIGN_LANGUAGE.md`; `check:ux` zero.
- [ ] All new states/transitions (§5) in `TEST_PLAN.md` and verified.
- [ ] Decisions recorded in `PRODUCT_DECISIONS.md` (storage model, membership/ACL, owner-erase, realtime + presence + refresh).
- [ ] `npx tsc --noEmit` zero; `npm test` + `npm run check:ux` clean.

---

## 8. Generalization to shopping lists (v2, D12)

A shared shopping list is a shared group with **no nesting** (single layer) whose
items are `shopping-item` todos carrying `price`/`quantity`. Every prior decision
carries over unchanged:

| Decision | Applies to lists |
|---|---|
| **D8** (top-level, opt-in, editor-only, function-only ACL, owner-erase cascade) | ✅ sharing a list migrates the list + its `shopping-item` todos; no sub-groups to walk |
| **D9** (last-write-wins, RTDB presence, remote-update affordance) | ✅ `presence/{groupId}/{uid}` — identical heartbeat/prune code |
| **D10** (list queries must prove the rule; error callbacks) | ✅ same `invites` + shared-collection query patterns |
| **D11** (invite blocking) | ✅ recipient-scoped; invite type is irrelevant |

### 8.1 Storage — one collection, no rename (D12)
The existing top-level **`sharedProjects`** collection holds any shareable group,
discriminated by the existing `groupKind` (`'project' | 'shopping-list'`). The name
is kept as-is (an internal Firestore label, not user-visible), so there is **no
rename and no migration** — shopping lists simply write into the same collection
projects already use. `presence/*` (RTDB, ephemeral) is collection-agnostic;
`invites` keep the same `pid` field (now "the shared group id"). *(An earlier D12
revision renamed this to `sharedGroups`; that was reverted — see the D12 reversal
note in `PRODUCT_DECISIONS.md`.)*

### 8.2 Shareability guard
`readPersonalGroupFamily` (called by `inviteToProject`'s migrate step) accepts
`groupKind ∈ {project, shopping-list}` and **rejects** routine / recurring-todo.
Projects still forbid sharing a non-root (sub-project); shopping lists are always
single-layer so that check is moot.

### 8.3 Surfaces (tenet 2/3)
- **`GroupDetailPage`** (`/groups/:groupId`, the list checklist) gets the same
  shared treatment `ProjectDetailPage` got: personal-vs-shared detection, shared
  todos hook, Share button + `ShareSheet`, `SharedBadge`, presence avatars +
  "editing…", remote-update highlight, manual refresh, permission-revoked screen.
  No sub-group section (single layer). Price tracking / `totalSpent` keep working
  — the shared count-recompute already sums `totalSpent`.
- **TodayPage "Shopping"** + **MorePage "Shopping lists" / archived** merge shared
  lists in and show the badge — same edit pattern as the projects surfaces.

### 8.4 Data control (tenet 1)
- Erase: unchanged — `sharedProjects` `eraseAll` wipes every kind the user owns and
  leaves member-only ones (D8).
- Export: **stays projects-only** (D4). `exportSharedProjects` must filter
  `groupKind === 'project'` so shared *lists* aren't pulled into the projects
  export (shopping lists aren't exportable personally either).
