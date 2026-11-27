---
story: DOX-G17
issue: 559
status: approved
dox: none
---

# DOX-G17: Search Console's unindexed pages

Search Console (2026-11-23) lists 887 URLs as not indexed and 1,136 as indexed. Most of the 887
are URLs we never want indexed. Google keeps fetching them while 331 real pages wait in
"Discovered – currently not indexed". This story stops Google spending its crawl on those URLs. It
makes the slash redirect permanent and adds a gate for each fix, so no bucket can grow back. Site
work only: there is no tool, no Dox button and no `packages/gmt` change.

## Buckets and what this story does

| GSC reason (count) | What is in it | Cause | Slice |
| --- | --- | --- | --- |
| Crawled – currently not indexed (251) | ~242 `.md` twins, 2 slashless URLs, 6 HTML pages | `.md` twins are crawlable and only `X-Robots-Tag: noindex` keeps them out, so Google still fetches each one | [3](./s3-search-crawlers-skip.md), [4](./s4-triage-and-search-console.md) |
| Alternate page with proper canonical tag (134) | `?w=…&wa=…` and `?tz=…&t=…` permalinks | example links on tool and scenario pages are plain `<a href>`; the canonical tag is correct | [3](./s3-search-crawlers-skip.md) |
| Page with redirect (166) | ~155 slashless pages (307), ~6 renamed pages (301), 2 `?tz=` links, `http://` | slashless page links in our own HTML until DOX-G8 (#488, 2026-11-09); Cloudflare answers them with 307 | [1](./s1-permanent-slash.md), [2](./s2-rendered-links.md) |
| Discovered – currently not indexed (331) | clean sitemap URLs, never fetched | crawl scheduling on a young site, made worse by the URLs above | indirect: 1 and 3 free the crawl |
| Duplicate, Google chose different canonical (3) | `totalDuration`, `operatingIntervals`, `RoundingOptions` | no sibling is a canonical (URL Inspection); the old `gmt-dox.northguild.workers.dev` host and the slashless 307 | [1](./s1-permanent-slash.md), [4](./s4-triage-and-search-console.md) |
| Excluded by noindex (2) | `/gmt/llms-full.txt`, `/gmt/dox/` | intended | none |

**Where the slashless URLs came from (re-verified).** Before `29e8010c` (DOX-G8, 2026-11-09),
992 page links in the built HTML lacked the slash. GSC's oldest crawl dates for these URLs are
10-20 to 10-24. The two named examples, `/reference/gnss` (2026-10-17) and
`/reference/types/TwoDigitYearOptions` (2026-10-10), date from before that fix. The live HTML,
`llms*.txt`, the `.md` bodies, the sampled bundles and `packages/gmt` all link with the slash.
`_redirects` targets all end in `/` (`build-utils/redirects.ts`). One source is still unguarded:
links that a mount renders at run time. Googlebot renders pages and follows those links, and
`pageLinksWithoutSlash` reads only the built HTML. Slice 2 closes that gap.

## Slices

| # | Slice | Repo | Gate that stops the bucket regrowing |
| --- | --- | --- | --- |
| 1 | [One permanent hop to a page; the workers.dev copy is noindex](./s1-permanent-slash.md) | gmt | `worker/index.test.ts`; `dist-base.test.ts`; `deploy-smoke` slash and host rows |
| 2 | [Links a page renders end in a slash](./s2-rendered-links.md) | gmt | new `rendered-links` gate, tier `pr` |
| 3 | [Search crawlers skip `.md` twins and query states](./s3-search-crawlers-skip.md) | northguild.dev **and** gmt | `robots-policy.test.ts`; `deploy-smoke` robots rows (daily) |
| 4 | [Canonical and crawled-not-indexed triage, Search Console steps](./s4-triage-and-search-console.md) | gmt (docs only) | none: owner steps; URL Inspection results recorded |

Order: 1, 2, then 3, then 4. Each slice runs only its own tests, lint and `astro check`. The full
gates ([Run the gates](../../built/tier-6-runbooks.md#run-the-gates)), `pnpm run validate` and
`dox-tester` run once, after slice 4.

**Merge order across repos.** Slice 3's `robots.txt` lives in `northguild/northguild.dev`
(`apps/site/public/robots.txt`), which deploys on every push to its `main`. That PR merges and
deploys **before** the gmt PR. Otherwise the new `deploy-smoke` robots rows fail the Dox deploy.
Slice 3 is built in a `northguild.dev.worktrees/<branch>` worktree, never in the gmt tree.

## Files

| File | Slice | Change |
| --- | --- | --- |
| `apps/dox/worker/index.ts` | 1 | turn the assets binding's trailing-slash 307 into 308; old-host 301 adds the page slash (`withPageSlash`) |
| `apps/dox/worker/index.test.ts` | 1 | 308 rows; missing page stays 404 |
| `apps/dox/src/assets-root/_headers`, `scripts/dist-base.test.ts` | 1 | `noindex` for `https://gmt-dox.northguild.workers.dev/gmt/*`; the test allows that one host |
| `apps/dox/scripts/deploy-smoke.mjs` | 1, 3 | 308 slash rows; workers.dev `noindex` pair; robots row |
| `apps/dox/scripts/lib/page-links.mjs` (new) | 2 | the slash predicate moves here from `dist-base.ts` |
| `apps/dox/scripts/build-utils/dist-base.ts` | 2 | imports the predicate; behaviour unchanged |
| `apps/dox/scripts/rendered-links.mjs` (new) + `gates/registry.mjs` | 2 | the gate |
| `apps/dox/scripts/robots-policy.mjs` (new) + `robots-policy.test.ts` | 3 | the crawler policy table and its checker |
| `apps/dox/package.json`, `pnpm-lock.yaml` | 3 | `robots-parser` `3.0.1`, exact, devDependency |
| `northguild.dev`: `apps/site/public/robots.txt`, `CLAUDE.md` | 3 | the search-crawler group; the rule line |
| `context/dox/built/tier-0-1-site.md`, `cloudflare-runbook.md` | 1, 3, 4 | present-tense rules; Search Console steps |
| `context/dox/specs/index.md` | — | lists this spec while in progress; the finalizer removes the line |

No `packages/` file changes, so the gmt PR carries no changeset. No page's canonical is a sibling
(slice 4 Results), so there is no JSDoc or content fix.

## Authority

| Choice | Source |
| --- | --- |
| A search-crawler group replaces `*` for that crawler, so it repeats every `*` rule | RFC 9309 §2.2.1; Google, *How Google interprets the robots.txt specification* ("Order of precedence for user agents": groups for a named crawler and `*` are not combined) |
| One group may name several crawlers | RFC 9309 §2.2.1 and §2.1 grammar (`startgroupline` repeats) |
| Longest match wins, so `Disallow: /gmt/*.md$` beats `Allow: /` | RFC 9309 §2.2.2 |
| `*` and `$`; a rule's `*` also matches the query (`/*.php` matches `/f.php?parameters`) | RFC 9309 §2.2.3; Google robots spec, "URL matching based on path values" |
| `Content-Signal` sits inside a group and does not end it | RFC 9309 §2.2.4; contentsignals.org (the signal applies to the group it is in) |
| Block crawl with robots.txt, not noindex, when the aim is to save crawls | Google, *Crawl budget management for large sites* ("Don't use noindex, as Google will still request…") |
| Query states of a page: disallow in robots.txt; canonical and `nofollow` are "less effective in the long term" | Google, *Managing crawling of faceted navigation URLs* |
| Applebot follows the `Googlebot` group unless robots.txt names Applebot | Apple, *About Applebot* (support.apple.com/en-us/119829) |
| Bingbot obeys its own group and supports `*` and `$` | Bing Webmaster Guidelines, robots.txt section |
| 307 is temporary, 308 is permanent and keeps the method | RFC 9110 §15.4.8, §15.4.9 |
| 301/308 are a strong canonical signal for the target; 307 is a weak one | Google, *Redirects and Google Search* |
| `_headers` accepts an absolute `https://<host>/…` rule; `X-Robots-Tag: noindex` on a workers.dev host | Cloudflare Workers, *Static assets → Headers* (custom headers, absolute URLs) |
| A page served on a second host is a duplicate; `noindex` keeps it out | Google, *Block Search indexing with noindex* |
| Cloudflare's `auto-trailing-slash` answers `/folder` with 307 only when `/folder/index.html` exists, and the code cannot be set | Cloudflare Workers, *Static assets → HTML handling* |
| Validation, reasons and timing in the Page indexing report | Google Search Console Help, *Page indexing report*; *robots.txt report* (cache up to 24 h) |

## Owner decisions

1. **Crawl block.** The `northguild.dev` robots.txt gains a `Googlebot` + `Bingbot` group that
   repeats every `*` rule and the `Content-Signal` line. It blocks `/gmt/*.md$`, `/gmt/?` and
   `/gmt/*/?`. `Applebot` is named in the `*` group. The exact text is approved and is in
   [slice 3](./s3-search-crawlers-skip.md#the-file-northguilddevappssitepublicrobotstxt).
2. **Keep the existing hints.** Pages keep `<link rel="alternate" type="text/markdown">` and the
   `.md` twins keep `X-Robots-Tag: noindex`.
3. **Slice 2 is in.** The `rendered-links` gate runs at tier `pr` in Chromium.
4. **Parser.** `robots-parser` `3.0.1` is pinned exactly, as a devDependency. If it gets any
   policy row wrong, the builder stops and reports.
5. **Cross-repo order.** dox-builder writes slice 3's robots.txt in a
   `northguild.dev.worktrees/<branch>` worktree. That PR merges and deploys before the gmt PR, and
   the deploy-smoke robots row checks the live file. Nothing is committed, pushed or opened as a PR
   without the owner's word.
6. **The six crawled-not-indexed HTML pages** get no code change. Once slice 3 is live, the
   runbook lists them for Request indexing.
7. **The three canonical pages.** URL Inspection (slice 4 Results) shows no sibling canonical, so
   there is no JSDoc or content fix. The causes are the old workers.dev host and the slashless
   307, both fixed in slice 1, with slice 3 freeing the crawl. After the deploy, the owner inspects
   the three pages again and requests indexing.
8. **Where the slashless URLs came from.** The full "Page with redirect" export puts every crawl
   of a slashless URL between 10-20 and 10-24, before DOX-G8. The generated corpus's slashless
   paths (`functionUrl`, `typePageUrl`) reach no crawlable response. They become `_redirects`
   sources, and the chat's citations pass through `pageHref` (`ask/resolve-href.ts`).

## Definition of done (story)

- Each slice's definition of done holds; the full gates, `pnpm run validate` and `dox-tester`
  are green once, after slice 4.
- Duplication pass: rule 10's size check, and `git grep -n "status: 30[78]"` in
  `apps/dox/scripts` shows the slash expectation in one row helper only.
- `context/dox/built/tier-0-1-site.md` and `cloudflare-runbook.md` describe what is built, in the present tense.
  This spec folder stays until the finalizer folds it.
