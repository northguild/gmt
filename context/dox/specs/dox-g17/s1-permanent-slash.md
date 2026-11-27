# Slice 1: one permanent hop to a page; the workers.dev copy is noindex

[Story](./index.md) · repo: gmt · gate: `worker/index.test.ts`, `dist-base.test.ts`, `deploy-smoke`
slash, legacy and host rows

## Why

`/gmt/reference/gnss` answers `307 location: /gmt/reference/gnss/` (probed live; the query is kept).
That 307 comes from the assets binding's `auto-trailing-slash` html handling, which always uses 307
(Cloudflare *Static assets → HTML handling*). RFC 9110 §15.4.8 makes 307 temporary. Google treats
a temporary redirect as a weak canonical signal, so the slashless source URL may stay canonical
(*Redirects and Google Search*). That keeps about 155 URLs in "Page with redirect" and is the likely
cause of the three "Google chose different canonical" pages (slice 4). A 308 (RFC 9110 §15.4.9) is
permanent, keeps the method and is a strong signal.

The Worker already sees every slashless request. `run_worker_first` holds `/*` minus `/gmt/`,
`/gmt/*/` and `/gmt/*.*` (`apps/dox/wrangler.jsonc`; `worker/static-routing.test.ts` proves
`/gmt/reference` reaches the Worker). Its last line hands the request to `env.ASSETS.fetch`.

## Change: the 308

`apps/dox/worker/index.ts`, at the last step only:

1. `const res = await env.ASSETS.fetch(request);` The request stays unmodified, as the comment says.
2. Turn `res` into a 308 only when all of these hold:
   - `res.status === 307`;
   - `new URL(res.headers.get("location"), url)` has the same origin as `url`;
   - its pathname is `url.pathname + "/"`;
   - its search is `url.search`.
   Return `new Response(res.body, { status: 308, headers: res.headers })`. The Location is copied
   unchanged; RFC 9110 §10.2.2 allows a relative reference.
3. Return any other response as it is. A 404, a 200 and any other 307 pass through.
4. Put the test in a small named function, `permanentSlash(res, url)`, beside `redirect()`, with one
   JSDoc line that cites RFC 9110 §15.4.9. Rewrite the last-step comment to say that the slash hop
   is made permanent here.

Do not add the slash in the Worker or check whether the page exists. Assets already know whether
`/folder/index.html` exists, so their 307 is the only proof that the page is real. A missing path
keeps its direct 404 (probed: `/gmt/nope` → 404).

## Change: the old host lands in one hop

**Finding (probed 2026-11-27).** `gmt-dox.northguild.workers.dev/reference/types/RoundingOptions`
answers 301 to `northguild.dev/gmt/reference/types/RoundingOptions`, which then answers 307 (308
after this slice). Old links take two hops. Google still keeps that old URL as the page's canonical
(slice 4 Results).

In the not-under-the-base branch (step 1 in the Worker's header comment), wrap the 301 target with
`withPageSlash` from `src/lib/site.ts`. The Worker already imports `SITE_URL` from that module, and
`withPageSlash` is the site's one page-path rule: no dot in the last segment, slash added before the
query. So `redirect(withPageSlash(\`${SITE_URL}${url.pathname}${search}\`))`. Then:

- `/reference/types/RoundingOptions?a=1` → 301 `https://northguild.dev/gmt/reference/types/RoundingOptions/?a=1`;
- `/install.md`, `/llms.txt`, `/robots.txt` and any path with a dot are unchanged. `/robots.txt`
  keeps its own branch;
- the API routes are still served in place before this line, so nothing under the old `/api/`
  changes, and `/gmt/api/` is under the base and never reaches this branch;
- a missing path gets one 301 to its slash URL, then a 404 there, never a chain;
- the `key` filter runs first, as now, so the key is still dropped.

Add one sentence to the header comment's step 1: the 301 adds the page slash, so an old link lands
in one hop.

## Tests: `apps/dox/worker/index.test.ts`

Reuse `fixtureAssets()` and its `assets.calls`. Add a fixture answer that returns 307 with a
relative Location, as the live binding does.

- `/gmt/reference` → 308, `location` `/gmt/reference/`; `assets.calls` holds the request unmodified.
  Update the existing test "hands a page path to the assets binding untouched, base included" to
  this expectation; do not add a second test for the same thing.
- `/gmt/reference/duration/calculate/totalDuration?a=1` → 308, location keeps `?a=1`.
- Body and headers other than the status are the binding's own (check `cache-control` and `location`).
- A 307 whose Location is not the same path plus `/` (another path, another origin, or a query that
  differs) → passed through as 307.
- A missing page → 404 straight from the binding, never 308 (row 21 stays as it is).
- A 200 from the binding is passed through unchanged.
- Legacy host: `/reference/types/RoundingOptions?a=1` → one 301 to
  `${SITE_URL}/reference/types/RoundingOptions/?a=1`. `/reference?key=k&a=1` → 301 to
  `${SITE_URL}/reference/?a=1`. `/install.md` → 301 to `${SITE_URL}/install.md` (no slash). Update
  the existing legacy-redirect rows that expect a slashless target; do not duplicate them.

No timers or listeners start, so no teardown is needed. The tests never touch the network
([rule](../../built/index.md)).

## Tests: `apps/dox/scripts/deploy-smoke.mjs`

- Row "6" becomes one hop: `WD/reference` → `301 ${ND}/gmt/reference/` → `200`.
- New row "6a": `${ND}/gmt/reference` → `308 ${ND}/gmt/reference/` → `200`.
- Row "36 /gmt/nope": keep the optional first step, but as `status: 308`. That hop exists only if
  assets ever answers a missing folder with a slash redirect. A 307 there must now fail.
- New row "6b": a slashless function page with a query. Take the first `/gmt/reference/<ns>/<module>/<fn>/`
  URL from the live sitemap: the script already requests `${ND}/gmt/sitemap-index.xml` (row near
  line 850). Follow its first `<loc>` to the child sitemap with one small `firstSitemapUrl(re)`
  helper built on `send()`. Request it without the slash and with
  `?a=1`, and expect `308` to the slash URL with `?a=1`, then `200`. Never hard-code a function name,
  because pages get renamed.
- New row "6d": the same sitemap page on the old host without `/gmt`, without its slash and with
  `?a=1` → exactly one `301` whose Location ends in `/?a=1`, then `200`. The existing `hop` rows
  for `WD/install.md` and `WD/llms.txt` stay, and they prove a file path keeps its form.
- Write the 308 rows (6a, 6b) with one helper, `slashHop(rows, label, url)`, so the expected status sits in
  one place. The story's duplication grep relies on that.
- `DOX_SMOKE_LOCAL`: run `wrangler dev` on the built `dist` once and check whether
  `/gmt/reference` answers 307 or 308 there. If it does, add rows "6a" and "6b" to the local crawl rows. If
  `wrangler dev` does not reproduce the binding's 307, leave the row live-only, and say why in the
  header comment.

## The workers.dev host: `noindex`

**Finding (probed 2026-11-27).** `https://gmt-dox.northguild.workers.dev/gmt/<page>/` answers 200
with the full page and no `X-Robots-Tag`. `run_worker_first` leaves out `/gmt/*/`, so the assets
binding serves the page on every host. The page's canonical points to `northguild.dev`, but the
copy is still crawlable and indexable. URL Inspection for `…/totalDuration/` names this copy as the
referring page. The paths without `/gmt` on that host answer 301 to `northguild.dev/gmt/…`
(CORE-86) and stay as they are, so `workers_dev: true` stays.

**Change.** Add one rule to `apps/dox/src/assets-root/_headers`, with a comment saying it keeps
the old host out of search results:

```text
https://gmt-dox.northguild.workers.dev/gmt/*
  X-Robots-Tag: noindex
```

Cloudflare's `_headers` accepts an absolute `https` URL, matched by host. Its own example is
`https://myworker.mysubdomain.workers.dev/*` with `X-Robots-Tag: noindex` (Workers *Static assets →
Headers*). The rule names the host literally, because this Worker has one name and no preview URLs.
The path stays `/gmt/*`: only assets answer there, and the rule then fits the house rule that every
`_headers` rule sits under `/gmt/`. A `.md` or `.txt` file on that host gets both rules. Cloudflare
joins the values, so the header reads `noindex, noindex`, which is harmless.

**Tests.**

- `apps/dox/scripts/dist-base.test.ts`, "every _headers rule sits under /gmt/": strip an optional
  `https://gmt-dox.northguild.workers.dev` prefix before the check, and allow no other host. Add
  one case asserting that this host rule is present.
- `deploy-smoke.mjs`: a live-only row pair, built on the page `firstSitemapUrl` returns:
  - "6c workers.dev noindex": `WD/gmt/<page>/` answers 200 with an `x-robots-tag` that holds
    `noindex`;
  - "6c canonical host": `ND/gmt/<page>/` answers 200 with no `x-robots-tag`.
  `wrangler dev` serves on `localhost`, where the host rule cannot match, so both rows are skipped
  under `DOX_SMOKE_LOCAL`.

## Traps

- Do not read `res.url`. It is the asset URL, not the Location.
- A `Response` from the binding may have immutable headers. Pass `res.headers` into the new
  `Response` and never mutate them.
- `HEAD` must behave like `GET`, so add a test with `HEAD /gmt/reference` → 308.
- The workers.dev host (`WD`) answers `301` to `ND` with the slash already added, so a 308 only
  happens on `ND`. Rows 6 and 6d prove the old host never chains.

## Close-out (in this slice)

- `context/dox/built/tier-0-1-site.md`, Deploy section: add one line in the present tense. A page
  path without its slash answers 308 to the slash URL, query kept. The Worker upgrades the assets
  binding's 307 because a permanent redirect is the canonical signal Google honours (RFC 9110
  §15.4.9). An old `workers.dev` path is one 301 to the page URL with its slash (`withPageSlash`).
- Same section: the workers.dev host serves its `/gmt/` pages with `X-Robots-Tag: noindex`
  (a host rule in `_headers`), because assets answer them there too and only `northguild.dev` may
  be indexed. The host stays on for the CORE-86 301s.
- `context/dox/cloudflare-runbook.md` §3: add `h $ND/gmt/reference   # 308 /gmt/reference/` beside
  the existing `$ND/gmt` lines, plus `curl -sI $WD/gmt/ | grep -i x-robots   # noindex`.

## Definition of done

- `pnpm --filter dox exec vitest run worker/` passes; `pnpm --filter dox lint` and `check` are clean.
- `git grep -n "status: 307" apps/dox/scripts/deploy-smoke.mjs` prints nothing.
- `pnpm --filter dox exec vitest run scripts/dist-base.test.ts` passes after a build.
- After the deploy, `node apps/dox/scripts/deploy-smoke.mjs` passes against production. The
  deploy workflow runs it, and so does the daily schedule.
