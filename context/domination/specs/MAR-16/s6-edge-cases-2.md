## 6. Edge-case test matrix (continued)

### 6.8 GNSS strings

| Call | Expected |
| --- | --- |
| `utcToGnss("GPS", "1980-01-06T00:00:00Z")` | `"1980-01-06T00:00:00 GPS"` (MAR-16: zero offset) |
| `utcToGnss("GPS", "1980-01-05T23:59:59Z")` | `""` |
| `utcToGnss("GPS", "2016-06-01T00:00:00Z")` | `"2016-06-01T00:00:17 GPS"` (MAR-16: 17 before the 2016 leap second) |
| `utcToGnss("GPS", "2024-01-01T00:00:00Z")` | `"2024-01-01T00:00:18 GPS"` (MAR-16: 18 ahead) |
| `utcToGnss("GPS", "2027-06-28T00:00:00Z")` | `"2027-06-28T00:00:18 GPS"` |
| `utcToGnss("GPS", "2016-12-31T23:59:60Z")` | `"2017-01-01T00:00:17 GPS"` |
| `utcToGnss("GPS", "2016-12-31T23:59:60.25Z")` | `"2017-01-01T00:00:17.25 GPS"` |
| `utcToGnss("GPS", "1999-08-21T23:59:47Z")` | `"1999-08-22T00:00:00 GPS"` |
| `gnssToUtc("GPS", "2024-01-01T00:00:18 GPS")` | `"2024-01-01T00:00:00Z"` |
| `gnssToUtc("GPS", "2017-01-01T00:00:17 GPS")` | `"2016-12-31T23:59:60Z"` |
| `gnssToUtc("GPS", "2017-01-01T00:00:17.25 GPS")` | `"2016-12-31T23:59:60.25Z"` |
| `gnssToUtc("GPS", "1980-01-06T00:00:00 GPS")` | `"1980-01-06T00:00:00Z"` |
| `gnssToUtc("GPS", "1980-01-05T23:59:59.999999999 GPS")` | `""` |
| `gnssToUtc("GPS", "2027-06-28T00:00:18 GPS")` | `"2027-06-28T00:00:00Z"` |
| `gnssToUtc("GPS", "2038-11-21T00:00:00 GPS")` | `"2038-11-20T23:59:42Z"` |
| `gnssToUtc("GPS", "2024-01-01T00:00:18 TAI")` | `""` |
| `utcToGnss("GAL", "1999-08-22T00:00:00Z")` | `"1999-08-22T00:00:13 GAL"` (MAR-16: the ICD's 13 s) |
| `utcToGnss("GAL", "1999-08-21T23:59:47Z")` | `"1999-08-22T00:00:00 GAL"` |
| `utcToGnss("GAL", "1999-08-21T23:59:46Z")` | `""` |
| `gnssToUtc("GAL", "1999-08-22T00:00:00 GAL")` | `"1999-08-21T23:59:47Z"` |
| `utcToGnss("GAL", "2024-01-01T00:00:00Z")` | `"2024-01-01T00:00:18 GAL"` |
| `utcToGnss("BDT", "2006-01-01T00:00:00Z")` | `"2006-01-01T00:00:00 BDT"` (MAR-16: equals UTC) |
| `utcToGnss("BDT", "2005-12-31T23:59:59Z")`, `utcToGnss("BDT", "2005-12-31T23:59:60Z")` | `""` |
| `utcToGnss("BDT", "2024-01-01T00:00:00Z")` | `"2024-01-01T00:00:04 BDT"` (MAR-16: 4 s) |
| `gnssToUtc("BDT", "2024-01-01T00:00:04 BDT")` | `"2024-01-01T00:00:00Z"` |
| `utcToGnss("QZS", "1980-01-06T00:00:00Z")` | `"1980-01-06T00:00:00 QZS"` |
| `utcToGnss("QZS", "2024-01-01T00:00:00Z")` | `"2024-01-01T00:00:18 QZS"` |
| `utcToGnss("GLO", "2024-01-01T00:00:00Z")` | `"2024-01-01T00:00:00 GLO"` (MAR-16, rewritten: UTC's own wall clock) |
| `utcToGnss("GLO", "2016-12-31T23:59:60Z")` | `"2016-12-31T23:59:60 GLO"` |
| `utcToGnss("GLO", "2016-12-31T23:59:60.25Z")` | `"2016-12-31T23:59:60.25 GLO"` |
| `utcToGnss("GLO", "2017-12-31T23:59:60Z")` | `""` |
| `utcToGnss("GLO", "1972-01-01T00:00:00Z")` | `"1972-01-01T00:00:00 GLO"` |
| `utcToGnss("GLO", "1971-12-31T23:59:59Z")` | `""` |
| `gnssToUtc("GLO", "2016-12-31T23:59:60 GLO")` | `"2016-12-31T23:59:60Z"` |
| `gnssToUtc("GLO", "2016-12-31T23:59:60.25 GLO")` | `"2016-12-31T23:59:60.25Z"` |
| `gnssToUtc("GLO", "2017-12-31T23:59:60 GLO")` | `""` |
| `gnssToUtc("GLO", "2024-01-01T00:00:00 GLO")` | `"2024-01-01T00:00:00Z"` |
| `gnssToUtc("GLO", "2024-01-01T03:00:00 GLONASST")` | `""` (not a RINEX token) |
| `utcToGnss("IRN", "1999-08-21T23:59:47Z")` | `"1999-08-22T00:00:00 IRN"` (NavIC epoch, ICD SPS 1.1 §5.7) |
| `utcToGnss("IRN", "1999-08-21T23:59:46Z")`, `utcToGnss("IRN", "1999-08-21T23:59:46.999999999Z")` | `""` |
| `utcToGnss("IRN", "2024-01-01T00:00:00Z")` | `"2024-01-01T00:00:18 IRN"` |
| `utcToGnss("IRN", "2016-12-31T23:59:60Z")` | `"2017-01-01T00:00:17 IRN"` |
| `gnssToUtc("IRN", "1999-08-22T00:00:00 IRN")` | `"1999-08-21T23:59:47Z"` |
| `gnssToUtc("IRN", "1999-08-21T23:59:59.999999999 IRN")` | `""` |
| `gnssToUtc("IRN", "2024-01-01T00:00:18 IRN")` | `"2024-01-01T00:00:00Z"` |
| `gnssToUtc("IRN", "2017-01-01T00:00:17 IRN")` | `"2016-12-31T23:59:60Z"` |
| `gnssToUtc("IRN", "2016-12-31T23:59:60 IRN")` | `""` (continuous scale) |
| `gnssToUtc("IRN", "2024-01-01T00:00:18 GPS")` | `""` (wrong token) |
| `utcToGnss("BDS" as never, "2024-01-01T00:00:00Z")` | `""` (not a RINEX time token) |

**Epoch sentinel per system** (MAR-16 verification) at `"1999-01-01T00:00:00Z"`: `"GPS"` →
`"1999-01-01T00:00:13 GPS"`, `"QZS"` → `"1999-01-01T00:00:13 QZS"`, `"GLO"` →
`"1999-01-01T00:00:00 GLO"`, `"GAL"` → `""`, `"BDT"` → `""`, `"IRN"` → `""` (verified).

**Properties (deterministic loops; values from the reference run):**

1. **Round trip:** for every insertion row, each TAI-based system and TAI, each `d` in `[-2 s, -1 s,
   -1 ns, 0, +1 ns, +1 s]` around `at`, plus `…T23:59:60.5Z`: when `utcToGnss(sys, iso)` is not `""`,
   `gnssToUtc(sys, it) === iso`. Reference run: 563 conversions, 0 failures. Add `GLO` and `IRN` to
   the loop.
2. **TAI − GPS = 19 s:** for each year 1980–2026 at `<year>-03-15T12:00:00Z`, the TAI and GPS labels
   differ by exactly 19 s. 0 exceptions.
3. **GAL agrees with GPS** (MAR-16): for each year 2000–2026 at `<year>-07-01T00:00:00Z`, the
   date-time parts of `utcToGnss("GAL", …)` and `utcToGnss("GPS", …)` are equal. 0 exceptions.
4. **GLO is UTC:** for the same sweep, `utcToGnss("GLO", iso)` is UTC's label followed by a space and `GLO`.

**Battle matrix:** for each `c`, `utcToGnss("GPS", c.value) === "2024-02-29T00:00:18 GPS"`.
