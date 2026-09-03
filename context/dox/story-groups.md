# Story groups

**23 units of work across 7 tiers, mapped onto 14 GitHub issues — #130–#142 plus #171 for
`DOX-C0`.** New work normally enters as a lettered sub-story on the issue it
naturally belongs to (`DOX-A3a`/`DOX-A3b`, `DOX-B2a`–`DOX-B2d`, …). Sub-story IDs are
for planning legibility; GitHub still tracks work at the issue level. Full per-story
specs in [`issues/DOX-<letter>.md`](issues/); tier table in
[overview.md](overview.md) §5.

**#171 (`DOX-C0`) is the one story with its own issue** rather than a sub-story slot —
infrastructure rather than chat, and reviewable on its own.

The issue files are the source of truth for per-story detail. This file names the tier
shape and its ordering constraint in one place.

- **Tier 0 — Ship the site (the MVP).** `DOX-A1` → `DOX-A2` → `DOX-A3a`. Order-locked:
  a real deployed searchable docs site must exist before anything else. See
  [issues/DOX-A.md](issues/DOX-A.md).
- **Tier 1 — Substance and foundations.** `DOX-A5` tokens, `DOX-A4a` guides, `DOX-A3b`
  `llms.txt`/raw markdown. Tokens come before Tier 2 because every widget from Tier 2
  onward is styled from them. See [issues/DOX-A.md](issues/DOX-A.md).
- **Tier 2 — The widget platform.** `DOX-B1a` textarea playground,
  `DOX-B2a`–`d` auto-embed, DST inspector, interval visualizer, converter bench. The
  differentiator: every one of 1,860 examples runs the real, shipped library, live, in
  the browser. See [issues/DOX-B.md](issues/DOX-B.md).
- **Tier 3 — HUD identity.** `DOX-D1`, `DOX-D2` — glass, borders, chamfer, motion. The
  expensive half of the aesthetic, applied as a CSS layer over pages and widgets that
  already work. See [issues/DOX-D.md](issues/DOX-D.md).
- **Tier 4 — The globe.** `DOX-E1a`/`b` — interactive globe, multi-zone scrubber. A
  product feature: click a zone, read its live state. See
  [issues/DOX-E.md](issues/DOX-E.md).
- **Tier 5 — Real-world scenarios.** `DOX-A4b`–`d` — scenario template, ported pitfalls,
  mentor index. Content-heavy, may run in parallel with Tiers 2–4 once `DOX-B1a` exists
  (different skill profile, no component-build contention). See [issues/DOX-A.md](issues/DOX-A.md).
- **Tier 6 — Ask Dox (the chatbot that mounts widgets).** `DOX-C0` (#171) lays the
  React + Tailwind + AI Elements foundation and **blocks the rest**; then
  `DOX-C1`–`DOX-C3a`/`b` — retrieval, Worker, the two chat shells, widget registry. Built
  on [AI Elements](https://elements.ai-sdk.dev/) + the AI SDK with **two surfaces over one
  core**: a draggable dock on every page and a dedicated `/dox` route with a widget rail
  carrying the Tier 2 widgets and the Tier 4 globe. See [issues/DOX-C.md](issues/DOX-C.md).

**Ordering constraints.** Tier 0 is the only hard cross-tier sequence. Tier 1 onward may be
reordered freely. Tier 5 may run in parallel with Tiers 2–4 once `DOX-B1a` exists.
**Within Tier 6, `DOX-C0` must land first** — every other Tier 6 story assumes it.
Each story is independently verifiable; do not start the next sub-story on an issue
until the current one's Definition of Done passes. **An issue closes when its last
sub-story lands, not its first** — see [tracker.md](tracker.md).

Parked work carries no story ID and never enters this file — see
[appendix-parked.md](appendix-parked.md).
