# IOT-101 — Decisions

Part of [IOT-101](../IOT-101.md).

Settled by the owner and folded from the library and Dox specs when the story closed. They are the
current rules for this code.

- **The offset is applied, never looked up.** `ptpToUtc` and `utcToPtp` use the `currentUtcOffset` the
  caller passes and do not read the leap-second table. Reproducing the receiver's reading is the point.
  The table answer is `fromTAI` (MAR-16) and `taiMinusUtc` (SPA-48); only the Dox tool compares against
  it, through the public `taiMinusUtc`.
- **No new grammar, no reference data, no loop.** `ptpToUtc` takes a record and `utcToPtp` reads its
  string through `parseInstantNanoseconds`, GMT's one instant reader. There is no `iot/data` subpath, no
  pattern in `regex/`, no complexity target and no bench row. Both functions make their Temporal calls
  through the existing cores, so `iot/` takes no scoped exception in `context/coding-standards.md`.
- **`utcToPtp` also refuses an instant before 1970-01-01T00:00:00Z** (owner decision). That keeps the pair
  inverse over their whole domains: without it, `utcToPtp("1969-12-31T23:59:59Z", 37)` would give
  `{ seconds: 36n, ... }`, which `ptpToUtc` then refuses.
- **`isValidPtpTimestamp` is a type predicate** (owner decision), as `isValidHolidayRule` is. It narrows
  `unknown` for the caller and is a subtype of the issue's `boolean`.
- **The record check is one function.** `isValidPtpTimestamp`, `ptpToUtc` and the check on `utcToPtp`'s
  output all call `readPtpTimestamp`, so they cannot disagree. `readProtoRecord`'s body moved into
  `readSecondsRecord(value, fractionMember)` and `readProtoRecord` is a thin wrapper, with its tests
  unchanged (owner decision).
- **A result past year 9999 is written in Temporal's expanded form** (`+010000-...`), with no cap, up to
  `+275760-09-13T00:00:00Z` (owner decision). `fromNanoseconds` does the same and
  `parseInstantNanoseconds` reads it back.
- **Seconds are 48 bits by derivation.** RFC 8877 §4.3 gives 80 bits in all and a 32-bit Seconds field in
  the truncated form, so the seconds take 80 − 32 = 48. The IEEE 1588 field is not reached.
- **The Dox site holds no PTP rule.** The PTP Clock Converter takes every value, refusal and reason from
  the library or a probe of it. The decisions are in `context/dox/built.md`, under PTP Clock Converter.
- **The IoT industry, glyph and hub text belong to the Dox build.** IoT owns `iot` and draws on
  `timescale` and `precision`. Its pages are tagged `iot` only. The root bundle budget in
  `scripts/bundle-size.budgets.json` rose from 647100 to 647800 bytes for the new realm.
