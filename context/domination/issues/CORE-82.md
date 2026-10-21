# CORE-82 — Core: The suite runs on native Temporal

**Scope:** Run GMT's existing test suite every week on the `Temporal` that ships in Node 26, Chromium and Firefox, not only on `@js-temporal/polyfill`, and report a divergence through the weekly canary's issues. Adds no function and changes no output.

## Gap

Native `Temporal` is on by default in Firefox 139, Chrome 144 and Node 26.0.0. A GMT user on any of them who passes their own `Temporal` values around, or who later runs GMT on the host's engine, depends on GMT giving the same answers there.

Nothing checks that today. Every test runs on the polyfill. The weekly oracle (`.github/workflows/temporal-oracle.yml`) compares about 410,000 GMT results with Chromium's native `Temporal`, but GMT runs on the polyfill there, and only calendar operations are compared. No test runs GMT itself on a native engine. A GMT answer that differs on a native engine is found by nobody.

([Firefox 139 release notes](https://www.firefox.com/en-US/firefox/139.0/releasenotes/), [Chrome 144 release notes](https://developer.chrome.com/release-notes/144), [Node.js 26.0.0 changelog](https://github.com/nodejs/node/blob/main/doc/changelogs/CHANGELOG_V26.md#26.0.0))

## Scope

1. **Node leg.** A Vitest configuration that points CORE-80's Temporal seam at `globalThis.Temporal` and runs the whole `packages/gmt` suite on Node 26.
2. **Browser leg.** The same suite in Chromium and Firefox through Vitest browser mode with the Playwright provider, on each browser's own `Temporal`. The oracle job already installs Playwright's Chromium; this leg adds Firefox.
3. **Weekly job.** A job in `temporal-oracle.yml`, on the weekly schedule and on `workflow_dispatch`, never on pull requests. It writes a verdict file under `artifacts/` in CORE-81's shape (`{ source, status: "ran" | "could-not-run", … }`).
4. **New canary sources, one per leg.** CORE-81's reporter knows only its own three sources, so this story adds `native-suite-node`, `native-suite-chromium` and `native-suite-firefox`:
   - its verdict builder and file in `scripts/lib/canary-verdict.mjs`;
   - the source in the `temporal-oracle` entry of `WORKFLOW_SOURCES`, so a leg that writes no verdict is listed in the workflow's could-not-run issue;
   - a finding builder in `scripts/lib/canary-issues.mjs`, with its marker key;
   - a `force_*` dispatch input for the dry run, read only through `env:` like the existing ones.
5. **Upstream page.** The Dox upstream page names the three runtimes the suite runs on and links to the workflow's runs; each run's job summary names the engine versions. No new page and no new data file: a divergence reaches an issue, not the page.
6. **Triage.** A divergence is one of three things, and each is closed in the story that finds it: a GMT defect, fixed; a polyfill defect, recorded in [js-temporal-polyfill-bugs.md](../js-temporal-polyfill-bugs.md) with its upstream link; an engine defect, recorded the same way with the engine's bug link. No test is skipped to make a leg green.

## Tool

None. The story adds no public function. The existing upstream page names the runtimes it runs on.

## Design notes

- **The polyfill stays the published engine.** CORE-80 decided that; this story only proves the suite on native engines, which is one of the two conditions for revisiting it.
- **Safari is not a leg.** Safari Technology Preview 249 added `Temporal`, but no stable Safari release has announced it. A Safari leg joins when it does.
- **Expected values stay polyfill-derived.** Within one host, the polyfill and the native engine read the same ICU time zone data, so a row's expected value agrees with the engine under test. Across hosts, each run carries its own data.
- **Weekly, not per PR.** The 30-leg CI matrix is already the per-PR gate. A native leg on every PR would make builds depend on browser releases. Builds stay green whatever upstream does, as CORE-81 requires.
- **One patch changeset.** The day-rounding fix (see Decisions) is the only change to a published package.

## What gmt provides (do not re-implement)

- CORE-80 — the single internal module every `Temporal` import goes through
- CORE-81 — the verdict files, the reporter (`scripts/canary-report.mjs`, `scripts/lib/canary-issues.mjs`, `scripts/lib/canary-verdict.mjs`) and the `report` job in `temporal-oracle.yml`
- `scripts/lib/native-suite-tags.mjs` — exports `KNOWN_NATIVE_FAILURES` (13 rows: 10 for record L, icu4x#8620; 3 for record M, boa-dev/temporal#529; legs `node` and `chromium`) and `KNOWN_HOST_FAILURES` (3 Chromium-only groups)
- `scripts/native-suite.mjs <leg>` — a two-pass control/native runner with the `shimProblems` preflight
- `packages/gmt/src/test/nativeTemporal.ts` — the test-clock shim: the host's `Temporal` with `Now` derived from `Date.now()`
- `artifacts/native-suite-<leg>.json` — the verdict, source `native-suite-<leg>`, in the canary framework (CORE-81's reporter)

## Verification

- A `workflow_dispatch` run is green on Node 26, Chromium and Firefox, and its job summary names each engine version.
- A dry run with one forced failure opens one `[dry run]` issue through CORE-81's path; a second dry run comments on it.
- A runtime that cannot start writes `could-not-run`, which files CORE-81's could-not-run issue.
- The upstream page names the three runtimes and links to the workflow's runs.
- `pnpm run validate` stays green and takes no longer than before.

## Decisions

Stated as current rules. Where each rule is enforced is named beside it.

**What runs**

- The whole `packages/gmt` suite runs unchanged in what it asserts on Node 26 (V8), Chromium (V8) and Firefox (SpiderMonkey), weekly and on dispatch, never on pull requests. The polyfill stays the engine CI and the published package use. Browser legs use Vitest browser mode with `@vitest/browser-playwright`.
- Native `Temporal.Now` reads the host clock, so `vi.setSystemTime` cannot reach it. The native legs alias `@js-temporal/polyfill` to `packages/gmt/src/test/nativeTemporal.ts`, which derives `Now` from `Date.now()` by the polyfill's carried sub-millisecond rule. Expected values stay polyfill-derived; every other `Temporal` behaviour is the engine's.
- About 45 test files were made portable so the same suite loads in a browser: spies use `vi.mock(path, { spy: true })`, and host file reads, deep equality and bounded child processes sit behind modules with a browser twin (a time-limited Worker that starts its timeout only after GMT has loaded).
- ICU data is the same per runtime, not across runtimes. Expected values were recorded on Node's full ICU, so a browser with less locale data fails those rows on any engine.

**Tags and verdicts**

- A known native failure is tagged, never skipped. The test still runs on every leg; a tag classifies its failure for the reporter, names its defect record and becomes a `stale-tag` finding once the test no longer fails that way. `TAGGED_MISMATCHES` keys oracle rows and cannot tag a test, so the story keeps its own lists.
- A control pass on the polyfill in the same runtime separates a host failure (fails on both engines) from an engine divergence (fails only natively). A host failure is tagged by group, with an evidenced reason and a file or test pattern, never one tag per row.
- Green means no untagged failure of either kind. The finding keys are `native-suite/untagged-failure` (labels `canary`, `bug`), `native-suite/untagged-host-failure` and `native-suite/stale-tag` (label `canary`).
- Each leg is its own verdict source, so a leg that cannot start is named in CORE-81's could-not-run issue. Dispatch input `force_native_failure` drives the dry run and reaches the shell only through `env:`.

**Triage**

- Ten tests fail natively on Node 26 and Chromium 153 because a one-character annotation key such as `[a=bc]` is refused: record L in [js-temporal-polyfill-bugs.md](../js-temporal-polyfill-bugs.md), icu4x#8620 (fixed in icu4x#8623, not yet in an `ixdtf` release or a V8 roll). The spec allows it: `AKeyLeadingChar`, RFC 9557 section 4.1.
- Three tests fail because `[u-ca=islamic]` is accepted: record M, boa-dev/temporal#529. `islamic` is not a Temporal calendar (Intl Era and Month Code proposal, CreateDateTimeFormat step 9; test262 `intl402/Temporal/PlainDate/from/islamic.js`).
- Record N covers the day-rounding defect below. Records K, L and M were not used for this story because K was already taken.
- Firefox has no tags yet. Its triage waits for the first CI run, because Firefox 155 would not launch on the owner's macOS here. Each Firefox failure gets the same three questions in order: does it also fail on the polyfill in Firefox (host group), does the spec disagree with GMT (fix it now), otherwise an engine defect (record it).

**The one GMT defect found**

- `roundZoned` and `roundUnix` rounded to the day wrongly when a date starts twice (America/Goose_Bay on 6 November 2010, Antarctica/Casey on 4 March 2010). Rounding to the day clamps the instant to the end of the date minus one nanosecond (`endNs - 1`): ecma262 commit c97660929786, tc39/proposal-temporal#3312, and test262 `intl402/Temporal/ZonedDateTime/prototype/round/same-date-starts-twice.js`. GMT answers this itself on runtimes without the fix, gated by temporalCompat workaround D14, and ships it as a patch changeset.
- Functions built on GMT's own bucket rule (`startOfZoned`, `endOfZoned`, `bucketRange` and the hours and workforce functions) are not affected: the re-entered piece of a date is its own bucket. Duration rounding with a zoned `relativeTo` is not affected either.
