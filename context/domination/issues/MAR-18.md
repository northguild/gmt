# MAR-18 — Maritime: Ship's time, clock changes, zone descriptions and date line crossing

**Scope:** The ship's own clock, which is declared by the master and matches no IANA zone; the nautical zone description and letter a longitude implies; and the military date-time group that carries the letter.

## Gap

A vessel on passage keeps three clocks: AIS and navigation report UTC, the deck log and crew roster run on **ship's time**, and the port runs on port-local time. Ship's time is set by the master, advanced or retarded by whole or half hours on passage, and need not correspond to any IANA zone or to the vessel's actual longitude. Crossing the International Date Line changes the date by a day in addition to any clock change.

The vocabulary for all of this is Bowditch's. The **zone description** (ZD) "is the number of whole hours that are added to or subtracted from the zone time" to obtain UTC, "positive in west longitude and negative in east longitude"; the zone meridian is "the nearest meridian exactly divisible by 15°", each zone "extending ±7.5° on each side"; and each zone carries a letter — Z for ZD 0, A–M (no J) eastward, N–Y westward — the same letters the military date-time group appends to `DDHHMM`: "271630Z JUN 03 represents 1630 GMT on 27th June 2003".

GMT can represent IANA zones. It cannot represent a captain-declared offset, a zone description, or a DTG, so a voyage's own log timestamps are currently unrepresentable.

([Bowditch, *The American Practical Navigator*, Pub. No. 9 Vol. I, 2019, Chapter 16 §1607 and Table 1607a](https://msi.nga.mil/api/publications/download?key=16693975/SFH00000/Bowditch_Vol_1_LoRes_2019.pdf), [ACP 121(G), *Communication Instructions — General*, Chapter 3 para 317c and Annex A](https://navy-radio.org/manuals/acp/acp121g.pdf))

## Scope

- `packages/gmt/src/maritime/convert/shipTime.ts`:
  - `toShipTime(instant: string, shipOffset: string): string` — Renders an instant in ship's time. `shipOffset` is `±HH:MM`, permitting half- and quarter-hour offsets.
  - `fromShipTime(shipLocal: string, shipOffset: string): string` — Ship's local wall time back to an instant.
- `packages/gmt/src/maritime/calculate/clockChange.ts`:
  - `applyClockChange(shipOffset: string, change: string): string` — Applies a retard (negative) or advance (positive) order to the ship's offset.
  - `shipTimeSchedule(departure: string, arrival: string, changes: { at: string, change: string }[], startOffset: string): { at: string, offsetBefore: string, offsetAfter: string }[]` — The offset in force across a voyage.
- `packages/gmt/src/maritime/calculate/dateLineCrossing.ts`:
  - `dateLineCrossing(instant: string, direction: 'westbound' | 'eastbound', shipOffset: string): { offsetAfter: string, dateChange: number }` — `dateChange` is `+1` or `-1` days.
- `packages/gmt/src/maritime/get/nauticalZone.ts`:
  - `nauticalZone(longitudeDegrees: number): { zoneDescription: number, letter: string, offset: string, zoneMeridian: number } | null` — Bowditch §1607: ZD is the nearest multiple of 15° divided by 15, positive west; the letter from Table 1607a; `offset` is the ISO form (`ZD +5` → `-05:00`). Longitude 180 is ambiguous between M (−12) and Y (+12) and returns both letters' data with the ambiguity flagged.
  - `zoneLetterToOffset(letter: string): string | null` and `offsetToZoneLetter(offset: string): string | null` — The A–Z table both ways; `J` is not a zone; N is also used for ZD −13 (ACP 121 Annex A footnote) and that alias is documented.
- `packages/gmt/src/maritime/parse/dateTimeGroup.ts`:
  - `parseDtg(value: string, options: { referenceInstant?: string }): { instant: string, letter: string } | null` — `DDHHMMZ`, `DDHHMMZ MON YY` or `DDHHMMZ MON YYYY`; the short form needs a reference instant to fix month and year.
  - `formatDtg(isoString: string, options?: { letter?: string, withDate?: boolean }): string` — `Z` by default, in ACP 121's six-figures-plus-letter, three-letter-month, two-digit-year form.

## Design notes

- **`shipOffset` is an offset, not a zone**, and this is the one place in GMT where that is correct rather than a bug. There is no tzdb entry for "what the master ordered", and there is deliberately no attempt to map an offset back to an IANA zone — see CORE-4 on why an offset does not identify a zone.
- **A zone description is a formula, not a registry.** `nauticalZone` is pure arithmetic on longitude per Bowditch; it says nothing about which legal time a coast keeps, and the JSDoc says so. It is what a navigator uses at sea and what a master usually orders on passage, which is why it belongs beside ship's time.
- **Bowditch's sign is the opposite of ISO's.** ZD +5 means five hours are *added* to zone time to reach UTC, i.e. the zone is UTC−5. The function returns both forms so the conversion is done once, here, and the JSDoc quotes the sentence.
- Offsets beyond ±14:00 exist at sea. Nautical time zones run to ±12, and a master may order an offset that no landmass uses. Validation permits the full ±14:00 range and half- and quarter-hour steps.
- **Crossing the date line is a date change, not a clock change**, and the two are independent: a vessel may cross the line without a clock order, or take a clock order without crossing. Modelling them separately is what keeps voyage logs reconcilable.
- **The DTG's letter is the zone the time is expressed in**, and `Z` "is used except where the theatre or area commander prescribes" local time (ACP 121 para 317c). The parser returns the letter so a consumer can tell a Zulu group from a local one; ACP 121 also allows the letter to be omitted under a covering "all times Zulu", so a missing letter is accepted only when the caller passes `assumeLetter: 'Z'`.
- Ship's time has no DST. It changes only by explicit order, so there are no ambiguous or nonexistent local times — a genuine simplification relative to CORE-4.
- Bowditch's printed Table 1607a has a typo in the Y row ("172.5° W to 7.5° W"); the intended bound is 180°, and the test pins the correct value so nobody transcribes the misprint.

## What gmt provides (do not re-implement)

- `toOffsetInstant` / `fromOffsetInstant` from CORE-4 — the instant-plus-offset pair, which is exactly the ship's-time shape
- `addDuration` — offset arithmetic
- `mergeIntervals` from CORE-6 — building the offset-in-force timeline
- `spanMs` from CORE-2 — nearest-candidate selection for the short DTG
- `regex/` — pattern matchers

## Verification

- `toShipTime` round-trips through `fromShipTime` for whole, half and quarter-hour offsets
- A one-hour retard order decreases the offset by one hour and repeats an hour of ship's time
- A one-hour advance order skips an hour of ship's time
- `shipTimeSchedule` returns offsets in force in chronological order across multiple changes
- Westbound date line crossing returns `dateChange: +1`; eastbound returns `-1`
- An offset beyond ±14:00 returns the sentinel
- A crossing with no clock change leaves the offset unchanged
- `nauticalZone(-77)` (Washington, DC) returns `zoneDescription: 5, letter: 'R', offset: '-05:00', zoneMeridian: -75`; `nauticalZone(139.7)` (Tokyo) returns `zoneDescription: -9, letter: 'I', offset: '+09:00'`; `nauticalZone(7.4)` returns `Z` and `nauticalZone(7.6)` returns `A`, asserting the ±7.5° boundary
- `nauticalZone(180)` flags the M/Y ambiguity; `zoneLetterToOffset('J')` returns the sentinel; `zoneLetterToOffset('Y')` returns `'-12:00'`, not the misprinted bound
- `parseDtg('271630Z JUN 03')` returns 2003-06-27T16:30:00Z with `letter: 'Z'`; `parseDtg('271630R JUN 03')` returns 21:30Z; `parseDtg('271630Z', { referenceInstant })` picks the nearest month; without a reference the short form returns the sentinel
- `formatDtg(parseDtg(x).instant)` round-trips the long form
- `pnpm run validate` stays green
