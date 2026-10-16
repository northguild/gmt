## D. The five tools (continued)

### D5. Presets

Values marked † are the library spec's verified JSDoc (L§4.3); every other value is from the run
and is pasted into the tests and the page.

| Id | Mode | Inputs | The library returns |
| --- | --- | --- | --- |
| `galileo-2019` (default) | broadcast | `GAL`, 1024, 18, era 0 | `2019-04-07T00:00:00Z` † (the inverse of `utcToGnssWeek("GAL", "2019-04-07T00:00:00Z")`); the era 1 lane from the run |
| `lnav-2024` | broadcast | `GPS-LNAV`, 247, 86418, era 2 | `2024-01-01T00:00:00Z` † (L§4.3's GPS-bound example, re-pointed to `gnssWeekToUtc("GPS-LNAV", 247, 86418, 2)` by decision 9; confirm in the run); the other lanes from the run |
| `not-before-2020` | broadcast | `QZS-LNAV`, 247, 86418, `{ notBefore: "2020-01-01T00:00:00Z" }` | from the run (the first instant at or after the pivot with that reading) |
| `same-reading-two-dates` | broadcast | `GPS-LNAV`, 100, 0, era 0 | `1981-12-05T23:59:59Z` †; the era 1 lane `2001-07-21T23:59:47Z` † |
| `second-rollover` | broadcast | `GPS-LNAV`, 0, 0, era 2 | `2019-04-06T23:59:42Z` † |
| `third-rollover` | broadcast | `GPS-LNAV`, 0, 0, era 3 | `2038-11-20T23:59:42Z` † |
| `nearest-today` | broadcast | `GPS-LNAV`, 247, 86418, rolling | the era nearest the reader's today; tests pin the clock to `2026-10-15T00:00:00Z`, giving era 2 and `2024-01-01T00:00:00Z` |
| `cnav-2024` | broadcast | `GPS-CNAV`, 2295, 86418, era 0 | `2024-01-01T00:00:00Z` † |
| `beidou-2024` | broadcast | `BDT`, 939, 86404, era 0 | `2024-01-01T00:00:00Z` † |
| `leap-second` | broadcast | `GPS-LNAV`, 906, 17, era 1 | `2016-12-31T23:59:60Z` † |
| `week-past-the-counter` | broadcast | `GPS-LNAV`, 1024, 0, era 2 | `""` † → `NO SIGNAL`, "This counter shows weeks below 1024." |
| `rinex-navic` | RINEX | `IRN`, 2295, 86418 | `2024-01-01T00:00:00Z` †; the `IRN-L1NV` lane `2043-08-17T00:00:00Z` (L D12) |
| `rinex-leap-second` | RINEX | `GPS`, 1930, 17 | `2016-12-31T23:59:60Z` † |
| `utc-2019-rollover` | UTC | `2019-04-07T00:00:00Z`, `GPS-LNAV` | `GPS-LNAV` `{ week: 0, timeOfWeekSeconds: 18, era: 2 }` †, `GPS-CNAV` `{ 2048, 18, 0 }` †, `GAL` `{ 1024, 18, 0 }` † |
| `utc-2024` | UTC | `2024-01-01T00:00:00Z`, `BDT` | `BDT` `{ 939, 86404, 0 }` †; RINEX `IRN` `{ 2295, 86418 }` †; the `BDT` plate `2024-01-01T00:00:04 BDT`, 4 s ahead † |
| `utc-before-galileo` | UTC | `1999-08-21T23:59:46Z`, `GAL` | `null` † → `NO SIGNAL`, the before-first-week sentence; the GPS rows have values |
| `utc-no-leap-second` | UTC | `2017-12-31T23:59:60Z`, `GPS-LNAV` | `null` → `NO SIGNAL`, "No leap second was inserted at the end of that day." |

A RINEX `BDT` week counts from 2006-01-01 BDT, the other four from 1980-01-06 (L D12). The tool
holds no epoch: the RINEX lanes and the first-instant probe read it from `rinexWeekToUtc`. The
`BDT` RINEX row in section 3 and the `BDT` choice in RINEX mode are tested like the other four, so
a reading such as `utcToRinexWeek("BDT", "2024-01-01T00:00:00Z")` gives a different week from
`"GPS"` (value from the run).

### D6. Permalink and chat

**Permalink keys** (`seedFromLocation` keeps strings of 1–64 characters, so every number is a
string): `mode`, `counter`, `system`, `week`, `timeOfWeekSeconds`, `rolloverEra`, `utc`, or
`preset` with the keys that differ from it, as the TRAN-57 tools do. A key a mode does not use is
left out. Every permalink written into a page is built with `encodeWidgetPermalink`.

**Chat schema** (`showGnssWeekDecoderInput` in `dox-tools.ts`), a flat object, as every other tool's:

```ts
z.object({
  mode: z.enum(GNSS_DECODER_MODES),
  counter: z.enum(GNSS_WEEK_COUNTERS).optional(),
  system: z.enum(RINEX_WEEK_SYSTEMS).optional(),
  week: z.number().int().min(0).optional(),
  timeOfWeekSeconds: z.number().min(0).optional(),
  // The library takes an integer or "rolling"; a string keeps the schema flat for every provider.
  rolloverEra: z.string().regex(/^(?:0|[1-9]\d{0,5}|rolling)$/).optional(),
  utc: z.string().min(10).max(64).optional(),
}).refine(…)
```

The schema also has `rolloverNotBefore: z.string().min(10).max(64).optional()`, the pivot, and the
permalink carries it under the same key. The refinement: `broadcast` needs `counter`, `week`,
`timeOfWeekSeconds` and exactly one of `rolloverEra` and `rolloverNotBefore`;
`rinex` needs `system`, `week` and `timeOfWeekSeconds`; `utc` needs `utc`, and `counter` is
optional. **The era is never defaulted**, because the library requires it. In UTC mode with no
counter, section 2's lanes show the empty state "Pick a counter to see its eras", and sections 3
and 4 render.

**`DOX_TOOL_DOCS` entry, appended** after `showJourneySplit`:

- purpose: "Decode a satellite week number and time of week to UTC on every rollover era, read a
  RINEX navigation-file week, or turn a UTC instant into each counter's week, time of week and
  era, with each system's offset from UTC."
- when: "Call when the reader asks what UTC instant a GPS, Galileo, BeiDou, QZSS or NavIC week
  number and time of week is, about a week rollover or which era a week belongs to, about a RINEX
  navigation-file week, or about the offset between UTC and a satellite system's time at an
  instant."
- args: "`mode` is `broadcast`, `rinex` or `utc`. Pass `counter` (for example `GPS-LNAV`), `week`,
  `timeOfWeekSeconds` and either `rolloverEra` (digits or `rolling`) or `rolloverNotBefore` (the
  date a receiver counts from) as the reader gave them; never pick an era for them. `system` names a RINEX record's system. `utc` is an ISO 8601 instant."

**`CHAT_STARTERS` card**, area `gnss`:

```ts
{
  text: "A receiver reports Galileo week 1024, 18 seconds in, first era: what UTC time is that?",
  widget: "showGnssWeekDecoder",
  area: "gnss",
  // Galileo's first era is era 0; GAL week 1024 + 18 s is 2019-04-07T00:00:00Z (L§4.3).
  args: { mode: "broadcast", counter: "GAL", week: 1024, timeOfWeekSeconds: 18, rolloverEra: "0" },
}
```

`EXAMPLE_AREAS` gains `{ id: "gnss", label: "GNSS and maritime" }` after `intermodal`. A tool's area follows its first tag; the three GNSS tools are `[gnss, maritime]`, so they share this area.

### D7. Tests

- `gnss-week-decoder.test.ts`: every preset against the real library (`src/test/gnss-lib.ts`):
  the calls made, in order; each lane's result; each table row; the system plate's lead; the
  links row's two permalinks; the sentence for each
  sentinel; the probes (the last week of every counter is the one the library refuses at era 0,
  and the week before it is accepted); the counter-to-system split; the permalink round trip for
  every preset; no on-screen string contains `GMT` for the library, a raw `null`, `UTC+3`,
  `Moscow` or `MSK`. The `nearest-today` preset runs under `vi.setSystemTime`.
- `gnss-week-decoder-mount.test.tsx`: the template's regions in every mode; switching mode carries
  the moment over; disabled controls per mode; the holds; the lanes' `aria-label`s; the starter's
  args mount; a rejected loader throws `WidgetLoadError`.
- `gnss-names.test.ts` (D1).
- `search.test.ts`, against the real retrieval corpus: "What UTC time is Galileo week 1024, time
  of week 18, era 0?" retrieves `gnssWeekToUtc` in its results;
  "Is 2016-12-31T23:59:60Z a real leap second?" retrieves the timescale `isLeapSecond`; "GLONASS
  time offset from UTC" retrieves `utcToGnss` or the Maritime guide's section. Rows are added only
  after the library's pages and guides exist (step D4).
