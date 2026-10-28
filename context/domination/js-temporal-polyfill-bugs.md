# `@js-temporal/polyfill` — upstream issues and PRs GMT needs

Record of the defects GMT needs fixed in `js-temporal/temporal-polyfill` (and, where noted,
`tc39/proposal-temporal`), the evidence for each, and what has been filed. The owner files every item, or
tells an agent in plain words to post a named one: tc39 #3331 (J) and #3332 (K) were posted that way.

> **Status of this document:** updated 2026-10-28. **Filed:** 13 items by us, plus a comment on the
> maintainer's own PR #361. The newest are tc39 #3331 (J) and #3332 (K), both 2026-10-21. **All six js-temporal PRs
> (#367–#372) are closed unmerged and none was rejected** — each was routed to `tc39/proposal-temporal` first, so the polyfill's rebase stays
> manageable. #373 (release) is open and answered: one release once the rebase has caught up. #361
> merged 2026-09-21. Five tc39 issues (#3327–#3330, #3332) are open with no maintainer reply; #3331 (J) is
> closed as answered (the check is intended, see § J).
> **Nothing is released**, so no GMT workaround retires: `node scripts/temporal-compat.mjs check` reports
> 23 workarounds, 19 still needed, 1 guard (D10) and 3 out of scope (D17, a Firefox-only defect filed as Bugzilla 2085525, § Q; D18, a polyfill defect only JavaScriptCore shows, § R; and D19, another polyfill defect only JavaScriptCore shows, § U; a Node run cannot judge any of the three). The newest are § U (D19) and § R (D18), neither filed yet, with § S and § T, two WebKit engine defects GMT only tags; § I (D12), fixed on `main` with nothing
> to file; § K (D13), fixed there only in part, with the rest filed as tc39 #3332; § N (D14), which arrives with the catch-up;
> and § O (D15), not filed yet and not fixed on either `main`. A, B, C and D are verified on production builds of js-temporal `main` `c8f344c`.
> See "Filed" for the list, **"TODO — after PR #253" for what to pick up next**, and "Corrections and
> contradictions" before changing any GMT trigger.

## Waiting on a release

The one place to check. Each workaround below has a fix on upstream `main` and in no release. Where the last column says
"Nothing", nothing is left to file and the workaround waits only for a release. The latest `@js-temporal/polyfill` release
is 0.5.1, and the latest ICU4C release is 78.3.

| Workaround | Fix on upstream `main` | What else it waits for |
| ---------- | ---------------------- | ---------------------- |
| `zoned.A`: wall clock to exact time at the range limits | js-temporal `05ce7a3` and `95237e0` | Nothing |
| `D2`: buddhist dates before 1582 | js-temporal `2bb6ba1` | Nothing |
| `D3`: Hebrew leap years for negative years | js-temporal `57d7734` (PR #361; `86a89df` on its branch) | `D4`. The two share one group and one code path, and leave together |
| `D4`: Hebrew years 0 and earlier, one day off | ICU `5267bb5778` (unicode-org/icu, ICU-23007). Not a polyfill fix | An ICU4C release with that commit, and a Node release that bundles it as GMT's `engines.node` floor |
| `D16`: `formatRange` cuts long zone names to short and drops offset names (V8, JSC; ICU-20548) | Not a polyfill fix. ICU-20548 is open | An ICU release that keeps `long`, `longGeneric`, `shortOffset` and `longOffset` in range output, in every engine GMT supports. `pnpm compat` reports the Node half: the `D16` probes must all pass on the `engines.node` floor. The weekly `temporal-oracle` run runs the same probes in Chromium, Firefox and WebKit (`temporal-compat-<leg>` verdicts) and files the removal issue only when every engine says removable |
| `D17`: Firefox `formatRange` prints AM/PM for a day period with a zone name (§ Q) | Not a polyfill fix. A SpiderMonkey bug, open as [Bugzilla 2085525](https://bugzilla.mozilla.org/show_bug.cgi?id=2085525) | A Firefox release that prints the flexible day period in a range: the weekly `temporal-oracle` run's compat check in Firefox (`temporal-compat-firefox`) reports D17 removable, and Firefox is the only engine in D17's scope |
| `D18`: Islamic dates before the Hijra read as positive years in WebKit (§ R) | None. Not filed yet | A js-temporal release that reads the Islamic eras (`main` declares them; whether its parser accepts WebKit's `Before Hijra` spelling is untested), or a WebKit that prints the year as V8 does, so every `D18` repro passes in the weekly `temporal-oracle` run's compat check in WebKit (`temporal-compat-webkit`); WebKit is the only engine in D18's scope |
| `D19`: `ZonedDateTime#equals` answers false for two identifiers of one zone where `resolvedOptions` keeps the identifier (§ U) | None. Not filed yet | A js-temporal release that finds a non-primary identifier's primary without `Intl.DateTimeFormat#resolvedOptions`, so the `D19` probe passes in the weekly `temporal-oracle` run's compat check in WebKit (`temporal-compat-webkit`); WebKit is the only engine in D19's scope |
| `D20`: `PlainMonthDay.from` rejects an upper-case `iso8601` calendar annotation (§ V) | tc39 `385b479bf8` | A js-temporal rebase and a release |
| `D5`: Indian calendar before ISO year 1 | js-temporal `8de299a` (PR #361; `b6c9844` on its branch) | Nothing |
| `D6`: non-ISO `until` re-constrains the day | js-temporal `10aeb98` | `D7`. With `10aeb98` and `1c64f14` alone one Hebrew `until` by years is still wrong (Corrections, item 3) |
| `D7`: Hebrew `until` by years throws | js-temporal `1c64f14` (PR #361; `79fb327` on its branch) | The `CompareSurpasses` part of tc39 `196a3191` (C-D7b), which is not on `main`. The `D7.leapMonthEnd` probe fails until it is |
| `D11`: the calendar nudge window is never retried | js-temporal `5af905f` (PR #361; `50d66d2` on its branch) | Nothing |
| `D12`: a seconds offset matched by minutes (§ I) | js-temporal `23d1275` | Nothing |
| `D13`: the transition search skips or stalls (§ K) | js-temporal `a79c6a1`, in part | A further upstream fix, filed as tc39 #3332: `main` still stalls for `Africa/El_Aaiun` in 1976 (§ K). `D13` retires only on a release where every `D13` probe passes |

`D8` is part-way: `2bb6ba1` fixes two of its three probes, and the third needs tc39 `977d11e0` and
`993e6322`, which are not on `main`. `D1`, `D9`, `zoned.B`, `zoned.D` and `zoned.E` have no fix on
`main`. Neither has `D15`, on js-temporal `main` or tc39 `main` (§ O), nor `D19` (§ U).

To check, without cloning anything:

```sh
# Is there a release newer than 0.5.1?
npm view @js-temporal/polyfill version

# Is a fix in that release? "behind" or "identical" means the tag contains the commit.
gh api repos/js-temporal/temporal-polyfill/compare/v<release>...<commit> --jq .status

# D4: is the ICU fix in an ICU4C release?
gh api repos/unicode-org/icu/compare/release-<version>...5267bb5778 --jq .status
```

To confirm a removal, bump `@js-temporal/polyfill` in `packages/gmt/package.json`, install, and run
`pnpm compat`. A group whose probes all pass prints `REMOVABLE` with its removal steps, unless it declares a
guard, which prints `GUARD` until its package moves past the guarded version; follow the steps,
then run `pnpm compat:snapshot`. For `D4`, run `pnpm compat` on the Node release that bundles the
ICU fix. A group that still prints `STILL NEEDED` stays, whatever this table says: the canary
decides, not the commit list.

## TODO — after PR #253

Filing is **stopped** for now. PR #253 (CORE-8) ships with every defect below already worked around
in GMT, so none of this blocks the release. Pick it up afterwards, in this order.

**1. B and E: nothing to post.** tc39 #3328 (B) and #3330 (E) already carry the diff against tc39's
own `polyfill/lib/ecmascript.mjs`, and each reports the patched results on tc39 `e8cc03f`. Re-checked on
2026-10-21: tc39 `main` is still `e8cc03f`, and the lines both diffs touch are unchanged. Neither patch
has been run against tc39's own test suite (`npm test`, `npm run test262`); run both if a maintainer
asks for a PR.

- [x] **tc39 #3328 (B)**: the patch is in the issue.
- [x] **tc39 #3330 (E)**: the patch is in the issue.

**2. Comment on tc39 #3327 (C-D1b) without a patch.** tc39's `polyfill/lib/calendar.mjs` does not
contain the functions the js-temporal diff touches, so transcribing it would be a guess. Say what the
fix has to do, offer to adapt it properly, and carry the **C-D7b** note with it: when tc39
`196a3191` is ported, its **months-loop hunk must be left out** — that hunk is what corrupts the
calendar cache and produces the wrong, non-round-tripping result at ordinary dates. Its
`CompareSurpasses` hunk is the part worth having.

- [ ] Post the #3327 comment, including the C-D7b caveat.

**How to post these — no clone required.** All three are GitHub comments, so nothing needs to be
checked out. Line numbers drift as `main` moves, so re-check the anchors first and paste the patch
as a fenced `diff` block:

```sh
# Re-read the current file straight from GitHub (one call, no clone, no working copy).
gh api -H "Accept: application/vnd.github.raw" \
  repos/tc39/proposal-temporal/contents/polyfill/lib/ecmascript.mjs > /tmp/tc39-ecmascript.mjs

# Confirm the patch still applies where the doc says it does.
grep -n "BEFORE_FIRST_DST\|const MS_MAX\|leftOffsetNs === rightOffsetNs" /tmp/tc39-ecmascript.mjs

# Post. Write the body in a file first: a heredoc keeps backticks and $ out of the shell's reach.
gh issue comment 3328 --repo tc39/proposal-temporal --body-file <draft>.md
```

Verified this way on 2026-09-23: `MathMin` imported at line 52, `MS_MAX` at 129,
`BEFORE_FIRST_DST` at 143, B's `while` loop at 2444, its post-loop `return null` at 2452.

**If a maintainer asks for a PR instead**, then a clone is needed — and it must bring the test262
submodule, or `npm run test262` fails with an empty directory rather than a useful error:

```sh
git clone --recurse-submodules https://github.com/tc39/proposal-temporal.git
cd proposal-temporal/polyfill
npm ci
npm test        # node ./test/all.mjs
npm run test262 # builds, then runs the pinned test262 suite
```

Run both before opening the PR. Neither has been run for these patches — the behaviour was verified
on js-temporal, whose code at these two sites is identical — and both drafts say so plainly, so
saying it again in the PR costs nothing and keeps the claim honest.

**3. Then wait, and let the canary tell you.** Every remaining item is somebody else's clock:

- [ ] **A polyfill release** is the single event that retires workarounds. When one ships, run
      `pnpm compat`; any group whose probes all pass is removable (unless it declares a guard, which
      prints `GUARD` until its package moves past the guarded version), and its removal steps are printed.
      Then `pnpm compat:snapshot` and commit the updated `apps/dox/src/data/temporal-compat.json`.
- [ ] **D4 (ICU)** — nothing to file. It needs an ICU4C release containing `5267bb5778` and a Node
      release bundling it. GMT must never own calendar data, so this one only ever waits.
- [ ] **The coptic minimum** — still unfiled and still probably unnecessary: #370 states that #361's
      coptic `ERA0` change fixes the round trip before the coptic epoch, and #361 has merged.
      Re-check once it is released; file only if a probe still fails.
- [ ] **#373 (release request)** needs no chasing. The maintainers have answered it; re-asking would
      not help.

**Housekeeping when any of the above moves:** run `pnpm upstream:sync` to refresh
`apps/dox/src/data/upstream-filings.json`, and give any newly closed-unmerged filing an `outcome`
saying why — `node scripts/upstream.mjs check` fails without one, because a bare "Closed" reads as a
rejection.

## Environment

|                               |                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date                          | 2026-09-15                                                                                                                                                                                                                                                                                                                                                            |
| Machine                       | macOS (Darwin 25.5.0), arm64                                                                                                                                                                                                                                                                                                                                          |
| Node                          | v24.21.0, ICU 78.3, Unicode 17.0, CLDR 48.0, tzdata 2026c                                                                                                                                                                                                                                                                                                             |
| npm release                   | `@js-temporal/polyfill` 0.5.1 (2025-03-31), still the latest on npm and GitHub                                                                                                                                                                                                                                                                                        |
| js-temporal `main`            | `c8f344c` (2026-05-14), re-checked 2026-09-15 with `gh api repos/js-temporal/temporal-polyfill/commits/main`                                                                                                                                                                                                                                                          |
| Open js-temporal PR checked   | #361 "April 2026 rebase, part 3" (branch `rebase-part3`, base `4128e12`)                                                                                                                                                                                                                                                                                              |
| tc39/proposal-temporal `main` | `e8cc03f` (2026-07-27)                                                                                                                                                                                                                                                                                                                                                |
| Filings checked               | 2026-09-19, read-only with `gh pr view` and `gh issue view`, comments included. js-temporal `main` still `c8f344c`, proposal-temporal `main` still `e8cc03f`, latest js-temporal release still `v0.5.1`, #361 still open                                                                                                                                              |
| Build method                  | `git clone --filter=blob:none`, `npm ci --ignore-scripts`, `NODE_ENV=production npm run build` (the mode `release-checklist.md` publishes with: minified, assertions stripped). One build per patch, each on a clean `c8f344c` tree                                                                                                                                   |
| Repro runner                  | `POLYFILL=<build>/index.esm.js node <repro>.mjs`                                                                                                                                                                                                                                                                                                                      |
| GMT canary                    | `node --import <loader>/register.mjs scripts/temporal-compat.mjs check`, where the loader hook redirects the bare `@js-temporal/polyfill` specifier to the build under test. GMT's `node_modules` were not touched. The canary's header line still prints "0.5.1" because it reads the installed `package.json`; the code under test is the build named by `POLYFILL` |

Expected values are never taken from the polyfill. Their sources are the TC39 spec text, test262,
IANA tzdb rules, and Chromium 152/153 native Temporal as recorded in GMT's canary
(`packages/gmt/src/internal/temporalCompat/repros.ts`). Every repro row below agrees with that canary.

## Summary

| Id  | Title                                                                                               | Ask                                                                                                                                                                                                                                                                                                                                                                    | Filed as                                                                                                                    | Verified?                                                                                                                                | GMT workaround it retires                                                                                                                 | Floor bump                                                                        |
| --- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| A   | Wall clock → exact time at the range limits                                                         | **Release** of `05ce7a3` + `95237e0` (both on `main`). No new patch: `main` passes every max and min row                                                                                                                                                                                                                                                               | js-temporal #373 (release request)                                                                                          | Yes (build of `main`)                                                                                                                    | `zoned.A`: defect-1 fallbacks in `internal/zonedWallClock.ts`, `zonedWallClockOperations.ts`, `*AtLimit` in `zonedWallClockDifference.ts` | `@js-temporal/polyfill` → first release containing both commits                   |
| B   | `GetNamedTimeZoneNextTransition` returns `null` within one search window of the max                 | **Bug report + PR** (new patch). Same code in proposal-temporal: file there too                                                                                                                                                                                                                                                                                        | js-temporal PR #371 + tc39 #3328                                                                                            | Yes (patched build)                                                                                                                      | `zoned.B`: defect-2 transition fallback in `internal/zonedWallClock.ts`                                                                   | same release                                                                      |
| C   | Non-ISO calendars (D1–D8)                                                                           | **Merge #361 + port + release**: #361 carries D3 `0df570c`, D5 `314b112`, D7 `0e32ee0`; port `a41eb67` + `af0cb4b` (D1), `977d11e0` + `993e6322` (D8), `196a3191` surpass hunk (**D7b**); **new patch C-D1b** (`untilCalendar` near the limits, broken in proposal-temporal too). `2bb6ba1` (D2) and `10aeb98` (D6) are on `main`. D4 is ICU `5267bb5778` (unreleased) | D1 → PR #369; D8 → PR #368; D1b → PR #370 + tc39 #3327. **Not filed:** C-D7b, the ask to merge #361 (D3, D5, D7 ride on it) | Yes (per-port and combined builds; canary, repros, 400-day edge scans, Chromium grid). Coptic near the min: UNVERIFIED, out of GMT scope | `internal/temporalCompat/*` D1–D3, D5–D8; D3+D4 shared code stays until ICU/Node                                                          | same release; D4: `engines.node` floor on a Node with ICU containing `5267bb5778` |
| D   | `"UTC"` fast path in `GetPossibleEpochNanoseconds` skips `IsValidEpochNanoseconds`                  | **Port** proposal-temporal PR #3205 (`d90d432`) + release                                                                                                                                                                                                                                                                                                              | js-temporal PR #367                                                                                                         | Yes (patched build)                                                                                                                      | `zoned.D`: `checkUtcValidity` in `internal/zonedWallClockDifference.ts`                                                                   | same release                                                                      |
| E   | Transition search starts in 1847, after the first TZDB transition (1844-12-31)                      | **Bug report + PR** (new patch), both repositories                                                                                                                                                                                                                                                                                                                     | js-temporal PR #372 + tc39 #3330                                                                                            | Only as stated in the filings; not re-run in this document's builds                                                                      | `zoned.E`: defect-3 pre-1847 checks in `internal/zonedWallClock.ts`, `zonedWallClockOperations.ts`                                        | same release                                                                      |
| F   | `calendarToIsoDate` overshoot assertion (tc39 #3292) is reachable, coptic/ethiopic/ethioaa month 13 | **Bug report** to tc39 only; js-temporal has not ported #3292                                                                                                                                                                                                                                                                                                          | tc39 #3329                                                                                                                  | Only as stated in the filing                                                                                                             | none: not in js-temporal, so not in GMT's runtime                                                                                         | none                                                                              |
| H   | The calendar nudge window is never retried (`total`, `round`, `until` with a calendar `smallestUnit`) | **Review and land what is already written**: the port is ptomato's `50d66d2` in js-temporal PR #361. **No filing of our own**, and **no tc39 filing** — tc39 #3168 is already fixed there by #3172 | Comment on js #361 (2026-09-20) adding the reproducer, the scan and the before/after measurements | Yes (Chromium 153 vs 0.5.1: 2,016-row `total`, 12,960-row `round`, 9,940-row `until` scans; 16 + 15 + 15 mismatches, all `month`. `50d66d2` measured on `main` and verified to flip all three) | `D11`: the defect-4 gates in `internal/zonedWallClockDifference.ts` and `internal/plainDateUntil.ts` | `50d66d2` on `main` **and then** a release |
| I   | A zoned string's offset written with seconds is matched by minutes, not exactly | **Release** of `23d1275` (on `main`). No new patch and no filing: `main` already has the fix | Not filed: nothing to file. The release is the one already asked for in #373 | Yes, on 0.5.1 (Node 24.21.0): both `D12` probes fail; expected values from test262 `zoneddatetime-sub-minute-offset.js`, and Chromium 153 native Temporal agrees. `main` read, not built: `lib/ecmascript.ts` has `if (offsetSecondsPart) matchMinute = false` | D12: `matchSecondsOffsetExactly` in `internal/zonedWallClock.ts` and its probe | The first release containing `23d1275` |
| J   | `ZonedDateTime.prototype.toString` writes a string `ZonedDateTime.from` refuses when the local date is −271821-04-19 | **Spec issue** to tc39 only: `InterpretISODateTimeOffset` runs `CheckISODaysRange` on the local date before it matches a written offset. Not a polyfill bug: the polyfill and Chromium both follow the spec | tc39 #3331 (2026-10-21) | Yes: polyfill 0.5.1 (Node 24.21.0) and Chromium 153.0.8010.12 native Temporal both throw `RangeError` | None, and none is wanted: a workaround must compute the spec's answer, and this is the spec's answer. GMT's zoned reads return the sentinel; its instant readers read the string | None |
| K   | The transition search skips, or never returns from, two offset changes inside one 14-day step | **Release** of `a79c6a1` (per-zone search windows, on `main`) fixes the 0.5.1 defect for the zones it lists. **A stall remains on `main`** for `Africa/El_Aaiun` in 1976 (17-day window, three offsets, `bisect` unchanged), which needs a further fix | tc39 #3332 (2026-10-21), for the remaining stall | Yes, on 0.5.1 (Node 22.22.2, 24.21.0, 26.10.0): the `D13` probes fail; expected values from Node 26.10.0's native Temporal and `zdump -v` (tz 2026c). tc39 `main` `e8cc03f` run: the El_Aaiun calls throw the bisection assertion, and a 16-day window fixes them. js-temporal `main` read, not run | `D13`: `internal/zonedTransitionSearch.ts`, gates in `internal/zonedWallClock*.ts` | a release containing `a79c6a1` and the #3332 fix |
| L   | A one-character annotation key (`[a=bc]`, `[x=y]`) is refused by V8's native Temporal | **Nothing to file**: fixed upstream by unicode-org/icu4x#8623 (merged 2026-10-20), waiting for an `ixdtf` release and a V8 roll | **Not filed** (report: unicode-org/icu4x#8620, closed by #8623) | Yes: Node 26.10.0 (V8 14.6.202.34-node.34) and Chromium 153.0.8010.12 throw `RangeError: Temporal error: Invalid annotation key character.`; the polyfill accepts | None: GMT already follows the spec text | None |
| M   | `[u-ca=islamic]` is accepted by V8's native Temporal and read as `islamic-civil` | **Nothing to file**: open upstream as boa-dev/temporal#529 | **Not filed** (report: boa-dev/temporal#529, open) | Yes: Node 26.10.0 and Chromium 153.0.8010.12 return `islamic-civil`; the polyfill throws `RangeError` | None: GMT already follows the spec text | None |
| N   | `ZonedDateTime.prototype.round` to `day` when a date starts twice (V8 throws, the polyfill answers the next day) | **Nothing to file**: the reference polyfill fix `59a51ea9d4` is in proposal-temporal, and js-temporal pulls proposal-temporal commits in order, so the port arrives with that catch-up and its one release (#373) | Not filed: nothing to file | Yes: polyfill 0.5.1 (Node 24.21.0) answers `2010-11-07T00:00:00-03:00`; Node 26.10.0 throws; Chromium 153 and tc39/ecma262#3966 answer `2010-11-06T00:00:00-03:00` | `D14`: `roundZonedDateTime` day branch in `internal/zonedWallClockOperations.ts` and its probe | The first js-temporal release containing `59a51ea9d4` |
| O   | A `Z` string is read by wall clock under `offset: "ignore"`, not as an exact instant | **Not filed yet.** Needs a report to tc39 (the reference polyfill has it too), then js-temporal and V8; tc39 #3331 and #3332 do not cover it. Not fixed on js-temporal `main` `c55b211` or tc39 `main` `e8cc03f` | Not filed upstream yet | Yes: polyfill 0.5.1 and native V8 in Node 24.21.0 (`--harmony-temporal`) both give `2022-07-07T23:14:07Z` for `2022-07-08T00:14:07Z[Europe/London]` with `offset: "ignore"`; the spec gives `2022-07-08T00:14:07Z` | `D15`: `zExactOptions` in `internal/zonedWallClock.ts` and its probe | A release that keeps a `Z` string exact under `ignore`, in the polyfill and in the Node floor's V8 |

## Filed

13 filed under the owner's account (`craig-o-curtis`): 11 by the owner, and tc39 #3331 and #3332 by an
agent on the owner's instruction. There is also a fourteenth entry on the `/upstream/` tracker that is
**not** a filing of ours: our comment on ptomato's js-temporal PR #361 (§ H), tracked because its
state is what retires GMT's `D11`. "Filed" is `createdAt`, UTC. "js" is js-temporal/temporal-polyfill,
"tc39" is tc39/proposal-temporal.

**Status as of 2026-10-24** (`gh pr view` / `gh issue view`, comments included). Nothing has moved
since 2026-09-21 except tc39 #3331: all six js PRs closed, #373 open, #361 merged, and the four older
tc39 issues open with our own cross-link as the only comment. tc39 #3332, filed 2026-10-21, has no
comments. tc39 #3331 closed as answered on 2026-10-24, with our comment linking the champions' answer
on #3014.

- **All six js PRs (#367–#372) are closed, unmerged — and none was rejected.** ptomato closed #367,
  #368 and #369 with "I'd prefer to keep the commits ported in order — otherwise the rebases become
  unmanageable", and #370, #371 and #372 with "I'll plan to apply this in proposal-temporal and pull
  it in here after it's been merged there". Every defect stands; only the route changed.
- **#373 (release request) is open**, answered: "we'd prefer to just make one release once it has
  caught up to the current state of the spec."
- **#361 merged on 2026-09-21**, which lands `50d66d2` (D11) on the polyfill's `main` along with D3,
  D5, D7 and the ICU 78 calendar fixes. Nothing is released yet, so no GMT workaround retires.
- **Five tc39 issues (#3327–#3330, #3332) are open with no maintainer reply** (checked 2026-10-24); the
  only comments are our own cross-links.
- **tc39 #3331 is closed as answered** (2026-10-24): the champions had already said on #3014 that
  the check is intended until tc39/ecma262#3464 lands (§ J).

| Repository | #    | Kind  | Title                                                                                                         | Carries                                                                       | Pairs with                                                         | Depends on | Closes                                                                                  | Filed      |
| ---------- | ---- | ----- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------- | ---------- |
| js         | 367  | PR    | Polyfill: Validate result in UTC fast path in GetPossibleEpochNanoseconds                                     | D (port of tc39 `d90d432`, #3205)                                             | none open: tc39 side already merged (#3205 for #3203)              | —          | nothing open; cites tc39 #3205 and #3203                                                | 2026-09-18 |
| js         | 368  | PR    | Polyfill: Update Meiji era start date                                                                         | C-D8 (port of tc39 `977d11e` + `993e632`)                                     | none: port of tc39 commits                                         | —          | nothing                                                                                 | 2026-09-18 |
| js         | 369  | PR    | Polyfill: Fix extreme PlainYearMonth crash in non-ISO calendars                                               | C-D1 (port of tc39 `a41eb67` + `af0cb4b`)                                     | none: port of tc39 commits                                         | —          | nothing                                                                                 | 2026-09-18 |
| js         | 370  | PR    | Don't format dates past the range limit when counting months in until()                                       | C-D1b (new)                                                                   | tc39 #3327                                                         | js #369    | nothing                                                                                 | 2026-09-18 |
| js         | 371  | PR    | Search the last partial window when looking for the next time zone transition                                 | B (new)                                                                       | tc39 #3328                                                         | —          | nothing                                                                                 | 2026-09-18 |
| js         | 372  | PR    | Start the time zone transition search before the first transition in 1844                                     | E (new)                                                                       | tc39 #3330                                                         | —          | nothing                                                                                 | 2026-09-19 |
| js         | 373  | issue | Release request: main has fixes that 0.5.1 doesn't (ZonedDateTime near the Instant limits, #341, #347)        | A                                                                             | —                                                                  | —          | #341 and #347, by the release it asks for ("A release would let both issues be closed") | 2026-09-19 |
| tc39       | 3327 | issue | Polyfill: non-ISO until() by months gives wrong results since #3245, and throws near the range limits         | C-D1b, plus a regression at ordinary dates from tc39 #3245 (new; see C's log) | js #370                                                            | —          | nothing                                                                                 | 2026-09-18 |
| tc39       | 3328 | issue | Polyfill: GetNamedTimeZoneNextTransition misses a transition in the last search window before the max Instant | B                                                                             | js #371                                                            | —          | nothing                                                                                 | 2026-09-18 |
| tc39       | 3329 | issue | Polyfill: calendarToIsoDate overshoot assertion from #3292 is reachable in coptic/ethiopic/ethioaa month 13   | F (new)                                                                       | none: js-temporal has not ported #3292, so it doesn't have the bug | —          | nothing                                                                                 | 2026-09-18 |
| tc39       | 3330 | issue | Polyfill: time zone transitions before 1847 are not found (Asia/Manila and four Pacific zones on 1844-12-31)  | E                                                                             | js #372                                                            | —          | nothing                                                                                 | 2026-09-19 |
| tc39       | 3331 | issue | ZonedDateTime.from rejects ZonedDateTime.prototype.toString's output when the local date is -271821-04-19     | J (spec question)                                                             | none: not a polyfill defect                                        | —          | nothing                                                                                 | 2026-10-21 |
| tc39       | 3332 | issue | Polyfill: getTimeZoneTransition throws a bisection assertion for Africa/El_Aaiun in 1976                      | K (the remaining stall; new)                                                  | none: js-temporal gets it with the in-order catch-up               | —          | nothing                                                                                 | 2026-10-21 |

Notes on the filings:

- **#373 is an issue**, so it can't close anything by keyword. It names #341 and #347 as fixed on `main`
  (`2bb6ba1`, `3c40368`) and leaves them for the maintainer to close after a release. It mentions #361 only as
  an aside ("A release after #361 lands would be great too, since it would also fix #360") and says #367–#372
  need not hold up the release.
- **B was filed as a PR only** in js-temporal. #371's description carries the full report, so no separate
  js-temporal issue was opened.
- **#370 depends on #369.** Per #370, with #370 alone 32 `until()` calls near the minimum (persian and
  islamic-\*) that `main` answers start to throw, because `main`'s cache had hidden the unfixed D1 conversions;
  with #369 underneath all of them work. Either PR applies cleanly on `main`, on the other, and with #361.
- **#372 and #371** touch different parts of `lib/ecmascript.ts` and apply together (per #372).
- Every js-temporal PR states: Node 24.21.0 (ICU 78.3), jest 607 passed, and the pinned test262 passes with no
  new failures or unexpected passes. This closes the "run `npm test` and `npm run test262`" item under "Not
  verified" for #367–#372, as the filings' claim; it was not re-run for this document.

### Still unfiled

Re-derived 2026-09-22, after the maintainer closed all six js-temporal PRs and merged #361.

**What the closures established.** Every one was an acceptance with a routing instruction, not a
rejection: ports must land "in order" so the rebase stays manageable (#367, #368, #369), and new
fixes should be applied "in proposal-temporal and pull[ed] in here after" (#370, #371, #372). #373
stays open because the maintainers "would prefer to just make one release once it has caught up to
the current state of the spec". So the route is **tc39 → polyfill rebase → one release**, and the
only filings worth making now are in tc39.

1. **B (#3328) and E (#3330): nothing to post.** Both issues already carry the diff against tc39's
   `polyfill/lib/ecmascript.mjs` and the patched results on tc39 `e8cc03f`. Neither patch has been run
   against tc39's own test suite; that is needed only if a maintainer asks for a PR.
2. **C-D1b (#3327): do not port blind.** tc39's `polyfill/lib/calendar.mjs` does not contain the
   function names the js-temporal diff touches, so the change needs adapting properly rather than
   transcribing. Say so on the issue and offer to do it, rather than posting a guess.
3. **C-D7b** — the `CompareSurpasses` hunk of tc39 `196a3191`. Its source is already in tc39, so
   there is nothing to file there; it is a note on #3327 that the months-loop hunk of that commit
   must be left out when it is ported, because that hunk is what corrupts the calendar cache.
4. **The ask to merge #361 — done.** It merged 2026-09-21, which lands D3, D5, D7, the ICU 78 fixes
   for chinese/dangi and coptic, the D11 nudge-window port (`50d66d2`), and closes #360. None of it
   is released, so every GMT workaround stays; `pnpm compat` is unchanged at 13 of 14 groups needed.
5. **D4, the ICU note.** Nothing to file. It waits for an ICU4C release containing `5267bb5778` and
   a Node release bundling it.
6. **The coptic minimum.** Still not filed and still probably unnecessary: #370 states that #361's
   coptic `ERA0` change fixes the round trip before the coptic epoch, and #361 has now merged.
7. **A release (#373) is the one remaining ask of ours that is open**, and the maintainers have
   already answered it: after the rebase. Nothing to add — re-asking would not help.
8. **J: tc39 #3331, closed as answered.** A question about the spec text, so it went to
   tc39/proposal-temporal only. The check is intended until tc39/ecma262#3464 lands; the polyfill,
   Chromium and Node agree with the spec, and there is no patch to offer. See § J.
9. **I (D12).** Nothing to file: fixed on js-temporal `main` by `23d1275`, and the release is #373.
10. **K (D13): filed as tc39 #3332 (2026-10-21).** The stall that `a79c6a1` leaves for
    `Africa/El_Aaiun` in 1976. The issue proposes a 16-day window for that zone. `a79c6a1` alone does
    not retire `D13`. See § K.
11. **N (D14).** Nothing to file: the fix is proposal-temporal `59a51ea9d4`, which js-temporal's
    in-order catch-up has not reached yet. It arrives with that catch-up and the release in #373.
12. **R (D18): to file on js-temporal/temporal-polyfill**, from the draft. The Islamic helpers'
    era-less read is a polyfill defect on its own terms, and `main`'s era declarations may not cover
    WebKit's spelling; WebKit's own era output follows CLDR, so there is nothing to file at WebKit.
    See § R.
13. **W: to file on tc39/proposal-temporal first** (then the polyfill rebase). `PlainMonthDay.from`
    accepts `--02-30`, `--04-31`, `0230` and `--0230`: `ParseTemporalMonthDayString` never applies the
    IsValidMonthDay early error, and the tc39 reference polyfill has the same gap. GMT needs no
    workaround (the `plainMonthDay` regex refuses these strings first), so W has no D-number. See § W.
14. **X: to file on tc39/proposal-temporal first** (then the polyfill rebase). `toLocaleString` builds
    its Temporal formats from a clone of `resolvedOptions()`, so in zh-CN, zh-TW and ja-JP a requested
    `month: "long"` or `"short"` comes back numeric (`12/25` for `12月25日`, `2024/12/25` for a
    PlainDate). Chromium 153 shows the same for `PlainMonthDay` and `PlainDate`, which needs a
    separate V8 report; WebKit 26.6 does not. GMT never calls `toLocaleString`, so X has no
    D-number. See § X.
15. **Y: to file on js-temporal/temporal-polyfill after the rebase, or on tc39 if its polyfill differs.**
    `PlainYearMonth#add` and `#subtract` predate tc39 `41faca474a`: they accept weeks, days and time,
    and a subtraction still starts from the last day of the month. GMT never calls them, so Y has no
    D-number. See § Y.
16. **Z: to file on js-temporal/temporal-polyfill, or on tc39 if its polyfill differs.**
    `PlainYearMonth#toLocaleString` with only `era` prints a day (`10/1/2026 AD`) where the
    specification and WebKit print `10/2026 AD`; Chromium prints just `AD`. GMT calls Intl itself, so Z
    has no D-number. See § Z.
17. **AA: to file on js-temporal/temporal-polyfill, or on tc39 if its polyfill differs.**
    `PlainYearMonth#toLocaleString` and `PlainMonthDay#toLocaleString` accept a `timeStyle` and drop
    it, where the specification and both native engines throw a `TypeError`. GMT calls Intl itself, so
    AA has no D-number. See § AA.

## Upstream issues these fixes close

Verified 2026-09-18, same Environment as above (Node v24.21.0, ICU 78.3), on production builds from a fresh
`git clone` of js-temporal/temporal-polyfill whose `main` is still `c8f344c`. Each issue's reproduction was
taken verbatim from its own text and run against npm 0.5.1, `main`, and a build carrying the commit under
test. Trees were extracted with `git archive <sha>`, so no branch or checkout was created anywhere.

Three open issues are affected. Every other open issue in either repository is unrelated to A–D (as of
2026-09-18, before the owner's own filings in "Filed").

| Issue            | Title                                                                        | Closed by                                                                           | Evidence                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| js-temporal #341 | Incorrect conversion between calendars                                       | **A** (release of `main`). Fixing commit `2bb6ba1` = D2, which C's Ask item 4 names | The issue's row `PlainDate.from({ year: 1582, month: 1, day: 1 }).withCalendar('buddhist').month`: npm 0.5.1 and a build of `2bb6ba1^` give `12` (day `22`, year `2124`); builds of `2bb6ba1` and of `main` give `1` (day `1`, year `2125`), the value the issue states is correct. japanese and roc rows unchanged                                                                     |
| js-temporal #347 | ZonedDateTime until / since assertion failure: mixed-sign values not allowed | **A** (release of `main`). Fixing commit `3c40368`                                  | The issue's own America/Vancouver rows: npm 0.5.1 and a build of `3c40368^` throw `RangeError: mixed-sign values not allowed as duration fields`; builds of `3c40368` and of `main` return `-PT59M` and `PT59M`                                                                                                                                                                         |
| js-temporal #360 | Bug: Malformed leap month suffix while implementing Chinese calendar         | **C** (merge #361, which carries `16dff41`)                                         | The issue's repro (`Temporal.Now.plainDateISO()` → `withCalendar('chinese')` → `.year`/`.month`/`.monthCode`/`.monthsInYear`) throws `Unexpected leap month suffix: Mo8` on 0.5.1 and on `main`; on `main` + `16dff41` it returns `M08`, `8`, `12`. A leap-month row, `2025-08-01`, goes from `Unexpected leap month suffix: Mo6bis` to `M06L` / month 7 / 13. `dangi` behaves the same |

**Expected-value sources.** For #341, the issue's own statement and tc39/ecma402#1003: the Gregorian-derived
calendars are proleptic, so converting `1582-01-01` changes only the year. For #347, spec
`DifferenceZonedDateTime` (`zoneddatetime.html`) step 4 — when
`CompareISODate(startDateTime.[[ISODate]], endDateTime.[[ISODate]])` is 0 the result is
`CombineDateAndTimeDuration(ZeroDateDuration(), TimeDurationFromEpochNanosecondsDifference(ns2, ns1))`, a pure
time difference of −59 minutes with no day correction and so no mixed sign; `3c40368` is the port of
proposal-temporal `87af06d0`, which fixed tc39/proposal-temporal #3141, #3148 and #3149 (all closed there).
For #360, `Intl.DateTimeFormat('en-u-ca-chinese')` on the same ICU 78.3 formats `2026-09-18` as "Eighth Month"
and `2025-08-01` as "Sixth Monthbis 8, 2025(yi-si)", so `M08` and `M06L` are the codes ICU's own data implies.

**Wording to use when filing.**

| Item | Line                                                                                                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A    | `Closes #341` and `Closes #347`. Both are reported against 0.5.1, both are already fixed on `main`, so the release closes them.                                          |
| B    | None. No open issue in either repository describes this defect.                                                                                                          |
| C    | #361 already carries `Closes: #360` in its own description, so merging it closes #360; say "merging #361 also closes #360" in the port request rather than repeating it. |
| D    | None open. Cite the upstream pair instead: "Ports tc39/proposal-temporal#3205, which fixed tc39/proposal-temporal#3203 (both closed there)."                             |

**As filed (2026-09-19).** A: #373 names #341 and #347 but, being an issue, can't close them by keyword (see
"Filed"). B: #371 and tc39 #3328 carry no `Closes` line, as planned; they are now the reports of B in both
repositories. C: #368, #369 and #370 carry no `Closes` line; #369 mentions #360 only as fixed by #361, and the
merge-#361 request itself is unfiled. D: #367 cites "tc39/proposal-temporal#3205, which fixes
tc39/proposal-temporal#3203", as planned.

**Checked and unrelated, one line each.** #363 `Temporal.Now` property descriptor; #352 `ZonedDateTimeLike`
typing; #346 no enumerable own properties; #345 JSBI in `ZonedDateTime.compare` (the maintainer's script
already returns `-1` on 0.5.1 here); #344 Hermes/iOS `resolvedOptions().calendar` undefined; #276
error-message wording; #272 and #271 islamic/persian `inLeapYear` and `dayOfYear`, both already correct on
npm 0.5.1 (umalqura 1445 → `daysInYear` 354, `inLeapYear` false; 1445-01-01 → `dayOfYear` 1); #223 offset
zones in `toLocaleString`, an ECMA-402 gap; #209 far-off DST transition policy — a strategy-and-cost
question, and B's patch keeps the same search window and only probes the last partial one; #195 CLDR versus
IANA zone canonicalisation; #145 ISO week strings; #336, #335, #321 and #301 packaging and bundle size; the
remaining open issues are housekeeping, tooling and feature requests. None of these are in scope here.

## Duplicate search (read-only, 2026-09-15; re-checked 2026-09-18)

`gh search issues --include-prs` on both repositories. The 2026-09-18 pass instead listed **every** open
issue in js-temporal/temporal-polyfill (48) and read each candidate with `gh issue view`, comments included.
Corrections from that pass are marked **2026-09-18**.

**js-temporal/temporal-polyfill**

| Query                                                                                      | Result                                                                                                                       |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `GetNamedTimeZoneEpochNanoseconds`, `Invalid time value`                                   | none                                                                                                                         |
| `release 0.5.2`, `new release`                                                             | only old merged maintenance PRs (#320, #331, #297); no open release request                                                  |
| `GetNamedTimeZoneNextTransition`                                                           | #292 (merged 2023 rebase), unrelated                                                                                         |
| `getTimeZoneTransition null`, `startOfDay TypeError`, `Cannot read properties of null`     | none                                                                                                                         |
| `extreme dates calendar`, `Invalid ISO date`, `hebrew leap`, `Saka`, `Meiji`, `coptic era` | none                                                                                                                         |
| `calendarToIsoDate`                                                                        | #341 (open) "Incorrect conversion between calendars": buddhist/japanese before 1582, i.e. D2, fixed on `main` by `2bb6ba1`   |
| `mixed-sign`                                                                               | #347 (open): ZonedDateTime `until` mixed-sign across a DST fold in ISO. Different from D7 (non-ISO calendar `untilCalendar`) |
| `UTC fast path`, `GetPossibleEpochNanoseconds`, `outside of supported range UTC`           | none                                                                                                                         |
| every open issue, listed and read (**2026-09-18**)                                         | 48 open. Only #341, #347 and #360 are affected by A–D; see "Upstream issues these fixes close"                               |

**2026-09-18 corrections to the two rows above.**

- **#341 confirmed by build.** `2bb6ba1^` reproduces the issue's row, `2bb6ba1` and `main` do not. It needs
  only the release, so it belongs to A's ask, not to a new patch.
- **#347 corrected.** Still different from D7, as the 2026-09-15 row says — but it is **already fixed on
  `main`**, by `3c40368` (port of proposal-temporal `87af06d0`, for the closed tc39/proposal-temporal #3141,
  #3148, #3149). It is therefore not an open defect this record has to fix; A's release closes it.

Related open items: PR #361 (ports D3, D5, D7 plus ICU 78 fixes for coptic and chinese/dangi; closes #360 —
**2026-09-18:** confirmed, #361's own description carries `Closes: #360`, and `main` + its `16dff41` fixes the
repro in #360); PR #357 (ethiopic era codes for CLDR 48); #209 (far-off DST transition look-ahead policy —
a strategy-and-cost question, unaffected by B).

**tc39/proposal-temporal**

| Query                            | Result                                                                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GetNamedTimeZoneNextTransition` | #3110 (closed) "startOfDay bug for edge cases": two transitions within one 14-day window. Different defect, fixed by per-zone search windows (js-temporal `a79c6a1`). Not a duplicate of B |
| `next transition null maximum`   | none on 2026-09-15: B was unreported in both repositories. **Since filed** as tc39 #3328 and js-temporal #371 (2026-09-18)                                                                 |
| `UTC fast path`                  | #3203 (closed) + PR #3205 (merged 2025-12-11): **D, already fixed in proposal-temporal**                                                                                                   |
| `3159`                           | #3159 + PR #3176: D7, fixed as `0e32ee0`                                                                                                                                                   |

---

## A. Wall clock → exact time at the range limits: release request

### Title

Release request: `main` fixes ZonedDateTime work at both Instant limits (`05ce7a3`, `95237e0`), 0.5.1 throws

### Status

| Build                                                   | Result (`repro-A-wall-clock-range-limits.mjs`, 13 rows + 3 controls)                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| npm 0.5.1                                               | **13 FAIL** (every max and min row), 3 controls pass                                                   |
| 0.5.1 + `05ce7a3` only (previous research's `fixA.mjs`) | 8 max rows pass, **5 min rows FAIL** with `RangeError: date/time value is outside the supported range` |
| js-temporal `main` `c8f344c` (production build)         | **16/16 PASS**                                                                                         |
| GMT canary on `main` build                              | `zoned.A` 10/10 REMOVABLE                                                                              |

### Correction to earlier GMT notes

GMT's canary comment, `temporalCompat/README.md`, `zonedWallClock.ts`, `zonedWallClockOperations.ts`,
`scripts/temporal-compat.mjs` all say the minimum edge is "still broken
upstream" and needs "a separate fix". **That is wrong for current `main`.** It was measured on
0.5.1 + `05ce7a3` only. Two commits on `main` are needed, and both are there:

1. **`05ce7a3`** "Polyfill: Correctly handle limits in GetNamedTimeZoneEpochNanoseconds" (port of
   proposal-temporal `0096343850`, merged via #359 on 2026-04-22). It clamps the ±1 day offset probes
   to `NS_MIN`/`NS_MAX` instead of back to `ns` (`lib/ecmascript.ts` l.2910–2913 on `c8f344c`).
   Fixes the max rows.
2. **`95237e0`** "Editorial: Revert inadvertent observable change" (port of proposal-temporal
   `6274e5de91`, committed 2026-04-22). It deletes `CheckISODaysRange(isoDateTime.isoDate)` before
   `GetNamedTimeZoneEpochNanoseconds` in `GetPossibleEpochNanoseconds`. For a `-271821-04-19` wall
   clock that check ran on the _local_ date and threw although the instant is valid. Fixes the min rows.

No min-edge patch is needed; none was written. The GMT trigger for `zoned.A` becomes "a release
containing `05ce7a3` and `95237e0`".

### Repro

```js
import { Temporal } from "@js-temporal/polyfill";
const MAX = 8640000000000000000000n,
  MIN = -MAX,
  D = 86400000000000n,
  H = 3600000000000n;
const z = (ns, tz) => new Temporal.ZonedDateTime(ns, tz);
// maximum edge (positive-offset zones)
Temporal.ZonedDateTime.from("+275760-09-13T09:00:00+10:00[Australia/Sydney]"); // 0.5.1: RangeError: Invalid time value
z(MAX - D, "Australia/Sydney").until(z(MAX, "Australia/Sydney"), {
  largestUnit: "day",
}); // expected P1D
z(MAX - 3n * D - 5n * H, "Australia/Sydney").since(z(MAX, "Australia/Sydney"), {
  largestUnit: "year",
}); // expected -P3DT5H
Temporal.Duration.from("PT49H").total({
  unit: "day",
  relativeTo: z(MAX - 3n * D - 5n * H, "Australia/Sydney"),
}); // expected 2.0416666666666665
// minimum edge (negative-offset zones; New York LMT is -04:56:02, min instant = -271821-04-19T19:03:58 local)
Temporal.ZonedDateTime.from("-271821-04-19T20:00:00[America/New_York]"); // expected -271821-04-19T20:00:00-04:56[America/New_York]
// 0.5.1: RangeError: date/time value is outside the supported range
z(MIN + D, "Pacific/Honolulu").until(z(MIN, "Pacific/Honolulu"), {
  largestUnit: "day",
}); // expected -P1D
```

Controls that must keep throwing (all builds throw, as the spec requires): a Sydney wall clock one
nanosecond past the max instant; a New York wall clock before the min instant; `until` with
`smallestUnit: "day"` whose rounding window ends past the max.

**Expected-value sources.** `InterpretISODateTimeOffset` → `GetPossibleEpochNanoseconds` →
`GetNamedTimeZoneEpochNanoseconds` returns an instant inside `IsValidEpochNanoseconds`; the named-zone
branch has no `CheckISODaysRange` (spec `timezone.html`, and the `6274e5de91` commit message).
`DifferenceZonedDateTime` resolves only wall clocks not after the later operand (`zoneddatetime.html`).
test262 `built-ins/Temporal/ZonedDateTime/from/argument-string-limits.js`. Chromium 152/153 return every
value (GMT canary `zoned.A`).

### Ask

> Please publish a release (0.5.2 or 0.6.0) of the current `main`. 0.5.1 throws for in-range
> ZonedDateTime values within about a day of both Instant limits: parsing, `toZonedDateTime`,
> `until`/`since`, `Duration#total`/`round`/`compare` with `relativeTo`. `main` is correct at both
> edges thanks to `05ce7a3` and `95237e0`.

**Closes:** `Closes #341` and `Closes #347`. Both are reported against 0.5.1, both already pass on `main`
(`2bb6ba1` and `3c40368` respectively), so the release closes them and no extra patch is needed. Evidence in
"Upstream issues these fixes close".

**Filed as:** js-temporal issue #373, 2026-09-19, "Release request: main has fixes that 0.5.1 doesn't
(ZonedDateTime near the Instant limits, #341, #347)". It gives three of the 13 limit rows, #341's buddhist row
and #347's Vancouver rows (0.5.1 against a production build of `c8f344c`), notes that 0.5.1 is 76 commits behind
`main`, and asks for no wait on #361 or #367–#372. As an issue it can't close #341 and #347 by keyword; it asks
for the release that lets the maintainer close them.

---

## B. `GetNamedTimeZoneNextTransition` returns `null` within one search window of the max Instant

### Title

`getTimeZoneTransition("next")` misses a transition in the last search window before the max Instant; `startOfDay` / `toZonedDateTime` / `hoursInDay` then throw TypeError

### Status

| Build                | `repro-B-next-transition-near-max.mjs` (6 rows + 2 controls)                      | `repro-B-regression-rows.mjs` (12 rows)                                    | Canary `zoned.B`  |
| -------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------- |
| npm 0.5.1            | 6 FAIL                                                                            | —                                                                          | 3/3 STILL NEEDED  |
| `main` `c8f344c`     | **6 FAIL** (`null`, `TypeError: Cannot read properties of null (reading 'sign')`) | 11 pass, **1 FAIL** (Santiago `hoursInDay` on `+275760-09-06` also throws) | 3/3 STILL NEEDED  |
| `main` + patch below | **8/8 PASS**                                                                      | **12/12 PASS**                                                             | **3/3 REMOVABLE** |

The same code is in tc39/proposal-temporal `main` (`polyfill/lib/ecmascript.mjs` l.2444–2446 at
`e8cc03f`). File in proposal-temporal as well, or ask js-temporal to upstream it. **Filed in both** (see Ask).

### Repro

```js
import { Temporal } from "@js-temporal/polyfill";
// America/Santiago: -04:00 -> -03:00 at +275760-09-07T04:00:00Z (local midnight skipped), 6 days before the max.
const T = "+275760-09-07T01:00:00-03:00[America/Santiago]";
Temporal.Instant.from("+275760-09-01T00:00:00Z")
  .toZonedDateTimeISO("America/Santiago")
  .getTimeZoneTransition("next");
//   expected T; main: null
new Temporal.ZonedDateTime(
  8640000000000000000000n,
  "America/Santiago",
).getTimeZoneTransition("previous");
//   T (control: the transition exists and is found backwards)
Temporal.PlainDate.from("+275760-09-07").toZonedDateTime("America/Santiago");
//   expected T; main: TypeError: Cannot read properties of null (reading 'sign')
Temporal.ZonedDateTime.from("+275760-09-07T12:00[America/Santiago]").hoursInDay;
//   expected 23; main: same TypeError
Temporal.ZonedDateTime.from("+275760-09-06T12:00[America/Santiago]").hoursInDay;
//   expected 24; main: same TypeError (its end-of-day is the start of 09-07)
```

**Expected-value sources.** Spec `GetNamedTimeZoneNextTransition` (`timezone.html`): the result is
_null_ only "if no such transition exists for which t ≤ ℤ(nsMaxInstant)". Here t =
`+275760-09-07T04:00:00Z` ≤ nsMaxInstant. `GetStartOfDay`: midnight is in the gap, so the start of day is
the transition instant, displayed `01:00-03:00`, and the day has 23 hours. Chromium 153 returns these
values (GMT canary `zoned.B`). The offsets on either side are read directly in the same repro
(`-04:00` at `03:59:59Z`, `-03:00` at `04:00:00Z`).

### Root cause (`lib/ecmascript.ts` on `c8f344c`)

```ts
2775  while (leftOffsetNs === rightOffsetNs && leftMs < uppercap) {
2776    rightMs = leftMs + searchWindow;      // searchWindowForTransitions(id): 19 days by default
2777    if (rightMs > MS_MAX) return null;    // gives up without probing [leftMs, MS_MAX]
```

When the last offset change lies within one window of `MS_MAX`, the loop returns before probing it.
`GetStartOfDay` (l.2283) then does `castExists(GetNamedTimeZoneNextTransition(...))`. `castExists` is
stripped in production builds, so `null` reaches `ValidateEpochNanoseconds` / JSBI and throws a
TypeError instead of a RangeError.

### Patch (against `c8f344c`, verified)

```diff
diff --git a/lib/ecmascript.ts b/lib/ecmascript.ts
index 8e7dd0e..daaadbd 100644
--- a/lib/ecmascript.ts
+++ b/lib/ecmascript.ts
@@ -2772,9 +2772,10 @@ export function GetNamedTimeZoneNextTransition(id: string, epochNanoseconds: JSB
   let rightMs = leftMs;
   let rightOffsetNs = leftOffsetNs;
   const searchWindow = searchWindowForTransitions(id);
-  while (leftOffsetNs === rightOffsetNs && leftMs < uppercap) {
-    rightMs = leftMs + searchWindow;
-    if (rightMs > MS_MAX) return null;
+  // Search the last, partial window up to MS_MAX instead of giving up, so that
+  // a transition at or before nsMaxInstant is still found.
+  while (leftOffsetNs === rightOffsetNs && leftMs < uppercap && leftMs < MS_MAX) {
+    rightMs = Math.min(leftMs + searchWindow, MS_MAX);
     rightOffsetNs = GetNamedTimeZoneOffsetNanosecondsImpl(id, rightMs);
     if (leftOffsetNs === rightOffsetNs) {
       leftMs = rightMs;
```

Termination: `leftMs` strictly increases until it reaches `MS_MAX`, where the loop condition stops it,
and the existing `if (leftOffsetNs === rightOffsetNs) return null;` after the loop returns `null`.
`bisect` then works on `(leftMs, rightMs] ⊆ (…, MS_MAX]`, a valid legacy-Date range.

### Verification

Method: production build of `c8f344c` with only this diff applied (`builds/B`), against a production
build of unmodified `c8f344c` (`builds/main`).

- `repro-B-next-transition-near-max.mjs`: `main` 2 pass / 6 fail; patched 8/8.
- `repro-B-regression-rows.mjs`, rows that must not change: New York next transition from 2026-01-01
  (`2026-03-08T03:00:00-04:00`); Santiago from 2026-01-01 (`2026-04-04T23:00:00-04:00`, tzdb
  `Rule Chile 2023 max - Apr Sun>=2 3:00u`); Tokyo `null`; `null` from `+275760-09-01` in New York and
  Tokyo, from the Santiago transition itself, and from the max instant in Santiago and New York; a
  Santiago lookup from `+275760-08-20` (more than one window back); start of day on `+275760-09-06`
  Santiago and `+275760-09-12` New York. `main` 11/12 (the `+275760-09-06` `hoursInDay` row throws);
  patched 12/12.
- GMT canary on the patched build: `zoned.B` 3/3 REMOVABLE; no other group changed.
- Not run here: the polyfill's own jest suite and test262 (see "Not verified"). **#371 states** jest 607 passed
  and the pinned test262 passes (intl402/Temporal 330 + 8 expected failures, built-ins/Temporal 4330).
- **Added by the filings** (#371, tc39 #3328; their own evidence, not re-run here): the miss is not limited to
  the last 19 days. From 00:00Z on each of the last 61 days, `next` in America/Santiago returns `null` on 39,
  the earliest `+275760-07-19`. Across nine zones × 61 days, `main` has 39 wrong rows (all Santiago) and the
  patch 0, against Chrome 153; `next`/`previous` from every day of 2020–2030 in the same zones (36,162 lookups)
  are byte-identical with and without the patch; the first transition after 1800 and `previous` from just after
  it are byte-identical in all 418 zones. Development builds throw `Error: Expected arg to be set.` instead of the
  TypeError. On tc39 `main` the same rows throw `TypeError: Cannot read properties of null (reading 'lesser')`
  (`'value'`, `'subtract'` for the `hoursInDay` rows); the tc39 diff uses `MathMin`.

### Ask

Bug report + PR with the diff above, in js-temporal/temporal-polyfill, and the equivalent
`ecmascript.mjs` change in tc39/proposal-temporal (same three lines).

**Closes:** nothing open. No issue in either repository described this defect before the filings below, which
are the first reports. (#209 is about the cost and strategy of the transition search, not about a missed
transition, and this patch keeps the same search window.)

**Filed as:** js-temporal PR #371 (2026-09-18), "Search the last partial window when looking for the next time
zone transition", with the diff above; and tc39/proposal-temporal issue #3328 (2026-09-18) with the same change
to `ecmascript.mjs`. Cross-linked both ways. No separate js-temporal issue: #371's description is the report.
Independent of #367–#370 and #361.

---

## C. Non-ISO calendars: port-and-release request

### Title

Port and release the non-ISO calendar fixes from proposal-temporal (D1, D3, D5, D7, D8), plus two new fixes
for `untilCalendar` near the limits and after a constrained leap month

### What is being asked, per defect

| Defect | What goes wrong                                                                                                                                                    | On js-temporal `main` `c8f344c` | Upstream source                                                          | Ask                                       | Verified                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------- | ------------------------------------------- |
| D1     | fields → ISO probes outside the legacy `Date` range near both limits (`Invalid ISO date`)                                                                          | broken                          | proposal `a41eb67` + `af0cb4b` (not on `main`, not in #361)              | port                                      | yes, but **not sufficient alone** (see D1b) |
| D1b    | `untilCalendar` month loop formats one month past the limit (hebrew, persian; islamic near the min)                                                                | broken                          | **none: also broken on proposal-temporal `main`**                        | new patch, file in both repos             | yes                                         |
| D2     | buddhist read through ICU's Julian/Gregorian hybrid before 1582-10-15                                                                                              | **fixed** (`2bb6ba1`)           | proposal `28fe786`                                                       | release                                   | yes (canary D2 2/2 on `main`)               |
| D3     | Hebrew `inLeapYear` wrong for negative years (`%` sign)                                                                                                            | broken                          | proposal `0df570c`; ported in open #361 as `86a89df`                     | merge #361 + release                      | yes                                         |
| D4     | ICU4C Hebrew one day off for years ≤ 0                                                                                                                             | environment (ICU 78.3)          | ICU `5267bb5778` (ICU-23007)                                             | none to the polyfill; Node/ICU note below | n/a                                         |
| D5     | stale "V8 bug 10529" detector (`Saka` vs `Śaka`) throws for every ISO year < 1                                                                                     | broken                          | proposal `314b112`; ported in #361 as `b6c9844`                          | merge #361 + release                      | yes                                         |
| D6     | `until` re-constrains the day while counting months                                                                                                                | **fixed** (`10aeb98`)           | proposal `1f6d6df`                                                       | release                                   | yes (canary D6 10/10 on `main`)             |
| D7     | `until` by years throws "mixed-sign" (proposal #3159)                                                                                                              | broken                          | proposal `0e32ee0`; ported in #361 as `79fb327`                          | merge #361 + release                      | yes                                         |
| D7b    | after the D7 port, `until` by years still compares the **constrained** intermediate day: `5784-M05L-30` → `5785-M06-29` gives `P1Y` (spec and Chromium: `P12M29D`) | broken                          | proposal `196a3191` (the `CompareSurpasses(…, calendarOne.day, …)` hunk) | port                                      | yes                                         |
| D8     | Meiji starts 1868; test262 requires `ce` before Meiji 6 (1873)                                                                                                     | partly fixed (`2bb6ba1` eras)   | proposal `977d11e0` + `993e6322`                                         | port                                      | yes                                         |

_Verification log:_

- **Per-port builds** (each port alone on `c8f344c`, GMT canary on the build; "unpatched" = `main`):

  | Defect | Port                                                                                                                                                 | Canary probe                                                        | `main`                                                                       | Port alone                                                | Other groups |
  | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------- | ------------ |
  | D3     | #361 `86a89df` (= proposal `0df570c`)                                                                                                                | `D3.-100000-01-01 hebrew` (`monthsInYear` 12)                       | STILL NEEDED (`Missing month converting …`)                                  | **REMOVABLE**                                             | unchanged    |
  | D5     | #361 `b6c9844` (= proposal `314b112`), `lib/calendar.ts` hunk only (its `expected-failures-cldr48.txt` hunk conflicts with `main` and is not needed) | `D5.-000500-06-15 indian` (`-578\|M03\|25`)                         | STILL NEEDED (`calendar 'indian' is broken for ISO dates before 0001-01-01`) | **REMOVABLE**                                             | unchanged    |
  | D7     | #361 `79fb327` (= proposal `0e32ee0`)                                                                                                                | `D7.mixedSign hebrew` (`P12M29D`)                                   | STILL NEEDED (`mixed-sign values not allowed`)                               | **REMOVABLE**                                             | unchanged    |
  | D1     | hand port of `a41eb67` + `af0cb4b` to TypeScript                                                                                                     | 27 `D1.*` probes; `repro-C-calendar-fields-near-limits.mjs` 21 rows | 19/27 fail; repro-C 12 FAIL                                                  | repro-C **21/21**; canary **5/27 still fail** (see below) | unchanged    |

- **D1 is not fully fixed by `a41eb67` + `af0cb4b`** on js-temporal's code. With the port, these canary probes
  still throw (stacks from the source-mapped production build):
  - `D1.untilNearMax hebrew` (`Invalid ISO date: +275760-09-27`), `D1.untilNearMax persian` (`+275760-10-02`) and
    `D1.relativeTo hebrew` (`+275760-09-17`): `untilCalendar`'s month loop calls `addMonthsCalendar(current, sign)`
    one month past the target, and `addMonthsCalendar` formats `addDaysISO(isoDate, daysInMonth)` past the legacy
    `Date` maximum. `af0cb4b` shifts that probe only for islamic, indian and the orthodox calendars, so hebrew and
    persian still reach `Intl.DateTimeFormat`. proposal-temporal `main` has the same `addMonthsCalendar` and
    loop (`polyfill/lib/calendar.mjs` l.1071–1105, l.1190–1197).
  - `D1.fieldsMin hebrew` (`Invalid ISO date: -271821-04-11`): the unclamped bisection step in
    `calendarToIsoDate`. Whether it is independent of D3 is checked on the combined build.
  - `D1.fieldsMin indian` is D5 (the stale `Saka` detector), not D1.
- **Combined build** (`C-all` = D1 port + D3 + D5 + D7 + D8 ports on `c8f344c`): canary D2, D3, D5, D6, D7, D8
  groups all REMOVABLE; D4 2/3 still needed (ICU, expected); D1 **24/27**. `repro-C` 21/21. `D1.fieldsMin hebrew`
  passes here, so its bisection overshoot was a consequence of D3 (wrong leap years), not a separate D1 path.
  The 3 remaining D1 probes are the `untilCalendar` month-loop overshoot above.
- **D8 port alone** (`C-D8`): D8 3/3 REMOVABLE, nothing else changes. First attempt failed `tsc` (TS2741:
  `HelperBase`'s placeholder `anchorEra` lacked `startingYear`); the final diff sets `startingYear: 1` there.
- **Reference check against tc39/proposal-temporal `main` `e8cc03f`** (unbundled `polyfill/lib/shim.mjs`, runtime
  deps installed with `npm install --omit=dev`): `repro-A` 16/16, `repro-D` 6/6, `repro-C` 21/21 (so A, D and the
  D1 field cases are fixed there); `repro-B` still fails 6/8 (`TypeError: Cannot read properties of null (reading
'lesser')`), and **the three residual D1 probes fail identically** (`Invalid ISO date: +275760-09-27T00:00Z`,
  `+275760-10-02`, `+275760-09-17`). The residual until defect is therefore unfixed upstream everywhere and needs a
  new patch (C-D1b, below).
- **2026-09-19, from tc39 #3327 and js-temporal #370 (the filings' own evidence, not re-run in this document's
  builds): proposal-temporal `main` is also wrong at ordinary dates, since `196a31919d` (tc39 #3245).** That
  commit turned the loop's copy into `next.day = calendarOne.day`, which writes the un-constrained day into the
  object `isoToCalendarDate()` stored in the calendar cache, so later lookups of that ISO date get the wrong day.
  Example: hebrew `2022-05-01` until `2022-03-31` by months gives `-P1M2D` (Chrome 153 `-P1M1D`); #3327 lists six
  such rows (hebrew, islamic-civil by years, chinese), none of which round-trip, and 12 wrong results in a grid
  of 126,720 `until()` calls (hebrew, islamic-civil, persian, chinese, coptic, indian; 2022–2025). This is newer
  than the reference check above, which ran only the limit repros against proposal `main` and the Chromium grid
  against js-temporal builds. It does not affect js-temporal `main`, which lacks `196a31919d`, or C-D7b, which
  ports only that commit's `CompareSurpasses` hunk. It does mean the **loop hunk of `196a31919d` must not be
  ported**; C-D1b replaces it (#370 says so), and per #3327 C-D1b on `e8cc03f` fixes both problems: every row
  expected, no wrong result in the grid, every call round-trips. #3327 says the repo's own test suite was not run
  on the change. It also flags a second `next.day = calendarOne.day` just before the loop (on the result of
  `addCalendar()`) that produced no wrong result in the grid.
- **2026-09-19, also from #370:** near the limits (every ISO day within 60 days, 240 `until()` calls per
  calendar per limit), #369 + #370 give 240/240 for hebrew, persian and islamic-civil at both limits, and with
  #361 as well every scanned calendar is 240/240 except chinese and dangi. At ordinary dates (10,200 calls, 15
  calendars) #370's output equals `main`'s except 18 coptic calls before the coptic epoch, which `main` got wrong
  and #370 answers with round-tripping values; with #361 underneath the output is identical with and without #370.
- Current `main` already fixes D2 (buddhist before 1582, `2bb6ba1`) and D6 (month-end `until`,
  `10aeb98`). GMT canary on a `main` build: D2 2/2 and D6 10/10 REMOVABLE.
- **Old draft appendix, corrected** (`repros/appendix-claims.mjs`, reads of `2024-01-01`, `2024-06-15`,
  `1000-01-01`, `-000500-06-15` and a fields round trip):
  - "coptic and ethiopic throw at every date": true of **0.5.1 only** (`Era am (ISO year 1740) was not matched by
any era`). On `main` both read correctly, e.g. `2024-01-01` → coptic `am|1740|M04|22`, ethiopic
    `am|2016|7516|M04|22`, and round-trip from fields.
  - "chinese and dangi throw" (related to #360): **still true on `main`** under ICU 78 (`RangeError: Unexpected leap
month suffix: Mo11` / `Mo5`), because ICU now formats months as `Mo11`. Fixed only in open PR #361 by `16dff41`
    (port of proposal `835c195`). GMT exposes neither calendar, so this is not part of GMT's ask; it is one more
    reason for a release of #361.
- D8 is only partly fixed on `main`: `1800-01-01` → `ce|1800` and `0000-12-31` → `bce|1` pass, but
  `1872-12-31` still reads `meiji|5` where test262 `intl402/Temporal/PlainDate/from/japanese-pre-meiji.js`
  requires `ce` before Meiji 6 (1873). That needs proposal-temporal `977d11e0` "Fix Meiji era start
  date" + `993e6322` "Update Meiji era start date", which are not on js-temporal `main` or in #361.
- D3 (`0df570c`), D5 (`314b112`) and D7 (`0e32ee0`) are ported in **open PR #361** as `86a89df`,
  `b6c9844` and `79fb327`, not on `main`.
- D1 (`a41eb67`, `af0cb4b`) is on neither `main` nor #361. On a `main` build the canary D1 group
  still fails 19/27 probes, including **hebrew `fieldsMin`**
  (`Invalid ISO date: -271821-03-20T00:00Z`), a failure the first CORE-6 calendar plan did not list.
- **Two new fixes found and verified**, needed on top of every upstream port:
  - **C-D1b** (new; no upstream equivalent): with D1 + D3 + D5 + D7 + D8 ported, `untilCalendar` still threw for
    hebrew/persian near both limits. C-D1b alone on `main` fixes `D1.untilNearMax persian` and
    `D1.relativeTo hebrew` (the hebrew `untilNearMax` probe also needs the D1 field fix). With everything
    (`C-all2`): canary D1 **27/27**.
  - **C-D7b** (port of proposal `196a3191`'s `CompareSurpasses` hunk): `repros/hebrew-grid-residual.mjs`,
    hebrew `5784-M05L-30` until `5785-M06-29`, `largestUnit: "years"`: `main` `P1Y`, D7 port `P1Y`, **D7 + D7b
    `P12M29D`**, proposal-temporal `main` `P12M29D`, Chromium 152 `P12M29D`. Spec: `NonISODateSurpasses` compares
    the un-constrained day (30 > 29), so a year has not been reached. GMT's canary had no probe for this row
    when this was written; it now has one, `D7.leapMonthEnd` in `temporalCompat/repros.ts`.
- **Edge-window scans** (`repros/scan-edge-windows.mjs`: every ISO day within 400 days of each limit; read,
  fields → date with `monthCode` constrain/reject and ordinal `month` reject, ±1 month, ±1 year, `until(edge)` by
  months and years; hebrew, persian, islamic-civil/tbla/umalqura, indian, ethioaa, coptic, ethiopic, buddhist;
  72 000 operations each). Summaries in `results/scan-*.summary.txt`. Throws from ±1 month/year whose result is
  past the limit are required by the spec and are not listed.

  | Build                    | Non-required failures                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
  | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `C-all` (D1+D3+D5+D7+D8) | hebrew and persian `until(edge)` throw at **every** sampled day at both limits (399 × 4 each); islamic-\* `until(edge)` near the min: 8 days each (`Input eraYear … doesn't match`); coptic near the min (below)                                                                                                                                                                                                                                                                                                  |
  | `C-all2` (+ C-D1b)       | **only coptic near the min**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
  | proposal-temporal `main` | hebrew and persian `until(edge)` at every sampled day at both limits; islamic-\* `until(edge)` at every sampled day near the min; indian `until(edge)` near the min (34 days, `Year … out of range`); coptic/ethioaa/ethiopic fields → date trip proposal's new assertion `calendarToIsoDate search should not overshoot a month entirely` at `+275760-04-20` and `-271820-01-26` (proposal #3292 assumed that block unreachable; since shown to be reachable far from the limits and filed as tc39 #3329, see F) |

  Coptic near the min (`C-all2`, unreachable in GMT, **root cause UNVERIFIED**): for ISO dates
  `-271820-01-27 … -271821-…` (400 sampled days), rebuilding a date from its own `{year, monthCode, day}` returns a
  date near `+272388`, and `until(edge)` throws "mixed-sign" for 29 days. It looks like the era-reversed coptic
  `year` (ICU 78 dropped `ERA0`, see #361's `023f6de`) but was not investigated. File separately if wanted. GMT computes `coptic` and `ethiopic` through `ethioaa` (`internal/calendarSystemIds.ts`
  `computationCalendarId`), so the polyfill never sees the id `coptic`, and GMT's own fields → ISO is a
  bisection (`internal/temporalCompat/fieldSearch.ts`), so neither this nor tc39 #3329 can reach GMT. **2026-09-19:** js-temporal #370 states that coptic dates before the coptic epoch
  don't round-trip from their own fields on `main` and that #361's coptic `ERA0` change fixes it; with #369,
  #361 and #370 its 60-day scan is 240/240 at both limits for every calendar but chinese and dangi. That
  supports the era guess above, but it is the filing's claim over 60 days, not a re-run of this 400-day scan.

- **Is the spec's extra clamp on the bisection step reachable?** An out-of-range estimate is reachable: the
  instrumented build (`patches/C-D1-instrumented-NOT-FOR-UPSTREAM.diff`, D1 + D3 + D5 + D7 + D8, scan above)
  recorded 116 831 out-of-range ISO estimates at the bisection step (`addDaysISO(isoEstimate, sign * increment)`)
  and 5 375 in `calculateSameMonthResult`. **None surfaced as an error.** They occur in the shifted calendars
  (islamic, indian, orthodox), whose `isoToCalendarDate` formats them safely after `af0cb4b`; hebrew and persian
  field conversions showed no failure in 72 000 operations. The one probe that did throw from the bisection step
  (`D1.fieldsMin hebrew`, `-271821-04-11`) was caused by D3 and passes once D3 is ported. **So the extra clamp is
  not needed; the compat layer does not add it** (proposal-temporal did not add it either).
- **Month-arithmetic regression oracle** (`q2-grid-*` from the earlier research: 11 calendars × 401 start days ×
  15 spans, `until` months/years both directions, `add`/`subtract`, against Chromium 152 native Temporal):

  | Build                                    | Mismatches with Chromium 152                                                                                                                      |
  | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
  | npm 0.5.1 (earlier research)             | buddhist 20, hebrew 97, islamic-civil 24, islamic-tbla 24, islamic-umalqura 20, persian 10, indian 8, ethioaa 20, japanese 20, roc 20, gregory 20 |
  | `C-all`                                  | hebrew 1 (the C-D7b row)                                                                                                                          |
  | `C-all2` (+ C-D1b)                       | hebrew 1; grid output **byte-identical** to `C-all`, so C-D1b changes nothing at ordinary dates                                                   |
  | `final2` (A–D all patches, C-D1b, C-D7b) | **identical to native for all 11 calendars**                                                                                                      |

### Patches (each a unified diff against `c8f344c` `lib/calendar.ts`, verified)

Apply order used for the combined builds: D1, D3, D5, D7, D8, D1b, D7b. D7b's context assumes D7; every other
diff applies alone to `main`.

**D1: port of proposal `a41eb67` + `af0cb4b`.** In the TypeScript classes, the shifted `isoToCalendarDate`
becomes an `override` calling `super.isoToCalendarDate`, and `ES.AddDaysToISODate` is the file's `addDaysISO`.

```diff
diff --git a/lib/calendar.ts b/lib/calendar.ts
index e840acc..d194335 100644
--- a/lib/calendar.ts
+++ b/lib/calendar.ts
@@ -636,6 +636,67 @@ function simpleDateDiff(one: CalendarYMD, two: CalendarYMD) {
   };
 }

+function compareISODateToLegacyDateRange({ year, month, day }: ISODate) {
+  if (year < -271821 || (year === -271821 && (month < 4 || (month === 4 && day < 19)))) return -1;
+  if (year > 275760 || (year === 275760 && (month > 9 || (month === 9 && day > 13)))) return 1;
+  return 0;
+}
+
+function clampISODate(iso: ISODate): ISODate {
+  const cmp = compareISODateToLegacyDateRange(iso);
+  if (cmp < 0) return { year: -271821, month: 4, day: 19 };
+  if (cmp > 0) return { year: 275760, month: 9, day: 13 };
+  return iso;
+}
+
+function cacheShiftedResult(isoDate: ISODate, adjusted: FullCalendarDate, cache: OneObjectCache) {
+  cache.set(OneObjectCache.generateISOToCalendarKey(isoDate), adjusted);
+  (['constrain', 'reject'] as const).forEach((overflow) => {
+    cache.set(OneObjectCache.generateCalendarToISOKey(adjusted, overflow), isoDate);
+  });
+}
+
+// For ISO dates outside the legacy Date range, format a date shifted by a whole
+// number of calendar cycles that keep the same month and day, and shift the year back.
+function shiftedIsoToCalendarDate(
+  isoDate: ISODate,
+  cache: OneObjectCache,
+  cycleYears: number,
+  base: (isoDate: ISODate, cache: OneObjectCache) => FullCalendarDate
+): FullCalendarDate {
+  if (compareISODateToLegacyDateRange(isoDate) === 0) return base(isoDate, cache);
+  const offset = Math.round((isoDate.year - 2000) / cycleYears) * cycleYears;
+  const result = base({ ...isoDate, year: isoDate.year - offset }, cache);
+  const adjusted = { ...result, year: result.year + offset };
+  if (adjusted.eraYear !== undefined) adjusted.eraYear += offset;
+  cacheShiftedResult(isoDate, adjusted, cache);
+  return adjusted;
+}
+
+function dayShiftedIsoToCalendarDate(
+  isoDate: ISODate,
+  cache: OneObjectCache,
+  cycleDays: number,
+  cycleYears: number,
+  base: (isoDate: ISODate, cache: OneObjectCache) => FullCalendarDate
+): FullCalendarDate {
+  if (compareISODateToLegacyDateRange(isoDate) === 0) return base(isoDate, cache);
+  // Shift by the minimum number of cycles to bring the date within the legacy
+  // Date range. Using a minimal shift avoids accumulated errors for calendars
+  // where the cycle length is approximate (e.g., islamic-umalqura).
+  const direction = isoDate.year > 0 ? 1 : -1;
+  const approxDaysBeyond = Math.abs(isoDate.year - direction * 2000) * 365;
+  const numCycles = Math.max(1, Math.floor(approxDaysBeyond / cycleDays));
+  const safeIsoDate = addDaysISO(isoDate, -numCycles * cycleDays * direction);
+  assert(compareISODateToLegacyDateRange(safeIsoDate) === 0, 'numCycles calculation should be correct');
+  const yearShift = numCycles * cycleYears * direction;
+  const result = base(safeIsoDate, cache);
+  const adjusted = { ...result, year: result.year + yearShift };
+  if (adjusted.eraYear !== undefined) adjusted.eraYear += yearShift;
+  cacheShiftedResult(isoDate, adjusted, cache);
+  return adjusted;
+}
+
 /**
  * Implementation helper that's common to all non-ISO calendars
  */
@@ -984,7 +1045,7 @@ abstract class HelperBase {
     }

     // First, try to roughly guess the result
-    let isoEstimate = this.estimateIsoDate({ year, month, day });
+    let isoEstimate = clampISODate(this.estimateIsoDate({ year, month, day }));
     const calculateSameMonthResult = (diffDays: number) => {
       // If the estimate is in the same year & month as the target, then we can
       // calculate the result exactly and short-circuit any additional logic.
@@ -1016,7 +1077,7 @@ abstract class HelperBase {
     let diff = simpleDateDiff(date, roundtripEstimate);
     if (diff.years !== 0 || diff.months !== 0 || diff.days !== 0) {
       const diffTotalDaysEstimate = diff.years * 365 + diff.months * 30 + diff.days;
-      isoEstimate = addDaysISO(isoEstimate, diffTotalDaysEstimate);
+      isoEstimate = clampISODate(addDaysISO(isoEstimate, diffTotalDaysEstimate));
       roundtripEstimate = this.isoToCalendarDate(isoEstimate, cache);
       diff = simpleDateDiff(date, roundtripEstimate);
       if (diff.years === 0 && diff.months === 0) {
@@ -1574,6 +1635,9 @@ abstract class IslamicBaseHelper extends HelperBase {
     const { year } = this.adjustCalendarDate(calendarDate);
     return { year: Math.floor((year * this.DAYS_PER_ISLAMIC_YEAR) / this.DAYS_PER_ISO_YEAR) + 622, month: 1, day: 1 };
   }
+  override isoToCalendarDate(isoDate: ISODate, cache: OneObjectCache): FullCalendarDate {
+    return dayShiftedIsoToCalendarDate(isoDate, cache, 10631, 30, (d, c) => super.isoToCalendarDate(d, c));
+  }
 }

 // There are 4 Islamic calendars with the same implementation in this polyfill.
@@ -1733,6 +1797,9 @@ class IndianHelper extends HelperBase {
     // 'shaka'; return it unconditionally as there is only one era
     return { era: 'shaka', eraYear: calendarDate.eraYear };
   }
+  override isoToCalendarDate(isoDate: ISODate, cache: OneObjectCache): FullCalendarDate {
+    return shiftedIsoToCalendarDate(isoDate, cache, 4, (d, c) => super.isoToCalendarDate(d, c));
+  }
 }

 /**
@@ -2036,6 +2103,9 @@ abstract class OrthodoxBaseHelper extends GregorianBaseHelper {
   override minimumMonthLength = OrthodoxOps.minimumMonthLength;
   override maximumMonthLength = OrthodoxOps.maximumMonthLength;
   override maxLengthOfMonthCodeInAnyYear = OrthodoxOps.maxLengthOfMonthCodeInAnyYear;
+  override isoToCalendarDate(isoDate: ISODate, cache: OneObjectCache): FullCalendarDate {
+    return dayShiftedIsoToCalendarDate(isoDate, cache, 1461, 4, (d, c) => super.isoToCalendarDate(d, c));
+  }
 }

 // `coptic` and `ethiopic` calendars are very similar to `ethioaa` calendar,
```

**C-D1b (new): step months arithmetically in `untilCalendar`.** The loop only compares the next month's
`year`/`month` (its day is reset to `calendarOne.day`), so materializing it with `addMonthsCalendar()` was never
needed and is what formats a date past the limit. Same `monthsInYear()` calls that `addMonthsCalendar()` already
makes. The same change applies to proposal-temporal `polyfill/lib/calendar.mjs` l.1193.

```diff
diff --git a/lib/calendar.ts b/lib/calendar.ts
index e840acc..9c77b5e 100644
--- a/lib/calendar.ts
+++ b/lib/calendar.ts
@@ -1214,12 +1214,21 @@ abstract class HelperBase {
         do {
           months += sign;
           current = next;
-          next = this.addMonthsCalendar(current, sign, 'constrain', cache);
-          if (next.day !== calendarOne.day) {
-            // In case the day was constrained down, un-constrain it (even if
-            // that's not a real date)
-            next = { ...next, day: calendarOne.day };
+          // Only the year and month of the next month are compared (its day is
+          // un-constrained to calendarOne.day), so step them arithmetically.
+          // addMonthsCalendar() would format an ISO date past the end of the
+          // supported range when calendarTwo is in the last month of the range.
+          let { year, month } = current;
+          month += sign;
+          if (month < 1) {
+            year -= 1;
+            month = this.monthsInYear({ year }, cache);
+          } else if (month > this.monthsInYear({ year }, cache)) {
+            year += 1;
+            month = 1;
           }
+          // The day may not exist in that month; that's fine for the comparison.
+          next = { year, month, day: calendarOne.day };
         } while (this.compareCalendarDates(calendarTwo, next) * sign >= 0);
         months -= sign; // correct for loop above which overshoots by 1
         const remainingDays = this.calendarDaysUntil(current, calendarTwo, cache);
```

**D3: #361 `86a89df` (proposal `0df570c`).**

```diff
diff --git a/lib/calendar.ts b/lib/calendar.ts
index e840acc..a46859b 100644
--- a/lib/calendar.ts
+++ b/lib/calendar.ts
@@ -1398,7 +1398,9 @@ class HebrewHelper extends HelperBase {
     // Given that these can be calculated by counting the number of days in
     // those months, I assume that these DO NOT need to be exposed as
     // Hebrew-only prototype fields or methods.
-    return (7 * year + 1) % 19 < 7;
+    let cycleYear = (7 * year + 1) % 19;
+    if (cycleYear < 0) cycleYear += 19;
+    return cycleYear < 7;
   }
   monthsInYear(calendarDate: CalendarYearOnly) {
     return this.inLeapYear(calendarDate) ? 13 : 12;
```

**D5: #361 `b6c9844` (proposal `314b112`), `lib/calendar.ts` hunk.**

```diff
diff --git a/lib/calendar.ts b/lib/calendar.ts
index e840acc..47af7d5 100644
--- a/lib/calendar.ts
+++ b/lib/calendar.ts
@@ -1718,8 +1718,9 @@ class IndianHelper extends HelperBase {
   // calendar output to fail for all dates before 0001-01-01 ISO.  For example,
   // in Node 12 0000-01-01 is calculated as 6146/12/-583 instead of 10/11/-79 as
   // expected.
-  vulnerableToBceBug =
-    new Date('0000-01-01T00:00Z').toLocaleDateString('en-US-u-ca-indian', { timeZone: 'UTC' }) !== '10/11/-79 Saka';
+  vulnerableToBceBug = !new Date('0000-01-01T00:00Z')
+    .toLocaleDateString('en-US-u-ca-indian', { timeZone: 'UTC' })
+    .startsWith('10/11/-79');
   override checkIcuBugs(isoDate: ISODate) {
     if (this.vulnerableToBceBug && isoDate.year < 1) {
       throw new RangeError(
```

**D7: #361 `79fb327` (proposal `0e32ee0`).** Exactly `git show 79fb327 -- lib/calendar.ts` from
js-temporal branch `rebase-part3`; it applies to `c8f344c` without conflict (41 insertions, 4 deletions, mostly
comments). The behavioural hunks:

```diff
@@ -1217,13 +1236,27 @@ abstract class HelperBase {
           }
           years = 0;
         }
+
+        // intermediate should be a date between calendarOne and calendarTwo,
+        // that is within a year of calendarTwo.
         const intermediate =
           years || months ? this.addCalendar(calendarOne, { years, months }, 'constrain', cache) : calendarOne;
+
+        // At this point, intermediate could fail to be in between calendarOne and calendarTwo
+        // due to leap years.
+        // In that case, add or subtract an extra year from years,
+        // so that the months can be totaled up correctly.
+        if (this.compareCalendarDates(intermediate, calendarTwo) * sign > 0) {
+          years -= sign;
+        }
+
         // Now we have less than one cycle remaining. Add one month at a time
         // until we go over the target, then back up one month and calculate
         // remaining days.
-        let current;
-        let next: CalendarYMD = intermediate;
+        let current: CalendarYMD;
+        // Need to re-add years and months because years might have changed
+        let next: CalendarYMD =
+          years || months ? this.addCalendar(calendarOne, { years, months }, 'constrain', cache) : calendarOne;
         do {
           months += sign;
           current = next;
```

**C-D7b: port of proposal `196a3191`'s surpass check** (on top of D7; line numbers are D7-applied `main`).

```diff
--- a/lib/calendar.ts
+++ b/lib/calendar.ts
@@ -1233,7 +1233,9 @@
         // due to leap years.
         // In that case, add or subtract an extra year from years,
         // so that the months can be totaled up correctly.
-        if (this.compareCalendarDates(intermediate, calendarTwo) * sign > 0) {
+        // Compare with the un-constrained day of calendarOne, as NonISODateSurpasses
+        // does: a constrained intermediate day must not count as reaching calendarTwo.
+        if (this.compareCalendarDates({ ...intermediate, day: calendarOne.day }, calendarTwo) * sign > 0) {
           years -= sign;
         }

```

**D8: port of proposal `977d11e0` + `993e6322`** (`hasYearZero` → `startingYear`, Meiji from 1873-01-01 as
6 Meiji). The `startingYear: 1` on `HelperBase`'s placeholder era is required by `tsc` (TS2741) in the TypeScript
port.

```diff
diff --git a/lib/calendar.ts b/lib/calendar.ts
index e840acc..359f0b1 100644
--- a/lib/calendar.ts
+++ b/lib/calendar.ts
@@ -661,6 +661,7 @@ abstract class HelperBase {
     // dummy era for calendars without eras
     code: '',
     genericName: '',
+    startingYear: 1,
     anchorEpoch: { year: 0, month: 1, day: 1 },
     isoEpoch: { year: 0, month: 1, day: 1 }
   };
@@ -855,14 +856,14 @@ abstract class HelperBase {
         }
         // last era always gets all "leftover" (older than epoch) years,
         // so no need for a comparison like below.
-        eraYear = year - e.anchorEpoch.year + (e.hasYearZero ? 0 : 1);
+        eraYear = year - e.anchorEpoch.year + e.startingYear;
         return true;
       }
       // FIXME: This cast may not be correct. I think month and day are always
       // present when we get here, but the type system does not prove it
       const comparison = this.compareCalendarDates(calendarDate as CalendarYMD, e.anchorEpoch);
       if (comparison >= 0) {
-        eraYear = year - e.anchorEpoch.year + (e.hasYearZero ? 0 : 1);
+        eraYear = year - e.anchorEpoch.year + e.startingYear;
         return true;
       }
       return false;
@@ -894,7 +895,7 @@ abstract class HelperBase {
       if (matchingEra.reverseOf) {
         year = matchingEra.anchorEpoch.year - eraYear;
       } else {
-        year = eraYear + matchingEra.anchorEpoch.year - (matchingEra.hasYearZero ? 0 : 1);
+        year = eraYear + matchingEra.anchorEpoch.year - matchingEra.startingYear;
       }
       if (calendarDate.year !== undefined && calendarDate.year !== year) {
         throw new RangeError(`Input year ${calendarDate.year} doesn't match calculated value ${year}`);
@@ -1768,10 +1769,10 @@ interface InputEra {
   reverseOf?: string;

   /**
-   * If true, the era's years are 0-based. If omitted or false,
-   * then the era's years are 1-based.
+   * Number of the era's starting year (for example, 0 if there's a Year 0).
+   * If omitted, the era's years are 1-based.
    * */
-  hasYearZero?: boolean;
+  startingYear?: number;

   /**
    * Override if this era is the anchor. Not normally used because
@@ -1823,10 +1824,10 @@ interface Era {
   reverseOf?: Era;

   /**
-   * If true, the era's years are 0-based. If omitted or false,
-   * then the era's years are 1-based.
+   * Number of the era's starting year (for example, 0 if there's a Year 0).
+   * Filled in by adjustEras(); 1 if the input omitted it.
    * */
-  hasYearZero?: boolean;
+  startingYear: number;

   /**
    * Override if this era is the anchor. Not normally used because
@@ -1867,10 +1868,11 @@ function adjustEras(erasParam: InputEra[]): { eras: Era[]; anchorEra: Era } {
   // anchor.
   let anchorEra: Era | InputEra | undefined;
   eras.forEach((e) => {
+    e.startingYear ??= 1;
     if (e.isAnchor || (!e.anchorEpoch && !e.reverseOf)) {
       if (anchorEra) throw new RangeError('Invalid era data: cannot have multiple anchor eras');
       anchorEra = e;
-      e.anchorEpoch = { year: e.hasYearZero ? 0 : 1 };
+      e.anchorEpoch = { year: e.startingYear };
     } else if (!e.code) {
       throw new RangeError('If era name is blank, it must be the anchor era');
     }
@@ -1973,7 +1975,7 @@ abstract class GregorianBaseHelper extends HelperBase {
     const calendarDate = this.adjustCalendarDate(calendarDateParam);
     const { year, month, day } = calendarDate;
     const { anchorEra } = this;
-    const isoYearEstimate = year + anchorEra.isoEpoch.year - (anchorEra.hasYearZero ? 0 : 1);
+    const isoYearEstimate = year + anchorEra.isoEpoch.year - anchorEra.startingYear;
     return ES.RegulateISODate(isoYearEstimate, month, day, 'constrain');
   }
 }
@@ -2133,13 +2135,8 @@ class GregoryHelper extends SameMonthDayAsGregorianBaseHelper {
 //
 // NOTE: Japan started using the Gregorian calendar in 6 Meiji, replacing a
 // lunisolar calendar. So the day before January 1 of 6 Meiji (1873) was not
-// December 31, but December 2, of 5 Meiji (1872). The existing Ecma-402
-// Japanese calendar doesn't seem to take this into account, so neither do we:
-// > args = ['en-ca-u-ca-japanese', { era: 'short' }]
-// > new Date('1873-01-01T12:00').toLocaleString(...args)
-// '1 1, 6 Meiji, 12:00:00 PM'
-// > new Date('1872-12-31T12:00').toLocaleString(...args)
-// '12 31, 5 Meiji, 12:00:00 PM'
+// December 31, but M12-02, of 5 Meiji (1872). To avoid confusion between
+// lunisolar and solar dates we count years prior to 1873 as CE.
 class JapaneseHelper extends SameMonthDayAsGregorianBaseHelper {
   constructor() {
     super('japanese', [
@@ -2149,7 +2146,7 @@ class JapaneseHelper extends SameMonthDayAsGregorianBaseHelper {
       { code: 'heisei', isoEpoch: { year: 1989, month: 1, day: 8 }, anchorEpoch: { year: 1989, month: 1, day: 8 } },
       { code: 'showa', isoEpoch: { year: 1926, month: 12, day: 25 }, anchorEpoch: { year: 1926, month: 12, day: 25 } },
       { code: 'taisho', isoEpoch: { year: 1912, month: 7, day: 30 }, anchorEpoch: { year: 1912, month: 7, day: 30 } },
-      { code: 'meiji', isoEpoch: { year: 1868, month: 9, day: 8 }, anchorEpoch: { year: 1868, month: 9, day: 8 } },
+      { code: 'meiji', isoEpoch: { year: 1873, month: 1, day: 1 }, anchorEpoch: { year: 1873 }, startingYear: 6 },
       { code: 'ce', isoEpoch: { year: 1, month: 1, day: 1 } },
       { code: 'bce', reverseOf: 'ce' }
     ]);
```

### Repro (GMT canary rows, verbatim inputs)

```js
import { Temporal } from "@js-temporal/polyfill";
const iso = (d) => d.withCalendar("iso8601").toString();
// D1 (test262 intl402/Temporal/PlainDate/from/extreme-dates.js)
iso(
  Temporal.PlainDate.from(
    { calendar: "hebrew", year: 279517, month: 10, day: 11 },
    { overflow: "reject" },
  ),
); // +275760-09-13
iso(
  Temporal.PlainDate.from(
    { calendar: "islamic-civil", year: -280804, month: 3, day: 21 },
    { overflow: "reject" },
  ),
); // -271821-04-19
// D1 / D1b (Chromium 152/153)
Temporal.PlainDate.from("+275760-07-01")
  .withCalendar("persian")
  .until(Temporal.PlainDate.from("+275760-09-13").withCalendar("persian"), {
    largestUnit: "months",
  }); // P2M12D
Temporal.Duration.from("P40D").round({
  largestUnit: "months",
  relativeTo: Temporal.PlainDate.from({
    calendar: "hebrew",
    year: 279517,
    month: 8,
    day: 15,
  }),
}); // P1M10D
// D3: Temporal.PlainDate.from("-100000-01-01").withCalendar("hebrew").monthsInYear            // 12
// D5: Temporal.PlainDate.from("-000500-06-15").withCalendar("indian") → -578 M03 25
// D7: hebrew {5784, month 6, day 2}.until({5785, month 6, day 1}, { largestUnit: "years" })    // P12M29D
// D7b: PlainDate.from("2024-03-10").withCalendar("hebrew").until(+384 days, { largestUnit: "years" }) // P12M29D
// D8: Temporal.PlainDate.from("1872-12-31").withCalendar("japanese") → era "ce", eraYear 1872 (test262 japanese-pre-meiji.js)
```

On `main` every row above throws or returns another value (`Invalid ISO date: …`, `Missing month converting …`,
`calendar 'indian' is broken …`, `mixed-sign values not allowed`, `P1Y`, `meiji|5`).

### D4: ICU note (not a polyfill defect)

- ICU4C `hebrwcal.cpp` mis-applies the Kislev-length and dechiyah rules for years ≤ 0, so Node reads
  `-271821-11-05` as `-268057 M05 27` and `-003761-09-01` as `0 M01 12`. Chromium (ICU4X) and the
  Dershowitz–Reingold arithmetic give day 28 and day 13. Canary D4 still fails on every build here, as expected.
- Fixed by ICU `5267bb57783a55dea0e4d35551c76740cb62c9ee` (2026-07-13) "ICU-23007 Fix Hebrew calendar year <= 0
  Kislev length and Dechiya boundary rules (ICU-23070, ICU-22441)".
- **Not released:** `gh api repos/unicode-org/icu/compare/release-78.3...5267bb5778` → diverged (276 ahead), the
  latest ICU4C release is `release-78.3` (2026-03-17), and there is no `release-79` tag. Node `main` and `v24.x`
  both bundle ICU 78.3 (`deps/icu-small/source/common/unicode/uvernum.h`).
- Ask: none to js-temporal. GMT's D3+D4 removal needs an ICU release containing `5267bb5778` **and** a Node
  release bundling it as GMT's `engines.node` floor. Optionally note it on ICU-23007 / nodejs/node when ICU 79 lands.

### Ask

> 1. Please merge #361 (it carries D3, D5, D7 and the ICU 78 fixes for chinese/dangi and coptic) and release.
> 2. Please port proposal-temporal `a41eb67`, `af0cb4b`, `977d11e0`, `993e6322` and the `CompareSurpasses`
>    hunk of `196a3191` (diffs above). Only that hunk: the same commit's months-loop hunk corrupts the calendar
>    cache (tc39 #3327) and is replaced by C-D1b.
> 3. New bug + PR (also in tc39/proposal-temporal): non-ISO `until` by months/years throws `Invalid ISO date` for
>    hebrew and persian within a month of either limit, because `untilCalendar` materializes the month past the
>    target. Diff C-D1b above.
> 4. `2bb6ba1` (D2, eras) and `10aeb98` (D6) are on `main`: covered by the same release.

**Closes:** #360, via #361 — #361's own description already carries `Closes: #360`, so merging it closes the
issue; say "merging #361 also closes #360" in the port request rather than adding a second `Closes` line.
Verified: `main` still throws `Unexpected leap month suffix: Mo8` on #360's repro, `main` + `16dff41` returns
`M08`. `2bb6ba1` in point 4 is also what closes #341, but that is A's release line, not C's.

**Filed as** (all 2026-09-18):

- **D1** → js-temporal PR #369, "Polyfill: Fix extreme PlainYearMonth crash in non-ISO calendars", ports
  `a41eb67` + `af0cb4b` as two commits. Per #369, the test262 `extreme-dates.js` rows (112, run by hand at the
  test262 commit tc39 used for `af0cb4b`) fail 59 on `main`, 42 with #369, 8 with #369 + #361 (only chinese/dangi
  far from the present).
- **D8** → js-temporal PR #368, "Polyfill: Update Meiji era start date", ports `977d11e` + `993e632` as two
  commits (the first moves Meiji from 1868-09-08 to 1868-10-23, the second adds `startingYear`). Per #368, of 125
  `intl402/Temporal/**/*japanese*.js` tests, `main` fails 18, #368 13, #368 + #361 0.
- **D1b** → js-temporal PR #370, "Don't format dates past the range limit when counting months in until()"
  (depends on #369), and tc39/proposal-temporal issue #3327 with the same change, which also reports the
  `196a31919d` regression above. Cross-linked both ways.
- **D3, D5, D7:** not filed separately; they are in the maintainer's own PR #361.
- **Not filed:** C-D7b, and point 1's request to merge #361 (see "Still unfiled").

---

## D. `"UTC"` fast path in `GetPossibleEpochNanoseconds` skips `IsValidEpochNanoseconds`

### Title

Port proposal-temporal #3205: validate the result of the UTC fast path in `GetPossibleEpochNanoseconds`

### Status

| Build                | `repro-D-utc-fast-path-validation.mjs` (6 rows)            | `repro-D-regression-rows.mjs` (18 rows) | Canary `zoned.D`  |
| -------------------- | ---------------------------------------------------------- | --------------------------------------- | ----------------- |
| npm 0.5.1            | UTC rows return values (2 FAIL)                            | —                                       | STILL NEEDED      |
| `main` `c8f344c`     | **2 FAIL** (UTC returns `P3DT5H` and `2.0416666666666665`) | 18/18                                   | 2/2 STILL NEEDED  |
| `main` + patch below | **6/6 PASS**                                               | **18/18 PASS**                          | **2/2 REMOVABLE** |

Already fixed in tc39/proposal-temporal: issue #3203, PR #3205 (merged 2025-12-11, merge commit
`d90d432b2f`). The fix is the same three-line change as below. Not in PR #361's batch, which ends at the
2025-11-26 proposal commits.

### Repro

```js
import { Temporal } from "@js-temporal/polyfill";
const MAX = 8640000000000000000000n,
  D = 86400000000000n,
  H = 3600000000000n;
for (const zone of ["UTC", "+00:00", "Europe/London"]) {
  const start = new Temporal.ZonedDateTime(MAX - 3n * D - 5n * H, zone),
    max = new Temporal.ZonedDateTime(MAX, zone);
  start.until(max, { largestUnit: "day", smallestUnit: "hour" }); // expected RangeError in all three zones
  Temporal.Duration.from("PT49H").total({
    unit: "day",
    relativeTo: new Temporal.ZonedDateTime(MAX - 2n * D - H, zone),
  }); // expected RangeError
}
// main: "UTC" returns P3DT5H and 2.0416666666666665; "+00:00" and Europe/London throw RangeError.
```

**Expected-value sources.** Spec `GetPossibleEpochNanoseconds` (`timezone.html`): "For each value
_epochNanoseconds_ in _possibleEpochNanoseconds_, if IsValidEpochNanoseconds(_epochNanoseconds_) is
_false_, throw a _RangeError_". "UTC" takes the named-zone branch. The rounding window end is
`+275760-09-13T19:00` (`NudgeToZonedTime`) and `+275760-09-13T23:00` (`ComputeNudgeWindow`), both past
nsMaxInstant. Chromium 153 throws (GMT canary `zoned.D`); the polyfill itself throws for `+00:00`.
test262 `built-ins/Temporal/Duration/prototype/total/relativeto-date-limits.js` (cited in #3203).

### Root cause (`lib/ecmascript.ts` on `c8f344c`)

```ts
2243  if (timeZone === 'UTC') {
2244    CheckISODaysRange(isoDateTime.isoDate);
2245    return [GetUTCEpochNanoseconds(isoDateTime)];   // offset (l.2263) and named (l.2927) branches validate; this one does not
```

### Patch (against `c8f344c`, verified; identical in effect to proposal-temporal `d90d432`)

```diff
diff --git a/lib/ecmascript.ts b/lib/ecmascript.ts
index 8e7dd0e..6c8fdb0 100644
--- a/lib/ecmascript.ts
+++ b/lib/ecmascript.ts
@@ -2242,7 +2242,9 @@ function GetPossibleEpochNanoseconds(timeZone: string, isoDateTime: ISODateTime)
   // UTC fast path
   if (timeZone === 'UTC') {
     CheckISODaysRange(isoDateTime.isoDate);
-    return [GetUTCEpochNanoseconds(isoDateTime)];
+    const epochNs = GetUTCEpochNanoseconds(isoDateTime);
+    ValidateEpochNanoseconds(epochNs);
+    return [epochNs];
   }

   const offsetMinutes = ParseTimeZoneIdentifier(timeZone).offsetMinutes;
```

### Verification

Method: production build of `c8f344c` with only this diff (`builds/D`), against unmodified `main`.

- `repro-D-utc-fast-path-validation.mjs`: `main` 4 pass / 2 fail; patched 6/6.
- `repro-D-regression-rows.mjs`, in `UTC` and `+00:00`: `PlainDateTime` at the max and min →
  ZonedDateTime; one nanosecond past either limit throws; `until`/`since` near both limits without
  `smallestUnit` (`P3DT5H`, `P1D`); `startOfDay` at the max; `PT23H.total(day)` near the max
  (`0.9583333333333334`); an ordinary rounded `until` (`P1DT2H`). 18/18 on both `main` and patched, so
  no in-range UTC behaviour changes.
- GMT canary on the patched build: `zoned.D` 2/2 REMOVABLE; no other group changed.

### Ask

> Please port proposal-temporal #3205 ("Polyfill: Validate result in UTC fast path in
> GetPossibleEpochNanoseconds") and include it in the next release.

**Closes:** nothing open in js-temporal. Cite the upstream pair instead — "Ports
tc39/proposal-temporal#3205, which fixed tc39/proposal-temporal#3203" — both of which are already closed
there.

**Filed as:** js-temporal PR #367 (2026-09-18), "Polyfill: Validate result in UTC fast path in
GetPossibleEpochNanoseconds", the same three lines as tc39 `d90d432`. Beyond this section's evidence it states:
tc39 #3203's own case, `new Temporal.Duration(0).total({ unit: 'days', relativeTo:
'+275760-09-12T23:59:60+00:00[UTC]' })`, returns `0` on `main` and throws with the PR; jest 607 passed; the
pinned test262 passes in default and `NODE_ENV=production` builds (4828 passed); and test262
`Duration/prototype/total/relativeto-date-limits.js`, run by hand at tc39/test262@416f2a3de8 (newer than the
pin), fails on `main` and passes with the PR, while its `round` sibling passes on both.

---

## E. Transition search starts in 1847, after the first TZDB transition (1844-12-31)

Found and filed after the rest of this document was verified. Everything below is taken from the filings'
own text; none of it was re-run in this document's builds.

### Title

Start the time zone transition search before the first transition in 1844

### What goes wrong

`GetNamedTimeZoneNextTransition` jumps forward to `BEFORE_FIRST_DST` (1847-01-01T00:00:00Z) and
`GetNamedTimeZonePreviousTransition` stops there, on the assumption (per #372, from js-temporal `e70d632`) that
1847 is the year of the first TZDB transition. It no longer is. Five zones cross the date line on 1844-12-31 and
skip that local day: Asia/Manila (`-15:56` → `+08:04`), Pacific/Guam and Pacific/Saipan (`-14:21` → `+09:39`),
Pacific/Kosrae (`-13:08` → `+10:52`) and Pacific/Palau (`-15:02` → `+08:58`). The offsets are right, because they
come from `Intl.DateTimeFormat`; only the transition search misses the change. Because local 1844-12-31 doesn't
exist, `GetStartOfDay` searches for the next transition after the day before, jumps to 1847, and returns
Manila's 1899 transition (Guam, Saipan, Kosrae and Palau: their 1901 one). Same code in js-temporal
`lib/ecmascript.ts` and tc39 `polyfill/lib/ecmascript.mjs` l.143 at `e8cc03f`; development builds give the same
results.

### Repro (from #372 and tc39 #3330; `main` = production build of js-temporal `main`, and tc39 `main` alike)

| Call                                                                                                                       | `main`                                     | Expected                                 |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------- |
| `Temporal.Instant.from('1800-01-01T00:00:00Z').toZonedDateTimeISO('Asia/Manila').getTimeZoneTransition('next')`            | `1899-09-06T12:00:00+08:00[Asia/Manila]`   | `1845-01-01T00:00:00+08:04[Asia/Manila]` |
| `Temporal.Instant.from('1846-06-01T00:00:00Z').toZonedDateTimeISO('Asia/Manila').getTimeZoneTransition('previous')`        | `null`                                     | `1845-01-01T00:00:00+08:04[Asia/Manila]` |
| `Temporal.PlainDate.from('1844-12-31').toZonedDateTime('Asia/Manila')`                                                     | `1899-09-06T12:00:00+08:00[Asia/Manila]`   | `1845-01-01T00:00:00+08:04[Asia/Manila]` |
| `Temporal.ZonedDateTime.from('1844-12-30T12:00[Asia/Manila]').hoursInDay`                                                  | `479340.06444444443`                       | `24`                                     |
| `Temporal.ZonedDateTime.from('1844-12-30T12:00[Asia/Manila]').round({ smallestUnit: 'day' })`                              | `1844-12-30T00:00:00-15:56[Asia/Manila]`   | `1845-01-01T00:00:00+08:04[Asia/Manila]` |
| control: `Temporal.Instant.from('1800-01-01T00:00:00Z').toZonedDateTimeISO('Europe/London').getTimeZoneTransition('next')` | `1847-12-01T00:01:15+00:00[Europe/London]` | same                                     |

**Expected-value sources** (as the filings give them). Chrome 153 native Temporal. The tzdb `asia` file cites
the governor-general's proclamation of 1844-08-16 that 1844-12-30 be followed by 1845-01-01; `australasia` says
the other islands "kept American time until the Philippines switched at the end of 1844". In Chrome 153,
`previous` from 1844-12-31T00:00Z is `null` in all 418 zones of `Intl.supportedValuesOf('timeZone')`, so these
are the earliest transitions today.

### Patch (js-temporal, from `gh pr diff 372`)

```diff
--- a/lib/ecmascript.ts
+++ b/lib/ecmascript.ts
@@ -81,7 +81,9 @@ const DATETIME_NS_MAX = JSBI.subtract(JSBI.add(NS_MAX, DAY_NANOS_JSBI), ONE);
 const MS_IN_400_YEAR_CYCLE = (400 * 365 + 97) * DAY_MS;
 const YEAR_MIN = -271821;
 const YEAR_MAX = 275760;
-const BEFORE_FIRST_DST = Date.UTC(1847, 0, 1); // 1847-01-01T00:00:00Z
+// The first transition in the TZDB is on 1844-12-31, when Asia/Manila and some
+// Pacific zones moved across the date line.
+const BEFORE_FIRST_DST = Date.UTC(1844, 0, 1); // 1844-01-01T00:00:00Z
```

tc39 #3330 proposes the same line with `DateUTC`. 1844-01-01 is almost a year before the first transition, as
1847-01-01 was before Europe/London's on 1847-12-01, so the early `return null` in the previous-transition
search still can't cut off a 19-day window.

### Verification (stated in the filings, not re-run here)

- #372, against Chrome 153: 157 rows around the five zones (`next` from 1800, `previous` from 1846, 1848, 1900
  and 1 ns after the transition; `toZonedDateTime`, `hoursInDay`, `startOfDay` on 1844-12-29 … 1845-01-02; the
  skipped day with each `disambiguation`; `add`/`subtract`/`round`/`until` across it; London and New York
  controls; 2026 lookups): `main` 36 wrong, PR 0. All 418 zones, four lookups each (1,672 rows): `main` 20 wrong,
  all in the five zones; PR 0. Rows outside the five zones and `next`/`previous` from the first of every month of
  2020–2030 in 24 zones (6,336 lookups) are byte-identical. With #371 as well, all 1,829 rows match.
- #372: jest 607 passed, eslint/prettier/`tscheck` clean, pinned test262 passes. No jest test added: the
  expected values depend on the runtime ICU's tz data, and older data lacks the 1844 transitions.
- Cost: Antarctica/Troll (first transition 2005) is the worst case. #372 measures `previous` from just before it
  at 4.2–4.3 ms before and after; #3330 measures 4.86 ms → 4.95 ms on tc39 `main`.
- tc39 #3330: same change on `e8cc03f`, all 1,829 rows match Chrome 153; on `main` 56 are wrong.
- Not fixed by either: the constant is still a hard-coded assumption about the TZDB, so an earlier transition
  added later would be missed the same way.

### GMT impact and workaround (`zoned.E`, verified against Chrome 153)

Before the workaround, GMT on polyfill 0.5.1 was wrong wherever it relied on the polyfill's transition search or
`GetStartOfDay` in these five zones: `getDstTransitions(zone, 1845)` was `[]`; `startOfZoned`/`endOfZoned`,
`floorToZone` and `areZonedEqualBy` by week were a day off across the crossing; `getHoursInZonedDay` for
1844-12-30 was 479,340.06; `roundZoned`/`roundUnix` by day rounded 1844-12-30 noon down instead of up to the
crossing; `intervalCountZoned` over 1844-12-01 … 1845-02-01 counted the skipped day (62, not 61) and
`intervalOverlappingDaysZoned` counted it too; `addZonedBusinessDays` landing on the skipped Tuesday jumped to
1899. GMT's own day boundaries elsewhere (`addZoned`, `mapZonedHoursInDay`, day buckets) were already right.

The workaround is `internal/zonedWallClock.ts` defect 3. It runs only for a named zone and an instant before
1847-01-01 (or a local date on or before it), so every later receiver pays one bigint comparison and no `Intl`
read. There it compares the offset at the receiver with the offset at the floor (for `previous`, at the
minimum instant) and, when they differ, bisects with the existing `transitionBetween` — the offsets are right,
only the polyfill's search is floored. Start of day, `hoursInDay`, `round` by day and a `PlainDate`'s
`toZonedDateTime` before the floor use GMT's own `GetStartOfDay` (`startOfDayEpochNanoseconds`). It rests on one
assumption, pinned over every zone in `internal/zonedWallClock.test.ts`: no zone changes offset between the
minimum instant and 1844-01-01, and exactly these five change between 1844 and 1847, once each. Canary: the
`zoned.E` group in `internal/temporalCompat/repros.ts` (5 probes, all STILL NEEDED on 0.5.1). **Remove when** a
js-temporal release containing #372 is GMT's dependency floor; the removal steps are in `pnpm compat`, and no
expected value changes.

**Filed as:** js-temporal PR #372 and tc39/proposal-temporal issue #3330, both 2026-09-19, cross-linked.
Independent of #367–#371 and #361. **Closes:** nothing open.

---

## F. `calendarToIsoDate` overshoot assertion from tc39 #3292 is reachable (tc39 only)

Found and filed after the rest of this document was verified. Facts from tc39 #3329 only; nothing below was
re-run in this document's builds.

### What goes wrong

tc39 #3292 (`17d7ff1f94`) replaced the overshoot handling in `calendarToIsoDate()`'s search loop with the
assertion "calendarToIsoDate search should not overshoot a month entirely", on the grounds that it seemed
unreachable. Month 13 of coptic, ethiopic and ethioaa (5 or 6 days) can be skipped entirely by the search's 8-day
step. C's edge-window scan above already hit this assertion on proposal-temporal `main` at `+275760-04-20` and
`-271820-01-26`; #3329 shows it is reachable far from the limits too, in most far-off years.

**Not in js-temporal and not in GMT's runtime.** js-temporal has not ported #3292 (#3329 says so). Whoever ports
that commit to js-temporal should take the fix with it.

**Can't reach GMT, and pinned so it stays that way (2026-09-19).** GMT computes `coptic` and `ethiopic` through
`ethioaa` (`internal/calendarSystemIds.ts` `computationCalendarId`), and its fields → ISO is a bisection over epoch
days (`internal/temporalCompat/fieldSearch.ts`), which can't skip a short month; the polyfill's answer is kept
only when its fields read back unchanged (`calendarDateFromFields.ts`). Chromium 153 matches GMT on every far-year
month-13 row: `ethioaa` `{ year: 18196, month: 13, day: 1 }` is `+012704-11-26` and `{ year: 18196, month: 12,
day: 30 }` is `+012704-11-25`. Those two rows are the `D10` canary group in `repros.ts` / `pnpm compat`: it passes
on 0.5.1 (no #3292) and fails only on a js-temporal release that ports #3292 without this fix, which then routes
every ethioaa fields → ISO through the bisection and add/until through the spec algorithms. Independently, any
polyfill throw other than a `RangeError` (such as this assertion) now takes GMT's own path instead of becoming
the public sentinel.

### Repro (from #3329; `Temporal.PlainDate.from(…)` on tc39 `main`)

| Fields                                                                                 | tc39 `main`       | Expected        |
| -------------------------------------------------------------------------------------- | ----------------- | --------------- |
| `{ calendar: 'coptic', year: 12420, month: 13, day: 1 }`                               | assertion failure | `+012704-11-26` |
| `{ calendar: 'coptic', year: -35585, month: 13, day: 6 }`                              | assertion failure | `-035302-12-05` |
| `{ calendar: 'coptic', year: 50000, month: 13, day: 1 }`                               | assertion failure | `+050285-09-03` |
| `{ calendar: 'ethiopic', year: 12696, month: 13, day: 1 }`                             | assertion failure | `+012704-11-26` |
| `{ calendar: 'ethioaa', year: 18196, month: 13, day: 1 }`                              | assertion failure | `+012704-11-26` |
| `{ calendar: 'coptic', year: 275470, month: 13, day: 1 }` (fields of `+275760-04-20`)  | assertion failure | `+275760-04-20` |
| `{ calendar: 'coptic', year: -272099, month: 13, day: 5 }` (fields of `-271820-01-26`) | assertion failure | `-271820-01-26` |

**Expected-value sources** (as the filing gives them): Chrome 153 native Temporal, and the rule that each result
is the day after month 12, day 30 of the same year, plus `day` days. Scale: every coptic year from -272090 to
275470, month 13 days 1–6 (3,285,360 calls), 489,845 hit the assertion; the failing years nearest 0 are 12420
and -35585; 1800–2200 is clean. With #3292 reverted, all 3,285,360 pass the check.

### Proposed fix (tc39 #3329)

Search in 5-day steps instead of 8 (`const increment = 5;` in `polyfill/lib/calendar.mjs` near l.1025 at
`e8cc03f`, with a comment). No month in any supported calendar is shorter than 5 days, so a step can't skip the
target month.

### Verification (stated in the filing, not re-run here)

- On `e8cc03f` with the change: all 3,285,360 month-13 calls give the expected date and all table rows match
  Chrome 153. Round-tripping coptic, ethiopic and ethioaa fields holds for every ISO day in 1800–2200,
  −5000..−4000, +100000..+100400, the last 760 years before the maximum and the first 820 after the minimum
  (7.4M calls).
- Side effects, 15 non-ISO calendars × 1,662,015 rows (from fields, `with({ day: 1 })`, `add({ months: 1 })`):
  984 rows change from an assertion to a value; 96 chinese/dangi rows within ~100 years of a limit change, all
  already wrong against Chrome in both versions; everything else identical.
- The filing does not say whether proposal-temporal's own tests or test262 were run with the change.

**Filed as:** tc39/proposal-temporal issue #3329, 2026-09-18. No js-temporal counterpart (not affected).
**Closes:** nothing open. GMT workaround it retires: none (the `D10` group is a regression guard, not a
workaround 0.5.1 needs).

---

## G. CLDR calendar-alias asymmetry: `ethiopic-amete-alem` is accepted, `gregorian` is not (ICU note, not a polyfill defect)

**Status: no ask. GMT matches both engines exactly; recorded so nobody "fixes" it.** Reviewed 2026-09-20
(baldurpan, CORE-8). Owner decision: `gregorian` stays rejected and `ethiopic-amete-alem` stays accepted.

CLDR `bcp47/calendar.xml` gives four calendar types an `alias` attribute naming their legacy Unicode name:
`gregory`/`gregorian`, `roc`/`taiwan`, `islamic-tbla`/`islamic-tabular`, `ethioaa`/`ethiopic-amete-alem`.
Only the last of the four is usable as a Temporal calendar id. That is not GMT's choice and not the
polyfill's: Chromium 153 (ICU4X) and `@js-temporal/polyfill` 0.5.1 agree row for row, and GMT agrees with
both.

`Temporal.PlainDate.from("2024-10-03").withCalendar(id).toString()`, and
`new Intl.DateTimeFormat("en-US", { calendar: id }).resolvedOptions().calendar`:

| `id` | Chromium 153 Temporal | polyfill 0.5.1 | GMT `convertDateToCalendar` | Chromium `Intl` |
| --- | --- | --- | --- | --- |
| `gregorian` | `RangeError` | `RangeError` | `""` | `RangeError` |
| `gregory` | `[u-ca=gregory]` | `[u-ca=gregory]` | `[u-ca=gregory]` | `gregory` |
| `ethiopic-amete-alem` | `[u-ca=ethioaa]` | `[u-ca=ethioaa]` | `[u-ca=ethioaa]` | `ethioaa` |
| `ethioaa` | `[u-ca=ethioaa]` | `[u-ca=ethioaa]` | `[u-ca=ethioaa]` | `ethioaa` |
| `islamic-tabular` | `RangeError` | `RangeError` | `""` | `gregory` |
| `islamic-tbla` | `[u-ca=islamic-tbla]` | `[u-ca=islamic-tbla]` | `[u-ca=islamic-tbla]` | `islamic-tbla` |
| `taiwan` | `RangeError` | `RangeError` | `""` | `gregory` |
| `roc` | `[u-ca=roc]` | `[u-ca=roc]` | `[u-ca=roc]` | `roc` |

Two separate mechanisms produce the three rejections, which is why they are not one bug:

- **`gregorian` is structurally invalid.** A Unicode locale extension `type` subtag is 3–8 alphanumerics
  (UTS 35). `gregorian` is nine letters, so it fails the syntax check before any calendar lookup — which is
  why `Intl` throws for it too, while it merely falls back for the other two.
- **`islamic-tabular` and `taiwan` are structurally valid but not available calendars.** ECMA-402's
  `AvailableCanonicalCalendars` is ICU's list; ICU canonicalizes `ethiopic-amete-alem` to `ethioaa` but does
  not canonicalize these two, so Temporal's `CanonicalizeCalendar` throws while `Intl.DateTimeFormat`'s
  option path silently falls back to `gregory`.

**Why GMT does not paper over it.** GMT's calendar ids are exactly the ids Temporal accepts (Core Rule: the
public string contract is Temporal's). Accepting `gregorian` would mean GMT's accepted set is wider than
Temporal's, so a string GMT validated would throw the moment it reached `Temporal` — including the `Temporal`
GMT itself re-exports. The `Intl` fallback is worse than the throw: `{ calendar: "taiwan" }` formatting as
Gregorian is a silently wrong date, not an error. GMT surfaces both as its `""`/`null` sentinel.

**Documented at:** `convertDateToCalendar`, `convertZonedToCalendar`, `isValidCalendarDate` and
`isValidCalendarZonedDateTime` JSDoc, and `context/domination/research/calendar-standards-decisions.md`.

**Trigger to revisit:** an ICU release that adds `islamic-tabular`/`taiwan` to the canonicalization table, or
a TC39 amendment to `CanonicalizeCalendar`. Neither is filed; neither is being asked for.


## H. The calendar nudge window is never retried (`total`, `round`, `until`)

**Status: nothing to file. The port is already written, in an open maintainer PR.** Found 2026-09-20
while closing a coverage gap baldurpan raised in the CORE-8 review (`intervalLength*` in calendar
units had only ever been compared against the same `until`/`total` primitives the implementation
calls).

### Already fixed in tc39, and already ported in an open js-temporal PR

This is **tc39/proposal-temporal [#3168](https://github.com/tc39/proposal-temporal/issues/3168)**
(closed), fixed by **[#3172](https://github.com/tc39/proposal-temporal/pull/3172)** (Normative,
commit `5dd0b0d97ee1`, merged 2025-11-19). ptomato's diagnosis there is exactly ours: "_destEpochNs_
(2021-02-28T01:00Z) > _endEpochNs_ (2021-02-28T00:00Z) … _r1_ and _r2_ should be 1 and 2 instead of
0 and 1."

The port into `@js-temporal/polyfill` is **also already written**, by the maintainer: commit
`50d66d2` in **[PR #361](https://github.com/js-temporal/temporal-polyfill/pull/361)** ("April 2026
rebase, part 3", opened 2026-04-22). That PR is open, mergeable and unreviewed.

A first pass here concluded a port request was needed, because it checked only our own filings
(#367–#372) for `NudgeToCalendarUnit` and not the maintainer's open PRs. **Do not file anything.**
What #361 was missing was evidence that the normative commit inside it fixes a user-visible wrong
answer today — its own description reasonably calls the change "unlikely to break any working code" —
so that is what we added, as a comment:
<https://github.com/js-temporal/temporal-polyfill/pull/361#issuecomment-5752268476>.

`50d66d2` is **not on `main`** (checked against the GitHub contents API, not a local clone) and in no
release, so **every D11 workaround stays**. The removal trigger is two gates, not one: `50d66d2` has
to land on `main` — via #361 or a split-out PR — *and then* ship in a release that becomes GMT's
`@js-temporal/polyfill` floor.

### The defect

TC39 bounds the duration between `relativeTo + r1 units` and `relativeTo + r2 units`, where `r1` is
the duration's own count of that unit, then checks that the target falls inside the window. When it
does not, `ComputeNudgeWindow` runs again with `additionalShift = true`, so `r1` becomes 1 rather
than 0 (spec/duration.html, `NudgeToCalendarUnit` steps 2–9). The polyfill computes the window once;
its `assert(start <= dest <= end)` is compiled out of production builds, so `progress` silently
exceeds 1 and the answer comes from bounds that exclude the target.

Reachable only when the duration's own month count is one short of the truth, which is exactly when
adding a month constrains the day — a `relativeTo` on the 29th, 30th or 31st.

### Repro

```js
const from = Temporal.PlainDateTime.from("2024-01-31T00:00:00");
const to = Temporal.PlainDateTime.from("2024-02-29T12:00:00");

from.until(to, { largestUnit: "month" }).toString();
// "P29DT12H" — both engines agree, so r1 = 0 months

from.until(to, { largestUnit: "month" }).total({ unit: "month", relativeTo: from });
// polyfill 0.5.1: 1.0172413793103448   Chromium 153: 1.0161290322580645

from.until(to, { largestUnit: "month", smallestUnit: "month", roundingMode: "trunc" }).toString();
// polyfill 0.5.1: "PT0S"               Chromium 153: "P1M"     <- a whole month

Temporal.Duration.from("P29DT12H")
  .round({ smallestUnit: "month", roundingMode: "floor", relativeTo: Temporal.PlainDate.from("2024-01-31") })
  .toString();
// polyfill 0.5.1: "PT0S"               Chromium 153: "P1M"
```

Note that #3168's own reproducer (`new Temporal.Duration(1, 0, 0, 0, 1)` relative to `2020-02-29`,
unit `years`) **passes** on js-temporal 0.5.1 — there `r1` is already 1 from the duration's own years,
so no retry is needed. The month reproducers above are the ones to file.

### Scope, as scanned (Chromium 153.0.8010.12 vs `@js-temporal/polyfill` 0.5.1)

| Operation | Rows | Mismatches |
| --- | --- | --- |
| `Duration#total` | 2,016 | 16 |
| `Duration#round` | 12,960 | 15 |
| `until` / `since` with a calendar `smallestUnit` | 9,940 | 15 |
| `Duration.compare` | 256 | **0** — reaches no nudge window |

Every mismatch is `unit: "month"`. `round` and `until` diverge only in the directed rounding modes
(`ceil`, `floor`, `trunc`); the half modes agree either way. `until` without rounding agrees on all
rows, so only the rounded forms are affected.

### Ask

None of ours to file. What helps is #361 being reviewed and landed, or `50d66d2` split out as a
standalone PR — it applies cleanly to `main` by itself and touches only `lib/ecmascript.ts`, which
the comment offers to do if the maintainer prefers it. If he takes that offer, that PR becomes a
filing of ours and the tracker gains it as a real PR number.

### `50d66d2` measured, not assumed

Both columns built from a clean tree with `NODE_ENV=production` (assertions stripped, so the defect
shows as a wrong value rather than a throw): `main` at `c8f344c`, versus the same tree with
`50d66d2` applied. Node 24.21.0, ICU 78.3.

| Probe | `main` | with `50d66d2` |
| --- | --- | --- |
| `until(largestUnit:"month")` | `P29DT12H` | `P29DT12H` (correct on both) |
| `.total({unit:"month"})` | `1.0172413793103448` | `1.0161290322580645` |
| `until` + `smallestUnit:"month"`, `trunc` | `PT0S` | `P1M` |
| `Duration.from("P29DT12H").round(floor, relativeTo 2024-01-31)` | `PT0S` | `P1M` |

Derivable without either build: after the retry the window is `Feb 29 → Mar 31` (31 days) over a 12 h
numerator, so `1 + 0.5/31 = 1.0161290322580645`; the unretried path uses `Jan 31 → Feb 29` (29 days)
over a 29 d 12 h numerator, `29.5/29 = 1.0172413793103448`.

With `50d66d2` applied alone on `main`: `npm test` 607 passed / 0 failed; `npm run test262` (pinned
`ac3035f0`, production) 4855 finished, 4828 passed, 0 failed, 0 passed unexpectedly, 27 expected
failures, 6 missing; `npm run lint` clean.

### Three traps, recorded so they are not re-hit

1. **Node's bundled Temporal is not a valid oracle here.** Node 24.21.0 ships V8 13.6, whose
   `Temporal` predates the fix: `node --harmony-temporal` gives `until(...) === "P1MT12H"` (not the
   correct `"P29DT12H"`) and `total === 1.0344827586206897` — matching *neither* the buggy nor the
   expected value. Use Chromium 153, or derive from the algorithm.
2. **`nudgedEpochNs` is intentionally left alone.** In the patched function the `duration` line uses
   `roundedUnit === Math.abs(r2)` while `nudgedEpochNs` still uses the OR'd `didExpandCalendarUnit`.
   After a retry those conditions genuinely differ, so it reads like an oversight — but tc39 `main`
   and #361 both leave it that way. If it is a further defect it belongs upstream as a new issue,
   not as a local "fix".
3. **#3168's own reproducer does not expose this.** `new Temporal.Duration(1, 0, 0, 0, 1)` relative
   to `2020-02-29` with unit `years` *passes* on 0.5.1 — `r1` is already 1 from the duration's own
   years field, so no retry is needed. Only a `relativeTo` on the 29th–31st with unit `month`
   reaches it.

### GMT

Fixed as compat defect **D11** (`packages/gmt/src/internal/temporalCompat/README.md`). GMT already
owned a spec-current `computeNudgeWindow` with `additionalShift`, so the fix routes the three
operations to it when the probe fails and the `relativeTo` is past the 28th:
`monthTotalBySpec` and `monthRoundBySpec` in `durationTotal`/`durationRound`, a defect-4 gate in
`zonedUntil` (which covers `diffUtc`, `diffUnix` and `diffZoned`), and the new
`plainUntilWithRounding` (for `diffDateTime`). After the fix all three scans match Chromium exactly.
Probe-gated, retires by canary.

`internal/plainDateUntil.ts` carried a fifth D11 term for `diffDate` until the CORE-8 review (#253)
showed it corrected nothing. The nudge window can only miss its target when the target sits strictly
between the window bounds by a sub-day amount, and two `PlainDate`s have no time component, so the
defect is structurally unreachable there — ~1.96M rows against the raw polyfill, both directions,
zero divergence. The term was removed: routing ISO through that path bought no corrected answer and
widened the blast radius of GMT's own `progress === 0n` boundary defect to ISO date differences.

**A second defect, in GMT's own mirror, found by the same scan.** When the target lands exactly on
the window's lower bound the duration is already rounded, which TC39 handles inside
`ApplyUnsignedRoundingMode` ("if x is equal to r1, return r1"). GMT's form takes a comparison rather
than the value, so `ceil` expanded an exact boundary to the next whole unit — `P60D` from
`2024-01-31` gave `P3M` where Chromium gives `P2M`. It was live for the non-ISO calendars before this
change, since they already took this path. Fixed by the `progress === 0n` branch in
`nudgeToCalendarUnit`; it is GMT's bug, not the polyfill's, and stays when D11 retires.

## Corrections and contradictions

**Contradicts GMT's canary notes and triggers (flag before retiring anything):**

1. **`zoned.A` min edge is already fixed on `main`.** `temporalCompat/README.md`, `temporalCompat/repros.ts`
   (zoned.A comment), `internal/zonedWallClock.ts`, `internal/zonedWallClockOperations.ts`,
   `scripts/temporal-compat.mjs` say the minimum edge needs a separate upstream fix. It
   does not: `95237e0` (on `main`) fixes it; the claim was measured on 0.5.1 + `05ce7a3` only. New trigger:
   "a release containing `05ce7a3` and `95237e0`". The canary's expected values are right; only the notes are wrong.
2. **D1 trigger is insufficient.** "ports `a41eb67` (+ `af0cb4b`)" leaves `D1.untilNearMax persian`,
   `D1.untilNearMax hebrew` and `D1.relativeTo hebrew` failing, in js-temporal and in proposal-temporal `main`.
   It also needs C-D1b (new), and `D1.fieldsMin hebrew` needs D3. The "+ a clamp of the bisection step" clause
   should be dropped: not needed.
3. **D6/D7 trigger is insufficient, and GMT has no probe for the gap.** A release with `10aeb98` + `0e32ee0`
   passes GMT's D6 and D7 probes but still returns `P1Y` for hebrew `5784-M05L-30 → 5785-M06-29`
   (`largestUnit: "years"`; spec and Chromium `P12M29D`). Retiring the D6/D7 workaround on those probes alone
   would ship that bug. Add a probe for this row and require the `196a3191` hunk (C-D7b). **Since done** for
   the probe: `D7.leapMonthEnd` in `temporalCompat/repros.ts`. C-D7b itself is still unfiled.
4. **D8 trigger is insufficient.** `2bb6ba1` fixes `1800-01-01` and `0000-12-31` but `1872-12-31` stays
   `meiji|5`; it also needs `977d11e0` + `993e6322`.
5. **D3 is ported in open PR #361** (not "not on js-temporal main" in the sense of unavailable): merging #361
   delivers D3, D5 and D7.

**Corrections from the filings (2026-09-19):**

- "B is unreported in both repositories" (duplicate search, 2026-09-15) no longer holds: B is js-temporal #371
  and tc39 #3328.
- The reference check against proposal-temporal `main` found only the limit failures of the months loop. tc39
  #3327 shows the same loop has also been wrong at ordinary dates since `196a31919d` (tc39 #3245), which is why
  C-D7b must port only that commit's `CompareSurpasses` hunk (C's log and Ask).
- The assertion C's scan hit on proposal-temporal `main` near the limits is reachable far from them too (F, tc39
  #3329).
- Two defects this document did not have are now recorded: E (transition search before 1847) and F.
- "Run `npm test` and `npm run test262` before opening the PRs": the six js-temporal PRs state they did (see
  "Not verified").

**Corrections to the first CORE-6 calendar plan and the earlier draft:**

- D1: on `main` hebrew also fails at the **min** (`D1.fieldsMin hebrew`), via D3; the plan listed hebrew max only.
- Bisection step: drop the clamp from the proposed diff (reachable as an estimate, never an error; see C).
  The D1 fix also needs C-D1b.
- D7: the port is complete in #361 as `79fb327` (it does re-derive `next`); it still needs C-D7b.
- D8 needs `977d11e0` + `993e6322`, not only `2bb6ba1`.
- Removal triggers: see contradictions 1–4.
- Draft A: not "release + min-edge fix" but release only. Draft B: exact patch now verified; `castExists` is
  stripped in production so the symptom is a TypeError. Draft D: already fixed in proposal-temporal (#3205), so
  it is a port request. Appendix: coptic/ethiopic throw only on 0.5.1; chinese/dangi still throw on `main`
  (fixed in #361 `16dff41`).

## I. A zoned string's offset written with seconds is matched by minutes

### Status

Fixed on js-temporal `main` by `23d1275` ("Normative: Require strict matching with a precise ZonedDateTime
offset"); in no release, so polyfill 0.5.1 has the defect. Nothing to file: the ask is the release already
requested in #373. GMT works around it as temporalCompat **D12** (`internal/zonedWallClock.ts`
`matchSecondsOffsetExactly`, probe `isSecondsOffsetMatchCompatNeeded`).

### What goes wrong

TC39 `ToTemporalZonedDateTime` sets `matchBehaviour` to match-minutes for a string, then: "If
offsetParseResult contains more than one MinuteSecond Parse Node, set matchBehaviour to match-exactly." An
offset written with seconds must equal the zone's offset; only one written to the minute may match a
sub-minute zone offset that rounds to it. Polyfill 0.5.1 `lib/ecmascript.ts` sets `matchMinute = true` for
every string (and `matchMinutes = true` in `ToRelativeTemporalObject`) without looking at the offset's seconds
part. `main` adds `if (offsetSecondsPart) matchMinute = false`.

### Repro (0.5.1, Node 24.21.0; expected values from test262 `test/intl402/Temporal/ZonedDateTime/from/zoneddatetime-sub-minute-offset.js`)

| Call | 0.5.1 | Expected |
| ---- | ----- | -------- |
| `Temporal.ZonedDateTime.from("1970-01-01T12:00-00:45:00[Africa/Monrovia]")` | `45870000000000n` (accepted) | `RangeError`: "rounded HH:MM:SS not accepted in string offset (offset=reject)" |
| `Temporal.ZonedDateTime.from("1952-10-15T23:59:59-11:20:00[Pacific/Niue]").epochNanoseconds` | `-543069621000000000n` (the −11:19:40 pass) | `-543069601000000000n`: "-11:20:00 is accepted as -11:20:00 in the Pacific/Niue edge case" |
| `new Temporal.Duration(1, 0, 0, 0, 24).round({ largestUnit: "years", relativeTo: "1970-01-01T00:00-00:45:00[Africa/Monrovia]" })` | `P1Y1D` (accepted) | `RangeError` by the same step of `ToRelativeTemporalObject`; no test262 file was found for a named zone here, and Chromium 153's native Temporal throws `RangeError` |

Chromium 153.0.8010.12 native Temporal returns the Expected column for all three rows.

### Effect on GMT

Without the workaround `isValidZonedDateTime("1960-01-01T00:20:00-00:45:00[Africa/Monrovia]")` is `true`, and
`transitTime` and `nextDeparture` accept that string. GMT parses every zoned string, `relativeTo` included,
through `zonedDateTimeFrom`, so the one workaround there covers them all.

## J. `ZonedDateTime.prototype.toString` writes a string `ZonedDateTime.from` refuses (tc39 only, spec)

### Title

ZonedDateTime.from rejects ZonedDateTime.prototype.toString's output when the local date is -271821-04-19

### Status

**Filed as tc39/proposal-temporal#3331 (2026-10-21); closed as answered (2026-10-24).** The check
is intended: the champions answered the same question on tc39/proposal-temporal#3014, and the
closing comment links their answers. It is a spec decision, not a polyfill defect:
`@js-temporal/polyfill` 0.5.1, Chromium 153.0.8010.12 and Node 26.12.1 native Temporal all do what the spec says. GMT has no workaround
and wants none. A workaround computes the spec's answer, and here the spec's answer is the
`RangeError`. The ECMA-262 Temporal PR (tc39/ecma262#3966) has the same step, as
`ValidateISODaysRange`.

**What would change it:** tc39/ecma262#3464, which widens the time value range that ECMA-262's
Date operations accept. Once it lands, `CheckISODaysRange` can be replaced with
`ISODateTimeWithinLimits`, the check SpiderMonkey already runs (§ P). No one needs to watch for
it: when an engine stops throwing, the native-suite canary fails the "zoned reads refuse" rows on
that leg and opens an issue.

### What goes wrong

The instant range starts at −271821-04-20T00:00:00Z. In a zone west of Greenwich the first hours of
that range fall on local date −271821-04-19 (the first 1 min 15 s in Europe/London, at local mean
time −00:01:15; the first 4 h 56 min 2 s in America/New_York). `ZonedDateTime.prototype.toString`
writes those instants with that local date and the zone's offset. Reading the string back runs
`InterpretISODateTimeOffset` with `offsetBehaviour` option and `offsetOption` reject, whose branch
begins:

> Assert: _offsetOption_ is prefer or reject.
> Perform ? CheckISODaysRange(_isoDate_).

`CheckISODaysRange` throws for a date more than 10^8 days from the epoch, and −271821-04-19 is one
day beyond that. So the check rejects the local date before the offset is matched against the zone,
although the instant the string names is in range. The wall branch of the same operation
(`offsetBehaviour` wall, or `offsetOption` ignore) goes straight to `GetEpochNanosecondsFor` with no
such check, so the same wall time written without its offset is accepted. A string is refused only
because it carries the offset that makes it exact.

### Repro

`MIN` is `-8640000000000000000000n`, the first instant.

| Call | Chromium 153 | polyfill 0.5.1 |
| ---- | ------------ | -------------- |
| `new Temporal.ZonedDateTime(MIN + 15_000_000_000n, "Europe/London").toString()` | `-271821-04-19T23:59:00-00:01[Europe/London]` | the same |
| `Temporal.ZonedDateTime.from("-271821-04-19T23:59:00-00:01[Europe/London]")` | `RangeError` | `RangeError` |
| the same with `{ offset: "prefer" }` | `RangeError` | `RangeError` |
| `Temporal.ZonedDateTime.from("-271821-04-19T23:59:00[Europe/London]")` (no offset) | `-271821-04-19T23:59:00-00:01[Europe/London]` | `RangeError`, but for another reason: defect A (§ A), which `main` fixes and GMT's `zonedDateTimeFrom` works around |
| the offset string with `{ offset: "ignore" }` | `-271821-04-19T23:59:00-00:01[Europe/London]` | `RangeError`, defect A again |
| the offset string with `{ offset: "use" }` | `-271821-04-19T23:58:45-00:01[Europe/London]` (the offset read as −00:01:00, 15 s earlier) | the same |
| `Temporal.Instant.from("-271821-04-19T23:59:00-00:01[Europe/London]")` | `-271821-04-20T00:00:00Z` (the offset read as −00:01:00; the instant written was 00:00:15Z) | the same |
| `Temporal.ZonedDateTime.from(new Temporal.ZonedDateTime(MIN + 3_600_000_000_000n, "America/New_York").toString())` | `RangeError` | `RangeError` |

East of Greenwich the local date at the first instant is −271821-04-20, inside the date range, and
the round trip works (`-271821-04-20T09:18:59+09:19[Asia/Tokyo]`). At the other end of the range
no zone has the problem: the largest local date, +275760-09-13, is inside the date range.

### Ask

Whether the `CheckISODaysRange(isoDate)` in the prefer/reject branch is meant to reject a local
date whose instant is in range. If it is not, drop it or move it after the candidates are computed,
so that `from(zdt.toString())` returns `zdt` for every `ZonedDateTime` that can exist, as the wall
branch already allows. If it is meant, the round-trip gap is by design and worth a note.

### GMT

- **Zoned reads follow the spec.** `isValidZonedDateTime`, `transitTime`, `nextDeparture`,
  `scheduleDelivery`, `toOffsetInstant` and every `zoned/` function return the sentinel for a
  string with an offset on local date −271821-04-19. GMT's own
  `interpretISODateTimeOffset` (`internal/zonedWallClock.ts`) keeps the same check.
- **Instant readers read it.** `parseInstantNanoseconds` matches the offset against the zone with
  no date-range check, so `isValidInstant`, `toNanoseconds`, `scheduleDeviation`, `etaAtZone` and
  the rest read `-271821-04-19T23:59:00-00:01[Europe/London]` as −271821-04-20T00:00:15Z.
- Stated in [coding-standards § Calendar & zone semantics, rule 9](../coding-standards.md#9-an-instant-string-is-read-as-the-zoned-string-it-may-be)
  and pinned in `packages/gmt/src/test/minuteRoundedOffsets.test.ts`.
- The champions' answer is that the throw is intended until ecma262 `MakeDay` is fixed
  (tc39/ecma262#1087): `MakeDay` differs between engines, and `CheckISODaysRange` keeps
  `from(zdt.toString())` from returning different results in each (tc39/proposal-temporal#3014,
  comment of 2026-01-23). SpiderMonkey is the engine that does not follow it (§ P).
- If tc39 changes the step, GMT's zoned reads follow: remove the `checkISODaysRange` call in
  `interpretISODateTimeOffset`, and flip the two "zoned reads refuse" rows in that test file.

## Not verified

- The polyfill's own jest suite and test262 runner were not run for any patch. (`test262` is an
  un-checked-out submodule in the clone.) Verification is the repros, GMT canary, edge-window scans and the
  Chromium 152 grid listed per item. Before opening the PRs, run `npm test` and `npm run test262` on each.
  **2026-09-19:** each js-temporal PR (#367–#372) states jest 607 passed and the pinned test262 passes on Node
  24.21.0 (ICU 78.3). That is the filings' claim; it was not re-run for this document. The tc39 issues state no
  test-suite run: #3327 says the repo's own suite was not run, and #3328, #3329 and #3330 don't say.
- Coptic near the minimum (wrong `from`-fields result, "mixed-sign" `until`) on the fully patched build:
  root cause **UNVERIFIED**. GMT computes `coptic` and `ethiopic` through `ethioaa`
  (`internal/calendarSystemIds.ts`), and its fields → ISO is a bisection (`internal/temporalCompat/fieldSearch.ts`),
  so this and tc39 #3329 can't reach GMT. js-temporal #370 states #361's coptic `ERA0` change
  fixes it (see C); not re-run here.
- E and F, and every figure in the "Filed as" notes that goes beyond this document's own verification
  (the 61-day and 418-zone transition scans, the 60-day until scan, the 126,720-call grid, the month-13 sweep,
  the test262 by-hand runs), come from the filings' text and were not re-run in this document's builds.
- E's effect on GMT: not checked (GMT has no canary probe or workaround for it).
- The final GMT canary runs (`final2`, `main` re-run) used a scratchpad loader hook that also resolves
  extensionless relative imports, because `packages/gmt/dist` was rebuilt at 10:09:54 without `tsc-alias` by a
  process outside this verification (this work only built the polyfill clone). Earlier canary runs used the
  intact dist and agree with the re-runs.
- Scratchpad artefacts (clones, builds, patches, repros, results, logs):
  `/private/tmp/claude-501/-Users-craigcurtis-workbench-northguild-gmt-worktrees-feature-187-core-6-interval-algebra-intersect-clamp-subtract-merge-split-sum-implementation/bdd796f6-e636-477b-bca7-b7182a6ed50b/scratchpad/polyfill-verify/`.

## K. The transition search skips, or never returns from, two offset changes inside one step

### Status

The 0.5.1 defect is fixed on js-temporal `main` by `a79c6a1` for the zones it lists (per-zone search windows:
`searchWindowForTransitions(id)` gives 6 to 17 days for the listed zones and 19 days otherwise); in no
release, so polyfill 0.5.1 has the defect. **A stall remains on `main`**: `bisect` is unchanged, and the 17-day
window for `Africa/El_Aaiun` holds three offsets in April 1976 (−01:00 → +00:00 at 1976-04-14T01:00:00Z, then
+00:00 → +01:00 at 1976-05-01T00:00:00Z, 16.958 days apart), so `getTimeZoneTransition("next")` from
1976-04-14T00:30:00Z or 1976-03-28T00:30:00Z cannot narrow. 0.5.1's 14-day step is unaffected there, so
`a79c6a1` introduces it. **Filed as tc39/proposal-temporal#3332 (2026-10-21)**, with a 16-day window for
`Africa/El_Aaiun` as the fix. js-temporal `main` was read, not built or run here.

The same window fails in the `previous` direction: a search whose 17-day window ends between
1976-05-01T00:00Z and 01:00Z holds the same three offsets, for example `previous` from
1976-05-01T00:30:00Z (expected `1976-05-01T01:00:00+01:00[Africa/El_Aaiun]`, Node 26.10.0).

tc39/proposal-temporal `main` `e8cc03f` has the same code: `a79c6a1` ports tc39 `da53e9acea`
(2025-05-07). tc39's build keeps `bisect`'s `assertNotReached`, so there the calls throw
`assertion failure: code should not be reached because invalid state in bisection -3600000000000 - 0 - 3600000000000`
instead of hanging. Run on tc39's `polyfill/script.js` at `e8cc03f`, Node 24.21.0:

- `next` throws when a 17-day step starts from 1976-04-14T00:00:00Z up to 01:00:00Z (exclusive);
  from 1976-04-13T23:59:59Z it answers.
- `previous` throws from 1976-05-01T00:00:01Z up to 01:00:00Z.
- With `DAY_MS * 16` for the zone, every El_Aaiun lookup matches Node 26.10.0. That is `next` and
  `previous` every 90 minutes from 1976-03-01 to 06-01 (2,944 lookups), and every transition from 1800
  to 2100 walked both ways. Without it, 3 of those lookups throw.
- On Node 26.10.0 (tz 2026c), no other zone has two transitions from 1800 to 2100 closer together than
  its tc39 window.
- The patch was not run against tc39's own test suite.

`D13` retires only on a release where every `D13` probe passes, `stall.nextElAaiun` included. GMT works around it as temporalCompat **D13**
(`internal/zonedTransitionSearch.ts`, probe `isTransitionSearchCompatNeeded`).

### What goes wrong

TC39 `GetNamedTimeZoneNextTransition` returns the first offset change strictly after an instant, and
`GetNamedTimeZonePreviousTransition` the last strictly before it. Polyfill 0.5.1 `lib/ecmascript.ts` samples
the offset every 14 days (`DAY_MS * 2 * 7`) and calls `bisect` on a step whose ends differ.

- **Skipped pair.** Two changes inside one step that return to the same offset leave the ends equal, so both
  are skipped. Whether they fall inside one step depends on where the search starts.
- **Stall.** Three different offsets inside one step give `bisect` a middle state equal to neither end. Its
  `assertNotReached` is compiled out of the production build, so the loop repeats the same middle for ever.
- **`GetStartOfDay`** calls the same search when midnight is skipped, so it inherits the skipped pair.

`zdump -v` on tz 2026c, 1800 to 2100, all zones: the closest two changes of one zone are 601,200 s apart
(`America/Boa_Vista`, `America/Noronha`, `America/Recife` 2000-10-08 and 2000-10-15; `Asia/Gaza` and
`Asia/Hebron` 2040, 2054, 2072). Pairs under 14 days: those, `Africa/Tunis` 1943 (8.04 d), `Europe/Simferopol`
1944 (9.88 d), `Europe/Vienna` 1945 (10 d), `Europe/Riga` 1944 (10.92 d), `Europe/Tirane` 1943 (12 d),
`America/Argentina/Tucuman` 2004 (12.04 d), `America/Fortaleza` and `America/Maceio` 2000 (13.96 d).

### Repro (0.5.1; expected values from Node 26.10.0's native Temporal and `zdump -v`)

| Call | 0.5.1 | Expected |
| ---- | ----- | -------- |
| `Temporal.Instant.from("2000-10-01T12:00:00Z").toZonedDateTimeISO("America/Boa_Vista").getTimeZoneTransition("next")` | `null` | `2000-10-08T01:00:00-03:00[America/Boa_Vista]` |
| the same from `2000-07-02T00:00:00Z` | found (alignment) | the same value |
| `Temporal.PlainDate.from("2000-10-08").toZonedDateTime("America/Boa_Vista")` | `TypeError: Cannot read properties of null (reading 'sign')` | `2000-10-08T01:00:00-03:00[America/Boa_Vista]` |
| `Temporal.PlainDate.from("2000-10-08").toZonedDateTime("America/Noronha")` | `2001-10-14T01:00:00-01:00[America/Noronha]` | `2000-10-08T01:00:00-01:00[America/Noronha]` |
| `Temporal.ZonedDateTime.from("2000-10-08T12:00[America/Noronha]").hoursInDay` | `-8881` | `23` |
| `Temporal.ZonedDateTime.from("1944-04-15T14:00:00+02:00[Europe/Riga]").getTimeZoneTransition("next")` | never returns | `1944-10-02T02:00:00+01:00[Europe/Riga]` |
| `Temporal.Instant.from("1943-10-15T12:00:00Z").toZonedDateTimeISO("Europe/Simferopol").getTimeZoneTransition("next")` | never returns | `1944-04-03T03:00:00+02:00[Europe/Simferopol]` |
| `Temporal.Instant.from("1976-04-14T00:30:00Z").toZonedDateTimeISO("Africa/El_Aaiun").getTimeZoneTransition("next")` | `1976-04-14T01:00:00+00:00[Africa/El_Aaiun]` (correct on 0.5.1); on js-temporal `main`: never returns (read, not run); on tc39 `e8cc03f`: throws the bisection assertion (run) | `1976-04-14T01:00:00+00:00[Africa/El_Aaiun]` |
| the same from `1976-03-28T00:30:00Z` | correct on 0.5.1; on js-temporal `main`: never returns (read, not run); on tc39 `e8cc03f`: throws (run) | the same value |
| `Temporal.Instant.from("1976-05-01T00:30:00Z").toZonedDateTimeISO("Africa/El_Aaiun").getTimeZoneTransition("previous")` | correct on 0.5.1; on tc39 `e8cc03f`: throws (run) | `1976-05-01T01:00:00+01:00[Africa/El_Aaiun]` |

### GMT impact and workaround (`D13`)

Before the workaround `isInDaylightSaving("1944-04-15T14:00:00+02:00[Europe/Riga]")` never returned,
and `getDstTransitions("America/Boa_Vista", 2000)` listed one of three changes. While the probe fails GMT never calls the polyfill's search
in a named zone: `internal/zonedTransitionSearch.ts` samples every 5 days (432,000 s, 169,200 s under the
closest pair) and bisects the one change a differing step can hold. The assumption is pinned by an all-zones
guard that reads `Intl.DateTimeFormat`, and on Node 26 the search is compared with native Temporal for every
change from 1900 to 2040 in every zone.

## L. A one-character annotation key is refused

### Status

Fixed upstream, in no release. unicode-org/icu4x#8620 ("ixdtf: annotation keys and values skip validation of
some characters and reject one character keys and values") was closed by unicode-org/icu4x#8623 on 2026-10-20.
Neither an `ixdtf` release nor a V8 roll carries it yet, so Node 26.10.0 and Chromium 153.0.8010.12 have the
defect. **Not a polyfill defect**: `@js-temporal/polyfill` 0.5.1 accepts the strings. Nothing to file. GMT
makes no change: it already follows the spec text (CORE-8, "Where GMT follows the spec text over native").

### What goes wrong

The Temporal string grammar writes an annotation key as `AKeyLeadingChar AKeyChar*`, so a key of one
character is valid (`AKeyLeadingChar` is a lower-case letter or `_`). RFC 9557 §4.1 says the same:
`suffix-key = key-initial *key-char`. V8 reads annotations with `temporal_rs`, which uses `ixdtf`. Its
key parser required a second character and stopped with `AnnotationKeyChar`, whose text is `Temporal error:
Invalid annotation key character.` A string with such an annotation is refused by every operation that reads
it, although Temporal ignores an annotation it does not know.

### Repro (Node 26.10.0 and Chromium 153.0.8010.12; polyfill 0.5.1 accepts all four)

| Call | Native | Expected |
| ---- | ------ | -------- |
| `Temporal.PlainDate.from("2024-03-10[a=bc]")` | `RangeError: Temporal error: Invalid annotation key character.` | `2024-03-10` |
| `Temporal.PlainTime.from("12:30[a=bc]")` | the same | `12:30:00` |
| `Temporal.Instant.from("2024-01-01T00:00:00Z[x=T123460Z]")` | the same | `2024-01-01T00:00:00Z` |
| `Temporal.PlainDate.from("2024-10-03[x=y][u-ca=roc]")` | the same | `2024-10-03[u-ca=roc]` |

### Effect on GMT

None in the library, which reads these strings correctly on the polyfill. The native-suite runner tags the
ten tests that pin this (`isValidDate`, `isValidDateTime`, `isValidTime`, `isValidInstant` ×2, `isValidUtc`,
`spanNs`, `getTimeZoneOffset`, `totalDuration`, `parseCalendarDateValue`) to this section. When a V8 roll
carries the fix the tags go stale and the runner reports it.

## M. `[u-ca=islamic]` is accepted instead of refused

### Status

**Open upstream** as boa-dev/temporal#529 ("handling of 'islamic' and 'islamic-rgsa' calendars", open since
2025-08-29). Not a polyfill defect: `@js-temporal/polyfill` 0.5.1 throws `RangeError`, as the spec does.
Nothing to file. GMT makes no change: it follows the spec.

### What goes wrong

`islamic` is not a calendar Temporal supports. The `islamic` to `islamic-tbla` fallback exists only in
`Intl.DateTimeFormat` (Intl Era and Month Code proposal, `CreateDateTimeFormat`); test262
`intl402/Temporal/PlainDate/from/islamic.js` and its twins expect `RangeError`. `temporal_rs` canonicalises
`islamic` to a supported calendar instead. Node 26.10.0 reports `Temporal.PlainDate.from("2024-10-03[u-ca=islamic]").calendarId`
as `islamic-civil`, and its other errors carry the `Temporal error:` prefix of `temporal_rs`, which is the
evidence that V8 takes that path for calendar ids.

### Repro (Node 26.10.0 and Chromium 153.0.8010.12)

| Call | Native | Expected (test262) |
| ---- | ------ | ------------------ |
| `Temporal.PlainDate.from("2024-10-03[u-ca=islamic]")` | `2024-10-03[u-ca=islamic-civil]` | `RangeError` |
| the same with `PlainDateTime` and `ZonedDateTime` strings | accepted | `RangeError` |

### Effect on GMT

None in the library. Three tests pin the `RangeError` (`parseCalendarDateValue`, `isValidCalendarDate`,
`isValidCalendarZonedDateTime`); the native-suite runner tags them to this section.

## N. `ZonedDateTime.prototype.round` to `day` when a date starts twice

### Title

ZonedDateTime.prototype.round: port the day-length clamp from tc39/proposal-temporal#3312

### Status

Fixed in the specification: TC39 reached consensus on 2026-05-19 to clamp the instant to `endNs − 1` in
`round` (tc39/proposal-temporal#3312, closed 2026-05-28). The spec change is in the ECMA-262 Temporal PR
tc39/ecma262#3966 (commit `5f44331e0a11`), which is open; it is not in proposal-temporal's own spec
text, which still asserts `thisNs < endNs`. test262 pins it in
`intl402/Temporal/ZonedDateTime/prototype/round/same-date-starts-twice.js`.
The reference polyfill fix is proposal-temporal `59a51ea9d4` ("Cap day span at <100% of day length").
`@js-temporal/polyfill` 0.5.1 predates it and no port to js-temporal is open. Node 26.10.0's V8 also predates
it and throws. Chromium 153 has it. **Nothing to file**: js-temporal pulls proposal-temporal commits
in order, as its maintainers asked (#367–#372). On 2026-10-21 its `main` had reached commits from January
2026, so `59a51ea9d4` (May 2026) is still ahead and arrives with the catch-up; a separate port request
would cut across that order. V8 needs no report either: Chromium 153 already has the fix, so a later Node
picks it up. GMT works around it as temporalCompat
**D14** (`internal/zonedWallClockOperations.ts`, `roundZonedDateTime` day branch).

### What goes wrong

A fall-back across midnight can start one calendar date twice: `America/Goose_Bay` on 2010-11-06 (at 00:00 −03:00 the
clocks go back to 23:00 −04:00, so 23:30 happens twice), `Antarctica/Casey` on 2010-03-04. For an instant in the second piece of
that date, rounding to `day` needs the date's length. Without the clamp the polyfill measures to the next
date's start, so `trunc` and `floor` answer the next date's midnight and `ceil` and `expand` the end of the
next date. The half modes are wrong where the clock went back by about a day (`America/Sitka`, 1867-10-18).

### Repro

| Call | polyfill 0.5.1 | Node 26.10.0 | Chromium 153 and tc39/ecma262#3966 |
| ---- | -------------- | ------------ | ------------------------- |
| `Temporal.ZonedDateTime.from("2010-11-06T23:30:00-04:00[America/Goose_Bay]").round({ smallestUnit: "day", roundingMode: "trunc" })` | `2010-11-07T00:00:00-03:00` | `RangeError: Temporal error: ZonedDateTime is outside the expected day bounds` | `2010-11-06T00:00:00-03:00` |
| the same with `roundingMode: "ceil"` | `2010-11-07T23:00:00-04:00` | the same `RangeError` | `2010-11-07T00:00:00-03:00` |

### GMT

Fixed in `roundZoned` and `roundUnix` as **D14**: while the probe fails GMT applies the clamp itself, and
the rows in `roundZoned.test.ts` and `roundUnix.test.ts` hold test262's values. The workaround retires on the
first js-temporal release containing the port. No tag in the native-suite lists: GMT answers correctly on
every runtime.

## O. A `Z` string is read by wall clock under `offset: "ignore"`

### Title

ToTemporalZonedDateTime: keep a `Z` string's own instant when `offset` is `"ignore"`

### Status

**Not filed upstream yet.** The owner files every item. Found in review of PR #338 (CORE-83,
`classifyStoredZoned`). Neither tc39/proposal-temporal#3331 (J) nor #3332 (K) covers it. Confirmed on polyfill
0.5.1 and on native V8 (Node 24.21.0, `--harmony-temporal`). Not fixed on js-temporal `main` (`c55b211`,
2026-09-22) or tc39/proposal-temporal `main` (`e8cc03f`, 2026-07-27): both `InterpretISODateTimeOffset`s test
`offsetBehaviour === 'wall' || offsetOpt === 'ignore'`, which drops the spec's "`offsetBehaviour` is ~option~" condition
(`spec/zoneddatetime.html`, read 2026-10-22). GMT works around it as temporalCompat **D15** (`internal/zonedWallClock.ts` `zExactOptions`, probe
`isZIgnoreExactCompatNeeded`).

### What goes wrong

`ToTemporalZonedDateTime` sets `offsetBehaviour` to ~exact~ when the string has a UTC designator (`Z` or `z`).
`InterpretISODateTimeOffset` step 3 applies `ignore` only when `offsetBehaviour` is ~wall~, or ~option~ with
`offsetOption` `ignore`; step 4 takes the written instant when `offsetBehaviour` is ~exact~. So a `Z` string is
the string's own instant under every `offset` value. Polyfill 0.5.1 and V8 apply `ignore` first and read the
wall clock in the zone.

### Repro (Node 24.21.0)

| Call | polyfill 0.5.1 and native V8 | Expected (spec) |
| ---- | ---------------------------- | --------------- |
| `Temporal.ZonedDateTime.from("2022-07-08T00:14:07Z[Europe/London]", { offset: "ignore" }).toInstant().toString()` | `2022-07-07T23:14:07Z` | `2022-07-08T00:14:07Z` |
| the same string with `offset: "use"` | `2022-07-08T00:14:07Z` | `2022-07-08T00:14:07Z` |

Near a range limit the wall-clock reading can also throw for an instant the spec accepts:
`+275760-09-13T00:00:00Z[America/Sao_Paulo]` with `ignore` (wall clock `00:00`, instant `03:00Z`, past the maximum).

### GMT

`zonedDateTimeFrom` reads a string with a `Z` or `z` designator with `offset: "use"` in place of `"ignore"`
while the `D15` probe fails. That is the exact reading, so removal changes no answer. It covers every caller:
`classifyStoredZoned` (its all-16-cells test now runs the `Z` rows) and `calendarSystemOfZonedValue`, which
read with `ignore`. No public function takes a caller-chosen `offset` for a string it parses with
`zonedDateTimeFrom` (`setZoned`, `cycleZoned` and the others parse their input with the default options).

## P. SpiderMonkey accepts a zoned string whose local date is −271821-04-19 (Firefox only, engine)

### Status

**Open upstream** as https://bugzilla.mozilla.org/show_bug.cgi?id=1998020 ("Temporal: ZonedDateTime with
out-of-range date should be rejected", NEW since 2025-11-03). A known departure from the spec, tracked as a bug (Mozilla's `jstests.list` says "Unclear if minimum limit is correct"), not a
polyfill defect: `@js-temporal/polyfill` 0.5.1, Node 26 and Chromium 153 throw `RangeError`, as the spec and
test262 require. Nothing to file. GMT makes no change: it follows the spec (see [J](#j-zoneddatetimeprototypetostring-writes-a-string-zoneddatetimefrom-refuses-tc39-only-spec)).

### What goes wrong

The `prefer` and `reject` branch of `InterpretISODateTimeOffset` runs `CheckISODaysRange` on the local
date, which refuses −271821-04-19. SpiderMonkey runs `ISODateTimeWithinLimits` instead
(`js/src/builtin/temporal/ZonedDateTime.cpp`), which accepts that date. So `from` (with `offset` set to
`reject` or `prefer`), `round` and `with` return a `ZonedDateTime` the spec refuses. Mozilla skips eight test262 files in `js/src/tests/jstests.list`:
`built-ins/Temporal/ZonedDateTime/{compare,from,equals,since,until}/argument-string-limits.js` and
`built-ins/Temporal/Duration/{compare,total,round}/relativeto-string-limits.js`, with a
comment that points at tc39/proposal-temporal#3014. The champions kept the check there (see J).

### Repro (SpiderMonkey 155.0; the polyfill, Node 26 and Chromium 153 throw `RangeError`)

`MIN` is `-8640000000000000000000n`, the first instant.

| Call | SpiderMonkey 155.0 | Expected (spec) |
| ---- | ------------------ | --------------- |
| `Temporal.ZonedDateTime.from("-271821-04-19T23:00-01:00[-01:00]", { offset: "reject" })` | `-271821-04-19T23:00:00-01:00[-01:00]` | `RangeError` |
| `Temporal.ZonedDateTime.from("-271821-04-19T23:59:00-00:01[Europe/London]")` | accepted | `RangeError` |
| `new Temporal.ZonedDateTime(MIN + 400_000_000n, "-00:45").round("second")` | `-271821-04-19T23:15:00-00:45[-00:45]` | `RangeError` |
| `new Temporal.ZonedDateTime(MIN, "-00:45").with({ millisecond: 0 })` | accepted | `RangeError` |

### Effect on GMT

None in the library. Twelve tests pin the `RangeError` or the sentinel it produces
(`zonedDateTimeFrom` ×3, `minuteRoundedOffsets` ×2, `storedOffsetValues` ×2, `convertZonedToCalendar` ×5);
the native-suite runner tags them to this section on the Firefox leg. When Firefox changes the check the
tags go stale and the runner reports it.

## Q. Firefox `formatRange` prints AM/PM for a day period when a zone name is set (Firefox only, engine)

### Status

**Open upstream** as https://bugzilla.mozilla.org/show_bug.cgi?id=2085525 ("Intl.DateTimeFormat formatRange prints AM/PM instead of the dayPeriod when timeZoneName is set", UNCONFIRMED since 2026-10-24; reproduced in Firefox 155.0 and 158.0.1). SpiderMonkey only; Node 22, 24 and 26 and the other engines in the matrix print the flexible day period in a range, as a single format does. GMT repairs it as `D17` (a lazy probe, dormant on every engine that passes), scoped to Firefox (`engines: ["firefox"]` in `scripts/lib/workarounds.mjs`, so the Node, Chromium and WebKit checks report it as out of scope, never removable). The removal signal is the weekly run's compat check in Firefox (`scripts/lib/native-suite-compat.mjs`, the `temporal-compat-firefox` verdict): it runs the `D17` repros in the Firefox the native suite uses, and once every one returns `same` the run files the removal issue. The lenient `D17` rows and the `formatZonedRange` rows pass either way and cannot carry that signal.

### What goes wrong

With `dayPeriod` and `timeZoneName` both set, and neither `hourCycle` nor `hour12`, `Intl.DateTimeFormat.prototype.formatRange` prints each endpoint with AM/PM instead of the flexible day period. The parts come back as `startRange` and `endRange` only; there is no shared `dayPeriod` part.

This is not a width rule: UTS #35 (Matching Skeletons) treats the day period letters a, b and B as close matches, so the skeleton does not demand the flexible form. The argument is a contradiction between two requests that resolve alike. ECMA-402 §11.5.8 (`FormatDateTimeRange`) picks the range pattern by the resolved `[[HourCycle]]` only (and builds each part with §11.5.4 `FormatDateTimePattern` over that pattern's fields). en-US resolves to `h12` whether `hourCycle: "h12"` is given or omitted. Yet with it given, Firefox prints the flexible period, and with it omitted, AM/PM. Identical resolved options give two different range outputs. GMT's own contract adds that a range keeps the fields the caller asked for.

### Repro (en-US, `America/New_York`, 2024-02-29 10:00 to 12:00 local, `{ hour: "numeric", dayPeriod: "short", timeZoneName: "shortOffset" }`)

| Call | Firefox 155.0 | Expected (Node 26) |
| ---- | ------------- | ------------------ |
| `formatRange(start, end)` | `10 AM GMT-5 – 12 PM GMT-5` | `10 in the morning GMT-5 – 12 noon GMT-5` |
| `format(start)` / `format(end)` | `10 in the morning GMT-5` / `12 noon GMT-5` | same |
| `formatRange` with `hourCycle: "h12"` added | flexible periods | same |

It also happens with `timeZoneName` `short` and `long`, and with `minute` set. It does not happen with no `timeZoneName`, or with `hourCycle: "h12"` or `hour12: true`.

Probe: `new Intl.DateTimeFormat("en", { hour: "numeric", dayPeriod: "short", timeZone: "+01:00", timeZoneName: "short" })`, comparing the `dayPeriod` parts of `formatRangeToParts(32_400_000, 39_600_000)` with those of `formatToParts` on each endpoint. Firefox: range `["AM","PM"]`, single `["in the morning","noon"]`.

### Effect on GMT

`formatZonedRange` rebuilds the range from the endpoint parts and writes each endpoint's single-format day period (the `dayPeriod` entry of `repairRangeParts`, `internal/repairRangeParts.ts`). Output is byte-identical when the probe passes. `internal/repairRangeParts.test.ts` runs the merge on the parts Firefox returns (each row fails when the merge is reverted), and the `formatZonedRange` rows run unmocked, so they exercise the real repair on the Firefox leg.

## R. Islamic calendars read dates before the Hijra as positive years in WebKit (polyfill and engine)

### Status

**Not filed.** Draft in the session scratchpad (`draft-upstream-polyfill-islamic-era.md`); the owner files it on js-temporal/temporal-polyfill. Reproduced with polyfill 0.5.1 in Playwright WebKit 26.6 (JavaScriptCore, macOS); V8 (Node 26, Chromium 153) and SpiderMonkey (Firefox 155) are right. GMT corrects it as `D18` (a lazy probe, dormant on every engine that passes), scoped to WebKit (`engines: ["webkit"]` in `scripts/lib/workarounds.mjs`, so the Node, Chromium and Firefox checks report it as out of scope, never removable). The removal signal is the weekly run's compat check in WebKit (`temporal-compat-webkit`): once every `D18` repro returns the spec value there, the run files the removal issue. js-temporal `main` declares the Islamic eras (`ah`, `bh`); whether its era parser accepts WebKit's `Before Hijra` spelling is untested, so a release may or may not retire D18 on its own.

### What goes wrong

WebKit's `Intl.DateTimeFormat` prints an `islamic-civil`, `islamic-tbla` or `islamic-umalqura` date before the Hijra as a positive year with the era `Before Hijra`, where V8 and SpiderMonkey print a negative year in the one era. `lib/calendar.ts` `IslamicBaseHelper` has no era (`hasEra = false`), takes the year part as printed and ignores the era part. Three consequences in WebKit:

- A read of such a date gives the mirror year: ISO `0621-01-01` is year 2 instead of -1, `-271821-04-19` is 280805 instead of -280804. Month, month code and day are right.
- Fields → ISO for a year <= 0 never returns: the polyfill steps its estimate until the printed year matches, and no date prints a year <= 0.
- Fields → ISO for year 1 lands in year 0 (which prints as 1) or never returns, so `add` and `until` whose intermediate year is 1 give a date a year early or hang. The epoch day itself (ISO `0622-07-19`, 1 Muharram of year 1 in `islamic-civil`) prints as year `0`, era `Before Hijra`, in WebKit; the day after prints as year `1`, era `AH`. `Temporal.PlainDate.from("0623-11-01[u-ca=islamic-civil]").add({ years: -1 })` is `0621-11-23` (V8: `0622-11-12`); `from({ year: 1, month: 1, day: 1, calendar: "islamic-civil" })` does not return.

The Intl era/monthCode proposal numbers the years through the epoch: `bh` era year n is year 1 - n, and Temporal's `year` is that number in every engine.

### Repro (polyfill 0.5.1, Playwright WebKit 26.6; expected values Node 26.12.1 native Temporal)

| Call | WebKit | Expected |
| ---- | ------ | -------- |
| `PlainDate.from("0621-01-01").withCalendar("islamic-civil").year` | `2` | `-1` |
| `PlainDate.from("0500-01-01").withCalendar("islamic-civil").year` | `127` | `-126` |
| `PlainDate.from("-271820-01-19[u-ca=islamic-civil]").year` | `280805` | `-280804` |
| `PlainDate.from("0622-07-19").withCalendar("islamic-civil").year` | `0` | `1` |
| `PlainDate.from({ year: 1, month: 5, day: 1, calendar: "islamic-civil" })` | `0621-11-25` | `0622-11-14` |
| `PlainDate.from({ year: 1, month: 1, day: 1, calendar: "islamic-civil" })` | does not return | `0622-07-19` |
| `PlainDate.from("-271821-04-19[u-ca=islamic-civil]").until("-271820-01-19[u-ca=islamic-civil]", { largestUnit: "months" })` | does not return | `P9M9D` |

`islamic-tbla` and `islamic-umalqura` behave the same (days differ by the calendar's own rule). The engine side: `new Intl.DateTimeFormat("en-u-ca-islamic-civil", { era: "short", year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" }).formatToParts(...)` for ISO `0621-01-01` gives era `Before Hijra`, year `2` in WebKit and era `AH`, year `-1` in V8.

### Effect on GMT

Before D18 the WebKit control pass of the native suite (the polyfill in WebKit) hung on row 82 of `plain/calculate/diffDateAsDuration.edges.test.ts` and ate the runner's memory. `calendarFields.ts` now corrects the year when `islamicEra.ts` says the date's era part is not a modern date's (two outputs of the same formatter, so GMT owns no era name or epoch), `calendarDateFromFields.ts` never asks the polyfill for an Islamic year <= 1 and searches when any other Islamic year's answer does not read back, and `calendarDateArithmetic.ts` runs the spec loops over the read-backed model, with `fixedMonthArithmetic.ts` for the month steps, whenever an operation comes within 2 years of such a year. Output is byte-identical on every engine that passes the probe.

## S. WebKit adds a year to the 30th of Dhu al-Hijjah before the Hijra as 13 months (WebKit only, engine)

### Status

**Not filed.** Draft in the session scratchpad (`draft-webkit-islamic-add-year.md`); the owner files it on bugs.webkit.org. Reproduced on WebKit 26.6's own `Temporal` (JavaScriptCore; Playwright's Linux build and the Mac build agree). The polyfill in the same WebKit, V8 (Node 26.12.1, Chromium 153) and SpiderMonkey (Firefox 155) give the spec value. Six rows of the native suite fail on it and are tagged with this anchor in `scripts/lib/native-suite-tags.mjs` (WebKit leg only).

### What goes wrong

In `islamic-civil`, `islamic-tbla` and `islamic-umalqura`, adding `{ years: 1 }` or `{ months: 12 }` to the 30th of Dhu al-Hijjah (`M12` day 30) of a year before the Hijra (year 0 and earlier) lands on the 30th of Muharram two years on: 13 months instead of 12. The target month has 29 days, so the spec constrains the day to 29 (`CalendarDateAdd`, `overflow: "constrain"`); WebKit instead carries the day into the next year. The same add from year -1, from any year after the Hijra, or from day 29 is right. `until` with `largestUnit: "years"` across such a date is a month short.

### Repro (WebKit 26.6 native `Temporal`; expected values Node 26.12.1 native `Temporal`, which the polyfill in WebKit also gives)

| Call | WebKit | Expected |
| ---- | ------ | -------- |
| `PlainDate.from("0600-03-25").withCalendar("islamic-civil").add({ years: 1 })` (year -23, M12 day 30) | `0601-04-13` (year -21, M01 day 30) | `0601-03-14[u-ca=islamic-civil]` |
| `PlainDate.from("0100-07-25").withCalendar("islamic-civil").add({ years: 1 })` (year -538, M12 day 30) | `0101-08-13` | `0101-07-14[u-ca=islamic-civil]` |
| `PlainDate.from("-010000-07-17").withCalendar("islamic-civil").add({ years: 1 })` (year -10948, M12 day 30) | `-009999-08-05` | `-009999-07-06[u-ca=islamic-civil]` |
| `PlainDate.from("-271820-01-19[u-ca=islamic-civil]").add({ years: 1 })` (year -280804, M12 day 30) | `-271819-02-06` | `-271819-01-07[u-ca=islamic-civil]` |
| `PlainDate.from("-271820-01-19[u-ca=islamic-civil]").add({ months: 12 })` | `-271819-02-06` | `-271819-01-07[u-ca=islamic-civil]` |
| `PlainDate.from("-271820-01-19[u-ca=islamic-civil]").until("-271819-06-27[u-ca=islamic-civil]", { largestUnit: "years" })` | `P1Y4M23D` | `P1Y5M23D` |
| `PlainDate.from("0621-07-29").withCalendar("islamic-civil").add({ years: 1 })` (year -1, M12 day 30) | `0622-07-18` | `0622-07-18` |
| `PlainDate.from("2024-07-07").withCalendar("islamic-civil").add({ years: 1 })` (year 1445, M12 day 30) | `2025-06-26` | `2025-06-26` |
| `PlainDate.from("-271820-01-18[u-ca=islamic-civil]").add({ years: 1 })` (year -280804, M12 day 29) | `-271819-01-07` | `-271819-01-07` |

`islamic-tbla` (`-271820-01-18` is its M12 day 30; WebKit adds to `-271819-02-05`, expected `-271819-01-06`) and `islamic-umalqura` (as `islamic-civil` at these dates) behave the same.

### Effect on GMT

Only GMT run on WebKit's own `Temporal` sees it: `addDate`, `diffDateAsDuration` and every function built on them return the engine's answer for such a date, and the D18 probe passes there (WebKit reads the year right; it is the add that is wrong), so D18's own arithmetic does not engage. GMT on the polyfill, in WebKit or anywhere else, is right. The six native-suite rows (`plain/calculate/addDate.edges.test.ts` and `plain/calculate/diffDateAsDuration.edges.test.ts`, the `xscan islamic-* min` rows) are tagged; the tag goes stale, with a finding, once WebKit adds the year right.

## T. WebKit throws adding a year to the last day of Chaitra in far-past Indian years (WebKit only, engine)

### Status

**Not filed.** Draft in the session scratchpad (`draft-webkit-indian-add-year.md`); the owner files it on bugs.webkit.org. Reproduced on WebKit 26.6's own `Temporal` (JavaScriptCore; Playwright's Linux build and the Mac build agree). The polyfill in the same WebKit, V8 (Node 26.12.1, Chromium 153) and SpiderMonkey (Firefox 155) give the spec value. One row of the native suite fails on it and is tagged with this anchor in `scripts/lib/native-suite-tags.mjs` (WebKit leg only).

### What goes wrong

In the `indian` calendar, `add({ years: n })` and `add({ months: 12 })` from the last day of Chaitra (`M01` day 30, or day 31 in a leap year) throw `RangeError: Result of calendar date addition is outside representable range` for every probed ISO year from -4800 back to the range minimum, while the same add from ISO -4700 and later returns the constrained date. Chaitra's last day is 20 April in ISO terms, so each row below uses that day. Any other day of the year adds correctly at every probed year, `with({ year })` works at the same dates, and `until` with `largestUnit: "years"` across such a date throws the same error while `"months"` and `"days"` return.

### Repro (WebKit 26.6 native `Temporal`; expected values Node 26.12.1 native `Temporal`, which the polyfill in WebKit also gives)

| Call | WebKit | Expected |
| ---- | ------ | -------- |
| `PlainDate.from("-004800-04-20[u-ca=indian]").add({ years: 1 })` (year -4878, M01 day 31) | throws `RangeError` | `-004799-04-20[u-ca=indian]` |
| `PlainDate.from("-004700-04-20[u-ca=indian]").add({ years: 1 })` (year -4778, M01 day 30) | `-004699-04-20` | `-004699-04-20[u-ca=indian]` |
| `PlainDate.from("-009924-04-20[u-ca=indian]").add({ years: 1 })` (year -10002, M01 day 31) | throws `RangeError` | `-009923-04-20[u-ca=indian]` |
| `PlainDate.from("-009924-04-19[u-ca=indian]").add({ years: 1 })` (year -10002, M01 day 30) | throws `RangeError` | `-009923-04-20[u-ca=indian]` |
| `PlainDate.from("-009922-04-21[u-ca=indian]").add({ years: 1 })` (year -10000, M02 day 1) | `-009921-04-21` | `-009921-04-21[u-ca=indian]` |
| `PlainDate.from("-009924-04-20[u-ca=indian]").with({ year: -10001 })` | `-009923-04-20` | `-009923-04-20` |
| `PlainDate.from("-271821-04-20[u-ca=indian]").until("-271819-06-27[u-ca=indian]", { largestUnit: "years" })` | throws `RangeError` | `P2Y2M7D` |
| `PlainDate.from("-271821-04-20[u-ca=indian]").until("-271819-06-27[u-ca=indian]", { largestUnit: "months" })` | `P26M7D` | `P26M7D` |

The other calendars (`persian`, `hebrew`, `coptic`, `ethiopic`, `buddhist`, `japanese`, `roc`, `gregory`, `chinese`, `dangi`, the three `islamic-*`) add a year at ISO -271000 without error.

### Effect on GMT

Only GMT run on WebKit's own `Temporal` sees it: `diffDateAsDuration` returns the sentinel `""` where the engine throws. GMT on the polyfill is right. The one native-suite row (`plain/calculate/diffDateAsDuration.edges.test.ts`, the `xscan indian min` row) is tagged; the tag goes stale, with a finding, once WebKit returns the date.

## U. `ZonedDateTime#equals` answers false for two identifiers of one zone where `resolvedOptions` keeps the identifier (polyfill; shows in JavaScriptCore)

### Title

TimeZoneEquals: find a non-primary identifier's primary without `Intl.DateTimeFormat#resolvedOptions`, which the Time Zone Canonicalization proposal makes return the identifier as written

### Status

**Not filed upstream yet.** The owner files every item. Found by the native suite's WebKit control pass
(#378): four `diffZoned` and `intervalLengthZoned` rows, a calendar unit between `UTC` and `Etc/UTC` or
`Asia/Calcutta` and `Asia/Kolkata`, returned `null` on polyfill 0.5.1 in Playwright WebKit 26.6 and passed on
native WebKit `Temporal`, Node 26, Chromium 153 and Firefox 155. Confirmed on polyfill 0.5.1;
`GetAvailableNamedTimeZoneIdentifier` in `lib/ecmascript.ts` is the same on js-temporal `main` (read 2026-10-25).
No upstream issue found (searched the polyfill's issues for `resolvedOptions`, `canonical` and
`GetAvailableNamedTimeZoneIdentifier`). GMT works around it as temporalCompat **D19** (`temporalCompat/timeZoneEquals.ts`,
probe `isTimeZoneEqualsCompatNeeded`), scoped to WebKit (`engines: ["webkit"]` in `scripts/lib/workarounds.mjs`, so the
Node, Chromium and Firefox checks report it out of scope, and the weekly run's `temporal-compat-webkit` verdict decides).

### What goes wrong

The polyfill's `TimeZoneEquals(one, two)` compares `GetAvailableNamedTimeZoneIdentifier(id).primaryIdentifier` for the
two identifiers. That function returns the identifier itself when `Intl.supportedValuesOf("timeZone")` lists it, and
otherwise `new Intl.DateTimeFormat("en-US", { timeZone: id }).resolvedOptions().timeZone`.

ECMA-402 `main` (`spec/datetimeformat.html`, CreateDateTimeFormat) sets [[TimeZone]] to the identifier record's
[[PrimaryIdentifier]], so V8 and SpiderMonkey return `UTC` for `Etc/UTC` and the polyfill is right there. The Stage 3
Time Zone Canonicalization proposal (tc39/proposal-canonical-tz, Stage 3 since July 2023, to be merged through Temporal;
`spec/intl.html`) changes that step to keep [[Identifier]], and JavaScriptCore implements it (WebKit PRs #63050 and
#63185): `resolvedOptions().timeZone` is `Etc/UTC` for `Etc/UTC` and `Asia/Calcutta` for `Asia/Calcutta`, while
`supportedValuesOf` lists only `UTC` and `Asia/Kolkata`. No Intl API on such a host exposes the primary identifier. So
the polyfill, on a host that follows the newer rule, compares the identifiers as written and answers false.

The specification is not in doubt either way. ECMA-402 §6.5 Time Zone Identifiers (`spec/locales-currencies-tz.html`)
requires `"UTC"` to be a primary identifier and `"Etc/UTC"`, `"Etc/GMT"`, `"GMT"` and every link to them to be
non-primary identifiers that resolve to `"UTC"`, and ECMA-262 TimeZoneEquals compares the two [[PrimaryIdentifier]]s.
`Etc/UTC` equals `UTC` on every host; the rest of the pairs are the IANA backward links.

### Repro (polyfill 0.5.1, Playwright WebKit 26.6, macOS; `ZonedDateTime` is `Temporal.ZonedDateTime`)

| Call | Polyfill in WebKit 26.6 | Expected (spec; native WebKit 26.6, Node 26, Chromium 153) |
| ---- | ----------------------- | ---------------------------------------------------------- |
| `new ZonedDateTime(0n, "Etc/UTC").equals(new ZonedDateTime(0n, "UTC"))` | `false` | `true` |
| `new ZonedDateTime(0n, "Asia/Calcutta").equals(new ZonedDateTime(0n, "Asia/Kolkata"))` | `false` | `true` |
| `new ZonedDateTime(0n, "Europe/Kiev").equals(new ZonedDateTime(0n, "Europe/Kyiv"))` | `false` | `true` |
| `new Intl.DateTimeFormat("en-US", { timeZone: "Etc/UTC" }).resolvedOptions().timeZone` (the host, not the polyfill) | `Etc/UTC` | `UTC` on V8; the proposal allows `Etc/UTC` |

Probe: `String(new Temporal.ZonedDateTime(0n, "Etc/UTC").equals(new Temporal.ZonedDateTime(0n, "UTC")))`, expected
`true`. It names the one pair ECMA-402 fixes, so GMT owns no time zone data.

### Effect on GMT

`diffZoned`, `diffZonedAsDuration` and `intervalLengthZoned` refuse a calendar unit (day or larger) between two time
zones, as Temporal's DifferenceTemporalZonedDateTime does, and return the sentinel. On the polyfill in JavaScriptCore the
pairs above counted as two zones, so `diffZoned("…[UTC]", "…[Etc/UTC]", "days")` was `null`. With D19, where the probe
fails, GMT first resolves `Etc/UTC`, `Etc/GMT` and `GMT` to `UTC` by name, the last step of ECMA-402
AvailableNamedTimeZoneIdentifiers, which needs no time zone data and holds on every host, Safari 27 included. For any
other pair it asks the host's own `Temporal.ZonedDateTime#equals` when `globalThis.Temporal` exists (WebKit 26.6).

On a host without `Temporal` (Safari 27) the polyfill's answer stands for every other pair, and the IANA links
(`Asia/Calcutta` and `Asia/Kolkata`, and the links to `Etc/UTC` such as `Etc/UCT`) remain two zones. This is a limit of
the engine, not a gap in the workaround: resolving a link needs the IANA `backward`, `backzone` and `zone.tab` data,
`resolvedOptions().timeZone` keeps the identifier as written, `supportedValuesOf` lists only primary identifiers, and no
other Intl output names a link's primary (two zones with the same rules since 1970, such as `Europe/Oslo` and
`Europe/Berlin`, are still two primary identifiers, so comparing offsets cannot stand in for it). GMT owns no time zone
data, so those pairs wait for the polyfill fix or a WebKit `Temporal`. GMT's other identifier
comparisons (`areZonedEqual`, `areZonedEqualBy`, `formatZonedRange`, `mapZonedDatesInRange` and the same-zone range-limit
gates in `zonedWallClockDifference.ts`) go through `timeZoneEquals`, so the same limit applies to them: on a host without
`Temporal`, an IANA link such as `Europe/Kiev` and `Europe/Kyiv` is two zones there too, while `UTC`, `Etc/UTC`, `Etc/GMT` and
`GMT` are one zone on every host. The `diffZoned` and
`intervalLengthZoned` rows, the `diffZoned` and `diffZonedAsDuration` month-rounding and buddhist-calendar rows for
`UTC` and `Etc/UTC`, and the `areZonedEqual`, `areZonedEqualBy`, `formatZonedRange` and `mapZonedDatesInRange` rows run
unmocked, so they exercise the real path on the WebKit control pass.

## V. `PlainYearMonth.from` and `PlainMonthDay.from` reject an upper-case `iso8601` calendar annotation (polyfill; fixed on tc39 `main`)

### Title

ParseTemporalYearMonthString and ParseTemporalMonthDayString: canonicalize the calendar before checking that a `YYYY-MM` or `MM-DD` string names the ISO calendar

### Status

**Fixed on tc39 `main` by `385b479bf8` (2026-02-26, "Canonicalize calendar before checking YYYY-MM or MM-DD format"). Not yet on js-temporal `main`** (`c55b211`, 2026-09-22, still has the old check), so it arrives with the polyfill's in-order catch-up and the release in #373. Nothing to file: the fix exists upstream. The one commit fixes both parsers, so GMT works around both as the one temporalCompat **D20** (`temporalCompat/isoCalendarFrom.ts`, probe `isIsoCalendarCaseCompatNeeded`).

### What goes wrong

Two parsers in `@js-temporal/polyfill` 0.5.1 (`lib/ecmascript.ts`) compare the `u-ca` value with `'iso8601'` as written: `ParseTemporalYearMonthString` (the function at :619, comparison at :629, throws at :630) and `ParseTemporalMonthDayString` (the function at :641, comparison at :648, throws at :649). `Temporal.PlainMonthDay.from("--12-25[u-ca=ISO8601]")` throws "MM-DD format is only valid with iso8601 calendar", and `Temporal.PlainYearMonth.from("2026-10[u-ca=ISO8601]")` throws "YYYY-MM format is only valid with iso8601 calendar".

The specification lower-cases first. Temporal ParseISODateTime, for the goals TemporalMonthDayString with no DateYear and TemporalYearMonthString with no DateDay: "If _calendar_ is not ~empty~ and the ASCII-lowercase of _calendar_ is not *"iso8601"*, throw a *RangeError* exception". Calendar identifiers are case-insensitive everywhere else in Temporal, so `[u-ca=ISO8601]` is the ISO calendar.

### Repro (polyfill 0.5.1, Node 24.22.1)

| Call | Polyfill 0.5.1 | Expected (spec) |
| ---- | -------------- | --------------- |
| `Temporal.PlainMonthDay.from("--12-25[u-ca=ISO8601]").toString()` | `RangeError` | `12-25` |
| `Temporal.PlainMonthDay.from("--12-25[!u-ca=ISO8601]").toString()` | `RangeError` | `12-25` |
| `Temporal.PlainMonthDay.from("--12-25[u-ca=iso8601]").toString()` | `12-25` | `12-25` |
| `Temporal.PlainYearMonth.from("2026-10[u-ca=ISO8601]").toString()` | `RangeError` | `2026-10` |
| `Temporal.PlainYearMonth.from("2026-10[!u-ca=Iso8601]").toString()` | `RangeError` | `2026-10` |
| `Temporal.PlainYearMonth.from("2026-10[u-ca=iso8601]").toString()` | `2026-10` | `2026-10` |

Probe, two repros that share one answer: `Temporal.PlainMonthDay.from("--12-25[u-ca=ISO8601]").toString()`, expected `12-25`, and `Temporal.PlainYearMonth.from("2026-10[u-ca=ISO8601]").toString()`, expected `2026-10`; a throw counts as a failed repro.

### Effect on GMT

`isValidMonthDay`, `parseMonthDay`, `isValidYearMonth` and `parseYearMonth` would refuse `--12-25[u-ca=ISO8601]` and `2026-10[u-ca=ISO8601]`, which the specification reads. While the D20 probe fails, `monthDayFrom` and `yearMonthFrom` rewrite the value of every `[u-ca=…]` and `[!u-ca=…]` annotation to ASCII lower case before Temporal reads the string. Every other part of the string is passed unchanged, so every other error is Temporal's own.

## W. `PlainMonthDay.from` accepts a day no year has (polyfill and tc39 reference polyfill)

### Title

ParseTemporalMonthDayString: apply the IsValidMonthDay early error

### Status

**Not filed upstream yet.** Found while reading the `--MM-DD` grammar for CORE-102. Confirmed on polyfill 0.5.1. The same gap is in the tc39 reference polyfill, so the route is tc39 first, then the polyfill rebase. GMT needs no workaround and so has no D-number.

### What goes wrong

The grammar makes `--02-30` a Syntax Error (early error IsValidMonthDay: the day must exist in the month for some year). After `PARSE.monthday` matches, `ParseTemporalMonthDayString` never applies it.

| Call | Polyfill 0.5.1 | Expected (spec) |
| ---- | -------------- | --------------- |
| `Temporal.PlainMonthDay.from("--02-30").toString()` | `02-30` | `RangeError` |
| `Temporal.PlainMonthDay.from("--02-30").toPlainDate({ year: 2024 }).toString()` | `2024-02-29` | `RangeError` already at `from` |
| `Temporal.PlainMonthDay.from("--04-31")`, `"--02-31"` | accepted | `RangeError` |
| `Temporal.PlainMonthDay.from("0230")`, `"--0230"` | `02-30` | `RangeError` |

The year-month twin (`ParseTemporalYearMonthString`, :619) has no day to check and no GMT caller.

### Effect on GMT

None. The `plainMonthDay` regex (`regex/month-day.ts`) encodes IsValidMonthDay in its alternation and refuses these strings before Temporal reads them, so `isValidMonthDay` and `parseMonthDay` return the sentinel for them on every polyfill version. W stays here as a record for the owner to file.

## X. `toLocaleString` rebuilds the options from `resolvedOptions()`, so a month width the locale prints numerically is lost (polyfill and tc39 reference polyfill; Chromium shows it too)

### Title

DateTimeFormat: build the Temporal formats from the caller's options, not from resolvedOptions()

### Status

**Not filed upstream yet.** Found while choosing an oracle for `formatMonthDay` in CORE-102. Confirmed on polyfill 0.5.1 (Node 24.22.1, ICU 78.3). tc39's reference polyfill has the same clone (`e8cc03fc97`, `polyfill/lib/intl.mjs`, `internalCreateDateTimeFormat` at :133, clone at :238–:247), so the route is tc39 first, then the polyfill rebase. Native Chromium 153 prints the same as the polyfill for `PlainMonthDay` and `PlainDate`, so V8 needs its own report; native WebKit 26.6 prints the expected values. GMT needs no workaround and so has no D-number.

### What goes wrong

`createDateTimeFormat` (`lib/intl.ts:65`) builds an `Intl.DateTimeFormat` from the caller's options, then stores a clone of its `resolvedOptions()` (`:111`, `:128`–`:139`) and builds the Temporal formatters from that clone. `resolvedOptions()` reports the widths of the pattern the locale chose, not the widths asked for: in zh-CN, zh-TW and ja-JP, `{ month: "long", day: "numeric" }` with no year resolves to `month: "numeric"`, because the CLDR pattern `M月d日` writes the month as a number. The rebuilt formatter then asks for a numeric month and gets `12/25`. The specification builds `[[TemporalPlainMonthDayFormat]]` and the other Temporal formats with GetDateTimeFormat over the caller's options (CreateDateTimeFormat), so the requested width reaches the format matcher.

| Call (ICU 78.3) | Polyfill 0.5.1 | Expected (spec) |
| ---- | -------------- | --------------- |
| `Temporal.PlainMonthDay.from({ calendar: "gregory", monthCode: "M12", day: 25 }).toLocaleString("zh-CN", { calendar: "gregory", month: "long", day: "numeric" })` | `12/25` | `12月25日` |
| the same in `zh-TW` and `ja-JP`, and with `month: "short"` | `12/25` | `12月25日` |
| `Temporal.PlainDate.from("2024-12-25").toLocaleString("zh-CN", { calendar: "gregory", year: "numeric", month: "long", day: "numeric" })` | `2024/12/25` | `2024年12月25日` |
| `new Intl.DateTimeFormat("zh-CN", { calendar: "gregory", month: "long", day: "numeric", timeZone: "UTC" }).format(Date.UTC(1972, 11, 25, 12))` | `12月25日` | `12月25日` |

ko-KR resolves the same options to `month: "long"` and is not affected.

### Effect on GMT

None. GMT never calls `toLocaleString`: `formatMonthDay`, `formatDate` and the other formatters format epoch milliseconds through `cachedFormatter("DateTimeFormat", …)`, which passes the caller's widths to Intl, as the last row shows. X stays here as a record for the owner to file, and as the reason `formatMonthDay.test.ts` has no `toLocaleString` oracle.

## Y. `PlainYearMonth#add` and `#subtract` predate tc39 `41faca474a` (polyfill)

### Title

AddDurationToYearMonth: reject weeks, days and time, and start every subtraction from day 1

### Status

**Not filed upstream yet.** Found while specifying `addYearMonth` in CORE-102. Confirmed on polyfill 0.5.1 (Node 24.22.1). js-temporal `main` at `c55b211` still has the old code (`lib/ecmascript.ts:4714`), so the route is the polyfill's in-order catch-up to tc39 `41faca474a` (2026-01-15), then the release in #373. GMT needs no workaround and so has no D-number.

### What goes wrong

`AddDurationToYearMonth` in 0.5.1 (`lib/ecmascript.ts:4541`) does not reject a duration with weeks, days or time, and keeps the old `if (sign < 0)` branch that starts a subtraction from the last day of the month. The specification (tc39 `41faca474a`) throws a `RangeError` for weeks, days or time, sets `[[Day]]` to 1, and then runs CalendarDateFromFields and CalendarDateAdd, which throw when ISODateWithinLimits is false.

### Repro (polyfill 0.5.1, Node 24.22.1)

| Call | Polyfill 0.5.1 | Expected (spec) |
| ---- | -------------- | --------------- |
| `Temporal.PlainYearMonth.from("2026-10").add({ days: 1 })`, `{ weeks: 1 }`, `{ hours: 1 }` | `2026-10` | `RangeError` |
| `Temporal.PlainYearMonth.from("+275760-09").subtract({ months: 1 })` | `RangeError` | `+275760-08` |
| `Temporal.PlainYearMonth.from("-271821-05").subtract({ months: 1 })` | `-271821-04` | `RangeError` (day 1 is outside ISODateWithinLimits) |

### Effect on GMT

None. `addYearMonth`, `subtractYearMonth` and `diffYearMonth` never call `PlainYearMonth#add` or `#subtract`; they run the specification's steps on `PlainDate`. Y stays here as a record for the owner to file.

## Z. `PlainYearMonth#toLocaleString` with only `era` prints a day (polyfill; Chromium prints no date)

### Title

GetDateTimeFormat for ~year-month~: an `era` alone keeps the year-month defaults

### Status

**Not filed upstream yet.** Found while reviewing `formatYearMonth` in CORE-102. Measured 2026-10-28 on polyfill 0.5.1 (Node 24, and the polyfill in Chromium 153 and WebKit 26.6 with `GMT_TEMPORAL=polyfill`) and on native Temporal in Chromium 153 and WebKit 26.6. GMT needs no workaround and so has no D-number.

### What goes wrong

`yearMonthAmend` (`lib/intl.ts:419`) applies the year-month defaults only when `year`, `month` and `era` are all absent (`:445`). With only `era`, no default is applied, the underlying formatter gets `era` alone and falls back to its full date pattern, which prints a day. The specification's GetDateTimeFormat (required ~date~, defaults ~year-month~, inherit ~all~) copies `era`, then applies the year-month defaults because neither `year` nor `month` is present, so `year` and `month` become `"numeric"` next to the era.

### Repro (`ym` is `Temporal.PlainYearMonth.from({ calendar: "gregory", year: 2026, month: 10 })`)

| Call | Node (polyfill 0.5.1) | Chromium 153 native | WebKit 26.6 native | Specification |
| ---- | --------------------- | ------------------- | ------------------ | ------------- |
| `ym.toLocaleString("en-US", { calendar: "gregory", era: "short" })` | `10/1/2026 AD` | `AD` | `10/2026 AD` | `10/2026 AD` |
| the same polyfill in Chromium and WebKit | `10/1/2026 AD` | `10/1/2026 AD` | `10/1/2026 AD` | `10/2026 AD` |

### Effect on GMT

None. `formatYearMonth` formats epoch milliseconds through `cachedFormatter("DateTimeFormat", …)` with `year`, `month` and the caller's `era`, so `{ era: "short" }` gives the year-month with the era in every engine. Z stays here as a record for the owner to file.

## AA. `PlainYearMonth#toLocaleString` and `PlainMonthDay#toLocaleString` accept a `timeStyle` (polyfill)

### Title

toLocaleString: throw a TypeError for a `timeStyle` on a PlainYearMonth or PlainMonthDay

### Status

**Not filed upstream yet.** Found while reviewing `formatYearMonth` in CORE-102. Measured 2026-10-28 on polyfill 0.5.1 (Node 24, and in Chromium 153 and WebKit 26.6 with `GMT_TEMPORAL=polyfill`) and on native Temporal in Chromium 153 and WebKit 26.6. GMT needs no workaround and so has no D-number.

### What goes wrong

`yearMonthAmend` (`lib/intl.ts:419`) and `monthDayAmend` (`:452`) both pass `timeStyle: false` to `amend`, which deletes it, so the call formats as if no time style had been given. The specification's `toLocaleString` calls CreateDateTimeFormat with required ~date~, which throws a `TypeError` for a `timeStyle` because a time style is a time option; both native engines throw.

### Repro (`ym` is `Temporal.PlainYearMonth.from({ calendar: "gregory", year: 2026, month: 10 })`, `md` is `Temporal.PlainMonthDay.from({ calendar: "gregory", monthCode: "M10", day: 26 })`; options `{ calendar: "gregory", dateStyle: "short", timeStyle: "short" }`)

| Call | Node (polyfill 0.5.1) | Chromium 153 native | WebKit 26.6 native | Specification |
| ---- | --------------------- | ------------------- | ------------------ | ------------- |
| `ym.toLocaleString("en-US", options)` | `10/26` | `TypeError` | `TypeError` | `TypeError` |
| `md.toLocaleString("en-US", options)` | `10/26` | `TypeError` | `TypeError` | `TypeError` |
| the same polyfill in Chromium and WebKit | `10/26` | `10/26` | `10/26` | `TypeError` |

### Effect on GMT

None. `formatYearMonth` and `formatMonthDay` format epoch milliseconds through Intl and return `""` for a `timeStyle` themselves (`plainYearMonthFormatOptions` and `plainMonthDayFormatOptions` return `null`). AA stays here as a record for the owner to file.
