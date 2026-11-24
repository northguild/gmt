# Slide decks

What `/slides/` ships: the decks, their stage, the presenter view, the room-scale rules and the
venue runbook. Deck 0, "Give Me Temporal", is the first deck. The rules that bind every change are
in [index.md](index.md); the gates that hold these rules are in [tier-2-gates.md](tier-2-gates.md).

## Shape

- **A deck is a folder and a row.** `src/slides/decks.ts` lists the decks; `deck-runtime.ts` and
  `deck-pages.ts` feed the `[slug]` routes (`/slides/<slug>/` and `/slides/<slug>/presenter/`).
  A deck's content, data and sheets live in `src/slides/<slug>/`. Shared code
  (`src/lib/slides/`, `src/components/slides/`) holds none of it. A second deck adds its folder and
  a row and gets everything below.
- **The page is an article first.** Without JavaScript `Deck.astro` renders every slide, build and
  note stacked. The head script sets `html[data-deck="wait"]` before the first paint and the mount
  (`deck-mount.ts`) sets `stage`. A slide is `#<id>`, a build `#<id>/<n>`; the same fragments work
  without JS.
- **The stage is 16:9 and a size container** (`.gmt-deck-stage`, `container-type: size`). Every
  stage size is a container unit of it, so the slide is the same slide at every window size. The
  Earth or the clock holds the right third of every slide; content keeps clear of it
  (`--gmt-deck-clock-room`).
- **The space layer is decoration.** `.gmt-deck-space` is `aria-hidden`: the real sky and the
  globe engine behind the slides, preloaded on the deck page so a dropped connection loses
  nothing. The deck needs the network for the chat only.
- **One mount, one signal.** `mountDeck` wires keys, blank, guide, fullscreen, dialogs, the
  presenter link and the space stage on one `AbortSignal`. Every listener goes with it.
- **The keys are one table** (`keys.ts`). The listener and the help dialog both read `KEY_TABLE`,
  so they cannot drift. Character keys follow the keys dialog's switch (WCAG 2.1.4).
- **Time comes from gmt**, dynamically imported; never `Date.now` or `Intl`. Deleting
  `src/slides` and `src/pages/slides` leaves the site building.
- **The presenter talks to the deck by a `BroadcastChannel`**, and holds readiness, pace, notes
  and the next step. Fullscreen, present and the guide belong to the deck window only; the presenter
  says so when pressed there.

## Decisions

### Stage rules match two roots

Every rule that styles what is inside a slide is prefixed
`:is(html[data-deck], [data-slide-stage])`. A presenter preview carries `[data-slide-stage]`, so it
gets the stage's own rules and cannot drift from them (the presenter once kept a second, diverged
copy of the stage type). `:is()` takes its most specific argument, so each rule keeps its
specificity; never wrap with `:where()`. Shell, page, bar, menu, blank, fullscreen and print rules
stay keyed on `html[data-deck]` alone.

### One fit: `.gmt-stage-fit`

`.gmt-stage-fit` (`slides.css`) lays its box out at `--gmt-fit-w` and scales it from its start
corner to `--gmt-fit-to` (default `100cqi`) with `tan(atan2(...))`. It is inert until
`--gmt-fit-w` is set. Its three users: the phone stage, the presenter previews and the Dox chat
frame. The formula exists once. A transform is used, never `zoom`: WebKit resolves `cqi` under
`zoom` against the zoomed box.

The class sets no `container-type`: the no-JS article stage carries it too, and a size container
there collapses to nothing. A user that needs `cqb` inside its box (a preview) sets
`container-type: size` itself.

### Presenter previews are clones, with plates

`slidePreview(part, build)` (`presenter-page.ts`) copies a slide into a `.gmt-stage-fit` box laid
out at 1920x1080 and scaled into its frame, so the presenter shows what the room sees. Ids, notes,
scripts and islands are stripped; a live piece becomes a plate named by its own accessible name,
never a second live demo. Transitions are off inside `[data-slide-stage]`. The preview is
`aria-hidden` and `inert`; the position line names the slide.

**Next shows exactly what one press of Next shows:** the same slide at the next build while builds
remain, else the next slide at build 0, else a plate saying "No slide after this one" under the
label "End of the deck". The presenter fits
1440x900 and 1280x800 with no page scroll: the page title band is hidden by `html[data-presenter]`
and the Starlight header stays.

### Text scales with the stage and has a floor

All stage text is in container units of the stage. Text the room reads is at least **1.25cqi**
(`--gmt-deck-text-sm`); fine print is at least **1.0cqi** (`--gmt-deck-text-fine`) and the
component that renders it sets `data-fine-print`. The two numbers are written in the tokens and the
`text-floor` gate and nowhere else. A 1920 stage on a 60-inch TV makes 1.25cqi about 17 mm; the
floor stops the worst cases and the back-of-room monitor serves the far rows.

**Every live site tool on a slide mounts through the one `DeckDox` frame.** The frame is laid out at
its 1280x720 box in `rem` and scaled as a unit by `.gmt-stage-fit`, so a `1rem` line is 1.25cqi at
every stage size. It carries `data-fine-print`: tool internals are held to 1.0cqi and deck text to
1.25cqi. A tool is never restyled piece by piece for the stage. A tool whose text is still under
1.0cqi after scaling gets one stage-scoped rule in its own sheet.

### Title-safe edges and the guide

A TV may crop 5% of each dimension (EBU R95). Every text leaf on the stage, and every visible
label of the space layer, sits at least 5% of the stage's height from the top and bottom, and at
least the action-safe 3.5% of its width from the sides: `--gmt-deck-pad-start` is 3.5cqi and a full
slide's end side mirrors it, so the text gets that margin back (DOX-G15). `--gmt-deck-safe-action` (3.5%) and `--gmt-deck-safe-title` (5%) in
`gmt-tokens.css` are the only place the two insets are written; the fix for a slide that crosses
one is in the shared padding (`--gmt-deck-pad-block`, `--gmt-deck-pad-inline`, `--gmt-deck-pad-start`) or the slide's own
layout, never a per-slide offset in shared code. The title-safe band holds text and controls (a
button, a link, a named picture); a decorative border, such as the `DeckDox` frame's, may run into
the action-safe band (3.5%) and the gate does not hold it.

`G` toggles the guide (`deck-guide.ts`, the `.gmt-deck-guide` layer in `Deck.astro`): two outlines
at the two insets, marks at the stage's corners and one plate with the window's size
(`1920 x 1080 CSS px at 2x, fullscreen`), rewritten on `resize` while open. It draws no fill and
never moves the stage. It is a character key, so the keys switch turns it off.

### Wake lock

While the deck is fullscreen it holds `navigator.wakeLock.request("screen")` so a TV does not dim
mid-talk. `deck-fullscreen.ts` owns it, the one module that names the API: it requests on entering,
requests again when the page becomes visible (the browser drops the lock when the page hides), and
releases on leaving fullscreen and when the signal aborts. No API, or a refused request, does
nothing and shows nothing.

### One deck window

The venue's AV mirrors the one deck output to the back-of-room monitor. The deck has no window
count, no second-window warning and no screen-size readiness row.

## Gates

The `slides-check` families, each of which opens its own context and closes it in `finally`:

- `presenter`: the preview's text sits where it sits on the deck's stage (within 0.005), lies
  inside its frame, Next's label matches what Next shows, the view fits both laptop sizes with no
  scroll, and every readout, frame and the nav row hold still while the readouts change.
- `text-floor`: the floor and fine print at 1920x1080 and 3840x2160, the same share at both
  (a `px` or `rem` somewhere shows as a mismatch), the safe edges at 1920x1080, and the guide on the
  first slide (rectangles at 3.5% and 5%, the slide's box unchanged by showing or hiding it).

## Venue runbook

Before the talk, at the venue:

1. Set the TV's picture size to "Just Scan", "Screen Fit" or "1:1", so the TV crops nothing.
2. Label the HDMI input PC or Game, so small text keeps full colour.
3. Extend the laptop's display; do not mirror it. Put the deck on the TV fullscreen with F5 and keep
   the presenter view on the laptop.
4. Open one deck window. The venue mirrors it to the back-of-room monitor.
5. Press `G` on the TV to check the frame: nothing the room reads may touch the inner rectangle's
   edge. Press `G` again to hide it.
6. Press "Check again" in the presenter until every readiness row is ok.

## Traps

- A rule on a slide's content keyed on `html[data-deck]` alone leaves the preview unstyled; use
  the `:is()` prefix.
- `cqb` in a preview resolves only because the fit box is a `size` container.
- Never add `[data-slide-stage]` to the presenter's hidden source.
- A slide that is not shown has `content-visibility: hidden` (screen only, after its fade). The stage
  renders every slide, and without it each view transition restyled the whole stage, about 40 ms a
  slide change, which broke `frame-budget`. Code that measures inside a hidden slide forces its
  layout, so measure the shown slide.
- Nothing that moves or lays out may start on a slide change's first frames. Capturing and first
  painting the arriving slide are the slowest frames of a change. The camera therefore starts only
  once the view transition's new picture is up (`afterSwap` in `deck-transition.ts`). A Dox chat
  on the slide just left remounts only once the camera rests (`whenStageRests` in `deck-state.ts`).
  Started any earlier, either one broke `frame-budget` at 1280x720.
- No glass blur inside the `DeckDox` frame. The frame is opaque, so a blur there shows nothing, but
  it is redrawn on every frame of a flight past it: the composer's broke `frame-budget` at 1280x720.
  `deck-dox.module.css` sets the `--gmt-glass-blur*` tokens to `none`, as reduced transparency does.
- A clock shard (`clock-shatter.ts`) keeps only the dial parts that reach its cell. Twenty whole
  copies of the dial were 6,000 elements, styled twice as the clock broke, 30 ms a frame at
  1280x720, over `frame-budget`. The pruned copies style in about 11 ms. A copy is wider than its
  shard, so `earth-clock.css` lifts the site's `max-inline-size` on it; without that the copies
  shrink to their shards and the dial vanishes at the break.
- Headless Chromium may refuse fullscreen and the Wake Lock API. Tests stub both; the gate checks
  the guide on a windowed stage.
