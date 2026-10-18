# CORE-86 — Core: Dox at `northguild.dev/gmt` and the landing page

**Scope:** Move the docs site, unchanged, from `gmt-dox.northguild.workers.dev` to `northguild.dev/gmt`, and put a landing page for the organisation at `northguild.dev` from its own repo. Adds no function and changes no output. The site change is Part A of #317; the landing repo is Part B.

## Gap

The docs site lives on a `workers.dev` hostname that no README, skill or package field should name for long: every link into it becomes a redirect the day the domain goes live. A later Worker needs `northguild.dev/api/*` and `northguild.dev/mcp/*`, and nothing reserves them today. The home page carries a duplicated `<title>`, `robots.txt` carries no content signals, and the repo has no `FUNDING.yml`.

## Scope

- **One origin, products at sub-paths.** `northguild.dev/` is the landing page; `northguild.dev/gmt/…` is Dox. The landing Worker takes the apex as a Custom Domain; the Dox Worker takes `northguild.dev/gmt` and `northguild.dev/gmt/*` as Routes. `www.` redirects to the apex. Every `workers.dev` path redirects to its `northguild.dev/gmt` twin.
- **`apps/dox/src/lib/site.ts`** is the one source of truth: `SITE_ORIGIN`, `SITE_BASE`, `SITE_URL`, `withBase` and `stripBase`, as plain constants so the Worker, the Node scripts and Vitest share them.
- **Routes stay base-less inside the site.** The generators, the route manifest, the corpus `page` and `url` fields and the sidebar slugs do not change. `/gmt` is added only where a URL leaves the code: a rehype plugin for content links, the `.md` twins and `llms*.txt`, the `head` entries, the fetches, the widget permalinks and the path readers.
- **A guard for the bug class.** A test over the built `dist/` fails on any root-absolute URL without `/gmt/` in HTML, CSS, the `.md` twins, `llms*.txt` and `_redirects`.
- **Every link and text** that names the `workers.dev` host moves to `https://northguild.dev/gmt`: both READMEs, `CONTRIBUTING.md`, the package `homepage`, the four skills and the skill spec, the agent prompt, the install and skills pages, the stats and API-surface scripts, and the test origin constants. Old CHANGELOG entries stay.
- **Small fixes in the same PR:** the duplicated home `<title>`; `apps/dox/public/robots.txt` checked in with `Content-Signal` lines; `.github/FUNDING.yml`.
- **Reserved paths.** `northguild.dev/api/*` and `northguild.dev/mcp/*` serve nothing from the landing page but its 404; a separate Worker in its own repo takes them as Routes later. `CORE-88` links that Worker once it is live.
- **The landing repo** (`northguild/northguild.dev`): a CSS-only `@northguild/theme` package carrying Dox's tokens, primitives and font, and an Astro landing page with a product card per repo. Dark only, full-border cards, WCAG AA on `--gmt-void`, phone width with no horizontal scroll.

## Design notes

- **The site moves unchanged.** No page is rewritten, no tool changes, and the homepage stays the globe. A URL change that also changes content cannot be verified against the old site.
- **Static assets never run the Worker.** `run_worker_first` excludes `/gmt/*`, so only the legacy `workers.dev` paths and the bare `/gmt` path run the Worker first. `/gmt/api/*` has no matching asset, so it still reaches the Worker, as `/api/*` does today; every other path under `/gmt/` is served as an asset and costs nothing.
- **`workers_dev` stays on explicitly.** Adding Routes turns it off by default, and every old link would 404 rather than redirect.
- **The two Workers share `localStorage` and cookies.** The Dox dev cookie gets `Path=/gmt/`; a key audit is owed when a second app moves onto the domain.
- **No tool.** The story ships a URL, not a function.

## What gmt provides (do not re-implement)

- The Dox site, its Worker, the route manifest and the redirects generator (`apps/dox/`), all Dox tiers Done
- The `.md` twins and `llms.txt` generators (`apps/dox/src/lib/page-markdown.ts`, `apps/dox/src/pages/llms*.txt.ts`)

## Verification

- `pnpm --filter @gmt/dox test`, `check` and `lint`, and the root `validate` pass.
- After the build, the dist guard passes, and `dist/gmt/index.html` and `dist/_redirects` exist.
- In `wrangler dev`, `localhost:8787/gmt/` renders fonts, favicon, search, the globe, and a chat answer whose links start with `/gmt/`; `/reference/` returns 301 to `https://northguild.dev/gmt/reference/`; `/gmt` goes to `/gmt/`.
- Live: `https://northguild.dev/` is 200; `/gmt` is 301 to `/gmt/`; `/gmt/reference/` is 200; `www.` is 301 to the apex; a `workers.dev` path with a query string is 301 to its `/gmt/` twin with the query kept; `/gmt/llms.txt` lists only `https://northguild.dev/gmt/…` links.
- `grep -rn "gmt-dox.northguild.workers.dev"` finds only the Worker's redirect code, its test, `built.md` and old CHANGELOG entries.
- A patch changeset for `@northguild/gmt` covers the homepage, README and skill links.
