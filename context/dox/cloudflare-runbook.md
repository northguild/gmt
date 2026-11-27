# Cloudflare and GitHub runbook — northguild.dev (the owner's)

The zone, token and search settings that keep `northguild.dev` (the landing Worker) and
`northguild.dev/gmt/` (the `gmt-dox` Worker) working. Use it to audit the zone, rebuild it, or
check a deploy. Each row says where, the value, and why. The Cloudflare dashboard moves settings
between menus; if a path below has moved, type the setting's name into the dashboard's search box.

```sh
# used by the checks below
ND=https://northguild.dev; WD=https://gmt-dox.northguild.workers.dev
h() { curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$@"; }   # status + Location
n() { h -H 'Sec-Fetch-Mode: navigate' -H 'Sec-Fetch-Dest: document' -H 'Accept: text/html' "$@"; }   # as a browser link
```

## 1. Zone settings

Every resource and token lives in the **NorthGuild** account (the account switcher, top left).
The zone opens at `https://dash.cloudflare.com/?to=/:account/:zone/<page>` (e.g. `ssl-tls`) when
the Domains list does not show it.

| Setting | Where | Value | Why |
| --- | --- | --- | --- |
| Nameservers | Overview | `jarred` / `selah.ns.cloudflare.com` | |
| Apex record | DNS → Records | only the one the landing Worker's Custom Domain creates, plus `MX` ×3 (`route1/2/3.mx.cloudflare.net`) and `TXT v=spf1 include:_spf.mx.cloudflare.net ~all` (Email Routing). **No** hand-made `A`/`AAAA`/`CNAME` at `@` | a CNAME at `@` makes the Custom Domain fail; an A/AAAA is overwritten by the CI deploy |
| `www` | DNS → Records, and Rules → Redirect from WWW to root | `AAAA www 100::` **Proxied**; rule `www to apex`: `https://www.*` → `https://${1}`, **301**, query string kept | `100::` is the discard prefix: the record exists only so the request reaches the rule. Deploy past the "may not be proxying" warning |
| SSL/TLS mode | SSL/TLS → Overview | Automatic | Workers answer without an origin, so the mode never applies |
| Always Use HTTPS | SSL/TLS → Edge Certificates | On | `http://` → `https://` |
| Minimum TLS | SSL/TLS → Edge Certificates | 1.2 | |
| Bot Fight Mode | Security → Settings → Bot traffic | **Off** | it challenges scripted clients, including those that fetch `llms.txt` and the `.md` twins, and it cannot be limited to some paths |
| AI crawlers | AI Crawl Control → Security | **Block Crawler** off for every row, the "AI Crawler" category included | matches `ai-train=yes` in `robots.txt`. A switch that is on makes AI Crawl Control add the custom rule "AI Crawl Control - Block AI bots by User Agent", which answers that crawler with 403 whatever `robots.txt` says. Change the switches, never that rule: AI Crawl Control rewrites it. `/api/` and `/mcp/` stay closed by `Disallow` |
| AI bot policies | Security → Settings → Bot traffic → Configure AI bot policies | Search, Agent and Training **Allow (do not block)**; **Enable Bot Preference Sync** off | with Training set to block, Cloudflare blocks training crawlers at the edge whatever `robots.txt` says. Bot Preference Sync prepends Cloudflare's own `Content-signal` and `Disallow` lines to our `robots.txt` |
| Managed robots.txt | search `robots.txt` in the dashboard | **Off** | on, Cloudflare prepends its own lines to our `robots.txt` (the landing repo's file) |
| Email Address Obfuscation | Scrape Shield | Off | it rewrites HTML and adds a `/cdn-cgi/` script. Email Routing is unrelated and keeps working |
| Rocket Loader | Speed → Settings → Content Optimization | Off | it rewrites `<script>` tags and breaks Astro islands |
| Crawler Hints | Caching → Configuration | On | sends IndexNow pings when cached content changes. Nothing in the repo depends on it; switch it off if Bing Webmaster Tools → IndexNow never lists received URLs |
| Web Analytics | Analytics & Logs → Web Analytics | site `northguild.dev`, **JS snippet** setup, automatic injection **off** | the tag is already in `Head.astro`; injection would load the beacon twice |

`robots.txt` has two groups: `*` (with Applebot) and a `Googlebot`/`Bingbot` group that also skips
the `.md` twins and page URLs with a query. The policy is in
[`apps/dox/scripts/robots-policy.mjs`](../../apps/dox/scripts/robots-policy.mjs).

Checks:

```sh
dig +short NS northguild.dev                 # jarred…, selah…
dig +short MX northguild.dev; dig +short TXT northguild.dev   # route1/2/3, v=spf1 …, google-site-verification=…
for ua in GPTBot ClaudeBot CCBot Google-Extended PerplexityBot Bytespider Amazonbot meta-externalagent; do
  printf '%-20s ' $ua; h -A "Mozilla/5.0 (compatible; $ua/1.0)" $ND/gmt/
done                                         # 200 for every one
curl -s $ND/robots.txt                       # our file only, no `# BEGIN Cloudflare Managed content` block
h "https://www.northguild.dev/x?a=1"         # 301 https://northguild.dev/x?a=1
h http://northguild.dev/                     # 301 https://northguild.dev/
curl -s $ND/ | grep -c cdn-cgi               # 0
curl -s $ND/gmt/ | grep -o 'cloudflareinsights[^"]*'   # the beacon, once
```

A crawler that gets 403 shows as a blocked request under Security → Analytics → **Events**, which
names the rule that blocked it.

## 2. API tokens

Both are **Account API Tokens** owned by the NorthGuild account (Manage Account → **Account API
Tokens**), never personal tokens under My Profile. Editing a token keeps its value, so the repo
secret does not change.

- **`gmt-github-deploy`** — the `CLOUDFLARE_API_TOKEN` of `northguild/gmt`. Zone policy (All
  zones in NorthGuild): **Workers Routes Write** and **Zone Read** (wrangler looks the zone up by
  name). No DNS permission: a Route creates no record.
- **`northguild-dev-github-deploy`** — the `CLOUDFLARE_API_TOKEN` of `northguild/northguild.dev`.
  Account policy: the same rows as `gmt-github-deploy`. Zone policy: **Workers Routes Write**,
  **Zone Read** and **DNS Write** (the Custom Domain creates the apex record).

Check each: `curl -s -H "Authorization: Bearer <token>" https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/tokens/verify`
→ `"status":"active"`.

## 3. Deploys

**The landing deploys first.** The Dox Route needs the proxied apex record the landing's Custom
Domain creates, and `northguild.dev/robots.txt` must never be a 5xx (RFC 9309 §2.3.1.4 reads a 5xx
as "disallow everything").

Merging to `main` in this repo runs Release, then **Deploy Dox** (`workflow_run`); Actions → Deploy
Dox → Run workflow also works. Its smoke step (`apps/dox/scripts/deploy-smoke.mjs`) runs the
redirect matrix; a red run means a row failed, and its table names it. Then by hand:

```sh
h $ND/; h $ND/api/x; h $ND/mcp/x   # 200 404 404 (landing)
h $ND/gmt; h "$ND/gmt?a=1"         # 3xx to /gmt/ and /gmt/?a=1
h $ND/gmt/; h $ND/gmt/reference/   # 200 200
h $ND/gmt/reference   # 308 /gmt/reference/
curl -sI $WD/gmt/ | grep -i x-robots   # noindex
h $WD/; h "$WD/tools/dst-inspector/?zone=Europe/Paris"   # 301 $ND/gmt/…, query kept
h -L "$WD/reference/duty/?a=1"     # ends 200 at /gmt/reference/workforce/?a=1
# as a browser follows a link — curl alone can pass while browsers get a 404
n $WD/; n $WD/guides/concepts/dst-disambiguation/   # 301 $ND/gmt/…, never 404
n "$ND/gmt?a=1"; n $ND/gmt/reference/   # 301 /gmt/?a=1; 200
n $ND/gmt/nope/                    # 404, the Dox 404 page
h $WD/robots.txt                   # 301 https://northguild.dev/robots.txt
curl -s -X POST $WD/api/chat -o /dev/null -w '%{http_code}\n'   # 400, never 3xx
curl -s $ND/gmt/llms.txt | grep -c gmt-dox.northguild           # 0
```

Workers & Pages → `gmt-dox` → Settings → Domains & Routes shows `northguild.dev/gmt*` and the
`workers.dev` route enabled; `northguild-site` shows the Custom Domain `northguild.dev`.

**A 301 is permanent in browsers.** Every browser that has followed a `workers.dev` link remembers
the jump to `northguild.dev/gmt/`. Never roll the Worker back to undo a problem: fix forward. A
rollback does not remove the Route, and an older build may lack the `/gmt/` files.

## 4. Search engines and crawler reports

1. **Search Console**, Domain property `northguild.dev` (verified by the
   `google-site-verification` TXT record). Under **Sitemaps** submit
   `https://northguild.dev/gmt/sitemap-index.xml`, and the root `sitemap-index.xml` once it
   exists. Check: status "Success" with a URL count; **Indexing → Pages** shows the not-indexed
   reasons. **URL Inspection** on `/gmt/`, a reference page and `/gmt/install.md` names the
   canonical Google chose.
2. **Bing Webmaster Tools** → **Add site → Import from Google Search Console**, then submit the
   same sitemaps. Check: verified, sitemap processed, indexed-page count shown.
3. **AI Crawl Control** report: per-crawler request counts for the last 30 days. Read-only; the
   switches stay as §1 sets them. Check: counts for GPTBot, OAI-SearchBot, ChatGPT-User,
   ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot, Google-Extended and Bingbot, and no
   blocked requests.
4. **Reindexing steps** after a change to redirects, the `workers.dev` host rule or `robots.txt`
   reaches production:
   1. **robots.txt report** (Settings → robots.txt). Check that it shows the fetch with the
      `Googlebot` group. If the fetch is older, choose "Request a recrawl". Google caches
      robots.txt for up to 24 hours.
   2. **Sitemaps.** Resubmit `https://northguild.dev/gmt/sitemap-index.xml`. In Bing Webmaster
      Tools, resubmit the same sitemap.
   3. **Validate Fix**, per reason, in the Page indexing report: "Duplicate, Google chose
      different canonical than user", "Crawled – currently not indexed", "Discovered – currently
      not indexed" and "Alternate page with proper canonical tag". Do **not** validate "Page with
      redirect" or "Excluded by 'noindex' tag": those URLs stay excluded as intended, and
      validation would only report them as failing.
   4. **URL Inspection → Request indexing** for the pages in the list below, nine requests inside
      the daily quota. The pages under "Crawled – currently not indexed" are substantial, 200,
      self-canonical and in the sitemap, so the report needs no change on the site; Google says
      the state needs no action and can change on a later crawl.

**Pages to inspect again** (URL Inspection → "Google-selected canonical"). Paths are under
`https://northguild.dev/gmt/`.

*Duplicate, Google chose different canonical* (each page has a self canonical, a sitemap entry and
a 200):

| Page | Google-selected canonical | Referring pages | Last crawl | Cause |
| --- | --- | --- | --- | --- |
| `reference/duration/calculate/totalDuration/` | N/A | `gmt-dox.northguild.workers.dev/reference/duration/calculate/totalDuration/`; `/gmt/tools/interval-visualizer/` | 2026-11-17 | the `workers.dev` copy; its `noindex` rule and one hop fix it |
| `reference/calendar/hours/operatingIntervals/` | N/A | `/gmt/reference/zoned/calculate/endOfQuarterForZoned` (no slash, 307); `/gmt/tools/interval-visualizer/` | 2026-11-16 | the slashless 307; the 308 fixes it |
| `reference/types/RoundingOptions/` | `https://gmt-dox.northguild.workers.dev/reference/types/RoundingOptions/` | the old host without the slash; `/gmt/tools/interval-visualizer/` | 2026-11-03 | the old host; one 301 and `noindex` fix it |

The Sitemaps line for `RoundingOptions` reads "Temporary processing error"; step 2 covers it.

*Crawled – currently not indexed*, the six HTML pages:

| Page | Words | Verdict |
| --- | --- | --- |
| `guides/recurrence-and-cron/` | 2,903 | substantial, linked from every sidebar |
| `guides/splitting-and-counting/` | 2,324 | same |
| `guides/workforce-hours-of-work/` | 7,525 | same |
| `guides/mistakes/transport/` | 3,031 | same |
| `guides/durations/` | 2,344 | same |
| `reference/plain/parse/parseMonthFromDateTime/` | 127 | thin, the same shape as about 1,000 indexed generated reference pages |

What "Google-selected canonical" means for those pages:

| Google-selected canonical | Meaning | Action |
| --- | --- | --- |
| the same URL without the slash | the 307 source | Validate Fix after the 308 is live |
| the `.md` twin | the twin outranked the page | none; the `robots.txt` group skips the twins |
| a `?w=` or `?tz=` URL | a permalink outranked the page | none; the `robots.txt` group skips them |
| a `gmt-dox.northguild.workers.dev` URL, or N/A with that host as referring page | the duplicate host | none; inspect again after the host's `noindex` is live |
| the page itself | resolved | none |

**Timeline and shape:**

| When | Expect |
| --- | --- |
| 1 day | the robots.txt report shows the new file |
| 1–2 weeks | about 242 `.md` twins and 134 query URLs move to "Blocked by robots.txt" (expected, no action); validation of the four reasons reports progress |
| 2–4 weeks | the slashless 307 URLs consolidate to their slash pages; "Page with redirect" stops growing (it does not empty: the 301s and `http://` URLs stay) |
| 4–8 weeks | "Discovered – currently not indexed" falls as the freed crawl reaches the 331 pages |

Check the report at 2, 4 and 8 weeks.

**Watch for "Indexed, though blocked by robots.txt".** If a `?w=` or `?tz=` URL or a `.md` twin
appears there, Google is indexing it from links alone. Report it with the URLs. The answer is a
decision about the policy in `robots-policy.mjs`, not a `robots.txt` edit, because unblocking
would undo the block.

## 5. GitHub

- `northguild/gmt` homepage `https://northguild.dev/gmt/`; the org website `https://northguild.dev`
  (`gh repo edit --homepage`, `gh api -X PATCH orgs/northguild -f blog=…`).
- **Sponsors, pending.** When the org's Sponsors listing is approved (github.com/sponsors → Join
  for the org), add `.github/FUNDING.yml` with `github: northguild`. Check first:
  `gh api graphql -f query='{organization(login:"northguild"){hasSponsorsListing}}'` → `true`.

## What never changes here

The Worker name `gmt-dox`; the secrets `NORTHGUILD_GMT_GEMINI_API_KEY`, `DOX_DEV_KEY`,
`CLOUDFLARE_ACCOUNT_ID`; the KV namespace `DOX_USAGE`; the AI binding; the Email Routing records;
HSTS (`.dev` is on the browser preload list, so it is always HTTPS).
