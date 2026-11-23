# GMT Realms Epic — Tracker

The story table for `@northguild/gmt`: build order, the generated `Blocked by` column, `Status`,
the GitHub issue and the release. An open story's spec is `issues/<ID>.md` (listed in
[issues/index.md](issues/index.md)); the finalizer deletes it when the story closes, and the
GitHub issue stays the record.

## How to read it

Reading the table top to bottom is the build order, and the `#` column is that order. A story
ID is a permanent name and never changes; `#` and the number in the ID do not match. **The first
row that is not `Done` or `Waiting` is the next story to build.** A `Waiting` row waits on
something outside this repo, named in its issue file; `pnpm deps:ready` lists it apart from the
startable rows. New rows go below the last one; `pnpm deps -- check` reads build order from row
position, not from the ID.

### Blocked by

**An empty cell (`—`) means the story is free to pick up.** Each cell is generated, never
hand-edited: the story IDs named in that story's `## What gmt provides (do not re-implement)`
section in `issues/<ID>.md`, minus the ones already `Done`. Run `pnpm deps:sync` to regenerate.

- **`(SPA-48)`** — parenthesised, so _not_ a blocker. It is a shared primitive built later in
  the order, and whoever reaches it first builds it. Extra scope, not a wait.
- **`⚠`** — a mutual dependency, two stories naming each other. Break it before building.

`pnpm deps -- whoneeds <ID>` lists the open stories that consume a story; `pnpm deps:ready`
prints what is startable right now.

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
adding or removing a `Cut` is an owner decision; nothing generates this column. A release ships a
whole capability someone can adopt, usually the end of a realm, and never more than about seven
stories, so the docs site is never far ahead of npm. A Core primitive ships with the realm that
first uses it.

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
| 37  | CORE-103 | Core       | Core validators take `unknown`<br>and narrow it to `string`; calls that cannot fail drop `null`          | —          | #432  | —       | Done        |
| 38  | CORE-104 | Core       | Lengths of time counted from now:<br>seconds, epoch, HTTP date, seconds until                            | —          | #433  | Cut     | Done        |
| 39  | CORE-91  | Core       | Past tense only on the Canada checker<br>after 1 November 2026                                           | —          | #353  | —       | Done        |
| 40  | CORE-106 | Core       | Database audit: SQL offset timestamps<br>read and validated, a guide matrix per database                 | —          | #438  | —       | Done        |
| 41  | SPA-46   | Space      | TAI64 / TAI64N / TAI64NA text labels                                                                     | —          | #227  | —       | Done        |
| 42  | SPA-47   | Space      | `toTT` + `toTCG`                                                                                         | —          | #228  | —       | Done        |
| 43  | SPA-49   | Space      | Two-part Julian Date + MJD + J2000                                                                       | —          | #230  | —       | Done        |
| 44  | SPA-52   | Space      | CCSDS ASCII time codes A and B                                                                           | —          | #233  | Cut     | Done        |
| 45  | HLTH-93  | Healthcare | HL7 v2 timestamps: `parseHL7`,<br>`formatHL7`, `isValidHL7`                                              | —          | #401  | —       | Done        |
| 46  | HLTH-94  | Healthcare | FHIR datetimes: `parseFHIR`, `formatFHIR`,<br>`isValidFHIR`, three FHIR regexes                          | —          | #402  | —       | Done        |
| 47  | FIN-95   | Finance    | FIX UTC timestamps: parse, format and<br>`isValidFixUtcTimestamp`                                        | —          | #403  | —       | Done        |
| 48  | FIN-96   | Finance    | SWIFT dates: `parseSwiftDate`,<br>`formatSwiftDate`, `isValidSwiftDate`                                  | —          | #404  | —       | Done        |
| 49  | AV-97    | Aviation   | SSIM dates: `parseSsimDate`,<br>`formatSsimDate`, `isValidSsimDate`                                      | —          | #405  | —       | Done        |
| 50  | AV-98    | Aviation   | METAR and NOTAM times: parse,<br>`isValidMetarTime`, `isValidNotamValidity`                              | —          | #406  | —       | Done        |
| 51  | RAI-99   | Rail       | GTFS time strings: `parseGtfsTime`,<br>`formatGtfsTime`, `isValidGtfsTime`                               | —          | #407  | —       | Done        |
| 52  | RAI-100  | Rail       | GTFS times to instants: `gtfsToInstant`                                                                  | —          | #408  | —       | Done        |
| 53  | IOT-101  | IoT        | PTP time: `ptpToUtc`, `utcToPtp`,<br>`isValidPtpTimestamp`                                               | —          | #409  | —       | Done        |
| 54  | CORE-90  | Core       | A US clock-change checker in Dox, once<br>permanent daylight time is law                                 | —          | #341  | —       | Waiting     |
| 55  | CORE-92  | Core       | Weekly check for a `temporal-polyfill`<br>release GMT can swap to                                        | —          | #386  | —       | Done        |
| 56  | CORE-105 | Core       | One file per workaround in<br>`zonedWallClockDifference.ts`                                              | —          | #437  | —       | Done        |
| 57  | CORE-107 | Core       | A changelog page in Dox, and the<br>You-Dont-Need-Momentjs PR on `/upstream`                             | —          | #451  | —       | Done        |
| 58  | CORE-110 | Core       | The weekly upgrade check compares<br>each calendar's years with native Temporal                          | —          | #468  | —       | Done        |
| 59  | CORE-111 | Core       | Public functions call internal cores,<br>never another public function                                   | —          | #508  | —       | Done        |
| 60  | CORE-112 | Core       | Some languages' date patterns crash<br>Node and print the wrong year                                     | —          | #524  | —       | Done        |
| 61  | CORE-113 | Core       | Validators and readers accept text<br>after a valid date or time                                         | —          | #528  | —       | Done        |
| 62  | CORE-114 | Core       | The same call gives different values<br>on different runtimes                                            | —          | #560  | —       | Done        |
| 63  | CORE-115 | Core       | `isValidOperatingSchedule`, a validator<br>for `OperatingSchedule`                                       | —          | #567  | —       | Not started |

---

## Definition of Done

Every story meets [definition-of-done.md](definition-of-done.md) before it closes.
