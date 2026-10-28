# S4 — The header says "Give Me Temporal", or "GMT" on narrow screens

Spec: [index.md](index.md) (D14). Needs S2 (the mark and divider sit before the title). Read
[design-system.md § `/dox` and the header](../../../dox/reference/design-system.md) first.

The README already opens "GMT: Give Me Temporal". With the NorthGuild mark and divider in front,
the header reads `[shield] | Give Me Temporal`, like the landing page's "NorthGuild" wordmark.

## 1. `apps/dox/src/components/SiteTitle.astro` (new): a Starlight override

Register it in `astro.config.mjs` under `components` as `SiteTitle: "./src/components/SiteTitle.astro"`.
`Header.astro` keeps importing `virtual:starlight/components/SiteTitle`, so it gets the override
without a change.

```astro
<a href={siteTitleHref} class="site-title sl-flex" translate="no">
  <span class="gmt-title-long">Give Me Temporal</span>
  <span class="gmt-title-short">GMT</span>
</a>
```

- `siteTitleHref` comes from `Astro.locals.starlightRoute`, as in Starlight's own `SiteTitle`.
- Keep the class `site-title`, so the existing `gmt-shell.css` rule (Michroma, 1.25rem, tight
  tracking) and Starlight's `.site-title` layout still apply. Copy Starlight's scoped rules that
  the markup still needs (`align-items`, `color: var(--sl-color-text-accent)`,
  `text-decoration: none`, `white-space: nowrap`, `min-width: 0`, `overflow: hidden` on the
  spans). The project sets no `logo`, so drop the logo branch.
- Starlight's `title` config stays `"@northguild/gmt"`. Every `<title>`, `og:site_name`,
  social card and Markdown twin keeps the package name (D14).
- The header comment says what the override changes and why the config title stays.

## 2. Which form shows

In `gmt-shell.css`, next to `.site-title`:

- Below the switch width, `.gmt-title-long { display: none }`. At and above it,
  `.gmt-title-short { display: none }`. `display: none` removes the hidden form from the
  accessibility tree, so the link's name is exactly the visible text (WCAG 2.2 **SC 2.5.3**
  Label in Name).
- **Measure the switch width; do not guess it.** Build once, then measure `.site-title`
  `scrollWidth <= clientWidth` with the long form forced on at 800, 900, 1024, 1152, 1280 and
  1440 px wide. Use the smallest existing breakpoint (`50rem`, then `72rem`) at which the long
  form fits at every width above it. Add a new breakpoint only if neither works, with a comment
  giving the measured width. Never shrink the font or the tracking to make it fit.
- Print: the long form.

## 3. The home tagline

`apps/dox/src/content/docs/index.mdx`, the `tagline`: drop the leading `Give Me Temporal - `,
so it reads `A Temporal-first date and time library with strict string-in, typed-out contract.
No <code>Date</code>, anywhere.` Grep `apps/dox` for any test, snapshot or generated twin that
quotes the old tagline, and update it.

`scripts/visual-snapshot.mjs` uses `"Give Me Temporal"` as its sentinel (to check that the
server is serving this worktree). After the change, the header carries the text on every page,
so the sentinel still matches. Update the comment above it to say so. Do not change the
sentinel.

## 4. Close-out

`context/dox/reference/design-system.md` § `/dox` and the header: one bullet. The header shows
"Give Me Temporal" from the switch width up and "GMT" below it, in a `SiteTitle` override.
Starlight's `title` stays `@northguild/gmt` for tabs, search results and cards.

## Definition of done (dox-tester runs these literally)

Use one `pnpm --filter @gmt/dox build`. Never build `packages/gmt`. Check in **dark** and
**light** at 1440×900, 1024×768, 800×600, 390×844 and 320×640, on `/gmt/`, `/gmt/install/`, a
reference function page and `/gmt/dox/`.

1. The visible title is "Give Me Temporal" at and above the switch width and "GMT" below it.
   Exactly one of the two spans has a computed `display` other than `none`.
2. Playwright's accessibility snapshot names the title link with the visible form alone.
3. `.site-title` `scrollWidth <= clientWidth` at every width (nothing clipped). The S2 DoD 4
   checks still hold: no horizontal page scroll, and the mark does not touch search or the menu
   toggle.
4. `<title>` on `/gmt/install/` still ends with `@northguild/gmt`, and `og:site_name` is unchanged.
5. The home hero tagline starts with "A Temporal-first", and no page shows "Give Me Temporal -".
6. `pnpm --filter @gmt/dox test`, `check` and `lint` pass. The visual gate re-baselines with the
   new title: judge the header by eye at 1440 and 390 in both themes, and say so in the report.
