# CORE-86 runbook — Cloudflare and GitHub steps (the owner's)

[CORE-86](../CORE-86.md) (Decisions D7, D8, D10, D11). Done by the owner, in this order. Each step says where,
the exact value, and a check. The Cloudflare dashboard moves settings between menus; if a path
below has moved, type the setting's name into the dashboard's search box.

§0–§4 are done. §5 onward runs when the Dox change merges.

```sh
# used by the checks below
ND=https://northguild.dev; WD=https://gmt-dox.northguild.workers.dev
h() { curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$@"; }   # status + Location
n() { h -H 'Sec-Fetch-Mode: navigate' -H 'Sec-Fetch-Dest: document' -H 'Accept: text/html' "$@"; }   # as a browser link
```

## 0. Zone checks (before anything deploys)

Every resource and token lives in the **NorthGuild** account (the account switcher, top left).
The zone opens at `https://dash.cloudflare.com/?to=/:account/:zone/<page>` (e.g. `ssl-tls`) when
the Domains list does not show it.

| Setting | Where | Value | Why |
| --- | --- | --- | --- |
| Nameservers | Overview | `jarred` / `selah.ns.cloudflare.com` — no change | |
| Apex and `www` records | DNS → Records | **only** `MX` ×3 (`route1/2/3.mx.cloudflare.net`) and `TXT v=spf1 include:_spf.mx.cloudflare.net ~all`; keep them (Email Routing). **No** `A`/`AAAA`/`CNAME` at `@` or `www` | a CNAME at `@` makes the Custom Domain fail; an A/AAAA is overwritten by the CI deploy |
| SSL/TLS mode | SSL/TLS → Overview | Automatic — no change | Workers answer without an origin, so the mode never applies |
| Always Use HTTPS | SSL/TLS → Edge Certificates | On | `http://` → `https://` |
| Minimum TLS | SSL/TLS → Edge Certificates | 1.2 | |
| Bot Fight Mode | Security → Bots | **Off** | it challenges scripted clients, including those that fetch `llms.txt` and the `.md` twins, and it cannot be limited to some paths |
| AI crawlers | AI Crawl Control → Crawlers | **Block** each crawler in the "AI Crawler" category (GPTBot, CCBot, ClaudeBot, Google-Extended, …) one row at a time, **except Claude-User**; every search engine, AI search and AI assistant crawler stays allowed | matches `ai-train=no` in `robots.txt` for crawlers that ignore it. The category policy "Training: Block" is **not** used: it also blocks Googlebot and Claude-User. Recheck the list every few months; Cloudflare adds crawlers |
| Managed robots.txt / Bot Preference Sync | AI Crawl Control → Robots.txt | **Off** | on, Cloudflare prepends its own `Content-signal` and `Disallow` lines to our `robots.txt`. The commented preamble seen today is Cloudflare's default for a host that has no `robots.txt`; our file (landing repo) replaces it |
| Email Address Obfuscation | Scrape Shield (search the setting name) | Off | it rewrites HTML and adds a `/cdn-cgi/` script. It is unrelated to Email Routing, which keeps working |
| Rocket Loader | Speed → Settings → Content Optimization | Off | it rewrites `<script>` tags and breaks Astro islands |

Checks:

```sh
dig +short NS northguild.dev                 # jarred…, selah…
dig +short northguild.dev A; dig +short northguild.dev AAAA; dig +short northguild.dev CNAME  # all empty today
dig +short www.northguild.dev                # empty today
dig +short MX northguild.dev; dig +short TXT northguild.dev   # route1/2/3, v=spf1 …
```

## 1. API tokens

Both are **Account API Tokens** owned by the NorthGuild account (Manage Account → **Account API
Tokens**), not personal tokens under My Profile.

- **Dox token** — `gmt-github-deploy`, the `CLOUDFLARE_API_TOKEN` of `northguild/gmt`. Its zone
  policy (All zones in NorthGuild) holds **Workers Routes Write** and **Zone Read** (wrangler looks
  the zone up by name). No DNS permission: a Route creates no record. Editing a token keeps its
  value, so the secret does not change.
- **Landing token** — **Create Token**, name `northguild-dev-github-deploy`. Account policy: the
  same rows as `gmt-github-deploy`. Zone policy (All zones in NorthGuild): **Workers Routes
  Write**, **Zone Read** and **DNS Write** (the Custom Domain creates the apex record).

Check each: `curl -s -H "Authorization: Bearer <token>" https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/tokens/verify`
→ `"status":"active"`.

## 2. Landing repo

- GitHub → New repository → owner `northguild`, name `northguild.dev`, public, no template.
  Clone it to `/Users/craigcurtis/workbench/northguild/northguild.dev` if you want `dox-builder` to
  write straight into the clone (the landing repo's work).
- Settings → Secrets and variables → Actions → **New repository secret**:
  `CLOUDFLARE_API_TOKEN` = the landing token; `CLOUDFLARE_ACCOUNT_ID` = the same account ID gmt uses
  (Workers & Pages → Overview, right column).

Check: `gh secret list -R northguild/northguild.dev` lists both.

## 3. `www`

- **DNS → Records → Add record**: type `AAAA`, name `www`, IPv6 `100::`, **Proxied** (orange
  cloud). `100::` is the discard prefix: the record exists only so the request reaches Cloudflare's
  rules.
- **Rules → Overview → Redirect from WWW to root → Create from template**, name `www to apex`:
  wildcard pattern, Request URL `https://www.*`, Target URL `https://${1}`, **301**, **Preserve
  query string** ticked. Deploy past the "may not be proxying" warning (**Ignore and deploy rule
  anyway**): the check does not count the `AAAA 100::` record.

Check: `h "https://www.northguild.dev/x?a=1"` → `301 https://northguild.dev/x?a=1`.

## 4. Deploy the landing

Merge `dox-builder`'s landing work in the new repo (you commit and push), or run **Actions → Deploy
→ Run workflow**. Wrangler creates the Custom Domain `northguild.dev`, its DNS record and its
certificate (allow a few minutes for the certificate).

```sh
h $ND/                    # 200
h $ND/api/x; h $ND/mcp/x  # 404 404 (the landing 404 page)
n $ND/nope               # 404, the landing 404 page
curl -s $ND/robots.txt    # exactly the landing repo's `robots.txt` (ai-train=no, Disallow /api/ and /mcp/); no "BEGIN Cloudflare Managed content"
h http://northguild.dev/  # 301 https://northguild.dev/
curl -s $ND/ | grep -c cdn-cgi   # 0
```

Workers & Pages → `northguild-site` → Settings → Domains & Routes shows the Custom Domain.

## 5. Deploy order

1. §0–§4 done and their checks pass. The landing must be live first: the Dox Route needs the
   proxied apex record the Custom Domain creates, and `northguild.dev/robots.txt` must not be a 5xx
   (RFC 9309 reads a 5xx as "disallow everything").
2. The Dox token has the zone permissions (§1).
3. **Merge the Part A PR.** Merging to `main` deploys on its own: Release runs, then **Deploy Dox**
   (`workflow_run`). You can also run Actions → Deploy Dox → Run workflow. Its smoke step runs the
   redirect matrix; a red run means a row failed — read its table.
4. By hand:

```sh
h $ND/gmt; h "$ND/gmt?a=1"         # 3xx to /gmt/ and /gmt/?a=1
h $ND/gmt/; h $ND/gmt/reference/   # 200 200
h $WD/; h "$WD/tools/dst-inspector/?zone=Europe/Paris"   # 301 $ND/gmt/…, query kept
h -L "$WD/reference/duty/?a=1"     # ends 200 at /gmt/reference/workforce/?a=1
# the same as a browser follows a link — curl alone passes even when browsers get a 404 (D3 above)
n $WD/; n $WD/guides/concepts/dst-disambiguation/   # 301 $ND/gmt/…, never 404
n "$WD/reference/duty/?a=1"        # 301 $ND/gmt/reference/duty/?a=1
n "$ND/gmt?a=1"; n $ND/gmt/reference/   # 301 /gmt/?a=1; 200
n $ND/gmt/nope/                    # 404, the Dox 404 page
h $ND/gmt/api/brains               # 200
h $WD/robots.txt                   # 301 https://northguild.dev/robots.txt
curl -s -X POST $WD/api/chat -o /dev/null -w '%{http_code}\n'   # 400, never 3xx
curl -s $ND/gmt/llms.txt | grep -c gmt-dox.northguild           # 0
```

Workers & Pages → `gmt-dox` → Settings → Domains & Routes shows `northguild.dev/gmt*` and the
`workers.dev` route enabled.

**A 301 is permanent in browsers.** Once step 3 deploys, every browser that follows a `workers.dev`
link remembers the jump to `northguild.dev/gmt/`. Do not roll the Worker back to the old code to
undo a problem: fix forward. (A Worker rollback does not remove the Route, and the old build has no
`/gmt/` files.)

## 6. Web Analytics

Analytics & Logs → **Web Analytics** → the Dox site (today registered for the `workers.dev`
hostname) → **Manage site** → change the hostname to `northguild.dev`. Keep the **JS snippet**
setup; do **not** turn on automatic injection — the tag is already in `Head.astro` and the beacon
would load twice. If the hostname cannot be edited, **Add a site** `northguild.dev` with the JS
snippet option and give the new token to `dox-builder` for `Head.astro`.

Check: `curl -s $ND/gmt/ | grep -o 'cloudflareinsights[^"]*'` shows the beacon once; the dashboard
shows visits within the hour.

## 7. Repo and org links

```sh
gh repo edit northguild/gmt --homepage https://northguild.dev/gmt/
gh api -X PATCH orgs/northguild -f blog=https://northguild.dev
gh repo view northguild/gmt --json homepageUrl -q .homepageUrl   # https://northguild.dev/gmt/
gh api orgs/northguild -q .blog                                   # https://northguild.dev
```

Today: `homepageUrl` is the `workers.dev` URL and the org website is empty.

## 8. Search Console (optional)

search.google.com/search-console → **Add property → Domain** → `northguild.dev`. Copy the
`google-site-verification=…` value; Cloudflare DNS → Add record → `TXT`, name `@`, that value (the
Search Console flow can also add it through Cloudflare). Verify. Then **Sitemaps** → submit
`https://northguild.dev/gmt/sitemap-index.xml`.

Check: `dig +short TXT northguild.dev` lists the SPF and the verification value.

## 9. GitHub Sponsors (D11)

Neither `northguild` nor `craig-o-curtis` has a Sponsors listing today. When the org's listing is
approved (github.com/sponsors → Join for the org), add `.github/FUNDING.yml` with
`github: northguild` in a small PR. Check: `gh api graphql -f query='{organization(login:"northguild"){hasSponsorsListing}}'`
→ `true` before adding it.

## What needs no change

The Worker name `gmt-dox`; the secrets `NORTHGUILD_GMT_GEMINI_API_KEY`, `DOX_DEV_KEY`,
`CLOUDFLARE_ACCOUNT_ID`; the KV namespace `DOX_USAGE`; the AI binding; the Deploy Dox triggers; the
Email Routing records; the nameservers; HSTS (`.dev` is on the browser preload list, so it is
always HTTPS).
