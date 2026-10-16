# Spec: declared industry layers (Workforce, GNSS, Maritime) and five GNSS and leap-second tools (MAR-16)

What `apps/dox` ships for MAR-16 (#197). `dox-builder` builds against this spec, and `dox-tester`
verifies against section I. This is not `packages/gmt` work: the library side is
[`context/domination/specs/MAR-16-spec.md`](../../domination/specs/MAR-16-spec.md) ("the library
spec" below, "L§n" for its section n).

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
    that ISO UTC pivot. The library architect specs it and the driver builds it in this branch
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

---

## 0. Binding rules

- **No git operation that changes state, and no `gh` write.** No `add`, `commit`, `stash`,
  `checkout`, `restore`, `rm`, `worktree add`, `push`, pull request or issue edit. Every change
  stays unstaged.
- **Never touched:** `packages/gmt/src`, `packages/gmt/skills`, `packages/gmt/package.json`,
  `.changeset/` and `context/domination/`. A library problem found here is reported to the main
  session and never built around. **One exception, named here:** the "By industry:" line and the
  namespace-link line of `README.md` and `packages/gmt/README.md` (B3), because `stats.mjs check`
  enforces them in the same change. The two files stay byte-identical. Nothing else in either
  README changes. The library finalizer's `/update-readme` pass verifies these lines and does not
  rewrite them. **A second exception, for step DU (section M):** the CORE-76 lines of
  `context/domination/issues/CORE-76.md` (line 41) and `context/domination/tracker.md` (the CORE-76
  notes near lines 157–158, 196 and 215). Other sessions edit `tracker.md`; re-read it and change
  only those lines.
- **Never rebuild `packages/gmt/dist` in this worktree.** The owner's `pnpm dox:dev` aliases the
  library to `dist`, so a rebuild breaks every open tool. Do not run `pnpm run validate`,
  `pnpm build`, `pnpm dox:dev`, `pnpm --filter @northguild/gmt build` or any script that builds
  the library here. The main session builds `dist` once, before step D1 (section K). Every value
  a page or test shows is run against that `dist` with a throwaway script in the scratchpad.
- **Never use port 4321 or `apps/dox/dist`.** A site build goes into a private tree under the
  session scratchpad (I0). Stop every server you start.
- **Toolchain.** Prefix every Node command with `eval "$(fnm env)" && fnm use &&`.
- **Never run `vitest list --json` with a file path.** Use `vitest run <file> --reporter=verbose`.
- **Import gmt at module granularity only**, through `GMT_MODULES`. The four new keys
  (`gnss/convert`, `timescale/calculate`, `timescale/convert`, `timescale/validate`) are the
  library pipeline's (L§5.4); this work adds none.
- **The widget draws the library's results and computes none of them.** Every instant, week,
  era, label, offset and verdict on screen is a gmt call. Where a mark sits is drawing.
  `@js-temporal/polyfill` is imported for drawing positions and for reading the clock only.
- **The site holds no table of the library's rules.** A counter's modulus, a system's epoch and an
  era's start come from probing the library (D3). The lists of counter and system names are the
  library's type members, held in one leaf module and checked against the generated playground
  templates (D1).
- **The printed call is the call made.** Every call is recorded and printed beside its result,
  in order. A blank optional input is left out and never filled from a preset.
- **World standards only.** GLONASS appears only as the RINEX and BIPM `GLO` scale: GLONASS time
  in UTC's own hours, with UTC's leap seconds. No string in this work (widget, preset, chat copy,
  page copy, industry text, test name) mentions UTC+3, Moscow time, MSK or a three-hour shift.
  The library's JSDoc may; this work, the guides and mistakes pages of F1 included, does not
  repeat it. Where a page needs to say what `GLO` is, it says: GLONASS time as RINEX and the BIPM
  report it, in UTC's own hours, and the library reads no other GLONASS scale.
- **Core namespaces, industry layers, cross-industry layers** (`context/coding-standards.md` line
  230). A function shared across industries goes in the cross-industry layer for its domain
  (`workforce`, `gnss`) or in Core if it is truly general (`timescale`), never in a grab-bag
  "shared" namespace, never in one industry's namespace when others need it, and never in a new
  namespace that is not a recognised domain. On the site a cross-industry layer is an industry
  like any other, and other industries declare it among the modules they draw on (B1).
- **"space" is not an industry, area, kind or namespace name.** A planned spatial and geo
  expansion takes the word.
- **GMT tracks no law.** No statute, regulator, agency, court or named regime appears in a widget
  string, a preset, a chat doc, page copy or a test name. A working-time regime is described by its
  numbers only.
- **International authority first.** Every citation follows decision 11: ISO, IEC, ITU, BIPM, IERS,
  IAU, IMO, CGPM and IGS/RINEX first; multinational industry bodies next; a national source only
  as one labelled peer. The six satellite systems' scales are defined by RINEX and the BIPM. **Why
  they are peers** (research §9a):
  - The short form, used in the Maritime guide and tool copy: "IMO recognises GPS, GLONASS,
    BeiDou, Galileo, NavIC (IRNSS) and QZSS as components of the Worldwide Radionavigation
    System." Its one primary page naming all six is IMO's Maritime Safety Committee 104th session
    summary (October 2021).
  - The full citation, where a page gives one: recognition under the policy of IMO resolution
    A.1046(27) (2011), whose annex MSC.599(111) (2026) revised; GPS and GLONASS by A.860(20)
    (1997); BeiDou by SN.1/Circ.329 (2014); Galileo by SN.1/Circ.334 (2016); IRNSS by
    SN.1/Circ.340 (2020); QZSS by SN.1/Circ.341 (2021). **A.1046(27) itself names no system**, so
    it is never cited alone for the six.
  - **The scope caveat, said once wherever a page or tool says "peers":** recognition is not
    equal everywhere. BeiDou and IRNSS are recognised for ocean waters, and IRNSS only within
    55°E–110°E, 50°N–5°S.
  - **IEC 61108** is cited per system only (part 1 GPS, 2 GLONASS, 3 Galileo, 5 BeiDou, 6
    NavIC/IRNSS), never as a six-system authority: it has no QZSS part.
  - **IEC 61162-1:2024 (Edition 6.0)** is cited for the sentence format shipboard equipment uses,
    not for peer status.
  A system's own interface document is cited only for a signal fact no international body
  restates, labelled with its system.
- **No US lead.** No tool, preset, starter or page opens on `America/New_York`, on `en-US` or on a
  US-only example. Rotate zones through `Europe/London`, `Asia/Tokyo`, `Australia/Sydney`,
  `America/Sao_Paulo`, `Africa/Johannesburg` and `Asia/Kolkata`, keeping a zone only where the
  example needs its DST shape or a standard's own code needs it (an X12 time code such as `ET`
  names a US zone by definition). A locale, where one is needed, is regionless (`"en"`).
- **Every sentinel renders through `renderWidgetOutput(out, "NO SIGNAL", "sentinel")`** with one
  plain sentence. A state with no library call behind it renders as `"empty"`, never amber.
- **No left-border-only accent** on any plate, lane, row, table or result block. An accent edge
  is a bottom edge, or the element has a full border. No class contains `card` except
  `.gmt-widget-card`.
- **Amber is the sentinel's alone.** No verdict, era, lane or state is amber, green for good or
  red for bad. A series colour goes on a mark, never on text.
- **Readouts hold still.** Plates are pinned at their edges with reserved widths, `tabular-nums`
  and `nowrap`. Every region is present in every state. Nothing above a dragged control moves or
  resizes, and no plate moves or resizes while a range is dragged.
- **Every new tool ships with its Dox button:** its `CHAT_STARTERS` card and its chat-widget
  registration land with the tool.
- **Zero known bugs.** No `it.skip`, `it.todo` or `it.fails`. A defect found is fixed now, with
  every other case of it. Every existing assertion stays unless this spec changes what it asserts;
  each one that changes is listed in the builder's report with its reason.
- **No constants that age.** No fixed year window, era count or "current era". Which eras to draw
  comes from the library at the reader's today (D3).
- **No catch-all functions** in new helpers. Split by kind with narrow unions; one shape out.
- **Plain English** (`/plain-english`) for page copy, widget strings, comments and context files.
  Page copy holds no tool, function or test count.
- **React stays inside `/dox`.** Each tool page is Astro plus a plain-DOM module, and imports no
  `dox-tools.ts`, `zod` or `ai`.
- **Re-verify every changed example by running it.** A preset, a page example or a starter whose
  zone changes gets its new output from a run against the built `dist`, never by editing the old
  value. Test fixtures under `packages/gmt` and the CI zone matrix are never touched.

---

## A. Scope and non-goals

**In scope:** section B (industry layers, hub pages, the README line and the agent docs that state
the rule); section C (the classifier fix, the rename redirect); section D (five tools and their
registration); the MAR-16 content pages of F1 (L§8.4: the GNSS and Maritime guides, the Core guide, five
scenarios, two mistakes pages, the index edits); the five tool pages; the links between the tools
and from the content pages into them; the GNSS and Maritime overview text; section M (the Workforce layer: the duty pages
moved and retagged, with their redirects); section N (the Dox items of the international-standards audit: widget defaults, the
example rebalance, the Workforce guide's examples); the stacked "By industry" chart (B9); `context/dox/` close-out (section H).

**Not in scope:**

- A `maritime/` namespace. MAR-17 creates it; then `industries.json` adds `"maritime"` to the
  Maritime list and B's rules make it Maritime's own namespace with no other edit.
- Aviation and IoT layers. The design allows each as one `industries.json` entry, one icon and one
  overview text, and a tag on the decoder page (`industries: [maritime, aviation]`).
- A GLONASS week, a GLONASS mode or any non-RINEX GLONASS scale.
- SPA-46's TAI64 functions (not merged).
- `packages/gmt`, `.changeset/`, and `context/domination/` beyond the CORE-76 lines of section M.
- The library half of the audit: the JSDoc example rebalance, the parser default locale, the NRF
  wording, the skills. The generated reference pages change when that lands; this work does not
  edit them.

---

## B. Industry layers: declared, not inferred

Today an industry layer *is* a namespace: `scripts/stats.mjs` `industryLayers()` (line 215) takes
the prefix of each `guides/industries/<prefix>-….mdx` file and throws when no such namespace
exports a function; `gmt-stats.json` `industries` lists those namespaces;
`src/lib/industry-tags.ts` builds every tag id from that list; the API Reference's "By industry"
group, the overview text at `/reference/<namespace>/`, the page tags, the `/why-gmt` industry chart
and the README's "By industry:" line all key on it. A Maritime guide therefore makes
`stats.mjs` throw ("`maritime` exports no function"), and nothing can say that Transport uses the
duty engine or that Maritime uses `gnss`.

### B1. The rule

- **An industry is declared** in `apps/dox/src/data/industries.json`: its own namespace, when it
  has one, and the modules it **draws on**. A drawn-on module is a subpath of the exports map at
  one of two depths: a whole namespace (`workforce`, `gnss`, `timescale`), meaning every module in
  it, or one sub-module (`<namespace>/<module>`), meaning that module alone.
- **An industry's own namespace is named for it** (`@northguild/gmt/<id>`): `transport`,
  `intermodal`, `workforce`, `gnss`. Maritime has none yet; MAR-17 creates `maritime/`.
- **A cross-industry layer is an industry** (decision 16, `context/coding-standards.md` line 230).
  `workforce` and `gnss` are recognised domains that other industries draw on; on the site each is
  an industry with its own namespace, hub, guide and tag, and the industries that use it declare
  it in `drawsOn`. `timescale` is Core: no industry owns it, and GNSS and Maritime draw on it.
- **An own namespace is an industry namespace:** it sits under the reference sidebar's "By
  industry" divider, its reference pages carry its industry's tag, and its functions are that
  industry's solid segment in the `/why-gmt` chart (B9). A drawn-on Core module stays general
  everywhere: the reference sidebar, `/reference/`, the README, its pages' tags.
- **Every industry gets a hub page** at `/industries/<id>/`, generated, and every industry is
  listed at `/industries/` and on the `/reference/` root page.
- **The tags on a tool, scenario, guide or mistakes page** may name any industry whose own
  namespace or drawn-on modules the page uses, several at once, or `core` when the page uses no
  industry's own namespace. So a GNSS tool is `[gnss, maritime]`, the duty scenarios are
  `[workforce, transport]` where they are about drivers, and a timescale-only page may be `core`.

### B2. `apps/dox/src/data/industries.json` (new, tracked)

An array in display order. **The order follows what builds on what**, so a reader meets a layer
before any layer that uses it: **Workforce** (draws on nothing), **Transport** (draws on
`workforce`), **Intermodal** (built on transport's legs and day counts, its guides say so),
**GNSS** (draws on Core `timescale` only), **Maritime** (draws on `gnss`). Today's order is
intermodal before transport, an accident of the function count, so the tools index, the three
section sidebars, the reference "By industry" groups and the README line change order; read that
diff as intended.

```json
[
  {
    "id": "workforce",
    "label": "Workforce",
    "definition": "People's working time: duty logs, hours-of-work limits, rest and rolling windows, for any crew, shift or rota.",
    "icon": "industry-workforce",
    "guide": "/guides/industries/workforce-hours-of-work/",
    "namespace": "workforce",
    "drawsOn": []
  },
  {
    "id": "transport",
    "label": "Transport",
    "definition": "Legs, dwell, cut-offs, punctuality and crew hours of work, shared by road, rail, sea and air.",
    "icon": "industry-transport",
    "guide": "/guides/industries/transport-legs-and-dwell/",
    "namespace": "transport",
    "drawsOn": ["workforce"]
  },
  {
    "id": "intermodal",
    "label": "Intermodal",
    "definition": "<today's text from industry-tags.ts>",
    "icon": "industry-intermodal",
    "guide": "/guides/industries/intermodal-free-time-and-demurrage/",
    "namespace": "intermodal",
    "drawsOn": []
  },
  {
    "id": "gnss",
    "label": "GNSS",
    "definition": "Satellite navigation time for any receiver: the six system times, week numbers and their rollovers, and RINEX navigation weeks.",
    "icon": "industry-gnss",
    "guide": "/guides/industries/gnss-system-time-and-week-rollover/",
    "namespace": "gnss",
    "drawsOn": ["timescale"]
  },
  {
    "id": "maritime",
    "label": "Maritime",
    "definition": "Satellite time at sea and in ships' records: the clocks receivers on board read, their week rollovers and the leap seconds between them.",
    "icon": "industry-maritime",
    "guide": "/guides/industries/maritime-gnss-time-and-week-rollover/",
    "drawsOn": ["gnss", "timescale"]
  }
]
```

D1 writes Workforce, Transport and Intermodal (with the library's `workforce/` move landed, P1).
The GNSS and Maritime entries are added in step D1b + D3, right after their guides are written (the
overview test requires each guide).

Rules, each enforced (B3 for `stats.mjs`, B8 for the tests):

- `id` is a lowercase word, unique, and never `core` or `space`. `industry-tags.ts` exports
  `RESERVED_INDUSTRY_IDS = ["core", "space"]` with a comment: `core` is the tag for core-only
  pages; `space` is taken by a planned spatial and geo expansion.
- `namespace`, when present, equals `id` and exports a function. If a namespace named `<id>`
  exports a function, industry `<id>` declares it as its `namespace`.
- `drawsOn` has no duplicate and does not hold the industry's own namespace. Each entry is a whole
  namespace or a `namespace/module` that exports a function (the corpus has a function with that
  `namespace`, or that `namespace` and `module`); no entry is both listed whole and as one of its
  sub-modules.
- An entry of `drawsOn` that is another industry's own namespace is a **shared industry layer**
  (Transport's `workforce`, Maritime's `gnss`); any other entry is a **Core module** (`timescale`).
- An industry with no `namespace` draws on at least one module.
- `guide` is the path of a guide whose file is `guides/industries/<id>-<topic>.mdx`.
- `icon` names a key of `INDUSTRY_ICON_PATHS`.

### B3. `scripts/stats.mjs` and the READMEs

- **`industryLayers()` becomes `industryDeclarations(corpus)`.** It reads
  `apps/dox/src/data/industries.json` and checks the B2 rules that need the corpus: every
  `namespace` and `drawsOn` entry exports a function; every `guides/industries/<prefix>-….mdx`
  prefix is a declared `id` (error: "an industry guide is named for a declared industry, and
  `<prefix>` is not one; declare it in apps/dox/src/data/industries.json"); a namespace named for a
  declared industry is that industry's `namespace`. The header comment's "industry layers" source
  line says the declaration file is the source.
- **`apiSurface()` returns `industryNamespaces`**: every industry's own namespace, in
  `byNamespace` order. `gmt-stats.json`'s key `industries` is renamed `industryNamespaces`. With
  the library's move it holds `transport`, `intermodal`, `workforce` and `gnss`.
- **`apiSurface()` also returns `industryLayers`**, the stacked chart's data (B9), in declared
  order: `{ id, label, own: number, drawsOn: [{ module, count, shared: boolean }] }`, each count the
  corpus's functions in that namespace or `namespace/module`; and **`industryFunctions`**, the
  number of distinct functions in all own namespaces. Core functions are every function outside
  an own namespace, so `coreFunctions + industryFunctions = functions` exactly. `statsObject()`
  (line 344) writes all three into `gmt-stats.json`, and `show` (line 858) prints each industry
  with its namespace and drawn-on modules.
- **`namespaceLinkProblems` (line 610) checks the new README shape:**
  1. Every namespace that exports a function has one `…/reference/<ns>/` link, labelled with its
     namespace, on a line that does not start with `By industry:`. That includes the own
     namespaces (`transport`, `intermodal`, `workforce`, `gnss`). No `/reference/` link to anything
     else; a sub-module has no README link of its own.
  2. The `By industry:` line links `https://gmt-dox.northguild.workers.dev/industries/<id>/` for
     exactly the declared industries, in declared order, each labelled with its `label`, and
     holds no `/reference/` link.
  3. No `/industries/<id>/` link to an undeclared id anywhere.
  Each failure is a message for a person, as today; `sync` rewrites none of it.
- **The README edit**, identical in both files: `[transport]`, `[intermodal]` and `[workforce]`
  join the namespace line and `[duty]` leaves it (the library finalizer adds `[gnss]` and
  `[timescale]`, L§5.3; whichever of the two lands second keeps the line consistent). Line 52
  becomes `By industry: [Workforce](…/industries/workforce/) · [Transport](…/industries/transport/)
  · [Intermodal](…/industries/intermodal/)`, with the full site URL in each link, and
  `· [GNSS](…/industries/gnss/) · [Maritime](…/industries/maritime/)` is appended in step D3. Then
  `node scripts/stats.mjs check` passes.
- **The agent docs that state the old rule**, one sentence each, saying the namespace line links
  every namespace and the "By industry:" line links each industry's page:
  `.agents/finalizer.md` (86–87), `.agents/gmt-reviewer.md` (359),
  `.agents/skills/update-readme/SKILL.md` (30, 62), `.agents/skills/update-readme/references/steps.md`
  (67), `context/code-review-checklist.md` (44; change only that line).

### B4. `src/lib/industry-tags.ts` and `src/data/gmt-stats.ts`

- `industry-tags.ts` reads `industries.json` and no longer imports `gmt-stats`. It stays a leaf
  (`content.config.ts` imports it). `DETAILS` keeps only `core`; every layer's label, definition,
  icon and guide come from the JSON.
- Exports, all derived from the JSON:
  - `INDUSTRY_TAG_IDS` (core, then the layers in declared order) and `INDUSTRY_LAYER_IDS` (the
    layers);
  - `ownNamespace(id): string | undefined`; `OWN_NAMESPACES` (in declared order);
    `industryOwning(namespace): string | undefined`;
  - `drawsOn(id): readonly string[]`;
  - `moduleCovers(declared, namespace, module): boolean`: a whole namespace covers each of its
    modules; a sub-module covers itself alone. Every consumer below matches through it, never by
    string prefix;
  - `industriesUsing(namespace, module): readonly string[]`: every industry whose own namespace or
    drawn-on modules cover it;
  - `RESERVED_INDUSTRY_IDS`.
- `INDUSTRY_ICON_PATHS` gains three glyphs in the 24×24 stroke format of the others, none reusing
  a transport mode's glyph (`ship` and `barge` are modes): `"industry-workforce"` (a person beside
  a clock face), `"industry-gnss"` (a satellite: a body, two panels and a signal arc) and
  `"industry-maritime"` (an anchor). Each is legible at 14px; `industry-tags.test.ts` checks every
  icon exists.
- `industrySidebarCss()` emits one rule per industry with an own namespace (only those have a
  reference group). Its test says so.
- `gmt-stats.ts`: `GmtStats.industries` becomes `industryNamespaces`; `GmtStats` gains
  `industryLayers` and `industryFunctions`. `coreNamespaces`, the exported `industryNamespaces`
  (the `NamespaceCount[]`), `coreFunctions` and `industryFunctions` read them; the names of the
  exports stay. `gmt-stats.test.ts` asserts `coreFunctions + industryFunctions === functions`.
- `src/content/docs/why-gmt.mdx` line 112: "{n} are industry layers built on it" becomes
  "{n} belong to one industry each". The figures still come from `gmt-stats`.

### B5. The generator (`scripts/build-reference.ts`, `scripts/build-utils/index-pages.ts`)

- `industryOf(namespace)` (line 3153) becomes `industryOwning(namespace)`. `withIndustry` and
  `typeIndustry` (line 2804) read the own namespaces: a shared type is tagged only when every
  function that reaches it is in one industry's own namespace. A `gnss` type is tagged GNSS; a
  `timescale` type is general.
- `buildSidebar(…, industries)` receives `OWN_NAMESPACES`. The divider, its label and each own
  namespace group's `Overview` link with `data-gmt-industry` are unchanged; `workforce` and `gnss`
  now sit under the divider.
- `industryIndex()` (line 2814) returns every declared industry with its `namespace` and `drawsOn`.
- **`/reference/` root** (`renderIndexPages`): "For any industry" lists every namespace that is no
  industry's own (`timescale` among them). "By industry" lists every declared industry: its `Icon`,
  `[Label](/industries/<id>/)`, its definition, then its own namespace as a link when it has one
  and "Draws on [`gnss`](/reference/gnss) and [`timescale`](/reference/timescale)." (each module
  linked to its own index). Its lead sentence: "Each industry has a namespace of its own, draws on
  the layers above it, or both."
- **`/reference/<own namespace>/`** keeps its tag and its module lists. The pain-point block
  (`industryIntro`) leaves it for the hub. In its place, one line: "The Transport industry's own
  namespace. What it solves, and the guides and tools that show it, are on
  [Transport](/industries/transport/)." The URLs of `transport` and `intermodal` are unchanged.
- `industryIntro` and `painPointItem` move to `scripts/build-utils/industry-pages.ts` (B6).
  `firstSentence` and `listItem` are exported from `index-pages.ts` for it.
- `referenceInputs()` lists `src/data/industries.json`, `build-utils/industry-pages.ts` and
  `build-utils/moved-pages.ts` (M3).

### B6. The hub pages

**New:** `scripts/build-industry-pages.ts` (a `generate` step) and the pure
`scripts/build-utils/industry-pages.ts`.

- **Step order** in `apps/dox/package.json` `generate`: after `build-tool-index.ts`, before
  `build-industry-sidebars.ts`. It reads `src/generated/reference/gmt-corpus.json` (the one
  extraction; it never walks `packages/gmt/src`) and the frontmatter of every page under
  `guides/`, `tools/`, `scenarios/` and `mistakes/`, using `readSectionPage` from
  `build-utils/industry-sidebar.ts` (extend it to read `description` for the lists).
- **It writes**, through `writeIfChanged`, deleting a stale hub as `syncTree` does:
  - `src/content/docs/industries/index.mdx`: title `By industry`, one item per industry: label as
    a link to its hub, definition, its own namespace, and "Draws on" its modules.
  - `src/content/docs/industries/<id>.mdx` per industry (`workforce`, `transport`, `intermodal`,
    `gnss`, `maritime`), frontmatter `title: <Label>`, `description: <definition>`,
    `industries: [<id>]`, then:
    1. the overview's `about` paragraph;
    2. `## What these functions solve`: each pain point, its `{{name}}` tokens linked to the
       function's corpus `url`. A token naming a function outside the industry's own namespace and
       drawn-on modules stops the step with a message naming `src/lib/industry-overview.ts`;
    3. "Start with the guide: [title](guide)." with the guide's own title;
    4. `## Its own functions` (when it has a namespace): `### [`ns`](/reference/ns)`, each module
       as a bold link to its index and its functions as `listItem`s;
    5. `## Functions it draws on`: per drawn-on module in declared order, a whole namespace as
       `### [`ns`](/reference/ns)` with its modules, a sub-module as
       `### [`ns/module`](/reference/ns/module)` with its functions. A shared industry layer's
       heading is followed by "Part of the [GNSS](/industries/gnss/) industry layer." (its own
       hub);
    6. `## Guides`, `## Tools`, `## Scenarios`, `## Mistakes`: every page in that section whose
       `industries` holds the id, by title, each `- [Title](/section/slug/): description`. An empty
       section is left out.
  - `src/generated/industries-sidebar.ts`: `industriesSidebar`, `{ label: "Overview", slug:
    "industries" }` then one link per industry, `{ label, slug: "industries/<id>", attrs:
    { "data-gmt-industry-link": "<id>" } }`.
- **Plain Markdown only** in the hubs: no component import, so `stripMdx` and the `.md` twin need
  nothing new.
- `.gitignore`: `apps/dox/src/content/docs/industries/`, beside the tools index line.
- `astro.config.mjs`: import `industriesSidebar`; a top-level group
  `{ label: "Industries", collapsed: true, items: industriesSidebar }` after "Start here".
- **`SidebarSublist.astro`**: a link entry carrying `data-gmt-industry-link` shows the tag's glyph
  as an inline `aria-hidden="true"` `focusable="false"` SVG before its label, in the label's own
  colour, through the helper that draws a divider's icon (generalise `dividerIcon` to take the
  id). The attribute is not `data-gmt-industry`, because the group-icon rule
  (`details:has(> ul > li > a[data-gmt-industry])`) would then paint the "Industries" group's own
  summary.
- **`llms.txt` and `llms-full.txt`** (`src/pages/llms.txt.ts`, `llms-full.txt.ts`): an
  "Industries" section after "Start here" listing `/industries/` and each hub.
- `guides/industries/index.mdx` (step D3): one sentence under its intro: "Each industry also has
  an overview page under [By industry](/industries/)." Its frontmatter description stops naming
  the layers: "Guides for the industry layers built on the core primitives, with real-world
  scenarios." Its "Layers" list gains the Workforce, GNSS and Maritime guides.

### B7. Overview text (`src/lib/industry-overview.ts`)

- `IndustryOverview` keeps its shape. A `{{name}}` token resolves against the industry's own
  namespace and its drawn-on modules (`moduleCovers`).
- Wording is the builder's, under `/plain-english` and the test's rules: no digit (so no "1024",
  no "L1NV"), no "GMT", no law or named regime, no UTC+3 or Moscow, three to five pain points.
- **Workforce** (step DU): `about`: people's working time is counted in duty days, rolling
  windows and rests that may be split; a regime is a set of numbers the caller states. Pain points
  from the hours-of-work pages: a duty day that does not start at midnight (`{{dutyDayFor}}`); a
  sliding window that is not a calendar day (`{{evaluateDutyLog}}`, `{{dutyTotals}}`); a split rest
  that does or does not qualify (`{{qualifyingRestPairs}}`); a log that must be checked before it is
  counted (`{{isValidDutyLog}}`). "See" links: the Workforce guide, `mistakes/workforce`, the three
  scenarios.
- **Transport** gains one pain point (step DU) for crew hours of work: tokens name `workforce`
  functions, which resolve because Transport draws on `workforce`; "see" links to the Workforce
  guide and the driver-shaped scenarios.
- **GNSS** (step D3): `about`: every satellite system keeps its own continuous clock, counts weeks
  on a counter that wraps, and differs from UTC by a number of seconds that grew with every leap
  second; this layer reads those clocks and weeks without a hand-kept offset. Pain points:
  1. "A receiver's week number repeats." → `{{gnssWeekToUtc}}` takes the counter and the rollover
     era by name, and `{{utcToGnssWeek}}` returns the week, the time of week and the era. See the
     decoder, the rollover checker and the wrapped-week scenario.
  2. "Satellite time is not UTC, and the gap grew with each leap second." → `{{utcToGnss}}` and
     `{{gnssToUtc}}` read each system's gap from the built-in leap-second table, for every system
     alike. See the clock converter and the hard-coded offset scenario.
  3. "A week in a RINEX navigation file is not the week a satellite sends." → `{{rinexWeekToUtc}}`
     and `{{utcToRinexWeek}}` read the continuous count. See the RINEX scenario and the decoder.
  4. "A logged second sixty may not be a real leap second." → `{{isLeapSecond}}` checks the table,
     and `{{toTAI}}` and `{{fromTAI}}` carry an inserted second through (drawn on from
     `timescale`). See the leap-second scenario and the leap-seconds guide.
- **Maritime** (step D3): `about`: ships and their shore systems take time from satellite
  receivers, carry it between instruments in standard sentences, and keep logs that outlive a
  receiver's week counter. Pain points: a receiver that starts reporting dates a counter period
  early (`{{gnssWeekToUtc}}`, the rollover checker); a log that mixes satellite time and UTC
  (`{{gnssToUtc}}`); a leap second in a ship's record (`{{isLeapSecond}}`). "See" links: the
  Maritime guide, the GNSS guide, the rollover checker and the clock converter.
- `guideTitle` of each: its guide's own title, read from its file.

### B8. Tests

- **`industry-tags.test.ts`**:
  - "has a tag for core and for every declared industry": `INDUSTRY_TAG_IDS` equals core plus the
    JSON ids in order; no id is in `RESERVED_INDUSTRY_IDS`; every icon exists.
  - **The declaration rules of B2** that need no corpus, and those that do against the generated
    corpus.
  - **The used-layer rule.** For each page, `used` = the `(namespace, module)` pairs whose
    `/reference/<ns>/<module>/…` pages it links or whose `@northguild/gmt/<ns>/<module>` barrel it
    imports, plus `(namespace, *)` for a link to `/reference/<ns>/` itself or an import of the
    namespace barrel. `allowed` = `industriesUsing` over `used`, plus `core` when no own namespace
    appears in `used`. A page's declared tags are a non-empty subset of `allowed`. So the Core
    timescale guide (`[core]`) passes; a GNSS tool (`[gnss, maritime]`, links `/reference/gnss/…`)
    passes; a duty scenario (`[workforce, transport]`, links `/reference/workforce/…`) passes; and a
    page that links `/reference/transport/` or `/reference/gnss/` cannot be `core`.
  - The sidebar-icon tests count the industries with an own namespace.
  - New: a hub link in `SidebarSublist.astro` draws its icon `aria-hidden` and `focusable="false"`.
- **`industry-overview.test.ts`**: text for every declared industry and nothing else; tokens name
  functions of the own namespace or drawn-on modules; the generated reference tests tag every page
  of an **own** namespace (so every `workforce` and `gnss` page), tag no page of any other namespace
  (so no `timescale` page), and tag a shared type only with an industry.
- **`gmt-stats.test.ts`**: re-derives `industryLayers`, `industryNamespaces` and
  `industryFunctions` from the corpus and the JSON, and asserts no function is counted in two own
  namespaces and `coreFunctions + industryFunctions === functions`.
- **`index-pages.test.ts`**, **`build-reference.test.ts`**, **`industry-sidebar.test.ts`**: follow
  the rename and the new root page, with fixtures of an industry that owns a namespace and draws on
  another industry's, one that draws on a sub-module, and one that owns none.
- **New `scripts/build-utils/industry-pages.test.ts`**: a hub's sections and order; a shared
  industry layer's heading links its hub; a sub-module lists only its own functions; a token outside
  the own namespace and drawn-on modules throws; an empty section is left out; the index lists
  every industry; the sidebar source holds `data-gmt-industry-link` and never `data-gmt-industry`.
- **A stats test is not added** (root `scripts/` has none); `node scripts/stats.mjs check` is the
  gate (I3).

### B9. The stacked "By industry" chart (`/why-gmt`)

- **Data:** `gmtStats.industryLayers` (B3), never a figure typed in the page or the chart module.
- **Marks** (`industryDefinition` in `src/lib/why-gmt-charts.ts`): one column per industry, in
  declared order, stacked with `@tanstack/charts`'s stacking (`stackRowsY` or the `barY` stack
  option; look it up in the installed version's documentation with `ctx7` before writing). The
  bottom segment is the industry's own functions, in the spring gradient, solid. Above it, one
  segment per drawn-on module, in a lighter tint of the same hue with a hatch (`--gmt-spring` at
  reduced strength plus a pattern, so the difference never rests on colour alone). An industry with
  no own namespace (Maritime) has only shaded segments.
- **Tooltip** (`industryTooltip`): the industry, its own functions, and one row per drawn-on module:
  "draws on `gnss` (GNSS industry layer): n" or "draws on `timescale` (Core): n".
- **Legend**, under the chart: a solid swatch "the industry's own functions" and a hatched swatch
  "a shared layer it draws on". Swatches are marks; the words carry the meaning.
- **Caption** (`why-gmt.mdx` line 131): "`{industryFunctions}` functions across
  `{industryNamespaces.length}` industry layers; lighter segments are shared layers an industry
  draws on." The figures come from `gmt-stats`. **No total counts a function twice**: the caption's
  number is the distinct functions of the own namespaces; a drawn-on segment repeats functions
  already counted in their own column (Workforce's, GNSS's) or in Core, and is never added into a
  total. The `industries` share in the tooltip ("Share of industry layers") divides by that
  distinct total and is shown for the own segment only.
- **The no-JS render** (`scripts/render-charts.ts`, `industryDistributionSvg`) draws the same stacked
  marks and the legend, so the server SVG and the live chart agree.
- **Accessibility:** the chart has no table fallback today, so none is added; its `aria-label`
  ("Public functions by industry layer, own and shared") and a visually hidden list under the
  chart give each industry's own count and each drawn-on module's count in words.
- **Design system:** no card or legend item carries a left-only accent; tokens only; the hatch is
  drawn with `background-color` plus `background-image` per the hatch trap; contrast at 7:1 for
  every label and tick and 3:1 for the shaded segment's edge against the chart surface, in both
  themes (`contrast:measure` on `/why-gmt/`).

---

## C. Generator fixes the new API needs

### C1. A union of `number` and a string literal is source text, not an enum

**The defect.** `classifyTypeAsPrinted` (`scripts/build-utils/build-utils.ts`, line 528) treats a
union of string literals and any `NumberLike` member as an enum of literals. `RolloverEra` is
`number | "rolling"`, and `number` is `NumberLike`, so the choices become `["number",
"rolling"]` (or the other order). `gnssWeekToUtc`'s first `@example` passes an integer era, which
is not a quoted choice, so `fieldForParam` returns `null` and the function loses its form; a
scenario that uses it as `fixedSpecId` gets a textarea. No function has hit this before.

**The fix, for the whole class:**

- The mixed branch counts only `TypeFlags.NumberLiteral` members. A union of string literals and
  number literals stays an enum.
- A union that holds the non-literal `number` (or `bigint`), or an object type, beside one or
  more string literals classifies as a new `ParamType` `"expr"`. `fieldForParam` gives it
  `{ kind: "expr", seed: raw }`, the example's argument as written (`0`, `2`, `"rolling"`,
  `{ notBefore: "2020-01-01T00:00:00Z" }`), so the reader can type any form.
- `classifyTypeFromString` agrees: `number | "rolling"` and
  `number | "rolling" | { notBefore: string }` give `expr`.
- `buildChoiceSeeds` loads an `expr` field from an example as it loads any other field.

**Tests** (`build-utils.test.ts`, synthetic programs): `number | "rolling"` and
`number | "rolling" | { notBefore: string }` are `expr`;
`1 | 2 | "x"` is still an enum; `string | number` is unchanged. After the library lands:
`LIVE_PLAYGROUND_TEMPLATES.gnssWeekToUtc` has fields `counter` (enum, the eight counters), `week`
and `timeOfWeekSeconds` (number) and `rolloverEra` (expr, seed `0`), and choosing `"BDT"` loads
`939`, `86404`, `0`.

### C2. The rename redirect

`scripts/build-utils/renamed-functions.ts` gains
`{ from: "plain/validate/isLeapSecond", to: "plain/validate/hasSecond60" }`. The function shipped
in `@northguild/gmt@1.19.0` (verified with `git grep` at the tag), so its old URL has inbound
links. `redirects.test.ts` expects the three `301` rules. The new
`/reference/timescale/validate/isLeapSecond` is a different page and needs nothing.

No other Dox file names `isLeapSecond` (verified: only the generated manifest and corpus, which
regenerate).

---

## D. The five tools

D1 to D7 are the GNSS Week Decoder (`/tools/gnss-week-decoder/`, kind `gnssweek`, tagged `[gnss, maritime]`). D8 holds
what the five share, D9 to D12 are the other four tools, and D13 links them.

**What it teaches.** A week number means nothing without its counter and its era. The same
reading is a different instant in every era, and a RINEX file's week is not the week a satellite
sends. The tool decodes a reading three ways in, draws every era's answer in a column, and shows
the same moment on every counter. Every system's clock is the Satellite Clock Converter's (D9).

### D1. Files and the name lists

- `src/lib/gnss-names.ts` (**leaf**, imports nothing): `GNSS_WEEK_COUNTERS`, `RINEX_WEEK_SYSTEMS`
  and `GNSS_SYSTEMS` in the type's declaration order, and `GNSS_DECODER_MODES =
  ["broadcast", "rinex", "utc"]`. `dox-tools.ts` imports it, so it must stay out of the `heavy`
  list and import nothing heavy.
- `src/lib/gnss-names.test.ts`: each list, as a set, equals the `choices` of the matching enum
  field in `LIVE_PLAYGROUND_TEMPLATES` (`gnssWeekToUtc.counter`, `rinexWeekToUtc.system`,
  `utcToGnss.system`). The checker may order union members differently, so compare sorted.
- `src/lib/gnss-week-decoder.ts`: pure (no DOM, no gmt import): state, presets, the reading plan,
  sentences, permalink, holds' text lists.
- `src/lib/gnss-lib.ts`: the shared loader of the three GNSS tools (D8).
- `src/lib/gnss-widgets.ts`: the shared pure helpers (D8).
- `src/lib/gnss-week-decoder-mount.ts`: `renderGnssWeekDecoderTemplate(args)` and
  `mountGnssWeekDecoder(root, args, signal)`, returning `onceDestroy` with `getPermalinkState`.
- `src/test/gnss-lib.ts`: the real loader for tests, as `src/test/edi-lib.ts` (D8).
- `src/components/GnssWeekDecoder.astro`, `src/styles/gmt-gnss-week-decoder.css` (after the shared
  `gmt-gnss-widgets.css`),
  `src/content/docs/tools/gnss-week-decoder.mdx`.

Root: `<div class="gmt-gnss-week-decoder gmt-widget not-content">`, the first thing in the
template, no other attribute.

### D2. Inputs (`GnssDecoderState`)

| Control | `data-role` | Element | Enabled in |
| --- | --- | --- | --- |
| Way in | `mode` | `.gmt-chip-group` of three radio `chipToggleHtml`s: "Broadcast week", "RINEX week", "UTC instant" | always |
| Counter | `counter` | `<select>` of `GNSS_WEEK_COUNTERS` | broadcast, utc |
| RINEX system | `system` | `<select>` of `RINEX_WEEK_SYSTEMS` | rinex |
| Week | `week` | number input | broadcast, rinex |
| Week slider | `week-slider` | `rangeFieldHtml`, 0 to the counter's last week (D3 probe), step 1 | broadcast |
| Time of week, seconds | `tow` | number input, a fraction allowed | broadcast, rinex |
| Time-of-week slider | `tow-slider` | `rangeFieldHtml`, 0 to 604 799, step 1 | broadcast, rinex |
| Era | `era-mode` + `era` + `era-pivot` | `<select>` "Nearest today (rolling)" / "A number" / "Not before a date"; a number input enabled for "A number"; a text input (an ISO UTC instant) enabled for "Not before a date" | broadcast |
| UTC instant | `utc` | text input, at most 64 characters | utc |
| Preset | `preset` + `preset-description` | `<select>` and a held description | always |

- **Every control is present in every mode.** One not in use is `disabled` (the shared disabled
  style; the widget styles nothing itself) and shows the value the current reading gives, so a
  change of mode continues from the same moment: in broadcast and RINEX modes the UTC field holds
  the decoded instant; in UTC mode the week, time of week and era hold what `utcToGnssWeek`
  returned for the chosen counter; in broadcast mode the RINEX system shows the counter's system.
- **A counter's system is its token before the `-`** (`"QZS-CNAV"` → `"QZS"`; `"GAL"` → `"GAL"`).
  That is the library's naming rule (L D6), applied to a name, not a table.
- `SECONDS_PER_WEEK = 7 * 86_400` is the slider's end, with a comment that it is the length of a
  week, not a library rule. The test asserts the library accepts `604799.999` and refuses `604800`.
- The PageUp and PageDown keys on both ranges step one tenth of the range, as the browser does.

### D3. Reading the library (`readGnss`)

Every value below is a call. The reading runs on each input, coalesced to one per animation frame.

1. **Probes, once per counter, cached:**
   - **Last week:** the smallest `w ≥ 1` for which `gnssWeekToUtc(counter, w, 0, 0)` is `""`,
     found by doubling then bisecting. Weeks below it are the counter's range; the slider ends at
     the week before it. The sentence for an out-of-range week names that first refused week
     ("This counter shows weeks below 1024."), so the site does no arithmetic on it.
   - **Era starts:** `gnssWeekToUtc(counter, 0, 0, e)` for each era drawn.
   - **Today's era:** `utcToGnssWeek(counter, now)` with `now` the reader's clock read once per
     reading (`Temporal.Now.instant()`), its `era` field.
   - For a RINEX system, its **first instant** is `rinexWeekToUtc(system, 0, 0)`.
2. **The instant** (`utc`):
   - broadcast: `gnssWeekToUtc(counter, week, tow, era)` with `era` the integer or `"rolling"`;
   - RINEX: `rinexWeekToUtc(system, week, tow)`;
   - UTC mode: the typed string, and `utcToGnssWeek(counter, utc)` gives the reading.
3. **The eras drawn** (broadcast and UTC modes): eras `0` through today's era `+ 1`. When the
   reading's era is beyond that, a gap mark and that era's lane follow. In each lane:
   `gnssWeekToUtc(counter, week, tow, e)`. The era `"rolling"` chose is the `era` of
   `utcToGnssWeek(counter, result)`.
4. **RINEX mode lanes:** one lane for the continuous count, then one lane for each broadcast counter
   of that system (`GNSS_WEEK_COUNTERS` whose token before `-` is the system), each reading the
   same numbers at era `0`: `gnssWeekToUtc(counter, week, tow, 0)`. A lane whose result differs
   from the RINEX result (string comparison) carries the chip "a different instant". This is the
   L D12 trap, drawn: `IRN` week `2295`, `86418` is `2024-01-01T00:00:00Z` from the file and
   `2043-08-17T00:00:00Z` on the `IRN-L1NV` counter.
5. **The same moment everywhere** (with a non-sentinel instant): `utcToGnssWeek(c, utc)` for every
   counter and `utcToRinexWeek(s, utc)` for every RINEX system.
6. **The reading's own system** (with a non-sentinel instant): `utcToGnss(system, utc)` for the
   counter's or record's system, and its **lead over UTC**,
   `diffUtcAsDuration(utc, <label's date-time>Z, "seconds")` (the shared `leadOverUtc`, D8). When
   the instant or the label holds second 60, `diffUtcAsDuration` cannot read it: the sub line reads
   "inside an inserted second" in the empty style. `isLeapSecond(utc)` decides the "leap second"
   chip on the UTC plate. Every other system's clock is the Satellite Clock Converter's job (D9);
   the decoder links to it (D13).

**Why `NO SIGNAL`** (`gnssNullText`), one sentence, decided by library calls in this order:

| Mode | Test | Sentence |
| --- | --- | --- |
| broadcast, RINEX | week not a whole number from 0 | "The week is a whole number from 0." |
| broadcast | week at or past the first refused week | "This counter shows weeks below {first refused week}." |
| broadcast, RINEX | time of week outside 0 up to 604 800 | "Time of week runs from 0 up to, not including, 604800 seconds." |
| broadcast | era not a whole number from 0 and not rolling | "The era is a whole number from 0, or rolling." |
| broadcast | "Not before a date" and `!isValidInstant(pivot)` | "The date the era counts from is not an ISO 8601 instant." |
| broadcast, RINEX | every part valid and the result is `""` | "That reading falls after the year 9999." |
| UTC | `hasSecond60(utc) && !isLeapSecond(utc)` | "No leap second was inserted at the end of that day." |
| UTC | `!hasSecond60(utc) && !isValidInstant(utc)` | "This is not an ISO 8601 instant with an offset or Z." |
| UTC | valid, and `utcToGnssWeek` is `null` | "This is before the counter's first week, which starts at {era 0 start}." |

A blank form in UTC mode makes no call and shows the empty state. A table cell whose own call
returned `""` or `null` shows `NO SIGNAL`, and one footnote under the table says which inputs gave
no reading ("before this system's first week").

### D4. Template

Three numbered sections and a links row. Sections 2 and 3 are `gmt-widget-section--wide` (the
child-selector trap) and ease through `.gmt-grow`. Section 1 is never wrapped.

1. **The reading.** The mode chips, then the field grid (D2), then the preset and its held
   description.
2. **Across rollover eras.** A `.gmt-gnss-frame` holding:
   - **Three hero plates** (`.gmt-punct-heroes` / `.gmt-punct-hero`, pinned with
     `justify-content: space-between`, `aria-hidden`, the values repeated in a visually hidden
     summary with `aria-live="polite"`):

     | Plate | `data-role` | Caption | Value | Sub line |
     | --- | --- | --- | --- | --- |
     | series 1 | `hero-utc` | "UTC" | the instant | "era n" (and "nearest today" when rolling chose it), or "continuous count" in RINEX mode; a "leap second" chip when `isLeapSecond` |
     | quiet | `hero-system` | "{system} time" | `utcToGnss(system, utc)` | "ahead of UTC by n s", or "inside an inserted second" |
     | quiet | `hero-rinex` | "RINEX week" | `utcToRinexWeek(system, utc).week` | "time of week n s", from the same call |

     A plate with no result reads "no result". Widths are reserved for the longest value any
     preset, any range position and a nine-digit fraction can give: a 30-character instant, a
     33-character label. The arithmetic is written in the sheet beside the rule.
   - **The era lanes** (`data-role="lanes"`, `role="img"` with a generated `aria-label`, and a
     visually hidden list of one sentence per lane). One lane per era (D3.3) or per RINEX row
     (D3.4). A lane is a bar from its era's start to the next era's start; every lane has the same
     width, so a reading sits at the same x in every era and the pins line up. Each lane has:
     - a label column on the left: "era n", or "RINEX" / the counter name;
     - the pin (`.gmt-cutoff-mark`) at the lane's result, placed by the polyfill;
     - a value chip in a fixed column on the right, on an opaque plate (`.gmt-cutoff-chip`), so
       the text never moves with the pin;
     - the chosen era in series 1 (lit glass and a "your reading" chip); the era `"rolling"`
       would choose carries "nearest today"; the others are neutral;
     - a "today" mark on the lane that holds the reader's now, a dashed `--gmt-ice` rule with a
       chip, never amber.
     A lane with no result keeps its box, has no pin, and its chip reads "no result".
   - **The calls**, one per line, with results (`.gmt-widget-codeframe`).
3. **The same moment on every counter.** Two real tables (`display: table`, `table-layout:
   fixed`, `overflow-x: auto`), each row always rendered:
   - `counters-table`: Counter, Week, Time of week (s), Era, for the eight counters;
   - `rinex-table`: RINEX system, Week, Time of week (s), for the five systems.
   The row of the reading's counter or system carries a hatched background and a "your reading"
   chip (pattern and word, no colour verdict). Under a named container width the tables become
   stacked rows, as the Timetable Reader's table does. The calls follow.
4. **Links row** (`.gmt-widget-controls`, D13): "Every satellite clock at this moment" to the
   Satellite Clock Converter, and "Is a receiver on this counter affected, and when?" to the GNSS
   Rollover Checker.

Every varying region (each plate's value and sub line, each lane chip, each table cell, each
footnote, the reason aside, each call frame) is held (`holdHtml`), its text list built by running
the pure text functions over a result of each shape. A call frame with no call keeps its box
(`visibility: hidden`).

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

### D8. Shared pieces of the five tools

- **`src/lib/gnss-names.ts`** (leaf, D1) also holds `ROLLOVER_NOW_MODES = ["today", "date"]`.
- **`src/lib/gnss-widgets.ts`** (pure; takes a `GnssLib`, imports no gmt):
  - `counterSystem(counter)`: the token before `-`;
  - `labelParts(label)`: the date-time and the token of a scale string, split at its one space;
  - `leadOverUtc(lib, utc, label)`: `diffUtcAsDuration(utc, <date-time>Z, "seconds")`, or the
    "inside an inserted second" state when either reading holds second 60;
  - `firstRefusedWeek(lib, counter)` (the D3 probe, cached per counter), `eraStart(lib, counter,
    era)` (`gnssWeekToUtc(counter, 0, 0, era)`), `eraAt(lib, counter, instant)`
    (`utcToGnssWeek(counter, instant).era`);
  - the text helpers the three GNSS tools share ("no result", the before-first-week sentence).
- **`src/lib/timescale-widgets.ts`** (pure; takes a `TimescaleLib`):
  - `INTEGER_UTC_FROM = "1972-01-01T00:00:00Z"`, commented with its source: UTC has differed from
    TAI by whole seconds since this instant (BIPM Annual Report on Time Activities, Table 2;
    ITU-R TF.460-6; IERS `Leap_Second.dat`). Its test asserts `taiMinusUtc` reads it and returns `null` one second
    before;
  - `CONTINUOUS_UTC_FROM = "2027-05-20"`, a date with no time of day, as CGPM 2026 Resolution 5
    states it ("continuous UTC will become effective on 20 May 2027"). No library function returns
    it; it is drawn as the end of insertions and never used in a calculation;
  - `insertions(lib)`: every inserted second, by walking `nextLeapSecond` from `INTEGER_UTC_FROM`
    until it returns `""`. The test asserts the walk ends (27 steps today; the number is never
    typed into a page);
  - `secondAfter(lib, insertion)`: `addUtc(<the insertion with second 59>, { seconds: 1 })`, the
    first instant on the new offset. Rewriting `60` as `59` is reading the label, not arithmetic;
  - `insertionsBetween(lib, start, end, count)`: the `|count|` insertions `leapSecondsBetween`
    counted. From the earlier endpoint: that endpoint itself when `isLeapSecond` says it is one
    (the count is half-open, `[start, end)`), then `nextLeapSecond` until the list holds `|count|`.
    The test asserts the list's length equals the count for every preset of D11 and D12;
  - `secondsText(ns: bigint)`: formatting only (`"86401 s"`, a fraction to nine digits).
- **Loaders:**
  - `src/lib/gnss-lib.ts` (the Decoder, the Clock Converter, the Rollover Checker):
    `GMT_MODULES["gnss/convert"]`, `["timescale/calculate"]`, `["timescale/convert"]`,
    `["timescale/validate"]`, `["plain/validate"]`, `["precision/validate"]`, `["utc/calculate"]`,
    `["utc/compare"]`;
  - `src/lib/timescale-lib.ts` (the Timeline, Elapsed vs. Clock): `["timescale/calculate"]`,
    `["timescale/convert"]`, `["timescale/validate"]`, `["span/calculate"]`, `["utc/calculate"]`,
    `["plain/validate"]`, `["precision/validate"]`.
  Each picks only the names its tools call. A rejected import becomes a `WidgetLoadError`.
  `src/test/gnss-lib.ts` and `src/test/timescale-lib.ts` load the real library for tests.
- **`src/styles/gmt-gnss-widgets.css`**: the family sheet for the five roots: the frame
  (`.gmt-gnss-frame`), lanes and rulers, the peer tables, the hatched "your reading" row. The
  five roots join the plate, mark, chip and series lists of `gmt-punctuality-widgets.css` and
  `gmt-cutoff-widgets.css`, so nothing is copied. Each tool's own sheet follows it in `customCss`.
- **Cross-links** between the tools (D13) are built with `encodeWidgetPermalink`.

### D9. Satellite Clock Converter: `/tools/satellite-clock-converter/`, kind `satclock`, GNSS and Maritime

**What it teaches.** One instant reads differently on every clock, and the gap between a
satellite clock and UTC grew with each leap second. It takes over the per-system offsets the
decoder used to carry.

**Files:** `src/lib/satellite-clock-converter.ts`, `…-mount.ts` and their tests;
`src/components/SatelliteClockConverter.astro`; `src/styles/gmt-satellite-clock-converter.css`;
`src/content/docs/tools/satellite-clock-converter.mdx`. Root
`<div class="gmt-satellite-clock-converter gmt-widget not-content">`.

**Inputs** (`ClockState`):

| Control | `data-role` | Element |
| --- | --- | --- |
| A time on any clock | `value` | text input, at most 64 characters: a UTC instant (`…Z` or an offset), or a scale string `YYYY-MM-DDTHH:MM:SS[.f] <TOKEN>` with `TAI` or a `GNSS_SYSTEMS` token |
| Step through the table | `moment-slider` | `rangeFieldHtml`, one position for `INTEGER_UTC_FROM` and one for `secondAfter` each insertion; moving it writes that UTC instant into `value` |
| Preset | `preset` + `preset-description` | `<select>` and a held description |

**Reading** (`readClocks`):

1. **Which clock the value is on:** the token after the value's one space. `TAI` →
   `fromTAI(value)`; a `GNSS_SYSTEMS` member → `gnssToUtc(token, value)`; no space → the value is
   UTC as typed. Any other token is the sentinel. The token list is the type's names, not a rule.
2. **Every clock** (with a UTC instant): `utcToGnss(s, utc)` for each `GNSS_SYSTEMS` member and
   `toTAI(utc)`; each lead with `leadOverUtc`; `taiMinusUtc(utc)` for the TAI row's own lead (the
   test asserts it equals the TAI row's `leadOverUtc` wherever both read).
3. **The reader's own clock row** is marked "your reading". When its written-back string differs
   from the typed one (a trimmed fraction, an offset rewritten as `Z`), the row says "written as"
   with the library's string.
4. **The next change:** `nextLeapSecond(utc)`, or "none after this instant: these gaps stay as they
   are".

**Why `NO SIGNAL`**, one sentence, in order: an unknown token ("The scale after the space is not
one of TAI, GPS, GAL, BDT, QZS, GLO or IRN."); `hasSecond60` without `isLeapSecond` on the UTC side
("No leap second was inserted at the end of that day."); the scale's converter returned `""` ("The
library does not read this as a time on that clock: check the form, or the date is before that
clock's first instant."); not an instant. A row whose own call returned `""` shows `NO SIGNAL` and
the footnote "before this system's first instant".

**Template.** Three sections:

1. The value, the slider, the preset.
2. A `.gmt-gnss-frame` with three pinned plates (`hero-utc` "UTC", series 1; `hero-tai`
   "TAI − UTC", `taiMinusUtc` + " s", sub `toTAI`; `hero-next` "Next change", `nextLeapSecond` or
   "none after this instant"), then **the lead bars** (`role="img"`, a hidden list): one bar per
   clock from 0 to its lead, on one scale whose end is the TAI row's lead; each value on a chip in
   a fixed right-hand column; the "your reading" row lit in series 1.
3. **`clocks-table`**: Clock, Reading, Ahead of UTC, for `UTC`, `TAI` and the six systems, every
   row always rendered. Two notes, page-copy facts from the JSDoc: "`GLO` is GLONASS time as RINEX
   and the BIPM report it, in UTC's own hours." and the `IRN` row's chip "derived" with the note
   "No international body states NavIC's offset; the library derives it from the NavIC epoch."
   Then the calls, and the links row (D13).

**Presets** († = JSDoc, L§4 and the built timescale JSDoc; confirm in the run):

| Id | Value | The library returns |
| --- | --- | --- |
| `utc-2024` (default) | `2024-01-01T00:00:00Z` | `BDT` `2024-01-01T00:00:04 BDT` †, `QZS` `…:18 QZS` †, `GLO` `…:00 GLO` †, `IRN` `…:18 IRN` †, `GPS` `…:18 GPS` †, `TAI` 37 s †; `GAL` from the run |
| `galileo-first-instant` | `1999-08-22T00:00:00 GAL` | UTC `1999-08-21T23:59:47Z` † |
| `beidou-reading` | `2024-01-01T00:00:04 BDT` | UTC `2024-01-01T00:00:00Z` † |
| `tai-reading` | `2026-01-01T00:00:37 TAI` | UTC `2026-01-01T00:00:00Z` † |
| `inside-leap-second` | `2016-12-31T23:59:60Z` | `GLO` `2016-12-31T23:59:60 GLO` †; `TAI` from `toTAI` (the `.5` example gives `2017-01-01T00:00:36.5 TAI` †); leads "inside an inserted second" |
| `before-beidou` | `2005-12-31T23:59:59Z` | `BDT` `""` † → its row `NO SIGNAL`; the other rows from the run |
| `no-leap-second-that-day` | `2017-12-31T23:59:60 GLO` | `""` † → `NO SIGNAL`, "No leap second was inserted at the end of that day." |
| `wrong-token` | `2024-01-01T00:00:37 UTC` | `NO SIGNAL`, the unknown-token sentence |

**Permalink and chat.** Key `value`. `showSatelliteClockConverterInput = z.object({ value:
z.string().min(10).max(64) })`. Doc, appended: purpose "Show one instant on every satellite clock
and on TAI, with each clock's lead over UTC on that date"; when "Call when the reader asks what a
GPS, Galileo, BeiDou, QZSS, GLONASS or NavIC clock or TAI reads at an instant, how far a
satellite clock is from UTC, or to convert a time-scale string to UTC"; args "`value` exactly as the
reader gave it: a UTC instant or a string ending in TAI, GPS, GAL, BDT, QZS, GLO or IRN". Starter,
area `gnss`: "What do the GPS, Galileo, BeiDou, QZSS, GLONASS and NavIC clocks read at
2024-01-01T00:00:00Z?", `args: { value: "2024-01-01T00:00:00Z" }`.

**Tests.** Every preset against the real library: the clock detected, the calls in order, every
row, every lead, the TAI cross-check, the "written as" note, each sentence, the slider's positions
(one more than the insertions, the first at `INTEGER_UTC_FROM`), the permalink round trip; the
mount's regions and holds; no `UTC+3`, `Moscow` or `MSK` anywhere.

### D10. GNSS Rollover Checker: `/tools/gnss-rollover-checker/`, kind `rollover`, GNSS and Maritime

**What it answers.** "Is my receiver affected, and when?" Every broadcast counter wraps; firmware
that fixes the era starts reporting dates one counter period early (or late) after the wrap. All
eight counters are peers: the 10-bit `GPS-LNAV`, `QZS-LNAV` and `IRN-LNAV` next wrap at
2038-11-20T23:59:42Z †; `GAL` (12-bit) first wraps at 2078-02-19T23:59:42Z †; the 13-bit
`GPS-CNAV`, `QZS-CNAV`, `IRN-L1NV` and `BDT` wrap far later (`IRN-L1NV` at 2156-08-21T23:59:42Z †,
the others from the run).

**Files:** `src/lib/gnss-rollover-checker.ts`, `…-mount.ts` and their tests;
`src/components/GnssRolloverChecker.astro`; `src/styles/gmt-gnss-rollover-checker.css`;
`src/content/docs/tools/gnss-rollover-checker.mdx`. Root
`<div class="gmt-gnss-rollover-checker gmt-widget not-content">`.

**Inputs** (`RolloverState`):

| Control | `data-role` | Element |
| --- | --- | --- |
| Counter | `counter` | `<select>` of `GNSS_WEEK_COUNTERS` |
| Firmware model | `firmware-model` | chip group: "Build date" (default: a pivot, as real receivers count) or "Fixed era" |
| Build date | `firmware-pivot` | text input, an ISO UTC instant; enabled for "Build date" |
| The era the firmware assumes | `firmware-era` | number input, a whole number from 0; enabled for "Fixed era" |
| Check at | `now-mode` | chip group: "Today" (the reader's clock, live) or "A date" |
| Date | `date` | text input, enabled for "A date" |
| Date slider | `date-slider` | `rangeFieldHtml` by day, from the firmware window's start to the end of the window after it (below); enabled for "A date" |
| Preset | `preset` + `preset-description` | |

The clock is read only after mount and only in "Today" mode, as the Cut-off Countdown does. A
preset or a permalink with a `date` is pinned.

**Reading** (`readRollover`):

1. **Every counter's next wrap** (the peer table, any mode): for each counter, `eraAt(counter, at)`
   and `eraStart(counter, era + 1)`; the time left, `diffUtcAsDuration(at, next, "days")`. Rows
   whose next wrap is the soonest (string-equal) carry the chip "next to wrap". The counter's width
   comes from `firstRefusedWeek` and is shown as "weeks below 1024".
2. **Your receiver:** the true reading at `at`, `utcToGnssWeek(counter, at)`; what the firmware
   reports, `gnssWeekToUtc(counter, week, tow, firmware)` with `firmware` the pivot form
   `{ notBefore: pivot }` or the fixed era; the verdict, `areUtcEqual(reported, at)` → "reports the
   right date", else `diffUtcAsDuration(at, reported, "days")` → "reports a date n days early" or
   "late".
3. **The firmware's window and the date it goes wrong:**
   - build date: the window starts at the pivot. **It goes wrong from** the pivot's own reading
     one era later: `r = utcToGnssWeek(counter, pivot)`, then
     `gnssWeekToUtc(counter, r.week, r.timeOfWeekSeconds, r.era + 1)`. From that instant on, the
     firmware decodes every reading one counter period early;
   - fixed era: the window is `eraStart(firmwareEra)` to `eraStart(firmwareEra + 1)`; it goes wrong
     from the second of those, and reports dates late before the first.
   Adding one to an era is choosing which era to ask about, as the decoder's lanes do.
4. **The rolling receiver** ("Today" mode only): `gnssWeekToUtc(counter, week, tow, "rolling")`
   with today's reading, which picks the era nearest the device's own clock. In "A date" mode the
   row reads "rolling reads the device's real clock; switch to Today to see it", in the empty
   style, because the library's `"rolling"` cannot be pinned to another date.
5. **The countdown** ("Today" mode): `diffUtcAsDuration(now, wrongFrom, "seconds")`, refreshed each
   second, shown as days, hours, minutes and seconds (formatting). In "A date" mode it is the
   pinned value.

**Why `NO SIGNAL`:** the era is not a whole number from 0; the build date is not an instant ("The
build date is not an ISO 8601 instant.") or is before the counter's first week; the date is not an
instant (second 60 included: "Pick a date outside an inserted second."); the date is before the
counter's first week (the D3 sentence); the firmware's window runs past the year 9999.

**Template.** Three sections: the inputs; a `.gmt-gnss-frame` with three pinned plates
(`hero-reports` "The receiver reports", series 1; `hero-wrong-from` "Wrong from", the date the
firmware starts reporting wrong dates; `hero-left` "Time left", the countdown, or "past by n
days") over **the window strip** (`role="img"`): the firmware's window lit in series 1 (from the
build date, or the fixed era), the window after it hatched with the chip "reports one counter
period early", the build date's mark in pivot mode, the check date's pin, a "today" mark, each wrap
a mark with its chip; then
**`counters-table`** (Counter, Width, Next wrap, Time left), the rolling row, the calls and the
links row (D13).

**Presets** (each pinned with a `date` unless it says "today"; every value from the run unless
marked †):

| Id | Counter, firmware, date | Expect |
| --- | --- | --- |
| `navic-built-2020` (default) | `IRN-LNAV`, build date `2020-01-01T00:00:00Z`, `2026-10-15T00:00:00Z` | right date; wrong from one 10-bit period after the build date |
| `navic-built-2020-after-wrap` | `IRN-LNAV`, build date `2020-01-01T00:00:00Z`, a date after "wrong from" | a date 7168 days early |
| `qzss-built-2005` | `QZS-LNAV`, build date `2005-06-01T00:00:00Z`, `2026-10-15T00:00:00Z` | a date 7168 days early: the firmware went wrong one 10-bit period after its build date, before the check date |
| `galileo-built-2024` | `GAL`, build date `2024-01-01T00:00:00Z`, `2026-10-15T00:00:00Z` | right date; wrong from one 12-bit period after the build date |
| `beidou-built-2024` | `BDT`, build date `2024-01-01T00:00:00Z`, `2026-10-15T00:00:00Z` | right date; wrong from one 13-bit period later |
| `navic-fixed-era` | `IRN-LNAV`, fixed era 1, `2026-10-15T00:00:00Z` | right date; wrong from `2038-11-20T23:59:42Z` † |
| `navic-fixed-era-after-2038` | `IRN-LNAV`, fixed era 1, `2039-01-01T00:00:00Z` | a date 7168 days early |
| `galileo-fixed-first-wrap` | `GAL`, fixed era 0, `2078-03-01T00:00:00Z` | a date 28672 days early; wrong from `2078-02-19T23:59:42Z` † |
| `gps-lnav-fixed-era` | `GPS-LNAV`, fixed era 2, `2026-10-15T00:00:00Z` | right date; wrong from `2038-11-20T23:59:42Z` † |
| `firmware-ahead` | `QZS-LNAV`, fixed era 3, `2026-10-15T00:00:00Z` | a date one period late |
| `today` | `GAL`, build date `2024-01-01T00:00:00Z`, today | live; tests pin the clock to `2026-10-15T00:00:00Z` |

**Permalink and chat.** Keys `counter`, `firmwareNotBefore` (the build date) or `firmwareEra`
(digits), `date` (left out for today). `showGnssRolloverCheckerInput = z.object({ counter:
z.enum(GNSS_WEEK_COUNTERS), firmwareNotBefore: z.string().min(10).max(64).optional(),
firmwareEra: z.string().regex(/^(?:0|[1-9]\d{0,5})$/).optional(), date:
z.string().min(10).max(64).optional() })` with a refinement: exactly one of `firmwareNotBefore` and
`firmwareEra`. Neither is defaulted. Doc, appended: purpose "Check when a receiver whose firmware
counts weeks from a build date, or fixes the rollover era, starts reporting wrong dates, for any
satellite week counter, with the next wrap of every counter"; when "Call when the reader asks about a GNSS week rollover, whether a receiver
is affected, when the next rollover is, or why a receiver reports a date about 19.6 years early";
args "`counter` as named (for example `IRN-LNAV`); `firmwareNotBefore` when the reader gives a
build or release date, `firmwareEra` as digits when they give an era; `date` only when the reader
names one". Starter, area `gnss`: "A NavIC receiver's firmware was built on 2020-01-01: when
does it start reporting wrong dates?", `args: { counter: "IRN-LNAV", firmwareNotBefore:
"2020-01-01T00:00:00Z" }`.

**Tests.** Every preset under a pinned clock: the peer table for all eight counters (the 10-bit
three share their next wrap; the earliest group is marked), both firmware models, the verdict and
day count, the window and "wrong from" (in pivot mode it equals the pivot's reading one era later,
and the instant before it still reports the right date),
the rolling row in each mode, the countdown's text, every sentence, the permalink round trip; the
mount's regions, holds and live tick (fake timers); no on-screen GPS-only wording such as "GPS
rollover" in a heading or the starter.

### D11. Leap Second Timeline: `/tools/leap-second-timeline/`, kind `leapline`, Core

**What it teaches.** UTC took 27 inserted seconds between 1972 and 2016, none since, and none after
continuous UTC begins on 2027-05-20. A `23:59:60` is real only on a listed day.

**Tag: Core, by the B1 rule** (decision 12). It uses `timescale`, `utc`, `plain` and `precision`.
None is an industry's own namespace, so `core` is allowed; GNSS and Maritime draw on `timescale`
and would be allowed too. Core is chosen because leap seconds matter to every industry that logs
time, and `timescale` stays a Core namespace (decision 16). The tools index and the three section sidebars
already group Core tools (five Core tools ship today; `build-tool-index.ts` and
`industry-sidebar.ts` walk `INDUSTRY_TAG_IDS`, which starts with `core`), so nothing changes there.

**Files:** `src/lib/leap-second-timeline.ts`, `…-mount.ts` and their tests;
`src/components/LeapSecondTimeline.astro`; `src/styles/gmt-leap-second-timeline.css`;
`src/content/docs/tools/leap-second-timeline.mdx`. Root
`<div class="gmt-leap-second-timeline gmt-widget not-content">`.

**Inputs:** `date` (text) with `date-slider` (by day, from `INTEGER_UTC_FROM` to the later of the
reader's today and `CONTINUOUS_UTC_FROM`, plus one year of axis; moving it writes
`YYYY-MM-DDT00:00:00Z`); `check` (text, a second-60 reading to test); `from` and `to` (text);
`preset`.

**Reading** (`readTimeline`): `insertions` and each one's `secondAfter` and
`taiMinusUtc(secondAfter)` (the step chart's values); `taiMinusUtc(date)`; `nextLeapSecond(date)`;
for `check`: `hasSecond60`, `isLeapSecond`, `isValidInstant`; `leapSecondsBetween(from, to)` and
`insertionsBetween`.

**Verdict words for `check`:** "inserted: a real leap second" (`isLeapSecond`); "well-formed, but
nothing was inserted at the end of that day" (`hasSecond60` only); "a valid instant, but not a
second 60" (`isValidInstant`); otherwise `NO SIGNAL`, "This is not an ISO 8601 instant."

**Template.** Three sections: the inputs; a `.gmt-gnss-frame` with three pinned plates
(`hero-offset` "TAI − UTC on the date", sub "next insertion" or "none after this date";
`hero-between` "Leap seconds between", sub the two dates; `hero-check` "Your second 60", the
verdict word) over **the timeline** (`role="img"`, a hidden list): a year axis, the TAI − UTC step
line, a mark per insertion with fitted chips (`label-fit.ts`), the date's pin, the `from`–`to` band
hatched with its counted marks lit, the checked second lit when it is an insertion, and a
"continuous UTC from 2027-05-20" mark with a dashed edge and its chip; then **`insertions-table`**
(Inserted second, TAI − UTC after), every row always rendered, the counted rows marked; the calls;
the links row.

**Presets** († = built timescale JSDoc):

| Id | Inputs | The library returns |
| --- | --- | --- |
| `from-2000` (default) | date `2000-01-01T00:00:00Z`; from `2000-01-01T00:00:00Z` to `2024-01-01T00:00:00Z`; check `2016-12-31T23:59:60Z` | TAI − UTC from the run; between 5 †; check true † |
| `last-insertion` | date `2016-01-01T00:00:00Z` | 36 †; next `2016-12-31T23:59:60Z` † |
| `after-the-table` | date `2024-01-01T00:00:00Z` | 37 †; next `""` † → "none after this date" |
| `far-future` | date `2100-01-01T00:00:00Z` | 37 † |
| `not-inserted` | check `2017-12-31T23:59:60Z` | `false` †, `hasSecond60` true |
| `offset-spelling` | check `2009-01-01T08:59:60+09:00` | `true` † |
| `backwards` | from `2024-01-01T00:00:00Z` to `2000-01-01T00:00:00Z` | −5 † |
| `before-1972` | date `1971-01-01T00:00:00Z`; from `1971-01-01T00:00:00Z` to `2024-01-01T00:00:00Z` | `null` † twice → `NO SIGNAL`, "UTC has differed from TAI by whole seconds only since 1972-01-01." |

**Permalink and chat.** Keys `date`, `check`, `from`, `to`, each optional, at least one present.
`showLeapSecondTimelineInput` is a flat object of four optional strings (10–64 characters) with a
refinement. Doc, appended: purpose "Show every leap second UTC has had on a timeline, TAI − UTC at a
date, the leap seconds between two dates, and whether a 23:59:60 was really inserted"; when "Call
when the reader asks how many leap seconds there are or were between dates, what TAI − UTC was on
a date, whether a 23:59:60 timestamp is real, or when leap seconds end"; args "dates exactly as the
reader gave them". Starter, area `leapseconds`: "How many leap seconds were inserted from 2000 to
2024, and what was TAI − UTC in 2000?", `args: { date: "2000-01-01T00:00:00Z", from:
"2000-01-01T00:00:00Z", to: "2024-01-01T00:00:00Z" }`.

**Tests.** Every preset: the walk, the step values, each plate, the verdicts, the band, the table,
the sentences, the permalink round trip; the mount's regions and holds; the slider's ends follow
the reader's today (fake timers at two dates).

### D12. Elapsed vs. Clock Difference: `/tools/elapsed-vs-clock-difference/`, kind `elapsed`, Core

**What it teaches.** Subtracting two UTC readings gives the clock difference. The seconds that
really passed include every inserted second between them.

**Tag: Core**, by the same reasoning as D11: `timescale`, `span`, `plain` and `precision` only.

**Which functions, from the corpus:** `spanNs` (`span/calculate`) is the clock difference: exact
nanoseconds between two instants, counting no leap second, and refusing second 60 (its JSDoc says
both). The true elapsed time is `spanNs` between the two `toTAI` readings, each read as an
instant by putting `Z` after its date-time: TAI has no leap seconds, so the difference of its
readings is SI seconds. `leapSecondsBetween` gives the count, and `insertionsBetween` (D8) names
them. `spanMs` is not used (it rounds to milliseconds); `diffUtcAsDuration` is not used (it reads
the same POSIX difference as `spanNs`, in units).

**Files:** `src/lib/elapsed-vs-clock.ts`, `…-mount.ts` and their tests;
`src/components/ElapsedVsClock.astro`; `src/styles/gmt-elapsed-vs-clock.css`;
`src/content/docs/tools/elapsed-vs-clock-difference.mdx`. Root
`<div class="gmt-elapsed-vs-clock gmt-widget not-content">`.

**Inputs:** `start` and `end` (text, a listed `23:59:60` allowed); `end-slider` (by day, from
`INTEGER_UTC_FROM` to the later of today and `CONTINUOUS_UTC_FROM`, plus one year); `preset`.

**Reading** (`readElapsed`): `clock = spanNs(start, end)`; `taiStart = toTAI(start)`,
`taiEnd = toTAI(end)`; `elapsed = spanNs(<taiStart>Z, <taiEnd>Z)`; `count =
leapSecondsBetween(start, end)`; `insertionsBetween(start, end, count)`.

**An endpoint that is itself `23:59:60`:** `spanNs` refuses it, so the clock difference is
`NO SIGNAL` with "A clock difference cannot place 23:59:60: the span functions, like every function
outside the leap-second ones, refuse second 60." The elapsed time and the count still read it
through TAI, and the inserted second is listed when it is the start (half-open). When the `23:59:60`
is not a listed insertion, `toTAI` and `leapSecondsBetween` return the sentinel too, with "No leap
second was inserted at the end of that day."

**Template.** Three sections: the inputs; a `.gmt-gnss-frame` with three pinned plates
(`hero-clock` "Clock difference", `secondsText(clock)`; `hero-elapsed` "Seconds that passed",
`secondsText(elapsed)`, series 1; `hero-count` "Leap seconds between", the signed count) over **two
rulers** (`role="img"`, a hidden list): "UTC clock" and "Elapsed", from start to end on one scale,
each counted insertion a mark on both with its chip, and on the elapsed ruler a hatched one-second
sliver (drawn at a minimum width so it shows at any span) with the chip "+1 s"; then
**`insertions-list`** (the counted seconds, always reserving the tallest list a preset gives), the
calls and the links row. The test, not the widget, checks `elapsed − clock = count × 10⁹` wherever
all three read.

**Presets** (each output from the run unless marked †):

| Id | Start, end | Expect |
| --- | --- | --- |
| `across-2016` (default) | `2016-12-31T23:59:59Z`, `2017-01-01T00:00:01Z` | clock 2 s, elapsed 3 s, one insertion `2016-12-31T23:59:60Z` |
| `start-is-the-leap-second` | `2016-12-31T23:59:60Z`, `2017-01-01T00:00:00Z` | count 1 †; clock `NO SIGNAL`; elapsed 1 s |
| `twenty-four-years` | `2000-01-01T00:00:00Z`, `2024-01-01T00:00:00Z` | count 5 †; the five seconds from 2005-12-31 to 2016-12-31 |
| `no-insertions` | `2020-01-01T00:00:00Z`, `2024-01-01T00:00:00Z` | count 0 †; clock equals elapsed |
| `backwards` | `2024-01-01T00:00:00Z`, `2000-01-01T00:00:00Z` | count −5 †; both spans negative |
| `not-inserted` | `2017-12-31T23:59:60Z`, `2018-01-01T00:00:00Z` | `NO SIGNAL` on all three, "No leap second was inserted at the end of that day." |
| `before-1972` | `1971-01-01T00:00:00Z`, `2024-01-01T00:00:00Z` | clock reads; elapsed and count `null` † → "UTC has differed from TAI by whole seconds only since 1972-01-01." |

**Permalink and chat.** Keys `start`, `end`. `showElapsedVsClockInput = z.object({ start:
z.string().min(10).max(64), end: z.string().min(10).max(64) })`. Doc, appended: purpose "Compare
the clock difference between two UTC instants with the seconds that really passed, and list the
leap seconds between them"; when "Call when the reader asks how many seconds really passed between
two UTC times, why a duration across a leap second is a second short, or how to measure elapsed
time across 23:59:60"; args "both instants exactly as the reader gave them". Starter, area
`leapseconds`: "How many seconds really passed from 2016-12-31T23:59:59Z to
2017-01-01T00:00:01Z?", `args: { start: "2016-12-31T23:59:59Z", end: "2017-01-01T00:00:01Z" }`.

**Tests.** Every preset: the three numbers, the identity above, the list (its length equals the
count), each sentence, the permalink round trip; the mount's regions and holds.

### D13. Cross-links between the five tools

Each is a link in the tool's links row (`.gmt-widget-controls`), seeded with
`encodeWidgetPermalink`. With no result it is `aria-disabled` with no `href`. The round trip of
each is tested through `seedFromLocation`.

| From | Link text | To, seeded with |
| --- | --- | --- |
| Week Decoder | "Every satellite clock at this moment" | Clock Converter, `value` = the UTC result |
| Week Decoder | "Is a receiver on this counter affected, and when?" | Rollover Checker, `counter`, the decoder's era form (`firmwareNotBefore` for a pivot, `firmwareEra` for an integer; for `"rolling"`, the era it chose), `date` = the UTC result |
| Clock Converter | "This moment as a week on every counter" | Week Decoder, `mode: "utc"`, `utc` |
| Clock Converter | "Why these gaps grew" | Leap Second Timeline, `date` = the UTC instant |
| Rollover Checker | "See every era of this reading" | Week Decoder, `mode: "broadcast"`, `counter`, the reading's week and time of week, and `rolloverNotBefore` or `rolloverEra` from the firmware |
| Leap Second Timeline | "Count the real seconds between these dates" | Elapsed vs. Clock, `start` = `from`, `end` = `to` |
| Leap Second Timeline | "Every clock on this date" | Clock Converter, `value` = `date` |
| Elapsed vs. Clock | "See these dates on the timeline" | Leap Second Timeline, `from`, `to` |
| Elapsed vs. Clock | "Every clock at the start" | Clock Converter, `value` = `start` |

---

## E. Registration checklist

Each item names the test that guards it, or says that nothing does. "The five" are, in this order:
`showGnssWeekDecoder`, `showSatelliteClockConverter`, `showGnssRolloverChecker`,
`showLeapSecondTimeline`, `showElapsedVsClock`.

| # | File (under `apps/dox/`) | What is registered | Guard |
| --- | --- | --- | --- |
| E1 | `src/lib/dox-tools.ts` | the five input schemas after `showJourneySplitInput` (460); the names in `DoxToolName` (476), `DOX_TOOL_INPUTS` (502), `DOX_TOOL_DOCS` (530, **appended in the order above**), `DOX_TOOLS` (711), `ENABLED_TOOL_NAMES` (830) | `widget-registry.test.ts`, `chat-starters.test.ts` (with the purpose-by-name guard), typecheck |
| E2 | `worker/tools.ts` | the five imports (66) and tools with a trivial `execute` after `showJourneySplit` (409) | `tools.test.ts` |
| E3 | `src/components/ask/widget-registry.ts` | `import type` only; the schema imports (91); five entries, each with a literal `import("~/lib/<tool>-mount")`; `WIDGET_REGISTRY` (781) | `widget-registry.test.ts`, `widget-graph.test.ts` |
| E4 | `src/lib/widget-permalink.ts` | `"gnssweek"`, `"satclock"`, `"rollover"`, `"leapline"`, `"elapsed"` in `WidgetKind` (59) and their paths in `WIDGET_PAGE_PATHS` (99) | `widget-permalink.test.ts` |
| E5 | `src/lib/chat-constants.ts` | `EXAMPLE_AREAS` (360): `{ id: "leapseconds", label: "Leap seconds and TAI" }` after `intervals`, and `{ id: "gnss", label: "GNSS and maritime" }` after `intermodal`; the five starters | `chat-starters.test.ts` |
| E6 | `src/lib/widget-load-error.test.tsx` | the five mounts in `MOUNTS` | **manual** |
| E7 | `src/components/ask/widget-graph.test.ts` | in `heavy` (134): the five pure modules, `gnss-widgets.ts`, `timescale-widgets.ts`, `gnss-lib.ts`, `timescale-lib.ts`; **not** `gnss-names.ts` | **manual** |
| E8 | `astro.config.mjs` | `gmt-gnss-widgets.css`, then the five tool sheets, in `customCss` after `gmt-edi-widgets.css`; the Industries sidebar group (B6) | **manual** |
| E9 | `src/lib/mdx-jsx.ts` | `"GnssWeekDecoder"`, `"SatelliteClockConverter"`, `"GnssRolloverChecker"`, `"LeapSecondTimeline"`, `"ElapsedVsClock"` in the dropped-components list (near 369) | `scripts/llms.test.ts`, only after a build |
| E10 | `scripts/html-diff.mjs` | the five tool pages with their root class strings | **manual** |
| E11 | `scripts/visual-snapshot.mjs` | the five tool pages, `industries-maritime`, `industries-transport`, `industries`, `reference`, and the two retuned widgets of N1 (`tool-converter-bench`, `tool-dst-inspector`, already listed or added) | **manual** |
| E12 | `scripts/grow-measure.mjs` | the five: `root: ".gmt-widget"`, `preset: '[data-role="preset"]'`, `drag` = `tow-slider`, `moment-slider`, `date-slider`, `date-slider`, `end-slider` | **manual** |
| E13 | `scripts/readout-still.mjs` | `TOOLS` (147): the decoder (`week-slider`, `tow-slider`), the converter (`moment-slider`), the rollover checker (`date-slider`, presets in "A date" mode), the timeline (`date-slider`), elapsed (`end-slider`); frame `.gmt-gnss-frame` for each; drawn: the lanes, bars, strip, timeline or rulers and a hold's live wrapper | **manual** |
| E14 | `scripts/contrast-measure.mjs` | the five tool pages and `/industries/maritime/` in `PAGES` (76) | **manual** |
| E15 | `src/styles/gmt-a11y.css` | forced colours for the family: lanes, bars, strips, rulers, pins, marks, today marks, slivers and hatched rows keep a system colour; plates and chips take `border-color: CanvasText` | **manual**; the browser pass checks it |
| E16 | `src/lib/industry-tags.ts` / `industries.json` | the Workforce entry and icon (D1), the GNSS and Maritime entries and icons (step D3) | `industry-tags.test.ts`, `industry-overview.test.ts` |
| E17 | `gmt-cutoff-widgets.css`, `gmt-punctuality-widgets.css` | the five roots join the plate, mark, chip and series `:is()` lists, and `.gmt-gnss-frame` joins the chart-surface list | **manual** |

---

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

### F2. The tool pages and links

- **Five tool pages**, in the shape of `tools/epcis-event-reader.mdx`: frontmatter with title,
  description and the tag of section D; `ToolLayout` with a use case; a key point; an intro; the
  widget `fullbleed`; an `after` slot with **The rule**, what is drawing and what is the
  library's, **When there is no result**, a code block of `call // result` lines pasted from the
  run, **Worth trying** with three or four permalinks, and **Reference** linking every function
  the tool calls and its guide. Use cases: "Satellite week numbers and rollovers"; "One instant
  on every satellite clock"; "Week-rollover exposure of a receiver"; "Leap seconds since 1972";
  "Elapsed seconds across leap seconds". Each page links the other tools D13 links it to.
  `GLO` is described in section 0's words and no others.
- **Links into the tools** (step D4), one each, in the page's related-links list or beside the
  passage it illustrates, each a seeded permalink with the page's own numbers:
  `gnss-week-that-wrapped.mdx` and `thirteen-bit-week-read-as-ten-bit.mdx` (decoder and rollover
  checker), `rinex-week-read-as-broadcast.mdx` (decoder), `gnss-offset-hardcoded.mdx` (clock
  converter), `a-leap-second-that-never-happened.mdx` (timeline), the three guides (their tools),
  `mistakes/gnss.mdx` and `mistakes/leap-seconds.mdx` (beside the matching pairs).
- `guides/core-date-operations/nanosecond-precision.mdx` line 102: "Leap-second-aware time scales
  (TAI, GPS) are not part of this namespace." becomes "Leap-second-aware time scales (TAI and the
  satellite clocks) are not part of this namespace." and gains links to the two guides (each by its
  real title).
- `guides/core-date-operations/spans.mdx` "Leap seconds are not counted" bullet (line 80) gains
  "To count them, compare TAI readings: see [Elapsed vs. Clock
  Difference](/tools/elapsed-vs-clock-difference/)."
- `tools/index.mdx` and the hubs are generated.

---

## G. Design constraints

1. **No left-border-only accent, anywhere.** No `border-left`, `border-inline-start`, left inset
   shadow or left `::before` bar as the only accent of a plate, lane, bar, row, table or note. A
   chosen lane or row is lit glass, a hatch and a chip; a plate's series colour is the 3px bottom
   bar.
2. **Every region is present in every state, and holds still.** Values `tabular-nums` and `nowrap`;
   each plate reserves the widest value in `em` and sub line in `ch`, measured across every preset,
   every range position, a nine-digit fraction and the live countdown; each varying region holds
   its tallest text. **Dragging any range never moves or resizes a plate, the frame, a lane, a bar
   chip, a table or anything above the range, and typing never resizes a plate.** A change of
   mode, counter or system may change the lane count; that region eases through `.gmt-grow`.
3. **Amber is the sentinel's alone.** "Your reading", "nearest today", "today", "a different
   instant", "leap second", "next to wrap", "derived", "inserted" and "early" are words and
   patterns.
4. **Text at least 12px**, and **at least 7:1** in both themes against the worst pixel behind it.
5. **Tokens only.** No colour literal and no `[data-theme="light"]` colour block.
6. **Compose `gmt-form-controls.css` through `widget-ui.ts`:** `.gmt-field-grid`,
   `labelTextHtml`, `.gmt-input`, `.gmt-select`, `chipToggleHtml`, `rangeFieldHtml`, `syncRange`,
   `setControlValue`. No control CSS. Real `<select>`, `<input>` and `<input type="range">`.
7. **`not-content` and `container-type: inline-size` on every root.** Narrow rules are named
   `@container` queries (the field-grid trap). No horizontal page scroll at 390px, and none in
   the rail at 360px or 300px. Tables become stacked rows in the narrow rail.
8. **No motion on a value.** No `transition` or `animation` on a plate, a lane, a bar, a pin, a
   cell. The live countdown changes its text once a second and nothing else.
9. **No class containing `card`** except `.gmt-widget-card`; no `backdrop-filter`, no
   `clip-path` inside a tool.
10. **Nothing in a drawing is focusable.** Each drawing is `role="img"` with an `aria-label` and a
    hidden list. The keyboard reaches the chips, selects, inputs, ranges and links, in DOM order.
11. **`escapeAttr` / `escapeHtml` on every interpolation.**
12. **An element with an author `display` has its own `[hidden]` rule.**
13. **Tables** take `overflow-x: auto`, never `overflow: hidden`; first and last cells have at
    least 10px inline padding (the bevel trap); `display: table` with `table-layout: fixed`.
14. **On-screen text calls the library "the library".**

---

## H. Close-out (`dox-architect`, after the tester's run)

- **`context/dox/built.md`**, present tense:
  - § Tiers 0–1, "The two industry namespaces stand apart…": rewritten as declared industries
    (B1–B9): the JSON (own namespace and `drawsOn`), cross-industry layers as industries
    (`workforce`, `gnss`), drawn-on modules (whole namespaces or sub-modules, shared industry layers
    or Core), the hubs, the Industries sidebar group, the root page, the tag rule with several tags,
    the README line, the stacked chart and its no-double-count rule. The "Page tag" bullet reads own
    namespaces.
  - § Tiers 0–1 Generator: the `expr` classification (C1); `RENAMED_FUNCTIONS` holds
    `isLeapSecond`.
  - § Tier 2: the five tools in the teaching-widget list with their rules and the GNSS family's
    shared modules and sheet; the tool-page list; their permalink keys; `readout:still`'s and
    `grow:measure`'s tool lists; the industry-tag bullet's "one entry in `industry-tags.ts`"
    sentence and its trap reworded to "own namespace"; the hours-of-work pages under Transport;
    the Converter Bench's and the DST Inspector's new defaults (N1).
  - § Tier 6: the five chat tools in the widget tools list; the tool and starter counts and the
    per-area counts re-derived from `ENABLED_TOOL_NAMES` and `CHAT_STARTERS`; the "GNSS and maritime" and
    "Leap seconds and TAI" areas; the per-visitor cap's UTC day (N1).
- `context/dox/reference/design-system.md`: § Drawn charts gains the stacked industry chart's rule
  (own segment solid, shared segments tinted and hatched, totals never double-count, legend words
  carry the meaning); and the family's five drawings join the
  list (the decoder's era lanes, the converter's lead bars, the rollover checker's window strip,
  the timeline's step chart with its continuous-UTC mark, the elapsed tool's twin rulers with
  their one-second slivers), and the sentence that names the readout gate's tools names them.
- `context/dox/tracker.md`: no row (MAR-16's realm row tracks it).
- `context/dox/built.md` and `context/domination/` CORE-76 lines: step DU writes them (M3); the
  close-out only checks them.

**Contradictions found in re-verification, to correct in the docs named:**

1. L§5.9 says the Dox playground needs nothing new. It does: C1.
2. L§5.5 and L§9.1 question 1 are answered by the owner's decision (a). L§8.4's pages are written
   by `dox-builder` (F1), with system-neutral scenario slugs, not by the library pipeline.
3. L§5.1–5.4 do not list the rename redirect; C2 adds it.
4. `built.md` § Tier 2 says "A new industry is one entry in `industry-tags.ts` and one icon": after
   B it is one entry in `industries.json`, one icon and one overview text.
5. `industry-tags.test.ts` today detects use only through a namespace-barrel import
   (`@northguild/gmt/<ns>"`), not a module-barrel import; B8 fixes it.
6. **For the library pipeline, not this work:** `spanNs`'s JSDoc (`span/calculate/spanNs.ts` line
   36) says "Leap-second-exact spans need a TAI scale, which GMT does not yet ship". After MAR-16
   it does; the sentence should name `toTAI`. Report it to the main session.

---

## I. Definition of done (`dox-tester`: run each line literally)

**I0. The two private trees.** Nothing in I6 to I19 uses port 4321, `apps/dox/dist` or this
worktree's `packages/gmt/dist` in place. `$SP` is the session scratchpad and `$W` is this worktree.

```bash
BASE=$(git -C "$W" merge-base HEAD origin/main)
mkdir -p "$SP/base" && git -C "$W" archive "$BASE" | tar -x -C "$SP/base"
mkdir -p "$SP/after" && rsync -a --exclude node_modules --exclude dist --exclude .git \
  --exclude .astro --exclude .visual --exclude .wrangler "$W"/ "$SP/after"/
# The branch's library is the dist the main session built; copy it, never rebuild it.
rsync -a "$W/packages/gmt/dist/" "$SP/after/packages/gmt/dist/"
# The baseline's library exists in no worktree, so it is built inside $SP/base only.
cd "$SP/base" && eval "$(fnm env)" && fnm use && pnpm install --frozen-lockfile \
  && pnpm --filter @northguild/gmt build \
  && DOX_VITE_CACHE_DIR="$SP/vite-base" pnpm --filter @gmt/dox build
cd "$SP/after" && eval "$(fnm env)" && fnm use && pnpm install --frozen-lockfile \
  && DOX_VITE_CACHE_DIR="$SP/vite-after" pnpm --filter @gmt/dox build
python3 -m http.server 48391 --bind 127.0.0.1 --directory "$SP/after/apps/dox/dist"
```

Re-run the `rsync` lines and the `after` site build after any builder change.

1. In `$W`: `pnpm --filter @gmt/dox test` is green, with no skipped, todo or expected-failure test
   in the files this work adds or changes.
2. In `$W`: `DOX_VITE_CACHE_DIR=<private> pnpm --filter @gmt/dox check` reports 0 errors and
   `pnpm --filter @gmt/dox lint` reports nothing.
3. In `$W`: `pnpm dox:generate`, `pnpm dox:docs-check` (0 gaps), `node scripts/stats.mjs check`,
   `node scripts/api-surface.mjs check` and `node scripts/deps.mjs check` pass. `README.md` and
   `packages/gmt/README.md` are byte-identical.
4. **The parity and rule tests pass by name:** `widget-registry`, `chat-starters`, `chat-handler`,
   `tools`, `widget-permalink`, `widget-load-error`, `widget-graph`, `client-graph`,
   `industry-tags`, `industry-overview`, `industry-pages`, `industry-sidebar`, `index-pages`,
   `build-reference`, `build-utils`, `redirects`, `gmt-stats`, `gnss-names`, `gnss-widgets`,
   `timescale-widgets`, `font-floor`, `content-list-rule`, `pt-day`, and, in `$SP/after` after its
   build, `scripts/llms.test.ts`.
5. **Generator spot-check** in `$W` after `generate`:
   - every function of L§1.1 except the removed GPS forms has a page, and none of `gpsToUtc`,
     `utcToGps`, `gpsWeekToUtc`, `utcToGpsWeek`, `GpsNavMessage` is in the corpus or the route
     manifest; `/reference/gnss/` and `/reference/timescale/` and their module indexes exist,
     carry no `industries` line, and are listed under "For any industry" on `/reference/` and in
     the reference sidebar's general groups, with the Unreleased badge;
   - `/reference/types/GnssSystem`, `GnssWeekCounter`, `RolloverEra`, `GnssWeek` and
     `RinexWeekSystem` are pages with no tag; `RinexWeek` is inline on `utcToRinexWeek` and its
     corpus `url` carries the anchor;
   - `/reference/plain/validate/hasSecond60` exists, `/reference/plain/validate/isLeapSecond` is
     not in the route manifest, and `public/_redirects` holds its three `301` rules;
   - `LIVE_PLAYGROUND_TEMPLATES.gnssWeekToUtc` has form fields with `rolloverEra` as `expr` (C1);
   - `/reference/transport/` and `/reference/intermodal/` still exist, carry their tag and the
     one-line pointer to the hub, and no longer hold the pain-point block;
     `/reference/workforce/` and `/reference/gnss/` sit under the reference sidebar's "By industry"
     divider with their icons, and every page in them carries its industry's tag;
     `/reference/timescale/` stays general and untagged;
   - `src/content/docs/industries/` holds `index.mdx`, `workforce.mdx`, `transport.mdx`,
     `intermodal.mdx`, `gnss.mdx` and `maritime.mdx`, and is ignored by git (I17 checks them).
6. **Boundaries.** `git -C "$W" status --short` shows no path this work changed under
   `packages/gmt` except `packages/gmt/README.md`; under `context/domination` only the CORE-76
   lines of `issues/CORE-76.md` and `tracker.md` (diff those two files against the owner's state
   and confirm nothing else from this work); nothing under `.changeset`; nothing staged.
   `grep -rniE "utc ?\+ ?3|moscow|\bMSK\b"` over the files this work adds or changes finds
   nothing. `grep -rnE "gpsToUtc|utcToGps|gpsWeekToUtc|utcToGpsWeek|GpsNavMessage"` over
   `apps/dox/src` (outside `generated/`) and this spec's pages finds nothing. No industry id, area
   id, widget kind or namespace is named `space`. The changed and new files under `apps/dox/src`
   hold no `--gmt-signal` outside the sentinel rules, no `border-left` or `border-inline-start`
   accent, no colour literal, no `backdrop-filter`, no `clip-path`.
7. **`html-diff`:** `capture` in `$SP/base/apps/dox`, `compare` in `$SP/after/apps/dox`. The five
   tool pages report `+`. Tools whose presets section N changed report `✗`, and each difference is
   a changed zone or its re-run output. Every other tool page reports no widget change.
8. **`visual:diff`:** `visual:before` in `$SP/base/apps/dox`; copy `.visual/before` into
   `$SP/after/apps/dox/.visual/`; `visual:after` and `visual:diff` there. Expected differences, each
   read and matched to this spec: the new pages; the "Industries" sidebar group on every page; the
   reference sidebar's general group `timescale`, its "By industry" groups in declared order with
   `workforce` and `gnss`, and no `duty` group; `/reference/` root; `/reference/transport/` and
   `/reference/intermodal/`; the tools, scenarios and mistakes sidebars and the tools index in
   declared order, with the Workforce pages under Workforce (and Transport where tagged) and the
   GNSS tools under GNSS and Maritime; `/why-gmt/`'s sentence, its stacked chart and its number
   format in the reader's locale; the Workforce guide at its new path; the pages and tools section N rebalanced. Anything else is a regression.
9. **`grow:measure --base http://127.0.0.1:48391`** passes for the five tool pages and every tool
   whose presets changed, in Chromium and WebKit at 1440 and 390. **`readout:still --base
   http://127.0.0.1:48391`** passes for every tool in its list at its default widths, in Chromium
   and WebKit.
10. **Browser pass** on the five tool pages, `/industries/`, `/industries/maritime/`,
    `/industries/transport/` and `/reference/`, in both themes, at 1440 and 390, and each tool in
    the `/dox` rail with its root at 360 and 300, opened from its `CHAT_STARTERS` card:
    - **keyboard only**, mouse untouched: Tab reaches the chips, every select, input, range and
      link in order; arrows, PageUp, PageDown, Home and End move every range; a disabled control is
      skipped; nothing inside a drawing or a table takes focus; the Industries sidebar group opens
      with Enter and its links are reachable; focus is always visible;
    - `pnpm run contrast:measure -- --base http://127.0.0.1:48391` passes (7:1 muted text, 3:1
      disabled border) on the five tool pages, `/industries/maritime/` and the `/dox` page;
    - no overlap of two labels, chips or plates; no horizontal page scroll;
    - no element with a left edge as its only accent (computed style and screenshots);
    - forced colours: every lane, bar, strip, ruler, pin, mark, sliver and hatched row keeps an
      edge;
    - **stillness:** for every preset of each tool with a range, drag each range end to end by
      keyboard and by pointer and record the bounding boxes of the three plates, the frame, every
      lane, bar chip and table, and the rows above the range: none moves or resizes. For the
      rollover checker in "Today" mode, record the plates for ten seconds of countdown: none
      resizes. Switching the firmware model between "Build date" and "Fixed era" moves no plate. Across presets of one tool and mode at one width, each plate keeps its size and
      each held region its height;
    - every cross-link of D13 opens its target with every key kept;
    - the hub icons in the sidebar are decoration only (`aria-hidden`).
11. **Values.** A script in `$SP` runs every preset of the five tools against `$SP/after`'s
    library and prints each call and result. For every preset, what the built page shows equals
    the script's output, and every `call // result` on the five tool pages and the F1 pages equals
    it too.
12. **Chat grounding and citation integrity:**
    - the D7 `search.test.ts` rows pass on the real corpus, plus: "How many seconds passed across
      the 2016 leap second?" retrieves `leapSecondsBetween` or the leap-seconds guide; "When does
      the next GNSS week rollover happen?" retrieves `gnssWeekToUtc` or the Maritime guide;
    - `chat-handler` with a fake model: a turn whose retrieved chunks include `gnssWeekToUtc`
      renders its `/reference/gnss/convert/gnssWeekToUtc` link as a link, and a hallucinated
      `/reference/space/…`, `/reference/plain/validate/isLeapSecond` or
      `/reference/gnss/convert/gpsToUtc` link renders as plain text (`link-components` test
      rows);
    - each of the five starter cards mounts its tool at once on click, and its seed passes the
      schema and the registry's `validate` (`chat-starters`);
    - an argument set a schema refuses (decoder broadcast with no `rolloverEra`, a counter
      `"GLO"`, rollover with neither or both of `firmwareNotBefore` and `firmwareEra`) renders the
      registry's error state, not a crash;
    - every internal link on the new and changed pages resolves to a page in `$SP/after`'s build
      or a route in the manifest, and every permalink opens its tool with every key kept.
13. **International defaults (section N):**
    - no widget's default state, preset or chat starter in `apps/dox/src/lib` holds
      `America/New_York` or `en-US`, except a preset whose standard's own code names a US zone
      (an X12 time code); `grep -rnE "America/New_York|en-US" apps/dox/src/lib --include=*.ts
      --exclude=*.test.*` lists only those lines and test-free comments that say why;
    - in `apps/dox/src/content` outside `docs/reference/` (generated from the library's JSDoc),
      `America/New_York` is not the most frequent IANA zone: count every `Area/City` occurrence and
      show the table;
    - a visual check of the Converter Bench and the DST Inspector, in both themes at 1440 and 390,
      shows their new default zones, value and regionless locale, on `/tools/converter-bench/`,
      `/tools/dst-inspector/` and the reference pages that embed them;
    - `CURATED_TIMEZONES` is in UTC-offset order (its test);
    - the per-visitor cap resets at 00:00 UTC, and each brain's quota still at Google's Pacific
      midnight (`pt-day` tests).
14. **Citations (section 0, F1):** on the GNSS and Maritime guides, the five tool pages and the chat copy,
    `grep` finds no sentence that cites A.1046(27) or IEC 61108 as naming or recognising the six
    systems; every page that calls the systems "peers" carries the IMO recognition sentence and
    states the scope caveat once; IEC 61108 is cited only by part and system; IEC 61162 is cited as
    IEC 61162-1:2024, Edition 6.0. Each citation links or names its primary page from research §9a.
15. **The Workforce layer (section M):** `/industries/workforce/` lists the eight `workforce`
    functions as its own, and `/industries/transport/` lists them under "Functions it draws on"
    with the line "Part of the Workforce industry layer"; the Workforce guide is at
    `/guides/industries/workforce-hours-of-work/`, the mistakes page at `/mistakes/workforce/`; the
    five pages carry the tags of M2, each links a `/reference/workforce/…` page, and they sit under
    their industries in the sidebars; the API Reference has a `workforce` group under "By industry"
    and no `duty` group; no page names a regime, a regulator or a statute.
16. **Redirects.** `public/_redirects` holds three `301` rules (bare, trailing slash, `.md`) for:
    `isLeapSecond` (C2); each of the eight moved duty functions to its `/reference/workforce/…` page;
    `/reference/duty`, `/reference/duty/calculate`, `/reference/duty/validate`,
    `/guides/intervals/hours-of-work` and `/mistakes/duty` to their new pages (M3). No source is a
    live route in the manifest or the build, and every target is. On `wrangler dev` over the
    `after` build (which applies `_redirects`; the Python server does not), each old URL answers
    `301` and its `Location` opens a page that returns `200`. `grep` over `apps/dox/src` (outside
    `generated/` and the generated reference) finds no link to an old URL.
17. **The industry hubs.** `/industries/`, `/industries/workforce/`, `/industries/transport/`,
    `/industries/intermodal/`, `/industries/gnss/` and `/industries/maritime/` each return `200`
    in the `after` build, in declared order in the Industries sidebar group with their icons
    (`aria-hidden`). Each hub's function lists equal the corpus: its own namespace's functions, and
    per drawn-on module exactly that module's functions (GNSS lists `timescale`; Maritime lists
    `gnss` and `timescale`; Transport lists `workforce`). Each hub's guides, tools, scenarios and
    mistakes lists equal the pages whose frontmatter carries its tag. Every link on every hub
    resolves. The hubs are in `llms.txt` and `llms-full.txt`.
18. **The stacked chart (B9).** A script in `$SP` reads `$SP/after`'s corpus and
    `industries.json` and prints, per industry, its own count and each drawn-on module's count, and
    the distinct total of all own namespaces. On `/why-gmt/` in the `after` build:
    - each column's segments equal the script's counts, in declared order; Maritime has only shaded
      segments;
    - the caption's first number equals the distinct total, which is less than the sum of every
      column's height whenever a layer is drawn on, and `coreFunctions + industryFunctions` equals
      the corpus's function count (`gmt-stats` test);
    - no function is in two own namespaces (the script asserts it);
    - the tooltip names each shared layer and whether it is an industry layer or Core; the legend
      has a solid and a hatched swatch with words;
    - `contrast:measure` passes on `/why-gmt/` in both themes (7:1 for labels and ticks, 3:1 for the
      shaded segment's edge); no legend item or caption block has a left-only accent; the no-JS SVG
      shows the same segments as the live chart.
19. Firefox does not launch on this machine. Record it as blocked. Do not bypass the sandbox.

`pnpm run validate` is not run here: it rebuilds the library under the dev server. The main
session runs it once at the end (section K).

---

## J. Files

**New** (under `apps/dox/` unless rooted): `src/data/industries.json`;
`scripts/build-industry-pages.ts`, `scripts/build-utils/industry-pages.ts` and its test;
`src/lib/gnss-names.ts`, `gnss-widgets.ts`, `timescale-widgets.ts`, `gnss-lib.ts`,
`timescale-lib.ts` and their tests; for each of the five tools its pure module, mount, tests,
component, sheet and page (D1, D9–D12); `src/styles/gmt-gnss-widgets.css`;
`src/test/gnss-lib.ts`, `src/test/timescale-lib.ts`; the F1 pages
(`guides/industries/gnss-system-time-and-week-rollover.mdx`,
`guides/industries/maritime-gnss-time-and-week-rollover.mdx`,
`guides/core-date-operations/leap-seconds-and-tai.mdx`, five scenarios, `mistakes/gnss.mdx`,
`mistakes/leap-seconds.mdx`); `scripts/build-utils/moved-pages.ts` (M3); the moved Workforce pages
(M2).

**Changed:** `/scripts/stats.mjs`; `/README.md`, `/packages/gmt/README.md` (two lines);
`/.gitignore`; `/.agents/finalizer.md`, `/.agents/gmt-reviewer.md`,
`/.agents/skills/update-readme/SKILL.md`, `/.agents/skills/update-readme/references/steps.md`,
`/context/code-review-checklist.md` (one line); `/context/domination/issues/CORE-76.md` and
`/context/domination/tracker.md` (the CORE-76 lines only, M3); `package.json` (`generate`);
`astro.config.mjs`; `scripts/build-reference.ts`, `scripts/build-utils/index-pages.ts`,
`build-utils.ts`, `industry-sidebar.ts`, `renamed-functions.ts` and their tests;
`src/lib/industry-tags.ts`, `industry-overview.ts` and their tests; `src/data/gmt-stats.ts`,
`gmt-stats.json` (by `stats:sync`), `gmt-stats.test.ts`; `src/lib/why-gmt-charts.ts`;
`src/content/docs/why-gmt.mdx`; `src/components/SidebarSublist.astro`;
`src/pages/llms.txt.ts`, `llms-full.txt.ts`; the registration files of section E;
`src/lib/retrieval/search.test.ts`; the F2 pages and the four F1 indexes; the five Workforce pages (M2: two moved, three retagged), `guides/index.mdx` and every page that
linked them; `buildRedirects` with `redirects.test.ts`; `scripts/render-charts.ts` (B9);
the N1 files (`converter-bench-mount.ts`, `dst-inspector-mount.ts`, `curated-timezones.ts`,
`pt-day.ts` and the Worker's cap that reads it) and their tests; the N2 pages, presets and
starters, and the tests that assert their outputs.

---

## K. Order

The driver is building the library in this worktree. `pnpm --filter @gmt/dox test` runs
`generate`, which walks `packages/gmt/src` and runs the doc gate, so no Dox step starts while
library slices are half written.

| Step | What | Needs | Who |
| --- | --- | --- | --- |
| P1 | Library slices 0–8 green, with the GPS-only API removed (decision 9), the `{ notBefore }` era form (decision 13), `duty/` moved to `workforce/` with the `/duty` subpaths removed (decision 16), the barrels, exports map and `gmt-modules.ts` keys (L§5.1–5.4) and the library's wiring of L§5–§8.3 | — | driver |
| P2 | **One build of `packages/gmt/dist`**, by the main session, after warning the owner (his dev server reads `dist`). Nothing in this plan builds it again | P1 | main session |
| D1 | Section B with Workforce, Transport and Intermodal (GNSS and Maritime wait for their guides), the stacked chart (B9), the README lines; C1; C2 | P2, with the library's `workforce/` move landed | one `dox-builder` |
| S | D8's shared modules, loaders, test helpers and `gmt-gnss-widgets.css` | D1 | one `dox-builder` |
| D1b + D3 | One step. F1's pages, then the GNSS and Maritime entries in `industries.json`, their icons, their overview text (B7), the README's GNSS and Maritime links and the `guides/industries/index.mdx` edits (B6). Tests run at the end of the step, not between | D1, C1 | builder A |
| DU | Section M: the Workforce and Transport overview text, the two page moves and five retags with their reference links, the moved URLs and their redirects, the README `[duty]`/`[workforce]` links, the CORE-76 lines | D1 | builder B |
| N1 | Section N1: the widget defaults, `curated-timezones.ts`, `pt-day.ts`, `why-gmt-charts.ts` | D1 | builder C |
| T-G | **The GNSS track:** the decoder (D1–D7), then the Clock Converter (D9), then the Rollover Checker (D10), each widget first and its page last | S; each page's tag needs D3 | builder D |
| T-L | **The leap-second track:** the Timeline (D11), then Elapsed vs. Clock (D12) | S | builder E |
| R | **Registration, once, for all five:** section E, the D13 links and the five starters | T-G, T-L | one builder |
| HW | The Workforce guide's examples (N3), after DU moved it | DU | builder B |
| N2 | The example rebalance (N2), split by section (below) | DU, N1, and R for the starters | builders F–J |
| D4 | F2's links into the tools; the D7 and I12 retrieval rows | D1b + D3, R | one builder |
| T | Section I | everything above | `dox-tester` |
| V | `pnpm run validate`, once, by the main session, after warning the owner | T green | main session |

**What runs in parallel.** After D1 and S: D1b + D3, DU, N1, T-G and T-L run at once, each on its
own files. The two tracks write only their own new files: **no track edits a registration file**
(section E's files, `chat-constants.ts`, `astro.config.mjs`, the gate scripts). Step R makes every
registration edit at once, so `DOX_TOOL_DOCS` is appended in one order and no two builders touch
`dox-tools.ts`. HW follows DU on the same page. The N2 split runs after R, because the starters and
presets live in `chat-constants.ts` and the tool modules:

| N2 builder | Owns |
| --- | --- |
| F | `content/docs/guides/` (concepts, conversion, core-date-operations, zoned-date-operations, intervals) |
| G | `content/docs/guides/industries/` other than the Workforce guide (HW owns it), `content/docs/tools/` |
| H | `content/docs/scenarios/`, `content/docs/mistakes/` |
| I | the widget presets and defaults in `src/lib/*.ts` (`crossing-clock.ts`, `demurrage-clock.ts`, `free-time-ledger.ts`, `dwell-ledger.ts`, `cutoff-*.ts`, `journey-split.ts`, `delivery-scheduler.ts`, `timetable-reader*.ts`, `punctuality-board.ts`, `departure-board.ts`, `bl-date-stamp.ts`, `dtm-decoder.ts`, `zoned-input.ts`) and their tests |
| J | `chat-constants.ts` starters and `dox-tools.ts` examples, after builder I, so a starter's seed matches its tool's presets |

Builders F–I run in parallel. A content page that embeds a permalink to a tool whose presets
builder I changes keeps its own seeded values (a permalink carries them), so the content and preset
builders do not wait on each other.

What can be built before the library exists: nothing. Every Dox step waits for P2, and none builds
the library.

---

## L. `built.md` sections the builder reads

- **Rules that bind every change.**
- **Tiers 0–1:** Generator (A3a), all of it, especially "Where a type is documented…", "The doc
  gate", "Index pages", "The two industry namespaces stand apart…" with its Sidebar, divider,
  icon, Tools/Scenarios/Mistakes dividers, Root page, Overview text and Page tag bullets,
  "`public/_redirects`", "Every `build-utils` module … `referenceInputs()`" and "Unreleased
  badge"; AI surface (A3b); Guides (A4a).
- **Tier 2:** "Playground on every example"; "Sentinel-aware output everywhere"; the teaching
  widgets list (the EDI family, the INT-14 tools, the Cut-off Countdown's live clock); "A new tool
  is registered in lists no single test covers"; "Tools, scenarios, guides and mistakes carry an
  industry tag" and its trap; "A widget that cannot load says so"; "One control system for every
  widget"; every "Trap:" bullet in Tier 2; "The prose list dash stays out of widgets"; "Result
  regions ease through `.gmt-grow`"; "Tool pages", "`seedFromLocation` keeps only…" and the
  permalink trap; "`escapeAttr`"; "Gates".
- **Tier 6:** Retrieval; Widget tools; Brains and budget (for N1's cap); Traps; Runbooks ("a
  build or a second Astro command breaks a running `astro dev`", "A gate baseline is a clean
  worktree").
- **Reference:** `design-system.md` § Form controls, § Smooth growth, § Drawn charts, § Verifying
  a change is visually safe; `visual-design.md` § Corners, borders, focus and § Layout
  stability; `style-guide.md` whole.

---

## M. The Workforce layer (step DU)

`duty/` becomes `workforce/` (decision 16). The driver moves the seven duty calculators to
`workforce/calculate` and `isValidDutyLog` to `workforce/validate`, and removes the `/duty`
subpaths (P1). The library side, its exports map and the `GMT_MODULES` keys (`duty/calculate` and
`duty/validate` out, `workforce/calculate` and `workforce/validate` in, as `gmt-modules.test.ts`
requires) are the driver's; DU checks they landed and reports it if not.

1. **Declaration and text.** D1 already declares Workforce (own namespace `workforce`) and
   Transport drawing on it (B2). DU writes Workforce's overview text and Transport's crew-hours
   pain point (B7). Confirm `/industries/workforce/` lists the eight `workforce` functions under
   "Its own functions" and `/industries/transport/` lists them under "Functions it draws on" with
   "Part of the Workforce industry layer", with no hand edit; a needed hand edit is a generator
   bug, fixed in the generator.
2. **Move and retag the pages.**
   - `guides/intervals/hours-of-work.mdx` moves to `guides/industries/workforce-hours-of-work.mdx`
     and becomes the Workforce guide (its title stays unless the move makes it read wrongly);
     tag `[workforce]`.
   - `mistakes/duty.mdx` moves to `mistakes/workforce.mdx` (docs-site.md names a realm's mistakes
     page `mistakes/<realm>.mdx`); tag `[workforce]`; its description names the `workforce/`
     namespace, not "GMT's duty/ module".
   - The three scenarios keep their slugs and take `[workforce, transport]` where the example is a
     driver's or an operator's log (`duty-day-is-not-midnight`, `paired-rest-that-does-not-qualify`)
     and `[workforce]` otherwise (`sliding-window-not-calendar-day`).
   - **The tag rule needs a link.** These pages import from the root barrel and link no duty
     reference page today, so under B8 they use no declared module and the tag would fail. Each
     gains at least one link to the `/reference/workforce/<module>/<function>/` page of a function
     it shows, in its related links or beside the passage.
   - Every link to the moved pages (`guides/index.mdx`, the scenarios, the mistakes page, the
     guides' "See also" lists, any `/dox` starter or tool page) points at the new paths.
3. **Moved URLs and their redirects.**
   - Every hand-written link to `/reference/duty/…` points at `/reference/workforce/…` (same module
     and function names). An import in a code block from `@northguild/gmt/duty/…` becomes
     `@northguild/gmt/workforce/…`. `grep -rn "reference/duty\|gmt/duty\|guides/intervals/hours-of-work\|mistakes/duty"`
     over `apps/dox/src` outside `generated/` and `content/docs/reference/` finds nothing afterwards.
   - **Function redirects:** `RENAMED_FUNCTIONS` (C2's file) gains one entry per moved function,
     `duty/calculate/<name>` → `workforce/calculate/<name>` and `duty/validate/isValidDutyLog` →
     `workforce/validate/isValidDutyLog`. They shipped in 1.19.0, so their old URLs have inbound
     links; each gets the three `301` rules.
   - **Other moved pages:** a new leaf list, `scripts/build-utils/moved-pages.ts` (`MOVED_PAGES`,
     `{ from, to }` site paths), holds `/reference/duty` → `/reference/workforce`,
     `/reference/duty/calculate` → `/reference/workforce/calculate`, `/reference/duty/validate` →
     `/reference/workforce/validate`, `/guides/intervals/hours-of-work` →
     `/guides/industries/workforce-hours-of-work` and `/mistakes/duty` → `/mistakes/workforce`.
     `buildRedirects` writes the same three `301` rules for each (bare, trailing slash, `.md`
     twin). Generation fails when a `to` is not a page or a route in the build's page list, or a
     `from` still is one. `redirects.test.ts` covers it. The `/dox` chat's links come from the
     route manifest and the retrieval chunks, so they follow the move with no list.
   - Shared duty types keep their `/reference/types/<Name>` pages; their tag becomes Workforce by
     `typeIndustry`, and the links inside them change by regeneration.
4. **README.** The namespace line loses `[duty]` and gains `[workforce]`, and the "By industry:"
   line leads with Workforce (B3). Within section 0's README exception; if the library finalizer
   has made the namespace edit, DU confirms `stats.mjs check` passes and leaves it.
5. **Context docs**, in the present tense with no history: `context/domination/issues/CORE-76.md`
   line 41 says the duty engine is the `workforce/` cross-industry layer, its guide is the
   Workforce industry guide, and each industry that uses it declares `workforce` (Transport today;
   Maritime, Rail, Aviation and Health when they arrive). The id `CORE-76` stays.
   `context/domination/tracker.md`'s CORE-76 notes say the same in one line. `context/dox/built.md`
   states the cross-industry-layer rule of B1. Then `grep -rn "duty" context/dox
   context/domination/overview.md` and correct any Dox line that names a `duty/` namespace; a needed
   `overview.md` change is reported to the main session.
6. **No changeset from this step and no skills change.** The library's move carries its own
   changeset and skills update; `/tanstack-intent` is run to confirm it reports nothing more for
   the Dox side.

---

## N. The Dox items of the international-standards audit

From `/Users/craigcurtis/.claude/plans/the-current-story-for-mutable-catmull.md`, step 3 (Dox) and
step 4 (Dox and chat). The library half (JSDoc, the parser default locale, NRF wording, skills,
README samples) is the library pipeline's; its regenerated reference pages are not edited here.

### N1. Widget defaults (step N1)

- **`converter-bench-mount.ts` (40–43):** the default value, source and target zones open on a
  non-US pair chosen for its DST shape: `Europe/London` to `Australia/Sydney` (opposite hemispheres,
  so the two zones change clocks in opposite seasons). The default value is a London wall time in
  that zone's offset, its output re-run. `DEFAULT_LOCALE` is `"en"`. The Converter Bench's tests
  and the reference pages that embed it change with it.
- **`dst-inspector-mount.ts` (69):** `DEFAULT_ZONE = "Europe/London"` (a spring gap and an autumn
  overlap, like the old default). Its tests, presets and page copy follow, each output re-run.
- **`curated-timezones.ts`:** `CURATED_TIMEZONES` ordered by standard UTC offset, west to east,
  `UTC` at its offset; a test asserts the order from Temporal's offsets on one fixed winter
  instant. `globe-zones.ts` and the selects that read it follow without other change.
- **`pt-day.ts` (24):** the site's per-visitor daily cap counts UTC days: a new
  `VISITOR_CAP_TIME_ZONE = "UTC"` used by the cap's day key and its reset. `QUOTA_TIME_ZONE`
  stays `America/Los_Angeles` for each brain's own quota, because that is the provider's stated
  reset, and its comment says so. The reset text shown to readers names each clock. `pt-day` and
  the cap's tests follow.
- **`why-gmt-charts.ts` (36):** `new Intl.NumberFormat(undefined, …)`, the reader's locale. The
  charts' server-rendered text uses the same call, and the visual gate records the change.

### N2. The example rebalance (step N2)

- **Scope:** `apps/dox/src/content` (outside the generated `docs/reference/`), the
  `CHAT_STARTERS`, the `dox-tools.ts` schema examples, and the widget presets and defaults in
  `src/lib`. At re-verification `America/New_York` led the content examples many times over
  `Europe/London` and `Asia/Tokyo`, and appeared in most widget modules; re-count before starting
  (the I13 gate is the measure).
- **The rule:** rotate examples through `Europe/London`, `Asia/Tokyo`, `Australia/Sydney`,
  `America/Sao_Paulo`, `Africa/Johannesburg` and `Asia/Kolkata`. Keep a zone where the example
  needs its DST shape (pick the rotated zone with the same shape: a northern spring gap is
  `Europe/London`, a southern one `Australia/Sydney`; a zone without DST is `Asia/Tokyo` or
  `Asia/Kolkata`) or where a standard's own code names it (an X12 time code). `America/New_York`
  may remain as one peer among the six-plus, never the lead and never the majority. Locales are
  regionless where a locale is needed (`"en"`), unless the example is about a region's format.
  No US holiday (`07-04`) leads a calendar example.
- **Re-verify every output by running it** against the built `dist`. A changed example's result is
  pasted from the run, never edited by hand. Test fixtures under `packages/gmt` and the CI zone
  matrix are untouched; a Dox test that asserts a changed preset's output is updated from the run,
  and each such change is listed in the builder's report.
- **Permalinks** in content are rebuilt with `encodeWidgetPermalink` when their seed changes.
- **Starters:** each area's cards rotate zones; `chat-starters.test.ts`'s concrete-place pattern
  (`/Tokyo|New York|London|\d/`) widens to the six rotated cities, so no card needs New York to
  pass.
- **The split** is in section K (builders F–J).

### N3. The Workforce guide's examples (step HW, after DU)

- **No US regime leads.** Reorder and reshape the examples so the first is shaped like a sea
  regime (hours of rest per 24 hours and per 7 days, rest in at most two periods), then shapes
  like an international road regime (daily and fortnightly driving, a weekly rest) and an
  international aviation regime (a flight-duty period and cumulative limits over rolling windows),
  then the others, ending with the resident-doctor shape (the Health audience).
- **Never name a regime.** No convention, regulation, agency or statute name: each regime is
  labelled by its numbers only ("10 hours of rest in any 24, 77 in any 7"), as the page's
  "Five example regimes" section (line 823) already does; the reorder keeps that. The section's
  count in its heading follows the examples it holds.
- Every result is re-run against `dist`. The page keeps its Workforce tag and new path from DU.
