# Dox theme: drawn charts

Part of [design-system.md](design-system.md). The recipes in `widgets/families/cutoff/` are the
pattern for every drawn transport chart: the cut-off tools, the Departure Board, Punctuality Board,
ETA Drift Chart, Timetable Reader, the ledgers, the B/L Date Stamp and the GNSS and leap-second
tools. Their roots join the same `:is()` lists. The rules:

- **Every label sits on an opaque `--gmt-surface` plate** (`.gmt-cutoff-chip`), in `--gmt-ice` or
  `--gmt-ice-dim`, so no glyph touches a gradient, hatch, glow or line and 7:1 holds over any fill.
- **Glow goes on marks** (`box-shadow`, `drop-shadow`), never on text. The one exception is a live
  value (the Countdown hero in live mode).
- **No `backdrop-filter` inside a chart.** The widget card is the one layer of glass.
- **"Closed" is a pattern plus a word:** the `.gmt-cutoff-closed` hatch and a "closed" chip, never colour alone.
- **Forced colours:** only marks, stems, edges and hatches opt out with `forced-color-adjust: none`.
  A plate that holds text never does.
- **Motion:** a chart animates nothing, except a connector that is not a value (the Stack's dashed
  arc, which stops in its own `prefers-reduced-motion` block). A drag handle keeps the focus sonar.
- **An accent edge is a bottom edge:** a 3px bar at `left bottom / 100% 3px`. No card carries a
  left-only accent (visual-design.md, Corners, borders, focus).
- **Class and series colours never say "good".** The Punctuality Board's tolerances are series 1 and
  3, so the on-time band never reads as success. Late, early, made and missed are words and patterns.
- **A clock change is purple for a repeated hour and gold for a skipped one** (`--gmt-dst-purple`,
  `--gmt-dst-gold`), with a pattern and a word too: a double edge, or a dashed edge and a hatch, and
  a chip saying "happens twice" or "never shows". Series 3 is the same purple, so a DST mark never
  has the form of a series mark.
- **The slashed-edge badge means "the rule changed".** An `offsetMismatch` badge carries the slashed
  break (`linear-gradient(115deg ...)` in `--gmt-ice-dim`), the mark the exact lane uses for time
  not drawn. Never one colour alone.
- **A two-lane strip with a reserved height** (Stored Time Audit): each lane is a fixed `rem` tall
  with four tier rows, so a gap, an overlap, a since strip and no strip are the same box. Chips hang
  from their point by `data-anchor` so none leaves the lane. The legend always holds five items and
  hides an unused one with `visibility: hidden`.
- **The `/why-gmt` industry chart never counts a function twice.** An industry's bar is its own
  namespace as a solid segment, then each module it draws on as a hatched tint of the same series.
  Totals sum own counts only, and the legend's words carry the meaning, never the hatch alone.
- **GNSS and leap-second tools** each have one signature drawing on the shared frame
  (`widgets/families/gnss/`), under the cut-off rules plus:
  - Amber (`--gmt-signal-*`) is the NO SIGNAL state alone. "Your reading", "today", "inserted" and
    similar are words and patterns, never a verdict colour.
  - A chosen lane or row is lit glass, a hatch and a chip, with any accent edge on the bottom.
  - Nothing in a drawing is focusable or animates. Each drawing is `role="img"` with an
    `aria-label` and a visually hidden list. Narrow rules are named container queries.

## Holding still

Readouts never move or resize their neighbours while the reader drags.

- **Hero plates** (`.gmt-punct-heroes`) are `justify-content: space-between`; each plate is
  `flex: 0 0 auto` with a reserved value and sub-line width measured across each handle's whole
  range, `tabular-nums` and `nowrap`. Sub-lines are fixed `.gmt-punct-hero-line` spans, and a line
  above a dragged control reserves its measured line count with `min-block-size` in `lh`.
  `setPresetDescription` keeps the preset description's height once a drag makes the state custom.
- **A cell whose content comes and goes holds its size with a hidden sizer** stacked in the same
  grid cell (`builders/hold.ts`, `families/edi/edi-hold.ts`, `families/holiday/held-text.ts`, the
  Timetable Reader's `hold`).
  - The hold is a one-cell grid whose two children, the sizer and the live wrapper (`data-gate="live"`),
    both sit in `grid-area: 1 / 1`.
  - The sizer has the shape of the largest thing the cell can hold (the longest note, or a value
    with the same character counts and break points), so it wraps the same way at every width. No
    height is a measured constant.
  - The sizer's text lives in `data-t` attributes drawn by `::before`, and the sizer is
    `visibility: hidden` and `aria-hidden`, so the text is never in `textContent`, copied or read out.
  - The live wrapper keeps the grid's default stretch. Aligned to the start, it would grow from
    nothing each time its content appears.
- GNSS tools reserve space the same way: every region is as big as the tallest thing it can show,
  and the server HTML hides the fields the initial state hides.
- **Gate:** `pnpm --filter @gmt/dox run readout:still` (`scripts/readout-still.mjs`) drags every
  handle by keyboard and pointer in Chromium and WebKit at 1440, 390, 360 and 300 and fails if a
  plate, the frame, the dragged control or anything above it moves or resizes. For tools with
  `scope: "widget"` it measures every element; only the drawing itself may change.
