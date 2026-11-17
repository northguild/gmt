# Tier 3: HUD chrome

Part of [built/index.md](index.md). Design rules: `reference/design-system.md`, `reference/visual-design.md`.

## Rules

- Glass is `blur(24px) saturate(1.4) brightness(var(--gmt-brightness))`: `0.72` dark, `0.97` light, measured 11-16:1 for body text. There is no grain.
- Corners use `corner-shape: bevel`. Browsers without it get a plain radius, and the `box-shadow` focus ring is never clipped. Only the carousel's panel, tiles, rows and diamonds may fall back to a `clip-path` octagon; an outline sits on a plain radius.
- Focus is a 2px cyan ring plus `gmt-focus-sonar` (one ping). Corner brackets go on few frames only (`reference/visual-design.md` § Panels): `.gmt-brackets` on each home `GridSection.astro` panel, and the transport tools' `families/transport/leg-fieldset.module.css`. The hero has no frame.
- Scrollbars keep the `::-webkit-scrollbar` styling; `scrollbar-color` would override it wholesale in Chromium.
- Motion allow-list: `reference/visual-design.md` § Motion. It has no boot sequence or scanline sweep. The homepage scroll reveal hides only under `html.gmt-reveal-ready`.
- `gmt-a11y.css` handles `prefers-reduced-transparency`, `prefers-contrast: more` and `forced-colors`; the global reset handles reduced motion.
- The `carousel` builder (`builders/carousel.ts`) is the APG tabbed carousel. The page passes previous and next buttons, an empty element for the dots and a polite live region. A button with no page carries `data-off`; one that loses its page while focused hands focus to the other with `data-quiet-focus`.
- Trap: the package `build` waits on `typecheck`, so `astro sync` and `astro build` never race on the content-layer store.

## Header

- The bar matches northguild.dev (`design-system.md` § `/dox` and the header): 55 px at every width (`calc(3.375rem + 1px)`), 4 px blur, and a dark island (`gmt-theme-dark`) on every page, so glass reads the fixed `--gmt-header-*` values. The outer `<header>` is Starlight's, painted by `gmt-glass.css`; the island class sits on the inner `.header` that `Header.astro` renders. `--sl-nav-height` and `--sl-nav-pad-x` are set in `gmt-theme.css`.
- The hairline is an inset shadow (a border in forced colours) in the bar's last pixel; `header.header` takes 1 px more padding below (`gmt-shell.css`).
- Layout from 50rem is a three-column grid (title, slack, icons); the search box sits at the right of the middle column at Starlight's 22rem cap and shrinks first. The right-hand group reads the places nearest out, Dox, GitHub, Discord, then the Settings gear at the edge, since it goes nowhere and acts on every page ([tier-3-sound.md](tier-3-sound.md)). Every item is icon-only and shows its name as its `title`. The NorthGuild link, GitHub, Discord and the gear are northguild.dev's too and land on its pixels, so the step between sites changes only what lies between. Below 50rem the gear is all the group shows.
- On the landing the bar is glass over the hero: `.gmt-herostage` starts at the top of the page (`margin-block-start: -nav height`, padding back by the same). The backing drops from .92 to .55 and the bar's text and icons carry `--gmt-shadow-halo`, a fixed dark ink in both themes.
- `NorthGuildMark.astro` inlines `northguild-mark.svg` through `lib/ng-mark.ts`, which suffixes both gradient ids per page. The six paths are the northguild.dev mark's: never edit them on one side only. In forced colours every line is `CanvasText`.
- `SiteTitle.astro` renders "/ gmt" in `--gmt-cyan` and `v<gmtVersion>` (from `src/generated/versions.ts`) in dim mono. The version hides below 30rem and never goes under the 12px floor; the wordmark never hides. Wordmark sizing reads `--gmt-wordmark-size`, `-tracking`, `-leading`.
- The search dialog is inside the island, so `gmt-tokens.css` gives `[data-theme="light"] .gmt-theme-dark dialog` the light tokens back.
- Below `md` the rest of the right-hand group is hidden. `MobileMenuFooter.astro` (registered in `components`, rendered by our `Sidebar.astro`) carries the Dox link with the header button's label and `aria-current`.
- `MobileMenuToggle.astro` overrides Starlight 0.41's menu button (`lib/menu-button.ts`) with one fix: `aria-expanded` is on the `<button>`. Starlight 0.42 replaces the component; `MobileMenuToggle.test.ts` fails once 0.42 or newer is installed, and then the override, `menu-button.ts`, the test and the `components` entry are deleted.

## Landing entrance and cross-site transition

- The entrance lives in `gmt-entrance-freeze.css`. The NorthGuild link never animates; "/ gmt v<version>", search and Dox freeze in. GitHub, Discord and the gear are on the page the reader came from, so they never hide: they show from the first paint in northguild.dev's dim ice and turn cyan with their shine (`ng-shine-in`). The four chips shine left to right, 0.16 s apart from 1.75 s; Dox freezes in 1.35 s so it has locked before its shine. Reduced motion fades the three pieces that freeze and tints the other three in place; forced colours sweeps them. A view-transition arrival (`data-arrival="transition"`) keeps the whole bar still.
- northguild.dev and Dox are one origin, so a click between them runs a cross-document view transition once both opt in (`@view-transition`, `rel="expect"` on the bar). Three names are shared with northguild.dev's header and unique per page: `ng-header` (`.page > .header`), `ng-mark` (the mark's `svg`) and `ng-wordmark` (`.gmt-ng-wordmark`, from 31.25rem only; below that it is not named and fades with the bar).
- The inline head script `arrival.ts` adds the `from-landing` type when the previous page is a same-origin page outside the base. Under that type the mark and wordmark stay still, the bar's snapshots dissolve over 240 ms and the root's over 600 ms.
- Trap: the opt-in is an inline `<style>` in the head (`VIEW_TRANSITION_OPT_IN`, `Head.astro`), never a rule in a linked sheet. Chromium missed a linked rule on the landing and aborted the transition with "invalid state".
- Contract for northguild.dev: the same three names on `.site-header` (`id="site-header"` for the `rel="expect"` link), `.ng-mark` and an `.ng-wordmark` span, a bar of `block-size: calc(3.375rem + 1px)` with `box-sizing: border-box`, and matching old/new rules. `scripts/fixtures/ng-landing.html` stands in for that page; `hero-space` clicks through from it and checks the type, the durations and that mark and wordmark boxes match within 0.5 px.
