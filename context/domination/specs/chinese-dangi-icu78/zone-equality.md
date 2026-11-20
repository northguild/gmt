# Phase 3.3 — two zone names are one zone only when the names match; D19 deleted

Read with [index.md](index.md). Replaces `internal/temporalCompat/timeZoneEquals.ts` (D19) with a
name rule that needs no host `Temporal` and no zone data.

## Today (measured)

`timeZoneEquals` asks the polyfill, and where the D19 probe fails it resolves the ECMA-402 UTC
names itself and then asks `globalThis.Temporal`. That routes to the host's Temporal, which the
owner has ruled out, and still gives three answers:

| `areZonedEqual` pair, same instant | Node, Chromium | WebKit with native Temporal | WebKit without (Safari 27) |
| --- | --- | --- | --- |
| `Asia/Calcutta` / `Asia/Kolkata` | true | true | false |
| `Europe/Kiev` / `Europe/Kyiv` | true | true | false |
| `US/Eastern` / `America/New_York` | true | true | false |
| `UTC` / `Etc/UTC`, `GMT`, `Etc/GMT` | true | true | true |
| `utc` / `UTC` | true | true | true |

`timeZoneId` itself is identical on every host (the identifier as written, case-normalized). The
host differences are only in TimeZoneEquals, which needs a Link's primary identifier, and no API
gives that on every host: WebKit returns names as written (Time Zone Canonicalization proposal,
Stage 3).

## The rule (GMT rule; Open question 6)

Two zones are one when their `timeZoneId`s are equal after ASCII lower-casing, or when both are in
the set ECMA-402 §6.5.1 resolves to `"UTC"` by name (`UTC`, `Etc/UTC`, `Etc/GMT`, `GMT`: the last
step of AvailableNamedTimeZoneIdentifiers). Any other pair is two zones. This departs from Temporal
TimeZoneEquals (ECMA-262 Temporal, which compares primary identifiers) for Links only, and it is
the one answer every host can give without GMT owning link data.

## Design

New file `packages/gmt/src/internal/zoneNamesEqual.ts`:

```ts
/**
 * Whether two zoned values are in one time zone by name: the same identifier ignoring ASCII case,
 * or two of the names ECMA-402 §6.5.1 resolves to "UTC". A Link and its Zone are two zones on
 * every host (GMT rule: no API names a Link's primary on every host, and GMT owns no link data).
 *
 * @example zoneNamesEqual(utc("UTC"), utc("Etc/UTC")) // true
 * @example zoneNamesEqual(at("Asia/Calcutta"), at("Asia/Kolkata")) // false
 */
export function zoneNamesEqual(one: Temporal.ZonedDateTime, two: Temporal.ZonedDateTime): boolean;
```

Body: ASCII-lower both `timeZoneId`s (the same fold as `refusedZoneNames.ts`; export one
`asciiLower` from there, or put it in a small shared helper, never two copies), map `etc/utc`,
`etc/gmt` and `gmt` to `utc`, compare. No `try`, no Temporal call, no cache.

### Callers

| Site | Change |
| --- | --- |
| `isCalendarDifferenceAcrossZones` (`internal/zonedWallClockDifference.ts:132`) | `return !zoneNamesEqual(one, two);`; JSDoc: drop the Calcutta/Kolkata sentence, name the GMT rule |
| `zonedUntil` (`zonedWallClockDifference.ts:151`) | `inSameZone` uses `zoneNamesEqual`. **And at the top:** when `zoneNamesEqual(one, two)` and the ids differ, rebind `two = two.withTimeZone(one.timeZoneId)` before any path runs |
| `areZonedEqual.ts:45` | `zoneNamesEqual` |
| `areZonedEqualBy.ts:98` | `zoneNamesEqual` |
| `formatZonedRange.ts:275` | `zoneNamesEqual` |
| `mapZonedDatesInRange.ts:76` | `zoneNamesEqual` |

**Why the rebind is required.** The polyfill's `until` and `since` run TimeZoneEquals for a
calendar `largestUnit` and throw `RangeError` when it is false. On WebKit without native Temporal
the polyfill answers false for `UTC` and `Etc/UTC`, so a pair GMT calls one zone would throw
there and return a value elsewhere. `untilAtLimit` (the spec path) gets the rebound value too.
`inTimeZone` at line 189 already converts `two` to `one`'s zone for the final call; the rebind
makes every earlier path agree with it. `tdd-dev` greps for any other zoned `until`/`since` with
two caller values (`grep -rn "\.until(\|\.since(" packages/gmt/src --include='*.ts'`); found sites
get the same rebind and a row here.

### Deleted (D19)

- `internal/temporalCompat/timeZoneEquals.ts` and `timeZoneEquals.test.ts`.
- Its exports in `temporalCompat/index.ts` (lines 20, 34–36).
- `isTimeZoneEqualsCompatNeeded` (`capabilities.ts:203`) and its row at `capabilities.test.ts:604`.
- `d19Repros` and `"D19"` in the probe `DefectId` union (`probeRepros.ts:34`, `:817–841`), and
  `"D19"` in the file header (line 6: "D10-D19" becomes the list without it).
- `src/test/linkZones.ts` and `export * from "./linkZones"` (`src/test/index.ts:8`).
- README: Workarounds row D19 (63), trigger row (209) and removal step 19 (316), deleted outright.
  The README already skips a retired id (there is no D20 and no step 20); the other step numbers
  stay as written, and `D19` is never reused.
- `scripts/lib/workarounds.mjs` D19 entry (line 239). Check `pnpm compat` and the canary tests
  still pass with no D19 group: `reportedUnknownRepros` must not see a D19 repro.
- `WHAT_BREAKS.D19` (`apps/dox/src/data/temporal-compat.ts:266`) and the D19 row in
  `temporal-compat.json` (the owner regenerates it after the build).
- Any native-suite tag matching a D19 test title.

## JSDoc

`areZonedEqual.ts` bullet at line 12 becomes: "Two names of one time zone are equal when they are
the same name in any letter case, or both are `UTC`, `Etc/UTC`, `Etc/GMT` or `GMT` (ECMA-402
§6.5.1). Any other two names are two zones on every host, including an IANA link and its target
(`Europe/Kiev` and `Europe/Kyiv`): no runtime API gives a link's target on every host." Add
`@example areZonedEqual("2024-01-01T05:30:00+05:30[Asia/Calcutta]", "2024-01-01T05:30:00+05:30[Asia/Kolkata]") // false (a link and its target are two names)`.
The same sentence in `areZonedEqualBy`, `formatZonedRange`, `mapZonedDatesInRange`, `diffZoned`,
`diffZonedAsDuration` and `intervalLengthZoned` where their JSDoc mentions one zone or two zones.

`context/coding-standards/calendar-and-zones.md`: add a rule under § Calendar & zone semantics:
"Zone equality is by name: the same identifier ignoring ASCII case, or two of ECMA-402 §6.5.1's
UTC names. Never ask Temporal or the host whether two names are one zone." Compat README rule 1:
add that no GMT path reads `globalThis.Temporal` (D19 was the last).

## Tests

Pair table, every row both ways round, on every host (no host branch):

| Pair | `zoneNamesEqual`, `areZonedEqual` |
| --- | --- |
| `UTC` / `Etc/UTC`; `UTC` / `GMT`; `UTC` / `Etc/GMT`; `GMT` / `Etc/GMT` | true |
| `utc` / `UTC`; `america/new_york` / `America/New_York` | true |
| `+05:30` / `+0530` | true |
| `Asia/Calcutta` / `Asia/Kolkata`; `Europe/Kiev` / `Europe/Kyiv` | false |
| `US/Eastern` / `America/New_York`; `Etc/UCT` / `UTC` | false |
| `UTC` / `+00:00`; `Etc/GMT+0` / `UTC` | false |

| File | Rows |
| --- | --- |
| `internal/zoneNamesEqual.test.ts` (new) | the pair table |
| `zoned/compare/areZonedEqual.test.ts:102` | the link `describe` asserts `false` for both pairs; drop `linkPairIsOneZone`; its comment names the GMT rule |
| `zoned/compare/areZonedEqualBy.test.ts:279` | the same: link pairs are two zones, so the clock labels decide; expected values written out |
| `zoned/calculate/diffZoned.test.ts`, `diffZonedAsDuration.test.ts`, `zoned/interval/intervalLengthZoned.test.ts` | for each true pair, a `day` unit gives a value (1 day for one day apart) on every host, including WebKit without native Temporal; for each false pair, `day` gives the sentinel and `hour` gives a value |
| `zoned/format/formatZonedRange.test.ts`, `zoned/map/mapZonedDatesInRange.test.ts` | one true pair and one link pair each, written-out expected values |

Run on Node 22, 24 and 26 and in WebKit and Chromium; the link rows change on Node and Chromium
(true becomes false) and must be stated in the changeset.

## Authority

| Rule | Source |
| --- | --- |
| TimeZoneEquals compares primary identifiers | ECMA-262 Temporal, TimeZoneEquals |
| `Etc/UTC`, `Etc/GMT`, `GMT` resolve to `UTC` by name | ECMA-402 §6.5.1, last step of AvailableNamedTimeZoneIdentifiers |
| Identifiers match ignoring ASCII case | ECMA-402 §6.5.1 (GetAvailableNamedTimeZoneIdentifier) |
| A Link and its Zone are two zones in GMT | **GMT rule** (owner's rule): no host-independent primary exists without link data |
