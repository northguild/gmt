# CORE-78 — Core: One check for a UTC timestamp in the plain RFC 3339 spelling

**Scope:** `isValidUtcTimestamp` is true for a UTC instant written as `YYYY-MM-DDTHH:MM:SS[.f]Z` and for nothing else. A string it accepts is plain RFC 3339, the form JavaScript's `Date`, databases and JSON clients in other languages are built to read. Each reader's own range and precision still apply.

## Gap

`isValidUtc` answers "can Temporal read this as a UTC instant?". A caller validating request input, or a value headed for storage, asks a narrower question: "will the next reader take this string too?".

`isValidUtc` accepts four forms outside RFC 3339 §5.6, which other readers do not all take:

- an RFC 9557 annotation: `2026-10-06T12:00:00Z[Europe/Paris]`
- a comma before the fraction: `2026-10-06T12:00:00,5Z`
- an expanded year: `-005000-01-01T00:00:00Z`
- a time without seconds: `2026-10-06T12:00Z`

Measured on `@northguild/gmt` 1.18.0, Node 24.21.0 and PostgreSQL 18.6, `TZ=UTC`:

| Value                                | `isValidUtc` | `rfc3339DateTime` | `new Date(value)`     | PostgreSQL, `::timestamptz`           |
| ------------------------------------ | ------------ | ----------------- | --------------------- | ------------------------------------- |
| `2026-10-06T12:00:00Z`               | `true`       | `true`            | 6 Oct 2026, 12:00 UTC | accepted                              |
| `2026-10-06T12:00:00Z[Europe/Paris]` | `true`       | `false`           | `Invalid Date`        | `invalid input syntax`                |
| `2026-10-06T12:00:00,5Z`             | `true`       | `false`           | `Invalid Date`        | `invalid input syntax`                |
| `-005000-01-01T00:00:00Z`            | `true`       | `false`           | 1 Jan -5000           | `time zone displacement out of range` |
| `2026-10-06T12:00Z`                  | `true`       | `false`           | 6 Oct 2026, 12:00 UTC | accepted                              |

`Date` and PostgreSQL both read the time without seconds. §5.6 requires seconds (`partial-time = time-hour ":" time-minute ":" time-second [time-secfrac]`), so a reader that follows the grammar rejects it.

The `rfc3339DateTime` pattern does not close the gap by itself: it checks the shape alone, so it matches 30 February. A caller has to pair `isValidUtc` with the pattern, and the second half is easy to leave out.

## Scope

- `packages/gmt/src/utc/validate/isValidUtcTimestamp.ts`:
  - `isValidUtcTimestamp(value: string): boolean` — `true` when `value` is a real UTC instant in exactly this shape:
    - a four-digit year, `0000` to `9999` (RFC 3339 §5.6, `date-fullyear = 4DIGIT`)
    - an upper-case `T`
    - a time with seconds
    - an optional fraction of one to nine digits after a dot (§5.6, `time-secfrac = "." 1*DIGIT`, with GMT's nine-digit cap)
    - an upper-case `Z`, and nothing after it
  - `false` for anything else, a leap second and a non-string included.
  - The body is `isValidUtc(value) && rfc3339DateTime.test(value)`.
- `packages/gmt/src/utc/validate/index.ts` exports it.
- `isValidUtc`'s JSDoc names the forms it accepts beyond this shape and points to `isValidUtcTimestamp`. `isValidUtc`'s behaviour does not change.
- No README section: the pointer for a string headed to storage or to a non-Temporal reader is in the docs guide below.

## Docs-site scope

- `guides/core-date-operations/validation.mdx`: a section "UTC timestamps for other readers" after the calendar-annotation example. It shows the four forms `isValidUtc` accepts and `isValidUtcTimestamp` does not, and points to `isValidRfc3339DateTime` for the other RFC 3339 spellings.
- `guides/integration/app-integration.mdx`, "Validate at boundaries": one request-input example.
- `guides/concepts/standards.mdx`: the RFC 3339 entry names the function.

## Design notes

- **A subset of `isValidUtc`.** Every string `isValidUtcTimestamp` accepts, `isValidUtc` accepts.
- **The name is RFC 3339's own noun.** RFC 3339 is titled "Date and Time on the Internet: Timestamps". RFC 9557, "Timestamps with Additional Information", defines the annotated form as an extension of it. This function accepts the bare RFC 3339 form.
- **The name does not say `Rfc3339`.** §5.6 also allows a lower-case `t` and `z`, a space between the date and the time (in its NOTE), and a numeric offset. This function rejects all four. `isValidRfc3339DateTime` is the check for the whole grammar, with the same two GMT limits.
- **`isValidUtc` proves the instant, the pattern narrows the shape.** `isValidUtc` rejects a day that does not exist, a leap second, a lower-case `t` or `z`, a space and a numeric offset. `rfc3339DateTime` rejects the annotation, the comma, the expanded year and the missing seconds. The function runs one Temporal parse and imports nothing outside `utc/` but the shared `regex/` patterns.
- **The shape is the one Temporal writes.** `Temporal.Instant.prototype.toString()` writes it for years `0000` to `9999`.
- **Year `0000` is valid.** RFC 3339 §1 counts years from `0000`, and Temporal and `Date` both read `0000-01-01T00:00:00Z`. A store's range is its own: PostgreSQL 18.6 has no year zero and rejects that string with `date/time field value out of range`.
- **Leap seconds are rejected**, as everywhere in GMT.
- **Not "canonical".** `12:00:00Z` and `12:00:00.000Z` are one instant spelled two ways, and both pass. The promise is plain RFC 3339, not one spelling.
- **Not "storable".** Range and precision depend on the store: PostgreSQL keeps microseconds, so it rounds `12:00:00.123456789Z` to `.123457`. `toPgMicroseconds` floors where PostgreSQL's text input rounds: `…123456n` against `.123457` for that string.
- **No framework code.** A validation decorator for a web framework is a companion package, not part of `@northguild/gmt`.

## Authority — what each rule rests on

| Rule | Source |
| --- | --- |
| Four-digit year, `0000` to `9999` | RFC 3339 §1; §5.6 `date-fullyear = 4DIGIT` |
| Upper-case `T` and `Z` only | RFC 3339 §5.6 NOTE: a specification using the syntax may require upper case, and generators should write it |
| Seconds required | RFC 3339 §5.6 `partial-time` |
| Dot fraction of at least one digit | RFC 3339 §5.6 `time-secfrac = "." 1*DIGIT` |
| At most nine fraction digits | **GMT rule.** Temporal keeps nanoseconds, so a tenth digit cannot be read |
| `Z` only, no numeric offset | **GMT rule.** The value is a UTC instant; RFC 9557 §2.2 states what `Z` means |
| A real calendar day | RFC 3339 §5.7 and Appendix C |
| No second `60` | **GMT rule.** Temporal reads `:60` as `:59` |
| Nothing after `Z` | RFC 9557 §4.1: the suffix is the extension, not RFC 3339 |
| `false` sentinel | [coding-standards § API Contract](../../coding-standards.md#api-contract) |

## What gmt provides (do not re-implement)

- `isValidUtc` — the instant is real, with an upper-case `T` and `Z`
- `rfc3339DateTime` — the RFC 3339 §5.6 shape, with GMT's nine-digit fraction cap and no second `60`
- `isValidRfc3339DateTime` / `parseRfc3339` — the whole RFC 3339 grammar with the calendar checked; unchanged
- `toPgMicroseconds` and the precision functions — range and precision for one store

## Verification

`true`:

- `2026-10-06T12:00:00Z`
- `2026-10-06T12:00:00.5Z`
- `2026-10-06T12:00:00.123456789Z` (nine fraction digits)
- `0000-01-01T00:00:00Z`
- `9999-12-31T23:59:59Z`
- `2024-02-29T00:00:00Z` (a leap day that exists)

`false`:

- `2026-10-06T12:00:00Z[Europe/Paris]` (time zone annotation)
- `2026-10-06T12:00:00Z[u-ca=gregory]` (calendar annotation)
- `2026-10-06T12:00:00,5Z` (comma)
- `-005000-01-01T00:00:00Z` and `+010000-01-01T00:00:00Z` (expanded years)
- `2026-10-06T12:00:00.1234567890Z` (ten fraction digits)
- `2026-10-06T12:00:00+00:00` and `2026-10-06T12:00:00+03:00` (an offset that is not `Z`)
- `2026-10-06t12:00:00z` (lower case)
- `2026-10-06 12:00:00Z` (space)
- `2026-10-06T12:00Z` (no seconds)
- `2026-10-06` (no time)
- `2026-02-30T00:00:00Z` (a day that does not exist)
- `2016-12-31T23:59:60Z` (leap second)
- a leading space, a trailing line break and the empty string
- anything that is not a string

And:

- Every string that is `true` for `isValidUtcTimestamp` is `true` for `isValidUtc`
- `pnpm run validate` stays green
