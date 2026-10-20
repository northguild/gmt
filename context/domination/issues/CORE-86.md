# CORE-86 — Core: Dox at `northguild.dev/gmt` and the landing page

**Scope:** Move the docs site, unchanged, from `gmt-dox.northguild.workers.dev` to `northguild.dev/gmt`, and put a landing page for the organisation at `northguild.dev` from its own repo. Adds no function and changes no output. The site change is Part A of #317; the landing repo is Part B.

## Gap

The docs site lives on a `workers.dev` hostname that no README, skill or package field should name for long: every link into it becomes a redirect the day the domain goes live. A later Worker needs `northguild.dev/api/*` and `northguild.dev/mcp/*`, and nothing reserves them today. The home page carries a duplicated `<title>`, `robots.txt` carries no content signals, and the repo has no `FUNDING.yml`.

## Scope

- **One origin, products at sub-paths.** `northguild.dev/` is the landing page; `northguild.dev/gmt/…` is Dox. The landing Worker takes the apex as a Custom Domain; the Dox Worker takes `northguild.dev/gmt*` as one Route. `www.` redirects to the apex. Every `workers.dev` path redirects to its `northguild.dev/gmt` twin.
- **`apps/dox/src/lib/site.ts`** is the one source of truth: `SITE_ORIGIN`, `SITE_BASE`, `SITE_URL`, `withBase` and `stripBase`, as plain constants so the Worker, the Node scripts and Vitest share them.
- **Routes stay base-less inside the site.** The generators, the route manifest, the corpus `page` and `url` fields and the sidebar slugs do not change. `/gmt` is added only where a URL leaves the code: a rehype plugin for content links, the `.md` twins and `llms*.txt`, the `head` entries, the fetches, the widget permalinks and the path readers.
- **A guard for the bug class.** A test over the built `dist/` fails on any root-absolute URL without `/gmt/` in HTML, CSS, the `.md` twins, `llms*.txt` and `_redirects`.
- **Every link and text** that names the `workers.dev` host moves to `https://northguild.dev/gmt`: both READMEs, `CONTRIBUTING.md`, the package `homepage`, the eight skills that name the host and the skill spec, the agent prompt, the install and skills pages, the stats and API-surface scripts, and the test origin constants. Old CHANGELOG entries stay.
- **Small fixes in the same PR:** the duplicated home `<title>` (D9). `robots.txt` lives in the landing repo (D7); `.github/FUNDING.yml` waits for a Sponsors listing (D11).
- **Reserved paths.** `northguild.dev/api/*` and `northguild.dev/mcp/*` serve nothing from the landing page but its 404; a separate Worker in its own repo takes them as Routes later. `CORE-88` links that Worker once it is live.
- **The landing repo** (`northguild/northguild.dev`): a CSS-only `@northguild/theme` package carrying Dox's tokens, primitives and font, and an Astro landing page with a product card per repo. Dark only, full-border cards, WCAG AA on `--gmt-void`, phone width with no horizontal scroll.

## Design notes

- **The site moves unchanged.** No page is rewritten, no tool changes, and the homepage stays the globe. A URL change that also changes content cannot be verified against the old site.
- **Static assets never run the Worker.** `run_worker_first` sends page URLs and files under `/gmt/` to assets (D3), so only the legacy `workers.dev` paths, bare `/gmt`, `/gmt/api/*` and a page path without its slash run the Worker. Every other path under `/gmt/` is served as an asset and costs nothing.
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
- `grep -rn "gmt-dox.northguild.workers.dev"` finds the host only where it is named on purpose: `LEGACY_ORIGIN` in `site.ts` and the Worker tests, `deploy-smoke.mjs`, the `dist` guard and its test, the legacy-host guard in `api-surface.mjs`, the changeset, this file and its runbook, and old CHANGELOG entries.
- A patch changeset for `@northguild/gmt` covers the homepage, README and skill links.

## Decisions

- **D1: One Dox route, `northguild.dev/gmt*`.** Route matching includes the query string, so a
  `northguild.dev/gmt` route misses `/gmt?a=1`. `gmt*` covers `/gmt`, `/gmt?...` and `/gmt/...`; it also
  catches `/gmtx`, which the Worker sends to `/gmt/gmtx` (the Dox 404).
- **D2: `workers_dev: true` is stated.** With `routes` set it defaults to `false`.
- **D3: `"run_worker_first": ["/*", "!/gmt/", "!/gmt/*/", "!/gmt/*.*"]`.** `compatibility_date`
  2026-08-26 turns on `assets_navigation_prefers_asset_serving`: a navigation that matches no asset
  gets `not_found_handling` and never runs the Worker, so a browser following an old link would get
  the 404 page while `curl` gets the 301. An array opts out of that. A path matching a `!` rule goes
  to assets even when no asset exists, and negatives win, so `!/gmt/*` would send `/gmt/api/*` to the
  404 page. The three negatives cover only page URLs (`/gmt/`, a trailing slash) and files (a dot
  after `/gmt/`). Rules match the pathname only; `*` is `.*`, anchored.
- **D4: Legacy `/api/brains` and `/api/chat` are served in place on `workers.dev`, never
  redirected.** A 301 turns a `fetch` POST into a GET, and the hop is cross-origin with no CORS, so a
  tab opened before the deploy would lose its chat. Every other legacy path is a 301. `?key=` is
  honoured only under the base, ahead of the bare-`/gmt` 301, and the legacy 301 drops `key`, so
  the secret never reaches a page URL that assets serve.
- **D5: An old `_redirects` source on `workers.dev` takes two 301s** (Worker to
  `northguild.dev/gmt/<old>`, then `_redirects` to the new page). `_redirects` keeps the query string
  and emits a relative `Location`. No one-hop map is bundled into the Worker.
- **D6: `_redirects` is written to `dist/_redirects`.** Astro copies `public/` into `outDir`
  (`dist/gmt/`), where Cloudflare never reads it. The generator writes `src/generated/_redirects` and
  an `astro:build:done` hook copies it to the parent of `outDir`.
- **D7: `robots.txt` belongs to the landing repo.** Crawlers read only `/robots.txt` at the host
  root. The Dox Worker sends legacy `/robots.txt` to `https://northguild.dev/robots.txt`.
- **D8: The landing page deploys before the Dox change merges.** Merging to `main` deploys Dox on its
  own (`deploy-dox.yml` runs on `workflow_run` after Release).
- **D9: The home `<title>` is fixed in `index.mdx` front matter** (`head: [{ tag: title, ... }]`).
  The hero text is unchanged.
- **D10: Two API tokens.** Dox's token has Zone Read and Workers Routes Write on zone
  `northguild.dev`; the landing repo has its own token, the only one with DNS Write.
- **D11: `.github/FUNDING.yml` is not added yet.** Neither `northguild` nor `craig-o-curtis` has a
  GitHub Sponsors listing, so `github: northguild` would render a Sponsor button onto a page that
  does not exist.

## Runbook

[Cloudflare and GitHub steps](CORE-86/runbook.md): the owner's zone, token, landing, deploy-order, Web Analytics, repo-link, Search Console and Sponsors steps, each with its check.
