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
| US clock-change watch | `us-clock-watch.yml` job `canary` | Federal and state bills on ending the clock changes, and the time zone rules of every US zone, against the committed snapshot. | Opens one issue per kind (federal, state, tz) for a difference, and one for a source that could not run. | When the US clock-change checker ships, and the proposals data on the Sunshine Protection Act page is removed. | [CORE-90](../domination/issues/CORE-90.md) |
| Runtime time zone data | `runtime-tz-canary.test.ts` | That the test machine's time zone database gives the offsets the Canada and Morocco pages state. | Fails the Dox tests with "Update Node." | When the oldest Node GMT supports ships the time zone data those pages state. | Dox epic |
| Dox weekly gate sweep | `dox-gates-weekly.yml` job `sweep` | Every Dox page's gates in Chromium, Firefox and WebKit, in both themes. | Opens or updates `dox-gate` issues. | Stays. A page can break without a change to it, so the sweep stays while the site does. | Dox epic |
| Daily rebuild | `deploy-dox.yml` job `deploy` | Rebuilds and deploys the site, so the upstream filing states on `/upstream/` are read again. | Fails the run when the build or the deploy fails. | Stays. The filing states change without a commit, so the page has to be rebuilt to show them. | Dox epic |

<!-- pulse:end -->

## US clock-change watch

`scripts/us-clock-watch.mjs` and `.github/workflows/us-clock-watch.yml` (on a schedule, and
manual) keep the Sunshine Protection Act page's evidence honest. They compare three sources with
the committed snapshot `scripts/us-clock-watch.snapshot.json`:

- **federal:** Congress.gov bills whose title names the subject, and each one's latest action;
- **state:** Open States bills that match the subject terms, and their latest action;
- **tz:** the rules of every zone in `apps/dox/src/lib/us-region-zones.json`, read from the IANA
  `northamerica`, `australasia` and `backward` files.

The script holds subject keywords only. A bill's number and title appear in the snapshot and in
issue bodies as data the APIs returned, never in the script, the site or its tests.

- **Commands.** `check` compares and writes the verdict file; `refresh` rewrites the whole snapshot
  after a person has reviewed what changed; `snapshot-tz --dir=<folder>` rewrites only the tz part
  from an unpacked tzdata release and needs no network or key. `check` exits 0 for no difference, 1
  for a difference and 2 when a source could not run (a network or HTTP error, a 429, a body that
  does not parse, a spent request budget or a missing secret); the other sources still report.
- **How `check` reads the federal list.** It asks Congress.gov for bills updated since the
  snapshot's date at 00:00:00Z (`fromDateTime`); a new congress reads its list whole. Each match
  takes `latestAction` from the list item, and no bill is fetched on its own. That is enough: any
  new action moves a bill's `updateDate`, so a changed bill is always on the list. A snapshot bill
  missing from the list is kept as it was.
- **Secrets**, read from the environment and sent only in a request header: `CONGRESS_GOV_API_KEY`
  and `OPEN_STATES_API_KEY`, both repository secrets. A missing one makes that source could-not-run.
  Open States is paced at one request a second and at most 60 a run; a 429 is could-not-run, with no
  retry.
- **Issues.** One per kind (federal, state, tz) for a difference, and one for a source that could
  not run, filed by `canary-report.mjs` from `main` only. The federal and state issues ask a person
  to edit the Proposals data module by hand and refresh the snapshot: the canary edits nothing. The
  `force_difference` dispatch input files a `[dry run]` federal issue.
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
