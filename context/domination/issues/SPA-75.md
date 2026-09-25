# SPA-75 — Space: Solar events — sunrise, sunset, twilight and solar position

**Scope:** The times the Sun crosses the horizon and the twilight altitudes at a given place and date, the solar position at an instant, and the polar cases where it does neither.

## Gap

"Sunrise" and "sunset" are inputs to rules across the epic and GMT cannot compute them. "Night" and "daylight" rules across the epic are stated as offsets from solar events — from one hour after sunset to one hour before sunrise, from the end of civil dusk to the start of civil dawn, from sunset to sunrise — and NOTAM schedules use `SR MINUS30` / `SS PLUS30` (OPADD, AV-28). Celestial sights are taken in nautical twilight; solar-power forecasting, agriculture and religious calendars key on the same events. Every one of these is deterministic astronomy with a published algorithm and a stated accuracy.

The private `spacetime` library in this organisation plans solar elevation for geospatial work; it will consume this story rather than duplicate it, because the underlying arithmetic needs the two-part Julian Date and TT that only the Space realm keeps.

The standard altitudes are USNO's: "sunrise or sunset is defined to occur when the geometric zenith distance of center of the Sun is 90.8333 degrees" (34′ of refraction plus the 16′ semi-diameter, so "the upper limb of the Sun will then appear to be tangent to the horizon"); civil, nautical and astronomical twilight when the Sun's centre is "geometrically 6 degrees", "12 degrees" and "18 degrees below the horizon"; and at high latitudes the phenomena may not "be observed to occur at all". NOAA's calculator, "based on equations from Astronomical Algorithms, by Jean Meeus", assumes "0.833° of atmospheric refraction" and is "accurate to within a minute for locations between +/- 72° latitude, and within 10 minutes outside of those latitudes".

([USNO Astronomical Applications, *Rise, Set, and Twilight Definitions*](https://aa.usno.navy.mil/faq/RST_defs), [NOAA Global Monitoring Laboratory, Solar Calculator, calculation details](https://gml.noaa.gov/grad/solcalc/calcdetails.html), Meeus, *Astronomical Algorithms*, 2nd ed., ch. 15, 25 and 28 (printed; the algorithm source, not quoted))

## Scope

- `packages/gmt/src/space/calculate/solarPosition.ts`:
  - `solarPosition(isoString: string, location: { latitude: number, longitude: number }): { elevationDegrees: number, azimuthDegrees: number, declinationDegrees: number, equationOfTimeMinutes: number } | null` — Meeus ch. 25 low-accuracy solar coordinates (0.01°), with refraction not applied.
  - `subsolarPoint(isoString: string): { latitude: number, longitude: number } | null`
- `packages/gmt/src/space/calculate/solarEvents.ts`:
  - `solarEvents(isoDate: string, location, options: { timeZone: string }): { sunrise: string | null, sunset: string | null, solarNoon: string, civilDawn: string | null, civilDusk: string | null, nauticalDawn: string | null, nauticalDusk: string | null, astronomicalDawn: string | null, astronomicalDusk: string | null, polar: 'day' | 'night' | 'twilightOnly' | null } | null` — Events for the local date in `timeZone`; `null` for an event that does not occur, with `polar` saying why.
  - `sunEventAt(isoDate: string, location, altitudeDegrees: number, direction: 'rising' | 'setting', options): string | null` — The general form: any altitude, so callers can implement "sun 6° below" or "upper limb" rules.
  - `nightInterval(isoDate: string, location, definition: { from: { event: SolarEventName, offset: string }, to: { event: SolarEventName, offset: string } }, options: { timeZone: string }): Interval | null` — `SolarEventName` is `'sunrise' | 'sunset' | 'civilDawn' | 'civilDusk' | 'nauticalDawn' | 'nauticalDusk' | 'astronomicalDawn' | 'astronomicalDusk'`; each `offset` is a signed ISO duration applied to the event; `to` resolves on the following local date when it precedes `from`. A `from` or `to` event that does not occur on its date returns the sentinel, with the reason available from `solarEvents`.

## Standard altitudes

| Event | Altitude of the Sun's centre |
| --- | --- |
| Sunrise / sunset | −0.8333° (−50′: 34′ refraction plus 16′ semi-diameter) |
| Civil twilight | −6° |
| Nautical twilight | −12° |
| Astronomical twilight | −18° |

## Design notes

- **Accuracy is a number in the JSDoc, and it is NOAA's number.** Within ±72° latitude the method is good to about a minute; outside it, to about ten; the functions say so and never claim better than the method delivers. The 0.01° figure often quoted for Meeus's low-accuracy solar position was not verified against the book and is not claimed.
- **Polar day and night are results, not errors.** The hour-angle equation has no real solution when `cos H₀` falls outside [−1, 1] — an algorithmic consequence, and exactly the USNO's "may not be observed to occur at all". The functions return `null` for that event and set `polar`, so a caller at Tromsø in June gets `polar: 'day'`, not a sentinel that looks like bad input.
- **A date and a zone define "the day".** Events are found for the local calendar date in `timeZone`; at longitudes far from the zone's meridian, or across the date line, "today's sunset" differs by zone and the parameter makes that explicit. Instants are returned as ISO strings; the local rendering is `etaAtZone`'s or the caller's.
- **"Night" is the caller's definition.** `nightInterval` composes two solar events and two offsets; the events and altitudes are astronomy, and which pair a rule uses is the rule's own. The docs show the three shapes above labelled by their events and offsets, never by who requires them.
- **The Julian Date comes from SPA-49 and TT from SPA-47.** The solar-coordinate formulae take Julian centuries from J2000 in TT; using UTC introduces a 69-second argument error that is negligible for sunrise and not for the subsolar point. Using the two-part JD keeps the arithmetic exact.
- Atmospheric conditions, observer elevation and local horizon are not modelled; the standard 34′ refraction is a convention, documented. Lunar phases and rise/set are parked (see painpoints).

## Corrections

- `nightInterval` took a three-value enum whose members were named rules of two regulators; it now takes the caller's from/to events and offsets, and no definition is a default.

## What gmt provides (do not re-implement)

- `toJulianDateParts` from SPA-49 — Julian centuries from J2000
- `toTT` from SPA-47 — the argument scale
- `floorToZone` / `bucketRange` from CORE-5 — the local day being searched
- `resolveLocal` from CORE-4 — local date to instant
- `toNanoseconds` from CORE-1 — exact interpolation

## Verification

- `solarEvents` for Greenwich on the 2024 March equinox returns sunrise and sunset within one minute of the NOAA calculator's values, and `solarNoon` within 30 seconds
- `solarEvents` for Tromsø (69.6°N) on 21 June returns `sunrise: null`, `sunset: null`, `polar: 'day'`; on 21 December returns `polar: 'night'` with civil twilight present and `polar` reflecting that only twilight occurs
- Civil dusk is later than sunset, nautical dusk later than civil, astronomical later than nautical, for a mid-latitude date, asserted in order
- `sunEventAt` with `-0.8333` and `'rising'` equals `sunrise`; with `-6` equals `civilDawn`
- `nightInterval` from `{ event: 'civilDusk', offset: 'PT0S' }` to `{ event: 'civilDawn', offset: 'PT0S' }` starts at civil dusk and ends at civil dawn the next morning; from sunset `+PT1H` to sunrise `-PT1H` is two hours shorter than sunset-to-sunrise, asserted; a `from` event that does not occur (Tromsø, 21 June, sunset) returns the sentinel
- `subsolarPoint` at the June solstice has latitude within 0.05° of +23.44°
- `solarPosition` at local solar noon has azimuth within 0.5° of 180° in the northern mid-latitudes
- The same location evaluated for the same UTC day under two zones on opposite sides of the date line returns events for different local dates, asserted to show the zone parameter matters
- Latitude outside ±90 or longitude outside ±180 returns the sentinel
- `pnpm run validate` stays green
