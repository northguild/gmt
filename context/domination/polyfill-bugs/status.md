# Polyfill and engine defects — Waiting on a release, and the filings

Part of [js-temporal-polyfill-bugs.md](../js-temporal-polyfill-bugs.md), which explains the
format and indexes every section.

## Waiting on a release

The one place to check. The latest `@js-temporal/polyfill` release is 0.5.1 and the latest ICU4C release is 78.3;
nothing below is released. "Nothing" in the last column means only a release is missing.

| Workaround | Fix on upstream `main` | What else it waits for |
| ---------- | ---------------------- | ---------------------- |
| `zoned.A`: wall clock to exact time at the range limits (§ A) | js `05ce7a3` and `95237e0` | Nothing |
| `D1`: non-ISO fields and `until` near the range limits (§ C) | None on js `main`. tc39 `a41eb67` + `af0cb4b`; filed as js #369 (closed, routed to tc39) | The port, plus the `until` month-loop fix filed as tc39 #3327. `D1.fieldsMin hebrew` also needs `D3` |
| `D2`: buddhist dates before 1582 (§ C) | js `2bb6ba1` | Nothing |
| `D3`: Hebrew leap years for negative years (§ C) | js `57d7734` (PR #361) | `D4`: the two leave together |
| `D4`: Hebrew years 0 and earlier, one day off (§ C) | ICU `5267bb5778` (ICU-23007). Not a polyfill fix | An ICU4C release with that commit, and a Node release that bundles it as GMT's `engines.node` floor |
| `D5`: Indian calendar before ISO year 1 (§ C) | js `8de299a` (PR #361) | Nothing |
| `D6`: non-ISO `until` re-constrains the day (§ C) | js `10aeb98` | `D7`. `main` since `853fc8b` also has tc39 #3327 problem 1, which the `D6.cachedDay` probes catch |
| `D7`: Hebrew `until` by years throws (§ C) | js `1c64f14` (PR #361) | js `main` took all of tc39 `196a3191` in `853fc8b`, so it also carries tc39 #3327 problem 1; the `D7.leapMonthEnd` row gives `P12M29D` on `c55b211` (read, probe not run) |
| `D8`: Meiji era start (§ C) | js `2bb6ba1` fixes two of three probes | tc39 `977d11e0` + `993e6322`, not on `main` (js #368, closed, routed to tc39) |
| `zoned.B`, `zoned.D`, `zoned.E`: no fix on `main` (§ B, D, E) | None. Filed as js #367 (D), #371 (B), #372 (E) and tc39 #3328 (B), #3330 (E) | The in-order catch-up and a release |
| `D11`: calendar nudge window is never retried (§ H) | js `5af905f` (PR #361) | Nothing |
| `D12`: a seconds offset matched by minutes (§ I) | js `23d1275` | Nothing |
| `D13`: the transition search skips or stalls (§ K) | js `a79c6a1`, in part | A further fix, filed as tc39 #3332: `main` still stalls for `Africa/El_Aaiun` in 1976. Retires only when every `D13` probe passes |
| `D14`: `ZonedDateTime#round` to `day` when a date starts twice (§ N) | tc39 `59a51ea9d4` | The js-temporal catch-up and a release |
| `D15`: a `Z` string read by wall clock under `offset: "ignore"` (§ O) | None on either `main`. Filed as tc39 #3337 | A fix, the catch-up and a release |
| `D16`: `formatRange` cuts long zone names to short and drops offset names (V8, JSC; ICU-20548) | Not a polyfill fix. ICU-20548 is open | An ICU release that keeps `long`, `longGeneric`, `shortOffset` and `longOffset` in range output in every engine GMT supports; the `D16` probes must pass on the `engines.node` floor |
| `D17`: Firefox `formatRange` prints AM/PM for a day period with a zone name (§ Q) | Not a polyfill fix. Bugzilla 2085525 | A Firefox release that prints the flexible day period; the weekly `temporal-compat-firefox` check reports it |
| `D18`: Islamic dates before the Hijra read as positive years in WebKit (§ R) | None. tc39 #3338 and WebKit 331724 | A js-temporal release that reads WebKit's Islamic eras |
| `D19`: `ZonedDateTime#equals` false for two identifiers of one zone (§ U) | None. tc39 #3301 (someone else's report, with our comment) | A js-temporal release that finds a primary identifier without `resolvedOptions`; scoped to WebKit |
| `D20`: upper-case `iso8601` annotation (§ V) | tc39 `385b479bf8` | Nothing: GMT no longer needs the workaround, the probe is removed |
| `D21`: `Temporal.Now` a millisecond early after a pre-1970 reading (§ AB) | None. tc39 #3335 | A fix, the catch-up and a release |
| `D22`: a length in days or larger measured from the wrong pass of a repeated hour (§ AC) | js `3c403686d39` | tc39 #3319 in the same release, or `P7D` with `largestUnit: "week"` regresses to `P1W1D`. A release that still strips the Asserts of tc39 #3336, #3311 and #3310 keeps GMT's gate |
| `D23`: V8 aborts in `formatToParts` on a `Y` pattern (§ AF) | V8 `0426b0d1045d` (Chromium 158). nodejs/node#67076 | A Node release on every supported line with that commit as GMT's `engines.node` floor |
| `D24`: some languages print the week-year (§ AF) | None. CLDR-19873 | A CLDR and ICU release that prints `y`, and engines that ship it |
| `D25`: japanese eras before 1873-01-01 (§ AG) | ICU-23341, for ICU 79.1 | An ICU release with it and with the Gregorian era for Meiji 1 to 5 (ICU-23619) |
| `D26`: islamic year before the Hijra (§ AG) | None. ICU-23327 | An ICU release that names the `bh` era |
| `D27`: `ja` japanese `year: "2-digit"` and numbering (§ AG) | None. ICU-23620 | An ICU release whose `jpanyear` keeps the digit count and numbering system |
| `D28`: chinese and dangi related year under `year: "2-digit"` (§ AG) | None. ICU-23621 | Engines that print `relatedYear` at full width |
| `D29`: a range drops, repeats or garbles a field (§ AG) | None for most causes. CLDR-19912, CLDR-19913, ICU-23622 to ICU-23625 | CLDR and ICU fixes for each cause and engines that ship them |
| `D30`: `islamic` and `islamic-rgsa` resolve as written (§ AG) | None. Chromium 585635918 | Engines that resolve `islamic` to `islamic-tbla` (WebKit 26.6 already does) |

To check, without cloning anything:

```sh
# Is there a release newer than 0.5.1?
npm view @js-temporal/polyfill version

# Is a fix in that release? "behind" or "identical" means the tag contains the commit.
gh api repos/js-temporal/temporal-polyfill/compare/v<release>...<commit> --jq .status

# D4: is the ICU fix in an ICU4C release?
gh api repos/unicode-org/icu/compare/release-<version>...5267bb5778 --jq .status
```

To confirm a removal, bump `@js-temporal/polyfill` in `packages/gmt/package.json`, install, and run `pnpm compat`. A
group whose probes all pass prints `REMOVABLE` with its removal steps, unless it declares a guard, which prints
`GUARD` until its package moves past the guarded version. Follow the steps, then run `pnpm compat:snapshot`. For
`D4`, run `pnpm compat` on the Node release that bundles the ICU fix. A group that prints `STILL NEEDED` stays,
whatever this table says: the canary decides, not the commit list. A trigger written as one commit is not enough on
its own for D1, D6, D7 and D8; the table lists what each also needs.

## Filed

The full record (state, summary, GMT guard, dates) is `apps/dox/src/data/upstream-filings.json`, which
`node scripts/upstream.mjs sync` keeps current from the trackers. This table lists each filing once, with the section
it belongs to. A closed filing stays listed as credit. js #367 to #372 were closed unmerged and none was rejected: the
maintainer asked for ports in order and for new fixes in proposal-temporal first. js #361 is the maintainer's own PR
(merged 2026-09-21); our comment on it, and our comment on tc39 #3301, are tracked because their state retires `D11`
and `D19`.

| Tracker | Number | § | State |
| ------- | ------ | - | ----- |
| js PR | [#361](https://github.com/js-temporal/temporal-polyfill/pull/361) (comment) | H | merged |
| js PR | [#367](https://github.com/js-temporal/temporal-polyfill/pull/367) | D | closed, routed to tc39 |
| js PR | [#368](https://github.com/js-temporal/temporal-polyfill/pull/368) | C (D8) | closed, routed to tc39 |
| js PR | [#369](https://github.com/js-temporal/temporal-polyfill/pull/369) | C (D1) | closed, routed to tc39 |
| js PR | [#370](https://github.com/js-temporal/temporal-polyfill/pull/370) | C (D1b) | closed, routed to tc39 |
| js PR | [#371](https://github.com/js-temporal/temporal-polyfill/pull/371) | B | closed, routed to tc39 |
| js PR | [#372](https://github.com/js-temporal/temporal-polyfill/pull/372) | E | closed, routed to tc39 |
| js issue | [#373](https://github.com/js-temporal/temporal-polyfill/issues/373) | A | open: one release after the rebase |
| tc39 | [#3301](https://github.com/tc39/proposal-temporal/issues/3301) (comment) | U | open |
| tc39 | [#3327](https://github.com/tc39/proposal-temporal/issues/3327) | C (D1b) | open |
| tc39 | [#3328](https://github.com/tc39/proposal-temporal/issues/3328) | B | open |
| tc39 | [#3329](https://github.com/tc39/proposal-temporal/issues/3329) | F | open |
| tc39 | [#3330](https://github.com/tc39/proposal-temporal/issues/3330) | E | open |
| tc39 | [#3331](https://github.com/tc39/proposal-temporal/issues/3331) | J | closed as answered |
| tc39 | [#3332](https://github.com/tc39/proposal-temporal/issues/3332) | K | open |
| tc39 | [#3335](https://github.com/tc39/proposal-temporal/issues/3335) | AB | open |
| tc39 | [#3336](https://github.com/tc39/proposal-temporal/issues/3336) | AC | open |
| tc39 | comments on [#3311](https://github.com/tc39/proposal-temporal/issues/3311) and [#3310](https://github.com/tc39/proposal-temporal/issues/3310) | AC | open |
| tc39 | [#3337](https://github.com/tc39/proposal-temporal/issues/3337) | O | open |
| tc39 | [#3338](https://github.com/tc39/proposal-temporal/issues/3338) | R | open |
| tc39 | [#3339](https://github.com/tc39/proposal-temporal/issues/3339) | X | open |
| tc39/ecma402 | [#1116](https://github.com/tc39/ecma402/issues/1116) | AG | open |
| fc | [#119](https://github.com/fullcalendar/temporal-polyfill/issues/119), [#120](https://github.com/fullcalendar/temporal-polyfill/issues/120), [#121](https://github.com/fullcalendar/temporal-polyfill/issues/121), [#125](https://github.com/fullcalendar/temporal-polyfill/issues/125) | swap check | closed, fixed in 1.0.7 and 1.0.8 |
| fc | [#126](https://github.com/fullcalendar/temporal-polyfill/issues/126) | E | closed, fixed in 1.0.8 |
| fc | [#127](https://github.com/fullcalendar/temporal-polyfill/issues/127), PR [#131](https://github.com/fullcalendar/temporal-polyfill/pull/131) | swap check (Persian) | open |
| fc | [#128](https://github.com/fullcalendar/temporal-polyfill/issues/128), PR [#132](https://github.com/fullcalendar/temporal-polyfill/pull/132) | swap check (Chinese, Dangi) | open |
| nodejs/node | [#67076](https://github.com/nodejs/node/issues/67076) | AF (D23) | open |
| nodejs/node | [#67457](https://github.com/nodejs/node/issues/67457) | AD | open |
| nodejs/node | [#67484](https://github.com/nodejs/node/issues/67484) | X, Z | open |
| Chromium | [553245554](https://issues.chromium.org/issues/553245554) (comment) | X | open |
| Chromium | [585635918](https://issues.chromium.org/issues/585635918) | AG (D30) | open |
| WebKit | [330688](https://bugs.webkit.org/show_bug.cgi?id=330688) | AE (POSIX zone ids) | open |
| WebKit | [331724](https://bugs.webkit.org/show_bug.cgi?id=331724) | R | open |
| WebKit | [331725](https://bugs.webkit.org/show_bug.cgi?id=331725) | S | open |
| WebKit | [331726](https://bugs.webkit.org/show_bug.cgi?id=331726) | T | open |
| Bugzilla | [2085525](https://bugzilla.mozilla.org/show_bug.cgi?id=2085525) | Q | open |
| ICU | [ICU-23609](https://unicode-org.atlassian.net/browse/ICU-23609) | AE | open |
| ICU | [ICU-23619](https://unicode-org.atlassian.net/browse/ICU-23619), [23620](https://unicode-org.atlassian.net/browse/ICU-23620), [23621](https://unicode-org.atlassian.net/browse/ICU-23621) | AG (D25, D27, D28) | open |
| ICU | [ICU-23622](https://unicode-org.atlassian.net/browse/ICU-23622), [23623](https://unicode-org.atlassian.net/browse/ICU-23623), [23624](https://unicode-org.atlassian.net/browse/ICU-23624), [23625](https://unicode-org.atlassian.net/browse/ICU-23625) | AG (D29) | open |
| ICU | [ICU-23626](https://unicode-org.atlassian.net/browse/ICU-23626), [23627](https://unicode-org.atlassian.net/browse/ICU-23627) | S, T | open |
| CLDR | [CLDR-19873](https://unicode-org.atlassian.net/browse/CLDR-19873) (comment), [19912](https://unicode-org.atlassian.net/browse/CLDR-19912), [19913](https://unicode-org.atlassian.net/browse/CLDR-19913) | AF (D24), AG (D29) | open |

Open issues the polyfill fixes close when its release lands: js #341 (§ A, `2bb6ba1`), js #347 (§ A, `3c40368`) and
js #360 (§ C, `16dff41` in #361).
