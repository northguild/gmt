# Slice 5 · Cross-site transition

[Index](./index.md) · Binding rules: [built.md § Tier 3](../../built.md#tier-3--hud-chrome)
(cross-document view transitions, `rel="expect"`).

## Goal

A click from northguild.dev to `/gmt/` keeps the NorthGuild mark and wordmark perfectly still,
cross-fades the rest of the bar, and lets the landing freeze in underneath. Both sites are one
origin (`https://northguild.dev`), so a cross-document view transition can run between them once
both opt in.

## Today

`gmt-view-transitions.css` has `@view-transition { navigation: auto }`. It names the header
`gmt-header` and the sidebar `gmt-sidebar`. Their groups and new snapshots run no animation and
their old snapshots are hidden, so inside Dox the header swaps instantly. The root cross-fades over
`--gmt-duration-fast`. Reduced motion sets `navigation: none`. `astro.config.mjs` adds the
`rel="expect"` render-blocking link; its marker is in `Footer.astro`.

## Dox changes

**Names.** Rename the header to `ng-header`, and name two more parts that both sites share:

```css
.header { view-transition-name: ng-header; }
.header .gmt-ng-link svg { view-transition-name: ng-mark; }
.header .gmt-ng-wordmark { view-transition-name: ng-wordmark; }
```

Keep today's in-site rules for all three names: no group animation, no new-snapshot animation,
old snapshot hidden. In-site navigation looks as it does today.

**Arrival type.** Extend the inline head script from slice 4 (`src/lib/arrival.ts`). On
`pagereveal` with a `viewTransition`:

```ts
const from = navigation?.activation?.from?.url ?? document.referrer;
const path = from ? new URL(from).pathname : "";
if (from && new URL(from).origin === location.origin && !path.startsWith("/gmt/")) {
  event.viewTransition.types.add("from-landing");
}
```

`navigation.activation` is preferred. `document.referrer` covers browsers without the
Navigation API; the same-origin referrer carries the path under the default referrer policy.

**From-landing animation.** Under `:active-view-transition-type(from-landing)`:

- `ng-mark`, `ng-wordmark`: no animation. They sit at the same box on both sites (slice 1 matches
  height, padding, mark size and gap), so the swap is invisible.
- `ng-header`: old and new snapshots cross-fade over 240 ms, `ease-out`. That is the right-hand
  controls changing from GitHub and Discord to search, Dox, theme and language.
- `root`: old and new cross-fade over 600 ms, `cubic-bezier(.25, .6, .2, 1)`. The new view is
  live, so the hero's freeze plays under the fade.
- The header freeze does not play (`data-arrival="transition"`, slice 4).

Browsers without cross-document view transitions get a plain navigation; the landing still
freezes in, header included, which is the direct-load look.

## Companion for northguild.dev

northguild.dev lives in another repo. This section is the exact change it needs. It ships as its
own PR in that repo after this one deploys. Until it lands, Dox behaves as a direct load from there.

In its `Base.astro` (global CSS):

```css
@view-transition { navigation: auto; }
.site-header { view-transition-name: ng-header; block-size: 3.5rem; box-sizing: border-box; }
.site-header .ng-mark { view-transition-name: ng-mark; }
.site-header .ng-wordmark { view-transition-name: ng-wordmark; } /* the "NorthGuild" text */

/* Arriving back from /gmt: the bar holds, the page cross-fades. */
::view-transition-group(ng-mark),
::view-transition-group(ng-wordmark),
::view-transition-new(ng-mark),
::view-transition-new(ng-wordmark) { animation: none; }
::view-transition-old(ng-mark),
::view-transition-old(ng-wordmark) { display: none; }
::view-transition-old(ng-header),
::view-transition-new(ng-header) { animation-duration: 240ms; animation-timing-function: ease-out; }
::view-transition-old(root),
::view-transition-new(root) { animation-duration: 600ms;
  animation-timing-function: cubic-bezier(.25, .6, .2, 1); }

@media (prefers-reduced-motion: reduce) {
  @view-transition { navigation: none; }
}
```

In its head, so the bar is parsed before the first frame of the new page:

```html
<link rel="expect" href="#site-header" blocking="render">
```

and `id="site-header"` on the header. On northguild.dev the "NorthGuild" wordmark is a bare
text node inside the home link, so the companion wraps it in `<span class="ng-wordmark">`;
without an element it cannot carry a `view-transition-name`. The span keeps the link's font
(Michroma 1rem, `line-height: 1.6`, `.04em`), so the box does not move.

Optional: skip its `ng-enter-pane` entrance when it arrives through a transition, with the same
`pagereveal` check as `arrival.ts`.

## Constraints

- In-site navigation in Dox is unchanged (`visual-diff` on a guide → guide navigation).
- No name is set on an element that can appear twice on a page; a duplicate name aborts the
  transition.
- The script is inline in `<head>` and registers before the first render; it is a few lines from
  `arrival.ts` through `set:html`, like `CanadaProbeScript.astro`.

## Tests

- `arrival.test.ts`: with a stub `navigation.activation.from` of `/` on the same origin the type
  is added; from `/gmt/guides/x/` it is not; from another origin it is not; with no
  `viewTransition` nothing happens; the referrer fallback works. Each test removes its listener.
- `hero-space` gate, cross-site check: serve a fixture page at the preview origin's `/` (a
  Playwright `page.route` fulfilling `scripts/fixtures/ng-landing.html`, which carries the
  companion CSS above). Click through to `/gmt/`. Assert the new page saw a `viewTransition`
  with the `from-landing` type, and that the mark's and the wordmark's bounding boxes on the
  fixture and on `/gmt/` differ by under 0.5 px in every edge (at 1440×900: mark 16, 14, 21 × 28;
  wordmark 61, 15, 118 × 26).

## Definition of done

- [ ] Index gates pass, plus `hero-space`'s cross-site check in Chromium.
- [ ] In-site navigation looks as before in Chromium and WebKit.
- [ ] `built.md` Tier 3 describes the shared names, the `from-landing` type and the companion
      contract (names and the 3.5rem height).
