# Dox theme: entrance and header

Part of [design-system.md](design-system.md). What moves and when is in
[visual-design.md](visual-design.md) (Motion).

## Entrance

The site has one arrival gesture: a fade from 92% scale over 0.5 s on the spring curve. Five things
use it: the globe canvas, the globe's zone list, the Crossing Clock's two faces, the `/dox` crystal
and every card of a tool widget. A landmark visual that appears once its content is ready uses it,
and so does each card of a teaching widget; nothing else does, and it never replays on a value change.

- **Cards** (`card()` in `builders/layout.ts`) carry a valueless `data-enter`, and `card(children,
  { enter: n })` writes `--gmt-enter-i: n`, its index in the widget. The stylesheet runs the
  entrance on `[data-enter]:not([data-enter="pending"])` with delay `calc(var(--gmt-enter-i, 0) *
  var(--gmt-motion-stagger))` and `animation-fill-mode: backwards`. No script is involved, so a
  server-rendered card's first paint is the animation's first frame, a page without script shows
  the card, and a chat-rail widget that connects later enters the same way. The index is written
  into the markup and never changed, because a delay that changes after the animation starts makes
  it jump. Only `transform` and `opacity` move, so the entrance never changes a page's height and
  stays clear of `<gmt-grow>`.
- **CSS** (`gmt-primitives.css`): the `gmt-enter` keyframes, the `.gmt-enter` class, the
  `[data-enter]` rule and `[data-enter="pending"]`, which hides an element held for its moment.
  `--gmt-enter-transform` keeps an element's own transform through the entrance. Tokens:
  `--gmt-enter-duration`, `--gmt-enter-easing`, `--gmt-enter-scale`.
- **JS** (`lib/enter.ts`): `enter(el, { delayMs, onEntered })` plays it once and leaves
  `data-entered` without the class. `holdEntrance(el)` hides an element whose content is ready early
  and returns its release. A timer finishes or releases either one if `animationend` never comes, so
  a stall never leaves anything hidden.
- Server-rendered markup that enters on first paint (the crystal) uses `animation: gmt-enter
  var(--gmt-enter-duration) var(--gmt-enter-easing) both` directly.
- **Nothing is hidden before script:** only `lib/enter.ts` sets the class or the pending attribute.
- **Reduced motion:** `.gmt-enter` and a card's `[data-enter]` are `animation: none`; `enter()` marks
  the element entered at once and runs `onEntered`; `holdEntrance()` does not hold.

### The landing entrance

The landing page has its own, longer entrance (`lib/arrival.ts`, `lib/hero-entrance.ts`,
`gmt-entrance-freeze.css`). The arrival gesture above does not apply to the hero's canvas; the globe
has a dawn instead.

- **One owner of the clock.** An inline script in `Head.astro` sets `data-entrance="wait"` on
  `<html>` before first paint, and `static` after 2.5 s if nothing has taken it further, so a script
  that never loads cannot hide the copy. `runHeroEntrance` sets `run` at `t0`, starts the globe's
  dawn and sets `done` once the last animation has ended. Every animation but the copy's is keyed on
  `run`, so they all start in one style recalculation, and none matches after `done`. The copy's
  freeze is keyed on `wait` or `run` with the same value under both, so it starts at first paint and
  the change to `run` does not restart it: the page's largest text never waits for the sky.
- **The same script** listens for `pagereveal` and sets `data-arrival` to `transition` for an arrival
  through a view transition (the header does not freeze again) and to `load` otherwise. A value set
  earlier stands. `runHeroEntrance` waits for the reveal before writing `run` where the browser reports it.
- **Held, not hidden for good.** Buttons, pager and sky sit at opacity 0 only under `wait`; the copy
  is never held. A page with no script has no `data-entrance`, so nothing is held.
- **Each piece animates one way.** The freeze keyframes move opacity, a mask sweep, colour and
  (buttons) border colour; the copy's never moves opacity and its mask keeps a 50% floor. Fill is
  `backwards`, so hover and focus styles apply when it ends. A button's stagger comes from the
  `--ng-i` custom property in its markup, not `nth-*`. The card animates the individual `scale`
  property; the globe canvas has no CSS animation.
- **Gate:** `hero-space` > entrance checks the order, one animation per element, the properties
  animated, full copy opacity from the first frame, the largest paint before `run`, the card last,
  the resting state and the header on a transition arrival.

## `/dox` and the header

- `src/pages/dox.astro` wraps `<StarlightPage>` so the chat keeps the site's `customCss`;
  `data-dox-shell` hides only Starlight's `<h1>`, and the hive shell starts at `--sl-nav-height`.
  `noindex`, `pagefind: false`.
- `Header.astro` adds the "Chat with Dox" link: a plain `<a>` carrying `DoxMark.astro`, no
  JavaScript. On `/dox` it has `aria-current="page"`, shown by a 2px bar along its bottom edge (WCAG
  2.2 SC 1.4.1), never a left one. The bar is an `::after` on `/dox` only, so the button matches its
  neighbours' size and forced colours show it on that page alone.
- It also adds the NorthGuild link before the site title: a plain `<a>`, same tab, holding the mark
  and the "NorthGuild" wordmark, with `--gmt-space-3` before the title and no divider. The bar matches
  the northguild.dev header, so a click from there keeps the left of the bar where it was.
  - **The bar** is 3.5rem at every width (`--sl-nav-height`) with 1rem at its sides. Its glass
    (`--gmt-header-*`) is a dark island (`gmt-theme-dark`) on every page in both themes, so page text
    scrolling under it never lowers its contrast. The search dialog renders inside the bar and takes
    the dark tokens too. Over the landing's sky the bar's text and icons carry `--gmt-shadow-halo`,
    which uses the fixed ink (`--gmt-ink-fixed`), so it is dark in the light theme too.
  - **The mark** is `src/assets/northguild-mark.svg`, inlined by `NorthGuildMark.astro`, never
    served by URL; its paths and `viewBox` are the northguild.dev mark's, verbatim. The paint is in
    `gmt-primitives.css`. The gradient ids take a per-page suffix (`ng-mark-pane-1`) so two marks
    never share one. In forced colours the strokes are `CanvasText` and the fills `none`.
  - **The wordmark** is "NorthGuild" in Michroma at `--gmt-wordmark-size`, `-tracking` and
    `-leading`. The size eases from 1rem (500 px up) to 0.8rem on a phone, so "NorthGuild / gmt"
    stays whole at every width.
  - The link's name is `aria-label="NorthGuild home"`, starting with the visible text (SC 2.5.3).
    The SVG is `aria-hidden` and not focusable (SC 4.1.2). The box is at least 24x24 px (SC 2.5.8),
    takes `.gmt-sonar-focus` and gets a real `Highlight` outline in forced colours.
  - The URL is absolute and same-tab: a root-relative `/` would fail the `/gmt` dist guard.
- The `/dox` strip under the header keeps only the clock and the Live/Local badge. It is a `<div>`,
  not a `<header>`, so the page has one banner landmark.
- `SiteTitle.astro` reads "/ gmt v‹version›", the pattern every NorthGuild app shares:
  - "/ gmt" links to the docs home, in the wordmark's type and `--gmt-cyan`. The slash is
    `aria-hidden`, so the link's name is the visible word (SC 2.5.3).
  - "NorthGuild", the slash and "gmt" are `0.5ch` of the wordmark apart (`.title-wrapper` sets the
    wordmark's font only so `ch` reads in it); the version starts `1ch` of its own type after.
  - The version is plain text in `--gmt-font-mono` at 0.7 of `--gmt-wordmark-size`, never under 12px,
    in `--gmt-ice-dim`, on the name's baseline, from `gmtVersion` in `src/generated/versions.ts`.
    Below 30rem it hides.
  - Starlight's `title` stays `@northguild/gmt` for tabs, search results and social cards.
- `Header.astro` composes Starlight's parts via `virtual:starlight/components/*`, not
  `@astrojs/starlight/components/*.astro`: the direct path silently bypasses this repo's
  `SocialIcons` and `ThemeSelect` overrides. Types for the virtual modules are in
  `src/virtual-starlight.d.ts`; re-check them on every Starlight upgrade.
