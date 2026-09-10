# CORE-4 — Core: Offset-preserving instants and local-time resolution

**Scope:** The instant-plus-original-offset pair that every logistics, clinical and event-sourcing standard stores, and the explicit resolution of local wall times that carry no zone.

## Gap

GMT can represent an instant and it can represent a zoned datetime, but it has no primitive for the shape the world actually exchanges: an absolute instant **plus** the local UTC offset that was in force where the event happened. Neither field derives from the other, and both are load-bearing — the instant orders events globally, the offset renders them as the human on the ground saw them.

Separately, feeds routinely deliver a local wall time with no offset at all ("gate-out 08:00"), and resolving one requires a zone the sender did not send, plus a policy for wall times that are ambiguous or do not exist.

## Scope

- `packages/gmt/src/instant/convert/toOffsetInstant.ts`:
  - `toOffsetInstant(isoString: string, timeZone?: string): { instant: string, offset: string, timeZone?: string } | null` — Splits a zoned string into the two-field pair. `offset` is `±HH:MM`.
  - `fromOffsetInstant(value: { instant: string, offset: string }): string` — Renders the pair back to a local-time string with its original offset.
- `packages/gmt/src/instant/convert/resolveLocal.ts`:
  - `resolveLocal(localDateTime: string, timeZone: string, options?: { disambiguation?: 'compatible' | 'earlier' | 'later' | 'reject' }): string` — Resolves a zoneless wall time against a zone. Defaults to `'compatible'`, matching Temporal.
  - `classifyLocal(localDateTime: string, timeZone: string): 'unique' | 'ambiguous' | 'nonexistent' | null` — Reports which case a wall time falls into **before** resolving it, so callers can branch rather than silently accept a policy.

## Why two fields

| Standard | Instant field | Offset field |
| --- | --- | --- |
| GS1 EPCIS 2.0 | `eventTime` (UTC) | `eventTimeZoneOffset` — required, so the event can be shown in the local time where it occurred |
| DCSA Track & Trace | `eventDateTime` | Carried in the timestamp, alongside an `eventClassifierCode` of planned / estimated / actual |
| UN/EDIFACT DTM | Qualifier `102` / `203` (no offset) | Qualifier `303` / `304` (`CCYYMMDDHHMMZZZ` / `CCYYMMDDHHMMSSZZZ`) |
| DICOM | `DT` value | `&ZZXX` suffix |

Sources: [OpenEPCIS](https://openepcis.io/docs/epcis/), [UNECE DTM](https://service.unece.org/trade/untdid/d03a/trsd/trsddtm.htm), [DCSA](https://dcsa.org/standards/track-and-trace/standard-documentation-track-and-trace).

## Design notes

- **An offset is not a zone.** `-05:00` does not identify `America/New_York`. Store the zone for anything scheduled in the future; store the offset for anything that already happened. The pair carries both when both are known, and `timeZone` stays optional because most feeds do not send it.
- **Ambiguous and nonexistent wall times are the single most common datetime bug.** 01:30 occurs twice on a fall-back day and never on a spring-forward day. `classifyLocal` exists so realm code can refuse rather than guess — a demurrage clock or a medication window should not silently pick the earlier instant.
- Every realm function that accepts a local wall time routes through `resolveLocal` and states its disambiguation policy in JSDoc. This is a binding rule in the tracker's Definition of Done.

## What gmt provides (do not re-implement)

- `Temporal.ZonedDateTime.from` with its `disambiguation` option — the underlying behaviour
- `Temporal.ZonedDateTime.prototype.offset` — offset extraction. The spec first named
  `getZonedDateTimeFields`, which does not exist in GMT; the public accessors that do are
  `getZonedOffset` (a zoned string's own offset) and `getTimeZoneOffset` (a zone's offset at
  a given instant), both `zoned/`.
- `isValidTimeZone` — zone validation
- `isValidDateTime` — the zoneless `<date>T<time>` gate `resolveLocal`/`classifyLocal` use
- `internal/parseInstantNanoseconds` (CORE-1/CORE-2) — the one definition of an instant
  string GMT accepts, minus leap seconds and calendar annotations
- `convertPlainDateTimeToZoned` — the same local-to-zoned resolution, returning a zoned
  string at millisecond precision rather than an exact instant. See the outcome notes.

## Verification

- `toOffsetInstant` round-trips through `fromOffsetInstant` for zones with and without DST
- Offset is preserved across a DST boundary: two events an hour apart in `America/New_York` on a fall-back night yield different offsets for the same wall time
- `classifyLocal('2024-11-03T01:30:00', 'America/New_York')` returns `'ambiguous'`
- `classifyLocal('2024-03-10T02:30:00', 'America/New_York')` returns `'nonexistent'`
- `resolveLocal` with `'earlier'` and `'later'` returns instants one hour apart for the ambiguous case
- `resolveLocal` with `'reject'` returns the sentinel rather than throwing
- Full IANA timezone coverage
- `pnpm run validate` stays green

## Outcome (delivered)

Shipped as a new `instant/` namespace — `packages/gmt/src/instant/convert/` — holding
`toOffsetInstant` / `fromOffsetInstant` and `resolveLocal` / `classifyLocal`, plus one
internal module, one public regex pattern, a shared test fixture, and the README, skill, dox
and DST-guide updates. Decisions taken while building it:

- **One public function per file, so four files rather than the spec's two.** The spec put
  `fromOffsetInstant` inside `toOffsetInstant.ts` and `classifyLocal` inside
  `resolveLocal.ts`. No public source file in GMT exports two functions, and CORE-3 already
  made the same call for the `toNtpTimestamp` / `fromNtpTimestamp` pair. The dox generator
  emits a page per export either way, but the "Source" link on each page points at the file,
  and a page for `classifyLocal` linking to `resolveLocal.ts` reads as a mistake.
- **`resolveLocal` returns an instant, not a zoned string** — and that is the whole reason it
  is not a duplicate of `convertPlainDateTimeToZoned`, which already existed and already had
  the four `disambiguation` values. Two real differences justify both: `resolveLocal` is
  exact, where `convertPlainDateTimeToZoned` defaults to `smallestUnit: "milliseconds"` and
  silently drops a nanosecond wall time; and `resolveLocal` has no `offset` parameter,
  which is inert on this construction path and only ever confused callers. Delegating to
  `convertPlainDateTimeToZoned` and re-parsing was rejected for the same precision reason.
  Both functions' JSDoc names the other, and `docs/dst-disambiguation.md` routes between
  them.
- **`classifyLocal` compares the two disambiguated resolutions, not `getPossibleInstantsFor`.**
  Temporal removed the `TimeZone` object, so there is no possible-instants list to read. What
  works instead is that `"earlier"` and `"later"` diverge for both an overlap *and* a gap, and
  only the wall clock they land on tells the two apart: for an overlap both resolutions read
  back as the requested time, and for a gap neither does — `"earlier"`/`"later"` resolve a gap
  by moving off the requested time entirely. Equal instants mean `"unique"`.
- **`timeZone` overrides a bracketed zone rather than conflicting with it.** The argument
  names the zone the offset is read in; the instant is the same either way, and only the
  local rendering differs, so this is "re-express in Tokyo", not a contradiction. A string
  whose *own* offset contradicts its *own* bracketed zone is a contradiction, and returns
  `null` — validated even when the argument overrides the zone, because a self-inconsistent
  string is not a fact about anything.
- **A bracketed *offset* time zone yields no `timeZone` field.** Temporal accepts
  `"2024-07-15T12:00:00-04:00[-04:00]"` and reports its `timeZoneId` as `-04:00`, which the
  first cut passed straight into the `timeZone` field — a field documented as an IANA zone,
  filled with a value that names no place, in the one function whose central design note is
  that an offset is not a zone. Such a string now returns the offset-only pair, and nothing
  is lost: the bracket said only what the `offset` field already carries. The gate is
  `regex/utc-offset` against the canonicalised `timeZoneId`, not `isValidTimeZone`. Gating on
  the validator was the first fix and was too wide: its `timeZoneLike` regex requires a
  slash, so it would also have dropped the zone from `[EST5EDT]` and `[Zulu]`, which
  `isValidZonedDateTime` and the rest of `zoned/` accept. Temporal canonicalises every offset
  spelling (`[-0400]`, `[+05]`) to `±HH:MM`, so testing for one catches them all. The
  `timeZone` *argument* still gates on `isValidTimeZone`, as every zone argument in GMT does.
  `fromOffsetInstant` had to move with it: it gated `value.timeZone` on `isValidTimeZone`,
  so a pair `toOffsetInstant` produced from `"...[EST5EDT]"` would not render back, breaking
  the documented inverse. It now hands the identifier to Temporal and tests the
  canonicalised `timeZoneId` for an offset, the same predicate on the same value as its
  sibling.
- **`offset` is `±HH:MM:SS` where the zone was not on a whole minute.** `Africa/Monrovia` ran
  at `-00:44:30` until 1972. `Temporal.ZonedDateTime.prototype.offset` reports that truthfully
  while `.toString()` renders the RFC 9557-legal `-00:45`, so the pair takes the former:
  rounding would put it thirty seconds from the event it describes and break the round trip.
  Sub-second offsets, which ISO 8601 permits and `Temporal.Instant.from` parses, are rejected
  — no zone and no standard that stores this pair has ever used one.
- **A bracketed zone, not the string's offset, fixes the instant.** The first cut took the
  instant from `parseInstantNanoseconds` in every case, and the round trip was 30 seconds out
  for `Africa/Monrovia`: RFC 9557 caps a written offset at minutes, so Temporal writes
  `-00:45` for a real `-00:44:30`, and `Temporal.Instant.from` reads that literally while
  `Temporal.ZonedDateTime.from` resolves it against the zone's true offset. `toOffsetInstant`
  now takes the instant from the parsed `ZonedDateTime` whenever a bracket is present. For
  every other zone the two routes agree exactly — a mismatched offset has already thrown —
  so this only ever changes the sub-minute case. Covered for `Africa/Monrovia`,
  `Asia/Kolkata`, `America/Sao_Paulo` and `Pacific/Apia` at pre-1972 instants.
- **No offset digits are sliced by hand**, per the coding standards' prohibition. Two
  Temporal-only routes do the work in `internal/utcOffsetString.ts` and `toOffsetInstant`:
  an offset string is parsed by reading it as the offset half of an epoch-anchored instant
  (`1970-01-01T00:00:00-04:00` *is* `04:00Z`, so the epoch nanoseconds are the offset with
  its sign flipped), and a literal offset is recovered from a zoneless string as the
  distance between two wall clocks — the digits as written, via `PlainDateTime.from`, and
  the same instant read in UTC. The new `regex/utc-offset` pattern only ever proves shape.
- **Neither direction shifts an instant to reach a wall clock.** `PlainDateTime`'s range
  runs a day further either side than `Instant`'s, so a pair like
  `{ "+275760-09-13T00:00:00Z", "+14:00" }` names a local time that exists while the same
  digits read as UTC do not. Both functions first read the wall clock and then do the
  arithmetic on it: `fromOffsetInstant` adds the offset to a `PlainDateTime` rather than to
  the epoch nanoseconds, and `toOffsetInstant` subtracts two `PlainDateTime`s rather than
  parsing `${value}[UTC]`, which was the first cut and threw on the same inputs. Both cuts
  swallowed the outer 14 hours of the range as invalid input, and the second had a test
  asserting the sentinel — an expected value read off the implementation instead of off
  Temporal, exactly what the testing standards warn about.
- **Every RFC 9557 `[key=value]` annotation is refused, not just `[u-ca=...]`.**
  `isValidInstant` rejects only the calendar one, leaving Temporal to silently drop the
  rest per RFC 9557 §3.2 — the right default for a parser and the wrong one here, since an
  event tagged `[x-provenance=estimated]` is not the same fact as one without it and GMT
  has no way to know that it is not. `internal/hasKeyValueAnnotation.ts` is the gate; it
  matches a bracket containing `=`, so a bracketed zone (`[America/New_York]`,
  `[!America/New_York]`, `[-04:00]`) never does. This makes `instant/` deliberately
  stricter than `isValidInstant`, which is stated in the JSDoc. Widening
  `parseInstantNanoseconds` instead would have changed `toNanoseconds`, `spanNs` and
  `isValidInstant`, all shipped.
- **`fromOffsetInstant` renders the bracketed zoned string when the pair carries a
  `timeZone`**, and the offset-only form when it does not, so the round trip is lossless in
  both shapes. It also refuses a pair whose `offset` is not the zone's offset at `instant` —
  carrying both fields is only worth doing if a contradiction between them is visible.
- **New shared test fixture: `localDstEdgeBattleCases`** in `src/test/timeZoneMatrix.ts`. Per
  battle-test zone it derives, from the zone's own transition table, the midpoint of its 2024
  gap and of its 2024 overlap — half a shift in, so it lands inside the window for a 15-, 30-
  or 60-minute change alike. Hand-picking `02:30` does not: `Australia/Lord_Howe` shifts 30
  minutes at 02:00 and `Pacific/Chatham` an hour at 02:45, and `02:30` is an ordinary unique
  wall time in both. Nine of the twenty zones have a transition in 2024 and eleven do not,
  and the fixture nulls the latter so "every wall time here is unique" is asserted too. Every
  realm story that touches a local wall time will want this.
- **An explicit `null` `disambiguation` falls back to `"compatible"`**, matching `addZoned`
  and every other options-object in the library (`optionsArg?.x ?? default`). It is recorded
  in a test rather than left to chance. An unrecognised *value* returns the sentinel.
