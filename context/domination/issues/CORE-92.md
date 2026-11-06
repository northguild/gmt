# CORE-92 — Core: Weekly check for a `temporal-polyfill` release GMT can swap to

**Scope:** Add a job to the weekly Temporal oracle run that tests the latest `temporal-polyfill` release
against the whole `packages/gmt` suite, on Node and in the native suite's browsers, sweeps its UTC
offsets in every zone, and opens an issue when all of it passes. Adds no function and changes no
output. The findings behind it are in
[research/temporal-polyfill-swap.md](../research/temporal-polyfill-swap.md).

## Gap

GMT stays on `@js-temporal/polyfill`. `temporal-polyfill` 1.0.8 fixes the defects GMT found in 1.0.6
and 1.0.7 (`fullcalendar/temporal-polyfill` #119, #120, #121, #125 and #126). On Node, the swap check
finds 0 swap-only failures in 71,340 tests and 0 zones that differ from `Intl.DateTimeFormat`. The
move itself is CORE-108 (#460). Without the check, nothing tells us when a release is ready to swap
to, and checking by hand on every release is the kind of watch nobody keeps. WebKit still has D19
(research § 3).

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
6. **Dox.** The "Why this polyfill" section of `/upstream/` gives the latest results, says the check
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

## Decisions

- **Alias, not an edit to the seam.** `internal/temporal.test.ts` asserts that
  `src/internal/temporal.ts` names `@js-temporal/polyfill`, so an edited seam fails on every run and
  the issue could never open. A Vitest alias on that specifier swaps the implementation behind the
  unchanged seam and reaches every importer, because the seam is the only file naming it.
- **"Every test passes" is judged against the control pass.** The browser control passes fail tests
  for host reasons (`KNOWN_HOST_FAILURES` in `scripts/lib/native-suite-tags.mjs`). A leg passes when
  no test fails on the swap that passes on the control in the same runtime.
- **One verdict per leg**, `temporal-polyfill-swap-<leg>`, as for `native-suite-<leg>`. Four legs:
  Node 26, Playwright Chromium, Firefox and WebKit. The Node leg also runs the offset sweep and the
  calendar sweep ([CORE-110](CORE-110.md)).
- **Import `temporal-polyfill/full/implementation`, never `/full`.** `/full` returns the runtime's
  built-in `Temporal` where one exists, so the swap would test the engine, not the polyfill.
- **The sweep is brute force on purpose.** One instant a day at 12:00 UTC, from 1970-01-01 to ten
  years past the run date, in every zone `Intl.supportedValuesOf("timeZone")` lists (ECMA-402 § 8.3.2),
  against `Intl.DateTimeFormat` `timeZoneName: "longOffset"`. 1970 is where the IANA database says
  clocks agree on timestamps after the POSIX epoch. It must not use the swap's own transition search,
  where the defects of research § 4.3 and § 4.4 lived. The parser accepts `GMT`, `GMT±HH:MM` and
  `GMT±HH:MM:SS`, since the offset text is implementation- and locale-dependent (ECMA-402
  FormatDateTimePattern), and treats anything else as could-not-run. Both sides read the runtime's
  time zone data, so GMT owns none. `run date + 10 years` on 29 February clamps to 28 February.
- **Type errors do not decide.** The suite runs without `tsc`; the missing helper type names are swap
  work (research § 5).
- **`getNow` may equal the frozen clock.** Temporal § 2.3.1 HostSystemUTCEpochNanoseconds says hosts
  may reduce the result's precision, so `getNow.test.ts` accepts an equal time.
- **Issue on success only.** The report job opens one `canary` issue when every leg ran, no test fails
  on the swap that passes on the control, and the sweep lists no zone. An open issue gets a comment
  instead of a duplicate (CORE-81's marker scheme). A run that ran but is not swap-ready files
  nothing. A leg or sweep that could not run joins the workflow's could-not-run issue.
- **Builds stay green whatever upstream does.** Nothing joins `ci.yml` or `validate`, a failing swap
  job does not fail the workflow, and CI never opens a PR. `temporal-polyfill` is installed in the
  swap job's checkout only, never in a manifest or lockfile.
- **Vitest's module cache is off in every swap pass.** Its file-system cache is keyed by path, not
  contents, so a package upgraded in place runs from the old transform. `scripts/native-suite.mjs`
  passes `--fsModuleCache=false` to every pass (research § 7).
- **The upstream tracker follows `fullcalendar/temporal-polyfill`**, listed after the other two
  repositories because GMT runs on `@js-temporal/polyfill`. GMT's reports there (#119, #120, #121,
  #125, #126) stay listed once closed, with an `outcome` saying why (`OUTCOME_RULES` in
  `scripts/upstream.mjs`), as credit.
- **Dox work in the same story** (the weekly Firefox and WebKit sweep found 15 root causes; see
  `context/dox/built.md` for the rules that came out of it):
  - Firefox runs on this machine through a Docker run-server (`GMT_PW_FIREFOX_WS`), because
    Playwright 1.63's Firefox does not launch on macOS 27. CI never sets it.
  - `hold` is a kit builder (`builders/hold.ts`), because it has consumers outside `ids`.
  - A gate change may only remove a false positive. It never hides a real defect: a raw delta of
    0.5 px or more, any real jump, any contrast miss.
  - `a11y-media` leaves Firefox only when its probe proves `emulation-not-applied`. A probe that
    applies while the token stays low is a product defect.
  - On `migrate/date-fns`, the fix is layout only, with the note text unchanged: breaking
    `ZonedDateTime.prototype.equals` at a `.` is against the `code-break.ts` rule.
  - The `force_finding` dispatch of the weekly workflow is run after merge, and the run is watched.
