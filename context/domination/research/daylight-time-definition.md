# What "in daylight saving time" means, and how close GMT can get

**Question:** can `isInDaylightSaving(zonedString)` be made exactly right, and if not, which rule is most accurate without bundling time zone data?

**Answer:** no. There is no single exact definition to be right about, and the nearest thing to one (the IANA tz database's daylight flag) is not exposed by any JavaScript API and cannot be worked out from UTC offsets. Of the rules that need no data, the pairing rule in `packages/gmt/src/internal/daylightTime.ts` agrees most often with the flag that operating systems and ICU carry.

**Measured on:** Node 24.21.0, ICU 78.3, CLDR 48.0, `process.versions.tz` 2026c, `@js-temporal/polyfill` 0.5.1, macOS system zoneinfo `+VERSION` 2026c. The latest IANA release is 2026e.

---

## 1. The authority

### 1.1 Who defines the flag

| Source | What it says |
| --- | --- |
| POSIX `<time.h>` | `tm_isdst` "shall be positive if Daylight Saving Time (DST) is in effect and 0 if DST is not in effect". POSIX does not say what makes DST "in effect" for a real place. |
| RFC 9636 (TZif) §3.2 | `isdst` is "a one-octet value indicating whether local time should be considered Daylight Saving Time". It is a stored value per local time type, not something computed from the offset. |
| IANA tz database, `zic.8` | The `SAVE` column "gives the amount of time to be added to local standard time when the rule is in effect, and whether the resulting time is standard or daylight saving". The flag defaults to daylight when `SAVE` is not zero. "Negative offsets are allowed; in Ireland, for example, daylight saving time is observed in winter and has a negative offset relative to Irish Standard Time." |
| IANA tz database, `theory.html` | "The `tm_isdst` member is almost never needed and most of its uses should be discouraged." tz `NEWS` calls the flags "obsolescent" (release 2025a). |
| ECMA-402 | `ToLocalTime` returns an internal `[[InDST]]` field: "Calculate true or false using the best available information about the specified calendar and timeZoneIdentifier, including current and historical information from the IANA Time Zone Database". The time zone name "may depend on the value of the `[[InDST]]` field". The field is internal. No API returns it. |
| TC39 Temporal | The specification has no daylight property on `Temporal.ZonedDateTime`. It defines only offsets and transitions ("a point in time where the UTC offset of a time zone changes"). |
| CLDR (UTS 35 part 4) | `usesMetazone` may state "which offset is considered standard time, and which offset is considered daylight time. This is required for some zone such as `Europe/Dublin` where TZDB returns inconsistent results depending on platform/build mode". |

Sources:

- https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/time.h.html
- https://www.rfc-editor.org/rfc/rfc9636.html#section-3.2
- https://data.iana.org/time-zones/tzdb/zic.8.txt
- https://data.iana.org/time-zones/tzdb/theory.html
- https://data.iana.org/time-zones/tzdb/NEWS
- https://tc39.es/ecma402/#sec-tolocaltime and https://tc39.es/ecma402/#sec-formatdatetimepattern
- https://tc39.es/proposal-temporal/
- https://unicode.org/reports/tr35/tr35-dates.html#Metazone_Names

### 1.2 Temporal leaves the flag out on purpose

The specification is silent. The proposal's champions gave the reasons in the proposal's issue tracker (commentary, not specification):

- "Being 'in DST' is meaningless for most of the world which doesn't use DST."
- "It doesn't take other UTC offset shifts into account."
- "There are edge cases such as Ireland ... and Morocco."
- The common use is choosing a display name, and "`Intl.DateTimeFormat` can do this for you".
- For a caller who must supply the bit to another system: "hardcode a list of time zones and time periods for which an 'in DST' heuristic works, and then use whatever heuristic works for your application".

Source: https://github.com/tc39/proposal-temporal/issues/3074

### 1.3 The tz database publishes three forms, and they disagree by design

tz ships the same data as `vanguard`, `main` and `rearguard` forms (`NEWS`, release 2018d). Since release 2018e "the main format uses negative DST again", and the change "does not affect UT offsets, only time zone abbreviations and the tm_isdst flag". The rearguard form exists for "data parsers that do not support negative DST".

Compiling tzdata 2026c in all three forms and comparing the flag over 1970 to 2037 gives these differences. Offsets are identical in every sample.

| Zone | Period | main and vanguard | rearguard |
| --- | --- | --- | --- |
| `Europe/Dublin` | 1971-10-31 onward | winter (GMT) is daylight, summer is standard | summer is daylight |
| `Africa/Windhoek` | 1994-03-20 to 2017-10-23 | winter (+01) is daylight | summer (+02) is daylight |
| `Africa/Casablanca`, `Africa/El_Aaiun` | late October 2018 to 2026-09-20 | the Ramadan weeks at +00 are daylight | the months at +01 are daylight |

main and vanguard are identical to each other in every sample. `Europe/Prague` 1946 to 1947 also differs, outside the measured window (`NEWS`, release 2018e).

Which form a machine has is a build choice:

- ICU builds its zone data from the rearguard form (`awk -v DATAFORM=rearguard -f ziguard.awk` in ICU's `tools/tzcode/Makefile.in`). Node's `Intl` is ICU.
- This machine's `/usr/share/zoneinfo` matches a rearguard build of 2026c in all 745,431 samples, and differs from a main build in 3,174.
- A default `make install` of tz uses the main form.

Source: https://github.com/unicode-org/icu/blob/main/icu4c/source/tools/tzcode/Makefile.in

### 1.4 The flag also changes where the clocks do not

`NEWS` records flag changes with no offset change, and flag dates that tz itself calls temporary:

- `Europe/Istanbul`: the flag is 1 from 2016-03-27 and turns 0 on 2016-09-07. The offset is +03:00 on both sides.
- `America/Nuuk`: "changed its standard time from -03 to -02 on 2023-03-25, not on 2023-10-28. This does not affect UTC offsets, only the tm_isdst flag" (release 2023d).
- `America/Vancouver`: "Although the change to permanent -07 legally took place on 2026-03-09, temporarily model the change to occur on 2026-11-01 at 02:00 instead. This works around a limitation in CLDR 48.1 ... This temporary hack is planned to be removed after CLDR is fixed" (release 2026b). `America/Edmonton` follows the same pattern (2026c).

### 1.5 Conclusion on the authority

One exact definition does not exist.

- POSIX and RFC 9636 define a bit and leave its value to the data.
- The tz database is the only source of values, and it publishes two sets that differ for four zones in the measured window.
- tz treats the flag as obsolescent and changes past values between releases.
- CLDR lets a zone's standard and daylight offsets be stated apart from tz, and ICU's zone data differs from tz for two zones (section 2).
- Temporal declines to define it.

"Exact" can only mean "equal to one named form of one named tz release".

---

## 2. What a JavaScript runtime exposes

| Signal | Reads the tz flag? | Exact? |
| --- | --- | --- |
| `Temporal.ZonedDateTime` `offset`, `offsetNanoseconds`, `getTimeZoneTransition` | No. Offsets and offset changes only. | n/a |
| `Date` | No. `getTimezoneOffset()` is an offset. | n/a |
| `Intl.DateTimeFormat` `timeZoneName: "long"` or `"short"` | Indirectly. ICU's `TimeZoneFormat::formatSpecific` calls `tz.inDaylightTime(date)` and returns the daylight name when true, the standard name when false. | No. See below. |
| `Intl.DateTimeFormat` `"longGeneric"`, `"shortGeneric"` | No. Generic names are the same all year. | n/a |
| `Intl.DateTimeFormat` `"longOffset"`, `"shortOffset"` | No. Offsets. | n/a |
| `Intl.Locale`, `Intl.supportedValuesOf`, `resolvedOptions()` | No. | n/a |
| Node (`process.versions.tz`, `process.binding`, `TZ`) | No flag. Only the tz release ICU was built from. | n/a |

Source for ICU's choice of name: https://github.com/unicode-org/icu/blob/main/icu4c/source/i18n/tzfmt.cpp (`TimeZoneFormat::formatSpecific`)

The `long` name is the only signal that carries the flag. It fails in four ways.

1. **No name, no signal.** When CLDR has no name for the zone at that time, ICU prints an offset such as `GMT+01:00`, the same string in both states. In `en-US` this covers 31,173 of 745,431 samples (4.2%) across 77 zones, including 11,553 of the 162,902 daylight samples (7.1%). From 2000 it covers 8,778 samples in 27 zones: `Africa/Casablanca`, `Africa/El_Aaiun`, `Africa/Windhoek`, `America/Argentina/Ushuaia`, `America/Coyhaique`, `America/Mendoza`, `America/Punta_Arenas`, `Antarctica/Palmer`, `Antarctica/Troll`, `Asia/Amman`, `Asia/Atyrau`, `Asia/Barnaul`, `Asia/Bishkek`, `Asia/Chita`, `Asia/Damascus`, `Asia/Famagusta`, `Asia/Oral`, `Asia/Qostanay`, `Asia/Sakhalin`, `Asia/Srednekolymsk`, `Asia/Tomsk`, `Asia/Urumqi`, `Europe/Guernsey`, `Europe/Isle_of_Man`, `Europe/Jersey`, `Europe/Kirov`, `Pacific/Bougainville`. Coverage differs by locale: `fr` has no name in 33,523 samples and `ja` in 32,000.
2. **The name is text, not a flag.** The API returns two different strings. Telling which one is the daylight name means matching words. In English, "Daylight" or "Summer" works for every zone but one: CLDR's daylight name for `Europe/Dublin` is "Irish Standard Time" (1,122 samples).
3. **ICU's flag is not always tz's flag.** ICU's 2026c zone data stores `America/Vancouver` after 2026-11-01 as -08:00 plus one hour of daylight time. tz 2026c stores it as -07:00 standard time. So ICU reports "Pacific Daylight Time" where the tz flag is 0, and "Mountain Daylight Time" for `America/Edmonton` (540 samples). Source: https://github.com/unicode-org/icu-data/blob/main/tzdata/icunew/2026c/44/zoneinfo64.txt
4. **ECMA-402 does not promise it.** The string "depends upon the implementation and the effective locale" and only "may" depend on `[[InDST]]`.

Where a name exists and the zone is not one of those three, the English keyword matched the system flag in every sample.

---

## 3. Measurement

### 3.1 Method

- **Reference:** `zdump -v` on the system zoneinfo, which holds tzdata 2026c in rearguard form. A second reference is tzdata 2026c compiled in main form with tz's own `zic` and read with tz's own `zdump`.
- **Zones:** the 418 zones in `Intl.supportedValuesOf("timeZone")` plus `UTC`. `zdump` knows all of them.
- **Samples:** 12:00 UTC on the 1st and 15th of every month from 1970 to 2037 (683,808 "grid" samples), plus one second before, at, and one second after every change `zdump` reports in that window (61,623 "edge" samples). 745,431 in total, 417,026 of them from 2000 onward. 162,902 samples are daylight time in the reference.
- **OLD rule** (committed): re-implemented in the measuring script on the plain polyfill, line for line from `git show HEAD:packages/gmt/src/zoned/compare/isInDaylightSaving.ts`.
- **NEW rule** (working tree): the built `isInDaylightSaving` from `packages/gmt/dist`, called with a zoned string. The internal `isInDaylightTime` gave the same answer in every sample.
- **Intl signal:** `en-US` `timeZoneName: "long"` contains "Daylight" or "Summer"; no signal when the name starts with "GMT".
- **Version check:** the system zoneinfo and Node's ICU are both 2026c. The polyfill's offset equals `zdump`'s `gmtoff` in all 745,431 samples. No mismatch below comes from a version difference.

### 3.2 Results against the rearguard form (system zoneinfo, and the form ICU uses)

| Rule | All samples | Zones | From 2000 | Zones | From 2000, grid only |
| --- | --- | --- | --- | --- | --- |
| OLD (lower of 15 Jan and 15 Jul) | 5,301 wrong (0.711%) | 162 | 2,330 (0.559%) | 104 | 1,986 (0.520%) |
| NEW (paired clock changes) | 3,409 wrong (0.457%) | 119 | 1,375 (0.330%) | 64 | 1,150 (0.301%) |
| Intl name alone | 1,662 wrong and 31,173 with no signal | 79 | 1,186 wrong and 8,778 no signal | 30 | |
| Intl name, NEW where there is no name | 2,289 wrong (0.307%) | 26 | 1,271 (0.305%) | 10 | 1,134 (0.297%) |
| Intl name, OLD where there is no name | 2,865 wrong (0.384%) | 35 | 1,676 (0.402%) | 15 | 1,485 (0.389%) |

Direction of the errors, from 2000:

| Rule | Says daylight, reference says standard | Says standard, reference says daylight |
| --- | --- | --- |
| OLD | 1,356 | 974 |
| NEW | 134 | 1,241 |

By period, grid samples only (110,627 samples in each period):

| Period | OLD | NEW | Intl name with NEW |
| --- | --- | --- | --- |
| 2016 to 2026 | 700 | 305 | 165 |
| 2027 to 2037 | 0 | 0 | 682 |

From 2027 to 2037 tz's rules repeat unchanged, and both rules match the rearguard flag in every grid sample. Their errors sit in years when a zone changed its rules, with one exception: OLD is wrong for Morocco in every year from 2019 to 2026. The Intl signal is wrong in every future year because of Dublin, Vancouver and Edmonton.

On 2026-10-01 the OLD rule is right for every zone. The NEW rule is wrong for `America/Vancouver` and `America/Edmonton`: tz 2026c holds the flag at 1 until 2026-11-01, and NEW reads the March 2026 advance as a change of standard time because nothing undoes it. tz's own `NEWS` gives the legal change as 2026-03-09 and 2026-06-18 and calls the November date a temporary hack.

### 3.3 Results against the main form

| Rule | All samples | From 2000 | Grid 2016 to 2026 | Grid 2027 to 2037 |
| --- | --- | --- | --- | --- |
| OLD | 7,711 (1.034%) | 3,721 (0.892%) | 724 | 264 |
| NEW | 6,571 (0.882%) | 3,518 (0.844%) | 987 | 264 |
| Intl name with NEW | 3,207 (0.430%) | 2,122 (0.509%) | 539 | 638 |
| Intl name with OLD | 3,031 (0.407%) | 1,775 (0.426%) | | |

Neither rule can report negative daylight time, so both miss every Dublin winter (the 264). OLD does better than NEW from 2016 to 2026 only because it reports no daylight time at all in Morocco from 2019, which matches main at +01 and misses the Ramadan weeks.

### 3.4 Causes: NEW rule, against rearguard

| Cause | All | Zones | From 2000 | Zones |
| --- | --- | --- | --- | --- |
| Clocks go back by a different amount than they went forward, because standard time moved at the start or end of the period | 1,609 | 80 | 289 | 15 |
| Daylight time ends with no clock change: standard time moves up to the daylight offset (`Europe/Istanbul` 2016, `America/Vancouver` 2026) | 1,051 | 62 | 556 | 42 |
| Daylight period lasts 365 days or longer (`America/Santiago` 2014 to 2016, `America/Havana` 2004 to 2006, `Asia/Amman` 2012 to 2013) | 438 | 10 | 364 | 8 |
| Says daylight, reference says standard: standard time moved forward and back by the same amount within 365 days (`Antarctica/Casey`, `America/Metlakatla` 2018 to 2019) | 232 | 13 | 134 | 6 |
| Other: daylight period interrupted by a move of standard time | 79 | 8 | 32 | 3 |

### 3.5 Causes: OLD rule, against rearguard

| Cause | All | Zones | From 2000 | Zones |
| --- | --- | --- | --- | --- |
| Says daylight, reference says standard: the standard offset changed during the calendar year, so the offset is above the lower sample (`Europe/Moscow` 2011, `Europe/Istanbul` late 2016) | 2,502 | 125 | 1,356 | 85 |
| The standard offset changed in the year, so the sample that falls in daylight time is not above the other sample | 1,423 | 69 | 306 | 18 |
| The standard offset changed in the year, so the daylight offset equals the lower sample | 173 | 14 | 72 | 12 |
| 15 January and 15 July are both in daylight time (`Africa/Casablanca` 2019 to 2026, `America/Santiago` 2015) | 1,203 | 37 | 596 | 10 |

The zone and year lists are in the appendix.

### 3.6 Zone-level question

For each zone and each calendar year, the reference answer is "the flag is 1 at some sample in that year". 28,492 zone-years, 15,922 from 2000.

| Definition | Wrong, all | Wrong, from 2000 |
| --- | --- | --- |
| 15 January and 15 July offsets differ in that year (OLD `hasDaylightSaving`, with the year as input) | 395 | 157 |
| NEW `observesDaylightTime` at 1 January of that year | 205 | 81 |

A fixed 2024 answers wrongly for 2027 in seven zones: it says yes for `America/Asuncion`, `America/Coyhaique`, `America/Edmonton`, `America/Vancouver`, `Asia/Almaty` and `Asia/Qostanay`, and no for `America/Scoresbysund`. `observesDaylightTime` at 2027-01-01 matches the reference for every zone.

### 3.7 Not measured

- Any engine other than Node 24.21.0 with ICU 78.3 and CLDR 48. Browsers, older ICU and CLDR releases, and Node built with `small-icu` were not run. The Intl results depend on the ICU and CLDR release.
- Instants before 1970 or after 2037.
- Name matching in any language other than English. Only the count of missing names was taken for `fr` and `ja`.
- tzdata 2026d and 2026e. Both the system and ICU hold 2026c.
- A native `Temporal`. Node 24 has none, so everything ran on the polyfill.
- The OLD rule as built at `HEAD`. It was re-implemented in the script.
- Rates are per sample, not per unit of time. The grid-only columns are the closest to a time-weighted figure.

---

## 4. Conclusions

### 4.1 Is an exact answer achievable without owning tz data?

**No**, for two independent reasons.

1. **The flag is not a function of the offsets.** `Europe/Istanbul` is at +03:00 from 2016-03-27 onward and the flag changes on 2016-09-07. The main and rearguard forms have identical offsets and opposite flags for `Europe/Dublin`. Temporal exposes offsets only, so no rule on Temporal can recover the flag in these cases.
2. **The one API that carries the flag is not reliable.** `Intl.DateTimeFormat` names give no signal in 4.2% of samples, need English word matching, follow ICU's own zone data where it differs from tz, and are implementation-dependent by specification.

Even with data, "exact" needs a choice of form and release, and tz revises past flags.

### 4.2 Which rule is most accurate

The NEW rule, against the form runtimes carry.

- From 2000 it is wrong in 1,375 samples (0.330%, 64 zones). The OLD rule is wrong in 2,330 (0.559%, 104 zones).
- When NEW says daylight it is almost always right: 134 false "daylight" samples in 6 zones from 2000, against 1,356 in 85 zones for OLD.
- It agrees with the rearguard form, ICU and CLDR on Dublin, Windhoek and Casablanca.

Its stated limits must be:

- It is GMT's own definition (a forward clock change undone by an equal backward change less than 365 days later), not tz's flag.
- It reads as standard time: the last summer before a zone keeps its daylight offset for good, a daylight period held 365 days or longer, and a daylight period whose start or end coincides with a move of standard time.
- It reads as daylight time: a move of standard time that is reversed by the same amount within 365 days.
- It never reports negative daylight time, so it differs from tz's main form for Dublin winters, Windhoek winters 1994 to 2017 and Morocco's Ramadan weeks 2018 to 2026.
- Its answer for a past instant can change when the runtime's tz data learns that a zone stopped changing its clocks.
- It differs from the tz 2026c flag today for `America/Vancouver` and `America/Edmonton`, until 2026-11-01.

### 4.3 Options

| Option | From 2000, against rearguard | Cost |
| --- | --- | --- |
| Keep OLD, document the limit | 2,330 wrong | Twice the errors of NEW. Ten times the false "daylight" answers. |
| Adopt NEW | 1,375 wrong | The limits in 4.2. |
| NEW plus the Intl name where one exists | 1,271 wrong | Saves 104 samples in the past. Adds 62 wrong grid samples in every future year (Dublin, Vancouver, Edmonton) unless those zones are special-cased. Depends on English CLDR wording, which no specification fixes, and on the ICU and CLDR release. |
| Optional data subpath carrying one tz form's flag | 0 wrong against that form and release | GMT owns tz data. tz published five releases between 2026-03-01 and 2026-09-29, so it goes stale within weeks. The flag can then disagree with the runtime's offsets when the two hold different releases. The caller must still choose main or rearguard. |

### 4.4 Recommendation

**Adopt the NEW rule and document it as GMT's definition of daylight time, not as tz's flag.**

- Exactness is not available, so the choice is between heuristics, and NEW has 41% fewer errors than OLD from 2000 (1,375 against 2,330) and 90% fewer false "daylight" answers (134 against 1,356).
- Do not add the Intl name. Its gain is 104 samples out of 417,026, it is wrong in every future year for three zones, and it rests on display text.
- Do not ship a data subpath for this. The authority itself calls the flag obsolescent and "almost never needed", and Temporal leaves it out on purpose. If a story needs the tz bit for exchange with another system, that story should take the bit from the caller.

### 4.5 `hasDaylightSaving(timeZone)`

A zone "has" daylight time only relative to a moment. A defensible, deterministic definition:

> The zone is in daylight time, by the `isInDaylightSaving` rule, at the reference instant or at some instant in the 365 days after it.

- The reference instant is an argument. With the same argument and the same tz data the answer never changes.
- This is what `observesDaylightTime` already computes. It is wrong in 81 of 15,922 zone-years from 2000, against 157 for the January and July comparison.
- A fixed year is deterministic but goes stale: 2024 is already wrong for seven zones in 2027.
- Reading the clock is the right default for the question "does this zone change its clocks now", but it is not deterministic. It should be the default for an omitted reference, not the only mode.

---

## Appendix: zones and years that disagree with the rearguard flag

Years are those touched by a run of mismatching samples.

**OLD — says daylight, tzdb says standard: standard offset changed during the calendar year: 2502 samples, 125 zones; 2000+ 1356 samples, 85 zones**

`Africa/Algiers` 1977, 1981 · `Africa/Casablanca` 1984 · `Africa/Ceuta` 1984 · `Africa/El_Aaiun` 1976 · `Africa/Juba` 2021 · `Africa/Sao_Tome` 2019 · `Africa/Tripoli` 1990, 1997, 2013 · `Africa/Windhoek` 1994, 2017 · `America/Adak` 1983 · `America/Anchorage` 1983 · `America/Argentina/San_Juan` 2004 · `America/Argentina/San_Luis` 2004, 2009 · `America/Asuncion` 1972, 1974, 2024 · `America/Bahia_Banderas` 2010 · `America/Cambridge_Bay` 1999–2000 · `America/Cancun` 1981, 1983, 1997, 2015 · `America/Caracas` 2016 · `America/Chihuahua` 2022 · `America/Ciudad_Juarez` 2022 · `America/Dawson` 1973, 2020 · `America/Dawson_Creek` 1972 · `America/Edmonton` 2026 · `America/Eirunepe` 2008 · `America/Fort_Nelson` 2015 · `America/Godthab` 2023 · `America/Grand_Turk` 2015 · `America/Guyana` 1975, 1992 · `America/Indiana/Knox` 1991 · `America/Indiana/Petersburg` 1977, 2007 · `America/Indiana/Vincennes` 2007 · `America/Indiana/Winamac` 2007 · `America/Inuvik` 1979 · `America/Iqaluit` 2000 · `America/Kentucky/Monticello` 2000 · `America/Managua` 1973, 1975 · `America/Mendoza` 2004 · `America/Merida` 1981 · `America/Metlakatla` 2018 · `America/Miquelon` 1980 · `America/Nome` 1983 · `America/North_Dakota/Beulah` 2010 · `America/North_Dakota/Center` 1992 · `America/North_Dakota/New_Salem` 2003 · `America/Ojinaga` 2022 · `America/Paramaribo` 1984 · `America/Punta_Arenas` 2016 · `America/Rankin_Inlet` 2000 · `America/Resolute` 2000, 2006 · `America/Rio_Branco` 2008 · `America/Santarem` 2008 · `America/Santo_Domingo` 1974 · `America/Scoresbysund` 1981 · `America/Swift_Current` 1972 · `America/Vancouver` 2026 · `America/Whitehorse` 2020 · `Antarctica/Casey` 2009–2012, 2016, 2018–2023 · `Antarctica/Davis` 2010, 2012 · `Antarctica/Palmer` 1982, 2016 · `Antarctica/Vostok` 1994 · `Asia/Almaty` 1992, 2024 · `Asia/Amman` 2022 · `Asia/Anadyr` 1992, 2011 · `Asia/Aqtau` 1981, 1992, 2004 · `Asia/Aqtobe` 1981, 1992 · `Asia/Ashgabat` 1992 · `Asia/Atyrau` 1981, 1992, 2004 · `Asia/Bahrain` 1972 · `Asia/Baku` 1992 · `Asia/Barnaul` 1992, 2011, 2016 · `Asia/Bishkek` 2005 · `Asia/Chita` 1992, 2011, 2016 · `Asia/Colombo` 1996, 2006 · `Asia/Damascus` 2022 · `Asia/Dili` 1976, 2000 · `Asia/Famagusta` 2016 · `Asia/Irkutsk` 1992, 2011 · `Asia/Kamchatka` 1992, 2011 · `Asia/Khandyga` 1992, 2011 · `Asia/Krasnoyarsk` 1992, 2011 · `Asia/Magadan` 1992, 2011, 2016 · `Asia/Novokuznetsk` 1992, 2011 · `Asia/Novosibirsk` 1992, 2011, 2016 · `Asia/Omsk` 1992, 2011 · `Asia/Oral` 1981, 1992, 2004 · `Asia/Pyongyang` 2018 · `Asia/Qatar` 1972 · `Asia/Qostanay` 1981, 1992, 2004, 2024 · `Asia/Qyzylorda` 1981, 1992, 2004 · `Asia/Saigon` 1975 · `Asia/Sakhalin` 1992, 2011, 2016 · `Asia/Samarkand` 1981 · `Asia/Srednekolymsk` 1992, 2011 · `Asia/Tbilisi` 1994, 2005 · `Asia/Tehran` 1977 · `Asia/Thimphu` 1987 · `Asia/Tomsk` 1992, 2011, 2016 · `Asia/Ust-Nera` 1981, 1992, 2011 · `Asia/Vladivostok` 1992, 2011 · `Asia/Yakutsk` 1992, 2011 · `Asia/Yekaterinburg` 1992, 2011 · `Asia/Yerevan` 1995 · `Atlantic/Azores` 1992 · `Atlantic/Cape_Verde` 1975 · `Atlantic/Stanley` 1983, 2010 · `Australia/Lord_Howe` 1981 · `Europe/Astrakhan` 1991, 2011, 2016 · `Europe/Istanbul` 1978, 2016 · `Europe/Kaliningrad` 2011 · `Europe/Kirov` 1991, 2011 · `Europe/Lisbon` 1992 · `Europe/Minsk` 2011 · `Europe/Moscow` 1992, 2011 · `Europe/Samara` 1991, 2011 · `Europe/Saratov` 1991, 2011, 2016 · `Europe/Simferopol` 1990, 1994, 2014 · `Europe/Ulyanovsk` 1992, 2011, 2016 · `Europe/Vilnius` 1999 · `Europe/Volgograd` 1991, 2011, 2018 · `Pacific/Bougainville` 2014 · `Pacific/Enderbury` 1979 · `Pacific/Fakaofo` 2011 · `Pacific/Kiritimati` 1979 · `Pacific/Kwajalein` 1993 · `Pacific/Nauru` 1979 · `Pacific/Pitcairn` 1998
**OLD — says standard, tzdb says daylight: the daylight sample offset is not above the other sample (standard offset changed in the year): 1423 samples, 69 zones; 2000+ 306 samples, 18 zones**

`America/Argentina/San_Luis` 1991 · `America/Cambridge_Bay` 2001 · `America/Chihuahua` 1998 · `America/Ciudad_Juarez` 1998 · `America/Coyhaique` 2025 · `America/Grand_Turk` 2018 · `America/Indiana/Knox` 2006 · `America/Indiana/Petersburg` 2006 · `America/Indiana/Tell_City` 2006 · `America/Indiana/Vincennes` 2006 · `America/Indiana/Winamac` 2006 · `America/Juneau` 1980 · `America/Menominee` 1973 · `America/Metlakatla` 2019 · `America/Ojinaga` 1998 · `America/Rankin_Inlet` 2001 · `America/Resolute` 2001, 2007 · `America/Scoresbysund` 2024 · `Asia/Almaty` 1991 · `Asia/Anadyr` 1982, 1991, 2010 · `Asia/Aqtau` 1982, 1991 · `Asia/Aqtobe` 1982, 1991 · `Asia/Ashgabat` 1991 · `Asia/Atyrau` 1982, 1991, 1999 · `Asia/Baku` 1991 · `Asia/Barnaul` 1991, 1995 · `Asia/Bishkek` 1991 · `Asia/Chita` 1991 · `Asia/Dushanbe` 1991 · `Asia/Irkutsk` 1991 · `Asia/Kamchatka` 1991, 2010 · `Asia/Khandyga` 1991 · `Asia/Krasnoyarsk` 1991 · `Asia/Magadan` 1991 · `Asia/Novokuznetsk` 1991, 2010 · `Asia/Novosibirsk` 1991, 1993 · `Asia/Omsk` 1991 · `Asia/Oral` 1982, 1989 · `Asia/Qostanay` 1982, 1991 · `Asia/Qyzylorda` 1982, 1991 · `Asia/Sakhalin` 1991, 1997 · `Asia/Samarkand` 1982 · `Asia/Srednekolymsk` 1991 · `Asia/Tashkent` 1991 · `Asia/Tbilisi` 1991, 2004 · `Asia/Tomsk` 1991, 2002 · `Asia/Ust-Nera` 1991 · `Asia/Vladivostok` 1991 · `Asia/Yakutsk` 1991 · `Asia/Yekaterinburg` 1991 · `Asia/Yerevan` 1991 · `Atlantic/Azores` 1993 · `Europe/Astrakhan` 1989, 1992 · `Europe/Chisinau` 1990 · `Europe/Kaliningrad` 1989 · `Europe/Kiev` 1990–1991 · `Europe/Kirov` 1989, 1992 · `Europe/Lisbon` 1996 · `Europe/Minsk` 1991 · `Europe/Moscow` 1991 · `Europe/Riga` 1989 · `Europe/Samara` 1989, 1991, 2010 · `Europe/Saratov` 1988, 1992 · `Europe/Simferopol` 1997 · `Europe/Tallinn` 1989 · `Europe/Ulyanovsk` 1989, 1991 · `Europe/Vilnius` 1989, 1998 · `Europe/Volgograd` 1988, 1992 · `Pacific/Easter` 1982
**OLD — says standard, tzdb says daylight: 15 January and 15 July are both in daylight time: 1203 samples, 37 zones; 2000+ 596 samples, 10 zones**

`Africa/Casablanca` 2019–2026 · `Africa/El_Aaiun` 2019–2026 · `America/Adak` 1974 · `America/Anchorage` 1974 · `America/Chicago` 1974 · `America/Coyhaique` 2015 · `America/Denver` 1974 · `America/Detroit` 1974 · `America/Havana` 2005–2006 · `America/Indiana/Knox` 1974 · `America/Indiana/Marengo` 1974 · `America/Indiana/Petersburg` 1974 · `America/Jamaica` 1974 · `America/Juneau` 1974 · `America/Kentucky/Monticello` 1974 · `America/Los_Angeles` 1974 · `America/Louisville` 1974 · `America/Menominee` 1974 · `America/Metlakatla` 1974 · `America/Montevideo` 1974, 1979 · `America/New_York` 1974 · `America/Nome` 1974 · `America/North_Dakota/Beulah` 1974 · `America/North_Dakota/Center` 1974 · `America/North_Dakota/New_Salem` 1974 · `America/Punta_Arenas` 2015 · `America/Santiago` 2015 · `America/Sitka` 1974 · `America/Tijuana` 1974 · `America/Yakutat` 1974 · `Antarctica/Macquarie` 2010 · `Antarctica/Palmer` 2015 · `Asia/Amman` 2013 · `Asia/Hong_Kong` 1974 · `Asia/Macau` 1974 · `Asia/Tbilisi` 1997 · `Pacific/Easter` 2015
**OLD — says standard, tzdb says daylight: daylight offset equals the lower of the two sample offsets (standard offset changed in the year): 173 samples, 14 zones; 2000+ 72 samples, 12 zones**

`America/Argentina/La_Rioja` 1999–2000 · `America/Argentina/Rio_Gallegos` 1999–2000 · `America/Argentina/Salta` 1999–2000 · `America/Argentina/San_Juan` 1999–2000 · `America/Argentina/San_Luis` 1999–2000 · `America/Argentina/Tucuman` 1999–2000 · `America/Argentina/Ushuaia` 1999–2000 · `America/Buenos_Aires` 1999–2000 · `America/Cancun` 1998 · `America/Catamarca` 1999–2000 · `America/Cordoba` 1999–2000 · `America/Jujuy` 1999–2000 · `America/Mendoza` 1999–2000 · `Atlantic/Stanley` 1985
**NEW — says standard, tzdb says daylight: clocks go back by a different amount than they went forward (standard time moves at the start or end): 1609 samples, 80 zones; 2000+ 289 samples, 15 zones**

`America/Argentina/La_Rioja` 1990–1991 · `America/Argentina/Salta` 1990–1992 · `America/Argentina/San_Juan` 1990–1991 · `America/Argentina/San_Luis` 1989–1990 · `America/Argentina/Tucuman` 1990–1992 · `America/Bahia_Banderas` 2010 · `America/Cambridge_Bay` 2001 · `America/Catamarca` 1990–1992 · `America/Chihuahua` 1998 · `America/Ciudad_Juarez` 1998 · `America/Cordoba` 1990–1992 · `America/Grand_Turk` 2018 · `America/Indiana/Knox` 2006 · `America/Indiana/Petersburg` 2006 · `America/Indiana/Tell_City` 2006 · `America/Indiana/Vincennes` 2006 · `America/Indiana/Winamac` 2006–2007 · `America/Inuvik` 1979 · `America/Iqaluit` 1999 · `America/Jujuy` 1989–1992 · `America/Juneau` 1983 · `America/Mendoza` 1989–1990, 1992–1993 · `America/Menominee` 1973 · `America/Montevideo` 1974 · `America/Nome` 1983 · `America/Ojinaga` 1998 · `America/Rankin_Inlet` 2001 · `America/Resolute` 2001, 2007 · `America/Scoresbysund` 1981, 2024 · `America/Sitka` 1983 · `Asia/Almaty` 1991 · `Asia/Anadyr` 1982, 1991, 2010 · `Asia/Aqtau` 1991, 1994 · `Asia/Aqtobe` 1982, 1991 · `Asia/Ashgabat` 1991 · `Asia/Atyrau` 1991, 1999 · `Asia/Baku` 1991 · `Asia/Barnaul` 1991 · `Asia/Bishkek` 1991 · `Asia/Chita` 1991 · `Asia/Dushanbe` 1991 · `Asia/Irkutsk` 1991 · `Asia/Kamchatka` 1991, 2010 · `Asia/Khandyga` 1991 · `Asia/Krasnoyarsk` 1991 · `Asia/Magadan` 1991 · `Asia/Novokuznetsk` 1991, 2010 · `Asia/Novosibirsk` 1991 · `Asia/Omsk` 1991 · `Asia/Oral` 1982, 1989 · `Asia/Qostanay` 1982, 1991 · `Asia/Qyzylorda` 1982 · `Asia/Sakhalin` 1991, 1997 · `Asia/Samarkand` 1982 · `Asia/Srednekolymsk` 1991 · `Asia/Tashkent` 1991 · `Asia/Tbilisi` 1991 · `Asia/Tehran` 1977 · `Asia/Tomsk` 1991 · `Asia/Ust-Nera` 1981, 1991 · `Asia/Vladivostok` 1991 · `Asia/Yakutsk` 1991 · `Asia/Yekaterinburg` 1991 · `Asia/Yerevan` 1991 · `Atlantic/Stanley` 1985–1986 · `Europe/Astrakhan` 1989, 1992 · `Europe/Kaliningrad` 1989 · `Europe/Kirov` 1989, 1992 · `Europe/Lisbon` 1996 · `Europe/Minsk` 1991 · `Europe/Moscow` 1991 · `Europe/Riga` 1989 · `Europe/Samara` 1989, 2010 · `Europe/Saratov` 1988, 1992 · `Europe/Simferopol` 1997 · `Europe/Tallinn` 1989 · `Europe/Ulyanovsk` 1989, 1991 · `Europe/Vilnius` 1989, 1998 · `Europe/Volgograd` 1988, 1992 · `Pacific/Rarotonga` 1978–1979
**NEW — says standard, tzdb says daylight: daylight ends with no clock change (standard time moves up to the daylight offset): 1051 samples, 62 zones; 2000+ 556 samples, 42 zones**

`Africa/Algiers` 1977 · `Africa/Tripoli` 1997, 2013 · `Africa/Windhoek` 2017 · `America/Adak` 1983 · `America/Anchorage` 1983 · `America/Argentina/La_Rioja` 1999–2000 · `America/Argentina/Rio_Gallegos` 1999–2000 · `America/Argentina/Salta` 1999–2000 · `America/Argentina/San_Juan` 1999–2000 · `America/Argentina/San_Luis` 1999–2000 · `America/Argentina/Tucuman` 1999–2000 · `America/Argentina/Ushuaia` 1999–2000 · `America/Asuncion` 2024 · `America/Buenos_Aires` 1999–2000 · `America/Cambridge_Bay` 1999 · `America/Cancun` 1997 · `America/Catamarca` 1999–2000 · `America/Chihuahua` 2022 · `America/Cordoba` 1999–2000 · `America/Coyhaique` 2024–2025 · `America/Dawson` 2020 · `America/Dawson_Creek` 1972 · `America/Edmonton` 2026 · `America/Indiana/Knox` 1991 · `America/Indiana/Marengo` 1974 · `America/Indiana/Petersburg` 1977, 2007 · `America/Indiana/Vincennes` 2007 · `America/Iqaluit` 2000 · `America/Jujuy` 1999–2000 · `America/Juneau` 1980 · `America/Kentucky/Monticello` 2000 · `America/Louisville` 1974 · `America/Mendoza` 1999–2000 · `America/North_Dakota/Beulah` 2010 · `America/North_Dakota/Center` 1992 · `America/North_Dakota/New_Salem` 2003 · `America/Ojinaga` 2022 · `America/Punta_Arenas` 2016 · `America/Rankin_Inlet` 2000 · `America/Resolute` 2000, 2006 · `America/Vancouver` 2026 · `America/Whitehorse` 2020 · `Antarctica/Palmer` 2016 · `Asia/Amman` 2022 · `Asia/Aqtau` 2004 · `Asia/Aqtobe` 1981 · `Asia/Atyrau` 2004 · `Asia/Baku` 1992 · `Asia/Bishkek` 2005 · `Asia/Damascus` 2022 · `Asia/Famagusta` 2016 · `Asia/Oral` 1981, 2004 · `Asia/Qostanay` 1981, 2004 · `Asia/Qyzylorda` 1981, 1991, 2004 · `Asia/Samarkand` 1981 · `Asia/Tbilisi` 1994 · `Asia/Yerevan` 1995 · `Europe/Istanbul` 1978, 2016 · `Europe/Lisbon` 1992 · `Europe/Samara` 1991 · `Europe/Vilnius` 1999 · `Pacific/Easter` 1981–1982
**NEW — says standard, tzdb says daylight: daylight period lasts 365 days or longer: 438 samples, 10 zones; 2000+ 364 samples, 8 zones**

`America/Coyhaique` 2014–2016 · `America/Havana` 2004–2006 · `America/Punta_Arenas` 2014–2016 · `America/Santiago` 2014–2016 · `Antarctica/Macquarie` 2009–2011 · `Antarctica/Palmer` 2014–2016 · `Asia/Amman` 2012–2013 · `Asia/Tbilisi` 1996–1997 · `Europe/Kiev` 1990–1991 · `Pacific/Easter` 2014–2016
**NEW — says daylight, tzdb says standard: standard time moved forward and back by the same amount within 365 days: 232 samples, 13 zones; 2000+ 134 samples, 6 zones**

`America/Cambridge_Bay` 2000 · `America/Ciudad_Juarez` 2022 · `America/Managua` 1992 · `America/Merida` 1981–1982 · `America/Metlakatla` 2018–2019 · `Antarctica/Casey` 2009–2012, 2018–2023 · `Asia/Aqtau` 1981–1982 · `Asia/Atyrau` 1981–1982 · `Asia/Khandyga` 2011 · `Asia/Oral` 1992 · `Asia/Qyzylorda` 1992 · `Asia/Ust-Nera` 2011 · `Atlantic/Azores` 1992–1993
**NEW — says standard, tzdb says daylight: other: 79 samples, 8 zones; 2000+ 32 samples, 3 zones**

`America/Argentina/San_Luis` 2008 · `America/Cancun` 1998 · `Asia/Barnaul` 1995 · `Asia/Novosibirsk` 1993 · `Asia/Tbilisi` 2004 · `Asia/Tomsk` 2002 · `Europe/Chisinau` 1990 · `Europe/Simferopol` 1994

**Intl name — a name exists and disagrees with the flag: 1,662 samples, 3 zones; from 2000 1,186 samples**

`Europe/Dublin` every summer 1972–2037 · `America/Vancouver` 2026-11-01 onward · `America/Edmonton` 2026-11-01 onward

**Intl name — no name (offset fallback): 31,173 samples, 77 zones; from 2000 8,778 samples, 27 zones**

`Africa/Bissau` · `Africa/Casablanca` · `Africa/El_Aaiun` · `Africa/Juba` · `Africa/Khartoum` · `Africa/Monrovia` · `Africa/Ndjamena` · `Africa/Windhoek` · `America/Adak` · `America/Anchorage` · `America/Argentina/Salta` · `America/Argentina/Tucuman` · `America/Argentina/Ushuaia` · `America/Catamarca` · `America/Cordoba` · `America/Coyhaique` · `America/Dawson` · `America/Goose_Bay` · `America/Guayaquil` · `America/Jujuy` · `America/Juneau` · `America/Mendoza` · `America/Nome` · `America/Paramaribo` · `America/Punta_Arenas` · `America/Santo_Domingo` · `America/Scoresbysund` · `America/Sitka` · `America/Yakutat` · `Antarctica/Palmer` · `Antarctica/Troll` · `Asia/Amman` · `Asia/Aqtau` · `Asia/Aqtobe` · `Asia/Ashgabat` · `Asia/Atyrau` · `Asia/Baku` · `Asia/Barnaul` · `Asia/Bishkek` · `Asia/Chita` · `Asia/Damascus` · `Asia/Dhaka` · `Asia/Dushanbe` · `Asia/Famagusta` · `Asia/Karachi` · `Asia/Kuala_Lumpur` · `Asia/Kuching` · `Asia/Oral` · `Asia/Qostanay` · `Asia/Qyzylorda` · `Asia/Saigon` · `Asia/Sakhalin` · `Asia/Samarkand` · `Asia/Srednekolymsk` · `Asia/Tashkent` · `Asia/Tbilisi` · `Asia/Tomsk` · `Asia/Urumqi` · `Asia/Yekaterinburg` · `Asia/Yerevan` · `Europe/Astrakhan` · `Europe/Dublin` · `Europe/Guernsey` · `Europe/Isle_of_Man` · `Europe/Jersey` · `Europe/Kirov` · `Europe/London` · `Europe/Samara` · `Europe/Saratov` · `Europe/Ulyanovsk` · `Pacific/Bougainville` · `Pacific/Galapagos` · `Pacific/Guam` · `Pacific/Kwajalein` · `Pacific/Midway` · `Pacific/Pago_Pago` · `Pacific/Saipan`
