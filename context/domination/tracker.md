# GMT Realms Epic — Tracker

> Stories for the GMT Realms Epic. See [overview.md](overview.md) for the full spec and
> [painpoints.md](painpoints.md) for the researched evidence behind each realm.

---

## Overview

`@northguild/gmt` expands with **53 stories across Core and 9 realms**, built in four phases.

Reading the table top to bottom is the build order, and the `#` column is that order. A story
ID is a permanent name: it is what every cross-reference, spec filename and GitHub issue uses,
and it never changes. The `#` and the number in the ID do not match: Core primitives sit just
before their first consumer whatever their ID. **The first row that is not `Done` or `Waiting`
is the next story to build.** A `Waiting` row waits on something outside this repo, named in its
spec; `pnpm deps:ready` lists it apart from the startable rows, and it is picked up when the wait
ends. Done rows stay at the top in the order they shipped. `pnpm deps -- check` reads build order
from row position, not from the ID.

### Blocked by

**An empty cell (`—`) means the story is free to pick up.** The column shrinks as the epic
lands: a dependency drops out of every cell the moment its own row is marked `Done`.

Each cell is generated, never hand-edited. It is the story IDs named in that story's
`## What gmt provides (do not re-implement)` section in `issues/<ID>.md` (listed in [issues/index.md](issues/index.md)), minus the ones
already `Done`. The spec is the source of truth; run `pnpm deps:sync` to regenerate.

- **`(SPA-48)`** — parenthesised, so _not_ a blocker. It is a shared primitive built later in
  the order, and whoever reaches it first builds it. You can start this story today; you will
  build that primitive as part of it. Extra scope, not a wait.
- **`⚠`** — a mutual dependency, two stories naming each other. None remain; see the SPA-47
  note below.

Because the column only shows what is left, it is not the place to look up the full graph.
For that, ask the specs: `pnpm deps -- whoneeds CORE-1` lists every story that consumes it,
`Done` or not. `pnpm deps:ready` prints what is startable right now.

### Release

Merging a story publishes nothing. A human cuts a release by opening a PR that runs
`pnpm run changeset:version` (see [PUBLISHING.md](../../PUBLISHING.md)), and that release carries
every story merged since the last one. This column says when to do it.

- **A version** (`1.16.0`): the npm release the story shipped in.
- **`Cut`**: a release point. Once this row is `Done`, cut a release. It ships every row
  above it still marked `—`, whatever its realm. Until then those functions are on the docs
  site with an Unreleased badge.
- **`—`**: merged or not, it ships with the next `Cut` below it.

When a release publishes, replace `—` and `Cut` on every row it shipped with the version. Moving,
adding or removing a `Cut` is an owner decision; nothing generates this column.

**Where the cuts sit, and why.** A release ships a whole capability someone can adopt, usually the
end of a realm, and never more than about seven stories, so the docs site is never far ahead of
npm. A Core primitive ships with the realm that first uses it. The second Core round is the
exception: it ships as two releases of its own, the first with `MAR-16` and `SPA-48`, the second
ending with the core validators that take any value, ahead of the remaining realms.

| Cut after      | Ships                                      | Why here                                                                                                                                                                                              |
| -------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INT-58 (#11)   | TRAN-8, INT-12, INT-58                     | Dwell plus free time, demurrage and the billing deadline chain: the demurrage calculations, complete                                                                                                  |
| TRAN-57 (#15)  | CORE-55, TRAN-9, TRAN-10, TRAN-57, CORE-77 | The rest of the transport primitives, with operating hours                                                                                                                                            |
| CORE-76 (#20)  | INT-15, CORE-78, INT-14, CORE-76           | Intermodal complete with its tools (#304), and hours of work: the engine every duty rule runs on                                                                                                      |
| CORE-88 (#29)  | MAR-16 … CORE-88 (#21–#29)                 | GNSS time and leap seconds, then the second Core round: the site on its domain, the `Temporal` seam, the native suite, stored times, the Canada 2026 clock-change checker                             |
| CORE-103 (#37) | CORE-89 … CORE-103 (#30–#37)               | The rest of the second Core round: the Morocco checker, identifiers, holiday rules, recurrence and cron, human durations, `Position`, month-day and year-month values, validators that take any value |
| SPA-52 (#41)   | SPA-46 … SPA-52 (#38–#41)                  | The time-scale conversions: TAI64 text labels, TT and TCG, Julian Date, MJD and J2000, CCSDS ASCII time codes                                                                                         |

---

## Stories

| #   | Story    | Realm      | Deliverable                                                                                              | Blocked by | Issue | Release | Status      |
| --- | -------- | ---------- | -------------------------------------------------------------------------------------------------------- | ---------- | ----- | ------- | ----------- |
| 1   | CORE-1   | Core       | `toNanoseconds` + `fromNanoseconds`<br>+ JSON bridge + truncation                                        | —          | #182  | 1.16.0  | Done        |
| 2   | CORE-2   | Core       | `spanMs` + `spanNs` +<br>`spanWallClock`                                                                 | —          | #183  | 1.16.0  | Done        |
| 3   | CORE-3   | Core       | NTP / FILETIME / .NET ticks / Excel<br>/ Postgres epoch bridges                                          | —          | #184  | 1.16.0  | Done        |
| 4   | CORE-4   | Core       | `toOffsetInstant` + `resolveLocal` +<br>`classifyLocal`                                                  | —          | #185  | 1.16.0  | Done        |
| 5   | CORE-5   | Core       | ISO week + ordinal + fiscal periods<br>+ `floorToZone` + `bucketRange`                                   | —          | #186  | 1.16.0  | Done        |
| 6   | CORE-6   | Core       | Interval algebra: intersect, clamp,<br>subtract, merge, split, sum                                       | —          | #187  | 1.16.0  | Done        |
| 7   | CORE-7   | Core       | Business calendars,<br>`mergeCalendars`, roll conventions                                                | —          | #188  | 1.16.0  | Done        |
| 8   | CORE-8   | Core       | Full-API standards review with<br>`gmt-reviewer` (pre-1.16.0)                                            | —          | #251  | 1.16.0  | Done        |
| 9   | TRAN-8   | Transport  | `transitTime` + `etaAtZone` +<br>`dwellTime`                                                             | —          | #189  | 1.17.0  | Done        |
| 10  | INT-12   | Intermodal | `freeTimeExpiry` + `chargeableDays`<br>+ `demurrageClock`                                                | —          | #193  | 1.17.0  | Done        |
| 11  | INT-58   | Intermodal | `billingTimeline`: invoice, dispute and<br>resolution deadlines                                          | —          | #260  | 1.17.0  | Done        |
| 12  | CORE-55  | Core       | Operating hours and recurring<br>windows, open-time SLA arithmetic                                       | —          | #257  | 1.18.0  | Done        |
| 13  | TRAN-9   | Transport  | `scheduleDelivery` + `crossingTime`                                                                      | —          | #190  | 1.18.0  | Done        |
| 14  | TRAN-10  | Transport  | `cutoffAt` + `cutoffSchedule` +<br>`isPastCutoff` + `timeToCutoff`                                       | —          | #191  | 1.18.0  | Done        |
| 15  | TRAN-57  | Transport  | Schedule deviation, punctuality,<br>PLN/EST/REQ/ACT, `nextDeparture`                                     | —          | #259  | 1.18.0  | Done        |
| 16  | CORE-77  | Core       | Daylight time read from clock changes:<br>`isInDaylightSaving`, `hasDaylightSaving`                      | —          | #294  | 1.18.0  | Done        |
| 17  | INT-15   | Intermodal | EDIFACT DTM + X12 1250/623 + EPCIS<br>2.0 timestamp interop                                              | —          | #196  | 1.19.0  | Done        |
| 18  | CORE-78  | Core       | `isValidUtcTimestamp`: a UTC timestamp<br>in the plain RFC 3339 spelling                                 | —          | #307  | 1.19.0  | Done        |
| 19  | INT-14   | Intermodal | `bolTimestamp` + `multimodalETA`,<br>and the intermodal tools (#304)                                     | —          | #195  | 1.19.0  | Done        |
| 20  | CORE-76  | Core       | Hours of work: composable duty-log<br>rules, `dutyDayFor`, violations report                             | —          | #283  | 1.19.0  | Done        |
| 21  | MAR-16   | Maritime   | GNSS time scales (GPS, Galileo,<br>BeiDou, GLONASS, QZSS) + week<br>rollover                             | —          | #197  | 1.20.0  | Done        |
| 22  | SPA-48   | Space      | Leap second table and queries                                                                            | —          | #229  | 1.20.0  | Done        |
| 23  | CORE-81  | Core       | Weekly Temporal oracle and leap-second<br>canary open issues, not just write logs                        | —          | #319  | 1.20.0  | Done        |
| 24  | CORE-80  | Core       | Faster span arithmetic and a smaller<br>bundle: closed forms, size budget                                | —          | #316  | 1.20.0  | Done        |
| 25  | CORE-86  | Core       | Dox at `northguild.dev/gmt`, the<br>landing page, `/api/*` and `/mcp/*` kept clear                       | —          | #317  | 1.20.0  | Done        |
| 26  | CORE-87  | Core       | The reference corpus exported for<br>another repo                                                        | —          | #328  | 1.20.0  | Done        |
| 27  | CORE-82  | Core       | The suite runs on native `Temporal`:<br>Node 26, Chromium, Firefox, WebKit, weekly                       | —          | #322  | 1.20.0  | Done        |
| 28  | CORE-83  | Core       | `classifyStoredZoned`: why a stored<br>zoned time no longer resolves                                     | —          | #323  | 1.20.0  | Done        |
| 29  | CORE-88  | Core       | The Canada 2026 clock-change checker in Dox                                                              | —          | #329  | 1.20.0  | Done        |
| 30  | CORE-89  | Core       | The Morocco 2026 clock-change checker in Dox                                                             | —          | #340  | —       | Done        |
| 31  | CORE-56  | Core       | Time-ordered identifiers (UUID,<br>ULID, Snowflake…) +<br>Parquet/Arrow/protobuf                         | —          | #258  | —       | Done        |
| 32  | CORE-54  | Core       | Holiday rule engine: nth weekday,<br>Easter, observance shifts                                           | —          | #256  | —       | Done        |
| 33  | CORE-84  | Core       | Recurrence rules and cron lines in a<br>zone: RRULE, RDATE, EXDATE, cron                                 | —          | #324  | —       | Done        |
| 34  | CORE-85  | Core       | Human duration strings:<br>`parseHumanDuration`, `formatHumanDuration`                                   | —          | #325  | —       | Done        |
| 35  | CORE-79  | Core       | `Position` input type                                                                                    | —          | #314  | —       | Done        |
| 36  | CORE-102 | Core       | Month-day (`--MM-DD`) and year-month (`YYYY-MM`)<br>values: validate, parse, format, compare, arithmetic | —          | #416  | —       | Done        |
| 37  | CORE-103 | Core       | Core validators take `unknown`<br>and narrow it to `string`; calls that cannot fail drop `null`       | —          | #432  | Cut     | Not started |
| 38  | SPA-46   | Space      | TAI64 / TAI64N / TAI64NA text labels                                                                     | —          | #227  | —       | Not started |
| 39  | SPA-47   | Space      | `toTT` + `toTCG`                                                                                         | —          | #228  | —       | Not started |
| 40  | SPA-49   | Space      | Two-part Julian Date + MJD + J2000                                                                       | SPA-47     | #230  | —       | Not started |
| 41  | SPA-52   | Space      | CCSDS ASCII time codes A and B                                                                           | —          | #233  | Cut     | Not started |
| 42  | HLTH-93  | Healthcare | HL7 v2 timestamps: `parseHL7`,<br>`formatHL7`, `isValidHL7`                                              | —          | #401  | —       | Not started |
| 43  | HLTH-94  | Healthcare | FHIR datetimes: `parseFHIR`, `formatFHIR`,<br>`isValidFHIR`, three FHIR regexes                          | HLTH-93    | #402  | —       | Not started |
| 44  | FIN-95   | Finance    | FIX UTC timestamps: parse, format and<br>`isValidFixUtcTimestamp`                                        | —          | #403  | —       | Not started |
| 45  | FIN-96   | Finance    | SWIFT dates: `parseSwiftDate`,<br>`formatSwiftDate`, `isValidSwiftDate`                                  | FIN-95     | #404  | —       | Not started |
| 46  | AV-97    | Aviation   | SSIM dates: `parseSsimDate`,<br>`formatSsimDate`, `isValidSsimDate`                                      | —          | #405  | —       | Not started |
| 47  | AV-98    | Aviation   | METAR and NOTAM times: parse,<br>`isValidMetarTime`, `isValidNotamValidity`                              | AV-97      | #406  | —       | Not started |
| 48  | RAI-99   | Rail       | GTFS time strings: `parseGtfsTime`,<br>`formatGtfsTime`, `isValidGtfsTime`                               | —          | #407  | —       | Not started |
| 49  | RAI-100  | Rail       | GTFS times to instants: `gtfsToInstant`                                                                  | RAI-99     | #408  | —       | Not started |
| 50  | IOT-101  | IoT        | PTP time: `ptpToUtc`, `utcToPtp`,<br>`isValidPtpTimestamp`                                               | —          | #409  | —       | Not started |
| 51  | CORE-90  | Core       | A US clock-change checker in Dox, once<br>permanent daylight time is law                                 | —          | #341  | —       | Waiting     |
| 52  | CORE-91  | Core       | Past tense only on the Canada checker<br>after 1 November 2026                                           | —          | #353  | —       | Waiting     |
| 53  | CORE-92  | Core       | Weekly check for a `temporal-polyfill`<br>release GMT can swap to                                        | —          | #386  | —       | Not started |

**`CORE-8` sits at slot 8, ahead of the realm work.** It gates everything after it: it is the
standards and consistency pass over the whole public surface before 1.16.0 ships, and a realm
story built on an API still carrying a cross-namespace defect inherits it.

**The later Core primitives are built just before their first consumer.** `CORE-54` (holiday
rules) sits at #32, right before `CORE-84`, whose ordinal `BYDAY` uses it. Core primitives carry
high ID numbers because they were added after the realm IDs were assigned, which is exactly why
the `#` column and not the ID is the build order. `CORE-55` (operating hours) and `CORE-76`
(hours of work) were placed for consumers this epic no longer has, and no remaining story names
either as a dependency; both stay where they are. `CORE-76` is Core because duty rules in many
industries run on it. Its engine lives in `workforce/` (`@northguild/gmt/workforce`), a cross-industry layer for
workforce management that other industries draw on and declare in Dox: Transport now, others
as their stories ship.
`CORE-78` (the UTC timestamp check) is one function that no story consumes, so it takes the
first open slot.

**The second Core round comes before the remaining realms.** `CORE-81` (the weekly canaries open
issues) adds no function. It comes first, so a removable workaround or an oracle mismatch reaches
an issue before more realms build on the workarounds. `CORE-80` (speed and bundle size, measured in
the [audit](../perf-and-bundle-size-audit.md)) adds no function and changes no output. It sits
straight after `CORE-81`, so every later story is built on the closed-form internals, under its
size budget and through its single `Temporal` import. `CORE-82` runs the suite on native
`Temporal` through that import, and `CORE-83` says why a stored zoned time no longer resolves.
`CORE-86` (the docs site on `northguild.dev/gmt`, with the landing page) and `CORE-87` (the
reference corpus exported for another repo) come after `CORE-80`.
Neither adds a function. After `CORE-86`, a later story's URLs in code go through `withBase` and
the dist guard checks them; content links and corpus entries stay base-less. After `CORE-87`, a
later story's corpus entries land in the exported file through the same generator. Those six and
`CORE-88` are one release; `CORE-80` is a `patch` that changes no output, option or signature. `CORE-88`
adds the Canada 2026 clock-change checker to Dox; it follows `CORE-83`, whose `classifyStoredZoned` the checker uses, and closes that release. `CORE-89`
(the Morocco checker, on parts shared with the Canada one), `CORE-56`
(identifiers, which no story consumes), `CORE-54` (holiday rules), `CORE-84` (recurrence and
cron, whose ordinal `BYDAY` is `CORE-54`'s first use) and `CORE-85` (human durations) are the
second release. Every story after them can draw on all eight. `CORE-90`, a United States checker,
waits at the end of the table until permanent daylight time is law and a tzdb release models it.
`CORE-91` waits until 1 November 2026 has passed, then leaves only the past tense on the Canada
checker.
`CORE-79` (`Position`), `CORE-102` (month-day and year-month values) and `CORE-103` (the core
validators take any value and narrow it to `string`) complete the second release. `CORE-102` and
`CORE-103` build on shipped internals alone and no story consumes them; `CORE-103` changes types,
fixes one `isValidTimeZone` result, and closes the release.

**Demurrage comes straight after `TRAN-8`.** `INT-12` is the first consumer of
`dwellTime.calendarDays`, and `INT-58` adds the billing deadline chain, every window a caller
parameter, on top of it, so the two follow the primitive they test before the rest of Transport.

**`SPA-47` and `SPA-49` form a chain, not a cycle.** `SPA-47` owns TT and TCG, which are a
constant offset and a constant rate from TAI and need no Julian Date; `SPA-49` depends on it
alone. Every row in the table is a buildable order.

**Realms interleave where a dependency demands it.** `SPA-48` sits beside `MAR-16`, far ahead of
the rest of Space, because the GNSS time scales need its leap-second table. Read the `#` column,
not the realm column, for order.

**The industry formats come after Space.** `HLTH-93` … `IOT-101` open five realms — Healthcare,
Finance, Aviation, Rail and IoT — each an inner module for how its industry writes a timestamp on
the wire, read and written. Every one draws only on shipped primitives (`CORE-1`, `CORE-2`,
`CORE-4`, `INT-15`'s two-digit-year window, `MAR-16`, `SPA-48`). In each realm the first story opens
it, with its subpaths, Dox industry, guide and mistakes page, and the second extends them, so four
pairs are ordered: `HLTH-93` before `HLTH-94`, `FIN-95` before `FIN-96`, `AV-97` before `AV-98`, and
`RAI-99` before `RAI-100`, which also turns `RAI-99`'s times into instants. The realms themselves
can be built in any order. They sit before the `CORE` rows that wait or run on a schedule, and no
`Cut` follows them yet.

---

## Build Order

### Phase 1 — Core Foundation (required for everything)

Core is thirty stories: the primitives several realms share, the tooling every story is held
to, and one pass over the whole surface before anything is built on top. Phase 1 is the eight
shipped stories; the later ones (`CORE-54` … `CORE-56`, `CORE-76` … `CORE-103`) are built inside
Phase 2, each just before its first consumer, in the first open slot, or in the second Core round.

- **CORE-1, CORE-2, CORE-3** — precision, spans and foreign epoch bridges.
- **CORE-4** — the instant-plus-offset pair and explicit local-time resolution. Every realm
  that touches a local wall time depends on this.
- **CORE-5, CORE-6, CORE-7** — calendar boundaries, interval algebra, business calendars.
  `CORE-7` absorbs what was `FIN-2`; it had to move because logistics now ships before
  finance and needs business-day math.
- **CORE-8** — the standards and consistency pass over everything the seven above shipped,
  run with `gmt-reviewer` before 1.16.0. It closed the first part of Phase 1.
- **CORE-54, CORE-55, CORE-56, CORE-76** — holiday rules, operating hours, time-ordered
  identifiers and the hours-of-work engine, built later (see the Phase 2 entries).
  `CORE-54` is under any rule-based holiday or reference calendar; `CORE-55` is under any
  recurring weekly window, such as gate or office hours; `CORE-56` is `CORE-3`'s second
  generation; `CORE-76` is the one engine under
  every duty-log rule a caller states, in the `workforce/` cross-industry layer.

### Phase 2 — Logistics & Transport (the priority realms)

Highest commercial value and the thinnest coverage in the original plan.

- **TRAN-8** (done), then **INT-12 and INT-58** — dwell, then free time and demurrage and the
  billing deadline chain around a demurrage invoice, every window a caller parameter, built on
  dwell's day count.
- **CORE-55** — operating hours and open-time SLA arithmetic, ahead of the rest of Transport.
- **TRAN-9, TRAN-10, TRAN-57** — the rest of the shared transport primitives. `TRAN-57` adds
  planned-versus-actual, which every mode measures.
- **CORE-77** — daylight time read from a zone's clock changes, not from two sample dates. The
  Zone Planner shows the answer per zone, so it follows the transport tools.
- **INT-14, INT-15** — B/L and EDI interop. Advance-filing deadlines are `TRAN-10`'s cut-off
  math anchored to a caller's event.
- **CORE-78** — one check for a UTC timestamp in the plain RFC 3339 spelling, with an
  upper-case `T` and `Z`. It ships with the intermodal release.
- **CORE-76** — the hours-of-work engine in the `workforce/` cross-industry layer: composable
  rule objects over a duty log, every number the caller's. Transport draws on `workforce` in Dox
  now.
- **MAR-16** — GNSS time scales and week rollover, with `SPA-48`'s leap-second table.
- **CORE-81** — the weekly Temporal oracle and leap-second canary open issues, straight after
  `MAR-16`. A removable workaround or an oracle mismatch reaches an issue, not just a run log.
- **CORE-80** — faster span arithmetic and a smaller bundle, straight after `CORE-81`. It adds
  the benchmarks and the size budget every later story is held to, and the single `Temporal`
  import.
- **CORE-86, CORE-87** — the docs site, unchanged, on `northguild.dev/gmt` with the landing page
  at `northguild.dev`, and the reference corpus exported for another repo.
  Neither adds a function. After them, a later story's URLs in code go through `withBase` and
  the dist guard, and its corpus entries land in the exported file; content links stay base-less.
- **CORE-82, CORE-83** — the suite on native `Temporal` in Node 26, Chromium, Firefox and WebKit, weekly;
  and why a stored zoned time no longer resolves.
- **CORE-88** — the Canada 2026 clock-change checker in Dox, with live clocks and a map of Canada's
  zones, computed by the Dox Worker.
- **CORE-89** — the Morocco 2026 clock-change checker in Dox, on parts shared with the Canada one.
- **CORE-56, CORE-54, CORE-84, CORE-85** — time-ordered identifiers, holiday rules, recurrence
  and cron in a zone, and human duration strings. `CORE-54` comes
  before `CORE-84`, whose ordinal `BYDAY` uses it.
- **CORE-79** — the `Position` input type.
- **CORE-102** — month-day (`--MM-DD`) and year-month (`YYYY-MM`) values.
- **CORE-103** — the core validators take any value and narrow it to `string`; `getUnixNow` and
  `x12TimeCodeZone` return a plain value for every typed call. It closes the second Core round.

### Phase 3 — Space / Celestial

- **`SPA-48` came first in this realm, not third.** The leap-second table is what `SPA-46`
  needs, and `MAR-16` needed it early in Phase 2, so it was built beside `MAR-16`.
- **SPA-46 → SPA-47 → SPA-49** is the scale-conversion chain, now acyclic.
- **SPA-52** needs `SPA-48`.

### Phase 4 — Industry timestamp formats

Five realms, each an inner module like any other, with its own subpath and Dox industry. The
first story named in each realm opens it; the second comes after it.

- **HLTH-93, HLTH-94** — `@northguild/gmt/healthcare`: HL7 v2 `DTM` and `TS`, and the FHIR R4
  `date`, `dateTime` and `instant`.
- **FIN-95, FIN-96** — `@northguild/gmt/finance`: the FIX `UTCTimestamp` and the SWIFT MT `YYMMDD`
  date.
- **AV-97, AV-98** — `@northguild/gmt/aviation`: the SSIM `DDMMMYY` date, the METAR report time and
  NOTAM validity.
- **RAI-99, RAI-100** — `@northguild/gmt/rail`: GTFS times past midnight, and their instants from
  noon minus 12 hours.
- **IOT-101** — `@northguild/gmt/iot`: PTP timestamps, TAI on the wire, with the announced UTC
  offset.

---

## Definition of Done — Binding for Every Story

- `pnpm run validate` stays green, including the CI timezone matrix (10 zones × Node 22/24/26 — the `gmt-matrix` job in `.github/workflows/ci.yml`).
- **Changesets required** per the [changeset rule](../coding-standards.md#changesets): a new
  API story is `minor`; a fix to shipped behaviour is `patch`; no behaviour change, none.
- No `Date` object anywhere. All inputs are ISO 8601 strings; outputs are strings, numbers,
  booleans, arrays, bigint, or objects.
- Wrap all Temporal calls in `try-catch`. Bad input returns the sentinel from the
  [sentinel table](../coding-standards.md#api-contract), never throws.
- Full locale matrix for any locale-aware function (17 locales; `expectOneOfIcu` /
  `expectDateTimeEqual` from `src/test/icuVariants.ts` where CLDR wording differs).
- Timezone-aware functions run across `battleTestTimeZones`, and boundary functions add the
  probe-zone transition rows — see
  [§ Calendar & zone semantics](../coding-standards.md#calendar--zone-semantics).
- JSDoc with `@example` on every public function. Cover valid, invalid, and edge-case inputs.

### Added for this epic

- **Zones and calendars are parameters.** Realm functions take IANA zone identifiers and
  calendar objects as arguments. GMT does not bundle place registries and does not resolve a
  port, airport, station or exchange code to a timezone.
- **Bundled reference data is opt-in only, and limited to two kinds.** Data published by a
  standards body (IERS leap seconds and Earth orientation, IANA, CLDR) and calendars published
  by an operator such as an exchange or a payment system. No national holiday tables, no
  regulator tables, no dealer-convention tables. It lives behind a `…/data` subpath, never on
  the default import path, and each record carries its source, revision and validity window.
  **Exemption: a table its standards body has closed.** Data that will receive no further
  entries is a fixed historical record, not data that goes stale, so it ships on the default
  path as an internal constant, with its source and final revision cited beside it. The IERS
  leap-second table is such a table: CGPM 2026 Resolution 5 makes UTC continuous from
  20 May 2027, and IERS Bulletin C 72 announces no leap second at the end of December 2026 and
  states that leap seconds are introduced "at the end of the months of December or June". A
  weekly canary against the IERS file stays in place until continuous UTC takes effect.
- **International authority first.** A rule's authority is, in order: (1) an
  international treaty or standards body — ISO, IEC, ITU, BIPM, IERS, IAU, IMO, ICAO, WMO, WHO,
  UN/CEFACT, CCSDS, IGS/RINEX, IETF, Unicode/CLDR, IANA, ECMA; (2) a multinational industry body —
  ISDA, IATA, BIMCO, DCSA, GS1, HL7 International, FIX, SWIFT; (3) a national source, only as one peer
  among others and labelled with its country. A national system, agency or convention is never a
  default, never the only authority and never gets its own named function. Where no international
  source exists, the rule is a GMT rule backed by sources from at least two countries. Example zones,
  locales, holidays and date orders are spread across regions; none is "the" example. An
  international convention that is law (a maritime labour or watchkeeping convention, a road-transport
  agreement, an aviation-operations annex) may shape an example's numbers, but it is never named in
  code or docs: GMT tracks no law. Evidence records — `painpoints.md` and `research/*.md` — may still
  cite national sources as proof that a painpoint exists.
- **Every local-to-instant conversion states its disambiguation policy** in JSDoc, using the
  vocabulary in [LOCAL_TIME_RESOLUTION.md](../reference/LOCAL_TIME_RESOLUTION.md). Ambiguous
  and nonexistent wall times are never resolved silently.
- **Every function implementing a standard cites the clause it implements** in
  `## Design notes` — and the citation must be verifiable. The overview's Corrections table
  shows what happens when it is not: an invented leaflet number, then a component list taken
  from secondary papers. A function that implements no standard says so in its JSDoc and takes every
  number from the caller; the citation rule then applies to the arithmetic's own references
  (Temporal, ISO 8601, CORE stories), not to the caller's regime.
- **A rule whose primary text was not reached is marked, not asserted.** The verification files
  in `research/spike-2026-09/` list each such case; the spec that depends on it says so in its JSDoc and takes the value from the
  caller or returns the sentinel until the text is cited.
- **Dependencies are declared, not implied.** If a story's scope changes what it consumes
  from other stories, update its `## What gmt provides (do not re-implement)` section and run
  `pnpm deps:sync` in the same PR. The `Blocked by` column is generated from that section, and
  `pnpm run validate` fails when the two disagree.
- **A story that adds public functions ships its docs-site pages in the same PR**: a guide,
  scenarios and a mistakes page, with every result checked against the built package. See
  [docs-site.md](docs-site.md).
- **Closing a story means flipping its `Status` to `Done` and running `pnpm deps:sync`.**
  That is what removes it from every other story's `Blocked by` cell. Skip it and the tracker
  keeps showing work as blocked that is not.
- **No invented quantities.** If a value cannot be derived from the inputs, the function does
  not return it. Estimating processing times, drift from one sample, or limits from no table
  is out of scope by rule, not by omission.
- **Every behaviour-changing story gets a standards review.** `gmt-reviewer` (read-only) runs
  after `tdd-dev` and `tester` in categories A, B and G; its report goes in the PR's Validation
  section; an open blocking finding blocks closure. It is what verifies the citations above.
- **GMT tracks no law.** Windows, limits, thresholds and tables from a statute, regulation,
  treaty, agency, accreditation body, professional body or court are caller parameters with no
  defaults, the same rule as tariff terms. That covers legislatures and regulators, treaties
  ratified into national law (maritime labour and watchkeeping conventions, collision
  regulations), and professional, accreditation and public-health bodies (residency work-hour
  rules, immunisation grace periods, obstetric dating thresholds, adherence cut-offs): a body's
  _format, vocabulary, cadence or algorithm_ is a standard GMT may implement and cite; a body's
  _limit, window, threshold or table on conduct_ is treated like law, whoever publishes it.
  Library code rests on TC39 Temporal, ISO 8601, the RFCs and the realm's industry standards
  only; no statute, regulation number, agency, court decision or jurisdiction label appears in
  code, JSDoc or on the docs site. A function is generic or it is not shipped; a docs example is
  labelled by its numbers ("30-day windows", "a 14/14/45 contract", "an 11-hour cap inside a
  14-hour window"), never by a jurisdiction or a body. Evidence records — `painpoints.md` and
  `research/*.md` — may cite law as proof that a painpoint exists and that its numbers are real;
  nothing downstream of them (specs, code, docs, changesets, issue titles) may. Reading public
  regulation text during research is fine; shipping it is not.

---

## Deleted Packages

| Package                | Action | Reason                                                                 |
| ---------------------- | ------ | ---------------------------------------------------------------------- |
| `@northguild/gmt-time` | Delete | Value (`toNanoseconds`, `fromNanoseconds`) moved to core.              |
| `@northguild/gmt-otel` | Delete | Too niche. Precision primitives in core serve all telemetry consumers. |

Both packages were never shipped to npm. No migration path needed.
