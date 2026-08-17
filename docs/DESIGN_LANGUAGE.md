# sneworks — Design Language

The single source of truth for how the product looks and behaves. Every new
surface conforms to this; introducing a new pattern means updating this file in
the same change. Enforced by the `ux-invariants-build` skill (tenet 2) and the
`npm run check:ux` mechanical floor.

**Token source of truth:** [`src/styles/app-tokens.css`](../src/styles/app-tokens.css).
This doc describes intent and usage; the CSS file holds the actual values. If
they ever disagree, the CSS file wins — fix this doc.

---

## Hard rules (also enforced by `npm run check:ux`)
1. **Tokens only.** No hardcoded color literals (`#hex`, `rgb()`, `rgba()`,
   `hsl()`) in component CSS. The *only* file allowed to hold color literals is
   `app-tokens.css`. A `var(--sn-x, #fallback)` fallback is acceptable.
2. **Theme-safe inputs.** Every `<input>` (date/text/color/select) sets
   `color-scheme: var(--sn-color-scheme, light)` — never a literal.
3. **No fixed viewport height on pages.** Use `min-height: 100%`, never
   `100dvh`/`100vh` (see CLAUDE.md → Shell & Scroll).
4. **Sheets portal to `#sn-portal`** (inside `[data-theme]`), never `document.body`.
5. **Every supported theme must render correctly:** `dark` and `light`.

---

## Tokens

### Typography
- `--sn-font-display` — Fraunces (serif) — page/section display headings.
- `--sn-font-body` — Inter — all body and UI text.
- `--sn-font-mono` — JetBrains Mono — numeric/monospace.
- **Font scale:** `--sn-font-scale` (0.88 / 1 / 1.15 from `data-font`). Always
  size text as `calc(13px * var(--sn-font-scale, 1))`.

### Spacing (4px grid)
`--sn-space-1`=4 · `-2`=8 · `-3`=12 · `-4`=16 · `-5`=20 · `-6`=24 · `-8`=32.
Use these; don't invent off-grid spacing.

### Radii
`--sn-radius-pill`=100 · `-card`=14 · `-card-sm`=10 · `-sheet`=28 · `-btn`=12 ·
`-input`=10 · `-chip`=100.

### Transitions
`--sn-transition-fast` 0.15s · `--sn-transition-med` 0.2s ·
`--sn-transition-swipe` 0.28s cubic-bezier(swipe rows).

### Layout
`--sn-nav-height`=64px · `--sn-touch-target`=44px (minimum hit size on every
interactive element). Page bottom padding = `calc(var(--sn-nav-height) + 24px)`.

### Color roles (resolve per theme — never reference raw hex)
- **Surfaces:** `--sn-bg`, `--sn-bg-elev`, `--sn-bg-card`, `--sn-bg-card-hover`,
  `--sn-bg-input`, `--sn-bg-sheet`.
- **Borders:** `--sn-border`, `--sn-border-strong`.
- **Text:** `--sn-text`, `--sn-text-dim`, `--sn-text-muted`.
- **Brand/accent:** `--sn-accent`, `--sn-accent-soft`, `--sn-accent-glow`,
  `--sn-accent-text` (text on accent fills).
- **Status:** `--sn-success`/`-soft`, `--sn-danger`/`-soft`,
  `--sn-warning`/`--sn-warn`/`-soft`, `--sn-gold`/`-glow`, `--sn-purple`/`-glow`.
- **Type stripes:** `--sn-stripe-shopping`, `--sn-stripe-project`,
  `--sn-stripe-routine`.
- **Shadows:** `--sn-shadow-card`, `--sn-shadow-sheet`, `--sn-shadow-fab`,
  `--sn-shadow-toggle` (small elements / toggle knobs).
- **Overlays:** `--sn-overlay` (sheet/dialog scrim, 60% black),
  `--sn-press-overlay` (active/press state on colored surfaces),
  `--sn-divider-overlay` (subtle divider on colored surfaces).
- **Buttons:** `--sn-btn-bg`/`-hover`/`-border`/`-text`.
- **Native chrome:** `--sn-color-scheme` (dark/light) — drives input rendering.
- **Toggle knob:** `--sn-toggle-knob` (#fff constant — always white).
- **Toast:** `--sn-toast-shadow`, `--sn-toast-action-border`, `--sn-toast-action-hover`.

---

## Core components (reuse before building new)
Adding UI? Use one of these. If none fits, add a new primitive to the shared
layer and document it here — do not inline a one-off.

| Component | Path | Use for |
|-----------|------|---------|
| `BottomSheet` | `components/primitives/BottomSheet.tsx` | any slide-up modal (portals to `#sn-portal`) |
| `ConfirmSheet` | `components/primitives/ConfirmSheet.tsx` | yes/no confirm — **required before any destructive action** |
| `DetailPageHeader` | `components/primitives/DetailPageHeader.tsx` | back button + title + optional right slot |
| `CollapsibleSection` | `components/primitives/CollapsibleSection.tsx` | expand/collapse grouping |
| `EmptyState` | `components/primitives/EmptyState.tsx` | the **empty** UX state (tenet 3) |
| `ProgressBar` | `components/primitives/ProgressBar.tsx` | linear progress |
| `SheetFormActions` | `components/primitives/SheetFormActions.tsx` | cancel/submit row inside sheets |
| `Toast` (`useToast`) | `shared/components/Toast.tsx` | success/info/error + Undo action |
| `SwipeableRow` | `components/swipe/SwipeableRow.tsx` | swipe gestures on list rows |
| `SwipeGrip` | `components/swipe/SwipeGrip.tsx` | trailing-edge 6-dot handle marking a row swipeable |
| `ComposeSheet` | `components/sheets/ComposeSheet.tsx` | universal create/edit for all todo + log types |

Health-specific: `GoalRing`, `WeeklyBarChart`, `WorkoutCard`, `ActivityIcon`,
`IntensityDot` in `components/health/`.

Sharing-specific (see [`SHAREABLE_PROJECTS_SPEC.md`](SHAREABLE_PROJECTS_SPEC.md)):
`ShareSheet`, `SharedBadge`, `PresenceAvatars` — reuse these before inlining any
sharing UI.

---

## Collaboration patterns (shared projects)
New reusable patterns introduced by shareable projects. Use these — do not inline
one-off collaboration UI.

- **Shared badge** — a people/users glyph (Lucide) chip shown on **every** surface
  a project appears on (Today Projects section, ProjectsPage card, ProjectDetailPage
  header) **whenever `memberCount > 1`**. It is persistent, not hover-only. Styling:
  `--sn-accent` on `--sn-accent-glow`/chip radius; never hardcoded color.
- **Presence indicator** — stacked member avatars (initials on `--sn-accent`/
  `--sn-purple` tinted backgrounds, no emoji) + an "active" dot (`--sn-success`)
  in the ProjectDetailPage header for members with a fresh presence heartbeat; a
  per-row "X is editing…" micro-label when a member's heartbeat carries an
  `editingTaskId`. Presence is ephemeral (RTDB) — the indicator clears when the
  heartbeat goes stale or `onDisconnect` fires (no ghost avatars).
- **Remote-update affordance** — when a remote edit lands via snapshot, flag the
  changed row with a brief token-styled highlight (and optional "Updated by X"
  micro-label). Must not shift layout, jump scroll, or steal local input focus.
  A manual refresh control is the fallback when snapshots stall.

These pair with the existing **Destructive = confirm + undo** rule: leave /
unshare / remove-member / revoke-invite all go through `ConfirmSheet`.

---

## Assistant chat patterns (AssistantPage, `/assistant`)

The in-app chat agent surface. Off by default — reachable only when
`settings.assistantEnabled` is on (entry point in MorePage is gated). All tokens,
no hardcoded color; page is a flex column filling `.sn-content` (fixed header →
scrolling thread → pinned composer), so it obeys the "no `100dvh` on pages" rule.

- **Message bubble** — `.sn-assistant-bubble`. User turns: `--sn-accent` fill /
  `--sn-accent-text`, right-aligned, tucked bottom-right corner. Assistant turns:
  `--sn-bg-card` + `--sn-border`, left-aligned, tucked bottom-left corner.
  `white-space: pre-wrap`; font `calc(14px * var(--sn-font-scale))`.
- **Tool-activity chip** — `.sn-assistant-tool-chip`, one per tool the agent ran,
  rendered above the assistant bubble. Lucide `Wrench` + human summary on
  `--sn-accent-glow` / chip radius. Error variant uses `--sn-danger-soft` /
  `--sn-danger` with an `AlertTriangle`. These are read-only status, not buttons.
- **Thinking indicator** — three `--sn-text-muted` dots bouncing in an
  assistant-styled bubble while the agent works (local `thinking` flag + session
  `status: 'running'`).
- **Composer** — pinned bottom bar (`--sn-bg-elev`, top border), auto-height
  textarea (`color-scheme: var(--sn-color-scheme)`, safe-area bottom padding) +
  a square `--sn-accent` send button. Enter sends; Shift+Enter newlines.
- **Approval card** — `.sn-assistant-approval`, rendered inline in the thread for
  each **pending** `proposedAction` (destructive tool the agent proposed). Danger
  framing (`--sn-danger-soft` bg / `--sn-danger` border + `ShieldAlert`), the
  human summary, a "can't be undone" note, and Cancel / **Delete** buttons —
  ConfirmSheet affordance parity (Delete = `--sn-danger` / `--sn-accent-text`, D5).
  Approving/rejecting is a plain owner write to the proposal doc; the card leaves
  the pending set when the `resumeAgent` function posts the outcome message.

---

## Interaction conventions
- **Mobile-first**, 44px+ touch targets, `-webkit-tap-highlight-color: transparent`.
- **No emoji in structural UI** — titles, nav, pickers, badges use SVG/plain text.
- **Destructive = confirm + undo:** `ConfirmSheet` before firing; `Toast` with an
  Undo action after.
- **Icons:** Lucide (`lucide-react`) or inline SVG. No other icon libraries.
- **Affordance parity:** the same action looks identical everywhere (all delete
  buttons styled alike; all add entry points behave alike).
- **Swipe grip:** any row wrapped in `SwipeableRow` shows the `SwipeGrip`
  (Lucide `GripVertical`, 6 dots) flush at its **trailing edge** so the pull
  gesture is discoverable — it replaces, not supplements, any decorative
  trailing type-icon. Render it **only when the row is actually swipeable**
  (omit it on disabled rows, e.g. done shopping items). It's a real button:
  **tapping it reveals the left-swipe actions** (or closes them) via
  `SwipeableRow`'s `useSwipeControls()` context, so actions are reachable
  without a swipe (desktop / accessibility). The whole row also stays the drag
  target; tinted `--sn-text-muted`.

---

## Known debt (does not yet conform)
None. `npm run check:ux` reports zero mechanical violations. Wire it into CI or a pre-commit hook as a blocking gate.
