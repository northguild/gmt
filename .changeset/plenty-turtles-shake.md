---
"@northguild/gmt": minor
---

Add the `instant/` namespace: the instant-plus-offset pair, and explicit resolution of zoneless local wall times (Story CORE-4).

GMT could represent an instant, and it could represent a zoned datetime. It had no primitive for the shape the world actually exchanges: an absolute instant **plus** the local UTC offset that was in force where the event happened. Neither field derives from the other — the instant orders events globally, the offset renders them as the human on the ground saw them — which is why GS1 EPCIS 2.0 requires both (`eventTime` and `eventTimeZoneOffset`), UN/EDIFACT DTM has qualifiers `303`/`304` for the pair, and DICOM appends `&ZZXX` to a `DT` value.

```typescript
import {
  classifyLocal,
  fromOffsetInstant,
  resolveLocal,
  toOffsetInstant,
} from "@northguild/gmt";

toOffsetInstant("2024-07-15T12:00:00-04:00[America/New_York]");
// { instant: "2024-07-15T16:00:00Z", offset: "-04:00", timeZone: "America/New_York" }

toOffsetInstant("2024-07-15T12:00:00-04:00");
// { instant: "2024-07-15T16:00:00Z", offset: "-04:00" } — most feeds send no zone

toOffsetInstant("2024-07-15T16:00:00Z", "America/New_York");
// { instant: "2024-07-15T16:00:00Z", offset: "-04:00", timeZone: "America/New_York" }

fromOffsetInstant({ instant: "2024-07-15T16:00:00Z", offset: "-04:00" });
// "2024-07-15T12:00:00-04:00"

classifyLocal("2024-11-03T01:30:00", "America/New_York"); // "ambiguous"
classifyLocal("2024-03-10T02:30:00", "America/New_York"); // "nonexistent"

resolveLocal("2024-11-03T01:30:00", "America/New_York", { disambiguation: "later" });
// "2024-11-03T06:30:00Z" — the same wall clock, an hour of real time later
```

- **An offset is not a zone.** `-05:00` does not identify `America/New_York`; it is every zone sitting at `-05:00` that day, and it says nothing about what that zone does next spring. Keep the zone for anything still to be scheduled and the offset for anything that already happened. `timeZone` is optional because most feeds do not send one, and a string whose offset contradicts its own bracketed zone returns `null` rather than a guess about which half the sender meant.
- **`classifyLocal` exists so realm code can refuse rather than guess.** Ambiguous and nonexistent wall times are the single most common datetime bug there is — 01:30 happens twice on a fall-back day and never on a spring-forward one — and a demurrage clock or a medication window should not silently accept whichever of two instants an hour apart a default handed it. It returns `"unique"`, `"ambiguous"` or `"nonexistent"` before any policy is applied, reading the zone's own transition table, so it is right for 30-minute shifts (`Australia/Lord_Howe`), quarter-hour offsets (`Pacific/Chatham`) and the calendar day Samoa deleted crossing the date line in 2011.
- **`resolveLocal` returns an instant, exactly; `convertPlainDateTimeToZoned` returns a zoned string.** Same underlying resolution and the same four `disambiguation` values, but different output and different precision — `convertPlainDateTimeToZoned` truncates to milliseconds by default, so a nanosecond wall time survives one and not the other. `resolveLocal` has no `offset` parameter, since that option is inert on this construction path.
- **`offset` is `±HH:MM`, except where the zone was not on a whole minute.** `Africa/Monrovia` ran at `-00:44:30` until 1972, and `toOffsetInstant` reports it as `±HH:MM:SS` rather than rounding the pair thirty seconds away from the event it describes. Sub-second offsets are rejected — ISO 8601 permits them and Temporal parses them, but no zone and no standard that stores this pair has used one.
- **Every RFC 9557 `[key=value]` annotation is refused, not just `[u-ca=...]`.** Temporal silently drops an unknown non-critical annotation, which is the right default for a parser and the wrong one for a library whose contract is that it never guesses — an event tagged `[x-provenance=estimated]` is not the same fact as one without it. A bracketed time zone carries no `=` and is unaffected, so `instant/` is stricter here than `isValidInstant`.
- Also exported: the `OffsetInstant` and `LocalTimeClassification` types, and the `utcOffset` regex pattern from `regex/`.
