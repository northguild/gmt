---
"@northguild/gmt": patch
---

The 1844 date-line crossings are found. `Asia/Manila`, `Pacific/Guam`, `Pacific/Saipan`, `Pacific/Kosrae` and `Pacific/Palau` moved to the Asian side of the date line by skipping 1844-12-31, but the Temporal polyfill only searches for time zone transitions from 1847-01-01 on, so GMT missed that change. Every fix returns what native Temporal (Chrome 153) returns.

- **`getDstTransitions(zone, 1845)` lists the crossing.** It used to return `[]`. `getDstTransitions("Asia/Manila", 1845)` is `[{ instant: "1844-12-31T15:56:08Z", offsetBefore: "-15:56:08", offsetAfter: "+08:03:52" }]`. 1844 stays `[]`: the crossing is local 1845-01-01 00:00, so it belongs to 1845.
- **Weeks across the crossing start on Monday 1844-12-30.** `startOfZoned`, `endOfZoned`, `floorToZone` and `areZonedEqualBy` by week were a day off. `floorToZone("1845-01-02T03:56:08Z", "week", "Asia/Manila")` is `"1844-12-30T15:56:08Z"`, not `"1844-12-29T15:56:08Z"`, and 1844-12-30 and 1845-01-02 are now in the same week. `startOfUnix`, `areUnixEqualBy` and `getLocaleZonedStartOfWeek` are corrected with them.
- **1844-12-30 is 24 hours long.** `getHoursInZonedDay("1844-12-30T12:00:00-15:56[Asia/Manila]")` is `24`, not `479340.06444444443`. `roundZoned` and `roundUnix` to a day now round its noon up to the crossing, `1845-01-01T00:00:00+08:04[Asia/Manila]`, instead of down to 1844-12-30.
- **The skipped day is not counted.** `intervalCountZoned` from 1844-12-01 to 1845-02-01 by day is `61`, not `62` (`intervalCountUnix` over the same span agrees), and `intervalOverlappingDaysZoned` from 1844-12-29 noon to 1845-01-01 noon is `3`, not `4`.
- **Business days skip it.** `addZonedBusinessDays("1844-12-27T12:00:00-15:56[Asia/Manila]", 2)` is `"1845-01-01T12:00:00+08:04[Asia/Manila]"`, not a date in 1899.

The correction runs only for instants before 1847-01-01 (and local dates on or before it) in a named zone; every later value takes the same path as before. It is removed once a polyfill release containing js-temporal/temporal-polyfill#372 is the dependency floor.
