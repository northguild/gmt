## N. The Dox items of the international-standards audit

From `/Users/craigcurtis/.claude/plans/the-current-story-for-mutable-catmull.md`, step 3 (Dox) and
step 4 (Dox and chat). The library half (JSDoc, the parser default locale, NRF wording, skills,
README samples) is the library pipeline's; its regenerated reference pages are not edited here.

### N1. Widget defaults (step N1)

- **`converter-bench-mount.ts` (40–43):** the default value, source and target zones open on a
  non-US pair chosen for its DST shape: `Europe/London` to `Australia/Sydney` (opposite hemispheres,
  so the two zones change clocks in opposite seasons). The default value is a London wall time in
  that zone's offset, its output re-run. `DEFAULT_LOCALE` is `"en"`. The Converter Bench's tests
  and the reference pages that embed it change with it.
- **`dst-inspector-mount.ts` (69):** `DEFAULT_ZONE = "Europe/London"` (a spring gap and an autumn
  overlap, like the old default). Its tests, presets and page copy follow, each output re-run.
- **`curated-timezones.ts`:** `CURATED_TIMEZONES` ordered by standard UTC offset, west to east,
  `UTC` at its offset; a test asserts the order from Temporal's offsets on one fixed winter
  instant. `globe-zones.ts` and the selects that read it follow without other change.
- **`pt-day.ts` (24):** the site's per-visitor daily cap counts UTC days: a new
  `VISITOR_CAP_TIME_ZONE = "UTC"` used by the cap's day key and its reset. `QUOTA_TIME_ZONE`
  stays `America/Los_Angeles` for each brain's own quota, because that is the provider's stated
  reset, and its comment says so. The reset text shown to readers names each clock. `pt-day` and
  the cap's tests follow.
- **`why-gmt-charts.ts` (36):** `new Intl.NumberFormat(undefined, …)`, the reader's locale. The
  charts' server-rendered text uses the same call, and the visual gate records the change.
