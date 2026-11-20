# Phase 1 — D33 repros: known Chinese and Dangi answers

Read with [index.md](index.md) and [gate.md](gate.md). The repros never gate shipped code (D33 has
no probe); they are canary-only and say when D33 can be retired. They live in
`internal/temporalCompat/repros.ts`, which no shipped module imports.

## Two groups, because the refusal guards two sources

D33 refuses **formats**, and a format's text comes from the host's `Intl.DateTimeFormat`, whatever
the Temporal dependency does. D33 also keeps `chinese` and `dangi` out of `CalendarSystem`, whose
field answers come from the dependency. Retirement needs both right on every engine, so the group
has two kinds of repro:

- **fields** — the dependency's answer: `readFields(iso, calendar)` (ISO to fields) and
  `Temporal.PlainDate.from({calendar, year, monthCode, day}, {overflow: "reject"})` (fields to ISO),
  through the `../temporal` seam.
- **text** — the host's answer: `formatToParts` of a UTC-noon instant with
  `{year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC"}` in `en-u-ca-<calendar>`,
  returning `relatedYear|day` (the `year` part when no `relatedYear` is printed). Month text is not
  compared: ICU 78 prints `6bis` and `Mo12` where older ICU prints `6` and `12`, and the proposal
  defines no month text. The day and the related year are enough to tell a New Year one day off.

## Code shape

- Export `readFields` from `probeRepros.ts` (body unchanged; today it is module-private at line 52).
- `repros.ts`: add `"D33"` to `CanaryDefectId` and extend its JSDoc: "D33 (`lunisolarRefusal.ts`):
  hosts print different Chinese and Dangi dates, and the dependency reads them from the host."
- Add `const d33Repros: readonly Repro[]` (fields rows, then text rows, built from two tables with
  `.map`, like `rangeFieldRepros`) and spread `...d33Repros` into `repros` after `...rangeFieldRepros`.
- Every row: `defect: "D33"`, `calendar` = `"chinese"` or `"dangi"` (not `iso8601`: the calendar is
  the subject, and the swap check filters on it). A thrown error is recorded by the runner as
  `ERR <message>` and fails the row; that is the expected state today.
- JSDoc above `d33Repros` names the sources below and says the values are the proposal's (PMO data
  for `chinese`, KASI for `dangi`, §1.1 Table 1).

## Fields rows (`expected` is `year|monthCode|day`)

| name | calendar | input | expected | why this row |
| --- | --- | --- | --- | --- |
| `chineseNewYear2027Eve` | chinese | `2027-02-05` | `2026\|M12\|29` | M12 of 2026 has 29 days |
| `chineseNewYear2027` | chinese | `2027-02-06` | `2027\|M01\|1` | ICU4C gives `2026\|M12\|30`; new moon 23:56 Beijing time |
| `chineseLastDay2029` | chinese | `2030-02-02` | `2029\|M12\|30` | ICU4C gives `2030\|M01\|1` |
| `chineseNewYear2030` | chinese | `2030-02-03` | `2030\|M01\|1` | |
| `chineseNinthMonthEnd2018` | chinese | `2018-11-07` | `2018\|M09\|30` | ICU4C gives `2018\|M10\|1` (mid-year, not a New Year) |
| `chineseTenthMonth2018` | chinese | `2018-11-08` | `2018\|M10\|1` | |
| `chineseLeapSixth2025` | chinese | `2025-07-25` | `2025\|M06L\|1` | leap month |
| `chineseSixthEnd2025` | chinese | `2025-07-24` | `2025\|M06\|30` | day before the leap month |
| `chineseSeventh2025` | chinese | `2025-08-23` | `2025\|M07\|1` | leap month M06L has 29 days |
| `chineseLeapSecond2023` | chinese | `2023-03-22` | `2023\|M02L\|1` | leap month |
| `chineseThird2023` | chinese | `2023-04-20` | `2023\|M03\|1` | M02L has 29 days (Dangi's has 30) |
| `dangiSecond2017` | dangi | `2017-02-26` | `2017\|M02\|1` | ICU4C gives `2017\|M01\|30` |
| `dangiLastDay2026` | dangi | `2027-02-06` | `2026\|M12\|30` | Dangi's New Year is a day after Chinese |
| `dangiNewYear2027` | dangi | `2027-02-07` | `2027\|M01\|1` | |
| `dangiNewYear2030` | dangi | `2030-02-03` | `2030\|M01\|1` | |
| `dangiLeapSixth2025` | dangi | `2025-07-25` | `2025\|M06L\|1` | leap month |
| `dangiLeapSecond2023` | dangi | `2023-03-22` | `2023\|M02L\|1` | leap month |
| `dangiThird2023` | dangi | `2023-04-20` | `2023\|M03\|1` | M02L has 30 days |

Reverse rows (`expected` is the ISO date; `run` is `from(…).withCalendar("iso8601").toString()`):

| name | calendar | fields | expected |
| --- | --- | --- | --- |
| `chineseFrom2027M01` | chinese | 2027 `M01` 1 | `2027-02-06` |
| `chineseFrom2030M01` | chinese | 2030 `M01` 1 | `2030-02-03` |
| `chineseFrom2025M06L` | chinese | 2025 `M06L` 1 | `2025-07-25` |
| `chineseFrom2023M02L` | chinese | 2023 `M02L` 1 | `2023-03-22` |
| `dangiFrom2027M01` | dangi | 2027 `M01` 1 | `2027-02-07` |
| `dangiFrom2030M01` | dangi | 2030 `M01` 1 | `2030-02-03` |
| `dangiFrom2025M06L` | dangi | 2025 `M06L` 1 | `2025-07-25` |
| `dangiFrom2023M02L` | dangi | 2023 `M02L` 1 | `2023-03-22` |

## Text rows (`expected` is `relatedYear|day`)

| name | calendar | ISO date (UTC noon) | expected | ICU4C 78.3 today |
| --- | --- | --- | --- | --- |
| `chineseNewYear2027Text` | chinese | `2027-02-06` | `2027\|1` | `2026\|30` |
| `chineseLastDay2029Text` | chinese | `2030-02-02` | `2029\|30` | `2030\|1` |
| `chineseNewYear2030Text` | chinese | `2030-02-03` | `2030\|1` | `2030\|2` |
| `chineseNinthMonthEnd2018Text` | chinese | `2018-11-07` | `2018\|30` | `2018\|1` |
| `dangiSecond2017Text` | dangi | `2017-02-26` | `2017\|1` | `2017\|30` |
| `dangiNewYear2027Text` | dangi | `2027-02-07` | `2027\|1` | `2027\|1` (passes) |

Read at UTC noon: the PMO and KASI tables are for Beijing (UTC+8) and Seoul (UTC+9) days, and noon
UTC falls inside the same civil day in both, so the row tests the calendar, not a zone edge.

## Expected states today

| Engine | fields rows | text rows | verdict |
| --- | --- | --- | --- |
| Node 22/24/26 with `@js-temporal/polyfill` 0.5.1 (ICU4C 78.3) | `ERR RangeError: Unexpected leap month suffix: Mo12` (or `Mo6bis`, `Mo1`) | five of six fail (table above) | STILL NEEDED |
| Chromium 153 | `ERR …` (same polyfill) | same as Node | STILL NEEDED |
| WebKit 26.6 (Linux, macOS) | `ERR …` (the polyfill throws on every host) | `2027\|1` and `2029\|30` pass; the rest are read on the weekly run | STILL NEEDED |
| Firefox | weekly run only (Playwright Firefox does not start locally) | weekly run | STILL NEEDED (fields rows) |
| `temporal-polyfill` 1.0.8 (swap check) | host `Intl` values, ICU4C on Node | as the host | STILL NEEDED ([canary.md](canary.md)) |

`tdd-dev` confirms the ICU4C column on Node 24 before writing it into any test, and every
fields value against native Temporal: `fnm exec --using=26 -- node -e '…Temporal.PlainDate.from(…).withCalendar(…)'`.
A row that disagrees with HKO or KASI stops the work and is reported, never adjusted.

## Sources (cite in the JSDoc; never a peer library)

- Rule: [Intl era/monthCode](https://tc39.es/proposal-intl-era-monthcode/) §1.1 Table 1 (chinese:
  Purple Mountain Observatory data; dangi: Korea Astronomy and Space Science Institute data),
  Table 3 (leap month codes `M01L`–`M12L`).
- Chinese values: Hong Kong Observatory, Gregorian–Lunar Calendar Conversion Table,
  `https://www.hko.gov.hk/en/gts/time/calendar/text/files/T<year>e.txt` for 2018, 2023, 2025, 2027,
  2029 and 2030 (computed to GB/T 33661-2017).
- Dangi values: KASI lunar-solar conversion service, `https://astro.kasi.re.kr/life/solc` (2017-02-26
  is 음력 2017-02-01; 2027-02-07 is 음력 2027-01-01).
- Cross-check: native Temporal on Node 26.13.1 (V8 with ICU4X), every row above. Matched in full.
