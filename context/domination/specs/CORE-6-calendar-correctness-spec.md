# CORE-6 (Q2) — Non-ISO calendar correctness: scope, design and upstream fixes

Plan item Q2 of CORE-6 (owner decision: fix every non-ISO calendar defect in GMT on this branch).
This spec is planning only. `tdd-dev` implements it slice by slice (§7). Items in §9 need an
owner decision before the slice that depends on them starts.

**Environments probed (read-only, 2026-09-14).**

- **Polyfill:** `@js-temporal/polyfill@0.5.1`, the installed floor and the latest release.
- **Node:** 24.21.0, ICU 78.3, CLDR 48.0.
- **Native oracle:** Chromium 152, with native Temporal backed by ICU4X.
- **Polyfill main source:** `js-temporal/temporal-polyfill` at `c8f344c` (2026-05-14). `lib/calendar.ts` was
  byte-compared against the scratchpad copy `polyfill-research/main-src/calendar.ts`.
- **Reference-code history:** `tc39/proposal-temporal` `polyfill/lib/calendar.mjs`.

**Probe artefacts** live in `scratchpad/polyfill-research/q/`. Every number in this spec comes from them.

| File | What it proves |
|---|---|
| `q2-bisect-0.5.1*.txt` | original fields→ISO window bisection |
| `q2-xscan-body.js`, `q2-xscan-node-0.5.1.json`, `q2-xscan-chromium152.json`, `q2-xscan-diff-0.5.1.txt` | **same scan body** run in Node polyfill and Chromium: 421 days in from each edge × 11 calendars × {read, fields→ISO, ±1 month, ±1 year, until months, until years}, plus 2 001 stride samples across the whole range |
| `q2-grid-body.js`, `q2-grid-*.json`, `q2-grid-diff-0.5.1.txt` | month-end `until`/`add` grid at ordinary dates (2023-06-01 … 2024-07-05 × 15 spans × 11 calendars) |
| `q2-arith-scan-0.5.1.txt` | add/until throw sets near both edges |
| `q2-spec-probe*.txt` | spot rows (reads, bags, arithmetic, `relativeTo`) mirrored in Chromium |
| `hebrew-oracle.mjs`, `hebrew-oracle-check-0.5.1.txt` | independent Hebrew arithmetic (Dershowitz–Reingold): no Temporal, no Intl |
| `q2-gmt-public.mjs`, `q2-gmt-rows*.mjs`, `q2-gmt-rows-current.txt` | current public GMT output, loaded from `packages/gmt/dist` through a resolve hook (`loader/`) |
| `icu4c-hebrwcal.cpp`, `js-temporal-c8f344c-calendar.ts`, `spec/intl-era-monthcode-spec.emu` | sources read for root causes |

---

## 0. Authority — what each rule rests on

Order of precedence: spec, then test262, then native engine (Chromium), then independent arithmetic
oracle. The polyfill and GMT code are **never** the source of an expected value.

| Rule | Source |
|---|---|
| Every calendar is proleptic. Reforms are ignored; buddhist has "month numbers, month codes, and days … identical to ISO 8601" | ECMA-402 Intl Era/Month-code proposal, *Calendar types described in CLDR* table (`spec.emu` l.37–55) |
| Non-ISO fields→ISO: `CalendarResolveFields` → `NonISOCalendarDateToISO` → `ISODateWithinLimits` | Temporal `calendar.html` §CalendarDateToISO; Intl proposal §NonISOCalendarDateToISO (l.1242) |
| Non-ISO add | Intl proposal §NonISODateAdd (l.1156), which supersedes Temporal's implementation-defined stub |
| Non-ISO until: `NonISODateSurpasses` loops with an **un-constrained** day | Intl proposal §NonISODateUntil (l.1193), §NonISODateSurpasses (l.1114) |
| Leap month missing in a year: `ConstrainMonthCode`. Hebrew is *skip-forward* (`M05L` → `M06`) | Intl proposal l.636–651, table row l.595–597 |
| Min/max rows per calendar | test262 `intl402/Temporal/PlainDate/from/extreme-dates.js` (quoted in §4.1) |
| End-of-month `until` balancing | test262 `intl402/Temporal/PlainDate/prototype/until/wrapping-at-end-of-month-{ethioaa,hebrew,…}.js` |
| Hebrew arithmetic (tie-breaker when Node ICU4C and Chromium ICU4X disagree) | Dershowitz & Reingold, *Calendrical Calculations*, ch. 8 (`hebrew-oracle.mjs`) |

---

## 1. Scope

### 1.1 Calendars GMT supports and how each reaches Temporal

The list is `CalendarSystem` / `temporalCalendarIds` in `packages/gmt/src/internal/calendarSystemIds.ts`.

| GMT id | Temporal id actually constructed | Notes |
|---|---|---|
| gregorian | `iso8601` | unaffected (ISO arithmetic) |
| hebrew | `hebrew` | |
| islamic-civil | `islamic-civil` | |
| islamic-tabular | `islamic-tbla` | |
| islamic-umalqura | `islamic-umalqura` | |
| japanese | `japanese` | era-tagged string (`;era=`) |
| buddhist | `buddhist` | |
| taiwan | `roc` | |
| persian | `persian` | |
| indian | `indian` | |
| ethiopic, ethiopic-amete-alem, coptic | **`ethioaa` only** | `internal/ethiopicFamilyCalendar.ts` |

**Research claim (3), verified exactly.** GMT never constructs or reads a Temporal date calendared
as `"ethiopic"` or `"coptic"`:
- every read and write goes through `withCalendar("ethioaa")` (`ethiopicFamilyFieldsFromDate`) and
  `PlainDate.from({calendar: "ethioaa"})` (`dateFromEthiopicFamilyFields`);
- `formatZonedInCalendar` and `convertZonedToCalendar` substitute `"ethioaa"`.

`chinese` and `dangi` are not in `CalendarSystem`, and `isCalendarSystem` rejects them. So the
polyfill's "Era … not matched" and "Unexpected leap month suffix" failures are unreachable.

**However, the Ethiopic family is not immune.** It inherits every `ethioaa` arithmetic defect
(D1-arith, D6 below).

### 1.2 Defect catalogue

"Reach" means what a GMT caller can observe today. Windows are counted in ISO days **including the
edge day**. Min edge = `-271821-04-19`, max edge = `+275760-09-13`.

| ID | Defect | Layer | Fixed upstream? |
|---|---|---|---|
| **D1** | fields→ISO (and every internal `calendarToIsoDate` call: add, until, `daysInMonth`, `Duration` rounding) probes outside the legacy `Date` range and throws `Invalid ISO date` | polyfill | proposal-temporal `a41eb67` (2026-01-06) + `af0cb4b` (2026-02-23). **Not on js-temporal main.** |
| **D2** | buddhist computed through ICU4C's Julian/Gregorian hybrid: wrong fields for every date before 1582-10-15 | polyfill 0.5.1 | js-temporal main `2bb6ba1` (port of `28fe786`, `SameMonthDayAsGregorian`). **Unreleased.** |
| **D3** | Hebrew `inLeapYear` uses a JS `%` on negative years: every year ≤ −1 is treated as leap. Result: wrong ordinal `month` / `monthsInYear`, `Missing month` throws, wrong arithmetic | polyfill | proposal-temporal `0df570c` (2025-11-17). **Not on js-temporal main** (`calendar.ts` l.1401). |
| **D4** | Hebrew fields one day off for years ≤ 0 in ICU4C (Node's ICU). The independent oracle and ICU4X (Chromium) agree with each other | ICU4C data/algorithm (environment) | ICU `5267bb5778` (2026-07-13, ICU-23007). Needs a Node release that bundles it. |
| **D5** | Indian throws for every ISO year < 1. The polyfill's "V8 bug 10529" detector compares against `'10/11/-79 Saka'`; ICU 78 prints `Śaka`, so the guard fires although ICU is correct | polyfill | proposal-temporal `314b112` (2025-11-17). **Not on js-temporal main** (l.1722). |
| **D6** | non-ISO `until` re-constrains the day while counting months: Aug 31 → Sep 30 = `P1M` (spec: `P30D`). **Every** non-ISO calendar, at ordinary dates, including japanese/taiwan | polyfill 0.5.1 | proposal-temporal `1f6d6df` → js-temporal main `10aeb98` (l.1219–1222). **Unreleased.** |
| **D7** | non-ISO `until` with `largestUnit: "years"` throws `mixed-sign values not allowed` when the intermediate overshoots (Hebrew leap years; tc39/proposal-temporal#3159) | polyfill | proposal-temporal `0e32ee0` (2025-11-21). **Not on js-temporal main.** |
| **D8** | Era codes pre-date the Intl proposal: japanese `japanese`/`japanese-inverse` (spec `ce`/`bce`), roc `roc-inverse` (spec `broc`), islamic has no eras | polyfill 0.5.1 | js-temporal main `2bb6ba1`. **Unreleased.** |
| **G1** | GMT grammar cannot represent a negative calendar year: `regex/calendar-date.ts` is `(\d{4,6})`, and `calendarDateParts` does `String(year).padStart(4, "0")`. So `convertDateToCalendar` emits strings its own validator rejects | **GMT** | n/a |
| **G2** | GMT's `;era=` grammar is `[a-z]+`, so a polyfill era containing `-` (`japanese-inverse`) is emitted but can never be parsed | **GMT** (surfaced by D8) | n/a |

### 1.3 Scope table — calendar × defect

R = field reads wrong or throwing; W = fields→ISO (GMT parse) wrong or throwing; A = add/subtract;
U = until/diff; Δ = `Duration` total/round/compare with a calendared `relativeTo`.

| Calendar (GMT) | D1 (edges) | D2 | D3 / D4 | D5 | D6 | D7 | D8 / G2 | G1 |
|---|---|---|---|---|---|---|---|---|
| hebrew | W max 6 d (`+275760-09-08…09-13`). A: +1 year for max−383…388 d. U months: every start within 420 d of max; U years: end within 6 d of max. Δ near max | — | **D3** R/W/A/U for years ≤ −1 (ISO before `-003760-09`): wrong ordinal month in 820 of 2 001 strides (257 ordinal-only), W throws in 112 strides, U years throws `Missing month` for min+63…408 d. **D4** R day-off for years ≤ 0 in Node (513 strides, first `-271818-01-13`, last `-004075-03-30`) | — | U (e.g. `2023-06-19`+29 d) | **U** years for spans 365–384 d from a leap-year `M05L` date (e.g. `5784-06-02 → 5785-06-01`) | — | years ≤ −1 unrepresentable |
| buddhist | W max 32 d (`+275760-08-13…`), min 2 d. A: +1 year max−366…397 d. U months near max; U years end within 32 d of max. Δ near max | **R/W/A/U every date < 1582-10-15** (999 strides; min edge reads `-271273-M11-19`, spec `-271278-M04-19`) | — | — | U | — | — | — (years ≥ 1 after D2 fix; pre-1582 values ≥ 544 BE) |
| islamic-civil | W max 9 d, **min 276 d** (`…-271820-01-19`). A: −1 month isolated (min+68/127/186/245), +1 month (min+9/68/127/186), +1 year max−354…362, −1 year min+355…420+. U months near max and near min. Δ near max | — | — | — | U | — | — | years ≤ 0 (ISO before 622-07) |
| islamic-tabular (tbla) | as civil; min 275 d (`…-271820-01-18`); isolated A days shifted by one | — | — | — | U | — | — | same |
| islamic-umalqura | as civil (min 276 d) | — | — | — | U | — | — | same |
| persian | **W min 357 d** (`…-271820-04-09`). A +1 month min+327; −1 month min+386/387; −1 year min+365…420+. U months near both edges; U years end within 8 d of max. Δ near max | — | — | — | U | — | — | years ≤ 0 (ISO before 622-03) |
| indian | U months near max; U years within 8 d of max; Δ near max | — | — | **R/W/A/U every ISO year < 1** (993 strides) | U | — | — | years ≤ 0 (ISO before 0079-03) |
| japanese | none | — (SameMonthDay helper already in 0.5.1) | — | — | U | — | **D8/G2**: `1800-01-01` → `;era=japanese` (non-spec); `-000500-06-15` → `;era=japanese-inverse` (unparseable) | — (eraYear ≥ 1) |
| taiwan (roc) | none | — | — | — | U | — | roc era not in GMT string | **years ≤ −1, i.e. every date before 1911-01-01** (`1000-01-01` → `-911-01-01[u-ca=taiwan]`, unparseable) |
| ethiopic, ethiopic-amete-alem, coptic (via ethioaa) | U months near max (1…420 d), U years within 11 d of max; Δ near max. **R/W clean** at both edges | — | — | — | U: `M11-30 → M13-05` = `P1M` vs spec `P1M5D`; strides where a date is `M11-30`/`M13` (3 samples) | — | — | ethioaa years ≤ 0 (ISO before −5492); coptic years ≤ 0 (ISO before 284-08-29); ethiopic uses eraYear (≥ 1 in both eras? `aa` era eraYear = ethioaa year → negative before −5492) |
| gregorian | unaffected | | | | | | | |

**Read-only calendared accessors near the max throw too** (islamic `.daysInMonth` / `.monthsInYear` for max−0…28 d).
No public GMT function reads them on a calendared value: `getDaysInMonth` and `isLeapYear` gate on
`isValidDate`, which is ISO only. Record it here; the compat module must not call them (§3.3).

### 1.4 Findings that contradict or refine the research

1. **Claim: `calendarToIsoDate` is unfixed on main.** True for *js-temporal* main (`c8f344c`). False
   for the reference implementation: proposal-temporal `a41eb67` "Clamp ISO date to range in
   iterative calendar-to-ISO conversion" fixes it, and `af0cb4b` covers the legacy-Date shift.
   js-temporal has ported proposal-temporal commits only up to the 2025-10-02 batch (its
   2026-04-22 rebase). So the upstream ask is a **port + release**, not a new fix.
2. **Claim: "Hebrew is one day off in the far past" is a polyfill defect.** It is two defects:
   - **D3 (polyfill).** The negative-year leap rule causes wrong `month`/`monthsInYear` and the
     `Missing month` throws.
   - **D4 (ICU4C, not polyfill).** Raw `Intl.DateTimeFormat` in Node prints
     `27 Shevat -268057` for `-271821-11-05`. Chromium and the Reingold oracle both give day 28
     (`hebrew-oracle-check-0.5.1.txt`: 17/17 oracle rows agree with Chromium).
     ICU fixed it in `5267bb5778` (ICU-23007, 2026-07-13).
   - **Range.** Years ≤ 0 in Node, not "near the minimum": the last day-level mismatch sample is
     `-004075-03-30`.
3. **Claim: Indian before 0001 is a deliberate V8 guard.** ICU 78 is correct. The guard's
   detector string is stale (`Saka` vs `Śaka`), which is D5.
4. **Claim: buddhist pre-1582 needs checking against main.** It is already fixed on js-temporal
   main (`BuddhistHelper extends SameMonthDayAsGregorianBaseHelper`, l.2089), but unreleased.
5. **New, larger reach not in the research.**
   - **D6** makes `diffDate`/`diffDateAsDuration`/`intervalLengthDate`/`intervalCount*` wrong at
     ordinary dates for **every** non-ISO calendar, including japanese and taiwan.
   - **D7** makes Hebrew `diffDate(…, "years")` return `null` for ordinary leap-year spans.
6. **New GMT-side defects.**
   - **G1:** taiwan `1000-01-01` and every negative calendar year produce an unparseable string.
   - **G2:** pre-CE japanese does the same through `japanese-inverse`.
7. **Claim: adding `{months: 1}` in Hebrew near the max is broken.** Not in 0.5.1:
   `addDate("279517-09-11[u-ca=hebrew]", {months: 1})` gives the correct
   `"279517-10-11[u-ca=hebrew]"`. It only looks broken because GMT cannot then *parse* that
   result (D1-W). The add defects near the edges are the +1 year and islamic/persian windows in
   §1.3.
8. **Claim: `relativeTo` works.** It does at the spot rows Chromium also passes. But
   `normalizeDuration("P40D", {largestUnit: "months", relativeTo: "279517-08-15[u-ca=hebrew]"})`
   returns `""`, where Chromium gives `P1M10D`. D1 reaches `Duration` rounding.

---

## 2. Root causes and upstream fixes

Line numbers refer to `js-temporal/temporal-polyfill` `lib/calendar.ts` at commit **`c8f344c`**
(main HEAD, 2026-05-14). The source was read-only; nothing was built. Each patch below is a
proposal: a researcher must verify it in the scratchpad (see "Verification") before the owner
files it. Nothing is posted by an agent.

### 2.1 D1 — fields→ISO probes outside the legacy `Date` range

**Root cause.** Three steps lead to the throw:
1. `HelperBase.calendarToIsoDate` (l.957–1077) starts from `estimateIsoDate()` (l.987).
   - For islamic and persian that estimate is `{year, month: 1, day: 1}` of a year that may be
     `-271821`, i.e. before `-271821-04-19`.
2. It applies a rough `years*365 + months*30 + days` correction (l.1019), then an 8-day bisection
   (l.1032). Neither step clamps.
3. Every estimate goes through `isoToCalendarDate` → `getCalendarParts` (l.687–710) →
   `Intl.DateTimeFormat#formatToParts(new Date(iso))`. Outside ±8.64e15 ms that throws
   `RangeError: Invalid ISO date` (l.708).

`addMonthsCalendar`, `daysInMonth`, `daysInPreviousMonth`, `calendarDaysUntil` and `untilCalendar`
all call `calendarToIsoDate`. So the same overshoot breaks add, until, `.daysInMonth` and
`Duration` rounding near both edges.

**Proposed patch.** Port proposal-temporal `a41eb67`. Also clamp the bisection step; that step is
beyond `a41eb67`, so the researcher must check whether it is reachable (§2.1 Verification).

```diff
--- a/lib/calendar.ts
+++ b/lib/calendar.ts
@@ -125,3 +125,14 @@
 function addDaysISO(isoDate: ISODate, days: number): ISODate {
   return ES.BalanceISODate(isoDate.year, isoDate.month, isoDate.day + days);
 }
+
+// Iterative calendar-to-ISO conversion must never probe outside the
+// PlainDate range: getCalendarParts() formats a legacy Date, which throws there.
+function clampISODate(iso: ISODate): ISODate {
+  if (iso.year < -271821 || (iso.year === -271821 && (iso.month < 4 || (iso.month === 4 && iso.day < 19)))) {
+    return { year: -271821, month: 4, day: 19 };
+  }
+  if (iso.year > 275760 || (iso.year === 275760 && (iso.month > 9 || (iso.month === 9 && iso.day > 13)))) {
+    return { year: 275760, month: 9, day: 13 };
+  }
+  return iso;
+}
@@ -987 +998 @@
-    let isoEstimate = this.estimateIsoDate({ year, month, day });
+    let isoEstimate = clampISODate(this.estimateIsoDate({ year, month, day }));
@@ -1019 +1030 @@
-      isoEstimate = addDaysISO(isoEstimate, diffTotalDaysEstimate);
+      isoEstimate = clampISODate(addDaysISO(isoEstimate, diffTotalDaysEstimate));
@@ -1032 +1043 @@
-      isoEstimate = addDaysISO(isoEstimate, sign * increment);
+      isoEstimate = clampISODate(addDaysISO(isoEstimate, sign * increment));
```

Also port `af0cb4b`'s `makeDayShiftedIsoToCalendarDate` / `makeShiftedIsoToCalendarDate` for
islamic, indian and orthodox. These handle `isoToCalendarDate` for probes at the legacy-Date
boundary. Otherwise the pre-existing `-271821-04-19` special case in `getCalendarParts`
(l.694–701) is the only guard. The researcher decides whether the port is needed, by running the
verification below with and without it.

A clamped estimate can make the bisection oscillate against the limit when the requested fields
really are out of range. That case already terminates through the `increment === 1` branch
(l.1049–1060): `reject` throws "Can't find ISO date", and `constrain` settles at the edge. Then
`ISODateWithinLimits` in the caller throws the spec RangeError.

**Tests.**
- test262 `intl402/Temporal/PlainDate/from/extreme-dates.js`. All 13 rows are quoted in §4.1. Each
  one fails on 0.5.1 for buddhist, hebrew max, islamic-*, persian min and indian min (D5).
- Also `PlainDateTime/from/extreme-dates.js`, `ZonedDateTime/from/extreme-dates.js`,
  `PlainYearMonth/from/extreme-dates.js`, and `{PlainDate,PlainDateTime,ZonedDateTime}/prototype/withCalendar/extreme-dates.js`.
- **New test to propose.** `intl402/Temporal/PlainDate/prototype/until/extreme-dates.js`, one row
  per calendar, with values from §4.3 (Chromium 152):
  - `from(max − 74 d).until(max, {largestUnit: "months"})`;
  - `from(min).until(min + 73 d, {largestUnit: "months"})`;
  - `add({years: 1})` landing exactly on the max (e.g. buddhist `+275759-09-13` → `+275760-09-13`).

**Verification.** No build of main. Apply the diff to a copy of the 0.5.1 dist the way the research
did (`polyfill-research/latest/fixA.mjs`), or to the unminified map source. Then run:
- `POLYFILL=<patched> node polyfill-research/repro-C-calendar-fields-near-limits.mjs`: every row PASS.
- `POLYFILL=<patched> OUT=… node q/q2-xscan-node.mjs`, then
  `node q/q2-xscan-diff.mjs <out> q/q2-xscan-chromium152.json`: the `max`/`min` rows of the D1
  class must disappear. D2/D3/D4/D5 rows remain until their own patches apply.
- Run the test262 files above through the polyfill's own `test262` runner configuration, as a
  single-file run.

### 2.2 D2 — buddhist uses ICU's Julian/Gregorian hybrid (0.5.1 only)

**Root cause.**
- In 0.5.1, `BuddhistHelper extends GregorianBaseHelperFixedEpoch`, which reads fields through
  `Intl.DateTimeFormat("en-US-u-ca-buddhist")`.
- ICU4C's `BuddhistCalendar` subclasses `GregorianCalendar`, which has a 1582-10-15 cutover. Raw
  Node: `1000-01-01` prints `December 27, 1542 BE`, and `1582-10-04` prints `September 24, 2125 BE`.
- That contradicts the proposal's proleptic rule (§0).

**Status on main.**
- Fixed: `class BuddhistHelper extends SameMonthDayAsGregorianBaseHelper` (l.2089–2093) never
  calls Intl. It came with `2bb6ba1` "Polyfill: Implement era changes" (port of proposal-temporal
  `28fe786`).
- **Patch:** none needed. **Ask:** a release.

**Tests.**
- test262 `extreme-dates.js` buddhist row
  `["buddhist", -271278, 4, "M04", 19, "be", -271278, 276303, 9, "M09", 13, "be", 276303]`.
- The min half of that row fails on 0.5.1, which reads `-271273-M11-19`.
- **New test to propose:** `intl402/Temporal/PlainDate/prototype/withCalendar/proleptic-buddhist.js`:
  - `1000-01-01` → buddhist 1543-M01-1;
  - `1582-10-04` → 2125-M10-4;
  - `1582-10-14` → 2125-M10-14.
  - Chromium 152 values: `q2-spec-probe` / §4.2.

**Verification.** No patch to apply. The researcher checks `SameMonthDayAsGregorianBaseHelper`
coverage by reading main l.1988–2000, then confirms against the next release with
`q/q2-xscan-diff.mjs`: the buddhist `stride read` row must be gone.

### 2.3 D3 — Hebrew leap years for negative years

**Root cause.**
- `HebrewHelper.inLeapYear` (l.1394–1402) returns `(7 * year + 1) % 19 < 7`. JS `%` keeps the
  dividend's sign, so every `year ≤ −1` gives a negative remainder and is "leap".
- `monthsInYear` becomes 13, the Intl month-name → ordinal table uses the leap column, and a
  common-year `Adar` has no entry: `RangeError: Missing month converting …` (l.804).
- Arithmetic through `addMonthsCalendar` then walks wrong month lengths.

**Proposed patch** (identical to proposal-temporal `0df570c`):

```diff
--- a/lib/calendar.ts
+++ b/lib/calendar.ts
@@ -1401 +1401,3 @@ class HebrewHelper extends HelperBase {
-    return (7 * year + 1) % 19 < 7;
+    let cycleYear = (7 * year + 1) % 19;
+    if (cycleYear < 0) cycleYear += 19;
+    return cycleYear < 7;
```

**Tests.**
- test262 `extreme-dates.js` hebrew min row
  `["hebrew", -268058, 11, "M11", 4, "am", -268058, …]`. The ordinal month 11 with `monthsInYear`
  12 fails on 0.5.1, which reads month 12 and `monthsInYear` 13.
- **New test to propose:** `intl402/Temporal/PlainDate/prototype/monthsInYear/negative-years-hebrew.js`:
  - `-010000-01-01` → year −6240 is leap: `(7·−6240+1) mod 19 = 2`, `monthsInYear` 13;
  - `-100000-01-01` → year −96239 is common, `monthsInYear` 12;
  - `from({calendar:"hebrew", year:-96239, monthCode:"M06", day:23})` must not throw.
  - Leap status is independent arithmetic; the Chromium reads are in §4.2.

**Verification.** Apply to a dist copy. Then:
- run `q/q2-xscan-diff.mjs`: the hebrew `stride fromFields` and ordinal-only mismatches must go to
  zero, while D4 day-level mismatches remain in Node;
- run `node q/hebrew-oracle-check.mjs` with `POLYFILL` set: rows 6 and 7 (`-100000-01-01`) must
  stop throwing.

### 2.4 D4 — ICU4C Hebrew is one day off for years ≤ 0 (environment, not polyfill)

**Root cause.**
- ICU4C `i18n/hebrwcal.cpp` `startOfYear` / `handleComputeFields` (l.426–470, l.632–700 in the
  fetched copy `q/icu4c-hebrwcal.cpp`) mis-applies the Kislev-length and dehiyyah boundary rules
  for extended years ≤ 0.
- ICU fixed it in **`5267bb5778`** (2026-07-13), "ICU-23007 Fix Hebrew calendar year <= 0 Kislev
  length and Dechiya boundary rules (ICU-23070, ICU-22441)".
- The polyfill surfaces ICU output unchanged, so the error depends on the runtime's ICU. Chromium
  152 (ICU4X) is correct.

**Upstream fix.**
- ICU: already merged. Needed: a Node release that bundles an ICU containing `5267bb5778`, and the
  same for browsers GMT users run.
- **Polyfill (optional, owner's choice to propose).** Make `HebrewHelper.isoToCalendarDate`
  arithmetic, like `SameMonthDayAsGregorian`, so the result no longer depends on ICU. That is a
  large patch (Dershowitz–Reingold new-year computation). This spec does not draft it unless the
  owner asks; see §9 D-HEB.

**Tests.**
- The test262 `extreme-dates.js` hebrew min row (`-268058-M11-4`) does **not** catch D4. Node and
  the oracle agree at the min edge.
- **New test to propose:** `intl402/Temporal/PlainDate/prototype/day/far-past-hebrew.js`:
  - `-271821-11-05` → `-268057` `M05` day **28**;
  - `-100000-01-01` → `-96239` `M06` day **23**;
  - `-003761-09-01` → year **0** `M01` day **13**.
  - The oracle and Chromium agree on all three; Node ICU 78.3 gives 27 / 22 / 12.

**Verification.** `node q/hebrew-oracle-check.mjs` under a runtime with the new ICU. Every row must
print `node agree`.

### 2.5 D5 — Indian "V8 bug 10529" guard fires on a correct ICU

**Root cause.**
- `IndianHelper.vulnerableToBceBug` (l.1721–1722) compares
  `new Date('0000-01-01T00:00Z').toLocaleDateString('en-US-u-ca-indian', {timeZone:'UTC'})`
  with `'10/11/-79 Saka'`.
- ICU 78 / CLDR 48 print `"10/11/-79 Śaka"`, which is correct (Pausa 11, −79). The comparison
  fails, and `checkIcuBugs` (l.1723–1729) throws for every ISO year < 1.

**Proposed patch.** Test the numbers, not the era's display name. This is a behavioural
equivalent of `314b112`.

```diff
--- a/lib/calendar.ts
+++ b/lib/calendar.ts
@@ -1721,2 +1721,5 @@ class IndianHelper extends HelperBase {
-  vulnerableToBceBug =
-    new Date('0000-01-01T00:00Z').toLocaleDateString('en-US-u-ca-indian', { timeZone: 'UTC' }) !== '10/11/-79 Saka';
+  // Compare numeric fields only: the era's display name changed across ICU
+  // versions ("Saka" -> "Śaka") without the calendar computation changing.
+  vulnerableToBceBug = !/^10\/11\/-79(\s|$)/.test(
+    new Date('0000-01-01T00:00Z').toLocaleDateString('en-US-u-ca-indian', { timeZone: 'UTC' })
+  );
```

**Tests.**
- test262 `extreme-dates.js` indian row
  `["indian", -271899, 1, "M01", 29, "shaka", -271899, 275682, 6, "M06", 22, "shaka", 275682]`.
  The min half throws on 0.5.1 under ICU 78.
- `intl402/Temporal/PlainDate/from/roundtrip-from-string.js` (its indian rows).
- **New test to propose:** `indian` `-000500-06-15` ↔ `-578` `M03` 25 (Chromium 152).

**Verification.** Apply to a dist copy, then run `q/q2-xscan-diff.mjs`: every `indian` row must
disappear, including the 993-sample stride rows.

### 2.6 D6 — non-ISO `until` re-constrains the day while counting months (0.5.1 only)

**Root cause.**
- In 0.5.1, `untilCalendar`'s month loop did
  `next = this.regulateDate({ ...next, day: calendarOne.day }, 'constrain', cache)`. After Aug 31 +
  1 month the day is constrained to Sep 30, so Sep 30 "does not surpass" and counts as a whole
  month.
- `NonISODateSurpasses` (§0) compares the **un-constrained** day: Aug 31 → Sep 30 is `P30D`.

**Status on main.** Fixed at l.1219–1222 (`next = { ...next, day: calendarOne.day }` "even if
that's not a real date") by `10aeb98` (port of `1f6d6df`). **Patch:** none. **Ask:** a release.

**Tests.** test262 `intl402/Temporal/PlainDate/prototype/until/wrapping-at-end-of-month-{buddhist,coptic,ethioaa,ethiopic,gregory,hebrew,indian,islamic-civil,islamic-tbla,islamic-umalqura,japanese,persian,roc}.js`.
Quoted rows (ethioaa):

```js
Temporal.PlainDate.from({ year: 1970, monthCode: "M12", day: 28, calendar }).until(end /* 1970-M13-05 */, { largestUnit })
// 0, 0, 0, 7 — "Mesori 28th to Pikougi Enavot 5th is 7 days, not one month"
Temporal.PlainDate.from({ year: 1970, monthCode: "M10", day: 6, calendar }).until(end, { largestUnit })
// 0, 2, 0, 29 — "Paoni 6th to Pikougi Enavot 5th is 2 months 29 days, not 3 months"
```

Quoted rows (hebrew, `overflow: "reject"`):

```js
Temporal.PlainDate.from({ year: 5783, monthCode: "M07", day: 30, calendar }, options).until(end /* 5783-M08-29 */, { largestUnit })
// 0, 0, 0, 29 — "Nisan 30th to Iyar 29th is 29 days, not one month"
Temporal.PlainDate.from({ year: 5783, monthCode: "M09", day: 30, calendar }, options).until(end /* 5783-M12-29 */, { largestUnit })
// 0, 2, 0, 29 — "Sivan 30th to Elul 29th is 2 months 29 days, not 3 months"
```

**Verification.** Run `POLYFILL=<release> OUT=… node q/q2-grid-node.mjs`, then
`node q/q2-grid-diff.mjs <out> q/q2-grid-chromium152.json`. It must print "identical to native"
for all 11 calendars once D6 and D7 are released.

### 2.7 D7 — mixed-sign duration from `untilCalendar` (tc39/proposal-temporal#3159)

**Root cause.**
- `untilCalendar` (l.1160–1233) computes `years` from `diffYears` and a monthCode string compare,
  then `intermediate = addCalendar(calendarOne, {years, months}, 'constrain')` (l.1207–1208).
- When the `M05L` source date constrains to `M06` in a common target year, `intermediate` can pass
  `calendarTwo`. Then `months` goes negative while `years` is positive, and `Duration` rejects the
  mixed signs.
- Example: `5784-M05L-02 → 5785-M06-01`.

**Proposed patch.** Port proposal-temporal `0e32ee0`; this is its functional hunk.

```diff
--- a/lib/calendar.ts
+++ b/lib/calendar.ts
@@ -1207,2 +1207,9 @@ class HelperBase {
         const intermediate =
           years || months ? this.addCalendar(calendarOne, { years, months }, 'constrain', cache) : calendarOne;
+
+        // At this point, intermediate could fail to be in between calendarOne and calendarTwo
+        // due to leap years. In that case, add or subtract an extra year from years,
+        // so that the months can be totaled up correctly.
+        if (this.compareCalendarDates(intermediate, calendarTwo) * sign > 0) {
+          years -= sign;
+        }
```

`intermediate` must then be recomputed with the corrected `years` before the month loop. In
upstream the loop starts from `next = intermediate`, so the port must re-derive it. The
researcher must compare against `0e32ee0`'s full file, which also renames `isOneFurtherInYear` and
adds comments. The hunk above is only the behavioural core.

**Tests.**
- test262 `intl402/Temporal/PlainDate/prototype/until/leap-months-hebrew.js` and `leap-year-until.js`.
- **New row to propose:** hebrew `5784-M05L-02` until `5785-M06-01`, `largestUnit: "years"` →
  `P12M29D` (Chromium 152; §4.3).

**Verification.** Run `q/q2-grid-diff.mjs` on the patched copy. The hebrew `until(a,a+365…384) years`
rows (79 `ERR` mismatches) must go to zero.

### 2.8 D8 — era codes (0.5.1 only)

**Root cause.**
- 0.5.1's `JapaneseHelper` uses eras `japanese`/`japanese-inverse`, `RocHelper` uses `roc-inverse`,
  and the islamic helpers have no eras.
- The proposal's era table uses `ce`/`bce`, `broc`, and `ah`/`bh`.

**Status on main.** Fixed by `2bb6ba1` "Polyfill: Implement era changes" (JapaneseHelper
l.2143–2170 has `ce`/`bce`). **Patch:** none. **Ask:** a release.

**Tests.** test262 `extreme-dates.js` rows for japanese (`"bce", 271822` … `"reiwa", 273742`), roc
(`"broc", 273733` … `"roc", 273849`), and islamic-* (`"bh", 280805` … `"ah", 283583`).

**Verification.** None needed beyond the release check in the canary (§3.6).

### 2.9 Upstream issue drafts to update (owner files)

`scratchpad/polyfill-research/upstream-issue.md` section C should become a **port-and-release
request** listing `a41eb67`, `af0cb4b`, `0df570c`, `314b112` and `0e32ee0`, with the diffs above.
Its appendix should move D4 to an ICU note and mark D2, D6 and D8 as "on main, unreleased".

---

## 3. GMT workaround design

### 3.1 Principles (owner constraints, binding)

1. **No calendar rules or CLDR/ICU data in GMT.** No era offsets, month lengths, leap cycles,
   epochs, cutover dates or cycle constants.
   - Every value comes from polyfill operations that are correct in range: `withCalendar(id)` reads
     of `year`/`month`/`monthCode`/`day`, `PlainDate.from` fields, ISO `add({days})` / `until` /
     `compare`, and polyfill calendar `add` on **day-1** dates where it does not throw.
   - Every derived value is verified by reading it back.
   - A defect that cannot be fixed that way is **not** designed around. It goes to §9.
2. **Dormant unless needed.** Each defect has a *capability probe*: its upstream repro, run once
   per process and per calendar, lazily, memoized. If the installed polyfill passes, that
   defect's fallback never runs, and behaviour is the polyfill's own.
   - When a probe fails, a per-call guard (a throw, or a failed read-back or `Surpasses` check)
     decides whether this particular call needs the fallback.
3. **Isolation.** All of it lives in `packages/gmt/src/internal/temporalCompat/`. Call sites use
   its entry points only. Removal is mechanical (§6.4).
4. **Same answer after removal.** Each fallback implements the spec algorithm (§0). A fixed
   polyfill implements the same algorithm, so removing the fallback changes no output. The oracle
   (§6.3) proves that.

### 3.2 Module layout

```
packages/gmt/src/internal/temporalCompat/
  index.ts          // the ONLY import surface: calendarDateFromFields, calendarFieldsOf,
                    // calendarDateAdd, calendarDateUntil, calendarRelativeTo
  capabilities.ts   // lazy memoized probes, one per defect id (D1, D3, D6, D7), keyed by calendar
  repros.ts         // the probe inputs + spec-correct expected values (shared with the canary script)
  fieldSearch.ts    // read-only ISO-day search: fields -> ISO, month starts, monthsInYear
  nonIsoArithmetic.ts // NonISODateAdd / NonISODateSurpasses / NonISODateUntil over fieldSearch
  README.md         // what each workaround covers, its removal trigger, removal steps (§6)
```

Precedent: `internal/zonedWallClock.ts` ("WHY THIS FILE EXISTS — two polyfill 0.5.1 defects …").
Follow its doc-comment style: name each defect, cite its upstream commit, and call the polyfill
first.

**Probe results are process-global and deterministic for a given polyfill + ICU.** They are not
exported. Tests never force them. Tests assert spec-correct outputs, which must pass whether the
probe passes or fails (§4.5).

### 3.3 Primitive: read-only field search (`fieldSearch.ts`)

Everything is built on one fact the scans establish: in 0.5.1 + ICU 78,
`PlainDate(iso).withCalendar(id)` returns correct `year`, `month`, `monthCode` and `day` for
**every** in-range ISO date, in every calendar the compat module serves.

The exceptions are D2, D4 and D5, which §9 handles, and which the search therefore never serves
(§3.7). The `max read` failures in §1.3 come from `.daysInMonth` / `.monthsInYear`, which the
search never touches.

Calendar fields are strictly increasing in ISO order under the lexicographic key
`(year, month, day)`: ordinal month, not month code. So:

```ts
// Greatest in-range ISO date whose calendar key is <= target, or null if none.
function floorDateForFields(calendarId: string, target: { year: number; month: number; day: number }): Temporal.PlainDate | null
```

- **Binary search over epoch days** in `[MIN_ISO, MAX_ISO]` (`-271821-04-19`, `+275760-09-13`,
  the PlainDate limits defined by the Temporal spec, not calendar data).
- **Narrow start (cheap path).** Bracket around `estimate`, where `estimate` is the ISO date the
  polyfill itself returned for the nearest successful `from()` call:
  1. try `from({calendar, year, month: 1, day: 1})`;
  2. otherwise read `MIN_ISO` / `MAX_ISO` and pick the edge whose year is nearer.
  3. Then gallop outward (±64, ±128, … days) until the bracket straddles the target, and bisect.
- **Loop caps.**
  - Gallop: 32 doublings; bisect: 32 halvings.
  - A cap hit throws `RangeError` (callers turn it into the sentinel, per coding-standards
    "A bounded loop that runs out returns the sentinel").
- **Every comparison reads only** `year`, `month` and `day`.

Derived helpers, all verified by read-back:
- `isoForFields(id, y, m, d)`: `floorDateForFields`, then require an exact key match.
- `lastDayOfMonth(id, y, m)`: `floorDateForFields(id, {y, m, day: Number.MAX_SAFE_INTEGER})`.
  - If its key's month ≠ m → the month does not exist.
  - If the result is `MAX_ISO` and the month extends past the limit → `null` ("not representable").
- `monthsInYearAt(id, y)`: `floorDateForFields(id, {y, month: MAX, day: MAX}).month` — **only
  when** that date is not `MAX_ISO`; otherwise `null`.
- `monthCodeOrdinal(id, y, monthCode)`: walk the month starts of year `y` with `isoForFields(id, y, k, 1)`,
  `k = 1…monthsInYearAt`. Return `k` whose read `monthCode` matches, or `null`. At most 13 searches;
  used only by the add fallback.

### 3.4 Entry point: `calendarDateFromFields` (fixes D1-W; also serves D3 once §9 D-HEB is decided)

```ts
export function calendarDateFromFields(
  calendarId: string,                              // Temporal id ("hebrew", "islamic-tbla", "ethioaa", …)
  fields: { year: number; month: number; day: number } | { era: string; eraYear: number; month: number; day: number },
  overflow: "reject" | "constrain",
): Temporal.PlainDate                              // calendared as calendarId; throws RangeError
```

1. `result = Temporal.PlainDate.from({...fields, calendar: calendarId}, {overflow})`.
   - If it does not throw → **read-back guard**: for `reject`, the read `year|eraYear`, `month`
     and `day` must equal the input; for `constrain`, `year` must equal the input year.
   - On a match, return `result`. This is the only path when the D1 probe passes.
2. If step 1 threw a `RangeError`, or the guard failed, **and** `capabilities.fieldsToIso(calendarId)`
   is false: continue. Otherwise rethrow the polyfill's error, or return `result`.
3. Era input: `{era, eraYear}` resolves to `year` by reading any in-range date of that era. Only
   japanese uses eras in GMT, and japanese has no D1 window, so the fallback **rejects era input
   with a RangeError** instead of searching. This is documented so nothing is silently guessed.
4. `constrain` (spec `NonISOCalendarDateToISO`):
   - `mIY = monthsInYearAt(y)`; `m' = min(m, mIY)`;
   - `last = lastDayOfMonth(y, m')`; `d' = min(d, last.day)`;
   - `reject` throws whenever `m' ≠ m` or `d' ≠ d`.
   - `null` from either helper (month or year runs past the limit) → the result would be outside
     `ISODateWithinLimits` → `RangeError`.
5. `isoForFields(id, y, m', d')`, then `.withCalendar(calendarId)`. `null` → `RangeError`.

The D1 capability probe is the test262 max row for the calendar (§4.1):
`from({calendar, year, month, day}, {overflow: "reject"})` must equal the ISO max. The islamic,
persian and buddhist min rows are probed too.

### 3.5 Entry points: `calendarDateAdd` / `calendarDateUntil` (fix D1-A/U/Δ, D6, D7)

```ts
export function calendarDateAdd(date: Temporal.PlainDate, duration: { years?: number; months?: number; weeks?: number; days?: number }, overflow: Overflow): Temporal.PlainDate
export function calendarDateUntil(one: Temporal.PlainDate, two: Temporal.PlainDate, largestUnit: "year" | "month" | "week" | "day"): { years: number; months: number; weeks: number; days: number }
```

Both require `one`, `two` and `date` to carry the same non-ISO calendar. `iso8601` passes straight
through.

**Add** (`NonISODateAdd`, Intl proposal l.1156):
1. Try `date.add(duration, {overflow})`. No throw → return it; add at ordinary dates is correct in
   0.5.1 (the grid shows no add mismatches).
2. Polyfill `RangeError` and `capabilities.add(id)` false → spec algorithm over §3.3:
   - `parts = read(date)`; `y0 = parts.year + years`.
   - **ConstrainMonthCode.** `k = monthCodeOrdinal(id, y0, parts.monthCode)`. If `null`:
     - `reject` → throw;
     - `constrain` → the month code the polyfill produces for this leap month code in a year
       without it, derived once per calendar:
       `Temporal.PlainDate.from({calendar: id, year: Y*, monthCode: parts.monthCode, day: 1}, {overflow: "constrain"}).monthCode`,
       where `Y*` is the first year at or after the calendar year of `2000-01-01` whose month
       starts lack that code. That is at most 19 years of `monthCodeOrdinal`, all far from the
       limits, and cached.
     - This is how Hebrew `M05L → M06` is obtained without GMT knowing it.
   - **BalanceNonISODate(y0, k + months + 1, 0)** → `endOfMonth`:
     - step month starts with `isoForFields(id, y, k, 1)` and ISO day arithmetic;
     - when |months| > 24, jump first with the polyfill's own `add({months: months − 24·sign})` on the
       **day-1** date (never constrained, so correct in 0.5.1);
     - if that jump throws, fall back to year-by-year steps capped at 1 000 → `RangeError`.
   - `regulatedDay = min(parts.day, endOfMonth.day)`; `reject` throws if they differ.
   - `balanced = isoForFields(id, endOfMonth.year, endOfMonth.month, regulatedDay)`, then
     ISO `.add({days: 7·weeks + days})`.
   - `null` or out of limits → `RangeError` (spec `ISODateWithinLimits`).

**Until** (`NonISODateUntil`, l.1193) — polyfill first, verified:
1. `r = one.until(two, {largestUnit})`. On a throw → go to step 3.
2. **Surpasses guard**, only when `capabilities.until(id)` is false (the D6/D7 probe failed).
   - Accept `r` iff `!NonISODateSurpasses(sign, one, two, r.years, r.months, r.weeks, r.days)`
     **and** bumping the smallest non-zero candidate by `sign` does surpass:
     - `years`: `(years+sign, 0, 0, 0)`;
     - `months`: `(years, months+sign, 0, 0)`;
     - `days`: `(years, months, weeks, days+sign)`.
   - Otherwise go to step 3. Cost when active: 2–4 guard evaluations.
3. **Spec loops with estimates.**
   - `years₀ = read(two).year − read(one).year`, then adjust by ±1 until the spec condition holds
     (≤ 3 steps).
   - `months₀`: the polyfill's `until` between the **day-1** dates of the two months
     (never constrained). If that throws, split at a day-1 anchor ≥ 400 ISO days from both limits
     and add the two counts; month counts between month starts are additive. Then adjust ±1.
   - `weeks` and `days` come from ISO `until` between
     `calendarDateAdd(one, {years, months}, "constrain")` and `two`.
   - `NonISODateSurpasses` (l.1114) is implemented literally over §3.3:
     - `CompareSurpasses` compares `(year, monthCode)` with `ParseMonthCode` ordering
       (`M05 < M05L < M06`: grammar, not data);
     - it then compares `(year, ordinal month, day)` with the **un-constrained** day.

`largestUnit: "day" | "week"` always use ISO `until` on `withCalendar("iso8601")` copies. Days are
calendar-independent, and the polyfill's `calendarDaysUntil` goes through `calendarToIsoDate`, which is
D1-exposed.

### 3.6 `Duration` with a calendared `relativeTo` (D1-Δ)

`internal/zonedWallClockDifference.ts` already implements `NudgeToCalendarUnit` /
`RoundRelativeDuration` over two seams, `calendarDateAdd` (l.379) and `calendarDateUntil` (l.391).
Design:

1. Those two seams import from `temporalCompat` instead of calling `.add` / `.until` directly.
2. `durationTotal`, `durationRound`, `durationCompare` and `zonedUntil` gain one more condition for
   taking GMT's spec path. Besides `atRangeLimit`, they also take it when
   `calendarCompat.needed(calendarId)`, i.e. any of D1/D6/D7 probes failed for that calendar.
3. A **PlainDate** `relativeTo` (`resolveDurationRelativeTo` returns a calendared `PlainDateTime`)
   currently bypasses that file (`zonedRelativeTo` → `null`). Add a *plain context*:
   - spec `DifferencePlainDateTimeWithRounding` uses `GetUTCEpochNanoseconds` with **no instant
     validity check**, so it must not be modelled as a UTC `ZonedDateTime`;
   - `-271821-04-19T00:00` is a valid `PlainDateTime` but not a valid instant.
   - The plain context reuses the bigint nudge code with `epochFor = GetUTCEpochNanoseconds`.

**Coordination.** A concurrent `tdd-dev` is editing `zonedWallClockDifference.ts` (zoned difference /
UTC work). Slice S7 (§7) starts only after that work has landed on this branch.

### 3.7 GMT call sites that change

Rule: **no `.add` / `.subtract` / `.until` / `.since` / `PlainDate.from(fields)` on a non-ISO-calendared
Temporal value outside `temporalCompat`.** `ISO8601` values and `withCalendar` reads are unaffected.

| File | Current call | Becomes |
|---|---|---|
| `internal/calendarDateString.ts` `parseCalendarDateValue` | `Temporal.PlainDate.from({...fields, calendar}, {overflow: "reject"})` | `calendarDateFromFields(id, fields, "reject")` |
| `internal/ethiopicFamilyCalendar.ts` `dateFromEthiopicFamilyFields` | `PlainDate.from({calendar: "ethioaa"}, reject)` | `calendarDateFromFields("ethioaa", …, "reject")` |
| `internal/calendarZonedString.ts` `parseCalendarZonedValue` | delegates to `parseCalendarDateValue` | unchanged (inherits) |
| `plain/calculate/addDate.ts`, `subtractDate.ts` | `date.add(units, {overflow})` | `calendarDateAdd` (negated for subtract) |
| `internal/zonedWallClockOperations.ts` `addToZoned` (l.333, 372, 394) | `.add({years, months, weeks, days}, {overflow})` on the calendared date | date part via `calendarDateAdd`, then GMT's existing wall-clock path |
| `internal/dateUnitHelpers.ts` `getStartOfNextDateUnit` (l.48–54) | `date.add({years / months / days})` | `calendarDateAdd` |
| `plain/calculate/diffDate.ts`, `diffDateAsDuration.ts` | `d1.until(d2, {largestUnit, smallestUnit, roundingIncrement, roundingMode})` | no rounding options → `calendarDateUntil`; with rounding → the plain context of §3.6 |
| `plain/interval/intervalLengthDate.ts` (l.63), `intervalCountDate.ts` (l.109), `splitIntervalByUnitDate.ts`, `intervalFromDurationDate.ts` (l.73–74), `intervalDivideEquallyDate.ts` (l.66: `largestUnit: "day"` → ISO) | `.until` / `.add` / `.subtract` | compat entry points |
| `zoned/calculate/diffZoned.ts`, `diffZonedAsDuration.ts`, `zoned/interval/{intervalLength,intervalCount,splitIntervalByUnit,intervalFromDuration}Zoned.ts` | `zoned.until` / `add` | through `zonedUntil` / `addToZoned` (already central), whose calendar seams call compat |
| `internal/zonedWallClockDifference.ts` l.379–400 + dispatch l.1147–1290 | seams | §3.6 |
| `internal/resolveDurationRelativeTo.ts` | returns calendared `PlainDateTime` | unchanged; `durationTotal` / `Round` / `Compare` take the plain context when compat is needed |
| `internal/calendarDateString.ts` `calendarDateParts`, `ethiopicFamilyCalendar.ts` `ethiopicFamilyDateParts` | `String(year).padStart(4,"0")` | **G1** (§3.8, owner decision) |
| `regex/calendar-date.ts`, `regex/calendar-zoned-date-time.ts` | `(\d{4,6})`, `;era=([a-z]+)` | **G1 / G2** (§3.8) |

**Not changed.**
- `calendarOfAllZonedValues`, `calendarOfAllDateValues` and `calendarSystemOf*Value` are regex-only.
- `formatDateInCalendar` and `formatZonedInCalendar` do reads only. The reads are correct except
  D2, D4 and D8, which §9 covers.
- `withCalendar` calls for display.

A lint guard is recommended but out of scope. Instead, tester adds a source-scan unit test in
`temporalCompat/index.test.ts`: `grep` `packages/gmt/src` for `\.(until|since|add|subtract)\(`
on identifiers whose value came from `parseCalendar*` or `withCalendar(<non-iso>)` and that live
outside the compat module and ISO-only files. If the heuristic is too noisy, the owner may drop
it; the call-site table is authoritative.

### 3.8 GMT grammar (G1, G2) — proposal, gated on §9 D-G1 / D-ERA

G1 is GMT's own defect: no polyfill release fixes it. **Proposed grammar**, if the owner approves:
- **Year:** `-?\d{4,6}` in both regexes. Negative years are written `-` + absolute value
  zero-padded to 4 (`-0911-01-01[u-ca=taiwan]`); positive years stay unsigned (unchanged).
- `calendarDateParts` / `ethiopicFamilyDateParts` produce `(year < 0 ? "-" : "") + String(Math.abs(year)).padStart(4, "0")`.
- `parseCalendarDateValue` passes `Number(capture)`.
- This is not ISO 8601 expanded-year syntax (`±YYYYYY`). GMT's calendar grammar is already
  non-ISO (calendar-native digits, see coding-standards E1). The rule mirrors the existing
  unsigned 4–6-digit form. Owner may prefer `±YYYYYY` for |year| > 9999; §9 lists both.

G2 (era token):
- **Era:** `;era=([a-z]+(?:-[a-z]+)*)`. This only makes today's polyfill output parseable.
- Whether GMT then **emits** spec era codes (`ce`/`bce`) is §9 D-ERA. Emitting them under 0.5.1
  requires a GMT-owned `japanese`→`ce` / `japanese-inverse`→`bce` mapping, i.e. owning era names.
- `PlainDate.from({calendar: "japanese", era: "ce" | "bce", …})` is already accepted by 0.5.1
  (verified: `convertDateToCalendar("1800-01-01[u-ca=japanese;era=ce]", "gregorian")` → `"1800-01-01"`).

---

## 4. Test matrix

**Where expected values come from.**
- **T262:** test262, quoted.
- **CR:** Chromium 152 native Temporal, recorded this session, in `q/q2-spec-probe*` or
  `q/q2-xscan-chromium152.json`.
- **ORC:** the independent Hebrew oracle.

Never GMT, never the polyfill. GMT strings use **ordinal** months (Hebrew leap year: `M09` = month
10). A row marked **[G1]** is a negative calendar year, and becomes testable only after §9 D-G1.
Its expected string uses the proposed `-YYYY` form. Rows marked **[D-…]** depend on that owner
decision.

### 4.1 test262 `intl402/Temporal/PlainDate/from/extreme-dates.js` (verbatim rows)

```js
// [calendar, minYear, minMonth, minMonthCode, minDay, minEra, minEraYear, maxYear, maxMonth, maxMonthCode, maxDay, maxEra, maxEraYear]
["buddhist", -271278, 4, "M04", 19, "be", -271278, 276303, 9, "M09", 13, "be", 276303],
["coptic", -272099, 3, "M03", 23, "am", -272099, 275471, 5, "M05", 22, "am", 275471],
["ethioaa", -266323, 3, "M03", 23, "aa", -266323, 281247, 5, "M05", 22, "aa", 281247],
["ethiopic", -271823, 3, "M03", 23, "aa", -266323, 275747, 5, "M05", 22, "am", 275747],
["gregory", -271821, 4, "M04", 19, "bce", 271822, 275760, 9, "M09", 13, "ce", 275760],
["hebrew", -268058, 11, "M11", 4, "am", -268058, 279517, 10, "M09", 11, "am", 279517],
["indian", -271899, 1, "M01", 29, "shaka", -271899, 275682, 6, "M06", 22, "shaka", 275682],
["islamic-civil", -280804, 3, "M03", 21, "bh", 280805, 283583, 5, "M05", 23, "ah", 283583],
["islamic-tbla", -280804, 3, "M03", 22, "bh", 280805, 283583, 5, "M05", 24, "ah", 283583],
["islamic-umalqura", -280804, 3, "M03", 21, "bh", 280805, 283583, 5, "M05", 23, "ah", 283583],
["japanese", -271821, 4, "M04", 19, "bce", 271822, 275760, 9, "M09", 13, "reiwa", 273742],
["persian", -272442, 1, "M01", 9, "ap", -272442, 275139, 7, "M07", 12, "ap", 275139],
["roc", -273732, 4, "M04", 19, "broc", 273733, 273849, 9, "M09", 13, "roc", 273849],
```

As GMT rows. Both directions: `convertDateToCalendar(iso, cal)` → string, and `convertDateToCalendar(string, "gregorian")` → iso.
`isValidCalendarDate(string)` must be `true`.

| GMT calendar | Max: `+275760-09-13` ↔ | Min: `-271821-04-19` ↔ |
|---|---|---|
| hebrew | `279517-10-11[u-ca=hebrew]` | [G1] `-268058-11-04[u-ca=hebrew]` [D-HEB: min row is year −268058] |
| buddhist | `276303-09-13[u-ca=buddhist]` | [G1][D-BUD] `-271278-04-19[u-ca=buddhist]` |
| islamic-civil | `283583-05-23[u-ca=islamic-civil]` | [G1] `-280804-03-21[u-ca=islamic-civil]` |
| islamic-tabular | `283583-05-24[u-ca=islamic-tabular]` | [G1] `-280804-03-22[u-ca=islamic-tabular]` |
| islamic-umalqura | `283583-05-23[u-ca=islamic-umalqura]` | [G1] `-280804-03-21[u-ca=islamic-umalqura]` |
| persian | `275139-07-12[u-ca=persian]` | [G1] `-272442-01-09[u-ca=persian]` |
| indian | `275682-06-22[u-ca=indian]` | [G1][D-IND] `-271899-01-29[u-ca=indian]` |
| japanese | `273742-09-13[u-ca=japanese;era=reiwa]` | [G2][D-ERA] `271822-04-19[u-ca=japanese;era=bce]` |
| taiwan | `273849-09-13[u-ca=taiwan]` | [G1] `-273732-04-19[u-ca=taiwan]` |
| ethiopic-amete-alem | `281247-05-22[u-ca=ethiopic-amete-alem]` | [G1] `-266323-03-23[u-ca=ethiopic-amete-alem]` |
| coptic | `275471-05-22[u-ca=coptic]` | [G1] `-272099-03-23[u-ca=coptic]` |
| ethiopic | `275747-05-22[u-ca=ethiopic;era=ethiopic]` | [G1] `-266323-03-23[u-ca=ethiopic;era=ethioaa]` (GMT's era token; eraYear = ethioaa year) |

Each string above must round-trip on **both** `plain/` and zoned: `convertZonedToCalendar`,
with the date spliced into `T00:00:00+00:00[u-ca=…][UTC]`, and back. The max ISO zoned string is
`+275760-09-13T00:00:00+00:00[UTC]`. For min rows use a `-12:00` offset zone
(`Etc/GMT+12`, `-271821-04-19T12:00:00-12:00[Etc/GMT+12]`), because `-271821-04-19T00:00Z` is
before the minimum instant.

### 4.2 Read / convert rows (CR unless marked)

| Input ISO | calendar | Expected GMT string | Notes / defect |
|---|---|---|---|
| `2024-10-03` | every calendar | the existing `@example`s in `convertDateToCalendar.ts` | modern control (already green) |
| `+275760-09-08` | hebrew | `279517-10-06[u-ca=hebrew]` | first day of D1 max window: parse must succeed |
| `+275760-09-07` | hebrew | `279517-10-05[u-ca=hebrew]` | last day before window (control) |
| `+275760-05-16` | hebrew | `279517-06-09[u-ca=hebrew]` (month code `M05L`) | leap month near max |
| `+275760-08-13` | buddhist | `276303-08-13[u-ca=buddhist]` | D1 window start (32 d) |
| `+275760-08-12` | buddhist | `276303-08-12[u-ca=buddhist]` | control |
| `+275760-09-05` | islamic-civil | `283583-05-15[u-ca=islamic-civil]` | D1 window start (9 d) |
| `+275760-09-04` | islamic-civil | `283583-05-14[u-ca=islamic-civil]` | control |
| `+275760-09-05` | islamic-tabular | `283583-05-16[u-ca=islamic-tabular]` | D1 |
| `+275760-09-05` | islamic-umalqura | `283583-05-15[u-ca=islamic-umalqura]` | D1 |
| `-271820-01-19` | islamic-civil | [G1] `-280804-12-30[u-ca=islamic-civil]` | last day of 276-d min window |
| `-271820-01-20` | islamic-civil | [G1] `-280803-01-01[u-ca=islamic-civil]` | control |
| `-271820-01-18` | islamic-tabular | [G1] `-280804-12-30[u-ca=islamic-tabular]` | last day of 275-d window |
| `-271820-04-09` | persian | [G1] `-272442-12-29[u-ca=persian]` | last day of 357-d window |
| `-271820-04-10` | persian | [G1] `-272441-01-01[u-ca=persian]` | control |
| `-271821-04-20` | buddhist | [G1][D-BUD] `-271278-04-20[u-ca=buddhist]` | 2-d window |
| `1000-01-01` | buddhist | [D-BUD] `1543-01-01[u-ca=buddhist]` | D2 (current `1542-12-27`) |
| `1582-10-04` | buddhist | [D-BUD] `2125-10-04[u-ca=buddhist]` | D2 |
| `1582-10-14` | buddhist | [D-BUD] `2125-10-14[u-ca=buddhist]` | D2 (a day ICU's cutover skips) |
| `1582-10-15` | buddhist | `2125-10-15[u-ca=buddhist]` | control (already correct) |
| `-000500-06-15` | buddhist | `0043-06-15[u-ca=buddhist]` [D-BUD] | D2 far past |
| `-000500-06-15` | indian | [G1][D-IND] `-0578-03-25[u-ca=indian]` | D5 |
| `-271821-04-21` | indian | [G1][D-IND] `-271899-02-01[u-ca=indian]` | D5 at min |
| `1000-01-01` | taiwan | [G1] `-0911-01-01[u-ca=taiwan]` | G1 at an ordinary date |
| `1868-09-07` | taiwan | [G1] `-0043-09-07[u-ca=taiwan]` | G1 |
| `-000500-06-15` | islamic-civil | [G1] `-1156-06-19[u-ca=islamic-civil]` | G1 |
| `-000500-06-15` | persian | [G1] `-1121-03-25[u-ca=persian]` | G1 |
| `1800-01-01` | japanese | [D-ERA] `1800-01-01[u-ca=japanese;era=ce]` | D8 (current `;era=japanese`) |
| `-000500-06-15` | japanese | [G2][D-ERA] `0501-06-15[u-ca=japanese;era=bce]` | D8/G2 |
| `-271821-11-05` | hebrew | [G1][D-HEB] `-268057-05-28[u-ca=hebrew]` (M05) | D4: ORC + CR = 28; Node ICU 78 = 27 |
| `-100000-01-01` | hebrew | [G1][D-HEB] `-96239-06-23[u-ca=hebrew]` (M06, common year) | D3 (throws) + D4 (22) |
| `-003761-09-01` | hebrew | [D-HEB] `0000-01-13[u-ca=hebrew]` | D4 at year 0, **representable today** |
| `-001000-01-01` | hebrew | `2760-05-01[u-ca=hebrew]` | positive-year control (CR; Node agrees) |

### 4.3 Arithmetic rows (CR)

| Function call | Expected | Current (§5) | Defect |
|---|---|---|---|
| `addDate("279517-09-11[u-ca=hebrew]", {months: 1})` | `"279517-10-11[u-ca=hebrew]"` | same | regression guard: result is exactly the max |
| `addDate("279517-09-12[u-ca=hebrew]", {months: 1})` | `""` (spec RangeError: past max) | — | guard: fallback must not clamp |
| `addDate("276302-09-13[u-ca=buddhist]", {years: 1})` | `"276303-09-13[u-ca=buddhist]"` | `""` | D1-A (xscan buddhist `max add 1 year` n=366) |
| `subtractDate(<islamic-civil read of -271820-05-23>, {years: 1})` | ISO `-271821-06-03` → [G1] string | `""` | D1-A min (min+400 d) |
| `diffDateAsDuration("279517-08-01[u-ca=hebrew]", "279517-10-11[u-ca=hebrew]", "months")` | `"P2M10D"` | `""` | D1-U |
| `diffDateAsDuration("276303-07-01[u-ca=buddhist]", "276303-09-13[u-ca=buddhist]", "months")` | `"P2M12D"` | `""` | D1-U |
| `diffDateAsDuration("281247-03-01[u-ca=ethiopic-amete-alem]", "281247-05-22[u-ca=ethiopic-amete-alem]", "months")` | `"P2M21D"` | `""` | D1-U (Ethiopic family via ethioaa) |
| `diffDateAsDuration("5785-01-01[u-ca=hebrew]", "279517-10-11[u-ca=hebrew]", "years")` | `"P273732Y9M10D"` | — | D1-U long span |
| `diffDateAsDuration("2566-08-31[u-ca=buddhist]", "2566-09-30[u-ca=buddhist]", "months")` | `"P30D"` | `"P1M"` | D6 |
| same, `"0005-08-31[u-ca=japanese;era=reiwa]"` → `"0005-09-30[u-ca=japanese;era=reiwa]"` | `"P30D"` | `"P1M"` | D6 |
| same, `"0112-08-31[u-ca=taiwan]"` → `"0112-09-30[u-ca=taiwan]"` | `"P30D"` | `"P1M"` | D6 |
| same, `"1446-01-30[u-ca=islamic-civil]"` → `"1446-02-29[u-ca=islamic-civil]"` | `"P29D"` | `"P1M"` | D6 |
| same, `"1402-06-31[u-ca=persian]"` → `"1402-07-30[u-ca=persian]"` | `"P30D"` | `"P1M"` | D6 |
| same, `"1945-06-31[u-ca=indian]"` → `"1945-07-30[u-ca=indian]"` | `"P30D"` | `"P1M"` | D6 |
| `diffDateAsDuration("7515-11-30[u-ca=ethiopic-amete-alem]", "7516-13-05[u-ca=ethiopic-amete-alem]", "years")` | `"P1Y1M5D"` | `"P1Y2M"` | D6 |
| `diffDateAsDuration("1739-11-30[u-ca=coptic]", "1740-13-05[u-ca=coptic]", "years")` | `"P1Y1M5D"` | `"P1Y2M"` | D6 (coptic = ethioaa − 5776, same ISO dates) |
| `diffDate("2566-08-31[u-ca=buddhist]", "2566-09-30[u-ca=buddhist]", "months")` | `0` | `1` | D6 |
| `diffDateAsDuration("5784-06-02[u-ca=hebrew]", "5785-06-01[u-ca=hebrew]", "years")` | `"P12M29D"` | `""` | D7 |
| `diffDate("5784-06-02[u-ca=hebrew]", "5785-06-01[u-ca=hebrew]", "years")` | `0` | `null` | D7 |
| test262 `wrapping-at-end-of-month-hebrew.js` rows (§2.6) via `diffDateAsDuration` with GMT strings `5783-07-30`→`5783-08-29` (5783 common: M07 = month 7) | `"P29D"` | tester verifies current | D6 |
| `normalizeDuration("P40D", {largestUnit: "months", relativeTo: "279517-08-15[u-ca=hebrew]"})` | `"P1M10D"` | `""` | D1-Δ |
| `durationAs("P40D", "months", {relativeTo: "279517-08-15[u-ca=hebrew]"})` | `null` (CR throws: the 1-month window passes max) | `null` | guard: must not start answering |
| `durationAs("P1M", "days", {relativeTo: "279517-08-01[u-ca=hebrew]"})` | `30` | `30` | control |
| `compareDurations("P1M", "P29D", {relativeTo: "279517-08-01[u-ca=hebrew]"})` | `1` | `1` | control |

`subtractDate(<… read of …>)` rows: tester fills the calendar string from the CR read in
`q2-xscan-chromium152.json` → `edge["islamic-civil"].min[400][0]` (`year|monthCode|month|day|…`).
Do not derive it by hand.

### 4.4 Edge-window matrix (generated rows, CR)

For **every** GMT calendar (Ethiopic family through its ethioaa row) × edge ∈ {max, min} ×
n ∈ {0, 1, last failing day of the §1.3 window, first day after it, 30, 200, 420}, take the recorded native row
`xscan.edge[<temporalId>][edge][n]`:

| Column | Native field | GMT assertion |
|---|---|---|
| read | `[0]` → `year|monthCode|month|day` | `convertDateToCalendar(isoOf(n), cal)` equals the string built from year/month/day |
| round trip | `[1]` | `convertDateToCalendar(<that string>, "gregorian")` equals `isoOf(n)` |
| +1 month / +1 year / −1 month / −1 year | `[2]…[5]` (ISO or `ERR`) | `addDate` / `subtractDate` on the string; `ERR` ⇒ `""`; else the calendar string of that ISO |
| until months | `[6]` | `diffDateAsDuration` between the edge string and the n string, `"months"` (edge first at min, n first at max) |
| until years | `[7]` | `diffDateAsDuration` with `edge ± 800 d`, `"years"` |

`isoOf(n)` is `edge ∓ n` days in ISO arithmetic. Rows whose string has a negative year are [G1].

**Stride matrix (ordinary and far past).** Take `xscan.stride[<id>]`, samples 0, 500, 998, 999,
1000, 1500 and 2000, the same columns. Every buddhist sample < 1582 is [D-BUD]. Every hebrew sample with year ≤ 0 is [D-HEB].
Every indian sample with ISO year < 1 is [D-IND].

**Modern grid.** Take `q2-grid-chromium152.json`. Every `until(a, a+k)` / `add` column for `i ∈ {0, 61, 91, 122, 245, 274}` × all
15 `k` via `diffDateAsDuration` / `addDate`. This covers D6/D7 month-end behaviour in all 11
calendars.

These three generated tables are the **tester's** job: `it.each` rows written out literally in
the test file. JSON is never read at test time. tdd-dev writes only the §4.1–4.3 rows for its
slices.

### 4.5 Fallback-independence rule

- **Public-function rows (§4.1–4.4)** must pass whatever the capability probes return. On 0.5.1
  they exercise the fallbacks; on a fixed polyfill, the polyfill.
- **Fallback algorithm tests.**
  - `fieldSearch.ts` and `nonIsoArithmetic.ts` export their algorithms internally.
  - `temporalCompat/*.test.ts` calls them **directly** with the §4.2/§4.3 rows. They therefore
    stay covered after upstream fixes, until the module is deleted.
  - No mocking of Temporal (testing-standards "Never Monkey-Patch Real Functions").
- **Probe tests.** `capabilities.test.ts` asserts each probe returns `false` for 0.5.1's recorded failure and that
  the probe's *expected* constant equals the quoted test262/CR value. It does **not** assert the
  probe outcome against the installed polyfill: that would fail CI when upstream is fixed, which
  is the canary's job (§6.3).

---

## 5. Public GMT functions affected

"Current" values are the real output of `packages/gmt/dist` on polyfill 0.5.1
(`q/q2-gmt-rows-current.txt`, `q/q2-gmt-public.mjs`). "Expected" values are CR or T262.

### 5.1 Concrete rows

| Function | Input | Current | Expected | Defect |
|---|---|---|---|---|
| `isValidCalendarDate` | `"279517-10-11[u-ca=hebrew]"` | `false` | `true` | D1-W |
| `isValidCalendarDate` | `"276303-09-13[u-ca=buddhist]"` | `false` | `true` | D1-W |
| `isValidCalendarDate` | `"283583-05-23[u-ca=islamic-civil]"` | `false` | `true` | D1-W |
| `isValidCalendarDate` | `"283583-05-24[u-ca=islamic-tabular]"` | `false` | `true` | D1-W |
| `isValidCalendarDate` | `"283583-05-23[u-ca=islamic-umalqura]"` | `false` | `true` | D1-W |
| `convertDateToCalendar` | `"+275760-09-13", "hebrew"` | `"279517-10-11[u-ca=hebrew]"` (correct) | same | control. **Contradicts the research:** the string is right; the defect is that it cannot be parsed back |
| `convertDateToCalendar` | `"279517-10-11[u-ca=hebrew]", "gregorian"` | `""` | `"+275760-09-13"` | D1-W |
| `convertZonedToCalendar` | `"279517-10-11T00:00:00+00:00[u-ca=hebrew][UTC]", "gregorian"` | `""` | `"+275760-09-13T00:00:00+00:00[UTC]"` | D1-W (zoned) |
| `convertDateToCalendar` | `"1000-01-01", "buddhist"` | `"1542-12-27[u-ca=buddhist]"` | `"1543-01-01[u-ca=buddhist]"` | D2 [D-BUD] |
| `convertZonedToCalendar` | `"1000-01-01T00:00:00+00:00[UTC]", "buddhist"` | `"1542-12-27T00:00:00+00:00[u-ca=buddhist][UTC]"` | `"1543-01-01T00:00:00+00:00[u-ca=buddhist][UTC]"` | D2 [D-BUD] |
| `convertDateToCalendar` | `"-000500-06-15", "indian"` | `""` | `"-0578-03-25[u-ca=indian]"` | D5 + G1 [D-IND][D-G1] |
| `convertDateToCalendar` | `"1000-01-01", "taiwan"` | `"-911-01-01[u-ca=taiwan]"` (its own validator rejects it) | `"-0911-01-01[u-ca=taiwan]"` | G1 [D-G1] |
| `convertDateToCalendar` | `"-000500-06-15", "islamic-civil"` | `"-1156-06-19[u-ca=islamic-civil]"` (unparseable) | same string, and `isValidCalendarDate` → `true`, round trip → `"-000500-06-15"` | G1 |
| `convertDateToCalendar` | `"-000500-06-15", "japanese"` | `"0501-06-15[u-ca=japanese;era=japanese-inverse]"` (unparseable) | `"0501-06-15[u-ca=japanese;era=bce]"` | D8 + G2 [D-ERA] |
| `convertDateToCalendar` | `"1800-01-01", "japanese"` | `"1800-01-01[u-ca=japanese;era=japanese]"` | `"1800-01-01[u-ca=japanese;era=ce]"` | D8 [D-ERA] |
| `convertDateToCalendar` | `"-271821-04-19", "hebrew"` | `"-268058-12-04[u-ca=hebrew]"` (month 12 is wrong; unparseable) | `"-268058-11-04[u-ca=hebrew]"` | D3 + G1 [D-HEB] |
| `diffDate` | `"2566-08-31[u-ca=buddhist]", "2566-09-30[u-ca=buddhist]", "months"` | `1` | `0` | D6 |
| `diffDateAsDuration` | same pair, `"months"` | `"P1M"` | `"P30D"` | D6 (also japanese, taiwan, islamic-*, persian, indian: §4.3) |
| `diffDateAsDuration` | `"7515-11-30[u-ca=ethiopic-amete-alem]", "7516-13-05[…]", "years"` | `"P1Y2M"` | `"P1Y1M5D"` | D6 (coptic, ethiopic likewise) |
| `intervalLengthDate` | `"2566-08-31[u-ca=buddhist]", "2566-09-30[u-ca=buddhist]", "month"` | `1` | **not 1** (< 1): 30 days of a 30-day window. tester records the exact value from CR `Temporal.Duration.from("P30D").total({unit: "months", relativeTo: <2566-08-31 buddhist>})` | D6 |
| `diffDate` | `"5784-06-02[u-ca=hebrew]", "5785-06-01[u-ca=hebrew]", "years"` | `null` | `0` | D7 |
| `diffDateAsDuration` | same, `"years"` | `""` | `"P12M29D"` | D7 |
| `diffDateAsDuration` | `"279517-08-01[u-ca=hebrew]", "279517-10-11[u-ca=hebrew]", "months"` | `""` | `"P2M10D"` | D1-U (also D1-W at the end date) |
| `diffDateAsDuration` | `"281247-03-01[u-ca=ethiopic-amete-alem]", "281247-05-22[…]", "months"` | `""` | `"P2M21D"` | D1-U |
| `addDate` | `"276302-09-13[u-ca=buddhist]", {years: 1}` | `""` | `"276303-09-13[u-ca=buddhist]"` | D1-A |
| `normalizeDuration` | `"P40D", {largestUnit: "months", relativeTo: "279517-08-15[u-ca=hebrew]"}` | `""` | `"P1M10D"` | D1-Δ |

### 5.2 Every public function with a reach

These inherit the defects through the entry points in §3.7. Each gets at least one §4.3/§4.4 row
(tester).

- **D1-W, G1, G2** (parse):
  - plain: `isValidCalendarDate`, `convertDateToCalendar`, `addDate`, `subtractDate`, `diffDate`,
    `diffDateAsDuration`, `isValidDateInterval`, and every `plain/interval/*Date` that accepts
    calendar strings (`intervalAbutsDate`, `intervalContainsDate`, `intervalCountDate`,
    `intervalDifferenceDate`, `intervalDivideEquallyDate`, `intervalEngulfsDate`,
    `intervalFromDurationDate`, `intervalIntersectionDate`, `intervalLengthDate`,
    `intervalOverlappingDaysDate`, `intervalSplitAtDate`, `intervalUnionDate`, `intervalXorAllDate`,
    `intervalXorDate`, `intervalsOverlapDate`, `mergeIntervalsDate`, `splitIntervalByUnitDate`);
  - duration: `durationAs`, `normalizeDuration`, `compareDurations` (calendar `relativeTo`);
  - zoned: `isValidCalendarZonedDateTime`, `isValidCalendarZonedInterval`, `convertZonedToCalendar`,
    `addZoned`, `subtractZoned`, `diffZoned`, `diffZonedAsDuration`, and the `zoned/interval/*Zoned`
    twins of the list above.
- **D1-A** (add): `addDate`, `subtractDate`, `addZoned`, `subtractZoned`,
  `intervalFromDuration{Date,Zoned}`, `splitIntervalByUnit{Date,Zoned}`, `intervalCount{Date,Zoned}`
  (through `getStartOfNextDateUnit`).
- **D1-U, D6, D7** (until): `diffDate`, `diffDateAsDuration`, `diffZoned`, `diffZonedAsDuration`,
  `intervalLength{Date,Zoned}`, `intervalCount{Date,Zoned}`, `splitIntervalByUnit{Date,Zoned}`,
  `intervalOverlappingDays{Date,Zoned}` (ISO days: D1 only through parse).
- **D1-Δ:** `durationAs`, `normalizeDuration`, `compareDurations`.
- **D2, D4, D8, G1** (reads/format): everything that formats a calendar string,
  i.e. the `formatDateInCalendar` / `formatZonedInCalendar` users listed in §3.7.

---

## 6. Future-proofing

### 6.1 Constraint → mechanism

| Owner constraint | Mechanism in this design |
|---|---|
| GMT never owns calendar rules or CLDR/ICU data | The fallbacks (§3.3–3.5) use only polyfill reads, ISO day arithmetic, the PlainDate limits (a Temporal constant) and `ParseMonthCode` grammar. The Hebrew `M05L → M06` constraint is read from the polyfill at runtime. D2, D4 and D5 **cannot** be fixed this way and are §9 decisions, not designs |
| Engage only when the polyfill is wrong or throws | Per-defect lazy capability probe (§6.2), then a per-call guard: the polyfill threw, the read-back mismatched, or the `Surpasses` check failed. A passing probe means zero fallback code runs |
| Stops running when the polyfill is fixed, with no behaviour change | Probes are the upstream repros with spec expected values. Fallbacks implement the same spec algorithm the fixed polyfill implements (§0). §6.3 oracle proves equality |
| Isolation | `internal/temporalCompat/` only; call sites import `index.ts` only (§3.2, §3.7) |
| Canary, not a test marker, never fails CI for "upstream still broken" | `scripts/temporal-compat.mjs` (§6.3) exits 0 on "still needed" |
| Native oracle outside default Node CI | `temporal-compat.mjs oracle` via Playwright Chromium, in a manual/scheduled workflow (§6.3) |

### 6.2 Capability probes (`capabilities.ts` + `repros.ts`)

`repros.ts` must import **only** `@js-temporal/polyfill` (no GMT imports), so the canary script
can load the compiled file directly from `dist` without GMT's extensionless-import resolution.

| Probe id | Calendars probed | Repro (polyfill call) | Spec-correct expected (source) | Fallback it gates |
|---|---|---|---|---|
| `D1.fieldsMax` | hebrew, buddhist, islamic-civil, islamic-tbla, islamic-umalqura, persian, indian, ethioaa | `PlainDate.from({calendar, year, month, day}, {overflow: "reject"})` with the T262 **max** row | ISO `+275760-09-13` (T262) | `calendarDateFromFields` search |
| `D1.fieldsMin` | same | T262 **min** row, ordinal month | ISO `-271821-04-19` (T262) | same |
| `D1.until` | same | `from(max−74 d).withCalendar(c).until(max.withCalendar(c), {largestUnit: "months"})` | per-calendar CR string, e.g. hebrew `P2M15D`, buddhist `P2M12D`, islamic-* `P2M15D`, persian/indian `P2M12D`, ethioaa `P2M14D` (§4.3 source `q2-spec-probe`, `nearmax_months`) | `calendarDateUntil` step 3 |
| `D1.add` | same | `PlainDate.from("+275759-09-13").withCalendar(c).add({years: 1})` for solar calendars; islamic: min+400 d `subtract({years: 1})` | CR: buddhist `+275760-09-13`; islamic-civil `-271821-06-03` | `calendarDateAdd` step 2 |
| `D6.monthEnd` | all non-ISO incl. japanese, roc | T262 `wrapping-at-end-of-month-<cal>.js` first "not one month" row (ethioaa `1970-M12-28 → 1970-M13-05` = `P7D`; hebrew `5783-M07-30 → 5783-M08-29` = `P29D`); gregory-shaped calendars: `08-31 → 09-30` = `P30D` (CR) | as quoted | `calendarDateUntil` Surpasses guard |
| `D7.mixedSign` | hebrew | `from({calendar:"hebrew", year:5784, month:6, day:2}).until(from({… 5785, 6, 1}), {largestUnit:"years"})` | `P12M29D` (CR) | same |
| `D1.relativeTo` | hebrew | `Duration.from("P40D").round({largestUnit:"months", relativeTo: from({calendar:"hebrew", year:279517, month:8, day:15})})` | `P1M10D` (CR) | §3.6 dispatch |

Expected values are **test data** (like fixtures), used only for comparison. No fallback reads them.

**Probe cost:** at most 8 polyfill calls per calendar, once per process, only for a calendar the
process actually uses.

**Probe failure mode.** A probe that throws a non-RangeError is treated as "defect present". This
is safe: the fallback is spec-correct either way.

### 6.3 Canary and native oracle — `scripts/temporal-compat.mjs`

A plain Node ESM script, in the same family as `scripts/test-markers.mjs` / `deps.mjs`. Root
`package.json` scripts: `"compat": "node scripts/temporal-compat.mjs check"`,
`"compat:oracle": "node scripts/temporal-compat.mjs oracle"`.

**`check`** (seconds, Node only):
1. Import `packages/gmt/dist/internal/temporalCompat/repros.js`. If `dist` is missing, print
   "run pnpm build first" and exit 2.
2. Resolve `@js-temporal/polyfill` from `packages/gmt` and print its version.
3. For each repro, run it and print one line: `D1.fieldsMax hebrew  STILL NEEDED (threw RangeError: Invalid ISO date …)`
   or `… REMOVABLE (returns spec value)`.
4. Group the result by workaround and print the removal trigger from §6.5. When **every** probe of
   a workaround is REMOVABLE, print the §6.4 steps for it.
5. **Exit code 0** whenever the script ran, regardless of STILL NEEDED / REMOVABLE.
   - `--fail-on-removable` (manual, release checklist only) exits 1 if anything is removable.
   - Never wired into `validate` or `ci.yml` with that flag.
   - It is not a test file and emits no `it.skip`/`todo`, so `scripts/test-markers.mjs` is
     unaffected.
6. Also run the four `upstream-issue.md` repros A–D that already exist in the scratchpad, copied
   into `repros.ts` as `zoned.*` probes. `internal/zonedWallClock*` workarounds then get the same
   report.

**`oracle`** (minutes; needs a Chromium with native Temporal):
1. Launch Chromium with `@playwright/test` from `apps/dox` devDependencies
   (`chromium.launch()`). If no browser binary is installed, print how to install
   (`pnpm --filter @gmt/dox exec playwright install chromium`), or accept `--chrome=<path>` for a
   standalone Chrome for Testing / headless shell. Exit 2 if Temporal is absent in that browser.
2. Load the **same** scan body (`scripts/temporal-compat/scan-body.js`: this spec's
   `q2-xscan-body.js` + `q2-grid-body.js`, promoted from scratchpad) in the page with native
   `Temporal`.
3. In Node, run a GMT-level twin of the scan: public GMT functions built from `dist`, with each
   native ISO/Duration result converted to the GMT string the function should return.
4. Diff and write `artifacts/temporal-oracle-<date>.json` plus a summary. Exit 0 if the only
   mismatches are rows tagged with an open §9 decision (the tag list lives in the script);
   exit 1 on any other mismatch. That is a genuine GMT bug, which the owner's zero-known-bugs rule
   wants surfaced.
5. **Where it runs:**
   - never in `ci.yml` (Node has no Temporal);
   - a new `.github/workflows/temporal-oracle.yml` with `workflow_dispatch` and a weekly `schedule`,
     which installs the Playwright Chromium and runs `pnpm build` + `pnpm compat:oracle`, and
     uploads the artifact;
   - also run locally by `finalizer` whenever the `@js-temporal/polyfill` range changes.
6. **Authority when the oracle and test262 disagree:** test262 wins (§0). The script's
   tag list records such rows with the test262 file name.

### 6.4 Removal steps (per workaround)

**Removing `calendarDateFromFields` fallback (D1-W):**
1. In `temporalCompat/index.ts`, replace the body of `calendarDateFromFields` with
   `return Temporal.PlainDate.from({...fields, calendar: calendarId}, {overflow});`.
2. Delete the `D1.fields*` probes from `capabilities.ts` / `repros.ts`, and delete `fieldSearch.ts`
   plus its test **only if** no other fallback imports it. `calendarDateAdd`'s fallback does,
   so remove D1-A together with D1-W.
3. Run `pnpm compat` (expects no D1 lines) and the §4.1–4.2 rows (unchanged expectations).

**Removing `calendarDateAdd` / `calendarDateUntil` fallbacks (D1-A/U, D6, D7):** bodies become
`date.add(duration, {overflow})` and `(({years, months, weeks, days}) => ({years, months, weeks, days}))(one.until(two, {largestUnit}))`.
Delete `nonIsoArithmetic.ts` + test and the `D1.add`, `D1.until`, `D6.*`, `D7.*` probes.

**Removing the §3.6 dispatch (D1-Δ):** delete the `calendarCompat.needed` term from the four
dispatch conditions. The two seams keep importing `temporalCompat`, whose bodies are now the plain
polyfill calls.

**Final removal** (all probes REMOVABLE):
1. Inline the four one-line entry points at their call sites, or keep `index.ts` as a thin facade.
   The facade is the owner's choice; keeping it costs nothing.
2. Delete the `temporalCompat/` directory and `scripts/temporal-compat.mjs` `check` groups.
3. Keep `oracle`, which stays useful for regressions.
4. Bump the dependency floor (§6.5) and add a changeset note ("drops workarounds; no behaviour change").

**No test row changes on removal.** If one would have to change, the fallback was not
spec-equivalent. That is a bug to fix, not a test to edit.

### 6.5 Removal triggers and dependency floor

| Workaround / decision | Retired by | Upstream reference | Floor bump |
|---|---|---|---|
| D1-W, D1-A, D1-U, D1-Δ | js-temporal release containing ports of proposal-temporal `a41eb67` (+ `af0cb4b`, + clamp of bisection step if the researcher finds it reachable) | `upstream-issue.md` §C (rewrite to port request, §2.9) | `@js-temporal/polyfill` `^0.5.1` → `^<that release>` |
| D6 | js-temporal release containing `10aeb98` (already on main) | release request (§C) | same bump |
| D7 | release containing a port of `0e32ee0` | §C addendum | same |
| D3 (part of D-HEB) | release containing a port of `0df570c` | §C addendum | same |
| D5 (if D-IND chooses a fallback) | release containing a port of `314b112` | §C addendum | same |
| D2 (if D-BUD chooses a fallback) | release containing `2bb6ba1` (already on main) | release request | same |
| D8 era mapping (if D-ERA chooses mapping) | release containing `2bb6ba1` | release request | same |
| D4 (if D-HEB chooses env-dependent or rejection) | Node release whose bundled ICU includes `5267bb5778`; GMT `engines.node` floor raised to it | ICU-23007 (merged) | `engines.node` |
| `zonedWallClock*` A/B/D (existing) | release containing `05ce7a3` for the **max** edge only, **plus** a separate fix for the min edge (tdd-dev finding: min still throws with `05ce7a3` applied) | `upstream-issue.md` §A (must be amended: not only a release request), §B, §D | same |
| G1, G2 grammar | never (GMT's own grammar) | — | — |

### 6.6 Ongoing maintenance per workaround

| Workaround | Maintenance |
|---|---|
| D1 fields/add/until/Δ fallback | **on polyfill upgrade** (run `pnpm compat`; delete when REMOVABLE) |
| D6 / D7 until guard + fallback | **on polyfill upgrade** |
| G1 signed-year grammar, G2 era token grammar | **none** |
| D-ERA option "map `japanese`→`ce`, `japanese-inverse`→`bce`" | **flag: owns two era names**; none after the polyfill release (mapping deleted) |
| D-BUD option "ISO month/day + year offset measured at a post-1582 anchor" | **flag: owns a calendar rule** (spec-stated, not CLDR); on polyfill upgrade to delete |
| D-IND option "shift by the Gregorian 400-year cycle" | **flag: owns a calendar rule**; on polyfill upgrade |
| D-HEB option "GMT-owned Hebrew arithmetic" | **flag: owns calendar data**; none in practice, deleted only when both polyfill D3 and runtime ICU D4 are fixed, i.e. **on Node/ICU updates** |
| D-HEB option "reject hebrew years ≤ 0" | **flag: on Node/ICU updates** (lift when the floor ICU has `5267bb5778`) |
| Canary / oracle scripts | **on polyfill upgrade** (update tag list); oracle **on Chromium upgrades** if native behaviour changes |

---

## 7. TDD slice order

Slices are vertical: a red row first, then the minimal change, then green. Each lists its **gate**:
the §9 decisions or other work it waits on. Slices without a gate can start immediately.

| Slice | Content | First red row | Gate |
|---|---|---|---|
| **S0** | `temporalCompat/` skeleton, `repros.ts`, `capabilities.ts` (probe table §6.2), `README.md` | `capabilities.test.ts`: probe expected constants equal the T262/CR values; 0.5.1 recorded failure → `false` | — |
| **S1** | `fieldSearch.ts` + `calendarDateFromFields`; rewire `parseCalendarDateValue` and `dateFromEthiopicFamilyFields` | `isValidCalendarDate("279517-10-11[u-ca=hebrew]") === true` | — |
| **S2** | G1/G2 grammar: regexes, `calendarDateParts`, `ethiopicFamilyDateParts`, `parseCalendarDateValue` sign handling | `convertDateToCalendar("1000-01-01", "taiwan") === "-0911-01-01[u-ca=taiwan]"` and it round-trips | **D-G1**, **D-ERA** (era token part only) |
| **S3** | `nonIsoArithmetic.ts` until (Surpasses guard + spec loops); rewire `diffDate`, `diffDateAsDuration` (no rounding options), `intervalLength*`, `intervalCount*` | `diffDateAsDuration("2566-08-31[u-ca=buddhist]", "2566-09-30[u-ca=buddhist]", "months") === "P30D"` | — |
| **S4** | add fallback; rewire `addDate`, `subtractDate`, `getStartOfNextDateUnit`, `intervalFromDurationDate`, `splitIntervalByUnitDate` | `addDate("276302-09-13[u-ca=buddhist]", {years: 1}) === "276303-09-13[u-ca=buddhist]"` | — |
| **S5** | zoned: `addToZoned` date part and `zonedUntil` seams → compat | `convertZonedToCalendar("279517-10-11T00:00:00+00:00[u-ca=hebrew][UTC]", "gregorian") === "+275760-09-13T00:00:00+00:00[UTC]"`, then zoned D6 row | concurrent zoned-difference/UTC tdd-dev work landed |
| **S6** | plain rounding context in `zonedWallClockDifference.ts` (§3.6.3); `diffDate*` with `smallestUnit`/`roundingMode` | D6 row with `{smallestUnit: "month", roundingMode: "halfExpand"}`; tester takes the value from CR | S5 |
| **S7** | `Duration` dispatch (`durationAs`, `normalizeDuration`, `compareDurations`) | `normalizeDuration("P40D", {largestUnit: "months", relativeTo: "279517-08-15[u-ca=hebrew]"}) === "P1M10D"` | S6 |
| **S8** | §9 decisions that choose a GMT-side change: D-BUD / D-IND / D-HEB / D-ERA emission | their §4.2 rows | the respective decision |
| **S9** | `scripts/temporal-compat.mjs` (`check`, `oracle`), `temporal-oracle.yml`, root scripts, `packages/gmt/README.md` calendar section (G1 grammar, era codes, far-past notes), `coding-standards.md` E1 grammar update, changeset (`fix`: D6/D7 change existing outputs) | `node scripts/temporal-compat.mjs check` prints D1 STILL NEEDED on 0.5.1 and exits 0 | S1–S7 |

**Shared helpers** (one place each): `floorDateForFields`, `isoForFields`, `lastDayOfMonth`,
`monthsInYearAt`, `monthCodeOrdinal` (`fieldSearch.ts`); `nonIsoDateSurpasses`,
`balanceNonIsoDate` (`nonIsoArithmetic.ts`). The `MIN_ISO` / `MAX_ISO` constants come from the
existing range constants in `internal/zonedWallClock.ts` / `isNearRangeEdge`. Do not add a third
copy.

**tester** then fills the §4.4 generated tables, and **finalizer** runs `pnpm compat`.

**Size estimate.**
- **New:** 6 files (`temporalCompat/` 5 + `scripts/temporal-compat.mjs`), plus 1 workflow, plus the
  promoted scan bodies.
- **Implementation:** about 12 new functions, ~700–900 lines including doc comments.
- **Tests:** ~4 new test files.
- **Changed:** ~22 source files (§3.7 table: 2 parse helpers, 2 regexes, 2 formatters, 4 plain
  calculate, 6 plain/zoned interval, 3 zoned wall-clock internals, `dateUnitHelpers`, and the
  diff functions), plus their existing test files gaining rows.

---

## 8. Risks

1. **ICU/CLDR differs between environments.**
   - Node 24.21 ships ICU4C 78.3; Chromium 152 uses ICU4X. They agree on every scanned read
     except Hebrew years ≤ 0 (D4) and buddhist pre-1582 (D2, where the polyfill uses ICU4C).
   - GMT users run on other Node versions (22 bundles ICU 78 too, 20 may differ), Deno, Bun
     (JavaScriptCore/ICU), and browsers.
   - **Authority:** spec, then test262, then native (Chromium), then oracle (§0). Test rows use only
     those, so an environment whose ICU is wrong fails the rows. That is intended: it is a
     visible, attributable failure.
   - CI runs Node only. The §4 rows that depend on ICU correctness in Node are all in-range reads
     that ICU 78 gets right. §9 D-HEB/D-BUD rows are the exception, and stay gated until decided.
2. **islamic-umalqura table range (AH 1300–1600).**
   - test262 `extreme-dates.js` also asserts non-approximated umalqura dates `1300-M01-1` and
     `1500-M12-30`.
   - ICU4C and ICU4X agreed at every stride sample, but the stride (99 991 days) steps over the
     table window.
   - tester adds those two T262 rows (`"ah", 1300` / `"ah", 1500`) and 20 CR daily reads across
     AH 1440–1450 before S1 lands. A mismatch there would be an owner decision, not a design change.
3. **Probe caching hides a later polyfill swap within one process.** Not realistic: the polyfill
   is imported once. Documented in `README.md`.
4. **Fallback cost.**
   - Only the D6/D7 until guard runs at ordinary dates (2–4 extra polyfill calls per non-ISO
     `until`), and only while those probes fail.
   - The search and add fallbacks run only after a polyfill throw (edges, or invalid input to
     `isValidCalendarDate`: one failed parse is at most ~64 reads).
   - tester should add one timing sanity row, not a benchmark: `isValidCalendarDate` on 1 000
     invalid hebrew strings under a generous bound.
5. **Concurrent edits.** `zonedWallClockDifference.ts` and `zonedWallClockOperations.ts` are being
   changed by the zoned difference/UTC tdd-dev run. S5–S7 are gated on it (§7). S0–S4 touch only
   plain files and the new module.
6. **Upstream `05ce7a3` fixes only the maximum edge (tdd-dev finding).**
   - Calendar work on **PlainDate** in this spec never goes through
     `GetNamedTimeZoneEpochNanoseconds`: fields→ISO, add and until are date-only, and the plain
     `relativeTo` context uses `GetUTCEpochNanoseconds`.
   - **Zoned** calendar arithmetic does go through it. `addZoned` / `subtractZoned` / `diffZoned` on
     calendar strings resolve the wall clock with `addToZoned` → `internal/zonedWallClock.ts`.
   - Therefore:
     - (a) S5 rows near the **minimum** in named zones still rely on GMT's existing wall-clock
       fallback, and must keep doing so after a release containing `05ce7a3`;
     - (b) §6.5 does not retire the `zonedWallClock` min-edge fallback on `05ce7a3` alone;
     - (c) `internal/zonedWallClock.ts`'s header comment ("Fixed on the polyfill's main branch by
       05ce7a3") overstates the fix. finalizer corrects it, and `upstream-issue.md` §A becomes
       "release + min-edge fix".
   - S5 min-edge zoned rows use `Etc/GMT+12` (§4.1) **and** one named negative-offset zone
     (`America/New_York`), so both paths are covered.
7. **D6 and D7 change existing outputs** (`diffDate` for month-end spans in every non-ISO
   calendar). This is a bug fix, and the changeset must say so. Any dox pages or skills quoting
   the old values must be updated by finalizer (`/tanstack-intent`, `apps/dox` calendar guides).
8. **The G1 grammar change is public.** Strings with a leading `-` that GMT previously rejected
   become valid. No previously valid string changes meaning, which is verified by the regex
   difference: only the optional sign is added.

---

## 9. Needs owner decision

Each item states what the rules allow, the trade-off, and the maintenance cost. Nothing gated
here is designed further until decided.

### D-G1 — signed calendar years in GMT's grammar (G1)

- **Recommended: fix (GMT's own bug; zero known bugs).** Negative years must be representable.
  Format options:
  - **(a)** `-` + |year| zero-padded to 4 (`-0911-01-01`, `-268058-11-04`). Mirrors today's unsigned
    4–6-digit rule.
  - **(b)** ISO 8601 expanded `±YYYYYY` whenever year < 0 or > 9999
    (`-000911-01-01`, `+279517-10-11`). This **changes** existing positive 5–6-digit outputs
    (e.g. `279517-10-11` → `+279517-10-11`).
- **Recommendation: (a).** Maintenance: none.

### D-ERA — japanese era codes (D8, G2)

- **Must do regardless:** G2, so today's `;era=japanese-inverse` output is parseable.
- **Choice for emission** under 0.5.1:
  - **(a)** Emit whatever the polyfill says (`japanese` / `japanese-inverse` now, `ce` / `bce` after the
    release). The string changes on upgrade: a behaviour change at removal, which the
    future-proofing rule forbids.
  - **(b)** Map `japanese`→`ce`, `japanese-inverse`→`bce` in `temporalCompat` while D8's probe
    fails. This matches spec and test262 now, with no change at removal. It owns two era names,
    but they are spec identifiers rather than CLDR data. Maintenance: delete on upgrade.
  - Input accepts both old and new codes either way (0.5.1 already accepts `ce` / `bce`).
- The README currently documents `;era=japanese`, so either choice updates it.
- **Recommendation: (b).**

### D-BUD — buddhist before 1582-10-15 (D2)

- Cannot be fixed from polyfill reads: every pre-1582 read in 0.5.1 is the Julian hybrid.
- **Options:**
  - **(a)** Derive buddhist fields as "ISO month/day, year = ISO year + offset". The offset is
    measured at runtime from a post-1582 polyfill read. The rule is stated in the Intl proposal
    table (§0) but still a calendar rule in GMT. Active only while the D2 probe fails.
    Maintenance: delete on upgrade to a release with `2bb6ba1`.
  - **(b)** Return the sentinel for buddhist dates before 1582-10-15 until the release: a documented
    temporary range limit. Maintenance: on upgrade.
  - **(c)** Wait for the release and ship the known bug. This violates Core Rule 12.
- **Recommendation: (a),** because the rule is normative spec text, not data.

### D-IND — Indian before ISO year 1 (D5)

- All affected dates are also [G1].
- **Options:**
  - **(a)** Shift the ISO date by whole 400-year Gregorian cycles (146 097 days) into year ≥ 1,
    read, and shift the Indian year back. This owns the claim that Indian is Gregorian-periodic,
    which the proposal table does not state. Maintenance: delete on upgrade with `314b112`.
  - **(b)** Call `Intl.DateTimeFormat` directly and parse `Śaka` month names. This owns CLDR month
    names: rejected by the rules.
  - **(c)** Sentinel for indian ISO years < 1 until the release. Maintenance: on upgrade.
- **Recommendation: (c)**, unless the owner accepts (a).

### D-HEB — Hebrew years ≤ 0 (ISO before about −3760-09, D3 + D4)

- D3 alone is derivable from polyfill reads: count month starts from `M01` using `monthCode`
  reads. D4 is not: runtime ICU4C returns the wrong **day**. So no data-free GMT fix makes Node
  correct.
- Every affected date except year 0 is also [G1].
- **Options:**
  - **(a)** GMT-owned Hebrew arithmetic (Dershowitz–Reingold new-year + month lengths, ≈80
    lines), active while the D3 or D4 probe fails. This **owns calendar data**, against the
    constraint. Maintenance: none in practice (a fixed arithmetic rule); deleted only when both
    the polyfill (`0df570c`) and the floor Node ICU (`5267bb5778`) are fixed, i.e. **on Node/ICU
    updates**.
  - **(b)** Sentinel for hebrew years ≤ 0 while either probe fails. This is a documented range
    limit. Maintenance: **on Node/ICU updates**.
  - **(c)** Fix D3 data-free and accept D4's environment-dependent day. This violates Core Rule 12
    in Node.
- **Recommendation: (b).** It is the only option within both the no-data rule and zero known bugs.

### D-UPSTREAM — who carries the port

The fixes for D1, D3, D5 and D7 already exist in proposal-temporal. The owner files a port-and-release request (§2.9) with the diffs from §2.1–2.7. The GMT workarounds do not wait on it.
