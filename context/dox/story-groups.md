# Story groups

**22 units of work across 7 tiers, mapped onto the same 13 GitHub issues (#130–#142) —
no new issues are created.** New work enters as a lettered sub-story on the issue it
naturally belongs to (`DOX-A3a`/`DOX-A3b`, `DOX-B2a`–`DOX-B2d`, …). Sub-story IDs are
for planning legibility; GitHub still tracks work at the issue level. Full per-story
specs in [`issues/DOX-<letter>.md`](issues/); tier table in
[overview.md](overview.md) §5.

**Collapsed 2026-09-02.** The full per-story narrative that lived here is gone — the
issue files are the source of truth. This file now exists to name the tier shape and
its ordering constraint in one place.

- **Tier 0 — Ship the site (the MVP).** `DOX-A1` → `DOX-A2` → `DOX-A3a`. Order-locked:
  a real deployed searchable docs site must exist before anything else. See
  [issues/DOX-A.md](issues/DOX-A.md).
- **Tier 1 — Substance and foundations.** `DOX-A5` tokens, `DOX-A4a` guides, `DOX-A3b`
  `llms.txt`/raw markdown. Moved earlier than the original plan's Group A ordering
  because every widget from Tier 2 onward is styled from Tier 1's tokens. See
  [issues/DOX-A.md](issues/DOX-A.md).
- **Tier 2 — The widget platform.** `DOX-B1a` textarea playground,
  `DOX-B2a`–`d` auto-embed, DST inspector, interval visualizer, converter bench. The
  differentiator: every one of 1,860 examples runs the real, shipped library, live, in
  the browser. See [issues/DOX-B.md](issues/DOX-B.md).
- **Tier 3 — HUD identity.** `DOX-D1`, `DOX-D2` — glass, borders, chamfer, motion. The
  expensive half of the aesthetic, applied as a CSS layer over pages and widgets that
  already work. See [issues/DOX-D.md](issues/DOX-D.md).
- **Tier 4 — The globe.** `DOX-E1a`/`b` — interactive globe, multi-zone scrubber.
  Promoted from decoration to flagship by explicit user decision. See
  [issues/DOX-E.md](issues/DOX-E.md).
- **Tier 5 — Real-world scenarios.** `DOX-A4b`–`d` — scenario template, ported pitfalls,
  mentor index. Content-heavy, may run in parallel with Tiers 2–4 once `DOX-B1a` exists
  (different skill profile, no component-build contention). See [issues/DOX-A.md](issues/DOX-A.md).
- **Tier 6 — Ask Dox (the chatbot that mounts widgets).** `DOX-C1`–`DOX-C3a`/`b` —
  retrieval, Worker, chat panel, widget registry. Escalated to widget-emitting by
  explicit user decision. See [issues/DOX-C.md](issues/DOX-C.md).

**Ordering constraint.** Tier 0 is the only hard sequence. Tier 1 onward may be
reordered freely. Tier 5 may run in parallel with Tiers 2–4 once `DOX-B1a` exists.
Each story is independently verifiable; do not start the next sub-story on an issue
until the current one's Definition of Done passes. **An issue closes when its last
sub-story lands, not its first** — see [tracker.md](tracker.md).

Parked work carries no story ID and never enters this file — see
[appendix-parked.md](appendix-parked.md).
