## F. Content pages

All paths are under `apps/dox/src/content/docs/`.

### F1. The MAR-16 content pages (step D1b, after D1)

This work writes them, following `context/domination/docs-site.md` (§ What a story ships, § Rules)
and L§8.4 as decision 9 amends it. **Every result shown is the function's real output**, run
against the `dist` the main session built before D1, with a throwaway script in the scratchpad;
nothing is elided. Only merged functions are named: every L§1.1 function except the removed GPS
forms, never SPA-46's TAI64 functions. `scripts/api-surface.mjs check` checks each import-bound
`call // result`.

**Placement.** The `gnss` and `maritime` tags and the `gnss-` and `maritime-` guide prefixes are
valid only once D3 declares those industries, so D1b and D3 run as one step: no test, check or
`stats.mjs` run between them. A scenario is tagged `maritime` as well as `gnss` where its example
is a ship's receiver or log.

**Authorities, in the order of decision 11.** The GNSS and Maritime guides rest on IMO's recognition of
each system as a component of the Worldwide Radionavigation System, in section 0's short form,
with the scope caveat once (BeiDou and IRNSS for ocean waters, IRNSS only within its region) and
the full citation chain in a sources list; on IEC 61162-1:2024 (Edition 6.0) for the sentence
format; and on RINEX 4.02 and the BIPM for the scales. IEC 61108 appears, if at all, per system
(part 1 GPS, 2 GLONASS, 3 Galileo, 5 BeiDou, 6 NavIC/IRNSS), never for "the six".
The Core guide rests on IERS (`Leap_Second.dat`, Bulletin C 72), ITU-R TF.460-6, the BIPM and the
CGPM. A system's own interface document is named only for a signal fact no international body
restates (a counter's bit width), labelled with its system, and never as the only source for a
system's scale.

| Page | Tag | Content |
| --- | --- | --- |
| `guides/industries/gnss-system-time-and-week-rollover.mdx` | `[gnss]` | The GNSS industry's guide. One `##` per rule, every system a peer (with section 0's recognition sentence and scope caveat once): each system's clock runs ahead of UTC by a gap that grew with each leap second, read from the table (examples rotate through the systems; none leads); the six RINEX scales and their first instants, with Galileo's 13 s and NavIC's derived offset; `GLO` is GLONASS time in UTC's own hours, with UTC's leap seconds, and the library reads no other GLONASS scale; week counters by name (LNAV, CNAV, L1NV, Galileo, BeiDou), the rollover instants, an integer era, `"rolling"` and a `notBefore` pivot; RINEX navigation weeks against broadcast weeks, with `BDT` counting from 2006 and the other four from 1980; links to the three GNSS tools; a closing `## See it break, then work` list |
| `guides/industries/maritime-gnss-time-and-week-rollover.mdx` | `[maritime]` | The Maritime guide, about ships, not the scales: IMO's recognition of the six systems (section 0's sentence, the scope caveat, the full citation in a sources list); shipboard equipment carrying time in IEC 61162-1:2024 sentences, in UTC; why a ship's log keeps UTC and when a satellite clock reading enters it; a receiver's week-rollover exposure over a ship's service life (the rollover checker); a leap second in a ship's record. It sends the reader to the GNSS guide for each rule rather than restating it. Links the three GNSS tools |
| `guides/core-date-operations/leap-seconds-and-tai.mdx` | `[core]` | Beside `nanosecond-precision.mdx`. The insertions in a table, citing IERS `Leap_Second.dat` and Bulletin C 72; TAI − UTC by date (`taiMinusUtc`, `null` before 1972); `23:59:60` is real only on listed days (`isLeapSecond` against `hasSecond60`); counting with `leapSecondsBetween` (signed, half-open); `nextLeapSecond` and its `""`; `toTAI` and `fromTAI` through an inserted second; elapsed seconds against the clock difference (`spanNs` over TAI readings); CGPM 2022 Resolution 4 and CGPM 2026 Resolution 5, and why the table is closed; the weekly canary; links to the Timeline and Elapsed vs. Clock. Links `/reference/timescale/…` freely |
| `scenarios/gnss-offset-hardcoded.mdx` | `[gnss, maritime]` | `<Scenario>`, `fixedSpecId="utcToGnss"`: a fixed gap applied to a log from before the last insertion |
| `scenarios/gnss-week-that-wrapped.mdx` | `[gnss, maritime]` | `fixedSpecId="gnssWeekToUtc"`: a 10-bit week read in the wrong era |
| `scenarios/thirteen-bit-week-read-as-ten-bit.mdx` | `[gnss]` | `fixedSpecId="gnssWeekToUtc"`: a CNAV or L1NV week fed to a 10-bit counter |
| `scenarios/rinex-week-read-as-broadcast.mdx` | `[gnss]` | `fixedSpecId="rinexWeekToUtc"`: `IRN` 2295, 86418 read as `IRN-L1NV` gives 2043-08-17T00:00:00Z (L D12) |
| `scenarios/a-leap-second-that-never-happened.mdx` | `[core]` | `fixedSpecId="isLeapSecond"`: `2017-12-31T23:59:60Z` accepted by a pattern check |
| `mistakes/gnss.mdx` | `[gnss, maritime]` | `<Mistake>` pairs with `rightSpecId`: the sign of a system's lead over UTC, and of TAI − GST; a fixed gap; today's gap applied at a system's first instant; `GLO` read on any clock other than UTC's hours (the Wrong side adds an offset of its own; the page names no other scale); a week with no counter or era; a RINEX week fed to a broadcast counter |
| `mistakes/leap-seconds.mdx` | `[core]` | `hasSecond60` used as a leap-second check; an integer TAI − UTC before 1972; a span across an insertion read as elapsed seconds |
| Indexes | — | `guides/index.mdx`, `guides/core-date-operations/index.mdx`, `mistakes/index.mdx` and `guides/industries/index.mdx` gain the new links (hand-kept, docs-site.md). `scenarios/index.mdx` is generated; never edit it |

Each scenario ends with the paragraph saying what to edit in the widget. Each `fixedSpecId` and
`rightSpecId` is a key of `LIVE_PLAYGROUND_TEMPLATES` (the build throws otherwise); C1 must be in
place so `gnssWeekToUtc` has a form, not a text box. No page names a law, a regulator or a peer
library, and section 0's rules hold on every page.
