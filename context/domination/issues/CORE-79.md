# CORE-79 — Core: One input type for a position on Earth (`Position`)

**Scope:** A `Position` type, `{ latitude, longitude, height? }` in WGS 84 decimal degrees and metres, so every GMT function that takes a place on Earth takes it the same way. The type only: each consuming function checks its own input and returns its own sentinel. There is no public validator and no geodesy.

## Gap

Several planned stories take a place on Earth, each in its own ad-hoc shape:

- SPA-75 takes an inline `{ latitude: number, longitude: number }` for `solarPosition` and `solarEvents`, and returns the same inline shape from `subsolarPoint`.
- SPA-50 takes a bare `longitudeDegrees: number` for `localSiderealTime`.
- MAR-18 takes a bare `longitudeDegrees: number` for `nauticalZone`.

Without one shape, each story invents its own field names, axis order, range rules and antimeridian handling, and a caller passing one story's position to another meets three conventions. The axis order is the classic defect: RFC 7946 GeoJSON writes a position as `[longitude, latitude]` ("The first two elements are longitude and latitude, or easting and northing, precisely in that order", §3.1.1), while ISO 6709 and most human-facing notations put latitude first. An array in one order read in the other moves a point across the globe without an error.

([RFC 7946, *The GeoJSON Format*, §3.1.1, §3.1.9, §4, §5.3](https://www.rfc-editor.org/rfc/rfc7946); ISO 6709:2022, *Standard representation of geographic point location by coordinates*, and ISO 19111:2019, *Referencing by coordinates* — paywalled, not reached — marked, not asserted)

## Scope

- `packages/gmt/src/types/position.ts`:
  - `Position` is `{ latitude: number, longitude: number, height?: number }`, with JSDoc on the type and each member stating the units, the datum and the ranges below.
- `packages/gmt/src/internal/position.ts` (not exported from any public barrel):
  - `readPosition(value: unknown): Position | null` — the one check consuming functions call. It returns a fresh `{ latitude, longitude, height? }` when `value` is an object (`internal/isObject.ts`) with a finite `latitude` in [−90, 90], a finite `longitude` in [−180, 180], and either no `height` or a finite `height`; otherwise `null`. Each member is read once; extra keys are ignored. A consumer that receives `null` returns its own sentinel.

## Tool

This story adds the `Position` input type and no function a reader could try. MAR-18's Ship's Clock is the first tool to take it.

## Design notes

- **Type only; each consumer validates through the internal helper.** A consuming function calls `readPosition` and returns the sentinel its own return type takes (`""`, `null`, `false`, `[]`) when it gets `null`. No public `isValidPosition` ships here.
- **Validation and geo logic belong to the future geo package.** A sibling package in this monorepo — its name and dependency direction still undecided — will own a public `isValidPosition`, ISO 6709 strings, GeoJSON, distances, bearings, datum transformations, projections and the time zone at a position. The type is kept minimal, three named fields and nothing else, so that package can adopt or re-export it without breaking any GMT caller. GMT does not resolve a position to an IANA zone, consistent with the epic rule that zones are parameters.
- **Named fields, never an array.** `{ latitude, longitude }` cannot be read in the wrong axis order. GMT takes no `[lon, lat]` or `[lat, lon]` tuple anywhere; a caller holding GeoJSON writes `{ latitude: c[1], longitude: c[0] }` once, at the boundary, and the JSDoc shows that line.
- **WGS 84 decimal degrees, height in metres above the ellipsoid.** RFC 7946 §4 fixes this for interchange: "using the World Geodetic System 1984 (WGS 84) datum, with longitude and latitude units of decimal degrees", and "An OPTIONAL third-position element SHALL be the height in meters above or below the WGS 84 reference ellipsoid." `height` is therefore ellipsoidal height, not height above sea level, and the JSDoc says so. GNSS receivers report positions in the same frame. ISO 6709 and ISO 19111 are the international standards for point representation and coordinate reference systems; WGS 84 itself is defined by the US National Geospatial-Intelligence Agency and registered as EPSG:4326 by IOGP, both cited as labelled peers. Their texts were not reached — marked, not asserted.
- **Ranges and the antimeridian (GMT rule), enforced by `readPosition`.** Latitude is [−90, 90]; RFC 7946 §5.3 forbids latitudes beyond ±90. Longitude is the closed range [−180, 180]: RFC 7946 states no longitude range, and ISO 6709's text was not reached, so the rule is GMT's. Both −180 and 180 are accepted and name the same meridian, because AIS, receiver sentences and GeoJSON data all carry either end; GMT never normalises one into the other, since that would change a caller's value. A consuming function whose answer differs at the antimeridian says so itself (MAR-18's `nauticalZone` flags the M/Y ambiguity at 180°).
- **A position on another body is not a `Position`.** SPA-53's Mars longitudes are planetocentric east longitudes on Mars (IAU), not WGS 84, and stay a plain number in that story.

## What gmt provides (do not re-implement)

- `internal/isObject.ts` — the one object check (coding-standards § API Contract)

## Verification

- **Type level:** `{ latitude: 35.68, longitude: 139.77 }` and `{ latitude: 35.68, longitude: 139.77, height: 40 }` type-check as `Position`; `[139.77, 35.68]` and `{ lat: 35.68, lon: 139.77 }` do not (`// @ts-expect-error` rows).
- `Position` is exported from the package root and from no other public barrel; no public `isValidPosition` exists (an export-surface test).
- **`readPosition` (internal):**
  - `{ latitude: 35.68, longitude: 139.77 }`, with `height: 40` and with `height: -30` (below the ellipsoid), returns the position.
  - `{ latitude: 90, longitude: 0 }`, `{ latitude: -90, longitude: 0 }`, `{ latitude: 0, longitude: 180 }` and `{ latitude: 0, longitude: -180 }` return the position.
  - `{ latitude: 90.000001, longitude: 0 }` and `{ latitude: 0, longitude: 180.000001 }` return `null`.
  - `[139.77, 35.68]`, `{ lat: 35.68, lon: 139.77 }`, `NaN`, `Infinity` or a string in any field, `{ latitude: 0, longitude: 0, height: NaN }`, `null`, `undefined`, `"x"` and `{}` return `null`.
  - A getter on `latitude` is read once; extra keys are ignored and not copied.
- **Each consumer's sentinel on an invalid position** (asserted in the consumer's own story): SPA-75's `solarPosition` and `solarEvents` return `null`, SPA-50's `localSiderealTime` returns `null`, and MAR-18's `nauticalZone` returns `null`, for `{ latitude: 91, longitude: 0 }` and for `[0, 0]`.
- `pnpm run validate` stays green
