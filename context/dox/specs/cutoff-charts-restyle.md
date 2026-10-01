# Spec: Cut-off charts restyle

Execution spec for `dox-builder`, verified by `dox-tester`. This is a visual change to the
charts of the three TRAN-10 tools: the Cut-off Countdown's axis, the Cut-off Ruler's lanes,
close-up and readings, and the Cut-off Stack's section 2 timeline and table. It is not
`packages/gmt` work and changes no result any tool shows.

Read first: `context/dox/built.md` § Rules and § Tier 2 (the cut-off and form-control
bullets), `reference/design-system.md` (rules 1, 2 and 6, § Form controls),
`reference/visual-design.md` § Widget chrome, and `specs/tran-10-cutoffs.md` § 0.

## 0. Binding rules

- **No git operations.** Leave everything unstaged. Do not touch `packages/gmt`.
- **The widget draws the library's results and computes none of them.** Every time, duration,
  sign, "moved" flag and closed day shown comes from the facts the mounts already collect.
  The polyfill may place things: band edges, tick positions, the DST band. Turning a returned
  ISO duration into "−20 min" is formatting (`durationText` plus `isNegative`).
- **Amber is only for the sentinel.** Late, on time, open, closed and moved are words and
  patterns, never amber and never success or error colouring. Series colours identify a
  series, never a verdict. `--gmt-dst-gold` marks a spring-forward gap only; that is the
  site's existing DST convention.
- **Series colour is never text.** `--gmt-purple-ink` (series 3) and
  `--gmt-severity-high-ink` (series 4) measure 5.7–6.7:1 on any surface lighter than
  `--gmt-void`. Series colour goes on marks, stems, edges, swatches and borders only.
- **Every text label inside a chart sits on an opaque plate.** A chip or header strip on
  `--gmt-surface`, with text in `--gmt-ice` (primary) or `--gmt-ice-dim` (secondary). Measured
  on flat surfaces: ice is 15.3:1 dark and 16.0:1 light; ice-dim is 7.9:1 and 8.0:1. No glyph
  ever sits directly on a gradient, a hatch, a glow or a line.
- **No glow on text.** Glow is a `box-shadow` or `drop-shadow` on a mark. The one exception
  is the Countdown hero in live mode ("live values glow"), which is decoration only and is
  measured without it.
- **Not glass within glass.** No `backdrop-filter` inside a chart. The glass look comes from
  a tint, a hairline border and the inset highlight (`--gmt-highlight`).
- **Tokens only.** One-off gradient stops are the only exception, written as
  `color(from var(--token) srgb r g b / a)`. Never add a `[data-theme="light"]` colour block.
- **Nothing inside a drawn chart is focusable**, and each chart keeps `role="img"`,
  `tabindex="-1"` and its `aria-labelledby`.
- **Labels are placed with `lib/label-fit.ts`** (`placeLabel`, `pickLabelLeft`,
  `thinTickLabels`, `onWidthChange`). Never use a fixed step or a magic offset that only fits
  one preset.
- **Stay inside the floors:** 12px minimum text, contrast of at least 7:1 for text, no sideways
  scroll at 390, `not-content` roots, `container-type: inline-size`, and narrow rules as
  `@container` queries. The `/dox` rail is narrow on a wide screen.
- **Reduced motion.** The Stack's dashed arc is the only animation, and it stops under
  `prefers-reduced-motion: reduce` (`animation: none` in its own block). Never animate a value.
- **Keep every existing test assertion unchanged.** New assertions may be added.

## 1. Do not break these (shared classes and test hooks)

- **TRAN-57 shares cut-off classes.** `gmt-punctuality-board`, `gmt-eta-drift` and
  `gmt-departure-board` use `.gmt-cutoff-axis-tick`, `.gmt-punct-frame` and
  `.gmt-punct-ticks`, which sit in `gmt-cutoff-widgets.css` selector lists. Leave those rules
  as they are. Scope every new rule to
  `:is(.gmt-cutoff-stack, .gmt-cutoff-ruler, .gmt-cutoff-countdown)`, or split the selector list.
  The neighbour pixel diff (§ 7) must show zero change on those three tools, the Delivery
  Scheduler and the DST Inspector.
- **Hooks the tests pin.** Keep them exactly:
  - every `data-role`;
  - `.gmt-cutoff-axis-tick` text (`HH:00`, `D Mon`);
  - "go back 1 h" / "go forward 1 h" in the Ruler overview's `textContent`, and no
    "go back" or "go forward" when there is no transition;
  - three `.gmt-cutoff-ruler-closeup-row` and three `.gmt-cutoff-ruler-closeup-label`
    elements on R1;
  - each reading's ISO hours string (for example `PT49H`) in `[data-role=readings]`;
  - one `.gmt-cutoff-stack-day` per day, carrying an inline `left:…%;width:…%` style;
  - exactly two `.gmt-cutoff-stack-day--closed` on `rotterdam-weekend`. Never put the class on
    a second element per day;
  - a Stack table row's first cell `textContent` equal to the cut-off name, so any swatch is
    an empty element.
- **Widget roots are unchanged** (`html-diff.mjs` matches them).
- **The Countdown "now" alignment.** The axis is inset by half a thumb width, so the now pin
  and the range thumb share an x. Replace the hand-summed `margin-inline` on
  `.gmt-cutoff-countdown-drag` with one custom property, `--gmt-countdown-inset`, that both the
  axis padding and the drag field read. Any padding or border you add to the axis or track
  goes into that property.
- **Forced colours.** The cut-off block in `gmt-a11y.css` names today's classes. Rewrite it for
  the new ones, keep it in place, and keep it small.

## 2. Series palette (shared)

The Delivery Scheduler's four leg pairs become site-wide series tokens, so a series colour
means the same thing everywhere.

- `gmt-tokens.css` `:root`: add `--gmt-series-1` … `--gmt-series-4` and
  `--gmt-series-1-ink` … `--gmt-series-4-ink`, aliasing exactly what `gmt-delivery-scheduler.css`
  uses today: cyan / cyan-ink, spring / spring-ink, dst-purple / purple-ink, and
  severity-high / severity-high-ink. Add no light block; the aliases re-tint. Re-read the
  file immediately before editing it, and add only these eight lines and a two-line comment.
- `gmt-delivery-scheduler.css`: point the four `[data-leg]` rules at the new tokens. The result
  must be pixel-identical (neighbour diff).
- `gmt-cutoff-widgets.css`: add `[data-series="1".."4"]` inside the three cut-off roots, setting
  `--series` and `--series-ink`. Add `.gmt-cutoff-series-swatch`: a small bevelled square in
  `--series`, `aria-hidden`.
- Series assignment:
  - **Ruler:** calendar = 1, exact = 2, pinned = 3, in the lane, the close-up marker and the
    result card.
  - **Stack:** add `series: number` (1-based) to `StackRow` in `cutoff-stack.ts`. It is the
    matched entry's index in `entriesOf(state)`, which is the order of the `cutoffSchedule`
    call, falling back to row index + 1, cycling past 4. It only names an input already
    matched; it computes nothing. Add a test row in `cutoff-stack.test.ts`. `entriesOf` is
    `toEqual`-asserted, so do not change its shape.
- **Purple appears twice in the Ruler.** Series 3 and the fall-back DST mark are both purple,
  as leg 3 and the DST notes already are in the Delivery Scheduler. Shape and words separate
  them: a series is a solid horizontal stem with a bevelled head; the DST mark is a dashed
  vertical line or band with a labelled chip.

## 3. Shared chart recipes (`gmt-cutoff-widgets.css`)

- **Chart surface.** Each of `.gmt-cutoff-countdown-axis`, `.gmt-cutoff-ruler-overview`,
  `.gmt-cutoff-ruler-closeup` and `.gmt-cutoff-stack-timeline` gets:
  - a bevelled panel (`corner-shape: bevel`);
  - a `--gmt-glass-tint` fill with a faint cyan radial or linear wash;
  - a `--gmt-border-strong` hairline on the top edge and `--gmt-border` elsewhere;
  - an inset `--gmt-highlight` top line.

  `.gmt-punct-frame` keeps today's rule.
- **`.gmt-cutoff-chip`.** A bevelled plate: `--gmt-surface` background, 1px border
  (`--series` when inside a `[data-series]`, otherwise `--gmt-border-strong`),
  `--gmt-text-xs` mono, `--gmt-ice` text, `white-space: nowrap`, and its own `line-height`.
  Variant `--dim` uses `--gmt-ice-dim` text. Every chart label uses it.
- **`.gmt-cutoff-mark`.** The series marker: a 12px bevelled square (or a 45° diamond) filled
  with `--series` and ringed by `--gmt-surface`. Its glow is
  `0 0 0 3px color(from var(--series) srgb r g b / .25), 0 0 12px color(from var(--series) srgb r g b / .45)`.
  `--hollow` is a `--gmt-surface` fill with a 2px dashed `--series` border and no glow.
- **`.gmt-cutoff-gate`.** The departure or cut-off line: 3px of `--gmt-cyan-bright`, a
  `--gmt-glow` shadow and a small bevelled cap.
- **`.gmt-cutoff-closed`.** One hatch for "closed", used by the Countdown and the Stack:
  - a 45° hatch in `color(from var(--gmt-teal) srgb r g b / ~.5)`, 2px on and 6px off;
  - a `color(from var(--gmt-void) srgb r g b / ~.4)` veil over it, which also lightens in the
    light theme because void is white there;
  - a "closed" chip.

  Tune the alphas so it reads clearly in both themes.
- **Ticks inside the three roots.** Each tick gets a 4px rule mark (`::before`, `--gmt-border-strong`)
  above its label, and a day-boundary tick gets a taller, brighter mark. Thin the labels with
  `thinTickLabels`, as today.
- **DST chips.** `.gmt-cutoff-dst--overlap` uses a `--gmt-dst-purple` wash, a 0.4-alpha border
  and `--gmt-dst-purple-ink` text. `.gmt-cutoff-dst--gap` uses `--gmt-dst-gold` with
  `--gmt-dst-gold-ink` text. Both sit on an opaque `--gmt-surface` base:
  `background: linear-gradient(<wash>, <wash>), var(--gmt-surface)`.
- **The old "nothing animates" block stays**, plus the arc exception in § 6.

## 4. Cut-off Countdown (`cutoff-countdown-mount.ts` `renderAxis`, `gmt-cutoff-countdown.css`)

The axis is rendered inside `[data-role=countdown-axis]`. It is still empty when
`facts.left === ""`.

1. **Hero plate**, top left:
   - a caption, "time to cut-off", in `--gmt-ice-dim` small caps;
   - the signed value in `--gmt-font-display`, about `clamp(1.6rem, 7cqi, 2.4rem)`, in
     `--gmt-ice`. The value is `${isNegative(left) ? "−" : left === "PT0S" ? "" : "+"}${durationText(left)}`,
     for example "−20 min", "+50 min" or "0 min";
   - the raw `left` ISO in mono `--gmt-ice-dim`.

   In live mode only, the hero carries `data-live` and a soft cyan glow.
2. **Chip row** above the track. The gate chip reads "cut-off 17:00" and the now chip
   "now 17:20" (local times from `localParts`). The gate chip goes on the side away from now.
   The now chip uses `placeLabel` with the gate x as a blocker. When now equals the cut-off,
   the gate chip goes left and the now chip right. Both stay inside the track (`placeLabel`
   flips at the edges). Re-fit on width change.
3. **Track**, about 3.5rem tall:
   - the **open** region is lit glass: a gradient from transparent at the window start to
     `color(from var(--gmt-cyan) srgb r g b / ~.35)` at the gate, with an inset top highlight
     and an "open" chip;
   - the **closed** region is `.gmt-cutoff-closed`;
   - the **gate** (`.gmt-cutoff-gate`) runs the full track height and reaches up to its chip;
   - the **now pin** is a 2px `--gmt-ice` line with a bevelled head at the top, running up to
     its chip.

   Hide the "open" or "closed" chip, through `placeLabel` or a width check, when its region
   is too narrow to hold it.
4. **Ticks row** with rule marks, thinned by `thinTickLabels`, re-run on width change (it is
   not thinned today).
5. **Leave the rest as it is:** the verdict line, the rule box, the range and its chip, the
   summary and the outputs. They keep their text.

## 5. Cut-off Ruler (`cutoff-ruler-mount.ts`, `gmt-cutoff-ruler.css`, `cutoff-ruler.ts`)

- **Overview lanes.** Each `.gmt-cutoff-ruler-lane` carries `data-series`. The lane label is a
  swatch plus the label in `--gmt-ice`.
  - The bar becomes a **stem**: a 3px gradient from `--series` at the reading to about
    0.25 alpha at the departure edge.
  - The head is a `.gmt-cutoff-mark` with glow.
  - The bar label ("Sat 2 Nov 18:00 · 49 h") is a `.gmt-cutoff-chip` placed by the existing
    `pickLabelLeft` logic.
  - The departure edge is a `.gmt-cutoff-gate`, and the "Departs …" line gains the
    `transportIcon("ship")` glyph (decorative, `aria-hidden`).
- **DST transition.**
  - Add an exported pure `transitionKind(t): "overlap" | "gap"` in `cutoff-ruler.ts`. Fall-back
    is overlap and spring-forward is gap. Add a unit test.
  - Draw the dashed line in `--gmt-dst-purple` (overlap) or `--gmt-dst-gold` (gap). For an
    overlap, also draw a faint purple band `|Δoffset|` wide after the transition instant: the
    repeated hour. That is drawing math on `RulerTransition`'s offsets.
  - The label in the transition row becomes a `.gmt-cutoff-dst--overlap|--gap` chip with the
    same text, still placed by the existing fit logic.
- **Close-up.**
  - Alternating hour bands behind the rows, one per pair of adjacent hour ticks from the
    existing `walkTicks` result, every other band in `--gmt-fill-2`.
  - Each `.gmt-cutoff-ruler-closeup-row` carries `data-series`. Its marker is a
    `.gmt-cutoff-mark` with a thin dotted `--series` guide down to the tick row.
  - `.gmt-cutoff-ruler-closeup-label` becomes a `.gmt-cutoff-chip` with a series border. Its
    text stays exactly `r.label`, placed by `placeLabel` as today.
- **Results.** `[data-role=readings]` stays a `<ul>`, and each `<li class="gmt-cutoff-ruler-card" data-series>`
  is a bevelled card on `--gmt-surface` with a 3px `--series` accent edge on the left. It holds:
  - a header with a swatch and the label (`--gmt-ice`, bold);
  - the local time large (`localLabel(r.at)`, `--gmt-font-display`, about `--gmt-text-xl`,
    `--gmt-ice`, allowed to wrap);
  - a secondary line: the ISO `r.at` · `durationText(r.hoursBefore)` before departure ·
    (`r.hoursBefore`), mono `--gmt-text-sm` `--gmt-ice-dim`, `overflow-wrap: anywhere`;
  - the gloss line in `--gmt-ice-dim`.

  A sentinel reading keeps its `NO SIGNAL` output in place of the time. The cards sit in a
  grid of `repeat(auto-fit, minmax(min(100%, 14rem), 1fr))`.

## 6. Cut-off Stack (`cutoff-stack-mount.ts` `renderTimeline`, `fitStackTimeline`, `renderTable`; `gmt-cutoff-widgets.css`, `gmt-cutoff-stack.css`)

1. **Structure.** One plot grid: the label column (6rem; collapses at `@container (max-width: 30rem)`)
   and the track column. A `.gmt-cutoff-stack-days` layer is absolutely positioned over the
   track column for the full plot height, so the day columns run behind every lane.
2. **Day columns** (`.gmt-cutoff-stack-day`, inline `left`/`width` as today) are glass panels:
   - a faint tint, alternating in strength between neighbouring days;
   - a hairline left edge;
   - a header strip at the top on `--gmt-surface`, holding the day label in `--gmt-ice`.

   A closed day adds `--closed` (the `.gmt-cutoff-closed` hatch over the whole column) and a
   "closed" chip under its header. The narrow-column logic (`--narrow`, `MIN_LABEL_PERCENT`)
   keeps working, and the `title` still names the day.
3. **Lanes** carry `data-series`. The lane label is a swatch plus the name.
   - The solid marker is `.gmt-cutoff-mark`.
   - A moved cut-off adds a `.gmt-cutoff-mark--hollow` at `row.unrolled`, joined to the solid
     marker by an inline SVG arc. The arc is `aria-hidden`, positioned from `min(%)` with
     `|Δ|%` width, uses `preserveAspectRatio="none"` and `vector-effect: non-scaling-stroke`,
     and has a `--series` stroke dashed 4 by 4.
   - The arc animates `stroke-dashoffset` so the dashes flow from the hollow marker to the
     solid one. Under reduced motion it gets `animation: none`.
   - Remove the old `→`/`←` connector text.
   - Skip the arc when the two markers are within about 1.5% of each other.
   - The time chip reads `localLabel(row.at)`, followed by " · moved" when `row.moved`. It
     is placed by `placeLabel`, with the gate x and the hollow marker x as blockers.
4. **The departure** is one `.gmt-cutoff-gate` drawn once in the days layer at full height, not
   once per lane. At its foot is a gate chip with `transportIcon("ship")` and "departs 18:00".
   Update `fitStackTimeline` to read the gate x from that one element. The
   `.gmt-cutoff-stack-departure-line` caption stays below the plot.
5. **Table.** The first cell starts with an empty
   `<span class="gmt-cutoff-series-swatch" data-series="N" aria-hidden="true"></span>`, so it
   shows the same series as the lane. Restyle the table so it reads with the chart:
   - a bevelled frame;
   - a header row on `--gmt-surface`;
   - row hairlines in `--gmt-border`;
   - the "moved" cell shows "from …" as plain text. Moved is a word, not a colour.

## 7. Files

Modify:

- `apps/dox/src/styles/gmt-tokens.css` (§ 2, eight lines)
- `apps/dox/src/styles/gmt-delivery-scheduler.css` (§ 2, four rules)
- `apps/dox/src/styles/gmt-cutoff-widgets.css`
- `apps/dox/src/styles/gmt-cutoff-countdown.css`
- `apps/dox/src/styles/gmt-cutoff-ruler.css`
- `apps/dox/src/styles/gmt-cutoff-stack.css`
- `apps/dox/src/styles/gmt-a11y.css` (the cut-off forced-colours block only)
- `apps/dox/src/lib/cutoff-countdown-mount.ts`
- `apps/dox/src/lib/cutoff-ruler-mount.ts`
- `apps/dox/src/lib/cutoff-ruler.ts`
- `apps/dox/src/lib/cutoff-stack-mount.ts`
- `apps/dox/src/lib/cutoff-stack.ts`
- tests beside each: add assertions only.

**Do not touch** these: another session owns them.

- `DoxChat.tsx`, `WidgetRail.tsx`, `DoxPage.tsx`
- `gmt-hive.css`, `chat-constants.ts`
- any punctuality file
- `packages/gmt`

For `gmt-tokens.css` and `gmt-a11y.css`, re-read the file immediately before each edit and keep
the edit local.

**Tests to add:**

- **Countdown:** the hero shows "−20 min" on `late`, "+50 min" on `on-time` and "0 min" on
  `at-cutoff`, and `zoneless-now` has no hero.
- **Ruler:** each reading's lane, close-up row and card share one `data-series`, and R1 has an
  overlap DST chip while R3 has a gap chip.
- **Stack:** the lane and its table swatch share a `data-series`; a moved row has one hollow
  marker and one `aria-hidden` arc; `documents` on `rotterdam-weekend` has neither.
- **All three charts:** still contain no focusable descendant.

**Forced colours** (`gmt-a11y.css`):

- chips get a `CanvasText` border and `Canvas` fill;
- a solid mark gets a `CanvasText` fill, and a hollow mark a `Canvas` fill with a dashed
  `CanvasText` border;
- the gate is `Highlight`;
- the closed hatch becomes `Canvas` with a dashed `CanvasText` border, and its "closed" chip
  stays;
- arcs, stems and DST lines become `CanvasText`, with the DST line dashed;
- the swatch is a `CanvasText` border, because a series is named in text everywhere.

## 8. Definition of done (`dox-tester` runs each line)

Build into a private outDir, because another session builds `apps/dox/dist`. Then serve it on
port 48231, which is not the owner's 4321.

```sh
cd apps/dox && pnpm run generate && pnpm exec astro build --outDir $SP/dist-after
python3 -m http.server 48231 --bind 127.0.0.1 --directory $SP/dist-after
```

The script is `$SP/cutoff-shots.mjs`, where `$SP` is the dox-architect's scratchpad. Run it
with the repo's Node (`eval "$(fnm env)" && fnm use`).

1. `pnpm --filter @gmt/dox test` is green, including generate and `font-floor.test.ts`, and no
   existing assertion is edited (`git diff` on the six cut-off test files shows additions only).
2. `pnpm --filter @gmt/dox check` and `pnpm --filter @gmt/dox lint` are green.
3. `pnpm run validate` is green. An `ERR_MODULE_NOT_FOUND` under `dist/.prerender` is the
   concurrent-build race with the other session: re-run, and report it if it persists.
   `packages/gmt` is unchanged: `$SP/gmt-src.sha` matches a fresh
   `find packages/gmt/src packages/gmt/skills packages/gmt/README.md -type f -print0 | sort -z | xargs -0 shasum | shasum`.
4. `node $SP/cutoff-shots.mjs shots after` writes
   `apps/dox/.visual/cutoff-restyle/after/`. The `before/` set already exists. Compare every
   pair by eye: both themes look designed, the charts read, and nothing is clipped.
5. `node $SP/cutoff-shots.mjs sweep` reports 0 problems: no text overlap, no text under 12px,
   no clipped text, no sideways scroll and no focusable element in a chart, across all 17
   presets × 2 themes × 1440/390.
6. `node $SP/cutoff-shots.mjs contrast` reports 0 text leaves under 7:1, measured against the
   worst pixel behind each glyph box, with the sentinel excluded. The before build fails this
   gate today, and the restyle must fix every case:
   - dark-theme "closed" on the Countdown hatch: 5.45:1;
   - Stack day labels and "closed" on the hatch: 5.45:1;
   - the Stack table header: 6.4:1.

   The baseline is in `$SP/contrast-before.json`.
7. `node $SP/cutoff-shots.mjs neighbours after && node $SP/cutoff-shots.mjs diff-neighbours`
   shows every Delivery Scheduler, Punctuality Board, ETA Drift, Departure Board and DST
   Inspector capture at 0.2% or less.
8. `node $SP/cutoff-shots.mjs forced` captures read by eye: every mark, gate, hatch and chip is
   visible in forced colours.
9. `node $SP/cutoff-shots.mjs motion` shows no running chart animation under reduced motion,
   and the arc running without it.
10. The Countdown now pin's centre x is within 1px of the range thumb's centre x on `late`,
    `on-time` and `other-clock`, and after a keyboard step of the range, at 1440 and 390.
11. The `/dox` rail mount of each tool at its rail width shows no sideways scroll and no
    overlap. The Stack, Ruler and Countdown are mounted the same way at a 360px container.
12. Firefox cannot launch on this machine. Record it as blocked and do not bypass the sandbox.
    Chromium and WebKit are covered.
