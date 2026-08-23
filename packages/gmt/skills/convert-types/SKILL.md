---
name: convert-types
description: >
  Convert between temporal types, unix time, and UTC representations. Use
  convertPlainDateTimeToZoned (with optional disambiguation for DST gaps/
  overlaps), convertZonedToPlainDateTime, convertUtcToUnix, and
  convertDateToCalendar to express a date in a non-Gregorian CalendarSystem
  (gregorian, hebrew, islamic-civil, islamic-tabular, islamic-umalqura,
  japanese, buddhist, taiwan, persian, indian, ethiopic, ethiopic-amete-alem,
  coptic).
sources:
  - 'burglekitt/gmt:packages/gmt/src/plain/convert/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/convert/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/unix/convert/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/utc/convert/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/types/calendar-system.ts'
metadata:
  type: core
  library: '@burglekitt/gmt'
  library_version: '1.14.0'
---

# Convert Temporal Types

Use this skill when you need to convert between different temporal representations.

## Setup

```ts
import { convertPlainDateTimeToZoned, convertZonedToPlainDateTime } from "@burglekitt/gmt/zoned";
import { convertUtcToUnix, convertUnixToUtc } from "@burglekitt/gmt/unix";
import { convertUtcToZoned, convertZonedToUtc } from "@burglekitt/gmt/utc";
```

## Core Patterns

### Convert plain to zoned datetime

```ts
import { convertPlainDateTimeToZoned } from "@burglekitt/gmt/zoned";

const zoned = convertPlainDateTimeToZoned("2024-03-15T14:30:45", "America/New_York");
// "2024-03-15T14:30:45[America/New_York]"
```

Twice a year, DST creates local times that don't exist (spring-forward gap) or happen twice (fall-back overlap). Pass `disambiguation` (`"compatible"` (default) | `"earlier"` | `"later"` | `"reject"`) to control resolution instead of silently guessing — see the [Zoned Date Operations skill](../zoned-date-ops/SKILL.md) for the full gap/overlap walkthrough:

```ts
convertPlainDateTimeToZoned("2024-03-10T02:30:00", "America/New_York", {
  disambiguation: "reject",
});
// "" — 2024-03-10T02:30:00 doesn't exist in America/New_York (spring-forward gap)
```

### Convert zoned to plain datetime

```ts
import { convertZonedToPlainDateTime } from "@burglekitt/gmt/zoned";

const plain = convertZonedToPlainDateTime("2024-03-15T14:30:45[America/New_York]");
// "2024-03-15T14:30:45"
```

### Convert UTC to Unix epoch (seconds)

```ts
import { convertUtcToUnix } from "@burglekitt/gmt/unix";

const unix = convertUtcToUnix("2024-03-15T14:30:45"); // 1710504645
```

### Convert Unix epoch to UTC (seconds)

```ts
import { convertUnixToUtc } from "@burglekitt/gmt/unix";

const utc = convertUnixToUtc(1710504645); // "2024-03-15T14:30:45"
```

### Convert UTC datetime to Unix milliseconds

```ts
import { convertUtcToUnixMs } from "@burglekitt/gmt/unix";

const unixMs = convertUtcToUnixMs("2024-03-15T14:30:45"); // 1710504645000
```

### Convert Unix milliseconds to UTC datetime

```ts
import { convertUnixMsToUtc } from "@burglekitt/gmt/unix";

const utc = convertUnixMsToUtc(1710504645000); // "2024-03-15T14:30:45"
```

### Convert zoned to UTC

```ts
import { convertZonedToUtc } from "@burglekitt/gmt/zoned";

const utc = convertZonedToUtc("2024-03-15T14:30:45[America/New_York]"); // "2024-03-15T19:30:45"
```

### Convert UTC to zoned

```ts
import { convertUtcToZoned } from "@burglekitt/gmt/utc";

const zoned = convertUtcToZoned("2024-03-15T14:30:45", "America/New_York"); // "2024-03-15T10:30:45[America/New_York]"
```

### Convert between timezones

```ts
import { convertZonedToZoned } from "@burglekitt/gmt/zoned";

const converted = convertZonedToZoned(
  "2024-03-15T14:30:45[America/New_York]",
  "Europe/London"
); // "2024-03-15T18:30:45[Europe/London]"
```

### Convert a date to a non-Gregorian calendar system

```ts
import { convertDateToCalendar } from "@burglekitt/gmt/plain";

const hebrew = convertDateToCalendar("2024-10-03", "hebrew");
// "5785-01-01[u-ca=hebrew]" — Rosh Hashanah 5785, calendar-native year/month/day

const back = convertDateToCalendar(hebrew, "gregorian");
// "2024-10-03" — round-trips back to a bare ISO string

const umalqura = convertDateToCalendar("2024-10-03", "islamic-umalqura");
// "1446-03-30[u-ca=islamic-umalqura]" — Saudi civil calendar

const buddhist = convertDateToCalendar("2024-10-03", "buddhist");
// "2567-10-03[u-ca=buddhist]" — fixed +543 year offset

const japanese = convertDateToCalendar("2024-10-03", "japanese");
// "0006-10-03[u-ca=japanese;era=reiwa]" — era-relative year, not proleptic 2024

const ethiopic = convertDateToCalendar("2024-10-03", "ethiopic");
// "2017-01-23[u-ca=ethiopic;era=ethiopic]" — era-relative year, not proleptic 7517

const coptic = convertDateToCalendar("2024-10-03", "coptic");
// "1741-01-23[u-ca=coptic]" — 13-month structure, own epoch (AD 284)
```

`CalendarSystem` is `"gregorian" | "hebrew" | "islamic-civil" | "islamic-tabular" | "islamic-umalqura" | "japanese" | "buddhist" | "taiwan" | "persian" | "indian" | "ethiopic" | "ethiopic-amete-alem" | "coptic"` today (extended by later Story Group E stories). The annotated string carries the target calendar's own year/month/day — not the ISO/Gregorian digits Temporal's own `[u-ca=...]` string convention keeps — so a Hebrew year like 5785 is visible directly in the string. A plain, unannotated string is always the `"gregorian"` calendar and works with every other GMT function unchanged.

Every calendar except the Ethiopic family (below) is resolved through Temporal's own built-in calendar support (`PlainDate.prototype.withCalendar`) — GMT ports no leap-year tables or arithmetic of its own, for Islamic or era-based solar calendars any more than for Hebrew. The three Islamic variants are **not interchangeable**: `"islamic-civil"` and `"islamic-tabular"` use different fixed leap-year cycles one day apart in epoch, and `"islamic-umalqura"` is a tabulated calendar (the Saudi civil calendar) that can diverge from both by more than a fixed offset on a given date — `convertDateToCalendar` never approximates one variant with another's math. Note that GMT's own id for the tabular variant, `"islamic-tabular"`, differs from Temporal's internal id for the same calendar (`"islamic-tbla"`); the annotated string always reads `[u-ca=islamic-tabular]` regardless.

`"buddhist"` and `"taiwan"` are fixed year-offset calendars over the same Gregorian day/month structure (`+543`, and reset-at-1912 respectively); `"persian"` and `"indian"` are distinct solar calendars with their own leap-year rules (Persian: a 33-year cycle; Indian: aligned to the Gregorian leap-year rule, not an independent one). `"japanese"` is the odd one out: Temporal's `.year` for it stays **proleptic** across imperial era changes rather than resetting the way the calendar's own numbering does, so `convertDateToCalendar` tags it with `.eraYear` and an era name instead of a plain year — `"0006-10-03[u-ca=japanese;era=reiwa]"`, not `"2024-10-03[u-ca=japanese]"`. GMT also does not reject pre-Meiji (before 1868-10-23) dates the way `@internationalized/date` does — Temporal resolves them under a synthetic `"japanese"` era and GMT passes that through rather than adding validation just to reproduce another library's gap.

`"ethiopic"`, `"ethiopic-amete-alem"`, and `"coptic"` share one 13-month structure (12 x 30-day months + a 5/6-day Pagume/Nasie 13th month) but differ in epoch, and are the **one exception** to "resolved through Temporal's native calendar support": `@js-temporal/polyfill` resolves these two calendars' year/era via `Intl.DateTimeFormat`-derived era-name matching, and that matching breaks under newer ICU versions (confirmed: every read/write of Temporal's `"ethiopic"`/`"coptic"` calendar ids throws under Node 24's ICU). GMT routes around this by reading/writing them through Temporal's `"ethioaa"` id instead (pure arithmetic, no era, unaffected by the bug — month/day are identical across the whole family) and computing each calendar's own year/era with GMT-owned arithmetic. `"ethiopic"` is era-based like `"japanese"` (resets at its own epoch, ~AD 8): `"2017-01-23[u-ca=ethiopic;era=ethiopic]"`, not a 5-digit proleptic year. `"ethiopic-amete-alem"` is the same calendar counted continuously from a much older epoch (~5493 BCE) and never resets: `"7517-01-23[u-ca=ethiopic-amete-alem]"` for the same date. `"coptic"` has its own epoch (AD 284, the Diocletian/Martyrs era) and a plain native year. See `internal/ethiopicFamilyCalendar.ts` for the implementation and full rationale.

## Common Mistakes

### HIGH Using Date.getTime() for conversion

Wrong:

```ts
const unix = new Date("2024-03-15T14:30:45").getTime() / 1000; // manual conversion
```

Correct:

```ts
import { convertUtcToUnix } from "@burglekitt/gmt/unix";

const unix = convertUtcToUnix("2024-03-15T14:30:45"); // proper conversion
```

Source: AGENTS.md — Never use Date APIs

### HIGH Mixing epoch seconds and milliseconds

Wrong:

```ts
const timestamp = 1710504645; // seconds
new Date(timestamp); // treats as milliseconds, wrong date
```

Correct:

```ts
import { convertUnixToUtc } from "@burglekitt/gmt/unix";

const timestamp = 1710504645; // seconds
const utc = convertUnixToUtc(timestamp);
```

Source: packages/gmt/src/unix/convert/convertUnixToUtc.ts — expects seconds

### MEDIUM Not handling conversion errors

Wrong:

```ts
const zoned = convertPlainDateTimeToZoned("invalid", "America/New_York");
// Assume zoned is always valid
process(zoned);
```

Correct:

```ts
import { convertPlainDateTimeToZoned, isValidTimeZone } from "@burglekitt/gmt/zoned";

if (!isValidTimeZone("America/New_York")) {
  throw new Error("Invalid timezone");
}
const zoned = convertPlainDateTimeToZoned("2024-03-15T14:30:45", "America/New_York");
if (!zoned) {
  throw new Error("Conversion failed");
}
```

Source: packages/gmt/src/zoned/convert/convertPlainDateTimeToZoned.ts — Returns "" on error

### MEDIUM Assuming a `[u-ca=...]` string means Temporal's own convention

Wrong:

```ts
// Assuming the digits are still the ISO/Gregorian year, like Temporal.PlainDate's own
// toString() would produce
const hebrew = convertDateToCalendar("2024-10-03", "hebrew"); // "5785-01-01[u-ca=hebrew]"
const year = hebrew.slice(0, 4); // "5785" is the Hebrew year, NOT 2024 — don't assume ISO digits
```

Correct: treat the annotated string as GMT's own format (calendar-native fields, produced/consumed only by `convertDateToCalendar`) — never hand-parse it or assume it matches `Temporal.PlainDate.prototype.toString()`'s own `[u-ca=...]` output, which keeps the ISO digits and only tags the calendar. Round-trip it through `convertDateToCalendar` itself instead of extracting fields manually.

Source: packages/gmt/src/plain/convert/convertDateToCalendar.ts — see JSDoc for the full rationale

### MEDIUM Assuming `"japanese"`'s annotated year is proleptic like every other calendar

Wrong:

```ts
// Assuming the year digits are the ISO/Gregorian year, the way "buddhist"/"taiwan"'s
// digits are always a fixed transform of it
const japanese = convertDateToCalendar("2024-10-03", "japanese");
// "0006-10-03[u-ca=japanese;era=reiwa]" — "0006" is year 6 of the Reiwa era, NOT 2024
const gregorianGuess = 2024 - Number(japanese.slice(0, 4)); // wrong: not how eras work
```

Correct: `"japanese"` (and, separately, `"ethiopic"` — see below) is tagged with an era-relative `eraYear` plus an `;era=<name>` tag instead of a plain native year — Temporal's own `.year` for this calendar stays proleptic across era changes, so a plain year would silently misrepresent it. Round-trip through `convertDateToCalendar(value, "gregorian")` instead of computing the ISO year by hand.

Source: packages/gmt/src/internal/calendarDateString.ts — see JSDoc for why "japanese" is tagged differently

### MEDIUM Assuming `"ethiopic"`'s annotated year is a fixed offset like `"ethiopic-amete-alem"`/`"coptic"`

Wrong:

```ts
// Assuming "ethiopic" digits are a fixed transform of the ISO year, the way its siblings'
// digits are
const ethiopic = convertDateToCalendar("2024-10-03", "ethiopic");
// "2017-01-23[u-ca=ethiopic;era=ethiopic]" — "2017" is era-relative, not a fixed offset
const wrongGuess = Number(ethiopic.slice(0, 4)) + 5500; // wrong once the era switches
```

Correct: `"ethiopic"` resets to a new era (Amete Mihret) at its own epoch (~AD 8) and is tagged with `eraYear` + `;era=<name>`, exactly like `"japanese"`. `"ethiopic-amete-alem"` is the same calendar counted continuously with no era reset, so its year _is_ a fixed +5500ish transform of `"ethiopic"`'s eraYear — but only once you're past the era boundary. Round-trip through `convertDateToCalendar(value, "gregorian")` rather than computing it by hand.

Source: packages/gmt/src/internal/ethiopicFamilyCalendar.ts — also documents why this family is computed with GMT-owned arithmetic instead of Temporal's native `"ethiopic"`/`"coptic"` calendar ids (an ICU-version compatibility bug in `@js-temporal/polyfill`)

## References

- [Full convert API](references/convert-api.md)
- [Unix epoch wikipedia](https://en.wikipedia.org/wiki/Unix_time)
- [IANA timezone database](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)