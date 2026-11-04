# CORE-92 — Core: Weekly check for a `temporal-polyfill` release GMT can swap to

**Scope:** Add a job to the weekly Temporal oracle run that tests the latest `temporal-polyfill` release
against the whole `packages/gmt` suite, on Node and in the native suite's browsers, sweeps its UTC
offsets in every zone, and opens an issue when all of it passes. Adds no function and changes no
output. The findings behind it are in
[research/temporal-polyfill-swap.md](../research/temporal-polyfill-swap.md).

## Gap

GMT stays on `@js-temporal/polyfill`. `temporal-polyfill` 1.0.7 fixes the three defects GMT reported
against 1.0.6 (`fullcalendar/temporal-polyfill` #119, #120 and #121), and its UTC offsets now match
`Intl.DateTimeFormat` in every zone. It still fails 12 GMT tests, all from one defect in its backward
transition search (#125, research § 4.4), and has D19 in WebKit (research § 3). It also misses
transitions before 1847 (#126, research § 4.5), which GMT already works around. Nothing tells us when
a release fixes these, and checking by hand on every release is the kind of watch nobody keeps.

## Scope

1. **Swap job.** A new job in `.github/workflows/temporal-oracle.yml` installs the latest
   `temporal-polyfill` in the job's checkout only, aliases the `@js-temporal/polyfill` specifier to
   `temporal-polyfill/full/implementation` (the seam `src/internal/temporal.ts` stays as it is),
   and runs the `packages/gmt` suite on Node and in Playwright Chromium, Firefox and WebKit, the
   way the native suite's control pass runs it. It writes a `temporal-polyfill-swap` verdict to `artifacts/` as JSON: the version tested, and for each
   runtime the pass and fail counts and the failing test names.
2. **Offset sweep.** The same job compares the release's UTC offset with `Intl.DateTimeFormat`'s
   (`timeZoneName: "longOffset"`) at 12:00 UTC on every day from 1970 through ten years past the run
   date, in every zone `Intl.supportedValuesOf("timeZone")` lists, on Node. The verdict lists each
   zone that differs, with its days. Both sides read the runtime's time zone data, so GMT owns none.
   It takes about a minute.
3. **Type errors do not decide.** The suite runs without `tsc`. The missing helper type names
   (research § 5) are swap work, not a sign the release is wrong.
4. **Issue.** The report job turns the verdict into one issue when every test passes in every
   runtime and the sweep finds no zone, naming the version and linking the research record. While
   it stays open, a later passing run comments instead of opening a duplicate, the way CORE-81's
   issues do. A failing run files nothing.
5. **Job summary.** Every run writes the version tested, each runtime's fail count and the sweep's
   zone count to `$GITHUB_STEP_SUMMARY`.
6. **Dox.** The "Why this polyfill" section of `/upstream/` gives the 1.0.7 results, says the check
   runs every week and links the workflow.
7. **`getNow` test.** `plain/get/getNow.test.ts` checks for a strictly later time where its comment
   says later or equal. It fails on every run against a polyfill whose clock has no sub-millisecond
   part, so the swap could never pass. The assertion accepts an equal time.
8. **Upstream tracker.** `scripts/upstream.mjs` and the `/upstream/` page follow
   `fullcalendar/temporal-polyfill` after the other two repositories, and list GMT's reports there
   (#119, #120, #121, #125 and #126) in `upstream-filings.json` and `js-temporal-polyfill-bugs.md`.
   A closed report stays listed and says why it closed.

## Design notes

- **Browsers count.** D17, D18 and D19 show only in a browser, and 1.0.6 and 1.0.7 pass on Node yet fail
  the D19 probe in WebKit. A Node-only pass would open a wrong issue.
- **The sweep counts too.** Eight of the 11 zones where 1.0.6 reads the wrong offset have no suite
  rows, so a suite pass alone would open a wrong issue.
- **Builds stay green whatever upstream does.** Nothing joins `ci.yml` or `validate`, and a failing
  swap job does not fail the workflow.
- **A person makes the swap.** CI opens an issue, never a PR.
- **Reuse CORE-81's issue script.** The verdict is one more finding kind for its pure decision
  function, unit-tested without the network.

## What gmt provides (do not re-implement)

- `.github/workflows/temporal-oracle.yml` and its report job
- The CORE-81 issue script and its finding-key markers
- `src/internal/temporal.ts`, the only file that names the implementation
