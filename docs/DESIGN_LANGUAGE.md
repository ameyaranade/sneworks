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
  `--sn-warning`/`--sn-warn`/`-soft`, `--sn-gold`/`-glow`, `--sn-purple`.
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
| `ComposeSheet` | `components/sheets/ComposeSheet.tsx` | universal create/edit for all todo + log types |

Health-specific: `GoalRing`, `WeeklyBarChart`, `WorkoutCard`, `ActivityIcon`,
`IntensityDot` in `components/health/`.

---

## Interaction conventions
- **Mobile-first**, 44px+ touch targets, `-webkit-tap-highlight-color: transparent`.
- **No emoji in structural UI** — titles, nav, pickers, badges use SVG/plain text.
- **Destructive = confirm + undo:** `ConfirmSheet` before firing; `Toast` with an
  Undo action after.
- **Icons:** Lucide (`lucide-react`) or inline SVG. No other icon libraries.
- **Affordance parity:** the same action looks identical everywhere (all delete
  buttons styled alike; all add entry points behave alike).

---

## Known debt (does not yet conform)
None. `npm run check:ux` reports zero mechanical violations. Wire it into CI or a pre-commit hook as a blocking gate.
