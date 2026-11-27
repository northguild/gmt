# Slice 4: canonical and crawled-not-indexed triage, Search Console steps

[Story](./index.md) · repo: gmt (docs only) · gate: none. Slices 1 to 3 hold the gates, and this
slice records the verdicts and the owner's steps.

## Duplicate, Google chose different canonical (3)

| Page (under `/gmt/reference/`) | Nearest sibling | 5-word shingle Jaccard |
| --- | --- | --- |
| `duration/calculate/totalDuration/` | other `duration/calculate` pages | < 0.2 |
| `calendar/hours/operatingIntervals/` | `operatingTimeBetween/` | 0.29 |
| `types/RoundingOptions/` | other shared option types | < 0.2 |

Each page has a correct self canonical, a sitemap entry and a 200. None is close to a sibling.
There are two candidate causes, and slice 1 removes both:

- **The 307.** Google kept the slashless URL, linked before DOX-G8, as canonical. The 308 fixes it.
- **The workers.dev copy.** `gmt-dox.northguild.workers.dev/gmt/<page>/` served the same page,
  indexable. For `totalDuration/`, URL Inspection names that copy as the referring page and shows
  "Google-selected canonical: N/A". The host's `noindex` rule fixes it.

URL Inspection reads "Google-selected canonical" for each page. This table maps the answer to a
cause; the [Results](#results-url-inspection-2026-11-27) put each page in a slice-1 row:

| Google-selected canonical | Meaning | Action |
| --- | --- | --- |
| the same URL without the slash | the 307 source | none beyond slice 1; Validate Fix after deploy |
| the `.md` twin | the twin outranked the page | none beyond slice 3 |
| a `?w=`/`?tz=` URL | a permalink outranked the page | none beyond slice 3 |
| a `gmt-dox.northguild.workers.dev` URL, or N/A with that host as referring page | the duplicate host | none beyond slice 1's host rule; inspect again after deploy |
| the page itself (now) | resolved since the export | none |

No page has a sibling as its canonical, so this story makes no library or content change.

## Crawled – currently not indexed: the six HTML pages

| Page | Words | Verdict |
| --- | --- | --- |
| `guides/recurrence-and-cron/` | 2,903 | substantial, linked from the sidebar of every page; no defect |
| `guides/splitting-and-counting/` | 2,324 | same |
| `guides/workforce-hours-of-work/` | 7,525 | same |
| `guides/mistakes/transport/` | 3,031 | same |
| `guides/durations/` | 2,344 | same |
| `reference/plain/parse/parseMonthFromDateTime/` | 127 | thin (0.48 overlap with `parseMonthFromDate`), but the same shape as about 1,000 generated reference pages that are indexed |

Every page is 200 and self-canonical, is in the sitemap and has no noindex. The site needs no
change. The two slashless URLs in this bucket are slice 1's. The ~242 `.md` twins are slice 3's.
Google says this state needs no action and can change on a later crawl (*Page indexing report*).

## Owner steps in Search Console after both deploys

These go into `context/dox/cloudflare-runbook.md` §4 as a numbered list, written in the present tense:

1. **robots.txt report** (Settings → robots.txt). Check that it shows the fetch with the new
   `Googlebot` group. If it is older, choose "Request a recrawl". Google caches robots.txt for up
   to 24 hours.
2. **Sitemaps.** Resubmit `https://northguild.dev/gmt/sitemap-index.xml`. In Bing Webmaster Tools,
   resubmit the same sitemap.
3. **Validate Fix**, per reason, in the Page indexing report:
   - "Duplicate, Google chose different canonical than user";
   - "Crawled – currently not indexed";
   - "Discovered – currently not indexed";
   - "Alternate page with proper canonical tag".
   Do **not** validate "Page with redirect" or "Excluded by 'noindex' tag". Those URLs stay
   excluded as intended; validation would only report them as failing.
4. **URL Inspection → Request indexing**, once slice 3 is live, for the three canonical pages and
   the six HTML pages above. That is nine requests, inside the daily quota.

**Expected timeline and shape:**

| When | Expect |
| --- | --- |
| 1 day | robots.txt report shows the new file |
| 1–2 weeks | ~242 `.md` and ~134 query URLs move to "Blocked by robots.txt" (expected, no action); validation of the four reasons reports progress |
| 2–4 weeks | the 307 slashless URLs consolidate to their slash pages; "Page with redirect" stops growing (it does not empty: the 301s and `http://` stay) |
| 4–8 weeks | "Discovered – currently not indexed" falls as the freed crawl reaches the 331 pages |

Check the report at 2, 4 and 8 weeks.

**Watch for "Indexed, though blocked by robots.txt".** If a `?w=`/`?tz=` URL or a `.md` twin
appears there, Google is indexing it from links alone. Report it with the URLs. The response is a
new spec decision, not a robots edit, because unblocking would undo slice 3.

## Close-out (the story's)

- `context/dox/cloudflare-runbook.md` §4: the steps and table above.
- `context/dox/built/tier-0-1-site.md`: check that slices 1–3's lines are in, in the present tense,
  with no history.
- `context/dox/specs/index.md`: the dox-g17 line stays while the story is in progress. The
  finalizer removes it, and the folder, when the story is Done.

## Results (URL Inspection, 2026-11-27)

| Page | Google-selected canonical | Referring pages | Last crawl | Cause → slice |
| --- | --- | --- | --- | --- |
| `duration/calculate/totalDuration/` | N/A | `gmt-dox.northguild.workers.dev/reference/duration/calculate/totalDuration/`; `/gmt/tools/interval-visualizer/` | 2026-11-17 | old host → 1 (noindex, one hop) |
| `calendar/hours/operatingIntervals/` | N/A | `/gmt/reference/zoned/calculate/endOfQuarterForZoned` (no slash, 307); `/gmt/tools/interval-visualizer/` | 2026-11-16 | slashless 307 → 1 (308) |
| `types/RoundingOptions/` | `https://gmt-dox.northguild.workers.dev/reference/types/RoundingOptions/` (the address before CORE-86) | the old host without the slash; `/gmt/tools/interval-visualizer/` | 2026-11-03 | old host → 1 (one 301, noindex) |

The Sitemaps line for `RoundingOptions` reads "Temporary processing error". Step 2 above, the
sitemap resubmission, covers it. After the deploy, the owner inspects all three again and requests
indexing (step 4).

## Definition of done

- The runbook §4 steps are written, and the Results table above is copied there as the
  re-inspection list.
- The story's final gates: the full gates, `pnpm run validate` and `dox-tester` run once, after
  this slice.
