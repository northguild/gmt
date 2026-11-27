# Slice 3: search crawlers skip `.md` twins and query states

[Story](./index.md) · repos: `northguild.dev` (robots.txt, deploys first) and gmt (policy check) ·
gate: `robots-policy.test.ts` and `deploy-smoke` robots rows, run on every Dox deploy and daily

## Why

- **The `.md` twins.** About 242 of them sit in "Crawled – currently not indexed". They answer 200
  `text/markdown` with `X-Robots-Tag: noindex` (probed), so Google fetches each one and then drops
  it. Google says not to use noindex to save crawl, because "Google will still request" the URL;
  block it in robots.txt instead (*Crawl budget management*).
- **The permalinks.** 134 permalinks (`?w=…&wa=…` from `encodeWidgetPermalink`, `?tz=…&t=…` from
  the scrubber's `encodeState`) sit in "Alternate page with proper canonical tag". Their canonical
  is right, but Google calls canonical and `nofollow` "generally less effective in the long term"
  for query states and recommends disallowing them in robots.txt (*Managing crawling of faceted
  navigation URLs*).

Together these are about 376 wasted crawls that hold back 331 "Discovered" pages.

## The constraint

AI agents must keep reading the `.md` twins and `llms*.txt` (`ai-input=yes`, `ai-train=yes`). So
only Googlebot and Bingbot get the new rules.

- A crawler that has its own group ignores `*` entirely (RFC 9309 §2.2.1; Google robots spec,
  "Order of precedence for user agents").
- So the new group **repeats every `*` rule and the `Content-Signal` line**. A signal applies only
  to the group it is in (contentsignals.org), and RFC 9309 §2.2.4 lets such a record sit inside a
  group without ending it.
- Applebot follows the `Googlebot` group when robots.txt does not name Applebot (Apple, *About
  Applebot*). Naming Applebot in the `*` group keeps it reading the `.md` twins as before. Quote
  Apple's sentence in the landing PR description (the page answered 429 while this was planned).

## The file: `northguild.dev/apps/site/public/robots.txt`

Build this in a worktree of that repo, `northguild.dev.worktrees/<prefix>559-search-crawler-robots`,
branched from its `origin/main`. Follow that repo's `CLAUDE.md` (fnm, pnpm). The new file, as the
owner approved it, byte for byte:

```text
User-agent: *
User-agent: Applebot
Content-Signal: search=yes, ai-input=yes, ai-train=yes
Allow: /
Disallow: /api/
Disallow: /mcp/
Disallow: /gmt/api/

User-agent: Googlebot
User-agent: Bingbot
Content-Signal: search=yes, ai-input=yes, ai-train=yes
Allow: /
Disallow: /api/
Disallow: /mcp/
Disallow: /gmt/api/
Disallow: /gmt/*.md$
Disallow: /gmt/?
Disallow: /gmt/*/?

Sitemap: https://northguild.dev/sitemap-index.xml
Sitemap: https://northguild.dev/gmt/sitemap-index.xml
Sitemap: https://northguild.dev/worktree/sitemap-index.xml
```

How each new rule matches (RFC 9309 §2.2.2–2.2.3; Google: a rule's pattern also matches the query):

- `/gmt/*.md$` blocks `/gmt/install.md` and `/gmt/reference/…/fn.md`. The `$` anchors it, so
  `/gmt/x.mdx-thing/` is not blocked.
- `/gmt/?` blocks `/gmt/?w=…` on the site root.
- `/gmt/*/?` blocks every page path with a query, such as `/gmt/tools/x/?w=…&wa=…` and
  `/gmt/tools/zone-planner/?tz=…&t=…`. A file with a query, such as `/gmt/_astro/a.png?v=1`, has
  no `/?` and stays allowed.
- The longest match wins over `Allow: /` in every case.

The site is static, so a query never changes the bytes a page serves. That makes one generic rule
correct, and it covers permalinks added later.

Also change the line in the landing repo's `CLAUDE.md` that says to add a line only for a sitemap
or a skipped path. It should say: the `Googlebot`/`Bingbot` group repeats every `*` rule and the
`Content-Signal` line, and a change to one group is made to both.

Do not add a test runner to the landing repo. The policy check lives in gmt (below) and reads the
live file.

## The policy check (gmt)

**Reuse.** `robots-parser` (npm, exact `3.0.1`, released 2023-02-21; 3.1.x is under two weeks old)
answers `isAllowed(url, agent)` and implements groups, `*`, `$` and longest match. Do not write a
matcher by hand ([prefer a tool](../../built/index.md#reuse-never-reinvent)). Add it to
`apps/dox` `devDependencies`. The deploy workflow already runs `pnpm install --frozen-lockfile`
before the smoke.

New files, both under `apps/dox/scripts/`:

- `robots-policy.mjs` (shared, about 120 lines). It exports:
  - `ROBOTS_POLICY`: rows of `{ agent, path, allowed }`, the table below;
  - `checkRobots(text)`: returns `{ value, where }` failures. The `where` reasons are a policy row
    that does not hold, a group without the `*` group's exact `Content-Signal` line, a group that
    lacks one of the `*` group's `Disallow` lines, or a `Content-Signal` without `ai-train=yes`.
  Groups are split per RFC 9309 §2.2.1 (consecutive `User-agent` lines open a group). The
  group checks are a short line scan, because `robots-parser` exposes no groups.
- `robots-policy.test.ts`:
  - the file above passes;
  - each of these fixtures fails with the named reason:
    - `.md` rules in `*`, which cuts off AI agents;
    - the Googlebot group without `Disallow: /api/`;
    - the Googlebot group without `Content-Signal`;
    - `ai-train=no`;
    - Applebot not named, which fails the Applebot `.md` row;
    - `Disallow: /gmt/*?`, which blocks the `?v=` png.
  - The fixtures are strings in the test. No network.

`ROBOTS_POLICY`, with every path under `https://northguild.dev`:

| Path | Googlebot, Bingbot | `*`, ClaudeBot, GPTBot, OAI-SearchBot, PerplexityBot, Applebot |
| --- | --- | --- |
| `/gmt/install.md`, `/gmt/reference/plain/calculate/addDays.md` | blocked | allowed |
| `/gmt/llms.txt`, `/gmt/llms-full.txt` | allowed | allowed |
| `/gmt/tools/zone-planner/?w=planner&wa=x`, `/gmt/tools/zone-planner/?tz=a,b&t=1`, `/gmt/?w=x` | blocked | allowed |
| `/gmt/`, `/gmt/reference/`, `/gmt/reference/plain/calculate/addDays/` | allowed | allowed |
| `/gmt/reference/gnss` (slashless, so slice 1's 308 is crawlable) | allowed | allowed |
| `/gmt/_astro/x.js`, `/gmt/og/x.png?v=1` | allowed | allowed |
| `/gmt/api/chat`, `/api/x`, `/mcp/x` | blocked | blocked |
| `/` and `/worktree/` | allowed | allowed |

**Stop and report.** If `robots-parser@3.0.1` disagrees with the RFC on any row, do not hand-roll a
fix. Typical cases: it ignores the query, or it merges the `*` group into a named group. Stop and
report the row to the main session.

## deploy-smoke (gmt)

- Add a row "robots policy". It sends `send("GET", \`${ND}/robots.txt\`)`, expects 200
  `text/plain`, and passes the body to `checkRobots`. Each failure becomes a smoke failure. The
  row is live-only (skipped under `DOX_SMOKE_LOCAL`).
- Fix the header comment. Row 26-29's robots.txt is now checked here, against the policy in
  `robots-policy.mjs`. Change "Node 22+, no dependencies" to name the one devDependency.
- Keep row "robots.txt" (WD → 301 `${ND}/robots.txt`) as it is.

## What stays

- `_headers` keeps `X-Robots-Tag: noindex` on `/gmt/*.md` and `/gmt/*.txt`, so engines outside
  the group still drop the twins.
- `head-tags.ts` keeps `<link rel="alternate" type="text/markdown">`, which agents find the twins by.
- Permalink links stay plain `<a href>`, because readers share them.

## Order and close-out

1. Landing PR: robots.txt and `CLAUDE.md`, left unstaged until the owner says to commit, push and
   open it. He merges it, and its deploy runs on push to `main`.
   Check `curl -s https://northguild.dev/robots.txt` shows the new group before the gmt PR merges.
2. gmt: `robots-policy.*`, the smoke row, `package.json` and the lockfile.
3. `context/dox/built/tier-0-1-site.md`: replace "robots.txt is served by the landing Worker"
   with that, plus one line: Googlebot and Bingbot have their own group that skips `.md` twins and
   page URLs with a query. Every other agent reads them. `scripts/robots-policy.mjs` holds the
   table, and deploy-smoke checks the live file.
4. `context/dox/cloudflare-runbook.md` §1: one line that robots.txt has two groups, with a link to
   `robots-policy.mjs`.

## Definition of done

- `pnpm --filter dox exec vitest run scripts/robots-policy.test.ts` passes; lint and check are clean.
- `pnpm install --frozen-lockfile` is clean, and `robots-parser` is pinned exactly.
- After both deploys, `node apps/dox/scripts/deploy-smoke.mjs` passes, including the robots row.
