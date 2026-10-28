---
story: 424
issue: 424
status: approved
dox: none
---

# #424 — A way back to northguild.dev, the NorthGuild mark, one header

## Scope

Issue [#424](https://github.com/northguild/gmt/issues/424). Dox (`apps/dox`, served at
`northguild.dev/gmt/`) gets three things, and nothing in `packages/gmt` changes:

1. **A link back to `https://northguild.dev/`** on every page, in the site header.
2. **The NorthGuild mark** (the shield the owner left at the repo root as
   `northguild-logo.svg`) is that link. Its shapes stay exactly as drawn; its four blues are
   replaced by Dox palette colours that hold contrast in the dark and light themes.
3. **One header.** `/dox` stops hiding the site header and shows the same one as every other
   page. Its own strip keeps only the live clock and the Live/Local badge.
4. **The header names the library "Give Me Temporal"** ("GMT" on narrow screens), after the mark.

No library change, so no changeset (`apps/dox` is private). No tracker row: the work is the issue
alone. No new tool, so no chat pill. React stays inside `/dox`.

**The meaning of "headers on dox vs the gmt site"** (D13). The issue's first
sentence calls the docs site "gmt" ("navigate to the northguild.dev site within gmt"). So "the
gmt site" is the docs pages, whose header is `Header.astro`, and "dox" is the `/dox` chat page.
That page hides the site header and draws its own strip in React (`DoxPage.tsx`: `← @northguild/gmt`,
a clock, a badge). This spec unifies those two.

**Out of scope:** the `northguild.dev` landing page and its header (repo `northguild/northguild.dev`).
This story only links to it.

## Files

| Slice | Files |
| --- | --- |
| [S1](s1-mark-asset-and-tokens.md) | move `northguild-logo.svg` → `apps/dox/src/assets/northguild-logo.svg` (edit fills to classes); new `apps/dox/src/components/NorthGuildMark.astro` and `NorthGuildMark.test.ts`; `src/styles/gmt-tokens.css`, `gmt-primitives.css`, `gmt-a11y.css` |
| [S2](s2-header-link.md) | `src/lib/site.ts` (`LANDING_URL`), `src/components/Header.astro`, `gmt-primitives.css`, `gmt-a11y.css`, `scripts/build-utils/dist-base.ts` and `dist-base.test.ts` |
| [S3](s3-dox-shared-header.md) | `src/pages/dox.astro`, `src/components/ask/DoxPage.tsx`, `src/styles/gmt-hive.css`, `Header.astro` (`aria-current`), `gmt-primitives.css`; close-out in `context/dox/built.md`, `reference/design-system.md`, `reference/visual-design.md`, `ui-audit.md` |
| [S4](s4-header-name.md) | new `src/components/SiteTitle.astro` (Starlight override), `astro.config.mjs`, `gmt-shell.css`, `src/content/docs/index.mdx` (tagline), `scripts/visual-snapshot.mjs` (comment); close-out in `reference/design-system.md` |

## Decisions

| # | Decision | Why, and the authority |
| --- | --- | --- |
| D1 | **The mark is inlined, not served as a file.** `NorthGuildMark.astro` imports the SVG as an Astro SVG component (Astro 7.4.2 inlines an imported `.svg`), and CSS gives each path its fill from `--gmt-logo-*` tokens. | An SVG loaded through `<img>` or `background-image` is a separate document: page CSS and custom properties do not reach it, so it cannot follow the site's theme switch (`data-theme`, chosen by the reader), only `prefers-color-scheme`. Inline SVG takes page CSS (SVG 2 §6 Styling). `DoxMark.astro` already works this way. |
| D2 | **The file lives at `apps/dox/src/assets/northguild-logo.svg`**, and no copy stays at the repo root. | Vite resolves the import from the app's source tree, and `src/assets/` is Astro's folder for imported assets (`src/assets/og-fonts/` is already there). Under `apps/dox` the file also falls under `apps/LICENSE`. It is never served on its own URL, because D1 inlines it. |
| D3 | **Only the colours change.** The five `d` strings and the `viewBox` stay byte for byte (SHA-256 in S1). `fill="#…"` becomes `class="gmt-ng-*"`, and the root `role="img"` / `aria-label` are removed. | The link names itself (D6), so the mark is `aria-hidden`. A second name would be read twice. |
| D4 | **Theme colours, from the palette** (`reference/visual-design.md` § Colour). The field `#22d3ee` (Cyan), lit field `#67e8f9`, and glyphs `#ffffff` are the same in both themes. The body changes per theme. Dark: body `#0e7490` (Teal), lit body `#107e99` (Teal mixed with 10% Cyan). Light: body `#045268` (light `--gmt-cyan-ink`), lit body `#0e7490`. | Measured in S1: the shield's outer parts reach ≥ 3.30:1 against the darkest dark header surface and ≥ 4.54:1 in light (WCAG 2.2 **SC 1.4.11**, 3:1 for the graphic that identifies a control). The glyphs reach ≥ 4.70:1 on the parts behind them. The original blues fail 1.4.11 in dark (body 1.90:1). |
| D5 | **The mark is its own link, left of the site title,** with a hairline divider between them. The title still links to `/gmt/`. | One link, one destination (WCAG 2.2 **SC 2.4.4** Link Purpose). Starlight's `logo` option would put the mark inside the title link to `/gmt/`, so it is not used. |
| D6 | **Accessible name "NorthGuild home"**, as Starlight's `.sr-only` text inside the `<a>`, plus a matching `title`. The SVG is `aria-hidden="true"` and `focusable="false"`. | WCAG **SC 4.1.2** (name), **SC 2.4.4**. Same pattern as the "Chat with Dox" button. |
| D7 | **Same tab, absolute URL `https://northguild.dev/`** (`LANDING_URL` in `site.ts`). | It is the same site, one level up, so it is not an external link. A root-relative `/` would fail the `/gmt` dist guard. The guard allows exactly this URL in an `<a href>` and nowhere else (S2). |
| D8 | **Target and focus.** The link box is at least 24×24 CSS px and focus uses `.gmt-sonar-focus`. In forced colours the link gets a real `Highlight` outline. | WCAG **SC 2.5.8** Target Size (Minimum), **SC 2.4.7** Focus Visible, **SC 2.4.11** Focus Not Obscured. Forced colours drop `box-shadow` (design-system.md). |
| D9 | **Forced colours:** body paths `LinkText`, field paths and glyphs `Canvas`, `forced-color-adjust: none` on the SVG. | The shield, its peaks and `</>` stay visible in every system palette without relying on how a browser forces `fill`. |
| D10 | **`/dox` renders the site header.** Remove the `.header { display: none }` override and start the fixed hive shell at `top: var(--sl-nav-height)`. | WCAG **SC 3.2.3** Consistent Navigation: navigation repeated across a set of pages appears in the same relative order. `/dox` is the one page without it. The header is Astro with no JS, so no React reaches another page. |
| D11 | **The `/dox` strip keeps the clock and the badge, and drops its back link.** It becomes a `<div>`, not a `<header>`, and its items sit at the end. | The site header now gives the way back. There is one banner landmark per page (WAI-ARIA APG, Landmark Regions). The clock and badge are chat status, so they stay with the chat (design-system.md § The composer control bar). |
| D12 | **The header's Dox button carries `aria-current="page"` on `/dox`**, shown by a 2px bottom border, never a left one. | WAI-ARIA 1.2 `aria-current`: the header now appears on the page it links to. WCAG **SC 1.4.1**: the state is not colour alone. |
| D13 | **"Dox" and "the gmt site" are the `/dox` chat strip and the docs header.** The landing page header is out of scope. | The issue calls the docs site "gmt" in its first sentence, and `/dox` is the one page of that site with a header of its own. |
| D14 | **The header title reads "Give Me Temporal", or "GMT" below a measured width.** Only the visible header changes: Starlight's `title` stays `@northguild/gmt`, and the home tagline drops its "Give Me Temporal - " prefix. | The README opens "GMT: Give Me Temporal", and after the mark the title reads as a wordmark. The package name stays in `<title>` and cards, because that is the name people search for and install. Only one form is displayed at a time, so the link's name is the visible text (WCAG 2.2 SC 2.5.3). The owner chose all three. |

## Slices

Run in order. S3 and S4 need S2's header.

| Slice | File | Delivers |
| --- | --- | --- |
| S1 | [s1-mark-asset-and-tokens.md](s1-mark-asset-and-tokens.md) | The SVG moved into `apps/dox`, recoloured by class; `NorthGuildMark.astro`; the `--gmt-logo-*` tokens; the forced-colours rule; contrast proof |
| S2 | [s2-header-link.md](s2-header-link.md) | The mark as a same-tab link to `northguild.dev` on every page; the dist-guard exception |
| S3 | [s3-dox-shared-header.md](s3-dox-shared-header.md) | `/dox` shows the shared header; the strip slims down; close-out of the Dox docs |
| S4 | [s4-header-name.md](s4-header-name.md) | The header title "Give Me Temporal" / "GMT"; the home tagline without the prefix |

## Traps that apply

- `Header.astro` imports Starlight parts through `virtual:starlight/components/*`, never
  `@astrojs/starlight/components/*.astro` (design-system.md § `/dox` and the header).
- Astro scoped `<style>` does not reach the paths inside an imported SVG component. The fills
  go in `gmt-primitives.css`, which is global, where `.gmt-dox-mark` already lives.
- The dist guard (`scripts/dist-base.test.ts`) fails on any `northguild.dev` URL outside `/gmt`.
  S2 adds one exact exception. Do not loosen `judgeUrl`.
- The owner's `pnpm dox:dev` reads `packages/gmt/dist`. Never run a `packages/gmt` build. A
  single `pnpm --filter @gmt/dox build` near the end is enough for the gates.
- The visual gate changes on every page, because the header is on every page. Re-baseline, say
  so, and judge the header by eye on a long page as well as the captures. Never loosen the threshold.
- Leave every change unstaged. No commit, no branch, no push.
