# Slice 6 — the weekly native run's known-failure group

The weekly native-Temporal run (`.github/workflows/temporal-oracle.yml`, cron `17 6 * * 1`)
installs its browsers with the pinned Playwright 1.63.0 (`pnpm --filter @gmt/dox exec playwright
install --with-deps "$LEG"`). That release's Chromium, 153.0.8010.12, has tz data from before
2026c. This was measured for both zones under Playwright 1.63.0 on 2026-10-23:

| Instant | Chromium 153 | 2026c and later |
|---|---|---|
| `2026-09-20T00:59:59Z` | `+01:00` | `+01:00` |
| `2026-09-20T01:00:00Z` | `+01:00` | `+00:00` |
| `2026-11-02T12:00:00Z` | `+01:00` | `+00:00` |
| `2027-02-22T12:00:00Z` | `+00:00` | `+00:00` |
| `2027-06-01T12:00:00Z` | `+01:00` | `+00:00` |

So every row of `oh-morocco.test.ts` fails on the Chromium leg, which makes a group necessary.

**Other legs.** The Firefox 155 leg already passes `oh-canada.test.ts`, so its data is 2026e or
newer, and Morocco should pass there too. The Node leg runs 26.12.1 (tz 2026e). Neither leg gets
a group.

## Change

`scripts/lib/native-suite-tags.mjs`: append the following to `KNOWN_HOST_FAILURES`, after
`chromium-canada-2026-tz-data`:

```js
{
  // Evidence: under Playwright 1.63.0, Chromium 153.0.8010.12 gives Africa/Casablanca and
  // Africa/El_Aaiun +01:00 at 2026-09-20T01:00Z, 2026-11-02T12:00Z and 2027-06-01T12:00Z, and
  // +00:00 at 2027-02-22T12:00Z (tz data before 2026c). Chromium 156.0.8078.4 under Playwright
  // 1.64.1, WebKit 26.6 and Node 26.12.1 (tz 2026e) give +00:00 at all four. The group goes
  // stale once a Playwright Chromium carries 2026c.
  id: "chromium-morocco-2026-tz-data",
  legs: ["chromium"],
  reason:
    "Chromium's time zone data predates tzdb 2026c, so Morocco and Western Sahara still read +01:00 outside the old Ramadan weeks.",
  file: /\/oh-morocco\.test\.ts$/,
},
```

**Bounds of the group.**
- It does not skip any test. It labels a failure as known.
- It matches by file only, the same as the Canada group.
- Do not bump Playwright in this story. Moving to 1.64.1 would make both Chromium groups stale.
  That is a separate change with its own browser-wide checks.

## Definition of done

1. Re-measure before you commit the evidence. Run
   `pnpm --filter @gmt/dox exec playwright --version`, which must print `1.63.0`. Then, in the
   Playwright Chromium, evaluate:
   `new Intl.DateTimeFormat("en",{timeZone:"Africa/Casablanca",timeZoneName:"longOffset"}).format(new Date("2026-11-02T12:00:00Z"))`.
   It must read `GMT+01:00`. If it reads `GMT`, the group is not needed: drop this slice and say
   so in the hand-back.
2. Run the native suite's Chromium leg locally, the way the workflow does (see the job's `run`
   step), filtered to `oh-morocco.test.ts`.
   - Every failure is reported as known, under `chromium-morocco-2026-tz-data`.
   - No untagged failure is reported.
3. The suite's own tag tests pass: `pnpm exec vitest run scripts/lib --reporter=verbose`, or
   whichever test file covers `native-suite-tags.mjs`.
4. `pnpm lint` is clean for `scripts/`.
5. After the merge, the main session dispatches `temporal-oracle.yml` once and confirms:
   - the Chromium leg has 0 untagged failures;
   - the Morocco group is listed as matched.

   This step is the owner's post-merge check and is not part of the builder's hand-back.
