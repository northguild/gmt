# CORE-86 runbook § 8 — Search Console, Bing Webmaster Tools and crawler reports (the owner's)

Part of the [CORE-86 runbook](./runbook.md). Each step says where, the exact value, and a check.

The Domain property's verification record is live on the zone: `dig +short TXT northguild.dev`
lists a `google-site-verification=…` value beside the SPF. Bing has no record yet; step O3 verifies
it by import from Search Console. Steps O1–O5 are the owner's and run in this order.

**O1: Search Console, Domain property `northguild.dev`.** Confirm the property is verified. Under
**Sitemaps** submit `https://northguild.dev/gmt/sitemap-index.xml`, and, once the root sitemap
exists, `https://northguild.dev/sitemap-index.xml`.

Check: the sitemap status reads "Success" with a URL count; **Indexing → Pages** shows the indexed
and not-indexed counts and the top three not-indexed reasons.

**O2: Search Console, URL Inspection.** Inspect `https://northguild.dev/gmt/`,
`https://northguild.dev/gmt/reference/zoned/calculate/startOfZoned/` and
`https://northguild.dev/gmt/install.md`.

Check: each result says whether the URL is indexed and names the canonical Google chose.

**O3: Bing Webmaster Tools.** bing.com/webmasters → **Add site → Import from Google Search
Console**, then submit the same sitemap URL or URLs under **Sitemaps**.

Check: the site is listed as verified, the sitemap shows as processed, and the indexed-page count is
shown.

**O4: AI Crawl Control, crawler report.** Cloudflare → AI Crawl Control → read the per-crawler
request counts for the last 30 days. This is a read-only report; the Block Crawler switches stay
as [runbook § 0](./runbook.md#0-zone-checks-before-anything-deploys) sets them.

Check: counts appear for GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot,
Claude-User, PerplexityBot, Google-Extended and Bingbot, and no crawler shows blocked requests.

**O5: Crawler Hints.** Cloudflare → Caching → Configuration → **Crawler Hints** → On. It sends
IndexNow pings to participating engines when cached content changes. It is a zone setting and is
not used for anything AI Crawl Control decides.

Check: the switch reads On. After the next deploy, Bing Webmaster Tools → **IndexNow** lists the
received URLs. If none arrive within a week, switch Crawler Hints off again; nothing in the repo
depends on it.
