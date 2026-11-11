# CNRY-1 — Safari's ICU and time zone data in the native suite, and an engine page

**Issue:** #483

**Scope:** Add a `webkit-macos` leg to the weekly native suite, so GMT is tested against the ICU
and time zone data Safari and every iOS browser use. Add a Dox page that says which browsers GMT
supports and which weekly leg covers each one. Adds no function and changes no output.

## Why

GMT ships `@js-temporal/polyfill`, which reads offsets and locale text from the host's
`Intl.DateTimeFormat`. So a browser's answers depend on its engine and on the ICU and tzdb built
with it. The native suite runs four legs: Node, Chromium, Firefox and WebKit. The WebKit leg is
Playwright's WebKit on Ubuntu, which uses the runner's `libicu74`. Safari uses Apple's ICU and the
time zone data macOS and iOS ship.

The two differ. The suite run on Mac WebKit 26.6 (see Evidence) fails 220 tests on Apple's data
in both passes, 119 of which no tag explains, and passes two tag groups Linux WebKit fails (the
Morocco 2026 rows and Linux's pre-2023d tzdb). No leg tests the data Safari users have, so a
wrong answer GMT gives them can go unseen.

Brave, Edge, Opera, Vivaldi and the other desktop Chromium browsers get no leg of their own. They
run Chromium's V8 and its bundled ICU, the `chromium` leg's engine and data. Chromium on Android
(Chrome, Samsung Internet, Android System WebView) reads a separate, smaller ICU data file that no
leg loads, so it is listed as not tested. DuckDuckGo has no engine of its own and no automation
hook: it runs on the system engine (WebKit on macOS and iOS, Chromium on Windows, Android System
WebView on Android). The engine page says this, instead of a job per brand.

## Parts

### 1. The `webkit-macos` leg

- A fifth `native-suite` matrix leg, `webkit-macos`, on a `macos-latest` runner. The repo is
  public, so macOS minutes are free. The leg runs Playwright's WebKit and the Vitest `webkit`
  project; only the host differs.
- The leg name runs through `scripts/native-suite.mjs` (`LEGS`, the `Leg` type, preflight, the
  `--project` argument), `scripts/lib/native-suite-compat.mjs` (a leg-to-browser map beside
  `BROWSER_LABELS`), `scripts/lib/workarounds.mjs` (`ENGINE_IDS["webkit-macos"] = "webkit"`),
  `scripts/lib/canary-issues.mjs` (`COMPAT_SOURCES`, `SOURCE_ENGINE`, `NATIVE_LEGS`),
  `scripts/lib/canary-summary.mjs` (`NATIVE_LEGS`), `scripts/lib/canary-verdict.mjs` and
  `scripts/lib/native-suite-tags.mjs` (the `Leg` types), and their tests in
  `apps/dox/scripts/canary/`.
- Preflight refuses to run `webkit-macos` on a host that is not macOS: a could-not-run verdict,
  never a Linux result filed under the macOS name.
- The engine line reads `macOS WebKit <version>`, so the leg's issue titles differ from the Linux
  leg's. `legLabel` in `canary-issues.mjs` keeps the words before the version
  (`macOS WebKit 26`), not only the first word.
- Both WebKit legs are engine `webkit`. A workaround scoped to WebKit (D18, D19) is removable only
  when both legs' `temporal-compat-*` verdicts say so. The D16, D18 and D19 triggers in
  `workarounds.mjs` name the new verdict, and `pnpm compat:snapshot` regenerates
  `apps/dox/src/data/temporal-compat.json`.
- Tags: a group's legs follow what each leg fails, not the group's name. From the local run:
  the JavaScriptCore divergences (S, T), `webkit-ar-sa-islamic-default-calendar`,
  `browser-canada-2026-tz-data`, and the rows of `webkit-legacy-zone-ids` and
  `webkit-linux-icu74-locale-data` that the Mac also fails, widen to `webkit-macos`. A group that
  then covers both legs loses `linux` from its name. `browser-morocco-2026-tz-data` and
  `webkit-linux-tz-data` stay off the Mac leg: it passes them, so they would go stale there. New
  groups cover the 119 untagged host failures, each with its evidence. Every row is checked
  against the leg's own run, here and on the first CI run.
- The resource trace in the browser steps uses GNU `df --output` and `free`. It needs a form that
  also runs on macOS (`df -Pk`, and `vm_stat` where there is no `free`).
- The report job's artifact parsing already keys on the job name, so `Native Temporal suite
  (webkit-macos)` needs no change there. A test confirms it.

### 2. The engine page

- A Dox page, "Temporal in every engine", beside "Helping fix Temporal": the engine each browser
  and runtime runs, where its data comes from, and the weekly leg that tests it. It covers the Chromium family (Chrome, Edge,
  Brave, Opera, Vivaldi on desktop; Chromium on Android as not tested), the Firefox family, Safari and every iOS browser,
  DuckDuckGo, and the server runtimes on V8 (Node, Deno, Cloudflare Workers).
- Install states the host floor from evidence in one line: the published build's syntax target
  and what `@js-temporal/polyfill` needs from the host (`Intl.DateTimeFormat` with time zones). It
  names no version it has not checked.
- It says plainly that Brave and DuckDuckGo are covered through their engine, not run by name.
- It links to the weekly workflow, not to a dated run.

## Not in scope

- A macOS leg for the `polyfill-swap` job. The swap check compares two polyfills in one runtime;
  the native suite's control pass already tests the shipped polyfill on Apple's data.
- A job per Chromium brand. Same engine and data as the `chromium` leg.
- Real Safari through `safaridriver`. Playwright's macOS WebKit uses the system ICU and time zone
  data, which is what this story tests; Safari's own release lag is not a GMT input.

## Evidence

`node scripts/native-suite.mjs webkit` on macOS 27.0.1, Playwright 1.63.0 (WebKit 26.6), `main`
at 58d4e150, with the Linux leg's tags. Run 2026-11-08.

- 71,590 tests in 944 files: 71,361 pass. **No control-only failure:** nothing GMT's own code
  gets wrong on Apple's data.
- Workaround check: 25 workarounds, 23 still needed, none removable, 1 guard, 1 out of scope on
  WebKit.
- **2 untagged native failures.** `addDate` and `subtractDate` on Persian dates at -271820, the
  range minimum: JavaScriptCore's native `Temporal` returns an empty string where the polyfill
  returns `-271820-04-09[u-ca=persian]`. An engine defect: tagged with evidence, and filed
  upstream as [ICU-23609](https://unicode-org.atlassian.net/browse/ICU-23609) (open).
- **220 host failures** (both passes fail, so the data is Apple's, not GMT's):
  - 101 match existing tags: ar-SA Islamic default calendar 47, Linux ICU 74 locale data 39,
    legacy zone ids 8, Canada 2026 tz data 7 (`America/Winnipeg` still changes clocks on
    2026-11-01, as on Chromium and Firefox).
  - 119 match none. Apple's ICU locale text: `Feb 3, 2024 at 2:30 PM` for
    `Feb 3, 2024, 2:30 PM`, `14:30 - 16:46` range separators in en-GB, es-ES and zh-CN, no space
    in ja-JP durations (`1日、2時間、30分`), `Uhr` missing from de-DE ranges, across 30 format
    test files. zh-CN weeks start on Sunday (`getLocaleFirstDayOfWeek`, start and end of week,
    week of month, weeks in month). `CST6CDT`, `EST5EDT`, `MST7MDT` and `PST8PDT` refused
    (`isValidTimeZone`, `getTimeZoneOffset`, `toOffsetInstant`, `fromOffsetInstant`).
- **2 stale tags on the Mac:** `browser-morocco-2026-tz-data` and `webkit-linux-tz-data` pass, so
  Apple's tzdb has those changes.

The runner disagrees with that Mac. `temporal-oracle.yml` run 42578821204 on the branch
(`macos-26-arm64`, macOS 26.7.2, WebKit 26.6): 45 untagged host failures and 1 stale tag.

- 44 rows of `oh-morocco.test.ts`: the runner's time zone data predates tzdb 2026c, so
  `browser-morocco-2026-tz-data` names the Mac leg too.
- The pt-PT short weekday names (`webkit-macos-26-pt-pt-short-weekdays`).
- `webkit-posix-zone-ids` is stale: macOS 26.7.2 accepts `CST6CDT`, `EST5EDT`, `MST7MDT` and
  `PST8PDT`, so the group names the Linux leg only.

## Definition of done

- A `workflow_dispatch` run of `temporal-oracle.yml` on `main` shows five native-suite legs, and
  the `webkit-macos` job summary names `macOS WebKit <version>`.
- The `webkit-macos` leg passes, or every failure it reports is tagged with evidence or fixed in
  GMT. No control-only failure is tagged.
- `pnpm --filter dox test` passes with the new leg in every canary test that lists legs.
- The engine page builds, passes the Dox gates and is linked from Install.

## Decisions

Stated as current rules. Where each rule is enforced is named beside it.

**Legs**

- `ENGINE_IDS` in `scripts/lib/workarounds.mjs` is the one list of native-suite legs, in leg order: `node`, `chromium`, `firefox`, `webkit`, `webkit-macos`. `NATIVE_LEGS`, `LEGS`, `COMPAT_SOURCES` and `SOURCE_ENGINE` derive from its keys, so a sixth leg needs no test edit. The swap check keeps its own four legs (`SWAP_LEGS`); the native suite's control pass already tests the shipped polyfill on Apple's data, so `polyfill-swap` has no macOS leg.
- Both WebKit legs are engine `webkit`. A workaround scoped to WebKit (D18, D19) is removable only when both legs' `temporal-compat-*` verdicts say so, and D16 needs all five compat sources. The D16, D18 and D19 trigger rows name both verdicts in `workarounds.mjs`, in `packages/gmt/src/internal/temporalCompat/README.md` and in `apps/dox/src/data/temporal-compat.json` (regenerated by `pnpm compat:snapshot`).
- `LEG_BROWSER` maps each leg to its Playwright browser and Vitest project; `LEG_HOST` names the OS a leg must run on (`webkit`: Linux, `webkit-macos`: macOS). A verdict names the data it tested, so `native-suite.mjs` refuses a leg on the wrong host with two could-not-run verdicts and exit 2, never a result filed under another host's name.
- The engine line is `macOS WebKit <version> · macOS <os version>` for the Mac leg and `WebKit <version>` for the Linux leg, from `engineLine`; the compat verdict and the preflight use it, so one leg's two lines agree. `legLabel` keeps every word before the first version (`macOS WebKit 26`), so each WebKit leg keeps its own issue keys and titles.
- The workflow `native-suite` matrix is `include:` rows with `leg`, `browser` and `os`; the job name stays `Native Temporal suite (<leg>)`, so the report job's artifact parsing needs no change (`temporal-oracle-workflow.test.ts` runs its `awk` program to prove it). `macos-latest` is a moving label on purpose: the leg tests the data Apple ships now, and the engine line records which macOS ran. System packages (`--with-deps`) install on Linux only. The resource trace uses `df -Pk` and, where `free` is missing, `vm_stat`. An `otool -L` step prints which ICU Playwright's JavaScriptCore links (`libicucore` on the Mac) and never fails the job.
- The leg runs on `macos-latest` at no cost because the repository is public (GitHub Docs, "About billing for GitHub Actions"). Brave, Edge, Opera and Vivaldi on desktop run Chromium's engine and bundled ICU, so they have no leg of their own; Chromium on Android, Samsung Internet included, reads a smaller ICU data file no leg loads; DuckDuckGo runs the system engine and has no automation hook. The engine page says both.

**Tags**

- A tag group covers two legs only when one cause, shown by the same received value, holds on both, so a group's `reason` is true on every leg it names. A group covering both WebKit legs has no `linux` in its id. A group the Mac runner passes stays off the Mac leg, or it would go stale there: `webkit-linux-tz-data`, and `webkit-posix-zone-ids` while the runner's macOS 26 accepts those ids. A group the runner fails names the Mac leg even where a newer local Mac passes it: `browser-morocco-2026-tz-data`.
- JavaScriptCore divergences S and T, `webkit-ar-sa-islamic-default-calendar` and `browser-canada-2026-tz-data` (`America/Winnipeg` still changes clocks on 2026-11-01) cover both WebKit legs. The POSIX zone ids `CST6CDT`, `EST5EDT`, `MST7MDT` and `PST8PDT` (group `webkit-posix-zone-ids`) fail on Linux and on macOS 27, not on the runner's macOS 26, so the group names the Linux leg. `webkit-legacy-zone-ids` narrows to `CET`, `EET`, `MET` and `WET` on Linux. Those ids are valid in ECMA-402 §6.5, "Use of the IANA Time Zone Database" (every IANA Zone and Link name), and the IANA `backward` file, so a refusal is the host's defect, and the tag stays whether or not it is filed.
- The `webkit-macos-*` groups hold Apple's ICU locale text, sorted by cause, each with evidence: engine and OS version, one call and its received value, Node 26's value, and the other legs' result. Never a pattern that matches everything; prefer `file` plus a `test` pattern naming the locale or id. Before a week-start or connector row is tagged as host data, the CLDR element for the Node release's ICU decides whether the test's expected value is the wrong one, which is then fixed in the test instead.
- Record AE: ICU4C 75 and later count every Persian year before year 0 as a leap year, so `addDate` and `subtractDate` on a Persian date at ISO -271820 diverge on macOS WebKit. It is an engine defect with the rows tagged on `webkit-macos` only, shipped GMT is right (it runs the polyfill), and nothing about it goes on a Dox page except the bullet in `upstream.mdx` § Native engines. A control-only failure is never tagged; it is a GMT bug and gets fixed.
- Tags are checked against the leg's own run. The runner's macOS can differ from a local Mac, so a branch dispatch of `temporal-oracle.yml` reconciles the Mac tags before merge: a group the runner passes is narrowed or dropped, a new failure is tagged with evidence or fixed. Nothing is filed upstream, and no issue edited, until the owner approves the exact text. The POSIX zone ids are [WebKit bug 330688](https://bugs.webkit.org/show_bug.cgi?id=330688); record AE's text and its icu-support thread sit in `context/domination/js-temporal-polyfill-bugs.md`.

**Engine page and Install's host line**

- `native-engines.mdx` ("Temporal in every engine") tracks the engines' built-in `Temporal` and data, not GMT's support: GMT ships its own `Temporal` and runs on every host the page lists, and the page says so first. It sits in the Migrate group right after `upstream` ("Helping fix Temporal"), never under Start here (`START_HERE`: `install`, `core-rules`, `why-gmt`).
- What GMT needs from a host is one line on Install, linking the engine page. It states no figure by hand: `syntaxFloor` (`~/generated/syntax-floor`) and `gmtNodeEngines` (`~/generated/versions`) are generated before the build. MDX does not evaluate an expression inside a backtick span, so a figure is written as `<code>{…}</code>`. `native-engines.test.ts` checks that the table's leg column equals `NATIVE_LEGS`, that neither page types a version number, that Install uses both figures, that the workflow link is the workflow URL and no dated run, and the sidebar placement; `install-host-line-built.test.ts` checks the figures reach the built Install page.
- The syntax floor is measured, not read from the `tsdown` target (`esnext`): `scripts/syntax-floor.mjs` bundles each `exports` entry in memory with esbuild, polyfill and `jsbi` included, and parses it with acorn (`8.16.0`, exact) from `ecmaVersion` 2015 upward. An entry's floor is the lowest edition that parses; the page's floor is the highest entry floor. A bundle no edition parses exits 2 naming the entry; there is no fallback. The ECMA-262 edition table decides what each edition adds; acorn is the tool, not the authority. `gmtNodeEngines` comes from `packages/gmt/package.json` `engines.node`, and a missing field exits 1.
- Every cell that names a data source cites its primary page, or says "not documented". The iPhone row cites Apple App Review Guidelines §2.5.6 and Apple's BrowserEngineKit documentation, names no law or region, and says only "except where Apple allows another engine". Bun runs JavaScriptCore with its own data and no weekly run tests it. The page states Safari's native `Temporal` status only with a source from WebKit's feature status page or Apple's release notes, and otherwise says nothing, because Playwright's WebKit build is not Safari.
- The page names no browser version it has not run; versions belong to the weekly job summary. It links to the workflow, never to a dated run. The table passes `dox-tables` at 390px.
- Issue #316 and `bundle-size.mdx`, `CORE-80.md` and `domination/overview.md` name five legs (Node 26, Chromium, Firefox, WebKit on Linux and WebKit on macOS) in the reconsideration condition for host `Temporal`.
