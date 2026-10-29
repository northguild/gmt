# Slice 10g — the chat rail and `/dox/`

Every widget now renders from the kit. This slice moves the host that mounts them in the chat
rail onto the kit too, and fixes the product side of cause 3 (`focus-obscured` on `/dox/`).
React stays inside `/dox/`.

## Current state (verified)

- `components/ask/MountedWidget.tsx` (206 lines):
  - `:68` writes a loading `<p role="status">` with `root.innerHTML`;
  - `:84` writes `renderTemplate(idPrefix, args)` with `root.innerHTML`;
  - `:87` calls `smoothHeights(root, signal)` and `:89` `enterWidgetSections(root)`;
  - `:188` is the error status, already an `<output>` after 8b.
- `components/Head.astro:38-44` calls `smoothHeights(document)` and `enterWidgetSections(document)`
  on every page. `lib/widget-enter.ts` (75 lines) staggers the numbered cards found by class.
- `MountedWidget.test.tsx` (481 lines) records a `log: string[]` from a spy entry and polls it
  with `waitFor` (`:31-90`).
- `RailResizer.render.test.tsx:35` renders `<div className="gmt-hive-body" data-testid="body">`,
  because `RailResizer` finds its container by class.
- `/dox/` scrollers in `gmt-hive.css`: the rail (`:201`), the short-viewport shell (`:350`), the
  artifact body (`:475`), the examples body (`:1906`) and the conversation's inner scroller
  (`:635`). None sets `scroll-padding`. Fixed or sticky covers sit at `:34`, `:53` and `:1622`.
  Below 60rem the licence footer is `display: none` (`:1579-1583`).
- Cause 3: Firefox at 390 reports starters "covered by footer.gmt-hive-licence". Slice 5's
  message now gives the cover, scroller and viewport facts.

## Files and changes

- **`MountedWidget.tsx`.**
  - The loading line is a `loading({ title })` kit builder: an `<output>` with the text, set
    through `setHtml` (8a).
  - The template goes in through `setHtml`, since `renderTemplate` returns `SafeHtml` now.
  - `smoothHeights` and `enterWidgetSections` calls go: `<gmt-grow>` registers itself on
    connect (8a), and the card entrance belongs to the `card` builder (below).
  - `aria-busy` stays on the root until `mount` resolves.
- **Card entrance.** The `card` builder writes `data-enter` and `--gmt-enter-i: <n>` (its index
  within the widget). `src/widgets/primitives/enter.ts` runs the existing `enter()` gesture on
  connect, with the delay from `--gmt-enter-i` and the duration from `--gmt-motion-*`. Delete
  `widget-enter.ts` and both document-wide calls in `Head.astro`.
- **`RailResizer.tsx`** takes its container as a prop (a ref from the parent) instead of a class
  lookup. Its test renders the parent with no class or test id and queries
  `getByRole("separator", { name: "Resize the widget panel" })`.
- **`MountedWidget.test.tsx`.** The log array becomes `vi.fn()` spies (`mount`, `wired`,
  `aborted`, `destroy`), and each `waitFor` poll becomes `await flushWidget()` (slice 7). Keep
  every case, including the StrictMode double effect and abort between the awaits.
- **Cause 3: focus never obscured (SC 2.4.11).** Each scroller above gets
  `scroll-padding-block` equal to the block size of whatever covers it: a `--gmt-hive-cover-*`
  token per cover, read by both the cover and the scroller, so they cannot drift. Tab-walking
  then scrolls a focused starter clear of the licence footer and the composer. Where the cover
  is hidden (below 60rem), its token is `0`.
- **Lint lists.** Take every `components/ask/**` file this slice touches off the legacy lists.

## Traps

- StrictMode runs the effect twice. The cleanup can land between `validate`, `load` and `mount`
  (comment at `:94-96`). Keep that guard and its test.
- `<gmt-grow>` inside a rail widget nests inside the host's own grow (`outerRef`). The inner one
  must win while it animates, as `smoothHeights` does today (`:85-86`). Test it in Chromium.
- Head.astro's document-wide calls also ran on tool pages. After this slice, every tool page
  gets its grow and entrance from the elements. Check one tool page from each family slice.
- `scroll-padding` only helps the browser's own focus scrolling. The rail's roving keyboard
  code must call `scrollIntoView({ block: "nearest" })`, which honours it.

## Definition of done

1. From `apps/dox`: `pnpm test`, `pnpm check` and `pnpm lint` pass, and the legacy lists are
   shorter by every file named above.
2. `rg -n 'smoothHeights|enterWidgetSections|data-testid|className="gmt-' apps/dox/src/components/ask`
   returns nothing.
3. Run every gate in Chromium, both themes, at 390 and 1440, on `/dox/`. **Cause 3:**
   `a11y-tab-walk` reports no `focus-obscured`, and the message facts from slice 5 show each
   scroller's `scroll-padding-block` equal to its cover's height.
4. **Chat rail**, from `/dox/` starters: mount one widget from each family slice (8c, 9a–10f),
   then abort each mid-load. No console error, and no listener left (the `destroy` check).
5. **Permalink** round trip from the rail for three widgets.
6. With reduced motion emulated, the cards appear with no animation, and `getAnimations()` on
   the rail is empty after mount.
7. No card has a left-border-only accent.
8. `node scripts/verdict.mjs validate` passes.
