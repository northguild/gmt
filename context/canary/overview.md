# Canary overview

## The canaries

The list of checks is `scripts/lib/pulse.mjs`. The table below is generated from it by
`pnpm pulse:sync`, and `pnpm pulse:check` fails when the two differ. The schedule of each check is
in its workflow file; the page `/pulse/` shows it, with the recent runs.

<!-- pulse:start -->

| Canary | Where | Checks | Finds | Retires | Story |
| --- | --- | --- | --- | --- | --- |
| Workaround check (Node) | `temporal-oracle.yml` job `oracle` | Each workaround's probes on Node: is the polyfill defect still there? | Opens one issue for each workaround that every engine in its scope no longer needs. | When the last workaround is gone. | [CORE-81](../domination/issues/CORE-81.md) |
| Native oracle | `temporal-oracle.yml` job `oracle` | GMT's calendar results against Chromium's built-in Temporal. The test262 suite decides a disagreement. | Opens one issue for the mismatches no workaround accounts for. | When every engine ships Temporal and the polyfill is removed from GMT (#316). | [CORE-81](../domination/issues/CORE-81.md) |
| Native suite | `temporal-oracle.yml` job `native-suite` | The whole library test suite on built-in Temporal and on the polyfill, in Node, Chromium, Firefox and WebKit. Each browser also runs the workaround probes. | Opens one issue per engine for a difference no workaround accounts for, one for a host that failed and one for a stale tag. | When every engine ships Temporal and the polyfill is removed from GMT (#316). | [CORE-82](../domination/issues/CORE-82.md) |
| Polyfill swap | `temporal-oracle.yml` job `polyfill-swap` | The suite on the newest `temporal-polyfill`, beside `@js-temporal/polyfill`. The Node run also sweeps every zone's offsets and every calendar's years against Node. | Opens one issue when every run passes: the swap is due. | When the fixes GMT waits on have shipped in `temporal-polyfill` and GMT has moved to it. | [CORE-92](../domination/issues/CORE-92.md) |
| CLDR locale sweep | `cldr-sweep-weekly.yml` job `sweep` | Every locale and calendar in `cldr-dates-full`: week-of-year years, V8 aborts, and range text that drops, repeats or garbles a field of one date. | Fails the run when a detector misses. The job summary lists the locales that newly break and the ones fixed since the last run. | When workarounds D23, D24, D29 are gone. | [CORE-112](../domination/issues/CORE-112.md) |
| Leap-second table | `leap-seconds.yml` job `canary` | GMT's leap-second table against the IERS `Leap_Second.dat` file, or IANA's `leap-seconds.list` when IERS is down. | Opens one issue per difference. | When the table is closed for good: IERS publishes the file format for continuous UTC. | [CORE-81](../domination/issues/CORE-81.md) |
| US clock-change watch | `us-clock-watch.yml` job `canary` | Federal and state bills on ending the clock changes, and the time zone rules of every US zone, against the last snapshot it saw. | Opens one issue per kind (federal, state, tz) for a difference, and one for a source that could not run. | When the US clock-change checker ships, and the proposals data on the Sunshine Protection Act page is removed or replaced. | [CORE-90](../domination/issues/CORE-90.md) |
| Runtime time zone data | `runtime-tz-canary.test.ts` | That the test machine's time zone database gives the offsets the Canada and Morocco pages state. | Fails the Dox tests with "Update Node." | When the oldest Node GMT supports ships the time zone data those pages state. | Dox epic |
| Dox weekly gate sweep | `dox-gates-weekly.yml` job `sweep` | Every Dox page's gates in Chromium, Firefox and WebKit, in both themes. | Opens or updates `dox-gate` issues. | Stays. A page can break without a change to it, so the sweep stays while the site does. | Dox epic |
| Daily rebuild | `deploy-dox.yml` job `deploy` | Rebuilds and deploys the site, so the upstream filing states on `/upstream/` are read again. | Fails the run when the build or the deploy fails. | Stays. The filing states change without a commit, so the page has to be rebuilt to show them. | Dox epic |

<!-- pulse:end -->

## US clock-change watch

`scripts/us-clock-watch.mjs` and `.github/workflows/us-clock-watch.yml` (on a schedule, and
manual) keep the Sunshine Protection Act page's evidence honest. They compare three sources with
a snapshot, which starts as the committed `scripts/us-clock-watch.snapshot.json`:

- **federal:** Congress.gov bills whose title names the subject, found on the Congress.gov list or
  by a GovInfo title search, and each one's latest action;
- **state:** Open States bills that match the subject terms, and their latest action;
- **tz:** the rules of every zone in `apps/dox/src/lib/us-region-zones.json`, read from the IANA
  `northamerica`, `australasia` and `backward` files.

The script holds subject keywords only. A bill's number and title appear in the snapshot and in
issue bodies as data the APIs returned, never in the script, the site or its tests.

- **The snapshot is carried forward.** `check --carry=<file>` compares with each federal or state
  part in `<file>` that is newer than the committed one, then writes the parts it brought up to
  date back to `<file>`. The workflow downloads that file from the last main run (artifact
  `us-clock-watch-carry`, kept 90 days) and uploads the new one once the issues are filed. So each
  change is reported once, no one runs `refresh`, and nothing is committed. A source that could not
  run, or got no `Date` header, carries its part forward unchanged. The tz part is always the
  committed one. With no artifact (the first run, or 90 days without a run), `check` starts from
  the committed snapshot, which stays the seed and the tests' fixture.
- **Commands.** `check` compares and writes the verdict file; `refresh` rewrites the federal and
  state parts of the committed snapshot in full, to reset the seed, and keeps the tz part;
  `snapshot-tz --dir=<folder>` rewrites only the tz part from an unpacked tzdata release, the one
  `us-region-zones.json` names, and needs no network or key. `check` exits 0 for no difference, 1
  for a difference and 2 when a source could not run (a network or HTTP error, a 429, a body that
  does not parse, a spent request budget or a missing secret); the other sources still report.
- **How `check` finds the federal bills.** A Congress.gov list item carries one title, often a
  short title with no subject term, so a GovInfo search (collection `BILLS`, the current congress)
  first finds every bill whose official or short title names the subject. GovInfo stems each word,
  so `daylight saving` also finds `daylight savings`. Then `check` asks Congress.gov for bills
  updated since the snapshot's date at 00:00:00Z (`fromDateTime`); a new congress reads its list
  whole and lists each bill on it as new. It keeps a bill whose list title names the subject, or whose number the snapshot or the
  search holds, and takes `latestAction` from the list item. Any new action moves a bill's
  `updateDate`, so a changed bill is always on the list; a snapshot bill missing from it is kept as
  it was. A search match on neither is new and is read on its own, from
  `/bill/{congress}/{type}/{number}`.
- **Secrets**, read from the environment and sent only in a request header: `CONGRESS_GOV_API_KEY`
  (an api.data.gov key, which Congress.gov and GovInfo both take; GovInfo gets at most 10 requests)
  and `OPEN_STATES_API_KEY`, both repository secrets. A missing one makes that source could-not-run.
  Open States allows 10 requests a minute per key, so requests go 7 seconds apart, and 250 a day: at
  most 60 for a `check` and 190 for a `refresh`, which lists about 100 pages, so both fit in one
  day. A search can take most of a minute, so each Open States request may run 120 seconds; other
  hosts get 30. A 502, 503, 504 or timed-out request to any of the three APIs is sent twice more, 10
  seconds apart, and each try counts against the budget. A 429 is could-not-run, with no retry. A
  `check` stops itself at 45 minutes, inside the job's 60-minute timeout: whatever has not run by
  then is could-not-run, and its issue is still filed.
- **Issues.** One per kind (federal, state, tz) for a difference, and one for a source that could
  not run, filed by `canary-report.mjs` from `main` only. The federal and state issues ask for a
  review: edit the Proposals data module by hand if a position changed, then close the issue; the
  canary edits nothing in the repo. Their bodies say which snapshot date the list runs from, and a
  later run comments only what is new on it. The tz issue asks for `snapshot-tz` once the checker's
  data is updated. The `force_difference` dispatch input files a `[dry run]` federal issue.
- **The tz issue is the signal for phase 2.** A change to a US zone's rules means a tz release
  models the clock change, so the full US clock-change checker
  ([CORE-90](../domination/issues/CORE-90.md)) can be built.
- **Retirement.** The tz part retires when that checker ships. The federal and state parts retire
  when the Proposals view's data is removed or replaced.

## Which browsers the canaries cover

A browser's date results come from its engine: the `Temporal` and `Intl` code, and the ICU and
time zone data built with it. Most browsers share one of three engines, so a leg per engine
covers them.

| Browser                                                        | Engine underneath                                             | Leg                      |
| -------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------ |
| Chrome, Edge, Brave, Opera, Vivaldi, Arc, Samsung Internet     | Chromium (V8, bundled ICU)                                    | `chromium`               |
| Firefox, Tor Browser, LibreWolf, Zen, Waterfox                 | Gecko (SpiderMonkey, bundled ICU)                             | `firefox`                |
| Safari, and every browser on iOS                               | WebKit (JavaScriptCore, Apple's ICU and time zone data)       | `webkit-macos`           |
| DuckDuckGo                                                     | The system engine: WebKit on macOS and iOS, WebView2 (Chromium) on Windows, Chromium WebView on Android | `webkit-macos`, `chromium` |
| Node, Deno, Cloudflare Workers                                 | V8                                                            | `node`                   |

The `webkit` leg runs Playwright's WebKit on Ubuntu, which takes its ICU and time zone data from
the runner's `libicu74`. The `webkit-macos` leg runs the same browser on a macOS runner, which uses
the ICU and time zone data Safari takes from macOS and iOS. The two differ (the tags in
`scripts/lib/native-suite-tags.mjs` record where), so each leg tests the data it names.
[CNRY-1](issues/CNRY-1.md) records the rules.

## Rules every canary follows

- **Manual and scheduled only.** Never part of `ci.yml` or `pnpm run validate`: "upstream still
  broken" must never fail a build, and those runs have no network.
- **Issues only from `main`.** A run on another branch lists what it would file in the job
  summary and files nothing.
- **One issue per finding.** A finding's key is a hidden marker on the issue's first line
  (`scripts/lib/canary-issues.mjs`). An open `canary` issue with that marker gets a comment; a
  repeat with nothing new is one line.
- **Dry runs are labelled.** Every dispatch input that forces a finding files a `[dry run]`
  issue with the `canary-dry-run` label and changes no probe, tally or exit code.
- **Only the report job writes.** Jobs that install the workspace and run browsers hold a
  read-only token; `report` runs first-party Node and `gh` alone, with `issues: write`.
- **A tag sorts, never skips.** A known failure is tagged in `scripts/lib/native-suite-tags.mjs`
  with its evidence. The test still runs on every leg, and the tag goes stale, with a finding,
  once the test stops failing that way. A control-only failure is never tagged: it is a wrong
  answer GMT gives that runtime's users, and gets fixed.
- **Tags match Vitest titles exactly.** After any Vitest upgrade, check every tag against a
  listing from the new Vitest.
- **A canary names its retirement.** A canary for a closed table or a temporary workaround says
  in its header what retires it (the leap-second canary: IERS publishing its continuous-UTC
  format).

## Shared code

- `scripts/canary-report.mjs` — the report job's entry point.
- `scripts/lib/canary-issues.mjs` — findings, issue keys, titles and bodies.
- `scripts/lib/canary-verdict.mjs`, `scripts/lib/canary-summary.mjs` — the verdict files the
  jobs write, and the job summaries.
- `scripts/native-suite.mjs`, `scripts/lib/native-suite-compat.mjs`,
  `scripts/lib/native-suite-tags.mjs` — the native-suite legs, the in-browser workaround check,
  the known-failure tags.
- `scripts/lib/workarounds.mjs` — the workaround groups, their engine scope and removal triggers.
- Tests: `apps/dox/scripts/canary/*.test.ts`.
