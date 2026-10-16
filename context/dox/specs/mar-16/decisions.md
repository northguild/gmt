# Spec: declared industry layers (Workforce, GNSS, Maritime) and five GNSS and leap-second tools (MAR-16)

What `apps/dox` ships for MAR-16 (#197). `dox-builder` builds against this spec, and `dox-tester`
verifies against section I. This is not `packages/gmt` work: the library side is
[`context/domination/specs/MAR-16/index.md`](../../../domination/specs/MAR-16/index.md) ("the library
spec" below, "L§n" for its section n; that index's section map resolves each L§n).

Four pieces:

1. **Industry layers are declared** (section B). Each industry is declared once, with its own
   namespace (if it has one) and the modules it draws on, and gets its own overview page at
   `/industries/<id>/`. Transport and Intermodal keep working and keep every URL. Two
   **cross-industry layers** join them as industries: **Workforce** (`workforce/`, people's working
   time; the duty engine moves there) and **GNSS** (`gnss/`). `timescale` stays Core.
   **Maritime** is an industry that draws on `gnss` and `timescale` and owns no namespace yet.
   The `/why-gmt` "By industry" chart becomes stacked, with shared layers shaded and never
   counted twice (B9).
2. **Generator fixes the new API needs** (section C): a playground classifier defect that
   `rolloverEra: number | "rolling"` exposes, and the redirect for the `isLeapSecond` →
   `hasSecond60` rename.
3. **Five standalone tools** (section D): the GNSS Week Decoder, the Satellite Clock Converter, the
   GNSS Rollover Checker, the Leap Second Timeline and Elapsed vs. Clock Difference, each with its
   chat registration.
4. **The MAR-16 content pages** (section F1): the GNSS and Maritime guides, the Core leap-seconds
   guide, the scenarios, the two mistakes pages and the index edits that L§8.4 describes. This work writes
   them; the library pipeline does not.

**Decisions (closed, owner):**

1. Industry pages live at `/industries/<id>/`, with an index at `/industries/`, in a top-level
   "Industries" sidebar group after "Start here".
2. The overview text leaves `/reference/transport/` and `/reference/intermodal/` for the industry
   pages; each namespace index keeps a one-line pointer.
3. The industry order follows what builds on what (B2): Workforce, Transport, Intermodal, GNSS,
   Maritime.
4. `dox-builder` edits the README "By industry:" line and namespace line in step D1. The library
   finalizer's `/update-readme` pass only verifies them.
5. A RINEX `BDT` week counts from 2006-01-01 BDT; `GPS`, `QZS`, `GAL` and `IRN` count from
   1980-01-06 (L D12, research §9.3.1).
6. L§8.4's pages are this work's (section F1), written after D1 and before D3.
7. The main session builds `packages/gmt/dist` once, before D1. Nothing in this plan builds it.
8. **Five tools, not one.** The per-system offsets table belongs to the Satellite Clock Converter;
   the decoder links to it and stays about weeks.
9. **No GPS-only API.** `gpsToUtc`, `utcToGps`, `gpsWeekToUtc`, `utcToGpsWeek` and
   `GpsNavMessage` are removed from the library. Every tool and page uses `gnssToUtc`,
   `utcToGnss`, `gnssWeekToUtc`, `utcToGnssWeek`, `rinexWeekToUtc` and `utcToRinexWeek`, with the
   system or counter named.
10. **The six constellations are peers** in the sense research §9a.5 supports: IMO recognises
    each as a component of the Worldwide Radionavigation System, though the scope of each
    recognition differs (section 0, "Why they are peers"). No tool, preset, chat starter or page opens on one
    system's example, on `America/New_York` or on `en-US`. Defaults are UTC instants and neutral
    or rotated systems; where a zone is needed, rotate through `Europe/London`, `Asia/Tokyo`,
    `Australia/Sydney`, `America/Sao_Paulo`, `Africa/Johannesburg` and `Asia/Kolkata`; a locale is
    regionless.
11. **Authority order for every citation:** (1) international bodies (ISO, IEC, ITU, BIPM, IERS,
    IAU, IMO, CGPM, IGS/RINEX); (2) multinational industry bodies; (3) a national source only as
    one labelled peer, never the sole authority or the default. A satellite system's own interface
    document is cited only for a signal fact no international body restates, and is labelled with
    its system.
12. **The Leap Second Timeline and Elapsed vs. Clock Difference are tagged Core**, in the chat area
    "Leap seconds and TAI".
13. **`RolloverEra` gains a third form, `{ notBefore: string }`**: the earliest instant at or after
    that ISO UTC pivot. The library architect specs it and `tdd-dev` builds it in this branch
    (P1). The GNSS Rollover Checker models firmware as a build-date pivot (the default, as real
    receivers behave) or as a fixed era, and shows when that firmware starts reporting wrong
    dates. The decoder's era input accepts the pivot too.
14. **`1972-01-01T00:00:00Z` and `2027-05-20` stay cited constants in the site** (D8), with their
    primary sources: the BIPM and ITU-R TF.460-6 for whole-second UTC from 1972; CGPM 2026
    Resolution 5 for continuous UTC. The library exports neither.
15. **The comparison baseline** is the base branch built inside a scratch copy (I0). This
    worktree's `packages/gmt/dist` is never rebuilt.
16. **Cross-industry layers are industries.** `workforce/` is a new industry layer (workforce
    management: people's working time); the duty engine moves there, seven functions in
    `workforce/calculate` and `isValidDutyLog` in `workforce/validate`, and the `/duty` subpaths are
    removed. `gnss/` is an industry layer too, named for the GNSS market segment it serves.
    `timescale/` stays Core. Each industry declares its own namespace and the modules it draws on:
    Transport owns `transport` and draws on `workforce`; Intermodal owns `intermodal`; Workforce owns
    `workforce`; GNSS owns `gnss` and draws on `timescale`; Maritime owns none yet and draws on `gnss`
    and `timescale` (and on `workforce` when it needs it). The rule is
    `context/coding-standards.md` line 230, "Core namespaces, industry layers, cross-industry
    layers". Step DU moves the duty pages and redirects the old URLs.
17. **The GNSS tools carry two tags**, GNSS and Maritime; the two leap-second tools stay Core.
18. **The "By industry" chart is stacked:** each industry's own functions solid, the layers it
    draws on lighter and named, and no function counted twice in any total (B9).
19. **`mistakes/duty` moves to `mistakes/workforce`**, with a redirect (M2, M3), following the
    `mistakes/<industry>.mdx` convention.
20. **No market report is cited for the GNSS layer.** Its pages rest on IMO's recognition of the
    six systems and on RINEX and the BIPM (section 0).
21. **Intermodal draws on `transport`.** Its pages already use Transport's functions (`dwellTime`),
    and a declaration states what an industry uses.

| Tool | Page | Kind | Chat tool | Tag | Library calls |
| --- | --- | --- | --- | --- | --- |
| GNSS Week Decoder | `/tools/gnss-week-decoder/` | `gnssweek` | `showGnssWeekDecoder` | GNSS, Maritime | `gnssWeekToUtc`, `utcToGnssWeek`, `rinexWeekToUtc`, `utcToRinexWeek`, `utcToGnss`, `isLeapSecond`, `hasSecond60`, `isValidInstant`, `diffUtcAsDuration` |
| Satellite Clock Converter | `/tools/satellite-clock-converter/` | `satclock` | `showSatelliteClockConverter` | GNSS, Maritime | `utcToGnss`, `gnssToUtc`, `toTAI`, `fromTAI`, `taiMinusUtc`, `nextLeapSecond`, `isLeapSecond`, `hasSecond60`, `isValidInstant`, `diffUtcAsDuration`, `addUtc`, `startOfUtc` |
| GNSS Rollover Checker | `/tools/gnss-rollover-checker/` | `rollover` | `showGnssRolloverChecker` | GNSS, Maritime | `gnssWeekToUtc`, `utcToGnssWeek`, `areUtcEqual`, `diffUtcAsDuration`, `isValidInstant` |
| Leap Second Timeline | `/tools/leap-second-timeline/` | `leapline` | `showLeapSecondTimeline` | Core | `taiMinusUtc`, `leapSecondsBetween`, `nextLeapSecond`, `isLeapSecond`, `hasSecond60`, `isValidInstant`, `addUtc`, `startOfUtc` |
| Elapsed vs. Clock Difference | `/tools/elapsed-vs-clock-difference/` | `elapsed` | `showElapsedVsClock` | Core | `spanNs`, `toTAI`, `leapSecondsBetween`, `nextLeapSecond`, `isLeapSecond`, `hasSecond60`, `isValidInstant` |

**The library surface**, from L§1 and the JSDoc drafts in L§4 as amended by decision 9 (re-read the
built JSDoc before coding; it wins over this table):

| Function | Barrel | Signature and result |
| --- | --- | --- |
| `gnssWeekToUtc` | `gnss/convert` | `(counter, week, timeOfWeekSeconds, rolloverEra)` gives a `…Z` instant, `…T23:59:60Z` inside an inserted second, or `""`. `rolloverEra` is an integer era, `"rolling"`, or `{ notBefore }` (decision 13; its exact JSDoc comes from the library spec's amendment) |
| `utcToGnssWeek` | `gnss/convert` | `(counter, utcString)` gives `{ week, timeOfWeekSeconds, era }` or `null` |
| `rinexWeekToUtc` | `gnss/convert` | `(system, week, timeOfWeekSeconds)` gives a `…Z` instant or `""`. The week never wraps |
| `utcToRinexWeek` | `gnss/convert` | `(system, utcString)` gives `{ week, timeOfWeekSeconds }` or `null` |
| `utcToGnss` | `gnss/convert` | `(system, utcString)` gives `"YYYY-MM-DDTHH:MM:SS[.f] <TOKEN>"` or `""` |
| `gnssToUtc` | `gnss/convert` | `(system, value)` gives a `…Z` instant, `…T23:59:60Z` inside an inserted second, or `""` (wrong token, before the system's first instant, invalid) |
| `toTAI` / `fromTAI` | `timescale/convert` | `(isoString)` gives `"… TAI"` or `""`; `(taiString)` gives a `…Z` instant (second 60 inside an insertion) or `""` |
| `taiMinusUtc` | `timescale/calculate` | `(isoString)` gives `10` … `37`, the old value during an inserted second, or `null` before 1972 |
| `leapSecondsBetween` | `timescale/calculate` | `(start, end)` gives the signed count of insertions in `[start, end)`, or `null` |
| `nextLeapSecond` | `timescale/calculate` | `(isoString)` gives the next `…T23:59:60Z` strictly after the instant, or `""` (none after it, or invalid) |
| `isLeapSecond` | `timescale/validate` | `true` only for the 27 listed seconds, in any offset spelling |
| `hasSecond60` | `plain/validate` | `true` for any seconds field of 60 (the renamed syntax check) |
| `isValidInstant` | `precision/validate` | one string, `boolean`. Refuses second 60 |
| `spanNs` | `span/calculate` | `(start, end)` gives exact nanoseconds between two instants as a `bigint`, counting no leap second, or `null`. Refuses second 60 |
| `diffUtcAsDuration` | `utc/calculate` | `(start, end, "seconds")` gives `end − start` as `"PT18S"`. Reads `Z` instants only, so a second-60 reading returns `""` |
| `addUtc`, `startOfUtc` | `utc/calculate` | `addUtc(value, { seconds: 1 })`; `startOfUtc(value, "year")`. Both refuse second 60 |
| `areUtcEqual` | `utc/compare` | two instants, `boolean` |

`GnssWeekCounter` is `"GPS-LNAV" | "GPS-CNAV" | "GAL" | "BDT" | "QZS-LNAV" | "QZS-CNAV" |
"IRN-LNAV" | "IRN-L1NV"`. `RinexWeekSystem` is `"GPS" | "GAL" | "BDT" | "QZS" | "IRN"`.
`GnssSystem` is `"GPS" | "GAL" | "BDT" | "QZS" | "GLO" | "IRN"`. `RolloverEra` is
`number | "rolling" | { notBefore: string }`. The `utc/calculate`, `utc/compare`, `span/calculate` and `precision/validate`
functions are shipped; check each signature in its built JSDoc.

Sources, in order of precedence: section 0, then the built JSDoc, then
`context/domination/docs-site.md`, then `context/dox/built.md`. The tool's shape follows
`specs/int-14-intermodal-tools.md` (plates, holds, registration) and `specs/timetable-reader.md`
(holds and stillness).

**Every value in this spec and on the pages is a real call.** A result shown on a page is pasted
from a run against the built library, never typed. A value this spec states comes from the
verified JSDoc in L§4; every other value is "from the run".

Line anchors are for the tree this spec describes. Re-read each file before editing: an anchor
says where to look, not what is there.
