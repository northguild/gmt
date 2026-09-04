# Dox: the documentation site for `@northguild/gmt`

This file has been split into a progressive-disclosure directory. Read what you need:

- [overview.md](overview.md) — Context, architecture, decisions, hosting, prior-art
  verdicts, tier table (~18 KB; the entry file)
- [tracker.md](tracker.md) — Issue/status table, build order
- [story-groups.md](story-groups.md) — One paragraph per tier, naming the stories and
  pointing at the issue file
- [appendix-parked.md](appendix-parked.md) — Researched but deliberately unscheduled
  work. Read before proposing audio, voice, full-bleed 3D, or a new model choice.
- [issues/DOX-A.md](issues/DOX-A.md) … [issues/DOX-E.md](issues/DOX-E.md) — Full
  GitHub-issue-ready specs, one file per issue letter, each now covering the issue's
  lettered sub-stories

**Detailed reference — load only when the story needs it:**

- [reference/verified-findings.md](reference/verified-findings.md) — overview §1;
  verified facts that shaped the plan
- [reference/visual-design.md](reference/visual-design.md) — overview §3; visual
  design language. Implementation rules:
  [reference/design-system.md](reference/design-system.md)
- [reference/workspace-integration.md](reference/workspace-integration.md) — overview
  §4; the four easy-to-miss files (only relevant on `DOX-A1`)
- [reference/verification-and-risks.md](reference/verification-and-risks.md) —
  overview §6 + §7; epic-level cross-cutting list
- [reference/findings/speech-synthesis-capture.md](reference/findings/speech-synthesis-capture.md)
  — the one hard audio finding
- [reference/findings/globe-rendering-approach.md](reference/findings/globe-rendering-approach.md)
  — DOX-E1a: why the globe is `d3-geo` SVG/canvas, not WebGL
- [reference/rejected-candidates.md](reference/rejected-candidates.md) — the three
  declined items, so they are not re-proposed
- [reference/prior-art/worktree-cli-snapshot-2026-08-21.md](reference/prior-art/worktree-cli-snapshot-2026-08-21.md)
  — the sibling-repo docs write-up, moved from this directory

Dox is a small docs site first and a much larger ambition second. Tier 0 — three
stories — ships a real, deployed, searchable, linkable documentation site over all 504
functions. That is the entire MVP. Everything from Tier 1 onward is additive. If you
are picking up a story, see [overview.md](overview.md) §1 and §5 for the tier table.

**Picking up Tier 6?** It is built on [AI Elements](https://elements.ai-sdk.dev/) + the
AI SDK, with a foundation story `DOX-C0` (issue **#171**) and two chat surfaces — a
draggable dock on every page **and** a dedicated `/dox` route. Start at
[issues/DOX-C.md](issues/DOX-C.md).
