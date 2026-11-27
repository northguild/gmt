# Search engine runbook — northguild.dev (the owner's)

Part of the [Cloudflare and GitHub runbook](cloudflare-runbook.md). Search Console, Bing
Webmaster Tools and the crawler reports for `northguild.dev`. Load it after a deploy that changes
what crawlers see, or to read the Page indexing report.

1. **Search Console**, Domain property `northguild.dev` (verified by the
   `google-site-verification` TXT record). Under **Sitemaps** submit
   `https://northguild.dev/gmt/sitemap-index.xml`, and the root `sitemap-index.xml` once it
   exists. Check: status "Success" with a URL count; **Indexing → Pages** shows the not-indexed
   reasons. **URL Inspection** on `/gmt/`, a reference page and `/gmt/install.md` names the
   canonical Google chose.
2. **Bing Webmaster Tools** → **Add site → Import from Google Search Console**, then submit the
   same sitemaps. Check: verified, sitemap processed, indexed-page count shown.
3. **AI Crawl Control** report: per-crawler request counts for the last 30 days. Read-only; the
   switches stay as [cloudflare-runbook.md §1](cloudflare-runbook.md#1-zone-settings) sets them.
   Check: counts for GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot,
   Claude-User, PerplexityBot, Google-Extended and Bingbot, and no blocked requests.
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
