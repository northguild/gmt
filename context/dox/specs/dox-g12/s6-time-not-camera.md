# Slice 6: time moves, the camera holds

The bug slides stop flying the camera and move time instead. Each bug gets a picture drawn from its
report's own lines, the filings light the planet, and the crystal clock returns. Everything below
is the current plan; the code is under `apps/dox/src/lib/slides/` and `src/components/slides/`.

## Camera

Flights happen at section changes only: Helsinki (title), the wall, the planet (`temporal` and the
experiments), one held planet view through the bugs (`abort`, `years`, `day-off`, `manila`,
`engines`), the overview (`scoreboard`), Greenwich (`gmt`, `guards`), Helsinki (`ask-dox`,
`page-tools`, `thanks`) and the spares (Greenwich). The Moon build on `day-off` is the one detour;
the GMT step after it returns to the planet.
`goTo` ignores a place the camera already holds, so consecutive `planet` slides never fly.

## Time-lapses

A slide or build names a `lapse` (`LAPSES` in `time-lapse.ts`; `Slide` and `Build` validate it).
`deck-mount.ts` passes the slide's lapse, or the highest reached build's, to `SpaceStage.lapse`.

- The engine's `sunInstant` is read once per frame; a lapse scrubs it, so the terminator sweeps the
  planet. A day-long lapse runs 24 hours from now over 24 s with a cosine ease, so its two ends
  show the same sun and one lapse joins the next.
- Each named zone's pin shows its own date and time, read with gmt (`convertUnixToZoned`) at every
  frame, so a pin changes date as that zone's clock passes midnight. No offset arithmetic is done
  in the deck.
- The stage publishes each frame as a `gmt-lapse` event on the deck root: `{name, ms, done, dates}`.
- Under reduced motion a lapse shows its end state at once.
- `deck-mount.ts` also writes `data-state-id` and `data-state-build` to the root and dispatches
  `gmt-deck-state`; slide visuals read the state on mount and on each event (`deck-state.ts`).

### Manila

The `manila` lapse spans 18 hours either side of the zone's first transition in 1844 or 1845,
found with `getDstTransitions`. gmt gives the transition at 1844-12-31T15:56:08Z, where the offset
goes from -15:56:08 to +08:03:52. The local date after 1844-12-30 is 1845-01-01, so 1844-12-31
never exists in Manila: a 24-hour jump forward. gmt shows the offsets rounded to -15:56 and
+08:04. `zone-jump.ts` computes the pages (the date before, any date skipped, the date after) at
build time, and a skipped page drops out when the pin's date passes it.

## A visual per bug

Each visual uses only its report's own observed and expected text (`REPORTS`, `VISUALS` in
`give-me-temporal/content.ts`; `content.test.ts` holds each value to its report). The
`FilingReceipt` is a small linked reference in the corner.

| Slide | Visual |
| --- | --- |
| `abort` | A terminal types the recorded command, then shows the process's answer and the cursor stops; build 1 is two columns (observed, expected) for the Unicode ticket |
| `years` | Two counters roll side by side to the expected and the observed year: Tehran, then (build 1) the Japanese era and year |
| `day-off` | Two calendar pages a day apart, expected and observed: Kolkata, then (build 1) Shanghai; build 2 is the new moon over Shanghai |
| `manila` | The calendar pages round the jump, one dropping out as the pin's date crosses it; the filing and its siblings as receipts |
| `engines` | Two columns for the same call: Node 26's answer and the expected one |

`bug-visuals.ts` plays them: `type-out.ts` types a line and rolls digits on frame stamps. Text that
animates keeps a full `.gmt-sr-only` copy and marks the animated copy `aria-hidden`, so a screen
reader never hears a half-typed line. Without script every visual reads whole.

## Filings as pins

`FilingLegend` replaces the scoreboard table with a running count, a line saying how many filings
sit at a zone and how many name none, and the per-tracker and state table (kept for screen
readers). `upstream-filings.json` gains an optional hand-written `zone` field, set only where the
filing's own title, summary or repro names an IANA zone: six filings (Manila three, El Aaiun,
Tokyo, Casablanca). The 54 filings are 6 pinned and 48 counted only. `planFilingPins` orders by
filing date; the slide carries the plan in `data-filing-steps`; `SpaceStage.pinFilings` lights the
pins while the count runs up (9 s, after the flight to the overview settles). A calendar-only
filing (Persian, Meiji) has no zone and is not pinned.

## The crystal clock

`title-clock.ts` draws the clock in three places. `title` and `thanks` show Helsinki now. On `gmt`,
build 1 shows Helsinki on 2027-03-28 at 02:59, from `resolveLocal` and `convertUnixToZoned`; build 2
steps it one minute with `addUnix`, to 04:00 (+03:00). Under reduced motion it shows 04:00 at once.

## The new moon over Shanghai

Phase A of [slice 7](./s7-running-question.md#phases-and-file-ownership). `day-off` build 2 is
`<Build n={2} place="moon" lapse="newmoon">` with `NewMoonPanel`; build 3 (the GMT step, phase B)
names `place="planet"`.

- **Source record:** `src/slides/give-me-temporal/new-moon.json` holds what the U.S. Naval
  Observatory's API returns for 2027 (`https://aa.usno.navy.mil/api/moon/phases/year?year=2027`,
  API 4.0.1, retrieved 2026-11-19): New Moon, 2027-02-06, 15:56, with the source's name, URL,
  retrieval date and time scale (UT, as USNO labels it), plus `utc`, the instant the lapse ends on
  (the API gives minutes, so seconds are 00). `chinese-month.json` holds the Hong Kong
  Observatory's post "Which day is the Tuen Ng Festival for this year (2013)?" (3 May 2013): its
  two sentences that a lunar month starts with a new moon and that the calendar's times are UTC
  plus eight hours, and the offset `+08:00`.
- **Rule:** `content.ts` widens "a cited figure comes from its filing" to "its filing or a cited
  primary source": a `SOURCES` map holds the record, and `content.test.ts` holds each cited value
  to its filing's text or to its source record's field.
- **Lapse:** `LapseDef` gains `endsAt: { utc, hours }` and `durationMs`. `LAPSES.newmoon` is
  `{ zones: ["Asia/Shanghai"], endsAt: { utc: <the record's instant>, hours: 2 }, durationMs: 8000 }`:
  the sun runs from 21:56 to 23:56 Shanghai time and stops on the new-moon instant, the pin reading
  `Shanghai 2027-02-06 23:56`. `LapseTools` gains `utcMs(iso)`, read with gmt.
- **Camera:** the `moon` place reads `PlaceContext.instantMs`. `stage.ts` reads the lapse from the
  page (the highest reached build's `data-lapse`, else the slide's), so the order of `goTo` and
  `lapse` does not matter, and boot waits for the lapse tools so a deep link aims right. It gives
  the place the lapse's end (`lapseEndMs`) when it has one, otherwise `sunMs ?? now()`, so the flight lands where
  the Moon stands at the new moon. At that instant the camera sits over the night side near
  local midnight in Shanghai, which is why the pin is in view; the browser check confirms it.
- **Sky:** `followGlobe` gains `instant?: () => number`, defaulting to gmt's `getUnixNow`; the
  stage passes `() => sunMs ?? now()`, so the Sun, the Moon and the stars follow the lapse. The
  landing hero passes nothing and is unchanged (the `hero-space` gate).
- **Panel** (`NewMoonPanel.astro`, built from the records with gmt by `newMoonFacts`): "New moon:
  6 February 2027, 15:56 UT. In Shanghai: 23:56 on 6 February, 4 minutes before midnight." "A
  Chinese calendar month starts on the day of the new moon, by the clock at UTC+8: Shanghai's."
  The Shanghai time comes from converting the instant to `Asia/Shanghai`; the 4 from
  `diffDateTime("2027-02-06T23:56:00", "2027-02-07T00:00:00", "minutes")` (`plain/calculate`), the
  second date from `addDate`; dates read `en-GB`. The test holds Shanghai's offset at the instant,
  from gmt, to the Observatory's `+08:00`. The source line links both records.
- **Notes:** "Four minutes from midnight. Two calculations five minutes apart disagree about which
  day the year starts." Facts only: neither the panel nor the notes say this causes the filed bug.
- Under reduced motion the lapse shows its end at once and the flight is a cut.
- **Tests:** `time-lapse.test.ts` (the plan ends on the instant, starts 2 hours before, the last
  stamp is `2027-02-06T23:56`); `places.test.ts` and `stage.test.ts` (the moon place uses the
  lapse's end); `space-sky.test.ts` (`sky.view` gets `instant()`, and `getUnixNow` without it);
  `content.test.ts` (the panel's values match both records).

## The Date table types out

On `date`, every row's code types out together once the table appears; the slide has one build,
for the guess. The table is `data-visual="rows"`, each row `data-row="n"`. The guess row (input
`new Date("2025-03-30T01:30")`) keeps its result and reason hidden, with their space reserved,
until build 1. The animated code is `aria-hidden` and a `.gmt-sr-only` copy holds the whole text.
Reduced motion shows each row whole; without script every row shows. The caption has the same
inline padding as the cells, so its first letter clears the plate's bevelled corner.
