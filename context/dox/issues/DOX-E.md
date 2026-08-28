# Issue #142 — The globe

**Rewritten in full on 2026-08-26 by explicit user decision.** The 2026-08-21 draft
scoped this as a purely decorative, droppable landing-page flourish and told future
readers not to undo that scoping. **The user has deliberately undone it.** The globe is
now an interactive product feature — click a zone, read its live state — and a second
sub-story, `DOX-E1b`, adds a multi-zone time scrubber. Both fold into the same GitHub
issue, #142. **No new GitHub issues.**

`DOX-E1` spans two sub-stories, both Tier 4: `DOX-E1a` (interactive globe) and `DOX-E1b`
(multi-zone time scrubber). The issue stays open until `DOX-E1b` also lands.

## Definition of done — binding for every story in this file

- Nothing in Tiers 0–3 or Tier 5 depends on either story in this file — deleting this
  issue's stories must leave the rest of the site fully intact. (This is weaker than the
  2026-08-21 draft's "the globe is decoration" — it is now a real feature — but the
  independence property that made it safe to schedule late is preserved.)
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

## Promoted from decoration to flagship — read this before scoping down
The 2026-08-21 draft specified this as a wireframe hero with meridian rings, ambient
rotation, and nothing clickable — deliberately scoped as pure decoration to avoid the
superseded plan's failure mode of a full-bleed scene that every glass panel had to stay
legible over. **The user has explicitly asked for more: click a zone, read its live
local time, UTC offset, and DST state.** This is now a product feature, not a flourish.

The original scoping's actual lesson still holds and is worth preserving: the globe
lives on the landing page, not behind every panel, so nothing has to stay legible
through it and there is no combined worst-case frame budget (scene + streaming + border
animation at once). Making the globe interactive did not reintroduce that risk — it is
still one canvas on one page. Keep it there.

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
  functions this story and `DOX-E1b` need are verified present as of 2026-08-26.
- Hydrated `client:visible`, **on the homepage only**.
- Pause rendering when the tab is hidden.
- Static fallback under `prefers-reduced-motion` and where WebGL is unavailable.
- Slow ambient rotation when idle; stops or slows on interaction.

## Two decisions this story must settle, not inherit

**Where do zone coordinates come from?** Nothing in `@northguild/gmt` maps an IANA
timezone identifier to a latitude/longitude — `getTimeZones()` returns identifiers only.
Vendor tzdata's `zone1970.tab` (public domain, ~450 rows, roughly 30 KB as JSON) with a
provenance comment and a refresh reminder: tzdata itself releases several times a year,
so this is not a one-time import.

**How should it render?** The 2026-08-21 draft assumed Three.js + React Three Fiber
without discussion. For a globe that must be clickable and keyboard-navigable, that may
not be the right call — an orthographic-projection `<canvas>` or an SVG globe could be
lighter and give hit-testing and focus order essentially for free, where a WebGL scene
requires inventing both. **Prototype both before committing.** The goal is the
interaction the user asked for, not a specific rendering framework. Check the bundle
cost of whichever is chosen against the homepage's performance budget.

## What the interactive version does not change
Note this is still the one place in the epic where a `@octanejs/three` +
`@octanejs/drei` island could be reconsidered later, since it is fully isolated on the
landing page. Do not do so for this story regardless of the rendering-approach decision
above: `@octanejs/drei` was `0.0.9` as of 2026-08-21 with 43 `octane` releases in
roughly eight weeks — re-verify the ecosystem's maturity before ever depending on it.

## Definition of done
- The globe renders on the homepage and nowhere else — verify no globe-rendering bundle
  is loaded on a reference page.
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
Part of the Dox epic — see `context/dox/index.md`, Tier 4, item DOX-E1b. New in the
2026-08-26 rewrite, added by explicit user request alongside the globe's promotion to a
flagship feature.
Depends on DOX-E1a (zone selection) and DOX-B1b (permalinks, so a planned meeting time
can be shared).

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
- Reuse `DOX-B1b`'s permalink mechanism so a specific pinned-zones-plus-time
  configuration can be copied and shared, e.g. to propose a meeting time.

## Before starting
Decide whether this lives embedded in the same homepage surface as `DOX-E1a`'s globe or
as its own linked page — a meeting-planning tool may get more use as a directly
linkable, bookmarkable page than as a homepage feature people have to rediscover.

## Definition of done
- At least three pinned zones update in sync as the slider moves.
- At least one demonstrated scenario shows a DST boundary changing a pinned zone's
  offset mid-drag.
- The configuration is shareable as a permalink and reproduces exactly on load.
- Keyboard-operable: the slider has a typed-input or stepped-keyboard equivalent.
```
