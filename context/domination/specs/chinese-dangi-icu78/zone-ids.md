# Phase 3.1 — D35: nine zone names refused on every host

Read with [index.md](index.md). Model: D33 ([gate.md](gate.md)), an unconditional refusal with
canary-only repros. The names are refused as input everywhere a zone name enters GMT; every
public function returns the sentinel it returns for `"Not/AZone"`.

## The defect (measured)

| Name | Node 22/24/26 | Chromium 153 | WebKit 26.6 Linux | Safari, macOS 27 | Safari, macOS 26 |
| --- | --- | --- | --- | --- | --- |
| `CST6CDT`, `EST5EDT`, `MST7MDT`, `PST8PDT` | accepted, kept as written | accepted, resolved to `America/Chicago`, … | refused | refused | accepted |
| `CET`, `EET`, `MET`, `WET` | accepted | accepted | refused (native-suite tag `webkit-legacy-zone-ids`) | accepted | accepted |
| `Factory` | refused | accepted | refused | refused | not measured |

Node keeps `EST5EDT` as its own zone (tzdata 2026e), while Chromium resolves it to
`America/New_York` (older tzdata), so even the hosts that accept the System V names disagree before
1967. WebKit's cause is `isValidTimeZoneNameFromICUTimeZone` in
`Source/JavaScriptCore/runtime/IntlObject.cpp`: it drops every name without a `/` except `UTC`
and `GMT`, so a slash-less name survives only where the host's data makes it a Link to a slashed
zone.

"Accepted" means both `new Intl.DateTimeFormat("en", { timeZone })` and
`Temporal.ZonedDateTime.from("2024-07-15T12:00:00[<name>]")` succeed. On WebKit without native
Temporal the polyfill reads zone validity from `Intl`, so the two agree on every host measured.
Today `isValidTimeZone("EST5EDT")` is `true` on Node and `false` on Linux WebKit: one call, two
answers.

Their data also differs by tzdata version: tzdb 2024b made all eight Links (to
`America/Chicago`, `Europe/Brussels`, …), and 2026d made the four System V names Zones again with
new pre-1967 data (`backward`, Eggert's comment: "ahistorical… pretend standard time extends
backward indefinitely"). `Factory` is a Zone in the `factory` file, which a distributor may leave
out. Mapping any of them to a host-independent answer is GMT owning zone data.

Names that stay accepted (hosts agree, measured): `EST`, `MST`, `HST`, `US/Eastern`, `GMT0`,
`UCT`, `Zulu`, `Japan`, `Etc/GMT+5`, `Asia/Calcutta`.

## Design

New file `packages/gmt/src/internal/refusedZoneNames.ts`:

```ts
/**
 * Zone names GMT refuses on every host (compat D35): hosts accept or refuse them by engine and
 * OS version, and tzdata versions give them different data. Lower case, for ASCII-case-insensitive
 * matching (ECMA-402 §6.5.1 matches identifiers ignoring ASCII case).
 */
const REFUSED_ZONE_NAMES: ReadonlySet<string> = new Set(["cet", "cst6cdt", "eet", "est5edt",
  "factory", "met", "mst7mdt", "pst8pdt", "wet"]);
/**
 * @example isRefusedZoneName("EST5EDT") // true
 * @example isRefusedZoneName("est5edt") // true
 * @example isRefusedZoneName("EST") // false
 */
export function isRefusedZoneName(id: string): boolean;
```

Lower-case with an ASCII-only map (`id.replace(/[A-Z]/g, …)` or a char-code loop), never
`toLowerCase()`: a locale-free, Unicode-free fold is what ECMA-402 §6.5.1 means by ASCII case.

### Choke points (refuse before anything is built)

| Site | Change |
| --- | --- |
| `isZoneId` (`internal/inputChecks.ts:32`) | after the `typeof` check and before `isRememberedZone`: `if (isRefusedZoneName(timeZone)) return false;` |
| `zoneFrame`, `normalizeZoneFrame` (`internal/zoneFrame.ts:11`, `:65`) | a string zone that `isRefusedZoneName` matches returns `null` |
| `normalizeTimeZone` (`internal/normalizeTimeZone.ts`) | reaches `isZoneId`; confirm, add nothing if so |
| `timeZoneIdOf` (`internal/zonedWallClock.ts:644`) | throw `RangeError` when the result's `timeZoneId` is refused (callers already catch) |
| `zonedDateTimeFrom` (`zonedWallClock.ts:861`), `zonedDateTimeOf` (`:910`) | after Temporal parses, a refused `timeZoneId` throws (`zonedDateTimeFrom`) or returns `null` (`zonedDateTimeOf`) |
| `construct` (`internal/formatterCache.ts`), case `"DateTimeFormat"` | a `timeZone` option string that is refused throws `RangeError` before `new Intl.DateTimeFormat`; never cached |
| `getTimeZones` (`zoned/get/getTimeZones.ts`) | filter refused names out of `Intl.supportedValuesOf("timeZone")` |
| `systemTimeZone` (`internal/resolveLocale.ts:110`) | already returns `""` through `isZoneId`; no change |

Checking `timeZoneId` after a parse is enough: Temporal's ToTemporalTimeZoneIdentifier keeps the
written identifier, case-normalized, and never canonicalizes a Link (Temporal
GetAvailableNamedTimeZoneIdentifier `[[Identifier]]`). The refused set has no offset forms.

**Audit.** There are 162 raw `.toZonedDateTime(`, `.withTimeZone(` and `toZonedDateTimeISO(`
sites. `tdd-dev` does not edit them one by one: the matrix tests below run every public zone
argument, and any leak is a failing row. A leak found is fixed at the narrowest choke point that
covers it, and the table above gains a row.

Out of scope: functions that read the host's own zone with no zone argument (`getNow`,
`getToday`, the plain `get…` functions). Their value depends on the host's clock and zone by
definition. `systemTimeZone()` returns `""` when the host's zone is refused.

## Tests

| File | Rows |
| --- | --- |
| `internal/refusedZoneNames.test.ts` (new) | each of the nine, its lower-case and a mixed-case spelling → `true`; `EST`, `MST`, `HST`, `US/Eastern`, `GMT0`, `UCT`, `Zulu`, `Japan`, `Etc/GMT+5`, `Asia/Calcutta`, `Europe/Brussels`, `America/New_York`, `+05:30`, `""`, `"ESTEDT"`, `"CET "` → `false` |
| `src/test/zoneArgument.test.ts` | for every entry of `zoneArgumentCalls` (85) and `zoneIdentifierCalls` (30): `run(name)` deep-equals `run("Not/AZone")` for each refused name and `est5edt`, `cet`, `factory`. Title template names the call and the zone |
| `src/test/annotationPolicy.test.ts` | a new `describe` over the same exports it sweeps: `…[EST5EDT]`, `…[CET]`, `…[Factory]`, `…[est5edt]` give the same result as `…[Not/AZone]` |
| `zoned/validate/isValidTimeZone.test.ts:23` | the `ianaSingleComponentTimeZones` rows run over the accepted list; a new `it.each(refusedZoneNames)` → `false` |
| `zoned/get/getTimeZoneOffset.test.ts:15` | the `EST5EDT` row becomes the sentinel; add an `EST` row for the fixed-offset case it covered (`-05:00`) |
| `instant/convert/toOffsetInstant.test.ts:205`, `:217`, `:220`; `fromOffsetInstant.test.ts:61` | `EST5EDT` rows become the sentinel; the behaviour they covered moves to `America/New_York` with the same expected offsets |
| `regex/time-zone-like.test.ts:20` | unchanged in meaning: the regex is a syntax check and still matches every refused name. Iterate both lists |
| `intermodal/format/bolTimestamp.test.ts:223` | `"EST5EDT "` stays (trailing space, refused on shape) |
| `zoned/get/getTimeZones.test.ts` | no refused name in the list on any host |

`src/test/timeZoneMatrix.ts`: move `CET`, `CST6CDT`, `EET`, `EST5EDT`, `MET`, `MST7MDT`,
`PST8PDT`, `WET` out of `ianaSingleComponentTimeZones` into a new export
`refusedZoneNames = [...those, "Factory"] as const`, and export it from `src/test/index.ts`.
Rewrite the JSDoc above both: Temporal §14.6.2 requires every Zone and Link name; GMT refuses
these nine on every host (D35) because hosts disagree on them.

Tests assert the sentinel, never an error message. Run on Node 22, 24 and 26 and in WebKit and
Chromium.

## JSDoc and native-suite tags

- `zoned/validate/isValidTimeZone.ts:10`, `regex/time-zone-like.ts:12`, `toOffsetInstant.ts:59`
  and `:64`, `fromOffsetInstant.ts:18`: replace each `EST5EDT` example with `Japan` (a Link every
  host accepts) or `America/New_York`, whichever keeps the example's point. `isValidTimeZone` adds
  `@example isValidTimeZone("EST5EDT") // false` and one bullet: "Nine names hosts disagree on
  (`EST5EDT`, `CST6CDT`, `MST7MDT`, `PST8PDT`, `CET`, `EET`, `MET`, `WET`, `Factory`) are invalid
  on every host."
- `scripts/lib/native-suite-tags.mjs:385–419`: delete `webkit-posix-zone-ids` and
  `webkit-legacy-zone-ids` once the rows pass in WebKit; run the tag tests. A tag that matches
  nothing is a defect, so the deletion is required, not optional.

## Repros (canary only)

`repros.ts`: add `"D35"` to `CanaryDefectId` ("D35 (`refusedZoneNames.ts`): hosts accept
different zone names"). Nine rows, `defect: "D35"`, `calendar: "iso8601"`, name
`zoneName<Name>` (`zoneNameEST5EDT`, …, `zoneNameFactory`), expected `"accepted"`. `run` builds
`new Intl.DateTimeFormat("en", { timeZone: name })` and
`Temporal.ZonedDateTime.from("2024-07-15T12:00:00[" + name + "]")` through the `../temporal` seam
and returns `"accepted"`, or `ERR <message>` from the runner. Expected today: all pass on Node and
Chromium; all nine fail on Linux WebKit and five (the System V four and `Factory`) on macOS 27
Safari: **STILL NEEDED**.

## Compat rows

- README Workarounds row **D35**, after D34: defect (the table above, tzdb `backward` and
  `factory`, ECMA-402 §6.5.1 lists every Zone and Link), files (`refusedZoneNames.ts` and the
  choke points), when active: "Every host. A refused name, in any ASCII case, is not a zone: every
  function returns its sentinel. No probe: unconditional (rule 2 exception)." Add D35 to the rule 2
  exception sentence written for D33 and D26.
- Removal trigger **D35**: "Every engine's compat check passes every `D35` repro (`pnpm compat`
  and the chromium, firefox, webkit and webkit-macos legs): each name is accepted by both `Intl`
  and Temporal. Differences in a name's data between tzdata versions do not keep D35 (Open
  question 7). Upstream: WebKit 330688."
- Removal step **35**: "**D35:** a minor changeset. Delete `internal/refusedZoneNames.ts`, its
  calls (`isZoneId`, `zoneFrame`, `normalizeZoneFrame`, `timeZoneIdOf`, `zonedDateTimeFrom`,
  `zonedDateTimeOf`, `construct`, `getTimeZones`), the `D35` repros and `"D35"`, the D35 entry in
  `scripts/lib/workarounds.mjs`, `WHAT_BREAKS.D35` and its `temporal-compat.json` row. Move the
  nine names back into `ianaSingleComponentTimeZones`; the sentinel rows become value rows." The
  current "After every step" becomes 36 (37 if step 2 of coptic-epoch-era.md adds D36).
- `scripts/lib/workarounds.mjs`: `defects: ["D35"]`, no `engines` key (as D33), title "D35 — nine
  zone names hosts disagree on; GMT refuses them on every host (internal/refusedZoneNames.ts)".
- `WHAT_BREAKS.D35`, `ac-ae.md` § "POSIX zone ids: WebKit bug 330688" status line and
  `status.md:108`: [filings-and-text.md](filings-and-text.md).
