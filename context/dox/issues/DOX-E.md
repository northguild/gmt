# Issue #142 — The globe

The globe is an interactive product feature — click a zone, read its live state — with a
second sub-story, `DOX-E1b`, adding a multi-zone time scrubber. Both fold into GitHub
issue #142.

`DOX-E1` spans two sub-stories, both Tier 4: `DOX-E1a` (interactive globe) and `DOX-E1b`
(multi-zone time scrubber). The issue stays open until `DOX-E1b` also lands.

## The globe has two homes

The globe renders on the homepage **and** in the dedicated `/dox` chat route's **widget
rail**: spinnable, with timezone demarcation and global clocks alongside the chat.
Consequences:

- **`DOX-E1a` renders on the homepage and `/dox`, nowhere else.**
- **`DOX-E1b`'s multi-zone clock surface is the `/dox` widget rail.**

**The independence property is binding.** `/dox` must render and be fully usable with
this issue's stories absent — `DOX-C3a`'s DoD asserts exactly that. The dependency runs
one way: Tier 6 may _host_ the globe, but must not _require_ it.

## Definition of done — binding for every story in this file

- Nothing in Tiers 0–3 or Tier 5 depends on either story in this file — deleting this
  issue's stories must leave the rest of the site fully intact, and `/dox` (Tier 6) must
  still render usefully without them.
- Neither story ever delays content becoming readable.
- Gated behind `prefers-reduced-motion`, and both degrade cleanly where WebGL is
  unavailable.
- **Every interaction has a keyboard path.** A globe you can only click and a scrubber
  you can only drag are both unusable by a meaningful fraction of readers, and the gap
  is invisible during development on a mouse-and-trackpad desktop.

---

### Issue #142 — DOX-E1

**GitHub Issue:** #142 — see tracker.md

`DOX-E1` spans two sub-stories, both Tier 4: `DOX-E1a` (interactive globe) and `DOX-E1b`
(multi-zone time scrubber). The issue stays open until `DOX-E1b` also lands.

#### DOX-E1a — Interactive globe

**GitHub Issue:** #142 — see tracker.md\_

**Title:**

```
DOX-E1a Add an interactive globe: click a zone, read its live time and DST state
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 4, item DOX-E1a.
Depends on DOX-A5 (tokens). Independent of Tiers 2, 3, and 6 — it can be built or
dropped at any point after Tier 0 without affecting them.

## A product feature, not a flourish — read this before scoping down
The globe is interactive: click a zone, read its live local time, UTC offset, and DST
state. It is **not** a wireframe hero with nothing clickable.

One constraint from the original scoping still holds: the globe lives on the landing
page and the `/dox` rail, not behind every panel, so nothing has to stay legible through
it and there is no combined worst-case frame budget (scene + streaming + border
animation at once). It is one canvas per surface. Keep it that way.

## Gap
A temporal library's landing page should look like it knows what a timezone is, and a
reader should be able to act on that from the very first page they land on — not just
admire it.

## Scope
- A globe with meridian and latitude rings, in the DOX-A5 palette, rendering a
  day/night terminator computed from the current instant.
- Click (or otherwise select) a zone and read its live local time, UTC offset, and DST
  state, computed from the already-exported `getTimeZones`, `getZonedNow`,
  `getTimeZoneOffset`, `isInDaylightSaving`, and `hasDaylightSaving` — all seven
  functions this story and `DOX-E1b` need are present in the library.
- Hydrated `client:visible`, **on the homepage and the `/dox` widget rail only**.
- **Spinnable, not merely clickable.** Drag to rotate, with visible timezone demarcation
  and live clocks — this is what the `/dox` rail is for.
- Pause rendering when the tab is hidden.
- Static fallback under `prefers-reduced-motion` and where WebGL is unavailable.
- Slow ambient rotation when idle; stops or slows on interaction.

## Two decisions this story must settle, not inherit

**Where do zone coordinates come from?** Nothing in `@northguild/gmt` maps an IANA
timezone identifier to a latitude/longitude — `getTimeZones()` returns identifiers only.
Vendor tzdata's `zone1970.tab` (public domain, ~450 rows, roughly 30 KB as JSON) with a
provenance comment and a refresh reminder: tzdata itself releases several times a year,
so this is not a one-time import.

**Still open.** `apps/dox/src/lib/timezones.ts` already ships a `TIMEZONES` table of
`{ id, lat, lng }` — but only **10 curated zones**, built for `TimezoneMap`. That is
prior art for the shape, not a substitute for the data. Decide whether this story needs
all ~450 rows or whether a curated set is genuinely better for a globe a reader spins.

**How should it render? — largely pre-answered.** Check the repo before prototyping
anything: `d3-geo`, `topojson-client` and `world-atlas` are **already dependencies** of
`apps/dox`, and `d3-geo`'s `geoOrthographic` projection gives a draggable, spinnable
globe with hit-testing and DOM focus order essentially for free — precisely the two
things a WebGL scene would force us to invent.

There is more prior art than that: `apps/dox/src/lib/timezone-map.ts` already exports
`initTimezoneMap(host, clockPanel)`, `apps/dox/src/components/TimezoneMap.astro` already
renders a live clock panel, and `gmt-map.css` already styles it. The globe is plausibly
an orthographic re-projection of a pipeline that exists and works, not a new rendering
stack.

**So: start from `d3-geo`, and only reach for WebGL if it demonstrably cannot do what is
asked.** Record the decision either way. Check the bundle cost of whichever is chosen
against the homepage's performance budget.

**Reuse `initTimezoneMap`'s signature.** `DOX-C3b` mounts widgets by calling
`mount(root)`, and a globe that takes its host element as an argument drops into that
registry with no adapter. A globe wired to `document.getElementById` will need refactoring
in Tier 6 — do it right the first time.

## Octane
This is the one place in the epic where a `@octanejs/three` + `@octanejs/drei` island
could be reconsidered later, since it is fully isolated on the landing page. Do not do so
for this story regardless of the rendering-approach decision above — the `@octanejs/*`
adapters are pre-1.0 and moving fast; re-verify the ecosystem's maturity before ever
depending on it.

## Definition of done
- The globe renders on the homepage and in the `/dox` widget rail, and **nowhere else** —
  verify no globe-rendering bundle is loaded on a reference page.
- The globe can be spun by dragging, with timezone demarcation visible while it rotates.
- Its entry point takes a host element (`mount(root)` / `initGlobe(host)`), so `DOX-C3b`
  can mount it without a refactor.
- Selecting a zone shows correct live local time, UTC offset, and DST state, verified
  against at least one zone currently observing DST and one that is not.
- The day/night terminator is positioned correctly for the current instant.
- Tab-hidden pauses rendering (verify in the devtools performance profiler, not
  visually).
- `prefers-reduced-motion` yields a static state with zone selection still functional.
- **Every zone is selectable via keyboard alone** (e.g. arrow-key stepping through
  zones, or a searchable list as a non-visual equivalent) — this is not optional
  progressive enhancement, it is a Definition of Done item.
- The page is fully readable and interactive before the globe finishes loading.
- Homepage Lighthouse performance is not meaningfully worse than a reference page's.
```

---

#### DOX-E1b — Multi-zone time scrubber

**GitHub Issue:** #142 — see tracker.md\_ (folds into the same issue as `DOX-E1a`)

**Title:**

```
DOX-E1b Add a multi-zone time scrubber for the meeting-planner use case
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 4, item DOX-E1b.
Depends on DOX-E1a (zone selection). Needs a shareable-URL mechanism for a planned
meeting time; no permalink system exists in the epic, so this story adds a minimal
query-string encoder for its own state.

## Gap
"What time works for people in three different zones" is arguably the single most
common real reason anyone reaches for a timezone library, and nothing in the epic
currently demonstrates it as a coherent workflow — only as individual function calls
scattered across reference pages.

## Scope
- Pin several IANA zones (reusing `DOX-E1a`'s zone list and selection mechanism).
- A time slider; dragging it moves every pinned zone's displayed clock together, using
  `convertZonedToZoned` and `getTimeZoneOffset` under the hood.
- DST boundaries must visibly "bite" — a zone whose offset changes as the slider crosses
  a transition should show that change, not silently reflow.
- Encode a specific pinned-zones-plus-time configuration into the URL so it can be
  copied and shared, e.g. to propose a meeting time.

## Before starting
The scrubber lives as the **global clocks panel in the `/dox` widget rail**, next to the
chat and the globe — a directly linkable, bookmarkable surface. The homepage may show a
reduced version alongside the globe; `/dox` is the full one.

`apps/dox/src/components/TimezoneMap.astro` and `gmt-map.css` already ship a live
multi-zone clock panel — start from it rather than from scratch.

## Definition of done
- At least three pinned zones update in sync as the slider moves.
- At least one demonstrated scenario shows a DST boundary changing a pinned zone's
  offset mid-drag.
- The configuration is shareable as a permalink and reproduces exactly on load.
- Keyboard-operable: the slider has a typed-input or stepped-keyboard equivalent.
```
