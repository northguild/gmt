# CORE-112 — Core: Some languages' date patterns crash Node and print the wrong year

**Scope:** GMT never makes the `formatToParts` or `formatRangeToParts` call that stops V8 on a
CLDR pattern with `Y`, and prints the calendar year where such a pattern prints the year a week
belongs to. It also prints the year the specifications give in four more cases the range check
found (D25 to D28), range text that keeps every field (D29) and the islamic calendars the caller
asked for (D30). Adds no library function. Lands in #523 with DOX-G9 (#522). Tracked as #524. The
defect is
[js-temporal-polyfill-bugs.md § AF](../js-temporal-polyfill-bugs.md#af-some-languages-date-patterns-print-the-week-of-year-year-the-wrong-year-everywhere-and-a-v8-crash-in-formattoparts-engine-and-cldr).

## Gap

Some CLDR 48 date patterns use `Y` (UTS #35 Part 4 § 8: the year of the week-of-year) where `y`,
the calendar year, is meant: ak, de-CH, gd, gl, kok, ksh, my, sc and te. CLDR 49 adds de with its
regional variants, kek, ki and pt. ECMA-402 FormatDateTimePattern prints the calendar year.

1. **Crash (V8, D23).** V8 without commit `0426b0d1045d` aborts in `formatToParts` and
   `formatRangeToParts` on a `Y` field: exit 133, no exception (nodejs/node#67076). Every Node
   from 22.22.2 to 26.13.0 has it. On `main` (`c7caa75d`) these abort Node 26.12.1:
   `formatZonedRange` with `my-u-ca-buddhist` and `timeZoneName: "long"`, through the D16
   carrier's `formatRangeToParts`; and `formatCalendar` with `gl-u-ca-hebrew`,
   `gl-u-ca-buddhist` or `gl-u-ca-roc`, through `joinDateTimeConnector`'s `dateStyle: "full"`
   parts.
2. **Wrong year (CLDR, D24).** Every engine prints the week-year: gd `Dùbh 2025` for
   2024-12-30, te-u-ca-buddhist `జులై 2026` for 2026-07-01 (2569), gl-u-ca-hebrew `dateStyle:
   "full"` 5786 for 1 Tishri 5787. [CLDR-19873](https://unicode-org.atlassian.net/browse/CLDR-19873)
   (not ours) reports gl and kek.
3. **Other wrong years (D25 to D28).** Every engine prints a Japanese era for japanese dates before
   1873-01-01, where Intl era/monthCode gives the Gregorian era; V8 prints a negative year for islamic
   dates before the Hijra; `ja` japanese `year: "2-digit"` prints `令和6年` for `令和06年`; and chinese
   and dangi pad the related year to two digits. [Decisions](#decisions) gives each one's rule; the
   bug doc has the evidence as § AG.
4. **Broken range text (D29).** Some languages' CLDR interval patterns drop or repeat a field, so
   `formatRange` loses an era, a day period or a date, or prints a field twice. GMT checks each
   formatter's ranges once and, where a range is broken, prints the two dates joined by the
   fallback pattern (UTS #35 Part 4, interval formats).
5. **Islamic calendar resolution (D30).** V8 keeps `islamic` and `islamic-rgsa` as given and prints
   ICU's astronomical calendar. Intl era/monthCode resolves `islamic` to `islamic-tbla` and
   `islamic-rgsa` to the locale's default calendar, so GMT rebuilds those formatters with the
   calendar the proposal gives.

## Scope of the fix

- One isolated module per defect class decides, behaviourally, whether a formatter shows the
  defect. A formatter that passes is returned unchanged. A failing formatter is wrapped, and the
  wrapper prints the value the specifications give.
- Every repair is dormant behind its own probe: on an engine that has no such defect, none of the
  repair code runs. Each has a canary group (D23 to D30, `temporalCompat/repros.ts`,
  `rangeFieldRepros.ts` and `probeRepros.ts`) and is retired by the compat check
  (`scripts/lib/workarounds.mjs`) when every engine passes it.
- GMT owns no CLDR or calendar data: every replacement text comes from the engine's own formatters.
- Files: `internal/weekYearGuard.ts`, `weekYearSynth.ts`, `weekYearText.ts`, `weekYearRange.ts`,
  `repairRangeText.ts`, `yearPrinting.ts`, `yearPrintingRange.ts`, `rangeFields.ts`; the
  `construct` hook in `internal/formatterCache.ts`.

## Decisions

### Expected values

- **The expected year is the ECMA-402 one, never ICU's.** It is the calendar year (Temporal
  `eraYear` when the pattern has an era, else `year`): `numeric` unpadded and ungrouped, `2-digit`
  the last two digits zero-padded, in the formatter's numbering system, with part type `year`.
  ECMA-402 outranks CLDR in [The Standards](../../apps/dox/src/content/docs/guides/concepts/standards.mdx#when-sources-disagree).
  So `gl-u-ca-roc` `dateStyle: "full"` prints `115`, not `0115`. Tests derive the expected year from
  Temporal and never assert the native wrong text.
- **Only the year changes.** Every other CLDR choice stays, even a wrong one (de-CH prints
  `12.30.2025`, month and day swapped; GMT replaces the year only).
- **No engine sniffing in the library.** `process.versions.v8` is read only inside the canary.

### D23 and D24: the week-year (`Y`) patterns

- **D23 (V8 abort).** `formatToParts` and `formatRangeToParts` abort V8 on a `Y` field (nodejs/node#67076, V8
  `0426b0d1045d`). GMT never makes a parts call on a formatter that can hold `Y`. Retired when
  every V8 the check reads passes; deleting `weekYearSynth.ts` and the guard's crash step is all it takes.
- **D24 (CLDR data).** The pattern prints the week-year where the calendar year is meant. The guard
  decides per formatter from `format` calls only, caches the verdict by resolved locale, calendar,
  numbering system and the zone-free options (about 0.18 ms once per year-printing key), and
  prints the calendar year. Retiring D24 retires D23.
- **Crash signal.** On an unfixed V8, a component-options `year` request whose `resolvedOptions().year`
  is `undefined` (calendar not chinese or dangi) is a `Y` pattern. It is exact and cheap, and the
  canary confirms it in a child process.
- **Single formats.** Native parts with the year patched when the crash signal is off and the options
  are component-based; otherwise parts are synthesised from `format` text. Synthesis tie-breaks
  reject an ambiguous date and take the next one, because a type chosen on a tie would be a guess.
- **No parts call can reach a `Y` range pattern.** A range pattern is not visible through
  `resolvedOptions`, and some aborting range formatters never print a wrong year, so no text test can
  find them. `formatZonedRange`'s D16 repair works on the range string (`repairRangeText`): hits of
  the carrier's zone names are replaced by the wanted names, the start's first and the end's second
  when both are equal; a name that cannot be attributed returns `""`. D17's parts merge stays only
  where its gate is on (SpiderMonkey); no aborting V8 turns it on.
- **Range year repair** (`weekYearRange.ts`) runs lazily on a formatter's first range call and
  rewrites only the digit runs that move as a year and hold a whole week-year value.
- **Source rule.** `new Intl.DateTimeFormat(` appears only in `internal/formatterCache.ts` (and the
  probes); `formatRangeToParts(` only in the D17 branch and the probes; `weekYearGuard` is imported
  only by `formatterCache.ts`. A source test pins each.
- **Weekly sweep.** `scripts/canary/weekYear.mjs` reads the locale list from the `cldr-dates-full`
  package for the engine's CLDR version (fetched with `npm pack` at run time, never shipped), checks
  every locale and calendar in process, and runs native parts in child processes to find a guard
  false negative. It runs in `cldr-sweep-weekly.yml` on Node 22, 24 and 26.

### D25 to D28: other wrong years

- **D25, japanese before 1873.** Intl era/monthCode Table 2 (as amended by
  tc39/proposal-intl-era-monthcode#86): up to and including 1872-12-31 the `japanese` calendar uses
  Gregorian eras. A date before 1873-01-01 is formatted by the same locale and options with
  `calendar: "gregory"`. A range with both dates before it is the Gregorian twin's range; a range
  that crosses it prints each date in its own era, joined as D29's fallback does.
- **D26, islamic before the Hijra.** V8 prints a negative AH year and has no BH era name, so no repair is
  possible without GMT data. On an engine with the defect, a pre-Hijra date in any `islamic*`
  calendar formats to the house empty value, and a range with either end before the Hijra is
  empty. The Hijra is the epoch of the formatter's calendar after D30: `islamic-civil` 0622-07-19,
  `islamic-tbla` 0622-07-18, `islamic-umalqura` that of `islamic-civil` outside 1300 to 1600 AH.
  Indian and persian at ISO year -1 are right (one era, signed era year).
- **D27, `ja` japanese `year: "2-digit"`.** `令和06年` is the ECMA-402 value, but ICU's `jpanyear`
  ignores the minimum digit count and the numbering system. The repair prints the era year with
  the engine's `NumberFormat` in the formatter's numbering system, padded to two digits when the
  formatter resolves `2-digit`. `ja` keeps 元年 for year 1 in both styles (CLDR data and Japanese
  convention) and pads every other year. The result is never mixed digits.
- **D28, chinese and dangi `2-digit`.** ECMA-402 prints `relatedYear` at full width; engines pad to two
  digits. Only the padding is repaired, with the engine's `NumberFormat` of the signed related year.
  `weekYearRange.ts` follows the repaired width.
- **When an engine ships a year-style option** (tc39/proposal-intl-eradisplay#10), the D25 and D26
  repairs must pass it through and treat a signed year the caller asked for as correct.

### D29: range text that drops, repeats or garbles a field

- **Rule.** Follow ECMA-402 PartitionDateTimeRangePattern step by step and change only the broken step. A range
  whose printed fields are all equal is the start's single `format`. A range whose largest differing
  field has a sound pattern is the engine's `formatRange`. Only a range whose largest differing
  field has a broken pattern prints the `[[Default]]` fallback: `P + format(start) + J + format(end) + S`,
  where `P{0}J{1}S` is the locale's interval fallback (UTS #35 `intervalFormatFallback`).
- **No data owned.** P, J and S are read from a helper formatter with the same locale, calendar and
  numbering system over a two-day range that the engine prints as a fallback.
- **Retiring D29 may change text.** CLDR may fix a broken pattern by rewriting it, and a fixed engine
  then prints the rewritten range. It is the only workaround that may change output on removal.
- **Detector** (`rangeFields.ts`): `format` and `formatRange` only, on a UTC clone. It compares fixed
  probe ranges with the two single texts: largest difference year, month, day, day period, hour,
  minute, a second year and day pair, an era pair, and a field-order check (each date's fields stay on
  its own side of the joiner). The verdict is lazy, cached by the D24 key plus hour cycle, and runs
  once per pattern.
- **Causes covered:** chinese and dangi years dropping `relatedYear`; the `B` day period dropped or
  printed once; the long day period printed short; hebrew end months; malformed CLDR interval
  patterns; ICU taking the `y` pattern when only the era differs; the `ja` `hm` pattern ignoring
  `hourCycle: "h12"`; run-together fields; fields on the wrong side of the dash; wrong era text.
- **Gate.** Over the whole sweep on the supported Nodes: no false negative against a
  `formatRangeToParts` oracle run in child processes; every flag the oracle does not confirm is a
  run-together text defect pinned by a test row.
- **Composition.** D29 applies in `formatRange` and every range function that prints through it, composed
  with D24's range year repair and D25 to D28. A repaired range is a string, so `repairRangeParts`
  is never passed parts; a test pins this.
- **Weekly sweep.** `scripts/canary/rangeFields.mjs` runs the detector against the parts oracle on
  every locale, calendar and option set, and fails on a false negative or an unexplained flag. The
  workflow lists in the job summary the locales that newly break and those that are fixed.

### D30: `islamic` and `islamic-rgsa`

- Intl era/monthCode resolves `islamic` to `islamic-tbla`, and `islamic-rgsa` is not an available
  calendar, so the locale's default calendar applies. V8 keeps both as given and prints ICU's
  astronomical calendar. `formatterCache`'s `construct` runs this repair first: it rebuilds `islamic`
  with `calendar: "islamic-tbla"`, and `islamic-rgsa` with the `ca` keyword removed and no `calendar`
  option. `formatYearMonth` and `formatMonthDay` then read back the calendar the specification gives.

### Where the evidence lives

- Defects and measured engines: [js-temporal-polyfill-bugs.md § AF and § AG](../js-temporal-polyfill-bugs.md#af-some-languages-date-patterns-print-the-week-of-year-year-the-wrong-year-everywhere-and-a-v8-crash-in-formattoparts-engine-and-cldr).
- Probes and repros: `packages/gmt/src/internal/temporalCompat/probeRepros.ts`, `repros.ts`
  (`CanaryDefectId`, D23 to D30) and `rangeFieldRepros.ts`; removal steps in that folder's README
  and `scripts/lib/workarounds.mjs`.
- Upstream filings (ICU-23327, ICU-23619 to 23625, CLDR-19873, 19912, 19913, Chromium 585635918,
  nodejs/node#67076, tc39/ecma402#1116) are in `apps/dox/src/data/upstream-filings.json`, each
  joined to its guard by `gmtGuard`.
- Weekly sweeps: `scripts/canary/weekYear.mjs`, `scripts/canary/rangeFields.mjs` and
  `.github/workflows/cldr-sweep-weekly.yml`.
