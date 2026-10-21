# CORE-83 — Core: Why a stored zoned time no longer resolves

**Scope:** One function that takes a stored RFC 9557 string with an offset and a zone, such as `2026-12-01T09:00:00-08:00[America/Vancouver]`, and says whether it still names one instant under the host's time zone rules, and if not, every reading the caller could choose from.

## Gap

Applications store future events as an RFC 9557 string with both an offset and a zone. When the zone's rules change between writing and reading, the offset and the zone disagree. RFC 9557 §4.1 leaves resolving the disagreement to the reader; Temporal's `offset` option (`reject`, `use`, `ignore`, `prefer`) is the knob.

GMT reports the disagreement but not its cause: `toOffsetInstant` returns the sentinel, and the caller cannot tell a changed rule from a typo, or see what each reading would give. A local time can also fall into a gap or an overlap the new rules created.

Rule changes are frequent, and hosts lag them. IANA released 2026b, 2026c, 2026d and 2026e in 2026, each moving a future offset that takes effect on 2026-11-01. Node 24 and 26 carry 2026c and Node 22 carries 2025c (read from `process.versions.tz`).

([RFC 9557 §4.1](https://www.rfc-editor.org/rfc/rfc9557#section-4.1), [tzdb NEWS](https://data.iana.org/time-zones/tzdb/NEWS), [Temporal `offset` option](https://tc39.es/proposal-temporal/))

## Scope

- `packages/gmt/src/zoned/classify/classifyStoredZoned.ts`:
  - `classifyStoredZoned(value: string): StoredZonedClassification | null` — `value` is an RFC 9557 string with a UTC offset and a bracketed IANA zone. Returns a union discriminated by `kind`:
    - `valid` — the offset matches the zone at that local time; carries the instant.
    - `offsetMismatch` — the stored offset is not one the zone has at that local time; carries the stored offset, the zone's offset or offsets, and the instant each reading gives (stored offset kept; local time kept in the zone).
    - `nonexistent` — the local time falls in a gap under the zone's current rules; carries the `earlier` and `later` readings, as Temporal's `disambiguation` names them, and the instant the stored offset gives.
    - `ambiguous` — the local time occurs twice and the stored offset does not choose; carries the `earlier` and `later` readings and the instant the stored offset gives.
  - Returns the sentinel for anything that is not such a string.
- One value in, one result out. A batch is the caller's `map`.

## Tool

**Stored Time Audit.** Paste stored zoned strings, one per line, and see each one's kind and every reading it allows; a gap or overlap line draws the transition on a local-day strip, and a mismatched line draws the clock change since which the zone has held its offset. Calls `classifyStoredZoned`; `classifyLocal` is not called. Teaches: an offset stored next to a zone is a claim about the rules, and the rules can change.

## Design notes

- **Nothing is resolved silently.** The function reports every reading; the caller's policy picks one. The four Temporal `offset` values are each a choice among the readings returned, and the docs page shows which. Every kind but `valid` carries the instant the stored offset gives, so `offset: 'use'` needs no second parse.
- **The answer depends on the host's rules.** The same string can be `valid` on one host and `offsetMismatch` on another. The function page says so, and shows reading `process.versions.tz` on Node; browsers expose no equivalent. GMT pins no tzdb release.
- **Tests use rule changes every supported host already has**, never a change newer than Node 22's 2025c data. Candidates: Europe/Istanbul 2016, Africa/Casablanca 2018, America/Sao_Paulo 2019.
- **The kinds were counted from the permutations**: whether the offset matches, and whether the local time is unique, in a gap or in an overlap. The architect confirms the count before naming the union, per the no-catch-all rule.

## What gmt provides (do not re-implement)

- `classifyLocal` (`instant/convert/`) — unique, ambiguous or nonexistent for a wall time in a zone
- `toOffsetInstant` and `resolveLocal` (`instant/convert/`) — RFC 9557 parsing and resolution with a stated disambiguation
- `Disambiguation` (`types/disambiguation.ts`)

## Verification

- Each kind is reached, on both sides of each historical rule change above.
- Each of Temporal's four `offset` behaviours is reproduced from the readings returned.
- `offset: 'use'` in a gap and an overlap: `2026-03-08T02:30:00-03:00[America/Los_Angeles]` gives `2026-03-08T05:30:00Z` and `2026-11-01T01:30:00-03:00[America/Los_Angeles]` gives `2026-11-01T04:30:00Z`, neither of them an `earlier` or `later` reading.
- A gap in a 30-minute-offset zone (Australia/Lord_Howe) and in a 45-minute-offset zone (Pacific/Chatham).
- Sentinel rows: no offset, no zone, a bracketed offset instead of a zone, an unknown zone, basic format.
- Full matrix: CI's 10 zones × Node 22, 24 and 26.
- `pnpm run validate` stays green.

## Decisions

Settled while building the story (2026-10-21). The function's JSDoc and the `StoredZonedClassification` type are the full statement of each kind; these are the choices that shaped them.

- **Five kinds, not four (D1; owner).** An overlap where the stored offset picks one reading is its own kind, `validInOverlap`. It carries `earlier` and `later` as well as `instant`, because `offset: "ignore"` in `2026-11-01T01:30:00-08:00[America/Los_Angeles]` gives `08:30Z` while `reject` gives `09:30Z`. A `valid` that held only the instant could not reproduce `ignore`. The kinds come from two questions: does the stored offset match a candidate instant, and does the local time have one, two or no candidates (a gap with a match cannot happen).
- **Every kind carries `atStoredOffset` (D2; owner).** `valid` included. It is the instant `offset: "use"` gives, the written wall clock minus the written offset. It differs from `instant` for a minute-rounded match, such as `1960-01-01T00:20:00-00:45[Africa/Monrovia]`, so `use` needs no second parse.
- **Every reading is a `Z` instant string, every offset `±HH:MM[:SS]` (D3; owner).** Readings are `Temporal.Instant#toString()`, as `resolveLocal` returns. Offsets come from `formatUtcOffset`.
- **`Z[zone]` is `valid` and `-00:00[zone]` is a numeric offset (D4).** Temporal reads `Z` as exact, and RFC 9557 §3.4 Figure 2 does not call it inconsistent, so it is `valid` even inside a gap or an overlap. Temporal reads `-00:00` as a numeric zero offset (§6.5.2), and it outranks RFC 9557's reading of `-00:00` as `Z`, so that string can be `offsetMismatch`.
- **The sentinel is `null` (D5).** It covers: no offset, no zone annotation, a bracketed offset in place of a zone (Temporal accepts it, GMT does not), an unknown zone, basic format, an offset finer than a second, a calendar other than `iso8601`, second 60, a stored reading past the instant range, and the local date −271821-04-19, which a zoned read refuses. The function never throws.
- **The function does not read `process.versions.tz` (D6).** The JSDoc says the answer depends on the host's rules and shows the caller how to read the release on Node. Browsers expose none. GMT pins no tzdb release.
- **`writtenOffset` moves to `internal/utcOffsetString.ts` (D7).** Its behaviour does not change, and `toOffsetInstant` imports it. Slicing the offset digits a second time is not allowed.
- **The function lives at `zoned/classify/` (D8)**, a new subpath with the full wiring: `package.json` `exports` and `typesVersions`, the `zoned` barrel and the Dox module list. A verb folder like the other `zoned/` folders; `zoned/validate/` returns booleans, and this returns readings.
- **The same primitives as `classifyLocal` and `resolveLocal`.** `classifyWall` now also returns `latest`, and a new `isWithinIsoDaysRange` in `internal/zonedWallClock.ts` supports the range check. The temporalCompat corrections stay in force: an offset written with seconds matches exactly (probe D12), and a minute-rounded offset matches by minutes.
- **The `offset` table is the contract, and the tests enforce it.** For every expected row, all 16 pairs of `offset` and `disambiguation` equal `zonedDateTimeFrom(value, { offset, disambiguation })`, or throw where the table says "refused". The matrix reuses `sameInstantBattleCases` and `localNoonBattleCases`, so there is no literal zone table. Tests use only rule changes that Node 22's 2025c data already has (Istanbul 2016, Casablanca 2018, Sao Paulo 2019). The issue's Vancouver string appears in prose only.
- **The oracle skips one cell: `Z` with `offset: "ignore"` (owner, 2026-10-21).** TC39 §6.5.1 reads a `Z` string as exact under every `offset` value. Polyfill 0.5.1 and V8 13.6 apply `ignore` first and read the wall clock in the zone: `2022-07-08T00:14:07Z[Europe/London]` gives `2022-07-07T23:14:07Z`. The function follows the specification, and the test's comment cites the clause.
- **Backlog finding B (pre-existing, not part of this story).** `zonedDateTimeFrom` diverges from the specification for `Z` with `offset: "ignore"`, inherited from polyfill 0.5.1. `calendarSystemOfZonedValue` is affected at the range edge. It is not fixed here.
- **The Stored Time Audit never calls `classifyLocal`.** The kind that `classifyStoredZoned` returns already says unique, overlap or gap, and a second call would give a second source for one answer. A gap or an overlap draws a day strip; a mismatch draws a since strip. See `context/dox/built.md` for the tool's own decisions.
- **Upstream.** The −271821-04-19 refusal is filed as tc39/proposal-temporal#3331 (the function follows the spec, so it needs no workaround), and the El_Aaiun transition stall that D13 guards is filed as #3332.

