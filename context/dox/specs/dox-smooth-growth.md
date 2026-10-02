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
3. **On each observation** (the entry says *which* boxes changed and their width; the height is
   read live, `offsetHeight`, because it must be read after the boxes inside have been pinned):
   - **Width changed with a different `innerWidth`** (a real resize, the Delivery Scheduler's
     compact switch): **snap**, then update the cache. A width change at the same viewport is a
     scrollbar or a font arriving and eases like any other change.
   - **Height unchanged** (within 1 px): do nothing.
   - **Snap instead of animating when any of these hold:**
     - `matchMedia("(prefers-reduced-motion: reduce)").matches`, read at each change;
     - `document.hidden`, where no frame would run;
     - `outer.querySelector('[aria-expanded="true"]')` (an open zone combobox list).
   - **Already moving:** only set a new target (the inner's height). The box heads for it from
     where it is. Never reset to the old height, and never snap because a slot inside has started
     to ease.
   - **Not moving, and the change is only a box inside easing on its own** (the change equals the
     summed last step of the outermost moving boxes inside, within 2 px): the outer is already the
     right height. Update the cache and follow.
   - **Otherwise start:** pin the outer at the height the reader last saw, plus what the boxes
     inside have already shown; set `data-growing`; set the target to the inner's height.
4. **The frame loop** (`requestAnimationFrame`, `setTimeout` where there is none) runs while any
   box is moving. Each frame, for every moving box:
   - released when within 1 px of its target, or still pinned 4 s after its last retarget;
   - otherwise wants to cover `1 - exp(-dt / 50 ms)` of the distance left (`dt` is the frame time,
     capped at 100 ms, so a stall counts for no more than that);
   - the wants of the **outermost** moving boxes (those with no moving box around them) are summed;
     above `STEP_BUDGET_PX` (40) every box is scaled by the same factor, so the page never moves
     more than the budget in a frame however late the frame is. A box inside a moving box moves the
     page not at all, takes the same scale, and is excluded from the sum.
5. **Release** clears the inline height and `data-growing`. Safe at rest.
6. **Abort.** On `signal` abort: unobserve, release, and drop the element from the `WeakSet`, so it
   can be re-attached. The shared observer disconnects when the last element detaches.

**One shared observer.** Every `.gmt-grow` is observed by one module-level `ResizeObserver`, so
every box that changes in a frame arrives in the same callback, and processing deepest-first
means a slot is pinned before the section around it reads its height. The section then sees only
what the slot does not account for.

**Why a frame loop and not a CSS transition.** A transition is a function of time. When a frame
arrives late (a busy mount, a slow paint at 1440 px) the box moves by everything it missed, and one
dropped frame doubles the step. Frames of 20 ms at 1440 px, with the occasional 33 ms one,
turned a curve that holds 46 px on 16.7 ms frames into 73-88 px steps. Slowing the ease would trade
away the animation to cover a case the loop covers exactly.

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
}
```

Why `content-box`: Starlight's reset is `border-box`, and a later section carries
`padding-top` and `border-top` (`gmt-widget.css`). Under `border-box`, an inline height equal
to the inner's height would be 17 px short.

The section keeps its own `display: flex; flex-direction: column` from `gmt-widget.css`. The
inner box takes over the column and inherits the section's `gap`.

**No tokens.** The constants live in `smooth-height.ts` (`STEP_BUDGET_PX`, `FOLLOW_TAU_MS`,
`SETTLE_PX`, `MAX_GROW_MS`).

Under reduced motion the JS snap means no motion starts at all.

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
  - the root's height and `main`'s height as PAINTED: read at the end of the frame's last
    `ResizeObserver` callback, which is after layout, after every box has been pinned and before
    paint. A 1 px sentinel changes width each frame so a callback runs in every frame, and the
    page's own `ResizeObserver` is wrapped so its callbacks are followed by a read;
  - the same heights read in a task after the frame (`raw`);
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
  - the largest frame-to-frame jump of the painted height (`maxJump`), and of `main`;
  - the largest jump of the raw reading (`rawMaxJump`), reported and never asserted;
  - the number of frames over 48 px;
  - the final height;
  - whether every `.gmt-grow` is at rest (no inline height, no `data-growing`);
  - the median frame interval.
- **Assertions:**
  - the largest painted jump, of the root and of `<main>`, ≤ 48 px;
  - every `.gmt-grow` at rest at the end;
  - the final height equals the `--reduce` run's final height for the same page, browser and
    width, within 1 px. Run `--reduce` first; the script can do both in one invocation.
  - Zoned Earth: zero growth.

  **Why painted, and why `rawMaxJump` is not asserted.** A mount task can run between a frame's
  rendering and the task that samples after it. It fills a section, the reading forces layout and
  sees the new height, and the next frame's `ResizeObserver` pass pins the box before anything is
  drawn: that height was never on screen. Such a single reading shows as a jump of the section's
  whole height in `rawMaxJump` and not at all in the painted series. A pop that is painted is in
  the painted series and fails. A frame with no painted reading falls back to the raw one and is
  counted as `unpainted`, reported only. A run that throws is a failed run with a row of its own.

  The gates are diagnostics, not exact-pixel tests: small differences between browsers (a few px
  over the limit, a final height a few px off the reduced-motion run) are tolerated and read, not
  chased. A pop a reader would see in one paint is what the gate is for.

  Write `results.json` and a Markdown table to `--out`. Exit non-zero on any failure.
- `--reduce` additionally asserts that `[data-growing]` never appeared.
- `--frames` writes every run's per-frame samples to `--out/frames/`, to find the frame that jumped.
- `--video` records the load pass for every page (Playwright `recordVideo`) into
  `--out/video/`.
- `--css` injects a style tag (for trying a token value), for example
  `--css ".gmt-enter{animation:none !important}"`.
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
   - a step never exceeds the budget, however late the frame (16.7 to 1000 ms);
   - a box walks to its target and is released (no inline height, no `data-growing`);
   - a shrink eases the same way;
   - abort (and the already-queued frame finding nothing to move);
   - the reduced-motion snap, and the hidden-page snap;
   - the `aria-expanded` snap;
   - the no-`ResizeObserver` guard, and the `setTimeout` fallback with no `requestAnimationFrame`;
   - `followFraction` and `budgetScale`;
   - boxes moving together share one budget and keep their proportions, including a box that
     starts later;
   - the safety release after `MAX_GROW_MS`;
   - a section with a slot: the change the slot does not account for is eased, not popped; a
     change that is only the slot easing is followed without the section moving; a moving section
     is not snapped when a slot inside it starts; a slot inside a moving section spends no budget
     of its own;
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

The 48 px per-frame gate is fixed. The loop is built to meet it whatever the frame time:

- **Easing:** each frame covers `1 - exp(-dt / 50 ms)` of the distance left, an ease-out with
  no duration. A retarget during a drag does not lag and never restarts a curve.
- **Budget:** the boxes that move the page move at most 40 px a frame in total, scaled together.
  The 8 px under the gate is room for a reflow that is not eased.
- **Slow frames** make the ease last longer, never step further: `dt` is capped at 100 ms and the
  step at the budget. A 2000 px change takes at least 50 frames.
