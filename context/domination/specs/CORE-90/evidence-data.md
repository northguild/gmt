# Slice 4 — evidence-data: the proposal data module and the research file

Index: [index.md](index.md). House rules: GMT tracks no law, so the UI states effects only;
international authority comes first; no constant ages; tense follows the date. Everything below
was checked on **2026-11-13**. Re-check each row marked **verify** on its primary site at
implementation. If a row cannot be verified there, cut it.

## `apps/dox/src/data/sunshine-protection-act-proposals.ts` (new)

```ts
export type Position = "standard-all-year" | "daylight-if-allowed" | "standard-proposed";
interface AdoptedRow {
  kind: "adopted";
  postal: string;            // NE `postal`: matches state-boundaries-us.json
  position: Position;
  measure: "law" | "resolution";
  year: number;              // year the measure was adopted
  condition?: string;        // effects only: "only if Pennsylvania, New Jersey and Maryland do the same"
  source: SourceId;          // a key into SOURCES; never shown as a citation in the UI
}
interface TerritoryRow { kind: "territory"; postal: string; position: "standard-all-year"; source: SourceId }
export type StateRow = AdoptedRow | TerritoryRow;
export const PROPOSALS_CHECKED = "2026-11-13";     // PlainDate string
export const SESSION_ENDS = "2027-01-03";          // the national session the data describes
export const STATES: readonly StateRow[];
export const NATIONAL: { effects: readonly string[] };  // see "National proposal" below
export const SOURCES_URL: string;   // the research file on GitHub, main branch
```

- **Unlisted states.** A state that is not in `STATES` has no adopted position. The page draws it
  in the `none` class, worded "No adopted position".
- **No fallback strings.** Every row has a source, which the test asserts.
- **Places, not labels.** State names come from the boundary file's `name`. The module keeps none.
- **Ageing:**
  - The page states `PROPOSALS_CHECKED` in dated wording: "As of 13 November 2026".
  - At runtime it adds "checked N days ago". N comes from `diffDate` (`@northguild/gmt/plain/calculate`)
    between `PROPOSALS_CHECKED` and `getToday()` (`@northguild/gmt/plain/get`).
  - Once `getToday()` is on or after `SESSION_ENDS`, it adds: "The national session this describes
    ended on 3 January 2027. Positions may have changed since."
  - Both dates are facts about the data, not windows the site picked. No test depends on the
    date the suite runs. Inject `today` into the pure helper `ageWords(today)` and test it with
    fixed dates.

### Rows — `daylight-if-allowed` (19), source `crs-r45208`

| Postal | Year | Condition (effects only) |
| ------ | ---- | ------------------------ |
| FL | 2018 | — |
| DE | 2019 | only if Pennsylvania, New Jersey and Maryland do the same |
| ME, OR, TN, WA | 2019 | — |
| ID | 2020 | only the part of the state on Pacific time, and only once Washington changes |
| LA, SC, UT, WY | 2020 | — |
| AL, GA, MN, MS, MT | 2021 | — |
| CO | 2022 | — |
| OK | 2024 | — |
| TX | 2025 | only if federal law allows it (each state's text differs; this one says so outright) |

All 19 are `measure: "law"`. **Verify** each year and condition against the state's own statute
at implementation. The research file cites each statute, and the page cites none.

### Rows — `standard-all-year` (already, by the tz data), source `crs-r45208` plus tzdb

| Postal | Year | Note |
| ------ | ---- | ---- |
| AZ | 1968 | the Navajo Nation keeps daylight time (tzdb: "See America/Denver"). The state shape is hatched, and the pin says so |
| HI | 1967 | — |
| PR, VI, GU, MP, AS | — | no daylight time in the tz data. These are `TerritoryRow`s, with no year or measure |

The union keeps `year` and `measure` required wherever they mean something. That is the "no bags
of optional members" rule.

### Rows — `standard-proposed`, source `ca-scr7` (**verify**)

| Postal | Measure | Year | Note |
| ------ | ------- | ---- | ---- |
| CA | resolution | 2026 | Resolution Chapter 178, chaptered 2026-08-18. It states the health case for standard time all year. Bills for it are pending and are counted in words, not drawn |

If leginfo does not confirm it, `standard-proposed` has no rows. The legend shows "0" and the
class stays.

### National proposal — `NATIONAL.effects` (UI words, no names, no numbers)

1. "End the twice-yearly change and keep every zone one hour later than its standard time today,
   all year."
2. "Start on the day it becomes law. It sets no later start date."
3. "A state or area already on standard time all year the day before could keep its current
   time."
4. "As of 13 November 2026 it had passed one chamber and awaited a vote in the other."

Item 4 is dated wording. Item 3 states the effect a reader needs: a state that wants standard
time all year has to have it before the day the law starts.

## `src/data/sunshine-protection-act-proposals.test.ts` (new)

- There are 19 `daylight-if-allowed` rows and no duplicate postal codes.
- Every postal code is one of the 56 in `state-boundaries-us.json`.
- Every `source` is a key of `SOURCES`.
- **Cross-check with gmt.** For each `standard-all-year` row, its place's `zone.tab` zone has
  `hasDaylightSaving(zone, { at: "2026-11-13T12:00:00Z" })` false. The map is AZ→Phoenix,
  HI→Honolulu, PR→Puerto_Rico, VI→St_Thomas, GU→Guam, MP→Saipan, AS→Pago_Pago. It is a
  **test-only** lookup and never ships. Also check that `America/Denver`, which covers the
  Navajo Nation, is true.
- `ageWords` with fixed `today` values gives:
  - 2026-11-13 → "checked today"
  - 2026-12-13 → "checked 30 days ago"
  - 2027-01-03 → the session-ended note
- No string in the module matches `/\b(Act|H\.R\.|S\.\s?\d|bill|statute|Congress|Senate|House|U\.S\.C)\b/`.

## The research file — `context/domination/research/us-permanent-daylight-time.md`

Write it at implementation from this table. It may cite law. Each fact carries "checked
2026-11-13" or the date it was re-verified. Order: international first, then multinational, then
national peers.

| # | Fact | Source |
| - | ---- | ------ |
| 1 | Changes reach devices only after a tz release; "a long-planned change can easily be reverted or otherwise altered with a year's notice" | IANA `tz-link.html` |
| 2 | Latest release 2026f (2026-10-27), Cuba only; no US change | IANA tz `NEWS` |
| 3 | Mexico ended most daylight time by a law published 2022-10-28, in force 2022-10-30; tzdb 2022f followed the same day; the border-area decree followed in 2022g (2022-11-29) | tz `northamerica`, `NEWS` |
| 4 | UK kept GMT+1 all year 1968-10-27 to 1971-10-31, then reverted | tz `europe` |
| 5 | Russia kept +4 for Moscow from 2011-03-27, moved to +3 on 2014-10-26 | tz `europe` |
| 6 | US year-round daylight time from 1974-01-06; standard time restored from 1974-10-27 | tz `northamerica`; Public Laws 93-182 and 93-434 |
| 7 | SRBR position: permanent standard time is preferred over switching or permanent daylight time | Roenneberg et al. 2019, *J Biol Rhythms* 34:227–230, doi:10.1177/0748730419854197 |
| 8 | EU consultation: 4.6 M replies, 84% to end clock changes; Commission proposal COM(2018)639; Parliament position 26 Mar 2019; awaiting Council | European Commission transport page; OEIL 2018/0332(COD) |
| 9 | EBRS/ESRS joint statement favouring standard time (**verify**) | the societies' own sites |
| 10 | AASM (US peer): permanent standard time; World Sleep Society listed as endorser (**verify**) | Rishi et al. 2020, *JCSM* 16:1781–1784, doi:10.5664/jcsm.8780; 2024, *JCSM* 20:121–125, doi:10.5664/jcsm.10898 |
| 11 | Fatal crashes up 6% in the week after the spring change, more in the morning and further west in a zone; none in autumn (732,835 crashes, 1996–2017) | Fritz et al. 2020, *Curr Biol* 30:729–735.e2, doi:10.1016/j.cub.2019.12.045 |
| 12 | 1974: benefits "small and difficult to isolate"; more school-age morning deaths Jan–Apr 1974, with caveats | CRS R45208 citing DOT 1975 and NBS 1976 |
| 13 | Energy saving of the 2007 extension about 0.02% | CRS R45208 citing DOE 2008 |
| 14 | 19 states, their years and conditions; no state adopted permanent standard time 2015–Apr 2026 | CRS R45208 (24 July 2026); each statute (**verify**) |
| 15 | National bill: passed the House 14 July 2026 (308–117; one outlet says 308–171, so **verify** the roll call); referred to Senate Commerce; no Senate vote by early November 2026; Senate passed a similar bill in March 2022 | govinfo engrossed text (H.R. 139 EH); House Clerk roll call (**verify**) |
| 16 | The bill repeals the seasonal period (15 U.S.C. 260a), moves each standard time one hour later, lets a state exempt the day before choose, and has no effective date | govinfo H.R. 139 EH |
| 17 | California: SCR 7 chaptered 2026-08-18 (Res. Ch. 178); SB 1197 and SB 51 pending (**verify**) | leginfo.legislature.ca.gov |
| 18 | Health effects of a permanent setting are mixed in a 2026 review | Steponenaite 2026, as cited by CRS R45208 (**verify** the paper itself) |

Fact 15's vote and fact 17 come from secondary sources so far. If the primary record disagrees,
the primary wins and the page text follows.
