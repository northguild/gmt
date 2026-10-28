# S2 — The mark links back to northguild.dev

Spec: [index.md](index.md) (D5–D8). Needs S1. Read
[design-system.md § `/dox` and the header](../../../dox/reference/design-system.md) and the
CORE-86 base rules in [built.md](../../../dox/built.md) (search "dist guard") first.

## 1. `apps/dox/src/lib/site.ts`

Add, under `SITE_URL`:

```ts
/** The organisation landing page, one level above Dox. The header's NorthGuild mark links here. */
export const LANDING_URL = `${SITE_ORIGIN}/`;
```

## 2. `apps/dox/src/components/Header.astro`

Inside `.title-wrapper`, before `<SiteTitle />`:

```astro
<a href={LANDING_URL} class="gmt-ng-link gmt-sonar-focus" title="NorthGuild home">
  <span class="sr-only">NorthGuild home</span>
  <NorthGuildMark />
</a>
<span class="gmt-ng-divider" aria-hidden="true"></span>
<SiteTitle />
```

- A plain `<a>`, not `ButtonLink`. `ButtonLink` treats an absolute URL as external, opens a new
  tab, and draws the icon-chip background. This link is the same site, so it opens in the same
  tab (D7) and has no chip.
- Import `LANDING_URL` from `~/lib/site` (already imported for `withBase`) and `NorthGuildMark`
  from `./NorthGuildMark.astro`.
- `.title-wrapper` becomes a flex row with `align-items: center` and
  `gap: var(--gmt-space-3)`. It keeps its `overflow: clip`, its `0.25rem` padding and its
  negative margin, which give the focus ring room.
- Rewrite the file's top comment to say what it adds over Starlight's header: the NorthGuild
  link and divider before the title, and the Dox button in the right group.

## 3. Styles: `apps/dox/src/styles/gmt-primitives.css`

Next to the S1 mark rules:

```css
.gmt-ng-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  min-inline-size: 1.75rem; /* 28px: the box stays at or above 24x24 (SC 2.5.8) */
  min-block-size: 2rem;
  border-radius: var(--gmt-radius-sm, 0.25rem);
  text-decoration: none;
}
.gmt-ng-divider {
  flex: 0 0 auto;
  block-size: 1.5rem;
  border-inline-end: 1px solid var(--sl-color-gray-5);
}
```

- Check that `--gmt-radius-sm` exists in `gmt-tokens.css`. If it does not, use the radius token
  the icon buttons use. Do not add a literal.
- Hover adds no colour change and no glow: a mark keeps its colours. The focus ring is the
  `.gmt-sonar-focus` ring (2px cyan plus the ping), shaped by `corner-shape: bevel` where the
  browser supports it, as on the icon buttons.
- The divider is a full-height vertical hairline between two items. It is not a card accent, so
  the left-border rule does not apply, and it uses the same token as `.social-icons::after`.

## 4. Forced colours: `apps/dox/src/styles/gmt-a11y.css`

Add `.gmt-ng-link:focus` to the selector list that restores `outline: 2px solid Highlight`
(the list that starts `.gmt-icon-button:focus`). `.gmt-sonar-focus` sets `outline: none`, and
forced colours drop the `box-shadow` ring.

## 5. The dist guard: `apps/dox/scripts/build-utils/dist-base.ts`

The guard fails on every `northguild.dev` URL outside `/gmt`, and the header puts
`https://northguild.dev/` on every page. Add one exact exception, and keep it as narrow as that:

- A module constant `LANDING`, set to `ORIGIN` plus `/`, with a comment: "the header's NorthGuild link
  (#424); equal to `LANDING_URL` in `src/lib/site.ts`". The scanners stay pure, so they do not
  import `site.ts`.
- In `badUrlsInHtml` only: an attribute named `href` on an `<a>` tag whose value is exactly
  `LANDING` is skipped. `judgeUrl` does not change.

Tests in `scripts/build-utils/dist-base.test.ts`:

1. `<a href="https://northguild.dev/">` gives no failure.
2. Each of these still fails: `<a href="https://northguild.dev">` (no slash),
   `<a href="https://northguild.dev/about">`, `<a href="/">`, `<link href="https://northguild.dev/">`,
   `<meta property="og:url" content="https://northguild.dev/">`, a Markdown bare
   `https://northguild.dev/`, and a sitemap `<loc>https://northguild.dev/</loc>`.
3. `LANDING` equals `LANDING_URL` from `src/lib/site.ts`. Export `LANDING` for the test, or
   compare the value through `badUrlsInHtml`.

## 6. A built-output check

Add a case to `scripts/dist-base.test.ts`, or to `scripts/head-tags.test.ts` if it fits better
there. It needs a build, so it returns early without one and throws under `DOX_DIST_REQUIRED`,
like its neighbours. For every built HTML page under `dist/gmt/`, except redirect stubs and the
404 page if the header is absent there, the page has exactly one
`<a … href="https://northguild.dev/" …>`. That anchor contains `NorthGuild home` in a
`.sr-only` span and an `<svg … aria-hidden="true" …>` with five `<path>` elements, and it has no
`target` attribute. Report at most 20 failing pages, then the total, as `report()` does.

## Definition of done (dox-tester runs these literally)

Build once: `pnpm --filter @gmt/dox build` (it reads the existing `packages/gmt/dist`; never
rebuild `packages/gmt`). Serve `apps/dox/dist` the way the gates do. Measure at **1440×900**,
**390×844** and **320×640**, in **dark** and **light**, on `/gmt/`, `/gmt/install/`, the first
function page under `/gmt/reference/` and `/gmt/tools/` (if that path 404s, use the first tool
page in the sidebar).

1. `pnpm --filter @gmt/dox exec vitest run scripts/build-utils/dist-base.test.ts scripts/dist-base.test.ts --reporter=verbose`
   passes with `DOX_DIST_REQUIRED=1`.
2. On each page, width and theme: `document.querySelectorAll('a[href="https://northguild.dev/"]').length === 1`.
   The anchor's accessible name, read from Playwright's accessibility snapshot, is
   `NorthGuild home`, and it has no `target`. **The moved file reaches the built site inlined**
   (D1, D2): the anchor holds an `<svg>` whose five `d` values give the S1 fingerprint.
   `grep -rl 'northguild-logo' apps/dox/dist` prints nothing, and no network request on any
   page names `northguild-logo.svg`. The file has no URL of its own, because a URL would serve
   an `<img>`, which cannot follow the theme.
3. **Target size:** the anchor's `getBoundingClientRect()` is at least 24×24 at every width.
4. **Nothing clipped or overlapping:** the mark's bounding box sits wholly inside the viewport
   and inside `.title-wrapper`'s box. It does not intersect the search button's box or the
   mobile menu toggle's box. `document.documentElement.scrollWidth <= innerWidth` at every width.
   At 1440 and 390, `.site-title`'s `scrollWidth <= clientWidth` (the title text is not
   clipped). At 320 the title may clip only if it already clips on `main`. Measure `main`'s
   build the same way, and say which case applies.
5. **Contrast (SC 1.4.11):** in each theme, screenshot the header and take the rendered
   background pixel 2px outside the mark's bounding box, on its left, top and right, using the
   darkest pixel in dark and the lightest in light. The computed fill of `.gmt-ng-body` and of
   `.gmt-ng-body-lit` is ≥ 3:1 against that pixel (WCAG relative-luminance formula). Report the
   figures.
6. **Keyboard:** from a fresh page load, Tab reaches the mark link before the site title link.
   The focused link shows a visible ring (its `box-shadow` changes). Enter navigates to
   `https://northguild.dev/` in the same tab (assert the request URL; `northguild.dev` itself may be
   unreachable from the test machine). Then run
   `pnpm --filter dox gates --no-build --only a11y-tab-walk,a11y-axe,a11y-media`; it passes with
   no new finding.
7. **Forced colours:** with `forced-colors: active` emulated, the focused link computes
   `outline-style: solid`, and S1 DoD item 7 holds.
8. **Visual:** run `visual-diff`. Every page changes because the header changes, so judge the
   header by eye in all four captures (two themes, two widths) on a long page (a reference
   function page) and on the `/gmt/` home page. Re-baseline, and say so in the report. The left-border
   rule holds: the only new edge is the vertical divider.
9. `pnpm --filter @gmt/dox test`, `check` and `lint` pass. No commit, nothing staged.
