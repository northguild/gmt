# Dox: the documentation site for `@northguild/gmt`

This file has been split into a progressive-disclosure directory. Read what you need:

- [overview.md](overview.md) — Context, architecture, verified findings, workspace
  integration, visual design language, verification, risks
- [story-groups.md](story-groups.md) — Tier 0–6 story summaries (23 units of work over
  13 issues; see below)
- [tracker.md](tracker.md) — Issue/status table, build order
- [issues/DOX-A.md](issues/DOX-A.md) … [issues/DOX-E.md](issues/DOX-E.md) — Full
  GitHub-issue-ready specs, one file per issue letter, each now covering the issue's
  lettered sub-stories
- [appendix-parked.md](appendix-parked.md) — Researched but deliberately unscheduled
  work (audio, voice, the full-bleed reactive scene). No story IDs, not in the
  sequence — read before proposing any of it, so the findings aren't re-derived.
- [example-sibling-repo-docs.md](example-sibling-repo-docs.md) — **Reference only, not a
  target.** How a sibling `@northguild/worktree` repo built its docs site and AI chat.
  Reviewed 2026-08-21; what was taken from it and what was rejected is recorded in
  [overview.md](overview.md) §2 "Reviewed prior art". Do not build what it describes —
  its stack and its no-retrieval design are both deliberate rejections here.

**Re-audited against the repo and npm on 2026-08-26.** The original 13-story plan grew
into 23 units of work across 7 tiers — **no new GitHub issues were created**; new work
folds into the existing #130–#142 as lettered sub-stories (`DOX-A3a`/`DOX-A3b`, `DOX-B2a`
through `DOX-B2d`, and so on), the same pattern `context/roadmap/` used for `J0a`/`J0b`.
See [tracker.md](tracker.md) for the full mapping.

**Dox is a small docs site first and a much larger ambition second.** Tier 0 — three
stories — ships a real, deployed, searchable, linkable documentation site over all 504
functions. That is the entire MVP. Everything from Tier 1 onward is additive: an
interactive globe, a live widget on every one of 1,860 examples, a mentor-voiced
real-world scenario layer, and a chat that answers by mounting real widgets rather than
printing code blocks. If you are picking up a story, the ordering is the point — see
[overview.md](overview.md) §1, and §5 for the full tier table.
