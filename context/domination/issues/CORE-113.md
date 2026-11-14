# CORE-113 — Core: Validators and readers accept text after a valid date or time

**Scope:** Every public function accepts exactly its own input kind, over the whole string. Each
kind has one exact pattern, and an unusual format gets its own exact reader. Adds no library
function. Tracked as #528.

## Gap

The shared `isoStringBody` check read only the text before the first `[`, and Temporal's own
parsers read the rest. Any annotation Temporal accepts therefore reached functions that take no
annotation: `isValidDateTime("2024-02-29T12:34:56[Europe/Helsinkiddddd]")` returned `true`, and
plain, UTC and instant functions read zone brackets, calendar annotations and elective `[foo=bar]`
keys. The same class showed up in other readers: `relativeTo` property bags that Temporal clamps,
lower-case duration designators, non-string locale arguments that `Intl` coerces, an unknown
name-width style that fell back to long names, a catch-all `hasSecond60` pattern, and one offset
reader that took two kinds.

## Scope

- **The whole class, in one PR.** Every validator, parser and reader in `packages/gmt/src`.
- **A value the types reject returns the sentinel.** No coercion, no fallback.
- **Every test row added for a refused input is written out by hand.**

## Decisions

- **One exact pattern per kind, over the whole string.**
  - Plain date, time, date-time, year-month and month-day take no annotation.
  - UTC is exactly `<date>T<time>Z`.
  - An instant is `Z` or `±HH:MM[:SS[.fraction]]`, with nothing after it.
  - Zoned is the body plus one zone bracket. A critical flag (`[!Zone]`) and an offset bracket
    (`[+02:00]`) are allowed.
  - Calendar-aware is the body plus at most one `u-ca` annotation.
- **A zone bracket follows RFC 9557 §4.1.** It holds a zone name (parts start with ALPHA, `.` or
  `_`, then ALPHA, DIGIT, `.`, `_`, `-` or `+`, joined by `/`) or an extended offset `±HH:MM`
  (RFC 3339 §5.6). Basic (`+0200`) and hour-only (`+02`) bracketed offsets are rejected.
- **Temporal's leniency is not copied.** `Temporal.*.from` accepts annotations a kind does not
  take; GMT checks the shape first and calls Temporal only on a string that passed.
- **Each deliberate leniency has its own anchored pattern**, never a shared catch-all: RFC 3339
  `t`, `z` and space; RFC 5322 comments and folding whitespace; PostgreSQL hour-only offsets in
  `parseSqlOffsetDateTime`; HL7 extra components (§2.6.2) and reduced precision; FHIR and TCG leap
  seconds checked against the leap-second table; the ISO 8601 decimal comma; Unix epochs as
  `-?\d+`; calendar ids case-insensitive (BCP 47).
- **Functions that take two kinds read each with its own exact reader.** `dwellTime`,
  `scheduleDelivery`, `multimodalETA`, `transitTime`, `nextDeparture` and `toOffsetInstant` take an
  instant or a zoned string; `readExactMoment` is the shared two-kind reader.
- **Cut-offs.** The `cutoff` argument of `isPastCutoff` and `timeToCutoff` is the zoned string
  `cutoffAt` writes, offset bracket included; `now` is an instant.
- **`relativeTo` is a string only**, plain or zoned as above, with at most one `u-ca` annotation.
  `DurationRelativeTo` is `string`. A `Temporal` object or a property bag returns the sentinel.
- **Duration designators are upper case only**, as ISO 8601-1 writes them. The decimal comma stays.
- **Locale arguments** are `undefined`, a string or an array of strings. Anything else returns the
  sentinel. An unknown name-width style returns `[]`.
- **String-typed options and record fields are `typeof "string"`.** A `String` object is refused.
- **`hasSecond60`** is true only when the whole string is one of GMT's own kinds with a second of
  `60`.
- **`set*` functions keep their documented `Temporal.*Like` bags.** Those are their input kind.
- **Breaking changes ship in a patch.** Users are internal. No compatibility shim or deprecation.
