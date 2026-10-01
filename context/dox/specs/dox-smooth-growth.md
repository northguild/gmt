# Spec: Smooth growth for tool widgets (`.gmt-grow`)

Execution spec for `dox-builder`, verified by `dox-tester`. This is `apps/dox` work only. It
changes no result any tool shows, and no `packages/gmt` file.

**The problem.** Every tool except Zoned Earth pops in. The shell server-renders a template
with empty result sections, and the async mount fills every section in one frame, 150–340 ms
after load. Input changes then shift the content below in single jumps. This spec makes
height changes in result regions ease, through one CSS-backed primitive.

Read first: `context/dox/built.md` § Rules and § Tier 2 (the widget, form-control and gates
bullets), `reference/design-system.md` (§ The stylesheet stack, § Maintenance rules, § Form
controls, § Verifying a change is visually safe), `reference/visual-design.md` § Widget chrome
and § Motion.

## 0. Binding rules

- **No git operations.** Leave everything unstaged. Do not touch `packages/gmt`. No changeset.
- **Ports.** Serve only on 4351 or 4352. Never use 4321 (the owner's dev server), 4341 or
  48231 (another agent).
- **Never build into `apps/dox/dist`.** Another agent may be serving from it. Build with
  `pnpm exec astro build --outDir <scratchpad>/dist-<label>` and serve that folder statically
  (`python3 -m http.server 4351 --bind 127.0.0.1 --directory <folder>`). Before a build, run
  `pgrep -fl "astro build"`; if another build is running, wait for it to finish.
- **Do not run `visual:before` / `visual:after`** until the architect says the restyle agent has
  finished.
- **Sequencing lock (Steps 1–2 only, until the architect lifts it).** Do not edit any
  `gmt-cutoff-*` file, any `cutoff-*` mount, `gmt-widget.css`, `gmt-transport-widgets.css` or
  `gmt-punctuality-widgets.css`.
- **Height is the only property that moves.** Never animate opacity or transform on a value.
  Never animate a value the reader is trying to read.
- **At rest every `.gmt-grow` is `height: auto`**, with no inline `height` and no
  `data-growing`.
- **Server HTML does not change** for the 16 teaching widgets. The section wrap is runtime-only,
  so readers without JS see today's page. The only server-markup changes are the Zone Planner
  wrapper (Step 2) and `data-grow="slot"` attributes (Step 3).
- **Reduced motion changes nothing visible.** Under `prefers-reduced-motion: reduce`, heights
  snap and `data-growing` never appears.
- **Keep every existing test assertion unchanged.** New assertions may be added. Never write
  `it.skip`, `it.todo` or `it.fails`.
- **Tokens only, no colour literals, no `@layer`.** Follow the sheet ownership in
  design-system.md.
- **Scratch files** live under the scratchpad, never in the repo. Delete any repo scratch
  before reporting.

## 1. The primitive — `apps/dox/src/lib/smooth-height.ts` (new)

### `smoothHeight(outer: HTMLElement, signal?: AbortSignal): void`

`outer` has exactly one element child, the **inner** box. A `ResizeObserver` watches the inner
box. Its callback runs after layout and before paint, so a new height is never painted
unclipped.

1. **Guard.** If `typeof ResizeObserver === "undefined"`, return and change nothing (the same
   guard as `lib/label-fit.ts` `onWidthChange`). If `outer` is already attached (a
   `WeakSet`), return.
2. **Seed the cache synchronously at attach.** Read the inner's border-box block and inline
   size at once (`getBoundingClientRect()`). The plan's rule "first observation: cache, no
   animation" means "never animate from nothing at attach". A seed taken at attach keeps that
   and closes a race. If the mount renders before the observer's first callback, the first
   callback would otherwise cache the full size and the pop would stay. The first callback
   compares against the seed like any other.
3. **On each observation** (read `entry.borderBoxSize[0]`, falling back to
   `entry.contentRect`):
   - **Width changed** (a resize, the Delivery Scheduler's compact switch): **snap**, then
     update the cache.
   - **Height unchanged:** do nothing.
   - **Snap instead of animating when any of these hold:**
     - `matchMedia("(prefers-reduced-motion: reduce)").matches`, read at each change;
     - `outer.querySelector('[aria-expanded="true"]')` (an open zone combobox list);
     - a **descendant** `.gmt-grow` has `data-growing`, so the inner one wins and the outer
       follows it.
   - **Otherwise animate:**
     1. if `outer` is not growing, set `outer.style.height = <cached height>px`;
     2. read `outer.offsetHeight` to force layout;
     3. set `data-growing` and `--gmt-grow-duration` (see § Timing);
     4. set `outer.style.height = <new height>px`;
     5. update the cache.
   - **A change mid-flight** (a pointermove re-render during a drag) only sets a new target
     height and a new duration. CSS retargets from the current value. Do not reset to the old
     height.
   - **Snap** means: clear the inline `height`, remove `data-growing`, clear the timeout and
     update the cache.
4. **Cleanup** clears the inline `height`, `data-growing` and `--gmt-grow-duration`. It runs
   on `transitionend` or `transitioncancel` where `event.target === outer` and
   `event.propertyName === "height"`, because a nested grow's events bubble up. A timeout
   fallback (duration + 100 ms) also runs it, because no event fires when the computed height
   does not actually change.
5. **Abort.** On `signal` abort: disconnect the observer, remove the listeners, clear the
   timeout and clean up. The element is then removed from the `WeakSet`, so it can be
   re-attached.

**One shared observer.** Every `.gmt-grow` is observed by one module-level `ResizeObserver`,
so every box that changes in a frame arrives in the same callback. Each callback:

- processes entries deepest-first, so a slot is handled before its section, and the section
  takes the "a descendant is growing → snap" path;
- sums |Δ| over every entry that will animate, where Δ is the distance from the current
  rendered height to the target;
- gives each of those entries the same duration, `growDuration(sum, MAX)`.

Sections that grow at the same time therefore share one speed budget. Without that, two
sections each peaking at 48 px would make a 96 px frame. Per-element state (the `WeakSet`,
the seed, the cache, the timeout, abort) stays per element.

**Timing.** `growDuration(totalDeltaPx, maxMs)` = clamp(120, `0.6 × totalDeltaPx`, `maxMs`)
ms. It is an exported pure function.

- 120 ms is the value of `--gmt-duration-fast`.
- `maxMs` is read from `--gmt-grow-max` with `getComputedStyle` (default 1250), so the
  measurement script can try another cap by injecting a style.
- 0.6 ms/px is chosen so that no change moves more than 48 px in a 60 Hz frame. The steepest
  frame of `cubic-bezier(0, 0, 0.58, 1)` needs 0.550–0.580 ms per px across 120–1250 ms. At
  0.6 the bound holds for every change up to 2083 px, where the 1250 ms cap starts to bind.

### `smoothHeights(scope: ParentNode, signal?: AbortSignal): void`

- Guard on `ResizeObserver` as above. Without it, **wrap nothing**.
- **Sections.** For every `.gmt-widget-card > .gmt-widget-section` **from the second section
  on** that is not `[data-grow="off"]` and not already wrapped:
  - create `<div class="gmt-grow-inner">`;
  - move every child node of the section into it (`append(...section.childNodes)`, so node
    identity is kept and comments move too);
  - append the inner to the section, add `.gmt-grow` to the section, and call
    `smoothHeight(section, signal)`.

  Section 1 holds the controls and is never wrapped, because its popovers must not clip.
- **Slots.** For every `[data-grow="slot"]` inside a widget card (in any section, section 1
  included), wrap the slot element itself:
  - insert `<div class="gmt-grow gmt-grow-slot">` before the slot and move the slot into it;
  - call `smoothHeight(wrapper, signal)`.

  The slot keeps its own node, class, `data-role` and `aria-live`. Slots are processed
  **after** sections, so a slot inside a wrapped section is wrapped inside the section's inner
  box.
- **Static hosts.** For every `.gmt-grow` that is not yet attached and is not a section (the
  Zone Planner wrapper), call `smoothHeight(el, signal)`.
- **Idempotent.** A second call wraps nothing twice and attaches nothing twice.
- Node identity is kept, so the mounts' `q()` lookups and `aria-live` regions are unaffected.

### Auto-attach

`apps/dox/src/components/Head.astro`: in the existing `<script>`, next to `import '~/lib/sonar'`,
import `smoothHeights` and call `smoothHeights(document)`. The 16 shell scripts are not edited.

Head's module script comes first in the document, and module scripts run in document order, so
the wrap is in place before any mount's first `render()`. Each mount awaits a dynamic import
before it renders. Confirm this in the built output; the measurement gate also proves it.

### CSS — `apps/dox/src/styles/gmt-primitives.css`

```css
.gmt-grow {
  display: flex;
  flex-direction: column;
  min-height: 0;            /* a flex item may shrink below its content while easing down */
  box-sizing: content-box;  /* inline height = the inner box's height; a section's padding and border sit outside it */
}
.gmt-grow[hidden] { display: none; }   /* an author display beats the UA [hidden] rule */
.gmt-grow-inner { display: flex; flex-direction: column; gap: inherit; }
.gmt-grow[data-growing] {
  overflow-y: clip;         /* y only: glows and focus rings still spill sideways. Not overflow-clip-margin: Safari ignores it */
  transition: height var(--gmt-grow-duration, var(--gmt-duration-med)) var(--gmt-grow-easing);
}
```

Why `content-box`: Starlight's reset is `border-box`, and a later section carries
`padding-top` and `border-top` (`gmt-widget.css`). Under `border-box`, an inline height equal
to the inner's height would be 17 px short.

The section keeps its own `display: flex; flex-direction: column` from `gmt-widget.css`. The
inner box takes over the column and inherits the section's `gap`.

**Tokens — `gmt-tokens.css`, in the Timing block:**

- `--gmt-grow-easing: cubic-bezier(0, 0, 0.58, 1)`, CSS `ease-out`, so a retarget during a
  drag does not lag, while the steepest frame stays within the 48 px gate (§ 7);
- `--gmt-grow-max: 1250ms`.

Under reduced motion the global reset in `gmt-controls.css` already shortens transitions to
0.01 ms. The JS snap means none starts at all.

## 2. Hosts that grow as a whole

- **Zone Planner.** `components/MultiZoneScrubber.astro`: wrap `<div id="scrubber-host">` in a
  static `<div class="gmt-grow">`. The global attach picks it up through "static hosts". The
  `aria-expanded` snap rule protects its combobox. The host keeps its id, and the shell script
  is unchanged.
- **Chat rail.** `components/ask/MountedWidget.tsx`:
  - add an outer `<div className="gmt-grow" ref={outerRef}>` around the existing
    `gmt-hive-widget-host` div. The host div keeps `ref`, `className`,
    `suppressHydrationWarning` and the `aria-busy` handling. `MountedWidget.test.tsx` (the
    "marks the host busy" test) must pass unchanged.
  - In the effect, before the "Loading…" `innerHTML` write, call
    `smoothHeight(outerRef.current, controller.signal)`. The Loading → template → mount swaps
    then become one slide.
  - After `root.innerHTML = renderTemplate(...)`, call `smoothHeights(root, controller.signal)`,
    so a rail widget's result sections and Step 3 slots ease the same way they do on a tool
    page. A nested grow wins over the host grow while it animates.
  - The error state renders `WidgetError` without the wrapper, as today.
  - Add tests for these, with a fake `ResizeObserver` stubbed on `globalThis`:
    - the outer `.gmt-grow` wraps the host;
    - unmount aborts the observer, and the outer is left with no inline height;
    - with no `ResizeObserver` (jsdom's default), nothing is wrapped and the existing
      assertions hold.

**Stop after Step 2.** Report to the architect. Steps 3 and 4 start only when the architect
lifts the sequencing lock.

## 3. Stop text-length jumps (after the lock is lifted)

- **Reserve one line** with `:empty::before { content: "\200b"; }`. This needs no markup
  change, works on every target, and avoids `lh`. Apply it to:
  - `.gmt-codeframe-pre code` (the empty `<code>` from `lib/code-frame.ts`), in `gmt-widget.css`;
  - `.gmt-transport-verdict` and `.gmt-transport-verdict-detail`, in
    `gmt-transport-widgets.css`;
  - `.gmt-punct-naive` and `.gmt-punct-callout`, in `gmt-punctuality-widgets.css`;
  - `.gmt-widget .gmt-widget-hint`, in `gmt-widget.css`;
  - `.gmt-billing-verdicts > li`, in `gmt-billing-deadlines.css`.

  `.gmt-widget-output` already reserves `min-height: 1.5em`.
- **Replace `:empty { display: none }` with the one-line reserve** where the slot sits above a
  plot or a draggable control:
  - `.gmt-dwell-summary:empty` (`gmt-dwell-ledger.css`);
  - `.gmt-freetime-summary:empty` (`gmt-free-time-ledger.css`);
  - `.gmt-punct-rate:empty` (`gmt-punctuality-widgets.css`);
  - `[data-role="legend"]:empty` (`gmt-crossing-clock.css`).

  Leave the `:empty` rules in `gmt-clock-list.css`, `gmt-form-controls.css` and
  `gmt-timetable-reader.css` alone.
- **Nested slot grows.** Add `data-grow="slot"` in the templates to every
  `[data-role="reason-aside"]` (Cut-off Stack, Crossing Clock, Billing Deadlines, Punctuality
  Board, Free Time Ledger) and to the Dwell and Free Time `data-role="summary"` paragraphs. A
  section grow only moves content below the section. A slot grow keeps a bar from moving under
  the pointer.
- **Gate-driven slots.** After the slots above, re-run the measurement (§ 6). If any result
  region in an **unwrapped section 1** still makes a jump over 48 px, mark that region
  `data-grow="slot"`. Expected candidates: the DST Inspector's transitions table and its code
  frame, and the Interval Visualizer's `relationship-aside`. List every slot added in the
  report. Never wrap a control or a popover host.
- `html-diff compare` must then show ✗ only for widgets whose sole change is an added
  `data-grow="slot"` attribute. Confirm that by reading the diff.

## 4. Docs of record (after the lock is lifted; present tense, no history)

- **`context/dox/reference/visual-design.md` § Motion** becomes an allow-list of what moves:
  - the sonar focus ping;
  - the globe's spin and fade;
  - cross-document view transitions (`gmt-view-transitions.css`): the header and sidebar swap
    in place and only the content cross-fades;
  - the homepage scroll-reveal (`gmt-reveal.css`, `lib/scroll-reveal.ts`);
  - height easing through `.gmt-grow`: height only, never opacity or transform on a value.

  Remove the sentences that say there is no scroll reveal and no view transitions; both ship.
- **Add a "Layout stability" section** to visual-design.md:
  - reserve single-line slots;
  - ease height changes in result regions;
  - keep `.gmt-grow` inert without JS;
  - keep section 1 unwrapped;
  - mark a slot above a draggable surface `data-grow="slot"`.
- **Fix the scroll-reveal default.** `styles/gmt-reveal.css` hides homepage content by default
  (`opacity: 0`), against the visibility-by-default rule. Gate the hidden state behind
  `html.gmt-reveal-ready`. `lib/scroll-reveal.ts` adds that class to `document.documentElement`
  only when it is about to observe (motion allowed and `IntersectionObserver` present). The
  `.gmt-reveal-in` rules stay. Add a unit test that the class is set when observing and not
  set under reduced motion.
- **`reference/design-system.md`:** in the stack table, add `.gmt-grow` to row 3's list. Add a
  short "Smooth growth" subsection covering `smoothHeight`, `smoothHeights`, `data-grow="off"`
  and `data-grow="slot"`, the snap rules, the `content-box` reason, and the two tokens.
- **`context/dox/built.md`:**
  - add a Tier 2 bullet for `.gmt-grow`: the decision and a one-line reason;
  - correct Tier 3 "Motion", which says the scroll reveal and view transitions were removed.
    Both ship.
  - add the measurement script to Tier 2 "Gates".

## 5. The measurement script — `apps/dox/scripts/grow-measure.mjs` (new, a permanent gate)

Write it **first**, before any Step 1 change, and record the "before" numbers with it.

- Usage:
  `node scripts/grow-measure.mjs --base http://127.0.0.1:4351 --out <dir> [--browsers chromium,webkit] [--widths 1440,390] [--reduce] [--video] [--css "<extra css>"] [--only <slug,…>]`.
  Add `"grow:measure": "node scripts/grow-measure.mjs"` to `apps/dox/package.json`.
- **Pages.** The 16 teaching tools, `/tools/zone-planner/` and `/tools/zoned-earth/`. Each has
  a root selector: the page's first `.gmt-widget`, the Zone Planner's `.gmt-scrubber-block`,
  and Zoned Earth's globe block.
- **Load pass.** Viewport `{width, 900}` (844 at 390). `reducedMotion` is `"no-preference"`
  unless `--reduce` is set. An init script starts a `requestAnimationFrame` loop at
  `DOMContentLoaded`. For 4 s it records, every frame:
  - `t`;
  - the root's `getBoundingClientRect().height`;
  - `main`'s height;
  - whether any `[data-growing]` exists.
- **Interaction pass.** Wait for rest (no `[data-growing]` and an unchanged height for 500 ms).
  Start the sampler, then:
  1. switch the tool's preset select to a different preset;
  2. sample 2 s;
  3. if the tool has a draggable handle or range, drag it across about 60% of its track in
     about 20 pointer steps;
  4. sample 2 s.

  Keep a per-tool table of preset selector, alternate value and drag selector, built from the
  templates' `data-role`s. A tool without a preset uses another input change; name it in the
  table.
- **Per run, report:**
  - total growth (first to last height);
  - the largest frame-to-frame jump;
  - the number of frames over 48 px;
  - the final height;
  - whether every `.gmt-grow` is at rest (no inline height, no `data-growing`);
  - the median frame interval.
- **Assertions:**
  - largest jump ≤ 48 px;
  - every `.gmt-grow` at rest at the end;
  - the final height equals the `--reduce` run's final height for the same page, browser and
    width, within 1 px. Run `--reduce` first; the script can do both in one invocation.
  - Zoned Earth: zero growth.

  Write `results.json` and a Markdown table to `--out`. Exit non-zero on any failure.
- `--reduce` additionally asserts that `[data-growing]` never appeared.
- `--video` records the load pass for every page (Playwright `recordVideo`) into
  `--out/video/`.
- `--css` injects a style tag (for trying a token value), for example
  `--css ":root{--gmt-grow-max:500ms}"`.
- Chromium and WebKit only. Firefox is blocked by the sandbox on this machine. Record that;
  never bypass the sandbox.

## 6. Definition of done

**After Step 2** (the report back to the architect):
1. `src/lib/smooth-height.test.ts` passes, using a hand-triggered fake `ResizeObserver` and a
   stubbed `offsetHeight` / `getBoundingClientRect`. It covers:
   - no animation at attach;
   - the first observation equal to the seed does nothing;
   - a seed smaller than the first observation animates;
   - a width change snaps;
   - a mid-flight retarget keeps the inline height and sets a new target;
   - cleanup on `transitionend` and on `transitioncancel`;
   - a bubbled event from a nested grow is ignored;
   - the timeout fallback;
   - abort;
   - the reduced-motion snap;
   - the `aria-expanded` snap;
   - the nested-growing snap;
   - the no-`ResizeObserver` guard;
   - `growDuration`'s bounds (120 and the cap) and its 0.6 ms/px slope;
   - two sections changed in one callback both get the duration of their summed delta;
   - a slot and its section changed in one callback: the slot animates and the section
     snaps;
   - `smoothHeights`:
     - wraps sections 2+ and never section 1;
     - honours `data-grow="off"`;
     - wraps slots;
     - attaches static hosts;
     - is idempotent;
     - keeps node identity (a reference taken before still resolves);
     - keeps comments.
2. The MountedWidget tests above pass, and every existing assertion is unchanged.
3. `pnpm --filter @gmt/dox test`, `check` and `lint` are green.
4. `grow:measure` before/after numbers are recorded for every page × {1440, 390} ×
   {chromium, webkit} × {load, interaction}.
5. Under `--reduce`, `[data-growing]` never appears on any page.
6. **Clipping:**
   - in the Zone Planner, an open zone combobox shows its full list;
   - a screenshot taken mid-grow shows focus rings and glows at section edges are not cut;
   - the ETA plot callouts and the Countdown chip are intact at rest.

**After Steps 3–4** (final):
7. `grow:measure` passes every assertion on all 18 pages, in both browsers, at both widths,
   in both passes.
8. `node scripts/html-diff.mjs compare` shows ✗ only for added `data-grow="slot"` attributes.
9. `pnpm visual:diff` is reviewed. Only the one-line reserves may differ, each named.
10. Root `pnpm run validate` is green.
11. The docs in Step 4 are updated.

## 7. Timing and the 48 px gate

The 48 px per-frame gate is fixed. The timing is built to meet it:

- **Easing:** `cubic-bezier(0, 0, 0.58, 1)`, CSS `ease-out`.
- **Duration:** linear in distance, 0.6 ms per px, clamped to 120–1250 ms (the owner's cap, so a phone-width Ruler, Delivery, Stack or Punctuality
  grow of 1200–2000 px runs for 0.7–1.2 s instead of speeding up).
- **Budget:** sections that change in the same frame share one duration, computed from their
  summed distance (§ 1, One shared observer).

The steepest 60 Hz frame of this curve covers about 2.3% of a change at 1250 ms. At 120 ms it
covers about 21.9%. Over that whole range a change needs 0.550–0.580 ms per px to stay at
48 px or less per frame, so 0.6 ms/px keeps every change within the gate up to 2083 px, where
the 1250 ms cap binds. The largest first-load growth measured, Delivery at 390 px wide (+2034 px),
takes 1220 ms.

The ease-out start keeps a retarget during a drag from lagging. A square-root duration
cannot meet the gate: with a fixed 420 ms cap, this curve tops out at 731 px.
