# CORE-82 — Core: The suite runs on native Temporal

**Scope:** Run GMT's existing test suite every week on the `Temporal` that ships in Node 26, Chromium and Firefox, not only on `@js-temporal/polyfill`, and report a divergence through the weekly canary's issues. Adds no function and changes no output.

## Gap

Native `Temporal` is on by default in Firefox 139, Chrome 144 and Node 26.0.0. A GMT user on any of them who passes their own `Temporal` values around, or who later runs GMT on the host's engine, depends on GMT giving the same answers there.

Nothing checks that today. Every test runs on the polyfill. The weekly oracle (`.github/workflows/temporal-oracle.yml`) compares about 410,000 Temporal results with Chromium's engine, but it probes `Temporal` itself, not GMT's functions. A GMT answer that differs on a native engine is found by nobody.

([Firefox 139 release notes](https://www.firefox.com/en-US/firefox/139.0/releasenotes/), [Chrome 144 release notes](https://developer.chrome.com/release-notes/144), [Node.js 26.0.0 changelog](https://github.com/nodejs/node/blob/main/doc/changelogs/CHANGELOG_V26.md#26.0.0))

## Scope

1. **Node leg.** A Vitest configuration that points CORE-80's Temporal seam at `globalThis.Temporal` and runs the whole `packages/gmt` suite on Node 26.
2. **Browser leg.** The same suite in Chromium and Firefox through Vitest browser mode with the Playwright provider, on each browser's own `Temporal`. Playwright is already installed for the oracle.
3. **Weekly job.** A job in `temporal-oracle.yml`, on the weekly schedule and on `workflow_dispatch`, never on pull requests. It writes a verdict file under `artifacts/` in CORE-81's shape (`{ source, status: "ran" | "could-not-run", … }`), one source per runtime, which CORE-81's report step turns into issues under its finding keys.
4. **Upstream page.** The Dox upstream page shows each runtime with its engine version and the date of the last green run, from the same data path CORE-81's results use. No new page.
5. **Triage.** A divergence is one of three things, and each is closed in the story that finds it: a GMT defect, fixed; a polyfill defect, recorded in [js-temporal-polyfill-bugs.md](../js-temporal-polyfill-bugs.md) with its upstream link; an engine defect, recorded the same way with the engine's bug link. No test is skipped to make a leg green.

## Tool

None. The story adds no public function. Its result is shown on the existing upstream page.

## Design notes

- **The polyfill stays the published engine.** CORE-80 decided that; this story only proves the suite on native engines, which is one of the two conditions for revisiting it.
- **Safari is not a leg.** Safari Technology Preview 249 added `Temporal`, but no stable Safari release has announced it. A Safari leg joins when it does.
- **Expected values stay polyfill-derived.** Within one host, the polyfill and the native engine read the same ICU time zone data, so a row's expected value agrees with the engine under test. Across hosts, each run carries its own data.
- **Weekly, not per PR.** The 30-leg CI matrix is already the per-PR gate. A native leg on every PR would make builds depend on browser releases. Builds stay green whatever upstream does, as CORE-81 requires.
- **No changeset.** Nothing in a published package changes.

## What gmt provides (do not re-implement)

- CORE-80 — the single internal module every `Temporal` import goes through
- CORE-81 — the verdict JSON, the finding keys and the report step in `temporal-oracle.yml`
- `scripts/temporal-compat.mjs` — the oracle's tagged-mismatch list, so a known polyfill or engine defect is not reported twice

## Verification

- A `workflow_dispatch` run is green on Node 26, Chromium and Firefox, and its job summary names each engine version.
- A dry run with one forced failure opens one `[dry run]` issue through CORE-81's path; a second dry run comments on it.
- A runtime that cannot start writes `could-not-run`, which files CORE-81's could-not-run issue.
- The upstream page lists the three runtimes and their last green run.
- `pnpm run validate` stays green and takes no longer than before.
