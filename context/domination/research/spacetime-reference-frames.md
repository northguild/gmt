# Space-Time Reference Frames Research Summary

**Research Date:** 2026-09-07  
**Purpose:** Inform GMT library design for satellite, orbital, space, and maritime time handling

---

## 1. Primary Reference Frames

### Time Scales

| Scale | Description | Leap Seconds | Primary Use |
|-------|-------------|-------------|-------------|
| **UTC** | Coordinated Universal Time | Yes | Civil time, ground operations, maritime navigation |
| **TAI** | International Atomic Time | No | Continuous time count, spacecraft onboard clocks |
| **GPS** | GPS System Time | No | GNSS satellites, space navigation (LEO-GEO) |
| **TT/TDT** | Terrestrial Time | No | Earth-based ephemeris, TAI + 32.184s |
| **TDB** | Barycentric Dynamical Time | No | Solar system ephemeris, orbital mechanics |
| **UT1** | Universal Time 1 | N/A | Earth rotation angle, sidereal navigation |
| **TCB/TCG** | Barycentric/Geocentric Coordinate Time | No | Relativistic coordinate frames |

### Key Relationships

```
TAI = GPS + 19s (constant)
UTC = TAI - leap_seconds (currently -37s)
TT = TAI + 32.184s (constant)
TDB ≈ TT + ~1.6ms periodic (relativistic correction)
```

**Source:** SPICE Time Subsystem (NAIF/JPL), ESA Mission Conventions Document, BIPM Circular T

### Julian Date Variants

| Format | Epoch | Notes |
|--------|-------|-------|
| **JD** | 4713 BCE Jan 1.5 | Traditional astronomical JD |
| **MJD** | 1858 Nov 17 00:00 | Modified JD = JD - 2400000.5 |
| **J2000** | 2000 Jan 1 12:00 TT | Common reference epoch for orbital mechanics |
| **SPICE ET** | J2000 in TDB | JPL Ephemeris Time, equivalent to TDB |

**Source:** CCSDS 502.0-B-3 (Orbit Data Messages), NAIF SPICE documentation

---

## 2. Who Uses What and Why

### NASA/ESA/JAXA Mission Planning

- **Ephemeris generation:** Uses TDB (SPICE "ET") as the independent variable for solar system ephemeris integration
- **Spacecraft events:** Ground operations tag with UTC; onboard systems use spacecraft clock (SCLK) correlated to TDB via SCLK kernel
- **Orbit products:** CCSDS ODM files (OPM, OEM, OCM) support TIME_SYSTEM keywords: UTC, TAI, GPS, TT, TDB, TCB, TCG
- **Science data:** Often stored as CDF_EPOCH (milliseconds) or CDF_TIME_TT2000 (nanoseconds since J2000 in TT)

**Source:** CCSDS 502.0-B-3 (Orbit Data Messages), NASA CDF Time Requirements

### Satellite Operators

| Mission Type | Primary Time Scale | Notes |
|--------------|-------------------|-------|
| **GPS Constellation** | GPS time | No leap seconds, epoch 1980-01-06 |
| **LEO (ISS, Sentinel, Sentinel-6)** | GPS time | Sub-ns synchronization achievable with geodetic receivers |
| **GEO (GOES-R, comsats)** | GPS time | Uses GPS sidelobes for navigation at GEO |
| **LEO constellations (Starlink)** | GPS time | Autonomous onboard navigation |
| **Deep space (Voyager, JWST)** | TDB (via DSN) | Ground correlation with Earth-based clocks |

**Real-world examples:**
- MMS (Magnetospheric Multiscale): <165m RSS position knowledge at 40% lunar distance using GPS
- GOES-16: 20m (3σ) orbit position knowledge with GPS at GEO
- OneWeb: 2024 outage caused by leap year GPS-to-UTC offset calculation error

**Source:** NASA NTRS-20180003360 (GPS in HEO), ESA Sentinel-6 documentation

### Maritime Navigation

- Uses GPS time for satellite positioning
- Converts to UTC for chart display and regulatory compliance (SOLAS convention)
- UTC required for AIS, GMDSS, electronic charting
- No onboard leap second handling; relies on GPS receiver for UTC conversion

**Source:** IMO SOLAS Convention, ITU-R TF.460-6

### Orbital Mechanics / Mission Control

- **Ephemeris propagation:** TDB (or TT with small correction)
- **Ground-to-space correlation:** Spacecraft clock → TDB → UTC
- **Time correlation process:** Ground sends command, measures light-time delay + relativistic correction, updates SCLK kernel table

**Source:** NAIF SPICE Time Tutorial, JPL Mission Operations

---

## 3. CCSDS Time Standards

### Primary Documents

| Document | Title | Status |
|----------|-------|--------|
| **CCSDS 301.0-B-4** | Time Code Formats (Blue Book) | Current (2010, Issue 4) |
| **CCSDS 301.0-B-5** | Time Code Formats | In Agency Review (2024) |
| **CCSDS 872.0-M-1** | Time Access Service (Magenta Book) | Current (2011) |
| **CCSDS 502.0-B-3** | Orbit Data Messages | Current (2023) |
| **ISO 11104** | Space data systems - Time code formats | ISO equivalent of CCSDS 301.0-B-3 |

### CCSDS 301.0-B-4 Time Code Formats

**Four recommended time code formats:**

1. **CUC (CCSDS Unsegmented Time Code)**
   - Binary count from epoch (recommended: 1958-01-01 TAI)
   - No leap second handling required
   - Monotonically increasing
   - Suitable for spacecraft onboard time

2. **CDS (CCSDS Day-Segmented Time Code)**
   - Binary segments: (sub)ms of day, day count
   - UTC-based; leap second correction required
   - Machine-friendly for frequent time interpretation

3. **CCS (CCSDS Calendar-Segmented Time Code)**
   - BCD encoded calendar segments
   - UTC-based; leap second correction required
   - Two variants: month/day and year/day-of-year

4. **ASCII Time Code**
   - Human-readable format
   - ISO 8601 compatible subsets
   - UTC-based; leap second allowed in seconds field (00-60)

**Time System Values in CCSDS ODM:**
```
GMST, GPS, MET, MRT, SCLK, TAI, TCB, TDB, TCG, TT, UT1, UTC
```

**Source:** CCSDS 301.0-B-4, CCSDS 502.0-B-3

---

## 4. Leap Second Handling

### Approaches by System Type

| System | Approach | Examples |
|--------|----------|----------|
| **Spacecraft onboard** | TAI or free-running oscillator | Most NASA/ESA missions |
| **GPS constellation** | No leap seconds (GPS time) | GPS, Galileo, BeiDou |
| **GLONASS** | Includes leap seconds | Follows UTC |
| **Ground systems** | Varies by mission | Some add, some don't |
| **CDF/netCDF files** | Mission-dependent | Heliophysics missions inconsistent |

### Real-World Complexity

NASA CDF data handling (per CDF Leap Second Requirements):
- GPS, SOHO, THEMIS, C/NOFS: Don't add leap seconds
- WMAP, Wind, Geotail, Polar, TRACE, RXTE: Do add leap seconds
- Missions update spacecraft clocks over periods around leap seconds (days off)
- Some slew clock over time; others increment at once but not always on time

### Best Practice for Space Systems

1. **Store timestamps in TAI or TT** (continuous, no leap seconds)
2. **Convert to UTC for ground operations** (human-readable, regulatory)
3. **Document the time scale used** in data products
4. **Use IERS Bulletin C** for leap second table updates

**Source:** NASA CDF Leap Second Requirements, IERS Bulletin C 68 (July 2024)

### Current Offset (as of 2024)

```
TAI - UTC = +37 seconds (since 2017-01-01)
GPS - UTC = -18 seconds
TAI - GPS = +19 seconds (constant)
```

**Source:** BIPM Circular T, IERS Bulletin C 68

---

## 5. Existing JavaScript/TypeScript Libraries

### Comparison Matrix

| Library | Time Scales | Leap Seconds | Precision | Dependencies |
|---------|-------------|--------------|-----------|--------------|
| **astrotime** | UTC, TAI, TT, GPS, TDB | Yes, validated | Nanosecond | None |
| **satellite.js** | UTC (Date) | Via JS Date | Millisecond | None |
| **ootk** | UTC, TAI, TT, GPS, TDB | Via Date | Millisecond | None |
| **sidereon-wasm** | UTC, TAI, TT, TDB, GPS | Yes | Nanosecond | WASM |
| **@interstellar-tools/temporal** | Building blocks | Partial | Variable | TypeScript |
| **sofa.js** | Full SOFA suite | Via ERFA | Variable | None |

### Detailed Library Analysis

#### astrotime (danfry1/astrotime)
**Best for:** Spacecraft & astronomy time in TypeScript

**Strengths:**
- Zero-dependency
- Nanosecond precision
- Validates leap seconds (23:59:60, 23:59:59)
- TAI, TT, GPS, TDB support with SPICE-compatible J2000 epoch
- TDB uses USNO Circular 179 model (<10µs vs ERFA 1972-2100)
- Tested against astropy and CSPICE golden vectors

**Weaknesses:**
- Not certified for flight/navigation (ground tooling focus)
- No timezone/locale support (delegates to Intl)
- Small user base

**API Pattern:**
```typescript
const instant = parseInstant('2026-08-19T12:34:56.789012345Z');
const tai = instantToScaleNanos(i, 'tai');
const j2000 = instantToJ2000Seconds(i, 'tdb'); // SPICE ET convention
```

#### satellite.js (shashwatak/satellite-js)
**Best for:** TLE propagation, satellite tracking

**Strengths:**
- SGP4/SDP4 propagation
- Widely used (84K weekly downloads)
- Bulk propagation API (WASM)
- ECI, ECF, geodetic conversions

**Weaknesses:**
- Time via JavaScript Date (millisecond precision)
- No TAI/TT/TDB internal support
- Leap seconds handled by JS Date (platform-dependent)

#### ootk / ootk-core (thkruz)
**Best for:** Comprehensive orbital toolkit

**Strengths:**
- Epoch classes: EpochUTC, EpochTAI, EpochTT, EpochGPS, EpochTDB
- SGP4 + numerical integrators
- Type-safe with branded types (Degrees, Kilometers, etc.)
- Active maintenance

**Weaknesses:**
- Time conversions via Date object
- Millisecond precision
- Large API surface

#### sidereon-wasm (neilberkman)
**Best for:** Browser-based GNSS + astrodynamics

**Strengths:**
- WASM engine (same numbers as native)
- Scale-aware time (Instant with GMST/GAST, TT/UT1/TDB)
- Reference-validated against Skyfield and IERS
- SPP, RTK, PPP positioning

**Weaknesses:**
- WASM dependency
- Larger bundle size

#### sofa.js (THRASTRO)
**Best for:** Full IAU SOFA compliance

**Strengths:**
- Complete ERFA port to JavaScript
- All 244+ SOFA functions
- Time scale conversions (TAI, TT, TDB, TCB, TCG, UT1)
- QUnit tests generated from C code

**Weaknesses:**
- Large library (~800KB)
- Complex API (direct C translation)
- No leap second validation
- Last release 2022

---

## 6. Key Libraries in Other Languages

### SPICE (NAIF/JPL)

**Architecture:**
- Kernel files: LSK (leap seconds), SCLK (spacecraft clock), SPK (ephemeris), PCK (attitude)
- Time represented as doubles (TDB seconds past J2000)
- String parsing with flexible formats

**Key Time APIs:**
```fortran
STR2ET(string, et)        ! String → TDB (ET)
ET2UTC(et, format, str)   ! TDB → UTC string
UTC2ET(string, et)       ! UTC string → TDB
UNITIM(epoch, insys, outsys)  ! TAI, GPS, TT, TDB, TCB, TCG, JED
```

**TDB-TT Relationship:**
```c
TDB - TT = K * sin(E)  // K ≈ 0.001657 seconds (periodic term)
```

**Source:** NAIF SPICE Time Subsystem documentation, NAIF/toolkit_docs/Tutorials/pdf/individual_docs/15_time.pdf

### SOFA (IAU Standards of Fundamental Astronomy)

**Available Time Scales:**
```
TAI, TT, TCG, TCB, TDB, UT1, UTC
```

**Key Time Functions:**
```
dtf2d()    ! Date/time fields → JD
jd2dtf()   ! JD → Date/time fields
utctai()   ! UTC → TAI
taitt()    ! TAI → TT
tttdb()    ! TT → TDB
dtdb()     ! TDB - TT approximation (Fairhead & Bretagnon 1990)
dat()      ! ΔAT (TAI - UTC) for given UTC date
```

**TDB-TT Model (eraDtdb):**
- Fairhead & Bretagnon (1990) full series (~800 terms)
- Topocentric correction from Moyer (1981) and Murray (1983)
- Accuracy: few nanoseconds (current era)
- Requires observer location (u, v distances) for topocentric term

**Source:** SOFA Time Scale and Calendar Tools (starlink.eao.hawaii.edu), ERFA documentation

### ERFA (Essential Routines for Fundamental Astronomy)

**License:** Three-clause BSD (unlike SOFA's more restrictive license)

**Key Difference from SOFA:**
- Runtime leap second table modification via `eraSetLeapSeconds()`

**Source:** liberfa/erfa GitHub repository

### Astropy Time (Python)

**Supported Scales:**
```
'tai', 'tcb', 'tcg', 'tdb', 'tt', 'ut1', 'utc', 'local'
```

**Key Feature:** Location-aware TDB-TT calculation using `astropy.coordinates.EarthLocation`

**Example:**
```python
from astropy.time import Time
t = Time('2006-01-15 21:24:37.5', format='iso', scale='utc', 
         location=(-155.933, 19.481, 0))
print(t.tt.iso)   # 2006-01-15 21:25:42.684
print(t.tdb.iso)  # 2006-01-15 21:25:42.684 (approximately)
```

**Source:** astropy.time documentation

---

## 7. The ISO 8601 Gap

### Standard ISO 8601-1:2019

- Covers UTC only
- No native support for TAI, GPS, TDB, TT
- Time zone offsets limited to hours:minutes (not seconds)

### ISO 8601 Extensions

**ISO 8601-2:2019 (Extensions):**
- Uncertain/approximate dates
- Extended time intervals
- Date/time arithmetic
- **Does NOT add time scale extensions**

**ISO 8601-2:2019/Amd 1:2025 (2025-01):**
- Canonical expressions
- Overflow/underflow handling
- **Still no time scale designators for TAI/GPS/TDB**

### Workarounds in Practice

1. **Time zone offset hack:**
   ```
   2026-01-01T00:00:00+00:00:37  ! Non-standard, but used by some
   ```

2. **Scale designators (SPICE-style):**
   ```
   2026-01-01T00:00:00 TAI
   2026-01-01T00:00:00 TDB
   ```

3. **IETF RFC 9557 (IXDTF):**
   - Internet Extended Date/Time Format
   - Extends RFC 3339
   - Supports `time-scale` suffix
   - Not widely adopted yet

### CCSDS ASCII Time Code

CCSDS 301.0-B-4 ASCII format allows scale suffixes:
```
YYYY-MM-DDThh:mm:ss.dddddddddZ  ! Z suffix = UTC
YYYY-DDDThh:mm:ss.dddddddd       ! No suffix = UTC implied
```

### Recommendation for GMT

Implement scale designators matching SPICE convention:
```typescript
'2026-01-01T00:00:00'        // UTC (default)
'2026-01-01T00:00:00 UTC'    // Explicit UTC
'2026-01-01T00:00:37 TAI'    // TAI
'2026-01-01T00:00:00 TDB'    // TDB
'2026-01-01T00:00:00 TT'     // TT/Terrestrial Time
'2026-01-01T00:00:00 GPS'    // GPS time
```

---

## 8. TDB/TT Relativistic Corrections

### The Problem

TDB and TT differ by periodic relativistic effects due to:
1. Earth's orbital velocity (~30 km/s)
2. Earth's position relative to solar system barycenter

### Magnitude

- Amplitude: ~1.6 milliseconds
- Period: ~1 sidereal year
- Rate variation: Clocks appear to run fast/slow by ~0.02 seconds/year at worst

### Simplified Models

**Model 1: TT + constant offset**
- Error: ~1.6 ms (too large for precision applications)

**Model 2: Fairhead & Bretagnon (1990)**
- ~800 term series
- Error: <10 ns (current era)
- Used by: ERFA, SPICE, astrotime

**Model 3: Simplified formula**
```
TDB - TT = 0.001657 * sin(2π * (JD - 2451545) / 365.25)
```
- Error: ~50 µs (acceptable for many applications)
- Used by: Some spacecraft navigation

### When Corrections Are Required

| Application | TDB-TT Model Required |
|-------------|----------------------|
| Solar system ephemeris | Full model (ERFA) |
| Spacecraft navigation | Full model |
| Ground-based astronomy | Full model or geocentric approximation |
| Earth-orbiting satellites | Geocentric approximation (zeroes OK) |
| Millisecond-precision ground ops | Simplified model sufficient |

### Implementation Recommendation for GMT

```typescript
// For < 10 µs accuracy (astropy/SPICE equivalent):
// Use USNO Circular 179 / Fairhead & Bretagnon model
const tdbMinusTt = computeTdbMinusTt(jdTdb, observerLongitude, u, v);

// For < 1 ms accuracy:
const tdbMinusTt = 0.001657 * Math.sin(2 * Math.PI * (jd - 2451545) / 365.25);

// For Earth-orbiting satellites (geocentric):
const tdbMinusTt = computeTdbMinusTt(jdTdb, 0, 0, 0);
```

---

## 9. Key Pitfalls and Edge Cases

### 1. Leap Second Boundary Dates
- 1972-01-01: TAI epoch (10s offset applied retroactively)
- 1972-06-30: First leap second inserted
- Leap seconds occur at: June 30 or December 31, 23:59:59 UTC

### 2. Leap Second Validation
```typescript
'2016-12-31T23:59:60'  // Valid (leap second)
'2016-12-31T23:59:61'  // Invalid
'2017-01-01T00:00:00'  // After leap second
```

### 3. Platform Date Behavior
- JavaScript `Date` treats leap seconds as 23:59:59.500 + 23:59:60.500
- Node.js vs browsers may differ
- Always validate leap seconds explicitly

### 4. Mission Time Interpretation
- MET (Mission Elapsed Time): From launch/separation
- SCLK: Spacecraft clock ticks
- Both require ICD documentation to interpret

### 5. TLE Epoch Format
```
25145.51234567  =  Day 145.51234567 of 2025
               =  2025-05-25 12:17:46.9 UTC (approximately)
```
- Day-of-year format
- Requires conversion to proper datetime

### 6. Spacecraft Clock Kernel
- Piecewise linear function (not simple offset)
- Requires LSK + SCLK kernel files to interpret
- SPICE handles this complexity

---

## 10. API Design Examples for GMT

### Example 1: Parse and Convert
```typescript
import { parseInstant, formatInstant, instantToScaleNanos } from 'gmt';

// Parse UTC with leap second validation
const instant = parseInstant('2016-12-31T23:59:60.000Z');
// instant = Instant at 2016-12-31 23:59:60 UTC

// Convert to TAI
const tai = instantToScaleNanos(instant, 'tai');
// tai = nanoseconds since 1970-01-01 TAI

// Convert to TDB (SPICE ET convention)
const j2000Tdb = instantToJ2000Seconds(instant, 'tdb');
// j2000Tdb = 51544.499163 - seconds past J2000 in TDB
```

### Example 2: String-in, String-out with Scale Designators
```typescript
import { parseScaleInstant, formatScaleInstant } from 'gmt';

// Parse TAI string
const instant = parseScaleInstant('2026-01-01T00:00:37 TAI');

// Format as UTC
formatScaleInstant(instant, 'utc');
// '2026-01-01T00:00:00.000000000Z'

// Format as GPS
formatScaleInstant(instant, 'gps');
// '2025-12-31T23:59:49.000000000 GPS' (GPS is 18s behind UTC)
```

### Example 3: Julian Date Support
```typescript
import { 
  instantToJulianDate, 
  instantFromJulianDate,
  instantToModifiedJulianDate 
} from 'gmt';

// J2000 epoch
const j2000 = instantFromJulianDate(2451545.0, 'tt');
// Returns Instant at 2000-01-01 12:00:00 TT

// MJD for ground station
const mjd = instantToModifiedJulianDate(instant, 'utc');
// 59583.523456 - Modified Julian Date
```

### Example 4: GPS Week/Seconds
```typescript
import { instantToGpsWeek, instantFromGpsWeek } from 'gmt';

// Convert to GPS week/seconds
const { week, secondsOfWeek } = instantToGpsWeek(instant);
// { week: 2274, secondsOfWeek: 123456.789 }

// Round-trip
const recovered = instantFromGpsWeek(2274, 123456.789);
```

### Example 5: TDB for Ephemeris
```typescript
import { instantToJ2000Seconds, computeTdbMinusTt } from 'gmt';

// Get TDB seconds for SPICE-style computation
const j2000Tdb = instantToJ2000Seconds(observationInstant, 'tdb');

// Optional: Get TDB-TT offset for diagnostics
const delta = computeTdbMinusTt(j2000Tdb, observerLon, u, v);
// delta ≈ 0.001657 seconds (periodic)
```

---

## 11. Summary Recommendations

### For GMT Library Design

1. **Primary time representation:** Nanoseconds since Unix epoch in TAI
   - Immutable `Instant` type
   - Leap-second-validated on parse
   - Continuous (no gaps)

2. **Supported time scales:**
   - UTC (with leap second validation)
   - TAI (internal representation)
   - TT (TAI + 32.184s)
   - GPS (TAI - 19s)
   - TDB (TT + periodic relativistic correction)

3. **String formats:**
   - ISO 8601 calendar: `2026-01-01T12:34:56.789012345Z`
   - ISO 8601 ordinal: `2026-001T12:34:56.789`
   - Scale designators: `2026-01-01T12:34:56 TAI`

4. **Julian Date support:**
   - JD, MJD, J2000 seconds
   - Two-part JD for precision

5. **Relativistic handling:**
   - Default: Simplified model for TDB-TT
   - Advanced: Full Fairhead & Bretagnon model
   - Location parameter for topocentric correction

6. **Leap second table:**
   - IERS Bulletin C as source
   - Runtime update capability
   - Expiration tracking

### Sources Summary

| Source | Key Content |
|--------|-------------|
| CCSDS 301.0-B-4 | Time code formats (CUC, CDS, CCS, ASCII) |
| CCSDS 502.0-B-3 | Orbit data messages, TIME_SYSTEM values |
| NAIF SPICE Time | TDB as ET, string parsing, SCLK handling |
| SOFA/ERFA | TDB-TT models, full time scale conversions |
| astropy.time | Python reference implementation |
| BIPM Circular T | TAI/GPS/UTC relationships |
| IERS Bulletin C | Leap second announcements |
| NASA CDF Time | Space data handling practices |

---

*Research completed: 2026-09-07*
*Next steps: Review with GMT architect and TDD developer*
