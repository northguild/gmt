# CORE-79 — Core: One input type for a position on Earth (`Position`)

**Scope:** A `Position` type, `{ latitude, longitude, height? }` in WGS 84 decimal degrees and metres, so every GMT function that takes a place on Earth takes it the same way. The type only: each consuming function checks its own input and returns its own sentinel. There is no public validator and no geodesy.

## Gap

Several planned stories took a place on Earth, each in its own ad-hoc shape: SPA-75 an inline `{ latitude, longitude }`, SPA-50 and MAR-18 a bare `longitudeDegrees: number`. MAR-18, SPA-75 and SPA-50 now name `Position` instead.

Without one shape, each story invents its own field names, axis order, range rules and antimeridian handling, and a caller passing one story's position to another meets three conventions. The axis order is the classic defect: RFC 7946 GeoJSON writes a position as `[longitude, latitude]` ("The first two elements are longitude and latitude, or easting and northing, precisely in that order", §3.1.1), while ISO 6709 and most human-facing notations put latitude first. An array in one order read in the other moves a point across the globe without an error.

([RFC 7946, *The GeoJSON Format*, §3.1.1, §3.1.9, §4](https://www.rfc-editor.org/rfc/rfc7946); ISO 6709:2022, *Standard representation of geographic point location by coordinates*, and ISO 19111:2019, *Referencing by coordinates* — paywalled, not reached — marked, not asserted)

## Scope

- `packages/gmt/src/internal/position.ts` (not exported from any public barrel; see D1):
  - `Position` is `{ latitude: number, longitude: number, height?: number }`, with JSDoc on the type and each member stating the units, the datum and the ranges below.
  - `readPosition(value: unknown): Position | null` — the one check consuming functions call. It returns a fresh `{ latitude, longitude, height? }` when `value` is an object (`internal/isObject.ts`) with a finite `latitude` in [−90, 90], a finite `longitude` in [−180, 180], and either no `height` or a finite `height`; otherwise `null`. Each member is read once; extra keys are ignored. A consumer that receives `null` returns its own sentinel.

## Tool

This story adds the `Position` input type and no function a reader could try. MAR-18's Ship's Clock is the first tool to take it.

## Design notes

- **Type only; each consumer validates through the internal helper.** A consuming function calls `readPosition` and returns the sentinel its own return type takes (`""`, `null`, `false`, `[]`) when it gets `null`. No public `isValidPosition` ships here.
- **Validation and geo logic belong to the future geo package.** A sibling package in this monorepo — its name and dependency direction still undecided — will own a public `isValidPosition`, ISO 6709 strings, GeoJSON, distances, bearings, datum transformations, projections and the time zone at a position. The type is kept minimal, three named fields and nothing else, so that package can adopt or re-export it without breaking any GMT caller. GMT does not resolve a position to an IANA zone, consistent with the epic rule that zones are parameters.
- **Named fields, never an array.** `{ latitude, longitude }` cannot be read in the wrong axis order. GMT takes no `[lon, lat]` or `[lat, lon]` tuple anywhere; a caller holding GeoJSON writes `{ latitude: c[1], longitude: c[0] }` once, at the boundary, and the JSDoc shows that line.
- **WGS 84 decimal degrees, height in metres above the ellipsoid.** RFC 7946 §4 fixes this for interchange: "using the World Geodetic System 1984 (WGS 84) datum, with longitude and latitude units of decimal degrees", and "An OPTIONAL third-position element SHALL be the height in meters above or below the WGS 84 reference ellipsoid." `height` is therefore ellipsoidal height, not height above sea level, and the JSDoc says so. ISO 6709 and ISO 19111 are the international standards for point representation and coordinate reference systems; WGS 84 itself is defined by the US National Geospatial-Intelligence Agency and registered as EPSG:4326 by IOGP, both cited as labelled peers. Their texts were not reached — marked, not asserted.
- **Ranges and the antimeridian, enforced by `readPosition`.** Latitude is [−90, 90]; RFC 5870 §3.4.2 makes latitudes outside −90 to 90 invalid. Longitude is the closed range [−180, 180]: RFC 5870 §3.4.2 makes longitudes outside −180 to 180 invalid too. Both −180 and 180 are accepted and name the same meridian, because AIS, receiver sentences and GeoJSON data all carry either end; GMT never normalises one into the other (GMT rule), since that would change a caller's value. A consuming function whose answer differs at the antimeridian says so itself (MAR-18's `nauticalZone` flags the M/Y ambiguity at 180°).
- **A position on another body is not a `Position`.** SPA-53's Mars longitudes are planetocentric east longitudes on Mars (IAU), not WGS 84, and stay a plain number in that story.

## What gmt provides (do not re-implement)

- `internal/isObject.ts` — the one object check (coding-standards § API Contract)

## Verification

- **Type level:** `{ latitude: 35.68, longitude: 139.77 }` and `{ latitude: 35.68, longitude: 139.77, height: 40 }` type-check as `Position`; `[139.77, 35.68]` and `{ lat: 35.68, lon: 139.77 }` do not (`// @ts-expect-error` rows).
- `Position` is not exported in this story (D1); MAR-18 exports it from the package root. No public `isValidPosition` exists.
- **`readPosition` (internal):**
  - `{ latitude: 35.68, longitude: 139.77 }`, with `height: 40` and with `height: -30` (below the ellipsoid), returns the position.
  - `{ latitude: 90, longitude: 0 }`, `{ latitude: -90, longitude: 0 }`, `{ latitude: 0, longitude: 180 }` and `{ latitude: 0, longitude: -180 }` return the position.
  - `{ latitude: 90.000001, longitude: 0 }` and `{ latitude: 0, longitude: 180.000001 }` return `null`.
  - `[139.77, 35.68]`, `{ lat: 35.68, lon: 139.77 }`, `NaN`, `Infinity` or a string in any field, `{ latitude: 0, longitude: 0, height: NaN }`, `null`, `undefined`, `"x"` and `{}` return `null`.
  - A getter on `latitude` is read once; extra keys are ignored and not copied.
- **Each consumer's sentinel on an invalid position** (asserted in the consumer's own story): SPA-75's `solarPosition` and `solarEvents` return `null`, SPA-50's `localSiderealTime` returns `null`, and MAR-18's `nauticalZone` returns `null`, for `{ latitude: 91, longitude: 0 }` and for `[0, 0]`.
- `pnpm run validate` stays green

## Corrections

- The design notes cited RFC 7946 §5.3 as forbidding latitudes beyond ±90. §5.3 is about bounding boxes; the rule is RFC 5870 §3.4.2.
- The design notes said no standard states a longitude range. RFC 5870 §3.4.2 does: longitudes outside −180 to 180 are invalid.
- Verification said `Position` is exported from the root. Under D1 it is not; MAR-18 exports it.
- The Gap section no longer lists ad-hoc shapes as open: MAR-18, SPA-75 and SPA-50 already name `Position`.
- The design notes said GNSS receivers report positions in the WGS 84 ellipsoidal frame. NMEA 0183 GGA gives altitude above mean sea level, with the geoid separation in a separate field, so the sentence is removed and the JSDoc says only that `height` is not height above sea level.
- Scope put `Position` in `types/position.ts`. `scripts/api-surface.mjs check` refuses a file outside `internal/` that no public subpath reaches, so the type lives in `internal/position.ts` beside `readPosition` until MAR-18 exports it (D1).

## Decisions

- **D1: `Position` is not exported in this story.** The type and `readPosition` both live in `internal/position.ts`, re-exported from nowhere, so there is no public change and nothing to release. The changeset is an empty one, `.changeset/position-input-type.md`, because CI's `changeset status` needs a changeset for every changed package, `packages/gmt` included. The Dox reference build refuses a public type no public function reaches (`refuseOrphans` in `apps/dox/scripts/build-reference.ts`), and `pnpm dox:docs-check` reports it as an `orphan-type` gap, so exporting now would fail `validate`. A file outside `internal/` that no public subpath reaches fails `scripts/api-surface.mjs check`, so the type cannot wait in `types/` either. MAR-18 moves `Position` with its JSDoc to `types/position.ts`, has `internal/position.ts` import it from there, and takes the `export * from "./position";` line in `types/index.ts`, the root-import type row and the `minor` changeset.
- **D2: one shape, one check.** Every function that takes a `Position` calls `readPosition`, including those that use only the longitude (`nauticalZone`, `localSiderealTime`). An invalid latitude gets their sentinel too.
- **D3: read order.** `readPosition` reads `height`, `latitude`, `longitude` once each, in code-unit order as Temporal's `PrepareCalendarFields` does, all before any check. `undefined` means absent.

### Rules and their authority

- WGS 84, decimal degrees: RFC 7946 §4; RFC 5870 §3.4.2.
- `height` is metres above (+) or below (−) the WGS 84 ellipsoid, not sea level: RFC 7946 §4 (RFC 5870 says "geoid" for the same value; the later RFC 7946 names the ellipsoid and the JSDoc follows it). An unknown height is absent, never `0`: RFC 5870 §3.4.2.
- Latitude in [−90, 90] and longitude in [−180, 180], both closed: RFC 5870 §3.4.2. At a pole any longitude in range is accepted as given.
- −180 and 180 are the same meridian (RFC 5870 §3.4.4). **GMT rule:** both are accepted and neither is rewritten, because that would change the caller's value.
- **GMT rule:** named fields, never an array, so the axis order (GeoJSON is `[longitude, latitude]`, RFC 7946 §3.1.1) cannot be misread.
- **GMT rule:** every member is a finite `number` with no coercion; `height` has no range; `-0` stays `-0`.
- Ordinary `[[Get]]`: inherited properties, getters and functions count (coding-standards, API Contract). `readPosition` never throws and returns `null` for every invalid input.
- ISO 6709:2022, ISO 19111:2019, the NGA WGS 84 definition and EPSG:4326 are peers; their texts were not reached and nothing rests on them.

### Notes for consumer stories

- Every consumer calls `readPosition(position)` once, first, uses only the returned object, and returns its own sentinel on `null`. A consumer whose answer differs at ±180, at a pole or at `-0` says so in its own JSDoc and tests.
- **MAR-18:** takes the export (moving `Position` from `internal/position.ts` to `types/position.ts`), the root-import type row and the `minor` changeset (D1). Say what `nauticalZone` returns for longitude `-0` (`Math.round(-0 / 15)` is `-0`, so `zoneDescription` is `-0` unless normalised). Add the `{ latitude: 91, longitude: 0 }` and `[0, 0]` sentinel rows.
- **SPA-75:** `solarEvents`, `sunEventAt` and `nightInterval` should write `location: Position`. `subsolarPoint` leaves the `height` key out (not `undefined`), returns longitudes in [−180, 180], and says which end it uses at the antimeridian. Its result should round-trip through `readPosition`. The invalid-position verification row covers `[0, 0]` and names each function.
- **SPA-50:** "Invalid longitude returns the sentinel" should read "invalid position": `localSiderealTime` returns `null` for an invalid latitude too (D2).
- **SPA-53** keeps Mars east longitude as a plain number.
