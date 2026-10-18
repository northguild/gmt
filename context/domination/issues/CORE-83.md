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

**Stored Time Audit.** Paste stored zoned strings, one per line, and see each one's kind and every reading it allows; a mismatched row draws the transition behind it on the DST Inspector's local-day grid. Calls `classifyStoredZoned`, `classifyLocal`. Teaches: an offset stored next to a zone is a claim about the rules, and the rules can change.

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
