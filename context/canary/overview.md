# Canary overview

## The canaries

| Canary                     | Where                                                         | Checks                                                                                                                                                                                                       | Files                                                                                                           | Story                                                                                                       |
| -------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Workaround check (Node)    | `temporal-oracle.yml` job `oracle`, `pnpm compat`             | Each `temporalCompat` workaround's probes on Node: is the polyfill defect still there?                                                                                                                       | One issue per workaround removable on every engine in its scope                                                 | [CORE-81](../domination/issues/CORE-81.md)                                                                  |
| Native oracle              | `temporal-oracle.yml` job `oracle`, `pnpm compat:oracle`      | GMT's calendar results against Chromium's native `Temporal`; test262 decides a disagreement                                                                                                                  | One `temporal-compat` issue for untagged mismatches                                                             | [CORE-81](../domination/issues/CORE-81.md)                                                                  |
| Native suite               | `temporal-oracle.yml` job `native-suite`                      | The whole `packages/gmt` suite on native `Temporal` and on the polyfill, per leg: Node 26, Chromium, Firefox, WebKit. Each browser leg also runs the workaround probes in that browser                       | One issue per engine for untagged divergences; one for host failures; one for control-only failures; stale tags | [CORE-82](../domination/issues/CORE-82.md)                                                                  |
| Polyfill swap              | `temporal-oracle.yml` job `polyfill-swap`                     | The suite on the newest `temporal-polyfill` beside `@js-temporal/polyfill`, per leg. The Node leg also sweeps every zone's offsets against `Intl.DateTimeFormat` and every calendar's years against Node | One issue when every leg passes: the swap is due                                                                | [CORE-92](../domination/issues/CORE-92.md), [CORE-110](../domination/issues/CORE-110.md)                    |
| Leap-second table          | `leap-seconds.yml`                                            | GMT's leap-second table against IERS `Leap_Second.dat`, or IANA `leap-seconds.list` when IERS is down                                                                                                        | One issue per difference                                                                                        | [CORE-81](../domination/issues/CORE-81.md)                                                                  |
| Dox weekly gate sweep      | `dox-gates-weekly.yml`                                        | Every Dox page's gates in Chromium, Firefox and WebKit, both themes                                                                                                                                          | `dox-gate` issues                                                                                               | Dox epic: [../dox/built.md](../dox/built.md)                                                                |
| Runtime time zone data     | `apps/dox/src/lib/runtime-tz-canary.test.ts`, in CI           | The test machine's tzdb gives the 2026e offsets the Canada and Morocco pages state                                                                                                                           | Fails the Dox tests with "Update Node."                                                                         | Dox epic                                                                                                    |

The first five run Mondays (06:17 and 06:43 UTC) and on manual dispatch. The gate sweep runs
Sundays.

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
