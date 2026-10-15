# CORE-79 — Core: One input shape for a position on Earth

**Scope:** A `Position` type, `{ latitude, longitude, height? }` in WGS 84 decimal degrees and metres, and `isValidPosition`, so every GMT function that takes a place on Earth takes it the same way. No geodesy.

## Gap

Several planned stories take a place on Earth, each in its own ad-hoc shape:

- SPA-75 takes an inline `{ latitude: number, longitude: number }` for `solarPosition` and `solarEvents`, and returns the same inline shape from `subsolarPoint`.
- SPA-50 takes a bare `longitudeDegrees: number` for `localSiderealTime`.
- MAR-18 takes a bare `longitudeDegrees: number` for `nauticalZone`.

Without one shape, each story invents its own field names, axis order, range rules and antimeridian handling, and a caller passing one story's position to another meets three conventions. The axis order is the classic defect: RFC 7946 GeoJSON writes a position as `[longitude, latitude]` ("The first two elements are longitude and latitude, or easting and northing, precisely in that order", §3.1.1), while ISO 6709 and most human-facing notations put latitude first. An array in one order read in the other moves a point across the globe without an error.

([RFC 7946, *The GeoJSON Format*, §3.1.1, §3.1.9, §4, §5.3](https://www.rfc-editor.org/rfc/rfc7946); ISO 6709:2022, *Standard representation of geographic point location by coordinates*, and ISO 19111:2019, *Referencing by coordinates* — paywalled, not reached — marked, not asserted)

## Scope

- `packages/gmt/src/types/position.ts`:
  - `Position` is `{ latitude: number, longitude: number, height?: number }`.
- `packages/gmt/src/position/validate/isValidPosition.ts`:
  - `isValidPosition(value: Position): boolean` — `true` when `value` is an object with a finite `latitude` in [−90, 90], a finite `longitude` in [−180, 180], and either no `height` or a finite `height`. `false` otherwise, including for an array (named fields only), `NaN` and ±`Infinity`. Each member is read once.

`position/` is a new Core namespace holding the validator; the type sits in `types/` with the others. Consuming stories take a `Position` argument and validate it with this function.

## Design notes

- **Named fields, never an array.** `{ latitude, longitude }` cannot be read in the wrong axis order. GMT takes no `[lon, lat]` or `[lat, lon]` tuple anywhere; a caller holding GeoJSON writes `{ latitude: c[1], longitude: c[0] }` once, at the boundary, and the JSDoc shows that line.
- **WGS 84 decimal degrees, height in metres above the ellipsoid.** RFC 7946 §4 fixes this for interchange: "using the World Geodetic System 1984 (WGS 84) datum, with longitude and latitude units of decimal degrees", and "An OPTIONAL third-position element SHALL be the height in meters above or below the WGS 84 reference ellipsoid." `height` is therefore ellipsoidal height, not height above sea level, and the JSDoc says so. GNSS receivers report positions in the same frame. ISO 6709 and ISO 19111 are the international standards for point representation and coordinate reference systems; WGS 84 itself is defined by the US National Geospatial-Intelligence Agency and registered as EPSG:4326 by IOGP, both cited as labelled peers. Their texts were not reached — marked, not asserted.
- **Ranges and the antimeridian (GMT rule).** Latitude is [−90, 90]; RFC 7946 §5.3 forbids latitudes beyond ±90. Longitude is the closed range [−180, 180]: RFC 7946 states no longitude range, and ISO 6709's text was not reached, so the rule is GMT's. Both −180 and 180 are accepted and name the same meridian, because AIS, receiver sentences and GeoJSON data all carry either end; GMT never normalises one into the other, since that would change a caller's value. A consuming function whose answer differs at the antimeridian says so itself (MAR-18's `nauticalZone` flags the M/Y ambiguity at 180°).
- **No ISO 6709 string functions in this story.** ISO 6709's text was not reached, and a parser written from secondary descriptions would be an invented grammar. A parse/format pair is added once the primary text is cited.
- **No geodesy.** No distances, bearings, datum transformations, coordinate reference systems other than WGS 84, map projections, or time zone at a position. Those belong to the planned geo package, a separate sibling of `@northguild/gmt`; this story only fixes the shape GMT's own functions take. In particular GMT does not resolve a position to an IANA zone, consistent with the epic rule that zones are parameters.
- **A position on another body is not a `Position`.** SPA-53's Mars longitudes are planetocentric east longitudes on Mars (IAU), not WGS 84, and stay a plain number in that story.

## What gmt provides (do not re-implement)

- `internal/isObject.ts` — the one object check (coding-standards § API Contract)

## Verification

- `isValidPosition({ latitude: 35.68, longitude: 139.77 })` is `true`; with `height: 40` it is `true`; with `height: -30` (below the ellipsoid) it is `true`
- `{ latitude: 90, longitude: 0 }`, `{ latitude: -90, longitude: 0 }`, `{ latitude: 0, longitude: 180 }` and `{ latitude: 0, longitude: -180 }` are `true`
- `{ latitude: 90.000001, longitude: 0 }` and `{ latitude: 0, longitude: 180.000001 }` are `false`
- `[139.77, 35.68]` (a GeoJSON array) is `false`; `{ lat: 35.68, lon: 139.77 }` is `false`
- `NaN`, `Infinity` or a string in any field is `false`; `{ latitude: 0, longitude: 0, height: NaN }` is `false`
- `null`, `undefined`, `"x"` and `{}` are `false`
- A getter on `latitude` is read once
- Extra keys are ignored: `{ latitude: 0, longitude: 0, name: "x" }` is `true`
- `pnpm run validate` stays green
