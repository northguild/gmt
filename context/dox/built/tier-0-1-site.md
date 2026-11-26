# Tiers 0–1 · Site, deploy, head tags, changelog

Rules, traps and runbooks for the site shell. Index: [index.md](index.md).

## Workspace and toolchain

- `apps/dox` (`@gmt/dox`, private) extends `astro/tsconfigs/strict`, never `tsconfig.base.json`
  (its `composite`, `emitDeclarationOnly` and `customConditions` are wrong for an app).
- `pnpm` runs scripts on the Node that `devEngines.runtime` pins, whatever is on `PATH`. A bare
  `node` outside pnpm follows the pin only when pnpm installed the global Node. Otherwise use
  `pnpm exec node`, or on `fnm` run `eval "$(fnm env)" && fnm use` first (`fnm use` alone is a
  silent no-op in a non-interactive shell).
- CI matrix jobs install with `--no-runtime` and set `pnpm_config_verify_deps_before_run=false`.
  Without both, a later `pnpm run` reinstalls with the runtime and switches the job to the pinned Node.
- Do not declare Starlight's optional `@astrojs/markdown-remark` peer. `satteri` is pinned through
  `packageExtensions` in `pnpm-workspace.yaml`. `workerd` needs `allowBuilds`.
- `oxlint.config.js` is never loaded, so lint runs from the app. `.oxfmtrc.json` overrides are an
  allow-list that includes `apps/**`.
- pnpm runs `pre`/`post` scripts, but steps that must stay together are still chained with `&&`.

## Deploy

- Worker `gmt-dox` serves `https://northguild.dev/gmt/` through `pnpm exec wrangler deploy`. The
  Worker serves `dist/` through the `ASSETS` binding (`not_found_handling: "404-page"`).
- **Route.** `northguild.dev/gmt*` is one pattern (route matching includes the query string).
  `workers_dev: true` is stated because it defaults to `false` once `routes` is set. The landing
  page `/` is a separate Worker in `northguild/northguild.dev`; a Route beats a Custom Domain.
- **Assets sit under the base.** Astro builds to `dist/gmt/` with `base: "/gmt"`; Cloudflare looks
  assets up by full request path.
- **`run_worker_first: ["/*", "!/gmt/", "!/gmt/*/", "!/gmt/*.*"]`.** A `!` match is served by assets
  even when no file exists, so each negative stays narrow (trailing slash = page, dot = file).
  `/gmt/api/*` has neither and reaches the Worker. A `!/gmt/*` would send it to the 404 page.
- **Worker order** under the base: `?key=` dev exchange, 301 from bare `/gmt` to `/gmt/`,
  `/gmt/api/*`, then `ASSETS`. On the legacy `workers.dev` host every path 301s to
  `northguild.dev/gmt…` except `/api/brains` and `/api/chat` (a redirect turns a POST into a GET).
- **`_redirects` and `_headers`** must sit at the assets root. The generator writes
  `src/generated/_redirects`; `src/assets-root/_headers` is tracked; the `astro:build:done` hook in
  `src/lib/copy-redirects.ts` copies both to `dist/`. Every `_headers` rule sits under `/gmt/`
  (`scripts/dist-base.test.ts`). Cloudflare serves assets before the Worker, so these rules set
  headers: `/gmt/_astro/*` is `immutable` (the test fails on a file there without a content hash);
  `/gmt/*.md` and `/gmt/*.txt` are `X-Robots-Tag: noindex` (the test fails on any `.txt` other than
  `llms.txt` and `llms-full.txt`).
- `scripts/deploy-smoke.mjs` checks the redirect matrix and crawl rows after each deploy.
  `DOX_SMOKE_LOCAL=http://localhost:8787` runs only the crawl rows against `wrangler dev`.
- `robots.txt` is served by the landing Worker. Zone and dashboard setup is in
  [`context/dox/cloudflare-runbook.md`](../cloudflare-runbook.md).
- Web Analytics: the Cloudflare beacon loads from `src/components/Head.astro` in production only.
  Automatic injection stays off, so it is never loaded twice.

## Base `/gmt`

- Routes are base-less inside the site (generators, manifest, corpus `page` and `url`, sidebar
  slugs). `src/lib/site.ts` holds `SITE_ORIGIN`, `SITE_BASE`, `SITE_URL`, `LEGACY_ORIGIN`,
  `withBase`, `stripBase`, `isUnderBase`. `/gmt` is added where a URL leaves the code (rehype
  plugin, `prefixMarkdownLinks`, `llms*.txt`, every `fetch` through `withBase`,
  `encodeWidgetPermalink`) and stripped where code reads a path (`page-context.ts`, `resolve-href.ts`).
- `scripts/dist-base.test.ts` reads the built `dist`: a root URL without `/gmt` anywhere fails CI,
  and `dist/` holds only `gmt/`, `_headers` and `_redirects`. It also fails when any built `.html`
  exceeds 1,048,576 bytes (Apple Messages reads a page only up to 1 MB).
- `CHUNKS_PATH` in `fetch-chunks.ts` is Worker-only code, so `fetch-chunks.test.ts` guards it.
- **Page links end in `/`.** `rehype-base-links` adds the slash to every page link (an `href`
  whose last segment has no dot); file links keep their form. A component that builds an `href`
  uses `pageHref` from `site.ts`. `pageLinksWithoutSlash` and `pageLinksWithoutSlashInMarkdown`
  in `dist-base.ts` fail `test:dist`.
- The NorthGuild mark in the header links to `LANDING_URL`; the dist guard allows exactly that URL.

## Head tags and share cards

- `src/lib/head-tags.ts` (pure) builds head tags; `src/route-data.ts` applies them. `Head.astro`
  does not.
- `<title>` ends ` · GMT`. **No two indexable pages share a description** (Google builds a snippet
  only from a description that is unique). `build-utils/unique-descriptions.ts` qualifies siblings
  by value kind or namespace; a group it cannot split fails the build. `head-tags.test.ts` lists
  duplicates on a built site.
- `og:image` and `twitter:image` end in `?v=<12 hex of the PNG's SHA-256>` (Facebook caches by
  URL). `versionOgImages` runs on `astro:build:done` and is listed **before** `starlight()` in
  `astro.config.mjs`, because hooks run in list order and Pagefind and the dist gates must read
  the final HTML. `og:image:alt` describes the card, never copies the page title.
  `scripts/share-preview.test.ts` checks every indexable page.
- The share card is drawn with CanvasKit (`src/lib/og-art.ts` holds the look). Text sits inside
  x 285-915 (the square a preview app crops to). Nothing is shortened: `renderCard` throws when a
  title fits at no size. The PNG stays under WhatsApp's 300 KB. The Earth artwork is rebuilt by hand
  with `pnpm --filter dox exec tsx scripts/build-og-earth.ts`; it is not part of `generate`.
  `pnpm --filter dox run social-preview` rewrites the images in `apps/dox/assets/share/`; rerun it
  after any change to `og-art.ts` or `og-earth.webp`.
- Every docs page gets one `<link rel="describedby" type="text/plain">` to its namespace
  `llms.txt` (root file elsewhere); the 404 page has none. No page has a `text/plain` alternate.
- The 404 page drops its canonical and gets `noindex` in `route-data.ts`. The sitemap leaves out
  `/dox/` and takes `<lastmod>` from each page's footer `<time>` (never invented).
- **Trap: an untracked page with no `lastUpdated` has no footer date.** Starlight reads the date
  from `git log`; generated MDX is git-ignored, so its frontmatter `lastUpdated` is the only source.
- **Every workflow job that builds Dox uses `fetch-depth: 0`** (a shallow clone gives every page
  one commit date, and the changelog needs tags): `consistency`, `dox-site`, `dox-browser`,
  `dox-gates` in `ci.yml`, `deploy` in `deploy-dox.yml`, `sweep` in `dox-gates-weekly.yml`,
  `oracle` in `temporal-oracle.yml`.
- **Runbook: after a deploy** the owner checks the share card in Facebook Debugger ("Scrape
  Again"), LinkedIn, X, Slack, Discord, WhatsApp (whole title in a square crop) and iMessage for
  `/gmt/`, a guide, a reference page and `/gmt/changelog/`; runs `node apps/dox/scripts/deploy-smoke.mjs`
  against `https://northguild.dev`; and runs `node scripts/web-vitals.mjs --live
  https://northguild.dev` with `PSI_API_KEY`. A failure is a new fix, not a note.

## Changelog pages

- `scripts/build-changelog.mjs` writes gitignored pages from each `packages/*/CHANGELOG.md`; it
  never writes the `CHANGELOG.md` files. A new package with a changelog gets a page, and the
  sidebar test in `changelog.test.ts` fails until the sidebar links it.
- One page per `major.minor` release line, so no page nears 1 MB. The index lists lines; line
  pages are not in the sidebar.
- Scope and date come from release tags (one `git for-each-ref`, `TZ=UTC`). A version under a
  retired scope above a current one fails the build. **Only a package's newest version may lack a
  tag**; any older untagged one fails (`git fetch --tags`).
- The memorial plate for a retired scope needs a current group (the build fails otherwise) and
  `public/burglekitt-logo.png` (`changelog.test.ts` fails if missing; never a stand-in). The blank
  lines inside its `<div>` are required (CommonMark type 6 block).
- Headings are demoted (column-0 `###` to `####`, indented to `#####`); the generator fails on
  headings that slug alike, a stray `## `, or raw HTML outside code. The date is never in a heading.
- Wide call tables use `{ calls: true }` break points in `code-break.ts`. Astro caches rendered
  Markdown in `node_modules/.astro/data-store.json`: delete it after changing a rehype plugin.
- **Every table on the site wraps between words only** (`overflow-wrap: normal`): changelog pages,
  content tables and widget tables alike. `overflow-wrap: anywhere` broke inside words (`tru` /
  `e`, a `Local Date` head one letter a line). A long code value gets its own break points
  instead: `<wbr>` seams from `code-break.ts`, `codeString` and `cellCallArgs`.
- The two content rules *GMT tracks no law* and *International authority first* do not apply to
  the verbatim body; the generated intro and plate follow them.
- `api-surface.mjs` skips `content/docs/changelog/`. `llms-full.txt` and retrieval chunks leave
  changelogs out (old signatures would ground answers in removed APIs); `llms.txt` links only the
  four index pages.

## Sidebar and page order

- `src/lib/section-order.ts` is the one place that sets `START_HERE` and `MIGRATE`; a test fails
  if the config writes the entries out again. Group order: Start here, Guides, API Reference,
  Industries, Tools, Scenarios, Mistakes, Migrate, Checks, Changelog.
- A code frame that opens a tab panel has a square start-start corner; the rule must win by
  position (same specificity as the terminal rule), never `!important`. The `frame-check` gate
  clicks each tab.
- `/why-gmt/` is a normal doc page with plain `##` headings; only the landing uses `splash`.
- `/bundle-size` shows GMT on each of the two polyfills, from `src/generated/bundle-size.json`
  (`scripts/bundle-size.mjs report`). Its `polyfills[]` holds one set per package, found by the
  `shipped` flag, never by index. `src/lib/bundle-size-figures.ts` holds every figure and imports
  only the JSON, so the chart module never reaches the corpus; the page states them as
  `polyfillFigures.<key>`, one `page-expression-values.ts` entry per key, and no package name,
  version or entry name is typed in the module. Chart 1 is each polyfill alone; chart 2 splits
  each single-function import into the polyfill (solid) and GMT's code (hatched), without `root`.
  A function the previous release lacks has no bar and a "not in GMT {version}" cell.
  `PolyfillCompare.astro` is the table and the charts' text alternative; the charts are
  `bundle-size-charts.ts`, joined with `why-gmt-charts.ts` in `bar-charts.ts` through
  `bar-chart-kit.ts`.
